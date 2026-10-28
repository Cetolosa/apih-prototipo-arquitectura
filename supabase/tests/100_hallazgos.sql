-- Iter 4b: los hallazgos (reglas PMO, riesgos y roadmap) y el puntaje de priorización los calcula el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.h(p_regla text, p_ini text) returns jsonb language sql security definer as
$$ select f from jsonb_array_elements(public.apih_calculos() -> 'hallazgos') f where f ->> 'regla' = p_regla and (p_ini is null or f ->> 'ini' = p_ini) limit 1 $$;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","capacidadMax":2,"decEscalaDias":7,"tolDesv":5,"diasSinUpdate":14}') on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
 ('APIH_Proyectos','PRJ-H1','p1.{"tipo":"Proyecto","titulo":"Atrasado","area":"BISE","lider":"Ana","fase":"Ejecución","estado":"En curso","rag":"Verde","avance":10,"inicioPlan":"2026-06-01","finPlan":"2026-09-15","actualizada":"2026-08-01","prioridad":"Media","gastado":400,"base":{"fecha":"2026-06-01","inicio":"2026-06-01","fin":"2026-12-31","pres":1000,"hitos":[{"id":"HIT-H1","fecha":"2026-09-01"}]}}'),
 ('APIH_Proyectos','PRJ-H2','p1.{"tipo":"Proyecto","titulo":"Dependiente","area":"BISE","lider":"Ana","fase":"Planificación","estado":"En curso","rag":"Verde","avance":0,"inicioPlan":"2026-10-20","finPlan":"2027-03-31","actualizada":"2026-10-27","deps":["PRJ-H1"],"prioridad":"Baja"}'),
 ('APIH_Proyectos','PRJ-H3','p1.{"tipo":"Proyecto","titulo":"Tercero","area":"BISE","lider":"Ana","fase":"Ejecución","estado":"En curso","rag":"Verde","avance":50,"inicioPlan":"2026-09-01","finPlan":"2027-02-28","actualizada":"2026-10-27"}'),
 ('APIH_Propuestas','PRO-H1','p1.{"tipo":"Propuesta","titulo":"Propuesta buena","area":"BISE","lider":"Ana","fase":"Aprobación","estado":"Vigente","presupuesto":100,"beneficio":1000,"score":{"valor":5,"estrategia":5,"esfuerzo":1,"riesgo":1},"faseDesde":"2026-08-01","actualizada":"2026-10-20"}'),
 ('APIH_Hitos','HIT-H1','p1.{"id":"HIT-H1","ini":"PRJ-H1","nombre":"Entrega 1","fase":"Ejecución","fecha":"2026-09-15","completado":false}'),
 ('APIH_Riesgos','RSK-H1','p1.{"ini":"PRJ-H3","desc":"Proveedor","prob":5,"imp":5,"estado":"Abierto"}'),
 ('APIH_Decisiones','DEC-H1','p1.{"ini":"PRJ-H1","titulo":"Vieja","tipo":"Mantener","solicita":"Ana","estado":"Pendiente","limite":"2026-10-01"}'),
 ('APIH_Decisiones','DEC-H2','p1.{"ini":"PRJ-H1","titulo":"Reciente","tipo":"Mantener","solicita":"Ana","estado":"Pendiente","limite":"2026-10-25"}')
 on conflict (lista,id) do nothing;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok(pg_temp.h('Proyecto atrasado', 'PRJ-H1')->>'sev' = '3', 'proyecto atrasado más de 30 d: severidad crítica');
select pg_temp.ok(pg_temp.h('Proyecto atrasado', 'PRJ-H1')->'fx'->0->>'a' = 'fxrag' and pg_temp.h('Proyecto atrasado', 'PRJ-H1')->'fx'->0->>'rag' = 'Rojo', 'sugiere el RAG que calcula el servidor');
select pg_temp.ok(pg_temp.h('Sin actualización', 'PRJ-H1')->>'sev' = '2', 'sin actualización: más del doble del umbral = atención');
select pg_temp.ok(pg_temp.h('Hito vencido', 'PRJ-H1')->>'titulo' = '1 hito(s) vencido(s) en Atrasado', 'hito vencido');
select pg_temp.ok(pg_temp.h('Decisión vencida', 'PRJ-H1')->>'titulo' like 'Decisión vencida hace 27 d%', 'decisión vencida');
select pg_temp.ok(pg_temp.h('Decisión escalada', 'PRJ-H1')->>'titulo' like 'Decisión escalada (27 d%', 'decisión escalada pasado el plazo');
select pg_temp.ok((select count(*) from jsonb_array_elements(public.apih_calculos()->'hallazgos') f where f->>'regla' in ('Decisión vencida','Decisión escalada') and f->>'ini' = 'PRJ-H1') = 3, 'la decisión vencida hace 3 d es vencida pero no escalada (2 vencidas + 1 escalada)');
select pg_temp.ok(pg_temp.h('Impacto alto + Probabilidad alta', 'PRJ-H3')->>'sev' = '3', 'riesgo crítico');
select pg_temp.ok(pg_temp.h('Sin plan de mitigación', 'PRJ-H3')->>'rid' = 'RSK-H1', 'riesgo de exposición alta sin mitigación');
select pg_temp.ok(pg_temp.h('Dependencias críticas', 'PRJ-H2')->>'titulo' like 'Dependiente depende de Atrasado (%', 'dependencia crítica de una predecesora atrasada');
select pg_temp.ok(pg_temp.h('Secuencia de dependencias', 'PRJ-H2') is not null, 'inicia antes de que termine su predecesora');
select pg_temp.ok(pg_temp.h('Sobrecarga de líder', null)->>'titulo' like 'Ana lidera % proyectos activos (capacidad 2)', 'líder sobre su capacidad');
select pg_temp.ok(pg_temp.h('Sobrecarga de líder', 'PRJ-H2') is not null, 'proyecto de prioridad baja en Planificación con líder sobrecargado');
select pg_temp.ok(pg_temp.h('Desfase de trimestre', 'PRJ-H1') is not null, 'desfase de trimestre');
select pg_temp.ok((public.apih_calculos()->'puntajes'->>'PRO-H1')::int = 90, 'puntaje de priorización de la propuesta evaluada');
select pg_temp.ok(pg_temp.h('Desempeño vs línea base', 'PRJ-H1')->>'detalle' like 'SPI 0.14 · CPI 0.25%', 'valor ganado contra la línea base (SPI/CPI)');
select pg_temp.ok((public.apih_calculos()->'evm'->'PRJ-H1'->>'movidos')::int = 1, 'cuenta los hitos movidos respecto de la línea base');
select pg_temp.ok(pg_temp.h('Candidatos a iniciar', 'PRO-H1')->>'detalle' like 'Ana está al límite de capacidad%', 'propuesta candidata: avisa que el líder está al límite');
select pg_temp.ok(pg_temp.h('Propuesta estancada', 'PRO-H1')->>'sev' = '2', 'propuesta estancada pasado el umbral rojo (88 d)');
select pg_temp.ok((select (f->>'sev')::int from jsonb_array_elements(public.apih_calculos()->'hallazgos') f limit 1) = 3, 'los hallazgos vienen ordenados por severidad');
rollback;
begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
select pg_temp.ok((select count(*) from jsonb_array_elements(public.apih_calculos()->'hallazgos') f where f->>'ini' like 'PRJ-H%') = 0, 'un colaborador de otra área no recibe hallazgos de proyectos que no ve');
rollback;
