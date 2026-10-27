-- Pruebas TI · H01 · Autorización por área y visibilidad de montos, probada directo contra la base (sin pasar por la SPA).
-- Casos del informe: Editor modifica otra área; Lectura obtiene montos. Emite "TI|H01|<CERRADO|ABIERTO>|<evidencia>"; nunca aborta.
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;

insert into public.perfiles (email, rol, app_rol, areas, ve_montos) values
  ('ti-lector@test.cl', 'lector', 'Invitado', '{"A"}', false),
  ('ti-editor@test.cl', 'editor', 'Colaborador', '{"A"}', false) on conflict (email) do nothing;
insert into public.registros(lista, id, datos) values
  ('APIH_Proyectos', 'TI-A', 'p1.{"id":"TI-A","titulo":"TI A","area":"A","estado":"En curso","rag":"Verde","presupuesto":1000}'),
  ('APIH_Proyectos', 'TI-B', 'p1.{"id":"TI-B","titulo":"TI B","area":"B","estado":"En curso","rag":"Verde","presupuesto":5000}');

do $$
declare f text[] := '{}'; n int; d text; ok boolean;
begin
  -- Lectura (Invitado, área A)
  perform pg_temp.como('ti-lector@test.cl'); set local role authenticated;
  select datos into d from public.registros_v where id = 'TI-A';
  if d ~ 'presupuesto' then f := array_append(f, 'Lectura ve montos de su propia área'::text); end if;
  select count(*) into n from public.registros_v where id = 'TI-B';
  if n > 0 then f := array_append(f, 'Lectura ve una iniciativa de otra área'::text); end if;
  begin update public.registros set datos = 'p1.{"id":"TI-A","titulo":"x","area":"A"}' where id = 'TI-A'; get diagnostics n = row_count;
    if n > 0 then f := array_append(f, 'Lectura modifica una iniciativa'::text); end if; exception when others then null; end;
  ok := false; begin insert into public.registros(lista, id, datos) values ('APIH_Proyectos', 'TI-X1', 'p1.{"id":"TI-X1","titulo":"x","area":"A"}'); ok := true; exception when others then null; end;
  if ok then f := array_append(f, 'Lectura crea una iniciativa'::text); end if;
  reset role;
  -- Editor (área A, sin permiso de montos)
  perform pg_temp.como('ti-editor@test.cl'); set local role authenticated;
  begin update public.registros set datos = 'p1.{"id":"TI-B","titulo":"x","area":"B","estado":"En curso","rag":"Verde"}' where id = 'TI-B'; get diagnostics n = row_count;
    if n > 0 then f := array_append(f, 'Editor modifica una iniciativa de otra área'::text); end if; exception when others then null; end;
  ok := false; begin insert into public.registros(lista, id, datos) values ('APIH_Proyectos', 'TI-X2', 'p1.{"id":"TI-X2","titulo":"x","area":"B","estado":"En curso","rag":"Verde"}'); ok := true; exception when others then null; end;
  if ok then f := array_append(f, 'Editor crea una iniciativa en otra área'::text); end if;
  select count(*) into n from public.registros_v where id = 'TI-B';
  if n > 0 then f := array_append(f, 'Editor ve una iniciativa de otra área'::text); end if;
  select datos into d from public.registros_v where id = 'TI-A';
  if d ~ 'presupuesto' then f := array_append(f, 'Editor sin permiso de montos ve montos'::text); end if;
  reset role;
  delete from public.registros where id like 'TI-%';
  if cardinality(f) = 0 then
    raise notice 'TI|H01|CERRADO|probado directo en la base con perfiles Lectura y Editor: no ven ni modifican áreas ajenas y no obtienen montos sin permiso (8 casos)';
  else
    raise notice 'TI|H01|ABIERTO|%', array_to_string(f, '; ');
  end if;
end $$;
