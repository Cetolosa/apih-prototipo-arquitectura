-- Iter 5d · compromisos por comando: validación con campo, permisos por área, fecha real, bitácora y eliminación
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

delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Bitacora','APIH_Compromisos');
delete from public.registros where lista = 'APIH_Config' and id in ('cfg','seq');
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-010','p1.{"id":"PRJ-010","titulo":"Base","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"L","deps":[]}'),
 ('APIH_Proyectos','PRJ-005','p1.{"id":"PRJ-005","titulo":"Otra área","area":"B","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","lider":"L","deps":[]}');
insert into public.perfiles (email, rol, app_rol, areas) values ('colab-a@test.cl','editor','Colaborador','{"A"}') on conflict do nothing;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"","resp":"Ana","limite":"2026-11-10"}')$$, 'sin texto', '%comprometió%', 'texto');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"","limite":"2026-11-10"}')$$, 'sin responsable', '%responsable%', 'resp');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"Ana"}')$$, 'sin fecha', '%fecha%', 'limite');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"Ana","limite":"10/11/2026"}')$$, 'fecha mal formada', '%inválida%', 'limite');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"Ana","limite":"2026-11-10","ini":"PRJ-005"}')$$, 'iniciativa de otra área', '%sin permiso%');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"Ana","limite":"2026-11-10","ini":"PRJ-999"}')$$, 'iniciativa inexistente', '%no existe%', 'ini');
select pg_temp.falla($$select public.apih_guardar_compromiso(null, '{"texto":"T","resp":"Ana","limite":"2026-11-10","campoInventado":1}')$$, 'campo fuera del catálogo');
select pg_temp.ok((public.apih_guardar_compromiso(null, '{"texto":"Enviar acta","resp":"Ana","limite":"2026-11-10","ini":"PRJ-010","estado":"Cumplido","fechaReal":"2020-01-01","creada":"2020-01-01"}') ->> 'id') = 'ACU-001', 'alta: id del servidor');
select pg_temp.ok(pg_temp.j('APIH_Compromisos','ACU-001') ->> 'estado' = 'Abierto' and pg_temp.j('APIH_Compromisos','ACU-001') ->> 'fechaReal' is null and pg_temp.j('APIH_Compromisos','ACU-001') ->> 'creada' = '2026-10-28' and pg_temp.j('APIH_Compromisos','ACU-001') ->> 'origen' = 'manual', 'alta: estado, fecha real, creación y origen los fija el servidor');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' like 'Compromiso registrado: Enviar acta — Ana, 10-11-2026'), 'alta: bitácora');
select pg_temp.ok((public.apih_guardar_compromiso('ACU-001', '{"estado":"Cumplido"}') ->> 'id') = 'ACU-001' and pg_temp.j('APIH_Compromisos','ACU-001') ->> 'fechaReal' = '2026-10-28' and pg_temp.j('APIH_Compromisos','ACU-001') ->> 'texto' = 'Enviar acta', 'cumplir: fecha real de hoy y conserva el resto');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Compromiso ACU-001 → Cumplido: Enviar acta'), 'cumplir: bitácora');
select public.apih_guardar_compromiso('ACU-001', '{"estado":"Abierto"}');
select pg_temp.ok(pg_temp.j('APIH_Compromisos','ACU-001') ->> 'fechaReal' is null, 'reabrir: sin fecha real');
select pg_temp.ok((public.apih_guardar_compromiso(null, '{"texto":"General","resp":"Ana","limite":"2026-11-12","ini":""}') ->> 'id') = 'ACU-002' and pg_temp.j('APIH_Compromisos','ACU-002') ->> 'ini' is null, 'compromiso general (sin iniciativa)');
select pg_temp.falla($$select public.apih_eliminar('APIH_Compromisos', 'ACU-999')$$, 'eliminar inexistente', '%no existe%');
select pg_temp.ok((public.apih_eliminar('APIH_Compromisos', 'ACU-001') ->> 'id') = 'ACU-001' and pg_temp.j('APIH_Compromisos','ACU-001') is null, 'eliminar');
select pg_temp.ok(exists (select 1 from public.registros_v where lista = 'APIH_Bitacora' and substr(datos, 4)::jsonb ->> 'texto' = 'Compromiso eliminado: Enviar acta'), 'eliminar: bitácora');
commit;
