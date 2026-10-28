-- =====================================================================================
-- APIH Prototipo · Iter 6 · Acceso por auto-registro y proyectos asignados
--   · Cualquiera crea su cuenta; queda «pendiente» (sin ver nada) hasta que Administra le asigne un rol.
--       apih_solicitar_acceso(p_nombre)   crea el perfil pendiente (si no existe) y devuelve el estado
--       apih_usuarios()                   lista de usuarios (solo Administra), pendientes primero
--       apih_guardar_usuario(email, datos) asigna rol, áreas, proyectos y permisos; activa al pendiente
--       apih_desactivar_usuario(email)    rechaza o desactiva
--   · Proyectos asignados a una persona (perfiles.proyectos): ve y, si es Colaborador/Responsable, edita
--     ese proyecto y sus hitos, riesgos, decisiones, etc., aunque no sea de su área. Se implementa como un «área»
--     propia de cada proyecto ('@PRJ-001') que el servidor agrega a la columna registros.area; las reglas de
--     visibilidad y escritura ya comparan áreas, así que valen para todos los comandos y políticas sin duplicarse.
-- =====================================================================================
alter table public.perfiles add column if not exists proyectos text[] not null default '{}';
alter table public.perfiles add column if not exists pendiente boolean not null default false;
alter table public.perfiles add column if not exists solicitado timestamptz;

create or replace function public.apih_tok(p text[]) returns text[] language sql immutable as
$$ select coalesce(array(select '@' || x from unnest(p) x), '{}'::text[]) $$;

-- Áreas «de verdad» (sin los códigos internos de proyecto)
create or replace function public.apih_area_vis(a text) returns text language sql immutable as
$$ select nullif(array_to_string(array(select x from unnest(public.apih_areas(a)) x where x not like '@%'), ','), '') $$;

create or replace function public.apih_area_de(lista text, j jsonb) returns text language plpgsql stable security definer set search_path = public as
$$ declare a text;
begin
  if lista in ('APIH_Proyectos','APIH_Propuestas') then
    a := public.apih_area_vis(nullif(j ->> 'area', ''));
    if a is not null and nullif(j ->> 'id', '') is not null then a := a || ',@' || (j ->> 'id'); end if;
    return a;
  end if;
  if lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Documentos','APIH_Notas') and nullif(j ->> 'ini','') is not null then
    select r.area into a from public.registros r where r.lista in ('APIH_Proyectos','APIH_Propuestas') and r.id = j ->> 'ini' limit 1;
    return a;
  end if;
  return null;
end $$;

create or replace function public.apih_ve_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo
                         or cardinality(public.apih_areas(a)) = 0 or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && (p.areas || public.apih_tok(p.proyectos))
                      from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_edita_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select case
                       when public.apih_impersonando() or public.apih_congelado() then false
                       when p.rol = 'admin' then true
                       when p.rol = 'lector' then false
                       else cardinality(public.apih_areas(a)) = 0 or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && (p.areas || public.apih_tok(p.proyectos)) end
                      from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_escribe(p_lista text, p_id text, p_area text) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((
     select case
       when public.apih_impersonando() then false
       when public.apih_congelado() and not (p.rol = 'admin' and p_lista = 'APIH_Config' and p_id = 'cfg') then false
       when p.rol = 'admin' then true
       when p_lista in ('APIH_Roles','APIH_Claves') then false
       when p_lista = 'APIH_Config' and p_id like 'cfgU:%' then p_id = 'cfgU:' || p.email
       when p_lista = 'APIH_Config' and (p_id in ('cfg','ptema') or p_id like 'cfg#%' or p_id like 'ptema#%') then (p.rol = 'editor' and public.apih_gobierna())
       when p_lista = 'APIH_Config' then p.rol = 'editor'
       when p_lista = 'APIH_Comites' then (p.rol = 'editor' and public.apih_gobierna())
       when p.rol = 'editor' then (cardinality(public.apih_areas(p_area)) = 0 or 'Transversal' = any(public.apih_areas(p_area)) or public.apih_areas(p_area) && (p.areas || public.apih_tok(p.proyectos)))
       else false end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_contexto() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare p public.perfiles; ve_todo boolean; cfg jsonb := public.apih_cfg(); todas jsonb;
begin
  select * into p from public.perfiles where email = public.apih_email() and activo;
  if not found then return null; end if;
  ve_todo := p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo;
  -- catálogo de áreas: el de la configuración; si aún no existe, las que aparecen en perfiles y registros
  todas := case when jsonb_typeof(cfg -> 'areas') = 'array' and jsonb_array_length(cfg -> 'areas') > 0 then cfg -> 'areas'
                else coalesce((select jsonb_agg(a order by a) from (
                       select unnest(areas) a from public.perfiles union
                       select btrim(x) from public.registros r, unnest(string_to_array(coalesce(r.area, ''), ',')) x where btrim(x) <> '' and btrim(x) not like '@%') q
                       where a <> ''), '[]'::jsonb) end;
  return jsonb_build_object(
    'email', p.email, 'nombre', coalesce(nullif(p.nombre, ''), p.email), 'cargo', p.cargo, 'rol', p.rol, 'appRol', p.app_rol,
    'areas', to_jsonb(p.areas), 'proyectos', to_jsonb(p.proyectos), 'veTodo', ve_todo, 'veMontos', p.rol = 'admin' or p.ve_montos,
    'gobierna', public.apih_gobierna(), 'esAdmin', p.rol = 'admin', 'puedeVerAnalisis', p.rol = 'admin',
    'editaTodo', p.rol = 'admin' and not public.apih_solo_lectura(),
    'soloLectura', public.apih_solo_lectura(), 'congelado', public.apih_congelado(),
    'comoDe', case when public.apih_impersonando() then public.apih_email_real() end,
    -- áreas que el perfil puede ver / en las que puede crear y editar (la SPA solo las muestra)
    'areasVisibles', case when ve_todo then todas else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end,
    'areasEditables', case when public.apih_solo_lectura() or p.rol = 'lector' then '[]'::jsonb
                           when p.rol = 'admin' then todas
                           else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end);
end $$;

-- Registro abierto: cualquiera crea su cuenta. Sin perfil activo no ve ni escribe nada (apih_rol() es nulo).
create or replace function public.apih_dominio() returns trigger language plpgsql security definer set search_path = public as
$$ begin return new; end $$;

create or replace function public.apih_solicitar_acceso(p_nombre text default null) returns jsonb language plpgsql security definer set search_path = public as
$$ declare em text := public.apih_email(); p public.perfiles;
begin
  if em = '' then raise exception 'APIH: sin sesión' using errcode = '42501'; end if;
  select * into p from public.perfiles where email = em;
  if not found then
    insert into public.perfiles(email, nombre, rol, app_rol, activo, pendiente, solicitado)
      values (em, left(coalesce(public.apih_txt(jsonb_build_object('n', p_nombre), 'n'), public.apih_txt(jsonb_build_object('n', auth.jwt() -> 'user_metadata' ->> 'nombre'), 'n'), split_part(em, '@', 1)), 80), 'lector', 'Invitado', false, true, now())
      on conflict (email) do nothing;
    select * into p from public.perfiles where email = em;
  end if;
  return jsonb_build_object('email', em, 'estado', case when p.activo then 'activo' when p.pendiente then 'pendiente' else 'inactivo' end);
end $$;
revoke all on function public.apih_solicitar_acceso(text) from public, anon;
grant execute on function public.apih_solicitar_acceso(text) to authenticated;

create or replace function public.apih_usuarios() returns jsonb language plpgsql stable security definer set search_path = public as
$$ begin
  if public.apih_rol() is distinct from 'admin' then raise exception 'APIH: solo Administra gestiona usuarios' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('email', p.email, 'nombre', coalesce(p.nombre, ''), 'cargo', p.cargo, 'appRol', p.app_rol,
            'areas', to_jsonb(p.areas), 'proyectos', to_jsonb(p.proyectos), 'veTodo', p.ve_todo, 'veMontos', p.ve_montos, 'gobierna', p.gobierna,
            'activo', p.activo, 'pendiente', p.pendiente, 'solicitado', p.solicitado) order by p.pendiente desc, p.activo desc, lower(coalesce(nullif(p.nombre, ''), p.email))), '[]'::jsonb)
          from public.perfiles p);
end $$;
revoke all on function public.apih_usuarios() from public, anon;
grant execute on function public.apih_usuarios() to authenticated;

create or replace function public.apih_guardar_usuario(p_email text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$ declare em text := lower(btrim(coalesce(p_email, ''))); p public.perfiles; ar text; ap text; arr text[]; prs text[]; act boolean; rl text;
begin
  if public.apih_rol() is distinct from 'admin' then raise exception 'APIH: solo Administra gestiona usuarios' using errcode = '42501'; end if;
  select * into p from public.perfiles where email = em;
  if not found then raise exception 'APIH: el usuario % no existe', em using errcode = 'P0002'; end if;
  ar := coalesce(public.apih_txt(p_datos, 'appRol'), p.app_rol);
  if ar not in ('Administra', 'Responsable', 'Colaborador', 'Invitado') then perform public.apih_err('elige un rol: Administra, Responsable, Colaborador o Invitado', 'appRol'); end if;
  rl := case ar when 'Administra' then 'admin' when 'Invitado' then 'lector' else 'editor' end;
  act := coalesce((p_datos ->> 'activo')::boolean, true);
  if em = public.apih_email() and (ar <> 'Administra' or not act) then perform public.apih_err('no puedes quitarte tu propio acceso de Administra', 'appRol'); end if;
  arr := coalesce(array(select distinct btrim(x) from jsonb_array_elements_text(case when jsonb_typeof(p_datos -> 'areas') = 'array' then p_datos -> 'areas' else to_jsonb(p.areas) end) x where btrim(x) <> '' and btrim(x) not like '@%'), '{}');
  prs := coalesce(array(select distinct btrim(x) from jsonb_array_elements_text(case when jsonb_typeof(p_datos -> 'proyectos') = 'array' then p_datos -> 'proyectos' else to_jsonb(p.proyectos) end) x where btrim(x) <> ''), '{}');
  foreach ap in array prs loop
    if not exists (select 1 from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = ap) then perform public.apih_err('la iniciativa ' || ap || ' no existe', 'proyectos'); end if;
  end loop;
  update public.perfiles set app_rol = ar, rol = rl, nombre = coalesce(public.apih_txt(p_datos, 'nombre'), nombre), cargo = coalesce(case when p_datos ? 'cargo' then btrim(p_datos ->> 'cargo') end, cargo),
         areas = arr, proyectos = prs, ve_todo = coalesce((p_datos ->> 'veTodo')::boolean, ve_todo), ve_montos = coalesce((p_datos ->> 'veMontos')::boolean, ve_montos),
         gobierna = coalesce((p_datos ->> 'gobierna')::boolean, gobierna), activo = act, pendiente = false where email = em;
  insert into public.auditoria(email, accion, lista, id_registro, area) values (public.apih_email(), 'usuario: ' || ar || case when act then '' else ' (inactivo)' end, 'perfiles', em, array_to_string(arr, ','));
  return jsonb_build_object('email', em, 'appRol', ar, 'activo', act);
end $$;
revoke all on function public.apih_guardar_usuario(text, jsonb) from public, anon;
grant execute on function public.apih_guardar_usuario(text, jsonb) to authenticated;

create or replace function public.apih_desactivar_usuario(p_email text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare em text := lower(btrim(coalesce(p_email, '')));
begin
  if public.apih_rol() is distinct from 'admin' then raise exception 'APIH: solo Administra gestiona usuarios' using errcode = '42501'; end if;
  if em = public.apih_email() then perform public.apih_err('no puedes desactivar tu propio acceso', 'email'); end if;
  update public.perfiles set activo = false, pendiente = false where email = em;
  if not found then raise exception 'APIH: el usuario % no existe', em using errcode = 'P0002'; end if;
  insert into public.auditoria(email, accion, lista, id_registro) values (public.apih_email(), 'usuario: desactivado', 'perfiles', em);
  return jsonb_build_object('email', em, 'activo', false);
end $$;
revoke all on function public.apih_desactivar_usuario(text) from public, anon;
grant execute on function public.apih_desactivar_usuario(text) to authenticated;

-- Filas existentes: agregar el código de proyecto a la columna derivada (sin disparar validaciones ni sellos)
alter table public.registros disable trigger user;
update public.registros set area = public.apih_area_de(lista, substr(datos, 4)::jsonb) where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{';
update public.registros r set area = public.apih_area_de(r.lista, substr(r.datos, 4)::jsonb) where r.lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Documentos','APIH_Notas') and left(substr(r.datos, 4), 1) = '{';
alter table public.registros enable trigger user;
