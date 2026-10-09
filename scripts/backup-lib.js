const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const FILES = ["roles.sql", "schema.sql", "data.sql"];
const NATIVE_FILES = ["database.dump", "roles.sql", "archive-list.txt", "metadata.json"];
function fileDigest(location) {
  const descriptor = fs.openSync(location, "r");
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.alloc(1024 * 1024);
  let bytes = 0;
  try {
    for (let length; (length = fs.readSync(descriptor, buffer, 0, buffer.length, null));) {
      hash.update(buffer.subarray(0, length)); bytes += length;
    }
  } finally { fs.closeSync(descriptor); }
  return { bytes, sha256: hash.digest("hex") };
}
function writeManifest(directory, format = 1) {
  const names = format === 1 ? FILES : format === 2 ? NATIVE_FILES : null;
  if (!names) throw new Error("Formato de respaldo desconocido.");
  const files = names.map(name => {
    const digest = fileDigest(path.join(directory, name));
    if (!digest.bytes) throw new Error("El respaldo contiene un archivo vacio.");
    return { name, ...digest };
  });
  const manifest = { format, createdAt: new Date().toISOString(), restoreVerified: false, files };
  fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  return manifest;
}
function verifyBackup(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const names = manifest.format === 1 ? FILES : manifest.format === 2 ? NATIVE_FILES : null;
  if (!names || !Array.isArray(manifest.files) || manifest.files.length !== names.length) throw new Error("Manifiesto invalido.");
  for (const name of names) {
    const entry = manifest.files.find(file => file.name === name);
    if (!entry) throw new Error("Falta un archivo del respaldo.");
    const location = path.join(directory, name);
    if (!fs.lstatSync(location).isFile()) throw new Error("No se aceptan enlaces ni directorios en el respaldo.");
    const digest = fileDigest(location);
    if (!digest.bytes || digest.bytes !== entry.bytes || digest.sha256 !== entry.sha256) throw new Error("Respaldo alterado o incompleto: " + name);
  }
  return { integrityVerified: true, restoreVerified: false };
}
module.exports = { FILES, NATIVE_FILES, writeManifest, verifyBackup };
