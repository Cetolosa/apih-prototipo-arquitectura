// Recorrido de primera vez: bienvenida con elección (rápido/completo), progreso, Atrás, pasos según el rol y salida.
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = {}, txt = s => p.$eval(s, e => e.textContent.trim()).catch(() => '');
  // 1) primera vez: aparece solo y ofrece dos recorridos
  await p.waitForSelector('#v22-tour', { timeout: 5000 });
  r.ops = await p.$$eval('#v22-tour .tr-op', l => l.map(e => e.querySelector('b').textContent));
  r.rapido = await txt('#v22-tour .tr-op.pri span');
  // 2) rápido: progreso, sin «Atrás» en el primero, «Atrás» desde el segundo
  await p.click('#v22-tour .tr-op.pri'); await p.waitForTimeout(300);
  r.n1 = await txt('#v22-tour .tr-n'); r.seg = await p.$$eval('#v22-tour .tr-bar i', l => l.length); r.on1 = await p.$$eval('#v22-tour .tr-bar i.on', l => l.length);
  r.atras1 = await p.$$eval('#v22-tour [data-act="tourback"]', l => l.length);
  await p.click('#v22-tour [data-act="tournext"]'); await p.waitForTimeout(250);
  r.n2 = await txt('#v22-tour .tr-n'); r.atras2 = await p.$$eval('#v22-tour [data-act="tourback"]', l => l.length);
  await p.click('#v22-tour [data-act="tourback"]'); await p.waitForTimeout(250); r.vuelve = await txt('#v22-tour .tr-n');
  // 3) flechas del teclado
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); r.flecha = await txt('#v22-tour .tr-n');
  // 4) saltar: se cierra y no vuelve a salir
  await p.click('#v22-tour .tr-skip'); await p.waitForTimeout(200);
  r.cerrado = await p.$$eval('#v22-tour, #v22-spot', l => l.length) === 0; r.guardado = await p.evaluate(() => localStorage.getItem('apih_tour22'));
  // 5) completo: recorre todos los pasos del rol hasta «Listo»
  await p.evaluate(() => Acts.tour()); await p.waitForTimeout(200); r.extra = await txt('#v22-tour .tr-op:not(.pri) span');
  await p.click('#v22-tour .tr-op:not(.pri)'); await p.waitForTimeout(300);
  const N = await p.$$eval('#v22-tour .tr-bar i', l => l.length); r.full = N; const vistos = [];
  for (let k = 0; k < N; k++) { vistos.push(await txt('#v22-tour h3')); const hay = await p.$('#v22-tour'); if (!hay) break; await p.click('#v22-tour [data-act="tournext"]'); await p.waitForTimeout(220); }
  r.vistos = vistos; r.terminado = await p.$$eval('#v22-tour', l => l.length) === 0;
  // 6) por rol: con un menú reducido no se ofrecen Iniciativas, Planificación ni Presentaciones
  await p.evaluate(() => { St.cfg.menuRol = Object.assign({}, St.cfg.menuRol, { [rolActual()]: ['inicio'] }); render(); Acts.tour(); }); await p.waitForTimeout(300);
  r.extraRol = await txt('#v22-tour .tr-op:not(.pri) span');
  const ok = r.ops.join() === 'Rápido,Completo' && /Menú/.test(r.rapido) && /Buscar/.test(r.rapido) && /^PASO 1 DE \d+$/.test(r.n1) && r.seg >= 3 && r.on1 === 1 && r.atras1 === 0
    && /^PASO 2 DE/.test(r.n2) && r.atras2 === 1 && /^PASO 1 DE/.test(r.vuelve) && /^PASO 2 DE/.test(r.flecha) && r.cerrado && r.guardado === '1'
    && r.full > r.seg && r.vistos.includes('Iniciativas, en un solo lugar') && r.vistos.includes('Planificación') && r.terminado
    && !/Iniciativas|Planificación|Presentaciones/.test(r.extraRol) && !errs.length;
  console.log(JSON.stringify({ r, errores: errs })); console.log(ok ? 'OK recorrido1' : 'FALLA recorrido1'); await b.close(); process.exit(ok ? 0 : 1);
})();
