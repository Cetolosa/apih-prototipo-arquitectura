import { ENLACES } from './00-registro.js';
import { $, $$, DECS, HITOS, St, _nrm, atrasado, by, byId, clone, diffD, esProp, esc, expo, fmtD, fmtDL, hitosDe, hoy, icon, inArea, isLive, nameOf, nextId, riesgoAbierto, riesgosDe, save, scope, scopeP, sum, tipoLbl, uniq } from './01-nucleo.js';
import { Acts, Chg, F, Modal, NAV, UI, Views, btn, confirmBox, downloadBlob, empty, go, openForm, pageHead, panelDec, panelHito, panelIni, panelRisk, refresh, render, selOpts, toast, zipStore } from './03-interfaz.js';
import { NAV_GRP, esAdministra, ptemaEf, ptemaSet, soloMio } from './07-gobierno.js';
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
const TEMA = {
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
const inc = o => !!o && o.inPres !== false;
const incT = (i, f) => !(i.incTxt && i.incTxt[f] === false);
const CAT = {   // catálogo = las láminas del sistema original, en su orden original
  portafolio: [['portada', 'Portada'], ['ejecutivo', 'Resumen ejecutivo'], ['bitacora', 'Bitácora · decisiones y compromisos'], ['logros', 'Movimientos del ciclo'], ['flujo_prj', 'Flujo de proyectos'], ['status_prj', 'Status proyectos'], ['flujo_prop', 'Flujo de propuestas'], ['status_prop', 'Status propuestas'], ['hitos', 'Próximos hitos'], ['alertas', 'Alertas de estancamiento'], ['fichas_prj', 'Fichas de proyecto'], ['fichas_prop', 'Fichas de propuesta'], ['estructura', 'Estructura del portafolio'], ['plan', 'Plan de acción'], ['anexo', 'Anexo']],
  proyecto: [['portada', 'Portada'], ['ficha', 'Ficha de proyecto'], ['hitos', 'Próximos hitos'], ['bitacora', 'Bitácora · decisiones y compromisos'], ['alertas', 'Alertas de estancamiento']],
  propuesta: [['portada', 'Portada'], ['ficha', 'Ficha de propuesta'], ['bitacora', 'Bitácora · decisiones y compromisos']]
};
const DEF_OFF = { proyecto: ['portada', 'hitos', 'bitacora', 'alertas'], propuesta: ['portada', 'bitacora'] };   // por defecto el individual = la Ficha
const offKey = (ck, k) => ck === 'portafolio' || k.startsWith('free:') ? k : ck + ':' + k;   // proyecto y propuesta tienen su propio estado
const isOff = (c, ck, k) => { const v = c.off[offKey(ck, k)]; return v === undefined ? (DEF_OFF[ck] || []).includes(k) : !!v; };
const OPTS = {};   // las láminas del original no tienen opciones: qué entra se decide con las casillas "Incluir en presentación"
const OPT_DEF = {};
const REGLAS_DEF = () => ({});   // solo lo que la persona cambia; el servidor completa los valores por defecto y evalúa
export const PRES_DEF = () => ({ alcance: 'portafolio', proys: [], multi: 'bloques', cur: '', titulo: 'Portafolio TI Operaciones · Comité Ejecutivo', comite: '', area: '', nivel: 'ej', order: {}, off: {}, so: {}, free: [], exec: {}, idx: 0, tpl: '', frozen: '', optk: '', tab: 'slides', reglas: REGLAS_DEF() });
const pcfg = () => { const c = F('pres', PRES_DEF()); if (!c.reglas || !c.order || Array.isArray(c.order)) { c.reglas = c.reglas || REGLAS_DEF(); if (!c.order || Array.isArray(c.order)) c.order = {}; } return c; };
const catKey = (c, id) => c.alcance === 'proyecto' ? (byId(id || c.cur || (c.proys || [])[0]) && esProp(byId(id || c.cur || c.proys[0])) ? 'propuesta' : 'proyecto') : 'portafolio';
const ordOf = (c, ck) => { const base = CAT[ck].map(x => x[0]), cur = (c.order[ck] || []).filter(k => base.includes(k) || c.free.some(f => f.id === k)); base.forEach(k => { if (!cur.includes(k)) cur.push(k); }); c.free.filter(f => f.ck === ck && !cur.includes(f.id)).forEach(f => cur.push(f.id)); return cur; };
const slideName = (c, ck, k) => { const f = c.free.find(x => x.id === k); return f ? f.t || 'Diapositiva libre' : (CAT[ck].find(x => x[0] === k) || [k, k])[1]; };
const optOf = (c, k) => Object.assign({}, OPT_DEF[k] || {}, (c.so || {})[k] || {});
function withArea(c, fn) { const sv = St.cfg.areaGlobal; if (c.area) St.cfg.areaGlobal = c.area; try { return fn(); } finally { St.cfg.areaGlobal = sv; } }
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
function candidatos(c) { return soloMio(() => _cand(c)); }
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


const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

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
function buildDeck(c, id) {
  const M = slidesOf(c, id), ck = M.ck, out = [];
  M.order.forEach(k => { if (isOff(c, ck, k)) return; (M.pages[k] || []).forEach((p, n) => out.push(Object.assign({ key: k, n }, p))); });
  return out;
}
function buildAll(c) { return soloMio(() => _buildAll(c)); }
function _buildAll(c) {   // lista final (según alcance / modo múltiple)
  TEMA.set(ptemaEf());
  if (c.frozen && St.psnap[c.frozen]) return thawSlides(St.psnap[c.frozen].slides).map((s, k) => Object.assign({ key: 'f' + k }, s));
  if (c.alcance !== 'proyecto') return numberDeck(buildDeck(c));
  const ids = (c.proys || []).filter(byId); if (!ids.length) return [];
  if (ids.length === 1 || c.multi === 'separados') return numberDeck(buildDeck(c, c.cur && ids.includes(c.cur) ? c.cur : ids[0]));
  let out = []; ids.forEach((id, k) => { const d = buildDeck(c, id); if (k) out.push(Object.assign({ key: 'sec' }, GENE.seccion(byId(id).titulo, byId(id).id + ' · ' + tipoLbl(byId(id)))[0])); out.push(...d); });
  return numberDeck(out);
}
const numberDeck = d => { GENE.numerar(d); d.forEach((s, k) => { s.num = k + 1; s.total = d.length; }); return d; };
function decksSeparados(c) { return (c.proys || []).filter(byId).map(id => ({ id, name: byId(id).id, slides: numberDeck(buildDeck(c, id)) })); }

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
function slideHTML(s) {
  if (s.g) return geneHTML(s.g);
  if (s.cover || s.section) return `<div class="slide cover"><div class="sl"><div class="cv-b"><span class="logo big">A</span><small>Aramark Chile · Tecnología de la Información</small><h1>${esc(s.t)}</h1><p>${esc(s.sub || '')}</p>${s.who ? `<p class="cv-s">${esc(s.who)}</p>` : ''}</div></div></div>`;
  return `<div class="slide"><div class="sl"><div class="sl-h"><h2>${esc(s.t)}</h2>${s.sub ? `<span>${esc(s.sub)}</span>` : ''}</div><div class="sl-b">${(s.blocks || []).map(blockHTML).join('')}</div><div class="sl-f"><span>APIH · Aramark Portfolio Intelligence Hub</span><span>${s.num || ''} / ${s.total || ''}</span></div></div></div>`;
}

/* ---------- casillas "Incluir en presentación" (fichas) ---------- */
function incChk(k, id) { const o = (INC_E[k]() || []).find(x => x.id === id); if (!o) return ''; return `<label class="chk inc-l" data-act="noop" title="Incluir en presentación"><input type="checkbox" data-chg="incl" data-e="${k}" data-id="${esc(id)}" ${inc(o) ? 'checked' : ''}> <span>En presentación</span></label>`; }
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
Acts.pdrawer = () => { UI.pdr = !UI.pdr; render(); };
function incMarks() {
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
const activeId = c => c.alcance === 'proyecto' ? (c.proys.includes(c.cur) ? c.cur : c.proys[0]) : undefined;
function tplsFor(c) {
  const ck = catKey(c, activeId(c)), a = c.alcance === 'proyecto' ? (byId(activeId(c)) || {}).area || '' : (c.area || St.cfg.areaGlobal);
  return (St.ptpl || []).filter(t => (!t.priv || _nrm(t.autor) === _nrm(St.cfg.usuario)) && t.ck === ck && (t.area === 'Todas' || a === 'Todas' || (a || '').split(',').map(x => x.trim()).includes(t.area)));
}
function itemOpts() { return [...St.ini.filter(i => !esProp(i)).sort(by('id')), ...St.ini.filter(esProp).sort(by('id'))].map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo })); }
function optEditor(c, ck, k) {
  const sch = OPTS[k]; if (!sch) return '<p class="mut">Esta diapositiva no tiene opciones.</p>'; const o = optOf(c, k);
  return `<div class="pb-opt">${sch.cols ? `<div class="fld"><label>Columnas</label><div class="chips">${Object.entries(sch.cols).map(([ck2, l]) => `<label class="chk"><input type="checkbox" data-chg="psocol" data-s="${k}" data-c="${ck2}" ${(o.cols || []).includes(ck2) ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div></div>` : ''}
    <div class="pb-og">${sch.limit ? `<div class="fld"><label>Filas por diapositiva</label><input type="number" min="3" max="20" value="${o.limit}" data-chg="pso" data-s="${k}" data-o="limit" data-num="1"></div>` : ''}
    ${sch.sort ? `<div class="fld"><label>Ordenar por</label><select data-chg="pso" data-s="${k}" data-o="sort">${selOpts(sch.sort.map(x => ({ v: x[0], t: x[1] })), o.sort)}</select></div>` : ''}
    ${sch.group ? `<label class="chk"><input type="checkbox" data-chg="pso" data-s="${k}" data-o="group" data-bool="1" ${o.group ? 'checked' : ''}> <span>Agrupar por área</span></label>` : ''}
    ${sch.budget ? `<label class="chk"><input type="checkbox" data-chg="pso" data-s="${k}" data-o="budget" data-bool="1" ${o.budget ? 'checked' : ''}> <span>Mostrar montos / presupuesto</span></label>` : ''}</div></div>`;
}
function slideList(c, M) {
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
function queEntra(c) {
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
function estiloTab() {
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
function histTab() {
  const pres = St.pres.slice().sort(by(p => p.fecha || '', -1));
  return `<div class="tbl-w"><table class="tbl"><thead><tr><th>Fecha</th><th>Nombre</th><th>Alcance</th><th>Área</th><th>Autor</th><th>Origen</th><th></th></tr></thead><tbody>${pres.map(p => `<tr><td>${fmtD(p.fecha)}</td><td><b>${esc(p.nombre)}</b>${p.n ? `<small class="mut"> · ${p.n} diap.</small>` : ''}</td><td>${esc(p.alcance || '—')}</td><td>${esc(p.area)}</td><td>${esc(p.autor || '—')}</td><td><span class="pill soft">${esc(p.origen)}</span>${p.url ? ` <a class="lnk" href="${esc(p.url)}" target="_blank" rel="noopener">abrir original</a>` : ''}</td>
    <td class="nw">${St.psnap[p.id] ? `<button class="lnk" data-act="phver" data-id="${p.id}">Ver</button> <button class="lnk" data-act="phdup" data-id="${p.id}">Duplicar</button> <button class="lnk" data-act="phdl" data-id="${p.id}" data-f="html">HTML</button> <button class="lnk" data-act="phdl" data-id="${p.id}" data-f="pptx">PPTX</button> <button class="lnk edit-only" data-act="phdel" data-id="${p.id}">Eliminar</button>` : '<span class="mut">sin copia congelada</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
Views.presentaciones = {
  render() { return soloMio(() => this._r()); },
  _r() {
    const c = pcfg(), fz = c.frozen && St.psnap[c.frozen]; if (c.frozen && !fz) c.frozen = '';
    if (c.alcance === 'proyecto') { c.proys = c.proys.filter(byId); if (!c.proys.includes(c.cur)) c.cur = c.proys[0] || ''; }
    const sl = buildAll(c); c.idx = Math.max(0, Math.min(c.idx, sl.length - 1));
    const M = !fz && (c.alcance !== 'proyecto' || c.proys.length) ? slidesOf(c, activeId(c)) : null, tp = tplsFor(c), cur = sl[c.idx];
    const ck = catKey(c, activeId(c)), tab = c.tab;
    const cfgCard = `<aside class="card pres-c"><header><h2>Configuración</h2></header><div class="fgrid one">
      <div class="fld"><label>Alcance</label><div class="seg"><button class="${c.alcance === 'portafolio' ? 'on' : ''}" data-act="palc" data-a="portafolio">Portafolio</button><button class="${c.alcance === 'proyecto' ? 'on' : ''}" data-act="palc" data-a="proyecto">Un proyecto / propuesta</button></div></div>
      ${c.alcance === 'proyecto' ? `<div class="fld"><label>Proyectos / propuestas</label><div class="chips">${c.proys.map(id => `<span class="chip ${id === c.cur ? 'on' : ''}"><button class="lnk" data-act="pcur" data-id="${id}">${esc(id)} · ${esc(clip(nameOf(id), 22))}</button><button class="x" data-act="prm" data-id="${id}" aria-label="Quitar">×</button></span>`).join('') || '<small class="mut">Elige al menos uno.</small>'}</div><select data-chg="padd">${selOpts(itemOpts().filter(o => !c.proys.includes(o.v)), '', '+ Agregar…')}</select>
        ${c.proys.length > 1 ? `<div class="seg" style="margin-top:6px"><button class="${c.multi === 'bloques' ? 'on' : ''}" data-act="pmulti" data-m="bloques">Una presentación</button><button class="${c.multi === 'separados' ? 'on' : ''}" data-act="pmulti" data-m="separados">Una por proyecto</button></div>` : ''}</div>` : ''}
      <div class="fld"><label>Título</label><input value="${esc(c.titulo)}" data-key="pr-t" data-chg="pcfg" data-k="titulo"></div>
      ${c.alcance === 'portafolio' ? `<div class="fld"><label>Comité / ciclo</label><select data-chg="pcfg" data-k="comite">${selOpts(St.comites.slice().sort(by('fecha', -1)).map(x => ({ v: x.id, t: fmtD(x.fecha) + ' · ' + x.estado })), c.comite, 'Hoy (sin comité)')}</select></div><div class="fld"><label>Área</label><select data-chg="pcfg" data-k="area">${selOpts(['', ...St.cfg.areas].map(a => ({ v: a, t: a || 'Según filtro global (' + St.cfg.areaGlobal + ')' })), c.area)}</select></div>` : ''}
      <div class="fld"><label>Plantilla (${ck === 'portafolio' ? 'portafolio' : ck})</label><select data-chg="pcfg" data-k="tpl">${selOpts(tp.map(t => ({ v: t.id, t: t.nombre + ' · ' + (t.area === 'Todas' ? 'todas las áreas' : t.area) })), c.tpl, 'Sin plantilla')}</select><div class="chips" style="margin-top:6px">${btn('Aplicar', 'ptplapply', { cls: 'sm' })}${btn('Guardar como plantilla…', 'ptplsave', { cls: 'sm' })}${c.tpl ? btn('Eliminar', 'ptpldel', { cls: 'sm' }) : ''}</div></div></div></aside>`;
    const head = pageHead('Presentaciones', 'Cada diapositiva, hito, riesgo, decisión o texto se puede incluir o excluir. Presenta a pantalla completa, imprime a PDF o descarga HTML y PowerPoint (.pptx) nativo.', `${btn('Guardar en historial', 'pressave', { ic: 'check' })}${btn('HTML', 'presdl', { ic: 'down' })}${btn('PowerPoint', 'prespptx', { ic: 'down' })}${btn('PDF', 'presprint', { ic: 'copy' })}${btn('Presentar', 'present', { ic: 'full', cls: 'pri' })}`);
    const prev = !sl.length ? empty(c.alcance === 'proyecto' ? 'Elige un proyecto o propuesta para presentar' : 'No hay diapositivas activas', 'slides') : `<div class="deck" id="deckstage">${slideHTML(cur)}<div class="deck-nav"><button data-act="pnav" data-d="-1" aria-label="Anterior">${icon('chevl', 18)}</button><span>${c.idx + 1} / ${sl.length}</span><button data-act="pnav" data-d="1" aria-label="Siguiente">${icon('chev', 18)}</button></div></div>
      <div class="thumbs">${sl.map((s, k) => `<button class="th ${k === c.idx ? 'on' : ''}" data-act="pgoto" data-k="${k}"><span>${k + 1}</span><div class="th-s">${slideHTML(s)}</div></button>`).join('')}</div>
      <div class="card notes"><header><h2>Notas del orador</h2><small>Diapositiva ${c.idx + 1}</small></header><p class="pre">${esc(cur.notes || '—')}</p></div>`;
    const tabs = [['slides', 'Diapositivas'], ['entra', 'Qué entra'], ['estilo', 'Estilo'], ['hist', 'Historial (' + St.pres.length + ')']];
    const body = fz ? '<p class="mut">Presentación guardada: contenido y selección congelados.</p>' : !M ? '<p class="mut">Elige un proyecto o propuesta.</p>' : tab === 'entra' ? queEntra(c) : tab === 'hist' ? histTab() : tab === 'estilo' ? estiloTab() : slideList(c, M);
    return head + (fz ? `<div class="note warn" style="margin-bottom:12px">${icon('book', 14)}<span>Estás viendo una presentación guardada (copia congelada: <b>${esc((St.pres.find(p => p.id === c.frozen) || {}).nombre || c.frozen)}</b>).</span> <button class="lnk" data-act="phlive">Volver a datos vivos</button> <button class="lnk" data-act="phdup" data-id="${c.frozen}">Duplicar para editar</button></div>` : '') + `
    <div class="pres-w">${cfgCard}<section class="pres-s">${prev}
      <section class="card"><div class="tabs sm">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="ptabp" data-k="${k}">${n}</button>`).join('')}</div><div style="margin-top:12px">${tab === 'estilo' ? estiloTab() : fz && tab !== 'hist' ? body : tab === 'hist' ? histTab() : body}</div></section></section></div>`;
  }
};

/* ---------- acciones de configuración ---------- */
const prr = () => render();
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
Acts.pgokey = d => { const c = pcfg(), sl = buildAll(c), k = sl.findIndex(s => s.key === d.k); if (k >= 0) c.idx = k; prr(); };
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
Acts.pnav = d => { const c = pcfg(), n = buildAll(c).length; if (!n) return; c.idx = (c.idx + +d.d + n) % n; prr(); };
Acts.pgoto = d => { pcfg().idx = +d.k; prr(); };

/* ---------- plantillas por área ---------- */
Acts.ptplsave = () => { const c = pcfg(), ck = catKey(c, activeId(c)), a = c.alcance === 'proyecto' ? (byId(activeId(c)) || { area: '' }).area.split(',')[0].trim() : (c.area || St.cfg.areaGlobal);
  openForm({ title: 'Guardar como plantilla', values: { nombre: '', area: a === 'Todas' ? 'Todas' : a }, fields: [{ k: 'nombre', l: 'Nombre', req: true, w: 3 }, { k: 'area', l: 'Disponible para', t: 'select', opts: [{ v: 'Todas', t: 'Todas las áreas' }, ...St.cfg.areas.map(x => ({ v: x, t: x }))], w: 3 }], onSave(o) {
    const ord = ordOf(c, ck), t = { id: nextId('TPL', St.ptpl || []), nombre: o.nombre, area: o.area, ck, alcance: c.alcance, order: ord.slice(), off: Object.fromEntries(ord.map(k => [k, isOff(c, ck, k) ? 1 : 0])), so: clone(Object.fromEntries(Object.entries(c.so).filter(([k]) => ord.includes(k)))), free: clone(c.free.filter(f => f.ck === ck)), nivel: c.nivel, reglas: clone(c.reglas), autor: St.cfg.usuario, priv: esAdministra() ? 0 : 1, fecha: hoy() };
    St.ptpl = St.ptpl || []; St.ptpl.push(t); c.tpl = t.id; save(); toast('Plantilla guardada'); prr(); } }); };
Acts.ptplapply = () => { const c = pcfg(), t = (St.ptpl || []).find(x => x.id === c.tpl); if (!t) { toast('Elige una plantilla', 'err'); return; } const ck = t.ck;
  c.free = c.free.filter(f => f.ck !== ck).concat(clone(t.free || [])); c.order[ck] = t.order.slice(); Object.keys(t.off || {}).forEach(k => { c.off[offKey(ck, k)] = t.off[k]; }); Object.assign(c.so, clone(t.so)); c.nivel = t.nivel || c.nivel; if (t.reglas) c.reglas = clone(t.reglas); c.idx = 0; toast('Plantilla aplicada: ' + t.nombre); prr(); };
Acts.ptpldel = () => { const c = pcfg(), t = (St.ptpl || []).find(x => x.id === c.tpl); if (!t) return; confirmBox(`¿Eliminar la plantilla <b>${esc(t.nombre)}</b>?`, () => { St.ptpl = St.ptpl.filter(x => x.id !== t.id); c.tpl = ''; save(); prr(); }, 'Eliminar', true); };

/* ---------- historial con copia congelada ---------- */
/* láminas congeladas: los elementos se guardan compactos (arreglos) para que ocupen poco en el registro */
const rn = v => Math.round(v * 100) / 100;
const packG = g => ({ bg: g.bg, rail: g.rail, e: g.els.map(e => [e.shape, rn(e.x), rn(e.y), rn(e.w), rn(e.h), e.fill || 0, e.line ? e.line.c : 0, e.line ? e.line.w : 0, e.text, e.size, e.bold ? 1 : 0, e.italic ? 1 : 0, e.color, e.align, e.anchor, e.rot || 0]) });
const unpackG = p => ({ bg: p.bg, rail: p.rail, frozen: true, pageInc: 0, els: p.e.map(a => ({ shape: a[0], x: a[1], y: a[2], w: a[3], h: a[4], fill: a[5] || null, line: a[6] ? { c: a[6], w: a[7] } : null, text: a[8], size: a[9], bold: !!a[10], italic: !!a[11], color: a[12], align: a[13], anchor: a[14], rot: a[15] })) });
const frozenSlides = deck => deck.map(s => ({ cover: s.cover, section: s.section, t: s.t, sub: s.sub, who: s.who, notes: s.notes, blocks: s.blocks, gp: s.g ? packG(s.g) : undefined }));
const thawSlides = arr => arr.map(s => Object.assign({}, s, s.gp ? { g: unpackG(s.gp) } : {}));
function saveSnap(c, deck, nombre, items) {
  const id = nextId('PRS', St.pres), sel = candidatos(c), cfg = clone(Object.assign({}, c, { frozen: '', idx: 0, optk: '' }));
  St.pres.push({ id, nombre: nombre + ' · ' + fmtD(hoy()), fecha: hoy(), area: c.alcance === 'proyecto' ? uniq(items.flatMap(i => (byId(i) || { area: '' }).area.split(','))).join(',') : (c.area || (St.cfg.areaGlobal === 'Todas' ? 'BISE,MINERÍA' : St.cfg.areaGlobal)), url: '', origen: 'APIH', alcance: c.alcance === 'proyecto' ? 'Proyecto / propuesta' : 'Portafolio', secciones: uniq(deck.map(s => s.t.replace(' (cont.)', ''))), autor: St.cfg.usuario, n: deck.length, items });
  St.psnap = St.psnap || {}; St.psnap[id] = { cfg, slides: frozenSlides(deck), sel: { prj: sel.prj.filter(inc).map(x => x.id), prop: sel.prop.filter(inc).map(x => x.id), hito: sel.hito.filter(inc).map(x => x.id), rsk: sel.rsk.filter(inc).map(x => x.id), dec: sel.dec.filter(inc).map(x => x.id) } };
  return id;
}
Acts.pressave = () => { const c = pcfg(); if (c.frozen) { toast('Ya es una copia guardada', 'err'); return; }
  if (c.alcance === 'proyecto' && c.multi === 'separados' && c.proys.length > 1) { decksSeparados(c).forEach(d => saveSnap(c, d.slides, c.titulo + ' · ' + d.id, [d.id])); toast(c.proys.length + ' presentaciones guardadas en el historial'); }
  else { const d = buildAll(c); if (!d.length) { toast('No hay diapositivas para guardar', 'err'); return; } saveSnap(c, d, c.titulo, c.alcance === 'proyecto' ? c.proys.slice() : []); toast('Presentación guardada (contenido y selección congelados)'); }
  save(); c.tab = 'hist'; prr(); };
Acts.phver = d => { const c = pcfg(); c.frozen = d.id; c.idx = 0; c.tab = 'hist'; prr(); };
Acts.phlive = () => { pcfg().frozen = ''; pcfg().idx = 0; prr(); };
Acts.phdup = d => { const sn = St.psnap[d.id]; if (!sn) return; const c = pcfg(); const cf = clone(sn.cfg); Object.keys(cf).forEach(k => { c[k] = cf[k]; }); c.frozen = ''; c.titulo = (cf.titulo || 'Presentación') + ' (copia)'; c.tab = 'slides'; c.idx = 0; toast('Copia editable creada con la configuración guardada (datos actuales)'); prr(); };
Acts.phdel = d => confirmBox('¿Eliminar esta presentación del historial?', () => { St.pres = St.pres.filter(p => p.id !== d.id); if (St.psnap) delete St.psnap[d.id]; if (pcfg().frozen === d.id) pcfg().frozen = ''; save(); prr(); }, 'Eliminar', true);

/* ============================================================
   APIH V5 · Presentaciones (3/3): exportaciones
   HTML autónomo · PDF (imprimir) · pantalla completa · PPTX NATIVO (escritor propio, sin librerías)
   PPTX: títulos, tablas y textos nativos y editables; gráficos (SVG) como imagen PNG.
   ============================================================ */
const slug = s => String(s || 'presentacion').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50);
function deckHTMLOf(slides, title) {
  // El HTML exportado es autónomo: incrusta la hoja base de la app (css/base.css), leída de las reglas ya cargadas.
  const css = [...document.styleSheets].filter(h => /css\/base\.css$/.test(h.href || '')).flatMap(h => [...h.cssRules].map(r => r.cssText)).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}
  body{background:#1b1a19;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:'Segoe UI',system-ui,sans-serif}.xs{display:none;width:min(100vw,177.78vh)}.xs.on{display:block}.xn{position:fixed;bottom:10px;color:#ccc;font-size:12px}
  @media print{body{background:#fff;display:block}.xs{display:block!important;width:100%;page-break-after:always}.xn{display:none}@page{size:landscape;margin:0}}</style></head><body>${slides.map((s, k) => `<div class="xs ${k === 0 ? 'on' : ''}">${slideHTML(s)}</div>`).join('')}<div class="xn">← → para navegar · Generado con APIH el ${fmtDL(hoy())}</div><script>var s=[].slice.call(document.querySelectorAll('.xs')),i=0;function g(n){s[i].classList.remove('on');i=(n+s.length)%s.length;s[i].classList.add('on')}document.addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' '].indexOf(e.key)>-1)g(i+1);if(['ArrowLeft','PageUp'].indexOf(e.key)>-1)g(i-1)});document.addEventListener('click',function(){g(i+1)});<\/script></body></html>`;
}

/* ---------- escritor PPTX ---------- */
const PX = { W: 13.333, H: 7.5, M: 0.55, TOP: 1.5, BOT: 6.95 };
const EMU = v => Math.round(v * 914400);
const XE = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const hexc = c => String(c || '#201F1E').replace('#', '').toUpperCase().padEnd(6, '0').slice(0, 6);
const run = (t, o = {}) => `<a:r><a:rPr lang="es-CL" sz="${Math.round((o.sz || 14) * 100)}" b="${o.b ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${hexc(o.c)}"/></a:solidFill><a:latin typeface="Segoe UI"/><a:cs typeface="Segoe UI"/></a:rPr><a:t>${XE(t)}</a:t></a:r>`;
export const para = (runs, o = {}) => `<a:p><a:pPr algn="${o.al || 'l'}"${o.bu ? ' marL="228600" indent="-228600"' : ''}>${o.sp ? `<a:spcAft><a:spcPts val="${o.sp * 100}"/></a:spcAft>` : ''}${o.bu ? '<a:buFont typeface="Arial"/><a:buChar char="•"/>' : '<a:buNone/>'}</a:pPr>${runs}</a:p>`;
const lines = (t, w, pt) => { const cpl = Math.max(4, Math.floor(w * 72 / (pt * 0.52))); return String(t ?? '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0); };
class PSlide {
  constructor() { this.id = 1; this.sp = ''; this.imgs = []; }
  nid() { return ++this.id; }
  xfrm(x, y, w, h) { return `<a:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(w)}" cy="${EMU(h)}"/></a:xfrm>`; }
  text(x, y, w, h, paras, o = {}) { const id = this.nid(); this.sp += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Texto ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${this.xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${o.anchor || 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`; }
  title(x, y, w, h, t, o = {}) { const id = this.nid(); this.sp += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Título"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${this.xfrm(x, y, w, h)}</p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${o.anchor || 'b'}"><a:normAutofit/></a:bodyPr><a:lstStyle/>${para(run(t, { sz: o.sz || 26, b: 1, c: o.c || '#0B2A4A' }))}</p:txBody></p:sp>`; }
  rect(x, y, w, h, fill, o = {}) { const id = this.nid(); this.sp += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Forma ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${this.xfrm(x, y, w, h)}<a:prstGeom prst="${o.round ? 'roundRect' : 'rect'}"><a:avLst>${o.round ? '<a:gd name="adj" fmla="val 8000"/>' : ''}</a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="${hexc(fill)}"/></a:solidFill><a:ln>${o.line ? `<a:solidFill><a:srgbClr val="${hexc(o.line)}"/></a:solidFill>` : '<a:noFill/>'}</a:ln></p:spPr></p:sp>`; }
  pic(x, y, w, h, png, descr) { const n = this.imgs.length + 1, id = this.nid(); this.imgs.push(png); this.sp += `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Gráfico ${n}" descr="${XE(descr || 'Gráfico')}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId${n + 1}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${this.xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`; }
  table(x, y, w, cols, rowsXml, hTot) { const id = this.nid(); this.sp += `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabla ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${EMU(x)}" y="${EMU(y)}"/><a:ext cx="${EMU(w)}" cy="${EMU(hTot)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>${cols.map(c => `<a:gridCol w="${EMU(c)}"/>`).join('')}</a:tblGrid>${rowsXml}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`; }
  gsp(e0) {   // elemento del sistema original (coordenadas en pt)
    const e = TEMA.el(e0), id = this.nid(), P = v => Math.round(v * 12700), hx = hexc, rot = ((e.rot || 0) % 360 + 360) % 360;
    const geom = { RECT: 'rect', TEXT: 'rect', ROUND: 'roundRect', ELLIPSE: 'ellipse', RIGHT_ARROW: 'rightArrow' }[e.shape] || 'rect';
    const av = e.shape === 'ROUND' ? `<a:gd name="adj" fmla="val ${Math.round(Math.min(50000, 16667 * TEMA.cur.radio))}"/>` : '';
    const fill = e.fill ? `<a:solidFill><a:srgbClr val="${hx(e.fill)}"/></a:solidFill>` : '<a:noFill/>';
    const ln = e.line ? `<a:ln w="${P(e.line.w)}"><a:solidFill><a:srgbClr val="${hx(e.line.c)}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';
    const body = e.text === '' ? '' : `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="${e.anchor || 't'}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${String(e.text).split('\n').map(l => `<a:p><a:pPr algn="${e.align || 'l'}"><a:buNone/></a:pPr>${l === '' ? `<a:endParaRPr lang="es-CL" sz="${Math.round(e.size * 100)}"/>` : `<a:r><a:rPr lang="es-CL" sz="${Math.round(e.size * 100)}" b="${e.bold ? 1 : 0}" i="${e.italic ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${hx(e.color)}"/></a:solidFill><a:latin typeface="${TEMA.font()}"/><a:cs typeface="${TEMA.font()}"/></a:rPr><a:t>${XE(l)}</a:t></a:r>`}</a:p>`).join('')}</p:txBody>`;
    this.sp += `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${e.shape === 'TEXT' ? 'Texto' : 'Forma'} ${id}"/><p:cNvSpPr${e.shape === 'TEXT' ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm${rot ? ` rot="${Math.round(rot * 60000)}"` : ''}><a:off x="${P(e.x)}" y="${P(e.y)}"/><a:ext cx="${P(e.w)}" cy="${P(e.h)}"/></a:xfrm><a:prstGeom prst="${geom}"><a:avLst>${av}</a:avLst></a:prstGeom>${fill}${ln}</p:spPr>${body}</p:sp>`;
  }
  xml(bg) { return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}><p:cSld>${bg ? `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hexc(bg)}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` : ''}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${this.sp}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`; }
}
const TONE = { g: '#107C10', w: '#CA5010', b: '#D13438', '': '#0F6CBD' };
function tcell(x, o) {   // celda de tabla
  const v = x && typeof x === 'object' ? x : { t: x }; let r = '';
  if (v.dot) r += run('● ', { sz: o.pt, c: v.dot });
  r += run(v.t ?? '', { sz: o.pt, b: v.b || o.head, c: v.neg ? '#D13438' : o.head ? '#605E5C' : '#201F1E' });
  return `<a:tc${v.span > 1 ? ` gridSpan="${v.span}"` : ''}><a:txBody><a:bodyPr/><a:lstStyle/>${para(r)}</a:txBody><a:tcPr marL="64008" marR="64008" marT="36576" marB="36576" anchor="ctr"><a:lnL w="0"><a:noFill/></a:lnL><a:lnR w="0"><a:noFill/></a:lnR><a:lnT w="0"><a:noFill/></a:lnT><a:lnB w="6350"><a:solidFill><a:srgbClr val="E1DFDD"/></a:solidFill></a:lnB>${o.fill ? `<a:solidFill><a:srgbClr val="${o.fill}"/></a:solidFill>` : '<a:noFill/>'}</a:tcPr></a:tc>`;
}
function tableLayout(b, w) {   // → { cols, rowsXml, h }
  const n = b.head.length, pt = n > 6 ? 9 : n > 5 ? 10 : 11, len = c => Math.max(8, Math.min(34, ...[Math.max(...b.rows.filter(r => Array.isArray(r)).map(r => { const v = r[c]; return String(v && typeof v === 'object' ? v.t : v ?? '').length + (v && v.dot ? 3 : 0); }), String(b.head[c]).length + 1)]));
  const wt = b.w && b.w.length === n ? b.w : b.head.map((_, c) => len(c)), tot = sum(wt), cols = wt.map(x => x / tot * w);
  const cut = (t, cw) => { t = String(t ?? ''); const cap = Math.max(6, Math.floor((cw - .15) * 72 / (pt * 0.52))) * 2; return t.length > cap ? t.slice(0, cap - 1) + '…' : t; };
  let h = 0, rx = '';
  const row = (cells, o) => { let mx = 1; cells.forEach((x, c) => { const t = x && typeof x === 'object' ? x.t : x; mx = Math.max(mx, Math.min(2, lines(t, (x && x.span > 1 ? w : cols[c]) - .15, pt))); }); const rh = mx * pt * 1.25 / 72 + .12; h += rh;
    let xml = '', c = 0; while (c < cells.length) { const x = cells[c], v = x && typeof x === 'object' ? { ...x, t: cut(x.t, x.span > 1 ? w : cols[c]) } : { t: cut(x, cols[c]) }; xml += tcell(v, { pt, fill: o.fill, head: o.head }); for (let k = 1; k < (v.span || 1); k++) xml += `<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="es-CL"/></a:p></a:txBody><a:tcPr/></a:tc>`; c += v.span > 1 ? v.span : 1; }
    rx += `<a:tr h="${EMU(rh)}">${xml}</a:tr>`; };
  row(b.head, { fill: 'F3F2F1', head: 1 });
  b.rows.forEach(r => { if (Array.isArray(r)) row(r, {}); else row([{ t: r.grp, b: 1, span: n }], { fill: 'EAF1FB' }); });
  return { cols, rowsXml: rx, h };
}
/* Dibuja bloques apilados en (x,y,w) con altura disponible hMax; devuelve altura usada. Los SVG se rasterizan antes (b.png). */
function layoutBlocks(S, blocks, x, y, w, hMax) {
  let cy = y; const room = () => hMax - (cy - y);
  blocks.forEach((b, bi) => {
    const gap = 0.12;
    if (b.k === 'lead') { const pt = 16, h = lines(b.t, w, pt) * pt * 1.3 / 72 + .08; S.text(x, cy, w, h, para(run(b.t, { sz: pt, b: 1, c: '#0B2A4A' })), {}); cy += h + gap; }
    else if (b.k === 'h') { S.text(x, cy, w, .32, para(run(b.t, { sz: 13, b: 1, c: '#605E5C' }))); cy += .36; }
    else if (b.k === 'note') { if (!b.t) return; const h = lines(b.t, w, 10) * 10 * 1.3 / 72 + .05; S.text(x, cy, w, h, para(run(b.t, { sz: 10, c: '#605E5C' }))); cy += h + gap; }
    else if (b.k === 'ul') { const pt = b.items.length > 5 ? 12 : 13.5; const h = sum(b.items, t => lines(t, w - .3, pt) * pt * 1.3 / 72 + .07); S.text(x, cy, w, h, b.items.map(t => para(run(t, { sz: pt }), { bu: 1, sp: 4 })).join('')); cy += h + gap; }
    else if (b.k === 'kpis') { const n = b.cols || 2, g = .14, tw = (w - (n - 1) * g) / n, rows = Math.ceil(b.items.length / n), th = Math.min(.95, Math.max(.7, (room() - (rows - 1) * g) / rows));
      b.items.forEach(([l, v, k], i) => { const tx = x + (i % n) * (tw + g), ty = cy + Math.floor(i / n) * (th + g); S.rect(tx, ty, tw, th, '#F5F9FE', { round: 1 }); S.rect(tx, ty, .06, th, TONE[k] || TONE['']); S.text(tx + .18, ty + .08, tw - .26, th * .55, para(run(String(v), { sz: String(v).length > 12 ? 14 : 20, b: 1, c: TONE[k] || '#0B2A4A' })), { anchor: 'ctr' }); S.text(tx + .18, ty + th * .62, tw - .26, th * .34, para(run(l, { sz: 10.5, c: '#605E5C' }))); });
      cy += rows * th + (rows - 1) * g + gap; }
    else if (b.k === 'legend') { const r = b.items.map(([l, c]) => run('● ', { sz: 11, c }) + run(l + '    ', { sz: 11, c: '#605E5C' })).join(''); S.text(x, cy, w, .3, para(r)); cy += .34; }
    else if (b.k === 'svg') { if (!b.png) return; const mh = Math.max(.6, room() - .05), ar = b.h / b.w; let pw = Math.min(w, (b.thin ? 1 : 1) * w), ph = pw * ar; if (ph > mh) { ph = mh; pw = ph / ar; } S.pic(x + (w - pw) / 2, cy, pw, ph, b.png, b.cap); cy += ph + gap; if (b.cap) { S.text(x, cy - .06, w, .25, para(run(b.cap, { sz: 9.5, c: '#605E5C' }), { al: 'ctr' })); cy += .22; } }
    else if (b.k === 'row') { const sv = b.items.filter(i => i.k === 'svg'), rest = b.items.filter(i => i.k !== 'svg'); let used = 0; const sw = Math.min(2.4, w * .4); sv.forEach(s => { if (s.png) { const ph = sw * s.h / s.w; S.pic(x, cy, sw, ph, s.png); used = Math.max(used, ph); } }); const ru = layoutBlocks(S, rest, x + sw + .3, cy + .35, w - sw - .3, room()); cy += Math.max(used, ru) + gap; }
    else if (b.k === 'cols') { const r = b.ratio || [1.2, 1], g = .35, lw = (w - g) * r[0] / (r[0] + r[1]), rw = w - g - lw, a = layoutBlocks(S, b.l, x, cy, lw, room()), c2 = layoutBlocks(S, b.r, x + lw + g, cy, rw, room()); cy += Math.max(a, c2) + gap; }
    else if (b.k === 'cards') { const n = b.items.length, g = .15, cw = (w - (n - 1) * g) / n, ch = Math.min(Math.max(2, room() - .05), .85 + .27 * Math.max(3, ...b.items.map(q => q.lines.length + (q.more ? 1 : 0)))); b.items.forEach((q, i) => { const cx = x + i * (cw + g); S.rect(cx, cy, cw, ch, q.cur ? '#EAF1FB' : '#FAF9F8', { round: 1, line: q.cur ? '#0F6CBD' : '#E1DFDD' }); S.text(cx + .12, cy + .1, cw - .24, .5, para(run(q.t, { sz: 15, b: 1, c: '#0B2A4A' })) + para(run(q.sub, { sz: 10, c: '#605E5C' })));
        S.text(cx + .12, cy + .7, cw - .24, ch - .8, q.lines.map(l => para(run('● ', { sz: 9, c: l.c }) + run(clip(l.t, 26), { sz: 10.5 }) + run('  ' + l.s, { sz: 9, c: '#605E5C' }), { sp: 3 })).join('') + (q.more ? para(run('+' + q.more + ' más', { sz: 9.5, c: '#605E5C' })) : '')); }); cy += ch + gap; }
    else if (b.k === 'table') { const T = tableLayout(b, w); S.table(x, cy, w, T.cols, T.rowsXml, T.h); cy += T.h + gap; }
  });
  return cy - y;
}
function svgPng(svg, w, h, scale = 2) {   // SVG → PNG (Uint8Array) con canvas
  return new Promise(res => {
    const img = new Image(), done = v => res(v); img.onload = () => { try { const cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob(async b => done(b ? new Uint8Array(await b.arrayBuffer()) : null), 'image/png'); } catch (e) { done(null); } };
    img.onerror = () => done(null); img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));   // V11: blob: en vez de data: (CSP img-src sin data:)
  });
}
async function prepSlide(s) {   // rasteriza los SVG de la diapositiva (recursivo)
  const walk = async bl => { for (const b of bl || []) { if (b.k === 'svg') b.png = b.svg ? await svgPng(b.svg, b.w, b.h) : null; else { await walk(b.items && b.items[0] && b.items[0].k ? b.items : null); await walk(b.l); await walk(b.r); } } };
  const copy = JSON.parse(JSON.stringify(s)); await walk(copy.blocks); return copy;
}
function slideToPptx(s, total) {
  const S = new PSlide();
  if (s.g) { s.g.els.forEach(e => S.gsp(e)); return { S, bg: TEMA.bg(s.g.bg) }; }
  if (s.cover || s.section) {
    S.rect(0, 0, PX.W, PX.H, '#0B2A4A'); S.rect(0, 0, .35, PX.H, '#0F6CBD');
    S.text(1.0, 1.6, 8, .4, para(run('Aramark Chile · Tecnología de la Información', { sz: 14, c: '#CFE3F7' })));
    S.title(1.0, 2.1, PX.W - 2.2, 1.9, s.t, { sz: 38, c: '#FFFFFF', anchor: 't' });
    S.text(1.0, 4.2, PX.W - 2.2, .5, para(run(s.sub || '', { sz: 20, c: '#CFE3F7' })));
    if (s.who) S.text(1.0, 4.9, PX.W - 2.2, .4, para(run(s.who, { sz: 14, c: '#9FC3E8' })));
    return { S, bg: '0B2A4A' };
  }
  S.title(PX.M, .35, PX.W - 2 * PX.M, .62, s.t); if (s.sub) S.text(PX.M, .98, PX.W - 2 * PX.M, .3, para(run(s.sub, { sz: 13, c: '#605E5C' })));
  S.rect(PX.M, 1.33, PX.W - 2 * PX.M, .03, '#0F6CBD');
  layoutBlocks(S, s.blocks || [], PX.M, PX.TOP, PX.W - 2 * PX.M, PX.BOT - PX.TOP);
  S.text(PX.M, 7.08, 8, .25, para(run('APIH · Aramark Portfolio Intelligence Hub', { sz: 9, c: '#8A8886' })));
  S.text(PX.W - PX.M - 2, 7.08, 2, .25, para(run((s.num || '') + ' / ' + (total || ''), { sz: 9, c: '#8A8886' }), { al: 'r' }));
  return { S };
}
const CT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const THEME = `${CT}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="APIH"><a:themeElements><a:clrScheme name="APIH"><a:dk1><a:srgbClr val="201F1E"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0B2A4A"/></a:dk2><a:lt2><a:srgbClr val="F3F2F1"/></a:lt2><a:accent1><a:srgbClr val="0F6CBD"/></a:accent1><a:accent2><a:srgbClr val="107C10"/></a:accent2><a:accent3><a:srgbClr val="F2A100"/></a:accent3><a:accent4><a:srgbClr val="D13438"/></a:accent4><a:accent5><a:srgbClr val="8764B8"/></a:accent5><a:accent6><a:srgbClr val="038387"/></a:accent6><a:hlink><a:srgbClr val="0F6CBD"/></a:hlink><a:folHlink><a:srgbClr val="8764B8"/></a:folHlink></a:clrScheme><a:fontScheme name="APIH"><a:majorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Segoe UI"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="APIH"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const PH_TITLE = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Título"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${EMU(PX.M)}" y="${EMU(.35)}"/><a:ext cx="${EMU(PX.W - 2 * PX.M)}" cy="${EMU(.62)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr anchor="b"/><a:lstStyle/><a:p><a:r><a:rPr lang="es-CL"/><a:t>Título</a:t></a:r></a:p></p:txBody></p:sp>`;
const GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
async function pptxBytes(slides, title) {
  const files = [], N = slides.length, RT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships', rel = (id, t, tg) => `<Relationship Id="${id}" Type="${RT}/${t}" Target="${tg}"/>`;
  const media = []; const sx2 = [];
  for (let k = 0; k < N; k++) { const s = await prepSlide(slides[k]), r = slideToPptx(s, N); sx2.push(r); }
  sx2.forEach((r, k) => { const rels = [rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')]; r.S.imgs.forEach((png, j) => { if (!png) return; const name = `image${media.length + 1}.png`; media.push({ name: 'ppt/media/' + name, data: png }); rels.push(rel('rId' + (j + 2), 'image', '../media/' + name)); });
    files.push({ name: `ppt/slides/slide${k + 1}.xml`, data: r.S.xml(r.bg) }, { name: `ppt/slides/_rels/slide${k + 1}.xml.rels`, data: `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>` }); });
  // imágenes nulas (fallo al rasterizar): quitar las referencias huérfanas
  files.forEach(f => { if (/slides\/slide\d+\.xml$/.test(f.name)) f.data = f.data.replace(/<p:pic>(?:(?!<\/p:pic>).)*?r:embed="rId(\d+)"(?:(?!<\/p:pic>).)*<\/p:pic>/g, (m, id) => { const sn = f.name.match(/slide(\d+)/)[1], rf = files.find(x => x.name === `ppt/slides/_rels/slide${sn}.xml.rels`); return rf && rf.data.includes(`Id="rId${id}"`) ? m : ''; }); });
  files.unshift({ name: '[Content_Types].xml', data: `${CT}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${slides.map((_, k) => `<Override PartName="/ppt/slides/slide${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'officeDocument', 'ppt/presentation.xml').replace(RT + '/officeDocument', RT + '/officeDocument')}<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${CT}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${XE(title)}</dc:title><dc:creator>${XE(St.cfg.usuario)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
    { name: 'ppt/presentation.xml', data: `${CT}<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, k) => `<p:sldId id="${256 + k}" r:id="rId${k + 2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${slides.every(s => s.g) ? 9144000 : 12192000}" cy="${slides.every(s => s.g) ? 5143500 : 6858000}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` },
    { name: 'ppt/_rels/presentation.xml.rels', data: `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml')}${slides.map((_, k) => rel('rId' + (k + 2), 'slide', `slides/slide${k + 1}.xml`)).join('')}${rel('rId' + (N + 2), 'theme', 'theme/theme1.xml')}</Relationships>` },
    { name: 'ppt/theme/theme1.xml', data: THEME },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: `${CT}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${GRP}${PH_TITLE}</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="2600" b="1"><a:solidFill><a:srgbClr val="0B2A4A"/></a:solidFill><a:latin typeface="Segoe UI"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>` },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml')}${rel('rId2', 'theme', '../theme/theme1.xml')}</Relationships>` },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: `${CT}<p:sldLayout ${NS} type="titleOnly" preserve="1"><p:cSld name="Título"><p:spTree>${GRP}${PH_TITLE}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: `${CT}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml')}</Relationships>` });
  files.push(...media);
  return files;
}
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
async function pptxBlob(slides, title) { return zipStore(await pptxBytes(slides, title), PPTX_MIME); }

/* ---------- acciones ---------- */
const decksToExport = c => (c.alcance === 'proyecto' && c.multi === 'separados' && c.proys.length > 1 && !c.frozen) ? decksSeparados(c).map(d => ({ name: d.name, slides: d.slides })) : [{ name: '', slides: buildAll(c) }];
Acts.presdl = () => { const c = pcfg(), D = decksToExport(c); if (!D[0].slides.length) { toast('No hay diapositivas', 'err'); return; }
  if (D.length === 1) { downloadBlob('APIH_' + slug(c.titulo) + '_' + hoy() + '.html', new Blob([deckHTMLOf(D[0].slides, c.titulo)], { type: 'text/html;charset=utf-8' })); toast('Presentación descargada (HTML autónomo)'); }
  else { downloadBlob('APIH_presentaciones_' + hoy() + '.zip', zipStore(D.map(d => ({ name: 'APIH_' + d.name + '.html', data: deckHTMLOf(d.slides, c.titulo + ' · ' + d.name) })), 'application/zip')); toast(D.length + ' presentaciones en un .zip'); } };
Acts.prespptx = async () => { const c = pcfg(), D = decksToExport(c); if (!D[0].slides.length) { toast('No hay diapositivas', 'err'); return; } toast('Generando PowerPoint…');
  try { if (D.length === 1) { downloadBlob('APIH_' + slug(c.titulo) + '_' + hoy() + '.pptx', await pptxBlob(D[0].slides, c.titulo)); toast('PowerPoint (.pptx) descargado'); }
    else { const fs = []; for (const d of D) { const b = await pptxBlob(d.slides, c.titulo + ' · ' + d.name); fs.push({ name: 'APIH_' + d.name + '.pptx', data: new Uint8Array(await b.arrayBuffer()) }); } downloadBlob('APIH_presentaciones_' + hoy() + '.zip', zipStore(fs, 'application/zip')); toast(D.length + ' presentaciones (.pptx) en un .zip'); } }
  catch (e) { console.error(e); toast('No se pudo generar el PPTX: ' + e.message, 'err'); } };
Acts.phdl = async d => { const sn = St.psnap[d.id], p = St.pres.find(x => x.id === d.id); if (!sn) return; const sl = numberDeck(thawSlides(sn.slides));
  if (d.f === 'html') downloadBlob('APIH_' + slug(p.nombre) + '.html', new Blob([deckHTMLOf(sl, p.nombre)], { type: 'text/html;charset=utf-8' })); else { toast('Generando PowerPoint…'); downloadBlob('APIH_' + slug(p.nombre) + '.pptx', await pptxBlob(sl, p.nombre)); } };
Acts.presprint = () => { const p = $('#printdeck'), D = decksToExport(pcfg()); p.innerHTML = D.flatMap(d => d.slides).map(slideHTML).join(''); const clean = () => { p.innerHTML = ''; window.removeEventListener('afterprint', clean); }; window.addEventListener('afterprint', clean); setTimeout(() => window.print(), 80); };
Acts.present = () => { const st = $('#deckstage'); if (!st) return; UI.presenting = true; (st.requestFullscreen || st.webkitRequestFullscreen || (() => { toast('Pantalla completa no disponible', 'err'); })).call(st); };
document.addEventListener('fullscreenchange', () => { UI.presenting = !!document.fullscreenElement; if (UI.view === 'presentaciones') render(); });
document.addEventListener('keydown', e => { if (UI.view !== 'presentaciones' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || $('#modal')) return; if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); Acts.pnav({ d: 1 }); } if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); Acts.pnav({ d: -1 }); } });

/* ==========================================================================
   APIH V6 · Guía de pantalla: "el camino para operarla"
   Cada vista declara 3–5 pasos en GUIA (texto + dónde está el control). La franja se
   muestra bajo las migas de pan, es plegable y recuerda el estado en memoria.
   Para sumar una pantalla nueva basta agregar su clave aquí (si falta, no se rompe nada).
   ========================================================================== */
export const GUIA = {
  dashboard: { t: 'Dashboard', p: [
    ['Elige el alcance', 'Selector «Área» de la barra superior: todo el sistema se recalcula para esa área.'],
    ['Lee los indicadores', 'Las tarjetas superiores resumen proyectos activos, propuestas, atrasos, riesgos y presupuesto.'],
    ['Entra al detalle', 'Haz clic en cualquier proyecto o alerta: se abre el panel contextual a la derecha.'],
    ['Actúa', 'Desde el panel edita, comenta o ve a Hitos, Riesgos o Decisiones.']] },
  portfolio: { t: 'Portfolio', p: [
    ['Filtra', 'Usa búsqueda y selectores sobre la tabla (área, fase, estado, RAG).'],
    ['Ordena', 'Clic en el encabezado de una columna para ordenar.'],
    ['Abre una iniciativa', 'Clic en una fila: ficha completa en el panel derecho.'],
    ['Exporta', 'Botones CSV / Excel / JSON para llevarte la vista filtrada.'],
    ['Stand By', 'Es la única pantalla que muestra lo que está en «Stand By»: fuera de indicadores, avisos y presentación. Para reactivarlo, abre la ficha y pulsa «Reactivar».']] },
  proyectos: { t: 'Proyectos', p: [
    ['Busca o filtra', 'Barra superior de la lista: texto, área, fase, estado.'],
    ['Abre el proyecto', 'Clic en la fila: ficha con resumen, hitos, riesgos y bitácora.'],
    ['Actualiza', 'Botón Editar en el panel: avance, RAG, fechas y próximos pasos.'],
    ['Preséntalo', 'Botón «Presentar» del panel: genera la Ficha individual.']] },
  propuestas: { t: 'Propuestas', p: [
    ['Crea la propuesta', '«Nueva propuesta»: problema, beneficio esperado y área.'],
    ['Avanza de fase', 'Recepción → Evaluación → Caso de Negocio → Aprobación; cada fase exige sus compuertas.'],
    ['Decide', 'Al aprobar se crea el proyecto (PRJ-###) automáticamente.'],
    ['Alta directa', 'Para iniciativas ya aprobadas fuera del pipeline: «Alta directa».']] },
  roadmap: { t: 'Roadmap', p: [
    ['Mira el horizonte', 'Ventana móvil de 4 trimestres según fecha de fin proyectada.'],
    ['Desplaza', 'Botones de flecha y «Hoy» para mover la ventana.'],
    ['Abre un proyecto', 'Clic en su barra para ver el detalle.'],
    ['Exporta', '«Exportar CSV» con las entregas por trimestre.']] },
  fases: { t: 'Fases', p: [
    ['Elige la mirada', 'Gantt por fases, Línea de fases (con compuerta), Tablero o Riesgos en el tiempo.'],
    ['Despliega', 'En el Gantt, la flecha abre cada iniciativa en sus fases con hitos y revisiones de riesgo.'],
    ['Ventana de fase', 'Va del día siguiente al cierre de la fase anterior hasta su último hito.']] },
  gantt: { t: 'Gantt', p: [
    ['Ubica el cronograma', '«Ir a hoy» centra la línea de tiempo en la fecha actual.'],
    ['Lee las barras', 'Color = RAG; la parte rellena es el avance real.'],
    ['Abre el detalle', 'Clic en la barra o el nombre del proyecto.']] },
  riesgos: { t: 'Riesgos', p: [
    ['Registra', '«Nuevo riesgo»: proyecto, probabilidad e impacto (1–5), dueño y mitigación.'],
    ['Lee la matriz', 'La matriz 5×5 muestra la exposición = probabilidad × impacto.'],
    ['Filtra la lista', 'Por proyecto, estado o severidad sobre la tabla.'],
    ['Cierra o revisa', 'Clic en un riesgo para actualizar estado y fecha de revisión.']] },
  hitos: { t: 'Hitos', p: [
    ['Filtra', 'Busca y filtra por proyecto o responsable; el botón «Limpiar» restablece.'],
    ['Entiende el color', 'Verde completado · Azul en plazo · Ámbar ≤ 7 días · Rojo vencido.'],
    ['Marca avance', 'Casilla de la primera columna = completado (usa fecha de hoy).'],
    ['Crea o edita', '«Nuevo hito» o clic en la fila para editar.']] },
  comite: { t: 'Comité', p: [
    ['Elige la sesión', 'Lista de sesiones a la izquierda, o «Nuevo comité».'],
    ['Prepara la agenda', 'Participantes, decisiones sugeridas y mensaje principal del ciclo.'],
    ['Registra acuerdos', 'Acciones y compromisos con responsable y fecha límite.'],
    ['Cierra', '«Acta» exporta el resumen; al marcar Realizado la sesión pasa a ser el corte de la presentación.']] },
  decisiones: { t: 'Decisiones', p: [
    ['Registra', '«Nueva decisión»: iniciativa, tipo, fecha límite y quién la solicita.'],
    ['Resuelve', 'Botón «Resolver»: aprobar o rechazar con la resolución escrita.'],
    ['Aplica el efecto', 'Al aprobar puedes aplicar el cambio (pausar, cancelar, etc.) sobre el proyecto.']] },
  bitacora: { t: 'Bitácora', p: [
    ['Revisa la actividad', 'Feed cronológico de cambios, comentarios, riesgos y decisiones.'],
    ['Filtra', 'Por tipo y proyecto sobre el feed.'],
    ['Comenta', 'Los comentarios por proyecto se escriben en su panel; aquí se listan.'],
    ['Exporta', '«Exportar CSV» de la bitácora.']] },
  capacidad: { t: 'Capacidad de equipos', p: [
    ['Lee el mapa', 'Cada celda es la carga del líder en ese mes: proyectos vivos que lidera / su capacidad. Verde bajo 80%, ámbar hasta 100%, rojo sobre 100%.'],
    ['Ve qué la explica', 'Clic en una persona o en una celda para desplegar sus proyectos y fechas.'],
    ['Ajusta la capacidad', 'Administra puede cambiar la capacidad de cada persona (por ejemplo media jornada); el valor general está en Administración › Parámetros.']] },
  calendario: { t: 'Calendario', p: [
    ['Navega el mes', 'Flechas y «Hoy»; clic en un día para ver sus eventos a la derecha.'],
    ['Elige qué ver', 'Casillas de tipo (Hito, Comité, Entrega, Vencimiento, Ciclo, Otro).'],
    ['Filtra', 'Barra de filtros (Área, Responsable, «Solo lo mío») más el selector de Proyecto.'],
    ['Abre o crea', 'Clic en un evento para abrir su origen; «Nuevo evento» agrega uno propio.']] },
  presentaciones: { t: 'Presentaciones', p: [
    ['Define el alcance', 'Portafolio completo o un proyecto/propuesta (columna Configuración).'],
    ['Decide qué entra', 'Pestaña «Qué entra»: marca o desmarca láminas, hitos, riesgos y textos.'],
    ['Ajusta el estilo', 'Pestaña «Estilo»: preset, colores, tipografía y escala.'],
    ['Revisa y exporta', 'Vista previa + notas; Pantalla completa, PDF, HTML o PowerPoint (.pptx).'],
    ['Guarda', 'Plantillas por área y Historial (copia congelada del ciclo).']] },
  personas: { t: 'Personas y roles', p: [
    ['Busca', 'Por nombre o cargo, o filtra por rol (líder, sponsor, dueño de riesgo…).'],
    ['Entiende el rol', 'Acceso = permisos en el sistema; «Roles en el portafolio» = lo que hace en iniciativas, hitos y riesgos.'],
    ['Mide la carga', 'Columnas de proyectos activos, hitos abiertos (vencidos entre paréntesis), riesgos y decisiones.'],
    ['Ve lo suyo', '«Ver lo suyo» filtra por esa persona; «Ver como» (solo administrador) simula su sesión.']] },
  admin: { t: 'Administración', p: [
    ['Elige la pestaña', 'Parámetros, catálogos, usuarios, calidad de datos, conexión y respaldo.'],
    ['Conecta datos', 'Conexión: «Probar conexión» → «Sincronizar ahora». Las tablas y reglas se crean con las migraciones de db/azure-sql/.'],
    ['Cuida la calidad', 'La auditoría lista campos faltantes; corrígelos desde cada ficha.'],
    ['Respalda', '«Respaldo JSON» antes de cambios grandes; «Importar respaldo» restaura.']] },
  cielo: { t: 'Mi cocina', p: [
    ['Lee tus tenedores', 'Cada proyecto activo muestra sus 5 tenedores de la semana, de lunes a domingo.'],
    ['Enciende los apagados', 'Toca (o pasa el mouse sobre) un tenedor apagado para ver cómo ganarlo.'],
    ['Actualiza', '«Ronda de actualización» te lleva proyecto por proyecto para dejarlos al día.'],
    ['Ordena tu semana', 'Tus siguientes pasos van por importancia (0–100: plazo y criticidad). Ajusta la importancia de un paso una sola vez: queda guardada en tu perfil. Filtra por un proyecto o mira todos juntos.'],
    ['Revisa qué cambió', 'Si desde tu última visita algo venció, te asignaron un compromiso o alguien tocó tus proyectos, aparece al inicio. «Entendido» lo despeja hasta la próxima vez.'],
    ['Arma tu reporte', '«Borrador del reporte semanal» junta el informe de estado de tus proyectos (o del que filtraste) y los hitos cumplidos de los últimos 7 días, listo para copiar.'],
    ['Mira tu historial', 'La pestaña «Mi historial» junta tus proyectos, hitos y compromisos cumplidos y tu desarrollo profesional. «Copiar resumen» o «Descargar» lo exporta para tu evaluación o fin de año.'],
    ['Agrega tus pendientes', '«Agregar pendiente» suma tareas propias (trabajo, desarrollo profesional, personal). Viven aparte del portafolio: no cuentan para tenedores ni salen en reportes.'],
    ['Revisa tus logros', 'Pestañas Insignias y Galería Michelin: lo obtenido y lo que falta. Las reglas están en «?» → «Reglas del juego».']] },
  compromisos: { t: 'Compromisos', p: [
    ['Lee qué debes y qué te deben', 'Incluye los acuerdos de reuniones y las acciones de comité.'],
    ['Empieza por lo vencido', 'Los compromisos vencidos aparecen primero.'],
    ['Cumple o registra', 'Marca como cumplido lo hecho; crea un compromiso nuevo con responsable y fecha.']] },
  cambios: { t: 'Control de cambios', p: [
    ['Registra el cambio', 'Todo cambio de alcance, fecha o presupuesto debe quedar registrado con su motivo.'],
    ['Resuelve', 'Solo el sponsor, el administrador o Administra aprueban o rechazan.'],
    ['Mira el efecto', 'Cada cambio aprobado deja constancia de quién lo aprobó y cómo movió la línea base.']] },
  miconfig: { t: 'Mi configuración', p: [
    ['Ajusta los umbrales de alerta', 'Define desde cuándo un hito, riesgo o compromiso te genera una alerta.'],
    ['Configura tus presentaciones', 'Preferencias que se aplican al armar presentaciones.'],
    ['Define el menú por rol', 'Qué secciones ve cada rol en el menú lateral.']] },
  ficha: { t: 'la ficha de la iniciativa', p: [
    ['Lee la ficha completa', 'Toda la información de la iniciativa en una sola página.'],
    ['Oculta lo que no necesites', 'El ojito oculta una sección; la flecha solo la contrae.'],
    ['Comenta', '«Comentar» deja una observación para quien tenga acceso a esa área.'],
    ['Edita', 'Cada sección tiene su propio botón de edición; el cambio queda en la bitácora.'],
    ['Genera el reporte', 'Botón «Reporte 1 a 1»: infografía de avance en Forma A (una fase) o B (fases paralelas); se elige sola y puedes forzarla, copiarla, descargarla en HTML o guardarla como PNG o PDF.']] },
  proposito: { t: 'Para qué sirve', p: [
    ['Lee el propósito', 'Qué resuelve APIH para el portafolio de iniciativas TI.'],
    ['Revisa el modelo de gobierno', 'Cómo se mueve una iniciativa: propuesta, compuertas, fases y comité.'],
    ['Haz el recorrido', 'El «?» de cada pantalla ofrece «Ver recorrido» para conocer el sistema paso a paso.']] },
  analisis: { t: 'Análisis del portafolio', p: [
    ['Lee los hallazgos', 'Reglas fijas sobre tus datos; la severidad 3 es crítica.'],
    ['Abre el caso', 'Clic en un hallazgo para ir al proyecto afectado.'],
    ['Usa el resumen', '«Copiar» o «A presentación» llevan el mensaje ejecutivo a donde lo necesites.']] }
};
Object.keys(GUIA).forEach(k => { if (!['admin', 'calendario', 'miconfig', 'ficha', 'proposito'].includes(k)) GUIA[k].p.push(['Acota lo que ves', 'Barra de filtros: Área, Responsable o «Solo lo mío» (valen para todas las pantallas).']); });
UI.guiaOpen = UI.guiaOpen || {};          // por pantalla; arranca cerrada
function guiaHTML() {
  const g = GUIA[UI.view]; if (!g) return '';
  if (!UI.guiaOpen[UI.view]) return '';   /* único acceso: «?» → «Cómo operar esta pantalla» */
  return `<section class="guia" aria-label="Cómo operar ${esc(g.t)}"><header><b>${icon('help', 15)} Cómo operar ${esc(g.t)}</b><button class="lnk" data-act="guia" data-m="off" aria-expanded="true">Cerrar</button></header>
    <ol>${g.p.map(([t, d]) => `<li><b>${esc(t)}</b><small>${esc(d)}</small></li>`).join('')}</ol></section>`;
}
Acts.guia = d => { if (d.m === 'on') UI.guiaOpen[UI.view] = 1; else delete UI.guiaOpen[UI.view]; render(); };

Acts.dtab = d => { UI.dtab = d.k; render(); };

/* ==========================================================================
   APIH V11 · «Para qué sirve»: propósito, valor y modelo de gobierno, en lenguaje de gestión
   de proyectos y de negocio. Una pantalla corta, sin scroll, accesible a todos los roles.
   ========================================================================== */
const PROP_PREG = [
  ['¿Entregamos lo comprometido?', 'Avance, salud y atrasos', 'dashboard'],
  ['¿Dónde está el presupuesto?', 'Plan versus gasto', 'portfolio'],
  ['¿Qué demanda conviene aprobar?', 'Pipeline con compuertas', 'propuestas'],
  ['¿Qué está en riesgo?', 'Riesgos e hitos vencidos', 'riesgos'],
  ['¿Qué se decidió y quién responde?', 'Decisiones, acuerdos, bitácora', 'decisiones'],
  ['¿Cómo informo a la dirección?', 'Presentaciones de comité', 'presentaciones']
];
const PROP_CICLO = [['Demanda', 'Necesidad del negocio · Iniciativas › Propuestas'], ['Evaluación', 'Caso de negocio · Iniciativas › Propuestas'], ['Aprobación', 'Decisión del comité · Gobierno'], ['Ejecución', 'Hitos y presupuesto · Planificación'], ['Seguimiento', 'Riesgos y atrasos · Planificación'], ['Cierre', 'Beneficios logrados · Iniciativas › Tabla']];
const PROP_ROLES = [['Dirección y patrocinadores', 'Ven el estado del portafolio y toman decisiones de inversión y prioridad.'], ['PMO / IT Business Partner', 'Gobierna el pipeline, prepara el comité y asegura la calidad de la información.'], ['Líderes de proyecto', 'Reportan avance, hitos y riesgos de lo que ejecutan, en un solo lugar.'], ['Áreas de negocio', 'Siguen el estado de sus solicitudes y el compromiso de entrega.']];

Views.proposito = {
  render() {
    return pageHead('Para qué sirve APIH', 'Plataforma de gobierno del portafolio de iniciativas TI de Aramark Chile.') + `
    <div class="prop-wrap">
    <section class="card prop-hero"><p><b>Propósito.</b> Asegurar que la inversión en TI vaya a las iniciativas de mayor valor para el negocio, se entregue en plazo y presupuesto, y cada decisión quede respaldada. Convierte la demanda de las áreas en un <b>pipeline priorizado</b> y da a la dirección <b>una sola fuente de verdad</b> sobre avance, costo y riesgo.</p></section>
    <section class="card prop-ciclo"><header><h2>Ciclo de gobierno del portafolio</h2><small>Cada etapa tiene su pantalla en APIH</small></header><ol>${PROP_CICLO.map(([t, d], i) => `<li><span class="n">${i + 1}</span><b>${t}</b><small>${d}</small></li>`).join('')}</ol></section>
    <div class="prop-cols">
      <section class="card"><header><h2>Qué resuelve</h2></header><ul class="prop-l">
        <li><b>Visibilidad ejecutiva.</b> Estado del portafolio (verde, ámbar, rojo), avance real y desviaciones, sin armar planillas.</li>
        <li><b>Priorización con criterio.</b> Toda propuesta pasa por compuertas de decisión antes de convertirse en proyecto.</li>
        <li><b>Gobierno y trazabilidad.</b> El comité decide (iniciar, acelerar, mantener, pausar, cancelar) con responsable y fecha; la bitácora registra cada cambio.</li>
        <li><b>Control del costo y del riesgo.</b> Plan versus gasto, exposición de riesgos y alertas de hitos vencidos.</li>
      </ul></section>
      <section class="card"><header><h2>Preguntas que responde</h2></header><div class="prop-q">${PROP_PREG.map(([q, d, v]) => `<button class="row" data-act="go" data-v="${v}"><span><b>${q}</b><small>${d}</small></span>${icon('chev', 14)}</button>`).join('')}</div></section>
      <section class="card"><header><h2>Quién lo usa</h2></header><ul class="prop-l">${PROP_ROLES.map(([r, d]) => `<li><b>${r}.</b> ${d}</li>`).join('')}</ul></section>
    </div>
    </div>`;
  }
};

NAV.push(['ficha', 'Ficha', 'list']); NAV_GRP.ficha = 'Sistema';
/* ============================================================
   APIH · V22 · Guía de acciones, ficha larga, comentarios por área, login individual
   ------------------------------------------------------------
   1. Ficha larga (proyecto y propuesta): una sola página, secciones colapsables con «ojito».
   2. Guía: una acción principal por pantalla, ayuda contextual y recorrido de primera vez.
   3. Estados vacíos que enseñan (ícono, título, una línea, botón con el verbo esperado).
   4. Skeleton de carga (en lugar del spinner genérico).
   5. Simple y Profesional: mismo esqueleto, orden, colores e íconos; cambia solo la densidad. Siempre parte en Simple.
   6. Comentarios de colaboradores por área (los ve quien tiene acceso al área; Administra/Responsable los marca «abordado»).
   7. Acceso según el ambiente (01t-transporte.js y 10b-acceso.js).
   ============================================================ */

// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  TEMA: { get: () => TEMA, enumerable: true, configurable: true },
  guiaHTML: { get: () => guiaHTML, enumerable: true, configurable: true },
  inc: { get: () => inc, enumerable: true, configurable: true },
  incChk: { get: () => incChk, enumerable: true, configurable: true },
  incMarks: { get: () => incMarks, enumerable: true, configurable: true },
  incT: { get: () => incT, enumerable: true, configurable: true },
  presLayout: { get: () => presLayout, set: v => { presLayout = v; }, enumerable: true, configurable: true },
  withArea: { get: () => withArea, enumerable: true, configurable: true },
});
