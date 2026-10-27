// Pruebas TI · H05 · Una sola fuente de reglas: contrato único SPA/servidor para compuertas y umbral crítico definido una vez.
const fs = require('fs'), path = require('path');
module.exports = raiz => {
  const e = f => fs.existsSync(path.join(raiz, f)), leer = f => e(f) ? fs.readFileSync(path.join(raiz, f), 'utf8') : '';
  const fallas = [];
  ['tests/contract/gates_aprobar.json', 'tests/e2e/gates-contract.js', 'supabase/tests/60_contrato_compuertas.sql'].forEach(f => { if (!e(f)) fallas.push('falta ' + f); });
  if (!/60_contrato_compuertas/.test(leer('tools/test-sql.sh'))) fallas.push('el contrato de compuertas no corre en test-sql.sh');
  if (!/gates-contract/.test(leer('tools/correr-e2e.js'))) fallas.push('el contrato de compuertas no corre en el e2e');
  const defs = []; (function ver(p) { const s = fs.statSync(p); if (s.isDirectory()) return fs.readdirSync(p).forEach(f => ver(path.join(p, f)));
    if (/\.(js|sql)$/.test(p) && /umbralCritico\s*[:=]\s*\d+/.test(fs.readFileSync(p, 'utf8'))) defs.push(path.relative(raiz, p)); })(path.join(raiz, 'js'));
  if (defs.length !== 1) fallas.push('umbralCritico con valor por defecto en ' + defs.length + ' lugares');
  if (/umbral(Critico)?/i.test(fs.readdirSync(path.join(raiz, 'supabase/migrations')).map(f => leer('supabase/migrations/' + f)).join('\n'))) fallas.push('el servidor define su propio umbral');
  return fallas.length ? { estado: 'ABIERTO', evidencia: fallas.join('; ') }
    : { estado: 'CERRADO', evidencia: 'compuertas con contrato único SPA/servidor corriendo en CI; umbral crítico definido una sola vez (' + defs[0] + ') y ausente del servidor' };
};
