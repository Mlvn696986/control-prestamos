import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
test("modo local bloquea toda la API antes de consultar servicios externos", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Red no permitida"); };
  try {
    for (const [route, method] of [["/api/billing/checkout","POST"], ["/api/reclamaciones","POST"], ["/api/admin/legal","GET"], ["/api/privacidad/solicitudes","POST"]]) {
      const response = await worker.fetch(new Request("http://localhost:8787" + route, { method }), { ENVIRONMENT: "local" });
      assert.equal(response.status, 503);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test("modo local sigue sirviendo archivos estaticos", async () => {
  const response = await worker.fetch(new Request("http://localhost:8787/"), { ENVIRONMENT:"local", ASSETS: { fetch: async () => new Response("demo") } });
  assert.equal(await response.text(), "demo");
});
test("webhook sin secretos no ejecuta peticiones de red", async () => {
  const response = await worker.fetch(new Request("https://example.invalid/api/billing/mercadopago/webhook", {method:"POST",body:"{}"}), {});
  assert.equal(response.status, 503);
});
