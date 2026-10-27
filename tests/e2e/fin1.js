// V22.56 · Versión final (pedido 16-10): propuestas con ficha como proyectos, Planificación con propuestas, categorías de hitos y riesgos
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const plan = require('../../docs/APIH_Corporativo_plan_acelerado_C1.3.json').iniciativas[0];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => { localStorage.setItem('apih_tour22', '1'); localStorage.removeItem('apih_ptipo'); }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(x => { celebrar = () => {}; UI.uiOv = 'pro';
    const base = { legacy: '', creada: '2026-10-15', faseDesde: '2026-10-15', origen: 'importación', est: [], hist: [['2026-10-15', 15]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], actualizada: '2026-10-16' };
    const n = Object.assign({}, base, x, { id: 'PRJ-050' }); delete n.hitos; delete n.riesgos; St.ini.push(n);
    x.hitos.forEach((h, k) => St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase, fecha: h.fecha, completado: !!h.completado, resp: h.resp, cat: k % 3 === 0 ? 'Entregable' : k % 3 === 1 ? 'Gobierno' : undefined }));
    x.riesgos.forEach(r => St.riesgos.push(Object.assign({ id: nextId('RSK', St.riesgos), ini: n.id }, r)));
    const pr = Object.assign({}, base, { id: 'PRO-050', tipo: 'Propuesta', titulo: 'Propuesta Planificador de Menús', area: x.area, lider: x.lider, fase: 'Evaluación', estado: 'Vigente', rag: 'Verde', prioridad: 'Alta', avance: 10, inicioPlan: '2026-10-10', finPlan: '2026-12-15', presupuesto: 0, desc: 'Propuesta de prueba' }); St.ini.push(pr);
    [['Necesidad registrada', 'Recepción', '2026-10-12', 'Gobierno', true], ['Evaluación de valor y esfuerzo', 'Evaluación', '2026-10-30', 'Entregable'], ['Business case entregado', 'Caso de Negocio', '2026-11-20', 'Entregable'], ['Presentación a comité', 'Aprobación', '2026-12-10', 'Gobierno']]
      .forEach(([nm, f, d, c, ok]) => St.hitos.push({ id: nextId('HIT', St.hitos), ini: pr.id, nombre: nm, fase: f, fecha: d, completado: !!ok, resp: x.lider, cat: c }));
    St.riesgos.push({ id: nextId('RSK', St.riesgos), ini: pr.id, desc: 'Proveedor sin referencias en minería', cat: 'Proveedor', prob: 3, imp: 4, estado: 'Abierto', dueno: x.lider, fIdent: '2026-10-12', fRev: '2026-10-28', mit: 'Pedir referencias' });
    UI.view = 'gantt'; render(); }, plan);
  await p.waitForTimeout(400);
  const r = {}, n = s => p.$$eval(s, a => a.length);
  // 2) Planificación: Gantt, Roadmap, Fases, Hitos y Riesgos con selector de tipo
  r.ganttAmbos = await p.$$eval('.g-bar', a => a.map(x => x.dataset.id).filter(id => /050/.test(id)).join(','));
  await p.selectOption('[data-chg="ptipo"]', 'prop'); await p.waitForTimeout(200); r.ganttProp = await p.$$eval('.g-bar', a => a.map(x => x.dataset.id).join(','));
  await p.selectOption('[data-chg="ptipo"]', 'all');
  for (const v of ['roadmap', 'fases', 'hitos', 'riesgos']) { await p.evaluate(v => { UI.view = v; render(); }, v); await p.waitForTimeout(250); r['seg_' + v] = await n('[data-chg="ptipo"] option'); }
  await p.evaluate(() => { UI.view = 'roadmap'; render(); }); await p.waitForTimeout(200); r.roadmapProp = await p.evaluate(() => document.body.innerText.includes('Propuesta Planificador de Menús'));
  await p.evaluate(() => { UI.view = 'fases'; F('fases', {}).id = 'PRO-050'; F('fases', {}).tab = 'linea'; render(); }); await p.waitForTimeout(250); r.fasesProp = await p.$$eval('.fz-step', a => a.map(x => x.textContent.split(' ')[0]).length);
  // 3) Categorías: filtro en Hitos
  await p.evaluate(() => { UI.view = 'hitos'; render(); }); await p.waitForTimeout(200);
  r.hitosTodos = await n('.tbl tbody tr[data-t="hito"]'); r.hitosGobEsperado = await p.$$eval('.tbl tbody tr[data-t="hito"] small', a => a.filter(x => /^Gobierno ·/.test(x.textContent.trim())).length); await p.selectOption('[data-v="hitos"][data-f="cat"]', 'Gobierno'); await p.waitForTimeout(200);
  r.hitosGob = await n('.tbl tbody tr[data-t="hito"]');
  await p.screenshot({ path: '/tmp/t/fin-a.png' });
  // 1) Ficha de propuesta con Planificación e Hitos, filtro por categoría
  await p.evaluate(() => { UI.view = 'propuestas'; render(); selectEntity('ini', 'PRO-050', 'resumen'); }); await p.waitForTimeout(300);
  await p.click('button:has-text("Ficha")'); await p.waitForTimeout(400);
  r.tabsFicha = await p.$$eval('.fl2-tab', a => a.map(x => x.textContent.trim()).join('|'));
  r.planProp = await n('.fz-steps .fz-step'); r.ganttFicha = await n('.fz-box .fz-row');
  await p.screenshot({ path: '/tmp/t/fin-b.png' });
  r.chipsH = await n('.cat-chips [data-t="h"]'); await p.click('.cat-chips [data-t="h"][data-c="Entregable"]'); await p.waitForTimeout(250);
  r.filasHitoEntregable = await p.$$eval('.tbl tbody tr', a => a.filter(x => x.querySelector('[data-chg="hitotoggle"]')).length);
  r.chipsR = await n('.cat-chips [data-t="r"]');
  // hito form tiene categoría
  await p.evaluate(() => Acts.new({ t: 'hito', ini: 'PRO-050' })); await p.waitForTimeout(200); r.campoCat = await n('#f_cat option');
  // V22.57 · Tabla y Tablero con ambos tipos; panel de propuesta con Hitos; propuesta sin fechas tentativas igual muestra fases
  await p.evaluate(() => { Modal.close && Modal.close(); UI.view = 'portfolio'; render(); }); await p.waitForTimeout(250);
  await p.screenshot({ path: '/tmp/t/fin-tabla.png' }); r.tablaCols = await p.$$eval('.tbl thead th', a => a.map(x => x.textContent.trim()).filter(Boolean).join('|')); r.menuIni = await p.evaluate(() => document.body.innerText.includes('Pipeline de propuestas'));
  r.tablaIds = await p.$$eval('tr[data-t="ini"]', a => a.map(x => x.dataset.id).filter(id => /050/.test(id)).sort().join(','));
  await p.evaluate(() => { UI.view = 'proyectos'; F('prj', {}).mode = 'board'; render(); }); await p.waitForTimeout(250);
  await p.screenshot({ path: '/tmp/t/fin-tablero.png' }); r.tableroCols = await p.$$eval('.kcol', a => a.length); r.tableroProp = await p.$$eval('.kcol[data-fase="Evaluación"] .icard', a => a.map(x => x.dataset.id).join(','));
  await p.evaluate(() => { const b = St.ini.find(x => x.id === 'PRO-050'); St.ini.push(Object.assign({}, b, { id: 'PRO-051', titulo: 'Propuesta sin fechas', inicioPlan: null, finPlan: null, creada: '2026-10-01' }));
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRO-051', nombre: 'Evaluar', fase: 'Evaluación', fecha: '2026-10-25', completado: false, resp: 'Christian Tolosa' }); selectEntity('ini', 'PRO-051', 'resumen'); }); await p.waitForTimeout(300);
  r.panelTabs = await p.$$eval('#panel [role=tab], #panel .tabs button', a => a.map(x => x.textContent.trim()).join('|'));
  await p.click('button:has-text("Ficha")'); await p.waitForTimeout(400); r.sinFechasPasos = await p.$$eval('.fz-steps .fz-step small', a => a[0] ? a[0].textContent : ''); r.sinFechasGantt = await p.$$eval('.fz-box .fz-row', a => a.length);
  await p.screenshot({ path: '/tmp/t/fin-c.png' });
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.ganttAmbos.includes('PRJ-050') && r.ganttAmbos.includes('PRO-050') && r.ganttProp.includes('PRO-050') && !r.ganttProp.includes('PRJ-050') && ['roadmap', 'fases', 'hitos', 'riesgos'].every(v => r['seg_' + v] === 3) && r.roadmapProp && r.fasesProp === 4
    && r.hitosGob === r.hitosGobEsperado && r.hitosGob < r.hitosTodos && r.hitosTodos === 25 && /Planificación/.test(r.tabsFicha) && /Hitos/.test(r.tabsFicha) && r.planProp === 4 && r.ganttFicha > 1 && r.chipsH >= 3 && r.filasHitoEntregable === 2 && r.campoCat === 8 && r.tablaIds === 'PRJ-050,PRO-050' && [5, 8].includes(r.tableroCols) && r.tableroProp === 'PRO-050' && /Hitos/.test(r.panelTabs) && /^01-10/.test(r.sinFechasPasos) && r.sinFechasGantt > 1 && !errs.length;
  console.log(ok ? 'OK fin1' : 'FALLA fin1'); await b.close(); process.exit(ok ? 0 : 1);
})();
