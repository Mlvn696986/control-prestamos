-- Endurecimiento RLS de ERMIF.
-- Ejecuta este archivo en Supabase SQL Editor despues de supabase-financial-integrity.sql.
-- No borra tablas, usuarios ni registros financieros.

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table clients enable row level security;
alter table loans enable row level security;
alter table payments enable row level security;
alter table capital_movements enable row level security;
alter table plan_requests enable row level security;
alter table user_backups enable row level security;
alter table claim_book_entries enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles where profiles.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles own data" on profiles;
drop policy if exists "profiles own select" on profiles;
drop policy if exists "profiles own insert" on profiles;
drop policy if exists "profiles own update" on profiles;
drop policy if exists "profiles admin data" on profiles;
drop policy if exists "profiles admin select" on profiles;

drop policy if exists "subscriptions own data" on subscriptions;
drop policy if exists "subscriptions own select" on subscriptions;
drop policy if exists "subscriptions own insert" on subscriptions;
drop policy if exists "subscriptions admin data" on subscriptions;
drop policy if exists "subscriptions admin select" on subscriptions;

drop policy if exists "clients own data" on clients;
drop policy if exists "clients admin data" on clients;
drop policy if exists "clients admin select" on clients;

drop policy if exists "loans own data" on loans;
drop policy if exists "loans own select" on loans;
drop policy if exists "loans own delete" on loans;
drop policy if exists "loans admin data" on loans;
drop policy if exists "loans admin select" on loans;

drop policy if exists "payments own data" on payments;
drop policy if exists "payments own select" on payments;
drop policy if exists "payments admin data" on payments;
drop policy if exists "payments admin select" on payments;

drop policy if exists "capital movements own data" on capital_movements;
drop policy if exists "capital movements own select" on capital_movements;
drop policy if exists "capital movements own insert" on capital_movements;
drop policy if exists "capital movements own restore delete" on capital_movements;
drop policy if exists "capital movements admin data" on capital_movements;
drop policy if exists "capital movements admin select" on capital_movements;

drop policy if exists "plan requests own data" on plan_requests;
drop policy if exists "plan requests own select" on plan_requests;
drop policy if exists "plan requests admin data" on plan_requests;
drop policy if exists "plan requests admin select" on plan_requests;

drop policy if exists "user backups own data" on user_backups;
drop policy if exists "user backups own select" on user_backups;
drop policy if exists "user backups own restore delete" on user_backups;
drop policy if exists "user backups admin data" on user_backups;
drop policy if exists "user backups admin select" on user_backups;

drop policy if exists "claim book entries own select" on claim_book_entries;
drop policy if exists "claim book entries admin data" on claim_book_entries;
drop policy if exists "claim book entries admin select" on claim_book_entries;

create policy "profiles own select"
on profiles for select
using (auth.uid() = id);

create policy "profiles own update"
on profiles for update
using (auth.uid() = id and is_admin = false)
with check (auth.uid() = id and is_admin = false);

create policy "profiles admin select"
on profiles for select
using (public.is_admin());

create policy "subscriptions own select"
on subscriptions for select
using (auth.uid() = user_id);

create policy "subscriptions admin select"
on subscriptions for select
using (public.is_admin());

create policy "clients own data"
on clients for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "clients admin select"
on clients for select
using (public.is_admin());

create policy "loans own select"
on loans for select
using (auth.uid() = user_id);

create policy "loans own delete"
on loans for delete
using (auth.uid() = user_id);

create policy "loans admin select"
on loans for select
using (public.is_admin());

create policy "payments own select"
on payments for select
using (auth.uid() = user_id);

create policy "payments admin select"
on payments for select
using (public.is_admin());

create policy "capital movements own select"
on capital_movements for select
using (auth.uid() = user_id);

create policy "capital movements admin select"
on capital_movements for select
using (public.is_admin());

create policy "plan requests own select"
on plan_requests for select
using (auth.uid() = user_id);

create policy "plan requests admin select"
on plan_requests for select
using (public.is_admin());

create policy "user backups own select"
on user_backups for select
using (auth.uid() = user_id);

create policy "claim book entries own select"
on claim_book_entries for select
using (submitted_user_id is not null and auth.uid() = submitted_user_id);

create policy "claim book entries admin select"
on claim_book_entries for select
using (public.is_admin());

alter table claim_book_events enable row level security;
alter table privacy_requests enable row level security;
alter table account_deletion_requests enable row level security;
alter table email_outbox enable row level security;

drop policy if exists "claim book events admin select" on claim_book_events;
drop policy if exists "privacy requests own select" on privacy_requests;
drop policy if exists "privacy requests admin select" on privacy_requests;
drop policy if exists "account deletion requests own select" on account_deletion_requests;
drop policy if exists "account deletion requests admin select" on account_deletion_requests;
drop policy if exists "email outbox admin select" on email_outbox;

create policy "claim book events admin select"
on claim_book_events for select
using (public.is_admin());

create policy "privacy requests own select"
on privacy_requests for select
using (submitted_user_id is not null and auth.uid() = submitted_user_id);

create policy "privacy requests admin select"
on privacy_requests for select
using (public.is_admin());

create policy "account deletion requests own select"
on account_deletion_requests for select
using (auth.uid() = user_id);

create policy "account deletion requests admin select"
on account_deletion_requests for select
using (public.is_admin());

create policy "email outbox admin select"
on email_outbox for select
using (public.is_admin());

create or replace function public.initialize_user_account(
  p_email text default null,
  p_business_name text default 'Mi negocio',
  p_owner_name text default 'Prestamista',
  p_currency text default 'PEN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile profiles%rowtype;
  v_subscription subscriptions%rowtype;
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  v_email := nullif(trim(coalesce(auth.jwt() ->> 'email', p_email, '')), '');

  insert into profiles (id, email, business_name, owner_name, currency, is_admin)
  values (
    v_user_id,
    v_email,
    coalesce(nullif(trim(p_business_name), ''), 'Mi negocio'),
    coalesce(nullif(trim(p_owner_name), ''), 'Prestamista'),
    coalesce(nullif(trim(p_currency), ''), 'PEN'),
    false
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, profiles.email),
    business_name = excluded.business_name,
    owner_name = excluded.owner_name,
    currency = excluded.currency
  returning * into v_profile;

  insert into subscriptions (user_id, plan, status, client_limit, started_at, updated_at)
  values (v_user_id, 'free', 'active', 10, now(), now())
  on conflict (user_id) do nothing;

  select *
  into v_subscription
  from subscriptions
  where user_id = v_user_id;

  return jsonb_build_object('profile', to_jsonb(v_profile), 'subscription', to_jsonb(v_subscription));
end;
$$;

revoke all on function public.initialize_user_account(text, text, text, text) from public;
grant execute on function public.initialize_user_account(text, text, text, text) to authenticated;

create or replace function public.admin_update_user_plan(
  p_user_id uuid,
  p_plan text,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := lower(trim(coalesce(p_plan, '')));
  v_client_limit integer;
  v_subscription subscriptions%rowtype;
  v_request plan_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar planes.';
  end if;

  if p_user_id is null then
    raise exception 'Usuario no valido.';
  end if;

  v_client_limit := case v_plan
    when 'free' then 10
    when 'basic' then 50
    when 'pro' then null
    else null
  end;

  if v_plan not in ('free', 'basic', 'pro') then
    raise exception 'Plan no valido.';
  end if;

  insert into subscriptions (user_id, plan, status, client_limit, started_at, updated_at)
  values (p_user_id, v_plan, 'active', v_client_limit, now(), now())
  on conflict (user_id) do update
  set
    plan = excluded.plan,
    status = 'active',
    client_limit = excluded.client_limit,
    started_at = now(),
    updated_at = now()
  returning * into v_subscription;

  if p_request_id is not null then
    update plan_requests
    set status = 'approved', updated_at = now()
    where id = p_request_id
      and user_id = p_user_id
    returning * into v_request;

    if not found then
      raise exception 'Solicitud de plan no encontrada.';
    end if;
  end if;

  return jsonb_build_object(
    'subscription', to_jsonb(v_subscription),
    'planRequest', case when p_request_id is null then null else to_jsonb(v_request) end
  );
end;
$$;

revoke all on function public.admin_update_user_plan(uuid, text, uuid) from public;
grant execute on function public.admin_update_user_plan(uuid, text, uuid) to authenticated;

alter function public.create_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) security definer;
alter function public.create_loan_operation(uuid, uuid, numeric, numeric, text, text, uuid, date, date, integer, text, timestamptz) security definer;
alter function public.update_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) security definer;
alter function public.register_payment(uuid, uuid, uuid, date, date, numeric, numeric, text, timestamptz) security definer;
alter function public.register_capital_movement(uuid, text, numeric, date, text, timestamptz) security definer;
alter function public.restore_user_backup(uuid) security definer;

revoke all on function public.create_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) from public;
revoke all on function public.create_loan_operation(uuid, uuid, numeric, numeric, text, text, uuid, date, date, integer, text, timestamptz) from public;
revoke all on function public.update_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) from public;
revoke all on function public.register_payment(uuid, uuid, uuid, date, date, numeric, numeric, text, timestamptz) from public;
revoke all on function public.register_capital_movement(uuid, text, numeric, date, text, timestamptz) from public;
revoke all on function public.create_user_backup() from public;
revoke all on function public.restore_user_backup(uuid) from public;
revoke all on function public.calculate_available_capital(uuid) from public;
revoke all on function public.validate_loan_financial_rules(uuid, uuid, uuid, numeric, numeric, text, uuid, text, date, numeric) from public;
revoke all on function public.validate_capital_movement_rules(uuid, text, numeric, date) from public;

grant execute on function public.create_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) to authenticated;
grant execute on function public.create_loan_operation(uuid, uuid, numeric, numeric, text, text, uuid, date, date, integer, text, timestamptz) to authenticated;
grant execute on function public.update_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) to authenticated;
grant execute on function public.register_payment(uuid, uuid, uuid, date, date, numeric, numeric, text, timestamptz) to authenticated;
grant execute on function public.register_capital_movement(uuid, text, numeric, date, text, timestamptz) to authenticated;
grant execute on function public.create_user_backup() to authenticated;
grant execute on function public.restore_user_backup(uuid) to authenticated;
grant execute on function public.calculate_available_capital(uuid) to authenticated;

grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;

revoke all on profiles from anon, authenticated;
revoke all on subscriptions from anon, authenticated;
revoke all on clients from anon, authenticated;
revoke all on loans from anon, authenticated;
revoke all on payments from anon, authenticated;
revoke all on capital_movements from anon, authenticated;
revoke all on plan_requests from anon, authenticated;
revoke all on user_backups from anon, authenticated;
revoke all on claim_book_entries from anon, authenticated;
revoke all on claim_book_events from anon, authenticated;
revoke all on privacy_requests from anon, authenticated;
revoke all on account_deletion_requests from anon, authenticated;
revoke all on email_outbox from anon, authenticated;

grant select on profiles to authenticated;
grant update (business_name, owner_name, currency) on profiles to authenticated;
grant select on subscriptions to authenticated;
grant select, insert, update, delete on clients to authenticated;
grant select, delete on loans to authenticated;
grant select on payments to authenticated;
grant select on capital_movements to authenticated;
grant select on plan_requests to authenticated;
grant select on user_backups to authenticated;
grant select on claim_book_entries to authenticated;
grant select on claim_book_events to authenticated;
grant select on privacy_requests to authenticated;
grant select on account_deletion_requests to authenticated;
grant select on email_outbox to authenticated;

grant select, insert, update, delete on profiles to service_role;
grant select, insert, update, delete on subscriptions to service_role;
grant select, insert, update, delete on clients to service_role;
grant select, insert, update, delete on loans to service_role;
grant select, insert, update, delete on payments to service_role;
grant select, insert, update, delete on capital_movements to service_role;
grant select, insert, update, delete on plan_requests to service_role;
grant select, insert, update, delete on user_backups to service_role;
grant select, insert, update, delete on claim_book_entries to service_role;
grant select, insert, update, delete on claim_book_events to service_role;
grant select, insert, update, delete on privacy_requests to service_role;
grant select, insert, update, delete on account_deletion_requests to service_role;
grant select, insert, update, delete on email_outbox to service_role;
