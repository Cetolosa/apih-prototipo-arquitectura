-- Iter 5k · cargas por lote: el servidor aplica cada fila con las reglas de los formularios
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","inicioPlan":"2026-08-01","finPlan":"2026-12-31","creada":"2026-08-01","deps":[]}'),
 ('APIH_Hitos','HIT-001','p1.{"id":"HIT-001","ini":"PRJ-001","nombre":"Existente","fase":"Ejecución","resp":"Ada Administra","fecha":"2026-11-01","completado":false}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
create temp table r as select public.apih_cargar_lote('Carga de prueba', 'PRJ-001', jsonb_build_array(
  jsonb_build_object('k','ini','id','PRJ-001','datos',jsonb_build_object('rag','Ámbar','avanceManual',40,'finPlan','2027-02-15','subfases',jsonb_build_array(jsonb_build_object('id','PRJ-001-SF1','nombre','Piloto','fase','Ejecución','inicio','2026-09-01','fin','2026-10-31')))),
  jsonb_build_object('k','hito','id','HIT-001','datos',jsonb_build_object('fecha','2026-11-15','subfase','PRJ-001-SF1')),
  jsonb_build_object('k','hito','id',null,'datos',jsonb_build_object('ini','PRJ-001','nombre','Nuevo','fase','Ejecución','fecha','2026-12-01','resp','Ada Administra')),
  jsonb_build_object('k','hito','id',null,'datos',jsonb_build_object('ini','PRJ-001','nombre','','fase','Ejecución','fecha','2026-12-01')),
  jsonb_build_object('k','riesgo','id',null,'datos',jsonb_build_object('ini','PRJ-001','desc','Riesgo nuevo','prob',2,'imp',2)),
  jsonb_build_object('k','riesgo','id',null,'datos',jsonb_build_object('ini','PRJ-001','desc','Crítico sin plan','prob',5,'imp',5)))) j;
select pg_temp.ok((select (j->>'ok')::int from r) = 4, 'se aplican las filas válidas (4)');
select pg_temp.ok((select jsonb_array_length(j->'errores') from r) = 2, 'las inválidas se omiten e informan (hito sin nombre, riesgo crítico sin plan)');
select pg_temp.ok((select substr(datos,4)::jsonb->>'rag' from public.registros_v where id='PRJ-001') = 'Ámbar', 'cambio de ficha aplicado');
select pg_temp.ok((select substr(datos,4)::jsonb->>'finPlan' from public.registros_v where id='PRJ-001') = '2027-02-15', 'fin plan cambiado');
select pg_temp.ok((select substr(datos,4)::jsonb->'subfases'->0->>'nombre' from public.registros_v where id='PRJ-001') = 'Piloto', 'subfase guardada');
select pg_temp.ok((select substr(datos,4)::jsonb->>'fecha' from public.registros_v where id='HIT-001') = '2026-11-15', 'hito existente actualizado');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Hitos') = 2, 'hito nuevo creado con id del servidor');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Riesgos') = 1, 'solo el riesgo válido');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Carga de prueba%') = 1, 'una sola anotación de bitácora');
commit;
