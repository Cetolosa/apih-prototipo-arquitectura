// C2.32 · «Tus siguientes pasos» en grilla compacta: 3/2/1 columnas según ancho, sin scroll horizontal, puntaje = control de importancia, ocultar como icono
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const me = miUsuario(), H = hoy();
    St.ini.push({ id: 'PRJ-951', legacy: '', tipo: 'Proyecto', titulo: 'Proyecto con un nombre bastante largo para forzar el recorte del encabezado', area: 'BISE', lider: me, estado: 'En curso', fase: 'Ejecución', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', avance: 40, creada: addD(H, -400), faseDesde: addD(H, -100), origen: 'importación', est: [], hist: [[addD(H, -50), 40]], tags: [], deps: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: addD(H, -300), inicioPlan: addD(H, -300), finPlan: addD(H, 100), propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, actualizada: addD(H, -1), michelin: [] });
    for (let i = 0; i < 6; i++) St.hitos.push({ id: nextId('HIT', St.hitos), ini: 'PRJ-951', nombre: 'Hito vencido con un nombre largo número ' + i + ' para probar el recorte a dos líneas', fase: 'Ejecución', fecha: addD(H, -3 - i), completado: false, resp: me });
    UI.view = 'cielo'; F('cielo', {}).tab = 'sem'; F('cielo', {}).psAll = true; render();
  });
  await p.waitForTimeout(500);
  const r = {}, cols = () => p.evaluate(() => { const g = document.querySelector('.ps-gr'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0; });
  r.n = await p.$$eval('.ps-gr .ps-it', a => a.length); r.cols1600 = await cols();
  await p.setViewportSize({ width: 1100, height: 900 }); await p.waitForTimeout(300); r.cols1100 = await cols();
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); r.cols390 = await cols(); r.scrollX = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await p.setViewportSize({ width: 1600, height: 1000 }); await p.waitForTimeout(300);
  // el puntaje es el control: select dentro de la insignia, ocultar con aria-label
  r.ctl = await p.$$eval('.ps-gr .ps-it', a => a.every(x => x.querySelector('.ps-ptw .ps-aj') && x.querySelector('[data-act="pasopos"][aria-label="Ocultar hasta mañana"]')));
  r.sinDesborde = await p.$$eval('.ps-gr .ps-it', a => a.every(x => x.scrollWidth <= x.clientWidth + 1));
  r.alturaIgual = await p.evaluate(() => { const hs = [...document.querySelectorAll('.ps-gr .ps-it')].slice(0, 3).map(x => Math.round(x.getBoundingClientRect().height)); return Math.max(...hs) - Math.min(...hs) <= 1; });
  const p0 = await p.$eval('.ps-gr .ps-it .ps-pt', e => +e.textContent);
  await p.locator('.ps-gr .ps-it .ps-aj').first().selectOption('30'); await p.waitForTimeout(400);
  r.ajusta = await p.evaluate(() => [...document.querySelectorAll('.ps-gr .ps-it .ps-pt')].some(e => +e.textContent > 0)) && p0 >= 0;
  const n0 = r.n; await p.click('.ps-gr [data-act="pasopos"]'); await p.waitForTimeout(400); r.oculta = await p.$$eval('.ps-gr .ps-it', a => a.length) === n0 - 1;
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.n >= 6 && r.cols1600 === 3 && r.cols1100 === 2 && r.cols390 === 1 && !r.scrollX && r.ctl && r.sinDesborde && r.alturaIgual && r.ajusta && r.oculta && !errs.length;
  console.log(ok ? 'OK grid1' : 'FALLA grid1'); await b.close(); process.exit(ok ? 0 : 1);
})();
