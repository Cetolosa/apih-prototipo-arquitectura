-- APIH Prototipo · TODAS las migraciones en orden (generado por tools/empaquetar-migraciones.js; no editar a mano).
-- Pegar completo en Supabase → SQL Editor → Run. Se puede ejecutar más de una vez (no borra datos: solo reglas, funciones y la vista de lectura).

-- La vista de lectura se recrea (las migraciones antiguas la definen con menos columnas que las nuevas).
drop view if exists public.registros_v;

-- ===== 20261027000100_autorizacion_servidor.sql =====
-- =====================================================================================
-- APIH Prototipo · F2 · Autorización aplicada en el servidor (Postgres / Supabase)
-- Rol + área + montos se deciden aquí; la app (navegador) deja de ser la barrera.
-- Idempotente: se puede repetir.
-- Roles de la base:  admin | editor | lector      Roles de la app: Administra | Responsable | Colaborador | Invitado
--   Administra   = admin   (todo, incluye montos y listas de gobierno)
--   Responsable  = editor  (ve todas las áreas, edita solo las suyas; gobierna comités)
--   Colaborador  = editor  (ve y edita solo su área, salvo ve_todo)
--   Invitado     = lector  (ve su área; solo comenta en APIH_Notas)
-- Montos: solo los ve quien tenga ve_montos = true (Administra siempre).
-- =====================================================================================

create extension if not exists pgcrypto;

-- 1. Tablas ---------------------------------------------------------------------------
create table if not exists public.perfiles (
  email      text primary key check (email = lower(email)),
  nombre     text,
  rol        text not null check (rol in ('admin','editor','lector')),
  app_rol    text not null check (app_rol in ('Administra','Responsable','Colaborador','Invitado')),
  areas      text[] not null default '{}',
  ve_todo    boolean not null default false,   -- amplía lo que ve, nunca lo que edita
  ve_montos  boolean not null default false,
  gobierna   boolean not null default false,   -- comités: agenda y acuerdos
  activo     boolean not null default true,
  check ((rol = 'admin') = (app_rol = 'Administra'))
);

create table if not exists public.dominios_permitidos (dominio text primary key check (dominio = lower(dominio)));
create table if not exists public.claves_monto (clave text primary key);       -- campos JSON que se consideran montos
insert into public.claves_monto values ('presupuesto'),('gastado'),('beneficio'),('ahorroReal'),('monto'),('costo')
  on conflict do nothing;

create table if not exists public.registros (
  lista        text not null,
  id           text not null,
  datos        text not null check (datos like 'p1.%'),     -- 'p1.' + JSON (formato vigente de la app)
  actualizado  timestamptz not null default now(),
  modificado_por text,
  area         text,                                         -- derivada por trigger (nunca la envía el cliente)
  primary key (lista, id)
);
-- Bases anteriores: las tablas ya existían con menos columnas (create table if not exists no las completa)
alter table public.registros add column if not exists modificado_por text;
alter table public.registros add column if not exists area text;
alter table public.perfiles add column if not exists nombre text;
alter table public.perfiles add column if not exists app_rol text;
update public.perfiles set app_rol = case rol when 'admin' then 'Administra' when 'editor' then 'Colaborador' else 'Invitado' end where app_rol is null;
alter table public.perfiles add column if not exists areas text[] not null default '{}';
alter table public.perfiles add column if not exists ve_todo boolean not null default false;
alter table public.perfiles add column if not exists ve_montos boolean not null default false;
alter table public.perfiles add column if not exists gobierna boolean not null default false;
alter table public.perfiles add column if not exists activo boolean not null default true;
create index if not exists registros_lista_area_idx on public.registros (lista, area);

create table if not exists public.auditoria (
  n bigserial primary key, ts timestamptz not null default now(), email text, accion text not null,
  lista text, id_registro text, area text, toco_montos boolean not null default false
);

alter table public.auditoria add column if not exists ts timestamptz not null default now();
alter table public.auditoria add column if not exists email text;
alter table public.auditoria add column if not exists lista text;
alter table public.auditoria add column if not exists id_registro text;
alter table public.auditoria add column if not exists area text;
alter table public.auditoria add column if not exists toco_montos boolean not null default false;

-- 2. Funciones de contexto (SECURITY DEFINER: leen perfiles sin exponerla) ---------------
create or replace function public.apih_email() returns text language sql stable as
$$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;

create or replace function public.apih_perfil() returns public.perfiles language sql stable security definer set search_path = public as
$$ select p from public.perfiles p where p.email = public.apih_email() and p.activo $$;

create or replace function public.apih_rol() returns text language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where email = public.apih_email() and activo $$;

create or replace function public.apih_ve_montos() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select rol = 'admin' or ve_montos from public.perfiles where email = public.apih_email() and activo), false) $$;

-- ¿puede ver el área? NULL / Transversal son comunes a todos los perfiles activos
create or replace function public.apih_ve_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select rol = 'admin' or app_rol = 'Responsable' or ve_todo or a is null or a = 'Transversal' or a = any(areas)
                      from public.perfiles where email = public.apih_email() and activo), false) $$;

create or replace function public.apih_edita_area(a text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select case when rol = 'admin' then true when rol = 'lector' then false
                                else (a is null or a = 'Transversal' or a = any(areas)) end
                      from public.perfiles where email = public.apih_email() and activo), false) $$;

-- Listas que solo escribe admin (gobierno / credenciales)
create or replace function public.apih_lista_admin(l text) returns boolean language sql immutable as
$$ select l in ('APIH_Roles','APIH_Claves') $$;

-- Listas con área propia (proyectos y propuestas) o heredada del proyecto (hitos, riesgos, etc.)
create or replace function public.apih_area_de(lista text, j jsonb) returns text language plpgsql stable security definer set search_path = public as
$$ declare a text;
begin
  if lista in ('APIH_Proyectos','APIH_Propuestas') then return nullif(j ->> 'area',''); end if;
  if lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Documentos','APIH_Notas') and nullif(j ->> 'ini','') is not null then
    select r.area into a from public.registros r where r.lista in ('APIH_Proyectos','APIH_Propuestas') and r.id = j ->> 'ini' limit 1;
    return a;
  end if;
  return null;
end $$;

-- 3. Trigger de escritura: sella, deriva área, valida y protege montos ----------------------
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role';   -- SQL/migraciones/service_role: sin JWT de usuario
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista <> 'APIH_Config' then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

drop trigger if exists apih_fila on public.registros;
create trigger apih_fila before insert or update on public.registros for each row execute function public.apih_fila();

create or replace function public.apih_aud_borrar() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into public.auditoria(email, accion, lista, id_registro, area) values (public.apih_email(), 'delete', old.lista, old.id, old.area); return old; end $$;
drop trigger if exists apih_aud_borrar on public.registros;
create trigger apih_aud_borrar after delete on public.registros for each row execute function public.apih_aud_borrar();

-- 4. RLS ---------------------------------------------------------------------------------
alter table public.registros enable row level security;
alter table public.perfiles enable row level security;
alter table public.dominios_permitidos enable row level security;
alter table public.claves_monto enable row level security;
alter table public.auditoria enable row level security;

drop policy if exists reg_leer on public.registros;
create policy reg_leer on public.registros for select to authenticated
  using (public.apih_rol() is not null and public.apih_ve_area(area) and (lista <> 'APIH_Claves'));

drop policy if exists reg_insertar on public.registros;
create policy reg_insertar on public.registros for insert to authenticated
  with check (public.apih_rol() is not null and (
        (lista = 'APIH_Notas' and public.apih_ve_area(public.apih_area_de(lista, substr(datos,4)::jsonb)))      -- comentar: cualquier perfil con acceso al área
     or (public.apih_rol() in ('admin','editor') and not public.apih_lista_admin(lista) and public.apih_edita_area(public.apih_area_de(lista, substr(datos,4)::jsonb)))
     or (public.apih_rol() = 'admin')));

drop policy if exists reg_cambiar on public.registros;
create policy reg_cambiar on public.registros for update to authenticated
  using (public.apih_rol() = 'admin' or (public.apih_rol() = 'editor' and not public.apih_lista_admin(lista) and public.apih_edita_area(area)))
  with check (public.apih_rol() = 'admin' or (public.apih_rol() = 'editor' and not public.apih_lista_admin(lista) and public.apih_edita_area(public.apih_area_de(lista, substr(datos,4)::jsonb))));

drop policy if exists reg_borrar on public.registros;
create policy reg_borrar on public.registros for delete to authenticated
  using (public.apih_rol() = 'admin' or (public.apih_rol() = 'editor' and not public.apih_lista_admin(lista) and public.apih_edita_area(area)));

drop policy if exists perfil_propio on public.perfiles;
create policy perfil_propio on public.perfiles for select to authenticated using (email = public.apih_email() or public.apih_rol() = 'admin');
drop policy if exists perfil_admin on public.perfiles;
create policy perfil_admin on public.perfiles for all to authenticated using (public.apih_rol() = 'admin') with check (public.apih_rol() = 'admin');
drop policy if exists dom_admin on public.dominios_permitidos;
create policy dom_admin on public.dominios_permitidos for all to authenticated using (public.apih_rol() = 'admin') with check (public.apih_rol() = 'admin');
drop policy if exists monto_admin on public.claves_monto;
create policy monto_admin on public.claves_monto for all to authenticated using (public.apih_rol() = 'admin') with check (public.apih_rol() = 'admin');
drop policy if exists aud_admin on public.auditoria;
create policy aud_admin on public.auditoria for select to authenticated using (public.apih_rol() = 'admin');

-- 5. Privilegios: el texto con montos (datos) NO se lee de la tabla; se lee por la vista -----------
revoke all on public.registros, public.perfiles, public.dominios_permitidos, public.claves_monto, public.auditoria from anon, authenticated;
grant select (lista, id, area, actualizado, modificado_por) on public.registros to authenticated;   -- sin 'datos'
grant insert, update, delete on public.registros to authenticated;
grant select on public.perfiles, public.auditoria to authenticated;
grant insert, update, delete on public.perfiles, public.dominios_permitidos, public.claves_monto to authenticated;
grant select on public.dominios_permitidos, public.claves_monto to authenticated;
grant usage, select on sequence public.auditoria_n_seq to authenticated;

-- Vista de lectura: aplica área y quita montos a quien no los ve (jsonb no se puede ocultar con RLS)
create or replace view public.registros_v as
select r.lista, r.id, r.actualizado, r.modificado_por, r.area,
       case when public.apih_ve_montos() then r.datos
            else 'p1.' || ((substr(r.datos, 4)::jsonb) - (select coalesce(array_agg(clave), '{}') from public.claves_monto))::text end as datos
from public.registros r
where public.apih_rol() is not null and public.apih_ve_area(r.area) and r.lista <> 'APIH_Claves';
alter view public.registros_v owner to postgres;
grant select on public.registros_v to authenticated;

-- 6. Alta de usuarios: dominio configurable o perfil pre-registrado -------------------------------
create or replace function public.apih_dominio() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  if not exists (select 1 from public.perfiles where email = lower(new.email) and activo)
     and not exists (select 1 from public.dominios_permitidos where dominio = split_part(lower(new.email), '@', 2)) then
    raise exception 'Correo no autorizado para APIH' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists apih_dominio on auth.users;
create trigger apih_dominio before insert on auth.users for each row execute function public.apih_dominio();

-- Filas anteriores a esta migración: completar el área derivada (sin disparar validaciones ni sellos sobre datos históricos)
alter table public.registros disable trigger user;
update public.registros set area = public.apih_area_de(lista, substr(datos, 4)::jsonb) where area is null and lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{';
update public.registros set area = public.apih_area_de(lista, substr(datos, 4)::jsonb) where area is null and lista not in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{';
alter table public.registros enable trigger user;

-- ===== 20261027000200_config_por_alcance.sql =====
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

-- ===== 20261027000300_aprobar_propuesta.sql =====
-- =====================================================================================
-- APIH Prototipo · F2 · Comandos transaccionales en el servidor
--   apih_aprobar_propuesta(p_id, p_nota, p_forzar): valida compuertas, crea el proyecto, cierra la propuesta,
--   traslada hitos y riesgos, aplica la plantilla de la metodología y deja la bitácora, todo en UNA transacción.
--   Si cualquier paso falla, no queda nada a medias (antes lo hacía el navegador con varias escrituras sueltas).
-- =====================================================================================


-- apih_fila reconoce los comandos del servidor (GUC local a la transacción; el cliente no puede fijarlo)
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista <> 'APIH_Config' then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

-- Configuración completa (el cliente la parte en trozos 'cfg#n' si es grande)
create or replace function public.apih_cfg() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare j jsonb; s text;
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Config' and id = 'cfg';
  if j is null then return '{}'::jsonb; end if;
  if jsonb_typeof(j) = 'object' and j ? '__chunks' then
    select string_agg(substr(datos, 4), '' order by (regexp_replace(id, '^cfg#', ''))::int) into s
      from public.registros where lista = 'APIH_Config' and id ~ '^cfg#[0-9]+$';
    return coalesce(s::jsonb, '{}'::jsonb);
  end if;
  return j;
end $$;

-- Siguiente id correlativo (PRJ-001…): nunca repite y nunca retrocede (considera lo existente y el contador seq)
create or replace function public.apih_siguiente(p_prefijo text, p_lista text) returns text language plpgsql security definer set search_path = public as
$$ declare mx bigint; sq bigint; n bigint; cur jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('apih_id_' || p_prefijo));
  select coalesce(max(substring(id from '^' || p_prefijo || '-([0-9]+)$')::bigint), 0) into mx from public.registros where lista = p_lista and id ~ ('^' || p_prefijo || '-[0-9]+$');
  select coalesce(((substr(datos, 4)::jsonb) ->> p_prefijo)::bigint, 0) into sq from public.registros where lista = 'APIH_Config' and id = 'seq' and left(substr(datos,4),1) = '{';
  n := greatest(mx, coalesce(sq, 0)) + 1;
  select substr(datos, 4)::jsonb into cur from public.registros where lista = 'APIH_Config' and id = 'seq';
  insert into public.registros(lista, id, datos) values ('APIH_Config', 'seq', 'p1.' || jsonb_build_object(p_prefijo, n)::text)
    on conflict (lista, id) do update set datos = 'p1.' || (coalesce(cur, '{}'::jsonb) || jsonb_build_object(p_prefijo, n))::text;
  return p_prefijo || '-' || lpad(n::text, 3, '0');
end $$;

create or replace function public.apih_aprobar_propuesta(p_id text, p_nota text default '', p_forzar boolean default false)
returns text language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; j jsonb; nj jsonb; pj jsonb; cfg jsonb; tipo jsonb; h jsonb; rec record; jr jsonb;
  faltan text[] := '{}'; nuevo text; nota text; fasesprop jsonb; fasesprj jsonb; hn text; base date; n_hit int := 0;
  ba text; bb text; autor text; ts text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;

  select * into r from public.registros where lista = 'APIH_Propuestas' and id = p_id for update;
  if not found then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para aprobar en el área %', coalesce(r.area, '—') using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'estado', '') <> 'Vigente' then raise exception 'APIH: la propuesta no está Vigente (estado: %)', coalesce(j ->> 'estado', '—') using errcode = '22023'; end if;

  -- compuertas (mismas que la pantalla de aprobación)
  if coalesce(j ->> 'fase', '') <> 'Aprobación' then faltan := array_append(faltan, 'Propuesta en fase Aprobación'::text); end if;
  if coalesce(j ->> 'sponsor', '') = '' then faltan := array_append(faltan, 'Sponsor identificado'::text); end if;
  if coalesce(j ->> 'lider', '') = '' then faltan := array_append(faltan, 'Líder asignado'::text); end if;
  if not (jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0) then faltan := array_append(faltan, 'Presupuesto asignado'::text); end if;
  if coalesce(j ->> 'bc', '') = '' then faltan := array_append(faltan, 'Business case redactado'::text); end if;
  if not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
                   and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada') then
    faltan := array_append(faltan, 'Decisión "Iniciar" aprobada en comité'::text);
  end if;
  if cardinality(faltan) > 0 then
    if not (p_forzar and per.rol = 'admin') then
      raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023';
    end if;
    nota := '[forzado: ' || array_to_string(faltan, ', ') || '] ' || btrim(coalesce(p_nota, ''));
  else
    nota := btrim(coalesce(p_nota, ''));
  end if;

  perform set_config('apih.interno', 'on', true);
  cfg := public.apih_cfg();
  fasesprop := coalesce(cfg #> '{metodo,fasesProp}', '["Recepción","Evaluación","Caso de Negocio","Aprobación"]'::jsonb);
  fasesprj  := coalesce(cfg #> '{metodo,fasesPrj}',  '["Planificación","Ejecución","Transición","Cierre"]'::jsonb);
  autor := coalesce(per.nombre, per.email);

  -- 1. proyecto nuevo
  nuevo := public.apih_siguiente('PRJ', 'APIH_Proyectos');
  nj := (j - 'proyecto' - 'legacyId') || jsonb_build_object(
    'id', nuevo, 'tipo', 'Proyecto', 'fase', 'Planificación', 'estado', 'En curso', 'rag', 'Verde', 'propuestaOrigen', p_id,
    'creada', hoy::text, 'actualizada', hoy::text, 'faseDesde', hoy::text, 'avance', 0, 'hist', jsonb_build_array(jsonb_build_array(hoy::text, 0)),
    'inicioReal', null, 'finReal', null, 'rec', null, 'estadoMotivo', '', 'estadoRev', null,
    'origen', coalesce(nullif(j ->> 'origen', ''), 'usuario'), 'finEst', j -> 'finPlan', 'est', coalesce(j -> 'est', '[]'::jsonb));
  insert into public.registros(lista, id, datos) values ('APIH_Proyectos', nuevo, 'p1.' || nj::text);

  -- 2. riesgos y hitos de la propuesta pasan al proyecto; las etapas de propuesta ya superadas se cierran
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Riesgos', 'APIH_Hitos') and left(substr(datos, 4), 1) = '{' and (substr(datos, 4)::jsonb ->> 'ini') = p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{ini}', to_jsonb(nuevo));
    if rec.lista = 'APIH_Hitos' and (jr ->> 'fase') is not null and fasesprop ? (jr ->> 'fase') and coalesce((jr ->> 'completado')::boolean, false) = false then
      jr := jr || jsonb_build_object('completado', true, 'fechaReal', hoy::text);
    end if;
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 3. hitos de la plantilla del tipo para las fases del proyecto
  if coalesce(j ->> 'tipoIni', '') <> '' then
    select t into tipo from jsonb_array_elements(coalesce(cfg #> '{metodo,tipos}', '[]'::jsonb)) t where t ->> 'nombre' = j ->> 'tipoIni' limit 1;
    if tipo is not null then
      base := coalesce(nullif(j ->> 'inicioPlan', '')::date, hoy);
      for h in select x from jsonb_array_elements(coalesce(tipo -> 'hitos', '[]'::jsonb)) x loop
        continue when not (fasesprj ? (h ->> 'fase'));
        continue when exists (select 1 from public.registros x where x.lista = 'APIH_Hitos' and left(substr(x.datos, 4), 1) = '{'
                                and (substr(x.datos, 4)::jsonb ->> 'ini') = nuevo and (substr(x.datos, 4)::jsonb ->> 'nombre') = (h ->> 'n') and (substr(x.datos, 4)::jsonb ->> 'fase') = (h ->> 'fase'));
        hn := public.apih_siguiente('HIT', 'APIH_Hitos');
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hn, 'p1.' || jsonb_build_object(
          'id', hn, 'ini', nuevo, 'nombre', h ->> 'n', 'fase', h ->> 'fase', 'fecha', (base + coalesce((h ->> 'dias')::int, 0))::text,
          'completado', false, 'fechaReal', null, 'resp', coalesce(j ->> 'lider', ''))::text);
        n_hit := n_hit + 1;
      end loop;
    end if;
  end if;

  -- 4. dependencias que apuntaban a la propuesta ahora apuntan al proyecto
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' and jsonb_typeof(substr(datos, 4)::jsonb -> 'deps') = 'array' and (substr(datos, 4)::jsonb -> 'deps') ? p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{deps}',
            (select jsonb_agg(case when d #>> '{}' = p_id then to_jsonb(nuevo) else d end) from jsonb_array_elements(substr(rec.datos, 4)::jsonb -> 'deps') d));
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 5. la propuesta se cierra como Aprobada
  pj := (select substr(datos, 4)::jsonb from public.registros where lista = 'APIH_Propuestas' and id = p_id)
        || jsonb_build_object('estado', 'Aprobada', 'proyecto', nuevo, 'actualizada', hoy::text, 'estadoMotivo', nota, 'estadoRev', null);
  update public.registros set datos = 'p1.' || pj::text where lista = 'APIH_Propuestas' and id = p_id;

  -- 6. bitácora
  ba := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a'; bb := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b';
  insert into public.registros(lista, id, datos) values
   ('APIH_Bitacora', ba, 'p1.' || jsonb_build_object('id', ba,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Decisión', 'ini', p_id, 'autor', autor,
      'texto', 'Propuesta aprobada → proyecto ' || nuevo || case when nota <> '' then ' — ' || nota else '' end, 'meta', null)::text),
   ('APIH_Bitacora', bb, 'p1.' || jsonb_build_object('id', bb,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Cambio', 'ini', nuevo, 'autor', autor,
      'texto', 'Proyecto creado desde la propuesta ' || p_id, 'meta', null)::text);

  perform set_config('apih.interno', 'off', true);
  return nuevo;
end $$;

revoke all on function public.apih_aprobar_propuesta(text, text, boolean) from public, anon;
grant execute on function public.apih_aprobar_propuesta(text, text, boolean) to authenticated;
revoke all on function public.apih_siguiente(text, text), public.apih_cfg() from public, anon, authenticated;

-- ===== 20261027000400_resolver_decision_y_hito.sql =====
-- =====================================================================================
-- APIH Prototipo · F2 · Comandos transaccionales (2): resolver decisión y completar/reabrir hito
--   apih_resolver_decision(p_id, p_estado, p_resolucion, p_fecha, p_aplicar) → jsonb {estado, aplicada, proyecto?, aviso?}
--   apih_hito_estado(p_id, p_completado)                                      → jsonb {completado, fechaReal}
-- Autorización: resolver decisiones = admin o editor con gobierna = true (y con permiso sobre el área);
--               hitos = quien edita el área del proyecto.
-- =====================================================================================

create or replace function public.apih_bitacora(p_ini text, p_tipo text, p_texto text, p_meta text default null)
returns void language plpgsql security definer set search_path = public as
$$ declare per public.perfiles; bid text := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || substr(md5(random()::text), 1, 3);
begin
  select * into per from public.perfiles where email = public.apih_email();
  insert into public.registros(lista, id, datos) values ('APIH_Bitacora', bid, 'p1.' || jsonb_build_object(
    'id', bid, 'ts', (now() at time zone 'America/Santiago')::date::text || 'T' || to_char(now() at time zone 'America/Santiago', 'HH24:MI'),
    'tipo', p_tipo, 'ini', nullif(p_ini, ''), 'autor', coalesce(per.nombre, per.email, public.apih_email()), 'texto', p_texto, 'meta', p_meta)::text);
end $$;
revoke all on function public.apih_bitacora(text, text, text, text) from public, anon, authenticated;

create or replace function public.apih_resolver_decision(p_id text, p_estado text, p_resolucion text default '', p_fecha date default null, p_aplicar boolean default true)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; x jsonb; ir public.registros; i jsonb; tg_lista text;
  aplicada boolean := false; aviso text; nuevo text; mot text; es_prop boolean; hecho boolean; lim date; res text := btrim(coalesce(p_resolucion, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna)) then raise exception 'APIH: solo Administra o Responsable con gobierno resuelven decisiones' using errcode = '42501'; end if;
  if p_estado not in ('Aprobada', 'Rechazada', 'Diferida') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;

  select * into r from public.registros where lista = 'APIH_Decisiones' and id = p_id for update;
  if not found then raise exception 'APIH: la decisión % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la decisión' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  if coalesce(x ->> 'estado', '') <> 'Pendiente' then raise exception 'APIH: la decisión no está Pendiente (estado: %)', coalesce(x ->> 'estado', '—') using errcode = '22023'; end if;
  perform set_config('apih.interno', 'on', true);

  if p_estado = 'Diferida' then
    lim := case when nullif(x ->> 'limite', '') is not null and (x ->> 'limite')::date > hoy then (x ->> 'limite')::date else hoy end + 14;
    x := x || jsonb_build_object('limite', lim::text, 'resolucion', res);
    update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;
    perform public.apih_bitacora(x ->> 'ini', 'Decisión', 'Decisión diferida: ' || coalesce(x ->> 'titulo', ''), 'Nueva fecha ' || lim::text);
    perform set_config('apih.interno', 'off', true);
    return jsonb_build_object('estado', 'Diferida', 'aplicada', false, 'limite', lim::text);
  end if;

  x := x || jsonb_build_object('estado', p_estado, 'resolucion', res, 'fResol', coalesce(p_fecha, hoy)::text, 'aplicada', false);
  update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;

  if p_estado = 'Aprobada' and p_aplicar and coalesce(x ->> 'ini', '') <> '' then
    select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = x ->> 'ini' for update;
    if found then
      i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas';
      hecho := (es_prop and (i ->> 'estado') in ('Aprobada', 'Rechazada', 'Retirada')) or (not es_prop and (i ->> 'estado') in ('Completado', 'Cancelado'));
      mot := coalesce(nullif(res, ''), 'Decisión de comité ' || coalesce(x ->> 'comite', ''));
      if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

      if (x ->> 'tipo') = 'Iniciar' and es_prop and not hecho then
        begin
          nuevo := public.apih_aprobar_propuesta(ir.id, mot, false);     -- hace sus propias compuertas; si falta algo, la decisión queda resuelta sin efecto
          aplicada := true;
        exception when others then
          aviso := 'No se crea el proyecto. ' || regexp_replace(sqlerrm, '^APIH:\s*', '');
        end;
        perform set_config('apih.interno', 'on', true);
        select substr(datos, 4)::jsonb into i from public.registros where lista = ir.lista and id = ir.id;
      elsif (x ->> 'tipo') = 'Acelerar' and not es_prop then
        i := i || jsonb_build_object('prioridad', 'Alta');
        if (i ->> 'estado') = 'Pausado' then i := i || jsonb_build_object('estado', 'En curso', 'estadoMotivo', '', 'estadoRev', null); end if;
        aplicada := true;
      elsif (x ->> 'tipo') = 'Pausar' and not hecho then
        i := i || jsonb_build_object('estado', case when es_prop then 'En espera' else 'Pausado' end, 'estadoMotivo', mot, 'estadoRev', (hoy + 30)::text);
        aplicada := true;
      elsif (x ->> 'tipo') = 'Cancelar' and not hecho then
        i := i || jsonb_build_object('estado', case when es_prop then 'Rechazada' else 'Cancelado' end, 'estadoMotivo', mot, 'estadoRev', null);
        aplicada := true;
      elsif (x ->> 'tipo') in ('Pausar', 'Cancelar') and hecho then
        aviso := 'El proyecto ya está cerrado: no se aplica el efecto';
      end if;
      i := i || jsonb_build_object('actualizada', hoy::text);
      update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
    end if;
  end if;

  if aplicada then
    x := x || jsonb_build_object('aplicada', true);
    update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;
  end if;
  perform public.apih_bitacora(x ->> 'ini', 'Decisión', (x ->> 'tipo') || ' · ' || p_estado || ': ' || coalesce(x ->> 'titulo', '') || case when res <> '' then ' — ' || res else '' end,
                               case when aplicada then 'Efecto aplicado' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_strip_nulls(jsonb_build_object('estado', p_estado, 'aplicada', aplicada, 'proyecto', nuevo, 'aviso', aviso));
end $$;

create or replace function public.apih_hito_estado(p_id text, p_completado boolean)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := (now() at time zone 'America/Santiago')::date; r public.registros; h jsonb; ir public.registros; i jsonb;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
  if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para editar hitos de esta área' using errcode = '42501'; end if;
  h := substr(r.datos, 4)::jsonb;
  h := h || jsonb_build_object('completado', p_completado, 'fechaReal', case when p_completado then hoy::text else null end);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || h::text where lista = 'APIH_Hitos' and id = p_id;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = h ->> 'ini';
  if found then
    i := substr(ir.datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text);
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(h ->> 'ini', 'Actualización', case when p_completado then 'Hito completado: ' else 'Hito reabierto: ' end || coalesce(h ->> 'nombre', ''));
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('completado', p_completado, 'fechaReal', h -> 'fechaReal');
end $$;

revoke all on function public.apih_resolver_decision(text, text, text, date, boolean), public.apih_hito_estado(text, boolean) from public, anon;
grant execute on function public.apih_resolver_decision(text, text, text, date, boolean), public.apih_hito_estado(text, boolean) to authenticated;

-- ===== 20261027000500_cambios_y_reapertura.sql =====
-- =====================================================================================
-- APIH Prototipo · F2 · Comandos: solicitar cambio, resolver cambio y reabrir
--   apih_solicitar_cambio(...)           registra la solicitud con la línea base vigente (fecha/presupuesto anteriores)
--   apih_resolver_cambio(id, estado, nota) aprueba (aplica a la línea base) o rechaza, en una transacción
--   apih_reabrir(id, nota)               proyecto cerrado -> En curso (solo Administra); propuesta Rechazada/Retirada -> Vigente
-- Los montos de la solicitud (pNue, pAnt) se tratan como montos: solo los ve y los fija quien tiene ve_montos.
-- =====================================================================================

insert into public.claves_monto values ('pNue'), ('pAnt') on conflict do nothing;

create or replace function public.apih_solicitar_cambio(p_ini text, p_tipo text, p_desc text, p_motivo text, p_impacto text default '',
                                                        p_fnue date default null, p_pnue numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; id text; c jsonb; efecto text[] := '{}'; fant date;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_tipo not in ('Alcance', 'Fecha', 'Presupuesto', 'Recursos', 'Otro') then raise exception 'APIH: tipo de cambio inválido (%)', p_tipo using errcode = '22023'; end if;
  if btrim(coalesce(p_desc, '')) = '' or btrim(coalesce(p_motivo, '')) = '' then raise exception 'APIH: indica qué cambia y por qué' using errcode = '22023'; end if;
  if coalesce(p_pnue, 0) < 0 then raise exception 'APIH: el presupuesto no puede ser negativo' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and registros.id = p_ini;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_ini using errcode = 'P0002'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if coalesce(p_pnue, 0) > 0 and not public.apih_ve_montos() then raise exception 'APIH: sin permiso para proponer montos' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb;
  fant := nullif(i ->> 'finPlan', '')::date;
  if p_fnue is not null and p_fnue = fant and coalesce(p_pnue, 0) = 0 then raise exception 'APIH: la nueva fecha es igual a la actual' using errcode = '22023'; end if;
  if p_fnue is not null and nullif(i ->> 'inicioPlan', '') is not null and p_fnue < (i ->> 'inicioPlan')::date then
    raise exception 'APIH: la nueva fecha de fin no puede ser anterior al inicio plan (%)', i ->> 'inicioPlan' using errcode = '22023'; end if;

  perform set_config('apih.interno', 'on', true);
  id := public.apih_siguiente('CHG', 'APIH_Cambios');
  c := jsonb_build_object('id', id, 'ini', p_ini, 'tipo', p_tipo, 'desc', btrim(p_desc), 'motivo', btrim(p_motivo), 'impacto', coalesce(p_impacto, ''),
        'fNue', p_fnue::text, 'pNue', coalesce(p_pnue, 0), 'solicita', coalesce(per.nombre, per.email), 'fAnt', fant::text, 'pAnt', coalesce((i ->> 'presupuesto')::numeric, 0),
        'estado', 'Solicitado', 'aprobador', '', 'fDec', null, 'nota', '', 'creada', hoy::text);
  insert into public.registros(lista, id, datos) values ('APIH_Cambios', id, 'p1.' || c::text);
  if p_fnue is not null then efecto := array_append(efecto, 'Fin plan ' || coalesce(fant::text, '—') || ' → ' || p_fnue::text); end if;
  if coalesce(p_pnue, 0) > 0 then efecto := array_append(efecto, 'Cambio de presupuesto'::text); end if;
  perform public.apih_bitacora(p_ini, 'Cambio', 'Solicitud de cambio ' || id || ' (' || p_tipo || '): ' || btrim(p_desc) || '. ' || coalesce(nullif(array_to_string(efecto, ' · '), ''), 'Sin efecto en fecha ni presupuesto'));
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('id', id);
end $$;

create or replace function public.apih_resolver_cambio(p_id text, p_estado text, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; c jsonb; ir public.registros; i jsonb; ap boolean := p_estado = 'Aprobado'; nota text := btrim(coalesce(p_nota, '')); es_sponsor boolean;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_estado not in ('Aprobado', 'Rechazado') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;
  if not ap and nota = '' then raise exception 'APIH: indica el motivo del rechazo' using errcode = '22023'; end if;
  select * into r from public.registros where lista = 'APIH_Cambios' and id = p_id for update;
  if not found then raise exception 'APIH: el cambio % no existe', p_id using errcode = 'P0002'; end if;
  c := substr(r.datos, 4)::jsonb;
  if c ->> 'estado' <> 'Solicitado' then raise exception 'APIH: el cambio ya fue resuelto (%)', c ->> 'estado' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = c ->> 'ini' for update;
  if not found then raise exception 'APIH: la iniciativa del cambio no existe' using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  es_sponsor := nullif(i ->> 'sponsor', '') is not null and (i ->> 'sponsor') in (coalesce(per.nombre, ''), per.email);
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or es_sponsor) then
    raise exception 'APIH: solo el sponsor, Responsable o Administra resuelven cambios' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if ap and coalesce((c ->> 'pNue')::numeric, 0) > 0 and not public.apih_ve_montos() then
    raise exception 'APIH: aprobar un cambio de presupuesto requiere permiso de montos' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  c := c || jsonb_build_object('estado', p_estado, 'aprobador', coalesce(per.nombre, per.email), 'nota', nota, 'fDec', hoy::text);
  update public.registros set datos = 'p1.' || c::text where lista = 'APIH_Cambios' and id = p_id;
  if ap then
    if nullif(c ->> 'fNue', '') is not null then
      i := i || jsonb_build_object('finPlan', c ->> 'fNue');
      if nullif(i ->> 'finEst', '') is null or (i ->> 'finEst') < (c ->> 'fNue') then i := i || jsonb_build_object('finEst', c ->> 'fNue'); end if;
    end if;
    if coalesce((c ->> 'pNue')::numeric, 0) > 0 then i := i || jsonb_build_object('presupuesto', (c ->> 'pNue')::numeric); end if;
    i := i || jsonb_build_object('actualizada', hoy::text);
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(c ->> 'ini', 'Decisión', 'Cambio ' || p_id || case when ap then ' aprobado' else ' rechazado' end || ' por ' || (c ->> 'aprobador') || case when nota <> '' then ': ' || nota else '' end,
                               case when ap then 'Línea base actualizada' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', p_estado, 'aplicado', ap);
end $$;

create or replace function public.apih_reabrir(p_id text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; prev text; es_prop boolean; nota text := btrim(coalesce(p_nota, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nota = '' then raise exception 'APIH: indica el motivo de la reapertura' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb; prev := i ->> 'estado'; es_prop := ir.lista = 'APIH_Propuestas';
  if es_prop and prev not in ('Rechazada', 'Retirada') then raise exception 'APIH: solo se reabren propuestas Rechazadas o Retiradas (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and prev not in ('Completado', 'Cancelado') then raise exception 'APIH: solo se reabren proyectos cerrados (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and per.rol <> 'admin' then raise exception 'APIH: solo Administra puede reabrir un proyecto cerrado' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  i := i || jsonb_build_object('estado', case when es_prop then 'Vigente' else 'En curso' end, 'estadoMotivo', '', 'estadoRev', null, 'actualizada', hoy::text);
  if not es_prop then i := i || jsonb_build_object('finReal', null); end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', case when es_prop then 'Propuesta reabierta' else 'Proyecto reabierto' end || ' (era ' || prev || '): ' || nota);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', i ->> 'estado');
end $$;

revoke all on function public.apih_solicitar_cambio(text, text, text, text, text, date, numeric), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) from public, anon;
grant execute on function public.apih_solicitar_cambio(text, text, text, text, text, date, numeric), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) to authenticated;

-- ===== 20261027000600_validacion_servidor.sql =====
-- =====================================================================================
-- APIH Prototipo · F2 · Validación de estructura en la base (portable: PL/pgSQL, sin extensiones)
--   apih_validar(lista, id, json): el servidor rechaza fechas mal formadas, estados fuera de catálogo,
--   escalas de riesgo fuera de rango, ids que no coinciden y tipos incorrectos. Antes solo lo hacía el navegador.
--   Índices para las búsquedas por iniciativa y por estado.
-- =====================================================================================

create or replace function public.apih_validar(p_lista text, p_id text, j jsonb) returns void language plpgsql immutable set search_path = public as
$$
declare k text; v text; n numeric;
begin
  if p_lista not like 'APIH\_%' or p_lista in ('APIH_Config', 'APIH_Roles', 'APIH_Claves') then return; end if;
  if j ? 'id' and (j ->> 'id') is distinct from p_id then raise exception 'APIH: el id del contenido (%) no coincide con el registro (%)', j ->> 'id', p_id using errcode = '22023'; end if;
  foreach k in array array['inicioPlan','finPlan','finEst','inicioReal','finReal','fecha','fechaReal','limite','fResol','fDec','creada','actualizada','estadoRev','fIdent'] loop
    v := j ->> k;
    if v is not null and v <> '' then
      if jsonb_typeof(j -> k) <> 'string' or v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'APIH: % debe ser una fecha AAAA-MM-DD', k using errcode = '22023'; end if;
      begin perform v::date; exception when others then raise exception 'APIH: % no es una fecha válida (%)', k, v using errcode = '22023'; end;
    end if;
  end loop;
  if p_lista = 'APIH_Proyectos' and coalesce(j ->> 'estado', 'En curso') not in ('En curso','Pausado','Stand By','Completado','Cancelado') then
    raise exception 'APIH: estado de proyecto inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista = 'APIH_Propuestas' and coalesce(j ->> 'estado', 'Vigente') not in ('Vigente','En espera','Stand By','Aprobada','Rechazada','Retirada') then
    raise exception 'APIH: estado de propuesta inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista in ('APIH_Proyectos', 'APIH_Propuestas') then
    if coalesce(j ->> 'rag', 'Verde') not in ('Verde','Ámbar','Rojo') then raise exception 'APIH: RAG inválido (%)', j ->> 'rag' using errcode = '22023'; end if;
    if coalesce(nullif(j ->> 'prioridad', ''), 'Media') not in ('Alta','Media','Baja') then raise exception 'APIH: prioridad inválida (%)', j ->> 'prioridad' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Decisiones' then
    if coalesce(j ->> 'tipo', 'Mantener') not in ('Iniciar','Acelerar','Mantener','Pausar','Cancelar') then raise exception 'APIH: tipo de decisión inválido (%)', j ->> 'tipo' using errcode = '22023'; end if;
    if coalesce(j ->> 'estado', 'Pendiente') not in ('Pendiente','Aprobada','Rechazada','Diferida') then raise exception 'APIH: estado de decisión inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Cambios' and coalesce(j ->> 'estado', 'Solicitado') not in ('Solicitado','Aprobado','Rechazado') then
    raise exception 'APIH: estado de cambio inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista = 'APIH_Hitos' then
    if btrim(coalesce(j ->> 'nombre', '')) = '' then raise exception 'APIH: el hito necesita nombre' using errcode = '22023'; end if;
    if j ? 'completado' and jsonb_typeof(j -> 'completado') not in ('boolean', 'null') then raise exception 'APIH: completado debe ser verdadero o falso' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Riesgos' then
    foreach k in array array['prob','imp'] loop
      if j ? k and jsonb_typeof(j -> k) <> 'null' then
        if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
        n := (j ->> k)::numeric; if n < 1 or n > 5 then raise exception 'APIH: % fuera de 1..5', k using errcode = '22023'; end if;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista <> 'APIH_Config' then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  perform public.apih_validar(new.lista, new.id, jn);
  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

-- Índices: búsquedas por iniciativa (hitos, riesgos, decisiones, cambios...) y por estado
create index if not exists registros_ini_idx on public.registros (lista, ((substr(datos, 4)::jsonb) ->> 'ini'))
  where lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Notas','APIH_Documentos') and left(substr(datos, 4), 1) = '{';
create index if not exists registros_estado_idx on public.registros (lista, ((substr(datos, 4)::jsonb) ->> 'estado'))
  where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Decisiones','APIH_Cambios') and left(substr(datos, 4), 1) = '{';

-- ===== 20261027000700_compuertas_unificadas.sql =====
-- =====================================================================================
-- APIH Prototipo · F3 · Una sola definición de las compuertas de aprobación
--   apih_faltan_aprobar(id) devuelve las compuertas incumplidas; apih_aprobar_propuesta la usa.
--   La app las muestra con su propia copia (necesita pintarlas sin esperar a la red); un contrato
--   compartido (tests/contract/gates_aprobar.json) se prueba contra AMBAS para que no diverjan.
-- =====================================================================================

create or replace function public.apih_faltan_aprobar(p_id text) returns text[] language plpgsql stable security definer set search_path = public as
$$
declare j jsonb; faltan text[] := '{}';
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Propuestas' and id = p_id and left(substr(datos, 4), 1) = '{';
  if j is null then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if coalesce(j ->> 'fase', '') <> 'Aprobación' then faltan := array_append(faltan, 'Propuesta en fase Aprobación'::text); end if;
  if coalesce(j ->> 'sponsor', '') = '' then faltan := array_append(faltan, 'Sponsor identificado'::text); end if;
  if coalesce(j ->> 'lider', '') = '' then faltan := array_append(faltan, 'Líder asignado'::text); end if;
  if not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) then faltan := array_append(faltan, 'Presupuesto asignado'::text); end if;
  if coalesce(j ->> 'bc', '') = '' then faltan := array_append(faltan, 'Business case redactado'::text); end if;
  if not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
                   and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada') then
    faltan := array_append(faltan, 'Decisión "Iniciar" aprobada en comité'::text);
  end if;
  return faltan;
end $$;
revoke all on function public.apih_faltan_aprobar(text) from public, anon;
grant execute on function public.apih_faltan_aprobar(text) to authenticated;

create or replace function public.apih_aprobar_propuesta(p_id text, p_nota text default '', p_forzar boolean default false)
returns text language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; j jsonb; nj jsonb; pj jsonb; cfg jsonb; tipo jsonb; h jsonb; rec record; jr jsonb;
  faltan text[] := '{}'; nuevo text; nota text; fasesprop jsonb; fasesprj jsonb; hn text; base date; n_hit int := 0;
  ba text; bb text; autor text; ts text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;

  select * into r from public.registros where lista = 'APIH_Propuestas' and id = p_id for update;
  if not found then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para aprobar en el área %', coalesce(r.area, '—') using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'estado', '') <> 'Vigente' then raise exception 'APIH: la propuesta no está Vigente (estado: %)', coalesce(j ->> 'estado', '—') using errcode = '22023'; end if;

  -- compuertas: una sola definición en apih_faltan_aprobar (la app la replica solo para mostrarla; ver tests/contract)
  faltan := public.apih_faltan_aprobar(p_id);
  if cardinality(faltan) > 0 then
    if not (p_forzar and per.rol = 'admin') then
      raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023';
    end if;
    nota := '[forzado: ' || array_to_string(faltan, ', ') || '] ' || btrim(coalesce(p_nota, ''));
  else
    nota := btrim(coalesce(p_nota, ''));
  end if;

  perform set_config('apih.interno', 'on', true);
  cfg := public.apih_cfg();
  fasesprop := coalesce(cfg #> '{metodo,fasesProp}', '["Recepción","Evaluación","Caso de Negocio","Aprobación"]'::jsonb);
  fasesprj  := coalesce(cfg #> '{metodo,fasesPrj}',  '["Planificación","Ejecución","Transición","Cierre"]'::jsonb);
  autor := coalesce(per.nombre, per.email);

  -- 1. proyecto nuevo
  nuevo := public.apih_siguiente('PRJ', 'APIH_Proyectos');
  nj := (j - 'proyecto' - 'legacyId') || jsonb_build_object(
    'id', nuevo, 'tipo', 'Proyecto', 'fase', 'Planificación', 'estado', 'En curso', 'rag', 'Verde', 'propuestaOrigen', p_id,
    'creada', hoy::text, 'actualizada', hoy::text, 'faseDesde', hoy::text, 'avance', 0, 'hist', jsonb_build_array(jsonb_build_array(hoy::text, 0)),
    'inicioReal', null, 'finReal', null, 'rec', null, 'estadoMotivo', '', 'estadoRev', null,
    'origen', coalesce(nullif(j ->> 'origen', ''), 'usuario'), 'finEst', j -> 'finPlan', 'est', coalesce(j -> 'est', '[]'::jsonb));
  insert into public.registros(lista, id, datos) values ('APIH_Proyectos', nuevo, 'p1.' || nj::text);

  -- 2. riesgos y hitos de la propuesta pasan al proyecto; las etapas de propuesta ya superadas se cierran
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Riesgos', 'APIH_Hitos') and left(substr(datos, 4), 1) = '{' and (substr(datos, 4)::jsonb ->> 'ini') = p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{ini}', to_jsonb(nuevo));
    if rec.lista = 'APIH_Hitos' and (jr ->> 'fase') is not null and fasesprop ? (jr ->> 'fase') and coalesce((jr ->> 'completado')::boolean, false) = false then
      jr := jr || jsonb_build_object('completado', true, 'fechaReal', hoy::text);
    end if;
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 3. hitos de la plantilla del tipo para las fases del proyecto
  if coalesce(j ->> 'tipoIni', '') <> '' then
    select t into tipo from jsonb_array_elements(coalesce(cfg #> '{metodo,tipos}', '[]'::jsonb)) t where t ->> 'nombre' = j ->> 'tipoIni' limit 1;
    if tipo is not null then
      base := coalesce(nullif(j ->> 'inicioPlan', '')::date, hoy);
      for h in select x from jsonb_array_elements(coalesce(tipo -> 'hitos', '[]'::jsonb)) x loop
        continue when not (fasesprj ? (h ->> 'fase'));
        continue when exists (select 1 from public.registros x where x.lista = 'APIH_Hitos' and left(substr(x.datos, 4), 1) = '{'
                                and (substr(x.datos, 4)::jsonb ->> 'ini') = nuevo and (substr(x.datos, 4)::jsonb ->> 'nombre') = (h ->> 'n') and (substr(x.datos, 4)::jsonb ->> 'fase') = (h ->> 'fase'));
        hn := public.apih_siguiente('HIT', 'APIH_Hitos');
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hn, 'p1.' || jsonb_build_object(
          'id', hn, 'ini', nuevo, 'nombre', h ->> 'n', 'fase', h ->> 'fase', 'fecha', (base + coalesce((h ->> 'dias')::int, 0))::text,
          'completado', false, 'fechaReal', null, 'resp', coalesce(j ->> 'lider', ''))::text);
        n_hit := n_hit + 1;
      end loop;
    end if;
  end if;

  -- 4. dependencias que apuntaban a la propuesta ahora apuntan al proyecto
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' and jsonb_typeof(substr(datos, 4)::jsonb -> 'deps') = 'array' and (substr(datos, 4)::jsonb -> 'deps') ? p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{deps}',
            (select jsonb_agg(case when d #>> '{}' = p_id then to_jsonb(nuevo) else d end) from jsonb_array_elements(substr(rec.datos, 4)::jsonb -> 'deps') d));
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 5. la propuesta se cierra como Aprobada
  pj := (select substr(datos, 4)::jsonb from public.registros where lista = 'APIH_Propuestas' and id = p_id)
        || jsonb_build_object('estado', 'Aprobada', 'proyecto', nuevo, 'actualizada', hoy::text, 'estadoMotivo', nota, 'estadoRev', null);
  update public.registros set datos = 'p1.' || pj::text where lista = 'APIH_Propuestas' and id = p_id;

  -- 6. bitácora
  ba := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a'; bb := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b';
  insert into public.registros(lista, id, datos) values
   ('APIH_Bitacora', ba, 'p1.' || jsonb_build_object('id', ba,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Decisión', 'ini', p_id, 'autor', autor,
      'texto', 'Propuesta aprobada → proyecto ' || nuevo || case when nota <> '' then ' — ' || nota else '' end, 'meta', null)::text),
   ('APIH_Bitacora', bb, 'p1.' || jsonb_build_object('id', bb,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Cambio', 'ini', nuevo, 'autor', autor,
      'texto', 'Proyecto creado desde la propuesta ' || p_id, 'meta', null)::text);

  perform set_config('apih.interno', 'off', true);
  return nuevo;
end $$;

-- ===== 20261027000800_errores_con_campo.sql =====
-- =====================================================================================
-- APIH Prototipo · F3 · Errores del servidor con el campo afectado (HINT)
--   La app marca el campo del formulario que el servidor rechazó. Mismas reglas que antes; solo se agrega el campo.
-- =====================================================================================

create or replace function public.apih_validar(p_lista text, p_id text, j jsonb) returns void language plpgsql immutable set search_path = public as
$$
declare k text; v text; n numeric;
begin
  if p_lista not like 'APIH\_%' or p_lista in ('APIH_Config', 'APIH_Roles', 'APIH_Claves') then return; end if;
  if j ? 'id' and (j ->> 'id') is distinct from p_id then raise exception 'APIH: el id del contenido (%) no coincide con el registro (%)', j ->> 'id', p_id using errcode = '22023', hint = 'id'; end if;
  foreach k in array array['inicioPlan','finPlan','finEst','inicioReal','finReal','fecha','fechaReal','limite','fResol','fDec','creada','actualizada','estadoRev','fIdent'] loop
    v := j ->> k;
    if v is not null and v <> '' then
      if jsonb_typeof(j -> k) <> 'string' or v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'APIH: % debe ser una fecha AAAA-MM-DD', k using errcode = '22023', hint = k; end if;
      begin perform v::date; exception when others then raise exception 'APIH: % no es una fecha válida (%)', k, v using errcode = '22023', hint = k; end;
    end if;
  end loop;
  if p_lista = 'APIH_Proyectos' and coalesce(j ->> 'estado', 'En curso') not in ('En curso','Pausado','Stand By','Completado','Cancelado') then
    raise exception 'APIH: estado de proyecto inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista = 'APIH_Propuestas' and coalesce(j ->> 'estado', 'Vigente') not in ('Vigente','En espera','Stand By','Aprobada','Rechazada','Retirada') then
    raise exception 'APIH: estado de propuesta inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista in ('APIH_Proyectos', 'APIH_Propuestas') then
    if coalesce(j ->> 'rag', 'Verde') not in ('Verde','Ámbar','Rojo') then raise exception 'APIH: RAG inválido (%)', j ->> 'rag' using errcode = '22023', hint = 'rag'; end if;
    if coalesce(nullif(j ->> 'prioridad', ''), 'Media') not in ('Alta','Media','Baja') then raise exception 'APIH: prioridad inválida (%)', j ->> 'prioridad' using errcode = '22023', hint = 'prioridad'; end if;
  end if;
  if p_lista = 'APIH_Decisiones' then
    if coalesce(j ->> 'tipo', 'Mantener') not in ('Iniciar','Acelerar','Mantener','Pausar','Cancelar') then raise exception 'APIH: tipo de decisión inválido (%)', j ->> 'tipo' using errcode = '22023', hint = 'tipo'; end if;
    if coalesce(j ->> 'estado', 'Pendiente') not in ('Pendiente','Aprobada','Rechazada','Diferida') then raise exception 'APIH: estado de decisión inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  end if;
  if p_lista = 'APIH_Cambios' and coalesce(j ->> 'estado', 'Solicitado') not in ('Solicitado','Aprobado','Rechazado') then
    raise exception 'APIH: estado de cambio inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista = 'APIH_Hitos' then
    if btrim(coalesce(j ->> 'nombre', '')) = '' then raise exception 'APIH: el hito necesita nombre' using errcode = '22023', hint = 'nombre'; end if;
    if j ? 'completado' and jsonb_typeof(j -> 'completado') not in ('boolean', 'null') then raise exception 'APIH: completado debe ser verdadero o falso' using errcode = '22023', hint = 'completado'; end if;
  end if;
  if p_lista = 'APIH_Riesgos' then
    foreach k in array array['prob','imp'] loop
      if j ? k and jsonb_typeof(j -> k) <> 'null' then
        if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023', hint = k; end if;
        n := (j ->> k)::numeric; if n < 1 or n > 5 then raise exception 'APIH: % fuera de 1..5', k using errcode = '22023', hint = k; end if;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.apih_solicitar_cambio(p_ini text, p_tipo text, p_desc text, p_motivo text, p_impacto text default '',
                                                        p_fnue date default null, p_pnue numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; id text; c jsonb; efecto text[] := '{}'; fant date;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_tipo not in ('Alcance', 'Fecha', 'Presupuesto', 'Recursos', 'Otro') then raise exception 'APIH: tipo de cambio inválido (%)', p_tipo using errcode = '22023', hint = 'tipo'; end if;
  if btrim(coalesce(p_desc, '')) = '' then raise exception 'APIH: indica qué cambia' using errcode = '22023', hint = 'desc'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'APIH: indica por qué (motivo)' using errcode = '22023', hint = 'motivo'; end if;
  if coalesce(p_pnue, 0) < 0 then raise exception 'APIH: el presupuesto no puede ser negativo' using errcode = '22023', hint = 'pNue'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and registros.id = p_ini;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_ini using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if coalesce(p_pnue, 0) > 0 and not public.apih_ve_montos() then raise exception 'APIH: sin permiso para proponer montos' using errcode = '42501', hint = 'pNue'; end if;
  i := substr(ir.datos, 4)::jsonb;
  fant := nullif(i ->> 'finPlan', '')::date;
  if p_fnue is not null and p_fnue = fant and coalesce(p_pnue, 0) = 0 then raise exception 'APIH: la nueva fecha es igual a la actual' using errcode = '22023', hint = 'fNue'; end if;
  if p_fnue is not null and nullif(i ->> 'inicioPlan', '') is not null and p_fnue < (i ->> 'inicioPlan')::date then
    raise exception 'APIH: la nueva fecha de fin no puede ser anterior al inicio plan (%)', i ->> 'inicioPlan' using errcode = '22023', hint = 'fNue'; end if;

  perform set_config('apih.interno', 'on', true);
  id := public.apih_siguiente('CHG', 'APIH_Cambios');
  c := jsonb_build_object('id', id, 'ini', p_ini, 'tipo', p_tipo, 'desc', btrim(p_desc), 'motivo', btrim(p_motivo), 'impacto', coalesce(p_impacto, ''),
        'fNue', p_fnue::text, 'pNue', coalesce(p_pnue, 0), 'solicita', coalesce(per.nombre, per.email), 'fAnt', fant::text, 'pAnt', coalesce((i ->> 'presupuesto')::numeric, 0),
        'estado', 'Solicitado', 'aprobador', '', 'fDec', null, 'nota', '', 'creada', hoy::text);
  insert into public.registros(lista, id, datos) values ('APIH_Cambios', id, 'p1.' || c::text);
  if p_fnue is not null then efecto := array_append(efecto, 'Fin plan ' || coalesce(fant::text, '—') || ' → ' || p_fnue::text); end if;
  if coalesce(p_pnue, 0) > 0 then efecto := array_append(efecto, 'Cambio de presupuesto'::text); end if;
  perform public.apih_bitacora(p_ini, 'Cambio', 'Solicitud de cambio ' || id || ' (' || p_tipo || '): ' || btrim(p_desc) || '. ' || coalesce(nullif(array_to_string(efecto, ' · '), ''), 'Sin efecto en fecha ni presupuesto'));
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('id', id);
end $$;

create or replace function public.apih_resolver_cambio(p_id text, p_estado text, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; c jsonb; ir public.registros; i jsonb; ap boolean := p_estado = 'Aprobado'; nota text := btrim(coalesce(p_nota, '')); es_sponsor boolean;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_estado not in ('Aprobado', 'Rechazado') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;
  if not ap and nota = '' then raise exception 'APIH: indica el motivo del rechazo' using errcode = '22023', hint = 'nota'; end if;
  select * into r from public.registros where lista = 'APIH_Cambios' and id = p_id for update;
  if not found then raise exception 'APIH: el cambio % no existe', p_id using errcode = 'P0002'; end if;
  c := substr(r.datos, 4)::jsonb;
  if c ->> 'estado' <> 'Solicitado' then raise exception 'APIH: el cambio ya fue resuelto (%)', c ->> 'estado' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = c ->> 'ini' for update;
  if not found then raise exception 'APIH: la iniciativa del cambio no existe' using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  es_sponsor := nullif(i ->> 'sponsor', '') is not null and (i ->> 'sponsor') in (coalesce(per.nombre, ''), per.email);
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or es_sponsor) then
    raise exception 'APIH: solo el sponsor, Responsable o Administra resuelven cambios' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if ap and coalesce((c ->> 'pNue')::numeric, 0) > 0 and not public.apih_ve_montos() then
    raise exception 'APIH: aprobar un cambio de presupuesto requiere permiso de montos' using errcode = '42501', hint = 'pNue'; end if;

  perform set_config('apih.interno', 'on', true);
  c := c || jsonb_build_object('estado', p_estado, 'aprobador', coalesce(per.nombre, per.email), 'nota', nota, 'fDec', hoy::text);
  update public.registros set datos = 'p1.' || c::text where lista = 'APIH_Cambios' and id = p_id;
  if ap then
    if nullif(c ->> 'fNue', '') is not null then
      i := i || jsonb_build_object('finPlan', c ->> 'fNue');
      if nullif(i ->> 'finEst', '') is null or (i ->> 'finEst') < (c ->> 'fNue') then i := i || jsonb_build_object('finEst', c ->> 'fNue'); end if;
    end if;
    if coalesce((c ->> 'pNue')::numeric, 0) > 0 then i := i || jsonb_build_object('presupuesto', (c ->> 'pNue')::numeric); end if;
    i := i || jsonb_build_object('actualizada', hoy::text);
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(c ->> 'ini', 'Decisión', 'Cambio ' || p_id || case when ap then ' aprobado' else ' rechazado' end || ' por ' || (c ->> 'aprobador') || case when nota <> '' then ': ' || nota else '' end,
                               case when ap then 'Línea base actualizada' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', p_estado, 'aplicado', ap);
end $$;

create or replace function public.apih_reabrir(p_id text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; prev text; es_prop boolean; nota text := btrim(coalesce(p_nota, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nota = '' then raise exception 'APIH: indica el motivo de la reapertura' using errcode = '22023', hint = 'nota'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  i := substr(ir.datos, 4)::jsonb; prev := i ->> 'estado'; es_prop := ir.lista = 'APIH_Propuestas';
  if es_prop and prev not in ('Rechazada', 'Retirada') then raise exception 'APIH: solo se reabren propuestas Rechazadas o Retiradas (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and prev not in ('Completado', 'Cancelado') then raise exception 'APIH: solo se reabren proyectos cerrados (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and per.rol <> 'admin' then raise exception 'APIH: solo Administra puede reabrir un proyecto cerrado' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  i := i || jsonb_build_object('estado', case when es_prop then 'Vigente' else 'En curso' end, 'estadoMotivo', '', 'estadoRev', null, 'actualizada', hoy::text);
  if not es_prop then i := i || jsonb_build_object('finReal', null); end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', case when es_prop then 'Propuesta reabierta' else 'Proyecto reabierto' end || ' (era ' || prev || '): ' || nota);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', i ->> 'estado');
end $$;

-- ===== 20261027000900_snapshots_propios.sql =====
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

-- ===== 20261027001000_roles_como_lista.sql =====
-- APIH Prototipo · La lista de usuarios (APIH_Roles/usuarios) es un arreglo JSON, no un objeto.
-- Se permite un valor no-objeto en APIH_Roles igual que en APIH_Config (sin área ni montos). El resto de las listas sigue exigiendo objeto.

create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista not in ('APIH_Config', 'APIH_Roles') then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  perform public.apih_validar(new.lista, new.id, jn);
  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

-- ===== 20261027001100_ciclo_de_vida.sql =====
-- =====================================================================================
-- APIH Prototipo · V23 · Ciclo de vida
--   · Avance calculado (subfases e hitos por fase, ponderado por días si todas las fases tienen fechas) en la base,
--     con el mismo resultado que la app (contrato tests/contract/avance_calc.json).
--   · Compuertas de TRANSICIÓN evaluadas en la base (apih_faltan_transicion), con el mismo resultado que la app
--     (contrato tests/contract/gates_transicion.json).
--   · apih_transicion(id, fase | estado, ...): único comando para cambiar de fase o de estado. Reemplaza las escrituras
--     directas de «fase» y «estado» (la puerta lateral queda cerrada para quien no es Administra: ver apih_fila).
--   · Fechas de fase explícitas (fasesFechas): reparto del rango plan, aprobación de propuestas y cambios aprobados.
--   · apih_hito_estado recalcula el avance y cierra el proyecto solo cuando se completa lo último de la última fase.
-- =====================================================================================

-- Fases de la metodología (propuesta o proyecto)
create or replace function public.apih_fases(p_prop boolean) returns text[] language sql stable security definer set search_path = public as
$$ select array(select jsonb_array_elements_text(coalesce(
       public.apih_cfg() #> (case when p_prop then '{metodo,fasesProp}' else '{metodo,fasesPrj}' end)::text[],
       case when p_prop then '["Recepción","Evaluación","Caso de Negocio","Aprobación"]' else '["Planificación","Ejecución","Transición","Cierre"]' end::jsonb))) $$;

create or replace function public.apih_fecha_fase_ok(x jsonb) returns boolean language sql immutable as
$$ select x is not null and jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'ini') = 'string' and jsonb_typeof(x -> 'fin') = 'string'
          and (x ->> 'ini') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'fin') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'fin') >= (x ->> 'ini') $$;

-- Avance de UNA fase (0..1): promedio de sus unidades = cada subfase (hitos cerrados / hitos de la subfase) y cada hito suelto. null si no hay unidades.
create or replace function public.apih_avance_fase(p jsonb, p_id text, f text) returns numeric language sql stable security definer set search_path = public as
$$ with h as (select substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id),
        hf as (select j ->> 'subfase' sf, coalesce(j ->> 'completado' = 'true', false) c from h where j ->> 'fase' = f),
        subs as (select s ->> 'id' id from jsonb_array_elements(coalesce(p -> 'subfases', '[]'::jsonb)) s where s ->> 'fase' = f),
        u as (select coalesce((select count(*) filter (where c)::numeric / nullif(count(*), 0) from hf where hf.sf = subs.id), 0) v from subs
              union all
              select case when c then 1 else 0 end from hf where not exists (select 1 from subs where subs.id = hf.sf))
   select avg(v) from u $$;

create or replace function public.apih_avance_calc(p jsonb, p_id text) returns int language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(false); ff jsonb := coalesce(p -> 'fasesFechas', '{}'::jsonb); f text; k int := 0; idx int; pesar boolean := true; w numeric := 0; s numeric := 0; peso numeric; pr numeric;
begin
  if p ->> 'tipo' = 'Propuesta' then return 0; end if;
  idx := array_position(fs, p ->> 'fase');
  foreach f in array fs loop if not public.apih_fecha_fase_ok(ff -> f) then pesar := false; end if; end loop;
  foreach f in array fs loop
    k := k + 1;
    peso := case when pesar then greatest(1, (ff -> f ->> 'fin')::date - (ff -> f ->> 'ini')::date + 1) else 1 end;
    pr := public.apih_avance_fase(p, p_id, f);
    if pr is null then pr := case when idx is not null and k < idx then 1 else 0 end; end if;
    w := w + peso; s := s + peso * pr;
  end loop;
  return case when w > 0 then round(s / w * 100)::int else 0 end;
end $$;

-- Deja avance / avanceCalc / hist de un proyecto al día (mismo criterio que sincAvance de la app). Devuelve el JSON; no escribe.
create or replace function public.apih_avance_fila(j jsonb, p_id text, p_hoy date) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare c int := public.apih_avance_calc(j, p_id); m int; ef int; h jsonb; av numeric := coalesce(case when jsonb_typeof(j -> 'avance') = 'number' then (j ->> 'avance')::numeric end, 0); n int;
begin
  if j ->> 'tipo' = 'Propuesta' then return j; end if;
  m := case when jsonb_typeof(j -> 'avanceManual') = 'number' then greatest(0, least(100, round((j ->> 'avanceManual')::numeric)))::int end;
  if not (j ? 'avanceCalc') and m is null and round(av) > 0 and round(av) <> c then m := round(av)::int; j := j || jsonb_build_object('avanceManual', m); end if;
  if j ->> 'estado' = 'Completado' then return j || jsonb_build_object('avance', 100, 'avanceCalc', c); end if;
  ef := coalesce(m, c);
  h := case when jsonb_typeof(j -> 'hist') = 'array' then j -> 'hist' else '[]'::jsonb end; n := jsonb_array_length(h);
  if round(av) <> ef or n = 0 then
    if n > 0 and (h -> (n - 1) ->> 0) = p_hoy::text then h := jsonb_set(h, array[(n - 1)::text], jsonb_build_array(p_hoy::text, ef));
    else h := h || jsonb_build_array(jsonb_build_array(p_hoy::text, ef)); end if;
    j := j || jsonb_build_object('hist', h);
  end if;
  return j || jsonb_build_object('avance', ef, 'avanceCalc', c);
end $$;

-- Reparto del rango plan entre las fases (15/55/15/15 si son 4; partes iguales en otro caso)
create or replace function public.apih_distribuir_fases(p_ini date, p_fin date, fs text[]) returns jsonb language plpgsql immutable as
$$
declare t int := p_fin - p_ini + 1; n int := cardinality(fs); est4 boolean := n = 4; pw int[] := array[15, 55, 15, 15]; c date := p_ini; o jsonb := '{}'; k int; d int; e date;
begin
  if p_fin < p_ini or n = 0 then return null; end if;
  for k in 1..n loop
    if k = n then d := t - (c - p_ini); e := p_fin;
    else d := greatest(1, round(case when est4 then t::numeric * pw[k] / 100 else t::numeric / n end)::int); e := c + d - 1; end if;
    if e < c then e := c; end if;
    o := o || jsonb_build_object(fs[k], jsonb_build_object('ini', c::text, 'fin', e::text));
    c := e + 1;
  end loop;
  return o;
end $$;

-- Cambia el rango plan de un proyecto: reparte o reescala las fases, acota las subfases y deriva inicioPlan/finPlan (como setRangoPlan de la app)
create or replace function public.apih_set_rango_plan(i jsonb, p_ini text, p_fin text, fs text[]) returns jsonb language plpgsql immutable as
$$
declare cur jsonb := coalesce(i -> 'fasesFechas', '{}'::jsonb); explicita boolean := true; f text; r0i date; r0f date; s0 int; s1 int; ff jsonb := '{}'; prev date; a date; b date; n int := cardinality(fs);
  ult text := fs[cardinality(fs)]; uini date; w jsonb; sf jsonb; nuevas jsonb := '[]'::jsonb; si text; sfi text;
begin
  if p_ini !~ '^\d{4}-\d{2}-\d{2}$' or p_fin !~ '^\d{4}-\d{2}-\d{2}$' or p_fin < p_ini then return i || jsonb_build_object('inicioPlan', nullif(p_ini, ''), 'finPlan', nullif(p_fin, '')); end if;
  foreach f in array fs loop if not public.apih_fecha_fase_ok(cur -> f) then explicita := false; end if; end loop;
  if explicita then
    select min((cur -> x ->> 'ini')::date), max((cur -> x ->> 'fin')::date) into r0i, r0f from unnest(fs) x;
  end if;
  if explicita and (r0f - r0i) > 0 then
    s0 := r0f - r0i; s1 := p_fin::date - p_ini::date;
    foreach f in array fs loop
      a := p_ini::date + round(((cur -> f ->> 'ini')::date - r0i)::numeric * s1 / s0)::int;
      b := p_ini::date + round(((cur -> f ->> 'fin')::date - r0i)::numeric * s1 / s0)::int;
      if prev is not null and a <= prev then a := prev + 1; end if;
      if b < a then b := a; end if;
      ff := ff || jsonb_build_object(f, jsonb_build_object('ini', a::text, 'fin', b::text)); prev := b;
    end loop;
    ff := jsonb_set(ff, array[fs[1], 'ini'], to_jsonb(p_ini));
    uini := (ff -> ult ->> 'ini')::date;
    ff := jsonb_set(ff, array[ult, 'fin'], to_jsonb((case when p_fin::date < uini then uini else p_fin::date end)::text));
  else
    ff := public.apih_distribuir_fases(p_ini::date, p_fin::date, fs);
  end if;
  if ff is null then return i; end if;
  -- subfases dentro de su fase
  for sf in select * from jsonb_array_elements(coalesce(i -> 'subfases', '[]'::jsonb)) loop
    w := ff -> (sf ->> 'fase');
    if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
      si := case when (sf ->> 'inicio') < (w ->> 'ini') then w ->> 'ini' when (sf ->> 'inicio') > (w ->> 'fin') then w ->> 'ini' else sf ->> 'inicio' end;
      sfi := case when (sf ->> 'fin') > (w ->> 'fin') then w ->> 'fin' when (sf ->> 'fin') < si then si else sf ->> 'fin' end;
      if sfi < si then si := w ->> 'ini'; sfi := w ->> 'fin'; end if;
      sf := sf || jsonb_build_object('inicio', si, 'fin', sfi);
    end if;
    nuevas := nuevas || jsonb_build_array(sf);
  end loop;
  select min(v ->> 'ini'), max(v ->> 'fin') into si, sfi from jsonb_each(ff) e(k, v);
  i := i || jsonb_build_object('fasesFechas', ff, 'inicioPlan', si, 'finPlan', sfi);
  if jsonb_array_length(nuevas) > 0 then i := i || jsonb_build_object('subfases', nuevas); end if;
  return i;
end $$;

-- Un cambio aprobado de fecha fin mueve el fin de la ÚLTIMA fase; si queda antes de su inicio, se reescala todo (como moverFinPlan de la app)
create or replace function public.apih_mover_fin_plan(i jsonb, p_fin text, fs text[]) returns jsonb language plpgsql immutable as
$$
declare ff jsonb := coalesce(i -> 'fasesFechas', '{}'::jsonb); explicita boolean := true; f text; ult text := fs[cardinality(fs)];
begin
  if i ->> 'tipo' = 'Propuesta' then return i || jsonb_build_object('finPlan', p_fin); end if;
  foreach f in array fs loop if not public.apih_fecha_fase_ok(ff -> f) then explicita := false; end if; end loop;
  if explicita and p_fin >= (ff -> ult ->> 'ini') then
    ff := jsonb_set(ff, array[ult, 'fin'], to_jsonb(p_fin));
    return i || jsonb_build_object('fasesFechas', ff, 'finPlan', (select max(v ->> 'fin') from jsonb_each(ff) e(k, v)), 'inicioPlan', (select min(v ->> 'ini') from jsonb_each(ff) e(k, v)));
  end if;
  return public.apih_set_rango_plan(i, coalesce(i ->> 'inicioPlan', ''), p_fin, fs);
end $$;

-- Compuertas para mover una iniciativa a la fase p_hasta ('Completado' = las de cierre). Misma definición que gates() de la app (js/01-nucleo.js).
create or replace function public.apih_faltan_transicion(p_id text, p_hasta text) returns text[] language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; falt text[] := '{}'; umbral numeric := coalesce((public.apih_cfg() ->> 'umbralCritico')::numeric, 15); n_hit int; pend int; k int;
  sinmit boolean; av int; todos boolean;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into hs from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into rs from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  n_hit := jsonb_array_length(hs);
  sinmit := exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral and coalesce(x ->> 'mit', '') !~ '\S');
  a := array_position(fs, j ->> 'fase'); b := array_position(fs, hasta);

  if hasta = 'Evaluación' then
    if coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null then falt := falt || 'Problema/objetivo descrito'::text; end if;
    if coalesce(j ->> 'sponsor', '') = '' then falt := falt || 'Sponsor identificado'::text; end if;
  end if;
  if hasta = 'Caso de Negocio' then
    if coalesce(j ->> 'sponsor', '') = '' then falt := falt || 'Sponsor identificado'::text; end if;
    if not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false) then falt := falt || 'Evaluación de valor/esfuerzo completada'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if hasta = 'Aprobación' then
    if not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) then falt := falt || 'Presupuesto estimado'::text; end if;
    if not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal') then falt := falt || 'Beneficio esperado'::text; end if;
    if coalesce(j ->> 'bc', '') = '' then falt := falt || 'Business case redactado'::text; end if;
  end if;
  if hasta = 'Ejecución' then
    if coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '' then falt := falt || 'Fechas plan definidas'::text; end if;
    if not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal') then falt := falt || 'Presupuesto asignado'::text; end if;
    if n_hit < 2 then falt := falt || 'Al menos 2 hitos planificados'::text; end if;
    if sinmit then falt := falt || 'Riesgos críticos con plan de mitigación'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    if not todos then falt := falt || 'Hitos de las fases anteriores completados'::text; end if;
    if exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text) then falt := falt || 'Sin hitos vencidos'::text; end if;
    if sinmit then falt := falt || 'Riesgos críticos con plan de mitigación'::text; end if;
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    if coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '' then falt := falt || 'Fechas plan definidas'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 and pend > 0 then falt := falt || ('Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')')::text; end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    if av < 100 then falt := falt || 'Avance al 100%'::text; end if;
    if exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true') then falt := falt || 'Todos los hitos completados'::text; end if;
    if exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral) then falt := falt || 'Sin riesgos críticos abiertos'::text; end if;
  end if;
  return falt;
end $$;
revoke all on function public.apih_faltan_transicion(text, text) from public, anon;
grant execute on function public.apih_faltan_transicion(text, text) to authenticated;

-- Único comando para cambiar de fase o de estado. Exactamente uno de p_fase / p_estado.
--   estados: propuesta Vigente|En espera|Stand By|Rechazada|Retirada · proyecto En curso|Pausado|Stand By|Cancelado|Completado (Completado solo desde la última fase)
--   Aprobar una propuesta es apih_aprobar_propuesta; reabrir una iniciativa cerrada es apih_reabrir.
create or replace function public.apih_transicion(p_id text, p_fase text default null, p_estado text default null, p_motivo text default '', p_rev date default null, p_forzar boolean default false, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; es_prop boolean; fs text[]; ult text; prev_f text; prev_e text; hasta text; faltan text[] := '{}';
  motivo text := btrim(coalesce(p_motivo, '')); nota text := btrim(coalesce(p_nota, '')); forz text := ''; permitidos text[]; final_ text[]; necesita_mot boolean; necesita_rev boolean;
  hs jsonb; txt text;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if (p_fase is null) = (p_estado is null) then raise exception 'APIH: indica la fase o el estado (uno solo)' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{' for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas'; prev_e := i ->> 'estado'; prev_f := i ->> 'fase';
  fs := public.apih_fases(es_prop); ult := fs[cardinality(fs)];
  final_ := case when es_prop then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end;
  if prev_e = any(final_) then raise exception 'APIH: la % está en estado final (%); para retomarla usa «Reabrir»', case when es_prop then 'propuesta' else 'proyecto' end, prev_e using errcode = '22023'; end if;

  if p_fase is not null then
    if prev_e = 'Stand By' then raise exception 'APIH: está en Stand By; reactívala antes de cambiar de fase' using errcode = '22023', hint = 'estado'; end if;
    if not (p_fase = any(fs)) then raise exception 'APIH: fase inválida (%)', p_fase using errcode = '22023', hint = 'fase'; end if;
    if p_fase = prev_f then raise exception 'APIH: ya está en la fase %', p_fase using errcode = '22023', hint = 'fase'; end if;
    hasta := p_fase;
  else
    permitidos := case when es_prop then array['Vigente', 'En espera', 'Stand By', 'Rechazada', 'Retirada'] else array['En curso', 'Pausado', 'Stand By', 'Cancelado', 'Completado'] end;
    if p_estado = 'Aprobada' then raise exception 'APIH: para aprobar una propuesta usa «Aprobar y crear proyecto»' using errcode = '22023', hint = 'estado'; end if;
    if not (p_estado = any(permitidos)) then raise exception 'APIH: estado inválido para % (%)', case when es_prop then 'una propuesta' else 'un proyecto' end, p_estado using errcode = '22023', hint = 'estado'; end if;
    if p_estado = prev_e then raise exception 'APIH: ya está en el estado %', p_estado using errcode = '22023', hint = 'estado'; end if;
    necesita_mot := p_estado = any(array['En espera', 'Pausado', 'Stand By', 'Rechazada', 'Retirada', 'Cancelado']);
    necesita_rev := p_estado = any(array['En espera', 'Pausado']);
    if necesita_mot and motivo = '' then raise exception 'APIH: indica el motivo del estado %', p_estado using errcode = '22023', hint = 'motivo'; end if;
    if necesita_rev and p_rev is null then raise exception 'APIH: indica la fecha de revisión' using errcode = '22023', hint = 'rev'; end if;
    if p_estado = 'Completado' then
      if prev_f <> ult then raise exception 'APIH: un proyecto se completa desde su última fase (%)', ult using errcode = '22023', hint = 'estado'; end if;
      hasta := 'Cierre';
    end if;
  end if;

  if hasta is not null then
    faltan := public.apih_faltan_transicion(p_id, hasta);
    if cardinality(faltan) > 0 then
      if not (p_forzar and per.rol = 'admin') then raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023'; end if;
      if nota = '' then raise exception 'APIH: indica el motivo del cambio forzado' using errcode = '22023', hint = 'nota'; end if;
      forz := ' (forzado: ' || nota || '; faltaba: ' || array_to_string(faltan, ', ') || ')';
    end if;
  end if;

  perform set_config('apih.interno', 'on', true);
  if p_fase is not null then
    i := i || jsonb_build_object('fase', p_fase, 'faseDesde', hoy::text, 'actualizada', hoy::text);
    if not es_prop and p_fase = 'Ejecución' then
      if coalesce(i ->> 'inicioReal', '') = '' then i := i || jsonb_build_object('inicioReal', hoy::text); end if;
      if (i -> 'base') is null or jsonb_typeof(i -> 'base') = 'null' then
        if coalesce(i ->> 'inicioPlan', '') <> '' and coalesce(i ->> 'finPlan', '') <> '' then
          select coalesce(jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'fecha', x ->> 'fecha')), '[]'::jsonb) into hs
            from (select substr(datos, 4)::jsonb x from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id order by id) q;
          i := i || jsonb_build_object('base', jsonb_build_object('fecha', hoy::text, 'inicio', i ->> 'inicioPlan', 'fin', i ->> 'finPlan',
                 'pres', case when public.apih_ve_montos() then coalesce((i ->> 'presupuesto')::numeric, 0) else 0 end, 'por', coalesce(per.nombre, per.email), 'hitos', hs));
          perform public.apih_bitacora(p_id, 'Cambio', 'Línea base congelada · fin ' || (i ->> 'finPlan') || ' · ' || jsonb_array_length(hs) || ' hitos');
        end if;
      end if;
    end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Cambio de fase: ' || prev_f || ' → ' || p_fase || forz);
  else
    i := i || jsonb_build_object('estado', p_estado, 'estadoMotivo', case when necesita_mot then motivo else '' end, 'estadoRev', case when necesita_rev then p_rev::text else null end, 'actualizada', hoy::text);
    if p_estado = 'Completado' then i := i || jsonb_build_object('finReal', hoy::text); end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Estado: ' || prev_e || ' → ' || p_estado || case when motivo <> '' then ' — ' || motivo else '' end || forz);
  end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('fase', i ->> 'fase', 'estado', i ->> 'estado', 'avance', i -> 'avance');
end $$;
revoke all on function public.apih_transicion(text, text, text, text, date, boolean, text) from public, anon;
grant execute on function public.apih_transicion(text, text, text, text, date, boolean, text) to authenticated;

-- Validación de los campos del ciclo de vida (fechas por fase, ajuste manual del avance)
create or replace function public.apih_validar_ciclo(p_lista text, j jsonb) returns void language plpgsql stable security definer set search_path = public as
$$
declare k text; n numeric; fs text[]; f text; prev text; w jsonb; sf jsonb; v jsonb;
begin
  if p_lista <> 'APIH_Proyectos' then return; end if;
  foreach k in array array['avanceManual', 'avanceCalc'] loop
    if j ? k and jsonb_typeof(j -> k) <> 'null' then
      if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023', hint = k; end if;
      n := (j ->> k)::numeric; if n < 0 or n > 100 then raise exception 'APIH: % fuera de 0..100', k using errcode = '22023', hint = k; end if;
    end if;
  end loop;
  v := j -> 'fasesFechas';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' then raise exception 'APIH: fasesFechas debe ser un objeto' using errcode = '22023', hint = 'fasesFechas'; end if;
    fs := public.apih_fases(false);
    for k in select jsonb_object_keys(v) loop
      if not (k = any(fs)) then raise exception 'APIH: fasesFechas trae una fase desconocida (%)', k using errcode = '22023', hint = 'fasesFechas'; end if;
      if not public.apih_fecha_fase_ok(v -> k) then raise exception 'APIH: la fase % necesita inicio y fin válidos (AAAA-MM-DD, fin no anterior al inicio)', k using errcode = '22023', hint = 'fasesFechas'; end if;
    end loop;
    foreach f in array fs loop
      if v ? f then
        if prev is not null and (v -> f ->> 'ini') <= prev then raise exception 'APIH: la fase % debe empezar después de que termine la anterior (%)', f, prev using errcode = '22023', hint = 'fasesFechas'; end if;
        prev := v -> f ->> 'fin';
      end if;
    end loop;
    for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(j -> 'subfases') = 'array' then j -> 'subfases' end, '[]'::jsonb)) loop
      w := v -> (sf ->> 'fase');
      if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
        raise exception 'APIH: la subfase «%» queda fuera de su fase %', sf ->> 'nombre', sf ->> 'fase' using errcode = '22023', hint = 'subfases'; end if;
    end loop;
  end if;
end $$;

-- Completar / reabrir un hito: recalcula el avance y cierra el proyecto solo si era lo último de la última fase y cumple las compuertas de cierre
create or replace function public.apih_hito_estado(p_id text, p_completado boolean)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := (now() at time zone 'America/Santiago')::date; r public.registros; h jsonb; ir public.registros; i jsonb; fs text[]; auto boolean := false;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
  if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para editar hitos de esta área' using errcode = '42501'; end if;
  h := substr(r.datos, 4)::jsonb;
  h := h || jsonb_build_object('completado', p_completado, 'fechaReal', case when p_completado then hoy::text else null end);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || h::text where lista = 'APIH_Hitos' and id = p_id;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = h ->> 'ini';
  if found then
    i := substr(ir.datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text);
    if ir.lista = 'APIH_Proyectos' then
      i := public.apih_avance_fila(i, ir.id, hoy);
      fs := public.apih_fases(false);
      if p_completado and i ->> 'estado' = 'En curso' and i ->> 'fase' = fs[cardinality(fs)] and cardinality(public.apih_faltan_transicion(ir.id, 'Cierre')) = 0 then
        i := public.apih_avance_fila(i || jsonb_build_object('estado', 'Completado', 'finReal', hoy::text, 'estadoMotivo', '', 'estadoRev', null), ir.id, hoy);
        auto := true;
      end if;
    end if;
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(h ->> 'ini', 'Actualización', case when p_completado then 'Hito completado: ' else 'Hito reabierto: ' end || coalesce(h ->> 'nombre', ''));
  if auto then perform public.apih_bitacora(h ->> 'ini', 'Cambio', 'Estado: En curso → Completado — cierre automático: se completó lo último de la fase ' || (i ->> 'fase')); end if;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('completado', p_completado, 'fechaReal', h -> 'fechaReal', 'autoCompletado', auto);
end $$;
revoke all on function public.apih_hito_estado(text, boolean) from public, anon;
grant execute on function public.apih_hito_estado(text, boolean) to authenticated;

-- Trigger de filas: validaciones del ciclo de vida y puerta lateral cerrada.
--   Quien no es Administra (ni un comando del servidor) no puede escribir directamente fase, estado, motivo, revisión, faseDesde,
--   proyecto ni propuestaOrigen: se cambian con apih_transicion / apih_aprobar_propuesta / apih_reabrir / apih_resolver_decision.
--   Una iniciativa nueva nace en la primera fase y en el estado inicial.
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
  privilegiado boolean := coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role' or public.apih_rol() = 'admin';
  fs0 text[]; est0 text;
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista not in ('APIH_Config', 'APIH_Roles') then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  perform public.apih_validar(new.lista, new.id, jn);
  perform public.apih_validar_ciclo(new.lista, jn);
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
    if not privilegiado then
      if tg_op = 'UPDATE' then
        foreach k in array array['fase','estado','estadoMotivo','estadoRev','faseDesde','proyecto','propuestaOrigen'] loop
          if coalesce(jn ->> k, '') is distinct from coalesce(jo ->> k, '') then
            raise exception 'APIH: «%» solo cambia con «Cambiar etapa» (comando del servidor)', k using errcode = '42501', hint = k; end if;
        end loop;
      else
        fs0 := public.apih_fases(new.lista = 'APIH_Propuestas');
        if coalesce(jn ->> 'fase', fs0[1]) <> fs0[1] then raise exception 'APIH: una iniciativa nueva empieza en la fase %', fs0[1] using errcode = '42501', hint = 'fase'; end if;
        est0 := (case when new.lista = 'APIH_Propuestas' then 'Vigente' else 'En curso' end);
        if coalesce(jn ->> 'estado', est0) <> est0 then
          raise exception 'APIH: una iniciativa nueva empieza en su estado inicial' using errcode = '42501', hint = 'estado'; end if;
        if coalesce(jn ->> 'proyecto', '') <> '' or coalesce(jn ->> 'propuestaOrigen', '') <> '' then
          raise exception 'APIH: el vínculo propuesta-proyecto lo crea la aprobación' using errcode = '42501'; end if;
      end if;
    end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;


-- Comandos redefinidos con el ciclo de vida (mismo contrato; cambian solo los pasos marcados «V23»)
create or replace function public.apih_aprobar_propuesta(p_id text, p_nota text default '', p_forzar boolean default false)
returns text language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; j jsonb; nj jsonb; pj jsonb; cfg jsonb; tipo jsonb; h jsonb; rec record; jr jsonb;
  faltan text[] := '{}'; nuevo text; nota text; fasesprop jsonb; fasesprj jsonb; hn text; base date; n_hit int := 0;
  ba text; bb text; autor text; ts text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;

  select * into r from public.registros where lista = 'APIH_Propuestas' and id = p_id for update;
  if not found then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para aprobar en el área %', coalesce(r.area, '—') using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'estado', '') <> 'Vigente' then raise exception 'APIH: la propuesta no está Vigente (estado: %)', coalesce(j ->> 'estado', '—') using errcode = '22023'; end if;

  -- compuertas: una sola definición en apih_faltan_aprobar (la app la replica solo para mostrarla; ver tests/contract)
  faltan := public.apih_faltan_aprobar(p_id);
  if cardinality(faltan) > 0 then
    if not (p_forzar and per.rol = 'admin') then
      raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023';
    end if;
    nota := '[forzado: ' || array_to_string(faltan, ', ') || '] ' || btrim(coalesce(p_nota, ''));
  else
    nota := btrim(coalesce(p_nota, ''));
  end if;

  perform set_config('apih.interno', 'on', true);
  cfg := public.apih_cfg();
  fasesprop := coalesce(cfg #> '{metodo,fasesProp}', '["Recepción","Evaluación","Caso de Negocio","Aprobación"]'::jsonb);
  fasesprj  := coalesce(cfg #> '{metodo,fasesPrj}',  '["Planificación","Ejecución","Transición","Cierre"]'::jsonb);
  autor := coalesce(per.nombre, per.email);

  -- 1. proyecto nuevo
  nuevo := public.apih_siguiente('PRJ', 'APIH_Proyectos');
  nj := (j - 'proyecto' - 'legacyId') || jsonb_build_object(
    'id', nuevo, 'tipo', 'Proyecto', 'fase', 'Planificación', 'estado', 'En curso', 'rag', 'Verde', 'propuestaOrigen', p_id,
    'creada', hoy::text, 'actualizada', hoy::text, 'faseDesde', hoy::text, 'avance', 0, 'hist', jsonb_build_array(jsonb_build_array(hoy::text, 0)),
    'inicioReal', null, 'finReal', null, 'rec', null, 'estadoMotivo', '', 'estadoRev', null,
    'origen', coalesce(nullif(j ->> 'origen', ''), 'usuario'), 'finEst', j -> 'finPlan', 'est', coalesce(j -> 'est', '[]'::jsonb));
  if (nj ->> 'inicioPlan') ~ '^\d{4}-\d{2}-\d{2}$' and (nj ->> 'finPlan') ~ '^\d{4}-\d{2}-\d{2}$' and (nj ->> 'finPlan') >= (nj ->> 'inicioPlan') then
    nj := nj || jsonb_build_object('fasesFechas', public.apih_distribuir_fases((nj ->> 'inicioPlan')::date, (nj ->> 'finPlan')::date, public.apih_fases(false)));   -- V23: las fechas de fase nacen explícitas
  end if;
  insert into public.registros(lista, id, datos) values ('APIH_Proyectos', nuevo, 'p1.' || nj::text);

  -- 2. riesgos y hitos de la propuesta pasan al proyecto; las etapas de propuesta ya superadas se cierran
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Riesgos', 'APIH_Hitos') and left(substr(datos, 4), 1) = '{' and (substr(datos, 4)::jsonb ->> 'ini') = p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{ini}', to_jsonb(nuevo));
    if rec.lista = 'APIH_Hitos' and (jr ->> 'fase') is not null and fasesprop ? (jr ->> 'fase') and coalesce((jr ->> 'completado')::boolean, false) = false then
      jr := jr || jsonb_build_object('completado', true, 'fechaReal', hoy::text);
    end if;
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 3. hitos de la plantilla del tipo para las fases del proyecto
  if coalesce(j ->> 'tipoIni', '') <> '' then
    select t into tipo from jsonb_array_elements(coalesce(cfg #> '{metodo,tipos}', '[]'::jsonb)) t where t ->> 'nombre' = j ->> 'tipoIni' limit 1;
    if tipo is not null then
      base := coalesce(nullif(j ->> 'inicioPlan', '')::date, hoy);
      for h in select x from jsonb_array_elements(coalesce(tipo -> 'hitos', '[]'::jsonb)) x loop
        continue when not (fasesprj ? (h ->> 'fase'));
        continue when exists (select 1 from public.registros x where x.lista = 'APIH_Hitos' and left(substr(x.datos, 4), 1) = '{'
                                and (substr(x.datos, 4)::jsonb ->> 'ini') = nuevo and (substr(x.datos, 4)::jsonb ->> 'nombre') = (h ->> 'n') and (substr(x.datos, 4)::jsonb ->> 'fase') = (h ->> 'fase'));
        hn := public.apih_siguiente('HIT', 'APIH_Hitos');
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hn, 'p1.' || jsonb_build_object(
          'id', hn, 'ini', nuevo, 'nombre', h ->> 'n', 'fase', h ->> 'fase', 'fecha', (base + coalesce((h ->> 'dias')::int, 0))::text,
          'completado', false, 'fechaReal', null, 'resp', coalesce(j ->> 'lider', ''))::text);
        n_hit := n_hit + 1;
      end loop;
    end if;
  end if;

  select substr(datos, 4)::jsonb into nj from public.registros where lista = 'APIH_Proyectos' and id = nuevo;   -- V23: avance calculado con los hitos recién creados
  nj := public.apih_avance_fila(nj, nuevo, hoy);
  update public.registros set datos = 'p1.' || nj::text where lista = 'APIH_Proyectos' and id = nuevo;

  -- 4. dependencias que apuntaban a la propuesta ahora apuntan al proyecto
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' and jsonb_typeof(substr(datos, 4)::jsonb -> 'deps') = 'array' and (substr(datos, 4)::jsonb -> 'deps') ? p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{deps}',
            (select jsonb_agg(case when d #>> '{}' = p_id then to_jsonb(nuevo) else d end) from jsonb_array_elements(substr(rec.datos, 4)::jsonb -> 'deps') d));
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 5. la propuesta se cierra como Aprobada
  pj := (select substr(datos, 4)::jsonb from public.registros where lista = 'APIH_Propuestas' and id = p_id)
        || jsonb_build_object('estado', 'Aprobada', 'proyecto', nuevo, 'actualizada', hoy::text, 'estadoMotivo', nota, 'estadoRev', null);
  update public.registros set datos = 'p1.' || pj::text where lista = 'APIH_Propuestas' and id = p_id;

  -- 6. bitácora
  ba := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a'; bb := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b';
  insert into public.registros(lista, id, datos) values
   ('APIH_Bitacora', ba, 'p1.' || jsonb_build_object('id', ba,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Decisión', 'ini', p_id, 'autor', autor,
      'texto', 'Propuesta aprobada → proyecto ' || nuevo || case when nota <> '' then ' — ' || nota else '' end, 'meta', null)::text),
   ('APIH_Bitacora', bb, 'p1.' || jsonb_build_object('id', bb,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Cambio', 'ini', nuevo, 'autor', autor,
      'texto', 'Proyecto creado desde la propuesta ' || p_id, 'meta', null)::text);

  perform set_config('apih.interno', 'off', true);
  return nuevo;
end $$;

create or replace function public.apih_resolver_cambio(p_id text, p_estado text, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; c jsonb; ir public.registros; i jsonb; ap boolean := p_estado = 'Aprobado'; nota text := btrim(coalesce(p_nota, '')); es_sponsor boolean;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_estado not in ('Aprobado', 'Rechazado') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;
  if not ap and nota = '' then raise exception 'APIH: indica el motivo del rechazo' using errcode = '22023', hint = 'nota'; end if;
  select * into r from public.registros where lista = 'APIH_Cambios' and id = p_id for update;
  if not found then raise exception 'APIH: el cambio % no existe', p_id using errcode = 'P0002'; end if;
  c := substr(r.datos, 4)::jsonb;
  if c ->> 'estado' <> 'Solicitado' then raise exception 'APIH: el cambio ya fue resuelto (%)', c ->> 'estado' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = c ->> 'ini' for update;
  if not found then raise exception 'APIH: la iniciativa del cambio no existe' using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  es_sponsor := nullif(i ->> 'sponsor', '') is not null and (i ->> 'sponsor') in (coalesce(per.nombre, ''), per.email);
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or es_sponsor) then
    raise exception 'APIH: solo el sponsor, Responsable o Administra resuelven cambios' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if ap and coalesce((c ->> 'pNue')::numeric, 0) > 0 and not public.apih_ve_montos() then
    raise exception 'APIH: aprobar un cambio de presupuesto requiere permiso de montos' using errcode = '42501', hint = 'pNue'; end if;

  perform set_config('apih.interno', 'on', true);
  c := c || jsonb_build_object('estado', p_estado, 'aprobador', coalesce(per.nombre, per.email), 'nota', nota, 'fDec', hoy::text);
  update public.registros set datos = 'p1.' || c::text where lista = 'APIH_Cambios' and id = p_id;
  if ap then
    if nullif(c ->> 'fNue', '') is not null then
      i := public.apih_mover_fin_plan(i, c ->> 'fNue', public.apih_fases(ir.lista = 'APIH_Propuestas'));   -- V23: mueve el fin de la última fase
      if nullif(i ->> 'finEst', '') is null or (i ->> 'finEst') < (c ->> 'fNue') then i := i || jsonb_build_object('finEst', c ->> 'fNue'); end if;
    end if;
    if coalesce((c ->> 'pNue')::numeric, 0) > 0 then i := i || jsonb_build_object('presupuesto', (c ->> 'pNue')::numeric); end if;
    i := i || jsonb_build_object('actualizada', hoy::text);
    if ir.lista = 'APIH_Proyectos' then i := public.apih_avance_fila(i, ir.id, hoy); end if;
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(c ->> 'ini', 'Decisión', 'Cambio ' || p_id || case when ap then ' aprobado' else ' rechazado' end || ' por ' || (c ->> 'aprobador') || case when nota <> '' then ': ' || nota else '' end,
                               case when ap then 'Línea base actualizada' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', p_estado, 'aplicado', ap);
end $$;

create or replace function public.apih_reabrir(p_id text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; prev text; es_prop boolean; nota text := btrim(coalesce(p_nota, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nota = '' then raise exception 'APIH: indica el motivo de la reapertura' using errcode = '22023', hint = 'nota'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  i := substr(ir.datos, 4)::jsonb; prev := i ->> 'estado'; es_prop := ir.lista = 'APIH_Propuestas';
  if es_prop and prev not in ('Rechazada', 'Retirada') then raise exception 'APIH: solo se reabren propuestas Rechazadas o Retiradas (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and prev not in ('Completado', 'Cancelado') then raise exception 'APIH: solo se reabren proyectos cerrados (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and per.rol <> 'admin' then raise exception 'APIH: solo Administra puede reabrir un proyecto cerrado' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  i := i || jsonb_build_object('estado', case when es_prop then 'Vigente' else 'En curso' end, 'estadoMotivo', '', 'estadoRev', null, 'actualizada', hoy::text);
  if not es_prop then i := public.apih_avance_fila(i || jsonb_build_object('finReal', null), ir.id, hoy); end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', case when es_prop then 'Propuesta reabierta' else 'Proyecto reabierto' end || ' (era ' || prev || '): ' || nota);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', i ->> 'estado');
end $$;

revoke all on function public.apih_aprobar_propuesta(text, text, boolean), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) from public, anon;
grant execute on function public.apih_aprobar_propuesta(text, text, boolean), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) to authenticated;
revoke all on function public.apih_fases(boolean), public.apih_avance_fase(jsonb, text, text), public.apih_avance_calc(jsonb, text), public.apih_avance_fila(jsonb, text, date),
  public.apih_distribuir_fases(date, date, text[]), public.apih_set_rango_plan(jsonb, text, text, text[]), public.apih_mover_fin_plan(jsonb, text, text[]), public.apih_validar_ciclo(text, jsonb) from public, anon, authenticated;

-- ===== 20261028000100_permisos_unicos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 1 · Permisos y capacidades: UNA sola definición, en la base
--   Antes: la SPA volvía a decidir quién ve y quién edita (roles, áreas, «gobierna», solo lectura, administrador por correo
--   fijo en el código). Ahora la base es la única que decide y la SPA solo lee el resultado:
--     · apih_contexto()      quién soy y qué puedo hacer (rol, áreas, montos, gobierno, solo lectura, áreas permitidas)
--     · apih_personas()      directorio de personas con su rol y área (reemplaza la lista APIH_Roles del cliente)
--     · registros_v.puede_editar   por fila, con la MISMA función que aplica RLS al escribir (apih_escribe)
--     · apih_ver_como(email) «Ver como» del administrador resuelto en el servidor (solo lectura; el servidor evalúa los
--                            permisos con el perfil elegido, no la SPA)
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
  -- catálogo de áreas: el de la configuración; si aún no existe, las que aparecen en perfiles y registros
  todas := case when jsonb_typeof(cfg -> 'areas') = 'array' and jsonb_array_length(cfg -> 'areas') > 0 then cfg -> 'areas'
                else coalesce((select jsonb_agg(a order by a) from (
                       select unnest(areas) a from public.perfiles union
                       select btrim(x) from public.registros r, unnest(string_to_array(coalesce(r.area, ''), ',')) x where btrim(x) <> '') q
                       where a <> ''), '[]'::jsonb) end;
  return jsonb_build_object(
    'email', p.email, 'nombre', coalesce(nullif(p.nombre, ''), p.email), 'cargo', p.cargo, 'rol', p.rol, 'appRol', p.app_rol,
    'areas', to_jsonb(p.areas), 'veTodo', ve_todo, 'veMontos', p.rol = 'admin' or p.ve_montos,
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

-- ===== 20261028000150_compuertas_unicas.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 3a · Compuertas: UNA sola definición, en la base, con la lista completa (cumplidas y pendientes)
--   Antes la app tenía su propia copia (gates / gatesAprobar) para pintar las listas ✓/✗ y las dos copias se verificaban
--   con tests/contract. Ahora solo existe esta:
--     · apih_compuertas(id, hasta)      → [{t, ok}] para pasar a la fase `hasta` (o 'Cierre' para completar)
--     · apih_compuertas_aprobar(id)     → [{t, ok}] para aprobar una propuesta
--     · apih_faltan_transicion / apih_faltan_aprobar → solo las pendientes (las usan los comandos, igual que antes)
--     · apih_etapas(id)                 → todos los movimientos posibles de una iniciativa, cada uno con sus compuertas
-- =====================================================================================

create or replace function public.apih_g(t text, falla boolean) returns jsonb language sql immutable as
$$ select jsonb_build_object('t', t, 'ok', not coalesce(falla, false)) $$;

create or replace function public.apih_compuertas(p_id text, p_hasta text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; g jsonb := '[]'::jsonb; umbral numeric := coalesce((public.apih_cfg() ->> 'umbralCritico')::numeric, 15); n_hit int; pend int; k int;
  sinmit boolean; av int; todos boolean;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into hs from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into rs from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  n_hit := jsonb_array_length(hs);
  sinmit := exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral and coalesce(x ->> 'mit', '') !~ '\S');
  a := array_position(fs, j ->> 'fase'); b := array_position(fs, hasta);

  if hasta = 'Evaluación' then
    g := g || public.apih_g('Problema/objetivo descrito'::text, coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null);
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
  end if;
  if hasta = 'Caso de Negocio' then
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
    g := g || public.apih_g('Evaluación de valor/esfuerzo completada'::text, not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false));
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Aprobación' then
    g := g || public.apih_g('Presupuesto estimado'::text, not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
    g := g || public.apih_g('Beneficio esperado'::text, not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Business case redactado'::text, coalesce(j ->> 'bc', '') = '');
  end if;
  if hasta = 'Ejecución' then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Presupuesto asignado'::text, not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Al menos 2 hitos planificados'::text, n_hit < 2);
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    g := g || public.apih_g('Hitos de las fases anteriores completados'::text, not todos);
    g := g || public.apih_g('Sin hitos vencidos'::text, exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text));
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 then g := g || public.apih_g(case when pend > 0 then 'Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')' else 'Hitos de la fase ' || (j ->> 'fase') || ' completados' end, pend > 0); end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    g := g || public.apih_g('Avance al 100%'::text, av < 100);
    g := g || public.apih_g('Todos los hitos completados'::text, exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true'));
    g := g || public.apih_g('Sin riesgos críticos abiertos'::text, exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral));
  end if;
  return g;
end $$;

create or replace function public.apih_compuertas_aprobar(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare j jsonb; g jsonb := '[]'::jsonb;
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Propuestas' and id = p_id and left(substr(datos, 4), 1) = '{';
  if j is null then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  g := g || public.apih_g('Propuesta en fase Aprobación', coalesce(j ->> 'fase', '') <> 'Aprobación');
  g := g || public.apih_g('Sponsor identificado', coalesce(j ->> 'sponsor', '') = '');
  g := g || public.apih_g('Líder asignado', coalesce(j ->> 'lider', '') = '');
  g := g || public.apih_g('Presupuesto asignado', not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
  g := g || public.apih_g('Business case redactado', coalesce(j ->> 'bc', '') = '');
  g := g || public.apih_g('Decisión "Iniciar" aprobada en comité', not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
        and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada'));
  return g;
end $$;

create or replace function public.apih_faltan_aprobar(p_id text) returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(x ->> 't'), '{}'::text[]) from jsonb_array_elements(public.apih_compuertas_aprobar(p_id)) x where not (x ->> 'ok')::boolean $$;

create or replace function public.apih_faltan_transicion(p_id text, p_hasta text) returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(x ->> 't'), '{}'::text[]) from jsonb_array_elements(public.apih_compuertas(p_id, p_hasta)) x where not (x ->> 'ok')::boolean $$;

-- Movimientos posibles (cambiar de fase, aprobar, completar, cambiar de estado), con sus compuertas
create or replace function public.apih_etapas(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare r public.registros; j jsonb; es_prop boolean; fs text[]; idx int; ult text; out jsonb := '[]'::jsonb; f text; k int := 0; e text; est text[]; etiqueta text;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop); idx := array_position(fs, j ->> 'fase'); ult := fs[cardinality(fs)];
  if j ->> 'estado' = any (case when es_prop then array['Aprobada','Rechazada','Retirada'] else array['Completado','Cancelado'] end) then return out; end if;
  if j ->> 'estado' <> 'Stand By' then
    foreach f in array fs loop
      k := k + 1;
      if k <> idx then out := out || jsonb_build_object('id', 'f:' || f, 'g', 'Mover de fase', 't', (case when k > idx then 'Avanzar a ' else 'Volver a ' end) || f, 'kind', 'fase', 'to', f, 'gates', public.apih_compuertas(p_id, f)); end if;
    end loop;
    if es_prop and j ->> 'fase' = ult then out := out || jsonb_build_object('id', 'aprobar', 'g', 'Mover de fase', 't', 'Aprobar y crear proyecto', 'kind', 'aprobar', 'gates', public.apih_compuertas_aprobar(p_id)); end if;
    if not es_prop and j ->> 'fase' = ult then out := out || jsonb_build_object('id', 'e:Completado', 'g', 'Mover de fase', 't', 'Completar proyecto', 'kind', 'estado', 'estado', 'Completado', 'gates', public.apih_compuertas(p_id, 'Cierre'), 'motivo', false, 'rev', false); end if;
  end if;
  est := case when es_prop then array['Vigente','En espera','Stand By','Rechazada','Retirada'] else array['En curso','Pausado','Stand By','Cancelado'] end;
  foreach e in array est loop
    if e = j ->> 'estado' then continue; end if;
    etiqueta := case e when 'Pausado' then 'Pausar' when 'En espera' then 'Poner en espera' when 'Stand By' then 'Dejar en Stand By' when 'Cancelado' then 'Cancelar proyecto'
                       when 'Rechazada' then 'Rechazar propuesta' when 'Retirada' then 'Retirar propuesta' when 'En curso' then 'Reactivar proyecto' when 'Vigente' then 'Reactivar propuesta' else e end;
    out := out || jsonb_build_object('id', 'e:' || e, 'g', 'Cambiar estado', 't', etiqueta, 'kind', 'estado', 'estado', e, 'gates', '[]'::jsonb,
             'motivo', e = any (array['En espera','Pausado','Stand By','Rechazada','Retirada','Cancelado']), 'rev', e = any (array['En espera','Pausado']));
  end loop;
  return out;
end $$;

revoke all on function public.apih_g(text, boolean), public.apih_compuertas(text, text), public.apih_compuertas_aprobar(text), public.apih_etapas(text) from public, anon;
grant execute on function public.apih_compuertas(text, text), public.apih_compuertas_aprobar(text), public.apih_etapas(text) to authenticated;
grant execute on function public.apih_g(text, boolean) to authenticated;

-- ===== 20261028000200_calculos_unicos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 2 · Valores calculados: UNA sola definición, en la base
--   Antes la SPA calculaba (y el servidor volvía a calcular lo mismo en algunos comandos): estado de hitos, fin proyectado,
--   desvío, atraso, avance esperado, ROI, exposición y nivel de riesgo, semáforo sugerido, ranking de criticidad,
--   completitud y días sin actualización. Ahora los entrega apih_calculos() y la SPA solo los muestra.
--   · Lee a través de registros_v (con los permisos y la ocultación de montos de quien llama).
--   · «Hoy» es el de Santiago (o cfg.hoyFija, para pruebas y demostraciones).
--   · Umbrales (tolDesv, umbralCritico, diasSinUpdate): los de la organización, salvo que la persona que lidera la
--     iniciativa tenga un ajuste propio y el parámetro no esté fijado por Administra (misma regla que cfgI de la app).
-- =====================================================================================

create or replace function public.apih_hoy() returns date language sql stable security definer set search_path = public as
$$ select coalesce(case when coalesce(public.apih_cfg() ->> 'hoyFija', '') ~ '^\d{4}-\d{2}-\d{2}$' then (public.apih_cfg() ->> 'hoyFija')::date end,
                   (now() at time zone 'America/Santiago')::date) $$;

create or replace function public.apih_num(j jsonb, k text) returns numeric language sql immutable as
$$ select case when jsonb_typeof(j -> k) = 'number' then (j ->> k)::numeric
               when jsonb_typeof(j -> k) = 'string' and (j ->> k) ~ '^-?\d+(\.\d+)?$' then (j ->> k)::numeric else 0 end $$;

-- «vacío» como en JavaScript: ausente, null, "", 0 o false
create or replace function public.apih_vacio(j jsonb, k text) returns boolean language sql immutable as
$$ select j -> k is null or jsonb_typeof(j -> k) = 'null' or j -> k in ('""'::jsonb, '0'::jsonb, 'false'::jsonb) $$;

create or replace function public.apih_fecha(j jsonb, k text) returns date language sql immutable as
$$ select case when (j ->> k) ~ '^\d{4}-\d{2}-\d{2}' then left(j ->> k, 10)::date end $$;

create or replace function public.apih_rel(d date, hoy date) returns text language sql immutable as
$$ select case when d is null then '' when d = hoy then 'hoy' when d = hoy + 1 then 'mañana' when d = hoy - 1 then 'ayer'
               when d > hoy then 'en ' || (d - hoy) || ' d' else 'hace ' || (hoy - d) || ' d' end $$;

-- Umbral vigente para una iniciativa (organización o ajuste de su líder)
create or replace function public.apih_umbral(ini jsonb, k text) returns numeric language plpgsql stable security definer set search_path = public as
$$ declare cfg jsonb := public.apih_cfg(); v jsonb; org numeric := public.apih_num(public.apih_cfg(), k);
begin
  if coalesce(cfg #>> array['fijos', k], '') not in ('', '0', 'false') then return org; end if;
  if coalesce(ini ->> 'lider', '') = '' then return org; end if;
  select substr(r.datos, 4)::jsonb #> array['v', 'cfg', k] into v
    from public.perfiles p join public.registros r on r.lista = 'APIH_Config' and r.id = 'cfgU:' || p.email
   where lower(btrim(p.nombre)) = lower(btrim(ini ->> 'lider')) and left(substr(r.datos, 4), 1) = '{' limit 1;
  return case when v is not null and jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else org end;
end $$;

create or replace function public.apih_estado_hito(h jsonb, hoy date) returns jsonb language sql immutable as
$$ select case
     when h ->> 'completado' = 'true' then
       case when public.apih_fecha(h, 'fechaReal') is not null and public.apih_fecha(h, 'fechaReal') > public.apih_fecha(h, 'fecha')
            then jsonb_build_object('k', 'late', 't', 'Completado con retraso', 'c', '#F2A100')
            else jsonb_build_object('k', 'done', 't', 'Completado', 'c', '#107C10') end
     when public.apih_fecha(h, 'fecha') is null then jsonb_build_object('k', 'ok', 't', 'En plazo', 'c', '#0D446A')
     when public.apih_fecha(h, 'fecha') < hoy then jsonb_build_object('k', 'over', 't', 'Vencido (' || (hoy - public.apih_fecha(h, 'fecha')) || ' d)', 'c', '#D13438')
     when public.apih_fecha(h, 'fecha') - hoy <= 7 then jsonb_build_object('k', 'soon', 't', 'Vence ' || public.apih_rel(public.apih_fecha(h, 'fecha'), hoy), 'c', '#F2A100')
     else jsonb_build_object('k', 'ok', 't', 'En plazo', 'c', '#0D446A') end $$;

create or replace function public.apih_nivel_riesgo(e numeric, umbral numeric) returns jsonb language sql immutable as
$$ select case when e >= umbral then jsonb_build_object('n', 'Crítico', 'c', '#D13438')
               when e >= 10 then jsonb_build_object('n', 'Alto', 'c', '#CA5010')
               when e >= 5 then jsonb_build_object('n', 'Medio', 'c', '#F2A100')
               else jsonb_build_object('n', 'Bajo', 'c', '#107C10') end $$;

create or replace function public.apih_completitud(i jsonb, tiene_hitos boolean) returns jsonb language plpgsql immutable as
$$ declare crit text[] := '{}'; rec text[] := '{}'; opt text[] := '{}'; k text; n text; tot int; got int;
begin
  for k, n in select * from (values ('sponsor','Sponsor'),('lider','Líder'),('area','Área'),('prioridad','Prioridad'),('inicioPlan','Inicio plan'),('finPlan','Fin plan')) v(k, n) loop
    if public.apih_vacio(i, k) then crit := crit || n; end if; end loop;
  for k, n in select * from (values ('presupuesto','Presupuesto'),('beneficio','Beneficio'),('desc','Descripción'),('bc','Business case'),('negocio','Resp. negocio')) v(k, n) loop
    if public.apih_vacio(i, k) then rec := rec || n; end if; end loop;
  for k, n in select * from (values ('proveedor','Proveedor'),('resumen','Resumen ejecutivo'),('proximos','Próximos pasos')) v(k, n) loop
    if public.apih_vacio(i, k) then opt := opt || n; end if; end loop;
  if not tiene_hitos then rec := rec || 'Hitos'::text; end if;
  tot := 6 * 3 + 5 * 2 + 3 + 2; got := tot - cardinality(crit) * 3 - cardinality(rec) * 2 - cardinality(opt);
  return jsonb_build_object('crit', to_jsonb(crit), 'rec', to_jsonb(rec), 'opt', to_jsonb(opt), 'pct', greatest(0, round(got::numeric / tot * 100)));
end $$;

-- Todos los valores calculados, por registro, para quien llama
create or replace function public.apih_calculos() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); fases text[] := array_remove(public.apih_fases(false), 'Cierre');
  ini jsonb := '{}'::jsonb; hit jsonb := '{}'::jsonb; rsk jsonb := '{}'::jsonb;
  r record; j jsonb; i record; ff text[]; ix int; sig jsonb;
  hitos jsonb := '{}'::jsonb;      -- por iniciativa: arreglo de hitos
  riesgos jsonb := '{}'::jsonb;    -- por iniciativa: arreglo de {id, expo, abierto}
  hs jsonb; rs jsonb; abiertas date[]; n_hit int; vivo boolean; hecho boolean; es_prop boolean; fc date; fin_plan date; ds int; tol numeric; umb numeric;
  dsu int; esp numeric; av numeric; p int; why jsonb; hv int; rc int; exp_ numeric; sumexp numeric; rag text; crit numeric; ti date; tt int; tz int;
begin
  -- 1) hitos (por iniciativa) y su estado
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' loop
    hit := hit || jsonb_build_object(r.id, public.apih_estado_hito(r.j, hoy));
    hitos := jsonb_set(hitos, array[coalesce(r.j ->> 'ini', '')], coalesce(hitos -> coalesce(r.j ->> 'ini', ''), '[]'::jsonb) || jsonb_build_array(r.j), true);
  end loop;
  -- 2) riesgos: se calculan con el umbral de su iniciativa (después de leer las iniciativas)
  -- 3) iniciativas
  for i in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    j := i.j; es_prop := j ->> 'tipo' = 'Propuesta' or i.lista = 'APIH_Propuestas';
    hecho := j ->> 'estado' = any (case when es_prop then array['Aprobada','Rechazada','Retirada'] else array['Completado','Cancelado'] end);
    vivo := not hecho and coalesce(j ->> 'estado', '') <> 'Stand By';
    hs := coalesce(hitos -> i.id, '[]'::jsonb);
    tol := public.apih_umbral(j, 'tolDesv'); umb := public.apih_umbral(j, 'umbralCritico');
    -- fin proyectado
    fin_plan := public.apih_fecha(j, 'finPlan');
    if j ->> 'estado' = 'Completado' then fc := coalesce(public.apih_fecha(j, 'finReal'), public.apih_fecha(j, 'finEst'), fin_plan);
    else
      fc := coalesce(case when public.apih_vacio(j, 'finEst') then null else public.apih_fecha(j, 'finEst') end, fin_plan);
      select max(public.apih_fecha(h, 'fecha')) into ti from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true';
      if ti is not null and (j ->> 'fase') = any (fases) and (fc is null or ti > fc) then fc := ti; end if;
      if vivo and (j ->> 'fase') = any (fases) and public.apih_num(j, 'avance') < 100 and (fc is null or fc < hoy) then fc := hoy; end if;
    end if;
    ds := case when fin_plan is not null and fc is not null then greatest(0, fc - fin_plan) else 0 end;
    -- avance esperado (lineal)
    ti := public.apih_fecha(j, 'inicioPlan');
    esp := case when ti is null or fin_plan is null then 0
                else greatest(0, least(100, (hoy - ti)::numeric / greatest(1, fin_plan - ti) * 100)) end;
    dsu := case when public.apih_vacio(j, 'actualizada') then 999 else hoy - public.apih_fecha(j, 'actualizada') end;
    select count(*) into hv from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true' and public.apih_fecha(h, 'fecha') < hoy;
    -- riesgos de la iniciativa
    select coalesce(sum(public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp')) filter (where x.j ->> 'estado' is distinct from 'Cerrado'), 0),
           count(*) filter (where x.j ->> 'estado' is distinct from 'Cerrado' and public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp') >= umb)
      into sumexp, rc
      from (select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = i.id) x;
    -- semáforo sugerido
    p := 0; why := '[]'::jsonb;
    if ds > 30 then p := p + 2; why := why || to_jsonb('desviación de ' || ds || ' d');
    elsif ds > tol then p := p + 1; why := why || to_jsonb('desviación de ' || ds || ' d'); end if;
    if hv >= 2 then p := p + 2; why := why || to_jsonb(hv || ' hitos vencidos');
    elsif hv = 1 then p := p + 1; why := why || to_jsonb('1 hito vencido'::text); end if;
    if rc > 0 then p := p + 2; why := why || to_jsonb(rc || ' riesgo(s) crítico(s)'); end if;
    av := public.apih_num(j, 'avance');
    if (j ->> 'fase') = any (fases) and esp - av > 25 then p := p + 1; why := why || to_jsonb('avance bajo lo esperado'::text); end if;
    if vivo and (j ->> 'fase') = any (fases) and dsu > public.apih_umbral(j, 'diasSinUpdate') * 2 then p := p + 1; why := why || to_jsonb('sin actualización'::text); end if;
    rag := case when p >= 4 then 'Rojo' when p >= 2 then 'Ámbar' else 'Verde' end;
    crit := (case j ->> 'rag' when 'Rojo' then 40 when 'Ámbar' then 20 else 0 end) + least(30, ds / 2.0) + sumexp / 2
            + (case j ->> 'prioridad' when 'Alta' then 12 when 'Media' then 6 else 0 end) + hv * 4;
    -- compuertas del siguiente paso: próxima fase; si no hay, aprobar (propuesta) o completar (proyecto)
    ff := public.apih_fases(es_prop); ix := array_position(ff, j ->> 'fase');
    sig := case when hecho then '[]'::jsonb
                when ix is not null and ix < cardinality(ff) then public.apih_compuertas(i.id, ff[ix + 1])
                when es_prop then public.apih_compuertas_aprobar(i.id)
                else public.apih_compuertas(i.id, 'Cierre') end;
    ini := ini || jsonb_build_object(i.id, jsonb_build_object('sig', sig,
      'forecast', fc, 'desv', ds, 'atrasado', (vivo and (j ->> 'fase') = any (fases) and ds > tol), 'esperado', esp,
      'roi', case when public.apih_num(j, 'presupuesto') > 0 then ((public.apih_num(j, 'beneficio') - public.apih_num(j, 'presupuesto')) / public.apih_num(j, 'presupuesto')) * 100 end,
      'rag', jsonb_build_object('rag', rag, 'why', why), 'crit', crit, 'dsu', dsu, 'hv', hv, 'umbral', umb, 'tol', tol,
      'compl', public.apih_completitud(j, jsonb_array_length(hs) > 0)));
  end loop;
  -- 4) riesgos con su exposición y nivel (umbral de la iniciativa; si no existe, el de la organización)
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' loop
    umb := coalesce((ini -> (r.j ->> 'ini') ->> 'umbral')::numeric, public.apih_num(public.apih_cfg(), 'umbralCritico'));
    exp_ := public.apih_num(r.j, 'prob') * public.apih_num(r.j, 'imp');
    rsk := rsk || jsonb_build_object(r.id, jsonb_build_object('expo', exp_, 'nivel', public.apih_nivel_riesgo(exp_, umb),
                                      'critico', (r.j ->> 'estado' is distinct from 'Cerrado' and exp_ >= umb)));
  end loop;
  return jsonb_build_object('hoy', hoy, 'ini', ini, 'hitos', hit, 'riesgos', rsk);
end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
revoke all on function public.apih_umbral(jsonb, text), public.apih_hoy() from public, anon;
grant execute on function public.apih_umbral(jsonb, text), public.apih_hoy() to authenticated;

-- ===== 20261028000300_avance_y_plan_servidor.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 3b · Avance y plan: los calcula y los fija SOLO el servidor
--   Antes: la SPA recalculaba el avance (hitos y subfases), repartía las fechas de las fases, reprogramaba el plan al cambiar de fase
--   y escribía el resultado. Ahora:
--     · apih_fila (disparador de proyectos) deriva inicioPlan/finPlan de las fechas de fase, reparte/reescala las fases cuando cambia el rango
--       y deja avance / avanceCalc / hist al día en CADA escritura (nadie los escribe por separado)
--     · un disparador sobre hitos refresca el avance del proyecto sin tocar su versión ni su autor (es un valor derivado)
--     · apih_ventanas        ventana de cada fase (fechas explícitas o derivadas de los hitos) con su avance
--     · apih_plan_cambio_fase  propuesta de reprogramación al avanzar de fase (la SPA solo la muestra)
--     · apih_transicion(..., p_reprogramar)  aplica esa reprogramación en la misma transacción del cambio de fase
--     · apih_fases_fechas    comando para fijar/editar las fechas de las fases (valida con el mismo criterio que el disparador)
--     · apih_calculos entrega avance, avanceCalc, avanceManual y las ventanas por iniciativa
-- =====================================================================================


-- 1. Error legible de un conjunto de fechas por fase ('' = válido). Mismos criterios que apih_validar_ciclo.
create or replace function public.apih_fases_error(p jsonb, ff jsonb) returns text language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(p ->> 'tipo' = 'Propuesta'); f text; x jsonb; pf text; pfin text; sf jsonb; w jsonb;
begin
  foreach f in array fs loop
    x := ff -> f;
    if x is null or jsonb_typeof(x) <> 'object' or coalesce(x ->> 'ini', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(x ->> 'fin', '') !~ '^\d{4}-\d{2}-\d{2}$' then return 'La fase ' || f || ' necesita inicio y fin'; end if;
    if (x ->> 'fin') < (x ->> 'ini') then return 'En ' || f || ' el fin no puede ser anterior al inicio'; end if;
    if pfin is not null and (x ->> 'ini') <= pfin then return 'La fase ' || f || ' debe empezar después de que termine ' || pf || ' (' || to_char(pfin::date, 'DD-MM-YYYY') || ')'; end if;
    pf := f; pfin := x ->> 'fin';
  end loop;
  for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) loop
    w := ff -> (sf ->> 'fase');
    if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
      return 'La subfase «' || coalesce(sf ->> 'nombre', '') || '» quedaría fuera de ' || (sf ->> 'fase') || ' (' || to_char((w ->> 'ini')::date, 'DD-MM-YYYY') || ' → ' || to_char((w ->> 'fin')::date, 'DD-MM-YYYY') || '): ajústala primero'; end if;
  end loop;
  return '';
end $$;

-- 2. Ventana de cada fase: la fecha explícita manda; si no, desde el día siguiente al fin de la anterior hasta su último hito
create or replace function public.apih_ventanas(p jsonb, p_id text, p_prop boolean) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(p_prop); n int := cardinality(fs); k int; f text; ff jsonb := coalesce(case when jsonb_typeof(p -> 'fasesFechas') = 'object' then p -> 'fasesFechas' end, '{}'::jsonb);
  ini text; fin text; prev text; sal jsonb := '[]'::jsonb; hf text; hl text; nh int; dn int; expl boolean; pr numeric; idx int := array_position(fs, p ->> 'fase');
begin
  for k in 1..n loop
    f := fs[k];
    select min(nullif(h ->> 'fecha', '')), max(nullif(h ->> 'fecha', '')), count(*)::int, (count(*) filter (where h ->> 'completado' = 'true'))::int into hf, hl, nh, dn
      from (select substr(datos, 4)::jsonb h from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id) x
     where h ->> 'fase' = f;
    ini := case when k = 1 then coalesce(nullif(p ->> 'inicioPlan', ''), case when p_prop then nullif(p ->> 'creada', '') end, hf)
                else case when prev is not null then (prev::date + 1)::text else hf end end;
    fin := case when hl is not null then hl else case when k = n then coalesce(nullif(p ->> 'finPlan', ''), ini) else ini end end;
    if ini is not null and fin is not null and fin < ini then fin := ini; end if;
    if ini is null then ini := fin; end if;
    expl := public.apih_fecha_fase_ok(ff -> f);
    if expl then ini := ff -> f ->> 'ini'; fin := ff -> f ->> 'fin'; end if;
    if fin is not null then prev := fin; end if;
    pr := public.apih_avance_fase(p, p_id, f);
    sal := sal || jsonb_build_array(jsonb_build_object('fase', f, 'ini', ini, 'fin', fin, 'explicita', expl, 'hitos', nh, 'done', dn, 'unidades', pr is not null,
             'avance', round(coalesce(pr, case when idx is not null and k < idx then 1 else 0 end) * 100)::int));
  end loop;
  return sal;
end $$;

-- Convierte en explícitas las fechas que hoy se derivan de los hitos (proyectos anteriores). null si no hay de dónde sacarlas.
create or replace function public.apih_fases_materializadas(p jsonb, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v jsonb := public.apih_ventanas(p, p_id, false); x jsonb; ff jsonb := '{}'::jsonb; prev date; a date; b date; ok boolean := true;
begin
  for x in select * from jsonb_array_elements(v) loop if x ->> 'ini' is null or x ->> 'fin' is null then ok := false; end if; end loop;
  if not ok then
    if coalesce(p ->> 'inicioPlan', '') ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(p ->> 'finPlan', '') ~ '^\d{4}-\d{2}-\d{2}$' then
      return public.apih_distribuir_fases((p ->> 'inicioPlan')::date, (p ->> 'finPlan')::date, public.apih_fases(false)); end if;
    return null;
  end if;
  for x in select * from jsonb_array_elements(v) loop
    a := (x ->> 'ini')::date; b := (x ->> 'fin')::date;
    if prev is not null and a <= prev then a := prev + 1; end if;
    if b < a then b := a; end if;
    ff := ff || jsonb_build_object(x ->> 'fase', jsonb_build_object('ini', a::text, 'fin', b::text)); prev := b;
  end loop;
  return ff;
end $$;

-- 3. Propuesta de reprogramación al avanzar de fase: la fase destino empieza hoy; las siguientes se mueven conservando su duración;
--    la fase que se deja (y las que se saltan) terminan ayer; las subfases se ajustan a sus nuevas ventanas. null si no corresponde.
create or replace function public.apih_plan_cambio_fase(p_id text, p_to text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare r record; p jsonb; fs text[] := public.apih_fases(false); n int := cardinality(fs); c int; x int; k int; f text; v jsonb; old jsonb := '{}'::jsonb; nu jsonb := '{}'::jsonb;
  h date := public.apih_hoy(); delta int; fin_ date; cur date; dur int; sf jsonb; w jsonb; a date; b date; subs jsonb := '[]'::jsonb; t jsonb; err text; r0i text; r0f text; r1i text; r1f text; el jsonb;
begin
  select lista, substr(datos, 4)::jsonb j into r from public.registros_v where lista = 'APIH_Proyectos' and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then return null; end if;
  p := r.j;
  if p ->> 'estado' = any (array['Completado', 'Cancelado']) then return null; end if;
  c := array_position(fs, p ->> 'fase'); x := array_position(fs, p_to);
  if c is null or x is null or x <= c then return null; end if;
  v := public.apih_ventanas(p, p_id, false);
  for el in select * from jsonb_array_elements(v) loop
    if el ->> 'ini' is null or el ->> 'fin' is null then return null; end if;
    old := old || jsonb_build_object(el ->> 'fase', jsonb_build_object('ini', el ->> 'ini', 'fin', el ->> 'fin'));
  end loop;
  delta := h - (old -> p_to ->> 'ini')::date;
  for k in 1..(c - 1) loop f := fs[k]; nu := nu || jsonb_build_object(f, old -> f); end loop;
  fin_ := h - 1;
  for k in reverse (x - 1)..c loop
    f := fs[k];
    if k = c then nu := nu || jsonb_build_object(f, jsonb_build_object('ini', old -> f ->> 'ini', 'fin', fin_::text));
    else nu := nu || jsonb_build_object(f, jsonb_build_object('ini', fin_::text, 'fin', fin_::text)); fin_ := fin_ - 1; end if;
  end loop;
  cur := h;
  for k in x..n loop
    f := fs[k]; dur := (old -> f ->> 'fin')::date - (old -> f ->> 'ini')::date;
    nu := nu || jsonb_build_object(f, jsonb_build_object('ini', cur::text, 'fin', (cur + dur)::text)); cur := cur + dur + 1;
  end loop;
  t := p;
  for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) loop
    k := array_position(fs, sf ->> 'fase'); w := nu -> (sf ->> 'fase');
    continue when k is null or k < c or w is null;
    a := (sf ->> 'inicio')::date; b := (sf ->> 'fin')::date;
    if k >= x then a := a + delta; b := b + delta; end if;
    if a < (w ->> 'ini')::date then a := (w ->> 'ini')::date; end if;
    if a > (w ->> 'fin')::date then a := (w ->> 'fin')::date; end if;
    if b > (w ->> 'fin')::date then b := (w ->> 'fin')::date; end if;
    if b < a then b := a; end if;
    if a::text <> (sf ->> 'inicio') or b::text <> (sf ->> 'fin') then subs := subs || jsonb_build_array(jsonb_build_object('id', sf ->> 'id', 'inicio', a::text, 'fin', b::text, 'nombre', sf ->> 'nombre')); end if;
  end loop;
  t := jsonb_set(t, '{subfases}', (select coalesce(jsonb_agg(case when m.s is null then s0 else s0 || jsonb_build_object('inicio', m.s ->> 'inicio', 'fin', m.s ->> 'fin') end), '[]'::jsonb)
         from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) s0
         left join lateral (select s from jsonb_array_elements(subs) s where s ->> 'id' = s0 ->> 'id' limit 1) m on true));
  err := public.apih_fases_error(t, nu);
  r0i := old -> fs[1] ->> 'ini'; r0f := old -> fs[n] ->> 'fin'; r1i := nu -> fs[1] ->> 'ini'; r1f := nu -> fs[n] ->> 'fin';
  return jsonb_build_object('fases', nu, 'subs', subs, 'error', nullif(err, ''), 'hoy', h::text, 'ayer', (h - 1)::text, 'delta', delta, 'faseActual', p ->> 'fase', 'destino', p_to,
    'inicioDestinoPlan', old -> p_to ->> 'ini', 'saltadas', (x - c) > 1, 'sigueFase', x < n,
    'rango0', jsonb_build_object('ini', r0i, 'fin', r0f), 'rango1', jsonb_build_object('ini', r1i, 'fin', r1f),
    'resumen', p_to || ' empieza ' || to_char(h, 'DD-MM-YYYY') || case when delta <> 0 then ' (' || case when delta > 0 then '+' else '' end || delta || ' d)' else '' end
               || '; fin ' || to_char(r0f::date, 'DD-MM-YYYY') || ' → ' || to_char(r1f::date, 'DD-MM-YYYY'));
end $$;

-- 4. Transición con reprogramación opcional del plan
drop function if exists public.apih_transicion(text, text, text, text, date, boolean, text);
create or replace function public.apih_transicion(p_id text, p_fase text default null, p_estado text default null, p_motivo text default '', p_rev date default null, p_forzar boolean default false, p_nota text default '', p_reprogramar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; es_prop boolean; fs text[]; ult text; prev_f text; prev_e text; hasta text; faltan text[] := '{}';
  motivo text := btrim(coalesce(p_motivo, '')); nota text := btrim(coalesce(p_nota, '')); forz text := ''; permitidos text[]; final_ text[]; necesita_mot boolean; necesita_rev boolean;
  hs jsonb; txt text; pl jsonb; sfs jsonb;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if (p_fase is null) = (p_estado is null) then raise exception 'APIH: indica la fase o el estado (uno solo)' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{' for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas'; prev_e := i ->> 'estado'; prev_f := i ->> 'fase';
  fs := public.apih_fases(es_prop); ult := fs[cardinality(fs)];
  final_ := case when es_prop then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end;
  if prev_e = any(final_) then raise exception 'APIH: la % está en estado final (%); para retomarla usa «Reabrir»', case when es_prop then 'propuesta' else 'proyecto' end, prev_e using errcode = '22023'; end if;

  if p_fase is not null then
    if prev_e = 'Stand By' then raise exception 'APIH: está en Stand By; reactívala antes de cambiar de fase' using errcode = '22023', hint = 'estado'; end if;
    if not (p_fase = any(fs)) then raise exception 'APIH: fase inválida (%)', p_fase using errcode = '22023', hint = 'fase'; end if;
    if p_fase = prev_f then raise exception 'APIH: ya está en la fase %', p_fase using errcode = '22023', hint = 'fase'; end if;
    hasta := p_fase;
  else
    permitidos := case when es_prop then array['Vigente', 'En espera', 'Stand By', 'Rechazada', 'Retirada'] else array['En curso', 'Pausado', 'Stand By', 'Cancelado', 'Completado'] end;
    if p_estado = 'Aprobada' then raise exception 'APIH: para aprobar una propuesta usa «Aprobar y crear proyecto»' using errcode = '22023', hint = 'estado'; end if;
    if not (p_estado = any(permitidos)) then raise exception 'APIH: estado inválido para % (%)', case when es_prop then 'una propuesta' else 'un proyecto' end, p_estado using errcode = '22023', hint = 'estado'; end if;
    if p_estado = prev_e then raise exception 'APIH: ya está en el estado %', p_estado using errcode = '22023', hint = 'estado'; end if;
    necesita_mot := p_estado = any(array['En espera', 'Pausado', 'Stand By', 'Rechazada', 'Retirada', 'Cancelado']);
    necesita_rev := p_estado = any(array['En espera', 'Pausado']);
    if necesita_mot and motivo = '' then raise exception 'APIH: indica el motivo del estado %', p_estado using errcode = '22023', hint = 'motivo'; end if;
    if necesita_rev and p_rev is null then raise exception 'APIH: indica la fecha de revisión' using errcode = '22023', hint = 'rev'; end if;
    if p_estado = 'Completado' then
      if prev_f <> ult then raise exception 'APIH: un proyecto se completa desde su última fase (%)', ult using errcode = '22023', hint = 'estado'; end if;
      hasta := 'Cierre';
    end if;
  end if;

  if hasta is not null then
    faltan := public.apih_faltan_transicion(p_id, hasta);
    if cardinality(faltan) > 0 then
      if not (p_forzar and per.rol = 'admin') then raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023'; end if;
      if nota = '' then raise exception 'APIH: indica el motivo del cambio forzado' using errcode = '22023', hint = 'nota'; end if;
      forz := ' (forzado: ' || nota || '; faltaba: ' || array_to_string(faltan, ', ') || ')';
    end if;
  end if;

  perform set_config('apih.interno', 'on', true);
  if p_fase is not null then
    if p_reprogramar then
      -- reprogramar el plan desde hoy: el cálculo es el mismo que muestra apih_plan_cambio_fase (aquí se evalúa con la fase aún sin cambiar)
      pl := public.apih_plan_cambio_fase(p_id, p_fase);
      if pl is null then raise exception 'APIH: el plan no se puede reprogramar en este cambio de fase' using errcode = '22023', hint = 'reprogramar'; end if;
      if pl ->> 'error' is not null then raise exception 'APIH: no se puede reprogramar el plan: %', pl ->> 'error' using errcode = '22023', hint = 'reprogramar'; end if;
      sfs := (select coalesce(jsonb_agg(case when m.s is null then x else x || jsonb_build_object('inicio', m.s ->> 'inicio', 'fin', m.s ->> 'fin') end order by o), '[]'::jsonb)
                from jsonb_array_elements(coalesce(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' end, '[]'::jsonb)) with ordinality t(x, o)
                left join lateral (select s from jsonb_array_elements(pl -> 'subs') s where s ->> 'id' = x ->> 'id' limit 1) m on true);
      i := i || jsonb_build_object('fasesFechas', pl -> 'fases', 'subfases', sfs,
             'inicioPlan', (select min(v ->> 'ini') from jsonb_each(pl -> 'fases') e(k2, v)), 'finPlan', (select max(v ->> 'fin') from jsonb_each(pl -> 'fases') e(k2, v)));
      perform public.apih_bitacora(p_id, 'Cambio', 'Plan reprogramado al cambiar de fase: ' || (pl ->> 'resumen'));
    end if;
    i := i || jsonb_build_object('fase', p_fase, 'faseDesde', hoy::text, 'actualizada', hoy::text);
    if not es_prop and p_fase = 'Ejecución' then
      if coalesce(i ->> 'inicioReal', '') = '' then i := i || jsonb_build_object('inicioReal', hoy::text); end if;
      if (i -> 'base') is null or jsonb_typeof(i -> 'base') = 'null' then
        if coalesce(i ->> 'inicioPlan', '') <> '' and coalesce(i ->> 'finPlan', '') <> '' then
          select coalesce(jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'fecha', x ->> 'fecha')), '[]'::jsonb) into hs
            from (select substr(datos, 4)::jsonb x from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id order by id) q;
          i := i || jsonb_build_object('base', jsonb_build_object('fecha', hoy::text, 'inicio', i ->> 'inicioPlan', 'fin', i ->> 'finPlan',
                 'pres', case when public.apih_ve_montos() then coalesce((i ->> 'presupuesto')::numeric, 0) else 0 end, 'por', coalesce(per.nombre, per.email), 'hitos', hs));
          perform public.apih_bitacora(p_id, 'Cambio', 'Línea base congelada · fin ' || (i ->> 'finPlan') || ' · ' || jsonb_array_length(hs) || ' hitos');
        end if;
      end if;
    end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Cambio de fase: ' || prev_f || ' → ' || p_fase || forz);
  else
    i := i || jsonb_build_object('estado', p_estado, 'estadoMotivo', case when necesita_mot then motivo else '' end, 'estadoRev', case when necesita_rev then p_rev::text else null end, 'actualizada', hoy::text);
    if p_estado = 'Completado' then i := i || jsonb_build_object('finReal', hoy::text); end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Estado: ' || prev_e || ' → ' || p_estado || case when motivo <> '' then ' — ' || motivo else '' end || forz);
  end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('fase', i ->> 'fase', 'estado', i ->> 'estado', 'avance', i -> 'avance');
end $$;
revoke all on function public.apih_transicion(text, text, text, text, date, boolean, text, boolean) from public, anon;
grant execute on function public.apih_transicion(text, text, text, text, date, boolean, text, boolean) to authenticated;

-- 5. Comando: fijar o editar las fechas de las fases (p_ff null = convertir en explícitas las fechas derivadas de los hitos)
create or replace function public.apih_fases_fechas(p_id text, p_ff jsonb default null) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; ff jsonb; fs text[] := public.apih_fases(false); f text; limpio jsonb := '{}'::jsonb; err text; hoy date := public.apih_hoy(); ri text; rf text; txt text := '';
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into ir from public.registros where lista = 'APIH_Proyectos' and id = p_id and left(substr(datos, 4), 1) = '{' for update;
  if not found then raise exception 'APIH: el proyecto % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso para editar este proyecto' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb;
  ff := coalesce(p_ff, public.apih_fases_materializadas(i, p_id));
  if ff is null then raise exception 'APIH: define el inicio y el fin plan (o al menos un hito) para fijar las fases' using errcode = '22023', hint = 'fasesFechas'; end if;
  err := public.apih_fases_error(i, ff);
  if err <> '' then raise exception 'APIH: %', err using errcode = '22023', hint = 'fasesFechas'; end if;
  foreach f in array fs loop limpio := limpio || jsonb_build_object(f, jsonb_build_object('ini', ff -> f ->> 'ini', 'fin', ff -> f ->> 'fin')); txt := txt || case when txt = '' then '' else ' · ' end || f || ' ' || (ff -> f ->> 'ini') || ' → ' || (ff -> f ->> 'fin'); end loop;
  select min(v ->> 'ini'), max(v ->> 'fin') into ri, rf from jsonb_each(limpio) e(k, v);
  i := i || jsonb_build_object('fasesFechas', limpio, 'inicioPlan', ri, 'finPlan', rf, 'actualizada', hoy::text);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', 'Fechas de las fases: ' || txt || ' (plan ' || ri || ' → ' || rf || ')');
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('fasesFechas', limpio, 'inicioPlan', ri, 'finPlan', rf);
end $$;
revoke all on function public.apih_fases_fechas(text, jsonb) from public, anon;
grant execute on function public.apih_fases_fechas(text, jsonb) to authenticated;
revoke all on function public.apih_fases_error(jsonb, jsonb), public.apih_ventanas(jsonb, text, boolean), public.apih_fases_materializadas(jsonb, text) from public, anon;
revoke all on function public.apih_plan_cambio_fase(text, text) from public, anon;
grant execute on function public.apih_plan_cambio_fase(text, text) to authenticated;

-- 6. Disparador de filas con plan y avance derivados
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
  privilegiado boolean := coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role' or public.apih_rol() = 'admin';
  fs0 text[]; est0 text; fsn text[]; ffn jsonb; ffo jsonb; expl boolean; f_ text; cc int;
begin
  -- Actualización derivada (el avance de un proyecto cuando cambia uno de sus hitos): no es una edición de nadie, conserva versión y autor
  if tg_op = 'UPDATE' and new.lista = 'APIH_Proyectos' and coalesce(current_setting('apih.derivado', true), '') = 'on' then
    new.actualizado := old.actualizado; new.modificado_por := old.modificado_por; return new;
  end if;
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista not in ('APIH_Config', 'APIH_Roles') then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  perform public.apih_validar(new.lista, new.id, jn);
  perform public.apih_validar_ciclo(new.lista, jn);
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
    if not privilegiado then
      if tg_op = 'UPDATE' then
        foreach k in array array['fase','estado','estadoMotivo','estadoRev','faseDesde','proyecto','propuestaOrigen'] loop
          if coalesce(jn ->> k, '') is distinct from coalesce(jo ->> k, '') then
            raise exception 'APIH: «%» solo cambia con «Cambiar etapa» (comando del servidor)', k using errcode = '42501', hint = k; end if;
        end loop;
      else
        fs0 := public.apih_fases(new.lista = 'APIH_Propuestas');
        if coalesce(jn ->> 'fase', fs0[1]) <> fs0[1] then raise exception 'APIH: una iniciativa nueva empieza en la fase %', fs0[1] using errcode = '42501', hint = 'fase'; end if;
        est0 := (case when new.lista = 'APIH_Propuestas' then 'Vigente' else 'En curso' end);
        if coalesce(jn ->> 'estado', est0) <> est0 then
          raise exception 'APIH: una iniciativa nueva empieza en su estado inicial' using errcode = '42501', hint = 'estado'; end if;
        if coalesce(jn ->> 'proyecto', '') <> '' or coalesce(jn ->> 'propuestaOrigen', '') <> '' then
          raise exception 'APIH: el vínculo propuesta-proyecto lo crea la aprobación' using errcode = '42501'; end if;
      end if;
    end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  -- Plan y avance de un proyecto: los deriva el servidor, nadie los escribe por separado
  if new.lista = 'APIH_Proyectos' then
    fsn := public.apih_fases(false); ffn := jn -> 'fasesFechas'; ffo := jo -> 'fasesFechas';
    -- las fechas de fase ya fijadas no se pierden porque quien guarda no las traiga (la copia de la app puede ir un paso atrás)
    if tg_op = 'UPDATE' and jsonb_typeof(ffo) = 'object' and coalesce(jsonb_typeof(ffn), 'null') <> 'object' then jn := jn || jsonb_build_object('fasesFechas', ffo); ffn := ffo; end if;
    expl := jsonb_typeof(ffn) = 'object';
    if expl then foreach f_ in array fsn loop if not public.apih_fecha_fase_ok(ffn -> f_) then expl := false; end if; end loop; end if;
    if expl and ffn is distinct from ffo then
      -- fechas de fase explícitas: el rango del proyecto es el de sus fases
      jn := jn || jsonb_build_object('inicioPlan', (select min(v ->> 'ini') from jsonb_each(ffn) e(k2, v) where k2 = any(fsn)),
                                     'finPlan',    (select max(v ->> 'fin') from jsonb_each(ffn) e(k2, v) where k2 = any(fsn)));
    elsif ffn is not distinct from ffo and ((jn ->> 'inicioPlan') is distinct from (jo ->> 'inicioPlan') or (jn ->> 'finPlan') is distinct from (jo ->> 'finPlan')) then
      -- cambió el rango del proyecto: reparte o reescala las fases
      jn := public.apih_set_rango_plan(jn, coalesce(jn ->> 'inicioPlan', ''), coalesce(jn ->> 'finPlan', ''), fsn);
    end if;
    -- ajuste manual del avance igual al calculado = sin ajuste
    if jsonb_typeof(jn -> 'avanceManual') = 'number' and (jn -> 'avanceManual') is distinct from (jo -> 'avanceManual') then
      cc := public.apih_avance_calc(jn, new.id);
      if round((jn ->> 'avanceManual')::numeric)::int = cc then jn := jn || jsonb_build_object('avanceManual', null); end if;
    end if;
    jn := public.apih_avance_fila(jn, new.id, public.apih_hoy());
  end if;

  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

-- 7. Un cambio en los hitos refresca el avance del proyecto (valor derivado: no cambia su versión ni su autor)
create or replace function public.apih_hito_derivados() returns trigger language plpgsql security definer set search_path = public as
$$
declare ids text[] := '{}'; pid text; r public.registros; j jsonb; nj jsonb;
begin
  if tg_op in ('INSERT', 'UPDATE') and left(substr(new.datos, 4), 1) = '{' then ids := ids || coalesce(substr(new.datos, 4)::jsonb ->> 'ini', ''); end if;
  if tg_op in ('UPDATE', 'DELETE') and left(substr(old.datos, 4), 1) = '{' then ids := ids || coalesce(substr(old.datos, 4)::jsonb ->> 'ini', ''); end if;
  for pid in select distinct x from unnest(ids) x where x <> '' loop
    select * into r from public.registros where lista = 'APIH_Proyectos' and id = pid and left(substr(datos, 4), 1) = '{';
    continue when not found;
    j := substr(r.datos, 4)::jsonb; nj := public.apih_avance_fila(j, pid, public.apih_hoy());
    if nj is distinct from j then
      perform set_config('apih.derivado', 'on', true);
      update public.registros set datos = 'p1.' || nj::text where lista = 'APIH_Proyectos' and id = pid;
      perform set_config('apih.derivado', 'off', true);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists apih_hito_derivados_i on public.registros; drop trigger if exists apih_hito_derivados_u on public.registros; drop trigger if exists apih_hito_derivados_d on public.registros;
create trigger apih_hito_derivados_i after insert on public.registros for each row when (new.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();
create trigger apih_hito_derivados_u after update on public.registros for each row when (new.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();
create trigger apih_hito_derivados_d after delete on public.registros for each row when (old.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();

-- ===== 20261028000400_calculos_avance.sql =====
-- Iter 3b · apih_calculos entrega también el avance (efectivo, calculado y ajuste manual) y la ventana de cada fase con su avance
create or replace function public.apih_calculos() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); fases text[] := array_remove(public.apih_fases(false), 'Cierre');
  ini jsonb := '{}'::jsonb; hit jsonb := '{}'::jsonb; rsk jsonb := '{}'::jsonb;
  r record; j jsonb; i record; ff text[]; ix int; sig jsonb;
  hitos jsonb := '{}'::jsonb;      -- por iniciativa: arreglo de hitos
  riesgos jsonb := '{}'::jsonb;    -- por iniciativa: arreglo de {id, expo, abierto}
  hs jsonb; rs jsonb; abiertas date[]; n_hit int; vivo boolean; hecho boolean; es_prop boolean; fc date; fin_plan date; ds int; tol numeric; umb numeric;
  dsu int; cc2 int; m2 int; ef2 numeric; esp numeric; av numeric; p int; why jsonb; hv int; rc int; exp_ numeric; sumexp numeric; rag text; crit numeric; ti date; tt int; tz int;
begin
  -- 1) hitos (por iniciativa) y su estado
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' loop
    hit := hit || jsonb_build_object(r.id, public.apih_estado_hito(r.j, hoy));
    hitos := jsonb_set(hitos, array[coalesce(r.j ->> 'ini', '')], coalesce(hitos -> coalesce(r.j ->> 'ini', ''), '[]'::jsonb) || jsonb_build_array(r.j), true);
  end loop;
  -- 2) riesgos: se calculan con el umbral de su iniciativa (después de leer las iniciativas)
  -- 3) iniciativas
  for i in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    j := i.j; es_prop := j ->> 'tipo' = 'Propuesta' or i.lista = 'APIH_Propuestas';
    hecho := j ->> 'estado' = any (case when es_prop then array['Aprobada','Rechazada','Retirada'] else array['Completado','Cancelado'] end);
    vivo := not hecho and coalesce(j ->> 'estado', '') <> 'Stand By';
    hs := coalesce(hitos -> i.id, '[]'::jsonb);
    tol := public.apih_umbral(j, 'tolDesv'); umb := public.apih_umbral(j, 'umbralCritico');
    -- fin proyectado
    fin_plan := public.apih_fecha(j, 'finPlan');
    if j ->> 'estado' = 'Completado' then fc := coalesce(public.apih_fecha(j, 'finReal'), public.apih_fecha(j, 'finEst'), fin_plan);
    else
      fc := coalesce(case when public.apih_vacio(j, 'finEst') then null else public.apih_fecha(j, 'finEst') end, fin_plan);
      select max(public.apih_fecha(h, 'fecha')) into ti from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true';
      if ti is not null and (j ->> 'fase') = any (fases) and (fc is null or ti > fc) then fc := ti; end if;
      if vivo and (j ->> 'fase') = any (fases) and public.apih_num(j, 'avance') < 100 and (fc is null or fc < hoy) then fc := hoy; end if;
    end if;
    ds := case when fin_plan is not null and fc is not null then greatest(0, fc - fin_plan) else 0 end;
    -- avance esperado (lineal)
    ti := public.apih_fecha(j, 'inicioPlan');
    esp := case when ti is null or fin_plan is null then 0
                else greatest(0, least(100, (hoy - ti)::numeric / greatest(1, fin_plan - ti) * 100)) end;
    dsu := case when public.apih_vacio(j, 'actualizada') then 999 else hoy - public.apih_fecha(j, 'actualizada') end;
    select count(*) into hv from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true' and public.apih_fecha(h, 'fecha') < hoy;
    -- riesgos de la iniciativa
    select coalesce(sum(public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp')) filter (where x.j ->> 'estado' is distinct from 'Cerrado'), 0),
           count(*) filter (where x.j ->> 'estado' is distinct from 'Cerrado' and public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp') >= umb)
      into sumexp, rc
      from (select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = i.id) x;
    -- semáforo sugerido
    p := 0; why := '[]'::jsonb;
    if ds > 30 then p := p + 2; why := why || to_jsonb('desviación de ' || ds || ' d');
    elsif ds > tol then p := p + 1; why := why || to_jsonb('desviación de ' || ds || ' d'); end if;
    if hv >= 2 then p := p + 2; why := why || to_jsonb(hv || ' hitos vencidos');
    elsif hv = 1 then p := p + 1; why := why || to_jsonb('1 hito vencido'::text); end if;
    if rc > 0 then p := p + 2; why := why || to_jsonb(rc || ' riesgo(s) crítico(s)'); end if;
    av := public.apih_num(j, 'avance');
    if (j ->> 'fase') = any (fases) and esp - av > 25 then p := p + 1; why := why || to_jsonb('avance bajo lo esperado'::text); end if;
    if vivo and (j ->> 'fase') = any (fases) and dsu > public.apih_umbral(j, 'diasSinUpdate') * 2 then p := p + 1; why := why || to_jsonb('sin actualización'::text); end if;
    rag := case when p >= 4 then 'Rojo' when p >= 2 then 'Ámbar' else 'Verde' end;
    crit := (case j ->> 'rag' when 'Rojo' then 40 when 'Ámbar' then 20 else 0 end) + least(30, ds / 2.0) + sumexp / 2
            + (case j ->> 'prioridad' when 'Alta' then 12 when 'Media' then 6 else 0 end) + hv * 4;
    -- compuertas del siguiente paso: próxima fase; si no hay, aprobar (propuesta) o completar (proyecto)
    ff := public.apih_fases(es_prop); ix := array_position(ff, j ->> 'fase');
    sig := case when hecho then '[]'::jsonb
                when ix is not null and ix < cardinality(ff) then public.apih_compuertas(i.id, ff[ix + 1])
                when es_prop then public.apih_compuertas_aprobar(i.id)
                else public.apih_compuertas(i.id, 'Cierre') end;
    cc2 := case when es_prop then 0 else public.apih_avance_calc(j, i.id) end;
    m2 := case when not es_prop and jsonb_typeof(j -> 'avanceManual') = 'number' then greatest(0, least(100, round((j ->> 'avanceManual')::numeric)))::int end;
    ef2 := case when es_prop then public.apih_num(j, 'avance') when j ->> 'estado' = 'Completado' then 100 else coalesce(m2, cc2) end;
    ini := ini || jsonb_build_object(i.id, jsonb_build_object('sig', sig, 'avance', ef2, 'avanceCalc', cc2, 'avanceManual', m2,
      'fasesFechas', j -> 'fasesFechas', 'inicioPlan', j -> 'inicioPlan', 'finPlan', j -> 'finPlan',
      'ventanas', case when es_prop then public.apih_ventanas(j, i.id, true) else public.apih_ventanas(j, i.id, false) end,
      'forecast', fc, 'desv', ds, 'atrasado', (vivo and (j ->> 'fase') = any (fases) and ds > tol), 'esperado', esp,
      'roi', case when public.apih_num(j, 'presupuesto') > 0 then ((public.apih_num(j, 'beneficio') - public.apih_num(j, 'presupuesto')) / public.apih_num(j, 'presupuesto')) * 100 end,
      'rag', jsonb_build_object('rag', rag, 'why', why), 'crit', crit, 'dsu', dsu, 'hv', hv, 'umbral', umb, 'tol', tol,
      'compl', public.apih_completitud(j, jsonb_array_length(hs) > 0)));
  end loop;
  -- 4) riesgos con su exposición y nivel (umbral de la iniciativa; si no existe, el de la organización)
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' loop
    umb := coalesce((ini -> (r.j ->> 'ini') ->> 'umbral')::numeric, public.apih_num(public.apih_cfg(), 'umbralCritico'));
    exp_ := public.apih_num(r.j, 'prob') * public.apih_num(r.j, 'imp');
    rsk := rsk || jsonb_build_object(r.id, jsonb_build_object('expo', exp_, 'nivel', public.apih_nivel_riesgo(exp_, umb),
                                      'critico', (r.j ->> 'estado' is distinct from 'Cerrado' and exp_ >= umb)));
  end loop;
  return jsonb_build_object('hoy', hoy, 'ini', ini, 'hitos', hit, 'riesgos', rsk);
end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028000500_importar_iniciativas.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 3c · Importar iniciativas: un comando del servidor
--   Antes: la SPA depuraba el archivo (lista blanca de campos, tipos, rangos), repartía las fechas de fase, validaba las subfases contra
--   la ventana de su fase, resolvía las referencias de los hitos y escribía todo. Ahora el archivo viaja tal cual y lo hace el servidor
--   en una sola transacción: apih_importar_iniciativas(p_items). La SPA solo lee el archivo y muestra el resultado y los avisos.
-- =====================================================================================

create or replace function public.apih_norm(t text) returns text language sql immutable as
$$ select translate(lower(btrim(coalesce(t, ''))), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou') $$;

-- Depuradores de valores del archivo: devuelven null (se descarta el campo) si el valor no cumple
create or replace function public.apih_imp_txt(v jsonb, mx int) returns jsonb language sql immutable as
$$ select case when jsonb_typeof(v) = 'string' then to_jsonb(left(btrim(v #>> '{}'), mx)) end $$;
create or replace function public.apih_imp_enm(v jsonb) returns jsonb language sql immutable as
$$ select case when jsonb_typeof(v) = 'string' and btrim(v #>> '{}') ~ '^[^<>"''`=\\]{1,80}$' then to_jsonb(btrim(v #>> '{}')) end $$;
create or replace function public.apih_imp_num(v jsonb, lo numeric, hi numeric) returns jsonb language plpgsql immutable as
$$ declare n numeric;
begin
  if jsonb_typeof(v) = 'number' then n := (v #>> '{}')::numeric;
  elsif jsonb_typeof(v) = 'string' and btrim(v #>> '{}') ~ '^-?\d+(\.\d+)?$' then n := btrim(v #>> '{}')::numeric;
  else return null; end if;
  return case when n >= lo and n <= hi then to_jsonb(n) end;
end $$;
create or replace function public.apih_imp_fec(v jsonb) returns jsonb language plpgsql immutable as
$$ begin
  if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' and (v #>> '{}')::date between date '1900-01-01' and date '2100-12-31' and to_char((v #>> '{}')::date, 'YYYY-MM-DD') = (v #>> '{}') then return v; end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.apih_importar_iniciativas(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg(); x jsonb; n jsonb; san jsonb; pr boolean; lst text; pre text; nid text; fs text[]; fall text[];
  cats jsonb := coalesce(case when jsonb_typeof(cfg -> 'hitoCats') = 'array' and jsonb_array_length(cfg -> 'hitoCats') > 0 then cfg -> 'hitoCats' end,
                         '["Entregable","Gobierno","Técnico","Proveedor","Pago","Comunicación","Otro"]'::jsonb);
  creadas jsonb := '[]'::jsonb; omitidas jsonb := '[]'::jsonb; avisos jsonb := '[]'::jsonb; nh int := 0; nr int := 0; ns int := 0; nini int := 0;
  h jsonb; hq jsonb; k int; hid text; hf text; ok boolean; hids text[]; r jsonb; rq jsonb; sf jsonb; s jsonb; subs jsonb; w jsonb; v jsonb; fase_sf text; ini_sf text; fin_sf text; ya int; mxn int; m text;
  fnota jsonb; fx text; ref text; hh jsonb; sfx jsonb; cur jsonb; av text; s_nh int; s_nr int; s_ns int; s_nini int; s_av int;
begin
  if not exists (select 1 from public.perfiles where email = public.apih_email_real() and rol = 'admin' and activo) or public.apih_impersonando() then
    raise exception 'APIH: solo el rol Administra puede importar iniciativas' using errcode = '42501'; end if;
  if public.apih_congelado() then raise exception 'APIH: la organización está en modo solo lectura' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'APIH: el archivo no trae iniciativas' using errcode = '22023'; end if;
  fall := public.apih_fases(false) || public.apih_fases(true);
  perform set_config('apih.interno', 'on', true);

  for x in select * from jsonb_array_elements(p_items) loop
   s_nh := nh; s_nr := nr; s_ns := ns; s_nini := nini; s_av := jsonb_array_length(avisos);
   begin
    if jsonb_typeof(x) is distinct from 'object' or btrim(coalesce(x ->> 'titulo', '')) = '' then omitidas := omitidas || to_jsonb('(sin título)'::text); continue; end if;
    if exists (select 1 from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{'
                 and public.apih_norm(substr(datos, 4)::jsonb ->> 'titulo') = public.apih_norm(x ->> 'titulo')) then
      omitidas := omitidas || to_jsonb(btrim(x ->> 'titulo')); continue; end if;
    pr := x ->> 'tipo' = 'Propuesta'; lst := case when pr then 'APIH_Propuestas' else 'APIH_Proyectos' end; pre := case when pr then 'PROP' else 'PRJ' end;
    fs := public.apih_fases(pr);
    -- campos permitidos y depurados
    san := jsonb_strip_nulls(jsonb_build_object(
      'titulo', public.apih_imp_txt(x -> 'titulo', 200),
      'desc', public.apih_imp_txt(x -> 'desc', 500), 'logros', public.apih_imp_txt(x -> 'logros', 500), 'proximos', public.apih_imp_txt(x -> 'proximos', 500),
      'bc', public.apih_imp_txt(x -> 'bc', 500), 'resumen', public.apih_imp_txt(x -> 'resumen', 500), 'issue', public.apih_imp_txt(x -> 'issue', 500), 'riesgoTxt', public.apih_imp_txt(x -> 'riesgoTxt', 500),
      'lider', public.apih_imp_enm(x -> 'lider'), 'sponsor', public.apih_imp_enm(x -> 'sponsor'), 'negocio', public.apih_imp_enm(x -> 'negocio'), 'proveedor', public.apih_imp_enm(x -> 'proveedor'),
      'area', public.apih_imp_enm(x -> 'area'), 'categoria', public.apih_imp_enm(x -> 'categoria'), 'prioridad', public.apih_imp_enm(x -> 'prioridad'), 'moneda', public.apih_imp_enm(x -> 'moneda'), 'rag', public.apih_imp_enm(x -> 'rag'),
      'fase', case when (x ->> 'fase') = any (fs) then x -> 'fase' end,
      'avance', public.apih_imp_num(x -> 'avance', 0, 100), 'presupuesto', public.apih_imp_num(x -> 'presupuesto', 0, 1e12), 'gastado', public.apih_imp_num(x -> 'gastado', 0, 1e12), 'beneficio', public.apih_imp_num(x -> 'beneficio', 0, 1e12),
      'inicioPlan', public.apih_imp_fec(x -> 'inicioPlan'), 'finPlan', public.apih_imp_fec(x -> 'finPlan'), 'finEst', public.apih_imp_fec(x -> 'finEst'), 'creada', public.apih_imp_fec(x -> 'creada'),
      'faseDesde', public.apih_imp_fec(x -> 'faseDesde'), 'inicioReal', public.apih_imp_fec(x -> 'inicioReal'), 'finReal', public.apih_imp_fec(x -> 'finReal'),
      'deps', case when jsonb_typeof(x -> 'deps') = 'array' then (select coalesce(jsonb_agg(d), '[]'::jsonb) from jsonb_array_elements(x -> 'deps') d where jsonb_typeof(d) = 'string' and (d #>> '{}') ~ '^[A-Za-z0-9_-]{1,20}$') end,
      'tags', case when jsonb_typeof(x -> 'tags') = 'array' then (select coalesce(jsonb_agg(to_jsonb(left(btrim(t #>> '{}'), 40))), '[]'::jsonb) from jsonb_array_elements(x -> 'tags') t where jsonb_typeof(t) = 'string' and btrim(t #>> '{}') <> '') end));
    nid := public.apih_siguiente(pre, lst);
    n := jsonb_build_object('tipo', case when pr then 'Propuesta' else 'Proyecto' end, 'legacy', '', 'creada', hoy::text, 'faseDesde', hoy::text, 'origen', 'importación', 'est', '[]'::jsonb,
           'hist', jsonb_build_array(jsonb_build_array(hoy::text, coalesce((san ->> 'avance')::numeric, 0))), 'tags', '[]'::jsonb, 'rec', null, 'folio', '', 'oc', '', 'ahorroReal', 0, 'inicioReal', null,
           'estado', case when pr then 'Vigente' else 'En curso' end, 'propuestaOrigen', null, 'estadoMotivo', '', 'estadoRev', null, 'rag', 'Verde', 'avance', 0, 'gastado', 0, 'proyecto', null, 'deps', '[]'::jsonb,
           'area', 'BISE', 'fase', fs[1], 'prioridad', 'Media', 'presupuesto', 0, 'logros', '', 'proximos', '', 'sponsor', '', 'lider', '', 'desc', '')
         || san || jsonb_build_object('id', nid, 'actualizada', hoy::text);
    if not pr and not (san ? 'fase') then n := n || jsonb_build_object('fase', 'Planificación'); end if;
    n := n || jsonb_build_object('finEst', coalesce(n -> 'finEst', n -> 'finPlan'));
    insert into public.registros(lista, id, datos) values (lst, nid, 'p1.' || n::text);
    nini := nini + 1;

    -- hitos
    hids := '{}'; k := 0;
    if jsonb_typeof(x -> 'hitos') = 'array' then
      for h in select * from jsonb_array_elements(x -> 'hitos') loop
        k := k + 1; hids[k] := '';
        continue when jsonb_typeof(h) is distinct from 'object' or jsonb_typeof(h -> 'nombre') is distinct from 'string' or btrim(h ->> 'nombre') = '';
        hf := coalesce(public.apih_imp_fec(h -> 'fecha') #>> '{}', ((case when n ->> 'inicioPlan' ~ '^\d{4}-\d{2}-\d{2}$' then (n ->> 'inicioPlan')::date else hoy end) + coalesce((public.apih_imp_num(h -> 'dias', -3650, 3650) #>> '{}')::numeric::int, 0))::text);
        ok := coalesce(h ->> 'completado' = 'true', false);
        hid := public.apih_siguiente('HIT', 'APIH_Hitos');
        hq := jsonb_strip_nulls(jsonb_build_object('id', hid, 'ini', nid, 'nombre', left(btrim(h ->> 'nombre'), 200),
               'fase', case when (h ->> 'fase') = any (fall) then h ->> 'fase' else n ->> 'fase' end, 'fecha', hf, 'completado', ok,
               'fechaReal', case when ok then coalesce(public.apih_imp_fec(h -> 'fechaReal') #>> '{}', hf) end,
               'resp', coalesce(nullif(public.apih_imp_enm(h -> 'resp') #>> '{}', ''), nullif(n ->> 'lider', ''), ''),
               'cat', case when cats ? coalesce(public.apih_imp_enm(h -> 'cat') #>> '{}', '') then public.apih_imp_enm(h -> 'cat') end,
               'desc', case when btrim(coalesce(h ->> 'desc', '')) <> '' then public.apih_imp_txt(h -> 'desc', 500) end));
        if not ok then hq := hq || jsonb_build_object('fechaReal', null); end if;
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hid, 'p1.' || hq::text);
        hids[k] := hid; nh := nh + 1;
      end loop;
    end if;

    select substr(datos, 4)::jsonb into n from public.registros where lista = lst and id = nid;   -- con lo que derivaron los disparadores (fechas de fase, avance)

    -- notas por fase
    if jsonb_typeof(x -> 'faseNota') = 'object' then
      fnota := '{}'::jsonb;
      foreach fx in array fs loop
        if jsonb_typeof(x -> 'faseNota' -> fx) = 'string' and btrim(x -> 'faseNota' ->> fx) <> '' then fnota := fnota || jsonb_build_object(fx, left(btrim(x -> 'faseNota' ->> fx), 500)); end if;
      end loop;
      if fnota <> '{}'::jsonb then n := n || jsonb_build_object('faseNota', fnota); end if;
    end if;

    -- subfases: dentro de UNA fase del proyecto; inicio/fin vacíos heredan los de la fase
    subs := '[]'::jsonb;
    if jsonb_typeof(x -> 'subfases') = 'array' then
      select substr(datos, 4)::jsonb into cur from public.registros where lista = lst and id = nid;
      v := public.apih_ventanas(cur, nid, pr);
      for s in select * from jsonb_array_elements(x -> 'subfases') loop
        continue when jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s -> 'nombre') is distinct from 'string';
        m := left(btrim(s ->> 'nombre'), 120);
        if m = '' or length(s ->> 'nombre') > 120 + 400 then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase sin nombre válido (texto de hasta 120 caracteres; se omite)'); continue; end if;
        fase_sf := s ->> 'fase';
        if fase_sf is null or not (fase_sf = any (fs)) then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: fase inválida para ' || case when pr then 'propuesta' else 'proyecto' end); continue; end if;
        w := (select e from jsonb_array_elements(v) e where e ->> 'fase' = fase_sf limit 1);
        if w is null or w ->> 'ini' is null or w ->> 'fin' is null then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: la fase ' || fase_sf || ' no tiene fechas'); continue; end if;
        ini_sf := coalesce(public.apih_imp_fec(s -> 'inicio') #>> '{}', w ->> 'ini'); fin_sf := coalesce(public.apih_imp_fec(s -> 'fin') #>> '{}', w ->> 'fin');
        if fin_sf < ini_sf then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: fechas inválidas'); continue; end if;
        if ini_sf < (w ->> 'ini') or fin_sf > (w ->> 'fin') then
          avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: debe quedar dentro de ' || fase_sf || ' (' || to_char((w ->> 'ini')::date, 'DD-MM-YYYY') || ' → ' || to_char((w ->> 'fin')::date, 'DD-MM-YYYY') || ')'); continue; end if;
        ya := (select o - 1 from jsonb_array_elements(subs) with ordinality t(e, o)
                where (coalesce(public.apih_imp_enm(s -> 'id') #>> '{}', '') <> '' and e ->> 'id' = s ->> 'id') or (e ->> 'fase' = fase_sf and public.apih_norm(e ->> 'nombre') = public.apih_norm(m)) limit 1);
        sfx := jsonb_strip_nulls(jsonb_build_object('nombre', m, 'fase', fase_sf, 'inicio', ini_sf, 'fin', fin_sf, 'resp', coalesce(public.apih_imp_enm(s -> 'resp') #>> '{}', ''),
                 'desc', case when btrim(coalesce(s ->> 'desc', '')) <> '' then public.apih_imp_txt(s -> 'desc', 500) end));
        if ya is not null then subs := jsonb_set(subs, array[ya::text], (subs -> ya) || sfx);
        else
          if jsonb_array_length(subs) >= 60 then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: máximo 60 por iniciativa'); continue; end if;
          select coalesce(max(substring(e ->> 'id' from 'SF(\d+)$')::int), 0) into mxn from jsonb_array_elements(subs) e;
          subs := subs || jsonb_build_array(sfx || jsonb_build_object('id', nid || '-SF' || (mxn + 1)));
        end if;
      end loop;
      if jsonb_array_length(subs) > 0 then n := n || jsonb_build_object('subfases', subs); ns := ns + jsonb_array_length(subs); end if;
    end if;
    update public.registros set datos = 'p1.' || n::text where lista = lst and id = nid;

    -- referencia de subfase en cada hito: id o nombre (si hay nombres repetidos en distintas fases, se usa la fase del hito)
    k := 0;
    if jsonb_typeof(x -> 'hitos') = 'array' then
      for h in select * from jsonb_array_elements(x -> 'hitos') loop
        k := k + 1;
        continue when hids[k] is null or hids[k] = '' or jsonb_typeof(h) is distinct from 'object' or jsonb_typeof(h -> 'subfase') is distinct from 'string' or btrim(h ->> 'subfase') = '';
        ref := btrim(h ->> 'subfase'); select substr(datos, 4)::jsonb into hh from public.registros where lista = 'APIH_Hitos' and id = hids[k];
        sf := coalesce((select e from jsonb_array_elements(subs) e where e ->> 'id' = ref limit 1),
                       (select e from jsonb_array_elements(subs) e where public.apih_norm(e ->> 'nombre') = public.apih_norm(ref) and e ->> 'fase' = hh ->> 'fase' limit 1),
                       (select e from jsonb_array_elements(subs) e where public.apih_norm(e ->> 'nombre') = public.apih_norm(ref) limit 1));
        if sf is null then avisos := avisos || to_jsonb((n ->> 'titulo') || ': el hito «' || (hh ->> 'nombre') || '» apunta a una subfase que no existe (' || ref || ')'); continue; end if;
        if sf ->> 'fase' <> hh ->> 'fase' then avisos := avisos || to_jsonb((n ->> 'titulo') || ': el hito «' || (hh ->> 'nombre') || '» es de ' || (hh ->> 'fase') || ' y la subfase «' || (sf ->> 'nombre') || '» de ' || (sf ->> 'fase') || ' (sin subfase)'); continue; end if;
        update public.registros set datos = 'p1.' || (hh || jsonb_build_object('subfase', sf ->> 'id'))::text where lista = 'APIH_Hitos' and id = hids[k];
      end loop;
    end if;

    -- riesgos
    if jsonb_typeof(x -> 'riesgos') = 'array' then
      for r in select * from jsonb_array_elements(x -> 'riesgos') loop
        continue when jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r -> 'desc') is distinct from 'string' or btrim(coalesce(r ->> 'desc', '')) = '';
        rq := jsonb_strip_nulls(jsonb_build_object('desc', public.apih_imp_txt(r -> 'desc', 500), 'cat', public.apih_imp_enm(r -> 'cat'), 'dueno', public.apih_imp_enm(r -> 'dueno'), 'mit', public.apih_imp_txt(r -> 'mit', 500),
                'estado', public.apih_imp_enm(r -> 'estado'), 'prob', public.apih_imp_num(r -> 'prob', 1, 5), 'imp', public.apih_imp_num(r -> 'imp', 1, 5), 'fIdent', public.apih_imp_fec(r -> 'fIdent'), 'fRev', public.apih_imp_fec(r -> 'fRev')));
        hid := public.apih_siguiente('RSK', 'APIH_Riesgos');
        insert into public.registros(lista, id, datos) values ('APIH_Riesgos', hid, 'p1.' || (jsonb_build_object('id', hid, 'ini', nid, 'cat', 'Técnico', 'prob', 3, 'imp', 3, 'estado', 'Abierto', 'dueno', coalesce(n ->> 'lider', ''),
          'fIdent', hoy::text, 'fRev', (hoy + 30)::text, 'mit', '') || rq)::text);
        nr := nr + 1;
      end loop;
    end if;

    perform public.apih_bitacora(nid, 'Cambio', (case when pr then 'Propuesta importada: ' else 'Proyecto importado: ' end) || (n ->> 'titulo')
      || case when jsonb_typeof(x -> 'hitos') = 'array' then ' (' || jsonb_array_length(x -> 'hitos') || ' hitos' || case when jsonb_typeof(x -> 'riesgos') = 'array' then ', ' || jsonb_array_length(x -> 'riesgos') || ' riesgos' else '' end || ')' else '' end);
    creadas := creadas || jsonb_build_array(jsonb_build_object('id', nid, 'titulo', n ->> 'titulo'));
   exception when others then
    -- una iniciativa inválida no frena al resto: se deshace solo ella y queda el motivo
    nh := s_nh; nr := s_nr; ns := s_ns; nini := s_nini;
    avisos := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(avisos) with ordinality t(e, o) where o <= s_av order by o) q)
              || to_jsonb(coalesce(btrim(x ->> 'titulo'), '(sin título)') || ': no se importó — ' || regexp_replace(sqlerrm, '^APIH: ', ''));
   end;
  end loop;
  for av in select jsonb_array_elements_text(avisos) loop perform public.apih_bitacora(null, 'Cambio', 'Importación: ' || av); end loop;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('creadas', creadas, 'omitidas', omitidas, 'avisos', avisos, 'hitos', nh, 'riesgos', nr, 'subfases', ns);
end $$;
revoke all on function public.apih_importar_iniciativas(jsonb) from public, anon;
grant execute on function public.apih_importar_iniciativas(jsonb) to authenticated;
revoke all on function public.apih_norm(text), public.apih_imp_txt(jsonb, int), public.apih_imp_enm(jsonb), public.apih_imp_num(jsonb, numeric, numeric), public.apih_imp_fec(jsonb) from public, anon;

-- ===== 20261028000600_mantenimiento.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 4a · Mantenimiento y línea base en el servidor
--   Antes la SPA marcaba decisiones escaladas, otorgaba estrellas Michelin y congelaba la línea base escribiendo ella misma.
--   Ahora lo hace el servidor, con las mismas reglas para todos y con registro en bitácora:
--     · apih_congelar_base(p_id, p_rebase)  congela (o reemplaza, solo administrador) la línea base de un proyecto
--     · apih_michelin_n(p_id)               estrellas que cumple hoy un proyecto (regla única)
--     · apih_mantener()                     marca decisiones escaladas (solo administrador) y otorga estrellas nuevas (nunca quita)
-- =====================================================================================

create or replace function public.apih_congelar_base(p_id text, p_rebase boolean default false) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r public.registros; j jsonb; per public.perfiles; b jsonb; hs jsonb; hoy date := public.apih_hoy();
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Proyectos' and id = p_id for update;
  if not found then raise exception 'APIH: el proyecto % no existe', p_id using errcode = 'P0002'; end if;
  if public.apih_solo_lectura() or not public.apih_edita_area(r.area) then raise exception 'APIH: tu rol no permite editar' using errcode = '42501'; end if;
  if p_rebase and per.rol <> 'admin' then raise exception 'APIH: solo Administra reemplaza la línea base' using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'tipo', '') = 'Propuesta' then raise exception 'APIH: una propuesta no tiene línea base' using errcode = '22023'; end if;
  if public.apih_vacio(j, 'inicioPlan') or public.apih_vacio(j, 'finPlan') then raise exception 'APIH: define inicio y fin plan primero' using errcode = '22023'; end if;
  if j ? 'base' and jsonb_typeof(j -> 'base') = 'object' and not p_rebase then raise exception 'APIH: el proyecto ya tiene línea base' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', h ->> 'id', 'nombre', h ->> 'nombre', 'fecha', h ->> 'fecha') order by h ->> 'fecha', h ->> 'id'), '[]'::jsonb) into hs
    from (select substr(datos, 4)::jsonb h from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where h ->> 'ini' = p_id;
  b := jsonb_build_object('fecha', hoy::text, 'inicio', j -> 'inicioPlan', 'fin', j -> 'finPlan', 'pres', public.apih_num(j, 'presupuesto'),
                          'por', coalesce(nullif(per.nombre, ''), per.email), 'hitos', hs);
  if jsonb_typeof(j -> 'base') = 'object' and p_rebase then j := j || jsonb_build_object('baseHist', coalesce(case when jsonb_typeof(j -> 'baseHist') = 'array' then j -> 'baseHist' end, '[]'::jsonb) || jsonb_build_array(j -> 'base')); end if;
  j := j || jsonb_build_object('base', b);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || j::text where lista = 'APIH_Proyectos' and id = p_id;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_bitacora(p_id, 'Cambio', (case when p_rebase then 'Línea base reemplazada' else 'Línea base congelada' end)
    || ' · fin ' || to_char((b ->> 'fin')::date, 'DD-MM-YYYY') || ' · presupuesto ' || (b ->> 'pres') || ' · ' || jsonb_array_length(hs) || ' hitos');
  return b;
end $$;
revoke all on function public.apih_congelar_base(text, boolean) from public, anon;
grant execute on function public.apih_congelar_base(text, boolean) to authenticated;

-- Estrellas que cumple hoy un proyecto (0 a 3). desv_ = desvío en días (de apih_calculos).
create or replace function public.apih_michelin_n(j jsonb, p_id text, hoy date, desv_ int) returns int
language plpgsql stable security definer set search_path = public as
$$
declare hs jsonb[]; g1 jsonb[]; h jsonb; f1 text; n int := 0; cam_f boolean; cam_p boolean; mid date; hm jsonb[]; ti date; tf date; todos boolean := true; ok boolean;
  fases text[] := public.apih_fases(false);
begin
  if coalesce(j ->> 'tipo', '') = 'Propuesta' or coalesce(j ->> 'estado', '') not in ('En curso', 'Completado') then return 0; end if;
  select coalesce(array_agg(x order by x ->> 'fecha', x ->> 'id'), '{}') into hs
    from (select substr(datos, 4)::jsonb x from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where x ->> 'ini' = p_id;
  select exists (select 1 from public.registros where lista = 'APIH_Cambios' and substr(datos, 4)::jsonb ->> 'ini' = p_id and substr(datos, 4)::jsonb ->> 'estado' = 'Aprobado' and substr(datos, 4)::jsonb ->> 'tipo' = 'Fecha') into cam_f;
  select exists (select 1 from public.registros where lista = 'APIH_Cambios' and substr(datos, 4)::jsonb ->> 'ini' = p_id and substr(datos, 4)::jsonb ->> 'estado' = 'Aprobado' and substr(datos, 4)::jsonb ->> 'tipo' = 'Presupuesto') into cam_p;
  -- primera fase con hitos; si ninguno trae fase (datos importados), el primer hito del cronograma
  select f into f1 from unnest(fases) with ordinality t(f, o) where exists (select 1 from unnest(hs) x where x ->> 'fase' = f) order by o limit 1;
  if f1 is not null then g1 := array(select x from unnest(hs) x where x ->> 'fase' = f1);
  elsif coalesce(array_length(hs, 1), 0) > 0 then g1 := array[hs[1]]; else g1 := '{}'; end if;
  if coalesce(array_length(g1, 1), 0) > 0 then
    n := 1; foreach h in array g1 loop
      ok := h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f);
      if not ok then n := 0; exit; end if; end loop; end if;
  ti := public.apih_fecha(j, 'inicioPlan'); tf := public.apih_fecha(j, 'finPlan');
  if n >= 1 and ti is not null and tf is not null then
    mid := ti + ((tf - ti) / 2);
    if hoy >= mid then
      hm := array(select x from unnest(hs) x where public.apih_fecha(x, 'fecha') <= mid);
      if coalesce(array_length(hm, 1), 0) > 0 then
        todos := true; foreach h in array hm loop
          if not (h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f)) then todos := false; exit; end if; end loop;
        if todos then n := 2; end if;
      elsif desv_ <= public.apih_umbral(j, 'tolDesv') then n := 2; end if;
    end if;
  end if;
  if n >= 2 and j ->> 'estado' = 'Completado' and public.apih_num(j, 'avance') >= 100 then
    todos := true; foreach h in array hs loop
      if not (h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f)) then todos := false; exit; end if; end loop;
    if todos and (case when public.apih_num(j, 'beneficio') > 0 then public.apih_num(j, 'ahorroReal') > 0 else length(btrim(coalesce(j ->> 'resultadoNota', ''))) >= 10 end)
       and (public.apih_vacio(j, 'finReal') or tf is null or public.apih_fecha(j, 'finReal') <= tf or cam_f)
       and (not (public.apih_num(j, 'presupuesto') > 0) or public.apih_num(j, 'gastado') <= public.apih_num(j, 'presupuesto') or cam_p) then n := 3; end if;
  end if;
  return n;
end $$;
revoke all on function public.apih_michelin_n(jsonb, text, date, int) from public, anon, authenticated;

create or replace function public.apih_mantener() returns jsonb
language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); per public.perfiles; cfg jsonb := public.apih_cfg(); esc int := coalesce(nullif(cfg ->> 'decEscalaDias', '')::int, 7);
  r record; j jsonb; calc jsonb; want int; have int; k int; nesc int := 0; est jsonb := '[]'::jsonb;
  tips text[] := array['Completa a tiempo la primera fase del proyecto (o su primer hito, si no usa fases).',
                       'Sostén el ritmo hasta la mitad del plan: todos los hitos de la primera mitad cerrados a tiempo.',
                       'Cierra el proyecto a tiempo, con todos los hitos completados, dentro del presupuesto y con resultado registrado (beneficio real o resultado alcanzado).'];
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null or public.apih_solo_lectura() then return jsonb_build_object('escaladas', 0, 'estrellas', '[]'::jsonb); end if;
  perform set_config('apih.interno', 'on', true);
  -- decisiones pendientes que superan el plazo de escalamiento: se marcan una vez (lo hace el administrador)
  if per.rol = 'admin' then
    for r in select id, substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' loop
      j := r.j;
      if j ->> 'estado' = 'Pendiente' and not public.apih_vacio(j, 'limite') and (hoy - public.apih_fecha(j, 'limite')) > esc and public.apih_vacio(j, 'escalada') then
        update public.registros set datos = 'p1.' || (j || jsonb_build_object('escalada', hoy::text))::text where lista = 'APIH_Decisiones' and id = r.id;
        perform public.apih_bitacora(j ->> 'ini', 'Decisión', 'Decisión escalada a Administra: ' || (hoy - public.apih_fecha(j, 'limite')) || ' d de atraso · ' || coalesce(j ->> 'titulo', ''));
        nesc := nesc + 1;
      end if; end loop;
  end if;
  -- estrellas Michelin: se otorgan las nuevas en los proyectos que la persona puede editar; nunca se quitan
  if coalesce(cfg ->> 'cieloOn', 'true') <> 'false' then
    calc := public.apih_calculos() -> 'ini';
    for r in select id, area, substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{' loop
      j := r.j;
      continue when coalesce(j ->> 'estado', '') = 'Stand By' or coalesce(j ->> 'tipo', '') = 'Propuesta' or not public.apih_edita_area(r.area);
      want := public.apih_michelin_n(j, r.id, hoy, coalesce((calc -> r.id ->> 'desv')::int, 0));
      have := case when jsonb_typeof(j -> 'michelin') = 'array' then jsonb_array_length(j -> 'michelin') else 0 end;
      continue when want <= have;
      for k in have + 1 .. want loop j := j || jsonb_build_object('michelin', coalesce(case when jsonb_typeof(j -> 'michelin') = 'array' then j -> 'michelin' end, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('n', k, 'f', hoy::text))); end loop;
      update public.registros set datos = 'p1.' || j::text where lista = 'APIH_Proyectos' and id = r.id;
      perform public.apih_bitacora(r.id, 'Comentario', 'Estrella Michelin ' || want || ' de 3 obtenida: ' || tips[want]);
      est := est || jsonb_build_array(jsonb_build_object('id', r.id, 'titulo', j ->> 'titulo', 'n', want));
    end loop;
  end if;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('escaladas', nesc, 'estrellas', est);
end $$;
revoke all on function public.apih_mantener() from public, anon;
grant execute on function public.apih_mantener() to authenticated;

-- ===== 20261028000700_hallazgos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 4b · Hallazgos (motor de reglas PMO / riesgos / roadmap) y puntaje de priorización en el servidor
--   Antes la SPA evaluaba cada regla (atraso, hito vencido, decisión vencida/escalada, riesgo crítico, dependencias, sobrecarga,
--   desfase de trimestre, propuestas estancadas, línea base SPI/CPI) y el puntaje de priorización. Ahora las evalúa la base:
--     · apih_calculos() entrega además 'hallazgos' (lista ordenada por severidad) y 'puntajes' (propuesta → puntaje)
--   La SPA solo filtra por el área elegida y por las reglas activadas, y dibuja.
-- =====================================================================================

create or replace function public.apih_fd(d date) returns text language sql immutable as
$$ select case when d is null then '—' else lpad(extract(day from d)::int::text, 2, '0') || ' ' ||
     (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int] || ' ' || right(extract(year from d)::int::text, 2) end $$;

create or replace function public.apih_pct(n numeric) returns text language sql immutable as $$ select round(coalesce(n, 0))::int::text || '%' $$;

create or replace function public.apih_hf(grupo text, regla text, sev int, ini text, inis jsonb, titulo text, detalle text, fx jsonb, rid text default null)
returns jsonb language sql immutable as
$$ select jsonb_strip_nulls(jsonb_build_object('grupo', grupo, 'regla', regla, 'sev', sev, 'ini', nullif(ini, ''), 'inis', coalesce(inis, '[]'::jsonb),
                                              'titulo', titulo, 'detalle', detalle, 'fx', fx, 'rid', rid)) $$;

-- Puntaje de priorización (0-100) de una propuesta evaluada: 0,30·valor + 0,25·estrategia + 0,15·ROI + 0,15·(esfuerzo inv.) + 0,10·capacidad + 0,05·(riesgo inv.)
create or replace function public.apih_puntaje(j jsonb, roi_ numeric, n_lider int, cap int) returns int language sql immutable as
$$ select case when jsonb_typeof(j -> 'score') <> 'object' then 0 else
     round(((j #>> '{score,valor}')::numeric * .30 + (j #>> '{score,estrategia}')::numeric * .25
            + (case when roi_ is null then 0 else greatest(0, least(1, roi_ / 200)) * 5 end) * .15
            + (6 - (j #>> '{score,esfuerzo}')::numeric) * .15
            + (case when coalesce(j ->> 'lider', '') = '' then 0 else greatest(0, least(1, 1 - n_lider::numeric / greatest(1, cap))) * 5 end) * .10
            + (6 - (j #>> '{score,riesgo}')::numeric) * .05) / 5 * 100)::int end $$;

drop function if exists public.apih_calculos_base();   -- repetible: apih_calculos() vuelve a ser la versión completa justo antes
alter function public.apih_calculos() rename to apih_calculos_base;
revoke all on function public.apih_calculos_base() from public, anon, authenticated;

-- Devuelve {hallazgos: [...], puntajes: {id: n}} a partir de lo que ya calculó apih_calculos_base()
create or replace function public.apih_hallazgos(c jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg();
  cap int := greatest(1, coalesce(nullif(cfg ->> 'capacidadMax', '')::numeric, 5)::int); esc int := coalesce(nullif(cfg ->> 'decEscalaDias', '')::int, 7);
  M jsonb := '{}'::jsonb;            -- id -> iniciativa (con _prop)
  ids text[] := '{}'; r record; j jsonb; k text; x jsonb; ci jsonb;
  out jsonb := '[]'::jsonb; pun jsonb := '{}'::jsonb;
  vivo boolean; es_prop boolean; hecho boolean; sb boolean;
  carga jsonb := '{}'::jsonb;        -- líder -> [ids de proyectos vivos en fases activas]
  nl int; tol numeric; thr numeric; d int; sug text; fc date; fp date; b jsonb; pv numeric; ev numeric; ac numeric; spi numeric; cpi numeric; dfin int;
  hv jsonb; nhv int; mx int; du int; why text[]; rc int; e numeric; dep text; dj jsonb; ii text;
  amb numeric; roj numeric; dias int; falta text[]; pq int; fq int; py int; fy int; fe date; cnt int;
  cand record; semm jsonb := '{}'::jsonb; camm jsonb := '{}'::jsonb; per public.perfiles; evmm jsonb := '{}'::jsonb; em jsonb; mov int; nue int; bh jsonb;
begin
  -- iniciativas visibles para quien llama
  for r in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j || jsonb_build_object('_prop', (r.j ->> 'tipo' = 'Propuesta' or r.lista = 'APIH_Propuestas'));
    M := M || jsonb_build_object(r.id, j); ids := ids || r.id;
  end loop;
  -- vivo = no finalizada y no en Stand By
  -- carga por líder (proyectos vivos en fases activas)
  foreach k in array ids loop
    j := M -> k;
    if not (j ->> '_prop')::boolean and j ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and coalesce(j ->> 'lider', '') <> '' then
      carga := jsonb_set(carga, array[j ->> 'lider'], coalesce(carga -> (j ->> 'lider'), '[]'::jsonb) || to_jsonb(k), true); end if;
  end loop;

  -- puntaje de las propuestas evaluadas
  foreach k in array ids loop
    j := M -> k;
    if (j ->> '_prop')::boolean and jsonb_typeof(j -> 'score') = 'object' then
      select count(*) into nl from jsonb_each(M) q where not (q.value ->> '_prop')::boolean and q.value ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and coalesce(q.value ->> 'lider', '') <> '' and q.value ->> 'lider' = j ->> 'lider';
      pun := pun || jsonb_build_object(k, public.apih_puntaje(j, nullif(c -> 'ini' -> k ->> 'roi', '')::numeric, nl, cap));
    end if;
  end loop;

  -- valor ganado contra la línea base congelada (SPI, CPI, desvío del fin y cambios de hitos)
  foreach k in array ids loop
    j := M -> k; b := j -> 'base'; ci := c -> 'ini' -> k;
    continue when (j ->> '_prop')::boolean or ci is null or jsonb_typeof(b) <> 'object' or not (public.apih_num(b, 'pres') > 0) or public.apih_vacio(b, 'inicio') or public.apih_vacio(b, 'fin');
    pv := public.apih_num(b, 'pres') * greatest(0, least(1, (hoy - public.apih_fecha(b, 'inicio'))::numeric / greatest(1, public.apih_fecha(b, 'fin') - public.apih_fecha(b, 'inicio'))));
    ev := public.apih_num(b, 'pres') * coalesce((ci ->> 'avance')::numeric, 0) / 100; ac := public.apih_num(j, 'gastado');
    bh := case when jsonb_typeof(b -> 'hitos') = 'array' then b -> 'hitos' else '[]'::jsonb end;
    select count(*) filter (where o is not null and public.apih_fecha(h, 'fecha') > public.apih_fecha(o, 'fecha')), count(*) filter (where o is null) into mov, nue
      from (select h, (select ob from jsonb_array_elements(bh) ob where ob ->> 'id' = h ->> 'id' limit 1) o
              from (select substr(datos, 4)::jsonb h from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where h ->> 'ini' = k) t;
    evmm := evmm || jsonb_build_object(k, jsonb_build_object('pv', pv, 'ev', ev, 'ac', ac, 'spi', case when pv > 0 then ev / pv end, 'cpi', case when ac > 0 then ev / ac end,
        'dfin', nullif(ci ->> 'forecast', '')::date - public.apih_fecha(b, 'fin'), 'movidos', mov, 'nuevos', nue));
  end loop;

  -- ===== Reglas PMO =====
  foreach k in array ids loop
    j := M -> k; es_prop := (j ->> '_prop')::boolean; continue when es_prop;
    hecho := j ->> 'estado' in ('Completado', 'Cancelado'); sb := j ->> 'estado' = 'Stand By'; continue when sb;
    ci := c -> 'ini' -> k; continue when ci is null;
    if not hecho and j ->> 'estado' = 'En curso' and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) then
      d := coalesce((ci ->> 'desv')::int, 0); tol := public.apih_umbral(j, 'tolDesv');
      if d > tol then
        sug := ci -> 'rag' ->> 'rag';
        out := out || public.apih_hf('PMO', 'Proyecto atrasado', case when d > 30 then 3 else 2 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' está atrasado (+' || d || ' d)',
          'Fin plan ' || public.apih_fd(public.apih_fecha(j, 'finPlan')) || ', proyectado ' || public.apih_fd(nullif(ci ->> 'forecast', '')::date) || '. Avance ' || public.apih_pct((ci ->> 'avance')::numeric) || ' vs ' || public.apih_pct((ci ->> 'esperado')::numeric) || ' esperado.',
          case when j ->> 'rag' is distinct from sug then jsonb_build_array(jsonb_build_object('t', 'Marcar RAG ' || sug, 'a', 'fxrag', 'id', k, 'rag', sug))
               else jsonb_build_array(jsonb_build_object('t', 'Crear acción de recuperación', 'a', 'fxacc', 'id', k)) end);
      end if;
      em := evmm -> k;
      if em is not null then
        spi := nullif(em ->> 'spi', '')::numeric; cpi := nullif(em ->> 'cpi', '')::numeric; dfin := (em ->> 'dfin')::int;
        if (spi is not null and spi < .85) or (cpi is not null and cpi < .85) then
          out := out || public.apih_hf('PMO', 'Desempeño vs línea base', case when (spi is not null and spi < .7) or (cpi is not null and cpi < .7) then 3 else 2 end, k, jsonb_build_array(k),
            (j ->> 'titulo') || ': desempeño bajo la línea base',
            'SPI ' || coalesce(to_char(spi, 'FM990.00'), '—') || ' · CPI ' || coalesce(to_char(cpi, 'FM990.00'), '—') || ' · ' || case when dfin > 0 then '+' || dfin || ' d' else 'sin atraso' end || ' vs fin base.',
            jsonb_build_array(jsonb_build_object('t', 'Abrir proyecto', 'a', 'fxsel', 'id', k)));
        end if;
      end if;
      du := coalesce((ci ->> 'dsu')::int, 999); thr := public.apih_umbral(j, 'diasSinUpdate');
      if du > thr then
        out := out || public.apih_hf('PMO', 'Sin actualización', case when du > thr * 2 then 2 else 1 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' sin actualización hace ' || du || ' d',
          'Última actualización: ' || public.apih_fd(public.apih_fecha(j, 'actualizada')) || '. Responsable: ' || coalesce(j ->> 'lider', '') || '. Umbral: ' || thr::int || ' d.',
          jsonb_build_array(jsonb_build_object('t', 'Solicitar actualización', 'a', 'fxnudge', 'id', k)));
      end if;
    end if;
    if j ->> 'estado' = 'Pausado' and not public.apih_vacio(j, 'estadoRev') and public.apih_fecha(j, 'estadoRev') < hoy then
      out := out || public.apih_hf('PMO', 'Proyecto atrasado', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': revisión de “Pausado” vencida (' || public.apih_fd(public.apih_fecha(j, 'estadoRev')) || ')',
        'Motivo: ' || coalesce(nullif(j ->> 'estadoMotivo', ''), '—') || '. Decidir si se reanuda o se cancela.', jsonb_build_array(jsonb_build_object('t', 'Abrir proyecto', 'a', 'fxsel', 'id', k)));
    end if;
    if not hecho and j ->> 'estado' = 'En curso' then
      select coalesce(jsonb_agg(h order by h ->> 'fecha', h ->> 'id'), '[]'::jsonb) into hv
        from (select substr(datos, 4)::jsonb h from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q
       where h ->> 'ini' = k and h ->> 'completado' is distinct from 'true' and public.apih_fecha(h, 'fecha') < hoy;
      nhv := jsonb_array_length(hv);
      if nhv > 0 then
        mx := hoy - public.apih_fecha(hv -> 0, 'fecha');
        out := out || public.apih_hf('PMO', 'Hito vencido', case when mx > 30 or nhv > 2 then 3 else 2 end, k, jsonb_build_array(k),
          nhv || ' hito(s) vencido(s) en ' || (j ->> 'titulo'),
          (select string_agg('“' || (h ->> 'nombre') || '” (' || public.apih_fd(public.apih_fecha(h, 'fecha')) || ', hace ' || (hoy - public.apih_fecha(h, 'fecha')) || ' d)', '; ') from (select h from jsonb_array_elements(hv) h limit 3) t3) || case when nhv > 3 then '…' else '' end,
          jsonb_build_array(jsonb_build_object('t', 'Replanificar primer hito', 'a', 'fxhito', 'id', hv -> 0 ->> 'id'), jsonb_build_object('t', 'Marcar completado', 'a', 'fxdone', 'id', hv -> 0 ->> 'id')));
      end if;
    end if;
  end loop;
  -- decisiones vencidas y escaladas
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' is distinct from 'Pendiente' or public.apih_vacio(j, 'limite');
    continue when coalesce(j ->> 'ini', '') <> '' and not (M ? (j ->> 'ini'));
    d := hoy - public.apih_fecha(j, 'limite');
    if d > 0 then
      out := out || public.apih_hf('PMO', 'Decisión vencida', 2, j ->> 'ini', case when coalesce(j ->> 'ini', '') <> '' then jsonb_build_array(j ->> 'ini') else '[]'::jsonb end,
        'Decisión vencida hace ' || d || ' d: ' || coalesce(j ->> 'titulo', ''), coalesce(j ->> 'tipo', '') || ' · solicitada por ' || coalesce(j ->> 'solicita', '') || '. Debe resolverse en comité.',
        jsonb_build_array(jsonb_build_object('t', 'Resolver ahora', 'a', 'resolvedec', 'id', r.id)));
    end if;
  end loop;
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' is distinct from 'Pendiente' or public.apih_vacio(j, 'limite');
    continue when coalesce(j ->> 'ini', '') <> '' and not (M ? (j ->> 'ini'));
    d := hoy - public.apih_fecha(j, 'limite');
    if d > esc then
      out := out || public.apih_hf('PMO', 'Decisión escalada', 3, j ->> 'ini', case when coalesce(j ->> 'ini', '') <> '' then jsonb_build_array(j ->> 'ini') else '[]'::jsonb end,
        'Decisión escalada (' || d || ' d de atraso): ' || coalesce(j ->> 'titulo', ''), 'Superó el plazo de escalamiento (' || esc || ' d). Requiere resolución del rol Administra.',
        jsonb_build_array(jsonb_build_object('t', 'Resolver ahora', 'a', 'resolvedec', 'id', r.id)));
    end if;
  end loop;

  -- ===== Reglas de riesgos =====
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' = 'Cerrado';
    if M ? (j ->> 'ini') then
      x := M -> (j ->> 'ini'); continue when x ->> 'estado' in ('Completado', 'Cancelado', 'Aprobada', 'Rechazada', 'Retirada', 'Stand By'); end if;
    e := coalesce((c -> 'riesgos' -> r.id ->> 'expo')::numeric, 0); ii := j ->> 'ini';
    if coalesce((c -> 'riesgos' -> r.id ->> 'critico')::boolean, false) then
      out := out || public.apih_hf('Riesgos', 'Impacto alto + Probabilidad alta', 3, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Riesgo crítico (' || e::int || '): ' || coalesce(j ->> 'desc', ''), 'Impacto ' || (j ->> 'imp') || '/5 · Probabilidad ' || (j ->> 'prob') || '/5 · ' || coalesce(j ->> 'estado', '') || '. Dueño: ' || coalesce(nullif(j ->> 'dueno', ''), 'sin dueño') || '.',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    elsif public.apih_num(j, 'imp') >= 4 then
      out := out || public.apih_hf('Riesgos', 'Impacto alto', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Impacto alto: ' || coalesce(j ->> 'desc', ''), 'Impacto ' || (j ->> 'imp') || '/5 con probabilidad ' || (j ->> 'prob') || '/5 (exposición ' || e::int || ').',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    elsif public.apih_num(j, 'prob') >= 4 then
      out := out || public.apih_hf('Riesgos', 'Probabilidad alta', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Probabilidad alta: ' || coalesce(j ->> 'desc', ''), 'Probabilidad ' || (j ->> 'prob') || '/5 con impacto ' || (j ->> 'imp') || '/5 (exposición ' || e::int || ').',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    end if;
    if e >= 10 and public.apih_vacio(j, 'mit') then
      out := out || public.apih_hf('Riesgos', 'Sin plan de mitigación', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Sin mitigación definida: ' || coalesce(j ->> 'desc', ''), 'Exposición ' || e::int || '. Define plan y dueño.',
        jsonb_build_array(jsonb_build_object('t', 'Definir mitigación', 'a', 'fxrisk', 'id', r.id)), r.id);
    end if;
  end loop;
  -- dependencias críticas
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By') or jsonb_typeof(j -> 'deps') <> 'array';
    for dep in select jsonb_array_elements_text(j -> 'deps') loop
      continue when not (M ? dep); dj := M -> dep;
      continue when dj ->> 'estado' in (case when (dj ->> '_prop')::boolean then 'Aprobada' else 'Completado' end, case when (dj ->> '_prop')::boolean then 'Rechazada' else 'Cancelado' end, 'Retirada', 'Stand By');
      why := '{}';
      if dj ->> 'rag' = 'Rojo' then why := array_append(why, ('RAG Rojo')::text); end if;
      if coalesce((c -> 'ini' -> dep ->> 'atrasado')::boolean, false) then why := array_append(why, (('atrasada +' || coalesce(c -> 'ini' -> dep ->> 'desv', '0') || ' d'))::text); end if;
      select count(*) into rc from public.registros_v q where q.lista = 'APIH_Riesgos' and left(substr(q.datos, 4), 1) = '{' and substr(q.datos, 4)::jsonb ->> 'ini' = dep and coalesce((c -> 'riesgos' -> q.id ->> 'critico')::boolean, false);
      if rc > 0 then why := array_append(why, ((rc || ' riesgo(s) crítico(s)'))::text); end if;
      if coalesce(array_length(why, 1), 0) > 0 then
        out := out || public.apih_hf('Riesgos', 'Dependencias críticas', case when array_length(why, 1) > 1 then 3 else 2 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' depende de ' || (dj ->> 'titulo') || ' (' || array_to_string(why, ', ') || ')',
          'Fin proyectado de la predecesora: ' || public.apih_fd(nullif(c -> 'ini' -> dep ->> 'forecast', '')::date) || '. Un retraso se propaga a ' || (j ->> 'titulo') || '.',
          jsonb_build_array(jsonb_build_object('t', 'Registrar riesgo de dependencia', 'a', 'fxdeprisk', 'id', k, 'dep', dep)));
      end if;
    end loop;
  end loop;

  -- ===== Reglas de roadmap =====
  for r in select key l, value a from jsonb_each(carga) order by key loop
    if jsonb_array_length(r.a) > cap then
      out := out || public.apih_hf('Roadmap', 'Sobrecarga de líder', 2, null, r.a, r.l || ' lidera ' || jsonb_array_length(r.a) || ' proyectos activos (capacidad ' || cap || ')',
        (select string_agg(M -> t ->> 'titulo', ' · ') from jsonb_array_elements_text(r.a) t), jsonb_build_array(jsonb_build_object('t', 'Priorizar cierres', 'a', 'go', 'v', 'portfolio')));
    end if;
  end loop;
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By'); ci := c -> 'ini' -> k;
    if jsonb_typeof(j -> 'deps') = 'array' and not public.apih_vacio(j, 'inicioPlan') then
      for dep in select jsonb_array_elements_text(j -> 'deps') loop
        continue when not (M ? dep); dj := M -> dep;
        continue when dj ->> 'estado' in ('Completado', 'Cancelado', 'Aprobada', 'Rechazada', 'Retirada', 'Stand By');
        fe := nullif(c -> 'ini' -> dep ->> 'forecast', '')::date;
        if fe is not null and public.apih_fecha(j, 'inicioPlan') < fe and dj ->> 'fase' <> 'Cierre' and j ->> 'estado' = 'En curso' and (j ->> 'fase' = 'Planificación' or public.apih_fecha(j, 'inicioPlan') > hoy) then
          out := out || public.apih_hf('Roadmap', 'Secuencia de dependencias', 2, k, jsonb_build_array(k),
            (j ->> 'titulo') || ' inicia (' || public.apih_fd(public.apih_fecha(j, 'inicioPlan')) || ') antes de que termine ' || (dj ->> 'titulo') || ' (' || public.apih_fd(fe) || ')',
            'Conflicto de secuencia en el roadmap. Ajusta fechas o rompe la dependencia.', jsonb_build_array(jsonb_build_object('t', 'Editar fechas', 'a', 'edit', 't2', 'ini', 'id', k)));
        end if;
      end loop;
    end if;
    if (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and not public.apih_vacio(j, 'finPlan') and ci is not null then
      fp := public.apih_fecha(j, 'finPlan'); fc := nullif(ci ->> 'forecast', '')::date;
      if fc is not null then
        pq := extract(quarter from fp)::int; fq := extract(quarter from fc)::int; py := extract(year from fp)::int; fy := extract(year from fc)::int;
        if fy * 4 + fq > py * 4 + pq then
          out := out || public.apih_hf('Roadmap', 'Desfase de trimestre', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ' se desplaza de Q' || pq || ' ' || py || ' a Q' || fq || ' ' || fy,
            'Fin plan ' || public.apih_fd(fp) || ' → proyectado ' || public.apih_fd(fc) || '. Comunica el cambio al comité.',
            jsonb_build_array(jsonb_build_object('t', 'Crear decisión', 'a', 'mkdec', 'id', k, 'tp', 'Mantener', 'ti', 'Reprogramar ' || (j ->> 'titulo') || ' a Q' || fq || ' ' || fy, 'rec', 'Pronóstico ' || public.apih_fd(fc) || ' vs línea base ' || public.apih_fd(fp) || '.')));
        end if;
      end if;
    end if;
  end loop;
  -- propuestas: candidatas a iniciar (las 3 de mayor puntaje)
  for cand in select p.k, p.j, coalesce((pun ->> p.k)::int, 0) pt from (select i k, M -> i j from unnest(ids) i) p
               where (p.j ->> '_prop')::boolean and p.j ->> 'estado' = 'Vigente' and (p.j ->> 'fase' = 'Aprobación' or (p.j ->> 'fase' = 'Evaluación' and coalesce((pun ->> p.k)::int, 0) >= 70))
               order by coalesce((pun ->> p.k)::int, 0) desc, p.k limit 3 loop
    nl := jsonb_array_length(coalesce(carga -> (cand.j ->> 'lider'), '[]'::jsonb));
    out := out || public.apih_hf('Roadmap', 'Candidatos a iniciar', 1, cand.k, jsonb_build_array(cand.k), 'Propuesta candidata a iniciar: ' || (cand.j ->> 'titulo') || ' (puntaje ' || cand.pt || ')',
      case when nl < cap then (cand.j ->> 'lider') || ' tiene capacidad disponible (' || nl || '/' || cap || ').' else (cand.j ->> 'lider') || ' está al límite de capacidad: considera reasignar.' end,
      jsonb_build_array(jsonb_build_object('t', 'Proponer “Iniciar”', 'a', 'mkdec', 'id', cand.k, 'tp', 'Iniciar', 'ti', 'Iniciar ' || (cand.j ->> 'titulo'),
        'rec', 'Puntaje de priorización ' || cand.pt || '; ' || case when nl < cap then 'hay capacidad' else 'revisar capacidad' end || '.')));
  end loop;
  foreach k in array ids loop
    j := M -> k; continue when not (j ->> '_prop')::boolean or j ->> 'estado' in ('Aprobada', 'Rechazada', 'Retirada', 'Stand By');
    dias := hoy - coalesce(public.apih_fecha(j, 'faseDesde'), public.apih_fecha(j, 'actualizada'), public.apih_fecha(j, 'creada'), hoy);
    amb := coalesce(nullif(public.apih_umbral(j, 'propDiasAmb'), 0), 30); roj := coalesce(nullif(public.apih_umbral(j, 'propDiasRojo'), 0), 60);
    x := jsonb_build_array(jsonb_build_object('t', 'Abrir propuesta', 'a', 'fxsel', 'id', k));
    semm := semm || jsonb_build_object(k, jsonb_build_object('dias', dias, 'nivel', case when dias > roj then 'rojo' when dias > amb then 'amb' else 'ok' end));
    if j ->> 'estado' = 'Vigente' and dias > amb then
      out := out || public.apih_hf('Roadmap', 'Propuesta estancada', case when dias > roj then 2 else 1 end, k, jsonb_build_array(k), (j ->> 'titulo') || ' lleva ' || dias || ' d en la fase ' || (j ->> 'fase'),
        'Umbral ' || amb::int || ' d (rojo ' || roj::int || ' d). Responsable: ' || coalesce(j ->> 'lider', '') || '. Avanzar, poner en espera o retirar.', x);
    end if;
    if j ->> 'estado' = 'En espera' and not public.apih_vacio(j, 'estadoRev') and public.apih_fecha(j, 'estadoRev') < hoy then
      out := out || public.apih_hf('Roadmap', 'Propuesta estancada', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': revisión de “En espera” vencida (' || public.apih_fd(public.apih_fecha(j, 'estadoRev')) || ')',
        'Motivo: ' || coalesce(nullif(j ->> 'estadoMotivo', ''), '—') || '. Decidir si se retoma, se rechaza o se retira.', x);
    end if;
    falta := '{}';
    if public.apih_vacio(j, 'sponsor') then falta := array_append(falta, ('sponsor')::text); end if;
    if j ->> 'fase' in ('Caso de Negocio', 'Aprobación') then
      if public.apih_vacio(j, 'bc') then falta := array_append(falta, ('business case')::text); end if;
      if not (public.apih_num(j, 'presupuesto') > 0) then falta := array_append(falta, ('costo estimado')::text); end if;
      if not (public.apih_num(j, 'beneficio') > 0) then falta := array_append(falta, ('beneficio estimado')::text); end if;
    end if;
    if coalesce(array_length(falta, 1), 0) > 0 and j ->> 'estado' = 'Vigente' then
      out := out || public.apih_hf('Roadmap', 'Propuesta incompleta', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': falta ' || array_to_string(falta, ', '),
        'Completa los datos para poder avanzar a la siguiente fase.', x);
    end if;
  end loop;
  -- proyectos de prioridad baja en Planificación con líder sobrecargado
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By');
    if j ->> 'prioridad' = 'Baja' and j ->> 'fase' = 'Planificación' and jsonb_array_length(coalesce(carga -> (j ->> 'lider'), '[]'::jsonb)) > cap then
      out := out || public.apih_hf('Roadmap', 'Sobrecarga de líder', 1, k, jsonb_build_array(k), 'Considera pausar ' || (j ->> 'titulo') || ' (prioridad baja, líder sobrecargado)',
        'Libera capacidad para proyectos de mayor prioridad.', jsonb_build_array(jsonb_build_object('t', 'Proponer “Pausar”', 'a', 'mkdec', 'id', k, 'tp', 'Pausar', 'ti', 'Pausar ' || (j ->> 'titulo'), 'rec', 'Prioridad baja y líder sobre su capacidad.')));
    end if;
  end loop;

  -- cambios que quien llama puede resolver (sponsor de la iniciativa, Responsable o Administra, con permiso sobre su área); no el que los solicitó salvo Administra
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is not null then
    for r in select q.id, substr(q.datos, 4)::jsonb j, (select i.area from public.registros_v i where i.id = substr(q.datos, 4)::jsonb ->> 'ini' and i.lista in ('APIH_Proyectos', 'APIH_Propuestas') limit 1) area
               from public.registros_v q where q.lista = 'APIH_Cambios' and left(substr(q.datos, 4), 1) = '{' loop
      continue when r.j ->> 'estado' is distinct from 'Solicitado';
      j := coalesce(M -> (r.j ->> 'ini'), '{}'::jsonb);
      camm := camm || jsonb_build_object(r.id, not public.apih_solo_lectura() and public.apih_edita_area(r.area)
        and (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or (nullif(j ->> 'sponsor', '') is not null and (j ->> 'sponsor') in (coalesce(per.nombre, ''), per.email)))
        and (per.rol = 'admin' or coalesce(r.j ->> 'solicita', '') is distinct from coalesce(nullif(per.nombre, ''), per.email)));
    end loop;
  end if;

  -- uid por orden de generación y orden por severidad (estable)
  select coalesce(jsonb_agg(f || jsonb_build_object('uid', 'F' || (o - 1)) order by -(f ->> 'sev')::int, o), '[]'::jsonb) into out from jsonb_array_elements(out) with ordinality t(f, o);
  return jsonb_build_object('hallazgos', out, 'puntajes', pun, 'evm', evmm, 'sem', semm, 'cambios', camm);
end $$;
revoke all on function public.apih_hallazgos(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios'); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028000800_cielo.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 4c · «Mi cocina» (tenedores, racha, nivel, insignias y cielo colectivo) en el servidor
--   Antes la SPA evaluaba los 5 tenedores de cada proyecto por semana, la racha de 26 semanas, el nivel, las insignias y el
--   cielo colectivo. Ahora los evalúa la base (una sola regla) y la SPA solo muestra:
--     · apih_cielo() → { W, impecables, proy: {id → {st, lleno, tope, act}}, hist: {id → [[on,off] × 8 semanas]}, personas: {líder → {racha,total,nivel,sig}},
--                        yo: {nombre, meta, pct, insignias: {clave → {v, of, ok}}} }
-- =====================================================================================

-- ¿Qué hizo el proyecto en la semana W? 'real' | 'nc' (sin novedades) | null
create or replace function public.apih_cielo_act(ctx jsonb, j jsonb, p_id text, w date) returns text language plpgsql immutable as
$$ declare e date := w + 6; real_ boolean := false; nc boolean := false; b jsonb; d date; act date := nullif(left(coalesce(j ->> 'actualizada', ''), 10), '')::date;
begin
  for b in select jsonb_array_elements(coalesce(ctx -> 'bit' -> p_id, '[]'::jsonb)) loop
    d := (b ->> 0)::date; continue when d < w or d > e;
    if (b ->> 1) = 'nc' then nc := true; else real_ := true; end if; end loop;
  if not real_ and not nc and act is not null and act >= w and act <= e then real_ := true; end if;
  return case when real_ then 'real' when nc then 'nc' end;
end $$;

-- avance del proyecto a la fecha d, según su historial [[fecha, valor], ...]
create or replace function public.apih_cielo_avance_en(j jsonb, d date) returns numeric language plpgsql immutable as
$$ declare v numeric := 0; h jsonb;
begin
  if jsonb_typeof(j -> 'hist') = 'array' then
    for h in select jsonb_array_elements(j -> 'hist') loop
      if jsonb_typeof(h) = 'array' and left(h ->> 0, 10) <= d::text then v := coalesce(nullif(h ->> 1, '')::numeric, 0); end if; end loop; end if;
  return v;
end $$;

create or replace function public.apih_cielo_avanzo(ctx jsonb, j jsonb, p_id text, w date) returns boolean language plpgsql immutable as
$$ declare e date := w + 6; h jsonb;
begin
  if public.apih_cielo_avance_en(j, e) > public.apih_cielo_avance_en(j, w - 1) then return true; end if;
  for h in select jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) loop
    if h ->> 'completado' = 'true' and not public.apih_vacio(h, 'fechaReal') and (h ->> 'fechaReal') >= w::text and (h ->> 'fechaReal') <= e::text then return true; end if; end loop;
  return false;
end $$;

-- «Al día» no se gana si el proyecto lleva 3 semanas seguidas actualizándose sin avance real (ni % ni hitos cerrados)
create or replace function public.apih_cielo_sin_avance(ctx jsonb, j jsonb, p_id text, w date) returns boolean language plpgsql immutable as
$$ declare k int; ww date;
begin
  if public.apih_num(j, 'avance') >= 100 and not exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) h where h ->> 'completado' is distinct from 'true') then return false; end if;
  for k in 0 .. 2 loop ww := w - 7 * k;
    if public.apih_cielo_avanzo(ctx, j, p_id, ww) or public.apih_cielo_act(ctx, j, p_id, ww) is null then return false; end if; end loop;
  return true;
end $$;

-- Los 5 tenedores de un proyecto en la semana w: {dia, hit, cmp, rsk, gob, tope}  ('on' | 'off' | 'na')
create or replace function public.apih_cielo_estrellas(ctx jsonb, j jsonb, p_id text, w date, hoy date, ci jsonb) returns jsonb language plpgsql immutable as
$$
declare cur boolean := w = date_trunc('week', hoy)::date; e date := case when cur then hoy else w + 6 end; a text; dia boolean; tope boolean := false;
  hs jsonb := coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb); cs jsonb := coalesce(ctx -> 'cmp' -> p_id, '[]'::jsonb); cam jsonb := coalesce(ctx -> 'cam' -> p_id, '[]'::jsonb); rs jsonb := coalesce(ctx -> 'rsk' -> p_id, '[]'::jsonb);
  expl boolean; nh int; hv int; nc_ int; cv int; o jsonb := '{}'::jsonb; tol numeric; fuera boolean;
begin
  a := public.apih_cielo_act(ctx, j, p_id, w); dia := a = 'real';
  if a = 'nc' then dia := not (public.apih_cielo_act(ctx, j, p_id, w - 7) = 'nc' and public.apih_cielo_act(ctx, j, p_id, w - 14) = 'nc'); end if;
  if dia and public.apih_cielo_sin_avance(ctx, j, p_id, w) then dia := false; tope := true; end if;
  o := o || jsonb_build_object('dia', case when dia then 'on' else 'off' end);
  -- hitos: sin vencidos (o con un cambio de fecha registrado)
  select exists (select 1 from jsonb_array_elements(cam) c where c ->> 'estado' is distinct from 'Rechazado' and c ->> 'tipo' = 'Fecha' and coalesce(c ->> 'creada', '') <= e::text) into expl;
  nh := jsonb_array_length(hs);
  select count(*) into hv from jsonb_array_elements(hs) h where not public.apih_vacio(h, 'fecha') and (h ->> 'fecha') < e::text and not (h ->> 'completado' = 'true' and coalesce(h ->> 'fechaReal', '') <= e::text);
  o := o || jsonb_build_object('hit', case when nh = 0 then 'na' when hv = 0 or expl then 'on' else 'off' end);
  -- compromisos
  select count(*) into nc_ from jsonb_array_elements(cs) c where c ->> 'estado' is distinct from 'Cancelado' and coalesce(c ->> 'creada', '') <= (w + 6)::text;
  select count(*) into cv from jsonb_array_elements(cs) c where c ->> 'estado' is distinct from 'Cancelado' and coalesce(c ->> 'creada', '') <= (w + 6)::text
     and not public.apih_vacio(c, 'limite') and (c ->> 'limite') < e::text and not (c ->> 'estado' = 'Cumplido' and coalesce(c ->> 'fechaReal', '') <= e::text);
  o := o || jsonb_build_object('cmp', case when nc_ = 0 then 'na' when cv = 0 then 'on' else 'off' end);
  -- riesgos y gobierno: solo la semana en curso (no hay historial de revisiones)
  if cur then
    if jsonb_array_length(rs) = 0 then o := o || jsonb_build_object('rsk', 'na');
    else o := o || jsonb_build_object('rsk', case when exists (select 1 from jsonb_array_elements(rs) r where (not public.apih_vacio(r, 'fRev') and (r ->> 'fRev') < hoy::text) or (coalesce((r ->> '_crit')::boolean, false) and public.apih_vacio(r, 'mit'))) then 'off' else 'on' end); end if;
    tol := public.apih_umbral(j, 'tolDesv');
    fuera := ci ->> 'forecast' is not null and not public.apih_vacio(j, 'finPlan') and coalesce((ci ->> 'desv')::int, 0) > tol;
    o := o || jsonb_build_object('gob', case when fuera and not exists (select 1 from jsonb_array_elements(cam) c where c ->> 'estado' is distinct from 'Rechazado') then 'off' else 'on' end);
  else o := o || jsonb_build_object('rsk', 'na', 'gob', 'na'); end if;
  return o || jsonb_build_object('tope', tope);
end $$;

create or replace function public.apih_cielo_lleno(o jsonb) returns boolean language sql immutable as
$$ select not (o ->> 'dia' = 'off' or o ->> 'hit' = 'off' or o ->> 'cmp' = 'off' or o ->> 'rsk' = 'off' or o ->> 'gob' = 'off')
          and (o ->> 'dia' = 'on' or o ->> 'hit' = 'on' or o ->> 'cmp' = 'on' or o ->> 'rsk' = 'on' or o ->> 'gob' = 'on') $$;
-- criterio histórico (calculable hacia atrás): solo día, hitos y compromisos
create or replace function public.apih_cielo_hist_ok(o jsonb) returns boolean language sql immutable as
$$ select not (o ->> 'dia' = 'off' or o ->> 'hit' = 'off' or o ->> 'cmp' = 'off') $$;

-- Cierre impecable: completado al 100 %, todos los hitos hechos, sin riesgos abiertos y dentro del plazo (o con un cambio de fecha aprobado)
create or replace function public.apih_cielo_impecable(ctx jsonb, j jsonb, p_id text) returns boolean language sql immutable as
$$ select coalesce(j ->> 'tipo', '') <> 'Propuesta' and j ->> 'estado' = 'Completado' and public.apih_num(j, 'avance') >= 100
      and not exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) h where h ->> 'completado' is distinct from 'true')
      and jsonb_array_length(coalesce(ctx -> 'rsk' -> p_id, '[]'::jsonb)) = 0
      and (public.apih_vacio(j, 'finReal') or public.apih_vacio(j, 'finPlan') or (j ->> 'finReal') <= (j ->> 'finPlan')
           or exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'cam' -> p_id, '[]'::jsonb)) c where c ->> 'estado' = 'Aprobado' and c ->> 'tipo' = 'Fecha')) $$;

create or replace function public.apih_cielo() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); w0 date := date_trunc('week', public.apih_hoy())::date; cfg jsonb := public.apih_cfg();
  calc jsonb := public.apih_calculos_base(); ctx jsonb; r record; j jsonb; k text; ids text[] := '{}'; M jsonb := '{}'::jsonb;
  imp jsonb := '{}'::jsonb; proy jsonb := '{}'::jsonb; hist jsonb := '{}'::jsonb; st jsonb; sx jsonb := '{}'::jsonb;   -- sx: id -> [estado semana 0..26]
  wk int; w date; o jsonb; arr jsonb; per jsonb := '{}'::jsonb; lid text; lids text[];
  total int; racha int; run boolean; ok boolean; n int; nivel text; sig int; me text; mail text := public.apih_email(); meta numeric; on_ int; off_ int; pct int;
  ins jsonb := '{}'::jsonb; pas jsonb; cs int; aviso int; cump int; cierres int; sem int; ms1 int; ms3 int; nm int; ucfg jsonb;
begin
  if public.apih_rol() is null or coalesce(cfg ->> 'cieloOn', 'true') = 'false' then return jsonb_build_object('W', w0, 'proy', '{}'::jsonb, 'hist', '{}'::jsonb, 'personas', '{}'::jsonb, 'yo', null); end if;
  select coalesce(nullif(p.nombre, ''), p.email) into me from public.perfiles p where p.email = mail;
  -- contexto: lo que cada regla necesita, por iniciativa
  ctx := jsonb_build_object(
    'bit', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(jsonb_build_array(left(x ->> 'ts', 10), case when coalesce(x ->> 'texto', '') ~* 'sin novedades' then 'nc' else 'real' end)) a
                      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{') q where x ->> 'tipo' = 'Actualización' and coalesce(x ->> 'ini', '') <> '' group by 1) t), '{}'::jsonb),
    'hit', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'cmp', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'cam', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'rsk', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x || jsonb_build_object('_crit', coalesce((calc -> 'riesgos' -> (x ->> 'id') ->> 'critico')::boolean, false))) a
                      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{') q where x ->> 'estado' is distinct from 'Cerrado' group by 1) t), '{}'::jsonb));

  -- proyectos con tenedores esta semana: vivos, en fases activas y creados a la fecha
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; M := M || jsonb_build_object(r.id, j);
    if public.apih_cielo_impecable(ctx, j, r.id) then imp := imp || jsonb_build_object(r.id, true); end if;
    continue when coalesce(j ->> 'tipo', '') = 'Propuesta' or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By') or (j ->> 'fase') <> all (array['Planificación', 'Ejecución', 'Transición']);
    ids := ids || r.id;
    arr := '[]'::jsonb;
    for wk in 0 .. 26 loop
      w := w0 - 7 * wk;
      if coalesce(left(j ->> 'creada', 10), '0') > (w + 6)::text then arr := arr || jsonb_build_array(null); continue; end if;
      arr := arr || jsonb_build_array(public.apih_cielo_estrellas(ctx, j, r.id, w, hoy, calc -> 'ini' -> r.id));
    end loop;
    sx := sx || jsonb_build_object(r.id, arr);
    st := arr -> 0;
    if st <> 'null'::jsonb then
      proy := proy || jsonb_build_object(r.id, jsonb_build_object('st', st - 'tope', 'tope', (st ->> 'tope')::boolean, 'lleno', public.apih_cielo_lleno(st), 'act', public.apih_cielo_act(ctx, j, r.id, w0)));
    end if;
    -- serie de 8 semanas del cielo colectivo: [[encendidos, pendientes] del criterio histórico] de la más antigua a la actual
    arr := '[]'::jsonb;
    for wk in reverse 7 .. 0 loop
      o := sx -> r.id -> wk;
      arr := arr || jsonb_build_array(case when o = 'null'::jsonb then null
        else jsonb_build_array((select count(*) from unnest(array['dia', 'hit', 'cmp']) q where o ->> q = 'on'), (select count(*) from unnest(array['dia', 'hit', 'cmp']) q where o ->> q = 'off')) end);
    end loop;
    hist := hist || jsonb_build_object(r.id, arr);
  end loop;

  -- personas: racha de semanas seguidas con los tenedores del criterio histórico, total y nivel
  select array_agg(distinct M -> i ->> 'lider') into lids from unnest(ids) i where coalesce(M -> i ->> 'lider', '') <> '';
  foreach lid in array coalesce(lids, '{}') loop
    total := 0; racha := 0; run := true;
    for wk in 1 .. 26 loop
      select count(*), bool_and(public.apih_cielo_hist_ok(sx -> i -> wk)) into n, ok from unnest(ids) i where M -> i ->> 'lider' = lid and sx -> i -> wk <> 'null'::jsonb;
      ok := n > 0 and coalesce(ok, false);
      if ok then total := total + 1; end if;
      if run then if ok then racha := racha + 1; else run := false; end if; end if;
    end loop;
    if not exists (select 1 from unnest(ids) i where M -> i ->> 'lider' = lid and not public.apih_cielo_lleno(sx -> i -> 0)) then racha := racha + 1; total := total + 1; end if;
    nivel := case when total >= 12 then 'Chef ejecutivo' when total >= 4 then 'Chef de partida' when total >= 1 then 'Cocinero' else 'Pinche' end;
    sig := case when total >= 12 then 12 when total >= 4 then 12 when total >= 1 then 4 else 1 end;
    per := per || jsonb_build_object(lid, jsonb_build_object('racha', racha, 'total', total, 'nivel', nivel, 'sig', sig));
  end loop;

  -- quien llama: meta mensual, % de tenedores encendidos del portafolio e insignias
  select substr(datos, 4)::jsonb into ucfg from public.registros where lista = 'APIH_Config' and id = 'cfgU:' || mail and left(substr(datos, 4), 1) = '{';
  meta := coalesce(case when coalesce(cfg #>> '{fijos,cieloMeta}', '') in ('', '0', 'false') and jsonb_typeof(ucfg #> '{v,cfg,cieloMeta}') = 'number' then (ucfg #>> '{v,cfg,cieloMeta}')::numeric end,
                   nullif(public.apih_num(cfg, 'cieloMeta'), 0), 80);
  select coalesce(sum((select count(*) from unnest(array['dia','hit','cmp','rsk','gob']) q where v -> 'st' ->> q = 'on')), 0),
         coalesce(sum((select count(*) from unnest(array['dia','hit','cmp','rsk','gob']) q where v -> 'st' ->> q = 'off')), 0) into on_, off_ from jsonb_each(proy) t(k2, v);
  pct := case when on_ + off_ > 0 then round(on_::numeric / (on_ + off_) * 100)::int else 0 end;
  if me is not null then
    cs := 0;
    for wk in 0 .. 25 loop
      select count(*), bool_and(sx -> i -> wk ->> 'hit' is distinct from 'off') into n, ok from unnest(ids) i where M -> i ->> 'lider' = me and sx -> i -> wk <> 'null'::jsonb;
      if n = 0 then exit; end if; if ok then cs := cs + 1; else exit; end if;
    end loop;
    select count(*) into aviso from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'solicita' = me
       and not public.apih_vacio(substr(datos, 4)::jsonb, 'fAnt') and not public.apih_vacio(substr(datos, 4)::jsonb, 'creada') and substr(datos, 4)::jsonb ->> 'creada' <= substr(datos, 4)::jsonb ->> 'fAnt';
    select count(*) into cump from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'resp' = me and substr(datos, 4)::jsonb ->> 'estado' = 'Cumplido'
       and not public.apih_vacio(substr(datos, 4)::jsonb, 'fechaReal') and not public.apih_vacio(substr(datos, 4)::jsonb, 'limite') and substr(datos, 4)::jsonb ->> 'fechaReal' <= substr(datos, 4)::jsonb ->> 'limite';
    cierres := 0; ms1 := 0; ms3 := 0;
    for k in select key from jsonb_each(M) loop
      j := M -> k; continue when j ->> 'estado' = 'Stand By' or j ->> 'lider' is distinct from me;
      if public.apih_cielo_impecable(ctx, j, k) then cierres := cierres + 1; end if;
      nm := case when jsonb_typeof(j -> 'michelin') = 'array' then jsonb_array_length(j -> 'michelin') else 0 end;
      if nm >= 1 then ms1 := ms1 + 1; end if; if nm = 3 then ms3 := ms3 + 1; end if;
    end loop;
    select count(distinct date_trunc('week', (left(x ->> 'ts', 10))::date)) into sem
      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{') q
     where x ->> 'autor' = me and x ->> 'tipo' = 'Actualización' and coalesce(x ->> 'texto', '') ~ '^Actualización semanal';
    total := coalesce((per -> me ->> 'total')::int, 0); racha := coalesce((per -> me ->> 'racha')::int, 0);
    ins := jsonb_build_object(
      'p1', jsonb_build_object('v', least(total, 1), 'of', 1, 'ok', total >= 1), 'r4', jsonb_build_object('v', least(racha, 4), 'of', 4, 'ok', racha >= 4),
      'cs', jsonb_build_object('v', least(cs, 4), 'of', 4, 'ok', cs >= 4), 'av', jsonb_build_object('v', least(aviso, 1), 'of', 1, 'ok', aviso >= 1),
      'cu', jsonb_build_object('v', least(cump, 10), 'of', 10, 'ok', cump >= 10), 'ci', jsonb_build_object('v', least(cierres, 1), 'of', 1, 'ok', cierres >= 1),
      'bv', jsonb_build_object('v', least(sem, 8), 'of', 8, 'ok', sem >= 8), 'm1', jsonb_build_object('v', least(ms1, 1), 'of', 1, 'ok', ms1 >= 1),
      'm3', jsonb_build_object('v', least(ms3, 1), 'of', 1, 'ok', ms3 >= 1), 'eq', jsonb_build_object('v', case when pct >= meta then 1 else 0 end, 'of', 1, 'ok', pct >= meta));
  end if;
  pas := public.apih_pasos(calc, ctx, M, proy, hoy);   -- «Siguientes pasos» (migración 5i)
  return jsonb_build_object('W', w0, 'proy', proy, 'hist', hist, 'personas', per, 'impecables', imp, 'pasos', pas, 'yo', jsonb_build_object('nombre', me, 'meta', meta, 'pct', pct, 'insignias', ins));
end $$;
revoke all on function public.apih_cielo() from public, anon;
grant execute on function public.apih_cielo() to authenticated;

-- ===== 20261028000900_capacidad.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 4d · Capacidad de equipos en el servidor
--   Carga mensual por líder = proyectos vivos que lidera y cuyo plan (inicio → el mayor entre fin plan y fin proyectado) toca ese mes.
--   Capacidad = cfg.capPers[persona] o, si no hay, cfg.capacidadMax (5 por defecto). Color de la celda: n (sin carga), g (< 80 %), y (80–100 %), r (> 100 %).
--   apih_calculos() entrega además 'capacidad': { meses: [{s,e}×12], gente: [{n, cap, ns, cls, ps:[{id,s,e}], prom3, hold, over:{"3","6","12"}}] }
--   La SPA solo filtra por persona/área y suma.
-- =====================================================================================
create or replace function public.apih_capacidad(c jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg(); capmax int := greatest(1, coalesce(nullif(cfg ->> 'capacidadMax', '')::numeric, 5)::int);
  meses jsonb := '[]'::jsonb; m0 date := date_trunc('month', public.apih_hoy())::date; k int; r record; j jsonb; lid text; ps jsonb; gente jsonb := '[]'::jsonb;
  capp jsonb := case when jsonb_typeof(cfg -> 'capPers') = 'object' then cfg -> 'capPers' else '{}'::jsonb end; cap int; ns int[]; cls text[]; n int; s date; e date; fc date; p jsonb;
  prom3 numeric; ms date[]; me_ date[]; ov3 boolean; ov6 boolean; ov12 boolean; v numeric;
begin
  for k in 0 .. 11 loop meses := meses || jsonb_build_array(jsonb_build_object('s', (m0 + (k || ' month')::interval)::date, 'e', ((m0 + ((k + 1) || ' month')::interval)::date - 1))); end loop;
  for r in select q.jj ->> 'lider' lider, jsonb_agg(jsonb_build_object('id', q.id, 'j', q.jj) order by q.id) arr
             from (select id, substr(datos, 4)::jsonb jj from public.registros_v where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{') q
            where q.jj ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and coalesce(q.jj ->> 'tipo', '') <> 'Propuesta' and coalesce(q.jj ->> 'lider', '') <> '' group by 1 order by 1 loop
    lid := r.lider; ps := '[]'::jsonb;
    for p in select jsonb_array_elements(r.arr) loop
      j := p -> 'j'; fc := nullif(c -> 'ini' -> (p ->> 'id') ->> 'forecast', '')::date;
      s := coalesce(public.apih_fecha(j, 'inicioPlan'), public.apih_fecha(j, 'inicioReal'), public.apih_fecha(j, 'creada'), hoy);
      e := greatest(public.apih_fecha(j, 'finPlan'), fc);
      ps := ps || jsonb_build_array(jsonb_build_object('id', p ->> 'id', 's', s, 'e', e));
    end loop;
    cap := coalesce(nullif((select value::text::numeric from jsonb_each(capp) where public.apih_norm(key) = public.apih_norm(lid) limit 1), 0)::int, capmax);
    ns := '{}'; cls := '{}';
    for k in 0 .. 11 loop
      s := (meses -> k ->> 's')::date; e := (meses -> k ->> 'e')::date;
      select count(*) into n from jsonb_array_elements(ps) pq where (pq ->> 's')::date <= e and (pq ->> 'e' is null or (pq ->> 'e')::date >= s);
      ns := ns || n; cls := cls || (case when n = 0 then 'n' when n > cap then 'r' when n >= cap * .8 then 'y' else 'g' end);
    end loop;
    prom3 := (ns[1] + ns[2] + ns[3])::numeric / 3;
    gente := gente || jsonb_build_array(jsonb_build_object('n', lid, 'cap', cap, 'ns', to_jsonb(ns), 'cls', to_jsonb(cls), 'ps', ps, 'prom3', prom3, 'hold', greatest(0, cap - prom3),
      'over', jsonb_build_object('3', (select bool_or(x > cap) from unnest(ns[1:3]) x), '6', (select bool_or(x > cap) from unnest(ns[1:6]) x), '12', (select bool_or(x > cap) from unnest(ns[1:12]) x))));
  end loop;
  return jsonb_build_object('meses', meses, 'gente', gente);
end $$;
revoke all on function public.apih_capacidad(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028001000_auditoria_campos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 4e · Auditoría del servidor con el detalle de qué campos cambiaron
--   La tabla auditoria ya registraba quién escribió qué registro y cuándo (lo hace el servidor, no la SPA). Ahora deja además los
--   nombres de los campos que cambiaron en cada actualización (sin los valores, para no copiar montos a la auditoría).
-- =====================================================================================
alter table public.auditoria add column if not exists campos text[];

create or replace function public.apih_aud_campos() returns trigger language plpgsql security definer set search_path = public as
$$ declare jo jsonb; jn jsonb; ks text[];
begin
  begin jo := substr(old.datos, 4)::jsonb; jn := substr(new.datos, 4)::jsonb; exception when others then return null; end;
  if jsonb_typeof(jo) <> 'object' or jsonb_typeof(jn) <> 'object' then return null; end if;
  select coalesce(array_agg(k order by k), '{}') into ks from (
    select key k from jsonb_each(jn) n left join lateral (select value v from jsonb_each(jo) o where o.key = n.key) o on true where o.v is distinct from n.value
    union select key from jsonb_each(jo) o where not jn ? o.key) q;
  update public.auditoria set campos = ks where n = (select max(n) from public.auditoria where lista = new.lista and id_registro = new.id and accion = 'update');
  return null;
end $$;
drop trigger if exists apih_aud_campos on public.registros;
create trigger apih_aud_campos after update of datos on public.registros for each row when (old.datos is distinct from new.datos) execute function public.apih_aud_campos();

-- ===== 20261028001100_campos_permitidos.sql =====
-- =====================================================================================
-- APIH Prototipo · Contrato de campos en el servidor
--   Una fila de las listas con catálogo (proyectos, propuestas, riesgos, hitos…) solo puede traer claves del catálogo apih_campos.
--   Una clave que no está en el catálogo se rechaza (campo desconocido), salvo que la fila ya la traía: así no se rompe lo que el
--   servidor guardó antes ni lo que escriben los comandos del servidor (apih_*), que no pasan por esta regla.
--   Las listas sin catálogo (configuración, roles, claves) no se restringen.
-- =====================================================================================
create table if not exists public.apih_campos (
  lista text not null,
  campo text not null,
  primary key (lista, campo)
);
alter table public.apih_campos enable row level security;      -- sin políticas: solo la función del servidor la lee
revoke all on public.apih_campos from anon, authenticated;

create or replace function public.apih_campos_check() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb := '{}'::jsonb; k text;
begin
  if coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then return new; end if;
  if not exists (select 1 from public.apih_campos where lista = new.lista) then return new; end if;
  begin jn := substr(new.datos, 4)::jsonb; exception when others then return new; end;     -- el JSON inválido lo rechaza apih_fila
  if jsonb_typeof(jn) <> 'object' then return new; end if;
  if tg_op = 'UPDATE' then
    begin jo := substr(old.datos, 4)::jsonb; exception when others then jo := '{}'::jsonb; end;
    if jsonb_typeof(jo) <> 'object' then jo := '{}'::jsonb; end if;
  end if;
  for k in select jsonb_object_keys(jn) loop
    if not (jo ? k) and not exists (select 1 from public.apih_campos where lista = new.lista and campo = k) then
      raise exception 'APIH: campo desconocido «%» en %', k, new.lista using errcode = '22023', hint = k;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists apih_campos on public.registros;
create trigger apih_campos before insert or update on public.registros for each row execute function public.apih_campos_check();

-- ===== 20261028001200_campos_catalogo.sql =====
-- GENERADO por tools/generar-campos.js: catálogo de campos permitidos por lista (fuente: tests/contract/campos_permitidos.json).
-- Mientras la rama no se publique se regenera en este mismo archivo; después, el generador debe emitir una migración nueva.
delete from public.apih_campos;
insert into public.apih_campos (lista, campo) values
  ('APIH_Bitacora', 'autor'),
  ('APIH_Bitacora', 'id'),
  ('APIH_Bitacora', 'inPres'),
  ('APIH_Bitacora', 'ini'),
  ('APIH_Bitacora', 'meta'),
  ('APIH_Bitacora', 'tema'),
  ('APIH_Bitacora', 'texto'),
  ('APIH_Bitacora', 'tipo'),
  ('APIH_Bitacora', 'ts'),
  ('APIH_Cambios', 'aprobador'),
  ('APIH_Cambios', 'creada'),
  ('APIH_Cambios', 'desc'),
  ('APIH_Cambios', 'estado'),
  ('APIH_Cambios', 'fAnt'),
  ('APIH_Cambios', 'fDec'),
  ('APIH_Cambios', 'fNue'),
  ('APIH_Cambios', 'id'),
  ('APIH_Cambios', 'impacto'),
  ('APIH_Cambios', 'ini'),
  ('APIH_Cambios', 'motivo'),
  ('APIH_Cambios', 'nota'),
  ('APIH_Cambios', 'pAnt'),
  ('APIH_Cambios', 'pNue'),
  ('APIH_Cambios', 'solicita'),
  ('APIH_Cambios', 'tipo'),
  ('APIH_Comites', 'acciones'),
  ('APIH_Comites', 'compromisos'),
  ('APIH_Comites', 'decisiones'),
  ('APIH_Comites', 'estado'),
  ('APIH_Comites', 'fecha'),
  ('APIH_Comites', 'hora'),
  ('APIH_Comites', 'id'),
  ('APIH_Comites', 'lugar'),
  ('APIH_Comites', 'narrativa'),
  ('APIH_Comites', 'nombre'),
  ('APIH_Comites', 'participantes'),
  ('APIH_Comites', 'resumen'),
  ('APIH_Comites', 'temas'),
  ('APIH_Compromisos', 'creada'),
  ('APIH_Compromisos', 'de'),
  ('APIH_Compromisos', 'estado'),
  ('APIH_Compromisos', 'fechaReal'),
  ('APIH_Compromisos', 'id'),
  ('APIH_Compromisos', 'ini'),
  ('APIH_Compromisos', 'limite'),
  ('APIH_Compromisos', 'origen'),
  ('APIH_Compromisos', 'resp'),
  ('APIH_Compromisos', 'tema'),
  ('APIH_Compromisos', 'texto'),
  ('APIH_Decisiones', 'aplicada'),
  ('APIH_Decisiones', 'area'),
  ('APIH_Decisiones', 'comite'),
  ('APIH_Decisiones', 'escalada'),
  ('APIH_Decisiones', 'estado'),
  ('APIH_Decisiones', 'fResol'),
  ('APIH_Decisiones', 'id'),
  ('APIH_Decisiones', 'ini'),
  ('APIH_Decisiones', 'limite'),
  ('APIH_Decisiones', 'recomendacion'),
  ('APIH_Decisiones', 'resolucion'),
  ('APIH_Decisiones', 'solicita'),
  ('APIH_Decisiones', 'tipo'),
  ('APIH_Decisiones', 'titulo'),
  ('APIH_Documentos', 'autor'),
  ('APIH_Documentos', 'correo'),
  ('APIH_Documentos', 'id'),
  ('APIH_Documentos', 'ini'),
  ('APIH_Documentos', 'nombre'),
  ('APIH_Documentos', 'nota'),
  ('APIH_Documentos', 'tipo'),
  ('APIH_Documentos', 'ts'),
  ('APIH_Documentos', 'url'),
  ('APIH_Hitos', 'cat'),
  ('APIH_Hitos', 'completado'),
  ('APIH_Hitos', 'desc'),
  ('APIH_Hitos', 'fase'),
  ('APIH_Hitos', 'fecha'),
  ('APIH_Hitos', 'fechaReal'),
  ('APIH_Hitos', 'id'),
  ('APIH_Hitos', 'inPres'),
  ('APIH_Hitos', 'ini'),
  ('APIH_Hitos', 'nombre'),
  ('APIH_Hitos', 'peso'),
  ('APIH_Hitos', 'resp'),
  ('APIH_Hitos', 'subfase'),
  ('APIH_Notas', 'area'),
  ('APIH_Notas', 'autor'),
  ('APIH_Notas', 'correo'),
  ('APIH_Notas', 'estado'),
  ('APIH_Notas', 'fAb'),
  ('APIH_Notas', 'fVisto'),
  ('APIH_Notas', 'id'),
  ('APIH_Notas', 'ini'),
  ('APIH_Notas', 'por'),
  ('APIH_Notas', 'ref'),
  ('APIH_Notas', 'texto'),
  ('APIH_Notas', 'tipo'),
  ('APIH_Notas', 'ts'),
  ('APIH_Notas', 'vista'),
  ('APIH_Notas', 'visto'),
  ('APIH_Notas', 'vistoPor'),
  ('APIH_Propuestas', 'actualizada'),
  ('APIH_Propuestas', 'ahorroReal'),
  ('APIH_Propuestas', 'area'),
  ('APIH_Propuestas', 'avance'),
  ('APIH_Propuestas', 'base'),
  ('APIH_Propuestas', 'baseHist'),
  ('APIH_Propuestas', 'bc'),
  ('APIH_Propuestas', 'beneficio'),
  ('APIH_Propuestas', 'categoria'),
  ('APIH_Propuestas', 'clasif'),
  ('APIH_Propuestas', 'contrato'),
  ('APIH_Propuestas', 'creada'),
  ('APIH_Propuestas', 'deps'),
  ('APIH_Propuestas', 'desc'),
  ('APIH_Propuestas', 'est'),
  ('APIH_Propuestas', 'estado'),
  ('APIH_Propuestas', 'estadoMotivo'),
  ('APIH_Propuestas', 'estadoRev'),
  ('APIH_Propuestas', 'fase'),
  ('APIH_Propuestas', 'faseDesde'),
  ('APIH_Propuestas', 'finEst'),
  ('APIH_Propuestas', 'finPlan'),
  ('APIH_Propuestas', 'finReal'),
  ('APIH_Propuestas', 'folio'),
  ('APIH_Propuestas', 'gastado'),
  ('APIH_Propuestas', 'gasto'),
  ('APIH_Propuestas', 'hist'),
  ('APIH_Propuestas', 'hitos'),
  ('APIH_Propuestas', 'id'),
  ('APIH_Propuestas', 'inicioPlan'),
  ('APIH_Propuestas', 'inicioReal'),
  ('APIH_Propuestas', 'issue'),
  ('APIH_Propuestas', 'legacy'),
  ('APIH_Propuestas', 'legacyId'),
  ('APIH_Propuestas', 'lider'),
  ('APIH_Propuestas', 'logros'),
  ('APIH_Propuestas', 'moneda'),
  ('APIH_Propuestas', 'negocio'),
  ('APIH_Propuestas', 'oc'),
  ('APIH_Propuestas', 'origen'),
  ('APIH_Propuestas', 'presupuesto'),
  ('APIH_Propuestas', 'prioridad'),
  ('APIH_Propuestas', 'propuestaOrigen'),
  ('APIH_Propuestas', 'proveedor'),
  ('APIH_Propuestas', 'proximos'),
  ('APIH_Propuestas', 'proyecto'),
  ('APIH_Propuestas', 'rag'),
  ('APIH_Propuestas', 'rec'),
  ('APIH_Propuestas', 'resumen'),
  ('APIH_Propuestas', 'riesgoTxt'),
  ('APIH_Propuestas', 'riesgos'),
  ('APIH_Propuestas', 'score'),
  ('APIH_Propuestas', 'snapFase'),
  ('APIH_Propuestas', 'solicitante'),
  ('APIH_Propuestas', 'sponsor'),
  ('APIH_Propuestas', 'tags'),
  ('APIH_Propuestas', 'tipo'),
  ('APIH_Propuestas', 'tipoIni'),
  ('APIH_Propuestas', 'titulo'),
  ('APIH_Proyectos', 'actualizada'),
  ('APIH_Proyectos', 'ahorroReal'),
  ('APIH_Proyectos', 'area'),
  ('APIH_Proyectos', 'avance'),
  ('APIH_Proyectos', 'avanceCalc'),
  ('APIH_Proyectos', 'avanceManual'),
  ('APIH_Proyectos', 'base'),
  ('APIH_Proyectos', 'baseHist'),
  ('APIH_Proyectos', 'bc'),
  ('APIH_Proyectos', 'beneficio'),
  ('APIH_Proyectos', 'categoria'),
  ('APIH_Proyectos', 'clasif'),
  ('APIH_Proyectos', 'contrato'),
  ('APIH_Proyectos', 'creada'),
  ('APIH_Proyectos', 'deps'),
  ('APIH_Proyectos', 'desc'),
  ('APIH_Proyectos', 'est'),
  ('APIH_Proyectos', 'estado'),
  ('APIH_Proyectos', 'estadoMotivo'),
  ('APIH_Proyectos', 'estadoRev'),
  ('APIH_Proyectos', 'fase'),
  ('APIH_Proyectos', 'faseDesde'),
  ('APIH_Proyectos', 'faseNota'),
  ('APIH_Proyectos', 'fasesFechas'),
  ('APIH_Proyectos', 'finEst'),
  ('APIH_Proyectos', 'finPlan'),
  ('APIH_Proyectos', 'finReal'),
  ('APIH_Proyectos', 'folio'),
  ('APIH_Proyectos', 'gastado'),
  ('APIH_Proyectos', 'gasto'),
  ('APIH_Proyectos', 'hist'),
  ('APIH_Proyectos', 'hitos'),
  ('APIH_Proyectos', 'id'),
  ('APIH_Proyectos', 'inicioPlan'),
  ('APIH_Proyectos', 'inicioReal'),
  ('APIH_Proyectos', 'issue'),
  ('APIH_Proyectos', 'legacy'),
  ('APIH_Proyectos', 'legacyId'),
  ('APIH_Proyectos', 'lider'),
  ('APIH_Proyectos', 'logros'),
  ('APIH_Proyectos', 'michelin'),
  ('APIH_Proyectos', 'moneda'),
  ('APIH_Proyectos', 'negocio'),
  ('APIH_Proyectos', 'oc'),
  ('APIH_Proyectos', 'origen'),
  ('APIH_Proyectos', 'presupuesto'),
  ('APIH_Proyectos', 'prioridad'),
  ('APIH_Proyectos', 'propuestaOrigen'),
  ('APIH_Proyectos', 'proveedor'),
  ('APIH_Proyectos', 'proximos'),
  ('APIH_Proyectos', 'proyecto'),
  ('APIH_Proyectos', 'rag'),
  ('APIH_Proyectos', 'rec'),
  ('APIH_Proyectos', 'resumen'),
  ('APIH_Proyectos', 'riesgoTxt'),
  ('APIH_Proyectos', 'riesgos'),
  ('APIH_Proyectos', 'snapFase'),
  ('APIH_Proyectos', 'sponsor'),
  ('APIH_Proyectos', 'subfases'),
  ('APIH_Proyectos', 'tags'),
  ('APIH_Proyectos', 'tipo'),
  ('APIH_Proyectos', 'tipoIni'),
  ('APIH_Proyectos', 'titulo'),
  ('APIH_Riesgos', 'cat'),
  ('APIH_Riesgos', 'desc'),
  ('APIH_Riesgos', 'dueno'),
  ('APIH_Riesgos', 'estado'),
  ('APIH_Riesgos', 'fIdent'),
  ('APIH_Riesgos', 'fRev'),
  ('APIH_Riesgos', 'id'),
  ('APIH_Riesgos', 'imp'),
  ('APIH_Riesgos', 'ini'),
  ('APIH_Riesgos', 'mit'),
  ('APIH_Riesgos', 'prob'),
  ('APIH_Riesgos', 'titulo')
on conflict do nothing;

-- ===== 20261028001300_guardar_entidades.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5b · Formularios por comando: hitos, riesgos y decisiones
--   Cada formulario es una operación con nombre del servidor (lo que pidió Arquitectura: la SPA no usa la escritura genérica
--   para estas entidades). El servidor autoriza (área de la iniciativa), valida con el campo afectado (hint), asigna el id,
--   completa los valores por defecto, aplica los efectos (comité, avance) y deja la bitácora. La SPA solo envía lo que la persona
--   escribió y muestra el resultado.
--     apih_guardar_hito(p_id, p_datos)      → {id, avisos}
--     apih_guardar_riesgo(p_id, p_datos)    → {id, critico}
--     apih_guardar_decision(p_id, p_datos)  → {id}
--     apih_eliminar(p_lista, p_id)          → {id}   (hitos, riesgos y decisiones)
--   p_id nulo = alta. Los campos que gobiernan otros comandos no se tocan aquí (completar hito → apih_hito_estado; resolver una
--   decisión → apih_resolver_decision).
-- =====================================================================================

-- ---------- Umbrales: una sola definición (valores por defecto + ajuste del líder) ----------
-- Antes: las compuertas usaban el umbral de la organización con un 15 fijo y los cálculos el de la iniciativa sin valor por defecto.
create or replace function public.apih_cfg_def(k text) returns numeric language sql immutable as
$$ select case k when 'umbralCritico' then 15 when 'tolDesv' then 7 when 'diasSinUpdate' then 14 when 'decMaxDias' then 30 when 'descMax' then 500 end::numeric $$;
-- Valor de la organización: el configurado o, si no hay, el valor por defecto (apih_num devuelve 0 cuando falta la clave)
create or replace function public.apih_cfg_num(k text) returns numeric language sql stable security definer set search_path = public as
$$ select case when jsonb_typeof(public.apih_cfg() -> k) = 'number' or (public.apih_cfg() ->> k) ~ '^-?\d+(\.\d+)?$' then public.apih_num(public.apih_cfg(), k) else public.apih_cfg_def(k) end $$;

create or replace function public.apih_umbral(ini jsonb, k text) returns numeric language plpgsql stable security definer set search_path = public as
$$ declare cfg jsonb := public.apih_cfg(); v jsonb; org numeric := public.apih_cfg_num(k);
begin
  if coalesce(cfg #>> array['fijos', k], '') not in ('', '0', 'false') then return org; end if;
  if coalesce(ini ->> 'lider', '') = '' then return org; end if;
  select substr(r.datos, 4)::jsonb #> array['v', 'cfg', k] into v
    from public.perfiles p join public.registros r on r.lista = 'APIH_Config' and r.id = 'cfgU:' || p.email
   where lower(btrim(p.nombre)) = lower(btrim(ini ->> 'lider')) and left(substr(r.datos, 4), 1) = '{' limit 1;
  return case when v is not null and jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else org end;
end $$;

create or replace function public.apih_compuertas(p_id text, p_hasta text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; g jsonb := '[]'::jsonb; umbral numeric; n_hit int; pend int; k int;
  sinmit boolean; av int; todos boolean;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; umbral := public.apih_umbral(j, 'umbralCritico'); es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into hs from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into rs from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  n_hit := jsonb_array_length(hs);
  sinmit := exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral and coalesce(x ->> 'mit', '') !~ '\S');
  a := array_position(fs, j ->> 'fase'); b := array_position(fs, hasta);

  if hasta = 'Evaluación' then
    g := g || public.apih_g('Problema/objetivo descrito'::text, coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null);
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
  end if;
  if hasta = 'Caso de Negocio' then
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
    g := g || public.apih_g('Evaluación de valor/esfuerzo completada'::text, not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false));
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Aprobación' then
    g := g || public.apih_g('Presupuesto estimado'::text, not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
    g := g || public.apih_g('Beneficio esperado'::text, not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Business case redactado'::text, coalesce(j ->> 'bc', '') = '');
  end if;
  if hasta = 'Ejecución' then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Presupuesto asignado'::text, not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Al menos 2 hitos planificados'::text, n_hit < 2);
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    g := g || public.apih_g('Hitos de las fases anteriores completados'::text, not todos);
    g := g || public.apih_g('Sin hitos vencidos'::text, exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text));
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 then g := g || public.apih_g(case when pend > 0 then 'Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')' else 'Hitos de la fase ' || (j ->> 'fase') || ' completados' end, pend > 0); end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    g := g || public.apih_g('Avance al 100%'::text, av < 100);
    g := g || public.apih_g('Todos los hitos completados'::text, exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true'));
    g := g || public.apih_g('Sin riesgos críticos abiertos'::text, exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral));
  end if;
  return g;
end $$;

-- Iniciativa por id (proyecto o propuesta)
create or replace function public.apih_ini(p_ini text) returns public.registros language sql stable security definer set search_path = public as
$$ select * from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_ini limit 1 $$;

-- Id siguiente de una lista (PREFIJO-NNN), sin repetir los ya usados ni los reservados en APIH_Config/seq
create or replace function public.apih_nuevo_id(p_lista text, p_pre text) returns text language plpgsql security definer set search_path = public as
$$ declare n int; s int;
begin
  perform pg_advisory_xact_lock(hashtext('apih_id:' || p_lista));
  select coalesce(max(nullif(regexp_replace(split_part(id, '-', 2), '\D', '', 'g'), '')::int), 0) into n
    from public.registros where lista = p_lista and id like p_pre || '-%';
  select coalesce((substr(datos, 4)::jsonb ->> p_pre)::int, 0) into s from public.registros where lista = 'APIH_Config' and id = 'seq' and left(substr(datos, 4), 1) = '{';
  return p_pre || '-' || lpad((greatest(n, coalesce(s, 0)) + 1)::text, 3, '0');
end $$;

-- Error de validación con el campo afectado (la SPA lo marca en el formulario)
create or replace function public.apih_err(p_msg text, p_campo text) returns void language plpgsql immutable as
$$ begin raise exception 'APIH: %', p_msg using errcode = '22023', hint = coalesce(p_campo, ''); end $$;

-- Escritura de una fila por un comando: pasa por los mismos disparadores (validación, catálogo de campos, auditoría)
create or replace function public.apih_escribir(p_lista text, p_id text, j jsonb) returns void language plpgsql security definer set search_path = public as
$$ begin
  insert into public.registros(lista, id, datos) values (p_lista, p_id, 'p1.' || (j || jsonb_build_object('id', p_id))::text)
  on conflict (lista, id) do update set datos = excluded.datos;
end $$;

create or replace function public.apih_bitacora_cmd(p_ini text, p_tipo text, p_texto text, p_meta text default null) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform set_config('apih.interno', 'on', true);
  perform public.apih_bitacora(p_ini, p_tipo, p_texto, p_meta);
  perform set_config('apih.interno', 'off', true);
end $$;

-- Datos que trae el formulario: solo claves de texto; se quitan las que no gobierna el comando
create or replace function public.apih_limpiar(j jsonb, quitar text[]) returns jsonb language sql immutable as
$$ select coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(j, '{}'::jsonb)) e(k, v) where not k = any(quitar)), '{}'::jsonb) $$;

create or replace function public.apih_txt(j jsonb, k text) returns text language sql immutable as $$ select nullif(btrim(coalesce(j ->> k, '')), '') $$;

-- Permiso de escritura sobre la iniciativa de un registro (y la anterior, si se mueve de iniciativa)
create or replace function public.apih_puede_ini(p_ini text, p_campo text default 'ini') returns public.registros language plpgsql stable security definer set search_path = public as
$$ declare ir public.registros;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if public.apih_txt(jsonb_build_object('x', p_ini), 'x') is null then perform public.apih_err('elige la iniciativa', p_campo); end if;
  ir := public.apih_ini(p_ini);
  if ir.id is null then perform public.apih_err('la iniciativa ' || p_ini || ' no existe', p_campo); end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501', hint = p_campo; end if;
  return ir;
end $$;

-- ---------- Hito ----------
create or replace function public.apih_guardar_hito(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; h0 jsonb := '{}'::jsonb;
  d jsonb := public.apih_limpiar(p_datos, array['id', 'fechaReal']); h jsonb; ir public.registros; i jsonb; sx jsonb; id_ text;
  comp0 boolean := false; comp1 boolean; avisos jsonb := '[]'::jsonb; dmax int := public.apih_cfg_num('descMax')::int;
begin
  if not nw then
    select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
    if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
    h0 := substr(r.datos, 4)::jsonb; comp0 := coalesce((h0 ->> 'completado')::boolean, false);
    perform public.apih_puede_ini(h0 ->> 'ini');
  end if;
  h := h0 || d;
  ir := public.apih_puede_ini(h ->> 'ini'); i := substr(ir.datos, 4)::jsonb;
  if public.apih_txt(h, 'nombre') is null then perform public.apih_err('el hito necesita nombre', 'nombre'); end if;
  if public.apih_txt(h, 'fecha') is null then perform public.apih_err('indica la fecha del hito', 'fecha'); end if;
  -- peso opcional 0..100
  if coalesce(h ->> 'peso', '') = '' then h := h - 'peso';
  elsif jsonb_typeof(h -> 'peso') <> 'number' and (h ->> 'peso') !~ '^\d+(\.\d+)?$' then perform public.apih_err('el peso debe ser un número', 'peso');
  else h := jsonb_set(h, '{peso}', to_jsonb((h ->> 'peso')::numeric));
    if (h ->> 'peso')::numeric < 0 or (h ->> 'peso')::numeric > 100 then perform public.apih_err('el peso va de 0 a 100', 'peso'); end if;
  end if;
  -- subfase: debe ser de la iniciativa y fija la fase
  if public.apih_txt(h, 'subfase') is null then h := h - 'subfase';
  else
    select x into sx from jsonb_array_elements(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' else '[]'::jsonb end) x where x ->> 'id' = h ->> 'subfase' limit 1;
    if sx is null then perform public.apih_err('la subfase elegida no es de esta iniciativa', 'subfase'); end if;
    if public.apih_txt(h, 'fase') is null then h := h || jsonb_build_object('fase', sx ->> 'fase'); end if;
    if h ->> 'fase' <> sx ->> 'fase' then perform public.apih_err('la subfase «' || (sx ->> 'nombre') || '» es de ' || (sx ->> 'fase') || ': el hito debe estar en esa fase', 'fase'); end if;
    if public.apih_txt(h, 'fecha') is not null and public.apih_txt(sx, 'inicio') is not null and public.apih_txt(sx, 'fin') is not null
       and ((h ->> 'fecha')::date < (sx ->> 'inicio')::date or (h ->> 'fecha')::date > (sx ->> 'fin')::date) then
      avisos := avisos || to_jsonb('la fecha del hito queda fuera de la subfase «' || (sx ->> 'nombre') || '» (' || to_char((sx ->> 'inicio')::date, 'DD-MM-YYYY') || ' a ' || to_char((sx ->> 'fin')::date, 'DD-MM-YYYY') || ')');
    end if;
  end if;
  if public.apih_txt(h, 'desc') is null then h := h - 'desc';
  elsif length(btrim(h ->> 'desc')) > dmax then perform public.apih_err('la descripción no puede superar ' || dmax || ' caracteres', 'desc');
  else h := jsonb_set(h, '{desc}', to_jsonb(btrim(h ->> 'desc'))); end if;
  -- completar o reabrir lo hace apih_hito_estado (avance y cierre automático); en un alta completado fija la fecha real
  comp1 := coalesce((h ->> 'completado')::boolean, false);
  if nw then
    h := h || jsonb_build_object('completado', comp1, 'fechaReal', case when comp1 then hoy::text else null end);
    id_ := public.apih_nuevo_id('APIH_Hitos', 'HIT');
  else
    id_ := p_id; h := h || jsonb_build_object('completado', comp0, 'fechaReal', h0 -> 'fechaReal');
  end if;
  perform public.apih_escribir('APIH_Hitos', id_, h);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text))::text where lista = ir.lista and id = ir.id;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_bitacora_cmd(h ->> 'ini', 'Cambio', case when nw then 'Hito creado: ' || (h ->> 'nombre') || ' (' || to_char((h ->> 'fecha')::date, 'DD-MM-YYYY') || ')' else 'Hito actualizado: ' || (h ->> 'nombre') end);
  if not nw and comp1 <> comp0 then perform public.apih_hito_estado(id_, comp1); end if;
  return jsonb_build_object('id', id_, 'avisos', avisos);
end $$;

-- ---------- Riesgo ----------
create or replace function public.apih_guardar_riesgo(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; x0 jsonb := '{}'::jsonb; x jsonb; ir public.registros; id_ text;
  e0 numeric := 0; e1 numeric; umb numeric; crit boolean;
begin
  if not nw then
    select * into r from public.registros where lista = 'APIH_Riesgos' and id = p_id for update;
    if not found then raise exception 'APIH: el riesgo % no existe', p_id using errcode = 'P0002'; end if;
    x0 := substr(r.datos, 4)::jsonb; perform public.apih_puede_ini(x0 ->> 'ini');
    e0 := coalesce((x0 ->> 'prob')::numeric, 0) * coalesce((x0 ->> 'imp')::numeric, 0);
  end if;
  x := x0 || public.apih_limpiar(p_datos, array['id']);
  if nw then x := jsonb_build_object('cat', 'Técnico', 'prob', 3, 'imp', 3, 'estado', 'Abierto', 'fIdent', public.apih_hoy()::text, 'mit', '') || x; end if;
  ir := public.apih_puede_ini(x ->> 'ini');
  if public.apih_txt(x, 'desc') is null then perform public.apih_err('describe el riesgo', 'desc'); end if;
  foreach id_ in array array['prob', 'imp'] loop
    if (x ->> id_) !~ '^\d+$' then perform public.apih_err(id_ || ' debe ser un número de 1 a 5', id_); end if;
    x := jsonb_set(x, array[id_], to_jsonb((x ->> id_)::int));
  end loop;
  if coalesce(x ->> 'estado', '') not in ('Abierto', 'En mitigación', 'Materializado', 'Cerrado') then perform public.apih_err('estado de riesgo inválido', 'estado'); end if;
  if coalesce(x ->> 'cat', '') not in ('Técnico', 'Alcance', 'Recursos', 'Proveedor', 'Cronograma', 'Financiero', 'Regulatorio', 'Otro') then perform public.apih_err('categoría de riesgo inválida', 'cat'); end if;
  e1 := (x ->> 'prob')::numeric * (x ->> 'imp')::numeric;
  umb := public.apih_umbral(substr(ir.datos, 4)::jsonb, 'umbralCritico');
  crit := x ->> 'estado' <> 'Cerrado' and e1 >= umb;
  if crit and public.apih_txt(x, 'mit') is null then perform public.apih_err('un riesgo crítico (exposición ' || e1 || ' ≥ ' || umb || ') requiere plan de mitigación', 'mit'); end if;
  id_ := case when nw then public.apih_nuevo_id('APIH_Riesgos', 'RSK') else p_id end;
  perform public.apih_escribir('APIH_Riesgos', id_, x);
  perform public.apih_bitacora_cmd(x ->> 'ini', 'Riesgo',
    case when nw then 'Riesgo identificado: ' || (x ->> 'desc') else 'Riesgo actualizado: ' || (x ->> 'desc') || ' (' || (x ->> 'estado') || ')' end,
    case when nw then 'Exposición ' || e1 else 'Exposición ' || e0 || ' → ' || e1 end);
  return jsonb_build_object('id', id_, 'critico', crit);
end $$;

-- ---------- Decisión ----------
create or replace function public.apih_guardar_decision(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; x0 jsonb := '{}'::jsonb; x jsonb;
  ir public.registros; id_ text; maxd int := public.apih_cfg_num('decMaxDias')::int; c0 text; c1 text; es_prop boolean;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if not nw then
    select * into r from public.registros where lista = 'APIH_Decisiones' and id = p_id for update;
    if not found then raise exception 'APIH: la decisión % no existe', p_id using errcode = 'P0002'; end if;
    x0 := substr(r.datos, 4)::jsonb;
    if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la decisión' using errcode = '42501'; end if;
  end if;
  -- el estado y la resolución solo cambian con apih_resolver_decision
  x := x0 || public.apih_limpiar(p_datos, array['id', 'estado', 'resolucion', 'fResol', 'aplicada', 'escalada', 'area']);
  if nw then x := jsonb_build_object('tipo', 'Iniciar', 'estado', 'Pendiente', 'resolucion', '', 'fResol', null, 'aplicada', false) || x; end if;
  if public.apih_txt(x, 'titulo') is null then perform public.apih_err('escribe la pregunta o decisión', 'titulo'); end if;
  if coalesce(x ->> 'tipo', '') not in ('Iniciar', 'Acelerar', 'Mantener', 'Pausar', 'Cancelar') then perform public.apih_err('tipo de decisión inválido', 'tipo'); end if;
  if public.apih_txt(x, 'limite') is null then perform public.apih_err('la fecha límite es obligatoria', 'limite'); end if;
  if (x ->> 'limite')::date > hoy + maxd then perform public.apih_err('el plazo máximo de una decisión es de ' || maxd || ' días', 'limite'); end if;
  if public.apih_txt(x, 'ini') is not null then
    ir := public.apih_puede_ini(x ->> 'ini'); es_prop := ir.lista = 'APIH_Propuestas';
    if x ->> 'tipo' = 'Iniciar' and not es_prop then perform public.apih_err('«Iniciar» aplica solo a propuestas', 'tipo'); end if;
    if x ->> 'tipo' = 'Acelerar' and es_prop then perform public.apih_err('«Acelerar» aplica solo a proyectos', 'tipo'); end if;
    x := x || jsonb_build_object('area', coalesce(ir.area, 'BISE'));
  else
    x := (x - 'ini') || jsonb_build_object('area', coalesce(x0 ->> 'area', 'BISE'));
  end if;
  if public.apih_txt(x, 'comite') is not null and not exists (select 1 from public.registros where lista = 'APIH_Comites' and id = x ->> 'comite') then
    perform public.apih_err('el comité elegido no existe', 'comite'); end if;
  id_ := case when nw then public.apih_nuevo_id('APIH_Decisiones', 'DEC') else p_id end;
  perform public.apih_escribir('APIH_Decisiones', id_, x);
  -- el comité lleva la lista de sus decisiones: se mueve en la misma transacción
  c0 := public.apih_txt(x0, 'comite'); c1 := public.apih_txt(x, 'comite');
  if c0 is distinct from c1 then
    perform set_config('apih.interno', 'on', true);
    update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(case when jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' then substr(datos, 4)::jsonb -> 'decisiones' else '[]'::jsonb end) v where v #>> '{}' <> id_), '[]'::jsonb)
        || case when id = c1 then jsonb_build_array(id_) else '[]'::jsonb end)::text
      where lista = 'APIH_Comites' and id in (coalesce(c0, ''), coalesce(c1, ''));
    perform set_config('apih.interno', 'off', true);
  end if;
  if nw then perform public.apih_bitacora_cmd(x ->> 'ini', 'Decisión', 'Decisión solicitada (' || (x ->> 'tipo') || '): ' || (x ->> 'titulo')); end if;
  return jsonb_build_object('id', id_);
end $$;

-- ---------- Eliminar ----------
create or replace function public.apih_eliminar(p_lista text, p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; x jsonb; t text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_lista not in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones') then raise exception 'APIH: no se puede eliminar en %', p_lista using errcode = '42501'; end if;
  select * into r from public.registros where lista = p_lista and id = p_id for update;
  if not found then raise exception 'APIH: el registro % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área del registro' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  if p_lista = 'APIH_Decisiones' then
    perform set_config('apih.interno', 'on', true);
    update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(substr(datos, 4)::jsonb -> 'decisiones') v where v #>> '{}' <> p_id), '[]'::jsonb))::text
      where lista = 'APIH_Comites' and jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' and substr(datos, 4)::jsonb -> 'decisiones' ? p_id;
    perform set_config('apih.interno', 'off', true);
  end if;
  delete from public.registros where lista = p_lista and id = p_id;
  t := case p_lista when 'APIH_Hitos' then 'Hito eliminado: ' || coalesce(x ->> 'nombre', p_id)
                    when 'APIH_Riesgos' then 'Riesgo eliminado: ' || coalesce(x ->> 'desc', p_id)
                    else 'Decisión eliminada: ' || coalesce(x ->> 'titulo', p_id) end;
  perform public.apih_bitacora_cmd(x ->> 'ini', case p_lista when 'APIH_Riesgos' then 'Riesgo' when 'APIH_Decisiones' then 'Decisión' else 'Cambio' end, t);
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.apih_ini(text), public.apih_nuevo_id(text, text), public.apih_escribir(text, text, jsonb), public.apih_bitacora_cmd(text, text, text, text),
  public.apih_puede_ini(text, text) from public, anon, authenticated;
revoke all on function public.apih_guardar_hito(text, jsonb), public.apih_guardar_riesgo(text, jsonb), public.apih_guardar_decision(text, jsonb), public.apih_eliminar(text, text) from public, anon;
grant execute on function public.apih_guardar_hito(text, jsonb), public.apih_guardar_riesgo(text, jsonb), public.apih_guardar_decision(text, jsonb), public.apih_eliminar(text, text) to authenticated;

-- ===== 20261028001350_campos_formularios.sql =====
-- Catálogo de campos: claves de los formularios de iniciativa que el e2e no recorre (alta directa y propuesta).
-- Las altas al catálogo van en migraciones nuevas: las ya aplicadas no se editan.
insert into public.apih_campos (lista, campo) values
  ('APIH_Propuestas', 'motivoAlta'),
  ('APIH_Propuestas', 'objetivos'),
  ('APIH_Propuestas', 'problema'),
  ('APIH_Propuestas', 'resultadoNota'),
  ('APIH_Propuestas', 'usuarios'),
  ('APIH_Proyectos', 'motivoAlta'),
  ('APIH_Proyectos', 'objetivos'),
  ('APIH_Proyectos', 'problema'),
  ('APIH_Proyectos', 'resultadoNota'),
  ('APIH_Proyectos', 'solicitante'),
  ('APIH_Proyectos', 'usuarios')
on conflict do nothing;

-- ===== 20261028001400_guardar_iniciativa.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5c · Iniciativa por comando: crear, editar (con plantilla de hitos) y eliminar con sus registros
--   apih_guardar_iniciativa(p_id, p_tipo, p_datos) → {id, hitosPlantilla}
--   apih_eliminar_iniciativa(p_id)                 → {id, registros}
--   La SPA envía lo que la persona escribió en el formulario. El servidor normaliza (áreas, puntaje, montos, avance manual),
--   valida con el campo afectado, asigna id y valores iniciales, precarga los hitos de la plantilla del tipo, deja la bitácora
--   con lo que cambió y, al eliminar, borra en la misma transacción los registros asociados sin dejar huérfanos.
--   Fase, estado y vínculos propuesta-proyecto siguen siendo de «Cambiar etapa» y de la aprobación.
-- =====================================================================================

-- Dependencias: ¿agregar p_deps a p_id crea un ciclo?
create or replace function public.apih_ciclo_deps(p_id text, p_deps jsonb) returns boolean language sql stable security definer set search_path = public as
$$
with recursive g(id, dep) as (
  select r.id, d #>> '{}' from public.registros r, jsonb_array_elements(case when jsonb_typeof(substr(r.datos, 4)::jsonb -> 'deps') = 'array' then substr(r.datos, 4)::jsonb -> 'deps' else '[]'::jsonb end) d
   where r.lista in ('APIH_Proyectos', 'APIH_Propuestas') and r.id <> p_id
  union all select p_id, d #>> '{}' from jsonb_array_elements(coalesce(p_deps, '[]'::jsonb)) d
), alc(id) as (
  select dep from g where g.id = p_id
  union select g.dep from g join alc on g.id = alc.id
)
select exists (select 1 from alc where id = p_id) $$;

-- Hitos de la plantilla del tipo (Administración → Metodología) para las fases indicadas; no duplica nombre+fase
create or replace function public.apih_plantilla_hitos(p_ini text, p_tipo text, p_fases text[], p_base date, p_resp text) returns int language plpgsql security definer set search_path = public as
$$ declare t jsonb; h jsonb; n int := 0; hid text;
begin
  select x into t from jsonb_array_elements(case when jsonb_typeof(public.apih_cfg() #> '{metodo,tipos}') = 'array' then public.apih_cfg() #> '{metodo,tipos}' else '[]'::jsonb end) x
   where x ->> 'nombre' = p_tipo limit 1;
  if t is null then return 0; end if;
  for h in select * from jsonb_array_elements(case when jsonb_typeof(t -> 'hitos') = 'array' then t -> 'hitos' else '[]'::jsonb end) loop
    continue when not (h ->> 'fase') = any (p_fases);
    continue when exists (select 1 from public.registros where lista = 'APIH_Hitos' and substr(datos, 4)::jsonb ->> 'ini' = p_ini
                            and substr(datos, 4)::jsonb ->> 'nombre' = h ->> 'n' and substr(datos, 4)::jsonb ->> 'fase' = h ->> 'fase');
    hid := public.apih_nuevo_id('APIH_Hitos', 'HIT');
    perform public.apih_escribir('APIH_Hitos', hid, jsonb_build_object('ini', p_ini, 'nombre', h ->> 'n', 'fase', h ->> 'fase',
      'fecha', (p_base + coalesce(public.apih_num(h, 'dias'), 0)::int)::text, 'completado', false, 'fechaReal', null, 'resp', coalesce(p_resp, '')));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.apih_guardar_iniciativa(p_id text, p_tipo text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; i0 jsonb := '{}'::jsonb; i jsonb; d jsonb;
  es_prop boolean; lst text; id_ text; area text; k text; fs text[]; nh int := 0; diffs text[] := '{}'; et text; base date;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nw then
    if coalesce(p_tipo, '') not in ('Proyecto', 'Propuesta') then raise exception 'APIH: tipo de iniciativa inválido (%)', p_tipo using errcode = '22023'; end if;
    es_prop := p_tipo = 'Propuesta';
  else
    r := public.apih_ini(p_id);
    if r.id is null then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
    perform 1 from public.registros where lista = r.lista and id = r.id for update;
    if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
    i0 := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas';
  end if;
  lst := case when es_prop then 'APIH_Propuestas' else 'APIH_Proyectos' end;
  -- lo que gobiernan otros comandos o calcula el servidor no viene del formulario
  d := public.apih_limpiar(p_datos, array['id', 'tipo', 'fase', 'estado', 'estadoMotivo', 'estadoRev', 'faseDesde', 'proyecto', 'propuestaOrigen',
         'avance', 'avanceCalc', 'hist', 'fasesFechas', 'michelin', 'base', 'baseHist', 'escalada', 'snapFase', 'creada', 'actualizada', 'est', 'origen', 'legacy',
         'areaArr', 'sE', 'sV', 'sF', 'sR', 'score']);
  -- áreas: lista del formulario (areaArr) o texto; por defecto BISE
  area := case when jsonb_typeof(p_datos -> 'areaArr') = 'array' and jsonb_array_length(p_datos -> 'areaArr') > 0
               then (select string_agg(btrim(x #>> '{}'), ',') from jsonb_array_elements(p_datos -> 'areaArr') x where btrim(x #>> '{}') <> '')
               else coalesce(public.apih_txt(p_datos, 'area'), public.apih_txt(i0, 'area')) end;
  d := d || jsonb_build_object('area', coalesce(area, 'BISE'));
  if not public.apih_edita_area(d ->> 'area') then raise exception 'APIH: sin permiso sobre el área elegida' using errcode = '42501', hint = 'areaArr'; end if;
  -- puntaje de priorización de una propuesta
  if es_prop and (p_datos ? 'sE' or p_datos ? 'sV' or p_datos ? 'sF' or p_datos ? 'sR') then
    foreach k in array array['sE', 'sV', 'sF', 'sR'] loop
      if (p_datos ->> k) !~ '^[1-5]$' then perform public.apih_err('el puntaje va de 1 a 5', k); end if;
    end loop;
    d := d || jsonb_build_object('score', jsonb_build_object('estrategia', (p_datos ->> 'sE')::int, 'valor', (p_datos ->> 'sV')::int, 'esfuerzo', (p_datos ->> 'sF')::int, 'riesgo', (p_datos ->> 'sR')::int));
  end if;
  -- montos: números no negativos
  foreach k in array array['presupuesto', 'gastado', 'beneficio', 'ahorroReal'] loop
    if d ? k then
      if coalesce(d ->> k, '') = '' then d := d - k;
      elsif (d ->> k) !~ '^\d+(\.\d+)?$' then perform public.apih_err('los montos deben ser números no negativos', k);
      else d := jsonb_set(d, array[k], to_jsonb((d ->> k)::numeric)); end if;
    end if;
  end loop;
  -- avance: el servidor lo calcula; aquí solo el ajuste manual (vacío = calculado)
  if not es_prop and d ? 'avanceManual' then
    if coalesce(d ->> 'avanceManual', '') = '' then d := jsonb_set(d, '{avanceManual}', 'null');
    elsif (d ->> 'avanceManual') !~ '^\d+(\.\d+)?$' or (d ->> 'avanceManual')::numeric > 100 then perform public.apih_err('el ajuste de avance debe estar entre 0 y 100', 'avanceManual');
    else d := jsonb_set(d, '{avanceManual}', to_jsonb(round((d ->> 'avanceManual')::numeric)::int)); end if;
  elsif es_prop then d := d - 'avanceManual'; end if;
  i := i0 || d;
  if public.apih_txt(i, 'titulo') is null then perform public.apih_err('el título es obligatorio', 'titulo'); end if;
  if public.apih_txt(i, 'lider') is null then perform public.apih_err('indica el líder o responsable', 'lider'); end if;
  if nw and not es_prop and public.apih_txt(i, 'motivoAlta') is null then perform public.apih_err('indica el motivo de la creación directa (sin propuesta previa)', 'motivoAlta'); end if;
  if public.apih_txt(i, 'inicioPlan') is not null and public.apih_txt(i, 'finPlan') is not null and (i ->> 'finPlan')::date < (i ->> 'inicioPlan')::date then
    perform public.apih_err('el fin plan no puede ser anterior al inicio', 'finPlan'); end if;
  -- dependencias: iniciativas existentes, sin la propia y sin ciclos
  if jsonb_typeof(i -> 'deps') = 'array' then
    if exists (select 1 from jsonb_array_elements(i -> 'deps') x where (x #>> '{}') = coalesce(p_id, '') or public.apih_ini(x #>> '{}') is null or (public.apih_ini(x #>> '{}')).id is null) then
      perform public.apih_err('una dependencia no existe o es la misma iniciativa', 'deps'); end if;
    if not nw and public.apih_ciclo_deps(p_id, i -> 'deps') then perform public.apih_err('las dependencias generan un ciclo', 'deps'); end if;
  else i := i || jsonb_build_object('deps', '[]'::jsonb); end if;
  i := i || jsonb_build_object('finEst', case when es_prop then null else coalesce(i -> 'finEst', i -> 'finPlan') end, 'actualizada', hoy::text);
  if nw then
    fs := public.apih_fases(es_prop);
    i := jsonb_build_object('tipo', case when es_prop then 'Propuesta' else 'Proyecto' end, 'legacy', '', 'creada', hoy::text, 'faseDesde', hoy::text, 'origen', 'usuario',
           'est', '[]'::jsonb, 'hist', '[]'::jsonb, 'tags', '[]'::jsonb, 'rec', null, 'folio', '', 'oc', '', 'ahorroReal', 0, 'inicioReal', null,
           'estado', case when es_prop then 'Vigente' else 'En curso' end, 'propuestaOrigen', null, 'estadoMotivo', '', 'estadoRev', null,
           'rag', 'Verde', 'prioridad', 'Media', 'avance', 0, 'gastado', 0, 'proyecto', null, 'fase', fs[1]) || i;
    id_ := public.apih_nuevo_id(lst, case when es_prop then 'PROP' else 'PRJ' end);
  else
    id_ := p_id;
    -- marcas de «estimado» (est) que siguen valiendo: las de campos que no cambiaron
    i := i || jsonb_build_object('est', coalesce((select jsonb_agg(x) from jsonb_array_elements(case when jsonb_typeof(i0 -> 'est') = 'array' then i0 -> 'est' else '[]'::jsonb end) x
                                                 where x #>> '{}' <> 'all' and (i0 -> (x #>> '{}')) is not distinct from (i -> (x #>> '{}'))), '[]'::jsonb));
    foreach k in array array['rag', 'prioridad', 'lider', 'finPlan', 'finEst', 'presupuesto'] loop
      if (i0 -> k) is distinct from (i -> k) then
        diffs := array_append(diffs, (case k when 'rag' then 'RAG' when 'prioridad' then 'Prioridad' when 'lider' then 'Líder' when 'finPlan' then case when es_prop then 'Fecha objetivo' else 'Fin plan' end
                                  when 'finEst' then 'Fin estimado' else case when es_prop then 'Costo estimado' else 'Presupuesto' end end)
                            || ': ' || coalesce(i0 ->> k, '—') || ' → ' || coalesce(i ->> k, '—'));
      end if;
    end loop;
  end if;
  perform public.apih_escribir(lst, id_, i);
  -- plantilla del tipo: al crear, o al elegir un tipo en una iniciativa sin hitos
  if public.apih_txt(i, 'tipoIni') is not null and (nw or ((i0 ->> 'tipoIni') is distinct from (i ->> 'tipoIni')
       and not exists (select 1 from public.registros where lista = 'APIH_Hitos' and substr(datos, 4)::jsonb ->> 'ini' = id_))) then
    base := case when es_prop then hoy else coalesce(public.apih_fecha(i, 'inicioPlan'), hoy) end;
    nh := public.apih_plantilla_hitos(id_, i ->> 'tipoIni', public.apih_fases(es_prop), base, i ->> 'lider');
  end if;
  et := case when nw then (case when nh > 0 then '[' || nh || ' hitos precargados del tipo «' || (i ->> 'tipoIni') || '»] ' else '' end)
                          || case when es_prop then 'Propuesta creada: ' else 'Proyecto creado directamente: ' end || (i ->> 'titulo')
                          || coalesce(' — ' || public.apih_txt(i, 'motivoAlta'), '')
             when cardinality(diffs) > 0 then 'Actualizada: ' || array_to_string(diffs, '; ')
             else 'Ficha actualizada' end;
  perform public.apih_bitacora_cmd(id_, 'Cambio', et);
  return jsonb_build_object('id', id_, 'hitosPlantilla', nh);
end $$;

create or replace function public.apih_eliminar_iniciativa(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; x jsonb; n int; decs text[];
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  r := public.apih_ini(p_id);
  if r.id is null then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  select coalesce(array_agg(id), '{}') into decs from public.registros where lista = 'APIH_Decisiones' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  perform set_config('apih.interno', 'on', true);
  -- sin huérfanos: comités y dependencias de otras iniciativas
  update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
      coalesce((select jsonb_agg(v) from jsonb_array_elements(substr(datos, 4)::jsonb -> 'decisiones') v where not (v #>> '{}') = any (decs)), '[]'::jsonb))::text
    where lista = 'APIH_Comites' and jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' and cardinality(decs) > 0;
  update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{deps}',
      coalesce((select jsonb_agg(v) from jsonb_array_elements(substr(datos, 4)::jsonb -> 'deps') v where v #>> '{}' <> p_id), '[]'::jsonb))::text
    where lista in ('APIH_Proyectos', 'APIH_Propuestas') and jsonb_typeof(substr(datos, 4)::jsonb -> 'deps') = 'array' and substr(datos, 4)::jsonb -> 'deps' ? p_id;
  delete from public.registros where lista in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Compromisos', 'APIH_Cambios', 'APIH_Notas', 'APIH_Documentos')
    and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  get diagnostics n = row_count;
  delete from public.registros where lista = r.lista and id = p_id;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_bitacora_cmd(null, 'Cambio', case when r.lista = 'APIH_Propuestas' then 'Propuesta' else 'Proyecto' end || ' eliminada: ' || coalesce(x ->> 'titulo', p_id), n || ' registro(s) asociados');
  return jsonb_build_object('id', p_id, 'registros', n);
end $$;

revoke all on function public.apih_ciclo_deps(text, jsonb), public.apih_plantilla_hitos(text, text, text[], date, text) from public, anon, authenticated;
revoke all on function public.apih_guardar_iniciativa(text, text, jsonb), public.apih_eliminar_iniciativa(text) from public, anon;
grant execute on function public.apih_guardar_iniciativa(text, text, jsonb), public.apih_eliminar_iniciativa(text) to authenticated;

-- ===== 20261028001500_guardar_compromiso.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5d · Compromisos por comando del servidor
--     apih_guardar_compromiso(p_id, p_datos) → {id}   (alta, edición, cumplir / reabrir)
--   El servidor autoriza (área de la iniciativa), valida con el campo afectado, asigna el id, deja la fecha real al cambiar el estado
--   y escribe la bitácora. La SPA solo envía lo que la persona escribió. Eliminar: apih_eliminar('APIH_Compromisos', id).
-- =====================================================================================
create or replace function public.apih_guardar_compromiso(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; x0 jsonb := '{}'::jsonb; x jsonb; id_ text; ir public.registros;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if not nw then
    select * into r from public.registros where lista = 'APIH_Compromisos' and id = p_id for update;
    if not found then raise exception 'APIH: el compromiso % no existe', p_id using errcode = 'P0002'; end if;
    x0 := substr(r.datos, 4)::jsonb;
    if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área del compromiso' using errcode = '42501'; end if;
  end if;
  -- fecha real, creación y estado inicial los pone el servidor
  x := x0 || public.apih_limpiar(p_datos, array['id', 'fechaReal', 'creada', 'area']);
  if nw then x := jsonb_build_object('estado', 'Abierto', 'fechaReal', null, 'creada', hoy, 'origen', coalesce(public.apih_txt(p_datos, 'origen'), 'manual')) || (x - 'estado' - 'origen'); end if;
  if public.apih_txt(x, 'texto') is null then perform public.apih_err('describe qué se comprometió', 'texto'); end if;
  if public.apih_txt(x, 'resp') is null then perform public.apih_err('indica quién es el responsable', 'resp'); end if;
  if public.apih_txt(x, 'limite') is null then perform public.apih_err('la fecha comprometida es obligatoria', 'limite'); end if;
  if coalesce(x ->> 'limite', '') !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha comprometida inválida', 'limite'); end if;
  if coalesce(x ->> 'estado', '') not in ('Abierto', 'Cumplido', 'Cancelado') then perform public.apih_err('estado inválido', 'estado'); end if;
  x := x || jsonb_build_object('ini', public.apih_txt(x, 'ini'));
  if x ->> 'ini' is not null then ir := public.apih_puede_ini(x ->> 'ini'); end if;
  if not nw and (x ->> 'estado') is distinct from (x0 ->> 'estado') then
    x := x || jsonb_build_object('fechaReal', case when x ->> 'estado' = 'Cumplido' then to_jsonb(hoy::text) else 'null'::jsonb end);
  end if;
  id_ := case when nw then public.apih_nuevo_id('APIH_Compromisos', 'ACU') else p_id end;
  perform public.apih_escribir('APIH_Compromisos', id_, x);
  if nw then
    perform public.apih_bitacora_cmd(x ->> 'ini', 'Cambio', 'Compromiso registrado: ' || (x ->> 'texto') || ' — ' || (x ->> 'resp') || ', ' || to_char((x ->> 'limite')::date, 'DD-MM-YYYY'));
  elsif (x ->> 'estado') is distinct from (x0 ->> 'estado') then
    perform public.apih_bitacora_cmd(x ->> 'ini', 'Cambio', 'Compromiso ' || id_ || ' → ' || (x ->> 'estado') || ': ' || (x ->> 'texto'));
  end if;
  return jsonb_build_object('id', id_);
end $$;

-- (apih_eliminar se amplía a compromisos y comités en 20261028001600)

revoke all on function public.apih_guardar_compromiso(text, jsonb) from public, anon;
grant execute on function public.apih_guardar_compromiso(text, jsonb) to authenticated;

-- ===== 20261028001600_guardar_comite.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5d · Comités por comando del servidor
--     apih_guardar_comite(p_id, p_datos)                 → {id}        alta / edición del comité
--     apih_comite_agregar(p_id, p_col, p_item)           → {id?}       temas · participantes · acciones · compromisos
--     apih_comite_quitar(p_id, p_col, p_ref)             → {}          tema (posición), acción o compromiso (id)
--     apih_comite_marcar(p_id, p_col, p_ref, p_valor)    → {}          asistencia · cumplir / reabrir acción o compromiso
--     apih_comite_sugerido(p_id, p_ini)                  → {}          agrega una iniciativa a la agenda
--     apih_comite_armar(p_id, p_tipo)                    → {agregados} arma la agenda con lo pendiente
--     apih_comite_cerrar(p_id)                           → {}          sesión realizada
--     apih_eliminar('APIH_Comites', id)                  → {id}        (las decisiones del comité quedan sin comité)
--   Solo quien gobierna (administra, responsable o marca explícita). Ids, valores iniciales y bitácora: del servidor.
-- =====================================================================================
create or replace function public.apih_comite_leer(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Comites' and id = p_id for update;
  if not found then raise exception 'APIH: el comité % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_escribe('APIH_Comites', p_id, null) then raise exception 'APIH: solo quien gobierna puede gestionar comités' using errcode = '42501'; end if;
  return substr(r.datos, 4)::jsonb;
end $$;

create or replace function public.apih_fmt_fecha(d text) returns text language sql immutable as
$$ select case when d ~ '^\d{4}-\d{2}-\d{2}$' then to_char(d::date, 'DD-MM-YYYY') else coalesce(d, '') end $$;

create or replace function public.apih_guardar_comite(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare nw boolean := p_id is null or btrim(p_id) = ''; x0 jsonb := '{}'::jsonb; x jsonb; id_ text; yo text; parts jsonb; cfg jsonb := public.apih_cfg();
begin
  if nw then
    if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
    if not public.apih_escribe('APIH_Comites', 'COM-000', null) then raise exception 'APIH: solo quien gobierna puede gestionar comités' using errcode = '42501'; end if;
  else x0 := public.apih_comite_leer(p_id); end if;
  x := x0 || public.apih_limpiar(p_datos, array['id', 'participantes', 'temas', 'decisiones', 'acciones', 'compromisos', 'narrativa', 'area']);
  if nw then
    select coalesce(nullif(nombre, ''), email) into yo from public.perfiles where email = public.apih_email();
    parts := jsonb_build_array(jsonb_build_object('n', yo, 'rol', 'PMO / IT Business Partner', 'asistio', false))
      || coalesce((select jsonb_agg(jsonb_build_object('n', v, 'rol', 'Participante', 'asistio', false)) from jsonb_array_elements_text(case when jsonb_typeof(cfg -> 'comiteParts') = 'array' then cfg -> 'comiteParts' else '[]'::jsonb end) v), '[]'::jsonb);
    x := jsonb_build_object('participantes', parts, 'temas', '[]'::jsonb, 'decisiones', '[]'::jsonb, 'acciones', '[]'::jsonb, 'compromisos', '[]'::jsonb, 'narrativa', '') || x;
  end if;
  if public.apih_txt(x, 'nombre') is null then perform public.apih_err('escribe el nombre del comité', 'nombre'); end if;
  if public.apih_txt(x, 'fecha') is null then perform public.apih_err('la fecha es obligatoria', 'fecha'); end if;
  if x ->> 'fecha' !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha inválida', 'fecha'); end if;
  if public.apih_txt(x, 'hora') is not null and x ->> 'hora' !~ '^\d{2}:\d{2}$' then perform public.apih_err('hora inválida', 'hora'); end if;
  if coalesce(x ->> 'estado', 'Programado') not in ('Programado', 'Realizado', 'Cancelado') then perform public.apih_err('estado inválido', 'estado'); end if;
  x := jsonb_build_object('estado', 'Programado') || x;
  id_ := case when nw then public.apih_nuevo_id('APIH_Comites', 'COM') else p_id end;
  perform public.apih_escribir('APIH_Comites', id_, x);
  if nw then perform public.apih_bitacora_cmd(null, 'Cambio', 'Comité programado: ' || public.apih_fmt_fecha(x ->> 'fecha')); end if;
  return jsonb_build_object('id', id_);
end $$;

create or replace function public.apih_comite_agregar(p_id text, p_col text, p_item jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id); it jsonb; nid text; arr jsonb;
begin
  if p_col not in ('temas', 'participantes', 'acciones', 'compromisos') then raise exception 'APIH: colección inválida %', p_col using errcode = '22023'; end if;
  arr := case when jsonb_typeof(x -> p_col) = 'array' then x -> p_col else '[]'::jsonb end;
  if p_col = 'temas' then
    if public.apih_txt(p_item, 't') is null then perform public.apih_err('escribe el tema', 't'); end if;
    if public.apih_txt(p_item, 'ini') is not null and (public.apih_ini(p_item ->> 'ini')).id is null then perform public.apih_err('la iniciativa no existe', 'ini'); end if;
    it := jsonb_build_object('t', btrim(p_item ->> 't'), 'ini', public.apih_txt(p_item, 'ini'), 'notas', coalesce(p_item ->> 'notas', ''));
  elsif p_col = 'participantes' then
    if public.apih_txt(p_item, 'n') is null then perform public.apih_err('indica el nombre', 'n'); end if;
    it := jsonb_build_object('n', btrim(p_item ->> 'n'), 'rol', coalesce(public.apih_txt(p_item, 'rol'), 'Participante'), 'asistio', false);
  else
    if public.apih_txt(p_item, 'texto') is null then perform public.apih_err('describe la ' || case when p_col = 'acciones' then 'acción' else 'compromiso' end, 'texto'); end if;
    if public.apih_txt(p_item, 'limite') is not null and p_item ->> 'limite' !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha límite inválida', 'limite'); end if;
    if public.apih_txt(p_item, 'ini') is not null then perform public.apih_puede_ini(p_item ->> 'ini'); end if;
    nid := (case p_col when 'acciones' then 'ACC-' else 'CMP-' end) || substr(md5(random()::text || clock_timestamp()::text), 1, 4);
    it := jsonb_build_object('id', nid, 'estado', case p_col when 'acciones' then 'Abierta' else 'Abierto' end, 'cierre', '', 'texto', btrim(p_item ->> 'texto'),
      'resp', coalesce(p_item ->> 'resp', ''), 'limite', coalesce(p_item ->> 'limite', ''), 'ini', public.apih_txt(p_item, 'ini'));
    perform public.apih_bitacora_cmd(public.apih_txt(p_item, 'ini'), 'Cambio', case p_col when 'acciones' then 'Acción registrada: ' else 'Compromiso registrado: ' end || (it ->> 'texto'));
  end if;
  perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object(p_col, arr || jsonb_build_array(it)));
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.apih_comite_quitar(p_id text, p_col text, p_ref text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id); arr jsonb;
begin
  if p_col not in ('temas', 'acciones', 'compromisos') then raise exception 'APIH: colección inválida %', p_col using errcode = '22023'; end if;
  arr := case when jsonb_typeof(x -> p_col) = 'array' then x -> p_col else '[]'::jsonb end;
  if p_col = 'temas' then
    if p_ref !~ '^\d+$' or p_ref::int >= jsonb_array_length(arr) then raise exception 'APIH: el tema % no existe', p_ref using errcode = 'P0002'; end if;
    arr := arr - p_ref::int;
  else
    if not exists (select 1 from jsonb_array_elements(arr) v where v ->> 'id' = p_ref) then raise exception 'APIH: % no existe', p_ref using errcode = 'P0002'; end if;
    arr := coalesce((select jsonb_agg(v) from jsonb_array_elements(arr) v where v ->> 'id' <> p_ref), '[]'::jsonb);
  end if;
  perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object(p_col, arr));
  return '{}'::jsonb;
end $$;

create or replace function public.apih_comite_marcar(p_id text, p_col text, p_ref text, p_valor boolean) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id); arr jsonb; it jsonb; n int;
begin
  if p_col not in ('participantes', 'acciones', 'compromisos') then raise exception 'APIH: colección inválida %', p_col using errcode = '22023'; end if;
  arr := case when jsonb_typeof(x -> p_col) = 'array' then x -> p_col else '[]'::jsonb end;
  if p_col = 'participantes' then
    if p_ref !~ '^\d+$' or p_ref::int >= jsonb_array_length(arr) then raise exception 'APIH: el participante % no existe', p_ref using errcode = 'P0002'; end if;
    arr := jsonb_set(arr, array[p_ref, 'asistio'], to_jsonb(coalesce(p_valor, false)));
  else
    select (ord - 1)::int, v into n, it from jsonb_array_elements(arr) with ordinality t(v, ord) where v ->> 'id' = p_ref;
    if it is null then raise exception 'APIH: % no existe', p_ref using errcode = 'P0002'; end if;
    arr := jsonb_set(arr, array[n::text, 'estado'], to_jsonb(case when p_valor then (case p_col when 'acciones' then 'Cerrada' else 'Cumplido' end) else (case p_col when 'acciones' then 'Abierta' else 'Abierto' end) end));
    perform public.apih_bitacora_cmd(it ->> 'ini', 'Actualización', (case p_col when 'acciones' then 'Acción ' else 'Compromiso ' end) || (case when p_valor then 'cumplido/a: ' else 'reabierto/a: ' end) || coalesce(it ->> 'texto', ''));
  end if;
  perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object(p_col, arr));
  return '{}'::jsonb;
end $$;

-- Iniciativa viva: ni en estado final ni en Stand By
create or replace function public.apih_viva(r public.registros) returns boolean language sql immutable as
$$ select case when r.lista = 'APIH_Propuestas' then substr(r.datos, 4)::jsonb ->> 'estado' not in ('Aprobada', 'Rechazada', 'Retirada', 'Stand By')
               else substr(r.datos, 4)::jsonb ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') end $$;

create or replace function public.apih_comite_sugerido(p_id text, p_ini text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id); ir public.registros := public.apih_ini(p_ini); arr jsonb;
begin
  if ir.id is null or not public.apih_ve_area(ir.area) then perform public.apih_err('la iniciativa no existe', 'ini'); end if;
  arr := case when jsonb_typeof(x -> 'temas') = 'array' then x -> 'temas' else '[]'::jsonb end;
  arr := arr || jsonb_build_array(jsonb_build_object('t', case when ir.lista = 'APIH_Propuestas' then 'Decidir: ' else 'Seguimiento: ' end || (substr(ir.datos, 4)::jsonb ->> 'titulo'), 'ini', p_ini, 'notas', ''));
  perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object('temas', arr));
  return '{}'::jsonb;
end $$;

create or replace function public.apih_comite_armar(p_id text, p_tipo text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id); arr jsonb; prop boolean := p_tipo = 'prop'; n0 int; t text; q record;
begin
  arr := case when jsonb_typeof(x -> 'temas') = 'array' then x -> 'temas' else '[]'::jsonb end; n0 := jsonb_array_length(arr);
  for q in select substr(d.datos, 4)::jsonb j from public.registros d join public.registros i on i.id = substr(d.datos, 4)::jsonb ->> 'ini' and i.lista in ('APIH_Proyectos', 'APIH_Propuestas')
            where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{' and substr(d.datos, 4)::jsonb ->> 'estado' = 'Pendiente'
              and public.apih_ve_area(i.area) and (i.lista = 'APIH_Propuestas') = prop order by d.id loop
    t := 'Decidir: ' || (q.j ->> 'titulo');
    if not exists (select 1 from jsonb_array_elements(arr) v where v ->> 't' = t and coalesce(v ->> 'ini', '') = (q.j ->> 'ini')) then
      arr := arr || jsonb_build_array(jsonb_build_object('t', t, 'ini', q.j ->> 'ini', 'notas', '')); end if;
  end loop;
  if prop then
    for q in select substr(i.datos, 4)::jsonb j, i.id from public.registros i where i.lista = 'APIH_Propuestas' and left(substr(i.datos, 4), 1) = '{' and public.apih_viva(i) and public.apih_ve_area(i.area) order by i.id loop
      t := 'Revisar propuesta: ' || (q.j ->> 'titulo');
      if not exists (select 1 from jsonb_array_elements(arr) v where v ->> 't' = t and coalesce(v ->> 'ini', '') = q.id) then
        arr := arr || jsonb_build_array(jsonb_build_object('t', t, 'ini', q.id, 'notas', '')); end if;
    end loop;
  end if;
  if jsonb_array_length(arr) > n0 then perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object('temas', arr)); end if;
  return jsonb_build_object('agregados', jsonb_array_length(arr) - n0);
end $$;

create or replace function public.apih_comite_cerrar(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare x jsonb := public.apih_comite_leer(p_id);
begin
  if x ->> 'estado' = 'Realizado' then perform public.apih_err('la sesión ya está cerrada', 'estado'); end if;
  perform public.apih_escribir('APIH_Comites', p_id, x || jsonb_build_object('estado', 'Realizado'));
  perform public.apih_bitacora_cmd(null, 'Cambio', 'Comité realizado (' || public.apih_fmt_fecha(x ->> 'fecha') || '): ' || coalesce(jsonb_array_length(x -> 'temas'), 0) || ' temas, '
    || coalesce(jsonb_array_length(x -> 'decisiones'), 0) || ' decisiones, ' || (coalesce(jsonb_array_length(x -> 'acciones'), 0) + coalesce(jsonb_array_length(x -> 'compromisos'), 0)) || ' acciones/compromisos');
  return '{}'::jsonb;
end $$;

-- Eliminar: se agregan los comités (sus decisiones quedan sin comité)
create or replace function public.apih_eliminar(p_lista text, p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; x jsonb; t text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_lista not in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Compromisos', 'APIH_Comites') then raise exception 'APIH: no se puede eliminar en %', p_lista using errcode = '42501'; end if;
  select * into r from public.registros where lista = p_lista and id = p_id for update;
  if not found then raise exception 'APIH: el registro % no existe', p_id using errcode = 'P0002'; end if;
  if p_lista = 'APIH_Comites' then
    if not public.apih_escribe(p_lista, p_id, null) then raise exception 'APIH: solo quien gobierna puede gestionar comités' using errcode = '42501'; end if;
  elsif not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área del registro' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  perform set_config('apih.interno', 'on', true);
  if p_lista = 'APIH_Decisiones' then
    update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(substr(datos, 4)::jsonb -> 'decisiones') v where v #>> '{}' <> p_id), '[]'::jsonb))::text
      where lista = 'APIH_Comites' and jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' and substr(datos, 4)::jsonb -> 'decisiones' ? p_id;
  elsif p_lista = 'APIH_Comites' then
    update public.registros set datos = 'p1.' || ((substr(datos, 4)::jsonb) - 'comite')::text
      where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'comite' = p_id;
  end if;
  perform set_config('apih.interno', 'off', true);
  delete from public.registros where lista = p_lista and id = p_id;
  t := case p_lista when 'APIH_Hitos' then 'Hito eliminado: ' || coalesce(x ->> 'nombre', p_id)
                    when 'APIH_Riesgos' then 'Riesgo eliminado: ' || coalesce(x ->> 'desc', p_id)
                    when 'APIH_Compromisos' then 'Compromiso eliminado: ' || coalesce(x ->> 'texto', p_id)
                    when 'APIH_Comites' then 'Comité eliminado: ' || coalesce(x ->> 'nombre', p_id)
                    else 'Decisión eliminada: ' || coalesce(x ->> 'titulo', p_id) end;
  perform public.apih_bitacora_cmd(x ->> 'ini', case p_lista when 'APIH_Riesgos' then 'Riesgo' when 'APIH_Decisiones' then 'Decisión' else 'Cambio' end, t);
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.apih_comite_leer(text), public.apih_fmt_fecha(text), public.apih_viva(public.registros) from public, anon, authenticated;
revoke all on function public.apih_guardar_comite(text, jsonb), public.apih_comite_agregar(text, text, jsonb), public.apih_comite_quitar(text, text, text),
  public.apih_comite_marcar(text, text, text, boolean), public.apih_comite_sugerido(text, text), public.apih_comite_armar(text, text), public.apih_comite_cerrar(text) from public, anon;
grant execute on function public.apih_guardar_comite(text, jsonb), public.apih_comite_agregar(text, text, jsonb), public.apih_comite_quitar(text, text, text),
  public.apih_comite_marcar(text, text, text, boolean), public.apih_comite_sugerido(text, text), public.apih_comite_armar(text, text), public.apih_comite_cerrar(text) to authenticated;

-- ===== 20261028001700_avisos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5e · Avisos (notificaciones): las reglas viven en el servidor
--   Antes el navegador calculaba qué avisar a quién (hitos y compromisos por vencer, riesgo crítico, atraso, sin actualización,
--   cambios pendientes y eventos de la bitácora). Ahora apih_calculos() entrega «notif»:
--     catalogo  qué avisos existen, grupos, destinatarios posibles y canales (definición única)
--     prefs     preferencia efectiva de quien llama por tipo (por defecto del catálogo → organización → la persona)
--     avisos    los avisos de quien llama, ordenados (fecha y gravedad), con los canales por los que se entregan
--   La configuración (qué se avisa, a quién, canales) se sigue guardando en cfg / cfgU como datos; la regla que la interpreta es del servidor.
-- =====================================================================================

create or replace function public.apih_cfg_def(k text) returns numeric language sql immutable as
$$ select case k when 'umbralCritico' then 15 when 'tolDesv' then 7 when 'diasSinUpdate' then 14 when 'decMaxDias' then 30 when 'descMax' then 500 when 'propDiasAmb' then 30 end::numeric $$;

create or replace function public.apih_notif_catalogo() returns jsonb language sql immutable as
$j$ select $cat${"canales": [["app", "En la app", true], ["correo", "Correo", false], ["teams", "Teams", false]], "destinos": [["lider", "Líder"], ["sponsor", "Sponsor"], ["resp", "Responsable directo"], ["pmo", "PMO (Administra)"]], "grupos": {"plazos": "Plazos y compromisos", "riesgos": "Riesgos y decisiones", "salud": "Salud y avance", "colab": "Colaboración", "gob": "Gobierno y cambios"}, "tipos": [{"id": "hito_prox", "g": "plazos", "l": "Hito por vencer", "d": "Un hito pendiente vence en los próximos días.", "sev": 1, "on": true, "dest": ["resp", "lider"], "dias": 3, "diasL": "días de anticipación"}, {"id": "hito_venc", "g": "plazos", "l": "Hito vencido", "d": "Un hito de un proyecto en curso pasó su fecha sin completarse.", "sev": 2, "on": true, "dest": ["resp", "lider"]}, {"id": "comp_prox", "g": "plazos", "l": "Compromiso por vencer", "d": "Un compromiso abierto vence en los próximos días.", "sev": 1, "on": true, "dest": ["resp"], "dias": 3, "diasL": "días de anticipación"}, {"id": "comp_venc", "g": "plazos", "l": "Compromiso vencido", "d": "Un compromiso abierto pasó su fecha límite.", "sev": 2, "on": true, "dest": ["resp", "pmo"]}, {"id": "riesgo_crit", "g": "riesgos", "l": "Riesgo crítico abierto", "d": "Un riesgo abierto supera el umbral de exposición crítica.", "sev": 3, "on": true, "dest": ["resp", "lider"]}, {"id": "dec_venc", "g": "riesgos", "l": "Decisión vencida", "d": "Una decisión pendiente pasó su fecha límite.", "sev": 2, "on": true, "dest": ["resp", "pmo"]}, {"id": "atraso", "g": "salud", "l": "Proyecto atrasado", "d": "La fecha proyectada supera la tolerancia de desviación.", "sev": 2, "on": true, "dest": ["lider", "sponsor"]}, {"id": "sin_update", "g": "salud", "l": "Proyecto sin actualización", "d": "Se superó el plazo sin actualizar el avance.", "sev": 1, "on": true, "dest": ["lider"]}, {"id": "prop_estancada", "g": "salud", "l": "Propuesta estancada", "d": "Una propuesta lleva más días de lo esperado en su fase.", "sev": 1, "on": false, "dest": ["lider"]}, {"id": "ev_rag", "g": "salud", "l": "Salud pasa a Rojo", "d": "Un proyecto cambió su RAG a Rojo (últimos 14 días).", "sev": 3, "on": true, "dest": ["lider", "sponsor", "pmo"], "ev": true}, {"id": "ev_fase", "g": "salud", "l": "Cambio de fase", "d": "Una iniciativa avanzó de fase (últimos 14 días).", "sev": 1, "on": true, "dest": ["lider", "sponsor"], "ev": true}, {"id": "ev_asigna", "g": "colab", "l": "Te asignaron como responsable", "d": "Quedaste como responsable o dueño de una iniciativa, hito o riesgo.", "sev": 1, "on": true, "dest": ["resp"], "ev": true, "fijoDest": true}, {"id": "ev_comentario", "g": "colab", "l": "Comentario nuevo", "d": "Otra persona comentó una iniciativa que lideras o patrocinas.", "sev": 1, "on": true, "dest": ["lider", "sponsor"], "ev": true}, {"id": "cambio_pend", "g": "gob", "l": "Solicitud de cambio pendiente", "d": "Hay una solicitud de cambio esperando aprobación.", "sev": 2, "on": true, "dest": ["pmo"]}, {"id": "cambio_res", "g": "gob", "l": "Solicitud de cambio resuelta", "d": "Se aprobó o rechazó una solicitud que hiciste (últimos 14 días).", "sev": 1, "on": true, "dest": ["resp"], "ev": true, "fijoDest": true}]}$cat$::jsonb $j$;

create or replace function public.apih_fmt_d(d text) returns text language sql immutable as
$$ select case when d ~ '^\d{4}-\d{2}-\d{2}' then to_char(substr(d, 1, 10)::date, 'DD') || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from substr(d, 1, 10)::date)::int] || ' ' || substr(d, 3, 2) else '—' end $$;

create or replace function public.apih_cut(s text, n int) returns text language sql immutable as
$$ select case when length(coalesce(s, '')) > n then left(s, n - 1) || '…' else coalesce(s, '') end $$;

-- Preferencia efectiva de un tipo para una persona: valores del catálogo → organización (cfg.notif) → persona (cfgU.v.notif)
create or replace function public.apih_notif_pref(p_email text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare c jsonb; o jsonb; p jsonb; ur jsonb;
begin
  select e into c from jsonb_array_elements(public.apih_notif_catalogo() -> 'tipos') e where e ->> 'id' = p_id;
  o := coalesce(public.apih_cfg() #> array['notif', 'tipos', p_id], '{}'::jsonb);
  select substr(datos, 4)::jsonb into ur from public.registros where lista = 'APIH_Config' and id = 'cfgU:' || p_email and left(substr(datos, 4), 1) = '{';
  p := coalesce(ur #> array['v', 'notif', 'tipos', p_id], '{}'::jsonb);
  return jsonb_build_object(
    'on', coalesce(nullif(p -> 'on', 'null'::jsonb), nullif(o -> 'on', 'null'::jsonb), c -> 'on'),
    'dest', coalesce(nullif(o -> 'dest', 'null'::jsonb), c -> 'dest'),
    'dias', coalesce(nullif(o -> 'dias', 'null'::jsonb), c -> 'dias'),
    'canales', jsonb_build_object('app', true, 'correo', false, 'teams', false) || coalesce(o -> 'canales', '{}'::jsonb) || coalesce(p -> 'canales', '{}'::jsonb));
end $$;

-- ¿Aplica el aviso a la persona? (preferencia activa y relación con la iniciativa / el ítem entre los destinatarios)
create or replace function public.apih_aviso_aplica(p jsonb, p_ini jsonb, p_resp text, p_u text, p_admin boolean) returns boolean language sql immutable as
$$ select coalesce((p ->> 'on')::boolean, false) and exists (
     select 1 from jsonb_array_elements_text(p -> 'dest') k
      where (k = 'lider' and p_ini is not null and public.apih_norm(p_ini ->> 'lider') = p_u)
         or (k = 'sponsor' and p_ini is not null and public.apih_norm(p_ini ->> 'sponsor') = p_u)
         or (k = 'resp' and coalesce(p_resp, '') <> '' and public.apih_norm(p_resp) = p_u)
         or (k = 'pmo' and p_admin)) $$;

create or replace function public.apih_aviso_mk(cat jsonb, p_id text, p_key text, p_ini text, p_texto text, p_ts text, p_sev int default null) returns jsonb language sql immutable as
$$ select jsonb_build_object('key', p_id || ':' || p_key, 'tipo', p_id, 'g', c ->> 'g', 'sev', coalesce(p_sev, (c ->> 'sev')::int), 'ini', p_ini, 'titulo', c ->> 'l', 'texto', p_texto, 'ts', p_ts)
   from jsonb_array_elements(cat) c where c ->> 'id' = p_id $$;

create or replace function public.apih_avisos(calc jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); em text := public.apih_email(); pf public.perfiles; u text; adm boolean; cfg jsonb := public.apih_cfg();
  cat jsonb := public.apih_notif_catalogo(); tipos jsonb := cat -> 'tipos'; P jsonb := '{}'::jsonb; e jsonb; avs jsonb := '[]'::jsonb;
  I jsonb := '{}'::jsonb; r record; j jsonb; ij jsonb; ijj jsonb; d int; ph int; pc int; ts text; t text; c jsonb; amb int; dsu int; k text; arr text[]; ok boolean;
  fa text[] := array['Planificación', 'Ejecución', 'Transición']; ventana int := 14; canalon jsonb := coalesce(cfg #> '{notif,canalOn}', '{}'::jsonb);
  m text[]; body text; ent text; kind text; filas text[][]; parte text; a int; b int; valid boolean; f1 text; f2 text; f3 text; tit text;
begin
  select * into pf from public.perfiles where email = em and activo;
  if not found then return jsonb_build_object('catalogo', cat, 'prefs', '{}'::jsonb, 'avisos', '[]'::jsonb); end if;
  u := public.apih_norm(coalesce(nullif(pf.nombre, ''), pf.email)); adm := pf.app_rol = 'Administra';
  for e in select v from jsonb_array_elements(tipos) v loop P := P || jsonb_build_object(e ->> 'id', public.apih_notif_pref(em, e ->> 'id')); end loop;
  ph := (P -> 'hito_prox' ->> 'dias')::int; pc := (P -> 'comp_prox' ->> 'dias')::int;
  -- iniciativas visibles para quien llama (RLS) con su estado de vida
  for r in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    I := I || jsonb_build_object(r.id, jsonb_build_object('l', r.lista, 'j', r.j,
      'viva', coalesce(r.j ->> 'estado', '') <> 'Stand By' and not (coalesce(r.j ->> 'estado', '') = any (case when r.lista = 'APIH_Propuestas' then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end))));
  end loop;
  -- hitos pendientes de proyectos en curso
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and coalesce(substr(datos, 4)::jsonb ->> 'completado', 'false') <> 'true' loop
    ij := I -> (r.j ->> 'ini'); if ij is null or not (ij ->> 'viva')::boolean or coalesce(ij -> 'j' ->> 'estado', '') <> 'En curso' then continue; end if;
    d := public.apih_fecha(r.j, 'fecha') - hoy; tit := ij -> 'j' ->> 'titulo';
    if d < 0 then
      if public.apih_aviso_aplica(P -> 'hito_venc', ij -> 'j', r.j ->> 'resp', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'hito_venc', r.j ->> 'id', r.j ->> 'ini', '«' || (r.j ->> 'nombre') || '» venció hace ' || (-d) || ' d (' || public.apih_fmt_d(r.j ->> 'fecha') || ') · ' || tit, r.j ->> 'fecha', case when -d > 30 then 3 else 2 end); end if;
    elsif d <= ph and public.apih_aviso_aplica(P -> 'hito_prox', ij -> 'j', r.j ->> 'resp', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'hito_prox', r.j ->> 'id', r.j ->> 'ini', '«' || (r.j ->> 'nombre') || '» vence ' || case when d = 0 then 'hoy' else 'en ' || d || ' d' end || ' (' || public.apih_fmt_d(r.j ->> 'fecha') || ') · ' || tit, r.j ->> 'fecha'); end if;
  end loop;
  -- compromisos abiertos (los de iniciativas en Stand By no cuentan)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' = 'Abierto' and coalesce(substr(datos, 4)::jsonb ->> 'limite', '') <> '' loop
    ij := null;
    if coalesce(r.j ->> 'ini', '') <> '' then ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; if ij -> 'j' ->> 'estado' = 'Stand By' then continue; end if; end if;
    d := public.apih_fecha(r.j, 'limite') - hoy; ijj := ij -> 'j';
    if d < 0 then
      if public.apih_aviso_aplica(P -> 'comp_venc', ijj, r.j ->> 'resp', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'comp_venc', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'texto', 70) || '» venció hace ' || (-d) || ' d · ' || coalesce(nullif(r.j ->> 'resp', ''), 'sin responsable'), r.j ->> 'limite'); end if;
    elsif d <= pc and public.apih_aviso_aplica(P -> 'comp_prox', ijj, r.j ->> 'resp', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'comp_prox', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'texto', 70) || '» vence ' || case when d = 0 then 'hoy' else 'en ' || d || ' d' end || ' · ' || coalesce(nullif(r.j ->> 'resp', ''), 'sin responsable'), r.j ->> 'limite'); end if;
  end loop;
  -- riesgos críticos abiertos
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' is distinct from 'Cerrado' loop
    if coalesce((calc -> 'riesgos' -> (r.j ->> 'id') ->> 'critico')::boolean, false) is not true then continue; end if;
    ij := I -> (r.j ->> 'ini'); if ij is null or not (ij ->> 'viva')::boolean then continue; end if;
    if public.apih_aviso_aplica(P -> 'riesgo_crit', ij -> 'j', r.j ->> 'dueno', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'riesgo_crit', r.j ->> 'id', r.j ->> 'ini', 'Exposición ' || trim_scale((calc -> 'riesgos' -> (r.j ->> 'id') ->> 'expo')::numeric)::text || ': ' || public.apih_cut(r.j ->> 'desc', 80) || ' · ' || (ij -> 'j' ->> 'titulo'), coalesce(nullif(r.j ->> 'fIdent', ''), hoy::text)); end if;
  end loop;
  -- decisiones pendientes vencidas
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' = 'Pendiente' and coalesce(substr(datos, 4)::jsonb ->> 'limite', '') <> '' loop
    if public.apih_fecha(r.j, 'limite') >= hoy then continue; end if;
    ij := null; if coalesce(r.j ->> 'ini', '') <> '' then ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; end if;
    if public.apih_aviso_aplica(P -> 'dec_venc', ij -> 'j', r.j ->> 'solicita', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'dec_venc', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'titulo', 70) || '» venció hace ' || (hoy - public.apih_fecha(r.j, 'limite')) || ' d', r.j ->> 'limite'); end if;
  end loop;
  -- salud de los proyectos activos y propuestas estancadas
  for r in select key as id, value as v from jsonb_each(I) loop
    ij := r.v; j := ij -> 'j'; if not (ij ->> 'viva')::boolean then continue; end if;
    if ij ->> 'l' = 'APIH_Proyectos' and coalesce(j ->> 'tipo', '') <> 'Propuesta' then
      if (j ->> 'fase') = any (fa) and j ->> 'estado' = 'En curso' then
        c := calc -> 'ini' -> r.id;
        if coalesce((c ->> 'atrasado')::boolean, false) and public.apih_aviso_aplica(P -> 'atraso', j, null, u, adm) then
          avs := avs || public.apih_aviso_mk(tipos, 'atraso', r.id, r.id, (j ->> 'titulo') || ': +' || (c ->> 'desv') || ' d sobre el plan', hoy::text); end if;
        dsu := coalesce((c ->> 'dsu')::int, 999);
        if dsu > public.apih_umbral(j, 'diasSinUpdate') and public.apih_aviso_aplica(P -> 'sin_update', j, null, u, adm) then
          avs := avs || public.apih_aviso_mk(tipos, 'sin_update', r.id, r.id, (j ->> 'titulo') || ': ' || case when dsu >= 999 then 'sin registro de actualización' else dsu || ' d sin actualizar' end, hoy::text); end if;
      end if;
    elsif ij ->> 'l' = 'APIH_Propuestas' and j ->> 'estado' = 'Vigente' then
      d := hoy - coalesce(public.apih_fecha(j, 'faseDesde'), public.apih_fecha(j, 'actualizada'), public.apih_fecha(j, 'creada'), hoy);
      amb := coalesce(nullif(public.apih_umbral(j, 'propDiasAmb'), 0), 30)::int;
      if d > amb and public.apih_aviso_aplica(P -> 'prop_estancada', j, null, u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'prop_estancada', r.id, r.id, (j ->> 'titulo') || ': ' || d || ' d en la fase ' || (j ->> 'fase'), hoy::text); end if;
    end if;
  end loop;
  -- solicitudes de cambio: pendientes (regla) y resueltas en la ventana (evento)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{' loop
    ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if;
    if r.j ->> 'estado' = 'Solicitado' then
      if public.apih_aviso_aplica(P -> 'cambio_pend', ij -> 'j', r.j ->> 'aprobador', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'cambio_pend', r.j ->> 'id', r.j ->> 'ini', (r.j ->> 'tipo') || ': ' || public.apih_cut(coalesce(nullif(r.j ->> 'desc', ''), r.j ->> 'id'), 70) || ' · pide ' || coalesce(nullif(r.j ->> 'solicita', ''), '—'), coalesce(nullif(r.j ->> 'creada', ''), hoy::text)); end if;
    elsif coalesce(r.j ->> 'fDec', '') <> '' and hoy - public.apih_fecha(r.j, 'fDec') <= ventana then
      if public.apih_aviso_aplica(P -> 'cambio_res', ij -> 'j', r.j ->> 'solicita', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'cambio_res', r.j ->> 'id', r.j ->> 'ini', 'Tu solicitud de ' || lower(coalesce(r.j ->> 'tipo', '')) || ' fue ' || lower(coalesce(r.j ->> 'estado', '')) || ' · ' || public.apih_cut(coalesce(nullif(r.j ->> 'desc', ''), r.j ->> 'id'), 60), r.j ->> 'fDec'); end if;
    end if;
  end loop;
  -- eventos de la bitácora (últimos 14 días; no avisan al autor del cambio)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{' and coalesce(substr(datos, 4)::jsonb ->> 'ini', '') <> '' loop
    ts := left(coalesce(r.j ->> 'ts', ''), 10); if ts !~ '^\d{4}-\d{2}-\d{2}$' or hoy - ts::date > ventana then continue; end if;
    if public.apih_norm(r.j ->> 'autor') = u then continue; end if;
    ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; t := coalesce(r.j ->> 'texto', ''); tit := ij -> 'j' ->> 'titulo'; ijj := ij -> 'j';
    if r.j ->> 'tipo' = 'Comentario' and t !~ '^Estrella Michelin' and public.apih_aviso_aplica(P -> 'ev_comentario', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_comentario', r.j ->> 'id', r.j ->> 'ini', (r.j ->> 'autor') || ': «' || public.apih_cut(t, 90) || '» · ' || tit, ts); end if;
    if r.j ->> 'tipo' = 'Cambio' and t ~ '^Cambio de fase' and public.apih_aviso_aplica(P -> 'ev_fase', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_fase', r.j ->> 'id', r.j ->> 'ini', tit || ': ' || regexp_replace(regexp_replace(t, '^Cambio de fase: ', ''), ' \(forzado.*$', ''), ts); end if;
    if r.j ->> 'tipo' = 'Cambio' and t ~ '^RAG .*→ Rojo' and public.apih_aviso_aplica(P -> 'ev_rag', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_rag', r.j ->> 'id', r.j ->> 'ini', tit || ': ' || t, ts); end if;
    if r.j ->> 'tipo' = 'Edición' and coalesce((P -> 'ev_asigna' ->> 'on')::boolean, false) then
      -- «Hito «x» — Responsable: a → b | Dueño: c → d»: se leen las filas «campo: antes → después»
      m := regexp_match(t, '^(Hito|Riesgo|Decisión|Compromiso|Cambio) «(.*?)» — ');
      body := case when m is not null then regexp_replace(t, '^(Hito|Riesgo|Decisión|Compromiso|Cambio) «(.*?)» — ', '') else t end;
      ent := coalesce(m[2], ''); kind := coalesce(m[1], 'Iniciativa'); valid := true;
      foreach parte in array string_to_array(body, ' | ') loop
        a := strpos(parte, ': '); b := strpos(parte, ' → ');
        if not (a > 1 and b > a) then valid := false; end if;
      end loop;
      if valid then
        foreach parte in array string_to_array(body, ' | ') loop
          a := strpos(parte, ': '); b := strpos(parte, ' → '); f1 := left(parte, a - 1); f2 := substr(parte, a + 2, b - a - 2); f3 := substr(parte, b + 3);
          if f1 ~ '^(Responsable|Dueño)$' and public.apih_norm(f3) = u then
            avs := avs || public.apih_aviso_mk(tipos, 'ev_asigna', (r.j ->> 'id') || f1, r.j ->> 'ini',
              case when ent <> '' then kind || ' «' || ent || '»' else tit end || ': ahora eres ' || case when f1 = 'Dueño' then 'dueño' else 'responsable' end || ' (antes ' || f2 || ') · ' || tit, ts);
          end if;
        end loop;
      end if;
    end if;
  end loop;
  -- canales por los que se entrega cada aviso: los activos para la persona (la app siempre; correo y Teams solo si la organización los habilitó)
  select coalesce(jsonb_agg(q || jsonb_build_object('canales', (
           select coalesce(jsonb_agg(c2 ->> 0), '[]'::jsonb) from jsonb_array_elements(cat -> 'canales') c2
            where coalesce((P -> (q ->> 'tipo') -> 'canales' ->> (c2 ->> 0))::boolean, false) and ((c2 ->> 0) = 'app' or coalesce((canalon ->> (c2 ->> 0))::boolean, false))))
         order by q ->> 'ts' desc, (q ->> 'sev')::int desc), '[]'::jsonb) into avs from jsonb_array_elements(avs) q;
  return jsonb_build_object('catalogo', cat, 'prefs', P, 'avisos', avs);
end $$;
revoke all on function public.apih_avisos(jsonb), public.apih_notif_pref(text, text), public.apih_aviso_aplica(jsonb, jsonb, text, text, boolean) from public, anon, authenticated;

-- apih_calculos entrega también los avisos
create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c), 'notif', public.apih_avisos(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028001800_resumen.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5f · Definiciones del resumen ejecutivo y de los KPIs: en el servidor
--   «On track» (proyecto activo en verde y sin atraso), los tramos de lectura del % On Track (con su texto) y las ventanas de días
--   que usa el resumen. apih_calculos() los entrega en «resumen»; la SPA solo cuenta, suma y muestra.
-- =====================================================================================
create or replace function public.apih_resumen(c jsonb) returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'ontrack', coalesce((select jsonb_object_agg(r.id, coalesce(substr(r.datos, 4)::jsonb ->> 'rag', '') = 'Verde' and not coalesce((c -> 'ini' -> r.id ->> 'atrasado')::boolean, false))
                            from public.registros_v r
                           where r.lista = 'APIH_Proyectos' and left(substr(r.datos, 4), 1) = '{'
                             and substr(r.datos, 4)::jsonb ->> 'estado' = 'En curso' and substr(r.datos, 4)::jsonb ->> 'fase' in ('Planificación', 'Ejecución', 'Transición')
                             and coalesce(substr(r.datos, 4)::jsonb ->> 'tipo', '') <> 'Propuesta'), '{}'::jsonb),
     'tonos', jsonb_build_array(
        jsonb_build_object('desde', 60, 'nivel', 'good', 'txt', 'avanza de forma sólida'),
        jsonb_build_object('desde', 35, 'nivel', 'warn', 'txt', 'avanza con focos de atención'),
        jsonb_build_object('desde', 0,  'nivel', 'bad',  'txt', 'requiere atención ejecutiva inmediata')),
     'ventanas', jsonb_build_object('hitosDias', 30, 'cierreDias', 45, 'proximosDias', 30)) $$;
revoke all on function public.apih_resumen(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028001900_personas_dir.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5g · Directorio de personas y roles: se calcula en el servidor
--   Quién participa en el portafolio, con qué roles y qué tiene abierto (proyectos, hitos, riesgos, decisiones, acciones).
--   Fuente de acceso/cargo/áreas: tabla de perfiles. apih_calculos() lo entrega en «personas»; la SPA solo filtra y muestra.
-- =====================================================================================
create or replace function public.apih_personas_dir() returns jsonb language sql stable security definer set search_path = public as
$$ with hoy as materialized (select public.apih_hoy() d),
 reg as materialized (select r.lista, r.id, substr(r.datos, 4)::jsonb j from public.registros_v r
                       where r.lista in ('APIH_Proyectos', 'APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Comites') and left(substr(r.datos, 4), 1) = '{'),
 ini as materialized (select id, j from reg where lista = 'APIH_Proyectos'),
 sb as materialized (select id from ini where j ->> 'estado' = 'Stand By'),
 nm(txt, kind, ref, rol) as (
   select j ->> 'lider', 'lider', id, case when j ->> 'tipo' = 'Propuesta' then 'Líder de propuesta' else 'Líder de proyecto' end from ini where id not in (select id from sb)
   union all select j ->> 'sponsor', 'sponsor', id, 'Sponsor' from ini where id not in (select id from sb)
   union all select j ->> 'negocio', 'negocio', id, 'Negocio' from ini where id not in (select id from sb)),
 pn as (select trim(n) n, kind, ref, rol from nm, regexp_split_to_table(coalesce(txt, ''), '\s+-\s+|,') n where trim(n) <> ''),
 vivo as (select id from ini where id not in (select id from sb)
            and j ->> 'estado' <> all (case when j ->> 'tipo' = 'Propuesta' then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end)),
 ev(n, rol, area, cargo, acceso, lidera, hitos, hatr, riesgos, decis, acc) as materialized (
   select coalesce(nullif(p.nombre, ''), p.email), null, a, p.cargo, p.app_rol, 0, 0, 0, 0, 0, 0
     from public.perfiles p left join lateral regexp_split_to_table(coalesce(array_to_string(p.areas, ','), ''), ',') a on true where p.activo
   union all select pn.n, pn.rol, null, null, null, case when pn.kind = 'lider' and pn.rol = 'Líder de proyecto' and pn.ref in (select id from vivo) then 1 else 0 end, 0, 0, 0, 0, 0 from pn
   union all select pn.n, null, trim(a), null, null, 0, 0, 0, 0, 0, 0
     from pn join ini on ini.id = pn.ref, regexp_split_to_table(coalesce(ini.j ->> 'area', ''), ',') a where pn.kind = 'lider'
   union all select pn.n, null, trim(split_part(coalesce(ini.j ->> 'area', ''), ',', 1)), null, null, 0, 0, 0, 0, 0, 0
     from pn join ini on ini.id = pn.ref where pn.kind = 'sponsor'
   union all select h ->> 'resp', 'Responsable de hito', null, null, null, 0, case when coalesce((h ->> 'completado')::boolean, false) then 0 else 1 end,
          case when not coalesce((h ->> 'completado')::boolean, false) and h ->> 'fecha' < (select d::text from hoy) then 1 else 0 end, 0, 0, 0
     from (select j h from reg where lista = 'APIH_Hitos') q
    where coalesce(h ->> 'resp', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select h ->> 'dueno', 'Dueño de riesgo', null, null, null, 0, 0, 0, case when coalesce(h ->> 'estado', '') <> 'Cerrado' then 1 else 0 end, 0, 0
     from (select j h from reg where lista = 'APIH_Riesgos') q
    where coalesce(h ->> 'dueno', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select h ->> 'solicita', 'Solicita decisiones', null, null, null, 0, 0, 0, 0, case when h ->> 'estado' = 'Pendiente' then 1 else 0 end, 0
     from (select j h from reg where lista = 'APIH_Decisiones') q
    where coalesce(h ->> 'solicita', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select x ->> 'n', 'Comité', null, x ->> 'rol', null, 0, 0, 0, 0, 0, 0
     from (select j c from reg where lista = 'APIH_Comites') q,
          jsonb_array_elements(coalesce(c -> 'participantes', '[]'::jsonb)) x where coalesce(x ->> 'n', '') <> ''
   union all select a ->> 'resp', null, null, null, null, 0, 0, 0, 0, 0, case when a ->> 'estado' in ('Abierta', 'Abierto') then 1 else 0 end
     from (select j c from reg where lista = 'APIH_Comites') q,
          jsonb_array_elements(coalesce(c -> 'acciones', '[]'::jsonb) || coalesce(c -> 'compromisos', '[]'::jsonb)) a where coalesce(a ->> 'resp', '') <> ''),
 rc as materialized (select n, rol, count(*) k from ev where rol is not null group by n, rol)
 select coalesce(jsonb_agg(jsonb_build_object('n', g.n, 'cargo', g.cargo, 'acceso', g.acceso,
          'areas', coalesce(ar.a, '[]'::jsonb), 'roles', coalesce(rr.r, '{}'::jsonb),
          'lidera', g.lidera, 'hitos', g.hitos, 'hitosAtr', g.hatr, 'riesgos', g.riesgos, 'decis', g.decis, 'acc', g.acc) order by g.n), '[]'::jsonb)
   from (select e.n, coalesce(max(nullif(e.cargo, '')) filter (where e.rol is null), max(nullif(e.cargo, ''))) cargo, coalesce(max(e.acceso), '') acceso,
                sum(e.lidera) lidera, sum(e.hitos) hitos, sum(e.hatr) hatr, sum(e.riesgos) riesgos, sum(e.decis) decis, sum(e.acc) acc
           from ev e where e.n is not null and e.n <> '' group by e.n) g
   left join (select n, jsonb_agg(a order by a) a from (select distinct n, trim(area) a from ev where coalesce(trim(area), '') <> '') x group by n) ar on ar.n = g.n
   left join (select n, jsonb_object_agg(rol, k) r from rc group by n) rr on rr.n = g.n $$;
revoke all on function public.apih_personas_dir() from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c), 'personas', public.apih_personas_dir()); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028002000_mision.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5h · Mi cocina: la «misión» (qué hay que atender) sale del servidor
--   Por iniciativa: hitos vencidos sin cerrar, compromisos con fecha vencida y riesgos por atender
--   (revisión vencida o crítico sin mitigación). apih_calculos() lo entrega en «mision»; la SPA solo arma los textos.
-- =====================================================================================
create or replace function public.apih_mision(c jsonb) returns jsonb language sql stable security definer set search_path = public as
$$ with hoy as materialized (select public.apih_hoy()::text d),
 reg as materialized (select r.lista, r.id, substr(r.datos, 4)::jsonb j from public.registros_v r
                       where r.lista in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Compromisos') and left(substr(r.datos, 4), 1) = '{'),
 hv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'nombre', j ->> 'nombre', 'fecha', j ->> 'fecha') x, j ->> 'fecha' f
          from reg, hoy where lista = 'APIH_Hitos' and coalesce(j ->> 'fecha', '') <> '' and j ->> 'fecha' < hoy.d
           and not (coalesce((j ->> 'completado')::boolean, false) and coalesce(j ->> 'fechaReal', '') <= hoy.d)),
 cv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'texto', j ->> 'texto', 'resp', j ->> 'resp', 'limite', j ->> 'limite') x, j ->> 'limite' f
          from reg, hoy where lista = 'APIH_Compromisos' and coalesce(j ->> 'estado', '') not in ('Cancelado', 'Cumplido')
           and coalesce(j ->> 'limite', '') <> '' and j ->> 'limite' < hoy.d),
 rv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'desc', j ->> 'desc', 'fRev', j ->> 'fRev', 'expo', c -> 'riesgos' -> id -> 'expo',
                 'por', case when coalesce(j ->> 'fRev', '') <> '' and j ->> 'fRev' < hoy.d then 'rev' else 'crit' end) x, id f
          from reg, hoy where lista = 'APIH_Riesgos' and coalesce(j ->> 'estado', '') <> 'Cerrado'
           and ((coalesce(j ->> 'fRev', '') <> '' and j ->> 'fRev' < hoy.d)
                or (coalesce((c -> 'riesgos' -> id ->> 'critico')::boolean, false) and trim(coalesce(j ->> 'mit', '')) = '')))
 select coalesce(jsonb_object_agg(k, jsonb_build_object(
          'hit', coalesce((select jsonb_agg(x order by f) from hv where hv.ini = k), '[]'::jsonb),
          'cmp', coalesce((select jsonb_agg(x order by f) from cv where cv.ini = k), '[]'::jsonb),
          'rsk', coalesce((select jsonb_agg(x order by f) from rv where rv.ini = k), '[]'::jsonb))), '{}'::jsonb)
   from jsonb_object_keys(coalesce(c -> 'ini', '{}'::jsonb)) k $$;
revoke all on function public.apih_mision(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c), 'personas', public.apih_personas_dir(), 'mision', public.apih_mision(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;

-- ===== 20261028002100_pasos.sql =====
-- =====================================================================================
-- APIH Prototipo · Iter 5i · «Siguientes pasos»: qué conviene hacer en cada iniciativa, calculado en el servidor
--   Hitos vencidos/de hoy/de la semana, tenedor «Al día», riesgos (mitigación, revisión), compromisos por vencer y compuerta de fase.
--   apih_cielo() lo entrega en «pasos» (id → lista). La SPA solo aplica las preferencias personales (ocultar, ajustar importancia) y pinta.
--   u: 0 hoy · 1 esta semana · 2 próximo.
-- =====================================================================================
create or replace function public.apih_fzd(d text, hoy date) returns text language sql immutable as
$$ select case when coalesce(d, '') ~ '^\d{4}-\d{2}-\d{2}' then substr(d, 9, 2) || '-' || substr(d, 6, 2) || case when substr(d, 1, 4) <> to_char(hoy, 'YYYY') then '-' || substr(d, 3, 2) else '' end else '—' end $$;

create or replace function public.apih_pasos(calc jsonb, ctx jsonb, mp jsonb, proy jsonb, hoy date) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hd text := hoy::text; out jsonb := '{}'::jsonb; k text; j jsonb; arr jsonb; x jsonb; es_prop boolean; hecho boolean; vivo boolean; ff text[]; ix int; nx text;
  dow int; n int; sig jsonb; falta jsonb; cerca boolean; ven jsonb; vfin text; nv jsonb; ex numeric; lbl text; dia_off boolean; tip text; kk int;
begin
  for k, j in select key, value from jsonb_each(coalesce(mp, '{}'::jsonb)) loop
    es_prop := (j ->> 'tipo') = 'Propuesta';
    hecho := (j ->> 'estado') = any (case when es_prop then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end);
    continue when hecho;
    vivo := (j ->> 'estado') <> 'Stand By';
    arr := '[]'::jsonb;
    -- hitos abiertos
    for x in select h from jsonb_array_elements(coalesce(ctx -> 'hit' -> k, '[]'::jsonb)) h
              where not coalesce((h ->> 'completado')::boolean, false) and coalesce(h ->> 'fecha', '') <> '' order by h ->> 'fecha' loop
      if x ->> 'fecha' < hd then
        arr := arr || jsonb_build_object('k', k || ':hv' || (x ->> 'id'), 'u', 0, 'tipo', 'Hito vencido', 't', 'Cierra o reprograma «' || (x ->> 'nombre') || '»',
          'por', 'Venció hace ' || (hoy - (x ->> 'fecha')::date) || ' d. Mientras siga abierto, el indicador de Hitos queda en rojo.', 'prot', 'Hitos', 'btn', 'Editar hito', 'act', 'edit',
          'd', jsonb_build_object('t', 'hito', 'id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
      elsif x ->> 'fecha' = hd then
        arr := arr || jsonb_build_object('k', k || ':hh' || (x ->> 'id'), 'u', 0, 'tipo', 'Hito', 't', 'Marca «' || (x ->> 'nombre') || '» como cumplido', 'por', 'Vence hoy.', 'prot', 'Hitos',
          'btn', 'Marcar cumplido', 'act', 'hitotoggle', 'd', jsonb_build_object('id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
      end if;
    end loop;
    for x in select h from jsonb_array_elements(coalesce(ctx -> 'hit' -> k, '[]'::jsonb)) h
              where not coalesce((h ->> 'completado')::boolean, false) and (h ->> 'fecha') > hd and (h ->> 'fecha')::date - hoy <= 7 order by h ->> 'fecha' limit 3 loop
      arr := arr || jsonb_build_object('k', k || ':hs' || (x ->> 'id'), 'u', 1, 'tipo', 'Hito', 't', 'Prepara «' || (x ->> 'nombre') || '» (' || public.apih_fzd(x ->> 'fecha', hoy) || ')',
        'por', 'Vence en ' || ((x ->> 'fecha')::date - hoy) || ' d' || case when coalesce(x ->> 'resp', '') <> '' then ' · ' || (x ->> 'resp') else '' end || '.', 'prot', 'Hitos', 'btn', 'Ver hito', 'act', 'sel',
        'd', jsonb_build_object('t', 'hito', 'id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
    end loop;
    -- tenedor «Al día»
    if vivo and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and not es_prop and coalesce(proy -> k -> 'st' ->> 'dia', '') = 'off' then
      dow := extract(dow from hoy)::int;
      tip := case when coalesce((proy -> k ->> 'tope')::boolean, false) then 'Llevas 3 semanas actualizando sin avance real: sube el % de avance o cierra un hito y se enciende.'
                  else 'Actualiza el proyecto esta semana (avance, logros o próximos pasos).' end;
      arr := arr || jsonb_build_object('k', k || ':dia', 'u', case when dow >= 5 or dow = 0 then 0 else 1 end, 'tipo', 'Tenedor «Al día»', 't', 'Registra la actualización semanal', 'por', tip, 'prot', 'Al día',
        'btn', 'Actualizar', 'act', 'wk', 'd', jsonb_build_object('id', k), 'f', hd);
    end if;
    -- riesgos abiertos
    for x in select r from jsonb_array_elements(coalesce(ctx -> 'rsk' -> k, '[]'::jsonb)) r order by r ->> 'id' loop
      ex := coalesce((calc -> 'riesgos' -> (x ->> 'id') ->> 'expo')::numeric, 0); nv := calc -> 'riesgos' -> (x ->> 'id') -> 'nivel';
      if coalesce((x ->> '_crit')::boolean, false) and trim(coalesce(x ->> 'mit', '')) = '' then
        arr := arr || jsonb_build_object('k', k || ':rm' || (x ->> 'id'), 'u', 0, 'tipo', 'Riesgo crítico', 't', 'Define la mitigación de «' || (x ->> 'desc') || '»',
          'por', 'Crítico (' || ex || ') sin plan de mitigación: el indicador de Riesgos queda en rojo y se bloquean compuertas.', 'prot', 'Riesgos', 'btn', 'Editar riesgo', 'act', 'edit',
          'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', hd);
      elsif coalesce(x ->> 'fRev', '') <> '' and x ->> 'fRev' < hd then
        arr := arr || jsonb_build_object('k', k || ':rv' || (x ->> 'id'), 'u', 0, 'tipo', 'Riesgo', 't', 'Revisa el riesgo «' || (x ->> 'desc') || '»',
          'por', 'La revisión venció el ' || public.apih_fzd(x ->> 'fRev', hoy) || '. Mientras no se revise, el indicador de Riesgos queda en rojo.', 'prot', 'Riesgos', 'btn', 'Editar riesgo', 'act', 'edit',
          'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', x ->> 'fRev');
      elsif coalesce(x ->> 'fRev', '') <> '' and (x ->> 'fRev')::date - hoy <= 7 then
        arr := arr || jsonb_build_object('k', k || ':rs' || (x ->> 'id'), 'u', case when x ->> 'fRev' = hd then 0 else 1 end, 'tipo', 'Riesgo ' || lower(coalesce(nv ->> 'n', '')),
          't', 'Prepara la revisión de «' || (x ->> 'desc') || '» (' || public.apih_fzd(x ->> 'fRev', hoy) || ')',
          'por', coalesce(nv ->> 'n', '') || ' (' || ex || ')' || case when trim(coalesce(x ->> 'mit', '')) <> '' then '. Mitigación: ' || public.apih_cut(x ->> 'mit', 90) else '.' end,
          'prot', 'Riesgos', 'btn', 'Abrir riesgo', 'act', 'sel', 'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', x ->> 'fRev');
      end if;
    end loop;
    -- compromisos por vencer
    for x in select c from jsonb_array_elements(coalesce(ctx -> 'cmp' -> k, '[]'::jsonb)) c
              where coalesce(c ->> 'estado', '') not in ('Cumplido', 'Cancelado') and coalesce(c ->> 'limite', '') <> '' and (c ->> 'limite')::date - hoy <= 7 order by c ->> 'id' loop
      arr := arr || jsonb_build_object('k', k || ':c' || (x ->> 'id'), 'u', case when x ->> 'limite' <= hd then 0 else 1 end, 'tipo', 'Compromiso',
        't', case when x ->> 'limite' < hd then 'Cumple el compromiso vencido «' else 'Cumple «' end || public.apih_cut(coalesce(nullif(x ->> 'texto', ''), nullif(x ->> 'titulo', ''), 'compromiso'), 70) || '»',
        'por', case when x ->> 'limite' < hd then 'Venció el ' else 'Vence el ' end || public.apih_fzd(x ->> 'limite', hoy) || case when coalesce(x ->> 'resp', '') <> '' then ' · ' || (x ->> 'resp') else '' end || '.',
        'prot', 'Compromisos', 'btn', 'Ver compromisos', 'act', 'go', 'd', jsonb_build_object('v', 'compromisos'), 'f', x ->> 'limite');
    end loop;
    -- compuerta de la fase
    ff := public.apih_fases(es_prop); ix := array_position(ff, j ->> 'fase');
    if ix is not null and ix < cardinality(ff) then
      nx := ff[ix + 1]; sig := coalesce(calc -> 'ini' -> k -> 'sig', '[]'::jsonb);
      select jsonb_agg(g) into falta from jsonb_array_elements(sig) g where not coalesce((g ->> 'ok')::boolean, false);
      if falta is null then
        arr := arr || jsonb_build_object('k', k || ':adv', 'u', 0, 'tipo', 'Compuerta', 't', 'Avanza a ' || nx, 'por', 'Se cumplen todas las condiciones de la compuerta.', 'prot', 'Compuerta', 'btn', 'Avanzar', 'act', 'advance',
          'd', jsonb_build_object('id', k), 'f', hd, 'nr', jsonb_build_object('fase', j ->> 'fase'));
      else
        select v ->> 'fin' into vfin from jsonb_array_elements(coalesce(calc -> 'ini' -> k -> 'ventanas', '[]'::jsonb)) v where v ->> 'fase' = j ->> 'fase' limit 1;
        cerca := coalesce(vfin, '') <> '' and vfin::date - hoy <= 7;
        kk := 0;
        for x in select g from jsonb_array_elements(falta) g where (g ->> 't') !~ '^Hitos de la fase' loop
          arr := arr || jsonb_build_object('k', k || ':g' || kk, 'u', case when cerca then 1 else 2 end, 'tipo', 'Compuerta',
            't', 'Para pasar a ' || nx || ': ' || lower(left(x ->> 't', 1)) || substr(x ->> 't', 2),
            'por', 'Condición pendiente de la compuerta' || case when coalesce(vfin, '') <> '' then '; la fase ' || (j ->> 'fase') || ' cierra el ' || public.apih_fzd(vfin, hoy) else '' end || '.',
            'prot', 'Compuerta', 'btn', case when es_prop then 'Editar propuesta' else 'Editar proyecto' end, 'act', 'edit', 'd', jsonb_build_object('t', 'ini', 'id', k), 'f', hd,
            'nr', jsonb_build_object('fase', j ->> 'fase'));
          kk := kk + 1;
        end loop;
      end if;
    end if;
    out := out || jsonb_build_object(k, coalesce((select jsonb_agg(a order by (a ->> 'u'), (a ->> 'f')) from jsonb_array_elements(arr) a), '[]'::jsonb));
  end loop;
  return out;
end $$;
revoke all on function public.apih_pasos(jsonb, jsonb, jsonb, jsonb, date) from public, anon, authenticated;
