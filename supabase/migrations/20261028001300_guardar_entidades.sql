-- =====================================================================================
-- APIH Prototipo · Iter 5b · Formularios por comando: hitos, riesgos y decisiones
--   Cada formulario es una operación con nombre del servidor (lo que pidió Arquitectura: la SPA no usa la escritura genérica
--   para estas entidades). El servidor autoriza (área de la iniciativa), valida con el campo afectado (hint), asigna el id,
--   completa los valores por defecto, aplica los efectos (comité, avance) y deja la bitácora. La SPA solo envía lo que la persona
--   escribió y muestra el resultado.
--     apih_guardar_hito(p_id, p_datos)      → {id, avisos}
--     apih_guardar_riesgo(p_id, p_datos)    → {id, critico}
--     apih_guardar_decision(p_id, p_datos)  → {id}
--     apih_eliminar(p_lista, p_id)          → {id}   (hitos, riesgos y decisiones)
--   p_id nulo = alta. Los campos que gobiernan otros comandos no se tocan aquí (completar hito → apih_hito_estado; resolver una
--   decisión → apih_resolver_decision).
-- =====================================================================================

-- ---------- Umbrales: una sola definición (valores por defecto + ajuste del líder) ----------
-- Antes: las compuertas usaban el umbral de la organización con un 15 fijo y los cálculos el de la iniciativa sin valor por defecto.
create or replace function public.apih_cfg_def(k text) returns numeric language sql immutable as
$$ select case k when 'umbralCritico' then 15 when 'tolDesv' then 7 when 'diasSinUpdate' then 14 when 'decMaxDias' then 30 when 'descMax' then 500 end::numeric $$;
-- Valor de la organización: el configurado o, si no hay, el valor por defecto (apih_num devuelve 0 cuando falta la clave)
create or replace function public.apih_cfg_num(k text) returns numeric language sql stable security definer set search_path = public as
$$ select case when jsonb_typeof(public.apih_cfg() -> k) = 'number' or (public.apih_cfg() ->> k) ~ '^-?\d+(\.\d+)?$' then public.apih_num(public.apih_cfg(), k) else public.apih_cfg_def(k) end $$;

create or replace function public.apih_umbral(ini jsonb, k text) returns numeric language plpgsql stable security definer set search_path = public as
$$ declare cfg jsonb := public.apih_cfg(); v jsonb; org numeric := public.apih_cfg_num(k);
begin
  if coalesce(cfg #>> array['fijos', k], '') not in ('', '0', 'false') then return org; end if;
  if coalesce(ini ->> 'lider', '') = '' then return org; end if;
  select substr(r.datos, 4)::jsonb #> array['v', 'cfg', k] into v
    from public.perfiles p join public.registros r on r.lista = 'APIH_Config' and r.id = 'cfgU:' || p.email
   where lower(btrim(p.nombre)) = lower(btrim(ini ->> 'lider')) and left(substr(r.datos, 4), 1) = '{' limit 1;
  return case when v is not null and jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric else org end;
end $$;

create or replace function public.apih_compuertas(p_id text, p_hasta text) returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare
  r public.registros; j jsonb; es_prop boolean; fs text[]; a int; b int; hoy date := (now() at time zone 'America/Santiago')::date; hasta text := case when p_hasta = 'Completado' then 'Cierre' else p_hasta end;
  hs jsonb; rs jsonb; g jsonb := '[]'::jsonb; umbral numeric; n_hit int; pend int; k int;
  sinmit boolean; av int; todos boolean;
begin
  select * into r from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_id and left(substr(datos, 4), 1) = '{';
  if not found then raise exception 'APIH: la iniciativa % no existe', p_id using errcode = 'P0002'; end if;
  j := substr(r.datos, 4)::jsonb; umbral := public.apih_umbral(j, 'umbralCritico'); es_prop := r.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into hs from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  select coalesce(jsonb_agg(substr(datos, 4)::jsonb), '[]'::jsonb) into rs from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_id;
  n_hit := jsonb_array_length(hs);
  sinmit := exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral and coalesce(x ->> 'mit', '') !~ '\S');
  a := array_position(fs, j ->> 'fase'); b := array_position(fs, hasta);

  if hasta = 'Evaluación' then
    g := g || public.apih_g('Problema/objetivo descrito'::text, coalesce(nullif(j ->> 'problema', ''), nullif(j ->> 'desc', '')) is null);
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
  end if;
  if hasta = 'Caso de Negocio' then
    g := g || public.apih_g('Sponsor identificado'::text, coalesce(j ->> 'sponsor', '') = '');
    g := g || public.apih_g('Evaluación de valor/esfuerzo completada'::text, not coalesce(jsonb_typeof(j -> 'score') = 'object' or (jsonb_typeof(j -> 'score') = 'number' and (j ->> 'score')::numeric <> 0), false));
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Aprobación' then
    g := g || public.apih_g('Presupuesto estimado'::text, not coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false));
    g := g || public.apih_g('Beneficio esperado'::text, not (coalesce(jsonb_typeof(j -> 'beneficio') = 'number' and (j ->> 'beneficio')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Business case redactado'::text, coalesce(j ->> 'bc', '') = '');
  end if;
  if hasta = 'Ejecución' then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Presupuesto asignado'::text, not (coalesce(jsonb_typeof(j -> 'presupuesto') = 'number' and (j ->> 'presupuesto')::numeric > 0, false) or j ->> 'categoria' = 'Transversal'));
    g := g || public.apih_g('Al menos 2 hitos planificados'::text, n_hit < 2);
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if hasta = 'Transición' then
    todos := b is null or not exists (select 1 from jsonb_array_elements(hs) x where coalesce(array_position(fs, x ->> 'fase'), 0) < b and coalesce(x ->> 'completado', 'false') <> 'true');
    g := g || public.apih_g('Hitos de las fases anteriores completados'::text, not todos);
    g := g || public.apih_g('Sin hitos vencidos'::text, exists (select 1 from jsonb_array_elements(hs) x where coalesce(x ->> 'completado', 'false') <> 'true' and (x ->> 'fecha') < hoy::text));
    g := g || public.apih_g('Riesgos críticos con plan de mitigación'::text, sinmit);
  end if;
  if hasta not in ('Evaluación', 'Caso de Negocio', 'Aprobación', 'Ejecución', 'Transición', 'Cierre') and not es_prop and b is not null and b > 1 then
    g := g || public.apih_g('Fechas plan definidas'::text, coalesce(j ->> 'inicioPlan', '') = '' or coalesce(j ->> 'finPlan', '') = '');
    g := g || public.apih_g('Líder asignado'::text, coalesce(j ->> 'lider', '') = '');
  end if;
  if b is not null and a is not null and b > a and hasta <> 'Transición' then
    select count(*) filter (where coalesce(x ->> 'completado', 'false') <> 'true'), count(*) into pend, k from jsonb_array_elements(hs) x where x ->> 'fase' = j ->> 'fase';
    if k > 0 then g := g || public.apih_g(case when pend > 0 then 'Hitos de la fase ' || (j ->> 'fase') || ' completados (faltan ' || pend || ')' else 'Hitos de la fase ' || (j ->> 'fase') || ' completados' end, pend > 0); end if;
  end if;
  if hasta = 'Cierre' then
    av := public.apih_avance_calc(j, p_id);
    g := g || public.apih_g('Avance al 100%'::text, av < 100);
    g := g || public.apih_g('Todos los hitos completados'::text, exists (select 1 from jsonb_array_elements(hs) x where (x ->> 'fase') is distinct from 'Cierre' and coalesce(x ->> 'completado', 'false') <> 'true'));
    g := g || public.apih_g('Sin riesgos críticos abiertos'::text, exists (select 1 from jsonb_array_elements(rs) x where coalesce(x ->> 'estado', '') <> 'Cerrado' and (x ->> 'prob')::numeric * (x ->> 'imp')::numeric >= umbral));
  end if;
  return g;
end $$;

-- Iniciativa por id (proyecto o propuesta)
create or replace function public.apih_ini(p_ini text) returns public.registros language sql stable security definer set search_path = public as
$$ select * from public.registros where lista in ('APIH_Proyectos', 'APIH_Propuestas') and id = p_ini limit 1 $$;

-- Id siguiente de una lista (PREFIJO-NNN), sin repetir los ya usados ni los reservados en APIH_Config/seq
create or replace function public.apih_nuevo_id(p_lista text, p_pre text) returns text language plpgsql security definer set search_path = public as
$$ declare n int; s int;
begin
  perform pg_advisory_xact_lock(hashtext('apih_id:' || p_lista));
  select coalesce(max(nullif(regexp_replace(split_part(id, '-', 2), '\D', '', 'g'), '')::int), 0) into n
    from public.registros where lista = p_lista and id like p_pre || '-%';
  select coalesce((substr(datos, 4)::jsonb ->> p_pre)::int, 0) into s from public.registros where lista = 'APIH_Config' and id = 'seq' and left(substr(datos, 4), 1) = '{';
  return p_pre || '-' || lpad((greatest(n, coalesce(s, 0)) + 1)::text, 3, '0');
end $$;

-- Error de validación con el campo afectado (la SPA lo marca en el formulario)
create or replace function public.apih_err(p_msg text, p_campo text) returns void language plpgsql immutable as
$$ begin raise exception 'APIH: %', p_msg using errcode = '22023', hint = coalesce(p_campo, ''); end $$;

-- Escritura de una fila por un comando: pasa por los mismos disparadores (validación, catálogo de campos, auditoría)
create or replace function public.apih_escribir(p_lista text, p_id text, j jsonb) returns void language plpgsql security definer set search_path = public as
$$ begin
  insert into public.registros(lista, id, datos) values (p_lista, p_id, 'p1.' || (j || jsonb_build_object('id', p_id))::text)
  on conflict (lista, id) do update set datos = excluded.datos;
end $$;

-- Igual que apih_escribir, para comandos que cambian una iniciativa que ya existe con campos que gobierna el servidor
-- (avance, RAG, actualización semanal): el disparador los trata como internos; se restituye el valor previo de la marca.
create or replace function public.apih_escribir_cmd(p_lista text, p_id text, j jsonb) returns void language plpgsql security definer set search_path = public as
$$ declare prev text := coalesce(current_setting('apih.interno', true), 'off');
begin
  perform set_config('apih.interno', 'on', true);
  perform public.apih_escribir(p_lista, p_id, j);
  perform set_config('apih.interno', prev, true);
end $$;

create or replace function public.apih_bitacora_cmd(p_ini text, p_tipo text, p_texto text, p_meta text default null) returns void language plpgsql security definer set search_path = public as
$$ begin
  perform set_config('apih.interno', 'on', true);
  perform public.apih_bitacora(p_ini, p_tipo, p_texto, p_meta);
  perform set_config('apih.interno', 'off', true);
end $$;

-- Datos que trae el formulario: solo claves de texto; se quitan las que no gobierna el comando
create or replace function public.apih_limpiar(j jsonb, quitar text[]) returns jsonb language sql immutable as
$$ select coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(j, '{}'::jsonb)) e(k, v) where not k = any(quitar)), '{}'::jsonb) $$;

create or replace function public.apih_txt(j jsonb, k text) returns text language sql immutable as $$ select nullif(btrim(coalesce(j ->> k, '')), '') $$;

-- Permiso de escritura sobre la iniciativa de un registro (y la anterior, si se mueve de iniciativa)
create or replace function public.apih_puede_ini(p_ini text, p_campo text default 'ini') returns public.registros language plpgsql stable security definer set search_path = public as
$$ declare ir public.registros;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if public.apih_txt(jsonb_build_object('x', p_ini), 'x') is null then perform public.apih_err('elige la iniciativa', p_campo); end if;
  ir := public.apih_ini(p_ini);
  if ir.id is null then perform public.apih_err('la iniciativa ' || p_ini || ' no existe', p_campo); end if;
  if not public.apih_edita_area(ir.area) then raise exception 'APIH: sin permiso sobre el área de la iniciativa' using errcode = '42501', hint = p_campo; end if;
  return ir;
end $$;

-- ---------- Hito ----------
create or replace function public.apih_guardar_hito(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; h0 jsonb := '{}'::jsonb;
  d jsonb := public.apih_limpiar(p_datos, array['id', 'fechaReal']); h jsonb; ir public.registros; i jsonb; sx jsonb; id_ text;
  comp0 boolean := false; comp1 boolean; avisos jsonb := '[]'::jsonb; dmax int := public.apih_cfg_num('descMax')::int;
begin
  if not nw then
    select * into r from public.registros where lista = 'APIH_Hitos' and id = p_id for update;
    if not found then raise exception 'APIH: el hito % no existe', p_id using errcode = 'P0002'; end if;
    h0 := substr(r.datos, 4)::jsonb; comp0 := coalesce((h0 ->> 'completado')::boolean, false);
    perform public.apih_puede_ini(h0 ->> 'ini');
  end if;
  h := h0 || d;
  ir := public.apih_puede_ini(h ->> 'ini'); i := substr(ir.datos, 4)::jsonb;
  if public.apih_txt(h, 'nombre') is null then perform public.apih_err('el hito necesita nombre', 'nombre'); end if;
  if public.apih_txt(h, 'fecha') is null then perform public.apih_err('indica la fecha del hito', 'fecha'); end if;
  -- peso opcional 0..100
  if coalesce(h ->> 'peso', '') = '' then h := h - 'peso';
  elsif jsonb_typeof(h -> 'peso') <> 'number' and (h ->> 'peso') !~ '^\d+(\.\d+)?$' then perform public.apih_err('el peso debe ser un número', 'peso');
  else h := jsonb_set(h, '{peso}', to_jsonb((h ->> 'peso')::numeric));
    if (h ->> 'peso')::numeric < 0 or (h ->> 'peso')::numeric > 100 then perform public.apih_err('el peso va de 0 a 100', 'peso'); end if;
  end if;
  -- subfase: debe ser de la iniciativa y fija la fase
  if public.apih_txt(h, 'subfase') is null then h := h - 'subfase';
  else
    select x into sx from jsonb_array_elements(case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' else '[]'::jsonb end) x where x ->> 'id' = h ->> 'subfase' limit 1;
    if sx is null then perform public.apih_err('la subfase elegida no es de esta iniciativa', 'subfase'); end if;
    if public.apih_txt(h, 'fase') is null then h := h || jsonb_build_object('fase', sx ->> 'fase'); end if;
    if h ->> 'fase' <> sx ->> 'fase' then perform public.apih_err('la subfase «' || (sx ->> 'nombre') || '» es de ' || (sx ->> 'fase') || ': el hito debe estar en esa fase', 'fase'); end if;
    if public.apih_txt(h, 'fecha') is not null and public.apih_txt(sx, 'inicio') is not null and public.apih_txt(sx, 'fin') is not null
       and ((h ->> 'fecha')::date < (sx ->> 'inicio')::date or (h ->> 'fecha')::date > (sx ->> 'fin')::date) then
      avisos := avisos || to_jsonb('la fecha del hito queda fuera de la subfase «' || (sx ->> 'nombre') || '» (' || to_char((sx ->> 'inicio')::date, 'DD-MM-YYYY') || ' a ' || to_char((sx ->> 'fin')::date, 'DD-MM-YYYY') || ')');
    end if;
  end if;
  if public.apih_txt(h, 'desc') is null then h := h - 'desc';
  elsif length(btrim(h ->> 'desc')) > dmax then perform public.apih_err('la descripción no puede superar ' || dmax || ' caracteres', 'desc');
  else h := jsonb_set(h, '{desc}', to_jsonb(btrim(h ->> 'desc'))); end if;
  -- completar o reabrir lo hace apih_hito_estado (avance y cierre automático); en un alta completado fija la fecha real
  comp1 := coalesce((h ->> 'completado')::boolean, false);
  if nw then
    h := h || jsonb_build_object('completado', comp1, 'fechaReal', case when comp1 then hoy::text else null end);
    id_ := public.apih_nuevo_id('APIH_Hitos', 'HIT');
  else
    id_ := p_id; h := h || jsonb_build_object('completado', comp0, 'fechaReal', h0 -> 'fechaReal');
  end if;
  perform public.apih_escribir('APIH_Hitos', id_, h);
  perform set_config('apih.interno', 'on', true);
  update public.registros set datos = 'p1.' || (substr(datos, 4)::jsonb || jsonb_build_object('actualizada', hoy::text))::text where lista = ir.lista and id = ir.id;
  perform set_config('apih.interno', 'off', true);
  perform public.apih_bitacora_cmd(h ->> 'ini', 'Cambio', case when nw then 'Hito creado: ' || (h ->> 'nombre') || ' (' || to_char((h ->> 'fecha')::date, 'DD-MM-YYYY') || ')' else 'Hito actualizado: ' || (h ->> 'nombre') end);
  if not nw and comp1 <> comp0 then perform public.apih_hito_estado(id_, comp1); end if;
  return jsonb_build_object('id', id_, 'avisos', avisos);
end $$;

-- ---------- Riesgo ----------
create or replace function public.apih_guardar_riesgo(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; x0 jsonb := '{}'::jsonb; x jsonb; ir public.registros; id_ text;
  e0 numeric := 0; e1 numeric; umb numeric; crit boolean;
begin
  if not nw then
    select * into r from public.registros where lista = 'APIH_Riesgos' and id = p_id for update;
    if not found then raise exception 'APIH: el riesgo % no existe', p_id using errcode = 'P0002'; end if;
    x0 := substr(r.datos, 4)::jsonb; perform public.apih_puede_ini(x0 ->> 'ini');
    e0 := coalesce((x0 ->> 'prob')::numeric, 0) * coalesce((x0 ->> 'imp')::numeric, 0);
  end if;
  x := x0 || public.apih_limpiar(p_datos, array['id']);
  if nw then x := jsonb_build_object('cat', 'Técnico', 'prob', 3, 'imp', 3, 'estado', 'Abierto', 'fIdent', public.apih_hoy()::text, 'mit', '') || x; end if;
  ir := public.apih_puede_ini(x ->> 'ini');
  if public.apih_txt(x, 'desc') is null then perform public.apih_err('describe el riesgo', 'desc'); end if;
  foreach id_ in array array['prob', 'imp'] loop
    if (x ->> id_) !~ '^\d+$' then perform public.apih_err(id_ || ' debe ser un número de 1 a 5', id_); end if;
    x := jsonb_set(x, array[id_], to_jsonb((x ->> id_)::int));
  end loop;
  if coalesce(x ->> 'estado', '') not in ('Abierto', 'En mitigación', 'Materializado', 'Cerrado') then perform public.apih_err('estado de riesgo inválido', 'estado'); end if;
  if coalesce(x ->> 'cat', '') not in ('Técnico', 'Alcance', 'Recursos', 'Proveedor', 'Cronograma', 'Financiero', 'Regulatorio', 'Otro') then perform public.apih_err('categoría de riesgo inválida', 'cat'); end if;
  e1 := (x ->> 'prob')::numeric * (x ->> 'imp')::numeric;
  umb := public.apih_umbral(substr(ir.datos, 4)::jsonb, 'umbralCritico');
  crit := x ->> 'estado' <> 'Cerrado' and e1 >= umb;
  if crit and public.apih_txt(x, 'mit') is null then perform public.apih_err('un riesgo crítico (exposición ' || e1 || ' ≥ ' || umb || ') requiere plan de mitigación', 'mit'); end if;
  id_ := case when nw then public.apih_nuevo_id('APIH_Riesgos', 'RSK') else p_id end;
  perform public.apih_escribir('APIH_Riesgos', id_, x);
  perform public.apih_bitacora_cmd(x ->> 'ini', 'Riesgo',
    case when nw then 'Riesgo identificado: ' || (x ->> 'desc') else 'Riesgo actualizado: ' || (x ->> 'desc') || ' (' || (x ->> 'estado') || ')' end,
    case when nw then 'Exposición ' || e1 else 'Exposición ' || e0 || ' → ' || e1 end);
  return jsonb_build_object('id', id_, 'critico', crit);
end $$;

-- ---------- Decisión ----------
create or replace function public.apih_guardar_decision(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); nw boolean := p_id is null or btrim(p_id) = ''; r public.registros; x0 jsonb := '{}'::jsonb; x jsonb;
  ir public.registros; id_ text; maxd int := public.apih_cfg_num('decMaxDias')::int; c0 text; c1 text; es_prop boolean;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if not nw then
    select * into r from public.registros where lista = 'APIH_Decisiones' and id = p_id for update;
    if not found then raise exception 'APIH: la decisión % no existe', p_id using errcode = 'P0002'; end if;
    x0 := substr(r.datos, 4)::jsonb;
    if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área de la decisión' using errcode = '42501'; end if;
  end if;
  -- el estado y la resolución solo cambian con apih_resolver_decision
  x := x0 || public.apih_limpiar(p_datos, array['id', 'estado', 'resolucion', 'fResol', 'aplicada', 'escalada', 'area']);
  if nw then x := jsonb_build_object('tipo', 'Iniciar', 'estado', 'Pendiente', 'resolucion', '', 'fResol', null, 'aplicada', false) || x; end if;
  if public.apih_txt(x, 'titulo') is null then perform public.apih_err('escribe la pregunta o decisión', 'titulo'); end if;
  if coalesce(x ->> 'tipo', '') not in ('Iniciar', 'Acelerar', 'Mantener', 'Pausar', 'Cancelar') then perform public.apih_err('tipo de decisión inválido', 'tipo'); end if;
  if public.apih_txt(x, 'limite') is null then perform public.apih_err('la fecha límite es obligatoria', 'limite'); end if;
  if (x ->> 'limite')::date > hoy + maxd then perform public.apih_err('el plazo máximo de una decisión es de ' || maxd || ' días', 'limite'); end if;
  if public.apih_txt(x, 'ini') is not null then
    ir := public.apih_puede_ini(x ->> 'ini'); es_prop := ir.lista = 'APIH_Propuestas';
    if x ->> 'tipo' = 'Iniciar' and not es_prop then perform public.apih_err('«Iniciar» aplica solo a propuestas', 'tipo'); end if;
    if x ->> 'tipo' = 'Acelerar' and es_prop then perform public.apih_err('«Acelerar» aplica solo a proyectos', 'tipo'); end if;
    x := x || jsonb_build_object('area', coalesce(public.apih_area_vis(ir.area), 'BISE'));
  else
    x := (x - 'ini') || jsonb_build_object('area', coalesce(x0 ->> 'area', 'BISE'));
  end if;
  if public.apih_txt(x, 'comite') is not null and not exists (select 1 from public.registros where lista = 'APIH_Comites' and id = x ->> 'comite') then
    perform public.apih_err('el comité elegido no existe', 'comite'); end if;
  id_ := case when nw then public.apih_nuevo_id('APIH_Decisiones', 'DEC') else p_id end;
  perform public.apih_escribir('APIH_Decisiones', id_, x);
  -- el comité lleva la lista de sus decisiones: se mueve en la misma transacción
  c0 := public.apih_txt(x0, 'comite'); c1 := public.apih_txt(x, 'comite');
  if c0 is distinct from c1 then
    perform set_config('apih.interno', 'on', true);
    update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(case when jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' then substr(datos, 4)::jsonb -> 'decisiones' else '[]'::jsonb end) v where v #>> '{}' <> id_), '[]'::jsonb)
        || case when id = c1 then jsonb_build_array(id_) else '[]'::jsonb end)::text
      where lista = 'APIH_Comites' and id in (coalesce(c0, ''), coalesce(c1, ''));
    perform set_config('apih.interno', 'off', true);
  end if;
  if nw then perform public.apih_bitacora_cmd(x ->> 'ini', 'Decisión', 'Decisión solicitada (' || (x ->> 'tipo') || '): ' || (x ->> 'titulo')); end if;
  return jsonb_build_object('id', id_);
end $$;

-- ---------- Eliminar ----------
create or replace function public.apih_eliminar(p_lista text, p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; x jsonb; t text;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if p_lista not in ('APIH_Hitos', 'APIH_Riesgos', 'APIH_Decisiones') then raise exception 'APIH: no se puede eliminar en %', p_lista using errcode = '42501'; end if;
  select * into r from public.registros where lista = p_lista and id = p_id for update;
  if not found then raise exception 'APIH: el registro % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_edita_area(r.area) then raise exception 'APIH: sin permiso sobre el área del registro' using errcode = '42501'; end if;
  x := substr(r.datos, 4)::jsonb;
  if p_lista = 'APIH_Decisiones' then
    perform set_config('apih.interno', 'on', true);
    update public.registros set datos = 'p1.' || jsonb_set(substr(datos, 4)::jsonb, '{decisiones}',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(substr(datos, 4)::jsonb -> 'decisiones') v where v #>> '{}' <> p_id), '[]'::jsonb))::text
      where lista = 'APIH_Comites' and jsonb_typeof(substr(datos, 4)::jsonb -> 'decisiones') = 'array' and substr(datos, 4)::jsonb -> 'decisiones' ? p_id;
    perform set_config('apih.interno', 'off', true);
  end if;
  delete from public.registros where lista = p_lista and id = p_id;
  t := case p_lista when 'APIH_Hitos' then 'Hito eliminado: ' || coalesce(x ->> 'nombre', p_id)
                    when 'APIH_Riesgos' then 'Riesgo eliminado: ' || coalesce(x ->> 'desc', p_id)
                    else 'Decisión eliminada: ' || coalesce(x ->> 'titulo', p_id) end;
  perform public.apih_bitacora_cmd(x ->> 'ini', case p_lista when 'APIH_Riesgos' then 'Riesgo' when 'APIH_Decisiones' then 'Decisión' else 'Cambio' end, t);
  return jsonb_build_object('id', p_id);
end $$;

revoke all on function public.apih_ini(text), public.apih_nuevo_id(text, text), public.apih_escribir(text, text, jsonb), public.apih_escribir_cmd(text, text, jsonb), public.apih_bitacora_cmd(text, text, text, text),
  public.apih_puede_ini(text, text) from public, anon, authenticated;
revoke all on function public.apih_guardar_hito(text, jsonb), public.apih_guardar_riesgo(text, jsonb), public.apih_guardar_decision(text, jsonb), public.apih_eliminar(text, text) from public, anon;
grant execute on function public.apih_guardar_hito(text, jsonb), public.apih_guardar_riesgo(text, jsonb), public.apih_guardar_decision(text, jsonb), public.apih_eliminar(text, text) to authenticated;
