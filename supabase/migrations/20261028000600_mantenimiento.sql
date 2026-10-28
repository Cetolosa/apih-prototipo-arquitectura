-- =====================================================================================
-- APIH Prototipo · Iter 4a · Mantenimiento y línea base en el servidor
--   Antes la SPA marcaba decisiones escaladas, otorgaba estrellas Michelin y congelaba la línea base escribiendo ella misma.
--   Ahora lo hace el servidor, con las mismas reglas para todos y con registro en bitácora:
--     · apih_congelar_base(p_id, p_rebase)  congela (o reemplaza, solo administrador) la línea base de un proyecto
--     · apih_michelin_n(p_id)               estrellas que cumple hoy un proyecto (regla única)
--     · apih_mantener()                     marca decisiones escaladas (solo administrador) y otorga estrellas nuevas (nunca quita)
-- =====================================================================================

create or replace function public.apih_congelar_base(p_id text, p_rebase boolean default false) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare r public.registros; j jsonb; per public.perfiles; b jsonb; hs jsonb; hoy date := public.apih_hoy();
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Proyectos' and id = p_id for update;
  if not found then raise exception 'APIH: el proyecto % no existe', p_id using errcode = 'P0002'; end if;
  if public.apih_solo_lectura() or not public.apih_edita_area(r.area) then raise exception 'APIH: tu rol no permite editar' using errcode = '42501'; end if;
  if p_rebase and per.rol <> 'admin' then raise exception 'APIH: solo Administra reemplaza la línea base' using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'tipo', '') = 'Propuesta' then raise exception 'APIH: una propuesta no tiene línea base' using errcode = '22023'; end if;
  if public.apih_vacio(j, 'inicioPlan') or public.apih_vacio(j, 'finPlan') then raise exception 'APIH: define inicio y fin plan primero' using errcode = '22023'; end if;
  if j ? 'base' and jsonb_typeof(j -> 'base') = 'object' and not p_rebase then raise exception 'APIH: el proyecto ya tiene línea base' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', h ->> 'id', 'nombre', h ->> 'nombre', 'fecha', h ->> 'fecha') order by h ->> 'fecha', h ->> 'id'), '[]'::jsonb) into hs
    from (select substr(datos, 4)::jsonb h from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where h ->> 'ini' = p_id;
  b := jsonb_build_object('fecha', hoy::text, 'inicio', j -> 'inicioPlan', 'fin', j -> 'finPlan', 'pres', public.apih_num(j, 'presupuesto'),
                          'por', coalesce(nullif(per.nombre, ''), per.email), 'hitos', hs);
  if jsonb_typeof(j -> 'base') = 'object' and p_rebase then j := j || jsonb_build_object('baseHist', coalesce(case when jsonb_typeof(j -> 'baseHist') = 'array' then j -> 'baseHist' end, '[]'::jsonb) || jsonb_build_array(j -> 'base')); end if;
  j := j || jsonb_build_object('base', b);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || j::text where lista = 'APIH_Proyectos' and id = p_id;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_bitacora(p_id, 'Cambio', (case when p_rebase then 'Línea base reemplazada' else 'Línea base congelada' end)
    || ' · fin ' || to_char((b ->> 'fin')::date, 'DD-MM-YYYY') || ' · presupuesto ' || (b ->> 'pres') || ' · ' || jsonb_array_length(hs) || ' hitos');
  return b;
end $$;
revoke all on function public.apih_congelar_base(text, boolean) from public, anon;
grant execute on function public.apih_congelar_base(text, boolean) to authenticated;

-- Estrellas que cumple hoy un proyecto (0 a 3). desv_ = desvío en días (de apih_calculos).
create or replace function public.apih_michelin_n(j jsonb, p_id text, hoy date, desv_ int) returns int
language plpgsql stable security definer set search_path = public as
$$
declare hs jsonb[]; g1 jsonb[]; h jsonb; f1 text; n int := 0; cam_f boolean; cam_p boolean; mid date; hm jsonb[]; ti date; tf date; todos boolean := true; ok boolean;
  fases text[] := public.apih_fases(false);
begin
  if coalesce(j ->> 'tipo', '') = 'Propuesta' or coalesce(j ->> 'estado', '') not in ('En curso', 'Completado') then return 0; end if;
  select coalesce(array_agg(x order by x ->> 'fecha', x ->> 'id'), '{}') into hs
    from (select substr(datos, 4)::jsonb x from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where x ->> 'ini' = p_id;
  select exists (select 1 from public.registros where lista = 'APIH_Cambios' and substr(datos, 4)::jsonb ->> 'ini' = p_id and substr(datos, 4)::jsonb ->> 'estado' = 'Aprobado' and substr(datos, 4)::jsonb ->> 'tipo' = 'Fecha') into cam_f;
  select exists (select 1 from public.registros where lista = 'APIH_Cambios' and substr(datos, 4)::jsonb ->> 'ini' = p_id and substr(datos, 4)::jsonb ->> 'estado' = 'Aprobado' and substr(datos, 4)::jsonb ->> 'tipo' = 'Presupuesto') into cam_p;
  -- primera fase con hitos; si ninguno trae fase (datos importados), el primer hito del cronograma
  select f into f1 from unnest(fases) with ordinality t(f, o) where exists (select 1 from unnest(hs) x where x ->> 'fase' = f) order by o limit 1;
  if f1 is not null then g1 := array(select x from unnest(hs) x where x ->> 'fase' = f1);
  elsif coalesce(array_length(hs, 1), 0) > 0 then g1 := array[hs[1]]; else g1 := '{}'; end if;
  if coalesce(array_length(g1, 1), 0) > 0 then
    n := 1; foreach h in array g1 loop
      ok := h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f);
      if not ok then n := 0; exit; end if; end loop; end if;
  ti := public.apih_fecha(j, 'inicioPlan'); tf := public.apih_fecha(j, 'finPlan');
  if n >= 1 and ti is not null and tf is not null then
    mid := ti + ((tf - ti) / 2);
    if hoy >= mid then
      hm := array(select x from unnest(hs) x where public.apih_fecha(x, 'fecha') <= mid);
      if coalesce(array_length(hm, 1), 0) > 0 then
        todos := true; foreach h in array hm loop
          if not (h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f)) then todos := false; exit; end if; end loop;
        if todos then n := 2; end if;
      elsif desv_ <= public.apih_umbral(j, 'tolDesv') then n := 2; end if;
    end if;
  end if;
  if n >= 2 and j ->> 'estado' = 'Completado' and public.apih_num(j, 'avance') >= 100 then
    todos := true; foreach h in array hs loop
      if not (h ->> 'completado' = 'true' and (public.apih_vacio(h, 'fechaReal') or public.apih_fecha(h, 'fechaReal') <= public.apih_fecha(h, 'fecha') or cam_f)) then todos := false; exit; end if; end loop;
    if todos and (case when public.apih_num(j, 'beneficio') > 0 then public.apih_num(j, 'ahorroReal') > 0 else length(btrim(coalesce(j ->> 'resultadoNota', ''))) >= 10 end)
       and (public.apih_vacio(j, 'finReal') or tf is null or public.apih_fecha(j, 'finReal') <= tf or cam_f)
       and (not (public.apih_num(j, 'presupuesto') > 0) or public.apih_num(j, 'gastado') <= public.apih_num(j, 'presupuesto') or cam_p) then n := 3; end if;
  end if;
  return n;
end $$;
revoke all on function public.apih_michelin_n(jsonb, text, date, int) from public, anon, authenticated;

create or replace function public.apih_mantener() returns jsonb
language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); per public.perfiles; cfg jsonb := public.apih_cfg(); esc int := coalesce(nullif(cfg ->> 'decEscalaDias', '')::int, 7);
  r record; j jsonb; calc jsonb; want int; have int; k int; nesc int := 0; est jsonb := '[]'::jsonb;
  tips text[] := array['Completa a tiempo la primera fase del proyecto (o su primer hito, si no usa fases).',
                       'Sostén el ritmo hasta la mitad del plan: todos los hitos de la primera mitad cerrados a tiempo.',
                       'Cierra el proyecto a tiempo, con todos los hitos completados, dentro del presupuesto y con resultado registrado (beneficio real o resultado alcanzado).'];
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null or public.apih_solo_lectura() then return jsonb_build_object('escaladas', 0, 'estrellas', '[]'::jsonb); end if;
  perform set_config('apih.interno', 'on', true);
  -- decisiones pendientes que superan el plazo de escalamiento: se marcan una vez (lo hace el administrador)
  if per.rol = 'admin' then
    for r in select id, substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' loop
      j := r.j;
      if j ->> 'estado' = 'Pendiente' and not public.apih_vacio(j, 'limite') and (hoy - public.apih_fecha(j, 'limite')) > esc and public.apih_vacio(j, 'escalada') then
        update public.registros set datos = 'p1.' || (j || jsonb_build_object('escalada', hoy::text))::text where lista = 'APIH_Decisiones' and id = r.id;
        perform public.apih_bitacora(j ->> 'ini', 'Decisión', 'Decisión escalada a Administra: ' || (hoy - public.apih_fecha(j, 'limite')) || ' d de atraso · ' || coalesce(j ->> 'titulo', ''));
        nesc := nesc + 1;
      end if; end loop;
  end if;
  -- estrellas Michelin: se otorgan las nuevas en los proyectos que la persona puede editar; nunca se quitan
  if coalesce(cfg ->> 'cieloOn', 'true') <> 'false' then
    calc := public.apih_calculos() -> 'ini';
    for r in select id, area, substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{' loop
      j := r.j;
      continue when coalesce(j ->> 'estado', '') = 'Stand By' or coalesce(j ->> 'tipo', '') = 'Propuesta' or not public.apih_edita_area(r.area);
      want := public.apih_michelin_n(j, r.id, hoy, coalesce((calc -> r.id ->> 'desv')::int, 0));
      have := case when jsonb_typeof(j -> 'michelin') = 'array' then jsonb_array_length(j -> 'michelin') else 0 end;
      continue when want <= have;
      for k in have + 1 .. want loop j := j || jsonb_build_object('michelin', coalesce(case when jsonb_typeof(j -> 'michelin') = 'array' then j -> 'michelin' end, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('n', k, 'f', hoy::text))); end loop;
      update public.registros set datos = 'p1.' || j::text where lista = 'APIH_Proyectos' and id = r.id;
      perform public.apih_bitacora(r.id, 'Comentario', 'Estrella Michelin ' || want || ' de 3 obtenida: ' || tips[want]);
      est := est || jsonb_build_array(jsonb_build_object('id', r.id, 'titulo', j ->> 'titulo', 'n', want));
    end loop;
  end if;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('escaladas', nesc, 'estrellas', est);
end $$;
revoke all on function public.apih_mantener() from public, anon;
grant execute on function public.apih_mantener() to authenticated;
