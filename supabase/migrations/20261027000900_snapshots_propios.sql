-- =====================================================================================
-- APIH Prototipo · F5 · Presentaciones congeladas con dueño
--   psnap:<id>  guarda las láminas ya generadas con los datos que veía su autora. Antes las leía y escribía
--   cualquier editor, de modo que otra área podía ver datos que no le corresponden. Ahora solo las lee y
--   modifica su dueña (quien las creó) y el admin.
--   eventos, pres, ptpl siguen siendo colecciones compartidas (títulos y opciones, sin datos de iniciativas);
--   cada cambio queda en auditoría y la concurrencia optimista evita pisar cambios ajenos sin aviso.
-- =====================================================================================

alter table public.registros add column if not exists propietario text;
update public.registros set propietario = coalesce(propietario, modificado_por) where lista = 'APIH_Config' and id like 'psnap:%';

-- La dueña se fija al crear y no cambia (ni siquiera cuando edita el admin)
create or replace function public.apih_propietario() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if tg_op = 'INSERT' then new.propietario := public.apih_email(); else new.propietario := old.propietario; end if;
  return new;
end $$;
drop trigger if exists apih_propietario on public.registros;
create trigger apih_propietario before insert or update on public.registros for each row execute function public.apih_propietario();

create or replace function public.apih_es_dueno(p_lista text, p_id text, p_prop text) returns boolean
language sql stable security definer set search_path = public as
$$ select not (p_lista = 'APIH_Config' and p_id like 'psnap:%')
          or public.apih_rol() = 'admin' or p_prop = public.apih_email() $$;

drop policy if exists reg_leer on public.registros;
create policy reg_leer on public.registros for select to authenticated
  using (public.apih_rol() is not null and public.apih_ve_area(area) and lista <> 'APIH_Claves' and public.apih_lee_config(lista, id) and public.apih_es_dueno(lista, id, propietario));

drop policy if exists reg_cambiar on public.registros;
create policy reg_cambiar on public.registros for update to authenticated
  using (public.apih_escribe(lista, id, area) and public.apih_es_dueno(lista, id, propietario))
  with check (public.apih_escribe(lista, id, public.apih_area_de(lista, substr(datos,4)::jsonb)));

drop policy if exists reg_borrar on public.registros;
create policy reg_borrar on public.registros for delete to authenticated
  using (public.apih_escribe(lista, id, area) and public.apih_es_dueno(lista, id, propietario));

create or replace view public.registros_v as
select r.lista, r.id, r.actualizado, r.modificado_por, r.area,
       case when public.apih_ve_montos() then r.datos
            else 'p1.' || ((substr(r.datos, 4)::jsonb) - (select coalesce(array_agg(clave), '{}') from public.claves_monto))::text end as datos
from public.registros r
where public.apih_rol() is not null and public.apih_ve_area(r.area) and r.lista <> 'APIH_Claves' and public.apih_lee_config(r.lista, r.id)
  and public.apih_es_dueno(r.lista, r.id, r.propietario);
alter view public.registros_v owner to postgres;
grant select on public.registros_v to authenticated;
