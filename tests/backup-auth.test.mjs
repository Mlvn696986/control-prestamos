import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawnSync } from "node:child_process";
import native from "../scripts/backup-native.js";

test("errores de autenticacion distinguen clave rechazada de clave no transmitida", () => {
  assert.match(native.safeFailure("fe_sendauth: no password supplied"), /no recibio/);
  assert.match(native.safeFailure('FATAL: password authentication failed for user "fixture"'), /rechazo/);
});

test("Windows: el archivo temporal del asistente autentica por SCRAM con caracteres especiales", {
  skip: process.platform !== "win32" || process.env.ERMIF_NATIVE_INTEGRATION !== "1",
  timeout: 120000,
}, async t => {
  const repo = path.resolve(import.meta.dirname, "..");
  const bin = path.join(repo, ".tools", "postgresql-18.6", "bin");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-auth-integration-"));
  const cluster = path.join(temp, "cluster");
  const fixturePassword = "SoloFicticia:@\\%'\"\u00f1\u4e2d$-72";
  let started = false;
  const base = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key) && !/^SUPABASE_DB/.test(key)));
  function run(name, args, extra = {}) {
    const result = spawnSync(path.join(bin, name + ".exe"), args, {
      encoding: "utf8", windowsHide: true, env: { ...base, ...extra },
      stdio: name === "pg_ctl" ? "ignore" : ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 0, name + ": " + result.stderr);
    return result.stdout;
  }
  t.after(() => {
    if (started) run("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep + "ermif-auth-integration-"));
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => resolve(value)); });
  });
  const initialPasswordFile = path.join(temp, "fictional-password.txt");
  fs.writeFileSync(initialPasswordFile, fixturePassword + "\n", { mode: 0o600 });
  run("initdb", ["-D", cluster, "-U", "postgres", "--auth=scram-sha-256", "--pwfile", initialPasswordFile, "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", cluster, "-l", path.join(temp, "server.log"), "-o", "-h 127.0.0.1 -p " + port, "-w", "start"]);
  started = true;
  // Execute the actual wizard's credential-file writer, not a reimplementation.
  const source = fs.readFileSync(path.join(repo, "scripts", "backup-guided.ps1"), "utf8");
  const start = source.indexOf("    $privateDirectory = Join-Path");
  const end = source.indexOf("    & $node (Join-Path", start);
  assert.ok(start > 0 && end > start);
  const passwordWriter = source.slice(start, end).replace("':5432:postgres:'", "':" + port + ":postgres:'");
  const verifyScript = path.join(temp, "verify.cjs");
  fs.writeFileSync(verifyScript, [
    "const assert = require('node:assert/strict');",
    "const fs = require('node:fs');",
    "const { spawnSync } = require('node:child_process');",
    "const native = require(" + JSON.stringify(path.join(repo, "scripts", "backup-native.js")) + ");",
    "const env = native.connectionEnvironment(process.env, { allowLocal: true });",
    "const result = spawnSync(" + JSON.stringify(path.join(bin, "psql.exe")) + ", ['-X','--no-password','-At','-c','SELECT 1'], { env, encoding:'utf8', windowsHide:true });",
    "assert.equal(result.status, 0, 'Autenticacion ficticia fallo: ' + native.safeFailure(result.stderr));",
    "assert.equal(result.stdout.trim(), '1');",
    "fs.writeFileSync(env.PGPASSFILE, '127.0.0.1:" + port + ":postgres:postgres:wrong-test-password\\n');",
    "const rejected = spawnSync(" + JSON.stringify(path.join(bin, "psql.exe")) + ", ['-X','--no-password','-At','-c','SELECT 1'], { env, encoding:'utf8', windowsHide:true });",
    "assert.notEqual(rejected.status,0);",
    "assert.match(rejected.stderr,/password authentication failed/);",
    "console.log('SCRAM_AUTH_OK_AND_WRONG_PASSWORD_REJECTED');",
  ].join("\n"));
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$privateDirectory=$null; $passwordPointer=[IntPtr]::Zero",
    "$connection='postgresql://postgres@127.0.0.1:" + port + "/postgres'",
    "$parsed=[Uri]$connection; $username='postgres'",
    "$securePassword=New-Object System.Security.SecureString",
    "foreach ($character in $env:ERMIF_FICTIONAL_PASSWORD.ToCharArray()) { $securePassword.AppendChar($character) }",
    "try {", passwordWriter,
    "& $env:ERMIF_TEST_NODE $env:ERMIF_TEST_VERIFY",
    "if ($LASTEXITCODE -ne 0) { throw 'La prueba local de autenticacion fallo' }",
    "} finally {",
    "if ($passwordPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer) }",
    "$securePassword.Dispose()",
    "if ($privateDirectory) { $item=Join-Path $privateDirectory 'connection.pgpass'; if (Test-Path -LiteralPath $item) { Remove-Item -LiteralPath $item -Force }; Remove-Item -LiteralPath $privateDirectory -Force }",
    "}",
  ].join("\n");
  const psFile = path.join(temp, "password-channel.ps1");
  fs.writeFileSync(psFile, ps);
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", psFile], {
    env: { ...base, ERMIF_FICTIONAL_PASSWORD: fixturePassword, ERMIF_TEST_NODE: process.execPath, ERMIF_TEST_VERIFY: verifyScript },
    encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /SCRAM_AUTH_OK_AND_WRONG_PASSWORD_REJECTED/);
});
