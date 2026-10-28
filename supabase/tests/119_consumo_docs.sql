-- Iter 7 · consumo de presupuesto y documentos por comando del servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora','APIH_Documentos');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
delete from public.perfiles where email in ('adm@test.cl','col@test.cl','otro@test.cl');
insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_montos) values ('adm@test.cl','Ada Administra','admin','Administra','{}',true),('col@test.cl','Cora Colabora','editor','Colaborador','{A}',true),('otro@test.cl','Omar Otro','editor','Colaborador','{A}',false);
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Ada Administra","presupuesto":2000000,"gastado":500000,"deps":[]}');
begin; set local role authenticated;
select pg_temp.como('col@test.cl');
select public.apih_registrar_consumo('PRJ-001', 1250000, 'Factura de octubre');
select pg_temp.ok((select (substr(datos,4)::jsonb->>'gastado')::numeric from public.registros_v where id='PRJ-001') = 1250000, 'guarda el consumo');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%[Misión del mes · Presupuesto] Consumido 500.000 → 1.250.000 de 2.000.000. Factura de octubre%') = 1, 'bitácora con la marca de la misión y los números formateados');
select pg_temp.falla($$select public.apih_registrar_consumo('PRJ-001', -5)$$, 'consumo negativo', '%mayor o igual a 0%');
select public.apih_confirmar_consumo('PRJ-001');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Bitacora' and datos like '%Consumo confirmado sin cambios (1.250.000 de 2.000.000)%') = 1, 'confirma sin cambios');
select pg_temp.como('otro@test.cl');
select pg_temp.falla($$select public.apih_registrar_consumo('PRJ-001', 10)$$, 'quien no ve montos no los registra', '%no registra montos%');
-- documentos
select pg_temp.como('col@test.cl');
select public.apih_guardar_documento('PRJ-001', null, '{"nombre":"Acta 1","tipo":"Acta","url":"https://aramark.sharepoint.com/sites/x/acta.pdf","nota":"ok"}'::jsonb);
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Documentos' and substr(datos,4)::jsonb->>'autor' = 'Cora Colabora' and substr(datos,4)::jsonb->>'correo' = 'col@test.cl') = 1, 'agrega el documento con autor');
select pg_temp.falla($$select public.apih_guardar_documento('PRJ-001', null, '{"nombre":"Malo","url":"https://evil.com/x"}'::jsonb)$$, 'vínculo no permitido', '%OneDrive o SharePoint%');
select pg_temp.falla($$select public.apih_guardar_documento('PRJ-001', null, '{"nombre":"Malo","url":"http://x.sharepoint.com/x"}'::jsonb)$$, 'solo https', '%OneDrive o SharePoint%');
select pg_temp.falla($$select public.apih_guardar_documento('PRJ-001', null, '{"nombre":"","url":"https://x.sharepoint.com/x"}'::jsonb)$$, 'sin nombre', '%ponle un nombre%');
create temp table dd as select id from public.registros_v where lista='APIH_Documentos';
grant select on dd to authenticated;
select public.apih_guardar_documento(null, (select id from dd), '{"nombre":"Acta 1 v2","tipo":"Informe","url":"https://1drv.ms/b/s!abc"}'::jsonb);
select pg_temp.ok((select substr(datos,4)::jsonb->>'nombre' from public.registros_v where lista='APIH_Documentos') = 'Acta 1 v2', 'el autor lo edita');
select pg_temp.como('otro@test.cl');
select pg_temp.falla($$select public.apih_quitar_documento((select id from dd))$$, 'otra persona no lo quita', '%quien lo agregó%');
select pg_temp.como('adm@test.cl');
select public.apih_quitar_documento((select id from dd));
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Documentos') = 0, 'Administra lo quita');
commit;
