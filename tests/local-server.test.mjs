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
    assert.equal((await fetch(base + "/")).status, 200);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
