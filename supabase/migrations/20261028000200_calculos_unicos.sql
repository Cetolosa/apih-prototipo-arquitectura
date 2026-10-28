-- =====================================================================================
-- APIH Prototipo · Iter 2 · Valores calculados: UNA sola definición, en la base
--   Antes la SPA calculaba (y el servidor volvía a calcular lo mismo en algunos comandos): estado de hitos, fin proyectado,
--   desvío, atraso, avance esperado, ROI, exposición y nivel de riesgo, semáforo sugerido, ranking de criticidad,
--   completitud y días sin actualización. Ahora los entrega apih_calculos() y la SPA solo los muestra.
--   · Lee a través de registros_v (con los permisos y la ocultación de montos de quien llama).
--   · «Hoy» es el de Santiago (o cfg.hoyFija, para pruebas y demostraciones).
--   · Umbrales (tolDesv, umbralCritico, diasSinUpdate): los de la organización, salvo que la persona que lidera la
--     iniciativa tenga un ajuste propio y el parámetro no esté fijado por Administra (misma regla que cfgI de la app).
-- =====================================================================================

create or replace function public.apih_hoy() returns date language sql stable security definer set search_path = public as
$$ select coalesce(case when coalesce(public.apih_cfg() ->> 'hoyFija', '') ~ '^\d{4}-\d{2}-\d{2}$' then (public.apih_cfg() ->> 'hoyFija')::date end,
                   (now() at time zone 'America/Santiago')::date) $$;

create or replace function public.apih_num(j jsonb, k text) returns numeric language sql immutable as
$$ select case when jsonb_typeof(j -> k) = 'number' then (j ->> k)::numeric
               when jsonb_typeof(j -> k) = 'string' and (j ->> k) ~ '^-?\d+(\.\d+)?$' then (j ->> k)::numeric else 0 end $$;

-- «vacío» como en JavaScript: ausente, null, "", 0 o false
create or replace function public.apih_vacio(j jsonb, k text) returns boolean language sql immutable as
$$ select j -> k is null or jsonb_typeof(j -> k) = 'null' or j -> k in ('""'::jsonb, '0'::jsonb, 'false'::jsonb) $$;

create or replace function public.apih_fecha(j jsonb, k text) returns date language sql immutable as
$$ select case when (j ->> k) ~ '^\d{4}-\d{2}-\d{2}' then left(j ->> k, 10)::date end $$;

create or replace function public.apih_rel(d date, hoy date) returns text language sql immutable as
$$ select case when d is null then '' when d = hoy then 'hoy' when d = hoy + 1 then 'mañana' when d = hoy - 1 then 'ayer'
               when d > hoy then 'en ' || (d - hoy) || ' d' else 'hace ' || (hoy - d) || ' d' end $$;

-- Umbral vigente para una iniciativa (organización o ajuste de su líder)
create or replace function public.apih_umbral(ini jsonb, k text) returns numeric language plpgsql stable security definer set search_path = public as
$$ declare cfg jsonb := public.apih_cfg(); v jsonb; org numeric := public.apih_num(public.apih_cfg(), k);
begin
  if coalesce(cfg #>> array['fijos', k], '') not in ('', '0', 'false') then return org; end if;
  if coalesce(ini ->> 'lider', '') = '' then return org; end if;
  select substr(r.datos, 4)::jsonb #> array['v', 'cfg', k] into v
    from public.perfiles p join public.registros r on r.lista = 'APIH_Config' and r.id = 'cfgU:' || p.email
   where lower(btrim(p.nombre)) = lower(btrim(ini ->> 'lider')) and left(substr(r.datos, 4), 1) = '{' limit 1;
  return case when v is not null and jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else org end;
end $$;

create or replace function public.apih_estado_hito(h jsonb, hoy date) returns jsonb language sql immutable as
$$ select case
     when h ->> 'completado' = 'true' then
       case when public.apih_fecha(h, 'fechaReal') is not null and public.apih_fecha(h, 'fechaReal') > public.apih_fecha(h, 'fecha')
            then jsonb_build_object('k', 'late', 't', 'Completado con retraso', 'c', '#F2A100')
            else jsonb_build_object('k', 'done', 't', 'Completado', 'c', '#107C10') end
     when public.apih_fecha(h, 'fecha') is null then jsonb_build_object('k', 'ok', 't', 'En plazo', 'c', '#0D446A')
     when public.apih_fecha(h, 'fecha') < hoy then jsonb_build_object('k', 'over', 't', 'Vencido (' || (hoy - public.apih_fecha(h, 'fecha')) || ' d)', 'c', '#D13438')
     when public.apih_fecha(h, 'fecha') - hoy <= 7 then jsonb_build_object('k', 'soon', 't', 'Vence ' || public.apih_rel(public.apih_fecha(h, 'fecha'), hoy), 'c', '#F2A100')
     else jsonb_build_object('k', 'ok', 't', 'En plazo', 'c', '#0D446A') end $$;

create or replace function public.apih_nivel_riesgo(e numeric, umbral numeric) returns jsonb language sql immutable as
$$ select case when e >= umbral then jsonb_build_object('n', 'Crítico', 'c', '#D13438')
               when e >= 10 then jsonb_build_object('n', 'Alto', 'c', '#CA5010')
               when e >= 5 then jsonb_build_object('n', 'Medio', 'c', '#F2A100')
               else jsonb_build_object('n', 'Bajo', 'c', '#107C10') end $$;

create or replace function public.apih_completitud(i jsonb, tiene_hitos boolean) returns jsonb language plpgsql immutable as
$$ declare crit text[] := '{}'; rec text[] := '{}'; opt text[] := '{}'; k text; n text; tot int; got int;
begin
  for k, n in select * from (values ('sponsor','Sponsor'),('lider','Líder'),('area','Área'),('prioridad','Prioridad'),('inicioPlan','Inicio plan'),('finPlan','Fin plan')) v(k, n) loop
    if public.apih_vacio(i, k) then crit := crit || n; end if; end loop;
  for k, n in select * from (values ('presupuesto','Presupuesto'),('beneficio','Beneficio'),('desc','Descripción'),('bc','Business case'),('negocio','Resp. negocio')) v(k, n) loop
    if public.apih_vacio(i, k) then rec := rec || n; end if; end loop;
  for k, n in select * from (values ('proveedor','Proveedor'),('resumen','Resumen ejecutivo'),('proximos','Próximos pasos')) v(k, n) loop
    if public.apih_vacio(i, k) then opt := opt || n; end if; end loop;
  if not tiene_hitos then rec := rec || 'Hitos'::text; end if;
  tot := 6 * 3 + 5 * 2 + 3 + 2; got := tot - cardinality(crit) * 3 - cardinality(rec) * 2 - cardinality(opt);
  return jsonb_build_object('crit', to_jsonb(crit), 'rec', to_jsonb(rec), 'opt', to_jsonb(opt), 'pct', greatest(0, round(got::numeric / tot * 100)));
end $$;

-- Todos los valores calculados, por registro, para quien llama
create or replace function public.apih_calculos() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); fases text[] := array_remove(public.apih_fases(false), 'Cierre');
  ini jsonb := '{}'::jsonb; hit jsonb := '{}'::jsonb; rsk jsonb := '{}'::jsonb;
  r record; j jsonb; i record;
  hitos jsonb := '{}'::jsonb;      -- por iniciativa: arreglo de hitos
  riesgos jsonb := '{}'::jsonb;    -- por iniciativa: arreglo de {id, expo, abierto}
  hs jsonb; rs jsonb; abiertas date[]; n_hit int; vivo boolean; hecho boolean; es_prop boolean; fc date; fin_plan date; ds int; tol numeric; umb numeric;
  dsu int; esp numeric; av numeric; p int; why jsonb; hv int; rc int; exp_ numeric; sumexp numeric; rag text; crit numeric; ti date; tt int; tz int;
begin
  -- 1) hitos (por iniciativa) y su estado
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' loop
    hit := hit || jsonb_build_object(r.id, public.apih_estado_hito(r.j, hoy));
    hitos := jsonb_set(hitos, array[coalesce(r.j ->> 'ini', '')], coalesce(hitos -> coalesce(r.j ->> 'ini', ''), '[]'::jsonb) || jsonb_build_array(r.j), true);
  end loop;
  -- 2) riesgos: se calculan con el umbral de su iniciativa (después de leer las iniciativas)
  -- 3) iniciativas
  for i in select lista, id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    j := i.j; es_prop := j ->> 'tipo' = 'Propuesta' or i.lista = 'APIH_Propuestas';
    hecho := j ->> 'estado' = any (case when es_prop then array['Aprobada','Rechazada','Retirada'] else array['Completado','Cancelado'] end);
    vivo := not hecho and coalesce(j ->> 'estado', '') <> 'Stand By';
    hs := coalesce(hitos -> i.id, '[]'::jsonb);
    tol := public.apih_umbral(j, 'tolDesv'); umb := public.apih_umbral(j, 'umbralCritico');
    -- fin proyectado
    fin_plan := public.apih_fecha(j, 'finPlan');
    if j ->> 'estado' = 'Completado' then fc := coalesce(public.apih_fecha(j, 'finReal'), public.apih_fecha(j, 'finEst'), fin_plan);
    else
      fc := coalesce(case when public.apih_vacio(j, 'finEst') then null else public.apih_fecha(j, 'finEst') end, fin_plan);
      select max(public.apih_fecha(h, 'fecha')) into ti from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true';
      if ti is not null and (j ->> 'fase') = any (fases) and fc is not null and ti > fc then fc := ti; end if;
      if vivo and (j ->> 'fase') = any (fases) and public.apih_num(j, 'avance') < 100 and fc is not null and fc < hoy then fc := hoy; end if;
    end if;
    ds := case when fin_plan is not null and fc is not null then greatest(0, fc - fin_plan) else 0 end;
    -- avance esperado (lineal)
    ti := public.apih_fecha(j, 'inicioPlan');
    esp := case when ti is null or fin_plan is null then 0
                else greatest(0, least(100, (hoy - ti)::numeric / greatest(1, fin_plan - ti) * 100)) end;
    dsu := case when public.apih_vacio(j, 'actualizada') then 999 else hoy - public.apih_fecha(j, 'actualizada') end;
    select count(*) into hv from jsonb_array_elements(hs) h where h ->> 'completado' is distinct from 'true' and public.apih_fecha(h, 'fecha') < hoy;
    -- riesgos de la iniciativa
    select coalesce(sum(public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp')) filter (where x.j ->> 'estado' is distinct from 'Cerrado'), 0),
           count(*) filter (where x.j ->> 'estado' is distinct from 'Cerrado' and public.apih_num(x.j, 'prob') * public.apih_num(x.j, 'imp') >= umb)
      into sumexp, rc
      from (select substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = i.id) x;
    -- semáforo sugerido
    p := 0; why := '[]'::jsonb;
    if ds > 30 then p := p + 2; why := why || to_jsonb('desviación de ' || ds || ' d');
    elsif ds > tol then p := p + 1; why := why || to_jsonb('desviación de ' || ds || ' d'); end if;
    if hv >= 2 then p := p + 2; why := why || to_jsonb(hv || ' hitos vencidos');
    elsif hv = 1 then p := p + 1; why := why || to_jsonb('1 hito vencido'::text); end if;
    if rc > 0 then p := p + 2; why := why || to_jsonb(rc || ' riesgo(s) crítico(s)'); end if;
    av := public.apih_num(j, 'avance');
    if (j ->> 'fase') = any (fases) and esp - av > 25 then p := p + 1; why := why || to_jsonb('avance bajo lo esperado'::text); end if;
    if vivo and (j ->> 'fase') = any (fases) and dsu > public.apih_umbral(j, 'diasSinUpdate') * 2 then p := p + 1; why := why || to_jsonb('sin actualización'::text); end if;
    rag := case when p >= 4 then 'Rojo' when p >= 2 then 'Ámbar' else 'Verde' end;
    crit := (case j ->> 'rag' when 'Rojo' then 40 when 'Ámbar' then 20 else 0 end) + least(30, ds / 2.0) + sumexp / 2
            + (case j ->> 'prioridad' when 'Alta' then 12 when 'Media' then 6 else 0 end) + hv * 4;
    ini := ini || jsonb_build_object(i.id, jsonb_build_object(
      'forecast', fc, 'desv', ds, 'atrasado', (vivo and (j ->> 'fase') = any (fases) and ds > tol), 'esperado', esp,
      'roi', case when public.apih_num(j, 'presupuesto') > 0 then ((public.apih_num(j, 'beneficio') - public.apih_num(j, 'presupuesto')) / public.apih_num(j, 'presupuesto')) * 100 end,
      'rag', jsonb_build_object('rag', rag, 'why', why), 'crit', crit, 'dsu', dsu, 'hv', hv, 'umbral', umb, 'tol', tol,
      'compl', public.apih_completitud(j, jsonb_array_length(hs) > 0)));
  end loop;
  -- 4) riesgos con su exposición y nivel (umbral de la iniciativa; si no existe, el de la organización)
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' loop
    umb := coalesce((ini -> (r.j ->> 'ini') ->> 'umbral')::numeric, public.apih_num(public.apih_cfg(), 'umbralCritico'));
    exp_ := public.apih_num(r.j, 'prob') * public.apih_num(r.j, 'imp');
    rsk := rsk || jsonb_build_object(r.id, jsonb_build_object('expo', exp_, 'nivel', public.apih_nivel_riesgo(exp_, umb),
                                      'critico', (r.j ->> 'estado' is distinct from 'Cerrado' and exp_ >= umb)));
  end loop;
  return jsonb_build_object('hoy', hoy, 'ini', ini, 'hitos', hit, 'riesgos', rsk);
end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
revoke all on function public.apih_umbral(jsonb, text), public.apih_hoy() from public, anon;
grant execute on function public.apih_umbral(jsonb, text), public.apih_hoy() to authenticated;
