import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration=fs.readFileSync(new URL('../migrations/20261008_transactional_email.sql',import.meta.url),'utf8').replace(/^\uFEFF/,'');
const fixture=`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table public.claim_book_entries(id uuid primary key default gen_random_uuid(),claim_code text unique,email text,request_type text,created_at timestamptz default now(),due_at timestamptz,request text,response text,response_version integer default 0,responded_at timestamptz,status text default 'received',received_email_status text,received_email_sent_at timestamptz,received_email_error text,response_email_status text,response_email_sent_at timestamptz,response_email_error text);
create table public.privacy_requests(id uuid primary key default gen_random_uuid(),request_code text,requester_email text,request_type text,submitted_at timestamptz default now(),due_at timestamptz,response text,responded_at timestamptz,status text default 'received');
create table public.account_deletion_requests(id uuid primary key default gen_random_uuid(),request_code text,email text,user_id uuid,requested_at timestamptz default now(),scheduled_deletion_at timestamptz,status text default 'received');
create table public.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid,plan text default 'free',status text default 'active',current_period_end timestamptz,updated_at timestamptz default now());
create table public.email_outbox(id uuid primary key default gen_random_uuid(),event_key text not null unique,recipient text not null,subject text not null,payload jsonb default '{}',status text not null default 'pending_configuration' check(status in ('pending_configuration','pending','sent','error','skipped')),sent_at timestamptz,last_error text,attempts integer not null default 0,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
alter table public.email_outbox enable row level security;
`;
test('migración y cola ejecutadas en PostgreSQL local en memoria',async t=>{
 const db=new PGlite();
 try {
 await db.exec(fixture);await db.exec(migration);await db.exec(migration);
 const query=async(sql,params=[]) => (await db.query(sql,params)).rows;
 const scalar=async(sql,params=[]) => Object.values((await query(sql,params))[0])[0];
 const claim=async(code='TEST-1') => (await query("insert into claim_book_entries(claim_code,email,request) values($1,'user@example.invalid','Solicitud ficticia') returning id",[code]))[0].id;
 async function scenario(name,fn) { await t.test(name,async()=>{await db.exec('begin');try {await fn();}finally{await db.exec('rollback');}}); }
 await scenario('desactivada por defecto y privilegios de RPC restringidos',async()=>{
   await claim();assert.equal(await scalar('select enabled from email_settings'),false);
   assert.equal((await query('select * from email_claim_next()')).length,0);
   for(const role of ['anon','authenticated']) assert.equal(await scalar("select has_function_privilege($1,'public.email_claim_next()','EXECUTE')",[role]),false);
   assert.equal(await scalar("select has_function_privilege('service_role','public.email_claim_next()','EXECUTE')"),true);
   await db.exec('set local role authenticated');await assert.rejects(db.query('select * from email_settings'));await db.exec('rollback; begin');
 });
 await scenario('reclamo y alerta interna se guardan una sola vez y la respuesta es atómica',async()=>{
   const id=await claim();assert.equal(await scalar('select count(*)::int from email_outbox'),2);
   assert.equal(await scalar("select payload::text from email_outbox where event_key like 'internal_alert:%'"),'{"requestCode": "TEST-1"}');
   await db.query("update claim_book_entries set response='Respuesta guardada',response_version=1,status='answered',responded_at=now() where id=$1",[id]);
   assert.equal(await scalar("select payload->>'response' from email_outbox where event_key like 'claim_response:%'"),'Respuesta guardada');
   await db.query("update claim_book_entries set status='closed' where id=$1",[id]);assert.equal(await scalar('select count(*)::int from email_outbox'),3);
   await db.exec('savepoint check_atomic');await claim('ROLLBACK');await db.exec('rollback to check_atomic');
   assert.equal(await scalar("select count(*)::int from email_outbox where subject like '%ROLLBACK%'"),0);
 });
 await scenario('privacidad y eliminación generan eventos por cambios reales',async()=>{
   const p=(await query("insert into privacy_requests(request_code,requester_email,request_type) values('ARCO-1','user@example.invalid','acceso') returning id"))[0];
   await db.query("update privacy_requests set response='Revisión completada',status='answered',responded_at=now() where id=$1",[p.id]);
   await db.query("update privacy_requests set response='Revisión completada' where id=$1",[p.id]);
   assert.equal(await scalar("select count(*)::int from email_outbox where event_key like 'privacy_response:%'"),1);
   const d=(await query("insert into account_deletion_requests(request_code,email) values('DEL-1','user@example.invalid') returning id"))[0];
   await db.query("update account_deletion_requests set status='cancelled' where id=$1",[d.id]);
   assert.equal(await scalar("select count(*)::int from email_outbox where event_key like 'account_deletion_%'"),2);
 });
 await scenario('webhooks repetidos no repiten el aviso de suscripción',async()=>{
   const uid='11111111-1111-4111-8111-111111111111';
   await db.query("insert into auth.users values($1,'verified@example.invalid',now())",[uid]);
   const sub=(await query("insert into subscriptions(user_id) values($1) returning id",[uid]))[0];
   assert.equal(await scalar('select count(*)::int from email_outbox'),0);
   await db.query("update subscriptions set plan='pro',updated_at=now() where id=$1",[sub.id]);
   await db.query("update subscriptions set plan='pro',updated_at=now()+interval '1 minute' where id=$1",[sub.id]);
   assert.equal(await scalar('select count(*)::int from email_outbox'),1);
   assert.equal(await scalar('select recipient from email_outbox'),'verified@example.invalid');
 });
 await scenario('activación excluye correos anteriores y respeta límite diario',async()=>{
   await claim();await db.exec("update email_outbox set created_at=now()-interval '1 day'; update email_settings set enabled=true,activated_at=now(),daily_limit=1");
   assert.equal((await query('select * from email_claim_next()')).length,0);
   await claim('NEW');const first=(await query('select * from email_claim_next()'))[0];assert.equal(first.attempts,1);assert.equal(first.status,'sending');
   assert.equal((await query('select * from email_claim_next()')).length,0);
 });
 await scenario('reservas no comparten mensaje y leases vencidos no reenvían',async()=>{
   await claim();await db.exec("update email_settings set enabled=true,activated_at=now()-interval '1 second'");
   const a=(await query('select * from email_claim_next()'))[0], b=(await query('select * from email_claim_next()'))[0];assert.notEqual(a.id,b.id);
   await db.exec("update email_outbox set lease_until=now()-interval '1 second'");assert.equal((await query('select * from email_claim_next()')).length,0);
   assert.equal(await scalar("select count(*)::int from email_outbox where status='unknown'"),2);
 });
 await scenario('evento temprano se conserva, entrega no retrocede y finalización no se repite',async()=>{
   const id=await claim();await db.exec("update email_settings set enabled=true,activated_at=now()-interval '1 second'; update email_outbox set status='skipped' where event_key like 'internal_alert:%'");
   const row=(await query('select * from email_claim_next()'))[0];
   await db.exec("select email_record_delivery('event-delivered','cf-1','delivered',now()); select email_record_delivery('event-deferred','cf-1','deferred',now()+interval '1 minute')");
   assert.equal(await scalar("select email_finish_attempt($1,$2,'accepted','cf-1',null,0)",[row.id,row.lease_token]),true);
   assert.equal(await scalar('select delivery_status from email_outbox where id=$1',[row.id]),'delivered');
   assert.equal(await scalar('select received_email_status from claim_book_entries where id=$1',[id]),'delivered');
   assert.equal(await scalar("select email_finish_attempt($1,$2,'accepted','cf-1',null,0)",[row.id,row.lease_token]),false);
   assert.equal((await query('select * from email_claim_next()')).length,0);
 });
 await scenario('cuota mensual y reintentos agotados detienen nuevos envíos',async()=>{
   await claim();await db.exec("update email_settings set enabled=true,activated_at=now()-interval '1 second',budget_month=date_trunc('month',current_date),monthly_used=monthly_limit");
   assert.equal((await query('select * from email_claim_next()')).length,0);
   await db.exec("update email_settings set monthly_used=0; update email_outbox set attempts=4; update email_outbox set status='skipped' where event_key like 'internal_alert:%'");
   const row=(await query('select * from email_claim_next()'))[0];assert.equal(row.attempts,5);
   await db.query("select email_finish_attempt($1,$2,'retry',null,'E_RATE_LIMIT_EXCEEDED',300)",[row.id,row.lease_token]);
   assert.equal(await scalar('select status from email_outbox where id=$1',[row.id]),'error');
 });
 await scenario('versión antigua no sobrescribe evidencia de respuesta actual',async()=>{
   const id=await claim();await db.query("update claim_book_entries set response='Uno',response_version=1 where id=$1",[id]);
   await db.query("update claim_book_entries set response='Dos',response_version=2 where id=$1",[id]);
   await db.query("update email_outbox set status='accepted' where event_key=$1",['claim_response:'+id+':1']);
   assert.equal(await scalar('select response_email_status from claim_book_entries where id=$1',[id]),'pending');
 });
 }finally{await db.close();}
});

test('SQL de activación excluye el histórico y no cambia la fecha al repetirse',async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture); await db.exec(migration);
  await db.exec("insert into claim_book_entries(claim_code,email) values('HISTORICO','owner@example.invalid'); update email_outbox set created_at=now()-interval '1 day';");
  const activation=fs.readFileSync(new URL('../migrations/20261008_activate_transactional_email.sql',import.meta.url),'utf8');
  await db.exec(activation);
  const first=(await db.query('select enabled,activated_at from email_settings')).rows[0];
  assert.equal(first.enabled,true);
  assert.equal((await db.query('select * from email_claim_next()')).rows.length,0);
  await db.exec(activation);
  const second=(await db.query('select activated_at from email_settings')).rows[0];
  assert.equal(new Date(second.activated_at).getTime(),new Date(first.activated_at).getTime());
  await db.exec("insert into claim_book_entries(claim_code,email) values('NUEVO','owner@example.invalid');");
  const next=(await db.query('select * from email_claim_next()')).rows[0];
  assert.ok(next);assert.match(next.subject,/NUEVO/);
 } finally { await db.close(); }
});
