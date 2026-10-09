-- ERMIF: cola transaccional v2. NO ejecutar en producción sin copia verificada y autorización.
-- Requiere el esquema legal existente. No importa datos ni activa envíos.
begin;
alter table public.email_outbox drop constraint if exists email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check check
  (status in ('pending_configuration','pending','sending','retry','accepted','sent','error','unknown','skipped'));
alter table public.email_outbox add column if not exists lease_token uuid;
alter table public.email_outbox add column if not exists lease_until timestamptz;
alter table public.email_outbox add column if not exists next_attempt_at timestamptz not null default now();
alter table public.email_outbox add column if not exists last_attempt_at timestamptz;
alter table public.email_outbox add column if not exists provider_message_id text;
alter table public.email_outbox add column if not exists accepted_at timestamptz;
alter table public.email_outbox add column if not exists delivery_status text;
alter table public.email_outbox add column if not exists delivery_at timestamptz;
create unique index if not exists email_outbox_provider_id_idx on public.email_outbox(provider_message_id) where provider_message_id is not null;
create index if not exists email_outbox_recipient_attempt_idx on public.email_outbox(lower(recipient),last_attempt_at);
create table if not exists public.email_settings (
  id boolean primary key default true check(id), enabled boolean not null default false,
  activated_at timestamptz, admin_email text not null default 'mlvn696986@gmail.com',
  daily_limit integer not null default 200 check(daily_limit between 1 and 3000),
  budget_date date, budget_used integer not null default 0,
  monthly_limit integer not null default 2000 check(monthly_limit between 1 and 3000),
  budget_month date, monthly_used integer not null default 0,
  check(not enabled or activated_at is not null)
);
insert into public.email_settings(id) values(true) on conflict do nothing;
create table if not exists public.email_delivery_events (
  event_id text primary key, message_id text not null, status text not null
    check(status in ('delivered','deferred','bounced','failed','rejected','complained')),
  occurred_at timestamptz not null
);
create index if not exists email_delivery_events_message_idx on public.email_delivery_events(message_id,occurred_at);
alter table public.email_settings enable row level security;
alter table public.email_delivery_events enable row level security;
revoke all on public.email_settings, public.email_delivery_events from public, anon, authenticated;
grant select,insert,update,delete on public.email_settings, public.email_delivery_events to service_role;

-- Nunca genera destinatarios arbitrarios desde el navegador: los toma del expediente guardado.
create or replace function public.email_enqueue(p_key text,p_to text,p_subject text,p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_to is null or btrim(p_to) = '' then return; end if;
  insert into public.email_outbox(event_key,recipient,subject,payload,status,last_error)
  values(p_key,lower(btrim(p_to)),p_subject,p_payload,'pending',null)
  on conflict(event_key) do nothing;
end $$;

alter table public.privacy_requests add column if not exists email_revision integer not null default 0;
alter table public.account_deletion_requests add column if not exists email_revision integer not null default 0;
alter table public.subscriptions add column if not exists email_revision integer not null default 0;
create or replace function public.email_bump_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.email_revision := 0;
  elsif (tg_table_name = 'privacy_requests' and (to_jsonb(new)->>'response') is distinct from (to_jsonb(old)->>'response'))
    or (tg_table_name = 'account_deletion_requests' and new.status is distinct from old.status)
    or (tg_table_name = 'subscriptions' and (new.status is distinct from old.status or (to_jsonb(new)->>'plan') is distinct from (to_jsonb(old)->>'plan') or (to_jsonb(new)->>'current_period_end') is distinct from (to_jsonb(old)->>'current_period_end'))) then
    new.email_revision := old.email_revision + 1;
  else new.email_revision := old.email_revision; end if;
  return new;
end $$;
create or replace function public.email_capture_event()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v jsonb := to_jsonb(new); prev jsonb; k text; recipient text; subject text; payload jsonb; code text; notify_admin boolean := false; admin_address text;
begin
  if tg_op = 'UPDATE' then prev := to_jsonb(old); end if;
  if tg_table_name = 'claim_book_entries' then
    code := v->>'claim_code'; recipient := v->>'email';
    if tg_op = 'INSERT' then
      k := 'claim_received:' || new.id; subject := 'ERMIF - Recibimos tu reclamación ' || code; notify_admin := true;
      payload := jsonb_build_object('claimCode',code,'requestType',v->>'request_type','createdAt',v->>'created_at','dueAt',v->>'due_at','requestSummary',v->>'request');
    elsif (v->>'response_version') is distinct from (prev->>'response_version') and nullif(btrim(v->>'response'),'') is not null then
      k := 'claim_response:' || new.id || ':' || (v->>'response_version'); subject := 'ERMIF - Respuesta a tu reclamación ' || code;
      payload := jsonb_build_object('claimCode',code,'response',v->>'response','respondedAt',v->>'responded_at');
    end if;
  elsif tg_table_name = 'privacy_requests' then
    code := v->>'request_code'; recipient := v->>'requester_email';
    if tg_op = 'INSERT' then
      k := 'privacy_received:' || new.id; subject := 'ERMIF - Solicitud de privacidad ' || code; notify_admin := true;
      payload := jsonb_build_object('requestCode',code,'requestType',v->>'request_type','submittedAt',v->>'submitted_at','dueAt',v->>'due_at');
    elsif (v->>'email_revision') is distinct from (prev->>'email_revision') and nullif(btrim(v->>'response'),'') is not null then
      k := 'privacy_response:' || new.id || ':' || (v->>'email_revision'); subject := 'ERMIF - Respuesta de privacidad ' || code;
      payload := jsonb_build_object('requestCode',code,'response',v->>'response','respondedAt',v->>'responded_at');
    end if;
  elsif tg_table_name = 'account_deletion_requests' then
    code := v->>'request_code'; recipient := v->>'email';
    if tg_op = 'INSERT' then
      k := 'account_deletion_received:' || new.id; subject := 'ERMIF - Solicitud de eliminación ' || code; notify_admin := true;
    elsif new.status is distinct from old.status and new.status in ('processed','cancelled') then
      k := 'account_deletion_updated:' || new.id || ':' || (v->>'email_revision'); subject := 'ERMIF - Estado de solicitud ' || code;
    end if;
    payload := jsonb_build_object('requestCode',code,'requestedAt',v->>'requested_at','scheduledDeletionAt',v->>'scheduled_deletion_at','status',v->>'status');
  elsif tg_table_name = 'subscriptions' then
    if (tg_op = 'INSERT' and new.plan <> 'free') or (tg_op = 'UPDATE' and (v->>'email_revision') is distinct from (prev->>'email_revision')) then
      -- Dirección de Auth verificada, no una dirección editable en el perfil.
      select email into recipient from auth.users where id = new.user_id and email_confirmed_at is not null;
      k := 'subscription_updated:' || new.id || ':' || (v->>'email_revision'); subject := 'ERMIF - Actualización de tu suscripción';
      payload := jsonb_build_object('plan',v->>'plan','status',v->>'status','currentPeriodEnd',v->>'current_period_end');
    end if;
  end if;
  if k is not null then
    perform public.email_enqueue(k,recipient,subject,payload);
    if notify_admin then
      select admin_email into admin_address from public.email_settings where id;
      perform public.email_enqueue('internal_alert:' || k,admin_address,'ERMIF - Nueva solicitud ' || code,jsonb_build_object('requestCode',code));
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['privacy_requests','account_deletion_requests','subscriptions'] loop
    execute format('drop trigger if exists email_revision_before on public.%I',t);
    execute format('create trigger email_revision_before before insert or update on public.%I for each row execute function public.email_bump_revision()',t);
  end loop;
  foreach t in array array['claim_book_entries','privacy_requests','account_deletion_requests','subscriptions'] loop
    execute format('drop trigger if exists email_capture_after on public.%I',t);
    execute format('create trigger email_capture_after after insert or update on public.%I for each row execute function public.email_capture_event()',t);
  end loop;
end $$;

-- Evidencia compatible con el panel de reclamaciones; una respuesta antigua no pisa la actual.
create or replace function public.email_sync_claim_evidence()
returns trigger language plpgsql security definer set search_path = '' as $$
declare claim_id uuid; kind text := split_part(new.event_key,':',1); evidence text;
begin
  if kind not in ('claim_received','claim_response') then return new; end if;
  claim_id := split_part(new.event_key,':',2)::uuid;
  evidence := coalesce(new.delivery_status,new.status);
  if kind = 'claim_received' then
    update public.claim_book_entries set received_email_status = evidence, received_email_sent_at = coalesce(new.accepted_at,new.sent_at),received_email_error = new.last_error where id = claim_id;
  else
    update public.claim_book_entries set response_email_status = evidence,response_email_sent_at = coalesce(new.accepted_at,new.sent_at),response_email_error = new.last_error
    where id = claim_id and response_version::text = split_part(new.event_key,':',3);
  end if;
  return new;
end $$;
drop trigger if exists email_evidence_after on public.email_outbox;
create trigger email_evidence_after after insert or update of status,delivery_status on public.email_outbox for each row execute function public.email_sync_claim_evidence();

create or replace function public.email_claim_next()
returns setof public.email_outbox language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare cfg public.email_settings%rowtype; chosen uuid;
begin
  select * into cfg from public.email_settings where id for update;
  if not cfg.enabled or cfg.activated_at is null then return; end if;
  update public.email_outbox set status='unknown',last_error='Envío interrumpido; revisar Cloudflare antes de reenviar.',updated_at=now()
    where status='sending' and lease_until < now();
  if cfg.budget_date is distinct from current_date then
    update public.email_settings set budget_date=current_date,budget_used=0 where id; cfg.budget_used := 0;
  end if;
  if cfg.budget_month is distinct from date_trunc('month',current_date)::date then
    update public.email_settings set budget_month=date_trunc('month',current_date)::date,monthly_used=0 where id; cfg.monthly_used := 0;
  end if;
  if cfg.budget_used >= cfg.daily_limit or cfg.monthly_used >= cfg.monthly_limit then return; end if;
  select e.id into chosen from public.email_outbox e
    where e.status in ('pending','retry') and e.created_at >= cfg.activated_at and e.next_attempt_at <= now() and e.attempts < 5
    and (select count(*) from public.email_outbox recent where lower(recent.recipient)=lower(e.recipient) and recent.last_attempt_at > now()-interval '1 hour') < 10
    order by e.created_at,e.id limit 1 for update skip locked;
  if chosen is null then return; end if;
  update public.email_settings set budget_used=budget_used+1,monthly_used=monthly_used+1 where id;
  return query update public.email_outbox set status='sending',lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
    attempts=attempts+1,last_attempt_at=now(),updated_at=now() where id=chosen returning *;
end $$;

create or replace function public.email_apply_delivery(p_message_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.email_delivery_events%rowtype;
begin
  select * into e from public.email_delivery_events where message_id=p_message_id
    order by (status='complained') desc, (status<>'deferred') desc,occurred_at desc,event_id desc limit 1;
  if found then
    update public.email_outbox set delivery_status=e.status,delivery_at=e.occurred_at,updated_at=now() where provider_message_id=p_message_id;
  end if;
end $$;
create or replace function public.email_finish_attempt(p_id uuid,p_lease uuid,p_status text,p_message_id text,p_error text,p_delay integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('accepted','retry','error','unknown') or (p_status='accepted' and nullif(p_message_id,'') is null) then raise exception 'Resultado inválido'; end if;
  update public.email_outbox set status=case when p_status='retry' and attempts>=5 then 'error' else p_status end,
    provider_message_id=p_message_id,accepted_at=case when p_status='accepted' then now() else null end,
    last_error=left(p_error,250), next_attempt_at=now()+make_interval(secs=>greatest(60,least(coalesce(p_delay,300),86400))),
    lease_until=null,updated_at=now()
    where id=p_id and lease_token=p_lease and status in ('sending','unknown');
  if not found then return false; end if;
  if p_status='accepted' then perform public.email_apply_delivery(p_message_id); end if;
  return true;
end $$;
create or replace function public.email_record_delivery(p_event_id text,p_message_id text,p_status text,p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_delivery_events values(p_event_id,p_message_id,p_status,p_at) on conflict do nothing;
  perform public.email_apply_delivery(p_message_id);
end $$;

-- Privilegios explícitos: ningún navegador puede reclamar, enviar o modificar la cola.
revoke all on function public.email_enqueue(text,text,text,jsonb),public.email_bump_revision(),public.email_capture_event(),public.email_sync_claim_evidence(),
  public.email_claim_next(),public.email_apply_delivery(text),public.email_finish_attempt(uuid,uuid,text,text,text,integer),public.email_record_delivery(text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.email_claim_next(),public.email_finish_attempt(uuid,uuid,text,text,text,integer),public.email_record_delivery(text,text,text,timestamptz) to service_role;
commit;
