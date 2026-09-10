-- Pruebas manuales RLS multiusuario para ERMIF.
-- No ejecutes todo de golpe: reemplaza los UUID y corre cada bloque por separado.
-- En Supabase SQL Editor puedes simular JWT con:
--   set local role authenticated;
--   select set_config('request.jwt.claim.sub', 'UUID_DEL_USUARIO', true);
--   select set_config('request.jwt.claim.role', 'authenticated', true);
--
-- Reemplaza:
--   USER_A_UUID
--   USER_B_UUID
--   ADMIN_UUID
--   CLIENT_B_UUID
--   LOAN_B_UUID
--   BACKUP_B_UUID
--   CLAIM_B_UUID

-- PRUEBA 1: Usuario A solo ve sus clientes.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select count(*) as other_user_clients_visible
from clients
where user_id <> auth.uid();
rollback;

-- Esperado: other_user_clients_visible = 0.

-- PRUEBA 2: Usuario A intenta leer prestamo de B por ID conocido.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select *
from loans
where id = 'LOAN_B_UUID';
rollback;

-- Esperado: 0 filas.

-- PRUEBA 3: Usuario A intenta actualizar cliente de B.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update clients
set name = name || ' prueba'
where id = 'CLIENT_B_UUID';
rollback;

-- Esperado: 0 filas actualizadas o acceso denegado.

-- PRUEBA 4: Usuario A intenta eliminar prestamo de B.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
delete from loans
where id = 'LOAN_B_UUID';
rollback;

-- Esperado: 0 filas eliminadas o acceso denegado.

-- PRUEBA 5: Usuario normal intenta convertirse en admin.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update profiles
set is_admin = true
where id = auth.uid();
rollback;

-- Esperado: denegado por permisos de columna.

-- PRUEBA 6: Usuario normal intenta cambiarse a Pro.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update subscriptions
set plan = 'pro', client_limit = null, status = 'active'
where user_id = auth.uid();
rollback;

-- Esperado: denegado por falta de UPDATE sobre subscriptions.

-- PRUEBA 7: Usuario normal intenta insertar Pro directo.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into subscriptions (user_id, plan, client_limit, status)
values (auth.uid(), 'pro', null, 'active');
rollback;

-- Esperado: denegado por falta de INSERT sobre subscriptions.

-- PRUEBA 8: Usuario normal intenta aprobar solicitud de plan.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update plan_requests
set status = 'approved'
where user_id = auth.uid();
rollback;

-- Esperado: denegado por falta de UPDATE sobre plan_requests.

-- PRUEBA 9: Usuario normal intenta insertar pago saltando register_payment().
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into payments (user_id, loan_id, client_id, date, interest_paid, capital_paid)
values (auth.uid(), 'LOAN_B_UUID', 'CLIENT_B_UUID', current_date, 1, 0);
rollback;

-- Esperado: denegado por falta de INSERT sobre payments.

-- PRUEBA 10: Usuario A intenta ver backup de B.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select *
from user_backups
where id = 'BACKUP_B_UUID';
rollback;

-- Esperado: 0 filas.

-- PRUEBA 11: Usuario A intenta ver reclamo de B.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select *
from claim_book_entries
where id = 'CLAIM_B_UUID';
rollback;

-- Esperado: 0 filas.

-- PRUEBA 12: Admin consulta informacion global necesaria del panel.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'ADMIN_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select 'profiles' as table_name, count(*) from profiles
union all select 'subscriptions', count(*) from subscriptions
union all select 'clients', count(*) from clients
union all select 'loans', count(*) from loans
union all select 'payments', count(*) from payments
union all select 'plan_requests', count(*) from plan_requests;
rollback;

-- Esperado: el admin ve informacion global del panel.

-- PRUEBA 13: Usuario normal ejecuta consultas globales del panel.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'USER_A_UUID', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select 'profiles_other_users' as check_name, count(*) from profiles where id <> auth.uid()
union all select 'subscriptions_other_users', count(*) from subscriptions where user_id <> auth.uid()
union all select 'clients_other_users', count(*) from clients where user_id <> auth.uid()
union all select 'loans_other_users', count(*) from loans where user_id <> auth.uid()
union all select 'payments_other_users', count(*) from payments where user_id <> auth.uid()
union all select 'plan_requests_other_users', count(*) from plan_requests where user_id <> auth.uid();
rollback;

-- Esperado: todos los conteos = 0.
