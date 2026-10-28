-- =====================================================================================
-- APIH Prototipo · Iter 7 · Consumo de presupuesto y documentación por comando del servidor
--   apih_registrar_consumo(p_id, p_gastado, p_nota)  actualiza lo consumido a la fecha (misión del mes «Presupuesto»)
--   apih_confirmar_consumo(p_id)                      confirma que el consumo sigue igual
--   apih_guardar_documento(p_ini, p_id, p_datos)      agrega o edita un vínculo de OneDrive/SharePoint
--   apih_quitar_documento(p_id)                       lo quita de la documentación (el archivo no se borra)
-- =====================================================================================
create or replace function public.apih_fmt_n(n numeric) returns text language sql immutable as
$$ select case when coalesce(n, 0) < 0 then '-' else '' end || reverse(regexp_replace(reverse(abs(round(coalesce(n, 0)))::text), '(\d{3})(?=\d)', '\1.', 'g')) $$;

create or replace function public.apih_registrar_consumo(p_id text, p_gastado numeric, p_nota text default null) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; a numeric; nt text := btrim(coalesce(p_nota, ''));
begin
  ir := public.apih_puede_ini(p_id); i := substr(ir.datos, 4)::jsonb;
  if not public.apih_ve_montos() then raise exception 'APIH: tu rol no registra montos' using errcode = '42501'; end if;
  if p_gastado is null or p_gastado < 0 then perform public.apih_err('el consumo debe ser un número mayor o igual a 0', 'gastado'); end if;
  if length(nt) > 1000 then perform public.apih_err('el comentario admite hasta 1000 caracteres', 'nota'); end if;
  a := coalesce(nullif(i ->> 'gastado', '')::numeric, 0);
  perform public.apih_escribir_cmd(ir.lista, p_id, i || jsonb_build_object('gastado', p_gastado));
  perform public.apih_bitacora_cmd(p_id, case when a <> p_gastado then 'Cambio' else 'Comentario' end,
    '[Misión del mes · Presupuesto] Consumido ' || public.apih_fmt_n(a) || ' → ' || public.apih_fmt_n(p_gastado) || ' de ' || public.apih_fmt_n(nullif(i ->> 'presupuesto', '')::numeric)
    || case when nt <> '' then '. ' || nt else '' end);
  return jsonb_build_object('id', p_id, 'gastado', p_gastado);
end $$;
revoke all on function public.apih_registrar_consumo(text, numeric, text) from public, anon;
grant execute on function public.apih_registrar_consumo(text, numeric, text) to authenticated;

create or replace function public.apih_confirmar_consumo(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb;
begin
  ir := public.apih_puede_ini(p_id); i := substr(ir.datos, 4)::jsonb;
  perform public.apih_bitacora_cmd(p_id, 'Comentario', '[Misión del mes · Presupuesto] Consumo confirmado sin cambios (' || public.apih_fmt_n(nullif(i ->> 'gastado', '')::numeric) || ' de ' || public.apih_fmt_n(nullif(i ->> 'presupuesto', '')::numeric) || ')');
  return jsonb_build_object('id', p_id);
end $$;
revoke all on function public.apih_confirmar_consumo(text) from public, anon;
grant execute on function public.apih_confirmar_consumo(text) to authenticated;

create or replace function public.apih_guardar_documento(p_ini text, p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; d jsonb := '{}'::jsonb; per public.perfiles; host text;
  nm text := btrim(coalesce(p_datos ->> 'nombre', '')); u text := btrim(coalesce(p_datos ->> 'url', '')); tp text := coalesce(public.apih_txt(p_datos, 'tipo'), 'Otro'); nt text := btrim(coalesce(p_datos ->> 'nota', '')); did text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if public.apih_solo_lectura() then raise exception 'APIH: tu rol o el modo solo lectura no permiten editar documentos' using errcode = '42501'; end if;
  select * into per from public.perfiles where email = public.apih_email();
  if nw then
    ir := public.apih_ini(p_ini);
    if ir.id is null then perform public.apih_err('la iniciativa no existe', 'nombre'); end if;
    if not (public.apih_edita_area(ir.area) or public.apih_gobierna()) then raise exception 'APIH: no puedes agregar documentos a esta iniciativa' using errcode = '42501'; end if;
  else
    select * into r from public.registros where lista = 'APIH_Documentos' and id = p_id for update;
    if not found then raise exception 'APIH: el documento % no existe', p_id using errcode = 'P0002'; end if;
    d := substr(r.datos, 4)::jsonb; ir := public.apih_ini(d ->> 'ini');
    if not (lower(coalesce(d ->> 'correo', '')) = public.apih_email() or public.apih_gobierna() or per.rol = 'admin') then raise exception 'APIH: solo quien lo agregó o el PMO puede editarlo' using errcode = '42501'; end if;
  end if;
  if nm = '' then perform public.apih_err('ponle un nombre al documento', 'nombre'); end if;
  if length(nm) > 200 then perform public.apih_err('el nombre admite hasta 200 caracteres', 'nombre'); end if;
  if tp not in ('Acta', 'Contrato', 'RFP', 'Especificación', 'Informe', 'Presupuesto', 'Otro') then perform public.apih_err('tipo de documento inválido', 'tipo'); end if;
  if length(nt) > 1000 then perform public.apih_err('la nota admite hasta 1000 caracteres', 'nota'); end if;
  host := lower(substring(u from '^https://([^/:?#]+)'));
  if host is null or host !~ '(^|\.)(sharepoint\.com|1drv\.ms|onedrive\.live\.com|office\.com|microsoft\.com)$' then
    perform public.apih_err('el vínculo debe ser de OneDrive o SharePoint (https://…sharepoint.com, 1drv.ms)', 'url'); end if;
  if nw then
    did := 'DOC-' || upper(to_char(clock_timestamp(), 'YYMMDDHH24MISSUS')) || upper(substr(md5(random()::text), 1, 3));
    d := jsonb_build_object('id', did, 'ini', p_ini, 'autor', coalesce(nullif(per.nombre, ''), per.email), 'correo', per.email,
           'ts', public.apih_hoy()::text || 'T' || to_char(now() at time zone 'America/Santiago', 'HH24:MI'));
  else did := p_id; end if;
  d := d || jsonb_build_object('nombre', nm, 'tipo', tp, 'url', u, 'nota', nt);
  perform public.apih_escribir('APIH_Documentos', did, d);
  perform public.apih_bitacora_cmd(d ->> 'ini', 'Cambio', case when nw then 'Documento agregado: ' || nm || ' (' || tp || ')' else 'Documento actualizado: ' || nm end);
  return jsonb_build_object('id', did);
end $$;
revoke all on function public.apih_guardar_documento(text, text, jsonb) from public, anon;
grant execute on function public.apih_guardar_documento(text, text, jsonb) to authenticated;

create or replace function public.apih_quitar_documento(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare r public.registros; d jsonb; per public.perfiles;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if public.apih_solo_lectura() then raise exception 'APIH: tu rol o el modo solo lectura no permiten editar documentos' using errcode = '42501'; end if;
  select * into per from public.perfiles where email = public.apih_email();
  select * into r from public.registros where lista = 'APIH_Documentos' and id = p_id for update;
  if not found then raise exception 'APIH: el documento % no existe', p_id using errcode = 'P0002'; end if;
  d := substr(r.datos, 4)::jsonb;
  if not (lower(coalesce(d ->> 'correo', '')) = public.apih_email() or public.apih_gobierna() or per.rol = 'admin') then raise exception 'APIH: solo quien lo agregó o el PMO puede quitarlo' using errcode = '42501'; end if;
  delete from public.registros where lista = 'APIH_Documentos' and id = p_id;
  perform public.apih_bitacora_cmd(d ->> 'ini', 'Cambio', 'Documento quitado: ' || coalesce(d ->> 'nombre', p_id));
  return jsonb_build_object('id', p_id);
end $$;
revoke all on function public.apih_quitar_documento(text) from public, anon;
grant execute on function public.apih_quitar_documento(text) to authenticated;
