-- Migracion de integridad financiera.
-- Ejecuta este archivo en Supabase SQL Editor despues de revisar que no haya
-- datos negativos existentes. No borra datos: si hay registros invalidos,
-- la validacion de constraints falla para que puedas corregirlos conscientemente.

create table if not exists capital_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  date date not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists claim_book_entries (
  id uuid primary key default gen_random_uuid(),
  claim_code text not null unique,
  submitted_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('reclamo', 'queja')),
  service_name text not null,
  consumer_first_name text not null,
  consumer_last_name text not null,
  document_type text not null,
  document_number text not null,
  email text not null,
  phone text not null,
  address text not null,
  amount numeric check (amount is null or amount >= 0),
  payment_reference text,
  detail text not null,
  request text not null,
  provider_email text not null,
  provider_phone text not null,
  status text not null default 'received' check (status in ('received', 'in_review', 'answered', 'closed')),
  response text,
  responded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table claim_book_entries enable row level security;

drop policy if exists "claim book entries own select" on claim_book_entries;
drop policy if exists "claim book entries admin data" on claim_book_entries;

create policy "claim book entries own select"
on claim_book_entries for select
using (submitted_user_id is not null and auth.uid() = submitted_user_id);

create policy "claim book entries admin data"
on claim_book_entries for all
using (public.is_admin())
with check (public.is_admin());

alter table subscriptions add column if not exists provider text;
alter table subscriptions add column if not exists provider_subscription_id text;
alter table subscriptions add column if not exists provider_status text;
alter table subscriptions add column if not exists current_period_end timestamptz;
alter table subscriptions add column if not exists updated_at timestamptz default now();
alter table plan_requests add column if not exists provider text;
alter table plan_requests add column if not exists provider_subscription_id text;
alter table plan_requests add column if not exists provider_status text;
alter table plan_requests add column if not exists checkout_url text;
alter table plan_requests add column if not exists paid_at timestamptz;
alter table plan_requests add column if not exists current_period_end timestamptz;
alter table plan_requests add column if not exists updated_at timestamptz default now();

create index if not exists subscriptions_provider_subscription_idx
on subscriptions(provider, provider_subscription_id);

create index if not exists plan_requests_provider_subscription_idx
on plan_requests(provider, provider_subscription_id);

create index if not exists claim_book_entries_created_at_idx
on claim_book_entries(created_at desc);

create index if not exists claim_book_entries_status_idx
on claim_book_entries(status, created_at desc);

grant usage on schema public to service_role;
grant select, insert, update, delete on profiles to service_role;
grant select, insert, update, delete on subscriptions to service_role;
grant select, insert, update, delete on clients to service_role;
grant select, insert, update, delete on loans to service_role;
grant select, insert, update, delete on payments to service_role;
grant select, insert, update, delete on capital_movements to service_role;
grant select, insert, update, delete on plan_requests to service_role;
grant select, insert, update, delete on claim_book_entries to service_role;
grant select, insert, update, delete on user_backups to service_role;

alter table loans add column if not exists operation_type text;
alter table loans add column if not exists parent_loan_id uuid;
alter table loans alter column next_due_date drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'loans_parent_loan_fk') then
    alter table loans add constraint loans_parent_loan_fk foreign key (parent_loan_id) references loans(id) on delete set null not valid;
  end if;
end $$;

with ranked_loans as (
  select
    id,
    first_value(id) over (partition by client_id order by created_at, start_date, id) as principal_id,
    row_number() over (partition by client_id order by created_at, start_date, id) as position
  from loans
  where operation_type is null
)
update loans
set
  operation_type = case when ranked_loans.position = 1 then 'principal' else 'ampliacion' end,
  parent_loan_id = case when ranked_loans.position = 1 then null else ranked_loans.principal_id end
from ranked_loans
where loans.id = ranked_loans.id;

alter table loans alter column operation_type set default 'principal';
alter table loans alter column operation_type set not null;

update loans
set status = 'closed',
    next_due_date = null
where remaining_capital = 0;

alter table capital_movements enable row level security;

drop policy if exists "capital movements own data" on capital_movements;
drop policy if exists "capital movements admin data" on capital_movements;

create policy "capital movements own data"
on capital_movements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "capital movements admin data"
on capital_movements for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.calculate_available_capital(p_user_id uuid)
returns numeric
language sql
security invoker
set search_path = public
as $$
  select round(
    coalesce((select sum(amount) from capital_movements where user_id = p_user_id and type = 'deposit'), 0)
    + coalesce((select sum(interest_paid) from payments where user_id = p_user_id), 0)
    - coalesce((select sum(amount) from capital_movements where user_id = p_user_id and type = 'withdrawal'), 0)
    - coalesce((select sum(remaining_capital) from loans where user_id = p_user_id and status = 'active'), 0),
    2
  );
$$;

grant execute on function public.calculate_available_capital(uuid) to authenticated;

create or replace function public.validate_loan_financial_rules(
  p_user_id uuid,
  p_client_id uuid,
  p_loan_id uuid,
  p_amount numeric,
  p_remaining_capital numeric,
  p_operation_type text,
  p_parent_loan_id uuid,
  p_status text,
  p_next_due_date date,
  p_previous_remaining numeric default 0
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_available numeric;
  v_additional numeric;
  v_principal_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Usuario no autorizado.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del prestamo debe ser mayor a cero.';
  end if;

  if p_remaining_capital is null or p_remaining_capital < 0 or p_remaining_capital > p_amount then
    raise exception 'El capital pendiente no es valido.';
  end if;

  if p_operation_type not in ('principal', 'ampliacion') then
    raise exception 'Tipo de operacion invalido.';
  end if;

  if p_status = 'closed' and (p_remaining_capital <> 0 or p_next_due_date is not null) then
    raise exception 'Un prestamo cerrado debe tener saldo cero y sin proxima fecha.';
  end if;

  if p_status = 'active' and (p_remaining_capital <= 0 or p_next_due_date is null) then
    raise exception 'Un prestamo activo debe tener saldo pendiente y proxima fecha.';
  end if;

  select id
  into v_principal_id
  from loans
  where user_id = p_user_id
    and client_id = p_client_id
    and operation_type = 'principal'
    and (p_loan_id is null or id <> p_loan_id)
  order by created_at, start_date, id
  limit 1;

  if p_operation_type = 'ampliacion' and p_parent_loan_id is null then
    raise exception 'La ampliacion debe estar vinculada a un prestamo principal.';
  end if;

  if p_operation_type = 'ampliacion' and not exists (
    select 1 from loans
    where id = p_parent_loan_id
      and user_id = p_user_id
      and client_id = p_client_id
      and operation_type = 'principal'
  ) then
    raise exception 'La ampliacion debe pertenecer al prestamo principal del cliente.';
  end if;

  if p_operation_type = 'principal' and p_parent_loan_id is not null then
    raise exception 'Un prestamo principal no debe tener prestamo padre.';
  end if;

  if p_operation_type = 'principal' and v_principal_id is not null then
    raise exception 'El cliente ya tiene un prestamo principal.';
  end if;

  v_available := public.calculate_available_capital(p_user_id);
  v_additional := greatest(round(p_remaining_capital - coalesce(p_previous_remaining, 0), 2), 0);
  if v_additional > v_available then
    raise exception 'No hay capital disponible suficiente para este desembolso.';
  end if;
end;
$$;

grant execute on function public.validate_loan_financial_rules(uuid, uuid, uuid, numeric, numeric, text, uuid, text, date, numeric) to authenticated;

create or replace function public.enforce_loan_financial_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_setting('app.restoring_snapshot', true) = 'on' then
    return new;
  end if;

  perform public.validate_loan_financial_rules(
    new.user_id,
    new.client_id,
    case when tg_op = 'UPDATE' then new.id else null end,
    new.amount,
    new.remaining_capital,
    new.operation_type,
    new.parent_loan_id,
    new.status,
    new.next_due_date,
    case when tg_op = 'UPDATE' then old.remaining_capital else 0 end
  );
  return new;
end;
$$;

drop trigger if exists trg_enforce_loan_financial_rules on loans;
create trigger trg_enforce_loan_financial_rules
before insert or update on loans
for each row execute function public.enforce_loan_financial_rules();

create or replace function public.enforce_client_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_limit integer;
  v_current_clients integer;
begin
  if current_setting('app.restoring_snapshot', true) = 'on' then
    return new;
  end if;

  if new.user_id is null or (new.user_id <> auth.uid() and not public.is_admin()) then
    raise exception 'Usuario no autorizado.';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text)::bigint);

  select subscriptions.client_limit
  into v_client_limit
  from subscriptions
  where subscriptions.user_id = new.user_id
    and subscriptions.status = 'active'
  order by subscriptions.started_at desc nulls last
  limit 1
  for update;

  if not found then
    v_client_limit := 10;
  end if;

  if v_client_limit is null then
    return new;
  end if;

  select count(*)
  into v_current_clients
  from clients
  where clients.user_id = new.user_id;

  if v_current_clients >= v_client_limit then
    raise exception 'Tu plan permite hasta % clientes. Actualiza tu plan para registrar mas.', v_client_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_client_plan_limit on clients;
create trigger trg_enforce_client_plan_limit
before insert on clients
for each row execute function public.enforce_client_plan_limit();

create or replace function public.create_client_with_loan(
  p_client_id uuid,
  p_name text,
  p_phone text,
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
security invoker
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

  insert into clients (id, user_id, name, phone, note, created_at)
  values (p_client_id, v_user_id, trim(p_name), coalesce(p_phone, ''), coalesce(p_client_note, ''), coalesce(p_created_at, now()))
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

grant execute on function public.create_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, text, date, date, integer, text, timestamptz) to authenticated;

create or replace function public.create_loan_operation(
  p_loan_id uuid,
  p_client_id uuid,
  p_amount numeric,
  p_monthly_rate numeric,
  p_interest_mode text,
  p_operation_type text,
  p_parent_loan_id uuid,
  p_start_date date,
  p_next_due_date date,
  p_due_day integer,
  p_note text,
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
begin
  if v_user_id is null then
    raise exception 'Usuario no autenticado.';
  end if;

  if not exists (select 1 from clients where id = p_client_id and user_id = v_user_id) then
    raise exception 'Cliente no encontrado.';
  end if;

  insert into loans (
    id, user_id, client_id, amount, remaining_capital, monthly_rate, interest_mode,
    operation_type, parent_loan_id, start_date, next_due_date, due_day, note, status, created_at, closed_at
  )
  values (
    p_loan_id, v_user_id, p_client_id, p_amount, p_amount, p_monthly_rate, coalesce(p_interest_mode, 'monthly'),
    p_operation_type, p_parent_loan_id, p_start_date, p_next_due_date, p_due_day, coalesce(p_note, ''), 'active', coalesce(p_created_at, now()), null
  )
  returning * into v_loan;

  return to_jsonb(v_loan);
end;
$$;

grant execute on function public.create_loan_operation(uuid, uuid, numeric, numeric, text, text, uuid, date, date, integer, text, timestamptz) to authenticated;

create or replace function public.update_client_with_loan(
  p_client_id uuid,
  p_name text,
  p_phone text,
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
security invoker
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
  set name = trim(p_name), phone = coalesce(p_phone, ''), note = coalesce(p_client_note, '')
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

grant execute on function public.update_client_with_loan(uuid, text, text, text, uuid, numeric, numeric, numeric, text, date, date, integer, text, text, timestamptz) to authenticated;

create or replace function public.restore_user_snapshot(snapshot jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('app.restoring_snapshot', 'on', true);

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
    operation_type,
    parent_loan_id,
    start_date,
    next_due_date,
    due_day,
    note,
    status,
    created_at,
    closed_at
  )
  with loan_items as (
    select
      item.*,
      row_number() over (
        partition by coalesce(item."clientId", item.client_id)
        order by coalesce(item."createdAt", item.created_at, now()), coalesce(item."startDate", item.start_date), item.id
      ) as position,
      first_value(item.id) over (
        partition by coalesce(item."clientId", item.client_id)
        order by coalesce(item."createdAt", item.created_at, now()), coalesce(item."startDate", item.start_date), item.id
      ) as principal_id
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
      "operationType" text,
      operation_type text,
      "parentLoanId" uuid,
      parent_loan_id uuid,
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
    )
  )
  select
    item.id,
    auth.uid(),
    coalesce(item."clientId", item.client_id),
    coalesce(item.amount, 0),
    coalesce(item."remainingCapital", item.remaining_capital, 0),
    coalesce(item."monthlyRate", item.monthly_rate, 0),
    coalesce(item."interestMode", item.interest_mode, 'monthly'),
    coalesce(item."operationType", item.operation_type, case when item.position = 1 then 'principal' else 'ampliacion' end),
    case
      when coalesce(item."operationType", item.operation_type, case when item.position = 1 then 'principal' else 'ampliacion' end) = 'ampliacion'
      then coalesce(item."parentLoanId", item.parent_loan_id, item.principal_id)
      else null
    end,
    coalesce(item."startDate", item.start_date),
    case
      when coalesce(item.status, 'active') = 'closed' or coalesce(item."remainingCapital", item.remaining_capital, 0) = 0
      then null
      else coalesce(item."nextDueDate", item.next_due_date)
    end,
    coalesce(item."dueDay", item.due_day, extract(day from coalesce(item."nextDueDate", item.next_due_date))::integer),
    coalesce(item.note, ''),
    case when coalesce(item."remainingCapital", item.remaining_capital, 0) = 0 then 'closed' else coalesce(item.status, 'active') end,
    coalesce(item."createdAt", item.created_at, now()),
    coalesce(item."closedAt", item.closed_at)
  from loan_items item;

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

  if p_scheduled_due_date is not null and v_loan.next_due_date is distinct from p_scheduled_due_date then
    raise exception 'Este periodo ya fue cobrado o el prestamo ya avanzo a otra fecha.';
  end if;

  if exists (
    select 1
    from payments
    where user_id = v_user_id
      and loan_id = v_loan.id
      and scheduled_due_date = v_scheduled_due
  ) then
    raise exception 'Ya existe un cobro registrado para este periodo.';
  end if;

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
    next_due_date = case when v_new_remaining = 0 then null else v_next_due end,
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
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_status_lifecycle') then
    alter table subscriptions add constraint subscriptions_status_lifecycle check (status in ('active', 'past_due', 'cancelled', 'refunded', 'expired', 'chargeback')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plan_requests_status_lifecycle') then
    alter table plan_requests add constraint plan_requests_status_lifecycle check (status in ('pending', 'approved', 'failed', 'cancelled', 'refunded', 'expired', 'chargeback', 'past_due')) not valid;
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
  if not exists (select 1 from pg_constraint where conname = 'loans_operation_type_valid') then
    alter table loans add constraint loans_operation_type_valid check (operation_type in ('principal', 'ampliacion')) not valid;
  end if;
  alter table loans drop constraint if exists loans_parent_matches_type;
  alter table loans add constraint loans_parent_matches_type check (
    (operation_type = 'principal' and parent_loan_id is null)
    or
    (operation_type = 'ampliacion')
  ) not valid;
  if not exists (select 1 from pg_constraint where conname = 'loans_due_date_not_before_start') then
    alter table loans add constraint loans_due_date_not_before_start check (next_due_date is null or next_due_date >= start_date) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_status_matches_remaining_capital') then
    alter table loans add constraint loans_status_matches_remaining_capital check (
      (status = 'closed' and remaining_capital = 0)
      or
      (status = 'active' and remaining_capital > 0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'loans_status_matches_due_date') then
    alter table loans add constraint loans_status_matches_due_date check (
      (status = 'closed' and next_due_date is null)
      or
      (status = 'active' and next_due_date is not null)
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
alter table subscriptions validate constraint subscriptions_status_lifecycle;
alter table plan_requests validate constraint plan_requests_status_lifecycle;
alter table loans validate constraint loans_amount_nonnegative;
alter table loans validate constraint loans_amount_positive;
alter table loans validate constraint loans_remaining_capital_nonnegative;
alter table loans validate constraint loans_remaining_capital_not_above_amount;
alter table loans validate constraint loans_monthly_rate_nonnegative;
alter table loans validate constraint loans_due_day_valid;
alter table loans validate constraint loans_status_valid;
alter table loans validate constraint loans_interest_mode_valid;
alter table loans validate constraint loans_operation_type_valid;
alter table loans validate constraint loans_parent_matches_type;
alter table loans validate constraint loans_due_date_not_before_start;
alter table loans validate constraint loans_status_matches_remaining_capital;
alter table loans validate constraint loans_status_matches_due_date;
alter table payments validate constraint payments_interest_paid_nonnegative;
alter table payments validate constraint payments_capital_paid_nonnegative;
alter table payments validate constraint payments_has_amount;
alter table payments validate constraint payments_remaining_after_nonnegative;
alter table capital_movements validate constraint capital_movements_type_valid;
alter table capital_movements validate constraint capital_movements_amount_positive;
alter table loans validate constraint loans_client_same_user;
alter table payments validate constraint payments_loan_same_user;
alter table payments validate constraint payments_client_same_user;

create unique index if not exists loans_one_principal_per_client
on loans(user_id, client_id)
where operation_type = 'principal';

grant select, insert, update, delete on capital_movements to authenticated;
grant select, insert, update, delete on claim_book_entries to authenticated;
