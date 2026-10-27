// C2.30 · «Qué cambió desde tu última visita» (Mi cocina): vencidos, compromisos nuevos, cambios de otras personas; «Entendido»; primera visita; solo lo propio
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = {};
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy(), mk = (id, o) => Object.assign({ id, legacy: '', tipo: 'Proyecto', titulo: id, area: 'BISE', lider: me, estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', avance: 40, creada: addD(H, -400), faseDesde: addD(H, -100), origen: 'importación', est: [], hist: [[addD(H, -50), 40]], tags: [], deps: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: addD(H, -300), inicioPlan: addD(H, -300), finPlan: addD(H, 100), propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, actualizada: addD(H, -1), michelin: [] }, o);
    St.ini.push(mk('PRJ-901', { titulo: 'Proyecto mío' })); St.ini.push(mk('PRJ-904', { titulo: 'Proyecto ajeno', lider: 'Otra Persona' }));
    window.__ant = addD(H, -10) + 'T09:00';
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-901', nombre: 'Hito vencido nuevo', fase: 'Ejecución', fecha: addD(H, -3), completado: false, resp: me });
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-901', nombre: 'Hito que ya estaba vencido', fase: 'Ejecución', fecha: addD(H, -20), completado: false, resp: me });
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-904', nombre: 'Hito vencido ajeno', fase: 'Ejecución', fecha: addD(H, -3), completado: false, resp: 'Otra Persona' });
    St.compromisos.push({ id: nextId('ACU', St.compromisos), texto: 'Compromiso mío que venció', resp: me, de: 'Jefa', limite: addD(H, -2), ini: 'PRJ-901', tema: '', estado: 'Abierto', fechaReal: null, creada: addD(H, -30), origen: 'manual' });
    St.compromisos.push({ id: nextId('ACU', St.compromisos), texto: 'Compromiso recién asignado', resp: me, de: 'Jefa', limite: addD(H, 5), ini: 'PRJ-901', tema: '', estado: 'Abierto', fechaReal: null, creada: addD(H, -1), origen: 'manual' });
    St.bitacora.unshift({ id: 'BIT-x1', ts: addD(H, -2) + 'T10:00', tipo: 'Cambio', ini: 'PRJ-901', autor: 'Colega Uno', texto: 'Cambió la fecha del hito X', meta: null });
    St.bitacora.unshift({ id: 'BIT-x2', ts: addD(H, -2) + 'T11:00', tipo: 'Cambio', ini: 'PRJ-901', autor: 'Colega Dos', texto: '<img src=x onerror="window.__xss=1">', meta: null });
    St.bitacora.unshift({ id: 'BIT-x3', ts: addD(H, -2) + 'T12:00', tipo: 'Cambio', ini: 'PRJ-901', autor: me, texto: 'Cambio hecho por mí', meta: null });
    St.bitacora.unshift({ id: 'BIT-x4', ts: addD(H, -2) + 'T13:00', tipo: 'Cambio', ini: 'PRJ-904', autor: 'Colega Uno', texto: 'Cambio en proyecto ajeno', meta: null });
    St.bitacora.unshift({ id: 'BIT-x5', ts: addD(H, -20) + 'T13:00', tipo: 'Cambio', ini: 'PRJ-901', autor: 'Colega Uno', texto: 'Cambio anterior a la visita', meta: null });
    UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render();
  });
  await p.waitForTimeout(500);
  // 1) primera visita: queda la base y no hay aviso
  r.base = await p.evaluate(() => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(semOf().visita || '')); r.sinAvisoPrimera = await p.$$eval('#main .ps-card h2', a => !a.some(x => /Qué cambió/.test(x.textContent)));
  // 2) con una visita anterior aparecen vencidos, nuevos y cambios de otros, solo de mis proyectos
  await p.evaluate(() => { cfgSet(miUsuario(), { sem: Object.assign({}, semOf(), { visita: window.__ant }) }); render(); }); await p.waitForTimeout(400);
  const txt = await p.evaluate(() => { const h = [...document.querySelectorAll('#main .ps-card')].find(c => /Qué cambió/.test(c.querySelector('h2').textContent)); return h ? h.textContent : ''; });
  r.hay = !!txt; r.vencidos = /Hito vencido nuevo/.test(txt) && /Compromiso mío que venció/.test(txt) && !/ya estaba vencido|vencido ajeno/.test(txt);
  r.nuevos = /Compromiso recién asignado/.test(txt); r.otros = /Cambió la fecha del hito X/.test(txt) && /Colega Uno/.test(txt) && !/hecho por mí|proyecto ajeno|anterior a la visita/.test(txt);
  r.cuentas = /2 vencidos/.test(txt) && /1 nuevo para ti/.test(txt) && /2 cambios de otras personas/.test(txt);
  r.xss = await p.evaluate(() => !window.__xss && !document.querySelector('#main img[src="x"]'));
  // 3) «Entendido» actualiza la visita y despeja el aviso
  await p.click('#main [data-act="cambvisto"]'); await p.waitForTimeout(500);
  r.despejado = await p.$$eval('#main .ps-card h2', a => !a.some(x => /Qué cambió/.test(x.textContent))); r.visitaNueva = await p.evaluate(() => semOf().visita > window.__ant);
  // 4) sin novedades no hay tarjeta; el aviso reaparece solo con lo posterior
  await p.evaluate(() => { St.bitacora.unshift({ id: 'BIT-y1', ts: nowTs(), tipo: 'Cambio', ini: 'PRJ-901', autor: 'Colega Tres', texto: 'Cambio posterior', meta: null }); cfgSet(miUsuario(), { sem: Object.assign({}, semOf(), { visita: addD(hoy(), 0) + 'T00:00' }) }); render(); }); await p.waitForTimeout(300);
  r.reaparece = await p.$$eval('#main .ps-card', a => a.some(c => /Qué cambió/.test(c.textContent) && /Cambio posterior/.test(c.textContent)));
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.base && r.sinAvisoPrimera && r.hay && r.vencidos && r.nuevos && r.otros && r.cuentas && r.xss && r.despejado && r.visitaNueva && r.reaparece && !r.scrollX && !errs.length;
  console.log(ok ? 'OK cam1' : 'FALLA cam1'); await b.close(); process.exit(ok ? 0 : 1);
})();
