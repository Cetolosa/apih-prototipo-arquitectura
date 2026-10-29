import { $, CALC, ACUERDOS, FASES_ACT, IC, MES3, St, _nrm, addD, by, byId, esProp, esSB, esc, fmtD, fmtDL, hitosDe, hoy, icon, inArea, isDone, isLive, miUsuario, nameOf, pD, pad, pct, riesgoAbierto, scope } from './01-nucleo.js';
import { Acts, F, Modal, UI, btn, closePops, confirmBox, copyText, download, render, toast } from './03-interfaz.js';
import { cmdServidor } from './04-flujos.js';
import { semOf } from './05b-vistas-portafolio-fases.js';
import { cut, informeTxt, todosAcu } from './06b-administracion-herramientas.js';

/* ============================================================
   APIH · Mi cocina (gamificación sin ranking de personas)
   Cada proyecto activo tiene 5 tenedores por semana: premian la gestión (actualizar, cumplir, avisar), nunca el resultado.
   Las estrellas Michelin (V16) premian hitos del cronograma y no se pierden.
   Todo se calcula con datos existentes: no hay listas nuevas.
   ============================================================ */
export const cieloOn = () => !St.cfg || St.cfg.cieloOn !== false;
const wkIni = d => addD(d, -((pD(d).getDay() + 6) % 7));            // lunes de la semana de d
export const STAR_DEF = [
  { k: 'dia', l: 'Al día', tip: 'Actualiza el proyecto esta semana (avance, logros o próximos pasos).' },
  { k: 'hit', l: 'Hitos', tip: 'Sin hitos vencidos. Si hay atraso, registra la reprogramación en Control de cambios.' },
  { k: 'cmp', l: 'Compromisos', tip: 'Cumple a tiempo los compromisos del proyecto.' },
  { k: 'rsk', l: 'Riesgos', tip: 'Revisa los riesgos en fecha y deja plan de mitigación a los críticos.' },
  { k: 'gob', l: 'Gobierno', tip: 'Si la fecha se corre sobre la tolerancia, registra el cambio antes de avisar.' }
];
export const STAR_SVG = (s, sz = 16) => s === 'na'
  ? `<svg class="fk fk-na" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/></svg>`
  : `<svg class="fk fk-${s}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 2h1.6v7.4H6.2zM11.2 2h1.6v7.4h-1.6zM16.2 2h1.6v7.4h-1.6zM6.2 8h11.6v1.8c0 1.8-1.7 3-4.6 3.2V22h-2.4V13c-2.9-.2-4.6-1.4-4.6-3.2z"/></svg>`;

/* --- «Mi cocina»: los tenedores, la racha, el nivel y las insignias los calcula el servidor (apih_cielo); aquí solo se leen y se suman --- */
export const CIELO = () => CALC.cielo || { W: '', proy: {}, hist: {}, personas: {}, impecables: {}, yo: null };
export const hoyW = () => CIELO().W || wkIni(hoy());
export const actSemana = i => { const p = CIELO().proy[i && i.id]; return p ? p.act || null : null; };   // 'real' | 'nc' | null
export function vencidosA(arr, f, E, doneF) { return arr.filter(x => x[f] && x[f] < E && !doneF(x, E)); }
export function starsOf(i) {
  const p = CIELO().proy[i && i.id], r = STAR_DEF.map(d => ({ ...d, s: p ? p.st[d.k] || 'na' : 'na', ...(d.k === 'dia' && p && p.tope ? { tip: 'Llevas 3 semanas actualizando sin avance real: sube el % de avance o cierra un hito y se enciende.' } : {}) }));
  r.lleno = !!(p && p.lleno); return r;
}
const cieloLleno = st => !!st.lleno;
export const proyActivos = me => St.ini.filter(i => CIELO().proy[i.id] && (!me || i.lider === me));
const NIV_COLOR = { 'Pinche': '#8A8886', 'Cocinero': '#C98A00', 'Chef de partida': '#0B5394', 'Chef ejecutivo': '#7A5AF8' };
export function cieloPersona(me) {
  const W0 = hoyW(), mine = proyActivos(me), cur = mine.map(i => ({ i, st: starsOf(i, W0) })), p = CIELO().personas[me] || { racha: 0, total: 0, nivel: 'Pinche', sig: 1 };
  return { cur, racha: p.racha, total: p.total, nivel: p.nivel, sig: p.sig, color: NIV_COLOR[p.nivel], on: cur.reduce((s, x) => s + x.st.filter(y => y.s === 'on').length, 0), off: cur.reduce((s, x) => s + x.st.filter(y => y.s === 'off').length, 0) };
}
export function cieloColectivo() {
  const W0 = hoyW(), ps = proyActivos(null).filter(i => inArea(i)), cur = ps.map(i => ({ i, st: starsOf(i, W0) }));
  const on = cur.reduce((s, x) => s + x.st.filter(y => y.s === 'on').length, 0), off = cur.reduce((s, x) => s + x.st.filter(y => y.s === 'off').length, 0);
  const serie = []; for (let k = 0; k < 8; k++) { let a = 0, b = 0; ps.forEach(i => { const h = (CIELO().hist[i.id] || [])[k]; if (h) { a += h[0]; b += h[1]; } }); serie.push(a + b ? Math.round(a / (a + b) * 100) : 0); }
  const prjs = scope();
  return { n: ps.length, prom: ps.length ? on / ps.length : 0, msTot: prjs.reduce((a, i) => a + msN(i), 0), ms3: prjs.filter(i => msN(i) === 3).length, llenas: cur.filter(x => cieloLleno(x.st)).length, pct: on + off ? Math.round(on / (on + off) * 100) : 0, serie, ayuda: cur.filter(x => x.st.some(y => y.s === 'off')).sort(by(x => -x.st.filter(y => y.s === 'off').length)) };
}
const starTxt = x => x.l + ': ' + (x.s === 'on' ? 'lograda' : x.s === 'off' ? 'pendiente. ' + x.tip : 'no aplica esta semana');
export const starsRow = (st, sz = 16) => `<span class="skyrow">${st.map(x => `<span class="stw" data-act="startip" data-t="${esc(starTxt(x))}" title="${esc(starTxt(x))}">${STAR_SVG(x.s, sz)}</span>`).join('')}</span>`;
export function starsMini(i) {
  if (!cieloOn() || esProp(i)) return '';
  const act = isLive(i) && FASES_ACT.includes(i.fase), n = msN(i);
  if (!act && !n) return '';
  return `<span class="pill soft" style="gap:6px" title="Tenedores de la semana y estrellas Michelin">${act ? starsRow(starsOf(i, hoyW()), 13) : ''}${n ? msRow(i, 13) : ''}</span>`;
}
export function semLbl(W) { const E = addD(W, 6), p = pD(W), q = pD(E); return `${p.getDate()} ${MES3[p.getMonth()]} – ${q.getDate()} ${MES3[q.getMonth()]}`; }
export const NIV = [['Pinche', 0, 1, '#8A8886'], ['Cocinero', 1, 4, '#C98A00'], ['Chef de partida', 4, 12, '#0B5394'], ['Chef ejecutivo', 12, 12, '#7A5AF8']];
export function anillo(pct, meta, sz = 120) {
  const r = 48, c = 2 * Math.PI * r, a = meta / 100 * 2 * Math.PI, mx = 60 + r * Math.sin(a), my = 60 - r * Math.cos(a);
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 120 120" role="img" aria-label="${pct}% de estrellas encendidas, meta ${meta}%"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--bd2)" stroke-width="9"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="#F5B82E" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c * pct / 100} ${c}" transform="rotate(-90 60 60)"/><circle cx="${mx}" cy="${my}" r="4.5" fill="var(--pri)" stroke="#fff" stroke-width="1.5"/><text x="60" y="58" text-anchor="middle" font-size="25" font-weight="700" fill="currentColor">${pct}%</text><text x="60" y="76" text-anchor="middle" font-size="10" fill="var(--tx2)">meta ${meta}%</text></svg>`;
}
/* ---------- Insignias (se calculan con datos existentes; no se guardan) ---------- */
const hashN = t => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const impecable = i => !!(i && CIELO().impecables[i.id]);   // lo decide el servidor
const INS_DEF = [
  ['p1', 'Mesa perfecta', 'Completa los 5 tenedores de todos tus proyectos en una semana.', 'fork', '#0B5394'],
  ['r4', 'Racha de 4', 'Cuatro semanas seguidas con los 5 tenedores.', 'spark', '#7A5AF8'],
  ['cs', 'Cero sorpresas', 'Cuatro semanas seguidas sin hitos vencidos sin explicar.', 'shield', '#107C10'],
  ['av', 'Primero en avisar', 'Registra un cambio de fecha o presupuesto antes de que venza el plazo.', 'bell', '#CA5010'],
  ['cu', 'Cumplidor', 'Cumple a tiempo 10 compromisos.', 'check', '#038387'],
  ['ci', 'Cierre impecable', 'Cierra un proyecto con todos sus hitos, sin riesgos abiertos y con su plan al día.', 'flag', '#C98A00'],
  ['bv', 'Bitácora viva', 'Actualiza tus proyectos en 8 semanas distintas.', 'book', '#B146C2'],
  ['m1', 'Estrella Michelin', 'Un proyecto tuyo gana su primera estrella Michelin.', 'flag', '#C8102E'],
  ['m3', 'Tres estrellas', 'Cierra un proyecto con las tres estrellas Michelin.', 'target', '#C8102E'],
  ['eq', 'Meta del equipo', 'Los tenedores del portafolio alcanzan la meta del mes. Se comparte entre todos.', 'users', '#D13438']
];
/* Insignias: el servidor entrega el avance y la meta de cada una (apih_cielo); aquí solo se les pone nombre e ícono */
export function insignias() {
  const yo = (CIELO().yo || {}).insignias || {};
  return INS_DEF.map(([k, n, d, ic, c]) => { const x = yo[k] || { v: 0, of: 1, ok: false }; return { k, n, d, ic, c, v: x.v, of: x.of, ok: !!x.ok }; });
}
export const asignar_insignias = v => (insignias = v);
const insigniasSet = me => new Set(insignias(me).filter(x => x.ok).map(x => x.k));
export function chkInsignias() {   // aviso al ganar una insignia nueva (la primera lectura es silenciosa)
  if (!cieloOn()) return; const me = miUsuario();
  const now = insigniasSet(me);
  if (UI.bdSt !== St || UI.bdMe !== me || !UI.bdPrev) { UI.bdSt = St; UI.bdMe = me; UI.bdPrev = now; return; }
  const nuevas = [...now].filter(k => !UI.bdPrev.has(k)); UI.bdPrev = now;
  nuevas.forEach(k => { const b = insignias(me).find(x => x.k === k); if (b) setTimeout(() => toast('Insignia obtenida: ' + b.n), 900); });
}
export const medalla = (b, sz = 56) => `<span class="medal ${b.ok ? 'on' : ''}" style="--c:${b.c};width:${sz}px;height:${sz}px">${icon(b.ic, Math.round(sz * .46))}</span>`;
function constelacion(i, sz = 130) {
  let h = hashN(i.id); const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return h / 4294967296; };
  const n = 6 + Math.floor(rnd() * 3), pts = Array.from({ length: n }, (_, k) => [10 + (k / (n - 1)) * 100 + (rnd() - .5) * 14, 12 + rnd() * 46]);
  const imp = impecable(i), c = imp ? '#F5B82E' : '#9DB8D6';
  return `<svg width="${sz}" height="${Math.round(sz * .55)}" viewBox="0 0 120 66" aria-hidden="true">${imp ? '<circle cx="60" cy="33" r="30" fill="#F5B82E" opacity=".12"/>' : ''}<polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="1" opacity=".7"/>${pts.map((p, k) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${k % 3 === 0 ? 3 : 2}" fill="${c}"/>`).join('')}</svg>`;
}

const CS_IMG = 'img/cs-base.jpg';
const CS_DEFS = `<svg width="0" height="0" style="position:absolute"><defs>
 <filter id="csnoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.2 1.05"/></filter>
 <filter id="csgr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".01 .4" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .25  0 0 0 0 .15  -2.4 0 0 0 1.2"/></filter>
 <filter id="csb3"><feGaussianBlur stdDeviation="3"/></filter><filter id="csb8"><feGaussianBlur stdDeviation="8"/></filter>
 <filter id="cschalk"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="1.4"/></filter>
 <radialGradient id="cspd" cx=".38" cy=".25" r=".95"><stop offset="0" stop-color="#5b524a"/><stop offset=".5" stop-color="#2d2723"/><stop offset="1" stop-color="#15110f"/></radialGradient>
 <radialGradient id="cspc" cx=".42" cy=".35" r=".85"><stop offset="0" stop-color="#f7ecd2"/><stop offset=".75" stop-color="#ecdcba"/><stop offset="1" stop-color="#d6c19a"/></radialGradient>
 <linearGradient id="csgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc95a"/><stop offset="1" stop-color="#e0891a"/></linearGradient>
 <linearGradient id="csflm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb33a"/><stop offset="1" stop-color="#ff5a1f"/></linearGradient>
 <linearGradient id="cspl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece6d8"/><stop offset="1" stop-color="#d8d0bd"/></linearGradient>
 <linearGradient id="cswd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a6a3a"/><stop offset=".5" stop-color="#b8814a"/><stop offset="1" stop-color="#8a5a2c"/></linearGradient>
</defs></svg>`;
const csPos = (x, y, h, ex = '') => `<div class="ab ${ex}" style="left:${x}px;top:${y}px">${h}</div>`;
function csArc(cx, cy, r, a0, a1) { const p = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)].map(v => v.toFixed(1)), q = p(a0 * Math.PI / 180), z = p(a1 * Math.PI / 180); return `M${q[0]} ${q[1]}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${z[0]} ${z[1]}`; }
function csExt() {
  let s = '<svg class="ab" style="left:0;top:524px" width="2000" height="170" viewBox="0 524 2000 170">';
  for (let y = 524; y < 694; y += 34) s += `<rect x="0" y="${y}" width="2000" height="34" fill="url(#cspl)"/><svg x="0" y="${y}" width="2000" height="34" overflow="hidden"><rect width="2000" height="34" filter="url(#csgr)" opacity=".28"/></svg><rect x="0" y="${y + 32}" width="2000" height="2.4" fill="#6d6552" opacity=".5"/><rect x="0" y="${y}" width="2000" height="1.5" fill="#fff" opacity=".7"/>`;
  return s + '<rect x="556" y="488" width="78" height="206" fill="url(#cswd)" stroke="#3a2412" stroke-width="3"/><rect x="1890" y="488" width="74" height="206" fill="url(#cswd)" stroke="#3a2412" stroke-width="3"/><rect x="0" y="524" width="2000" height="14" fill="#000" opacity=".1" filter="url(#csb3)"/></svg>';
}
function csFlame(x, y, on) {
  const o = 'M0 -26C4 -14 18 -8 18 8A18 18 0 0 1 -18 8C-18 0 -14 -5 -10 -9C-9 -3 -7 0 -4 0C-8 -12 -6 -20 0 -26Z', n = 'M0 -4C5 2 8 6 8 11A8 8 0 0 1 -8 11C-8 7 -4 4 0 -4Z';
  return `<g transform="translate(${x} ${y})" filter="url(#cschalk)"><path d="${o}" fill="${on ? 'url(#csflm)' : '#585d60'}" stroke="${on ? '#2a1608' : '#15171a'}" stroke-width="2.4" stroke-linejoin="round"/><path d="${n}" fill="${on ? '#ffe08a' : '#767b7e'}"/></g>`;
}
function csBoard(o) {
  const cx = 130, cy = 207, r = 62, arcs = Array.from({ length: 7 }, (_, k) => `<path d="${csArc(cx, cy, r - 1, -90 + k * 360 / 7 + 5, -90 + (k + 1) * 360 / 7 - 5)}" fill="none" stroke-width="7" stroke-linecap="round" stroke="${k < o.d ? '#F2A33A' : k === o.d ? '#fff4d6' : '#ffffff22'}"/>`).join('');
  const dl = 6 - o.d;
  return `<svg class="ab" style="left:0;top:0" width="560" height="440" viewBox="0 0 560 440"><path d="M58 172H508V402H58Z M58 138H200V280H58Z" fill="#2a2c2c"/><rect x="58" y="172" width="450" height="230" filter="url(#csnoise)" opacity=".1"/><ellipse cx="300" cy="300" rx="190" ry="60" fill="#fff" opacity=".035" filter="url(#csb8)"/>
  <path d="M70 235A60 60 0 0 0 82 270" stroke="#c42b2b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M178 160A60 60 0 0 1 192 180" stroke="#c42b2b" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#17191a" stroke="#050606" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r - 8}" fill="#3a332d"/><circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="#4a4038" stroke="#2a241f" stroke-width="2"/>${arcs}
  <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Roboto,Arial" font-size="38" font-weight="700" fill="#fff">${dl}</text><text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="Roboto,Arial" font-size="19" fill="#f2e6cc">${dl === 1 ? 'día' : 'días'}</text>
  ${Array.from({ length: 6 }, (_, k) => csFlame(90 + k * 44, 332, k < o.r)).join('')}</svg>`
    + csPos(226, 172, `<h1 class="cs-h1">${esc(o.l1)}</h1><div class="cs-or" style="width:290px">${esc(o.l2)}</div>`)
    + csPos(340, 316, `<div class="cs-wt" style="font-size:18px">${o.r ? 'racha de ' + o.r : 'sin racha aún'}</div>`)
    + csPos(60, 362, `<div class="cs-tag"><svg width="22" height="22" viewBox="0 0 40 40" fill="#fff" stroke="#c42b2b" stroke-width="3" style="margin-left:-4px"><path d="M8 32v-7c-7-1-9-10-3-14 3-6 11-6 14-1 5-4 13-1 14 5 6 3 5 11-2 12v5z"/></svg>${esc(o.n)}</div>`)
    + csPos(212, 368, `<div class="cs-wt">${esc(o.nx)}</div>`);
}
function csPlato(cx, cy, st, id, sel, full) {
  const tot = st.filter(y => y.s !== 'na').length, on = st.filter(y => y.s === 'on').length, f = tot > 0 && on === tot;
  const arcs = st.map((y, k) => `<path d="${csArc(0, 0, 69, -90 + k * 72 + 8, -90 + (k + 1) * 72 - 8)}" fill="none" stroke-width="5.5" stroke-linecap="round" stroke="${y.s === 'on' ? 'url(#csgold)' : y.s === 'na' ? '#4a403a' : '#7c7066'}" ${y.s === 'off' ? 'stroke-dasharray="1.2 7"' : ''} ${y.s === 'on' ? 'style="filter:drop-shadow(0 0 4px #f0a21e)"' : ''}/>`).join('');
  const stm = f ? '<g class="cs-stm" transform="translate(0 -60)"><path d="M-14 0c-6-6 6-10 0-18"/><path d="M0 -4c-6-6 6-10 0-18"/><path d="M14 0c-6-6 6-10 0-18"/></g>' : '';
  return `<svg class="ab" data-act="cocsel" data-id="${id}" style="left:${cx - 100}px;top:${cy - 100}px;z-index:6;${f || sel ? 'filter:drop-shadow(0 0 14px #F5B82E)' : ''}" width="200" height="200" viewBox="-100 -100 200 200"><title>${esc(st.map(y => y.l + ': ' + (y.s === 'on' ? 'lograda' : y.s === 'off' ? 'pendiente' : 'no aplica')).join(' · '))}</title>
  <ellipse cx="0" cy="8" rx="85" ry="87" fill="#000" opacity=".35" filter="url(#csb3)"/><ellipse cx="0" cy="0" rx="83" ry="86" fill="url(#cspd)" stroke="#120e0c" stroke-width="3"/><ellipse cx="0" cy="0" rx="79" ry="82" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.4"/>
  <path d="${csArc(0, 0, 76, -165, -105)}" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>${arcs}
  <ellipse cx="0" cy="0" rx="58" ry="60" fill="#d8c6a2" stroke="#2a211a" stroke-width="2.4"/><ellipse cx="0" cy="1" rx="52" ry="54" fill="url(#cspc)" stroke="#a8946e" stroke-width="1.6"/>
  <text x="0" y="6" text-anchor="middle" font-family="Roboto,Arial" font-size="34" font-weight="700" fill="${f ? '#a8730a' : '#3b3128'}">${on}/${tot}</text><text x="0" y="28" text-anchor="middle" font-family="Roboto,Arial" font-size="15" fill="#4b4036">tenedores</text>${stm}
  ${sel ? '<ellipse cx="0" cy="0" rx="93" ry="96" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="7 6"/>' : ''}</svg>`;
}
const CS_SLOT = [[691, 290], [919, 286], [1146, 291]];
export function cocaPase(me, P, C, meta, adm) {
  const f = F('cielo', {}), ls = P.cur.slice().sort(by(x => -x.st.filter(y => y.s === 'off').length));
  const NP = 3, np = Math.max(1, Math.ceil(ls.length / NP));
  const si = ls.findIndex(x => x.i.id === f.sel); if (si >= 0 && f.sel && f.pgS !== f.sel) { f.pg = Math.floor(si / NP); f.pgS = f.sel; }
  f.pg = Math.min(Math.max(f.pg || 0, 0), np - 1);
  const slots = ls.slice(f.pg * NP, f.pg * NP + NP), selX = ls.find(x => x.i.id === f.sel);
  const d = (pD(hoy()).getDay() + 6) % 7, resta = 6 - d, DN = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const nx = NIV.find(n => n[0] === P.nivel), sigN = (NIV[NIV.indexOf(nx) + 1] || [])[0], falt = nx[2] - P.total;
  const l2 = !ls.length ? 'No lideras proyectos activos esta semana.' : !P.off ? 'Los 5 tenedores en todos tus proyectos.' : resta ? 'Cierra el domingo: aún puedes encender tenedores.' : 'Último día del servicio: te faltan ' + P.off + ' tenedor' + (P.off === 1 ? '' : 'es') + '.';
  const B = insignias(me), cap = (me && P) ? Math.min(P.racha, 6) : 0;
  let h = CS_DEFS + `<div class="cs-out" id="csout"><div class="cs-in"><img class="cs-base" src="${CS_IMG}" alt="">` + csExt();
  h += csBoard({ d: d, r: cap, l1: 'Hoy es ' + DN[d], l2, n: P.nivel, nx: sigN ? falt + ' sem. para ' + sigN : 'Nivel máximo' });
  h += csPos(28, 442, `<div class="cs-s" style="left:0;top:0;position:relative"><h3>Salón de chefs <small>${C.llenas} de ${C.n} platos completos</small></h3><div class="m"><svg width="92" height="92" viewBox="0 0 120 120"><circle cx="60" cy="60" r="48" fill="none" stroke="#dacdb0" stroke-width="11"/><circle cx="60" cy="60" r="48" fill="none" stroke="url(#csgold)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${301 * C.pct / 100} 301" transform="rotate(-90 60 60)"/><text x="60" y="68" text-anchor="middle" font-size="26" font-weight="700" fill="#2a2622">${C.pct}%</text></svg><div><b>${C.pct >= meta ? '¡Meta lograda!' : 'Vamos por la meta (' + meta + '%)'}</b><br>${C.prom.toFixed(1)} de 5 tenedores en promedio<br>${MS_SVG(true, 16)} ${C.msTot} estrella${C.msTot === 1 ? '' : 's'} Michelin</div></div><div class="cs-ms">${B.map(b => `<span class="cs-m ${b.ok ? 'on' : ''}" data-act="startip" data-t="${esc(b.n + ': ' + (b.ok ? 'obtenida' : b.v + ' de ' + b.of))}" title="${esc(b.n + ': ' + (b.ok ? 'obtenida' : b.v + ' de ' + b.of))}">${icon(b.ic, 19)}</span>`).join('')}</div>${adm && C.ayuda.length ? `<div class="help">Necesitan una mano: ${C.ayuda.slice(0, 3).map(x => esc(cut(x.i.titulo, 22))).join(' · ')}${C.ayuda.length > 3 ? ' +' + (C.ayuda.length - 3) : ''}</div>` : ''}</div>`);
  if (!ls.length) h += csPos(690, 250, `<div class="cs-e">No encuentro proyectos activos con líder «${esc(me || '—')}».<br>Cuando lideres uno, su plato aparecerá aquí.</div>`);
  slots.forEach((x, k) => {
    const [cx, cy] = CS_SLOT[k], n = msN(x.i), t = x.st.filter(y => y.s !== 'na'), full = t.length && t.every(y => y.s === 'on');
    h += csPos(cx - 107, 368, `<div class="cs-l" data-act="cocsel" data-id="${x.i.id}"><b>${esc(cut(x.i.titulo, 34))}</b><small>${n ? `<u>${'★'.repeat(n)}${'☆'.repeat(3 - n)}</u> ` : ''}${esc(x.i.fase)}</small></div>`);
    h += csPlato(cx, cy, x.st, x.i.id, selX && selX.i.id === x.i.id);
    const xk = 738 + k * 124;
    h += csPos(xk, 98, `<div class="cs-k" data-act="cocsel" data-id="${x.i.id}" style="animation-delay:${k}s"><span class="pp"></span><span class="cl"></span><b>${esc(cut(x.i.titulo, 14).toUpperCase())}</b>${t.map(y => `<i class="${y.s === 'on' ? 'ok' : 'x'}">${y.s === 'on' ? '✓' : '✗'} ${esc(y.l)}</i>`).join('') || '<i>Sin tenedores aplicables</i>'}${full ? '<div class="cs-st">LISTA</div>' : ''}</div>`);
  });
  if (np > 1) h += csPos(780, 466, `<div class="cs-pg"><a data-act="cocpg" data-d="-1">‹</a><span>${f.pg * NP + 1}–${Math.min(ls.length, f.pg * NP + NP)} de ${ls.length}</span><a data-act="cocpg" data-d="1">›</a></div>`);
  if (selX) {
    const off = selX.st.filter(y => y.s === 'off').length;
    h += csPos(1215, 112, `<div class="cs-b"><span class="pp"></span><span class="cl"></span><span class="x" data-act="cocsel" data-id="">×</span><h5>${esc(cut(selX.i.titulo, 40))}</h5><div class="sub">${esc(selX.i.fase)} · ${off ? 'faltan ' + off + ' tenedor' + (off === 1 ? '' : 'es') : 'plato listo para salir'}</div>${selX.st.map(y => `<div class="li ${y.s === 'off' ? 'off' : ''}">${STAR_SVG(y.s, 17)}<div><b>${esc(y.l)}</b><span>${y.s === 'on' ? 'lograda esta semana' : y.s === 'off' ? esc(y.tip) : 'no aplica esta semana'}</span></div></div>`).join('')}<div class="go"><a data-act="sel" data-t="ini" data-id="${selX.i.id}">Abrir proyecto</a></div></div>`);
  }
  return h + '</div></div>';
}
export function cocFit() {
  const o = document.getElementById('csout'); if (!o) return;
  o.style.width = ''; const p = o.parentElement, cs = getComputedStyle(p), w = p.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4, top = p.getBoundingClientRect().top, avail = innerHeight - top - 14;
  const s = Math.max(.34, Math.min(w / 1500, avail / 694));
  o.style.width = (1500 * s) + 'px'; o.style.height = (694 * s) + 'px'; o.firstElementChild.style.transform = 'scale(' + s + ')';
  if (!window._cocR) { window._cocR = 1; addEventListener('resize', () => { try { cocFit(); } catch (e) { } }); }
}
export const asignar_cocFit = v => (cocFit = v);
Acts.cocsel = d => { const f = F('cielo', {}); f.sel = (f.sel === d.id || !d.id) ? '' : d.id; render(); };
Acts.cocpg = d => { const f = F('cielo', {}); f.pg = (f.pg || 0) + (+d.d); render(); };
/* C2.31 · Borrador del reporte semanal: los informes de estado de tus proyectos vigentes (o del que filtraste) en un solo texto, listo para copiar.
   Parte de lo que ya registraste; no incluye pendientes personales. */
function semanalTxt(me, pp) {
  const W = hoyW(), d7 = addD(hoy(), -7), mine = proyActivos(me, W).filter(i => !pp || pp === '__per' || i.id === pp);
  if (!mine.length) return '';
  const bloques = mine.map(i => {
    const hc = hitosDe(i.id).filter(h => h.completado && h.fechaReal && h.fechaReal > d7 && h.fechaReal <= hoy()).sort(by('fechaReal'));
    return informeTxt(i) + (hc.length ? '\n\nHITOS CUMPLIDOS EN LOS ÚLTIMOS 7 DÍAS\n' + hc.map(h => '- ' + h.nombre + ' · ' + fmtD(h.fechaReal)).join('\n') : '');
  });
  return ['REPORTE SEMANAL · ' + me, 'Semana del ' + semLbl(W) + ' · ' + mine.length + ' proyecto' + (mine.length === 1 ? '' : 's'), ''].join('\n') + '\n' + bloques.join('\n\n' + '='.repeat(48) + '\n\n');
}
Acts.semrep = () => {
  const f = F('cielo', {}), pp = f.pp !== undefined ? f.pp : (semOf().pp || ''), t = semanalTxt(miUsuario(), pp);
  if (!t) return toast('No tienes proyectos vigentes para armar el reporte', 'err');
  Modal.open({ title: 'Borrador del reporte semanal', wide: true, body: `<p class="desc" style="margin-top:0">Se arma con lo último que registraste en cada proyecto. Revísalo, cópialo y pégalo en un correo o en Teams.</p><textarea id="txtcopy" rows="20" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(t)}</textarea>`, footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn pri" data-act="copiartxt">${icon('copy', 14)}<span>Copiar</span></button>` });
};
/* C2.30 · «Qué cambió desde tu última visita»: lo que venció, lo que te asignaron y lo que otras personas hicieron en tus proyectos.
   La última visita se guarda en tu perfil (St.cfgU[usuario].sem.visita); «Entendido» la actualiza. Solo tus proyectos vigentes. */
export const nowTs = () => hoy() + 'T' + pad(new Date().getHours()) + ':' + pad(new Date().getMinutes());
function cambiosDesde(me) {
  const v = semOf().visita; if (!v) return null;
  const vd = v.slice(0, 10), H = hoy(), n = _nrm(me), ids = new Set(St.ini.filter(i => _nrm(i.lider) === n && !esSB(i) && !esProp(i) && !isDone(i)).map(i => i.id));
  const venc = [
    ...St.hitos.filter(h => !h.completado && ids.has(h.ini) && h.fecha > vd && h.fecha < H).map(h => ({ k: 'Hito', t: h.nombre, f: h.fecha, ini: h.ini })),
    ...todosAcu().filter(a => a.abierto && _nrm(a.resp) === n && a.limite && a.limite > vd && a.limite < H).map(a => ({ k: 'Compromiso', t: a.texto, f: a.limite, ini: a.ini })),
    ...St.riesgos.filter(r => ids.has(r.ini) && riesgoAbierto(r) && r.fRev && r.fRev > vd && r.fRev < H).map(r => ({ k: 'Revisión de riesgo', t: r.desc, f: r.fRev, ini: r.ini }))
  ].sort((a, b) => a.f < b.f ? -1 : 1);
  const nuevos = ACUERDOS().filter(a => a.estado === 'Abierto' && _nrm(a.resp) === n && _nrm(a.de) !== n && a.creada && a.creada > vd);
  const otros = (St.bitacora || []).filter(b => b.ts > v && b.ini && ids.has(b.ini) && _nrm(b.autor) !== n);
  return { v, vd, venc, nuevos, otros, total: venc.length + nuevos.length + otros.length };
}
export function cambiosHTML(me) {
  const D = cambiosDesde(me); if (!D || !D.total) return '';
  const li = (tipo, txt, f) => `<li><span class="mut">${esc(tipo)}</span><span>${esc(cut(txt, 70))}</span><small>${f}</small></li>`;
  const L = [...D.venc.slice(0, 4).map(x => li('Venció · ' + x.k, x.t, fmtD(x.f))), ...D.nuevos.slice(0, 3).map(a => li('Te asignaron', a.texto, a.limite ? 'límite ' + fmtD(a.limite) : '')), ...D.otros.slice(0, 4).map(b => li(b.autor || 'Otra persona', b.texto, fmtD(b.ts.slice(0, 10))))];
  const resto = D.total - L.length;
  return `<section class="card ps-card"><header><h2>Qué cambió desde tu última visita</h2><small>desde el ${fmtDL(D.vd)} · ${D.venc.length} vencido${D.venc.length === 1 ? '' : 's'} · ${D.nuevos.length} nuevo${D.nuevos.length === 1 ? '' : 's'} para ti · ${D.otros.length} cambio${D.otros.length === 1 ? '' : 's'} de otras personas</small><span class="edit-only" style="margin-left:auto">${btn('Entendido', 'cambvisto', { ic: 'check', cls: 'sm pri' })}</span></header><ul class="his-l">${L.join('')}</ul>${resto > 0 ? `<p class="mut" style="font-size:12px;margin:4px 0 0">y ${resto} más: míralos en Hitos, Compromisos o en la bitácora de cada proyecto.</p>` : ''}</section>`;
}
/* C2.29 · Mi historial: proyectos liderados, hitos y compromisos cumplidos y desarrollo profesional, en un solo lugar y exportable.
   Solo lo propio (sin comparar con otras personas); los pendientes «Personal» nunca entran. */
const HIS_RANGOS = [['6m', 'Últimos 6 meses'], ['12m', 'Últimos 12 meses'], ['anio', 'Este año'], ['todo', 'Todo']];
const hisDesde = k => k === '6m' ? addD(hoy(), -182) : k === '12m' ? addD(hoy(), -365) : k === 'anio' ? hoy().slice(0, 4) + '-01-01' : '0000-01-01';
function hisData(me, k) {
  const d0 = hisDesde(k), H = hoy(), n = _nrm(me), dentro = f => !!f && f >= d0 && f <= H;
  const mias = St.ini.filter(i => _nrm(i.lider) === n && !esSB(i) && !esProp(i));
  const ids = new Set(mias.map(i => i.id));
  const proy = mias.filter(i => isDone(i) ? dentro(i.finReal || i.finEst || i.finPlan) : (i.inicioReal || i.inicioPlan || '0000-01-01') <= H)
    .sort((a, b) => String(b.finReal || b.finPlan || '9999').localeCompare(String(a.finReal || a.finPlan || '9999')));
  const hitos = St.hitos.filter(h => h.completado && ids.has(h.ini) && dentro(h.fechaReal || h.fecha)).sort((a, b) => String(b.fechaReal || b.fecha).localeCompare(String(a.fechaReal || a.fecha)));
  const aTiempo = hitos.filter(h => !h.fechaReal || h.fechaReal <= h.fecha).length;
  const comp = todosAcu().filter(a => a.estado === 'Cumplido' && _nrm(a.resp) === n && dentro(a.fechaReal)).sort((a, b) => String(b.fechaReal).localeCompare(String(a.fechaReal)));
  const T = (semOf().t || []).filter(t => t.hecha && dentro(t.hecha)).sort((a, b) => String(b.hecha).localeCompare(String(a.hecha)));
  return { d0, H, proy, hitos, aTiempo, comp, dev: T.filter(t => t.cat === 'Desarrollo profesional'), trab: T.filter(t => t.cat === 'Trabajo'), estrellas: proy.reduce((a, i) => a + msN(i), 0) };
}
export function hisTxt(me, k) {
  const D = hisData(me, k), r = (HIS_RANGOS.find(x => x[0] === k) || HIS_RANGOS[1])[1], one = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim(), L = [];
  L.push('# Resumen de logros · ' + one(me), '', r + (k === 'todo' ? '' : ' (desde ' + fmtDL(D.d0) + ')') + ' · al ' + fmtDL(D.H), '');
  L.push('## En cifras', '- Proyectos liderados: ' + D.proy.length + (D.estrellas ? ' (' + D.estrellas + ' estrella' + (D.estrellas === 1 ? '' : 's') + ' Michelin)' : ''), '- Hitos cumplidos: ' + D.hitos.length + (D.hitos.length ? ' (' + D.aTiempo + ' a tiempo)' : ''), '- Compromisos cumplidos: ' + D.comp.length, '- Capacitación y desarrollo profesional: ' + D.dev.length, '');
  if (D.proy.length) { L.push('## Proyectos liderados'); D.proy.forEach(i => L.push('- ' + one(i.titulo) + ' · ' + i.estado + (isDone(i) ? ' · cerrado ' + fmtD(i.finReal || i.finEst || i.finPlan) : ' · ' + i.fase + ' · avance ' + pct(i.avance)) + (msN(i) ? ' · ' + msN(i) + ' estrella' + (msN(i) === 1 ? '' : 's') + ' Michelin' : ''))); L.push(''); }
  if (D.hitos.length) { L.push('## Hitos cumplidos'); D.hitos.forEach(h => L.push('- ' + fmtD(h.fechaReal || h.fecha) + ' · ' + one(h.nombre) + ' (' + one(nameOf(h.ini)) + ')')); L.push(''); }
  if (D.comp.length) { L.push('## Compromisos cumplidos'); D.comp.forEach(a => L.push('- ' + fmtD(a.fechaReal) + ' · ' + one(a.texto) + (a.ini ? ' (' + one(nameOf(a.ini)) + ')' : ''))); L.push(''); }
  if (D.dev.length) { L.push('## Capacitación y desarrollo profesional'); D.dev.forEach(t => L.push('- ' + fmtD(t.hecha) + ' · ' + one(t.t))); L.push(''); }
  if (D.trab.length) { L.push('## Otros pendientes de trabajo cumplidos'); D.trab.forEach(t => L.push('- ' + fmtD(t.hecha) + ' · ' + one(t.t))); L.push(''); }
  return L.join('\n');
}
Acts.hisr = d => { if (HIS_RANGOS.some(x => x[0] === d.k)) { F('cielo', {}).hr = d.k; render(); } };
Acts.hiscopy = () => copyText(hisTxt(miUsuario(), F('cielo', {}).hr || '12m'));
Acts.hisdl = () => { download('APIH_logros_' + hoy() + '.md', hisTxt(miUsuario(), F('cielo', {}).hr || '12m'), 'text/markdown'); toast('Resumen descargado'); };
export function hisHTML(me) {
  const f = F('cielo', {}), k = f.hr || '12m', D = hisData(me, k), kp = (l, v, sub) => `<div class="kpi sm"><div class="k-top"><span class="k-l">${l}</span></div><div class="k-v">${v}</div>${sub ? `<small class="mut">${sub}</small>` : ''}</div>`;
  const lst = (arr, fn, n = 6) => arr.length ? `<ul class="his-l">${arr.slice(0, n).map(fn).join('')}</ul>${arr.length > n ? `<p class="mut" style="font-size:12px;margin:4px 0 0">y ${arr.length - n} más: están en el resumen exportable.</p>` : ''}` : '<p class="mut" style="font-size:12px;margin:0">Nada en este período.</p>';
  const sec = (t, sub, body) => `<section class="card c6"><header><h2>${t}</h2><small>${sub}</small></header>${body}</section>`;
  return `<div class="toolbar"><div class="seg">${HIS_RANGOS.map(([v, t]) => `<button class="${k === v ? 'on' : ''}" data-act="hisr" data-k="${v}">${t}</button>`).join('')}</div><span style="margin-left:auto;display:inline-flex;gap:6px">${btn('Copiar resumen', 'hiscopy', { ic: 'copy', cls: 'sm' })}${btn('Descargar (.md)', 'hisdl', { ic: 'download', cls: 'sm pri' })}</span></div>
  <div class="note" style="margin:0 0 10px">${icon('info', 14)}<span>Es tu historial: solo lo tuyo, sin compararte con nadie. Los pendientes «Personal» nunca entran. Sirve para responder «¿y tú qué has hecho?» o armar tu resumen de fin de año.</span></div>
  <div class="grid4" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px">${kp('Proyectos liderados', D.proy.length, D.estrellas ? D.estrellas + ' estrella' + (D.estrellas === 1 ? '' : 's') + ' Michelin' : '')}${kp('Hitos cumplidos', D.hitos.length, D.hitos.length ? D.aTiempo + ' a tiempo' : '')}${kp('Compromisos cumplidos', D.comp.length, '')}${kp('Desarrollo profesional', D.dev.length, '')}</div>
  <div class="grid12">${sec('Proyectos liderados', 'vigentes y cerrados en el período', lst(D.proy, i => `<li><a class="lnk" data-act="sel" data-t="ini" data-id="${i.id}">${esc(cut(i.titulo, 44))}</a><small>${esc(i.estado)}${isDone(i) ? ' · cerrado ' + fmtD(i.finReal || i.finEst || i.finPlan) : ' · ' + esc(i.fase) + ' · ' + pct(i.avance)}${msN(i) ? ' · ' + msN(i) + ' ★' : ''}</small></li>`))}
  ${sec('Capacitación y desarrollo', 'pendientes «Desarrollo profesional» hechos', lst(D.dev, t => `<li><span>${esc(cut(t.t, 60))}</span><small>${fmtD(t.hecha)}</small></li>`) + `<div style="margin-top:8px" class="edit-only">${btn('Agregar pendiente', 'tareanew', { ic: 'plus', cls: 'sm' })}</div>`)}
  ${sec('Hitos cumplidos', 'de los proyectos que lideras', lst(D.hitos, h => `<li><span>${esc(cut(h.nombre, 50))}</span><small>${fmtD(h.fechaReal || h.fecha)} · ${esc(cut(nameOf(h.ini), 28))}</small></li>`))}
  ${sec('Compromisos cumplidos', 'los que tenías como responsable', lst(D.comp, a => `<li><span>${esc(cut(a.texto, 60))}</span><small>${fmtD(a.fechaReal)}</small></li>`))}</div>`;
}
export const CIELO_TABS = [['sem', 'Esta semana'], ['his', 'Mi historial'], ['ins', 'Insignias'], ['gal', 'Galería Michelin']];
Acts.cielotab = d => { F('cielo', {}).tab = d.k; render(); };
/* --- celebración al ganar estrellas --- */
export function estrellasOn(i) { return starsOf(i, hoyW()).filter(x => x.s === 'on').length; }
export function celebrar(i, antes) {
  if (!cieloOn() || antes == null) return;
  const st = starsOf(i, hoyW()), ahora = st.filter(x => x.s === 'on').length, ganadas = ahora - antes; if (ganadas <= 0) return;
  const lleno = cieloLleno(st), d = document.createElement('div'); d.className = 'sky-pop'; d.setAttribute('role', 'status');
  d.innerHTML = `<div class="sky-pb">${Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg;--d:${k % 2 ? 0 : .08}s"></i>`).join('')}<div class="sky-big">${STAR_SVG('on', 54)}</div><b>${lleno ? '¡Mesa perfecta!' : ganadas === 1 ? '¡Tenedor ganado!' : '¡' + ganadas + ' tenedores ganados!'}</b><small>${esc(cut(i.titulo, 40))}</small>${starsRow(st, 18)}</div>`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}
export const asignar_celebrar = v => (celebrar = v);

/* ============================================================
   APIH · V17 · «Ver como» ampliado + ventanas flotantes
   ============================================================ */
export function verComoLista() {   // solo personas con perfil: el servidor es quien simula
  const me = _nrm(St.cfg.usuario);
  return St.usuarios.map(u => u.n).filter(n => _nrm(n) !== me).sort((a, b) => a.localeCompare(b, 'es'));
}
export function ampliable() {
  const mn = $('#main'); if (!mn) return;
  mn.querySelectorAll('.card').forEach(c => {
    const h = c.querySelector(':scope>header'); if (!h || h.querySelector('.xp') || c.closest('#modal')) return;
    const big = c.textContent.length > 260 || c.scrollHeight > 300 || c.querySelector('table,.finds,.tbl-w');
    if (big) h.insertAdjacentHTML('beforeend', `<button class="icon-btn xp" data-act="xpand" title="Ampliar en ventana" aria-label="Ampliar en ventana">${icon('expand', 15)}</button>`);
  });
  mn.querySelectorAll('.f-i .f-c,.dcard').forEach(c => { if (!c.querySelector('.xpi') && c.textContent.length > 220) c.insertAdjacentHTML('beforeend', `<button class="icon-btn xpi" data-act="xpand" title="Ampliar en ventana" aria-label="Ampliar en ventana">${icon('expand', 14)}</button>`); });
  let n = 0;   // textos truncados (…): clic para leerlos completos
  for (const el of mn.querySelectorAll('span,b,td,small,p,a,.g-n,.hn')) {
    if (++n > 900) break;
    if (el.scrollWidth <= el.clientWidth + 1 || el.closest('[data-act],.xt') || el.querySelector('[data-act]')) continue;
    if (getComputedStyle(el).textOverflow !== 'ellipsis') continue;
    el.classList.add('xt'); el.dataset.act = 'xtext'; el.title = el.title || 'Clic para ver completo';
  }
}
Acts.xpand = (d, el) => {
  const c = el.closest('.card,.f-c,.dcard'); if (!c) return;
  const cl = c.cloneNode(true); cl.querySelectorAll('.xp,.xpi').forEach(x => x.remove()); cl.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
  const h = cl.querySelector(':scope>header'), t = ((h && h.querySelector('h2,h3')) || {}).textContent || ((c.querySelector('h3,b') || {}).textContent) || 'Detalle'; if (h) { const s = h.querySelector('small'); h.remove(); if (s) cl.insertAdjacentHTML('afterbegin', `<p class="desc">${esc(s.textContent)}</p>`); }
  Modal.open({ title: t.trim(), wide: true, xp: true, body: `<div class="xp-body">${cl.innerHTML}</div>`, footer: `<button class="btn" data-act="mclose">Cerrar</button>` }); const mb = $('#modal .m-b'); if (mb) mb.scrollTop = 0;
};
Acts.xtext = (d, el) => { const t = (el.textContent || '').trim(); if (t) Modal.open({ title: 'Texto completo', xp: true, body: `<div class="xt-txt">${esc(t)}</div>`, footer: `<button class="btn" data-act="mclose">Cerrar</button>` }); };
document.addEventListener('click', e => { if (Modal.cur && Modal.cur.xp && e.target.closest('.xp-body [data-act]')) Modal.close(); }, true);   // una acción dentro de la ventana la cierra y actúa sobre la página
IC.expand = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';


/* ============================================================
   APIH · V18 · Configuración por usuario
   · Perfil Administra: la configuración vale para todo el portafolio (y reemplaza los valores personales de esa clave).
   · Resto de perfiles: los umbrales y los ajustes de presentación solo rigen sobre las iniciativas que lidera la persona.
   Persistencia: St.cfgU[usuario] = { cfg:{…}, ptema:{…} } (clave «cfgU» de APIH_Config / registros).
   ============================================================ */
export let PRES_MIO = false;
export const asignar_PRES_MIO = v => (PRES_MIO = v);
export const PERS_KEYS = ['tolDesv', 'umbralCritico', 'diasSinUpdate', 'propDiasAmb', 'propDiasRojo', 'cieloMeta'];
export const cfgUOf = n => (St.cfgU || {})[_nrm(n)] || {};
export function cfgOf(n) { return cfgUOf(n).cfg || {}; }
export function cfgI(i, k) { const v = i && i.lider && !fijo(k) ? cfgOf(i.lider)[k] : null; return v != null && v !== '' ? v : St.cfg[k]; }   // rige el valor de quien lidera la iniciativa
export function cfgMi(k) { const v = fijo(k) ? null : cfgOf(miUsuario())[k]; return v != null && v !== '' ? v : St.cfg[k]; }                        // para etiquetas y KPIs de quien mira
export function cfgSet(n, o) { St.cfgU = St.cfgU || {}; const k = _nrm(n); St.cfgU[k] = St.cfgU[k] || {}; Object.assign(St.cfgU[k], o); }
export const PERS_DEF = [
  ['tolDesv', 'Tolerancia de desviación (días)', 'Sobre este valor una iniciativa se considera «atrasada»', 0, 365],
  ['diasSinUpdate', 'Días sin actualización (alerta)', 'Regla «Sin actualización» del Reglas PMO y recordatorios', 1, 365],
  ['umbralCritico', 'Umbral de riesgo crítico (exposición)', 'Probabilidad × impacto ≥ umbral', 5, 25],
  ['propDiasAmb', 'Propuesta en ámbar (días en la etapa)', 'Semáforo de propuestas', 1, 999],
  ['propDiasRojo', 'Propuesta en rojo (días en la etapa)', 'Semáforo de propuestas', 1, 999],
  ['cieloMeta', 'Meta mensual de «Mi cocina» (%)', 'Tenedores encendidos que se espera lograr', 10, 100]
];
export function menuRolCard() {
  const roles = ['Administra', 'Responsable', 'Colaborador', 'Invitado'], ent = V22.MENU, cur = St.cfg.menuRol || {};
  const on = (r, k) => (cur[r] && cur[r].length ? cur[r] : V22.MENU_ROL[r]).includes(k);
  return `<div class="grid12"><section class="card c12"><header><h2>Menú por rol</h2><small>Qué entradas del menú ve cada rol. Administra siempre conserva las suyas para no quedar sin acceso.</small></header>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Entrada</th>${roles.map(r => '<th class="n">' + r + '</th>').join('')}</tr></thead><tbody>${ent.map(e => `<tr><td>${esc(e.t)}</td>${roles.map(r => `<td class="n"><input type="checkbox" aria-label="${esc(e.t + ' para ' + r)}" data-chg="menurol" data-r="${r}" data-k="${e.k}" ${on(r, e.k) ? 'checked' : ''} ${r === 'Administra' && ['admin', 'inicio'].includes(e.k) ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="chips" style="margin-top:8px">${btn('Restablecer menús', 'menurolreset')}</div></section></div>`;
}

export const fijo = k => !!((St.cfg.fijos || {})[k]);
IC.lock = 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4';


/* ============================================================
   APIH · V20 · Disciplina de gestión
   1 Compuertas duras (solo Administra puede forzar) · 2 Línea base y valor ganado · 3 Riesgos críticos con mitigación y decisiones con plazo/escalamiento
   4 Beneficio real y priorización ponderada · 5 Tercera estrella exige resultado
   ============================================================ */
export const decMaxDias = () => +St.cfg.decMaxDias;
export const decEscalada = d => !!(d && d.estado === 'Pendiente' && d.escalada);   // la marca la pone el servidor (apih_mantener) al vencer el plazo de escalamiento
export const evm = i => (i && CALC.evm && CALC.evm[i.id]) || null;
Acts.basego = d => cmdServidor('apih_congelar_base', { p_id: d.id, p_rebase: false }, 'Línea base congelada');   // el servidor valida permisos y plan, arma la base y deja la bitácora
Acts.baserebase = d => { const i = byId(d.id); if (!i) return; confirmBox(`¿Reemplazar la línea base de <b>${esc(i.titulo)}</b>? La anterior queda en el historial.`, () => cmdServidor('apih_congelar_base', { p_id: d.id, p_rebase: true }, 'Línea base reemplazada'), 'Reemplazar', true); };
/* ============================================================
   APIH · V21 · Modo de interfaz (Simple / Profesional) · por usuario (St.cfgU[usuario].ui)
   ============================================================ */
export const NAV_SIMPLE = ['dashboard', 'cielo', 'proyectos', 'riesgos', 'decisiones', 'presentaciones', 'personas', 'miconfig', 'admin'];
export const COLS_SIMPLE = ['tipo', 'id', 'titulo', 'fase', 'avance', 'lider', 'rag'];
export const NAV_GRP = { dashboard: 'Portafolio', cielo: 'Portafolio', portfolio: 'Portafolio', proyectos: 'Portafolio', propuestas: 'Portafolio', hitos: 'Portafolio', riesgos: 'Portafolio', roadmap: 'Portafolio', gantt: 'Portafolio', fases: 'Portafolio', capacidad: 'Portafolio',
  comite: 'Gobierno', decisiones: 'Gobierno', compromisos: 'Gobierno', cambios: 'Gobierno', bitacora: 'Gobierno', calendario: 'Gobierno', personas: 'Personas y reportes', presentaciones: 'Personas y reportes',
  miconfig: 'Sistema', admin: 'Sistema', analisis: 'Sistema', proposito: 'Sistema' };
export const modoUI = () => { if (!UI.uiOv) { try { UI.uiOv = localStorage.getItem('apih_modo') || 'simple'; } catch (e) { UI.uiOv = 'simple'; } } return UI.uiOv === 'pro' ? 'pro' : 'simple'; };   // U-21: el modo se recuerda en este navegador

const SX_SEC = ['fecha real', 'solicitado por', 'iniciativa', 'mitigación', 'prob.', 'impacto', 'dueño', 'tipo', 'solicita', 'cargo', 'áreas', 'hitos abiertos', 'riesgos', 'decisiones', 'roles en el portafolio', 'rol', 've', 'edita', 'usa ia', 'panel de administración', 'acceso', 'inicio plan', 'fin real', 'sponsor', 'negocio'];
export function simplify() {
  const m = $('#main'); if (!m || modoUI() !== 'simple') return;
  const ph = m.querySelector('.ph-act') || m.querySelector('.ph');
  if (ph && !ph.querySelector('.sxbtn')) { const b = document.createElement('button'); b.className = 'btn sm sxbtn'; b.dataset.act = 'sxtoggle'; b.title = 'Mostrar u ocultar el detalle completo de esta pantalla'; b.textContent = UI.sx ? 'Ver menos' : 'Ver todo'; ph.appendChild(b); }
  if (UI.sx) return;
  const hide = e => e.classList.add('sx-h');
  m.querySelectorAll('table:not(.mini)').forEach(t => {
    const hs = [...t.querySelectorAll('thead tr:first-child th')]; if (!hs.length) return;
    const idx = hs.map((h, i) => SX_SEC.includes(h.innerText.trim().toLowerCase()) ? i : -1).filter(i => i >= 0);
    if (!idx.length || idx.length >= hs.length - 1) return;
    t.querySelectorAll('tr').forEach(tr => { if (tr.cells.length === hs.length) idx.forEach(i => hide(tr.cells[i])); });
  });
  m.querySelectorAll('.toolbar,.flt-bar').forEach(tb => {
    [...tb.children].forEach(c => {
      if (c.matches('.search,.seg,.tb-bt')) return;
      const s = c.matches('select') ? c : c.querySelector('select');
      if (s && /estado|rag/i.test(s.getAttribute('aria-label') || '')) return;
      if (c.matches('select,label,.chk,.popw,.flt')) hide(c);
    });
  });
  m.querySelectorAll('.ph-act .btn').forEach(b => { if (/^(Excel|JSON|CSV|PDF|Exportar)\b/i.test(b.innerText.trim())) hide(b); });
}
Acts.sxtoggle = () => { UI.sx = !UI.sx; render(); };
Acts.modo = d => { UI.uiOv = d.m; try { localStorage.setItem('apih_modo', d.m); } catch (e) { } UI.sx = false; closePops(); render(); toast((d.m === 'simple' ? 'Interfaz Simple' : 'Interfaz Profesional') + ' (se recuerda en este navegador)'); };
export function msToastSeen() { try { const k = 'apih_ms_toast_' + _nrm(St.cfg.usuario); if (sessionStorage.getItem(k)) return true; sessionStorage.setItem(k, '1'); } catch (e) { } return false; }

Acts.startip = d => toast(d.t);

/* ============================================================
   APIH · V16 · Tenedores y estrellas Michelin
   · Tenedores (hasta 5): gestión del día a día. Se recalculan cada semana (ver STAR_DEF); suben y bajan.
   · Estrellas Michelin (hasta 3): hitos del cronograma. Se guardan en la iniciativa (i.michelin) y, una vez ganadas, no se pierden.
   Sin listas ni columnas nuevas: viaja dentro del JSON del proyecto (dentro del registro del servidor).
   ============================================================ */
IC.fork = 'M9 2v6a3 3 0 0 0 6 0V2M12 2v6M12 11v11';
export const MS_DEF = [
  { n: 1, l: 'Primera estrella', tip: 'Completa a tiempo la primera fase del proyecto (o su primer hito, si no usa fases).' },
  { n: 2, l: 'Segunda estrella', tip: 'Sostén el ritmo hasta la mitad del plan: todos los hitos de la primera mitad cerrados a tiempo.' },
  { n: 3, l: 'Tercera estrella', tip: 'Cierra el proyecto a tiempo, con todos los hitos completados, dentro del presupuesto y con resultado registrado (beneficio real o resultado alcanzado).' }
];
export const MS_SVG = (on, sz = 16) => `<svg class="ms ${on ? 'ms-on' : 'ms-off'}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.7 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z"/></svg>`;
export const msN = i => (i && i.michelin ? i.michelin.length : 0);
export const msRow = (i, sz = 16, all) => {
  if (!msN(i) && !all) return '';
  return `<span class="skyrow ms-row">${MS_DEF.map(d => {
    const got = (i.michelin || []).find(x => x.n === d.n); if (!got && !all) return '';
    const t = got ? d.l + ': obtenida el ' + fmtD(got.f) + '. No se pierde.' : d.l + ': pendiente. ' + d.tip;
    return `<span class="stw" data-act="startip" data-t="${esc(t)}" title="${esc(t)}">${MS_SVG(!!got, sz)}</span>`;
  }).join('')}</span>`;
};
