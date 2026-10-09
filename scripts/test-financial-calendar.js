const { spawnSync } = require("node:child_process");
const path = require("node:path");
const scenarios = [
  ["2026-09-19T17:00:00Z", "America/Lima"],
  ["2026-10-08T05:00:00Z", "UTC"],
  ["2027-01-01T00:00:00Z", "Pacific/Auckland"],
  ["2028-02-29T23:59:59Z", "America/Los_Angeles"],
  ["2030-12-31T23:59:59Z", "Asia/Tokyo"],
];
for (const [date, zone] of scenarios) {
  const result = spawnSync(process.execPath, ["--require", "./tests/simulated-host-clock.cjs", "financial-regression-tests.js"], {
    cwd: path.resolve(__dirname, ".."), encoding: "utf8",
    env: { ...process.env, TZ: zone, ERMIF_TEST_HOST_DATE: date },
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.error || result.stdout);
    process.exit(1);
  }
  console.log(`OK: reloj externo ${date}, zona ${zone}`);
}
