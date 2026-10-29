// Iter 5e: los avisos (campana) y la matriz de Notificaciones salen del servidor; cambiar la configuración los vuelve a calcular allá
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 900 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const o = {}, esp = ms => new Promise(x => setTimeout(x, ms)), me = miUsuario();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-902', titulo: 'Proyecto de avisos', area: 'Área de prueba', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', lider: me, actualizada: addD(hoy(), -3), inicioPlan: addD(hoy(), -60), finPlan: addD(hoy(), 90) }));
    St.hitos.push({ id: 'HIT-902', ini: 'PRJ-902', nombre: 'Hito vencido e2e', fecha: addD(hoy(), -5), completado: false, fechaReal: null, resp: me, fase: 'Ejecución' });
    St.compromisos.push({ id: 'ACU-902', ini: 'PRJ-902', texto: 'Enviar informe e2e', resp: me, de: '', limite: addD(hoy(), -2), fechaReal: null, estado: 'Abierto', origen: 'manual', tema: '', creada: hoy() });
    await sembrarSt(); await DataService.refresh(false, true);
    const A = () => (CALC.notif && CALC.notif.avisos) || [], tiene = k => A().some(a => a.key === k);
    o.catalogo = CALC.notif.catalogo.tipos.length; o.hito = tiene('hito_venc:HIT-902'); o.comp = tiene('comp_venc:ACU-902');
    o.texto = (A().find(a => a.key === 'hito_venc:HIT-902') || {}).texto;
    o.mias = notifMias().length;
    shell(); render(); await esp(300);
    document.querySelector('[aria-label="Avisos y alertas"]').click(); await esp(300);
    o.badge = document.querySelector('#bellN').textContent; o.pop = document.querySelector('#pop-bell').innerText;
    closePops(); UI.uiOv = 'pro'; F('adm', {}).tab = 'not'; go('admin'); await esp(500);
    o.matriz = document.querySelectorAll('input[data-chg=notifon]').length;
    document.querySelector('input[data-chg=notifon][data-id=hito_venc]').click(); await esp(1500);
    o.prefOff = CALC.notif.prefs.hito_venc.on === false; o.hitoApagado = !tiene('hito_venc:HIT-902'); o.compSigue = tiene('comp_venc:ACU-902');
    return o;
  });
  ok(r.catalogo === 15, 'el catálogo de avisos viene del servidor');
  ok(r.hito && r.comp && /Hito vencido e2e.*venció hace 5 d/.test(r.texto || ''), 'hito y compromiso vencidos: avisos calculados por el servidor');
  ok(r.mias >= 2 && +r.badge >= 2 && /venció/.test(r.pop), 'la campana muestra los avisos del servidor');
  ok(r.matriz === 15, 'la matriz de Notificaciones se arma con el catálogo del servidor');
  ok(r.prefOff && r.hitoApagado && r.compSigue, 'apagar «hito vencido» en la organización: el servidor recalcula y deja de avisar solo ese tipo');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA avisos-srv' : 'OK avisos-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
