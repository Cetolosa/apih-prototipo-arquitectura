-- =====================================================================================
-- APIH Prototipo · F2 · Comandos transaccionales (2): resolver decisión y completar/reabrir hito
--   apih_resolver_decision(p_id, p_estado, p_resolucion, p_fecha, p_aplicar) → jsonb {estado, aplicada, proyecto?, aviso?}
--   apih_hito_estado(p_id, p_completado)                                      → jsonb {completado, fechaReal}
-- Autorización: resolver decisiones = admin o editor con gobierna = true (y con permiso sobre el área);
--               hitos = quien edita el área del proyecto.
-- =====================================================================================

create or replace function public.apih_bitacora(p_ini text, p_tipo text, p_texto text, p_meta text default null)
returns void language plpgsql security definer set search_path = public as
$$ declare per public.perfiles; bid text := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || substr(md5(random()::text), 1, 3);
begin
  select * into per from public.perfiles where email = public.apih_email();
  insert into public.registros(lista, id, datos) values ('APIH_Bitacora', bid, 'p1.' || jsonb_build_object(
    'id', bid, 'ts', (now() at time zone 'America/Santiago')::date::text || 'T' || to_char(now() at time zone 'America/Santiago', 'HH24:MI'),
    'tipo', p_tipo, 'ini', nullif(p_ini, ''), 'autor', coalesce(per.nombre, per.email, public.apih_email()), 'texto', p_texto, 'meta', p_meta)::text);
end $$;
revoke all on function public.apih_bitacora(text, text, text, text) from public, anon, authenticated;

create or replace function public.apih_resolver_decision(p_id text, p_estado text, p_resolucion text default '', p_fecha date default null, p_aplicar boolean default true)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
  per public.perfiles; r public.registros; x jsonb; ir public.registros; i jsonb; tg_lista text;
  aplicada boolean := false; aviso text; nuevo text; mot text; es_prop boolean; hecho boolean; lim date; res text := btrim(coalesce(p_resolucion, ''));
begin
  select * into per from public.perfiles where email = public.apih_email() and activo;
  if per.email is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if not (per.rol = 'admin' or (per.rol = 'editor' and per.gobierna)) then raise exception 'APIH: solo Administra o Responsable con gobierno resuelven decisiones' using errcode = '42501'; end if;
  if p_estado not in ('Aprobada', 'Rechazada', 'Diferida') then raise exception 'APIH: resultado inválido (%)', p_estado using errcode = '22023'; end if;

  select * into r from public.registros where lista = 'APIH_Decisiones' and id = p_id for update;
  if not found then raise exception 'APIH: la decisión % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la decisión' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  if coalesce(x ->> 'estado', '') <> 'Pendiente' then raise exception 'APIH: la decisión no está Pendiente (estado: %)', coalesce(x ->> 'estado', '—') using errcode = '22023'; end if;
  perform set_config('apih.interno', 'on', true);

  if p_estado = 'Diferida' then
    lim := case when nullif(x ->> 'limite', '') is not null and (x ->> 'limite')::date > hoy then (x ->> 'limite')::date else hoy end + 14;
    x := x || jsonb_build_object('limite', lim::text, 'resolucion', res);
    update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;
    perform public.apih_bitacora(x ->> 'ini', 'Decisión', 'Decisión diferida: ' || coalesce(x ->> 'titulo', ''), 'Nueva fecha ' || lim::text);
    perform set_config('apih.interno', 'off', true);
    return jsonb_build_object('estado', 'Diferida', 'aplicada', false, 'limite', lim::text);
  end if;

  x := x || jsonb_build_object('estado', p_estado, 'resolucion', res, 'fResol', coalesce(p_fecha, hoy)::text, 'aplicada', false);
  update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;

  if p_estado = 'Aprobada' and p_aplicar and coalesce(x ->> 'ini', '') <> '' then
    select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = x ->> 'ini' for update;
    if found then
      i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas';
      hecho := (es_prop and (i ->> 'estado') in ('Aprobada', 'Rechazada', 'Retirada')) or (not es_prop and (i ->> 'estado') in ('Completado', 'Cancelado'));
      mot := coalesce(nullif(res, ''), 'Decisión de comité ' || coalesce(x ->> 'comite', ''));
      if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501'; end if;

      if (x ->> 'tipo') = 'Iniciar' and es_prop and not hecho then
        begin
          nuevo := public.apih_aprobar_propuesta(ir.id, mot, false);     -- hace sus propias compuertas; si falta algo, la decisión queda resuelta sin efecto
          aplicada := true;
        exception when others then
          aviso := 'No se crea el proyecto. ' || regexp_replace(sqlerrm, '^APIH:\s*', '');
        end;
        perform set_config('apih.interno', 'on', true);
        select substr(datos, 4)::jsonb into i from public.registros where lista = ir.lista and id = ir.id;
      elsif (x ->> 'tipo') = 'Acelerar' and not es_prop then
        i := i || jsonb_build_object('prioridad', 'Alta');
        if (i ->> 'estado') = 'Pausado' then i := i || jsonb_build_object('estado', 'En curso', 'estadoMotivo', '', 'estadoRev', null); end if;
        aplicada := true;
      elsif (x ->> 'tipo') = 'Pausar' and not hecho then
        i := i || jsonb_build_object('estado', case when es_prop then 'En espera' else 'Pausado' end, 'estadoMotivo', mot, 'estadoRev', (hoy + 30)::text);
        aplicada := true;
      elsif (x ->> 'tipo') = 'Cancelar' and not hecho then
        i := i || jsonb_build_object('estado', case when es_prop then 'Rechazada' else 'Cancelado' end, 'estadoMotivo', mot, 'estadoRev', null);
        aplicada := true;
      elsif (x ->> 'tipo') in ('Pausar', 'Cancelar') and hecho then
        aviso := 'El proyecto ya está cerrado: no se aplica el efecto';
      end if;
      i := i || jsonb_build_object('actualizada', hoy::text);
      update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
    end if;
  end if;

  if aplicada then
    x := x || jsonb_build_object('aplicada', true);
    update public.registros set datos = 'p1.' || x::text where lista = 'APIH_Decisiones' and id = p_id;
  end if;
  perform public.apih_bitacora(x ->> 'ini', 'Decisión', (x ->> 'tipo') || ' · ' || p_estado || ': ' || coalesce(x ->> 'titulo', '') || case when res <> '' then ' — ' || res else '' end,
                               case when aplicada then 'Efecto aplicado' else null end);
  perform set_config('apih.interno', 'off', true);
  return jsonb_strip_nulls(jsonb_build_object('estado', p_estado, 'aplicada', aplicada, 'proyecto', nuevo, 'aviso', aviso));
end $$;

create or replace function public.apih_hito_estado(p_id text, p_completado boolean)
returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := (now() at time zone 'America/Santiago')::date; r public.registros; h jsonb; ir public.registros; i jsonb;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
  if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso para editar hitos de esta área' using errcode = '42501'; end if;
  h := substr(r.datos, 4)::jsonb;
  h := h || jsonb_build_object('completado', p_completado, 'fechaReal', case when p_completado then hoy::text else null end);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || h::text where lista = 'APIH_Hitos' and id = p_id;
  select * into ir from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = h ->> 'ini';
  if found then
    i := substr(ir.datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text);
    update public.registros set datos = 'p1.' || i::text where lista = ir.lista and id = ir.id;
  end if;
  perform public.apih_bitacora(h ->> 'ini', 'Actualización', case when p_completado then 'Hito completado: ' else 'Hito reabierto: ' end || coalesce(h ->> 'nombre', ''));
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('completado', p_completado, 'fechaReal', h -> 'fechaReal');
end $$;

revoke all on function public.apih_resolver_decision(text, text, text, date, boolean), public.apih_hito_estado(text, boolean) from public, anon;
grant execute on function public.apih_resolver_decision(text, text, text, date, boolean), public.apih_hito_estado(text, boolean) to authenticated;
