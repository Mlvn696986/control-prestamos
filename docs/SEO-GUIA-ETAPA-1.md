# ERMIF · Guía de configuración y comprobación SEO — etapa 1

Fecha de preparación: 17 de octubre de 2026. Dominio principal: **https://ermif.com/**.

Esta guía es un **procedimiento de consulta** para futuras comprobaciones. El estado real de las tareas, sus resultados y evidencias se registra únicamente en [SEO-CHECKLIST.md](SEO-CHECKLIST.md). **No repetir altas ni verificaciones ya realizadas**: usar las propiedades existentes y consultar primero ese registro. Los nombres de algunos menús pueden variar según idioma, plan o actualización.

## Qué significa cada resultado

| Resultado | Qué demuestra | Qué no demuestra |
|---|---|---|
| Propiedad verificada | La cuenta puede administrar esa propiedad. | Que sus páginas estén indexadas. |
| Sitemap procesado | El buscador pudo leer la lista de URLs. | Que haya indexado todas. |
| Prueba de URL publicada satisfactoria | El comprobador puede obtener y analizar la página actual. | Que Google la elija como canónica o la indexe. |
| URL indexada | El buscador tiene esa URL en su índice. | Una posición, tráfico o ventas garantizados. |

Estas distinciones están documentadas en [Sitemaps](https://support.google.com/webmasters/answer/7451001?hl=es) e [Inspección de URLs](https://support.google.com/webmasters/answer/9012289?hl=es).

## 1. Verificar ERMIF en Google Search Console

**Qué y por qué:** demostrar el control del dominio para consultar datos y problemas de Google. **Cambio:** añadir un TXT de verificación; no modifica el diseño ni los correos.

1. Entrar en [Search Console](https://search.google.com/search-console/) con la cuenta propietaria. Revisar primero si ya existe una propiedad verificada de ERMIF.
2. Si falta, abrir el selector de propiedades → **Añadir propiedad → Dominio**. Escribir `ermif.com`, sin protocolo, barras ni `www`.
3. Para el método manual, seleccionar **Cualquier proveedor de DNS**, elegir **TXT** y copiar el valor completo que Google proporciona. Nunca inventar el código ni reutilizar uno de otra cuenta.
4. En Cloudflare, seleccionar **ermif.com → DNS → Records/Registros → Add record/Añadir registro**:

| Campo | Valor que debe introducirse |
|---|---|
| Tipo | TXT |
| Nombre | `@` |
| Contenido | El valor real y completo de Search Console |
| TTL | Auto |

5. Guardar como registro adicional y volver a Google → **Verificar**. Conservar el TXT después de verificar.

**Comprobación:** mensaje de propiedad verificada y acceso a sus informes. **Error habitual:** TXT no encontrado o diferente; revisar dominio, copia exacta y proveedor DNS autoritativo con la [consulta DNS de Google](https://toolbox.googleapps.com/apps/dig/). Si todavía no se propaga, esperar y reintentar; puede tardar uno o dos días. **Siguiente:** enviar el sitemap.

Fuentes: [propiedad de dominio](https://support.google.com/webmasters/answer/34592?hl=es), [verificación y problemas](https://support.google.com/webmasters/answer/9008080?hl=es), [añadir registros en Cloudflare](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

## 2. Enviar el sitemap a Google

**Qué y por qué:** informar dónde está la lista de páginas públicas. **Cambio:** registrar su dirección en la consola; no subir un archivo nuevo a Google.

1. Seleccionar la propiedad de ERMIF → **Indexación → Sitemaps**.
2. En **Añadir un sitemap**, introducir `https://ermif.com/sitemap.xml` y pulsar **Enviar**. Si el campo ya muestra el prefijo del sitio, escribir solo `sitemap.xml`.
3. Abrir la fila enviada y registrar estado, última lectura y páginas descubiertas.

**Comprobación:** estado **Correcto** y lectura reciente. La referencia de esta etapa contiene siete páginas públicas; contrastar con el sitemap actual, no con una cifra fija para siempre.

**Error habitual:** “No se ha podido obtener”. Revisar URL exacta, respuesta pública sin login y ausencia de errores HTTP. Si devuelve HTML, corregir el enrutamiento; si el XML tiene errores, corregir el archivo. Volver a enviar tras resolver el problema. **Siguiente:** inspeccionar páginas concretas. [Guía oficial de sitemaps](https://support.google.com/webmasters/answer/7451001?hl=es).

## 3. Inspeccionar páginas y comprobar la versión canónica

**Qué y por qué:** conocer el estado real de cada página importante. “Canónica” es la URL principal que representa su contenido. **Cambio:** solo diagnóstico y, cuando proceda, una solicitud de indexación.

1. Pegar en la barra superior `https://ermif.com/`; repetir con `/precios/` y `/como-funciona/`, y después con el resto del sitemap.
2. Revisar **Indexación de páginas**: último rastreo, obtención, permiso de indexación y canónicas declarada y seleccionada por Google.
3. Pulsar **Probar URL publicada** si la versión ha cambiado o hay un problema. Revisar también el HTML y la captura disponibles.
4. Si la página pública está preparada y falta o cambió, pulsar **Solicitar indexación** una vez.

**Comprobación:** guardar por separado el estado indexado y la prueba actual. La canónica esperada es la URL HTTPS sin `www` de esa página, no siempre la portada. Google solo informa su selección en los datos indexados.

**Error habitual:** confundir “disponible para Google” con “indexada”. La prueba en vivo no garantiza indexación. **Siguiente:** interpretar el motivo concreto si no está indexada. [Inspección de URLs de Google](https://support.google.com/webmasters/answer/9012289?hl=es).

## 4. Interpretar exclusiones y corregir únicamente problemas reales

**Qué y por qué:** separar las páginas que deben aparecer de las que deben quedar fuera. **Cambio:** corregir solo una exclusión accidental.

| Motivo o URL | Acción adecuada |
|---|---|
| `/app/` excluida por `noindex` | Conservar: la aplicación no es una página comercial. |
| www o una dirección antigua con redirección | Confirmar que conduce a la canónica correcta. |
| Dirección inventada con 404 | Conservar el 404. No convertirla en una página válida. |
| Página comercial existente con 404, bloqueo o `noindex` | Corregir la causa y comprobar de nuevo. |
| Duplicada con otra canónica | Revisar canónica elegida, enlaces, sitemap y redirecciones. |
| Descubierta/rastreada, actualmente sin indexar | Revisar descubrimiento, contenido y duplicación; no demuestra por sí sola un fallo de servidor. |

**Acción:** **Indexación → Páginas → motivo → URL de ejemplo**. **Comprobación:** inspeccionar la URL afectada y su versión actual. **Error habitual:** intentar eliminar todas las exclusiones. Solo usar **Validar corrección** después de corregir todos los casos de un problema real. **Siguiente:** seguimiento del resultado, sin solicitudes repetitivas. [Informe de indexación de páginas](https://support.google.com/webmasters/answer/7440203?hl=es).

## 5. Verificar ERMIF en Bing Webmaster Tools

**Qué y por qué:** obtener información de rastreo e indexación de Bing. **Cambio recomendado:** un CNAME de verificación independiente, sin conectar las demás propiedades de Google.

1. Entrar en [Bing Webmaster Tools](https://www.bing.com/webmasters/), comprobar si ERMIF ya está verificado y, si falta, elegir **Añadir sitio manualmente**.
2. Introducir `https://ermif.com/` y seleccionar la verificación mediante **CNAME**.
3. En **Cloudflare → ermif.com → DNS → Registros → Añadir registro**, elegir CNAME. Copiar exactamente el nombre y el destino mostrados por Bing, TTL Auto y **DNS only/Solo DNS**. Guardar sin sustituir los registros de la web.
4. Volver a Bing y pulsar **Verificar**. Conservar el registro de verificación.

**Comprobación:** propiedad verificada en Bing. **Error habitual:** CNAME incorrecto, con proxy o aplanamiento que impide consultar el destino. Revisar ambos valores y la propagación antes de reintentar. [Alta en Bing](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b), [verificación CNAME en Cloudflare](https://developers.cloudflare.com/dns/manage-dns-records/troubleshooting/cname-domain-verification/).

**Alternativa opcional:** importar desde Search Console. Requiere autorizar acceso a información de esa cuenta; Bing muestra propiedades verificadas, permisos y sitemaps para seleccionar qué importar y vuelve a comprobar la propiedad. Leer el alcance del permiso antes de aceptarlo. La vinculación puede desconectarse desde el perfil. **Siguiente:** comprobar el sitemap de Bing, incluso si fue importado.

## 6. Sitemap e inspecciones en Bing

**Qué y por qué:** confirmar que Bing descubre y puede examinar las páginas. **Cambio:** enviar el sitemap si aún no aparece.

1. Seleccionar ERMIF → **Sitemaps**. Buscar `https://ermif.com/sitemap.xml`; si falta, usar **Submit sitemap/Enviar sitemap** con esa URL.
2. Consultar procesamiento, errores y cobertura. No interpretar URLs descubiertas como URLs indexadas. [Sitemaps y descubrimiento en Bing](https://blogs.bing.com/webmaster/2025/7/Keeping-Content-Discoverable-with-Sitemaps-in-AI-Powered-Search/).
3. Abrir **URL Inspection/Inspección de URL** y examinar portada, precios y cómo funciona. La tarjeta **Index** muestra información del índice; **Live URL** comprueba la respuesta actual. [Inspección oficial de Bing](https://www.bing.com/webmasters/help/URL-Inspection-55a30305).

**Comprobación:** guardar estado del sitemap y resultados de ambas inspecciones. **Error habitual:** archivo inaccesible, HTML en vez de XML o página bloqueada; resolver la causa indicada antes de repetir. **Siguiente:** revisar bloqueos de rastreadores si las pruebas los señalan.

## 7. Revisar Cloudflare sin abrir accesos innecesarios

**Qué y por qué:** evitar que una regla de seguridad impida rastrear páginas públicas. **Cambio:** solo una excepción concreta si existe un bloqueo comprobado; no desactivar toda la protección.

1. Reproducir una inspección desde Google o Bing y anotar hora y URL.
2. En Cloudflare, abrir los **eventos de seguridad** de ERMIF y buscar la solicitud, acción y regla coincidentes. Revisar también los controles de bots disponibles en la cuenta.
3. Confirmar la identidad: una cabecera `User-Agent: Googlebot` se puede falsificar. Usar la señal de bot verificado de Cloudflare o validar la IP con las listas oficiales/DNS inverso y directo del proveedor. [Verificar solicitudes de Google](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests).
4. Si una regla bloquea rastreadores legítimos, ajustar esa regla para páginas públicas y bots verificados. `cf.client.bot` permite identificar bots conocidos en reglas compatibles; la disponibilidad de controles depende del producto y plan. [Ejemplo oficial de Cloudflare](https://developers.cloudflare.com/waf/custom-rules/use-cases/allow-traffic-from-verified-bots/).

**Comprobación:** repetir la inspección y contrastar eventos. **Error habitual:** dar permiso a cualquiera cuyo nombre contenga “bot”. Una petición simulada solo prueba una respuesta HTTP, no el acceso del rastreador auténtico. **Siguiente:** registrar la regla y la evidencia del resultado; mantener la autenticación de datos privados.

## 8. Distinguir búsqueda con IA de entrenamiento

**Qué y por qué:** decidir para qué se permite rastrear el contenido público. **Cambio:** ninguno automático; revisar la política efectiva del sitio y Cloudflare.

`OAI-SearchBot` participa en la búsqueda de ChatGPT; `GPTBot` sirve para contenido que podría utilizarse en entrenamiento. Sus controles son independientes: permitir búsqueda no exige permitir entrenamiento. [Documentación oficial de OpenAI](https://developers.openai.com/api/docs/bots).

**Acción:** revisar `robots.txt` y las políticas de bots de Cloudflare, distinguiendo búsqueda, agentes y entrenamiento. La configuración de seguridad puede bloquear aunque robots permita. [Políticas de bots de IA de Cloudflare](https://developers.cloudflare.com/bots/additional-configurations/block-ai-bots/).

**Comprobación:** robots efectivo más eventos de solicitudes auténticas cuando existan. **Error habitual:** interpretar HTTP 200 con un nombre de bot simulado como prueba de acceso real o de aparición en respuestas. **Siguiente:** guardar la decisión; ninguna configuración garantiza citas o recomendaciones.

## 9. Crear una referencia de rendimiento sin inventar Core Web Vitals

**Qué y por qué:** medir antes de afirmar que una página es rápida o lenta. **Cambio:** ninguno en esta comprobación.

1. Guardar el diagnóstico público junto con fecha, URLs y condiciones; la referencia HTTP de esta etapa está en [seo-baseline-2026-10-17.json](seo-baseline-2026-10-17.json).
2. Abrir [PageSpeed Insights](https://pagespeed.web.dev/) para portada, precios y cómo funciona. Guardar enlace/resultado móvil y escritorio, fecha y separación entre datos de campo y laboratorio.
3. En Search Console → **Experiencia → Core Web Vitals**, consultar los grupos de URLs y LCP, INP y CLS. Los datos reflejan visitas reales durante una ventana de 28 días. [Informe oficial](https://support.google.com/webmasters/answer/9205520?hl=es).

**Comprobación:** valores medidos y contexto. **Error habitual:** “sin datos suficientes” no significa aprobado ni fallido; tiempos HTTP y tamaño de archivos tampoco son Core Web Vitals. **Siguiente:** priorizar una mejora por su evidencia y volver a medir en condiciones comparables. No atribuir ganancias de posicionamiento a una puntuación aislada.

## 10. Evaluar IndexNow después de la configuración básica

**Qué y por qué:** avisar a motores participantes de páginas añadidas, modificadas o eliminadas. **Cambio posterior:** generar una clave y servir su archivo de verificación, conectando avisos al despliegue de páginas públicas.

**Acción:** completar primero las consolas y sitemaps. Si se implementa, enviar únicamente URLs públicas realmente cambiadas; nunca fichas de clientes, rutas privadas ni parámetros personales. Mantener el sitemap. [Protocolo IndexNow](https://www.indexnow.org/documentation).

**Comprobación:** HTTP 200 confirma recepción; 202 indica clave pendiente de verificación. **Error habitual:** confundir recepción con indexación. **Siguiente:** comprobar el índice y errores en Bing; no realizar envíos repetitivos para intentar forzar posicionamiento. [Preguntas frecuentes oficiales](https://www.indexnow.org/faq).

## Rutina propuesta de mantenimiento

Esta frecuencia es una propuesta de operación para ERMIF, no un requisito de los buscadores.

| Frecuencia | Qué revisar | Acción y comprobación |
|---|---|---|
| Tras una publicación pública | HTTP, canonical, sitemap, robots, enlaces y recursos | Ejecutar el diagnóstico; inspeccionar páginas afectadas si el cambio lo justifica. |
| Semanal | Errores nuevos, sitemap, indexación de páginas principales y bloqueos | Registrar causa, responsable y estado; distinguir informe antiguo de prueba actual. |
| Mensual | Consultas y páginas con impresiones/clics en Google y Bing | Comparar periodos equivalentes; relacionar con registros, activación y pagos medidos con consentimiento, señalando su cobertura. |
| Trimestral | Propietarios y permisos, DNS de verificación, páginas públicas y rendimiento | Confirmar accesos legítimos, contactos y precios vigentes; repetir la referencia técnica y de rendimiento. |

Si no hay datos, anotarlo como “sin datos suficientes”; no convertirlo en cero ni en éxito. La siguiente acción debe responder al problema observado, no a una lista de cambios indiscriminados.

## Dónde registrar los resultados

Mantener los estados y las evidencias en [SEO-CHECKLIST.md](SEO-CHECKLIST.md), sin duplicar una lista de pendientes en esta guía. Anotar fecha, acción, resultado observado y siguiente comprobación, sin copiar tokens DNS, contraseñas ni datos de clientes.

Las verificaciones ya realizadas no deben repetirse: conservar las propiedades y sus registros DNS y continuar con las comprobaciones de los pasos siguientes. Consultar el checklist para el estado actualizado de cada sitemap. Un estado **Processing/En procesamiento** requiere comprobar el resultado posterior, no repetir el alta del sitio.

Completar la configuración permite medir y detectar problemas. **La indexación, el posicionamiento y las ventas deben comprobarse después; no se dan por conseguidos al finalizar esta guía.**
