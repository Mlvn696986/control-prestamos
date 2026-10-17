import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { once } from "node:events";
import { execFileSync } from "node:child_process";
import serverModule from "../servidor-local.js";
test("servidor antiguo sirve solo demo y no expone archivos privados", async () => {
  execFileSync(process.execPath, ["scripts/build-cloudflare.js", "--local"]);
  const outputIdentity = fs.statSync("dist-local").ino;
  fs.writeFileSync("dist-local/unexpected-test.txt", "fixture privada");
  execFileSync(process.execPath, ["scripts/build-cloudflare.js", "--local"]);
  assert.equal(fs.existsSync("dist-local/unexpected-test.txt"), false);
  assert.equal(fs.statSync("dist-local").ino, outputIdentity);
  const server = serverModule.createLocalServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const config = await (await fetch(base + "/supabase-config.js")).text();
    assert.ok(config.includes('url: ""'));
    assert.ok(!config.includes("supabase.co"));
    for (const file of ["/.git/config", "/.dev.vars", "/backups/test.zip", "/src/worker.js", "/supabase-schema.sql", "/api/billing/checkout"]) {
      assert.equal((await fetch(base + file)).status, 404, file);
    }
    for (const suffix of ["/", "/?billing=return", "/?code=fixture"]) {
      const response = await fetch(base + suffix);
      assert.equal(response.status, 200, suffix);
      assert.match(await response.text(), /<link\b[^>]*rel="canonical"[^>]*href="https:\/\/ermif\.com\/"/);
    }
    const robots = await fetch(base + "/robots.txt");
    assert.equal(robots.status, 200);
    assert.match(robots.headers.get("Content-Type"), /^text\/plain\b/);
    const robotsText = await robots.text();
    assert.match(robotsText, /^User-agent:\s*\*\s*$/m);
    assert.match(robotsText, /^Sitemap:\s*https:\/\/ermif\.com\/sitemap\.xml\s*$/m);
    assert.doesNotMatch(robotsText, /<!doctype html|<html/i);
    const sitemap = await fetch(base + "/sitemap.xml");
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.headers.get("Content-Type"), /^(application|text)\/xml\b/);
    const sitemapText = await sitemap.text();
    assert.match(sitemapText, /<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    const locations = Array.from(sitemapText.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g), match => match[1].trim());
    assert.deepEqual(locations, ["https://ermif.com/"]);
    assert.doesNotMatch(sitemapText, /<!doctype html|<html/i);
    const notFoundDocument = await fetch(base + "/404.html");
    assert.equal(notFoundDocument.status, 200);
    assert.match(notFoundDocument.headers.get("Content-Type"), /^text\/html\b/);
    assert.match(await notFoundDocument.text(), /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/);
    for (const missing of ["/pagina-inexistente", "/robots-inexistente.txt", "/sitemap-inexistente.xml"]) {
      assert.equal((await fetch(base + missing, { headers: { "Sec-Fetch-Mode": "navigate", Accept: "text/html" } })).status, 404, missing);
    }
    for (const [file, type] of [["summary.css", "text/css"], ["summary-icons.svg", "image/svg+xml"]]) {
      const response = await fetch(base + "/assets/" + file);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("content-type").startsWith(type));
    }
    assert.equal((await fetch(base + "/assets/private.json")).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
