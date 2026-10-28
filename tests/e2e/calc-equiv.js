// Iter 2: los valores que entrega el servidor (apih_calculos) coinciden con las fórmulas de la app sobre 80 escenarios generados
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296, pick = a => a[Math.floor(rnd() * a.length)], int = (a, z) => a + Math.floor(rnd() * (z - a + 1));
    St.cfg.hoyFija = '2026-10-28';
    const fases = FASES_PRJ.slice(), esta = ['En curso', 'En curso', 'En curso', 'Completado', 'Cancelado', 'Stand By', 'En pausa'];
    const out = { n: 0, dif: [] }; const f = (d) => addD('2026-10-28', d);
    for (let k = 0; k < 80; k++) {
      const id = 'EQ-' + String(k).padStart(3, '0'), ini0 = int(-200, 60), fin0 = ini0 + int(20, 300), estado = pick(esta);
      const o = Object.assign(ESQUEMA.projects.tpl(), { id, tipo: 'Proyecto', titulo: 'Equiv ' + k, area: 'BISE', fase: pick(fases), estado, rag: pick(['Verde', 'Ámbar', 'Rojo']), prioridad: pick(['Alta', 'Media', 'Baja', '']),
        avance: int(0, 100), inicioPlan: rnd() < .1 ? '' : f(ini0), finPlan: rnd() < .1 ? '' : f(fin0), presupuesto: rnd() < .3 ? 0 : int(100, 9000), beneficio: rnd() < .3 ? 0 : int(100, 20000),
        lider: rnd() < .15 ? '' : 'Persona ' + int(1, 4), sponsor: rnd() < .3 ? '' : 'Sponsor', desc: rnd() < .5 ? '' : 'd', bc: rnd() < .5 ? '' : 'b', negocio: rnd() < .5 ? '' : 'n', actualizada: rnd() < .2 ? '' : f(-int(0, 60)),
        finEst: rnd() < .4 ? f(fin0 + int(-10, 40)) : '', finReal: estado === 'Completado' ? f(fin0 + int(-10, 10)) : '' });
      o._fase = o.fase; o._estado = o.estado; o.fase = fases[0]; o.estado = 'En curso'; o.finReal = ''; St.ini.push(o);
      for (let h = 0; h < int(0, 5); h++) { const done = rnd() < .5; St.hitos.push(Object.assign(ESQUEMA.milestones.tpl(), { id: 'EH-' + k + '-' + h, ini: id, nombre: 'h' + h, fase: pick(fases), fecha: f(int(-120, 120)), completado: done, fechaReal: done && rnd() < .5 ? f(int(-120, 120)) : '' })); }
      for (let q = 0; q < int(0, 3); q++) St.riesgos.push(Object.assign(ESQUEMA.risks.tpl(), { id: 'ER-' + k + '-' + q, ini: id, titulo: 'r', prob: int(1, 5), imp: int(1, 5), estado: pick(['Abierto', 'Abierto', 'Cerrado', 'Mitigado']) }));
    }
    save(); await DataService.flush();
    St.ini.filter(x => x._fase).forEach(i => { i.fase = i._fase; i.estado = i._estado; if (i.estado === 'Completado') i.finReal = addD('2026-10-28', -5); delete i._fase; delete i._estado; });
    save(); await DataService.flush();
    await DataService.refresh(true, true); St.cfg.hoyFija = '2026-10-28';   // se compara contra lo que la base realmente guardó
    const C = await DataService.svc.rpc('apih_calculos');
    const cmp = (k, a, b) => { out.n++; const canon = v => JSON.stringify(v, (kk, vv) => vv && typeof vv === 'object' && !Array.isArray(vv) ? Object.fromEntries(Object.entries(vv).sort(([m], [n]) => m < n ? -1 : 1)) : vv), x = canon(a), y = canon(b); if (x !== y && !(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-6)) { if (out.dif.length < 25) out.dif.push(k + ' cliente=' + x + ' servidor=' + y); } };
    for (const i of St.ini.filter(x => x.id.startsWith('EQ-'))) {
      const c = C.ini[i.id]; if (!c) { out.dif.push('sin cálculo ' + i.id); continue; }
      cmp(i.id + ' forecast', forecast(i) || null, c.forecast); cmp(i.id + ' desv', desv(i), c.desv); cmp(i.id + ' atrasado ' + JSON.stringify([i.fase, i.estado, desv(i), St.cfg.tolDesv, c.desv, c.tol, i.lider, St.cfg.fijos]), !!atrasado(i), c.atrasado);
      cmp(i.id + ' esperado', esperado(i), c.esperado); cmp(i.id + ' roi', roi(i), c.roi); const rg = ragSugerido(i); cmp(i.id + ' rag', rg, c.rag);
      cmp(i.id + ' crit', critScore(i), c.crit); cmp(i.id + ' dsu', diasSinUpd(i), c.dsu); cmp(i.id + ' compl', completitud(i), c.compl);
    }
    for (const h of St.hitos.filter(x => x.id.startsWith('EH-'))) { const e = hitoEstado(h), c = C.hitos[h.id]; cmp(h.id + ' estado', { k: e.k, t: e.t, c: e.c }, c); }
    for (const r of St.riesgos.filter(x => x.id.startsWith('ER-'))) { const c = C.riesgos[r.id], n = nivelRiesgo(expo(r)); cmp(r.id + ' expo', expo(r), c.expo); cmp(r.id + ' nivel', n, c.nivel); }
    return out;
  });
  console.log('comparaciones:', r.n); r.dif.forEach(d => console.log('FALLA', d));
  if (errs.length) console.log('errores de página:', errs.slice(0, 3));
  await b.close(); console.log(r.dif.length ? 'FALLA calc-equiv (' + r.dif.length + '+)' : 'OK calc-equiv'); process.exit(r.dif.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
