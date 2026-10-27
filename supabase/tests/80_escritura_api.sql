-- Escrituras tal como las hace la API REST con el rol authenticated (sin SELECT sobre `datos`).
-- ON CONFLICT DO UPDATE no sirve: exige ese SELECT. El cliente inserta ignorando duplicados y actualiza con PATCH.
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.filas(q text) returns int language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok(pg_temp.filas($$insert into public.registros(lista,id,datos) values ('APIH_Config','prueba-api','p1.{"a":1}') on conflict (lista,id) do nothing returning lista,id$$) = 1, 'admin: alta ignorando duplicados');
select pg_temp.ok(pg_temp.filas($$insert into public.registros(lista,id,datos) values ('APIH_Config','prueba-api','p1.{"a":9}') on conflict (lista,id) do nothing returning lista,id$$) = 0, 'admin: el duplicado no devuelve fila');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"a":2}' where lista='APIH_Config' and id='prueba-api'$$) = 1, 'admin: actualiza con PATCH');
select pg_temp.ok((select substr(datos,4)::jsonb from public.registros_v where id='prueba-api') = '{"a":2}'::jsonb, 'admin: ve el valor actualizado');
select pg_temp.ok(pg_temp.filas($$insert into public.registros(lista,id,datos) values ('APIH_Roles','usuarios','p1.{"u":1}') on conflict (lista,id) do nothing returning lista,id$$) = 1, 'admin: escribe la lista de roles');
rollback;

begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
do $$ declare e boolean := false; begin
  begin insert into public.registros(lista,id,datos) values ('APIH_Roles','usuarios','p1.{"u":1}') on conflict (lista,id) do nothing;
  exception when others then e := true; end;
  if not e then raise exception 'FALLA: un colaborador escribió la lista de roles'; end if;
  raise notice 'ok  colaborador: no puede escribir roles';
end $$;
rollback;
