export const EMAIL_EVENTS = {
  system_check: ['Prueba de correo automático', 'Esta es una prueba técnica del servicio de correos de ERMIF.'],
  claim_received: ['Recibimos tu reclamación', 'Tu solicitud quedó registrada. Conserva el código para consultar su atención.'],
  claim_response: ['Respuesta a tu reclamación', 'El equipo de ERMIF ha registrado la siguiente respuesta a tu solicitud.'],
  privacy_received: ['Recibimos tu solicitud de privacidad', 'Revisaremos tu solicitud y, si necesitamos verificar información, nos pondremos en contacto contigo.'],
  privacy_response: ['Respuesta a tu solicitud de privacidad', 'Esta es la respuesta registrada por el equipo de ERMIF.'],
  account_deletion_received: ['Solicitud de eliminación recibida', 'La solicitud será revisada. Este mensaje confirma su recepción; todavía no confirma la eliminación de la cuenta.'],
  account_deletion_updated: ['Actualización de tu solicitud de eliminación', 'El estado de tu solicitud ha cambiado. Puedes responder a este correo si necesitas aclaraciones.'],
  subscription_updated: ['Actualización de tu suscripción', 'Consulta el estado de tu plan en ERMIF. Este aviso no es un comprobante de pago.'],
  internal_alert: ['Nueva solicitud por atender', 'Hay una nueva solicitud en el panel de administración de ERMIF. Ingresa a tu cuenta para consultar los detalles.'],
};
const FIELDS = {
  claimCode: 'Código de reclamación', requestCode: 'Código de solicitud',
  requestType: 'Tipo de solicitud', createdAt: 'Recibido', submittedAt: 'Recibido',
  requestedAt: 'Solicitado', dueAt: 'Fecha estimada de respuesta',
  requestSummary: 'Tu solicitud', response: 'Respuesta', respondedAt: 'Fecha de respuesta',
  scheduledDeletionAt: 'Fecha prevista de revisión para eliminación',
  plan: 'Plan', status: 'Estado', currentPeriodEnd: 'Fin del periodo registrado',
};
const LABELS = { received: 'Recibida', in_review: 'En revisión', processed: 'Tramitada', cancelled: 'Cancelada',
  active: 'Activo', past_due: 'Requiere atención', inactive: 'Inactivo', expired: 'Vencido', pending: 'Pendiente',
  free: 'Gratuito', basic: 'Básico', pro: 'Pro', reclamo: 'Reclamo', queja: 'Queja',
  informacion: 'Información', acceso: 'Acceso', rectificacion: 'Rectificación', cancelacion: 'Cancelación', oposicion: 'Oposición' };
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;"\\]+@[^\s<>@,;"\\]+\.[^\s<>@,;"\\]+$/.test(value);
}
function displayValue(key, value) {
  if (/At$|PeriodEnd$/.test(key)) {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }).format(date);
  }
  return LABELS[value] || String(value).slice(0, 10000);
}
export function prepareTransactionalEmail(message) {
  const kind = String(message.eventKey || '').split(':')[0];
  if (!Object.hasOwn(EMAIL_EVENTS, kind)) throw new Error('Evento de correo no soportado.');
  const recipient = String(message.recipient || '').trim();
  const subject = String(message.subject || '').trim();
  if (!validEmail(recipient)) throw new Error('Destinatario de correo inválido.');
  if (!subject || /[\r\n]/.test(subject) || subject.length > 200) throw new Error('Asunto de correo inválido.');
  const [title, intro] = EMAIL_EVENTS[kind];
  const lines = Object.entries(FIELDS).filter(([key]) => message.payload?.[key] != null && message.payload[key] !== '')
    .map(([key, label]) => [label, displayValue(key, message.payload[key])]);
  const support = 'mlvn696986@gmail.com';
  const footer = 'Puedes responder a este correo para contactar al equipo de ERMIF. No envíes contraseñas ni códigos de acceso.';
  const text = ['ERMIF', title, intro, ...lines.map(([label, value]) => label + ': ' + value), 'https://ermif.com', footer, 'Contacto: ' + support].join('\n\n');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#f4f6f8;color:#182b36;font-family:Arial,sans-serif;line-height:1.6"><table role="presentation" width="100%"><tr><td style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;margin:auto;background:#fff;border-radius:12px"><tr><td style="padding:28px">
<p style="color:#087f5b;font-size:22px;font-weight:bold;margin-top:0">ERMIF</p><h1 style="font-size:23px">${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p>
${lines.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`).join('')}
<p><a href="https://ermif.com" style="color:#087f5b">Ir a ERMIF</a></p><hr style="border:0;border-top:1px solid #e5e9ed"><p style="font-size:13px;color:#52636d">${footer}<br>Contacto: <a href="mailto:${support}">${support}</a></p></td></tr></table></td></tr></table></body></html>`;
  return { to: recipient, subject, text, html, templateVersion: 2 };
}
// Compatibilidad mientras se prepara la migración. Nunca envía directamente.
export async function enqueueTransactionalEmail(message, { insert, findByEventKey }) {
  try {
    const rendered = prepareTransactionalEmail(message);
    const row = { event_key: message.eventKey, recipient: rendered.to, subject: rendered.subject,
      payload: { ...message.payload, rendered }, status: 'pending_configuration',
      last_error: 'Pendiente de activar la cola de correos de ERMIF.' };
    const saved = await insert(row);
    const existing = saved || await findByEventKey(message.eventKey);
    if (!existing) throw new Error('La cola no confirmó el registro.');
    return { status: existing.status, error: existing.last_error || null };
  } catch { return { status: 'error', error: 'No se pudo preparar o registrar el correo.' }; }
}
