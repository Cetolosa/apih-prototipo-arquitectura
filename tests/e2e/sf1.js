// V22.55 · Subfases por proyecto (ADR-012): heredan fechas de la fase, no salen de ella, se muestran en ficha, Fases, tablero y hito
const { chromium, launchOpts } = require('./_pw');
const plan = require('../../docs/seed/iniciativas-sinteticas.json').iniciativas[0];
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(x => { celebrar = () => {}; UI.uiOv = 'pro';
    const n = Object.assign({ id: 'PRJ-050', legacy: '', creada: '2026-10-15', faseDesde: '2026-10-15', origen: 'importación', est: [], hist: [['2026-10-15', x.avance]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], actualizada: '2026-10-16' }, x); delete n.hitos; delete n.riesgos; n.fase = 'Ejecución'; St.ini.push(n);
    x.hitos.forEach(h => St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase, fecha: h.fecha, completado: !!h.completado, fechaReal: h.completado ? h.fecha : null, resp: h.resp }));
    UI.view = 'fases'; render(); }, plan);
  await p.waitForTimeout(400);
  const r = {}, txt = s => p.$eval(s, e => e.textContent.trim()).catch(() => '');
  r.ventana = await p.evaluate(() => { const v = ventanaDe(byId('PRJ-050'), 'Ejecución'); return v.ini + '|' + v.fin; });
  // 1) nueva subfase: hereda las fechas de la fase
  await p.evaluate(() => Acts.sfnew({ id: 'PRJ-050', f: 'Ejecución' })); await p.waitForTimeout(200);
  r.hereda = await p.evaluate(() => $('#f_inicio').value + '|' + $('#f_fin').value);
  // 2) fuera de la fase: no se guarda
  await p.fill('#f_nombre', 'C2 · API y datos'); await p.fill('#f_fin', '2026-11-30'); await p.click('[data-act="msave"]'); await p.waitForTimeout(200);
  r.bloquea = await p.evaluate(() => !!$('#mform') && subfasesDe(byId('PRJ-050')).length === 0); r.msg = await txt('.toast.err:last-child span');
  // 3) dentro: se guarda
  await p.fill('#f_inicio', '2026-10-24'); await p.fill('#f_fin', '2026-11-05'); await p.click('[data-act="msave"]'); await p.waitForTimeout(200);
  // 4) vacía: hereda
  await p.evaluate(() => Acts.sfnew({ id: 'PRJ-050', f: 'Transición' })); await p.waitForTimeout(200);
  await p.fill('#f_nombre', 'UAT'); await p.fill('#f_inicio', ''); await p.fill('#f_fin', ''); await p.click('[data-act="msave"]'); await p.waitForTimeout(200);
  r.subs = await p.evaluate(() => subfasesDe(byId('PRJ-050')).map(s => s.fase + ':' + s.nombre + ':' + s.inicio + '>' + s.fin).join(' | '));
  r.uatHereda = await p.evaluate(() => { const s = subfasesDe(byId('PRJ-050'))[1], v = ventanaDe(byId('PRJ-050'), 'Transición'); return s.inicio === v.ini && s.fin === v.fin; });
  // 5) hito con subfase de otra fase: rechazado; de la misma: aceptado
  const h = await p.evaluate(() => St.hitos.find(x => x.ini === 'PRJ-050' && /^C2.0/.test(x.nombre)).id);
  await p.evaluate(id => Acts.edit({ t: 'hito', id }), h); await p.waitForTimeout(200);
  r.optsSub = await p.$$eval('#f_subfase option', a => a.length);
  await p.selectOption('#f_subfase', 'PRJ-050-SF2'); await p.click('[data-act="msave"]'); await p.waitForTimeout(200);
  r.rechazaOtraFase = await p.evaluate(id => !St.hitos.find(x => x.id === id).subfase && !!$('#mform'), h);
  await p.selectOption('#f_subfase', 'PRJ-050-SF1'); await p.click('[data-act="msave"]'); await p.waitForTimeout(200);
  r.asignado = await p.evaluate(id => St.hitos.find(x => x.id === id).subfase, h);
  // 6) vistas
  await p.click('[data-act="fzopen"][data-id="PRJ-050"]'); await p.waitForTimeout(300);
  r.filasGantt = await p.$$eval('.fz-sub', a => a.length);
  await p.screenshot({ path: '/tmp/t/sf-a.png', fullPage: true });
  await p.click('[data-act="fztab"][data-k="linea"]'); await p.evaluate(() => { F('fases', {}).id = 'PRJ-050'; render(); }); await p.waitForTimeout(300);
  r.chipsLinea = await p.$$eval('.sf-chip', a => a.length); r.gruposLinea = await p.$$eval('.sf-h', a => a.map(x => x.textContent.trim()).join(' | '));
  await p.screenshot({ path: '/tmp/t/sf-b.png', fullPage: true });
  await p.click('[data-act="fztab"][data-k="tablero"]'); await p.waitForTimeout(300); r.gruposTablero = await p.$$eval('.fz-col .sf-h', a => a.length);
  await p.evaluate(() => { UI.view = 'proyectos'; render(); selectEntity('ini', 'PRJ-050', 'resumen'); }); await p.waitForTimeout(400);
  r.tagPanel = await txt('.pn-h .fz-rng'); r.tagsTabla = await p.$$eval('.fz-rng', a => a.length);
  await p.screenshot({ path: '/tmp/t/sf-c.png' });
  await p.click('button:has-text("Ficha")'); await p.waitForTimeout(400); await p.click('text=Planificación >> nth=-1').catch(() => {}); await p.waitForTimeout(400);
  r.chipsFicha = await p.$$eval('.sf-grid .sf-chip', a => a.length); r.cabecera = await txt('.fl-ph .fz-rng'); await p.screenshot({ path: '/tmp/t/sf-d.png' });
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.hereda === r.ventana && r.bloquea && r.subs.split('|').length === 2 && r.uatHereda && r.optsSub === 3 && r.rechazaOtraFase && r.asignado === 'PRJ-050-SF1' && r.filasGantt === 6 && r.chipsLinea >= 1 && r.gruposTablero >= 2 && r.tagsTabla >= 1 && r.chipsFicha === 2 && !errs.length;
  console.log(ok ? 'OK sf1' : 'FALLA sf1'); await b.close(); process.exit(ok ? 0 : 1);
})();
