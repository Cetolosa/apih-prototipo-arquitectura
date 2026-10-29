// V22.61 · Descripción/instrucciones en fase (global + nota de proyecto), subfase e hito; se ven en Mi cocina, ficha y Fases; HTML escapado.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => { celebrar = () => {}; UI.uiOv = 'pro'; const H = hoy(), X = '<img src=x onerror="window.__x=1">';
    const me = St.cfg.usuario || 'Tester'; St.cfg.usuario = me;
    MET().faseDesc = Object.assign({}, MET().faseDesc, { 'Ejecución': 'FASE-GLOBAL: construir con compuertas en verde.' });
    let n = { id: 'PRJ-700', tipo: 'Proyecto', titulo: 'Con descripciones', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', lider: me, area: 'BISE', avance: 40, presupuesto: 0, deps: [], tags: [], hist: [[H, 40]], est: [], creada: '2026-10-01', inicioPlan: '2026-10-01', finPlan: '2026-12-01', actualizada: H,
      faseNota: { 'Ejecución': 'NOTA-PROYECTO: coordinar ventana con TI.' },
      subfases: [{ id: 'PRJ-700-SF1', nombre: 'Construcción', fase: 'Ejecución', inicio: '2026-10-05', fin: '2026-11-20', desc: 'SUBFASE-DESC: hacer en local primero.' }] };
    St.ini.push(n);
    St.hitos.push({ id: 'HIT-700', ini: 'PRJ-700', nombre: 'Entrega A', fase: 'Ejecución', fecha: addD(H, 3), completado: false, resp: me, subfase: 'PRJ-700-SF1', desc: 'HITO-DESC: pedir revisión a TI.' });
    St.hitos.push({ id: 'HIT-701', ini: 'PRJ-700', nombre: 'Peligroso', fase: 'Ejecución', fecha: addD(H, 2), completado: false, resp: me, desc: X });
    await sembrarSt(); await DataService.refresh(false, true); n = byId(n.id);
    const pasos = pasosDe(n); const out = {};
    out.hitoNota = (pasos.find(x => /Entrega A/.test(x.t)) || {}).nota || '';
    out.xssNota = (pasos.find(x => /Peligroso/.test(x.t)) || {}).nota || '';
    out.compuertaNota = (pasos.filter(x => x.tipo === 'Compuerta').map(x => x.nota).find(Boolean)) || '';
    // render de las vistas que deben mostrarlas
    UI.view = 'cielo'; render(); await new Promise(r => setTimeout(r, 200));
    out.cocinaNotas = [...document.querySelectorAll('.ps-nota')].map(e => e.textContent).join(' || ');
    UI.view = 'fases'; F('fases', {}).id = 'PRJ-700'; F('fases', {}).tab = 'linea'; render(); await new Promise(r => setTimeout(r, 200));
    out.fasesDesc = [...document.querySelectorAll('.desc-l')].map(e => e.textContent).join(' || ');
    UI.view = 'proyectos'; render(); selectEntity('ini', 'PRJ-700', 'resumen'); await new Promise(r => setTimeout(r, 200));
    // formularios traen el campo
    Acts.edit({ t: 'hito', id: 'HIT-700' }); await new Promise(r => setTimeout(r, 150)); out.hitoForm = !!document.querySelector('#f_desc'); out.hitoDescVal = (document.querySelector('#f_desc') || {}).value || ''; Modal.close && Modal.close();
    Acts.sfedit({ id: 'PRJ-700', s: 'PRJ-700-SF1' }); await new Promise(r => setTimeout(r, 150)); out.subForm = !!document.querySelector('#f_desc'); Modal.close && Modal.close();
    Acts.fnota({ id: 'PRJ-700', f: 'Ejecución' }); await new Promise(r => setTimeout(r, 150)); out.notaForm = (document.querySelector('#f_nota') || {}).value || ''; Modal.close && Modal.close();
    out.ejecutado = !!window.__x; out.imgs = document.querySelectorAll('img[src="x"]').length;
    return out; });
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = /HITO-DESC/.test(r.hitoNota) && /SUBFASE-DESC/.test(r.hitoNota) && /FASE-GLOBAL/.test(r.compuertaNota) && /NOTA-PROYECTO/.test(r.compuertaNota)
    && /HITO-DESC/.test(r.cocinaNotas) && /FASE-GLOBAL|NOTA-PROYECTO/.test(r.fasesDesc) && r.hitoForm && /HITO-DESC/.test(r.hitoDescVal) && r.subForm && /NOTA-PROYECTO/.test(r.notaForm)
    && !r.ejecutado && r.imgs === 0 && r.xssNota.includes('<img') && !errs.length;
  console.log(ok ? 'OK desc1' : 'FALLA desc1'); await b.close(); process.exit(ok ? 0 : 1);
})();
