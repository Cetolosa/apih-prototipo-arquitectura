import { ENLACES } from './00-registro.js';
import { $, fasesDe, gates, isDone, rel, ACUERDOS, APIH_CONFIG, CAMBIOS, DECS, DEC_C, FL, IC, MESES, MONEDAS, St, _audSt, audParse, audSnap, avatar, by, byId, desv, diasSinUpd, diffD, esAdmin, esProp, esc, expo, fmtD, fmtDL, fmtMon, fmtN, fmtTS, forecast, hitoEstado, hitosDe, hoy, icon, log, miUsuario, monOf, nivelRiesgo, pD, pad, ppInval, riesgoAbierto, riesgosDe, save } from './01-nucleo.js';
import { AuthService, SB, SBLogin } from './02-datos.js';
import { estPill, pnHead, ragPill, Acts, Chg, F, Modal, NAV, UI, Views, banner, btn, closePops, confirmBox, copyText, fasePill, fitMain, go, navBadge, openForm, panelIni, refresh, render, renderChrome, selOpts, selectEntity, syncPop, toast } from './03-interfaz.js';
import { faseTag, pasosDe, planFichaHTML, senalesIni, subfasesDe } from './05-vistas.js';
import { ADM_TABS, cut } from './06-administracion.js';
import { NIV, NO_PERM, actSemana, areaVisible, areasDe, areasPermitidas, areasPropias, cfgI, cieloOn, cieloPersona, cocFit, esAdministra, hoyW, insignias, modoUI, proyActivos, puedeEditarIni, puedeGobernar, puedeVerAnalisis, rolActual, soloLectura, starsOf, starsRow, vencidosA } from './07-gobierno.js';
import { GUIA, presLayout } from './09-presentaciones.js';
(function () {
  const V = window.V22 = {};
  const sr = (s, p = document) => p.querySelector(s), sra = (s, p = document) => [...p.querySelectorAll(s)];
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
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
  const esMia = n => (n.correo && n.correo === emailYo()) || n.autor === miUsuario();
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
    n.estado = 'Abordado'; n.por = miUsuario(); n.fAb = hoy(); save(); toast('Comentario abordado: ya no se muestra'); if (sr('#v22-nbody')) notasRefresh(); else render();
  };
  Acts.notareab = d => {
    if (!puedeGobernar()) return NO_PERM('Solo Administra o Responsable pueden reabrir un comentario');
    const n = (St.notas || []).find(x => x.id === d.id); if (!n) return;
    n.estado = 'Abierto'; n.por = ''; n.fAb = null; save(); notasRefresh();
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
    const c = (Modal.cur && Modal.cur.v22) || {}, ini = ctxIni(), hh = new Date().toTimeString().slice(0, 5);
    const n = { id: 'NOT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), ini: ini || (c.rid && byId(c.rid) ? c.rid : null), area: ar || 'Transversal', tipo: '', vista: UI.view, ref: c.ref || '', texto: tx.trim(), autor: miUsuario(), correo: emailYo(), ts: hoy() + 'T' + hh, estado: 'Abierto', por: '', fAb: null };
    St.notas = St.notas || []; St.notas.unshift(n); save(); Modal.close(); toast('Comentario publicado'); render();
  };

  /* ======================= Ficha larga ======================= */
  const panelIni0 = panelIni;
  function parsePanel(i, tab) {
    const keep = UI.tab; UI.tab = tab; let h = ''; try { h = panelIni0(i); } finally { UI.tab = keep; }
    const t = document.createElement('template'); t.innerHTML = h; const f = t.content;
    const kx = f.querySelector('.pn-k'); if (kx) kx.querySelectorAll('button').forEach(b => b.remove());
    return { kicker: kx ? kx.innerHTML : '', title: (f.querySelector('.pn-h h3') || {}).innerHTML || '', pills: (f.querySelector('.pn-p') || {}).innerHTML || '', acts: (f.querySelector('.pn-a') || {}).innerHTML || '', body: f.querySelector('.pn-b') };
  }
  const SECS = [
    ['res', 'Resumen', 'list', true], ['pla', 'Planificación', 'gantt', true], ['cif', 'Cifras, fechas y responsables', 'money'], ['sal', 'Salud y recomendación', 'target'], ['dep', 'Dependencias', 'link'], ['log', 'Logros y próximos pasos', 'check'], ['cal', 'Calidad de datos', 'shield'],
    ['hit', 'Hitos', 'flag', true], ['rie', 'Riesgos', 'shield'], ['dec', 'Decisiones', 'gavel'], ['com', 'Compromisos', 'users'], ['cam', 'Control de cambios', 'refresh', false, 'prj'], ['act', 'Historial', 'book', true], ['alertas', 'Alertas', 'spark'], ['doc', 'Documentación', 'book'], ['int', 'Notas internas del PMO', 'lock', true], ['nota', 'Comentarios del área', 'comment', true]
  ];
  const SIMPLE_OPEN = ['res', 'cif', 'hit', 'rie', 'doc', 'int'];
  const fh = () => (UI.fh = UI.fh || (() => { try { return JSON.parse(lsGet('apih_fh') || '{}'); } catch (e) { return {}; } })());
  const fhSave = () => lsSet('apih_fh', JSON.stringify(fh()));
  const fOculta = k => !!(fh()[k] && fh()[k].h);
  const fAbierta = k => { const s = fh()[k]; if (s && s.c != null) return !s.c; return modoUI() === 'pro' || SIMPLE_OPEN.includes(k); };
  function grupoResumen(el) {
    const h = ((el.querySelector && el.querySelector('h4')) || {}).textContent || '';
    if (/Salud|Recomendaci/i.test(h)) return 'sal'; if (/Dependencias|Habilita/i.test(h)) return 'dep'; if (/Logros|Pr[oó]ximos/i.test(h)) return 'log'; if (/Calidad/i.test(h)) return 'cal';
    if (el.querySelector && el.querySelector('.kvs') && !h) return 'cif'; return 'res';
  }
  const secAct = (k, i) => {
    const e = (b) => `<span class="edit-only">${b}</span>`;
    if (k === 'hit') return e(btn('Nuevo hito', 'new', { d: { t: 'hito', ini: i.id }, ic: 'plus', cls: 'sm' }) + btn('Cargar Excel', 'cargaxl', { ic: 'up', cls: 'sm' }));
    if (k === 'rie') return e(btn('Nuevo riesgo', 'new', { d: { t: 'risk', ini: i.id }, ic: 'plus', cls: 'sm' }));
    if (k === 'dec') return e(btn('Nueva decisión', 'new', { d: { t: 'dec', ini: i.id }, ic: 'plus', cls: 'sm' }));
    if (k === 'com') return e(btn('Nuevo compromiso', 'acunew', { d: { id: i.id }, ic: 'plus', cls: 'sm' }));
    if (k === 'cam') return e(btn('Nueva solicitud', 'chgnew', { d: { id: i.id }, ic: 'plus', cls: 'sm' }));
    if (k === 'doc') return !docPuedeAgregar(i) ? '' : e(btn('Agregar documento', 'docnew', { d: { id: i.id }, ic: 'plus', cls: 'sm' }));
    if (k === 'nota') return btn('Comentar', 'notanew', { ic: 'comment', cls: 'sm' });
    return '';
  };
  function secHitos(i) {
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
  function secRiesgos(i) {
    const rall = riesgosDe(i.id).sort(by(r => -expo(r))), fr = (UI.fcat || {}).r || '', rs = fr ? rall.filter(r => (r.cat || '—') === fr) : rall;
    if (!rall.length) return [0, V.emptyRich({ ic: 'shield', title: 'Sin riesgos registrados', line: 'Registrar un riesgo a tiempo es más barato que explicarlo después.', p: ['Registrar riesgo', 'new', { t: 'risk', ini: i.id }, 'shield'] })];
    return [rall.length, catChips('r', rall.map(r => r.cat || '—')) + (rs.map(r => { const n = nivelRiesgo(expo(r)); return `<button class="al" data-act="sel" data-t="risk" data-id="${r.id}"><span class="expo" style="background:${n.c}">${expo(r)}</span><span><b>${esc(r.desc)}</b><small>${esc(r.cat || 'Sin categoría')} · ${r.estado} · ${esc(r.dueno || 'sin dueño')}</small></span></button>`; }).join('') || '<p class="mut">Sin riesgos en esta categoría.</p>')];
  }
  function secDec(i) {
    const ds = DECS().filter(d => d.ini === i.id);
    if (!ds.length) return [0, V.emptyRich({ ic: 'gavel', title: 'Sin decisiones asociadas', line: 'Aquí quedan las decisiones del comité sobre esta iniciativa, con responsable y fecha.', p: ['Registrar decisión', 'new', { t: 'dec', ini: i.id }, 'gavel'] })];
    return [ds.length, ds.map(d => `<button class="al" data-act="sel" data-t="dec" data-id="${d.id}"><span class="pill" style="--c:${DEC_C[d.tipo]}">${esc(d.tipo)}</span><span><b>${esc(d.titulo)}</b><small>${esc(d.estado)} · límite ${fmtD(d.limite)}</small></span></button>`).join('')];
  }
  function secCom(i) {
    const cs = ACUERDOS().filter(c => c.ini === i.id);
    if (!cs.length) return [0, V.emptyRich({ ic: 'users', title: 'Sin compromisos', line: 'Los acuerdos de reuniones quedan aquí con responsable y fecha.', p: ['Crear compromiso', 'acunew', { id: i.id }, 'check'] })];
    return [cs.length, cs.map(c => `<div class="hrow"><div><b>${esc(c.texto)}</b><small>${esc(c.estado)} · ${esc(c.resp || 'sin responsable')} · límite ${fmtD(c.limite)}</small></div></div>`).join('')];
  }
  function secCam(i) {
    const cs = CAMBIOS().filter(c => c.ini === i.id);
    if (!cs.length) return [0, V.emptyRich({ ic: 'refresh', title: 'Sin cambios solicitados', line: 'Todo cambio de alcance, fecha o presupuesto queda registrado con quién lo aprobó.', p: ['Solicitar cambio', 'chgnew', { id: i.id }, 'refresh'] })];
    return [cs.length, cs.map(c => `<div class="hrow"><div><b>${esc(c.tipo)} · ${esc(c.desc || c.id)}</b><small>${esc(c.estado)} · ${esc(c.solicita || '')} · ${fmtD(c.creada)}</small></div></div>`).join('')];
  }
  UI.fi = UI.fi || { solo: false, inc: false };
  const intTodas = () => (St.notas || []).filter(n => n.tipo === 'interna' && n.ini && byId(n.ini));
  const intNoVistas = id => intTodas().filter(n => !n.visto && (!id || n.ini === id)).sort((a, b) => (a.ts > b.ts ? 1 : -1));
  const nIntSinVer = () => puedeGobernar() ? intNoVistas().length : 0;
  V.nIntSinVer = nIntSinVer;
  const marcar = (n, v) => { n.visto = v ? 'Si' : ''; n.vistoPor = v ? miUsuario() : ''; n.fVisto = v ? hoy() : null; };
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
  function secInt(i) {
    const g = puedeGobernar(), all = internas(i.id), nv = intNoVistas(i.id).length, L = g && UI.fi.solo ? all.filter(n => !n.visto) : all;
    const ed = !g ? '' : `<div class="v22-f"><textarea id="v22-int" data-key="intxt" placeholder="Nota interna del PMO: contexto, acuerdos, alertas… (la ven todos los que acceden a esta iniciativa; solo el PMO escribe)"></textarea><div style="margin-top:6px"><button class="btn pri sm" data-act="intadd" data-id="${esc(i.id)}">${icon('plus', 13)}<span>Guardar nota</span></button></div></div>`;
    const lst = L.length ? `<div class="v22-nl" style="margin-top:10px;max-height:none">${L.map(n => intItem(n, false)).join('')}</div>` : `<p class="mut" style="margin:10px 0 0">${all.length ? 'No hay notas sin ver en esta iniciativa.' : (g ? 'Aún no hay notas. Lo que escribas queda guardado aquí, en orden, como historial interno de esta iniciativa.' : 'El PMO aún no ha dejado notas.')}</p>`;
    return [all.length, ed + (g && all.length ? intBar(i.id, nv) : '') + lst];
  }
  function intRefrescar() { render(); const b = sr('#v22-nbody'); if (b) b.innerHTML = notasListBody(); }
  Chg.intsolo = el => { UI.fi.solo = el.checked; intRefrescar(); };
  Chg.intinc = el => { UI.fi.inc = el.checked; intRefrescar(); };
  Acts.intvisto = d => { const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar()) return NO_PERM('Las notas internas son del PMO'); marcar(n, d.v === '1'); save(); intRefrescar(); };
  Acts.intvistoall = d => {
    if (!puedeGobernar()) return NO_PERM('Las notas internas son del PMO');
    const L = intNoVistas(d.id === '*' ? null : d.id); if (!L.length) return;
    L.forEach(n => marcar(n, true)); save(); toast(L.length + ' nota(s) marcada(s) como vistas'); intRefrescar();
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
    const i = byId(d.id); if (!i) return; const hh = new Date().toTimeString().slice(0, 5);
    St.notas = St.notas || []; St.notas.unshift({ id: 'NOT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), ini: i.id, tipo: 'interna', area: i.area, vista: 'ficha', ref: '', texto: tx, autor: miUsuario(), correo: emailYo(), ts: hoy() + 'T' + hh, estado: 'Abierto', por: '', fAb: null, visto: '', vistoPor: '', fVisto: null });
    save(); toast('Nota interna guardada'); render();
  };
  Acts.intdel = d => {
    const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar() || !(esMia(n) || esAdmin())) return NO_PERM('Solo quien la escribió o el administrador puede eliminarla');
    confirmBox('¿Eliminar esta nota interna?', () => { St.notas = St.notas.filter(x => x.id !== n.id); save(); toast('Nota eliminada'); render(); }, 'Eliminar', true);
  };
  Acts.intedit = d => {
    const n = (St.notas || []).find(x => x.id === d.id); if (!n || !puedeGobernar() || !(esMia(n) || esAdmin())) return NO_PERM('Solo quien la escribió o el administrador puede editarla');
    Modal.open({ title: 'Editar nota interna', body: `<div class="v22-f"><textarea id="v22-intx">${esc(n.texto)}</textarea></div>`, footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="intsave" data-id="${esc(n.id)}">Guardar</button>` });
  };
  Acts.intsave = d => { const n = (St.notas || []).find(x => x.id === d.id), t = (sr('#v22-intx') || {}).value; if (!n || !t || !t.trim()) return toast('La nota no puede quedar vacía', 'err'); n.texto = t.trim(); n.edit = true; marcar(n, false); save(); Modal.close(); render(); };
  function secNota(i) {
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
  function histHTML(i) {
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
  function fichaHTML(i) {
    const PR = esProp(i), R = parsePanel(i, 'resumen'), G = {};
    [...R.body.children].forEach(el => { const k = grupoResumen(el); (G[k] = G[k] || []).push(el.outerHTML); });
    const sec = {};
    ['res', 'cif', 'sal', 'dep', 'log', 'cal'].forEach(k => { if (G[k]) sec[k] = [null, G[k].join('')]; });
    sec.pla = [pasosDe(i).length || null, planFichaHTML(i)];
    sec.hit = secHitos(i);
    sec.rie = secRiesgos(i); sec.dec = secDec(i); sec.com = secCom(i); if (!PR) sec.cam = secCam(i);
    sec.act = [St.bitacora.filter(x => x.ini === i.id).length, histHTML(i)];
    if (APIH_CONFIG.analisis !== false) sec.alertas = [null, parsePanel(i, 'alertas').body.innerHTML];
    sec.doc = secDoc(i);
    sec.int = secInt(i);
    sec.nota = secNota(i);
    const lista = SECS.filter(s => sec[s[0]] && (!s[4] || (s[4] === 'prj' && !PR)));
    /* encabezado compacto: una fila de identidad + acciones, y debajo la barra de secciones */
    const tpl = h => { const t = document.createElement('template'); t.innerHTML = h; return t.content; };
    const pf = tpl(R.pills); pf.querySelectorAll('.pill.tp,.pill.soft').forEach(x => x.remove());
    const af = tpl(R.acts), main = [], seg = [], more = [];
    af.querySelectorAll('button').forEach(b => { const t = b.textContent.trim(); b.classList.remove('sm'); b.setAttribute('title', t); if (/^(Actualizar|Cambiar etapa|Aprobar)/.test(t)) main.push(b.outerHTML.replace('class="btn', 'class="btn')); else if (/^(Reporte|1 a 1|Informe|Editar|Gantt|Presentar)/.test(t)) seg.push(b.outerHTML); else more.push(b.outerHTML); });
    const kick = R.kicker.replace(/\s*<button[\s\S]*?<\/button>/g, '');
    const acts = `<div class="fl2-a">${main.join('')}${seg.join('')}${more.length ? `<div class="popw"><button class="btn" data-act="pop" data-id="pop-flmore" aria-label="Más acciones" title="Fase, estado y más">${icon('dots', 16)}<span>Más</span></button><div class="pop" id="pop-flmore" style="right:0">${more.join('')}</div></div>` : ''}</div>`;
    const PRIM = ['res', 'pla', 'cif', 'sal', 'log', 'hit', 'rie'], prim = lista.filter(x => PRIM.includes(x[0])), rest = lista.filter(x => !PRIM.includes(x[0]));
    const act0 = UI.flTab && lista.some(x => x[0] === UI.flTab) ? UI.flTab : (prim[0] || lista[0] || [])[0];
    const tab = x => `<button class="fl2-tab ${x[0] === act0 ? 'on' : ''} ${fOculta(x[0]) ? 'off' : ''}" data-act="fltab" data-k="${x[0]}" title="${esc(x[1])}" ${x[0] === act0 ? 'aria-current="true"' : ''}>${esc(({ cif: 'Cifras', sal: 'Salud', log: 'Logros' })[x[0]] || x[1])}</button>`;
    let phX = '', phLab = '';
    const mkHead = () => { if (phLab) [...pf.querySelectorAll('.pill')].forEach(x => { if (x.textContent.trim() === phLab) x.remove(); }); return `<div class="fl2"><div class="fl2-top"><button class="btn" data-act="flback">${icon('chevl', 13)}<span>Volver</span></button><span class="fl2-k">${kick}</span><div class="fl2-p">${pf.firstElementChild ? [...pf.childNodes].map(n => n.outerHTML || n.textContent).join('') : ''}</div><span class="fl2-sp"></span>${acts}</div><div class="fl2-t2"><h1>${R.title}</h1><span class="fl2-sp"></span>${phX}</div>`; };
    const bar = `<div class="fl2-bar" role="toolbar" aria-label="Secciones de la ficha"><span class="fl2-l">Secciones:</span>${prim.map(tab).join('')}${rest.length ? `<div class="popw"><button class="fl2-tab ${rest.some(x => x[0] === act0) ? 'on' : ''}" data-act="pop" data-id="pop-flsec">${rest.some(x => x[0] === act0) ? esc(rest.find(x => x[0] === act0)[1]) + ' ▾' : 'Más (' + rest.length + ') ▾'}</button><div class="pop" id="pop-flsec">${rest.map(x => `<button data-act="fltab" data-k="${x[0]}" class="${fOculta(x[0]) ? 'off' : ''}">${icon(x[2], 15)} ${esc(x[1])}${fOculta(x[0]) ? ' <small>(oculta)</small>' : ''}</button>`).join('')}</div></div>` : ''}<span class="fl2-sp"></span><button class="fl2-lk" data-act="flall" data-m="open">Expandir todo</button><span aria-hidden="true">·</span><button class="fl2-lk" data-act="flall" data-m="close">Contraer todo</button></div></div>`;
    const grid = lista.map(([k, t, ic, wide]) => {
      const [n, html0] = sec[k], ab = fAbierta(k), oc = fOculta(k); let html = html0, hx = '', fx = '';
      if (k === 'res') {   /* fase actual en la cabecera y «incluir en presentación» en el pie */
        const f = tpl(html0), fl = f.querySelector('.flow'), fs = fl && fl.closest('.pn-sec');
        if (fs) { const lab = fs.querySelector('.flow-l span'), lnk = fs.querySelector('.flow-l a'), pl = lab && [...pf.querySelectorAll('.pill')].find(x => x.textContent.trim() === lab.textContent.trim()); phLab = lab ? lab.textContent.trim() : ''; phX = `<div class="fl-ph"><span class="fl-phl">Fase actual:</span>${pl ? pl.outerHTML : lab ? `<b>${lab.innerHTML}</b>` : ''}${i && i.fase ? faseTag(i).replace(fasePill(i.fase), '') : ''}${fl.outerHTML}${lnk ? lnk.outerHTML.replace(/>([^<]*)<\/a>/, (m, tx) => '><span class="lk-l">' + tx + '</span><span class="lk-s">Avanzar →</span></a>') : ''}</div>`; fs.remove(); }
        const ib = f.querySelector('.incbox'); if (ib) { fx = `<footer class="fl-ft">${ib.innerHTML}</footer>`; ib.remove(); }
        html = [...f.children].map(e => e.outerHTML).join('');
      }
      return `<section class="fl-s ${wide ? 'wide' : ''} ${ab ? '' : 'col'} ${oc ? 'fl-hid' : ''}" data-k="${k}" id="fl-${k}"><header class="fl-h"><button class="fl-t" data-act="flcol" data-k="${k}" aria-expanded="${ab}"><span class="chv">${icon('chevd', 14)}</span>${icon(ic, 16)}<span>${esc(t)}</span>${n != null ? `<em>${n}</em>` : ''}</button>${hx}<span class="fl-sa">${secAct(k, i)}</span><button class="icon-btn sm" data-act="fleye" data-k="${k}" title="Ocultar esta sección" aria-label="Ocultar ${esc(t)}">${icon('eye', 15)}</button></header><div class="fl-b">${html}</div>${fx}</section>`;
    }).join('');
    return mkHead() + bar + `<div class="fl-grid">${grid}</div>`;
  }
  Views.ficha = {
    render() {
      const i = UI.fichaId && byId(UI.fichaId);
      if (!i) return V.emptyRich({ ic: 'list', title: 'Elige una iniciativa para ver su ficha', line: 'La ficha reúne todo de un proyecto o propuesta en una sola página.', p: ['Ir a Proyectos', 'go', { v: 'proyectos' }, 'list'], s: ['Ir a Propuestas', 'go', { v: 'propuestas' }, 'bulb'] }).replace('em-a edit-only', 'em-a');
      if (!areaVisible(i.area)) return V.emptyRich({ ic: 'lock', title: 'Esta iniciativa es de otra área', line: 'Tu rol no tiene acceso al área ' + areasDe(i.area).join(', ') + '.', p: ['Volver', 'flback', {}, 'chevl'] }).replace('em-a edit-only', 'em-a');
      return fichaHTML(i);
    }
  };
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
    const g = to ? gates(i, to) : [], gok = g.filter(x => x.ok).length, falta = g.filter(x => !x.ok).map(x => x.t);
    const dec = St.decisiones.filter(d => d.ini === i.id && d.estado === 'Pendiente').map(d => ({ o: d.limite || '9', h: `<div><b>Decisión</b> «${esc(d.titulo)}» · ${d.limite && d.limite < H ? '<span class="bad-t">vencida hace ' + diffD(H, d.limite) + ' d</span>' : d.limite ? 'vence ' + rel(d.limite) : 'sin fecha límite'}${d.area ? ' · ' + esc(d.area) : ''}</div>` }));
    const cmp = (St.compromisos || []).filter(c => c.ini === i.id && c.estado === 'Abierto').map(c => ({ o: c.limite || '9', h: `<div><b>${c.limite && c.limite < H ? '<span class="bad-t">Compromiso vencido</span>' : 'Compromiso'}</b> «${esc(c.texto)}»${c.resp ? ' · ' + esc(c.resp) : ''}${c.limite && c.limite < H ? ' · hace ' + diffD(H, c.limite) + ' d' : c.limite ? ' · ' + rel(c.limite) : ''}</div>` }));
    const dep = (i.deps || []).map(id => byId(id)).filter(Boolean).map(x => ({ o: '99', h: `<div><b>Depende de</b> ${esc(x.id)} ${esc(x.titulo)} · ${esc(x.estado)}${x.tipo === 'Proyecto' ? ', ' + Math.round(+x.avance || 0) + ' %' : ''}</div>` }));
    const pend = [...dec, ...cmp, ...dep].sort((a, b) => String(a.o).localeCompare(String(b.o))).slice(0, 6);
    const ult = i.actualizada ? diffD(H, i.actualizada) : null;
    const head = pnHead(`Proyecto ${esc(i.id)} · ${esc(i.area)}`, esc(i.titulo), `${ragPill(i.rag)} ${faseTag(i)} ${i.estado !== 'En curso' ? estPill(i.estado) : ''}`,
      `<button class="btn pri pn-main" data-act="ficha" data-id="${esc(i.id)}" title="Ver y editar todo en una sola página">${icon('full', 14)}<span>Abrir ficha</span></button>`);
    const sub = ult == null ? '' : `<p class="mut pn-upd">Actualizado ${ult === 0 ? 'hoy' : 'hace ' + ult + (ult === 1 ? ' día' : ' días')}${i.lider ? ' · ' + esc(i.lider) : ''}</p>`;
    return head + `<div class="pn-b">${sub}
      <div class="pn-sec"><h4>1 · Por qué está en ${esc(i.rag)}</h4><div class="pn-sig">${sen.map(x => `<div class="sg ${x.bad ? 'bad' : 'ok'}"><span class="tg">${x.bad ? 'Atención' : 'En orden'}</span><span><b>${esc(x.t)}</b> ${esc(x.d)}</span></div>`).join('')}</div></div>
      <div class="pn-sec"><h4>2 · Qué sigue</h4>${hs.length ? `<div class="pn-nx">${hs.map(h => `<div><span class="d">${fmtD(h.fecha)}</span><b>${esc(h.nombre)}</b><span class="r">${esc(h.resp || '')}</span></div>`).join('')}</div>` : '<p class="mut">Sin hitos pendientes.</p>'}
        ${to ? `<div class="pn-gt"><b>Para ${sig ? 'pasar a ' + esc(sig) : 'completar el proyecto'}: ${gok} de ${g.length} compuertas</b><div class="bar"><i style="width:${g.length ? Math.round(gok / g.length * 100) : 100}%"></i></div>${falta.length ? `<div>Faltan: ${falta.map(esc).join(' · ')}.</div>` : '<div>Cumple todas las compuertas.</div>'}</div>` : ''}</div>
      <div class="pn-sec"><h4>3 · Pendientes con otras personas</h4>${pend.length ? `<div class="pn-pd">${pend.map(x => x.h).join('')}</div>` : '<p class="mut">Sin pendientes con otras personas.</p>'}</div>
      <p class="mut pn-note">Para cambiar algo, informes y herramientas: abre la ficha.</p></div>`;
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
  const PRIM = {
    dashboard: { label: 'Crear propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, proyectos: { label: 'Nueva propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, portfolio: { label: 'Nueva propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' }, propuestas: { label: 'Crear propuesta', act: 'new', d: { t: 'prop' }, ic: 'bulb' },
    hitos: { label: 'Nuevo hito', act: 'new', d: { t: 'hito' }, ic: 'flag' }, riesgos: { label: 'Nuevo riesgo', act: 'new', d: { t: 'risk' }, ic: 'shield' }, decisiones: { label: 'Nueva decisión', act: 'new', d: { t: 'dec' }, ic: 'gavel' },
    compromisos: { label: 'Nuevo compromiso', act: 'acunew', d: {}, ic: 'check' }, cambios: { label: 'Nueva solicitud', act: 'chgnew', d: {}, ic: 'refresh' }, comite: { label: 'Nuevo comité', act: 'new', d: { t: 'com' }, ic: 'users' }, calendario: { label: 'Nuevo evento', act: 'newevt', d: {}, ic: 'cal' }
  };
  function primaria() {
    const ph = sr('#main .ph-act'); if (ph) {
      const P = PRIM[UI.view], pri = sra('.btn.pri', ph);
      if (!P || UI.view === 'dashboard') pri.forEach(b => b.classList.remove('pri', 'v22-main'));
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
    if (u0 && !u0.classList.contains('v22-usrw') && AuthService.provider === 'supabase' && AuthService.user()) {
      const nm = St.cfg.usuario, em = AuthService.user().email;
      u0.outerHTML = `<div class="popw v22-usrw"><button class="v22-usr" data-act="pop" data-id="pop-usr" aria-haspopup="menu" aria-label="Mi cuenta">${avatar(nm, 30)}<span><b>${esc(nm)}</b><small>${esc((St.cfg.cargo || '').split('·')[0])}</small></span><span class="chv">${icon('chevd', 13)}</span></button>
        <div class="pop v22-pop usr-m" id="pop-usr" style="right:0"><div class="pop-h"><b>${esc(nm)}</b><small>${esc(em)}</small></div><button data-act="pwchange">${icon('lock', 15)} Cambiar mi contraseña</button><button data-act="sbout">${icon('user', 15)} Cerrar sesión</button></div></div>`;
    }
    if (UI.view === 'ficha') $('#app').classList.toggle('nopanel', !UI.panel || !UI.sel);
  };

  /* ======================= V22.35 · Menú por rol con pestañas ======================= */
  const MENU = [
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
  const MENU_ROL = {
    Administra: ['inicio', 'iniciativas', 'planificacion', 'gobierno', 'presentaciones', 'personas', 'admin'],
    Responsable: ['inicio', 'iniciativas', 'planificacion', 'gobierno', 'presentaciones', 'admin'],
    Colaborador: ['inicio', 'iniciativas', 'planificacion', 'pendientes', 'presentaciones'],
    Invitado: ['inicio', 'iniciativas', 'planificacion']
  };
  V.MENU = MENU; V.MENU_ROL = MENU_ROL;
  const menuKeys = () => { const r = rolActual(), c = St.cfg && St.cfg.menuRol && St.cfg.menuRol[r]; return (Array.isArray(c) && c.length ? c : MENU_ROL[r] || MENU_ROL.Invitado); };
  const viewOk = v => v === 'admin' ? esAdmin() : v === 'analisis' ? puedeVerAnalisis() : v === 'cielo' ? cieloOn() : v === 'personas' ? esAdministra() : v === 'capacidad' ? puedeGobernar() : true;
  const menuGroups = () => { const ks = menuKeys(); return MENU.filter(g => ks.includes(g.k)).map(g => Object.assign({}, g, { vs: g.vs.filter(x => viewOk(x[0])) })).filter(g => g.vs.length); };
  const grupoDe = (v, gs) => { if (v === 'ficha') v = 'portfolio'; return gs.find(g => g.vs.some(x => x[0] === v)); };
  const lastTabs = (() => { try { return JSON.parse(lsGet('apih_tabs') || '{}'); } catch (e) { return {}; } })();
  const menuBadge = g => g.vs.reduce((a, x) => a + (+navBadge(x[0]) || 0), 0);
  UI.rail = lsGet('apih_rail') === '1';
  Acts.rail = () => { UI.rail = !UI.rail; lsSet('apih_rail', UI.rail ? '1' : '0'); const sd = $('#side'); if (UI.rail && sd) sd.classList.add('nohov'); renderChrome(); const b = sr('#side .rail-t'); if (b) b.focus(); };
  document.addEventListener('mousemove', e => { const sd = $('#side'); if (sd && sd.classList.contains('nohov') && !(e.target.closest && e.target.closest('#side'))) sd.classList.remove('nohov'); });   /* tras contraer, no se re-expande hasta que el mouse salga del menú */
  const side0 = renderChrome;
  ENLACES.renderChrome = function () {
    side0.apply(this, arguments);
    const sd = sr('#side'); if (!sd) return;
    const gs = menuGroups(), cur = grupoDe(UI.view, gs); if (cur) { lastTabs[cur.k] = UI.view === 'ficha' ? lastTabs[cur.k] : UI.view; }
    const foot = sr('.side-f', sd), fh = foot ? foot.outerHTML : '';
    sd.innerHTML = `<button class="nav rail-t" data-act="rail" aria-pressed="${!!UI.rail}" title="${UI.rail ? 'Fijar el menú expandido' : 'Contraer el menú'}">${icon(UI.rail ? 'chev' : 'chevl', 18)}<span>${UI.rail ? 'Fijar menú' : 'Contraer menú'}</span></button>` + gs.map(g => { const tgt = (lastTabs[g.k] && g.vs.some(x => x[0] === lastTabs[g.k])) ? lastTabs[g.k] : g.vs[0][0], on = cur && cur.k === g.k, b = menuBadge(g);
      return `<a class="nav ${on ? 'on' : ''}" data-act="go" data-v="${tgt}" href="#/${tgt}" title="${esc(g.t)}"${on ? ' aria-current="page"' : ''}>${icon(g.ic, 18)}<span>${esc(g.t)}</span>${b ? `<em class="red">${b}</em>` : ''}</a>`; }).join('') + fh;
    { const ap = $('#app'); if (ap) ap.classList.toggle('rail', !!UI.rail); }
    const um = sr('#pop-usr'); if (um && !sr('[data-act="go"][data-v="miconfig"]', um) && !gs.some(g => g.vs.some(x => x[0] === 'miconfig'))) um.insertAdjacentHTML('beforeend', `<button data-act="go" data-v="miconfig">${icon('settings', 15)} Mi configuración</button>`);
  };
  function menuTabs() {
    const m = sr('#main'); if (!m) return; const old = sr('.menu-tabs', m); if (old) old.remove();
    const gs = menuGroups(), g = grupoDe(UI.view, gs); if (!g || g.vs.length < 2 || UI.view === 'ficha') return;
    try { lsSet('apih_tabs', JSON.stringify(lastTabs)); } catch (e) { }
    if (g.k === 'admin') {   /* U-16: una sola barra para toda la Administración */
      const fa = F('adm', { tab: 'param' }), ad = UI.view === 'admin';
      const ht = `<div class="menu-tabs" role="tablist" aria-label="${esc(g.t)}">${ADM_TABS.map(([k, n]) => `<a role="tab" href="#/admin" class="${ad && fa.tab === k ? 'on' : ''}" data-act="atab" data-k="${k}" aria-selected="${ad && fa.tab === k}">${esc(n)}</a>`).join('')}${g.vs.filter(x => x[0] !== 'admin').map(x => `<a role="tab" class="${UI.view === x[0] ? 'on' : ''}" data-act="go" data-v="${x[0]}" href="#/${x[0]}" aria-selected="${UI.view === x[0]}">${esc(x[1])}</a>`).join('')}</div>`;
      m.insertAdjacentHTML('afterbegin', ht); return;
    }
    const h = `<div class="menu-tabs" role="tablist" aria-label="${esc(g.t)}">${g.vs.map(x => { const b = +navBadge(x[0]) || 0; return `<a role="tab" class="${UI.view === x[0] ? 'on' : ''}" data-act="go" data-v="${x[0]}" href="#/${x[0]}" aria-selected="${UI.view === x[0]}">${esc(x[1])}${b ? `<em>${b}</em>` : ''}</a>`; }).join('')}</div>`;
    m.insertAdjacentHTML('afterbegin', h);
  }
  const go0 = go;
  ENLACES.go = function (v) { if (rolActual() === 'Colaborador' && ['decisiones', 'compromisos'].includes(v) && !UI.pmSet) { UI.pmSet = 1; FL.mine = true; try { ppInval(); } catch (e) { } } return go0(v); };
  /* Encabezado compacto: acciones secundarias en «Más», y filtros + búsqueda en una sola fila */
  function compactar() {
    const m = sr('#main'); if (!m || innerWidth < 700) return;
    const ph = sr(':scope>.ph', m); if (!ph) return;
    const p = sr('p', ph); if (p) p.title = p.textContent;
    const act = sr('.ph-act', ph);
    if (act && !sr('.v22-more', act)) {
      const keep = b => b.classList.contains('v22-main') || b.classList.contains('sxbtn') || b.closest('.v22-more') || /^\s*(Alta directa|Presentar|Ir a hoy|Nuev[oa]\b)/.test(b.textContent);   /* N-U-10/U-29: la acción principal de cada pantalla queda visible */
      const sec = sra('.btn', act).filter(b => !keep(b));
      if (sec.length >= 2) {
        const w = document.createElement('span'); w.className = 'popw v22-more'; const id = 'pop-ph-more';
        w.innerHTML = `<button class="btn" data-act="pop" data-id="${id}" aria-haspopup="menu">${icon('dots', 15)}<span>Más</span></button><div class="pop v22-pop" id="${id}" style="right:0"></div>`;
        const box = sr('.pop', w);
        sec.forEach(b => { if (b.closest('.edit-only')) b.classList.add('edit-only'); b.classList.remove('pri', 'sm'); box.appendChild(b); });
        sra('.edit-only', act).forEach(e => { if (!e.children.length && !e.textContent.trim()) e.remove(); });
        let ref = sr('.v22-main', act); while (ref && ref.parentNode !== act) ref = ref.parentNode; act.insertBefore(w, ref || null);
      }
    }
    const fb = sr(':scope>.flt-bar', m), tbs = sra(':scope>.toolbar', m);
    if (fb || tbs.length) {
      const row = document.createElement('div'); row.className = 'v22-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Filtros y búsqueda');
      [fb, ...tbs].forEach(c => { if (c) { [...c.childNodes].forEach(n => row.appendChild(n)); c.remove(); } });
      const tabs = UI.view === 'cielo' ? sr(':scope>.seg', m) : null; if (tabs) { tabs.style.margin = '0 0 0 auto'; row.appendChild(tabs); }
      { const sg = sra(':scope>.seg', row).pop(), gd = sr('.flt-guia', row); if (sg && UI.view !== 'cielo') { sg.style.margin = '0 0 0 auto'; row.appendChild(sg); } if (gd) { if (!sg || UI.view === 'cielo') gd.style.marginLeft = 'auto'; row.appendChild(gd); } }
      ph.insertAdjacentElement('afterend', row);
      sra('.search input', row).forEach(inp => { const t = inp.getAttribute('placeholder') || ''; if (t && !inp.getAttribute('aria-label')) inp.setAttribute('aria-label', t.replace(/…$/, '')); inp.setAttribute('placeholder', 'Buscar…'); });
      if (innerWidth >= 1100) { row.classList.add('one'); if (row.scrollWidth > row.clientWidth + 1 || row.offsetHeight > 52) row.classList.remove('one'); }
    }
  }
  const presLayout0 = presLayout;
  ENLACES.presLayout = function () { presLayout0.apply(this, arguments); const b = sr('.p2-bar [data-act=pdrawer] span'); if (b) b.textContent = 'Diapositivas'; const t = sr('.p2-bar input[data-k=titulo]'); if (t) { t.placeholder = 'Título de la presentación'; t.setAttribute('aria-label', 'Título'); } };
  const render0 = render;
  ENLACES.render = function () {
    /* compactar() mueve los filtros a otra fila y eso quita el foco del campo que se está escribiendo: se restaura al final */
    const act = document.activeElement, key = act && act.dataset ? act.dataset.key : null, ss = act && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null;
    render0.apply(this, arguments);
    try { if (St !== _audSt) audSnap(); primaria(); compactar(); contrasta(); menuTabs(); paginar(); a11y(); } catch (e) { console.error(e); }
    if (key) { const el = $(`[data-key="${key}"]`); if (el && el !== document.activeElement) { el.focus(); if (ss && el.setSelectionRange) try { el.setSelectionRange(ss[0], ss[1]); } catch (e) { } } }
  };
  /* texto oscuro sobre fondos claros (celdas de la matriz y exposición) */
  /* V22.40: tablas largas — primeras 100 filas y «Ver más» (genérico, sin tocar los datos) */
  const PG = 100, pgOpen = {};
  function paginar() {
    const m = document.getElementById('main'); if (!m) return;
    m.querySelectorAll('table.tbl:not(.mini)').forEach((t, n) => {
      const tb = t.tBodies[0]; if (!tb) return; const rows = [...tb.rows]; if (rows.length <= PG + 20) return;
      const key = UI.view + ':' + n, lim = Math.max(PG, pgOpen[key] || PG);
      const apply = l => { rows.forEach((r, k) => { r.hidden = k >= l; }); const left = rows.length - l; let bar = t.parentNode.querySelector(':scope > .pg-bar[data-k="' + key + '"]');
        if (left <= 0) { if (bar) bar.remove(); return; }
        if (!bar) { bar = document.createElement('div'); bar.className = 'pg-bar'; bar.dataset.k = key; t.after(bar); }
        bar.innerHTML = '<span>Mostrando ' + l + ' de ' + rows.length + '</span><button class="btn sm" type="button">Ver ' + Math.min(PG, left) + ' más</button><button class="btn sm" type="button">Ver todas</button>';
        const [b1, b2] = bar.querySelectorAll('button'); b1.onclick = () => { pgOpen[key] = l + PG; apply(l + PG); }; b2.onclick = () => { pgOpen[key] = rows.length; apply(rows.length); }; };
      apply(lim);
    });
  }
  /* V22.41: accesibilidad — encabezados de tabla, orden, nombres de botones y popovers */
  function a11y() {
    const m = document.getElementById('main'); if (!m) return;
    m.querySelectorAll('table thead th').forEach(th => { if (!th.hasAttribute('scope')) th.setAttribute('scope', 'col'); const b = th.querySelector('[data-act=psort]'); if (b) th.setAttribute('aria-sort', th.querySelector('.sorti') ? (th.querySelector('.sorti').textContent.trim() === '▲' ? 'ascending' : 'descending') : 'none'); });
    m.querySelectorAll('table tbody th:not([scope])').forEach(th => th.setAttribute('scope', 'row'));
    document.querySelectorAll('button:not([aria-label])').forEach(b => { if (!(b.textContent || '').trim() && b.title) b.setAttribute('aria-label', b.title); });
    syncPop();
  }
  function contrasta() {
    document.querySelectorAll('.expo,.h-c').forEach(e => {
      const m = (e.style.background || e.style.backgroundColor || '').match(/#([0-9a-f]{6})|rgb\((\d+),\s*(\d+),\s*(\d+)/i); if (!m) return;
      const c = m[1] ? [0, 2, 4].map(k => parseInt(m[1].substr(k, 2), 16)) : [+m[2], +m[3], +m[4]];
      const L = .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
      if (L > 140) { e.style.color = '#1A1A1A'; e.querySelectorAll('small').forEach(x => x.style.color = 'rgba(0,0,0,.7)'); }
    });
  }
  const banner0 = banner;
  ENLACES.banner = function () {
    let h = banner0.apply(this, arguments);
    return h;
  };

  /* ======================= Recorrido de primera vez ======================= */
  const TOUR = [
    { s: null, t: 'Bienvenido a APIH', d: 'En siete pasos cortos te muestro lo que más vas a usar. Te iré marcando cada cosa con un recuadro amarillo en la pantalla.' },
    { s: '#side', t: 'El menú', d: 'Aquí están las secciones. Cada rol ve solo las suyas, y dentro de cada sección hay pestañas arriba (por ejemplo, Planificación reúne Gantt, Roadmap, Calendario, Hitos y Riesgos).' },
    { s: '.top [data-id="pop-new"]', t: 'Crear', d: 'Este botón azul «Nuevo» sirve para crear propuestas, riesgos, hitos y decisiones.' },
    { s: '#v22-seg', t: 'Simple o Profesional', d: 'Este selector cambia cuánto detalle ves. Las pantallas son las mismas, con el mismo orden y los mismos colores. Siempre partes en Simple.' },
    { s: '.gsearch', t: 'Buscar', d: 'Encuentra cualquier proyecto, riesgo o hito. Atajo: la tecla «/».' },
    { s: '#v22-help', t: 'Ayuda según donde estés', d: 'Este botón te sugiere qué hacer en la pantalla que estás viendo, y cambia con ella.' },
    { s: '#v22-cmt', t: 'Comentarios por área', d: 'Deja una observación en cualquier parte. La verá tu área y un administrador la marcará como abordada.' }
  ];
  function tourEnd() { ['v22-spot', 'v22-tour'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); }); lsSet('apih_tour22', '1'); window.__tour22 = 1; window.removeEventListener('resize', tourPos); }
  let tourN = 0;
  function tourPos() { if (document.getElementById('v22-tour')) tourStep(tourN); }
  function tourStep(n) {
    tourN = n; const st = TOUR[n]; if (!st) return tourEnd();
    let sp = document.getElementById('v22-spot'), cd = document.getElementById('v22-tour');
    if (!sp) { sp = document.createElement('div'); sp.id = 'v22-spot'; document.body.appendChild(sp); }
    if (!cd) { cd = document.createElement('div'); cd.id = 'v22-tour'; cd.setAttribute('role', 'dialog'); cd.setAttribute('aria-label', 'Recorrido'); document.body.appendChild(cd); }
    cd.innerHTML = `<span class="tr-n">Paso ${n + 1} de ${TOUR.length}</span><h3>${esc(st.t)}</h3><p>${esc(st.d)}</p><div class="tr-f"><small></small><button class="btn sm" data-act="tourx">Saltar</button><button class="btn sm pri" data-act="tournext">${n === TOUR.length - 1 ? 'Listo' : 'Siguiente'}</button></div>`;
    const el = st.s && sr(st.s), r = el && el.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) {
      Object.assign(sp.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
      const cw = Math.min(340, innerWidth * .92), ch = cd.offsetHeight || 170; let x, y, side = 't';
      if (el.id === 'side') { x = r.right + 22; y = Math.max(80, r.top + 40); side = 'l'; }
      else { x = Math.min(Math.max(8, r.left + r.width / 2 - cw / 2), innerWidth - cw - 8); y = r.bottom + 22; if (y + ch > innerHeight - 8) { y = Math.max(8, r.top - ch - 22); side = 'b'; } }
      Object.assign(cd.style, { left: x + 'px', top: y + 'px', transform: 'none' });
      const ar = document.createElement('i'); ar.className = 'tr-ar ' + side;
      if (side === 'l') ar.style.top = Math.max(14, Math.min(ch - 30, r.top + r.height / 2 - y - 8)) + 'px'; else ar.style.left = Math.max(14, Math.min(cw - 30, r.left + r.width / 2 - x - 8)) + 'px';
      cd.appendChild(ar);
    } else {
      Object.assign(sp.style, { left: '50%', top: '40%', width: '0', height: '0' });
      Object.assign(cd.style, { left: '50%', top: '38%', transform: 'translateX(-50%)' });
    }
    const b = cd.querySelector('.pri'); if (b) b.focus();
  }
  Acts.tour = () => { closePops(); window.addEventListener('resize', tourPos); tourStep(0); };
  Acts.tournext = () => tourStep(tourN + 1);
  Acts.tourx = () => tourEnd();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('v22-tour')) tourEnd(); });
  V.ready = () => {
    UI.uiOv = null;   // U-21: parte en el modo recordado (Simple por defecto)
    const seen = lsGet('apih_tour22') === '1' || window.__tour22;
    if (!seen && !document.getElementById('sb-login') && !AuthService.needsLogin) setTimeout(() => { if (!document.getElementById('modal')) Acts.tour(); }, 600);
  };

  /* ======================= Login individual (Supabase Auth) ======================= */
  const SB2 = {
    async rest(token, path, opt = {}) {
      const r = await fetch(SB.cfg.url + '/rest/v1/' + path, { method: opt.method || 'GET', headers: Object.assign({ apikey: SB.cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, opt.headers || {}), body: opt.body });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      const t = r.status === 204 ? '' : await r.text(); return t ? JSON.parse(t) : null;
    },
    async recover(email) {
      const r = await fetch(SB.cfg.url + '/auth/v1/recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', headers: { apikey: SB.cfg.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status === 429 ? 'Demasiados intentos; espera unos minutos e inténtalo de nuevo' : (j.msg || j.error_description || 'No se pudo enviar el correo (' + r.status + ')')); }
    },
    async setPassword(token, auth) {
      const r = await fetch(SB.cfg.url + '/auth/v1/user', { method: 'PUT', headers: { apikey: SB.cfg.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: auth }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.msg || j.error_description || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error_code; throw e; }
    },
    /* cambia la contraseña: verifica la actual y luego fija la nueva */
    async cambiar(actual, nueva) {
      try { await SB._auth('password', { email: SB.sess.email, password: actual }); } catch (e) { if ([400, 401, 422].includes(e.status)) throw new Error('La contraseña actual no es correcta'); throw e; }
      try { await SB2.setPassword(await SB.token(), nueva); } catch (e) { throw new Error(e.code === 'same_password' ? 'La contraseña nueva debe ser distinta a la actual' : 'No se pudo cambiar la contraseña: ' + e.message); }
    },
    valida(pw, email) {
      if (String(pw).length < 10) return 'Usa al menos 10 caracteres';
      if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mezcla letras y números';
      if (String(email).split('@')[0].toLowerCase() === String(pw).toLowerCase()) return 'No uses tu nombre de usuario como contraseña';
      return '';
    },
    fuerza(pw) { let s = 0; if (pw.length >= 10) s++; if (pw.length >= 14) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++; if (/\d/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++; return s; }
  };
  V.SB2 = SB2;
  SB.login = async function (email, pw, remember) {
    email = String(email || '').trim().toLowerCase();
    if (!email || !pw) throw new Error('Ingresa tu correo y tu contraseña');
    const store = remember ? 'l' : 's', exp = j => Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
    try { const j = await SB._auth('password', { email, password: pw }); SB.sess = { email, access: j.access_token, refresh: j.refresh_token, exp: exp(j), _st: store }; SB.persist(); return {}; }
    catch (e) { if ([400, 401, 422].includes(e.status)) throw new Error('Correo o contraseña incorrectos'); throw e; }
  };
  SBLogin.show = function (msg) {
    if (document.getElementById('sb-login')) { const m = document.getElementById('sb-msg'); if (m && msg) m.textContent = msg; return; }
    const d = document.createElement('div'); d.id = 'sb-login'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Iniciar sesión');
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:var(--bg,#f3f4f6);padding:16px';
    document.body.appendChild(d);
    const paso1 = () => {
      d.innerHTML = `<form class="sb-card" autocomplete="on"><h1>APIH</h1><p class="sb-sub">Portfolio Intelligence Hub · acceso solo para personas autorizadas</p>
        <label for="sb-mail">Correo corporativo</label><input id="sb-mail" type="email" autocomplete="username" required placeholder="nombre.apellido@aramark.cl">
        <label for="sb-key">Contraseña</label><input id="sb-key" type="password" autocomplete="current-password" required>
        <label class="sb-chk"><input id="sb-rem" type="checkbox"> Recordar en este dispositivo</label>
        <button class="btn pri" id="sb-go" type="submit">Entrar</button><button type="button" class="sb-lnk" id="sb-forgot">¿Primera vez u olvidaste tu contraseña?</button><p id="sb-msg" role="alert">${msg ? String(msg).replace(/</g, '&lt;') : ''}</p>
        <small>Escribe tu correo y presiona el enlace de arriba: te llegará un correo para crear o cambiar tu contraseña.</small><small style="text-align:center;opacity:.6;margin-top:6px">APIH ${VER.v} · ${VER.b}</small></form>`;
      const f = d.querySelector('form'), m = d.querySelector('#sb-msg'), b = d.querySelector('#sb-go');
      d.querySelector('#sb-forgot').addEventListener('click', async () => {
        const em = d.querySelector('#sb-mail').value.trim().toLowerCase(); m.style.color = '#c0392b';
        if (!em) { m.textContent = 'Escribe tu correo corporativo y vuelve a presionar el enlace'; return; }
        m.style.color = ''; m.textContent = 'Enviando…';
        try { await SB2.recover(em); m.textContent = 'Si el correo está autorizado, te llegará un enlace para crear tu contraseña.'; } catch (e) { m.style.color = '#c0392b'; m.textContent = e.message; }
      });
      f.addEventListener('submit', async ev => {
        ev.preventDefault(); b.disabled = true; m.style.color = ''; m.textContent = 'Verificando…';
        try { await SB.login(d.querySelector('#sb-mail').value, d.querySelector('#sb-key').value, d.querySelector('#sb-rem').checked); location.reload(); }
        catch (e) { m.style.color = '#c0392b'; m.textContent = e.message; b.disabled = false; }
      });
      setTimeout(() => { const i = d.querySelector('#sb-mail'); if (i) i.focus(); }, 50);
    };
    /* llegada desde el correo de recuperación: #access_token=…&type=recovery */
    const paso3 = () => {
      const q = new URLSearchParams(location.hash.slice(1)), tk = q.get('access_token'), rf = q.get('refresh_token'); let em = '';
      let ex = 0, okTk = false;   // S-19: el token debe ser un JWT no vencido
      try { const pl = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); em = String(pl.email || '').toLowerCase(); ex = +pl.exp || 0; okTk = tk.split('.').length === 3; } catch (e) { }
      if (!okTk || !rf || (ex && ex * 1000 < Date.now())) { location.hash = ''; setTimeout(paso1, 0); return; }
      d.innerHTML = `<form class="sb-card" autocomplete="off"><h2>Crea tu contraseña</h2><p class="sb-note">${em ? esc(em) : ''}</p>
        <label for="sb-n1">Contraseña nueva</label><input id="sb-n1" type="password" autocomplete="new-password" required><div class="sb-str"><i id="sb-bar"></i></div>
        <label for="sb-n2">Repítela</label><input id="sb-n2" type="password" autocomplete="new-password" required>
        <small>Mínimo 10 caracteres, con letras y números.</small><button class="btn pri" id="sb-go" type="submit">Guardar y entrar</button><p id="sb-msg" role="alert"></p><small style="text-align:center;opacity:.6">APIH ${VER.v} · ${VER.b}</small></form>`;
      const f = d.querySelector('form'), m = d.querySelector('#sb-msg'), b = d.querySelector('#sb-go'), n1 = d.querySelector('#sb-n1'), n2 = d.querySelector('#sb-n2'), bar = d.querySelector('#sb-bar');
      n1.addEventListener('input', () => { const s = SB2.fuerza(n1.value); bar.style.width = s * 20 + '%'; bar.style.background = s < 3 ? '#c0392b' : s < 4 ? '#F2A100' : '#107C10'; });
      f.addEventListener('submit', async ev => {
        ev.preventDefault(); m.style.color = '#c0392b';
        if (!tk || !em) { m.textContent = 'El enlace no es válido o expiró. Pide uno nuevo.'; return; }
        const err = SB2.valida(n1.value, em); if (err) { m.textContent = err; return; } if (n1.value !== n2.value) { m.textContent = 'Las contraseñas no coinciden'; return; }
        b.disabled = true; m.style.color = ''; m.textContent = 'Guardando…';
        try {
          await SB2.setPassword(tk, n1.value);
          SB.sess = { email: em, access: tk, refresh: rf, exp: Math.floor(Date.now() / 1000) + (+q.get('expires_in') || 3600), _st: 's' }; SB.persist();
          history.replaceState(null, '', location.pathname + location.search); location.reload();
        } catch (e) { m.style.color = '#c0392b'; m.textContent = e.code === 'same_password' ? 'La contraseña nueva debe ser distinta a la anterior' : e.message; b.disabled = false; }
      });
      setTimeout(() => n1.focus(), 50);
    };
    if (/type=recovery/.test(location.hash)) paso3(); else paso1();
  };
  /* cambiar mi contraseña */
  Acts.pwchange = () => {
    if (!(SB.sess && AuthService.provider === 'supabase')) return toast('El cambio de contraseña aplica al acceso con Supabase', 'err');
    closePops();
    Modal.open({ title: 'Cambiar mi contraseña', body: `<div class="v22-f"><p class="mut" style="margin:0 0 6px;line-height:1.45">Solo tú conoces tu contraseña. Si la olvidas, puedes pedir un enlace por correo desde la pantalla de acceso.</p>
      <label for="pw0">Contraseña actual</label><input id="pw0" type="password" autocomplete="current-password" style="width:100%">
      <label for="pw1">Contraseña nueva</label><input id="pw1" type="password" autocomplete="new-password" style="width:100%"><label for="pw2">Repite la nueva</label><input id="pw2" type="password" autocomplete="new-password" style="width:100%"><small>Mínimo 10 caracteres, con letras y números.</small><p id="pwmsg" role="alert" style="color:var(--red);min-height:18px;margin:6px 0 0"></p></div>`,
      footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="pwsave" id="pwgo">Guardar contraseña</button>` });
  };
  Acts.pwsave = async () => {
    const m = sr('#pwmsg'), v = id => (sr(id) || {}).value || '', b = sr('#pwgo'); m.textContent = '';
    const err = SB2.valida(v('#pw1'), SB.sess.email); if (err) { m.textContent = err; return; } if (v('#pw1') !== v('#pw2')) { m.textContent = 'Las contraseñas no coinciden'; return; }
    if (!v('#pw0')) { m.textContent = 'Escribe tu contraseña actual'; return; }
    b.disabled = true; m.style.color = 'var(--tx2)'; m.textContent = 'Guardando…';
    try { await SB2.cambiar(v('#pw0'), v('#pw1')); Modal.close(); toast('Contraseña actualizada'); render(); }
    catch (e) { m.style.color = 'var(--red)'; m.textContent = e.message; b.disabled = false; }
  };

  /* ======================= Mi cocina: misión guiada ======================= */

  const diaPlural = n => n + (n === 1 ? ' día' : ' días');
  function misionDe(i) {
    const W = hoyW(), E = hoy(), out = [], st = starsOf(i, W), off = k => (st.find(x => x.k === k) || {}).s === 'off';
    const bAct = (l, a, d, pri) => ({ l, a, d, pri });
    if (off('dia')) {
      const nc = actSemana(i, W) === 'nc';
      out.push({ k: 'dia', t: 'Al día', por: nc ? 'Marcaste «sin novedades» dos semanas seguidas. Esta semana hace falta un avance real.' : (diasSinUpd(i) >= 999 ? 'Este proyecto nunca se ha actualizado.' : 'No lo actualizas desde el ' + fmtD(i.actualizada) + ' (hace ' + diaPlural(diasSinUpd(i)) + '). Esta semana aún no hay ninguna actualización.'),
        como: 'Abre la actualización semanal, anota un logro o el próximo paso y ajusta el % de avance. Toma 1 minuto.', btn: [bAct('Actualizar ahora', 'wk', { id: i.id }, true)] });
    }
    if (off('hit')) {
      const hv = vencidosA(hitosDe(i.id), 'fecha', E, (h, e) => h.completado && (h.fechaReal || '') <= e);
      out.push({ k: 'hit', t: 'Hitos', por: 'Tienes ' + hv.length + ' hito' + (hv.length === 1 ? '' : 's') + ' vencido' + (hv.length === 1 ? '' : 's') + ' sin cerrar ni explicar:',
        lista: hv.slice(0, 4).map(h => '«' + h.nombre + '» venció el ' + fmtD(h.fecha) + ' (hace ' + diaPlural(diffD(E, h.fecha)) + ')'),
        como: '<b>Si ya se cumplió:</b> ábrelo y márcalo completado. <b>Si se atrasó:</b> pide el cambio de fecha en Control de cambios; el atraso queda explicado y el tenedor se enciende.',
        btn: [bAct('Pedir cambio de fecha', 'chgnew', { id: i.id }, true), bAct('Ver hitos de la ficha', 'cocir', { id: i.id, k: 'hit' })] });
    }
    if (off('cmp')) {
      const cv = ACUERDOS().filter(c => c.ini === i.id && c.estado !== 'Cancelado' && c.limite && c.limite < E && c.estado !== 'Cumplido');
      out.push({ k: 'cmp', t: 'Compromisos', por: 'Hay ' + cv.length + ' compromiso' + (cv.length === 1 ? '' : 's') + ' con fecha vencida:',
        lista: cv.slice(0, 4).map(c => '«' + cut(c.texto, 60) + '» (' + (c.resp || 'sin responsable') + ', límite ' + fmtD(c.limite) + ')'),
        como: 'Ábrelos desde la ficha y márcalos <b>Cumplido</b>, o cámbiales la fecha límite si se acordó otra.', btn: [bAct('Ir a los compromisos', 'cocir', { id: i.id, k: 'com' }, true)] });
    }
    if (off('rsk')) {
      const um = cfgI(i, 'umbralCritico'), rs = riesgosDe(i.id).filter(riesgoAbierto).filter(r => (r.fRev && r.fRev < E) || (expo(r) >= um && !String(r.mit || '').trim()));
      out.push({ k: 'rsk', t: 'Riesgos', por: rs.length + ' riesgo' + (rs.length === 1 ? '' : 's') + ' por atender:',
        lista: rs.slice(0, 4).map(r => '«' + cut(r.desc, 60) + '» · ' + ((r.fRev && r.fRev < E) ? 'revisión vencida el ' + fmtD(r.fRev) : 'crítico (' + expo(r) + ') sin plan de mitigación')),
        como: 'Abre el riesgo y <b>escribe el plan de mitigación</b> o <b>actualiza la fecha de próxima revisión</b>.', btn: [bAct('Abrir el primer riesgo', 'sel', { t: 'risk', id: rs[0] ? rs[0].id : '' }, true), bAct('Ver riesgos de la ficha', 'cocir', { id: i.id, k: 'rie' })] });
    }
    if (off('gob')) {
      out.push({ k: 'gob', t: 'Gobierno', por: 'Se proyecta terminar el ' + fmtD(forecast(i)) + ', ' + diaPlural(desv(i)) + ' después de lo planificado (' + fmtD(i.finPlan) + '). Tu tolerancia es de ' + diaPlural(cfgI(i, 'tolDesv')) + ' y no hay ningún cambio registrado.',
        como: 'Registra la solicitud de cambio de fecha <b>antes de avisar al comité</b>: así el atraso queda aprobado o explicado.', btn: [bAct('Registrar cambio de fecha', 'chgnew', { id: i.id }, true)] });
    }
    return out;
  }
  V.misionPend = me => proyActivos(me, hoyW()).map(i => ({ i, m: misionDe(i), st: starsOf(i, hoyW()) }));
  function misionPanel(me) {
    const P = cieloPersona(me), L = V.misionPend(me), pend = L.filter(x => x.m.length), n = P.off;
    const d = (pD(hoy()).getDay() + 6) % 7, resta = 6 - d, nx = NIV.find(x => x[0] === P.nivel), sigN = (NIV[NIV.indexOf(nx) + 1] || [])[0], falt = nx[2] - P.total;
    const premio = !L.length ? 'Cuando lideres un proyecto activo, aquí verás qué hacer cada semana.' : !n ? 'Esta semana ya cuenta como <b>semana perfecta</b>.' : 'Si enciendes todos antes del domingo ganas una <b>semana perfecta</b>' + (sigN && falt > 0 ? ': te ' + (falt - 1 === 0 ? 'dejaría listo para ser <b>' + sigN + '</b>' : 'acerca a <b>' + sigN + '</b> (faltarían ' + (falt - 1) + ')') : '') + '.';
    const obj = `<div class="mis-obj"><div><em>1 · Objetivo</em>Encender los <b>5 tenedores</b> de cada proyecto que lideras. Cada tenedor es una buena práctica de gestión.</div><div><em>2 · Plazo</em>La semana cierra el <b>domingo</b> (${resta === 0 ? 'es hoy' : 'faltan ' + diaPlural(resta)}). Cada lunes los tenedores arrancan de nuevo.</div><div><em>3 · Premio</em>${premio} También suman insignias y estrellas Michelin.</div></div>`;
    const bloques = pend.map(({ i, m, st }) => {
      const tot = st.filter(y => y.s !== 'na').length, on = st.filter(y => y.s === 'on').length;
      return `<div class="mis-p"><div class="mis-ph">${starsRow(st, 18)}<b>${esc(i.titulo)}</b><small>${esc(i.fase)}</small><span class="pill">${on} de ${tot} tenedores</span></div>${m.map((x, k) => `<div class="mis-t"><span class="mis-n">${k + 1}</span><div><h4>${esc(x.t)}: ${esc(x.por)}</h4>${x.lista ? `<ul>${x.lista.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}<p class="mis-how" style="margin-top:6px"><b>Qué hacer:</b> ${x.como}</p></div><div class="mis-a edit-only">${x.btn.map(b => btn(b.l, b.a, { d: b.d, cls: b.pri ? 'pri' : 'sm' })).join('')}</div></div>`).join('')}</div>`;
    }).join('');
    const listos = L.filter(x => !x.m.length);
    const ok = listos.length && pend.length ? `<div class="mis-ok">${icon('check', 15)}<span>Ya tienen todo al día: ${listos.map(x => esc(cut(x.i.titulo, 28))).join(' · ')}</span></div>` : '';
    const body = !L.length ? V.emptyRich({ ic: 'fork', title: 'No lideras proyectos activos esta semana', line: 'Los tenedores se miden por proyecto. Cuando lideres uno (en ejecución o planificación), aquí te diremos paso a paso qué hacer.' }, true) : pend.length ? bloques + ok : `<div class="mis-ok" style="border:1px solid #9ED29F;border-radius:10px">${icon('check', 16)}<span><b>¡Mesa perfecta!</b> No te falta nada esta semana. Sigue así: lo único que queda es mantenerlo hasta el domingo.</span></div>`;
    return `<section class="card v22-mis" id="v22-mis"><header><h2>Tu misión esta semana</h2><small>${pend.length ? n + ' tenedor' + (n === 1 ? '' : 'es') + ' pendiente' + (n === 1 ? '' : 's') + ' en ' + pend.length + ' proyecto' + (pend.length === 1 ? '' : 's') : 'todo al día'}</small></header>${obj}${body}</section>`;
  }
  function misionStrip(me) {
    const P = cieloPersona(me), L = V.misionPend(me), pend = L.filter(x => x.m.length), n = P.off, resta = 6 - ((pD(hoy()).getDay() + 6) % 7);
    if (!L.length) return '';
    const ok = !pend.length;
    if (ok) return '';
    return `<div class="v22-mstrip ${ok ? 'ok' : ''}" id="v22-mstrip">${icon(ok ? 'check' : 'target', 20)}<div class="grow">${ok ? '<b>¡Mesa perfecta!</b> Todos tus proyectos tienen los 5 tenedores. Mantenlo hasta el domingo.' : `<b>Tu misión:</b> ${n} tenedor${n === 1 ? '' : 'es'} por encender en ${pend.length} proyecto${pend.length === 1 ? '' : 's'} · cierra el domingo (${resta === 0 ? 'hoy' : 'faltan ' + diaPlural(resta)}).`}</div>${ok ? '' : btn('Ver qué hacer', 'misir', { ic: 'chevd', cls: 'pri' })}</div>`;
  }
  Acts.misir = () => { const el = sr('#v22-mis'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  Acts.cocir = d => { const s = (fh()[d.k] = fh()[d.k] || {}); s.c = false; s.h = false; fhSave(); Acts.ficha({ id: d.id }); setTimeout(() => { const el = sr('#fl-' + d.k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); };

  const cielo0 = Views.cielo.render;
  Views.cielo.render = function () {
    const out = cielo0.apply(this, arguments), f = F('cielo', { tab: 'sem' });
    if ((f.tab || 'sem') !== 'sem' || !cieloOn()) return out;
    const me = miUsuario(), mk = '<svg width="0" height="0" style="position:absolute"><defs>', k = out.indexOf(mk);
    return (k >= 0 ? out.slice(0, k) + misionStrip(me) + out.slice(k) : out) + misionPanel(me);
  };
  const cocFit0 = cocFit;
  ENLACES.cocFit = function () {
    cocFit0.apply(this, arguments);
    const o = document.getElementById('csout'), s = document.getElementById('v22-mstrip'); if (!o) return;
    const p = o.parentElement, cs = getComputedStyle(p), w = p.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - 4, top = o.getBoundingClientRect().top, sc = Math.max(.34, w / 1500); if (s && o.nextElementSibling !== s) o.insertAdjacentElement('afterend', s);
    o.style.width = (1500 * sc) + 'px'; o.style.height = (694 * sc) + 'px'; o.firstElementChild.style.transform = 'scale(' + sc + ')';
  };

  /* ======================= Misiones del mes (opcionales) ======================= */
  const ymHoy = () => hoy().slice(0, 7);
  const finMes = () => { const d = pD(hoy()); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()); };
  const mkMes = k => '[Misión del mes · ' + k + '] ';
  const bitMes = (i, k) => St.bitacora.find(b => b.ini === i.id && String(b.ts).slice(0, 7) === ymHoy() && String(b.texto || '').startsWith(mkMes(k)));
  const MES_DEF = [
    { k: 'Presupuesto', t: 'Presupuesto al día', d: 'Confirma cuánto se ha consumido del presupuesto de cada proyecto. Así el costo real queda actualizado para el comité del mes.',
      aplica: i => i.presupuesto > 0,
      hecho: i => { const b = bitMes(i, 'Presupuesto'); return b ? 'Registrado el ' + fmtD(String(b.ts).slice(0, 10)) : null; },
      estado: i => 'Presupuesto ' + fmtMon(i.presupuesto, monOf(i)) + ' · consumido ' + fmtMon(i.gastado || 0, monOf(i)) + ' (' + Math.round((i.gastado || 0) / i.presupuesto * 100) + '%)',
      btn: i => [{ l: 'Registrar consumo', a: 'misgasto', d: { id: i.id }, pri: true }, { l: 'Está al día, sin cambios', a: 'misgastook', d: { id: i.id } }] }
  ];
  function mesResumen(me) {
    const P = proyActivos(me, hoyW()), out = MES_DEF.map(m => { const L = P.filter(m.aplica).map(i => ({ i, h: m.hecho(i) })); return { m, L }; });
    return { out, done: out.reduce((s, x) => s + x.L.filter(y => y.h).length, 0), of: out.reduce((s, x) => s + x.L.length, 0) };
  }
  function misionesMes(me) {
    const R = mesResumen(me), mes = MESES[pD(hoy()).getMonth()].toLowerCase();
    const blocks = R.out.filter(x => x.L.length).map(({ m, L }) => {
      const nd = L.filter(x => x.h).length;
      return `<div class="mis-p"><div class="mis-ph">${icon('cal', 18)}<b>${esc(m.t)}</b><span class="pill ${nd === L.length ? '' : 'soft'}">${nd} de ${L.length} proyectos</span></div><div class="mis-t" style="grid-template-columns:minmax(0,1fr)"><p class="mis-how" style="margin:0"><b>Para qué:</b> ${esc(m.d)}</p></div>${L.map(({ i, h }) => `<div class="mis-t"><span class="mis-n" style="${h ? 'background:#E4F3E5;color:#107C10' : 'background:rgba(0,0,0,.07);color:var(--mut)'}">${h ? '✓' : '·'}</span><div><h4>${esc(i.titulo)}</h4><p>${h ? esc(h) : esc(m.estado(i))}</p></div><div class="mis-a edit-only">${h ? '' : m.btn(i).map(b => btn(b.l, b.a, { d: b.d, cls: b.pri ? 'pri' : 'sm' })).join('')}</div></div>`).join('')}</div>`;
    }).join('');
    const body = R.of ? blocks : V.emptyRich({ ic: 'cal', title: 'No hay misiones del mes para tus proyectos', line: 'Las misiones aparecen cuando lideras un proyecto activo con presupuesto.' }, true);
    return `<section class="card v22-mis" id="v22-mes"><header><h2>Misiones del mes · ${esc(mes)}</h2><small>Opcionales: no afectan tus tenedores ni tu nivel</small></header>
      <div class="mis-obj" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div><em>Qué son</em>Un extra para dejar la gestión del mes completa. Puedes hacerlas o dejarlas.</div><div><em>Hasta cuándo</em>Se pueden completar hasta el <b>${esc(fmtD(finMes()))}</b>. El mes siguiente parten de cero.</div><div><em>Premio</em>${R.of ? `Llevas <b>${R.done} de ${R.of}</b>. Al completarlas todas ganas el sello <b>Mes completo</b>.` : 'El sello <b>Mes completo</b> se gana al completar todas.'}</div></div>${body}</section>`;
  }
  Acts.misgasto = d => {
    const i = byId(d.id); if (!i) return;
    if (soloLectura() || !puedeEditarIni(i)) return NO_PERM('Tu rol o el modo solo lectura no permiten editar');
    openForm({ title: 'Presupuesto al día · ' + i.titulo, values: { gastado: i.gastado || 0, nota: '' }, saveLabel: 'Guardar',
      fields: [{ k: 'gastado', l: 'Consumido a la fecha (' + MONEDAS[monOf(i)].n + ')', t: 'number', min: 0, w: 3, hint: 'Presupuesto: ' + fmtMon(i.presupuesto, monOf(i)) + ' · lo último registrado: ' + fmtMon(i.gastado || 0, monOf(i)) + '. Si lo pasas, <a class="lnk" data-act="chgnew" data-id="' + i.id + '">registra un cambio de presupuesto</a>.' }, { k: 'nota', l: 'Comentario (opcional)', t: 'textarea', w: 3 }],
      onSave(o) {
        const a = i.gastado || 0, n = +o.gastado || 0; i.gastado = n;
        log(a !== n ? 'Cambio' : 'Comentario', i.id, mkMes('Presupuesto') + 'Consumido ' + fmtN(a) + ' → ' + fmtN(n) + ' de ' + fmtN(i.presupuesto) + (o.nota ? '. ' + o.nota : ''));
        toast('Presupuesto registrado'); refresh();
      } });
  };
  Acts.misgastook = d => {
    const i = byId(d.id); if (!i) return;
    if (soloLectura() || !puedeEditarIni(i)) return NO_PERM('Tu rol o el modo solo lectura no permiten editar');
    log('Comentario', i.id, mkMes('Presupuesto') + 'Consumo confirmado sin cambios (' + fmtN(i.gastado || 0) + ' de ' + fmtN(i.presupuesto) + ')');
    toast('Confirmado: presupuesto al día'); refresh();
  };
  const insignias0 = insignias;
  ENLACES.insignias = function (me) {
    const B = insignias0.apply(this, arguments), R = mesResumen(me);
    B.push({ k: 'mm', n: 'Mes completo', d: 'Completa todas las misiones del mes en tus proyectos. Son opcionales y se reinician cada mes.', ic: 'cal', c: '#038387', v: Math.min(R.done, R.of), of: Math.max(R.of, 1), ok: R.of > 0 && R.done >= R.of });
    return B;
  };
  const cielo1 = Views.cielo.render;
  Views.cielo.render = function () {
    const out = cielo1.apply(this, arguments), f = F('cielo', { tab: 'sem' });
    if ((f.tab || 'sem') !== 'sem' || !cieloOn()) return out;
    return out + misionesMes(miUsuario());
  };
  const fitMain1 = fitMain;
  ENLACES.fitMain = function () { const r = fitMain1.apply(this, arguments); const m = document.getElementById('v22-mes'); if (m) m.classList.remove('fit'); return r; };

  /* ======================= Documentación del proyecto (enlaces a OneDrive / SharePoint) ======================= */
  const DOC_TIPOS = ['Acta', 'Contrato', 'RFP', 'Especificación', 'Informe', 'Presupuesto', 'Otro'];
  const docUrlOk = u => { try { const x = new URL(String(u || '').trim()); return x.protocol === 'https:' && /(^|\.)(sharepoint\.com|1drv\.ms|onedrive\.live\.com|office\.com|microsoft\.com)$/i.test(x.hostname); } catch (e) { return false; } };
  const docsDe = id => (St.documentos || []).filter(d => d.ini === id).sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const docPuedeAgregar = i => !soloLectura() && (puedeEditarIni(i) || puedeGobernar());
  const docPuedeEditar = (d, i) => !soloLectura() && (esMia(d) || puedeGobernar() || esAdmin());
  function secDoc(i) {
    const L = docsDe(i.id);
    if (!L.length) return [0, V.emptyRich({ ic: 'book', title: 'Aún no hay documentación', line: 'Sube el archivo a OneDrive o SharePoint, copia el vínculo con «Compartir» y pégalo acá. Así toda la documentación del proyecto queda en un solo lugar.', p: ['Agregar documento', 'docnew', { id: i.id }, 'plus'] })];
    return [L.length, `<div class="v22-docs">${L.map(d => `<div class="v22-doc"><span class="v22-doc-i">${icon('book', 18)}</span><div class="v22-doc-m"><b>${esc(d.nombre)}</b><small>${esc(d.tipo || 'Otro')} · ${esc(d.autor || '—')} · ${esc(fmtD(String(d.ts).slice(0, 10)))}${d.nota ? ' · ' + esc(cut(d.nota, 90)) : ''}</small></div><span class="v22-doc-a">${docUrlOk(d.url) ? `<a class="btn sm pri" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${icon('link', 13)}<span>Abrir</span></a>` : '<span class="pill soft" title="El enlace no es de OneDrive o SharePoint">Enlace no válido</span>'}${docPuedeEditar(d, i) ? `<span class="edit-only"><button class="btn sm" data-act="docedit" data-id="${esc(d.id)}">Editar</button><button class="btn sm" data-act="docdel" data-id="${esc(d.id)}">Quitar</button></span>` : ''}</span></div>`).join('')}</div>`];
  }
  function docForm(i, d) {
    const nw = !d;
    openForm({ title: (nw ? 'Agregar documento · ' : 'Editar documento · ') + i.titulo, saveLabel: nw ? 'Agregar' : 'Guardar',
      values: { nombre: nw ? '' : d.nombre, tipo: nw ? 'Otro' : d.tipo, url: nw ? '' : d.url, nota: nw ? '' : (d.nota || '') },
      fields: [
        { k: 'nombre', l: 'Nombre del documento', req: true, w: 3 },
        { k: 'tipo', l: 'Tipo', t: 'select', opts: DOC_TIPOS, w: 1 },
        { k: 'url', l: 'Vínculo de OneDrive o SharePoint', req: true, w: 3, hint: 'Sube el archivo a OneDrive o SharePoint, pulsa <b>Compartir → Copiar vínculo</b> (que lo pueda abrir el equipo del proyecto) y pégalo acá.' },
        { k: 'nota', l: 'Nota (opcional)', t: 'textarea', w: 3 }],
      onSave(o) {
        const u = String(o.url || '').trim(), nm = String(o.nombre || '').trim();
        if (!nm) { toast('Ponle un nombre al documento', 'err'); return false; }
        if (!docUrlOk(u)) { toast('El vínculo debe ser de OneDrive o SharePoint (https://…sharepoint.com, 1drv.ms)', 'err'); return false; }
        if (nw) {
          const hh = new Date().toTimeString().slice(0, 5); St.documentos = St.documentos || [];
          St.documentos.unshift({ id: 'DOC-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(), ini: i.id, nombre: nm, tipo: o.tipo || 'Otro', url: u, nota: String(o.nota || '').trim(), autor: miUsuario(), correo: emailYo(), ts: hoy() + 'T' + hh });
          log('Cambio', i.id, 'Documento agregado: ' + nm + ' (' + (o.tipo || 'Otro') + ')');
        } else { Object.assign(d, { nombre: nm, tipo: o.tipo || 'Otro', url: u, nota: String(o.nota || '').trim() }); log('Cambio', i.id, 'Documento actualizado: ' + nm); }
        toast(nw ? 'Documento agregado' : 'Documento actualizado'); refresh();
      } });
  }
  Acts.docnew = d => { const i = byId(d.id); if (!i) return; if (!docPuedeAgregar(i)) return NO_PERM('Tu rol o el modo solo lectura no permiten agregar documentos'); docForm(i, null); };
  Acts.docedit = d => { const x = (St.documentos || []).find(n => n.id === d.id), i = x && byId(x.ini); if (!x || !i) return; if (!docPuedeEditar(x, i)) return NO_PERM('Solo quien lo agregó o el PMO puede editarlo'); docForm(i, x); };
  Acts.docdel = d => {
    const x = (St.documentos || []).find(n => n.id === d.id), i = x && byId(x.ini); if (!x || !i) return;
    if (!docPuedeEditar(x, i)) return NO_PERM('Solo quien lo agregó o el PMO puede quitarlo');
    confirmBox('¿Quitar «' + esc(x.nombre) + '» de la documentación? El archivo en OneDrive/SharePoint no se borra.', () => { St.documentos = St.documentos.filter(n => n.id !== x.id); log('Cambio', i.id, 'Documento quitado: ' + x.nombre); toast('Documento quitado'); refresh(); }, 'Quitar', true);
  };
})();
