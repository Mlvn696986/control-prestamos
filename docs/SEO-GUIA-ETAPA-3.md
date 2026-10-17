# ERMIF · Páginas comerciales y navegación

Revisión: **17/10/2026**, America/Lima. Objetivo: atraer visitas que necesitan administrar préstamos y facilitar el recorrido hacia una cuenta gratuita y, cuando necesiten más capacidad, una suscripción.

## Investigación y decisión

Se consultaron búsquedas públicas sobre «software para prestamistas control de cobranzas sistema» y «ampliaciones de préstamos software control», y páginas de proveedores [Prestafolio](https://www.prestafolio.com/es) y [PrestaControl](https://prestacontrol.net/). Es una muestra cualitativa del resultado de búsqueda, no un estudio de volúmenes ni una estimación de tráfico. Los resultados varían según país, fecha y usuario.

La muestra presenta soluciones comerciales centradas en préstamos, cobros y cartera. La oportunidad elegida es explicar dos tareas que ERMIF ya permite: registrar abonos separando capital e intereses y mantener ampliaciones vinculadas a una operación. No se trasladaron al producto promesas de terceros sobre rutas de cobradores, notificaciones automáticas, contabilidad o evaluación crediticia. No se copió su contenido.

«Ampliación de préstamo» también puede referirse a solicitar financiación o cambiar condiciones con un banco. La página de ERMIF especifica que es **gestión de capital adicional**, no una oferta de dinero. Es una decisión editorial basada en esa ambigüedad, no una afirmación sobre volumen de búsquedas.

## Qué se implementa

| Página | Necesidad del visitante | Siguiente acción |
|---|---|---|
| `/control-de-cobranzas/` | Organizar vencimientos, registrar abonos y consultar saldos | Ejemplo de pago → Cómo funciona o Precios → Crear cuenta |
| `/ampliaciones-de-prestamos/` | Distinguir capital adicional, devoluciones y operación original | Ejemplo de ampliación → Cobranzas → Crear cuenta |
| `/reclamaciones/` | Encontrar el canal de atención y el formulario existente | Abrir Libro de Reclamaciones, sin crear una cuenta |
| `/` | Entender qué hace ERMIF desde el primer bloque | Funciones con enlaces descriptivos, prueba gratuita y planes |

La portada explica préstamos, clientes y cobranzas, con el límite gratuito visible. Las nuevas páginas contienen ejemplos ficticios identificados, pasos, preguntas frecuentes y enlaces HTML rastreables. La información de reclamaciones reproduce el canal y plazo publicados en el formulario; no crea nuevas condiciones ni altera el envío o seguimiento.

Los diez documentos públicos mantienen título y descripción únicos, un H1 visible, canonical propia, Open Graph, tarjeta de X, favicon y JSON-LD conectado a la marca y al sitio. Las páginas nuevas usan `WebPage` y `BreadcrumbList`; no se añaden reseñas, estrellas, supuestas certificaciones ni marcado de resultados enriquecidos para preguntas frecuentes. La imagen social de marca sigue siendo la existente, de 1200 × 630.

El sitemap contiene las diez páginas canónicas. No se agregan `/app/`, formularios con parámetros, datos de clientes ni páginas vacías. Las nuevas rutas tienen enlaces desde la portada o la navegación de confianza, desde Cómo funciona y desde el pie de página. El menú superior sigue compacto.

## Archivos y dependencias

- `marketing/product-pages.cjs`: contenido y componentes de las tres páginas nuevas.
- `marketing/site.cjs`: integración, portada y enlaces; conserva los componentes existentes de precios y datos estructurados.
- `public/landing.css`: estilos compartidos de las páginas nuevas y adaptación a móvil/tablet.
- `sitemap.xml`: las tres URLs nuevas. El build existente ya publica los documentos generados; no hace falta un segundo sistema de publicación.
- `public/acquisition.js`, `public/measurement.js` y `src/acquisition.js`: admiten exclusivamente las rutas nuevas, manteniendo consentimiento, limpieza de URL y categorías cerradas.
- `supabase-acquisition-public-pages-v3.sql`: amplía la restricción de rutas y la validación de la RPC existente. No cambia tablas de negocio, datos de visitas, permisos, política de consentimiento o primera atribución. `supabase-acquisition.sql` conserva el esquema para instalaciones nuevas.
- Pruebas: sitemap y enlaces alcanzables; metadatos, contenido estático, presupuesto de recursos, rutas privadas, migración repetida, conservación de visitas y permisos, y medición mínima con consentimiento.

No se modifica `app.js`, autenticación, procesamiento de Mercado Pago ni cálculos financieros.

## Publicar y comprobar

1. Ejecutar `npm run validate`. Si fallan los permisos del entorno de pruebas de Windows, resolver la ejecución local; no cambiar los permisos de producción para hacer pasar la prueba.
2. Verificar el respaldo privado del módulo de adquisición antes de ejecutar la migración v3. Es una copia acotada, no un respaldo de toda la base.
3. Aplicar SQL antes de publicar el cliente que enviará las nuevas rutas; revisar permisos y que se conserven las visitas anteriores.
4. Revisar móvil, tablet y escritorio, el enlace de registro, preguntas desplegables y apertura del formulario de reclamaciones. No enviar formularios ni pagos ficticios.
5. Publicar la versión que pasó las pruebas y ejecutar `npm run seo:check`. Con diez páginas se esperan **20 comprobaciones HTTP** correctas. Esto comprueba respuestas/HTML, no demuestra indexación ni mide Core Web Vitals.
6. Abrir cada nueva URL en producción. Comprobar una sola canonical y un H1; el sitemap debe contener diez URLs. Comprobar también 404 real, redirección www y `noindex` de la aplicación.
7. En Search Console: **Inspección de URLs → pegar la URL nueva → Probar URL publicada**. Si la prueba es correcta, solicitar indexación una vez. En Bing: **URL Inspection → Live URL** y enviar la URL cuando corresponda. No repetir diariamente solicitudes ni reenviar el sitemap sin cambios.

El sitemap conserva su dirección ya enviada a Google y Bing. Una publicación o solicitud aceptada no equivale a una página indexada. Las consolas pueden tardar en mostrar las nuevas URLs; registrar la fecha y la evidencia observada antes de marcar indexación completada.

## Evidencia de implementación

El 17/10/2026 se aprobó la validación completa: 177 pruebas, 175 aprobadas, 0 fallos y 2 omitidas por requisitos de integración; regresiones financieras, cinco escenarios de calendario y build/dry-run correctos. Se revisaron las vistas a 390 y 820 píxeles y en escritorio, sin desbordamiento horizontal observado. El botón de reclamaciones abrió el formulario existente sin iniciar sesión ni enviarlo.

La migración v3 se aplicó tras verificar un respaldo privado del módulo de adquisición. La comprobación de producción confirmó las tres rutas admitidas, RLS activo, ejecución de RPC denegada a `anon` y `authenticated` y permitida al servidor. Se conservaron las dos visitas existentes; no se añadieron registros, préstamos ni pagos de prueba. La publicación web y la recepción por buscadores se registran separadamente en el checklist.

Publicación confirmada mediante [PR 25](https://github.com/Mlvn696986/control-prestamos/pull/25), commit `83257378be1a3b334055d57c8eb664cdf3822f1d`. La validación de GitHub también pasó antes de integrar. Después del despliegue, **20 comprobaciones HTTP aprobaron**: [evidencia de producción](seo-stage3-2026-10-17.json). Las tres URLs nuevas se abrieron en el navegador, sus enlaces funcionaron y el formulario de reclamaciones se mostró sin iniciar sesión ni enviarlo. Google no se cargó con la preferencia de medición rechazada.

Search Console comprobó las tres URLs nuevas como disponibles e indexables, con un elemento válido de rutas de exploración por página. Las tres solicitudes de indexación se confirmaron. Al reenviar una vez el sitemap actualizado, Google mostró **Correcto, 10 páginas descubiertas**. Antes de solicitar el rastreo, las tres páginas figuraban como desconocidas; no se confunde la recepción de solicitudes con indexación efectiva.

Bing también comprobó las tres URLs mediante **Live URL**, informó que podían indexarse y no detectó incidencias SEO/GEO en esas pruebas. Cada solicitud terminó con la confirmación **Indexing requested**. El estado del índice anterior era **Not discovered**; la recepción no acredita todavía su aparición en resultados.

El sitemap modificado se reenvió una vez a Bing desde la fila existente. Al cerrar la revisión figuraba **Processing**, con las siete URLs de la lectura anterior aún en el contador. La nueva versión contiene diez URLs según la comprobación pública; la lectura de esa versión por Bing queda pendiente. No volver a enviarlo sin cambios mientras se procesa.

## Cómo saber si ayuda a captar clientes

En Search Console, filtrar **Rendimiento → Páginas** por cada URL nueva y revisar consultas, impresiones, clics y CTR. En Bing revisar el mismo recorrido en Search Performance. Cuando haya datos, comparar períodos equivalentes y distinguir falta de datos de cero resultados.

En **ERMIF → Admin → Captación y conversiones**, revisar la página de entrada y el origen de las visitas consentidas, sus registros y primeros pagos verificados. Las rutas nuevas se conservan por separado. En GA4 se pueden consultar visitas y acciones de quienes permiten adicionalmente Google. No sumar ambos informes ni suponer que tienen idéntica cobertura.

No añadir UTM a los enlaces internos. Para publicaciones externas, utilizar las categorías admitidas de la guía de etapa 2. Si no hay impresiones, revisar rastreo/indexación y utilidad del contenido; si hay impresiones sin clics, revisar consultas y presentación; si hay visitas sin registros, revisar intención, claridad y recorrido. No cambiar precios ni prometer funciones para forzar conversiones.

## Errores y correcciones

| Señal | Qué revisar y corregir |
|---|---|
| URL nueva responde 404 | Confirmar que se integró la versión correcta y que el build generó su `index.html`; no activar un fallback SPA global |
| Canonical o sitemap no coincide | Revisar ruta y metadatos de esa página, corregir y volver a ejecutar las pruebas |
| Medición devuelve 400/503 en la ruta nueva | Comprobar listas de rutas y migración v3 aplicada; no admitir rutas arbitrarias ni parámetros personales |
| Botón de reclamaciones no abre el formulario | Debe apuntar a `/app/?dialog=claims`; conservar el manejador existente, no duplicar el formulario |
| Página descubierta sin indexar | Consultar la prueba publicada y última fecha de rastreo; revisar contenido y enlaces. No hay plazo garantizado |
| Cifras de Google y ERMIF distintas | Revisar consentimiento adicional, cobertura, primera atribución y período antes de declarar un fallo |

## Siguiente etapa

Investigar cada herramienta y guía antes de construirla: calculadora de intereses, saldo pendiente y plantilla Excel; después guías prácticas vinculadas al producto. `/herramientas/` y `/guias/` se publicarán cuando tengan recursos utilizables, no como contenedores vacíos. No hay volumen de tráfico ni posicionamiento garantizados.

**IndexNow:** se reevalúa al ampliar la publicación regular de herramientas y guías. En este grupo de tres páginas se conserva el sitemap y las consolas existentes; no se genera una clave ni se afirma haber notificado IndexNow. No es una condición para que estas páginas puedan rastrearse.

## Fuentes oficiales consultadas

- [Google: contenido útil para personas](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): explicar tareas reales y evitar producir páginas solo para obtener posiciones.
- [Google: enlaces rastreables y textos descriptivos](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).
- [Google: crear y enviar sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- [IndexNow: protocolo oficial](https://www.indexnow.org/documentation).
