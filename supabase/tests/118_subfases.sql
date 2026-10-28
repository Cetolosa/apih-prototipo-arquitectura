-- Iter 7 · subfases, nota de fase y solicitud de cambio por comando del servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora','APIH_Cambios');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
delete from public.perfiles where email in ('adm@test.cl','col@test.cl');
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}'),('col@test.cl','Cora Colabora','editor','Colaborador','{A}');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","inicioPlan":"2026-08-01","finPlan":"2027-03-31","deps":[]}'),
 ('APIH_Hitos','H-1','p1.{"id":"H-1","ini":"PRJ-001","nombre":"Hito","fase":"Ejecución","fecha":"2026-12-01","completado":false}'),
 ('APIH_Cambios','CHG-1','p1.{"id":"CHG-1","ini":"PRJ-001","tipo":"Fecha","estado":"Solicitado","desc":"x","motivo":"y"}'),
 ('APIH_Cambios','CHG-2','p1.{"id":"CHG-2","ini":"PRJ-001","tipo":"Fecha","estado":"Aprobado","desc":"x","motivo":"y"}');
begin; set local role authenticated;
select pg_temp.como('col@test.cl');
reset role;
create temp table v as select e from jsonb_array_elements(public.apih_ventanas((select substr(datos,4)::jsonb from public.registros where id='PRJ-001'), 'PRJ-001', false)) e where e->>'fase' = 'Ejecución';
grant select on v to authenticated;
set local role authenticated; select pg_temp.como('col@test.cl');
select public.apih_guardar_subfase('PRJ-001', null, jsonb_build_object('fase','Ejecución','nombre','  Montaje  ','resp','Ada'));
create temp table p as select substr(datos,4)::jsonb j from public.registros_v where id = 'PRJ-001';
select pg_temp.ok((select j->'subfases'->0->>'id' from p) = 'PRJ-001-SF1' and (select j->'subfases'->0->>'nombre' from p) = 'Montaje', 'crea la subfase con id y nombre depurado');
select pg_temp.ok((select j->'subfases'->0->>'inicio' from p) = (select e->>'ini' from v) and (select j->'subfases'->0->>'fin' from p) = (select e->>'fin' from v), 'sin fechas hereda las de la fase');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Subfase creada: Montaje%') = 1, 'queda en la bitácora');
select pg_temp.falla($$select public.apih_guardar_subfase('PRJ-001', null, '{"fase":"Ejecución","nombre":"montaje"}'::jsonb)$$, 'nombre repetido en la fase', '%ya existe una subfase%');
select pg_temp.falla($$select public.apih_guardar_subfase('PRJ-001', null, '{"fase":"Ejecución","nombre":"Otra","inicio":"2020-01-01"}'::jsonb)$$, 'fuera de la ventana de la fase', '%dentro de Ejecución%');
select pg_temp.falla($$select public.apih_guardar_subfase('PRJ-001', null, '{"fase":"Ejecución","nombre":""}'::jsonb)$$, 'sin nombre', '%escribe el nombre%');
select pg_temp.falla($$select public.apih_guardar_subfase('PRJ-001', 'PRJ-001-SF9', '{"fase":"Ejecución","nombre":"X"}'::jsonb)$$, 'subfase inexistente', '%no existe%');
reset role; update public.registros set datos = 'p1.' || (substr(datos,4)::jsonb || '{"subfase":"PRJ-001-SF1"}')::text where id = 'H-1'; set local role authenticated; select pg_temp.como('col@test.cl');
select public.apih_guardar_subfase('PRJ-001', 'PRJ-001-SF1', jsonb_build_object('fase','Ejecución','nombre','Montaje 2','desc','Detalle'));
select pg_temp.ok((select substr(datos,4)::jsonb->'subfases'->0->>'desc' from public.registros_v where id='PRJ-001') = 'Detalle', 'edita la subfase');
select public.apih_nota_fase('PRJ-001', 'Ejecución', ' Nota de fase ');
select pg_temp.ok((select substr(datos,4)::jsonb->'faseNota'->>'Ejecución' from public.registros_v where id='PRJ-001') = 'Nota de fase', 'guarda la nota de fase');
select public.apih_nota_fase('PRJ-001', 'Ejecución', '');
select pg_temp.ok(not (select substr(datos,4)::jsonb->'faseNota' ? 'Ejecución' from public.registros_v where id='PRJ-001'), 'nota vacía la quita');
select pg_temp.falla($$select public.apih_nota_fase('PRJ-001', 'Fase X', 'a')$$, 'fase inválida', '%elige la fase%');
select public.apih_eliminar_subfase('PRJ-001', 'PRJ-001-SF1');
select pg_temp.ok(jsonb_array_length((select substr(datos,4)::jsonb->'subfases' from public.registros_v where id='PRJ-001')) = 0 and not (select substr(datos,4)::jsonb ? 'subfase' from public.registros_v where id='H-1'), 'elimina la subfase y suelta sus hitos');
-- solicitud de cambio
select public.apih_eliminar('APIH_Cambios', 'CHG-1');
select pg_temp.ok((select count(*) from public.registros_v where id='CHG-1') = 0, 'elimina una solicitud pendiente');
select pg_temp.falla($$select public.apih_eliminar('APIH_Cambios', 'CHG-2')$$, 'no elimina una solicitud ya resuelta', '%ya resuelta%');
commit;
