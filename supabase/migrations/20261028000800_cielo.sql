-- =====================================================================================
-- APIH Prototipo · Iter 4c · «Mi cocina» (tenedores, racha, nivel, insignias y cielo colectivo) en el servidor
--   Antes la SPA evaluaba los 5 tenedores de cada proyecto por semana, la racha de 26 semanas, el nivel, las insignias y el
--   cielo colectivo. Ahora los evalúa la base (una sola regla) y la SPA solo muestra:
--     · apih_cielo() → { W, impecables, proy: {id → {st, lleno, tope, act}}, hist: {id → [[on,off] × 8 semanas]}, personas: {líder → {racha,total,nivel,sig}},
--                        yo: {nombre, meta, pct, insignias: {clave → {v, of, ok}}} }
-- =====================================================================================

-- ¿Qué hizo el proyecto en la semana W? 'real' | 'nc' (sin novedades) | null
create or replace function public.apih_cielo_act(ctx jsonb, j jsonb, p_id text, w date) returns text language plpgsql immutable as
$$ declare e date := w + 6; real_ boolean := false; nc boolean := false; b jsonb; d date; act date := nullif(left(coalesce(j ->> 'actualizada', ''), 10), '')::date;
begin
  for b in select jsonb_array_elements(coalesce(ctx -> 'bit' -> p_id, '[]'::jsonb)) loop
    d := (b ->> 0)::date; continue when d < w or d > e;
    if (b ->> 1) = 'nc' then nc := true; else real_ := true; end if; end loop;
  if not real_ and not nc and act is not null and act >= w and act <= e then real_ := true; end if;
  return case when real_ then 'real' when nc then 'nc' end;
end $$;

-- avance del proyecto a la fecha d, según su historial [[fecha, valor], ...]
create or replace function public.apih_cielo_avance_en(j jsonb, d date) returns numeric language plpgsql immutable as
$$ declare v numeric := 0; h jsonb;
begin
  if jsonb_typeof(j -> 'hist') = 'array' then
    for h in select jsonb_array_elements(j -> 'hist') loop
      if jsonb_typeof(h) = 'array' and left(h ->> 0, 10) <= d::text then v := coalesce(nullif(h ->> 1, '')::numeric, 0); end if; end loop; end if;
  return v;
end $$;

create or replace function public.apih_cielo_avanzo(ctx jsonb, j jsonb, p_id text, w date) returns boolean language plpgsql immutable as
$$ declare e date := w + 6; h jsonb;
begin
  if public.apih_cielo_avance_en(j, e) > public.apih_cielo_avance_en(j, w - 1) then return true; end if;
  for h in select jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) loop
    if h ->> 'completado' = 'true' and not public.apih_vacio(h, 'fechaReal') and (h ->> 'fechaReal') >= w::text and (h ->> 'fechaReal') <= e::text then return true; end if; end loop;
  return false;
end $$;

-- «Al día» no se gana si el proyecto lleva 3 semanas seguidas actualizándose sin avance real (ni % ni hitos cerrados)
create or replace function public.apih_cielo_sin_avance(ctx jsonb, j jsonb, p_id text, w date) returns boolean language plpgsql immutable as
$$ declare k int; ww date;
begin
  if public.apih_num(j, 'avance') >= 100 and not exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) h where h ->> 'completado' is distinct from 'true') then return false; end if;
  for k in 0 .. 2 loop ww := w - 7 * k;
    if public.apih_cielo_avanzo(ctx, j, p_id, ww) or public.apih_cielo_act(ctx, j, p_id, ww) is null then return false; end if; end loop;
  return true;
end $$;

-- Los 5 tenedores de un proyecto en la semana w: {dia, hit, cmp, rsk, gob, tope}  ('on' | 'off' | 'na')
create or replace function public.apih_cielo_estrellas(ctx jsonb, j jsonb, p_id text, w date, hoy date, ci jsonb) returns jsonb language plpgsql immutable as
$$
declare cur boolean := w = date_trunc('week', hoy)::date; e date := case when cur then hoy else w + 6 end; a text; dia boolean; tope boolean := false;
  hs jsonb := coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb); cs jsonb := coalesce(ctx -> 'cmp' -> p_id, '[]'::jsonb); cam jsonb := coalesce(ctx -> 'cam' -> p_id, '[]'::jsonb); rs jsonb := coalesce(ctx -> 'rsk' -> p_id, '[]'::jsonb);
  expl boolean; nh int; hv int; nc_ int; cv int; o jsonb := '{}'::jsonb; tol numeric; fuera boolean;
begin
  a := public.apih_cielo_act(ctx, j, p_id, w); dia := a = 'real';
  if a = 'nc' then dia := not (public.apih_cielo_act(ctx, j, p_id, w - 7) = 'nc' and public.apih_cielo_act(ctx, j, p_id, w - 14) = 'nc'); end if;
  if dia and public.apih_cielo_sin_avance(ctx, j, p_id, w) then dia := false; tope := true; end if;
  o := o || jsonb_build_object('dia', case when dia then 'on' else 'off' end);
  -- hitos: sin vencidos (o con un cambio de fecha registrado)
  select exists (select 1 from jsonb_array_elements(cam) c where c ->> 'estado' is distinct from 'Rechazado' and c ->> 'tipo' = 'Fecha' and coalesce(c ->> 'creada', '') <= e::text) into expl;
  nh := jsonb_array_length(hs);
  select count(*) into hv from jsonb_array_elements(hs) h where not public.apih_vacio(h, 'fecha') and (h ->> 'fecha') < e::text and not (h ->> 'completado' = 'true' and coalesce(h ->> 'fechaReal', '') <= e::text);
  o := o || jsonb_build_object('hit', case when nh = 0 then 'na' when hv = 0 or expl then 'on' else 'off' end);
  -- compromisos
  select count(*) into nc_ from jsonb_array_elements(cs) c where c ->> 'estado' is distinct from 'Cancelado' and coalesce(c ->> 'creada', '') <= (w + 6)::text;
  select count(*) into cv from jsonb_array_elements(cs) c where c ->> 'estado' is distinct from 'Cancelado' and coalesce(c ->> 'creada', '') <= (w + 6)::text
     and not public.apih_vacio(c, 'limite') and (c ->> 'limite') < e::text and not (c ->> 'estado' = 'Cumplido' and coalesce(c ->> 'fechaReal', '') <= e::text);
  o := o || jsonb_build_object('cmp', case when nc_ = 0 then 'na' when cv = 0 then 'on' else 'off' end);
  -- riesgos y gobierno: solo la semana en curso (no hay historial de revisiones)
  if cur then
    if jsonb_array_length(rs) = 0 then o := o || jsonb_build_object('rsk', 'na');
    else o := o || jsonb_build_object('rsk', case when exists (select 1 from jsonb_array_elements(rs) r where (not public.apih_vacio(r, 'fRev') and (r ->> 'fRev') < hoy::text) or (coalesce((r ->> '_crit')::boolean, false) and public.apih_vacio(r, 'mit'))) then 'off' else 'on' end); end if;
    tol := public.apih_umbral(j, 'tolDesv');
    fuera := ci ->> 'forecast' is not null and not public.apih_vacio(j, 'finPlan') and coalesce((ci ->> 'desv')::int, 0) > tol;
    o := o || jsonb_build_object('gob', case when fuera and not exists (select 1 from jsonb_array_elements(cam) c where c ->> 'estado' is distinct from 'Rechazado') then 'off' else 'on' end);
  else o := o || jsonb_build_object('rsk', 'na', 'gob', 'na'); end if;
  return o || jsonb_build_object('tope', tope);
end $$;

create or replace function public.apih_cielo_lleno(o jsonb) returns boolean language sql immutable as
$$ select not (o ->> 'dia' = 'off' or o ->> 'hit' = 'off' or o ->> 'cmp' = 'off' or o ->> 'rsk' = 'off' or o ->> 'gob' = 'off')
          and (o ->> 'dia' = 'on' or o ->> 'hit' = 'on' or o ->> 'cmp' = 'on' or o ->> 'rsk' = 'on' or o ->> 'gob' = 'on') $$;
-- criterio histórico (calculable hacia atrás): solo día, hitos y compromisos
create or replace function public.apih_cielo_hist_ok(o jsonb) returns boolean language sql immutable as
$$ select not (o ->> 'dia' = 'off' or o ->> 'hit' = 'off' or o ->> 'cmp' = 'off') $$;

-- Cierre impecable: completado al 100 %, todos los hitos hechos, sin riesgos abiertos y dentro del plazo (o con un cambio de fecha aprobado)
create or replace function public.apih_cielo_impecable(ctx jsonb, j jsonb, p_id text) returns boolean language sql immutable as
$$ select coalesce(j ->> 'tipo', '') <> 'Propuesta' and j ->> 'estado' = 'Completado' and public.apih_num(j, 'avance') >= 100
      and not exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'hit' -> p_id, '[]'::jsonb)) h where h ->> 'completado' is distinct from 'true')
      and jsonb_array_length(coalesce(ctx -> 'rsk' -> p_id, '[]'::jsonb)) = 0
      and (public.apih_vacio(j, 'finReal') or public.apih_vacio(j, 'finPlan') or (j ->> 'finReal') <= (j ->> 'finPlan')
           or exists (select 1 from jsonb_array_elements(coalesce(ctx -> 'cam' -> p_id, '[]'::jsonb)) c where c ->> 'estado' = 'Aprobado' and c ->> 'tipo' = 'Fecha')) $$;

create or replace function public.apih_cielo() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); w0 date := date_trunc('week', public.apih_hoy())::date; cfg jsonb := public.apih_cfg();
  calc jsonb := public.apih_calculos_base(); ctx jsonb; r record; j jsonb; k text; ids text[] := '{}'; M jsonb := '{}'::jsonb;
  imp jsonb := '{}'::jsonb; proy jsonb := '{}'::jsonb; hist jsonb := '{}'::jsonb; st jsonb; sx jsonb := '{}'::jsonb;   -- sx: id -> [estado semana 0..26]
  wk int; w date; o jsonb; arr jsonb; per jsonb := '{}'::jsonb; lid text; lids text[];
  total int; racha int; run boolean; ok boolean; n int; nivel text; sig int; me text; mail text := public.apih_email(); meta numeric; on_ int; off_ int; pct int;
  ins jsonb := '{}'::jsonb; pas jsonb; cs int; aviso int; cump int; cierres int; sem int; ms1 int; ms3 int; nm int; ucfg jsonb;
begin
  if public.apih_rol() is null or coalesce(cfg ->> 'cieloOn', 'true') = 'false' then return jsonb_build_object('W', w0, 'proy', '{}'::jsonb, 'hist', '{}'::jsonb, 'personas', '{}'::jsonb, 'yo', null); end if;
  select coalesce(nullif(p.nombre, ''), p.email) into me from public.perfiles p where p.email = mail;
  -- contexto: lo que cada regla necesita, por iniciativa
  ctx := jsonb_build_object(
    'bit', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(jsonb_build_array(left(x ->> 'ts', 10), case when coalesce(x ->> 'texto', '') ~* 'sin novedades' then 'nc' else 'real' end)) a
                      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{') q where x ->> 'tipo' = 'Actualización' and coalesce(x ->> 'ini', '') <> '' group by 1) t), '{}'::jsonb),
    'hit', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'cmp', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'cam', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x) a from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{') q group by 1) t), '{}'::jsonb),
    'rsk', coalesce((select jsonb_object_agg(i, a) from (select x ->> 'ini' i, jsonb_agg(x || jsonb_build_object('_crit', coalesce((calc -> 'riesgos' -> (x ->> 'id') ->> 'critico')::boolean, false))) a
                      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{') q where x ->> 'estado' is distinct from 'Cerrado' group by 1) t), '{}'::jsonb));

  -- proyectos con tenedores esta semana: vivos, en fases activas y creados a la fecha
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; M := M || jsonb_build_object(r.id, j);
    if public.apih_cielo_impecable(ctx, j, r.id) then imp := imp || jsonb_build_object(r.id, true); end if;
    continue when coalesce(j ->> 'tipo', '') = 'Propuesta' or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By') or (j ->> 'fase') <> all (array['Planificación', 'Ejecución', 'Transición']);
    ids := ids || r.id;
    arr := '[]'::jsonb;
    for wk in 0 .. 26 loop
      w := w0 - 7 * wk;
      if coalesce(left(j ->> 'creada', 10), '0') > (w + 6)::text then arr := arr || jsonb_build_array(null); continue; end if;
      arr := arr || jsonb_build_array(public.apih_cielo_estrellas(ctx, j, r.id, w, hoy, calc -> 'ini' -> r.id));
    end loop;
    sx := sx || jsonb_build_object(r.id, arr);
    st := arr -> 0;
    if st <> 'null'::jsonb then
      proy := proy || jsonb_build_object(r.id, jsonb_build_object('st', st - 'tope', 'tope', (st ->> 'tope')::boolean, 'lleno', public.apih_cielo_lleno(st), 'act', public.apih_cielo_act(ctx, j, r.id, w0)));
    end if;
    -- serie de 8 semanas del cielo colectivo: [[encendidos, pendientes] del criterio histórico] de la más antigua a la actual
    arr := '[]'::jsonb;
    for wk in reverse 7 .. 0 loop
      o := sx -> r.id -> wk;
      arr := arr || jsonb_build_array(case when o = 'null'::jsonb then null
        else jsonb_build_array((select count(*) from unnest(array['dia', 'hit', 'cmp']) q where o ->> q = 'on'), (select count(*) from unnest(array['dia', 'hit', 'cmp']) q where o ->> q = 'off')) end);
    end loop;
    hist := hist || jsonb_build_object(r.id, arr);
  end loop;

  -- personas: racha de semanas seguidas con los tenedores del criterio histórico, total y nivel
  select array_agg(distinct M -> i ->> 'lider') into lids from unnest(ids) i where coalesce(M -> i ->> 'lider', '') <> '';
  foreach lid in array coalesce(lids, '{}') loop
    total := 0; racha := 0; run := true;
    for wk in 1 .. 26 loop
      select count(*), bool_and(public.apih_cielo_hist_ok(sx -> i -> wk)) into n, ok from unnest(ids) i where M -> i ->> 'lider' = lid and sx -> i -> wk <> 'null'::jsonb;
      ok := n > 0 and coalesce(ok, false);
      if ok then total := total + 1; end if;
      if run then if ok then racha := racha + 1; else run := false; end if; end if;
    end loop;
    if not exists (select 1 from unnest(ids) i where M -> i ->> 'lider' = lid and not public.apih_cielo_lleno(sx -> i -> 0)) then racha := racha + 1; total := total + 1; end if;
    nivel := case when total >= 12 then 'Chef ejecutivo' when total >= 4 then 'Chef de partida' when total >= 1 then 'Cocinero' else 'Pinche' end;
    sig := case when total >= 12 then 12 when total >= 4 then 12 when total >= 1 then 4 else 1 end;
    per := per || jsonb_build_object(lid, jsonb_build_object('racha', racha, 'total', total, 'nivel', nivel, 'sig', sig));
  end loop;

  -- quien llama: meta mensual, % de tenedores encendidos del portafolio e insignias
  select substr(datos, 4)::jsonb into ucfg from public.registros where lista = 'APIH_Config' and id = 'cfgU:' || mail and left(substr(datos, 4), 1) = '{';
  meta := coalesce(case when coalesce(cfg #>> '{fijos,cieloMeta}', '') in ('', '0', 'false') and jsonb_typeof(ucfg #> '{v,cfg,cieloMeta}') = 'number' then (ucfg #>> '{v,cfg,cieloMeta}')::numeric end,
                   nullif(public.apih_num(cfg, 'cieloMeta'), 0), 80);
  select coalesce(sum((select count(*) from unnest(array['dia','hit','cmp','rsk','gob']) q where v -> 'st' ->> q = 'on')), 0),
         coalesce(sum((select count(*) from unnest(array['dia','hit','cmp','rsk','gob']) q where v -> 'st' ->> q = 'off')), 0) into on_, off_ from jsonb_each(proy) t(k2, v);
  pct := case when on_ + off_ > 0 then round(on_::numeric / (on_ + off_) * 100)::int else 0 end;
  if me is not null then
    cs := 0;
    for wk in 0 .. 25 loop
      select count(*), bool_and(sx -> i -> wk ->> 'hit' is distinct from 'off') into n, ok from unnest(ids) i where M -> i ->> 'lider' = me and sx -> i -> wk <> 'null'::jsonb;
      if n = 0 then exit; end if; if ok then cs := cs + 1; else exit; end if;
    end loop;
    select count(*) into aviso from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'solicita' = me
       and not public.apih_vacio(substr(datos, 4)::jsonb, 'fAnt') and not public.apih_vacio(substr(datos, 4)::jsonb, 'creada') and substr(datos, 4)::jsonb ->> 'creada' <= substr(datos, 4)::jsonb ->> 'fAnt';
    select count(*) into cump from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'resp' = me and substr(datos, 4)::jsonb ->> 'estado' = 'Cumplido'
       and not public.apih_vacio(substr(datos, 4)::jsonb, 'fechaReal') and not public.apih_vacio(substr(datos, 4)::jsonb, 'limite') and substr(datos, 4)::jsonb ->> 'fechaReal' <= substr(datos, 4)::jsonb ->> 'limite';
    cierres := 0; ms1 := 0; ms3 := 0;
    for k in select key from jsonb_each(M) loop
      j := M -> k; continue when j ->> 'estado' = 'Stand By' or j ->> 'lider' is distinct from me;
      if public.apih_cielo_impecable(ctx, j, k) then cierres := cierres + 1; end if;
      nm := case when jsonb_typeof(j -> 'michelin') = 'array' then jsonb_array_length(j -> 'michelin') else 0 end;
      if nm >= 1 then ms1 := ms1 + 1; end if; if nm = 3 then ms3 := ms3 + 1; end if;
    end loop;
    select count(distinct date_trunc('week', (left(x ->> 'ts', 10))::date)) into sem
      from (select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{') q
     where x ->> 'autor' = me and x ->> 'tipo' = 'Actualización' and coalesce(x ->> 'texto', '') ~ '^Actualización semanal';
    total := coalesce((per -> me ->> 'total')::int, 0); racha := coalesce((per -> me ->> 'racha')::int, 0);
    ins := jsonb_build_object(
      'p1', jsonb_build_object('v', least(total, 1), 'of', 1, 'ok', total >= 1), 'r4', jsonb_build_object('v', least(racha, 4), 'of', 4, 'ok', racha >= 4),
      'cs', jsonb_build_object('v', least(cs, 4), 'of', 4, 'ok', cs >= 4), 'av', jsonb_build_object('v', least(aviso, 1), 'of', 1, 'ok', aviso >= 1),
      'cu', jsonb_build_object('v', least(cump, 10), 'of', 10, 'ok', cump >= 10), 'ci', jsonb_build_object('v', least(cierres, 1), 'of', 1, 'ok', cierres >= 1),
      'bv', jsonb_build_object('v', least(sem, 8), 'of', 8, 'ok', sem >= 8), 'm1', jsonb_build_object('v', least(ms1, 1), 'of', 1, 'ok', ms1 >= 1),
      'm3', jsonb_build_object('v', least(ms3, 1), 'of', 1, 'ok', ms3 >= 1), 'eq', jsonb_build_object('v', case when pct >= meta then 1 else 0 end, 'of', 1, 'ok', pct >= meta));
  end if;
  pas := public.apih_pasos(calc, ctx, M, proy, hoy);   -- «Siguientes pasos» (migración 5i)
  return jsonb_build_object('W', w0, 'proy', proy, 'hist', hist, 'personas', per, 'impecables', imp, 'pasos', pas, 'yo', jsonb_build_object('nombre', me, 'meta', meta, 'pct', pct, 'insignias', ins));
end $$;
revoke all on function public.apih_cielo() from public, anon;
grant execute on function public.apih_cielo() to authenticated;
