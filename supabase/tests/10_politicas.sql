-- Pruebas de autorización con JWT de prueba. Falla (exit != 0) ante cualquier aserción incumplida.
\set ON_ERROR_STOP on
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns void language plpgsql as
$$ begin if not coalesce(c, false) then raise exception 'FALLA: %', m; end if; raise notice 'ok  %', m; end $$;
create or replace function pg_temp.filas(q text) returns int language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
create or replace function pg_temp.falla(sql text, m text) returns void language plpgsql as
$$ declare e boolean := false; begin begin execute sql; exception when others then e := true; end;
   if not e then raise exception 'FALLA (debía rechazarse): %', m; end if; raise notice 'ok  % (rechazado)', m; end $$;

-- perfiles de prueba adicionales (el seed trae admin y colaborador)
insert into public.perfiles (email, rol, app_rol, areas, ve_montos) values
  ('resp@test.cl','editor','Responsable','{"A"}', false),
  ('colab-a@test.cl','editor','Colaborador','{"A"}', false),
  ('colab-b@test.cl','editor','Colaborador','{"B"}', false),
  ('inv-a@test.cl','lector','Invitado','{"A"}', false),
  ('colab-m@test.cl','editor','Colaborador','{"A"}', true);

-- datos base (como propietario, sin RLS)
insert into public.registros(lista,id,datos) values
  ('APIH_Proyectos','P-A','p1.{"titulo":"Proyecto A","area":"A","presupuesto":1000,"gastado":200,"avance":10}'),
  ('APIH_Proyectos','P-B','p1.{"titulo":"Proyecto B","area":"B","presupuesto":5000,"gastado":10,"avance":20}'),
  ('APIH_Proyectos','P-T','p1.{"titulo":"Transversal","area":"Transversal","presupuesto":7,"avance":0}'),
  ('APIH_Hitos','H-B','p1.{"nombre":"Hito B","ini":"P-B"}'),
  ('APIH_Roles','R1','p1.{"x":1}');

begin; set local role authenticated;
select pg_temp.como('nadie@x.cl');
select pg_temp.ok((select count(*) from public.registros_v) = 0, 'sin perfil no ve nada');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','X','p1.{"titulo":"x","area":"A"}')$$, 'sin perfil no escribe');
rollback;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Proyectos') = 2, 'colaborador A ve su área + Transversal');
select pg_temp.ok((select count(*) from public.registros_v where id='H-B') = 0, 'colaborador A no ve hitos de B (área heredada)');
select pg_temp.ok((select datos from public.registros_v where id='P-A') !~ 'presupuesto|gastado', 'sin ve_montos: la vista oculta montos');
select pg_temp.falla($$select datos from public.registros$$, 'no se lee datos directo de la tabla');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','X','p1.{"titulo":"x","area":"B"}')$$, 'no crea en área ajena');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"titulo":"Proyecto B2","area":"B"}' where id='P-B'$$) = 0, 'no modifica área ajena (0 filas)');
select pg_temp.falla($$update public.registros set datos='p1.{"titulo":"A","area":"B"}' where id='P-A'$$, 'no mueve su proyecto a otra área');
-- edita su área sin tocar montos: los montos existentes se conservan aunque el cliente no los conozca
update public.registros set datos='p1.{"titulo":"Proyecto A v2","area":"A","avance":50}' where id='P-A';
select pg_temp.ok(true, 'edita su área');
select pg_temp.ok(pg_temp.filas($$delete from public.registros where id='R1'$$) = 0, 'no borra APIH_Roles');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','M','p1.{"titulo":"x","area":"A","avance":150}')$$, 'valida avance 0..100');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Proyectos','M','p1.{"titulo":"x","area":"A","presupuesto":"mucho"}')$$, 'valida tipo numérico');
rollback;

-- los montos del proyecto A sobreviven a la edición del colaborador (verificado como propietario)
select pg_temp.ok((select (substr(datos,4)::jsonb ->> 'presupuesto') is not null from public.registros where id='P-A'), 'montos intactos tras edición sin permiso de montos') ;

begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
update public.registros set datos='p1.{"titulo":"A","area":"A","presupuesto":999999}' where id='P-A';
reset role;
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'presupuesto' from public.registros where id='P-A') = '1000', 'sin ve_montos no puede cambiar el presupuesto (se revierte)');
select pg_temp.ok((select count(*) from public.auditoria where id_registro='P-A' and toco_montos and email='colab-a@test.cl') = 0, 'auditoría: intento revertido no cuenta como cambio de montos');
rollback;

begin; set local role authenticated;
select pg_temp.como('colab-m@test.cl');
update public.registros set datos='p1.{"titulo":"A","area":"A","presupuesto":1500,"gastado":200}' where id='P-A';
reset role;
select pg_temp.ok((select substr(datos,4)::jsonb ->> 'presupuesto' from public.registros where id='P-A') = '1500', 'con ve_montos sí cambia el presupuesto');
select pg_temp.ok((select count(*) from public.auditoria where id_registro='P-A' and toco_montos and email='colab-m@test.cl') = 1, 'auditoría registra el cambio de montos');
rollback;

begin; set local role authenticated;
select pg_temp.como('resp@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Proyectos') = 3, 'responsable ve todas las áreas');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"titulo":"B2","area":"B"}' where id='P-B'$$) = 0, 'responsable no edita área ajena');
update public.registros set datos='p1.{"titulo":"A3","area":"A"}' where id='P-A';
select pg_temp.ok(true, 'responsable edita su área');
rollback;

begin; set local role authenticated;
select pg_temp.como('inv-a@test.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Proyectos') = 2, 'invitado ve su área');
select pg_temp.ok(pg_temp.filas($$update public.registros set datos='p1.{"titulo":"x","area":"A"}' where id='P-A'$$) = 0, 'invitado no edita (0 filas)');
rollback;

begin; set local role authenticated;
select pg_temp.como('inv-a@test.cl');
insert into public.registros(lista,id,datos) values ('APIH_Notas','N1','p1.{"ini":"P-A","texto":"comentario"}');
select pg_temp.ok(true, 'invitado comenta en su área');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Notas','N2','p1.{"ini":"P-B","texto":"x"}')$$, 'invitado no comenta en área ajena');
rollback;

begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Proyectos') = 3, 'admin ve todo');
select pg_temp.ok((select datos from public.registros_v where id='P-B') ~ 'presupuesto', 'admin ve montos');
insert into public.registros(lista,id,datos) values ('APIH_Roles','R2','p1.{"x":2}');
select pg_temp.ok(true, 'admin escribe APIH_Roles');
select pg_temp.ok((select count(*) from public.auditoria) >= 1, 'admin lee auditoría');
rollback;

begin; set local role authenticated;
select pg_temp.como('cetolosa@gmail.com');
select pg_temp.ok((select count(*) from public.registros_v where lista='APIH_Proyectos') = 1, 'usuario de prueba (gmail): solo Transversal (su área aún no tiene datos)');
select pg_temp.ok((select count(*) from public.auditoria) = 0, 'editor no lee auditoría');
rollback;

-- alta de usuarios: dominio configurable
select pg_temp.falla($$insert into auth.users(email) values ('alguien@otro.com')$$, 'dominio no autorizado');
insert into auth.users(email) values ('nuevo@aramark.cl');
insert into auth.users(email) values ('cetolosa@gmail.com');
\echo TODAS LAS PRUEBAS SQL OK
