// V22.66 · Reporte de avance de la ficha: Forma A (una fase) y Forma B (múltiples hitos / fases paralelas), armadas desde la ficha.
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { if (typeof DataService !== 'undefined' && DataService.svc) { clearInterval(DataService.poll); DataService.refresh = async () => {}; } });
  const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
  const R = await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const H = hoy(), d = n => addD(H, n), me = miUsuario();
    const i = { id: 'PRJ-777', tipo: 'Proyecto', titulo: 'Proyecto <img src=x onerror=alert(1)> Núcleo', fase: 'Ejecución', estado: 'En curso', rag: 'Ámbar', prioridad: 'Alta', lider: me, negocio: 'Operaciones', area: 'BISE', avance: 40, presupuesto: 10, gastado: 2, deps: [], tags: [], est: [],
      hist: [[d(-30), 20], [d(-8), 30], [H, 40]], creada: d(-60), faseDesde: d(-20), actualizada: H, inicioPlan: d(-60), finPlan: d(90), finEst: d(90),
      logros: 'Workbooks cerrados\nDocumentación enviada', proximos: 'Revisión key users\nCierre de interfaces', issue: 'Interfaces abiertas a la espera de cotizaciones',
      subfases: [], snapFase: [] };
    St.ini.push(i);
    const mk = (n, peso, f, done, sub) => St.hitos.push({ id: 'HIT-77' + n, ini: i.id, nombre: 'Hito ' + n, fase: 'Ejecución', fecha: d(f), completado: done, fechaReal: done ? d(f) : null, resp: me, peso, subfase: sub || '' });
    mk(1, 25, -10, true); mk(2, 25, 10, false); mk(3, 20, 30, false); mk(4, 30, 60, false);
    const a = i.id + '-SF1', c = i.id + '-SF2';
    const v = ventanaDe(i, 'Ejecución'); 
    i.subfases = [{ id: a, nombre: 'Frente comunicación', fase: 'Ejecución', inicio: v.ini, fin: v.fin }, { id: c, nombre: 'Frente accesos', fase: 'Ejecución', inicio: v.ini, fin: v.fin }];
    St.hitos.find(h => h.id === 'HIT-771').subfase = a; St.hitos.find(h => h.id === 'HIT-772').subfase = a; St.hitos.find(h => h.id === 'HIT-773').subfase = c;
    St.decisiones.push({ id: 'DEC-777', ini: i.id, titulo: 'Definir TyC con Abogados', tipo: 'Otro', estado: 'Pendiente', limite: d(3), solicita: me, area: 'BISE' });
    St.compromisos.push({ id: 'CMP-777', ini: i.id, texto: 'Enviar cotización', resp: me, limite: null, estado: 'Abierto' });
    St.compromisos.push({ id: 'CMP-778', ini: i.id, texto: 'Compromiso vencido', resp: me, limite: d(-2), estado: 'Abierto' });
    i.snapFase = [[d(-7), { 'F:Ejecución': 10, ['s:' + a]: 0, ['s:' + c]: 0 }]];
    const B = repHtml(i, 'auto'), Aa = repHtml(i, 'A'), forB = repHtml(i, 'B');
    const dB = repDatos(i);
    i.subfases = []; const A0 = repHtml(i, 'auto'); i.subfases = [{ id: a, nombre: 'Frente comunicación', fase: 'Ejecución', inicio: v.ini, fin: v.fin }, { id: c, nombre: 'Frente accesos', fase: 'Ejecución', inicio: v.ini, fin: v.fin }];
    return { autoForma: B.forma, B: B.html, A: Aa.html, forced: forB.forma, A0forma: A0.forma, A0: A0.html, phases: dB.phases, pend: dB.pend, prev: dB.prevOverall };
  });
  ok(R.autoForma === 'B', 'con 2 subfases activas debería ser Forma B: ' + R.autoForma);
  ok(R.A0forma === 'A', 'sin subfases debería ser Forma A: ' + R.A0forma);
  ok(R.forced === 'B', 'forzar B falla');
  ok(R.prev === 30, 'avance anterior debería ser 30 (último registro previo a hoy): ' + R.prev);
  // Forma B
  ok(/EN RIESGO/.test(R.B), 'B: estado = RAG Ámbar → EN RIESGO');
  ok(/Avance fase: Frente comunicación/.test(R.B) && /Avance fase: Frente accesos/.test(R.B), 'B: una caja por subfase activa');
  ok(/1\/2/.test(R.B) && /0\/1/.test(R.B), 'B: contador hitos cerrados/totales por subfase');
  ok(/↑ desde 30%/.test(R.B), 'B: «↑ desde 30%» del avance general');
  ok(/↑ desde 0%/.test(R.B), 'B: «↑ desde» de la fase (snapshot previo)');
  ok(/1 de 4 hitos cumplidos/.test(R.B), 'B: hitos cumplidos');
  ok(/Semana actual/.test(R.B) && /Próxima semana/.test(R.B) && /Workbooks cerrados/.test(R.B) && /Revisión key users/.test(R.B), 'B: columnas de actividades con logros/próximos');
  ok(/Nota de atención/.test(R.B) && /cotizaciones/.test(R.B), 'B: nota = issue');
  ok(/Pendientes por definir/.test(R.B) && /POR DEFINIR/.test(R.B) && /Definir TyC con Abogados/.test(R.B) && /#EB002A;">\s*(DOM|LUN|MAR|MIE|JUE|VIE|SAB)/.test(R.B), 'B: pendientes con fecha, sin fecha y vencido en rojo');
  ok(/Operaciones · PM:/.test(R.B), 'B: cliente = responsable de negocio');
  // Forma A
  ok(/Semana pasada/.test(R.A) && /Esta semana/.test(R.A) && /Hitos contractuales/.test(R.A), 'A: títulos exactos de la forma A');
  ok(/Fase Activa: Ejecución/.test(R.A) && /Avance fase activa/.test(R.A), 'A: fase activa');
  ok(/Hito 1 — 25%/.test(R.A) && /✓ Hito 1/.test(R.A), 'A: hito con peso y cerrado');
  ok(/Aramark · PM:/.test(R.A), 'A: «Aramark · PM»');
  ok(/>40%</.test(R.A), 'A: avance del proyecto = avance manual (40 %)');
  // seguridad
  ok(!/<img src=x/.test(R.B) && !/<img src=x/.test(R.A) && /&lt;img/.test(R.B), 'el nombre del proyecto se escapa');
  // sin pesos → partes iguales y sin «— n%»
  const R2 = await p.evaluate(() => { const i = byId('PRJ-777'); St.hitos.filter(h => h.ini === i.id).forEach(h => delete h.peso); i.subfases = []; const r = repHtml(i, 'A').html; return { noW: !/Hito 2 — /.test(r), eq: /left:25%/.test(r) }; });
  ok(R2.noW && R2.eq, 'sin pesos: etiquetas sin porcentaje y hitos en partes iguales');
  // snapshot en la actualización semanal
  const S = await p.evaluate(() => { const i = byId('PRJ-777'); snapFases(i); return i.snapFase.slice(-1)[0]; });
  ok(S && S[0] === (await p.evaluate(() => hoy())) && S[1]['F:Ejecución'] != null, 'snapFases registra el avance de fase de hoy');
  // Modal y botón
  await p.evaluate(() => { selectEntity('ini', 'PRJ-777'); }); await p.waitForTimeout(300);
  const hayBtn = await p.evaluate(() => [...document.querySelectorAll('#panel button')].some(x => x.textContent.trim() === '1 a 1'));
  ok(hayBtn, 'el panel de la ficha no tiene el botón «1 a 1»');
  // «1 a 1» visible (no escondido en «Más»/«Herramientas») también en la ficha completa
  await p.evaluate(() => Acts.ficha({ id: 'PRJ-777' })); await p.waitForTimeout(400);
  const vis = await p.evaluate(() => [...document.querySelectorAll('.fl2-top button')].filter(x => !x.closest('.pop')).map(x => x.textContent.trim()));
  ok(vis.includes('1 a 1'), 'la ficha completa no muestra «1 a 1» a la vista: ' + vis.join('|'));
  const visP = await p.evaluate(() => { selectEntity('ini', 'PRJ-777'); return [...document.querySelectorAll('#panel .pn-a button')].filter(x => !x.closest('.pop')).map(x => x.textContent.trim()); }); 
  ok(visP.includes('1 a 1'), 'el panel no muestra «1 a 1» a la vista: ' + visP.join('|'));
  await p.evaluate(() => Acts.reporte({ id: 'PRJ-777' })); await p.waitForTimeout(300);
  const m1 = await p.evaluate(() => ({ t: document.querySelector('#rep-prev').innerText, info: document.querySelector('#rep-info').textContent }));
  ok(/Reporte de avance/.test(m1.t) && /Forma A \(automática/.test(m1.info), 'modal: vista previa y forma automática: ' + m1.info);
  await p.selectOption('#rep-forma', 'B'); await p.waitForTimeout(200);
  const m2 = await p.evaluate(() => ({ t: document.querySelector('#rep-prev').innerText, info: document.querySelector('#rep-info').textContent }));
  ok(/Forma B \(forzada\)/.test(m2.info) && /Próxima semana/.test(m2.t), 'modal: forzar Forma B');
  // V22.69 · solo lo marcado «En presentación» se ve en lista, marcadores y pendientes; el cálculo sigue usando todos
  const F = await p.evaluate(() => {
    const i = byId('PRJ-777'); const base = { A: repHtml(i, 'A').html, B: repHtml(i, 'B').html };
    St.hitos.find(h => h.id === 'HIT-772').inPres = false; St.decisiones.find(d => d.id === 'DEC-777').inPres = false;
    const aft = { A: repHtml(i, 'A').html, B: repHtml(i, 'B').html }; const d0 = repDatos(i);
    return { base, aft, ms: d0.ms.length, vis: d0.ms.filter(m => m.vis).length, overall: d0.overall, pend: d0.pend.map(x => x.text) };
  });
  ok(F.ms === 4 && F.vis === 3, 'ms/vis: ' + F.ms + '/' + F.vis);
  ok(/Hito 2/.test(F.base.A) && /Hito 2/.test(F.base.B), 'base debe mostrar Hito 2');
  ok(!/Hito 2/.test(F.aft.A) && !/Hito 2/.test(F.aft.B), 'Hito 2 sin marcar aparece en el 1 a 1');
  ok(/1 de 4 hitos cumplidos/.test(F.aft.B) && F.overall === 40, 'el cálculo debe seguir usando los 4 hitos');
  ok(!F.pend.includes('Definir TyC con Abogados') && F.pend.includes('Enviar cotización'), 'pendientes: ' + F.pend.join('|'));
  ok(/>3</.test(F.aft.B) && !/>4</.test(F.aft.B.replace(/<[^>]*>[^<]*(\d{2}\/\d{2})[^<]*/g, '')), 'numeración consecutiva de los visibles');
  await p.evaluate(() => { St.riesgos.push({ id: 'RSK-777', ini: 'PRJ-777', desc: 'Riesgo prueba', cat: 'Técnico', prob: 3, imp: 3, estado: 'Abierto', dueno: miUsuario(), fIdent: hoy(), fRev: addD(hoy(), 30), mit: '' }); St.hitos.find(h => h.id === 'HIT-772').inPres = false; });
  for (const tab of ['hitos', 'riesgos', 'actividad']) {
    const n = await p.evaluate(t => { selectEntity('ini', 'PRJ-777', t); return document.querySelectorAll('#panel input[data-chg="incl"], #panel input[data-chg="bitpres"]').length; }, tab);
    ok(n >= (tab === 'actividad' ? 0 : 1), 'casilla «En presentación» ausente en la pestaña ' + tab);
  }
  const ch = await p.evaluate(() => { selectEntity('ini', 'PRJ-777', 'hitos'); const el = [...document.querySelectorAll('#panel input[data-chg="incl"][data-e="hito"]')].find(x => x.dataset.id === 'HIT-772'); if (!el) return 'sin casilla'; return el.checked; });
  ok(ch === false, 'la casilla de HIT-772 debe verse desmarcada: ' + ch);
  await p.evaluate(() => { const el = [...document.querySelectorAll('#panel input[data-chg="incl"][data-e="hito"]')].find(x => x.dataset.id === 'HIT-772'); el.click(); });
  ok(await p.evaluate(() => byId('PRJ-777') && St.hitos.find(h => h.id === 'HIT-772').inPres !== false), 'marcar desde la pestaña debe reactivar el hito');
  // Exportar a PNG y PDF (descargas reales)
  for (const [act, ext, magic] of [['reppng', 'png', [0x89, 0x50, 0x4e, 0x47]], ['reppdf', 'pdf', [0x25, 0x50, 0x44, 0x46]]]) {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.click('[data-act="' + act + '"]')]);
    if (!dl) { ok(false, 'no hubo descarga ' + ext); continue; }
    const f = await dl.path(); if (process.env.KEEP) require('fs').copyFileSync(f, '/tmp/rep.' + ext); const buf = require('fs').readFileSync(f);
    ok(dl.suggestedFilename().endsWith('.' + ext) && /^Reporte_1a1_/.test(dl.suggestedFilename()), 'nombre ' + ext + ': ' + dl.suggestedFilename());
    ok(buf.length > 5000 && magic.every((v, k) => buf[k] === v), ext + ' inválido (' + buf.length + ' bytes)');
    if (ext === 'pdf') ok(/\/Type \/Page /.test(buf.toString('latin1')) && /%%EOF$/.test(buf.toString('latin1')), 'estructura PDF');
    if (ext === 'png') { const wh = [buf.readUInt32BE(16), buf.readUInt32BE(20)]; ok(wh[0] === 1800 && wh[1] > 400, 'dimensiones PNG ' + wh); }
  }
  ok(errs.length === 0, 'errores de página: ' + errs.join(' | '));
  console.log(fails.length ? 'FALLA\n - ' + fails.join('\n - ') : 'OK reporte1 — Forma A y B desde la ficha, auto/forzada, pesos opcionales, snapshot de fase, escape'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
