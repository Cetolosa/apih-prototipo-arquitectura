-- =====================================================================================
-- APIH Prototipo · Iter 5k · Cargas por lote (Excel de planificación y «Completar con archivo»)
--   El navegador lee el archivo y arma la lista de cambios; el servidor los aplica fila por fila con las MISMAS reglas y permisos
--   que los formularios (apih_guardar_iniciativa / apih_guardar_hito / apih_guardar_riesgo). Una fila inválida se omite y se informa;
--   las demás se aplican. Una sola anotación en la bitácora resume la carga.
--     apih_cargar_lote(p_origen, p_ini, p_items) → {ok, errores[], avisos[]}
--     p_items: [{k:'ini'|'hito'|'riesgo', id: texto|null, datos: {...}}]   (id nulo = alta)
-- =====================================================================================
create or replace function public.apih_cargar_lote(p_origen text, p_ini text, p_items jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare it jsonb; n int := 0; errs jsonb := '[]'::jsonb; avs jsonb := '[]'::jsonb; r jsonb; cuerpo text; nh int := 0; nr int := 0; np int := 0;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'APIH: la carga debe ser una lista' using errcode = '22023'; end if;
  if jsonb_array_length(p_items) > 2000 then raise exception 'APIH: la carga supera 2000 filas' using errcode = '22023'; end if;
  for it in select x from jsonb_array_elements(p_items) x loop
    begin
      case it ->> 'k'
        when 'ini'    then r := public.apih_guardar_iniciativa(nullif(it ->> 'id', ''), null, coalesce(it -> 'datos', '{}'::jsonb)); np := np + 1;
        when 'hito'   then r := public.apih_guardar_hito(nullif(it ->> 'id', ''), coalesce(it -> 'datos', '{}'::jsonb)); nh := nh + 1;
        when 'riesgo' then r := public.apih_guardar_riesgo(nullif(it ->> 'id', ''), coalesce(it -> 'datos', '{}'::jsonb)); nr := nr + 1;
        else raise exception 'tipo de fila desconocido (%)', it ->> 'k';
      end case;
      n := n + 1;
      if jsonb_typeof(r -> 'avisos') = 'array' then avs := avs || (r -> 'avisos'); end if;
    exception when others then
      errs := errs || to_jsonb(coalesce(it ->> 'k', '?') || ' ' || coalesce(nullif(it ->> 'id', ''), coalesce(it -> 'datos' ->> 'nombre', it -> 'datos' ->> 'desc', 'nuevo')) || ': ' || regexp_replace(sqlerrm, '^APIH:\s*', ''));
    end;
  end loop;
  if n > 0 then
    cuerpo := n || ' cambio(s) aplicados' || case when jsonb_array_length(errs) > 0 then ', ' || jsonb_array_length(errs) || ' omitidos' else '' end
              || ' (' || np || ' ficha(s), ' || nh || ' hito(s), ' || nr || ' riesgo(s))';
    perform public.apih_bitacora_cmd(nullif(p_ini, ''), 'Cambio', left(coalesce(nullif(p_origen, ''), 'Carga'), 120) || ': ' || cuerpo);
  end if;
  return jsonb_build_object('ok', n, 'errores', errs, 'avisos', avs);
end $$;
revoke all on function public.apih_cargar_lote(text, text, jsonb) from public, anon;
grant execute on function public.apih_cargar_lote(text, text, jsonb) to authenticated;
