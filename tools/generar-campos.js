#!/usr/bin/env node
// Arma el catálogo de campos permitidos del servidor (qué claves puede traer el JSON de cada lista) y la migración que lo carga.
// Uso: CAPTURA_CLAVES=/tmp/claves.json node tools/correr-e2e.js && node tools/generar-campos.js /tmp/claves.json
// Fuentes: lo que la SPA escribe durante el e2e (plantillas, columnas y objetos reales) + el seed sintético + EXTRAS (campos que la app
// escribe en flujos que el e2e no recorre; se revisan a mano). Salida: tests/contract/campos_permitidos.json y la migración del catálogo.
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..'), arg = process.argv[2];
if (!arg || !fs.existsSync(arg)) { console.error('Falta el archivo de captura (CAPTURA_CLAVES) como argumento'); process.exit(1); }
const EXTRAS = {
  APIH_Proyectos: ['base', 'baseHist', 'snapFase', 'legacyId', 'avanceCalc', 'fasesFechas', 'avanceManual', 'motivoAlta', 'objetivos', 'problema', 'resultadoNota', 'solicitante', 'usuarios'],   // avanceCalc y fasesFechas los escribe el servidor (apih_calculos, Cambiar etapa); avanceManual, el formulario     // línea base y su historial (07-gobierno), instantáneas de fase (06-administracion), id de versiones anteriores (04-flujos)
  APIH_Propuestas: ['base', 'baseHist', 'snapFase', 'legacyId', 'motivoAlta', 'objetivos', 'problema', 'resultadoNota', 'usuarios'],   // campos del formulario de iniciativa (alta directa, propuesta)
  APIH_Hitos: ['desc'],                                            // descripción del hito (V22.61; el e2e la inyecta sin pasar por el formulario)
  APIH_Decisiones: ['escalada']                                     // fecha de escalamiento automático (07-gobierno)
};
const cap = JSON.parse(fs.readFileSync(arg, 'utf8')), cat = {};
for (const [l, ks] of Object.entries(cap)) cat[l] = new Set(Object.keys(ks));
try { const seed = JSON.parse(fs.readFileSync(path.join(RAIZ, 'docs', 'seed', 'iniciativas-sinteticas.json'), 'utf8'));
  for (const o of seed.iniciativas || []) for (const l of ['APIH_Proyectos', 'APIH_Propuestas']) Object.keys(o).forEach(k => cat[l] && cat[l].add(k)); } catch (e) { }
for (const [l, ks] of Object.entries(EXTRAS)) ks.forEach(k => (cat[l] = cat[l] || new Set()).add(k));
const out = {}; for (const l of Object.keys(cat).sort()) out[l] = [...cat[l]].filter(k => k && k !== 'undefined' && k !== 'null').sort();
fs.writeFileSync(path.join(RAIZ, 'tests', 'contract', 'campos_permitidos.json'), JSON.stringify(out, null, 1) + '\n');
const filas = Object.entries(out).flatMap(([l, ks]) => ks.map(k => "  ('" + l + "', '" + k.replace(/'/g, "''") + "')"));
const MIG = process.env.MIGRACION;   // nombre de la migración NUEVA (las ya aplicadas no se editan); sin MIGRACION solo se actualiza el JSON
if (MIG) fs.writeFileSync(path.join(RAIZ, 'supabase', 'migrations', MIG),
`-- GENERADO por tools/generar-campos.js: catálogo de campos permitidos por lista (fuente: tests/contract/campos_permitidos.json).
-- Mientras la rama no se publique se regenera en este mismo archivo; después, el generador debe emitir una migración nueva.
delete from public.apih_campos;
insert into public.apih_campos (lista, campo) values
${filas.join(',\n')}
on conflict do nothing;
`);
console.log(Object.entries(out).map(([l, ks]) => l + ': ' + ks.length).join('\n'));
