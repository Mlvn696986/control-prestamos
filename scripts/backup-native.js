const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { writeManifest, verifyBackup } = require("./backup-lib");

const PROJECT = "kltozglqvivknbdcnnyj";
// Data exclusions from Supabase CLI 2.120.0 --dry-run. Keep auth/storage
// definitions too to preserve custom triggers and RLS in the native archive.
// Raw roles / managed objects must be reviewed before a Supabase restore.
const EXCLUDED_SCHEMAS = "information_schema|pg_*|graphql|graphql_public|pgsodium|pgsodium_masks|pgtle|repack|tiger|tiger_data|timescaledb_*|_timescaledb_*|topology|vault|etl|extensions|pgbouncer|realtime|supabase_migrations|_analytics|_realtime|_supavisor";
const EXCLUDED_TABLES = ["auth.schema_migrations", "storage.migrations", "supabase_functions.migrations", "storage.buckets_vectors", "storage.vector_indexes"];

function connectionEnvironment(env, { allowLocal = false } = {}) {
  let url, username, password;
  try {
    url = new URL(env.SUPABASE_DB_URL);
    username = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch { throw new Error("Pega la cadena del panel Connect en el asistente local."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("La conexion debe ser PostgreSQL.");
  if (password && password !== "[YOUR-PASSWORD]") throw new Error("Usa la cadena con [YOUR-PASSWORD]; la clave se pide por separado.");
  const local = allowLocal && ["127.0.0.1", "localhost"].includes(url.hostname);
  const direct = url.hostname === "db." + PROJECT + ".supabase.co" && username === "postgres";
  const pooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) && username === "postgres." + PROJECT;
  if (!local && !direct && !pooler) throw new Error("La conexion no corresponde al proyecto ERMIF esperado.");
  if (!local && url.port && url.port !== "5432") throw new Error("Elige Session pooler (puerto 5432), no Transaction pooler.");
  if (url.pathname !== "/postgres" || url.hash || [...url.searchParams.keys()].some(key => key !== "sslmode")) throw new Error("Usa la cadena del panel Connect sin opciones adicionales.");
  if (url.searchParams.has("sslmode") && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) throw new Error("La conexion debe exigir SSL.");
  if (!env.PGPASSFILE || !fs.existsSync(env.PGPASSFILE) || !fs.lstatSync(env.PGPASSFILE).isFile()) throw new Error("Falta la credencial temporal. Abre respaldar-supabase.cmd.");
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => !/^PG/i.test(key) && key !== "SUPABASE_DB_URL"));
  return {
    ...clean, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: username,
    PGDATABASE: "postgres", PGPASSFILE: env.PGPASSFILE,
    PGSSLMODE: local ? "disable" : url.searchParams.get("sslmode") || "require",
    PGCONNECT_TIMEOUT: "20", PGCLIENTENCODING: "UTF8", PGAPPNAME: "ermif-readonly-backup",
    PGOPTIONS: "-c default_transaction_read_only=on -c lock_timeout=10000",
  };
}
function safeFailure(stderr = "") {
  if (/no password supplied/i.test(stderr)) return "PostgreSQL no recibio la contrasena. Hay que revisar el archivo temporal del asistente.";
  if (/password authentication failed/i.test(stderr)) return "Supabase rechazo la contrasena enviada. Confirma que el cambio se guardo y copia la clave nueva exacta.";
  if (/could not translate host|could not resolve|timeout expired|connection timed out|connection refused|Network is unreachable/i.test(stderr)) return "No se pudo conectar. Revisa Internet, Session pooler y las restricciones de red de Supabase.";
  if (/version mismatch|server version.*pg_dump version/i.test(stderr)) return "La version del servidor requiere actualizar las herramientas locales.";
  if (/permission denied/i.test(stderr)) return "Faltan permisos para una parte del respaldo. No se marco como completo.";
  return "No se completo el respaldo. Los archivos parciales no tienen manifiesto valido.";
}
function protectBackupDirectory(directory, { env = process.env, run = spawnSync } = {}) {
  if (process.platform !== "win32") return;
  // Change only the DACL of our new folder. Its owner is already the creator;
  // assigning an owner again requires permissions absent on some data drives.
  const result = run(path.join(env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference='Stop'; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.DirectorySecurity; $acl.SetAccessRuleProtection($true,$false); $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule); [System.IO.Directory]::SetAccessControl($env:ERMIF_PRIVATE_DIRECTORY, $acl); $actual=[System.IO.Directory]::GetAccessControl($env:ERMIF_PRIVATE_DIRECTORY); $rules=@($actual.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])); if (-not $actual.AreAccessRulesProtected -or $rules.Count -ne 1 -or $rules[0].IdentityReference -ne $sid -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl' -or $rules[0].InheritanceFlags -ne 'ContainerInherit,ObjectInherit') { throw 'Private directory verification failed' }"],
    { env: { SystemRoot: env.SystemRoot, PATH: env.PATH, ERMIF_PRIVATE_DIRECTORY: directory }, encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || result.error) throw new Error("No se pudo proteger la carpeta de respaldo. No se descargaron datos.");
}
function checkBackupFolder({ root = path.resolve(__dirname, ".."), env = process.env, run = spawnSync } = {}) {
  const parent = path.join(root, "backups", "database");
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const probe = fs.mkdtempSync(path.join(parent, "folder-check-"));
  try { protectBackupDirectory(probe, { env, run }); }
  finally { fs.rmdirSync(probe); } // Only this new, empty folder.
}

function backupNative({ root = path.resolve(__dirname, ".."), env = process.env, run = spawnSync, allowLocal = false, progress = () => {}, secureDirectory } = {}) {
  const pgEnv = connectionEnvironment(env, { allowLocal });
  const bin = env.ERMIF_PG_BIN || path.join(root, ".tools", "postgresql-18.6", "bin");
  const executable = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  for (const name of ["pg_dump", "pg_dumpall", "pg_restore", "psql"]) {
    if (!fs.existsSync(executable(name))) throw new Error("Faltan las herramientas portatiles de PostgreSQL.");
  }
  const invoke = (name, args, { offline = false, discard = false } = {}) => {
    const result = run(executable(name), args, {
      cwd: root, env: offline ? Object.fromEntries(Object.entries(pgEnv).filter(([key]) => !/^PG/i.test(key))) : pgEnv,
      encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", discard ? "ignore" : "pipe", "pipe"],
    });
    if (result.status !== 0 || result.error) throw new Error(safeFailure(result.stderr));
    return result.stdout || "";
  };
  progress("1/5 Comprobando conexion de solo lectura...");
  // Enforce READ ONLY inside SQL: session poolers may discard PGOPTIONS.
  const metadataText = invoke("psql", ["-X", "--quiet", "--no-password", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command",
    "BEGIN READ ONLY; SET LOCAL lock_timeout = '10s'; SELECT json_build_object('serverVersion', current_setting('server_version'), 'readOnly', current_setting('transaction_read_only'), 'extensions', (SELECT json_agg(json_build_object('name', extname, 'version', extversion)) FROM pg_extension)); ROLLBACK;"]);
  let metadata;
  try { metadata = JSON.parse(metadataText); } catch { throw new Error("No se pudo validar la informacion del servidor."); }
  if (metadata.readOnly !== "on") throw new Error("No se pudo confirmar la transaccion de solo lectura. El respaldo se detuvo.");
  const clientVersion = invoke("pg_dump", ["--version"], { offline: true }).trim();
  const directory = path.join(root, "backups", "database", new Date().toISOString().replace(/[:.]/g, "-") + "-native-" + crypto.randomUUID());
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (secureDirectory) secureDirectory(directory);
  else protectBackupDirectory(directory, { env, run });
  progress("2/5 Copiando la base de datos...");
  invoke("pg_dump", ["--no-password", "--format=custom", "--quote-all-identifiers", "--role=postgres", "--no-tablespaces", "--no-subscriptions", "--lock-wait-timeout=10000",
    "--exclude-schema", EXCLUDED_SCHEMAS, ...EXCLUDED_TABLES.flatMap(table => ["--exclude-table", table]),
    "--file", path.join(directory, "database.dump")], { discard: true });
  progress("3/5 Copiando definiciones de roles (sin contrasenas)...");
  invoke("pg_dumpall", ["--no-password", "--roles-only", "--role=postgres", "--quote-all-identifiers", "--no-role-passwords", "--no-comments", "--database=postgres", "--file", path.join(directory, "roles.sql")], { discard: true });
  progress("4/5 Comprobando lectura y descompresion del archivo...");
  invoke("pg_restore", ["--list", "--file", path.join(directory, "archive-list.txt"), path.join(directory, "database.dump")], { offline: true, discard: true });
  // No --dbname: generate SQL into a discarded stream, never execute a restore.
  invoke("pg_restore", ["--file=-", path.join(directory, "database.dump")], { offline: true, discard: true });
  fs.writeFileSync(path.join(directory, "metadata.json"), JSON.stringify({
    ...metadata, clientVersion, projectRef: allowLocal ? "local-fixture" : PROJECT, createdAt: new Date().toISOString(),
    archiveReadable: true, restoreVerified: false, rolesAreRaw: true, readOnlyScope: "metadata-transaction",
    excludedSchemas: EXCLUDED_SCHEMAS, excludedTables: EXCLUDED_TABLES,
    limitations: ["No incluye binarios de Storage, configuracion Auth/Cloudflare ni secretos externos.", "No incluye Vault/pgsodium ni sus claves: inventariar aparte si se usan.", "Revisar roles y objetos administrados de auth/storage antes de restaurar en otro Supabase.", "Los datos tienen un snapshot consistente; no cambiar esquemas/roles durante la captura."],
  }, null, 2) + "\n", { flag: "wx" });
  progress("5/5 Verificando tamanos y SHA256...");
  writeManifest(directory, 2);
  verifyBackup(directory);
  return directory;
}
if (require.main === module) {
  try {
    if (process.argv[2] === "--check-folder") {
      checkBackupFolder();
      console.log("Carpeta de respaldo comprobada. Se puede guardar una copia privada.");
    } else {
      const directory = backupNative({ progress: message => console.log(message) });
      console.log("COPIA CREADA E INTEGRIDAD COMPROBADA: " + directory);
      console.log("Pendiente: ensayo de restauracion aislado, cifrado y copia fuera de esta computadora.");
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { protectBackupDirectory, checkBackupFolder, backupNative, connectionEnvironment, safeFailure, EXCLUDED_SCHEMAS, EXCLUDED_TABLES };
