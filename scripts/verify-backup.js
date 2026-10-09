const { verifyBackup } = require("./backup-lib");
try {
  if (!process.argv[2]) throw new Error("Uso: npm run db:verify-backup -- RUTA_DEL_RESPALDO");
  const result = verifyBackup(process.argv[2]);
  console.log(JSON.stringify(result));
  console.log("Los hashes verifican integridad; no reemplazan un ensayo de restauracion.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
