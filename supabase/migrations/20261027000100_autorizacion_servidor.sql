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
create index if not exists registros_lista_area_idx on public.registros (lista, area);

create table if not exists public.auditoria (
  n bigserial primary key, ts timestamptz not null default now(), email text, accion text not null,
  lista text, id_registro text, area text, toco_montos boolean not null default false
);

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
