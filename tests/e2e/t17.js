const { chromium, launchOpts } = require('./_pw');
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1500, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(() => { St.ini.push({ id: 'PRJ-003', tipo: 'Proyecto', legacy: '', creada: hoy(), faseDesde: hoy(), origen: 'usuario', est: [], hist: [[hoy(), 40]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [], estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Alta', area: 'BISE', lider: 'Christian Tolosa', sponsor: 'X', titulo: 'Portal', avance: 40, actualizada: hoy(), desc: 'x' }); go('proyectos'); UI.sel = { t: 'ini', id: 'PRJ-003' }; UI.panel = true; render(); });
  await p.waitForTimeout(600); await p.click('[data-id=pop-ptools]'); await p.waitForTimeout(200);
  const items = await p.evaluate(() => document.querySelector('#pop-ptools').innerText.replace(/\n+/g, ' | '));
  await p.click('#pop-ptools button >> nth=1'); await p.waitForTimeout(500);
  const modal = await p.evaluate(() => !!document.querySelector('#modal'));
  console.log(JSON.stringify({ items, modal, errs })); await b.close();
})();
