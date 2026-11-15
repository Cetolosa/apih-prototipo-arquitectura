// C2.38 · Foco de Mi cocina: elegir qué proyectos propios se muestran (pasos, qué cambió, tenedores, borrador semanal); se guarda en el perfil; «Ver todos» lo quita
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = {};
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy(), mk = (id, o) => Object.assign({ id, legacy: '', tipo: 'Proyecto', titulo: id, area: 'BISE', lider: me, estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', avance: 40, creada: addD(H, -400), faseDesde: addD(H, -100), origen: 'importación', est: [], hist: [[addD(H, -50), 40]], tags: [], deps: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: addD(H, -300), inicioPlan: addD(H, -300), finPlan: addD(H, 100), propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, actualizada: addD(H, -1), michelin: [], logros: '', proximos: '', issue: '' }, o);
    [['PRJ-901', 'Alfa'], ['PRJ-902', 'Beta'], ['PRJ-903', 'Gamma']].forEach(([id, n]) => {
      St.ini.push(mk(id, { titulo: 'Proyecto ' + n }));
      St.hitos.push({ id: nextId('HIT', St.hitos), ini: id, nombre: 'Hito vencido de ' + n, fase: 'Ejecución', fecha: addD(H, -3), completado: false, resp: me });
    });
    cfgSet(me, { sem: { visita: addD(H, -5) + 'T00:00' } });
  });
  await p.evaluate(async () => { await sembrarSt(); await DataService.refresh(false, true); render(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); }); await p.waitForTimeout(500);
  const btnTxt = () => p.$eval('#main [data-act="focoabrir"]', e => e.textContent.trim());
  const pasosIni = () => p.$$eval('#main .ps-gr .ps-ini', a => [...new Set(a.map(e => e.textContent.trim()))].sort());
  const chips = () => p.$$eval('#main .ps-f button', a => a.map(e => e.textContent.trim()));
  const platos = () => p.$$eval('#csout .cs-l b', a => a.map(e => e.textContent.trim()));   // solo los platos de tus proyectos (el Salón de chefs es colectivo y no se filtra)
  const cambios = () => p.evaluate(() => { const c = [...document.querySelectorAll('#main .ps-card')].find(s => /Qué cambió/.test(s.textContent)); return c ? c.textContent : ''; });
  const borrador = async () => { await p.click('#main [data-act="semrep"]'); await p.waitForTimeout(300); const t = await p.$eval('#txtcopy', e => e.value); await p.click('[data-act="mclose"]'); await p.waitForTimeout(200); return t; };
  // 1) sin foco: ves todo y el botón lo dice
  r.sinFoco = (await btnTxt()) === 'Foco: todos' && (await pasosIni()).length === 3;
  r.cambiosTodos = /Hito vencido de Alfa/.test(await cambios()) && /Hito vencido de Beta/.test(await cambios()) && /Hito vencido de Gamma/.test(await cambios());
  // 2) elegir solo Alfa: el diálogo parte sin marcas y accesible por etiqueta
  await p.click('#main [data-act="focoabrir"]'); await p.waitForTimeout(250);
  r.dialogo = await p.evaluate(() => { const m = document.querySelector('#modal'); const c = [...m.querySelectorAll('.foco-ck')]; return c.length >= 3 && c.every(x => !x.checked) && c.every(x => x.closest('label')); });
  await p.locator('#modal .foco-ck[value="PRJ-901"]').check(); await p.click('#modal [data-act="focook"]'); await p.waitForTimeout(500);
  r.boton1 = (await btnTxt()) === 'Foco: 1 de ' + await p.evaluate(() => proyActivos(miUsuario()).length);
  r.pasos1 = JSON.stringify(await pasosIni()) === JSON.stringify(['Proyecto Alfa']);
  r.chips1 = JSON.stringify(await chips()).includes('Proyecto Alfa') && !JSON.stringify(await chips()).includes('Proyecto Beta');
  r.tablero1 = JSON.stringify(await platos()) === JSON.stringify(['Proyecto Alfa']);
  const c1 = await cambios(); r.cambios1 = /Hito vencido de Alfa/.test(c1) && !/Hito vencido de Beta|Hito vencido de Gamma/.test(c1);
  const t1 = await borrador(); r.borrador1 = /1 proyecto\b/.test(t1) && /Proyecto Alfa/.test(t1) && !/Proyecto Beta|Proyecto Gamma/.test(t1);
  // 3) queda en el perfil (servidor): sobrevive a recargar los datos
  r.guardado = await p.evaluate(() => JSON.stringify(semOf().foco));
  await p.evaluate(async () => { F('cielo', {}).foco = undefined; await DataService.refresh(false, true); render(); }); await p.waitForTimeout(500);
  r.persiste = (await btnTxt()).startsWith('Foco: 1 de ') && JSON.stringify(await pasosIni()) === JSON.stringify(['Proyecto Alfa']);
  // 4) dos proyectos
  await p.click('#main [data-act="focoabrir"]'); await p.waitForTimeout(250);
  r.dialogoMarcado = await p.$eval('#modal .foco-ck[value="PRJ-901"]', e => e.checked);
  await p.locator('#modal .foco-ck[value="PRJ-903"]').check(); await p.click('#modal [data-act="focook"]'); await p.waitForTimeout(500);
  r.dos = JSON.stringify(await pasosIni()) === JSON.stringify(['Proyecto Alfa', 'Proyecto Gamma']);
  // 5) marcarlos todos equivale a ver todos
  await p.click('#main [data-act="focoabrir"]'); await p.waitForTimeout(250);
  await p.evaluate(() => document.querySelectorAll('#modal .foco-ck').forEach(x => { x.checked = true; })); await p.click('#modal [data-act="focook"]'); await p.waitForTimeout(500);
  r.todosMarcados = (await btnTxt()) === 'Foco: todos' && (await pasosIni()).length === 3 && await p.evaluate(() => JSON.stringify(semOf().foco)) === '[]';
  // 6) «Ver todos» quita el foco
  await p.click('#main [data-act="focoabrir"]'); await p.waitForTimeout(250); await p.locator('#modal .foco-ck[value="PRJ-902"]').check(); await p.click('#modal [data-act="focook"]'); await p.waitForTimeout(400);
  r.conFoco = (await pasosIni()).length === 1;
  await p.click('#main [data-act="focoabrir"]'); await p.waitForTimeout(250); await p.click('#modal [data-act="fococlear"]'); await p.waitForTimeout(500);
  r.verTodos = (await btnTxt()) === 'Foco: todos' && (await pasosIni()).length === 3;
  // 7) un foco con proyectos que ya no están activos no deja la pantalla vacía
  await p.evaluate(() => { F('cielo', {}).foco = ['PRJ-999']; render(); }); await p.waitForTimeout(300);
  r.fantasma = (await btnTxt()) === 'Foco: todos' && (await pasosIni()).length === 3;
  // 8) el botón solo está en la pestaña principal
  await p.evaluate(() => { F('cielo', {}).tab = 'his'; render(); }); await p.waitForTimeout(300);
  r.soloEnSem = await p.$$eval('#main [data-act="focoabrir"]', a => a.length === 0);
  await p.evaluate(() => { F('cielo', {}).tab = 'sem'; render(); }); await p.waitForTimeout(300);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(250);
  r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.sinFoco && r.cambiosTodos && r.dialogo && r.boton1 && r.pasos1 && r.chips1 && r.tablero1 && r.cambios1 && r.borrador1 && r.guardado === '["PRJ-901"]' && r.persiste && r.dialogoMarcado && r.dos && r.todosMarcados && r.conFoco && r.verTodos && r.fantasma && r.soloEnSem && !r.scrollX && !errs.length;
  console.log(ok ? 'OK foco1' : 'FALLA foco1'); await b.close(); process.exit(ok ? 0 : 1);
})();
