-- Iter 5g · directorio de personas calculado en el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Comites');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
insert into public.perfiles (email, nombre, rol, app_rol, areas, cargo) values ('adm@test.cl','Ada Administra','admin','Administra','{}','Jefa PMO') on conflict (email) do update set cargo = 'Jefa PMO';
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A, B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Lia - Leo","sponsor":"Sol","negocio":"Nora","deps":[]}'),
 ('APIH_Proyectos','PRJ-002','p1.{"id":"PRJ-002","titulo":"Pausa","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"Stand By","rag":"Verde","lider":"Fuera","deps":[]}'),
 ('APIH_Proyectos','PRJ-003','p1.{"id":"PRJ-003","titulo":"Cerrado","area":"A","tipo":"Proyecto","fase":"Cierre","estado":"Completado","rag":"Verde","lider":"Lia","deps":[]}'),
 ('APIH_Hitos','H-1','p1.{"id":"H-1","ini":"PRJ-001","nombre":"H1","fase":"Ejecución","resp":"Lia","fecha":"2026-10-01","completado":false}'),
 ('APIH_Hitos','H-2','p1.{"id":"H-2","ini":"PRJ-001","nombre":"H2","fase":"Ejecución","resp":"Lia","fecha":"2026-12-01","completado":false}'),
 ('APIH_Hitos','H-3','p1.{"id":"H-3","ini":"PRJ-002","nombre":"H3","fase":"Ejecución","resp":"Fuera","fecha":"2026-12-01","completado":false}'),
 ('APIH_Riesgos','R-1','p1.{"id":"R-1","ini":"PRJ-001","desc":"x","prob":2,"imp":2,"dueno":"Leo","estado":"Abierto"}'),
 ('APIH_Riesgos','R-2','p1.{"id":"R-2","ini":"PRJ-001","desc":"y","prob":2,"imp":2,"dueno":"Leo","estado":"Cerrado"}'),
 ('APIH_Decisiones','D-1','p1.{"id":"D-1","ini":"PRJ-001","titulo":"D","tipo":"Mantener","solicita":"Sol","estado":"Pendiente","limite":"2026-12-01"}'),
 ('APIH_Comites','COM-1','p1.{"id":"COM-1","participantes":[{"n":"Pia","rol":"Directora"}],"acciones":[{"resp":"Pia","estado":"Abierta"}],"compromisos":[{"resp":"Pia","estado":"Cerrada"}]}');
begin; set local role authenticated;
select pg_temp.como('adm@test.cl');
create temp table pd as select jsonb_array_elements(public.apih_calculos() -> 'personas') p;
select pg_temp.ok((select (p->>'lidera')::int from pd where p->>'n'='Lia') = 1, 'Lia lidera 1 proyecto vivo (el cerrado no cuenta)');
select pg_temp.ok((select (p->>'hitos')::int from pd where p->>'n'='Lia') = 2 and (select (p->>'hitosAtr')::int from pd where p->>'n'='Lia') = 1, 'hitos abiertos y vencidos');
select pg_temp.ok((select (p->>'riesgos')::int from pd where p->>'n'='Leo') = 1, 'solo riesgos abiertos');
select pg_temp.ok((select (p->'roles'->>'Líder de proyecto')::int from pd where p->>'n'='Lia') = 2, 'rol Líder de proyecto cuenta una vez por proyecto');
select pg_temp.ok((select p->'areas' from pd where p->>'n'='Lia') = '["A","B"]'::jsonb, 'áreas del líder');
select pg_temp.ok((select (p->>'decis')::int from pd where p->>'n'='Sol') = 1 and (select p->'roles' ? 'Sponsor' from pd where p->>'n'='Sol'), 'sponsor y decisiones pendientes');
select pg_temp.ok((select (p->>'acc')::int from pd where p->>'n'='Pia') = 1 and (select p->>'cargo' from pd where p->>'n'='Pia') = 'Directora', 'acciones abiertas y cargo desde el comité');
select pg_temp.ok(not exists (select 1 from pd where p->>'n'='Fuera'), 'Stand By queda fuera');
select pg_temp.ok((select p->>'acceso' from pd where p->>'n'='Ada Administra') = 'Administra' and (select p->>'cargo' from pd where p->>'n'='Ada Administra') = 'Jefa PMO', 'acceso y cargo desde perfiles');
commit;
