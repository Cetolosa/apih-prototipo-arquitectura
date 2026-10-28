-- =====================================================================================
-- APIH Prototipo · Iter 5g · Directorio de personas y roles: se calcula en el servidor
--   Quién participa en el portafolio, con qué roles y qué tiene abierto (proyectos, hitos, riesgos, decisiones, acciones).
--   Fuente de acceso/cargo/áreas: tabla de perfiles. apih_calculos() lo entrega en «personas»; la SPA solo filtra y muestra.
-- =====================================================================================
create or replace function public.apih_personas_dir() returns jsonb language sql stable security definer set search_path = public as
$$ with hoy as materialized (select public.apih_hoy() d),
 reg as materialized (select r.lista, r.id, substr(r.datos, 4)::jsonb j from public.registros_v r
                       where r.lista in ('APIH_Proyectos', 'APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones', 'APIH_Comites') and left(substr(r.datos, 4), 1) = '{'),
 ini as materialized (select id, j from reg where lista = 'APIH_Proyectos'),
 sb as materialized (select id from ini where j ->> 'estado' = 'Stand By'),
 nm(txt, kind, ref, rol) as (
   select j ->> 'lider', 'lider', id, case when j ->> 'tipo' = 'Propuesta' then 'Líder de propuesta' else 'Líder de proyecto' end from ini where id not in (select id from sb)
   union all select j ->> 'sponsor', 'sponsor', id, 'Sponsor' from ini where id not in (select id from sb)
   union all select j ->> 'negocio', 'negocio', id, 'Negocio' from ini where id not in (select id from sb)),
 pn as (select trim(n) n, kind, ref, rol from nm, regexp_split_to_table(coalesce(txt, ''), '\s+-\s+|,') n where trim(n) <> ''),
 vivo as (select id from ini where id not in (select id from sb)
            and j ->> 'estado' <> all (case when j ->> 'tipo' = 'Propuesta' then array['Aprobada', 'Rechazada', 'Retirada'] else array['Completado', 'Cancelado'] end)),
 ev(n, rol, area, cargo, acceso, lidera, hitos, hatr, riesgos, decis, acc) as materialized (
   select coalesce(nullif(p.nombre, ''), p.email), null, a, p.cargo, p.app_rol, 0, 0, 0, 0, 0, 0
     from public.perfiles p left join lateral regexp_split_to_table(coalesce(array_to_string(p.areas, ','), ''), ',') a on true where p.activo
   union all select pn.n, pn.rol, null, null, null, case when pn.kind = 'lider' and pn.rol = 'Líder de proyecto' and pn.ref in (select id from vivo) then 1 else 0 end, 0, 0, 0, 0, 0 from pn
   union all select pn.n, null, trim(a), null, null, 0, 0, 0, 0, 0, 0
     from pn join ini on ini.id = pn.ref, regexp_split_to_table(coalesce(ini.j ->> 'area', ''), ',') a where pn.kind = 'lider'
   union all select pn.n, null, trim(split_part(coalesce(ini.j ->> 'area', ''), ',', 1)), null, null, 0, 0, 0, 0, 0, 0
     from pn join ini on ini.id = pn.ref where pn.kind = 'sponsor'
   union all select h ->> 'resp', 'Responsable de hito', null, null, null, 0, case when coalesce((h ->> 'completado')::boolean, false) then 0 else 1 end,
          case when not coalesce((h ->> 'completado')::boolean, false) and h ->> 'fecha' < (select d::text from hoy) then 1 else 0 end, 0, 0, 0
     from (select j h from reg where lista = 'APIH_Hitos') q
    where coalesce(h ->> 'resp', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select h ->> 'dueno', 'Dueño de riesgo', null, null, null, 0, 0, 0, case when coalesce(h ->> 'estado', '') <> 'Cerrado' then 1 else 0 end, 0, 0
     from (select j h from reg where lista = 'APIH_Riesgos') q
    where coalesce(h ->> 'dueno', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select h ->> 'solicita', 'Solicita decisiones', null, null, null, 0, 0, 0, 0, case when h ->> 'estado' = 'Pendiente' then 1 else 0 end, 0
     from (select j h from reg where lista = 'APIH_Decisiones') q
    where coalesce(h ->> 'solicita', '') <> '' and (h ->> 'ini') not in (select id from sb)
   union all select x ->> 'n', 'Comité', null, x ->> 'rol', null, 0, 0, 0, 0, 0, 0
     from (select j c from reg where lista = 'APIH_Comites') q,
          jsonb_array_elements(coalesce(c -> 'participantes', '[]'::jsonb)) x where coalesce(x ->> 'n', '') <> ''
   union all select a ->> 'resp', null, null, null, null, 0, 0, 0, 0, 0, case when a ->> 'estado' in ('Abierta', 'Abierto') then 1 else 0 end
     from (select j c from reg where lista = 'APIH_Comites') q,
          jsonb_array_elements(coalesce(c -> 'acciones', '[]'::jsonb) || coalesce(c -> 'compromisos', '[]'::jsonb)) a where coalesce(a ->> 'resp', '') <> ''),
 rc as materialized (select n, rol, count(*) k from ev where rol is not null group by n, rol)
 select coalesce(jsonb_agg(jsonb_build_object('n', g.n, 'cargo', g.cargo, 'acceso', g.acceso,
          'areas', coalesce(ar.a, '[]'::jsonb), 'roles', coalesce(rr.r, '{}'::jsonb),
          'lidera', g.lidera, 'hitos', g.hitos, 'hitosAtr', g.hatr, 'riesgos', g.riesgos, 'decis', g.decis, 'acc', g.acc) order by g.n), '[]'::jsonb)
   from (select e.n, coalesce(max(nullif(e.cargo, '')) filter (where e.rol is null), max(nullif(e.cargo, ''))) cargo, coalesce(max(e.acceso), '') acceso,
                sum(e.lidera) lidera, sum(e.hitos) hitos, sum(e.hatr) hatr, sum(e.riesgos) riesgos, sum(e.decis) decis, sum(e.acc) acc
           from ev e where e.n is not null and e.n <> '' group by e.n) g
   left join (select n, jsonb_agg(a order by a) a from (select distinct n, trim(area) a from ev where coalesce(trim(area), '') <> '') x group by n) ar on ar.n = g.n
   left join (select n, jsonb_object_agg(rol, k) r from rc group by n) rr on rr.n = g.n $$;
revoke all on function public.apih_personas_dir() from public, anon, authenticated;

create or replace function public.apih_calculos() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare c jsonb := public.apih_calculos_base(); h jsonb := public.apih_hallazgos(c);
begin return c || jsonb_build_object('hallazgos', h -> 'hallazgos', 'puntajes', h -> 'puntajes', 'evm', h -> 'evm', 'sem', h -> 'sem', 'cambios', h -> 'cambios', 'capacidad', public.apih_capacidad(c),
                                      'notif', public.apih_avisos(c), 'resumen', public.apih_resumen(c), 'personas', public.apih_personas_dir()); end $$;
revoke all on function public.apih_calculos() from public, anon;
grant execute on function public.apih_calculos() to authenticated;
