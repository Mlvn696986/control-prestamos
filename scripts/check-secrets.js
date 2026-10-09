const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
function detectSecrets(text) {
  const findings = [];
  for (const [name, pattern] of [
    ["clave privada PEM", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["Supabase secret", /sb_secret_[A-Za-z0-9_-]{20,}/],
    ["GitHub token", /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
    ["AWS access key", /AKIA[0-9A-Z]{16}/],
    ["Mercado Pago access token", /APP_USR-\d{8,}-[A-Za-z0-9-]{15,}/],
  ]) if (pattern.test(text)) findings.push(name);
  for (const token of text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
      if (payload.role === "service_role") findings.push("JWT service_role");
    } catch {}
  }
  return [...new Set(findings)];
}
if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  let failed = false;
  for (const name of new Set(names)) {
    const file = path.join(root, name);
    if (!fs.existsSync(file) || !/\.(?:js|cjs|mjs|json|jsonc|html|css|sql|md|ya?ml|toml|txt|ps1|cmd)$/.test(name)) continue;
    const findings = detectSecrets(fs.readFileSync(file, "utf8"));
    if (findings.length) {
      console.error(name + ": " + findings.join(", ") + " (valores ocultos)");
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
  else console.log("Escaneo de patrones: sin claves privadas reconocidas en archivos publicables.");
}
module.exports = { detectSecrets };
