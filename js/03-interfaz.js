import { ENLACES } from './00-registro.js';
import { $, $$, APIH_CONFIG, BIT_C, CAMBIOS, DECS, DEC_C, DEC_TIPOS, EST_C, FASES, FASES_ACT, FASES_PRJ, FASES_PROP, FASE_COLOR, FL, HITOS, LOGO, PRIOS, RAGS, RAG_C, RISK_CATS, RISK_ESTADOS, St, addD, aplicarPlantilla, avatar, by, byId, clone, completitud, desv, esAdmin, esProp, esSB, esc, esperado, expo, fasesDe, fmtD, fmtDL, fmtMon, fmtTS, forecast, compuertas, hitoCats, hitoEstado, hitosDe, hoy, icon, inArea, isDone, isLive, log, miUsuario, monOf, nameOf, nextId, nivelRiesgo, pad, pct, ppInval, ragSugerido, riesgoAbierto, riesgosCriticos, riesgosDe, roi, save, scope, scopeP, seedState, sum, syncFases, tipoLbl, uniq } from './01-nucleo.js';
import { AuthService, DataService, ESQUEMA } from './02-datos.js';
/* ============================================================
   APIH · UI: shell, router, modal/form, toasts, panel, gráficos
   ============================================================ */
export const UI = { view: 'dashboard', sel: null, tab: 'resumen', panel: innerWidth > 980, f: {}, pop: null };
export const Views = {}, Acts = {}, Chg = {};
/* V4: preferencias de UI solo en memoria de la sesión (sin localStorage) */
export function loadUI() { UI.theme = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; applyTheme(); }
function saveUI() { }
export const F = (k, def) => (UI.f[k] = Object.assign({}, def, UI.f[k] || {}));

/* ---------- componentes pequeños ---------- */
export const ragPill = r => `<span class="rag" style="--c:${RAG_C[r] || '#8A8886'}"><i></i>${esc(r || '—')}</span>`;
export const fasePill = f => `<span class="pill" style="--c:${FASE_COLOR[f] || '#8A8886'}">${esc(f)}</span>`;
export const prioPill = p => `<span class="prio p-${esc(p)}">${p === 'Alta' ? '▲' : p === 'Baja' ? '▼' : '■'} ${esc(p || '—')}</span>`;
export const estPill = e => `<span class="pill" style="--c:${EST_C[e] || '#605E5C'}">${esc(e)}</span>`;
export const tipoPill = i => `<span class="pill tp ${esProp(i) ? 'prop' : 'prj'}">${esProp(i) ? 'Propuesta' : 'Proyecto'}</span>`;
export const prog = (v, rag, h = 6) => `<span class="prog" style="height:${h}px"><b style="width:${Math.max(0, Math.min(100, v))}%;background:${RAG_C[rag] || 'var(--pri)'}"></b></span>`;
export const estTag = (i, f) => (i.est && (i.est.includes(f) || i.est.includes('all'))) ? `<sup class="est" title="Valor estimado/demo — completar con datos reales">est.</sup>` : '';
export const empty = (t, ic = 'search') => (window.V22 && V22.empty ? V22.empty(t, ic) : `<div class="empty">${icon(ic, 28)}<p>${esc(t)}</p></div>`);
export const iniLink = (id, txt) => id ? `<a class="lnk" data-act="sel" data-t="ini" data-id="${esc(id)}">${esc(txt || nameOf(id))}</a>` : '<span class="mut">—</span>';
export function pageHead(t, sub, actions = '') { if (['hitos', 'gantt', 'proyectos'].includes(UI.view) && !/data-act="cargaxl"/.test(actions)) actions += `<span class="edit-only">${btn('Cargar Excel', 'cargaxl', { ic: 'up', title: 'Cargar planificación e hitos desde Excel (con plantilla descargable)' })}</span>`; return `<div class="ph"><div><h1>${esc(t)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="ph-act">${actions}</div></div>`; }
export const btn = (txt, act, o = {}) => `<button class="btn ${o.cls || ''}" data-act="${act}" ${Object.entries(o.d || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${o.title ? `title="${esc(o.title)}"` : ''}>${o.ic ? icon(o.ic, 15) : ''}${txt ? `<span>${txt}</span>` : ''}</button>`;
export function selOpts(list, cur, all) { return (all ? `<option value="">${esc(all)}</option>` : '') + list.filter(o => all ? (typeof o === 'object' ? o.v !== '' && o.v != null : o !== '' && o != null) : true).map(o => { const v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; return `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`; }).join(''); }

/* ---------- gráficos SVG ---------- */
function donut(segs, o = {}) {
  const S = o.size || 150, th = o.th || 22, r = (S - th) / 2, C = 2 * Math.PI * r, tot = sum(segs, s => s.v) || 1; let off = 0;
  const arcs = segs.filter(s => s.v > 0).map(s => { const len = s.v / tot * C, g = segs.filter(x => x.v > 0).length > 1 ? 2 : 0; const el = `<circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="${s.c}" stroke-width="${th}" stroke-dasharray="${Math.max(0, len - g)} ${C - len + g}" stroke-dashoffset="${-off}" transform="rotate(-90 ${S / 2} ${S / 2})"><title>${esc(s.l)}: ${s.v}</title></circle>`; off += len; return el; }).join('');
  return `<svg class="donut" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(o.label || 'Distribución')}"><circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="#EDEBE9" stroke-width="${th}"/>${arcs}<text x="50%" y="${o.sub ? '48%' : '52%'}" text-anchor="middle" dominant-baseline="middle" class="d-big">${esc(o.center ?? tot)}</text>${o.sub ? `<text x="50%" y="63%" text-anchor="middle" class="d-sub">${esc(o.sub)}</text>` : ''}</svg>`;
}
export function spark(pts, w = 80, h = 22, c = 'var(--pri)') {
  if (!pts || pts.length < 2) return `<span class="mut" style="font-size:11px">—</span>`;
  const mn = Math.min(...pts), mx = Math.max(...pts), rg = (mx - mn) || 1;
  const xy = pts.map((v, i) => [i / (pts.length - 1) * (w - 4) + 2, h - 3 - (v - mn) / rg * (h - 6)]);
  return `<svg width="${w}" height="${h}" class="spark"><polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${xy[xy.length - 1][0]}" cy="${xy[xy.length - 1][1]}" r="2.4" fill="${c}"/></svg>`;
}
export function stackBar(segs, h = 14) { const t = sum(segs, s => s.v) || 1; return `<div class="stk" style="height:${h}px">${segs.filter(s => s.v > 0).map(s => `<i style="flex:${s.v};background:${s.c}" title="${esc(s.l)}: ${s.v}"></i>`).join('')}</div>`; }
export function hbars(rows, max, fmt = v => v) { const m = max || Math.max(1, ...rows.map(r => r.v)); return rows.map(r => `<div class="hb"><span class="hb-l" title="${esc(r.l)}">${esc(r.l)}</span><span class="hb-t"><b style="width:${r.v / m * 100}%;background:${r.c || 'var(--pri)'}"></b></span><span class="hb-v">${fmt(r.v)}</span></div>`).join(''); }

/* ---------- toasts ---------- */
export function toast(msg, type = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.innerHTML = `${icon(type === 'err' ? 'warn' : 'check', 16)}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el); const d = type === 'err' ? 6000 : 2700;   // U-10: los errores duran más
  setTimeout(() => el.classList.add('out'), d); setTimeout(() => el.remove(), d + 500);
}

/* ---------- modal + formularios ---------- */
export const Modal = {
  open(o) {
    const ret = $('#modal') ? this._ret : document.activeElement; this.close(); this._ret = ret;
    const m = document.createElement('div'); m.className = 'modal-bg'; m.id = 'modal';
    m.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><div class="m-h"><h2>${esc(o.title)}</h2><button class="icon-btn" data-act="mclose" aria-label="Cerrar">${icon('x')}</button></div><div class="m-b">${o.body}</div><div class="m-f">${o.footer || ''}</div></div>`;
    m.addEventListener('mousedown', e => { if (e.target === m) Modal.close(); });
    document.body.appendChild(m); Modal.cur = o; const f = m.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
    /* el resto de la app queda inerte mientras el diálogo está abierto (foco y lectores de pantalla) */
    ['app'].forEach(id => { const e = document.getElementById(id); if (e && e !== m) e.setAttribute('inert', ''); });
    m.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const fs = [...m.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!fs.length) return; const a = fs[0], z = fs[fs.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  },
  close() {
    const m = $('#modal'); if (m) m.remove(); Modal.cur = null;
    const app = document.getElementById('app'); if (app) app.removeAttribute('inert');
    const r = this._ret; this._ret = null; if (r && r.isConnected && typeof r.focus === 'function') { try { r.focus(); } catch (e) { } }
  }
};
function fieldHTML(f, v) {
  const id = 'f_' + f.k, req = f.req ? ' <b class="req">*</b>' : '', cls = 'fld' + (f.w === 2 ? ' w2' : f.w === 3 ? ' w3' : '');
  let inp = '';
  if (f.t === 'textarea') inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''}>${esc(v ?? '')}</textarea>`;
  else if (f.t === 'select') inp = `<select id="${id}" name="${f.k}">${selOpts(f.opts, v, f.blank)}</select>`;
  else if (f.t === 'check') inp = `<label class="chk"><input type="checkbox" id="${id}" name="${f.k}" ${v ? 'checked' : ''}> <span>${esc(f.lbl || '')}</span></label>`;
  else if (f.t === 'multi') inp = `<div class="multi" id="${id}" data-k="${f.k}">${f.opts.map(o => `<label class="chk"><input type="checkbox" value="${esc(o.v)}" ${(v || []).includes(o.v) ? 'checked' : ''}> <span>${esc(o.t)}</span></label>`).join('')}</div>`;
  else if (f.t === 'range') inp = `<div class="rng"><input type="range" id="${id}" name="${f.k}" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step || 1}" value="${v ?? 0}" data-rng="${esc(f.suf || '')}"><b>${v ?? 0}${f.suf || ''}</b></div>`;
  else inp = `<input id="${id}" name="${f.k}" type="${f.t || 'text'}" value="${esc(v ?? '')}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.list ? `list="dl_${f.k}"` : ''}>${f.list ? `<datalist id="dl_${f.k}">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
  return `<div class="${cls}"><label for="${id}">${esc(f.l || '')}${req}</label>${inp}${f.hint ? `<small>${f.hint}</small>` : ''}</div>`;
}
export function openForm(o) {
  if (o.pres) { o.fields = [...o.fields.filter(f => f.k !== 'inPres'), { k: 'inPres', l: 'Presentación', t: 'check', lbl: 'Incluir en presentación', w: 3 }]; o.values = Object.assign({}, o.values, { inPres: (o.values || {}).inPres !== false }); }   // {title, fields:[{k,l,t,opts,req,w,...}], values, onSave(vals) -> false para no cerrar, saveLabel, wide, extra, tabs:[{k,t,secs}], tabExtra:{k:html}}
  const vals = o.values || {};
  let body = '';
  if (o.tabs) {   // formulario con pestañas: las secciones se reparten por nombre; las pestañas sin secciones llevan HTML propio (tabExtra)
    const H = {}; let cur = o.tabs[0].k;
    o.fields.forEach(f => {
      if (f.sec) { const t = o.tabs.find(t => (t.secs || []).some(x => f.sec.startsWith(x))); if (t) cur = t.k; if (!f.hide) H[cur] = (H[cur] || '') + `<div class="fsec">${esc(f.sec)}</div>`; return; }
      H[cur] = (H[cur] || '') + fieldHTML(f, vals[f.k]);
    });
    body = `<div class="ftabs" role="tablist">${o.tabs.map((t, n) => `<button type="button" role="tab" class="${n ? '' : 'on'}" data-act="ftab" data-t="${t.k}">${esc(t.t)}</button>`).join('')}</div><form id="mform">${o.tabs.map((t, n) => `<div class="ftab ${n ? '' : 'on'}" data-t="${t.k}"><div class="fgrid">${H[t.k] || ''}</div>${(o.tabExtra && o.tabExtra[t.k]) || ''}</div>`).join('')}</form>${o.extra || ''}`;
  } else {
    o.fields.forEach(f => { if (f.sec) { body += `<div class="fsec">${esc(f.sec)}</div>`; return; } body += fieldHTML(f, vals[f.k]); });
    body = `<form id="mform" class="fgrid">${body}</form>${o.extra || ''}`;
  }
  Modal.open({ title: o.title, wide: o.wide, body, footer: `${o.danger ? `<button class="btn danger left" data-act="mdanger">${icon('trash', 14)}<span>${o.danger}</span></button>` : ''}<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="msave">${esc(o.saveLabel || 'Guardar')}</button>` });
  Modal.cur.form = o;
}
function readForm() {
  const o = Modal.cur.form, out = {}, errs = [];
  o.fields.forEach(f => {
    if (f.sec) return; const el = $('#f_' + f.k); if (!el) return; let v;
    if (f.t === 'check') v = el.checked; else if (f.t === 'multi') v = $$('input:checked', el).map(x => x.value);
    else if (f.t === 'number' || f.t === 'range') v = el.value === '' ? 0 : +el.value; else v = el.value.trim();
    if (f.req && (v === '' || v == null)) { errs.push(f.l); el.classList.add('bad'); } else el.classList && el.classList.remove('bad');
    out[f.k] = v;
  });
  return { out, errs };
}
export function confirmBox(msg, onYes, label = 'Confirmar', danger) {
  Modal.open({ title: 'Confirmación', body: `<p style="margin:4px 0 8px;line-height:1.5">${msg}</p>`, footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn ${danger ? 'danger' : 'pri'}" data-act="mconfirm">${esc(label)}</button>` });
  Modal.cur.yes = onYes;
}

/* ---------- popovers ---------- */
function popToggle(id) { const was = UI.pop === id; closePops(); if (!was) { const el = $('#' + id); if (el) { el.classList.add('open'); UI.pop = id; } } syncPop(); }
export function closePops() { $$('.pop.open').forEach(p => p.classList.remove('open')); UI.pop = null; syncPop(); }
export function syncPop() { $$('[data-act=pop][data-id]').forEach(b => { const t = document.getElementById(b.dataset.id); b.setAttribute('aria-expanded', t && t.classList.contains('open') ? 'true' : 'false'); if (!b.hasAttribute('aria-haspopup')) b.setAttribute('aria-haspopup', 'true'); if (t && !b.hasAttribute('aria-controls')) b.setAttribute('aria-controls', b.dataset.id); }); }

/* ---------- descarga/exportación ---------- */
export function download(name, text, mime = 'text/plain') { const b = new Blob([text], { type: mime + ';charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
export function toCSV(rows, cols) { const q = v => { const txt0 = typeof v === 'string'; v = v == null ? '' : String(v).replace(/\r?\n/g, ' '); if (txt0 && /^[=+\-@\t\r]/.test(v)) v = "'" + v;   // F-26: evita fórmulas al abrir en Excel
      return /[",;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }; return '﻿' + [cols.map(c => q(c.h)).join(';'), ...rows.map(r => cols.map(c => q(c.f(r))).join(';'))].join('\r\n'); }
export function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast('Copiado al portapapeles')); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copiado al portapapeles'); } catch (e2) { toast('No se pudo copiar', 'err'); } ta.remove(); } }

/* ---------- navegación ---------- */
export const NAV = [
  ['dashboard', 'Dashboard', 'dashboard'], ['cielo', 'Mi cocina', 'fork'], ['portfolio', 'Portfolio', 'portfolio'], ['proyectos', 'Proyectos', 'list'], ['propuestas', 'Propuestas', 'bulb'], ['hitos', 'Hitos', 'flag'], ['riesgos', 'Riesgos', 'shield'],
  ['roadmap', 'Roadmap', 'road'], ['gantt', 'Gantt', 'gantt'], ['fases', 'Fases', 'flag'], ['comite', 'Comité', 'users'], ['decisiones', 'Decisiones', 'gavel'], ['compromisos', 'Compromisos', 'check'], ['cambios', 'Cambios', 'refresh'], ['bitacora', 'Bitácora', 'book'], ['calendario', 'Calendario', 'cal'], ['capacidad', 'Capacidad', 'users'], ['personas', 'Personas', 'person'],
  ['presentaciones', 'Presentaciones', 'slides'], ['miconfig', 'Mi configuración', 'settings'], ['admin', 'Administración', 'settings'], ['analisis', 'Análisis', 'spark'], ['proposito', 'Para qué sirve', 'help']
];
const NAV_GRUPO = ['proyectos', 'propuestas', 'hitos', 'riesgos'];   // «Iniciativas»: un solo bloque de menú
export function navBadge(k) {
  const L = scope();
  if (k === 'propuestas') return scopeP().filter(isLive).length;
  if (k === 'riesgos') return riesgosCriticos().length;
  if (k === 'hitos') return HITOS().filter(h => !h.completado && h.fecha < hoy() && (!byId(h.ini) || inArea(byId(h.ini)))).length;
  if (k === 'compromisos') return typeof ENLACES.acuVencidos === 'function' ? (0, ENLACES.acuVencidos)() : 0;
  if (k === 'cambios') return St.cambios ? CAMBIOS().filter(c => c.estado === 'Solicitado').length : 0;
  if (k === 'decisiones') return DECS().filter(d => d.estado === 'Pendiente').length;
  if (k === 'analisis') return typeof ENLACES.motorAlertas === 'function' ? (0, ENLACES.motorAlertas)().filter(a => a.sev === 3).length : 0;
  return 0;
}
export function go(v) { if (!Views[v]) return; UI.view = v; if (location.hash !== '#/' + v) { try { history.pushState(null, '', '#/' + v); } catch (e) { } } /* sin historial en vistas previas aisladas */ closePops(); { const ap = $('#app'); if (ap) ap.classList.remove('side-open'); const tp = $('.top'); if (tp) tp.classList.remove('gs-open'); } render(); $('#main').scrollTop = 0; }
window.addEventListener('popstate', () => { const v = (location.hash || '').replace('#/', ''); if (Views[v] && v !== UI.view) { UI.view = v; render(); } });

/* ---------- shell ---------- */
export function shell() {
  $('#app').innerHTML = `
  <a class="skip" href="#main" data-act="skipmain">Saltar al contenido</a>
  <header class="top" role="banner">
    <button class="icon-btn hamb" data-act="side" aria-label="Menú">${icon('menu', 18)}</button>
    <div class="brand" data-act="go" data-v="dashboard"><img class="brand-img" src="${LOGO.arC}" alt="Aramark"><span class="b-t app"><b>APIH</b><small>Portfolio Intelligence Hub</small></span></div>
    <button class="icon-btn gstog" data-act="gstog" aria-label="Buscar">${icon('search', 18)}</button>
    <div class="gsearch"><span class="gs-i">${icon('search', 15)}</span><input id="gs" data-key="gs" type="search" placeholder="Buscar…  ( / )  ·  Ctrl+K: pantallas y acciones" autocomplete="off" data-chg="gsearch"><div class="gs-res" id="gsres"></div></div>
    <div class="top-r">
      <button class="sync" id="syncChip" data-act="syncgo" title="Estado de la conexión"></button>
      <div class="popw"><button class="btn pri" data-act="pop" data-id="pop-new">${icon('plus', 15)}<span>Nuevo</span></button>
        <div class="pop" id="pop-new" style="right:0">
          <button data-act="new" data-t="prop">${icon('bulb', 15)} Nueva propuesta</button><button data-act="new" data-t="ini">${icon('list', 15)} Nuevo proyecto (alta directa)</button>
          <button data-act="new" data-t="risk">${icon('shield', 15)} Nuevo riesgo</button><button data-act="new" data-t="hito">${icon('flag', 15)} Nuevo hito</button>
          <button data-act="new" data-t="dec">${icon('gavel', 15)} Nueva decisión</button><button data-act="new" data-t="com">${icon('users', 15)} Nuevo comité</button></div></div>
      <div class="popw"><button class="icon-btn bell" data-act="pop" data-id="pop-bell" aria-label="Avisos y alertas">${icon('bell', 18)}<b id="bellN"></b></button><div class="pop wide" id="pop-bell" style="right:0"></div></div>
      <div class="popw"><button class="icon-btn" data-act="pop" data-id="pop-more" aria-label="Más opciones" title="Más opciones">${icon('dots', 18)}</button>
        <div class="pop more" id="pop-more">
          <div class="mo-r"><span>Interfaz</span><span class="seg" id="modeSeg"></span></div>
          <label class="areasel" title="Filtro global de área"><span>Área</span><select id="areaG" data-chg="areaG"></select></label>
          <div class="mo-r"><span class="hdate" id="hdate" title="Fecha de referencia">${icon('cal', 14)} ${fmtDL(hoy())}</span></div>
          <div id="vcBox" class="mo-r"></div>
          <button data-act="cmdk">${icon('target', 16)} Comandos rápidos</button>
          <button data-act="theme"><span id="themeBtn"></span> Cambiar tema</button>
          <button data-act="panel">${icon('panel', 16)} Panel contextual</button>
          ${AuthService.needsLogin ? `<button data-act="login">${icon('user', 16)} Iniciar sesión</button>` : ''}
        </div></div>
      <div class="usr" title="${esc(St.cfg.cargo)}">${avatar(St.cfg.usuario, 30)}<span><b>${esc(St.cfg.usuario)}</b><small>${esc(AuthService.user() ? AuthService.user().email : St.cfg.cargo.split('·')[0])}</small></span>${AuthService.provider === 'supabase' && AuthService.user() ? `<button class="btn sm" data-act="sbout" title="Cerrar sesión">Salir</button>` : ''}</div>
    </div>
  </header>
  <nav class="side" id="side" aria-label="Navegación principal"></nav>
  <main id="main" tabindex="-1"></main>
  <aside id="panel" aria-label="Panel contextual"></aside>`;
}
export function renderChrome() {
  const navItem = ([k, t, ic], sub) => { const b = navBadge(k); return `<a class="nav ${sub ? 'nsub' : ''} ${UI.view === k ? 'on' : ''}" data-act="go" data-v="${k}" href="#/${k}" title="${t}"${UI.view === k ? ' aria-current="page"' : ''}>${sub ? '' : icon(ic, 18)}<span>${t}</span>${b ? `<em class="${k === 'riesgos' || k === 'hitos' || k === 'analisis' ? 'red' : ''}">${b}</em>` : ''}</a>`; };
  const navG = NAV_GRUPO.map(k => NAV.find(n => n[0] === k)), gAct = NAV_GRUPO.includes(UI.view), gOpen = UI.navOpen !== false || gAct;
  const gBadge = navG.reduce((a, n) => a + (+navBadge(n[0]) || 0), 0);
  let _ng = ''; $('#side').innerHTML = NAV.filter(n => (n[0] !== 'personas' || (0, ENLACES.esAdministra)()) && (n[0] !== 'admin' || esAdmin()) && (n[0] !== 'analisis' || (0, ENLACES.puedeVerAnalisis)()) && (n[0] !== 'cielo' || (0, ENLACES.cieloOn)()) && ((0, ENLACES.modoUI)() !== 'simple' || UI.sx || ENLACES.NAV_SIMPLE.includes(n[0]))).map(n => {
    const tg = ENLACES.NAV_GRP[n[0]] !== _ng ? (_ng = ENLACES.NAV_GRP[n[0]], '<div class="nav-t">' + _ng + '</div>') : '';
    if (NAV_GRUPO.includes(n[0])) return tg + n[0] === NAV_GRUPO[0] ? `<div class="nav-g ${gOpen ? 'open' : ''}"><button class="nav nav-gh ${gAct ? 'act' : ''}" data-act="navg" aria-expanded="${gOpen}">${icon('list', 18)}<span>Iniciativas</span>${!gOpen && gBadge ? `<em class="red">${gBadge}</em>` : ''}<i class="chv">${icon('chev', 12)}</i></button>${gOpen ? `<div class="nav-gb">${navG.map(x => navItem(x, true)).join('')}</div>` : ''}</div>` : '';
    return tg + navItem(n);
  }).join('') +
    `<div class="side-f"><img class="side-logo" src="${LOGO.bwdw}" alt="Be Well. Do Well."><div id="sideSync"></div></div>`;
  const vc = $('#vcBox'); if (vc) vc.innerHTML = (0, ENLACES.verComoHTML)();
  const ms = $('#modeSeg'); if (ms) ms.innerHTML = ['simple', 'pro'].map(m => `<button class="${(0, ENLACES.modoUI)() === m ? 'on' : ''}" data-act="modo" data-m="${m}">${m === 'simple' ? 'Simple' : 'Profesional'}</button>`).join('');
  $('#app').classList.toggle('simple', (0, ENLACES.modoUI)() === 'simple'); $('#app').classList.toggle('sx', !!UI.sx);
  const as = $('#areaG'); if (as) as.innerHTML = selOpts(['Todas', ...(0, ENLACES.areasPermitidas)()], St.cfg.areaGlobal);
  (0, ENLACES.bellPop)();
  $('#app').classList.toggle('nopanel', !UI.panel || (UI.view === 'presentaciones' && !UI.sel));
  $('#app').classList.toggle('ro', (0, ENLACES.soloLectura)());
}
/* A-01/A-02: elementos clicables no nativos (divs/spans con data-act) reciben foco y Enter/Espacio */
const KB_ACT_TAGS = 'div,span,i,g,rect,path,text,label';
function scrollHints() {   /* N-U-09: avisa cuando un tablero se desplaza horizontalmente */
  $$('#main .kanban').forEach(k => { if (k.scrollWidth > k.clientWidth + 4 && !(k.previousElementSibling && k.previousElementSibling.classList.contains('scroll-hint'))) k.insertAdjacentHTML('beforebegin', '<p class="mut scroll-hint" style="font-size:12px;margin:0 0 4px;text-align:right">Hay más columnas: desplaza horizontalmente →</p>'); });
}
function kbFocusables() { $$('#main [data-act]').forEach(el => { if (el.matches('button,a,input,select,textarea,tr,td,th') || el.tabIndex >= 0 && el.hasAttribute('tabindex')) return; if (!el.matches(KB_ACT_TAGS) || el.dataset.act === 'noop') return; el.setAttribute('tabindex', '0'); if (!el.getAttribute('role')) el.setAttribute('role', 'button'); }); }
document.addEventListener('keydown', e => { if ((e.key !== 'Enter' && e.key !== ' ') || !e.target || e.target.matches('button,a,input,select,textarea') || !e.target.dataset || !e.target.dataset.act || !e.target.closest('#main')) return; if (e.target.getAttribute('role') !== 'button') return; e.preventDefault(); e.target.click(); });
export function render() {
  syncFases(); ppInval(); try { (0, ENLACES.michelinSync)(); } catch (e) { console.error(e); } try { (0, ENLACES.escalarSync)(); } catch (e) { console.error(e); } try { if (typeof ENLACES.chkInsignias === 'function' && !UI.bdPrev) (0, ENLACES.chkInsignias)(); } catch (e) { } (0, ENLACES.guardAdmin)(); (0, ENLACES.guardAcceso)();
  const v = Views[UI.view]; if (!v) return;
  const act = document.activeElement, key = act && act.dataset ? act.dataset.key : null, ss = act && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null;
  const keep = {}; $$('[data-keep]').forEach(e => keep[e.dataset.keep] = [e.scrollLeft, e.scrollTop]);
  const mn = $('#main'), sc = mn.scrollTop;
  try { mn.innerHTML = (FL.verComo ? '<div class="note" role="status" style="margin:0 0 8px;position:sticky;top:0;z-index:5;background:#FFF4CE;border:1px solid #E0C060;color:#4A3600"><span>Viendo como <b>' + esc(FL.verComo) + '</b> (simulación) · <button class="lnk" data-act="vercomo" data-n="">Volver a mi usuario</button></span></div>' : '') + crumbs() + '<div id="bannerBox">' + banner() + '</div>' + (0, ENLACES.filtrosHTML)() + (0, ENLACES.guiaHTML)() + v.render();  kbFocusables(); scrollHints(); } catch (e) { console.error(e); mn.innerHTML = `<div class="empty">${icon('warn', 28)}<p>Error al renderizar la vista: ${esc(e.message)}</p></div>`; }
  mn.scrollTop = sc;
  $$('[data-keep]').forEach(e => { const k = keep[e.dataset.keep]; if (k) { e.scrollLeft = k[0]; e.scrollTop = k[1]; } });
  fitMain(); try { (0, ENLACES.simplify)(); } catch (e) { console.error(e); } try { (0, ENLACES.incMarks)(); } catch (e) { console.error(e); } try { (0, ENLACES.presLayout)(); } catch (e) { console.error(e); } try { (0, ENLACES.cocFit)(); } catch (e) { console.error(e); }
  try { v.after && v.after(); } catch (e) { console.error(e); }
  if (key) { const el = $(`[data-key="${key}"]`); if (el && el !== document.activeElement) { el.focus(); if (ss && el.setSelectionRange) try { el.setSelectionRange(ss[0], ss[1]); } catch (e) { } } }
  document.title = 'APIH · ' + (NAV.find(n => n[0] === UI.view) || [0, ''])[1];
  renderChrome(); renderPanel(); updateSyncUI(); try { (0, ENLACES.ampliable)(); } catch (e) { }
}
/* páginas cortas: el bloque más alto de la vista se desplaza dentro de su caja en vez de alargar la página */
export function fitMain() {
  const mn = $('#main'); if (!mn) return;
  const skip = e => e.id === 'bannerBox' || /\b(crumbs|ph|flt-bar|guia|guia-min|kpis|strip|banner|fit)\b/.test(e.className || '');
  [...mn.children].filter(e => !skip(e) && e.offsetHeight > 0).forEach(e => { if (e.offsetHeight > 220) e.classList.add('fit'); });
}
/* A-1: saneamiento de ids y enums en todas las fuentes (remoto, importaciones, archivos, Excel).
   Ids: solo [A-Za-z0-9_-]. Enums: sin <>"`=\ . Aplicado a la misma transformación en todas las filas,
   así que las referencias (ini, comite, subfase, deps) siguen coincidiendo. El texto libre se escapa al render. */
const SAN_DTK = ['fecha', 'fechaReal', 'inicioPlan', 'finPlan', 'finEst', 'inicio', 'fin', 'creada', 'faseDesde', 'inicioReal', 'finReal', 'fRev', 'fIdent', 'limite', 'fResol', 'fNue', 'fAnt', 'estadoRev'];
const sanDate = v => { if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; const y = +v.slice(0, 4); return y < 1900 ? '1900-01-01' : y > 2100 ? '2100-12-31' : v; };   // N-S-03: fechas guardadas fuera de rango se acotan
const SAN_IDK = ['id', 'ini', 'comite', 'subfase', 'proyecto'], SAN_ENK = ['fase', 'estado', 'tipo', 'rag', 'prioridad', 'moneda', 'area', 'categoria', 'cat', 'dueno', 'resp', 'lider', 'sponsor', 'negocio', 'proveedor', 'origen'];
const sanId = s => typeof s === 'string' ? s.replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 30) : s;
const sanEnum = s => typeof s === 'string' ? s.replace(/[<>"`=\\]/g, '') : s;
function sanRow(r) { if (!r || typeof r !== 'object' || Array.isArray(r)) return r;
  Object.keys(r).forEach(k => { const v = r[k];
    if (SAN_IDK.includes(k)) { if (typeof v === 'string') r[k] = sanId(v); }
    else if (SAN_ENK.includes(k)) { if (typeof v === 'string') r[k] = sanEnum(v); }
    else if (SAN_DTK.includes(k)) { if (typeof v === 'string') r[k] = sanDate(v); }
    else if (k === 'deps' && Array.isArray(v)) r[k] = v.map(d => typeof d === 'string' ? sanId(d) : d);
    else if (k === 'subfases' && Array.isArray(v)) v.forEach(sanRow); });
  return r; }
export function sanSt(S) { ['ini', 'hitos', 'riesgos', 'decisiones', 'comites', 'compromisos', 'cambios', 'bitacora', 'notas', 'eventos'].forEach(k => { if (Array.isArray(S[k])) S[k].forEach(sanRow); }); return S; }
export function refresh() { sanSt(St); (0, ENLACES.reconciliarAvance)(); save(); render(); try { if (typeof ENLACES.chkInsignias === 'function') (0, ENLACES.chkInsignias)(); } catch (e) { } }

/* ---------- panel contextual ---------- */
export function selectEntity(t, id, tab) { UI.sel = { t, id }; if (tab) UI.tab = tab; else if (t === 'ini') UI.tab = UI.tab || 'resumen'; UI.panel = true; render(); if (t === 'ini') requestAnimationFrame(() => { const c = document.querySelector('.icard.sel'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center', inline: 'nearest' }); }); }
function renderPanel() {
  const p = $('#panel'); if (!p) return; const s = UI.sel; let h = '';
  try {
    if (s && s.t === 'ini' && byId(s.id)) h = panelIni(byId(s.id));
    else if (s && s.t === 'risk' && St.riesgos.find(r => r.id === s.id)) h = panelRisk(St.riesgos.find(r => r.id === s.id));
    else if (s && s.t === 'hito' && St.hitos.find(r => r.id === s.id)) h = panelHito(St.hitos.find(r => r.id === s.id));
    else if (s && s.t === 'dec' && St.decisiones.find(r => r.id === s.id)) h = panelDec(St.decisiones.find(r => r.id === s.id));
    else h = panelHome();
  } catch (e) { console.error(e); h = `<div class="empty">${esc(e.message)}</div>`; }
  const sc = $('.pn-b', p) ? $('.pn-b', p).scrollTop : 0;
  p.innerHTML = h; const b = $('.pn-b', p); if (b) b.scrollTop = sc;
}
export function pnHead(kicker, title, pills, actions) { return `<div class="pn-h"><div class="pn-k">${kicker}<button class="icon-btn sm" data-act="panelx" title="Cerrar panel" aria-label="Cerrar panel">${icon('x', 15)}</button></div><h3>${title}</h3><div class="pn-p">${pills || ''}</div><div class="pn-a">${actions || ''}</div></div>`; }
export const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
function panelHome() {
  const me = miUsuario(), mine = St.ini.filter(i => i.lider === me && isLive(i) && FASES_ACT.includes(i.fase));
  const al = typeof ENLACES.motorAlertas === 'function' ? (0, ENLACES.motorAlertas)().slice(0, 5) : [];
  return `<div class="pn-h"><div class="pn-k">Panel contextual<button class="icon-btn sm" data-act="panelx" title="Cerrar panel" aria-label="Cerrar panel">${icon('x', 15)}</button></div><h3>Resumen del portafolio</h3><p class="mut" style="margin:4px 0 0;font-size:12px">Selecciona un proyecto, propuesta, riesgo, hito o decisión para ver su detalle aquí.</p></div>
  <div class="pn-b"><div class="pn-sec"><h4>Alertas de reglas</h4>${al.map(a => `<button class="al" data-act="alertgo" data-id="${esc(a.ini || '')}"><span class="sev s-${a.sev}"></span><span><b>${esc(a.titulo)}</b><small>${esc(a.grupo)}${a.ini ? ' · ' + esc(nameOf(a.ini)) : ''}</small></span></button>`).join('') || '<p class="mut">Sin alertas.</p>'}</div>
  <div class="pn-sec"><h4>Mis proyectos activos (${mine.length})</h4>${mine.slice(0, 6).map(i => `<button class="al" data-act="sel" data-t="ini" data-id="${i.id}">${ragPill(i.rag)}<span><b>${esc(i.titulo)}</b><small>${pct(i.avance)} · fin ${fmtD(forecast(i))}</small></span></button>`).join('') || '<p class="mut">—</p>'}</div>
  <div class="pn-sec"><h4>Atajos</h4><div class="chips">${btn('Nuevo riesgo', 'new', { d: { t: 'risk' }, ic: 'shield' })}${btn('Nueva decisión', 'new', { d: { t: 'dec' }, ic: 'gavel' })}${btn('Ver análisis', 'go', { d: { v: 'analisis' }, ic: 'spark' })}</div></div></div>`;
}
export function panelIni(i) {
  const PR = esProp(i);
  const tabs = [['resumen', 'Resumen'], ['hitos', 'Hitos (' + hitosDe(i.id).length + ')'], ['riesgos', 'Riesgos (' + riesgosDe(i.id).length + ')'], ['actividad', 'Actividad'], ['alertas', 'Alertas']];
  if (APIH_CONFIG.analisis === false) tabs.splice(tabs.findIndex(t => t[0] === 'alertas'), 1);
  const t = tabs.some(x => x[0] === UI.tab) ? UI.tab : 'resumen';
  let b = '';
  if (t === 'resumen' && PR) { b = (0, ENLACES.propResumen)(i); }
  else if (t === 'resumen') {
    const sug = ragSugerido(i), c = completitud(i), r = roi(i), f = forecast(i), d = desv(i);
    const idx = FASES_PRJ.indexOf(i.fase), nxt = FASES_PRJ[idx + 1];
    b = `${i.propuestaOrigen ? `<div class="pn-sec"><div class="note">${icon('bulb', 14)}<span>Nació de la propuesta ${iniLink(i.propuestaOrigen, i.propuestaOrigen + ' · ' + nameOf(i.propuestaOrigen))}</span></div></div>` : ''}${i.estadoMotivo ? `<div class="pn-sec"><div class="note warn">${icon('warn', 14)}<span><b>${esc(i.estado)}:</b> ${esc(i.estadoMotivo)}${i.estadoRev ? ' · revisión ' + fmtD(i.estadoRev) : ''}</span></div></div>` : ''}<div class="pn-sec"><div class="flow">${FASES_PRJ.map((x, k) => `<span class="${k < idx ? 'done' : k === idx ? 'cur' : ''}" title="${x}"></span>`).join('')}</div><div class="flow-l"><span>${i.fase}</span>${nxt && !isDone(i) ? `<a class="lnk" data-act="advance" data-id="${i.id}">Avanzar a ${nxt} →</a>` : ''}</div></div>
    <div class="pn-sec"><p class="desc">${esc(i.resumen || i.desc || 'Sin descripción.')}</p>${i.issue ? `<div class="note warn">${icon('warn', 14)} <span><b>Issue:</b> ${esc(i.issue)}</span></div>` : ''}</div>
    <div class="pn-sec"><div class="kvs mxk"><div class="mx-g"><h5>Avance</h5><div class="mx-t"><div><span>Real</span><b>${pct(i.avance)}</b>${prog(i.avance, i.rag, 5)}</div><div><span>Esperado</span><b>${FASES_ACT.includes(i.fase) ? pct(esperado(i)) : '—'}</b><small>según plan</small></div></div></div>
    <div class="mx-g"><h5>Finanzas</h5><div class="mx-t"><div><span>Presupuesto</span><b>${fmtMon(i.presupuesto, monOf(i)) + estTag(i, 'presupuesto')}</b></div><div><span>Consumido</span><b>${fmtMon(i.gastado, monOf(i))}</b><small>${i.presupuesto ? Math.round(i.gastado / i.presupuesto * 100) : 0}% del presupuesto</small></div><div><span>Beneficio esperado</span><b>${fmtMon(i.beneficio, monOf(i)) + estTag(i, 'beneficio')}</b></div><div><span>ROI</span><b>${r == null ? '—' : Math.round(r) + '%'}</b></div></div></div>
    <div class="mx-g"><h5>Plazos<em>${(St.cambios || []).filter(c => c.ini === i.id && c.estado === 'Aprobado').length} cambios aprobados</em></h5><div class="mx-t"><div><span>Inicio plan</span><b>${fmtD(i.inicioPlan)}</b></div><div><span>Fin plan</span><b>${fmtD(i.finPlan)}</b></div><div><span>Fin proyectado</span><b>${fmtD(f)}</b></div><div><span>Desviación</span><b>${d ? `<span style="color:var(--red)">+${d} d</span>` : '0 d'}</b></div></div></div></div></div>
    ${(0, ENLACES.controlHTML)(i)}<div class="pn-sec"><div class="kvs">${i.tipoIni ? kv('Tipo', esc(i.tipoIni)) : ''}${kv('Sponsor', esc(i.sponsor || '—') + estTag(i, 'sponsor'))}${kv('Líder', esc(i.lider || '—'))}${kv('Resp. negocio', esc(i.negocio || '—'))}${kv('Área', esc(i.area))}${kv('Categoría', esc(i.categoria))}${kv('Clasificación', esc(i.clasif) + ' · ' + esc(i.gasto))}${kv('Proveedor', esc(i.proveedor || '—'))}${kv('Origen', i.origen === 'real' ? 'Gene (real)' : i.origen === 'propuesta' ? 'Gene (propuesta)' : 'Demo / contexto')}</div></div>
    <div class="pn-sec"><h4>Salud (RAG)</h4><div class="rag-cmp">${ragPill(i.rag)} <span class="mut">actual</span> ${icon('chev', 13)} ${ragPill(sug.rag)} <span class="mut">sugerido</span></div>${sug.why.length ? `<small class="mut">Por: ${esc(sug.why.join(', '))}</small>` : '<small class="mut">Sin señales de alerta.</small>'}${sug.rag !== i.rag ? `<div style="margin-top:6px">${btn('Aplicar RAG sugerido', 'applyrag', { d: { id: i.id, rag: sug.rag }, cls: 'sm' })}</div>` : ''}</div>
    ${i.deps.length ? `<div class="pn-sec"><h4>Dependencias</h4>${i.deps.map(d => { const x = byId(d); return x ? `<button class="al" data-act="sel" data-t="ini" data-id="${x.id}">${ragPill(x.rag)}<span><b>${esc(x.titulo)}</b><small>${x.fase} · fin ${fmtD(forecast(x))}</small></span></button>` : ''; }).join('')}</div>` : ''}
    ${(() => { const dn = St.ini.filter(x => x.deps.includes(i.id)); return dn.length ? `<div class="pn-sec"><h4>Habilita a</h4>${dn.map(x => `<button class="al" data-act="sel" data-t="ini" data-id="${x.id}">${ragPill(x.rag)}<span><b>${esc(x.titulo)}</b><small>${x.fase}</small></span></button>`).join('')}</div>` : ''; })()}
    ${i.logros ? `<div class="pn-sec"><h4>Logros del ciclo</h4><p class="pre">${esc(i.logros)}</p></div>` : ''}${i.proximos ? `<div class="pn-sec"><h4>Próximos pasos</h4><p class="pre">${esc(i.proximos)}</p></div>` : ''}
    ${i.rec ? `<div class="pn-sec"><h4>Recomendación del último ciclo</h4><div class="note"><b style="color:${DEC_C[i.rec.accion]}">${i.rec.accion}</b> — ${esc(i.rec.motivo)}</div></div>` : ''}
    <div class="pn-sec"><h4>Calidad de datos · ${c.pct}%</h4>${prog(c.pct, c.pct > 80 ? 'Verde' : c.pct > 60 ? 'Ámbar' : 'Rojo', 5)}<small class="mut">${c.crit.length ? 'Críticos: ' + esc(c.crit.join(', ')) + '. ' : ''}${c.rec.length ? 'Recomendados: ' + esc(c.rec.join(', ')) + '.' : ''}</small></div>`;
  } else if (t === 'hitos') {
    b = `<div class="pn-sec"><div style="margin-bottom:8px">${btn('Nuevo hito', 'new', { d: { t: 'hito', ini: i.id }, ic: 'plus', cls: 'sm' })}</div>${hitosDe(i.id).sort(by('fecha')).map(h => { const e = hitoEstado(h); return `<div class="hrow"><input type="checkbox" ${h.completado ? 'checked' : ''} data-chg="hitotoggle" data-id="${h.id}" aria-label="Completado"><div><b class="${h.completado ? 'strike' : ''}">${esc(h.nombre)}</b><small style="color:${e.c}">${fmtD(h.fecha)} · ${e.t}</small></div>${(0, ENLACES.incChk)('hito', h.id)}<button class="icon-btn sm" data-act="edit" data-t="hito" data-id="${h.id}" aria-label="Editar">${icon('edit', 14)}</button></div>`; }).join('') || '<p class="mut">Sin hitos.</p>'}</div>`;
  } else if (t === 'riesgos') {
    b = `<div class="pn-sec"><div style="margin-bottom:8px">${btn('Nuevo riesgo', 'new', { d: { t: 'risk', ini: i.id }, ic: 'plus', cls: 'sm' })}</div>${riesgosDe(i.id).sort(by(r => -expo(r))).map(r => { const n = nivelRiesgo(r); return `<div class="al-w"><button class="al" data-act="sel" data-t="risk" data-id="${r.id}"><span class="expo" style="background:${n.c}">${expo(r)}</span><span><b>${esc(r.desc)}</b><small>${r.estado} · ${esc(r.dueno || 'sin dueño')}</small></span></button>${(0, ENLACES.incChk)('rsk', r.id)}</div>`; }).join('') || '<p class="mut">Sin riesgos registrados.</p>'}</div>`;
  } else if (t === 'actividad') {
    b = `<div class="pn-sec"><div class="composer"><input id="cmt" placeholder="Agregar comentario…" data-key="cmt"><button class="btn pri sm" data-act="comment" data-id="${i.id}">${icon('send', 13)}</button></div>${St.bitacora.filter(x => x.ini === i.id).slice(0, 25).map(x => `<div class="act"><span class="adot" style="background:${BIT_C[x.tipo]}"></span><div style="flex:1"><b>${esc(x.tipo)}</b> <small>${fmtTS(x.ts)} · ${esc(x.autor)}</small><label class="chk inc-l edit-only" title="Incluir esta nota en las presentaciones"><input type="checkbox" data-chg="bitpres" data-id="${esc(x.id)}" ${x.inPres === false ? '' : 'checked'}> <span>En presentación</span></label><p>${esc(x.texto)}</p></div></div>`).join('') || '<p class="mut">Sin actividad.</p>'}</div>`;
  } else if (t === 'alertas') {
    const fs = typeof ENLACES.insightsFor === 'function' ? (0, ENLACES.insightsFor)(i) : [];
    b = `<div class="pn-sec"><h4>Hallazgos de reglas</h4>${fs.map(f => `<div class="note ${f.sev === 3 ? 'bad' : f.sev === 2 ? 'warn' : ''}"><b>${esc(f.grupo)}:</b> ${esc(f.titulo)}<br><small>${esc(f.detalle)}</small></div>`).join('') || '<p class="mut">Sin hallazgos: cumple las reglas.</p>'}</div>
    <div class="pn-sec"><h4>Historial de avance</h4><div style="margin:6px 0">${spark(i.hist.map(x => x[1]), 300, 46)}</div><small class="mut">${i.hist.length} registros de ciclo</small></div>`;
  }
  const fin = isDone(i), canAprobar = PR && !fin && i.fase === 'Aprobación' && i.estado === 'Vigente';   // (Stand By no aprueba)
  return pnHead(`${tipoLbl(i)} ${i.id} · ${esc(i.area)}`, esc(i.titulo), `${PR ? '' : ragPill(i.rag)} ${(0, ENLACES.faseTag)(i)} ${estPill(i.estado)} ${prioPill(i.prioridad)} ${PR ? '' : (0, ENLACES.starsMini)(i)}`,
    `${!PR ? btn('1 a 1', 'reporte', { d: { id: i.id }, ic: 'slides', cls: 'sm', title: 'Reporte de avance 1 a 1 (forma A o B; guardar como PNG, PDF o HTML)' }) : ''}${btn('Informe', 'informe', { d: { id: i.id }, ic: 'slides', cls: 'sm', title: 'Informe de estado listo para copiar' })}<span class="edit-only">${!PR && !fin && !esSB(i) ? btn('Actualizar', 'wk', { d: { id: i.id }, ic: 'refresh', cls: 'sm pri', title: 'Actualización semanal en 60 segundos' }) : ''}${btn('Con archivo', 'proyarch', { d: { id: i.id }, ic: 'spark', cls: 'sm', title: 'Descargar este proyecto para completarlo con un archivo y subir lo completado' })}${btn('Editar', 'edit', { d: { t: 'ini', id: i.id }, ic: 'edit', cls: 'sm' })}${fin ? '' : btn(canAprobar ? 'Aprobar / cambiar etapa' : 'Cambiar etapa', 'etapa', { d: { id: i.id }, ic: 'chev', cls: 'sm' + (canAprobar ? ' pri' : ''), title: 'Mover de fase, cambiar el estado, aprobar o completar (con sus compuertas)' })}${fin && !PR ? btn('Reabrir', 'reabrirPrj', { d: { id: i.id }, ic: 'refresh', cls: 'sm', title: 'Solo Administra: vuelve el proyecto a En curso' }) : ''}${PR && ['Rechazada', 'Retirada'].includes(i.estado) ? btn('Reabrir', 'reopen', { d: { id: i.id }, ic: 'undo', cls: 'sm' }) : ''}</span>${PR ? '' : btn('Gantt', 'ganttfocus', { d: { id: i.id }, ic: 'gantt', cls: 'sm' })}${btn('Presentar', 'presentar', { d: { id: i.id }, ic: 'slides', cls: 'sm' })}`) +
    `<div class="tabs sm">${tabs.map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-act="ptab" data-tab="${k}">${n}</button>`).join('')}</div><div class="pn-b">${b}</div>`;
}
export function panelRisk(r) {
  const n = nivelRiesgo(r), i = byId(r.ini);
  return pnHead('Riesgo · ' + r.id, esc(r.desc), `<span class="pill" style="--c:${n.c}">${n.n} · ${expo(r)}</span> <span class="pill soft">${r.estado}</span> <span class="pill soft">${esc(r.cat)}</span>`, `<span class="edit-only">${btn('Editar', 'edit', { d: { t: 'risk', id: r.id }, ic: 'edit', cls: 'sm' })}</span>`) +
    `<div class="pn-b"><div class="pn-sec"><div class="kvs">${kv('Iniciativa', iniLink(r.ini))}${kv('Probabilidad', r.prob + ' / 5')}${kv('Impacto', r.imp + ' / 5')}${kv('Exposición', `<span style="color:${n.c}">${expo(r)}</span>`)}${kv('Dueño', esc(r.dueno || '—'))}${kv('Identificado', fmtD(r.fIdent))}${kv('Próxima revisión', fmtD(r.fRev))}</div></div><div class="pn-sec"><h4>Plan de mitigación</h4><p class="desc">${esc(r.mit || 'Sin plan de mitigación definido.')}</p></div></div>`;
}
export function panelHito(h) {
  const e = hitoEstado(h);
  return pnHead('Hito · ' + h.id, esc(h.nombre), `<span class="pill" style="--c:${e.c}">${e.t}</span>`, `<span class="edit-only">${btn('Editar', 'edit', { d: { t: 'hito', id: h.id }, ic: 'edit', cls: 'sm' })}${btn(h.completado ? 'Reabrir' : 'Completar', 'hitotoggle', { d: { id: h.id }, ic: 'check', cls: 'sm' })}</span>`) +
    `<div class="pn-b"><div class="pn-sec"><div class="kvs">${kv('Iniciativa', iniLink(h.ini))}${kv('Fecha plan', fmtD(h.fecha))}${kv('Fecha real', fmtD(h.fechaReal))}${kv('Responsable', esc(h.resp || '—'))}</div></div></div>`;
}
export function panelDec(d) {
  return pnHead('Decisión · ' + d.id, esc(d.titulo), `<span class="pill" style="--c:${DEC_C[d.tipo]}">${d.tipo}</span> <span class="pill soft">${d.estado}</span>`, `<span class="edit-only">${d.estado === 'Pendiente' ? btn('Resolver', 'resolvedec', { d: { id: d.id }, ic: 'check', cls: 'sm pri' }) : ''}${btn('Editar', 'edit', { d: { t: 'dec', id: d.id }, ic: 'edit', cls: 'sm' })}</span>`) +
    `<div class="pn-b"><div class="pn-sec"><div class="kvs">${kv('Iniciativa', iniLink(d.ini))}${kv('Fecha límite', fmtD(d.limite) + (d.estado === 'Pendiente' && d.limite < hoy() ? ' <span style="color:var(--red)">vencida</span>' : ''))}${kv('Solicitada por', esc(d.solicita))}${kv('Comité', esc(d.comite || '—'))}${kv('Resolución', fmtD(d.fResol))}</div></div><div class="pn-sec"><h4>Recomendación</h4><p class="desc">${esc(d.recomendacion || '—')}</p></div>${d.resolucion ? `<div class="pn-sec"><h4>Resolución</h4><p class="desc">${esc(d.resolucion)}</p></div>` : ''}</div>`;
}

/* ---------- búsqueda global ---------- */
function gsearch(q) {
  const box = $('#gsres'); q = (q || '').trim().toLowerCase(); if (!q) { box.classList.remove('open'); return; }
  const m = [];
  St.ini.forEach(i => { if ((i.titulo + ' ' + i.id + ' ' + i.lider + ' ' + i.sponsor + ' ' + i.proveedor).toLowerCase().includes(q)) m.push({ t: 'ini', id: i.id, l: i.titulo, s: i.id + ' · ' + i.fase, ic: 'list' }); });
  St.riesgos.forEach(r => { if ((r.desc + ' ' + r.id).toLowerCase().includes(q)) m.push({ t: 'risk', id: r.id, l: r.desc, s: r.id + ' · riesgo ' + expo(r), ic: 'shield' }); });
  HITOS().forEach(h => { if (h.nombre.toLowerCase().includes(q)) m.push({ t: 'hito', id: h.id, l: h.nombre, s: 'Hito · ' + nameOf(h.ini), ic: 'flag' }); });
  DECS().forEach(d => { if ((d.titulo + d.id).toLowerCase().includes(q)) m.push({ t: 'dec', id: d.id, l: d.titulo, s: d.id + ' · decisión ' + d.tipo, ic: 'gavel' }); });
  St.ini.forEach(i => (i.subfases || []).forEach(sf => { if (String(sf.nombre || '').toLowerCase().includes(q)) m.push({ t: 'ini', id: i.id, l: sf.nombre, s: 'Subfase · ' + i.titulo, ic: 'list' }); }));   /* N-U-16 */
  box.innerHTML = m.slice(0, 9).map(x => `<button data-act="gsel" data-t="${x.t}" data-id="${x.id}">${icon(x.ic, 15)}<span><b>${esc(x.l)}</b><small>${esc(x.s)}</small></span></button>`).join('') || '<div class="empty-s">Sin resultados</div>';
  box.classList.add('open');
}

/* ---------- eventos globales ---------- */
document.addEventListener('click', e => {
  if (!e.target.closest('.popw')) closePops();
  if (!e.target.closest('.gsearch')) { const g = $('#gsres'); if (g) g.classList.remove('open'); }
  if (e.target.closest('[data-nostop]')) return;   // el control maneja su propio clic (no abre la fila)
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act; if (Acts[a]) { e.preventDefault(); Acts[a](el.dataset, el, e); }
});
document.addEventListener('input', e => { const r = e.target; if (r && r.dataset && r.dataset.rng != null && r.nextElementSibling) r.nextElementSibling.textContent = r.value + r.dataset.rng; });
document.addEventListener('submit', e => { if (e.target && e.target.id === 'mform') e.preventDefault(); }, true);
document.addEventListener('input', e => { const el = e.target.closest('[data-chg]'); if (!el) return; if (['text', 'search'].includes(el.type) || el.tagName === 'TEXTAREA') { const f = Chg[el.dataset.chg]; if (f && el.dataset.live !== 'no') { clearTimeout(Chg._dt); Chg._dt = setTimeout(() => f(el, e), 180); } } });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (!el) return; if (['text', 'search'].includes(el.type) || el.tagName === 'TEXTAREA') return; const f = Chg[el.dataset.chg]; if (f) f(el, e); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('#modal')) Modal.close(); else closePops(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article.icard[data-act],[role=button][data-act]:not(button)') && e.target === document.activeElement) { e.preventDefault(); e.target.click(); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#modal')) { e.preventDefault(); $('#gs').focus(); }
  if (e.key === 'Enter' && $('#modal') && e.target.tagName === 'INPUT' && Modal.cur && Modal.cur.form) { e.preventDefault(); Acts.msave(); }
});
Acts.mclose = () => Modal.close();
Acts.ftab = d => { $$('.ftabs button').forEach(b => b.classList.toggle('on', b.dataset.t === d.t)); $$('.ftab').forEach(x => x.classList.toggle('on', x.dataset.t === d.t)); };
Acts.msave = () => { const o = Modal.cur && Modal.cur.form; if (!o) return; const { out, errs } = readForm(); if (errs.length) { toast('Completa: ' + errs.join(', '), 'err'); const bad = $('#mform .bad'); if (bad) { const tp = bad.closest('.ftab'); if (tp && !tp.classList.contains('on')) Acts.ftab({ t: tp.dataset.t }); bad.scrollIntoView({ block: 'center' }); bad.focus(); } return; } const r = o.onSave(out); if (r && typeof r.then === 'function') { const bt = $('#mform') && $('[data-act="msave"]'); if (bt) bt.disabled = true; r.then(ok => { if (bt) bt.disabled = false; if (ok !== false && Modal.cur && Modal.cur.form === o) Modal.close(); }); return; } if (r !== false) Modal.close(); };
Acts.mdanger = () => { const o = Modal.cur.form; if (o.onDanger) { const f = o.onDanger; Modal.close(); f(); } };
Acts.mconfirm = () => { const y = Modal.cur && Modal.cur.yes; Modal.close(); if (y) y(); };
Acts.go = d => go(d.v);
Acts.pop = d => popToggle(d.id);
Acts.side = () => $('#app').classList.toggle('side-open');
Acts.gstog = () => { const t = $('.top'); if (!t) return; t.classList.toggle('gs-open'); if (t.classList.contains('gs-open')) setTimeout(() => { const g = $('#gs'); if (g) g.focus(); }, 30); };
document.addEventListener('click', e => { const ap = $('#app'); if (ap && ap.classList.contains('side-open') && !e.target.closest('#side, [data-act=side]')) ap.classList.remove('side-open'); const t = $('.top'); if (t && t.classList.contains('gs-open') && !e.target.closest('.gsearch, [data-act=gstog]')) t.classList.remove('gs-open'); });
Acts.panel = () => { UI.panel = !UI.panel; renderChrome(); saveUI(); };
Acts.sel = d => selectEntity(d.t, d.id);
Acts.gfix = d => { Modal.close(); selectEntity('ini', d.id); };   // U-12: lleva a la ficha para corregir la compuerta
Acts.panelx = () => { UI.sel = null; UI.panel = false; renderChrome(); renderPanel(); saveUI(); };
Acts.unsel = () => { UI.sel = null; renderPanel(); saveUI(); };
document.addEventListener('keydown', e => {   /* N-U-16: ↓/↑/Enter en la búsqueda global */
  const g = e.target && e.target.id === 'gs' ? e.target : null, box = $('#gsres'); if (!g || !box || !box.classList.contains('open')) return;
  const bs = $$('button', box); if (!bs.length) return; const cur = bs.findIndex(b => b.classList.contains('kb'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = (cur + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, k) => b.classList.toggle('kb', k === n)); bs[n].scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { e.preventDefault(); (bs[cur >= 0 ? cur : 0]).click(); }
  else if (e.key === 'Escape') box.classList.remove('open');
});
Acts.gsel = d => { $('#gsres').classList.remove('open'); $('#gs').value = ''; selectEntity(d.t, d.id); };
Acts.ptab = d => { UI.tab = d.tab; renderPanel(); };
Acts.alertgo = d => { closePops(); if (d.id) selectEntity('ini', d.id, 'alertas'); else go('analisis'); };
Chg.gsearch = el => gsearch(el.value);
Chg.areaG = el => { St.cfg.areaGlobal = el.value; refresh(); };

Acts.navg = () => { UI.navOpen = UI.navOpen === false; renderChrome(); };

/* =====================================================================
   UX transversal V4: tema oscuro, breadcrumbs, banner de conexión, estado de
   sincronización, comandos rápidos (Ctrl+K) y exportación Excel (.xlsx nativo)
   ===================================================================== */

/* ---------- tema ---------- */
export function applyTheme() {
  document.documentElement.dataset.theme = UI.theme || 'light';
  const b = $('#themeBtn'); if (b) b.innerHTML = icon(UI.theme === 'dark' ? 'sun' : 'moon', 18);
}
Acts.theme = () => { UI.theme = UI.theme === 'dark' ? 'light' : 'dark'; applyTheme(); render(); };

/* ---------- breadcrumbs ---------- */
function crumbs() {
  const sec = (NAV.find(n => n[0] === UI.view) || [0, ''])[1], s = UI.sel; let leaf = '';
  if (s) {
    if (s.t === 'ini' && byId(s.id)) leaf = byId(s.id).titulo;
    else if (s.t === 'risk') { const r = St.riesgos.find(x => x.id === s.id); if (r) leaf = r.id + ' · ' + r.desc; }
    else if (s.t === 'hito') { const h = St.hitos.find(x => x.id === s.id); if (h) leaf = h.nombre; }
    else if (s.t === 'dec') { const d = St.decisiones.find(x => x.id === s.id); if (d) leaf = d.titulo; }
  }
  const ar = St.cfg.areaGlobal !== 'Todas' ? `<span class="cr-tag">Área: ${esc(St.cfg.areaGlobal)}</span>` : '';
  return `<nav class="crumbs" aria-label="Ruta"><a data-act="go" data-v="dashboard" href="#/dashboard">APIH</a>${icon('chev', 12)}<a data-act="go" data-v="${UI.view}" href="#/${UI.view}">${esc(sec)}</a>${leaf ? icon('chev', 12) + `<span class="cr-leaf">${esc(leaf.length > 70 ? leaf.slice(0, 68) + '…' : leaf)}</span>` : ''}${ar}</nav>`;
}

/* ---------- estado de sincronización ---------- */
export function syncInfo() {
  const d = DataService, s = d.st;
  if (d.svc && s.state === 'syncing') return { c: 'sy', t: 'Guardando' + (s.pending ? ' · ' + s.pending : '') + '…', tip: s.msg };
  if (d.svc && s.state === 'error') return { c: 'er', t: 'Error de sync' + (s.pending ? ' · ' + s.pending : ''), tip: s.err };
  if (d.svc) return { c: 'ok', t: 'Guardado', tip: 'Conectado a ' + BK() + (s.last ? ' · último sync ' + s.last.toTimeString().slice(0, 5) : '') + (s.pending ? ' · ' + s.pending + ' pendiente(s)' : '') + (s.msLoad ? ' · carga ' + (s.msLoad / 1000).toFixed(1) + ' s' : '') + (s.msSave ? ' · último guardado ' + (s.msSave / 1000).toFixed(1) + ' s' : '') };
  if (s.state === 'auth') return { c: 'au', t: 'Iniciar sesión', tip: s.msg };
  if (s.state === 'error' || d.offlineWhy) return { c: 'er', t: 'Sin servidor · demo', tip: s.err || d.offlineWhy };
  return { c: 'de', t: 'Sin conexión', tip: 'Sin el servidor no hay datos ni se puede editar. Configure la conexión en Administración.' };
}
function updateSyncUI() {
  const i = syncInfo(), c = $('#syncChip'); if (c) { c.className = 'sync ' + i.c; c.innerHTML = '<i></i>' + esc(i.t); c.title = i.tip; }
  const f = $('#sideSync'); if (f) f.innerHTML = `<span class="dot-s ${i.c}"></span> ${esc(i.t)}<br><small>${esc(i.tip.length > 60 ? i.tip.slice(0, 58) + '…' : i.tip)}</small>`;
  const b = $('#bannerBox'); if (b) b.innerHTML = banner();
  const t = $('#themeBtn'); if (t && !t.innerHTML) t.innerHTML = icon(UI.theme === 'dark' ? 'sun' : 'moon', 18);
  const h = $('#hdate'); if (h) h.innerHTML = icon('cal', 14) + ' ' + fmtDL(hoy());
}
Acts.syncgo = () => { F('adm', {}).tab = 'sp'; go('admin'); };

/* ---------- banner contextual ---------- */
export function banner() {
  const d = DataService, s = d.st, out = [];
  if (AuthService.needsLogin && s.state === 'auth') out.push(['info', 'Inicie sesión con su correo corporativo para cargar los datos.', btn('Iniciar sesión', 'login', { cls: 'pri sm' })]);
  else if (!d.svc && d.offlineWhy && !UI.bnOff) out.push(['warn', '<b>Sin conexión a ' + BK() + ':</b> ' + esc(d.offlineWhy) + '. Sin el servidor la aplicación queda en solo lectura: no hay datos ni cambios locales.', btn('Reintentar', 'spretry', { cls: 'sm' }) + btn('Configurar', 'syncgo', { cls: 'sm' }) + btn('Ocultar', 'bnoff', { cls: 'sm' })]);
  if (d.svc && St.empty && !UI.bnOff2) out.push(['info', '<b>Las listas de ' + BK() + ' están vacías.</b> Puede cargar los datos del archivo original o comenzar a registrar propuestas.', btn('Cargar datos del archivo', 'spseed', { cls: 'pri sm' }) + btn('Ocultar', 'bnoff2', { cls: 'sm' })]);
  if (d.svc && s.state === 'error' && s.pending) out.push(['bad', '<b>Cambios sin sincronizar (' + s.pending + ').</b> ' + esc(s.err || ''), btn('Reintentar ahora', 'spretry', { cls: 'sm' })]);
  return out.map(([k, t, a]) => `<div class="banner ${k}">${icon(k === 'info' ? 'db' : 'warn', 16)}<span>${t}</span><div class="chips">${a || ''}</div></div>`).join('');
}
Acts.bnoff = () => { UI.bnOff = true; updateSyncUI(); };
Acts.bnoff2 = () => { UI.bnOff2 = true; updateSyncUI(); };
Acts.login = async () => {
  try { await AuthService.login(); toast('Sesión iniciada'); await Acts.spretry(); }
  catch (e) { toast('No se pudo iniciar sesión: ' + e.message, 'err'); }
};
Acts.spretry = async () => {
  const d = DataService;
  if (d.svc) { await d.flush(); return d.refresh(false, false); }
  const S = await d.init(); ENLACES.St = S; UI.sel = null; shell(); render(); toast(d.svc ? 'Conectado a ' + BK() : 'Sigue sin conexión: ' + (d.offlineWhy || d.st.err), d.svc ? 'ok' : 'err');
};
export function BK() { return 'Supabase'; }
/* Avance de la fase activa (V23): calculado con sus subfases e hitos; sin unidades en la fase, el avance general. Ya no hay valor manual por fase. */
export function avFase(i) {
  const p = (0, ENLACES.avanceFaseCalc)(i, i.fase);
  if (p != null) return { v: Math.round(p * 100), src: 'hitos' };
  return { v: Math.round(i.avance || 0), src: 'general' };
}
export const avFaseTip = i => avFase(i).src === 'hitos' ? 'Fase ' + i.fase + ': calculado con sus subfases e hitos' : 'Fase ' + i.fase + ': sin hitos en la fase, se usa el avance general';
Acts.spseed = () => confirmBox('Se crearán en ' + BK() + ' ~' + (seedState().ini.length + seedState().hitos.length + seedState().riesgos.length + seedState().bitacora.length) + ' elementos (datos del archivo original) en las listas APIH_*. ¿Continuar?', async () => {
  try { await DataService.seedRemote(); delete St.empty; toast('Datos cargados en ' + BK()); render(); } catch (e) { toast(e.message, 'err'); }
}, 'Cargar');

/* ---------- comandos rápidos (Ctrl+K) ---------- */
const CK = { items: [], sel: 0 };
function ckCommands() {
  const C = [];
  NAV.forEach(([k, t, ic]) => C.push({ g: 'Ir a', t, ic, run: () => go(k) }));
  [['prop', 'Nueva propuesta', 'bulb'], ['prj', 'Nuevo proyecto (alta directa)', 'list'], ['risk', 'Nuevo riesgo', 'shield'], ['hito', 'Nuevo hito', 'flag'], ['dec', 'Nueva decisión', 'gavel'], ['com', 'Nuevo comité', 'users']]
    .forEach(([t, l, ic]) => C.push({ g: 'Crear', t: l, ic, run: () => Acts.new({ t }) }));
  C.push({ g: 'Acción', t: 'Cambiar tema claro / oscuro', ic: 'sun', run: () => Acts.theme() });
  C.push({ g: 'Acción', t: 'Mostrar / ocultar panel contextual', ic: 'panel', run: () => Acts.panel() });
  C.push({ g: 'Acción', t: 'Exportar Portfolio a Excel', ic: 'down', run: () => Acts.pxlsx() });
  C.push({ g: 'Acción', t: 'Exportar Portfolio a JSON', ic: 'down', run: () => Acts.pjson() });
  C.push({ g: 'Acción', t: 'Generar presentación ejecutiva', ic: 'slides', run: () => go('presentaciones') });
  C.push({ g: BK(), t: 'Sincronizar ahora / recargar desde ' + BK(), ic: 'refresh', run: () => Acts.spretry() });
  C.push({ g: BK(), t: 'Configuración de conexión', ic: 'db', run: () => Acts.syncgo() });
  if (St.cfg.areas) St.cfg.areas.forEach(a => C.push({ g: 'Filtro global', t: 'Filtrar por área: ' + a, ic: 'filter', run: () => { St.cfg.areaGlobal = a; refresh(); } }));
  C.push({ g: 'Filtro global', t: 'Quitar filtro de área', ic: 'filter', run: () => { St.cfg.areaGlobal = 'Todas'; refresh(); } });
  return C;
}
function ckList(q) {
  q = (q || '').trim().toLowerCase(); let L = ckCommands();
  if (q) {
    L = L.filter(c => (c.g + ' ' + c.t).toLowerCase().includes(q));
    if (q.length >= 2) St.ini.forEach(i => { if ((i.titulo + ' ' + i.id + ' ' + (i.lider || '')).toLowerCase().includes(q)) L.push({ g: 'Iniciativa', t: i.titulo, sub: i.id + ' · ' + i.fase, ic: 'list', run: () => selectEntity('ini', i.id) }); });
  }
  return L.slice(0, 12);
}
function ckRender() {
  const box = $('#ckList'); if (!box) return;
  box.innerHTML = CK.items.map((c, n) => `<button class="${n === CK.sel ? 'on' : ''}" data-act="ckrun" data-n="${n}">${icon(c.ic, 16)}<span><b>${esc(c.t)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}</span><em>${esc(c.g)}</em></button>`).join('') || '<div class="empty-s">Sin coincidencias</div>';
}
Acts.cmdk = () => {
  if ($('#cmdk')) return ckClose();
  const m = document.createElement('div'); m.id = 'cmdk'; m.className = 'modal-bg ck-bg';
  m.innerHTML = `<div class="ck" role="dialog" aria-label="Comandos rápidos"><div class="ck-i">${icon('search', 16)}<input id="ckIn" placeholder="Escribe un comando o busca un proyecto o propuesta…" autocomplete="off"><kbd>Esc</kbd></div><div id="ckList" class="ck-l"></div><div class="ck-f"><span>↑↓ navegar</span><span>↵ ejecutar</span><span>Ctrl+K cerrar</span></div></div>`;
  m.addEventListener('mousedown', e => { if (e.target === m) ckClose(); });
  document.body.appendChild(m); CK.sel = 0; CK.items = ckList(''); ckRender(); $('#ckIn').focus();
  $('#ckIn').addEventListener('input', e => { CK.sel = 0; CK.items = ckList(e.target.value); ckRender(); });
  $('#ckIn').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); CK.sel = Math.min(CK.items.length - 1, CK.sel + 1); ckRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); CK.sel = Math.max(0, CK.sel - 1); ckRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); Acts.ckrun({ n: CK.sel }); }
    else if (e.key === 'Escape') { e.stopPropagation(); ckClose(); }
  });
};
function ckClose() { const m = $('#cmdk'); if (m) m.remove(); }
Acts.ckrun = d => { const c = CK.items[+d.n]; ckClose(); if (c) c.run(); };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Acts.cmdk(); } });

/* ---------- escritor .xlsx nativo (ZIP sin compresión, sin librerías) ---------- */
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipStore(files, mime) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const u16 = n => [n & 255, n >>> 8 & 255], u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
  files.forEach(f => {
    const nm = enc.encode(f.name), d = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(d);
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0]);
    parts.push(lh, nm, d);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), nm);
    off += lh.length + nm.length + d.length;
  });
  const cl = cen.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), 0, 0]);
  return new Blob([...parts, ...cen, end], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function xlsxBlob(sheets) {   // sheets: [{name, rows:[[...]]}] (fila 0 = encabezados)
  const X = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const names = sheets.map((s, i) => X(s.name.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Hoja' + (i + 1)));
  const sheetXml = s => {
    const nc = Math.max(...s.rows.map(r => r.length));
    const w = Array.from({ length: nc }, (_, c) => Math.min(60, Math.max(8, ...s.rows.slice(0, 60).map(r => String(r[c] == null ? '' : r[c]).length + 2))));
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, c) => {
      const ref = col(c) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
      if (v == null || v === '') return '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      if (typeof v === 'boolean') return `<c r="${ref}"${st} t="b"><v>${v ? 1 : 0}</v></c>`;
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${col(nc - 1)}${s.rows.length}"/></worksheet>`;
  };
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Segoe UI"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F6CBD"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
  ];
  return zipStore(files);
}
export function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
/* Hoja con las columnas de la entidad (sin DatosJSON) */
function listSheet(ent) {
  const S = ESQUEMA[ent], arr = (St[S.coll] || []).filter(S.filter || (() => true));
  return { name: S.label, rows: [S.cols.map(c => c.n), ...arr.map(o => S.cols.map(c => { let v = c.get ? c.get(o) : o[c.k]; if (c.t === 'Date' && v) v = String(v).slice(0, 10); if (c.t === 'DateTime' && v) v = String(o.ts || v).replace('T', ' ').slice(0, 16); return v == null ? '' : v; }))] };
}
Acts.xlsxall = () => { downloadBlob('APIH_listas_' + hoy() + '.xlsx', xlsxBlob(Object.keys(ESQUEMA).map(listSheet))); toast('Excel exportado (una hoja por entidad)'); };
/* ============================================================
   APIH · Carga de planificación e hitos desde Excel
   Plantilla descargable + lector .xlsx propio (sin librerías) + vista previa con validación
   ============================================================ */
const CX = { res: null, name: '' };
const _nz = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function zipRead(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('El archivo no es un .xlsx válido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let k = 0; k < n; k++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + csz);
    out[name] = async () => meth === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }
  return out;
}
async function readXlsx(buf) {
  const Z = await zipRead(buf), txt = async n => Z[n] ? new TextDecoder().decode(await Z[n]()) : '', dom = s => new DOMParser().parseFromString(s, 'application/xml');
  const wb = dom(await txt('xl/workbook.xml')), rels = dom(await txt('xl/_rels/workbook.xml.rels'));
  const rel = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => rel[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ss = []; const sx = await txt('xl/sharedStrings.xml'); if (sx) [...dom(sx).getElementsByTagName('si')].forEach(si => ss.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')));
  const colN = r => { let n = 0; for (const ch of r.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const sheets = [];
  for (const s of [...wb.getElementsByTagName('sheet')]) {
    let t = rel[s.getAttribute('r:id')] || rel[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')] || ''; t = t.replace(/^\//, ''); if (!t.startsWith('xl/')) t = 'xl/' + t;
    const xd = dom(await txt(t)), rows = [];
    [...xd.getElementsByTagName('row')].forEach(r => {
      const ri = +r.getAttribute('r') - 1, arr = [];
      [...r.getElementsByTagName('c')].forEach(c => {
        const ci = colN(c.getAttribute('r')), ty = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
        let val = null;
        if (ty === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (v) { val = v.textContent; if (ty === 's') val = ss[+val] || ''; else if (ty === 'b') val = val === '1'; else if (ty !== 'str' && ty !== 'e' && val !== '' && !isNaN(+val)) val = +val; }
        arr[ci] = val;
      });
      rows[ri] = arr;
    });
    sheets.push({ name: s.getAttribute('name'), rows: Array.from(rows, r => r || []) });
  }
  return sheets;
}
const CX_PLAN = ['ID Iniciativa', 'Nombre (referencia)', 'Inicio plan', 'Fin plan', 'Inicio real', 'Fin real', 'Avance %', 'Presupuesto', 'Gastado'];
const CX_HITO = ['ID Iniciativa', 'Hito', 'Fase', 'Fecha plan', 'Fecha real', 'Responsable', 'Completado (Sí/No)'];
function cxEditables() { return St.ini.filter(i => (0, ENLACES.puedeEditarIni)(i) && !(0, ENLACES.soloLectura)()).slice().sort(by('id')); }
function cxTemplate(conDatos) {
  const L = cxEditables(), ex = !conDatos || !L.length;
  const plan = [CX_PLAN, ...(ex ? [['PRJ-001', 'Ejemplo: nombre del proyecto', '2026-03-01', '2026-09-30', '2026-03-05', '', 35, 120, 40]] : L.map(i => [i.id, i.titulo, i.inicioPlan || '', i.finPlan || '', i.inicioReal || '', i.finReal || '', Math.round(i.avance || 0), i.presupuesto || '', i.gastado || '']))];
  const H = St.hitos.filter(h => L.some(i => i.id === h.ini)).slice().sort(by(h => h.ini + h.fecha));
  const hit = [CX_HITO, ...(ex ? [['PRJ-001', 'Ejemplo: Pruebas de aceptación', 'Ejecución', '2026-06-15', '', 'Nombre Apellido', 'No']] : H.map(h => [h.ini, h.nombre, h.fase || '', h.fecha || '', h.fechaReal || '', h.resp || '', h.completado ? 'Sí' : 'No']))];
  const ins = [['Instrucciones'],
    ['1. Complete las hojas «Planificación» y «Hitos». No cambie los títulos de las columnas ni el nombre de las hojas.'],
    ['2. «ID Iniciativa» es obligatorio y debe existir en APIH (ej. PRJ-001). Solo se cargan iniciativas que tú puedes editar.'],
    ['3. Fechas en formato AAAA-MM-DD (también se acepta DD-MM-AAAA o fecha de Excel). Avance de 0 a 100. Presupuesto y Gastado en la unidad configurada.'],
    ['4. Celda vacía = no se modifica ese dato. Las filas de una hoja no listadas no se tocan (no se borra nada).'],
    ['5. Hitos: se identifican por ID Iniciativa + nombre del hito. Si existe, se actualiza; si no, se crea (requiere Fecha plan).'],
    ['6. «Completado»: Sí/No. Si indica Fecha real sin marcar Completado, el hito queda completado.'],
    ['7. Fase (opcional): ' + FASES.join(' · ')],
    ['8. Sube el archivo en «Cargar Excel»: verás una vista previa con errores antes de aplicar cambios.'],
    ['9. Esta carga actualiza planificación e hitos de proyectos que YA existen en APIH; no crea proyectos nuevos. Las filas que dicen «Ejemplo:» se ignoran.']];
  return xlsxBlob([{ name: 'Instrucciones', rows: ins }, { name: 'Planificación', rows: plan }, { name: 'Hitos', rows: hit }]);
}
const cxDate = v => {
  if (v == null || v === '') return { v: '' };
  if (typeof v === 'number') { if (v > 20000 && v < 90000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return { v: d.toISOString().slice(0, 10) }; } return { e: 1 }; }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), y, mo, d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]]; else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3] < 100 ? 2000 + +m[3] : +m[3]]; else return { e: 1 };
  const dt = new Date(y, mo - 1, d); if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { e: 1 };
  return { v: y + '-' + pad(mo) + '-' + pad(d) };
};
const cxBool = v => ['si', 's', '1', 'true', 'x', 'yes', 'completado'].includes(_nz(v));
function cxSheet(sheets, names) { return sheets.find(s => names.includes(_nz(s.name))); }
function cxTable(sh, cols) {   // mapea encabezados (tolerante a tildes/mayúsculas) → [{n, r:{col→valor}}]
  if (!sh || !sh.rows.length) return null;
  let hi = sh.rows.findIndex(r => r.some(c => _nz(c) === 'id iniciativa')); if (hi < 0) return null;
  const idx = {}; cols.forEach(c => { const j = sh.rows[hi].findIndex(h => _nz(h) === _nz(c) || _nz(c).startsWith(_nz(h) + ' ') || _nz(h).startsWith(_nz(c) + ' ')); if (j >= 0) idx[c] = j; });
  return sh.rows.slice(hi + 1).map((r, k) => ({ n: hi + k + 2, g: c => idx[c] == null ? undefined : r[idx[c]] })).filter(x => cols.some(c => { const v = x.g(c); return v != null && v !== ''; }));
}
function cxParse(sheets) {
  const R = { plan: [], hitos: [], errs: [], warns: [], vacio: false }, ok = i => i && (0, ENLACES.puedeEditarIni)(i);
  const sp = cxSheet(sheets, ['planificacion', 'plan']), sh = cxSheet(sheets, ['hitos', 'hito']);
  const tp = cxTable(sp, CX_PLAN), th = cxTable(sh, CX_HITO);
  if (!tp && !th) { R.errs.push('No se encontraron las hojas «Planificación» u «Hitos» con la columna «ID Iniciativa». Use la plantilla.'); return R; }
  const E = (h, n, m) => R.errs.push(`${h} · fila ${n}: ${m}`), Wn = (h, n, m) => R.warns.push(`${h} · fila ${n}: ${m}`);   // E = error (se omite la fila) · Wn = aviso (se aplica, pero conviene revisar)
  (tp || []).forEach(x => {
    const id = String(x.g('ID Iniciativa') || '').trim(), i = byId(id);
    if (/^ejemplo:/i.test(String(x.g(CX_PLAN[1]) || '').trim())) return;   // fila de ejemplo de la plantilla
    if (!id) return E('Planificación', x.n, 'falta ID Iniciativa'); if (!i) return E('Planificación', x.n, `la iniciativa ${id} no existe`); if (!ok(i)) return E('Planificación', x.n, `sin permiso para editar ${id}`);
    const ch = {}, bad = [];
    [['Inicio plan', 'inicioPlan'], ['Fin plan', 'finPlan'], ['Inicio real', 'inicioReal'], ['Fin real', 'finReal']].forEach(([c, k]) => { const d = cxDate(x.g(c)); if (d.e) bad.push(c + ' inválida'); else if (d.v && d.v !== i[k]) ch[k] = d.v; });
    [['Avance %', 'avance', 0, 100], ['Presupuesto', 'presupuesto', 0, 1e12], ['Gastado', 'gastado', 0, 1e12]].forEach(([c, k, lo, hi]) => { let v = x.g(c); if (v == null || v === '') return; if (typeof v === 'string') v = parseFloat(v.replace('%', '').replace(/\./g, '').replace(',', '.')); if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) bad.push(c + ' inválido'); else if (v !== i[k]) ch[k] = v; });
    const ip = ch.inicioPlan || i.inicioPlan, fp = ch.finPlan || i.finPlan; if (ip && fp && fp < ip) bad.push('Fin plan anterior a Inicio plan');
    if (bad.length) return E('Planificación', x.n, `${id}: ${bad.join(', ')}`);
    if (Object.keys(ch).length) R.plan.push({ i, ch });
  });
  const seen = new Set();
  (th || []).forEach(x => {
    const id = String(x.g('ID Iniciativa') || '').trim(), i = byId(id), nm = String(x.g('Hito') || '').trim();
    if (/^ejemplo:/i.test(nm)) return;   // fila de ejemplo de la plantilla
    if (!id) return E('Hitos', x.n, 'falta ID Iniciativa'); if (!i) return E('Hitos', x.n, `la iniciativa ${id} no existe`); if (!ok(i)) return E('Hitos', x.n, `sin permiso para editar ${id}`); if (!nm) return E('Hitos', x.n, 'falta el nombre del hito');
    const key = id + '|' + _nz(nm); if (seen.has(key)) return E('Hitos', x.n, `hito repetido en el archivo: ${nm}`); seen.add(key);
    const cur = St.hitos.find(h => h.ini === id && _nz(h.nombre) === _nz(nm)), v = {}, bad = [];
    const f = cxDate(x.g('Fecha plan')), fr = cxDate(x.g('Fecha real')); if (f.e) bad.push('Fecha plan inválida'); else if (f.v) v.fecha = f.v; if (fr.e) bad.push('Fecha real inválida'); else if (fr.v) v.fechaReal = fr.v;
    const fs = x.g('Fase'); if (fs != null && fs !== '') { const m = FASES.find(z => _nz(z) === _nz(fs)); if (m) v.fase = m; else bad.push('Fase desconocida'); }
    const rs = x.g('Responsable'); if (rs != null && rs !== '') v.resp = String(rs).trim();
    const cp = x.g('Completado (Sí/No)'); if (cp != null && cp !== '') v.completado = cxBool(cp); else if (v.fechaReal) v.completado = true;
    if (v.completado === false) v.fechaReal = null; else if (v.completado && !v.fechaReal && !(cur && cur.fechaReal)) v.fechaReal = hoy();
    if (!cur && !v.fecha) bad.push('hito nuevo sin Fecha plan'); if (bad.length) return E('Hitos', x.n, `${id} · ${nm}: ${bad.join(', ')}`);
    { const ip = i.inicioPlan, fp = i.finPlan; if (v.fecha && ((ip && v.fecha < ip) || (fp && v.fecha > fp))) Wn('Hitos', x.n, `${id} · ${nm}: la Fecha plan ${fmtD(v.fecha)} queda fuera del plan del proyecto (${fmtD(ip)} – ${fmtD(fp)})`);
      if (v.fechaReal && v.fechaReal > hoy()) Wn('Hitos', x.n, `${id} · ${nm}: la Fecha real ${fmtD(v.fechaReal)} está en el futuro`); }
    if (cur) { const ch = {}; Object.keys(v).forEach(k => { if (v[k] !== cur[k] && !(v[k] == null && !cur[k])) ch[k] = v[k]; }); if (Object.keys(ch).length) R.hitos.push({ cur, ch, id, nm }); }
    else R.hitos.push({ nuevo: { ini: id, nombre: nm, fase: v.fase || '', fecha: v.fecha, completado: !!v.completado, fechaReal: v.fechaReal || null, resp: v.resp || i.lider || '' }, id, nm });
  });
  R.vacio = !R.plan.length && !R.hitos.length;
  return R;
}
const cxLoc = m => { const k = /^(.+?) · fila (\d+): ([\s\S]*)$/.exec(m); return k ? [k[1], 'Fila ' + k[2], k[3]] : ['', '', m]; };
function cxPreview() {
  const R = CX.res; if (!R) return '';
  const nN = R.hitos.filter(h => h.nuevo).length, nU = R.hitos.length - nN;
  const lbl = { inicioPlan: 'Inicio plan', finPlan: 'Fin plan', inicioReal: 'Inicio real', finReal: 'Fin real', avance: 'Avance', presupuesto: 'Presupuesto', gastado: 'Gastado', fecha: 'Fecha plan', fechaReal: 'Fecha real', fase: 'Fase', resp: 'Responsable', completado: 'Completado' };
  const fv = (k, v) => v === true ? 'Sí' : v === false ? 'No' : v == null || v === '' ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtD(v) : v;
  const det = (cur, ch) => Object.keys(ch).map(k => `${lbl[k] || k}: ${esc(fv(k, cur[k]))} → <b>${esc(fv(k, ch[k]))}</b>`).join(' · ');
  const rows = [...R.plan.map(p => `<tr><td>Planificación</td><td>${esc(p.i.id)} · ${esc(p.i.titulo)}</td><td>${det(p.i, p.ch)}</td></tr>`), ...R.hitos.map(h => `<tr><td>Hito ${h.nuevo ? 'nuevo' : 'actualizado'}</td><td>${esc(h.id)} · ${esc(h.nm)}</td><td>${h.nuevo ? `Fecha plan <b>${esc(fv('fecha', h.nuevo.fecha))}</b>${h.nuevo.completado ? ' · completado' : ''}` : det(h.cur, h.ch)}</td></tr>`)];
  return `<div class="chips" style="margin:8px 0"><span class="pill">${R.plan.length} iniciativas con cambios de planificación</span><span class="pill">${nN} hitos nuevos</span><span class="pill">${nU} hitos actualizados</span><span class="pill ${R.errs.length ? 'bad' : ''}" style="${R.errs.length ? 'background:var(--redbg);color:var(--red)' : ''}">${R.errs.length} errores</span>${R.warns.length ? `<span class="pill" style="background:#FFF4CE;color:#8A5A00">${R.warns.length} avisos</span>` : ''}</div>`
    + (!rows.length && R.errs.length ? `<p class="mut" style="margin:6px 0 0">No hay filas válidas para aplicar. Corrige los errores del archivo y vuelve a subirlo.</p>` : '')
    + (rows.length || R.errs.length || R.warns.length ? `<div class="tbl-w" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Estado</th><th>Tipo</th><th>Elemento</th><th>Cambio / detalle</th></tr></thead><tbody>${[
        ...R.errs.map(m => { const [h, u, d] = cxLoc(m); return `<tr style="background:var(--redbg)"><td><b style="color:var(--red)">✕ Se omite</b></td><td>${esc(h)}</td><td>${esc(u)}</td><td>${esc(d)}</td></tr>`; }),
        ...R.warns.map(m => { const [h, u, d] = cxLoc(m); return `<tr style="background:#FFF4CE"><td><b style="color:#8A5A00">⚠ Revisar</b></td><td>${esc(h)}</td><td>${esc(u)}</td><td>${esc(d)}</td></tr>`; }),
        ...rows.map(r => r.replace('<tr>', '<tr style="background:#E4F3E5"><td><b style="color:#13420f">✓ Válida</b></td>'))
      ].join('')}</tbody></table></div>` : '<p class="mut">El archivo no trae cambios respecto de lo que ya está cargado.</p>');
}
Acts.cargaxl = () => {
  if ((0, ENLACES.soloLectura)()) return toast('Modo solo lectura: no se puede cargar', 'err');
  CX.res = null;
  Modal.open({ title: 'Cargar planificación e hitos desde Excel', wide: true,
    body: `<p class="desc" style="margin:0 0 8px"><b>Actualiza planificación e hitos de proyectos que ya existen (no crea proyectos nuevos).</b> 1) Descarga la plantilla, 2) complétala (o edita la que trae tus datos actuales) y 3) súbela: verás una vista previa antes de aplicar. Solo se cargan iniciativas que usted puede editar; las celdas vacías no modifican nada.</p>
      <div class="chips" style="margin:0 0 10px">${btn('Plantilla en blanco (con ejemplo)', 'cxtpl', { d: { m: 'blank' }, ic: 'down' })}${btn('Plantilla con mis datos actuales', 'cxtpl', { d: { m: 'data' }, ic: 'down' })}<button class="btn pri" data-act="cxpick">${icon('up', 15)}<span>Elegir archivo Excel…</span></button><input type="file" id="cxfile" accept=".xlsx" data-chg="cxfile" hidden></div>
      <div id="cxprev"><p class="mut">Aún no se ha subido ningún archivo.</p></div>`,
    footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" id="cxok" data-act="cxapply" disabled>Aplicar cambios</button>` });
};
Acts.cxtpl = d => { downloadBlob(d.m === 'data' ? 'APIH_plantilla_planificacion_datos_' + hoy() + '.xlsx' : 'APIH_plantilla_planificacion.xlsx', cxTemplate(d.m === 'data')); toast('Plantilla descargada'); };
Acts.cxpick = () => { const f = $('#cxfile'); if (f) { f.value = ''; f.click(); } };
Chg.cxfile = async el => {
  const fl = el.files[0]; if (!fl) return; const pv = $('#cxprev'), ok = $('#cxok'); if (ok) ok.disabled = true; pv.innerHTML = '<p class="mut">Leyendo archivo…</p>';
  try { CX.res = cxParse(await readXlsx(await fl.arrayBuffer())); CX.name = fl.name; pv.innerHTML = `<p class="mut" style="margin:0">Archivo: <b>${esc(fl.name)}</b></p>` + cxPreview(); if (ok) ok.disabled = !(CX.res.plan.length || CX.res.hitos.length); }
  catch (e) { CX.res = null; pv.innerHTML = `<div class="note bad">${icon('warn', 14)} <span>No se pudo leer el archivo: ${esc(e.message)}</span></div>`; }
};
Acts.cxapply = () => {
  const R = CX.res; if (!R || (!R.plan.length && !R.hitos.length)) return;
  const go = () => {
    R.plan.forEach(p => { Object.assign(p.i, p.ch); p.i.actualizada = hoy(); if (p.ch.avance !== undefined && !esProp(p.i)) p.i.avanceManual = p.ch.avance; if ((p.ch.inicioPlan !== undefined || p.ch.finPlan !== undefined) && !esProp(p.i)) (0, ENLACES.setRangoPlan)(p.i, p.i.inicioPlan, p.i.finPlan); });   /* V23: el rango plan reparte/reescala las fases; el avance cargado queda como ajuste manual */
    const tocadas = new Set(R.plan.map(p => p.i.id));
    R.hitos.forEach(h => { if (h.nuevo) St.hitos.push({ id: nextId('HIT', St.hitos), ...h.nuevo }); else Object.assign(h.cur, h.ch); const i = byId(h.id); if (i) { i.actualizada = hoy(); tocadas.add(i.id); } });
    tocadas.forEach(id => { const i = byId(id); if (i) (0, ENLACES.sincAvance)(i); });
    const nN = R.hitos.filter(h => h.nuevo).length;
    log('Cambio', null, `Carga desde Excel (${CX.name}): ${R.plan.length} planificaciones actualizadas, ${nN} hitos nuevos, ${R.hitos.length - nN} hitos actualizados`);
    if (St.bitacora[0]) St.bitacora[0].inPres = false;
    Modal.close(); toast(`Carga aplicada: ${R.plan.length} planificaciones, ${R.hitos.length} hitos`); CX.res = null; refresh();
  };
  if (R.errs.length) confirmBox(`El archivo tiene ${R.errs.length} filas con error que se omitirán. ¿Aplicar solo las filas válidas?`, go, 'Aplicar válidas'); else go();
};

Acts.pxlsx = () => {
  const f = F('portfolio', {}), rows = (0, ENLACES.portfolioRows)(), cols = (0, ENLACES.pcols)();
  const strip = v => typeof v === 'string' ? v.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : v;
  downloadBlob('APIH_portfolio_' + hoy() + '.xlsx', xlsxBlob([{ name: 'Portfolio', rows: [cols.map(c => c.h), ...rows.map(r => cols.map(c => strip(c.f(r))))] }])); toast(rows.length + ' filas exportadas a Excel');
};
Acts.pjson = () => {
  const f = F('portfolio', {}), rows = (0, ENLACES.portfolioRows)(), cols = (0, ENLACES.pcols)();
  download('APIH_portfolio_' + hoy() + '.json', JSON.stringify(rows.map(r => Object.fromEntries(cols.map(c => [c.h, c.f(r)]))), null, 1), 'application/json'); toast(rows.length + ' filas exportadas a JSON');
};

/* ============================================================
   APIH · Acciones: formularios y CRUD con bitácora automática
   ============================================================ */
export const people = () => uniq([...St.usuarios.map(u => u.n), ...St.ini.flatMap(i => [i.lider, i.sponsor, i.negocio]).filter(Boolean)]).sort();
export const iniOpts = tipo => St.ini.filter(i => !tipo || i.tipo === tipo).slice().sort(by('id')).map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo }));
export const iniOptsF = tipo => iniOpts(tipo).filter(o => !esSB(byId(o.v)));   /* filtros de pantallas de gestión: sin Stand By (los formularios sí lo conservan para no perder vínculos) */
function hasCycle(id, deps) {   // ¿agregar deps a id crea ciclo?
  const seen = new Set(); const st = [...deps];
  while (st.length) { const x = st.pop(); if (x === id) return true; if (seen.has(x)) continue; seen.add(x); const i = byId(x); if (i) st.push(...i.deps); }
  return false;
}

/* ---------- Propuesta / Proyecto ---------- */
function iniForm(i, isPropArg) {
  const nw = !i, PR = nw ? !!isPropArg : esProp(i), T = PR ? 'Propuesta' : 'Proyecto';
  const v = i ? clone(i) : { tipo: T, fase: PR ? 'Recepción' : 'Planificación', estado: PR ? 'Vigente' : 'En curso', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', area: ['BISE'], categoria: St.cfg.categorias[0], clasif: 'Táctico', gasto: 'OPEX', avance: 0, lider: St.cfg.usuario, solicitante: St.cfg.usuario, presupuesto: 0, gastado: 0, beneficio: 0, deps: [], inicioPlan: hoy(), finPlan: addD(hoy(), 120), origen: 'usuario', est: [], hist: [], score: { estrategia: 3, valor: 3, esfuerzo: 3, riesgo: 2 } };
  const areas = typeof v.area === 'string' ? v.area.split(',').map(x => x.trim()) : v.area;
  v.areaArr = areas; v.score = v.score || { estrategia: 3, valor: 3, esfuerzo: 3, riesgo: 2 };
  v.sE = v.score.estrategia; v.sV = v.score.valor; v.sF = v.score.esfuerzo; v.sR = v.score.riesgo;
  const P = people();
  const fields = [
    { sec: 'Identificación' },
    { k: 'titulo', l: 'Título', req: true, w: 3 }, { k: 'tipoIni', l: 'Tipo de iniciativa', t: 'select', opts: ['', ...((St.cfg.metodo || {}).tipos || []).map(t => t.nombre)], w: 2, hint: 'Precarga los hitos de la metodología (Administración → Metodología)' }, { k: 'desc', l: 'Descripción', t: 'textarea', w: 3 }, { k: 'bc', l: 'Business case / beneficios', t: 'textarea', w: 3 },
    ...(PR ? [{ k: 'problema', l: 'Problema a resolver', t: 'textarea', w: 3 }, { k: 'objetivos', l: 'Objetivos esperados', t: 'textarea', w: 3 }, { k: 'usuarios', l: 'Usuarios impactados', w: 2 }, { k: 'solicitante', l: 'Solicitante', list: P }] : []),
    ...(nw && !PR ? [{ k: 'motivoAlta', l: 'Motivo de creación directa (sin propuesta previa)', t: 'textarea', req: true, w: 3 }] : []),
    { sec: 'Gobierno' },
    { k: 'sponsor', l: 'Sponsor', list: P }, { k: 'lider', l: 'Líder / Responsable', list: P, req: true }, { k: 'negocio', l: 'Responsable de negocio', list: P },
    { k: 'areaArr', l: 'Área(s)', t: 'multi', opts: St.cfg.areas.map(a => ({ v: a, t: a })), w: 2 }, { k: 'categoria', l: 'Categoría', t: 'select', opts: St.cfg.categorias },
    { k: 'clasif', l: 'Clasificación', t: 'select', opts: ['Táctico', 'Estratégico'] }, { k: 'gasto', l: 'Tipo de gasto', t: 'select', opts: ['OPEX', 'CAPEX'] }, { k: 'prioridad', l: 'Prioridad', t: 'select', opts: PRIOS },
    ...(PR ? [] : [{ sec: 'Salud y avance' }, { k: 'rag', l: 'Salud (RAG)', t: 'select', opts: RAGS },
      { k: 'avanceManual', l: 'Ajuste manual del avance (%)', t: 'number', min: 0, max: 100, hint: nw ? 'Vacío: se calcula solo con los hitos y subfases' : 'Vacío = calculado (' + (0, ENLACES.avanceCalc)(i) + '%). La fase y el estado se cambian con «Cambiar etapa» en la pestaña Ciclo de vida.' }]),
    { sec: PR ? 'Finanzas estimadas' : 'Finanzas' }, { k: 'moneda', l: 'Moneda', t: 'select', opts: ['CLP', 'USD', 'UF'], w: 1, hint: 'Los montos se ingresan en: CLP en millones (MM) · USD en miles (K) · UF en unidades' },
    { k: 'presupuesto', l: PR ? 'Costo estimado' : 'Presupuesto', t: 'number', min: 0 }, ...(PR ? [] : [{ k: 'gastado', l: 'Consumido', t: 'number', min: 0 }]), { k: 'beneficio', l: PR ? 'Beneficio estimado' : 'Beneficio esperado', t: 'number', min: 0 }, ...(PR ? [] : [{ k: 'ahorroReal', l: 'Beneficio real (acumulado)', t: 'number', min: 0 }, { k: 'resultadoNota', l: 'Resultado alcanzado (obligatorio para la 3ª estrella si no hay beneficio medible)', w: 3 }]),
    { sec: 'Fechas' },
    ...(PR ? [{ k: 'inicioPlan', l: 'Inicio estimado', t: 'date' }, { k: 'finPlan', l: 'Fecha objetivo de término', t: 'date' }]
      : [...(nw ? [{ k: 'inicioPlan', l: 'Inicio plan', t: 'date', hint: 'Se reparte entre las fases; luego se ajusta en Ciclo de vida' }, { k: 'finPlan', l: 'Fin plan (línea base)', t: 'date' }] : []), { k: 'finEst', l: 'Fin estimado (pronóstico)', t: 'date', hint: nw ? '' : 'Las fechas plan de cada fase se editan en la pestaña Ciclo de vida' }, { k: 'inicioReal', l: 'Inicio real', t: 'date' }, { k: 'finReal', l: 'Fin real', t: 'date' }]),
    { sec: 'Dependencias y proveedor' },
    { k: 'deps', l: 'Depende de', t: 'multi', opts: iniOpts().filter(o => !i || o.v !== i.id), w: 3 }, { k: 'proveedor', l: 'Proveedor', w: 2 }, { k: 'contrato', l: 'Estado contrato', t: 'select', opts: ['', 'Sin contrato', 'Con contrato', 'En negociación'] },
    { sec: 'Seguimiento' },
    { k: 'resumen', l: 'Resumen ejecutivo', t: 'textarea', w: 3 },
    ...(PR ? [] : [{ k: 'logros', l: 'Logros del ciclo', t: 'textarea', w: 3 }, { k: 'proximos', l: 'Próximos pasos', t: 'textarea', w: 3 }, { k: 'issue', l: 'Issue actual', w: 2 }, { k: 'riesgoTxt', l: 'Riesgo principal (texto)', w: 1 }]),
    ...(PR ? [{ sec: 'Priorización (1–5)' }, { k: 'sE', l: 'Alineación estratégica', t: 'range', min: 1, max: 5 }, { k: 'sV', l: 'Valor de negocio', t: 'range', min: 1, max: 5 }, { k: 'sF', l: 'Esfuerzo', t: 'range', min: 1, max: 5 }, { k: 'sR', l: 'Riesgo', t: 'range', min: 1, max: 5 }] : [])
  ];
  v.avance = v.avance || 0; v.avanceManual = i && (0, ENLACES.avanceManualDe)(i) != null ? (0, ENLACES.avanceManualDe)(i) : '';
  const tabs = [{ k: 'gen', t: 'General', secs: ['Identificación', 'Gobierno', 'Salud y avance', 'Fechas', 'Seguimiento', 'Priorización'] }, { k: 'fin', t: 'Finanzas', secs: ['Finanzas'] }, { k: 'rsk', t: 'Riesgos' + (nw ? '' : ' (' + riesgosDe(i.id).length + ')') }];
  if (!PR) tabs.push({ k: 'hit', t: 'Hitos' + (nw ? '' : ' (' + hitosDe(i.id).length + ')') });
  tabs.push({ k: 'dep', t: 'Dependencias', secs: ['Dependencias'] }, { k: 'bit', t: 'Bitácora' });
  openForm({ pres: true,
    title: nw ? (PR ? 'Nueva propuesta' : 'Nuevo proyecto (alta directa)') : 'Editar ' + T.toLowerCase() + ' · ' + i.titulo, fields, values: v, wide: true, tabs, tabExtra: iniTabExtra(i), saveLabel: nw ? 'Crear' : 'Guardar cambios', danger: nw ? null : 'Eliminar',
    onDanger: () => confirmBox(`¿Eliminar ${T.toLowerCase()} <b>${esc(i.titulo)}</b> junto con sus hitos, riesgos, decisiones, compromisos y cambios? Esta acción no se puede deshacer.`, () => { St.ini = St.ini.filter(x => x.id !== i.id); St.hitos = St.hitos.filter(h => h.ini !== i.id); St.riesgos = St.riesgos.filter(r => r.ini !== i.id); ['decisiones', 'compromisos', 'cambios', 'notas'].forEach(k => { if (Array.isArray(St[k])) St[k] = St[k].filter(x => x.ini !== i.id); }); (St.comites || []).forEach(c => { if (Array.isArray(c.decisiones)) c.decisiones = c.decisiones.filter(d => !(St.decisiones || []).some(x => x.id === d && x.ini === i.id) && !(St.decisiones || []).some(x => x.id === d && !St.decisiones.includes(x))); }); /* F-12: sin huérfanos */ St.ini.forEach(x => x.deps = (x.deps || []).filter(d => d !== i.id)); log('Cambio', null, T + ' eliminada: ' + i.titulo); UI.sel = null; toast(T + ' eliminada'); refresh(); }, 'Eliminar', true),
    onSave(o) {
      if (!nw && hasCycle(i.id, o.deps || [])) { toast('Las dependencias generan un ciclo', 'err'); return false; }
      if (o.inicioPlan && o.finPlan && o.finPlan < o.inicioPlan) { toast('El fin plan no puede ser anterior al inicio', 'err'); return false; }
      if (['presupuesto', 'gastado', 'beneficio', 'ahorroReal'].some(k => o[k] != null && o[k] !== '' && (!isFinite(+o[k]) || +o[k] < 0))) { toast('Los montos deben ser números no negativos', 'err'); return false; }   // F-11
      if (o.avanceManual != null && o.avanceManual !== '' && (!isFinite(+o.avanceManual) || +o.avanceManual < 0 || +o.avanceManual > 100)) { toast('El ajuste de avance debe estar entre 0 y 100', 'err'); return false; }
      const areaStr = (o.areaArr && o.areaArr.length ? o.areaArr : ['BISE']).join(',');
      const patch = { ...o, area: areaStr }; if (PR) patch.score = { estrategia: o.sE, valor: o.sV, esfuerzo: o.sF, riesgo: o.sR }; patch.finEst = PR ? null : (o.finEst || o.finPlan);
      ['areaArr', 'sE', 'sV', 'sF', 'sR'].forEach(k => delete patch[k]);
      if (!PR) { patch.avanceManual = o.avanceManual === '' || o.avanceManual == null ? null : Math.round(+o.avanceManual); delete patch.avance; }   /* V23: el avance se calcula; aquí solo el ajuste manual */
      if (nw) {
        const pre = PR ? 'PROP' : 'PRJ', ids = St.ini.filter(x => x.id.startsWith(pre + '-'));
        const n = Object.assign({ id: nextId(pre, ids), tipo: T, legacy: '', creada: hoy(), faseDesde: hoy(), origen: 'usuario', est: [], hist: [[hoy(), patch.avance || 0]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, estado: PR ? 'Vigente' : 'En curso', propuestaOrigen: null, estadoMotivo: '', estadoRev: null, rag: 'Verde', avance: 0, gastado: 0, proyecto: null }, patch, { actualizada: hoy() });
        St.ini.push(n); if (!PR && n.inicioPlan && n.finPlan) (0, ENLACES.setRangoPlan)(n, n.inicioPlan, n.finPlan); const nh = n.tipoIni ? aplicarPlantilla(n, n.tipoIni, PR ? FASES_PROP : FASES_PRJ, PR ? hoy() : (n.inicioPlan || hoy())) : 0; if (!PR) (0, ENLACES.sincAvance)(n); log('Cambio', n.id, (nh ? '[' + nh + ' hitos precargados del tipo «' + n.tipoIni + '»] ' : '') + (PR ? 'Propuesta creada: ' : 'Proyecto creado directamente: ') + n.titulo + (n.motivoAlta ? ' — ' + n.motivoAlta : '')); toast(T + ' ' + n.id + (PR ? ' creada' : ' creado')); UI.sel = { t: 'ini', id: n.id };
      } else {
        const diffs = []; [['rag', 'RAG'], ['prioridad', 'Prioridad'], ['lider', 'Líder'], ['finPlan', PR ? 'Fecha objetivo' : 'Fin plan'], ['finEst', 'Fin estimado'], ['presupuesto', PR ? 'Costo estimado' : 'Presupuesto']].forEach(([k, l]) => { if (k in patch && String(i[k]) !== String(patch[k])) diffs.push(`${l}: ${i[k] ?? '—'} → ${patch[k] ?? '—'}`); });
        if (patch.tipoIni && patch.tipoIni !== i.tipoIni && !hitosDe(i.id).length) { const nh = aplicarPlantilla(i, patch.tipoIni, fasesDe(i), (PR ? hoy() : i.inicioPlan) || hoy()); if (nh) toast(nh + ' hitos precargados del tipo «' + patch.tipoIni + '»'); }
        const av0 = i.avance; Object.assign(i, patch, { actualizada: hoy(), est: (i.est || []).filter(k => k !== 'all' && String(i[k]) === String(patch[k])) }); (0, ENLACES.snapFases)(i); if (!PR) { (0, ENLACES.sincAvance)(i); if (i.avance !== av0) diffs.push(`Avance: ${av0} → ${i.avance}`); }
        log(diffs.some(d => d.startsWith('Avance')) ? 'Actualización' : 'Cambio', i.id, diffs.length ? 'Actualizada: ' + diffs.join('; ') : 'Ficha actualizada', null); toast('Cambios guardados');
      }
      refresh();
    }
  });
}
Acts.new = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const t = d.t; closePops();
  if (t === 'prop') iniForm(null, true); else if (t === 'ini' || t === 'prj') iniForm(null, false);
  else if (t === 'risk') riskForm(null, d.ini); else if (t === 'hito') hitoForm(null, d.ini); else if (t === 'dec') decForm(null, d.ini); else if (t === 'com') comForm(null);
};
Acts.edit = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  if (d.t === 'ini') iniForm(byId(d.id)); else if (d.t === 'risk') riskForm(St.riesgos.find(r => r.id === d.id)); else if (d.t === 'hito') hitoForm(St.hitos.find(r => r.id === d.id));
  else if (d.t === 'dec') decForm(St.decisiones.find(r => r.id === d.id)); else if (d.t === 'com') comForm(St.comites.find(r => r.id === d.id));
};

/* ---------- cambio de fase y de estado: un solo diálogo, «Cambiar etapa» (04-flujos.js) ---------- */
/* ---------- RAG / comentarios / hitos ---------- */
Acts.applyrag = d => { const i = byId(d.id); log('Cambio', i.id, `RAG ${i.rag} → ${d.rag} (sugerido por reglas automáticas)`); i.rag = d.rag; i.actualizada = hoy(); toast('RAG actualizado'); refresh(); };
Acts.comment = d => { const el = $('#cmt'); const t = el && el.value.trim(); if (!t) return; log('Comentario', d.id, t); toast('Comentario agregado'); refresh(); setTimeout(() => { const e2 = $('#cmt'); if (e2) e2.focus(); }, 30); };
export function toggleHito(id) { const h = St.hitos.find(x => x.id === id); if (!h) return; return (0, ENLACES.hitoEnServidor)(id, !h.completado); }   // completar o reabrir un hito es un comando del servidor (avance y cierre automático en la base)
Chg.hitotoggle = el => toggleHito(el.dataset.id); Acts.hitotoggle = d => toggleHito(d.id);

/* ---------- Hito ---------- */
export function hitoForm(h, ini) {
  const nw = !h, v = h ? clone(h) : { ini: ini || (UI.sel && UI.sel.t === 'ini' ? UI.sel.id : ''), fecha: addD(hoy(), 14), completado: false, resp: '', subfase: '' }, hi = byId(v.ini);
  openForm({ pres: true,
    title: nw ? 'Nuevo hito' : 'Editar hito', values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Crear' : 'Guardar',
    fields: [{ k: 'ini', l: 'Iniciativa', t: 'select', opts: [{ v: '', t: '— Elige la iniciativa —' }, ...iniOpts()], req: true, w: 3 }, { k: 'nombre', l: 'Hito', req: true, w: 3 }, { k: 'fase', l: 'Fase', t: 'select', opts: ['', ...FASES.map(x => { const w = hi && (0, ENLACES.ventanaDe)(hi, x); return { v: x, t: x + (w && w.ini ? ' · ' + (0, ENLACES.rangoTx)(w.ini, w.fin) : '') }; })], hint: 'Opcional: al avanzar de fase se exige cerrar los hitos de la fase' }, { k: 'subfase', l: 'Subfase', t: 'select', opts: [{ v: '', t: '— sin subfase —' }, ...(0, ENLACES.subfasesDe)(hi).map(x => ({ v: x.id, t: x.fase + ' › ' + x.nombre + ' · ' + (0, ENLACES.rangoTx)(x.inicio, x.fin) }))], hint: hi && (0, ENLACES.subfasesDe)(hi).length ? 'Opcional. Debe ser de la misma fase del hito' : 'Este proyecto aún no tiene subfases' }, { k: 'fecha', l: 'Fecha plan', t: 'date', req: true }, { k: 'cat', l: 'Categoría', t: 'select', opts: [{ v: '', t: '— sin categoría —' }, ...hitoCats()] }, { k: 'desc', l: 'Descripción / instrucciones', t: 'textarea', w: 3, rows: 3, hint: 'Opcional. Recordatorio del hito; se ve en Mi cocina.' }, { k: 'peso', l: 'Peso en el reporte (%)', t: 'number', min: 0, max: 100, hint: 'Opcional. Si todos los hitos del proyecto lo tienen y suman 100 %, el reporte los ubica por peso; si no, en partes iguales.' }, { k: 'resp', l: 'Responsable', list: people() }, { k: 'completado', l: 'Estado', t: 'check', lbl: 'Completado' }, { k: 'fechaReal', l: 'Fecha real', t: 'date' }],
    onDanger: () => confirmBox('¿Eliminar este hito?', () => { St.hitos = St.hitos.filter(x => x.id !== h.id); log('Cambio', h.ini, 'Hito eliminado: ' + h.nombre); toast('Hito eliminado'); UI.sel = null; refresh(); }, 'Eliminar', true),
    onSave(o) { if (o.completado && !o.fechaReal) o.fechaReal = hoy(); if (!o.completado) o.fechaReal = null;
      if (o.peso === '' || o.peso == null || isNaN(+o.peso)) { delete o.peso; if (h) delete h.peso; } else { o.peso = +o.peso; if (o.peso < 0 || o.peso > 100) { toast('El peso va de 0 a 100', 'err'); return false; } }
      if (o.subfase) { const sx = (0, ENLACES.subfasesDe)(byId(o.ini)).find(x => x.id === o.subfase); if (!sx) { toast('La subfase elegida no es de esta iniciativa', 'err'); return false; } if (!o.fase) o.fase = sx.fase; if (o.fase !== sx.fase) { toast('La subfase «' + sx.nombre + '» es de ' + sx.fase + ': el hito debe estar en esa fase', 'err'); return false; } if (o.fecha < sx.inicio || o.fecha > sx.fin) toast('Aviso: la fecha del hito queda fuera de la subfase «' + sx.nombre + '» (' + (0, ENLACES.rangoTx)(sx.inicio, sx.fin) + ')', 'warn'); } else delete o.subfase;
      if (!nw && !o.subfase) delete h.subfase;
      if ((o.desc || '').length > ENLACES.DESC_MAX) { toast('La descripción no puede superar ' + ENLACES.DESC_MAX + ' caracteres', 'err'); return false; } if (String(o.desc || '').trim()) o.desc = (0, ENLACES.cutDesc)(o.desc.trim()); else delete o.desc;
      if (nw) { const n = { id: nextId('HIT', St.hitos), ...o }; St.hitos.push(n); log('Cambio', o.ini, 'Hito creado: ' + o.nombre + ' (' + fmtD(o.fecha) + ')'); toast('Hito creado'); } else { const viaRpc = !!h.completado !== !!o.completado, comp = o.completado; if (viaRpc) { delete o.completado; delete o.fechaReal; } Object.assign(h, o); log('Cambio', h.ini, 'Hito actualizado: ' + h.nombre); toast('Hito guardado'); if (viaRpc) (0, ENLACES.hitoEnServidor)(h.id, !!comp); }   /* con servidor, completar/reabrir pasa por el comando (avance y cierre automático en la base) */
      const i = byId(o.ini); if (i) { i.actualizada = hoy(); (0, ENLACES.sincAvance)(i); } refresh(); }
  });
  /* N-U-04/05: al cambiar Iniciativa o Fase se recalculan las opciones de Fase y Subfase */
  const fi = $('#f_ini'), ff = $('#f_fase'), fs = $('#f_subfase');
  if (fi && ff && fs) {
    const op = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    const rebuild = (cambioIni) => {
      const x = byId(fi.value), f0 = ff.value, s0 = fs.value;
      if (cambioIni) ff.innerHTML = op('', '', !f0) + FASES.map(k => { const w = x && (0, ENLACES.ventanaDe)(x, k); return op(k, k + (w && w.ini ? ' · ' + (0, ENLACES.rangoTx)(w.ini, w.fin) : ''), k === f0); }).join('');
      const sf = (0, ENLACES.subfasesDe)(x).filter(y => !ff.value || y.fase === ff.value);
      fs.innerHTML = op('', '— sin subfase —', true) + sf.map(y => op(y.id, y.fase + ' › ' + y.nombre + ' · ' + (0, ENLACES.rangoTx)(y.inicio, y.fin), y.id === s0)).join('');
    };
    fi.addEventListener('change', () => rebuild(true));
    ff.addEventListener('change', () => rebuild(false));
  }
}

/* ---------- Riesgo ---------- */
export function riskForm(r, ini, pre) {
  const nw = !r, v = r ? clone(r) : { ini: ini || (UI.sel && UI.sel.t === 'ini' ? UI.sel.id : ''), cat: 'Técnico', prob: 3, imp: 3, estado: 'Abierto', dueno: St.cfg.usuario, fIdent: hoy(), fRev: addD(hoy(), 30), mit: '', ...(pre || {}) };
  openForm({ pres: true,
    title: nw ? 'Nuevo riesgo' : 'Editar riesgo ' + r.id, values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Registrar' : 'Guardar',
    fields: [{ k: 'ini', l: 'Proyecto / iniciativa', t: 'select', opts: [{ v: '', t: '— Elige la iniciativa —' }, ...iniOpts()], req: true, w: 3 }, { k: 'desc', l: 'Descripción del riesgo', req: true, t: 'textarea', w: 3 }, { k: 'cat', l: 'Categoría', t: 'select', opts: RISK_CATS }, { k: 'estado', l: 'Estado', t: 'select', opts: RISK_ESTADOS }, { k: 'dueno', l: 'Dueño', list: people() },
      { k: 'prob', l: 'Probabilidad (1–5)', t: 'range', min: 1, max: 5 }, { k: 'imp', l: 'Impacto (1–5)', t: 'range', min: 1, max: 5 }, { k: 'mit', l: 'Plan de mitigación', t: 'textarea', w: 3 }, { k: 'fIdent', l: 'Identificado', t: 'date' }, { k: 'fRev', l: 'Próxima revisión', t: 'date' }],
    onDanger: () => confirmBox('¿Eliminar este riesgo?', () => { St.riesgos = St.riesgos.filter(x => x.id !== r.id); log('Riesgo', r.ini, 'Riesgo eliminado: ' + r.desc); UI.sel = null; toast('Riesgo eliminado'); refresh(); }, 'Eliminar', true),
    onSave(o) { if (riesgoAbierto(o) && expo(o) >= (0, ENLACES.cfgI)(byId(o.ini), 'umbralCritico') && !String(o.mit || '').trim()) { toast('Un riesgo crítico requiere plan de mitigación', 'err'); return false; }
      if (nw) { const n = { id: nextId('RSK', St.riesgos), ...o }; St.riesgos.push(n); log('Riesgo', o.ini, 'Riesgo identificado: ' + o.desc, 'Exposición ' + o.prob * o.imp); toast('Riesgo registrado'); } else { const prev = expo(r); Object.assign(r, o); log('Riesgo', r.ini, 'Riesgo actualizado: ' + r.desc + ' (' + r.estado + ')', 'Exposición ' + prev + ' → ' + expo(r)); toast('Riesgo guardado'); } refresh(); }
  });
}

/* ---------- Decisión ---------- */
export function decForm(d, ini, pre) {
  const nw = !d, v = d ? clone(d) : { ini: ini || '', tipo: 'Iniciar', estado: 'Pendiente', limite: addD(hoy(), 14), solicita: St.cfg.usuario, area: 'BISE', ...(pre || {}) };
  openForm({ pres: true,
    title: nw ? 'Nueva decisión' : 'Editar decisión ' + d.id, values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Registrar' : 'Guardar',
    fields: [{ k: 'tipo', l: 'Tipo de decisión', t: 'select', opts: DEC_TIPOS }, { k: 'ini', l: 'Proyecto / propuesta', t: 'select', opts: iniOpts(), blank: '— Sin proyecto ni propuesta —', w: 2 }, { k: 'titulo', l: 'Pregunta / decisión', req: true, w: 3 }, { k: 'recomendacion', l: 'Recomendación', t: 'textarea', w: 3 },
      { k: 'limite', l: 'Fecha límite', t: 'date' }, { k: 'solicita', l: 'Solicitada por', list: people() }, { k: 'comite', l: 'Comité', t: 'select', opts: St.comites.map(c => ({ v: c.id, t: c.id + ' · ' + fmtD(c.fecha) })), blank: '—' }],
    onDanger: () => confirmBox('¿Eliminar esta decisión?', () => { St.decisiones = St.decisiones.filter(x => x.id !== d.id); St.comites.forEach(c => c.decisiones = c.decisiones.filter(x => x !== d.id)); toast('Decisión eliminada'); UI.sel = null; refresh(); }, 'Eliminar', true),
    onSave(o) { if (!o.limite) { toast('La fecha límite es obligatoria', 'err'); return false; } if (o.limite > addD(hoy(), (0, ENLACES.decMaxDias)())) { toast('El plazo máximo de una decisión es de ' + (0, ENLACES.decMaxDias)() + ' días', 'err'); return false; } const tg = byId(o.ini); if (tg && o.tipo === 'Iniciar' && !esProp(tg)) { toast('“Iniciar” aplica solo a propuestas', 'err'); return false; } if (tg && o.tipo === 'Acelerar' && esProp(tg)) { toast('“Acelerar” aplica solo a proyectos', 'err'); return false; }
      if (nw) { const n = { id: nextId('DEC', St.decisiones), estado: 'Pendiente', resolucion: '', fResol: null, aplicada: false, area: 'BISE', ...o }; St.decisiones.push(n); if (o.comite) { const c = St.comites.find(x => x.id === o.comite); if (c) c.decisiones.push(n.id); } log('Decisión', o.ini, `Decisión solicitada (${o.tipo}): ${o.titulo}`); toast('Decisión registrada'); } else { const oldC = d.comite; Object.assign(d, o); if (oldC !== d.comite) { (St.comites || []).forEach(c => { if (Array.isArray(c.decisiones)) c.decisiones = c.decisiones.filter(x => x !== d.id); }); const nc = d.comite && St.comites.find(c => c.id === d.comite); if (nc) { nc.decisiones = nc.decisiones || []; if (!nc.decisiones.includes(d.id)) nc.decisiones.push(d.id); } } toast('Decisión guardada'); } refresh(); }
  });
}
const EFECTO = (tipo, t) => ({ Iniciar: 'La propuesta se aprueba y se crea el proyecto en Planificación.', Acelerar: 'Prioridad → Alta (y el proyecto pausado vuelve a En curso).', Mantener: 'Sin cambios de estado.', Pausar: t && esProp(t) ? 'La propuesta pasa a En espera (revisión en 30 días).' : 'El proyecto pasa a Pausado (revisión en 30 días).', Cancelar: t && esProp(t) ? 'La propuesta pasa a Rechazada.' : 'El proyecto pasa a Cancelado.' }[tipo]);
Acts.resolvedec = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const x = St.decisiones.find(y => y.id === d.id);
  openForm({
    title: 'Resolver decisión ' + x.id, saveLabel: 'Registrar resolución', values: { estado: 'Aprobada', resolucion: '', fResol: hoy(), aplicar: true },
    fields: [{ k: 'estado', l: 'Resultado', t: 'select', opts: ['Aprobada', 'Rechazada', 'Diferida'] }, { k: 'fResol', l: 'Fecha', t: 'date' }, { k: 'resolucion', l: 'Resolución / comentario de cierre', t: 'textarea', w: 3 }, { k: 'aplicar', l: 'Efecto', t: 'check', lbl: 'Aplicar efecto: ' + EFECTO(x.tipo, byId(x.ini)), w: 3 }],
    extra: `<p class="mut" style="margin-top:8px"><b>${esc(x.tipo)}</b> · ${esc(x.titulo)}</p>`,
    onSave(o) {
      return (0, ENLACES.resolverEnServidor)(x, o);   // la resolución y su efecto son un comando transaccional del servidor
    }
  });
};

/* ---------- Comité ---------- */
function comForm(c) {
  const nw = !c, v = c ? clone(c) : { nombre: 'Comité Portafolio TI Operaciones', fecha: addD(hoy(), 14), hora: '10:00', lugar: 'Teams', estado: 'Programado' };
  openForm({
    title: nw ? 'Nuevo comité' : 'Editar comité', values: v, saveLabel: nw ? 'Crear' : 'Guardar', danger: nw ? null : 'Eliminar',
    fields: [{ k: 'nombre', l: 'Nombre', req: true, w: 3 }, { k: 'fecha', l: 'Fecha', t: 'date', req: true }, { k: 'hora', l: 'Hora', t: 'time' }, { k: 'lugar', l: 'Lugar / enlace' }, { k: 'estado', l: 'Estado', t: 'select', opts: ['Programado', 'Realizado', 'Cancelado'] }, { k: 'resumen', l: 'Mensaje principal / resumen', t: 'textarea', w: 3 }],
    onDanger: () => confirmBox('¿Eliminar este comité?', () => { St.comites = St.comites.filter(x => x.id !== c.id); toast('Comité eliminado'); refresh(); }, 'Eliminar', true),
    onSave(o) { if (nw) { const n = { id: nextId('COM', St.comites), participantes: [{ n: St.cfg.usuario, rol: 'PMO / IT Business Partner', asistio: false }, ...(St.cfg.comiteParts || []).map(x => ({ n: x, rol: 'Participante', asistio: false }))], temas: [], decisiones: [], acciones: [], compromisos: [], narrativa: '', ...o }; St.comites.push(n); UI.f.comite = { sel: n.id }; log('Cambio', null, 'Comité programado: ' + fmtD(o.fecha)); toast('Comité creado'); } else { Object.assign(c, o); toast('Comité guardado'); } refresh(); }
  });
}

/* contenido de las pestañas Riesgos / Hitos / Dependencias / Bitácora del formulario de iniciativa */
function iniTabExtra(i) {
  const none = '<p class="mut" style="padding:14px 4px">Disponible después de crear el registro.</p>';
  if (!i) return { rsk: none, hit: none, bit: none };
  const row = (a, b, c, act) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="n">${act}</td></tr>`;
  const tbl = (head, rows, newBtn) => `<div class="tbl-w"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}<th></th></tr></thead><tbody>${rows || `<tr><td colspan="${head.length + 1}" class="mut">Sin registros</td></tr>`}</tbody></table></div><div style="margin-top:8px">${newBtn}</div><small class="mut">Guarde los cambios de la ficha antes de abrir otro formulario.</small>`;
  const dn = St.ini.filter(x => (x.deps || []).includes(i.id));
  return {
    rsk: tbl(['ID', 'Riesgo', 'Exposición'], riesgosDe(i.id).map(r => `<tr><td class="mono">${r.id}</td><td>${esc(r.desc)}</td><td>${expo(r)}</td><td class="n"><button class="btn sm" data-act="edit" data-t="risk" data-id="${r.id}">Editar</button></td></tr>`).join(''), btn('Nuevo riesgo', 'new', { d: { t: 'risk', ini: i.id }, ic: 'plus', cls: 'sm' })),
    hit: tbl(['Hito', 'Fecha', 'Estado'], hitosDe(i.id).sort(by(h => h.fecha)).map(h => `<tr><td>${esc(h.nombre)}</td><td>${fmtD(h.fecha)}</td><td>${hitoEstado(h).t}</td><td class="n"><button class="btn sm" data-act="edit" data-t="hito" data-id="${h.id}">Editar</button></td></tr>`).join(''), btn('Nuevo hito', 'new', { d: { t: 'hito', ini: i.id }, ic: 'plus', cls: 'sm' })),
    dep: `<div class="sub">Habilita a (${dn.length})</div>${dn.map(x => `<div class="pp" style="margin:3px 0">${ragPill(x.rag)} <b>${esc(x.titulo)}</b> <span class="mut">${x.fase}</span></div>`).join('') || '<p class="mut">Nada depende de este registro.</p>'}`,
    bit: `<div class="feed sm">${St.bitacora.filter(b => b.ini === i.id).slice(0, 25).map(b => `<div class="f-i"><span class="f-dot" style="background:${BIT_C[b.tipo]}"></span><div><b>${esc(b.tipo)}</b> · ${esc(b.autor)} <small>${esc(String(b.ts).replace('T', ' '))}</small><p style="margin:2px 0">${esc(b.texto)}</p></div></div>`).join('') || '<p class="mut">Sin registros.</p>'}</div>`
  };
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  Modal: { get: () => Modal, enumerable: true, configurable: true },
  UI: { get: () => UI, enumerable: true, configurable: true },
  banner: { get: () => banner, set: v => { banner = v; }, enumerable: true, configurable: true },
  btn: { get: () => btn, enumerable: true, configurable: true },
  fitMain: { get: () => fitMain, set: v => { fitMain = v; }, enumerable: true, configurable: true },
  go: { get: () => go, set: v => { go = v; }, enumerable: true, configurable: true },
  hitoForm: { get: () => hitoForm, set: v => { hitoForm = v; }, enumerable: true, configurable: true },
  openForm: { get: () => openForm, set: v => { openForm = v; }, enumerable: true, configurable: true },
  pageHead: { get: () => pageHead, enumerable: true, configurable: true },
  panelDec: { get: () => panelDec, set: v => { panelDec = v; }, enumerable: true, configurable: true },
  panelHito: { get: () => panelHito, set: v => { panelHito = v; }, enumerable: true, configurable: true },
  panelIni: { get: () => panelIni, set: v => { panelIni = v; }, enumerable: true, configurable: true },
  panelRisk: { get: () => panelRisk, set: v => { panelRisk = v; }, enumerable: true, configurable: true },
  refresh: { get: () => refresh, set: v => { refresh = v; }, enumerable: true, configurable: true },
  render: { get: () => render, set: v => { render = v; }, enumerable: true, configurable: true },
  renderChrome: { get: () => renderChrome, set: v => { renderChrome = v; }, enumerable: true, configurable: true },
  selOpts: { get: () => selOpts, enumerable: true, configurable: true },
  shell: { get: () => shell, enumerable: true, configurable: true },
  toast: { get: () => toast, set: v => { toast = v; }, enumerable: true, configurable: true },
  updateSyncUI: { get: () => updateSyncUI, enumerable: true, configurable: true },
});
