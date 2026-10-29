// Cambiar etapa: avanzar de fase reprograma el plan desde hoy (fases, fin del proyecto y subfases).
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { celebrar = () => {};
    const mk = (id, x) => { St.ini.push(Object.assign({ id, titulo: id, area: 'TI', tipo: 'Proyecto', fase: 'Planificación', estado: 'En curso', rag: 'Verde', sponsor: 'S', lider: 'L', presupuesto: 100, categoria: 'Tecnología', inicioPlan: '2026-01-01', finPlan: '2026-04-10', creada: '2026-01-01', faseDesde: '2026-01-01', actualizada: '2026-01-01', est: [], tags: [], deps: [], hist: [], avance: 0 }, x)); };
    const H = hoy(), d = n => addD(H, n), F = (a, b, c, e, f, g, h, k) => ({ 'Planificación': { ini: d(a), fin: d(b) }, 'Ejecución': { ini: d(c), fin: d(e) }, 'Transición': { ini: d(f), fin: d(g) }, 'Cierre': { ini: d(h), fin: d(k) } });
    ['EP-1', 'EP-2'].forEach(id => { mk(id, { fasesFechas: F(-40, -26, -25, 30, 31, 45, 46, 60), inicioPlan: d(-40), finPlan: d(60), subfases: [{ id: id + '-SF1', nombre: 'S1', fase: 'Ejecución', inicio: d(-25), fin: d(-5) }] }); });
    ['EP-1', 'EP-2'].forEach(id => { for (let k = 0; k < 2; k++) St.hitos.push({ id: id + '-H' + k, ini: id, nombre: 'h', fase: 'Planificación', fecha: d(-30), completado: true, fechaReal: d(-30) }); });
    save(); render(); });
  await p.evaluate(async () => { await sembrarSt(); });   // con servidor, los datos de la prueba viven en la base: los comandos (apih_*) los leen de allí
  const r = {}, ev = (f, a) => p.evaluate(f, a);
  const rango = id => ev(i => { const x = byId(i), f = x.fasesFechas, H = hoy(), n = s => diffD(s, H); return fasesDe(x).map(k => n(f[k].ini) + '>' + n(f[k].fin)).join(' ') + ' | ' + n(x.inicioPlan) + '>' + n(x.finPlan) + ' | ' + subfasesDe(x).map(s => n(s.inicio) + '>' + n(s.fin)).join(','); }, id);
  // 1) con «Reprogramar» (marcado por defecto)
  await ev(() => Acts.etapa({ id: 'EP-1' })); await p.waitForTimeout(250);
  await p.selectOption('#et_acc', 'f:Ejecución'); await p.waitForTimeout(100);
  r.vista = await p.$$eval('#et_d .et-plan li', a => a.length); r.marcado = await p.$eval('#et_repro', e => e.checked);
  await p.click('[data-act="etapago"]'); await p.waitForTimeout(300);
  r.fase1 = await ev(() => byId('EP-1').fase); r.rango1 = await rango('EP-1');
  // 2) sin reprogramar: solo cambia la fase
  await ev(() => Acts.etapa({ id: 'EP-2' })); await p.waitForTimeout(250);
  await p.selectOption('#et_acc', 'f:Ejecución'); await p.waitForTimeout(100); await p.uncheck('#et_repro');
  await p.click('[data-act="etapago"]'); await p.waitForTimeout(300);
  r.fase2 = await ev(() => byId('EP-2').fase); r.rango2 = await rango('EP-2');
  // 3) ficha minimalista: franja de etapa, 4 cifras, qué sigue + cronograma, y el resto plegado
  await ev(() => Acts.ficha({ id: 'EP-1' })); await p.waitForTimeout(400);
  r.pano = await p.evaluate(() => [document.querySelectorAll('.pa-fase').length, document.querySelectorAll('.pa-ks .pa-k').length, document.querySelectorAll('.pa-2 .pa-c').length, document.querySelectorAll('.fl-list>.fl-s.col').length === document.querySelectorAll('.fl-list>.fl-s').length].join(','));
  const mal = [], w = (k, v) => { if (JSON.stringify(r[k]) !== JSON.stringify(v)) mal.push(k + ' = ' + JSON.stringify(r[k]) + ' (esperado ' + JSON.stringify(v) + ')'); };
  w('marcado', true); w('pano', '1,4,2,true'); w('fase1', 'Ejecución'); w('fase2', 'Ejecución');
  w('rango1', '-40>-1 0>55 56>70 71>85 | -40>85 | 0>20'); w('rango2', '-40>-26 -25>30 31>45 46>60 | -40>60 | -25>-5');
  if (!(r.vista >= 3)) mal.push('vista = ' + r.vista);
  mal.forEach(m => console.log('DIVERGE', m));
  const ok = !err.length && !mal.length;
  console.log(ok ? 'OK etapa-plan' : 'FALLA etapa-plan', JSON.stringify(err)); if (!ok) console.log(JSON.stringify(r)); await b.close(); process.exit(ok ? 0 : 1);
})();
