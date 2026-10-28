-- =====================================================================================
-- APIH Prototipo · Iter 4b · Hallazgos (motor de reglas PMO / riesgos / roadmap) y puntaje de priorización en el servidor
--   Antes la SPA evaluaba cada regla (atraso, hito vencido, decisión vencida/escalada, riesgo crítico, dependencias, sobrecarga,
--   desfase de trimestre, propuestas estancadas, línea base SPI/CPI) y el puntaje de priorización. Ahora las evalúa la base:
--     · apih_calculos() entrega además 'hallazgos' (lista ordenada por severidad) y 'puntajes' (propuesta → puntaje)
--   La SPA solo filtra por el área elegida y por las reglas activadas, y dibuja.
-- =====================================================================================

create or replace function public.apih_fd(d date) returns text language sql immutable as
$$ select case when d is null then '—' else lpad(extract(day from d)::int::text, 2, '0') || ' ' ||
     (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from d)::int] || ' ' || right(extract(year from d)::int::text, 2) end $$;

create or replace function public.apih_pct(n numeric) returns text language sql immutable as $$ select round(coalesce(n, 0))::int::text || '%' $$;

create or replace function public.apih_hf(grupo text, regla text, sev int, ini text, inis jsonb, titulo text, detalle text, fx jsonb, rid text default null)
returns jsonb language sql immutable as
$$ select jsonb_strip_nulls(jsonb_build_object('grupo', grupo, 'regla', regla, 'sev', sev, 'ini', nullif(ini, ''), 'inis', coalesce(inis, '[]'::jsonb),
                                              'titulo', titulo, 'detalle', detalle, 'fx', fx, 'rid', rid)) $$;

-- Puntaje de priorización (0-100) de una propuesta evaluada: 0,30·valor + 0,25·estrategia + 0,15·ROI + 0,15·(esfuerzo inv.) + 0,10·capacidad + 0,05·(riesgo inv.)
create or replace function public.apih_puntaje(j jsonb, roi_ numeric, n_lider int, cap int) returns int language sql immutable as
$$ select case when jsonb_typeof(j -> 'score') <> 'object' then 0 else
     round(((j #>> '{score,valor}')::numeric * .30 + (j #>> '{score,estrategia}')::numeric * .25
            + (case when roi_ is null then 0 else greatest(0, least(1, roi_ / 200)) * 5 end) * .15
            + (6 - (j #>> '{score,esfuerzo}')::numeric) * .15
            + (case when coalesce(j ->> 'lider', '') = '' then 0 else greatest(0, least(1, 1 - n_lider::numeric / greatest(1, cap))) * 5 end) * .10
            + (6 - (j #>> '{score,riesgo}')::numeric) * .05) / 5 * 100)::int end $$;

drop function if exists public.apih_calculos_base();   -- repetible: apih_calculos() vuelve a ser la versión completa justo antes
alter function public.apih_calculos() rename to apih_calculos_base;
revoke all on function public.apih_calculos_base() from public, anon, authenticated;

-- Devuelve {hallazgos: [...], puntajes: {id: n}} a partir de lo que ya calculó apih_calculos_base()
create or replace function public.apih_hallazgos(c jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg();
  cap int := greatest(1, coalesce(nullif(cfg ->> 'capacidadMax', '')::numeric, 5)::int); esc int := coalesce(nullif(cfg ->> 'decEscalaDias', '')::int, 7);
  M jsonb := '{}'::jsonb;            -- id -> iniciativa (con _prop)
  ids text[] := '{}'; r record; j jsonb; k text; x jsonb; ci jsonb;
  out jsonb := '[]'::jsonb; pun jsonb := '{}'::jsonb;
  vivo boolean; es_prop boolean; hecho boolean; sb boolean;
  carga jsonb := '{}'::jsonb;        -- líder -> [ids de proyectos vivos en fases activas]
  nl int; tol numeric; thr numeric; d int; sug text; fc date; fp date; b jsonb; pv numeric; ev numeric; ac numeric; spi numeric; cpi numeric; dfin int;
  hv jsonb; nhv int; mx int; du int; why text[]; rc int; e numeric; dep text; dj jsonb; ii text;
  amb numeric; roj numeric; dias int; falta text[]; pq int; fq int; py int; fy int; fe date; cnt int;
  cand record; semm jsonb := '{}'::jsonb; camm jsonb := '{}'::jsonb; per public.perfiles; evmm jsonb := '{}'::jsonb; em jsonb; mov int; nue int; bh jsonb;
begin
  -- iniciativas visibles para quien llama
  for r in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j || jsonb_build_object('_prop', (r.j ->> 'tipo' = 'Propuesta' or r.lista = 'APIH_Propuestas'));
    M := M || jsonb_build_object(r.id, j); ids := ids || r.id;
  end loop;
  -- vivo = no finalizada y no en Stand By
  -- carga por líder (proyectos vivos en fases activas)
  foreach k in array ids loop
    j := M -> k;
    if not (j ->> '_prop')::boolean and j ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and coalesce(j ->> 'lider', '') <> '' then
      carga := jsonb_set(carga, array[j ->> 'lider'], coalesce(carga -> (j ->> 'lider'), '[]'::jsonb) || to_jsonb(k), true); end if;
  end loop;

  -- puntaje de las propuestas evaluadas
  foreach k in array ids loop
    j := M -> k;
    if (j ->> '_prop')::boolean and jsonb_typeof(j -> 'score') = 'object' then
      select count(*) into nl from jsonb_each(M) q where not (q.value ->> '_prop')::boolean and q.value ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and coalesce(q.value ->> 'lider', '') <> '' and q.value ->> 'lider' = j ->> 'lider';
      pun := pun || jsonb_build_object(k, public.apih_puntaje(j, nullif(c -> 'ini' -> k ->> 'roi', '')::numeric, nl, cap));
    end if;
  end loop;

  -- valor ganado contra la línea base congelada (SPI, CPI, desvío del fin y cambios de hitos)
  foreach k in array ids loop
    j := M -> k; b := j -> 'base'; ci := c -> 'ini' -> k;
    continue when (j ->> '_prop')::boolean or ci is null or jsonb_typeof(b) <> 'object' or not (public.apih_num(b, 'pres') > 0) or public.apih_vacio(b, 'inicio') or public.apih_vacio(b, 'fin');
    pv := public.apih_num(b, 'pres') * greatest(0, least(1, (hoy - public.apih_fecha(b, 'inicio'))::numeric / greatest(1, public.apih_fecha(b, 'fin') - public.apih_fecha(b, 'inicio'))));
    ev := public.apih_num(b, 'pres') * coalesce((ci ->> 'avance')::numeric, 0) / 100; ac := public.apih_num(j, 'gastado');
    bh := case when jsonb_typeof(b -> 'hitos') = 'array' then b -> 'hitos' else '[]'::jsonb end;
    select count(*) filter (where o is not null and public.apih_fecha(h, 'fecha') > public.apih_fecha(o, 'fecha')), count(*) filter (where o is null) into mov, nue
      from (select h, (select ob from jsonb_array_elements(bh) ob where ob ->> 'id' = h ->> 'id' limit 1) o
              from (select substr(datos, 4)::jsonb h from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q where h ->> 'ini' = k) t;
    evmm := evmm || jsonb_build_object(k, jsonb_build_object('pv', pv, 'ev', ev, 'ac', ac, 'spi', case when pv > 0 then ev / pv end, 'cpi', case when ac > 0 then ev / ac end,
        'dfin', nullif(ci ->> 'forecast', '')::date - public.apih_fecha(b, 'fin'), 'movidos', mov, 'nuevos', nue));
  end loop;

  -- ===== Reglas PMO =====
  foreach k in array ids loop
    j := M -> k; es_prop := (j ->> '_prop')::boolean; continue when es_prop;
    hecho := j ->> 'estado' in ('Completado', 'Cancelado'); sb := j ->> 'estado' = 'Stand By'; continue when sb;
    ci := c -> 'ini' -> k; continue when ci is null;
    if not hecho and j ->> 'estado' = 'En curso' and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) then
      d := coalesce((ci ->> 'desv')::int, 0); tol := public.apih_umbral(j, 'tolDesv');
      if d > tol then
        sug := ci -> 'rag' ->> 'rag';
        out := out || public.apih_hf('PMO', 'Proyecto atrasado', case when d > 30 then 3 else 2 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' está atrasado (+' || d || ' d)',
          'Fin plan ' || public.apih_fd(public.apih_fecha(j, 'finPlan')) || ', proyectado ' || public.apih_fd(nullif(ci ->> 'forecast', '')::date) || '. Avance ' || public.apih_pct((ci ->> 'avance')::numeric) || ' vs ' || public.apih_pct((ci ->> 'esperado')::numeric) || ' esperado.',
          case when j ->> 'rag' is distinct from sug then jsonb_build_array(jsonb_build_object('t', 'Marcar RAG ' || sug, 'a', 'fxrag', 'id', k, 'rag', sug))
               else jsonb_build_array(jsonb_build_object('t', 'Crear acción de recuperación', 'a', 'fxacc', 'id', k)) end);
      end if;
      em := evmm -> k;
      if em is not null then
        spi := nullif(em ->> 'spi', '')::numeric; cpi := nullif(em ->> 'cpi', '')::numeric; dfin := (em ->> 'dfin')::int;
        if (spi is not null and spi < .85) or (cpi is not null and cpi < .85) then
          out := out || public.apih_hf('PMO', 'Desempeño vs línea base', case when (spi is not null and spi < .7) or (cpi is not null and cpi < .7) then 3 else 2 end, k, jsonb_build_array(k),
            (j ->> 'titulo') || ': desempeño bajo la línea base',
            'SPI ' || coalesce(to_char(spi, 'FM990.00'), '—') || ' · CPI ' || coalesce(to_char(cpi, 'FM990.00'), '—') || ' · ' || case when dfin > 0 then '+' || dfin || ' d' else 'sin atraso' end || ' vs fin base.',
            jsonb_build_array(jsonb_build_object('t', 'Abrir proyecto', 'a', 'fxsel', 'id', k)));
        end if;
      end if;
      du := coalesce((ci ->> 'dsu')::int, 999); thr := public.apih_umbral(j, 'diasSinUpdate');
      if du > thr then
        out := out || public.apih_hf('PMO', 'Sin actualización', case when du > thr * 2 then 2 else 1 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' sin actualización hace ' || du || ' d',
          'Última actualización: ' || public.apih_fd(public.apih_fecha(j, 'actualizada')) || '. Responsable: ' || coalesce(j ->> 'lider', '') || '. Umbral: ' || thr::int || ' d.',
          jsonb_build_array(jsonb_build_object('t', 'Solicitar actualización', 'a', 'fxnudge', 'id', k)));
      end if;
    end if;
    if j ->> 'estado' = 'Pausado' and not public.apih_vacio(j, 'estadoRev') and public.apih_fecha(j, 'estadoRev') < hoy then
      out := out || public.apih_hf('PMO', 'Proyecto atrasado', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': revisión de “Pausado” vencida (' || public.apih_fd(public.apih_fecha(j, 'estadoRev')) || ')',
        'Motivo: ' || coalesce(nullif(j ->> 'estadoMotivo', ''), '—') || '. Decidir si se reanuda o se cancela.', jsonb_build_array(jsonb_build_object('t', 'Abrir proyecto', 'a', 'fxsel', 'id', k)));
    end if;
    if not hecho and j ->> 'estado' = 'En curso' then
      select coalesce(jsonb_agg(h order by h ->> 'fecha', h ->> 'id'), '[]'::jsonb) into hv
        from (select substr(datos, 4)::jsonb h from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q
       where h ->> 'ini' = k and h ->> 'completado' is distinct from 'true' and public.apih_fecha(h, 'fecha') < hoy;
      nhv := jsonb_array_length(hv);
      if nhv > 0 then
        mx := hoy - public.apih_fecha(hv -> 0, 'fecha');
        out := out || public.apih_hf('PMO', 'Hito vencido', case when mx > 30 or nhv > 2 then 3 else 2 end, k, jsonb_build_array(k),
          nhv || ' hito(s) vencido(s) en ' || (j ->> 'titulo'),
          (select string_agg('“' || (h ->> 'nombre') || '” (' || public.apih_fd(public.apih_fecha(h, 'fecha')) || ', hace ' || (hoy - public.apih_fecha(h, 'fecha')) || ' d)', '; ') from (select h from jsonb_array_elements(hv) h limit 3) t3) || case when nhv > 3 then '…' else '' end,
          jsonb_build_array(jsonb_build_object('t', 'Replanificar primer hito', 'a', 'fxhito', 'id', hv -> 0 ->> 'id'), jsonb_build_object('t', 'Marcar completado', 'a', 'fxdone', 'id', hv -> 0 ->> 'id')));
      end if;
    end if;
  end loop;
  -- decisiones vencidas y escaladas
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' is distinct from 'Pendiente' or public.apih_vacio(j, 'limite');
    continue when coalesce(j ->> 'ini', '') <> '' and not (M ? (j ->> 'ini'));
    d := hoy - public.apih_fecha(j, 'limite');
    if d > 0 then
      out := out || public.apih_hf('PMO', 'Decisión vencida', 2, j ->> 'ini', case when coalesce(j ->> 'ini', '') <> '' then jsonb_build_array(j ->> 'ini') else '[]'::jsonb end,
        'Decisión vencida hace ' || d || ' d: ' || coalesce(j ->> 'titulo', ''), coalesce(j ->> 'tipo', '') || ' · solicitada por ' || coalesce(j ->> 'solicita', '') || '. Debe resolverse en comité.',
        jsonb_build_array(jsonb_build_object('t', 'Resolver ahora', 'a', 'resolvedec', 'id', r.id)));
    end if;
  end loop;
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' is distinct from 'Pendiente' or public.apih_vacio(j, 'limite');
    continue when coalesce(j ->> 'ini', '') <> '' and not (M ? (j ->> 'ini'));
    d := hoy - public.apih_fecha(j, 'limite');
    if d > esc then
      out := out || public.apih_hf('PMO', 'Decisión escalada', 3, j ->> 'ini', case when coalesce(j ->> 'ini', '') <> '' then jsonb_build_array(j ->> 'ini') else '[]'::jsonb end,
        'Decisión escalada (' || d || ' d de atraso): ' || coalesce(j ->> 'titulo', ''), 'Superó el plazo de escalamiento (' || esc || ' d). Requiere resolución del rol Administra.',
        jsonb_build_array(jsonb_build_object('t', 'Resolver ahora', 'a', 'resolvedec', 'id', r.id)));
    end if;
  end loop;

  -- ===== Reglas de riesgos =====
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' order by id loop
    j := r.j; continue when j ->> 'estado' = 'Cerrado';
    if M ? (j ->> 'ini') then
      x := M -> (j ->> 'ini'); continue when x ->> 'estado' in ('Completado', 'Cancelado', 'Aprobada', 'Rechazada', 'Retirada', 'Stand By'); end if;
    e := coalesce((c -> 'riesgos' -> r.id ->> 'expo')::numeric, 0); ii := j ->> 'ini';
    if coalesce((c -> 'riesgos' -> r.id ->> 'critico')::boolean, false) then
      out := out || public.apih_hf('Riesgos', 'Impacto alto + Probabilidad alta', 3, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Riesgo crítico (' || e::int || '): ' || coalesce(j ->> 'desc', ''), 'Impacto ' || (j ->> 'imp') || '/5 · Probabilidad ' || (j ->> 'prob') || '/5 · ' || coalesce(j ->> 'estado', '') || '. Dueño: ' || coalesce(nullif(j ->> 'dueno', ''), 'sin dueño') || '.',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    elsif public.apih_num(j, 'imp') >= 4 then
      out := out || public.apih_hf('Riesgos', 'Impacto alto', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Impacto alto: ' || coalesce(j ->> 'desc', ''), 'Impacto ' || (j ->> 'imp') || '/5 con probabilidad ' || (j ->> 'prob') || '/5 (exposición ' || e::int || ').',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    elsif public.apih_num(j, 'prob') >= 4 then
      out := out || public.apih_hf('Riesgos', 'Probabilidad alta', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Probabilidad alta: ' || coalesce(j ->> 'desc', ''), 'Probabilidad ' || (j ->> 'prob') || '/5 con impacto ' || (j ->> 'imp') || '/5 (exposición ' || e::int || ').',
        jsonb_build_array(jsonb_build_object('t', 'Ver riesgo', 'a', 'fxrisk', 'id', r.id)), r.id);
    end if;
    if e >= 10 and public.apih_vacio(j, 'mit') then
      out := out || public.apih_hf('Riesgos', 'Sin plan de mitigación', 2, ii, case when M ? ii then jsonb_build_array(ii) else '[]'::jsonb end,
        'Sin mitigación definida: ' || coalesce(j ->> 'desc', ''), 'Exposición ' || e::int || '. Define plan y dueño.',
        jsonb_build_array(jsonb_build_object('t', 'Definir mitigación', 'a', 'fxrisk', 'id', r.id)), r.id);
    end if;
  end loop;
  -- dependencias críticas
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By') or jsonb_typeof(j -> 'deps') <> 'array';
    for dep in select jsonb_array_elements_text(j -> 'deps') loop
      continue when not (M ? dep); dj := M -> dep;
      continue when dj ->> 'estado' in (case when (dj ->> '_prop')::boolean then 'Aprobada' else 'Completado' end, case when (dj ->> '_prop')::boolean then 'Rechazada' else 'Cancelado' end, 'Retirada', 'Stand By');
      why := '{}';
      if dj ->> 'rag' = 'Rojo' then why := array_append(why, ('RAG Rojo')::text); end if;
      if coalesce((c -> 'ini' -> dep ->> 'atrasado')::boolean, false) then why := array_append(why, (('atrasada +' || coalesce(c -> 'ini' -> dep ->> 'desv', '0') || ' d'))::text); end if;
      select count(*) into rc from public.registros_v q where q.lista = 'APIH_Riesgos' and left(substr(q.datos, 4), 1) = '{' and substr(q.datos, 4)::jsonb ->> 'ini' = dep and coalesce((c -> 'riesgos' -> q.id ->> 'critico')::boolean, false);
      if rc > 0 then why := array_append(why, ((rc || ' riesgo(s) crítico(s)'))::text); end if;
      if coalesce(array_length(why, 1), 0) > 0 then
        out := out || public.apih_hf('Riesgos', 'Dependencias críticas', case when array_length(why, 1) > 1 then 3 else 2 end, k, jsonb_build_array(k),
          (j ->> 'titulo') || ' depende de ' || (dj ->> 'titulo') || ' (' || array_to_string(why, ', ') || ')',
          'Fin proyectado de la predecesora: ' || public.apih_fd(nullif(c -> 'ini' -> dep ->> 'forecast', '')::date) || '. Un retraso se propaga a ' || (j ->> 'titulo') || '.',
          jsonb_build_array(jsonb_build_object('t', 'Registrar riesgo de dependencia', 'a', 'fxdeprisk', 'id', k, 'dep', dep)));
      end if;
    end loop;
  end loop;

  -- ===== Reglas de roadmap =====
  for r in select key l, value a from jsonb_each(carga) order by key loop
    if jsonb_array_length(r.a) > cap then
      out := out || public.apih_hf('Roadmap', 'Sobrecarga de líder', 2, null, r.a, r.l || ' lidera ' || jsonb_array_length(r.a) || ' proyectos activos (capacidad ' || cap || ')',
        (select string_agg(M -> t ->> 'titulo', ' · ') from jsonb_array_elements_text(r.a) t), jsonb_build_array(jsonb_build_object('t', 'Priorizar cierres', 'a', 'go', 'v', 'portfolio')));
    end if;
  end loop;
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By'); ci := c -> 'ini' -> k;
    if jsonb_typeof(j -> 'deps') = 'array' and not public.apih_vacio(j, 'inicioPlan') then
      for dep in select jsonb_array_elements_text(j -> 'deps') loop
        continue when not (M ? dep); dj := M -> dep;
        continue when dj ->> 'estado' in ('Completado', 'Cancelado', 'Aprobada', 'Rechazada', 'Retirada', 'Stand By');
        fe := nullif(c -> 'ini' -> dep ->> 'forecast', '')::date;
        if fe is not null and public.apih_fecha(j, 'inicioPlan') < fe and dj ->> 'fase' <> 'Cierre' and j ->> 'estado' = 'En curso' and (j ->> 'fase' = 'Planificación' or public.apih_fecha(j, 'inicioPlan') > hoy) then
          out := out || public.apih_hf('Roadmap', 'Secuencia de dependencias', 2, k, jsonb_build_array(k),
            (j ->> 'titulo') || ' inicia (' || public.apih_fd(public.apih_fecha(j, 'inicioPlan')) || ') antes de que termine ' || (dj ->> 'titulo') || ' (' || public.apih_fd(fe) || ')',
            'Conflicto de secuencia en el roadmap. Ajusta fechas o rompe la dependencia.', jsonb_build_array(jsonb_build_object('t', 'Editar fechas', 'a', 'edit', 't2', 'ini', 'id', k)));
        end if;
      end loop;
    end if;
    if (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and not public.apih_vacio(j, 'finPlan') and ci is not null then
      fp := public.apih_fecha(j, 'finPlan'); fc := nullif(ci ->> 'forecast', '')::date;
      if fc is not null then
        pq := extract(quarter from fp)::int; fq := extract(quarter from fc)::int; py := extract(year from fp)::int; fy := extract(year from fc)::int;
        if fy * 4 + fq > py * 4 + pq then
          out := out || public.apih_hf('Roadmap', 'Desfase de trimestre', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ' se desplaza de Q' || pq || ' ' || py || ' a Q' || fq || ' ' || fy,
            'Fin plan ' || public.apih_fd(fp) || ' → proyectado ' || public.apih_fd(fc) || '. Comunica el cambio al comité.',
            jsonb_build_array(jsonb_build_object('t', 'Crear decisión', 'a', 'mkdec', 'id', k, 'tp', 'Mantener', 'ti', 'Reprogramar ' || (j ->> 'titulo') || ' a Q' || fq || ' ' || fy, 'rec', 'Pronóstico ' || public.apih_fd(fc) || ' vs línea base ' || public.apih_fd(fp) || '.')));
        end if;
      end if;
    end if;
  end loop;
  -- propuestas: candidatas a iniciar (las 3 de mayor puntaje)
  for cand in select p.k, p.j, coalesce((pun ->> p.k)::int, 0) pt from (select i k, M -> i j from unnest(ids) i) p
               where (p.j ->> '_prop')::boolean and p.j ->> 'estado' = 'Vigente' and (p.j ->> 'fase' = 'Aprobación' or (p.j ->> 'fase' = 'Evaluación' and coalesce((pun ->> p.k)::int, 0) >= 70))
               order by coalesce((pun ->> p.k)::int, 0) desc, p.k limit 3 loop
    nl := jsonb_array_length(coalesce(carga -> (cand.j ->> 'lider'), '[]'::jsonb));
    out := out || public.apih_hf('Roadmap', 'Candidatos a iniciar', 1, cand.k, jsonb_build_array(cand.k), 'Propuesta candidata a iniciar: ' || (cand.j ->> 'titulo') || ' (puntaje ' || cand.pt || ')',
      case when nl < cap then (cand.j ->> 'lider') || ' tiene capacidad disponible (' || nl || '/' || cap || ').' else (cand.j ->> 'lider') || ' está al límite de capacidad: considera reasignar.' end,
      jsonb_build_array(jsonb_build_object('t', 'Proponer “Iniciar”', 'a', 'mkdec', 'id', cand.k, 'tp', 'Iniciar', 'ti', 'Iniciar ' || (cand.j ->> 'titulo'),
        'rec', 'Puntaje de priorización ' || cand.pt || '; ' || case when nl < cap then 'hay capacidad' else 'revisar capacidad' end || '.')));
  end loop;
  foreach k in array ids loop
    j := M -> k; continue when not (j ->> '_prop')::boolean or j ->> 'estado' in ('Aprobada', 'Rechazada', 'Retirada', 'Stand By');
    dias := hoy - coalesce(public.apih_fecha(j, 'faseDesde'), public.apih_fecha(j, 'actualizada'), public.apih_fecha(j, 'creada'), hoy);
    amb := coalesce(nullif(public.apih_umbral(j, 'propDiasAmb'), 0), 30); roj := coalesce(nullif(public.apih_umbral(j, 'propDiasRojo'), 0), 60);
    x := jsonb_build_array(jsonb_build_object('t', 'Abrir propuesta', 'a', 'fxsel', 'id', k));
    semm := semm || jsonb_build_object(k, jsonb_build_object('dias', dias, 'nivel', case when dias > roj then 'rojo' when dias > amb then 'amb' else 'ok' end));
    if j ->> 'estado' = 'Vigente' and dias > amb then
      out := out || public.apih_hf('Roadmap', 'Propuesta estancada', case when dias > roj then 2 else 1 end, k, jsonb_build_array(k), (j ->> 'titulo') || ' lleva ' || dias || ' d en la fase ' || (j ->> 'fase'),
        'Umbral ' || amb::int || ' d (rojo ' || roj::int || ' d). Responsable: ' || coalesce(j ->> 'lider', '') || '. Avanzar, poner en espera o retirar.', x);
    end if;
    if j ->> 'estado' = 'En espera' and not public.apih_vacio(j, 'estadoRev') and public.apih_fecha(j, 'estadoRev') < hoy then
      out := out || public.apih_hf('Roadmap', 'Propuesta estancada', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': revisión de “En espera” vencida (' || public.apih_fd(public.apih_fecha(j, 'estadoRev')) || ')',
        'Motivo: ' || coalesce(nullif(j ->> 'estadoMotivo', ''), '—') || '. Decidir si se retoma, se rechaza o se retira.', x);
    end if;
    falta := '{}';
    if public.apih_vacio(j, 'sponsor') then falta := array_append(falta, ('sponsor')::text); end if;
    if j ->> 'fase' in ('Caso de Negocio', 'Aprobación') then
      if public.apih_vacio(j, 'bc') then falta := array_append(falta, ('business case')::text); end if;
      if not (public.apih_num(j, 'presupuesto') > 0) then falta := array_append(falta, ('costo estimado')::text); end if;
      if not (public.apih_num(j, 'beneficio') > 0) then falta := array_append(falta, ('beneficio estimado')::text); end if;
    end if;
    if coalesce(array_length(falta, 1), 0) > 0 and j ->> 'estado' = 'Vigente' then
      out := out || public.apih_hf('Roadmap', 'Propuesta incompleta', 1, k, jsonb_build_array(k), (j ->> 'titulo') || ': falta ' || array_to_string(falta, ', '),
        'Completa los datos para poder avanzar a la siguiente fase.', x);
    end if;
  end loop;
  -- proyectos de prioridad baja en Planificación con líder sobrecargado
  foreach k in array ids loop
    j := M -> k; continue when (j ->> '_prop')::boolean or j ->> 'estado' in ('Completado', 'Cancelado', 'Stand By');
    if j ->> 'prioridad' = 'Baja' and j ->> 'fase' = 'Planificación' and jsonb_array_length(coalesce(carga -> (j ->> 'lider'), '[]'::jsonb)) > cap then
      out := out || public.apih_hf('Roadmap', 'Sobrecarga de líder', 1, k, jsonb_build_array(k), 'Considera pausar ' || (j ->> 'titulo') || ' (prioridad baja, líder sobrecargado)',
        'Libera capacidad para proyectos de mayor prioridad.', jsonb_build_array(jsonb_build_object('t', 'Proponer “Pausar”', 'a', 'mkdec', 'id', k, 'tp', 'Pausar', 'ti', 'Pausar ' || (j ->> 'titulo'), 'rec', 'Prioridad baja y líder sobre su capacidad.')));
    end if;
  end loop;

  -- cambios que quien llama puede resolver (sponsor de la iniciativa, Responsable o Administra, con permiso sobre su área); no el que los solicitó salvo Administra
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is not null then
    for r in select q.id, substr(q.datos, 4)::jsonb j, (select i.area from public.registros_v i where i.id = substr(q.datos, 4)::jsonb ->> 'ini' and i.lista in ('APIH_Proyectos', 'APIH_Propuestas') limit 1) area
               from public.registros_v q where q.lista = 'APIH_Cambios' and left(substr(q.datos, 4), 1) = '{' loop
      continue when r.j ->> 'estado' is distinct from 'Solicitado';
      j := coalesce(M -> (r.j ->> 'ini'), '{}'::jsonb);
      camm := camm || jsonb_build_object(r.id, not public.apih_solo_lectura() and public.apih_edita_area(r.area)
        and (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or (nullif(j ->> 'sponsor', '') is not null and (j ->> 'sponsor') in (coalesce(per.nombre, ''), per.email)))
        and (per.rol = 'admin' or coalesce(r.j ->> 'solicita', '') is distinct from coalesce(nullif(per.nombre, ''), per.email)));
    end loop;
  end if;

  -- uid por orden de generación y orden por severidad (estable)
  select coalesce(jsonb_agg(f || jsonb_build_object('uid', 'F' || (o - 1)) order by -(f ->> 'sev')::int, o), '[]'::jsonb) into out from jsonb_array_elements(out) with ordinality t(f, o);
  return jsonb_build_object('hallazgos', out, 'puntajes', pun, 'evm', evmm, 'sem', semm, 'cambios', camm);
end $$;
revoke all on function public.apih_hallazgos(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios'); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
