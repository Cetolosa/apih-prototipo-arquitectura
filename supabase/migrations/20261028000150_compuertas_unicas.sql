-- =====================================================================================
-- APIH Prototipo · Iter 3a · Compuertas: UNA sola definición, en la base, con la lista completa (cumplidas y pendientes)
--   Antes la app tenía su propia copia (gates / gatesAprobar) para pintar las listas ✓/✗ y las dos copias se verificaban
--   con tests/contract. Ahora solo existe esta:
--     · apih_compuertas(id, hasta)      → [{t, ok}] para pasar a la fase `hasta` (o 'Cierre' para completar)
--     · apih_compuertas_aprobar(id)     → [{t, ok}] para aprobar una propuesta
--     · apih_faltan_transicion / apih_faltan_aprobar → solo las pendientes (las usan los comandos, igual que antes)
--     · apih_etapas(id)                 → todos los movimientos posibles de una iniciativa, cada uno con sus compuertas
-- =====================================================================================

create or replace function public.apih_g(t text, falla boolean) returns jsonb language sql immutable as
$$ select jsonb_build_object('t', t, 'ok', not coalesce(falla, false)) $$;

create or replace function public.apih_compuertas(p_id text, p_hasta text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; g jsonb := '[]'::jsonb; umbral numeric := coalesce((public.apih_cfg() ->> 'umbralCritico')::numeric, 15); n_hit int; pend int; k int;
  sinmit boolean; av int; todos boolean;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into hs from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into rs from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  n_hit := jsonb_array_length(hs);
  sinmit := exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral and coalesce(x ->> 'mit', '') !~ '\S');
  a := array_position(fs, j ->> 'fase'); b := array_position(fs, hasta);

  if hasta = 'Evaluación' then
    g := g || public.apih_g('Problema/objetivo descrito'::text, coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null);
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
  end if;
  if hasta = 'Caso de Negocio' then
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
    g := g || public.apih_g('Evaluación de valor/esfuerzo completada'::text, not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false));
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Aprobación' then
    g := g || public.apih_g('Presupuesto estimado'::text, not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
    g := g || public.apih_g('Beneficio esperado'::text, not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Business case redactado'::text, coalesce(j ->> 'bc', '') = '');
  end if;
  if hasta = 'Ejecución' then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Presupuesto asignado'::text, not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Al menos 2 hitos planificados'::text, n_hit < 2);
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    g := g || public.apih_g('Hitos de las fases anteriores completados'::text, not todos);
    g := g || public.apih_g('Sin hitos vencidos'::text, exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text));
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 then g := g || public.apih_g(case when pend > 0 then 'Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')' else 'Hitos de la fase ' || (j ->> 'fase') || ' completados' end, pend > 0); end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    g := g || public.apih_g('Avance al 100%'::text, av < 100);
    g := g || public.apih_g('Todos los hitos completados'::text, exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true'));
    g := g || public.apih_g('Sin riesgos críticos abiertos'::text, exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral));
  end if;
  return g;
end $$;

create or replace function public.apih_compuertas_aprobar(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare j jsonb; g jsonb := '[]'::jsonb;
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Propuestas' and id = p_id and left(substr(datos, 4), 1) = '{';
  if j is null then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  g := g || public.apih_g('Propuesta en fase Aprobación', coalesce(j ->> 'fase', '') <> 'Aprobación');
  g := g || public.apih_g('Sponsor identificado', coalesce(j ->> 'sponsor', '') = '');
  g := g || public.apih_g('Líder asignado', coalesce(j ->> 'lider', '') = '');
  g := g || public.apih_g('Presupuesto asignado', not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
  g := g || public.apih_g('Business case redactado', coalesce(j ->> 'bc', '') = '');
  g := g || public.apih_g('Decisión "Iniciar" aprobada en comité', not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
        and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada'));
  return g;
end $$;

create or replace function public.apih_faltan_aprobar(p_id text) returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(x ->> 't'), '{}'::text[]) from jsonb_array_elements(public.apih_compuertas_aprobar(p_id)) x where not (x ->> 'ok')::boolean $$;

create or replace function public.apih_faltan_transicion(p_id text, p_hasta text) returns text[] language sql stable security definer set search_path = public as
$$ select coalesce(array_agg(x ->> 't'), '{}'::text[]) from jsonb_array_elements(public.apih_compuertas(p_id, p_hasta)) x where not (x ->> 'ok')::boolean $$;

-- Movimientos posibles (cambiar de fase, aprobar, completar, cambiar de estado), con sus compuertas
create or replace function public.apih_etapas(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare r public.registros; j jsonb; es_prop boolean; fs text[]; idx int; ult text; out jsonb := '[]'::jsonb; f text; k int := 0; e text; est text[]; etiqueta text;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop); idx := array_position(fs, j ->> 'fase'); ult := fs[cardinality(fs)];
  if j ->> 'estado' = any (case when es_prop then array['Aprobada','Rechazada','Retirada'] else array['Completado','Cancelado'] end) then return out; end if;
  if j ->> 'estado' <> 'Stand By' then
    foreach f in array fs loop
      k := k + 1;
      if k <> idx then out := out || jsonb_build_object('id', 'f:' || f, 'g', 'Mover de fase', 't', (case when k > idx then 'Avanzar a ' else 'Volver a ' end) || f, 'kind', 'fase', 'to', f, 'gates', public.apih_compuertas(p_id, f)); end if;
    end loop;
    if es_prop and j ->> 'fase' = ult then out := out || jsonb_build_object('id', 'aprobar', 'g', 'Mover de fase', 't', 'Aprobar y crear proyecto', 'kind', 'aprobar', 'gates', public.apih_compuertas_aprobar(p_id)); end if;
    if not es_prop and j ->> 'fase' = ult then out := out || jsonb_build_object('id', 'e:Completado', 'g', 'Mover de fase', 't', 'Completar proyecto', 'kind', 'estado', 'estado', 'Completado', 'gates', public.apih_compuertas(p_id, 'Cierre'), 'motivo', false, 'rev', false); end if;
  end if;
  est := case when es_prop then array['Vigente','En espera','Stand By','Rechazada','Retirada'] else array['En curso','Pausado','Stand By','Cancelado'] end;
  foreach e in array est loop
    if e = j ->> 'estado' then continue; end if;
    etiqueta := case e when 'Pausado' then 'Pausar' when 'En espera' then 'Poner en espera' when 'Stand By' then 'Dejar en Stand By' when 'Cancelado' then 'Cancelar proyecto'
                       when 'Rechazada' then 'Rechazar propuesta' when 'Retirada' then 'Retirar propuesta' when 'En curso' then 'Reactivar proyecto' when 'Vigente' then 'Reactivar propuesta' else e end;
    out := out || jsonb_build_object('id', 'e:' || e, 'g', 'Cambiar estado', 't', etiqueta, 'kind', 'estado', 'estado', e, 'gates', '[]'::jsonb,
             'motivo', e = any (array['En espera','Pausado','Stand By','Rechazada','Retirada','Cancelado']), 'rev', e = any (array['En espera','Pausado']));
  end loop;
  return out;
end $$;

revoke all on function public.apih_g(text, boolean), public.apih_compuertas(text, text), public.apih_compuertas_aprobar(text), public.apih_etapas(text) from public, anon;
grant execute on function public.apih_compuertas(text, text), public.apih_compuertas_aprobar(text), public.apih_etapas(text) to authenticated;
grant execute on function public.apih_g(text, boolean) to authenticated;
