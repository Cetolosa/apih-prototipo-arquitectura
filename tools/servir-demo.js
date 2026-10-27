#!/usr/bin/env node
// Sirve la SPA en modo demo para las pruebas e2e: /demo/index.html (copia), /apih-config.js y /out/ (fixtures).
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), PUERTO = +process.env.PORT || 8765;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
function ruta(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/demo/index.html') return path.join(raiz, 'index.html');
  if (p === '/apih-config.js') return path.join(raiz, 'apih-config.js');
  if (p.startsWith('/out/')) return path.join(raiz, 'docs', 'seed', path.basename(p));
  return null;
}
function servir() {
  return new Promise(ok => { const s = http.createServer((q, r) => { const f = ruta(q.url); if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PUERTO, () => ok(s)); });
}
module.exports = { servir, PUERTO };
if (require.main === module) servir().then(() => console.log('Demo en http://localhost:' + PUERTO + '/demo/index.html'));
