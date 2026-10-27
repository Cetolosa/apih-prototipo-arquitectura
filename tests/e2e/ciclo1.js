// V23 · Ciclo de vida: diálogo único «Cambiar etapa», avance calculado/manual, fechas por fase, autocompletado, subfases.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  await p.evaluate(() => { celebrar = () => {};
    const mk = (id, x) => { St.ini.push(Object.assign({ id, titulo: id, area: 'TI', tipo: 'Proyecto', fase: 'Planificación', estado: 'En curso', rag: 'Verde', sponsor: 'S', lider: 'L', presupuesto: 100, categoria: 'Tecnología', inicioPlan: '2026-01-01', finPlan: '2026-04-10', creada: '2026-01-01', faseDesde: '2026-01-01', actualizada: '2026-01-01', est: [], tags: [], deps: [], hist: [], avance: 0 }, x)); };
    const hit = (ini, fase, done, x) => St.hitos.push(Object.assign({ id: ini + '-H' + St.hitos.length, ini, nombre: 'h', fase, fecha: '2100-01-01', completado: !!done, fechaReal: done ? '2026-02-01' : null }, x || {}));
    mk('V23-A', {}); hit('V23-A', 'Planificación', true); hit('V23-A', 'Planificación', true);
    mk('V23-B', { avance: 60 }); hit('V23-B', 'Planificación', true); hit('V23-B', 'Planificación', false);
    mk('V23-C', { fase: 'Cierre' }); hit('V23-C', 'Planificación', true); hit('V23-C', 'Ejecución', true); hit('V23-C', 'Transición', true); hit('V23-C', 'Cierre', false, { id: 'V23-C-ULT' });
    mk('V23-D', { fase: 'Ejecución', subfases: [{ id: 'V23-D-SF1', nombre: 'S1', fase: 'Ejecución', inicio: '2026-02-01', fin: '2026-03-01' }] });
    hit('V23-D', 'Ejecución', true, { subfase: 'V23-D-SF1' }); hit('V23-D', 'Ejecución', false, { subfase: 'V23-D-SF1' }); hit('V23-D', 'Ejecución', true);
    render(); });
  const r = {}, ev = (f, a) => p.evaluate(f, a);
  // 1) diálogo único: ofrece fases y estados; aplica la fase
  await ev(() => Acts.etapa({ id: 'V23-A' })); await p.waitForTimeout(250);
  r.grupos = await p.$$eval('#et_acc optgroup', a => a.map(x => x.label).join('|'));
  r.opcFase = await p.$$eval('#et_acc option', a => a.map(x => x.value).join(','));
  await p.selectOption('#et_acc', 'f:Ejecución'); await p.waitForTimeout(100);
  r.gatesVisibles = await p.$$eval('#et_d .gates > div', a => a.length);
  await p.click('[data-act="etapago"]'); await p.waitForTimeout(300);
  r.fase = await ev(() => byId('V23-A').fase);
  // sin botones sueltos de Fase/Estado en el panel
  await ev(() => { render(); Acts.sel({ t: 'ini', id: 'V23-A' }); }); await p.waitForTimeout(300);
  r.btnCambiar = await p.$$eval('[data-act="etapa"]', a => a.length);
  r.btnViejos = await p.$$eval('[data-act="estado"]', a => a.length);
  // 2) formulario de edición: sin fase ni avance libre; sí el ajuste manual
  await ev(() => Acts.edit({ t: 'ini', id: 'V23-A' })); await p.waitForTimeout(250);
  r.editSinFase = await p.$$eval('#f_fase', a => a.length) === 0;
  r.editSinAvance = await p.$$eval('#f_avance, #f_avanceFase', a => a.length) === 0;
  r.editManual = await p.$$eval('#f_avanceManual', a => a.length) === 1;
  await p.click('[data-act="mclose"]'); await p.waitForTimeout(150);
  // 3) avance: calculado, manual manda, las compuertas leen el calculado
  r.calcA = await ev(() => { sincAvance(byId('V23-A')); return byId('V23-A').avance; });
  r.calcAfase = await ev(() => Math.round(avanceFaseCalc(byId('V23-A'), 'Planificación') * 100));
  r.manual = await ev(() => { const i = byId('V23-A'); i.avanceManual = 90; sincAvance(i); return [i.avance, i.avanceCalc, avanceEf(i)].join('|'); });
  r.gateLeeCalc = await ev(() => { const i = byId('V23-C'); i.avanceManual = 100; sincAvance(i); const f = gates(i, 'Cierre').filter(g => !g.ok).map(g => g.t); i.avanceManual = null; sincAvance(i); return f.join(','); });
  await ev(() => { const i = byId('V23-A'); i.avanceManual = null; sincAvance(i); });
  // 4) proyecto previo: su avance guardado se conserva como ajuste manual visible
  r.legacy = await ev(() => { const i = byId('V23-B'); sincAvance(i); return [i.avance, i.avanceManual, i.avanceCalc].join('|'); });
  // 5) subfase aporta: S1 (1/2) y 1 hito suelto (1/1) → fase 75 %
  r.subfase = await ev(() => Math.round(avanceFaseCalc(byId('V23-D'), 'Ejecución') * 100));
  // 6) fechas explícitas por fase
  r.reparto = await ev(() => { const i = byId('V23-A'); setRangoPlan(i, '2026-01-01', '2026-04-10'); const f = fasesFechasDe(i); return fasesDe(i).map(k => f[k].ini + '>' + f[k].fin).join(' '); });
  r.derivaFin = await ev(() => byId('V23-A').finPlan);
  r.valida = await ev(() => { const i = byId('V23-A'), f = JSON.parse(JSON.stringify(fasesFechasDe(i))); f['Ejecución'].ini = f['Planificación'].ini; return String(validarFasesFechas(i, f) || ''); });
  r.moverFin = await ev(() => { const i = byId('V23-A'); moverFinPlan(i, '2026-05-10'); return i.finPlan + '|' + fasesFechasDe(i)['Cierre'].fin; });
  // 7) autocompletado al cerrar el último hito de la última fase
  await ev(() => toggleHito('V23-C-ULT')); await p.waitForTimeout(250);
  r.auto = await ev(() => { const i = byId('V23-C'); return [i.estado, i.avance, !!i.finReal].join('|'); });
  // 8) Stand By exige motivo desde el mismo diálogo
  await ev(() => Acts.etapa({ id: 'V23-B', pre: 'e:Stand By' })); await p.waitForTimeout(250);
  r.sbCampo = await p.$$eval('#et_mot', a => a.length);
  await p.click('[data-act="etapago"]'); await p.waitForTimeout(200);
  r.sbSinMotivo = await ev(() => byId('V23-B').estado);
  await p.fill('#et_mot', 'congelado por presupuesto'); await p.click('[data-act="etapago"]'); await p.waitForTimeout(300);
  r.sbOk = await ev(() => byId('V23-B').estado);
  // 9) arrastrar en el tablero ya no salta compuertas: abre el mismo diálogo
  const mal = [];
  const w = (k, v) => { if (JSON.stringify(r[k]) !== JSON.stringify(v)) mal.push(k + ' = ' + JSON.stringify(r[k]) + ' (esperado ' + JSON.stringify(v) + ')'); };
  w('fase', 'Ejecución'); w('btnCambiar', 1); w('btnViejos', 0); w('editSinFase', true); w('editSinAvance', true); w('editManual', true);
  w('calcA', 25); w('calcAfase', 100); w('manual', '90|25|90'); w('gateLeeCalc', 'Avance al 100%,Todos los hitos completados'.split(',').filter(x => x === 'Avance al 100%').join(',')); w('legacy', '60|60|' + r.legacy.split('|')[2]); w('subfase', 75);
  w('reparto', '2026-01-01>2026-01-15 2026-01-16>2026-03-11 2026-03-12>2026-03-26 2026-03-27>2026-04-10'); w('derivaFin', '2026-04-10'); w('moverFin', '2026-05-10|2026-05-10');
  w('auto', 'Completado|100|true'); w('sbCampo', 1); w('sbSinMotivo', 'En curso'); w('sbOk', 'Stand By');
  if (!/Mover de fase/.test(r.grupos) || !/Cambiar estado/.test(r.grupos)) mal.push('grupos = ' + r.grupos);
  if (!r.valida) mal.push('validarFasesFechas no detectó el solape');
  mal.forEach(m => console.log('DIVERGE', m));
  const ok = !err.length && !mal.length;
  console.log(ok ? 'OK ciclo1' : 'FALLA ciclo1', JSON.stringify(err)); if (!ok) console.log(JSON.stringify(r)); await b.close(); process.exit(ok ? 0 : 1);
})();
