-- Iter 5e · avisos por el servidor: reglas, destinatarios, preferencias (organización y persona), canales y orden
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.av() returns jsonb language sql as $$ select public.apih_calculos() -> 'notif' -> 'avisos' $$;
create or replace function pg_temp.tiene(p_key text) returns boolean language sql as
$$ select exists (select 1 from jsonb_array_elements(pg_temp.av()) a where a ->> 'key' = p_key) $$;
create or replace function pg_temp.txt(p_key text) returns text language sql as
$$ select a ->> 'texto' from jsonb_array_elements(pg_temp.av()) a where a ->> 'key' = p_key $$;

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora','APIH_Compromisos','APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Cambios','APIH_Comites');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values
  ('lider-a@test.cl','Lía Líder','editor','Colaborador','{"A"}'),
  ('otra@test.cl','Otra Persona','editor','Colaborador','{"A"}'),
  ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do update set nombre = excluded.nombre, app_rol = excluded.app_rol, areas = excluded.areas, rol = excluded.rol;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-010','p1.{"id":"PRJ-010","titulo":"Base","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"Lía Líder","sponsor":"Otra Persona","actualizada":"2026-09-01","inicioPlan":"2026-08-01","finPlan":"2026-12-31","deps":[]}'),
 ('APIH_Proyectos','PRJ-030','p1.{"id":"PRJ-030","titulo":"Atrasado","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"Lía Líder","actualizada":"2026-10-27","inicioPlan":"2026-06-01","finPlan":"2026-09-01","deps":[]}'),
 ('APIH_Proyectos','PRJ-020','p1.{"id":"PRJ-020","titulo":"En standby","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"Stand By","lider":"Lía Líder","actualizada":"2026-01-01","deps":[]}'),
 ('APIH_Propuestas','PROP-001','p1.{"id":"PROP-001","titulo":"Prop vieja","area":"A","tipo":"Propuesta","fase":"Evaluación","estado":"Vigente","lider":"Lía Líder","creada":"2026-08-01"}'),
 ('APIH_Hitos','HIT-001','p1.{"id":"HIT-001","ini":"PRJ-010","nombre":"Entrega 1","fecha":"2026-10-20","completado":false,"resp":"Lía Líder","fase":"Ejecución"}'),
 ('APIH_Hitos','HIT-002','p1.{"id":"HIT-002","ini":"PRJ-010","nombre":"Entrega 2","fecha":"2026-10-30","completado":false,"resp":"Lía Líder","fase":"Ejecución"}'),
 ('APIH_Hitos','HIT-003','p1.{"id":"HIT-003","ini":"PRJ-010","nombre":"Lejano","fecha":"2026-12-30","completado":false,"resp":"Lía Líder","fase":"Ejecución"}'),
 ('APIH_Hitos','HIT-004','p1.{"id":"HIT-004","ini":"PRJ-020","nombre":"En standby","fecha":"2026-10-01","completado":false,"resp":"Lía Líder","fase":"Ejecución"}'),
 ('APIH_Compromisos','ACU-001','p1.{"id":"ACU-001","texto":"Enviar acta","resp":"Lía Líder","limite":"2026-10-25","estado":"Abierto","ini":"PRJ-010"}'),
 ('APIH_Compromisos','ACU-002','p1.{"id":"ACU-002","texto":"General por vencer","resp":"Lía Líder","limite":"2026-10-29","estado":"Abierto"}'),
 ('APIH_Riesgos','RSK-001','p1.{"id":"RSK-001","ini":"PRJ-010","desc":"Proveedor","prob":5,"imp":5,"estado":"Abierto","dueno":"Otra Persona","mit":"x"}'),
 ('APIH_Decisiones','DEC-001','p1.{"id":"DEC-001","ini":"PRJ-010","titulo":"Aprobar fase","tipo":"Mantener","estado":"Pendiente","limite":"2026-10-20","solicita":"Otra Persona"}'),
 ('APIH_Cambios','CHG-001','p1.{"id":"CHG-001","ini":"PRJ-010","tipo":"Fecha","desc":"Mover fin","estado":"Solicitado","solicita":"Otra Persona","creada":"2026-10-27"}'),
 ('APIH_Cambios','CHG-002','p1.{"id":"CHG-002","ini":"PRJ-010","tipo":"Presupuesto","desc":"Más plata","estado":"Aprobado","solicita":"Lía Líder","fDec":"2026-10-27"}'),
 ('APIH_Bitacora','BIT-001','p1.{"id":"BIT-001","ini":"PRJ-010","tipo":"Comentario","autor":"Otra Persona","texto":"Revisar plan","ts":"2026-10-27T10:00:00"}'),
 ('APIH_Bitacora','BIT-002','p1.{"id":"BIT-002","ini":"PRJ-010","tipo":"Comentario","autor":"Lía Líder","texto":"Mi propio comentario","ts":"2026-10-27T10:00:00"}'),
 ('APIH_Bitacora','BIT-003','p1.{"id":"BIT-003","ini":"PRJ-010","tipo":"Cambio","autor":"Otra Persona","texto":"RAG Verde → Rojo","ts":"2026-10-27T11:00:00"}'),
 ('APIH_Bitacora','BIT-004','p1.{"id":"BIT-004","ini":"PRJ-010","tipo":"Edición","autor":"Otra Persona","texto":"Hito «Entrega 2» — Responsable: Pedro → Lía Líder","ts":"2026-10-27T12:00:00"}'),
 ('APIH_Bitacora','BIT-005','p1.{"id":"BIT-005","ini":"PRJ-010","tipo":"Comentario","autor":"Otra Persona","texto":"Muy antiguo","ts":"2026-09-01T10:00:00"}');

begin; set local role authenticated;
select pg_temp.como('lider-a@test.cl');
select pg_temp.ok(jsonb_array_length(public.apih_calculos() -> 'notif' -> 'catalogo' -> 'tipos') = 15, 'el catálogo viene del servidor (15 tipos)');
select pg_temp.ok(pg_temp.tiene('hito_venc:HIT-001') and pg_temp.txt('hito_venc:HIT-001') = '«Entrega 1» venció hace 8 d (20 oct 26) · Base', 'hito vencido: texto y fecha en formato de la app');
select pg_temp.ok(pg_temp.tiene('hito_prox:HIT-002') and pg_temp.txt('hito_prox:HIT-002') like '%vence en 2 d%' and not pg_temp.tiene('hito_prox:HIT-003'), 'hito por vencer solo dentro de la ventana (3 días)');
select pg_temp.ok(not pg_temp.tiene('hito_venc:HIT-004'), 'un proyecto en Stand By no avisa');
select pg_temp.ok(pg_temp.tiene('comp_venc:ACU-001') and pg_temp.tiene('comp_prox:ACU-002') and pg_temp.txt('comp_prox:ACU-002') = '«General por vencer» vence en 1 d · Lía Líder', 'compromisos vencido y por vencer (incluye el general)');
select pg_temp.ok(pg_temp.tiene('riesgo_crit:RSK-001') and pg_temp.txt('riesgo_crit:RSK-001') = 'Exposición 25: Proveedor · Base', 'riesgo crítico: llega a la líder aunque el dueño sea otra persona');
select pg_temp.ok(pg_temp.tiene('atraso:PRJ-030') and pg_temp.txt('atraso:PRJ-030') = 'Atrasado: +57 d sobre el plan' and not pg_temp.tiene('atraso:PRJ-010'), 'proyecto atrasado (y no el que va en plazo)');
select pg_temp.ok(pg_temp.tiene('sin_update:PRJ-010') and pg_temp.txt('sin_update:PRJ-010') = 'Base: 57 d sin actualizar', 'proyecto sin actualización');
select pg_temp.ok(pg_temp.tiene('prop_estancada:PROP-001') is false, 'propuesta estancada viene apagada por defecto');
select pg_temp.ok(pg_temp.tiene('ev_comentario:BIT-001') and not pg_temp.tiene('ev_comentario:BIT-002') and not pg_temp.tiene('ev_comentario:BIT-005'), 'comentario de otra persona sí; el propio y el antiguo no');
select pg_temp.ok(pg_temp.tiene('ev_rag:BIT-003'), 'salud pasa a Rojo');
select pg_temp.ok(pg_temp.tiene('ev_asigna:BIT-004Responsable') and pg_temp.txt('ev_asigna:BIT-004Responsable') = 'Hito «Entrega 2»: ahora eres responsable (antes Pedro) · Base', 'te asignaron como responsable (se lee de la bitácora)');
select pg_temp.ok(pg_temp.tiene('cambio_res:CHG-002') and not pg_temp.tiene('cambio_pend:CHG-001'), 'cambio resuelto avisa a quien lo pidió; el pendiente solo a la PMO');
select pg_temp.ok((select (a ->> 'canales') from jsonb_array_elements(pg_temp.av()) a where a ->> 'key' = 'hito_venc:HIT-001') = '["app"]', 'canales: solo la app mientras correo y Teams no estén habilitados');
select pg_temp.ok((select array_agg(a ->> 'ts' order by ord) from jsonb_array_elements(pg_temp.av()) with ordinality t(a, ord)) = (select array_agg(ts order by ts desc) from (select a ->> 'ts' ts from jsonb_array_elements(pg_temp.av()) a) q), 'ordenados por fecha descendente');
-- otra persona: ve lo suyo
select pg_temp.como('otra@test.cl');
select pg_temp.ok(pg_temp.tiene('riesgo_crit:RSK-001') and pg_temp.tiene('dec_venc:DEC-001') and not pg_temp.tiene('hito_venc:HIT-001'), 'otra persona: riesgo y decisión suyos, no los hitos de la líder');
select pg_temp.ok(not pg_temp.tiene('ev_comentario:BIT-001'), 'el autor del comentario no se avisa a sí mismo');
select pg_temp.ok(not pg_temp.tiene('atraso:PRJ-030'), 'el atraso solo avisa a líder y sponsor');
-- PMO
select pg_temp.como('adm@test.cl');
select pg_temp.ok(pg_temp.tiene('cambio_pend:CHG-001') and pg_temp.tiene('comp_venc:ACU-001'), 'la PMO recibe los cambios pendientes y los compromisos vencidos');
commit;
-- preferencias: la organización apaga un tipo y la persona lo vuelve a encender
update public.registros set datos = 'p1.{"hoyFija":"2026-10-28","notif":{"tipos":{"hito_venc":{"on":false},"hito_prox":{"dias":10}},"canalOn":{"correo":true}}}' where lista = 'APIH_Config' and id = 'cfg';
begin; set local role authenticated;
select pg_temp.como('lider-a@test.cl');
select pg_temp.ok(not pg_temp.tiene('hito_venc:HIT-001'), 'la organización apagó «hito vencido»');
select pg_temp.ok(pg_temp.tiene('hito_prox:HIT-003') is false and (public.apih_calculos() -> 'notif' -> 'prefs' -> 'hito_prox' ->> 'dias') = '10', 'la organización cambió los días de anticipación (10)');
select pg_temp.ok((public.apih_calculos() -> 'notif' -> 'prefs' -> 'hito_venc' ->> 'on') = 'false', 'la preferencia efectiva llega a la SPA');
commit;
insert into public.registros(lista, id, datos) values ('APIH_Config','cfgU:lider-a@test.cl','p1.{"n":"Lía Líder","v":{"notif":{"tipos":{"hito_venc":{"on":true,"canales":{"correo":true}}}}}}')
  on conflict (lista, id) do update set datos = excluded.datos;
begin; set local role authenticated;
select pg_temp.como('lider-a@test.cl');
select pg_temp.ok(pg_temp.tiene('hito_venc:HIT-001'), 'la persona vuelve a encender el tipo para ella');
select pg_temp.ok((select a ->> 'canales' from jsonb_array_elements(pg_temp.av()) a where a ->> 'key' = 'hito_venc:HIT-001') = '["app", "correo"]', 'canales: la persona pidió correo y la organización lo habilitó');
commit;
