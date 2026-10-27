-- apih_validar: el servidor rechaza estructura inválida (como cualquier usuario con permiso de escritura).
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.falla(sql text, m text, patron text default null) returns void language plpgsql as
$$ declare e boolean := false; msg text; begin begin execute sql; exception when others then e := true; msg := sqlerrm; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if;
   if patron is not null and msg not like patron then raise exception 'FALLA (se rechazó por otra causa): % -> %', m, msg; end if;
   raise notice 'ok  % (rechazado)', m; end $$;

delete from public.registros where lista in ('APIH_Proyectos','APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Cambios');
insert into public.registros(lista, id, datos) values ('APIH_Proyectos','PRJ-001','p1.{"id":"PRJ-001","titulo":"P","area":"A","tipo":"Proyecto","estado":"En curso","rag":"Verde","finPlan":"2026-12-31"}');

begin; set local role authenticated; select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-9","ini":"PRJ-001","nombre":"h"}')$$, 'id del contenido distinto del registro', '%no coincide%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-001","nombre":"h","fecha":"31/12/2026"}')$$, 'fecha con formato inválido', '%AAAA-MM-DD%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-001","nombre":"h","fecha":"2026-02-31"}')$$, 'fecha inexistente', '%no es una fecha válida%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-001","nombre":" "}')$$, 'hito sin nombre', '%necesita nombre%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-001","nombre":"h","completado":"si"}')$$, 'completado no booleano', '%verdadero o falso%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Riesgos','RSK-1','p1.{"id":"RSK-1","ini":"PRJ-001","desc":"r","prob":9,"imp":2}')$$, 'probabilidad fuera de rango', '%fuera de 1..5%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Decisiones','DEC-1','p1.{"id":"DEC-1","ini":"PRJ-001","tipo":"Inventar","estado":"Pendiente"}')$$, 'tipo de decisión inválido', '%tipo de decisión%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Decisiones','DEC-1','p1.{"id":"DEC-1","ini":"PRJ-001","tipo":"Iniciar","estado":"Hecha"}')$$, 'estado de decisión inválido', '%estado de decisión%');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Cambios','CHG-1','p1.{"id":"CHG-1","ini":"PRJ-001","estado":"Listo"}')$$, 'estado de cambio inválido', '%estado de cambio%');
select pg_temp.falla($$update public.registros set datos = 'p1.{"id":"PRJ-001","titulo":"P","area":"A","tipo":"Proyecto","estado":"Zombi"}' where lista='APIH_Proyectos' and id='PRJ-001'$$, 'estado de proyecto inválido', '%estado de proyecto%');
select pg_temp.falla($$update public.registros set datos = 'p1.{"id":"PRJ-001","titulo":"P","area":"A","tipo":"Proyecto","estado":"En curso","rag":"Azul"}' where lista='APIH_Proyectos' and id='PRJ-001'$$, 'RAG inválido', '%RAG inválido%');
-- lo válido sigue pasando
insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-1','p1.{"id":"HIT-1","ini":"PRJ-001","nombre":"ok","fecha":"2026-12-01","completado":false}');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Hitos') = 1, 'un hito válido se guarda');
insert into public.registros(lista,id,datos) values ('APIH_Hitos','HIT-2','p1.{"id":"HIT-2","ini":"PRJ-001","nombre":"sin fecha","fecha":"","completado":false}');
select pg_temp.ok(true, 'fecha vacía se acepta (campo opcional)');
rollback;

-- los índices existen y la consulta por iniciativa puede usarlos
select pg_temp.ok((select count(*) from pg_indexes where indexname in ('registros_ini_idx','registros_estado_idx')) = 2, 'índices por iniciativa y estado creados');
\echo PRUEBAS DE VALIDACION OK
