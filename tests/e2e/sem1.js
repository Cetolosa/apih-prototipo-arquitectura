// C2.28 · «Tus siguientes pasos» por importancia, ajuste propio persistente y pendientes personales (Mi cocina)
const { chromium, launchOpts } = require('./_pw');
const plan = require('../../docs/seed/iniciativas-sinteticas.json').iniciativas[0];
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(x => { celebrar = () => {}; UI.uiOv = 'pro';
    const n = Object.assign({ id: 'PRJ-050', legacy: '', creada: '2026-10-15', faseDesde: '2026-10-15', origen: 'importación', est: [], hist: [['2026-10-15', x.avance]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], actualizada: '2026-10-16' }, x); delete n.hitos; delete n.riesgos; St.ini.push(n);
    x.hitos.forEach(h => St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase, fecha: h.fecha, completado: !!h.completado, fechaReal: h.completado ? h.fecha : null, resp: h.resp }));
    x.riesgos.forEach(r => St.riesgos.push(Object.assign({ id: nextId('RSK', St.riesgos), ini: n.id }, r)));
    }, plan);
  await p.evaluate(async () => { save(); await DataService.flush(); await DataService.refresh(false, true); render(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); });
  await p.waitForTimeout(500);
  const pts = () => p.$$eval('.ps-card .ps-it', a => a.map(x => ({ k: x.querySelector('.ps-aj') ? x.querySelector('.ps-aj').dataset.k : null, pt: +x.querySelector('.ps-pt').textContent })));
  const r = {};
  // 1) orden por importancia (no creciente) y puntaje visible en cada paso
  r.antes = await pts(); r.ordenado = r.antes.length >= 3 && r.antes.every((x, i, a) => i === 0 || a[i - 1].pt >= x.pt);
  const ultimo = r.antes[r.antes.length - 1];
  // 2) ajuste propio «Máxima»: el paso sube y el puntaje refleja el ajuste
  await p.locator('.ps-card .ps-aj').last().selectOption('30'); await p.waitForTimeout(400);
  r.despues = await pts(); const mov = r.despues.find(x => x.k === ultimo.k);
  r.sube = !!mov && mov.pt === Math.min(100, ultimo.pt + 30) && r.despues.every((x, i, a) => i === 0 || a[i - 1].pt >= x.pt);
  // 3) el ajuste queda en el perfil y sobrevive a recargar (viaja por el servidor, no por el navegador)
  r.guardado = await p.evaluate(() => (semOf().aj || {}));
  await p.waitForTimeout(800); await p.reload(); await p.waitForTimeout(1800);
  r.trasRecarga = await p.evaluate(k => (semOf().aj || {})[k], ultimo.k);
  r.sinLocal = await p.evaluate(() => localStorage.getItem('apih_posp') === null);
  // 4) pendiente personal clasificado: aparece mezclado, no toca los tenedores
  await p.evaluate(x => { celebrar = () => {}; UI.uiOv = 'pro'; const n = Object.assign({ id: 'PRJ-050', legacy: '', creada: '2026-10-15', faseDesde: '2026-10-15', origen: 'importación', est: [], hist: [['2026-10-15', x.avance]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], actualizada: '2026-10-16' }, x); delete n.hitos; delete n.riesgos; if (!byId('PRJ-050')) { St.ini.push(n); x.hitos.forEach(h => St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase, fecha: h.fecha, completado: !!h.completado, fechaReal: h.completado ? h.fecha : null, resp: h.resp })); x.riesgos.forEach(q => St.riesgos.push(Object.assign({ id: nextId('RSK', St.riesgos), ini: n.id }, q))); } UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); }, plan);
  await p.waitForTimeout(500);
  r.offAntes = await p.evaluate(() => cieloPersona(miUsuario()).off);
  await p.click('.ps-card [data-act="tareanew"]'); await p.waitForTimeout(300);
  await p.fill('#f_t', 'Curso de liderazgo ágil'); await p.selectOption('#f_cat', 'Desarrollo profesional');
  await p.click('[data-act="msave"]'); await p.waitForTimeout(500);
  await p.evaluate(() => { F('cielo', {}).psAll = true; render(); }); await p.waitForTimeout(300);
  r.tarea = await p.$$eval('.ps-card .ps-it', a => a.filter(x => /Curso de liderazgo ágil/.test(x.textContent)).map(x => ({ tipo: x.querySelector('.mut').textContent, pers: /Pendiente personal/.test(x.textContent) })));
  r.chip = await p.$$eval('.ps-f button', a => a.map(x => x.textContent.trim()));
  r.offDespues = await p.evaluate(() => cieloPersona(miUsuario()).off);
  // 5) filtro «Mis pendientes» (se guarda en el perfil) y marcar hecho
  await p.click('.ps-f button:has-text("Mis pendientes")'); await p.waitForTimeout(300);
  r.soloPend = await p.$$eval('.ps-card .ps-it', a => a.length); r.ppGuardado = await p.evaluate(() => semOf().pp);
  await p.click('.ps-card [data-act="tareahecha"]'); await p.waitForTimeout(400);
  r.hechas = await p.evaluate(() => ({ abiertas: (semOf().t || []).filter(t => !t.hecha).length, hechas: (semOf().t || []).filter(t => t.hecha).length }));
  // 6) los pendientes personales no salen en el portafolio ni en los datos de presentación
  r.fueraPortafolio = await p.evaluate(() => !JSON.stringify([St.ini, St.hitos, St.riesgos, St.compromisos, St.decisiones]).includes('Curso de liderazgo ágil'));
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.ordenado && r.sube && r.guardado[ultimo.k] === 30 && r.trasRecarga === 30 && r.sinLocal
    && r.tarea.length === 1 && r.tarea[0].tipo === 'Desarrollo profesional' && r.tarea[0].pers && r.chip.some(c => /^Mis pendientes \(1\)$/.test(c)) && r.offAntes === r.offDespues
    && r.soloPend === 1 && r.ppGuardado === '__per' && r.hechas.abiertas === 0 && r.hechas.hechas === 1 && r.fueraPortafolio && !r.scrollX && !errs.length;
  console.log(ok ? 'OK sem1' : 'FALLA sem1'); await b.close(); process.exit(ok ? 0 : 1);
})();
