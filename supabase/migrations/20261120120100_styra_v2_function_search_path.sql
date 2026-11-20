-- Pin search_path on every styra function (Supabase advisor 0011, function_search_path_mutable).
-- All function bodies use schema-qualified names, so an empty search_path changes nothing else.
-- Idempotent.
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'styra' and p.prokind = 'f' loop
    execute format('alter function %s set search_path = %L', f.sig, '');
  end loop;
end $$;
