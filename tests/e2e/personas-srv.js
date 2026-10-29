// Iter 5g: el directorio de personas viene del servidor
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-904', titulo: 'Personas e2e', area: 'Área de prueba', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: 'Persona Prueba Uno', actualizada: hoy(), inicioPlan: addD(hoy(), -30), finPlan: addD(hoy(), 120) }));
    await sembrarSt(); await DataService.refresh(false, true);
    const o = {}, s = CALC.personas.find(x => x.n === 'Persona Prueba Uno');
    o.srv = !!s && s.lidera === 1 && s.roles['Líder de proyecto'] === 1 && s.areas.includes('Área de prueba');
    o.cli = CALC.personas.every(x => Array.isArray(x.areas) && typeof x.roles === 'object');
    go('personas'); await new Promise(r => setTimeout(r, 400)); o.html = document.body.innerText.includes('Persona Prueba Uno');
    return o;
  });
  ok(r.srv, 'el servidor entrega la persona con su rol y área');
  ok(r.cli, 'el directorio llega con áreas y roles');
  ok(r.html, 'la vista Personas la muestra');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA personas-srv' : 'OK personas-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
