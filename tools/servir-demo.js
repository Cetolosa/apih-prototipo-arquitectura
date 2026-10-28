#!/usr/bin/env node
// Sirve la SPA en modo demo para las pruebas e2e: /demo/index.html (copia), /js/, /css/, /apih-config.js y /out/ (fixtures).
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), PUERTO = +process.env.PORT || 8765;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
function ruta(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/demo/index.html') return path.join(raiz, 'index.html');
  const m = p.match(/^\/(?:demo\/)?(js|css)\/([\w.-]+)$/); if (m) return path.join(raiz, m[1], m[2]);
  if (p === '/apih-config.js') return path.join(raiz, 'apih-config.js');
  if (p.startsWith('/out/')) return path.join(raiz, 'docs', 'seed', path.basename(p));
  return null;
}
// Puente de pruebas: los módulos ES no dejan globales; las pruebas e2e escriben nombres sueltos (St, Acts, toast…).
// Este módulo SOLO lo agrega el servidor de pruebas a la copia demo; la aplicación publicada no lo incluye.
function puente() {
  const mods = fs.readdirSync(path.join(raiz, 'js')).filter(f => /^\d\d.*\.js$/.test(f) && f !== '00-registro.js' && !/^08[a-f]-/.test(f)).sort();
  return `import { ENLACES } from './js/00-registro.js';\n` + mods.map((f, i) => `import * as m${i} from './js/${f}';`).join('\n') + `
for (const ns of [${mods.map((f, i) => 'm' + i).join(', ')}]) for (const k of Object.keys(ns)) {
  try { Object.defineProperty(window, k, { configurable: true, get: () => ns[k], set: v => { if (!(k in ENLACES)) throw new Error('sin accesor de escritura para ' + k); ENLACES[k] = v; } }); } catch (e) { }
}
window.__puenteListo = true;
`;
}
function servir(backend) {   // backend (opcional): tools/backend-pruebas.js; atiende /rest/v1, /auth/v1 y /__pruebas en el mismo origen que la SPA
  return new Promise(ok => { const s = http.createServer((q, r) => {
    if (backend && backend.maneja(q)) return backend.manejar(q, r);
    const pu = decodeURIComponent(q.url.split('?')[0]);
    if (pu === '/demo/puente-pruebas.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(puente()); }
    if (pu === '/demo/index.html') { const h = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8').replace('</body>', '<script type="module" src="puente-pruebas.js"></script>\n</body>'); r.writeHead(200, { 'Content-Type': TIPOS['.html'] }); return r.end(h); }
    const f = ruta(q.url); if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PUERTO, () => ok(s)); });
}
module.exports = { servir, PUERTO };
if (require.main === module) servir().then(() => console.log('Demo en http://localhost:' + PUERTO + '/demo/index.html'));
