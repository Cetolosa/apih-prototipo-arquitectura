-- Iter 1: permisos y capacidades salen de la base (apih_contexto, apih_personas, puede_editar, Ver como, comités, congelado, multi-área)
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

insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_montos, gobierna) values
  ('resp@test.cl','Rosa Resp','editor','Responsable','{"A"}', false, false),
  ('colab-a@test.cl','Ana A','editor','Colaborador','{"A"}', false, false),
  ('colab-g@test.cl','Gil Gob','editor','Colaborador','{"A"}', false, true),
  ('colab-b@test.cl','Beto B','editor','Colaborador','{"B"}', false, false),
  ('inv-a@test.cl','Ivo Inv','lector','Invitado','{"A"}', false, false)
on conflict (email) do update set nombre=excluded.nombre, rol=excluded.rol, app_rol=excluded.app_rol, areas=excluded.areas, gobierna=excluded.gobierna, activo=true;
insert into public.registros(lista,id,datos) values
  ('APIH_Proyectos','P-A','p1.{"titulo":"A","area":"A"}'),
  ('APIH_Proyectos','P-AB','p1.{"titulo":"AB","area":"A, B"}'),
  ('APIH_Proyectos','P-B','p1.{"titulo":"B","area":"B"}'),
  ('APIH_Comites','C-1','p1.{"nombre":"Comité"}')
on conflict (lista,id) do nothing;

begin; set local role authenticated;
select pg_temp.como('nadie@x.cl');
select pg_temp.ok(public.apih_contexto() is null, 'sin perfil no hay contexto');
select pg_temp.ok(jsonb_array_length(public.apih_personas()) = 0, 'sin perfil no hay directorio');
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok((public.apih_contexto()->>'rol') = 'editor' and (public.apih_contexto()->>'esAdmin')::boolean = false, 'contexto del colaborador: editor, no admin');
select pg_temp.ok((public.apih_contexto()->>'gobierna')::boolean = false and (public.apih_contexto()->>'veMontos')::boolean = false, 'colaborador no gobierna ni ve montos');
select pg_temp.ok((public.apih_contexto()->>'puedeVerAnalisis')::boolean = false, 'colaborador no ve el análisis');
select pg_temp.ok(jsonb_array_length(public.apih_personas()) >= 5, 'el directorio sale de perfiles');
select pg_temp.ok((select puede_editar from public.registros_v where id='P-A'), 'puede_editar: su área');
select pg_temp.ok((select puede_editar from public.registros_v where id='P-AB'), 'puede_editar: iniciativa multi-área si una es suya');
select pg_temp.ok((select count(*) from public.registros_v where id='P-B') = 0, 'no ve el área ajena');
select pg_temp.falla($$insert into public.registros(lista,id,datos) values ('APIH_Comites','C-2','p1.{"nombre":"x"}')$$, 'colaborador sin gobierna no crea comités', '%row-level security%');
select pg_temp.como('colab-g@test.cl');
select pg_temp.ok(public.apih_escribe('APIH_Comites','C-1',null), 'colaborador con gobierna gestiona comités');
select pg_temp.ok((public.apih_contexto()->>'gobierna')::boolean, 'contexto: gobierna');
select pg_temp.como('inv-a@test.cl');
select pg_temp.ok((public.apih_contexto()->>'soloLectura')::boolean, 'invitado: solo lectura');
select pg_temp.ok(not (select puede_editar from public.registros_v where id='P-A'), 'invitado: puede_editar falso');
rollback;

-- Ver como: lo resuelve el servidor
begin; set local role authenticated;
select pg_temp.como('colab-a@test.cl');
select pg_temp.falla($$select public.apih_ver_como('colab-b@test.cl')$$, 'un no-admin no usa Ver como', '%exclusivo del administrador%');
rollback;
begin; set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok((public.apih_contexto()->>'esAdmin')::boolean, 'admin: contexto admin');
select pg_temp.ok((select puede_editar from public.registros_v where id='P-B'), 'admin edita todo');
select pg_temp.ok((public.apih_ver_como('colab-a@test.cl')->>'rol') = 'editor', 'Ver como devuelve el contexto de la persona elegida');
select pg_temp.ok((public.apih_contexto()->>'comoDe') = 'tolosa-christian@aramark.cl' and (public.apih_contexto()->>'soloLectura')::boolean, 'simulando: solo lectura y se sabe quién');
select pg_temp.ok((select count(*) from public.registros_v where id='P-B') = 0, 'simulando: ve lo que vería el perfil');
select pg_temp.falla($$update public.registros set datos = datos where lista='APIH_Proyectos' and id='P-A'$$, 'simulando no escribe', null);
select pg_temp.ok(not (select puede_editar from public.registros_v where id='P-A'), 'simulando: puede_editar falso');
select pg_temp.falla($$select public.apih_ver_como('nadie@x.cl')$$, 'Ver como un perfil inexistente se rechaza', '%no existe un perfil%');
select pg_temp.ok((public.apih_ver_como(null)->>'esAdmin')::boolean, 'salir de Ver como devuelve al admin');
select pg_temp.ok((select puede_editar from public.registros_v where id='P-B'), 'ya fuera, vuelve a editar');
rollback;

-- Modo congelado: solo el admin y solo la configuración
begin;
insert into public.registros(lista,id,datos) values ('APIH_Config','cfg','p1.{"readOnly":true}') on conflict (lista,id) do update set datos = excluded.datos;
set local role authenticated;
select pg_temp.como('tolosa-christian@aramark.cl');
select pg_temp.ok((public.apih_contexto()->>'congelado')::boolean, 'contexto: congelado');
select pg_temp.ok(not public.apih_escribe('APIH_Proyectos','P-A','A'), 'congelado: ni el admin escribe datos');
select pg_temp.ok(public.apih_escribe('APIH_Config','cfg',null), 'congelado: el admin sí puede levantar el modo');
select pg_temp.como('colab-a@test.cl');
select pg_temp.ok(not (select puede_editar from public.registros_v where id='P-A'), 'congelado: el colaborador no edita');
rollback;
select 'PRUEBAS DE CONTEXTO OK';
