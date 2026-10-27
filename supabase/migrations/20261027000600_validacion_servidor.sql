-- =====================================================================================
-- APIH Prototipo · F2 · Validación de estructura en la base (portable: PL/pgSQL, sin extensiones)
--   apih_validar(lista, id, json): el servidor rechaza fechas mal formadas, estados fuera de catálogo,
--   escalas de riesgo fuera de rango, ids que no coinciden y tipos incorrectos. Antes solo lo hacía el navegador.
--   Índices para las búsquedas por iniciativa y por estado.
-- =====================================================================================

create or replace function public.apih_validar(p_lista text, p_id text, j jsonb) returns void language plpgsql immutable set search_path = public as
$$
declare k text; v text; n numeric;
begin
  if p_lista not like 'APIH\_%' or p_lista in ('APIH_Config', 'APIH_Roles', 'APIH_Claves') then return; end if;
  if j ? 'id' and (j ->> 'id') is distinct from p_id then raise exception 'APIH: el id del contenido (%) no coincide con el registro (%)', j ->> 'id', p_id using errcode = '22023'; end if;
  foreach k in array array['inicioPlan','finPlan','finEst','inicioReal','finReal','fecha','fechaReal','limite','fResol','fDec','creada','actualizada','estadoRev','fIdent'] loop
    v := j ->> k;
    if v is not null and v <> '' then
      if jsonb_typeof(j -> k) <> 'string' or v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'APIH: % debe ser una fecha AAAA-MM-DD', k using errcode = '22023'; end if;
      begin perform v::date; exception when others then raise exception 'APIH: % no es una fecha válida (%)', k, v using errcode = '22023'; end;
    end if;
  end loop;
  if p_lista = 'APIH_Proyectos' and coalesce(j ->> 'estado', 'En curso') not in ('En curso','Pausado','Stand By','Completado','Cancelado') then
    raise exception 'APIH: estado de proyecto inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista = 'APIH_Propuestas' and coalesce(j ->> 'estado', 'Vigente') not in ('Vigente','En espera','Stand By','Aprobada','Rechazada','Retirada') then
    raise exception 'APIH: estado de propuesta inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista in ('APIH_Proyectos', 'APIH_Propuestas') then
    if coalesce(j ->> 'rag', 'Verde') not in ('Verde','Ámbar','Rojo') then raise exception 'APIH: RAG inválido (%)', j ->> 'rag' using errcode = '22023'; end if;
    if coalesce(nullif(j ->> 'prioridad', ''), 'Media') not in ('Alta','Media','Baja') then raise exception 'APIH: prioridad inválida (%)', j ->> 'prioridad' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Decisiones' then
    if coalesce(j ->> 'tipo', 'Mantener') not in ('Iniciar','Acelerar','Mantener','Pausar','Cancelar') then raise exception 'APIH: tipo de decisión inválido (%)', j ->> 'tipo' using errcode = '22023'; end if;
    if coalesce(j ->> 'estado', 'Pendiente') not in ('Pendiente','Aprobada','Rechazada','Diferida') then raise exception 'APIH: estado de decisión inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Cambios' and coalesce(j ->> 'estado', 'Solicitado') not in ('Solicitado','Aprobado','Rechazado') then
    raise exception 'APIH: estado de cambio inválido (%)', j ->> 'estado' using errcode = '22023'; end if;
  if p_lista = 'APIH_Hitos' then
    if btrim(coalesce(j ->> 'nombre', '')) = '' then raise exception 'APIH: el hito necesita nombre' using errcode = '22023'; end if;
    if j ? 'completado' and jsonb_typeof(j -> 'completado') not in ('boolean', 'null') then raise exception 'APIH: completado debe ser verdadero o falso' using errcode = '22023'; end if;
  end if;
  if p_lista = 'APIH_Riesgos' then
    foreach k in array array['prob','imp'] loop
      if j ? k and jsonb_typeof(j -> k) <> 'null' then
        if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023'; end if;
        n := (j ->> k)::numeric; if n < 1 or n > 5 then raise exception 'APIH: % fuera de 1..5', k using errcode = '22023'; end if;
      end if;
    end loop;
  end if;
end $$;

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

  perform public.apih_validar(new.lista, new.id, jn);
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

-- Índices: búsquedas por iniciativa (hitos, riesgos, decisiones, cambios...) y por estado
create index if not exists registros_ini_idx on public.registros (lista, ((substr(datos, 4)::jsonb) ->> 'ini'))
  where lista in ('APIH_Hitos','APIH_Riesgos','APIH_Decisiones','APIH_Compromisos','APIH_Cambios','APIH_Notas','APIH_Documentos') and left(substr(datos, 4), 1) = '{';
create index if not exists registros_estado_idx on public.registros (lista, ((substr(datos, 4)::jsonb) ->> 'estado'))
  where lista in ('APIH_Proyectos','APIH_Propuestas','APIH_Decisiones','APIH_Cambios') and left(substr(datos, 4), 1) = '{';
