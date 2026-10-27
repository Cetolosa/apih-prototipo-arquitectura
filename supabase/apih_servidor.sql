-- =====================================================================================
-- APIH · Reglas del servidor (Supabase) — versionado en el repositorio para poder auditarlas
-- Proyecto: apih · Tabla de datos: public.registros(lista, id, datos, actualizado, modificado_por)
-- Modelo: login individual (Supabase Auth) + RLS. Solo entra quien tiene fila en public.perfiles.
-- =====================================================================================

-- ---------------------------------------------------------------------------
-- A) ESTADO ACTUAL (referencia, ya aplicado en el proyecto; NO hace falta volver a ejecutarlo)
-- ---------------------------------------------------------------------------
-- Rol de quien llama (por el correo del JWT). NULL = sin acceso.
--   create or replace function public.apih_rol() returns text language sql stable security definer set search_path = public
--   as $$ select rol from public.perfiles where email = lower(coalesce(auth.jwt() ->> 'email','')) $$;
--
-- Roles: 'admin' (todo) · 'editor' (lee y escribe todo salvo APIH_Roles y APIH_Claves) · otros con perfil (lectura).
-- Políticas sobre public.registros:
--   reg_leer      SELECT  apih_rol() no nulo, y APIH_Claves solo la fila propia
--   reg_insertar  INSERT  admin; editor excepto listas APIH_Roles y APIH_Claves
--   reg_cambiar   UPDATE  igual que insertar
--   reg_borrar    DELETE  admin; editor excepto APIH_Roles y APIH_Claves
--   notas_insertar INSERT en APIH_Notas para cualquier perfil (comentarios por área)
--   claves_insertar / claves_cambiar: cada persona solo su fila de APIH_Claves (en retiro, ver C)
-- Restricción de dominio en el alta de usuarios: trigger apih_dominio sobre auth.users (solo @aramark.cl).
-- Nota: los roles de la app (Gasto, áreas, etc.) viven en la lista APIH_Roles, que solo escribe 'admin'.

-- ---------------------------------------------------------------------------
-- B) ENDURECIMIENTO (ejecutar una vez; se puede repetir sin problema)
-- ---------------------------------------------------------------------------
-- 1. Quién modificó cada registro: lo sella el servidor con el correo del token (el cliente no puede falsearlo).
alter table public.registros add column if not exists modificado_por text;

create or replace function public.apih_sellar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.modificado_por := lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end $$;

drop trigger if exists apih_sello on public.registros;
create trigger apih_sello before insert or update on public.registros
  for each row execute function public.apih_sellar();

-- 2. Los datos nuevos solo se aceptan en el formato vigente ('p1.' + JSON). No revisa lo antiguo (NOT VALID).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'registros_formato_p1') then
    alter table public.registros add constraint registros_formato_p1
      check (lista = 'APIH_Claves' or datos like 'p1.%') not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- C) RETIRO DE LA CLAVE DE EQUIPO (ejecutar SOLO cuando todas las personas ya crearon su contraseña)
-- ---------------------------------------------------------------------------
-- drop policy if exists claves_insertar on public.registros;
-- drop policy if exists claves_cambiar  on public.registros;
-- delete from public.registros where lista = 'APIH_Claves';

-- ---------------------------------------------------------------------------
-- D) DETECCIÓN DE CONFLICTOS ENTRE USUARIOS (V22.34) — ejecutar una vez; se puede repetir
-- ---------------------------------------------------------------------------
-- La app solo guarda un cambio si el registro sigue con la versión (columna actualizado) que leyó.
-- Para que esa versión cambie en cada modificación, el servidor la sella con la hora de cada escritura.
alter table public.registros add column if not exists actualizado timestamptz default now();

create or replace function public.apih_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.actualizado := clock_timestamp();
  return new;
end $$;

drop trigger if exists apih_version on public.registros;
create trigger apih_version before insert or update on public.registros
  for each row execute function public.apih_version();
