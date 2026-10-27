-- Ciclo de vida V23: contratos compartidos con la app (avance calculado y compuertas de transición), apih_transicion,
-- puerta lateral cerrada, rango del plan, autocompletado.
\set ON_ERROR_STOP on
\set cav `cat tests/contract/avance_calc.json`
\set cgt `cat tests/contract/gates_transicion.json`
create temp table cc as select :'cav'::jsonb as av, :'cgt'::jsonb as gt;
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(sql text, m text, patron text default null) returns void language plpgsql as
$$ declare e boolean := false; msg text; begin begin execute sql; exception when others then e := true; msg := sqlerrm; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if;
   if patron is not null and msg not like patron then raise exception 'FALLA (se rechazó por otra causa): % -> %', m, msg; end if;
   raise notice 'ok  % (rechazado)', m; end $$;
create or replace function pg_temp.filas(q text) returns int language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
create or replace function pg_temp.j(p_lista text, p_id text) returns jsonb language sql as
$$ select substr(datos, 4)::jsonb from public.registros where lista = p_lista and id = p_id $$;

delete from public.registros where lista in ('APIH_Config','APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Cambios') and id <> 'seq';
delete from public.registros where lista = 'APIH_Config';
insert into public.perfiles (email, rol, app_rol, areas, ve_montos) values
  ('cv-ed@test.cl','editor','Colaborador','{"A"}', false), ('cv-otro@test.cl','editor','Colaborador','{"B"}', false), ('cv-lec@test.cl','lector','Invitado','{"A"}', false)
  on conflict do nothing;

-- ===== 1) contrato: avance calculado =====
do $t$
declare c jsonb; h jsonb; k int; n int := 0; id text; got int;
begin
  for c in select * from jsonb_array_elements((select av from cc)) loop
    n := n + 1; id := 'CAV' || (n - 1);
    insert into public.registros(lista, id, datos) values ('APIH_Proyectos', id, 'p1.' || (jsonb_build_object('id', id, 'titulo', 't', 'area', 'A', 'tipo', 'Proyecto', 'estado', 'En curso') || (c -> 'proy'))::text);
    k := 0;
    for h in select * from jsonb_array_elements(c -> 'hitos') loop
      k := k + 1;
      insert into public.registros(lista, id, datos) values ('APIH_Hitos', id || '-H' || k, 'p1.' || (jsonb_build_object('id', id || '-H' || k, 'ini', id, 'nombre', 'h' || k) || h)::text);
    end loop;
    got := public.apih_avance_calc(pg_temp.j('APIH_Proyectos', id), id);
    if got <> (c ->> 'avance')::int then raise exception 'FALLA contrato avance «%»: servidor % ≠ esperado %', c ->> 'nombre', got, c ->> 'avance'; end if;
  end loop;
  raise notice 'ok  contrato de avance calculado: % casos coinciden en el servidor', n;
end $t$;

-- ===== 2) contrato: compuertas de transición =====
do $t$
declare c jsonb; h jsonb; r jsonb; k int; n int := 0; id text; lst text; got text[]; want text[];
begin
  for c in select * from jsonb_array_elements((select gt from cc)) loop
    n := n + 1; id := 'CGT' || (n - 1); lst := case when c -> 'ini' ->> 'tipo' = 'Propuesta' then 'APIH_Propuestas' else 'APIH_Proyectos' end;
    insert into public.registros(lista, id, datos) values (lst, id, 'p1.' || (jsonb_build_object('id', id, 'titulo', 't', 'area', 'A') || (c -> 'ini'))::text);
    k := 0;
    for h in select * from jsonb_array_elements(c -> 'hitos') loop
      k := k + 1;
      insert into public.registros(lista, id, datos) values ('APIH_Hitos', id || '-H' || k, 'p1.' || (jsonb_build_object('id', id || '-H' || k, 'ini', id, 'nombre', 'h' || k) || h)::text);
    end loop;
    k := 0;
    for r in select * from jsonb_array_elements(c -> 'riesgos') loop
      k := k + 1;
      insert into public.registros(lista, id, datos) values ('APIH_Riesgos', id || '-R' || k, 'p1.' || (jsonb_build_object('id', id || '-R' || k, 'ini', id, 'desc', 'r') || r)::text);
    end loop;
    got := public.apih_faltan_transicion(id, c ->> 'hasta');
    select coalesce(array_agg(x), '{}') into want from jsonb_array_elements_text(c -> 'faltan') x;
    if got is distinct from want then raise exception 'FALLA contrato transición «%»: servidor % ≠ esperado %', c ->> 'nombre', got, want; end if;
  end loop;
  raise notice 'ok  contrato de compuertas de transición: % casos coinciden en el servidor', n;
end $t$;

-- ===== 3) apih_transicion =====
insert into public.registros(lista, id, datos) values
 ('APIH_Proyectos','TR-1','p1.{"id":"TR-1","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Planificación","estado":"En curso","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}'),
 ('APIH_Proyectos','TR-2','p1.{"id":"TR-2","titulo":"Dos","area":"A","tipo":"Proyecto","fase":"Planificación","estado":"En curso","sponsor":"S","lider":"","presupuesto":0,"categoria":"Tecnología"}'),
 ('APIH_Proyectos','TR-3','p1.{"id":"TR-3","titulo":"Tres","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"En curso","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}'),
 ('APIH_Hitos','TR-1-H1','p1.{"id":"TR-1-H1","ini":"TR-1","nombre":"a","fase":"Planificación","fecha":"2100-01-01","completado":true}'),
 ('APIH_Hitos','TR-1-H2','p1.{"id":"TR-1-H2","ini":"TR-1","nombre":"b","fase":"Planificación","fecha":"2100-01-01","completado":true}'),
 ('APIH_Hitos','TR-3-H1','p1.{"id":"TR-3-H1","ini":"TR-3","nombre":"a","fase":"Cierre","fecha":"2100-01-01","completado":false}');

begin; set local role authenticated;
select pg_temp.como('cv-otro@test.cl');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Ejecución')$$, 'otra área no cambia de fase', '%sin permiso%');
select pg_temp.como('cv-lec@test.cl');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Ejecución')$$, 'invitado no cambia de fase', '%sin permiso%');
select pg_temp.como('cv-ed@test.cl');
select pg_temp.falla($$select public.apih_transicion('TR-1')$$, 'hay que indicar fase o estado', '%fase o el estado%');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Ejecución', 'Pausado')$$, 'no ambos a la vez', '%fase o el estado%');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Inventada')$$, 'fase inválida', '%fase inválida%');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Planificación')$$, 'misma fase', '%ya está en la fase%');
select pg_temp.falla($$select public.apih_transicion('TR-2', 'Ejecución')$$, 'compuertas bloquean', '%compuertas incumplidas: Fechas plan definidas%');
select pg_temp.falla($$select public.apih_transicion('TR-2', 'Ejecución', null, '', null, true, 'x')$$, 'un editor no fuerza', '%compuertas incumplidas%');
select pg_temp.falla($$select public.apih_transicion('TR-1', null, 'Pausado')$$, 'pausar exige motivo', '%motivo%');
select pg_temp.falla($$select public.apih_transicion('TR-1', null, 'Pausado', 'x')$$, 'pausar exige fecha de revisión', '%fecha de revisión%');
select pg_temp.falla($$select public.apih_transicion('TR-1', null, 'Completado')$$, 'solo se completa desde la última fase', '%última fase%');
select pg_temp.falla($$select public.apih_transicion('TR-3', null, 'Completado')$$, 'completar exige las compuertas de cierre', '%Avance al 100%');
select pg_temp.falla($$select public.apih_transicion('TR-1', null, 'Aprobada')$$, 'aprobar no es un estado de proyecto', '%');
select public.apih_transicion('TR-1', 'Ejecución');
rollback;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','TR-1') ->> 'fase' = 'Planificación', 'los intentos rechazados y el rollback no cambiaron nada');

begin; set local role authenticated;
select pg_temp.como('cv-ed@test.cl');
select pg_temp.ok((public.apih_transicion('TR-1', 'Ejecución') ->> 'fase') = 'Ejecución', 'editor del área avanza de fase con compuertas OK');
select pg_temp.ok((public.apih_transicion('TR-1', null, 'Pausado', 'espera proveedor', current_date + 10) ->> 'estado') = 'Pausado', 'pausa con motivo y fecha de revisión');
select pg_temp.ok((public.apih_transicion('TR-1', null, 'En curso') ->> 'estado') = 'En curso', 'reactiva sin motivo');
select pg_temp.ok((public.apih_transicion('TR-1', null, 'Stand By', 'congelado') ->> 'estado') = 'Stand By', 'Stand By con motivo');
select pg_temp.falla($$select public.apih_transicion('TR-1', 'Transición')$$, 'en Stand By no cambia de fase', '%Stand By%');
select pg_temp.ok((public.apih_transicion('TR-1', null, 'En curso') ->> 'estado') = 'En curso', 'reactiva desde Stand By');
select pg_temp.ok((public.apih_transicion('TR-1', 'Planificación') ->> 'fase') = 'Planificación', 'volver a una fase anterior no tiene compuertas');
rollback;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.falla($$select public.apih_transicion('TR-2', 'Ejecución', null, '', null, true, '')$$, 'forzar exige motivo', '%motivo del cambio forzado%');
select pg_temp.ok((public.apih_transicion('TR-2', 'Ejecución', null, '', null, true, 'autorizado por comité') ->> 'fase') = 'Ejecución', 'admin fuerza con motivo');
rollback;

-- completar el último hito de Cierre cierra el proyecto (autocompletado)
begin; set local role authenticated;
select pg_temp.como('cv-ed@test.cl');
select public.apih_hito_estado('TR-3-H1', true);
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','TR-3') ->> 'estado' = 'Completado' and (pg_temp.j('APIH_Proyectos','TR-3') ->> 'avance')::int = 100, 'al completar el último hito de Cierre el proyecto queda Completado al 100 %');
select pg_temp.falla($$select public.apih_transicion('TR-3', null, 'En curso')$$, 'un estado final no cambia desde la transición', '%estado final%');
rollback;

-- ===== 4) puerta lateral: escribir fase/estado directo =====
begin; set local role authenticated;
select pg_temp.como('cv-ed@test.cl');
select pg_temp.falla($$update public.registros set datos = 'p1.{"id":"TR-1","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"En curso","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}' where lista='APIH_Proyectos' and id='TR-1'$$, 'editor no cambia la fase por la API directa', '%solo cambia con%');
select pg_temp.falla($$update public.registros set datos = 'p1.{"id":"TR-1","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Planificación","estado":"Completado","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}' where lista='APIH_Proyectos' and id='TR-1'$$, 'editor no cambia el estado por la API directa', '%solo cambia con%');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos = 'p1.{"id":"TR-1","titulo":"Renombrado","area":"A","tipo":"Proyecto","fase":"Planificación","estado":"En curso","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}' where lista='APIH_Proyectos' and id='TR-1'$$) = 1, 'editor sí edita otros campos');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','TR-N1','p1.{"id":"TR-N1","titulo":"x","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"En curso"}')$$, 'un proyecto nuevo no nace en otra fase', '%empieza en la fase%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','TR-N2','p1.{"id":"TR-N2","titulo":"x","area":"A","tipo":"Proyecto","estado":"Completado"}')$$, 'un proyecto nuevo no nace completado', '%estado inicial%');
select pg_temp.ok(pg_temp.filas($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','TR-N3','p1.{"id":"TR-N3","titulo":"x","area":"A","tipo":"Proyecto","fase":"Planificación","estado":"En curso"}')$$) = 1, 'un proyecto nuevo en la primera fase y estado inicial sí se crea');
rollback;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos = 'p1.{"id":"TR-1","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"En curso","sponsor":"S","lider":"L","presupuesto":100,"inicioPlan":"2026-01-01","finPlan":"2026-12-31","categoria":"Tecnología"}' where lista='APIH_Proyectos' and id='TR-1'$$) = 1, 'admin conserva la puerta (reparaciones)');
rollback;

-- ===== 5) rango del plan =====
select pg_temp.ok(public.apih_distribuir_fases('2026-01-01', '2026-04-10', array['Planificación','Ejecución','Transición','Cierre']) =
  '{"Planificación":{"ini":"2026-01-01","fin":"2026-01-15"},"Ejecución":{"ini":"2026-01-16","fin":"2026-03-11"},"Transición":{"ini":"2026-03-12","fin":"2026-03-26"},"Cierre":{"ini":"2026-03-27","fin":"2026-04-10"}}'::jsonb, 'reparto 15/55/15/15 de un rango de 100 días');
select pg_temp.ok(public.apih_distribuir_fases('2026-02-01', '2026-01-01', array['A','B']) is null, 'rango invertido no se reparte');
select pg_temp.ok((public.apih_set_rango_plan('{"tipo":"Proyecto"}'::jsonb, '2026-01-01', '2026-04-10', array['Planificación','Ejecución','Transición','Cierre']) ->> 'finPlan') = '2026-04-10', 'set_rango_plan deriva finPlan de las fases');
select pg_temp.ok((public.apih_mover_fin_plan(public.apih_set_rango_plan('{"tipo":"Proyecto"}'::jsonb, '2026-01-01', '2026-04-10', array['Planificación','Ejecución','Transición','Cierre']), '2026-05-10', array['Planificación','Ejecución','Transición','Cierre']) #>> '{fasesFechas,Cierre,fin}') = '2026-05-10', 'mover_fin_plan alarga la última fase');
\echo PRUEBAS DE CICLO DE VIDA OK
