-- =====================================================================================
-- APIH Prototipo · Iter 5i · «Siguientes pasos»: qué conviene hacer en cada iniciativa, calculado en el servidor
--   Hitos vencidos/de hoy/de la semana, tenedor «Al día», riesgos (mitigación, revisión), compromisos por vencer y compuerta de fase.
--   apih_cielo() lo entrega en «pasos» (id → lista). La SPA solo aplica las preferencias personales (ocultar, ajustar importancia) y pinta.
--   u: 0 hoy · 1 esta semana · 2 próximo.
-- =====================================================================================
create or replace function public.apih_fzd(d text, hoy date) returns text language sql immutable as
$$ select case when coalesce(d, '') ~ '^\d{4}-\d{2}-\d{2}' then substr(d, 9, 2) || '-' || substr(d, 6, 2) || case when substr(d, 1, 4) <> to_char(hoy, 'YYYY') then '-' || substr(d, 3, 2) else '' end else '—' end $$;

create or replace function public.apih_pasos(calc jsonb, ctx jsonb, mp jsonb, proy jsonb, hoy date) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hd text := hoy::text; out jsonb := '{}'::jsonb; k text; j jsonb; arr jsonb; x jsonb; es_prop boolean; hecho boolean; vivo boolean; ff text[]; ix int; nx text;
  dow int; n int; sig jsonb; falta jsonb; cerca boolean; ven jsonb; vfin text; nv jsonb; ex numeric; lbl text; dia_off boolean; tip text; kk int;
begin
  for k, j in select key, value from jsonb_each(coalesce(mp, '{}'::jsonb)) loop
    es_prop := (j ->> 'tipo') = 'Propuesta';
    hecho := (j ->> 'estado') = any (case when es_prop then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end);
    continue when hecho;
    vivo := (j ->> 'estado') <> 'Stand By';
    arr := '[]'::jsonb;
    -- hitos abiertos
    for x in select h from jsonb_array_elements(coalesce(ctx -> 'hit' -> k, '[]'::jsonb)) h
              where not coalesce((h ->> 'completado')::boolean, false) and coalesce(h ->> 'fecha', '') <> '' order by h ->> 'fecha' loop
      if x ->> 'fecha' < hd then
        arr := arr || jsonb_build_object('k', k || ':hv' || (x ->> 'id'), 'u', 0, 'tipo', 'Hito vencido', 't', 'Cierra o reprograma «' || (x ->> 'nombre') || '»',
          'por', 'Venció hace ' || (hoy - (x ->> 'fecha')::date) || ' d. Mientras siga abierto, el indicador de Hitos queda en rojo.', 'prot', 'Hitos', 'btn', 'Editar hito', 'act', 'edit',
          'd', jsonb_build_object('t', 'hito', 'id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
      elsif x ->> 'fecha' = hd then
        arr := arr || jsonb_build_object('k', k || ':hh' || (x ->> 'id'), 'u', 0, 'tipo', 'Hito', 't', 'Marca «' || (x ->> 'nombre') || '» como cumplido', 'por', 'Vence hoy.', 'prot', 'Hitos',
          'btn', 'Marcar cumplido', 'act', 'hitotoggle', 'd', jsonb_build_object('id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
      end if;
    end loop;
    for x in select h from jsonb_array_elements(coalesce(ctx -> 'hit' -> k, '[]'::jsonb)) h
              where not coalesce((h ->> 'completado')::boolean, false) and (h ->> 'fecha') > hd and (h ->> 'fecha')::date - hoy <= 7 order by h ->> 'fecha' limit 3 loop
      arr := arr || jsonb_build_object('k', k || ':hs' || (x ->> 'id'), 'u', 1, 'tipo', 'Hito', 't', 'Prepara «' || (x ->> 'nombre') || '» (' || public.apih_fzd(x ->> 'fecha', hoy) || ')',
        'por', 'Vence en ' || ((x ->> 'fecha')::date - hoy) || ' d' || case when coalesce(x ->> 'resp', '') <> '' then ' · ' || (x ->> 'resp') else '' end || '.', 'prot', 'Hitos', 'btn', 'Ver hito', 'act', 'sel',
        'd', jsonb_build_object('t', 'hito', 'id', x ->> 'id'), 'f', x ->> 'fecha', 'nr', jsonb_build_object('h', x ->> 'id'));
    end loop;
    -- tenedor «Al día»
    if vivo and (j ->> 'fase') = any (array['Planificación', 'Ejecución', 'Transición']) and not es_prop and coalesce(proy -> k -> 'st' ->> 'dia', '') = 'off' then
      dow := extract(dow from hoy)::int;
      tip := case when coalesce((proy -> k ->> 'tope')::boolean, false) then 'Llevas 3 semanas actualizando sin avance real: sube el % de avance o cierra un hito y se enciende.'
                  else 'Actualiza el proyecto esta semana (avance, logros o próximos pasos).' end;
      arr := arr || jsonb_build_object('k', k || ':dia', 'u', case when dow >= 5 or dow = 0 then 0 else 1 end, 'tipo', 'Tenedor «Al día»', 't', 'Registra la actualización semanal', 'por', tip, 'prot', 'Al día',
        'btn', 'Actualizar', 'act', 'wk', 'd', jsonb_build_object('id', k), 'f', hd);
    end if;
    -- riesgos abiertos
    for x in select r from jsonb_array_elements(coalesce(ctx -> 'rsk' -> k, '[]'::jsonb)) r order by r ->> 'id' loop
      ex := coalesce((calc -> 'riesgos' -> (x ->> 'id') ->> 'expo')::numeric, 0); nv := calc -> 'riesgos' -> (x ->> 'id') -> 'nivel';
      if coalesce((x ->> '_crit')::boolean, false) and trim(coalesce(x ->> 'mit', '')) = '' then
        arr := arr || jsonb_build_object('k', k || ':rm' || (x ->> 'id'), 'u', 0, 'tipo', 'Riesgo crítico', 't', 'Define la mitigación de «' || (x ->> 'desc') || '»',
          'por', 'Crítico (' || ex || ') sin plan de mitigación: el indicador de Riesgos queda en rojo y se bloquean compuertas.', 'prot', 'Riesgos', 'btn', 'Editar riesgo', 'act', 'edit',
          'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', hd);
      elsif coalesce(x ->> 'fRev', '') <> '' and x ->> 'fRev' < hd then
        arr := arr || jsonb_build_object('k', k || ':rv' || (x ->> 'id'), 'u', 0, 'tipo', 'Riesgo', 't', 'Revisa el riesgo «' || (x ->> 'desc') || '»',
          'por', 'La revisión venció el ' || public.apih_fzd(x ->> 'fRev', hoy) || '. Mientras no se revise, el indicador de Riesgos queda en rojo.', 'prot', 'Riesgos', 'btn', 'Editar riesgo', 'act', 'edit',
          'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', x ->> 'fRev');
      elsif coalesce(x ->> 'fRev', '') <> '' and (x ->> 'fRev')::date - hoy <= 7 then
        arr := arr || jsonb_build_object('k', k || ':rs' || (x ->> 'id'), 'u', case when x ->> 'fRev' = hd then 0 else 1 end, 'tipo', 'Riesgo ' || lower(coalesce(nv ->> 'n', '')),
          't', 'Prepara la revisión de «' || (x ->> 'desc') || '» (' || public.apih_fzd(x ->> 'fRev', hoy) || ')',
          'por', coalesce(nv ->> 'n', '') || ' (' || ex || ')' || case when trim(coalesce(x ->> 'mit', '')) <> '' then '. Mitigación: ' || public.apih_cut(x ->> 'mit', 90) else '.' end,
          'prot', 'Riesgos', 'btn', 'Abrir riesgo', 'act', 'sel', 'd', jsonb_build_object('t', 'risk', 'id', x ->> 'id'), 'f', x ->> 'fRev');
      end if;
    end loop;
    -- compromisos por vencer
    for x in select c from jsonb_array_elements(coalesce(ctx -> 'cmp' -> k, '[]'::jsonb)) c
              where coalesce(c ->> 'estado', '') not in ('Cumplido', 'Cancelado') and coalesce(c ->> 'limite', '') <> '' and (c ->> 'limite')::date - hoy <= 7 order by c ->> 'id' loop
      arr := arr || jsonb_build_object('k', k || ':c' || (x ->> 'id'), 'u', case when x ->> 'limite' <= hd then 0 else 1 end, 'tipo', 'Compromiso',
        't', case when x ->> 'limite' < hd then 'Cumple el compromiso vencido «' else 'Cumple «' end || public.apih_cut(coalesce(nullif(x ->> 'texto', ''), nullif(x ->> 'titulo', ''), 'compromiso'), 70) || '»',
        'por', case when x ->> 'limite' < hd then 'Venció el ' else 'Vence el ' end || public.apih_fzd(x ->> 'limite', hoy) || case when coalesce(x ->> 'resp', '') <> '' then ' · ' || (x ->> 'resp') else '' end || '.',
        'prot', 'Compromisos', 'btn', 'Ver compromisos', 'act', 'go', 'd', jsonb_build_object('v', 'compromisos'), 'f', x ->> 'limite');
    end loop;
    -- compuerta de la fase
    ff := public.apih_fases(es_prop); ix := array_position(ff, j ->> 'fase');
    if ix is not null and ix < cardinality(ff) then
      nx := ff[ix + 1]; sig := coalesce(calc -> 'ini' -> k -> 'sig', '[]'::jsonb);
      select jsonb_agg(g) into falta from jsonb_array_elements(sig) g where not coalesce((g ->> 'ok')::boolean, false);
      if falta is null then
        arr := arr || jsonb_build_object('k', k || ':adv', 'u', 0, 'tipo', 'Compuerta', 't', 'Avanza a ' || nx, 'por', 'Se cumplen todas las condiciones de la compuerta.', 'prot', 'Compuerta', 'btn', 'Avanzar', 'act', 'advance',
          'd', jsonb_build_object('id', k), 'f', hd, 'nr', jsonb_build_object('fase', j ->> 'fase'));
      else
        select v ->> 'fin' into vfin from jsonb_array_elements(coalesce(calc -> 'ini' -> k -> 'ventanas', '[]'::jsonb)) v where v ->> 'fase' = j ->> 'fase' limit 1;
        cerca := coalesce(vfin, '') <> '' and vfin::date - hoy <= 7;
        kk := 0;
        for x in select g from jsonb_array_elements(falta) g where (g ->> 't') !~ '^Hitos de la fase' loop
          arr := arr || jsonb_build_object('k', k || ':g' || kk, 'u', case when cerca then 1 else 2 end, 'tipo', 'Compuerta',
            't', 'Para pasar a ' || nx || ': ' || lower(left(x ->> 't', 1)) || substr(x ->> 't', 2),
            'por', 'Condición pendiente de la compuerta' || case when coalesce(vfin, '') <> '' then '; la fase ' || (j ->> 'fase') || ' cierra el ' || public.apih_fzd(vfin, hoy) else '' end || '.',
            'prot', 'Compuerta', 'btn', case when es_prop then 'Editar propuesta' else 'Editar proyecto' end, 'act', 'edit', 'd', jsonb_build_object('t', 'ini', 'id', k), 'f', hd,
            'nr', jsonb_build_object('fase', j ->> 'fase'));
          kk := kk + 1;
        end loop;
      end if;
    end if;
    out := out || jsonb_build_object(k, coalesce((select jsonb_agg(a order by (a ->> 'u'), (a ->> 'f')) from jsonb_array_elements(arr) a), '[]'::jsonb));
  end loop;
  return out;
end $$;
revoke all on function public.apih_pasos(jsonb, jsonb, jsonb, jsonb, date) from public, anon, authenticated;
