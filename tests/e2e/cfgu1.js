// F2 · Preferencias personales por registro (cfgU:<correo>): lectura, escritura solo propia y escritura del admin.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const out = {}; const svc = new ApiService(APIH_CONFIG); const dbs = {}, escritos = [];
    svc.listItems = async ent => ent === 'settings' ? [
      { spid: 'cfg', f: { Title: 'cfg', DatosJSON: '{"a":1}' } },
      { spid: 'cfgU:ana@x.cl', f: { Title: 'cfgU:ana@x.cl', DatosJSON: JSON.stringify({ n: 'Ana', v: { tema: 'claro' } }) } },
      { spid: 'cfgU:luis@x.cl', f: { Title: 'cfgU:luis@x.cl', DatosJSON: JSON.stringify({ n: 'Luis', v: { tema: 'oscuro' } }) } }] : [];
    svc.createItem = async (ent, f) => { escritos.push(f.Title); return f.Title; }; svc.updateItem = async (ent, id, f) => { escritos.push(f.Title); };
    const s = await svc.getSettings(); out.mapa = s.cfgU; out.sinClavesSueltas = !Object.keys(s).some(k => k.startsWith('cfgU:'));
    St.usuarios = [{ n: 'Ana', correo: 'ana@x.cl' }, { n: 'Luis', correo: 'luis@x.cl' }]; St.cfg.usuario = 'Ana';
    svc._emailPropio = () => 'ana@x.cl';
    window.esAdminReal = () => false;
    await svc.saveSetting('cfgU', { Ana: { tema: 'oscuro' }, Luis: { tema: 'HACK' } }); out.noAdmin = escritos.slice();
    escritos.length = 0; window.esAdminReal = () => true;
    await svc.saveSetting('cfgU', { Ana: { tema: 'oscuro' }, Luis: { tema: 'HACK' } }); out.admin = escritos.slice();
    return out;
  });
  console.log(JSON.stringify(r), err);
  const ok = !err.length && r.mapa.Ana.tema === 'claro' && r.mapa.Luis.tema === 'oscuro' && r.sinClavesSueltas && JSON.stringify(r.noAdmin) === '["cfgU:ana@x.cl"]' && JSON.stringify(r.admin) === '["cfgU:luis@x.cl"]';
  console.log(ok ? 'OK cfgu1' : 'FALLA cfgu1'); await b.close(); process.exit(ok ? 0 : 1);
})();
