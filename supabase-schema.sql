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
drop policy if exists "clients own data" on clients;
drop policy if exists "loans own data" on loans;
drop policy if exists "payments own data" on payments;
drop policy if exists "plan requests own data" on plan_requests;
drop policy if exists "user backups own data" on user_backups;
drop policy if exists "profiles admin data" on profiles;
drop policy if exists "subscriptions admin data" on subscriptions;
drop policy if exists "clients admin data" on clients;
drop policy if exists "loans admin data" on loans;
drop policy if exists "payments admin data" on payments;
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

create policy "subscriptions own data"
on subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on profiles to authenticated;
grant select, insert, update, delete on subscriptions to authenticated;
grant select, insert, update, delete on clients to authenticated;
grant select, insert, update, delete on loans to authenticated;
grant select, insert, update, delete on payments to authenticated;
grant select, insert, update, delete on plan_requests to authenticated;
grant select, insert, update, delete on user_backups to authenticated;

-- Despues de ejecutar este archivo, activa tu cuenta admin cambiando el correo:
-- update profiles
-- set is_admin = true
-- where id = (select id from auth.users where email = 'TU_CORREO_AQUI');
