-- =====================================================================================
-- APIH Prototipo · Iter 3b · Avance y plan: los calcula y los fija SOLO el servidor
--   Antes: la SPA recalculaba el avance (hitos y subfases), repartía las fechas de las fases, reprogramaba el plan al cambiar de fase
--   y escribía el resultado. Ahora:
--     · apih_fila (disparador de proyectos) deriva inicioPlan/finPlan de las fechas de fase, reparte/reescala las fases cuando cambia el rango
--       y deja avance / avanceCalc / hist al día en CADA escritura (nadie los escribe por separado)
--     · un disparador sobre hitos refresca el avance del proyecto sin tocar su versión ni su autor (es un valor derivado)
--     · apih_ventanas        ventana de cada fase (fechas explícitas o derivadas de los hitos) con su avance
--     · apih_plan_cambio_fase  propuesta de reprogramación al avanzar de fase (la SPA solo la muestra)
--     · apih_transicion(..., p_reprogramar)  aplica esa reprogramación en la misma transacción del cambio de fase
--     · apih_fases_fechas    comando para fijar/editar las fechas de las fases (valida con el mismo criterio que el disparador)
--     · apih_calculos entrega avance, avanceCalc, avanceManual y las ventanas por iniciativa
-- =====================================================================================


-- 1. Error legible de un conjunto de fechas por fase ('' = válido). Mismos criterios que apih_validar_ciclo.
create or replace function public.apih_fases_error(p jsonb, ff jsonb) returns text language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(p ->> 'tipo' = 'Propuesta'); f text; x jsonb; pf text; pfin text; sf jsonb; w jsonb;
begin
  foreach f in array fs loop
    x := ff -> f;
    if x is null or jsonb_typeof(x) <> 'object' or coalesce(x ->> 'ini', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(x ->> 'fin', '') !~ '^\d{4}-\d{2}-\d{2}$' then return 'La fase ' || f || ' necesita inicio y fin'; end if;
    if (x ->> 'fin') < (x ->> 'ini') then return 'En ' || f || ' el fin no puede ser anterior al inicio'; end if;
    if pfin is not null and (x ->> 'ini') <= pfin then return 'La fase ' || f || ' debe empezar después de que termine ' || pf || ' (' || to_char(pfin::date, 'DD-MM-YYYY') || ')'; end if;
    pf := f; pfin := x ->> 'fin';
  end loop;
  for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) loop
    w := ff -> (sf ->> 'fase');
    if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
      return 'La subfase «' || coalesce(sf ->> 'nombre', '') || '» quedaría fuera de ' || (sf ->> 'fase') || ' (' || to_char((w ->> 'ini')::date, 'DD-MM-YYYY') || ' → ' || to_char((w ->> 'fin')::date, 'DD-MM-YYYY') || '): ajústala primero'; end if;
  end loop;
  return '';
end $$;

-- 2. Ventana de cada fase: la fecha explícita manda; si no, desde el día siguiente al fin de la anterior hasta su último hito
create or replace function public.apih_ventanas(p jsonb, p_id text, p_prop boolean) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(p_prop); n int := cardinality(fs); k int; f text; ff jsonb := coalesce(case when jsonb_typeof(p -> 'fasesFechas') = 'object' then p -> 'fasesFechas' end, '{}'::jsonb);
  ini text; fin text; prev text; sal jsonb := '[]'::jsonb; hf text; hl text; nh int; dn int; expl boolean; pr numeric; idx int := array_position(fs, p ->> 'fase');
begin
  for k in 1..n loop
    f := fs[k];
    select min(nullif(h ->> 'fecha', '')), max(nullif(h ->> 'fecha', '')), count(*)::int, (count(*) filter (where h ->> 'completado' = 'true'))::int into hf, hl, nh, dn
      from (select substr(datos, 4)::jsonb h from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id) x
     where h ->> 'fase' = f;
    ini := case when k = 1 then coalesce(nullif(p ->> 'inicioPlan', ''), case when p_prop then nullif(p ->> 'creada', '') end, hf)
                else case when prev is not null then (prev::date + 1)::text else hf end end;
    fin := case when hl is not null then hl else case when k = n then coalesce(nullif(p ->> 'finPlan', ''), ini) else ini end end;
    if ini is not null and fin is not null and fin < ini then fin := ini; end if;
    if ini is null then ini := fin; end if;
    expl := public.apih_fecha_fase_ok(ff -> f);
    if expl then ini := ff -> f ->> 'ini'; fin := ff -> f ->> 'fin'; end if;
    if fin is not null then prev := fin; end if;
    pr := public.apih_avance_fase(p, p_id, f);
    sal := sal || jsonb_build_array(jsonb_build_object('fase', f, 'ini', ini, 'fin', fin, 'explicita', expl, 'hitos', nh, 'done', dn,
             'avance', round(coalesce(pr, case when idx is not null and k < idx then 1 else 0 end) * 100)::int));
  end loop;
  return sal;
end $$;

-- Convierte en explícitas las fechas que hoy se derivan de los hitos (proyectos anteriores). null si no hay de dónde sacarlas.
create or replace function public.apih_fases_materializadas(p jsonb, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare v jsonb := public.apih_ventanas(p, p_id, false); x jsonb; ff jsonb := '{}'::jsonb; prev date; a date; b date; ok boolean := true;
begin
  for x in select * from jsonb_array_elements(v) loop if x ->> 'ini' is null or x ->> 'fin' is null then ok := false; end if; end loop;
  if not ok then
    if coalesce(p ->> 'inicioPlan', '') ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(p ->> 'finPlan', '') ~ '^\d{4}-\d{2}-\d{2}$' then
      return public.apih_distribuir_fases((p ->> 'inicioPlan')::date, (p ->> 'finPlan')::date, public.apih_fases(false)); end if;
    return null;
  end if;
  for x in select * from jsonb_array_elements(v) loop
    a := (x ->> 'ini')::date; b := (x ->> 'fin')::date;
    if prev is not null and a <= prev then a := prev + 1; end if;
    if b < a then b := a; end if;
    ff := ff || jsonb_build_object(x ->> 'fase', jsonb_build_object('ini', a::text, 'fin', b::text)); prev := b;
  end loop;
  return ff;
end $$;

-- 3. Propuesta de reprogramación al avanzar de fase: la fase destino empieza hoy; las siguientes se mueven conservando su duración;
--    la fase que se deja (y las que se saltan) terminan ayer; las subfases se ajustan a sus nuevas ventanas. null si no corresponde.
create or replace function public.apih_plan_cambio_fase(p_id text, p_to text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare r record; p jsonb; fs text[] := public.apih_fases(false); n int := cardinality(fs); c int; x int; k int; f text; v jsonb; old jsonb := '{}'::jsonb; nu jsonb := '{}'::jsonb;
  h date := public.apih_hoy(); delta int; fin_ date; cur date; dur int; sf jsonb; w jsonb; a date; b date; subs jsonb := '[]'::jsonb; t jsonb; err text; r0i text; r0f text; r1i text; r1f text; el jsonb;
begin
  select lista, substr(datos, 4)::jsonb j into r from public.registros_v where lista = 'APIH_Proyectos' and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then return null; end if;
  p := r.j;
  if p ->> 'estado' = any (array['Completado', 'Cancelado']) then return null; end if;
  c := array_position(fs, p ->> 'fase'); x := array_position(fs, p_to);
  if c is null or x is null or x <= c then return null; end if;
  v := public.apih_ventanas(p, p_id, false);
  for el in select * from jsonb_array_elements(v) loop
    if el ->> 'ini' is null or el ->> 'fin' is null then return null; end if;
    old := old || jsonb_build_object(el ->> 'fase', jsonb_build_object('ini', el ->> 'ini', 'fin', el ->> 'fin'));
  end loop;
  delta := h - (old -> p_to ->> 'ini')::date;
  for k in 1..(c - 1) loop f := fs[k]; nu := nu || jsonb_build_object(f, old -> f); end loop;
  fin_ := h - 1;
  for k in reverse (x - 1)..c loop
    f := fs[k];
    if k = c then nu := nu || jsonb_build_object(f, jsonb_build_object('ini', old -> f ->> 'ini', 'fin', fin_::text));
    else nu := nu || jsonb_build_object(f, jsonb_build_object('ini', fin_::text, 'fin', fin_::text)); fin_ := fin_ - 1; end if;
  end loop;
  cur := h;
  for k in x..n loop
    f := fs[k]; dur := (old -> f ->> 'fin')::date - (old -> f ->> 'ini')::date;
    nu := nu || jsonb_build_object(f, jsonb_build_object('ini', cur::text, 'fin', (cur + dur)::text)); cur := cur + dur + 1;
  end loop;
  t := p;
  for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) loop
    k := array_position(fs, sf ->> 'fase'); w := nu -> (sf ->> 'fase');
    continue when k is null or k < c or w is null;
    a := (sf ->> 'inicio')::date; b := (sf ->> 'fin')::date;
    if k >= x then a := a + delta; b := b + delta; end if;
    if a < (w ->> 'ini')::date then a := (w ->> 'ini')::date; end if;
    if a > (w ->> 'fin')::date then a := (w ->> 'fin')::date; end if;
    if b > (w ->> 'fin')::date then b := (w ->> 'fin')::date; end if;
    if b < a then b := a; end if;
    if a::text <> (sf ->> 'inicio') or b::text <> (sf ->> 'fin') then subs := subs || jsonb_build_array(jsonb_build_object('id', sf ->> 'id', 'inicio', a::text, 'fin', b::text, 'nombre', sf ->> 'nombre')); end if;
  end loop;
  t := jsonb_set(t, '{subfases}', (select coalesce(jsonb_agg(case when m.s is null then s0 else s0 || jsonb_build_object('inicio', m.s ->> 'inicio', 'fin', m.s ->> 'fin') end), '[]'::jsonb)
         from jsonb_array_elements(coalesce(case when jsonb_typeof(p -> 'subfases') = 'array' then p -> 'subfases' end, '[]'::jsonb)) s0
         left join lateral (select s from jsonb_array_elements(subs) s where s ->> 'id' = s0 ->> 'id' limit 1) m on true));
  err := public.apih_fases_error(t, nu);
  r0i := old -> fs[1] ->> 'ini'; r0f := old -> fs[n] ->> 'fin'; r1i := nu -> fs[1] ->> 'ini'; r1f := nu -> fs[n] ->> 'fin';
  return jsonb_build_object('fases', nu, 'subs', subs, 'error', nullif(err, ''), 'hoy', h::text, 'delta', delta, 'faseActual', p ->> 'fase', 'destino', p_to,
    'inicioDestinoPlan', old -> p_to ->> 'ini', 'saltadas', (x - c) > 1, 'sigueFase', x < n,
    'rango0', jsonb_build_object('ini', r0i, 'fin', r0f), 'rango1', jsonb_build_object('ini', r1i, 'fin', r1f),
    'resumen', p_to || ' empieza ' || to_char(h, 'DD-MM-YYYY') || case when delta <> 0 then ' (' || case when delta > 0 then '+' else '' end || delta || ' d)' else '' end
               || '; fin ' || to_char(r0f::date, 'DD-MM-YYYY') || ' → ' || to_char(r1f::date, 'DD-MM-YYYY'));
end $$;

-- 4. Transición con reprogramación opcional del plan
drop function if exists public.apih_transicion(text, text, text, text, date, boolean, text);
create or replace function public.apih_transicion(p_id text, p_fase text default null, p_estado text default null, p_motivo text default '', p_rev date default null, p_forzar boolean default false, p_nota text default '', p_reprogramar boolean default false)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; es_prop boolean; fs text[]; ult text; prev_f text; prev_e text; hasta text; faltan text[] := '{}';
  motivo text := btrim(coalesce(p_motivo, '')); nota text := btrim(coalesce(p_nota, '')); forz text := ''; permitidos text[]; final_ text[]; necesita_mot boolean; necesita_rev boolean;
  hs jsonb; txt text; pl jsonb; sfs jsonb;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if (p_fase is null) = (p_estado is null) then raise exception 'APIH: indica la fase o el estado (uno solo)' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{' for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas'; prev_e := i ->> 'estado'; prev_f := i ->> 'fase';
  fs := public.apih_fases(es_prop); ult := fs[cardinality(fs)];
  final_ := case when es_prop then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end;
  if prev_e = any(final_) then raise exception 'APIH: la % está en estado final (%); para retomarla usa «Reabrir»', case when es_prop then 'propuesta' else 'proyecto' end, prev_e using errcode = '22023'; end if;

  if p_fase is not null then
    if prev_e = 'Stand By' then raise exception 'APIH: está en Stand By; reactívala antes de cambiar de fase' using errcode = '22023', hint = 'estado'; end if;
    if not (p_fase = any(fs)) then raise exception 'APIH: fase inválida (%)', p_fase using errcode = '22023', hint = 'fase'; end if;
    if p_fase = prev_f then raise exception 'APIH: ya está en la fase %', p_fase using errcode = '22023', hint = 'fase'; end if;
    hasta := p_fase;
  else
    permitidos := case when es_prop then array['Vigente', 'En espera', 'Stand By', 'Rechazada', 'Retirada'] else array['En curso', 'Pausado', 'Stand By', 'Cancelado', 'Completado'] end;
    if p_estado = 'Aprobada' then raise exception 'APIH: para aprobar una propuesta usa «Aprobar y crear proyecto»' using errcode = '22023', hint = 'estado'; end if;
    if not (p_estado = any(permitidos)) then raise exception 'APIH: estado inválido para % (%)', case when es_prop then 'una propuesta' else 'un proyecto' end, p_estado using errcode = '22023', hint = 'estado'; end if;
    if p_estado = prev_e then raise exception 'APIH: ya está en el estado %', p_estado using errcode = '22023', hint = 'estado'; end if;
    necesita_mot := p_estado = any(array['En espera', 'Pausado', 'Stand By', 'Rechazada', 'Retirada', 'Cancelado']);
    necesita_rev := p_estado = any(array['En espera', 'Pausado']);
    if necesita_mot and motivo = '' then raise exception 'APIH: indica el motivo del estado %', p_estado using errcode = '22023', hint = 'motivo'; end if;
    if necesita_rev and p_rev is null then raise exception 'APIH: indica la fecha de revisión' using errcode = '22023', hint = 'rev'; end if;
    if p_estado = 'Completado' then
      if prev_f <> ult then raise exception 'APIH: un proyecto se completa desde su última fase (%)', ult using errcode = '22023', hint = 'estado'; end if;
      hasta := 'Cierre';
    end if;
  end if;

  if hasta is not null then
    faltan := public.apih_faltan_transicion(p_id, hasta);
    if cardinality(faltan) > 0 then
      if not (p_forzar and per.rol = 'admin') then raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023'; end if;
      if nota = '' then raise exception 'APIH: indica el motivo del cambio forzado' using errcode = '22023', hint = 'nota'; end if;
      forz := ' (forzado: ' || nota || '; faltaba: ' || array_to_string(faltan, ', ') || ')';
    end if;
  end if;

  perform set_config('apih.interno', 'on', true);
  if p_fase is not null then
    if p_reprogramar then
      -- reprogramar el plan desde hoy: el cálculo es el mismo que muestra apih_plan_cambio_fase (aquí se evalúa con la fase aún sin cambiar)
      pl := public.apih_plan_cambio_fase(p_id, p_fase);
      if pl is null then raise exception 'APIH: el plan no se puede reprogramar en este cambio de fase' using errcode = '22023', hint = 'reprogramar'; end if;
      if pl ->> 'error' is not null then raise exception 'APIH: no se puede reprogramar el plan: %', pl ->> 'error' using errcode = '22023', hint = 'reprogramar'; end if;
      sfs := (select coalesce(jsonb_agg(case when m.s is null then x else x || jsonb_build_object('inicio', m.s ->> 'inicio', 'fin', m.s ->> 'fin') end order by o), '[]'::jsonb)
                from jsonb_array_elements(coalesce(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' end, '[]'::jsonb)) with ordinality t(x, o)
                left join lateral (select s from jsonb_array_elements(pl -> 'subs') s where s ->> 'id' = x ->> 'id' limit 1) m on true);
      i := i || jsonb_build_object('fasesFechas', pl -> 'fases', 'subfases', sfs,
             'inicioPlan', (select min(v ->> 'ini') from jsonb_each(pl -> 'fases') e(k2, v)), 'finPlan', (select max(v ->> 'fin') from jsonb_each(pl -> 'fases') e(k2, v)));
      perform public.apih_bitacora(p_id, 'Cambio', 'Plan reprogramado al cambiar de fase: ' || (pl ->> 'resumen'));
    end if;
    i := i || jsonb_build_object('fase', p_fase, 'faseDesde', hoy::text, 'actualizada', hoy::text);
    if not es_prop and p_fase = 'Ejecución' then
      if coalesce(i ->> 'inicioReal', '') = '' then i := i || jsonb_build_object('inicioReal', hoy::text); end if;
      if (i -> 'base') is null or jsonb_typeof(i -> 'base') = 'null' then
        if coalesce(i ->> 'inicioPlan', '') <> '' and coalesce(i ->> 'finPlan', '') <> '' then
          select coalesce(jsonb_agg(jsonb_build_object('id', x ->> 'id', 'nombre', x ->> 'nombre', 'fecha', x ->> 'fecha')), '[]'::jsonb) into hs
            from (select substr(datos, 4)::jsonb x from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id order by id) q;
          i := i || jsonb_build_object('base', jsonb_build_object('fecha', hoy::text, 'inicio', i ->> 'inicioPlan', 'fin', i ->> 'finPlan',
                 'pres', case when public.apih_ve_montos() then coalesce((i ->> 'presupuesto')::numeric, 0) else 0 end, 'por', coalesce(per.nombre, per.email), 'hitos', hs));
          perform public.apih_bitacora(p_id, 'Cambio', 'Línea base congelada · fin ' || (i ->> 'finPlan') || ' · ' || jsonb_array_length(hs) || ' hitos');
        end if;
      end if;
    end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Cambio de fase: ' || prev_f || ' → ' || p_fase || forz);
  else
    i := i || jsonb_build_object('estado', p_estado, 'estadoMotivo', case when necesita_mot then motivo else '' end, 'estadoRev', case when necesita_rev then p_rev::text else null end, 'actualizada', hoy::text);
    if p_estado = 'Completado' then i := i || jsonb_build_object('finReal', hoy::text); end if;
    if not es_prop then i := public.apih_avance_fila(i, p_id, hoy); end if;
    perform public.apih_bitacora(p_id, 'Cambio', 'Estado: ' || prev_e || ' → ' || p_estado || case when motivo <> '' then ' — ' || motivo else '' end || forz);
  end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('fase', i ->> 'fase', 'estado', i ->> 'estado', 'avance', i -> 'avance');
end $$;
revoke all on function public.apih_transicion(text, text, text, text, date, boolean, text, boolean) from public, anon;
grant execute on function public.apih_transicion(text, text, text, text, date, boolean, text, boolean) to authenticated;

-- 5. Comando: fijar o editar las fechas de las fases (p_ff null = convertir en explícitas las fechas derivadas de los hitos)
create or replace function public.apih_fases_fechas(p_id text, p_ff jsonb default null) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; ff jsonb; fs text[] := public.apih_fases(false); f text; limpio jsonb := '{}'::jsonb; err text; hoy date := public.apih_hoy(); ri text; rf text; txt text := '';
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into ir from public.registros where lista = 'APIH_Proyectos' and id = p_id and left(substr(datos, 4), 1) = '{' for update;
  if not found then raise exception 'APIH: el proyecto % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso para editar este proyecto' using errcode = '42501'; end if;
  i := substr(ir.datos, 4)::jsonb;
  ff := coalesce(p_ff, public.apih_fases_materializadas(i, p_id));
  if ff is null then raise exception 'APIH: define el inicio y el fin plan (o al menos un hito) para fijar las fases' using errcode = '22023', hint = 'fasesFechas'; end if;
  err := public.apih_fases_error(i, ff);
  if err <> '' then raise exception 'APIH: %', err using errcode = '22023', hint = 'fasesFechas'; end if;
  foreach f in array fs loop limpio := limpio || jsonb_build_object(f, jsonb_build_object('ini', ff -> f ->> 'ini', 'fin', ff -> f ->> 'fin')); txt := txt || case when txt = '' then '' else ' · ' end || f || ' ' || (ff -> f ->> 'ini') || ' → ' || (ff -> f ->> 'fin'); end loop;
  select min(v ->> 'ini'), max(v ->> 'fin') into ri, rf from jsonb_each(limpio) e(k, v);
  i := i || jsonb_build_object('fasesFechas', limpio, 'inicioPlan', ri, 'finPlan', rf, 'actualizada', hoy::text);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', 'Fechas de las fases: ' || txt || ' (plan ' || ri || ' → ' || rf || ')');
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('fasesFechas', limpio, 'inicioPlan', ri, 'finPlan', rf);
end $$;
revoke all on function public.apih_fases_fechas(text, jsonb) from public, anon;
grant execute on function public.apih_fases_fechas(text, jsonb) to authenticated;
revoke all on function public.apih_fases_error(jsonb, jsonb), public.apih_ventanas(jsonb, text, boolean), public.apih_fases_materializadas(jsonb, text) from public, anon;
revoke all on function public.apih_plan_cambio_fase(text, text) from public, anon;
grant execute on function public.apih_plan_cambio_fase(text, text) to authenticated;

-- 6. Disparador de filas con plan y avance derivados
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
  privilegiado boolean := coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role' or public.apih_rol() = 'admin';
  fs0 text[]; est0 text; fsn text[]; ffn jsonb; ffo jsonb; expl boolean; f_ text; cc int;
begin
  -- Actualización derivada (el avance de un proyecto cuando cambia uno de sus hitos): no es una edición de nadie, conserva versión y autor
  if tg_op = 'UPDATE' and new.lista = 'APIH_Proyectos' and coalesce(current_setting('apih.derivado', true), '') = 'on' then
    new.actualizado := old.actualizado; new.modificado_por := old.modificado_por; return new;
  end if;
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista not in ('APIH_Config', 'APIH_Roles') then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  perform public.apih_validar(new.lista, new.id, jn);
  perform public.apih_validar_ciclo(new.lista, jn);
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
    if not privilegiado then
      if tg_op = 'UPDATE' then
        foreach k in array array['fase','estado','estadoMotivo','estadoRev','faseDesde','proyecto','propuestaOrigen'] loop
          if coalesce(jn ->> k, '') is distinct from coalesce(jo ->> k, '') then
            raise exception 'APIH: «%» solo cambia con «Cambiar etapa» (comando del servidor)', k using errcode = '42501', hint = k; end if;
        end loop;
      else
        fs0 := public.apih_fases(new.lista = 'APIH_Propuestas');
        if coalesce(jn ->> 'fase', fs0[1]) <> fs0[1] then raise exception 'APIH: una iniciativa nueva empieza en la fase %', fs0[1] using errcode = '42501', hint = 'fase'; end if;
        est0 := (case when new.lista = 'APIH_Propuestas' then 'Vigente' else 'En curso' end);
        if coalesce(jn ->> 'estado', est0) <> est0 then
          raise exception 'APIH: una iniciativa nueva empieza en su estado inicial' using errcode = '42501', hint = 'estado'; end if;
        if coalesce(jn ->> 'proyecto', '') <> '' or coalesce(jn ->> 'propuestaOrigen', '') <> '' then
          raise exception 'APIH: el vínculo propuesta-proyecto lo crea la aprobación' using errcode = '42501'; end if;
      end if;
    end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  for k in select clave from public.claves_monto loop
    if (jn -> k) is distinct from (jo -> k) then
      tocó := true;
      if not ver then
        if jo ? k then jn := jsonb_set(jn, array[k], jo -> k); else jn := jn - k; end if;
      end if;
    end if;
  end loop;
  if not ver and tocó then tocó := false; end if;       -- se revirtió: no cuenta como cambio
  -- Plan y avance de un proyecto: los deriva el servidor, nadie los escribe por separado
  if new.lista = 'APIH_Proyectos' then
    fsn := public.apih_fases(false); ffn := jn -> 'fasesFechas'; ffo := jo -> 'fasesFechas'; expl := jsonb_typeof(ffn) = 'object';
    if expl then foreach f_ in array fsn loop if not public.apih_fecha_fase_ok(ffn -> f_) then expl := false; end if; end loop; end if;
    if expl and ffn is distinct from ffo then
      -- fechas de fase explícitas: el rango del proyecto es el de sus fases
      jn := jn || jsonb_build_object('inicioPlan', (select min(v ->> 'ini') from jsonb_each(ffn) e(k2, v) where k2 = any(fsn)),
                                     'finPlan',    (select max(v ->> 'fin') from jsonb_each(ffn) e(k2, v) where k2 = any(fsn)));
    elsif ffn is not distinct from ffo and ((jn ->> 'inicioPlan') is distinct from (jo ->> 'inicioPlan') or (jn ->> 'finPlan') is distinct from (jo ->> 'finPlan')) then
      -- cambió el rango del proyecto: reparte o reescala las fases
      jn := public.apih_set_rango_plan(jn, coalesce(jn ->> 'inicioPlan', ''), coalesce(jn ->> 'finPlan', ''), fsn);
    end if;
    -- ajuste manual del avance igual al calculado = sin ajuste
    if jsonb_typeof(jn -> 'avanceManual') = 'number' and (jn -> 'avanceManual') is distinct from (jo -> 'avanceManual') then
      cc := public.apih_avance_calc(jn, new.id);
      if round((jn ->> 'avanceManual')::numeric)::int = cc then jn := jn || jsonb_build_object('avanceManual', null); end if;
    end if;
    jn := public.apih_avance_fila(jn, new.id, public.apih_hoy());
  end if;

  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;

-- 7. Un cambio en los hitos refresca el avance del proyecto (valor derivado: no cambia su versión ni su autor)
create or replace function public.apih_hito_derivados() returns trigger language plpgsql security definer set search_path = public as
$$
declare ids text[] := '{}'; pid text; r public.registros; j jsonb; nj jsonb;
begin
  if tg_op in ('INSERT', 'UPDATE') and left(substr(new.datos, 4), 1) = '{' then ids := ids || coalesce(substr(new.datos, 4)::jsonb ->> 'ini', ''); end if;
  if tg_op in ('UPDATE', 'DELETE') and left(substr(old.datos, 4), 1) = '{' then ids := ids || coalesce(substr(old.datos, 4)::jsonb ->> 'ini', ''); end if;
  for pid in select distinct x from unnest(ids) x where x <> '' loop
    select * into r from public.registros where lista = 'APIH_Proyectos' and id = pid and left(substr(datos, 4), 1) = '{';
    continue when not found;
    j := substr(r.datos, 4)::jsonb; nj := public.apih_avance_fila(j, pid, public.apih_hoy());
    if nj is distinct from j then
      perform set_config('apih.derivado', 'on', true);
      update public.registros set datos = 'p1.' || nj::text where lista = 'APIH_Proyectos' and id = pid;
      perform set_config('apih.derivado', 'off', true);
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists apih_hito_derivados_i on public.registros; drop trigger if exists apih_hito_derivados_u on public.registros; drop trigger if exists apih_hito_derivados_d on public.registros;
create trigger apih_hito_derivados_i after insert on public.registros for each row when (new.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();
create trigger apih_hito_derivados_u after update on public.registros for each row when (new.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();
create trigger apih_hito_derivados_d after delete on public.registros for each row when (old.lista = 'APIH_Hitos') execute function public.apih_hito_derivados();
