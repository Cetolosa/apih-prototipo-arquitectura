// Iter 7: subfases, nota de fase, consumo de presupuesto y documentos los guarda el servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  await p.evaluate(async () => { const me = miUsuario(), H = hoy();
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-910', titulo: 'Residuales e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: me, presupuesto: 1000, actualizada: H, inicioPlan: addD(H, -30), finPlan: addD(H, 150), finEst: addD(H, 150) }));
    save(); await DataService.flush(); await DataService.refresh(false, true); });
  const llenar = async (campos, boton) => p.evaluate(({ campos, boton }) => { Object.entries(campos).forEach(([k, v]) => { const el = document.getElementById('f_' + k); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    [...document.querySelectorAll('.modal button')].find(x => new RegExp('^' + boton).test(x.textContent.trim())).click(); }, { campos, boton });
  const espera = async which => p.evaluate(async which => { const t = {
    doc: () => (St.documentos || []).some(d => d.ini === 'PRJ-910' && d.nombre === 'Acta e2e' && d.autor),
    gas: () => byId('PRJ-910').gastado === 321,
    sub: () => (byId('PRJ-910').subfases || []).some(s => s.nombre === 'Montaje e2e' && /^PRJ-910-SF\d+$/.test(s.id) && s.inicio && s.fin),
    nota: () => (byId('PRJ-910').faseNota || {})['Ejecución'] === 'Nota e2e',
    sin: () => !(byId('PRJ-910').subfases || []).length }[which];
    for (let k = 0; k < 40; k++) { if (t()) return true; await new Promise(r => setTimeout(r, 250)); } return false; }, which);
  await p.evaluate(() => Acts.docnew({ id: 'PRJ-910' })); await p.waitForTimeout(300);
  await llenar({ nombre: 'Acta e2e', url: 'https://aramark.sharepoint.com/sites/x/acta.pdf' }, 'Agregar');
  ok(await espera('doc'), 'el documento lo guarda el servidor (con autor)');
  await p.evaluate(() => Acts.misgasto({ id: 'PRJ-910' })); await p.waitForTimeout(300);
  await llenar({ gastado: '321' }, 'Guardar');
  ok(await espera('gas'), 'el consumo de presupuesto lo guarda el servidor');
  await p.evaluate(() => Acts.sfnew({ id: 'PRJ-910', f: 'Ejecución' })); await p.waitForTimeout(300);
  await llenar({ nombre: 'Montaje e2e' }, 'Crear');
  ok(await espera('sub'), 'la subfase se crea en el servidor con id y fechas de su fase');
  await p.evaluate(() => Acts.fnota({ id: 'PRJ-910', f: 'Ejecución' })); await p.waitForTimeout(300);
  await llenar({ nota: 'Nota e2e' }, 'Guardar');
  ok(await espera('nota'), 'la nota de fase la guarda el servidor');
  await p.evaluate(() => { const s = byId('PRJ-910').subfases[0]; Acts.sfedit({ id: 'PRJ-910', s: s.id }); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('[data-act="mdanger"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const bt = [...document.querySelectorAll('.modal button, .confirm button, button')].find(x => /^Eliminar$/.test(x.textContent.trim()) && x.dataset.act !== 'mdanger'); bt && bt.click(); });
  ok(await espera('sin'), 'la subfase se elimina en el servidor');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA residuales-srv' : 'OK residuales-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
