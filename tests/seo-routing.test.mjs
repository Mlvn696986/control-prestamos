import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

function assetsEnv(onRequest = () => new Response("asset", { headers: { "Content-Type": "text/html; charset=utf-8" } })) {
  return { ASSETS: { fetch: onRequest } };
}

function forbiddenAssets() {
  return assetsEnv(() => { throw new Error("Esta ruta no debe consultar archivos estaticos."); });
}

test("www redirige navegacion GET y HEAD al dominio principal sin perder ruta ni parametros", async () => {
  for (const method of ["GET", "HEAD"]) {
    for (const suffix of ["/", "/?billing=return", "/?code=fixture&next=%2F", "/robots.txt", "/seguridad/?origen=web", "/assets/summary.css?v=2", "/ruta-inexistente?origen=prueba"]) {
      const response = await worker.fetch(new Request("https://www.ermif.com" + suffix, { method }), forbiddenAssets());
      assert.equal(response.status, 301, method + " " + suffix);
      assert.equal(response.headers.get("Location"), "https://ermif.com" + suffix);
      assert.equal(await response.text(), "");
    }
  }
});

test("la portada conserva visitas normales y las paginas comerciales", async () => {
  for (const suffix of ["/", "/?utm_source=facebook", "/precios/", "/como-funciona/", "/contacto/", "/privacidad/", "/terminos/", "/seguridad/"]) {
    let calls = 0;
    const request = new Request("https://ermif.com" + suffix);
    const response = await worker.fetch(request, assetsEnv((forwarded) => {
      calls++;
      assert.equal(forwarded.url, request.url);
      return new Response("portada", { headers: { "Content-Type": "text/html" } });
    }));
    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("X-Robots-Tag"), null);
  }
});

test("callbacks anteriores de acceso y pago llegan a app sin perder parametros", async () => {
  for (const method of ["GET", "HEAD"]) {
    for (const entry of ["/", "/index.html"]) {
      for (const query of ["?billing=return", "?code=fixture&state=prueba&next=https%3A%2F%2Fexample.invalid", "?error_code=otp_expired&error_description=fixture", "?error=access_denied"]) {
        const response = await worker.fetch(new Request("https://ermif.com" + entry + query, { method }), forbiddenAssets());
        assert.equal(response.status, 302);
        assert.equal(response.headers.get("Location"), "https://ermif.com/app/" + query);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
      }
    }
  }
});

test("app conserva callbacks sin bucles y se excluye del indice", async () => {
  for (const suffix of ["/app/", "/app/?mode=signup", "/app/?billing=return", "/app/?code=fixture"]) {
    const request = new Request("https://ermif.com" + suffix);
    const response = await worker.fetch(request, assetsEnv((forwarded) => {
      assert.equal(forwarded.url, request.url);
      return new Response("aplicacion");
    }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(await response.text(), "aplicacion");
  }
});

test("la consolidacion solo afecta al hostname www exacto y conserva la demo local", async () => {
  for (const origin of ["http://127.0.0.1:8787", "http://localhost:8787", "https://preview.example.invalid", "https://www.ermif.com.example.invalid"]) {
    const request = new Request(origin + "/");
    const env = assetsEnv((forwarded) => {
      assert.equal(forwarded.url, request.url);
      return new Response("demo");
    });
    env.ENVIRONMENT = "local";
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200, origin);
    assert.equal(response.headers.get("Location"), null);
    assert.equal(await response.text(), "demo");
  }
});

test("los errores 404 de ASSETS conservan su estado y contenido incluso en navegacion", async () => {
  for (const headers of [{}, { "Sec-Fetch-Mode": "navigate", Accept: "text/html" }]) {
    const response = await worker.fetch(new Request("https://ermif.com/pagina-inexistente", { headers }), assetsEnv(() =>
      new Response("pagina no encontrada", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" } })
    ));
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("Content-Type"), "text/html; charset=utf-8");
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.equal(await response.text(), "pagina no encontrada");
  }
});

test("las peticiones API en www no redirigen ni ejecutan servicios externos", async () => {
  const originalFetch = globalThis.fetch;
  let externalCalls = 0;
  globalThis.fetch = async () => { externalCalls++; throw new Error("No se permiten servicios externos en esta prueba."); };
  try {
    const cases = [
      ["/api/billing/checkout", "OPTIONS", 204],
      ["/api/billing/mercadopago/webhook", "POST", 503],
      ["/api/ruta-inexistente", "POST", 404],
      ["/api/ruta-inexistente", "GET", 404],
    ];
    for (const [path, method, status] of cases) {
      const request = new Request("https://www.ermif.com" + path, { method, ...(method === "POST" ? { body: "{}", headers: { "Content-Type": "application/json" } } : {}) });
      const response = await worker.fetch(request, forbiddenAssets());
      assert.equal(response.status, status, method + " " + path);
      assert.equal(response.headers.get("Location"), null);
    }
    assert.equal(externalCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
