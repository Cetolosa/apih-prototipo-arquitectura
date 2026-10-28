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
  if p_lista not in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Compromisos', 'APIH_Comites', 'APIH_Cambios') then raise exception 'APIH: no se puede eliminar en %', p_lista using errcode = '42501'; end if;
  select * into r from public.registros where lista = p_lista and id = p_id for update;
  if not found then raise exception 'APIH: el registro % no existe', p_id using errcode = 'P0002'; end if;
  if p_lista = 'APIH_Comites' then
    if not public.apih_escribe(p_lista, p_id, null) then raise exception 'APIH: solo quien gobierna puede gestionar comités' using errcode = '42501'; end if;
  elsif not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área del registro' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  if p_lista = 'APIH_Cambios' and coalesce(x ->> 'estado', '') <> 'Solicitado' then raise exception 'APIH: una solicitud de cambio ya resuelta no se elimina' using errcode = '22023'; end if;
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
                    when 'APIH_Cambios' then 'Solicitud de cambio eliminada: ' || p_id
                    else 'Decisión eliminada: ' || coalesce(x ->> 'titulo', p_id) end;
  perform public.apih_bitacora_cmd(x ->> 'ini', case p_lista when 'APIH_Riesgos' then 'Riesgo' when 'APIH_Decisiones' then 'Decisión' else 'Cambio' end, t);
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.apih_comite_leer(text), public.apih_fmt_fecha(text), public.apih_viva(public.registros) from public, anon, authenticated;
revoke all on function public.apih_guardar_comite(text, jsonb), public.apih_comite_agregar(text, text, jsonb), public.apih_comite_quitar(text, text, text),
  public.apih_comite_marcar(text, text, text, boolean), public.apih_comite_sugerido(text, text), public.apih_comite_armar(text, text), public.apih_comite_cerrar(text) from public, anon;
grant execute on function public.apih_guardar_comite(text, jsonb), public.apih_comite_agregar(text, text, jsonb), public.apih_comite_quitar(text, text, text),
  public.apih_comite_marcar(text, text, text, boolean), public.apih_comite_sugerido(text, text), public.apih_comite_armar(text, text), public.apih_comite_cerrar(text) to authenticated;
