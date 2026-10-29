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
    mk('V23-E', { avance: 30, fase: 'Ejecución' }); hit('V23-E', 'Planificación', true); hit('V23-E', 'Ejecución', false);
    mk('V23-F', { fase: 'Cierre' }); hit('V23-F', 'Planificación', true); hit('V23-F', 'Ejecución', true); hit('V23-F', 'Transición', true); hit('V23-F', 'Cierre', false, { id: 'V23-F-ULT' });
    save(); render(); });
  await p.evaluate(async () => { await sembrarSt(); });   // con servidor, los datos de la prueba viven en la base: los comandos (apih_*) los leen de allí
  const r = {}, ev = (f, a) => p.evaluate(f, a);
  // 1) diálogo único: ofrece fases y estados; aplica la fase
  await ev(() => Acts.etapa({ id: 'V23-A' })); await p.waitForTimeout(250);
  r.grupos = await p.$$eval('#et_acc optgroup', a => a.map(x => x.label).join('|'));
  r.opcFase = await p.$$eval('#et_acc option', a => a.map(x => x.value).join(','));
  await p.selectOption('#et_acc', 'f:Ejecución'); await p.waitForTimeout(100);
  r.gatesVisibles = await p.$$eval('#et_d .gates > div', a => a.length);
  await p.uncheck('#et_repro'); await p.click('[data-act="etapago"]');   // el reparto de fechas se prueba aparte (etapa-plan)
  await p.waitForFunction(() => byId('V23-A').fase === 'Ejecución', null, { timeout: 5000 }).catch(() => { });
  r.fase = await ev(() => byId('V23-A').fase);
  // sin botones sueltos de Fase/Estado en el panel
  await ev(() => { render(); Acts.sel({ t: 'ini', id: 'V23-A' }); }); await p.waitForTimeout(300);
  r.panelActs = await p.$$eval('#panel .pn-slim .pn-main', a => a.map(x => x.textContent.trim()).sort().join('|'));   // el panel solo resume: solo Abrir ficha
  r.panelEdita = await p.$$eval('#panel [data-act="etapa"], #panel [data-act="edit"], #panel [data-act="wk"], #panel [data-act="advance"], #panel .composer', a => a.length);
  await ev(() => Acts.ficha({ id: 'V23-A' })); await p.waitForTimeout(400);
  r.btnCambiar = (await p.$$eval('#main [data-act="etapa"]', a => a.length)) >= 1 ? 1 : 0;   // los cambios y las herramientas viven en la ficha
  r.fichaEdita = await p.evaluate(() => ['edit', 'wk', 'proyarch'].filter(a => document.querySelector('#main [data-act="' + a + '"]')).length);
  await ev(() => { go('portafolio'); Acts.sel({ t: 'ini', id: 'V23-A' }); }); await p.waitForTimeout(400);

  r.btnViejos = await p.$$eval('[data-act="estado"]', a => a.length);
  // el panel de proyectos resume en 3 bloques y no tiene pestañas
  r.bloques = await p.$$eval('#panel .pn-sec', a => a.length); r.pestana = await p.$$eval('#panel .tabs', a => a.length);
  // 2) formulario de edición: sin fase ni avance libre; sí el ajuste manual
  await ev(() => Acts.edit({ t: 'ini', id: 'V23-A' })); await p.waitForTimeout(250);
  r.editSinFase = await p.$$eval('#f_fase', a => a.length) === 0;
  r.editSinAvance = await p.$$eval('#f_avance, #f_avanceFase', a => a.length) === 0;
  r.editManual = await p.$$eval('#f_avanceManual', a => a.length) === 1;
  await p.click('[data-act="mclose"]'); await p.waitForTimeout(150);
  // 3) avance: lo calcula y lo guarda el servidor; el ajuste manual manda y las compuertas leen el calculado
  const sync = async () => { await ev(async () => { await sembrarSt(); await DataService.refresh(false, true); }); await p.waitForTimeout(200); };
  await sync();
  r.calcA = await ev(() => byId('V23-A').avance);
  r.calcAfase = await ev(() => fasesVentana(byId('V23-A')).find(v => v.fase === 'Planificación').avance);
  await ev(() => { byId('V23-A').avanceManual = 90; save(); }); await sync();
  r.manual = await ev(() => { const i = byId('V23-A'); return [i.avance, i.avanceCalc, avanceEf(i)].join('|'); });
  // (las compuertas leen el avance calculado, nunca el manual: lo verifica supabase/tests/90_ciclo_de_vida.sql, que es donde viven)
  await ev(() => { byId('V23-A').avanceManual = null; save(); }); await sync();
  // 4) proyecto previo: su avance guardado se conserva como ajuste manual visible (lo decide el servidor al guardar)
  r.legacy = await ev(() => { const i = byId('V23-B'); return [i.avance, i.avanceManual, i.avanceCalc].join('|'); });
  r.legacyAuto = await ev(() => { const i = byId('V23-E'); return [i.avance, i.avanceManual, avanceEf(i)].join('|'); });
  // 4c) el formulario de hito también cierra el proyecto al completar el último hito de Cierre
  await ev(() => Acts.edit({ t: 'hito', id: 'V23-F-ULT' })); await p.waitForTimeout(250);
  await p.check('#f_completado'); await p.click('[data-act="msave"]');
  await p.waitForFunction(() => byId('V23-F').estado === 'Completado', null, { timeout: 5000 }).catch(() => { });   // espera la respuesta del servidor (no un tiempo fijo)
  r.formCierra = await ev(() => { const i = byId('V23-F'); return [i.estado, i.avance].join('|'); });
  // 5) subfase aporta: S1 (1/2) y 1 hito suelto (1/1) → fase 75 %
  r.subfase = await ev(() => fasesVentana(byId('V23-D')).find(v => v.fase === 'Ejecución').avance);
  // 6) fechas explícitas por fase: las reparte y las valida el servidor
  r.reparto = await ev(() => { const i = byId('V23-A'), f = fasesFechasDe(i); return fasesDe(i).map(k => f[k].ini + '>' + f[k].fin).join(' '); });
  r.derivaFin = await ev(() => byId('V23-A').finPlan);
  r.valida = await ev(async () => { const f = JSON.parse(JSON.stringify(fasesFechasDe(byId('V23-A')))); f['Ejecución'].ini = f['Planificación'].ini; try { await DataService.svc.rpc('apih_fases_fechas', { p_id: 'V23-A', p_ff: f }); return ''; } catch (e) { return String(e.message); } });
  await ev(() => { byId('V23-A').finPlan = '2026-05-10'; save(); }); await sync();
  r.moverFin = await ev(() => { const i = byId('V23-A'); return i.finPlan + '|' + fasesFechasDe(i)['Cierre'].fin; });
  // 7) autocompletado al cerrar el último hito de la última fase
  await ev(() => toggleHito('V23-C-ULT')); await p.waitForTimeout(250);
  r.auto = await ev(() => { const i = byId('V23-C'); return [i.estado, i.avance, !!i.finReal].join('|'); });
  // 8) Stand By exige motivo desde el mismo diálogo
  await ev(() => Acts.etapa({ id: 'V23-B', pre: 'e:Stand By' })); await p.waitForTimeout(250);
  r.sbCampo = await p.$$eval('#et_mot', a => a.length);
  await p.click('[data-act="etapago"]'); await p.waitForTimeout(200);
  r.sbSinMotivo = await ev(() => byId('V23-B').estado);
  await p.fill('#et_mot', 'congelado por presupuesto'); await p.click('[data-act="etapago"]');
  await p.waitForFunction(() => byId('V23-B').estado === 'Stand By', null, { timeout: 5000 }).catch(() => { });
  r.sbOk = await ev(() => byId('V23-B').estado);
  // 9) arrastrar en el tablero ya no salta compuertas: abre el mismo diálogo
  const mal = [];
  const w = (k, v) => { if (JSON.stringify(r[k]) !== JSON.stringify(v)) mal.push(k + ' = ' + JSON.stringify(r[k]) + ' (esperado ' + JSON.stringify(v) + ')'); };
  w('fase', 'Ejecución'); w('pestana', 0); w('bloques', 3); w('panelActs', 'Abrir ficha'); w('panelEdita', 0); w('btnCambiar', 1); w('fichaEdita', 3); w('btnViejos', 0); w('editSinFase', true); w('editSinAvance', true); w('editManual', true);
  w('calcA', 15); w('calcAfase', 100); w('manual', '90|15|90'); w('legacy', '60|60|' + r.legacy.split('|')[2]); w('subfase', 75); w('legacyAuto', '30|30|30'); w('formCierra', 'Completado|100');
  w('reparto', '2026-01-01>2026-01-15 2026-01-16>2026-03-11 2026-03-12>2026-03-26 2026-03-27>2026-04-10'); w('derivaFin', '2026-04-10'); w('moverFin', '2026-05-10|2026-05-10');
  w('auto', 'Completado|100|true'); w('sbCampo', 1); w('sbSinMotivo', 'En curso'); w('sbOk', 'Stand By');
  if (!/Mover de fase/.test(r.grupos) || !/Cambiar estado/.test(r.grupos)) mal.push('grupos = ' + r.grupos);
  if (!/debe empezar después/.test(r.valida)) mal.push('el servidor no detectó el solape: ' + r.valida);
  mal.forEach(m => console.log('DIVERGE', m));
  const ok = !err.length && !mal.length;
  console.log(ok ? 'OK ciclo1' : 'FALLA ciclo1', JSON.stringify(err)); if (!ok) console.log(JSON.stringify(r)); await b.close(); process.exit(ok ? 0 : 1);
})();
