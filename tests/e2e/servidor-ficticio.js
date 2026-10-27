// F4 · Capa de datos real (sin SharePoint): sesión Supabase ficticia + PostgREST ficticio en memoria.
// Verifica conexión, alta/edición/baja con sincronización, lectura de cambios ajenos, conflicto y prueba de conexión.
const { chromium, launchOpts } = require('./_pw');
const URL_APP = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const HOST = 'https://bjkuupynrylgfmzhyxgz.supabase.co';
(async () => {
  const b = await chromium.launch(launchOpts), ctx = await b.newContext(), p = await ctx.newPage(); const err = [], dlg = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => { dlg.push(d.message().slice(0, 60)); d.dismiss(); });
  const db = new Map(); let t = 1; const ts = () => new Date(Date.UTC(2026, 9, 27, 12, 0, t++)).toISOString();
  const key = (l, i) => l + '|' + i, log = [];
  await ctx.route(HOST + '/rest/v1/**', async route => {
    const rq = route.request(), u = new URL(rq.url()), path = u.pathname.replace('/rest/v1/', ''), q = u.searchParams, m = rq.method();
    const ok = (body, status = 200, h = {}) => route.fulfill({ status, contentType: 'application/json', headers: h, body: body == null ? '' : JSON.stringify(body) });
    const eq = k => { const v = q.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };
    log.push(m + ' ' + path);
    if (path.startsWith('registros_v') && m === 'GET') {
      let rows = [...db.values()]; const l = eq('lista'); if (l) rows = rows.filter(r => r.lista === l);
      if (q.get('order') === 'actualizado.desc') { rows.sort((a, b) => a.actualizado < b.actualizado ? 1 : -1); return ok(rows.slice(0, 1).map(r => ({ actualizado: r.actualizado })), 200, { 'Content-Range': '0-0/' + db.size }); }
      rows.sort((a, b) => a.id < b.id ? -1 : 1); const off = +q.get('offset') || 0, lim = +q.get('limit') || 1000; return ok(rows.slice(off, off + lim));
    }
    if (path.startsWith('registros') && m === 'POST') {
      const body = JSON.parse(rq.postData() || '[]'), merge = /merge-duplicates/.test(rq.headers()['prefer'] || '');
      for (const r of body) { if (!merge && db.has(key(r.lista, r.id))) return ok({ message: 'duplicate' }, 409); }
      const out = body.map(r => { const x = Object.assign({}, r, { actualizado: ts() }); db.set(key(r.lista, r.id), x); return x; });
      return ok(/representation/.test(rq.headers()['prefer'] || '') ? out : null, /representation/.test(rq.headers()['prefer'] || '') ? 201 : 204);
    }
    if (path.startsWith('registros') && m === 'PATCH') {
      const l = eq('lista'), i = eq('id'), a = eq('actualizado'), cur = db.get(key(l, i));
      if (!cur || (a && cur.actualizado !== a)) return ok([]);
      const body = JSON.parse(rq.postData()); Object.assign(cur, body, { actualizado: ts() }); return ok([{ actualizado: cur.actualizado }]);
    }
    if (path.startsWith('registros') && m === 'DELETE') {
      const l = eq('lista'); let ids = []; const i = eq('id'); if (i) ids = [i]; else { const v = q.get('id') || ''; ids = [...v.matchAll(/"([^"]*)"/g)].map(x => x[1]); }
      ids.forEach(x => db.delete(key(l, x))); return ok(null, 204);
    }
    return ok({ message: 'ruta no ficticia: ' + m + ' ' + path }, 404);
  });
  await p.addInitScript(() => { window.APIH_OVERRIDE = { auth: { provider: 'supabase' }, supabase: { url: 'https://bjkuupynrylgfmzhyxgz.supabase.co', anonKey: 'sb_publishable_prueba' } }; localStorage.setItem('apih_tour22', '1'); sessionStorage.setItem('APIH_SB', JSON.stringify({ access: 'x', refresh: 'y', exp: Math.floor(Date.now() / 1000) + 3600, email: 'tolosa-christian@aramark.cl' })); });
  await p.goto(URL_APP); await p.waitForTimeout(2500);
  const r = {};
  r.conectado = await p.evaluate(() => ({ modo: DataService.mode, svc: !!DataService.svc, estado: DataService.st.state, user: AuthService.user() && AuthService.user().email }));
  // base vacía → la app guarda usuarios/parámetros iniciales
  await p.waitForTimeout(1500);
  r.ajustes = [...db.keys()].filter(k => k.startsWith('APIH_Config|') || k.startsWith('APIH_Roles|')).sort();
  // alta
  await p.evaluate(() => { const o = Object.assign(ESQUEMA.risks.tpl(), { id: 'RSK-900', titulo: 'Riesgo de prueba' }); St.riesgos.push(o); save(); });
  await p.waitForTimeout(1500);
  const fila = db.get('APIH_Riesgos|RSK-900'); r.alta = fila ? fila.datos.slice(0, 3) + '|' + JSON.parse(fila.datos.slice(3)).titulo : null;
  // edición
  await p.evaluate(() => { St.riesgos.find(x => x.id === 'RSK-900').titulo = 'Riesgo editado'; save(); }); await p.waitForTimeout(1500);
  r.edicion = JSON.parse(db.get('APIH_Riesgos|RSK-900').datos.slice(3)).titulo;
  // cambio ajeno → la lectura lo trae
  db.set('APIH_Riesgos|RSK-901', { lista: 'APIH_Riesgos', id: 'RSK-901', datos: 'p1.' + JSON.stringify(Object.assign({ id: 'RSK-901', titulo: 'Ajeno' })), actualizado: ts() });
  await p.evaluate(() => DataService.refresh(false, true)); r.ajeno = await p.evaluate(() => !!St.riesgos.find(x => x.id === 'RSK-901'));
  // conflicto: otra persona modifica RSK-900; mi edición no debe pisarla
  const ajena = JSON.parse(db.get('APIH_Riesgos|RSK-900').datos.slice(3)); ajena.titulo = 'Cambio de otra persona';
  db.get('APIH_Riesgos|RSK-900').datos = 'p1.' + JSON.stringify(ajena); db.get('APIH_Riesgos|RSK-900').actualizado = ts();
  await p.evaluate(() => { St.riesgos.find(x => x.id === 'RSK-900').titulo = 'Mi cambio tardío'; save(); }); await p.waitForTimeout(2000);
  r.conflicto = { servidor: JSON.parse(db.get('APIH_Riesgos|RSK-900').datos.slice(3)).titulo, aviso: dlg.length > 0 };
  // baja
  await p.evaluate(() => DataService.refresh(false, true));
  await p.evaluate(() => { St.riesgos = St.riesgos.filter(x => x.id !== 'RSK-901'); save(); }); await p.waitForTimeout(1500);
  r.baja = !db.has('APIH_Riesgos|RSK-901');
  // prueba de conexión
  r.prueba = await p.evaluate(() => DataService.testConnection());
  console.log(JSON.stringify(r), err, [...new Set(log)].join(', '));
  const ok = !err.length && r.conectado.modo === 'supabase' && r.conectado.svc && r.conectado.estado === 'ok' && r.ajustes.includes('APIH_Config|cfg') && r.alta === 'p1.|Riesgo de prueba' && r.edicion === 'Riesgo editado' && r.ajeno
    && r.conflicto.servidor === 'Cambio de otra persona' && r.conflicto.aviso && r.baja && r.prueba.every(x => x.startsWith('✔')) && r.prueba.length === 13;
  console.log(ok ? 'OK servidor-ficticio' : 'FALLA servidor-ficticio'); await b.close(); process.exit(ok ? 0 : 1);
})();
