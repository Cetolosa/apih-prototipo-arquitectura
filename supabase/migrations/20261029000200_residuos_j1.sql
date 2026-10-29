-- =====================================================================================
-- APIH Prototipo · J1 (residuos de lógica en el navegador) · importancia, pendientes personales y configuración en el servidor
--   · apih_cielo() entrega ahora, por paso y por pendiente personal: base (plazo y criticidad), aj (ajuste propio) y pts (0–100). La SPA ya no suma ni acota.
--   · apih_ajustar_paso(p_k, p_aj)         ajuste propio de importancia (−20, 0, 15, 30), guardado en el perfil de quien llama
--   · apih_guardar_tarea(p_tarea)          crea o edita un pendiente personal (largo, clasificación, fecha y máximo los valida el servidor)
--   · apih_tarea_estado(p_id, p_accion)    «hecha» o «eliminar»
--   · apih_guardar_ajuste(p_clave, p_valor) única vía de escritura de APIH_Config (parámetros, preferencias, eventos, presentaciones, plantillas):
--                                           valida clave, alcance, forma, tamaño y rangos; la escritura directa a la tabla queda denegada
-- =====================================================================================

-- ---------- importancia ----------
create or replace function public.apih_imp_base(u int, f text, tipo text, hoy date) returns int language sql immutable as
$$ select ((array[75, 50, 25])[least(greatest(u, 0), 2) + 1]
          + case when d > 0 then 8 + least(7, d) else greatest(0, 7 + d) end
          + case when coalesce(tipo, '') ~* 'cr[ií]tico|vencido' then 10 else 0 end)::int
   from (select case when coalesce(f, '') ~ '^\d{4}-\d{2}-\d{2}' then hoy - substr(f, 1, 10)::date else 0 end as d) q $$;

create or replace function public.apih_aj_de(ajs jsonb, k text) returns int language sql immutable as
$$ select case when (ajs ->> k) ~ '^-?\d+$' and (ajs ->> k)::int in (-20, 15, 30) then (ajs ->> k)::int else 0 end $$;

create or replace function public.apih_paso_imp(p jsonb, hoy date, ajs jsonb) returns jsonb language sql immutable as
$$ select p || jsonb_build_object('base', b, 'aj', a, 'pts', greatest(0, least(100, b + a)))
   from (select public.apih_imp_base(coalesce((p ->> 'u')::int, 2), p ->> 'f', coalesce(p ->> 'tipo', ''), hoy) b, public.apih_aj_de(ajs, p ->> 'k') a) q $$;

create or replace function public.apih_tareas_imp(psem jsonb, hoy date, ajs jsonb) returns jsonb language sql immutable as
$$ select coalesce(jsonb_agg(
     jsonb_build_object('k', 'T:' || (x ->> 'id'), 'u', u, 'tipo', x ->> 'cat', 't', x ->> 't',
       'por', case when f is null then 'Sin fecha.' else (case when f < hoy::text then 'Venció el ' else 'Fecha: ' end) || public.apih_fzd(f, hoy) || '.' end,
       'prot', 'Tu lista personal', 'btn', 'Marcar hecho', 'act', 'tareahecha', 'd', jsonb_build_object('id', x ->> 'id'),
       'f', coalesce(f, '9999-12-31'), 'tarea', x, 'base', b, 'aj', a, 'pts', greatest(0, least(100, b + a))) order by o), '[]'::jsonb)
   from (select x, o, f, u, public.apih_imp_base(u, f, x ->> 'cat', hoy) b, public.apih_aj_de(ajs, 'T:' || (x ->> 'id')) a
         from (select t.x, t.o, nullif(t.x ->> 'f', '') f from jsonb_array_elements(case when jsonb_typeof(psem -> 't') = 'array' then psem -> 't' else '[]'::jsonb end) with ordinality t(x, o)
                where jsonb_typeof(t.x) = 'object' and coalesce(t.x ->> 'hecha', '') = '') s
         cross join lateral (select case when f is null then 2 when f <= hoy::text then 0 when f ~ '^\d{4}-\d{2}-\d{2}' and (substr(f, 1, 10)::date - hoy) <= 7 then 1 else 2 end u) uu) z $$;

-- ---------- preferencias de «Siguientes pasos» de quien llama (cfgU:<correo>.v.sem) ----------
create or replace function public.apih_sem_poner(p_sem jsonb) returns void language plpgsql security definer set search_path = public as
$$
declare mail text := public.apih_email(); k text := 'cfgU:' || public.apih_email(); r public.registros; cur jsonb; nom text;
begin
  if not public.apih_puede_config(k) or public.apih_rol() = 'lector' then raise exception 'APIH: sin permiso para editar tus preferencias' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Config' and id = k;
  cur := case when found and left(r.datos, 4) = 'p1.{' then substr(r.datos, 4)::jsonb else '{}'::jsonb end;
  select coalesce(nullif(p.nombre, ''), p.email) into nom from public.perfiles p where p.email = mail;
  cur := jsonb_build_object('n', coalesce(nullif(cur ->> 'n', ''), nom),
           'v', jsonb_set(case when jsonb_typeof(cur -> 'v') = 'object' then cur -> 'v' else '{}'::jsonb end, '{sem}', p_sem, true));
  perform public.apih_guardar_ajuste(k, cur);
end $$;
create or replace function public.apih_sem_leer() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce((select case when jsonb_typeof(substr(datos, 4)::jsonb #> '{v,sem}') = 'object' then substr(datos, 4)::jsonb #> '{v,sem}' end
                      from public.registros where lista = 'APIH_Config' and id = 'cfgU:' || public.apih_email() and left(datos, 4) = 'p1.{'), '{}'::jsonb) $$;

create or replace function public.apih_ajustar_paso(p_k text, p_aj int) returns jsonb language plpgsql security definer set search_path = public as
$$
declare s jsonb := public.apih_sem_leer(); a jsonb;
begin
  if btrim(coalesce(p_k, '')) = '' or length(p_k) > 120 then perform public.apih_err('paso no válido', 'p_k'); end if;
  if p_aj is null or p_aj not in (-20, 0, 15, 30) then perform public.apih_err('la importancia debe ser Baja (−20), Normal (0), Alta (15) o Máxima (30)', 'p_aj'); end if;
  a := case when jsonb_typeof(s -> 'aj') = 'object' then s -> 'aj' else '{}'::jsonb end;
  a := case when p_aj = 0 then a - p_k else a || jsonb_build_object(p_k, p_aj) end;
  perform public.apih_sem_poner(jsonb_set(s, '{aj}', a, true));
  return jsonb_build_object('k', p_k, 'aj', p_aj);
end $$;
revoke all on function public.apih_ajustar_paso(text, int) from public, anon;
grant execute on function public.apih_ajustar_paso(text, int) to authenticated;

-- Pendientes personales: viven fuera del portafolio (sin tenedores, reportes ni presentaciones)
create or replace function public.apih_guardar_tarea(p_tarea jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare s jsonb := public.apih_sem_leer(); L jsonb; x jsonb; tx text; cat text; f text; id text; n int; ex jsonb;
begin
  if jsonb_typeof(p_tarea) is distinct from 'object' then perform public.apih_err('el pendiente debe ser un objeto', 'p_tarea'); end if;
  tx := btrim(coalesce(p_tarea ->> 't', ''));
  if tx = '' then perform public.apih_err('escribe qué necesitas hacer', 't'); end if;
  if length(tx) > 200 then perform public.apih_err('El pendiente admite hasta 200 caracteres', 't'); end if;
  cat := case when p_tarea ->> 'cat' in ('Trabajo', 'Desarrollo profesional', 'Personal') then p_tarea ->> 'cat' else 'Trabajo' end;
  f := coalesce(p_tarea ->> 'f', '');
  if f <> '' then
    if f !~ '^\d{4}-\d{2}-\d{2}$' or substr(f, 1, 4)::int < 1900 or substr(f, 1, 4)::int > 2100 then perform public.apih_err('La fecha no es válida', 'f'); end if;
    begin perform f::date; exception when others then perform public.apih_err('La fecha no es válida', 'f'); end;
  end if;
  L := case when jsonb_typeof(s -> 't') = 'array' then s -> 't' else '[]'::jsonb end;
  id := nullif(btrim(coalesce(p_tarea ->> 'id', '')), '');
  if id is null then
    if jsonb_array_length(L) >= 300 then perform public.apih_err('Llegaste al máximo de 300 pendientes: elimina los que ya no uses', 't'); end if;
    select coalesce(max(coalesce(nullif(regexp_replace(e ->> 'id', '\D', '', 'g'), '')::int, 0)), 0) + 1 into n from jsonb_array_elements(L) e;
    id := 'T-' || n;
    L := L || jsonb_build_object('id', id, 't', tx, 'cat', cat, 'f', f, 'creada', public.apih_hoy()::text, 'hecha', '');
  else
    select e into ex from jsonb_array_elements(L) e where e ->> 'id' = id limit 1;
    if ex is null then perform public.apih_err('ese pendiente no existe', 'id'); end if;
    L := (select coalesce(jsonb_agg(case when e ->> 'id' = id then e || jsonb_build_object('t', tx, 'cat', cat, 'f', f) else e end order by o), '[]'::jsonb) from jsonb_array_elements(L) with ordinality q(e, o));
  end if;
  perform public.apih_sem_poner(jsonb_set(s, '{t}', L, true));
  return jsonb_build_object('id', id);
end $$;
revoke all on function public.apih_guardar_tarea(jsonb) from public, anon;
grant execute on function public.apih_guardar_tarea(jsonb) to authenticated;

create or replace function public.apih_tarea_estado(p_id text, p_accion text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare s jsonb := public.apih_sem_leer(); L jsonb := case when jsonb_typeof(public.apih_sem_leer() -> 't') = 'array' then public.apih_sem_leer() -> 't' else '[]'::jsonb end;
begin
  if p_accion is null or p_accion not in ('hecha', 'eliminar') then perform public.apih_err('acción no válida (hecha o eliminar)', 'p_accion'); end if;
  if not exists (select 1 from jsonb_array_elements(L) e where e ->> 'id' = p_id) then perform public.apih_err('ese pendiente no existe', 'p_id'); end if;
  L := (select coalesce(jsonb_agg(case when p_accion = 'hecha' and e ->> 'id' = p_id then e || jsonb_build_object('hecha', public.apih_hoy()::text) else e end order by o), '[]'::jsonb)
          from jsonb_array_elements(L) with ordinality q(e, o) where not (p_accion = 'eliminar' and e ->> 'id' = p_id));
  perform public.apih_sem_poner(jsonb_set(s, '{t}', L, true));
  return jsonb_build_object('id', p_id, 'accion', p_accion);
end $$;
revoke all on function public.apih_tarea_estado(text, text) from public, anon;
grant execute on function public.apih_tarea_estado(text, text) to authenticated;

-- ---------- apih_cielo con importancia y pendientes personales ----------
create or replace function public.apih_cielo() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); w0 date := date_trunc('week', public.apih_hoy())::date; cfg jsonb := public.apih_cfg();
  calc jsonb := public.apih_calculos_base(); ctx jsonb; r record; j jsonb; k text; ids text[] := '{}'; M jsonb := '{}'::jsonb;
  imp jsonb := '{}'::jsonb; proy jsonb := '{}'::jsonb; hist jsonb := '{}'::jsonb; st jsonb; sx jsonb := '{}'::jsonb;   -- sx: id -> [estado semana 0..26]
  wk int; w date; o jsonb; arr jsonb; per jsonb := '{}'::jsonb; lid text; lids text[];
  total int; racha int; run boolean; ok boolean; n int; nivel text; sig int; me text; mail text := public.apih_email(); meta numeric; on_ int; off_ int; pct int;
  ins jsonb := '{}'::jsonb; pas jsonb; cs int; aviso int; cump int; cierres int; sem int; ms1 int; ms3 int; nm int; ucfg jsonb; psem jsonb; ajs jsonb; tar jsonb;
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
  -- Importancia (0–100) de cada paso y de cada pendiente personal: base por plazo y criticidad + el ajuste propio guardado (lo calcula el servidor)
  psem := case when jsonb_typeof(ucfg #> '{v,sem}') = 'object' then ucfg #> '{v,sem}' else '{}'::jsonb end;
  ajs := case when jsonb_typeof(psem -> 'aj') = 'object' then psem -> 'aj' else '{}'::jsonb end;
  select coalesce(jsonb_object_agg(e.key, (select coalesce(jsonb_agg(public.apih_paso_imp(el, hoy, ajs) order by ordn), '[]'::jsonb) from jsonb_array_elements(e.value) with ordinality t(el, ordn))), '{}'::jsonb) into pas from jsonb_each(pas) e;
  tar := public.apih_tareas_imp(psem, hoy, ajs);
  return jsonb_build_object('W', w0, 'proy', proy, 'hist', hist, 'personas', per, 'impecables', imp, 'pasos', pas, 'tareas', tar, 'yo', jsonb_build_object('nombre', me, 'meta', meta, 'pct', pct, 'insignias', ins));
end $$;
revoke all on function public.apih_cielo() from public, anon;
grant execute on function public.apih_cielo() to authenticated;

-- ---------- escritura de la configuración: única vía ----------
-- Quién puede escribir cada clave de APIH_Config (era la política de filas; ahora lo aplican los comandos)
create or replace function public.apih_puede_config(p_id text) returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((
     select case
       when public.apih_impersonando() then false
       when public.apih_congelado() and not (p.rol = 'admin' and p_id = 'cfg') then false
       when p.rol = 'admin' then true
       when p_id like 'cfgU:%' then p_id = 'cfgU:' || p.email
       when p_id in ('cfg', 'ptema') then (p.rol = 'editor' and public.apih_gobierna())
       else p.rol = 'editor' end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

-- La escritura directa de APIH_Config por la tabla queda denegada para todos: solo apih_guardar_ajuste (y las funciones del servidor) la escriben
create or replace function public.apih_escribe(p_lista text, p_id text, p_area text) returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((
     select case
       when p_lista = 'APIH_Config' then false
       when public.apih_impersonando() then false
       when public.apih_congelado() then false
       when p.rol = 'admin' then true
       when p_lista in ('APIH_Roles','APIH_Claves') then false
       when p_lista = 'APIH_Comites' then (p.rol = 'editor' and public.apih_gobierna())
       when p.rol = 'editor' and public.apih_restringido(p) then public.apih_areas(p_area) && public.apih_tok(p.proyectos) or not exists (select 1 from unnest(public.apih_areas(p_area)) x where x like '@%')
       when p.rol = 'editor' then (cardinality(public.apih_areas(public.apih_area_vis(p_area))) = 0 or 'Transversal' = any(public.apih_areas(p_area)) or public.apih_areas(p_area) && p.areas)
       else false end
     from public.perfiles p where p.email = public.apih_email() and p.activo), false) $$;

-- Rango de cada parámetro numérico de la organización (mínimo, máximo)
create or replace function public.apih_cfg_rango(k text) returns int[] language sql immutable as
$$ select case k when 'umbralCritico' then array[1, 25] when 'tolDesv' then array[0, 365] when 'diasSinUpdate' then array[1, 365] when 'decMaxDias' then array[1, 365]
                 when 'decEscalaDias' then array[1, 365] when 'descMax' then array[50, 2000] when 'propDiasAmb' then array[1, 730] when 'propDiasRojo' then array[1, 730]
                 when 'capacidadMax' then array[1, 100] when 'cieloMeta' then array[0, 100] end $$;

create or replace function public.apih_guardar_ajuste(p_clave text, p_valor jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare k text := btrim(coalesce(p_clave, '')); t text := jsonb_typeof(p_valor); r int[]; e record; prev text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin acceso' using errcode = '42501'; end if;
  if k !~ '^(cfg|ptema|eventos|pres|ptpl|seq|cfgU:[^[:space:]]{3,200}|psnap:[A-Za-z0-9_.-]{1,60})$' then perform public.apih_err('clave de configuración no válida', 'p_clave'); end if;
  if not public.apih_puede_config(k) then raise exception 'APIH: sin permiso para guardar «%»', k using errcode = '42501'; end if;
  if k like 'psnap:%' and public.apih_rol() <> 'admin' and exists (select 1 from public.registros where lista = 'APIH_Config' and id = k and propietario is distinct from public.apih_email()) then
    raise exception 'APIH: sin permiso para guardar «%» (es de otra persona)', k using errcode = '42501'; end if;   -- las presentaciones congeladas son de su dueña
  if p_valor is null or length(p_valor::text) > 2000000 then perform public.apih_err('el valor es demasiado grande (máximo 2 MB)', 'p_valor'); end if;
  if k in ('cfg', 'ptema', 'seq') or k like 'psnap:%' then
    if t is distinct from 'object' then perform public.apih_err('«' || k || '» debe ser un objeto', 'p_valor'); end if;
  elsif k like 'cfgU:%' then
    if t is distinct from 'object' or jsonb_typeof(p_valor -> 'v') is distinct from 'object' or jsonb_typeof(p_valor -> 'n') is distinct from 'string' then perform public.apih_err('la preferencia personal debe traer nombre (n) y valores (v)', 'p_valor'); end if;
  elsif t not in ('array', 'object') then perform public.apih_err('«' || k || '» debe ser una lista o un objeto', 'p_valor');
  end if;
  if k = 'cfg' then
    for e in select key, value from jsonb_each(p_valor) loop
      r := public.apih_cfg_rango(e.key);
      if r is not null and jsonb_typeof(e.value) <> 'null' then
        if jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}')::numeric < r[1] or (e.value #>> '{}')::numeric > r[2] then
          perform public.apih_err('«' || e.key || '» debe ser un número entre ' || r[1] || ' y ' || r[2], 'cfg.' || e.key); end if;
      end if;
    end loop;
    if p_valor ? 'areas' and jsonb_typeof(p_valor -> 'areas') <> 'array' then perform public.apih_err('«areas» debe ser una lista', 'cfg.areas'); end if;
  end if;
  prev := coalesce(current_setting('apih.interno', true), 'off');
  perform set_config('apih.interno', 'on', true);
  delete from public.registros where lista = 'APIH_Config' and left(id, length(k) + 1) = k || '#';   -- trozos de versiones anteriores
  if exists (select 1 from public.registros where lista = 'APIH_Config' and id = k) then
    update public.registros set datos = 'p1.' || p_valor::text where lista = 'APIH_Config' and id = k;
  else insert into public.registros(lista, id, datos) values ('APIH_Config', k, 'p1.' || p_valor::text); end if;
  perform set_config('apih.interno', prev, true);
  return jsonb_build_object('clave', k);
end $$;
revoke all on function public.apih_guardar_ajuste(text, jsonb) from public, anon;
grant execute on function public.apih_guardar_ajuste(text, jsonb) to authenticated;
