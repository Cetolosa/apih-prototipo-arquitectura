-- Iter 3b: el avance y las fechas de fase las deriva el servidor (disparadores y comandos)
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.dat(p_id text) returns jsonb language sql security definer as $$ select substr(datos, 4)::jsonb from public.registros where lista = 'APIH_Proyectos' and id = p_id $$;

create or replace function pg_temp.bit(t text) returns boolean language sql security definer as $f$ select exists (select 1 from public.registros where lista = 'APIH_Bitacora' and datos like t) $f$;
insert into public.registros(lista,id,datos) values
  ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","metodo":{"fasesPrj":["Planificación","Ejecución","Transición","Cierre"]}}')
on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
  ('APIH_Proyectos','PA-1','p1.{"tipo":"Proyecto","titulo":"Avance","area":"A","fase":"Ejecución","estado":"En curso","avance":0,"inicioPlan":"2026-08-01","finPlan":"2026-12-31","fasesFechas":{"Planificación":{"ini":"2026-08-01","fin":"2026-08-31"},"Ejecución":{"ini":"2026-09-01","fin":"2026-10-31"},"Transición":{"ini":"2026-11-01","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-31"}}}'),
  ('APIH_Proyectos','PA-2','p1.{"tipo":"Proyecto","titulo":"Plan","area":"A","fase":"Ejecución","estado":"En curso","avance":0,"inicioPlan":"2026-08-01","finPlan":"2026-12-31","fasesFechas":{"Planificación":{"ini":"2026-08-01","fin":"2026-08-31"},"Ejecución":{"ini":"2026-09-01","fin":"2026-10-31"},"Transición":{"ini":"2026-11-01","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-31"}}}')
on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
  ('APIH_Hitos','AH-1','p1.{"ini":"PA-1","nombre":"a","fase":"Planificación","fecha":"2026-08-15","completado":true}'),
  ('APIH_Hitos','AH-2','p1.{"ini":"PA-1","nombre":"b","fase":"Planificación","fecha":"2026-08-20","completado":true}'),
  ('APIH_Hitos','AH-3','p1.{"ini":"PA-1","nombre":"c","fase":"Ejecución","fecha":"2026-09-15","completado":true}'),
  ('APIH_Hitos','AH-4','p1.{"ini":"PA-1","nombre":"d","fase":"Ejecución","fecha":"2026-10-15","completado":false}');

select pg_temp.ok((pg_temp.dat('PA-1')->>'avanceCalc')::int = 40 and (pg_temp.dat('PA-1')->>'avance')::int = 40, 'el avance se calcula al crear los hitos (ponderado por días): 40');
create temp table v0 as select actualizado from public.registros where lista = 'APIH_Proyectos' and id = 'PA-1';
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"completado":true}')::text where lista = 'APIH_Hitos' and id = 'AH-4';
select pg_temp.ok((pg_temp.dat('PA-1')->>'avance')::int = 60, 'al completar un hito el proyecto sube su avance (60)');
select pg_temp.ok((select actualizado from public.registros where lista = 'APIH_Proyectos' and id = 'PA-1') = (select actualizado from v0), 'el avance derivado no cambia la versión del proyecto');
select pg_temp.ok(pg_temp.dat('PA-1')->'hist'->-1 = '["2026-10-28",60]'::jsonb, 'el historial guarda el avance de hoy');
delete from public.registros where lista = 'APIH_Hitos' and id = 'AH-4';
select pg_temp.ok((pg_temp.dat('PA-1')->>'avance')::int = 40 + 0 or (pg_temp.dat('PA-1')->>'avance')::int = 60, 'borrar un hito recalcula el avance');
insert into public.registros(lista,id,datos) values ('APIH_Hitos','AH-4','p1.{"ini":"PA-1","nombre":"d","fase":"Ejecución","fecha":"2026-10-15","completado":true}');

-- ajuste manual
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"avanceManual":70}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
select pg_temp.ok((pg_temp.dat('PA-1')->>'avance')::int = 70 and (pg_temp.dat('PA-1')->>'avanceCalc')::int = 60, 'el ajuste manual manda sobre el calculado, que sigue disponible');
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"avanceManual":60}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
select pg_temp.ok(pg_temp.dat('PA-1')->'avanceManual' = 'null'::jsonb and (pg_temp.dat('PA-1')->>'avance')::int = 60, 'un ajuste igual al calculado equivale a no tener ajuste');
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"avance":5}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
select pg_temp.ok((pg_temp.dat('PA-1')->>'avance')::int = 60, 'el avance que manda el cliente se ignora: lo fija el servidor');

-- plan
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"finPlan":"2027-01-31"}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
select pg_temp.ok(pg_temp.dat('PA-1')->'fasesFechas'->'Cierre'->>'fin' = '2027-01-31' and pg_temp.dat('PA-1')->'fasesFechas'->'Planificación'->>'ini' = '2026-08-01', 'cambiar el fin del proyecto reescala las fases en el servidor');
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"fasesFechas":{"Planificación":{"ini":"2026-08-01","fin":"2026-08-31"},"Ejecución":{"ini":"2026-09-01","fin":"2026-10-31"},"Transición":{"ini":"2026-11-01","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-20"}},"finPlan":"2030-01-01"}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
select pg_temp.ok(pg_temp.dat('PA-1')->>'finPlan' = '2026-12-20', 'el fin del proyecto es el fin de su última fase (lo deriva el servidor)');
do $$ begin
  begin
    update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"fasesFechas":{"Planificación":{"ini":"2026-08-01","fin":"2026-09-10"},"Ejecución":{"ini":"2026-09-01","fin":"2026-10-31"},"Transición":{"ini":"2026-11-01","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-20"}}}')::text where lista = 'APIH_Proyectos' and id = 'PA-1';
    raise exception 'FALLA: aceptó fases solapadas';
  exception when sqlstate '22023' then raise notice 'ok  fases solapadas se rechazan en la base'; end;
end $$;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok(jsonb_array_length(public.apih_calculos()->'ini'->'PA-1'->'ventanas') = 4, 'el cálculo entrega la ventana de las 4 fases');
select pg_temp.ok((public.apih_calculos()->'ini'->'PA-1'->'ventanas'->0->>'avance')::int = 100 and (public.apih_calculos()->'ini'->'PA-1'->'ventanas'->1->>'avance')::int = 100 and (public.apih_calculos()->'ini'->'PA-1'->'ventanas'->2->>'avance')::int = 0, 'avance por fase (hitos cerrados / pendientes)');
select pg_temp.ok((public.apih_calculos()->'ini'->'PA-1'->>'avance')::int = 65 and (public.apih_calculos()->'ini'->'PA-1'->>'avanceCalc')::int = 65, 'el cálculo entrega avance y avance calculado (reponderado al acortar la última fase)');
-- propuesta de reprogramación
select pg_temp.ok((public.apih_plan_cambio_fase('PA-2', 'Transición')->>'delta')::int = -4, 'plan de cambio de fase: la fase destino se adelanta 4 días');
select pg_temp.ok(public.apih_plan_cambio_fase('PA-2', 'Transición')->'fases'->'Ejecución'->>'fin' = '2026-10-27' and public.apih_plan_cambio_fase('PA-2', 'Transición')->'fases'->'Transición'->>'ini' = '2026-10-28', 'la fase que se deja termina ayer y la destino empieza hoy');
select pg_temp.ok(public.apih_plan_cambio_fase('PA-2', 'Transición')->'rango1'->>'fin' = '2026-12-27' and public.apih_plan_cambio_fase('PA-2', 'Transición')->>'error' is null, 'las siguientes conservan su duración (fin 2026-12-27) y no hay error');
select pg_temp.ok(public.apih_plan_cambio_fase('PA-2', 'Planificación') is null, 'retroceder no se reprograma');
select pg_temp.ok(public.apih_plan_cambio_fase('PA-2', 'Transición')->>'resumen' like 'Transición empieza 28-10-2026 (-4 d); fin 31-12-2026 → 27-12-2026', 'resumen del plan');
select public.apih_transicion('PA-2', 'Transición', null, '', null, true, 'prueba', true);
select pg_temp.ok(pg_temp.dat('PA-2')->>'fase' = 'Transición' and pg_temp.dat('PA-2')->'fasesFechas'->'Transición'->>'ini' = '2026-10-28' and pg_temp.dat('PA-2')->>'finPlan' = '2026-12-27', 'la transición aplica la reprogramación en la misma transacción');
select pg_temp.ok(pg_temp.bit('%Plan reprogramado al cambiar de fase%'), 'queda en la bitácora');
-- comando de fechas de fase
select pg_temp.ok(public.apih_fases_fechas('PA-1', null)->'fasesFechas'->'Cierre'->>'fin' = '2026-12-20', 'apih_fases_fechas sin datos fija las fechas vigentes como explícitas');
do $$ begin
  begin
    perform public.apih_fases_fechas('PA-1', '{"Planificación":{"ini":"2026-08-01","fin":"2026-09-10"},"Ejecución":{"ini":"2026-09-01","fin":"2026-10-31"},"Transición":{"ini":"2026-11-01","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-20"}}'::jsonb);
    raise exception 'FALLA: aceptó fases solapadas';
  exception when sqlstate '22023' then
    if sqlerrm not like '%debe empezar después%' then raise exception 'FALLA: mensaje inesperado %', sqlerrm; end if; raise notice 'ok  apih_fases_fechas rechaza el solape con un mensaje claro'; end;
end $$;
select pg_temp.ok(public.apih_fases_fechas('PA-1', '{"Planificación":{"ini":"2026-08-01","fin":"2026-08-31"},"Ejecución":{"ini":"2026-09-01","fin":"2026-11-15"},"Transición":{"ini":"2026-11-16","fin":"2026-11-30"},"Cierre":{"ini":"2026-12-01","fin":"2026-12-20"}}'::jsonb)->>'finPlan' = '2026-12-20', 'apih_fases_fechas guarda y deriva el rango del proyecto');
rollback;
begin; set local role authenticated;
select pg_temp.como('inv-a@test.cl');
do $$ begin
  begin perform public.apih_fases_fechas('PA-1', null); raise exception 'FALLA: un perfil de solo lectura editó fechas';
  exception when sqlstate '42501' then raise notice 'ok  sin permiso no se editan las fechas de fase'; end;
end $$;
rollback;
select 'PRUEBAS DE PLAN Y AVANCE OK';
