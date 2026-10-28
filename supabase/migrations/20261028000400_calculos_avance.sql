-- Iter 3b · apih_calculos entrega también el avance (efectivo, calculado y ajuste manual) y la ventana de cada fase con su avance
create or replace function public.apih_calculos() returns jsonb
language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); fases text[] := array_remove(public.apih_fases(false), 'Cierre');
  ini jsonb := '{}'::jsonb; hit jsonb := '{}'::jsonb; rsk jsonb := '{}'::jsonb;
  r record; j jsonb; i record; ff text[]; ix int; sig jsonb;
  hitos jsonb := '{}'::jsonb;      -- por iniciativa: arreglo de hitos
  riesgos jsonb := '{}'::jsonb;    -- por iniciativa: arreglo de {id, expo, abierto}
  hs jsonb; rs jsonb; abiertas date[]; n_hit int; vivo boolean; hecho boolean; es_prop boolean; fc date; fin_plan date; ds int; tol numeric; umb numeric;
  dsu int; cc2 int; m2 int; ef2 numeric; esp numeric; av numeric; p int; why jsonb; hv int; rc int; exp_ numeric; sumexp numeric; rag text; crit numeric; ti date; tt int; tz int;
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
      if ti is not null and (j ->> 'fase') = any (fases) and (fc is null or ti > fc) then fc := ti; end if;
      if vivo and (j ->> 'fase') = any (fases) and public.apih_num(j, 'avance') < 100 and (fc is null or fc < hoy) then fc := hoy; end if;
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
    -- compuertas del siguiente paso: próxima fase; si no hay, aprobar (propuesta) o completar (proyecto)
    ff := public.apih_fases(es_prop); ix := array_position(ff, j ->> 'fase');
    sig := case when hecho then '[]'::jsonb
                when ix is not null and ix < cardinality(ff) then public.apih_compuertas(i.id, ff[ix + 1])
                when es_prop then public.apih_compuertas_aprobar(i.id)
                else public.apih_compuertas(i.id, 'Cierre') end;
    cc2 := case when es_prop then 0 else public.apih_avance_calc(j, i.id) end;
    m2 := case when not es_prop and jsonb_typeof(j -> 'avanceManual') = 'number' then greatest(0, least(100, round((j ->> 'avanceManual')::numeric)))::int end;
    ef2 := case when es_prop then public.apih_num(j, 'avance') when j ->> 'estado' = 'Completado' then 100 else coalesce(m2, cc2) end;
    ini := ini || jsonb_build_object(i.id, jsonb_build_object('sig', sig, 'avance', ef2, 'avanceCalc', cc2, 'avanceManual', m2,
      'fasesFechas', j -> 'fasesFechas', 'inicioPlan', j -> 'inicioPlan', 'finPlan', j -> 'finPlan',
      'ventanas', case when es_prop then public.apih_ventanas(j, i.id, true) else public.apih_ventanas(j, i.id, false) end,
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
