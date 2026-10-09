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
