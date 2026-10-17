-- ERMIF: medición propia y opcional de adquisición, sin datos de clientes/deudores.
-- Migración aditiva. Aplicar solo después de verificar copia de seguridad y permisos.
-- El backend valida el consentimiento, la sesión y la evidencia de Mercado Pago.
begin;

create table if not exists public.acquisition_settings (
  id boolean primary key default true check (id),
  cutover_at timestamptz not null default now()
);
insert into public.acquisition_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.acquisition_visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  consented_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days'),
  consent_version text not null check (consent_version = '2026-10-16'),
  landing_path text not null check (landing_path in (
    '/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/privacidad/', '/terminos/', '/app/'
  )),
  source text not null check (source in (
    'directo', 'google', 'bing', 'duckduckgo', 'chatgpt', 'facebook', 'instagram', 'tiktok',
    'youtube', 'linkedin', 'whatsapp', 'email', 'otro'
  )),
  medium text not null check (medium in (
    'direct', 'organic', 'paid_search', 'paid_social', 'social', 'email', 'referral', 'other'
  )),
  campaign_id text not null default '' check (campaign_id in ('', 'lanzamiento-ermif', 'contenido-educativo')),
  content_id text not null default '' check (content_id in ('', 'menu', 'portada', 'precios', 'video-demo', 'guia', 'calculadora', 'enlace-perfil')),
  check (expires_at > created_at and expires_at <= created_at + interval '180 days')
);
create index if not exists acquisition_visits_expires_idx on public.acquisition_visits(expires_at);
create index if not exists acquisition_visits_created_idx on public.acquisition_visits(created_at);

-- Minimal withdrawal marker prevents a delayed/retried POST from recreating a visit.
create table if not exists public.acquisition_revocations (
  id uuid primary key,
  expires_at timestamptz not null default (now() + interval '180 days')
);
create index if not exists acquisition_revocations_expires_idx on public.acquisition_revocations(expires_at);

-- Operational billing receipt: only the earliest verified payment observed by the
-- backend. No visitor, campaign or customer/debtor information is stored here.
-- This closes the race where payment confirmation arrives before identification.
create table if not exists public.subscription_first_payments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payment_id text not null unique check (payment_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  paid_at timestamptz not null,
  plan text not null check (plan in ('basic', 'pro'))
);
create index if not exists subscription_first_payments_date_idx on public.subscription_first_payments(paid_at);

create table if not exists public.acquisition_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  visit_id uuid not null unique references public.acquisition_visits(id) on delete cascade,
  confirmed_at timestamptz not null,
  activated_at timestamptz,
  first_paid_at timestamptz,
  first_paid_plan text check (first_paid_plan in ('basic', 'pro')),
  first_payment_id text unique check (first_payment_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
  check (activated_at is null or activated_at >= confirmed_at),
  check (first_paid_at is null or first_paid_at >= confirmed_at),
  check (
    (first_paid_at is null and first_paid_plan is null and first_payment_id is null)
    or (first_paid_at is not null and first_paid_plan is not null and first_payment_id is not null)
  )
);

alter table public.acquisition_settings enable row level security;
alter table public.acquisition_visits enable row level security;
alter table public.acquisition_accounts enable row level security;
alter table public.acquisition_revocations enable row level security;
alter table public.subscription_first_payments enable row level security;
-- Incluso service_role utiliza las funciones acotadas, no escrituras arbitrarias.
revoke all on public.acquisition_settings, public.acquisition_visits, public.acquisition_accounts,
  public.acquisition_revocations, public.subscription_first_payments
  from public, anon, authenticated, service_role;

-- Remove the obsolete, non-idempotent signature if an earlier draft was applied.
drop function if exists public.acquisition_visit_create(text, text, text, text, text);
create or replace function public.acquisition_visit_create(
  p_visitor_id uuid,
  p_landing_path text,
  p_source text,
  p_medium text,
  p_campaign_id text,
  p_consent_version text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_visit public.acquisition_visits%rowtype;
begin
  if p_visitor_id is null or p_visitor_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_consent_version is distinct from '2026-10-16'
    or p_landing_path is null or p_landing_path not in ('/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/privacidad/', '/terminos/', '/app/')
    or p_source is null or p_source not in ('directo', 'google', 'bing', 'duckduckgo', 'chatgpt', 'facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'whatsapp', 'email', 'otro')
    or p_medium is null or p_medium not in ('direct', 'organic', 'paid_search', 'paid_social', 'social', 'email', 'referral', 'other')
    or p_campaign_id is null or p_campaign_id not in ('', 'lanzamiento-ermif', 'contenido-educativo') then
    raise exception using errcode = '22023', message = 'Parametros de medicion no permitidos.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ermif:acquisition-visit:' || p_visitor_id::text, 0));
  if exists (select 1 from public.acquisition_revocations where id = p_visitor_id and expires_at > pg_catalog.now()) then
    return pg_catalog.jsonb_build_object('revoked', true);
  end if;
  insert into public.acquisition_visits(id, landing_path, source, medium, campaign_id, consent_version)
  values (p_visitor_id, p_landing_path, p_source, p_medium, p_campaign_id, p_consent_version)
  on conflict (id) do nothing;
  select * into v_visit from public.acquisition_visits where id = p_visitor_id;
  if v_visit.expires_at <= pg_catalog.now() then return pg_catalog.jsonb_build_object('revoked', true); end if;
  return pg_catalog.jsonb_build_object('visitor_id', v_visit.id, 'expires_at', v_visit.expires_at);
end;
$$;

-- Preserve the original RPC for old clients and never overwrite first touch.
create or replace function public.acquisition_visit_create_v2(
  p_visitor_id uuid, p_landing_path text, p_source text, p_medium text,
  p_campaign_id text, p_consent_version text, p_content_id text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_existed boolean; v_result jsonb;
begin
  if p_content_id is null or p_content_id not in ('', 'menu', 'portada', 'precios', 'video-demo', 'guia', 'calculadora', 'enlace-perfil') then
    raise exception using errcode='22023', message='Contenido de campana no permitido.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ermif:acquisition-visit:' || p_visitor_id::text, 0));
  select exists(select 1 from public.acquisition_visits where id=p_visitor_id) into v_existed;
  v_result := public.acquisition_visit_create(p_visitor_id,p_landing_path,p_source,p_medium,p_campaign_id,p_consent_version);
  if not v_existed and v_result ? 'visitor_id' then
    update public.acquisition_visits set content_id=p_content_id where id=p_visitor_id;
  end if;
  return v_result;
end;
$$;
revoke all on function public.acquisition_visit_create_v2(uuid,text,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.acquisition_visit_create_v2(uuid,text,text,text,text,text,text) to service_role;

create or replace function public.acquisition_identify(p_visitor_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_visit public.acquisition_visits%rowtype;
  v_created_at timestamptz;
  v_confirmed_at timestamptz;
  v_cutover_at timestamptz;
  v_existing_visit uuid;
  v_existing_user uuid;
begin
  if p_visitor_id is null or p_user_id is null then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;
  -- Serialize linking and verified payment capture for the same account.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ermif:acquisition-account:' || p_user_id::text, 0));
  select * into v_visit from public.acquisition_visits where id = p_visitor_id for update;
  if not found or v_visit.expires_at <= pg_catalog.now() or v_visit.consent_version <> '2026-10-16' then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;
  select cutover_at into v_cutover_at from public.acquisition_settings where id;
  select created_at, email_confirmed_at into v_created_at, v_confirmed_at
    from auth.users where id = p_user_id;
  if v_cutover_at is null or v_created_at is null or v_confirmed_at is null
    or v_created_at < v_cutover_at or v_confirmed_at < v_created_at or v_confirmed_at > pg_catalog.now()
    or v_visit.created_at > v_created_at or v_created_at > v_visit.created_at + interval '30 days' then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;

  select user_id into v_existing_user from public.acquisition_accounts where visit_id = p_visitor_id;
  if found and v_existing_user <> p_user_id then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;
  select visit_id into v_existing_visit from public.acquisition_accounts where user_id = p_user_id for update;
  if found and v_existing_visit <> p_visitor_id then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;

  insert into public.acquisition_accounts(user_id, visit_id, confirmed_at)
  values (p_user_id, p_visitor_id, v_confirmed_at)
  on conflict do nothing;
  -- Recheck after a concurrent attempt: neither a visitor nor an account can be reassigned.
  if not exists (select 1 from public.acquisition_accounts where user_id = p_user_id and visit_id = p_visitor_id) then
    return pg_catalog.jsonb_build_object('linked', false);
  end if;

  -- Reconcile a loan saved before identification. This is the observation time,
  -- never an assertion that a client-provided created_at is an exact event time.
  if pg_catalog.current_setting('app.restoring_snapshot', true) is distinct from 'on'
    and exists (select 1 from public.loans where user_id = p_user_id
      and created_at >= v_created_at and created_at <= pg_catalog.now()) then
    update public.acquisition_accounts set activated_at = coalesce(activated_at, pg_catalog.now())
      where user_id = p_user_id;
  end if;
  update public.acquisition_accounts as a
    set first_paid_at = p.paid_at, first_paid_plan = p.plan, first_payment_id = p.payment_id
    from public.subscription_first_payments as p
    where a.user_id = p_user_id and p.user_id = a.user_id and p.paid_at >= a.confirmed_at
      and (a.first_paid_at is null or p.paid_at < a.first_paid_at);
  return pg_catalog.jsonb_build_object('linked', true);
end;
$$;

create or replace function public.acquisition_mark_activation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('app.restoring_snapshot', true) = 'on' then return new; end if;
  update public.acquisition_accounts as a set activated_at = pg_catalog.now()
    from public.acquisition_visits as v, auth.users as u
    where a.user_id = new.user_id and a.activated_at is null and a.visit_id = v.id and u.id = a.user_id
      and v.expires_at > pg_catalog.now() and v.consent_version = '2026-10-16'
      and new.created_at >= u.created_at and new.created_at <= pg_catalog.now()
      and a.confirmed_at <= pg_catalog.now();
  return new;
exception when others then
  -- Optional measurement must never prevent saving the user's business operation.
  -- Do not log SQLERRM or row contents: they may contain private information.
  raise warning 'ERMIF: no se pudo actualizar un hito de medicion opcional.';
  return new;
end;
$$;
drop trigger if exists acquisition_activation_after on public.loans;
create trigger acquisition_activation_after after insert on public.loans
  for each row execute function public.acquisition_mark_activation();

create or replace function public.acquisition_record_payment(
  p_user_id uuid,
  p_payment_id text,
  p_paid_at timestamptz,
  p_plan text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_account public.acquisition_accounts%rowtype;
  v_receipt public.subscription_first_payments%rowtype;
  v_payment_id text := pg_catalog.btrim(p_payment_id);
begin
  if v_payment_id is null or v_payment_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
    or p_paid_at is null or not pg_catalog.isfinite(p_paid_at) or p_paid_at > pg_catalog.now()
    or p_plan is null or p_plan not in ('basic', 'pro') then
    raise exception using errcode = '22023', message = 'Evidencia de pago no valida.';
  end if;
  if p_user_id is null or p_paid_at <= pg_catalog.now() - interval '180 days'
    or not exists (select 1 from auth.users where id = p_user_id and created_at <= p_paid_at
      and email_confirmed_at is not null and email_confirmed_at <= p_paid_at) then
    return pg_catalog.jsonb_build_object('recorded', false);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ermif:acquisition-account:' || p_user_id::text, 0));
  if exists (select 1 from public.subscription_first_payments where payment_id = v_payment_id and user_id <> p_user_id) then
    return pg_catalog.jsonb_build_object('recorded', false);
  end if;
  insert into public.subscription_first_payments(user_id, payment_id, paid_at, plan)
    values (p_user_id, v_payment_id, p_paid_at, p_plan)
    on conflict (user_id) do update set payment_id = excluded.payment_id, paid_at = excluded.paid_at, plan = excluded.plan
      where excluded.paid_at < public.subscription_first_payments.paid_at;
  select * into v_receipt from public.subscription_first_payments where user_id = p_user_id;
  select a.* into v_account from public.acquisition_accounts as a
    join public.acquisition_visits as v on v.id = a.visit_id
    where a.user_id = p_user_id and v.expires_at > pg_catalog.now() and v.consent_version = '2026-10-16'
    for update of a;
  if not found or v_receipt.paid_at < v_account.confirmed_at then
    return pg_catalog.jsonb_build_object('recorded', false);
  end if;
  if v_account.first_paid_at is not null and v_account.first_paid_at <= v_receipt.paid_at then
    return pg_catalog.jsonb_build_object('recorded', false);
  end if;
  if exists (select 1 from public.acquisition_accounts where first_payment_id = v_receipt.payment_id and user_id <> p_user_id) then
    return pg_catalog.jsonb_build_object('recorded', false);
  end if;
  update public.acquisition_accounts
    set first_paid_at = v_receipt.paid_at, first_paid_plan = v_receipt.plan, first_payment_id = v_receipt.payment_id
    where user_id = p_user_id;
  return pg_catalog.jsonb_build_object('recorded', true);
exception when unique_violation then
  return pg_catalog.jsonb_build_object('recorded', false);
end;
$$;

create or replace function public.acquisition_revoke(p_visitor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if p_visitor_id is null then return pg_catalog.jsonb_build_object('deleted', false); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ermif:acquisition-visit:' || p_visitor_id::text, 0));
  insert into public.acquisition_revocations(id) values (p_visitor_id)
    on conflict (id) do update set expires_at = greatest(public.acquisition_revocations.expires_at, excluded.expires_at);
  delete from public.acquisition_visits where id = p_visitor_id;
  get diagnostics v_deleted = row_count;
  return pg_catalog.jsonb_build_object('deleted', v_deleted > 0);
end;
$$;

create or replace function public.acquisition_purge()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  delete from public.acquisition_visits where expires_at <= pg_catalog.now();
  get diagnostics v_deleted = row_count;
  delete from public.acquisition_revocations where expires_at <= pg_catalog.now();
  delete from public.subscription_first_payments where paid_at <= pg_catalog.now() - interval '180 days';
  return pg_catalog.jsonb_build_object('deleted', v_deleted);
end;
$$;

-- The first-client milestone is observed server-side; never copy the client row.
alter table public.acquisition_accounts add column if not exists first_client_at timestamptz;
create or replace function public.acquisition_mark_first_client()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_catalog.current_setting('app.restoring_snapshot',true) = 'on' then return new; end if;
  update public.acquisition_accounts a set first_client_at=pg_catalog.now()
    from public.acquisition_visits v, auth.users u
    where a.user_id=new.user_id and a.visit_id=v.id and u.id=a.user_id and a.first_client_at is null
      and v.expires_at>pg_catalog.now() and a.confirmed_at<=pg_catalog.now()
      and new.created_at>=u.created_at and new.created_at<=pg_catalog.now();
  return new;
exception when others then
  raise warning 'ERMIF: no se pudo actualizar un hito de medicion opcional.';
  return new;
end;
$$;
drop trigger if exists acquisition_first_client_after on public.clients;
create trigger acquisition_first_client_after after insert on public.clients
  for each row execute function public.acquisition_mark_first_client();
revoke all on function public.acquisition_mark_first_client() from public,anon,authenticated,service_role;

create or replace function public.acquisition_identify_v2(p_visitor_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_account public.acquisition_accounts%rowtype;
begin
  v_result:=public.acquisition_identify(p_visitor_id,p_user_id);
  if v_result->>'linked' is distinct from 'true' then return v_result; end if;
  if pg_catalog.current_setting('app.restoring_snapshot',true) is distinct from 'on'
    and exists(select 1 from public.clients c join auth.users u on u.id=c.user_id
      where c.user_id=p_user_id and c.created_at>=u.created_at and c.created_at<=pg_catalog.now()) then
    update public.acquisition_accounts set first_client_at=coalesce(first_client_at,pg_catalog.now()) where user_id=p_user_id;
  end if;
  select * into v_account from public.acquisition_accounts where user_id=p_user_id and visit_id=p_visitor_id;
  return pg_catalog.jsonb_build_object('linked',true,'milestones',pg_catalog.jsonb_build_object(
    'sign_up',true,'first_client_created',v_account.first_client_at is not null,
    'first_loan_created',v_account.activated_at is not null,'subscription_paid',v_account.first_paid_at is not null));
end;
$$;
revoke all on function public.acquisition_identify_v2(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.acquisition_identify_v2(uuid,uuid) to service_role;

create or replace function public.acquisition_report(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cutover timestamptz;
  v_since timestamptz;
  v_totals jsonb;
  v_rows jsonb;
begin
  if p_days is null or p_days not in (30, 90, 180) then
    raise exception using errcode = '22023', message = 'Periodo de medicion no permitido.';
  end if;
  select cutover_at into v_cutover from public.acquisition_settings where id;
  if v_cutover is null then raise exception 'Configuracion de medicion no disponible.'; end if;
  v_since := greatest(v_cutover, pg_catalog.now() - pg_catalog.make_interval(days => p_days));
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'source', r.source, 'medium', r.medium, 'campaign_id', r.campaign_id, 'content_id', r.content_id, 'landing_path', r.landing_path,
    'visitors', r.visitors, 'registrations', r.registrations, 'first_clients', r.first_clients, 'activated', r.activated, 'first_payments', r.first_payments
  ) order by r.visitors desc, r.source, r.medium, r.campaign_id, r.content_id, r.landing_path), '[]'::jsonb) into v_rows
  from (
    select v.source, v.medium, v.campaign_id, v.content_id, v.landing_path, count(*)::integer as visitors,
      count(a.user_id)::integer as registrations, count(a.first_client_at)::integer as first_clients, count(a.activated_at)::integer as activated,
      count(a.first_paid_at)::integer as first_payments
    from public.acquisition_visits as v left join public.acquisition_accounts as a on a.visit_id = v.id
    where v.created_at >= v_since and v.created_at <= pg_catalog.now()
      and v.expires_at > pg_catalog.now() and v.consent_version = '2026-10-16'
    group by v.source, v.medium, v.campaign_id, v.content_id, v.landing_path
  ) as r;
  -- Derive totals from the same grouped snapshot: concurrent visits/revocations
  -- cannot make the cards disagree with the report rows.
  select pg_catalog.jsonb_build_object(
    'visitors', coalesce(sum((value ->> 'visitors')::bigint), 0),
    'registrations', coalesce(sum((value ->> 'registrations')::bigint), 0),
    'first_clients', coalesce(sum((value ->> 'first_clients')::bigint), 0),
    'activated', coalesce(sum((value ->> 'activated')::bigint), 0),
    'first_payments', coalesce(sum((value ->> 'first_payments')::bigint), 0)
  ) into v_totals from pg_catalog.jsonb_array_elements(v_rows);
  return pg_catalog.jsonb_build_object('since', v_since, 'cutover_at', v_cutover, 'totals', v_totals, 'rows', v_rows);
end;
$$;

revoke all on function public.acquisition_visit_create(uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.acquisition_identify(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.acquisition_mark_activation() from public, anon, authenticated, service_role;
revoke all on function public.acquisition_record_payment(uuid, text, timestamptz, text) from public, anon, authenticated, service_role;
revoke all on function public.acquisition_revoke(uuid) from public, anon, authenticated, service_role;
revoke all on function public.acquisition_purge() from public, anon, authenticated, service_role;
revoke all on function public.acquisition_report(integer) from public, anon, authenticated, service_role;
grant execute on function public.acquisition_visit_create(uuid, text, text, text, text, text) to service_role;
grant execute on function public.acquisition_identify(uuid, uuid) to service_role;
grant execute on function public.acquisition_record_payment(uuid, text, timestamptz, text) to service_role;
grant execute on function public.acquisition_revoke(uuid) to service_role;
grant execute on function public.acquisition_purge() to service_role;
grant execute on function public.acquisition_report(integer) to service_role;

commit;
