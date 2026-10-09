import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import lib from "../scripts/backup-lib.js";
import backup from "../scripts/backup-database.js";
test("respaldo verifica integridad y detecta corrupcion", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-backup-test-"));
  try {
    for (const file of lib.FILES) fs.writeFileSync(path.join(dir, file), "-- fixture local sin datos reales\n");
    lib.writeManifest(dir);
    assert.deepEqual(lib.verifyBackup(dir), { integrityVerified: true, restoreVerified: false });
    fs.appendFileSync(path.join(dir, "data.sql"), "alterado");
    assert.throws(() => lib.verifyBackup(dir), /alterado/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test("respaldo rechaza conexiones no cifradas antes de ejecutar herramientas", () => {
  let calls = 0;
  assert.throws(() => backup.backupDatabase({ env: { SUPABASE_DB_URL: "postgresql://user:fixture@db.example.invalid/postgres" }, run: () => { calls++; } }), /sslmode/);
  assert.equal(calls, 0);
});
test("respaldo falla de forma segura sin credenciales", () => {
  assert.throws(() => backup.backupDatabase({ env: {} }), /SUPABASE_DB_URL/);
});

test("respaldo completo crea tres archivos y no marca restauracion verificada", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-backup-run-"));
  try {
    const cliDir = path.join(dir, "node_modules", "supabase", "dist");
    fs.mkdirSync(cliDir, { recursive: true });
    fs.writeFileSync(path.join(cliDir, "supabase.js"), "// CLI simulada");
    const operations = [];
    const destination = backup.backupDatabase({
      root: dir,
      env: { SUPABASE_DB_URL: "postgresql://fixture@127.0.0.1/test" },
      run: (_exe, args) => {
        operations.push(args);
        fs.writeFileSync(args[args.indexOf("--file") + 1], "-- SQL ficticio de prueba\n");
        return { status: 0 };
      },
    });
    assert.equal(operations.length, 3);
    assert.ok(operations.every(args => args.includes("dump")));
    assert.deepEqual(lib.verifyBackup(destination), { integrityVerified: true, restoreVerified: false });
    assert.ok(!fs.readFileSync(path.join(destination, "manifest.json"), "utf8").includes("postgresql://"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
