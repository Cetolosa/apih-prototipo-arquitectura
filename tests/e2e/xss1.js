// V22.60 · Revisión de seguridad: textos con HTML en subfases, categorías, nombres e importaciones no se ejecutan en ninguna vista nueva
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => { localStorage.setItem('apih_tour22', '1'); localStorage.setItem('apih_ptipo', '"><img src=x onerror=window.__x=1>'); }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => { celebrar = () => {}; UI.uiOv = 'pro'; const X = '<img src=x onerror="window.__x=1">';
    const base = { estado: 'En curso', rag: 'Verde', prioridad: 'Alta', lider: X, area: 'BISE', avance: 10, presupuesto: 0, deps: [], tags: [], hist: [], est: [], creada: '2026-10-01' };
    St.ini.push(Object.assign({ id: 'PRJ-901', tipo: 'Proyecto', titulo: X, fase: 'Ejecución', inicioPlan: '2026-10-01', finPlan: '2026-12-01', subfases: [{ id: 'PRJ-901-SF1', nombre: X, fase: 'Ejecución', inicio: '2026-10-11', fin: '2026-11-15', resp: X }] }, base));
    St.ini.push(Object.assign({ id: 'PROP-901', tipo: 'Propuesta', titulo: X, fase: 'Evaluación', inicioPlan: '2026-10-05', finPlan: '2026-12-10' }, base, { estado: 'Vigente' }));
    [['PRJ-901', 'Planificación', '2026-10-10'], ['PRJ-901', 'Ejecución', '2026-11-15'], ['PROP-901', 'Evaluación', '2026-10-30']].forEach(([ini, fase, fecha], k) => St.hitos.push({ id: 'HIT-90' + k, ini, nombre: X, fase, fecha, cat: X, subfase: k === 1 ? 'PRJ-901-SF1' : undefined, completado: false, resp: X }));
    St.riesgos.push({ id: 'RSK-901', ini: 'PRJ-901', desc: X, cat: X, prob: 3, imp: 3, estado: 'Abierto', dueno: X, fIdent: '2026-10-01', fRev: '2026-10-30', mit: X });
    const vistas = ['portfolio', 'proyectos', 'gantt', 'fases', 'roadmap', 'hitos', 'riesgos', 'calendario', 'propuestas', 'dashboard'], out = { tipo: planTipo() };
    for (const v of vistas) { UI.view = v; if (v === 'fases') { F('fases', {}).open = { 'PRJ-901': true }; } render(); await new Promise(r => setTimeout(r, 120)); }
    for (const t of ['linea', 'tablero']) { UI.view = 'fases'; F('fases', {}).tab = t; F('fases', {}).id = 'PRJ-901'; render(); await new Promise(r => setTimeout(r, 120)); }
    selectEntity('ini', 'PRJ-901', 'hitos'); await new Promise(r => setTimeout(r, 150)); selectEntity('ini', 'PROP-901', 'resumen'); await new Promise(r => setTimeout(r, 150));
    Acts.sfedit({ id: 'PRJ-901', s: 'PRJ-901-SF1' }); await new Promise(r => setTimeout(r, 150)); Modal.close && Modal.close();
    Acts.edit({ t: 'hito', id: 'HIT-901' }); await new Promise(r => setTimeout(r, 150)); Modal.close && Modal.close();
    const ex = iapExport(byId('PRJ-901')); Chg.proyiaf({ files: [new File([JSON.stringify({ formato: 'apih-proyecto-ia', v: 1, proyecto_id: 'PRJ-901', subfases: [{ nombre: X, fase: 'Ejecución' }, { nombre: { a: 1 }, fase: 'Ejecución' }], hitos: [{ id: 'HIT-901', cat: X }] })], 'r.json')], value: '', dataset: { id: 'PRJ-901' } }); await new Promise(r => setTimeout(r, 300));
    out.ejecutado = !!window.__x; out.imgs = document.querySelectorAll('img[src="x"]').length; return out; });
  r.errores = errs; console.log(JSON.stringify(r));
  const ok = r.tipo === 'all' && !r.ejecutado && r.imgs === 0 && !errs.length; console.log(ok ? 'OK xss1' : 'FALLA xss1'); await b.close(); process.exit(ok ? 0 : 1);
})();
