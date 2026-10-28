-- Iter 5f · resumen: on track, tramos del % On Track y ventanas vienen del servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Verde a tiempo","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"L","inicioPlan":"2026-08-01","finPlan":"2026-12-31","actualizada":"2026-10-27","deps":[]}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Verde atrasado","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"L","inicioPlan":"2026-05-01","finPlan":"2026-09-01","actualizada":"2026-10-27","deps":[]}'),
 ('APIH_Proyectos','PRJ-003','p1.{"id":"PRJ-003","titulo":"Ámbar","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Ámbar","lider":"L","inicioPlan":"2026-08-01","finPlan":"2026-12-31","deps":[]}'),
 ('APIH_Proyectos','PRJ-004','p1.{"id":"PRJ-004","titulo":"Cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado","rag":"Verde","lider":"L","deps":[]}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
select pg_temp.ok((public.apih_calculos() -> 'resumen' -> 'ontrack' ->> 'PRJ-001') = 'true', 'verde y a tiempo = on track');
select pg_temp.ok((public.apih_calculos() -> 'resumen' -> 'ontrack' ->> 'PRJ-002') = 'false', 'verde pero atrasado = no');
select pg_temp.ok((public.apih_calculos() -> 'resumen' -> 'ontrack' ->> 'PRJ-003') = 'false', 'ámbar = no');
select pg_temp.ok(not (public.apih_calculos() -> 'resumen' -> 'ontrack' ? 'PRJ-004'), 'un proyecto cerrado no cuenta como activo');
select pg_temp.ok(jsonb_array_length(public.apih_calculos() -> 'resumen' -> 'tonos') = 3 and (public.apih_calculos() -> 'resumen' -> 'tonos' -> 0 ->> 'desde') = '60', 'tramos del % On Track');
select pg_temp.ok((public.apih_calculos() -> 'resumen' -> 'ventanas' ->> 'cierreDias') = '45', 'ventanas del resumen');
commit;
