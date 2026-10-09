# Correos automáticos de ERMIF

Actualizado: 8 de octubre de 2026, hora de Lima. Publicado y activado en producción.

## Estado confirmado

El propietario activó Cloudflare Email Sending para ermif.com. Sus capturas muestran Sending Enabled y DNS Configured. Configuró Supabase SMTP con smtp.mx.cloudflare.net, puerto 465, usuario api_token y su token directamente en el panel. Un correo de recuperación llegó; Gmail mostró SPF, DKIM y DMARC PASS. Una segunda prueba con la plantilla en español apareció en Recibidos. Esto comprueba esas pruebas, no garantiza la ubicación de futuros correos. Falta confirmar recuperación de contraseña de extremo a extremo.

Remitente de la aplicación: ERMIF <notificaciones@ermif.com>. Reply-To y alertas internas: mlvn696986@gmail.com, confirmado por el propietario. Alcance: correos de ERMIF, sin recordatorios a deudores ni campañas comerciales.

## Qué incluye el código

| Evento | Origen guardado | Destinatario |
| --- | --- | --- |
| Recepción de reclamación | Nueva reclamación | Solicitante + alerta interna |
| Respuesta de reclamación | Respuesta guardada y nueva versión | Solicitante |
| Recepción de privacidad | Nueva solicitud ARCO | Solicitante + alerta interna |
| Respuesta de privacidad | Respuesta guardada desde el panel admin | Solicitante |
| Solicitud de eliminación | Nueva solicitud | Solicitante + alerta interna |
| Eliminación cancelada o tramitada | Cambio explícito de estado del expediente | Solicitante |
| Cambio de suscripción | Cambio real de plan, estado o periodo | Correo verificado en Supabase Auth |

La notificación de eliminación NO elimina la cuenta ni afirma que se borraron todos sus datos. El proceso de eliminación sigue sujeto a revisión. El aviso de suscripción NO es una factura, boleta ni confirmación de cobro. No se añadió automatización de cobros ni se alteraron las reglas financieras.

Las ocho plantillas operativas y la plantilla de comprobación técnica de la aplicación están en src/transactional-email.mjs. Incluyen español, HTML adaptable, versión en texto, fechas de Lima, contacto y escape de contenido. Las alertas internas solo contienen el código del expediente, sin documentos ni detalles personales.

El panel administrativo muestra los últimos 100 correos y sus resultados, restringido a administradores. Privacidad tiene un formulario de respuesta. Las respuestas de reclamaciones se guardan antes de consultar su correo; una versión concurrente produce conflicto en vez de sobrescribir otra respuesta.

## Funcionamiento y controles

- La migración migrations/20261008_transactional_email.sql crea el correo en la misma transacción que su expediente. Si la transacción no se confirma, tampoco aparece el correo.
- Una clave única identifica cada evento. Actualizar otros campos o recibir el mismo estado de suscripción no crea otro aviso.
- Cron cada 5 minutos, hasta 5 mensajes por ejecución. Las reservas SQL evitan que dos ejecuciones seleccionen el mismo mensaje.
- Reserva de 10 minutos. Una interrupción o respuesta ambigua pasa a unknown y requiere revisión en Cloudflare. No hay promesa de exactly-once del proveedor; no se reenvían automáticamente resultados inciertos.
- Solo se reintentan rechazos conocidos por límites de Cloudflare: espera de 5 minutos o 24 horas, máximo 5 intentos. Los errores permanentes quedan visibles.
- Límite inicial de la aplicación: 200 intentos diarios y 2.000 mensuales, con días/meses UTC; hasta 10 mensajes por destinatario por hora. Estos topes incluyen alertas internas y reintentos; no cuentan los correos que Supabase envía por SMTP ni otros usos de la cuenta de Cloudflare. Revisar consumo total en Billing antes de aumentar topes.
- Los correos históricos no se envían automáticamente: solo se procesan pending/retry creados desde email_settings.activated_at. pending_configuration queda reservado a la compatibilidad anterior.
- No existe una API pública de enviar correo a destinatarios arbitrarios. Las funciones de despacho solo son ejecutables por service_role. El navegador no recibe esa clave.
- La demo local bloquea cron, eventos y todas las rutas de API externas. Las pruebas usan PostgreSQL en memoria y proveedor simulado, nunca clientes reales.

### Estados

pending_configuration: compatibilidad anterior, requiere revisión antes de recuperar.
pending: preparado. sending: reservado. retry: reintento programado.
accepted: Cloudflare devolvió un identificador. No equivale a entrega.
unknown: no se pudo confirmar el resultado, revisar antes de cualquier reenvío.
error: fallo permanente o intentos agotados. skipped: excluido deliberadamente.
sent: registro heredado del sistema anterior.

Con Event Subscriptions aparecen delivered, deferred, bounced, failed, rejected y complained. delivered significa aceptación por el servidor receptor; no demuestra lectura ni llegada a Recibidos. Los eventos duplicados son idempotentes y un deferred tardío no reemplaza un estado terminal. Se guardan únicamente identificadores, estado y fecha del evento.


Limitación de seguimiento: Cloudflare no publica eventos Email Sending para mensajes clasificados en Email Routing, incluidas entregas a destinos verificados de Routing. La prueba al Gmail del propietario fue uno de esos casos: se consultó el registro oficial emailRoutingAdaptive y se guardó su evidencia. El consumidor automático de Queues permanece activo para los eventos de Email Sending; no hay sincronización automática de Analytics Routing. Si otro correo queda solo en accepted, comprobar ambos registros por messageId antes de decidir cualquier reenvío.

## Plantillas de Supabase Auth

emails/auth/manifest.json contiene asunto y archivo de 13 plantillas: confirmación, invitación, enlace de acceso, cambio de correo, recuperación, reautenticación y siete avisos de seguridad. Los enlaces {{ .ConfirmationURL }} y el código {{ .Token }} se conservan. No se genera un segundo correo de acceso desde el Worker.

Las 13 plantillas ya se publicaron con el CLI oficial y se habilitaron los siete avisos de seguridad. Se verificó una segunda vez que asunto, contenido y activación coinciden con los archivos locales: Nothing to push. El SMTP, los proveedores de acceso, las redirecciones y demás ajustes no declarados se conservaron. Los avisos no habilitan nuevos métodos de acceso; notifican los cambios cuando esos métodos se usan.

Configuración reproducible: emails/auth/supabase/config.toml, generada con scripts/generate-auth-emails.mjs. Revisar con supabase config diff --project-ref kltozglqvivknbdcnnyj --workdir emails/auth. Para una actualización autorizada usar config push con ese mismo proyecto y directorio; nunca usar la configuración de desarrollo completa para reemplazar la remota.

Email Routing habilitado: notificaciones@ermif.com → mlvn696986@gmail.com. El destino consta como verificado y la regla dc90c1a6bbc0434daadb159e9e9c9a3f está activa. Antes de habilitar se comprobó que el dominio no tenía MX ni otro servicio de recepción. El catch-all sigue desactivado. El Reply-To del Worker y los enlaces de contacto también apuntan al Gmail.

Site URL verificada: https://ermif.com; redirects: https://ermif.com, https://ermif.com/ y https://ermif.com/*. Validar el enlace completo con una cuenta propia de prueba, sin compartir el enlace, código o contraseña por chat. El sistema no añade seguimiento de clics a los enlaces de acceso.

## Activación completada — 08/10/2026

El propietario autorizó activar con el respaldo local verificado, sin segunda copia externa. No requiere una nueva autorización para repetir comprobaciones de lectura.

- Migración aplicada mediante Supabase CLI. Ocho triggers, funciones privadas de despacho y tabla de eventos de entrega comprobados. anon y authenticated no pueden despachar; service_role sí.
- Se publicó primero con envío desactivado y después se desplegó la versión 283636ac-e307-48d6-91a2-5871096de064 con EMAIL_MODE=enabled y EMAIL_OUTBOX_VERSION=2.
- Activación de base: 2026-10-09T03:14:44.036292Z (08/10, 22:14 en Lima). Se usó migrations/20261008_activate_transactional_email.sql, que conserva la fecha al repetirse. Los mensajes históricos no se recuperan.
- Dominio ermif.com y www.ermif.com: HTTP 200; /api/admin/legal sin sesión: HTTP 401.
- Colas ermif-email-events y ermif-email-events-dlq, retención de 86400 segundos. Consumidor activo y cron cada cinco minutos.
- Suscripción ae49e91123294a9ea670f60a115eda84 habilitada para los seis eventos de Email Sending del dominio. No duplicar suscripción ni colas.
- Topes: 200 intentos/día, 2000/mes, 10 por destinatario/hora. SMTP de Supabase tiene su propio consumo.
- Prueba única autorizada: system_check:activation-20261009-283636ac, registro 174a9ae9-8a26-4fc1-ac5d-2cf960071f0a, destinatario mlvn696986@gmail.com. Correo de prueba aceptado por Cloudflare el 2026-10-09T03:20:32.824425+00:00 en 1 intento, sin error. Entrega confirmada en Cloudflare emailRoutingAdaptive: delivered el 2026-10-09T03:20:31Z (08/10, 22:20:31 en Lima), con el mismo messageId. Evidencia reconciliada puntualmente en ERMIF; no fue un evento recibido por Queues. No demuestra lectura ni ubicación en Recibidos. No reenviar la prueba.
- Trece plantillas de Auth publicadas y verificadas; recepción del remitente conectada al Gmail verificado.

## Pausa y recuperación

Para detener nuevos despachos: EMAIL_MODE="disabled" y/o email_settings.enabled=false. Una llamada ya enviada a Cloudflare puede finalizar. No desactivar Email Sending del dominio: eso afectaría también al SMTP de Supabase.

Antes de reintentar unknown, buscar en Activity log de Cloudflare y comprobar la hora, destinatario e identificador. Si se aceptó, conservar evidencia y no reenviar. La ausencia inmediata en el panel no prueba que fallara. Solo un operador con evidencia de que no se aceptó puede preparar un nuevo intento; no hay botón de reenvío masivo. Para destinatarios suprimidos o que marcaron spam, respetar las supresiones; no eliminarlas automáticamente.

Mantener las tablas de correo durante una reversión. No borrar expedientes ni aplicar migraciones inversas destructivas. Revisar una política de conservación antes de purgar contenidos de la cola; esta implementación no borra correos históricos.

## Verificación local

npm run validate: sintaxis, secretos reconocidos, pruebas unitarias/SQL y financieras, matriz de fechas y empaquetado dry-run.
npm run email:preview: vistas HTML con datos ficticios en .wrangler/email-previews.
node scripts/generate-auth-emails.mjs: regenera las 13 plantillas locales de acceso/seguridad; no toca Supabase.

## Referencias técnicas

- [API de correo de Cloudflare Workers](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/)
- [Eventos de entrega de Cloudflare](https://developers.cloudflare.com/email-service/platform/event-subscriptions/)
- [Plantillas y avisos de seguridad de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates)
- [PGlite para pruebas PostgreSQL en memoria](https://pglite.dev/docs/)
