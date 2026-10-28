-- Catálogo de campos: claves de los formularios de iniciativa que el e2e no recorre (alta directa y propuesta).
-- Las altas al catálogo van en migraciones nuevas: las ya aplicadas no se editan.
insert into public.apih_campos (lista, campo) values
  ('APIH_Propuestas', 'motivoAlta'),
  ('APIH_Propuestas', 'objetivos'),
  ('APIH_Propuestas', 'problema'),
  ('APIH_Propuestas', 'resultadoNota'),
  ('APIH_Propuestas', 'usuarios'),
  ('APIH_Proyectos', 'motivoAlta'),
  ('APIH_Proyectos', 'objetivos'),
  ('APIH_Proyectos', 'problema'),
  ('APIH_Proyectos', 'resultadoNota'),
  ('APIH_Proyectos', 'solicitante'),
  ('APIH_Proyectos', 'usuarios')
on conflict do nothing;
