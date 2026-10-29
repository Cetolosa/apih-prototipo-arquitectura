// Iter 5l: la actualización semanal la guarda el servidor (apih_actualizacion_semanal)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  await p.evaluate(async () => { celebrar = () => {}; const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-907', titulo: 'Semanal e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, actualizada: addD(H, -20), inicioPlan: addD(H, -30), finPlan: addD(H, 120), finEst: addD(H, 120) }));
    await sembrarSt(); await DataService.refresh(false, true); Acts.wk({ id: 'PRJ-907' }); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const set = (k, v) => { const el = document.getElementById('f_' + k); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('avance', '55'); set('rag', 'Ámbar'); set('logros', 'Logro e2e'); set('proximos', 'Paso e2e'); });
  await p.evaluate(() => { const bt = [...document.querySelectorAll('.modal button')].find(x => /^Guardar/.test(x.textContent.trim())); bt.click(); });
  const r = await p.evaluate(async () => { for (let k = 0; k < 40 && byId('PRJ-907').rag !== 'Ámbar'; k++) await new Promise(r => setTimeout(r, 250));
    const i = byId('PRJ-907'); return { rag: i.rag, man: i.avanceManual, act: i.actualizada === hoy(), logros: i.logros, snap: (i.snapFase || []).length, bit: St.bitacora.some(b => b.ini === 'PRJ-907' && b.tipo === 'Actualización' && /RAG Verde → Ámbar/.test(b.texto) && /Logro e2e/.test(b.texto)) }; });
  ok(r.rag === 'Ámbar' && r.man === 55 && r.act && r.logros === 'Logro e2e', 'el servidor guardó RAG, ajuste de avance, fecha y logros');
  ok(r.snap === 1, 'quedó la foto semanal de fases');
  ok(r.bit, 'quedó la anotación de la actualización en la bitácora');
  await p.evaluate(() => Acts.wknc({ id: 'PRJ-907' })); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => St.bitacora.some(b => b.ini === 'PRJ-907' && /sin novedades/.test(b.texto))), '«Sin novedades» queda registrado por el servidor');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA semanal-srv' : 'OK semanal-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
