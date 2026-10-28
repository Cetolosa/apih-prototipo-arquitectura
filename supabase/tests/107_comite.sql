-- Iter 5d · comités por comando: permisos de gobierno, validación con campo, ids y bitácora del servidor, agenda, cierre y eliminación
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

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora','APIH_Compromisos','APIH_Comites','APIH_Decisiones');
delete from public.registros where lista = 'APIH_Config' and id in ('cfg','seq');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","comiteParts":["Pedro Dos"]}'),
 ('APIH_Proyectos','PRJ-010','p1.{"id":"PRJ-010","titulo":"Base","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"L","deps":[]}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"Prop viva","area":"A","tipo":"Propuesta","fase":"Aprobación","estado":"Vigente","lider":"L"}'),
 ('APIH_Propuestas','PROP-002','p1.{"id":"PROP-002","titulo":"Prop cerrada","area":"A","tipo":"Propuesta","fase":"Aprobación","estado":"Rechazada","lider":"L"}');
insert into public.registros(lista, id, datos) values ('APIH_Decisiones','DEC-001','p1.{"id":"DEC-001","titulo":"Aprobar P1","tipo":"Iniciar","estado":"Pendiente","ini":"PROP-001","limite":"2026-11-10","comite":"COM-001"}');
insert into public.perfiles (email, rol, app_rol, areas, nombre, gobierna) values
  ('gob-a@test.cl','editor','Colaborador','{"A"}','Gina Gobierno', true),
  ('colab-a@test.cl','editor','Colaborador','{"A"}','Colab A', false) on conflict (email) do update set gobierna = excluded.gobierna, nombre = excluded.nombre;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"C","fecha":"2026-11-05"}')$$, 'sin gobierno no crea comités', '%gobierna%');
select pg_temp.como('gob-a@test.cl');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"","fecha":"2026-11-05"}')$$, 'sin nombre', '%nombre%', 'nombre');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"C","fecha":""}')$$, 'sin fecha', '%fecha%', 'fecha');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"C","fecha":"5/11"}')$$, 'fecha mal formada', '%inválida%', 'fecha');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"C","fecha":"2026-11-05","hora":"9"}')$$, 'hora mal formada', '%inválida%', 'hora');
select pg_temp.falla($$select public.apih_guardar_comite(null, '{"nombre":"C","fecha":"2026-11-05","estado":"Otro"}')$$, 'estado inválido', '%inválido%', 'estado');
select pg_temp.ok((public.apih_guardar_comite(null, '{"nombre":"Comité Portafolio","fecha":"2026-11-05","hora":"10:00","lugar":"Teams","temas":[{"t":"colado"}],"narrativa":"x"}') ->> 'id') = 'COM-001', 'alta: id del servidor');
select pg_temp.ok(jsonb_array_length(pg_temp.j('APIH_Comites','COM-001') -> 'participantes') = 2 and pg_temp.j('APIH_Comites','COM-001') #>> '{participantes,0,n}' = 'Gina Gobierno' and pg_temp.j('APIH_Comites','COM-001') #>> '{participantes,1,n}' = 'Pedro Dos', 'alta: participantes por defecto');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') -> 'temas' = '[]'::jsonb and pg_temp.j('APIH_Comites','COM-001') ->> 'estado' = 'Programado' and pg_temp.j('APIH_Comites','COM-001') ->> 'narrativa' = '', 'alta: colecciones y estado los pone el servidor');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Comité programado: 05-11-2026'), 'alta: bitácora');
select public.apih_guardar_comite('COM-001', '{"lugar":"Sala 3","participantes":[]}');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') ->> 'lugar' = 'Sala 3' and jsonb_array_length(pg_temp.j('APIH_Comites','COM-001') -> 'participantes') = 2, 'edición: conserva participantes');
-- temas
select pg_temp.falla($$select public.apih_comite_agregar('COM-001', 'temas', '{"t":""}')$$, 'tema vacío', '%tema%', 't');
select pg_temp.falla($$select public.apih_comite_agregar('COM-001', 'temas', '{"t":"X","ini":"PRJ-999"}')$$, 'tema con iniciativa inexistente', '%no existe%', 'ini');
select pg_temp.falla($$select public.apih_comite_agregar('COM-001', 'otra', '{}')$$, 'colección inválida', '%colección%');
select public.apih_comite_agregar('COM-001', 'temas', '{"t":"Seguimiento general","ini":"PRJ-010","notas":"n"}');
select public.apih_comite_agregar('COM-001', 'participantes', '{"n":"Ana Invitada"}');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') #>> '{temas,0,t}' = 'Seguimiento general' and pg_temp.j('APIH_Comites','COM-001') #>> '{participantes,2,rol}' = 'Participante', 'agregar tema y participante');
select public.apih_comite_marcar('COM-001', 'participantes', '2', true);
select pg_temp.ok((pg_temp.j('APIH_Comites','COM-001') #>> '{participantes,2,asistio}') = 'true', 'asistencia');
-- acciones y compromisos
select pg_temp.falla($$select public.apih_comite_agregar('COM-001', 'acciones', '{"texto":""}')$$, 'acción sin texto', '%acción%', 'texto');
select pg_temp.falla($$select public.apih_comite_agregar('COM-001', 'compromisos', '{"texto":"T","limite":"x"}')$$, 'compromiso con fecha inválida', '%inválida%', 'limite');
create temp table _acc as select public.apih_comite_agregar('COM-001', 'acciones', '{"texto":"Revisar contrato","resp":"Ana","limite":"2026-11-12","ini":"PRJ-010"}') ->> 'id' as id;
select pg_temp.ok((select id from _acc) ~ '^ACC-', 'acción: id del servidor');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') #>> '{acciones,0,estado}' = 'Abierta', 'acción: estado inicial');
select public.apih_comite_marcar('COM-001', 'acciones', (select id from _acc), true);
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') #>> '{acciones,0,estado}' = 'Cerrada' and exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Acción cumplido/a: Revisar contrato'), 'cumplir acción + bitácora');
select public.apih_comite_marcar('COM-001', 'acciones', (select id from _acc), false);
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') #>> '{acciones,0,estado}' = 'Abierta', 'reabrir acción');
select public.apih_comite_quitar('COM-001', 'acciones', (select id from _acc));
select public.apih_comite_quitar('COM-001', 'temas', '0');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') -> 'acciones' = '[]'::jsonb and pg_temp.j('APIH_Comites','COM-001') -> 'temas' = '[]'::jsonb, 'quitar acción y tema');
select pg_temp.falla($$select public.apih_comite_quitar('COM-001', 'temas', '5')$$, 'quitar tema inexistente', '%no existe%');
-- agenda
select pg_temp.ok((public.apih_comite_armar('COM-001', 'prop') ->> 'agregados')::int = 2, 'armar agenda (propuestas): decisión pendiente + propuesta viva (la cerrada no)');
select pg_temp.ok((public.apih_comite_armar('COM-001', 'prop') ->> 'agregados')::int = 0, 'armar agenda no repite temas');
select public.apih_comite_sugerido('COM-001', 'PRJ-010');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') #>> '{temas,2,t}' = 'Seguimiento: Base', 'sugerido: tema con el prefijo del servidor');
-- cierre
select public.apih_comite_cerrar('COM-001');
select pg_temp.ok(pg_temp.j('APIH_Comites','COM-001') ->> 'estado' = 'Realizado' and exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' like 'Comité realizado (05-11-2026): 3 temas%'), 'cerrar sesión + bitácora');
select pg_temp.falla($$select public.apih_comite_cerrar('COM-001')$$, 'cerrar dos veces', '%cerrada%', 'estado');
-- eliminar
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_eliminar('APIH_Comites', 'COM-001')$$, 'sin gobierno no elimina', '%gobierna%');
select pg_temp.como('gob-a@test.cl');
select pg_temp.ok((public.apih_eliminar('APIH_Comites', 'COM-001') ->> 'id') = 'COM-001' and pg_temp.j('APIH_Comites','COM-001') is null, 'eliminar comité');
select pg_temp.ok(pg_temp.j('APIH_Decisiones','DEC-001') ->> 'comite' is null, 'las decisiones quedan sin comité');
commit;
