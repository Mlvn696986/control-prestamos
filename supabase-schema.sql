create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  business_name text not null,
  owner_name text not null,
  currency text not null default 'PEN',
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  client_limit integer default 10,
  started_at timestamptz default now(),
  expires_at timestamptz
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  created_at timestamptz default now()
);

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric not null,
  remaining_capital numeric not null,
  monthly_rate numeric not null,
  interest_mode text not null default 'monthly',
  start_date date not null,
  next_due_date date not null,
  due_day integer not null,
  note text,
  status text not null default 'active',
  created_at timestamptz default now(),
  closed_at timestamptz
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references loans(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  date date not null,
  scheduled_due_date date,
  interest_paid numeric not null default 0,
  capital_paid numeric not null default 0,
  remaining_capital_after numeric,
  next_due_date_after date,
  note text,
  created_at timestamptz default now()
);

create table if not exists capital_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  date date not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_plan text not null,
  status text not null default 'pending',
  message text,
  created_at timestamptz default now()
);

create table if not exists user_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz default now()
);

alter table profiles add column if not exists email text;
alter table profiles add column if not exists is_admin boolean not null default false;
alter table subscriptions alter column client_limit drop not null;
alter table loans add column if not exists interest_mode text not null default 'monthly';

update profiles
set email = auth.users.email
from auth.users
where profiles.id = auth.users.id
  and profiles.email is null;

alter table profiles enable row level security;
alter table subscriptions enable row level security;
alter table clients enable row level security;
alter table loans enable row level security;
alter table payments enable row level security;
alter table capital_movements enable row level security;
alter table plan_requests enable row level security;
alter table user_backups enable row level security;

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

grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles own data" on profiles;
drop policy if exists "profiles own select" on profiles;
drop policy if exists "profiles own insert" on profiles;
drop policy if exists "profiles own update" on profiles;
drop policy if exists "subscriptions own data" on subscriptions;
drop policy if exists "subscriptions own select" on subscriptions;
drop policy if exists "subscriptions own insert" on subscriptions;
drop policy if exists "clients own data" on clients;
drop policy if exists "loans own data" on loans;
drop policy if exists "payments own data" on payments;
drop policy if exists "capital movements own data" on capital_movements;
drop policy if exists "plan requests own data" on plan_requests;
drop policy if exists "user backups own data" on user_backups;
drop policy if exists "profiles admin data" on profiles;
drop policy if exists "subscriptions admin data" on subscriptions;
drop policy if exists "clients admin data" on clients;
drop policy if exists "loans admin data" on loans;
drop policy if exists "payments admin data" on payments;
drop policy if exists "capital movements admin data" on capital_movements;
drop policy if exists "plan requests admin data" on plan_requests;
drop policy if exists "user backups admin data" on user_backups;

create policy "profiles own select"
on profiles for select
using (auth.uid() = id);

create policy "profiles own insert"
on profiles for insert
with check (auth.uid() = id and is_admin = false);

create policy "profiles own update"
on profiles for update
using (auth.uid() = id and is_admin = false)
with check (auth.uid() = id and is_admin = false);

create policy "profiles admin data"
on profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "subscriptions own select"
on subscriptions for select
using (auth.uid() = user_id)
;

create policy "subscriptions own insert"
on subscriptions for insert
with check (
  auth.uid() = user_id
  and plan = 'free'
  and status = 'active'
  and client_limit = 10
);

create policy "subscriptions admin data"
on subscriptions for all
using (public.is_admin())
with check (public.is_admin());

create policy "clients own data"
on clients for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "clients admin data"
on clients for all
using (public.is_admin())
with check (public.is_admin());

create policy "loans own data"
on loans for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "loans admin data"
on loans for all
using (public.is_admin())
with check (public.is_admin());

create policy "payments own data"
on payments for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "payments admin data"
on payments for all
using (public.is_admin())
with check (public.is_admin());

create policy "capital movements own data"
on capital_movements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "capital movements admin data"
on capital_movements for all
using (public.is_admin())
with check (public.is_admin());

create policy "plan requests own data"
on plan_requests for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "plan requests admin data"
on plan_requests for all
using (public.is_admin())
with check (public.is_admin());

create policy "user backups own data"
on user_backups for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "user backups admin data"
on user_backups for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.restore_user_snapshot(snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from capital_movements where user_id = auth.uid();
  delete from payments where user_id = auth.uid();
  delete from loans where user_id = auth.uid();
  delete from clients where user_id = auth.uid();

  insert into clients (id, user_id, name, phone, note, created_at)
  select
    item.id,
    auth.uid(),
    item.name,
    coalesce(item.phone, ''),
    coalesce(item.note, ''),
    coalesce(item."createdAt", item.created_at, now())
  from jsonb_to_recordset(coalesce(snapshot -> 'clients', '[]'::jsonb)) as item(
    id uuid,
    name text,
    phone text,
    note text,
    "createdAt" timestamptz,
    created_at timestamptz
  );

  insert into loans (
    id,
    user_id,
    client_id,
    amount,
    remaining_capital,
    monthly_rate,
    interest_mode,
    start_date,
    next_due_date,
    due_day,
    note,
    status,
    created_at,
    closed_at
  )
  select
    item.id,
    auth.uid(),
    coalesce(item."clientId", item.client_id),
    coalesce(item.amount, 0),
    coalesce(item."remainingCapital", item.remaining_capital, 0),
    coalesce(item."monthlyRate", item.monthly_rate, 0),
    coalesce(item."interestMode", item.interest_mode, 'monthly'),
    coalesce(item."startDate", item.start_date),
    coalesce(item."nextDueDate", item.next_due_date),
    coalesce(item."dueDay", item.due_day, extract(day from coalesce(item."nextDueDate", item.next_due_date))::integer),
    coalesce(item.note, ''),
    coalesce(item.status, 'active'),
    coalesce(item."createdAt", item.created_at, now()),
    coalesce(item."closedAt", item.closed_at)
  from jsonb_to_recordset(coalesce(snapshot -> 'loans', '[]'::jsonb)) as item(
    id uuid,
    "clientId" uuid,
    client_id uuid,
    amount numeric,
    "remainingCapital" numeric,
    remaining_capital numeric,
    "monthlyRate" numeric,
    monthly_rate numeric,
    "interestMode" text,
    interest_mode text,
    "startDate" date,
    start_date date,
    "nextDueDate" date,
    next_due_date date,
    "dueDay" integer,
    due_day integer,
    note text,
    status text,
    "createdAt" timestamptz,
    created_at timestamptz,
    "closedAt" timestamptz,
    closed_at timestamptz
  );

  insert into payments (
    id,
    user_id,
    loan_id,
    client_id,
    date,
    scheduled_due_date,
    interest_paid,
    capital_paid,
    remaining_capital_after,
    next_due_date_after,
    note,
    created_at
  )
  select
    item.id,
    auth.uid(),
    coalesce(item."loanId", item.loan_id),
    coalesce(item."clientId", item.client_id),
    item.date,
    coalesce(item."scheduledDueDate", item.scheduled_due_date),
    coalesce(item."interestPaid", item.interest_paid, 0),
    coalesce(item."capitalPaid", item.capital_paid, 0),
    coalesce(item."remainingCapitalAfter", item.remaining_capital_after, 0),
    coalesce(item."nextDueDateAfter", item.next_due_date_after),
    coalesce(item.note, ''),
    coalesce(item."createdAt", item.created_at, now())
  from jsonb_to_recordset(coalesce(snapshot -> 'payments', '[]'::jsonb)) as item(
    id uuid,
    "loanId" uuid,
    loan_id uuid,
    "clientId" uuid,
    client_id uuid,
    date date,
    "scheduledDueDate" date,
    scheduled_due_date date,
    "interestPaid" numeric,
    interest_paid numeric,
    "capitalPaid" numeric,
    capital_paid numeric,
    "remainingCapitalAfter" numeric,
    remaining_capital_after numeric,
    "nextDueDateAfter" date,
    next_due_date_after date,
    note text,
    "createdAt" timestamptz,
    created_at timestamptz
  );

  insert into capital_movements (
    id,
    user_id,
    type,
    amount,
    date,
    note,
    created_at
  )
  select
    item.id,
    auth.uid(),
    coalesce(item.type, 'deposit'),
    coalesce(item.amount, 0),
    item.date,
    coalesce(item.note, ''),
    coalesce(item."createdAt", item.created_at, now())
  from jsonb_to_recordset(coalesce(snapshot -> 'capitalMovements', snapshot -> 'capital_movements', '[]'::jsonb)) as item(
    id uuid,
    type text,
    amount numeric,
    date date,
    note text,
    "createdAt" timestamptz,
    created_at timestamptz
  );
end;
$$;

grant execute on function public.restore_user_snapshot(jsonb) to authenticated;

create or replace function public.register_payment(
  p_payment_id uuid,
  p_loan_id uuid,
  p_client_id uuid,
  p_date date,
  p_scheduled_due_date date,
  p_interest_paid numeric,
  p_capital_paid numeric,
  p_note text default '',
  p_created_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan loans%rowtype;
  v_payment payments%rowtype;
  v_new_remaining numeric;
  v_next_due date;
  v_scheduled_due date;
  v_target_month date;
  v_last_day integer;
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if p_interest_paid is null or p_interest_paid < 0 then
    raise exception 'El interes pagado no puede ser negativo.';
  end if;

  if p_capital_paid is null or p_capital_paid < 0 then
    raise exception 'El capital pagado no puede ser negativo.';
  end if;

  if p_interest_paid = 0 and p_capital_paid = 0 then
    raise exception 'El cobro debe registrar interes o capital.';
  end if;

  select *
  into v_loan
  from loans
  where id = p_loan_id
    and user_id = v_user_id
    and client_id = p_client_id
  for update;

  if not found then
    raise exception 'Prestamo no encontrado.';
  end if;

  if v_loan.status = 'closed' or v_loan.remaining_capital <= 0 then
    raise exception 'No se puede registrar un cobro en un prestamo cerrado.';
  end if;

  if p_capital_paid > v_loan.remaining_capital then
    raise exception 'El capital pagado no puede superar el capital pendiente.';
  end if;

  v_scheduled_due := coalesce(p_scheduled_due_date, v_loan.next_due_date);

  if coalesce(v_loan.interest_mode, 'monthly') = 'monthly' then
    v_target_month := (date_trunc('month', v_loan.next_due_date)::date + interval '1 month')::date;
    v_last_day := extract(day from (date_trunc('month', v_target_month)::date + interval '1 month' - interval '1 day'))::integer;
    v_next_due := make_date(
      extract(year from v_target_month)::integer,
      extract(month from v_target_month)::integer,
      least(v_loan.due_day, v_last_day)
    );
  elsif v_loan.interest_mode = 'biweekly' then
    v_next_due := v_loan.next_due_date + 15;
  elsif v_loan.interest_mode = 'weekly' then
    v_next_due := v_loan.next_due_date + 7;
  elsif v_loan.interest_mode = 'daily' then
    v_next_due := v_loan.next_due_date + 1;
  else
    raise exception 'Modalidad de interes invalida.';
  end if;

  v_new_remaining := round(v_loan.remaining_capital - p_capital_paid, 2);

  update loans
  set
    remaining_capital = v_new_remaining,
    next_due_date = v_next_due,
    status = case when v_new_remaining = 0 then 'closed' else 'active' end,
    closed_at = case when v_new_remaining = 0 then p_date::timestamptz else null end
  where id = v_loan.id
    and user_id = v_user_id
  returning * into v_loan;

  insert into payments (
    id,
    user_id,
    loan_id,
    client_id,
    date,
    scheduled_due_date,
    interest_paid,
    capital_paid,
    remaining_capital_after,
    next_due_date_after,
    note,
    created_at
  )
  values (
    p_payment_id,
    v_user_id,
    v_loan.id,
    v_loan.client_id,
    p_date,
    v_scheduled_due,
    p_interest_paid,
    p_capital_paid,
    v_new_remaining,
    case when v_new_remaining = 0 then null else v_next_due end,
    coalesce(p_note, ''),
    coalesce(p_created_at, now())
  )
  returning * into v_payment;

  return jsonb_build_object(
    'loan', to_jsonb(v_loan),
    'payment', to_jsonb(v_payment)
  );
end;
$$;

grant execute on function public.register_payment(uuid, uuid, uuid, date, date, numeric, numeric, text, timestamptz) to authenticated;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_client_limit_nonnegative') then
    alter table subscriptions add constraint subscriptions_client_limit_nonnegative check (client_limit is null or client_limit >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_amount_nonnegative') then
    alter table loans add constraint loans_amount_nonnegative check (amount >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_amount_positive') then
    alter table loans add constraint loans_amount_positive check (amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_remaining_capital_nonnegative') then
    alter table loans add constraint loans_remaining_capital_nonnegative check (remaining_capital >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_remaining_capital_not_above_amount') then
    alter table loans add constraint loans_remaining_capital_not_above_amount check (remaining_capital <= amount) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_monthly_rate_nonnegative') then
    alter table loans add constraint loans_monthly_rate_nonnegative check (monthly_rate >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_due_day_valid') then
    alter table loans add constraint loans_due_day_valid check (due_day between 1 and 31) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_status_valid') then
    alter table loans add constraint loans_status_valid check (status in ('active', 'closed')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_interest_mode_valid') then
    alter table loans add constraint loans_interest_mode_valid check (interest_mode in ('monthly', 'biweekly', 'weekly', 'daily')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_due_date_not_before_start') then
    alter table loans add constraint loans_due_date_not_before_start check (next_due_date >= start_date) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_status_matches_remaining_capital') then
    alter table loans add constraint loans_status_matches_remaining_capital check (
      (status = 'closed' and remaining_capital = 0)
      or
      (status = 'active' and remaining_capital > 0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_interest_paid_nonnegative') then
    alter table payments add constraint payments_interest_paid_nonnegative check (interest_paid >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_capital_paid_nonnegative') then
    alter table payments add constraint payments_capital_paid_nonnegative check (capital_paid >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_has_amount') then
    alter table payments add constraint payments_has_amount check (interest_paid > 0 or capital_paid > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_remaining_after_nonnegative') then
    alter table payments add constraint payments_remaining_after_nonnegative check (remaining_capital_after is null or remaining_capital_after >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'capital_movements_type_valid') then
    alter table capital_movements add constraint capital_movements_type_valid check (type in ('deposit', 'withdrawal')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'capital_movements_amount_positive') then
    alter table capital_movements add constraint capital_movements_amount_positive check (amount > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'clients_id_user_unique') then
    alter table clients add constraint clients_id_user_unique unique (id, user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_id_user_unique') then
    alter table loans add constraint loans_id_user_unique unique (id, user_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_client_same_user') then
    alter table loans add constraint loans_client_same_user foreign key (client_id, user_id) references clients(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_loan_same_user') then
    alter table payments add constraint payments_loan_same_user foreign key (loan_id, user_id) references loans(id, user_id) on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_client_same_user') then
    alter table payments add constraint payments_client_same_user foreign key (client_id, user_id) references clients(id, user_id) on delete cascade not valid;
  end if;
end $$;

alter table subscriptions validate constraint subscriptions_client_limit_nonnegative;
alter table loans validate constraint loans_amount_nonnegative;
alter table loans validate constraint loans_amount_positive;
alter table loans validate constraint loans_remaining_capital_nonnegative;
alter table loans validate constraint loans_remaining_capital_not_above_amount;
alter table loans validate constraint loans_monthly_rate_nonnegative;
alter table loans validate constraint loans_due_day_valid;
alter table loans validate constraint loans_status_valid;
alter table loans validate constraint loans_interest_mode_valid;
alter table loans validate constraint loans_due_date_not_before_start;
alter table loans validate constraint loans_status_matches_remaining_capital;
alter table payments validate constraint payments_interest_paid_nonnegative;
alter table payments validate constraint payments_capital_paid_nonnegative;
alter table payments validate constraint payments_has_amount;
alter table payments validate constraint payments_remaining_after_nonnegative;
alter table capital_movements validate constraint capital_movements_type_valid;
alter table capital_movements validate constraint capital_movements_amount_positive;
alter table loans validate constraint loans_client_same_user;
alter table payments validate constraint payments_loan_same_user;
alter table payments validate constraint payments_client_same_user;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on profiles to authenticated;
grant select, insert, update, delete on subscriptions to authenticated;
grant select, insert, update, delete on clients to authenticated;
grant select, insert, update, delete on loans to authenticated;
grant select, insert, update, delete on payments to authenticated;
grant select, insert, update, delete on capital_movements to authenticated;
grant select, insert, update, delete on plan_requests to authenticated;
grant select, insert, update, delete on user_backups to authenticated;

-- Despues de ejecutar este archivo, activa tu cuenta admin cambiando el correo:
-- update profiles
-- set is_admin = true
-- where id = (select id from auth.users where email = 'TU_CORREO_AQUI');
