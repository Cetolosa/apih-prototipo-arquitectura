-- Iter 6 · auto-registro, usuarios pendientes y proyectos asignados
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
delete from public.perfiles where email in ('adm@test.cl','col@test.cl','nuevo@test.cl','inv@test.cl');
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}'),('col@test.cl','Cora Colabora','editor','Colaborador','{B}');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Del área A","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","deps":[]}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Del área B","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","deps":[]}'),
 ('APIH_Hitos','H-1','p1.{"id":"H-1","ini":"PRJ-001","nombre":"Hito A","fase":"Ejecución","fecha":"2026-12-01","hecho":false}');
select pg_temp.ok((select area from public.registros where id='PRJ-001') = 'A,@PRJ-001' and (select area from public.registros where id='H-1') = 'A,@PRJ-001', 'el proyecto y sus hitos llevan su código interno en el área');
begin; set local role authenticated;
-- 1. Auto-registro: cuenta nueva = pendiente, sin acceso
select pg_temp.como('nuevo@test.cl');
select pg_temp.ok((public.apih_solicitar_acceso('Nora Nueva') ->> 'estado') = 'pendiente', 'una cuenta nueva queda pendiente');
select pg_temp.ok((public.apih_solicitar_acceso('Otro') ->> 'estado') = 'pendiente', 'pedirlo de nuevo no duplica ni cambia nada');
select pg_temp.ok(public.apih_contexto() is null, 'el pendiente no tiene contexto');
select pg_temp.ok((select count(*) from public.registros_v) = 0, 'el pendiente no ve ningún registro');
select pg_temp.falla($$select public.apih_usuarios()$$, 'el pendiente no lista usuarios', '%solo Administra%');
select pg_temp.falla($$select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Administra"}'::jsonb)$$, 'el pendiente no se autoasigna rol', '%solo Administra%');
select pg_temp.falla($$select public.apih_comentar(null, 'hola')$$, 'el pendiente no escribe', '%');
-- 2. Administra asigna rol y proyecto
select pg_temp.como('adm@test.cl');
select pg_temp.ok((select (u->>'pendiente')::boolean from jsonb_array_elements(public.apih_usuarios()) u where u->>'email' = 'nuevo@test.cl'), 'Administra ve al pendiente en la lista (primero)');
select pg_temp.ok((public.apih_usuarios() -> 0 ->> 'email') = 'nuevo@test.cl', 'los pendientes salen primero');
select pg_temp.falla($$select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Jefe"}'::jsonb)$$, 'rol inválido', '%elige un rol%');
select pg_temp.falla($$select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Colaborador","proyectos":["PRJ-999"]}'::jsonb)$$, 'proyecto inexistente', '%no existe%');
select pg_temp.falla($$select public.apih_guardar_usuario('adm@test.cl', '{"appRol":"Colaborador"}'::jsonb)$$, 'no puede quitarse su propio acceso', '%propio acceso%');
select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Colaborador","areas":["B"],"proyectos":["PRJ-001"],"nombre":"Nora Nueva","cargo":"Analista"}'::jsonb);
select pg_temp.como('nuevo@test.cl');
select pg_temp.ok((public.apih_contexto() ->> 'appRol') = 'Colaborador' and (public.apih_contexto() -> 'proyectos') = '["PRJ-001"]'::jsonb, 'ya tiene contexto: rol y proyectos asignados');
select pg_temp.ok((select count(*) from public.registros_v where lista = 'APIH_Proyectos') = 1 and (select count(*) from public.registros_v where id = 'PRJ-002') = 0, 'con proyectos asignados ve SOLO esos: su área B ya no amplía el alcance');
select pg_temp.ok((public.apih_contexto() ->> 'restringido')::boolean and public.apih_contexto() -> 'areasVisibles' = '[]'::jsonb and public.apih_contexto() -> 'areasEditables' = '[]'::jsonb, 'el contexto informa que está acotado a proyectos');
select pg_temp.ok((select count(*) from public.registros_v where lista = 'APIH_Hitos') = 1, 've los hitos del proyecto asignado');
select public.apih_comentar('PRJ-001', 'Desde proyecto asignado');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Desde proyecto asignado%') = 1, 'comenta y edita el proyecto asignado aunque sea de otra área');
select public.apih_avance_auto('PRJ-001');
select pg_temp.ok(true, 'ejecuta comandos de edición sobre el proyecto asignado');
-- 3. Sin asignación no ve ni edita el de otra área
select pg_temp.como('adm@test.cl');
select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Colaborador","areas":["B"],"proyectos":[]}'::jsonb);
select pg_temp.como('nuevo@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista = 'APIH_Proyectos') = 1 and (select count(*) from public.registros_v where id = 'PRJ-002') = 1, 'sin proyectos asignados vuelve al alcance por áreas (ve el de su área B, no el de A)');
select pg_temp.falla($$select public.apih_avance_auto('PRJ-001')$$, 'ni lo edita', '%');
-- 4. Invitado con proyecto asignado: ve, no edita
select pg_temp.como('adm@test.cl');
select public.apih_guardar_usuario('nuevo@test.cl', '{"appRol":"Invitado","areas":[],"proyectos":["PRJ-002"]}'::jsonb);
select pg_temp.como('nuevo@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista = 'APIH_Proyectos' and id = 'PRJ-002') = 1, 'el invitado ve el proyecto asignado');
select pg_temp.falla($$select public.apih_avance_auto('PRJ-002')$$, 'pero no lo edita', '%');
-- 5. Desactivar
select pg_temp.como('adm@test.cl');
select public.apih_desactivar_usuario('nuevo@test.cl');
select pg_temp.como('nuevo@test.cl');
select pg_temp.ok((public.apih_solicitar_acceso() ->> 'estado') = 'inactivo' and public.apih_contexto() is null, 'desactivado: sin acceso y estado inactivo');
select pg_temp.como('adm@test.cl');
select pg_temp.falla($$select public.apih_desactivar_usuario('adm@test.cl')$$, 'no se desactiva a sí mismo', '%propio acceso%');
-- 6. El código interno no sale a la persona
select pg_temp.ok((public.apih_contexto() -> 'areasVisibles')::text not like '%@%', 'las áreas visibles no incluyen códigos internos');
commit;
