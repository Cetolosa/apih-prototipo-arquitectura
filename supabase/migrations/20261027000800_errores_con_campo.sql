-- =====================================================================================
-- APIH Prototipo · F3 · Errores del servidor con el campo afectado (HINT)
--   La app marca el campo del formulario que el servidor rechazó. Mismas reglas que antes; solo se agrega el campo.
-- =====================================================================================

create or replace function public.apih_validar(p_lista text, p_id text, j jsonb) returns void language plpgsql immutable set search_path = public as
$$
declare k text; v text; n numeric;
begin
  if p_lista not like 'APIH\_%' or p_lista in ('APIH_Config', 'APIH_Roles', 'APIH_Claves') then return; end if;
  if j ? 'id' and (j ->> 'id') is distinct from p_id then raise exception 'APIH: el id del contenido (%) no coincide con el registro (%)', j ->> 'id', p_id using errcode = '22023', hint = 'id'; end if;
  foreach k in array array['inicioPlan','finPlan','finEst','inicioReal','finReal','fecha','fechaReal','limite','fResol','fDec','creada','actualizada','estadoRev','fIdent'] loop
    v := j ->> k;
    if v is not null and v <> '' then
      if jsonb_typeof(j -> k) <> 'string' or v !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'APIH: % debe ser una fecha AAAA-MM-DD', k using errcode = '22023', hint = k; end if;
      begin perform v::date; exception when others then raise exception 'APIH: % no es una fecha válida (%)', k, v using errcode = '22023', hint = k; end;
    end if;
  end loop;
  if p_lista = 'APIH_Proyectos' and coalesce(j ->> 'estado', 'En curso') not in ('En curso','Pausado','Stand By','Completado','Cancelado') then
    raise exception 'APIH: estado de proyecto inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista = 'APIH_Propuestas' and coalesce(j ->> 'estado', 'Vigente') not in ('Vigente','En espera','Stand By','Aprobada','Rechazada','Retirada') then
    raise exception 'APIH: estado de propuesta inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista in ('APIH_Proyectos', 'APIH_Propuestas') then
    if coalesce(j ->> 'rag', 'Verde') not in ('Verde','Ámbar','Rojo') then raise exception 'APIH: RAG inválido (%)', j ->> 'rag' using errcode = '22023', hint = 'rag'; end if;
    if coalesce(nullif(j ->> 'prioridad', ''), 'Media') not in ('Alta','Media','Baja') then raise exception 'APIH: prioridad inválida (%)', j ->> 'prioridad' using errcode = '22023', hint = 'prioridad'; end if;
  end if;
  if p_lista = 'APIH_Decisiones' then
    if coalesce(j ->> 'tipo', 'Mantener') not in ('Iniciar','Acelerar','Mantener','Pausar','Cancelar') then raise exception 'APIH: tipo de decisión inválido (%)', j ->> 'tipo' using errcode = '22023', hint = 'tipo'; end if;
    if coalesce(j ->> 'estado', 'Pendiente') not in ('Pendiente','Aprobada','Rechazada','Diferida') then raise exception 'APIH: estado de decisión inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  end if;
  if p_lista = 'APIH_Cambios' and coalesce(j ->> 'estado', 'Solicitado') not in ('Solicitado','Aprobado','Rechazado') then
    raise exception 'APIH: estado de cambio inválido (%)', j ->> 'estado' using errcode = '22023', hint = 'estado'; end if;
  if p_lista = 'APIH_Hitos' then
    if btrim(coalesce(j ->> 'nombre', '')) = '' then raise exception 'APIH: el hito necesita nombre' using errcode = '22023', hint = 'nombre'; end if;
    if j ? 'completado' and jsonb_typeof(j -> 'completado') not in ('boolean', 'null') then raise exception 'APIH: completado debe ser verdadero o falso' using errcode = '22023', hint = 'completado'; end if;
  end if;
  if p_lista = 'APIH_Riesgos' then
    foreach k in array array['prob','imp'] loop
      if j ? k and jsonb_typeof(j -> k) <> 'null' then
        if jsonb_typeof(j -> k) <> 'number' then raise exception 'APIH: % debe ser numérico', k using errcode = '22023', hint = k; end if;
        n := (j ->> k)::numeric; if n < 1 or n > 5 then raise exception 'APIH: % fuera de 1..5', k using errcode = '22023', hint = k; end if;
      end if;
    end loop;
  end if;
end $$;

create or replace function public.apih_solicitar_cambio(p_ini text, p_tipo text, p_desc text, p_motivo text, p_impacto text default '',
                                                        p_fnue date default null, p_pnue numeric default 0)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; id text; c jsonb; efecto text[] := '{}'; fant date;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_tipo not in ('Alcance', 'Fecha', 'Presupuesto', 'Recursos', 'Otro') then raise exception 'APIH: tipo de cambio inválido (%)', p_tipo using errcode = '22023', hint = 'tipo'; end if;
  if btrim(coalesce(p_desc, '')) = '' then raise exception 'APIH: indica qué cambia' using errcode = '22023', hint = 'desc'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'APIH: indica por qué (motivo)' using errcode = '22023', hint = 'motivo'; end if;
  if coalesce(p_pnue, 0) < 0 then raise exception 'APIH: el presupuesto no puede ser negativo' using errcode = '22023', hint = 'pNue'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and registros.id = p_ini;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_ini using errcode = 'P0002', hint = 'ini'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if coalesce(p_pnue, 0) > 0 and not public.apih_ve_montos() then raise exception 'APIH: sin permiso para proponer montos' using errcode = '42501', hint = 'pNue'; end if;
  i := substr(ir.datos, 4)::jsonb;
  fant := nullif(i ->> 'finPlan', '')::date;
  if p_fnue is not null and p_fnue = fant and coalesce(p_pnue, 0) = 0 then raise exception 'APIH: la nueva fecha es igual a la actual' using errcode = '22023', hint = 'fNue'; end if;
  if p_fnue is not null and nullif(i ->> 'inicioPlan', '') is not null and p_fnue < (i ->> 'inicioPlan')::date then
    raise exception 'APIH: la nueva fecha de fin no puede ser anterior al inicio plan (%)', i ->> 'inicioPlan' using errcode = '22023', hint = 'fNue'; end if;

  perform set_config('apih.interno', 'on', true);
  id := public.apih_siguiente('CHG', 'APIH_Cambios');
  c := jsonb_build_object('id', id, 'ini', p_ini, 'tipo', p_tipo, 'desc', btrim(p_desc), 'motivo', btrim(p_motivo), 'impacto', coalesce(p_impacto, ''),
        'fNue', p_fnue::text, 'pNue', coalesce(p_pnue, 0), 'solicita', coalesce(per.nombre, per.email), 'fAnt', fant::text, 'pAnt', coalesce((i ->> 'presupuesto')::numeric, 0),
        'estado', 'Solicitado', 'aprobador', '', 'fDec', null, 'nota', '', 'creada', hoy::text);
  insert into public.registros(lista, id, datos) values ('APIH_Cambios', id, 'p1.' || c::text);
  if p_fnue is not null then efecto := array_append(efecto, 'Fin plan ' || coalesce(fant::text, '—') || ' → ' || p_fnue::text); end if;
  if coalesce(p_pnue, 0) > 0 then efecto := array_append(efecto, 'Cambio de presupuesto'::text); end if;
  perform public.apih_bitacora(p_ini, 'Cambio', 'Solicitud de cambio ' || id || ' (' || p_tipo || '): ' || btrim(p_desc) || '. ' || coalesce(nullif(array_to_string(efecto, ' · '), ''), 'Sin efecto en fecha ni presupuesto'));
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('id', id);
end $$;

create or replace function public.apih_resolver_cambio(p_id text, p_estado text, p_nota text default '')
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; c jsonb; ir public.registros; i jsonb; ap boolean := p_estado = 'Aprobado'; nota text := btrim(coalesce(p_nota, '')); es_sponsor boolean;
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_estado not in ('Aprobado', 'Rechazado') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;
  if not ap and nota = '' then raise exception 'APIH: indica el motivo del rechazo' using errcode = '22023', hint = 'nota'; end if;
  select * into r from public.registros where lista = 'APIH_Cambios' and id = p_id for update;
  if not found then raise exception 'APIH: el cambio % no existe', p_id using errcode = 'P0002'; end if;
  c := substr(r.datos, 4)::jsonb;
  if c ->> 'estado' <> 'Solicitado' then raise exception 'APIH: el cambio ya fue resuelto (%)', c ->> 'estado' using errcode = '22023'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = c ->> 'ini' for update;
  if not found then raise exception 'APIH: la iniciativa del cambio no existe' using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  es_sponsor := nullif(i ->> 'sponsor', '') is not null and (i ->> 'sponsor') in (coalesce(per.nombre, ''), per.email);
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna) or es_sponsor) then
    raise exception 'APIH: solo el sponsor, Responsable o Administra resuelven cambios' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;
  if ap and coalesce((c ->> 'pNue')::numeric, 0) > 0 and not public.apih_ve_montos() then
    raise exception 'APIH: aprobar un cambio de presupuesto requiere permiso de montos' using errcode = '42501', hint = 'pNue'; end if;

  perform set_config('apih.interno', 'on', true);
  c := c || jsonb_build_object('estado', p_estado, 'aprobador', coalesce(per.nombre, per.email), 'nota', nota, 'fDec', hoy::text);
  update public.registros set datos = 'p1.' || c::text where lista = 'APIH_Cambios' and id = p_id;
  if ap then
    if nullif(c ->> 'fNue', '') is not null then
      i := i || jsonb_build_object('finPlan', c ->> 'fNue');
      if nullif(i ->> 'finEst', '') is null or (i ->> 'finEst') < (c ->> 'fNue') then i := i || jsonb_build_object('finEst', c ->> 'fNue'); end if;
    end if;
    if coalesce((c ->> 'pNue')::numeric, 0) > 0 then i := i || jsonb_build_object('presupuesto', (c ->> 'pNue')::numeric); end if;
    i := i || jsonb_build_object('actualizada', hoy::text);
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(c ->> 'ini', 'Decisión', 'Cambio ' || p_id || case when ap then ' aprobado' else ' rechazado' end || ' por ' || (c ->> 'aprobador') || case when nota <> '' then ': ' || nota else '' end,
                               case when ap then 'Línea base actualizada' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', p_estado, 'aplicado', ap);
end $$;

create or replace function public.apih_reabrir(p_id text, p_nota text)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; ir public.registros; i jsonb; prev text; es_prop boolean; nota text := btrim(coalesce(p_nota, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if nota = '' then raise exception 'APIH: indica el motivo de la reapertura' using errcode = '22023', hint = 'nota'; end if;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id for update;
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002', hint = 'ini'; end if;
  i := substr(ir.datos, 4)::jsonb; prev := i ->> 'estado'; es_prop := ir.lista = 'APIH_Propuestas';
  if es_prop and prev not in ('Rechazada', 'Retirada') then raise exception 'APIH: solo se reabren propuestas Rechazadas o Retiradas (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and prev not in ('Completado', 'Cancelado') then raise exception 'APIH: solo se reabren proyectos cerrados (estado: %)', prev using errcode = '22023'; end if;
  if not es_prop and per.rol <> 'admin' then raise exception 'APIH: solo Administra puede reabrir un proyecto cerrado' using errcode = '42501'; end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

  perform set_config('apih.interno', 'on', true);
  i := i || jsonb_build_object('estado', case when es_prop then 'Vigente' else 'En curso' end, 'estadoMotivo', '', 'estadoRev', null, 'actualizada', hoy::text);
  if not es_prop then i := i || jsonb_build_object('finReal', null); end if;
  update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  perform public.apih_bitacora(p_id, 'Cambio', case when es_prop then 'Propuesta reabierta' else 'Proyecto reabierto' end || ' (era ' || prev || '): ' || nota);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('estado', i ->> 'estado');
end $$;
