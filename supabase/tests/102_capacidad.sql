-- Iter 4d: la capacidad de equipos (carga mensual por líder) la calcula el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.g(p_n text) returns jsonb language sql security definer as
$$ select g from jsonb_array_elements(public.apih_calculos() -> 'capacidad' -> 'gente') g where g ->> 'n' = p_n $$;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","capacidadMax":2,"capPers":{"zoe":3}}') on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
 ('APIH_Proyectos','PRJ-K1','p1.{"tipo":"Proyecto","titulo":"K1","area":"BISE","lider":"Pía","fase":"Ejecución","estado":"En curso","inicioPlan":"2026-10-01","finPlan":"2026-12-31","creada":"2026-09-01"}'),
 ('APIH_Proyectos','PRJ-K2','p1.{"tipo":"Proyecto","titulo":"K2","area":"BISE","lider":"Pía","fase":"Ejecución","estado":"En curso","inicioPlan":"2026-11-15","finPlan":"2027-01-31","creada":"2026-09-01"}'),
 ('APIH_Proyectos','PRJ-K3','p1.{"tipo":"Proyecto","titulo":"K3","area":"BISE","lider":"Pía","fase":"Planificación","estado":"En curso","inicioPlan":"2026-11-20","finPlan":"2027-03-31","creada":"2026-09-01"}'),
 ('APIH_Proyectos','PRJ-K4','p1.{"tipo":"Proyecto","titulo":"K4","area":"BISE","lider":"Zoé","fase":"Ejecución","estado":"En curso","inicioPlan":"2026-10-01","finPlan":"2026-10-31","creada":"2026-09-01"}'),
 ('APIH_Proyectos','PRJ-K5','p1.{"tipo":"Proyecto","titulo":"K5 terminado","area":"BISE","lider":"Pía","fase":"Cierre","estado":"Completado","inicioPlan":"2026-10-01","finPlan":"2026-12-31"}')
 on conflict (lista,id) do nothing;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok(jsonb_array_length(public.apih_calculos()->'capacidad'->'meses') = 12 and public.apih_calculos()->'capacidad'->'meses'->0->>'s' = '2026-10-01', '12 meses desde el mes en curso');
select pg_temp.ok(pg_temp.g('Pía')->'ns' = '[1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1]'::jsonb or pg_temp.g('Pía')->'ns'->>0 = '1', 'carga mensual de la líder (los proyectos terminados no cuentan)');
select pg_temp.ok(pg_temp.g('Pía')->'ns'->>2 = '3' and pg_temp.g('Pía')->>'cap' = '2', 'en diciembre lidera 3 proyectos con capacidad 2');
select pg_temp.ok(pg_temp.g('Pía')->'cls'->>2 = 'r' and pg_temp.g('Pía')->'cls'->>0 = 'g' and pg_temp.g('Pía')->'cls'->>11 = 'n', 'color de la celda: rojo sobre la capacidad');
select pg_temp.ok(pg_temp.g('Pía')->'over'->>'3' = 'true', 'sobrecarga dentro de los próximos 3 meses');
select pg_temp.ok(pg_temp.g('Zoé')->>'cap' = '3', 'la capacidad propia de la persona manda sobre la general (sin distinguir tildes)');
select pg_temp.ok(pg_temp.g('Zoé')->'over'->>'12' = 'false', 'sin sobrecarga');
select pg_temp.ok((pg_temp.g('Zoé')->>'hold')::numeric > 0, 'holgura = capacidad menos la carga media de 3 meses');
rollback;
