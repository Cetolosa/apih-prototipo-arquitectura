-- =====================================================================================
-- APIH Prototipo · F2 · APIH_Config por alcance (reemplaza "cualquier editor escribe todo")
--   cfgU:<correo>        preferencias personales: las lee/escribe su dueño; el admin ve y escribe todas
--   cfg, ptema           parámetros de la organización: admin o editor con gobierna = true
--   eventos, pres, ptpl  colecciones compartidas: cualquier editor (no lector)
--   seq                  contador de ids: cualquier editor, pero solo puede subir (nunca retroceder)
--   APIH_Roles / Claves  solo admin
-- =====================================================================================

create or replace function public.apih_escribe(p_lista text, p_id text, p_area text) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((
     select case
       when p.rol = 'admin' then true
       when p_lista in ('APIH_Roles','APIH_Claves') then false
       when p_lista = 'APIH_Config' and p_id like 'cfgU:%' then p_id = 'cfgU:' || p.email
       when p_lista = 'APIH_Config' and (p_id in ('cfg','ptema') or p_id like 'cfg#%' or p_id like 'ptema#%') then (p.rol = 'editor' and p.gobierna)
       when p_lista = 'APIH_Config' then p.rol = 'editor'
       when p.rol = 'editor' then (p_area is null or p_area = 'Transversal' or p_area = any(p.areas))
       else false end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

create or replace function public.apih_lee_config(p_lista text, p_id text) returns boolean
language sql stable security definer set search_path = public as
$$ select not (p_lista = 'APIH_Config' and p_id like 'cfgU:%')
          or public.apih_rol() = 'admin' or p_id = 'cfgU:' || public.apih_email() $$;

-- Políticas (reemplazan las de la migración anterior)
drop policy if exists reg_leer on public.registros;
create policy reg_leer on public.registros for select to authenticated
  using (public.apih_rol() is not null and public.apih_ve_area(area) and lista <> 'APIH_Claves' and public.apih_lee_config(lista, id));

drop policy if exists reg_insertar on public.registros;
create policy reg_insertar on public.registros for insert to authenticated
  with check (public.apih_rol() is not null and (
        (lista = 'APIH_Notas' and public.apih_ve_area(public.apih_area_de(lista, substr(datos,4)::jsonb)))
     or public.apih_escribe(lista, id, public.apih_area_de(lista, substr(datos,4)::jsonb))));

drop policy if exists reg_cambiar on public.registros;
create policy reg_cambiar on public.registros for update to authenticated
  using (public.apih_escribe(lista, id, area))
  with check (public.apih_escribe(lista, id, public.apih_area_de(lista, substr(datos,4)::jsonb)));

drop policy if exists reg_borrar on public.registros;
create policy reg_borrar on public.registros for delete to authenticated
  using (public.apih_escribe(lista, id, area));

-- Vista de lectura: añade el filtro de configuración personal
create or replace view public.registros_v as
select r.lista, r.id, r.actualizado, r.modificado_por, r.area,
       case when public.apih_ve_montos() then r.datos
            else 'p1.' || ((substr(r.datos, 4)::jsonb) - (select coalesce(array_agg(clave), '{}') from public.claves_monto))::text end as datos
from public.registros r
where public.apih_rol() is not null and public.apih_ve_area(r.area) and r.lista <> 'APIH_Claves' and public.apih_lee_config(r.lista, r.id);
alter view public.registros_v owner to postgres;
grant select on public.registros_v to authenticated;

-- Contador de ids: solo puede subir
create or replace function public.apih_seq() returns trigger language plpgsql security definer set search_path = public as
$$ declare jn jsonb; jo jsonb; k text; r jsonb;
begin
  if new.lista = 'APIH_Config' and new.id = 'seq' and tg_op = 'UPDATE' then
    jn := substr(new.datos, 4)::jsonb; jo := substr(old.datos, 4)::jsonb; r := jn;
    for k in select jsonb_object_keys(jo) loop
      if jsonb_typeof(jo -> k) = 'number' and (jn ->> k) is not null and jsonb_typeof(jn -> k) = 'number' then
        r := jsonb_set(r, array[k], to_jsonb(greatest((jo ->> k)::numeric, (jn ->> k)::numeric)));
      elsif not (jn ? k) then r := jsonb_set(r, array[k], jo -> k);
      end if;
    end loop;
    new.datos := 'p1.' || r::text;
  end if;
  return new;
end $$;
drop trigger if exists apih_seq on public.registros;
create trigger apih_seq before update on public.registros for each row execute function public.apih_seq();
