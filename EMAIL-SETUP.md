# Configuracion de Correos Transaccionales de ERMIF

Estado actual: no existe un transporte real de email confirmado en el proyecto.

El sistema ahora prepara eventos de correo en `email_outbox`, pero no marca correos como enviados si no existe confirmacion real de envio.

## Eventos preparados

- `claim_received:{claimId}`: constancia de recepcion del Libro de Reclamaciones.
- `claim_response:{claimId}:{responseVersion}`: respuesta oficial al consumidor.
- `privacy_received:{privacyRequestId}`: recepcion de solicitud de privacidad.
- `account_deletion_received:{requestId}`: recepcion de solicitud de eliminacion de cuenta.

## Estados

- `pending_configuration`: falta transporte de correo.
- `pending`: listo para enviar cuando exista proveedor.
- `sent`: enviado con confirmacion real.
- `error`: intento fallido.
- `skipped`: no corresponde enviar.

## Que falta configurar

Elegir y autorizar un proveedor de correo transaccional o implementar un backend propio con credenciales seguras. No usar Google OAuth como si fuera transporte de correos. No colocar claves de correo en `app.js`, `index.html` ni `supabase-config.js`.

Variables esperadas para una integracion futura:

- `EMAIL_TRANSPORT`
- `EMAIL_API_KEY`
- Remitente verificado
- Plantillas de recepcion y respuesta

Hasta configurar esto, ERMIF registra reclamos y respuestas, conserva evidencia interna y muestra el correo como pendiente de configuracion.
