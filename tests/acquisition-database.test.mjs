import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const migration = fs.readFileSync(new URL("../supabase-acquisition.sql", import.meta.url), "utf8");
const fixture = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (
    id uuid primary key, created_at timestamptz not null default now(), email_confirmed_at timestamptz
  );
  create table public.clients (id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),created_at timestamptz default now());
  create table public.loans (
    id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now(), amount numeric, note text
  );
  create table public.subscriptions (user_id uuid primary key references auth.users(id), plan text, status text);
`;

test("optional acquisition measurement runs securely and idempotently in PostgreSQL", async (t) => {
  const db = new PGlite();
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  const scalar = async (sql, params = []) => Object.values((await rows(sql, params))[0])[0];
  const rpc = async (name, params = []) => scalar(`select public.${name}(${params.map((_, i) => "$" + (i + 1)).join(",")})`, params);
  const user = async ({ age = 5, confirmedAge = 4 } = {}) => {
    const id = randomUUID();
    await db.query(`insert into auth.users(id, created_at, email_confirmed_at)
      values($1, now() - make_interval(days => $2), case when $3::integer is null then null else now() - make_interval(days => $3) end)`, [id, age, confirmedAge]);
    return id;
  };
  const visit = async ({ age = 10, path = "/", source = "google", medium = "organic", campaign = "" } = {}) => {
    const result = await rpc("acquisition_visit_create", [randomUUID(), path, source, medium, campaign, "2026-10-16"]);
    if (age) await db.query(`update public.acquisition_visits
      set created_at=now()-make_interval(days=>$2), consented_at=now()-make_interval(days=>$2),
      expires_at=now()-make_interval(days=>$2)+interval '180 days' where id=$1`, [result.visitor_id, age]);
    return result.visitor_id;
  };
  const loan = async (uid, age = 0) => db.query(`insert into public.loans(user_id,created_at,amount,note)
    values($1,now()-make_interval(days=>$2),9876,'Private fixture: never copy into measurement')`, [uid, age]);
  const paidAt = async (days) => scalar("select now()-make_interval(days=>$1)", [days]);
  const identify = (vid, uid) => rpc("acquisition_identify", [vid, uid]);
  const report = (days = 30) => rpc("acquisition_report", [days]);
  async function scenario(name, fn) {
    await t.test(name, async () => {
      await db.exec("begin; update public.acquisition_settings set cutover_at=now()-interval '365 days';");
      try { await fn(); } finally { await db.exec("rollback"); }
    });
  }
  async function rejectsStatement(sql, params = [], pattern) {
    await db.exec("savepoint expected_rejection");
    try { await assert.rejects(db.query(sql, params), pattern); }
    finally { await db.exec("rollback to expected_rejection; release expected_rejection"); }
  }
  try {
    await db.exec(fixture);
    await db.exec(migration);
    const firstCutover = await scalar("select cutover_at from public.acquisition_settings");
    await db.exec(migration);
    assert.equal(new Date(await scalar("select cutover_at from public.acquisition_settings")).getTime(), new Date(firstCutover).getTime(), "reapplying migration must not reset measurement start");
    assert.equal(await scalar("select count(*)::int from pg_trigger where tgname='acquisition_activation_after'"), 1);

    await scenario("server milestones distinguish confirmation, first client, activation and verified subscription", async () => {
      const vid=await visit(); const uid=await user();
      const state=()=>rpc('acquisition_identify_v2',[vid,uid]);
      assert.deepEqual(await state(),{linked:true,milestones:{sign_up:true,first_client_created:false,first_loan_created:false,subscription_paid:false}});
      await db.query("insert into clients(user_id) values($1)",[uid]);
      assert.equal((await state()).milestones.first_client_created,true);
      assert.equal((await report()).totals.first_clients,1);
      await db.query("delete from clients where user_id=$1",[uid]);
      assert.equal((await state()).milestones.first_client_created,true,'deleting a client does not undo an observed milestone');
      await loan(uid); assert.equal((await state()).milestones.first_loan_created,true);
      await rpc('acquisition_record_payment',[uid,'verified-fixture',await paidAt(0),'pro']);
      const result=await state();assert.equal(result.milestones.subscription_paid,true);
      assert.ok(!JSON.stringify(result).includes(uid));assert.ok(!JSON.stringify(result).includes('verified-fixture'));
      assert.deepEqual(await rpc('acquisition_identify_v2',[vid,await user()]),{linked:false});
    });

    await scenario("browser roles cannot read, forge or report measurement; backend RPC privileges are explicit", async () => {
      const signatures = [
        "public.acquisition_visit_create(uuid,text,text,text,text,text)",
        "public.acquisition_identify(uuid,uuid)",
        "public.acquisition_identify_v2(uuid,uuid)",
        "public.acquisition_visit_create_v2(uuid,text,text,text,text,text,text)",
        "public.acquisition_record_payment(uuid,text,timestamptz,text)",
        "public.acquisition_revoke(uuid)", "public.acquisition_purge()", "public.acquisition_report(integer)",
      ];
      for (const role of ["anon", "authenticated"]) {
        for (const signature of signatures) {
          assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, signature]), false, role + ": " + signature);
        }
        for (const table of ["acquisition_visits", "acquisition_accounts", "acquisition_settings", "acquisition_revocations", "subscription_first_payments"]) {
          for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
            assert.equal(await scalar("select has_table_privilege($1,$2,$3)", [role, "public." + table, privilege]), false);
          }
        }
        await db.exec("savepoint browser_attempt; set local role " + role);
        await assert.rejects(db.query("select public.acquisition_report(30)"), /permission denied/i);
        await db.exec("rollback to browser_attempt; release browser_attempt");
      }
      for (const signature of signatures) assert.equal(await scalar("select has_function_privilege('service_role',$1,'EXECUTE')", [signature]), true);
      assert.equal(await scalar("select has_function_privilege('service_role','public.acquisition_mark_activation()','EXECUTE')"), false);
      const rels = await rows("select relrowsecurity from pg_class where relname in ('acquisition_settings','acquisition_visits','acquisition_accounts','acquisition_revocations','subscription_first_payments')");
      assert.equal(rels.length, 5);
      assert.ok(rels.every((row) => row.relrowsecurity));
      const functions = await rows("select prosecdef,proconfig from pg_proc where proname like 'acquisition_%'");
      assert.equal(functions.length, 10);
      assert.ok(functions.every((row) => row.prosecdef && row.proconfig.some((item) => /^search_path=(?:"")?$/.test(item))));
      await db.exec("set local role service_role");
      const created = await rpc("acquisition_visit_create", [randomUUID(), "/", "directo", "direct", "", "2026-10-16"]);
      assert.match(created.visitor_id, /^[0-9a-f-]{36}$/);
      assert.equal((await report()).totals.visitors, 1);
      await db.exec("reset role");
    });

    await scenario("visits require the current consent and fixed classifications, with server timestamps and no arbitrary payload", async () => {
      const created = await rpc("acquisition_visit_create", [randomUUID(), "/precios/", "facebook", "paid_social", "lanzamiento-ermif", "2026-10-16"]);
      const actual = (await rows("select *,extract(epoch from expires_at-created_at)::int as lifetime from acquisition_visits where id=$1", [created.visitor_id]))[0];
      assert.equal(actual.lifetime, 180 * 86400);
      assert.equal(new Date(actual.created_at).getTime(), new Date(actual.consented_at).getTime());
      assert.equal(new Date(actual.expires_at).getTime(), new Date(created.expires_at).getTime());
      assert.equal((await report()).totals.visitors, 1);
      for (const values of [
        ["/?email=private@example.invalid", "directo", "direct", "", "2026-10-16"],
        ["/", "private@example.invalid", "organic", "", "2026-10-16"],
        ["/", "google", "arbitrary", "", "2026-10-16"],
        ["/", "google", "organic", "private-person-name", "2026-10-16"],
        ["/", "google", "organic", "", "old-version"],
        ["/", "google", "organic", null, "2026-10-16"],
      ]) {
        await rejectsStatement("select acquisition_visit_create($1,$2,$3,$4,$5,$6)", [randomUUID(), ...values], /Parametros de medicion/);
      }
      assert.equal((await report()).totals.visitors, 1);
      const columns = await rows("select column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('acquisition_visits','acquisition_accounts')");
      assert.ok(columns.every((row) => row.column_name === 'first_client_at' || !/email|phone|name|note|amount|loan|client|payload|referrer|ip_address|user_agent/.test(row.column_name)));
      assert.ok(columns.every((row) => !/json/.test(row.data_type)), "no unbounded JSON storage");
    });

    await scenario("retrying a visit ID is idempotent and cannot change its first attribution or expiration", async () => {
      const id = randomUUID();
      const first = await rpc("acquisition_visit_create", [id, "/precios/", "google", "organic", "contenido-educativo", "2026-10-16"]);
      const second = await rpc("acquisition_visit_create", [id, "/", "facebook", "paid_social", "lanzamiento-ermif", "2026-10-16"]);
      assert.deepEqual(second, first);
      assert.equal(first.visitor_id, id);
      const persisted = (await rows("select landing_path,source,medium,campaign_id from acquisition_visits where id=$1", [id]))[0];
      assert.deepEqual(persisted, { landing_path: "/precios/", source: "google", medium: "organic", campaign_id: "contenido-educativo" });
      assert.equal((await report()).totals.visitors, 1);
      await rejectsStatement("select acquisition_visit_create($1,'/','directo','direct','','2026-10-16')", [null], /Parametros de medicion/);
      await rejectsStatement("select acquisition_visit_create($1,'/','directo','direct','','2026-10-16')", ["00000000-0000-1000-8000-000000000000"], /Parametros de medicion/);
    });

    await scenario("withdrawal before a delayed create leaves a tombstone and cannot resurrect the visit", async () => {
      const unknown = randomUUID();
      assert.deepEqual(await rpc("acquisition_revoke", [unknown]), { deleted: false });
      assert.deepEqual(await rpc("acquisition_visit_create", [unknown, "/", "directo", "direct", "", "2026-10-16"]), { revoked: true });
      assert.equal((await report()).totals.visitors, 0);
      const existing = await visit();
      assert.deepEqual(await rpc("acquisition_revoke", [existing]), { deleted: true });
      assert.deepEqual(await rpc("acquisition_visit_create", [existing, "/", "directo", "direct", "", "2026-10-16"]), { revoked: true });
      assert.equal(await scalar("select count(*)::int from acquisition_revocations"), 2);
      assert.equal(await scalar("select count(*)::int from acquisition_visits"), 0);
    });

    await scenario("only confirmed new accounts in the attribution window can be linked", async () => {
      const vid = await visit();
      const pending = await user({ confirmedAge: null });
      assert.deepEqual(await identify(vid, pending), { linked: false });
      assert.deepEqual(await identify(vid, null), { linked: false });
      assert.deepEqual(await identify(vid, randomUUID()), { linked: false });
      const old = await user({ age: 400, confirmedAge: 399 });
      assert.deepEqual(await identify(vid, old), { linked: false });
      const tooLateVisit = await visit({ age: 2 });
      const valid = await user();
      assert.deepEqual(await identify(tooLateVisit, valid), { linked: false }, "existing account must not acquire a later visitor's attribution");
      const outsideWindow = await visit({ age: 40 });
      assert.deepEqual(await identify(outsideWindow, valid), { linked: false });
      assert.deepEqual(await identify(vid, valid), { linked: true });
      assert.deepEqual(await identify(vid, valid), { linked: true });
      assert.equal((await report()).totals.registrations, 1);
      const account = (await rows("select confirmed_at from acquisition_accounts where user_id=$1", [valid]))[0];
      assert.equal(new Date(account.confirmed_at).getTime(), new Date(await scalar("select email_confirmed_at from auth.users where id=$1", [valid])).getTime());
    });

    await scenario("visitor and account ownership cannot be swapped or counted twice", async () => {
      const a = await user(); const b = await user();
      const av = await visit(); const bv = await visit();
      assert.deepEqual(await identify(av, a), { linked: true });
      assert.deepEqual(await identify(av, b), { linked: false });
      assert.deepEqual(await identify(bv, a), { linked: false });
      assert.deepEqual(await identify(bv, b), { linked: true });
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 2);
      await db.query("delete from auth.users where id=$1", [a]);
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 1, "account erasure cascades to its identified measurement");
    });

    await scenario("first loan activates once; pre-account history and restoration do not create the event", async () => {
      const uid = await user(); const vid = await visit();
      await identify(vid, uid);
      await loan(uid, 6);
      assert.equal(await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]), null);
      await db.exec("set local app.restoring_snapshot='on'");
      await loan(uid);
      assert.equal(await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]), null);
      await db.exec("set local app.restoring_snapshot='off'");
      await loan(uid);
      assert.ok(await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]));
      await db.query("update acquisition_accounts set activated_at=now()-interval '1 day' where user_id=$1", [uid]);
      const first = await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]);
      await loan(uid); await identify(vid, uid);
      assert.equal(new Date(await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid])).getTime(), new Date(first).getTime());
      assert.equal((await report()).totals.activated, 1);
    });

    await scenario("identification reconciles an existing real loan using observation time", async () => {
      const uid = await user(); const vid = await visit();
      await loan(uid, 2);
      assert.deepEqual(await identify(vid, uid), { linked: true });
      const observed = await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]);
      assert.equal(new Date(observed).getTime(), new Date(await scalar("select now()")).getTime());
      assert.notEqual(new Date(observed).getTime(), new Date(await scalar("select created_at from loans where user_id=$1", [uid])).getTime());
    });

    await scenario("an optional analytics failure never blocks saving a loan", async () => {
      const uid = await user(); await identify(await visit(), uid);
      await db.exec("alter table acquisition_accounts add constraint fixture_analytics_failure check (activated_at is null)");
      await loan(uid);
      assert.equal(await scalar("select count(*)::int from loans where user_id=$1", [uid]), 1);
      assert.equal(await scalar("select activated_at from acquisition_accounts where user_id=$1", [uid]), null);
    });

    await scenario("first provider payment is idempotent, chronologically correct and independent of manual plans", async () => {
      const uid = await user(); await identify(await visit(), uid);
      await db.query("insert into subscriptions(user_id,plan,status) values($1,'pro','active')", [uid]);
      assert.equal((await report()).totals.first_payments, 0, "plan assignment alone is not payment evidence");
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-fixture-1", await paidAt(5), "basic"]), { recorded: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-fixture-1", await paidAt(2), "basic"]), { recorded: true });
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-fixture-1", await paidAt(2), "basic"]), { recorded: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-renewal", await paidAt(1), "pro"]), { recorded: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-earlier", await paidAt(3), "basic"]), { recorded: true });
      const a = (await rows("select first_payment_id,first_paid_at,first_paid_plan from acquisition_accounts where user_id=$1", [uid]))[0];
      assert.equal(a.first_payment_id, "mp-earlier");
      assert.equal(a.first_paid_plan, "basic");
      assert.equal(new Date(a.first_paid_at).getTime(), new Date(await paidAt(3)).getTime());
      assert.equal((await report()).totals.first_payments, 1);
      const other = await user(); await identify(await visit(), other);
      assert.deepEqual(await rpc("acquisition_record_payment", [other, "mp-earlier", await paidAt(3), "basic"]), { recorded: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [await user(), "mp-unattributed", await paidAt(2), "basic"]), { recorded: false });
      for (const values of [
        [uid, "private@example.invalid", await paidAt(1), "basic"],
        [uid, "mp-free", await paidAt(1), "free"],
        [uid, "mp-future", await paidAt(-1), "pro"],
        [uid, "mp-missing-date", null, "pro"],
      ]) await rejectsStatement("select acquisition_record_payment($1,$2,$3,$4)", values, /Evidencia de pago/);
    });

    await scenario("reports use visit cohorts and include later milestones, never expose individual identifiers", async () => {
      const oldVisit = await visit({ age: 60, source: "facebook", medium: "social", campaign: "contenido-educativo" });
      const oldUser = await user({ age: 55, confirmedAge: 54 });
      await identify(oldVisit, oldUser); await loan(oldUser);
      await rpc("acquisition_record_payment", [oldUser, "mp-old-cohort", await paidAt(1), "pro"]);
      const currentVisit = await visit({ age: 10, path: "/precios/", source: "google", medium: "organic" });
      const currentUser = await user(); await identify(currentVisit, currentUser); await loan(currentUser);
      await rpc("acquisition_record_payment", [currentUser, "mp-current-cohort", await paidAt(1), "basic"]);
      await visit({ age: 8, path: "/precios/", source: "google", medium: "organic" });
      const last30 = await report(30); const last90 = await report(90);
      assert.deepEqual(last30.totals, { visitors: 2, registrations: 1, activated: 1, first_payments: 1, first_clients: 0 });
      assert.deepEqual(last90.totals, { visitors: 3, registrations: 2, activated: 2, first_payments: 2, first_clients: 0 });
      assert.deepEqual(last30.rows, [{ source: "google", medium: "organic", campaign_id: "", content_id: "", landing_path: "/precios/", visitors: 2, registrations: 1, activated: 1, first_payments: 1, first_clients: 0 }]);
      assert.equal(last90.rows.length, 2);
      assert.ok(last90.since && last90.cutover_at);
      assert.ok(!JSON.stringify(last90).includes(currentUser));
      assert.ok(!JSON.stringify(last90).includes(currentVisit));
      assert.ok(!JSON.stringify(last90).includes("mp-current-cohort"));
      for (const days of [0, 7, 31, 365, null]) await rejectsStatement("select acquisition_report($1)", [days], /Periodo de medicion/);
      assert.deepEqual((await report(180)).totals, last90.totals);
    });

    await scenario("payment before identification is reconciled from verified billing receipt without reporting nonconsenting accounts", async () => {
      const uid = await user(); const vid = await visit();
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-before-identification", await paidAt(3), "basic"]), { recorded: false });
      assert.equal(await scalar("select count(*)::int from subscription_first_payments"), 1);
      assert.equal((await report()).totals.first_payments, 0);
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-later-renewal", await paidAt(1), "pro"]), { recorded: false });
      assert.deepEqual(await identify(vid, uid), { linked: true });
      const account = (await rows("select first_payment_id,first_paid_at,first_paid_plan from acquisition_accounts where user_id=$1", [uid]))[0];
      assert.equal(account.first_payment_id, "mp-before-identification");
      assert.equal(new Date(account.first_paid_at).getTime(), new Date(await paidAt(3)).getTime());
      assert.equal(account.first_paid_plan, "basic");
      assert.equal((await report()).totals.first_payments, 1);
      await identify(vid, uid);
      assert.equal((await report()).totals.first_payments, 1);
      await rpc("acquisition_revoke", [vid]);
      assert.equal((await report()).totals.first_payments, 0);
      assert.equal(await scalar("select count(*)::int from subscription_first_payments where user_id=$1", [uid]), 1, "billing evidence is independent of optional attribution");
      await rpc("acquisition_record_payment", [uid, "mp-renewal-after-withdrawal", await paidAt(1), "pro"]);
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 0);
      const other = await user();
      await rpc("acquisition_record_payment", [other, "mp-before-identification", await paidAt(3), "basic"]);
      assert.equal(await scalar("select count(*)::int from subscription_first_payments where user_id=$1", [other]), 0, "one verified payment cannot identify two accounts");
      await db.query("delete from auth.users where id=$1", [uid]);
      assert.equal(await scalar("select count(*)::int from subscription_first_payments where user_id=$1", [uid]), 0);
    });

    await scenario("purge bounds withdrawal markers and operational payment receipts to 180 days", async () => {
      const uid = await user({ age: 200, confirmedAge: 199 });
      const marker = randomUUID();
      await rpc("acquisition_revoke", [marker]);
      await db.query("update acquisition_revocations set expires_at=now() where id=$1", [marker]);
      await rpc("acquisition_record_payment", [uid, "mp-retention", await paidAt(170), "basic"]);
      await db.query("update subscription_first_payments set paid_at=now()-interval '181 days' where user_id=$1", [uid]);
      assert.deepEqual(await rpc("acquisition_purge"), { deleted: 0 });
      assert.equal(await scalar("select count(*)::int from acquisition_revocations"), 0);
      assert.equal(await scalar("select count(*)::int from subscription_first_payments"), 0);
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-stale-replay", await paidAt(181), "basic"]), { recorded: false });
      assert.equal(await scalar("select count(*)::int from subscription_first_payments"), 0);
    });

    await scenario("revocation and expiration stop measurement and purge removes linked records", async () => {
      const uid = await user(); const vid = await visit();
      await identify(vid, uid); await loan(uid);
      assert.deepEqual(await rpc("acquisition_revoke", [vid]), { deleted: true });
      assert.deepEqual(await rpc("acquisition_revoke", [vid]), { deleted: false });
      assert.deepEqual(await identify(vid, uid), { linked: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [uid, "mp-revoked", await paidAt(1), "basic"]), { recorded: false });
      await loan(uid);
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 0);
      const expUid = await user(); const expVid = await visit(); await identify(expVid, expUid);
      await db.query("update acquisition_visits set expires_at=now() where id=$1", [expVid]);
      await loan(expUid);
      assert.equal(await scalar("select activated_at from acquisition_accounts where user_id=$1", [expUid]), null);
      assert.deepEqual(await identify(expVid, expUid), { linked: false });
      assert.deepEqual(await rpc("acquisition_record_payment", [expUid, "mp-expired", await paidAt(1), "pro"]), { recorded: false });
      assert.deepEqual((await report()).totals, { visitors: 0, registrations: 0, activated: 0, first_payments: 0, first_clients: 0 });
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 1);
      assert.deepEqual(await rpc("acquisition_purge"), { deleted: 1 });
      assert.equal(await scalar("select count(*)::int from acquisition_accounts"), 0);
      assert.deepEqual(await rpc("acquisition_purge"), { deleted: 0 });
    });
  } finally {
    await db.close();
  }
});
