-- Only allow the three new public pages; do not change visitors, consent, grants or business data.
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
  check (landing_path in ('/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/control-de-cobranzas/', '/ampliaciones-de-prestamos/', '/reclamaciones/', '/privacidad/', '/terminos/', '/app/'));
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
    or p_landing_path is null or p_landing_path not in ('/', '/precios/', '/como-funciona/', '/contacto/', '/seguridad/', '/control-de-cobranzas/', '/ampliaciones-de-prestamos/', '/reclamaciones/', '/privacidad/', '/terminos/', '/app/')
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
commit;
