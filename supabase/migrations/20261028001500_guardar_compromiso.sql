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

-- Eliminar: se agregan los compromisos
create or replace function public.apih_eliminar(p_lista text, p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; x jsonb; t text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_lista not in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Compromisos') then raise exception 'APIH: no se puede eliminar en %', p_lista using errcode = '42501'; end if;
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
                    when 'APIH_Compromisos' then 'Compromiso eliminado: ' || coalesce(x ->> 'texto', p_id)
                    else 'Decisión eliminada: ' || coalesce(x ->> 'titulo', p_id) end;
  perform public.apih_bitacora_cmd(x ->> 'ini', case p_lista when 'APIH_Riesgos' then 'Riesgo' when 'APIH_Decisiones' then 'Decisión' else 'Cambio' end, t);
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.apih_guardar_compromiso(text, jsonb) from public, anon;
grant execute on function public.apih_guardar_compromiso(text, jsonb) to authenticated;
