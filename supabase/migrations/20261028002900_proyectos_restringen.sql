-- =====================================================================================
-- APIH Prototipo · Proyectos asignados = lo único que la persona ve
--   Si a una persona (que no es Administra) se le asignan proyectos, SOLO ve y edita esos proyectos (con sus hitos,
--   riesgos, etc.); sus áreas y «ve todo» dejan de ampliar el alcance. Sin proyectos asignados rige el alcance por áreas.
--   Cada proyecto/propuesta lleva siempre su código interno (@PRJ-001) en registros.area, tenga área o no.
-- =====================================================================================
create or replace function public.apih_area_de(lista text, j jsonb) returns text language plpgsql stable security definer set search_path = public as
$$ declare a text;
begin
  if lista in ('APIH_Proyectos','APIH_Propuestas') then
    a := public.apih_area_vis(nullif(j ->> 'area', ''));
    if nullif(j ->> 'id', '') is not null then a := coalesce(a || ',', '') || '@' || (j ->> 'id'); end if;
    return a;
  end if;
  if lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Documentos','APIH_Notas') and nullif(j ->> 'ini','') is not null then
    select r.area into a from public.registros r where r.lista in ('APIH_Proyectos','APIH_Propuestas') and r.id = j ->> 'ini' limit 1;
    return a;
  end if;
  return null;
end $$;

-- ¿la persona está acotada a proyectos? (Administra nunca)
create or replace function public.apih_restringido(p public.perfiles) returns boolean language sql immutable as
$$ select p.rol <> 'admin' and cardinality(p.proyectos) > 0 $$;

create or replace function public.apih_ve_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select case
                       when p.rol = 'admin' then true
                       when public.apih_restringido(p) then public.apih_areas(a) && public.apih_tok(p.proyectos)
                            or not exists (select 1 from unnest(public.apih_areas(a)) x where x like '@%')
                       else p.app_rol = 'Responsable' or p.ve_todo or cardinality(public.apih_areas(public.apih_area_vis(a))) = 0
                            or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && p.areas end
                      from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_edita_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select case
                       when public.apih_impersonando() or public.apih_congelado() then false
                       when p.rol = 'admin' then true
                       when p.rol = 'lector' then false
                       when public.apih_restringido(p) then public.apih_areas(a) && public.apih_tok(p.proyectos)
                       else cardinality(public.apih_areas(public.apih_area_vis(a))) = 0 or 'Transversal' = any(public.apih_areas(a)) or public.apih_areas(a) && p.areas end
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
       when p.rol = 'editor' and public.apih_restringido(p) then public.apih_areas(p_area) && public.apih_tok(p.proyectos) or not exists (select 1 from unnest(public.apih_areas(p_area)) x where x like '@%')
       when p.rol = 'editor' then (cardinality(public.apih_areas(public.apih_area_vis(p_area))) = 0 or 'Transversal' = any(public.apih_areas(p_area)) or public.apih_areas(p_area) && p.areas)
       else false end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_contexto() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare p public.perfiles; ve_todo boolean; restr boolean; cfg jsonb := public.apih_cfg(); todas jsonb;
begin
  select * into p from public.perfiles where email = public.apih_email() and activo;
  if not found then return null; end if;
  restr := p.rol <> 'admin' and cardinality(p.proyectos) > 0;
  ve_todo := not restr and (p.rol = 'admin' or p.app_rol = 'Responsable' or p.ve_todo);
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
    'restringido', restr,
    'areasVisibles', case when restr then '[]'::jsonb when ve_todo then todas else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end,
    'areasEditables', case when restr or public.apih_solo_lectura() or p.rol = 'lector' then '[]'::jsonb
                           when p.rol = 'admin' then todas
                           else coalesce((select jsonb_agg(a) from jsonb_array_elements_text(todas) a where a = 'Transversal' or a = any(p.areas)), '[]'::jsonb) end);
end $$;

-- Filas existentes: todo proyecto lleva su código interno (también los sin área)
alter table public.registros disable trigger user;
update public.registros set area = public.apih_area_de(lista, substr(datos, 4)::jsonb) where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{';
update public.registros r set area = public.apih_area_de(r.lista, substr(r.datos, 4)::jsonb) where r.lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Documentos','APIH_Notas') and left(substr(r.datos, 4), 1) = '{';
alter table public.registros enable trigger user;
