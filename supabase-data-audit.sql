-- Auditoria no destructiva de datos financieros.
-- Ejecuta estas consultas en Supabase SQL Editor para revisar datos reales.
-- No modifica ni borra informacion.

select 'loans_negative_or_invalid_amount' as check_name, *
from loans
where amount <= 0
   or remaining_capital < 0
   or monthly_rate < 0
   or remaining_capital > amount;

select 'loans_status_inconsistent' as check_name, *
from loans
where (status = 'closed' and remaining_capital <> 0)
   or (status = 'active' and remaining_capital <= 0)
   or status not in ('active', 'closed');

select 'loans_invalid_dates' as check_name, *
from loans
where next_due_date < start_date
   or due_day < 1
   or due_day > 31
   or interest_mode not in ('monthly', 'biweekly', 'weekly', 'daily');

select 'loans_without_same_user_client' as check_name, loans.*
from loans
left join clients
  on clients.id = loans.client_id
 and clients.user_id = loans.user_id
where clients.id is null;

select 'payments_negative_or_zero' as check_name, *
from payments
where interest_paid < 0
   or capital_paid < 0
   or coalesce(remaining_capital_after, 0) < 0
   or (interest_paid = 0 and capital_paid = 0);

select 'payments_without_same_user_loan' as check_name, payments.*
from payments
left join loans
  on loans.id = payments.loan_id
 and loans.user_id = payments.user_id
where loans.id is null;

select 'payments_without_same_user_client' as check_name, payments.*
from payments
left join clients
  on clients.id = payments.client_id
 and clients.user_id = payments.user_id
where clients.id is null;

select 'payments_client_does_not_match_loan' as check_name, payments.*
from payments
join loans
  on loans.id = payments.loan_id
where payments.client_id <> loans.client_id
   or payments.user_id <> loans.user_id;

select 'capital_movements_invalid' as check_name, *
from capital_movements
where amount <= 0
   or type not in ('deposit', 'withdrawal');

select
  'capital_position_by_user' as check_name,
  profiles.email,
  coalesce(sum(capital_movements.amount) filter (where capital_movements.type = 'deposit'), 0) as capital_added,
  coalesce(sum(capital_movements.amount) filter (where capital_movements.type = 'withdrawal'), 0) as capital_withdrawn,
  coalesce((
    select sum(payments.interest_paid)
    from payments
    where payments.user_id = profiles.id
  ), 0) as interest_collected,
  coalesce((
    select sum(loans.remaining_capital)
    from loans
    where loans.user_id = profiles.id
      and loans.status = 'active'
  ), 0) as active_capital_pending
from profiles
left join capital_movements
  on capital_movements.user_id = profiles.id
group by profiles.id, profiles.email;

select
  'possible_duplicate_payments' as check_name,
  user_id,
  loan_id,
  client_id,
  date,
  scheduled_due_date,
  interest_paid,
  capital_paid,
  count(*) as repeated_count,
  array_agg(id order by created_at) as payment_ids
from payments
group by user_id, loan_id, client_id, date, scheduled_due_date, interest_paid, capital_paid
having count(*) > 1;

select
  'duplicate_client_phone_same_user' as check_name,
  user_id,
  phone,
  count(*) as repeated_count,
  array_agg(id order by created_at) as client_ids
from clients
where nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') is not null
group by user_id, phone
having count(*) > 1;

select
  'loan_payment_reconciliation' as check_name,
  loans.id as loan_id,
  loans.user_id,
  loans.client_id,
  loans.amount,
  loans.remaining_capital,
  coalesce(sum(payments.capital_paid), 0) as capital_paid_total,
  round(loans.amount - coalesce(sum(payments.capital_paid), 0), 2) as expected_remaining,
  round(loans.remaining_capital - (loans.amount - coalesce(sum(payments.capital_paid), 0)), 2) as difference
from loans
left join payments
  on payments.loan_id = loans.id
 and payments.user_id = loans.user_id
group by loans.id
having round(loans.remaining_capital - (loans.amount - coalesce(sum(payments.capital_paid), 0)), 2) <> 0;
