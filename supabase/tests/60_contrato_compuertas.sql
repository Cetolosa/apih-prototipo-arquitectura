-- El contrato compartido (tests/contract/gates_aprobar.json) se evalúa contra la función del servidor.
\set ON_ERROR_STOP on
\set casos `cat tests/contract/gates_aprobar.json`
create temp table casos as select :'casos'::jsonb as j;
delete from public.registros where lista in ('APIH_Propuestas','APIH_Decisiones');
do $t$
declare c jsonb; d jsonb; n int := 0; got text[]; want text[]; k int;
begin
  for c in select * from jsonb_array_elements((select j from casos)) loop
    insert into public.registros(lista, id, datos) values ('APIH_Propuestas', c -> 'prop' ->> 'id', 'p1.' || (jsonb_build_object('titulo', 't', 'area', 'A', 'tipo', 'Propuesta', 'estado', 'Vigente') || (c -> 'prop'))::text);
    k := 0;
    for d in select * from jsonb_array_elements(c -> 'decisiones') loop
      k := k + 1;
      insert into public.registros(lista, id, datos) values ('APIH_Decisiones', (c -> 'prop' ->> 'id') || '-D' || k, 'p1.' || (jsonb_build_object('id', (c -> 'prop' ->> 'id') || '-D' || k, 'ini', c -> 'prop' ->> 'id', 'titulo', 'd') || d)::text);
    end loop;
    got := public.apih_faltan_aprobar(c -> 'prop' ->> 'id');
    select array_agg(x) into want from jsonb_array_elements_text(c -> 'faltan') x;
    if got is distinct from coalesce(want, '{}') then raise exception 'FALLA contrato «%»: servidor % ≠ esperado %', c ->> 'nombre', got, coalesce(want, '{}'); end if;
    n := n + 1;
  end loop;
  raise notice 'ok  contrato de compuertas: % casos coinciden en el servidor', n;
end $t$;
\echo PRUEBAS DE CONTRATO OK
