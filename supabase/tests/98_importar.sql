-- Iter 3c: la importación de iniciativas la hace el servidor (depuración, fechas de fase, subfases, referencias)
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.q(p_lista text, p_id text) returns jsonb language sql security definer as $$ select substr(datos, 4)::jsonb from public.registros where lista = p_lista and id = p_id $$;
create or replace function pg_temp.hs(p_ini text) returns int language sql security definer as $$ select count(*)::int from public.registros where lista = 'APIH_Hitos' and substr(datos, 4)::jsonb ->> 'ini' = p_ini and substr(datos, 4)::jsonb ? 'subfase' $$;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}') on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values ('APIH_Proyectos','PRJ-900','p1.{"tipo":"Proyecto","titulo":"Ya existe","area":"A","fase":"Planificación","estado":"En curso"}') on conflict (lista,id) do nothing;

create temp table res(j jsonb);
grant all on res to authenticated;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
insert into res select public.apih_importar_iniciativas('[
  {"tipo":"Proyecto","titulo":"Importado uno","area":"BISE","lider":"Ana","fase":"Ejecución","avance":40,"inicioPlan":"2026-09-01","finPlan":"2026-12-31","presupuesto":1000,"campoRaro":"x",
   "hitos":[{"nombre":"H1","fase":"Planificación","fecha":"2026-09-10","completado":true},{"nombre":"H2","fase":"Ejecución","dias":60,"subfase":"Piloto"},{"nombre":"H3","fase":"Ejecución","fecha":"2026-10-20","subfase":"Fantasma"},{"nombre":"H4","fase":"Transición","subfase":"Piloto"}],
   "subfases":[{"nombre":"Piloto","fase":"Ejecución"},{"nombre":"Fuera","fase":"Ejecución","fin":"2030-01-01"},{"nombre":"Mala","fase":"NoExiste"}],
   "riesgos":[{"desc":"Riesgo A","prob":4,"imp":5},{"desc":""}],
   "faseNota":{"Ejecución":"nota"}},
  {"tipo":"Proyecto","titulo":"ya EXISTE","area":"A"},
  {"tipo":"Propuesta","titulo":"Propuesta importada","area":"BISE","finPlan":"2027-01-31"},
  {"titulo":"   "}
]'::jsonb);
select pg_temp.ok(jsonb_array_length((select j from res)->'creadas') = 2, 'crea las iniciativas válidas (2)');
select pg_temp.ok((select j from res)->'omitidas' = '["ya EXISTE", "(sin título)"]'::jsonb, 'omite la repetida (sin distinguir mayúsculas) y la sin título');
select pg_temp.ok((select j from res)->>'hitos' = '4' and (select j from res)->>'riesgos' = '1', 'cuenta 4 hitos y 1 riesgo válido');
rollback;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
insert into res select public.apih_importar_iniciativas('[
  {"tipo":"Proyecto","titulo":"Importado uno","area":"BISE","lider":"Ana","fase":"Ejecución","avance":40,"inicioPlan":"2026-09-01","finPlan":"2026-12-31","campoRaro":"x",
   "hitos":[{"nombre":"H1","fase":"Planificación","fecha":"2026-09-10","completado":true},{"nombre":"H2","fase":"Ejecución","dias":60,"subfase":"Piloto"},{"nombre":"H3","fase":"Ejecución","fecha":"2026-10-20","subfase":"Fantasma"},{"nombre":"H4","fase":"Transición","subfase":"Piloto"}],
   "subfases":[{"nombre":"Piloto","fase":"Ejecución"},{"nombre":"Fuera","fase":"Ejecución","fin":"2030-01-01"},{"nombre":"Mala","fase":"NoExiste"}],
   "riesgos":[{"desc":"Riesgo A","prob":4,"imp":5},{"desc":""}],
   "faseNota":{"Ejecución":"nota"}}]'::jsonb);
select pg_temp.ok(pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->>'campoRaro' is null, 'los campos que no están en la lista permitida se descartan');
select pg_temp.ok(pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->'fasesFechas'->'Cierre'->>'fin' = '2026-12-31', 'las fechas de fase nacen explícitas, repartidas por el servidor');
select pg_temp.ok(jsonb_array_length(pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->'subfases') = 1, 'queda 1 subfase válida (las otras 2 generan aviso)');
select pg_temp.ok((select jsonb_array_length(j->'avisos') from res) = 4, '4 avisos: subfase fuera de fase, fase inexistente, hito con subfase inexistente y hito de otra fase');
select pg_temp.ok((select j->'avisos'->>0 from res) like '%Fuera%debe quedar dentro de Ejecución%', 'el aviso de la subfase fuera de la fase dice la ventana');
select pg_temp.ok(pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->'subfases'->0->>'inicio' = pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->'fasesFechas'->'Ejecución'->>'ini', 'la subfase hereda las fechas de su fase');
select pg_temp.ok((pg_temp.q('APIH_Proyectos', (select j->'creadas'->0->>'id' from res))->>'avance')::int = 40, 'el avance del archivo queda como ajuste (lo decide el servidor)');
select pg_temp.ok(pg_temp.hs((select j->'creadas'->0->>'id' from res)) = 1, 'solo un hito queda enlazado a la subfase');
rollback;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
create temp table res2(j jsonb); grant all on res2 to authenticated;
insert into res2 select public.apih_importar_iniciativas('[{"titulo":"Mala RAG","rag":"Amarillo","area":"BISE","hitos":[{"nombre":"h"}]},{"titulo":"Buena","area":"BISE"}]'::jsonb);
select pg_temp.ok(jsonb_array_length((select j from res2)->'creadas') = 1 and (select j from res2)->'creadas'->0->>'titulo' = 'Buena', 'una iniciativa inválida no frena a las demás');
select pg_temp.ok((select j->'avisos'->>0 from res2) like 'Mala RAG: no se importó — RAG inválido%' and (select j->>'hitos' from res2) = '0', 'el motivo queda como aviso y se deshace solo esa iniciativa (sus hitos incluidos)');
rollback;
begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
do $$ begin
  begin perform public.apih_importar_iniciativas('[{"titulo":"X"}]'::jsonb); raise exception 'FALLA: un colaborador importó';
  exception when sqlstate '42501' then raise notice 'ok  solo el administrador puede importar'; end;
end $$;
rollback;
select 'PRUEBAS DE IMPORTACION OK';
