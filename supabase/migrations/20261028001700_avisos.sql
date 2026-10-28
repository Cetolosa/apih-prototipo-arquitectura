-- =====================================================================================
-- APIH Prototipo · Iter 5e · Avisos (notificaciones): las reglas viven en el servidor
--   Antes el navegador calculaba qué avisar a quién (hitos y compromisos por vencer, riesgo crítico, atraso, sin actualización,
--   cambios pendientes y eventos de la bitácora). Ahora apih_calculos() entrega «notif»:
--     catalogo  qué avisos existen, grupos, destinatarios posibles y canales (definición única)
--     prefs     preferencia efectiva de quien llama por tipo (por defecto del catálogo → organización → la persona)
--     avisos    los avisos de quien llama, ordenados (fecha y gravedad), con los canales por los que se entregan
--   La configuración (qué se avisa, a quién, canales) se sigue guardando en cfg / cfgU como datos; la regla que la interpreta es del servidor.
-- =====================================================================================

create or replace function public.apih_cfg_def(k text) returns numeric language sql immutable as
$$ select case k when 'umbralCritico' then 15 when 'tolDesv' then 7 when 'diasSinUpdate' then 14 when 'decMaxDias' then 30 when 'descMax' then 500 when 'propDiasAmb' then 30 end::numeric $$;

create or replace function public.apih_notif_catalogo() returns jsonb language sql immutable as
$j$ select $cat${"canales": [["app", "En la app", true], ["correo", "Correo", false], ["teams", "Teams", false]], "destinos": [["lider", "Líder"], ["sponsor", "Sponsor"], ["resp", "Responsable directo"], ["pmo", "PMO (Administra)"]], "grupos": {"plazos": "Plazos y compromisos", "riesgos": "Riesgos y decisiones", "salud": "Salud y avance", "colab": "Colaboración", "gob": "Gobierno y cambios"}, "tipos": [{"id": "hito_prox", "g": "plazos", "l": "Hito por vencer", "d": "Un hito pendiente vence en los próximos días.", "sev": 1, "on": true, "dest": ["resp", "lider"], "dias": 3, "diasL": "días de anticipación"}, {"id": "hito_venc", "g": "plazos", "l": "Hito vencido", "d": "Un hito de un proyecto en curso pasó su fecha sin completarse.", "sev": 2, "on": true, "dest": ["resp", "lider"]}, {"id": "comp_prox", "g": "plazos", "l": "Compromiso por vencer", "d": "Un compromiso abierto vence en los próximos días.", "sev": 1, "on": true, "dest": ["resp"], "dias": 3, "diasL": "días de anticipación"}, {"id": "comp_venc", "g": "plazos", "l": "Compromiso vencido", "d": "Un compromiso abierto pasó su fecha límite.", "sev": 2, "on": true, "dest": ["resp", "pmo"]}, {"id": "riesgo_crit", "g": "riesgos", "l": "Riesgo crítico abierto", "d": "Un riesgo abierto supera el umbral de exposición crítica.", "sev": 3, "on": true, "dest": ["resp", "lider"]}, {"id": "dec_venc", "g": "riesgos", "l": "Decisión vencida", "d": "Una decisión pendiente pasó su fecha límite.", "sev": 2, "on": true, "dest": ["resp", "pmo"]}, {"id": "atraso", "g": "salud", "l": "Proyecto atrasado", "d": "La fecha proyectada supera la tolerancia de desviación.", "sev": 2, "on": true, "dest": ["lider", "sponsor"]}, {"id": "sin_update", "g": "salud", "l": "Proyecto sin actualización", "d": "Se superó el plazo sin actualizar el avance.", "sev": 1, "on": true, "dest": ["lider"]}, {"id": "prop_estancada", "g": "salud", "l": "Propuesta estancada", "d": "Una propuesta lleva más días de lo esperado en su fase.", "sev": 1, "on": false, "dest": ["lider"]}, {"id": "ev_rag", "g": "salud", "l": "Salud pasa a Rojo", "d": "Un proyecto cambió su RAG a Rojo (últimos 14 días).", "sev": 3, "on": true, "dest": ["lider", "sponsor", "pmo"], "ev": true}, {"id": "ev_fase", "g": "salud", "l": "Cambio de fase", "d": "Una iniciativa avanzó de fase (últimos 14 días).", "sev": 1, "on": true, "dest": ["lider", "sponsor"], "ev": true}, {"id": "ev_asigna", "g": "colab", "l": "Te asignaron como responsable", "d": "Quedaste como responsable o dueño de una iniciativa, hito o riesgo.", "sev": 1, "on": true, "dest": ["resp"], "ev": true, "fijoDest": true}, {"id": "ev_comentario", "g": "colab", "l": "Comentario nuevo", "d": "Otra persona comentó una iniciativa que lideras o patrocinas.", "sev": 1, "on": true, "dest": ["lider", "sponsor"], "ev": true}, {"id": "cambio_pend", "g": "gob", "l": "Solicitud de cambio pendiente", "d": "Hay una solicitud de cambio esperando aprobación.", "sev": 2, "on": true, "dest": ["pmo"]}, {"id": "cambio_res", "g": "gob", "l": "Solicitud de cambio resuelta", "d": "Se aprobó o rechazó una solicitud que hiciste (últimos 14 días).", "sev": 1, "on": true, "dest": ["resp"], "ev": true, "fijoDest": true}]}$cat$::jsonb $j$;

create or replace function public.apih_fmt_d(d text) returns text language sql immutable as
$$ select case when d ~ '^\d{4}-\d{2}-\d{2}' then to_char(substr(d, 1, 10)::date, 'DD') || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'])[extract(month from substr(d, 1, 10)::date)::int] || ' ' || substr(d, 3, 2) else '—' end $$;

create or replace function public.apih_cut(s text, n int) returns text language sql immutable as
$$ select case when length(coalesce(s, '')) > n then left(s, n - 1) || '…' else coalesce(s, '') end $$;

-- Preferencia efectiva de un tipo para una persona: valores del catálogo → organización (cfg.notif) → persona (cfgU.v.notif)
create or replace function public.apih_notif_pref(p_email text, p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare c jsonb; o jsonb; p jsonb; ur jsonb;
begin
  select e into c from jsonb_array_elements(public.apih_notif_catalogo() -> 'tipos') e where e ->> 'id' = p_id;
  o := coalesce(public.apih_cfg() #> array['notif', 'tipos', p_id], '{}'::jsonb);
  select substr(datos, 4)::jsonb into ur from public.registros where lista = 'APIH_Config' and id = 'cfgU:' || p_email and left(substr(datos, 4), 1) = '{';
  p := coalesce(ur #> array['v', 'notif', 'tipos', p_id], '{}'::jsonb);
  return jsonb_build_object(
    'on', coalesce(nullif(p -> 'on', 'null'::jsonb), nullif(o -> 'on', 'null'::jsonb), c -> 'on'),
    'dest', coalesce(nullif(o -> 'dest', 'null'::jsonb), c -> 'dest'),
    'dias', coalesce(nullif(o -> 'dias', 'null'::jsonb), c -> 'dias'),
    'canales', jsonb_build_object('app', true, 'correo', false, 'teams', false) || coalesce(o -> 'canales', '{}'::jsonb) || coalesce(p -> 'canales', '{}'::jsonb));
end $$;

-- ¿Aplica el aviso a la persona? (preferencia activa y relación con la iniciativa / el ítem entre los destinatarios)
create or replace function public.apih_aviso_aplica(p jsonb, p_ini jsonb, p_resp text, p_u text, p_admin boolean) returns boolean language sql immutable as
$$ select coalesce((p ->> 'on')::boolean, false) and exists (
     select 1 from jsonb_array_elements_text(p -> 'dest') k
      where (k = 'lider' and p_ini is not null and public.apih_norm(p_ini ->> 'lider') = p_u)
         or (k = 'sponsor' and p_ini is not null and public.apih_norm(p_ini ->> 'sponsor') = p_u)
         or (k = 'resp' and coalesce(p_resp, '') <> '' and public.apih_norm(p_resp) = p_u)
         or (k = 'pmo' and p_admin)) $$;

create or replace function public.apih_aviso_mk(cat jsonb, p_id text, p_key text, p_ini text, p_texto text, p_ts text, p_sev int default null) returns jsonb language sql immutable as
$$ select jsonb_build_object('key', p_id || ':' || p_key, 'tipo', p_id, 'g', c ->> 'g', 'sev', coalesce(p_sev, (c ->> 'sev')::int), 'ini', p_ini, 'titulo', c ->> 'l', 'texto', p_texto, 'ts', p_ts)
   from jsonb_array_elements(cat) c where c ->> 'id' = p_id $$;

create or replace function public.apih_avisos(calc jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); em text := public.apih_email(); pf public.perfiles; u text; adm boolean; cfg jsonb := public.apih_cfg();
  cat jsonb := public.apih_notif_catalogo(); tipos jsonb := cat -> 'tipos'; P jsonb := '{}'::jsonb; e jsonb; avs jsonb := '[]'::jsonb;
  I jsonb := '{}'::jsonb; r record; j jsonb; ij jsonb; ijj jsonb; d int; ph int; pc int; ts text; t text; c jsonb; amb int; dsu int; k text; arr text[]; ok boolean;
  fa text[] := array['Planificación', 'Ejecución', 'Transición']; ventana int := 14; canalon jsonb := coalesce(cfg #> '{notif,canalOn}', '{}'::jsonb);
  m text[]; body text; ent text; kind text; filas text[][]; parte text; a int; b int; valid boolean; f1 text; f2 text; f3 text; tit text;
begin
  select * into pf from public.perfiles where email = em and activo;
  if not found then return jsonb_build_object('catalogo', cat, 'prefs', '{}'::jsonb, 'avisos', '[]'::jsonb); end if;
  u := public.apih_norm(coalesce(nullif(pf.nombre, ''), pf.email)); adm := pf.app_rol = 'Administra';
  for e in select v from jsonb_array_elements(tipos) v loop P := P || jsonb_build_object(e ->> 'id', public.apih_notif_pref(em, e ->> 'id')); end loop;
  ph := (P -> 'hito_prox' ->> 'dias')::int; pc := (P -> 'comp_prox' ->> 'dias')::int;
  -- iniciativas visibles para quien llama (RLS) con su estado de vida
  for r in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    I := I || jsonb_build_object(r.id, jsonb_build_object('l', r.lista, 'j', r.j,
      'viva', coalesce(r.j ->> 'estado', '') <> 'Stand By' and not (coalesce(r.j ->> 'estado', '') = any (case when r.lista = 'APIH_Propuestas' then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end))));
  end loop;
  -- hitos pendientes de proyectos en curso
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and coalesce(substr(datos, 4)::jsonb ->> 'completado', 'false') <> 'true' loop
    ij := I -> (r.j ->> 'ini'); if ij is null or not (ij ->> 'viva')::boolean or coalesce(ij -> 'j' ->> 'estado', '') <> 'En curso' then continue; end if;
    d := public.apih_fecha(r.j, 'fecha') - hoy; tit := ij -> 'j' ->> 'titulo';
    if d < 0 then
      if public.apih_aviso_aplica(P -> 'hito_venc', ij -> 'j', r.j ->> 'resp', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'hito_venc', r.j ->> 'id', r.j ->> 'ini', '«' || (r.j ->> 'nombre') || '» venció hace ' || (-d) || ' d (' || public.apih_fmt_d(r.j ->> 'fecha') || ') · ' || tit, r.j ->> 'fecha', case when -d > 30 then 3 else 2 end); end if;
    elsif d <= ph and public.apih_aviso_aplica(P -> 'hito_prox', ij -> 'j', r.j ->> 'resp', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'hito_prox', r.j ->> 'id', r.j ->> 'ini', '«' || (r.j ->> 'nombre') || '» vence ' || case when d = 0 then 'hoy' else 'en ' || d || ' d' end || ' (' || public.apih_fmt_d(r.j ->> 'fecha') || ') · ' || tit, r.j ->> 'fecha'); end if;
  end loop;
  -- compromisos abiertos (los de iniciativas en Stand By no cuentan)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' = 'Abierto' and coalesce(substr(datos, 4)::jsonb ->> 'limite', '') <> '' loop
    ij := null;
    if coalesce(r.j ->> 'ini', '') <> '' then ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; if ij -> 'j' ->> 'estado' = 'Stand By' then continue; end if; end if;
    d := public.apih_fecha(r.j, 'limite') - hoy; ijj := ij -> 'j';
    if d < 0 then
      if public.apih_aviso_aplica(P -> 'comp_venc', ijj, r.j ->> 'resp', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'comp_venc', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'texto', 70) || '» venció hace ' || (-d) || ' d · ' || coalesce(nullif(r.j ->> 'resp', ''), 'sin responsable'), r.j ->> 'limite'); end if;
    elsif d <= pc and public.apih_aviso_aplica(P -> 'comp_prox', ijj, r.j ->> 'resp', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'comp_prox', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'texto', 70) || '» vence ' || case when d = 0 then 'hoy' else 'en ' || d || ' d' end || ' · ' || coalesce(nullif(r.j ->> 'resp', ''), 'sin responsable'), r.j ->> 'limite'); end if;
  end loop;
  -- riesgos críticos abiertos
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' is distinct from 'Cerrado' loop
    if coalesce((calc -> 'riesgos' -> (r.j ->> 'id') ->> 'critico')::boolean, false) is not true then continue; end if;
    ij := I -> (r.j ->> 'ini'); if ij is null or not (ij ->> 'viva')::boolean then continue; end if;
    if public.apih_aviso_aplica(P -> 'riesgo_crit', ij -> 'j', r.j ->> 'dueno', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'riesgo_crit', r.j ->> 'id', r.j ->> 'ini', 'Exposición ' || trim_scale((calc -> 'riesgos' -> (r.j ->> 'id') ->> 'expo')::numeric)::text || ': ' || public.apih_cut(r.j ->> 'desc', 80) || ' · ' || (ij -> 'j' ->> 'titulo'), coalesce(nullif(r.j ->> 'fIdent', ''), hoy::text)); end if;
  end loop;
  -- decisiones pendientes vencidas
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'estado' = 'Pendiente' and coalesce(substr(datos, 4)::jsonb ->> 'limite', '') <> '' loop
    if public.apih_fecha(r.j, 'limite') >= hoy then continue; end if;
    ij := null; if coalesce(r.j ->> 'ini', '') <> '' then ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; end if;
    if public.apih_aviso_aplica(P -> 'dec_venc', ij -> 'j', r.j ->> 'solicita', u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'dec_venc', r.j ->> 'id', r.j ->> 'ini', '«' || public.apih_cut(r.j ->> 'titulo', 70) || '» venció hace ' || (hoy - public.apih_fecha(r.j, 'limite')) || ' d', r.j ->> 'limite'); end if;
  end loop;
  -- salud de los proyectos activos y propuestas estancadas
  for r in select key as id, value as v from jsonb_each(I) loop
    ij := r.v; j := ij -> 'j'; if not (ij ->> 'viva')::boolean then continue; end if;
    if ij ->> 'l' = 'APIH_Proyectos' and coalesce(j ->> 'tipo', '') <> 'Propuesta' then
      if (j ->> 'fase') = any (fa) and j ->> 'estado' = 'En curso' then
        c := calc -> 'ini' -> r.id;
        if coalesce((c ->> 'atrasado')::boolean, false) and public.apih_aviso_aplica(P -> 'atraso', j, null, u, adm) then
          avs := avs || public.apih_aviso_mk(tipos, 'atraso', r.id, r.id, (j ->> 'titulo') || ': +' || (c ->> 'desv') || ' d sobre el plan', hoy::text); end if;
        dsu := coalesce((c ->> 'dsu')::int, 999);
        if dsu > public.apih_umbral(j, 'diasSinUpdate') and public.apih_aviso_aplica(P -> 'sin_update', j, null, u, adm) then
          avs := avs || public.apih_aviso_mk(tipos, 'sin_update', r.id, r.id, (j ->> 'titulo') || ': ' || case when dsu >= 999 then 'sin registro de actualización' else dsu || ' d sin actualizar' end, hoy::text); end if;
      end if;
    elsif ij ->> 'l' = 'APIH_Propuestas' and j ->> 'estado' = 'Vigente' then
      d := hoy - coalesce(public.apih_fecha(j, 'faseDesde'), public.apih_fecha(j, 'actualizada'), public.apih_fecha(j, 'creada'), hoy);
      amb := coalesce(nullif(public.apih_umbral(j, 'propDiasAmb'), 0), 30)::int;
      if d > amb and public.apih_aviso_aplica(P -> 'prop_estancada', j, null, u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'prop_estancada', r.id, r.id, (j ->> 'titulo') || ': ' || d || ' d en la fase ' || (j ->> 'fase'), hoy::text); end if;
    end if;
  end loop;
  -- solicitudes de cambio: pendientes (regla) y resueltas en la ventana (evento)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Cambios' and left(substr(datos, 4), 1) = '{' loop
    ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if;
    if r.j ->> 'estado' = 'Solicitado' then
      if public.apih_aviso_aplica(P -> 'cambio_pend', ij -> 'j', r.j ->> 'aprobador', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'cambio_pend', r.j ->> 'id', r.j ->> 'ini', (r.j ->> 'tipo') || ': ' || public.apih_cut(coalesce(nullif(r.j ->> 'desc', ''), r.j ->> 'id'), 70) || ' · pide ' || coalesce(nullif(r.j ->> 'solicita', ''), '—'), coalesce(nullif(r.j ->> 'creada', ''), hoy::text)); end if;
    elsif coalesce(r.j ->> 'fDec', '') <> '' and hoy - public.apih_fecha(r.j, 'fDec') <= ventana then
      if public.apih_aviso_aplica(P -> 'cambio_res', ij -> 'j', r.j ->> 'solicita', u, adm) then
        avs := avs || public.apih_aviso_mk(tipos, 'cambio_res', r.j ->> 'id', r.j ->> 'ini', 'Tu solicitud de ' || lower(coalesce(r.j ->> 'tipo', '')) || ' fue ' || lower(coalesce(r.j ->> 'estado', '')) || ' · ' || public.apih_cut(coalesce(nullif(r.j ->> 'desc', ''), r.j ->> 'id'), 60), r.j ->> 'fDec'); end if;
    end if;
  end loop;
  -- eventos de la bitácora (últimos 14 días; no avisan al autor del cambio)
  for r in select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Bitacora' and left(substr(datos, 4), 1) = '{' and coalesce(substr(datos, 4)::jsonb ->> 'ini', '') <> '' loop
    ts := left(coalesce(r.j ->> 'ts', ''), 10); if ts !~ '^\d{4}-\d{2}-\d{2}$' or hoy - ts::date > ventana then continue; end if;
    if public.apih_norm(r.j ->> 'autor') = u then continue; end if;
    ij := I -> (r.j ->> 'ini'); if ij is null then continue; end if; t := coalesce(r.j ->> 'texto', ''); tit := ij -> 'j' ->> 'titulo'; ijj := ij -> 'j';
    if r.j ->> 'tipo' = 'Comentario' and t !~ '^Estrella Michelin' and public.apih_aviso_aplica(P -> 'ev_comentario', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_comentario', r.j ->> 'id', r.j ->> 'ini', (r.j ->> 'autor') || ': «' || public.apih_cut(t, 90) || '» · ' || tit, ts); end if;
    if r.j ->> 'tipo' = 'Cambio' and t ~ '^Cambio de fase' and public.apih_aviso_aplica(P -> 'ev_fase', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_fase', r.j ->> 'id', r.j ->> 'ini', tit || ': ' || regexp_replace(regexp_replace(t, '^Cambio de fase: ', ''), ' \(forzado.*$', ''), ts); end if;
    if r.j ->> 'tipo' = 'Cambio' and t ~ '^RAG .*→ Rojo' and public.apih_aviso_aplica(P -> 'ev_rag', ijj, null, u, adm) then
      avs := avs || public.apih_aviso_mk(tipos, 'ev_rag', r.j ->> 'id', r.j ->> 'ini', tit || ': ' || t, ts); end if;
    if r.j ->> 'tipo' = 'Edición' and coalesce((P -> 'ev_asigna' ->> 'on')::boolean, false) then
      -- «Hito «x» — Responsable: a → b | Dueño: c → d»: se leen las filas «campo: antes → después»
      m := regexp_match(t, '^(Hito|Riesgo|Decisión|Compromiso|Cambio) «(.*?)» — ');
      body := case when m is not null then regexp_replace(t, '^(Hito|Riesgo|Decisión|Compromiso|Cambio) «(.*?)» — ', '') else t end;
      ent := coalesce(m[2], ''); kind := coalesce(m[1], 'Iniciativa'); valid := true;
      foreach parte in array string_to_array(body, ' | ') loop
        a := strpos(parte, ': '); b := strpos(parte, ' → ');
        if not (a > 1 and b > a) then valid := false; end if;
      end loop;
      if valid then
        foreach parte in array string_to_array(body, ' | ') loop
          a := strpos(parte, ': '); b := strpos(parte, ' → '); f1 := left(parte, a - 1); f2 := substr(parte, a + 2, b - a - 2); f3 := substr(parte, b + 3);
          if f1 ~ '^(Responsable|Dueño)$' and public.apih_norm(f3) = u then
            avs := avs || public.apih_aviso_mk(tipos, 'ev_asigna', (r.j ->> 'id') || f1, r.j ->> 'ini',
              case when ent <> '' then kind || ' «' || ent || '»' else tit end || ': ahora eres ' || case when f1 = 'Dueño' then 'dueño' else 'responsable' end || ' (antes ' || f2 || ') · ' || tit, ts);
          end if;
        end loop;
      end if;
    end if;
  end loop;
  -- canales por los que se entrega cada aviso: los activos para la persona (la app siempre; correo y Teams solo si la organización los habilitó)
  select coalesce(jsonb_agg(q || jsonb_build_object('canales', (
           select coalesce(jsonb_agg(c2 ->> 0), '[]'::jsonb) from jsonb_array_elements(cat -> 'canales') c2
            where coalesce((P -> (q ->> 'tipo') -> 'canales' ->> (c2 ->> 0))::boolean, false) and ((c2 ->> 0) = 'app' or coalesce((canalon ->> (c2 ->> 0))::boolean, false))))
         order by q ->> 'ts' desc, (q ->> 'sev')::int desc), '[]'::jsonb) into avs from jsonb_array_elements(avs) q;
  return jsonb_build_object('catalogo', cat, 'prefs', P, 'avisos', avs);
end $$;
revoke all on function public.apih_avisos(jsonb), public.apih_notif_pref(text, text), public.apih_aviso_aplica(jsonb, jsonb, text, text, boolean) from public, anon, authenticated;

-- apih_calculos entrega también los avisos
create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c), 'notif', public.apih_avisos(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
