const SUPABASE_URL_FALLBACK = "https://kltozglqvivknbdcnnyj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK = "sb_publishable_5mT2ypc9r4SYz7DzShUHyg_esdpoD2x";
const PUBLIC_BASE_URL_FALLBACK = "https://ermif.com";

const PLAN_CONFIG = {
  basic: {
    id: "basic",
    label: "Basico",
    amount: 29,
    clientLimit: 50,
  },
  pro: {
    id: "pro",
    label: "Pro",
    amount: 59,
    clientLimit: null,
  },
};

const APPROVED_PAYMENT_STATUSES = new Set(["approved", "accredited", "processed"]);
const ACTIVE_PROVIDER_STATUSES = new Set(["authorized", "active"]);
const PAST_DUE_PROVIDER_STATUSES = new Set(["pending", "paused", "in_process", "in_mediation", "rejected"]);
const CANCELLED_PROVIDER_STATUSES = new Set(["cancelled", "canceled", "refunded", "charged_back", "chargeback", "expired"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
        return await handleCheckout(request, env);
      }

      if (url.pathname === "/api/billing/mercadopago/webhook" && request.method === "POST") {
        return await handleMercadoPagoWebhook(request, env);
      }

      if (url.pathname === "/api/reclamaciones" && request.method === "POST") {
        return await handleClaimBookSubmit(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "Ruta no encontrada." }, 404);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      const status = Number(error.status || 500);
      return json({ error: error.message || "Error interno." }, status);
    }
  },
};

async function handleCheckout(request, env) {
  requireEnv(env, "MERCADOPAGO_ACCESS_TOKEN");
  requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const user = await getAuthenticatedUser(request, env);
  const body = await request.json().catch(() => ({}));
  const plan = PLAN_CONFIG[body.planId];

  if (!plan) {
    throw httpError("El plan seleccionado no esta disponible para pago automatico.", 400);
  }

  const currentSubscription = await getUserSubscription(env, user.id);
  if (
    currentSubscription?.status === "active" &&
    currentSubscription.plan === plan.id &&
    currentSubscription.provider === "mercadopago" &&
    currentSubscription.provider_subscription_id
  ) {
    throw httpError(`Tu cuenta ya tiene activo el plan ${plan.label}.`, 409);
  }

  await cancelPendingPlanRequests(env, user.id);

  const now = new Date().toISOString();
  const requestRecord = await supabaseInsert(env, "plan_requests", {
    user_id: user.id,
    requested_plan: plan.id,
    status: "pending",
    message: sanitizeMessage(body.message) || `Checkout Mercado Pago: plan ${plan.label}.`,
    provider: "mercadopago",
    updated_at: now,
  });

  const publicBaseUrl = getPublicBaseUrl(env);
  const preapproval = await mercadoPagoFetch(env, "/preapproval", {
    method: "POST",
    body: {
      reason: `ERMIF - Plan ${plan.label}`,
      external_reference: requestRecord.id,
      payer_email: user.email,
      back_url: `${publicBaseUrl}/?billing=return`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.amount,
        currency_id: "PEN",
      },
      status: "pending",
    },
  });

  const checkoutUrl = preapproval.init_point || preapproval.sandbox_init_point;

  if (!checkoutUrl || !preapproval.id) {
    throw httpError("Mercado Pago no devolvio un enlace de pago valido.", 502);
  }

  await supabaseUpdate(env, "plan_requests", `id=eq.${encodeURIComponent(requestRecord.id)}`, {
    provider_subscription_id: preapproval.id,
    checkout_url: checkoutUrl,
    updated_at: new Date().toISOString(),
  });

  return json({ checkoutUrl });
}

async function handleClaimBookSubmit(request, env) {
  requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const body = await request.json().catch(() => ({}));
  const user = await getOptionalAuthenticatedUser(request, env);
  const row = normalizeClaimBookEntry(body, user?.id);
  const saved = await supabaseInsert(env, "claim_book_entries", row);

  return json({
    claimCode: saved.claim_code,
    createdAt: saved.created_at,
  });
}

async function handleMercadoPagoWebhook(request, env) {
  requireEnv(env, "MERCADOPAGO_ACCESS_TOKEN");
  requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  requireEnv(env, "MERCADOPAGO_WEBHOOK_SECRET");

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));

  const isValid = await verifyMercadoPagoSignature(request, url, body, env.MERCADOPAGO_WEBHOOK_SECRET);
  if (!isValid) {
    throw httpError("Firma de Mercado Pago invalida.", 401);
  }

  const topic = String(url.searchParams.get("topic") || url.searchParams.get("type") || body.topic || body.type || "").toLowerCase();
  const resourceId = getWebhookResourceId(url, body);

  if (!resourceId) {
    return json({ ok: true, ignored: true, reason: "Sin identificador de recurso." });
  }

  if (topic.includes("authorized_payment")) {
    const authorizedPayment = await mercadoPagoFetch(env, `/authorized_payments/${encodeURIComponent(resourceId)}`);
    await processPaymentConfirmation(env, normalizeAuthorizedPayment(authorizedPayment));
    return json({ ok: true });
  }

  if (topic === "payment" || topic.includes("payment")) {
    const payment = await mercadoPagoFetch(env, `/v1/payments/${encodeURIComponent(resourceId)}`);
    await processPaymentConfirmation(env, normalizePayment(payment));
    return json({ ok: true });
  }

  if (topic.includes("preapproval")) {
    const preapproval = await mercadoPagoFetch(env, `/preapproval/${encodeURIComponent(resourceId)}`);
    await markProviderStatus(env, {
      requestId: preapproval.external_reference,
      preapprovalId: preapproval.id,
      providerStatus: preapproval.status,
      currentPeriodEnd: extractCurrentPeriodEnd(preapproval),
    });
    return json({ ok: true });
  }

  return json({ ok: true, ignored: true, topic });
}

async function processPaymentConfirmation(env, payment) {
  if (!payment.requestId && !payment.preapprovalId) {
    return;
  }

  if (!APPROVED_PAYMENT_STATUSES.has(payment.status)) {
    await markProviderStatus(env, payment);
    return;
  }

  const requestRecord = await findPlanRequest(env, payment);
  if (!requestRecord) {
    return;
  }

  const now = new Date().toISOString();
  const providerSubscriptionId = payment.preapprovalId || requestRecord.provider_subscription_id;
  const currentSubscription = await getUserSubscription(env, requestRecord.user_id);
  const isSameSubscription =
    currentSubscription?.provider === "mercadopago" && currentSubscription.provider_subscription_id === providerSubscriptionId;

  if (isTerminalPlanRequestStatus(requestRecord.status)) {
    return;
  }

  if (
    requestRecord.status === "approved" &&
    providerSubscriptionId &&
    currentSubscription?.provider === "mercadopago" &&
    currentSubscription.provider_subscription_id &&
    !isSameSubscription
  ) {
    return;
  }

  const plan = PLAN_CONFIG[requestRecord.requested_plan];
  if (!plan) {
    await markPlanRequest(env, requestRecord.id, {
      status: "failed",
      provider_status: payment.status,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  if (
    providerSubscriptionId &&
    currentSubscription?.provider === "mercadopago" &&
    currentSubscription.provider_subscription_id &&
    !isSameSubscription
  ) {
    await cancelMercadoPagoPreapproval(env, currentSubscription.provider_subscription_id, { allowMissing: true });
    await markPlanRequestsBySubscription(env, currentSubscription.provider_subscription_id, {
      status: "cancelled",
      provider_status: "cancelled",
      updated_at: now,
    });
  }

  await supabaseUpsert(env, "subscriptions", "user_id", {
    user_id: requestRecord.user_id,
    plan: plan.id,
    status: "active",
    client_limit: plan.clientLimit,
    started_at: isSameSubscription ? currentSubscription.started_at || now : now,
    current_period_end: payment.currentPeriodEnd || currentSubscription?.current_period_end || null,
    provider: "mercadopago",
    provider_subscription_id: providerSubscriptionId,
    provider_status: payment.status,
    updated_at: now,
  });

  await markPlanRequest(env, requestRecord.id, {
    status: "approved",
    provider: "mercadopago",
    provider_subscription_id: providerSubscriptionId,
    provider_status: payment.status,
    current_period_end: payment.currentPeriodEnd || null,
    paid_at: now,
    updated_at: now,
  });
}

async function markProviderStatus(env, payment) {
  const requestRecord = await findPlanRequest(env, payment);
  if (!requestRecord) {
    return;
  }

  const now = new Date().toISOString();
  const providerStatus = String(payment.providerStatus || payment.status || "").toLowerCase();
  const providerSubscriptionId = payment.preapprovalId || requestRecord.provider_subscription_id;
  const subscriptionStatus = mapProviderStatusToSubscriptionStatus(providerStatus);

  await markPlanRequest(env, requestRecord.id, {
    status: mapProviderStatusToPlanRequestStatus(providerStatus, requestRecord.status),
    provider: "mercadopago",
    provider_subscription_id: providerSubscriptionId,
    provider_status: providerStatus,
    current_period_end: payment.currentPeriodEnd || null,
    updated_at: now,
  });

  if (providerSubscriptionId && subscriptionStatus) {
    await updateCurrentSubscriptionStatus(env, {
      userId: requestRecord.user_id,
      providerSubscriptionId,
      providerStatus,
      subscriptionStatus,
      currentPeriodEnd: payment.currentPeriodEnd || null,
      updatedAt: now,
    });
  }
}

async function findPlanRequest(env, payment) {
  if (payment.requestId) {
    const byId = await supabaseSelect(env, `plan_requests?id=eq.${encodeURIComponent(payment.requestId)}&select=*`);
    if (byId[0]) return byId[0];
  }

  if (payment.preapprovalId) {
    const byProviderId = await supabaseSelect(
      env,
      `plan_requests?provider=eq.mercadopago&provider_subscription_id=eq.${encodeURIComponent(payment.preapprovalId)}&select=*`
    );
    if (byProviderId[0]) return byProviderId[0];
  }

  return null;
}

async function getUserSubscription(env, userId) {
  if (!userId) return null;
  const rows = await supabaseSelect(env, `subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  return rows[0] || null;
}

async function cancelPendingPlanRequests(env, userId) {
  const pendingRequests = await supabaseSelect(
    env,
    `plan_requests?user_id=eq.${encodeURIComponent(userId)}&provider=eq.mercadopago&status=eq.pending&select=*`
  );
  const now = new Date().toISOString();

  for (const pendingRequest of pendingRequests) {
    if (pendingRequest.provider_subscription_id) {
      await cancelMercadoPagoPreapproval(env, pendingRequest.provider_subscription_id, { allowMissing: true });
    }
    await markPlanRequest(env, pendingRequest.id, {
      status: "cancelled",
      provider_status: "cancelled",
      updated_at: now,
    });
  }
}

async function cancelMercadoPagoPreapproval(env, preapprovalId, options = {}) {
  if (!preapprovalId) return;

  let preapproval;
  try {
    preapproval = await mercadoPagoFetch(env, `/preapproval/${encodeURIComponent(preapprovalId)}`);
  } catch (error) {
    if (options.allowMissing && [400, 404].includes(Number(error.status || 0))) return;
    throw error;
  }

  const status = String(preapproval.status || "").toLowerCase();
  if (CANCELLED_PROVIDER_STATUSES.has(status)) return;

  await mercadoPagoFetch(env, `/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    body: { status: "cancelled" },
  });
}

async function markPlanRequestsBySubscription(env, providerSubscriptionId, row) {
  if (!providerSubscriptionId) return [];
  return supabaseUpdate(
    env,
    "plan_requests",
    `provider=eq.mercadopago&provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}`,
    row
  );
}

async function updateCurrentSubscriptionStatus(env, update) {
  const currentSubscription = await getUserSubscription(env, update.userId);
  if (
    !currentSubscription ||
    currentSubscription.provider !== "mercadopago" ||
    currentSubscription.provider_subscription_id !== update.providerSubscriptionId
  ) {
    return;
  }

  await supabaseUpsert(env, "subscriptions", "user_id", {
    user_id: update.userId,
    plan: currentSubscription.plan || "free",
    status: update.subscriptionStatus,
    client_limit: currentSubscription.client_limit === null ? null : currentSubscription.client_limit || 10,
    started_at: currentSubscription.started_at || update.updatedAt,
    expires_at: update.subscriptionStatus === "active" ? currentSubscription.expires_at || null : update.updatedAt,
    current_period_end: update.currentPeriodEnd || currentSubscription.current_period_end || null,
    provider: "mercadopago",
    provider_subscription_id: update.providerSubscriptionId,
    provider_status: update.providerStatus,
    updated_at: update.updatedAt,
  });
}

function mapProviderStatusToSubscriptionStatus(status) {
  const normalizedStatus = String(status || "").toLowerCase();
  if (APPROVED_PAYMENT_STATUSES.has(normalizedStatus) || ACTIVE_PROVIDER_STATUSES.has(normalizedStatus)) return "active";
  if (normalizedStatus === "refunded") return "refunded";
  if (normalizedStatus === "charged_back" || normalizedStatus === "chargeback") return "chargeback";
  if (normalizedStatus === "expired") return "expired";
  if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") return "cancelled";
  if (PAST_DUE_PROVIDER_STATUSES.has(normalizedStatus)) return "past_due";
  return null;
}

function mapProviderStatusToPlanRequestStatus(status, currentStatus) {
  const normalizedStatus = String(status || "").toLowerCase();
  if (APPROVED_PAYMENT_STATUSES.has(normalizedStatus)) return "approved";
  if (ACTIVE_PROVIDER_STATUSES.has(normalizedStatus)) return currentStatus === "approved" ? "approved" : currentStatus || "pending";
  if (normalizedStatus === "refunded") return "refunded";
  if (normalizedStatus === "charged_back" || normalizedStatus === "chargeback") return "chargeback";
  if (normalizedStatus === "expired") return "expired";
  if (normalizedStatus === "cancelled" || normalizedStatus === "canceled") return "cancelled";
  if (normalizedStatus === "rejected") return currentStatus === "approved" ? "past_due" : "failed";
  if (PAST_DUE_PROVIDER_STATUSES.has(normalizedStatus)) return currentStatus || "pending";
  return currentStatus || "pending";
}

function isTerminalPlanRequestStatus(status) {
  return ["cancelled", "refunded", "chargeback", "expired", "failed"].includes(String(status || "").toLowerCase());
}

function normalizePayment(payment) {
  return {
    requestId: payment.external_reference || "",
    preapprovalId: payment.preapproval_id || payment.metadata?.preapproval_id || "",
    status: String(payment.status || "").toLowerCase(),
    currentPeriodEnd: extractCurrentPeriodEnd(payment),
  };
}

function normalizeAuthorizedPayment(payment) {
  return {
    requestId: payment.external_reference || payment.payment?.external_reference || "",
    preapprovalId: payment.preapproval_id || payment.subscription_id || payment.preapproval?.id || "",
    status: String(payment.status || payment.payment?.status || "").toLowerCase(),
    currentPeriodEnd: extractCurrentPeriodEnd(payment),
  };
}

function extractCurrentPeriodEnd(source) {
  const value =
    source.current_period_end ||
    source.currentPeriodEnd ||
    source.next_payment_date ||
    source.date_next_payment ||
    source.auto_recurring?.end_date ||
    source.payment?.current_period_end ||
    source.payment?.next_payment_date ||
    "";

  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function shouldRetryWithoutCurrentPeriodEnd(error, row) {
  return (
    row &&
    Object.prototype.hasOwnProperty.call(row, "current_period_end") &&
    /current_period_end|schema cache|column/i.test(error.message || "")
  );
}

function withoutCurrentPeriodEnd(row) {
  const compatibleRow = { ...row };
  delete compatibleRow.current_period_end;
  return compatibleRow;
}

async function getAuthenticatedUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw httpError("Debes iniciar sesion para solicitar un plan.", 401);
  }

  const response = await fetch(`${getSupabaseUrl(env)}/auth/v1/user`, {
    headers: {
      apikey: getSupabasePublishableKey(env),
      Authorization: authorization,
    },
  });

  if (!response.ok) {
    throw httpError("La sesion no es valida. Vuelve a iniciar sesion.", 401);
  }

  return response.json();
}

async function getOptionalAuthenticatedUser(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  try {
    return await getAuthenticatedUser(request, env);
  } catch {
    return null;
  }
}

async function supabaseSelect(env, path) {
  return supabaseFetch(env, path, { method: "GET" });
}

async function supabaseInsert(env, table, row) {
  const rows = await supabaseFetch(env, table, {
    method: "POST",
    body: row,
    headers: { Prefer: "return=representation" },
  });
  return rows[0];
}

async function supabaseUpdate(env, table, filter, row) {
  try {
    return await supabaseFetch(env, `${table}?${filter}`, {
      method: "PATCH",
      body: row,
      headers: { Prefer: "return=representation" },
    });
  } catch (error) {
    if (!shouldRetryWithoutCurrentPeriodEnd(error, row)) throw error;
    return supabaseFetch(env, `${table}?${filter}`, {
      method: "PATCH",
      body: withoutCurrentPeriodEnd(row),
      headers: { Prefer: "return=representation" },
    });
  }
}

async function supabaseUpsert(env, table, conflictKey, row) {
  try {
    return await supabaseFetch(env, `${table}?on_conflict=${encodeURIComponent(conflictKey)}`, {
      method: "POST",
      body: row,
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    });
  } catch (error) {
    if (!shouldRetryWithoutCurrentPeriodEnd(error, row)) throw error;
    return supabaseFetch(env, `${table}?on_conflict=${encodeURIComponent(conflictKey)}`, {
      method: "POST",
      body: withoutCurrentPeriodEnd(row),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    });
  }
}

async function markPlanRequest(env, requestId, row) {
  return supabaseUpdate(env, "plan_requests", `id=eq.${encodeURIComponent(requestId)}`, row);
}

async function supabaseFetch(env, path, options) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: serviceKey,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (!serviceKey.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${serviceKey}`;
  }

  const response = await fetch(`${getSupabaseUrl(env)}/rest/v1/${path}`, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw httpError(data?.message || "Supabase rechazo la operacion.", response.status);
  }

  return data || [];
}

async function mercadoPagoFetch(env, path, options = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(data.message || data.error || "Mercado Pago rechazo la operacion.", response.status);
  }

  return data;
}

async function verifyMercadoPagoSignature(request, url, body, secret) {
  const signatureHeader = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const signatureParts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [String(key || "").trim(), String(value || "").trim()];
    })
  );

  const timestamp = signatureParts.ts;
  const signature = signatureParts.v1;
  const dataId = getWebhookResourceId(url, body);

  if (!timestamp || !signature || !requestId || !dataId) {
    return false;
  }

  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expected = await hmacSha256Hex(secret, manifest);
  return timingSafeEqual(expected, signature);
}

async function hmacSha256Hex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function getWebhookResourceId(url, body) {
  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("data_id") ||
    url.searchParams.get("id") ||
    body?.data?.id ||
    body?.resource?.id ||
    body?.id ||
    ""
  );
}

function getSupabaseUrl(env) {
  return env.SUPABASE_URL || SUPABASE_URL_FALLBACK;
}

function getSupabasePublishableKey(env) {
  return env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK;
}

function getPublicBaseUrl(env) {
  return (env.PUBLIC_BASE_URL || PUBLIC_BASE_URL_FALLBACK).replace(/\/$/, "");
}

function sanitizeMessage(message) {
  return String(message || "").trim().slice(0, 500);
}

function normalizeClaimBookEntry(body, userId) {
  const requestType = String(body.requestType || "").trim().toLowerCase();
  if (!["reclamo", "queja"].includes(requestType)) {
    throw httpError("Selecciona si registraras un reclamo o una queja.", 400);
  }

  const email = requiredText(body.email, "Ingresa el correo electronico.", 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Ingresa un correo electronico valido.", 400);
  }

  const amount = body.amount === null || body.amount === undefined || body.amount === "" ? null : Number(body.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    throw httpError("El monto reclamado debe ser cero o mayor.", 400);
  }

  return {
    claim_code: createClaimCode(),
    submitted_user_id: userId || null,
    request_type: requestType,
    service_name: requiredText(body.serviceName, "Ingresa el servicio contratado.", 120),
    consumer_first_name: requiredText(body.consumerFirstName, "Ingresa tus nombres.", 120),
    consumer_last_name: requiredText(body.consumerLastName, "Ingresa tus apellidos.", 120),
    document_type: requiredText(body.documentType, "Selecciona el tipo de documento.", 30),
    document_number: requiredText(body.documentNumber, "Ingresa el numero de documento.", 20),
    email,
    phone: requiredText(body.phone, "Ingresa un telefono o WhatsApp.", 30),
    address: requiredText(body.address, "Ingresa la direccion del consumidor.", 240),
    amount,
    payment_reference: optionalText(body.paymentReference, 120),
    detail: requiredText(body.detail, "Describe el reclamo o queja.", 1200),
    request: requiredText(body.request, "Indica el pedido concreto.", 700),
    status: "received",
    provider_email: "MLVN696986@GMAIL.COM",
    provider_phone: "984096252",
  };
}

function requiredText(value, message, maxLength) {
  const text = String(value || "").trim();
  if (!text) {
    throw httpError(message, 400);
  }
  return text.slice(0, maxLength);
}

function optionalText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength) || null;
}

function createClaimCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `ERMIF-${date}-${suffix}`;
}

function requireEnv(env, name) {
  if (!env[name]) {
    throw httpError(`Falta configurar ${name}.`, 503);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  };
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
