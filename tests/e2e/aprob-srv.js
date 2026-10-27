// F2 · Con servidor, «Aprobar» llama al comando transaccional y no modifica el estado local por su cuenta.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const out = {}; const prop = { id: 'PROP-900', tipo: 'Propuesta', titulo: 'Prop', area: 'BISE', fase: 'Evaluación', estado: 'Vigente', sponsor: '', lider: '', bc: '', presupuesto: 0, deps: [] }; St.ini.push(prop); out.id = prop.id; const antes = St.ini.length;
    const llamadas = []; DataService.svc = { rpc: async (n, a) => { llamadas.push([n, a]); return 'PRJ-777'; } }; DataService.refresh = async () => { }; DataService.flush = async () => { }; DataService.busy = false; DataService.dirty = false;
    const g = gatesAprobar(prop).filter(x => !x.ok); out.faltan = g.length;
    await aprobarEnServidor(prop, g, false, '  nota  '); out.sinForzar = llamadas.length;           // admin sin marcar «forzar»: no llama
    await aprobarEnServidor(prop, [], false, '  nota  '); out.llamada = llamadas[0]; out.local = St.ini.length === antes && prop.estado !== 'Aprobada';
    await aprobarEnServidor(prop, g, true, 'x'); out.forzada = llamadas[1] && llamadas[1][1].p_forzar;
    return out;
  });
  console.log(JSON.stringify(r), err);
  const ok = !err.length && r.faltan > 0 && r.sinForzar === 0 && r.llamada && r.llamada[0] === 'apih_aprobar_propuesta' && r.llamada[1].p_id === r.id && r.llamada[1].p_nota === 'nota' && r.llamada[1].p_forzar === false && r.local && r.forzada === true;
  console.log(ok ? 'OK aprob-srv' : 'FALLA aprob-srv'); await b.close(); process.exit(ok ? 0 : 1);
})();
