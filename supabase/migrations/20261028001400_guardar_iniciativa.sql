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
