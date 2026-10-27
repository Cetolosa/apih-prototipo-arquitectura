// Pruebas TI · H11 · SPA: CSP sin unsafe-inline en scripts, sin activos base64 grandes, sin correos de admin en el bundle.
// El texto de ejemplo nombre.apellido@aramark.cl de un campo no cuenta: no es un correo real.
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const archivos = []; (function ver(p) { if (!fs.existsSync(p)) return; const s = fs.statSync(p); if (s.isDirectory()) return fs.readdirSync(p).forEach(f => ver(path.join(p, f))); if (/\.(js|css|html)$/.test(p)) archivos.push(p); })(path.join(raiz, 'js'));
  ['index.html', 'apih-config.js', 'css'].forEach(x => (function ver(p) { if (!fs.existsSync(p)) return; const s = fs.statSync(p); if (s.isDirectory()) return fs.readdirSync(p).forEach(f => ver(path.join(p, f))); if (/\.(js|css|html)$/.test(p)) archivos.push(p); })(path.join(raiz, x)));
  const rel = p => path.relative(raiz, p), fallas = []; let largas = 0;
  const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8'), csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
  if (!csp) fallas.push('sin CSP'); else if (/script-src[^;]*'unsafe-inline'/.test(csp)) fallas.push("CSP con 'unsafe-inline' en script-src");
  const b64 = [], correos = [];
  for (const f of archivos) { const t = fs.readFileSync(f, 'utf8'), L = t.split('\n');
    const m = t.match(/base64,[A-Za-z0-9+/=]{50000,}/g); if (m) b64.push(rel(f) + ' (' + Math.round(m.reduce((a, x) => a + x.length, 0) / 1024) + ' KB)');
    L.forEach((l, i) => { if (/[A-Za-z0-9._-]+@aramark\.cl/i.test(l.replace(/nombre\.apellido@aramark\.cl/g, ''))) correos.push(rel(f) + ':' + (i + 1)); if (l.length > 300) largas++; }); }
  if (b64.length) fallas.push('activos base64 de más de 50 KB en ' + b64.join(', '));
  if (correos.length) fallas.push('correos corporativos en el bundle (' + correos.join(', ') + ')');
  const nota = ' · informativo: ' + largas + ' líneas de más de 300 caracteres';
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') + nota } : { estado: 'CERRADO', evidencia: 'CSP sin unsafe-inline en scripts, sin activos base64 grandes ni correos corporativos en el bundle' + nota };
};
