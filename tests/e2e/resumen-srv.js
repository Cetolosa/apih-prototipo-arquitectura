// Iter 5f: «on track», tramos del % On Track y ventanas del resumen ejecutivo vienen del servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const o = {};
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-903', titulo: 'On track e2e', area: 'Área de prueba', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: miUsuario(), actualizada: hoy(), inicioPlan: addD(hoy(), -30), finPlan: addD(hoy(), 120) }));
    save(); await DataService.flush(); await DataService.refresh(false, true);
    o.srv = CALC.resumen.ontrack['PRJ-903']; o.tonos = CALC.resumen.tonos.length; o.vent = CALC.resumen.ventanas.cierreDias;
    const K = kpis(); o.ontrack = K.ontrack; o.activos = K.activos;
    const t = tonoOnTrack(K.ontrackPct); o.tono = t.txt; o.titular = execSummary('con')[0].p[0];
    return o;
  });
  ok(r.srv === true && r.tonos === 3 && r.vent === 45, 'el servidor entrega on track, tramos y ventanas');
  ok(r.ontrack >= 1 && r.ontrack <= r.activos, 'los KPIs cuentan lo que el servidor marcó como on track');
  ok(r.tono && r.titular.includes(r.tono), 'el titular del resumen usa el texto del tramo del servidor');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA resumen-srv' : 'OK resumen-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
