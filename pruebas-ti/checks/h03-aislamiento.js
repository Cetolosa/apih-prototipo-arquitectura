// Pruebas TI · H03 · Aislamiento SERIALIZABLE en transacciones de escritura.
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const hits = []; let n = 0;
  (function ver(p) { const s = fs.statSync(p); if (s.isDirectory()) return fs.readdirSync(p).forEach(f => ver(path.join(p, f)));
    if (!/\.(sql|js|html)$/.test(p)) return; n++; if (/serializable/i.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(raiz, p)); })(raiz + '/supabase');
  ['js', 'index.html'].forEach(x => { const p = path.join(raiz, x); if (fs.existsSync(p)) (function ver(q) { const s = fs.statSync(q); if (s.isDirectory()) return fs.readdirSync(q).forEach(f => ver(path.join(q, f))); n++; if (/serializable/i.test(fs.readFileSync(q, 'utf8'))) hits.push(path.relative(raiz, q)); })(p); });
  return hits.length ? { estado: 'ABIERTO', evidencia: 'SERIALIZABLE en ' + hits.join(', ') }
    : { estado: 'CERRADO', evidencia: 'sin SERIALIZABLE en ' + n + ' archivos del servidor y la SPA (Postgres usa READ COMMITTED por defecto). No evalúa lecturas de tabla completa ni carga concurrente' };
};
