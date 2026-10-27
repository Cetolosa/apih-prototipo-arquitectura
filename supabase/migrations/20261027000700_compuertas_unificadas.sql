-- =====================================================================================
-- APIH Prototipo · F3 · Una sola definición de las compuertas de aprobación
--   apih_faltan_aprobar(id) devuelve las compuertas incumplidas; apih_aprobar_propuesta la usa.
--   La app las muestra con su propia copia (necesita pintarlas sin esperar a la red); un contrato
--   compartido (tests/contract/gates_aprobar.json) se prueba contra AMBAS para que no diverjan.
-- =====================================================================================

create or replace function public.apih_faltan_aprobar(p_id text) returns text[] language plpgsql stable security definer set search_path = public as
$$
declare j jsonb; faltan text[] := '{}';
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Propuestas' and id = p_id and left(substr(datos, 4), 1) = '{';
  if j is null then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if coalesce(j ->> 'fase', '') <> 'Aprobación' then faltan := array_append(faltan, 'Propuesta en fase Aprobación'::text); end if;
  if coalesce(j ->> 'sponsor', '') = '' then faltan := array_append(faltan, 'Sponsor identificado'::text); end if;
  if coalesce(j ->> 'lider', '') = '' then faltan := array_append(faltan, 'Líder asignado'::text); end if;
  if not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) then faltan := array_append(faltan, 'Presupuesto asignado'::text); end if;
  if coalesce(j ->> 'bc', '') = '' then faltan := array_append(faltan, 'Business case redactado'::text); end if;
  if not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
                   and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada') then
    faltan := array_append(faltan, 'Decisión "Iniciar" aprobada en comité'::text);
  end if;
  return faltan;
end $$;
revoke all on function public.apih_faltan_aprobar(text) from public, anon;
grant execute on function public.apih_faltan_aprobar(text) to authenticated;

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
