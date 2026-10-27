/* Configuración pública de APIH Prototipo Arquitectura (proyecto Supabase de PRUEBAS "apih-arq").
   La clave publishable no se guarda en el repositorio: el despliegue la inyecta. Llega al navegador igual (es lo que identifica el proyecto); la seguridad real está en el login individual y en RLS.
   NUNCA pegues aquí la clave "secret" / "service_role". */
window.APIH_OVERRIDE = {
  auth: { provider: 'supabase' },
  supabase: {
    url: 'https://bjkuupynrylgfmzhyxgz.supabase.co',
    anonKey: ''   /* la inyecta el despliegue desde la variable de Actions SUPABASE_PUBLISHABLE_KEY */
  }
};
/* Versión del prototipo de arquitectura. Fecha y commit se completan en el despliegue. */
window.APIH_BUILD = { v: 'A1.0', b: '', c: '' };
