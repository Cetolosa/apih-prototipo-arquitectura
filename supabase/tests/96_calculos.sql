-- Iter 2: los valores calculados salen de la base (apih_calculos)
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;

insert into public.registros(lista,id,datos) values
  ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","tolDesv":7,"umbralCritico":15,"diasSinUpdate":14,"metodo":{"fasesPrj":["Planificación","Ejecución","Transición","Cierre"]}}'),
  ('APIH_Proyectos','CP-1','p1.{"tipo":"Proyecto","titulo":"Atrasado","area":"A","fase":"Ejecución","estado":"En curso","rag":"Verde","prioridad":"Alta","avance":10,"inicioPlan":"2026-08-01","finPlan":"2026-10-01","presupuesto":1000,"beneficio":1500,"actualizada":"2026-10-27","lider":"Ana","sponsor":"S"}'),
  ('APIH_Proyectos','CP-2','p1.{"tipo":"Proyecto","titulo":"Cerrado","area":"A","fase":"Cierre","estado":"Completado","finReal":"2026-09-01","finPlan":"2026-08-30","presupuesto":0}'),
  ('APIH_Hitos','CH-1','p1.{"ini":"CP-1","nombre":"vencido","fase":"Ejecución","fecha":"2026-10-20","completado":false}'),
  ('APIH_Hitos','CH-2','p1.{"ini":"CP-1","nombre":"pronto","fase":"Ejecución","fecha":"2026-10-30","completado":false}'),
  ('APIH_Hitos','CH-3','p1.{"ini":"CP-1","nombre":"tarde","fase":"Planificación","fecha":"2026-09-01","completado":true,"fechaReal":"2026-09-05"}'),
  ('APIH_Hitos','CH-4','p1.{"ini":"CP-1","nombre":"lejos","fase":"Ejecución","fecha":"2026-12-30","completado":false}'),
  ('APIH_Riesgos','CR-1','p1.{"ini":"CP-1","prob":4,"imp":4,"estado":"Abierto"}'),
  ('APIH_Riesgos','CR-2','p1.{"ini":"CP-1","prob":2,"imp":2,"estado":"Cerrado"}')
on conflict (lista,id) do update set datos = excluded.datos;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok((public.apih_calculos()->>'hoy') = '2026-10-28', 'hoy sale de la configuración (hoyFija)');
select pg_temp.ok((public.apih_calculos()->'hitos'->'CH-1'->>'k') = 'over' and (public.apih_calculos()->'hitos'->'CH-1'->>'t') = 'Vencido (8 d)', 'hito vencido');
select pg_temp.ok((public.apih_calculos()->'hitos'->'CH-2'->>'k') = 'soon' and (public.apih_calculos()->'hitos'->'CH-2'->>'t') = 'Vence en 2 d', 'hito por vencer');
select pg_temp.ok((public.apih_calculos()->'hitos'->'CH-3'->>'k') = 'late', 'hito completado con retraso');
select pg_temp.ok((public.apih_calculos()->'hitos'->'CH-4'->>'k') = 'ok', 'hito en plazo');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->>'forecast') = '2026-12-30', 'fin proyectado: el último hito abierto');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->>'desv')::int = 90, 'desvío en días respecto del fin plan');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->>'atrasado')::boolean, 'atrasado sobre la tolerancia');
select pg_temp.ok(not (public.apih_calculos()->'ini'->'CP-2'->>'atrasado')::boolean, 'un proyecto completado no está atrasado');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-2'->>'forecast') = '2026-09-01', 'completado: fin real');
select pg_temp.ok(round((public.apih_calculos()->'ini'->'CP-1'->>'roi')::numeric) = 50, 'ROI');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-2'->>'roi') is null, 'ROI sin presupuesto: nulo');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->'rag'->>'rag') = 'Rojo', 'semáforo sugerido rojo (desvío, hito vencido, riesgo crítico, avance bajo)');
select pg_temp.ok((public.apih_calculos()->'riesgos'->'CR-1'->>'expo')::int = 16 and (public.apih_calculos()->'riesgos'->'CR-1'->'nivel'->>'n') = 'Crítico', 'riesgo crítico por exposición');
select pg_temp.ok(not (public.apih_calculos()->'riesgos'->'CR-2'->>'critico')::boolean and (public.apih_calculos()->'riesgos'->'CR-2'->'nivel'->>'n') = 'Bajo', 'riesgo cerrado no es crítico');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->'compl'->>'pct')::int between 1 and 99, 'completitud parcial');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->>'crit')::numeric > 40, 'ranking de criticidad');
rollback;
begin; set local role authenticated;
select pg_temp.como('inv-a@test.cl');
select pg_temp.ok((public.apih_calculos()->'ini'->'CP-1'->>'roi') is null, 'sin montos no hay ROI (se respeta la ocultación)');
rollback;
select 'PRUEBAS DE CALCULOS OK';
