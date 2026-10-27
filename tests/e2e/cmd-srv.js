// F2 · Con servidor, completar hito y resolver decisión usan comandos del servidor (sin mutar el estado local).
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const out = {}; const ll = [];
    St.hitos.push({ id: 'HIT-900', ini: 'PRJ-X', nombre: 'h', fecha: '2026-11-01', completado: false, fechaReal: null });
    DataService.svc = { rpc: async (n, a) => { ll.push([n, a]); return n === 'apih_resolver_decision' ? { estado: a.p_estado, aplicada: true, proyecto: 'PRJ-777' } : {}; } };
    DataService.refresh = async () => { }; DataService.flush = async () => { }; DataService.busy = false; DataService.dirty = false;
    toggleHito('HIT-900'); await new Promise(r => setTimeout(r, 100));
    out.hito = ll[0]; out.hitoLocal = St.hitos.find(h => h.id === 'HIT-900').completado;
    await resolverEnServidor({ id: 'DEC-9', ini: 'PROP-9' }, { estado: 'Aprobada', resolucion: 'ok', fResol: '2026-10-27', aplicar: true });
    out.dec = ll[1];
    St.cambios.push({ id: 'CHG-900', ini: 'PRJ-X', tipo: 'Fecha', desc: 'd', motivo: 'm', estado: 'Solicitado', fNue: '2027-01-01', pNue: 0 });
    await cmdServidor('apih_solicitar_cambio', { p_ini: 'PRJ-X', p_tipo: 'Fecha' });
    await cmdServidor('apih_resolver_cambio', { p_id: 'CHG-900', p_estado: 'Aprobado', p_nota: '' });
    await cmdServidor('apih_reabrir', { p_id: 'PRJ-X', p_nota: 'n' });
    out.cmds = ll.slice(2).map(x => x[0]); out.cambioLocal = St.cambios.find(c => c.id === 'CHG-900').estado;
    return out;
  });
  console.log(JSON.stringify(r), err);
  const ok = !err.length && r.hito && r.hito[0] === 'apih_hito_estado' && r.hito[1].p_id === 'HIT-900' && r.hito[1].p_completado === true && r.hitoLocal === false
    && r.dec && r.dec[0] === 'apih_resolver_decision' && r.dec[1].p_aplicar === true && r.dec[1].p_estado === 'Aprobada'
    && r.cmds.join() === 'apih_solicitar_cambio,apih_resolver_cambio,apih_reabrir' && r.cambioLocal === 'Solicitado';
  console.log(ok ? 'OK cmd-srv' : 'FALLA cmd-srv'); await b.close(); process.exit(ok ? 0 : 1);
})();
