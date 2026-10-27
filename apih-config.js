/* Configuración pública de APIH Prototipo Arquitectura (proyecto Supabase de PRUEBAS "apih-arq").
   La clave publishable es pública por diseño; la seguridad real está en el login individual y en RLS.
   NUNCA pegues aquí la clave "secret" / "service_role". */
window.APIH_OVERRIDE = {
  auth: { provider: 'supabase' },
  supabase: {
    url: 'https://bjkuupynrylgfmzhyxgz.supabase.co',
    anonKey: 'sb_publishable_yed04a43187dGPwCKDDSaw_3dpNSKee'
  }
};
