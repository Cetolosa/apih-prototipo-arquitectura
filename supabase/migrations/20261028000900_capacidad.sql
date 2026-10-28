-- =====================================================================================
-- APIH Prototipo · Iter 4d · Capacidad de equipos en el servidor
--   Carga mensual por líder = proyectos vivos que lidera y cuyo plan (inicio → el mayor entre fin plan y fin proyectado) toca ese mes.
--   Capacidad = cfg.capPers[persona] o, si no hay, cfg.capacidadMax (5 por defecto). Color de la celda: n (sin carga), g (< 80 %), y (80–100 %), r (> 100 %).
--   apih_calculos() entrega además 'capacidad': { meses: [{s,e}×12], gente: [{n, cap, ns, cls, ps:[{id,s,e}], prom3, hold, over:{"3","6","12"}}] }
--   La SPA solo filtra por persona/área y suma.
-- =====================================================================================
create or replace function public.apih_capacidad(c jsonb) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg(); capmax int := greatest(1, coalesce(nullif(cfg ->> 'capacidadMax', '')::numeric, 5)::int);
  meses jsonb := '[]'::jsonb; m0 date := date_trunc('month', public.apih_hoy())::date; k int; r record; j jsonb; lid text; ps jsonb; gente jsonb := '[]'::jsonb;
  capp jsonb := case when jsonb_typeof(cfg -> 'capPers') = 'object' then cfg -> 'capPers' else '{}'::jsonb end; cap int; ns int[]; cls text[]; n int; s date; e date; fc date; p jsonb;
  prom3 numeric; ms date[]; me_ date[]; ov3 boolean; ov6 boolean; ov12 boolean; v numeric;
begin
  for k in 0 .. 11 loop meses := meses || jsonb_build_array(jsonb_build_object('s', (m0 + (k || ' month')::interval)::date, 'e', ((m0 + ((k + 1) || ' month')::interval)::date - 1))); end loop;
  for r in select q.jj ->> 'lider' lider, jsonb_agg(jsonb_build_object('id', q.id, 'j', q.jj) order by q.id) arr
             from (select id, substr(datos, 4)::jsonb jj from public.registros_v where lista = 'APIH_Proyectos' and left(substr(datos, 4), 1) = '{') q
            where q.jj ->> 'estado' not in ('Completado', 'Cancelado', 'Stand By') and coalesce(q.jj ->> 'tipo', '') <> 'Propuesta' and coalesce(q.jj ->> 'lider', '') <> '' group by 1 order by 1 loop
    lid := r.lider; ps := '[]'::jsonb;
    for p in select jsonb_array_elements(r.arr) loop
      j := p -> 'j'; fc := nullif(c -> 'ini' -> (p ->> 'id') ->> 'forecast', '')::date;
      s := coalesce(public.apih_fecha(j, 'inicioPlan'), public.apih_fecha(j, 'inicioReal'), public.apih_fecha(j, 'creada'), hoy);
      e := greatest(public.apih_fecha(j, 'finPlan'), fc);
      ps := ps || jsonb_build_array(jsonb_build_object('id', p ->> 'id', 's', s, 'e', e));
    end loop;
    cap := coalesce(nullif((select value::text::numeric from jsonb_each(capp) where public.apih_norm(key) = public.apih_norm(lid) limit 1), 0)::int, capmax);
    ns := '{}'; cls := '{}';
    for k in 0 .. 11 loop
      s := (meses -> k ->> 's')::date; e := (meses -> k ->> 'e')::date;
      select count(*) into n from jsonb_array_elements(ps) pq where (pq ->> 's')::date <= e and (pq ->> 'e' is null or (pq ->> 'e')::date >= s);
      ns := ns || n; cls := cls || (case when n = 0 then 'n' when n > cap then 'r' when n >= cap * .8 then 'y' else 'g' end);
    end loop;
    prom3 := (ns[1] + ns[2] + ns[3])::numeric / 3;
    gente := gente || jsonb_build_array(jsonb_build_object('n', lid, 'cap', cap, 'ns', to_jsonb(ns), 'cls', to_jsonb(cls), 'ps', ps, 'prom3', prom3, 'hold', greatest(0, cap - prom3),
      'over', jsonb_build_object('3', (select bool_or(x > cap) from unnest(ns[1:3]) x), '6', (select bool_or(x > cap) from unnest(ns[1:6]) x), '12', (select bool_or(x > cap) from unnest(ns[1:12]) x))));
  end loop;
  return jsonb_build_object('meses', meses, 'gente', gente);
end $$;
revoke all on function public.apih_capacidad(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
