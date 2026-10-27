#!/usr/bin/env node
// Pruebas TI: repite la revisión técnica de Arquitectura y deja el resultado en el mismo formato del informe.
// Uso: node pruebas-ti/correr.js [--estricto]   (en CI: sudo -E node pruebas-ti/correr.js)
//   Sale con código 1 si fallan las suites base; con --estricto también si algún hallazgo sigue ABIERTO.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), H = JSON.parse(fs.readFileSync(path.join(__dirname, 'hallazgos.json'), 'utf8'));
const clave = h => 'H' + String(h.n).padStart(2, '0');
const sqls = H.filter(h => h.check && h.check.endsWith('.sql')).map(h => 'pruebas-ti/' + h.check);
const commit = (spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ }).stdout || '').toString().trim() || 'sin commit';

// 1) Pruebas contra la base (Postgres temporal): suites base + checks .sql de este paquete
const r = spawnSync('bash', [path.join(RAIZ, 'tools', 'test-sql.sh')], { cwd: RAIZ, encoding: 'utf8', env: Object.assign({}, process.env, { SQL_EXTRA: sqls.join(' ') }), maxBuffer: 1 << 26 });
const salida = (r.stdout || '') + (r.stderr || '');
const base = r.status === 0, res = {};
for (const l of salida.split('\n')) { const m = l.match(/^TI\|(H\d+)\|(CERRADO|ABIERTO)\|(.*)$/); if (m) res[m[1]] = { estado: m[2], evidencia: m[3] }; }

// 2) Verificaciones estáticas (.js): cada una exporta raiz => ({ estado, evidencia })
for (const h of H.filter(h => h.check && h.check.endsWith('.js'))) {
  try { res[clave(h)] = require(path.join(__dirname, h.check))(RAIZ); } catch (e) { res[clave(h)] = { estado: 'ABIERTO', evidencia: 'la verificación falló al ejecutarse: ' + e.message }; }
}

const filas = H.map(h => {
  if (h.aplica === false) return { n: h.n, sev: h.sev, titulo: h.titulo, pasada: h.pasada, estado: 'NO APLICA', evidencia: h.nota };
  const x = res[clave(h)];
  return { n: h.n, sev: h.sev, titulo: h.titulo, pasada: h.pasada, estado: x ? x.estado : 'PENDIENTE', evidencia: x ? x.evidencia : 'Prueba aún no automatizada (' + h.pasada + ')' };
});
const cuenta = e => filas.filter(f => f.estado === e).length;
const md = ['# Pruebas TI — resultado', '', 'Commit: `' + commit + '` · ' + new Date().toISOString().slice(0, 10) + ' · suites base: ' + (base ? 'OK' : 'FALLAN'), '',
  'Cerrados: ' + cuenta('CERRADO') + ' · Abiertos: ' + cuenta('ABIERTO') + ' · No aplican: ' + cuenta('NO APLICA') + ' · Pendientes: ' + cuenta('PENDIENTE') + ' (de ' + filas.length + ')', '',
  '| # | Severidad | Hallazgo | Estado | Evidencia |', '| --- | --- | --- | --- | --- |']
  .concat(filas.map(f => '| ' + f.n + ' | ' + f.sev + ' | ' + f.titulo + ' | ' + f.estado + ' | ' + f.evidencia + ' |')).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname, 'informe.md'), md); fs.writeFileSync(path.join(__dirname, 'informe.json'), JSON.stringify({ commit, base, filas }, null, 2) + '\n');
console.log(md);
if (!base) { console.log('FALLAN las suites base:\n' + salida.split('\n').filter(l => /ERROR|FALLA/.test(l)).slice(0, 5).join('\n')); process.exit(1); }
process.exit(process.argv.includes('--estricto') && cuenta('ABIERTO') ? 1 : 0);
