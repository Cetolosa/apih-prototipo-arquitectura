// Iter 5m: comentarios, avance automático y acciones del Reglas PMO las ejecuta el servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-908', titulo: 'Comentarios e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, avanceManual: 40, actualizada: addD(H, -5), inicioPlan: addD(H, -30), finPlan: addD(H, 120), finEst: addD(H, 120) }));
    save(); await DataService.flush(); await DataService.refresh(false, true); });
  await p.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<textarea id="cmt"></textarea>'); document.getElementById('cmt').value = 'Comentario e2e'; Acts.comment({ id: 'PRJ-908' }); });
  const espera = async which => p.evaluate(async which => { const t = { c: () => St.bitacora.some(b => b.ini === 'PRJ-908' && b.texto === 'Comentario e2e'), a: () => byId('PRJ-908').avanceManual == null }[which]; for (let k = 0; k < 40; k++) { if (t()) return true; await new Promise(r => setTimeout(r, 250)); } return false; }, which);
  ok(await espera('c'), 'el comentario lo guarda el servidor');
  await p.evaluate(() => Acts.avauto({ id: 'PRJ-908' }));
  ok(await espera('a'), 'avance automático: el servidor quita el ajuste manual');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA comentarios-srv' : 'OK comentarios-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
