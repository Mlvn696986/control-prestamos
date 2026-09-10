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
