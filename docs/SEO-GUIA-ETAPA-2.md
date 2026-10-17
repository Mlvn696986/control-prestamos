# ERMIF · Analítica, conversiones y atribución

Revisión: 17/10/2026. Esta etapa mide captación; no cambia cálculos, planes ni el procesamiento de pagos.

## Configuración de Google Analytics

Propiedad **ERMIF**, ID **559377556**, dentro de la cuenta existente **321599937**. Flujo web **16146568206**, dominio `https://ermif.com`, identificador público **G-12SC7RHS97**. Este identificador no es una contraseña. No se utiliza la propiedad de otro proyecto existente en la cuenta.

Configuración comprobada en la consola:

- Perú, GMT−05:00; moneda PEN; sector Informática y electrónica; empresa de 1 a 10 personas, según respuesta del propietario.
- Medición mejorada automática desactivada. Google Signals y datos proporcionados por usuarios no activados.
- Recogida granular de ubicación/dispositivo desactivada; personalización de anuncios desactivada en las 307 regiones.
- Retención de datos de usuarios y eventos: **2 meses**, sin reinicio por nueva actividad. La retención no limita la mayoría de informes agregados.
- Eventos clave: `sign_up`, `first_client_created`, `first_loan_created`, `subscription_paid`. Recuento por evento, **sin valor monetario predeterminado**.
- No se han vinculado cuentas publicitarias, enviado listas de clientes ni creado secretos de Measurement Protocol.

Entrar en [Google Analytics — ERMIF](https://analytics.google.com/analytics/web/#/a321599937p559377556/admin). Para confirmar estos valores: **Administrar → Detalles de la propiedad**, **Flujos de datos**, **Recogida de datos**, **Conservación de datos** y **Eventos**.

## Qué mide cada evento

| Acción | Evento | Momento y evidencia |
|---|---|---|
| Página permitida | `page_view` | Una vez por carga, tras aceptar Google; ruta y título controlados |
| Crear cuenta gratis | `click_create_account` | Clic en un enlace propio a `/app/?mode=signup` |
| Ver cómo funciona | `click_how_it_works` | Clic en enlace propio a `/como-funciona/` |
| Registro iniciado | `sign_up_start` | Envío del registro por correo o inicio de Google desde la pestaña de registro; no significa cuenta creada |
| Registro confirmado | `sign_up` | Supabase comprueba cuenta nueva confirmada y atribución válida |
| Primer cliente | `first_client_created` | Inserción observada en servidor o reconciliación de un cliente realmente guardado |
| Primer préstamo | `first_loan_created` | Hito persistido por el servidor; no basta abrir el formulario |
| Planes | `view_plans` | Página pública de precios o sección Planes de la aplicación |
| Inicio de suscripción | `begin_subscription` | El servidor devuelve una URL válida de checkout, antes de abrirla |
| Primer pago confirmado | `subscription_paid` | ERMIF ha verificado un pago real aprobado de Mercado Pago; no una vuelta del checkout ni una autorización de suscripción |

`subscription_paid` es un **evento personalizado de primer pago**, no el evento de comercio electrónico `purchase`. No envía importes, artículos ni identificadores de pago; no genera ingresos monetarios en GA4. Nunca interpretar una visita al checkout como una venta.

Los cuatro hitos se devuelven al navegador como booleanos, sin nombres, correo, UID de la cuenta, ID de pago ni información de prestatarios. La emisión a GA4 se deduplica por navegador/atribución con bloqueo entre pestañas cuando está disponible. Si Google está bloqueado, el navegador se cierra o no se vuelve a ERMIF tras pagar, puede faltar el evento en GA4. Un pago tardío se verá en Google cuando el navegador vuelva a sincronizar; la fecha del evento de Google será la de esa observación.

**Fuente principal de conversiones comerciales:** ERMIF → Admin → Captación y conversiones. Su registro confirmado, primer cliente, primer préstamo y primer pago se verifican en servidor. Su informe permanece disponible aunque Google esté bloqueado. Los informes agrupan por primera visita medida de los últimos 30/90/180 días; no son eventos ocurridos únicamente dentro del período ni ingresos netos. Un reembolso no borra el hecho histórico del primer pago.

**Renovaciones:** no se han implementado como conversiones de adquisición. El primer pago es el objetivo de esta etapa. Para analizar retención, la propuesta es un evento separado `subscription_renewed`, emitido exclusivamente desde un registro deduplicado de cada pago recurrente aprobado, con identificador opaco distinto al de Mercado Pago y comprobación de que no es el primer pago. Requiere un módulo de retención y conciliación de reembolsos; no se debe inferir de un segundo inicio de sesión ni reutilizar `subscription_paid`.

## Consentimiento y privacidad

El botón **Medición** permite aceptar la medición propia y, con una casilla adicional inicialmente desmarcada, permitir Google Analytics. Una aceptación anterior de ERMIF **no autoriza automáticamente Google**. Rechazar no impide usar el sistema. Para retirar solo Google: Medición → desmarcar su casilla → Sí, aceptar medición. Para retirar ambas: Continuar sin medición.

Antes de permitir Google no se carga ni el módulo opcional `measurement.js` ni la etiqueta externa. La implementación utiliza el modelo de consentimiento básico: no se envían pings sin consentimiento. Las opciones de publicidad se mantienen denegadas. Retirarlo deshabilita nuevos envíos y elimina las cookies de esta propiedad en el navegador; no borra automáticamente datos que Google ya recibió.

La propia medición conserva únicamente el ID aleatorio, ruta permitida y categorías cerradas de origen, medio, campaña y enlace. Se mantiene su retención de 180 días y revocación existentes. Los hitos locales de deduplicación se dejan de utilizar al expirar y se limpian en la siguiente visita. La política pública se genera a partir de `index.html`, por lo que la ventana interna y `/privacidad/` comparten el texto actualizado.

Google recibe necesariamente datos técnicos de conexión del navegador cuando se permite su etiqueta. No afirmar que este sistema es anónimo o que Google no recibe ninguna información técnica. No se usa User-ID, correo ni identificadores de préstamos. Se excluyen URLs privadas, parámetros arbitrarios, fragmentos, callbacks con tokens, documentos, nombres, teléfonos y valores de préstamos. Las demos locales no cargan Google ni envían medición a producción.

## Usar enlaces UTM

Ejemplo de una publicación educativa en Facebook:

```text
https://ermif.com/como-funciona/?utm_source=facebook&utm_medium=social&utm_campaign=contenido-educativo&utm_content=video-demo
```

| Campo | Para qué sirve | Valores admitidos |
|---|---|---|
| `utm_source` | Dónde se publicó | `directo`, `google`, `bing`, `duckduckgo`, `chatgpt`, `facebook`, `instagram`, `tiktok`, `youtube`, `linkedin`, `whatsapp`, `email`, `otro` |
| `utm_medium` | Tipo de tráfico | `direct`, `organic`, `paid_search`, `paid_social`, `social`, `email`, `referral`, `other` |
| `utm_campaign` | Iniciativa comercial | `lanzamiento-ermif`, `contenido-educativo` |
| `utm_content` | Qué enlace o pieza | `menu`, `portada`, `precios`, `video-demo`, `guia`, `calculadora`, `enlace-perfil` |

Sin UTM, ERMIF clasifica referentes conocidos: Google/Bing como búsqueda orgánica; redes como social; `chatgpt.com` y `chat.openai.com` como ChatGPT/referencia. Los referentes pueden faltar: una visita directa no demuestra que la persona no viniera de otra plataforma. No se puede identificar todo el tráfico de IA.

Los valores desconocidos se descartan o agrupan como Otro; nunca se guarda texto libre de campaña. No poner nombres, DNI o correos en enlaces. No agregar UTM a la navegación interna: alteraría la lectura de sesiones en Google. La atribución propia conserva la primera visita consentida y no la sobrescribe al visitar otra campaña. El alta se vincula únicamente si se confirma una cuenta nueva elegible en ese navegador dentro de 30 días. Otro dispositivo o el almacenamiento borrado pueden perder la atribución.

## Archivos y publicación

- `public/acquisition.js`: consentimiento propio y adicional para Google, clasificación, preservación de primera entrada y vinculación autenticada.
- `public/measurement.js`: módulo opcional centralizado; únicos eventos y parámetros que se envían a GA4.
- `app.js`: llamadas puntuales en registro, guardado, planes y checkout; sin cambiar las operaciones originales.
- `src/acquisition.js`: RPC v2 y validación de categorías. El token de sesión solo se envía al backend propio.
- `supabase-acquisition-attribution-v2.sql`: actualización acotada; `supabase-acquisition.sql` conserva la definición para instalaciones nuevas.
- `public/acquisition-admin.js`: primer cliente y desglose de enlaces en el informe agregado.
- `index.html` y `public/acquisition.css`: información de privacidad y casilla de elección.

La migración v2 se aplicó el 17/10/2026 después de un respaldo privado del módulo de adquisición: cinco tablas, definiciones de funciones/privilegios, restricciones y triggers. Se comprobó el SHA256 de la copia; es **un respaldo acotado, no de toda la base**. La revisión posterior conservó las dos visitas existentes, confirmó las nuevas columnas y el trigger único. Las nuevas RPC rechazan ejecución directa de `anon` y `authenticated`; solo el backend puede utilizarlas. No se modificaron filas de clientes, préstamos o pagos para probar conversiones.

Orden: pruebas → respaldo → SQL v2 → validación/build → revisión y publicación de código → comprobación pública. Para revertir la interfaz, retirar la carga de Google y volver al cliente anterior; las RPC antiguas permanecen compatibles. No borrar tablas ni restaurar la base completa para desactivar analítica.

## Cómo comprobar y corregir problemas

1. Abrir una página pública sin consentimiento: no debe cargar Google. Aceptar la medición propia dejando la casilla vacía debe mantener ese resultado.
2. Permitir Google expresamente, abrir Inicio y Precios, y consultar **Informes → Tiempo real** en la propiedad ERMIF. Los informes habituales pueden tardar 24–48 horas. No simular altas, pagos ni clientes en producción para llenar gráficas.
3. Revisar **Administrar → Eventos**: los cuatro hitos deben aparecer como eventos clave. Un evento configurado sin datos no demuestra una conversión recibida.
4. En ERMIF, **Admin → Captación y conversiones → Actualizar medición**. Comprobar el origen de nuevas visitas consentidas y sus hitos reales. Las cifras de GA4 y del informe propio no tienen por qué coincidir: consentimiento adicional, cobertura, fechas y atribución son diferentes.
5. Si no hay datos: comprobar propiedad/ID correctos, consentimiento adicional, bloqueador y URL sin callback. Un rechazo voluntario no es un fallo. No activar medición automática o deshabilitar privacidad para aumentar las cifras.
6. Si el backend responde 503: comprobar el estado de Supabase, las RPC v2 y el limitador. Si hay 401/403, corregir sesión/permisos; no abrir las tablas a usuarios anónimos. En caso de fallo, ERMIF debe seguir funcionando.
7. Si una campaña figura como Otro: usar los valores de la tabla. Para ampliar campañas, modificar las listas de cliente, backend y SQL, probar y migrar antes de publicar.

No prometer medición total ni resultados retroactivos. El siguiente trabajo de captación es revisar las páginas y enlaces públicos antes de crear herramientas o guías; la medición permitirá valorar sus registros y primeros pagos con datos reales.

## Fuentes oficiales consultadas

- [Consentimiento básico y avanzado](https://developers.google.com/tag-platform/security/concepts/consent-mode).
- [Configuración de la etiqueta GA4](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).
- [Eventos recomendados y personalizados](https://developers.google.com/analytics/devguides/collection/ga4/events).
- [Referencia de eventos](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).
- [Retención de datos](https://support.google.com/analytics/answer/7667196).
- [Measurement Protocol y sus límites](https://developers.google.com/analytics/devguides/collection/protocol/ga4): una futura entrega desde servidor necesita consentimiento, deduplicación y contexto válido; no sustituirla por peticiones ficticias.
