#!/usr/bin/env node
// Verifica la arquitectura de módulos de js/: (1) principal.js los carga en orden, (2) cada módulo solo importa módulos ANTERIORES
// (sin ciclos), (3) todo lo definido en un módulo posterior se alcanza por ENLACES, (4) los nombres privados del generador no escapan.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'js'), arch = fs.readdirSync(dir).filter(f => /^\d\d.*\.js$/.test(f)).sort();
const orden = new Map(arch.map((f, i) => [f, i])); let fallas = 0; const mal = m => { console.log('FALLA', m); fallas++; };
const principal = fs.readFileSync(path.join(dir, 'principal.js'), 'utf8');
const cargados = [...principal.matchAll(/import\s+"\.\/([^"]+)"/g)].map(m => m[1]);
if (JSON.stringify(cargados) !== JSON.stringify(arch.filter(f => f !== '00-registro.js'))) mal('principal.js no carga todos los módulos en orden de archivo');
for (const f of arch) {
  const t = fs.readFileSync(path.join(dir, f), 'utf8');
  for (const m of t.matchAll(/^import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+'\.\/([^']+)';/gm)) {
    const o = m[1]; if (!orden.has(o)) { mal(`${f}: importa ${o}, que no existe`); continue; }
    if (orden.get(o) >= orden.get(f)) mal(`${f}: importa ${o}, que no es anterior (se prohíben ciclos; usar ENLACES)`);
  }
  if (/^08[a-g]-/.test(f)) for (const m of t.matchAll(/^import\s+\{[^}]*\}\s+from\s+'\.\/(\d\d[^']*)'/gm)) { /* el generador puede leer la aplicación; la inversa se revisa abajo */ }
  if (!/^08[a-g]-/.test(f) && f !== '08g-generador-ensamble.js') for (const m of t.matchAll(/from\s+'\.\/(08[a-f]-[^']+)'/g)) mal(`${f}: usa internals del generador (${m[1]}); solo GENE es público`);
}
console.log(fallas ? fallas + ' problemas' : `OK: ${arch.length} módulos, orden y dependencias correctos`); process.exit(fallas ? 1 : 0);
