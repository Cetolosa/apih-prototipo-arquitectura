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
