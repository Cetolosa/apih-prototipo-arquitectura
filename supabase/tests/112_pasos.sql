-- Iter 5i · «Siguientes pasos» calculados en el servidor (apih_cielo().pasos)
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Compromisos','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"L","inicioPlan":"2026-08-01","finPlan":"2026-12-31","creada":"2026-08-01","deps":[]}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado","rag":"Verde","lider":"L","deps":[]}'),
 ('APIH_Hitos','H-1','p1.{"id":"H-1","ini":"PRJ-001","nombre":"Vencido","fase":"Ejecución","resp":"L","fecha":"2026-10-20","completado":false}'),
 ('APIH_Hitos','H-2','p1.{"id":"H-2","ini":"PRJ-001","nombre":"Hoy","fase":"Ejecución","resp":"L","fecha":"2026-10-28","completado":false}'),
 ('APIH_Hitos','H-3','p1.{"id":"H-3","ini":"PRJ-001","nombre":"Esta semana","fase":"Ejecución","resp":"L","fecha":"2026-11-02","completado":false}'),
 ('APIH_Hitos','H-4','p1.{"id":"H-4","ini":"PRJ-001","nombre":"Lejano","fase":"Ejecución","resp":"L","fecha":"2026-12-20","completado":false}'),
 ('APIH_Riesgos','R-1','p1.{"id":"R-1","ini":"PRJ-001","desc":"Critico sin plan","prob":5,"imp":5,"estado":"Abierto"}'),
 ('APIH_Compromisos','ACU-1','p1.{"id":"ACU-1","ini":"PRJ-001","texto":"Entregar informe","resp":"L","limite":"2026-10-30","estado":"Abierto"}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
create temp table pa as select jsonb_array_elements(public.apih_cielo() -> 'pasos' -> 'PRJ-001') p;
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:hvH-1' and (p->>'u')::int = 0 and p->>'por' like 'Venció hace 8 d%'), 'hito vencido: paso de hoy');
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:hhH-2' and p->>'btn' = 'Marcar cumplido'), 'hito de hoy: marcar cumplido');
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:hsH-3' and (p->>'u')::int = 1), 'hito de esta semana');
select pg_temp.ok(not exists (select 1 from pa where p->>'k' like '%H-4'), 'hito lejano no aparece');
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:rmR-1' and p->>'tipo' = 'Riesgo crítico'), 'riesgo crítico sin mitigación');
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:cACU-1' and (p->>'u')::int = 1 and p->>'por' like 'Vence el 30-10%'), 'compromiso por vencer');
select pg_temp.ok(exists (select 1 from pa where p->>'k' = 'PRJ-001:dia'), 'tenedor Al día apagado → paso');
select pg_temp.ok((select (p->>'u')::int from pa order by p->>'u', p->>'f' limit 1) = 0, 'ordenado por urgencia');
select pg_temp.ok(public.apih_cielo() -> 'pasos' -> 'PRJ-002' is null, 'proyecto completado sin pasos');
commit;
