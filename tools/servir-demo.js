#!/usr/bin/env node
// Sirve la SPA en modo demo para las pruebas e2e: /demo/index.html (copia), /js/, /css/, /apih-config.js y /out/ (fixtures).
const http = require('http'), fs = require('fs'), path = require('path');
const raiz = path.join(__dirname, '..'), PUERTO = +process.env.PORT || 8765;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css' };
function ruta(url) {
  const p = decodeURIComponent(url.split('?')[0]);
  if (p === '/demo/index.html') return path.join(raiz, 'index.html');
  const m = p.match(/^\/(?:demo\/)?(js|css|img)\/([\w.-]+)$/); if (m) return path.join(raiz, m[1], m[2]);
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
${process.env.CAPTURA_CLAVES ? captura : ''}`;
}
// Captura de campos (solo con CAPTURA_CLAVES=archivo): el puente informa qué claves tienen los objetos de cada lista durante el e2e.
// Alimenta tools/generar-campos.js, que arma el catálogo de campos permitidos del servidor.
const CLAVES = {};
const captura = `
const enviar = () => { try { const out = {}; for (const ent of Object.keys(window.ESQUEMA)) { const S = window.ESQUEMA[ent], lista = window.APIH_CONFIG[S.cfg], ks = out[lista] = out[lista] || {}; const add = o => Object.keys(o || {}).forEach(k => ks[k] = 1);
  add(S.tpl()); S.cols.forEach(c => ks[c.k] = 1); ((window.St && window.St[S.coll]) || []).filter(S.filter || (() => true)).forEach(add); } navigator.sendBeacon('/__claves', JSON.stringify(out)); } catch (e) { } };
setInterval(enviar, 250); addEventListener('pagehide', enviar);
`;
function servir() {
  return new Promise(ok => { const s = http.createServer((q, r) => {
    const pu = decodeURIComponent(q.url.split('?')[0]);
    if (pu === '/__claves' && q.method === 'POST') { let b = ''; q.on('data', d => b += d); q.on('end', () => { try { const o = JSON.parse(b); for (const l of Object.keys(o)) { CLAVES[l] = CLAVES[l] || {}; Object.assign(CLAVES[l], o[l]); } } catch (e) { } r.writeHead(204); r.end(); }); return; }
    if (pu === '/demo/puente-pruebas.js') { r.writeHead(200, { 'Content-Type': 'text/javascript' }); return r.end(puente()); }
    if (pu === '/demo/index.html') { const h = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8').replace('</body>', '<script type="module" src="puente-pruebas.js"></script>\n</body>'); r.writeHead(200, { 'Content-Type': TIPOS['.html'] }); return r.end(h); }
    const f = ruta(q.url); if (!f || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(PUERTO, () => ok(s)); });
}
module.exports = { servir, PUERTO, claves: () => CLAVES };
if (require.main === module) servir().then(() => console.log('Demo en http://localhost:' + PUERTO + '/demo/index.html'));
