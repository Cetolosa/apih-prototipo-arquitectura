#!/usr/bin/env node
// Genera datos SINTÉTICOS y deterministas para pruebas (formato apih-iniciativas v1).
// No contiene datos reales. Uso: node tools/generar-seed.js  → docs/seed/iniciativas-sinteticas.json
const fs = require('fs'), path = require('path');
let s = 20261027; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];
const dia = (base, n) => { const d = new Date(base + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const FASES = ['Planificación', 'Ejecución', 'Transición', 'Cierre'];
const CATS = ['Regulatorio', 'Técnico', 'Operacional', 'Financiero'];
function iniciativa(i, o) {
  const n = o.hitos, ini = o.inicio, hitos = [], riesgos = [];
  for (let k = 0; k < n; k++) {
    const fase = FASES[(o.dist || [n]).reduce((a, c, ix) => (a.acc += c, a.acc <= k ? (a.i = ix + 1) : 0, a), { acc: 0, i: 0 }).i];
    hitos.push({ nombre: `Hito sintético ${i}.${k + 1}`, fase, fecha: dia(ini, 7 + k * o.paso), completado: k < o.completados });
  }
  for (let k = 0; k < o.riesgos; k++) riesgos.push({ desc: `Riesgo sintético ${i}.${k + 1}`, cat: pick(CATS), prob: 1 + Math.floor(rnd() * 5), imp: 1 + Math.floor(rnd() * 5), mit: `Mitigación de prueba ${k + 1}` });
  return { tipo: 'Proyecto', titulo: `Iniciativa de prueba ${i}`, desc: 'Iniciativa sintética para pruebas automatizadas. No es un proyecto real.',
    area: o.area, lider: 'Usuario Prueba ' + i, sponsor: 'Sponsor Prueba', fase: o.fase, estado: 'En curso', rag: o.rag, prioridad: o.prioridad,
    avance: o.avance, inicioPlan: ini, finPlan: dia(ini, 7 + n * o.paso + 14), presupuesto: o.presupuesto, logros: 'Logro sintético.', proximos: 'Próximo paso sintético.', hitos, riesgos };
}
const out = { formato: 'apih-iniciativas', v: 1, iniciativas: [
  iniciativa('B', { hitos: 21, dist: [5, 9, 4, 3], inicio: '2026-10-01', paso: 7, completados: 2, riesgos: 9, area: 'AREA-B', fase: 'Planificación', rag: 'Ámbar', prioridad: 'Media', avance: 15, presupuesto: 2500 }),
  iniciativa('A', { hitos: 9, dist: [3, 3, 2, 1], inicio: '2026-09-01', paso: 14, completados: 6, riesgos: 2, area: 'AREA-A', fase: 'Transición', rag: 'Verde', prioridad: 'Alta', avance: 70, presupuesto: 1000 })
] };
const destino = path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json');
fs.writeFileSync(destino, JSON.stringify(out, null, 2) + '\n'); console.log('OK', destino, out.iniciativas.map(x => x.hitos.length + '/' + x.riesgos.length).join(' '));
