-- J1 · importancia con ajuste propio, pendientes personales y escritura de la configuración: todo en el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Bitacora');
delete from public.registros where lista = 'APIH_Config';
delete from public.perfiles where email in ('adm@test.cl','col@test.cl','otro@test.cl');
insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_montos) values ('adm@test.cl','Ada Administra','admin','Administra','{}',true),('col@test.cl','Cora Colabora','editor','Colaborador','{A}',true),('otro@test.cl','Otto Lector','lector','Invitado','{A}',false);
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Cora Colabora","deps":[]}'),
 ('APIH_Hitos','HIT-001','p1.{"id":"HIT-001","ini":"PRJ-001","nombre":"Entrega","fase":"Ejecución","fecha":"2026-10-20","completado":false}');
-- importancia base: plazo y criticidad
select pg_temp.ok(public.apih_imp_base(0, '2026-10-20', 'Hito vencido', date '2026-10-28') = 100, 'base: vencido hace 8 d, urgencia hoy, vencido (+10)');
select pg_temp.ok(public.apih_imp_base(1, '2026-11-01', 'Hito', date '2026-10-28') = 53, 'base: faltan 4 d (bonus 3) en la semana');
select pg_temp.ok(public.apih_imp_base(2, null, 'Personal', date '2026-10-28') = 32, 'base: sin fecha');
select pg_temp.ok(public.apih_aj_de('{"a":15,"b":7,"c":-20}'::jsonb, 'a') = 15 and public.apih_aj_de('{"b":7}'::jsonb, 'b') = 0 and public.apih_aj_de('{"c":-20}'::jsonb, 'c') = -20, 'un ajuste que no es de la lista vale 0');
begin; set local role authenticated;
select pg_temp.como('col@test.cl');
-- ajuste propio
select public.apih_ajustar_paso('PRJ-001:hhHIT-X', 15);
select pg_temp.falla($$select public.apih_ajustar_paso('PRJ-001:hhHIT-X', 7)$$, 'ajuste fuera de la lista', '%debe ser Baja%');
select pg_temp.falla($$select public.apih_ajustar_paso('', 15)$$, 'paso sin nombre', '%paso no válido%');
select pg_temp.ok((select substr(datos,4)::jsonb #>> '{v,sem,aj,PRJ-001:hhHIT-X}' from public.registros_v where id = 'cfgU:col@test.cl') = '15', 'el ajuste queda en el perfil de quien llama');
select public.apih_ajustar_paso('PRJ-001:hhHIT-X', 0);
select pg_temp.ok((select substr(datos,4)::jsonb #> '{v,sem,aj}' from public.registros_v where id = 'cfgU:col@test.cl') = '{}'::jsonb, 'ajuste 0 lo quita');
select pg_temp.como('otro@test.cl');
select pg_temp.falla($$select public.apih_ajustar_paso('PRJ-001:hhHIT-X', 15)$$, 'un invitado no ajusta', '%sin permiso%');
-- pendientes personales
select pg_temp.como('col@test.cl');
select public.apih_guardar_tarea('{"t":"Pagar curso","cat":"Desarrollo profesional","f":"2026-10-30"}'::jsonb);
select public.apih_guardar_tarea('{"t":"Llamar a proveedor","cat":"rara"}'::jsonb);
create temp table cie as select public.apih_cielo() j;
grant select on cie to authenticated;
select pg_temp.ok((select jsonb_array_length(j -> 'tareas') from cie) = 2, 'dos pendientes personales');
select pg_temp.ok((select (j -> 'tareas' -> 0 ->> 'k') = 'T:T-1' and (j -> 'tareas' -> 0 ->> 'u') = '1' and (j -> 'tareas' -> 0 ->> 'por') = 'Fecha: 30-10.' from cie), 'con fecha: esta semana');
select pg_temp.ok((select (j -> 'tareas' -> 1 ->> 'tipo') = 'Trabajo' and (j -> 'tareas' -> 1 ->> 'f') = '9999-12-31' and (j -> 'tareas' -> 1 ->> 'por') = 'Sin fecha.' from cie), 'la clasificación desconocida pasa a Trabajo; sin fecha va al final');
select pg_temp.ok((select (j -> 'tareas' -> 0 ->> 'pts')::int = (j -> 'tareas' -> 0 ->> 'base')::int + (j -> 'tareas' -> 0 ->> 'aj')::int from cie), 'puntaje = base + ajuste');
select pg_temp.ok((select (j -> 'pasos' -> 'PRJ-001' -> 0 ->> 'base') is not null and (j -> 'pasos' -> 'PRJ-001' -> 0 ->> 'pts') is not null from cie), 'cada paso trae base y puntaje');
select public.apih_ajustar_paso('T:T-2', 30);
select pg_temp.ok((select (x ->> 'aj')::int = 30 and (x ->> 'pts')::int = least(100, (x ->> 'base')::int + 30) from (select jsonb_array_elements(public.apih_cielo() -> 'tareas') x) q where x ->> 'k' = 'T:T-2'), 'el ajuste se suma y se acota a 100');
select public.apih_guardar_tarea('{"id":"T-1","t":"Pagar curso (editado)","cat":"Personal","f":""}'::jsonb);
select pg_temp.ok((select x ->> 't' from (select jsonb_array_elements(public.apih_cielo() -> 'tareas') x) q where x ->> 'k' = 'T:T-1') = 'Pagar curso (editado)', 'edita por id');
select pg_temp.falla($$select public.apih_guardar_tarea('{"t":""}'::jsonb)$$, 'pendiente vacío', '%escribe qué necesitas%');
select pg_temp.falla($$select public.apih_guardar_tarea(jsonb_build_object('t', repeat('x', 201)))$$, 'más de 200 caracteres', '%hasta 200 caracteres%');
select pg_temp.falla($$select public.apih_guardar_tarea('{"t":"a","f":"2026-13-45"}'::jsonb)$$, 'fecha imposible', '%fecha no es válida%');
select pg_temp.falla($$select public.apih_guardar_tarea('{"t":"a","f":"1800-01-01"}'::jsonb)$$, 'fecha fuera de rango', '%fecha no es válida%');
select pg_temp.falla($$select public.apih_guardar_tarea('{"id":"T-99","t":"a"}'::jsonb)$$, 'editar uno que no existe', '%no existe%');
select public.apih_tarea_estado('T-1', 'hecha');
select pg_temp.ok((select jsonb_array_length(public.apih_cielo() -> 'tareas')) = 1, 'un pendiente hecho sale de la lista');
select public.apih_tarea_estado('T-2', 'eliminar');
select pg_temp.ok((select jsonb_array_length(public.apih_cielo() -> 'tareas')) = 0, 'eliminar lo quita');
select pg_temp.falla($$select public.apih_tarea_estado('T-2', 'borrar')$$, 'acción desconocida', '%acción no válida%');
select pg_temp.falla($$select public.apih_tarea_estado('T-77', 'hecha')$$, 'pendiente inexistente', '%no existe%');
-- configuración: única vía
select pg_temp.falla($$insert into public.registros(lista, id, datos) values ('APIH_Config', 'eventos', 'p1.[]')$$, 'insertar APIH_Config por la tabla', '%row-level security%');
update public.registros set datos = 'p1.{"hoyFija":"2030-01-01"}' where lista = 'APIH_Config' and id = 'cfg';
select pg_temp.ok((select count(*) from public.registros_v where id = 'cfg' and datos like '%2030%') = 0, 'actualizar APIH_Config por la tabla no cambia nada');
select public.apih_guardar_ajuste('eventos', '[{"id":"E1","f":"2026-11-02","t":"Comité"}]'::jsonb);
select pg_temp.ok((select count(*) from public.registros_v where id = 'eventos' and datos like '%Comité%') = 1, 'colaborador guarda eventos por el comando');
select pg_temp.falla($$select public.apih_guardar_ajuste('cfg', '{"umbralCritico":15}'::jsonb)$$, 'parámetros de la organización: solo quien gobierna', '%sin permiso%');
select pg_temp.falla($$select public.apih_guardar_ajuste('cfgU:adm@test.cl', '{"n":"Ada","v":{}}'::jsonb)$$, 'preferencias de otra persona', '%sin permiso%');
select pg_temp.falla($$select public.apih_guardar_ajuste('roles', '{}'::jsonb)$$, 'clave desconocida', '%clave de configuración no válida%');
select pg_temp.falla($$select public.apih_guardar_ajuste('eventos', '"texto"'::jsonb)$$, 'forma incorrecta', '%lista o un objeto%');
select pg_temp.falla($$select public.apih_guardar_ajuste('pres', repeat('1', 5)::jsonb)$$, 'valor que no es lista ni objeto', '%lista o un objeto%');
select pg_temp.como('adm@test.cl');
select pg_temp.falla($$select public.apih_guardar_ajuste('cfg', '{"umbralCritico":99}'::jsonb)$$, 'umbral fuera de rango', '%entre 1 y 25%');
select pg_temp.falla($$select public.apih_guardar_ajuste('cfg', '{"tolDesv":"mucho"}'::jsonb)$$, 'parámetro que no es número', '%entre 0 y 365%');
select pg_temp.falla($$select public.apih_guardar_ajuste('cfg', '{"areas":"A"}'::jsonb)$$, 'áreas que no son lista', '%debe ser una lista%');
select public.apih_guardar_ajuste('cfg', '{"hoyFija":"2026-10-28","umbralCritico":12,"areas":["A","B"]}'::jsonb);
select pg_temp.ok((select (substr(datos,4)::jsonb ->> 'umbralCritico')::int from public.registros_v where id = 'cfg') = 12, 'el administrador guarda los parámetros');
select pg_temp.falla($$update public.registros set datos = 'p1.{}' where lista = 'APIH_Config' and id = 'cfg'; select 1/(select count(*) from public.registros_v where id='cfg' and datos = 'p1.{}')$$, 'ni el administrador escribe la tabla', '%division by zero%');
commit;
