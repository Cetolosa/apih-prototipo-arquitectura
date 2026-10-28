// Pruebas TI · H05 · Una sola fuente de reglas: el servidor.
// Modelo vigente (backend único): las compuertas y los umbrales (umbralCritico, tolDesv, diasSinUpdate) se aplican solo en el servidor
// (apih_umbral, apih_calculos, compuertas); la SPA muestra el resultado (CALC) y no compara contra umbrales.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const UMBRALES = ['umbralCritico', 'tolDesv', 'diasSinUpdate'];
module.exports = raiz => {
  const e = f => fs.existsSync(path.join(raiz, f)), leer = f => e(f) ? fs.readFileSync(path.join(raiz, f), 'utf8') : '';
  const fallas = [];
  if (!e('supabase/tests/60_contrato_compuertas.sql') || !/60_contrato_compuertas/.test(leer('tools/test-sql.sh'))) fallas.push('el contrato de compuertas no corre en test-sql.sh');
  const g = spawnSync('node', [path.join(raiz, 'tools', 'guardia-reglas.js')], { cwd: raiz, encoding: 'utf8' });
  if (g.status !== 0) fallas.push('la guardia de arquitectura falla: ' + ((g.stdout || '') + (g.stderr || '')).trim().split('\n').slice(-1)[0]);
  if (!/guardia-reglas/.test(leer('.github/workflows/ci.yml'))) fallas.push('la guardia de arquitectura no corre en CI');
  // Lecturas del umbral de una iniciativa en el cliente = la SPA evalúa la regla por su cuenta
  const usos = [];
  for (const f of fs.readdirSync(path.join(raiz, 'js')).filter(f => f.endsWith('.js'))) {
    leer('js/' + f).split('\n').forEach((l, i) => { if (/cfgI\)\(/.test(l) && UMBRALES.some(u => l.includes("'" + u + "'"))) usos.push(f + ':' + (i + 1)); });
  }
  if (usos.length) fallas.push('la SPA aún evalúa umbrales por iniciativa en ' + usos.length + ' lugares (' + usos.slice(0, 6).join(', ') + (usos.length > 6 ? '…' : '') + ')');
  if (!/apih_umbral/.test(fs.readdirSync(path.join(raiz, 'supabase/migrations')).map(f => leer('supabase/migrations/' + f)).join('\n'))) fallas.push('el servidor no define apih_umbral');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') }
    : { estado: 'CERRADO', evidencia: 'compuertas y umbrales solo en el servidor (apih_umbral, apih_calculos); contrato de compuertas en test-sql.sh; guardia de arquitectura en CI; la SPA no evalúa umbrales' };
};
