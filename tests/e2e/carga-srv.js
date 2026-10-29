// Iter 5k: la carga desde Excel la aplica el servidor (apih_cargar_lote), fila por fila
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-906', titulo: 'Carga e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, actualizada: H, inicioPlan: addD(H, -30), finPlan: addD(H, 120) }));
    St.hitos.push({ id: 'HIT-906', ini: 'PRJ-906', nombre: 'Existente', fase: 'Ejecución', fecha: addD(H, 10), completado: false, resp: me });
    await sembrarSt(); await DataService.refresh(false, true);
    const i = byId('PRJ-906'), cur = St.hitos.find(h => h.id === 'HIT-906');
    CX.name = 'prueba.xlsx';
    CX.res = { plan: [{ i, ch: { finPlan: addD(H, 150), avance: 35 } }], hitos: [{ cur, ch: { fecha: addD(H, 20) }, id: i.id, nm: cur.nombre }, { nuevo: { ini: 'PRJ-906', nombre: 'Desde Excel', fase: '', fecha: addD(H, 30), completado: false, fechaReal: null, resp: me }, id: i.id, nm: 'Desde Excel' }], errs: [], warns: [], vacio: false };
    Acts.cxapply(); for (let k = 0; k < 40 && !hitosDe('PRJ-906').some(h => h.nombre === 'Desde Excel'); k++) await new Promise(r => setTimeout(r, 250));
    const o = { fin: byId('PRJ-906').finPlan === addD(H, 150), man: byId('PRJ-906').avanceManual === 35, fecha: hitosDe('PRJ-906').find(h => h.id === 'HIT-906').fecha === addD(H, 20), nuevo: hitosDe('PRJ-906').filter(h => h.nombre === 'Desde Excel').length, idSrv: (hitosDe('PRJ-906').find(h => h.nombre === 'Desde Excel') || {}).id || '' };
    o.dbg = JSON.stringify({ f: byId('PRJ-906').finPlan, e: addD(H, 150), m: byId('PRJ-906').avanceManual }); o.bit = St.bitacora.some(b => /Carga desde Excel \(prueba\.xlsx\)/.test(b.texto));
    return o;
  });
  ok(r.fin && r.man, 'la ficha cambió (fin plan y avance manual) ');
  ok(r.fecha, 'el hito existente cambió de fecha');
  ok(r.nuevo === 1 && /^HIT-\d+/.test(r.idSrv), 'el hito nuevo existe una vez, con id del servidor');
  ok(r.bit, 'queda una anotación de la carga en la bitácora');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA carga-srv' : 'OK carga-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
