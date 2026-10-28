// Resuelve Playwright: devDependency del repo o, como respaldo, la instalación global del entorno.
// Con APIH_BACKEND_URL (lo define tools/correr-e2e.js) cada contexto del navegador nace con una sesión del backend real:
// la SPA se conecta al mismo origen que la sirve (/rest/v1, /auth/v1) y nadie corre reglas en memoria. APIH_USUARIO elige el perfil.
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const fs = require('fs');
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const URL_BACKEND = process.env.APIH_BACKEND_URL, USUARIO = process.env.APIH_USUARIO || 'tolosa-christian@aramark.cl';
async function conSesion(ctx, email) {
  const s = await (await fetch(URL_BACKEND + '/__pruebas/sesion?email=' + encodeURIComponent(email || USUARIO))).json();
  await ctx.addInitScript(([url, s, em]) => {
    window.APIH_OVERRIDE = { auth: { provider: 'supabase' }, supabase: { url, anonKey: 'sb_publishable_prueba' } };
    try { sessionStorage.setItem('APIH_SB', JSON.stringify({ access: s.access_token, refresh: s.refresh_token, exp: s.exp, email: em })); } catch (e) { }
  }, [URL_BACKEND, s, email || USUARIO]);
  return ctx;
}
const chromium = !URL_BACKEND ? pw.chromium : Object.assign(Object.create(pw.chromium), {
  async launch(o) {
    const b = await pw.chromium.launch(o), nuevoCtx = b.newContext.bind(b);
    b.newContext = async opts => { const c = await nuevoCtx(opts); await conSesion(c); c.conSesion = conSesion.bind(null, c); return c; };
    b.newPage = async opts => (await b.newContext(opts)).newPage();
    return b;
  }
});
module.exports = { chromium, launchOpts: exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] }, conSesion, URL_BACKEND };
