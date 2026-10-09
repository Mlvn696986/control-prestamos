import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawnSync } from "node:child_process";
import native from "../scripts/backup-native.js";
import lib from "../scripts/backup-lib.js";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-native-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pass = path.join(root, "fixture.pgpass");
  fs.writeFileSync(pass, "localhost:5432:postgres:postgres:FICTIONAL_TEST_PASSWORD\n");
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  for (const name of ["psql", "pg_dump", "pg_dumpall", "pg_restore"]) fs.writeFileSync(path.join(bin, name + (process.platform === "win32" ? ".exe" : "")), "");
  const env = { SUPABASE_DB_URL: "postgresql://postgres:placeholder@localhost/postgres".replace("placeholder", "[YOUR-PASSWORD]"), PGPASSFILE: pass, ERMIF_PG_BIN: bin };
  return { root, env };
}
function fakeRunner(operations, fail = false) {
  return (exe, args, options) => {
    operations.push({ exe, args, options });
    if (/psql/.test(exe)) return { status: 0, stdout: '{"serverVersion":"18.6","readOnly":"on","extensions":[]}' };
    if (args.includes("--version")) return { status: 0, stdout: "pg_dump (PostgreSQL) 18.6" };
    if (fail && /pg_restore/.test(exe)) return { status: 1, stderr: "archive corrupt; private content hidden" };
    const index = args.indexOf("--file");
    if (index >= 0) fs.writeFileSync(args[index + 1], "fixture bytes, no real data\n");
    return { status: 0 };
  };
}
test("native: rejects foreign projects, transaction pooler and unsafe options", t => {
  const { env } = fixture(t);
  const prefix = "postgresql://postgres.kltozglqvivknbdcnnyj:[YOUR-PASSWORD]@aws-0-test.pooler.supabase.com";
  assert.equal(native.connectionEnvironment({ ...env, SUPABASE_DB_URL: prefix + ":5432/postgres" }).PGSSLMODE, "require");
  for (const uri of [prefix + ":6543/postgres", prefix + ":5432/postgres?sslmode=disable", prefix + ":5432/postgres?options=evil", prefix.replace(".kltozglqvivknbdcnnyj", ".different") + ":5432/postgres", "postgresql://postgres@localhost/postgres"]) {
    assert.throws(() => native.connectionEnvironment({ ...env, SUPABASE_DB_URL: uri }));
  }
});
test("native: credentials and inherited libpq routing cannot enter child arguments", t => {
  const { root, env } = fixture(t);
  const operations = [];
  const directory = native.backupNative({ root, env: { ...env, PGPASSWORD: "DO_NOT_LEAK", PGHOSTADDR: "unrelated.invalid", PGSERVICE: "untrusted", PGOPTIONS: "-c default_transaction_read_only=off" }, allowLocal: true, secureDirectory() {}, run: fakeRunner(operations) });
  assert.ok(operations.every(op => !JSON.stringify(op.args).includes("DO_NOT_LEAK")));
  const connection = operations[0].options.env;
  assert.equal(connection.PGPASSWORD, undefined);
  assert.equal(connection.PGHOSTADDR, undefined);
  assert.equal(connection.PGSERVICE, undefined);
  assert.equal(connection.SUPABASE_DB_URL, undefined);
  assert.match(connection.PGOPTIONS, /default_transaction_read_only=on/);
  for (const op of operations.filter(op => /pg_restore/.test(op.exe))) {
    assert.equal(op.options.env.PGPASSFILE, undefined);
    assert.ok(!op.args.some(arg => arg.startsWith("--dbname") || arg === "-d"));
  }
  assert.deepEqual(lib.verifyBackup(directory), { integrityVerified: true, restoreVerified: false });
});
test("native: archive validation failure leaves no complete manifest", t => {
  const { root, env } = fixture(t);
  assert.throws(() => native.backupNative({ root, env, allowLocal: true, secureDirectory() {}, run: fakeRunner([], true) }), /No se completo/);
  const directories = fs.readdirSync(path.join(root, "backups", "database"));
  assert.equal(directories.length, 1);
  assert.equal(fs.existsSync(path.join(root, "backups", "database", directories[0], "manifest.json")), false);
});
test("native: corrupt bytes and missing files fail verification", t => {
  const { root, env } = fixture(t);
  const directory = native.backupNative({ root, env, allowLocal: true, secureDirectory() {}, run: fakeRunner([]) });
  fs.appendFileSync(path.join(directory, "database.dump"), "corruption");
  assert.throws(() => lib.verifyBackup(directory), /alterado/);
});
test("native: refuses backup when read-only mode cannot be confirmed", t => {
  const { root, env } = fixture(t);
  assert.throws(() => native.backupNative({ root, env, allowLocal: true, run: () => ({ status: 0, stdout: '{"readOnly":"off"}' }) }), /solo lectura/);
  assert.equal(fs.existsSync(path.join(root, "backups")), false);
});
test("native: refuses secrets embedded in URI and redacts provider errors", t => {
  const { env } = fixture(t);
  assert.throws(() => native.connectionEnvironment({ ...env, SUPABASE_DB_URL: "postgresql://postgres:DO_NOT_LEAK@localhost/postgres" }, { allowLocal: true }), /por separado/);
  assert.ok(!native.safeFailure("Unexpected failure DO_NOT_LEAK").includes("DO_NOT_LEAK"));
});

test("native integration: dump/restore preserves rows, functions, auth/storage customizations and RLS", {
  skip: process.env.ERMIF_NATIVE_INTEGRATION !== "1",
  timeout: 120000,
}, async t => {
  const repo = path.resolve(import.meta.dirname, "..");
  const bin = path.join(repo, ".tools", "postgresql-18.6", "bin");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-pg-integration-"));
  let started = false;
  const exe = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key) && !/^SUPABASE_DB/.test(key)));
  function run(name, args, extra = {}) {
    const result = spawnSync(exe(name), args, { encoding: "utf8", windowsHide: true, stdio: name === "pg_ctl" ? "ignore" : ["ignore", "pipe", "pipe"], env: { ...cleanEnv, PGCLIENTENCODING: "UTF8", ...extra }, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(result.status, 0, name + ": " + result.stderr);
    return result.stdout;
  }
  const data = path.join(temp, "cluster");
  t.after(() => {
    if (started) {
      const stopped = spawnSync(exe("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8", windowsHide: true });
      if (stopped.status !== 0) {
        const status = spawnSync(exe("pg_ctl"), ["-D", data, "status"], { encoding: "utf8", windowsHide: true });
        assert.equal(status.status, 3, "Do not delete a running test cluster");
      }
    }
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const selected = server.address().port; server.close(() => resolve(selected)); });
  });
  run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", data, "-l", path.join(temp, "server.log"), "-o", "-h 127.0.0.1 -p " + port, "-w", "start"]);
  started = true;
  const pg = { PGHOST: "127.0.0.1", PGPORT: String(port), PGUSER: "postgres", PGDATABASE: "postgres", PGSSLMODE: "disable" };
  const sql = String.raw`
CREATE ROLE fixture_reader;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id integer PRIMARY KEY, email text);
CREATE TABLE storage.objects (id integer PRIMARY KEY, name text);
CREATE TABLE public.loans (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, owner_id integer REFERENCES auth.users(id), amount numeric(14,2), note text);
INSERT INTO auth.users VALUES (1, 'ficticio@example.invalid');
INSERT INTO storage.objects VALUES (1, 'solo-metadatos.txt');
INSERT INTO public.loans(owner_id, amount, note) VALUES (1, 123.45, E'primera linea\n-- comentario dentro de dato\ntercera linea');
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_loans ON public.loans USING (owner_id=1);
GRANT SELECT ON public.loans TO fixture_reader;
CREATE FUNCTION public.fixture_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER custom_auth_trigger BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fixture_trigger();
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY object_policy ON storage.objects USING (true);
`;
  run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-c", sql], pg);
  const pass = path.join(temp, "fixture.pgpass");
  fs.writeFileSync(pass, "127.0.0.1:" + port + ":postgres:postgres:fictional\n");
  const destination = native.backupNative({
    root: temp, allowLocal: true,
    // Simulate a pooler discarding startup options: the metadata transaction
    // and pg_dump must stay read-only independently of inherited PGOPTIONS.
    run: (program, args, options) => {
      const childEnv = { ...options.env };
      delete childEnv.PGOPTIONS;
      return spawnSync(program, args, { ...options, env: childEnv });
    },

    env: { ...cleanEnv, ERMIF_PG_BIN: bin, SUPABASE_DB_URL: "postgresql://postgres@127.0.0.1:" + port + "/postgres", PGPASSFILE: pass },
  });
  assert.deepEqual(lib.verifyBackup(destination), { integrityVerified: true, restoreVerified: false });
  const metadata = JSON.parse(fs.readFileSync(path.join(destination, "metadata.json"), "utf8"));
  assert.equal(metadata.readOnly, "on");
  assert.equal(metadata.readOnlyScope, "metadata-transaction");
  assert.equal(run("psql", ["-X", "-At", "-c", "SHOW transaction_read_only"], pg).trim(), "off");

  run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE DATABASE restore_fixture TEMPLATE template0"], pg);
  run("pg_restore", ["--exit-on-error", "--single-transaction", "--dbname=restore_fixture", path.join(destination, "database.dump")], pg);
  const restored = { ...pg, PGDATABASE: "restore_fixture" };
  const checks = run("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", "SELECT amount::text FROM public.loans; SELECT count(*) FROM auth.users; SELECT count(*) FROM storage.objects; SELECT count(*) FROM pg_policies WHERE policyname IN ('own_loans','object_policy'); SELECT count(*) FROM pg_trigger WHERE tgname='custom_auth_trigger'; SELECT relrowsecurity FROM pg_class WHERE oid='public.loans'::regclass; SELECT has_table_privilege('fixture_reader','public.loans','SELECT');"], restored).trim().split(/\r?\n/);
  assert.deepEqual(checks, ["123.45", "1", "1", "2", "1", "t", "t"]);
  const note = run("psql", ["-X", "-At", "-c", "SELECT note FROM public.loans"], restored);
  assert.match(note, /-- comentario dentro de dato/);
});

test("Windows: credential folder remains private without loading Set-Acl", { skip: process.platform !== "win32" }, t => {
  const root = path.resolve(import.meta.dirname, "..");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "ermif-acl-test-"));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const source = fs.readFileSync(path.join(root, "scripts", "backup-guided.ps1"), "utf8");
  const start = source.indexOf("    $sid =");
  const end = source.indexOf("    $passFile =", start);
  assert.ok(start > 0 && end > start);
  const setup = source.slice(start, end);
  const script = [
    "$ErrorActionPreference='Stop'",
    "function Set-Acl { throw 'Security module must not be required in this regression' }",
    "$privateDirectory = Join-Path $env:ERMIF_ACL_TEST_ROOT 'private'",
    "[System.IO.Directory]::CreateDirectory($privateDirectory) | Out-Null",
    setup,
    "$actual = [System.IO.Directory]::GetAccessControl($privateDirectory)",
    "$rules = @($actual.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))",
    "if (-not $actual.AreAccessRulesProtected -or $rules.Count -ne 1 -or $rules[0].IdentityReference -ne $sid -or $rules[0].AccessControlType -ne 'Allow' -or $rules[0].FileSystemRights -ne 'FullControl') { throw 'Folder is not private' }",
    "$fixtureFile = Join-Path $privateDirectory 'fictional.pgpass'",
    "[System.IO.File]::WriteAllText($fixtureFile,'fixture-only')",
    "$fileRules = @([System.IO.File]::GetAccessControl($fixtureFile).GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))",
    "if ($fileRules.Count -ne 1 -or $fileRules[0].IdentityReference -ne $sid -or $fileRules[0].AccessControlType -ne 'Allow') { throw 'File did not inherit private permissions' }",
    "Write-Output 'PRIVATE_ACL_OK'",
  ].join("\n");
  const scriptFile = path.join(fixture, "check.ps1");
  fs.writeFileSync(scriptFile, script);
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", scriptFile], {
    env: { ...process.env, ERMIF_ACL_TEST_ROOT: fixture }, encoding: "utf8", windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /PRIVATE_ACL_OK/);
});


test("Windows: backups on the actual destination drive keep the owner and private inherited permissions", {
  skip: process.platform !== "win32",
}, t => {
  const repo = path.resolve(import.meta.dirname, "..");
  const parent = path.join(repo, "backups", "database");
  fs.mkdirSync(parent, { recursive: true });
  const folder = fs.mkdtempSync(path.join(parent, "acl-regression-"));
  const sample = path.join(folder, "fictional.txt");
  t.after(() => {
    if (fs.existsSync(sample)) fs.unlinkSync(sample);
    fs.rmdirSync(folder);
  });
  const powershell = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const readAcl = () => {
    const result = spawnSync(powershell, ["-NoProfile", "-NonInteractive", "-Command",
      "$ErrorActionPreference='Stop'; $acl=[System.IO.Directory]::GetAccessControl($env:ERMIF_ACL_TEST_FOLDER); $file=Join-Path $env:ERMIF_ACL_TEST_FOLDER 'fictional.txt'; $rules=@(); if ([System.IO.File]::Exists($file)) { $rules=@([System.IO.File]::GetAccessControl($file).GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object { @{ sid=$_.IdentityReference.Value; rights=$_.FileSystemRights.ToString(); type=$_.AccessControlType.ToString(); inherited=$_.IsInherited } }) }; @{ owner=$acl.Owner; protected=$acl.AreAccessRulesProtected; sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; rules=$rules } | ConvertTo-Json -Compress -Depth 4"
    ], { env: { ...process.env, ERMIF_ACL_TEST_FOLDER: folder }, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  const before = readAcl();
  native.protectBackupDirectory(folder);
  fs.writeFileSync(sample, "Fictional permission check, no customer data.\n");
  const after = readAcl();
  assert.equal(after.owner, before.owner);
  assert.equal(after.protected, true);
  assert.deepEqual(after.rules, [{ sid: after.sid, rights: "FullControl", type: "Allow", inherited: true }]);
  native.checkBackupFolder({ root: repo });
});

test("Windows: failed folder preflight stops and removes only its empty probe", {
  skip: process.platform !== "win32",
}, t => {
  const { root } = fixture(t);
  assert.throws(() => native.checkBackupFolder({
    root,
    run: () => ({ status: 1, stderr: "fixture: access denied" }),
  }), /No se pudo proteger/);
  assert.deepEqual(fs.readdirSync(path.join(root, "backups", "database")), []);
});
