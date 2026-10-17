import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../src/worker.js";
import { verifiedPaymentEvidence, captureAcquisitionPayment, isAcquisitionPurgeTime } from "../src/acquisition.js";

const ORIGIN = "https://ermif.com";
const USER = "11111111-1111-4111-8111-111111111111";
const VISITOR = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const ENV = { SUPABASE_URL: "https://database.example.invalid", SUPABASE_PUBLISHABLE_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-service", MERCADOPAGO_ACCESS_TOKEN: "test-provider", MERCADOPAGO_WEBHOOK_SECRET: "test-webhook", ACQUISITION_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const visit = { visitor_id: VISITOR, consent: true, consent_version: "2026-10-16", landing_path: "/precios/", source: "google", medium: "organic", campaign_id: "" };
function post(path, body, headers = {}) {
  return new Request(ORIGIN + path, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
async function withFetch(handler, run) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { await run(); } finally { globalThis.fetch = original; }
}

test("visita consentida guarda solo categorias permitidas y conserva su ID opaco", async () => {
  let calls = 0; let rateKey;
  await withFetch(async (input, options) => {
    calls++;
    assert.equal(new URL(input).pathname, "/rest/v1/rpc/acquisition_visit_create_v2");
    assert.deepEqual(JSON.parse(options.body), { p_visitor_id: VISITOR, p_landing_path: "/precios/", p_source: "google", p_medium: "organic", p_campaign_id: "", p_consent_version: "2026-10-16", p_content_id: "" });
    return json({ visitor_id: VISITOR, expires_at: "2027-04-01T00:00:00Z" });
  }, async () => {
    const env = { ...ENV, ACQUISITION_RATE_LIMITER: { limit: async ({ key }) => { rateKey = key; return { success: true }; } } };
    const response = await worker.fetch(post("/api/acquisition/visit", visit, { "CF-Connecting-IP": "192.0.2.4" }), env);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal((await response.json()).visitor_id, VISITOR);
    assert.equal(calls, 1);
    assert.match(rateKey, /^acquisition:[0-9a-f]{64}$/);
    assert.ok(!rateKey.includes("192.0.2.4"));
  });
});

test("reintentos preservan ID y una visita revocada no se presenta como creada", async () => {
  let attempts = 0;
  await withFetch(async (input, options) => {
    assert.equal(new URL(input).pathname, "/rest/v1/rpc/acquisition_visit_create_v2");
    assert.equal(JSON.parse(options.body).p_visitor_id, VISITOR);
    attempts++;
    return json(attempts < 3 ? { visitor_id: VISITOR, expires_at: "2027-04-01T00:00:00Z" } : { revoked: true });
  }, async () => {
    for (let i = 0; i < 2; i++) {
      const response = await worker.fetch(post("/api/acquisition/visit", visit), ENV);
      assert.equal(response.status, 201);
      assert.equal((await response.json()).visitor_id, VISITOR);
    }
    const response = await worker.fetch(post("/api/acquisition/visit", visit), ENV);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { revoked: true });
    assert.equal(attempts, 3);
  });
});

test("sin consentimiento o con datos personales/campos inesperados no se guarda nada", async () => {
  await withFetch(async () => { throw new Error("No debe persistir"); }, async () => {
    const invalid = [{ ...visit, consent: false }, { ...visit, consent: "true" }, { ...visit, consent_version: "old" }, { ...visit, email: "fixture@example.invalid" }, { ...visit, visitor_id: undefined }, { ...visit, visitor_id: "11111111-1111-1111-8111-111111111111" }, { ...visit, visitor_id: "persona@example.invalid" }, { ...visit, source: "persona@example.invalid" }, { ...visit, campaign_id: "persona-987654321" }, { ...visit, landing_path: "/app/?code=fixture" }, { ...visit, landing_path: "/api/billing/checkout" }, { ...visit, referrer: "https://example.invalid/?email=fixture" }, { ...visit, event: "purchase" }];
    for (const body of invalid) assert.equal((await worker.fetch(post("/api/acquisition/visit", body), ENV)).status, 400);
  });
});

test("rechaza origen ajeno/ausente, preflight externo, cuerpo grande incluso sin Content-Length y JSON invalido", async () => {
  await withFetch(async () => { throw new Error("Sin red externa"); }, async () => {
    for (const origin of ["https://example.invalid", "null", ""]) assert.equal((await worker.fetch(post("/api/acquisition/visit", visit, { Origin: origin }), ENV)).status, 403);
    assert.equal((await worker.fetch(new Request(ORIGIN + "/api/acquisition/visit", { method: "OPTIONS", headers: { Origin: "https://example.invalid" } }), ENV)).status, 403);
    assert.equal((await worker.fetch(post("/api/acquisition/visit", " ".repeat(1025)), ENV)).status, 413);
    assert.equal((await worker.fetch(post("/api/acquisition/visit", JSON.stringify(visit), { "Content-Length": "9999" }), ENV)).status, 413);
    assert.equal((await worker.fetch(post("/api/acquisition/visit", "{"), ENV)).status, 400);
    assert.equal((await worker.fetch(post("/api/acquisition/visit", visit, { "Content-Type": "text/plain" }), ENV)).status, 415);
    assert.equal((await worker.fetch(post("/api/acquisition/visit?email=fixture", visit), ENV)).status, 400);
  });
});

test("rate limiter bloquea visita y revocacion; no se publica un colector sin limite", async () => {
  await withFetch(async () => { throw new Error("Sin red externa"); }, async () => {
    const limited = { ...ENV, ACQUISITION_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    assert.equal((await worker.fetch(post("/api/acquisition/visit", visit), limited)).status, 429);
    assert.equal((await worker.fetch(post("/api/acquisition/revoke", { visitor_id: VISITOR }), limited)).status, 429);
    assert.equal((await worker.fetch(post("/api/acquisition/visit", visit), { ...ENV, ACQUISITION_RATE_LIMITER: undefined })).status, 503);
  });
});

test("identificacion usa identidad autenticada de servidor y nunca user_id del navegador", async () => {
  let writes = 0;
  await withFetch(async (input, options) => {
    const path = new URL(input).pathname;
    if (path === "/auth/v1/user") return json({ id: USER, email_confirmed_at: "2026-10-16T12:00:00Z" });
    assert.equal(path, "/rest/v1/rpc/acquisition_identify_v2"); writes++;
    assert.deepEqual(JSON.parse(options.body), { p_visitor_id: VISITOR, p_user_id: USER });
    return json({ linked: true });
  }, async () => {
    assert.equal((await worker.fetch(post("/api/acquisition/identify", { visitor_id: VISITOR }), ENV)).status, 401);
    assert.equal((await worker.fetch(post("/api/acquisition/identify", { visitor_id: VISITOR, user_id: USER }, { Authorization: "Bearer fixture" }), ENV)).status, 400);
    const response = await worker.fetch(post("/api/acquisition/identify", { visitor_id: VISITOR }, { Authorization: "Bearer fixture" }), ENV);
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { linked: true }); assert.equal(writes, 1);
  });
});

test("revocacion requiere ID opaco valido y los errores internos no exponen datos", async () => {
  let calls = 0;
  await withFetch(async (input, options) => {
    calls++; assert.equal(new URL(input).pathname, "/rest/v1/rpc/acquisition_revoke");
    assert.deepEqual(JSON.parse(options.body), { p_visitor_id: VISITOR });
    return json(null);
  }, async () => {
    assert.equal((await worker.fetch(post("/api/acquisition/revoke", { visitor_id: "example@example.invalid" }), ENV)).status, 400);
    const response = await worker.fetch(post("/api/acquisition/revoke", { visitor_id: VISITOR }), ENV);
    assert.deepEqual(await response.json(), { revoked: true }); assert.equal(calls, 1);
  });
  await withFetch(async () => json({ message: "private row example@example.invalid" }, 500), async () => {
    const response = await worker.fetch(post("/api/acquisition/visit", visit), ENV);
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /example@|private row/);
  });
});

test("informe solo para administrador, periodo permitido y agregado recibido de RPC", async () => {
  let admin = false; let reportCalls = 0;
  await withFetch(async (input, options) => {
    const url = new URL(input);
    if (url.pathname === "/auth/v1/user") return json({ id: USER });
    if (url.pathname === "/rest/v1/profiles") return json([{ id: USER, is_admin: admin }]);
    assert.equal(url.pathname, "/rest/v1/rpc/acquisition_report");
    assert.deepEqual(JSON.parse(options.body), { p_days: 90 }); reportCalls++;
    return json({ totals: { visitors: 4, registrations: 2, activated: 1, first_payments: 1 }, rows: [] });
  }, async () => {
    const request = () => new Request(ORIGIN + "/api/admin/acquisition?days=90", { headers: { Authorization: "Bearer fixture" } });
    assert.equal((await worker.fetch(request(), ENV)).status, 403); assert.equal(reportCalls, 0);
    admin = true;
    const response = await worker.fetch(request(), ENV); assert.equal(response.status, 200); assert.equal((await response.json()).totals.first_payments, 1);
    for (const query of ["days=1", "days=30&days=90", "days=30&user_id=" + USER]) assert.equal((await worker.fetch(new Request(ORIGIN + "/api/admin/acquisition?" + query, { headers: { Authorization: "Bearer fixture" } }), ENV)).status, 400);
  });
});

const validPayment = () => ({ id: 9001, status: "approved", live_mode: true, transaction_amount: 29, currency_id: "PEN", date_approved: "2026-10-16T12:00:00-05:00", external_reference: REQUEST, metadata: { preapproval_id: "subscription-1" } });
function signedWebhook(topic, id) {
  const ts = "1790000000", requestId = "test-request";
  const signature = createHmac("sha256", ENV.MERCADOPAGO_WEBHOOK_SECRET).update("id:" + id + ";request-id:" + requestId + ";ts:" + ts + ";").digest("hex");
  return new Request(ORIGIN + "/api/billing/mercadopago/webhook?type=" + topic + "&data.id=" + id, { method: "POST", headers: { "Content-Type": "application/json", "x-signature": "ts=" + ts + ",v1=" + signature, "x-request-id": requestId }, body: JSON.stringify({ type: topic, data: { id } }) });
}
function paymentFixture({ payment = validPayment(), invoiceStatus = "processed", noPaymentId = false, failedRecords = 0 } = {}) {
  const captured = [], operations = [];
  let request = { id: REQUEST, user_id: USER, requested_plan: "basic", status: "pending", provider: "mercadopago", provider_subscription_id: "subscription-1" };
  let subscription = { user_id: USER, provider: "mercadopago", provider_subscription_id: "subscription-1", status: "active", plan: "basic", client_limit: 50 };
  return { captured, operations, async fetch(input, options = {}) {
    const url = new URL(input); operations.push(url.pathname);
    if (url.hostname === "api.mercadopago.com") {
      if (url.pathname === "/v1/payments/9001") return json(payment);
      if (url.pathname === "/authorized_payments/8001") return json({ id: 8001, status: invoiceStatus, preapproval_id: "subscription-1", external_reference: REQUEST, payment: noPaymentId ? {} : { id: 9001, status: payment.status } });
      if (url.pathname === "/preapproval/subscription-1") return json({ id: "subscription-1", status: "authorized", external_reference: REQUEST });
      throw new Error("Unexpected provider route " + url.pathname);
    }
    if (url.pathname === "/rest/v1/plan_requests") {
      if (options.method === "PATCH") request = { ...request, ...JSON.parse(options.body) };
      return json([request]);
    }
    if (url.pathname === "/rest/v1/subscriptions") {
      if (options.method === "POST") subscription = { ...subscription, ...JSON.parse(options.body) };
      return json([subscription]);
    }
    if (url.pathname === "/rest/v1/rpc/acquisition_record_payment") {
      if (failedRecords-- > 0) return json({ message: "sensitive SQL diagnostic" }, 500);
      captured.push(JSON.parse(options.body)); return json({ recorded: true });
    }
    throw new Error("Unexpected database route " + url.pathname);
  } };
}

test("dos topics y reintentos usan el mismo pago real y fecha, nunca ID de factura", async () => {
  const fixture = paymentFixture();
  await withFetch(fixture.fetch, async () => {
    for (const [topic, id] of [["payment", "9001"], ["subscription_authorized_payment", "8001"], ["payment", "9001"]]) {
      assert.equal((await worker.fetch(signedWebhook(topic, id), ENV)).status, 200);
    }
    assert.equal(fixture.captured.length, 3);
    for (const evidence of fixture.captured) assert.deepEqual(evidence, { p_user_id: USER, p_payment_id: "9001", p_paid_at: "2026-10-16T17:00:00.000Z", p_plan: "basic" });
    assert.equal(fixture.operations.filter((route) => route === "/v1/payments/9001").length, 3);
  });
});

test("fallo de persistencia despues de la operacion financiera devuelve500 y permite retry", async () => {
  const fixture = paymentFixture({ failedRecords: 1 });
  await withFetch(fixture.fetch, async () => {
    const failed = await worker.fetch(signedWebhook("payment", "9001"), ENV);
    assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /sensitive|SQL/);
    assert.ok(fixture.operations.includes("/rest/v1/subscriptions"));
    assert.equal((await worker.fetch(signedWebhook("payment", "9001"), ENV)).status, 200);
    assert.equal(fixture.captured.length, 1);
  });
});

test("autorizacion de suscripcion, factura sin pago, pago pendiente/test o moneda ajena no crean conversion", async () => {
  for (const scenario of ["preapproval", "invoice", "pending", "test", "currency", "zero", "missing_date"]) {
    const payment = validPayment();
    if (scenario === "pending") payment.status = "pending";
    if (scenario === "test") payment.live_mode = false;
    if (scenario === "currency") payment.currency_id = "USD";
    if (scenario === "zero") payment.transaction_amount = 0;
    if (scenario === "missing_date") delete payment.date_approved;
    const fixture = paymentFixture({ payment, noPaymentId: scenario === "invoice", invoiceStatus: "authorized" });
    await withFetch(fixture.fetch, async () => {
      const topic = scenario === "preapproval" ? "subscription_preapproval" : scenario === "invoice" ? "subscription_authorized_payment" : "payment";
      const id = scenario === "preapproval" ? "subscription-1" : scenario === "invoice" ? "8001" : "9001";
      assert.equal((await worker.fetch(signedWebhook(topic, id), ENV)).status, 200, scenario);
      assert.equal(fixture.captured.length, 0, scenario);
    });
  }
});

test("estado factura no sustituye verificacion del pago aprobado", async () => {
  const fixture = paymentFixture({ invoiceStatus: "scheduled" });
  await withFetch(fixture.fetch, async () => {
    assert.equal((await worker.fetch(signedWebhook("subscription_authorized_payment", "8001"), ENV)).status, 200);
    assert.equal(fixture.captured.length, 1);
    assert.ok(fixture.operations.includes("/v1/payments/9001"));
  });
});

test("webhook falsificado no hace llamadas externas ni registra conversion", async () => {
  await withFetch(async () => { throw new Error("Sin red"); }, async () => {
    const response = await worker.fetch(post("/api/billing/mercadopago/webhook", { type: "payment", data: { id: 9001 } }), ENV);
    assert.equal(response.status, 401);
  });
});

test("referencias contradictorias de pago, factura o suscripcion nunca atribuyen una cuenta", async () => {
  const reference = { requestId: REQUEST, preapprovalId: "subscription-1" };
  const otherId = "44444444-4444-4444-8444-444444444444";
  const goodRequest = { id: REQUEST, user_id: USER, requested_plan: "basic", provider: "mercadopago", provider_subscription_id: "subscription-1" };
  const scenarios = [
    { payment: { ...validPayment(), external_reference: otherId }, lookup: false },
    { payment: { ...validPayment(), external_reference: "invalid-reference" }, reference: { ...reference, requestId: "invalid-reference" }, lookup: false },
    { payment: { ...validPayment(), preapproval_id: "subscription-2" }, lookup: false },
    { payment: validPayment(), reference: { ...reference, preapprovalId: "subscription-2" }, lookup: false },
    { payment: validPayment(), request: { ...goodRequest, id: otherId }, lookup: true },
    { payment: validPayment(), request: { ...goodRequest, provider_subscription_id: "subscription-2" }, lookup: true },
    { payment: { ...validPayment(), external_reference: "", metadata: {} }, reference: {}, lookup: false },
  ];
  for (const scenario of scenarios) {
    let lookedUp = false;
    assert.equal(await captureAcquisitionPayment(scenario.payment, scenario.reference || reference, {
      findRequest: async () => { lookedUp = true; return scenario.request || goodRequest; },
      rpc: async () => { assert.fail("No debe guardar evidencia para una asociacion contradictoria"); },
    }), false);
    assert.equal(lookedUp, scenario.lookup);
  }
});

test("pago sin referencia de solicitud conserva asociacion por suscripcion verificada", async () => {
  let captured = 0;
  assert.equal(await captureAcquisitionPayment({ ...validPayment(), external_reference: "" }, { preapprovalId: "subscription-1" }, {
    findRequest: async (input) => {
      assert.deepEqual(input, { requestId: "", preapprovalId: "subscription-1" });
      return { id: REQUEST, user_id: USER, requested_plan: "pro", provider: "mercadopago", provider_subscription_id: "subscription-1" };
    },
    rpc: async (name, body) => {
      captured++;
      assert.equal(name, "acquisition_record_payment");
      assert.equal(body.p_user_id, USER);
      assert.equal(body.p_plan, "pro");
    },
  }), true);
  assert.equal(captured, 1);
});

test("evidencia de pago exige aprobacion real y usa solo campos minimos", () => {
  assert.deepEqual(verifiedPaymentEvidence(validPayment()), { paymentId: "9001", paidAt: "2026-10-16T17:00:00.000Z" });
  assert.equal(verifiedPaymentEvidence({ ...validPayment(), status: "authorized" }), null);
  assert.equal(verifiedPaymentEvidence({ ...validPayment(), id: "invoice@example.invalid" }), null);
  assert.equal(verifiedPaymentEvidence({ ...validPayment(), date_approved: "invalid" }), null);
});

test("purga diaria a medianoche de Peru no impide despachar correos", async () => {
  assert.equal(isAcquisitionPurgeTime(Date.parse("2026-10-17T05:00:00Z")), true);
  assert.equal(isAcquisitionPurgeTime(Date.parse("2026-10-17T05:05:00Z")), false);
  let purges = 0, emailChecks = 0;
  await withFetch(async (input) => {
    const route = new URL(input).pathname;
    if (route === "/rest/v1/rpc/acquisition_purge") { purges++; return json({ message: "private diagnostic" }, 500); }
    assert.equal(route, "/rest/v1/rpc/email_claim_next"); emailChecks++; return json([]);
  }, async () => {
    const env = { ...ENV, EMAIL_MODE: "enabled", EMAIL_OUTBOX_VERSION: "2", EMAIL_REPLY_TO: "notificaciones@example.invalid", EMAIL: { send: async () => { throw new Error("Sin correo real"); } } };
    const errors = []; const old = console.error; console.error = (...args) => errors.push(args.join(" "));
    try { assert.deepEqual(await worker.scheduled({ scheduledTime: Date.parse("2026-10-17T05:00:00Z") }, env), { accepted: 0 }); }
    finally { console.error = old; }
    assert.equal(purges, 1); assert.equal(emailChecks, 1); assert.deepEqual(errors, ["acquisition_purge_failed"]);
  });
});


test("demo local no ejecuta purga ni consultas de medicion aunque reciba configuracion", async () => {
  await withFetch(async () => { throw new Error("La demo no debe consultar servicios"); }, async () => {
    const env = { ...ENV, ENVIRONMENT: "local", EMAIL_MODE: "enabled" };
    assert.deepEqual(await worker.scheduled({ scheduledTime: Date.parse("2026-10-17T05:00:00Z") }, env), { disabled: true });
    assert.equal((await worker.fetch(post("/api/acquisition/visit", visit), env)).status, 503);
  });
});
