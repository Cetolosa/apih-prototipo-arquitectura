// C2.31 · Borrador del reporte semanal (Mi cocina): proyectos propios vigentes, filtro por proyecto, hitos cumplidos 7 días, sin pendientes personales, sin inyección
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = {};
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy(), mk = (id, o) => Object.assign({ id, legacy: '', tipo: 'Proyecto', titulo: id, area: 'BISE', lider: me, estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', avance: 40, creada: addD(H, -400), faseDesde: addD(H, -100), origen: 'importación', est: [], hist: [[addD(H, -50), 40]], tags: [], deps: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: addD(H, -300), inicioPlan: addD(H, -300), finPlan: addD(H, 100), propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, actualizada: addD(H, -1), michelin: [], logros: '', proximos: '', issue: '' }, o);
    St.ini.push(mk('PRJ-901', { titulo: 'Proyecto Alfa', logros: 'Cerramos el piloto', proximos: 'Desplegar a producción' }));
    St.ini.push(mk('PRJ-902', { titulo: 'Proyecto Beta', issue: '<img src=x onerror="window.__xss=1">' }));
    St.ini.push(mk('PRJ-904', { titulo: 'Proyecto de Otra Persona', lider: 'Otra Persona' }));
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-901', nombre: 'Hito reciente', fase: 'Ejecución', fecha: addD(H, -3), completado: true, fechaReal: addD(H, -2), resp: me });
    St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-901', nombre: 'Hito de hace un mes', fase: 'Ejecución', fecha: addD(H, -30), completado: true, fechaReal: addD(H, -29), resp: me });
    cfgSet(me, { sem: { visita: nowTs(), t: [{ id: 'T-1', t: 'Pendiente personal secreto', cat: 'Personal', f: '', creada: H, hecha: '' }] } });
  });
  await p.evaluate(async () => { save(); await DataService.flush(); await DataService.refresh(false, true); render(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; render(); });
  await p.waitForTimeout(500);
  const abrir = async () => { await p.click('#main [data-act="semrep"]'); await p.waitForTimeout(300); const t = await p.$eval('#txtcopy', e => e.value); return t; };
  const cerrar = async () => { await p.click('[data-act="mclose"]'); await p.waitForTimeout(200); };
  // 1) todos mis proyectos vigentes, no los ajenos; hitos cumplidos de 7 días; sin personales
  r.boton = await p.$$eval('#main [data-act="semrep"]', a => a.length);
  const t1 = await abrir();
  r.cabecera = /^REPORTE SEMANAL · /.test(t1) && /2 proyectos/.test(t1);
  r.proy = /Proyecto Alfa/.test(t1) && /Proyecto Beta/.test(t1) && !/Otra Persona/.test(t1);
  r.logros = /Cerramos el piloto/.test(t1) && /Desplegar a producción/.test(t1);
  r.hitos = /HITOS CUMPLIDOS EN LOS ÚLTIMOS 7 DÍAS/.test(t1) && /Hito reciente/.test(t1) && !/Hito de hace un mes/.test(t1);
  r.sinPersonal = !/secreto/.test(t1);
  r.copiar = await p.$$eval('[data-act="copiartxt"]', a => a.length);
  r.xss = await p.evaluate(() => !window.__xss && !document.querySelector('.modal img[src="x"], img[src="x"]'));
  await cerrar();
  // 2) con filtro por proyecto solo sale ese
  await p.evaluate(() => { F('cielo', {}).pp = 'PRJ-901'; render(); }); await p.waitForTimeout(300);
  const t2 = await abrir(); r.filtro = /1 proyecto\b/.test(t2) && /Proyecto Alfa/.test(t2) && !/Proyecto Beta/.test(t2); await cerrar();
  // 3) sin proyectos vigentes: no abre el borrador y avisa
  await p.evaluate(async () => { St.ini.forEach(i => { if (i.lider === miUsuario()) i.estado = 'Completado'; }); save(); await DataService.flush(); await DataService.refresh(false, true); F('cielo', {}).pp = ''; render(); }); await p.waitForTimeout(300);
  r.sinBotonSinProy = await p.$$eval('#main [data-act="semrep"]', a => a.length === 0);
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.boton === 1 && r.cabecera && r.proy && r.logros && r.hitos && r.sinPersonal && r.copiar === 1 && r.xss && r.filtro && r.sinBotonSinProy && !r.scrollX && !errs.length;
  console.log(ok ? 'OK rsem1' : 'FALLA rsem1'); await b.close(); process.exit(ok ? 0 : 1);
})();
