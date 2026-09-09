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
const CANCELLED_PROVIDER_STATUSES = new Set(["cancelled", "rejected", "refunded", "charged_back"]);

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

  const profile = await getUserProfile(env, user.id);
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
      payer_email: profile.email || user.email,
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

async function handleMercadoPagoWebhook(request, env) {
  requireEnv(env, "MERCADOPAGO_ACCESS_TOKEN");
  requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));

  if (env.MERCADOPAGO_WEBHOOK_SECRET) {
    const isValid = await verifyMercadoPagoSignature(request, url, body, env.MERCADOPAGO_WEBHOOK_SECRET);
    if (!isValid) {
      throw httpError("Firma de Mercado Pago invalida.", 401);
    }
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
    });
    return json({ ok: true });
  }

  return json({ ok: true, ignored: true, topic });
}

async function processPaymentConfirmation(env, payment) {
  if (!payment.requestId && !payment.preapprovalId) {
    return;
  }

  if (CANCELLED_PROVIDER_STATUSES.has(payment.status)) {
    await markProviderStatus(env, payment);
    return;
  }

  if (!APPROVED_PAYMENT_STATUSES.has(payment.status)) {
    await markProviderStatus(env, payment);
    return;
  }

  const requestRecord = await findPlanRequest(env, payment);
  if (!requestRecord || requestRecord.status === "approved") {
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

  const now = new Date().toISOString();
  await supabaseUpsert(env, "subscriptions", "user_id", {
    user_id: requestRecord.user_id,
    plan: plan.id,
    status: "active",
    client_limit: plan.clientLimit,
    started_at: now,
    provider: "mercadopago",
    provider_subscription_id: payment.preapprovalId || requestRecord.provider_subscription_id,
    provider_status: payment.status,
    updated_at: now,
  });

  await markPlanRequest(env, requestRecord.id, {
    status: "approved",
    provider: "mercadopago",
    provider_subscription_id: payment.preapprovalId || requestRecord.provider_subscription_id,
    provider_status: payment.status,
    paid_at: now,
    updated_at: now,
  });
}

async function markProviderStatus(env, payment) {
  const requestRecord = await findPlanRequest(env, payment);
  if (!requestRecord || requestRecord.status === "approved") {
    return;
  }

  await markPlanRequest(env, requestRecord.id, {
    provider: "mercadopago",
    provider_subscription_id: payment.preapprovalId || requestRecord.provider_subscription_id,
    provider_status: payment.providerStatus || payment.status,
    updated_at: new Date().toISOString(),
  });
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

function normalizePayment(payment) {
  return {
    requestId: payment.external_reference || "",
    preapprovalId: payment.preapproval_id || payment.metadata?.preapproval_id || "",
    status: String(payment.status || "").toLowerCase(),
  };
}

function normalizeAuthorizedPayment(payment) {
  return {
    requestId: payment.external_reference || payment.payment?.external_reference || "",
    preapprovalId: payment.preapproval_id || payment.subscription_id || payment.preapproval?.id || "",
    status: String(payment.status || payment.payment?.status || "").toLowerCase(),
  };
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

async function getUserProfile(env, userId) {
  const rows = await supabaseSelect(env, `profiles?id=eq.${encodeURIComponent(userId)}&select=email`);
  return rows[0] || {};
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
  return supabaseFetch(env, `${table}?${filter}`, {
    method: "PATCH",
    body: row,
    headers: { Prefer: "return=representation" },
  });
}

async function supabaseUpsert(env, table, conflictKey, row) {
  return supabaseFetch(env, `${table}?on_conflict=${encodeURIComponent(conflictKey)}`, {
    method: "POST",
    body: row,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
}

async function markPlanRequest(env, requestId, row) {
  return supabaseUpdate(env, "plan_requests", `id=eq.${encodeURIComponent(requestId)}`, row);
}

async function supabaseFetch(env, path, options) {
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
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
