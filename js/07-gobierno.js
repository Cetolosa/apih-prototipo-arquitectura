import { ENLACES } from './00-registro.js';
import { $, CALC, ACUERDOS, APIH_CONFIG, PERM, CAMBIOS, DECS, FASES_ACT, FASES_PRJ, FL, HITOS, IC, MES3, MESES, RAG_C, RIESGOS, St, _PP, _nrm, addD, atrasado, avatar, by, byId, critScore, desv, diasSinUpd, diffD, esAdmin, esAdminReal, esProp, esSB, esc, esperado, expo, fmtD, fmtDL, fmtMon, fmtN, fmtTot, forecast, hitosDe, hoy, icon, inArea, isActive, isDone, isLive, kpis, log, miUsuario, monOf, nameOf, pD, pad, pct, pctMon, personProjects, ppInval, quarter, ragSugerido, respSel, riesgoAbierto, riesgoCritico, riesgosCriticos, riesgosDe, save, scope, scopeP, toISO, uniq, tonoOnTrack } from './01-nucleo.js';
import { AuthService, DataService } from './02-datos.js';
import { Acts, Chg, F, Modal, UI, Views, btn, closePops, confirmBox, copyText, decForm, download, empty, go, hitoForm, kv, openForm, pageHead, refresh, render, riskForm, selOpts, selectEntity, spark, toCSV, toast, toggleHito } from './03-interfaz.js';
import { cmdServidor, diasEnFase, priorScore } from './04-flujos.js';
import { pasosCocinaHTML, semOf, semSet } from './05-vistas.js';
import { cut, informeTxt, notifUserCard, rondaIds, todosAcu } from './06-administracion.js';
/* ============================================================
   APIH · Mi cocina (gamificación sin ranking de personas)
   Cada proyecto activo tiene 5 tenedores por semana: premian la gestión (actualizar, cumplir, avisar), nunca el resultado.
   Las estrellas Michelin (V16) premian hitos del cronograma y no se pierden.
   Todo se calcula con datos existentes: no hay listas nuevas.
   ============================================================ */
export const cieloOn = () => !St.cfg || St.cfg.cieloOn !== false;
const wkIni = d => addD(d, -((pD(d).getDay() + 6) % 7));            // lunes de la semana de d
const STAR_DEF = [
  { k: 'dia', l: 'Al día', tip: 'Actualiza el proyecto esta semana (avance, logros o próximos pasos).' },
  { k: 'hit', l: 'Hitos', tip: 'Sin hitos vencidos. Si hay atraso, registra la reprogramación en Control de cambios.' },
  { k: 'cmp', l: 'Compromisos', tip: 'Cumple a tiempo los compromisos del proyecto.' },
  { k: 'rsk', l: 'Riesgos', tip: 'Revisa los riesgos en fecha y deja plan de mitigación a los críticos.' },
  { k: 'gob', l: 'Gobierno', tip: 'Si la fecha se corre sobre la tolerancia, registra el cambio antes de avisar.' }
];
const STAR_SVG = (s, sz = 16) => s === 'na'
  ? `<svg class="fk fk-na" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/></svg>`
  : `<svg class="fk fk-${s}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 2h1.6v7.4H6.2zM11.2 2h1.6v7.4h-1.6zM16.2 2h1.6v7.4h-1.6zM6.2 8h11.6v1.8c0 1.8-1.7 3-4.6 3.2V22h-2.4V13c-2.9-.2-4.6-1.4-4.6-3.2z"/></svg>`;

/* --- «Mi cocina»: los tenedores, la racha, el nivel y las insignias los calcula el servidor (apih_cielo); aquí solo se leen y se suman --- */
const CIELO = () => CALC.cielo || { W: '', proy: {}, hist: {}, personas: {}, impecables: {}, yo: null };
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
function cieloColectivo() {
  const W0 = hoyW(), ps = proyActivos(null).filter(i => inArea(i)), cur = ps.map(i => ({ i, st: starsOf(i, W0) }));
  const on = cur.reduce((s, x) => s + x.st.filter(y => y.s === 'on').length, 0), off = cur.reduce((s, x) => s + x.st.filter(y => y.s === 'off').length, 0);
  const serie = []; for (let k = 0; k < 8; k++) { let a = 0, b = 0; ps.forEach(i => { const h = (CIELO().hist[i.id] || [])[k]; if (h) { a += h[0]; b += h[1]; } }); serie.push(a + b ? Math.round(a / (a + b) * 100) : 0); }
  const prjs = scope();
  return { n: ps.length, prom: ps.length ? on / ps.length : 0, msTot: prjs.reduce((a, i) => a + msN(i), 0), ms3: prjs.filter(i => msN(i) === 3).length, llenas: cur.filter(x => cieloLleno(x.st)).length, pct: on + off ? Math.round(on / (on + off) * 100) : 0, serie, ayuda: cur.filter(x => x.st.some(y => y.s === 'off')).sort(by(x => -x.st.filter(y => y.s === 'off').length)) };
}
const starTxt = x => x.l + ': ' + (x.s === 'on' ? 'lograda' : x.s === 'off' ? 'pendiente. ' + x.tip : 'no aplica esta semana');
export const starsRow = (st, sz = 16) => `<span class="skyrow">${st.map(x => `<span class="stw" data-act="startip" data-t="${esc(starTxt(x))}" title="${esc(starTxt(x))}">${STAR_SVG(x.s, sz)}</span>`).join('')}</span>`;
function starsMini(i) {
  if (!cieloOn() || esProp(i)) return '';
  const act = isLive(i) && FASES_ACT.includes(i.fase), n = msN(i);
  if (!act && !n) return '';
  return `<span class="pill soft" style="gap:6px" title="Tenedores de la semana y estrellas Michelin">${act ? starsRow(starsOf(i, hoyW()), 13) : ''}${n ? msRow(i, 13) : ''}</span>`;
}
function semLbl(W) { const E = addD(W, 6), p = pD(W), q = pD(E); return `${p.getDate()} ${MES3[p.getMonth()]} – ${q.getDate()} ${MES3[q.getMonth()]}`; }
export const NIV = [['Pinche', 0, 1, '#8A8886'], ['Cocinero', 1, 4, '#C98A00'], ['Chef de partida', 4, 12, '#0B5394'], ['Chef ejecutivo', 12, 12, '#7A5AF8']];
function anillo(pct, meta, sz = 120) {
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
const insigniasSet = me => new Set(insignias(me).filter(x => x.ok).map(x => x.k));
function chkInsignias() {   // aviso al ganar una insignia nueva (la primera lectura es silenciosa)
  if (!cieloOn()) return; const me = miUsuario();
  const now = insigniasSet(me);
  if (UI.bdSt !== St || UI.bdMe !== me || !UI.bdPrev) { UI.bdSt = St; UI.bdMe = me; UI.bdPrev = now; return; }
  const nuevas = [...now].filter(k => !UI.bdPrev.has(k)); UI.bdPrev = now;
  nuevas.forEach(k => { const b = insignias(me).find(x => x.k === k); if (b) setTimeout(() => toast('Insignia obtenida: ' + b.n), 900); });
}
const medalla = (b, sz = 56) => `<span class="medal ${b.ok ? 'on' : ''}" style="--c:${b.c};width:${sz}px;height:${sz}px">${icon(b.ic, Math.round(sz * .46))}</span>`;
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
function cocaPase(me, P, C, meta, adm) {
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
function cambiosHTML(me) {
  const D = cambiosDesde(me); if (!D || !D.total) return '';
  const li = (tipo, txt, f) => `<li><span class="mut">${esc(tipo)}</span><span>${esc(cut(txt, 70))}</span><small>${f}</small></li>`;
  const L = [...D.venc.slice(0, 4).map(x => li('Venció · ' + x.k, x.t, fmtD(x.f))), ...D.nuevos.slice(0, 3).map(a => li('Te asignaron', a.texto, a.limite ? 'límite ' + fmtD(a.limite) : '')), ...D.otros.slice(0, 4).map(b => li(b.autor || 'Otra persona', b.texto, fmtD(b.ts.slice(0, 10))))];
  const resto = D.total - L.length;
  return `<section class="card ps-card"><header><h2>Qué cambió desde tu última visita</h2><small>desde el ${fmtDL(D.vd)} · ${D.venc.length} vencido${D.venc.length === 1 ? '' : 's'} · ${D.nuevos.length} nuevo${D.nuevos.length === 1 ? '' : 's'} para ti · ${D.otros.length} cambio${D.otros.length === 1 ? '' : 's'} de otras personas</small><span class="edit-only" style="margin-left:auto">${btn('Entendido', 'cambvisto', { ic: 'check', cls: 'sm pri' })}</span></header><ul class="his-l">${L.join('')}</ul>${resto > 0 ? `<p class="mut" style="font-size:12px;margin:4px 0 0">y ${resto} más: míralos en Hitos, Compromisos o en la bitácora de cada proyecto.</p>` : ''}</section>`;
}
Acts.cambvisto = () => { if (soloLectura()) return NO_PERM('Tu rol o el modo solo lectura no permiten editar'); if (semSet({ visita: nowTs() })) { toast('Listo: desde ahora te mostraré lo nuevo'); refresh(); } };
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
function hisHTML(me) {
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
const CIELO_TABS = [['sem', 'Esta semana'], ['his', 'Mi historial'], ['ins', 'Insignias'], ['gal', 'Galería Michelin']];
Views.cielo = {
  render() {
    const f = F('cielo', { tab: 'sem' }), me = miUsuario(), P = cieloPersona(me), C = cieloColectivo(), meta = ((CIELO().yo || {}).meta) || cfgMi('cieloMeta') || 80, adm = rolActual() === 'Administra' || rolActual() === 'Responsable';
    const tabs = `<div class="seg" style="margin-bottom:12px">${CIELO_TABS.map(([k, l]) => `<button class="${f.tab === k ? 'on' : ''}" data-act="cielotab" data-k="${k}">${l}</button>`).join('')}</div>`;
    const head = pageHead('Mi cocina', 'Tenedores por gestionar bien el día a día (se mueven cada semana) y estrellas Michelin por cumplir hitos (una vez ganadas, no se pierden). Un proyecto en rojo que se reporta a tiempo también enciende sus tenedores.', `<span class="edit-only">${btn('Ronda de actualización' + (rondaIds().length ? ' (' + rondaIds().length + ')' : ''), 'ronda', { ic: 'refresh', cls: 'pri' })}</span>`) + tabs;
    if (f.tab === 'his') return head + hisHTML(me);
    if (f.tab === 'ins') {
      const B = insignias(me), n = B.filter(x => x.ok).length;
      return head + `<section class="card"><header><h2>Insignias</h2><small>${n} de ${B.length} obtenidas · se ganan por conductas de gestión, nunca por competir</small></header><div class="badges">${B.map(b => `<div class="badge ${b.ok ? 'on' : ''}">${medalla(b)}<div><b>${b.n}</b><small>${esc(b.d)}</small><span class="bprog"><i style="width:${Math.round(b.v / b.of * 100)}%"></i></span><em>${b.ok ? 'Obtenida' : b.v + ' de ' + b.of}</em></div></div>`).join('')}</div></section>`;
    }
    if (f.tab === 'gal') {
      const G = scope().filter(i => (msN(i) || i.estado === 'Completado'));
      G.sort((a, b) => msN(b) - msN(a) || String(b.finReal || b.actualizada || '').localeCompare(String(a.finReal || a.actualizada || '')));
      return head + `<section class="card sky-card"><header><h2>Galería Michelin</h2><small style="color:#cfe0f5">${G.length} proyecto${G.length === 1 ? '' : 's'} · las estrellas se ganan por hitos y no se pierden</small></header>${G.length ? `<div class="gal">${G.slice(0, 12).map(i => `<button class="gal-i" data-act="sel" data-t="ini" data-id="${i.id}">${msRow(i, 26, true)}<b>${esc(cut(i.titulo, 30))}</b><small>${msN(i) ? msN(i) + ' de 3 estrellas' : 'Sin estrellas aún'}${i.estado === 'Completado' ? (i.finReal ? ' · cerrado ' + fmtD(i.finReal) : ' · completado') : ''}${i.lider === me ? ' · tuyo' : ''}</small></button>`).join('')}</div>${G.length > 12 ? `<p class="sky-hint">+ ${G.length - 12} más</p>` : ''}` : '<p class="sky-e">Aquí quedarán, para siempre, las estrellas Michelin de tus proyectos.<br>La primera llega al completar a tiempo la primera fase o el primer hito del cronograma.</p>'}</section>`;
    }
    if (f.tab === 'how') {
      return pageHead('Reglas del juego', 'Mi cocina · cómo se ganan los tenedores y las estrellas Michelin.') + `<div style="margin:0 0 10px"><button class="btn sm" data-act="cielotab" data-k="sem">← Volver a Mi cocina</button></div>` + `<div class="grid12"><section class="card c6"><header><h2>Los 5 tenedores de la semana</h2><small>cada proyecto activo, de lunes a domingo</small></header><div class="sky-leg">${STAR_DEF.map(d => `<div>${STAR_SVG('on', 15)}<span><b>${d.l}</b> ${esc(d.tip)}</span></div>`).join('')}</div><p class="mut" style="font-size:12px;margin:8px 0 0">Los tenedores suben y bajan: se encienden al gestionar bien y se apagan si algo queda pendiente. Si no hay nada que evaluar (por ejemplo, un proyecto sin compromisos), aparece un punto: «no aplica». Hitos y compromisos se miden con las fechas reales; Riesgos y Gobierno, solo en la semana en curso.</p>
      <h3 class="sky-lt">Estrellas Michelin (hasta 3)</h3><div class="sky-leg">${MS_DEF.map(d => `<div>${MS_SVG(true, 15)}<span><b>${d.l}.</b> ${esc(d.tip)}</span></div>`).join('')}</div><p class="mut" style="font-size:12px;margin:8px 0 0">Se ganan una a una por hitos del cronograma y <b>una vez ganadas no se pierden</b>. Un cambio de fecha aprobado en Control de cambios explica un atraso. Aplican a proyectos: las propuestas no tienen cronograma.</p></section>
      <section class="card c6"><header><h2>Niveles, racha e insignias</h2></header><div class="sky-leg"><div>${icon('fork', 15)}<span><b>Racha:</b> semanas seguidas con los 5 tenedores (todos tus proyectos, sin ninguno pendiente).</span></div><div>${icon('spark', 15)}<span><b>Niveles:</b> Pinche, Cocinero (1 semana perfecta), Chef de partida (4) y Chef ejecutivo (12), contando las últimas 26 semanas.</span></div><div>${icon('flag', 15)}<span><b>Insignias:</b> ${insignias(me).length} reconocimientos por conductas concretas. Se ganan solas; no se pierden.</span></div><div>${icon('users', 15)}<span><b>Salón de chefs:</b> porcentaje de tenedores encendidos del portafolio frente a la meta (${meta}%), el promedio de tenedores y las estrellas Michelin repartidas. Sin ranking de personas.</span></div></div>
      <h3 class="sky-lt">Reglas del juego limpio</h3><div class="sky-leg"><div>${icon('check', 15)}<span>Reportar un rojo a tiempo vale lo mismo que un verde.</span></div><div>${icon('check', 15)}<span>«Sin novedades» no da tenedor la tercera semana seguida.</span></div><div>${icon('check', 15)}<span>No se usa para evaluar desempeño ni para bonos.</span></div></div></section></div>`;
    }
    if (!semOf().visita && !FL.verComo && !soloLectura()) { semSet({ visita: nowTs() }); setTimeout(() => { try { save(); } catch (e) { } }, 0); }   // primera visita: queda la base, sin aviso
    return head + cambiosHTML(me) + pasosCocinaHTML(me) + cocaPase(me, P, C, meta, adm);
    const ls = P.cur.slice().sort(by(x => -x.st.filter(y => y.s === 'off').length));
    const nx = NIV.find(n => n[0] === P.nivel), sigN = (NIV[NIV.indexOf(nx) + 1] || [])[0], falt = nx[2] - P.total;
    const proy = ls.length ? ls.map(x => `<button class="sky-r" data-act="sel" data-t="ini" data-id="${x.i.id}"><span class="sky-n">${esc(cut(x.i.titulo, 40))}<small>${esc(x.i.fase)} · ${x.st.filter(y => y.s === 'on').length} de ${x.st.filter(y => y.s !== 'na').length} tenedores</small></span><span class="rowg">${starsRow(x.st, 22)}${msRow(x.i, 22)}</span></button>`).join('') : '<p class="sky-e">No lideras proyectos activos esta semana.<br>Cuando lideres uno, aparecerá aquí con sus tenedores.</p>';
    const B = insignias(me), bn = B.filter(x => x.ok).length;
    return head + `<div class="grid12">
      <section class="card c7 sky-card"><header><h2>Semana del ${semLbl(hoyW())}</h2><span class="sky-lv"><span class="pill" style="--c:${P.color}">${P.nivel}</span></span></header>
        <div class="sky-sub"><span>${P.racha ? `Racha: <b>${P.racha}</b> semana${P.racha === 1 ? '' : 's'} con los 5 tenedores` : 'Aún sin racha: enciende los 5 tenedores de todos tus proyectos esta semana'}</span>${sigN ? `<span>${falt} semana${falt === 1 ? '' : 's'} perfecta${falt === 1 ? '' : 's'} para <b>${sigN}</b></span>` : '<span>Nivel máximo</span>'}</div>
        <div class="sky-l">${proy}</div>
        ${ls.length ? (P.off ? `<div class="sky-hint">Te faltan <b>${P.off}</b> tenedor${P.off === 1 ? '' : 'es'}: toca (o pasa el mouse sobre) uno apagado para ver cómo ganarlo.</div>` : '<div class="sky-hint ok">¡Mesa perfecta esta semana!</div>') : ''}
      </section>
      <section class="card c5"><header><h2>Salón de chefs</h2><small>${C.llenas} de ${C.n} proyectos con los 5 tenedores</small></header>
        <div class="sky-col">${anillo(C.pct, meta)}<div class="sky-colt"><b>${C.pct >= meta ? '¡Meta lograda!' : 'Vamos por la meta'}</b><span class="mut">Tenedores encendidos del portafolio. Nadie sale en un ranking: la cocina es de todos.</span><span class="msum"><b>${C.prom.toFixed(1)}</b> de 5 tenedores en promedio · ${MS_SVG(true, 14)} <b>${C.msTot}</b> estrella${C.msTot === 1 ? '' : 's'} Michelin repartida${C.msTot === 1 ? '' : 's'}${C.ms3 ? ' · ' + C.ms3 + ' con las 3' : ''}</span><div class="sky-sp" title="Últimas 8 semanas (%)">${spark(C.serie, 150, 34)}</div></div></div>
        ${adm && C.ayuda.length ? `<div class="note" style="margin-top:8px">${icon('users', 14)}<span><b>Proyectos que necesitan una mano:</b> ${C.ayuda.slice(0, 4).map(x => esc(cut(x.i.titulo, 22))).join(' · ')}${C.ayuda.length > 4 ? ' +' + (C.ayuda.length - 4) : ''}</span></div>` : ''}
        <h3 class="sky-lt">Mis insignias · ${bn} de ${B.length}</h3><div class="medals">${B.map(b => `<span title="${esc(b.n + ' · ' + (b.ok ? 'obtenida' : b.v + ' de ' + b.of))}" data-act="startip" data-t="${esc(b.n + ': ' + (b.ok ? 'obtenida' : b.v + ' de ' + b.of))}">${medalla(b, 34)}</span>`).join('')}</div>
      </section>
    </div>`;
  }
};
Acts.cielotab = d => { F('cielo', {}).tab = d.k; render(); };
/* --- celebración al ganar estrellas --- */
function estrellasOn(i) { return starsOf(i, hoyW()).filter(x => x.s === 'on').length; }
export function celebrar(i, antes) {
  if (!cieloOn() || antes == null) return;
  const st = starsOf(i, hoyW()), ahora = st.filter(x => x.s === 'on').length, ganadas = ahora - antes; if (ganadas <= 0) return;
  const lleno = cieloLleno(st), d = document.createElement('div'); d.className = 'sky-pop'; d.setAttribute('role', 'status');
  d.innerHTML = `<div class="sky-pb">${Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg;--d:${k % 2 ? 0 : .08}s"></i>`).join('')}<div class="sky-big">${STAR_SVG('on', 54)}</div><b>${lleno ? '¡Mesa perfecta!' : ganadas === 1 ? '¡Tenedor ganado!' : '¡' + ganadas + ' tenedores ganados!'}</b><small>${esc(cut(i.titulo, 40))}</small>${starsRow(st, 18)}</div>`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d); setTimeout(() => d.remove(), 2600);
}

/* ============================================================
   APIH · V17 · «Ver como» ampliado + ventanas flotantes
   ============================================================ */
function verComoLista() {   // solo personas con perfil: el servidor es quien simula
  const me = _nrm(St.cfg.usuario);
  return St.usuarios.map(u => u.n).filter(n => _nrm(n) !== me).sort((a, b) => a.localeCompare(b, 'es'));
}
function ampliable() {
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
const PERS_KEYS = ['tolDesv', 'umbralCritico', 'diasSinUpdate', 'propDiasAmb', 'propDiasRojo', 'cieloMeta'];
export const esAdministra = () => rolActual() === 'Administra';
const cfgUOf = n => (St.cfgU || {})[_nrm(n)] || {};
function cfgOf(n) { return cfgUOf(n).cfg || {}; }
export function cfgI(i, k) { const v = i && i.lider && !fijo(k) ? cfgOf(i.lider)[k] : null; return v != null && v !== '' ? v : St.cfg[k]; }   // rige el valor de quien lidera la iniciativa
function cfgMi(k) { const v = fijo(k) ? null : cfgOf(miUsuario())[k]; return v != null && v !== '' ? v : St.cfg[k]; }                        // para etiquetas y KPIs de quien mira
export function cfgSet(n, o) { St.cfgU = St.cfgU || {}; const k = _nrm(n); St.cfgU[k] = St.cfgU[k] || {}; Object.assign(St.cfgU[k], o); }
export function soloMio(fn) { const sv = PRES_MIO; PRES_MIO = !esAdministra(); try { return fn(); } finally { PRES_MIO = sv; } }   // presentaciones: no-Administra solo con sus iniciativas
export function ptemaEf() { if (!esAdministra() && !fijo('tema')) { const o = cfgUOf(miUsuario()).ptema; if (o) return o; } return St.ptema || {}; }
export function ptemaSet(t) { if (esAdministra()) St.ptema = t; else if (fijo('tema')) { toast('El tema lo fijó el rol Administra', 'err'); return; } else cfgSet(miUsuario(), { ptema: t }); ENLACES.TEMA.set(t); }
const PERS_DEF = [
  ['tolDesv', 'Tolerancia de desviación (días)', 'Sobre este valor una iniciativa se considera «atrasada»', 0, 365],
  ['diasSinUpdate', 'Días sin actualización (alerta)', 'Regla «Sin actualización» del Reglas PMO y recordatorios', 1, 365],
  ['umbralCritico', 'Umbral de riesgo crítico (exposición)', 'Probabilidad × impacto ≥ umbral', 5, 25],
  ['propDiasAmb', 'Propuesta en ámbar (días en la etapa)', 'Semáforo de propuestas', 1, 999],
  ['propDiasRojo', 'Propuesta en rojo (días en la etapa)', 'Semáforo de propuestas', 1, 999],
  ['cieloMeta', 'Meta mensual de «Mi cocina» (%)', 'Tenedores encendidos que se espera lograr', 10, 100]
];
Views.miconfig = {
  render() {
    const g = esAdministra(), me = miUsuario(), o = cfgOf(me), n = St.ini.filter(i => _nrm(i.lider) === _nrm(me)).length;
    const def = { propDiasAmb: 30, propDiasRojo: 60, cieloMeta: 80 };
    const rows = PERS_DEF.map(([k, l, h, mn, mx]) => { const fx = fijo(k), pers = !g && !fx && o[k] != null, gen = St.cfg[k] != null ? St.cfg[k] : def[k], v = pers ? o[k] : gen, dis = FL.verComo || (!g && fx);
      const tag = fx ? '<span class="mc-tag on">' + icon('lock', 11) + ' ' + (g ? 'Fijo' : 'Fijado por Administra') + '</span>' : g ? '<span class="mc-tag on">Global</span>' : pers ? '<span class="mc-tag on">Personal</span> <small>general: ' + gen + '</small>' : '<span class="mc-tag">General</span>';
      const act = g ? btn(fx ? 'Liberar' : 'Fijar', 'myfix', { cls: 'sm', d: { k } }) : pers ? btn('Restablecer', 'myreset', { cls: 'sm', d: { k } }) : '';
      return `<div class="mc-row"><div><b>${l}</b><br><small>${h}</small></div><input type="number" min="${mn}" max="${mx}" value="${v}" data-chg="mycfg" data-k="${k}" data-min="${mn}" data-max="${mx}" ${dis ? 'disabled' : ''}><div>${tag}</div><div>${act}</div></div>`; }).join('');
    const tp = !g && cfgUOf(me).ptema;
    return pageHead('Mi configuración', g ? 'Rol Administra (la PMO, con permisos sobre todo el portafolio): tus cambios valen para todo el portafolio · «Fijar» impide que los líderes cambien un parámetro' : 'Tus cambios valen solo para las ' + n + ' iniciativas que lideras', '') + `
    <div class="grid12"><section class="card c12 mc-card"><header><h2>Umbrales de alerta</h2><small>${g ? 'Reemplazan los valores personales de cada usuario' : 'El resto del portafolio sigue con los valores generales'}</small></header><div class="mc-grid">${rows}</div></section>
    <section class="card c12"><header><h2>Presentaciones</h2></header><p class="desc">Tema: <b>${fijo('tema') ? 'fijado por Administra' : g ? 'global' : tp ? 'personal' : 'general'}</b>. Las plantillas que guardes ${g ? 'son para todos' : 'son solo tuyas'}. ${g ? 'Los decks incluyen todo el portafolio.' : 'Tus decks incluyen solo las iniciativas que lideras.'}</p><div class="chips">${btn('Ir a Presentaciones', 'go', { d: { v: 'presentaciones' } })}${g ? btn(fijo('tema') ? 'Liberar tema' : 'Fijar tema', 'myfix', { d: { k: 'tema' } }) : ''}${tp && !fijo('tema') ? btn('Volver al tema general', 'myreset', { d: { k: '_tema' } }) : ''}</div></section></div>`;
  }
};
{ const mc0 = Views.miconfig.render; Views.miconfig.render = function () { const h = mc0.apply(this, arguments); const k = h.lastIndexOf('</div>'); return k < 0 ? h : h.slice(0, k) + notifUserCard() + h.slice(k); }; }
function menuRolCard() {
  const roles = ['Administra', 'Responsable', 'Colaborador', 'Invitado'], ent = V22.MENU, cur = St.cfg.menuRol || {};
  const on = (r, k) => (cur[r] && cur[r].length ? cur[r] : V22.MENU_ROL[r]).includes(k);
  return `<div class="grid12"><section class="card c12"><header><h2>Menú por rol</h2><small>Qué entradas del menú ve cada rol. Administra siempre conserva las suyas para no quedar sin acceso.</small></header>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Entrada</th>${roles.map(r => '<th class="n">' + r + '</th>').join('')}</tr></thead><tbody>${ent.map(e => `<tr><td>${esc(e.t)}</td>${roles.map(r => `<td class="n"><input type="checkbox" aria-label="${esc(e.t + ' para ' + r)}" data-chg="menurol" data-r="${r}" data-k="${e.k}" ${on(r, e.k) ? 'checked' : ''} ${r === 'Administra' && ['admin', 'inicio'].includes(e.k) ? 'disabled' : ''}></td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div class="chips" style="margin-top:8px">${btn('Restablecer menús', 'menurolreset')}</div></section></div>`;
}
Chg.menurol = el => { if (!esAdministra()) return; const r = el.dataset.r, k = el.dataset.k, cur = St.cfg.menuRol = St.cfg.menuRol || {}; const base = (cur[r] && cur[r].length ? cur[r] : V22.MENU_ROL[r]).slice(); const i = base.indexOf(k); if (el.checked && i < 0) base.push(k); if (!el.checked && i >= 0) base.splice(i, 1); cur[r] = V22.MENU.map(e => e.k).filter(x => base.includes(x)); save(); render(); };
Acts.menurolreset = () => { if (!esAdministra()) return; delete St.cfg.menuRol; save(); render(); toast('Menús restablecidos'); };
Chg.mycfg = el => {
  if (FL.verComo) { toast('Sal de «Ver como» para editar', 'err'); refresh(); return; }
  const k = el.dataset.k, v = Math.min(+el.dataset.max || 9999, Math.max(+el.dataset.min || 0, +el.value || 0));
  if (!esAdministra() && fijo(k)) { toast('Parámetro fijado por el rol Administra', 'err'); refresh(); return; }
  if (esAdministra()) { St.cfg[k] = v; Object.values(St.cfgU || {}).forEach(u => { if (u.cfg) delete u.cfg[k]; }); }
  else { const c = Object.assign({}, cfgOf(miUsuario())); c[k] = v; cfgSet(miUsuario(), { cfg: c }); }
  refresh();
};

const fijo = k => !!((St.cfg.fijos || {})[k]);   // parámetro fijado por Administra: nadie más puede cambiarlo
Acts.myfix = d => { if (!esAdministra() || FL.verComo) return; const f = Object.assign({}, St.cfg.fijos || {}); if (f[d.k]) delete f[d.k]; else f[d.k] = 1; St.cfg.fijos = f; refresh(); };
IC.lock = 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4';
Acts.myreset = d => { if (FL.verComo || (!esAdministra() && fijo(d.k === '_tema' ? 'tema' : d.k))) return; const u = cfgUOf(miUsuario()); if (d.k === '_tema') delete u.ptema; else if (u.cfg) delete u.cfg[d.k]; refresh(); };


/* ============================================================
   APIH · V20 · Disciplina de gestión
   1 Compuertas duras (solo Administra puede forzar) · 2 Línea base y valor ganado · 3 Riesgos críticos con mitigación y decisiones con plazo/escalamiento
   4 Beneficio real y priorización ponderada · 5 Tercera estrella exige resultado
   ============================================================ */
const decMaxDias = () => +St.cfg.decMaxDias || 30;
const decEscalada = d => !!(d && d.estado === 'Pendiente' && d.escalada);   // la marca la pone el servidor (apih_mantener) al vencer el plazo de escalamiento
const evm = i => (i && CALC.evm && CALC.evm[i.id]) || null;   // valor ganado: lo calcula el servidor contra la línea base
function controlHTML(i) {
  if (esProp(i)) return '';
  const b = i.base, e = evm(i), ix = v => v == null ? '—' : `<span style="color:${v >= .95 ? 'var(--grn,#107C10)' : v >= .85 ? '#CA5010' : 'var(--red)'};font-weight:700">${v.toFixed(2)}</span>`;
  let h = '';
  if (b) h += kv('Línea base', `${fmtD(b.fecha)} · fin ${fmtD(b.fin)} · ${fmtN(b.pres)}`) + (e ? kv('Desv. vs base', `<span style="color:${e.dfin > 0 ? 'var(--red)' : 'inherit'}">${e.dfin > 0 ? '+' : ''}${e.dfin} d</span>`) + kv('SPI · CPI', ix(e.spi) + ' · ' + ix(e.cpi)) : '') + kv('Hitos movidos', e ? `${e.movidos}${e.nuevos ? ' (+' + e.nuevos + ' nuevos)' : ''}` : '—');
  else if (isLive(i) && FASES_ACT.includes(i.fase)) h += kv('Línea base', '<span class="mut" title="La línea base fija las fechas plan para medir desvíos">sin congelar</span> ' + (puedeEditarIni(i) && i.inicioPlan && i.finPlan ? btn('Congelar', 'basego', { cls: 'sm', d: { id: i.id } }) : ''));
  if (b && esAdministra()) h += kv('', btn('Re-baselinear', 'baserebase', { cls: 'sm', d: { id: i.id } }));
  const rl = i.beneficio > 0 ? Math.round((i.ahorroReal || 0) / i.beneficio * 100) : null;
  h += kv('Beneficio esperado · real', `${fmtMon(i.beneficio || 0, monOf(i))} · ${fmtMon(i.ahorroReal || 0, monOf(i))}${rl != null ? ' (' + rl + '%)' : ''}`);
  return `<div class="pn-sec"><div class="kvs">${h}</div></div>`;
}
Acts.basego = d => cmdServidor('apih_congelar_base', { p_id: d.id, p_rebase: false }, 'Línea base congelada');   // el servidor valida permisos y plan, arma la base y deja la bitácora
Acts.baserebase = d => { const i = byId(d.id); if (!i) return; confirmBox(`¿Reemplazar la línea base de <b>${esc(i.titulo)}</b>? La anterior queda en el historial.`, () => cmdServidor('apih_congelar_base', { p_id: d.id, p_rebase: true }, 'Línea base reemplazada'), 'Reemplazar', true); };
/* ============================================================
   APIH · V21 · Modo de interfaz (Simple / Profesional) · por usuario (St.cfgU[usuario].ui)
   ============================================================ */
const NAV_SIMPLE = ['dashboard', 'cielo', 'proyectos', 'riesgos', 'decisiones', 'presentaciones', 'personas', 'miconfig', 'admin'];
const COLS_SIMPLE = ['tipo', 'id', 'titulo', 'fase', 'avance', 'lider', 'rag'];
export const NAV_GRP = { dashboard: 'Portafolio', cielo: 'Portafolio', portfolio: 'Portafolio', proyectos: 'Portafolio', propuestas: 'Portafolio', hitos: 'Portafolio', riesgos: 'Portafolio', roadmap: 'Portafolio', gantt: 'Portafolio', fases: 'Portafolio', capacidad: 'Portafolio',
  comite: 'Gobierno', decisiones: 'Gobierno', compromisos: 'Gobierno', cambios: 'Gobierno', bitacora: 'Gobierno', calendario: 'Gobierno', personas: 'Personas y reportes', presentaciones: 'Personas y reportes',
  miconfig: 'Sistema', admin: 'Sistema', analisis: 'Sistema', proposito: 'Sistema' };
export const modoUI = () => { if (!UI.uiOv) { try { UI.uiOv = localStorage.getItem('apih_modo') || 'simple'; } catch (e) { UI.uiOv = 'simple'; } } return UI.uiOv === 'pro' ? 'pro' : 'simple'; };   // U-21: el modo se recuerda en este navegador

const SX_SEC = ['fecha real', 'solicitado por', 'iniciativa', 'mitigación', 'prob.', 'impacto', 'dueño', 'tipo', 'solicita', 'cargo', 'áreas', 'hitos abiertos', 'riesgos', 'decisiones', 'roles en el portafolio', 'rol', 've', 'edita', 'usa ia', 'panel de administración', 'acceso', 'inicio plan', 'fin real', 'sponsor', 'negocio'];
function simplify() {
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
function msToastSeen() { try { const k = 'apih_ms_toast_' + _nrm(St.cfg.usuario); if (sessionStorage.getItem(k)) return true; sessionStorage.setItem(k, '1'); } catch (e) { } return false; }

Acts.startip = d => toast(d.t);

/* ============================================================
   APIH · V16 · Tenedores y estrellas Michelin
   · Tenedores (hasta 5): gestión del día a día. Se recalculan cada semana (ver STAR_DEF); suben y bajan.
   · Estrellas Michelin (hasta 3): hitos del cronograma. Se guardan en la iniciativa (i.michelin) y, una vez ganadas, no se pierden.
   Sin listas ni columnas nuevas: viaja dentro del JSON del proyecto (dentro del registro del servidor).
   ============================================================ */
IC.fork = 'M9 2v6a3 3 0 0 0 6 0V2M12 2v6M12 11v11';
const MS_DEF = [
  { n: 1, l: 'Primera estrella', tip: 'Completa a tiempo la primera fase del proyecto (o su primer hito, si no usa fases).' },
  { n: 2, l: 'Segunda estrella', tip: 'Sostén el ritmo hasta la mitad del plan: todos los hitos de la primera mitad cerrados a tiempo.' },
  { n: 3, l: 'Tercera estrella', tip: 'Cierra el proyecto a tiempo, con todos los hitos completados, dentro del presupuesto y con resultado registrado (beneficio real o resultado alcanzado).' }
];
const MS_SVG = (on, sz = 16) => `<svg class="ms ${on ? 'ms-on' : 'ms-off'}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.7 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z"/></svg>`;
const msN = i => (i && i.michelin ? i.michelin.length : 0);
const msRow = (i, sz = 16, all) => {
  if (!msN(i) && !all) return '';
  return `<span class="skyrow ms-row">${MS_DEF.map(d => {
    const got = (i.michelin || []).find(x => x.n === d.n); if (!got && !all) return '';
    const t = got ? d.l + ': obtenida el ' + fmtD(got.f) + '. No se pierde.' : d.l + ': pendiente. ' + d.tip;
    return `<span class="stw" data-act="startip" data-t="${esc(t)}" title="${esc(t)}">${MS_SVG(!!got, sz)}</span>`;
  }).join('')}</span>`;
};
const RAYOS = () => Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg;--d:${k % 2 ? 0 : .08}s"></i>`).join('');
function celebrarMichelin(i) {
  const d = document.createElement('div'); d.className = 'sky-pop'; d.setAttribute('role', 'status');
  d.innerHTML = `<div class="sky-pb">${RAYOS()}<div class="sky-big">${MS_SVG(true, 54)}</div><b>¡Estrella Michelin!</b><small>${esc(cut(i.titulo, 40))}</small>${msRow(i, 22, true)}</div>`;
  d.addEventListener('click', () => d.remove()); document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
}
/* Mantenimiento: el servidor marca las decisiones escaladas y otorga las estrellas Michelin nuevas (nunca quita). Aquí solo se pide y se celebra. */
async function mantenerSrv() {
  if (!St || !St.ini || UI.mantBusy || (UI.mantTs && Date.now() - UI.mantTs < 20000)) return;
  UI.mantBusy = true; UI.mantTs = Date.now();
  try {
    const boot = !UI.msBoot; UI.msBoot = true;
    const r = await DataService.svc.rpc('apih_mantener', {}).catch(e => { console.error(e); return null; });   // sin recarga si no hubo cambios
    const nuevas = r && Array.isArray(r.estrellas) ? r.estrellas : [];
    if (!r || (!nuevas.length && !r.escaladas)) return;
    await DataService.refresh(false, true);
    if (nuevas.length) {
      if ((boot || nuevas.length > 1) && !msToastSeen()) toast(nuevas.length + ' proyecto' + (nuevas.length === 1 ? '' : 's') + ' con estrellas Michelin por hitos ya cumplidos');
      else { const i = byId(nuevas[0].id); if (i) setTimeout(() => celebrarMichelin(i), document.querySelector('.sky-pop') ? 2700 : 350); }
    }
  } finally { UI.mantBusy = false; }
}

/* ============================================================
   APIH · Módulo Análisis del portafolio: reglas PMO, riesgos, resumen ejecutivo y roadmap
   Reglas deterministas sobre los datos locales. 
   ============================================================ */
const GRUPOS_REGLAS = {
  pmo: { n: 'Reglas PMO', ic: 'target', c: '#0D446A', d: 'Vigila el cumplimiento del cronograma y la disciplina de actualización.', rules: ['Proyecto atrasado', 'Sin actualización', 'Hito vencido', 'Decisión vencida', 'Decisión escalada', 'Desempeño vs línea base', 'Beneficio sin medir'] },
  riesgos: { n: 'Reglas de riesgos', ic: 'shield', c: '#D13438', d: 'Detecta exposición alta, concentración de riesgo y dependencias críticas.', rules: ['Impacto alto', 'Probabilidad alta', 'Dependencias críticas', 'Sin plan de mitigación'] },
  ejecutivo: { n: 'Resumen ejecutivo', ic: 'spark', c: '#8764B8', d: 'Redacta el resumen ejecutivo automático del portafolio para comité.', rules: ['Titular y KPIs', 'Logros y foco', 'Finanzas', 'Decisiones requeridas'] },
  roadmap: { n: 'Reglas de roadmap', ic: 'road', c: '#038387', d: 'Revisa secuencia, capacidad de líderes y desfases de proyectos, y la salud del pipeline de propuestas.', rules: ['Sobrecarga de líder', 'Secuencia de dependencias', 'Desfase de trimestre', 'Candidatos a iniciar', 'Propuesta estancada', 'Propuesta incompleta'] }
};
const SEVT = { 3: 'Crítico', 2: 'Atención', 1: 'Info' };

/* Los hallazgos (reglas PMO, de riesgos y de roadmap) los evalúa el servidor (apih_calculos). Aquí solo se filtran por las reglas activadas y por el área elegida. */
const GRUPO_REGLA = { PMO: 'pmo', Riesgos: 'riesgos', Roadmap: 'roadmap' };
function motorAlertas() {
  if (APIH_CONFIG.analisis === false) return [];
  const R = St.cfg.reglas || {};
  return (CALC.hallazgos || []).filter(f => R[GRUPO_REGLA[f.grupo]] !== false && (!(f.inis || []).length || f.inis.some(id => { const i = byId(id); return !!i && inArea(i); })));
}
const insightsFor = i => motorAlertas().filter(f => f.ini === i.id);

/* ---------- Resumen ejecutivo automático ---------- */
export function execSummary(tone) {
  const K = kpis(), L = scope(), live = L.filter(isLive), det = tone === 'det', V = CALC.resumen.ventanas;   /* ventanas de días y tramos: del servidor */
  const crit = live.filter(i => FASES_ACT.includes(i.fase)).sort(by(i => -critScore(i))).slice(0, det ? 4 : 3);
  const recent = HITOS().filter(h => h.completado && h.fechaReal && diffD(hoy(), h.fechaReal) <= V.hitosDias && byId(h.ini) && inArea(byId(h.ini)));
  const cerr = L.filter(i => i.estado === 'Completado' && i.finReal && diffD(hoy(), i.finReal) <= V.cierreDias);
  const nxt = HITOS().filter(h => !h.completado && h.fecha >= hoy() && diffD(h.fecha, hoy()) <= V.proximosDias && byId(h.ini) && inArea(byId(h.ini))).sort(by('fecha'));
  const rc = riesgosCriticos(), pend = DECS().filter(d => d.estado === 'Pendiente');
  const tone1 = tonoOnTrack(K.ontrackPct).txt;
  const S = [];
  S.push({ h: 'Titular', p: [`El portafolio de TI ${tone1}: ${K.activos} proyectos activos, ${pct(K.ontrackPct)} on track, ${K.atrasados} atrasado(s) y ${K.riesgosCrit} riesgo(s) crítico(s). Hay ${K.pipe} propuestas en el pipeline (${K.propAprob} listas para aprobación).`] });
  S.push({ h: 'Logros recientes', p: [(cerr.length ? `Se completaron ${cerr.length} proyecto(s) en las últimas semanas: ${cerr.map(i => i.titulo).join(', ')}. ` : '') + (recent.length ? `Además se completaron ${recent.length} hitos en los últimos 30 días${det ? ' (' + recent.slice(0, 4).map(h => h.nombre).join('; ') + ')' : ''}.` : 'No se registran hitos completados en los últimos 30 días.')] });
  S.push({ h: 'Foco y alertas', p: crit.map(i => { const w = ragSugerido(i).why; return `${i.titulo} (${i.rag}, ${pct(i.avance)})${desv(i) ? `: desviación de ${desv(i)} d respecto a la línea base` : ''}${w.length ? ' — ' + w.join(', ') : ''}.`; }) });
  S.push({ h: 'Riesgos', p: [rc.length ? `Hay ${rc.length} riesgo(s) crítico(s): ${rc.slice(0, det ? 4 : 2).map(r => `“${r.desc}” (${nameOf(r.ini)}, exposición ${expo(r)})`).join('; ')}.` : 'No hay riesgos críticos abiertos.'] });
  S.push({ h: 'Finanzas', p: [`Presupuesto en cartera ${fmtTot(K.M.pres)}, con ${fmtTot(K.M.gas)} consumidos (${pctMon(K.M.gas, K.M.pres)}%). Las propuestas en pipeline estiman ${fmtTot(K.M.presPipe)} adicionales y el beneficio esperado total asciende a ${fmtTot(K.M.beneficio)} (cifras de beneficio y presupuesto marcadas como estimadas deben validarse).`] });
  S.push({ h: 'Decisiones requeridas', p: pend.length ? pend.sort(by('limite')).slice(0, det ? 6 : 4).map(d => `${d.tipo}: ${d.titulo}${d.limite < hoy() ? ' (vencida)' : ' — límite ' + fmtD(d.limite)}.`) : ['No hay decisiones pendientes.'] });
  if (det) S.push({ h: 'Próximos 30 días', p: nxt.slice(0, 6).map(h => `${fmtD(h.fecha)} · ${h.nombre} (${nameOf(h.ini)})`) });
  return S;
}
const execText = S => S.map(s => s.h.toUpperCase() + '\n' + s.p.map(x => '• ' + x).join('\n')).join('\n\n');

const lnk = (id, t) => `<a class="lnk" data-act="sel" data-t="ini" data-id="${id}">${esc(t || nameOf(id))}</a>`;
Chg.grptoggle = el => { St.cfg.reglas[el.dataset.id] = el.checked; refresh(); };
Acts.anaf = d => { const f = F('analisis', {}); f.sev = f.sev === +d.s ? 0 : +d.s; render(); };
Acts.anagr = d => { const f = F('analisis', {}); f.gr = f.gr === d.a ? '' : d.a; render(); };
Acts.anatone = d => { UI.exec = { tone: d.t, S: execSummary(d.t), ts: new Date().toISOString().slice(0, 16) }; render(); };
Acts.execcopy = () => copyText(execText(UI.exec.S));
Acts.execpres = () => { F('pres', {}).useExec = true; go('presentaciones'); };
/* acciones sugeridas por hallazgos */
Acts.fx = d => {
  const f = motorAlertas().find(x => x.uid === d.u); const a = f && f.fx[+d.k]; if (!a) return;
  if (soloLectura() && !['go', 'fxrisk'].includes(a.a)) return toast(RO_MSG, 'err');
  const i = byId(a.id);
  switch (a.a) {
    case 'fxrag': Acts.applyrag({ id: a.id, rag: a.rag }); break;
    case 'fxnudge': log('Comentario', a.id, `Recordatorio del Reglas PMO: solicitar actualización de avance a ${i.lider}.`); toast('Recordatorio enviado a ' + i.lider + ' (registrado)'); refresh(); break;
    case 'fxacc': { const c = St.comites.filter(x => x.estado === 'Programado').sort(by('fecha'))[0]; if (!c) return toast('No hay un comité programado', 'err'); c.acciones.push({ id: 'ACC-' + Math.random().toString(36).slice(2, 6), texto: 'Plan de recuperación de cronograma: ' + i.titulo, resp: i.lider, limite: addD(hoy(), 7), estado: 'Abierta', ini: i.id }); log('Cambio', i.id, 'Acción de recuperación creada por el Reglas PMO'); toast('Acción creada en el próximo comité'); refresh(); break; }
    case 'fxsel': selectEntity('ini', a.id); break;
    case 'fxhito': hitoForm(St.hitos.find(h => h.id === a.id)); break;
    case 'fxdone': toggleHito(a.id); break;
    case 'fxrisk': { const r = St.riesgos.find(x => x.id === a.id); selectEntity('risk', r.id); riskForm(r); break; }
    case 'fxdeprisk': { const dp = byId(a.dep); riskForm(null, a.id, { desc: `Dependencia crítica: retraso o falla de ${dp.titulo}`, cat: 'Cronograma', prob: 4, imp: 4, mit: 'Hito de sincronización semanal con la predecesora y plan alternativo.', dueno: i.lider }); break; }
    case 'mkdec': decForm(null, a.id, { tipo: a.tp, titulo: a.ti, recomendacion: a.rec }); break;
    case 'resolvedec': Acts.resolvedec({ id: a.id }); break;
    case 'go': go(a.v); break;
    case 'edit': Acts.edit({ t: a.t2, id: a.id }); break;
  }
};

/* ---------- vista Análisis del portafolio ---------- */
Views.analisis = {
  render() {
    const f = F('analisis', { sev: 0, gr: '' }); const all = motorAlertas(); let rows = all; if (f.sev) rows = rows.filter(x => x.sev === f.sev); if (f.gr) rows = rows.filter(x => x.grupo === f.gr);
    const cnt = g => all.filter(x => x.grupo === g).length;
    const nm = { pmo: 'PMO', riesgos: 'Riesgos', roadmap: 'Roadmap' };
    const card = id => { const a = GRUPOS_REGLAS[id], on = St.cfg.reglas[id], n = id === 'ejecutivo' ? null : cnt(nm[id]);
      return `<article class="agent ${on ? '' : 'off'}" style="--c:${a.c}" title="${esc(a.d + ' Revisa: ' + a.rules.join(', ') + '.')}"><div class="a-h"><span class="a-i">${icon(a.ic, 18)}</span><div><h3>${a.n}</h3><small>${on ? 'Activo' : 'Desactivado'}</small></div><label class="sw" title="Activar/desactivar"><input type="checkbox" ${on ? 'checked' : ''} data-chg="grptoggle" data-id="${id}" aria-label="Activar ${a.n}"><i></i></label></div>
      <p>${a.d}</p><ul class="a-r">${a.rules.map(r => `<li>${icon('check', 12)} ${r}</li>`).join('')}</ul>
      <div class="a-f">${n != null ? `<span class="a-n">${n} hallazgos</span>` : '<span class="a-n">Resumen</span>'}</div></article>`; };
    const ex = { tone: UI.exec?.tone || 'con', S: execSummary(UI.exec?.tone || 'con'), ts: '' };
    return pageHead('Análisis del portafolio', 'Reglas fijas sobre los datos del portafolio. Los hallazgos se actualizan al cambiar los datos y sugieren acciones concretas.', '') + `
    <div class="agents">${['pmo', 'riesgos', 'roadmap', 'ejecutivo'].map(card).join('')}</div>
    <div class="grid12" style="margin-top:14px"><section class="card c7"><header><h2>Hallazgos de las reglas</h2><small>${rows.length} de ${all.length}</small></header>
      <div class="toolbar flat"><div class="chips">${[3, 2, 1].map(s => `<button class="chip ${f.sev === s ? 'on' : ''}" style="--c:${s === 3 ? '#D13438' : s === 2 ? '#F2A100' : '#0D446A'}" data-act="anaf" data-s="${s}"><i></i>${SEVT[s]} · ${all.filter(x => x.sev === s).length}</button>`).join('')}${['PMO', 'Riesgos', 'Roadmap'].map(a => `<button class="chip ${f.gr === a ? 'on' : ''}" style="--c:#605E5C" data-act="anagr" data-a="${a}"><i></i>${a} · ${cnt(a)}</button>`).join('')}</div></div>
      <div class="finds">${rows.map(x => `<article class="find s-${x.sev}"><span class="sev s-${x.sev}"></span><div class="fb"><div class="f-m"><b>${esc(x.titulo)}</b></div><small class="mut">${x.grupo} · ${x.regla} · ${SEVT[x.sev]}</small><p>${esc(x.detalle)}</p><div class="f-a">${x.ini ? `<button class="btn sm" data-act="sel" data-t="ini" data-id="${x.ini}">Ver ficha</button>` : ''}${x.fx.map((a, k) => `<button class="btn sm pri edit-ok" data-act="fx" data-u="${x.uid}" data-k="${k}">${a.t}</button>`).join('')}</div></div></article>`).join('') || empty('Sin hallazgos: no se detectan desviaciones con las reglas actuales.', 'check')}</div></section>
      <section class="card c5"><header><h2>Resumen ejecutivo del portafolio</h2><small>Vista actual</small></header>
      <div class="toolbar flat"><div class="seg"><button class="${ex.tone === 'con' ? 'on' : ''}" data-act="anatone" data-t="con">Conciso</button><button class="${ex.tone === 'det' ? 'on' : ''}" data-act="anatone" data-t="det">Detallado</button></div><span style="margin-left:auto" class="chips">${btn('Copiar', 'execcopy', { ic: 'copy', cls: 'sm' })}${btn('A presentación', 'execpres', { ic: 'slides', cls: 'sm pri' })}</span></div>
      <div class="exec">${ex.S.map(s => `<h4>${s.h}</h4><ul>${s.p.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div></section></div>`;
  }
};

/* ==========================================================================
   APIH V6 · Filtros globales (Área · Responsable · «Solo lo mío»), directorio de
   Personas y control de acceso a Administración (solo el administrador).
   ========================================================================== */
/* ---------- barra de filtros (se dibuja en TODAS las pantallas salvo Administración) ---------- */
const sinFiltros = v => v === 'admin' || v === 'miconfig' || v === 'ficha';
function filtrosHTML() {
  if (sinFiltros(UI.view)) return '';
  const A = St.cfg.areaGlobal, R = FL.resp, me = miUsuario(), on = A !== 'Todas' || respSel();
  personProjects('');   // asegura el índice
  const resps = uniq([...St.usuarios.map(u => u.n), ...Object.keys(_PP)]).sort();
  return `<div class="flt-bar" role="group" aria-label="Filtros globales">
    <span class="tb-l">${icon('filter', 14)} Filtros</span>
    <label class="flt"><small>Área</small><select data-chg="areaG" aria-label="Área">${selOpts(['Todas', ...areasPermitidas()], A)}</select></label>
    <label class="flt"><small>Responsable</small><select data-chg="respG" aria-label="Responsable" ${FL.mine ? 'disabled' : ''}>${FL.mine ? `<option>${esc(me)} (yo)</option>` : selOpts(resps, R, 'Todos')}</select></label>
    <button class="btn mine ${FL.mine ? 'on' : ''}" data-act="mine" aria-pressed="${FL.mine}" title="Mostrar solo lo que depende de ${esc(me)}">${icon('check', 14)}<span>Solo lo mío</span></button>
    ${on ? btn('Limpiar', 'flclear', { ic: 'x', cls: 'sm' }) : ''}
    ${FL.verComo ? `<span class="flt-note">Viendo como <b>${esc(FL.verComo)}</b> · <button class="lnk" data-act="vercomo" data-n="">Volver a mi usuario</button></span>` : ''}
</div>`;
}
Chg.respG = el => { FL.resp = el.value; ppInval(); refresh(); };
Acts.mine = () => { FL.mine = !FL.mine; ppInval(); refresh(); };
Acts.flclear = () => { FL.resp = ''; FL.mine = false; St.cfg.areaGlobal = 'Todas'; ppInval(); refresh(); };
Acts.vercomo = async d => {   // «Ver como» lo resuelve el servidor: se pide la simulación y se relee todo bajo ese perfil
  const n = d.n || '', u = n && St.usuarios.find(x => _nrm(x.n) === _nrm(n));
  if (n && !u) return toast('Esa persona no tiene perfil en APIH', 'err');
  try { await DataService.flush(); await DataService.svc.verComo(u ? u.correo : null); }
  catch (e) { return toast(e.detalle || e.message, 'err'); }
  FL.mine = false; FL.resp = ''; ppInval(); await DataService.refresh(true, true);
  if (UI.view === 'admin' && !esAdmin()) UI.view = 'dashboard'; refresh();
};

/* ---------- acceso a Administración ---------- */
const _go0 = go;
ENLACES.go = function (v) {
  if (v === 'admin' && !esAdmin()) { toast('Administración es de acceso exclusivo del administrador', 'err'); return; }
  if (v === 'personas' && !esAdministra()) { toast('Personas es exclusivo del rol Administra', 'err'); return; }
  return _go0(v);
};
function guardAdmin() { if (UI.view === 'personas' && !esAdministra()) UI.view = 'dashboard'; if (UI.view === 'admin' && !esAdmin()) { UI.view = 'dashboard'; if (location.hash === '#/admin') { try { history.replaceState(null, '', '#/dashboard'); } catch (e) { } } } }

/* ---------- «Ver como» (solo el administrador; sirve para probar «Solo lo mío» de otro usuario) ---------- */
function verComoHTML() {
  if (!(esAdminReal() || FL.verComo)) return '';
  return `<select class="vercomo" data-chg="vercomo" aria-label="Ver como" title="Ver el sistema como otro usuario (solo administrador)"><option value="">Ver como…</option>${verComoLista().map(n => `<option value="${esc(n)}" ${FL.verComo === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
}
Chg.vercomo = el => Acts.vercomo({ n: el.value });

/* ---------- directorio de PERSONAS y roles ---------- */
/* El directorio (roles, conteos de hitos/riesgos/decisiones/acciones, áreas y acceso) lo calcula el servidor (apih_calculos.personas); aquí solo se filtra y se muestra. */
function personasData() { return (CALC.personas || []).map(p => Object.assign({}, p, { areas: new Set(p.areas || []) })); }
/* ============================================================
   V22.49 · Capacidad de equipos
   Carga mensual por líder = proyectos vivos que lidera y cuyo plan (inicio → el mayor entre fin plan y fin proyectado) toca ese mes.
   Capacidad = St.cfg.capPers[persona] o, si no hay, el valor general St.cfg.capacidadMax.
   ============================================================ */
/* La carga mensual, la capacidad, la holgura y el color de cada celda los calcula el servidor (apih_calculos.capacidad); aquí solo se filtra por persona/área y se suma. */
export function capData(h) {
  const C = CALC.capacidad || { meses: [], gente: [] }, R = respSel();
  const meses = C.meses.slice(0, h).map(m => { const d = pD(m.s); return { s: m.s, e: m.e, l: MESES[d.getMonth()].slice(0, 3), y: d.getFullYear() }; });
  const gente = C.gente.filter(p => (!R || p.n === R) && p.ps.some(q => { const i = byId(q.id); return !!i && inArea(i); }))
    .map(p => ({ n: p.n, cap: p.cap, ps: p.ps.map(q => ({ i: byId(q.id), s: q.s, e: q.e })).filter(q => q.i), ns: p.ns.slice(0, h), cls: p.cls.slice(0, h), over: !!p.over[h], hold: p.hold, prom3: p.prom3 }))
    .sort((a, b) => (b.over - a.over) || (b.ns.reduce((x, y) => x + y, 0) / b.cap - a.ns.reduce((x, y) => x + y, 0) / a.cap) || a.n.localeCompare(b.n));
  const tot = meses.map((_, k) => gente.reduce((a, p) => a + p.ns[k], 0)), capT = gente.reduce((a, p) => a + p.cap, 0);
  const pk = tot.reduce((b, v, k) => v > tot[b] ? k : b, 0);
  return { meses, gente, tot, capT, pk, holgura: gente.reduce((a, p) => a + p.hold, 0) };
}
Views.capacidad = {
  render() {
    const f = F('cap', { h: 6, alerta: false, open: '' }), D = capData(f.h), g = esAdministra(), fmt1 = x => (Math.round(x * 10) / 10).toLocaleString('es-CL');
    const rows = D.gente.filter(p => !f.alerta || p.over);
    const sobre = D.gente.filter(p => p.over);
    const cand = scopeP().filter(i => isLive(i) && i.estado === 'Vigente' && (i.fase === 'Aprobación' || (i.fase === 'Evaluación' && priorScore(i) >= 70))).sort(by(i => -priorScore(i))).slice(0, 4);
    const libres = D.gente.filter(p => p.hold >= .5).sort(by(p => -p.hold));
    const th = D.meses.map(m => `<th>${m.l} ${String(m.y).slice(2)}</th>`).join('');
    const bar = (p, r) => { const M = D.meses, a = Math.max(0, M.findIndex(m => p.e == null || p.e >= m.s)), zi = M.map((m, k) => p.s <= m.e ? k : -1).filter(k => k >= 0).pop(); if (zi == null || zi < a || p.s > M[M.length - 1].e) return ''; const first = M.findIndex(m => p.s <= m.e); const c1 = Math.max(a, first < 0 ? 0 : first), c2 = zi; return `<button class="cp-b" style="grid-row:${r + 2};grid-column:${c1 + 2}/${c2 + 3};--c:${RAG_C[p.i.rag] || 'var(--pri)'}" data-act="sel" data-t="ini" data-id="${p.i.id}" title="${esc(p.i.titulo)} · ${fmtD(p.s)} → ${fmtD(p.e)}">${fmtD(p.s)} → ${p.e ? fmtD(p.e) : 'sin fecha'}</button>`; };
    const exp = p => { const M = D.meses; return `<tr class="cp-x"><td colspan="${M.length + 2}"><div class="cp-gt" style="grid-template-columns:210px repeat(${M.length},minmax(0,1fr))"><span></span>${M.map(m => `<span class="cp-mh">${m.l}</span>`).join('')}${p.ps.map((q, r) => `<span class="cp-pl" style="grid-row:${r + 2}"><b>${esc(q.i.titulo)}</b><small>${esc(q.i.fase)} · ${esc(q.i.rag)}</small></span>${bar(q, r)}`).join('')}</div></td></tr>`; };
    return pageHead('Capacidad de equipos', 'Carga de cada líder en los próximos meses según los proyectos que lidera, comparada con su capacidad.', btn('Exportar CSV', 'capcsv', { ic: 'download' })) + `
    <div class="toolbar"><label class="chk"><input type="checkbox" ${f.alerta ? 'checked' : ''} data-chg="capalerta"> <span>Solo con alerta</span></label><span class="cp-leg"><span><i class="g"></i>&lt; 80%</span><span><i class="y"></i>80–100%</span><span><i class="r"></i>&gt; 100%</span></span><div class="seg">${[3, 6, 12].map(h => `<button class="${f.h === h ? 'on' : ''}" data-act="caph" data-h="${h}">${h} meses</button>`).join('')}</div></div>
    <div class="cp-k"><div class="k"><small>Personas con proyectos</small><b>${D.gente.length}</b></div><div class="k"><small>Sobrecargadas (algún mes)</small><b style="color:${sobre.length ? 'var(--red)' : 'inherit'}">${sobre.length}</b><i>${esc(sobre.slice(0, 3).map(p => p.n.split(' ')[0]).join(', ') || '—')}</i></div><div class="k"><small>Mes de mayor carga</small><b>${D.gente.length ? D.meses[D.pk].l : '—'}</b><i>${D.gente.length ? D.tot[D.pk] + ' de ' + D.capT + ' cupos' : ''}</i></div><div class="k"><small>Holgura próx. 3 meses</small><b style="color:var(--green)">${fmt1(D.holgura)}</b><i>proyectos</i></div></div>
    ${rows.length ? `<div class="cp-wrap"><table class="cp-t"><thead><tr><th>Persona</th><th>Capacidad</th>${th}</tr></thead><tbody>${rows.map(p => `<tr><td><button class="cp-p" data-act="capopen" data-n="${esc(p.n)}" aria-expanded="${f.open === p.n}">${avatar(p.n, 30)}<span><b>${esc(p.n)}</b><small>${p.ps.length} proyecto${p.ps.length === 1 ? ' vivo' : 's vivos'}</small></span></button></td><td>${g && !FL.verComo ? `<input type="number" min="1" max="20" class="cp-in" value="${p.cap}" data-chg="capp" data-n="${esc(p.n)}" aria-label="Capacidad de ${esc(p.n)}">` : `<b>${p.cap}</b>`}<small class="mut"> proy.</small></td>${p.ns.map((n, k) => `<td><button class="cp-c ${p.cls[k]} ${f.open === p.n ? 'sel' : ''}" data-act="capopen" data-n="${esc(p.n)}" title="${n} de ${p.cap} · ${D.meses[k].l} ${D.meses[k].y}">${n ? n + ' / ' + p.cap : '—'}</button></td>`).join('')}</tr>${f.open === p.n ? exp(p) : ''}`).join('')}</tbody></table></div>` : `<div class="card">${empty(f.alerta ? 'Nadie supera su capacidad en este horizonte' : 'Sin proyectos vivos con líder asignado', 'users')}</div>`}
    <div class="cp-2"><div class="card"><header><h2>Quién puede tomar más</h2><small>holgura media próx. 3 meses</small></header>${libres.map(p => `<div class="cp-s">${avatar(p.n, 26)}<b>${esc(p.n)}</b><span class="g">+${fmt1(p.hold)} cupos</span></div>`).join('') || '<p class="mut">Nadie tiene holgura de al menos 0,5 cupos.</p>'}</div>
    <div class="card"><header><h2>Propuestas candidatas a iniciar</h2><small>por puntaje</small></header>${cand.map(i => `<div class="cp-s"><button class="lnk" data-act="sel" data-t="ini" data-id="${i.id}"><b>${esc(i.titulo)}</b></button><small class="mut">${esc(i.fase)} · puntaje ${priorScore(i)}</small>${libres[0] ? `<span class="g" title="Mayor holgura">Sugerido: ${esc(libres.find(p => _nrm(p.n) === _nrm(i.lider)) ? i.lider : libres[0].n)}</span>` : ''}</div>`).join('') || '<p class="mut">No hay propuestas candidatas por ahora.</p>'}</div></div>`;
  }
};
Acts.caph = d => { F('cap', {}).h = +d.h; render(); };
Acts.capopen = d => { const f = F('cap', {}); f.open = f.open === d.n ? '' : d.n; render(); };
Chg.capalerta = el => { F('cap', {}).alerta = el.checked; render(); };
Chg.capp = el => { if (!esAdministra() || FL.verComo) return; const v = Math.min(20, Math.max(1, +el.value || 0)), def = Math.max(1, +St.cfg.capacidadMax || 5), c = Object.assign({}, St.cfg.capPers || {}); if (v === def) delete c[_nrm(el.dataset.n)]; else c[_nrm(el.dataset.n)] = v; St.cfg.capPers = c; refresh(); };
Acts.capcsv = () => { const D = capData(F('cap', { h: 6 }).h); download('APIH_capacidad_' + hoy() + '.csv', toCSV(D.gente, [{ h: 'Persona', f: p => p.n }, { h: 'Capacidad', f: p => p.cap }, ...D.meses.map((m, k) => ({ h: m.l + ' ' + m.y, f: p => p.ns[k] }))])); };

Views.personas = {
  render() {
    const f = F('pers', { q: '', rol: '' }), A = St.cfg.areaGlobal, R = respSel();
    let all = personasData();
    const roles = uniq(all.flatMap(p => Object.keys(p.roles))).sort();
    let rows = all.filter(p => (A === 'Todas' || p.areas.has(A)) && (!R || p.n === R) && (!f.rol || p.roles[f.rol]) && (!f.q || p.n.toLowerCase().includes(f.q.toLowerCase()) || (p.cargo || '').toLowerCase().includes(f.q.toLowerCase())));
    rows.sort((a, b) => (b.lidera + b.hitos + b.riesgos) - (a.lidera + a.hitos + a.riesgos) || a.n.localeCompare(b.n));
    return pageHead('Personas y roles', 'Quién participa en el portafolio, con qué rol de acceso y qué tiene a su cargo. Haz clic en «Ver lo suyo» para filtrar todo el sistema por esa persona.', btn('Exportar CSV', 'perscsv', { ic: 'download' })) + `
    <div class="toolbar"><div class="search"><span>${icon('search', 14)}</span><input data-key="p-q" data-chg="flt" data-v="pers" data-f="q" type="search" placeholder="Buscar persona o cargo…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="pers" data-f="rol">${selOpts(roles, f.rol, 'Todos los roles')}</select>
      <small style="display:inline;margin-left:auto">${rows.length} de ${all.length} personas</small></div>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Persona</th><th>Cargo</th><th>Acceso</th><th>Roles</th><th>Áreas</th><th class="n" title="Proyectos activos">Proy.</th><th class="n" title="Hitos abiertos">Hitos</th><th class="n">Riesgos</th><th class="n" title="Decisiones">Decis.</th><th></th></tr></thead><tbody>
    ${rows.map(p => `<tr><td><span class="pp">${avatar(p.n, 26)}<b>${esc(p.n)}</b></span></td><td>${esc(p.cargo || '—')}</td><td>${p.acceso ? `<span class="pill ${p.acceso === 'Administra' ? '' : 'soft'}" title="${p.acceso === 'Administra' ? 'Titular del Panel de Administración' : ''}">${esc(p.acceso)}${p.acceso === 'Administra' ? ' · Panel Admin' : ''}</span>` : '<span class="mut">—</span>'}</td>
      <td><div class="chips">${Object.entries(p.roles).map(([r, n]) => `<span class="pill soft" title="${n} registro(s)">${esc(r)} · ${n}</span>`).join('') || '<span class="mut">—</span>'}</div></td><td>${[...p.areas].filter(Boolean).map(esc).join(', ') || '—'}</td>
      <td class="n">${p.lidera || '—'}</td><td class="n">${p.hitos ? p.hitos + (p.hitosAtr ? ` <span class="neg" title="vencidos">(${p.hitosAtr})</span>` : '') : '—'}</td><td class="n">${p.riesgos || '—'}</td><td class="n">${p.decis || '—'}</td>
      <td><button class="btn sm" data-act="verlosuyo" data-n="${esc(p.n)}">Ver lo suyo</button>${esAdminReal() && p.n !== St.cfg.usuario ? ` <button class="btn sm" data-act="vercomo" data-n="${esc(p.n)}" title="Ver el sistema como ${esc(p.n)}">Ver como</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="10">${empty('Sin personas con estos filtros', 'users')}</td></tr>`}
    </tbody></table></div>${matrizPermisosHTML()}`;
  }
};
Acts.verlosuyo = d => { FL.mine = false; FL.resp = d.n; ppInval(); go('proyectos'); };
Acts.perscsv = () => { const r = personasData(); download('APIH_personas_' + hoy() + '.csv', toCSV(r, [{ h: 'Persona', f: p => p.n }, { h: 'Cargo', f: p => p.cargo }, { h: 'Acceso', f: p => p.acceso }, { h: 'Roles', f: p => Object.entries(p.roles).map(([k, n]) => k + ' (' + n + ')').join(' | ') }, { h: 'Áreas', f: p => [...p.areas].join(',') }, { h: 'Proyectos activos', f: p => p.lidera }, { h: 'Hitos abiertos', f: p => p.hitos }, { h: 'Riesgos abiertos', f: p => p.riesgos }]), 'text/csv'); toast('Personas exportadas'); };

/* ==========================================================================
   APIH V6 · Esquema de autorizaciones (el mismo del sistema original «Gene»)
   --------------------------------------------------------------------------
   Rol           Ve                          Edita                 Análisis Panel Admin
   Administra         todas las áreas             todas las áreas       sí    sí (solo titular)
   Responsable todas las áreas             solo su(s) área(s)    no    no
   Colaborador   su área (todas si ve_todo)  solo su(s) área(s)    no    no
   Invitado      su área (todas si ve_todo)  nada (solo comenta)   no    no
   · El rol y el área salen de la hoja Usuarios. «Administra» es el único omnipotente.
   · El Panel de Administración es exclusivo del titular (lo decide el servidor).
   · Con «Ver como» el administrador simula el rol y el área de otra persona.
   ========================================================================== */
const PERM_ROLES = ['Administra', 'Responsable', 'Colaborador', 'Invitado'];
/* Todo lo que sigue SOLO LEE lo que entregó el servidor (PERM.ctx = apih_contexto; PERM.edit = puede_editar por fila). No decide nada. */
const ctx = () => PERM.ctx || {};
export function rolActual() { return ctx().appRol || 'Invitado'; }
export const areasDe = a => String(Array.isArray(a) ? a.join(',') : a || '').split(',').map(x => x.trim()).filter(Boolean);
export const areasPropias = () => ctx().areas || [];
const puedeVerTodo = () => !!ctx().veTodo;
export const areaVisible = a => puedeVerTodo() || !areasDe(a).length || areasDe(a).some(x => (ctx().areasVisibles || []).includes(x));   // solo afina listas ya filtradas por el servidor
function puedeEditarArea(a) { if (ctx().editaTodo) return true; const l = ctx().areasEditables || [], v = areasDe(a); return !v.length || v.some(x => l.includes(x)); }   // alta de algo que aún no existe en el servidor
export const puedeEditarIni = i => !!i && (PERM.edit.has(i.id) ? PERM.edit.get(i.id) : puedeEditarArea(i.area));
export const puedeVerAnalisis = () => APIH_CONFIG.analisis !== false && !!ctx().puedeVerAnalisis;
export const puedeGobernar = () => !!ctx().gobierna;   // comités: agenda, acuerdos
export const soloLectura = () => !PERM.ctx || !!ctx().soloLectura;
export const areasPermitidas = () => ctx().areasVisibles || [];
export const NO_PERM = (m) => toast(m || 'No tienes permiso para esta acción', 'err');

/* Compuertas de interfaz: solo evitan viajes inútiles; la decisión final siempre es del servidor (RLS y comandos). */
const ACT_ADMIN = ['catadd', 'catdel', 'expjson', 'impjson', 'reset', 'sptest', 'spconnect', 'spsync', 'splogout', 'spseed', 'spretry', 'xlsxall', 'atab', 'syncgo'];
const CHG_ADMIN = ['cfg', 'spc', 'impfile', 'impinifile'];
const ACT_EDIT = ['carmar', 'advance', 'etapa', 'etapago', 'applyrag', 'hitotoggle', 'resolvedec', 'aprobar', 'aprobargo', 'estado', 'reopen', 'reabrirPrj', 'edit', 'sfnew', 'sfedit', 'fnota', 'avauto', 'fasefix', 'fasefechas'];
const CHG_EDIT = ['advto', 'hitotoggle', 'acutoggle', 'bitpres'];
const ACT_COM = ['csug', 'cdel', 'cpart', 'ctema', 'cacc', 'cdec', 'cclose'];
const CHG_COM = ['catt', 'ctoggle'];
function guardar(tabla, nombres, fn) {
  nombres.forEach(n => { const o = tabla[n]; if (!o) return; tabla[n] = function (d, el, e) { const m = fn(n, d || {}, el); if (m) return NO_PERM(m); return o.apply(this, arguments); }; });
}
const RO_MSG = 'Solo lectura: no puedes editar aquí (puedes ver y comentar)';
const MSG_COM = 'No tienes permiso para gestionar comités';
const chequeo = (n, d, el, esCom) => {
  if (soloLectura()) return RO_MSG;   // un solo mensaje para Invitado, modo solo lectura y «Ver como»
  if (esCom || (n === 'edit' && d.t === 'com')) return puedeGobernar() ? '' : MSG_COM;
  const id = d.id || (el && el.dataset && el.dataset.id) || d.ini || d.c;
  if (id && PERM.edit.has(id) && !PERM.edit.get(id)) return 'Sin permiso: este elemento es de un área que tu perfil no edita (' + (areasPropias().join(', ') || 'ninguna') + ')';
  return '';
};
guardar(Acts, ACT_ADMIN, () => esAdmin() ? '' : 'Acción exclusiva del administrador');
guardar(Chg, CHG_ADMIN, () => esAdmin() ? '' : 'Acción exclusiva del administrador');
guardar(Acts, ACT_EDIT, (n, d, el) => chequeo(n, d, el));
guardar(Chg, CHG_EDIT, (n, d, el) => chequeo(n, d, el));
guardar(Acts, ACT_COM, (n, d, el) => chequeo(n, d, el, true));
guardar(Chg, CHG_COM, (n, d, el) => chequeo(n, d, el, true));
guardar(Acts, ['new'], (n, d) => d.t === 'com' ? chequeo(n, d, null, true) : (soloLectura() ? chequeo(n, d, null) : ''));
guardar(Acts, ['newevt', 'bitadd'], (n, d) => soloLectura() ? chequeo(n, d, null) : '');
guardar(Acts, ['go'], (n, d) => d.v === 'analisis' && !puedeVerAnalisis() ? 'La sección Análisis es exclusiva del rol Administra' : '');

/* formularios: la validación real ocurre en el servidor al guardar; aquí solo se corta el caso evidente */
const _openForm0 = openForm;
ENLACES.openForm = function (o) {
  const os = o && o.onSave, od = o && o.onDanger;
  if (od) o.onDanger = function () {
    if (soloLectura()) { NO_PERM(RO_MSG); return; }
    const ini = byId(o.iniId || (o.values || {}).ini);
    if (ini && !puedeEditarIni(ini)) { NO_PERM('Sin permiso para eliminar en el área ' + areasDe(ini.area).join(', ')); return; }
    return od.apply(this, arguments);
  };
  if (os) o.onSave = function (out) {
    if (soloLectura()) { NO_PERM(RO_MSG); return false; }
    const v = o.values || {}, ini = byId(out && out.ini || v.ini || o.iniId);
    const a = (out && out.areaArr && out.areaArr.length ? out.areaArr : out && out.area) || (ini && ini.area) || v.area;
    const ok = out && out.areaArr || !ini || ini.area !== a ? puedeEditarArea(a) : puedeEditarIni(ini);
    if (a && !ok) { NO_PERM('Sin permiso para guardar en el área ' + areasDe(a).join(', ') + ' (tu perfil edita ' + (areasPropias().join(', ') || 'ninguna área') + ')'); return false; }
    return os.apply(this, arguments);
  };
  return _openForm0(o);
};

/* ver: navegación y filtros respetan el alcance de visibilidad */
function guardAcceso() { if (UI.view === 'analisis' && !puedeVerAnalisis()) UI.view = 'dashboard'; if (UI.view === 'cielo' && St.cfg.cieloOn === false) UI.view = 'dashboard'; if (St.cfg.areaGlobal !== 'Todas' && !areasPermitidas().includes(St.cfg.areaGlobal)) St.cfg.areaGlobal = 'Todas'; }

/* matriz de permisos (se muestra en Personas) */
function matrizPermisosHTML() {
  const rows = [['Administra', 'Todas las áreas', 'Todas las áreas', 'Sí', 'Sí (solo el titular)'], ['Responsable', 'Todas las áreas', 'Solo su área', 'No', 'No'], ['Colaborador', 'Su área (todas con «ve_todo»)', 'Solo su área', 'No', 'No'], ['Invitado', 'Su área (todas con «ve_todo»)', 'Nada: solo comenta', 'No', 'No']];
  const me = rolActual();
  return `<section class="card" style="margin-top:14px"><header><h2>Esquema de autorizaciones</h2><small>Tu rol: <b>${esc(me)}</b>${areasPropias().length ? ' · área ' + esc(areasPropias().join(', ')) : ''}</small></header>
  <table class="tbl"><thead><tr><th>Rol</th><th>Ve</th><th>Edita</th><th>Análisis</th><th>Panel de Administración</th></tr></thead><tbody>${rows.map(r => `<tr class="${r[0] === me ? 'sel' : ''}"><td><b>${r[0]}</b></td>${r.slice(1).map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <p class="mut" style="margin:8px 0 0;font-size:12px">El rol y el área de cada persona vienen de la hoja <b>Usuarios</b>; «ve_todo» amplía lo que se ve, nunca lo que se edita. La gestión de comités es de Administra y Responsable. Para que el esquema sea vinculante, el servidor aplica estos mismos permisos (RLS y comandos), no solo la interfaz.</p></section>`;
}

/* ============================================================
   APIH V5 · GENE — motor de láminas del sistema original (Codigo_Presentaciones.gs)
   El código de dibujo del generador original se incluye SIN cambios de diseño; aquí solo
   se simulan las APIs de Google (SlidesApp, Utilities, Session) para que, en lugar de crear
   una presentación de Google Slides, cada lámina quede como una lista de elementos
   (rectángulos, textos, círculos) en un lienzo de 720 x 405 pt. Esa lista se dibuja luego
   como HTML y como PowerPoint nativo con las mismas medidas.
   ============================================================ */

// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  COLS_SIMPLE: { get: () => COLS_SIMPLE, enumerable: true, configurable: true },
  NAV_GRP: { get: () => NAV_GRP, enumerable: true, configurable: true },
  NAV_SIMPLE: { get: () => NAV_SIMPLE, enumerable: true, configurable: true },
  NO_PERM: { get: () => NO_PERM, enumerable: true, configurable: true },
  PERM_ROLES: { get: () => PERM_ROLES, enumerable: true, configurable: true },
  PERS_KEYS: { get: () => PERS_KEYS, enumerable: true, configurable: true },
  PRES_MIO: { get: () => PRES_MIO, set: v => { PRES_MIO = v; }, enumerable: true, configurable: true },
  STAR_SVG: { get: () => STAR_SVG, enumerable: true, configurable: true },
  ampliable: { get: () => ampliable, enumerable: true, configurable: true },
  areaVisible: { get: () => areaVisible, enumerable: true, configurable: true },
  areasPermitidas: { get: () => areasPermitidas, enumerable: true, configurable: true },
  celebrar: { get: () => celebrar, set: v => { celebrar = v; }, enumerable: true, configurable: true },
  cfgI: { get: () => cfgI, enumerable: true, configurable: true },
  cfgMi: { get: () => cfgMi, enumerable: true, configurable: true },
  cfgSet: { get: () => cfgSet, enumerable: true, configurable: true },
  cfgUOf: { get: () => cfgUOf, enumerable: true, configurable: true },
  chkInsignias: { get: () => chkInsignias, enumerable: true, configurable: true },
  cieloOn: { get: () => cieloOn, enumerable: true, configurable: true },
  cocFit: { get: () => cocFit, set: v => { cocFit = v; }, enumerable: true, configurable: true },
  controlHTML: { get: () => controlHTML, enumerable: true, configurable: true },
  decMaxDias: { get: () => decMaxDias, enumerable: true, configurable: true },
  esAdministra: { get: () => esAdministra, enumerable: true, configurable: true },
  estrellasOn: { get: () => estrellasOn, enumerable: true, configurable: true },
  filtrosHTML: { get: () => filtrosHTML, enumerable: true, configurable: true },
  guardAcceso: { get: () => guardAcceso, enumerable: true, configurable: true },
  guardAdmin: { get: () => guardAdmin, enumerable: true, configurable: true },
  hoyW: { get: () => hoyW, enumerable: true, configurable: true },
  decEscalada: { get: () => decEscalada, enumerable: true, configurable: true },
  insightsFor: { get: () => insightsFor, enumerable: true, configurable: true },
  insignias: { get: () => insignias, set: v => { insignias = v; }, enumerable: true, configurable: true },
  menuRolCard: { get: () => menuRolCard, enumerable: true, configurable: true },
  mantenerSrv: { get: () => mantenerSrv, enumerable: true, configurable: true },
  modoUI: { get: () => modoUI, enumerable: true, configurable: true },
  motorAlertas: { get: () => motorAlertas, enumerable: true, configurable: true },
  msN: { get: () => msN, enumerable: true, configurable: true },
  proyActivos: { get: () => proyActivos, enumerable: true, configurable: true },
  puedeEditarIni: { get: () => puedeEditarIni, enumerable: true, configurable: true },
  puedeVerAnalisis: { get: () => puedeVerAnalisis, enumerable: true, configurable: true },
  rolActual: { get: () => rolActual, set: v => { rolActual = v; }, enumerable: true, configurable: true },
  simplify: { get: () => simplify, enumerable: true, configurable: true },
  soloLectura: { get: () => soloLectura, enumerable: true, configurable: true },
  starsMini: { get: () => starsMini, enumerable: true, configurable: true },
  starsOf: { get: () => starsOf, enumerable: true, configurable: true },
  verComoHTML: { get: () => verComoHTML, enumerable: true, configurable: true },
});
