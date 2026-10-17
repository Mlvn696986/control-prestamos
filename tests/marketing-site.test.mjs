import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { renderPages } = require("../marketing/site.cjs");
const { optimizePublicAsset } = require("../scripts/public-assets.cjs");
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const appHtml = read("index.html");
const appJs = read("app.js");
const landingJs = optimizePublicAsset("landing.js", read("public/landing.js"));
const pages = renderPages(appHtml);
const origin = "https://ermif.com";
const expectedRoutes = {
  "index.html": "/",
  "precios/index.html": "/precios/",
  "como-funciona/index.html": "/como-funciona/",
  "contacto/index.html": "/contacto/",
  "privacidad/index.html": "/privacidad/",
  "terminos/index.html": "/terminos/",
};

function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/\b([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3];
  }
  return result;
}

function tagAttributes(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>`, "gi"))]
    .map((match) => attrs(match[0]));
}

function plain(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(text) {
  return plain(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

test("marketing publishes exactly the six intended public documents with distinct metadata and complete static content", () => {
  assert.deepEqual(Object.keys(pages).sort(), Object.keys(expectedRoutes).sort());
  const titles = new Set();
  const descriptions = new Set();
  for (const [file, pathname] of Object.entries(expectedRoutes)) {
    const html = pages[file];
    assert.match(html, /^<!doctype html>/i, file);
    assert.match(html, /<html lang="es">/, file);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    assert.ok(title?.includes("ERMIF"), `${file}: title identifies the product`);
    assert.ok(!titles.has(title), `${file}: title must be unique`);
    titles.add(title);
    const meta = tagAttributes(html, "meta");
    const description = meta.filter((tag) => tag.name === "description");
    assert.equal(description.length, 1, file);
    assert.ok(description[0].content.length > 40, `${file}: useful description`);
    assert.ok(!descriptions.has(description[0].content), `${file}: unique description`);
    descriptions.add(description[0].content);
    assert.deepEqual(tagAttributes(html, "link").filter((tag) => tag.rel === "canonical"), [
      { rel: "canonical", href: origin + pathname },
    ], `${file}: canonical points to this document`);
    assert.equal(meta.find((tag) => tag.property === "og:url")?.content, origin + pathname);
    assert.equal(meta.find((tag) => tag.property === "og:title")?.content, title);
    assert.equal(meta.find((tag) => tag.property === "og:description")?.content, description[0].content);
    assert.match(meta.find((tag) => tag.property === "og:image")?.content || "", /^https:\/\/ermif\.com\/.+/);
    assert.equal(meta.find((tag) => tag.name === "twitter:card")?.content, "summary_large_image");
    assert.ok(!meta.some((tag) => /robots/i.test(tag.name || "") && /noindex/i.test(tag.content || "")), file);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one visible main heading`);
    const main = html.match(/<main id="contenido">([\s\S]+?)<\/main>/)?.[1];
    assert.ok(main && plain(main).length > 300, `${file}: useful content exists without JavaScript`);
    assert.match(html, /ERMIF no otorga préstamos/, `${file}: product is not advertised as a lender`);
  }
});

test("marketing prices, plan names and client limits agree with the application's live plan catalog", () => {
  const catalogSource = appJs.match(/const PLAN_CATALOG = (\{[\s\S]*?\n\});/)?.[1];
  assert.ok(catalogSource, "PLAN_CATALOG must be available for comparison");
  const catalog = vm.runInNewContext(`(${catalogSource})`, Object.create(null), { timeout: 1000 });
  for (const file of ["index.html", "precios/index.html"]) {
    const cards = [...pages[file].matchAll(/<article class="price-card [^"]*">([\s\S]*?)<\/article>/g)].map((match) => match[1]);
    assert.equal(cards.length, Object.keys(catalog).length, `${file}: every plan is represented`);
    for (const plan of Object.values(catalog)) {
      const card = cards.find((html) => normalize(html.match(/<h3>([^<]+)<\/h3>/)?.[1] || "") === normalize(plan.label));
      assert.ok(card, `${file}: ${plan.label} is present`);
      const price = plain(card.match(/<p class="price">([\s\S]*?)<\/p>/)?.[1] || "");
      const actualAmount = Number(price.match(/S\/\s*([\d.]+)/)?.[1]);
      const expectedAmount = Number(plan.price.replace(/[^\d.]/g, ""));
      assert.equal(actualAmount, expectedAmount, `${file}: ${plan.label} price`);
      assert.match(price, expectedAmount ? /\/ mes/ : /sin costo/, `${file}: ${plan.label} billing interval`);
      const capacity = normalize(card.match(/<p class="capacity">([\s\S]*?)<\/p>/)?.[1] || "");
      assert.equal(capacity, plan.clientLimit === null ? "clientes ilimitados" : `hasta ${plan.clientLimit} clientes`);
      const benefits = normalize(card.match(/<ul class="check-list">([\s\S]*?)<\/ul>/)?.[1] || "");
      for (const benefit of [/prestamos y ampliaciones/, /cobros e historial/, /resumen.*cartera/, /exportacion.*excel.*respaldo/]) {
        assert.match(benefits, benefit, `${file}: ${plan.label} shared functionality`);
      }
      assert.match(card, /href="\/app\/\?mode=signup"/, `${file}: plan action opens account creation`);
    }
    assert.match(pages[file], /Pro está sujeto a uso razonable/, `${file}: unlimited plan retains its qualification`);
  }
});

test("every internal public link and fragment resolves to a rendered page, real anchor or supported application entry", () => {
  const byPath = new Map(Object.entries(expectedRoutes).map(([file, pathname]) => [pathname, pages[file]]));
  for (const [file, pathname] of Object.entries(expectedRoutes)) {
    const html = pages[file];
    const allIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(allIds).size, allIds.length, `${file}: no duplicate fragment IDs`);
    for (const anchor of tagAttributes(html, "a")) {
      assert.ok(anchor.href, `${file}: links need a destination`);
      const url = new URL(anchor.href.replace(/&amp;/g, "&"), origin + pathname);
      if (url.origin !== origin) {
        assert.ok(url.protocol === "mailto:" || url.protocol === "https:", `${file}: safe external link scheme`);
        continue;
      }
      if (url.pathname === "/app/") {
        assert.ok(
          ["signup", "login"].includes(url.searchParams.get("mode")) ||
          ["claims", "privacy-request"].includes(url.searchParams.get("dialog")),
          `${file}: supported application action ${anchor.href}`,
        );
        continue;
      }
      if (url.pathname === '/dashboard-preview-2560.webp') {
        assert.ok(fs.existsSync(new URL('../public' + url.pathname, import.meta.url)), file + ': enlarged preview exists');
        assert.equal(anchor.target, '_blank');
        assert.equal(anchor.rel, 'noopener');
        assert.match(anchor['aria-label'], /otra pestaña/);
        continue;
      }
      assert.ok(byPath.has(url.pathname), `${file}: missing page ${anchor.href}`);
      if (url.hash) {
        const targetIds = [...byPath.get(url.pathname).matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
        assert.ok(targetIds.includes(decodeURIComponent(url.hash.slice(1))), `${file}: missing anchor ${anchor.href}`);
      }
    }
  }
});

test("marketing pages do not load the application, Supabase authentication or private dashboard markup", () => {
  for (const [file, html] of Object.entries(pages)) {
    const scripts = tagAttributes(html, "script");
    assert.deepEqual(scripts.filter((script) => script.src).map((script) => script.src), ["/landing.js", "/acquisition.js"], file);
    assert.ok(scripts.filter((script) => !script.src).every((script) => script.type === "application/ld+json"), file);
    assert.doesNotMatch(html, /\bid="(?:authScreen|authForm|appShell|clientsView|adminView)"/, file);
    assert.doesNotMatch(html, /<link\b[^>]+href="\/(?:styles\.css|assets\/summary\.css)"/, file);
    const dataBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.equal(dataBlocks.length, 1, file);
    const data = JSON.parse(dataBlocks[0][1]);
    assert.equal(data["@context"], "https://schema.org");
    assert.ok(data["@graph"].some((entry) => entry["@type"] === "Organization" && entry.name === "ERMIF"));
    assert.ok(!JSON.stringify(data).includes("aggregateRating"), `${file}: no fabricated review data`);
  }
});

function runLanding({ pathname = "/", search = "", hash = "" }) {
  const redirects = [];
  let documentQueries = 0;
  const context = {
    URLSearchParams,
    location: { pathname, search, hash, replace: (value) => redirects.push(value) },
    document: { querySelector: () => { documentQueries++; return null; } },
  };
  vm.runInNewContext(landingJs, context, { timeout: 1000, filename: "public/landing.js" });
  return { redirects, documentQueries };
}

test("legacy authentication hash callbacks reach the same-origin app with query and fragment preserved byte for byte", () => {
  const search = "?utm_source=correo&next=https%3A%2F%2Fexample.invalid%2F%3Fa%3Db";
  const hashes = [
    "#access_token=fixture%2B%2F%3D&refresh_token=fixture&type=signup",
    "#refresh_token=fixture%26token",
    "#error=access_denied&error_description=fixture%20message",
    "#error_code=otp_expired",
    "#error_description=fixture%2Bmessage",
    "#type=recovery",
  ];
  for (const pathname of ["/", "/index.html"]) {
    for (const hash of hashes) {
      const result = runLanding({ pathname, search, hash });
      assert.deepEqual(result.redirects, ["/app/" + search + hash], `${pathname}${hash}`);
      assert.equal(result.documentQueries, 0, "callback forwarding precedes menu initialization");
      assert.equal(new URL(result.redirects[0], origin).origin, origin, "callback does not follow next parameters off-origin");
    }
  }
});

test("ordinary anchors, query campaigns and unrelated hash keys remain on the public landing", () => {
  for (const hash of ["", "#funciones", "#planes", "#preguntas", "#contenido", "#demostracion", "#type=signup", "#type=not-recovery", "#not_access_token=fixture", "#note=access_token%3Dfixture", "#next=https://example.invalid/#access_token=fixture"]) {
    const result = runLanding({ search: "?utm_source=facebook&code=not-handled-in-client", hash });
    assert.deepEqual(result.redirects, [], hash);
    assert.equal(result.documentQueries, 2, "ordinary page continues menu initialization");
  }
});

test("callback forwarding is limited to legacy root entries and never loops inside the app", () => {
  for (const pathname of ["/app/", "/precios/", "/como-funciona/", "/contacto/", "/privacidad/", "/terminos/", "/other/index.html"]) {
    const result = runLanding({ pathname, search: "?state=fixture", hash: "#access_token=fixture&type=recovery" });
    assert.deepEqual(result.redirects, [], pathname);
  }
});

test("public resources stay within a download budget and defer scripts outside the application", () => {
  const { gzipSync } = require('node:zlib');
  for (const [file, html] of Object.entries(pages)) {
    const scripts = tagAttributes(html, 'script').filter(tag => tag.src);
    for (const script of scripts) assert.match(html, new RegExp('<script src="' + script.src.replaceAll('.', '\\.') + '" defer>'), file);
    const styles = tagAttributes(html, 'link').filter(tag => tag.rel === 'stylesheet');
    assert.deepEqual(styles.map(tag => tag.href), ['/landing.css', '/acquisition.css'], file);
    const code = [...scripts.map(tag => tag.src), ...styles.map(tag => tag.href)].map(url => {
      const name = url.slice(1);
      return optimizePublicAsset(name, read('public/' + name));
    });
    assert.ok(code.reduce((sum, text) => sum + gzipSync(text).length, 0) <= 13 * 1024, file + ': public JS/CSS gzip budget');
    const imageUrls = new Set(tagAttributes(html, 'img').map(tag => tag.src));
    for (const link of tagAttributes(html, 'link').filter(tag => tag.rel === 'icon')) imageUrls.add(link.href);
    let rawBytes = Buffer.byteLength(html) + code.reduce((sum, text) => sum + Buffer.byteLength(text), 0);
    for (const url of imageUrls) {
      assert.ok(url.startsWith('/') && !url.startsWith('/assets/'), file + ': use optimized public images');
      rawBytes += fs.statSync(new URL('../public' + url, import.meta.url)).size;
    }
    // Conservative: count the 1280px fallback. High-density candidates have separate budgets below.
    assert.ok(rawBytes <= 220 * 1024, file + ': HTML + scripts + styles + image budget');
  }
});

test("images reserve their layout, use valid responsive candidates and stay lightweight", async () => {
  const sharp = require('sharp');
  const assets = new Map();
  for (const [file, html] of Object.entries({ ...pages, 'app/index.html': appHtml })) {
    for (const img of tagAttributes(html, 'img')) {
      assert.ok(Number(img.width) > 0 && Number(img.height) > 0, file + ': image reserves dimensions');
      const source = img.src.startsWith('/assets/') ? '..' + img.src : '../public' + img.src;
      assert.ok(fs.existsSync(new URL(source, import.meta.url)), file + ': image exists');
      if (!img.srcset) continue;
      assert.ok(img.sizes, file + ': responsive images declare displayed size');
      for (const candidate of img.srcset.split(',')) {
        const match = candidate.trim().match(/^(\/[\w.-]+) (\d+)w$/);
        assert.ok(match, candidate);
        assets.set(match[1], Number(match[2]));
      }
    }
  }
  for (const [url, width] of assets) {
    const image = new URL('../public' + url, import.meta.url);
    assert.equal((await sharp(fs.readFileSync(image)).metadata()).width, width, url + ': srcset describes real pixel width');
    const budget = url.includes('dashboard-preview') ? (width <= 1280 ? 120 : width <= 1920 ? 220 : 320) : 80;
    assert.ok(fs.statSync(image).size <= budget * 1024, url + ': image budget');
  }
  assert.ok(fs.statSync(new URL('../public/ermif-mark-small.png', import.meta.url)).size <= 12 * 1024);
  const hero = tagAttributes(pages['index.html'], 'img').find(img => img.src.includes('dashboard-preview'));
  const demo = tagAttributes(pages['como-funciona/index.html'], 'img').find(img => img.src.includes('dashboard-preview'));
  assert.equal(hero.srcset, demo.srcset, 'both previews use the fresh high-resolution capture');
  assert.ok(assets.get('/dashboard-preview-2560.webp') >= 2 * 1122, 'sufficient pixels for the largest preview at 2x density');
  assert.ok(!hero.srcset.includes('-480.') && !hero.srcset.includes('-800.'), 'avoid undersized thumbnails for small UI labels');
  assert.equal(hero.fetchpriority, 'high');
  assert.notEqual(hero.loading, 'lazy', 'do not delay the main visual');
  assert.equal(demo.loading, 'lazy', 'defer the lower-page demonstration');
});
