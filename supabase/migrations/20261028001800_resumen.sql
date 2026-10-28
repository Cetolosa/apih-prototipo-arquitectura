-- =====================================================================================
-- APIH Prototipo · Iter 5f · Definiciones del resumen ejecutivo y de los KPIs: en el servidor
--   «On track» (proyecto activo en verde y sin atraso), los tramos de lectura del % On Track (con su texto) y las ventanas de días
--   que usa el resumen. apih_calculos() los entrega en «resumen»; la SPA solo cuenta, suma y muestra.
-- =====================================================================================
create or replace function public.apih_resumen(c jsonb) returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
     'ontrack', coalesce((select jsonb_object_agg(r.id, coalesce(substr(r.datos, 4)::jsonb ->> 'rag', '') = 'Verde' and not coalesce((c -> 'ini' -> r.id ->> 'atrasado')::boolean, false))
                            from public.registros_v r
                           where r.lista = 'APIH_Proyectos' and left(substr(r.datos, 4), 1) = '{'
                             and substr(r.datos, 4)::jsonb ->> 'estado' = 'En curso' and substr(r.datos, 4)::jsonb ->> 'fase' in ('Planificación', 'Ejecución', 'Transición')
                             and coalesce(substr(r.datos, 4)::jsonb ->> 'tipo', '') <> 'Propuesta'), '{}'::jsonb),
     'tonos', jsonb_build_array(
        jsonb_build_object('desde', 60, 'nivel', 'good', 'txt', 'avanza de forma sólida'),
        jsonb_build_object('desde', 35, 'nivel', 'warn', 'txt', 'avanza con focos de atención'),
        jsonb_build_object('desde', 0,  'nivel', 'bad',  'txt', 'requiere atención ejecutiva inmediata')),
     'ventanas', jsonb_build_object('hitosDias', 30, 'cierreDias', 45, 'proximosDias', 30)) $$;
revoke all on function public.apih_resumen(jsonb) from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c)); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
