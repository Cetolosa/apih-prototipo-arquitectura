-- =====================================================================================
-- APIH Prototipo · Iter 5l · Actualización semanal: la guarda el servidor
--   apih_actualizacion_semanal(p_id, p_datos, p_sin_novedades) → {id, avisos}
--   Valida (avance 0-100, RAG, fecha), aplica el ajuste manual de avance, RAG, fin estimado, logros, próximos pasos e issue;
--   marca la fecha de actualización, deja la foto semanal de fases/subfases (snapFase), conserva el historial de avance
--   (hist lo mantiene apih_avance_fila) y escribe la bitácora. «Sin novedades» solo confirma que el proyecto sigue vigente.
-- =====================================================================================
create or replace function public.apih_actualizacion_semanal(p_id text, p_datos jsonb default '{}'::jsonb, p_sin_novedades boolean default false) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); ir public.registros; i0 jsonb; i jsonb; d jsonb := coalesce(p_datos, '{}'::jsonb); diffs text[] := '{}'; av_n numeric; av_o numeric; rag_n text; fin_n text; txt text;
  patch jsonb; est jsonb; v jsonb; snap jsonb; w jsonb; ef numeric; k text; tx text; fase_av numeric; sf jsonb; nh int; dn int;
begin
  ir := public.apih_puede_ini(p_id);
  if ir.lista is distinct from 'APIH_Proyectos' then raise exception 'APIH: la actualización semanal es de proyectos' using errcode = '22023'; end if;
  i0 := substr(ir.datos, 4)::jsonb; i := i0;
  if i0 ->> 'estado' in ('Completado', 'Cancelado') then raise exception 'APIH: el proyecto está cerrado' using errcode = '22023'; end if;
  if p_sin_novedades then
    txt := 'Actualización semanal: sin novedades, el proyecto sigue vigente';
  else
    av_o := coalesce(case when jsonb_typeof(i0 -> 'avance') = 'number' then (i0 ->> 'avance')::numeric end, 0);
    if coalesce(d ->> 'avance', '') !~ '^\d+(\.\d+)?$' or (d ->> 'avance')::numeric > 100 then perform public.apih_err('el avance va de 0 a 100', 'avance'); end if;
    av_n := (d ->> 'avance')::numeric;
    rag_n := coalesce(public.apih_txt(d, 'rag'), i0 ->> 'rag');
    if rag_n not in ('Verde', 'Ámbar', 'Rojo') then perform public.apih_err('la salud debe ser Verde, Ámbar o Rojo', 'rag'); end if;
    fin_n := coalesce(public.apih_txt(d, 'finEst'), i0 ->> 'finEst');
    if fin_n is not null and fin_n !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha de fin estimado inválida', 'finEst'); end if;
    if av_n <> av_o then diffs := array_append(diffs, 'Avance ' || round(av_o) || '% → ' || round(av_n) || '%'); end if;
    if rag_n is distinct from (i0 ->> 'rag') then diffs := array_append(diffs, 'RAG ' || coalesce(i0 ->> 'rag', '—') || ' → ' || rag_n); end if;
    if coalesce(fin_n, '') <> coalesce(i0 ->> 'finEst', '') then diffs := array_append(diffs, 'Fin estimado ' || public.apih_fmt_d(i0 ->> 'finEst') || ' → ' || public.apih_fmt_d(fin_n)); end if;
    patch := jsonb_build_object('rag', rag_n, 'finEst', fin_n, 'logros', coalesce(public.apih_txt(d, 'logros'), i0 ->> 'logros', ''), 'proximos', coalesce(d ->> 'proximos', ''), 'issue', coalesce(d ->> 'issue', ''));
    -- marcas de «estimado»: sobreviven solo las de campos que esta actualización no cambió
    est := coalesce((select jsonb_agg(x) from jsonb_array_elements(case when jsonb_typeof(i0 -> 'est') = 'array' then i0 -> 'est' else '[]'::jsonb end) x
                      where x #>> '{}' <> 'all' and patch ? (x #>> '{}') and (i0 -> (x #>> '{}')) = (patch -> (x #>> '{}'))), '[]'::jsonb);
    i := i || patch || jsonb_build_object('avanceManual', round(av_n)::int, 'est', est);
    txt := 'Actualización semanal' || case when cardinality(diffs) > 0 then ': ' || array_to_string(diffs, '; ') else ': sin cambios de indicadores' end
           || case when public.apih_txt(d, 'logros') is not null then '. Logros: ' || (d ->> 'logros') else '' end
           || case when public.apih_txt(d, 'proximos') is not null then '. Próximos: ' || (d ->> 'proximos') else '' end
           || case when public.apih_txt(d, 'issue') is not null then '. Issue: ' || (d ->> 'issue') else '' end;
  end if;
  i := i || jsonb_build_object('actualizada', hoy::text);
  perform public.apih_escribir_cmd('APIH_Proyectos', p_id, i);
  -- foto semanal de la fase actual y de cada subfase (la usa el informe para comparar con la semana anterior)
  select substr(datos, 4)::jsonb into i from public.registros where lista = 'APIH_Proyectos' and id = p_id;
  w := (select x from jsonb_array_elements(public.apih_ventanas(i, p_id, false)) x where x ->> 'fase' = i ->> 'fase' limit 1);
  ef := coalesce(case when jsonb_typeof(i -> 'avance') = 'number' then (i ->> 'avance')::numeric end, 0);
  fase_av := case when coalesce((w ->> 'unidades')::boolean, false) then (w ->> 'avance')::numeric else round(ef) end;
  snap := jsonb_build_object('F:' || (i ->> 'fase'), fase_av);
  for sf in select x from jsonb_array_elements(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' else '[]'::jsonb end) x loop
    select count(*)::int, (count(*) filter (where substr(r.datos, 4)::jsonb ->> 'completado' = 'true'))::int into nh, dn
      from public.registros r where r.lista = 'APIH_Hitos' and substr(r.datos, 4)::jsonb ->> 'ini' = p_id and substr(r.datos, 4)::jsonb ->> 'subfase' = sf ->> 'id';
    snap := snap || jsonb_build_object('s:' || (sf ->> 'id'), case when nh > 0 then round(dn::numeric / nh * 100) else 0 end);
  end loop;
  i := i || jsonb_build_object('snapFase', (select coalesce(jsonb_agg(x order by x ->> 0), '[]'::jsonb) from (
          select x from (select x from jsonb_array_elements(case when jsonb_typeof(i -> 'snapFase') = 'array' then i -> 'snapFase' else '[]'::jsonb end) x where x ->> 0 <> hoy::text
                          union all select jsonb_build_array(hoy::text, snap)) y order by x ->> 0 desc limit 26) z));
  perform public.apih_escribir_cmd('APIH_Proyectos', p_id, i);
  perform public.apih_bitacora_cmd(p_id, 'Actualización', txt);
  return jsonb_build_object('id', p_id, 'avisos', '[]'::jsonb);
end $$;
revoke all on function public.apih_actualizacion_semanal(text, jsonb, boolean) from public, anon;
grant execute on function public.apih_actualizacion_semanal(text, jsonb, boolean) to authenticated;
