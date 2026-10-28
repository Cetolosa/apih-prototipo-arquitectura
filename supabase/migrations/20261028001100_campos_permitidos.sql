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
