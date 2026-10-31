#!/usr/bin/env node
// Paridad Prototipo ↔ Corporativo: comprueba que ambos repositorios son funcionalmente equivalentes.
// Uso: node tools/paridad.mjs <ruta-del-otro-repositorio>   (el mismo archivo vive en ambos; se puede correr desde cualquiera)
//   1. SPA: js/, css/ y las pruebas e2e son idénticos, salvo lo propio de cada ambiente (PROPIOS).
//   2. index.html: idéntico salvo connect-src de la CSP y los scripts de vendor/ (acceso del ambiente).
//   3. Servidor: los mismos comandos con los mismos argumentos (API del Corporativo ↔ funciones apih_* del Prototipo).
// Regla de trabajo (docs/paridad.md): todo cambio parte en el Prototipo y se traspasa al Corporativo en la misma entrega.
// Con --sincronizar copia primero al Corporativo todo lo común (js, css, index.html, e2e, lista de regresión y este archivo)
// desde el Prototipo y luego comprueba. Lo único que queda a mano es el servidor (apih_* en SQL ↔ comandos en api/src).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = process.argv.slice(2);
const SINCRONIZAR = ARGS.includes('--sincronizar');
const OTRO = ARGS.find(a => !a.startsWith('--')) ? path.resolve(ARGS.find(a => !a.startsWith('--'))) : null;
if (!OTRO || !fs.existsSync(OTRO)) { console.error('Uso: node tools/paridad.mjs <ruta-del-otro-repositorio> [--sincronizar]'); process.exit(2); }

/* Lo único que puede diferir: transporte y acceso del ambiente, y la infraestructura de pruebas de cada servidor */
const PROPIOS = {
  js: ['01t-transporte.js', '10b-acceso.js', 'auth-start.js', 'auth-end.js'],
  css: ['acceso.css', 'auth.css'],
  e2e: ['_pw.js', 'backend-humo.js', 'servidor-ficticio.js', 'README.md'],
};
/* Funciones del Prototipo que las políticas de acceso (RLS) y las vistas necesitan ejecutar como la persona; no son comandos */
const AUXILIARES_SQL = ['apih_compuertas', 'apih_compuertas_aprobar', 'apih_faltan_aprobar', 'apih_faltan_transicion', 'apih_g', 'apih_hoy', 'apih_umbral'];

/* Despliegue (Cetolosa/APIH, datos reales de Sistemas BISE): copia exacta del Prototipo Arquitectura en SPA, pruebas y servidor.
   Solo difieren apih-config.js, la línea connect-src de la CSP y lo que no es aplicación (README, workflows, tools propios). */
const esDesp = r => { try { return /Prototipo Despliegue/.test(fs.readFileSync(path.join(r, 'apih-config.js'), 'utf8')); } catch (e) { return false; } };
if (esDesp(AQUI) || esDesp(OTRO)) {
  const [DESP, ARQ] = esDesp(AQUI) ? [AQUI, OTRO] : [OTRO, AQUI];
  if (esDesp(ARQ) || !fs.existsSync(path.join(ARQ, 'supabase', 'migrations')) || fs.existsSync(path.join(ARQ, 'api'))) { console.error('Despliegue se compara con el Prototipo Arquitectura'); process.exit(2); }
  const lee = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const todos = d => fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map(String).filter(f => fs.statSync(path.join(d, f)).isFile()) : [];
  const COMUN = ['js', 'css', 'img', 'tests/e2e', 'tests/contract', 'supabase/migrations', 'supabase/tests'];
  const ARCH = ['supabase/aplicar_en_supabase.sql', 'tools/paridad.mjs', 'tools/correr-e2e.js', 'tools/test-sql.sh', 'tools/empaquetar-migraciones.js', 'tools/guardia-reglas.js', 'tools/verificar-modulos.js', 'package.json', 'package-lock.json'];
  const html = h => h.replace(/^\s*<!--[^\n]*connect-src[^\n]*-->\n/m, '').replace(/connect-src [^;"]*/g, 'connect-src …');
  const dif = [], cambios = [];
  const copiar = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.writeFileSync(b, lee(a)); cambios.push(path.relative(DESP, b)); };
  const pares = [...COMUN.flatMap(c => [...new Set([...todos(path.join(ARQ, c)), ...todos(path.join(DESP, c))])].map(f => path.join(c, f))), ...ARCH];
  for (const r of pares) {
    const a = path.join(ARQ, r), b = path.join(DESP, r), ea = fs.existsSync(a), eb = fs.existsSync(b);
    if (ea && eb && lee(a) === lee(b)) continue;
    if (!SINCRONIZAR) { dif.push(!ea ? `${r}: existe solo en Despliegue` : !eb ? `${r}: existe solo en Arquitectura` : `${r}: difiere`); continue; }
    if (ea) copiar(a, b); else { fs.rmSync(b); cambios.push('(borrado) ' + r); }
  }
  // index.html: el de Arquitectura con la CSP (comentario y connect-src) de Despliegue
  const ha = lee(path.join(ARQ, 'index.html')), hbF = path.join(DESP, 'index.html'), hb = lee(hbF);
  if (html(ha) !== html(hb)) {
    if (!SINCRONIZAR) dif.push('index.html: difiere fuera de connect-src');
    else {
      const com = h => (/^\s*<!--[^\n]*connect-src[^\n]*-->$/m.exec(h) || [null])[0], cs = (/connect-src [^;"]*/.exec(hb) || [null])[0];
      let h = ha; if (com(ha) && com(hb)) h = h.replace(com(ha), () => com(hb)); if (cs) h = h.replace(/connect-src [^;"]*/g, () => cs);
      fs.writeFileSync(hbF, h); cambios.push('index.html');
    }
  }
  if (SINCRONIZAR) console.log(cambios.length ? cambios.map(c => 'COPIA ' + c).join('\n') + `\nsincronizar: ${cambios.length} archivo(s) actualizados en Despliegue` : 'sincronizar: Despliegue ya estaba al día');
  if (dif.length) { console.log(dif.map(f => 'FALLA ' + f).join('\n') + `\nparidad: ${dif.length} diferencia(s) · traspasar con: node tools/paridad.mjs <despliegue> --sincronizar (desde Arquitectura)`); process.exit(1); }
  console.log(`OK    paridad Arquitectura ↔ Despliegue (${pares.length} archivos e index.html)${cambios.some(c => c.startsWith('supabase/')) ? '\nAVISO: cambiaron migraciones: volver a aplicar supabase/aplicar_en_supabase.sql en el proyecto Supabase de Despliegue' : ''}`);
  process.exit(0);
}

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

// 0. Sincronizar (Prototipo → Corporativo): solo lo común; lo propio de cada ambiente no se toca
if (SINCRONIZAR) {
  const cambios = [];
  const escribir = (f, txt) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); cambios.push(path.relative(CORP, f)); };
  const copiar = (a, b) => { if (!fs.existsSync(b) || leer(a) !== leer(b)) escribir(b, leer(a)); };
  for (const [rel, propios, ext] of [['js', PROPIOS.js, '.js'], ['css', PROPIOS.css, '.css']]) {
    const a = path.join(web(PROTO), rel), b = path.join(web(CORP), rel);
    const la = fs.readdirSync(a).filter(f => f.endsWith(ext) && !propios.includes(f));
    for (const f of la) copiar(path.join(a, f), path.join(b, f));
    for (const f of fs.readdirSync(b).filter(f => f.endsWith(ext) && !propios.includes(f) && !la.includes(f))) { fs.rmSync(path.join(b, f)); cambios.push(`(borrado) ${path.relative(CORP, path.join(b, f))}`); }
  }
  // index.html: el del Prototipo con la CSP (comentario y connect-src) y los scripts de vendor/ del Corporativo
  const hp = leer(path.join(web(PROTO), 'index.html')), hcF = path.join(web(CORP), 'index.html'), hc = leer(hcF);
  const comentario = h => (/^\s*<!--[^\n]*connect-src[^\n]*-->$/m.exec(h) || [null])[0];
  let h = hp;
  if (comentario(hp) && comentario(hc)) h = h.replace(comentario(hp), () => comentario(hc));
  const cs = /connect-src [^;"]*/.exec(hc);
  if (cs) h = h.replace(/connect-src [^;"]*/g, () => cs[0]);
  const lc = hc.split('\n');
  lc.forEach((l, i) => {
    if (!/^\s*<script src="vendor\/[^"]+"><\/script>$/.test(l)) return;
    const ancla = lc.slice(0, i).reverse().find(x => !/vendor\//.test(x));
    const lh = h.split('\n'), j = lh.indexOf(ancla);
    if (j < 0) { mal(`index.html: no encuentro dónde insertar ${l.trim()}`); return; }
    let k = j + 1; while (/vendor\//.test(lh[k] || '')) k++;
    lh.splice(k, 0, l); h = lh.join('\n');
  });
  if (h !== hc) escribir(hcF, h);
  // pruebas e2e: las de la regresión del Prototipo (salvo las propias) y sus fixtures; la lista del Corporativo conserva sus pruebas propias
  const archLista = r => ['tools/correr-e2e.mjs', 'tools/correr-e2e.js'].map(x => path.join(r, x)).find(x => fs.existsSync(x));
  const reLista = /const PRUEBAS = \[([^\]]*)\]/;
  const nombres = txt => (reLista.exec(txt) || [, ''])[1].match(/'[^']+'/g)?.map(x => x.slice(1, -1)) ?? [];
  const propio = t => PROPIOS.e2e.includes(t + '.js');
  const lpS = nombres(leer(archLista(PROTO))), lcF = archLista(CORP), lcTxt = leer(lcF);
  const nueva = [...lpS.filter(t => !propio(t)), ...nombres(lcTxt).filter(propio)];
  for (const t of lpS.filter(t => !propio(t))) copiar(path.join(PROTO, 'tests/e2e', t + '.js'), path.join(CORP, 'tests/e2e', t + '.js'));
  const fx = path.join(PROTO, 'tests/e2e/fixtures');
  if (fs.existsSync(fx)) for (const f of fs.readdirSync(fx, { recursive: true })) { const a = path.join(fx, f); if (fs.statSync(a).isFile()) copiar(a, path.join(CORP, 'tests/e2e/fixtures', f)); }
  const lcNuevo = lcTxt.replace(reLista, () => `const PRUEBAS = [${nueva.map(t => `'${t}'`).join(', ')}]`);
  if (lcNuevo !== lcTxt) escribir(lcF, lcNuevo);
  // este mismo archivo vive en ambos
  copiar(path.join(PROTO, 'tools/paridad.mjs'), path.join(CORP, 'tools/paridad.mjs'));
  console.log(cambios.length ? cambios.map(c => 'COPIA ' + c).join('\n') + `\nsincronizar: ${cambios.length} archivo(s) actualizados en el Corporativo` : 'sincronizar: el Corporativo ya estaba al día');
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
