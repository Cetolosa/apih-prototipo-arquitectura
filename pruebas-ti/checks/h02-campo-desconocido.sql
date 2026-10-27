-- Pruebas TI · H02 · Contrato en el servidor: un campo inventado no debe persistir (mass assignment).
-- Reproduce el caso del informe: un Editor crea una iniciativa con un campo basura de 1 KB.
-- Emite una línea "TI|H02|<CERRADO|ABIERTO>|<evidencia>" y nunca aborta la corrida.
create or replace function pg_temp.como(p_email text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claims', json_build_object('email', p_email)::text, true); end $$;
create or replace function pg_temp.ti(h text, e text, m text) returns void language plpgsql as
$$ begin raise notice 'TI|%|%|%', h, e, m; end $$;

insert into public.perfiles (email, rol, app_rol, areas) values ('ti-editor@test.cl', 'editor', 'Colaborador', '{"A"}') on conflict (email) do nothing;

do $$
declare basura text := repeat('x', 1024); aceptado boolean := false; persistido boolean := false; msg text := '';
begin
  perform pg_temp.como('ti-editor@test.cl');
  set local role authenticated;
  begin
    insert into public.registros(lista, id, datos)
      values ('APIH_Proyectos', 'TI-H02', 'p1.' || json_build_object('id','TI-H02','titulo','Prueba TI','area','A','estado','En curso','rag','Verde','campoInventado',basura)::text);
    aceptado := true;
  exception when others then msg := sqlerrm; end;
  reset role;
  select exists (select 1 from public.registros where id = 'TI-H02' and datos like '%campoInventado%') into persistido;
  delete from public.registros where id = 'TI-H02';
  if aceptado and persistido then
    perform pg_temp.ti('H02', 'ABIERTO', 'insert de Editor con campo inventado de 1 KB: aceptado y persistido (el servidor valida tipos y rangos, no rechaza campos desconocidos)');
  elsif aceptado then
    perform pg_temp.ti('H02', 'CERRADO', 'el insert se aceptó pero el campo inventado no se persistió (descartado)');
  else
    perform pg_temp.ti('H02', 'CERRADO', 'rechazado por el servidor: ' || left(msg, 120));
  end if;
end $$;
