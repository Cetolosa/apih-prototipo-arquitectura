/* Configuración pública de APIH Prototipo Arquitectura (proyecto Supabase de PRUEBAS).
   La clave anon es pública por diseño; la seguridad real está en el login individual y en RLS.
   NUNCA pegues aquí la clave "service_role". Completar con el proyecto de pruebas. */
window.APIH_OVERRIDE = {
  auth: { provider: 'supabase' },
  supabase: { url: '', anonKey: '' }
};
