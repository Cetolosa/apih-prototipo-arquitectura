-- =====================================================================================
-- APIH Prototipo · Iter 3c · Importar iniciativas: un comando del servidor
--   Antes: la SPA depuraba el archivo (lista blanca de campos, tipos, rangos), repartía las fechas de fase, validaba las subfases contra
--   la ventana de su fase, resolvía las referencias de los hitos y escribía todo. Ahora el archivo viaja tal cual y lo hace el servidor
--   en una sola transacción: apih_importar_iniciativas(p_items). La SPA solo lee el archivo y muestra el resultado y los avisos.
-- =====================================================================================

create or replace function public.apih_norm(t text) returns text language sql immutable as
$$ select translate(lower(btrim(coalesce(t, ''))), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou') $$;

-- Depuradores de valores del archivo: devuelven null (se descarta el campo) si el valor no cumple
create or replace function public.apih_imp_txt(v jsonb, mx int) returns jsonb language sql immutable as
$$ select case when jsonb_typeof(v) = 'string' then to_jsonb(left(btrim(v #>> '{}'), mx)) end $$;
create or replace function public.apih_imp_enm(v jsonb) returns jsonb language sql immutable as
$$ select case when jsonb_typeof(v) = 'string' and btrim(v #>> '{}') ~ '^[^<>"''`=\\]{1,80}$' then to_jsonb(btrim(v #>> '{}')) end $$;
create or replace function public.apih_imp_num(v jsonb, lo numeric, hi numeric) returns jsonb language plpgsql immutable as
$$ declare n numeric;
begin
  if jsonb_typeof(v) = 'number' then n := (v #>> '{}')::numeric;
  elsif jsonb_typeof(v) = 'string' and btrim(v #>> '{}') ~ '^-?\d+(\.\d+)?$' then n := btrim(v #>> '{}')::numeric;
  else return null; end if;
  return case when n >= lo and n <= hi then to_jsonb(n) end;
end $$;
create or replace function public.apih_imp_fec(v jsonb) returns jsonb language plpgsql immutable as
$$ begin
  if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$' and (v #>> '{}')::date between date '1900-01-01' and date '2100-12-31' and to_char((v #>> '{}')::date, 'YYYY-MM-DD') = (v #>> '{}') then return v; end if;
  return null;
exception when others then return null;
end $$;

create or replace function public.apih_importar_iniciativas(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as
$$
declare
  hoy date := public.apih_hoy(); cfg jsonb := public.apih_cfg(); x jsonb; n jsonb; san jsonb; pr boolean; lst text; pre text; nid text; fs text[]; fall text[];
  cats jsonb := coalesce(case when jsonb_typeof(cfg -> 'hitoCats') = 'array' and jsonb_array_length(cfg -> 'hitoCats') > 0 then cfg -> 'hitoCats' end,
                         '["Entregable","Gobierno","Técnico","Proveedor","Pago","Comunicación","Otro"]'::jsonb);
  creadas jsonb := '[]'::jsonb; omitidas jsonb := '[]'::jsonb; avisos jsonb := '[]'::jsonb; nh int := 0; nr int := 0; ns int := 0; nini int := 0;
  h jsonb; hq jsonb; k int; hid text; hf text; ok boolean; hids text[]; r jsonb; rq jsonb; sf jsonb; s jsonb; subs jsonb; w jsonb; v jsonb; fase_sf text; ini_sf text; fin_sf text; ya int; mxn int; m text;
  fnota jsonb; fx text; ref text; hh jsonb; sfx jsonb; cur jsonb; av text; s_nh int; s_nr int; s_ns int; s_nini int; s_av int;
begin
  if not exists (select 1 from public.perfiles where email = public.apih_email_real() and rol = 'admin' and activo) or public.apih_impersonando() then
    raise exception 'APIH: solo el rol Administra puede importar iniciativas' using errcode = '42501'; end if;
  if public.apih_congelado() then raise exception 'APIH: la organización está en modo solo lectura' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'APIH: el archivo no trae iniciativas' using errcode = '22023'; end if;
  fall := public.apih_fases(false) || public.apih_fases(true);
  perform set_config('apih.interno', 'on', true);

  for x in select * from jsonb_array_elements(p_items) loop
   s_nh := nh; s_nr := nr; s_ns := ns; s_nini := nini; s_av := jsonb_array_length(avisos);
   begin
    if jsonb_typeof(x) is distinct from 'object' or btrim(coalesce(x ->> 'titulo', '')) = '' then omitidas := omitidas || to_jsonb('(sin título)'::text); continue; end if;
    if exists (select 1 from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and left(substr(datos, 4), 1) = '{'
                 and public.apih_norm(substr(datos, 4)::jsonb ->> 'titulo') = public.apih_norm(x ->> 'titulo')) then
      omitidas := omitidas || to_jsonb(btrim(x ->> 'titulo')); continue; end if;
    pr := x ->> 'tipo' = 'Propuesta'; lst := case when pr then 'APIH_Propuestas' else 'APIH_Proyectos' end; pre := case when pr then 'PROP' else 'PRJ' end;
    fs := public.apih_fases(pr);
    -- campos permitidos y depurados
    san := jsonb_strip_nulls(jsonb_build_object(
      'titulo', public.apih_imp_txt(x -> 'titulo', 200),
      'desc', public.apih_imp_txt(x -> 'desc', 500), 'logros', public.apih_imp_txt(x -> 'logros', 500), 'proximos', public.apih_imp_txt(x -> 'proximos', 500),
      'bc', public.apih_imp_txt(x -> 'bc', 500), 'resumen', public.apih_imp_txt(x -> 'resumen', 500), 'issue', public.apih_imp_txt(x -> 'issue', 500), 'riesgoTxt', public.apih_imp_txt(x -> 'riesgoTxt', 500),
      'lider', public.apih_imp_enm(x -> 'lider'), 'sponsor', public.apih_imp_enm(x -> 'sponsor'), 'negocio', public.apih_imp_enm(x -> 'negocio'), 'proveedor', public.apih_imp_enm(x -> 'proveedor'),
      'area', public.apih_imp_enm(x -> 'area'), 'categoria', public.apih_imp_enm(x -> 'categoria'), 'prioridad', public.apih_imp_enm(x -> 'prioridad'), 'moneda', public.apih_imp_enm(x -> 'moneda'), 'rag', public.apih_imp_enm(x -> 'rag'),
      'fase', case when (x ->> 'fase') = any (fs) then x -> 'fase' end,
      'avance', public.apih_imp_num(x -> 'avance', 0, 100), 'presupuesto', public.apih_imp_num(x -> 'presupuesto', 0, 1e12), 'gastado', public.apih_imp_num(x -> 'gastado', 0, 1e12), 'beneficio', public.apih_imp_num(x -> 'beneficio', 0, 1e12),
      'inicioPlan', public.apih_imp_fec(x -> 'inicioPlan'), 'finPlan', public.apih_imp_fec(x -> 'finPlan'), 'finEst', public.apih_imp_fec(x -> 'finEst'), 'creada', public.apih_imp_fec(x -> 'creada'),
      'faseDesde', public.apih_imp_fec(x -> 'faseDesde'), 'inicioReal', public.apih_imp_fec(x -> 'inicioReal'), 'finReal', public.apih_imp_fec(x -> 'finReal'),
      'deps', case when jsonb_typeof(x -> 'deps') = 'array' then (select coalesce(jsonb_agg(d), '[]'::jsonb) from jsonb_array_elements(x -> 'deps') d where jsonb_typeof(d) = 'string' and (d #>> '{}') ~ '^[A-Za-z0-9_-]{1,20}$') end,
      'tags', case when jsonb_typeof(x -> 'tags') = 'array' then (select coalesce(jsonb_agg(to_jsonb(left(btrim(t #>> '{}'), 40))), '[]'::jsonb) from jsonb_array_elements(x -> 'tags') t where jsonb_typeof(t) = 'string' and btrim(t #>> '{}') <> '') end));
    nid := public.apih_siguiente(pre, lst);
    n := jsonb_build_object('tipo', case when pr then 'Propuesta' else 'Proyecto' end, 'legacy', '', 'creada', hoy::text, 'faseDesde', hoy::text, 'origen', 'importación', 'est', '[]'::jsonb,
           'hist', jsonb_build_array(jsonb_build_array(hoy::text, coalesce((san ->> 'avance')::numeric, 0))), 'tags', '[]'::jsonb, 'rec', null, 'folio', '', 'oc', '', 'ahorroReal', 0, 'inicioReal', null,
           'estado', case when pr then 'Vigente' else 'En curso' end, 'propuestaOrigen', null, 'estadoMotivo', '', 'estadoRev', null, 'rag', 'Verde', 'avance', 0, 'gastado', 0, 'proyecto', null, 'deps', '[]'::jsonb,
           'area', 'BISE', 'fase', fs[1], 'prioridad', 'Media', 'presupuesto', 0, 'logros', '', 'proximos', '', 'sponsor', '', 'lider', '', 'desc', '')
         || san || jsonb_build_object('id', nid, 'actualizada', hoy::text);
    if not pr and not (san ? 'fase') then n := n || jsonb_build_object('fase', 'Planificación'); end if;
    n := n || jsonb_build_object('finEst', coalesce(n -> 'finEst', n -> 'finPlan'));
    insert into public.registros(lista, id, datos) values (lst, nid, 'p1.' || n::text);
    nini := nini + 1;

    -- hitos
    hids := '{}'; k := 0;
    if jsonb_typeof(x -> 'hitos') = 'array' then
      for h in select * from jsonb_array_elements(x -> 'hitos') loop
        k := k + 1; hids[k] := '';
        continue when jsonb_typeof(h) is distinct from 'object' or jsonb_typeof(h -> 'nombre') is distinct from 'string' or btrim(h ->> 'nombre') = '';
        hf := coalesce(public.apih_imp_fec(h -> 'fecha') #>> '{}', ((case when n ->> 'inicioPlan' ~ '^\d{4}-\d{2}-\d{2}$' then (n ->> 'inicioPlan')::date else hoy end) + coalesce((public.apih_imp_num(h -> 'dias', -3650, 3650) #>> '{}')::numeric::int, 0))::text);
        ok := coalesce(h ->> 'completado' = 'true', false);
        hid := public.apih_siguiente('HIT', 'APIH_Hitos');
        hq := jsonb_strip_nulls(jsonb_build_object('id', hid, 'ini', nid, 'nombre', left(btrim(h ->> 'nombre'), 200),
               'fase', case when (h ->> 'fase') = any (fall) then h ->> 'fase' else n ->> 'fase' end, 'fecha', hf, 'completado', ok,
               'fechaReal', case when ok then coalesce(public.apih_imp_fec(h -> 'fechaReal') #>> '{}', hf) end,
               'resp', coalesce(nullif(public.apih_imp_enm(h -> 'resp') #>> '{}', ''), nullif(n ->> 'lider', ''), ''),
               'cat', case when cats ? coalesce(public.apih_imp_enm(h -> 'cat') #>> '{}', '') then public.apih_imp_enm(h -> 'cat') end,
               'desc', case when btrim(coalesce(h ->> 'desc', '')) <> '' then public.apih_imp_txt(h -> 'desc', 500) end));
        if not ok then hq := hq || jsonb_build_object('fechaReal', null); end if;
        insert into public.registros(lista, id, datos) values ('APIH_Hitos', hid, 'p1.' || hq::text);
        hids[k] := hid; nh := nh + 1;
      end loop;
    end if;

    select substr(datos, 4)::jsonb into n from public.registros where lista = lst and id = nid;   -- con lo que derivaron los disparadores (fechas de fase, avance)

    -- notas por fase
    if jsonb_typeof(x -> 'faseNota') = 'object' then
      fnota := '{}'::jsonb;
      foreach fx in array fs loop
        if jsonb_typeof(x -> 'faseNota' -> fx) = 'string' and btrim(x -> 'faseNota' ->> fx) <> '' then fnota := fnota || jsonb_build_object(fx, left(btrim(x -> 'faseNota' ->> fx), 500)); end if;
      end loop;
      if fnota <> '{}'::jsonb then n := n || jsonb_build_object('faseNota', fnota); end if;
    end if;

    -- subfases: dentro de UNA fase del proyecto; inicio/fin vacíos heredan los de la fase
    subs := '[]'::jsonb;
    if jsonb_typeof(x -> 'subfases') = 'array' then
      select substr(datos, 4)::jsonb into cur from public.registros where lista = lst and id = nid;
      v := public.apih_ventanas(cur, nid, pr);
      for s in select * from jsonb_array_elements(x -> 'subfases') loop
        continue when jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(s -> 'nombre') is distinct from 'string';
        m := left(btrim(s ->> 'nombre'), 120);
        if m = '' or length(s ->> 'nombre') > 120 + 400 then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase sin nombre válido (texto de hasta 120 caracteres; se omite)'); continue; end if;
        fase_sf := s ->> 'fase';
        if fase_sf is null or not (fase_sf = any (fs)) then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: fase inválida para ' || case when pr then 'propuesta' else 'proyecto' end); continue; end if;
        w := (select e from jsonb_array_elements(v) e where e ->> 'fase' = fase_sf limit 1);
        if w is null or w ->> 'ini' is null or w ->> 'fin' is null then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: la fase ' || fase_sf || ' no tiene fechas'); continue; end if;
        ini_sf := coalesce(public.apih_imp_fec(s -> 'inicio') #>> '{}', w ->> 'ini'); fin_sf := coalesce(public.apih_imp_fec(s -> 'fin') #>> '{}', w ->> 'fin');
        if fin_sf < ini_sf then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: fechas inválidas'); continue; end if;
        if ini_sf < (w ->> 'ini') or fin_sf > (w ->> 'fin') then
          avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: debe quedar dentro de ' || fase_sf || ' (' || to_char((w ->> 'ini')::date, 'DD-MM-YYYY') || ' → ' || to_char((w ->> 'fin')::date, 'DD-MM-YYYY') || ')'); continue; end if;
        ya := (select o - 1 from jsonb_array_elements(subs) with ordinality t(e, o)
                where (coalesce(public.apih_imp_enm(s -> 'id') #>> '{}', '') <> '' and e ->> 'id' = s ->> 'id') or (e ->> 'fase' = fase_sf and public.apih_norm(e ->> 'nombre') = public.apih_norm(m)) limit 1);
        sfx := jsonb_strip_nulls(jsonb_build_object('nombre', m, 'fase', fase_sf, 'inicio', ini_sf, 'fin', fin_sf, 'resp', coalesce(public.apih_imp_enm(s -> 'resp') #>> '{}', ''),
                 'desc', case when btrim(coalesce(s ->> 'desc', '')) <> '' then public.apih_imp_txt(s -> 'desc', 500) end));
        if ya is not null then subs := jsonb_set(subs, array[ya::text], (subs -> ya) || sfx);
        else
          if jsonb_array_length(subs) >= 60 then avisos := avisos || to_jsonb((n ->> 'titulo') || ': Subfase «' || m || '»: máximo 60 por iniciativa'); continue; end if;
          select coalesce(max(substring(e ->> 'id' from 'SF(\d+)$')::int), 0) into mxn from jsonb_array_elements(subs) e;
          subs := subs || jsonb_build_array(sfx || jsonb_build_object('id', nid || '-SF' || (mxn + 1)));
        end if;
      end loop;
      if jsonb_array_length(subs) > 0 then n := n || jsonb_build_object('subfases', subs); ns := ns + jsonb_array_length(subs); end if;
    end if;
    update public.registros set datos = 'p1.' || n::text where lista = lst and id = nid;

    -- referencia de subfase en cada hito: id o nombre (si hay nombres repetidos en distintas fases, se usa la fase del hito)
    k := 0;
    if jsonb_typeof(x -> 'hitos') = 'array' then
      for h in select * from jsonb_array_elements(x -> 'hitos') loop
        k := k + 1;
        continue when hids[k] is null or hids[k] = '' or jsonb_typeof(h) is distinct from 'object' or jsonb_typeof(h -> 'subfase') is distinct from 'string' or btrim(h ->> 'subfase') = '';
        ref := btrim(h ->> 'subfase'); select substr(datos, 4)::jsonb into hh from public.registros where lista = 'APIH_Hitos' and id = hids[k];
        sf := coalesce((select e from jsonb_array_elements(subs) e where e ->> 'id' = ref limit 1),
                       (select e from jsonb_array_elements(subs) e where public.apih_norm(e ->> 'nombre') = public.apih_norm(ref) and e ->> 'fase' = hh ->> 'fase' limit 1),
                       (select e from jsonb_array_elements(subs) e where public.apih_norm(e ->> 'nombre') = public.apih_norm(ref) limit 1));
        if sf is null then avisos := avisos || to_jsonb((n ->> 'titulo') || ': el hito «' || (hh ->> 'nombre') || '» apunta a una subfase que no existe (' || ref || ')'); continue; end if;
        if sf ->> 'fase' <> hh ->> 'fase' then avisos := avisos || to_jsonb((n ->> 'titulo') || ': el hito «' || (hh ->> 'nombre') || '» es de ' || (hh ->> 'fase') || ' y la subfase «' || (sf ->> 'nombre') || '» de ' || (sf ->> 'fase') || ' (sin subfase)'); continue; end if;
        update public.registros set datos = 'p1.' || (hh || jsonb_build_object('subfase', sf ->> 'id'))::text where lista = 'APIH_Hitos' and id = hids[k];
      end loop;
    end if;

    -- riesgos
    if jsonb_typeof(x -> 'riesgos') = 'array' then
      for r in select * from jsonb_array_elements(x -> 'riesgos') loop
        continue when jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r -> 'desc') is distinct from 'string' or btrim(coalesce(r ->> 'desc', '')) = '';
        rq := jsonb_strip_nulls(jsonb_build_object('desc', public.apih_imp_txt(r -> 'desc', 500), 'cat', public.apih_imp_enm(r -> 'cat'), 'dueno', public.apih_imp_enm(r -> 'dueno'), 'mit', public.apih_imp_txt(r -> 'mit', 500),
                'estado', public.apih_imp_enm(r -> 'estado'), 'prob', public.apih_imp_num(r -> 'prob', 1, 5), 'imp', public.apih_imp_num(r -> 'imp', 1, 5), 'fIdent', public.apih_imp_fec(r -> 'fIdent'), 'fRev', public.apih_imp_fec(r -> 'fRev')));
        hid := public.apih_siguiente('RSK', 'APIH_Riesgos');
        insert into public.registros(lista, id, datos) values ('APIH_Riesgos', hid, 'p1.' || (jsonb_build_object('id', hid, 'ini', nid, 'cat', 'Técnico', 'prob', 3, 'imp', 3, 'estado', 'Abierto', 'dueno', coalesce(n ->> 'lider', ''),
          'fIdent', hoy::text, 'fRev', (hoy + 30)::text, 'mit', '') || rq)::text);
        nr := nr + 1;
      end loop;
    end if;

    perform public.apih_bitacora(nid, 'Cambio', (case when pr then 'Propuesta importada: ' else 'Proyecto importado: ' end) || (n ->> 'titulo')
      || case when jsonb_typeof(x -> 'hitos') = 'array' then ' (' || jsonb_array_length(x -> 'hitos') || ' hitos' || case when jsonb_typeof(x -> 'riesgos') = 'array' then ', ' || jsonb_array_length(x -> 'riesgos') || ' riesgos' else '' end || ')' else '' end);
    creadas := creadas || jsonb_build_array(jsonb_build_object('id', nid, 'titulo', n ->> 'titulo'));
   exception when others then
    -- una iniciativa inválida no frena al resto: se deshace solo ella y queda el motivo
    nh := s_nh; nr := s_nr; ns := s_ns; nini := s_nini;
    avisos := (select coalesce(jsonb_agg(e), '[]'::jsonb) from (select e from jsonb_array_elements(avisos) with ordinality t(e, o) where o <= s_av order by o) q)
              || to_jsonb(coalesce(btrim(x ->> 'titulo'), '(sin título)') || ': no se importó — ' || regexp_replace(sqlerrm, '^APIH: ', ''));
   end;
  end loop;
  for av in select jsonb_array_elements_text(avisos) loop perform public.apih_bitacora(null, 'Cambio', 'Importación: ' || av); end loop;
  perform set_config('apih.interno', 'off', true);
  return jsonb_build_object('creadas', creadas, 'omitidas', omitidas, 'avisos', avisos, 'hitos', nh, 'riesgos', nr, 'subfases', ns);
end $$;
revoke all on function public.apih_importar_iniciativas(jsonb) from public, anon;
grant execute on function public.apih_importar_iniciativas(jsonb) to authenticated;
revoke all on function public.apih_norm(text), public.apih_imp_txt(jsonb, int), public.apih_imp_enm(jsonb), public.apih_imp_num(jsonb, numeric, numeric), public.apih_imp_fec(jsonb) from public, anon;
