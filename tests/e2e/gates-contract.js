// Contrato compartido: la copia de las compuertas de aprobación que usa la app debe dar lo mismo que el servidor
// (el servidor se prueba con el mismo archivo en supabase/tests/60_contrato_compuertas.sql).
const { chromium, launchOpts } = require('./_pw');
const fs = require('fs'), path = require('path');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const casos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'contract', 'gates_aprobar.json'), 'utf8'));
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(cs => cs.map(c => {
    St.decisiones = c.decisiones.map((d, k) => Object.assign({ id: c.prop.id + '-D' + k, ini: c.prop.id }, d));
    const prop = Object.assign({ tipo: 'Propuesta' }, c.prop);
    return { nombre: c.nombre, got: gatesAprobar(prop).filter(g => !g.ok).map(g => g.t), want: c.faltan };
  }), casos);
  const mal = r.filter(x => JSON.stringify(x.got) !== JSON.stringify(x.want));
  mal.forEach(x => console.log('DIVERGE', x.nombre, JSON.stringify(x.got), '≠', JSON.stringify(x.want)));
  const ok = !err.length && !mal.length;
  console.log(ok ? 'OK gates-contract (' + r.length + ' casos)' : 'FALLA gates-contract', err); await b.close(); process.exit(ok ? 0 : 1);
})();
