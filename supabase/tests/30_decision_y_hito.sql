-- apih_resolver_decision y apih_hito_estado: efectos, permisos y atomicidad.
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(sql text, m text, patron text default null) returns void language plpgsql as
$$ declare e boolean := false; msg text; begin begin execute sql; exception when others then e := true; msg := sqlerrm; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if;
   if patron is not null and msg not like patron then raise exception 'FALLA (se rechazó por otra causa): % -> %', m, msg; end if;
   raise notice 'ok  % (rechazado)', m; end $$;
create or replace function pg_temp.j(p_lista text, p_id text) returns jsonb language sql as
$$ select substr(datos, 4)::jsonb from public.registros where lista = p_lista and id = p_id $$;

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Decisiones','APIH_Hitos','APIH_Bitacora','APIH_Riesgos');
delete from public.registros where lista = 'APIH_Config' and id in ('cfg','seq');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"metodo":{"fasesProp":["Recepción","Evaluación","Caso de Negocio","Aprobación"],"fasesPrj":["Planificación","Ejecución","Cierre"],"tipos":[]}}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"P1","area":"A","tipo":"Propuesta","fase":"Aprobación","estado":"Vigente","sponsor":"S","lider":"L","presupuesto":1000,"bc":"bc","deps":[]}'),
 ('APIH_Propuestas','PROP-002','p1.{"id":"PROP-002","titulo":"P2 incompleta","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Vigente","sponsor":"","lider":"L","presupuesto":0,"bc":"","deps":[]}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Pr1","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"Pausado","prioridad":"Media","presupuesto":500}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Pr2","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","prioridad":"Media"}'),
 ('APIH_Proyectos','PRJ-003','p1.{"id":"PRJ-003","titulo":"Pr3 cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado"}'),
 ('APIH_Proyectos','PRJ-004','p1.{"id":"PRJ-004","titulo":"Pr4 otra área","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso"}'),
 ('APIH_Decisiones','DEC-1','p1.{"id":"DEC-1","ini":"PROP-001","tipo":"Iniciar","estado":"Pendiente","titulo":"Iniciar P1","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-2','p1.{"id":"DEC-2","ini":"PROP-002","tipo":"Iniciar","estado":"Pendiente","titulo":"Iniciar P2","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-3','p1.{"id":"DEC-3","ini":"PRJ-001","tipo":"Acelerar","estado":"Pendiente","titulo":"Acelerar","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-4','p1.{"id":"DEC-4","ini":"PRJ-002","tipo":"Pausar","estado":"Pendiente","titulo":"Pausar","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-5','p1.{"id":"DEC-5","ini":"PRJ-002","tipo":"Cancelar","estado":"Pendiente","titulo":"Cancelar","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-6','p1.{"id":"DEC-6","ini":"PRJ-003","tipo":"Cancelar","estado":"Pendiente","titulo":"Cancelar cerrado","limite":"2026-12-01"}'),
 ('APIH_Decisiones','DEC-7','p1.{"id":"DEC-7","ini":"PRJ-004","tipo":"Mantener","estado":"Pendiente","titulo":"Otra área","limite":"2026-12-01"}'),
 ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-002","nombre":"Hito uno","fase":"Ejecución","fecha":"2026-11-01","completado":false,"fechaReal":null}'),
 ('APIH_Hitos','HIT-4','p1.{"id":"HIT-4","ini":"PRJ-004","nombre":"Hito otra área","fase":"Ejecución","fecha":"2026-11-01","completado":false,"fechaReal":null}');
insert into public.perfiles (email, rol, app_rol, areas, gobierna) values ('resp-ga@test.cl','editor','Responsable','{"A"}', true) on conflict do nothing;

-- permisos
begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_resolver_decision('DEC-3','Aprobada')$$, 'colaborador sin gobierno no resuelve decisiones', '%resuelven decisiones%');
select pg_temp.como('resp-ga@test.cl');
select pg_temp.falla($$select public.apih_resolver_decision('DEC-7','Aprobada')$$, 'responsable no resuelve decisiones de otra área', '%sin permiso sobre el área%');
select pg_temp.falla($$select public.apih_resolver_decision('DEC-3','Quizás')$$, 'resultado inválido', '%resultado inválido%');
select pg_temp.falla($$select public.apih_resolver_decision('NO','Aprobada')$$, 'decisión inexistente', '%no existe%');
rollback;

-- Acelerar: prioridad Alta y reactiva el proyecto pausado
begin; set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select pg_temp.ok((public.apih_resolver_decision('DEC-3','Aprobada','ok')) ->> 'aplicada' = 'true', 'acelerar: efecto aplicado');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'prioridad' = 'Alta' and pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'estado' = 'En curso', 'acelerar: prioridad Alta y vuelve a En curso');
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'presupuesto')::numeric = 500, 'acelerar: no pierde montos');
select pg_temp.ok(pg_temp.j('APIH_Decisiones','DEC-3') ->> 'estado' = 'Aprobada' and (pg_temp.j('APIH_Decisiones','DEC-3') ->> 'aplicada')::boolean, 'decisión resuelta y marcada aplicada');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Bitacora') = 1, 'bitácora de la decisión');
rollback;

-- Pausar / Cancelar / ya cerrado / sin aplicar
begin; set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select public.apih_resolver_decision('DEC-4','Aprobada','por presupuesto');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-002') ->> 'estado' = 'Pausado' and pg_temp.j('APIH_Proyectos','PRJ-002') ->> 'estadoMotivo' = 'por presupuesto' and pg_temp.j('APIH_Proyectos','PRJ-002') ->> 'estadoRev' is not null, 'pausar: Pausado con motivo y revisión');
set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select public.apih_resolver_decision('DEC-5','Aprobada','',null,false);
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-002') ->> 'estado' = 'Pausado' and not (pg_temp.j('APIH_Decisiones','DEC-5') ->> 'aplicada')::boolean, 'sin «aplicar»: se resuelve pero no cambia el proyecto');
set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select pg_temp.ok((public.apih_resolver_decision('DEC-6','Aprobada')) ->> 'aviso' like '%ya está cerrado%', 'cancelar un proyecto cerrado: aviso y sin efecto');
rollback;

-- Diferir
begin; set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select public.apih_resolver_decision('DEC-4','Diferida','más datos');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Decisiones','DEC-4') ->> 'estado' = 'Pendiente' and (pg_temp.j('APIH_Decisiones','DEC-4') ->> 'limite')::date > '2026-12-01', 'diferir: sigue Pendiente con nueva fecha límite');
rollback;

-- Iniciar: crea el proyecto si las compuertas pasan; si no, resuelve sin efecto
begin; set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select pg_temp.ok((public.apih_resolver_decision('DEC-1','Aprobada','go')) ->> 'proyecto' = 'PRJ-005', 'iniciar: crea PRJ-005');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Propuestas','PROP-001') ->> 'estado' = 'Aprobada' and pg_temp.j('APIH_Proyectos','PRJ-005') ->> 'propuestaOrigen' = 'PROP-001', 'iniciar: propuesta aprobada y proyecto con origen');
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-005') ->> 'presupuesto')::numeric = 1000, 'iniciar: conserva el presupuesto');
set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select pg_temp.ok((public.apih_resolver_decision('DEC-2','Aprobada')) ->> 'aviso' like 'No se crea el proyecto%', 'iniciar con compuertas incumplidas: aviso');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Propuestas','PROP-002') ->> 'estado' = 'Vigente' and pg_temp.j('APIH_Decisiones','DEC-2') ->> 'estado' = 'Aprobada' and not (pg_temp.j('APIH_Decisiones','DEC-2') ->> 'aplicada')::boolean, 'la propuesta sigue Vigente y la decisión queda resuelta sin efecto');
set local role authenticated; select pg_temp.como('resp-ga@test.cl');
select pg_temp.falla($$select public.apih_resolver_decision('DEC-1','Aprobada')$$, 'no se resuelve dos veces', '%no está Pendiente%');
rollback;

-- Hitos
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select public.apih_hito_estado('HIT-1', true);
select pg_temp.falla($$select public.apih_hito_estado('HIT-4', true)$$, 'colaborador no toca hitos de otra área', '%sin permiso%');
reset role;
select pg_temp.ok((pg_temp.j('APIH_Hitos','HIT-1') ->> 'completado')::boolean and pg_temp.j('APIH_Hitos','HIT-1') ->> 'fechaReal' is not null, 'hito completado con fecha real');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-002') ->> 'actualizada' is not null, 'el proyecto queda actualizado');
set local role authenticated; select pg_temp.como('colab-a@test.cl');
select public.apih_hito_estado('HIT-1', false);
reset role;
select pg_temp.ok(not (pg_temp.j('APIH_Hitos','HIT-1') ->> 'completado')::boolean and pg_temp.j('APIH_Hitos','HIT-1') -> 'fechaReal' = 'null'::jsonb, 'hito reabierto sin fecha real');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Bitacora') = 2, 'bitácora de completar y reabrir');
set local role authenticated; select pg_temp.como('inv-a@test.cl');
select pg_temp.falla($$select public.apih_hito_estado('HIT-1', true)$$, 'invitado no completa hitos', '%sin permiso%');
rollback;
\echo PRUEBAS DE DECISION Y HITO OK
