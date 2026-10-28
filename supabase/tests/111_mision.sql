-- Iter 5h · misión de Mi cocina: listas de lo vencido desde el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Compromisos');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"L","inicioPlan":"2026-08-01","finPlan":"2026-12-31","deps":[]}'),
 ('APIH_Hitos','H-1','p1.{"id":"H-1","ini":"PRJ-001","nombre":"Vencido","fase":"Ejecución","resp":"L","fecha":"2026-10-01","completado":false}'),
 ('APIH_Hitos','H-2','p1.{"id":"H-2","ini":"PRJ-001","nombre":"Futuro","fase":"Ejecución","resp":"L","fecha":"2026-12-01","completado":false}'),
 ('APIH_Hitos','H-3','p1.{"id":"H-3","ini":"PRJ-001","nombre":"Cumplido","fase":"Ejecución","resp":"L","fecha":"2026-09-01","completado":true,"fechaReal":"2026-09-01"}'),
 ('APIH_Riesgos','R-1','p1.{"id":"R-1","ini":"PRJ-001","desc":"Rev vencida","prob":2,"imp":2,"estado":"Abierto","fRev":"2026-10-01","mit":"plan"}'),
 ('APIH_Riesgos','R-2','p1.{"id":"R-2","ini":"PRJ-001","desc":"Critico sin plan","prob":5,"imp":5,"estado":"Abierto"}'),
 ('APIH_Riesgos','R-3','p1.{"id":"R-3","ini":"PRJ-001","desc":"Sano","prob":2,"imp":2,"estado":"Abierto","fRev":"2026-12-01","mit":"x"}'),
 ('APIH_Compromisos','ACU-1','p1.{"id":"ACU-1","ini":"PRJ-001","texto":"Vencido","resp":"L","limite":"2026-10-10","estado":"Abierto"}'),
 ('APIH_Compromisos','ACU-2','p1.{"id":"ACU-2","ini":"PRJ-001","texto":"Cumplido","resp":"L","limite":"2026-10-10","estado":"Cumplido"}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
create temp table m as select public.apih_calculos() -> 'mision' -> 'PRJ-001' j;
select pg_temp.ok((select jsonb_array_length(j -> 'hit') from m) = 1 and (select j -> 'hit' -> 0 ->> 'id' from m) = 'H-1', 'solo el hito vencido sin cerrar');
select pg_temp.ok((select jsonb_array_length(j -> 'cmp') from m) = 1 and (select j -> 'cmp' -> 0 ->> 'id' from m) = 'ACU-1', 'solo el compromiso vencido y abierto');
select pg_temp.ok((select jsonb_array_length(j -> 'rsk') from m) = 2, 'dos riesgos por atender (revisión vencida y crítico sin plan)');
select pg_temp.ok((select j -> 'rsk' @> '[{"id":"R-1","por":"rev"},{"id":"R-2","por":"crit"}]'::jsonb from m), 'motivo de cada riesgo');
commit;
