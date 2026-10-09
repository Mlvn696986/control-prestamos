# Estrategia de respaldos de ERMIF

ERMIF usa dos capas de recuperacion. La primera ya vive dentro de la aplicacion; la segunda debe configurarse fuera del frontend para proteger la infraestructura completa.

## Capa 1: copias de recuperacion de ERMIF

La tabla `user_backups` guarda snapshots de clientes, prestamos, pagos y movimientos de capital del usuario. Esta capa sirve para recuperarse de errores operativos como eliminaciones accidentales, cambios equivocados o una restauracion necesaria dentro de la misma cuenta.

Caracteristicas actuales:

- Se crea una copia automatica aproximadamente cada 24 horas.
- Se conservan hasta 7 copias recientes por usuario.
- En modo cloud se usa la RPC `create_user_backup()`.
- En modo local/demo se usa `localStorage`.
- La restauracion usa `restore_user_backup(backup_id)` y solo puede restaurar una copia propia.

Limitacion importante: estas copias estan dentro del mismo proyecto Supabase. Ayudan a recuperar datos operativos, pero no reemplazan un backup independiente de infraestructura.

## Capa 2: backup independiente de la base de datos

Para cubrir perdida total del proyecto Supabase, corrupcion grave o eliminacion accidental de la base, ERMIF necesita una copia fuera del mismo Supabase.

Opciones recomendadas:

- Activar backups nativos de Supabase desde el panel del proyecto si el plan lo permite.
- Programar una exportacion periodica de PostgreSQL con `pg_dump`.
- Guardar esas exportaciones en almacenamiento externo privado, por ejemplo un bucket seguro o una cuenta de almacenamiento separada.
- Mantener los secretos solo en backend o en un runner seguro, nunca en `app.js`, `index.html` ni `supabase-config.js`.

Implementacion sugerida:

1. Crear un secreto de conexion de base de datos en el entorno backend elegido.
2. Ejecutar `pg_dump` con una tarea programada diaria.
3. Cifrar el archivo antes de subirlo a almacenamiento externo.
4. Conservar varias versiones, por ejemplo 7 diarias y 4 semanales.
5. Probar restauracion en una base separada al menos una vez al mes.

No se debe implementar esta capa desde el navegador porque expondria credenciales sensibles. Debe hacerse desde infraestructura controlada: Worker con secretos adecuados, GitHub Actions con secrets, un servidor propio o herramientas nativas de Supabase.

## Herramientas preparadas el 08/10/2026

`npm run db:backup` utiliza la CLI oficial fijada en package-lock.json para exportar roles, esquema y datos.
Requiere acceso autorizado a la base y las dependencias de `supabase db dump` (Docker disponible para ese flujo).
El 08/10/2026 se obtuvo un respaldo real con la variante nativa sin Docker y se
comprobo una restauracion local de sus 44 tablas. Ver el registro al final; sigue
pendiente la validacion completa de servicios en un proyecto Supabase separado.

Carga SUPABASE_DB_URL de forma privada en la terminal desde tu gestor de credenciales; nunca en Git ni en el chat.
La conexion remota debe exigir SSL. Usa la conexion directa o el pooler en modo sesion del panel Connect, no el pooler transaccional.
El programa no imprime la URL ni la escribe en el manifiesto.

El comando crea una carpeta nueva y exclusiva bajo `backups/database`; no sobrescribe copias anteriores.
Solo ejecuta dump: no migra ni modifica registros. Un fallo deja archivos parciales sin un manifiesto valido.
Genera `roles.sql`, `schema.sql`, `data.sql` y `manifest.json` con tamanos y SHA256.
Para comprobar una copia: `npm run db:verify-backup -- RUTA_DE_LA_COPIA`.
El verificador detecta alteracion de archivos, pero devuelve expresamente `restoreVerified: false`.

## Procedimiento de recuperacion y validacion

1. Antes del respaldo, confirmar el proyecto y evitar cambios de esquema durante la captura. Registrar fecha, version y conteos de las tablas criticas sin incluir datos personales en el informe.
2. Ejecutar el respaldo autorizado. Conservar el manifiesto junto a los SQL. Guardarlos en almacenamiento privado cifrado y copiar una segunda version fuera del equipo. Los SQL contienen datos sensibles; la carpeta ignorada por Git no equivale a cifrado.
3. Inventariar por separado Storage (los objetos binarios no estan en un dump SQL), funciones, configuracion Auth, secretos externos y configuracion Cloudflare. Los backups internos de usuarios tampoco cubren estos recursos.
4. Para el ensayo, crear o elegir un proyecto Supabase separado, confirmado como destino de pruebas. Nunca restaurar sobre el proyecto activo de ERMIF.
5. Seguir la restauracion oficial de roles, esquema y datos mediante psql con ON_ERROR_STOP y transaccion unica, revisando antes extensiones y personalizaciones de auth/storage. Si se usa Vault o cifrado de columnas, seguir ademas los requisitos de claves de la guia oficial.
6. Ejecutar la auditoria RLS de solo lectura y comprobar clientes, prestamos, pagos, movimientos, relaciones y saldos. Verificar que un usuario no accede a otro; probar acceso y recuperacion de cuentas con usuarios de prueba.
7. Registrar destino, fecha, hashes, conteos y resultado del ensayo. Solo entonces marcar el respaldo como restaurable. Mantener el destino de ensayo fuera de produccion.
8. Antes de una restauracion real, obtener autorizacion especifica, respaldo vigente verificado y plan de interrupcion/retorno.

Retencion propuesta: 7 copias diarias y 4 semanales, sin eliminar automaticamente las existentes.
La programacion, cifrado y almacenamiento externo quedan pendientes de elegir y configurar; no se activaron tareas automaticas.

Referencia oficial: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## Respaldo sin Docker (Windows, 08/10/2026)

Herramientas portatiles PostgreSQL 18.6 verificadas con `--version` en
`.tools/postgresql-18.6/bin`. No se instalo un servicio de Windows, ni se modifico
PATH o la BIOS. Fuente oficial:
https://www.postgresql.org/download/windows/ →
https://www.enterprisedb.com/download-postgresql-binaries →
https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip
SHA256 calculado de la descarga: E2246BA91D22345BC3D017586C09EDE52D9DF180B1EEB480F050445F1CAD84E2.
Es una huella local, no una comparacion con un checksum independiente publicado por EDB.

### Uso guiado

1. Tener la contrasena de la BASE DE DATOS guardada de forma privada. No es la
   contrasena de acceso a Supabase ni una API key. Si se restablece, actualizar
   las conexiones directas externas que dependan de ella. El codigo ERMIF revisado
   utiliza la API HTTP de Supabase; no se encontraron conexiones directas en ese codigo.
2. En el proyecto Control Prestamos, abrir Connect, Type URI, Method Session pooler.
   Copiar la cadena que contiene `[YOUR-PASSWORD]`, sin reemplazar el marcador.
3. Abrir `respaldar-supabase.cmd` con doble clic. Pegar la cadena en la ventana local.
   La contrasena se solicita por separado con entrada oculta.
4. Esperar las cinco etapas. El resultado se guarda en una carpeta exclusiva de
   `backups/database/*-native-*`. No se modifica la base original.
5. Comprobar nuevamente con `npm run db:verify-backup -- RUTA`. Completar despues
   cifrado, segunda copia externa y ensayo de restauracion antes de publicar cambios.

La contraseña se pasa mediante un archivo temporal PGPASSFILE con permisos solo
para el usuario actual. Se elimina al salir normalmente; un cierre forzado de la
terminal o del sistema podria dejarlo en %TEMP%/ermif-pgpass-*/connection.pgpass.
No se imprime ni se pasa como argumento de linea de comandos. La carpeta del
respaldo tambien se restringe al usuario actual en Windows. Eso no es cifrado.

`npm run db:backup:native` es la entrada tecnica. Requiere SUPABASE_DB_URL con
marcador y PGPASSFILE. Descarta variables PG heredadas que puedan redirigir la
conexion, exige el proyecto ERMIF, puerto de sesion 5432, SSL y una sesion de solo
lectura. No se cambia la entrada antigua `db:backup`, que sigue usando Docker.

### Contenido y restauracion del formato nativo

El manifiesto formato 2 incluye SHA256/tamano de:
- `database.dump`: archivo pg_dump custom comprimido, con datos/esquema en un
  snapshot consistente, funciones, triggers, indices, RLS y permisos.
- `roles.sql`: roles originales sin contrasenas de inicio de sesion.
- `archive-list.txt`: indice de pg_restore.
- `metadata.json`: version, extensiones y exclusiones aplicadas.

Se usan las exclusiones de datos del dry-run de Supabase CLI 2.120.0 para omitir
esquemas administrados. auth/storage se conservan con sus definiciones para
retener personalizaciones; se excluyen sus tablas de migraciones y las dos tablas
vectoriales indicadas por Supabase. El manifiesto registra las exclusiones exactas.
No equivale a un respaldo integral de todos los recursos de la plataforma.

Este archivo nativo NO tiene las transformaciones SQL de `supabase db dump`.
No ejecutar roles.sql ni restaurar database.dump indiscriminadamente sobre otro
Supabase: contiene roles reservados y objetos administrados de auth/storage.
Preparar una seleccion de objetos/roles para el destino aislado, habilitar las
extensiones necesarias y validar los permisos, customizaciones y datos restaurados.
Conservar el original; nunca modificarlo para preparar una restauracion.

La comprobacion abre el indice y descomprime todo el archivo con pg_restore SIN
conexion a una base. Eso detecta errores de lectura pero no demuestra que pueda
restaurarse en otro Supabase; se mantiene restoreVerified:false. Los datos tienen
snapshot unico, pero no se deben alterar esquemas/roles durante la captura.

Siguen fuera: binarios de Storage, configuracion de Auth, secretos/Worker, historia
de migraciones y esquemas Vault/pgsodium con sus claves. Inventariar por separado
antes de considerar completa la recuperacion. El respaldo real ya se obtuvo y
paso un ensayo local; faltan el cifrado, la copia externa y la validacion completa
de los servicios de Supabase.

Referencia sobre diferencias de pg_dump nativo y la CLI:
https://supabase.com/docs/guides/self-hosting/restore-from-platform

### Compatibilidad con Session pooler

La consulta inicial exige una transaccion explicita BEGIN READ ONLY y termina con
ROLLBACK; no depende de que el pooler conserve PGOPTIONS. El campo readOnlyScope
identifica que readOnly:on se comprobo para esa transaccion de metadatos. pg_dump
abre su propia transaccion REPEATABLE READ, READ ONLY; pg_dumpall --roles-only
consulta catalogos para exportar definiciones y no modifica roles.
No se cambia el modo global de la base. Referencia:
https://www.postgresql.org/docs/current/sql-begin.html

En esta computadora, el asistente ofrece usar con Enter la URI no secreta de
Session pooler que el propietario ya utilizo para autenticar en ERMIF. Tambien
permite pegar otra URI del mismo proyecto si cambia el endpoint. La contrasena se
pide siempre aparte y no se recuerda entre intentos.

### Comprobacion local de la carpeta antes de pedir la clave

El asistente ejecuta backup-native.js --check-folder antes de pedir la URI y la
contrasena. Crea una carpeta vacia en backups/database, aplica y verifica permisos
privados para el usuario actual y elimina solo esa carpeta vacia. No conecta con
Supabase ni lee credenciales. La carpeta definitiva se protege de nuevo antes de
escribir datos. Se conserva su propietario: reasignarlo innecesariamente causaba
UnauthorizedAccessException en el disco D de esta computadora. Las pruebas de
permisos ahora incluyen ese destino real, ademas del directorio temporal en C.

## Respaldo real y ensayo local completados — 08/10/2026

- Respaldo: backups/database/2026-10-09T02-41-42-087Z-native-77b05cf3-c676-449b-8abb-e3f9bfaf8ca3 (hora UTC en el nombre).
- Los cuatro archivos del manifiesto pasaron nuevamente la comprobacion de tamano y SHA256. El archivo original se verifico otra vez despues del ensayo y permanece intacto.
- Ensayo: backups/restore-checks/local-65zXfe/report.json. Se recuperaron las 44 tablas de public/auth/storage con todos los conteos iguales a los COPY del archivo; 25 politicas, 33 tablas con RLS y 10 triggers de usuario presentes. Una FK ya venia NOT VALID del origen; pudo validarse sobre la copia local sin errores.
- Destino creado expresamente: PostgreSQL 18.6 temporal, autenticacion SCRAM aleatoria, solo 127.0.0.1, archivos protegidos para el usuario actual. Servidor detenido y base temporal eliminada al finalizar. No se usaron credenciales remotas durante este ensayo.
- Adaptaciones locales registradas: se excluyeron la extension/ACL de Vault y seis event triggers administrados de Supabase, cuyas funciones no estan en el dump. Roles NOLOGIN, sin importar configuraciones de sesion del proveedor, y con el administrador local como otorgante de membresias. Propietarios, concesiones de objetos y politicas de las tablas restauradas se conservaron.
- Resultado: localDataRestoreVerified=true; fullSupabaseRestoreVerified=false. El manifiesto original conserva restoreVerified=false: esta evidencia local no prueba Auth HTTP, Storage, funciones administradas ni la recuperacion completa del proyecto cloud.
- La migracion 20261008_transactional_email.sql se aplico dos veces sobre la copia local, sin errores. Se comprobo enabled=false, cola sin adjudicaciones, privilegios de adjudicacion solo para service_role y conteos de clientes/prestamos/pagos/movimientos intactos. No se activaron ni enviaron correos.
- Pendientes: cifrado y segunda copia fuera del equipo (destino consultado al propietario); validacion del entorno Supabase separado; autorizacion de publicacion. No se publico ni se migro produccion.

Fuentes para el ensayo selectivo: https://www.postgresql.org/docs/current/app-pgrestore.html y https://supabase.com/docs/guides/self-hosting/restore-from-platform

### Decision del propietario — 08/10/2026

El propietario solicito continuar a la activacion de los correos sin segunda copia externa. La copia local verificada se conserva y se usara para esta publicacion autorizada. El cifrado/copia externa queda pendiente, no como bloqueo adicional impuesto a esta activacion.
