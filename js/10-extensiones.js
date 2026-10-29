import { ENLACES } from './00-registro.js';
import { $, CALC, fasesDe, compuertas, isDone, rel, ACUERDOS, CAMBIOS, DECS, DEC_C, IC, St, audParse, avatar, by, byId, desv, diffD, esAdmin, esProp, esc, esperado, expo, fmtD, fmtDL, fmtMon, fmtTS, forecast, hitoEstado, hitosDe, hoy, icon, miUsuario, monOf, nivelRiesgo, riesgoAbierto, riesgoCritico, riesgosDe } from './01-nucleo.js';
import { AuthService, Sesion } from './02-datos.js';
import { Acts, Chg, Modal, NAV, UI, Views, btn, closePops, confirmBox, copyText, fasePill, fitMain, go, navBadge, panelIni, render, renderChrome, selOpts, selectEntity, toast } from './03-interfaz.js';
import { subfasesDe } from './05-vistas.js';
import { faseTag, senalesIni } from './05b-vistas-portafolio-fases.js';
import { modoUI } from './07-gobierno.js';
import { NO_PERM, areaVisible, areasDe, areasPermitidas, areasPropias, puedeEditarIni, puedeGobernar, soloLectura } from './07b-gobierno-analisis-capacidad.js';
import { GUIA } from './09b-presentaciones-pptx-proposito.js';

  export const V = window.V22 = {};
  export const sr = (s, p = document) => p.querySelector(s), sra = (s, p = document) => [...p.querySelectorAll(s)];
  export const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const emailYo = () => { const u = AuthService.user && AuthService.user(); return (u && u.email) || ''; };
  const tituloVista = v => (NAV.find(n => n[0] === v) || [0, v === 'ficha' ? 'Ficha' : v])[1];

  /* ---- íconos nuevos ---- */
  Object.assign(IC, {
    eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    eyeoff: 'M17.94 17.94A10.07 10.07 0 0112 19c-7 0-11-7-11-7a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19M1 1l22 22M14.12 14.12a3 3 0 11-4.24-4.24',
    comment: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    pin: 'M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'
  });

  /* ======================= CSS ======================= */

  /* ======================= Skeleton ======================= */
  V.skeleton = () => `<div class="sk-wrap" aria-busy="true"><span class="sr-only" role="status">Cargando datos…</span>
    <div class="sk-head"><i class="sk sk-t"></i><i class="sk sk-s"></i></div>
    <div class="sk-kpis">${'<div class="sk-card"><i class="sk sk-s"></i><i class="sk sk-l"></i><i class="sk sk-s"></i></div>'.repeat(4)}</div>
    <div class="sk-tbl">${'<div class="sk-row"><i class="sk"></i><i class="sk"></i><i class="sk"></i><i class="sk"></i></div>'.repeat(7)}</div></div>`;

  /* ======================= Estados vacíos ======================= */
  const emBtn = (b, pri) => b ? btn(b[0], b[1], { d: b[2] || {}, ic: b[3], cls: pri ? 'pri' : '' }) : '';
  V.emptyRich = (o, noCta) => `<div class="empty rich">${icon(o.ic || 'search', 32)}<h3>${esc(o.title)}</h3><p>${esc(o.line)}</p>${noCta ? '' : `<div class="em-a edit-only">${emBtn(o.p, true)}${emBtn(o.s, false)}</div>`}</div>`;
  const EM = {
    'Sin proyectos': { ic: 'list', title: 'Aún no hay proyectos', line: 'Los proyectos nacen de propuestas aprobadas. Crea la primera, o carga la planificación completa desde Excel.', p: ['Crear propuesta', 'new', { t: 'prop' }, 'bulb'], s: ['Cargar desde Excel', 'cargaxl', {}, 'up'] },
    'Sin hitos': { ic: 'flag', title: 'Aún no hay hitos', line: 'Los hitos son las fechas clave que se miden. Créalos uno a uno o cárgalos todos con la plantilla de Excel.', p: ['Crear hito', 'new', { t: 'hito' }, 'flag'], s: ['Cargar plantilla Excel', 'cargaxl', {}, 'up'] },
    'Sin riesgos': { ic: 'shield', title: 'Aún no hay riesgos registrados', line: 'Anotar los riesgos a tiempo evita sorpresas en el comité.', p: ['Registrar riesgo', 'new', { t: 'risk' }, 'shield'] },
    'Aún no hay comités': { ic: 'users', title: 'Aún no hay comités', line: 'Un comité reúne los temas, decisiones y acuerdos de cada sesión.', p: ['Crear comité', 'new', { t: 'com' }, 'users'] },
    'Sin eventos': { ic: 'cal', title: 'Sin eventos en el calendario', line: 'Agrega reuniones o fechas importantes para tenerlas junto a los hitos.', p: ['Crear evento', 'newevt', {}, 'cal'] }
  };
  V.empty = (t, ic) => EM[t] ? V.emptyRich(EM[t]) : `<div class="empty">${icon(ic, 28)}<p>${esc(t)}</p></div>`;

  /* ======================= Comentarios por área ======================= */
  export const esMia = n => (n.correo && n.correo === emailYo()) || n.autor === miUsuario();
  const notaVisible = n => areaVisible(n.area || 'Transversal');
  const notasVis = () => (St.notas || []).filter(n => n.tipo !== 'interna' && notaVisible(n));
  const internas = id => (St.notas || []).filter(n => n.tipo === 'interna' && n.ini === id).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const notasAbiertas = () => notasVis().filter(n => n.estado !== 'Abordado');
  V.notasAbiertas = notasAbiertas;
  const ctxIni = () => UI.view === 'ficha' ? UI.fichaId : (UI.sel && UI.sel.t === 'ini' ? UI.sel.id : null);
  const areaPorDefecto = ini => { const i = ini && byId(ini); if (i) return i.area; const pr = areasPropias(); return pr[0] || 'Transversal'; };
  UI.nf = UI.nf || { s: 'aqui', ab: false };

  function notaItem(n, gob) {
    const i = n.ini && byId(n.ini), ab = n.estado === 'Abordado';
    return `<div class="v22-n ${ab ? 'ab' : ''}"><div class="n-h">${avatar(n.autor || '?', 22)}<b>${esc(n.autor || 'Alguien')}</b><span>${esc(fmtTS(n.ts))}</span><span class="pill soft" style="margin-left:auto">${esc(areasDe(n.area).join(', ') || 'Transversal')}</span></div>
      <p>${esc(n.texto)}</p>
      <div class="n-r">${icon('pin', 12)}<span>${esc(tituloVista(n.vista || 'dashboard'))}${i ? ' › ' + esc(i.titulo) : ''}${n.ref ? ' › «' + esc(n.ref) + '»' : ''}</span></div>
      <div class="n-a"><button class="btn sm" data-act="notair" data-id="${esc(n.id)}">Ir al lugar</button>${gob ? (ab ? `<button class="btn sm" data-act="notareab" data-id="${esc(n.id)}">Reabrir</button><small>Abordado por ${esc(n.por || '—')} · ${esc(fmtD(n.fAb))}</small>` : `<button class="btn sm pri" data-act="notaok" data-id="${esc(n.id)}">${icon('check', 13)}<span>Marcar abordado</span></button>`) : ''}</div></div>`;
  }
  function notasListBody() {
    const gob = puedeGobernar(), f = UI.nf, ci = ctxIni();
    if (f.s === 'int' && !gob) f.s = 'aqui';
    let L = notasVis().filter(n => f.ab && gob ? true : n.estado !== 'Abordado');
    if (f.s === 'aqui') L = L.filter(n => n.vista === UI.view || (ci && n.ini === ci));
    L.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    const seg = `<div class="seg" style="margin-bottom:10px"><button class="${f.s === 'aqui' ? 'on' : ''}" data-act="notasf" data-s="aqui">Esta pantalla</button><button class="${f.s === 'todos' ? 'on' : ''}" data-act="notasf" data-s="todos">Todos mis comentarios</button>${gob ? `<button class="${f.s === 'int' ? 'on' : ''}" data-act="notasf" data-s="int">Notas internas${nIntSinVer() ? ' (' + nIntSinVer() + ')' : ''}</button>` : ''}</div>${gob && f.s !== 'int' ? `<label class="chk" style="margin-left:10px"><input type="checkbox" ${f.ab ? 'checked' : ''} data-chg="notasab"> <span>Ver abordados</span></label>` : ''}`;
    const body = L.length ? `<div class="v22-nl">${L.map(n => notaItem(n, gob)).join('')}</div>` : V.emptyRich({ ic: 'comment', title: f.s === 'aqui' ? 'Nadie ha comentado aquí' : 'No hay comentarios pendientes', line: gob ? 'Cuando alguien deje una observación en tu área, aparecerá acá para que la abordes.' : 'Si ves algo que corregir o aclarar, déjalo como comentario: lo verá tu área.' }, true);
    return seg + (f.s === 'int' ? intModalBody() : body);
  }
  function notasModal() {
    Modal.open({ title: 'Comentarios por área', wide: false, body: `<div id="v22-nbody">${notasListBody()}</div>`, footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn pri" data-act="notanew">${icon('comment', 14)}<span>Dejar un comentario</span></button>` });
  }
  const notasRefresh = () => { render(); const b = sr('#v22-nbody'); if (b) b.innerHTML = notasListBody(); };
  Acts.notasint = () => { UI.nf.s = 'int'; closePops(); notasModal(); };
  Acts.notaslist = () => { closePops(); notasModal(); };
  Acts.notasf = d => { UI.nf.s = d.s; notasRefresh(); };
  Chg.notasab = el => { UI.nf.ab = el.checked; notasRefresh(); };
  Acts.notaok = d => {
    if (!puedeGobernar()) return NO_PERM('Solo Administra o Responsable pueden marcar un comentario como abordado');
    const n = (St.notas || []).find(x => x.id === d.id); if (!n) return;
    (0, ENLACES.cmdServidor)('apih_nota_estado', { p_id: n.id, p_estado: 'Abordado' }, 'Comentario abordado: ya no se muestra').then(() => { if (sr('#v22-nbody')) notasRefresh(); else render(); });
  };
  Acts.notareab = d => {
    if (!puedeGobernar()) return NO_PERM('Solo Administra o Responsable pueden reabrir un comentario');
    const n = (St.notas || []).find(x => x.id === d.id); if (!n) return;
    (0, ENLACES.cmdServidor)('apih_nota_estado', { p_id: n.id, p_estado: 'Abierto' }, null).then(() => notasRefresh());
  };
  Acts.notair = d => {
    const n = (St.notas || []).find(x => x.id === d.id); if (!n) return; Modal.close();
    if (n.ini && byId(n.ini) && n.vista === 'ficha') { Acts.ficha({ id: n.ini }); return; }
    if (n.ini && byId(n.ini)) { if (Views[n.vista] && n.vista !== 'ficha') UI.view = n.vista; selectEntity('ini', n.ini); return; }
    if (Views[n.vista]) go(n.vista);
  };
  function refDe(target) {
    const row = target.closest('tr,.card,.al,.hrow,section,.kpi,.row,li,.pn-sec,.fl-s,.fit') || target;
    const h = row.querySelector && row.querySelector('h1,h2,h3,h4,b,strong');
    let t = ((h && h.textContent) || row.textContent || '').replace(/\s+/g, ' ').trim();
    return { ref: t.slice(0, 70), rid: (target.closest('[data-id]') || {}).dataset ? (target.closest('[data-id]').dataset.id || '') : '' };
  }
  Acts.notapick = () => { closePops(); UI.pick = true; document.body.classList.add('v22-pick'); toast('Haz clic en el lugar de la pantalla que quieres comentar (Esc cancela)'); };
  function pickOff() { UI.pick = false; document.body.classList.remove('v22-pick'); }
  document.addEventListener('click', e => {
    if (!UI.pick) return;
    const t = e.target.closest('#main,#panel'); if (!t) { if (!e.target.closest('.toast')) pickOff(); return; }
    e.preventDefault(); e.stopPropagation(); pickOff();
    const r = refDe(e.target); composer({ ref: r.ref, rid: r.rid });
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.pick) pickOff(); });
  function composer(c) {
    c = Object.assign({ ref: '', rid: '' }, c || {});
    const ini = ctxIni(), i = ini && byId(ini), areas = [...new Set([areaPorDefecto(ini), ...areasPermitidas(), 'Transversal'])].filter(Boolean);
    const dflt = areasDe(areaPorDefecto(ini))[0] || 'Transversal';
    Modal.open({ title: 'Dejar un comentario', body: `<div class="v22-f"><div class="v22-ctx">${icon('pin', 14)}<span><b>Dónde:</b> ${esc(tituloVista(UI.view))}${i ? ' › ' + esc(i.titulo) : ''}${c.ref ? ' › «' + esc(c.ref) + '»' : ''}<br><small>Lo verán quienes tienen acceso al área elegida. Un administrador lo marcará como abordado.</small></span></div>
      <label for="v22-ntx">Tu comentario</label><textarea id="v22-ntx" placeholder="Ej.: la fecha del hito 3 ya no es realista…"></textarea>
      <div id="v22-narw"><label for="v22-nar">Área que debe verlo</label><select id="v22-nar">${selOpts(areas.flatMap(a => areasDe(a)).filter((a, k, arr) => arr.indexOf(a) === k), dflt)}</select></div>
      <div style="margin-top:8px"><button class="btn sm" data-act="notapick">${icon('target', 13)}<span>Elegir otro lugar de la pantalla</span></button></div></div>`,
      footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="notasave">Publicar comentario</button>` });
    Modal.cur.v22 = c; setTimeout(() => { const t = sr('#v22-ntx'); if (t) t.focus(); }, 40);
  }
  Acts.notanew = () => { closePops(); composer({}); };
  Acts.notasave = () => {
    const tx = (sr('#v22-ntx') || {}).value, ar = (sr('#v22-nar') || {}).value;
    if (!tx || !tx.trim()) return toast('Escribe tu comentario', 'err');
    const c = (Modal.cur && Modal.cur.v22) || {}, ini = ctxIni();
    (0, ENLACES.cmdServidor)('apih_nota_guardar', { p_id: null, p_datos: { ini: ini || (c.rid && byId(c.rid) ? c.rid : null), area: ar || 'Transversal', vista: UI.view, ref: c.ref || '', texto: tx.trim() } }, 'Comentario publicado', true).then(r => { if (r === null) return; Modal.close(); render(); });
  };

  /* ======================= Ficha larga ======================= */
  const panelIni0 = panelIni;
  export function parsePanel(i, tab) {
    const keep = UI.tab; UI.tab = tab; let h = ''; try { h = panelIni0(i); } finally { UI.tab = keep; }
    const t = document.createElement('template'); t.innerHTML = h; const f = t.content;
    const kx = f.querySelector('.pn-k'); if (kx) kx.querySelectorAll('button').forEach(b => b.remove());
    return { kicker: kx ? kx.innerHTML : '', title: (f.querySelector('.pn-h h3') || {}).innerHTML || '', pills: (f.querySelector('.pn-p') || {}).innerHTML || '', acts: (f.querySelector('.pn-a') || {}).innerHTML || '', body: f.querySelector('.pn-b') };
  }
  export const SECS = [
    ['res', 'Resumen', 'list', true], ['pla', 'Planificación', 'gantt', true], ['cif', 'Cifras, fechas y responsables', 'money'], ['sal', 'Salud y recomendación', 'target'], ['dep', 'Dependencias', 'link'], ['log', 'Logros y próximos pasos', 'check'], ['cal', 'Calidad de datos', 'shield'],
    ['hit', 'Hitos', 'flag', true], ['rie', 'Riesgos', 'shield'], ['dec', 'Decisiones', 'gavel'], ['com', 'Compromisos', 'users'], ['cam', 'Control de cambios', 'refresh', false, 'prj'], ['act', 'Historial', 'book', true], ['alertas', 'Alertas', 'spark'], ['doc', 'Documentación', 'book'], ['int', 'Notas internas del PMO', 'lock', true], ['nota', 'Comentarios del área', 'comment', true]
  ];
  const SIMPLE_OPEN = ['res', 'cif', 'hit', 'rie', 'doc', 'int'];
  export const fh = () => (UI.fh = UI.fh || (() => { try { return JSON.parse(lsGet('apih_fh') || '{}'); } catch (e) { return {}; } })());
  export const fhSave = () => lsSet('apih_fh', JSON.stringify(fh()));
  export const fOculta = k => !!(fh()[k] && fh()[k].h);
  export const fAbierta = k => { const s = fh()[k]; if (s && s.c != null) return !s.c; return false; };
  export function grupoResumen(el) {
    const h = ((el.querySelector && el.querySelector('h4')) || {}).textContent || '';
    if (/Salud|Recomendaci/i.test(h)) return 'sal'; if (/Dependencias|Habilita/i.test(h)) return 'dep'; if (/Logros|Pr[oó]ximos/i.test(h)) return 'log'; if (/Calidad/i.test(h)) return 'cal';
    if (el.querySelector && el.querySelector('.kvs') && !h) return 'cif'; return 'res';
  }
  export function secHitos(i) {
    const all = hitosDe(i.id).sort(by('fecha')), fc = (UI.fcat || {}).h || '', hs = fc ? all.filter(h => (h.cat || '—') === fc) : all;
    if (!all.length) return [0, V.emptyRich({ ic: 'flag', title: (esProp(i) ? 'Esta propuesta' : 'Este proyecto') + ' aún no tiene hitos', line: 'Sin hitos no se puede medir el avance esperado. Cárgalos con la plantilla de Excel o créalos uno a uno.', p: ['Cargar plantilla Excel', 'cargaxl', {}, 'up'], s: ['Crear hito', 'new', { t: 'hito', ini: i.id }, 'flag'] })];
    return [all.length, catChips('h', all.map(h => h.cat || '—')) + `<table class="tbl"><thead><tr><th></th><th>Hito</th><th>Categoría</th><th>Fase</th><th>Fecha</th><th>Estado</th><th>Responsable</th><th></th></tr></thead><tbody>${hs.map(h => { const e = hitoEstado(h); return `<tr><td><input type="checkbox" ${h.completado ? 'checked' : ''} data-chg="hitotoggle" data-id="${h.id}" aria-label="Completado"></td><td><b class="${h.completado ? 'strike' : ''}">${esc(h.nombre)}</b></td><td>${h.cat ? `<span class="pill soft">${esc(h.cat)}</span>` : '<span class="mut">—</span>'}</td><td>${fasePill(h.fase)}${(x => x ? ` <small class="mut">› ${esc(x.nombre)}</small>` : '')(h.subfase && subfasesDe(byId(h.ini)).find(y => y.id === h.subfase))}</td><td>${fmtD(h.fecha)}</td><td style="color:${e.c}">${e.t}</td><td>${esc(h.resp || '—')}</td><td><button class="icon-btn sm" data-act="edit" data-t="hito" data-id="${h.id}" aria-label="Editar">${icon('edit', 14)}</button></td></tr>`; }).join('')}</tbody></table>`];
  }
  /* chips de categoría con conteo; clic filtra la sección (h: hitos · r: riesgos) */
  function catChips(t, cats) {
    const cur = (UI.fcat || {})[t] || '', cnt = {}; cats.forEach(c => cnt[c] = (cnt[c] || 0) + 1); const ks = Object.keys(cnt).sort((a, b) => a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b));
    if (ks.length < 2 && !cur) return '';
    return `<div class="cat-chips" role="group" aria-label="Filtrar por categoría"><button class="chip ${!cur ? 'on' : ''}" aria-pressed="${!cur}" data-act="fcat" data-t="${t}" data-c="">Todas · ${cats.length}</button>${ks.map(c => `<button class="chip ${cur === c ? 'on' : ''}" aria-pressed="${cur === c}" data-act="fcat" data-t="${t}" data-c="${esc(c)}">${esc(c === '—' ? 'Sin categoría' : c)} · ${cnt[c]}</button>`).join('')}</div>`;
  }
  export function secRiesgos(i) {
    const rall = riesgosDe(i.id).sort(by(r => -expo(r))), fr = (UI.fcat || {}).r || '', rs = fr ? rall.filter(r => (r.cat || '—') === fr) : rall;
    if (!rall.length) return [0, V.emptyRich({ ic: 'shield', title: 'Sin riesgos registrados', line: 'Registrar un riesgo a tiempo es más barato que explicarlo después.', p: ['Registrar riesgo', 'new', { t: 'risk', ini: i.id }, 'shield'] })];
    return [rall.length, catChips('r', rall.map(r => r.cat || '—')) + (rs.map(r => { const n = nivelRiesgo(r); return `<button class="al" data-act="sel" data-t="risk" data-id="${r.id}"><span class="expo" style="background:${n.c}">${expo(r)}</span><span><b>${esc(r.desc)}</b><small>${esc(r.cat || 'Sin categoría')} · ${r.estado} · ${esc(r.dueno || 'sin dueño')}</small></span></button>`; }).join('') || '<p class="mut">Sin riesgos en esta categoría.</p>')];
  }
  export function secDec(i) {
    const ds = DECS().filter(d => d.ini === i.id);
    if (!ds.length) return [0, V.emptyRich({ ic: 'gavel', title: 'Sin decisiones asociadas', line: 'Aquí quedan las decisiones del comité sobre esta iniciativa, con responsable y fecha.', p: ['Registrar decisión', 'new', { t: 'dec', ini: i.id }, 'gavel'] })];
    return [ds.length, ds.map(d => `<button class="al" data-act="sel" data-t="dec" data-id="${d.id}"><span class="pill" style="--c:${DEC_C[d.tipo]}">${esc(d.tipo)}</span><span><b>${esc(d.titulo)}</b><small>${esc(d.estado)} · límite ${fmtD(d.limite)}</small></span></button>`).join('')];
  }
  export function secCom(i) {
    const cs = ACUERDOS().filter(c => c.ini === i.id);
    if (!cs.length) return [0, V.emptyRich({ ic: 'users', title: 'Sin compromisos', line: 'Los acuerdos de reuniones quedan aquí con responsable y fecha.', p: ['Crear compromiso', 'acunew', { id: i.id }, 'check'] })];
    return [cs.length, cs.map(c => `<div class="hrow"><div><b>${esc(c.texto)}</b><small>${esc(c.estado)} · ${esc(c.resp || 'sin responsable')} · límite ${fmtD(c.limite)}</small></div></div>`).join('')];
  }
  export function secCam(i) {
    const cs = CAMBIOS().filter(c => c.ini === i.id);
    if (!cs.length) return [0, V.emptyRich({ ic: 'refresh', title: 'Sin cambios solicitados', line: 'Todo cambio de alcance, fecha o presupuesto queda registrado con quién lo aprobó.', p: ['Solicitar cambio', 'chgnew', { id: i.id }, 'refresh'] })];
    return [cs.length, cs.map(c => `<div class="hrow"><div><b>${esc(c.tipo)} · ${esc(c.desc || c.id)}</b><small>${esc(c.estado)} · ${esc(c.solicita || '')} · ${fmtD(c.creada)}</small></div></div>`).join('')];
  }
  UI.fi = UI.fi || { solo: false, inc: false };
  const intTodas = () => (St.notas || []).filter(n => n.tipo === 'interna' && n.ini && byId(n.ini));
  const intNoVistas = id => intTodas().filter(n => !n.visto && (!id || n.ini === id)).sort((a, b) => (a.ts > b.ts ? 1 : -1));
  const nIntSinVer = () => puedeGobernar() ? intNoVistas().length : 0;
  V.nIntSinVer = nIntSinVer;
  function intTexto(list) {
    const G = {}; list.forEach(n => (G[n.ini] = G[n.ini] || []).push(n));
    return Object.keys(G).map(id => { const i = byId(id); return (i ? i.titulo : id) + ' (' + id + ') — notas internas no vistas:\n' + G[id].map(n => '- [' + fmtD(String(n.ts).slice(0, 10)) + '] ' + (n.autor || '—') + ': ' + n.texto).join('\n'); }).join('\n\n');
  }
  function intItem(n, conIni) {
    const g = puedeGobernar(), nv = g && !n.visto, i = byId(n.ini), pue = g && (esMia(n) || esAdmin());
    return `<div class="v22-n ${!g ? '' : nv ? 'nv' : 'ab'}"><div class="n-h">${avatar(n.autor || '?', 22)}<b>${esc(n.autor || '—')}</b><span>${esc(fmtTS(n.ts))}${n.edit ? ' · editada' : ''}</span>${g ? `<span class="pill ${nv ? '' : 'soft'}" style="margin-left:auto">${nv ? 'Sin ver' : 'Vista'}</span>` : ''}</div>
      ${conIni && i ? `<div class="n-r">${icon('pin', 12)}<span>${esc(i.titulo)} · ${esc(i.id)}</span></div>` : ''}<p>${esc(n.texto)}</p>
      <div class="n-a">${!g ? '' : nv ? `<button class="btn sm pri" data-act="intvisto" data-id="${esc(n.id)}" data-v="1">${icon('check', 13)}<span>Marcar visto</span></button>` : `<button class="btn sm" data-act="intvisto" data-id="${esc(n.id)}" data-v="0">Marcar como no vista</button><small>Visto por ${esc(n.vistoPor || '—')} · ${esc(fmtD(n.fVisto))}</small>`}
      ${conIni ? `<button class="btn sm" data-act="intir" data-id="${esc(n.ini)}">Ir a la ficha</button>` : (pue ? `<button class="btn sm" data-act="intedit" data-id="${esc(n.id)}">Editar</button><button class="btn sm" data-act="intdel" data-id="${esc(n.id)}">Eliminar</button>` : '')}</div></div>`;
  }
  const intBar = (id, nv) => `<div class="v22-iv"><span class="pill ${nv ? '' : 'soft'}">${nv ? nv + ' sin ver' : 'Todo visto'}</span><label class="chk"><input type="checkbox" ${UI.fi.solo ? 'checked' : ''} data-chg="intsolo"> <span>Solo no vistas</span></label><span class="grow"></span>${nv ? `<button class="btn sm" data-act="intcopy" data-id="${esc(id)}">Copiar no vistas</button><button class="btn sm" data-act="intvistoall" data-id="${esc(id)}">Marcar todas como vistas</button>` : ''}</div>`;
  export function secInt(i) {
    const g = puedeGobernar(), all = internas(i.id), nv = intNoVistas(i.id).length, L = g && UI.fi.solo ? all.filter(n => !n.visto) : all;
    const ed = !g ? '' : `<div class="v22-f"><textarea id="v22-int" data-key="intxt" placeholder="Nota interna del PMO: contexto, acuerdos, alertas… (la ven todos los que acceden a esta iniciativa; solo el PMO escribe)"></textarea><div style="margin-top:6px"><button class="btn pri sm" data-act="intadd" data-id="${esc(i.id)}">${icon('plus', 13)}<span>Guardar nota</span></button></div></div>`;
    const lst = L.length ? `<div class="v22-nl" style="margin-top:10px;max-height:none">${L.map(n => intItem(n, false)).join('')}</div>` : `<p class="mut" style="margin:10px 0 0">${all.length ? 'No hay notas sin ver en esta iniciativa.' : (g ? 'Aún no hay notas. Lo que escribas queda guardado aquí, en orden, como historial interno de esta iniciativa.' : 'El PMO aún no ha dejado notas.')}</p>`;
    return [all.length, ed + (g && all.length ? intBar(i.id, nv) : '') + lst];
  }
  function intRefrescar() { render(); const b = sr('#v22-nbody'); if (b) b.innerHTML = notasListBody(); }
  Chg.intsolo = el => { UI.fi.solo = el.checked; intRefrescar(); };
  Chg.intinc = el => { UI.fi.inc = el.checked; intRefrescar(); };
  Acts.intvisto = d => { const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar()) return NO_PERM('Las notas internas son del PMO'); (0, ENLACES.cmdServidor)('apih_nota_visto', { p_ids: [n.id], p_visto: d.v === '1' }, null).then(() => intRefrescar()); };
  Acts.intvistoall = d => {
    if (!puedeGobernar()) return NO_PERM('Las notas internas son del PMO');
    const L = intNoVistas(d.id === '*' ? null : d.id); if (!L.length) return;
    (0, ENLACES.cmdServidor)('apih_nota_visto', { p_ids: L.map(n => n.id), p_visto: true }, L.length + ' nota(s) marcada(s) como vistas').then(() => intRefrescar());
  };
  Acts.intcopy = d => { const L = intNoVistas(d.id === '*' ? null : d.id); if (!L.length) return toast('No hay notas sin ver'); copyText(intTexto(L)); };
  Acts.intir = d => { Modal.close(); Acts.ficha({ id: d.id }); };
  function intModalBody() {
    const gob = puedeGobernar(); if (!gob) return '';
    const todas = intTodas().sort((a, b) => (a.ts < b.ts ? 1 : -1)), nv = todas.filter(n => !n.visto).length, L = UI.fi.inc ? todas : todas.filter(n => !n.visto);
    const bar = `<div class="v22-iv" style="margin:0 0 10px"><span class="pill ${nv ? '' : 'soft'}">${nv ? nv + ' sin ver' : 'Todo visto'}</span><label class="chk"><input type="checkbox" ${UI.fi.inc ? 'checked' : ''} data-chg="intinc"> <span>Incluir ya vistas</span></label><span class="grow"></span>${nv ? `<button class="btn sm" data-act="intcopy" data-id="*">Copiar no vistas</button><button class="btn sm" data-act="intvistoall" data-id="*">Marcar todas como vistas</button>` : ''}</div>`;
    return bar + (L.length ? `<div class="v22-nl">${L.map(n => intItem(n, true)).join('')}</div>` : V.emptyRich({ ic: 'lock', title: 'Todo al día', line: 'No hay notas internas sin ver. Cuando agregues o edites una, aparecerá acá.' }, true));
  }
  Acts.intadd = d => {
    if (!puedeGobernar()) return NO_PERM('Las notas internas son del PMO (Administra o Responsable)');
    const el = sr('#v22-int'), tx = el && el.value.trim(); if (!tx) return toast('Escribe la nota', 'err');
    const i = byId(d.id); if (!i) return;
    (0, ENLACES.cmdServidor)('apih_nota_guardar', { p_id: null, p_datos: { ini: i.id, tipo: 'interna', vista: 'ficha', texto: tx } }, 'Nota interna guardada', true).then(r => { if (r !== null) render(); });
  };
  Acts.intdel = d => {
    const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar() || !(esMia(n) || esAdmin())) return NO_PERM('Solo quien la escribió o el administrador puede eliminarla');
    confirmBox('¿Eliminar esta nota interna?', () => { (0, ENLACES.cmdServidor)('apih_nota_eliminar', { p_id: n.id }, 'Nota eliminada').then(() => render()); }, 'Eliminar', true);
  };
  Acts.intedit = d => {
    const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar() || !(esMia(n) || esAdmin())) return NO_PERM('Solo quien la escribió o el administrador puede editarla');
    Modal.open({ title: 'Editar nota interna', body: `<div class="v22-f"><textarea id="v22-intx">${esc(n.texto)}</textarea></div>`, footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="intsave" data-id="${esc(n.id)}">Guardar</button>` });
  };
  Acts.intsave = d => { const n = (St.notas || []).find(x => x.id === d.id), t = (sr('#v22-intx') || {}).value; if (!n || !t || !t.trim()) return toast('La nota no puede quedar vacía', 'err'); (0, ENLACES.cmdServidor)('apih_nota_guardar', { p_id: n.id, p_datos: { texto: t.trim() } }, null, true).then(r => { if (r === null) return; Modal.close(); render(); }); };
  export function secNota(i) {
    const ns = notasVis().filter(n => n.ini === i.id && n.estado !== 'Abordado'), gob = puedeGobernar();
    if (!ns.length) return [0, V.emptyRich({ ic: 'comment', title: 'Sin comentarios pendientes', line: 'Si ves algo que corregir o aclarar, déjalo aquí: lo verá el área y un administrador lo abordará.', p: ['Dejar un comentario', 'notanew', {}, 'comment'] })];
    return [ns.length, `<div class="v22-nl">${ns.map(n => notaItem(n, gob)).join('')}</div>`];
  }
  /* ---- V22.43: Historial por registro ---- */
  UI.hs = UI.hs || { f: 'todo', n: 15 };
  const HS_F = [['todo', 'Todo'], ['campos', 'Campos'], ['fase', 'Fase y estado'], ['coment', 'Comentarios'], ['hr', 'Hitos y riesgos']];
  function hsItem(b) {
    let tag = b.tipo, g = 'otros', P = null;
    if (b.tipo === 'Edición') { P = audParse(b.texto); tag = P.kind === 'Iniciativa' ? 'Edición' : P.kind; g = /^(Hito|Riesgo)$/.test(P.kind) ? 'hr' : 'campos'; }
    else if (b.tipo === 'Comentario') g = 'coment';
    else if (b.tipo === 'Riesgo') g = 'hr';
    else if (b.tipo === 'Cambio' && /fase|Estado:|RAG |Línea base|reabierta/i.test(b.texto)) { tag = 'Fase'; g = 'fase'; }
    else if (b.tipo === 'Cambio' && /^(Hito|Riesgo)/.test(b.texto)) { tag = b.texto.startsWith('Hito') ? 'Hito' : 'Riesgo'; g = 'hr'; }
    return { b, tag, g, P };
  }
  const HS_TC = { 'Edición': '#0D446A', 'Fase': '#CA5010', 'Hito': '#107C10', 'Riesgo': '#D13438', 'Comentario': '#8764B8', 'Decisión': '#CA5010', 'Compromiso': '#0D446A', 'Cambio': '#0D446A', 'Actualización': '#107C10' };
  export function histHTML(i) {
    const all = St.bitacora.filter(x => x.ini === i.id && !/^Hito actualizado: /.test(x.texto || '')).map(hsItem);
    const cnt = k => k === 'todo' ? all.length : all.filter(x => x.g === k).length;
    const f = UI.hs.f, L = all.filter(x => f === 'todo' || x.g === f), V = L.slice(0, UI.hs.n);
    const dl = d => { const k = diffD(d, hoy()); return k === 0 ? 'Hoy' : k === -1 ? 'Ayer' : fmtDL(d); };
    const days = []; V.forEach(x => { const d = String(x.b.ts).slice(0, 10); let g = days[days.length - 1]; if (!g || g.d !== d) { g = { d, it: [] }; days.push(g); } g.it.push(x); });
    const row = r => `<div class="hs-r"><span>${esc(r[0])}</span><span><s>${esc(r[1])}</s><span class="ar">→</span><em>${esc(r[2])}</em></span></div>`;
    const it = x => `<div class="hs-i">${avatar(x.b.autor || '?', 28)}<div><div class="hs-h"><b>${esc(x.b.autor || '—')}</b><span class="hs-tag" style="--c:${HS_TC[x.tag] || '#0D446A'}">${esc(x.tag)}</span>${x.P && x.P.ent ? `<span class="hs-ent">${esc(x.P.ent)}</span>` : ''}<time>${esc(String(x.b.ts).length > 10 ? String(x.b.ts).slice(11, 16) : '')}</time></div>${x.P && x.P.rows ? `<div class="hs-d">${x.P.rows.map(row).join('')}</div>` : `<div class="hs-t">${esc(x.P ? x.P.raw : x.b.texto)}</div>`}</div></div>`;
    return `<div class="pn-sec"><div class="composer"><input id="cmt" placeholder="Agregar comentario…" data-key="cmt"><button class="btn pri sm" data-act="comment" data-id="${i.id}" aria-label="Enviar comentario">${icon('send', 13)}</button></div>
      <div class="hs-bar">${HS_F.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" style="--c:#0D446A" data-act="hsfil" data-k="${k}"><i></i>${l} · ${cnt(k)}</button>`).join('')}</div>
      ${days.map(g => `<div class="hs-day">${esc(dl(g.d))}</div>${g.it.map(it).join('')}`).join('') || '<p class="mut">Sin registros para este filtro.</p>'}
      ${L.length > V.length ? `<div class="hs-more"><button class="btn sm" data-act="hsmas">Ver ${Math.min(15, L.length - V.length)} más · quedan ${L.length - V.length}</button></div>` : ''}</div>`;
  }
  Acts.hsfil = d => { UI.hs.f = d.k; UI.hs.n = 15; render(); };
  Acts.hsmas = () => { UI.hs.n += 15; render(); };

  /* Panorama de la ficha: etapa, cuatro cifras, qué sigue y cronograma. Lo demás queda en filas plegadas («Todo lo demás»). */
  export function panoFicha(i) {
    const PR = esProp(i), FS = fasesDe(i), idx = Math.max(0, FS.indexOf(i.fase)), fin = isDone(i), sig = FS[idx + 1] || null, to = fin ? null : (sig || 'Cierre'), H = hoy();
    const g = to ? compuertas(i) : [], gok = g.filter(x => x.ok).length;
    const strip = `<section class="pa-fase" aria-label="Etapa"><div class="pa-seg">${FS.map((f, k) => `<div><i class="${k < idx ? 'd' : k === idx ? 'c' : ''}"></i><span class="${k === idx ? 'on' : ''}">${k < idx ? '✓ ' : ''}${esc(f)}${k === idx ? ' · actual' : ''}</span></div>`).join('')}</div><div class="pa-go">${to && !fin ? `<span>Para pasar a <b>${esc(to)}</b>: <b>${gok} de ${g.length}</b> condiciones</span>` : ''}${fin ? '' : `<span class="edit-only">${btn('Cambiar etapa', 'etapa', { d: { id: i.id }, ic: 'chev' })}</span>`}</div></section>`;
    if (PR) return strip;
    const av = Math.round(+i.avance || 0), pl = Math.round(esperado(i)), dv = desv(i), fc = forecast(i), pres = +i.presupuesto || 0, gas = i.gastado == null || i.gastado === '' ? null : +i.gastado, gp = pres > 0 && gas != null && isFinite(gas) ? Math.round(gas / pres * 100) : null;
    const um = +((CALC.ini[i.id] || {}).umbral) || +St.cfg.umbralCritico, rs = riesgosDe(i.id).filter(riesgoAbierto), rk = rs.filter(riesgoCritico), rks = rk.filter(r => !String(r.mit || '').trim());
    const kp = (t, v, sub, bad, extra) => `<div class="pa-k"><span class="pa-kt">${t}</span><div class="pa-kv"><b>${v}</b>${sub ? `<span class="${bad ? 'bad-t' : 'mut'}">${sub}</span>` : ''}</div>${extra || ''}</div>`;
    const cifras = `<section class="pa-ks" aria-label="Cifras">${kp('Avance', av + ' %', 'plan ' + pl + ' %', false, `<div class="pa-bar"><i style="width:${Math.max(0, Math.min(100, av))}%"></i><u style="left:${Math.max(0, Math.min(100, pl))}%"></u></div>`)}${kp('Fin proyectado', fc ? fmtD(fc) : '—', dv > 0 ? '+' + dv + ' d' : 'en plazo', dv > 0, i.finPlan ? `<span class="mut pa-ks2">Plan: ${fmtD(i.finPlan)}</span>` : '')}${kp('Gasto', gp != null ? gp + ' %' : '—', gp != null ? fmtMon(gas, monOf(i)) + ' de ' + fmtMon(pres, monOf(i)) : '', false, gp != null && gp > av + 10 ? '<span class="bad-t pa-ks2">Por encima del avance</span>' : '')}${kp('Riesgos críticos', String(rk.length), 'de ' + rs.length + ' abiertos', false, rks.length ? '<span class="bad-t pa-ks2">' + rks.length + ' sin mitigación</span>' : '')}</section>`;
    const hs = hitosDe(i.id).filter(h => !h.completado).sort(by('fecha')).slice(0, 4), edit = !soloLectura() && puedeEditarIni(i);
    const nx = `<div class="pa-c"><h2>Qué sigue</h2>${hs.length ? hs.map(h => { const d = h.fecha ? diffD(h.fecha, H) : null, ven = d != null && d < 0; return `<div class="pa-r"><span class="tg ${ven ? 'bad' : ''}">${ven ? 'Vencido' : h.fecha ? fmtD(h.fecha) : 'Sin fecha'}</span><span class="pa-rt"><b>${esc(h.nombre)}</b><small class="mut">${h.fecha ? fmtD(h.fecha) : ''}${h.resp ? ' · ' + esc(h.resp) : ''}${d == null ? '' : ven ? ' · vencido hace ' + (-d) + ' d' : ' · en ' + d + ' d'}</small></span>${edit ? btn('Abrir', 'edit', { d: { t: 'hito', id: h.id }, cls: 'sm' }) : ''}</div>`; }).join('') : '<p class="mut">Sin hitos pendientes.</p>'}</div>`;
    const V_ = (0, ENLACES.fasesVentana)(i).filter(v => v.ini && v.fin);
    let cr = '<div class="pa-c"><h2>Cronograma</h2><p class="mut">Sin fechas de fase todavía.</p></div>';
    if (V_.length) {
      const a = V_.reduce((m, v) => v.ini < m ? v.ini : m, V_[0].ini), b = V_.reduce((m, v) => v.fin > m ? v.fin : m, V_[0].fin), T = Math.max(1, diffD(b, a)), pc = d => Math.max(0, Math.min(100, diffD(d, a) / T * 100));
      const hoyL = H >= a && H <= b ? `<i class="pa-hoy" style="left:${pc(H).toFixed(1)}%"><em>Hoy</em></i>` : '';
      cr = `<div class="pa-c"><h2>Cronograma</h2><div class="pa-gt" style="height:${V_.length * 30 + 6}px">${V_.map((v, k) => `<div class="pa-b ${v.actual ? 'cur' : ''}" style="left:${pc(v.ini).toFixed(1)}%;width:${Math.max(4, pc(v.fin) - pc(v.ini)).toFixed(1)}%;top:${k * 30}px;background:${v.color}" title="${esc(v.fase)} · ${rangoTxt(v.ini, v.fin)}">${esc(v.fase)}</div>`).join('')}${hoyL}</div><div class="pa-ax"><span>${fmtD(a)}</span><span>${fmtD(b)}</span></div>${(0, ENLACES.hitosFuera)(i).length ? `<p class="mut" style="margin:6px 0 0;font-size:12px">${(0, ENLACES.hitosFuera)(i).length} hitos con fecha fuera de su fase. ${edit ? `<a class="lnk" data-act="fasefix" data-id="${i.id}">Corregir</a>` : ''}</p>` : ''}</div>`;
    }
    return strip + cifras + `<section class="pa-2">${nx}${cr}</section>`;
  }
  const rangoTxt = (a, b) => fmtD(a) + ' → ' + fmtD(b);
  Acts.ficha = d => { UI.fichaId = d.id; if (UI.view !== 'ficha') UI.fichaFrom = UI.view; UI.sel = null; UI.panel = false; go('ficha'); };
  Acts.flback = () => { const v = UI.fichaFrom && Views[UI.fichaFrom] ? UI.fichaFrom : (byId(UI.fichaId) && esProp(byId(UI.fichaId)) ? 'propuestas' : 'proyectos'); go(v); };
  Acts.fleye = d => { const s = (fh()[d.k] = fh()[d.k] || {}); s.h = !s.h; fhSave(); render(); };
  Acts.flcol = d => { const s = (fh()[d.k] = fh()[d.k] || {}); s.c = fAbierta(d.k); fhSave(); render(); };
  Acts.fltab = d => {
    const o = (fh()[d.k] = fh()[d.k] || {}); o.h = false; o.c = false; fhSave(); UI.flTab = d.k; closePops(); render();
    const el = document.getElementById('fl-' + d.k); if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  };
  Acts.flall = d => { SECS.forEach(s => { const o = (fh()[s[0]] = fh()[s[0]] || {}); o.c = d.m !== 'open'; if (d.m === 'open') o.h = false; }); fhSave(); render(); };
  document.addEventListener('dblclick', e => { const el = e.target.closest('[data-act="sel"][data-t="ini"]'); if (el && !e.target.closest('input,button:not([data-act="sel"]),select,textarea')) Acts.ficha({ id: el.dataset.id }); });

  /* botón «Ficha completa» en el panel contextual + estado vacío de hitos en el panel */
  /* Panel de proyectos = RESUMEN en 3 bloques (por qué está así · qué sigue · pendientes con otras personas); los cambios y los reportes viven en la ficha */
  function panelResumen(i) {
    const H = hoy(), FS = fasesDe(i), idx = FS.indexOf(i.fase), fin = isDone(i), sig = FS[idx + 1] || null, to = fin ? null : (sig || 'Cierre');
    const sen = senalesIni(i), hs = hitosDe(i.id).filter(h => !h.completado).sort(by('fecha')).slice(0, 3);
    const g = to ? compuertas(i) : [], gok = g.filter(x => x.ok).length, falta = g.filter(x => !x.ok).map(x => x.t);
    const dec = St.decisiones.filter(d => d.ini === i.id && d.estado === 'Pendiente').map(d => ({ o: d.limite || '9', h: `<div><b>Decisión</b> «${esc(d.titulo)}» · ${d.limite && d.limite < H ? '<span class="bad-t">vencida hace ' + diffD(H, d.limite) + ' d</span>' : d.limite ? 'vence ' + rel(d.limite) : 'sin fecha límite'}${d.area ? ' · ' + esc(d.area) : ''}</div>` }));
    const cmp = (St.compromisos || []).filter(c => c.ini === i.id && c.estado === 'Abierto').map(c => ({ o: c.limite || '9', h: `<div><b>${c.limite && c.limite < H ? '<span class="bad-t">Compromiso vencido</span>' : 'Compromiso'}</b> «${esc(c.texto)}»${c.resp ? ' · ' + esc(c.resp) : ''}${c.limite && c.limite < H ? ' · hace ' + diffD(H, c.limite) + ' d' : c.limite ? ' · ' + rel(c.limite) : ''}</div>` }));
    const dep = (i.deps || []).map(id => byId(id)).filter(Boolean).map(x => ({ o: '99', h: `<div><b>Depende de</b> ${esc(x.id)} ${esc(x.titulo)} · ${esc(x.estado)}${x.tipo === 'Proyecto' ? ', ' + Math.round(+x.avance || 0) + ' %' : ''}</div>` }));
    const pend = [...dec, ...cmp, ...dep].sort((a, b) => String(a.o).localeCompare(String(b.o))).slice(0, 6);
    const ult = i.actualizada ? diffD(H, i.actualizada) : null;
    const bt = `<button class="btn pri pn-main" data-act="ficha" data-id="${esc(i.id)}" title="Ver y editar todo en una sola página">${icon('full', 14)}<span>Abrir ficha</span></button>`;
    const upd = ult == null ? '' : `<span class="mut pn-upd">Actualizado ${ult === 0 ? 'hoy' : 'hace ' + ult + (ult === 1 ? ' día' : ' días')}</span>`;
    const head = `<div class="pn-h pn-c pn-slim"><h3 class="sr-only">${esc(i.id)} ${esc(i.titulo)}</h3>${upd || '<span></span>'}${bt}<button class="icon-btn sm" data-act="panelx" title="Cerrar panel" aria-label="Cerrar panel">${icon('x', 15)}</button></div>`;
    return head + `<div class="pn-b">
      <div class="pn-sec"><h4>Por qué está en ${esc(i.rag)}</h4><div class="pn-sig">${sen.map(x => `<div class="sg ${x.bad ? 'bad' : 'ok'}"><span class="tg">${x.bad ? 'Atención' : 'En orden'}</span><span><b>${esc(x.t)}</b> ${esc(x.d)}</span></div>`).join('')}</div></div>
      <div class="pn-sec"><h4>Qué sigue</h4>${hs.length ? `<div class="pn-nx">${hs.map(h => `<div><span class="d">${fmtD(h.fecha)}</span><b>${esc(h.nombre)}</b><span class="r">${esc(h.resp || '')}</span></div>`).join('')}</div>` : '<p class="mut">Sin hitos pendientes.</p>'}
        ${to ? `<div class="pn-gt"><b>Para ${sig ? 'pasar a ' + esc(sig) : 'completar el proyecto'}: ${gok} de ${g.length} compuertas</b><div class="bar"><i style="width:${g.length ? Math.round(gok / g.length * 100) : 100}%"></i></div>${falta.length ? `<div>Faltan: ${falta.map(esc).join(' · ')}.</div>` : '<div>Cumple todas las compuertas.</div>'}</div>` : ''}</div>
      <div class="pn-sec"><h4>Pendientes con otras personas</h4>${pend.length ? `<div class="pn-pd">${pend.map(x => x.h).join('')}</div>` : '<p class="mut">Sin pendientes con otras personas.</p>'}</div></div>`;
  }
  ENLACES.panelIni = function (i) {
    if (!esProp(i)) return panelResumen(i);
    let h = panelIni0(i);
    h = h.replace('<div class="pn-a">', `<div class="pn-a"><button class="btn sm" data-act="ficha" data-id="${esc(i.id)}" title="Ver todo en una sola página">${icon('full', 14)}<span>Ficha</span></button>`);
    /* panel = RESUMEN: Ficha, Informe y 1 a 1. Todo lo que cambia datos (actualizar, editar, etapa, herramientas) vive en la ficha */
    try {
      const t = document.createElement('template'); t.innerHTML = h; const f = t.content, pa = f.querySelector('.pn-a');
      if (pa) {
        const bs = [...pa.querySelectorAll('button')], vis = [];
        bs.forEach(b => { const tx = b.textContent.trim(); b.classList.remove('sm'); if (/^Ficha/.test(tx)) { b.classList.add('pri', 'pn-main'); vis.unshift(b.outerHTML); } else if (/^(Informe|1 a 1)/.test(tx)) vis.push(b.outerHTML); });
        pa.innerHTML = vis.join('');
      }
      f.querySelectorAll('.pn-b .edit-only, .pn-b [data-act="new"], .pn-b [data-act="gfix"], .pn-b [data-act="cxapply"]').forEach(x => x.remove());
      f.querySelectorAll('.pn-b input[type="checkbox"], .pn-b select, .pn-b textarea').forEach(x => x.setAttribute('disabled', ''));
      f.querySelectorAll('.pn-b .composer').forEach(x => x.remove());
      f.querySelectorAll('.pn-b [data-act]').forEach(x => { if (['advance', 'basego', 'applyrag', 'edit', 'comment', 'etapa', 'wk', 'hitotoggle', 'noop'].includes(x.dataset.act)) x.remove(); });
      const fl = f.querySelector('.pn-b .flow'), fs = fl && fl.closest('.pn-sec');
      if (fs) {
        const lnk = fs.querySelector('.flow-l a'), dv = document.createElement('div'); dv.className = 'pn-sec pn-ph2';
        dv.innerHTML = `<div class="ph-top"><span class="lbl">Fase:</span>${faseTag(i)}<span class="ph-sp"></span>${lnk ? lnk.outerHTML : ''}</div>${fl.outerHTML}`; fs.replaceWith(dv);
      }
      h = [...f.childNodes].map(n => n.outerHTML || n.textContent || '').join('');
    } catch (e) { }
    h = h.replace('<p class="mut">Sin hitos.</p>', V.emptyRich({ ic: 'flag', title: 'Sin hitos todavía', line: 'Créalos desde la ficha, con la plantilla de Excel o a mano.' }, true));
    return h;
  };
  /* la ficha usa toda la página: no se «encajan» sus bloques en cajas con scroll */
  const fitMain0 = fitMain;
  ENLACES.fitMain = function () { if (UI.view === 'ficha') return; const r = fitMain0.apply(this, arguments); const m = document.getElementById('v22-mis'); if (m) m.classList.remove('fit'); return r; };

  /* ======================= Acción principal por pantalla ======================= */
  export const PRIM = {
    dashboard: { label: 'Crear propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, proyectos: { label: 'Nueva propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, portfolio: { label: 'Nueva propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, propuestas: { label: 'Crear propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' },
    hitos: { label: 'Nuevo hito', act: 'new', d: { t: 'hito' }, ic: 'flag' }, riesgos: { label: 'Nuevo riesgo', act: 'new', d: { t: 'risk' }, ic: 'shield' }, decisiones: { label: 'Nueva decisión', act: 'new', d: { t: 'dec' }, ic: 'gavel' },
    compromisos: { label: 'Nuevo compromiso', act: 'acunew', d: {}, ic: 'check' }, cambios: { label: 'Nueva solicitud', act: 'chgnew', d: {}, ic: 'refresh' }, comite: { label: 'Nuevo comité', act: 'new', d: { t: 'com' }, ic: 'users' }, calendario: { label: 'Nuevo evento', act: 'newevt', d: {}, ic: 'cal' }
  };
  export function primaria() {
    const ph = sr('#main .ph-act'); if (ph) {
      const P = PRIM[UI.view], pri = sra('.btn.pri', ph);
      if (sr('.v22-nuevo', ph)) { /* «Nuevo ▾» ya es la acción principal */ }
      else if (!P || UI.view === 'dashboard') pri.forEach(b => b.classList.remove('pri', 'v22-main'));
      else {
        pri.forEach(b => b.classList.remove('pri'));
        let b = sra('[data-act="' + P.act + '"]', ph).find(x => Object.entries(P.d).every(([k, v]) => x.dataset[k] === v));
        if (!b) { const h = document.createElement('span'); h.className = 'edit-only'; h.innerHTML = btn(P.label, P.act, { d: P.d, ic: P.ic }); ph.appendChild(h); b = h.firstElementChild; }
        b.classList.add('pri', 'v22-main');
      }
    }
    if (UI.view === 'ficha') { const pr = sra('#main .fl-head .btn.pri'); pr.slice(1).forEach(b => b.classList.remove('pri')); const m = pr[0] || sr('#main .fl-head [data-act="edit"]'); if (m) m.classList.add('pri', 'v22-main'); }
  }

  /* ======================= Ayuda contextual ======================= */
  const HELP = {
    _def: { lead: 'Usa el menú de la izquierda para elegir la sección y las pestañas de arriba para cambiar de vista. Lo que más se hace aquí está resaltado en azul.', tips: ['Con «/» buscas cualquier proyecto, riesgo o hito.', 'Arriba a la derecha cambias entre Simple y Profesional.', 'Al volver a una sección se abre la pestaña donde estabas.'] },
    dashboard: { lead: 'Aquí ves dónde estamos y qué hay que decidir. Parte por las tarjetas de arriba.', tips: ['Haz clic en un proyecto: su resumen se abre a la derecha.', '«Ficha completa» (en ese panel) muestra todo en una sola página.', 'Cambia el alcance con «Área» en el menú ⋯.'], dyn: () => { const n = navBadge('decisiones'); return n ? [n + ' decisión(es) pendiente(s)', 'decisiones'] : null; } },
    proyectos: { lead: 'Tablero de proyectos (sección Iniciativas). Abre uno para ver o actualizar su estado.', tips: ['Clic en una fila: resumen a la derecha. Doble clic: ficha completa.', 'La planificación se carga masivamente con «Cargar Excel».'] },
    propuestas: { lead: 'Demanda en evaluación. Cada propuesta pasa por compuertas antes de ser proyecto.', tips: ['Abre una propuesta para ver su caso de negocio.', 'Doble clic abre la ficha completa.'] },
    hitos: { lead: 'Fechas clave de los proyectos (sección Planificación). Marca como cumplidos los que ya pasaron.', tips: ['Si un hito se atrasa, registra la reprogramación en Control de cambios.', 'Carga muchos de una vez con «Cargar Excel».'], dyn: () => { const n = navBadge('hitos'); return n ? [n + ' hito(s) vencido(s)', 'hitos'] : null; } },
    riesgos: { lead: 'Lo que podría salir mal y cómo se está mitigando (sección Planificación).', tips: ['Ordena por exposición para ver primero lo crítico.', 'Cada riesgo debería tener dueño y plan de mitigación.'], dyn: () => { const n = navBadge('riesgos'); return n ? [n + ' riesgo(s) crítico(s)', 'riesgos'] : null; } },
    decisiones: { lead: 'Decisiones del comité y su estado.', tips: ['«Resolver» deja la decisión aplicada con fecha y responsable.'] },
    compromisos: { lead: 'Acuerdos de reuniones con responsable y fecha.', tips: ['Los vencidos aparecen primero.'], dyn: () => { const n = navBadge('compromisos'); return n ? [n + ' compromiso(s) vencido(s)', 'compromisos'] : null; } },
    cambios: { lead: 'Todo cambio de alcance, fecha o presupuesto queda registrado y aprobado.', tips: ['Solo el sponsor, el administrador o Administra pueden resolverlos.'] },
    comite: { lead: 'Arma la sesión: agenda, acuerdos y acta.', tips: ['Solo Administra o Responsable gestionan comités.'] },
    ficha: { lead: 'Toda la información de esta iniciativa en una sola página. Oculta con el ojito lo que no necesites.', tips: ['El ojito oculta una sección; la flecha solo la contrae.', 'En modo Simple parten abiertas las secciones esenciales; en Profesional, todas.', 'Con «Comentar» dejas una observación para tu área.'] }
  };
  function helpHTML() {
    const h = Object.assign({}, HELP._def, HELP[UI.view] || {}), P = PRIM[UI.view], dy = h.dyn && h.dyn();
    return `<div class="pop-h">Ayuda · ${esc(tituloVista(UI.view))}<small>Qué hacer en esta pantalla</small></div><div class="v22-hp"><p class="hp-lead">${esc(h.lead)}</p>
      ${dy ? `<div class="hp-dyn"><span>${icon('warn', 14)} <b>${esc(dy[0])}</b></span><button class="btn sm" data-act="go" data-v="${dy[1]}">Revisar</button></div>` : ''}
      ${P ? `<div class="hp-main edit-only">${btn(P.label, P.act, { d: P.d, ic: P.ic, cls: 'pri' })}</div>` : ''}
      <ul>${h.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
      <div class="hp-f">${GUIA[UI.view] ? `<button class="btn sm" data-act="guia" data-m="on">Cómo operar esta pantalla</button>` : ''}${UI.view === 'cielo' ? `<button class="btn sm" data-act="cielotab" data-k="how">Reglas del juego</button>` : ''}<button class="btn sm" data-act="tour">Ver recorrido</button><button class="btn sm" data-act="go" data-v="proposito">Para qué sirve</button></div></div>`;
  }
  function cmtPopHTML() {
    const n = notasAbiertas().length;
    return `<div class="pop-h">Comentarios por área<small>${n} pendiente(s) en las áreas que ves</small></div><div class="v22-hp"><p class="hp-lead">Deja una observación en cualquier parte de la página. La verá quien tenga acceso a esa área, y un administrador la marcará como abordada.</p>
      ${nIntSinVer() ? `<p class="hp-lead" style="margin-top:0"><b>${nIntSinVer()} nota(s) interna(s) sin ver</b> · <a href="#" data-act="notasint">Revisar</a></p>` : ''}<div class="hp-main">${btn('Dejar un comentario', 'notanew', { ic: 'comment', cls: 'pri' })}</div>
      <div class="hp-f">${btn('Elegir el lugar en pantalla', 'notapick', { ic: 'target', cls: 'sm' })}${btn('Ver comentarios (' + n + ')', 'notaslist', { ic: 'list', cls: 'sm' })}</div></div>`;
  }
  document.addEventListener('click', e => { if (e.target.closest('.v22-pop [data-act]') && !e.target.closest('[data-act="pop"]')) closePops(); }, true);

  /* versión propia del prototipo de arquitectura; fecha y commit los inyecta el despliegue en apih-config.js (en local: «desarrollo») */
  const BLD = window.APIH_BUILD || {}, VER = { v: BLD.v || 'A1.0', b: BLD.b || 'desarrollo', c: BLD.c || '' };
  V.version = VER;
 
  const renderChrome0 = renderChrome;
  ENLACES.renderChrome = function () {
    renderChrome0.apply(this, arguments);
    const vs = sr('.top .b-t.app small'); if (vs) { vs.textContent = VER.v + ' · ' + VER.b; vs.classList.add('v22-ver'); vs.title = 'APIH ' + VER.v + ' · ' + (VER.c ? 'commit ' + VER.c + ' · ' : '') + VER.b; }
    const tr = sr('.top-r');
    if (tr && !sr('#v22-help')) tr.insertAdjacentHTML('afterbegin', `<div class="popw"><button class="btn sm v22-help" id="v22-help" data-act="pop" data-id="pop-help" aria-label="Ayuda de esta pantalla">${icon('help', 16)}<span>Ayuda</span></button><div class="pop wide v22-pop" id="pop-help" style="right:0"></div></div>
      <div class="popw"><button class="icon-btn bell" id="v22-cmt" data-act="pop" data-id="pop-cmt" aria-label="Comentarios por área" title="Comentarios por área">${icon('comment', 18)}<b id="v22-cmtN"></b></button><div class="pop wide v22-pop" id="pop-cmt" style="right:0"></div></div>`);
    if (tr && !sr('#v22-seg')) tr.insertAdjacentHTML('afterbegin', `<span class="seg v22-seg" id="v22-seg" role="group" aria-label="Nivel de detalle de la interfaz" title="Simple: lo esencial · Profesional: todo el detalle"></span>`);
    const sg = sr('#v22-seg'); if (sg) sg.innerHTML = ['simple', 'pro'].map(m => `<button class="${modoUI() === m ? 'on' : ''}" data-act="modo" data-m="${m}" aria-pressed="${modoUI() === m}">${m === 'simple' ? 'Simple' : 'Profesional'}</button>`).join('');
    const ph = sr('#pop-help'); if (ph) ph.innerHTML = helpHTML();
    const pc = sr('#pop-cmt'); if (pc) pc.innerHTML = cmtPopHTML();
    const nb = sr('#v22-cmtN'); if (nb) { const n = notasAbiertas().length; nb.textContent = n > 99 ? '99+' : n || ''; nb.style.display = n ? '' : 'none'; }
    const fn = sr('#side a[data-v="ficha"]'); if (fn) fn.remove();
    const u0 = sr('.top-r .usr');
    if (u0 && !u0.classList.contains('v22-usrw') && AuthService.provider !== 'none' && AuthService.user()) {
      const nm = St.cfg.usuario, em = AuthService.user().email;
      u0.outerHTML = `<div class="popw v22-usrw"><button class="v22-usr" data-act="pop" data-id="pop-usr" aria-haspopup="menu" aria-label="Mi cuenta">${avatar(nm, 30)}<span><b>${esc(nm)}</b><small>${esc((St.cfg.cargo || '').split('·')[0])}</small></span><span class="chv">${icon('chevd', 13)}</span></button>
        <div class="pop v22-pop usr-m" id="pop-usr" style="right:0"><div class="pop-h"><b>${esc(nm)}</b><small>${esc(em)}</small></div>${(Sesion.menuExtra && Sesion.menuExtra()) || ''}<button data-act="sbout">${icon('user', 15)} Cerrar sesión</button></div></div>`;
    }
    if (UI.view === 'ficha') $('#app').classList.toggle('nopanel', !UI.panel || !UI.sel);
  };

  /* ======================= V22.35 · Menú por rol con pestañas ======================= */
  export const MENU = [
    { k: 'inicio', t: 'Inicio', ic: 'dashboard', vs: [['dashboard', 'Dashboard'], ['cielo', 'Mi cocina']] },
    { k: 'iniciativas', t: 'Iniciativas', ic: 'list', vs: [['portfolio', 'Tabla'], ['proyectos', 'Tablero']] },
    { k: 'planificacion', t: 'Planificación', ic: 'gantt', vs: [['gantt', 'Gantt'], ['fases', 'Fases'], ['roadmap', 'Roadmap'], ['calendario', 'Calendario'], ['hitos', 'Hitos'], ['capacidad', 'Capacidad'], ['riesgos', 'Riesgos']] },
    { k: 'gobierno', t: 'Gobierno', ic: 'gavel', vs: [['propuestas', 'Pipeline de propuestas'], ['comite', 'Comité'], ['decisiones', 'Decisiones'], ['compromisos', 'Compromisos'], ['cambios', 'Cambios']] },
    { k: 'pendientes', t: 'Mis pendientes', ic: 'check', vs: [['decisiones', 'Decisiones'], ['compromisos', 'Compromisos']] },
    { k: 'presentaciones', t: 'Presentaciones', ic: 'slides', vs: [['presentaciones', 'Presentaciones']] },
    { k: 'personas', t: 'Personas', ic: 'person', vs: [['personas', 'Personas']] },
    { k: 'admin', t: 'Administración', ic: 'settings', vs: [['admin', 'Parámetros'], ['bitacora', 'Bitácora'], ['miconfig', 'Mi configuración'], ['analisis', 'Análisis']] },
    { k: 'ayuda', t: 'Ayuda', ic: 'help', vs: [['proposito', 'Para qué sirve']] }
  ];
