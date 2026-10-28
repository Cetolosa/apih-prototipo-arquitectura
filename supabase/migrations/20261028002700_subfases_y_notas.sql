-- =====================================================================================
-- APIH Prototipo · Iter 7 · Subfases y nota de fase por comando del servidor
--   apih_guardar_subfase(p_ini, p_id, p_datos)  crea o edita una subfase (dentro de la ventana de su fase)
--   apih_eliminar_subfase(p_ini, p_id)          la quita; sus hitos quedan sin subfase
--   apih_nota_fase(p_ini, p_fase, p_nota)       nota propia de una fase en un proyecto (vacía = se quita)
--   La SPA envía lo escrito en el formulario; ventanas, topes de largo, duplicados e id los fija el servidor.
-- =====================================================================================
create or replace function public.apih_guardar_subfase(p_ini text, p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; es_prop boolean; fs text[]; subs jsonb; nw boolean := p_id is null or btrim(p_id) = ''; ex jsonb; w jsonb; sf jsonb;
  nom text := btrim(coalesce(p_datos ->> 'nombre', '')); fase text := btrim(coalesce(p_datos ->> 'fase', '')); resp text := btrim(coalesce(p_datos ->> 'resp', ''));
  de text := btrim(coalesce(p_datos ->> 'desc', '')); ini_ text; fin_ text; n int := 0; m text; sid text; nh int := 0; prev text;
begin
  ir := public.apih_puede_ini(p_ini); i := substr(ir.datos, 4)::jsonb; es_prop := ir.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  subs := coalesce(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' end, '[]'::jsonb);
  if nom = '' then perform public.apih_err('escribe el nombre de la subfase', 'nombre'); end if;
  if length(nom) > 120 or length(resp) > 120 then perform public.apih_err('nombre y responsable: hasta 120 caracteres', 'nombre'); end if;
  if length(de) > 500 then perform public.apih_err('la descripción no puede superar 500 caracteres', 'desc'); end if;
  if not fase = any (fs) then perform public.apih_err('elige la fase de la subfase', 'fase'); end if;
  if not nw then
    ex := (select e from jsonb_array_elements(subs) e where e ->> 'id' = p_id limit 1);
    if ex is null then perform public.apih_err('la subfase ' || p_id || ' no existe', 'nombre'); end if;
  end if;
  w := (select e from jsonb_array_elements(public.apih_ventanas(i, p_ini, es_prop)) e where e ->> 'fase' = fase limit 1);
  if w is null or w ->> 'ini' is null or w ->> 'fin' is null then perform public.apih_err('la fase ' || fase || ' no tiene inicio y fin: define las fechas plan del proyecto', 'fase'); end if;
  -- si cambió de fase sin tocar las fechas, hereda las de la nueva fase
  ini_ := nullif(btrim(coalesce(p_datos ->> 'inicio', '')), ''); fin_ := nullif(btrim(coalesce(p_datos ->> 'fin', '')), '');
  if ex is not null and ex ->> 'fase' <> fase and ini_ is not distinct from (ex ->> 'inicio') and fin_ is not distinct from (ex ->> 'fin') then ini_ := null; fin_ := null; end if;
  if ini_ is not null and ini_ !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha de inicio inválida', 'inicio'); end if;
  if fin_ is not null and fin_ !~ '^\d{4}-\d{2}-\d{2}$' then perform public.apih_err('fecha de fin inválida', 'fin'); end if;
  ini_ := coalesce(ini_, w ->> 'ini'); fin_ := coalesce(fin_, w ->> 'fin');
  if fin_ < ini_ then perform public.apih_err('el fin de la subfase no puede ser anterior a su inicio', 'fin'); end if;
  if ini_ < (w ->> 'ini') or fin_ > (w ->> 'fin') then
    perform public.apih_err('la subfase debe quedar dentro de ' || fase || ' (' || to_char((w ->> 'ini')::date, 'DD-MM-YYYY') || ' → ' || to_char((w ->> 'fin')::date, 'DD-MM-YYYY') || ')', 'inicio'); end if;
  if exists (select 1 from jsonb_array_elements(subs) e where e ->> 'id' is distinct from p_id and e ->> 'fase' = fase and public.apih_norm(e ->> 'nombre') = public.apih_norm(nom)) then
    perform public.apih_err('ya existe una subfase «' || nom || '» en ' || fase, 'nombre'); end if;
  sf := jsonb_strip_nulls(jsonb_build_object('nombre', nom, 'fase', fase, 'inicio', ini_, 'fin', fin_, 'resp', resp, 'desc', nullif(de, '')));
  if nw then
    for m in select substring(e ->> 'id' from 'SF(\d+)$') from jsonb_array_elements(subs) e loop if m is not null then n := greatest(n, m::int); end if; end loop;
    sid := p_ini || '-SF' || (n + 1);
    subs := subs || jsonb_build_array(sf || jsonb_build_object('id', sid));
  else
    sid := p_id;
    subs := (select jsonb_agg(case when e ->> 'id' = p_id then (e - 'desc') || sf || jsonb_build_object('id', p_id) else e end) from jsonb_array_elements(subs) e);
    if ex ->> 'fase' <> fase then
      perform set_config('apih.interno', 'on', true);
      update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || jsonb_build_object('fase', fase))::text
       where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_ini and substr(datos, 4)::jsonb ->> 'subfase' = p_id;
      get diagnostics nh = row_count;
      perform set_config('apih.interno', 'off', true);
    end if;
  end if;
  perform public.apih_escribir_cmd(ir.lista, p_ini, i || jsonb_build_object('subfases', subs, 'actualizada', public.apih_hoy()::text));
  perform public.apih_bitacora_cmd(p_ini, 'Cambio', (case when nw then 'Subfase creada: ' else 'Subfase actualizada: ' end) || nom || ' · ' || fase || ' · ' || to_char(ini_::date, 'DD-MM-YYYY') || ' → ' || to_char(fin_::date, 'DD-MM-YYYY'));
  return jsonb_build_object('id', sid);
end $$;
revoke all on function public.apih_guardar_subfase(text, text, jsonb) from public, anon;
grant execute on function public.apih_guardar_subfase(text, text, jsonb) to authenticated;

create or replace function public.apih_eliminar_subfase(p_ini text, p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; subs jsonb; ex jsonb; nh int := 0;
begin
  ir := public.apih_puede_ini(p_ini); i := substr(ir.datos, 4)::jsonb;
  subs := coalesce(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' end, '[]'::jsonb);
  ex := (select e from jsonb_array_elements(subs) e where e ->> 'id' = p_id limit 1);
  if ex is null then raise exception 'APIH: la subfase % no existe', p_id using errcode = 'P0002'; end if;
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || ((substr(datos, 4)::jsonb) - 'subfase')::text
   where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_ini and substr(datos, 4)::jsonb ->> 'subfase' = p_id;
  get diagnostics nh = row_count;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_escribir_cmd(ir.lista, p_ini, i || jsonb_build_object('subfases', coalesce((select jsonb_agg(e) from jsonb_array_elements(subs) e where e ->> 'id' <> p_id), '[]'::jsonb), 'actualizada', public.apih_hoy()::text));
  perform public.apih_bitacora_cmd(p_ini, 'Cambio', 'Subfase eliminada: ' || (ex ->> 'nombre') || ' (' || (ex ->> 'fase') || ')' || case when nh > 0 then ' · ' || nh || ' hitos quedan sin subfase' else '' end);
  return jsonb_build_object('id', p_id, 'hitos', nh);
end $$;
revoke all on function public.apih_eliminar_subfase(text, text) from public, anon;
grant execute on function public.apih_eliminar_subfase(text, text) to authenticated;

create or replace function public.apih_nota_fase(p_ini text, p_fase text, p_nota text) returns jsonb language plpgsql security definer set search_path = public as
$$
declare ir public.registros; i jsonb; nota text := btrim(coalesce(p_nota, '')); fn jsonb;
begin
  ir := public.apih_puede_ini(p_ini); i := substr(ir.datos, 4)::jsonb;
  if not coalesce(p_fase, '') = any (public.apih_fases(ir.lista = 'APIH_Propuestas')) then perform public.apih_err('elige la fase', 'fase'); end if;
  if length(nota) > 500 then perform public.apih_err('la nota no puede superar 500 caracteres', 'nota'); end if;
  fn := coalesce(case when jsonb_typeof(i -> 'faseNota') = 'object' then i -> 'faseNota' end, '{}'::jsonb) - p_fase;
  if nota <> '' then fn := fn || jsonb_build_object(p_fase, nota); end if;
  perform public.apih_escribir_cmd(ir.lista, p_ini, i || jsonb_build_object('faseNota', fn, 'actualizada', public.apih_hoy()::text));
  perform public.apih_bitacora_cmd(p_ini, 'Cambio', 'Nota de fase ' || p_fase || case when nota <> '' then ' actualizada' else ' eliminada' end);
  return jsonb_build_object('id', p_ini);
end $$;
revoke all on function public.apih_nota_fase(text, text, text) from public, anon;
grant execute on function public.apih_nota_fase(text, text, text) to authenticated;
