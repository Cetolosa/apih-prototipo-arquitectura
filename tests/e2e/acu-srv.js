// Iter 5d: compromisos por comando del servidor (alta, error con campo, cumplir/reabrir, eliminar); la SPA no inventa id ni fecha real
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const o = {}, esp = ms => new Promise(x => setTimeout(x, ms)), set = (k, v) => { const e = $('#f_' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const n0 = St.compromisos.length;
    Acts.acunew({}); await esp(200);
    set('texto', 'Enviar acta a Finanzas'); set('resp', 'Ana Prueba'); set('limite', ''); Acts.msave(); await esp(500);
    o.abiertoTrasError = !!Modal.cur; o.campoMarcado = $('#f_limite').classList.contains('bad');
    set('limite', '2026-11-20'); Acts.msave(); await esp(800);
    const n = St.compromisos.find(x => x.texto === 'Enviar acta a Finanzas');
    o.alta = n ? { id: n.id, estado: n.estado, fechaReal: n.fechaReal, origen: n.origen } : null; o.cerrado = !Modal.cur; o.cuenta = St.compromisos.length - n0;
    const ch = document.querySelector('[data-chg="acutoggle"][data-id="' + (n && n.id) + '"]');
    o.hayCasilla = !!ch;
    if (n) { await Chg.acutoggle({ dataset: { id: n.id }, checked: true }); await esp(800); const c = St.compromisos.find(x => x.id === n.id); o.cumplido = c && c.estado === 'Cumplido' && /^\d{4}-\d{2}-\d{2}$/.test(c.fechaReal || '');
      await Chg.acutoggle({ dataset: { id: n.id }, checked: false }); await esp(800); const d = St.compromisos.find(x => x.id === n.id); o.reabierto = d && d.estado === 'Abierto' && !d.fechaReal;
      await eliminarEnServidor('APIH_Compromisos', n.id, null); o.eliminado = !St.compromisos.find(x => x.id === n.id); }
    return o;
  });
  ok(r.abiertoTrasError && r.campoMarcado, 'sin fecha: el servidor rechaza y el formulario marca el campo');
  ok(r.alta && /^ACU-\d{3}$/.test(r.alta.id) && r.alta.estado === 'Abierto' && !r.alta.fechaReal && r.alta.origen === 'manual' && r.cerrado && r.cuenta === 1, 'alta: id, estado y origen los pone el servidor');
  ok(r.cumplido, 'cumplir: el servidor deja la fecha real');
  ok(r.reabierto, 'reabrir: sin fecha real');
  ok(r.eliminado, 'eliminar por el servidor');
  await b.close(); console.log(f.length ? 'FALLA acu-srv' : 'OK acu-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
