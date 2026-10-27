// V22.65 / C2.23 · «Stand By» (Propuestas y Proyectos): fuera de TODOS los indicadores, avisos y vistas de gestión;
// la Tabla de iniciativas sí lo muestra; la presentación no lo incluye y solo cuenta su número en «Movimientos del ciclo».
// Método: foto de indicadores/avisos/pantallas ANTES y DESPUÉS de agregar iniciativas en Stand By con todo lo que suele generar ruido
// (retraso, riesgo crítico, hito vencido, decisión/cambio/compromiso vencidos, fase Aprobación): no debe cambiar nada.
const { chromium, launchOpts } = require('./_pw');
const assert = require('assert');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { if (typeof DataService !== 'undefined' && DataService.svc) { clearInterval(DataService.poll); DataService.refresh = async () => {}; } });   // Corporativo: sin sondeo que pise los datos sembrados
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  // base mínima viva (en el corporativo la base parte vacía)
  await p.evaluate(() => {
    celebrar = () => {}; UI.uiOv = 'pro'; const H = hoy(), d = n => addD(H, n), me = miUsuario();
    const base = { tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Ámbar', prioridad: 'Alta', lider: me, area: 'BISE', avance: 30, presupuesto: 10, gastado: 2, deps: [], tags: [], hist: [], est: [], inicioPlan: d(-60), finPlan: d(60), finEst: d(60), creada: d(-60), faseDesde: d(-30), actualizada: H };
    if (!St.ini.some(i => i.id === 'PRJ-801')) St.ini.push(Object.assign({}, base, { id: 'PRJ-801', titulo: 'Base viva proyecto', creada: d(-3) }));
    if (!St.ini.some(i => i.id === 'PROP-801')) St.ini.push(Object.assign({}, base, { id: 'PROP-801', tipo: 'Propuesta', fase: 'Aprobación', estado: 'Vigente', titulo: 'Base viva propuesta' }));
    // un movimiento real (proyecto que llegó a 100 % desde el corte anterior) para que exista «Movimientos del ciclo»
    St.comites.push({ id: 'COM-801', fecha: d(-20), estado: 'Realizado', participantes: [], tema: 'Corte anterior', decisiones: [], acciones: [], compromisos: [] });
    if (!St.ini.some(i => i.id === 'PRJ-802')) St.ini.push(Object.assign({}, base, { id: 'PRJ-802', titulo: 'Base viva terminada', avance: 100, hist: [[d(-25), 50], [d(-2), 100]] }));
    St.hitos.push({ id: 'HIT-801', ini: 'PRJ-801', nombre: 'Hito base', fase: 'Ejecución', fecha: d(20), completado: false, resp: me });
    St.riesgos.push({ id: 'RSK-801', ini: 'PRJ-801', desc: 'Riesgo base', prob: 3, imp: 3, estado: 'Abierto', dueno: me, fIdent: d(-3) });
  });
  const foto = () => p.evaluate(() => {
    const out = { kpis: JSON.stringify(kpis()), badges: {}, textos: {} };
    ['propuestas', 'riesgos', 'hitos', 'compromisos', 'cambios', 'decisiones', 'analisis'].forEach(k => { out.badges[k] = navBadge(k); });
    out.alertas = computeAlerts().length; out.avisos = notifMias().length;
    out.n = [scope().length, scopeP().length, scopeAll().length, HITOS().length, riesgosCriticos().length, DECS().length, CAMBIOS().length, ACUERDOS().length, RIESGOS().length].join(',');
    out.pend = (typeof pendientes === 'function') ? JSON.stringify(pendientes().map(x => x.id + x.k)) : '';
    out.cap = (typeof capacidad === 'function') ? '' : '';
    out.vistas = ['dashboard', 'proyectos', 'gantt', 'fases', 'roadmap', 'calendario', 'hitos', 'capacidad', 'riesgos', 'propuestas', 'comite', 'decisiones', 'compromisos', 'cambios', 'personas', 'cielo'].filter(v => Views[v]);
    return out;
  });
  const VIEWS = (await foto()).vistas;
  const textos = async () => { const t = {}; for (const v of VIEWS) { await p.evaluate(v => { go(v); }, v); await p.waitForTimeout(200); t[v] = await p.evaluate(() => document.querySelector('#main').innerText); } return t; };
  const antes = await foto(), tAntes = await textos();
  // Stand By: un proyecto y una propuesta con todo lo que normalmente alerta
  await p.evaluate(() => {
    const H = hoy(), d = n => addD(H, n), me = miUsuario();
    const base = { fase: 'Ejecución', rag: 'Rojo', prioridad: 'Alta', lider: me, area: 'BISE', avance: 5, presupuesto: 900, gastado: 800, deps: [], tags: [], hist: [], est: [], inicioPlan: d(-200), finPlan: d(-90), finEst: d(-30), creada: d(-200), faseDesde: d(-150), actualizada: d(-120), estadoMotivo: 'Congelado por presupuesto', estadoRev: null };
    St.ini.push(Object.assign({}, base, { id: 'PRJ-899', tipo: 'Proyecto', estado: 'Stand By', titulo: 'ZZ Proyecto Stand By' }));
    St.ini.push(Object.assign({}, base, { id: 'PROP-899', tipo: 'Propuesta', fase: 'Aprobación', estado: 'Stand By', titulo: 'ZZ Propuesta Stand By', faseDesde: d(-150) }));
    ['PRJ-899', 'PROP-899'].forEach((id, k) => {
      St.hitos.push({ id: 'HIT-89' + k, ini: id, nombre: 'ZZ hito vencido ' + k, fase: 'Ejecución', fecha: d(-40), completado: false, resp: me });
      St.riesgos.push({ id: 'RSK-89' + k, ini: id, desc: 'ZZ riesgo crítico ' + k, prob: 5, imp: 5, estado: 'Abierto', dueno: me, fIdent: d(-50), fRev: d(-5) });
      St.decisiones.push({ id: 'DEC-89' + k, ini: id, titulo: 'ZZ decisión vencida ' + k, tipo: 'Otro', estado: 'Pendiente', limite: d(-10), solicita: me, area: 'BISE' });
      St.cambios.push({ id: 'CAM-89' + k, ini: id, tipo: 'Fecha', estado: 'Solicitado', desc: 'ZZ cambio ' + k, solicita: me, aprobador: me, creada: d(-5) });
      St.compromisos.push({ id: 'CMP-89' + k, ini: id, texto: 'ZZ compromiso vencido ' + k, resp: me, limite: d(-10), estado: 'Abierto' });
    });
    if (typeof invalidar === 'function') invalidar(); save && 0; refresh();
  });
  const despues = await foto(), tDesp = await textos();
  for (const k of ['kpis', 'alertas', 'avisos', 'n', 'pend']) ok(antes[k] === despues[k], `${k} cambió con Stand By: ${antes[k]} → ${despues[k]}`);
  for (const k of Object.keys(antes.badges)) ok(antes.badges[k] === despues.badges[k], `insignia «${k}» cambió: ${antes.badges[k]} → ${despues.badges[k]}`);
  for (const v of VIEWS) {
    ok(!/ZZ |PRJ-899|PROP-899/.test(tDesp[v]), `la pantalla «${v}» muestra algo en Stand By`);
    ok(tAntes[v] === tDesp[v], `la pantalla «${v}» cambió con Stand By`);
  }
  // La Tabla de iniciativas SÍ lo muestra, con su etiqueta
  await p.evaluate(() => { const f = F('portfolio', {}); f.tipo = 'Todo'; f.q = ''; f.estado = ''; f.hideDone = false; go('portfolio'); }); await p.waitForTimeout(300);
  const tabla = await p.evaluate(() => document.querySelector('#main').innerText);
  ok(/ZZ Proyecto Stand By/.test(tabla) && /ZZ Propuesta Stand By/.test(tabla), 'la Tabla no muestra las iniciativas en Stand By');
  ok(/Stand By/.test(tabla), 'la Tabla no rotula «Stand By»');
  // Ficha: se puede abrir, no ofrece Actualizar/Fase y sí Reactivar
  await p.evaluate(() => { selectEntity('ini', 'PRJ-899'); }); await p.waitForTimeout(300);
  const ficha = await p.evaluate(() => { const t = [...document.querySelectorAll('#panel button')].map(x => x.textContent.trim()); return t; });
  ok(ficha.includes('Reactivar'), 'la ficha en Stand By no ofrece «Reactivar»: ' + ficha.join('|'));
  ok(!ficha.includes('Actualizar') && !ficha.includes('Fase'), 'la ficha en Stand By ofrece Actualizar/Fase');
  // Presentación por defecto: nada de Stand By, solo su número en «Movimientos del ciclo»
  const pres = await p.evaluate(() => {
    const c = Object.assign(PRES_DEF(), { alcance: 'portafolio' }); const M = slidesOf(c, null); const todo = [];
    Object.keys(M.pages).forEach(k => (M.pages[k] || []).forEach(s => (s.g && s.g.els || []).forEach(e => { if (e.text) todo.push(k + '|' + e.text); })));
    return { todo, ctx: (() => { const x = GENE.contexto(c, null); return { standBy: x.datos.standBy, prj: x.prj.map(i => i.id), prop: x.prop.map(i => i.id), propRows: x.propRows.map(r => r.id) }; })(), err: Object.keys(M.pages).filter(k => M.pages[k].error) };
  });
  ok(pres.err.length === 0, 'error generando láminas: ' + pres.err.join(','));
  ok(pres.ctx.standBy === 2, 'datos.standBy debería ser 2: ' + pres.ctx.standBy);
  ok(!pres.ctx.prj.includes('PRJ-899') && !pres.ctx.prop.includes('PROP-899') && !pres.ctx.propRows.includes('PROP-899'), 'la presentación incluye iniciativas en Stand By');
  const fuera = pres.todo.filter(t => /ZZ |PRJ-899|PROP-899/.test(t)); ok(fuera.length === 0, 'texto de Stand By en láminas: ' + fuera.slice(0, 3).join(' // '));
  const sb = pres.todo.filter(t => /^logros\|Stand By: \d+$/.test(t)); ok(sb.length === 1 && sb[0] === 'logros|Stand By: 2', 'falta «Stand By: 2» en Movimientos del ciclo: ' + JSON.stringify(sb));
  // Reactivar devuelve la iniciativa a los indicadores
  await p.evaluate(() => { const i = byId('PRJ-899'); i.estado = 'En curso'; i.estadoMotivo = ''; refresh(); });
  const react = await foto(); ok(react.n !== antes.n || react.kpis !== antes.kpis, 'al reactivar, el proyecto no vuelve a contar');
  ok(errs.length === 0, 'errores de página: ' + errs.join(' | '));
  console.log(fails.length ? 'FALLA\n - ' + fails.join('\n - ') : 'OK standby1 — Stand By fuera de indicadores, avisos y ' + VIEWS.length + ' pantallas; visible en la Tabla; presentación solo cuenta (2)');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
