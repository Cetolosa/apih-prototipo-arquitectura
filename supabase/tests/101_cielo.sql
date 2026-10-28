-- Iter 4c: tenedores, racha, nivel e insignias de «Mi cocina» los calcula el servidor
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"hoyFija":"2026-10-28","tolDesv":5}') on conflict (lista,id) do update set datos = excluded.datos;
insert into public.registros(lista,id,datos) values
 ('APIH_Proyectos','PRJ-C1','p1.{"tipo":"Proyecto","titulo":"Al día","area":"BISE","lider":"Christian Tolosa","fase":"Ejecución","estado":"En curso","avance":40,"creada":"2026-01-01","inicioPlan":"2026-01-01","finPlan":"2027-06-30","hist":[["2026-10-10",20],["2026-10-26",40]]}'),
 ('APIH_Proyectos','PRJ-C2','p1.{"tipo":"Proyecto","titulo":"Con hito vencido","area":"BISE","lider":"Christian Tolosa","fase":"Ejecución","estado":"En curso","avance":10,"creada":"2026-01-01","inicioPlan":"2026-01-01","finPlan":"2027-06-30","hist":[["2026-10-10",10]],"actualizada":"2026-10-27"}'),
 ('APIH_Proyectos','PRJ-C3','p1.{"tipo":"Proyecto","titulo":"Terminado","area":"BISE","lider":"Christian Tolosa","fase":"Cierre","estado":"Completado","avance":100,"creada":"2026-01-01"}'),
 ('APIH_Bitacora','BIT-C1','p1.{"id":"BIT-C1","ini":"PRJ-C1","tipo":"Actualización","ts":"2026-10-27T10:00","texto":"Actualización semanal: avance","autor":"Christian Tolosa"}'),
 ('APIH_Hitos','HIT-C1','p1.{"id":"HIT-C1","ini":"PRJ-C2","nombre":"Vencido","fase":"Ejecución","fecha":"2026-10-01","completado":false}'),
 ('APIH_Riesgos','RSK-C1','p1.{"id":"RSK-C1","ini":"PRJ-C2","desc":"x","prob":2,"imp":2,"estado":"Abierto","fRev":"2026-10-20"}')
 on conflict (lista,id) do nothing;
create temp table res(j jsonb);
grant all on res to authenticated;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
insert into res select public.apih_cielo();
select pg_temp.ok((select j->>'W' from res) = '2026-10-26', 'la semana es la que parte el lunes 26 de octubre');
select pg_temp.ok((select j->'proy'->'PRJ-C1'->'st'->>'dia' from res) = 'on' and (select j->'proy'->'PRJ-C1'->>'lleno' from res) = 'true', 'proyecto actualizado esta semana: «Al día» encendido y mesa llena');
select pg_temp.ok((select j->'proy'->'PRJ-C1'->'st'->>'hit' from res) = 'na' and (select j->'proy'->'PRJ-C1'->'st'->>'rsk' from res) = 'na', 'sin hitos ni riesgos: «no aplica»');
select pg_temp.ok((select j->'proy'->'PRJ-C2'->'st'->>'hit' from res) = 'off', 'hito vencido sin explicar apaga «Hitos»');
select pg_temp.ok((select j->'proy'->'PRJ-C2'->'st'->>'rsk' from res) = 'off', 'revisión de riesgo vencida apaga «Riesgos»');
select pg_temp.ok((select j->'proy'->'PRJ-C2'->'st'->>'dia' from res) = 'on', 'la fecha de actualización de la ficha cuenta como «Al día»');
select pg_temp.ok((select j->'proy'->'PRJ-C2'->>'lleno' from res) = 'false', 'la mesa no está llena con tenedores apagados');
select pg_temp.ok(not (select j->'proy' from res) ? 'PRJ-C3', 'un proyecto completado no entra a la cocina de esta semana');
select pg_temp.ok((select j->'impecables'->>'PRJ-C3' from res) = 'true', 'cierre impecable: completado al 100 %, sin hitos pendientes ni riesgos abiertos');
select pg_temp.ok(jsonb_array_length((select j->'hist'->'PRJ-C1' from res)) = 8, 'serie de 8 semanas para el cielo colectivo');
select pg_temp.ok((select j->'personas'->'Christian Tolosa'->>'nivel' from res) in ('Pinche','Cocinero','Chef de partida','Chef ejecutivo'), 'nivel de la persona calculado por el servidor');
select pg_temp.ok((select j->'yo'->'insignias'->'eq'->>'of' from res) = '1' and (select j->'yo'->>'meta' from res) = '80', 'meta del equipo por defecto 80 %');
select pg_temp.ok((select j->'yo'->'insignias'->'cu'->>'of' from res) = '10', 'las insignias traen su avance y su meta');
rollback;
begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
insert into res select public.apih_cielo();
select pg_temp.ok(not exists (select 1 from res, jsonb_object_keys(res.j->'proy') k where k like 'PRJ-C%'), 'un colaborador de otra área no recibe tenedores de proyectos que no ve');
rollback;
