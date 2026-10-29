-- =====================================================================================
-- APIH Prototipo · Paridad con el Corporativo (29-10-2026)
--   Comandos que el Corporativo ya tenía y el prototipo no; con esto la misma SPA funciona sobre ambos servidores:
--     apih_defaults()                                  → parámetros de negocio por defecto (una sola definición)
--     apih_trabajo()                                   → señales por iniciativa y «Mi trabajo»
--     apih_nota_guardar / _estado / _visto / _eliminar → comentarios y notas internas
--     apih_pres_evaluar / _marcar / _aplicar_reglas    → qué entra en la presentación del comité
--     apih_fase_cascada(p_accion, p_de, p_a)          → renombrar / eliminar / restablecer fases
--     apih_importar_proyecto(p_ini, p_archivo, p_simular) → «Completar con archivo» con vista previa en el servidor
--   y la categoría de hito validada en el servidor (apih_cats_hito).
-- =====================================================================================

-- ---------- escritura de una fila por comando: si existe se actualiza (antes un upsert disparaba las reglas de alta y una persona
--            sin rol Administra no podía guardar la ficha de un proyecto que ya no estaba en su primera fase; el Corporativo ya lo hacía así)
create or replace function public.apih_escribir(p_lista text, p_id text, j jsonb) returns void language plpgsql security definer set search_path = public as
$$ begin
  update public.registros set datos = 'p1.' || (j || jsonb_build_object('id', p_id))::text where lista = p_lista and id = p_id;
  if not found then insert into public.registros(lista, id, datos) values (p_lista, p_id, 'p1.' || (j || jsonb_build_object('id', p_id))::text); end if;
end $$;

-- ---------- parámetros por defecto: una sola definición ----------
create or replace function public.apih_cfg_def(k text) returns numeric language sql immutable as
$$ select case k when 'umbralCritico' then 15 when 'tolDesv' then 7 when 'diasSinUpdate' then 14 when 'decMaxDias' then 30 when 'decEscalaDias' then 7
  when 'descMax' then 500 when 'propDiasAmb' then 30 when 'propDiasRojo' then 60 when 'capacidadMax' then 5 when 'cieloMeta' then 80 end::numeric $$;
create or replace function public.apih_defaults() returns jsonb language sql immutable as
$$ select jsonb_object_agg(k, public.apih_cfg_def(k)) from unnest(array['umbralCritico','tolDesv','diasSinUpdate','decMaxDias','decEscalaDias','descMax','propDiasAmb','propDiasRojo','capacidadMax','cieloMeta']) k $$;

-- ---------- categorías de hito ----------
create or replace function public.apih_cats_hito() returns jsonb language sql stable security definer set search_path = public as
$$ select coalesce(case when jsonb_typeof(public.apih_cfg() -> 'hitoCats') = 'array' and jsonb_array_length(public.apih_cfg() -> 'hitoCats') > 0 then public.apih_cfg() -> 'hitoCats' end,
                   '["Entregable","Gobierno","Técnico","Proveedor","Pago","Comunicación","Otro"]'::jsonb) $$;

-- ---------- apih_trabajo: señales y «Mi trabajo» ----------
create or replace function public.apih_trabajo() returns jsonb language plpgsql stable security definer set search_path = public as
$$
declare hoy date := public.apih_hoy(); calc jsonb; per public.perfiles; me text; r record; h record; x jsonb; ci jsonb; out jsonb; sen jsonb := '{}'::jsonb; items jsonb := '[]'::jsonb;
  dv numeric; ven jsonb; rk jsonb; pres numeric; gas numeric; gp int; av int; umb numeric; dsu numeric; f text; j jsonb; ini jsonb := '{}'::jsonb;
begin
  if public.apih_rol() is null then return jsonb_build_object('senales', '{}'::jsonb, 'trabajo', '[]'::jsonb); end if;
  calc := public.apih_calculos_base();
  select * into per from public.perfiles where email = public.apih_email();
  me := coalesce(nullif(per.nombre, ''), per.email, '');
  for r in select id, substr(datos, 4)::jsonb j from public.registros_v where lista in ('APIH_Proyectos','APIH_Propuestas') and left(substr(datos, 4), 1) = '{' loop
    ini := ini || jsonb_build_object(r.id, r.j);
  end loop;
  -- señales por iniciativa
  for r in select key id, value j from jsonb_each(ini) loop
    out := '[]'::jsonb; ci := coalesce(calc -> 'ini' -> r.id, '{}'::jsonb);
    dv := coalesce((ci ->> 'desv')::numeric, 0);
    if dv > 0 then out := out || jsonb_build_object('bad', true, 't', 'Atrasado ' || dv || ' d.', 'd', 'Termina el ' || public.apih_fmt_d(ci ->> 'forecast') || '; el plan decía ' || public.apih_fmt_d(r.j ->> 'finPlan') || '.'); end if;
    select coalesce(jsonb_agg(q.h order by q.h ->> 'fecha'), '[]'::jsonb) into ven from (select substr(datos, 4)::jsonb h from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{') q
      where q.h ->> 'ini' = r.id and coalesce((q.h ->> 'completado')::boolean, false) = false and coalesce(q.h ->> 'fecha', '') <> '' and (q.h ->> 'fecha') < hoy::text;
    if jsonb_array_length(ven) > 0 then
      out := out || jsonb_build_object('bad', true, 't', jsonb_array_length(ven) || case when jsonb_array_length(ven) = 1 then ' hito vencido:' else ' hitos vencidos:' end,
        'd', (select string_agg((v ->> 'nombre') || ' (' || (hoy - (v ->> 'fecha')::date) || ' d)', ', ' order by n) from jsonb_array_elements(ven) with ordinality e(v, n) where n <= 2)
             || case when jsonb_array_length(ven) > 2 then ' y ' || (jsonb_array_length(ven) - 2) || ' más.' else '.' end);
    end if;
    select coalesce(jsonb_agg(q.x order by q.id), '[]'::jsonb) into rk from (select id, substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{') q
      where q.x ->> 'ini' = r.id and coalesce((calc -> 'riesgos' -> q.id ->> 'critico')::boolean, false) and btrim(coalesce(q.x ->> 'mit', '')) = '';
    if jsonb_array_length(rk) > 0 then
      out := out || jsonb_build_object('bad', true, 't', jsonb_array_length(rk) || case when jsonb_array_length(rk) = 1 then ' riesgo crítico sin mitigación:' else ' riesgos críticos sin mitigación:' end,
        'd', left(coalesce(nullif(rk -> 0 ->> 'desc', ''), rk -> 0 ->> 'id'), 60) || case when jsonb_array_length(rk) > 1 then ' y ' || (jsonb_array_length(rk) - 1) || ' más.' else '.' end);
    end if;
    pres := public.apih_num(r.j, 'presupuesto');
    gas := case when coalesce(r.j ->> 'gastado', '') ~ '^-?\d+(\.\d+)?$' then (r.j ->> 'gastado')::numeric end;
    if pres > 0 and gas is not null then
      gp := round(gas / pres * 100); av := round(coalesce((ci ->> 'avance')::numeric, (r.j ->> 'avance')::numeric, 0));
      out := out || jsonb_build_object('bad', gp > av + 10, 't', 'Gasto ' || gp || ' %', 'd', 'con ' || av || ' % de avance.');
    end if;
    if not exists (select 1 from jsonb_array_elements(out) e where (e ->> 'bad')::boolean) then out := jsonb_build_array(jsonb_build_object('bad', false, 't', 'Sin señales de alerta.', 'd', '')) || out; end if;
    sen := sen || jsonb_build_object(r.id, out);
  end loop;
  -- Mi trabajo (lo vencido y lo que vence en 14 días)
  for h in select substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' loop
    j := ini -> (h.x ->> 'ini'); f := h.x ->> 'fecha';
    if j is null or j ->> 'tipo' = 'Propuesta' or j ->> 'estado' in ('Stand By','Completado','Cancelado') or j ->> 'lider' is distinct from me or coalesce(h.x ->> 'completado', '') = 'true' then continue; end if;
    if coalesce(f, '') <> '' and f::date - hoy <= 14 then items := items || jsonb_build_object('k','hito','id',h.x->>'id','t',h.x->>'nombre','s',j->>'titulo','when',f,'over',f::date < hoy,'ic','flag','ini',h.x->>'ini','areaFiltro',true); end if;
  end loop;
  for r in select id, substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' loop
    if (ini -> (r.x ->> 'ini') ->> 'estado') = 'Stand By' then continue; end if; f := r.x ->> 'fRev';
    if r.x ->> 'dueno' = me and r.x ->> 'estado' is distinct from 'Cerrado' and coalesce(f, '') <> '' and f::date - hoy <= 14 then
      items := items || jsonb_build_object('k','risk','id',r.id,'t','Revisar riesgo: ' || (r.x->>'desc'),'s',coalesce(ini -> (r.x->>'ini') ->> 'titulo','—'),'when',f,'over',f::date < hoy,'ic','shield','ini',r.x->>'ini'); end if;
  end loop;
  for r in select id, substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Decisiones' and left(substr(datos, 4), 1) = '{' loop
    if (ini -> (r.x ->> 'ini') ->> 'estado') = 'Stand By' then continue; end if; f := r.x ->> 'limite';
    if r.x ->> 'estado' = 'Pendiente' and r.x ->> 'solicita' = me and coalesce(f, '') <> '' and f::date - hoy <= 14 then
      items := items || jsonb_build_object('k','dec','id',r.id,'t','Decisión: ' || (r.x->>'titulo'),'s',case when r.x->>'ini' is null then '' else coalesce(ini -> (r.x->>'ini') ->> 'titulo','—') end,'when',f,'over',f::date < hoy,'ic','gavel','ini',r.x->>'ini'); end if;
  end loop;
  for r in select id, substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Comites' and left(substr(datos, 4), 1) = '{' loop
    for x in select jsonb_build_object('a', a, 'tp', tp) from (select a, 'Acción' tp from jsonb_array_elements(case when jsonb_typeof(r.x->'acciones')='array' then r.x->'acciones' else '[]' end) a
                                                           union all select a, 'Compromiso' from jsonb_array_elements(case when jsonb_typeof(r.x->'compromisos')='array' then r.x->'compromisos' else '[]' end) a) q loop
      f := x -> 'a' ->> 'limite';
      if jsonb_typeof(x -> 'a') = 'object' and x -> 'a' ->> 'resp' = me and x -> 'a' ->> 'estado' in ('Abierta','Abierto') and coalesce(f, '') <> '' and f::date - hoy <= 14 then
        items := items || jsonb_build_object('k','acc','id',x->'a'->>'id','t',(x->>'tp') || ': ' || (x->'a'->>'texto'),'s',case when x->'a'->>'ini' is null then r.x->>'nombre' else coalesce(ini -> (x->'a'->>'ini') ->> 'titulo','—') end,'when',f,'over',f::date < hoy,'ic','check','ini',x->'a'->>'ini'); end if;
    end loop;
  end loop;
  for r in select id, substr(datos, 4)::jsonb x from public.registros_v where lista = 'APIH_Compromisos' and left(substr(datos, 4), 1) = '{' loop
    if (ini -> (r.x ->> 'ini') ->> 'estado') = 'Stand By' then continue; end if; f := r.x ->> 'limite';
    if r.x ->> 'resp' = me and r.x ->> 'estado' = 'Abierto' and coalesce(f, '') <> '' and f::date - hoy <= 14 then
      items := items || jsonb_build_object('k','acu','id',r.id,'t','Compromiso: ' || (r.x->>'texto'),'s',case when r.x->>'ini' is null then coalesce(r.x->>'tema','General') else coalesce(ini -> (r.x->>'ini') ->> 'titulo','—') end,'when',f,'over',f::date < hoy,'ic','check','ini',r.x->>'ini'); end if;
  end loop;
  for r in select key id, value j from jsonb_each(ini) loop
    if r.j ->> 'lider' is distinct from me or r.j ->> 'estado' in ('Stand By','Completado','Cancelado','Aprobada','Rechazada','Retirada') or coalesce(r.j ->> 'fase', '') not in ('Planificación','Ejecución','Transición') then continue; end if;
    umb := public.apih_umbral(r.j, 'diasSinUpdate'); dsu := coalesce((calc -> 'ini' -> r.id ->> 'dsu')::numeric, 999);
    if dsu > umb then items := items || jsonb_build_object('k','upd','id',r.id,'t','Actualizar avance (hace ' || dsu || ' d)','s',r.j->>'titulo',
      'when', case when coalesce(r.j->>'actualizada','') <> '' then (left(r.j->>'actualizada', 10)::date + umb::int)::text else hoy::text end,'over',true,'ic','refresh','ini',r.id,'areaFiltro',true); end if;
  end loop;
  select coalesce(jsonb_agg(e order by e ->> 'when'), '[]'::jsonb) into items from jsonb_array_elements(items) e;
  return jsonb_build_object('senales', sen, 'trabajo', items);
end $$;

-- ---------- comentarios y notas internas ----------
create or replace function public.apih_nota_leer(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare r public.registros;
begin
  select * into r from public.registros where lista = 'APIH_Notas' and id = p_id;
  if not found then raise exception 'APIH: el comentario % no existe', p_id using errcode = 'P0002'; end if;
  if not public.apih_ve_area(r.area) then raise exception 'APIH: sin permiso para ver este comentario' using errcode = '42501'; end if;
  return substr(r.datos, 4)::jsonb;
end $$;
create or replace function public.apih_nota_autor(n jsonb) returns boolean language sql stable security definer set search_path = public as
$$ select public.apih_rol() = 'admin' or lower(coalesce(n ->> 'correo', '')) = public.apih_email() $$;
create or replace function public.apih_nota_quien() returns text language sql stable security definer set search_path = public as
$$ select coalesce((select coalesce(nullif(nombre, ''), email) from public.perfiles where email = public.apih_email()), '') $$;

create or replace function public.apih_nota_guardar(p_id text, p_datos jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$
declare d jsonb := coalesce(p_datos, '{}'::jsonb); texto text := btrim(coalesce(p_datos ->> 'texto', '')); nw boolean := p_id is null or btrim(p_id) = '';
  interna boolean := coalesce(p_datos ->> 'tipo', '') = 'interna'; ini text := public.apih_txt(p_datos, 'ini'); area text; id_ text; n jsonb; ir public.registros;
begin
  if public.apih_rol() is null then raise exception 'APIH: sin perfil' using errcode = '42501'; end if;
  if public.apih_solo_lectura() then raise exception 'APIH: el modo solo lectura no permite comentar' using errcode = '42501'; end if;
  if texto = '' then perform public.apih_err('escribe tu comentario', 'texto'); end if;
  if length(texto) > 2000 then perform public.apih_err('el comentario admite hasta 2000 caracteres', 'texto'); end if;
  if interna and not public.apih_gobierna() then raise exception 'APIH: las notas internas son del PMO (Administra o Responsable)' using errcode = '42501'; end if;
  if nw then
    if ini is not null then ir := public.apih_ini(ini); if ir.id is null then perform public.apih_err('la iniciativa ' || ini || ' no existe', 'ini'); end if; end if;
    if interna and ini is null then perform public.apih_err('la nota interna debe estar en una iniciativa', 'ini'); end if;
    area := case when interna then coalesce(ir.area, 'Transversal') else coalesce(public.apih_txt(d, 'area'), 'Transversal') end;
    if not interna and not public.apih_ve_area(area) then raise exception 'APIH: sin permiso para comentar en esa área' using errcode = '42501'; end if;
    id_ := 'NOT-' || upper(to_hex((extract(epoch from clock_timestamp()) * 1000)::bigint)) || upper(substr(md5(random()::text), 1, 4));
    n := jsonb_build_object('id', id_, 'ini', ini, 'area', area, 'tipo', case when interna then 'interna' else '' end, 'vista', left(coalesce(d ->> 'vista', ''), 60),
      'ref', left(coalesce(d ->> 'ref', ''), 200), 'texto', texto, 'autor', public.apih_nota_quien(), 'correo', public.apih_email(),
      'ts', public.apih_hoy()::text || 'T' || to_char(now() at time zone 'America/Santiago', 'HH24:MI'), 'estado', 'Abierto', 'por', '', 'fAb', null);
  else
    id_ := p_id; n := public.apih_nota_leer(id_);
    if coalesce(n ->> 'tipo', '') <> 'interna' or not public.apih_gobierna() or not public.apih_nota_autor(n) then raise exception 'APIH: solo quien la escribió o el administrador puede editarla' using errcode = '42501'; end if;
    n := n || jsonb_build_object('texto', texto, 'edit', true, 'visto', '', 'vistoPor', '', 'fVisto', null);
  end if;
  perform public.apih_escribir_cmd('APIH_Notas', id_, n);
  return jsonb_build_object('id', id_);
end $$;

create or replace function public.apih_nota_estado(p_id text, p_estado text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare n jsonb;
begin
  if not public.apih_gobierna() then raise exception 'APIH: solo Administra o Responsable pueden abordar o reabrir un comentario' using errcode = '42501'; end if;
  if coalesce(p_estado, '') not in ('Abordado', 'Abierto') then perform public.apih_err('estado inválido', 'estado'); end if;
  n := public.apih_nota_leer(p_id);
  n := n || case when p_estado = 'Abordado' then jsonb_build_object('estado', p_estado, 'por', public.apih_nota_quien(), 'fAb', public.apih_hoy()::text)
                 else jsonb_build_object('estado', p_estado, 'por', '', 'fAb', null) end;
  perform public.apih_escribir_cmd('APIH_Notas', p_id, n);
  return jsonb_build_object('id', p_id);
end $$;

create or replace function public.apih_nota_visto(p_ids jsonb, p_visto boolean default true) returns jsonb language plpgsql security definer set search_path = public as
$$ declare k int := 0; i text; n jsonb;
begin
  if not public.apih_gobierna() then raise exception 'APIH: las notas internas son del PMO' using errcode = '42501'; end if;
  for i in select jsonb_array_elements_text(case when jsonb_typeof(p_ids) = 'array' then p_ids else '[]'::jsonb end) loop
    n := public.apih_nota_leer(i);
    n := n || case when coalesce(p_visto, true) then jsonb_build_object('visto', 'Si', 'vistoPor', public.apih_nota_quien(), 'fVisto', public.apih_hoy()::text)
                   else jsonb_build_object('visto', '', 'vistoPor', '', 'fVisto', null) end;
    perform public.apih_escribir_cmd('APIH_Notas', i, n); k := k + 1;
  end loop;
  return jsonb_build_object('n', k);
end $$;

create or replace function public.apih_nota_eliminar(p_id text) returns jsonb language plpgsql security definer set search_path = public as
$$ declare n jsonb;
begin
  if not public.apih_gobierna() then raise exception 'APIH: las notas internas son del PMO' using errcode = '42501'; end if;
  n := public.apih_nota_leer(p_id);
  if not public.apih_nota_autor(n) then raise exception 'APIH: solo quien la escribió o el administrador puede eliminarla' using errcode = '42501'; end if;
  delete from public.registros where lista = 'APIH_Notas' and id = p_id;
  return jsonb_build_object('id', p_id);
end $$;

-- ---------- presentaciones ----------
create or replace function public.apih_pres_reglas(r jsonb) returns jsonb language sql stable security definer set search_path = public as
$$ select jsonb_build_object(
    'hitosDias', greatest(1, coalesce(nullif(case when coalesce(r ->> 'hitosDias', '') ~ '^-?\d+(\.\d+)?$' then (r ->> 'hitosDias')::numeric end, 0), 30)),
    'riesgoMin', greatest(1, coalesce(nullif(case when coalesce(r ->> 'riesgoMin', '') ~ '^-?\d+(\.\d+)?$' then (r ->> 'riesgoMin')::numeric end, 0), nullif(public.apih_num(public.apih_cfg(), 'umbralCritico'), 0), 15)),
    'soloEnCurso', case when jsonb_typeof(r -> 'soloEnCurso') = 'boolean' then (r ->> 'soloEnCurso')::boolean else true end,
    'soloAtencion', case when jsonb_typeof(r -> 'soloAtencion') = 'boolean' then (r ->> 'soloAtencion')::boolean else false end,
    'propAprob', case when jsonb_typeof(r -> 'propAprob') = 'boolean' then (r ->> 'propAprob')::boolean else true end,
    'decPend', case when jsonb_typeof(r -> 'decPend') = 'boolean' then (r ->> 'decPend')::boolean else true end) $$;

create or replace function public.apih_pres_clase(k text) returns text language plpgsql immutable as
$$ begin if k in ('prj','prop','hito','rsk','dec','bit') then return k; end if; perform public.apih_err('clase de elemento inválida', 'k'); return null; end $$;

-- fila visible del elemento (o null)
create or replace function public.apih_pres_buscar(k text, p_id text) returns public.registros language plpgsql stable security definer set search_path = public as
$$ declare r public.registros; listas text[] := case k when 'prj' then array['APIH_Proyectos'] when 'prop' then array['APIH_Propuestas','APIH_Proyectos'] when 'hito' then array['APIH_Hitos']
                                                    when 'rsk' then array['APIH_Riesgos'] when 'dec' then array['APIH_Decisiones'] else array['APIH_Bitacora'] end; j jsonb;
begin
  select * into r from public.registros where lista = any(listas) and id = p_id and public.apih_ve_area(area) limit 1;
  if not found then return null; end if;
  j := substr(r.datos, 4)::jsonb;
  if k = 'prj' and j ->> 'tipo' = 'Propuesta' then return null; end if;
  if k = 'prop' and coalesce(j ->> 'tipo', '') <> 'Propuesta' and r.lista <> 'APIH_Propuestas' then return null; end if;
  return r;
end $$;

-- la única definición de las reglas de inclusión
create or replace function public.apih_pres_eval(k text, j jsonb, rg jsonb, hoy date, calc jsonb, p_id text) returns jsonb language plpgsql immutable as
$$ declare est text := coalesce(j ->> 'estado', ''); fase text := coalesce(j ->> 'fase', ''); rag text := coalesce(j ->> 'rag', ''); atras boolean; d int; e numeric;
begin
  if k = 'prj' then
    atras := coalesce((calc -> 'ini' -> p_id ->> 'atrasado')::boolean, false);
    if (rg ->> 'soloEnCurso')::boolean and est <> 'En curso' then return jsonb_build_object('ok', false, 'why', 'Estado ' || est); end if;
    if (rg ->> 'soloAtencion')::boolean and not (rag <> 'Verde' or atras) then return jsonb_build_object('ok', false, 'why', 'Verde y sin atraso'); end if;
    return jsonb_build_object('ok', true, 'why', est || ' · ' || rag || case when atras then ' · atrasado' else '' end);
  elsif k = 'prop' then
    if (rg ->> 'propAprob')::boolean and not (fase = 'Aprobación' and est = 'Vigente') then return jsonb_build_object('ok', false, 'why', 'Fase ' || fase || case when est <> 'Vigente' then ' · ' || est else '' end); end if;
    return jsonb_build_object('ok', true, 'why', fase || ' · ' || est);
  elsif k = 'hito' then
    if j -> 'completado' = 'true'::jsonb then return jsonb_build_object('ok', false, 'why', 'Ya completado'); end if;
    if coalesce(j ->> 'fecha', '') = '' then return jsonb_build_object('ok', false, 'why', 'Sin fecha'); end if;
    d := (j ->> 'fecha')::date - hoy;
    if d <= (rg ->> 'hitosDias')::numeric then return jsonb_build_object('ok', true, 'why', case when d < 0 then 'Vencido hace ' || -d || ' d' else 'En ' || d || ' d' end); end if;
    return jsonb_build_object('ok', false, 'why', 'A ' || d || ' d (> ' || (rg ->> 'hitosDias') || ')');
  elsif k = 'rsk' then
    if est = 'Cerrado' then return jsonb_build_object('ok', false, 'why', 'Cerrado'); end if;
    e := coalesce((calc -> 'riesgos' -> p_id ->> 'expo')::numeric, public.apih_num(j, 'prob') * public.apih_num(j, 'imp'));
    if e >= (rg ->> 'riesgoMin')::numeric then return jsonb_build_object('ok', true, 'why', 'Exposición ' || e); end if;
    return jsonb_build_object('ok', false, 'why', 'Exposición ' || e || ' (< ' || (rg ->> 'riesgoMin') || ')');
  elsif k = 'dec' then
    if (rg ->> 'decPend')::boolean and est <> 'Pendiente' then return jsonb_build_object('ok', false, 'why', est); end if;
    return jsonb_build_object('ok', true, 'why', est);
  end if;
  return jsonb_build_object('ok', true, 'why', '');
end $$;

-- marca o desmarca (false si la persona no puede modificar ese registro)
create or replace function public.apih_pres_marca(r public.registros, incluir boolean, campo text) returns boolean language plpgsql security definer set search_path = public as
$$ declare j jsonb := substr(r.datos, 4)::jsonb; j0 jsonb := substr(r.datos, 4)::jsonb; ini text; inc jsonb;
begin
  ini := case when r.lista in ('APIH_Proyectos','APIH_Propuestas') then r.id else j ->> 'ini' end;
  if ini is not null then
    begin perform public.apih_puede_ini(ini); exception when sqlstate '42501' then return false; end;
  elsif not public.apih_escribe(r.lista, r.id, null) then return false; end if;
  if campo is not null then
    if campo not in ('resumen','logros','proximos','issue') then perform public.apih_err('texto no marcable', 'campo'); end if;
    inc := case when jsonb_typeof(j -> 'incTxt') = 'object' then j -> 'incTxt' else '{}'::jsonb end;
    inc := case when incluir then inc - campo else inc || jsonb_build_object(campo, false) end;
    j := case when inc = '{}'::jsonb then j - 'incTxt' else j || jsonb_build_object('incTxt', inc) end;
  else j := case when incluir then j - 'inPres' else j || jsonb_build_object('inPres', false) end; end if;
  if j is distinct from j0 then perform public.apih_escribir_cmd(r.lista, r.id, j); end if;
  return true;
end $$;

create or replace function public.apih_pres_evaluar(p_reglas jsonb default null, p_items jsonb default null) returns jsonb language plpgsql stable security definer set search_path = public as
$$ declare rg jsonb := public.apih_pres_reglas(coalesce(p_reglas, '{}'::jsonb)); calc jsonb := public.apih_calculos_base(); out jsonb := '{}'::jsonb; x jsonb; k text; r public.registros;
begin
  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e where jsonb_typeof(e) = 'object' and coalesce(e ->> 'id', '') <> '' loop
    k := public.apih_pres_clase(x ->> 'k'); r := public.apih_pres_buscar(k, x ->> 'id');
    if r.id is not null then out := out || jsonb_build_object(k || ':' || (x ->> 'id'), public.apih_pres_eval(k, substr(r.datos, 4)::jsonb, rg, (calc ->> 'hoy')::date, calc, x ->> 'id')); end if;
  end loop;
  return jsonb_build_object('reglas', rg, 'items', out);
end $$;

create or replace function public.apih_pres_marcar(p_items jsonb) returns jsonb language plpgsql security definer set search_path = public as
$$ declare n int := 0; om int := 0; x jsonb; k text; r public.registros;
begin
  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    k := public.apih_pres_clase(x ->> 'k'); r := public.apih_pres_buscar(k, coalesce(x ->> 'id', ''));
    if r.id is null then om := om + 1; continue; end if;
    if public.apih_pres_marca(r, coalesce(x -> 'incluir', 'true'::jsonb) <> 'false'::jsonb, x ->> 'campo') then n := n + 1; else om := om + 1; end if;
  end loop;
  return jsonb_build_object('n', n, 'omitidos', om);
end $$;

create or replace function public.apih_pres_aplicar_reglas(p_reglas jsonb default null, p_items jsonb default null) returns jsonb language plpgsql security definer set search_path = public as
$$ declare rg jsonb := public.apih_pres_reglas(coalesce(p_reglas, '{}'::jsonb)); calc jsonb := public.apih_calculos_base(); fuera int := 0; dentro int := 0; x jsonb; k text; r public.registros; ok boolean;
begin
  for x in select e from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e where jsonb_typeof(e) = 'object' and coalesce(e ->> 'id', '') <> '' loop
    k := public.apih_pres_clase(x ->> 'k'); if k = 'bit' then continue; end if;
    r := public.apih_pres_buscar(k, x ->> 'id'); if r.id is null then continue; end if;
    ok := (public.apih_pres_eval(k, substr(r.datos, 4)::jsonb, rg, (calc ->> 'hoy')::date, calc, x ->> 'id') ->> 'ok')::boolean;
    if public.apih_pres_marca(r, ok, null) then if ok then dentro := dentro + 1; else fuera := fuera + 1; end if; end if;
  end loop;
  perform public.apih_bitacora_cmd(null, 'Cambio', 'Presentación: reglas aplicadas (' || fuera || ' elementos fuera)');
  return jsonb_build_object('fuera', fuera, 'dentro', dentro);
end $$;

-- ---------- metodología: arrastrar registros al renombrar / eliminar / restablecer fases ----------
create or replace function public.apih_renombrar_clave(o jsonb, de text, a text) returns jsonb language sql immutable as
$$ select case when jsonb_typeof(o) = 'object' and o ? de then (o - de) || jsonb_build_object(a, o -> de) end $$;

create or replace function public.apih_fase_cascada(p_accion text, p_de text, p_a text default null) returns jsonb language plpgsql security definer set search_path = public as
$$ declare r public.registros; j jsonb; j0 jsonb; prop boolean; f text; ni int := 0; nh int := 0; v jsonb;
  base_prop text[] := array['Recepción','Evaluación','Caso de Negocio','Aprobación']; base_prj text[] := array['Planificación','Ejecución','Transición','Cierre'];
begin
  if public.apih_rol() is distinct from 'admin' then raise exception 'APIH: solo Administra cambia la metodología' using errcode = '42501'; end if;
  if coalesce(p_accion, '') not in ('renombrar','eliminar','restablecer') then perform public.apih_err('acción inválida', 'accion'); end if;
  if p_accion <> 'restablecer' and (coalesce(p_de, '') = '' or coalesce(p_a, '') = '') then perform public.apih_err('indica la fase actual y la nueva', 'fase'); end if;
  for r in select * from public.registros where lista in ('APIH_Proyectos','APIH_Propuestas') and left(substr(datos, 4), 1) = '{' order by lista, id loop
    j := substr(r.datos, 4)::jsonb; j0 := j; prop := r.lista = 'APIH_Propuestas' or j ->> 'tipo' = 'Propuesta';
    if p_accion = 'renombrar' then
      if j ->> 'fase' = p_de then j := j || jsonb_build_object('fase', p_a); end if;
      if jsonb_typeof(j -> 'subfases') = 'array' then
        j := j || jsonb_build_object('subfases', (select jsonb_agg(case when jsonb_typeof(s) = 'object' and s ->> 'fase' = p_de then s || jsonb_build_object('fase', p_a) else s end order by n) from jsonb_array_elements(j -> 'subfases') with ordinality e(s, n)));
      end if;
      v := public.apih_renombrar_clave(j -> 'faseNota', p_de, p_a); if v is not null then j := j || jsonb_build_object('faseNota', v); end if;
      v := public.apih_renombrar_clave(j -> 'fasesFechas', p_de, p_a); if v is not null then j := j || jsonb_build_object('fasesFechas', v); end if;
    elsif p_accion = 'eliminar' then
      if j ->> 'fase' = p_de then perform public.apih_err('hay iniciativas en «' || p_de || '»: muévelas de fase antes de eliminarla', 'fase'); end if;
    else
      f := j ->> 'fase';
      if f is not null and not f = any(case when prop then base_prop else base_prj end) then j := j || jsonb_build_object('fase', case when prop then 'Evaluación' else 'Ejecución' end); end if;
    end if;
    if j is distinct from j0 then perform public.apih_escribir_cmd(r.lista, r.id, j); ni := ni + 1; end if;
  end loop;
  for r in select * from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' order by id loop
    j := substr(r.datos, 4)::jsonb; f := j ->> 'fase';
    if (p_accion = 'restablecer' and coalesce(f, '') <> '' and not f = any(base_prop || base_prj)) or (p_accion <> 'restablecer' and f = p_de) then
      perform public.apih_escribir_cmd('APIH_Hitos', r.id, j || jsonb_build_object('fase', case when p_accion = 'restablecer' then '' else p_a end)); nh := nh + 1;
    end if;
  end loop;
  if ni + nh > 0 then perform public.apih_bitacora_cmd(null, 'Cambio', 'Metodología: ' || p_accion || case when coalesce(p_de, '') <> '' then ' «' || p_de || '»' else '' end
      || case when coalesce(p_a, '') <> '' then ' → «' || p_a || '»' else '' end || ' (' || ni || ' iniciativas, ' || nh || ' hitos)'); end if;
  return jsonb_build_object('iniciativas', ni, 'hitos', nh);
end $$;
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
  -- categoría: una sola lista (configuración o la de fábrica), validada en el servidor
  if public.apih_txt(d, 'cat') is not null and (d ->> 'cat') is distinct from (h0 ->> 'cat') and not (public.apih_cats_hito() ? (d ->> 'cat')) then perform public.apih_err('categoría de hito inválida (' || (d ->> 'cat') || ')', 'cat'); end if;
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
-- ---------- «Completar con archivo»: vista previa y aplicación en el servidor ----------
create or replace function public.apih_vacio(x jsonb) returns boolean language sql immutable as $$ select x is null or x = 'null'::jsonb or x = '""'::jsonb $$;
create or replace function public.apih_igual(a jsonb, b jsonb) returns boolean language sql immutable as
$$ select coalesce((public.apih_vacio(a) and public.apih_vacio(b)) or a = b
          or (jsonb_typeof(b) = 'boolean' and (not public.apih_vacio(a) and a::text not in ('false', '0')) = (b::text = 'true')), false) $$;
create or replace function public.apih_ver(x jsonb) returns text language sql immutable as
$$ select case when public.apih_vacio(x) then '—' else left(x #>> '{}', 70) end $$;
create or replace function public.apih_difs(antes jsonb, d jsonb) returns text[] language sql immutable as
$$ select coalesce(array_agg(k || ' ' || public.apih_ver(antes -> k) || ' → ' || public.apih_ver(v)), '{}') from jsonb_each(d) e(k, v) where not public.apih_igual(antes -> k, v) $$;
create or replace function public.apih_sub(o jsonb, ks text[]) returns jsonb language sql immutable as
$$ select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(o) e(k, v) where k = any(ks) $$;
create or replace function public.apih_sin_prefijo(m text) returns text language sql immutable as $$ select regexp_replace(m, '^APIH:\s*', '') $$;

-- referencia de subfase (id o nombre) → id, con la fase del hito
create or replace function public.apih_sf_ref(p_ini text, ref text, fase text) returns text language plpgsql stable security definer set search_path = public as
$$ declare subs jsonb; s jsonb;
begin
  if coalesce(ref, '') = '' then return ''; end if;
  subs := coalesce(substr((public.apih_ini(p_ini)).datos, 4)::jsonb -> 'subfases', '[]'::jsonb);
  select x into s from jsonb_array_elements(subs) x where x ->> 'id' = ref limit 1;
  if s is null then select x into s from jsonb_array_elements(subs) x where public.apih_norm(x ->> 'nombre') = public.apih_norm(ref) and x ->> 'fase' = fase limit 1; end if;
  if s is null then select x into s from jsonb_array_elements(subs) x where public.apih_norm(x ->> 'nombre') = public.apih_norm(ref) limit 1; end if;
  if s is null then raise exception 'APIH: subfase «%» no existe', ref using errcode = '22023'; end if;
  if s ->> 'fase' <> fase then raise exception 'APIH: la subfase «%» es de % y el hito de %', s ->> 'nombre', s ->> 'fase', fase using errcode = '22023'; end if;
  return s ->> 'id';
end $$;

create or replace function public.apih_importar_proyecto(p_ini text, p_archivo jsonb, p_simular boolean default false) returns jsonb language plpgsql security definer set search_path = public as
$$
declare
  ir public.registros; i jsonb; o jsonb; t text; m text[]; es_prop boolean; fs text[]; hoy date := public.apih_hoy();
  ficha text[] := array['titulo','desc','bc','sponsor','lider','negocio','categoria','resumen','logros','proximos','issue','riesgoTxt','avance','presupuesto','gastado','beneficio','inicioPlan','finPlan','finEst','rag','prioridad','moneda'];
  kh text[] := array['nombre','fase','resp','fecha','fechaReal','cat','desc','subfase','completado'];
  kr text[] := array['desc','cat','prob','imp','estado','dueno','fIdent','fRev','mit'];
  ks text[] := array['nombre','fase','inicio','fin','resp','desc'];
  pf jsonb; dI jsonb := '{}'::jsonb; k text; v jsonb; omitidos text[] := '{}'; notas text[] := '{}'; ftx text[] := '{}'; fn jsonb; cam boolean := false;
  ip text; fp text; bloqueo text; pasos jsonb := '[]'::jsonb; x jsonb; ex jsonb; d jsonb; c text[]; h0 jsonb[]; r0 jsonb[]; nw jsonb; subs0 jsonb;
  p jsonb; ok int := 0; errores text[] := '{}'; cambios text[] := '{}'; malos text[]; nfil int;
begin
  ir := public.apih_puede_ini(p_ini); i := substr(ir.datos, 4)::jsonb;
  if public.apih_solo_lectura() then raise exception 'APIH: tu rol no permite editar este proyecto' using errcode = '42501'; end if;
  -- el archivo: objeto, o texto (también dentro de un bloque ```json)
  if jsonb_typeof(p_archivo) = 'object' then o := p_archivo;
  elsif jsonb_typeof(p_archivo) = 'string' then
    t := btrim(p_archivo #>> '{}'); m := regexp_match(t, '```(?:json)?\s*([\s\S]*?)```'); if m is not null then t := btrim(m[1]); end if;
    begin o := t::jsonb; exception when others then o := null; end;
    if jsonb_typeof(o) is distinct from 'object' then perform public.apih_err('el archivo no es un JSON válido', ''); end if;
  else perform public.apih_err('falta el archivo', ''); end if;
  if o ->> 'formato' is distinct from 'apih-proyecto-archivo' then perform public.apih_err('no es un archivo apih-proyecto-archivo', ''); end if;
  if o ->> 'proyecto_id' is distinct from p_ini then perform public.apih_err('el archivo es de ' || coalesce(o ->> 'proyecto_id', '—') || ', no de ' || p_ini, ''); end if;
  es_prop := ir.lista = 'APIH_Propuestas'; fs := public.apih_fases(es_prop);
  nfil := coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'hitos') = 'array' then o -> 'hitos' end), 0) + coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'riesgos') = 'array' then o -> 'riesgos' end), 0)
        + coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'subfases') = 'array' then o -> 'subfases' end), 0);
  if nfil > 2000 then perform public.apih_err('el archivo supera 2000 filas', ''); end if;

  -- 1) ficha y notas de fase
  pf := case when jsonb_typeof(o -> 'proyecto') = 'object' then o -> 'proyecto' else '{}'::jsonb end;
  for k, v in select * from jsonb_each(pf) loop
    if not k = any(ficha) then omitidos := omitidos || ('Campo no editable por esta vía: ' || k); continue; end if;
    if not public.apih_igual(i -> k, v) then dI := dI || jsonb_build_object(case when k = 'avance' then 'avanceManual' else k end, v); ftx := ftx || (k || ': ' || public.apih_ver(i -> k) || ' → ' || public.apih_ver(v)); end if;
  end loop;
  ip := coalesce(case when pf ? 'inicioPlan' then pf ->> 'inicioPlan' else i ->> 'inicioPlan' end, ''); fp := coalesce(case when pf ? 'finPlan' then pf ->> 'finPlan' else i ->> 'finPlan' end, '');
  if ip <> '' and fp <> '' and fp < ip then bloqueo := 'finPlan es anterior a inicioPlan: no se aplica nada hasta corregir el archivo'; end if;
  if jsonb_typeof(o -> 'notas_de_fase') = 'object' then
    fn := case when jsonb_typeof(i -> 'faseNota') = 'object' then i -> 'faseNota' else '{}'::jsonb end;
    for k, v in select * from jsonb_each(o -> 'notas_de_fase') loop
      if not k = any(fs) then omitidos := omitidos || ('Nota de fase: «' || k || '» no es una fase de ' || case when es_prop then 'propuesta' else 'proyecto' end); continue; end if;
      if jsonb_typeof(v) <> 'string' then omitidos := omitidos || ('Nota de fase ' || k || ': texto inválido'); continue; end if;
      if coalesce(fn ->> k, '') = btrim(v #>> '{}') then continue; end if;
      fn := case when btrim(v #>> '{}') <> '' then fn || jsonb_build_object(k, btrim(v #>> '{}')) else fn - k end; cam := true; notas := notas || ('Nota de fase ' || k);
    end loop;
    if cam then dI := dI || jsonb_build_object('faseNota', fn); end if;
  end if;
  if dI <> '{}'::jsonb then pasos := pasos || jsonb_build_object('t', 'ficha', 'tx', 'ficha', 'cam', to_jsonb(ftx || notas), 'd', dI); end if;

  -- 2) subfases
  subs0 := case when jsonb_typeof(i -> 'subfases') = 'array' then i -> 'subfases' else '[]'::jsonb end;
  for x in select e from jsonb_array_elements(case when jsonb_typeof(o -> 'subfases') = 'array' then o -> 'subfases' else '[]'::jsonb end) e loop
    if jsonb_typeof(x) <> 'object' or jsonb_typeof(x -> 'nombre') <> 'string' then omitidos := omitidos || 'Subfase sin nombre válido'::text; continue; end if;
    select s into ex from jsonb_array_elements(subs0) s where (coalesce(x ->> 'id', '') <> '' and s ->> 'id' = x ->> 'id') or (s ->> 'fase' = x ->> 'fase' and public.apih_norm(s ->> 'nombre') = public.apih_norm(x ->> 'nombre')) limit 1;
    d := public.apih_sub(x, ks);
    if ex is not null and not exists (select 1 from jsonb_each(d) e(k2, v2) where not public.apih_igual(ex -> k2, v2)) then continue; end if;
    t := case when ex is not null then 'Subfase ' || (ex ->> 'nombre') || ': ' else 'Subfase NUEVA: ' end || (x ->> 'nombre') || ' · ' || coalesce(x ->> 'fase', '');
    pasos := pasos || jsonb_build_object('t', 'subfase', 'tx', t, 'cam', jsonb_build_array(t), 'id', ex ->> 'id', 'd', coalesce(ex, '{}'::jsonb) || d);
  end loop;

  -- 3) hitos
  select coalesce(array_agg(substr(datos, 4)::jsonb), '{}') into h0 from public.registros where lista = 'APIH_Hitos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_ini;
  for x in select e from jsonb_array_elements(case when jsonb_typeof(o -> 'hitos') = 'array' then o -> 'hitos' else '[]'::jsonb end) e loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    d := public.apih_sub(x, kh);
    if coalesce(x ->> 'id', '') <> '' then
      select y into ex from unnest(h0) y where y ->> 'id' = x ->> 'id' limit 1;
      if ex is null then omitidos := omitidos || ('Hito ' || (x ->> 'id') || ' no pertenece a este proyecto'); continue; end if;
      c := public.apih_difs(ex, d); if cardinality(c) = 0 then continue; end if;
      t := 'Hito ' || (x ->> 'id') || ': ' || array_to_string(c, '; ');
      pasos := pasos || jsonb_build_object('t', 'hito', 'tx', 'hito ' || (x ->> 'id'), 'cam', jsonb_build_array(t), 'id', x ->> 'id', 'd', d, 'fase', coalesce(d ->> 'fase', ex ->> 'fase'));
    else
      if jsonb_typeof(x -> 'nombre') = 'string' and exists (select 1 from unnest(h0) y where public.apih_norm(y ->> 'nombre') = public.apih_norm(x ->> 'nombre')) then
        omitidos := omitidos || ('Hito nuevo «' || (x ->> 'nombre') || '» ya existe (se omite)'); continue; end if;
      nw := jsonb_build_object('ini', p_ini, 'fase', i ->> 'fase', 'resp', coalesce(i ->> 'lider', ''), 'completado', false) || d;
      pasos := pasos || jsonb_build_object('t', 'hito', 'tx', 'hito nuevo «' || public.apih_ver(x -> 'nombre') || '»', 'cam', jsonb_build_array('Hito NUEVO: ' || public.apih_ver(x -> 'nombre') || ' · ' || coalesce(nw ->> 'fase', '') || ' · ' || public.apih_ver(x -> 'fecha')), 'id', null, 'd', nw, 'fase', nw ->> 'fase');
    end if;
  end loop;

  -- 4) riesgos
  select coalesce(array_agg(substr(datos, 4)::jsonb), '{}') into r0 from public.registros where lista = 'APIH_Riesgos' and left(substr(datos, 4), 1) = '{' and substr(datos, 4)::jsonb ->> 'ini' = p_ini;
  for x in select e from jsonb_array_elements(case when jsonb_typeof(o -> 'riesgos') = 'array' then o -> 'riesgos' else '[]'::jsonb end) e loop
    if jsonb_typeof(x) <> 'object' then continue; end if;
    d := public.apih_sub(x, kr);
    if coalesce(x ->> 'id', '') <> '' then
      select y into ex from unnest(r0) y where y ->> 'id' = x ->> 'id' limit 1;
      if ex is null then omitidos := omitidos || ('Riesgo ' || (x ->> 'id') || ' no pertenece a este proyecto'); continue; end if;
      c := public.apih_difs(ex, d); if cardinality(c) = 0 then continue; end if;
      pasos := pasos || jsonb_build_object('t', 'riesgo', 'tx', 'riesgo ' || (x ->> 'id'), 'cam', jsonb_build_array('Riesgo ' || (x ->> 'id') || ': ' || array_to_string(c, '; ')), 'id', x ->> 'id', 'd', d);
    else
      nw := jsonb_build_object('ini', p_ini, 'dueno', coalesce(i ->> 'lider', ''), 'fIdent', hoy::text, 'fRev', (hoy + 30)::text) || d;
      pasos := pasos || jsonb_build_object('t', 'riesgo', 'tx', 'riesgo nuevo «' || left(public.apih_ver(x -> 'desc'), 30) || '»',
        'cam', jsonb_build_array('Riesgo NUEVO: ' || public.apih_ver(x -> 'desc') || ' · ' || public.apih_ver(coalesce(x -> 'prob', '3')) || '×' || public.apih_ver(coalesce(x -> 'imp', '3'))), 'id', null, 'd', nw);
    end if;
  end loop;

  if bloqueo is not null then
    return jsonb_build_object('vistaPrevia', coalesce(p_simular, false), 'bloqueo', bloqueo, 'cambios', coalesce((select jsonb_agg(c2) from jsonb_array_elements(pasos) p2, jsonb_array_elements_text(p2 -> 'cam') c2), '[]'::jsonb), 'omitidos', to_jsonb(omitidos), 'ok', 0, 'errores', '[]'::jsonb);
  end if;

  -- 5) aplicar (o simular): cada paso con su punto de restauración; la simulación deshace todo al final
  begin
    for p in select e from jsonb_array_elements(pasos) e loop
      begin
        if p ->> 't' = 'ficha' then
          begin perform public.apih_guardar_iniciativa(p_ini, null, p -> 'd');
          exception when others then
            malos := '{}';
            for k, v in select * from jsonb_each(p -> 'd') loop
              begin perform public.apih_guardar_iniciativa(p_ini, null, jsonb_build_object(k, v)); exception when others then malos := malos || (k || ': ' || public.apih_sin_prefijo(sqlerrm)); end;
            end loop;
            if cardinality(malos) = (select count(*) from jsonb_object_keys(p -> 'd')) then raise exception '%', array_to_string(malos, ' | '); end if;
            omitidos := omitidos || (select array_agg('Ficha ' || y) from unnest(malos) y);
          end;
        elsif p ->> 't' = 'subfase' then perform public.apih_guardar_subfase(p_ini, p ->> 'id', p -> 'd');
        elsif p ->> 't' = 'hito' then
          d := p -> 'd'; if d ? 'subfase' then d := d || jsonb_build_object('subfase', public.apih_sf_ref(p_ini, d ->> 'subfase', p ->> 'fase')); end if;
          perform public.apih_guardar_hito(p ->> 'id', d);
        else perform public.apih_guardar_riesgo(p ->> 'id', p -> 'd'); end if;
        ok := ok + 1; cambios := cambios || array(select jsonb_array_elements_text(p -> 'cam'));
      exception when others then errores := errores || (p ->> 'tx' || ': ' || public.apih_sin_prefijo(sqlerrm));
      end;
    end loop;
    if coalesce(p_simular, false) then raise exception using errcode = 'P0099', message = 'apih: vista previa'; end if;
  exception when sqlstate 'P0099' then null;   -- deshace todo lo aplicado en la vista previa
  end;
  if coalesce(p_simular, false) then
    return jsonb_build_object('vistaPrevia', true, 'bloqueo', null, 'cambios', to_jsonb(cambios), 'omitidos', to_jsonb(omitidos || errores), 'ok', ok, 'errores', '[]'::jsonb);
  end if;
  if ok > 0 then perform public.apih_bitacora_cmd(p_ini, 'Cambio', 'Completado con archivo: ' || ok || ' cambio(s) aplicados'
      || case when cardinality(errores) + cardinality(omitidos) > 0 then ', ' || (cardinality(errores) + cardinality(omitidos)) || ' omitidos' else '' end); end if;
  return jsonb_build_object('vistaPrevia', false, 'bloqueo', null, 'cambios', to_jsonb(cambios), 'omitidos', to_jsonb(omitidos), 'ok', ok, 'errores', to_jsonb(errores));
end $$;

-- ---------- permisos ----------
revoke all on function public.apih_cats_hito(), public.apih_nota_leer(text), public.apih_nota_autor(jsonb), public.apih_nota_quien(), public.apih_pres_reglas(jsonb), public.apih_pres_clase(text),
  public.apih_pres_buscar(text, text), public.apih_pres_eval(text, jsonb, jsonb, date, jsonb, text), public.apih_pres_marca(public.registros, boolean, text), public.apih_renombrar_clave(jsonb, text, text),
  public.apih_vacio(jsonb), public.apih_igual(jsonb, jsonb), public.apih_ver(jsonb), public.apih_difs(jsonb, jsonb), public.apih_sub(jsonb, text[]), public.apih_sin_prefijo(text), public.apih_sf_ref(text, text, text) from public, anon, authenticated;
revoke all on function public.apih_defaults(), public.apih_trabajo(), public.apih_nota_guardar(text, jsonb), public.apih_nota_estado(text, text), public.apih_nota_visto(jsonb, boolean), public.apih_nota_eliminar(text),
  public.apih_pres_evaluar(jsonb, jsonb), public.apih_pres_marcar(jsonb), public.apih_pres_aplicar_reglas(jsonb, jsonb), public.apih_fase_cascada(text, text, text), public.apih_importar_proyecto(text, jsonb, boolean) from public, anon;
grant execute on function public.apih_defaults(), public.apih_trabajo(), public.apih_nota_guardar(text, jsonb), public.apih_nota_estado(text, text), public.apih_nota_visto(jsonb, boolean), public.apih_nota_eliminar(text),
  public.apih_pres_evaluar(jsonb, jsonb), public.apih_pres_marcar(jsonb), public.apih_pres_aplicar_reglas(jsonb, jsonb), public.apih_fase_cascada(text, text, text), public.apih_importar_proyecto(text, jsonb, boolean) to authenticated;
