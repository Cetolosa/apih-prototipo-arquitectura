// C2.29 · Mi historial (Mi cocina): proyectos liderados, hitos/compromisos cumplidos, desarrollo profesional; rangos; exportación; solo lo propio; «Personal» nunca entra
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = {};
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy(), mk = (id, o) => Object.assign({ id, legacy: '', tipo: 'Proyecto', titulo: id, area: 'BISE', lider: me, estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', avance: 40, creada: addD(H, -400), faseDesde: addD(H, -100), origen: 'importación', est: [], hist: [[addD(H, -50), 40]], tags: [], deps: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: addD(H, -300), inicioPlan: addD(H, -300), finPlan: addD(H, 100), propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, actualizada: addD(H, -1), michelin: [] }, o);
    St.ini.push(mk('PRJ-901', { titulo: 'Proyecto vigente mío' }));
    St.ini.push(mk('PRJ-902', { titulo: 'Proyecto cerrado hace 2 meses', estado: 'Completado', fase: 'Cierre', avance: 100, finReal: addD(H, -60), michelin: [1, 2] }));
    St.ini.push(mk('PRJ-903', { titulo: 'Proyecto cerrado hace 2 años', estado: 'Completado', fase: 'Cierre', avance: 100, finReal: addD(H, -730), inicioReal: addD(H, -900), inicioPlan: addD(H, -900) }));
    St.ini.push(mk('PRJ-904', { titulo: 'Proyecto de otra persona', lider: 'Otra Persona' }));
    St.ini.push(mk('PRJ-905', { titulo: 'Proyecto Stand By mío', estado: 'Stand By', estadoMotivo: 'prueba' }));
    const h = (i, n, f, real) => St.hitos.push({ id: nextId('HIT', St.hitos), ini: i, nombre: n, fase: 'Ejecución', fecha: f, completado: true, fechaReal: real, resp: me });
    h('PRJ-901', 'Hito a tiempo', addD(H, -30), addD(H, -32)); h('PRJ-901', 'Hito con retraso', addD(H, -20), addD(H, -10)); h('PRJ-901', 'Hito antiguo', addD(H, -800), addD(H, -800)); h('PRJ-904', 'Hito ajeno', addD(H, -10), addD(H, -10));
    St.compromisos.push({ id: nextId('ACU', St.compromisos), texto: 'Compromiso cumplido mío', resp: me, de: 'X', limite: addD(H, -5), ini: null, tema: '', estado: 'Cumplido', fechaReal: addD(H, -4), creada: addD(H, -20), origen: 'manual' });
    St.compromisos.push({ id: nextId('ACU', St.compromisos), texto: 'Compromiso cumplido de otro', resp: 'Otra Persona', de: 'X', limite: addD(H, -5), ini: null, tema: '', estado: 'Cumplido', fechaReal: addD(H, -4), creada: addD(H, -20), origen: 'manual' });
    cfgSet(me, { sem: { t: [
      { id: 'T-1', t: 'Curso de liderazgo ágil', cat: 'Desarrollo profesional', f: '', creada: addD(H, -20), hecha: addD(H, -15) },
      { id: 'T-2', t: 'Seminario de datos', cat: 'Desarrollo profesional', f: '', creada: addD(H, -900), hecha: addD(H, -800) },
      { id: 'T-3', t: 'Pagar el arriendo', cat: 'Personal', f: '', creada: addD(H, -20), hecha: addD(H, -2) },
      { id: 'T-4', t: 'Preparar comité', cat: 'Trabajo', f: '', creada: addD(H, -20), hecha: addD(H, -3) },
      { id: 'T-5', t: 'Pendiente aún abierto', cat: 'Desarrollo profesional', f: '', creada: addD(H, -2), hecha: '' }] } });
    UI.view = 'cielo'; F('cielo', {}).tab = 'his'; render();
  });
  await p.waitForTimeout(500);
  const kpis = () => p.$$eval('#main .kpi.sm', a => a.map(x => x.querySelector('.k-v').textContent.trim()));
  const resumen = () => p.evaluate(() => hisTxt(miUsuario(), F('cielo', {}).hr || '12m'));
  // 1) pestaña y rango por defecto (12 meses)
  r.tab = await p.$$eval('#main .seg [data-act="cielotab"]', a => a.map(x => x.textContent.trim()));
  r.kpis12 = await kpis();   // proyectos, hitos, compromisos, desarrollo
  const t12 = await resumen();
  // 2) solo lo propio; Personal fuera; lo antiguo fuera; Stand By fuera
  r.propio = /Proyecto vigente mío/.test(t12) && /Proyecto cerrado hace 2 meses/.test(t12) && !/otra persona/i.test(t12) && !/hace 2 años/.test(t12) && !/Stand By mío/.test(t12);
  r.hitos = /Hito a tiempo/.test(t12) && /Hito con retraso/.test(t12) && !/Hito antiguo|Hito ajeno/.test(t12) && /Hitos cumplidos: 2 \(1 a tiempo\)/.test(t12);
  r.comp = /Compromiso cumplido mío/.test(t12) && !/de otro/.test(t12);
  r.dev = /Curso de liderazgo ágil/.test(t12) && !/Seminario de datos|aún abierto/.test(t12);
  r.personalFuera = !/arriendo/.test(t12) && /Preparar comité/.test(t12);
  r.estrellas = /2 estrellas Michelin/.test(t12);
  // 3) rango «Todo» trae lo antiguo
  await p.click('#main [data-act="hisr"][data-k="todo"]'); await p.waitForTimeout(300);
  const tT = await resumen(); r.todo = /Proyecto cerrado hace 2 años/.test(tT) && /Seminario de datos/.test(tT) && /Hito antiguo/.test(tT) && !/arriendo/.test(tT);
  r.kpisTodo = await kpis();
  // 4) exportar: descarga .md con el contenido
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#main [data-act="hisdl"]')]);
  r.archivo = dl.suggestedFilename(); const fs = require('fs'); const ruta = await dl.path(); r.contenidoOk = fs.readFileSync(ruta, 'utf8').startsWith('# Resumen de logros');
  // 5) sin cuarta fila de KPIs mal armada ni scroll horizontal en móvil; el rango y la pestaña se muestran
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  // 6) texto con HTML no se inyecta
  await p.evaluate(() => { St.ini.find(i => i.id === 'PRJ-901').titulo = '<img src=x onerror="window.__xss=1">'; render(); }); await p.waitForTimeout(300);
  r.xss = await p.evaluate(() => !window.__xss && !document.querySelector('#main img[src="x"]'));
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.tab.includes('Mi historial') && r.kpis12.join() === '2,2,1,1' && r.propio && r.hitos && r.comp && r.dev && r.personalFuera && r.estrellas && r.todo && r.kpisTodo.join() === '3,3,1,2'
    && /^APIH_logros_\d{4}-\d{2}-\d{2}\.md$/.test(r.archivo) && r.contenidoOk && !r.scrollX && r.xss && !errs.length;
  console.log(ok ? 'OK his1' : 'FALLA his1'); await b.close(); process.exit(ok ? 0 : 1);
})();
