#!/usr/bin/env node
// Paridad Prototipo ↔ Corporativo: comprueba que ambos repositorios son funcionalmente equivalentes.
// Uso: node tools/paridad.mjs <ruta-del-otro-repositorio>   (el mismo archivo vive en ambos; se puede correr desde cualquiera)
//   1. SPA: js/, css/ y las pruebas e2e son idénticos, salvo lo propio de cada ambiente (PROPIOS).
//   2. index.html: idéntico salvo connect-src de la CSP y los scripts de vendor/ (acceso del ambiente).
//   3. Servidor: los mismos comandos con los mismos argumentos (API del Corporativo ↔ funciones apih_* del Prototipo).
// Regla de trabajo (docs/paridad.md): todo cambio parte en el Prototipo y se traspasa al Corporativo en la misma entrega.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OTRO = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!OTRO || !fs.existsSync(OTRO)) { console.error('Uso: node tools/paridad.mjs <ruta-del-otro-repositorio>'); process.exit(2); }

/* Lo único que puede diferir: transporte y acceso del ambiente, y la infraestructura de pruebas de cada servidor */
const PROPIOS = {
  js: ['01t-transporte.js', '10b-acceso.js', 'auth-start.js', 'auth-end.js'],
  css: ['acceso.css', 'auth.css'],
  e2e: ['_pw.js', 'backend-humo.js', 'servidor-ficticio.js', 'README.md'],
};
/* Funciones del Prototipo que las políticas de acceso (RLS) y las vistas necesitan ejecutar como la persona; no son comandos */
const AUXILIARES_SQL = ['apih_compuertas', 'apih_compuertas_aprobar', 'apih_faltan_aprobar', 'apih_faltan_transicion', 'apih_g', 'apih_hoy', 'apih_umbral'];

const esCorp = r => fs.existsSync(path.join(r, 'api', 'src', 'http', 'esquemas.ts'));
const [CORP, PROTO] = esCorp(AQUI) ? [AQUI, OTRO] : [OTRO, AQUI];
if (!esCorp(CORP) || !fs.existsSync(path.join(PROTO, 'supabase', 'migrations'))) { console.error('No reconozco los repositorios (se espera uno Corporativo y uno Prototipo)'); process.exit(2); }
const web = r => (fs.existsSync(path.join(r, 'web', 'index.html')) ? path.join(r, 'web') : r);
const leer = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const fallas = [];
const mal = m => fallas.push(m);

function carpeta(rel, propios, filtro = () => true) {
  const a = path.join(web(PROTO), rel), b = path.join(web(CORP), rel);
  const la = fs.readdirSync(a).filter(filtro), lb = fs.readdirSync(b).filter(filtro);
  for (const f of new Set([...la, ...lb])) {
    if (propios.includes(f)) continue;
    if (!la.includes(f)) { mal(`${rel}/${f}: existe solo en el Corporativo`); continue; }
    if (!lb.includes(f)) { mal(`${rel}/${f}: existe solo en el Prototipo`); continue; }
    if (leer(path.join(a, f)) !== leer(path.join(b, f))) mal(`${rel}/${f}: difiere (traspasar el cambio del Prototipo al Corporativo)`);
  }
  for (const f of ['01t-transporte.js', '10b-acceso.js']) if (rel === 'js' && !(la.includes(f) && lb.includes(f))) mal(`${rel}/${f}: debe existir en ambos (aunque su contenido difiera)`);
}

// 1. SPA
carpeta('js', PROPIOS.js, f => f.endsWith('.js'));
carpeta('css', PROPIOS.css, f => f.endsWith('.css'));
const normHtml = h => h.replace(/^\s*<!--[^\n]*connect-src[^\n]*-->\n/m, '').replace(/connect-src [^;"]*/g, 'connect-src …').replace(/^\s*<script src="vendor\/[^"]+"><\/script>\n/gm, '');
if (normHtml(leer(path.join(web(PROTO), 'index.html'))) !== normHtml(leer(path.join(web(CORP), 'index.html')))) mal('index.html: difiere fuera de connect-src y los scripts de vendor/');

// pruebas e2e: las de ambas listas de regresión son idénticas
const lista = r => { const f = ['tools/correr-e2e.mjs', 'tools/correr-e2e.js'].map(x => path.join(r, x)).find(x => fs.existsSync(x)); return (/const PRUEBAS = \[([^\]]*)\]/.exec(leer(f)) || [, ''])[1].match(/'[^']+'/g)?.map(x => x.slice(1, -1)) ?? []; };
const lp = lista(PROTO), lc = lista(CORP);
for (const t of new Set([...lp, ...lc])) {
  if (PROPIOS.e2e.includes(t + '.js')) continue;
  if (!lp.includes(t) || !lc.includes(t)) { mal(`e2e ${t}: está en la regresión de un solo repositorio`); continue; }
  const a = path.join(PROTO, 'tests/e2e', t + '.js'), b = path.join(CORP, 'tests/e2e', t + '.js');
  if (!fs.existsSync(a) || !fs.existsSync(b) || leer(a) !== leer(b)) mal(`e2e ${t}: la prueba difiere`);
}

// 3. Servidor: comandos y argumentos
const esq = leer(path.join(CORP, 'api/src/http/esquemas.ts'));
const corp = Object.fromEntries([...esq.matchAll(/(apih_[a-z_]+): C\('([^']*)'/g)].map(m => [m[1], m[2].split(' ').filter(Boolean).sort()]));
const sql = fs.readdirSync(path.join(PROTO, 'supabase/migrations')).filter(f => f.endsWith('.sql')).sort().map(f => leer(path.join(PROTO, 'supabase/migrations', f))).join('\n');
const firmas = {};
for (const m of sql.matchAll(/create\s+or\s+replace\s+function\s+public\.(apih_[a-z0-9_]+)\s*\(([^)]*)\)/gi)) firmas[m[1]] = m[2].split(',').map(x => x.trim().split(/\s+/)[0]).filter(x => x.startsWith('p_')).sort();
const expuestas = new Set();
for (const m of sql.matchAll(/grant\s+execute\s+on\s+function\s+([\s\S]*?)\s+to\s+([^;]+);/gi)) if (/authenticated/.test(m[2])) for (const f of m[1].matchAll(/public\.(apih_[a-z0-9_]+)\(/g)) expuestas.add(f[1]);
for (const [n, args] of Object.entries(corp)) {
  if (!expuestas.has(n)) { mal(`comando ${n}: existe en el Corporativo y no en el Prototipo`); continue; }
  if (JSON.stringify(firmas[n]) !== JSON.stringify(args)) mal(`comando ${n}: argumentos distintos (Prototipo: ${firmas[n]?.join(', ')} · Corporativo: ${args.join(', ')})`);
}
for (const n of expuestas) if (!corp[n] && !AUXILIARES_SQL.includes(n)) mal(`comando ${n}: existe en el Prototipo y no en el Corporativo`);

if (fallas.length) { console.log(fallas.map(f => 'FALLA ' + f).join('\n') + `\nparidad: ${fallas.length} diferencia(s)`); process.exit(1); }
console.log(`OK    paridad Prototipo ↔ Corporativo (js, css, index.html, ${lp.length} pruebas e2e, ${Object.keys(corp).length} comandos)`);
