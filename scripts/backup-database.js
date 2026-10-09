const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { writeManifest, verifyBackup } = require("./backup-lib");
function backupDatabase({ env = process.env, run = spawnSync, root = path.resolve(__dirname, "..") } = {}) {
  // La URL se carga desde el entorno local; nunca se imprime ni se guarda.
  const raw = env.SUPABASE_DB_URL;
  if (!raw) throw new Error("Define SUPABASE_DB_URL de forma privada en la terminal, nunca en el chat.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("SUPABASE_DB_URL invalida."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Se requiere una conexion PostgreSQL.");
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1" && !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode"))) {
    throw new Error("La conexion remota debe exigir sslmode=require o verify-full.");
  }
  const cli = path.join(root, "node_modules", "supabase", "dist", "supabase.js");
  if (!fs.existsSync(cli)) throw new Error("Falta la CLI local de Supabase. Ejecuta npm ci.");
  const directory = path.join(root, "backups", "database", new Date().toISOString().replace(/[:.]/g, "-") + "-" + crypto.randomUUID());
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const plans = [
    ["roles.sql", ["--role-only"]],
    ["schema.sql", []],
    ["data.sql", ["--data-only", "--use-copy", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes"]],
  ];
  for (const [name, flags] of plans) {
    const result = run(process.execPath, [cli, "db", "dump", "--db-url", raw, "--file", path.join(directory, name), ...flags], {
      cwd: root, env: { ...env, SUPABASE_DB_URL: undefined }, encoding: "utf8", windowsHide: true,
    });
    if (result.status !== 0) throw new Error("Fallo el respaldo de " + name + ". Revisa Docker, conexion y permisos. Los archivos parciales no tienen manifiesto valido.");
  }
  writeManifest(directory);
  verifyBackup(directory);
  return directory;
}
if (require.main === module) {
  try {
    const directory = backupDatabase();
    console.log("Respaldo generado y SHA256 verificado: " + directory);
    console.log("Pendiente: cifrado externo, copia fuera del equipo y restauracion de prueba en un proyecto aislado.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { backupDatabase };
