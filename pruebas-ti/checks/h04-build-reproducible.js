// Pruebas TI · H04 · Build reproducible: lockfile versionado, npm ci sin fallback, artefacto único publicado.
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const e = f => fs.existsSync(path.join(raiz, f)), leer = f => e(f) ? fs.readFileSync(path.join(raiz, f), 'utf8') : '';
  const wf = fs.existsSync(path.join(raiz, '.github/workflows')) ? fs.readdirSync(path.join(raiz, '.github/workflows')).map(f => leer('.github/workflows/' + f)).join('\n') : '';
  const fallas = [];
  if (!e('package-lock.json')) fallas.push('falta package-lock.json');
  if (!e('.nvmrc')) fallas.push('falta .nvmrc');
  if (/npm install/.test(wf)) fallas.push('un workflow usa npm install');
  if (!/npm ci/.test(wf)) fallas.push('ningún workflow usa npm ci');
  if (/\|\|\s*npm install/.test(wf)) fallas.push('npm ci con fallback a npm install');
  if (!/upload-pages-artifact/.test(leer('.github/workflows/pages.yml'))) fallas.push('la publicación no sube un artefacto único');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') }
    : { estado: 'CERRADO', evidencia: 'package-lock.json y .nvmrc versionados; la CI usa npm ci sin fallback; la publicación sube un único artefacto (pages.yml)' };
};
