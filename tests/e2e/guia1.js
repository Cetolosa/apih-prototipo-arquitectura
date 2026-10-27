// V22.64 · Toda pantalla tiene «Cómo operar esta pantalla» (mismo formato que el Dashboard), accesible solo desde «?»;
// «Reglas del juego» de Mi cocina vive en «?» y ya no es una pestaña.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const VIEWS = ['dashboard', 'cielo', 'portfolio', 'proyectos', 'gantt', 'fases', 'roadmap', 'calendario', 'hitos', 'capacidad', 'riesgos', 'propuestas', 'comite', 'decisiones', 'compromisos', 'cambios', 'presentaciones', 'personas', 'admin', 'bitacora', 'miconfig', 'ia', 'proposito', 'ficha'];
  await p.evaluate(() => { UI.uiOv = 'pro'; celebrar = () => {}; let i = St.ini.find(x => x.tipo === 'Proyecto'); if (!i) { i = { id: 'PRJ-901', tipo: 'Proyecto', titulo: 'Para la guía', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', lider: 'Tester', area: 'BISE', avance: 0, presupuesto: 0, deps: [], tags: [], hist: [], est: [], creada: hoy(), faseDesde: hoy(), actualizada: hoy(), inicioPlan: hoy(), finPlan: addD(hoy(), 60), finEst: addD(hoy(), 60) }; St.ini.push(i); } window.__fid = i.id; });
  const res = [];
  const hayIA = await p.evaluate(() => typeof puedeUsarIA !== 'function' || puedeUsarIA());   /* IA solo existe si está habilitada (en Corporativo aún no) */
  for (const v of VIEWS) {
    if (v === 'ia' && !hayIA) continue;
    await p.evaluate(v => { UI.guiaOpen = {}; if (v === 'ficha') Acts.ficha({ id: window.__fid }); else go(v); }, v); await p.waitForTimeout(250);
    const antes = await p.evaluate(() => ({ view: UI.view, panel: !!document.querySelector('.guia'), flt: !!document.querySelector('.flt-guia'), min: !!document.querySelector('.guia-min') }));
    await p.click('#v22-help'); await p.waitForTimeout(150);
    const btn = p.locator('.v22-hp button', { hasText: 'Cómo operar esta pantalla' });
    const hay = await btn.count();
    if (hay) { await btn.first().click(); await p.waitForTimeout(250); }
    const d = await p.evaluate(() => { const g = document.querySelector('.guia'); return g ? { titulo: g.querySelector('header b').textContent.trim(), pasos: g.querySelectorAll('li').length, cerrar: !!g.querySelector('[data-m="off"]') } : null; });
    res.push({ v, vista: antes.view, abiertaSola: antes.panel, accesosExtra: antes.flt || antes.min, boton: hay, guia: d });
  }
  const bad = res.filter(r => r.vista !== r.v || r.abiertaSola || r.accesosExtra || !r.boton || !r.guia || !/^Cómo operar /.test(r.guia.titulo) || r.guia.pasos < 3 || !r.guia.cerrar);
  console.log(JSON.stringify(res.map(r => [r.v, r.guia && r.guia.pasos, r.guia && r.guia.titulo])));
  // Mi cocina: «Reglas del juego» en «?», sin pestaña «Cómo funciona»
  await p.evaluate(() => { UI.guiaOpen = {}; go('cielo'); }); await p.waitForTimeout(250);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('#main .seg [data-act="cielotab"]')].map(e => e.textContent.trim()));
  await p.click('#v22-help'); await p.waitForTimeout(150);
  const rj = p.locator('.v22-hp button', { hasText: 'Reglas del juego' }); const hayRJ = await rj.count();
  if (hayRJ) { await rj.first().click(); await p.waitForTimeout(250); }
  const reglas = await p.evaluate(() => ({ h1: (document.querySelector('#main h1, #main .ph h1, #main h2') || {}).textContent, texto: document.querySelector('#main').textContent.includes('Los 5 tenedores de la semana'), volver: !!document.querySelector('[data-act="cielotab"][data-k="sem"]') }));
  const otra = await p.evaluate(() => { go('dashboard'); const x = document.querySelector('#main').textContent; return /Cómo funciona/.test(x); });
  const ok = !bad.length && !tabs.some(t => /Cómo funciona/.test(t)) && tabs.length === 4 && tabs.includes('Mi historial') && hayRJ && reglas.texto && reglas.volver && !otra && !errs.length;
  console.log(JSON.stringify({ malas: bad, tabsCocina: tabs, reglas, errores: errs }));
  console.log(ok ? 'OK guia1' : 'FALLA guia1'); await b.close(); process.exit(ok ? 0 : 1);
})();
