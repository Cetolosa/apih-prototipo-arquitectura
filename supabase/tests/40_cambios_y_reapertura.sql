-- apih_solicitar_cambio, apih_resolver_cambio y apih_reabrir: reglas, permisos, montos y atomicidad.
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

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Cambios','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id = 'seq';
insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_montos) values
  ('adm@test.cl','Admin Test','admin','Administra','{}', true),
  ('spons-a@test.cl','Sara Sponsor','editor','Colaborador','{"A"}', false)
  on conflict do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Pr1","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","sponsor":"Sara Sponsor","inicioPlan":"2026-01-10","finPlan":"2026-12-31","finEst":"2026-12-31","presupuesto":500}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Pr2 otra área","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","finPlan":"2026-12-31"}'),
 ('APIH_Proyectos','PRJ-003','p1.{"id":"PRJ-003","titulo":"Pr3 cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado","finReal":"2026-09-01"}'),
 ('APIH_Proyectos','PRJ-004','p1.{"id":"PRJ-004","titulo":"Pr4 cancelado","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"Cancelado","estadoMotivo":"x"}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"Pp1","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Rechazada","estadoMotivo":"no"}'),
 ('APIH_Propuestas','PROP-002','p1.{"id":"PROP-002","titulo":"Pp2","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Vigente"}');

-- solicitar: permisos y validaciones
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-002','Fecha','d','m','', '2027-01-31')$$, 'no solicita en otra área', '%sin permiso sobre el área%');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Fecha','','m','', '2027-01-31')$$, 'exige descripción', '%qué cambia%');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Magia','d','m','', '2027-01-31')$$, 'tipo inválido', '%tipo de cambio inválido%');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Fecha','d','m','', '2026-12-31')$$, 'fecha igual a la actual', '%igual a la actual%');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Fecha','d','m','', '2025-01-01')$$, 'fecha anterior al inicio plan', '%anterior al inicio%');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Presupuesto','d','m','', null, 900)$$, 'sin permiso de montos no propone montos', '%proponer montos%');
select pg_temp.falla($$select public.apih_solicitar_cambio('NO','Fecha','d','m','', '2027-01-31')$$, 'iniciativa inexistente', '%no existe%');
rollback;
begin; set local role authenticated; select pg_temp.como('inv-a@test.cl');
select pg_temp.falla($$select public.apih_solicitar_cambio('PRJ-001','Fecha','d','m','', '2027-01-31')$$, 'invitado no solicita', '%sin permiso%');
rollback;

-- ciclo: solicitar (línea base capturada) y aprobar por el sponsor
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((public.apih_solicitar_cambio('PRJ-001','Fecha','Mover cierre','Proveedor','', '2027-02-28')) ->> 'id' = 'CHG-001', 'solicitud: id CHG-001');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Cambios','CHG-001') ->> 'fAnt' = '2026-12-31' and pg_temp.j('APIH_Cambios','CHG-001') ->> 'estado' = 'Solicitado', 'línea base capturada en el servidor');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Bitacora') = 1, 'bitácora de la solicitud');
set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_resolver_cambio('CHG-001','Aprobado','')$$, 'colaborador que no es sponsor no resuelve', '%resuelven cambios%');
select pg_temp.como('spons-a@test.cl');
select pg_temp.falla($$select public.apih_resolver_cambio('CHG-001','Rechazado','')$$, 'rechazo exige motivo', '%motivo del rechazo%');
select pg_temp.falla($$select public.apih_resolver_cambio('CHG-001','Quizás','x')$$, 'resultado inválido', '%resultado inválido%');
select pg_temp.ok((public.apih_resolver_cambio('CHG-001','Aprobado','ok')) ->> 'aplicado' = 'true', 'el sponsor aprueba');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'finPlan' = '2027-02-28' and pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'finEst' = '2027-02-28', 'se aplica a la línea base (fin plan y estimado)');
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'presupuesto')::numeric = 500, 'no pierde montos');
select pg_temp.ok(pg_temp.j('APIH_Cambios','CHG-001') ->> 'estado' = 'Aprobado' and pg_temp.j('APIH_Cambios','CHG-001') ->> 'aprobador' = 'Sara Sponsor' and pg_temp.j('APIH_Cambios','CHG-001') ->> 'fDec' is not null, 'cambio resuelto con aprobador y fecha');
set local role authenticated; select pg_temp.como('spons-a@test.cl');
select pg_temp.falla($$select public.apih_resolver_cambio('CHG-001','Aprobado','')$$, 'no se resuelve dos veces', '%ya fue resuelto%');
rollback;

-- rechazo no toca la línea base; montos exigen permiso de montos
begin; set local role authenticated; select pg_temp.como('colab-m@test.cl');
select public.apih_solicitar_cambio('PRJ-001','Presupuesto','Más plata','Alcance','', null, 900);
reset role;
select pg_temp.ok((pg_temp.j('APIH_Cambios','CHG-001') ->> 'pAnt')::numeric = 500 and (pg_temp.j('APIH_Cambios','CHG-001') ->> 'pNue')::numeric = 900, 'quien ve montos propone presupuesto');
set local role authenticated; select pg_temp.como('spons-a@test.cl');
select pg_temp.falla($$select public.apih_resolver_cambio('CHG-001','Aprobado','')$$, 'sponsor sin montos no aprueba cambio de presupuesto', '%permiso de montos%');
select public.apih_resolver_cambio('CHG-001','Rechazado','sin caja');
reset role;
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'presupuesto')::numeric = 500 and pg_temp.j('APIH_Cambios','CHG-001') ->> 'estado' = 'Rechazado', 'rechazar no cambia la línea base');
set local role authenticated; select pg_temp.como('colab-m@test.cl');
select public.apih_solicitar_cambio('PRJ-001','Presupuesto','Otra','m','', null, 800);
select pg_temp.como('adm@test.cl');
select public.apih_resolver_cambio('CHG-002','Aprobado','');
reset role;
select pg_temp.ok((pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'presupuesto')::numeric = 800, 'Administra aprueba y el presupuesto se actualiza');
rollback;

-- redacción: quien no ve montos no ve pNue/pAnt de la solicitud
begin; set local role authenticated; select pg_temp.como('colab-m@test.cl');
select public.apih_solicitar_cambio('PRJ-001','Presupuesto','Más','m','', null, 900);
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista = 'APIH_Cambios' and datos like '%pNue%') = 0, 'la vista oculta pNue a quien no ve montos');
rollback;

-- reabrir
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_reabrir('PRJ-003','x')$$, 'colaborador no reabre proyectos cerrados', '%solo Administra%');
select pg_temp.falla($$select public.apih_reabrir('PROP-002','x')$$, 'propuesta vigente no se reabre', '%Rechazadas o Retiradas%');
select pg_temp.falla($$select public.apih_reabrir('PROP-001','')$$, 'exige motivo', '%motivo de la reapertura%');
select pg_temp.ok((public.apih_reabrir('PROP-001','revisar')) ->> 'estado' = 'Vigente', 'colaborador del área reabre propuesta rechazada');
select pg_temp.como('adm@test.cl');
select pg_temp.ok((public.apih_reabrir('PRJ-003','falta cierre')) ->> 'estado' = 'En curso', 'Administra reabre proyecto completado');
select public.apih_reabrir('PRJ-004','error');
select pg_temp.falla($$select public.apih_reabrir('PRJ-001','x')$$, 'proyecto en curso no se reabre', '%proyectos cerrados%');
reset role;
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-003') ->> 'estado' = 'En curso' and pg_temp.j('APIH_Proyectos','PRJ-003') -> 'finReal' = 'null'::jsonb and pg_temp.j('APIH_Proyectos','PRJ-004') ->> 'estadoMotivo' = '', 'reapertura limpia fin real y motivo');
select pg_temp.ok((select count(*) from public.registros where lista='APIH_Bitacora') = 3, 'bitácora de las reaperturas');
rollback;
\echo PRUEBAS DE CAMBIOS Y REAPERTURA OK
