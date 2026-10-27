-- apih_aprobar_propuesta: efectos, permisos, compuertas y atomicidad.
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

delete from public.registros where lista = 'APIH_Config' and id = 'cfg';
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"metodo":{"fasesProp":["Recepción","Evaluación","Caso de Negocio","Aprobación"],"fasesPrj":["Planificación","Ejecución","Cierre"],"tipos":[{"id":"T1","nombre":"Desarrollo de software","hitos":[{"n":"Evaluación","fase":"Evaluación","dias":3},{"n":"Kick-off","fase":"Planificación","dias":7},{"n":"Cierre formal","fase":"Cierre","dias":100}]}]}}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"Prop uno","area":"A","tipo":"Propuesta","fase":"Aprobación","estado":"Vigente","sponsor":"S","lider":"L","presupuesto":1000,"bc":"bc","tipoIni":"Desarrollo de software","inicioPlan":"2026-11-01","finPlan":"2027-03-01","deps":[]}'),
 ('APIH_Propuestas','PROP-002','p1.{"id":"PROP-002","titulo":"Prop dos","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Vigente","sponsor":"","lider":"L","presupuesto":0,"bc":"","deps":[]}'),
 ('APIH_Propuestas','PROP-003','p1.{"id":"PROP-003","titulo":"Prop tres","area":"B","tipo":"Propuesta","fase":"Aprobación","estado":"Vigente","sponsor":"S","lider":"L","presupuesto":10,"bc":"bc","deps":[]}'),
 ('APIH_Propuestas','PROP-004','p1.{"id":"PROP-004","titulo":"Prop cuatro (rompe plantilla)","area":"A","tipo":"Propuesta","fase":"Aprobación","estado":"Vigente","sponsor":"S","lider":"L","presupuesto":10,"bc":"bc","tipoIni":"Desarrollo de software","inicioPlan":"no-es-fecha","deps":[]}'),
 ('APIH_Decisiones','DEC-1','p1.{"id":"DEC-1","ini":"PROP-001","tipo":"Iniciar","estado":"Aprobada"}'),
 ('APIH_Decisiones','DEC-3','p1.{"id":"DEC-3","ini":"PROP-003","tipo":"Iniciar","estado":"Aprobada"}'),
 ('APIH_Decisiones','DEC-4','p1.{"id":"DEC-4","ini":"PROP-004","tipo":"Iniciar","estado":"Aprobada"}'),
 ('APIH_Riesgos','RSK-1','p1.{"id":"RSK-1","ini":"PROP-001","desc":"r"}'),
 ('APIH_Hitos','HIT-900','p1.{"id":"HIT-900","ini":"PROP-001","nombre":"Evaluación","fase":"Evaluación","fecha":"2026-10-01","completado":false,"fechaReal":null}'),
 ('APIH_Proyectos','PRJ-050','p1.{"id":"PRJ-050","titulo":"Depende","area":"A","deps":["PROP-001","X"]}');

-- 1) sin permiso
begin; set local role authenticated;
select pg_temp.como('colab-b@test.cl');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-001')$$, 'colaborador de otra área no aprueba', '%sin permiso para aprobar%');
select pg_temp.como('inv-a@test.cl');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-001')$$, 'invitado no aprueba', '%sin permiso para aprobar%');
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-002')$$, 'compuertas incumplidas bloquean', '%compuertas incumplidas: Propuesta en fase Aprobación, Sponsor identificado%');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-002', 'x', true)$$, 'colaborador no puede forzar compuertas', '%compuertas incumplidas%');
select pg_temp.falla($$select public.apih_aprobar_propuesta('NO-EXISTE')$$, 'propuesta inexistente', '%no existe%');
rollback;
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Proyectos' and id like 'PRJ-%' and id <> 'PRJ-050') = 0, 'los intentos rechazados no crearon proyectos');

-- 2) atomicidad: la plantilla falla a mitad de camino (fecha inválida) y no queda nada
begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-004')$$, 'error en la plantilla aborta todo', '%date%');
rollback;
select pg_temp.ok((pg_temp.j('APIH_Propuestas','PROP-004') ->> 'estado') = 'Vigente' and not exists (select 1 from public.registros where lista='APIH_Proyectos' and id like 'PRJ-%' and id <> 'PRJ-050'), 'atomicidad: la propuesta sigue Vigente y no hay proyecto huérfano');

-- 3) aprobación correcta por un colaborador de su área (no ve montos)
begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select public.apih_aprobar_propuesta('PROP-001', ' ok ');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Propuestas','PROP-001') ->> 'estado' = 'Aprobada' and pg_temp.j('APIH_Propuestas','PROP-001') ->> 'proyecto' = 'PRJ-051', 'propuesta cerrada como Aprobada → PRJ-051 (sigue al máximo existente)');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-051') ->> 'fase' = 'Planificación' and pg_temp.j('APIH_Proyectos','PRJ-051') ->> 'propuestaOrigen' = 'PROP-001', 'proyecto creado en Planificación con su origen');
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-051') ->> 'presupuesto')::numeric = 1000, 'el presupuesto se conserva aunque quien aprueba no vea montos');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-051') ->> 'area' = 'A' and (select area from public.registros where id='PRJ-051') = 'A', 'área derivada');
select pg_temp.ok(pg_temp.j('APIH_Riesgos','RSK-1') ->> 'ini' = 'PRJ-051', 'el riesgo pasa al proyecto');
select pg_temp.ok(pg_temp.j('APIH_Hitos','HIT-900') ->> 'ini' = 'PRJ-051' and (pg_temp.j('APIH_Hitos','HIT-900') ->> 'completado')::boolean, 'hito de etapa superada queda completado y pasa al proyecto');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Hitos' and substr(datos,4)::jsonb ->> 'ini' = 'PRJ-051') = 3, 'plantilla: Kick-off y Cierre formal creados (Evaluación no se duplica ni crea hitos de otra fase)');
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'fecha' from public.registros where lista='APIH_Hitos' and substr(datos,4)::jsonb ->> 'nombre' = 'Kick-off') = '2026-11-08', 'fecha de plantilla = inicioPlan + días');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-050') -> 'deps' = '["PRJ-051","X"]'::jsonb, 'las dependencias apuntan al proyecto');
select pg_temp.ok(pg_temp.j('APIH_Config','seq') ->> 'PRJ' = '51', 'contador PRJ actualizado');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Bitacora') = 2 and not exists (select 1 from public.registros where lista='APIH_Bitacora' and substr(datos,4)::jsonb ->> 'id' <> id), 'bitácora: 2 entradas con id coherente');
select pg_temp.ok((pg_temp.j('APIH_Propuestas','PROP-001') ->> 'estadoMotivo') = 'ok', 'nota de aprobación sin espacios');
rollback;

-- 4) doble aprobación
begin;
set local role authenticated; select pg_temp.como('colab-a@test.cl');
select public.apih_aprobar_propuesta('PROP-001');
select pg_temp.falla($$select public.apih_aprobar_propuesta('PROP-001')$$, 'no se aprueba dos veces', '%no está Vigente%');
rollback;

-- 5) el admin sí puede forzar; el colaborador no ve montos del proyecto creado
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select public.apih_aprobar_propuesta('PROP-002', 'urgente', true);
reset role;
select pg_temp.ok((pg_temp.j('APIH_Propuestas','PROP-002') ->> 'estadoMotivo') like '[forzado: %] urgente', 'admin fuerza con registro de las compuertas incumplidas');
select pg_temp.ok((select count(*) from public.auditoria where accion='insert' and lista='APIH_Proyectos' and email='tolosa-christian@aramark.cl') >= 1, 'auditoría del alta');
rollback;
\echo PRUEBAS DE APROBAR PROPUESTA OK
