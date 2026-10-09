-- ERMIF: revision de configuracion de seguridad, solo lectura.
-- Copiar todo en una consulta NUEVA del SQL Editor de Supabase.
-- Es un unico SELECT: no ejecuta las funciones de la aplicacion,
-- no cambia permisos y no consulta filas de clientes, prestamos ni pagos.
-- La columna detalle incluye definiciones como TEXTO para su revision.
-- Exportar el resultado completo como CSV.

with function_review as (
  select
    'funcion'::text as tipo,
    p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' as objeto,
    pg_catalog.jsonb_build_object(
      'retorno', pg_catalog.pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'propietario', pg_catalog.pg_get_userbyid(p.proowner),
      'configuracion', p.proconfig,
      'anon_execute', pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_execute', pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'service_role_execute', pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE'),
      'definicion', pg_catalog.pg_get_functiondef(p.oid),
      'triggers', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.pg_get_triggerdef(t.oid)), '[]'::jsonb)
        from pg_catalog.pg_trigger t
        where t.tgfoid = p.oid and not t.tgisinternal
      )
    ) as detalle
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and p.proname in (
      'enforce_capital_movement_rules', 'enforce_client_plan_limit',
      'enforce_loan_financial_rules', 'admin_update_user_plan',
      'clear_user_financial_history', 'create_client_with_loan',
      'create_loan_operation', 'create_user_backup', 'initialize_user_account',
      'is_admin', 'register_capital_movement', 'register_payment',
      'restore_user_backup', 'update_client_with_loan',
      'calculate_available_capital', 'validate_capital_movement_rules',
      'validate_loan_financial_rules'
    )
), table_review as (
  select
    'tabla'::text as tipo,
    c.relname::text as objeto,
    pg_catalog.jsonb_build_object(
      'rls_enabled', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity,
      'propietario', pg_catalog.pg_get_userbyid(c.relowner),
      'politicas', (
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(pol)), '[]'::jsonb)
        from pg_catalog.pg_policies pol
        where pol.schemaname = n.nspname and pol.tablename = c.relname
      ),
      'permisos', (
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'rol', r.role_name,
          'select', pg_catalog.has_table_privilege(r.role_name, c.oid, 'SELECT'),
          'insert', pg_catalog.has_table_privilege(r.role_name, c.oid, 'INSERT'),
          'update', pg_catalog.has_table_privilege(r.role_name, c.oid, 'UPDATE'),
          'delete', pg_catalog.has_table_privilege(r.role_name, c.oid, 'DELETE'),
          'truncate', pg_catalog.has_table_privilege(r.role_name, c.oid, 'TRUNCATE'),
          'columnas_actualizables', (
            select coalesce(pg_catalog.jsonb_agg(a.attname order by a.attnum), '[]'::jsonb)
            from pg_catalog.pg_attribute a
            where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
              and pg_catalog.has_column_privilege(r.role_name, c.oid, a.attnum, 'UPDATE')
          )
        ))
        from (values ('anon'::text), ('authenticated'::text), ('service_role'::text)) r(role_name)
      )
    ) as detalle
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in (
      'profiles', 'subscriptions', 'clients', 'loans', 'payments',
      'capital_movements', 'plan_requests', 'user_backups',
      'claim_book_entries', 'claim_book_events', 'privacy_requests',
      'account_deletion_requests', 'email_outbox'
    )
)
select tipo, objeto, detalle from function_review
union all
select tipo, objeto, detalle from table_review
order by tipo, objeto;