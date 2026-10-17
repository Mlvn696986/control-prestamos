import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { handleAcquisitionRequest } from '../src/acquisition.js';

const old = fs.readFileSync(new URL('./fixtures/acquisition-v1.sql', import.meta.url), 'utf8');
const upgrade = fs.readFileSync(new URL('../supabase-acquisition-attribution-v2.sql', import.meta.url), 'utf8');
const pagesUpgrade = fs.readFileSync(new URL('../supabase-acquisition-public-pages-v3.sql', import.meta.url), 'utf8');
const fresh = fs.readFileSync(new URL('../supabase-acquisition.sql', import.meta.url), 'utf8');
const fixture = [
  'create role anon; create role authenticated; create role service_role; create schema auth;',
  'create table auth.users(id uuid primary key, created_at timestamptz default now(), email_confirmed_at timestamptz);',
  'create table public.clients (id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),created_at timestamptz default now());',
  'create table public.loans(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),created_at timestamptz default now());',
  'create table public.subscriptions(user_id uuid primary key references auth.users(id),plan text,status text);',
].join('\n');

test('upgrade preserves old attribution, permissions and cutover; new paths and content remain bounded', async () => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
  const oldId = randomUUID();
  const newId = randomUUID();
  const create = (id, path = '/seguridad/', source = 'chatgpt', content = 'video-demo') =>
    scalar('select acquisition_visit_create_v2($1,$2,$3,$4,$5,$6,$7)', [id, path, source, 'referral', 'contenido-educativo', '2026-10-16', content]);
  try {
    await db.exec(fixture);
    await db.exec(old);
    await scalar("select acquisition_visit_create($1,'/precios/','google','organic','','2026-10-16')", [oldId]);
    const before = await db.query('select * from acquisition_visits where id=$1', [oldId]);
    const cutover = await scalar('select cutover_at from acquisition_settings');
    await db.exec(upgrade);
    await db.exec(upgrade);
    assert.deepEqual((await db.query('select * from acquisition_visits where id=$1', [oldId])).rows[0], { ...before.rows[0], content_id: '' });
    assert.deepEqual(await scalar('select cutover_at from acquisition_settings'), cutover);
    const created = await create(newId);
    assert.equal(created.visitor_id, newId);
    await create(newId, '/', 'facebook', 'menu');
    await create(oldId);
    assert.deepEqual((await db.query('select landing_path,source,content_id from acquisition_visits where id=$1',[newId])).rows[0],
      { landing_path: '/seguridad/', source: 'chatgpt', content_id: 'video-demo' });
    assert.equal(await scalar('select content_id from acquisition_visits where id=$1',[oldId]), '');
    for (const [path, source, content] of [['/app/private-name/','chatgpt','menu'],['/seguridad/','private@email.invalid','menu'],['/seguridad/','chatgpt','private@email.invalid']]) {
      await assert.rejects(create(randomUUID(),path,source,content), /no permitid/);
    }
    const signature='public.acquisition_visit_create_v2(uuid,text,text,text,text,text,text)';
    for (const role of ['anon','authenticated']) {
      assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,signature]), false);
      assert.equal(await scalar("select has_table_privilege($1,'public.acquisition_visits','SELECT')",[role]), false);
    }
    assert.equal(await scalar("select has_function_privilege('service_role',$1,'EXECUTE')",[signature]), true);
    const report = await scalar('select acquisition_report(30)');
    assert.equal(report.totals.visitors, 2);
    assert.ok(report.rows.some(row => row.source==='chatgpt' && row.content_id==='video-demo' && row.landing_path==='/seguridad/'));
    await scalar('select acquisition_revoke($1)',[newId]);
    assert.deepEqual(await create(newId), { revoked: true });
    assert.equal(await scalar('select count(*)::integer from acquisition_visits'), 1);
    await db.exec(pagesUpgrade);
    await db.exec(pagesUpgrade);
    assert.deepEqual(await scalar('select cutover_at from acquisition_settings'), cutover);
    assert.equal(await scalar('select count(*)::integer from acquisition_visits'), 1);
    const existing = (await db.query('select * from acquisition_visits where id=$1',[oldId])).rows[0];
    assert.deepEqual(existing, { ...before.rows[0], content_id: '' });
    for (const path of ['/control-de-cobranzas/','/ampliaciones-de-prestamos/','/reclamaciones/']) {
      const id = randomUUID();
      await create(id, path);
      await create(id, '/');
      assert.equal(await scalar('select landing_path from acquisition_visits where id=$1',[id]), path);
      await scalar('select acquisition_revoke($1)', [id]);
      assert.deepEqual(await create(id,path), { revoked: true });
    }
    for (const path of ['/app/private-client/','/reclamaciones/private-id/','/control-de-cobranzas/?email=private','/guias/']) {
      await assert.rejects(create(randomUUID(),path), /no permitid/);
    }
    for (const role of ['anon','authenticated']) {
      assert.equal(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,signature]), false);
      assert.equal(await scalar("select has_function_privilege($1,'public.acquisition_visit_create(uuid,text,text,text,text,text)','EXECUTE')",[role]), false);
    }
    // The three affected RPC definitions must match fresh installations.
    const definitions = await db.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('acquisition_visit_create','acquisition_visit_create_v2','acquisition_report') order by proname");
    const clean = new PGlite();
    try {
      await clean.exec(fixture); await clean.exec(fresh);
      assert.deepEqual((await clean.query("select proname,pg_get_functiondef(oid) as definition from pg_proc where proname in ('acquisition_visit_create','acquisition_visit_create_v2','acquisition_report') order by proname")).rows, definitions.rows);
    } finally { await clean.close(); }
  } finally { await db.close(); }
});

test('worker accepts Seguridad/ChatGPT with approved content, rejects private content and supports old clients', async () => {
  const calls=[];
  const env={ ACQUISITION_RATE_LIMITER: {limit:async()=>({success:true})} };
  const services={rpc:async(name,body)=>{calls.push({name,body});return {visitor_id:body.p_visitor_id};}};
  const body={visitor_id:randomUUID(),consent:true,consent_version:'2026-10-16',landing_path:'/seguridad/',source:'chatgpt',medium:'referral',campaign_id:'contenido-educativo',content_id:'video-demo'};
  const request = data => new Request('https://ermif.com/api/acquisition/visit',{method:'POST',headers:{Origin:'https://ermif.com','Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await handleAcquisitionRequest(request(body),env,services)).status,201);
  assert.equal(calls[0].name,'acquisition_visit_create_v2');
  assert.equal(calls[0].body.p_content_id,'video-demo');
  assert.equal((await handleAcquisitionRequest(request({...body,content_id:'private@email.invalid'}),env,services)).status,400);
  assert.equal(calls.length,1);
  const legacy={...body};delete legacy.content_id;
  assert.equal((await handleAcquisitionRequest(request(legacy),env,services)).status,201);
  assert.equal(calls[1].body.p_content_id,'');
  for (const path of ['/control-de-cobranzas/','/ampliaciones-de-prestamos/','/reclamaciones/']) {
    assert.equal((await handleAcquisitionRequest(request({...body,landing_path:path}),env,services)).status,201);
    assert.equal(calls.at(-1).body.p_landing_path,path);
  }
  assert.equal((await handleAcquisitionRequest(request({...body,landing_path:'/reclamaciones/private-id/'}),env,services)).status,400);
});
