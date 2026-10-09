import { prepareTransactionalEmail, validEmail } from './transactional-email.mjs';
const MAX_BATCH = 5;
const RETRY_CODES = new Set(['E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED']);
const PERMANENT_CODES = new Set(['E_VALIDATION_ERROR', 'E_FIELD_MISSING', 'E_SENDER_NOT_VERIFIED', 'E_RECIPIENT_NOT_ALLOWED', 'E_RECIPIENT_SUPPRESSED', 'E_SENDER_DOMAIN_NOT_AVAILABLE', 'E_CONTENT_TOO_LARGE']);
export function classifySendError(error) {
  const candidate = String(error?.code || error?.message || '');
  const code = candidate.match(/\bE_[A-Z_]+\b/)?.[0];
  if (RETRY_CODES.has(code)) return { status: 'retry', error: code, delay: code === 'E_DAILY_LIMIT_EXCEEDED' ? 86400 : 300 };
  if (PERMANENT_CODES.has(code)) return { status: 'error', error: code, delay: 0 };
  // Un fallo de red o interno puede ocurrir DESPUÉS de aceptar el mensaje.
  return { status: 'unknown', error: 'Resultado incierto. Revisar Activity log antes de reenviar.', delay: 0 };
}
export async function dispatchEmails(env, rpc) {
  if (env.ENVIRONMENT === 'local' || env.EMAIL_MODE !== 'enabled') return { disabled: true };
  if (env.EMAIL_OUTBOX_VERSION !== '2' || !env.EMAIL?.send || !validEmail(env.EMAIL_REPLY_TO)) throw new Error('Configuración de correo incompleta.');
  let accepted = 0;
  for (let i = 0; i < MAX_BATCH; i++) {
    const rows = await rpc('email_claim_next', {});
    const row = rows?.[0];
    if (!row) break;
    let rendered;
    try { rendered = prepareTransactionalEmail({ eventKey: row.event_key, recipient: row.recipient, subject: row.subject, payload: row.payload }); }
    catch {
      await rpc('email_finish_attempt', { p_id: row.id, p_lease: row.lease_token, p_status: 'error', p_message_id: null, p_error: 'Contenido o destinatario inválido.', p_delay: 0 });
      continue;
    }
    let result;
    try {
      const reply = await env.EMAIL.send({ to: rendered.to, from: { email: 'notificaciones@ermif.com', name: 'ERMIF' },
        replyTo: env.EMAIL_REPLY_TO, subject: rendered.subject, html: rendered.html, text: rendered.text });
      if (!reply?.messageId) throw new Error('Sin confirmación del proveedor');
      result = { status: 'accepted', messageId: reply.messageId, error: null, delay: 0 };
    } catch (error) { result = classifySendError(error); }
    // Si guardar falla, NO reenviar: el lease vencido pasa a revisión manual.
    const saved = await rpc('email_finish_attempt', { p_id: row.id, p_lease: row.lease_token, p_status: result.status,
      p_message_id: result.messageId || null, p_error: result.error, p_delay: result.delay });
    if (saved !== true) throw new Error('No se confirmó el resultado del envío.');
    if (result.status === 'accepted') accepted++;
    if (result.status === 'retry' || result.status === 'unknown') break;
  }
  return { accepted };
}
const DELIVERY = new Set(['delivered', 'deferred', 'bounced', 'failed', 'rejected', 'complained']);
export async function consumeEmailEvents(batch, env, rpc) {
  if (env.ENVIRONMENT === 'local') return;
  if (!env.EMAIL_EVENTS_QUEUE || batch.queue !== env.EMAIL_EVENTS_QUEUE) throw new Error('Cola de eventos no configurada.');
  for (const message of batch.messages) {
    const event = message.body;
    const status = String(event?.type || '').replace('cf.email.sending.message.', '');
    if (!DELIVERY.has(status) || event?.source?.type !== 'email.sending' || event.source.domain !== 'ermif.com' ||
        event?.metadata?.accountId !== env.CLOUDFLARE_ACCOUNT_ID || event?.metadata?.eventSchemaVersion !== 1 ||
        !event?.payload?.eventId || !event?.payload?.messageId || !Number.isFinite(Date.parse(event?.metadata?.eventTimestamp))) {
      message.ack(); continue; // No datos de remitente/asunto/cuerpo en logs.
    }
    try {
      await rpc('email_record_delivery', { p_event_id: event.payload.eventId, p_message_id: event.payload.messageId,
        p_status: status, p_at: event.metadata.eventTimestamp });
      message.ack();
    } catch { message.retry(); }
  }
}
