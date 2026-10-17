const CONSENT_VERSION = "2026-10-16";
const PUBLIC_PATHS = new Set(["/", "/precios/", "/como-funciona/", "/contacto/", "/privacidad/", "/terminos/", "/app/"]);
const SOURCES = new Set(["directo", "google", "bing", "duckduckgo", "facebook", "instagram", "tiktok", "youtube", "linkedin", "whatsapp", "email", "otro"]);
const MEDIUMS = new Set(["direct", "organic", "paid_search", "paid_social", "social", "email", "referral", "other"]);
const CAMPAIGNS = new Set(["", "lanzamiento-ermif", "contenido-educativo"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1024;

function fail(status, message) {
  throw Object.assign(new Error(message), { status, acquisitionPublicMessage: message });
}
function reply(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), { status, headers: {
    "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
  } });
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if ((request.method !== "GET" && !origin) || (origin && origin !== new URL(request.url).origin) || ["cross-site", "same-site"].includes(request.headers.get("Sec-Fetch-Site"))) {
    fail(403, "Esta solicitud debe realizarse desde ERMIF.");
  }
}
async function bodyObject(request, allowed) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) fail(415, "Se requiere JSON.");
  const declared = request.headers.get("Content-Length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) fail(413, "Solicitud demasiado grande.");
  if (!request.body) fail(400, "Solicitud vacia.");
  const reader = request.body.getReader();
  const chunks = []; let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) { await reader.cancel(); fail(413, "Solicitud demasiado grande."); }
    chunks.push(value);
  }
  const content = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(content)); }
  catch { fail(400, "JSON invalido."); }
  if (!body || Array.isArray(body) || typeof body !== "object" || Object.keys(body).some((key) => !allowed.includes(key))) fail(400, "Campos no permitidos.");
  return body;
}
async function limitPublicRequest(request, env) {
  if (!env.ACQUISITION_RATE_LIMITER?.limit) fail(503, "La medicion no esta disponible temporalmente.");
  // El control de frecuencia usa una clave efimera derivada de la IP; no se guarda en Supabase.
  const input = new TextEncoder().encode(request.headers.get("CF-Connecting-IP") || "unknown");
  const digest = await crypto.subtle.digest("SHA-256", input);
  const key = "acquisition:" + [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const result = await env.ACQUISITION_RATE_LIMITER.limit({ key });
  if (!result.success) fail(429, "Demasiadas solicitudes. Intenta nuevamente mas tarde.");
}
function visitorId(body) {
  if (typeof body.visitor_id !== "string" || !UUID.test(body.visitor_id)) fail(400, "Identificador de visita invalido.");
  return body.visitor_id;
}

export async function handleAcquisitionRequest(request, env, services) {
  try {
    sameOrigin(request);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return reply(null, 204);
    if (url.pathname === "/api/admin/acquisition" && request.method === "GET") {
      if ([...url.searchParams.keys()].some((key) => key !== "days") || url.searchParams.getAll("days").length > 1) fail(400, "Periodo invalido.");
      const text = url.searchParams.get("days") || "30";
      if (!["30", "90", "180"].includes(text)) fail(400, "Periodo invalido.");
      const user = await services.user(request);
      await services.admin(user.id);
      return reply(await services.rpc("acquisition_report", { p_days: Number(text) }));
    }
    if (request.method !== "POST") fail(405, "Metodo no permitido.");
    if (url.search) fail(400, "No se admiten parametros en esta solicitud.");
    if (url.pathname === "/api/acquisition/visit") {
      await limitPublicRequest(request, env);
      const body = await bodyObject(request, ["visitor_id", "consent", "consent_version", "landing_path", "source", "medium", "campaign_id"]);
      const id = visitorId(body);
      if (body.consent !== true || body.consent_version !== CONSENT_VERSION) fail(400, "Es necesario aceptar la medicion opcional vigente.");
      if (!PUBLIC_PATHS.has(body.landing_path) || !SOURCES.has(body.source) || !MEDIUMS.has(body.medium) || !CAMPAIGNS.has(body.campaign_id)) fail(400, "Datos de procedencia invalidos.");
      const result = await services.rpc("acquisition_visit_create", {
        p_visitor_id: id,
        p_landing_path: body.landing_path, p_source: body.source, p_medium: body.medium,
        p_campaign_id: body.campaign_id, p_consent_version: body.consent_version,
      });
      return reply(result, result?.revoked === true ? 200 : 201);
    }
    if (url.pathname === "/api/acquisition/identify") {
      const body = await bodyObject(request, ["visitor_id"]);
      const id = visitorId(body);
      const user = await services.user(request);
      if (!UUID.test(String(user.id || ""))) fail(401, "Sesion no valida.");
      return reply(await services.rpc("acquisition_identify", { p_visitor_id: id, p_user_id: user.id }));
    }
    if (url.pathname === "/api/acquisition/revoke") {
      await limitPublicRequest(request, env);
      const body = await bodyObject(request, ["visitor_id"]);
      await services.rpc("acquisition_revoke", { p_visitor_id: visitorId(body) });
      return reply({ revoked: true });
    }
    fail(404, "Ruta no encontrada.");
  } catch (error) {
    const status = [400, 401, 403, 404, 405, 413, 415, 429, 503].includes(error.status) ? error.status : 503;
    const message = error.acquisitionPublicMessage || (status === 401 ? "Inicia sesion para continuar." : status === 403 ? "No tienes permiso para consultar esta informacion." : "La medicion no esta disponible temporalmente.");
    return reply({ error: message }, status);
  }
}

// La factura recurrente y su pago tienen IDs diferentes. Solo este ultimo es una conversion.
export function verifiedPaymentEvidence(payment) {
  const id = String(payment?.id || "");
  const amount = Number(payment?.transaction_amount);
  const approved = Date.parse(payment?.date_approved || "");
  if (payment?.status !== "approved" || payment.live_mode !== true || !/^\d{1,30}$/.test(id) || !Number.isFinite(amount) || amount <= 0 || payment.currency_id !== "PEN" || !Number.isFinite(approved)) return null;
  return { paymentId: id, paidAt: new Date(approved).toISOString() };
}

export async function captureAcquisitionPayment(payment, reference, services) {
  const evidence = verifiedPaymentEvidence(payment);
  if (!evidence) return false;
  const actualReference = String(payment.external_reference || "").toLowerCase();
  const invoiceReference = String(reference.requestId || "").toLowerCase();
  const directSubscription = String(payment.preapproval_id || "");
  const metadataSubscription = String(payment.metadata?.preapproval_id || "");
  const invoiceSubscription = String(reference.preapprovalId || "");
  const subscriptions = [directSubscription, metadataSubscription, invoiceSubscription].filter(Boolean);
  if ((actualReference && invoiceReference && actualReference !== invoiceReference) || new Set(subscriptions).size > 1) return false;
  const requestId = actualReference || invoiceReference;
  const preapprovalId = subscriptions[0] || "";
  if ((requestId && !UUID.test(requestId)) || (!requestId && !preapprovalId)) return false;
  const request = await services.findRequest({ requestId, preapprovalId });
  if (!request || request.provider !== "mercadopago" || !["basic", "pro"].includes(request.requested_plan) || !UUID.test(String(request.user_id || "")) || !UUID.test(String(request.id || ""))) return false;
  // Una busqueda alternativa por suscripcion nunca debe sustituir una referencia explicita contradictoria.
  if (requestId && String(request.id).toLowerCase() !== requestId) return false;
  if (preapprovalId && String(request.provider_subscription_id || "") !== preapprovalId) return false;
  await services.rpc("acquisition_record_payment", {
    p_user_id: request.user_id, p_payment_id: evidence.paymentId,
    p_paid_at: evidence.paidAt, p_plan: request.requested_plan,
  });
  return true;
}

export function isAcquisitionPurgeTime(scheduledTime) {
  const date = new Date(scheduledTime);
  return Number.isFinite(date.getTime()) && date.getUTCHours() === 5 && date.getUTCMinutes() === 0;
}
