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

grant select, insert, update, delete on capital_movements to authenticated;
