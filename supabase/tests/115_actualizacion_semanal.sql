-- Iter 5l · actualización semanal por comando del servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","inicioPlan":"2026-08-01","finPlan":"2026-12-31","creada":"2026-08-01","finEst":"2026-12-31","est":["finEst","presupuesto"],"deps":[]}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado","rag":"Verde","lider":"Ada Administra","deps":[]}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
select public.apih_actualizacion_semanal('PRJ-001', '{"avance":45,"rag":"Ámbar","finEst":"2027-01-15","logros":"Se entregó X","proximos":"Hacer Y","issue":""}'::jsonb, false);
create temp table p as select substr(datos,4)::jsonb j from public.registros_v where id = 'PRJ-001';
select pg_temp.ok((select j->>'rag' from p) = 'Ámbar' and (select j->>'finEst' from p) = '2027-01-15' and (select j->>'logros' from p) = 'Se entregó X', 'se guardan RAG, fin estimado y logros');
select pg_temp.ok((select (j->>'avance')::int from p) = 45 and (select (j->>'avanceManual')::int from p) = 45, 'el avance cargado queda como ajuste manual');
select pg_temp.ok((select j->>'actualizada' from p) = '2026-10-28', 'fecha de actualización');
select pg_temp.ok((select j->'est' from p) = '[]'::jsonb, 'las marcas de estimado de campos cambiados o ajenos se retiran');
select pg_temp.ok((select jsonb_array_length(j->'snapFase') from p) = 1 and (select j->'snapFase'->0->>0 from p) = '2026-10-28' and (select j->'snapFase'->0->1 ? 'F:Ejecución' from p), 'foto semanal de la fase');
select pg_temp.ok((select j->'hist'->-1->>0 from p) = '2026-10-28', 'historial de avance al día');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Actualización semanal: Avance 15% → 45%; RAG Verde → Ámbar; Fin estimado%') = 1, 'bitácora con las diferencias');
select public.apih_actualizacion_semanal('PRJ-001', '{}'::jsonb, true);
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%sin novedades, el proyecto sigue vigente%') = 1, 'sin novedades: queda en la bitácora');
select pg_temp.ok((select jsonb_array_length(substr(datos,4)::jsonb->'snapFase') from public.registros_v where id='PRJ-001') = 1, 'la foto del mismo día se reemplaza, no se duplica');
select pg_temp.falla($$select public.apih_actualizacion_semanal('PRJ-001', '{"avance":150,"rag":"Verde"}'::jsonb, false)$$, 'avance fuera de rango', '%0 a 100%');
select pg_temp.falla($$select public.apih_actualizacion_semanal('PRJ-001', '{"avance":10,"rag":"Azul"}'::jsonb, false)$$, 'RAG inválido', '%Verde, Ámbar o Rojo%');
select pg_temp.falla($$select public.apih_actualizacion_semanal('PRJ-002', '{"avance":10,"rag":"Verde"}'::jsonb, false)$$, 'proyecto cerrado', '%cerrado%');
commit;
