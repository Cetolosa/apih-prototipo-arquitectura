import { ENLACES } from './00-registro.js';
/* =====================================================================
   APIH · Aramark Portfolio Intelligence Hub
   ---------------------------------------------------------------------
   ARQUITECTURA (capas, de abajo hacia arriba)
     Dominio .................. 01-nucleo.js     (modelo, reglas, cálculos)
     Servicio de datos ........ 02-datos.js      (DataService: carga, diff, sincronización) + 01t-transporte.js (servidor y acceso del ambiente)
     SPA ...................... 03 … 11          (interfaz, vistas, administración, gobierno, presentaciones)

   PERSISTENCIA: el servidor del ambiente (01t-transporte.js), con autorización en el servidor. No se usa localStorage para datos.
   Sin configuración del servidor la app queda en solo lectura y vacía: todas las reglas y datos viven en el servidor.

   CONFIGURACIÓN: apih-config.js define window.APIH_OVERRIDE = { auth, api | supabase } (sin recompilar).
   ===================================================================== */
export const APIH_CONFIG = {
  /* Nombres de las listas lógicas (valor de la columna `lista` en la tabla registros) */
  projectsList: 'APIH_Proyectos',          // solo proyectos (V5)
  proposalsList: 'APIH_Propuestas',        // solo propuestas (V5)
  risksList: 'APIH_Riesgos',
  milestonesList: 'APIH_Hitos',
  decisionsList: 'APIH_Decisiones',
  commitmentsList: 'APIH_Compromisos',   // compromisos / acuerdos de reuniones
  changesList: 'APIH_Cambios',           // control de cambios (alcance, fecha, presupuesto)
  notesList: 'APIH_Notas',               // V22: comentarios de colaboradores por área
  docsList: 'APIH_Documentos',           // V22: documentación de proyectos (enlaces)
  auditList: 'APIH_Bitacora',
  committeesList: 'APIH_Comites',     // extensión V4: actas de comité
  rolesList: 'APIH_Roles',            // roles y usuarios (solo Administra puede escribirla)
  settingsList: 'APIH_Config',        // extensión V4: parámetros, usuarios, calendario, presentaciones

  /* Autenticación: el proveedor lo interpreta 01t-transporte.js ('entra', 'dev', 'supabase'…); 'none' = modo demo */
  auth: { provider: 'none', tenantId: '', clientId: '', scope: '', devToken: '' },

  /* Servidor del ambiente: API de APIH (URL base; vacío = mismo origen) o proyecto Supabase (URL y clave pública). */
  api: { url: '' },
  supabase: { url: '', anonKey: '' },
  analisis: true,                     // false = oculta toda la sección Análisis (reglas automáticas)

  pollSec: 120                   // refresco automático desde el servidor (0 = desactivado)
};

/* Sobrescritura externa opcional: un archivo apih-config.js puede definir window.APIH_OVERRIDE = {…} (sin recompilar la app) */
(function () { const o = window.APIH_OVERRIDE; if (!o) return; const mg = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = a[k] || {}; mg(a[k], b[k]); } else a[k] = b[k]; } }; mg(APIH_CONFIG, o); })();

/* Logotipos corporativos (PNG embebidos; archivos entregados por el usuario) */
export const LOGO = {"arBR": "img/ar-br.png", "arC": "img/ar-c.png", "bwdw": "img/bwdw.png"};


/* ============================================================
   APIH · Core: utilidades, fechas, estado, cálculos de dominio
   ============================================================ */
'use strict';
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
/* ---- Defensa en profundidad contra XSS ----
   Todo HTML que entra por innerHTML / outerHTML / insertAdjacentHTML pasa por este filtro: si contiene algo peligroso
   (<script>, <iframe>, atributos on*, javascript:, srcdoc…) se parsea en un <template> inerte y se limpia antes de insertarlo.
   Así un dato malicioso guardado en la base (por ejemplo un ID con «"><img onerror=…>») no puede ejecutar código. HTML normal: sin costo. */
(function () {
  const RISK = /<\s*(script|iframe|object|embed|base|meta|link|frame|frameset|applet)\b|\son[a-z]+\s*=|javascript\s*:|vbscript\s*:|srcdoc\s*=|formaction\s*=|data\s*:\s*text|data\s*:\s*application/i;
  const BAD = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'BASE', 'META', 'LINK', 'FRAME', 'FRAMESET', 'APPLET']);
  const URLA = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'data']);
  window.limpiarHTML = function (html) {
    html = String(html == null ? '' : html); if (!html.includes('<')) return html;   // S-07: sin atajo por regex (evadible con /onerror= o &#106;avascript:)
    const t = document.createElement('template'); dI.set.call(t, html);   // setter original: sin pasar otra vez por el filtro
    t.content.querySelectorAll('*').forEach(el => {
      if (BAD.has(el.tagName.toUpperCase())) { el.remove(); return; }
      [...el.attributes].forEach(a => {
        const n = a.name.toLowerCase(), v = a.value.replace(/[\s\u0000-\u001f]/g, '').toLowerCase();
        if (n.startsWith('on') || n === 'srcdoc' || (URLA.has(n) && /^(javascript|vbscript|data:text|data:application)/.test(v))) el.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  };
  /* V11 · CSP sin 'unsafe-inline' en atributos: el HTML generado no lleva style="…"; cada estilo viaja como data-css y se
     aplica por CSSOM (el.style.cssText), que la CSP no bloquea. Solo pasa por aquí HTML ya filtrado por limpiarHTML. */
  const ATTR = /(<[a-zA-Z][^<>]*?\s)style\s*=\s*"/g, sinEstilo = h => (h.includes('style') ? h.replace(ATTR, '$1data-css="') : h);
  const aplicar = r => { if (r && r.querySelectorAll) r.querySelectorAll('[data-css]').forEach(el => { el.style.cssText = el.getAttribute('data-css'); el.removeAttribute('data-css'); }); };
  window.aplicarEstilos = aplicar;
  // nodos que llegan al documento por otra vía (contenido de <template>, appendChild de fragmentos): se aplican al insertarse
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.hasAttribute('data-css')) { n.style.cssText = n.getAttribute('data-css'); n.removeAttribute('data-css'); } aplicar(n); }))).observe(document.documentElement, { childList: true, subtree: true });
  const dI = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'), dO = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML'), insHTML = Element.prototype.insertAdjacentHTML;
  Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, enumerable: dI.enumerable, get: dI.get, set(v) { dI.set.call(this, window.limpiarHTML(sinEstilo(v))); if (!this.content) aplicar(this); } });   // en <template> el estilo queda en data-css hasta que el nodo entra al documento
  Object.defineProperty(Element.prototype, 'outerHTML', { configurable: true, enumerable: dO.enumerable, get: dO.get, set(v) { const pa = this.parentNode; dO.set.call(this, window.limpiarHTML(sinEstilo(v))); aplicar(pa); } });
  Element.prototype.insertAdjacentHTML = function (pos, html) { const r = insHTML.call(this, pos, window.limpiarHTML(sinEstilo(html))); aplicar(/^(beforebegin|afterend)$/i.test(pos) ? this.parentNode : this); return r; };
})();
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = p => p + '-' + Math.random().toString(36).slice(2, 8);
export const clone = o => JSON.parse(JSON.stringify(o));
export const sum = (a, f = x => x) => a.reduce((s, x) => s + (+f(x) || 0), 0);
export const avg = (a, f = x => x) => a.length ? sum(a, f) / a.length : 0;
export const uniq = a => [...new Set(a)];
export const by = (k, dir = 1) => (a, b) => { const x = typeof k === 'function' ? k(a) : a[k], y = typeof k === 'function' ? k(b) : b[k]; return (x == null) - (y == null) || (x > y ? dir : x < y ? -dir : 0); };

/* ---------- fechas ---------- */
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MES3 = MESES.map(m => m.slice(0, 3));
export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const pad = n => String(n).padStart(2, '0');
export const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const pD = s => { if (!s) return null; const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addD = (s, n) => { const d = pD(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffD = (a, b) => Math.round((pD(a) - pD(b)) / 864e5);   // a - b en días
export const fmtD = s => { if (!s) return '—'; const d = pD(s); return pad(d.getDate()) + ' ' + MES3[d.getMonth()].toLowerCase() + ' ' + String(d.getFullYear()).slice(2); };
export const fmtDL = s => { if (!s) return '—'; const d = pD(s); return d.getDate() + ' de ' + MESES[d.getMonth()].toLowerCase() + ' de ' + d.getFullYear(); };
export const fmtTS = s => { if (!s) return ''; return fmtD(s.slice(0, 10)) + (s.length > 10 ? ' · ' + s.slice(11, 16) : ''); };
export const quarter = s => Math.floor(pD(s).getMonth() / 3) + 1;
export const hoy = () => (St && St.cfg.hoyFija) || (typeof CALC !== 'undefined' && CALC.hoy) || toISO(new Date());   // la fecha de hoy la fija el servidor (zona horaria de Chile)
export const rel = s => { if (!s) return ''; const d = diffD(s, hoy()); return d === 0 ? 'hoy' : d === 1 ? 'mañana' : d === -1 ? 'ayer' : d > 0 ? 'en ' + d + ' d' : 'hace ' + (-d) + ' d'; };

/* ---------- formato ---------- */
const nf = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
export const fmtN = n => nf.format(Math.round(n || 0));
const fmtM = n => fmtN(n) + ' ' + (St ? St.cfg.unidad.replace('MM ', 'MM ') : 'MM');   // ej. 433 MM CLP
const fmtMs = n => fmtN(n) + ' MM';
export const MONEDAS = { CLP: { u: 'MM CLP', big: 'MM', n: 'CLP · millones' }, USD: { u: 'K USD', big: 'K USD', n: 'USD · miles' }, UF: { u: 'UF', big: 'UF', n: 'UF · unidades' } };
export const monOf = i => (i && MONEDAS[i.moneda]) ? i.moneda : 'CLP';
export const fmtMon = (n, m) => fmtN(n) + ' ' + MONEDAS[m || 'CLP'].u;
export const sumM = (L, f) => { const o = {}; L.forEach(i => { const v = +f(i) || 0; if (!v) return; const m = monOf(i); o[m] = (o[m] || 0) + v; }); return o; };
export const monKeys = o => ['CLP', 'USD', 'UF'].filter(k => o && o[k]);
export const monMain = o => monKeys(o)[0] || 'CLP';
export const fmtTot = (o, sep) => monKeys(o).map(k => fmtMon(o[k], k)).join(sep || ' · ') || fmtMon(0, 'CLP');
/* ROI = (beneficio − costo) / costo; solo si ambos están en una única moneda comparable; si no, «—» */
export const roiTxt = (b, p) => { const kp = Object.keys(p || {}), kb = Object.keys(b || {}); if (!kp.length || kp.length > 1 || kb.length > 1 || (kb.length && kb[0] !== kp[0]) || !p[kp[0]]) return '—'; const v = ((b[kp[0]] || 0) - p[kp[0]]) / p[kp[0]] * 100; return isFinite(v) ? Math.round(v) + '%' : '—'; };   // V-19: nunca NaN
export const fmtBig = o => { const m = monMain(o); return fmtN((o && o[m]) || 0) + ' ' + MONEDAS[m].big; };
export const restTxt = o => monKeys(o).length > 1 ? '+ ' + monKeys(o).slice(1).map(k => fmtMon(o[k], k)).join(' + ') + ' · ' : '';
export const pctMon = (g, p) => { const m = monMain(p); return p && p[m] ? Math.round(((g && g[m]) || 0) / p[m] * 100) : 0; };
export const pct = n => Math.round(n || 0) + '%';
const initials = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const COLORS = ['#2a78d6', '#6250d6', '#0f7b8a', '#8a5cc2', '#4a6fa5', '#7a4f9a', '#2b8a9e', '#5a6b7d'];
const COLORS_D = ['#3987e5', '#9085e9', '#2aa3b5', '#a97fd6', '#6f93c9', '#a07ac0', '#4cb3c4', '#8496a8'];
const colorOf = s => (document.documentElement.dataset.theme === 'dark' ? COLORS_D : COLORS)[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
export const avatar = (n, sz = 24) => `<span class="av" style="--c:${colorOf(n)};width:${sz}px;height:${sz}px;font-size:${Math.round(sz * .42)}px" title="${esc(n)}">${esc(initials(n))}</span>`;

/* ---------- catálogos ---------- */
/* V5: Propuesta y Proyecto son conceptos distintos (campo i.tipo) con fases y estados propios */
export const FASES_PROP = ['Recepción', 'Evaluación', 'Caso de Negocio', 'Aprobación'];
export const FASES_PRJ = ['Planificación', 'Ejecución', 'Transición', 'Cierre'];
export const FASES = [...FASES_PROP, ...FASES_PRJ];
export const FASES_ACT = ['Planificación', 'Ejecución', 'Transición'];
export const FASES_PIPE = FASES_PROP;
export const FASE_COLOR = { 'Recepción': '#8A8886', 'Evaluación': '#8764B8', 'Caso de Negocio': '#4F6BED', 'Aprobación': '#038387', 'Planificación': '#0D446A', 'Ejecución': '#107C10', 'Transición': '#CA5010', 'Cierre': '#605E5C' };
export const ESTADOS_PROP = ['Vigente', 'En espera', 'Stand By', 'Aprobada', 'Rechazada', 'Retirada'];
export const ESTADOS_PRJ = ['En curso', 'Pausado', 'Stand By', 'Completado', 'Cancelado'];
const EST_FINAL = { Propuesta: ['Aprobada', 'Rechazada', 'Retirada'], Proyecto: ['Completado', 'Cancelado'] };
export const EST_MOTIVO = ['En espera', 'Pausado', 'Stand By', 'Rechazada', 'Retirada', 'Cancelado'];     // exigen motivo
export const EST_REVISION = ['En espera', 'Pausado'];                                          // exigen fecha de revisión
export const ESTADOS = [...ESTADOS_PRJ, ...ESTADOS_PROP];
export const EST_C = { 'En curso': '#0D446A', 'Pausado': '#CA5010', 'Completado': '#107C10', 'Cancelado': '#D13438', 'Vigente': '#0D446A', 'En espera': '#CA5010', 'Aprobada': '#107C10', 'Rechazada': '#D13438', 'Retirada': '#8A8886', 'Stand By': '#8A8886', 'Pendiente': '#CA5010', 'Diferida': '#8A8886', 'Programado': '#CA5010', 'Realizado': '#107C10' };
export const esProp = i => !!i && i.tipo === 'Propuesta';
export const tipoLbl = i => esProp(i) ? 'Propuesta' : 'Proyecto';
export const estadosDe = i => esProp(i) ? ESTADOS_PROP : ESTADOS_PRJ;
export const fasesDe = i => esProp(i) ? FASES_PROP : FASES_PRJ;
export const PRIOS = ['Alta', 'Media', 'Baja'];
export const RAGS = ['Verde', 'Ámbar', 'Rojo'];
export const RAG_C = { 'Verde': '#107C10', 'Ámbar': '#F2A100', 'Rojo': '#D13438' };
export const DEC_TIPOS = ['Iniciar', 'Acelerar', 'Mantener', 'Pausar', 'Cancelar'];
export const DEC_ICON = { Iniciar: 'play', Acelerar: 'fast', Mantener: 'pause2', Pausar: 'pause', Cancelar: 'x' };
export const DEC_C = { Iniciar: '#107C10', Acelerar: '#0D446A', Mantener: '#605E5C', Pausar: '#CA5010', Cancelar: '#D13438' };
export const RISK_CATS = ['Técnico', 'Alcance', 'Recursos', 'Proveedor', 'Cronograma', 'Financiero', 'Regulatorio', 'Otro'];
/* V22.56 · categorías de hitos (configurables en St.cfg.hitoCats) */
const HITO_CATS = ['Entregable', 'Gobierno', 'Técnico', 'Proveedor', 'Pago', 'Comunicación', 'Otro'];
export const hitoCats = () => (typeof St !== 'undefined' && St && St.cfg && Array.isArray(St.cfg.hitoCats) && St.cfg.hitoCats.length ? St.cfg.hitoCats : HITO_CATS);
/* V22.56 · Planificación muestra proyectos, propuestas o ambos (preferencia por navegador) */
export const PLAN_TIPOS = [['prj', 'Proyectos'], ['prop', 'Propuestas'], ['all', 'Ambos']];
export const planTipo = () => { if (!ENLACES.UI.planTipo) { try { ENLACES.UI.planTipo = localStorage.getItem('apih_ptipo') || 'all'; } catch (e) { ENLACES.UI.planTipo = 'all'; } if (!PLAN_TIPOS.some(t => t[0] === ENLACES.UI.planTipo)) ENLACES.UI.planTipo = 'all'; } return ENLACES.UI.planTipo; };
export const porTipo = i => { const t = planTipo(); return !i || t === 'all' || (t === 'prop') === esProp(i); };
export const planSeg = () => `<label class="flt"><small>Tipo</small><select data-chg="ptipo" aria-label="Tipo de iniciativa" style="width:118px!important;max-width:118px!important;min-width:0!important">${(0, ENLACES.selOpts)(PLAN_TIPOS.map(([v, t]) => ({ v, t })), planTipo())}</select></label>`;
export const tipoPF = () => ({ prj: 'Proyecto', prop: 'Propuesta', all: 'Todo' })[planTipo()] || 'Todo';
/* Un solo botón «Nuevo» con las tres formas de crear (propuesta, alta directa, carga desde Excel) */
const nuevoMenu = () => { const B = ENLACES.btn, ic = icon;
  return `<span class="popw v22-nuevo"><button class="btn pri v22-main" data-act="pop" data-id="pop-nuevo" aria-haspopup="menu" type="button">${ic('plus', 15)}<span>Nuevo</span>${ic('chevd', 13)}</button><div class="pop v22-pop" id="pop-nuevo" role="menu" style="right:0">${B('Nueva propuesta', 'new', { d: { t: 'prop' }, ic: 'bulb' })}${B('Alta directa de proyecto', 'new', { d: { t: 'prj' }, ic: 'plus' })}${B('Cargar Excel', 'cargaxl', { ic: 'up', title: 'Cargar planificación e hitos desde Excel (con plantilla descargable)' })}</div></span>`; };
/* Encabezado común de Iniciativas (Tabla y Tablero) */
export const iniHead = (rows, extra) => (0, ENLACES.pageHead)('Iniciativas', `${rows.length} iniciativa${rows.length === 1 ? '' : 's'} · ${rows.filter(esProp).length} propuestas · ${rows.filter(i => !esProp(i)).length} proyectos`, `<span class="edit-only">${nuevoMenu()}</span>${extra || ''}`);
export const RISK_ESTADOS = ['Abierto', 'En mitigación', 'Materializado', 'Cerrado'];
export const BIT_TIPOS = ['Cambio', 'Actualización', 'Riesgo', 'Comentario', 'Decisión', 'Edición'];
export const BIT_C = { 'Cambio': '#0D446A', 'Actualización': '#107C10', 'Riesgo': '#D13438', 'Comentario': '#8764B8', 'Decisión': '#CA5010', 'Edición': '#5a6b7d' };
const AREAS_DEF = ['BISE', 'MINERÍA', 'FINANZAS', 'SUPPLY CHAIN', 'Transversal'];
const CATS_DEF = ['Transformación Operacional', 'Innovación', 'Arquitectura', 'Transversal', 'Retail', 'Próximos Desafíos'];

/* ---------- iconos ---------- */
export const IC = {
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 16v-4M12 8h.01',   // N-V-05/V-14: icono faltante
  up: 'M12 19V5M5 12l7-7 7 7',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', portfolio: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  road: 'M4 19l4-14M20 19L16 5M12 6v2M12 12v2M12 18v2', gantt: 'M3 5h10M7 10h12M5 15h9M10 20h10', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5', users: 'M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M21 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
  gavel: 'M14 13l-8.5 8.5M16 16l6-6M8 8l6-6M9 7l8 8M11 5l8 8', book: 'M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4zM8 4v16', cal: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  slides: 'M3 4h18v12H3zM12 16v4M8 20h8', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z', help: 'M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', plus: 'M12 5v14M5 12h14', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5', chev: 'M9 6l6 6-6 6', chevd: 'M6 9l6 6 6-6',
  chevl: 'M15 6l-6 6 6 6', bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4', filter: 'M3 4h18l-7 8v7l-4 2v-9z', down: 'M12 3v12M7 10l5 5 5-5M4 21h16', edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14', play: 'M6 4l14 8-14 8z', fast: 'M4 5l8 7-8 7zM13 5l8 7-8 7z', pause: 'M7 4h3v16H7zM14 4h3v16h-3z', pause2: 'M5 12h14M5 8h14M5 16h14',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  panel: 'M3 4h18v16H3zM15 4v16', menu: 'M3 6h18M3 12h18M3 18h18', copy: 'M8 8h12v12H8zM4 16V4h12', refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5', target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  money: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', trend: 'M3 17l6-6 4 4 8-8M14 7h7v7', user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', db: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', list2: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h16v3H4z', board: 'M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z', undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7', sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4', moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'
};
export const icon = (n, s = 16, extra = '') => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}><path d="${IC[n] || ''}"/></svg>`;

/* ---------- estado centralizado ---------- */
export let St = null;
/* ---------- Metodología parametrizable (Administración → Metodología) ---------- */
export const FASES_FIJAS = ['Recepción', 'Evaluación', 'Caso de Negocio', 'Aprobación', 'Planificación', 'Ejecución', 'Cierre'];
const FASE_PALETA = ['#C239B3', '#E3008C', '#00B7C3', '#986F0B', '#6B69D6', '#498205', '#B146C2', '#0078D4'];
export const METODO_DEF = () => {
  const P = (n, fase, dias) => ({ n, fase, dias });
  const prop = [P('Necesidad registrada y clasificada', 'Recepción', 3), P('Evaluación de valor y esfuerzo', 'Evaluación', 14), P('Business case entregado', 'Caso de Negocio', 30), P('Presentación a comité', 'Aprobación', 45)];
  const mk = (id, nombre, desc, extraProp, prj) => ({ id, nombre, desc, hitos: [...prop.slice(0, 2), ...extraProp, ...prop.slice(2), ...prj] });
  return {
    fasesProp: ['Recepción', 'Evaluación', 'Caso de Negocio', 'Aprobación'],
    fasesPrj: ['Planificación', 'Ejecución', 'Transición', 'Cierre'],
    tipos: [
      mk('T1', 'Desarrollo de software', 'Aplicaciones, integraciones y automatizaciones a medida', [], [P('Kick-off y alcance acordado', 'Planificación', 7), P('Plan de proyecto aprobado', 'Planificación', 21), P('Diseño aprobado', 'Ejecución', 50), P('Desarrollo completado', 'Ejecución', 110), P('Pruebas UAT aprobadas', 'Ejecución', 130), P('Capacitación a usuarios', 'Transición', 140), P('Puesta en producción (go-live)', 'Transición', 150), P('Cierre formal y lecciones aprendidas', 'Cierre', 170)]),
      mk('T2', 'Infraestructura y plataformas', 'Redes, nube, servidores, migraciones', [], [P('Kick-off y levantamiento', 'Planificación', 7), P('Diseño de arquitectura aprobado', 'Planificación', 25), P('Ambiente de pruebas listo', 'Ejecución', 60), P('Migración / despliegue piloto', 'Ejecución', 100), P('Pruebas de continuidad y seguridad', 'Ejecución', 120), P('Traspaso a operación', 'Transición', 140), P('Cierre formal', 'Cierre', 160)]),
      mk('T3', 'Contratación de proveedor', 'Compra de solución o servicio externo', [P('RFI / cotizaciones recibidas', 'Caso de Negocio', 20)], [P('Bases y términos de referencia', 'Planificación', 10), P('Evaluación de ofertas', 'Planificación', 35), P('Contrato firmado', 'Ejecución', 55), P('Implementación del proveedor', 'Ejecución', 120), P('Aceptación del servicio', 'Transición', 140), P('Cierre y evaluación del proveedor', 'Cierre', 160)]),
      mk('T4', 'Datos y analítica (BI)', 'Reportes, modelos de datos, dashboards', [], [P('Fuentes y definiciones acordadas', 'Planificación', 10), P('Modelo de datos validado', 'Ejecución', 40), P('Primer reporte / dashboard', 'Ejecución', 70), P('Validación con el negocio', 'Ejecución', 90), P('Publicación y capacitación', 'Transición', 105), P('Cierre y traspaso a soporte', 'Cierre', 120)]),
      mk('T5', 'Mejora de proceso y cambio', 'Rediseño de procesos y gestión del cambio', [], [P('Proceso actual (AS-IS) levantado', 'Planificación', 10), P('Proceso objetivo (TO-BE) aprobado', 'Planificación', 30), P('Plan de gestión del cambio', 'Planificación', 35), P('Piloto en operación', 'Ejecución', 80), P('Despliegue general', 'Ejecución', 120), P('Medición de beneficios', 'Transición', 150), P('Cierre formal', 'Cierre', 165)]),
      mk('T6', 'Cumplimiento y seguridad', 'Normativa, auditorías, ciberseguridad', [], [P('Brecha identificada y priorizada', 'Planificación', 10), P('Plan de remediación aprobado', 'Planificación', 25), P('Controles implementados', 'Ejecución', 90), P('Evidencia y validación del control', 'Ejecución', 110), P('Aprobación del área responsable', 'Transición', 125), P('Cierre formal', 'Cierre', 140)])
    ]
  };
};
/* aplica la metodología a las listas de fases (se mutan en el lugar: todo el código las usa por referencia) */
export function syncFases() {
  if (St && St.cfg && Array.isArray(St.cfg.areas) && !St.cfg.areas.includes('Transversal')) St.cfg.areas.push('Transversal');   // área común: visible y editable por todos
  if (St) { St.compromisos = St.compromisos || []; St.cambios = St.cambios || []; St.notas = St.notas || []; St.documentos = St.documentos || []; }
  const m = St && St.cfg ? (St.cfg.metodo = St.cfg.metodo || METODO_DEF()) : METODO_DEF();
  const fp = (m.fasesProp && m.fasesProp.length ? m.fasesProp : METODO_DEF().fasesProp), fj = (m.fasesPrj && m.fasesPrj.length ? m.fasesPrj : METODO_DEF().fasesPrj);
  FASES_PROP.splice(0, FASES_PROP.length, ...fp); FASES_PRJ.splice(0, FASES_PRJ.length, ...fj);
  FASES.splice(0, FASES.length, ...FASES_PROP, ...FASES_PRJ);
  FASES_ACT.splice(0, FASES_ACT.length, ...FASES_PRJ.filter(x => x !== 'Cierre'));
  let k = 0; FASES.forEach(f => { if (!FASE_COLOR[f]) FASE_COLOR[f] = FASE_PALETA[k++ % FASE_PALETA.length]; });
}
const tipoDe = n => ((St.cfg.metodo || {}).tipos || []).find(t => t.nombre === n);
export const defaultCfg = () => ({
  metodo: METODO_DEF(), cieloOn: true,
  unidad: 'MM CLP', hoyFija: '', readOnly: false, anio: new Date().getFullYear(),
  areas: [...AREAS_DEF], categorias: [...CATS_DEF], usuario: '', cargo: '',
  reglas: { pmo: true, riesgos: true, ejecutivo: true, roadmap: true }, areaGlobal: 'Todas'   // los parámetros de negocio (umbrales, plazos) vienen del servidor: apih_defaults
});
/* Estado inicial vacío: solo para pintar el armazón mientras el servidor responde. Ningún dato ni usuario vive en el navegador. */
export function seedState() {
  return { v: 3, cfg: defaultCfg(), ini: [], compromisos: [], cambios: [], notas: [], documentos: [], hitos: [], riesgos: [], decisiones: [], comites: [], bitacora: [], ptpl: [], psnap: {}, pres: [], usuarios: [], eventos: [], seq: {} };
}
/* V4: sin localStorage. El estado inicial lo entrega DataService.init() (servidor o demo en memoria). */
export function save() { _ixGen++; ppInval(); try { audit(); } catch (e) { } ENLACES.DataService.commit(); }
export function nextId(prefix, list) {   // F-12: contador monótono; un id eliminado no se reutiliza en esta sesión
  St.seq = St.seq || {};
  const mx = Math.max(0, St.seq[prefix] || 0, ...list.map(x => parseInt(String(x.id).split('-')[1], 10) || 0)), n = mx + 1;
  St.seq[prefix] = n;
  return prefix + '-' + String(n).padStart(3, '0');
}
export const byId = id => St.ini.find(i => i.id === id);
export const nameOf = id => { const i = byId(id); return i ? i.titulo : '—'; };
/* La bitácora la escribe solo el servidor (cada comando deja su anotación); el navegador no registra nada. */

/* ---------- V22.43: Historial por registro (auditoría por diferencias) ----------
   Al guardar se compara cada registro con su foto anterior y se escribe UNA entrada «Edición» por registro con los campos que cambiaron.
   Formato de texto (legible también en la Bitácora): «[Hito «nombre» — ]Campo: antes → después | Campo: antes → después». */
const AUD = {
  ini: { lbl: 'Iniciativa', f: { titulo: 'Nombre', lider: 'Responsable', sponsor: 'Sponsor', negocio: 'Resp. negocio', area: 'Área', categoria: 'Categoría', prioridad: 'Prioridad', rag: 'Salud (RAG)', estado: 'Estado', fase: 'Fase', avance: 'Avance', presupuesto: 'Presupuesto', gastado: 'Consumido', inicioPlan: 'Inicio plan', finPlan: 'Fin plan', finEst: 'Fin estimado', moneda: 'Moneda' }, nom: r => r.titulo },
  hito: { lbl: 'Hito', f: { nombre: 'Nombre', fecha: 'Fecha', completado: 'Completado', fechaReal: 'Fecha real', resp: 'Responsable' }, nom: r => r.nombre, ini: r => r.ini },
  riesgo: { lbl: 'Riesgo', f: { desc: 'Descripción', prob: 'Probabilidad', imp: 'Impacto', estado: 'Estado', dueno: 'Dueño', mit: 'Mitigación' }, nom: r => r.desc, ini: r => r.ini },
  decision: { lbl: 'Decisión', f: { titulo: 'Título', tipo: 'Tipo', estado: 'Estado', limite: 'Fecha límite', resolucion: 'Resolución', solicita: 'Solicita' }, nom: r => r.titulo, ini: r => r.ini },
  compromiso: { lbl: 'Compromiso', f: { texto: 'Descripción', resp: 'Responsable', limite: 'Fecha límite', estado: 'Estado' }, nom: r => r.texto, ini: r => r.ini },
  cambio: { lbl: 'Cambio', f: { tipo: 'Tipo', desc: 'Descripción', estado: 'Estado', fNue: 'Nueva fecha', pNue: 'Nuevo presupuesto', aprobador: 'Aprobador' }, nom: r => r.desc || r.id, ini: r => r.ini }
};
const AUD_COL = { ini: 'ini', hito: 'hitos', riesgo: 'riesgos', decision: 'decisiones', compromiso: 'compromisos', cambio: 'cambios' };
const AUD_SEM = ['fase', 'estado', 'rag'];      /* campos que ya registra la bitácora con su propio texto («Cambio de fase», «RAG»…) */
export let _audSt = null, _audSnap = {}, _audTop = null;
function audVal(k, v, r) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return fmtD(v);
  if (k === 'avance') return Math.round(v) + '%';
  if (k === 'presupuesto' || k === 'gastado') return fmtMon(v, r.moneda || 'CLP');
  if (k === 'pNue') return fmtN(v);
  return String(v).replace(/\s+/g, ' ').slice(0, 80);
}
export function audSnap() {
  const S = {};
  Object.keys(AUD).forEach(t => (St[AUD_COL[t]] || []).forEach(r => { const d = {}; Object.keys(AUD[t].f).forEach(k => { d[k] = r[k] == null ? null : r[k]; }); S[t + ':' + r.id] = d; }));
  _audSt = St; _audSnap = S; _audTop = St.bitacora && St.bitacora[0] ? St.bitacora[0].id : null;
}
/* La auditoría ya no se calcula en el navegador: cada comando del servidor deja su anotación en la bitácora y la tabla `auditoria`
   registra cada escritura (quién, qué lista, cuándo). Aquí solo se mantiene la foto base para las pantallas que la consultan. */
export function audit() {
  if (!St) return;
  if (St !== _audSt) audSnap();
}
export function audParse(texto) {
  const m = /^(Hito|Riesgo|Decisión|Compromiso|Cambio) «(.*?)» — /.exec(texto || '');
  const ent = m ? m[2] : '', body = m ? texto.slice(m[0].length) : (texto || '');
  const rows = body.split(' | ').map(x => { const a = x.indexOf(': '), b = x.indexOf(' → '); return a > 0 && b > a ? [x.slice(0, a), x.slice(a + 2, b), x.slice(b + 3)] : null; });
  return { ent, kind: m ? m[1] : 'Iniciativa', rows: rows.every(Boolean) ? rows : null, raw: body };
}

/* ---------- cálculos de dominio ---------- */
export const isDone = i => EST_FINAL[esProp(i) ? 'Propuesta' : 'Proyecto'].includes(i.estado);
/* Stand By = fuera de TODOS los indicadores, alertas y vistas de gestión; solo la Tabla lo muestra y la presentación lo cuenta */
export const esSB = i => !!i && i.estado === 'Stand By';
export const isLive = i => !isDone(i) && !esSB(i);
export const isActive = i => !esProp(i) && FASES_ACT.includes(i.fase) && i.estado === 'En curso';
/* ---- Filtros globales V6: Área + Responsable + «Solo lo mío» (válidos en todas las pantallas) ---- */
/* Permisos: los decide el SERVIDOR (apih_contexto + puede_editar por fila). Aquí solo se guarda lo que él entregó; no se calcula nada. */
export const PERM = { ctx: null, edit: new Map() };
export const FL = { resp: '', mine: false, verComo: '' };                  // estado en memoria (no se persiste); verComo lo fija el servidor
export const miUsuario = () => FL.verComo || St.cfg.usuario;                // «yo»: usuario real o el que el admin está simulando
export const respSel = () => FL.mine ? miUsuario() : FL.resp;
export const _nrm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export let esAdminReal = () => !!(PERM.ctx && (PERM.ctx.esAdmin || PERM.ctx.comoDe));   // el administrador de verdad, incluso mientras usa «Ver como»
export const esAdmin = () => !!(PERM.ctx && PERM.ctx.esAdmin);
export let _PP = null;                                                     // nombre → Set de iniciativas donde participa (se invalida en render/save)
export const ppInval = () => { _PP = null; };
export function personProjects(n) {
  if (!_PP) {
    _PP = {}; const add = (nm, id) => { if (nm && id) (_PP[nm] = _PP[nm] || new Set()).add(id); };
    St.ini.forEach(i => [i.lider, i.sponsor, i.negocio, i.propuestoPor, i.solicita].forEach(nm => String(nm || '').split(/\s+-\s+|,/).forEach(x => add(x.trim(), i.id))));
    St.hitos.forEach(h => add(h.resp, h.ini)); St.riesgos.forEach(r => add(r.dueno, r.ini)); DECS().forEach(d => add(d.solicita, d.ini));
    St.comites.forEach(c => [...(c.acciones || []), ...(c.compromisos || [])].forEach(a => add(a.resp, a.ini)));
  }
  return _PP[n] || new Set();
}
const respOk = i => { const r = respSel(); return !r || personProjects(r).has(i.id); };
export const respItem = (x, f) => { const r = respSel(); return !r || (x[f] || (byId(x.ini) || {}).lider) === r; };   // si el registro no trae responsable propio, rige el líder de la iniciativa      // filtro estricto sobre el campo propio (hito.resp, riesgo.dueno, decisión.solicita)
export const inArea = i => (St.cfg.areaGlobal === 'Todas' || (i.area || '').split(',').map(x => x.trim()).includes(St.cfg.areaGlobal)) && respOk(i) && (!ENLACES.PRES_MIO || _nrm(i.lider) === _nrm(miUsuario())) && (typeof ENLACES.areaVisible !== 'function' || (0, ENLACES.areaVisible)(i.area));
/* scope() = PROYECTOS del área global · scopeP() = PROPUESTAS · scopeAll() = ambos */
export const scope = () => St.ini.filter(i => !esProp(i) && !esSB(i) && inArea(i));
export const scopeP = () => St.ini.filter(i => esProp(i) && !esSB(i) && inArea(i));
export const scopeAll = () => St.ini.filter(i => !esSB(i) && inArea(i));
export const scopeTT = t => St.ini.filter(i => inArea(i) && (t === 'Propuesta' ? esProp(i) : t === 'Todo' ? true : !esProp(i)));   // solo la Tabla de iniciativas: incluye Stand By
export const RIESGOS = () => St.riesgos.filter(r => !esSB(byId(r.ini)));
export const DECS = () => St.decisiones.filter(x => !esSB(byId(x.ini)));
export const CAMBIOS = () => St.cambios.filter(x => !esSB(byId(x.ini)));
export const ACUERDOS = () => St.compromisos.filter(x => !esSB(byId(x.ini)));
export const PRJS = () => St.ini.filter(i => !esProp(i));
const PROPS = () => St.ini.filter(esProp);
/* hitos visibles = solo de proyectos (las propuestas no tienen cronograma) */
export const HITOS = () => St.hitos.filter(h => { const i = byId(h.ini); return i && !esProp(i) && !esSB(i); });
/* índices por iniciativa (O(1) en vez de filtrar toda la lista por cada proyecto); se invalidan en save() y al cambiar la lista */
export let _ixGen = 0; const _ix = {};
const _porIni = (k, id) => { const arr = St[k]; let c = _ix[k]; if (!c || c.arr !== arr || c.n !== arr.length || c.g !== _ixGen) { const m = new Map(); arr.forEach(x => { let l = m.get(x.ini); if (!l) m.set(x.ini, l = []); l.push(x); }); _ix[k] = c = { arr, n: arr.length, g: _ixGen, m }; } return (c.m.get(id) || []).slice(); };
export const hitosDe = id => _porIni('hitos', id);
export const riesgosDe = id => _porIni('riesgos', id);
/* Valores calculados: los entrega el SERVIDOR (apih_calculos). Aquí solo se leen; si aún no llegó el dato (registro recién creado, sin sincronizar)
   se devuelve un valor neutro y la pantalla se completa en cuanto el servidor responde. No hay fórmulas en el navegador. */
export const CALC = { hoy: '', senales: {}, trabajo: [], ini: {}, hitos: {}, riesgos: {}, hallazgos: [], puntajes: {}, evm: {}, sem: {}, cambios: {}, capacidad: null, personas: [], mision: {}, cielo: null, notif: { catalogo: { tipos: [], grupos: {}, destinos: [], canales: [] }, prefs: {}, avisos: [] }, resumen: { ontrack: {}, tonos: [], ventanas: { hitosDias: 30, cierreDias: 45, proximosDias: 30 } } };
const _ci = i => (i && CALC.ini[i.id]) || null;
const HITO_NEUTRO = { k: 'ok', t: 'En plazo', c: '#0D446A' }, NIVEL_NEUTRO = { n: 'Bajo', c: '#107C10' };
export const hitoEstado = h => (h && CALC.hitos[h.id]) || HITO_NEUTRO;
export const forecast = i => { const c = _ci(i); return c ? c.forecast : (i.finEst || i.finPlan); };
export const desv = i => { const c = _ci(i); return c ? c.desv : 0; };
export const atrasado = i => { const c = _ci(i); return !!(c && c.atrasado); };
export const esperado = i => { const c = _ci(i); return c ? c.esperado : 0; };
export const roi = i => { const c = _ci(i); return c ? c.roi : null; };
export const expo = r => { const c = r && CALC.riesgos[r.id]; return c ? c.expo : 0; };
export const nivelRiesgo = r => { const c = r && CALC.riesgos[r.id]; return c ? c.nivel : NIVEL_NEUTRO; };
export const riesgoAbierto = r => r.estado !== 'Cerrado';
export const riesgoCritico = r => !!(r && CALC.riesgos[r.id] && CALC.riesgos[r.id].critico);
export const riesgosCriticos = () => RIESGOS().filter(r => riesgoCritico(r) && (!byId(r.ini) || (isLive(byId(r.ini)) && inArea(byId(r.ini)))));   // F-16
export const diasSinUpd = i => { const c = _ci(i); return c ? c.dsu : 999; };
export const ragSugerido = i => { const c = _ci(i); return c ? c.rag : { rag: i.rag, why: [] }; };
export const critScore = i => { const c = _ci(i); return c ? c.crit : 0; };
/* Avance: el servidor lo calcula (hitos y subfases ponderados por días de cada fase) y lo guarda; aquí solo se leen sus valores */
export const avanceEf = i => { const c = _ci(i); return c && c.avance != null ? c.avance : Math.round(+(i && i.avance) || 0); };
export const avanceCalc = i => { const c = _ci(i); return c && c.avanceCalc != null ? c.avanceCalc : 0; };
export const avanceManualDe = i => { const c = _ci(i); return c ? c.avanceManual : null; };
/* Ventana de cada fase (inicio, fin, avance, hitos cerrados) tal como la entrega el servidor */
export const ventanasSrv = i => { const c = _ci(i); return c && Array.isArray(c.ventanas) ? c.ventanas : []; };
/* Lectura del % On Track: el servidor entrega los tramos (desde, nivel, texto) */
export const tonoOnTrack = pct => (CALC.resumen.tonos || []).find(t => pct >= t.desde) || { nivel: 'bad', txt: '' };
export function kpis() {
  const L = scope(), live = L.filter(isLive), act = L.filter(isActive), P = scopeP(), pl = P.filter(isLive);
  const M = { pres: sumM(L.filter(i => i.estado !== 'Cancelado'), i => i.presupuesto), gas: sumM(L.filter(i => i.estado !== 'Cancelado'), i => i.gastado), presPipe: sumM(pl, i => i.presupuesto), valorPipe: sumM(pl, i => i.beneficio), beneficio: sumM(live, i => i.beneficio) };
  const pres = M.pres.CLP || 0, gas = M.gas.CLP || 0;   // escalares = solo CLP (no se mezclan monedas)
  const ontrack = act.filter(i => (CALC.resumen.ontrack || {})[i.id]).length;   /* «on track» lo define el servidor */
  return {
    total: L.length, activos: act.length, atrasados: live.filter(atrasado).length, riesgosCrit: riesgosCriticos().length, pres, gas, M,
    presPipe: M.presPipe.CLP || 0, valorPipe: M.valorPipe.CLP || 0,
    beneficio: M.beneficio.CLP || 0, ontrack, ontrackPct: act.length ? ontrack / act.length * 100 : 0, live: live.length,
    pipe: pl.length, propAprob: pl.filter(i => i.fase === 'Aprobación' && i.estado === 'Vigente').length, propEspera: pl.filter(i => i.estado === 'En espera').length,
    cerradas: L.filter(i => i.estado === 'Completado').length
  };
}
/* Compuertas de gobierno por transición */
/* Compuertas del siguiente paso (próxima fase; aprobar si es propuesta en su última fase; completar si es la última): las define el servidor */
export const compuertas = i => (_ci(i) && _ci(i).sig) || [];
function canon(i) { return ['id', 'titulo', 'sponsor', 'lider', 'area', 'estado', 'rag', 'prioridad', 'presupuesto', 'avance']; }
export const completitud = i => { const c = _ci(i); return c ? c.compl : { crit: [], rec: [], opt: [], pct: 0 }; };


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  St: { get: () => St, set: v => { St = v; }, enumerable: true, configurable: true },
  _PP: { get: () => _PP, set: v => { _PP = v; }, enumerable: true, configurable: true },
  _audSt: { get: () => _audSt, set: v => { _audSt = v; }, enumerable: true, configurable: true },
  esAdminReal: { get: () => esAdminReal, set: v => { esAdminReal = v; }, enumerable: true, configurable: true },
  kpis: { get: () => kpis, set: v => { kpis = v; }, enumerable: true, configurable: true },
});
