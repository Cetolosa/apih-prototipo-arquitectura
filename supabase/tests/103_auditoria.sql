-- Iter 4e: el servidor deja en la auditoría qué campos cambió cada actualización
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-A1','p1.{"id":"HIT-A1","ini":"PRJ-A","nombre":"Uno","fecha":"2026-11-01","completado":false}') on conflict (lista,id) do nothing;
update public.registros set datos = 'p1.{"id":"HIT-A1","ini":"PRJ-A","nombre":"Uno","fecha":"2026-11-15","completado":true}' where lista = 'APIH_Hitos' and id = 'HIT-A1';
select pg_temp.ok((select campos from public.auditoria where lista = 'APIH_Hitos' and id_registro = 'HIT-A1' and accion = 'update' order by n desc limit 1) @> array['fecha','completado'], 'la auditoría guarda los campos que cambiaron');
select pg_temp.ok(not ((select campos from public.auditoria where lista = 'APIH_Hitos' and id_registro = 'HIT-A1' and accion = 'update' order by n desc limit 1) @> array['nombre']), 'y no los que no cambiaron');
