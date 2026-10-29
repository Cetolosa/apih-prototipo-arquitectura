import { ENLACES } from './00-registro.js';
import { $, $$, DECS, HITOS, St, _nrm, by, byId, clone, esProp, esc, fmtD, hitosDe, hoy, icon, inArea, isLive, nameOf, nextId, riesgoAbierto, riesgosDe, save, scope, scopeP } from './01-nucleo.js';
import { Acts, Chg, F, Modal, UI, btn, go, openForm, panelDec, panelHito, panelIni, panelRisk, refresh, render, selOpts, toast } from './03-interfaz.js';
import { esAdministra, ptemaEf, ptemaSet, soloMio } from './07b-gobierno-analisis-capacidad.js';
import { GENE } from './08g-generador-ensamble.js';

/* ==========================================================================
   APIH V5 · TEMA de presentaciones
   Las láminas se generan con la paleta Alt4 original (hex "fuente"). El tema se aplica
   SOLO al renderizar (HTML y PPTX) mediante TEMA.el(e): remapea colores por ROL, fuente,
   escala de texto y radio. Cambiar de tema nunca altera contenido ni posiciones.
   ========================================================================== */
const TEMA_ROLES = {   // rol → { l: etiqueta, src: [hex originales que representa] }
  fondo:      { l: 'Fondo de lámina',      src: ['#F6F4EF'] },
  panel:      { l: 'Tarjetas / paneles',   src: ['#FFFFFF', '#FAF8F3', '#EDEAE2', '#E8E4DA'] },
  fondoOsc:   { l: 'Fondo oscuro (portada)', src: ['#1C1B19'] },
  texto:      { l: 'Texto principal',      src: ['#1C1B19'] },
  textoSec:   { l: 'Texto secundario',     src: ['#8A827A', '#8A8D94', '#666A72'] },
  textoTerc:  { l: 'Texto terciario',      src: ['#A39E97', '#9A958D', '#B8B2A6'] },
  borde:      { l: 'Bordes y líneas',      src: ['#D4CFC4', '#CBC6BB', '#E4E0D6', '#D7D3CC'] },
  acento:     { l: 'Acento',               src: ['#B5450D'] },
  acentoOsc:  { l: 'Acento profundo',      src: ['#8A4321'] },
  ok:         { l: 'Verde (en plazo)',     src: ['#2F7D4F', '#2E7D32'] },
  alerta:     { l: 'Ámbar (alerta)',       src: ['#B8860B', '#C08A1E'] },
  critico:    { l: 'Rojo (crítico)',       src: ['#C00000'] },
  textoMed:   { l: 'Texto intermedio',     src: ['#5A5652', '#4A4744', '#3A3733'] },
  acentoSuave:{ l: 'Acento suave (fondos)', src: ['#F0E3D8'] },
  info:       { l: 'Azul informativo',     src: ['#3D5A80'] },
  textoInv:   { l: 'Texto sobre oscuro',   src: [] },
  textoInvSec:{ l: 'Texto sec. sobre oscuro', src: [] }
};
const TEMA_BASE = { nombre: 'Alt4 crema (original)', fuente: 'Arial', escala: 1, radio: 1, colores: {} };
const TEMA_PRESETS = {
  alt4:   TEMA_BASE,
  oscuro: { nombre: 'Oscuro', fuente: 'Arial', escala: 1, radio: 1, colores: { fondo: '#16161A', panel: '#242429', fondoOsc: '#0B0B0D', texto: '#F2F0EA', textoSec: '#A8A49C', textoTerc: '#7C786F', borde: '#3A3A41', acento: '#FF7A3D', acentoOsc: '#FFB38A', textoMed: '#C9C5BC', acentoSuave: '#3A2417', info: '#8FB3D9', textoInvSec: '#A8A49C' } },
  azul:   { nombre: 'Corporativo azul', fuente: 'Arial', escala: 1, radio: 0.6, colores: { fondo: '#F4F7FB', panel: '#FFFFFF', fondoOsc: '#0B2A4A', texto: '#13273D', textoSec: '#5B6B7C', textoTerc: '#8C99A8', borde: '#CBD6E2', acento: '#0F6CBD', acentoOsc: '#0B4F8A', textoMed: '#3A4A5C', acentoSuave: '#DCEBF8', info: '#0F6CBD', textoInvSec: '#B9CFE6' } },
  aramark:{ nombre: 'Aramark corporativo', fuente: 'Arial', escala: 1, radio: 0.3, colores: { fondo: '#F4F4F4', panel: '#FFFFFF', fondoOsc: '#030303', texto: '#1A1A1A', textoSec: '#4D4F4E', textoTerc: '#7A7C7B', borde: '#CFCFCF', acento: '#0D446A', acentoOsc: '#08304D', textoMed: '#333333', acentoSuave: '#E6EEF4', info: '#007F8B', ok: '#1E8A3E', alerta: '#B97F00', critico: '#C8102E', textoInvSec: '#BCBCBC' } },
  blanco: { nombre: 'Minimal blanco', fuente: 'Arial', escala: 1, radio: 0, colores: { fondo: '#FFFFFF', panel: '#F5F5F5', fondoOsc: '#111111', texto: '#111111', textoSec: '#707070', textoTerc: '#A0A0A0', borde: '#DDDDDD', acento: '#D13438', acentoOsc: '#8E1F22', textoMed: '#444444', acentoSuave: '#FBE5E6', info: '#555555', textoInvSec: '#BBBBBB' } }
};
const TEMA_FUENTES = ['Arial', 'Calibri', 'Segoe UI', 'Georgia', 'Verdana', 'Trebuchet MS'];
export const TEMA = {
  cur: { ...TEMA_BASE, colores: {} },
  _map: {},
  set(t) {   // t: { preset?, fuente?, escala?, radio?, colores? } — tolera claves faltantes/ inválidas
    if (!t || (!t.preset && !Object.keys(t).length)) t = { preset: 'aramark' };   // V6: estilo por defecto = corporativo Aramark
    const b = TEMA_PRESETS[t.preset] || TEMA_BASE, o = t;
    const num = (v, d, lo, hi) => { v = parseFloat(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const col = Object.assign({}, b.colores, Object.fromEntries(Object.entries(o.colores || {}).filter(([k, v]) => TEMA_ROLES[k] && /^#[0-9a-f]{6}$/i.test(v))));
    this.cur = { preset: t.preset || '', nombre: b.nombre, fuente: TEMA_FUENTES.includes(o.fuente) ? o.fuente : b.fuente, escala: num(o.escala, b.escala, .8, 1.25), radio: num(o.radio, b.radio, 0, 2), colores: col };
    this._map = {};
    Object.entries(col).forEach(([rol, nuevo]) => TEMA_ROLES[rol].src.forEach(h => { this._map[h.toUpperCase()] = nuevo; }));
    // el texto principal y el fondo oscuro comparten hex original (#1C1B19): se resuelve por contexto en el.fn
    return this.cur;
  },
  c(hex, ctx) {   // ctx: 'texto' | 'fondo' | undefined
    if (!hex) return hex; const k = String(hex).toUpperCase(), cl = this.cur.colores;
    if (k === '#1C1B19') return (ctx === 'texto' ? cl.texto : cl.fondoOsc) || hex;
    return this._map[k] || hex;
  },
  esBase() { return !Object.keys(this.cur.colores).length && this.cur.fuente === 'Arial' && this.cur.escala === 1 && this.cur.radio === 1; },
  el(e) {   // elemento del colector → copia con estilo aplicado (no muta el original)
    if (this.esBase()) return e;
    const r = Object.assign({}, e);
    if (e.fill) r.fill = this.c(e.fill);
    if (e.line) r.line = { c: this.c(e.line.c), w: e.line.w };
    if (e.color) r.color = /^#(F6F4EF|FFFFFF)$/i.test(e.color) ? (this.cur.colores.textoInv || e.color) : (/^#CBC6BB$/i.test(e.color) && this.cur.colores.textoInvSec) ? this.cur.colores.textoInvSec : this.c(e.color, 'texto');
    if (e.size) r.size = +(e.size * this.cur.escala).toFixed(2);
    return r;
  },
  bg(hex) { return this.esBase() ? hex : this.c(hex); },
  radioPt(e) { return Math.min(e.w, e.h) / 6 * this.cur.radio; },
  font() { return this.cur.fuente; },
  css() { return `font-family:'${this.cur.fuente}',Arial,'Liberation Sans',Helvetica,sans-serif;`; },
  json() { return { preset: this.cur.preset, fuente: this.cur.fuente, escala: this.cur.escala, radio: this.cur.radio, colores: { ...this.cur.colores } }; }
};

/* ============================================================
   APIH V5 · Presentaciones (1/3): modelo, selección y generadores de diapositivas
   Una diapositiva es una lista de BLOQUES neutrales ({k:'table'|'kpis'|'ul'|'svg'|…});
   el mismo contenido se dibuja como HTML (pres UI) y como PPTX nativo (pres2.js).
   Marca de inclusión: registro.inPres === false  → fuera (por defecto TODO entra).
   ============================================================ */
export const inc = o => !!o && o.inPres !== false;
export const incT = (i, f) => !(i.incTxt && i.incTxt[f] === false);
const CAT = {   // catálogo = las láminas del sistema original, en su orden original
  portafolio: [['portada', 'Portada'], ['ejecutivo', 'Resumen ejecutivo'], ['bitacora', 'Bitácora · decisiones y compromisos'], ['logros', 'Movimientos del ciclo'], ['flujo_prj', 'Flujo de proyectos'], ['status_prj', 'Status proyectos'], ['flujo_prop', 'Flujo de propuestas'], ['status_prop', 'Status propuestas'], ['hitos', 'Próximos hitos'], ['alertas', 'Alertas de estancamiento'], ['fichas_prj', 'Fichas de proyecto'], ['fichas_prop', 'Fichas de propuesta'], ['estructura', 'Estructura del portafolio'], ['plan', 'Plan de acción'], ['anexo', 'Anexo']],
  proyecto: [['portada', 'Portada'], ['ficha', 'Ficha de proyecto'], ['hitos', 'Próximos hitos'], ['bitacora', 'Bitácora · decisiones y compromisos'], ['alertas', 'Alertas de estancamiento']],
  propuesta: [['portada', 'Portada'], ['ficha', 'Ficha de propuesta'], ['bitacora', 'Bitácora · decisiones y compromisos']]
};
const DEF_OFF = { proyecto: ['portada', 'hitos', 'bitacora', 'alertas'], propuesta: ['portada', 'bitacora'] };   // por defecto el individual = la Ficha
export const offKey = (ck, k) => ck === 'portafolio' || k.startsWith('free:') ? k : ck + ':' + k;   // proyecto y propuesta tienen su propio estado
const isOff = (c, ck, k) => { const v = c.off[offKey(ck, k)]; return v === undefined ? (DEF_OFF[ck] || []).includes(k) : !!v; };
const OPTS = {};   // las láminas del original no tienen opciones: qué entra se decide con las casillas "Incluir en presentación"
const OPT_DEF = {};
const REGLAS_DEF = () => ({});   // solo lo que la persona cambia; el servidor completa los valores por defecto y evalúa
export const PRES_DEF = () => ({ alcance: 'portafolio', proys: [], multi: 'bloques', cur: '', titulo: 'Portafolio TI Operaciones · Comité Ejecutivo', comite: '', area: '', nivel: 'ej', order: {}, off: {}, so: {}, free: [], exec: {}, idx: 0, tpl: '', frozen: '', optk: '', tab: 'slides', reglas: REGLAS_DEF() });
export const pcfg = () => { const c = F('pres', PRES_DEF()); if (!c.reglas || !c.order || Array.isArray(c.order)) { c.reglas = c.reglas || REGLAS_DEF(); if (!c.order || Array.isArray(c.order)) c.order = {}; } return c; };
export const catKey = (c, id) => c.alcance === 'proyecto' ? (byId(id || c.cur || (c.proys || [])[0]) && esProp(byId(id || c.cur || c.proys[0])) ? 'propuesta' : 'proyecto') : 'portafolio';
const ordOf = (c, ck) => { const base = CAT[ck].map(x => x[0]), cur = (c.order[ck] || []).filter(k => base.includes(k) || c.free.some(f => f.id === k)); base.forEach(k => { if (!cur.includes(k)) cur.push(k); }); c.free.filter(f => f.ck === ck && !cur.includes(f.id)).forEach(f => cur.push(f.id)); return cur; };
const slideName = (c, ck, k) => { const f = c.free.find(x => x.id === k); return f ? f.t || 'Diapositiva libre' : (CAT[ck].find(x => x[0] === k) || [k, k])[1]; };
const optOf = (c, k) => Object.assign({}, OPT_DEF[k] || {}, (c.so || {})[k] || {});
export function withArea(c, fn) { const sv = St.cfg.areaGlobal; if (c.area) St.cfg.areaGlobal = c.area; try { return fn(); } finally { St.cfg.areaGlobal = sv; } }
const areaTxt = c => { const a = c.area || St.cfg.areaGlobal; return a === 'Todas' ? 'Todas las áreas' : a; };

/* ---------- reglas "Aplicar reglas" ---------- */
/* El servidor evalúa las reglas (apih_pres_evaluar). Aquí solo se guarda el último resultado y se repinta cuando llega. */
const EV = { clave: '', items: {}, reglas: {}, esperando: '' };
const evalRegla = (kind, o) => EV.items[kind + ':' + o.id] || { ok: true, why: '…' };
const reglasEf = c => Object.assign({}, EV.reglas, c.reglas || {});
const itemsDe = K => [['prj', 'prj'], ['prop', 'prop'], ['hito', 'hito'], ['rsk', 'rsk'], ['dec', 'dec']].flatMap(([g, k]) => (K[g] || []).map(o => ({ k, id: o.id })));
function pedirEval(c, K) {
  const items = itemsDe(K), clave = JSON.stringify([items, c.reglas || {}]);
  if (clave === EV.clave || clave === EV.esperando) return;
  EV.esperando = clave;
  ENLACES.DataService.svc.rpc('apih_pres_evaluar', { p_reglas: c.reglas || {}, p_items: items }).then(r => { EV.clave = clave; EV.items = (r && r.items) || {}; EV.reglas = (r && r.reglas) || {}; EV.esperando = ''; if (document.querySelector('.qe-rules')) render(); }).catch(() => { EV.esperando = ''; });
}
export function candidatos(c) { return soloMio(() => _cand(c)); }
function _cand(c) {   // universo del alcance (para el panel "Qué entra" y "Aplicar reglas")
  return withArea(c, () => {
    if (c.alcance === 'proyecto') {
      const ids = c.proys, out = { prj: [], prop: [], hito: [], rsk: [], dec: [], bit: [] };
      ids.map(byId).filter(Boolean).forEach(i => { out[esProp(i) ? 'prop' : 'prj'].push(i); out.hito.push(...hitosDe(i.id)); out.rsk.push(...riesgosDe(i.id)); out.dec.push(...DECS().filter(d => d.ini === i.id)); out.bit.push(...St.bitacora.filter(b => b.tipo === 'Comentario' && b.ini === i.id)); });
      return out;
    }
    const P = scope(), Q = scopeP(), inA = id => { const i = byId(id); return !i || inArea(i); };
    return { prj: P.filter(isLive), prop: Q.filter(isLive), hito: HITOS().filter(h => inA(h.ini) && !h.completado), rsk: St.riesgos.filter(r => riesgoAbierto(r) && inA(r.ini)), dec: DECS().filter(d => d.estado === 'Pendiente' && inA(d.ini)), bit: St.bitacora.filter(b => b.tipo === 'Comentario' && b.ini && inA(b.ini)) };
  });
}
async function aplicarReglas(c) {
  const r = await (0, ENLACES.cmdServidor)('apih_pres_aplicar_reglas', { p_reglas: c.reglas || {}, p_items: itemsDe(candidatos(c)) }, null);
  return r ? r.fuera : 0;
}
async function marcarTodo(c, val) { const K = candidatos(c); await (0, ENLACES.cmdServidor)('apih_pres_marcar', { p_items: [...itemsDe(K), ...K.bit.map(o => ({ k: 'bit', id: o.id }))].map(x => ({ ...x, incluir: !!val })) }, null); }


export const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ---------- generadores: cada clave del catálogo ejecuta las funciones ORIGINALES (src/gene.js) ---------- */
const itemOf = (c, id) => byId(id || c.cur || (c.proys || [])[0]);
const NOTAS = {
  portada: 'Apertura. Portafolio de iniciativas TI de Operaciones.',
  ejecutivo: 'Mensaje principal del ciclo (editable) y lectura de proyectos y propuestas.', bitacora: 'Decisiones sin resolver y compromisos abiertos / cumplidos.',
  logros: 'Qué entró y qué salió del portafolio activo desde el corte anterior.', flujo_prj: 'Cantidad de proyectos por fase.', status_prj: 'Estado de cada proyecto por categoría: avance real vs. esperado.',
  flujo_prop: 'Cantidad de propuestas por fase.', status_prop: 'Estado de cada propuesta por categoría.', hitos: 'Calendario de próximos hitos.', alertas: 'Proyectos sin avance en 2 o más ciclos.',
  fichas_prj: 'Ficha individual: avance, hitos, esta semana / lo que viene / notas de atención.', fichas_prop: 'Ficha de propuesta: problema, impacto y siguiente paso.', ficha: 'Ficha individual.', estructura: 'Distribución del portafolio.', plan: 'Prioridades y decisiones del próximo ciclo.', anexo: 'Separador del anexo.'
};
function genKey(c, ck, k, id) {
  const f = c.free.find(x => x.id === k);
  const x = c._ctx;
  if (f) return GENE.libre(f, x);
  let pages = GENE.hacer(k, x);
  const nm = slideName(c, ck, k);
  pages = pages.map((p, n) => Object.assign(p, { t: p.t || nm + (pages.length > 1 && !p.ref ? ' (' + (n + 1) + '/' + pages.length + ')' : ''), notes: p.notes || NOTAS[k] || '' }));
  const tot = { fichas_prj: [x.prj.length, x.prjAll.length, 'Proyectos'], fichas_prop: [x.prop.filter(p => ['Vigente', 'En espera'].includes(p.estado)).length, x.propAll.filter(p => ['Vigente', 'En espera'].includes(p.estado)).length, 'Propuestas'], status_prj: [x.prj.length, x.prjAll.length, 'Proyectos'], status_prop: [x.prop.filter(p => ['Vigente', 'En espera'].includes(p.estado)).length, x.propAll.filter(p => ['Vigente', 'En espera'].includes(p.estado)).length, 'Propuestas'], hitos: [x.hitosFlat.filter(h => !h.completado && h.mostrar_detalle).length, x.hitosFlat.filter(h => !h.completado).length, 'Hitos'], bitacora: [x.decArea.sinResolver.length + x.decArea.cerradas.length + x.seg.abiertas.length + x.seg.resueltas.length, null, 'Decisiones y compromisos'] }[k];
  if (tot && pages[0]) pages[0].cnt = { sel: tot[0], tot: tot[1] == null ? tot[0] : tot[1], label: tot[2] };
  if (k === 'ejecutivo' && pages[0]) { pages[0].exec = { gen: { lead: x.mensajeGen }, edited: !!(c.exec || {})._ }; pages[0].notes = GENE.notasEjecutivo(x) || pages[0].notes; }
  return pages;
}

/* ---------- ensamblado ---------- */
export function slidesOf(c, id) {   // → { ck, order, pages: {key: [slides]} } con todas las diapositivas (activas o no)
  const ck = catKey(c, id), order = ordOf(c, ck), pages = {};
  c._ctx = GENE.contexto(c, id);
  try { order.forEach(k => { try { pages[k] = genKey(c, ck, k, id); } catch (e) { console.error(e); pages[k] = []; pages[k].error = String(e && e.message || e); } }); } finally { delete c._ctx; }
  return { ck, order, pages };
}
export function buildDeck(c, id) {
  const M = slidesOf(c, id), ck = M.ck, out = [];
  M.order.forEach(k => { if (isOff(c, ck, k)) return; (M.pages[k] || []).forEach((p, n) => out.push(Object.assign({ key: k, n }, p))); });
  return out;
}
export const numberDeck = d => { GENE.numerar(d); d.forEach((s, k) => { s.num = k + 1; s.total = d.length; }); return d; };
export function decksSeparados(c) { return (c.proys || []).filter(byId).map(id => ({ id, name: byId(id).id, slides: numberDeck(buildDeck(c, id)) })); }

/* ============================================================
   APIH V5 · Presentaciones (2/3): dibujo HTML, constructor, "Qué entra", plantillas, historial
   ============================================================ */
/* ---------- bloques → HTML ---------- */
function cellHTML(x) {
  if (x == null) return '';
  if (typeof x !== 'object') return esc(x);
  const t = esc(x.t ?? ''); return `${x.dot ? `<span class="rag" style="--c:${x.dot}"><i></i>${t}</span>` : x.b ? `<b>${t}</b>` : x.neg ? `<span class="neg">${t}</span>` : t}`;
}
function blockHTML(b) {
  switch (b.k) {
    case 'lead': return `<p class="lead">${esc(b.t)}</p>`;
    case 'h': return `<h4 class="sl-h4">${esc(b.t)}</h4>`;
    case 'note': return b.t ? `<small class="sl-note">${esc(b.t)}</small>` : '';
    case 'ul': return `<ul class="sl-ul">${b.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    case 'kpis': return `<div class="sl-k" style="grid-template-columns:repeat(${b.cols || 2},1fr)">${b.items.map(([l, v, k]) => `<div class="${k}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
    case 'legend': return `<div class="sl-leg">${b.items.map(([l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
    case 'svg': return `<div class="sl-svg${b.thin ? ' thin' : ''}">${b.svg}</div>${b.cap ? `<small class="sl-note">${esc(b.cap)}</small>` : ''}`;
    case 'row': return `<div class="sl-row">${b.items.map(blockHTML).join('')}</div>`;
    case 'cols': { const r = b.ratio || [1.2, 1]; return `<div class="sl-2" style="grid-template-columns:${r[0]}fr ${r[1]}fr"><div>${b.l.map(blockHTML).join('')}</div><div>${b.r.map(blockHTML).join('')}</div></div>`; }
    case 'cards': return `<div class="sl-q">${b.items.map(q => `<div class="${q.cur ? 'cur' : ''}"><h4>${esc(q.t)}<small>${esc(q.sub)}</small></h4>${q.lines.map(l => `<p><i style="background:${l.c}"></i>${esc(l.t)}<small>${esc(l.s)}</small></p>`).join('')}${q.more ? `<small class="mut">+${q.more} más</small>` : ''}</div>`).join('')}</div>`;
    case 'table': { const n = b.head.length; return `<table class="sl-t"><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => r.grp != null && !Array.isArray(r) ? `<tr class="grp"><td colspan="${n}">${esc(r.grp)}</td></tr>` : `<tr>${r.map(x => `<td${x && x.span ? ` colspan="${x.span}"` : ''}>${cellHTML(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
  }
  return '';
}
const Q = v => (v * 100 / 720).toFixed(3) + 'cqw';
function geneHTML(g) {   // lámina del sistema original: elementos absolutos en un lienzo de 720 x 405 pt
  const AL = { l: 'left', ctr: 'center', r: 'right', just: 'justify' };
  return `<div class="slide gs" style="background:${TEMA.bg(g.bg)};${TEMA.css()}">${g.els.map(e0 => {
    const e = TEMA.el(e0);
    let st = `left:${Q(e.x)};top:${Q(e.y)};width:${Q(e.w)};height:${Q(e.h)};`;
    if (e.fill) st += `background:${e.fill};`;
    if (e.line) st += `border:${Q(e.line.w)} solid ${e.line.c};`;
    if (e.shape === 'ROUND') st += `border-radius:${Q(TEMA.radioPt(e))};`; else if (e.shape === 'ELLIPSE') st += 'border-radius:50%;'; else if (e.shape === 'RIGHT_ARROW') st += 'clip-path:polygon(0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%);';
    if (e.rot) st += `transform:rotate(${e.rot}deg);`;
    if (e.text !== '') st += `font-size:${Q(e.size)};color:${e.color};text-align:${AL[e.align] || 'left'};padding:${Q(3.6)} ${Q(7.2)};${e.bold ? 'font-weight:700;' : ''}${e.italic ? 'font-style:italic;' : ''}${e.anchor === 'ctr' ? 'display:flex;flex-direction:column;justify-content:center;' : ''}`;
    return `<div class="g" style="${st}">${esc(e.text)}</div>`;
  }).join('')}</div>`;
}
export function slideHTML(s) {
  if (s.g) return geneHTML(s.g);
  if (s.cover || s.section) return `<div class="slide cover"><div class="sl"><div class="cv-b"><span class="logo big">A</span><small>Aramark Chile · Tecnología de la Información</small><h1>${esc(s.t)}</h1><p>${esc(s.sub || '')}</p>${s.who ? `<p class="cv-s">${esc(s.who)}</p>` : ''}</div></div></div>`;
  return `<div class="slide"><div class="sl"><div class="sl-h"><h2>${esc(s.t)}</h2>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</div><div class="sl-b">${(s.blocks || []).map(blockHTML).join('')}</div><div class="sl-f"><span>APIH · Aramark Portfolio Intelligence Hub</span><span>${s.num || ''} / ${s.total || ''}</span></div></div></div>`;
}

/* ---------- casillas "Incluir en presentación" (fichas) ---------- */
export function incChk(k, id) { const o = (INC_E[k]() || []).find(x => x.id === id); if (!o) return ''; return `<label class="chk inc-l" data-act="noop" title="Incluir en presentación"><input type="checkbox" data-chg="incl" data-e="${k}" data-id="${esc(id)}" ${inc(o) ? 'checked' : ''}> <span>En presentación</span></label>`; }
const INC_E = { prj: () => St.ini, prop: () => St.ini, hito: () => St.hitos, rsk: () => St.riesgos, dec: () => St.decisiones, bit: () => St.bitacora };
function incBox(e, o) {
  const txt = (e === 'prj' || e === 'prop') ? [['resumen', 'Resumen'], ['logros', 'Logros'], ['proximos', 'Próximos pasos'], ['issue', 'Tema a resolver']].filter(([f]) => o[f]) : [];
  return `<div class="pn-sec incbox"><label class="chk"><input type="checkbox" data-chg="incl" data-e="${e}" data-id="${esc(o.id)}" ${inc(o) ? 'checked' : ''}> <span><b>Incluir en presentación</b></span></label>${txt.length ? `<div class="inc-t">${txt.map(([f, l]) => `<label class="chk"><input type="checkbox" data-chg="incltxt" data-id="${esc(o.id)}" data-f="${f}" ${incT(o, f) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div>` : ''}</div>`;
}
const _injInc = (html, box) => html.replace(/<\/div>\s*$/, box + '</div>');
{ const pr = panelRisk, ph = panelHito, pd = panelDec, pi = panelIni;
  ENLACES.panelRisk = r => _injInc(pr(r), incBox('rsk', r)); ENLACES.panelHito = h => _injInc(ph(h), incBox('hito', h)); ENLACES.panelDec = d => _injInc(pd(d), incBox('dec', d));
  ENLACES.panelIni = i => (!UI.tab || UI.tab === 'resumen') ? _injInc(pi(i), incBox(esProp(i) ? 'prop' : 'prj', i)) : pi(i); }


export function presLayout() {
  if (UI.view !== 'presentaciones') return;
  const m = $('#main'), w = m && m.querySelector('.pres-w'); if (!w || w.dataset.p2) return;
  const cfg = w.querySelector('.pres-c'), s = w.querySelector('.pres-s'); if (!cfg || !s) return; w.dataset.p2 = 1;
  const ph = m.querySelector('.ph > div > p'); if (ph) ph.style.display = 'none';
  const flds = [...cfg.querySelectorAll('.fgrid > .fld')];
  const keep = f => f.querySelector('[data-act=palc]') || f.querySelector('input[data-k=titulo]') || f.querySelector('[data-chg=padd]');
  const bar = document.createElement('div'); bar.className = 'p2-bar';
  flds.filter(keep).forEach(f => bar.appendChild(f));
  const pw = document.createElement('div'); pw.className = 'popw'; pw.innerHTML = `<button class="btn" data-act="pop" data-id="pop-p2" title="Comité, área y plantilla">${icon('settings', 15)}<span>Opciones</span></button><div class="pop p2-pop" id="pop-p2"></div>`;
  flds.filter(f => !keep(f)).forEach(f => pw.querySelector('.pop').appendChild(f)); bar.appendChild(pw);
  const b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'pdrawer'; b.title = 'Lista de diapositivas, qué entra, estilo e historial'; b.innerHTML = `${icon('list2', 15)}<span>Diapositivas y contenido</span>`; bar.appendChild(b);
  const phh = m.querySelector('.ph'), pha = phh && phh.querySelector('.ph-act');
  if (phh && pha && window.innerWidth >= 1100 && !bar.querySelector('[data-chg=padd]')) { bar.classList.add('in-ph'); phh.insertBefore(bar, pha); } else w.insertBefore(bar, cfg);
  cfg.remove();
  const dr = [...s.children].filter(e => e.matches('section.card')).pop();
  if (dr && !dr.classList.contains('notes')) { dr.classList.add('p2-dr'); if (UI.pdr) dr.classList.add('open'); dr.insertAdjacentHTML('afterbegin', `<button class="icon-btn sm p2-x" data-act="pdrawer" aria-label="Cerrar" title="Cerrar">${icon('x', 15)}</button>`); }
  const pre = s.querySelector('.card.notes .pre'); if (pre) { pre.dataset.act = 'xtext'; pre.title = 'Clic para ver la nota completa'; }
}
export const asignar_presLayout = v => (presLayout = v);
Acts.pdrawer = () => { UI.pdr = !UI.pdr; render(); };
export function incMarks() {
  const m = $('#main'); if (!m) return;
  const kindOf = (t, id) => t === 'ini' ? (esProp(St.ini.find(x => x.id === id) || {}) ? 'prop' : 'prj') : t === 'risk' ? 'rsk' : t;
  const objOf = (k, id) => (INC_E[k]() || []).find(x => x.id === id);
  const chk = (k, id) => { const o = objOf(k, id); if (!o) return ''; return `<label data-act="noop" title="Incluir en presentación"><input type="checkbox" data-chg="incl" data-e="${k}" data-id="${esc(id)}" ${inc(o) ? 'checked' : ''}> <span>En presentación</span></label>`; };
  m.querySelectorAll('table:not(.mini)').forEach(t => {
    const rows = [...t.querySelectorAll('tbody tr[data-t][data-id]')].filter(r => ['ini', 'hito', 'risk', 'dec'].includes(r.dataset.t)); if (!rows.length) return;
    t.querySelectorAll('thead tr').forEach((tr, i) => { const th = document.createElement('th'); th.className = 'inc-c'; if (i === 0) th.textContent = 'En presentación'; tr.appendChild(th); });
    t.querySelectorAll('tbody tr').forEach(tr => { if (rows.includes(tr)) { const td = document.createElement('td'); td.className = 'inc-c'; td.innerHTML = chk(kindOf(tr.dataset.t, tr.dataset.id), tr.dataset.id); tr.appendChild(td); } else { const c = tr.cells[0]; if (c && c.colSpan > 1) c.colSpan += 1; else tr.appendChild(document.createElement('td')); } });
    t.querySelectorAll('tfoot tr').forEach(tr => { const c = document.createElement('td'); tr.appendChild(c); });
  });
  m.querySelectorAll('article.icard[data-t="ini"][data-id]').forEach(a => { const k = kindOf('ini', a.dataset.id), h = chk(k, a.dataset.id); if (h) a.insertAdjacentHTML('beforeend', `<div class="inc-mini">${h}</div>`); });
  m.querySelectorAll('.dcard').forEach(a => { const e = a.querySelector('[data-t="dec"][data-id]'); if (!e) return; const h = chk('dec', e.dataset.id); if (h) a.insertAdjacentHTML('beforeend', `<div class="inc-mini">${h}</div>`); });
}
Chg.incl = el => { (0, ENLACES.cmdServidor)('apih_pres_marcar', { p_items: [{ k: el.dataset.e, id: el.dataset.id, incluir: el.checked }] }, null).then(() => refresh()); };
Chg.incltxt = el => { const o = byId(el.dataset.id); if (!o) return; (0, ENLACES.cmdServidor)('apih_pres_marcar', { p_items: [{ k: esProp(o) ? 'prop' : 'prj', id: o.id, campo: el.dataset.f, incluir: el.checked }] }, null).then(() => refresh()); };

/* ---------- vista Presentaciones ---------- */
export const activeId = c => c.alcance === 'proyecto' ? (c.proys.includes(c.cur) ? c.cur : c.proys[0]) : undefined;
export function tplsFor(c) {
  const ck = catKey(c, activeId(c)), a = c.alcance === 'proyecto' ? (byId(activeId(c)) || {}).area || '' : (c.area || St.cfg.areaGlobal);
  return (St.ptpl || []).filter(t => (!t.priv || _nrm(t.autor) === _nrm(St.cfg.usuario)) && t.ck === ck && (t.area === 'Todas' || a === 'Todas' || (a || '').split(',').map(x => x.trim()).includes(t.area)));
}
export function itemOpts() { return [...St.ini.filter(i => !esProp(i)).sort(by('id')), ...St.ini.filter(esProp).sort(by('id'))].map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo })); }
function optEditor(c, ck, k) {
  const sch = OPTS[k]; if (!sch) return '<p class="mut">Esta diapositiva no tiene opciones.</p>'; const o = optOf(c, k);
  return `<div class="pb-opt">${sch.cols ? `<div class="fld"><label>Columnas</label><div class="chips">${Object.entries(sch.cols).map(([ck2, l]) => `<label class="chk"><input type="checkbox" data-chg="psocol" data-s="${k}" data-c="${ck2}" ${(o.cols || []).includes(ck2) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div></div>` : ''}
    <div class="pb-og">${sch.limit ? `<div class="fld"><label>Filas por diapositiva</label><input type="number" min="3" max="20" value="${o.limit}" data-chg="pso" data-s="${k}" data-o="limit" data-num="1"></div>` : ''}
    ${sch.sort ? `<div class="fld"><label>Ordenar por</label><select data-chg="pso" data-s="${k}" data-o="sort">${selOpts(sch.sort.map(x => ({ v: x[0], t: x[1] })), o.sort)}</select></div>` : ''}
    ${sch.group ? `<label class="chk"><input type="checkbox" data-chg="pso" data-s="${k}" data-o="group" data-bool="1" ${o.group ? 'checked' : ''}> <span>Agrupar por área</span></label>` : ''}
    ${sch.budget ? `<label class="chk"><input type="checkbox" data-chg="pso" data-s="${k}" data-o="budget" data-bool="1" ${o.budget ? 'checked' : ''}> <span>Mostrar montos / presupuesto</span></label>` : ''}</div></div>`;
}
export function slideList(c, M) {
  const edKey = c.optk;
  return `<div class="pb-list" id="pblist">${M.order.map(k => {
    const pgs = M.pages[k] || [], p0 = pgs[0] || {}, on = !isOff(c, M.ck, k), free = c.free.find(f => f.id === k), isEx = p0.exec;
    return `<div class="pb-i ${on ? '' : 'off'}" draggable="true" data-dnd="${k}"><span class="grip" title="Arrastra para reordenar">⋮⋮</span>
      <input type="checkbox" data-chg="pson" data-k="${k}" ${on ? 'checked' : ''} aria-label="Incluir diapositiva">
      <button class="pb-n" data-act="pgokey" data-k="${k}">${esc(slideName(c, M.ck, k))}</button>
      ${p0.cnt ? `<small class="cnt">${p0.cnt.label}: <b>${p0.cnt.sel}</b> de ${p0.cnt.tot}</small>` : ''}${pgs.length > 1 && on && !/^fichas?/.test(k) ? `<small class="mut">${pgs.length} láminas</small>` : ''}${!pgs.length && on && !pgs.error ? '<small class="mut">sin contenido en este ciclo</small>' : ''}${pgs.error ? `<small class="warn" title="${esc(pgs.error)}">⚠ error al generar</small>` : ''}
      <span class="pb-b">${isEx ? `<button class="lnk" data-act="pexec" data-k="${k}">${p0.exec.edited ? 'Texto editado' : 'Editar texto'}</button>` : ''}${free ? `<button class="lnk" data-act="pfree" data-id="${k}">Editar</button><button class="lnk" data-act="pfreedel" data-id="${k}">Quitar</button>` : OPTS[k] ? `<button class="icon-btn sm ${edKey === k ? 'on' : ''}" data-act="popt" data-k="${k}" title="Opciones" aria-label="Opciones">${icon('settings', 14)}</button>` : ''}
      <button class="icon-btn sm" data-act="pmove" data-k="${k}" data-d="-1" aria-label="Subir">${icon('chevl', 13)}</button><button class="icon-btn sm" data-act="pmove" data-k="${k}" data-d="1" aria-label="Bajar">${icon('chev', 13)}</button></span></div>${edKey === k ? optEditor(c, M.ck, k) : ''}`;
  }).join('')}</div><div style="margin-top:10px">${btn('Diapositiva libre', 'pfree', { d: { id: '' }, ic: 'plus' })}</div>`;
}
export function queEntra(c) {
  const K = candidatos(c), R = reglasEf(c), single = c.alcance === 'proyecto'; pedirEval(c, K);
  const grp = (title, key, kind, lab) => { const A = K[key]; if (!A.length) return ''; const n = A.filter(inc).length;
    return `<details class="qe" ${single || A.length < 12 ? 'open' : ''}><summary><b>${title}</b> <span class="cnt">${n} de ${A.length} entran</span></summary><div class="qe-l">${A.map(o => { const e = evalRegla(kind, o), on = inc(o); return `<label class="qe-r ${on ? '' : 'off'}"><input type="checkbox" data-chg="incl" data-e="${kind}" data-id="${esc(o.id)}" ${on ? 'checked' : ''}><span class="r-m"><b>${esc(lab(o))}</b></span><span class="pill soft ${e.ok ? 'ok' : 'no'}" title="${e.ok ? 'Cumple las reglas' : 'No cumple las reglas'}">${e.ok ? '✔' : '✘'} ${esc(e.why)}</span></label>`; }).join('')}</div></details>`; };
  const txt = single ? c.proys.map(byId).filter(Boolean).map(i => `<details class="qe" open><summary><b>Textos · ${esc(i.id)}</b></summary><div class="qe-l">${[['resumen', 'Resumen'], ['logros', 'Logros'], ['proximos', 'Próximos pasos'], ['issue', 'Tema a resolver']].filter(([f]) => i[f]).map(([f, l]) => `<label class="qe-r"><input type="checkbox" data-chg="incltxt" data-id="${i.id}" data-f="${f}" ${incT(i, f) ? 'checked' : ''}><span class="r-m"><b>${l}</b><small>${esc(clip(i[f], 110))}</small></span></label>`).join('')}</div></details>`).join('') : '';
  return `<div class="qe-rules"><div class="fgrid"><div class="fld"><label>Hitos hasta (días)</label><input type="number" min="1" value="${R.hitosDias}" data-chg="preg" data-r="hitosDias" data-num="1"></div><div class="fld"><label>Riesgos con exposición ≥</label><input type="number" min="1" max="25" value="${R.riesgoMin}" data-chg="preg" data-r="riesgoMin" data-num="1"></div>
    <label class="chk"><input type="checkbox" data-chg="preg" data-r="soloEnCurso" data-bool="1" ${R.soloEnCurso ? 'checked' : ''}> <span>Proyectos solo En curso</span></label><label class="chk"><input type="checkbox" data-chg="preg" data-r="soloAtencion" data-bool="1" ${R.soloAtencion ? 'checked' : ''}> <span>Solo rojo / ámbar / atrasados</span></label>
    <label class="chk"><input type="checkbox" data-chg="preg" data-r="propAprob" data-bool="1" ${R.propAprob ? 'checked' : ''}> <span>Propuestas solo en Aprobación</span></label><label class="chk"><input type="checkbox" data-chg="preg" data-r="decPend" data-bool="1" ${R.decPend ? 'checked' : ''}> <span>Decisiones solo pendientes</span></label></div>
    <div class="chips" style="margin-top:8px">${btn('Aplicar reglas', 'paplicar', { ic: 'check', cls: 'pri' })}${btn('Marcar todo: Sí', 'pall', { d: { v: 1 } })}${btn('Marcar todo: No', 'pall', { d: { v: 0 } })}</div><p class="mut" style="font-size:12px;margin:6px 0 10px">Por defecto todo entra. “Aplicar reglas” desmarca lo que no cumple; luego puedes ajustar a mano. La marca queda guardada en cada registro.</p></div>
    ${grp('Proyectos', 'prj', 'prj', o => o.id + ' · ' + o.titulo)}${grp('Propuestas', 'prop', 'prop', o => o.id + ' · ' + o.titulo)}${grp('Hitos', 'hito', 'hito', o => nameOf(o.ini) + ' — ' + o.nombre + ' · ' + fmtD(o.fecha))}${grp('Riesgos', 'rsk', 'rsk', o => o.id + ' · ' + clip(o.desc, 70) + ' (' + nameOf(o.ini) + ')')}${grp('Decisiones', 'dec', 'dec', o => o.tipo + ': ' + o.titulo)}${grp('Notas de bitácora', 'bit', 'bit', o => nameOf(o.ini) + ' · ' + fmtD(o.ts.slice(0, 10)) + ' — ' + clip(o.texto, 80))}${txt}`;
}
export function estiloTab() {
  const T = TEMA.cur, pr = Object.entries(TEMA_PRESETS), cur = id => (T.preset || 'alt4') === id;  // alt4 = original crema
  const cc = rol => T.colores[rol] || TEMA_ROLES[rol].src[0] || '#FFFFFF';
  return `<p class="mut" style="margin:0 0 10px">El estilo se aplica al dibujar (pantalla, PDF, HTML y PowerPoint); no cambia el contenido. Las presentaciones guardadas toman el estilo vigente.</p>
  <div class="chips">${pr.map(([id, p]) => `<button class="chip ${cur(id) ? 'on' : ''}" data-act="ptema" data-p="${id}">${esc(p.nombre)}</button>`).join('')}</div>
  <div class="fgrid" style="margin-top:12px">
    <div class="fld"><label>Tipografía</label><select data-chg="ptemaf" data-k="fuente">${TEMA_FUENTES.map(f => `<option ${f === T.fuente ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
    <div class="fld"><label>Escala de texto (${Math.round(T.escala * 100)}%)</label><input type="range" min="0.8" max="1.25" step="0.05" value="${T.escala}" data-chg="ptemaf" data-k="escala"></div>
    <div class="fld"><label>Esquinas redondeadas (${Math.round(T.radio * 100)}%)</label><input type="range" min="0" max="2" step="0.2" value="${T.radio}" data-chg="ptemaf" data-k="radio"></div>
    ${Object.entries(TEMA_ROLES).map(([k, r]) => `<div class="fld"><label>${r.l}</label><input type="color" value="${cc(k)}" data-chg="ptemac" data-k="${k}"></div>`).join('')}
  </div><div class="chips" style="margin-top:10px">${btn('Restablecer a Aramark corporativo', 'ptema', { cls: 'sm', d: { p: 'aramark' } })}</div>`;
}
export function histTab() {
  const pres = St.pres.slice().sort(by(p => p.fecha || '', -1));
  return `<div class="tbl-w"><table class="tbl"><thead><tr><th>Fecha</th><th>Nombre</th><th>Alcance</th><th>Área</th><th>Autor</th><th>Origen</th><th></th></tr></thead><tbody>${pres.map(p => `<tr><td>${fmtD(p.fecha)}</td><td><b>${esc(p.nombre)}</b>${p.n ? `<small class="mut"> · ${p.n} diap.</small>` : ''}</td><td>${esc(p.alcance || '—')}</td><td>${esc(p.area)}</td><td>${esc(p.autor || '—')}</td><td><span class="pill soft">${esc(p.origen)}</span>${p.url ? ` <a class="lnk" href="${esc(p.url)}" target="_blank" rel="noopener">abrir original</a>` : ''}</td>
    <td class="nw">${St.psnap[p.id] ? `<button class="lnk" data-act="phver" data-id="${p.id}">Ver</button> <button class="lnk" data-act="phdup" data-id="${p.id}">Duplicar</button> <button class="lnk" data-act="phdl" data-id="${p.id}" data-f="html">HTML</button> <button class="lnk" data-act="phdl" data-id="${p.id}" data-f="pptx">PPTX</button> <button class="lnk edit-only" data-act="phdel" data-id="${p.id}">Eliminar</button>` : '<span class="mut">sin copia congelada</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- acciones de configuración ---------- */
export const prr = () => render();
Chg.pcfg = el => { const c = pcfg(); c[el.dataset.k] = el.dataset.bool ? el.checked : el.value; if (['comite', 'area'].includes(el.dataset.k)) c.idx = 0; prr(); };
const temaSave = o => { ptemaSet(Object.assign({}, ptemaEf(), { preset: TEMA.cur.preset }, o)); save(); prr(); };
Acts.ptema = d => { ptemaSet({ preset: d.p }); save(); prr(); };
Chg.ptemaf = el => temaSave({ [el.dataset.k]: el.value });
Chg.ptemac = el => temaSave({ preset: ptemaEf().preset || '', colores: Object.assign({}, TEMA.cur.colores, { [el.dataset.k]: el.value }) });
Acts.ptabp = d => { pcfg().tab = d.k; prr(); };
Acts.palc = d => { const c = pcfg(); c.alcance = d.a; c.idx = 0; c.frozen = ''; if (d.a === 'proyecto' && !c.proys.length && UI.sel && UI.sel.t === 'ini') { c.proys = [UI.sel.id]; c.cur = UI.sel.id; } prr(); };
Chg.padd = el => { const c = pcfg(); if (el.value && !c.proys.includes(el.value)) { c.proys.push(el.value); c.cur = c.cur || el.value; c.idx = 0; } prr(); };
Acts.prm = d => { const c = pcfg(); c.proys = c.proys.filter(x => x !== d.id); if (c.cur === d.id) c.cur = c.proys[0] || ''; prr(); };
Acts.pcur = d => { const c = pcfg(); c.cur = d.id; c.idx = 0; prr(); };
Acts.pmulti = d => { pcfg().multi = d.m; pcfg().idx = 0; prr(); };
Acts.presentar = d => { const c = pcfg(), id = (d && d.id) || (UI.sel && UI.sel.id); if (!id || !byId(id)) return; Object.assign(c, { alcance: 'proyecto', proys: [id], cur: id, frozen: '', idx: 0, tab: 'slides', titulo: byId(id).titulo, tpl: '' }); UI.sel = null; go('presentaciones'); };
Chg.pson = el => { const c = pcfg(), ck = catKey(c, activeId(c)), k = el.dataset.k, ok = offKey(ck, k); if (el.checked) { if ((DEF_OFF[ck] || []).includes(k)) c.off[ok] = 0; else delete c.off[ok]; } else c.off[ok] = 1; prr(); };
Acts.popt = d => { const c = pcfg(); c.optk = c.optk === d.k ? '' : d.k; prr(); };
Chg.pso = el => { const c = pcfg(), s = el.dataset.s; c.so[s] = c.so[s] || {}; c.so[s][el.dataset.o] = el.dataset.bool ? el.checked : el.dataset.num ? Math.max(3, Math.min(20, +el.value || 8)) : el.value; prr(); };
Chg.psocol = el => { const c = pcfg(), s = el.dataset.s, o = optOf(c, s), cols = (o.cols || []).filter(x => x !== el.dataset.c); if (el.checked) cols.push(el.dataset.c); const all = Object.keys(OPTS[s].cols); c.so[s] = Object.assign(c.so[s] || {}, { cols: all.filter(x => cols.includes(x)) }); prr(); };
function reorder(c, k, to) { const ck = catKey(c, activeId(c)), o = ordOf(c, ck), a = o.indexOf(k); if (a < 0 || to < 0 || to >= o.length) return; o.splice(a, 1); o.splice(to, 0, k); c.order[ck] = o; }
Acts.pmove = d => { const c = pcfg(), ck = catKey(c, activeId(c)), o = ordOf(c, ck); reorder(c, d.k, o.indexOf(d.k) + +d.d); prr(); };
{ let drag = null;   // arrastrar y soltar
  document.addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('[data-dnd]'); if (!r) return; drag = r.dataset.dnd; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch (x) { } r.classList.add('drag'); });
  document.addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('[data-dnd]'); if (drag && r) { e.preventDefault(); $$('.pb-i.over').forEach(x => x.classList.remove('over')); r.classList.add('over'); } });
  document.addEventListener('dragend', () => { drag = null; $$('.pb-i.drag,.pb-i.over').forEach(x => x.classList.remove('drag', 'over')); });
  document.addEventListener('drop', e => { const r = e.target.closest && e.target.closest('[data-dnd]'); if (!drag || !r) return; e.preventDefault(); const c = pcfg(), ck = catKey(c, activeId(c)), o = ordOf(c, ck); reorder(c, drag, o.indexOf(r.dataset.dnd)); drag = null; prr(); }); }
Acts.pfree = d => { const c = pcfg(), f = d.id ? c.free.find(x => x.id === d.id) : null; openForm({ title: f ? 'Editar diapositiva libre' : 'Nueva diapositiva libre', values: f ? clone(f) : {}, fields: [{ k: 't', l: 'Título', req: true, w: 3 }, { k: 'sub', l: 'Subtítulo', w: 3 }, { k: 'text', l: 'Contenido (una línea por párrafo; “- ” al inicio = viñeta)', t: 'textarea', w: 3 }, { k: 'notes', l: 'Nota del orador', t: 'textarea', w: 3 }], onSave(o) { const ck = catKey(c, activeId(c)); if (f) Object.assign(f, o); else { const n = { id: 'free:' + Math.random().toString(36).slice(2, 7), ck, ...o }; c.free.push(n); const ord = ordOf(c, ck); c.order[ck] = ord; } prr(); } }); };
Acts.pfreedel = d => { const c = pcfg(); c.free = c.free.filter(x => x.id !== d.id); Object.keys(c.order).forEach(k => c.order[k] = c.order[k].filter(x => x !== d.id)); delete c.off[d.id]; prr(); };
Acts.pexec = d => { const c = pcfg(), M = slidesOf(c, activeId(c)), p = (M.pages[d.k] || [])[0]; if (!p || !p.exec) return; c.exec = c.exec || {}; const cur = c.exec._ ? c.exec._.lead : p.exec.gen.lead;
  openForm({ title: 'Editar mensaje del resumen ejecutivo', values: { lead: cur }, wide: true, danger: p.exec.edited ? 'Restaurar texto generado' : null, onDanger: () => { delete c.exec._; Modal.close(); prr(); }, fields: [{ k: 'lead', l: 'Mensaje principal (aparece bajo las cifras; ~260 caracteres)', t: 'textarea', w: 3 }], onSave(o) { c.exec._ = { lead: o.lead }; prr(); } }); };
Chg.preg = el => { const c = pcfg(); c.reglas[el.dataset.r] = el.dataset.bool ? el.checked : Math.max(1, +el.value || 1); prr(); };
Acts.paplicar = async () => { const n = await aplicarReglas(pcfg()); toast(n ? n + ' elementos quedaron fuera de la presentación' : 'Todo cumple las reglas: nada que excluir'); prr(); };
Acts.pall = async d => { await marcarTodo(pcfg(), +d.v); toast(+d.v ? 'Todo incluido' : 'Todo excluido'); prr(); };
Acts.pgoto = d => { pcfg().idx = +d.k; prr(); };

/* ---------- plantillas por área ---------- */
Acts.ptplsave = () => { const c = pcfg(), ck = catKey(c, activeId(c)), a = c.alcance === 'proyecto' ? (byId(activeId(c)) || { area: '' }).area.split(',')[0].trim() : (c.area || St.cfg.areaGlobal);
  openForm({ title: 'Guardar como plantilla', values: { nombre: '', area: a === 'Todas' ? 'Todas' : a }, fields: [{ k: 'nombre', l: 'Nombre', req: true, w: 3 }, { k: 'area', l: 'Disponible para', t: 'select', opts: [{ v: 'Todas', t: 'Todas las áreas' }, ...St.cfg.areas.map(x => ({ v: x, t: x }))], w: 3 }], onSave(o) {
    const ord = ordOf(c, ck), t = { id: nextId('TPL', St.ptpl || []), nombre: o.nombre, area: o.area, ck, alcance: c.alcance, order: ord.slice(), off: Object.fromEntries(ord.map(k => [k, isOff(c, ck, k) ? 1 : 0])), so: clone(Object.fromEntries(Object.entries(c.so).filter(([k]) => ord.includes(k)))), free: clone(c.free.filter(f => f.ck === ck)), nivel: c.nivel, reglas: clone(c.reglas), autor: St.cfg.usuario, priv: esAdministra() ? 0 : 1, fecha: hoy() };
    St.ptpl = St.ptpl || []; St.ptpl.push(t); c.tpl = t.id; save(); toast('Plantilla guardada'); prr(); } }); };
