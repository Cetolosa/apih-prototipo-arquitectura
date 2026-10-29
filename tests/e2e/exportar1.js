// Exportar el reporte «1 a 1» a PNG y PDF: descargas reales, archivos válidos y sin violaciones de CSP (el SVG se dibuja en un canvas)
const { chromium, launchOpts } = require('./_pw'); const fs = require('fs');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errs = [], csp = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/Content Security/.test(m.text())) csp.push(m.text().slice(0, 150)); });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); await p.goto(URL); await p.waitForTimeout(2000);
  await p.evaluate(async () => { const H = hoy(), me = miUsuario();
    St.ini.push({ id: 'PRJ-777', tipo: 'Proyecto', titulo: 'Proyecto de prueba', fase: 'Ejecución', estado: 'En curso', rag: 'Ámbar', prioridad: 'Alta', lider: me, area: 'BISE', avance: 40, presupuesto: 10, creada: addD(H, -60), faseDesde: addD(H, -20), actualizada: H, inicioPlan: addD(H, -60), finPlan: addD(H, 90), logros: 'Workbooks cerrados', proximos: 'Revisión', est: [], tags: [], deps: [], hist: [] });
    St.hitos.push({ id: 'HIT-771', ini: 'PRJ-777', nombre: 'Hito 1', fase: 'Ejecución', fecha: addD(H, -10), completado: true, fechaReal: addD(H, -10), resp: me }, { id: 'HIT-772', ini: 'PRJ-777', nombre: 'Hito 2', fase: 'Ejecución', fecha: addD(H, 10), completado: false, resp: me });
    await sembrarSt(); });
  await p.evaluate(() => Acts.reporte({ id: 'PRJ-777' })); await p.waitForTimeout(500);
  const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  for (const [act, ext, magic] of [['reppng', 'png', [0x89, 0x50, 0x4e, 0x47]], ['reppdf', 'pdf', [0x25, 0x50, 0x44, 0x46]]]) {
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), p.click('[data-act="' + act + '"]')]);
    if (!dl) { ok(false, 'no hubo descarga ' + ext); continue; }
    const buf = fs.readFileSync(await dl.path());
    ok(buf.length > 5000 && magic.every((v, k) => buf[k] === v), ext + ' inválido (' + buf.length + ' bytes)');
    if (ext === 'png') ok(buf.readUInt32BE(16) === 1800, 'ancho PNG ' + buf.readUInt32BE(16));
  }
  ok(!errs.length, 'errores de página: ' + errs.join(' | ')); ok(!csp.length, 'violaciones de CSP: ' + csp.join(' | '));
  console.log(fails.length ? 'FALLA exportar1\n - ' + fails.join('\n - ') : 'OK exportar1'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
