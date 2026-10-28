-- =====================================================================================
-- APIH Prototipo · Iter 5h · Mi cocina: la «misión» (qué hay que atender) sale del servidor
--   Por iniciativa: hitos vencidos sin cerrar, compromisos con fecha vencida y riesgos por atender
--   (revisión vencida o crítico sin mitigación). apih_calculos() lo entrega en «mision»; la SPA solo arma los textos.
-- =====================================================================================
create or replace function public.apih_mision(c jsonb) returns jsonb language sql stable security definer set search_path = public as
$$ with hoy as materialized (select public.apih_hoy()::text d),
 reg as materialized (select r.lista, r.id, substr(r.datos, 4)::jsonb j from public.registros_v r
                       where r.lista in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Compromisos') and left(substr(r.datos, 4), 1) = '{'),
 hv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'nombre', j ->> 'nombre', 'fecha', j ->> 'fecha') x, j ->> 'fecha' f
          from reg, hoy where lista = 'APIH_Hitos' and coalesce(j ->> 'fecha', '') <> '' and j ->> 'fecha' < hoy.d
           and not (coalesce((j ->> 'completado')::boolean, false) and coalesce(j ->> 'fechaReal', '') <= hoy.d)),
 cv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'texto', j ->> 'texto', 'resp', j ->> 'resp', 'limite', j ->> 'limite') x, j ->> 'limite' f
          from reg, hoy where lista = 'APIH_Compromisos' and coalesce(j ->> 'estado', '') not in ('Cancelado', 'Cumplido')
           and coalesce(j ->> 'limite', '') <> '' and j ->> 'limite' < hoy.d),
 rv as (select j ->> 'ini' ini, jsonb_build_object('id', id, 'desc', j ->> 'desc', 'fRev', j ->> 'fRev', 'expo', c -> 'riesgos' -> id -> 'expo',
                 'por', case when coalesce(j ->> 'fRev', '') <> '' and j ->> 'fRev' < hoy.d then 'rev' else 'crit' end) x, id f
          from reg, hoy where lista = 'APIH_Riesgos' and coalesce(j ->> 'estado', '') <> 'Cerrado'
           and ((coalesce(j ->> 'fRev', '') <> '' and j ->> 'fRev' < hoy.d)
                or (coalesce((c -> 'riesgos' -> id ->> 'critico')::boolean, false) and trim(coalesce(j ->> 'mit', '')) = '')))
 select coalesce(jsonb_object_agg(k, jsonb_build_object(
          'hit', coalesce((select jsonb_agg(x order by f) from hv where hv.ini = k), '[]'::jsonb),
          'cmp', coalesce((select jsonb_agg(x order by f) from cv where cv.ini = k), '[]'::jsonb),
          'rsk', coalesce((select jsonb_agg(x order by f) from rv where rv.ini = k), '[]'::jsonb))), '{}'::jsonb)
   from jsonb_object_keys(coalesce(c -> 'ini', '{}'::jsonb)) k $$;
revoke all on function public.apih_mision(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c), 'personas', public.apih_personas_dir(), 'mision', public.apih_mision(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
