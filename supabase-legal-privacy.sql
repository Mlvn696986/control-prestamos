-- Migracion legal y privacidad de ERMIF.
-- Incremental y no destructiva: no borra clientes, prestamos, pagos ni reclamos.

alter table clients add column if not exists document_type text;
alter table clients add column if not exists document_number text;
alter table clients add column if not exists address text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_document_type_check') then
    alter table clients
      add constraint clients_document_type_check
      check (document_type is null or document_type in ('DNI', 'CE', 'PASAPORTE'))
      not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'clients_dni_format_check') then
    alter table clients
      add constraint clients_dni_format_check
      check (document_type is distinct from 'DNI' or document_number is null or document_number ~ '^[0-9]{8}$')
      not valid;
  end if;
end $$;

alter table profiles add column if not exists terms_version text;
alter table profiles add column if not exists terms_accepted_at timestamptz;
alter table profiles add column if not exists privacy_policy_version text;
alter table profiles add column if not exists privacy_accepted_at timestamptz;

alter table claim_book_entries add column if not exists due_at timestamptz;
alter table claim_book_entries add column if not exists closed_at timestamptz;
alter table claim_book_entries add column if not exists retention_until timestamptz;
alter table claim_book_entries add column if not exists legal_hold boolean not null default true;
alter table claim_book_entries add column if not exists due_date_estimated boolean not null default true;
alter table claim_book_entries add column if not exists received_email_status text not null default 'pending_configuration';
alter table claim_book_entries add column if not exists received_email_sent_at timestamptz;
alter table claim_book_entries add column if not exists received_email_error text;
alter table claim_book_entries add column if not exists response_email_status text not null default 'pending_configuration';
alter table claim_book_entries add column if not exists response_email_sent_at timestamptz;
alter table claim_book_entries add column if not exists response_email_error text;
alter table claim_book_entries add column if not exists response_version integer not null default 0;
alter table claim_book_entries add column if not exists provider_business_name text not null default 'ERMIF';
alter table claim_book_entries add column if not exists provider_legal_name text not null default 'HOYOS BUENO MELVIN';
alter table claim_book_entries add column if not exists provider_ruc text not null default '10735063818';
alter table claim_book_entries add column if not exists provider_address text not null default 'Mz. E Lote 33 Urb. Tres Orizontes, San Martin de Porres, Lima, Lima';

update claim_book_entries
set
  due_at = coalesce(due_at, created_at + interval '21 days'),
  retention_until = coalesce(retention_until, created_at + interval '2 years'),
  legal_hold = true,
  due_date_estimated = coalesce(due_date_estimated, true)
where due_at is null
   or retention_until is null
   or legal_hold is distinct from true;

create table if not exists claim_book_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references claim_book_entries(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now()
);

create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  submitted_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('informacion', 'acceso', 'rectificacion', 'cancelacion', 'oposicion')),
  subject_role text not null check (subject_role in ('ermif_user', 'borrower', 'other')),
  requester_name text not null,
  requester_email text not null,
  document_type text,
  document_number text,
  detail text not null,
  status text not null default 'received' check (status in ('received', 'in_review', 'answered', 'closed')),
  submitted_at timestamptz not null default now(),
  due_at timestamptz not null,
  response text,
  responded_at timestamptz,
  policy_version text,
  retention_until timestamptz,
  legal_hold boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  request_code text not null unique,
  status text not null default 'received' check (status in ('received', 'in_review', 'processed', 'cancelled')),
  requested_at timestamptz not null default now(),
  scheduled_deletion_at timestamptz,
  processed_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  recipient text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_configuration' check (status in ('pending_configuration', 'pending', 'sent', 'error', 'skipped')),
  sent_at timestamptz,
  last_error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_document_idx on clients(user_id, document_type, document_number);
create index if not exists claim_book_entries_due_idx on claim_book_entries(status, due_at);
create index if not exists claim_book_events_claim_idx on claim_book_events(claim_id, created_at);
create index if not exists privacy_requests_due_idx on privacy_requests(status, due_at);
create index if not exists privacy_requests_user_idx on privacy_requests(submitted_user_id, submitted_at desc);
create index if not exists account_deletion_requests_user_idx on account_deletion_requests(user_id, requested_at desc);
create index if not exists email_outbox_status_idx on email_outbox(status, created_at);

alter table claim_book_events enable row level security;
alter table privacy_requests enable row level security;
alter table account_deletion_requests enable row level security;
alter table email_outbox enable row level security;

drop policy if exists "claim book entries admin data" on claim_book_entries;
drop policy if exists "claim book entries admin select" on claim_book_entries;
drop policy if exists "claim book entries own select" on claim_book_entries;
create policy "claim book entries own select"
on claim_book_entries for select
using (submitted_user_id is not null and auth.uid() = submitted_user_id);
create policy "claim book entries admin select"
on claim_book_entries for select
using (public.is_admin());

drop policy if exists "claim book events admin select" on claim_book_events;
create policy "claim book events admin select"
on claim_book_events for select
using (public.is_admin());

drop policy if exists "privacy requests own select" on privacy_requests;
drop policy if exists "privacy requests admin select" on privacy_requests;
create policy "privacy requests own select"
on privacy_requests for select
using (submitted_user_id is not null and auth.uid() = submitted_user_id);
create policy "privacy requests admin select"
on privacy_requests for select
using (public.is_admin());

drop policy if exists "account deletion requests own select" on account_deletion_requests;
drop policy if exists "account deletion requests admin select" on account_deletion_requests;
create policy "account deletion requests own select"
on account_deletion_requests for select
using (auth.uid() = user_id);
create policy "account deletion requests admin select"
on account_deletion_requests for select
using (public.is_admin());

drop policy if exists "email outbox admin select" on email_outbox;
create policy "email outbox admin select"
on email_outbox for select
using (public.is_admin());

revoke all on claim_book_entries from anon, authenticated;
revoke all on claim_book_events from anon, authenticated;
revoke all on privacy_requests from anon, authenticated;
revoke all on account_deletion_requests from anon, authenticated;
revoke all on email_outbox from anon, authenticated;

grant select on claim_book_entries to authenticated;
grant select on claim_book_events to authenticated;
grant select on privacy_requests to authenticated;
grant select on account_deletion_requests to authenticated;
grant select on email_outbox to authenticated;

grant select, insert, update, delete on claim_book_entries to service_role;
grant select, insert, update, delete on claim_book_events to service_role;
grant select, insert, update, delete on privacy_requests to service_role;
grant select, insert, update, delete on account_deletion_requests to service_role;
grant select, insert, update, delete on email_outbox to service_role;

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

  insert into profiles (
    id, email, business_name, owner_name, currency, is_admin,
    terms_version, terms_accepted_at, privacy_policy_version, privacy_accepted_at
  )
  values (
    v_user_id,
    v_email,
    coalesce(nullif(trim(p_business_name), ''), 'Mi negocio'),
    coalesce(nullif(trim(p_owner_name), ''), 'Prestamista'),
    coalesce(nullif(trim(p_currency), ''), 'PEN'),
    false,
    '2026-09-10',
    now(),
    '2026-09-10',
    now()
  )
  on conflict (id) do update
  set
    email = coalesce(excluded.email, profiles.email),
    business_name = excluded.business_name,
    owner_name = excluded.owner_name,
    currency = excluded.currency,
    terms_version = coalesce(profiles.terms_version, excluded.terms_version),
    terms_accepted_at = coalesce(profiles.terms_accepted_at, excluded.terms_accepted_at),
    privacy_policy_version = coalesce(profiles.privacy_policy_version, excluded.privacy_policy_version),
    privacy_accepted_at = coalesce(profiles.privacy_accepted_at, excluded.privacy_accepted_at)
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

create or replace function public.create_client_with_loan(
  p_client_id uuid,
  p_name text,
  p_phone text,
  p_document_type text,
  p_document_number text,
  p_address text,
  p_client_note text,
  p_loan_id uuid,
  p_amount numeric,
  p_monthly_rate numeric,
  p_interest_mode text,
  p_start_date date,
  p_next_due_date date,
  p_due_day integer,
  p_loan_note text,
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_client clients%rowtype;
  v_loan loans%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  insert into clients (id, user_id, name, phone, document_type, document_number, address, note, created_at)
  values (
    p_client_id, v_user_id, trim(p_name), coalesce(p_phone, ''),
    nullif(p_document_type, ''), nullif(p_document_number, ''), nullif(p_address, ''),
    coalesce(p_client_note, ''), coalesce(p_created_at, now())
  )
  returning * into v_client;

  insert into loans (
    id, user_id, client_id, amount, remaining_capital, monthly_rate, interest_mode,
    operation_type, parent_loan_id, start_date, next_due_date, due_day, note, status, created_at, closed_at
  )
  values (
    p_loan_id, v_user_id, v_client.id, p_amount, p_amount, p_monthly_rate, coalesce(p_interest_mode, 'monthly'),
    'principal', null, p_start_date, p_next_due_date, p_due_day, coalesce(p_loan_note, ''), 'active', coalesce(p_created_at, now()), null
  )
  returning * into v_loan;

  return jsonb_build_object('client', to_jsonb(v_client), 'loan', to_jsonb(v_loan));
end;
$$;

revoke all on function public.create_client_with_loan(uuid, text, text, text, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) from public;
grant execute on function public.create_client_with_loan(uuid, text, text, text, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) to authenticated;

create or replace function public.update_client_with_loan(
  p_client_id uuid,
  p_name text,
  p_phone text,
  p_document_type text,
  p_document_number text,
  p_address text,
  p_client_note text,
  p_loan_id uuid,
  p_amount numeric,
  p_remaining_capital numeric,
  p_monthly_rate numeric,
  p_interest_mode text,
  p_start_date date,
  p_next_due_date date,
  p_due_day integer,
  p_loan_note text,
  p_status text,
  p_closed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_client clients%rowtype;
  v_loan loans%rowtype;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  select * into v_client from clients where id = p_client_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Cliente no encontrado.';
  end if;

  update clients
  set
    name = trim(p_name),
    phone = coalesce(p_phone, ''),
    document_type = nullif(p_document_type, ''),
    document_number = nullif(p_document_number, ''),
    address = nullif(p_address, ''),
    note = coalesce(p_client_note, '')
  where id = p_client_id and user_id = v_user_id
  returning * into v_client;

  if p_loan_id is not null then
    select * into v_loan from loans where id = p_loan_id and user_id = v_user_id and client_id = p_client_id for update;
    if not found then
      insert into loans (
        id, user_id, client_id, amount, remaining_capital, monthly_rate, interest_mode,
        operation_type, parent_loan_id, start_date, next_due_date, due_day, note, status, created_at, closed_at
      )
      values (
        p_loan_id, v_user_id, p_client_id, p_amount, p_remaining_capital, p_monthly_rate, coalesce(p_interest_mode, 'monthly'),
        'principal', null, p_start_date, p_next_due_date, p_due_day, coalesce(p_loan_note, ''), coalesce(p_status, 'active'), now(), p_closed_at
      )
      returning * into v_loan;
    else
      update loans
      set
        amount = p_amount,
        remaining_capital = p_remaining_capital,
        monthly_rate = p_monthly_rate,
        interest_mode = coalesce(p_interest_mode, 'monthly'),
        start_date = p_start_date,
        next_due_date = p_next_due_date,
        due_day = p_due_day,
        note = coalesce(p_loan_note, ''),
        status = p_status,
        closed_at = p_closed_at
      where id = p_loan_id and user_id = v_user_id
      returning * into v_loan;
    end if;
  end if;

  return jsonb_build_object('client', to_jsonb(v_client), 'loan', case when p_loan_id is null then null else to_jsonb(v_loan) end);
end;
$$;

revoke all on function public.update_client_with_loan(uuid, text, text, text, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) from public;
grant execute on function public.update_client_with_loan(uuid, text, text, text, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) to authenticated;
