-- Presentaciones congeladas (psnap:*) con dueño
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.filas(q text) returns int language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
insert into public.registros(lista,id,datos) values ('APIH_Config','psnap:P1','p1.{"slides":["datos del área A"]}');
select pg_temp.ok((select count(*) from public.registros_v where id='psnap:P1') = 1, 'la dueña lee su presentación congelada');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"slides":["v2"]}' where id='psnap:P1'$$) = 1, 'la dueña la edita');
commit;

begin; set local role authenticated;
select pg_temp.como('colab-b@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where id='psnap:P1') = 0, 'otra área no lee la presentación ajena');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"slides":["hack"]}' where id='psnap:P1'$$) = 0, 'otra persona no la modifica');
select pg_temp.ok(pg_temp.filas($$delete from public.registros where id='psnap:P1'$$) = 0, 'otra persona no la borra');
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where id='psnap:P1') = 1, 'la dueña sigue viéndola');
commit;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where id = 'pres') = 1, 'la lista compartida de presentaciones sigue visible');
commit;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok((select count(*) from public.registros_v where id='psnap:P1') = 1, 'admin la lee');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"slides":["admin"]}' where id='psnap:P1'$$) = 1, 'admin la edita');
commit;
select pg_temp.ok((select propietario from public.registros where id='psnap:P1') = 'colab-a@test.cl', 'la dueña no cambia cuando edita el admin');
begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"slides":["v3"]}' where id='psnap:P1'$$) = 1, 'la dueña conserva el acceso tras la edición del admin');
rollback;
delete from public.registros where id='psnap:P1';
\echo SNAPSHOTS OK
