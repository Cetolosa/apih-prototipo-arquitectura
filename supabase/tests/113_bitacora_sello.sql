-- Iter 5j · bitácora: autor y hora los pone el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('adm@test.cl','Ada Administra','admin','Administra','{}') on conflict (email) do nothing;
insert into public.perfiles (email, nombre, rol, app_rol, areas) values ('lia@test.cl','Lía Líder','editor','Colaborador','{A}') on conflict (email) do update set nombre = 'Lía Líder', app_rol = 'Colaborador', areas = '{A}';
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Lía Líder","deps":[]}');
begin; set local role authenticated;
select pg_temp.como('lia@test.cl');
insert into public.registros(lista, id, datos) values ('APIH_Bitacora','BIT-T1','p1.{"id":"BIT-T1","ini":"PRJ-001","tipo":"Comentario","autor":"Ada Administra","ts":"2020-01-01T00:00","texto":"hola"}');
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'autor' from public.registros_v where id = 'BIT-T1') = 'Lía Líder', 'el autor es quien escribe, no el que dice el cliente');
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'ts' from public.registros_v where id = 'BIT-T1') > '2026-01-01', 'la hora la pone el servidor');
update public.registros set datos = 'p1.{"id":"BIT-T1","ini":"PRJ-001","tipo":"Comentario","autor":"Otro","ts":"2019-01-01T00:00","texto":"cambiado","tema":"x"}' where id = 'BIT-T1';
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'texto' from public.registros_v where id = 'BIT-T1') = 'hola' and (select substr(datos,4)::jsonb ->> 'autor' from public.registros_v where id = 'BIT-T1') = 'Lía Líder', 'una anotación no cambia de autor ni de texto');
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'tema' from public.registros_v where id = 'BIT-T1') = 'x', 'sí se puede etiquetar (tema)');
commit;
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
insert into public.registros(lista, id, datos) values ('APIH_Bitacora','BIT-T2','p1.{"id":"BIT-T2","ini":"PRJ-001","tipo":"Cambio","autor":"Histórico","ts":"2020-01-01T00:00","texto":"carga"}');
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'autor' from public.registros_v where id = 'BIT-T2') = 'Histórico', 'la administración puede cargar historial');
commit;
