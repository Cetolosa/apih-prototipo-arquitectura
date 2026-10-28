-- Iter 5b · formularios por comando: hitos, riesgos y decisiones (validación con campo, permisos, ids, bitácora y efectos)
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

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Decisiones','APIH_Hitos','APIH_Bitacora','APIH_Riesgos','APIH_Comites');
delete from public.registros where lista = 'APIH_Config' and id in ('cfg','seq');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"metodo":{"fasesProp":["Recepción","Evaluación","Caso de Negocio","Aprobación"],"fasesPrj":["Planificación","Ejecución","Cierre"],"tipos":[]},"hoyFija":"2026-10-28"}'),
 ('APIH_Config','seq','p1.{"RSK":7}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"P1","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Vigente"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Pr1","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","subfases":[{"id":"SF-1","fase":"Ejecución","nombre":"Construcción","inicio":"2026-10-01","fin":"2026-11-30"}]}'),
 ('APIH_Proyectos','PRJ-004','p1.{"id":"PRJ-004","titulo":"Pr4 otra área","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso"}'),
 ('APIH_Comites','COM-001','p1.{"id":"COM-001","nombre":"C1","fecha":"2026-11-05","decisiones":[]}'),
 ('APIH_Comites','COM-002','p1.{"id":"COM-002","nombre":"C2","fecha":"2026-11-19","decisiones":[]}');
insert into public.perfiles (email, rol, app_rol, areas) values ('colab-a@test.cl','editor','Colaborador','{"A"}') on conflict do nothing;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
-- Riesgos
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"","prob":3,"imp":3}')$$, 'riesgo sin descripción', '%describe el riesgo%', 'desc');
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"Caída","prob":4,"imp":4,"mit":""}')$$, 'riesgo crítico sin mitigación (umbral por defecto 15)', '%requiere plan de mitigación%', 'mit');
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-004","desc":"Otra área","prob":1,"imp":1}')$$, 'riesgo en área ajena', '%sin permiso%');
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"x","prob":9,"imp":1}')$$, 'probabilidad fuera de 1..5', null, 'prob');
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"x","prob":2,"imp":2,"campoInventado":1}')$$, 'campo fuera del catálogo', '%campo desconocido%');
select pg_temp.ok((public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"Caída","prob":4,"imp":4,"mit":"Plan B"}') ->> 'id') = 'RSK-008', 'alta de riesgo con id del servidor (respeta seq)');
select pg_temp.ok((public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"Menor","prob":1,"imp":2}') ->> 'critico') = 'false', 'riesgo no crítico sin mitigación');
select pg_temp.ok(pg_temp.j('APIH_Riesgos','RSK-009') ->> 'estado' = 'Abierto' and pg_temp.j('APIH_Riesgos','RSK-009') ->> 'fIdent' = '2026-10-28', 'valores por defecto del servidor (estado, fecha)');
select public.apih_guardar_riesgo('RSK-009', '{"estado":"Cerrado","imp":5,"prob":5}');
select pg_temp.ok(pg_temp.j('APIH_Riesgos','RSK-009') ->> 'estado' = 'Cerrado', 'riesgo cerrado con exposición alta no exige mitigación');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' like 'Riesgo identificado: Caída%'), 'bitácora del alta escrita por el servidor');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'meta' = 'Exposición 2 → 25'), 'bitácora con la exposición anterior y nueva');
-- umbral del líder/organización: con umbral 26 el riesgo 5x5 no es crítico
commit;
update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || '{"umbralCritico":26}')::text where lista = 'APIH_Config' and id = 'cfg';
begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"Alto","prob":5,"imp":5}') ->> 'critico') = 'false', 'el umbral configurado lo aplica el servidor');
select pg_temp.ok((public.apih_compuertas('PRJ-001', 'Cierre') -> 0) is not null, 'compuertas con el mismo umbral (apih_umbral)');
-- Hitos
select pg_temp.falla($$select public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"","fecha":"2026-11-10"}')$$, 'hito sin nombre', '%necesita nombre%', 'nombre');
select pg_temp.falla($$select public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"H","fecha":"2026-11-10","peso":150}')$$, 'peso fuera de 0..100', '%0 a 100%', 'peso');
select pg_temp.falla($$select public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"H","fecha":"2026-11-10","subfase":"SF-9"}')$$, 'subfase ajena', '%no es de esta iniciativa%', 'subfase');
select pg_temp.falla($$select public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"H","fecha":"2026-11-10","subfase":"SF-1","fase":"Cierre"}')$$, 'fase distinta de la de la subfase', '%debe estar en esa fase%', 'fase');
select pg_temp.falla(format($$select public.apih_guardar_hito(null, %L)$$, jsonb_build_object('ini','PRJ-001','nombre','H','fecha','2026-11-10','desc', repeat('x', 501))), 'descripción > 500', '%no puede superar 500%', 'desc');
select pg_temp.ok((public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"Entrega","fecha":"2026-11-10","subfase":"SF-1","peso":"40"}') ->> 'id') = 'HIT-001', 'alta de hito con id del servidor');
select pg_temp.ok(pg_temp.j('APIH_Hitos','HIT-001') ->> 'fase' = 'Ejecución' and (pg_temp.j('APIH_Hitos','HIT-001') ->> 'peso')::numeric = 40, 'la subfase fija la fase; el peso se normaliza a número');
select pg_temp.ok(jsonb_array_length(public.apih_guardar_hito(null, '{"ini":"PRJ-001","nombre":"Fuera","fecha":"2026-12-20","subfase":"SF-1"}') -> 'avisos') = 1, 'aviso del servidor: fecha fuera de la subfase');
select public.apih_guardar_hito('HIT-001', '{"completado":true,"fechaReal":"2020-01-01"}');
select pg_temp.ok(pg_temp.j('APIH_Hitos','HIT-001') ->> 'completado' = 'true' and pg_temp.j('APIH_Hitos','HIT-001') ->> 'fechaReal' is distinct from '2020-01-01', 'completar desde el formulario pasa por apih_hito_estado (la fecha real la pone el servidor)');
select pg_temp.ok(pg_temp.j('APIH_Proyectos','PRJ-001') ->> 'actualizada' = '2026-10-28', 'la iniciativa queda actualizada');
-- Decisiones
select pg_temp.falla($$select public.apih_guardar_decision(null, '{"ini":"PRJ-001","tipo":"Mantener","titulo":"T"}')$$, 'decisión sin fecha límite', '%obligatoria%', 'limite');
select pg_temp.falla($$select public.apih_guardar_decision(null, '{"ini":"PRJ-001","tipo":"Mantener","titulo":"T","limite":"2027-03-01"}')$$, 'plazo mayor al máximo (30 días)', '%plazo máximo%', 'limite');
select pg_temp.falla($$select public.apih_guardar_decision(null, '{"ini":"PRJ-001","tipo":"Iniciar","titulo":"T","limite":"2026-11-10"}')$$, '«Iniciar» sobre un proyecto', '%solo a propuestas%', 'tipo');
select pg_temp.falla($$select public.apih_guardar_decision(null, '{"ini":"PROP-001","tipo":"Acelerar","titulo":"T","limite":"2026-11-10"}')$$, '«Acelerar» sobre una propuesta', '%solo a proyectos%', 'tipo');
select pg_temp.ok((public.apih_guardar_decision(null, '{"ini":"PROP-001","tipo":"Iniciar","titulo":"¿Iniciar P1?","limite":"2026-11-10","comite":"COM-001","estado":"Aprobada"}') ->> 'id') = 'DEC-001', 'alta de decisión');
select pg_temp.ok(pg_temp.j('APIH_Decisiones','DEC-001') ->> 'estado' = 'Pendiente', 'el estado no se fija desde el formulario (solo al resolver)');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') -> 'decisiones' ? 'DEC-001', 'el comité recibe la decisión');
select public.apih_guardar_decision('DEC-001', '{"comite":"COM-002"}');
select pg_temp.ok(not (pg_temp.j('APIH_Comites','COM-001') -> 'decisiones' ? 'DEC-001') and pg_temp.j('APIH_Comites','COM-002') -> 'decisiones' ? 'DEC-001', 'cambiar de comité mueve la decisión en la misma transacción');
-- Eliminar
select public.apih_eliminar('APIH_Decisiones', 'DEC-001');
select pg_temp.ok(not (pg_temp.j('APIH_Comites','COM-002') -> 'decisiones' ? 'DEC-001'), 'eliminar la decisión la saca del comité');
select pg_temp.falla($$select public.apih_eliminar('APIH_Proyectos', 'PRJ-001')$$, 'eliminar otra lista no está permitido', '%no se puede eliminar%');
select public.apih_eliminar('APIH_Riesgos', 'RSK-008');
select pg_temp.ok(pg_temp.j('APIH_Riesgos','RSK-008') is null and exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Riesgo eliminado: Caída'), 'eliminar riesgo deja bitácora');
-- solo lectura
select pg_temp.como('inv-a@test.cl');
select pg_temp.falla($$select public.apih_guardar_riesgo(null, '{"ini":"PRJ-001","desc":"x","prob":1,"imp":1}')$$, 'invitado no escribe', '%sin permiso%');
commit;
