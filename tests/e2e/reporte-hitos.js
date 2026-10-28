// Reporte 1 a 1 (Forma A): las etiquetas de los hitos no se solapan, aunque los hitos estén muy juntos.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1000, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const html = await p.evaluate(() => {
    celebrar = () => {}; const H = hoy(), d = n => addD(H, n), me = miUsuario();
    const i = { id: 'PRJ-778', tipo: 'Proyecto', titulo: 'Hitos juntos', fase: 'Transición', estado: 'En curso', rag: 'Verde', lider: me, negocio: 'Ops', area: 'BISE', avance: 40, presupuesto: 10, hist: [[H, 40]], creada: d(-60), faseDesde: d(-20), actualizada: H, inicioPlan: d(-60), finPlan: d(90), finEst: d(90), subfases: [], snapFase: [] };
    St.ini.push(i);
    [[8, -50, true], [9, -45, true], [10, 0, false], [10, 1, false], [20, 30, false], [10, 31, false], [15, 60, false], [18, 61, false]].forEach(([w, f, done], n) => St.hitos.push({ id: 'HIT-78' + n, ini: i.id, nombre: 'Hito de ejemplo ' + (100 + n * 7), fase: 'Transición', fecha: d(f), completado: done, fechaReal: done ? d(f) : null, resp: me, peso: w }));
    return repHtml(i, 'A').html;
  });
  await p.setContent(html);
  const r = await p.evaluate(() => {
    const L = [...document.querySelectorAll('div[style*="white-space:nowrap"][style*="text-align:center"]')].filter(e => e.querySelector('div') && /Hito de ejemplo/.test(e.textContent)).map(e => e.getBoundingClientRect());
    let cruces = 0; for (let a = 0; a < L.length; a++) for (let c = a + 1; c < L.length; c++) { const A = L[a], B = L[c]; if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) cruces++; }
    const host = document.querySelector('div[style*="max-width:680px"]').getBoundingClientRect();
    return { n: L.length, cruces, fuera: L.filter(x => x.left < host.left || x.right > host.right).length };
  });
  await p.screenshot({ path: '/tmp/t/rep-hitos.png', fullPage: true });
  const ok = !errs.length && r.n === 8 && r.cruces === 0 && r.fuera === 0;
  console.log(ok ? 'OK reporte-hitos' : 'FALLA reporte-hitos ' + JSON.stringify(r), errs); await b.close(); process.exit(ok ? 0 : 1);
})();
