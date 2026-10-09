-- Autorizado por el propietario: activar correos ERMIF con el respaldo local verificado.
-- Ejecutar solo despues de publicar el Worker version de cola 2 y comprobar el binding.
-- No recupera correos historicos ni aumenta los topes.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
do $$ begin
  if not exists (select 1 from public.email_settings where id=true) then raise exception 'Falta la migracion de correos'; end if;
  if to_regprocedure('public.email_claim_next()') is null then raise exception 'Falta la funcion de despacho'; end if;
end $$;
update public.email_settings
  set enabled=true, activated_at=coalesce(activated_at,now())
  where id=true;
select enabled, activated_at, daily_limit, monthly_limit from public.email_settings where id=true;
commit;
