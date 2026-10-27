// F3 · El rechazo del servidor marca el campo afectado y deja el formulario abierto; si todo sale bien, cierra.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const out = {}; const esperar = ms => new Promise(r => setTimeout(r, ms));
    DataService.svc = { rpc: async () => { const e = new Error('HTTP 400 · APIH: la nueva fecha es igual a la actual'); e.detalle = 'la nueva fecha es igual a la actual'; e.campo = 'fNue'; throw e; } };
    DataService.refresh = async () => { }; DataService.flush = async () => { }; DataService.busy = false; DataService.dirty = false;
    const abrir = () => openForm({ title: 'T', values: { fNue: '2027-01-01' }, fields: [{ k: 'fNue', l: 'Fecha', t: 'date' }], onSave: o => cmdServidor('apih_solicitar_cambio', {}, 'ok', true).then(x => x !== null) });
    abrir(); Acts.msave(); await esperar(300);
    out.abiertoTrasError = !!Modal.cur; out.campoMarcado = $('#f_fNue').classList.contains('bad'); out.botonLibre = !$('[data-act="msave"]').disabled;
    Modal.close();
    DataService.svc = { rpc: async () => ({ id: 'CHG-1' }) };
    abrir(); Acts.msave(); await esperar(300);
    out.cerradoTrasExito = !Modal.cur;
    return out;
  });
  console.log(JSON.stringify(r), err);
  const ok = !err.length && r.abiertoTrasError && r.campoMarcado && r.botonLibre && r.cerradoTrasExito;
  console.log(ok ? 'OK campo-srv' : 'FALLA campo-srv'); await b.close(); process.exit(ok ? 0 : 1);
})();
