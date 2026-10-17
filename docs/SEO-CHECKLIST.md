# ERMIF · Estado y administración SEO

Última revisión: **17 de octubre de 2026**, America/Lima. Etapa actual: **3 — páginas comerciales y navegación**. Este archivo registra resultados comprobados; las guías de cada etapa contienen instrucciones, errores habituales y fuentes oficiales.

ERMIF es software para administrar préstamos; no otorga préstamos. Una configuración correcta permite el rastreo y la medición, pero no garantiza indexación, posiciones, citas en IA ni ventas.

## Estado de la etapa 1

- [x] Comprobación rápida de las correcciones técnicas anteriores: **17 verificaciones HTTP aprobadas, 0 fallos**. [Evidencia fechada](seo-baseline-2026-10-17.json), capturada a las 00:53 de Lima.
- [x] Google Search Console: propiedad **Dominio `ermif.com`**, verificada mediante TXT adicional en Cloudflare.
- [x] Sitemap enviado a Google: **Correcto**, última lectura 17/10/2026, **7 páginas descubiertas**.
- [x] Portada, Precios y Cómo funciona: pruebas de URL publicada de Google satisfactorias y solicitudes de indexación confirmadas.
- [x] Bing Webmaster Tools: sitio `https://ermif.com/` verificado mediante CNAME adicional, **Solo DNS**.
- [x] Sitemap enviado y procesado por Bing: **Success**, última lectura 17/10/2026, **7 URLs descubiertas**, sin errores ni advertencias en el panel.
- [x] Portada, Precios y Cómo funciona: pruebas **Live URL** de Bing satisfactorias y solicitudes de indexación confirmadas.
- [x] Cloudflare: revisados controles de rastreadores, métricas y muestra de eventos de seguridad.
- [x] OAI-SearchBot revisado separadamente de GPTBot. No se modificó la política de entrenamiento.
- [x] Validador manual reutilizable y guía de mantenimiento incorporados al proyecto.
- [ ] Confirmar indexación efectiva de todas las páginas públicas. Las solicitudes enviadas no completan este punto.
- [ ] Obtener informes disponibles de consultas, clics, impresiones y exclusiones; actualmente están procesándose.
- [ ] Disponer de datos suficientes de Core Web Vitals y medir laboratorio antes de optimizar rendimiento.

Conservar ambos registros DNS de verificación. No se sustituyeron registros de correo ni de la web. Sus valores no se copian a esta documentación. No repetir el alta de las propiedades.

## Estado de la etapa 2

- [x] Propiedad GA4 **ERMIF 559377556**, flujo web **16146568206**, etiqueta **G-12SC7RHS97**; Perú/PEN/empresa de 1 a 10 personas comprobados.
- [x] Medición mejorada y datos granulares desactivados; Signals no activado; personalización de anuncios no permitida en ninguna región; retención de usuarios/eventos de 2 meses sin prolongación por actividad.
- [x] Cuatro eventos clave creados sin valor monetario predeterminado: registro, primer cliente, primer préstamo y primer pago.
- [x] Código centralizado para diez eventos, consentimiento adicional para Google inicialmente desmarcado y carga solo después de autorizarlo.
- [x] ChatGPT, página Seguridad y categorías cerradas de utm_content incorporadas; primera atribución preservada.
- [x] Respaldo acotado del módulo verificado; migración v2 aplicada; RPC exclusivas del servidor y dos visitas existentes preservadas.
- [x] Validación completa de código/build y pruebas financieras, de privacidad, atribución y PostgreSQL.
- [x] Publicación verificada y **una visita de comprobación recibida en Tiempo real de Google**; `page_view` y eventos técnicos visibles. Consentimiento y retirada comprobados en producción. No confundir esta visita con una conversión comercial.
- [x] **17 comprobaciones HTTP aprobadas después de publicar**, sin fallos; [evidencia de la etapa 2](seo-stage2-2026-10-17.json).
- [ ] Observar registros y pagos reales futuros; no se generaron conversiones ficticias en producción.
- [ ] Renovaciones: propuesta de módulo de retención separada; no implementadas ni confundidas con primeros pagos.

La [guía de la etapa 2](SEO-GUIA-ETAPA-2.md) explica cada evento, cobertura, UTM, archivos modificados, comprobaciones, errores y límites. El informe de ERMIF es la fuente de los hitos comerciales verificados; Google depende además de su consentimiento específico y del navegador.

## Estado de la etapa 3

- [x] Comprobación previa: 17 verificaciones HTTP correctas, sin regresiones de las correcciones anteriores.
- [x] Investigación cualitativa de intención y proveedores, sin inventar volúmenes de búsqueda ni copiar promesas comerciales.
- [x] Páginas de control de cobranzas, gestión de ampliaciones y reclamaciones con contenido propio, ejemplos ficticios identificados y metadatos completos.
- [x] Portada más explícita; enlaces contextuales y navegación pública; sitemap ampliado a diez documentos reales.
- [x] Ampliación coherente de rutas permitidas en cliente, servidor y migración SQL; conservación de primera atribución y consentimiento.
- [x] Revisión visual de móvil, tablet y escritorio; apertura del formulario actual de reclamaciones sin enviar datos.
- [x] Validación completa: 177 pruebas, 175 aprobadas, 0 fallos y 2 omitidas; cálculos financieros, calendario y build/dry-run correctos.
- [x] Migración v3 aplicada tras respaldo privado verificado; rutas nuevas admitidas, RLS activo y ejecución de la RPC limitada al servidor. Dos visitas existentes conservadas.
- [ ] Publicación y verificación HTTP en el dominio de las diez páginas.
- [ ] Solicitudes de descubrimiento o indexación de las páginas nuevas, con estado observado en consola.
- [ ] Confirmar indexación y medir impresiones, clics, registros y primeros pagos reales cuando haya datos.

La [guía de etapa 3](SEO-GUIA-ETAPA-3.md) documenta intención, recorrido, archivos, publicación, comprobación y resolución de errores. Herramientas y guías se publicarán con recursos útiles completos en la siguiente etapa.

## Resultados observados por página en la etapa 1

| Página | Google: información del índice | Google: prueba actual | Bing: información del índice | Bing: prueba actual |
|---|---|---|---|---|
| `/` | **Indexada**; último rastreo informado 12/10/2026, anterior a los últimos cambios | Disponible e indexable; canonical declarada `https://ermif.com/` | Informe previo: no indexada por redirección | **Puede indexarse**, sin incidencias SEO detectadas por la prueba |
| `/precios/` | Descubierta, actualmente sin indexar | Disponible e indexable; un elemento válido de rutas de exploración | Descubierta, sin rastrear | **Puede indexarse** |
| `/como-funciona/` | Descubierta, actualmente sin indexar | Disponible e indexable; un elemento válido de rutas de exploración | Descubierta, sin rastrear | **Puede indexarse** |

Se solicitó indexación **una vez por URL en cada buscador**. Las otras cuatro páginas están incluidas en el sitemap; no se afirma haber inspeccionado individualmente su índice. El estado puede cambiar después de esta fecha.

**Diferencia histórica de la portada:** Google conservaba una copia sin canonical declarada; la prueba actual sí encuentra la canonical correcta. Bing conservaba un resultado de redirección; tanto su prueba actual como la comprobación HTTP obtienen una página indexable. La acción adecuada es permitir el nuevo rastreo y revisar el índice, no cambiar nuevamente una ruta que ahora responde correctamente.

## Línea base técnica y sus límites

El comando `npm run seo:check` hace solicitudes públicas de lectura. Para guardar evidencia desde PowerShell:

```powershell
. .\scripts\dev-env.ps1
node scripts/check-seo-live.mjs --output docs/seo-baseline-YYYY-MM-DD.json
```

Si todas las solicitudes fallan por restricciones de red del entorno, habilitar la ejecución autorizada con red y repetir; ese resultado por sí solo no demuestra una caída del sitio. No guardar como evidencia de producción una ejecución bloqueada localmente.

| Corrección anterior | Resultado de esta revisión |
|---|---|
| Portada comercial | HTML público con contenido, navegación y llamadas a la acción; revisión del generador y pruebas existentes |
| Robots y sitemap | Texto y XML reales, HTTP 200; siete URLs canónicas, sin rutas privadas |
| URL inexistente | HTTP **404** real |
| Consolidación de dominio | `www` devuelve **301** hacia HTTPS sin www, conservando ruta y parámetros |
| Navegación comercial | Enlaces HTML con `href` en las siete páginas públicas |
| Títulos y descripciones | Presentes y únicos; una canonical propia y un H1 por página |
| Analítica | Medición propia ampliada a `/seguridad/` y GA4 opcional publicado; recepción de una visita verificada. Las conversiones reales dependen de actividad comercial futura y consentimiento |
| Recursos públicos | Páginas comerciales sin `app.js`, `styles.css` del sistema, `summary.css` ni SDK Supabase; aplicación separada en `/app/` |
| Información de confianza | Contacto, seguridad, privacidad y términos públicos; formularios actuales conservados |
| Presentación social y datos estructurados | OG, tarjetas X y JSON-LD presentes; no implica que un buscador conceda resultados enriquecidos |
| Accesibilidad básica y favicon | H1 público, pruebas de autenticación existentes y favicon PNG cuadrado de 96 px |

La aplicación `/app/` mantiene `noindex`; no se utilizó esa etiqueta como sustituto de autenticación, permisos o RLS. Esta etapa no altera datos privados ni sus controles.

Pruebas del proyecto al cerrar la etapa 2: **174 casos, 172 aprobados, 0 fallos y 2 omitidos de integración**, además de cálculos financieros, cinco escenarios de calendario, build público y Wrangler dry-run correctos. Incluyen privacidad de GA4, atribución, migración PostgreSQL y los controles del verificador HTTP incorporados en la etapa 1.

El diagnóstico HTTP no ejecuta JavaScript ni valida exhaustivamente HTML/XML. Los User-Agent simulados no acreditan solicitudes de bots auténticos. No mide Core Web Vitals, conversiones reales ni indexación. No realiza envíos de formularios o datos comerciales.

## Cloudflare y búsqueda con IA

- En **AI Crawl Control → Security**, los bloqueos individuales de Googlebot, BingBot, OAI-SearchBot y GPTBot estaban desactivados. Se conservaron esos valores.
- En **AI Crawl Control → Metrics**, para los últimos siete días, Cloudflare clasificó **una solicitud OAI-SearchBot a `/` con HTTP 200**, permitida y sin fallo. Es evidencia del panel de Cloudflare, no de una cita o recomendación de ERMIF.
- En **Security → Analytics → Events**, la muestra de las últimas 24 horas mostró dos bloqueos de reglas administradas sobre `/wp-config.php.bak`, uno con www y otro sin www. No eran solicitudes a páginas comerciales. Se conservaron las protecciones.
- No se crearon excepciones generales por nombre de User-Agent ni por pertenencia a la red de Google. Una dirección de Google Cloud no acredita por sí sola que sea Googlebot.
- La revisión de una muestra de eventos no demuestra ausencia de cualquier bloqueo futuro. Ante un fallo real, correlacionar URL, hora, regla e identidad verificada antes de ajustar la seguridad.

**OAI-SearchBot** se utiliza para búsqueda de ChatGPT; **GPTBot** para contenido que podría utilizarse en entrenamiento. Permitir uno no exige permitir el otro. [Documentación de OpenAI](https://developers.openai.com/api/docs/bots). La decisión existente sobre GPTBot se mantiene independiente.

## Informes pendientes y acciones concretas del propietario

No falta ninguna acción manual para completar las verificaciones de propiedad. El siguiente control depende de que los buscadores procesen la información:

1. **Desde el 18/10:** abrir [Search Console de ERMIF](https://search.google.com/search-console?resource_id=sc-domain%3Aermif.com) → **Páginas** y **Rendimiento**. En esta revisión ambos mostraban “Se están procesando los datos; vuelve a comprobar esta sección mañana”. Registrar los valores disponibles, sin convertir ausencia de datos en cero.
2. **En las siguientes 24–48 horas:** abrir [Bing Webmaster Tools](https://www.bing.com/webmasters/) → seleccionar ERMIF → **Search Performance** para comprobar disponibilidad de informes. En **Sitemaps**, la fila `https://ermif.com/sitemap.xml` ya muestra **Success** y siete URLs; no es necesario volver a enviarla. Si aparece un error posterior, seguir el diagnóstico de la guía.
3. Inspeccionar `/`, `/precios/` y `/como-funciona/` en ambas consolas. Comparar la fecha del último rastreo con los cambios; distinguir estado del índice y prueba en vivo. No existe un plazo garantizado de indexación.
4. **Core Web Vitals:** Google informó falta de datos suficientes tanto en móvil como en ordenador. No se registra una aprobación ni un incumplimiento. La medición de laboratorio y optimización corresponden a la etapa de rendimiento.
5. HTTPS funciona en las siete URLs comprobadas y en las pruebas en vivo. No se obtuvo un informe agregado independiente de HTTPS en Search Console; no se marca ese informe como aprobado.

## Incidencia corregida en la etapa 2: atribución desde Seguridad

**PROBLEMA ORIGINAL:** `/seguridad/` era pública e indexable, pero no estaba admitida como página de entrada por todas las capas de la medición propia. **Corregido y publicado el 17/10/2026.**

**CAUSA:** faltaba en las listas de `public/acquisition.js`, `src/acquisition.js` y en la restricción/RPC de `supabase-acquisition.sql`.

**IMPACTO ORIGINAL:** una visita que empezaba en Seguridad podía quedar fuera de la atribución incluso si aceptaba la medición. No afectaba la indexación ni los cálculos financieros.

**SOLUCIÓN APLICADA:** cliente, servidor y esquema de adquisición actualizados mediante una migración idempotente específica. Cambiar solo JavaScript habría dejado la base de datos rechazando esa ruta.

**PASO A PASO:**

1. Añadir la ruta a las listas permitidas y al SQL para instalaciones nuevas.
2. Preparar migración acotada de la restricción y `acquisition_visit_create`, conservando propietario, permisos, validaciones, idempotencia y bloqueo de concurrencia existentes.
3. Probar migración repetida, conservación de visitas, aceptación de `/seguridad/` y rechazo de rutas privadas; verificar respaldo y esquema antes de aplicarla en producción.
4. Aplicar SQL, servidor y cliente en ese orden; probar una visita consentida y su revocación sin enviar datos personales a servicios externos.

**CÓMO COMPROBARLO:** prueba integrada de visita consentida con entrada `/seguridad/`, consulta del informe agregado y prueba negativa con ruta privada. **Migración v2 aplicada el 17/10/2026 con respaldo, pruebas PostgreSQL y comprobación de permisos.**

## Próximas etapas: estado real

| Etapa | Estado y siguiente entrega |
|---|---|
| 2 · Analítica y atribución | **Implementación publicada y visita recibida en GA4.** Diez eventos instrumentados con consentimiento adicional; ChatGPT, `utm_content` y primer cliente incorporados. El informe propio conserva hitos verificados en servidor. Pendiente observar conversiones comerciales futuras; renovaciones propuestas como módulo separado. No confundir pago de suscripción con pagos de los préstamos del cliente. |
| 3 · Páginas y arquitectura comercial | Tres páginas añadidas: cobranzas, ampliaciones y reclamaciones. Portada y enlaces mejorados; diez páginas en el sitemap. Ver checklist de etapa 3 para distinguir implementación, publicación e indexación. |
| 4 · Captación y contenido | Investigar intención y competencia antes de calculadoras, Excel y guías. Sin volúmenes ni resultados comerciales inventados. |
| 5 · Rendimiento | Medir campo y laboratorio; corregir solo problemas demostrados. |

**IndexNow:** evaluado, **no instalado en esta etapa**. Con siete páginas públicas y actualizaciones poco frecuentes, las consolas y sitemaps permiten iniciar el seguimiento. Incorporarlo al publicar nuevas guías/herramientas o automatizar cambios comerciales; avisar solo de URLs públicas realmente cambiadas. No enviar clientes, préstamos, pagos, dashboard ni parámetros personales. La recepción de un aviso no garantiza indexación. [Protocolo oficial](https://www.indexnow.org/documentation).

## Rutina de administración

| Frecuencia | Revisión | Resultado que guardar |
|---|---|---|
| Tras cada cambio público importante | Diagnóstico HTTP, build, rutas, enlaces y sitemap; inspección de páginas modificadas cuando proceda | Fecha, versión, pruebas y resultado. Corregir regresiones antes de publicar |
| Semanal | Search Console y Bing: sitemaps, nuevas exclusiones, indexación de páginas principales, fallos de rastreo y eventos de seguridad pertinentes | Problema, URL, causa, acción y verificación; no intentar indexar rutas privadas |
| Mensual | Consultas, páginas con impresiones, clics, CTR y posición; comparar con registros, activación y primer pago dentro de la cobertura consentida | Periodos comparables, volumen de datos y limitaciones; decidir qué contenido mejorar. Revisar referencias de buscadores/IA cuando existan, sin prometer citas |
| Trimestral | Precios/contacto/contenido vigente, enlaces internos y backlinks relevantes, permisos de consolas, DNS, políticas de bots y rendimiento | Prioridades del trimestre y una medición comparable antes/después; no comprar enlaces ni crear contenido masivo |

Esta rutina es documental: no se ha creado una automatización ni se han prometido revisiones futuras sin ejecución.
