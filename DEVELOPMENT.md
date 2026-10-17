# Desarrollo de ERMIF

## Punto de partida

La rama de trabajo es `codex/entorno-seguro-y-pruebas`. La última revisión del 08/10/2026 confirmó `main` de GitHub en `99b47cd1a16b7022f693241c691d4dbf4de34f8a`.
La versión actual ya se publicó directamente con Wrangler y la migración de correos ya se aplicó con autorización del propietario. Guardar los cambios en Git y subir esta rama prepara la revisión del código; incorporar esos cambios en `main` puede disparar una nueva publicación automática.
Los respaldos, credenciales, herramientas portables, archivos temporales de Supabase y el informe interno de la sesión se excluyen de Git.

## Herramientas

Versiones fijadas: Node 24.21.0 (LTS), npm 11.19.0 incluido, Wrangler 4.148.0 y Supabase CLI 2.120.0.
Node fue descargado de nodejs.org y verificado contra su SHA256 oficial.
La copia portable esta en `.tools/node-v24.21.0-win-x64`, excluida de Git.
En otra maquina instala Node 24 LTS y ejecuta `npm ci`. `package-lock.json` fija las dependencias.
`sharp` se fija en 0.35.5 para corregir GHSA-wq5f-xc86-pv6w.
Solo se aprobaron los instaladores de las versiones fijadas de esbuild y workerd.

En este Windows, abre `dev.cmd` con doble clic. En la consola:
```text
npm run dev
```
Abre http://127.0.0.1:8787. `iniciar-web.bat` tambien inicia esta demostracion.

Para la terminal PowerShell de Codex:
```powershell
. .\scripts\dev-env.ps1
npm --version
npx --no-install wrangler --version
```
No se modifica el PATH global ni las politicas de seguridad de Windows.

## Separacion de produccion

`npm run dev` usa `wrangler.local.jsonc`, sirve `dist-local`, deja Supabase vacio (modo demo) y bloquea `/api/*`.
Por tanto no crea pagos, reclamos, solicitudes ni correos reales.
El servidor antiguo `node servidor-local.js` tambien construye y sirve solo esa demo; no expone el repositorio, SQL, secretos o respaldos.
Los datos demo permanecen en el almacenamiento local del navegador.
Abrir directamente el index.html de la raiz no es el procedimiento de prueba: mantiene la configuracion publica de produccion.

Los archivos fuente de interfaz son `index.html`, `app.js`, `styles.css` y `assets`.
La portada comercial se genera desde `marketing/site.cjs`, con estilos y recursos en `public/`.
El build publica esa portada en `/` y la aplicacion original de `index.html` en `/app/`.
Las rutas publicas son `/precios/`, `/como-funciona/`, `/contacto/`, `/terminos/` y `/privacidad/` y `/seguridad/`.
Los textos legales se extraen del mismo `index.html` mediante `marketing/legal.cjs`, sin mantener copias independientes.
`/app/?mode=signup` abre registro y `/app/?mode=login` abre acceso. Los callbacks antiguos a la raiz se conservan.
La captura `public/dashboard-preview-hd.webp` utiliza datos ficticios y se debe regenerar con una cartera de demostracion, nunca con clientes reales.
Tras cambiarlos, vuelve a ejecutar `npm run build:local`; si la vigilancia de archivos de Windows se detiene, reinicia `npm run dev`.
No edites `dist` ni `dist-local`: son resultados generados.
Para probar autenticacion real o SQL hace falta un proyecto Supabase de pruebas separado, autorizado y con datos ficticios.

## Validacion antes de revisar cambios

```text
npm run validate
npm audit
npm run email:preview
```
`validate` comprueba sintaxis, patrones de secretos, regresiones financieras, pruebas unitarias, cinco relojes externos, construccion y empaquetado Wrangler con `--dry-run`.
El reloj de las fixtures financieras es 19/09/2026 en America/Lima; no altera la fecha de la aplicacion.
El caso de octubre verifica que ambos prestamos vencidos sumen 550.
`deploy:check` no sube archivos ni activa versiones. No hay un script `deploy` que publique accidentalmente.

El workflow `.github/workflows/validate.yml` ejecutara validaciones al subir cambios. No despliega ni recibe secretos.
Aun no fue ejecutado en GitHub porque esta rama no se ha subido.

## Cloudflare verificado el 08/10/2026

Worker: control-prestamos. Cuenta: 85fd7b8b6aee5613ff5ce0865615f51c.
Dominios activos: ermif.com y www.ermif.com.
Version activa al revisar: 283636ac-e307-48d6-91a2-5871096de064 (100 %).
Los nombres de secretos MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET y SUPABASE_SERVICE_ROLE_KEY existen.
No se leyeron sus valores ni se hicieron operaciones financieras.
La sesion OAuth existente permite consultar Worker, dominios y secretos; la API Builds devuelve 403.
Settings > Builds fue confirmado por captura: producción en main, build npm run build, publicación npx wrangler deploy y versiones de otras ramas con npx wrangler versions upload. El 08/10/2026 el propietario mostró las seis compilaciones recientes de main correctas. Esta revisión visual no amplía los permisos de la API.

`wrangler.jsonc` ahora documenta la cuenta y dominios ya existentes y ejecuta la construccion antes de empaquetar.
PUBLIC_BASE_URL no crea el dominio: las entradas routes reflejan las asociaciones verificadas.
La fecha de compatibilidad de produccion se conserva.

## Autenticacion y datos

`autenticar-supabase.cmd` abre exclusivamente el acceso oficial de Supabase. Completa el acceso en el navegador/terminal; no pegues credenciales en chats.
No ejecutes db reset ni restauraciones contra producción. Las migraciones requieren revisión, respaldo y autorización; la migración de correos del 08/10/2026 ya se aplicó con esas condiciones.
`supabase-rls-audit.sql` contiene consultas de metadatos de solo lectura.
La comprobacion anonima rechazo las 13 tablas; falta verificar RLS entre dos usuarios autorizados.

## Problema del entorno de Codex

Los registros del 08/10/2026 muestran error 32 al intentar actualizar permisos de node_repl.exe mientras otros procesos lo usan.
El reinicio de la sesion node_repl no lo resolvio; sus procesos tienen padres activos.
No se cerraron otras sesiones ni se modificaron ACL, antivirus o sandbox.
Al terminar y guardar el trabajo, cierra completamente Codex y vuelve a abrirlo. Si persiste, reinicia Windows y comprueba otra vez.
Las tareas de este proyecto se completaron mediante la terminal autorizada; node_repl sigue pendiente de esa recuperacion.

## Antes de actualizar ermif.com

Revisar el diff en esta rama; confirmar Builds y Node 24 en Cloudflare; verificar Supabase y el respaldo; probar en un entorno separado; autorizar la publicacion.
Actualizar main puede disparar Cloudflare automaticamente. No usar push directo a main.
Los correos ERMIF están activados desde el 08/10/2026; estado, límites, plantillas y pausa en EMAIL-SETUP.md. La activación fue autorizada con el respaldo local verificado, sin una segunda copia externa.

## Medición de captación y conversiones

El informe está en **Admin → Captación y conversiones**. Es analítica propia de ERMIF, sin Google Analytics ni identificador GA requerido. Cuenta navegadores con consentimiento, altas nuevas confirmadas, cuentas con un primer préstamo guardado y primeros pagos de suscripción confirmados por Mercado Pago. No mide los pagos de los clientes prestatarios ni convierte planes concedidos manualmente en ventas.

Los filtros 30/90/180 días agrupan por primera visita medida; los hitos posteriores pertenecen a esa misma cohorte. No es una suma de eventos ocurridos durante el período. No atribuye cuentas anteriores al corte de instalación. La confirmación en otro navegador/dispositivo puede perder atribución; rechazos, bloqueadores y almacenamiento borrado afectan la cobertura. No presentar estos resultados como tráfico total o ingresos netos.

`public/acquisition.js` comparte consentimiento y atribución entre portada y aplicación. Solo tras aceptar genera un UUIDv4, conserva una entrada mínima y llama a `/api/acquisition/visit`. Los reintentos reutilizan el ID. La identificación obtiene el usuario del token validado en servidor; SQL exige correo confirmado y una cuenta creada después de la visita y del corte, dentro de 30 días. La activación usa un trigger acotado y una reconciliación idempotente. Los datos de los préstamos no se copian al informe.

Ejemplo de enlace de campaña admitido:

```text
https://ermif.com/precios/?utm_source=facebook&utm_medium=paid_social&utm_campaign=lanzamiento-ermif
```

Orígenes admitidos: `directo`, `google`, `bing`, `duckduckgo`, `facebook`, `instagram`, `tiktok`, `youtube`, `linkedin`, `whatsapp`, `email`, `otro`. Medios: `direct`, `organic`, `paid_search`, `paid_social`, `social`, `email`, `referral`, `other`. Campañas iniciales: `lanzamiento-ermif`, `contenido-educativo`. No se guarda texto UTM arbitrario, `utm_term`, `utm_content`, URLs completas ni referentes completos. Para incorporar campañas, actualizar las listas cerradas del cliente, Worker y SQL en una migración revisada; no usar nombres, correos o documentos en los enlaces.

`supabase-acquisition.sql` agrega tablas privadas y RPC exclusivas del backend. No cambia cálculos ni filas financieras existentes. `subscription_first_payments` conserva un comprobante operativo mínimo del primer pago verificado (cuenta, identificador del proveedor, fecha y plan), independiente de consentimiento; permite conciliar el pago si la identificación llega después. Solo cuentas atribuidas con consentimiento aparecen en el informe. El estado de la factura recurrente no sustituye la consulta del pago real. Un fallo de persistencia responde 500 al webhook para permitir reintento, con deduplicación por pago. No se hacen pagos reales durante las pruebas.

Retención: visitas e hitos hasta 180 días; purga diaria a las 05:00 UTC mediante el cron existente. El informe excluye registros vencidos antes de la purga. Retirar consentimiento elimina visita y atribución; un identificador mínimo de revocación impide recrearlas por solicitudes atrasadas. Los comprobantes operativos de este módulo y las revocaciones también se depuran a los 180 días. Los registros de facturación anteriores del sistema no cambian. La política de privacidad describe la elección opcional y el tratamiento separado de facturación.

Para publicar: verificar respaldo, revisar/aplicar SQL **antes** de desplegar el Worker; conservar `ACQUISITION_RATE_LIMITER` (30 solicitudes/minuto por clave efímera). Ejecutar `npm run validate`. Las pruebas de cliente, Admin, Worker y PGlite cubren consentimiento, autorización, reintentos, revocación, atribución, pagos y retención sin utilizar datos reales. La demo local bloquea peticiones de medición. Para detener la captura, retirar los scripts compartidos y los hooks de identificación; mantener disponible la revocación y la purga durante la retención. No borrar tablas ni restaurar producción para revertir una interfaz.

## Recursos publicos ligeros

La web comercial usa exclusivamente `landing.css`, `landing.js` y los dos recursos de consentimiento `acquisition.*`. La aplicacion completa, Supabase y los estilos de resumen se cargan al entrar en `/app/`; esa ruta conserva registro, acceso, recuperacion y formularios existentes.

El build compacta solo esos cuatro archivos publicos con esbuild; los fuentes permanecen legibles y la demo usa la misma transformacion. Las pruebas de consentimiento y callbacks ejecutan el JavaScript transformado. No se compactan ni mezclan `app.js`, codigo de terceros ni el modulo de administracion.

`npm run images:optimize` regenera siete derivados en `public/` desde los logos originales y `marketing/dashboard-source.jpg` (2560 × 1728, captura nueva del sistema con datos ficticios). Incluye `favicon.png`, cuadrado de 96 × 96, compartido por las páginas públicas, la aplicación y el error 404. Conserva los originales. Ejecutarlo solo al cambiar esas imagenes, revisar visualmente y guardar los derivados en Git. No hace falta procesar imagenes en cada publicacion.

El logo pequeno se reutiliza como icono y en la barra lateral. El logo de acceso tiene versiones de 480/960 px. La captura comercial ofrece 1280/1920/2560 px mediante `srcset` y `sizes`; el original se captura a escala 2x y cada variante se genera directamente desde ese archivo con WebP de calidad 94, sin recomprimir miniaturas. El enlace «Ampliar imagen» abre la variante de 2560 px. Se muestra de frente, sin transformaciones 3D ni recortes. Mantiene prioridad alta en portada y carga diferida en la demostracion inferior. Las imagenes declaran dimensiones para reservar espacio.

Las pruebas protegen la separacion entre web comercial y aplicacion, el tamano real de las variantes y presupuestos de recursos: 13 KiB gzip para JS/CSS publico, 220 KiB sin compresion para HTML + JS/CSS + imagenes referenciadas de cada pagina, contando la captura de respaldo de 1280 px. Las variantes de 1280/1920/2560 px tienen limites separados de 120/220/320 KiB para conservar texto legible en pantallas de alta densidad. El aumento acotado del presupuesto prioriza nitidez; la pagina sigue sin cargar recursos del sistema. Estos limites tecnicos no son una medicion de Core Web Vitals de usuarios reales.

## Presentación social y datos estructurados

`marketing/metadata.cjs` mantiene Open Graph, tarjetas de X y JSON-LD para las siete páginas públicas. Cada documento conserva su título, descripción y URL canónica. La marca, el sitio, la página y las migas de navegación usan identificadores estables y referencias conectadas. Solo Inicio, Precios y Cómo funciona describen el software mediante `WebApplication`; solo Inicio y Precios incluyen las ofertas que muestran al visitante. Las tarjetas visibles y las ofertas comparten catálogo, contrastado en pruebas con `PLAN_CATALOG`. Los importes están en PEN y los planes de pago indican precio por mes, sin inventar plazos contractuales.

`npm run images:social` genera `public/ermif-social.jpg` (1200 × 630) con el logo original y la captura real con datos ficticios de `marketing/dashboard-source.jpg`. Revisar visualmente y guardar el JPEG cuando cambie la marca o la captura. El build lo publica automáticamente; no se descarga como imagen en la portada, solo lo consultan los lectores de metadatos. Open Graph declara tipo, dimensiones y texto alternativo; X incluye el mismo texto alternativo. No se añaden perfiles sociales sin verificar.

No se publican reseñas, estrellas ni valoraciones inventadas. Google exige una reseña o valoración real para la elegibilidad del resultado enriquecido de aplicaciones; este marcado describe el producto, pero no garantiza ese resultado ni su aparición en Google. Documentación: https://developers.google.com/search/docs/appearance/structured-data/software-app . Las plataformas sociales pueden conservar vistas previas anteriores hasta volver a consultar el enlace.

## Accesibilidad del acceso

El acceso en `/app/` presenta un título visible para registro, inicio de sesión y recuperación, más una descripción del software independiente del logo. Las pestañas de autenticación comparten un único formulario para preservar campos y validaciones. `aria-selected`, el orden de tabulación y la etiqueta del panel se actualizan desde `setAuthMode`. Las flechas y Home/End mueven el foco; Enter/Espacio activan mediante el botón nativo. Las flechas no cambian de modo ni borran campos. Los avisos usan una región de estado y las contraseñas indican `current-password` para acceso o `new-password` para registro y recuperación. La revisión de teclado y lectores de pantalla se apoya en el patrón de pestañas de WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ .

## Información pública de confianza

Contacto, privacidad, términos y seguridad se consultan sin iniciar sesión. Comparten navegación de enlaces HTML, aparecen en el pie de página y en el sitemap. La portada enlaza los cuatro documentos. `marketing/site.cjs` genera `/seguridad/` con información sobre acceso, separación de cuentas, HTTPS y descarga de copias basada en las funciones existentes; no declara certificaciones ni garantías de disponibilidad. El correo de reportes es `seguridad@ermif.com`.

Los textos legales siguen extrayéndose de los diálogos de `index.html`, sin versiones independientes ni cambios de condiciones. Los enlaces de solicitudes conservan `/app/?dialog=privacy-request` y `/app/?dialog=claims`. La verificación de interfaz abre los formularios sin enviarlos.
