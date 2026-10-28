-- Iter 4a: línea base, escalación de decisiones y estrellas Michelin las decide el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.q(p_lista text, p_id text) returns jsonb language sql security definer as $$ select substr(datos, 4)::jsonb from public.registros where lista = p_lista and id = p_id $$;
create or replace function pg_temp.nbit(p text) returns int language sql security definer as $$ select count(*)::int from public.registros where lista = 'APIH_Bitacora' and datos like p $$;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28"}') on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
 ('APIH_Proyectos','PRJ-M1','p1.{"tipo":"Proyecto","titulo":"Con estrella","area":"BISE","fase":"Ejecución","estado":"En curso","inicioPlan":"2026-09-01","finPlan":"2026-12-31","presupuesto":500}'),
 ('APIH_Hitos','HIT-M1','p1.{"ini":"PRJ-M1","nombre":"H1","fase":"Planificación","fecha":"2026-09-10","completado":true,"fechaReal":"2026-09-09"}'),
 ('APIH_Hitos','HIT-M2','p1.{"ini":"PRJ-M1","nombre":"H2","fase":"Ejecución","fecha":"2026-12-01","completado":false}'),
 ('APIH_Decisiones','DEC-M1','p1.{"ini":"PRJ-M1","titulo":"Vieja","estado":"Pendiente","limite":"2026-10-01"}'),
 ('APIH_Decisiones','DEC-M2','p1.{"ini":"PRJ-M1","titulo":"Reciente","estado":"Pendiente","limite":"2026-10-25"}')
 on conflict (lista,id) do nothing;
create temp table res(j jsonb);
grant all on res to authenticated;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
insert into res select public.apih_mantener();
select pg_temp.ok((select j->>'escaladas' from res) = '1', 'marca solo la decisión que supera el plazo de escalamiento');
select pg_temp.ok(pg_temp.q('APIH_Decisiones','DEC-M1')->>'escalada' = '2026-10-28' and pg_temp.q('APIH_Decisiones','DEC-M2')->>'escalada' is null, 'la escalada queda marcada con la fecha; la reciente no');
select pg_temp.ok(jsonb_array_length(pg_temp.q('APIH_Proyectos','PRJ-M1')->'michelin') >= 1, 'otorga la primera estrella (primera fase cerrada a tiempo)');
delete from res; insert into res select public.apih_mantener();
select pg_temp.ok((select j->>'escaladas' from res) = '0' and (select j->'estrellas' from res) = '[]'::jsonb, 'es idempotente: no repite marcas ni estrellas');
select pg_temp.ok(pg_temp.nbit('%Decisión escalada%') = 1, 'deja una sola entrada de bitácora por escalamiento');
delete from res; insert into res select public.apih_congelar_base('PRJ-M1');
select pg_temp.ok((select j->>'fin' from res) = '2026-12-31' and jsonb_array_length(pg_temp.q('APIH_Proyectos','PRJ-M1')->'base'->'hitos') = 2, 'congela la línea base con las fechas y los hitos vigentes');
do $$ begin begin perform public.apih_congelar_base('PRJ-M1'); raise exception 'no debía congelar de nuevo'; exception when sqlstate '22023' then null; end; end $$;
select pg_temp.ok(true, 'congelar de nuevo sin reemplazo se rechaza');
select pg_temp.ok((select public.apih_congelar_base('PRJ-M1', true)->>'fecha') = '2026-10-28' and jsonb_array_length(pg_temp.q('APIH_Proyectos','PRJ-M1')->'baseHist') = 1, 'el administrador reemplaza y la anterior queda en el historial');
rollback;
begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
do $$ begin begin perform public.apih_congelar_base('PRJ-M1'); raise exception 'colaborador congeló fuera de su área'; exception when sqlstate '42501' then null; end; end $$;
select pg_temp.ok(true, 'un colaborador sin permiso sobre el área no congela la línea base');
insert into res select public.apih_mantener();
select pg_temp.ok((select j->>'escaladas' from res) = '0', 'la escalación de decisiones la marca solo el administrador');
rollback;
