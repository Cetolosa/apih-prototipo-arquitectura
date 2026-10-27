// Contratos compartidos del ciclo de vida: avance calculado y compuertas de transición (el servidor usa los mismos JSON en supabase/tests/90_ciclo_de_vida.sql).
const { chromium, launchOpts } = require('./_pw');
const fs = require('fs'), path = require('path');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const leer = n => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contract', n), 'utf8'));
const av = leer('avance_calc.json'), gt = leer('gates_transicion.json');
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(({ av, gt }) => {
    const out = [];
    const mk = (id, ini, hitos, riesgos) => {
      St.hitos = hitos.map((h, k) => Object.assign({ id: id + '-H' + k, ini: id, nombre: 'h' + k }, h, { completado: !!h.completado }));
      St.riesgos = (riesgos || []).map((x, k) => Object.assign({ id: id + '-R' + k, ini: id, desc: 'r' }, x));
      return Object.assign({ id, titulo: 't', area: 'A' }, ini);
    };
    av.forEach((c, n) => { const i = mk('CAV' + n, Object.assign({ tipo: 'Proyecto', estado: 'En curso' }, c.proy), c.hitos, []); out.push({ nombre: 'avance · ' + c.nombre, got: avanceCalc(i), want: c.avance }); });
    gt.forEach((c, n) => { const i = mk('CGT' + n, c.ini, c.hitos, c.riesgos); out.push({ nombre: 'gates · ' + c.nombre, got: gates(i, c.hasta).filter(g => !g.ok).map(g => g.t), want: c.faltan }); });
    return out;
  }, { av, gt });
  const mal = r.filter(x => JSON.stringify(x.got) !== JSON.stringify(x.want));
  mal.forEach(x => console.log('DIVERGE', x.nombre, JSON.stringify(x.got), '≠', JSON.stringify(x.want)));
  const ok = !err.length && !mal.length;
  console.log(ok ? 'OK ciclo-contract (' + r.length + ' casos)' : 'FALLA ciclo-contract', err); await b.close(); process.exit(ok ? 0 : 1);
})();
