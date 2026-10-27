-- Datos de prueba (proyecto de arquitectura, fuera de Aramark). Usuarios sintéticos; no hay datos reales.
insert into public.dominios_permitidos values ('aramark.cl') on conflict do nothing;
insert into public.perfiles (email, nombre, rol, app_rol, areas, ve_todo, ve_montos, gobierna) values
  ('tolosa-christian@aramark.cl', 'Christian Tolosa (prueba)', 'admin',  'Administra',  '{}',              true,  true,  true),
  ('cetolosa@gmail.com',          'Editor de prueba',          'editor', 'Colaborador', '{"Área de prueba"}', false, false, false)
on conflict (email) do update set rol = excluded.rol, app_rol = excluded.app_rol, areas = excluded.areas,
  ve_todo = excluded.ve_todo, ve_montos = excluded.ve_montos, gobierna = excluded.gobierna;
