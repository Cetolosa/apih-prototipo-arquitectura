-- =====================================================================================
-- APIH Prototipo · Iter 5m · Comentarios y acciones del Reglas PMO: comandos del servidor
--   apih_comentar(p_ini, p_texto, p_tema, p_en_pres)   comentario en la bitácora (general o de una iniciativa)
--   apih_aplicar_rag(p_id)                              pone el RAG que sugieren las reglas (lo calcula el servidor)
--   apih_avance_auto(p_id)                              quita el ajuste manual: se usa el avance calculado
--   apih_recordar_avance(p_id)                          deja registrado el recordatorio de actualización al líder
--   apih_accion_recuperacion(p_id)                      crea la acción de recuperación en el próximo comité programado
-- =====================================================================================
create or replace function public.apih_comentar(p_ini text, p_texto text, p_tema text default null, p_en_pres boolean default true) returns jsonb language plpgsql security definer set search_path = public as
$$
declare t text := btrim(coalesce(p_texto, '')); bid text := 'BIT-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSUS') || substr(md5(random()::text), 1, 3); per public.perfiles; j jsonb;
begin
  if t = '' then perform public.apih_err('escribe un comentario', 'texto'); end if;
  if length(t) > 2000 then perform public.apih_err('el comentario admite hasta 2000 caracteres', 'texto'); end if;
  if coalesce(p_ini, '') <> '' then perform public.apih_puede_ini(p_ini);
  elsif not public.apih_escribe('APIH_Bitacora', 'general', null) then raise exception 'APIH: sin permiso para comentar' using errcode = '42501'; end if;
  select * into per from public.perfiles where email = public.apih_email();
  j := jsonb_build_object('id', bid, 'ts', (now() at time zone 'America/Santiago')::date::text || 'T' || to_char(now() at time zone 'America/Santiago', 'HH24:MI'),
         'tipo', 'Comentario', 'ini', nullif(p_ini, ''), 'autor', coalesce(per.nombre, per.email, public.apih_email()), 'texto', t, 'meta', null);
  if public.apih_txt(jsonb_build_object('t', p_tema), 't') is not null then j := j || jsonb_build_object('tema', btrim(p_tema)); end if;
  if not coalesce(p_en_pres, true) then j := j || jsonb_build_object('inPres', false); end if;
  perform set_config('apih.interno', 'on', true);
  perform public.apih_escribir('APIH_Bitacora', bid, j);
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('id', bid);
end $$;
revoke all on function public.apih_comentar(text, text, text, boolean) from public, anon;
grant execute on function public.apih_comentar(text, text, text, boolean) to authenticated;

create or replace function public.apih_aplicar_rag(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; sug text; c jsonb;
begin
  ir := public.apih_puede_ini(p_id); i := substr(ir.datos, 4)::jsonb;
  c := public.apih_calculos_base() -> 'ini' -> p_id;
  sug := c -> 'rag' ->> 'rag';
  if sug is null then raise exception 'APIH: no hay un RAG sugerido para %', p_id using errcode = '22023'; end if;
  perform public.apih_escribir(ir.lista, p_id, i || jsonb_build_object('rag', sug, 'actualizada', public.apih_hoy()::text));
  perform public.apih_bitacora_cmd(p_id, 'Cambio', 'RAG ' || coalesce(i ->> 'rag', '—') || ' → ' || sug || ' (sugerido por reglas automáticas)');
  return jsonb_build_object('id', p_id, 'rag', sug);
end $$;
revoke all on function public.apih_aplicar_rag(text) from public, anon;
grant execute on function public.apih_aplicar_rag(text) to authenticated;

create or replace function public.apih_avance_auto(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb;
begin
  ir := public.apih_puede_ini(p_id); i := substr(ir.datos, 4)::jsonb;
  if ir.lista <> 'APIH_Proyectos' then raise exception 'APIH: el avance automático es de proyectos' using errcode = '22023'; end if;
  perform public.apih_escribir(ir.lista, p_id, i || jsonb_build_object('avanceManual', null, 'actualizada', public.apih_hoy()::text));
  perform public.apih_bitacora_cmd(p_id, 'Actualización', 'Avance: se usa el calculado');
  return jsonb_build_object('id', p_id);
end $$;
revoke all on function public.apih_avance_auto(text) from public, anon;
grant execute on function public.apih_avance_auto(text) to authenticated;

create or replace function public.apih_recordar_avance(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb;
begin
  if not public.apih_gobierna() then raise exception 'APIH: solo quien gobierna envía recordatorios' using errcode = '42501'; end if;
  ir := public.apih_ini(p_id);
  if ir.id is null then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  perform public.apih_bitacora_cmd(p_id, 'Comentario', 'Recordatorio del Reglas PMO: solicitar actualización de avance a ' || coalesce(i ->> 'lider', '—') || '.');
  return jsonb_build_object('id', p_id, 'lider', i ->> 'lider');
end $$;
revoke all on function public.apih_recordar_avance(text) from public, anon;
grant execute on function public.apih_recordar_avance(text) to authenticated;

create or replace function public.apih_accion_recuperacion(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; cr public.registros; c jsonb; aid text := 'ACC-' || substr(md5(random()::text), 1, 4);
begin
  if not public.apih_gobierna() then raise exception 'APIH: solo quien gobierna crea acciones de comité' using errcode = '42501'; end if;
  ir := public.apih_ini(p_id);
  if ir.id is null then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  i := substr(ir.datos, 4)::jsonb;
  select * into cr from public.registros r where r.lista = 'APIH_Comites' and left(substr(r.datos, 4), 1) = '{' and substr(r.datos, 4)::jsonb ->> 'estado' = 'Programado'
    order by substr(r.datos, 4)::jsonb ->> 'fecha' limit 1 for update;
  if not found then raise exception 'APIH: no hay un comité programado' using errcode = '22023'; end if;
  c := substr(cr.datos, 4)::jsonb;
  c := c || jsonb_build_object('acciones', coalesce(case when jsonb_typeof(c -> 'acciones') = 'array' then c -> 'acciones' end, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('id', aid, 'texto', 'Plan de recuperación de cronograma: ' || (i ->> 'titulo'), 'resp', i ->> 'lider',
                                                'limite', (public.apih_hoy() + 7)::text, 'estado', 'Abierta', 'ini', p_id)));
  perform public.apih_escribir('APIH_Comites', cr.id, c);
  perform public.apih_bitacora_cmd(p_id, 'Cambio', 'Acción de recuperación creada por el Reglas PMO');
  return jsonb_build_object('id', aid, 'comite', cr.id);
end $$;
revoke all on function public.apih_accion_recuperacion(text) from public, anon;
grant execute on function public.apih_accion_recuperacion(text) to authenticated;
