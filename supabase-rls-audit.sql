-- Auditoria RLS y permisos de ERMIF.
-- No modifica datos. Ejecuta todo en Supabase SQL Editor.

select
  'rls_tables' as audit_section,
  namespaces.nspname as schemaname,
  classes.relname as tablename,
  classes.relrowsecurity as rls_enabled,
  classes.relforcerowsecurity as force_rls
from pg_class classes
join pg_namespace namespaces
  on namespaces.oid = classes.relnamespace
where namespaces.nspname = 'public'
  and classes.relkind in ('r', 'p')
  and classes.relname in (
    'profiles',
    'subscriptions',
    'clients',
    'loans',
    'payments',
    'capital_movements',
    'plan_requests',
    'user_backups',
    'claim_book_entries'
  )
order by classes.relname;

select
  'policies' as audit_section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'subscriptions',
    'clients',
    'loans',
    'payments',
    'capital_movements',
    'plan_requests',
    'user_backups',
    'claim_book_entries'
  )
order by tablename, policyname;

select
  'table_grants' as audit_section,
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in (
    'profiles',
    'subscriptions',
    'clients',
    'loans',
    'payments',
    'capital_movements',
    'plan_requests',
    'user_backups',
    'claim_book_entries'
  )
order by table_name, grantee, privilege_type;

select
  'column_update_grants' as audit_section,
  table_schema,
  table_name,
  column_name,
  grantee,
  privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and privilege_type = 'UPDATE'
  and table_name in (
    'profiles',
    'subscriptions',
    'clients',
    'loans',
    'payments',
    'capital_movements',
    'plan_requests',
    'user_backups',
    'claim_book_entries'
  )
order by table_name, grantee, column_name;

select
  'function_grants' as audit_section,
  routines.specific_schema,
  routines.routine_name,
  routines.security_type,
  routines.type_udt_name as returns_type,
  routine_privileges.grantee,
  routine_privileges.privilege_type
from information_schema.routines
left join information_schema.routine_privileges
  on routine_privileges.specific_schema = routines.specific_schema
 and routine_privileges.specific_name = routines.specific_name
where routines.specific_schema = 'public'
  and routines.routine_name in (
    'is_admin',
    'initialize_user_account',
    'admin_update_user_plan',
    'create_client_with_loan',
    'create_loan_operation',
    'update_client_with_loan',
    'register_payment',
    'register_capital_movement',
    'create_user_backup',
    'restore_user_backup',
    'restore_user_snapshot',
    'calculate_available_capital',
    'validate_loan_financial_rules',
    'validate_capital_movement_rules'
  )
  and (routine_privileges.grantee is null or routine_privileges.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role'))
order by routines.routine_name, routine_privileges.grantee;

select
  'public_service_key_scan' as audit_section,
  'Revisa tambien el repositorio: SUPABASE_SERVICE_ROLE_KEY solo debe existir como secret del Worker/backend.' as note;
