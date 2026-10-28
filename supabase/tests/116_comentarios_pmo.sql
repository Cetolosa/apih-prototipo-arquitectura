-- Iter 5m · comentarios y acciones del Reglas PMO
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora','APIH_Comites');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('col@test.cl','Cora Colabora','lector','Colaborador','{B}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","avanceManual":30,"deps":[]}'),
 ('APIH_Comites','COM-1','p1.{"id":"COM-1","estado":"Programado","fecha":"2026-11-05","acciones":[]}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
select public.apih_comentar('PRJ-001', '  Hola equipo  ', 'Tema X', false);
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and substr(datos,4)::jsonb->>'texto' = 'Hola equipo' and substr(datos,4)::jsonb->>'tema' = 'Tema X' and substr(datos,4)::jsonb->'inPres' = 'false'::jsonb and substr(datos,4)::jsonb->>'autor' = 'Ada Administra') = 1, 'comentario con autor, tema y exclusión de presentación');
select public.apih_comentar(null, 'General');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%General%') = 1, 'comentario general');
select pg_temp.falla($$select public.apih_comentar('PRJ-001', '   ')$$, 'comentario vacío', '%escribe un comentario%');
select public.apih_avance_auto('PRJ-001');
select pg_temp.ok((select substr(datos,4)::jsonb->'avanceManual' from public.registros_v where id='PRJ-001') = 'null'::jsonb, 'avance automático quita el ajuste manual');
select public.apih_aplicar_rag('PRJ-001');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%sugerido por reglas automáticas%') = 1, 'RAG sugerido aplicado y registrado');
select public.apih_recordar_avance('PRJ-001');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Recordatorio del Reglas PMO%Ada Administra%') = 1, 'recordatorio registrado');
select public.apih_accion_recuperacion('PRJ-001');
select pg_temp.ok((select jsonb_array_length(substr(datos,4)::jsonb->'acciones') from public.registros_v where id='COM-1') = 1 and (select substr(datos,4)::jsonb->'acciones'->0->>'limite' from public.registros_v where id='COM-1') = '2026-11-04', 'acción en el próximo comité, a 7 días');
select pg_temp.como('col@test.cl');
select pg_temp.falla($$select public.apih_recordar_avance('PRJ-001')$$, 'recordar: solo gobierna', '%gobierna%');
select pg_temp.falla($$select public.apih_accion_recuperacion('PRJ-001')$$, 'acción: solo gobierna', '%gobierna%');
select pg_temp.falla($$select public.apih_avance_auto('PRJ-001')$$, 'colaborador de otra área no edita', '%');
commit;
