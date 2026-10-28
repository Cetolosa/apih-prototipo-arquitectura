-- Contrato de campos: una clave fuera del catálogo se rechaza; lo ya guardado y lo válido siguen pasando.
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(sql text, m text, patron text default null) returns void language plpgsql as
$$ declare e boolean := false; msg text; begin begin execute sql; exception when others then e := true; msg := sqlerrm; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if;
   if patron is not null and msg not like patron then raise exception 'FALLA (se rechazó por otra causa): % -> %', m, msg; end if;
   raise notice 'ok  % (rechazado)', m; end $$;
create or replace function pg_temp.hint_de(sql text) returns text language plpgsql as
$$ declare h text; begin begin execute sql; exception when others then get stacked diagnostics h = pg_exception_hint; return h; end; return null; end $$;

delete from public.registros where id like 'CAMPO-%';
-- fila heredada con una clave que el catálogo no conoce (la guardó el propietario, sin pasar por la regla)
insert into public.registros(lista, id, datos) values ('APIH_Proyectos', 'CAMPO-OLD', 'p1.{"id":"CAMPO-OLD","titulo":"Heredado","area":"A","estado":"En curso","rag":"Verde","claveHeredada":"x"}');

begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','CAMPO-1','p1.{"id":"CAMPO-1","titulo":"P","area":"A","campoInventado":"x"}')$$, 'insert con campo inventado', '%campo desconocido%campoInventado%');
select pg_temp.ok(pg_temp.hint_de($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','CAMPO-1','p1.{"id":"CAMPO-1","titulo":"P","area":"A","campoInventado":"x"}')$$) = 'campoInventado', 'hint: señala el campo inventado');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','CAMPO-H','p1.{"id":"CAMPO-H","ini":"CAMPO-OLD","nombre":"h","basura":"x"}')$$, 'hito con campo inventado', '%campo desconocido%');
select pg_temp.falla($$update public.registros set datos='p1.{"id":"CAMPO-OLD","titulo":"Heredado","area":"A","estado":"En curso","rag":"Verde","claveHeredada":"x","otraNueva":1}' where id='CAMPO-OLD'$$, 'update que agrega un campo nuevo', '%campo desconocido%otraNueva%');
-- lo válido pasa
insert into public.registros(lista, id, datos) values ('APIH_Proyectos','CAMPO-2','p1.{"id":"CAMPO-2","titulo":"P","area":"A","estado":"En curso","rag":"Verde","avance":10,"subfases":[],"base":{"fecha":"2026-10-27"}}');
select pg_temp.ok((select count(*) from public.registros_v where id = 'CAMPO-2') = 1, 'insert con campos del catálogo se guarda');
update public.registros set datos='p1.{"id":"CAMPO-OLD","titulo":"Heredado v2","area":"A","estado":"En curso","rag":"Verde","claveHeredada":"x"}' where id='CAMPO-OLD';
select pg_temp.ok(true, 'update que conserva la clave heredada se acepta');
rollback;

-- listas sin catálogo no se restringen (configuración de cada persona)
select pg_temp.ok((select count(*) from public.apih_campos where lista in ('APIH_Config','APIH_Roles','APIH_Claves')) = 0, 'configuración, roles y claves no tienen catálogo');
-- la tabla del catálogo no se lee directo
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select * from public.apih_campos$$, 'el catálogo no se lee con el rol de la app', '%permission denied%');
rollback;
delete from public.registros where id like 'CAMPO-%';
\echo PRUEBAS DE CAMPOS OK
