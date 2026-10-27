// V22.54 · Planificación en la ficha + Siguientes pasos (ficha y Mi cocina)
const { chromium, launchOpts } = require('./_pw');
const plan = require('../../docs/seed/iniciativas-sinteticas.json').iniciativas[0];
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  // Fecha fija: los pasos dependen de «hoy»; el plan sintético se calibra para el 2026-10-23.
  await p.clock.setFixedTime(new Date('2026-10-23T12:00:00'));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(x => { celebrar = () => {}; UI.uiOv = 'pro';
    const n = Object.assign({ id: 'PRJ-050', legacy: '', creada: '2026-10-15', faseDesde: '2026-10-15', origen: 'importación', est: [], hist: [['2026-10-15', x.avance]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], actualizada: '2026-10-16' }, x); delete n.hitos; delete n.riesgos; St.ini.push(n);
    x.hitos.forEach(h => St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase, fecha: h.fecha, completado: !!h.completado, fechaReal: h.completado ? h.fecha : null, resp: h.resp }));
    x.riesgos.forEach(r => St.riesgos.push(Object.assign({ id: nextId('RSK', St.riesgos), ini: n.id }, r)));
    n.lider = St.cfg.usuario; const R = St.riesgos.filter(r => r.ini === n.id); R[0].fRev = '2026-10-20'; R[1].fRev = '2026-10-26'; R[2].fRev = '2026-10-19';   // dos revisiones vencidas y una próxima: 6+ pasos, para que al posponer uno entre el siguiente
    UI.view = 'fases'; render(); }, plan);
  await p.waitForTimeout(500);
  const r = {};
  await p.evaluate(() => { Acts.ficha({ id: 'PRJ-050' }); }); await p.waitForTimeout(600);
  await p.evaluate(() => { const b = document.querySelector('[data-act="fltab"][data-k="pla"]'); b && b.click(); }); await p.waitForTimeout(500);
  r.tabPla = await p.$$eval('[data-act="fltab"][data-k="pla"]', a => a.length);
  r.pasosFicha = await p.$$eval('.ps-it', a => a.map(x => x.querySelector('.ps-t').textContent));
  r.pasos = await p.$$eval('.ps-it', a => a.length); r.fasesFicha = await p.$$eval('.fz-step', a => a.length); r.ganttFicha = await p.$$eval('.fz-sub', a => a.length);
  await p.screenshot({ path: '/tmp/t/ps-ficha.png', fullPage: true });
  await p.evaluate(() => { UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); }); await p.waitForTimeout(500);
  r.cocina = await p.$$eval('.ps-card .ps-it', a => a.length); r.ban = await p.$$eval('.ps-ban', a => a.map(x => x.textContent.trim()));
  await p.screenshot({ path: '/tmp/t/ps-cocina.png', fullPage: true });
  const n0 = r.cocina; await p.evaluate(() => { const b = document.querySelector('.ps-card [data-act="pasopos"]'); b && b.click(); }); await p.waitForTimeout(300);
  r.trasPosponer = await p.$$eval('.ps-card .ps-it', a => a.length);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.tabPla === 1 && r.pasos >= 4 && r.fasesFicha === 4 && r.ganttFicha === 4 && r.cocina >= 3 && r.cocina === 5 && r.trasPosponer === 5 && !r.scrollX && !errs.length;
  console.log(ok ? 'OK ps1' : 'FALLA ps1'); await b.close(); process.exit(ok ? 0 : 1);
})();
