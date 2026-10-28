// Iter 5d: comités por comando del servidor (alta con participantes, tema, acción, asistencia, cumplir, agenda, cierre, eliminar)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const o = {}, esp = ms => new Promise(x => setTimeout(x, ms)), set = (k, v) => { const e = $('#f_' + k); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const cur = id => St.comites.find(x => x.id === id);
    Acts.new({ t: 'com' }); await esp(200); set('nombre', ''); set('fecha', '2026-12-01'); Acts.msave(); await esp(500);
    o.errNombre = !!Modal.cur && $('#f_nombre').classList.contains('bad');
    set('nombre', 'Comité de prueba e2e'); Acts.msave(); await esp(900);
    const c = St.comites.find(x => x.nombre === 'Comité de prueba e2e'); o.alta = c ? { id: c.id, parts: c.participantes.length, estado: c.estado } : null; o.cerrado = !Modal.cur;
    if (!c) return o;
    Acts.ctema({ id: c.id }); await esp(200); set('t', 'Tema e2e'); Acts.msave(); await esp(800); o.tema = cur(c.id).temas.length === 1;
    Acts.cpart({ id: c.id }); await esp(200); set('n', 'Invitada e2e'); Acts.msave(); await esp(800); const k = cur(c.id).participantes.length - 1; o.part = cur(c.id).participantes[k].n === 'Invitada e2e';
    await Chg.catt({ dataset: { c: c.id, k: String(k) }, checked: true }); await esp(800); o.asis = cur(c.id).participantes[k].asistio === true;
    Acts.cacc({ id: c.id, k: 'acciones' }); await esp(200); set('texto', 'Acción e2e'); Acts.msave(); await esp(800);
    const a = cur(c.id).acciones[0]; o.acc = !!a && /^ACC-/.test(a.id) && a.estado === 'Abierta';
    await Chg.ctoggle({ dataset: { c: c.id, k: 'acciones', id: a.id }, checked: true }); await esp(800); o.accCerrada = cur(c.id).acciones[0].estado === 'Cerrada';
    await Acts.cdel({ c: c.id, k: 'acciones', id: a.id }); await esp(800); o.accQuitada = cur(c.id).acciones.length === 0;
    await Acts.carmar({ id: c.id, kind: 'prop' }); await esp(800); o.agenda = cur(c.id).temas.length >= 1;
    await cmdServidor('apih_comite_cerrar', { p_id: c.id }, null); o.cierre = cur(c.id).estado === 'Realizado';
    o.bit = St.bitacora.some(x => /Comité programado/.test(x.texto)) ;
    await eliminarEnServidor('APIH_Comites', c.id, null); o.eliminado = !cur(c.id);
    return o;
  });
  ok(r.errNombre, 'sin nombre: el servidor rechaza y el formulario marca el campo');
  ok(r.alta && /^COM-\d{3}$/.test(r.alta.id) && r.alta.parts >= 1 && r.alta.estado === 'Programado' && r.cerrado, 'alta: id y participantes iniciales del servidor');
  ok(r.tema && r.part && r.asis, 'agregar tema y participante; asistencia');
  ok(r.acc && r.accCerrada && r.accQuitada, 'acción: id del servidor, cumplir y quitar');
  ok(r.agenda, 'armar agenda la hace el servidor');
  ok(r.cierre && r.bit, 'cerrar sesión y bitácora del servidor');
  ok(r.eliminado, 'eliminar comité');
  await b.close(); console.log(f.length ? 'FALLA comite-srv' : 'OK comite-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
