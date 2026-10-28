// Iter 2: la SPA muestra los valores calculados que entrega el servidor (no hay fórmulas en el navegador)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    St.cfg.hoyFija = '2026-10-28';
    const i = Object.assign(ESQUEMA.projects.tpl(), { id: 'CS-1', tipo: 'Proyecto', titulo: 'Calculos', area: 'BISE', fase: FASES_PRJ[0], estado: 'En curso', rag: 'Verde', avance: 10, inicioPlan: '2026-08-01', finPlan: '2026-10-01', presupuesto: 1000, beneficio: 1500, lider: 'Ana', sponsor: 'S' });
    St.ini.push(i);
    St.hitos.push(Object.assign(ESQUEMA.milestones.tpl(), { id: 'CS-H1', ini: 'CS-1', nombre: 'v', fase: FASES_PRJ[0], fecha: '2026-10-20', completado: false }));
    St.riesgos.push(Object.assign(ESQUEMA.risks.tpl(), { id: 'CS-R1', ini: 'CS-1', titulo: 'r', prob: 4, imp: 4, estado: 'Abierto' }));
    const antes = { desv: desv(i), roi: roi(i), exp: expo(St.riesgos.find(x => x.id === 'CS-R1')) };
    save(); await DataService.flush();
    const rk = St.riesgos.find(x => x.id === 'CS-R1'), h = St.hitos.find(x => x.id === 'CS-H1');
    return { antes, desv: desv(i), roi: Math.round(roi(i)), expo: expo(rk), nivel: nivelRiesgo(rk).n, hito: hitoEstado(h).t, atrasado: atrasado(i), rag: ragSugerido(i).rag, crit: riesgoCritico(rk) };
  });
  ok(r.antes.desv === 0 && r.antes.roi === null && r.antes.exp === 0, 'sin sincronizar el navegador no inventa valores');
  ok(r.hito === 'Vencido (8 d)', 'estado del hito: ' + r.hito);
  ok(r.desv === 27 && r.atrasado === true, 'desvío y atraso: ' + r.desv);
  ok(r.roi === 50, 'ROI del servidor');
  ok(r.expo === 16 && r.nivel === 'Crítico' && r.crit, 'exposición y nivel del riesgo');
  ok(['Ámbar', 'Rojo'].includes(r.rag), 'semáforo sugerido: ' + r.rag);
  await b.close(); console.log(f.length ? 'FALLA calculos-srv' : 'OK calculos-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
