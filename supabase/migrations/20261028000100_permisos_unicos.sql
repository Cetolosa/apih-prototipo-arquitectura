-- =====================================================================================
-- APIH Prototipo · Iter 1 · Permisos y capacidades: UNA sola definición, en la base
--   Antes: la SPA volvía a decidir quién ve y quién edita (roles, áreas, «gobierna», solo lectura, administrador por correo
--   fijo en el código). Ahora la base es la única que decide y la SPA solo lee el resultado:
--     · apih_contexto()      quién soy y qué puedo hacer (rol, áreas, montos, gobierno, solo lectura, áreas permitidas)
--     · apih_personas()      directorio de personas con su rol y área (reemplaza la lista APIH_Roles del cliente)
--     · registros_v.puede_editar   por fila, con la MISMA función que aplica RLS al escribir (apih_escribe)
--     · apih_ver_como(email) «Ver como» del administrador resuelto en el servidor (solo lectura; el servidor evalúa los
--                            permisos con el perfil simulado, no la SPA)
--   Reglas que antes solo existían en el navegador y ahora se hacen cumplir aquí:
--     · gestión de comités (lista APIH_Comites) solo con «gobierna» (Administra, Responsable o marca explícita)
--     · modo solo lectura de la organización (cfg.readOnly): nadie escribe salvo el administrador sobre la propia configuración
--     · iniciativas con varias áreas («BISE, TI»): basta con que una sea del perfil (la SPA ya lo hacía; la base comparaba el texto entero)
-- =====================================================================================

alter table public.perfiles add column if not exists cargo     text not null default '';
alter table public.perfiles add column if not exists capacidad int;

-- 1. «Ver como»: estado en la base, solo para el administrador -------------------------------------
create table if not exists public.sesion_como (admin text primary key, como text not null, hasta timestamptz not null);
alter table public.sesion_como enable row level security;
revoke all on public.sesion_como from anon, authenticated;

create or replace function public.apih_email_real() returns text language sql stable as
$$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;

-- Correo EFECTIVO: el de la sesión, salvo que sea administrador y esté usando «Ver como» (vigente)
create or replace function public.apih_email() returns text language sql stable security definer set search_path = public as
$$ select coalesce(
     (select s.como from public.sesion_como s join public.perfiles a on a.email = s.admin and a.rol = 'admin' and a.activo
       where s.admin = lower(coalesce(auth.jwt() ->> 'email','')) and s.hasta > now()),
     lower(coalesce(auth.jwt() ->> 'email',''))) $$;

create or replace function public.apih_impersonando() returns boolean language sql stable security definer set search_path = public as
$$ select public.apih_email() <> public.apih_email_real() $$;

create or replace function public.apih_ver_como(p_email text default null) returns jsonb
language plpgsql security definer set search_path = public as
$$ declare real_ text := public.apih_email_real(); c text := lower(btrim(coalesce(p_email, '')));
begin
  if not exists (select 1 from public.perfiles where email = real_ and rol = 'admin' and activo) then
    raise exception 'APIH: «Ver como» es exclusivo del administrador' using errcode = '42501'; end if;
  if c = '' then delete from public.sesion_como where admin = real_; return public.apih_contexto(); end if;
  if not exists (select 1 from public.perfiles where email = c and activo) then
    raise exception 'APIH: no existe un perfil activo para %', c using errcode = '22023'; end if;
  insert into public.sesion_como(admin, como, hasta) values (real_, c, now() + interval '4 hours')
    on conflict (admin) do update set como = excluded.como, hasta = excluded.hasta;
  return public.apih_contexto();
end $$;

-- 2. Modos de solo lectura -------------------------------------------------------------------------------
create or replace function public.apih_congelado() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce(public.apih_cfg() ->> 'readOnly', 'false') = 'true' $$;

create or replace function public.apih_solo_lectura() returns boolean language sql stable security definer set search_path = public as
$$ select public.apih_impersonando() or public.apih_congelado()
          or coalesce((select p.rol = 'lector' from public.perfiles p where p.email = public.apih_email() and p.activo), true) $$;

-- 3. Áreas: una iniciativa puede tener varias («BISE, TI») ------------------------------------------------
create or replace function public.apih_areas(a text) returns text[] language sql immutable as
$$ select coalesce(array(select btrim(x) from unnest(string_to_array(coalesce(a, ''), ',')) x where btrim(x) <> ''), '{}'::text[]) $$;

create or replace function public.apih_gobierna() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select p.rol = 'admin' or p.app_rol = 'Responsable' or p.gobierna from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_ve_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo
                         or cardinality(public.apih_areas(a)) = 0 or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && p.areas
                      from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_edita_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select case
                       when public.apih_impersonando() or public.apih_congelado() then false
                       when p.rol = 'admin' then true
                       when p.rol = 'lector' then false
                       else cardinality(public.apih_areas(a)) = 0 or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && p.areas end
                      from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

-- Regla de escritura por fila (la usan las políticas RLS y la vista registros_v)
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
       when p.rol = 'editor' then (cardinality(public.apih_areas(p_area)) = 0 or 'Transversal' = any(public.apih_areas(p_area)) or public.apih_areas(p_area) && p.areas)
       else false end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

-- 4. Contexto de quien llama -------------------------------------------------------------------------------
create or replace function public.apih_contexto() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare p public.perfiles; ve_todo boolean; cfg jsonb := public.apih_cfg(); todas jsonb;
begin
  select * into p from public.perfiles where email = public.apih_email() and activo;
  if not found then return null; end if;
  ve_todo := p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo;
  todas := coalesce(case when jsonb_typeof(cfg -> 'areas') = 'array' then cfg -> 'areas' end, '[]'::jsonb);
  return jsonb_build_object(
    'email', p.email, 'nombre', coalesce(nullif(p.nombre, ''), p.email), 'cargo', p.cargo, 'rol', p.rol, 'appRol', p.app_rol,
    'areas', to_jsonb(p.areas), 'veTodo', ve_todo, 'veMontos', p.rol = 'admin' or p.ve_montos,
    'gobierna', public.apih_gobierna(), 'esAdmin', p.rol = 'admin', 'puedeVerAnalisis', p.rol = 'admin',
    'soloLectura', public.apih_solo_lectura(), 'congelado', public.apih_congelado(),
    'comoDe', case when public.apih_impersonando() then public.apih_email_real() end,
    -- áreas que el perfil puede ver / en las que puede crear y editar (la SPA solo las muestra)
    'areasVisibles', case when ve_todo then todas else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end,
    'areasEditables', case when public.apih_solo_lectura() or p.rol = 'lector' then '[]'::jsonb
                           when p.rol = 'admin' then todas
                           else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end);
end $$;
revoke all on function public.apih_contexto() from public, anon;
grant execute on function public.apih_contexto() to authenticated;
revoke all on function public.apih_ver_como(text) from public, anon;
grant execute on function public.apih_ver_como(text) to authenticated;

-- Directorio de personas (nombre, rol, área): la fuente es la tabla de perfiles, no una lista editable del cliente
create or replace function public.apih_personas() returns jsonb language sql stable security definer set search_path = public as
$$ select case when public.apih_rol() is null then '[]'::jsonb else coalesce((
     select jsonb_agg(jsonb_build_object('n', coalesce(nullif(p.nombre, ''), p.email), 'correo', p.email, 'cargo', p.cargo, 'rol', p.app_rol,
                                         'area', array_to_string(p.areas, ','), 'veTodo', (p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo),
                                         'capacidad', p.capacidad) order by coalesce(nullif(p.nombre, ''), p.email))
       from public.perfiles p where p.activo), '[]'::jsonb) end $$;
revoke all on function public.apih_personas() from public, anon;
grant execute on function public.apih_personas() to authenticated;

-- 5. Vista de lectura: cada fila dice si quien llama puede modificarla (misma regla que RLS) -------------------
create or replace view public.registros_v as
select r.lista, r.id, r.actualizado, r.modificado_por, r.area,
       case when public.apih_ve_montos() then r.datos
            else 'p1.' || ((substr(r.datos, 4)::jsonb) - (select coalesce(array_agg(clave), '{}') from public.claves_monto))::text end as datos,
       (public.apih_escribe(r.lista, r.id, r.area) and public.apih_es_dueno(r.lista, r.id, r.propietario)) as puede_editar
from public.registros r
where public.apih_rol() is not null and public.apih_ve_area(r.area) and r.lista <> 'APIH_Claves' and public.apih_lee_config(r.lista, r.id)
  and public.apih_es_dueno(r.lista, r.id, r.propietario);
alter view public.registros_v owner to postgres;
grant select on public.registros_v to authenticated;
