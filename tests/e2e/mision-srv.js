// Iter 5h: la misión de Mi cocina (hitos, compromisos y riesgos por atender) viene del servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-905', titulo: 'Misión e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, actualizada: addD(H, -40), inicioPlan: addD(H, -60), finPlan: addD(H, 100) }));
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-905', nombre: 'Hito de la misión', fase: 'Ejecución', fecha: addD(H, -5), completado: false, resp: me });
    save(); await DataService.flush(); await DataService.refresh(false, true);
    const o = { srv: ((CALC.mision['PRJ-905'] || {}).hit || []).map(h => h.nombre) };
    UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); await new Promise(r => setTimeout(r, 500));
    o.html = (document.getElementById('v22-mis') || {}).textContent || '';
    return o;
  });
  ok(r.srv.includes('Hito de la misión'), 'el servidor entrega el hito vencido de la misión');
  ok(r.html.includes('Hito de la misión'), 'el panel «Tu misión» lo muestra');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA mision-srv' : 'OK mision-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
