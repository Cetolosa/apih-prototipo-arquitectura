-- Iter 5c · iniciativa por comando: normalización, validación con campo, plantilla, bitácora y eliminación sin huérfanos
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(sql text, m text, patron text default null, campo text default null) returns void language plpgsql as
$$ declare e boolean := false; msg text; h text; begin begin execute sql; exception when others then e := true; msg := sqlerrm; get stacked diagnostics h = pg_exception_hint; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if;
   if patron is not null and msg not like patron then raise exception 'FALLA (se rechazó por otra causa): % -> %', m, msg; end if;
   if campo is not null and coalesce(h, '') <> campo then raise exception 'FALLA (campo %, se esperaba %): %', h, campo, m; end if;
   raise notice 'ok  % (rechazado)', m; end $$;
create or replace function pg_temp.j(p_lista text, p_id text) returns jsonb language sql as
$$ select substr(datos, 4)::jsonb from public.registros_v where lista = p_lista and id = p_id $$;

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Decisiones','APIH_Hitos','APIH_Bitacora','APIH_Riesgos','APIH_Comites','APIH_Compromisos');
delete from public.registros where lista = 'APIH_Config' and id in ('cfg','seq');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","metodo":{"fasesProp":["Recepción","Evaluación","Caso de Negocio","Aprobación"],"fasesPrj":["Planificación","Ejecución","Cierre"],"tipos":[{"nombre":"Software","hitos":[{"n":"Kickoff","fase":"Planificación","dias":0},{"n":"Pase a producción","fase":"Ejecución","dias":60},{"n":"Idea","fase":"Recepción","dias":3}]}]}}'),
 ('APIH_Proyectos','PRJ-010','p1.{"id":"PRJ-010","titulo":"Base","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"L","deps":[]}'),
 ('APIH_Proyectos','PRJ-005','p1.{"id":"PRJ-005","titulo":"Otra área","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"L","deps":[]}'),
 ('APIH_Comites','COM-001','p1.{"id":"COM-001","nombre":"C1","fecha":"2026-11-05","decisiones":[]}');
insert into public.perfiles (email, rol, app_rol, areas) values ('colab-a@test.cl','editor','Colaborador','{"A"}') on conflict do nothing;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"","lider":"L","areaArr":["A"],"motivoAlta":"m"}')$$, 'sin título', '%título%', 'titulo');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["A"]}')$$, 'alta directa sin motivo', '%motivo%', 'motivoAlta');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["B"],"motivoAlta":"m"}')$$, 'área ajena', '%sin permiso%');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["A"],"motivoAlta":"m","presupuesto":-5}')$$, 'monto negativo', '%no negativos%', 'presupuesto');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["A"],"motivoAlta":"m","avanceManual":150}')$$, 'avance manual > 100', '%0 y 100%', 'avanceManual');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["A"],"motivoAlta":"m","inicioPlan":"2026-12-01","finPlan":"2026-11-01"}')$$, 'fin antes del inicio', '%anterior al inicio%', 'finPlan');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"X","lider":"L","areaArr":["A"],"motivoAlta":"m","fase":"Cierre","estado":"Completado","campoInventado":1}')$$, 'campo fuera del catálogo', '%campo desconocido%');
select pg_temp.ok((public.apih_guardar_iniciativa(null, 'Proyecto', '{"titulo":"Nuevo","lider":"L","areaArr":["A"],"motivoAlta":"Urgencia","tipoIni":"Software","inicioPlan":"2026-11-02","finPlan":"2027-02-26","presupuesto":"120","fase":"Cierre","estado":"Completado"}') ->> 'hitosPlantilla')::int = 2, 'alta con plantilla: solo hitos de fases de proyecto');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-011') ->> 'fase' = 'Planificación' and pg_temp.j('APIH_Proyectos','PRJ-011') ->> 'estado' = 'En curso', 'id del servidor y fase/estado iniciales (el formulario no los fija)');
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-011') ->> 'presupuesto') is null or (pg_temp.j('APIH_Proyectos','PRJ-011') ->> 'presupuesto')::numeric = 120, 'monto normalizado a número (o oculto a quien no ve montos)');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Hitos' and substr(datos, 4)::jsonb ->> 'ini' = 'PRJ-011' and substr(datos, 4)::jsonb ->> 'nombre' = 'Pase a producción' and substr(datos, 4)::jsonb ->> 'fecha' = '2027-01-01'), 'fecha del hito de plantilla = inicio + días');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' like '[2 hitos precargados%Proyecto creado directamente: Nuevo — Urgencia'), 'bitácora del alta');
select pg_temp.ok((public.apih_guardar_iniciativa(null, 'Propuesta', '{"titulo":"Prop","lider":"L","areaArr":["A"],"sE":4,"sV":5,"sF":2,"sR":1}') ->> 'id') = 'PROP-001', 'alta de propuesta');
select pg_temp.ok(pg_temp.j('APIH_Propuestas','PROP-001') -> 'score' = '{"estrategia":4,"valor":5,"esfuerzo":2,"riesgo":1}'::jsonb and pg_temp.j('APIH_Propuestas','PROP-001') ->> 'finEst' is null, 'puntaje armado por el servidor; propuesta sin fin estimado');
select pg_temp.falla($$select public.apih_guardar_iniciativa(null, 'Propuesta', '{"titulo":"P","lider":"L","areaArr":["A"],"sE":9,"sV":1,"sF":1,"sR":1}')$$, 'puntaje fuera de 1..5', '%1 a 5%', 'sE');
-- edición: dependencias y ciclos; bitácora con diferencias
select public.apih_guardar_iniciativa('PRJ-011', null, '{"deps":["PRJ-010"],"prioridad":"Alta"}');
select pg_temp.falla($$select public.apih_guardar_iniciativa('PRJ-010', null, '{"deps":["PRJ-011"]}')$$, 'dependencia circular', '%ciclo%', 'deps');
select pg_temp.falla($$select public.apih_guardar_iniciativa('PRJ-010', null, '{"deps":["PRJ-010"]}')$$, 'depender de sí misma', '%no existe o es la misma%', 'deps');
select pg_temp.falla($$select public.apih_guardar_iniciativa('PRJ-011', null, '{"estado":"Completado"}')$$, 'el formulario no cambia el estado (se ignora y no hay error)', null) where false;
select public.apih_guardar_iniciativa('PRJ-011', null, '{"estado":"Completado","fase":"Cierre"}');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-011') ->> 'estado' = 'En curso', 'estado y fase solo con «Cambiar etapa»');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Actualizada: Prioridad: Media → Alta'), 'bitácora con lo que cambió');
-- eliminar con sus registros, sin huérfanos
select public.apih_guardar_decision(null, '{"ini":"PRJ-010","tipo":"Mantener","titulo":"¿Seguir?","limite":"2026-11-10","comite":"COM-001"}');
select public.apih_guardar_riesgo(null, '{"ini":"PRJ-010","desc":"r","prob":1,"imp":1}');
select pg_temp.ok((public.apih_eliminar_iniciativa('PRJ-010') ->> 'registros')::int = 2, 'eliminar borra sus registros asociados');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') -> 'decisiones' = '[]'::jsonb and pg_temp.j('APIH_Proyectos','PRJ-011') -> 'deps' = '[]'::jsonb, 'sin huérfanos: comité y dependencias limpias');
select pg_temp.falla($$select public.apih_eliminar_iniciativa('PRJ-005')$$, 'no elimina iniciativas de otra área', '%sin permiso%');
commit;
