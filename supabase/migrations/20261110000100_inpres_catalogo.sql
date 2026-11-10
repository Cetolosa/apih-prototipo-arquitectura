-- Catálogo de campos: «inPres» (marca «Incluir en presentación») también en Riesgos, Decisiones, Proyectos y Propuestas.
-- El formulario de cada uno envía inPres (casilla de presentación) y el servidor lo rechazaba con
-- «APIH: campo desconocido «inPres» en APIH_Riesgos»; Bitácora e Hitos ya lo tenían. Repetible (on conflict do nothing).
insert into public.apih_campos (lista, campo) values
  ('APIH_Decisiones', 'inPres'),
  ('APIH_Propuestas', 'inPres'),
  ('APIH_Proyectos', 'inPres'),
  ('APIH_Riesgos', 'inPres')
on conflict do nothing;
