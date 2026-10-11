# Correos automáticos de ERMIF

Actualizado: 11 de octubre de 2026, hora de Lima.

## Estado confirmado

El propietario activó Cloudflare Email Sending para ermif.com. Sus capturas muestran Sending Enabled y DNS Configured. Configuró Supabase SMTP con smtp.mx.cloudflare.net, puerto 465, usuario api_token y su token directamente en el panel. Un correo de recuperación llegó; Gmail mostró SPF, DKIM y DMARC PASS. Una segunda prueba con la plantilla en español apareció en Recibidos. Esto comprueba esas pruebas, no garantiza la ubicación de futuros correos. El propietario también confirmó la recuperación completa: enlace, cambio de contraseña e inicio de sesión.

Los remitentes y Reply-To de la aplicación se eligen según el evento (tabla siguiente). Las alertas internas y los mensajes entrantes llegan a mlvn696986@gmail.com, confirmado por el propietario. Alcance: correos de ERMIF, sin recordatorios a deudores ni campañas comerciales.

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

Email Routing habilitado para las seis direcciones de la tabla siguiente → mlvn696986@gmail.com. El destino está verificado. La regla original de notificaciones se conserva y el catch-all sigue desactivado. Cada respuesta a un mensaje departamental usa el mismo correo del departamento; el Gmail queda como destino interno.

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


## Direcciones por área — 11/10/2026

| Dirección | Recepción | Envíos de ERMIF |
| --- | --- | --- |
| reclamaciones@ermif.com | Consultas y respuestas sobre reclamaciones | Constancia y respuesta guardada en el panel |
| privacidad@ermif.com | Datos personales, derechos ARCO y eliminación | Recepción, respuesta y cambios del expediente de eliminación |
| facturacion@ermif.com | Suscripción, cobros y comprobantes | Cambios del estado, plan o periodo de la suscripción; no emite comprobantes |
| ventas@ermif.com | Planes y demostraciones | Sin campaña ni respuesta automática |
| seguridad@ermif.com | Accesos sospechosos y reportes de fallos | Sin respuesta automática |
| notificaciones@ermif.com | Contacto general y respuestas de acceso | Auth de Supabase, alertas internas y comprobaciones técnicas |

Las seis direcciones reenvían al Gmail del propietario. No son seis buzones independientes ni tienen contraseñas separadas. Las consultas por email no crean expedientes en ERMIF: los formularios de la web mantienen su registro y seguimiento propios. No se ha añadido un contestador automático.

En la aplicación, el evento guardado determina From, Reply-To y contacto del pie del mensaje. El payload del usuario no puede elegirlos. Las plantillas operativas pasan a la versión 3; la cola y sus límites conservan la versión 2. El binding del Worker permite únicamente los cuatro remitentes que usa la aplicación (notificaciones, reclamaciones, privacidad y facturacion). Las plantillas y el remitente de Supabase Auth no cambian.

Los contactos se muestran en los términos, el Libro de Reclamaciones, la política de privacidad y la ventana de suscripción.

### Comprobación de las nuevas direcciones

El 11/10/2026 se verificaron las cinco reglas activas y se enviaron exactamente cinco pruebas autorizadas, una desde y hacia cada dirección. Cloudflare confirmó delivered para cada messageId tanto en Email Sending como en Email Routing hacia el destino verificado. Esto confirma transporte y reenvío, no lectura ni carpeta de Gmail. Las pruebas fueron por la API del proveedor, no crearon reclamaciones ni expedientes ni usaron la cola de producción. No reenviarlas.

### Responder manualmente desde Gmail

El reenvío está configurado en Cloudflare. No configura por sí solo la opción «Enviar como» de Gmail: sin ella, una respuesta manual muestra el Gmail del propietario.

Disponibilidad: Google anuncia que «Enviar como» para cuentas de terceros dejará de estar disponible en enero de 2027 y que limitará nuevas configuraciones antes de esa fecha. No se presenta como solución permanente para ERMIF. Fuente: https://support.google.com/mail/answer/17101213 . El reenvío entrante de Cloudflare y los envíos de ERMIF no dependen de esta función. Para atención manual duradera habrá que elegir un cliente o buzón que admita el remitente del dominio.

Si la opción todavía está disponible, para cada dirección que se quiera utilizar al responder:
1. Gmail → Configuración → Ver todos los ajustes → Cuentas e importación → Enviar como → Añadir otra dirección de correo.
2. Introducir el nombre de ERMIF y la dirección elegida.
3. Servidor SMTP: smtp.mx.cloudflare.net; puerto 465; conexión SSL; usuario literal api_token.
4. Introducir de forma privada un token de Cloudflare con permiso Email Sending: Edit como contraseña SMTP. No usar la contraseña de Gmail ni la de Supabase, ni copiar el token al código o al chat.
5. Completar la verificación que Gmail envíe a esa dirección, recibida por el reenvío.
6. Elegir «Responder desde la misma dirección a la que se ha enviado el mensaje» y comprobar el campo «De» antes de responder.

Esta configuración manual de Gmail no se ha aplicado desde el proyecto. No se crean ni se recuperan tokens SMTP del usuario.

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
