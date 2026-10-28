-- =====================================================================================
-- APIH Prototipo · V23 · Ciclo de vida
--   · Avance calculado (subfases e hitos por fase, ponderado por días si todas las fases tienen fechas) en la base,
--     con el mismo resultado que la app (contrato tests/contract/avance_calc.json).
--   · Compuertas de TRANSICIÓN evaluadas en la base (apih_faltan_transicion), con el mismo resultado que la app
--     (contrato tests/contract/gates_transicion.json).
--   · apih_transicion(id, fase | estado, ...): único comando para cambiar de fase o de estado. Reemplaza las escrituras
--     directas de «fase» y «estado» (la puerta lateral queda cerrada para quien no es Administra: ver apih_fila).
--   · Fechas de fase explícitas (fasesFechas): reparto del rango plan, aprobación de propuestas y cambios aprobados.
--   · apih_hito_estado recalcula el avance y cierra el proyecto solo cuando se completa lo último de la última fase.
-- =====================================================================================

-- Fases de la metodología (propuesta o proyecto)
create or replace function public.apih_fases(p_prop boolean) returns text[] language sql stable security definer set search_path = public as
$$ select array(select jsonb_array_elements_text(coalesce(
       public.apih_cfg() #> (case when p_prop then '{metodo,fasesProp}' else '{metodo,fasesPrj}' end)::text[],
       case when p_prop then '["Recepción","Evaluación","Caso de Negocio","Aprobación"]' else '["Planificación","Ejecución","Transición","Cierre"]' end::jsonb))) $$;

create or replace function public.apih_fecha_fase_ok(x jsonb) returns boolean language sql immutable as
$$ select x is not null and jsonb_typeof(x) = 'object' and jsonb_typeof(x -> 'ini') = 'string' and jsonb_typeof(x -> 'fin') = 'string'
          and (x ->> 'ini') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'fin') ~ '^\d{4}-\d{2}-\d{2}$' and (x ->> 'fin') >= (x ->> 'ini') $$;

-- Avance de UNA fase (0..1): promedio de sus unidades = cada subfase (hitos cerrados / hitos de la subfase) y cada hito suelto. null si no hay unidades.
create or replace function public.apih_avance_fase(p jsonb, p_id text, f text) returns numeric language sql stable security definer set search_path = public as
$$ with h as (select substr(datos, 4)::jsonb j from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id),
        hf as (select j ->> 'subfase' sf, coalesce(j ->> 'completado' = 'true', false) c from h where j ->> 'fase' = f),
        subs as (select s ->> 'id' id from jsonb_array_elements(coalesce(p -> 'subfases', '[]'::jsonb)) s where s ->> 'fase' = f),
        u as (select coalesce((select count(*) filter (where c)::numeric / nullif(count(*), 0) from hf where hf.sf = subs.id), 0) v from subs
              union all
              select case when c then 1 else 0 end from hf where not exists (select 1 from subs where subs.id = hf.sf))
   select avg(v) from u $$;

create or replace function public.apih_avance_calc(p jsonb, p_id text) returns int language plpgsql stable security definer set search_path = public as
$$
declare fs text[] := public.apih_fases(false); ff jsonb := coalesce(p -> 'fasesFechas', '{}'::jsonb); f text; k int := 0; idx int; pesar boolean := true; w numeric := 0; s numeric := 0; peso numeric; pr numeric;
begin
  if p ->> 'tipo' = 'Propuesta' then return 0; end if;
  idx := array_position(fs, p ->> 'fase');
  foreach f in array fs loop if not public.apih_fecha_fase_ok(ff -> f) then pesar := false; end if; end loop;
  foreach f in array fs loop
    k := k + 1;
    peso := case when pesar then greatest(1, (ff -> f ->> 'fin')::date - (ff -> f ->> 'ini')::date + 1) else 1 end;
    pr := public.apih_avance_fase(p, p_id, f);
    if pr is null then pr := case when idx is not null and k < idx then 1 else 0 end; end if;
    w := w + peso; s := s + peso * pr;
  end loop;
  return case when w > 0 then round(s / w * 100)::int else 0 end;
end $$;

-- Deja avance / avanceCalc / hist de un proyecto al día (mismo criterio que sincAvance de la app). Devuelve el JSON; no escribe.
create or replace function public.apih_avance_fila(j jsonb, p_id text, p_hoy date) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare c int := public.apih_avance_calc(j, p_id); m int; ef int; h jsonb; av numeric := coalesce(case when jsonb_typeof(j -> 'avance') = 'number' then (j ->> 'avance')::numeric end, 0); n int;
begin
  if j ->> 'tipo' = 'Propuesta' then return j; end if;
  m := case when jsonb_typeof(j -> 'avanceManual') = 'number' then greatest(0, least(100, round((j ->> 'avanceManual')::numeric)))::int end;
  if not (j ? 'avanceCalc') and m is null and round(av) > 0 and round(av) <> c then m := round(av)::int; j := j || jsonb_build_object('avanceManual', m); end if;
  if j ->> 'estado' = 'Completado' then return j || jsonb_build_object('avance', 100, 'avanceCalc', c); end if;
  ef := coalesce(m, c);
  h := case when jsonb_typeof(j -> 'hist') = 'array' then j -> 'hist' else '[]'::jsonb end; n := jsonb_array_length(h);
  if round(av) <> ef or n = 0 then
    if n > 0 and (h -> (n - 1) ->> 0) = p_hoy::text then h := jsonb_set(h, array[(n - 1)::text], jsonb_build_array(p_hoy::text, ef));
    else h := h || jsonb_build_array(jsonb_build_array(p_hoy::text, ef)); end if;
    j := j || jsonb_build_object('hist', h);
  end if;
  return j || jsonb_build_object('avance', ef, 'avanceCalc', c);
end $$;

-- Reparto del rango plan entre las fases (15/55/15/15 si son 4; partes iguales en otro caso)
create or replace function public.apih_distribuir_fases(p_ini date, p_fin date, fs text[]) returns jsonb language plpgsql immutable as
$$
declare t int := p_fin - p_ini + 1; n int := cardinality(fs); est4 boolean := n = 4; pw int[] := array[15, 55, 15, 15]; c date := p_ini; o jsonb := '{}'; k int; d int; e date;
begin
  if p_fin < p_ini or n = 0 then return null; end if;
  for k in 1..n loop
    if k = n then d := t - (c - p_ini); e := p_fin;
    else d := greatest(1, round(case when est4 then t::numeric * pw[k] / 100 else t::numeric / n end)::int); e := c + d - 1; end if;
    if e < c then e := c; end if;
    o := o || jsonb_build_object(fs[k], jsonb_build_object('ini', c::text, 'fin', e::text));
    c := e + 1;
  end loop;
  return o;
end $$;

-- Cambia el rango plan de un proyecto: reparte o reescala las fases, acota las subfases y deriva inicioPlan/finPlan (como setRangoPlan de la app)
create or replace function public.apih_set_rango_plan(i jsonb, p_ini text, p_fin text, fs text[]) returns jsonb language plpgsql immutable as
$$
declare cur jsonb := coalesce(i -> 'fasesFechas', '{}'::jsonb); explicita boolean := true; f text; r0i date; r0f date; s0 int; s1 int; ff jsonb := '{}'; prev date; a date; b date; n int := cardinality(fs);
  ult text := fs[cardinality(fs)]; uini date; w jsonb; sf jsonb; nuevas jsonb := '[]'::jsonb; si text; sfi text;
begin
  if p_ini !~ '^\d{4}-\d{2}-\d{2}$' or p_fin !~ '^\d{4}-\d{2}-\d{2}$' or p_fin < p_ini then return i || jsonb_build_object('inicioPlan', nullif(p_ini, ''), 'finPlan', nullif(p_fin, '')); end if;
  foreach f in array fs loop if not public.apih_fecha_fase_ok(cur -> f) then explicita := false; end if; end loop;
  if explicita then
    select min((cur -> x ->> 'ini')::date), max((cur -> x ->> 'fin')::date) into r0i, r0f from unnest(fs) x;
  end if;
  if explicita and (r0f - r0i) > 0 then
    s0 := r0f - r0i; s1 := p_fin::date - p_ini::date;
    foreach f in array fs loop
      a := p_ini::date + round(((cur -> f ->> 'ini')::date - r0i)::numeric * s1 / s0)::int;
      b := p_ini::date + round(((cur -> f ->> 'fin')::date - r0i)::numeric * s1 / s0)::int;
      if prev is not null and a <= prev then a := prev + 1; end if;
      if b < a then b := a; end if;
      ff := ff || jsonb_build_object(f, jsonb_build_object('ini', a::text, 'fin', b::text)); prev := b;
    end loop;
    ff := jsonb_set(ff, array[fs[1], 'ini'], to_jsonb(p_ini));
    uini := (ff -> ult ->> 'ini')::date;
    ff := jsonb_set(ff, array[ult, 'fin'], to_jsonb((case when p_fin::date < uini then uini else p_fin::date end)::text));
  else
    ff := public.apih_distribuir_fases(p_ini::date, p_fin::date, fs);
  end if;
  if ff is null then return i; end if;
  -- subfases dentro de su fase
  for sf in select * from jsonb_array_elements(coalesce(i -> 'subfases', '[]'::jsonb)) loop
    w := ff -> (sf ->> 'fase');
    if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
      si := case when (sf ->> 'inicio') < (w ->> 'ini') then w ->> 'ini' when (sf ->> 'inicio') > (w ->> 'fin') then w ->> 'ini' else sf ->> 'inicio' end;
      sfi := case when (sf ->> 'fin') > (w ->> 'fin') then w ->> 'fin' when (sf ->> 'fin') < si then si else sf ->> 'fin' end;
      if sfi < si then si := w ->> 'ini'; sfi := w ->> 'fin'; end if;
      sf := sf || jsonb_build_object('inicio', si, 'fin', sfi);
    end if;
    nuevas := nuevas || jsonb_build_array(sf);
  end loop;
  select min(v ->> 'ini'), max(v ->> 'fin') into si, sfi from jsonb_each(ff) e(k, v);
  i := i || jsonb_build_object('fasesFechas', ff, 'inicioPlan', si, 'finPlan', sfi);
  if jsonb_array_length(nuevas) > 0 then i := i || jsonb_build_object('subfases', nuevas); end if;
  return i;
end $$;

-- Un cambio aprobado de fecha fin mueve el fin de la ÚLTIMA fase; si queda antes de su inicio, se reescala todo (como moverFinPlan de la app)
create or replace function public.apih_mover_fin_plan(i jsonb, p_fin text, fs text[]) returns jsonb language plpgsql immutable as
$$
declare ff jsonb := coalesce(i -> 'fasesFechas', '{}'::jsonb); explicita boolean := true; f text; ult text := fs[cardinality(fs)];
begin
  if i ->> 'tipo' = 'Propuesta' then return i || jsonb_build_object('finPlan', p_fin); end if;
  foreach f in array fs loop if not public.apih_fecha_fase_ok(ff -> f) then explicita := false; end if; end loop;
  if explicita and p_fin >= (ff -> ult ->> 'ini') then
    ff := jsonb_set(ff, array[ult, 'fin'], to_jsonb(p_fin));
    return i || jsonb_build_object('fasesFechas', ff, 'finPlan', (select max(v ->> 'fin') from jsonb_each(ff) e(k, v)), 'inicioPlan', (select min(v ->> 'ini') from jsonb_each(ff) e(k, v)));
  end if;
  return public.apih_set_rango_plan(i, coalesce(i ->> 'inicioPlan', ''), p_fin, fs);
end $$;

-- Compuertas para mover una iniciativa a la fase p_hasta ('Completado' = las de cierre). Misma definición que gates() de la app (js/01-nucleo.js).
create or replace function public.apih_faltan_transicion(p_id text, p_hasta text) returns text[] language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; falt text[] := '{}'; umbral numeric := coalesce((public.apih_cfg() ->> 'umbralCritico')::numeric, 15); n_hit int; pend int; k int;
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
    if coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null then falt := falt || 'Problema/objetivo descrito'::text; end if;
    if coalesce(j ->> 'sponsor', '') = '' then falt := falt || 'Sponsor identificado'::text; end if;
  end if;
  if hasta = 'Caso de Negocio' then
    if coalesce(j ->> 'sponsor', '') = '' then falt := falt || 'Sponsor identificado'::text; end if;
    if not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false) then falt := falt || 'Evaluación de valor/esfuerzo completada'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if hasta = 'Aprobación' then
    if not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) then falt := falt || 'Presupuesto estimado'::text; end if;
    if not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal') then falt := falt || 'Beneficio esperado'::text; end if;
    if coalesce(j ->> 'bc', '') = '' then falt := falt || 'Business case redactado'::text; end if;
  end if;
  if hasta = 'Ejecución' then
    if coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '' then falt := falt || 'Fechas plan definidas'::text; end if;
    if not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal') then falt := falt || 'Presupuesto asignado'::text; end if;
    if n_hit < 2 then falt := falt || 'Al menos 2 hitos planificados'::text; end if;
    if sinmit then falt := falt || 'Riesgos críticos con plan de mitigación'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    if not todos then falt := falt || 'Hitos de las fases anteriores completados'::text; end if;
    if exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text) then falt := falt || 'Sin hitos vencidos'::text; end if;
    if sinmit then falt := falt || 'Riesgos críticos con plan de mitigación'::text; end if;
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    if coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '' then falt := falt || 'Fechas plan definidas'::text; end if;
    if coalesce(j ->> 'lider', '') = '' then falt := falt || 'Líder asignado'::text; end if;
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 and pend > 0 then falt := falt || ('Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')')::text; end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    if av < 100 then falt := falt || 'Avance al 100%'::text; end if;
    if exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true') then falt := falt || 'Todos los hitos completados'::text; end if;
    if exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral) then falt := falt || 'Sin riesgos críticos abiertos'::text; end if;
  end if;
  return falt;
end $$;
revoke all on function public.apih_faltan_transicion(text, text) from public, anon;
grant execute on function public.apih_faltan_transicion(text, text) to authenticated;

-- Único comando para cambiar de fase o de estado. Exactamente uno de p_fase / p_estado.
--   estados: propuesta Vigente|En espera|Stand By|Rechazada|Retirada · proyecto En curso|Pausado|Stand By|Cancelado|Completado (Completado solo desde la última fase)
--   Aprobar una propuesta es apih_aprobar_propuesta; reabrir una iniciativa cerrada es apih_reabrir.
create or replace function public.apih_transicion(p_id text, p_fase text default null, p_estado text default null, p_motivo text default '', p_rev date default null, p_forzar boolean default false, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; es_prop boolean; fs text[]; ult text; prev_f text; prev_e text; hasta text; faltan text[] := '{}';
  motivo text := btrim(coalesce(p_motivo, '')); nota text := btrim(coalesce(p_nota, '')); forz text := ''; permitidos text[]; final_ text[]; necesita_mot boolean; necesita_rev boolean;
  hs jsonb; txt text;
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
revoke all on function public.apih_transicion(text, text, text, text, date, boolean, text) from public, anon;
grant execute on function public.apih_transicion(text, text, text, text, date, boolean, text) to authenticated;

-- Validación de los campos del ciclo de vida (fechas por fase, ajuste manual del avance)
create or replace function public.apih_validar_ciclo(p_lista text, j jsonb) returns void language plpgsql stable security definer set search_path = public as
$$
declare k text; n numeric; fs text[]; f text; prev text; w jsonb; sf jsonb; v jsonb;
begin
  if p_lista <> 'APIH_Proyectos' then return; end if;
  foreach k in array array['avanceManual', 'avanceCalc'] loop
    if j ? k and jsonb_typeof(j -> k) <> 'null' then
      if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023', hint = k; end if;
      n := (j ->> k)::numeric; if n < 0 or n > 100 then raise exception 'APIH: % fuera de 0..100', k using errcode = '22023', hint = k; end if;
    end if;
  end loop;
  v := j -> 'fasesFechas';
  if v is not null and jsonb_typeof(v) <> 'null' then
    if jsonb_typeof(v) <> 'object' then raise exception 'APIH: fasesFechas debe ser un objeto' using errcode = '22023', hint = 'fasesFechas'; end if;
    fs := public.apih_fases(false);
    for k in select jsonb_object_keys(v) loop
      if not (k = any(fs)) then raise exception 'APIH: fasesFechas trae una fase desconocida (%)', k using errcode = '22023', hint = 'fasesFechas'; end if;
      if not public.apih_fecha_fase_ok(v -> k) then raise exception 'APIH: la fase % necesita inicio y fin válidos (AAAA-MM-DD, fin no anterior al inicio)', k using errcode = '22023', hint = 'fasesFechas'; end if;
    end loop;
    foreach f in array fs loop
      if v ? f then
        if prev is not null and (v -> f ->> 'ini') <= prev then raise exception 'APIH: la fase % debe empezar después de que termine la anterior (%)', f, prev using errcode = '22023', hint = 'fasesFechas'; end if;
        prev := v -> f ->> 'fin';
      end if;
    end loop;
    for sf in select * from jsonb_array_elements(coalesce(case when jsonb_typeof(j -> 'subfases') = 'array' then j -> 'subfases' end, '[]'::jsonb)) loop
      w := v -> (sf ->> 'fase');
      if w is not null and ((sf ->> 'inicio') < (w ->> 'ini') or (sf ->> 'fin') > (w ->> 'fin')) then
        raise exception 'APIH: la subfase «%» queda fuera de su fase %', sf ->> 'nombre', sf ->> 'fase' using errcode = '22023', hint = 'subfases'; end if;
    end loop;
  end if;
end $$;

-- Completar / reabrir un hito: recalcula el avance y cierra el proyecto solo si era lo último de la última fase y cumple las compuertas de cierre
create or replace function public.apih_hito_estado(p_id text, p_completado boolean)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := (now() at time zone 'America/Santiago')::date; r public.registros; h jsonb; ir public.registros; i jsonb; fs text[]; auto boolean := false;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
  if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para editar hitos de esta área' using errcode = '42501'; end if;
  h := substr(r.datos, 4)::jsonb;
  h := h || jsonb_build_object('completado', p_completado, 'fechaReal', case when p_completado then hoy::text else null end);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || h::text where lista = 'APIH_Hitos' and id = p_id;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = h ->> 'ini';
  if found then
    i := substr(ir.datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text);
    if ir.lista = 'APIH_Proyectos' then
      i := public.apih_avance_fila(i, ir.id, hoy);
      fs := public.apih_fases(false);
      if p_completado and i ->> 'estado' = 'En curso' and i ->> 'fase' = fs[cardinality(fs)] and cardinality(public.apih_faltan_transicion(ir.id, 'Cierre')) = 0 then
        i := public.apih_avance_fila(i || jsonb_build_object('estado', 'Completado', 'finReal', hoy::text, 'estadoMotivo', '', 'estadoRev', null), ir.id, hoy);
        auto := true;
      end if;
    end if;
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(h ->> 'ini', 'Actualización', case when p_completado then 'Hito completado: ' else 'Hito reabierto: ' end || coalesce(h ->> 'nombre', ''));
  if auto then perform public.apih_bitacora(h ->> 'ini', 'Cambio', 'Estado: En curso → Completado — cierre automático: se completó lo último de la fase ' || (i ->> 'fase')); end if;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('completado', p_completado, 'fechaReal', h -> 'fechaReal', 'autoCompletado', auto);
end $$;
revoke all on function public.apih_hito_estado(text, boolean) from public, anon;
grant execute on function public.apih_hito_estado(text, boolean) to authenticated;

-- Trigger de filas: validaciones del ciclo de vida y puerta lateral cerrada.
--   Quien no es Administra (ni un comando del servidor) no puede escribir directamente fase, estado, motivo, revisión, faseDesde,
--   proyecto ni propuestaOrigen: se cambian con apih_transicion / apih_aprobar_propuesta / apih_reabrir / apih_resolver_decision.
--   Una iniciativa nueva nace en la primera fase y en el estado inicial.
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
  privilegiado boolean := coalesce(current_setting('apih.interno', true), '') = 'on' or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role' or public.apih_rol() = 'admin';
  fs0 text[]; est0 text;
begin
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
  new.datos := 'p1.' || jn::text;
  new.area  := public.apih_area_de(new.lista, jn);
  insert into public.auditoria(email, accion, lista, id_registro, area, toco_montos)
    values (new.modificado_por, lower(tg_op), new.lista, new.id, new.area, tocó);
  return new;
end $$;


-- Comandos redefinidos con el ciclo de vida (mismo contrato; cambian solo los pasos marcados «V23»)
create or replace function public.apih_aprobar_propuesta(p_id text, p_nota text default '', p_forzar boolean default false)
returns text language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; j jsonb; nj jsonb; pj jsonb; cfg jsonb; tipo jsonb; h jsonb; rec record; jr jsonb;
  faltan text[] := '{}'; nuevo text; nota text; fasesprop jsonb; fasesprj jsonb; hn text; base date; n_hit int := 0;
  ba text; bb text; autor text; ts text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;

  select * into r from public.registros where lista = 'APIH_Propuestas' and id = p_id for update;
  if not found then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para aprobar en el área %', coalesce(r.area, '—') using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'estado', '') <> 'Vigente' then raise exception 'APIH: la propuesta no está Vigente (estado: %)', coalesce(j ->> 'estado', '—') using errcode = '22023'; end if;

  -- compuertas: una sola definición en apih_faltan_aprobar (la app la replica solo para mostrarla; ver tests/contract)
  faltan := public.apih_faltan_aprobar(p_id);
  if cardinality(faltan) > 0 then
    if not (p_forzar and per.rol = 'admin') then
      raise exception 'APIH: compuertas incumplidas: %', array_to_string(faltan, ', ') using errcode = '22023';
    end if;
    nota := '[forzado: ' || array_to_string(faltan, ', ') || '] ' || btrim(coalesce(p_nota, ''));
  else
    nota := btrim(coalesce(p_nota, ''));
  end if;

  perform set_config('apih.interno', 'on', true);
  cfg := public.apih_cfg();
  fasesprop := coalesce(cfg #> '{metodo,fasesProp}', '["Recepción","Evaluación","Caso de Negocio","Aprobación"]'::jsonb);
  fasesprj  := coalesce(cfg #> '{metodo,fasesPrj}',  '["Planificación","Ejecución","Transición","Cierre"]'::jsonb);
  autor := coalesce(per.nombre, per.email);

  -- 1. proyecto nuevo
  nuevo := public.apih_siguiente('PRJ', 'APIH_Proyectos');
  nj := (j - 'proyecto' - 'legacyId') || jsonb_build_object(
    'id', nuevo, 'tipo', 'Proyecto', 'fase', 'Planificación', 'estado', 'En curso', 'rag', 'Verde', 'propuestaOrigen', p_id,
    'creada', hoy::text, 'actualizada', hoy::text, 'faseDesde', hoy::text, 'avance', 0, 'hist', jsonb_build_array(jsonb_build_array(hoy::text, 0)),
    'inicioReal', null, 'finReal', null, 'rec', null, 'estadoMotivo', '', 'estadoRev', null,
    'origen', coalesce(nullif(j ->> 'origen', ''), 'usuario'), 'finEst', j -> 'finPlan', 'est', coalesce(j -> 'est', '[]'::jsonb));
  if (nj ->> 'inicioPlan') ~ '^\d{4}-\d{2}-\d{2}$' and (nj ->> 'finPlan') ~ '^\d{4}-\d{2}-\d{2}$' and (nj ->> 'finPlan') >= (nj ->> 'inicioPlan') then
    nj := nj || jsonb_build_object('fasesFechas', public.apih_distribuir_fases((nj ->> 'inicioPlan')::date, (nj ->> 'finPlan')::date, public.apih_fases(false)));   -- V23: las fechas de fase nacen explícitas
  end if;
  insert into public.registros(lista, id, datos) values ('APIH_Proyectos', nuevo, 'p1.' || nj::text);

  -- 2. riesgos y hitos de la propuesta pasan al proyecto; las etapas de propuesta ya superadas se cierran
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Riesgos', 'APIH_Hitos') and left(substr(datos, 4), 1) = '{' and (substr(datos, 4)::jsonb ->> 'ini') = p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{ini}', to_jsonb(nuevo));
    if rec.lista = 'APIH_Hitos' and (jr ->> 'fase') is not null and fasesprop ? (jr ->> 'fase') and coalesce((jr ->> 'completado')::boolean, false) = false then
      jr := jr || jsonb_build_object('completado', true, 'fechaReal', hoy::text);
    end if;
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 3. hitos de la plantilla del tipo para las fases del proyecto
  if coalesce(j ->> 'tipoIni', '') <> '' then
    select t into tipo from jsonb_array_elements(coalesce(cfg #> '{metodo,tipos}', '[]'::jsonb)) t where t ->> 'nombre' = j ->> 'tipoIni' limit 1;
    if tipo is not null then
      base := coalesce(nullif(j ->> 'inicioPlan', '')::date, hoy);
      for h in select x from jsonb_array_elements(coalesce(tipo -> 'hitos', '[]'::jsonb)) x loop
        continue when not (fasesprj ? (h ->> 'fase'));
        continue when exists (select 1 from public.registros x where x.lista = 'APIH_Hitos' and left(substr(x.datos, 4), 1) = '{'
                                and (substr(x.datos, 4)::jsonb ->> 'ini') = nuevo and (substr(x.datos, 4)::jsonb ->> 'nombre') = (h ->> 'n') and (substr(x.datos, 4)::jsonb ->> 'fase') = (h ->> 'fase'));
        hn := public.apih_siguiente('HIT', 'APIH_Hitos');
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hn, 'p1.' || jsonb_build_object(
          'id', hn, 'ini', nuevo, 'nombre', h ->> 'n', 'fase', h ->> 'fase', 'fecha', (base + coalesce((h ->> 'dias')::int, 0))::text,
          'completado', false, 'fechaReal', null, 'resp', coalesce(j ->> 'lider', ''))::text);
        n_hit := n_hit + 1;
      end loop;
    end if;
  end if;

  select substr(datos, 4)::jsonb into nj from public.registros where lista = 'APIH_Proyectos' and id = nuevo;   -- V23: avance calculado con los hitos recién creados
  nj := public.apih_avance_fila(nj, nuevo, hoy);
  update public.registros set datos = 'p1.' || nj::text where lista = 'APIH_Proyectos' and id = nuevo;

  -- 4. dependencias que apuntaban a la propuesta ahora apuntan al proyecto
  for rec in select lista, id, datos from public.registros
              where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' and jsonb_typeof(substr(datos, 4)::jsonb -> 'deps') = 'array' and (substr(datos, 4)::jsonb -> 'deps') ? p_id loop
    jr := jsonb_set(substr(rec.datos, 4)::jsonb, '{deps}',
            (select jsonb_agg(case when d #>> '{}' = p_id then to_jsonb(nuevo) else d end) from jsonb_array_elements(substr(rec.datos, 4)::jsonb -> 'deps') d));
    update public.registros set datos = 'p1.' || jr::text where lista = rec.lista and id = rec.id;
  end loop;

  -- 5. la propuesta se cierra como Aprobada
  pj := (select substr(datos, 4)::jsonb from public.registros where lista = 'APIH_Propuestas' and id = p_id)
        || jsonb_build_object('estado', 'Aprobada', 'proyecto', nuevo, 'actualizada', hoy::text, 'estadoMotivo', nota, 'estadoRev', null);
  update public.registros set datos = 'p1.' || pj::text where lista = 'APIH_Propuestas' and id = p_id;

  -- 6. bitácora
  ba := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a'; bb := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b';
  insert into public.registros(lista, id, datos) values
   ('APIH_Bitacora', ba, 'p1.' || jsonb_build_object('id', ba,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Decisión', 'ini', p_id, 'autor', autor,
      'texto', 'Propuesta aprobada → proyecto ' || nuevo || case when nota <> '' then ' — ' || nota else '' end, 'meta', null)::text),
   ('APIH_Bitacora', bb, 'p1.' || jsonb_build_object('id', bb,
      'ts', hoy::text || 'T' || ts, 'tipo', 'Cambio', 'ini', nuevo, 'autor', autor,
      'texto', 'Proyecto creado desde la propuesta ' || p_id, 'meta', null)::text);

  perform set_config('apih.interno', 'off', true);
  return nuevo;
end $$;

create or replace function public.apih_resolver_cambio(p_id text, p_estado text, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; c jsonb; ir public.registros; i jsonb; ap boolean := p_estado = 'Aprobado'; nota text := btrim(coalesce(p_nota, '')); es_sponsor boolean;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_estado not in ('Aprobado', 'Rechazado') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;
  if not ap and nota = '' then raise exception 'APIH: indica el motivo del rechazo' using errcode = '22023', hint = 'nota'; end if;
  select * into r from public.registros where lista = 'APIH_Cambios' and id = p_id for update;
  if not found then raise exception 'APIH: el cambio % no existe', p_id using errcode = 'P0002'; end if;
  c := substr(r.datos, 4)::jsonb;
  if c ->> 'estado' <> 'Solicitado' then raise exception 'APIH: el cambio ya fue resuelto (%)', c ->> 'estado' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = c ->> 'ini' for update;
  if not found then raise exception 'APIH: la iniciativa del cambio no existe' using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  es_sponsor := nullif(i ->> 'sponsor', '') is not null and (i ->> 'sponsor') in (coalesce(per.nombre, ''), per.email);
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or es_sponsor) then
    raise exception 'APIH: solo el sponsor, Responsable o Administra resuelven cambios' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if ap and coalesce((c ->> 'pNue')::numeric, 0) > 0 and not public.apih_ve_montos() then
    raise exception 'APIH: aprobar un cambio de presupuesto requiere permiso de montos' using errcode = '42501', hint = 'pNue'; end if;

  perform set_config('apih.interno', 'on', true);
  c := c || jsonb_build_object('estado', p_estado, 'aprobador', coalesce(per.nombre, per.email), 'nota', nota, 'fDec', hoy::text);
  update public.registros set datos = 'p1.' || c::text where lista = 'APIH_Cambios' and id = p_id;
  if ap then
    if nullif(c ->> 'fNue', '') is not null then
      i := public.apih_mover_fin_plan(i, c ->> 'fNue', public.apih_fases(ir.lista = 'APIH_Propuestas'));   -- V23: mueve el fin de la última fase
      if nullif(i ->> 'finEst', '') is null or (i ->> 'finEst') < (c ->> 'fNue') then i := i || jsonb_build_object('finEst', c ->> 'fNue'); end if;
    end if;
    if coalesce((c ->> 'pNue')::numeric, 0) > 0 then i := i || jsonb_build_object('presupuesto', (c ->> 'pNue')::numeric); end if;
    i := i || jsonb_build_object('actualizada', hoy::text);
    if ir.lista = 'APIH_Proyectos' then i := public.apih_avance_fila(i, ir.id, hoy); end if;
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(c ->> 'ini', 'Decisión', 'Cambio ' || p_id || case when ap then ' aprobado' else ' rechazado' end || ' por ' || (c ->> 'aprobador') || case when nota <> '' then ': ' || nota else '' end,
                               case when ap then 'Línea base actualizada' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', p_estado, 'aplicado', ap);
end $$;

create or replace function public.apih_reabrir(p_id text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; prev text; es_prop boolean; nota text := btrim(coalesce(p_nota, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nota = '' then raise exception 'APIH: indica el motivo de la reapertura' using errcode = '22023', hint = 'nota'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  i := substr(ir.datos, 4)::jsonb; prev := i ->> 'estado'; es_prop := ir.lista = 'APIH_Propuestas';
  if es_prop and prev not in ('Rechazada', 'Retirada') then raise exception 'APIH: solo se reabren propuestas Rechazadas o Retiradas (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and prev not in ('Completado', 'Cancelado') then raise exception 'APIH: solo se reabren proyectos cerrados (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and per.rol <> 'admin' then raise exception 'APIH: solo Administra puede reabrir un proyecto cerrado' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  i := i || jsonb_build_object('estado', case when es_prop then 'Vigente' else 'En curso' end, 'estadoMotivo', '', 'estadoRev', null, 'actualizada', hoy::text);
  if not es_prop then i := public.apih_avance_fila(i || jsonb_build_object('finReal', null), ir.id, hoy); end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', case when es_prop then 'Propuesta reabierta' else 'Proyecto reabierto' end || ' (era ' || prev || '): ' || nota);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', i ->> 'estado');
end $$;

revoke all on function public.apih_aprobar_propuesta(text, text, boolean), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) from public, anon;
grant execute on function public.apih_aprobar_propuesta(text, text, boolean), public.apih_resolver_cambio(text, text, text), public.apih_reabrir(text, text) to authenticated;
revoke all on function public.apih_fases(boolean), public.apih_avance_fase(jsonb, text, text), public.apih_avance_calc(jsonb, text), public.apih_avance_fila(jsonb, text, date),
  public.apih_distribuir_fases(date, date, text[]), public.apih_set_rango_plan(jsonb, text, text, text[]), public.apih_mover_fin_plan(jsonb, text, text[]), public.apih_validar_ciclo(text, jsonb) from public, anon, authenticated;
