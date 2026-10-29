// J1: la importancia de los pasos (base + ajuste propio, acotada a 0–100), los pendientes personales y la escritura de la configuración las resuelve el servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-909', titulo: 'Importancia e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, avanceManual: 40, actualizada: addD(H, -5), inicioPlan: addD(H, -30), finPlan: addD(H, 120), finEst: addD(H, 120) }));
    St.hitos.push({ id: 'HIT-909', ini: 'PRJ-909', nombre: 'Entrega e2e', fase: 'Ejecución', fecha: addD(H, -3), completado: false, fechaReal: null, resp: me });
    await sembrarSt(); await DataService.refresh(false, true); });
  const pasos = () => p.evaluate(() => ((CALC.cielo || {}).pasos || {})['PRJ-909'] || []);
  const antes = await pasos();
  ok(antes.length > 0 && antes.every(x => Number.isInteger(x.base) && Number.isInteger(x.pts) && x.aj === 0 && x.pts === Math.min(100, x.base)), 'cada paso trae base, ajuste y puntaje del servidor');
  const k0 = (antes.find(x => x.pts <= 70) || antes[antes.length - 1]).k;
  await p.evaluate(k => Chg.pasoaj({ dataset: { k }, value: '30' }), k0); await p.waitForTimeout(1200);
  const mov = (await pasos()).find(x => x.k === k0), ant = antes.find(x => x.k === k0);
  ok(mov && mov.aj === 30 && mov.pts === Math.min(100, ant.base + 30), 'el ajuste propio lo suma y lo acota el servidor');
  const inv = await p.evaluate(async k => { try { await DataService.svc.rpc('apih_ajustar_paso', { p_k: k, p_aj: 7 }); return 'sin error'; } catch (e) { return e.message; } }, k0);
  ok(/Baja|Normal|Alta|Máxima/.test(inv), 'un ajuste fuera de la lista lo rechaza el servidor: ' + inv.slice(0, 60));
  await p.evaluate(k => Chg.pasoaj({ dataset: { k }, value: '0' }), k0); await p.waitForTimeout(1000);
  ok(((await pasos()).find(x => x.k === k0) || {}).aj === 0, 'ajuste Normal lo quita');
  // pendientes personales
  const t1 = await p.evaluate(async () => { const r = await DataService.svc.rpc('apih_guardar_tarea', { p_tarea: { t: 'Preparar capacitación', cat: 'Desarrollo profesional', f: addD(hoy(), 2) } }); await DataService.refresh(false, true); return r; });
  const tareas = () => p.evaluate(() => (CALC.cielo || {}).tareas || []);
  const L = await tareas();
  ok(t1 && t1.id && L.length === 1 && L[0].tarea.id === t1.id && L[0].u === 1 && L[0].pts === L[0].base, 'el pendiente lo crea el servidor y trae su importancia');
  const largo = await p.evaluate(async () => { try { await DataService.svc.rpc('apih_guardar_tarea', { p_tarea: { t: 'x'.repeat(201) } }); return 'sin error'; } catch (e) { return e.message; } });
  ok(/200 caracteres/.test(largo), 'el largo del pendiente lo valida el servidor');
  await p.evaluate(id => Acts.tareahecha({ id }), t1.id); await p.waitForTimeout(1200);
  ok((await tareas()).length === 0, 'marcar hecho lo resuelve el servidor');
  // configuración: una sola vía
  const cfg = await p.evaluate(async () => {
    const o = {};
    try { await DataService.svc.rpc('apih_guardar_ajuste', { p_clave: 'cfg', p_valor: { umbralCritico: 99 } }); o.rango = 'sin error'; } catch (e) { o.rango = e.message; }
    try { await DataService.svc._rest('registros?on_conflict=lista,id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify([{ lista: 'APIH_Config', id: 'eventos', datos: 'p1.[]' }]) }); o.directo = 'sin error'; } catch (e) { o.directo = 'rechazado'; }
    return o; });
  ok(/entre 1 y 25/.test(cfg.rango), 'un parámetro fuera de rango lo rechaza el servidor');
  ok(cfg.directo === 'rechazado', 'la tabla de configuración no se escribe directo');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA ajuste-srv' : 'OK ajuste-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
