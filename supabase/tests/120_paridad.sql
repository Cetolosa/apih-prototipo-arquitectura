-- Paridad con el Corporativo: defaults, trabajo, notas, presentaciones, metodología e «importar proyecto»
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(q text, m text, patron text) returns void language plpgsql as
$$ begin begin execute q; exception when others then if sqlerrm like patron then raise notice 'ok  %', m; return; end if; raise exception 'FALLA: % (error inesperado: %)', m, sqlerrm; end; raise exception 'FALLA: % (no falló)', m; end $$;
delete from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Hitos','APIH_Riesgos','APIH_Bitacora','APIH_Notas','APIH_Decisiones','APIH_Compromisos');
delete from public.registros where lista = 'APIH_Config' and id like 'cfg%';
delete from public.perfiles where email in ('adm@test.cl','col@test.cl','otro@test.cl');
insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_montos) values ('adm@test.cl','Ada Administra','admin','Administra','{}',true),('col@test.cl','Cora Colabora','editor','Colaborador','{A}',true),('otro@test.cl','Omar Otro','editor','Colaborador','{B}',false);
insert into public.registros(lista, id, datos) values
 ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}'),
 ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"Uno","area":"A","tipo":"Proyecto","fase":"Ejecución","estado":"En curso","rag":"Verde","lider":"Cora Colabora","presupuesto":1000,"gastado":900,"avance":20,"inicioPlan":"2026-10-01","finPlan":"2027-03-31","actualizada":"2026-09-01"}'),
 ('APIH_Hitos','HIT-001','p1.{"id":"HIT-001","ini":"PRJ-001","nombre":"Plan","fase":"Ejecución","fecha":"2026-10-20","completado":false,"resp":"Cora Colabora"}'),
 ('APIH_Riesgos','RSK-001','p1.{"id":"RSK-001","ini":"PRJ-001","desc":"Proveedor","cat":"Proveedor","prob":5,"imp":4,"estado":"Abierto","dueno":"Cora Colabora","mit":"","fRev":"2026-10-30"}');
begin; set local role authenticated;
-- defaults
select pg_temp.ok((public.apih_defaults() ->> 'umbralCritico')::int = 15 and (select count(*) from jsonb_object_keys(public.apih_defaults())) = 10, 'apih_defaults: 10 parámetros, una sola definición');
-- trabajo
select pg_temp.como('col@test.cl');
select pg_temp.ok((public.apih_trabajo() -> 'senales' -> 'PRJ-001')::text like all (array['%1 hito vencido:%', '%Plan (8 d).%']), 'señal de hito vencido');
select pg_temp.ok((public.apih_trabajo() -> 'senales' -> 'PRJ-001')::text like '%riesgo crítico sin mitigación%', 'señal de riesgo crítico sin mitigación');
select pg_temp.ok((public.apih_trabajo() -> 'senales' -> 'PRJ-001')::text like '%Gasto 90 %%', 'señal de gasto');
select pg_temp.ok((select count(*) from jsonb_array_elements(public.apih_trabajo() -> 'trabajo') e where e ->> 'k' in ('hito','risk','upd')) = 3, 'mi trabajo: hito, riesgo y actualización');
-- notas
select pg_temp.ok((public.apih_nota_guardar(null, '{"texto":"hola","area":"A"}'::jsonb) ->> 'id') like 'NOT-%', 'comentario con id del servidor');
select pg_temp.falla($$select public.apih_nota_guardar(null, '{"texto":"x","tipo":"interna","ini":"PRJ-001"}'::jsonb)$$, 'nota interna solo PMO', '%del PMO%');
select pg_temp.como('adm@test.cl');
select public.apih_nota_guardar(null, '{"texto":"interna","tipo":"interna","ini":"PRJ-001"}'::jsonb);
select public.apih_nota_estado((select id from public.registros_v where lista='APIH_Notas' and datos like '%"hola"%'), 'Abordado');
select pg_temp.ok((select substr(datos,4)::jsonb->>'por' from public.registros_v where lista='APIH_Notas' and datos like '%"hola"%') = 'Ada Administra', 'abordar registra quién');
select pg_temp.ok((public.apih_nota_visto((select jsonb_agg(id) from public.registros_v where lista='APIH_Notas'), true) ->> 'n')::int = 2, 'marcar vistas');
select public.apih_nota_eliminar((select id from public.registros_v where lista='APIH_Notas' and datos like '%interna%' limit 1));
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Notas') = 1, 'eliminar nota');
-- presentaciones
select pg_temp.ok((public.apih_pres_evaluar('{}'::jsonb, '[{"k":"hito","id":"HIT-001"},{"k":"rsk","id":"RSK-001"}]'::jsonb) -> 'items' -> 'hito:HIT-001' ->> 'why') = 'Vencido hace 8 d', 'regla de hitos');
select pg_temp.ok((public.apih_pres_evaluar('{"riesgoMin":25}'::jsonb, '[{"k":"rsk","id":"RSK-001"}]'::jsonb) -> 'items' -> 'rsk:RSK-001' ->> 'ok') = 'false', 'regla de riesgos con umbral propio');
select public.apih_pres_marcar('[{"k":"prj","id":"PRJ-001","incluir":false}]'::jsonb);
select pg_temp.ok((select substr(datos,4)::jsonb->>'inPres' from public.registros_v where id='PRJ-001') = 'false', 'marcar fuera de la presentación');
select pg_temp.ok((public.apih_pres_aplicar_reglas('{"riesgoMin":25}'::jsonb, '[{"k":"rsk","id":"RSK-001"},{"k":"prj","id":"PRJ-001"}]'::jsonb) ->> 'fuera')::int = 1, 'aplicar reglas');
-- metodología (Administra primero cambia cfg.metodo; el comando arrastra los registros)
reset role;
update public.registros set datos = 'p1.{"hoyFija":"2026-10-28","metodo":{"fasesPrj":["Planificación","Construcción","Transición","Cierre"]}}' where lista = 'APIH_Config' and id = 'cfg';
set local role authenticated; select pg_temp.como('adm@test.cl');
select pg_temp.ok((public.apih_fase_cascada('renombrar', 'Ejecución', 'Construcción') ->> 'hitos')::int = 1, 'renombrar fase arrastra hitos');
select pg_temp.ok((select substr(datos,4)::jsonb->>'fase' from public.registros_v where id='PRJ-001') = 'Construcción', 'renombrar fase arrastra iniciativas');
reset role;
update public.registros set datos = 'p1.{"hoyFija":"2026-10-28"}' where lista = 'APIH_Config' and id = 'cfg';
set local role authenticated; select pg_temp.como('adm@test.cl');
select public.apih_fase_cascada('renombrar', 'Construcción', 'Ejecución');
select pg_temp.como('col@test.cl');
select pg_temp.falla($$select public.apih_fase_cascada('restablecer', '', null)$$, 'metodología solo Administra', '%solo Administra%');
-- importar proyecto
select pg_temp.ok((public.apih_importar_proyecto('PRJ-001', to_jsonb('```json' || chr(10) || '{"formato":"apih-proyecto-archivo","proyecto_id":"PRJ-001","proyecto":{"logros":"ok","raro":1},"hitos":[{"id":"HIT-001","fecha":"2026-11-12","cat":"Inventada"},{"nombre":"Piloto","fecha":"2027-01-15"},{"id":"HIT-999"}],"riesgos":[{"desc":"Crit","prob":5,"imp":5},{"desc":"Bajo","prob":2,"imp":2,"mit":"m"}]}' || chr(10) || '```'), true) -> 'omitidos')::text
  like all (array['%raro%', '%HIT-999 no pertenece%', '%categoría de hito inválida (Inventada)%', '%requiere plan de mitigación%']), 'vista previa: omitidos con las reglas del servidor');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Hitos') = 1 and (select substr(datos,4)::jsonb->>'logros' from public.registros_v where id='PRJ-001') is null, 'la vista previa no guarda nada');
select pg_temp.ok((public.apih_importar_proyecto('PRJ-001', '{"formato":"apih-proyecto-archivo","proyecto_id":"PRJ-001","proyecto":{"logros":"ok"},"hitos":[{"nombre":"Piloto","fecha":"2027-01-15"}],"riesgos":[{"desc":"Bajo","prob":2,"imp":2,"mit":"m"}]}'::jsonb, false) ->> 'ok')::int = 3, 'aplicar');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Hitos') = 2 and (select substr(datos,4)::jsonb->>'logros' from public.registros_v where id='PRJ-001') = 'ok', 'aplicar guarda');
select pg_temp.ok((public.apih_importar_proyecto('PRJ-001', '{"formato":"apih-proyecto-archivo","proyecto_id":"PRJ-001","proyecto":{"finPlan":"2026-01-01"}}'::jsonb, false) ->> 'bloqueo') like 'finPlan%', 'fechas plan invertidas bloquean');
select pg_temp.falla($$select public.apih_importar_proyecto('PRJ-001', '{"formato":"x","proyecto_id":"PRJ-001"}'::jsonb)$$, 'formato inválido', '%apih-proyecto-archivo%');
select pg_temp.como('otro@test.cl');
select pg_temp.falla($$select public.apih_importar_proyecto('PRJ-001', '{"formato":"apih-proyecto-archivo","proyecto_id":"PRJ-001"}'::jsonb)$$, 'otra área no importa', '%sin permiso%');
rollback;
