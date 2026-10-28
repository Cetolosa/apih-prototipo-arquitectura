-- =====================================================================================
-- APIH Prototipo · Iter 5j · Bitácora: autoría y hora las pone el servidor
--   Los flujos del cliente que anotan en la bitácora (log) ya no pueden firmar por otra persona ni escribir otra hora:
--   en una anotación nueva el servidor fija «autor» (la persona autenticada) y «ts» (hora de Santiago); una anotación existente
--   no cambia de autor, hora, tipo, iniciativa ni texto. Los comandos del servidor y la administración quedan fuera (ya firman bien
--   o cargan historial).
-- =====================================================================================
create or replace function public.apih_bitacora_sello() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; quien text;
begin
  if coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role', '') = 'service_role' or public.apih_rol() = 'admin' then return new; end if;
  if left(new.datos, 3) <> 'p1.' or left(substr(new.datos, 4), 1) <> '{' then return new; end if;
  jn := substr(new.datos, 4)::jsonb;
  if tg_op = 'INSERT' then
    select coalesce(nullif(p.nombre, ''), p.email) into quien from public.perfiles p where p.email = public.apih_email();
    jn := jn || jsonb_build_object('autor', coalesce(quien, public.apih_email()), 'ts', to_char(now() at time zone 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI'));
  else
    jo := substr(old.datos, 4)::jsonb;
    foreach k in array array['autor', 'ts', 'tipo', 'ini', 'texto'] loop
      if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
    end loop;
  end if;
  new.datos := 'p1.' || jn::text;
  return new;
end $$;
drop trigger if exists a_apih_bitacora_sello on public.registros;
create trigger a_apih_bitacora_sello before insert or update on public.registros for each row when (new.lista = 'APIH_Bitacora') execute function public.apih_bitacora_sello();
