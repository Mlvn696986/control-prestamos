-- Scoped attribution migration. Verify the backup and PostgreSQL tests first.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$
begin
  if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='acquisition_visits' and c.relrowsecurity and pg_catalog.pg_get_userbyid(c.relowner)='postgres')
    or not exists(select 1 from pg_catalog.pg_proc p where p.oid='public.acquisition_visit_create(uuid,text,text,text,text,text)'::regprocedure
      and pg_catalog.pg_get_userbyid(p.proowner)='postgres' and p.prosecdef)
    or pg_catalog.has_function_privilege('anon','public.acquisition_visit_create(uuid,text,text,text,text,text)','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','public.acquisition_visit_create(uuid,text,text,text,text,text)','EXECUTE') then
    raise exception 'Unexpected acquisition schema or privileges; migration stopped.';
  end if;
end $$;
alter table public.acquisition_visits drop constraint acquisition_visits_landing_path_check;
alter table public.acquisition_visits add constraint acquisition_visits_landing_path_check
  check (landing_path in ('/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/privacidad/', '/terminos/', '/app/'));
alter table public.acquisition_visits drop constraint acquisition_visits_source_check;
alter table public.acquisition_visits add constraint acquisition_visits_source_check
  check (source in ('directo','google','bing','duckduckgo','chatgpt','facebook','instagram','tiktok','youtube','linkedin','whatsapp','email','otro'));
alter table public.acquisition_visits add column if not exists content_id text not null default '' check (content_id in ('', 'menu', 'portada', 'precios', 'video-demo', 'guia', 'calculadora', 'enlace-perfil'));
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
commit;
