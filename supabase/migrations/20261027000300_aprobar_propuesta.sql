-- =====================================================================================
-- APIH Prototipo · F2 · Comandos transaccionales en el servidor
--   apih_aprobar_propuesta(p_id, p_nota, p_forzar): valida compuertas, crea el proyecto, cierra la propuesta,
--   traslada hitos y riesgos, aplica la plantilla de la metodología y deja la bitácora, todo en UNA transacción.
--   Si cualquier paso falla, no queda nada a medias (antes lo hacía el navegador con varias escrituras sueltas).
-- =====================================================================================


-- apih_fila reconoce los comandos del servidor (GUC local a la transacción; el cliente no puede fijarlo)
create or replace function public.apih_fila() returns trigger language plpgsql security definer set search_path = public as
$$
declare jn jsonb; jo jsonb; k text; tocó boolean := false; ver boolean := public.apih_ve_montos() or auth.jwt() is null or coalesce(auth.jwt() ->> 'role','') = 'service_role'
                  or coalesce(current_setting('apih.interno', true), '') = 'on';   -- comandos del servidor (apih_*) ya validaron permisos
begin
  new.modificado_por := public.apih_email();
  new.actualizado    := clock_timestamp();
  begin jn := substr(new.datos, 4)::jsonb; exception when others then raise exception 'APIH: JSON inválido en %/%', new.lista, new.id using errcode = '22023'; end;
  if jsonb_typeof(jn) <> 'object' then
    if new.lista <> 'APIH_Config' then raise exception 'APIH: se esperaba un objeto JSON en %/%', new.lista, new.id using errcode = '22023'; end if;
    new.area := null;      -- la configuración puede ser una lista (eventos, presentaciones…): sin área ni montos
    insert into public.auditoria(email, accion, lista, id_registro, area) values (new.modificado_por, lower(tg_op), new.lista, new.id, null);
    return new;
  end if;

  -- validación mínima de proyectos y propuestas
  if new.lista in ('APIH_Proyectos','APIH_Propuestas') then
    if coalesce(jn ->> 'titulo','') = '' then raise exception 'APIH: titulo obligatorio' using errcode = '22023'; end if;
    foreach k in array array['presupuesto','gastado','beneficio','ahorroReal','avance'] loop
      if jn ? k and jsonb_typeof(jn -> k) not in ('number','null') then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
    end loop;
    if jn ? 'avance' and jsonb_typeof(jn -> 'avance') = 'number' and ((jn ->> 'avance')::numeric < 0 or (jn ->> 'avance')::numeric > 100) then
      raise exception 'APIH: avance fuera de 0..100' using errcode = '22023'; end if;
  end if;

  -- montos: quien no los ve no puede crearlos ni cambiarlos; se conservan los existentes
  if tg_op = 'UPDATE' then jo := substr(old.datos, 4)::jsonb; else jo := '{}'::jsonb; end if;
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

-- Configuración completa (el cliente la parte en trozos 'cfg#n' si es grande)
create or replace function public.apih_cfg() returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare j jsonb; s text;
begin
  select substr(datos, 4)::jsonb into j from public.registros where lista = 'APIH_Config' and id = 'cfg';
  if j is null then return '{}'::jsonb; end if;
  if jsonb_typeof(j) = 'object' and j ? '__chunks' then
    select string_agg(substr(datos, 4), '' order by (regexp_replace(id, '^cfg#', ''))::int) into s
      from public.registros where lista = 'APIH_Config' and id ~ '^cfg#[0-9]+$';
    return coalesce(s::jsonb, '{}'::jsonb);
  end if;
  return j;
end $$;

-- Siguiente id correlativo (PRJ-001…): nunca repite y nunca retrocede (considera lo existente y el contador seq)
create or replace function public.apih_siguiente(p_prefijo text, p_lista text) returns text language plpgsql security definer set search_path = public as
$$ declare mx bigint; sq bigint; n bigint; cur jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('apih_id_' || p_prefijo));
  select coalesce(max(substring(id from '^' || p_prefijo || '-([0-9]+)$')::bigint), 0) into mx from public.registros where lista = p_lista and id ~ ('^' || p_prefijo || '-[0-9]+$');
  select coalesce(((substr(datos, 4)::jsonb) ->> p_prefijo)::bigint, 0) into sq from public.registros where lista = 'APIH_Config' and id = 'seq' and left(substr(datos,4),1) = '{';
  n := greatest(mx, coalesce(sq, 0)) + 1;
  select substr(datos, 4)::jsonb into cur from public.registros where lista = 'APIH_Config' and id = 'seq';
  insert into public.registros(lista, id, datos) values ('APIH_Config', 'seq', 'p1.' || jsonb_build_object(p_prefijo, n)::text)
    on conflict (lista, id) do update set datos = 'p1.' || (coalesce(cur, '{}'::jsonb) || jsonb_build_object(p_prefijo, n))::text;
  return p_prefijo || '-' || lpad(n::text, 3, '0');
end $$;

create or replace function public.apih_aprobar_propuesta(p_id text, p_nota text default '', p_forzar boolean default false)
returns text language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; j jsonb; nj jsonb; pj jsonb; cfg jsonb; tipo jsonb; h jsonb; rec record; jr jsonb;
  faltan text[] := '{}'; nuevo text; nota text; fasesprop jsonb; fasesprj jsonb; hn text; base date; n_hit int := 0;
  autor text; ts text := to_char(now() at time zone 'America/Santiago', 'HH24:MI');
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;

  select * into r from public.registros where lista = 'APIH_Propuestas' and id = p_id for update;
  if not found then raise exception 'APIH: la propuesta % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para aprobar en el área %', coalesce(r.area, '—') using errcode = '42501'; end if;
  j := substr(r.datos, 4)::jsonb;
  if coalesce(j ->> 'estado', '') <> 'Vigente' then raise exception 'APIH: la propuesta no está Vigente (estado: %)', coalesce(j ->> 'estado', '—') using errcode = '22023'; end if;

  -- compuertas (mismas que la pantalla de aprobación)
  if coalesce(j ->> 'fase', '') <> 'Aprobación' then faltan := array_append(faltan, 'Propuesta en fase Aprobación'::text); end if;
  if coalesce(j ->> 'sponsor', '') = '' then faltan := array_append(faltan, 'Sponsor identificado'::text); end if;
  if coalesce(j ->> 'lider', '') = '' then faltan := array_append(faltan, 'Líder asignado'::text); end if;
  if not (jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0) then faltan := array_append(faltan, 'Presupuesto asignado'::text); end if;
  if coalesce(j ->> 'bc', '') = '' then faltan := array_append(faltan, 'Business case redactado'::text); end if;
  if not exists (select 1 from public.registros d where d.lista = 'APIH_Decisiones' and left(substr(d.datos, 4), 1) = '{'
                   and (substr(d.datos, 4)::jsonb ->> 'ini') = p_id and (substr(d.datos, 4)::jsonb ->> 'tipo') = 'Iniciar' and (substr(d.datos, 4)::jsonb ->> 'estado') = 'Aprobada') then
    faltan := array_append(faltan, 'Decisión "Iniciar" aprobada en comité'::text);
  end if;
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
  insert into public.registros(lista, id, datos) values
   ('APIH_Bitacora', 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a', 'p1.' || jsonb_build_object('id', 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'a',
      'ts', hoy::text || 'T' || ts, 'tipo', 'Decisión', 'ini', p_id, 'autor', autor,
      'texto', 'Propuesta aprobada → proyecto ' || nuevo || case when nota <> '' then ' — ' || nota else '' end, 'meta', null)::text),
   ('APIH_Bitacora', 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b', 'p1.' || jsonb_build_object('id', 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || 'b',
      'ts', hoy::text || 'T' || ts, 'tipo', 'Cambio', 'ini', nuevo, 'autor', autor,
      'texto', 'Proyecto creado desde la propuesta ' || p_id, 'meta', null)::text);

  perform set_config('apih.interno', 'off', true);
  return nuevo;
end $$;

revoke all on function public.apih_aprobar_propuesta(text, text, boolean) from public, anon;
grant execute on function public.apih_aprobar_propuesta(text, text, boolean) to authenticated;
revoke all on function public.apih_siguiente(text, text), public.apih_cfg() from public, anon, authenticated;
