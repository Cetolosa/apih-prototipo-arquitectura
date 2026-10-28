// Humo del banco de pruebas con backend real: sesión, lectura, escritura por la vía genérica y un comando RPC, todo pasando por RLS y disparadores.
const http = require('http'), { levantar, CLAVE_PRUEBA } = require('../../tools/backend-pruebas'), { servir } = require('../../tools/servir-demo');
const PUERTO = 8790;
const llamar = (metodo, ruta, cuerpo, token, h = {}) => new Promise((ok, mal) => {
  const d = cuerpo === undefined ? null : JSON.stringify(cuerpo);
  const rq = http.request({ host: 'localhost', port: PUERTO, path: ruta, method: metodo, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, h) }, r => { let s = ''; r.on('data', x => s += x); r.on('end', () => ok({ status: r.statusCode, body: s ? JSON.parse(s) : null, headers: r.headers })); });
  rq.on('error', mal); if (d) rq.write(d); rq.end();
});
(async () => {
  const b = await levantar(); process.env.PORT = PUERTO; const srv = await new Promise(ok => { const s = require('http').createServer((q, r) => b.manejar(q, r)).listen(PUERTO, () => ok(s)); });
  const fallas = []; const ok = (c, m) => { if (!c) fallas.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  const adm = await llamar('POST', '/auth/v1/token?grant_type=password', { email: 'tolosa-christian@aramark.cl', password: CLAVE_PRUEBA });
  ok(adm.status === 200 && adm.body.access_token, 'login del administrador');
  const mal = await llamar('POST', '/auth/v1/token?grant_type=password', { email: 'tolosa-christian@aramark.cl', password: 'otra' });
  ok(mal.status === 400, 'login con clave incorrecta se rechaza');
  const T = adm.body.access_token;
  const alta = await llamar('POST', '/rest/v1/registros?select=actualizado', [{ lista: 'APIH_Riesgos', id: 'RSK-001', datos: 'p1.' + JSON.stringify({ id: 'RSK-001', titulo: 'Riesgo de humo', prob: 3, imp: 3 }) }], T, { Prefer: 'return=representation' });
  ok(alta.status === 201 && alta.body[0].actualizado, 'alta por la vía genérica devuelve la versión');
  const lee = await llamar('GET', '/rest/v1/registros_v?select=id,datos,actualizado&lista=eq.APIH_Riesgos&order=id&limit=10&offset=0', undefined, T);
  ok(lee.status === 200 && lee.body.length === 1 && lee.body[0].id === 'RSK-001', 'lectura por registros_v');
  const v = lee.body[0].actualizado;
  const pat = await llamar('PATCH', '/rest/v1/registros?lista=eq.APIH_Riesgos&id=eq.RSK-001&actualizado=eq.' + encodeURIComponent(v) + '&select=actualizado', { datos: 'p1.' + JSON.stringify({ id: 'RSK-001', titulo: 'Editado', prob: 3, imp: 3 }) }, T, { Prefer: 'return=representation' });
  ok(pat.status === 200 && pat.body.length === 1, 'edición condicionada por versión (microsegundos exactos)');
  const viej = await llamar('PATCH', '/rest/v1/registros?lista=eq.APIH_Riesgos&id=eq.RSK-001&actualizado=eq.' + encodeURIComponent(v) + '&select=actualizado', { datos: 'p1.{"id":"RSK-001","titulo":"Tarde"}' }, T, { Prefer: 'return=representation' });
  ok(viej.status === 200 && viej.body.length === 0, 'versión vieja no pisa (conflicto)');
  const rp = await llamar('POST', '/rest/v1/rpc/apih_hito_estado', { p_id: 'HIT-NO-EXISTE', p_completado: true }, T);
  ok(rp.status === 400 && /APIH: el hito HIT-NO-EXISTE no existe/.test(rp.body.message), 'RPC tipado llega a la función y devuelve su error de dominio');
  const ig = await llamar('POST', '/rest/v1/rpc/apih_fases', { p_prop: false }, T);
  ok(ig.status === 403, 'una función interna no expuesta a authenticated se rechaza (como en Supabase)');
  const ed = await llamar('POST', '/auth/v1/token?grant_type=password', { email: 'cetolosa@gmail.com', password: CLAVE_PRUEBA });
  const ini = await llamar('POST', '/rest/v1/registros', [{ lista: 'APIH_Proyectos', id: 'PRJ-100', datos: 'p1.' + JSON.stringify({ id: 'PRJ-100', titulo: 'Fuera de mi área', area: 'Otra', tipo: 'Proyecto' }) }], ed.body.access_token);
  ok(ini.status === 403, 'el servidor rechaza escribir fuera del área del colaborador (' + ini.status + ')');
  const cnt = await llamar('GET', '/rest/v1/registros_v?select=actualizado&order=actualizado.desc&limit=1', undefined, T, { Prefer: 'count=exact' });
  ok(/\/1$/.test(cnt.headers['content-range'] || ''), 'Content-Range con conteo');
  srv.close(); await b.cerrar();
  console.log(fallas.length ? 'FALLA backend-humo (' + fallas.length + ')' : 'OK backend-humo'); process.exit(fallas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
