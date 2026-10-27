import { ENLACES } from './00-registro.js';
import { $, ACUERDOS, ADMIN_USERS, APIH_CONFIG, CAMBIOS, DECS, ESTADOS_PRJ, FASES, FASES_ACT, FASES_FIJAS, FASES_PRJ, FASES_PROP, FASE_COLOR, FL, HITOS, METODO_DEF, MONEDAS, PRIOS, RAGS, RIESGOS, RISK_CATS, RISK_ESTADOS, St, _ixGen, _nrm, addD, atrasado, audParse, avatar, avg, by, byId, clone, completitud, defaultCfg, desv, diasSinUpd, diffD, esProp, esSB, esc, esperado, expo, fasesDe, fmtD, fmtMon, fmtN, forecast, hitoCats, hitosDe, hoy, icon, inArea, isActive, isLive, log, miUsuario, monOf, nameOf, nextId, pD, pct, ragSugerido, riesgoAbierto, riesgosDe, save, scopeP, seedState, tipoLbl } from './01-nucleo.js';
import { AuthService, DataService, SETTINGS_KEYS, ESQUEMA } from './02-datos.js';
import { Acts, BK, Chg, F, Modal, UI, Views, avFase, btn, closePops, confirmBox, download, downloadBlob, empty, go, iniLink, iniOpts, iniOptsF, openForm, pageHead, people, prog, refresh, render, sanSt, selOpts, selectEntity, shell, syncInfo, syncPop, toast } from './03-interfaz.js';
import { cmdServidor, conServidor, diasEnFase, migrateV5 } from './04-flujos.js';
import { DESC_MAX, cutDesc, faseNotaP, fasesVentana, hitosSub, rangoTx, sfImportar, sfRef, subfasesDe, ventanaDe } from './05-vistas.js';
/* ======================= ADMINISTRACIÓN ======================= */
const umbralNote = () => `<div class="note" style="margin-top:12px">${icon('info', 14)}<span>Los umbrales de alerta (desviación, días sin actualización, riesgo crítico, semáforo de propuestas y meta de «Mi cocina») se ajustan en <button class="lnk" data-act="go" data-v="miconfig">Mi configuración</button>, donde Administra los fija para todos y cada líder puede personalizarlos.</span></div>` + ((0, ENLACES.esAdministra)() && window.V22 && V22.MENU ? (0, ENLACES.menuRolCard)() : '');
/* ============================================================
   V22.44 · Notificaciones (estructura paramétrica)
   · Catálogo NOTIF: qué se avisa, a quién (destinatarios), con qué parámetros y por qué canal.
   · Generación SIN estado: notifPara(usuario) se calcula desde los datos (reglas) y la Bitácora (eventos). El mismo cálculo
     servirá a un proceso servidor (Power Automate / función Supabase) que recorra a todos los usuarios y envíe correo o Teams.
   · Canales: app (campana) activo; correo y Teams quedan declarados y apagados hasta que TI entregue SMTP / webhook.
   · Preferencias: valores por defecto de la organización (St.cfg.notif, solo Administra) y ajuste personal (St.cfgU[usuario].notif).
   · Lectura: por navegador (localStorage) para no pisar la configuración compartida.
   ============================================================ */
const NOTIF_CANALES = [['app', 'En la app', true], ['correo', 'Correo', false], ['teams', 'Teams', false]];   /* [id, etiqueta, disponible hoy] */
export const NOTIF_DEST = [['lider', 'Líder'], ['sponsor', 'Sponsor'], ['resp', 'Responsable directo'], ['pmo', 'PMO (Administra)']];
export const NOTIF_GRUPOS = { plazos: 'Plazos y compromisos', riesgos: 'Riesgos y decisiones', salud: 'Salud y avance', colab: 'Colaboración', gob: 'Gobierno y cambios' };
const NOTIF = [
  { id: 'hito_prox', g: 'plazos', l: 'Hito por vencer', d: 'Un hito pendiente vence en los próximos días.', sev: 1, on: true, dest: ['resp', 'lider'], dias: 3, diasL: 'días de anticipación' },
  { id: 'hito_venc', g: 'plazos', l: 'Hito vencido', d: 'Un hito de un proyecto en curso pasó su fecha sin completarse.', sev: 2, on: true, dest: ['resp', 'lider'] },
  { id: 'comp_prox', g: 'plazos', l: 'Compromiso por vencer', d: 'Un compromiso abierto vence en los próximos días.', sev: 1, on: true, dest: ['resp'], dias: 3, diasL: 'días de anticipación' },
  { id: 'comp_venc', g: 'plazos', l: 'Compromiso vencido', d: 'Un compromiso abierto pasó su fecha límite.', sev: 2, on: true, dest: ['resp', 'pmo'] },
  { id: 'riesgo_crit', g: 'riesgos', l: 'Riesgo crítico abierto', d: 'Un riesgo abierto supera el umbral de exposición crítica.', sev: 3, on: true, dest: ['resp', 'lider'] },
  { id: 'dec_venc', g: 'riesgos', l: 'Decisión vencida', d: 'Una decisión pendiente pasó su fecha límite.', sev: 2, on: true, dest: ['resp', 'pmo'] },
  { id: 'atraso', g: 'salud', l: 'Proyecto atrasado', d: 'La fecha proyectada supera la tolerancia de desviación.', sev: 2, on: true, dest: ['lider', 'sponsor'] },
  { id: 'sin_update', g: 'salud', l: 'Proyecto sin actualización', d: 'Se superó el plazo sin actualizar el avance.', sev: 1, on: true, dest: ['lider'] },
  { id: 'prop_estancada', g: 'salud', l: 'Propuesta estancada', d: 'Una propuesta lleva más días de lo esperado en su fase.', sev: 1, on: false, dest: ['lider'] },
  { id: 'ev_rag', g: 'salud', l: 'Salud pasa a Rojo', d: 'Un proyecto cambió su RAG a Rojo (últimos 14 días).', sev: 3, on: true, dest: ['lider', 'sponsor', 'pmo'], ev: true },
  { id: 'ev_fase', g: 'salud', l: 'Cambio de fase', d: 'Una iniciativa avanzó de fase (últimos 14 días).', sev: 1, on: true, dest: ['lider', 'sponsor'], ev: true },
  { id: 'ev_asigna', g: 'colab', l: 'Te asignaron como responsable', d: 'Quedaste como responsable o dueño de una iniciativa, hito o riesgo.', sev: 1, on: true, dest: ['resp'], ev: true, fijoDest: true },
  { id: 'ev_comentario', g: 'colab', l: 'Comentario nuevo', d: 'Otra persona comentó una iniciativa que lideras o patrocinas.', sev: 1, on: true, dest: ['lider', 'sponsor'], ev: true },
  { id: 'cambio_pend', g: 'gob', l: 'Solicitud de cambio pendiente', d: 'Hay una solicitud de cambio esperando aprobación.', sev: 2, on: true, dest: ['pmo'] },
  { id: 'cambio_res', g: 'gob', l: 'Solicitud de cambio resuelta', d: 'Se aprobó o rechazó una solicitud que hiciste (últimos 14 días).', sev: 1, on: true, dest: ['resp'], ev: true, fijoDest: true }
];
const NOTIF_VENT = 14;   /* días hacia atrás para los avisos por evento */
const rolDeUser = n => { const k = _nrm(n); if (ADMIN_USERS.some(a => _nrm(a) === k)) return 'Administra'; const u = St.usuarios.find(x => _nrm(x.n) === k); return u && ENLACES.PERM_ROLES.includes(u.rol) ? u.rol : 'Colaborador'; };
export function notifPref(id, user) {
  const c = NOTIF.find(x => x.id === id), o = ((St.cfg.notif || {}).tipos || {})[id] || {}, p = ((((0, ENLACES.cfgUOf)(user).notif || {}).tipos) || {})[id] || {};
  const can = Object.assign({ app: true, correo: false, teams: false }, o.canales || {}, p.canales || {});
  return { on: p.on != null ? p.on : o.on != null ? o.on : c.on, dest: o.dest || c.dest, dias: o.dias != null ? o.dias : c.dias, canales: can };
}
export function notifPara(user) {
  if (!St || !user) return [];
  const u = _nrm(user), hy = hoy(), rol = rolDeUser(user), out = [];
  const visible = i => i && (0, ENLACES.areaVisible)(i.area);
  /* rel(i, extra): relación de «user» con la iniciativa/ítem → lista de roles que cumple */
  const rel = (i, resp) => { const r = []; if (i && _nrm(i.lider) === u) r.push('lider'); if (i && _nrm(i.sponsor) === u) r.push('sponsor'); if (resp && _nrm(resp) === u) r.push('resp'); if (rol === 'Administra') r.push('pmo'); return r; };
  const aplica = (id, i, resp) => { const p = notifPref(id, user); if (!p.on) return false; const r = rel(i, resp); return p.dest.some(k => r.includes(k)); };
  const add = (id, key, i, texto, extra) => { const c = NOTIF.find(x => x.id === id); out.push(Object.assign({ key: id + ':' + key, tipo: id, g: c.g, sev: c.sev, ini: i ? i.id : null, titulo: c.l, texto, ts: hy }, extra || {})); };
  const vivas = St.ini.filter(i => isLive(i) && visible(i));
  /* --- reglas --- */
  const pH = notifPref('hito_prox', user).dias, pC = notifPref('comp_prox', user).dias;
  St.hitos.filter(h => !h.completado).forEach(h => {
    const i = byId(h.ini); if (!i || !isLive(i) || !visible(i) || i.estado !== 'En curso') return;
    const d = diffD(h.fecha, hy);
    if (d < 0 && aplica('hito_venc', i, h.resp)) add('hito_venc', h.id, i, `«${h.nombre}» venció hace ${-d} d (${fmtD(h.fecha)}) · ${i.titulo}`, { ts: h.fecha, sev: -d > 30 ? 3 : 2 });
    else if (d >= 0 && d <= pH && aplica('hito_prox', i, h.resp)) add('hito_prox', h.id, i, `«${h.nombre}» vence ${d === 0 ? 'hoy' : 'en ' + d + ' d'} (${fmtD(h.fecha)}) · ${i.titulo}`, { ts: h.fecha });
  });
  ACUERDOS().filter(a => a.estado === 'Abierto' && a.limite).forEach(a => {
    const i = byId(a.ini); if (a.ini && !visible(i)) return; const d = diffD(a.limite, hy);
    if (d < 0 && aplica('comp_venc', i, a.resp)) add('comp_venc', a.id, i, `«${cut(a.texto, 70)}» venció hace ${-d} d · ${a.resp || 'sin responsable'}`, { ts: a.limite });
    else if (d >= 0 && d <= pC && aplica('comp_prox', i, a.resp)) add('comp_prox', a.id, i, `«${cut(a.texto, 70)}» vence ${d === 0 ? 'hoy' : 'en ' + d + ' d'} · ${a.resp || 'sin responsable'}`, { ts: a.limite });
  });
  St.riesgos.filter(r => riesgoAbierto(r)).forEach(r => { const i = byId(r.ini); if (!i || !isLive(i) || !visible(i)) return; const e = expo(r); if (e >= (0, ENLACES.cfgI)(i, 'umbralCritico') && aplica('riesgo_crit', i, r.dueno)) add('riesgo_crit', r.id, i, `Exposición ${e}: ${cut(r.desc, 80)} · ${i.titulo}`, { ts: r.fIdent || hy }); });
  DECS().filter(d => d.estado === 'Pendiente' && d.limite && d.limite < hy).forEach(d => { const i = byId(d.ini); if (d.ini && !visible(i)) return; if (aplica('dec_venc', i, d.solicita)) add('dec_venc', d.id, i, `«${cut(d.titulo, 70)}» venció hace ${diffD(hy, d.limite)} d`, { ts: d.limite }); });
  vivas.filter(isActive).forEach(i => {
    if (atrasado(i) && aplica('atraso', i)) add('atraso', i.id, i, `${i.titulo}: +${desv(i)} d sobre el plan`);
    const du = diasSinUpd(i); if (du > (0, ENLACES.cfgI)(i, 'diasSinUpdate') && aplica('sin_update', i)) add('sin_update', i.id, i, `${i.titulo}: ${du >= 999 ? 'sin registro de actualización' : du + ' d sin actualizar'}`);
  });
  scopeP().filter(i => isLive(i) && visible(i) && i.estado === 'Vigente').forEach(i => { const d = diasEnFase(i), amb = (0, ENLACES.cfgI)(i, 'propDiasAmb') || 30; if (d > amb && aplica('prop_estancada', i)) add('prop_estancada', i.id, i, `${i.titulo}: ${d} d en la fase ${i.fase}`); });
  CAMBIOS().filter(c => c.estado === 'Solicitado').forEach(c => { const i = byId(c.ini); if (!visible(i)) return; if (aplica('cambio_pend', i, c.aprobador)) add('cambio_pend', c.id, i, `${c.tipo}: ${cut(c.desc || c.id, 70)} · pide ${c.solicita || '—'}`, { ts: c.creada || hy }); });
  /* --- eventos (últimos NOTIF_VENT días; no avisan al autor del cambio) --- */
  CAMBIOS().filter(c => c.estado !== 'Solicitado' && c.fDec && diffD(hy, c.fDec) <= NOTIF_VENT).forEach(c => { const i = byId(c.ini); if (!visible(i)) return; if (aplica('cambio_res', i, c.solicita)) add('cambio_res', c.id, i, `Tu solicitud de ${String(c.tipo).toLowerCase()} fue ${String(c.estado).toLowerCase()} · ${cut(c.desc || c.id, 60)}`, { ts: c.fDec }); });
  St.bitacora.forEach(b => {
    if (!b.ini || diffD(hy, String(b.ts).slice(0, 10)) > NOTIF_VENT || _nrm(b.autor) === u) return;
    const i = byId(b.ini); if (!visible(i)) return; const ts = String(b.ts).slice(0, 10), T = b.texto || '';
    if (b.tipo === 'Comentario' && !/^Estrella Michelin/.test(T) && aplica('ev_comentario', i)) add('ev_comentario', b.id, i, `${b.autor}: «${cut(T, 90)}» · ${i.titulo}`, { ts });
    if (b.tipo === 'Cambio' && /^Cambio de fase/.test(T) && aplica('ev_fase', i)) add('ev_fase', b.id, i, `${i.titulo}: ${T.replace(/^Cambio de fase: /, '').replace(/ \(forzado.*$/, '')}`, { ts });
    if (b.tipo === 'Cambio' && /^RAG .*→ Rojo/.test(T) && aplica('ev_rag', i)) add('ev_rag', b.id, i, `${i.titulo}: ${T}`, { ts });
    if (b.tipo === 'Edición' && notifPref('ev_asigna', user).on) { const P = audParse(T); (P.rows || []).forEach(r => { if (/^(Responsable|Dueño)$/.test(r[0]) && _nrm(r[2]) === u) add('ev_asigna', b.id + r[0], i, `${P.ent ? P.kind + ' «' + P.ent + '»' : i.titulo}: ahora eres ${r[0] === 'Dueño' ? 'dueño' : 'responsable'} (antes ${r[1]}) · ${i.titulo}`, { ts }); }); }
  });
  /* canales activos para cada aviso (hoy solo «app» se entrega; el resto queda en la cola de salida) */
  out.forEach(n => { const p = notifPref(n.tipo, user); n.canales = NOTIF_CANALES.filter(c => p.canales[c[0]] && (c[0] === 'app' || (St.cfg.notif || {}).canalOn && St.cfg.notif.canalOn[c[0]])).map(c => c[0]); });
  return out.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : b.sev - a.sev));
}
/* cola de salida para canales externos: la consumirá el proceso servidor cuando TI habilite correo / Teams */
export function notifOutbox(user, canal) { return notifPara(user).filter(n => n.canales.includes(canal)); }
const _nlg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, _nls = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const nlKey = () => 'apih_nl_' + _nrm(miUsuario());
const nlLeidas = () => { try { return new Set(JSON.parse(_nlg(nlKey()) || '[]')); } catch (e) { return new Set(); } };
const nlGuardar = (set, vigentes) => { const keep = [...set].filter(k => vigentes.has(k)).slice(-600); _nls(nlKey(), JSON.stringify(keep)); };
let _notifC = null;
export function notifMias() { const k = St.ini.length + '|' + St.bitacora.length + '|' + _ixGen + '|' + hoy() + '|' + miUsuario(); if (_notifC && _notifC.k === k) return _notifC.v; const v = notifPara(miUsuario()).filter(n => n.canales.includes('app')); _notifC = { k, v }; return v; }
function bellPop() {
  const pb = $('#pop-bell'), bn = $('#bellN'); if (!pb) return;
  const al = typeof ENLACES.motorAlertas === 'function' ? (0, ENLACES.motorAlertas)() : [], alc = al.filter(a => a.sev === 3).length, av = notifMias(), L = nlLeidas(), nl = av.filter(n => !L.has(n.key)), tab = UI.bellTab || 'avisos';
  if (bn) { const t = nl.length + alc; bn.textContent = t > 99 ? '99+' : t || ''; bn.style.display = t ? '' : 'none'; }
  const head = `<div class="pop-tabs" role="tablist"><button role="tab" aria-selected="${tab === 'avisos'}" class="${tab === 'avisos' ? 'on' : ''}" data-act="belltab" data-t="avisos">Avisos${nl.length ? ` <b>${nl.length}</b>` : ''}</button>${APIH_CONFIG.analisis !== false ? `<button role="tab" aria-selected="${tab === 'alertas'}" class="${tab === 'alertas' ? 'on' : ''}" data-act="belltab" data-t="alertas">Alertas${alc ? ` <b>${alc}</b>` : ''}</button>` : ''}</div>`;
  if (tab === 'alertas' && APIH_CONFIG.analisis !== false) pb.innerHTML = head + (al.slice(0, 7).map(a => `<button data-act="alertgo" data-id="${esc(a.ini || '')}"><span class="sev s-${a.sev}"></span><span><b>${esc(a.titulo)}</b><small>${esc(a.grupo)} · ${esc(a.ini ? nameOf(a.ini) : '')}</small></span></button>`).join('') || '<div class="empty-s">Sin alertas</div>') + `<button class="pop-f" data-act="go" data-v="analisis">Ver todas en Análisis →</button>`;
  else pb.innerHTML = head + (av.slice(0, 8).map(n => `<button data-act="avisogo" data-id="${esc(n.ini || '')}" data-k="${esc(n.key)}" class="${L.has(n.key) ? 'rd' : ''}"><span class="sev s-${n.sev}"></span><span><b>${esc(n.titulo)}</b><small>${esc(n.texto)}</small></span></button>`).join('') || '<div class="empty-s">Sin avisos pendientes</div>') + `<div class="pop-f2">${nl.length ? `<button data-act="avisoleer">Marcar todo como leído</button>` : '<span></span>'}<button data-act="go" data-v="miconfig">Configurar avisos</button></div>`;
}
const bellKeep = () => setTimeout(() => { const el = $('#pop-bell'); if (el) { el.classList.add('open'); UI.pop = 'pop-bell'; syncPop(); } }, 0);   /* el clic reemplaza el contenido y el cierre «clic afuera» lo tomaría por externo */
Acts.belltab = d => { UI.bellTab = d.t; bellPop(); bellKeep(); };
Acts.avisogo = d => { const L = nlLeidas(); L.add(d.k); nlGuardar(L, new Set(notifMias().map(n => n.key))); closePops(); bellPop(); if (d.id) selectEntity('ini', d.id, 'resumen'); };
Acts.avisoleer = () => { const av = notifMias(), L = nlLeidas(); av.forEach(n => L.add(n.key)); nlGuardar(L, new Set(av.map(n => n.key))); bellPop(); bellKeep(); };
/* ---- matriz de configuración (modo 'org' para Administra en Admin · 'user' en Mi configuración) ---- */
function notifMatriz(modo) {
  const org = modo === 'org', me = miUsuario(), can = NOTIF_CANALES, onOrg = (St.cfg.notif || {}).canalOn || {};
  const head = `<tr><th>Aviso</th><th class="n">Activo</th>${can.map(c => `<th class="n">${c[1]}</th>`).join('')}${org ? '<th>Destinatarios</th><th class="n">Parámetro</th>' : ''}</tr>`;
  let rows = '';
  Object.keys(NOTIF_GRUPOS).forEach(g => {
    rows += `<tr class="grp"><td colspan="${3 + can.length + (org ? 1 : 0)}"><b>${NOTIF_GRUPOS[g]}</b></td></tr>`;
    NOTIF.filter(c => c.g === g).forEach(c => {
      const p = notifPref(c.id, me), dis = FL.verComo ? 'disabled' : '';
      rows += `<tr><td><b>${esc(c.l)}</b><br><small>${esc(c.d)}${c.ev ? ' · por evento' : ''}</small></td><td class="n"><input type="checkbox" ${p.on ? 'checked' : ''} ${dis} data-chg="notifon" data-m="${modo}" data-id="${c.id}" aria-label="Activar ${esc(c.l)}"></td>` +
        can.map(([k, l, disp]) => { const off = !disp && !(onOrg[k]); return `<td class="n"><input type="checkbox" ${p.canales[k] ? 'checked' : ''} ${k === 'app' ? 'disabled' : off || dis ? 'disabled' : ''} data-chg="notifcan" data-m="${modo}" data-id="${c.id}" data-c="${k}" aria-label="${esc(l)}: ${esc(c.l)}" ${off ? 'title="Canal aún no habilitado"' : ''}></td>`; }).join('') +
        (org ? `<td><div class="dst">${c.fijoDest ? '<small>' + (c.id === 'ev_asigna' ? 'La persona asignada' : 'Quien solicitó') + '</small>' : NOTIF_DEST.map(([k, l]) => `<label class="chk"><input type="checkbox" ${p.dest.includes(k) ? 'checked' : ''} data-chg="notifdest" data-id="${c.id}" data-k="${k}"> <span>${l}</span></label>`).join('')}</div></td><td class="n">${c.dias != null ? `<input type="number" min="1" max="30" value="${p.dias}" style="width:56px" data-chg="notifdias" data-id="${c.id}" aria-label="${esc(c.diasL)}"> <small>${c.diasL}</small>` : '—'}</td>` : '') + '</tr>';
    });
  });
  return `<div class="tbl-w" style="max-height:none;overflow-x:auto"><table class="tbl notif-t"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}
function notifCanalesCard() {
  const on = (St.cfg.notif || {}).canalOn || {};
  return `<div class="note" style="margin-bottom:10px">${icon('info', 14)}<span><b>En la app</b> funciona hoy (campana). <b>Correo</b> y <b>Teams</b> quedan listos en la estructura: cuando TI entregue el servicio de correo (SMTP) o el webhook de Teams, se habilitan aquí y se envía lo que cada persona haya marcado.</span></div>
    <div class="chips" style="margin-bottom:10px">${NOTIF_CANALES.filter(c => !c[2]).map(c => `<label class="chk"><input type="checkbox" ${on[c[0]] ? 'checked' : ''} data-chg="notifcanon" data-c="${c[0]}"> <span>Habilitar ${c[1]} (requiere integración)</span></label>`).join('')}</div>`;
}
function notifAdminHTML() {
  return `<div class="card"><header><h2>Notificaciones · valores por defecto</h2><small>Qué se avisa, a quién y por qué canal. Cada persona puede ajustar lo suyo en Mi configuración.</small></header>${notifCanalesCard()}${notifMatriz('org')}<div class="chips" style="margin-top:10px">${btn('Restablecer valores', 'notifreset')}</div></div>`;
}
export function notifUserCard() {
  const n = notifMias().length;
  return `<section class="card c12"><header><h2>Notificaciones</h2><small>Qué quieres que te avise APIH · hoy te llegan ${n} avisos en la campana</small></header>${notifMatriz('user')}<div class="chips" style="margin-top:10px">${btn('Restablecer mis avisos', 'notifmyreset')}</div></section>`;
}
const notifOrg = () => (St.cfg.notif = St.cfg.notif || { tipos: {}, canalOn: {} });
const notifOrgT = id => { const o = notifOrg(); o.tipos = o.tipos || {}; return (o.tipos[id] = o.tipos[id] || {}); };
Chg.notifon = el => { if (FL.verComo) return; if (el.dataset.m === 'org') { if (!(0, ENLACES.esAdministra)()) return; notifOrgT(el.dataset.id).on = el.checked; } else { const u = Object.assign({}, (0, ENLACES.cfgUOf)(miUsuario()).notif || {}); u.tipos = Object.assign({}, u.tipos); u.tipos[el.dataset.id] = Object.assign({}, u.tipos[el.dataset.id], { on: el.checked }); (0, ENLACES.cfgSet)(miUsuario(), { notif: u }); } _notifC = null; refresh(); };
Chg.notifcan = el => { if (FL.verComo) return; const id = el.dataset.id, c = el.dataset.c; if (el.dataset.m === 'org') { if (!(0, ENLACES.esAdministra)()) return; const t = notifOrgT(id); t.canales = Object.assign({}, t.canales, { [c]: el.checked }); } else { const u = Object.assign({}, (0, ENLACES.cfgUOf)(miUsuario()).notif || {}); u.tipos = Object.assign({}, u.tipos); const t = u.tipos[id] = Object.assign({}, u.tipos[id]); t.canales = Object.assign({}, t.canales, { [c]: el.checked }); (0, ENLACES.cfgSet)(miUsuario(), { notif: u }); } _notifC = null; refresh(); };
Chg.notifdest = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; const id = el.dataset.id, t = notifOrgT(id), cur = (t.dest || NOTIF.find(x => x.id === id).dest).slice(), k = el.dataset.k, p = cur.indexOf(k); if (el.checked && p < 0) cur.push(k); if (!el.checked && p >= 0) cur.splice(p, 1); if (!cur.length) { toast('Debe quedar al menos un destinatario', 'err'); refresh(); return; } t.dest = cur; _notifC = null; refresh(); };
Chg.notifdias = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; notifOrgT(el.dataset.id).dias = Math.min(30, Math.max(1, +el.value || 1)); _notifC = null; refresh(); };
Chg.notifcanon = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; const o = notifOrg(); o.canalOn = Object.assign({}, o.canalOn, { [el.dataset.c]: el.checked }); _notifC = null; refresh(); };
Acts.notifreset = () => { if (!(0, ENLACES.esAdministra)()) return; confirmBox('Se restablecerán los destinatarios, parámetros y canales por defecto de toda la organización. ¿Continuar?', () => { delete St.cfg.notif; _notifC = null; toast('Valores restablecidos'); refresh(); }, 'Restablecer', true); };
Acts.notifmyreset = () => { if (FL.verComo) return; const u = (0, ENLACES.cfgUOf)(miUsuario()); delete u.notif; _notifC = null; toast('Avisos restablecidos'); refresh(); };

export const ADM_TABS = [['param', 'Parámetros'], ['cat', 'Catálogos'], ['met', 'Metodología'], ['usr', 'Usuarios y roles'], ['not', 'Notificaciones'], ['cal', 'Calidad de datos'], ['dat', 'Datos y exportación'], ['sp', 'Conexión']];
Views.admin = {
  render() {
    const f = F('adm', { tab: 'param' }); const tabs = ADM_TABS;
    let b = '';
    if (f.tab === 'param') {
      const c = St.cfg;
      b = `<div class="card"><header><h2>Parámetros de negocio</h2><small>Alimentan reglas de negocio, semáforos y KPIs</small></header><div class="fgrid">
        <div class="fld"><label>Unidad monetaria</label><input value="${esc(c.unidad)}" data-chg="cfg" data-k="unidad" data-key="c-unidad"><small>Los montos del portafolio se expresan en esta unidad</small></div>
        <div class="fld"><label>Plazo máximo de una decisión (días)</label><input type="number" min="1" value="${c.decMaxDias || 30}" data-chg="cfg" data-k="decMaxDias" data-num="1" data-key="c-dmax"><small>No se puede registrar una decisión con fecha límite más lejana</small></div>
        <div class="fld"><label>Escalar decisiones tras (días de atraso)</label><input type="number" min="1" value="${c.decEscalaDias || 7}" data-chg="cfg" data-k="decEscalaDias" data-num="1" data-key="c-desc"><small>Pasan a «escalada a Administra», quedan en bitácora y generan alerta del Reglas PMO</small></div>
        <div class="fld"><label>Capacidad máx. de proyectos por líder</label><input type="number" min="1" value="${c.capacidadMax}" data-chg="cfg" data-k="capacidadMax" data-num="1" data-key="c-cap"><small>Reglas de roadmap: sobrecarga de líderes</small></div>
        <div class="fld"><label>Fecha de referencia ("hoy")</label><input type="date" value="${esc(c.hoyFija)}" data-chg="cfg" data-k="hoyFija"><small>Vacío = fecha real del sistema. Útil para demos congeladas.</small></div>
        <div class="fld"><label>Usuario actual</label><input value="${esc(c.usuario)}" disabled><small>Viene del inicio de sesión Microsoft. Para probar como otra persona usa «Ver como» en la barra superior.</small></div>
        <div class="fld"><label class="chk"><input type="checkbox" ${c.readOnly ? 'checked' : ''} data-chg="cfg" data-k="readOnly" data-bool="1"> <span>Modo solo lectura (presentación)</span></label><small>Oculta controles de edición</small></div>
        <div class="fld"><label class="chk"><input type="checkbox" ${c.cieloOn !== false ? 'checked' : ''} data-chg="cfg" data-k="cieloOn" data-bool="1"> <span>Activar «Mi cocina» (tenedores y estrellas Michelin)</span></label><small>Sin ranking de personas: solo vista propia y colectiva</small></div>
        </div></div>`+umbralNote();
    } else if (f.tab === 'not') {
      b = notifAdminHTML();
    } else if (f.tab === 'cat') {
      const lst = (k, t) => `<div class="card"><header><h2>${t}</h2></header><div class="chips">${St.cfg[k].map((x, n) => `<span class="chip on" style="--c:#0D446A">${esc(x)} <button class="x" data-act="catdel" data-k="${k}" data-n="${n}" aria-label="Quitar">×</button></span>`).join('')}</div><div class="composer" style="margin-top:10px"><input id="new_${k}" placeholder="Agregar…"><button class="btn sm pri" data-act="catadd" data-k="${k}">${icon('plus', 13)}</button></div></div>`;
      b = `<div class="grid12"><div class="c6">${lst('areas', 'Áreas')}</div><div class="c6">${lst('categorias', 'Categorías')}</div></div><div class="card"><header><h2>Workflow de portafolio</h2><small>Se edita en la pestaña Metodología</small></header><div class="flow big">${FASES.map(x => `<span class="done"><i></i>${x}</span>`).join('')}</div><p class="mut" style="margin-top:8px">Compuertas: Evaluación (problema + sponsor) → Caso Negocio (valoración + líder) → Aprobación (presupuesto + beneficio + business case) → Planificación (decisión “Iniciar” aprobada) → Ejecución (fechas + hitos) → Transición (≥80% y sin hitos vencidos) → Cierre (100%, hitos completos, sin riesgos críticos).</p></div>`;
    } else if (f.tab === 'met') {
      b = metTab();
    } else if (f.tab === 'usr') {
      b = `<div class="card"><header><h2>Usuarios y roles</h2><small>${St.usuarios.length} usuarios · basados en la hoja Usuarios de Gene</small></header><table class="tbl"><thead><tr><th>Usuario</th><th>Cargo</th><th>Rol</th><th>Áreas</th><th>Proyectos liderados</th></tr></thead><tbody>${St.usuarios.map(u => `<tr><td><span class="pp">${avatar(u.n, 24)}<b>${esc(u.n)}</b></span></td><td>${esc(u.cargo)}</td><td><span class="pill soft">${esc(u.rol)}</span></td><td>${esc(u.area)}</td><td class="n">${St.ini.filter(i => i.lider === u.n && isLive(i)).length}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (f.tab === 'cal') {
      const rows = St.ini.map(i => ({ i, c: completitud(i) })).sort(by(r => r.c.pct));
      b = `<div class="card"><header><h2>Auditoría de calidad de datos</h2><small>Promedio ${pct(avg(rows, r => r.c.pct))} · críticos = Sponsor, Líder, Área, Prioridad, Fechas plan</small></header><div class="tbl-w"><table class="tbl"><thead><tr><th>Iniciativa</th><th>Completitud</th><th>Faltan (crítico)</th><th>Faltan (recomendado)</th><th>Faltan (opcional)</th></tr></thead><tbody>${rows.map(({ i, c }) => `<tr data-act="sel" data-t="ini" data-id="${i.id}"><td><b>${esc(i.titulo)}</b><small>${i.id}</small></td><td style="min-width:130px">${prog(c.pct, c.pct > 80 ? 'Verde' : c.pct > 60 ? 'Ámbar' : 'Rojo', 6)}<small>${c.pct}%</small></td><td class="${c.crit.length ? 'neg' : ''}">${esc(c.crit.join(', ') || '—')}</td><td>${esc(c.rec.join(', ') || '—')}</td><td>${esc(c.opt.join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
    } else if (f.tab === 'dat') {
      const sz = Math.round(JSON.stringify(St).length / 1024), cnt = St.ini.length + St.hitos.length + St.riesgos.length + St.decisiones.length + St.bitacora.length + St.comites.length;
      b = `<div class="grid12"><section class="card c6"><header><h2>Exportación y respaldo</h2><small>${cnt} registros · ${sz} KB</small></header><p class="desc">${DataService.svc ? 'Los datos se guardan automáticamente en el servidor (Supabase).' : '<b>Modo demo:</b> los datos viven solo en memoria. Exporta un respaldo antes de cerrar o conecta SharePoint.'} El Excel completo replica las columnas de cada lista (útil para carga masiva).</p><div class="chips">${btn('Excel completo (6 hojas)', 'xlsxall', { ic: 'down', cls: 'pri' })}${btn('Respaldo JSON', 'expjson', { ic: 'down' })}${btn('Importar respaldo', 'impjson', { ic: 'up', title: 'Restaura un respaldo JSON completo (reemplaza los datos actuales)' })}${btn('Importar iniciativas', 'impini', { ic: 'up', title: 'Agrega o actualiza iniciativas desde un archivo JSON/CSV' })}${btn('Plantilla iniciativas', 'inipl', { ic: 'down' })}${btn('Portfolio CSV', 'pcsv', { ic: 'down' })}${btn('Riesgos CSV', 'riskcsv', { ic: 'down' })}${btn('Hitos CSV', 'hitocsv', { ic: 'down' })}${btn('Bitácora CSV', 'bitcsv', { ic: 'down' })}</div><input type="file" id="impfile" accept="application/json" style="display:none" data-chg="impfile"><input type="file" id="impinifile" accept="application/json" style="display:none" data-chg="impinifile"></section>
      <section class="card c6"><header><h2>Origen de los datos</h2></header><p class="desc">Datos cargados <b>solo desde el archivo Iniciativas IT ARAMARK</b> (iniciativas, propuestas, hitos, riesgos, decisiones pendientes, bitácora, ciclos del calendario, presentaciones y usuarios con su rol y área). No hay estimaciones ni iniciativas de ejemplo: lo que el archivo no trae (presupuesto, beneficio, sponsor de proyectos, fechas, responsable de hitos, mitigaciones) queda vacío y se completa desde la plataforma.</p>
      <div class="chips">${btn(DataService.svc ? 'Restablecer a los datos del archivo (reescribe el servidor)' : 'Restaurar datos del archivo', 'reset', { ic: 'undo', cls: 'danger' })}</div></section></div>`;
    } else if (f.tab === 'sp') {
      b = spTab();
    }
    return pageHead('Administración', 'Parámetros, catálogos, usuarios, calidad de datos y respaldo') + b;   /* U-16: las pestañas de Administración viven en la barra única de arriba */
  }
};
Acts.atab = d => { F('adm', {}).tab = d.k; if (UI.view !== 'admin') go('admin'); else render(); };
Chg.cfg = el => { const k = el.dataset.k; St.cfg[k] = el.dataset.bool ? el.checked : el.dataset.num ? Math.max(0, +el.value || 0) : el.value; if (ENLACES.PERS_KEYS.includes(k)) Object.values(St.cfgU || {}).forEach(u => { if (u.cfg) delete u.cfg[k]; }); if (k === 'readOnly' && St.cfg.readOnly) toast('Modo solo lectura activado'); if (k === 'usuario') { const fx = document.activeElement && document.activeElement.dataset.key; shell(); render(); const el = fx && $(`[data-key="${fx}"]`); if (el) { el.focus(); el.setSelectionRange && el.setSelectionRange(el.value.length, el.value.length); } save(); return; } refresh(); };
Acts.catadd = d => { const el = $('#new_' + d.k), v = el.value.trim(); if (!v) return; if (!St.cfg[d.k].includes(v)) St.cfg[d.k].push(v); refresh(); };
Acts.catdel = d => { St.cfg[d.k].splice(+d.n, 1); refresh(); };
Acts.expjson = () => { download('APIH_respaldo_' + hoy() + '.json', JSON.stringify(St, null, 1), 'application/json'); toast('Respaldo exportado'); };
Acts.impjson = () => $('#impfile').click();
Chg.impfile = el => { const fl = el.files[0]; el.value = ''; if (!fl) return;
  if (!(0, ENLACES.esAdministra)() || FL.verComo) { toast('Solo el rol Administra puede importar un respaldo', 'err'); return; }
  const r = new FileReader(); r.onload = () => { try {
    const o = JSON.parse(r.result); if (!o || o.v !== 3 || !Array.isArray(o.ini)) throw new Error('Formato inválido');
    const ks = [['ini', 'Iniciativas'], ['hitos', 'Hitos'], ['riesgos', 'Riesgos'], ['decisiones', 'Decisiones']], len = (x, k) => Array.isArray(x[k]) ? x[k].length : 0;
    const bad = ks.filter(([k]) => o[k] != null && !Array.isArray(o[k])).map(x => x[1]); if (bad.length) throw new Error('Datos dañados en: ' + bad.join(', '));
    const cmp = ks.map(([k, n]) => n + ': ' + len(St, k) + ' → ' + len(o, k)).join(' · '), loss = len(o, 'ini') < len(St, 'ini') * 0.5 && len(St, 'ini') >= 4;
    const msg = 'Se reemplazarán TODOS los datos actuales por el respaldo' + (DataService.svc ? ' y el cambio se sincronizará para todos los usuarios' : '') + '.<br><br>Actual → Respaldo<br>' + cmp + (loss ? '<br><br>⚠ El respaldo tiene menos de la mitad de las iniciativas actuales.' : '') + '<br><br>Antes de importar se descargará una copia de los datos actuales. ¿Continuar?';
    confirmBox(msg, () => { try { download('APIH_antes_de_importar_' + hoy() + '.json', JSON.stringify(St, null, 1), 'application/json'); } catch (e) { }
      ENLACES.St = migrateV5(o); ['hitos', 'riesgos', 'decisiones', 'comites', 'bitacora', 'usuarios', 'eventos', 'compromisos', 'cambios', 'notas', 'documentos', 'pres'].forEach(k => { St[k] = St[k] || []; }); St.comites.forEach(c => { if (c && typeof c === 'object') ['acciones', 'compromisos', 'decisiones'].forEach(k => { if (!Array.isArray(c[k])) c[k] = []; }); }); St.cfgU = St.cfgU || {}; St.ini.forEach(x => { if (!x || typeof x !== 'object') return; ['deps', 'subfases', 'hist', 'est', 'tags'].forEach(k => { if (!Array.isArray(x[k])) x[k] = []; }); if (!x.faseNota || typeof x.faseNota !== 'object') x.faseNota = {}; ['titulo', 'lider', 'sponsor', 'negocio', 'proveedor', 'desc', 'bc', 'resumen', 'proximos', 'folio', 'oc', 'estadoMotivo', 'tipoIni'].forEach(k => { if (typeof x[k] !== 'string') x[k] = x[k] == null ? '' : String(x[k]); }); if (typeof x.area !== 'string') x.area = 'BISE'; if (typeof x.rag !== 'string') x.rag = 'Verde'; if (typeof x.prioridad !== 'string') x.prioridad = 'Media'; if (typeof x.moneda !== 'string') x.moneda = 'CLP'; if (typeof x.estado !== 'string') x.estado = 'En curso'; if (typeof x.fase !== 'string') x.fase = 'Planificación'; }); /* F-03: respaldo parcial */ sanSt(St); St.cfg = Object.assign(defaultCfg(), St.cfg); St.ptpl = St.ptpl || []; St.psnap = St.psnap || {}; toast('Respaldo importado (copia previa descargada)'); shell(); refresh(); if (DataService.svc) save(); }, 'Importar', true);
  } catch (e) { toast('No se pudo importar: ' + e.message, 'err'); } }; r.readAsText(fl); };
/* V22.50: importar iniciativas (suma registros, no reemplaza) */
export const INI_PLANTILLA = () => ({ formato: 'apih-iniciativas', v: 1, iniciativas: [
  { tipo: 'Proyecto', titulo: 'APIH Prototipo', desc: 'Prototipo de APIH sobre SPA + Supabase (interino). Fuente de verdad de las reglas de negocio y las vistas.', area: 'BISE', lider: St.cfg.usuario || '', sponsor: '', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', avance: 70, inicioPlan: hoy(), finPlan: addD(hoy(), 120), presupuesto: 0 },
  { tipo: 'Proyecto', titulo: 'APIH Corporativo', desc: 'APIH conforme a los requisitos de TI: SPA con Entra ID, API y Azure SQL (3 capas). Reutiliza el núcleo del prototipo.', area: 'BISE', lider: St.cfg.usuario || '', sponsor: '', fase: 'Planificación', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', avance: 5, inicioPlan: hoy(), finPlan: addD(hoy(), 240), presupuesto: 0,
    hitos: [{ nombre: 'Plan aprobado', fase: 'Planificación', fecha: addD(hoy(), 10), cat: 'Gobierno' }, { nombre: 'API lista', fase: 'Ejecución', fecha: addD(hoy(), 60), cat: 'Entregable', subfase: 'Construcción' }, { nombre: 'Piloto con usuarios', fase: 'Ejecución', fecha: addD(hoy(), 90), cat: 'Técnico', subfase: 'Piloto' }],
    subfases: [{ nombre: 'Construcción', fase: 'Ejecución', fin: addD(hoy(), 70), desc: 'Construir y probar en local antes del piloto.' }, { nombre: 'Piloto', fase: 'Ejecución', inicio: addD(hoy(), 71), desc: 'Piloto con un grupo acotado; recoger feedback.' }],
    faseNota: { Ejecución: 'Avanzar solo con las compuertas en verde; coordinar con TI la ventana de despliegue.' },
    _ayuda: 'hitos[].cat: ' + hitoCats().join(', ') + '. hitos[].desc, subfases[].desc, faseNota[<fase>]: texto libre (recordatorio/instrucciones), se ve en Mi cocina. subfases: dentro de UNA fase; inicio/fin vacíos heredan los de la fase. hitos[].subfase: nombre o id de una subfase de la misma fase.' }] });
Acts.inipl = () => { download('APIH_iniciativas_plantilla.json', JSON.stringify(INI_PLANTILLA(), null, 1), 'application/json'); toast('Plantilla descargada'); };
Acts.impini = () => $('#impinifile').click();
/* V22.63 (A-1): normaliza cada fila de «Importar iniciativas» con lista blanca de campos y tipos.
   Sin id/ini propios en riesgos ni hitos (los genera la app); enums sin <>"'`= ; fechas ISO; números acotados; sin claves desconocidas. */
const INI_ENUM_RX = /^[^<>"'`=\\]{1,80}$/, SF_ID_RX = /^[A-Za-z0-9_-]{1,20}$/;
function normIni(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const txt = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : undefined;
  const enm = v => typeof v === 'string' && INI_ENUM_RX.test(v.trim()) ? v.trim() : undefined;
  const num = (v, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof n === 'number' && isFinite(n) && n >= lo && n <= hi ? n : undefined; };
  const dte = v => archFecha(v) ? v : undefined;
  const o = {}, set = (k, v) => { if (v !== undefined) o[k] = v; };
  const tipo = x.tipo === 'Propuesta' ? 'Propuesta' : 'Proyecto';
  const MM = MET(), fl = tipo === 'Propuesta' ? MM.fasesProp : MM.fasesPrj, fAll = [...MM.fasesPrj, ...MM.fasesProp];   // incluye fases personalizadas de Metodología
  set('tipo', tipo); set('titulo', txt(x.titulo, 200));
  ['desc', 'logros', 'proximos', 'bc', 'resumen', 'issue', 'riesgoTxt'].forEach(k => set(k, txt(x[k], DESC_MAX)));
  ['lider', 'sponsor', 'negocio', 'proveedor', 'area', 'categoria', 'prioridad', 'moneda', 'rag'].forEach(k => set(k, enm(x[k])));
  if (fl.includes(x.fase)) set('fase', x.fase);
  set('avance', num(x.avance, 0, 100)); ['presupuesto', 'gastado', 'beneficio'].forEach(k => set(k, num(x[k], 0, 1e12)));
  ['inicioPlan', 'finPlan', 'finEst', 'creada', 'faseDesde', 'inicioReal', 'finReal'].forEach(k => set(k, dte(x[k])));
  if (Array.isArray(x.deps)) set('deps', x.deps.filter(d => typeof d === 'string' && SF_ID_RX.test(d)));
  if (Array.isArray(x.tags)) set('tags', x.tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 40)).filter(Boolean));
  if (Array.isArray(x.hitos)) set('hitos', x.hitos.filter(h => h && typeof h === 'object' && typeof h.nombre === 'string' && h.nombre.trim()).map(h => {
    const q = { nombre: h.nombre.trim().slice(0, 200) };
    if (fAll.includes(h.fase)) q.fase = h.fase; set2(q, 'fecha', dte(h.fecha)); set2(q, 'fechaReal', dte(h.fechaReal));
    if (typeof h.completado === 'boolean') q.completado = h.completado; set2(q, 'dias', num(h.dias, -3650, 3650));
    set2(q, 'resp', enm(h.resp)); set2(q, 'desc', txt(h.desc, DESC_MAX)); set2(q, 'cat', enm(h.cat));
    if (typeof h.subfase === 'string' && h.subfase.trim() && h.subfase.length <= 120 && !/[<>"'`\u0000-\u001f]/.test(h.subfase)) q.subfase = h.subfase.trim();   /* id o nombre de subfase: se resuelve más abajo y, si no existe, se descarta */
    return q; }));
  if (Array.isArray(x.riesgos)) set('riesgos', x.riesgos.filter(r => r && typeof r === 'object').map(r => {
    const q = {}; set2(q, 'desc', txt(r.desc, 500)); set2(q, 'cat', enm(r.cat)); set2(q, 'dueno', enm(r.dueno)); set2(q, 'mit', txt(r.mit, 500)); set2(q, 'estado', enm(r.estado));
    set2(q, 'prob', num(r.prob, 1, 5)); set2(q, 'imp', num(r.imp, 1, 5)); set2(q, 'fIdent', dte(r.fIdent)); set2(q, 'fRev', dte(r.fRev));
    return q; }).filter(q => q.desc));
  if (Array.isArray(x.subfases)) set('subfases', x.subfases.filter(s => s && typeof s === 'object' && typeof s.nombre === 'string').map(s => {
    const q = { nombre: s.nombre.trim().slice(0, 120) }; set2(q, 'id', typeof s.id === 'string' && SF_ID_RX.test(s.id) ? s.id : undefined);
    if (fAll.includes(s.fase)) q.fase = s.fase; set2(q, 'resp', enm(s.resp)); set2(q, 'inicio', dte(s.inicio)); set2(q, 'fin', dte(s.fin)); set2(q, 'desc', txt(s.desc, DESC_MAX));
    return q; }));
  if (x.faseNota && typeof x.faseNota === 'object' && !Array.isArray(x.faseNota)) set('faseNota', x.faseNota);
  return o;
}
const set2 = (o, k, v) => { if (v !== undefined) o[k] = v; };
Chg.impinifile = el => { const fl = el.files[0]; el.value = ''; if (!fl) return;
  if (!(0, ENLACES.esAdministra)() || FL.verComo) { toast('Solo el rol Administra puede importar iniciativas', 'err'); return; }
  const r = new FileReader(); r.onload = () => { try {
    const o = JSON.parse(r.result), L = Array.isArray(o) ? o : (o && Array.isArray(o.iniciativas) ? o.iniciativas : null);
    if (!L || !L.length) throw new Error('Formato inválido: se espera { "iniciativas": [...] }');
    const k = t => _nrm(t), ex = new Set(St.ini.map(i => k(i.titulo))), nuevas = [], omit = [];
    L.forEach(raw => { const x = normIni(raw); if (!x || !String(x.titulo || '').trim()) { omit.push('(sin título)'); return; } if (ex.has(k(x.titulo))) { omit.push(x.titulo); return; } ex.add(k(x.titulo)); nuevas.push(x); });
    if (!nuevas.length) { toast('Nada que importar: todas ya existen (' + omit.join(', ') + ')', 'err'); return; }
    let nh = 0, nr = 0; const th = nuevas.reduce((a, x) => a + (x.hitos || []).length, 0), avisos = [];
    confirmBox('Se agregarán <b>' + nuevas.length + '</b> iniciativa(s) con ' + th + ' hitos: ' + nuevas.map(x => esc(x.titulo)).join(', ') + '.' + (omit.length ? '<br>Omitidas por existir o sin título: ' + omit.map(esc).join(', ') + '.' : '') + '<br>Los datos actuales no se modifican. ¿Continuar?', () => {
      nuevas.forEach(x => { const PR = x.tipo === 'Propuesta', pre = PR ? 'PROP' : 'PRJ', T = PR ? 'Propuesta' : 'Proyecto';
        const n = Object.assign({ id: null, tipo: T, legacy: '', creada: hoy(), faseDesde: hoy(), origen: 'importación', est: [], hist: [[hoy(), +x.avance || 0]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, estado: PR ? 'Vigente' : 'En curso', propuestaOrigen: null, estadoMotivo: '', estadoRev: null, rag: 'Verde', avance: 0, gastado: 0, proyecto: null, deps: [], area: 'BISE', fase: PR ? FASES_PROP[0] : 'Planificación', prioridad: 'Media', presupuesto: 0, logros: '', proximos: '', sponsor: '', lider: '', desc: '' }, x, { id: undefined, actualizada: hoy() });
        n.id = nextId(pre, St.ini.filter(y => y.id.startsWith(pre + '-'))); n.finEst = n.finEst || n.finPlan || null; delete n.hitos; delete n.riesgos; delete n.subfases; St.ini.push(n); const nh0 = St.hitos.length;
        (x.hitos || []).forEach(h => { const f = h.fecha || addD(n.inicioPlan || hoy(), +h.dias || 0), ok = !!h.completado; St.hitos.push({ id: nextId('HIT', St.hitos), ini: n.id, nombre: h.nombre, fase: h.fase || n.fase, fecha: f, completado: ok, fechaReal: ok ? (h.fechaReal || f) : null, resp: h.resp || n.lider || '', ...(h.cat && hitoCats().includes(h.cat) ? { cat: h.cat } : {}), ...(typeof h.desc === 'string' && h.desc.trim() ? { desc: cutDesc(h.desc.trim()) } : {}) }); nh++; });
        if (x.faseNota && typeof x.faseNota === 'object' && !Array.isArray(x.faseNota)) { n.faseNota = {}; fasesDe(n).forEach(fx => { const v = x.faseNota[fx]; if (typeof v === 'string' && v.trim()) n.faseNota[fx] = cutDesc(v.trim()); }); if (!Object.keys(n.faseNota).length) delete n.faseNota; }
        sfImportar(n, x.subfases, m => avisos.push(n.titulo + ': ' + m)); (x.hitos || []).forEach((h, k) => { if (!h || !h.subfase) return; const hh = St.hitos[nh0 + k], sf = hh && sfRef(n, h.subfase, hh.fase); if (!hh) return; if (!sf) { delete hh.subfase; return avisos.push(n.titulo + ': el hito «' + hh.nombre + '» apunta a una subfase que no existe (' + h.subfase + ')'); } if (sf.fase !== hh.fase) { delete hh.subfase; return avisos.push(n.titulo + ': el hito «' + hh.nombre + '» es de ' + hh.fase + ' y la subfase «' + sf.nombre + '» de ' + sf.fase + ' (sin subfase)'); } hh.subfase = sf.id; });
        (x.riesgos || []).forEach(r => { St.riesgos.push({ id: nextId('RSK', St.riesgos), ini: n.id, cat: 'Técnico', prob: 3, imp: 3, estado: 'Abierto', dueno: n.lider || '', fIdent: hoy(), fRev: addD(hoy(), 30), mit: '', ...r }); nr++; });
        log('Cambio', n.id, T + (PR ? ' importada: ' : ' importado: ') + n.titulo + (x.hitos ? ' (' + x.hitos.length + ' hitos' + (x.riesgos ? ', ' + x.riesgos.length + ' riesgos' : '') + ')' : '')); });
      const ns = St.ini.slice(-nuevas.length).reduce((a, x) => a + subfasesDe(x).length, 0);
      toast(nuevas.length + ' iniciativa(s) importada(s), ' + nh + ' hitos, ' + nr + ' riesgos' + (ns ? ', ' + ns + ' subfases' : '') + (avisos.length ? ' · ' + avisos.length + ' aviso(s): ' + avisos.slice(0, 2).join(' | ') : ''), avisos.length ? 'err' : 'ok'); avisos.forEach(a => log('Cambio', '', 'Importación: ' + a)); refresh(); if (avisos.length) Modal.open({ title: 'Avisos de la importación (' + avisos.length + ')', body: '<ul style="margin:0;padding-left:18px;line-height:1.5">' + avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul><p class="mut" style="margin-top:10px">Quedaron registrados en la Bitácora.</p>', footer: '<button class="btn pri" data-act="mclose">Cerrar</button>' }); }, 'Importar');   // N-U-08
  } catch (e) { toast('No se pudo importar: ' + e.message, 'err'); } }; r.readAsText(fl); };
/* V22.52: proyecto <-> archivo (exportar con instrucciones, importar con vista previa) */
const ARCH_TXT = ['titulo', 'desc', 'bc', 'sponsor', 'lider', 'negocio', 'categoria', 'resumen', 'logros', 'proximos', 'issue', 'riesgoTxt'], ARCH_NUM = ['avance', 'presupuesto', 'gastado', 'beneficio'], ARCH_DATE = ['inicioPlan', 'finPlan', 'finEst'];
const archFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && +v.slice(0, 4) >= 1900 && +v.slice(0, 4) <= 2100;   // N-S-03: años 1900-2100
function archPendientes(i) {
  const p = [], hs = hitosDe(i.id), rs = riesgosDe(i.id), um = (0, ENLACES.cfgI)(i, 'umbralCritico');
  [['desc', 'Descripción / objetivo'], ['sponsor', 'Sponsor'], ['lider', 'Líder'], ['negocio', 'Responsable de negocio'], ['inicioPlan', 'Inicio plan'], ['finPlan', 'Fin plan'], ['logros', 'Logros del período'], ['proximos', 'Próximos pasos']].forEach(([k, n]) => { if (!String(i[k] || '').trim()) p.push('Falta: ' + n); });
  if (!(i.presupuesto > 0)) p.push('Falta: presupuesto (si es transversal o sin costo, confirmarlo con el usuario)');
  if (hs.length < 2) p.push('Hitos insuficientes: hay ' + hs.length + ', se requieren al menos 2 (idealmente 3 a 6 por fase)');
  FASES_PRJ.forEach(f => { if (!esProp(i) && !hs.some(h => h.fase === f) && f !== 'Cierre') p.push('Sin hitos en la fase ' + f); });
  hs.filter(h => !h.completado && h.fecha < hoy()).forEach(h => p.push('Hito vencido sin cerrar: ' + h.id + ' «' + h.nombre + '» (' + h.fecha + '): ¿se completó? ¿nueva fecha?'));
  if (!rs.length) p.push('Sin riesgos registrados: preguntar por los 3 a 5 principales (técnico, alcance, recursos, proveedor, cronograma, financiero, regulatorio)');
  rs.filter(r => riesgoAbierto(r) && expo(r) >= um && !String(r.mit || '').trim()).forEach(r => p.push('Riesgo crítico sin mitigación: ' + r.id + ' «' + r.desc + '»'));
  rs.filter(r => riesgoAbierto(r) && r.fRev && r.fRev < hoy()).forEach(r => p.push('Riesgo con revisión vencida: ' + r.id + ' (' + r.fRev + ')'));
  if (i.finPlan && i.finPlan < hoy() && i.estado === 'En curso') p.push('Fin plan vencido (' + i.finPlan + ') y sigue En curso: ¿nueva fecha o está completado?');
  return p;
}
export function archExport(i) {
  const um = (0, ENLACES.cfgI)(i, 'umbralCritico'), pr = {}; [...ARCH_TXT, ...ARCH_NUM, ...ARCH_DATE, 'rag', 'prioridad', 'moneda'].forEach(k => pr[k] = i[k] == null ? (ARCH_NUM.includes(k) ? 0 : '') : i[k]);
  return { formato: 'apih-proyecto-archivo', v: 1, generado: hoy(), proyecto_id: i.id, tipo: i.tipo,
    instrucciones: {
      que_es_esto: 'APIH (Aramark Portfolio Intelligence Hub) gestiona el portafolio de iniciativas de TI de Aramark Chile. Este archivo contiene UN proyecto con sus hitos y riesgos. Tu tarea es ayudar al usuario a completar lo que falta y devolver un JSON que APIH pueda importar.',
      que_es_un_proyecto: 'Un proyecto tiene objetivo, sponsor, líder, presupuesto, fechas plan (inicioPlan, finPlan), avance 0-100, salud RAG, hitos y riesgos. Fases: ' + FASES_PRJ.join(' → ') + '. Estados: ' + ESTADOS_PRJ.join(', ') + '. Un hito es un entregable o punto de control con fecha y responsable. Un riesgo es un evento incierto con probabilidad e impacto (1 a 5); exposición = prob × imp; es crítico si exposición ≥ ' + um + ' y entonces exige plan de mitigación.',
      como_trabajar: ['1) Lee «pendientes»: es la lista de datos que faltan o están inconsistentes.', '2) PREGUNTA al usuario antes de escribir: pide cada dato faltante (objetivo, sponsor, presupuesto, fechas), los hitos por fase con fecha y responsable, y los riesgos principales con probabilidad, impacto, dueño y mitigación. Pregunta por varios a la vez, no uno por uno.', '3) NO inventes cifras, fechas ni nombres. Si el usuario no sabe un dato, déjalo sin cambios y dilo.', '4) Para hitos vencidos pregunta si se completaron (y su fecha real) o si cambia la fecha.', '5) Cuando el usuario confirme, entrega el JSON de vuelta.'],
      formato_de_vuelta: 'Responde SOLO con un bloque JSON válido (sin comentarios ni texto dentro), con esta forma: { "formato": "apih-proyecto-archivo", "v": 1, "proyecto_id": "' + i.id + '", "proyecto": { SOLO los campos que cambian }, "hitos": [ ... ], "riesgos": [ ... ] }. Omite lo que no cambia. No incluyas «instrucciones», «pendientes» ni «catalogos».',
      reglas: ['Fechas en formato YYYY-MM-DD. Números sin separadores ni unidades (presupuesto y gastado en ' + (MONEDAS[i.moneda] || MONEDAS.CLP).n + ').', 'Hito existente: incluye su «id» y solo los campos que cambian. Hito nuevo: sin «id», con «nombre», «fase» y «fecha» obligatorios; «resp» y «completado» opcionales. Si completado=true agrega «fechaReal».', 'Categoría de hito («cat»): ' + hitoCats().join(', ') + ' o vacía.', 'Subfases («subfases»): cada una dentro de UNA fase obligatoria, con inicio y fin dentro de «ventanas_de_fase» (vacíos heredan los de la fase). Existente: con su «id»; nueva: sin «id». «hitos[].subfase»: id o nombre de una subfase de la MISMA fase del hito; vacío la quita.', 'Riesgo existente: incluye «id». Riesgo nuevo: sin «id», con «desc», «cat», «prob», «imp», «dueno», «mit».', 'No elimines ni renombres ids. Nunca cambies «fase» ni «estado» del proyecto: se cambian en la app porque tienen compuertas de validación.', 'Un riesgo abierto con exposición ≥ ' + um + ' debe traer «mit» no vacío o será rechazado.', 'avance debe ser coherente con los hitos completados.']
    },
    catalogos: { rag: RAGS, prioridad: PRIOS, moneda: Object.keys(MONEDAS), fases: FASES_PRJ, riesgo_cat: RISK_CATS, riesgo_estado: RISK_ESTADOS },
    pendientes: archPendientes(i),
    solo_lectura: { fase: i.fase, estado: i.estado, area: i.area, id: i.id },
    proyecto: pr,
    ventanas_de_fase: fasesVentana(i).map(v => ({ fase: v.fase, inicio: v.ini, fin: v.fin })),
    notas_de_fase: fasesDe(i).reduce((o, fx) => { const t = faseNotaP(i, fx); if (t) o[fx] = t; return o; }, {}),
    subfases: subfasesDe(i).map(x => ({ id: x.id, nombre: x.nombre, fase: x.fase, inicio: x.inicio, fin: x.fin, resp: x.resp || '', desc: x.desc || '' })),
    hitos: hitosDe(i.id).sort(by('fecha')).map(h => ({ id: h.id, nombre: h.nombre, cat: h.cat || '', desc: h.desc || '', subfase: h.subfase || '', fase: h.fase, fecha: h.fecha, completado: !!h.completado, fechaReal: h.fechaReal || null, resp: h.resp || '' })),
    riesgos: riesgosDe(i.id).map(r => ({ id: r.id, desc: r.desc, cat: r.cat, prob: r.prob, imp: r.imp, estado: r.estado, dueno: r.dueno || '', fIdent: r.fIdent || '', fRev: r.fRev || '', mit: r.mit || '' })),
    contexto_decisiones: DECS().filter(d => d.ini === i.id).map(d => ({ id: d.id, titulo: d.titulo, estado: d.estado }))
  };
}
Acts.proyarch = d => { const i = byId(d.id); if (!i) return;
  closePops(); Modal.open({ title: 'Completar con archivo · ' + i.id, body: `<p class="desc" style="margin:0 0 6px"><b>${esc(i.titulo)}</b></p><ol class="desc" style="margin:0 0 10px;padding-left:20px;line-height:1.55"><li>Descarga el archivo: trae las instrucciones de completado y los datos pendientes.</li><li>Complétalo con los datos pendientes.</li><li>Sube aquí el JSON completado: verás una vista previa antes de aplicar nada.</li></ol><div class="chips" style="margin:0 0 8px">${btn('Descargar para completar', 'proyarchget', { d: { id: i.id }, ic: 'down', cls: 'pri' })}${btn('Subir archivo completado', 'proyarchup', { d: { id: i.id }, ic: 'up' })}</div><p class="mut">Pendientes hoy: ${archPendientes(i).length}. La fase y el estado no se modifican por esta vía.</p><input type="file" id="archfile" accept="application/json,.json,.txt" style="display:none" data-chg="proyarchf" data-id="${i.id}">`, footer: '<button class="btn" data-act="mclose">Cerrar</button>' }); };
Acts.proyarchget = d => { const i = byId(d.id); if (!i) return; download('APIH_' + i.id + '_para_completar_' + hoy() + '.json', JSON.stringify(archExport(i), null, 1), 'application/json'); toast('Archivo para completar descargado'); };
Acts.proyarchup = d => { const f = $('#archfile'); if (f) { f.dataset.id = d.id; f.value = ''; f.click(); } };
Chg.proyarchf = el => { const fl = el.files[0], id = el.dataset.id; el.value = ''; if (!fl) return;
  const i = byId(id); if (!i) return;
  if ((0, ENLACES.soloLectura)() || !(0, ENLACES.puedeEditarIni)(i)) { toast('Tu rol no permite editar este proyecto', 'err'); return; }
  const r = new FileReader(); r.onload = () => { try {
    let t = String(r.result).trim(); const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) t = m[1].trim();
    const o = JSON.parse(t); if (!o || o.formato !== 'apih-proyecto-archivo') throw new Error('No es un archivo apih-proyecto-archivo');
    if (o.proyecto_id !== i.id) throw new Error('El archivo es de ' + o.proyecto_id + ', no de ' + i.id);
    const ch = [], err = [], ap = [], um = (0, ENLACES.cfgI)(i, 'umbralCritico'), P = o.proyecto || {}, L = (a, b, c) => ch.push(a + ': ' + b + ' → ' + c);
    const ver = x => x === '' || x == null ? '—' : String(x).slice(0, 70);
    Object.keys(P).forEach(k => { const v = P[k], a = i[k];
      if (ARCH_TXT.includes(k)) { if (typeof v !== 'string') return err.push(k + ': debe ser texto'); if (k === 'titulo' && !v.trim()) return err.push('titulo vacío'); if (v !== (a || '')) { L(k, ver(a), ver(v)); ap.push(() => { i[k] = v; }); } }
      else if (ARCH_NUM.includes(k)) { if (typeof v !== 'number' || !isFinite(v) || v < 0 || (k === 'avance' && v > 100)) return err.push(k + ': número inválido (' + v + ')'); if (v !== (a || 0)) { L(k, ver(a || 0), v); ap.push(() => { i[k] = v; if (k === 'avance') i.hist.push([hoy(), v]); }); } }
      else if (ARCH_DATE.includes(k)) { if (v !== null && v !== '' && !archFecha(v)) return err.push(k + ': fecha inválida (' + v + ')'); const nv = v || null; if (nv !== (a || null)) { L(k, ver(a), ver(nv)); ap.push(() => { i[k] = nv; }); } }
      else if (k === 'rag' || k === 'prioridad' || k === 'moneda') { const cat = k === 'rag' ? RAGS : k === 'prioridad' ? PRIOS : Object.keys(MONEDAS); if (!cat.includes(v)) return err.push(k + ': valor inválido (' + v + ')'); if (v !== a) { L(k, ver(a), v); ap.push(() => { i[k] = v; }); } }
      else err.push('Campo no editable por esta vía: ' + k); });
    const ip = P.inicioPlan !== undefined ? P.inicioPlan : i.inicioPlan, fp = P.finPlan !== undefined ? P.finPlan : i.finPlan; if (ip && fp && fp < ip) err.push('finPlan anterior a inicioPlan: no se aplica nada hasta corregir el archivo');
    const bloqueo = ip && fp && fp < ip;
    if (o.notas_de_fase && typeof o.notas_de_fase === 'object' && !Array.isArray(o.notas_de_fase)) Object.keys(o.notas_de_fase).forEach(fx => { const v = o.notas_de_fase[fx]; if (!fasesDe(i).includes(fx)) return err.push('Nota de fase: «' + fx + '» no es una fase de ' + tipoLbl(i).toLowerCase()); if (typeof v !== 'string' || v.length > DESC_MAX) return err.push('Nota de fase ' + fx + ': texto inválido'); if ((faseNotaP(i, fx) || '') !== v) { ch.push('Nota de fase ' + fx); ap.push(() => { i.faseNota = Object.assign({}, i.faseNota); if (v.trim()) i.faseNota[fx] = cutDesc(v.trim()); else delete i.faseNota[fx]; }); } });
    const sfN = [];   // subfases que el archivo crea o cambia (para resolver referencias de hitos al validar)
    (Array.isArray(o.subfases) ? o.subfases : []).forEach(x => { const e0 = err.length; const tmp = { id: i.id, tipo: i.tipo, fase: i.fase, inicioPlan: i.inicioPlan, finPlan: i.finPlan, creada: i.creada, subfases: [] }; sfImportar(Object.assign(tmp, { subfases: [] }), [x], m => err.push(m)); if (err.length > e0) return;
      const w = ventanaDe(i, x.fase) || {}, ex = subfasesDe(i).find(s => (x.id && s.id === x.id) || (s.fase === x.fase && _nrm(s.nombre) === _nrm(x.nombre)));
      sfN.push({ id: ex ? ex.id : null, nombre: x.nombre, fase: x.fase });
      if (ex && ex.nombre === x.nombre && ex.fase === x.fase && ex.inicio === (x.inicio || w.ini) && ex.fin === (x.fin || w.fin) && (x.resp == null || x.resp === (ex.resp || ''))) return;   // sin cambios
      ch.push((ex ? 'Subfase ' + ex.nombre + ': ' : 'Subfase NUEVA: ') + x.nombre + ' · ' + x.fase + ' · ' + rangoTx(x.inicio || w.ini, x.fin || w.fin)); ap.push(() => sfImportar(i, [x], m => toast(m, 'err'))); });
    const sfVal = (ref, fase) => { if (!ref) return ''; const s0 = sfRef(i, ref, fase) || sfN.find(s => s.id === ref || (_nrm(s.nombre) === _nrm(ref) && (!fase || s.fase === fase))) || sfN.find(s => _nrm(s.nombre) === _nrm(ref)); if (!s0) return 'subfase «' + ref + '» no existe'; if (fase && s0.fase !== fase) return 'la subfase «' + s0.nombre + '» es de ' + s0.fase + ' y el hito de ' + fase; return ''; };
    (o.hitos || []).forEach(h => { if (!h || typeof h !== 'object') return;
      if (h.id) { const x = St.hitos.find(y => y.id === h.id); if (!x || x.ini !== i.id) return err.push('Hito ' + h.id + ' no pertenece a este proyecto'); const c = [], e0 = err.length;
        ['nombre', 'fase', 'resp'].forEach(k => { if (h[k] !== undefined && h[k] !== x[k]) { if (typeof h[k] !== 'string' || (k === 'nombre' && !h[k].trim())) return err.push(h.id + '.' + k + ' inválido'); if (k === 'fase' && h[k] && !FASES.includes(h[k])) return err.push(h.id + ': fase inválida'); c.push(k + ' ' + ver(x[k]) + ' → ' + ver(h[k])); } });
        ['fecha', 'fechaReal'].forEach(k => { if (h[k] !== undefined && h[k] !== (x[k] || null)) { if (h[k] !== null && !archFecha(h[k])) return err.push(h.id + '.' + k + ' fecha inválida'); if (k === 'fecha' && !h[k]) return err.push(h.id + '.fecha vacía'); c.push(k + ' ' + ver(x[k]) + ' → ' + ver(h[k])); } });
        if (h.cat !== undefined && (h.cat || '') !== (x.cat || '')) { if (h.cat && !hitoCats().includes(h.cat)) return err.push(h.id + ': categoría inválida (' + h.cat + ')'); c.push('cat ' + ver(x.cat) + ' → ' + ver(h.cat)); }
        if (h.desc !== undefined && (h.desc || '') !== (x.desc || '')) { if (String(h.desc).length > DESC_MAX) return err.push(h.id + ': descripción supera ' + DESC_MAX); c.push('descripción'); }
        if (h.subfase !== undefined && (h.subfase || '') !== (x.subfase || '')) { const e1 = sfVal(h.subfase, h.fase !== undefined ? h.fase : x.fase); if (e1) return err.push(h.id + ': ' + e1); c.push('subfase ' + ver(x.subfase) + ' → ' + ver(h.subfase)); }
        if (h.completado !== undefined && !!h.completado !== !!x.completado) c.push('completado ' + !!x.completado + ' → ' + !!h.completado);
        if (err.length > e0) return;   // A-1: un hito con algún campo inválido se omite completo (F-01)
        if (c.length) { ch.push('Hito ' + h.id + ': ' + c.join('; ')); ap.push(() => { ['nombre', 'fase', 'resp', 'fecha'].forEach(k => { if (h[k] !== undefined) x[k] = h[k]; }); if (h.desc !== undefined) { if (String(h.desc).trim()) x.desc = cutDesc(String(h.desc).trim()); else delete x.desc; } if (h.cat !== undefined) { if (h.cat) x.cat = h.cat; else delete x.cat; } if (h.desc !== undefined) { if (String(h.desc).trim()) x.desc = cutDesc(String(h.desc).trim()); else delete x.desc; } if (h.subfase !== undefined) { const sf = sfRef(i, h.subfase, x.fase); if (sf) x.subfase = sf.id; else delete x.subfase; } if (h.completado !== undefined) { x.completado = !!h.completado; x.fechaReal = x.completado ? (h.fechaReal || x.fechaReal || hoy()) : null; } else if (h.fechaReal !== undefined && x.completado) x.fechaReal = h.fechaReal; }); } }
      else { if (typeof h.nombre !== 'string' || !h.nombre.trim() || !archFecha(h.fecha) || (h.resp !== undefined && typeof h.resp !== 'string') || (h.completado !== undefined && typeof h.completado !== 'boolean')) return err.push('Hito nuevo sin nombre o con fecha inválida: ' + JSON.stringify(h).slice(0, 60)); if (h.fase && !FASES.includes(h.fase)) return err.push('Hito nuevo «' + h.nombre + '»: fase inválida');
        if (St.hitos.some(y => y.ini === i.id && _nrm(y.nombre) === _nrm(h.nombre))) return err.push('Hito nuevo «' + h.nombre + '» ya existe (se omite)');
        if (h.cat && !hitoCats().includes(h.cat)) return err.push('Hito nuevo «' + h.nombre + '»: categoría inválida'); if (h.subfase) { const e2 = sfVal(h.subfase, h.fase || i.fase); if (e2) return err.push('Hito nuevo «' + h.nombre + '»: ' + e2); }
        ch.push('Hito NUEVO: ' + h.nombre + ' · ' + (h.fase || i.fase) + ' · ' + h.fecha); ap.push(() => { const ok = !!h.completado; const nw = { id: nextId('HIT', St.hitos), ini: i.id, nombre: h.nombre, fase: h.fase || i.fase, fecha: h.fecha, completado: ok, fechaReal: ok ? (h.fechaReal || h.fecha) : null, resp: h.resp || i.lider || '' }; if (h.cat) nw.cat = h.cat; if (typeof h.desc === 'string' && h.desc.trim()) nw.desc = cutDesc(h.desc.trim()); const sf = h.subfase && sfRef(i, h.subfase, nw.fase); if (sf) nw.subfase = sf.id; St.hitos.push(nw); }); } });
    (o.riesgos || []).forEach(q => { if (!q || typeof q !== 'object') return; const x = q.id ? St.riesgos.find(y => y.id === q.id) : null; if (q.id && (!x || x.ini !== i.id)) return err.push('Riesgo ' + q.id + ' no pertenece a este proyecto');
      const qq = {}; ['desc', 'cat', 'prob', 'imp', 'estado', 'dueno', 'fIdent', 'fRev', 'mit'].forEach(k => { if (q[k] !== undefined) qq[k] = q[k]; });   // A-1: solo campos de riesgo (sin id/ini)
      if (['desc', 'dueno', 'mit'].some(k => qq[k] !== undefined && typeof qq[k] !== 'string')) return err.push((q.id || 'Riesgo nuevo') + ': texto inválido');
      if (['prob', 'imp'].some(k => qq[k] !== undefined && !(Number.isInteger(qq[k]) && qq[k] >= 1 && qq[k] <= 5))) return err.push((q.id || 'Riesgo nuevo') + ': probabilidad/impacto debe ser entero 1-5');   // N-F-06
      if (['fIdent', 'fRev'].some(k => qq[k] !== undefined && !archFecha(qq[k]))) return err.push((q.id || 'Riesgo nuevo') + ': fecha inválida');   // N-F-06
      const v = Object.assign({}, x || { cat: 'Técnico', prob: 3, imp: 3, estado: 'Abierto', dueno: i.lider || '', fIdent: hoy(), fRev: addD(hoy(), 30), mit: '' }, qq);
      if (!x && !String(q.desc || '').trim()) return err.push('Riesgo nuevo sin descripción'); if (!RISK_CATS.includes(v.cat)) return err.push((q.id || 'Riesgo nuevo') + ': categoría inválida'); if (!RISK_ESTADOS.includes(v.estado)) return err.push((q.id || 'Riesgo nuevo') + ': estado inválido');
      if (![v.prob, v.imp].every(n => Number.isInteger(n) && n >= 1 && n <= 5)) return err.push((q.id || 'Riesgo nuevo') + ': prob e imp deben ser enteros 1-5');
      if (['fIdent', 'fRev'].some(k => v[k] && !archFecha(v[k]))) return err.push((q.id || 'Riesgo nuevo') + ': fecha inválida');
      if (riesgoAbierto(v) && v.prob * v.imp >= um && !String(v.mit || '').trim()) return err.push((q.id || 'Riesgo nuevo «' + String(v.desc).slice(0, 30) + '»') + ': crítico sin mitigación (se omite)');
      if (x) { const c = ['desc', 'cat', 'prob', 'imp', 'estado', 'dueno', 'fRev', 'mit'].filter(k => v[k] !== (x[k] || (typeof v[k] === 'number' ? 0 : ''))).map(k => k + ' ' + ver(x[k]) + ' → ' + ver(v[k])); if (c.length) { ch.push('Riesgo ' + q.id + ': ' + c.join('; ')); ap.push(() => Object.assign(x, v)); } }
      else { ch.push('Riesgo NUEVO: ' + v.desc + ' · ' + v.prob + '×' + v.imp); ap.push(() => St.riesgos.push({ id: nextId('RSK', St.riesgos), ini: i.id, ...v })); } });
    if (!ch.length) { Modal.close && Modal.close(); toast(err.length ? 'Sin cambios válidos. ' + err.slice(0, 3).join(' | ') : 'El archivo no trae cambios', 'err'); return; }
    if (bloqueo) { Modal.close && Modal.close(); toast('Archivo rechazado: finPlan es anterior a inicioPlan. Corrígelo y súbelo de nuevo (no se aplicó nada)', 'err'); return; }   /* N-U-06 */
    const lst = ch.slice(0, 40).map(x => '• ' + esc(x)).join('<br>') + (ch.length > 40 ? '<br>… y ' + (ch.length - 40) + ' más' : '');
    confirmBox('<b>Revisar cambios del archivo</b><br>' + ch.length + ' cambio(s) propuesto(s) en ' + esc(i.titulo) + ' (formato: campo: antes → después):<br><br>' + lst + (err.length ? '<br><br><b style="color:var(--red)">Se omiten ' + err.length + ':</b><br>' + err.slice(0, 15).map(x => '✕ ' + esc(x)).join('<br>') : '') + '<br><br>¿Aplicar?', () => {
      if (bloqueo) { toast('finPlan anterior a inicioPlan: corrige el archivo', 'err'); return; }
      ap.forEach(f => f()); i.actualizada = hoy(); log('Cambio', i.id, 'Completado con archivo: ' + ch.length + ' cambio(s) aplicados desde archivo'); toast(ch.length + ' cambio(s) aplicados'); refresh(); }, 'Aplicar');
  } catch (e) { toast(e instanceof SyntaxError ? 'El archivo no es un JSON válido' : 'No se pudo leer: ' + e.message, 'err'); } }; r.readAsText(fl); };
Acts.reset = () => confirmBox(DataService.svc ? 'Se reemplazarán TODOS los datos de ' + BK() + ' por los datos del archivo original. ¿Continuar?' : 'Se perderán los cambios y se restaurarán los datos de demostración. ¿Continuar?', () => { ENLACES.St = seedState(); UI.sel = null; shell(); toast('Datos restaurados'); refresh(); }, 'Restaurar', true);


/* ---------- Administración → Conexión ---------- */
function spTab() {
  const d = DataService, i = syncInfo(), c = APIH_CONFIG, u = AuthService.user();
  const host = (() => { try { return new URL(c.supabase.url).hostname; } catch (e) { return '—'; } })();
  const mode = d.svc ? 'Servidor (Supabase)' : 'Demo (memoria)';
  const schema = Object.keys(ESQUEMA).map(e => { const S = ESQUEMA[e]; return `<details class="sch"><summary>${esc(c[S.cfg])} <span class="mut">· ${S.label} · ${S.cols.length + 1} columnas</span></summary><div class="tbl-w"><table class="tbl"><thead><tr><th>Columna</th><th>Tipo</th><th>Campo de dominio</th><th>Detalle</th></tr></thead><tbody>${S.cols.map(x => `<tr><td class="mono">${x.n}${x.n === 'Title' ? ' <span class="mut">(' + esc(S.title) + ')</span>' : ''}</td><td>${x.t}</td><td class="mono">${x.k || '—'}</td><td>${x.ch ? esc(x.ch.join(' · ')) : x.rw ? 'editable fuera de la app' : x.get ? 'calculada' : 'clave'}</td></tr>`).join('')}<tr><td class="mono">DatosJSON</td><td>Note</td><td class="mono">(objeto completo)</td><td>Conserva campos sin columna propia</td></tr></tbody></table></div></details>`; }).join('') +
    `<details class="sch"><summary>${esc(c.settingsList)} <span class="mut">· Config · 2 columnas</span></summary><p class="desc">Title = clave (${SETTINGS_KEYS.join(', ')}) · DatosJSON = valor. El usuario actual y el filtro de área son de sesión y no se comparten.</p></details>`;
  const lista = (et, nom) => `<tr><td>${esc(et)}</td><td class="mono">${esc(nom)}</td></tr>`;
  return `<div class="grid12"><section class="card c7"><header><h2>Conexión a Supabase</h2><small><span class="dot-s ${i.c}"></span> ${esc(i.t)} · ${mode}</small></header>
    <div class="note ${d.svc ? '' : 'warn'}">${icon('db', 14)}<span>${d.svc ? 'Conectado. Los cambios se sincronizan solos (registro por registro, con reintentos y detección de conflictos). ' + (d.st.last ? 'Último sync: ' + d.st.last.toTimeString().slice(0, 8) + '.' : '') : esc(i.tip)}</span></div>
    <div class="fgrid sp-fg"><div class="fld"><label>Proyecto</label><input value="${esc(host)}" readonly></div><div class="fld"><label>Sesión</label><input value="${esc(u ? u.email : 'sin sesión')}" readonly></div>
    <div class="fld"><label>Refresco automático (s)</label><input value="${esc(c.pollSec)}" data-chg="spc" data-p="pollSec" data-key="sp-pollSec"><small>0 = desactivado</small></div></div>
    <div class="chips" style="margin-top:12px">${btn('Conectar / recargar', 'spconnect', { ic: 'refresh', cls: 'pri' })}${btn('Probar conexión', 'sptest', { ic: 'check' })}${btn('Cargar datos del archivo', 'spseed', { ic: 'down' })}${btn('Sincronizar ahora', 'spsync', { ic: 'refresh' })}${u ? btn('Cerrar sesión (' + u.name + ')', 'splogout', { ic: 'lock' }) : btn('Iniciar sesión', 'login', { ic: 'lock' })}</div>
    <div class="logbox" id="splog" style="margin-top:12px">${esc(UI.splog || 'Sin actividad. Use “Probar conexión” para validar el acceso a las listas.')}</div></section>
    <section class="card c5"><header><h2>Listas</h2><small>Fijas: coinciden con las reglas del servidor</small></header><div class="tbl-w"><table class="tbl"><thead><tr><th>Contenido</th><th>Lista</th></tr></thead><tbody>${lista('Proyectos', c.projectsList)}${lista('Propuestas', c.proposalsList)}${lista('Riesgos', c.risksList)}${lista('Hitos', c.milestonesList)}${lista('Decisiones', c.decisionsList)}${lista('Bitácora (auditoría)', c.auditList)}${lista('Comités', c.committeesList)}${lista('Configuración', c.settingsList)}${lista('Roles y usuarios', c.rolesList)}</tbody></table></div>
    <p class="mut" style="font-size:12px;margin-top:10px">Las tablas, políticas y comandos del servidor se crean con las migraciones de <b>supabase/migrations</b>. La autorización por rol, área y monto se aplica en el servidor, no en esta pantalla.</p></section></div>
    <section class="card"><header><h2>Esquema de entidades</h2><small>ID de dominio = Title (Riesgos, Decisiones, Bitácora) o Codigo (Proyectos, Hitos, Comités)</small></header>${schema}</section>`;
}
Chg.spc = el => { if (el.dataset.p === 'pollSec') { APIH_CONFIG.pollSec = Math.max(0, +el.value || 0); DataService.startPoll(); } };
const splog = t => { UI.splog = t; const b = $('#splog'); if (b) b.textContent = t; };
Acts.sptest = async () => { splog('Probando…'); try { splog((await DataService.testConnection()).join('\n')); } catch (e) { splog('✘ ' + e.message); } };
Acts.spconnect = async () => {
  splog('Conectando…'); if (DataService.svc) await DataService.flush();
  const S = await DataService.init(); ENLACES.St = S; UI.sel = null; shell(); render();
  splog(DataService.svc ? '✔ Conectado a Supabase · ' + St.ini.length + ' proyectos, ' + St.riesgos.length + ' riesgos, ' + St.hitos.length + ' hitos.' : '✘ ' + (DataService.offlineWhy || DataService.st.err || 'Modo demo'));
};
Acts.spsync = async () => { if (!DataService.svc) return toast('Sin conexión a ' + BK(), 'err'); await DataService.flush(); await DataService.refresh(false, true); };
Acts.splogout = async () => { try { await AuthService.logout(); } catch (e) { } const S = await DataService.init(); ENLACES.St = S; shell(); render(); };

/* ============================================================
   APIH · Administración → Metodología
   Fases del workflow y tipos de iniciativa con sus hitos tipo.
   Las nuevas propuestas/proyectos se guían por esta parametrización.
   ============================================================ */
export const MET = () => St.cfg.metodo || (St.cfg.metodo = METODO_DEF());
const metTipoSel = () => { const f = F('adm', {}), m = MET(); return m.tipos.find(t => t.id === f.tipo) || m.tipos[0] || null; };
const enUso = fase => St.ini.filter(i => i.fase === fase).length;
function metTab() {
  const m = MET(), t = metTipoSel(), allF = [...m.fasesProp, ...m.fasesPrj];
  const fasesCard = (w, titulo, lista) => `<section class="card c6"><header><h2>${titulo}</h2><small>${lista.length} fases · las marcadas con candado son base del gobierno</small></header>
    <div class="met-f">${lista.map((x, n) => { const fix = FASES_FIJAS.includes(x), ext = n === 0 || n === lista.length - 1, u = enUso(x); return `<div class="met-r"><i style="background:${FASE_COLOR[x] || '#8A8886'}"></i>
      <input value="${esc(x)}" ${fix ? 'disabled' : ''} data-chg="fasren" data-live="no" data-w="${w}" data-n="${n}" data-key="mf-${w}-${n}" aria-label="Nombre de fase"><input class="met-d" maxlength="500" value="${esc((m.faseDesc || {})[x] || '')}" data-chg="fasdesc" data-f="${esc(x)}" data-key="mfd-${w}-${n}" placeholder="Descripción (opcional, se ve en Mi cocina, la ficha y Fases; máx. 500)" aria-label="Descripción de la fase">
      <span class="mut">${fix ? icon('lock', 12) : ''} ${u ? u + ' en curso' : ''}</span>
      <button class="btn sm" ${ext ? 'disabled' : ''} data-act="fasmv" data-w="${w}" data-n="${n}" data-d="-1" title="Subir" aria-label="Subir">↑</button><button class="btn sm" ${ext ? 'disabled' : ''} data-act="fasmv" data-w="${w}" data-n="${n}" data-d="1" title="Bajar" aria-label="Bajar">↓</button>
      <button class="btn sm danger" ${fix ? 'disabled' : ''} data-act="fasdel" data-w="${w}" data-n="${n}" title="Eliminar fase" aria-label="Eliminar">×</button></div>`; }).join('')}</div>
    <div class="met-add"><input id="newf_${w}" placeholder="Nueva fase (se inserta antes de «${lista[lista.length - 1]}»)" data-key="mf-new-${w}">${btn('Agregar fase', 'fasadd', { ic: 'plus', d: { w } })}</div></section>`;
  const hs = t ? t.hitos.map((h, n) => ({ h, n })) : [];
  const ord = x => allF.indexOf(x.h.fase);
  hs.sort((a, b) => ord(a) - ord(b) || (+a.h.dias) - (+b.h.dias));
  const sub = F('adm', {}).mt || 'fases';
  const subtabs = `<div class="seg" style="margin-bottom:10px">${[['fases', 'Fases del workflow'], ['tipos', 'Tipos de iniciativa e hitos']].map(([k, l]) => `<button class="${sub === k ? 'on' : ''}" data-act="mtsub" data-k="${k}">${l}</button>`).join('')}</div>
    <p class="desc" style="margin:0 0 10px">Lo que defines aquí guía a todas las propuestas y proyectos nuevos: al elegir el tipo se precargan sus hitos con fecha, y al avanzar de fase se exige cerrar los hitos de la fase que se deja.</p>`;
  if (sub === 'fases') return subtabs + `<div class="grid12">${fasesCard('prop', 'Fases de propuesta', m.fasesProp)}${fasesCard('prj', 'Fases de proyecto', m.fasesPrj)}</div>
    <div class="chips">${btn('Restablecer metodología sugerida', 'metreset', { ic: 'undo', cls: 'danger' })}</div>`;
  return subtabs + `
    <div class="card"><header><h2>Tipos de iniciativa</h2><small>${m.tipos.length} tipos</small></header>
      <div class="chips">${m.tipos.map(x => `<button class="chip ${t && x.id === t.id ? 'on' : ''}" style="--c:#0D446A" data-act="tiposel" data-id="${x.id}">${esc(x.nombre)} <small>${x.hitos.length}</small></button>`).join('')}
        <span class="met-add inl"><input id="newtipo" placeholder="Nuevo tipo…" data-key="mt-new">${btn('Agregar tipo', 'tipoadd', { ic: 'plus' })}</span></div>
      ${t ? `<div class="fgrid" style="margin-top:12px"><div class="fld"><label>Nombre del tipo</label><input value="${esc(t.nombre)}" data-chg="tipoedit" data-k="nombre" data-key="mt-n"></div>
        <div class="fld w2"><label>Descripción</label><input value="${esc(t.desc || '')}" data-chg="tipoedit" data-k="desc" data-key="mt-d"></div></div>
      <div class="tbl-w" style="margin-top:10px;max-height:calc(100vh - 560px);min-height:110px"><table class="tbl"><thead><tr><th>Fase</th><th>Hito tipo</th><th>Días desde el inicio</th><th></th></tr></thead><tbody>
      ${hs.map(({ h, n }) => `<tr><td><select data-chg="hitoedit" data-n="${n}" data-k="fase">${selOpts(allF, h.fase)}</select></td>
        <td style="white-space:normal"><input style="width:100%;min-width:220px" value="${esc(h.n)}" data-chg="hitoedit" data-n="${n}" data-k="n" data-key="mh-${n}"></td>
        <td><input type="number" style="width:80px" value="${+h.dias || 0}" data-chg="hitoedit" data-n="${n}" data-k="dias" data-key="mhd-${n}"></td>
        <td><button class="btn sm danger" data-act="hitodel" data-n="${n}" aria-label="Quitar hito">×</button></td></tr>`).join('') || '<tr><td colspan="4" class="mut">Sin hitos: agrega el primero abajo.</td></tr>'}
      </tbody></table></div>
      <div class="met-add"><select id="newh_f">${selOpts(allF, '')}</select><input id="newh_n" placeholder="Nuevo hito tipo…" data-key="mh-new"><input id="newh_d" type="number" value="30" style="width:90px" title="Días desde el inicio. En fases de propuesta se cuentan desde la creación; en fases de proyecto, desde el Inicio plan">${btn('Agregar hito', 'hitoadd', { ic: 'plus' })}
        <span style="flex:1"></span>${btn('Duplicar tipo', 'tipodup', { ic: 'copy' })}${btn('Eliminar tipo', 'tipodel', { ic: 'trash', cls: 'danger' })}</div>` : '<p class="mut">Agrega un tipo para comenzar.</p>'}
    </div>
`;
}
Chg.fasdesc = el => { const m = MET(); m.faseDesc = m.faseDesc || {}; const raw = el.value.trim(), v = cutDesc(raw); if (raw.length > DESC_MAX) toast('La descripción se recortó a ' + DESC_MAX + ' caracteres', 'err'); if (v) m.faseDesc[el.dataset.f] = v; else delete m.faseDesc[el.dataset.f]; save(); };
Acts.mtsub = d => { F('adm', {}).mt = d.k; render(); };
Acts.tiposel = d => { F('adm', {}).tipo = d.id; render(); };
Acts.tipoadd = () => { const el = $('#newtipo'), v = el.value.trim(); if (!v) return toast('Escribe el nombre del tipo', 'err'); const m = MET(); if (m.tipos.some(x => x.nombre.toLowerCase() === v.toLowerCase())) return toast('Ya existe un tipo con ese nombre', 'err'); const id = nextId('T', m.tipos); m.tipos.push({ id, nombre: v, desc: '', hitos: [] }); F('adm', {}).tipo = id; refresh(); };
Acts.tipodup = () => { const t = metTipoSel(); if (!t) return; const m = MET(), id = nextId('T', m.tipos); m.tipos.push({ id, nombre: t.nombre + ' (copia)', desc: t.desc, hitos: clone(t.hitos) }); F('adm', {}).tipo = id; refresh(); };
Acts.tipodel = () => { const t = metTipoSel(); if (!t) return; const u = St.ini.filter(i => i.tipoIni === t.nombre).length; confirmBox(`¿Eliminar el tipo <b>${esc(t.nombre)}</b>?` + (u ? ` ${u} iniciativa(s) lo tienen asignado; conservan su hito pero quedan sin plantilla.` : ''), () => { const m = MET(); m.tipos = m.tipos.filter(x => x.id !== t.id); F('adm', {}).tipo = null; refresh(); }, 'Eliminar', true); };
Chg.tipoedit = el => { const t = metTipoSel(); if (!t) return; const k = el.dataset.k, v = el.value.trim(); if (k === 'nombre') { if (!v) return render(); if (MET().tipos.some(x => x !== t && x.nombre.toLowerCase() === v.toLowerCase())) { toast('Ya existe un tipo con ese nombre', 'err'); return render(); } St.ini.forEach(i => { if (i.tipoIni === t.nombre) i.tipoIni = v; }); } t[k] = v; refresh(); };
Chg.hitoedit = el => { const t = metTipoSel(); if (!t) return; const h = t.hitos[+el.dataset.n], k = el.dataset.k; if (!h) return; if (k === 'n' && !el.value.trim()) return render(); h[k] = k === 'dias' ? (parseInt(el.value, 10) || 0) : el.value.trim(); refresh(); };
Acts.hitoadd = () => { const t = metTipoSel(); if (!t) return; const n = $('#newh_n').value.trim(); if (!n) return toast('Escribe el nombre del hito', 'err'); t.hitos.push({ n, fase: $('#newh_f').value || [...MET().fasesProp, ...MET().fasesPrj][0], dias: parseInt($('#newh_d').value, 10) || 0 }); refresh(); };
Acts.hitodel = d => { const t = metTipoSel(); if (!t) return; t.hitos.splice(+d.n, 1); refresh(); };
Acts.fasadd = d => {
  const el = $('#newf_' + d.w), v = el.value.trim(), m = MET(), L = d.w === 'prop' ? m.fasesProp : m.fasesPrj;
  if (!v) return toast('Escribe el nombre de la fase', 'err'); if ([...m.fasesProp, ...m.fasesPrj].some(x => x.toLowerCase() === v.toLowerCase())) return toast('Ya existe una fase con ese nombre', 'err');
  L.splice(L.length - 1, 0, v); refresh(); toast('Fase «' + v + '» agregada');
};
Acts.fasdel = d => {
  const m = MET(), L = d.w === 'prop' ? m.fasesProp : m.fasesPrj, x = L[+d.n]; if (!x || FASES_FIJAS.includes(x)) return;
  if (enUso(x)) return toast(`Hay ${enUso(x)} iniciativa(s) en «${x}»: muévelas de fase antes de eliminarla`, 'err');
  const prev = L[+d.n - 1];
  confirmBox(`¿Eliminar la fase <b>${esc(x)}</b>? Los hitos tipo de esa fase pasan a «${esc(prev)}».`, () => { L.splice(+d.n, 1); m.tipos.forEach(t => t.hitos.forEach(h => { if (h.fase === x) h.fase = prev; })); St.hitos.forEach(h => { if (h.fase === x) h.fase = prev; }); refresh(); }, 'Eliminar', true);
};
Acts.fasmv = d => { const m = MET(), L = d.w === 'prop' ? m.fasesProp : m.fasesPrj, n = +d.n, k = n + (+d.d); if (n <= 0 || n >= L.length - 1 || k <= 0 || k >= L.length - 1) return; [L[n], L[k]] = [L[k], L[n]]; refresh(); };
Chg.fasren = el => {
  const m = MET(), L = el.dataset.w === 'prop' ? m.fasesProp : m.fasesPrj, n = +el.dataset.n, old = L[n], v = el.value.trim();
  if (!v || v === old) return render(); if (FASES_FIJAS.includes(old)) return render();
  if ([...m.fasesProp, ...m.fasesPrj].some(x => x.toLowerCase() === v.toLowerCase())) { toast('Ya existe una fase con ese nombre', 'err'); return render(); }
  L[n] = v; FASE_COLOR[v] = FASE_COLOR[old];
  // N-U-02: al renombrar, migrar también subfases, notas de fase y descripción global (antes quedaban huérfanas)
  St.ini.forEach(i => { if (i.fase === old) i.fase = v; subfasesDe(i).forEach(sf => { if (sf.fase === old) sf.fase = v; }); if (i.faseNota && i.faseNota[old] !== undefined) { i.faseNota[v] = i.faseNota[old]; delete i.faseNota[old]; } });
  if (m.faseDesc && m.faseDesc[old] !== undefined) { m.faseDesc[v] = m.faseDesc[old]; delete m.faseDesc[old]; }
  St.hitos.forEach(h => { if (h.fase === old) h.fase = v; }); m.tipos.forEach(t => t.hitos.forEach(h => { if (h.fase === old) h.fase = v; })); refresh();
};
Acts.metreset = () => confirmBox('Se restablecen fases y tipos a la metodología sugerida. Las iniciativas en fases personalizadas pasan a la fase anterior base. ¿Continuar?', () => {
  const def = METODO_DEF(), keep = new Set([...def.fasesProp, ...def.fasesPrj]);
  St.ini.forEach(i => { if (!keep.has(i.fase)) i.fase = esProp(i) ? 'Evaluación' : 'Ejecución'; }); St.hitos.forEach(h => { if (h.fase && !keep.has(h.fase)) h.fase = ''; });
  St.cfg.metodo = def; F('adm', {}).tipo = null; refresh(); toast('Metodología restablecida');
}, 'Restablecer', true);

/* ============================================================
   APIH · Herramientas del jefe de proyecto
   1) Actualización semanal en 60 segundos + informe de estado
   2) Compromisos y acuerdos (debo / me deben)
   3) Resumen de mi semana (para correo / recordatorio)
   4) Control de cambios con línea base
   ============================================================ */
const GEN_OPT = { v: '', t: 'General (sin iniciativa)' };
export const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const MIN_DIAS_RONDA = 6;
function copiarTxt(txt) {
  const ok = () => toast('Copiado al portapapeles');
  const fb = () => { const t = document.createElement('textarea'); t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('No se pudo copiar; selecciona el texto manualmente', 'err'); } t.remove(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fb); else fb();
}
Acts.copiartxt = () => { const el = $('#txtcopy'); if (el) copiarTxt(el.value); };

/* ------------------------------------------------------------------
   1) ACTUALIZACIÓN SEMANAL
   ------------------------------------------------------------------ */
export const rondaIds = () => { const me = miUsuario(); return St.ini.filter(i => !esProp(i) && i.lider === me && isLive(i) && FASES_ACT.includes(i.fase) && diasSinUpd(i) > MIN_DIAS_RONDA && inArea(i)).sort(by(i => i.actualizada || '')).map(i => i.id); };
const avanceHitos = i => { const hs = hitosDe(i.id); if (!hs.length) return null; const d = hs.filter(h => h.completado).length; return { v: Math.round(d / hs.length * 100), d, n: hs.length }; };
Acts.ronda = () => { const q = rondaIds(); if (!q.length) return toast('Todos tus proyectos están al día', 'ok'); UI.wkq = q.slice(1); UI.wkn = q.length; Acts.wk({ id: q[0], first: '1' }); };
function wkNext() { const nx = (UI.wkq || []).shift(); if (nx) setTimeout(() => Acts.wk({ id: nx }), 60); else { UI.wkq = null; UI.wkn = 0; } }
Acts.wk = d => {
  const i = byId(d.id); if (!i || esProp(i)) return;
  if ((0, ENLACES.soloLectura)() || !(0, ENLACES.puedeEditarIni)(i)) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  if (!d.first && !UI.wkq) UI.wkn = 0;
  const sg = ragSugerido(i), ah = avanceHitos(i), fc = forecast(i), dv = desv(i), q = UI.wkq, pos = UI.wkn ? UI.wkn - (q ? q.length : 0) : 0;
  const abiertos = ACUERDOS().filter(a => a.ini === i.id && a.estado === 'Abierto');
  const v = { avance: i.avance || 0, rag: i.rag, logros: '', proximos: i.proximos || '', issue: i.issue || '', finEst: i.finEst || i.finPlan || '' };
  const use = (f, val, txt) => `<a class="lnk" data-act="wkset" data-f="${f}" data-v="${esc(val)}">${txt}</a>`;
  openForm({
    title: (pos ? `Actualización semanal (${pos} de ${UI.wkn}) · ` : 'Actualización semanal · ') + i.titulo, values: v, saveLabel: pos && q && q.length ? 'Guardar y siguiente' : 'Guardar',
    fields: [
      { k: 'avance', l: 'Avance (%)', t: 'range', w: 1, hint: ah ? `Hitos: ${ah.d} de ${ah.n} cerrados = ${ah.v}% · ${use('avance', ah.v, 'usar')}` : 'Sin hitos: define hitos para sugerir el avance' },
      { k: 'rag', l: 'Salud (RAG)', t: 'select', opts: RAGS, w: 1, hint: `Reglas sugieren <b>${sg.rag}</b>${sg.why.length ? ' (' + esc(sg.why.join(', ')) + ')' : ''} · ${use('rag', sg.rag, 'usar')}` },
      { k: 'finEst', l: 'Fin estimado', t: 'date', w: 1, hint: fc && i.finPlan && fc > i.finPlan ? `Pronóstico ${dv} d sobre la línea base · <a class="lnk" data-act="chgnew" data-id="${i.id}">registrar cambio</a>` : '' },
      { k: 'logros', l: 'Logros de la semana', t: 'textarea', w: 3, hint: i.proximos ? `Lo prometido: «${esc(cut(i.proximos, 140))}» · <a class="lnk" data-act="wkpass">pasar a logros</a>` : '' },
      { k: 'proximos', l: 'Próximos pasos', t: 'textarea', w: 3 },
      { k: 'issue', l: 'Issue o bloqueo actual', w: 3 }
    ],
    extra: `<div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap"><a class="lnk" data-act="wknc" data-id="${i.id}">✓ Sin novedades: solo confirmar que sigue vigente</a><a class="lnk" data-act="informe" data-id="${i.id}">Ver informe de estado</a><a class="lnk" data-act="acunew" data-id="${i.id}">+ Compromiso</a></div>${abiertos.length ? `<div class="note" style="margin-top:8px"><span><b>Compromisos abiertos (${abiertos.length}):</b> ${abiertos.slice(0, 4).map(a => esc(cut(a.texto, 50)) + ' — ' + esc(a.resp || 's/r') + (a.limite ? ' (' + fmtD(a.limite) + ')' : '')).join(' · ')}</span></div>` : ''}`,
    onSave(o) {
      const b0 = (0, ENLACES.cieloOn)() ? (0, ENLACES.estrellasOn)(i) : null, diffs = [];
      if (+o.avance !== +i.avance) diffs.push(`Avance ${i.avance}% → ${o.avance}%`);
      if (o.rag !== i.rag) diffs.push(`RAG ${i.rag} → ${o.rag}`);
      if ((o.finEst || '') !== (i.finEst || '')) diffs.push(`Fin estimado ${fmtD(i.finEst)} → ${fmtD(o.finEst)}`);
      if (+o.avance !== +i.avance || !i.hist.length || i.hist[i.hist.length - 1][0] !== hoy()) i.hist.push([hoy(), +o.avance]);
      const patch = { avance: +o.avance, rag: o.rag, finEst: o.finEst || i.finEst, logros: o.logros || i.logros, proximos: o.proximos, issue: o.issue };
      Object.assign(i, patch, { actualizada: hoy(), est: (i.est || []).filter(k => k !== 'all' && String(i[k]) === String(patch[k])) }); snapFases(i);
      log('Actualización', i.id, 'Actualización semanal' + (diffs.length ? ': ' + diffs.join('; ') : ': sin cambios de indicadores') + (o.logros ? '. Logros: ' + o.logros : '') + (o.proximos ? '. Próximos: ' + o.proximos : '') + (o.issue ? '. Issue: ' + o.issue : ''));
      toast('Actualización guardada'); refresh(); (0, ENLACES.celebrar)(i, b0); wkNext();
    }
  });
};
Acts.wkset = d => { const el = $('#f_' + d.f); if (!el) return; el.value = d.v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
Acts.wkpass = () => { const t = $('#f_logros'), p = $('#f_proximos'); if (!t || !p) return; t.value = (t.value ? t.value + '\n' : '') + p.value.trim(); };
Acts.wknc = d => {
  const i = byId(d.id); if (!i) return; Modal.close(); const b0 = (0, ENLACES.cieloOn)() ? (0, ENLACES.estrellasOn)(i) : null;
  if (!i.hist.length || i.hist[i.hist.length - 1][0] !== hoy()) i.hist.push([hoy(), i.avance]);
  snapFases(i); i.actualizada = hoy(); log('Actualización', i.id, 'Actualización semanal: sin novedades, el proyecto sigue vigente'); toast('Confirmado: sin novedades'); refresh(); (0, ENLACES.celebrar)(i, b0); wkNext();
};
/* informe de estado listo para copiar */
export function informeTxt(i) {
  const f = forecast(i), hs = hitosDe(i.id), prox = hs.filter(h => !h.completado).sort(by('fecha')).slice(0, 5), cr = riesgosDe(i.id).filter(r => riesgoAbierto(r)).sort(by(r => -expo(r))).slice(0, 3);
  const ac = ACUERDOS().filter(a => a.ini === i.id && a.estado === 'Abierto'), cp = CAMBIOS().filter(c => c.ini === i.id && c.estado === 'Solicitado'), ca = CAMBIOS().filter(c => c.ini === i.id && c.estado === 'Aprobado');
  const L = [`INFORME DE ESTADO · ${i.titulo} (${i.id})`, `Fecha: ${fmtD(hoy())} · Líder: ${i.lider || '—'} · Sponsor: ${i.sponsor || '—'} · Fase: ${i.fase} · Salud: ${i.rag || '—'}`, ''];
  if (!esProp(i)) L.push(`Avance: ${i.avance}% (esperado ${Math.round(esperado(i))}%) · Fin plan ${fmtD(i.finPlan)} → proyectado ${fmtD(f)}${desv(i) ? ' (+' + desv(i) + ' d)' : ''} · Presupuesto ${fmtMon(i.presupuesto, monOf(i))}, consumido ${fmtMon(i.gastado, monOf(i))}`, '');
  L.push('LOGROS', i.logros || '—', '', 'PRÓXIMOS PASOS', i.proximos || '—', '');
  if (i.issue) L.push('ISSUE / BLOQUEO', i.issue, '');
  L.push('PRÓXIMOS HITOS', ...(prox.length ? prox.map(h => `- ${h.nombre} · ${fmtD(h.fecha)}${h.fecha < hoy() ? ' (VENCIDO)' : ''}${h.resp ? ' · ' + h.resp : ''}`) : ['—']), '');
  if (cr.length) L.push('RIESGOS PRINCIPALES', ...cr.map(r => `- ${r.desc} (exposición ${expo(r)})${r.mit ? ' · mitigación: ' + r.mit : ''}`), '');
  if (ac.length) L.push('COMPROMISOS ABIERTOS', ...ac.map(a => `- ${a.texto} · ${a.resp || 's/r'}${a.limite ? ' · ' + fmtD(a.limite) : ''}`), '');
  if (cp.length) L.push('CAMBIOS PENDIENTES DE APROBACIÓN', ...cp.map(c => `- ${c.id} ${c.tipo}: ${c.desc}`), '');
  if (ca.length) L.push(`Cambios de línea base aprobados: ${ca.length}`);
  return L.join('\n').trim();
}
Acts.informe = d => {
  const i = byId(d.id); if (!i) return; const t = informeTxt(i);
  Modal.open({ title: 'Informe de estado · ' + i.titulo, wide: true, body: `<p class="desc" style="margin-top:0">Se arma con lo último que registraste. Cópialo y pégalo en un correo o en Teams.</p><textarea id="txtcopy" readonly rows="18" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(t)}</textarea>`, footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn pri" data-act="copiartxt">${icon('copy', 14)}<span>Copiar</span></button>` });
};

/* ------------------------------------------------------------------
   V22.66 · Reporte de avance de la ficha (infografía HTML)
   Forma A: una fase activa (hitos contractuales, pendientes) · Forma B: múltiples hitos y fases paralelas (subfases).
   Se elige sola (B si hay 2+ subfases activas en la fase actual) y se puede forzar. Todo sale de la ficha; nada se escribe a mano aquí.
   ------------------------------------------------------------------ */
const REP_ST = { 'Verde': 'EN PLAN', 'Ámbar': 'EN RIESGO', 'Rojo': 'ATRASADO' };      // estado = RAG manual
const repFmt = (iso, long) => { if (!iso) return ''; const p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + (long ? p[0] : p[0].slice(2)); };
const repLines = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
const repDia = iso => ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'][pD(iso).getDay()] + ' ' + repFmt(iso).slice(0, 5);
/* avance de fase y de cada subfase en cada actualización: alimenta el «↑ desde» del reporte */
export function snapFases(i) {
  if (!i || esProp(i)) return;
  const m = {}; m['F:' + i.fase] = avFase(i).v;
  subfasesDe(i).forEach(s => { const hs = hitosSub(i, s), d = hs.filter(h => h.completado).length; m['s:' + s.id] = hs.length ? Math.round(d / hs.length * 100) : 0; });
  i.snapFase = (i.snapFase || []).filter(x => x[0] !== hoy()); i.snapFase.push([hoy(), m]); if (i.snapFase.length > 26) i.snapFase = i.snapFase.slice(-26);
}
const repPrev = (i, key) => { const s = (i.snapFase || []).filter(x => x[0] < hoy()).slice(-1)[0]; return s && s[1] && s[1][key] != null ? s[1][key] : ''; };
const repSubsActivas = i => subfasesDe(i).filter(s => s.fase === i.fase && s.inicio <= hoy() && (s.fin >= hoy() || hitosSub(i, s).some(h => !h.completado))).sort(by('inicio'));
const repFormaAuto = i => repSubsActivas(i).length >= 2 ? 'B' : 'A';
export function repDatos(i) {
  const hs = hitosDe(i.id).slice().sort(by('fecha')), n = hs.length || 1;
  const conPeso = hs.length > 0 && hs.every(h => typeof h.peso === 'number' && h.peso >= 0) && Math.round(hs.reduce((a, h) => a + h.peso, 0)) === 100;
  const ms = hs.map(h => ({ name: h.nombre, weight: typeof h.peso === 'number' ? h.peso : null, w: conPeso ? h.peso : 100 / n, date: h.fecha, done: !!h.completado, vis: (0, ENLACES.inc)(h) }));
  const ph = (i.hist || []).filter(x => x[0] < hoy()).slice(-1)[0], nx = hs.find(h => !h.completado && (0, ENLACES.inc)(h)) || null, v = ventanaDe(i, i.fase);
  let subs = repSubsActivas(i); if (!subs.length) subs = subfasesDe(i).filter(s => s.fase === i.fase).sort(by('inicio'));
  const phases = subs.length ? subs.map(s => { const hh = hitosSub(i, s), d = hh.filter(h => h.completado).length; return { name: s.nombre, progress: hh.length ? Math.round(d / hh.length * 100) : 0, prev: repPrev(i, 's:' + s.id), count: hh.length ? d + '/' + hh.length : '' }; })
    : [{ name: i.fase, progress: avFase(i).v, prev: repPrev(i, 'F:' + i.fase), count: '' }];
  const pend = [...DECS().filter(x => x.ini === i.id && x.estado === 'Pendiente' && (0, ENLACES.inc)(x)).map(x => ({ f: x.limite, text: x.titulo })), ...ACUERDOS().filter(a => a.ini === i.id && a.estado === 'Abierto').map(a => ({ f: a.limite, text: a.texto }))]
    .sort((a, b) => (a.f || '9') < (b.f || '9') ? -1 : (a.f || '9') > (b.f || '9') ? 1 : 0)
    .map(p => ({ tag: p.f ? repDia(p.f) : 'POR DEFINIR', color: !p.f ? '#98999B' : p.f < hoy() ? '#EB002A' : '#41B6E6', text: p.text }));
  return { project: i.titulo, pm: i.lider || '', client: i.negocio || '', cutoff: hoy(), status: REP_ST[i.rag] || 'EN PLAN', overall: Math.round(+i.avance || 0), prevOverall: ph ? ph[1] : '',
    ms, conPeso, fase: i.fase, faseIni: i.faseDesde || (v && v.ini) || '', faseFin: (v && v.fin) || '', avFase: avFase(i).v, avFasePrev: repPrev(i, 'F:' + i.fase), phases,
    next: nx ? { name: nx.nombre, date: nx.fecha } : null, last: repLines(i.logros), nextWeek: repLines(i.proximos), note: String(i.issue || i.riesgoTxt || '').trim(), pend };
}
const repNote = d => d.note ? '<div style="background:#007D8A;border-radius:10px;padding:14px;margin-bottom:12px;"><div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:6px;">Nota de atención</div><div style="font-size:11px;color:#fff;line-height:1.55;">' + esc(d.note) + '</div></div>' : '';
const repPend = d => d.pend.length ? '<div style="border:1px solid #EBEBEB;border-radius:10px;padding:14px;"><div style="font-size:12px;font-weight:700;color:#000;margin-bottom:10px;">Pendientes por definir</div><div style="display:flex;flex-direction:column;gap:8px;">'
  + d.pend.map(p => '<div style="display:flex;gap:8px;align-items:flex-start;"><span style="color:#fff;font-size:8.5px;font-weight:700;padding:2px 0;border-radius:4px;flex-shrink:0;margin-top:2px;white-space:nowrap;width:72px;text-align:center;display:inline-block;background:' + p.color + ';">' + esc(p.tag) + '</span><span style="font-size:11px;color:#54565A;line-height:1.4;">' + esc(p.text) + '</span></div>').join('') + '</div></div>' : '';
const repLi = (arr, icon, color) => arr.map(t => '<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:7px;"><span style="flex-shrink:0;font-size:12px;line-height:1.4;color:' + color + ';">' + icon + '</span><span style="font-size:11px;color:#54565A;line-height:1.4;">' + esc(t) + '</span></div>').join('');
const repDoc = inner => '<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f5f5f5;font-family:Arial,sans-serif;padding:24px}</style></head><body>\n' + inner + '\n</body></html>';
const repHead = (d, meta, title) => '  <div style="border:1px solid #EBEBEB;border-radius:12px;padding:16px 20px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">\n    <div>\n      <div style="color:#98999B;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;">' + esc(d.project) + '</div>\n      <div style="color:#000;font-size:19px;font-weight:700;">Reporte de avance</div>\n      <div style="color:#54565A;font-size:11px;margin-top:3px;">Corte: ' + repFmt(d.cutoff) + '</div>\n    </div>\n    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">\n      <span style="font-size:10px;font-weight:700;padding:5px 14px;border-radius:20px;color:#fff;letter-spacing:0.05em;background:' + ({ 'EN PLAN': '#388E3C', 'EN RIESGO': '#F57C00', 'ATRASADO': '#C62828' }[d.status]) + ';">' + d.status + '</span>\n      <span style="font-size:10px;color:#98999B;">' + esc(meta) + '</span>\n    </div>\n  </div>\n';
const repVar = (cur, prev) => prev === '' || prev == null || isNaN(+prev) ? '' : (cur - +prev > 0 ? '↑ desde ' + prev + '%' : cur - +prev < 0 ? '↓ desde ' + prev + '%' : 'Sin cambio');
/* ---- Forma A · una fase activa ---- */
function repHtmlA(d) {
  const ms = d.ms; let acc = 0; const pos = ms.map(h => { acc += h.w; return Math.round(acc * 10) / 10; });
  const lbl = h => esc(h.name) + (h.weight != null ? ' — ' + h.weight + '%' : '');
  const vi = ms.map((m, k) => k).filter(k => ms[k].vis);
  const dots = vi.map(k => { const p = pos[k], done = ms[k].done; return '<div style="position:absolute;top:50%;transform:translate(-50%,-50%);left:' + p + '%;width:14px;height:14px;border-radius:50%;background:' + (done ? '#EB002A' : '#fff') + ';border:2px solid ' + (done ? '#fff' : '#98999B') + ';"></div>'; }).join('');
  const rows = vi.map(() => 0); for (let j = 1; j < vi.length; j++) if (pos[vi[j]] - pos[vi[j - 1]] < 28) rows[j] = rows[j - 1] === 0 ? 1 : 0;
  const lblH = rows.some(r => r === 1) ? 66 : 44;
  const lbls = vi.map((k, j) => { const p = pos[k], done = ms[k].done; let t = 'translateX(-50%)'; if (p <= 12) t = 'translateX(0%)'; if (p >= 90) t = 'translateX(-100%)';
    return '<div style="position:absolute;transform:' + t + ';left:' + p + '%;text-align:center;white-space:nowrap;top:' + (rows[j] === 1 ? 24 : 2) + 'px;"><div style="font-weight:700;color:' + (done ? '#EB002A' : '#54565A') + ';">' + (done ? '✓ ' : '') + lbl(ms[k]) + '</div><div style="margin-top:1px;color:' + (done ? '#EB002A' : '#98999B') + ';">' + repFmt(ms[k].date) + '</div></div>'; }).join('');
  const vr = d.avFasePrev === '' ? '' : (d.avFase - +d.avFasePrev !== 0 ? '<div style="color:#41B6E6;font-size:10px;margin-top:4px;">' + (d.avFase > +d.avFasePrev ? '↑' : '↓') + ' desde ' + d.avFasePrev + '%</div>' : '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">Sin cambio</div>');
  const box = (a, b, big, bigSz, sub, mt) => '    <div style="background:#01426A;border-radius:10px;padding:14px;text-align:center;">\n      <div style="color:#9BCBEB;font-size:10px;margin-bottom:5px;">' + a + '</div>\n      <div style="color:#fff;font-size:' + bigSz + 'px;font-weight:700;line-height:1;' + (mt ? 'margin-top:4px;' : '') + '">' + big + '</div>\n      ' + sub + '\n    </div>\n';
  const nx = d.next;
  return repDoc('<div style="font-family:Arial,sans-serif;padding:22px;background:#fff;max-width:680px;margin:0 auto;border-radius:12px;">\n' + repHead(d, 'Aramark · PM: ' + d.pm + (d.client ? ' · ' + d.client : ''))
    + '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">\n'
    + box('Avance del proyecto', '', d.overall + '%', 25, '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">Hitos contractuales</div>', false)
    + box('Avance fase activa', '', d.avFase + '%', 25, vr, false)
    + box('Próximo hito', '', nx ? repFmt(nx.date) : '—', 17, '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">' + (nx ? esc(nx.name) : 'Todos los hitos cumplidos') + '</div>', true)
    + '  </div>\n  <div style="border:1px solid #EBEBEB;border-radius:10px;padding:16px 20px;margin-bottom:12px;">\n    <div style="font-size:10px;color:#98999B;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">Progreso del proyecto</div>\n    <div style="font-size:11px;color:#54565A;font-weight:500;margin-bottom:10px;">Avance general (hitos contractuales)</div>\n    <div style="position:relative;padding:0 6px;">\n      <div style="position:relative;height:20px;">\n        <div style="position:absolute;top:50%;transform:translateY(-50%);left:0;right:0;height:6px;background:#EBEBEB;border-radius:6px;"></div>\n        <div style="position:absolute;top:50%;transform:translateY(-50%);left:0;width:' + d.overall + '%;height:6px;background:#EB002A;border-radius:6px;"></div>\n        ' + dots + '\n      </div>\n      <div style="position:relative;height:' + lblH + 'px;margin-top:5px;font-size:8px;">' + lbls + '</div>\n    </div>\n'
    + '    <div style="border-top:1px solid #EBEBEB;margin:12px 0;"></div>\n    <div style="display:flex;justify-content:space-between;font-size:11px;color:#54565A;margin-bottom:5px;">\n      <span>Fase Activa: ' + esc(d.fase) + '</span><strong style="color:#000;">' + d.avFase + '%</strong>\n    </div>\n    <div style="background:#EBEBEB;border-radius:6px;height:6px;overflow:hidden;">\n      <div style="background:#41B6E6;height:100%;border-radius:6px;width:' + d.avFase + '%;"></div>\n    </div>\n    <div style="display:flex;justify-content:space-between;font-size:9px;color:#98999B;margin-top:3px;">\n      <span>' + repFmt(d.faseIni, true) + '</span><span>' + repFmt(d.faseFin, true) + '</span>\n    </div>\n  </div>\n'
    + '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">\n    <div style="border:1px solid #EBEBEB;border-radius:10px;padding:14px;">\n      <div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;"><div style="width:8px;height:8px;border-radius:50%;background:#007D8A;flex-shrink:0;"></div><div style="font-size:12px;font-weight:700;color:#000;">Semana pasada</div></div>\n      ' + repLi(d.last, '✓', '#007D8A') + '\n    </div>\n    <div style="border:1px solid #EBEBEB;border-radius:10px;padding:14px;">\n      <div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;"><div style="width:8px;height:8px;border-radius:50%;background:#41B6E6;flex-shrink:0;"></div><div style="font-size:12px;font-weight:700;color:#000;">Esta semana</div></div>\n      ' + repLi(d.nextWeek, '→', '#41B6E6') + '\n    </div>\n  </div>\n  ' + repNote(d) + repPend(d) + '\n</div>');
}
/* ---- Forma B · múltiples hitos y fases paralelas ---- */
function repHtmlB(d) {
  const ms = d.ms, doneN = ms.filter(m => m.done).length; let acc = 0; const pts = ms.map((m, k) => { acc += m.w; return Object.assign({ k }, m, { pos: Math.round(acc * 10) / 10 }); });
  const vpts = pts.filter(p => p.vis), lastDone = pts.slice().reverse().find(p => p.done), fillW = lastDone ? lastDone.pos : 0, nx = d.next;
  const cnt = c => c ? '<span style="display:inline-block;vertical-align:middle;background:rgba(255,255,255,.18);color:#fff;font-size:15px;font-weight:700;line-height:1;padding:4px 9px;border-radius:12px;margin-right:10px;">' + esc(c) + '</span>' : '';
  const kBox = (label, big, size, sub, subColor, push) => '    <div style="background:#01426A;border-radius:10px;padding:14px;text-align:center;">\n      <div style="color:#9BCBEB;font-size:10px;margin-bottom:5px;">' + label + '</div>\n      <div style="color:#fff;font-size:' + size + 'px;font-weight:700;line-height:1;' + (push ? 'margin-top:4px;' : '') + '">' + big + '</div>\n      <div style="color:' + subColor + ';font-size:10px;margin-top:4px;">' + sub + '</div>\n    </div>\n';
  const boxes = d.phases.map(p => kBox('Avance fase: ' + esc(p.name), cnt(p.count) + p.progress + '%', 25, repVar(p.progress, p.prev) || '&nbsp;', '#41B6E6', false)).concat([kBox('Próximo hito', nx ? repFmt(nx.date) : '—', 17, nx ? esc(nx.name) : 'Todos los hitos cumplidos', '#9BCBEB', true)]);
  const nb = boxes.length, cols = nb <= 4 ? nb : (nb === 5 || nb === 6 || nb === 9) ? 3 : 4;
  const oSub = repVar(d.overall, d.prevOverall) || 'Hitos', oLabel = d.prevOverall !== '' ? 'Avance del proyecto' : 'Avance del proyecto';
  const banner = '  <div style="background:#388E3C;border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:24px;margin-bottom:12px;">\n    <div style="text-align:center;min-width:130px;">\n      <div style="color:#E8F5E9;font-size:12px;">' + (d.prevOverall !== '' ? 'Avance del proyecto (hitos)' : oLabel) + '</div>\n      <div style="color:#fff;font-size:48px;font-weight:700;line-height:1.1;">' + d.overall + '%</div>\n      <div style="color:#E8F5E9;font-size:12px;">' + oSub + '</div>\n    </div>\n    <div style="flex:1;">\n      <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#E8F5E9;margin-bottom:6px;"><span>' + doneN + ' de ' + ms.length + ' hitos cumplidos</span><span>' + (nx ? 'Próximo: ' + repFmt(nx.date) : 'Todos los hitos cumplidos') + '</span></div>\n      <div style="height:8px;background:rgba(255,255,255,.3);border-radius:6px;overflow:hidden;"><div style="height:100%;width:' + Math.max(0, Math.min(100, d.overall)) + '%;background:#fff;border-radius:6px;"></div></div>\n    </div>\n  </div>\n';
  const markers = vpts.map((p, k) => '<div style="position:absolute;top:50%;transform:translate(-50%,-50%);left:' + p.pos + '%;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;' + (p.done ? 'background:#EB002A;border:2px solid #fff;color:#fff;' : 'background:#fff;border:2px solid #98999B;color:#54565A;') + '">' + (k + 1) + '</div>').join('');
  const legHead = '<div style="display:flex;align-items:center;gap:8px;padding:0 0 4px;font-size:8px;color:#98999B;letter-spacing:0.04em;text-transform:uppercase;"><span style="width:18px;flex-shrink:0;"></span><span style="flex:1;">Hito</span><span style="width:34px;text-align:right;">Peso</span><span style="width:58px;text-align:right;">Fecha</span></div>';
  const legRows = vpts.map((p, k) => '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-top:1px solid #F0F0F0;font-size:10px;"><span style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;' + (p.done ? 'background:#EB002A;border:2px solid #EB002A;color:#fff;' : 'background:#fff;border:2px solid #98999B;color:#54565A;') + '">' + (k + 1) + '</span><span style="flex:1;line-height:1.3;font-weight:' + (p.done ? '700' : '400') + ';color:' + (p.done ? '#000' : '#54565A') + ';">' + (p.done ? '✓ ' : '') + esc(p.name) + '</span><span style="width:34px;text-align:right;color:' + (p.done ? '#EB002A' : '#98999B') + ';">' + (p.weight != null ? (Math.round(p.weight * 10) / 10) + '%' : '') + '</span><span style="width:58px;text-align:right;color:' + (p.done ? '#EB002A' : '#98999B') + ';">' + repFmt(p.date) + '</span></div>').join('');
  return repDoc('<div style="font-family:Arial,sans-serif;padding:22px;background:#fff;max-width:680px;margin:0 auto;border-radius:12px;">\n' + repHead(d, [d.client, d.pm ? 'PM: ' + d.pm : ''].filter(Boolean).join(' · ')) + banner
    + '  <div style="border:1px solid #EBEBEB;border-radius:10px;padding:16px 20px;margin-bottom:12px;">\n    <div style="font-size:10px;color:#98999B;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">Progreso del proyecto</div>\n    <div style="font-size:11px;color:#54565A;font-weight:500;margin-bottom:10px;">Avance general (hitos)</div>\n    <div style="position:relative;padding:0 9px;">\n      <div style="position:relative;height:22px;">\n        <div style="position:absolute;top:50%;transform:translateY(-50%);left:0;right:0;height:6px;background:#EBEBEB;border-radius:6px;"></div>\n        <div style="position:absolute;top:50%;transform:translateY(-50%);left:0;width:' + fillW + '%;height:6px;background:#EB002A;border-radius:6px;"></div>\n        ' + markers + '\n      </div>\n      <div style="margin-top:12px;">' + legHead + legRows + '</div>\n    </div>\n  </div>\n'
    + '  <div style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:10px;margin-bottom:12px;">\n' + boxes.join('') + '  </div>\n'
    + '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">\n    <div style="border:1px solid #EBEBEB;border-radius:10px;padding:14px;">\n      <div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;"><div style="width:8px;height:8px;border-radius:50%;background:#007D8A;flex-shrink:0;"></div><div style="font-size:12px;font-weight:700;color:#000;">Semana actual</div></div>\n      ' + repLi(d.last, '✓', '#007D8A') + '\n    </div>\n    <div style="border:1px solid #EBEBEB;border-radius:10px;padding:14px;">\n      <div style="display:flex;align-items:center;gap:6px;margin-bottom:9px;"><div style="width:8px;height:8px;border-radius:50%;background:#41B6E6;flex-shrink:0;"></div><div style="font-size:12px;font-weight:700;color:#000;">Próxima semana</div></div>\n      ' + repLi(d.nextWeek, '→', '#41B6E6') + '\n    </div>\n  </div>\n  ' + repNote(d) + repPend(d) + '\n</div>');
}
export const repHtml = (i, forma) => { const f = forma === 'A' || forma === 'B' ? forma : repFormaAuto(i), d = repDatos(i); return { forma: f, html: f === 'B' ? repHtmlB(d) : repHtmlA(d) }; };
const repBody = html => html.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '');
function repPintar(i) {
  const r = repHtml(i, UI.repForma), box = $('#rep-prev'), inf = $('#rep-info'); if (!box) return; box.innerHTML = repBody(r.html);
  if (inf) inf.textContent = 'Forma ' + r.forma + (UI.repForma === 'A' || UI.repForma === 'B' ? ' (forzada)' : ' (automática: ' + (repFormaAuto(i) === 'B' ? '2 o más subfases activas' : 'una sola fase activa') + ')');
}
Acts.reporte = d => {
  const i = byId(d.id); if (!i || esProp(i)) return; UI.repForma = 'auto'; UI.repId = i.id;
  Modal.open({ title: 'Reporte 1 a 1 · ' + i.titulo, wide: true,
    body: `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><label class="mut" style="display:flex;gap:6px;align-items:center">Forma <select id="rep-forma" data-chg="repforma" aria-label="Forma del reporte"><option value="auto">Automática</option><option value="A">A · una fase activa</option><option value="B">B · múltiples hitos y fases paralelas</option></select></label><span id="rep-info" class="mut"></span></div><p class="desc" style="margin:0 0 8px">Se arma con la ficha: estado = RAG, avance, hitos, subfases, logros, próximos pasos, issue, decisiones y compromisos abiertos. Cambia lo que ves en la ficha, no aquí.</p><div id="rep-prev" style="background:#f5f5f5;border-radius:8px;max-height:62vh;overflow:auto"></div>`,
    footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn" data-act="repcopy">Copiar HTML</button><button class="btn" data-act="repdl">Descargar HTML</button><button class="btn" data-act="reppng">Guardar PNG</button><button class="btn pri" data-act="reppdf">Guardar PDF</button>` });
  repPintar(i);
};
Chg.repforma = el => { UI.repForma = el.value; const i = byId(UI.repId); if (i) repPintar(i); };
/* Exportar el reporte a PNG / PDF sin librerías: SVG foreignObject → canvas → PNG; el PDF es 1 página con el JPEG embebido */
function repCanvas(esc2) {
  return new Promise((ok, ko) => {
    const src = $('#rep-prev'); if (!src) return ko(new Error('sin vista previa'));
    const w = 900, wrap = document.createElement('div'); wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrap.style.cssText = 'width:' + w + 'px;box-sizing:border-box;background:#f5f5f5;padding:24px;font-family:Arial,sans-serif'; wrap.innerHTML = src.innerHTML;
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden'; host.appendChild(wrap); document.body.appendChild(host);
    const h = Math.ceil(wrap.getBoundingClientRect().height); const xml = new XMLSerializer().serializeToString(wrap); host.remove();
    const k = esc2 || 2, svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' + xml + '</foreignObject></svg>';
    const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const x = c.getContext('2d'); x.fillStyle = '#f5f5f5'; x.fillRect(0, 0, c.width, c.height); x.scale(k, k); x.drawImage(img, 0, 0); ok({ c, w, h }); } catch (e) { ko(e); } };
    img.onerror = () => ko(new Error('no se pudo dibujar el reporte')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function repPdfBlob(jpgB64, pw, ph, wpx, hpx) {
  const bin = atob(jpgB64), n = bin.length, jpg = new Uint8Array(n); for (let q = 0; q < n; q++) jpg[q] = bin.charCodeAt(q);
  const enc = t => { const u = new Uint8Array(t.length); for (let q = 0; q < t.length; q++) u[q] = t.charCodeAt(q) & 255; return u; };
  const W = 595, H = Math.round(595 * ph / pw), parts = [], off = []; let len = 0;
  const put = d => { const u = typeof d === 'string' ? enc(d) : d; parts.push(u); len += u.length; };
  const obj = (id, d) => { off[id] = len; put(id + ' 0 obj\n'); put(d); put('\nendobj\n'); };
  put('%PDF-1.4\n'); obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q'; obj(4, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
  off[5] = len; put('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + wpx + ' /Height ' + hpx + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + n + ' >>\nstream\n'); put(jpg); put('\nendstream\nendobj\n');
  const xr = len; let t = 'xref\n0 6\n0000000000 65535 f \n'; for (let q = 1; q <= 5; q++) t += String(off[q]).padStart(10, '0') + ' 00000 n \n';
  put(t + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF'); return new Blob(parts, { type: 'application/pdf' });
}
const repNombre = (i, ext) => 'Reporte_1a1_' + String(i.titulo).trim().replace(/\s+/g, '_').replace(/[^\w\-.]/g, '') + '_' + repFmt(hoy()).replace(/\//g, '-') + '.' + ext;
Acts.reppng = async () => { const i = byId(UI.repId); if (!i) return; try { const { c } = await repCanvas(2); c.toBlob(b => { if (!b) return toast('No se pudo generar el PNG', 'err'); downloadBlob(repNombre(i, 'png'), b); toast('PNG descargado'); }, 'image/png'); } catch (e) { toast('No se pudo generar el PNG: ' + e.message, 'err'); } };
Acts.reppdf = async () => { const i = byId(UI.repId); if (!i) return; try { const { c, w, h } = await repCanvas(2); const u = c.toDataURL('image/jpeg', 0.92); downloadBlob(repNombre(i, 'pdf'), repPdfBlob(u.split(',')[1], w, h, c.width, c.height)); toast('PDF descargado'); } catch (e) { toast('No se pudo generar el PDF: ' + e.message, 'err'); } };
Acts.repdl = () => { const i = byId(UI.repId); if (!i) return; const r = repHtml(i, UI.repForma); download('Reporte_' + String(i.titulo).trim().replace(/\s+/g, '_').replace(/[^\w\-.]/g, '') + '_' + repFmt(hoy()).replace(/\//g, '-') + '_Forma' + r.forma + '.html', r.html, 'text/html'); toast('Reporte descargado'); };
Acts.repcopy = async () => { const i = byId(UI.repId); if (!i) return; const h = repHtml(i, UI.repForma).html; try { await navigator.clipboard.writeText(h); toast('HTML copiado'); } catch (e) { const t = document.createElement('textarea'); t.value = h; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('HTML copiado'); } catch (_) { toast('No se pudo copiar; usa Descargar HTML', 'err'); } t.remove(); } };

/* ------------------------------------------------------------------
   2) COMPROMISOS Y ACUERDOS
   ------------------------------------------------------------------ */
const ACU_ABIERTO = a => a.estado === 'Abierto';
export function todosAcu() {
  const own = ACUERDOS().map(a => Object.assign({ src: 'acu', abierto: a.estado === 'Abierto' }, a));
  const com = []; St.comites.forEach(c => ['acciones', 'compromisos'].forEach(k => (c[k] || []).forEach(a => { const ab = ['Abierta', 'Abierto'].includes(a.estado); com.push({ id: a.id, texto: a.texto, resp: a.resp, de: '', limite: a.limite, ini: a.ini || null, estado: ab ? 'Abierto' : 'Cumplido', src: 'com', c: c.id, k, origen: 'Comité · ' + fmtD(c.fecha), tema: '', abierto: ab }); })));
  return [...own, ...com].filter(a => !a.ini || !byId(a.ini) || (inArea(byId(a.ini)) && !esSB(byId(a.ini))));
}
function acuVencidos() { if (!St || !St.compromisos) return 0; const me = miUsuario(); return todosAcu().filter(a => a.abierto && a.resp === me && a.limite && a.limite < hoy()).length; }
function acuForm(a, pre) {
  const nw = !a, me = miUsuario();
  const v = a ? clone(a) : Object.assign({ texto: '', resp: '', de: me, limite: addD(hoy(), 7), ini: '', tema: '', estado: 'Abierto', origen: 'manual' }, pre || {});
  if (v.ini == null) v.ini = '';
  openForm({
    title: nw ? 'Nuevo compromiso' : 'Editar compromiso ' + a.id, values: v, saveLabel: nw ? 'Registrar' : 'Guardar', danger: nw ? null : 'Eliminar',
    fields: [
      { k: 'texto', l: '¿Qué se comprometió?', t: 'textarea', req: true, w: 3 }, { k: 'resp', l: 'Responsable (quien debe hacerlo)', list: people(), req: true, w: 2 }, { k: 'de', l: 'Solicitado por', list: people() },
      { k: 'limite', l: 'Fecha comprometida', t: 'date', req: true }, { k: 'ini', l: 'Iniciativa', t: 'select', opts: [GEN_OPT, ...iniOpts()], w: 2 }, { k: 'tema', l: 'Tema o persona', w: 1 },
      ...(nw ? [] : [{ k: 'estado', l: 'Estado', t: 'select', opts: ['Abierto', 'Cumplido', 'Cancelado'] }])
    ],
    onDanger: () => confirmBox('¿Eliminar este compromiso?', () => { St.compromisos = St.compromisos.filter(x => x.id !== a.id); log('Cambio', a.ini, 'Compromiso eliminado: ' + a.texto); toast('Compromiso eliminado'); refresh(); }, 'Eliminar', true),
    onSave(o) {
      o.ini = o.ini || null;
      if (nw) { const n = { id: nextId('ACU', St.compromisos), ...o, estado: 'Abierto', fechaReal: null, creada: hoy(), origen: o.origen || 'manual' }; St.compromisos.push(n); log('Cambio', n.ini, `Compromiso registrado: ${n.texto} — ${n.resp}, ${fmtD(n.limite)}`); toast('Compromiso registrado'); }
      else { const ch = o.estado !== a.estado; Object.assign(a, o, ch ? { fechaReal: o.estado === 'Cumplido' ? hoy() : null } : {}); if (ch) log('Cambio', a.ini, `Compromiso ${a.id} → ${a.estado}: ${a.texto}`); toast('Compromiso actualizado'); }
      refresh();
    }
  });
}
Acts.acunew = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const pre = {}; if (d && d.id) pre.ini = d.id; if (d && d.texto) pre.texto = d.texto; if (d && d.tema) pre.tema = d.tema; closePops(); if (Modal.cur) Modal.close(); setTimeout(() => acuForm(null, pre), 40); };
Acts.acuedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const a = St.compromisos.find(x => x.id === d.id); if (a) acuForm(a); };
Chg.acutoggle = el => { const a = St.compromisos.find(x => x.id === el.dataset.id); if (!a) return; a.estado = el.checked ? 'Cumplido' : 'Abierto'; a.fechaReal = el.checked ? hoy() : null; log('Cambio', a.ini, `Compromiso ${a.id} ${el.checked ? 'cumplido' : 'reabierto'}: ${a.texto}`); toast(el.checked ? 'Compromiso cumplido' : 'Compromiso reabierto'); refresh(); };
Views.compromisos = {
  render() {
    const f = F('acu', { vista: 'debo', est: 'Abierto', q: '', ini: '' }), me = miUsuario(), all = todosAcu();
    const debo = a => a.resp === me, deben = a => a.de === me && a.resp !== me;
    const base = f.vista === 'debo' ? all.filter(debo) : f.vista === 'deben' ? all.filter(deben) : all;
    let rows = base.filter(a => f.est === '' || (f.est === 'Abierto' ? a.abierto : !a.abierto));
    if (f.ini) rows = rows.filter(a => (f.ini === '__gen' ? !a.ini : a.ini === f.ini));
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(a => (a.texto + a.resp + a.de + a.tema + nameOf(a.ini)).toLowerCase().includes(q)); }
    rows.sort(by(a => (a.abierto ? '0' : '1') + (a.limite || '9')));
    const ab = base.filter(a => a.abierto), ven = ab.filter(a => a.limite && a.limite < hoy()), sem = ab.filter(a => a.limite && a.limite >= hoy() && diffD(a.limite, hoy()) <= 7);
    const kp = (l, v, c) => `<div class="kpi sm"><div class="k-top"><span class="k-l">${l}</span></div><div class="k-v" style="${c ? 'color:' + c : ''}">${v}</div></div>`;
    const tr = a => { const late = a.abierto && a.limite && a.limite < hoy(), dd = a.limite ? diffD(a.limite, hoy()) : null;
      return `<tr class="${a.abierto ? '' : 'mut'}"><td style="width:34px"><input type="checkbox" ${a.abierto ? '' : 'checked'} ${a.src === 'acu' ? `data-chg="acutoggle" data-id="${a.id}"` : `data-chg="ctoggle" data-c="${a.c}" data-k="${a.k}" data-id="${a.id}"`} aria-label="Marcar cumplido"></td>
        <td style="white-space:normal;min-width:260px"><b>${esc(a.texto)}</b><small>${esc(a.origen || 'manual')}${a.tema ? ' · ' + esc(a.tema) : ''}</small></td><td>${esc(a.resp || '—')}</td><td>${esc(a.de || '—')}</td>
        <td>${a.ini && byId(a.ini) ? iniLink(a.ini, esc(cut(byId(a.ini).titulo, 34))) : '<span class="mut">General</span>'}</td>
        <td>${a.limite ? fmtD(a.limite) + ' ' + (a.abierto ? `<span class="pill ${late ? 'bad' : 'soft'}">${late ? 'vencido ' + (-dd) + ' d' : dd === 0 ? 'hoy' : 'en ' + dd + ' d'}</span>` : '') : '—'}</td>
        <td class="edit-only">${a.src === 'acu' ? `<button class="btn sm" data-act="acuedit" data-id="${a.id}" aria-label="Editar">${icon('edit', 13)}</button>` : `<button class="btn sm" data-act="go" data-v="comite" aria-label="Ver comité">${icon('users', 13)}</button>`}</td></tr>`; };
    return pageHead('Compromisos', 'Qué debes y qué te deben. Incluye los acuerdos de reuniones y las acciones de comité.', `<span class="edit-only">${btn('Nuevo compromiso', 'acunew', { d: {}, ic: 'plus', cls: 'pri' })}</span>`) + `
    ${base.length ? `<section class="kpis k4" style="margin-bottom:10px">${kp('Abiertos', ab.length)}${kp('Vencidos', ven.length, ven.length ? 'var(--red)' : '')}${kp('Vencen en 7 días', sem.length)}${kp('Cumplidos (esta vista)', base.length - ab.length)}</section>` : ''}
    <div class="toolbar"><div class="seg">${[['debo', 'Debo', all.filter(a => debo(a) && a.abierto).length], ['deben', 'Me deben', all.filter(a => deben(a) && a.abierto).length], ['todos', 'Todos', all.filter(a => a.abierto).length]].map(([k, l, n]) => `<button class="${f.vista === k ? 'on' : ''}" data-act="acuv" data-k="${k}">${l} <small style="display:inline;color:inherit;opacity:.75">${n}</small></button>`).join('')}</div>
      <div class="seg">${[['Abierto', 'Abiertos'], ['Cerrado', 'Cerrados'], ['', 'Todos']].map(([k, l]) => `<button class="${f.est === k ? 'on' : ''}" data-act="acue" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="search"><span>${icon('search', 14)}</span><input data-key="acu-q" data-chg="flt" data-v="acu" data-f="q" type="search" placeholder="Buscar compromiso…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="acu" data-f="ini" aria-label="Iniciativa">${selOpts([{ v: '__gen', t: 'Solo generales' }, ...iniOptsF()], f.ini, 'Todas las iniciativas')}</select></div>
    ${rows.length ? `<div class="tbl-w"><table class="tbl cards-m"><thead><tr><th></th><th>Compromiso</th><th>Responsable</th><th>Solicitado por</th><th>Iniciativa</th><th>Fecha</th><th class="edit-only"></th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div>` : empty(f.vista === 'debo' ? 'Sin compromisos tuyos con estos filtros' : 'Sin compromisos con estos filtros', 'check')}`;
  }
};
Acts.acuv = d => { F('acu', {}).vista = d.k; render(); };
Acts.acue = d => { F('acu', {}).est = d.k; render(); };

/* ------------------------------------------------------------------
   3) RESUMEN DE MI SEMANA
   ------------------------------------------------------------------ */
function esAprobadorDe(i) { const r = (0, ENLACES.rolActual)(); return r === 'Administra' || r === 'Responsable' || (!!i && !!i.sponsor && i.sponsor === miUsuario()); }
function resumenDe(me) {
  const L = d => diffD(d, hoy()), S = [];
  const acu = todosAcu().filter(a => a.abierto && a.resp === me && a.limite && L(a.limite) <= 7).sort(by('limite'));
  const deben = todosAcu().filter(a => a.abierto && a.de === me && a.resp !== me && a.limite && a.limite < hoy()).sort(by('limite'));
  const hs = HITOS().filter(h => { const i = byId(h.ini); return i && i.lider === me && !h.completado && isLive(i) && L(h.fecha) <= 7; }).sort(by('fecha'));
  const upd = St.ini.filter(i => !esProp(i) && i.lider === me && isLive(i) && FASES_ACT.includes(i.fase) && diasSinUpd(i) > MIN_DIAS_RONDA);
  const rs = RIESGOS().filter(r => r.dueno === me && riesgoAbierto(r) && r.fRev && L(r.fRev) <= 7);
  const dc = DECS().filter(d => d.estado === 'Pendiente' && d.solicita === me && d.limite && L(d.limite) <= 7);
  const cg = CAMBIOS().filter(c => c.estado === 'Solicitado' && esAprobadorDe(byId(c.ini)) && c.solicita !== me);
  const rel = d => L(d) < 0 ? `VENCIDO hace ${-L(d)} d` : L(d) === 0 ? 'hoy' : `en ${L(d)} d (${fmtD(d)})`;
  const sec = (t, arr, fn) => { if (arr.length) S.push([t, arr.map(fn)]); };
  sec('Compromisos que debes cumplir', acu, a => `${a.texto}${a.ini && byId(a.ini) ? ' · ' + byId(a.ini).titulo : ''} — ${rel(a.limite)}`);
  sec('Compromisos que te deben y están vencidos', deben, a => `${a.texto} — ${a.resp}, ${rel(a.limite)}`);
  sec('Hitos de tus proyectos (vencidos y próximos 7 días)', hs, h => `${h.nombre} · ${nameOf(h.ini)} — ${rel(h.fecha)}`);
  sec('Proyectos por actualizar', upd, i => `${i.titulo} — última actualización hace ${diasSinUpd(i)} d`);
  sec('Riesgos por revisar', rs, r => `${r.desc} · ${nameOf(r.ini)} — ${rel(r.fRev)}`);
  sec('Decisiones que debes presentar', dc, d => `${d.titulo} — ${rel(d.limite)}`);
  sec('Cambios esperando tu aprobación', cg, c => `${c.id} · ${nameOf(c.ini)}: ${c.desc}`);
  const txt = [`RESUMEN DE MI SEMANA · ${me} · ${fmtD(hoy())}`, '', ...(S.length ? S.flatMap(([t, a]) => [t.toUpperCase(), ...a.map(x => '- ' + x), '']) : ['Todo al día: no tienes pendientes críticos esta semana.'])].join('\n').trim();
  return { S, txt, n: S.reduce((s, x) => s + x[1].length, 0) };
}
Acts.resumen = () => {
  const me = miUsuario(), R = resumenDe(me), u = (St.usuarios.find(x => x.n === me) || {}).correo || '';
  Modal.open({
    title: 'Resumen de mi semana', wide: true,
    body: `<p class="desc" style="margin-top:0">${R.n ? `<b>${R.n}</b> cosas requieren tu atención.` : 'Estás al día.'} Puedes copiarlo o enviártelo por correo para tenerlo a mano el lunes.</p><textarea id="txtcopy" readonly rows="16" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:12px">${esc(R.txt)}</textarea>`,
    footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn" data-act="copiartxt">${icon('copy', 14)}<span>Copiar</span></button><button class="btn pri" data-act="resmail" data-to="${esc(u)}">${icon('send', 14)}<span>Enviármelo por correo</span></button>`
  });
};
Acts.resmail = d => { const t = $('#txtcopy').value; location.href = 'mailto:' + encodeURIComponent(d.to || '') + '?subject=' + encodeURIComponent('Resumen de mi semana · ' + fmtD(hoy())) + '&body=' + encodeURIComponent(t.slice(0, 1800)); };

/* ------------------------------------------------------------------
   4) CONTROL DE CAMBIOS
   ------------------------------------------------------------------ */
const CHG_TIPOS = ['Alcance', 'Fecha', 'Presupuesto', 'Recursos', 'Otro'], CHG_C = { Solicitado: '#CA5010', Aprobado: '#107C10', Rechazado: '#D13438' };
const chgEfecto = c => { const p = []; if (c.fNue) p.push(`Fin plan ${fmtD(c.fAnt)} → ${fmtD(c.fNue)}${c.fAnt ? ' (' + (diffD(c.fNue, c.fAnt) >= 0 ? '+' : '') + diffD(c.fNue, c.fAnt) + ' d)' : ''}`); if (+c.pNue > 0) p.push(`Presupuesto ${fmtN(c.pAnt)} → ${fmtMon(c.pNue, monOf(byId(c.ini)))}`); return p.join(' · ') || 'Sin efecto en fecha ni presupuesto'; };
function chgForm(c, pre) {
  const nw = !c, me = miUsuario();
  const v = c ? clone(c) : Object.assign({ ini: '', tipo: 'Fecha', desc: '', motivo: '', impacto: '', fNue: '', pNue: 0 }, pre || {});
  if (!nw && c.estado !== 'Solicitado') return toast('Un cambio ya resuelto no se edita', 'err');
  openForm({
    title: nw ? 'Nueva solicitud de cambio' : 'Editar solicitud ' + c.id, values: v, saveLabel: nw ? 'Registrar solicitud' : 'Guardar', danger: nw ? null : 'Eliminar',
    fields: [
      { k: 'ini', l: 'Proyecto', t: 'select', opts: iniOpts(), req: true, w: 2 }, { k: 'tipo', l: 'Tipo de cambio', t: 'select', opts: CHG_TIPOS },
      { k: 'desc', l: 'Qué cambia', t: 'textarea', req: true, w: 3 }, { k: 'motivo', l: 'Por qué (motivo)', t: 'textarea', req: true, w: 3 }, { k: 'impacto', l: 'Impacto en alcance, costo, calidad o equipo', t: 'textarea', w: 3 },
      { k: 'fNue', l: 'Nueva fecha de fin plan', t: 'date', hint: 'Déjala vacía si no cambia la fecha' }, { k: 'pNue', l: 'Nuevo presupuesto (en la moneda del proyecto)', t: 'number', min: 0, hint: '0 = sin cambio · CLP en MM, USD en miles, UF en unidades' }
    ],
    onDanger: () => confirmBox('¿Eliminar esta solicitud de cambio?', () => { St.cambios = St.cambios.filter(x => x.id !== c.id); log('Cambio', c.ini, 'Solicitud de cambio eliminada: ' + c.id); toast('Solicitud eliminada'); refresh(); }, 'Eliminar', true),
    onSave(o) {
      const i = byId(o.ini); if (!i) { toast('Elige un proyecto', 'err'); return false; }
      if (o.fNue && o.fNue === i.finPlan && !+o.pNue) { toast('La nueva fecha es igual a la actual', 'err'); return false; }
      if (o.fNue && i.inicioPlan && o.fNue < i.inicioPlan) { toast('La nueva fecha de fin no puede ser anterior al inicio plan (' + fmtD(i.inicioPlan) + ')', 'err'); return false; }   // N-F-05
      if (nw && conServidor()) { return cmdServidor('apih_solicitar_cambio', { p_ini: o.ini, p_tipo: o.tipo, p_desc: o.desc, p_motivo: o.motivo, p_impacto: o.impacto || '', p_fnue: o.fNue || null, p_pnue: +o.pNue || 0 }, 'Solicitud registrada: queda pendiente de aprobación', true).then(r => r !== null); }
      if (nw) { const n = { id: nextId('CHG', St.cambios), ...o, pNue: +o.pNue || 0, solicita: me, fAnt: i.finPlan || null, pAnt: i.presupuesto || 0, estado: 'Solicitado', aprobador: '', fDec: null, nota: '', creada: hoy() }; St.cambios.push(n); log('Cambio', n.ini, `Solicitud de cambio ${n.id} (${n.tipo}): ${n.desc}. ${chgEfecto(n)}`); toast('Solicitud registrada: queda pendiente de aprobación'); }
      else { Object.assign(c, o, { pNue: +o.pNue || 0, fAnt: i.finPlan || null, pAnt: i.presupuesto || 0 }); toast('Solicitud actualizada'); }
      refresh();
    }
  });
}
Acts.chgnew = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const pre = {}; if (d && d.id) { pre.ini = d.id; const i = byId(d.id); if (i) { const f = forecast(i); if (f && i.finPlan && f > i.finPlan) { pre.tipo = 'Fecha'; pre.fNue = f; } } } closePops(); if (Modal.cur) Modal.close(); setTimeout(() => chgForm(null, pre), 40); };
Acts.chgedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const c = St.cambios.find(x => x.id === d.id); if (c) chgForm(c); };
Acts.chgdec = d => {
  const c = St.cambios.find(x => x.id === d.id), i = c && byId(c.ini); if (!c || !i || c.estado !== 'Solicitado') return;
  if ((0, ENLACES.soloLectura)() || !esAprobadorDe(i)) return (0, ENLACES.NO_PERM)('Solo el sponsor del proyecto, el administrador o Administra pueden resolver cambios');
  const ap = d.e === 'Aprobado';
  openForm({
    title: (ap ? 'Aprobar' : 'Rechazar') + ' cambio ' + c.id, values: { aprobador: miUsuario(), nota: '' }, saveLabel: ap ? 'Aprobar y aplicar' : 'Rechazar',
    fields: [{ k: 'aprobador', l: 'Resuelve', list: people(), req: true }, { k: 'nota', l: ap ? 'Nota de aprobación' : 'Motivo del rechazo', t: 'textarea', req: !ap, w: 3 }],
    extra: `<div class="note ${ap ? '' : 'warn'}" style="margin-top:8px"><span><b>${esc(i.titulo)}</b> · ${esc(c.tipo)}: ${esc(c.desc)}<br>${ap ? '<b>Se aplicará:</b> ' : 'Efecto solicitado: '}${esc(chgEfecto(c))}</span></div>`,
    onSave(o) {
      if (conServidor()) { return cmdServidor('apih_resolver_cambio', { p_id: c.id, p_estado: d.e, p_nota: o.nota || '' }, 'Cambio ' + (ap ? 'aprobado y aplicado a la línea base' : 'rechazado'), true).then(r => r !== null); }
      c.estado = d.e; c.aprobador = o.aprobador; c.nota = o.nota; c.fDec = hoy();
      if (ap) { if (c.fNue) { i.finPlan = c.fNue; if (!i.finEst || i.finEst < c.fNue) i.finEst = c.fNue; } if (+c.pNue > 0) i.presupuesto = +c.pNue; i.actualizada = hoy(); }
      log('Decisión', c.ini, `Cambio ${c.id} ${ap ? 'aprobado' : 'rechazado'} por ${o.aprobador}${o.nota ? ': ' + o.nota : ''}${ap ? '. Línea base: ' + chgEfecto(c) : ''}`); toast('Cambio ' + (ap ? 'aprobado y aplicado a la línea base' : 'rechazado')); refresh();
    }
  });
};
Views.cambios = {
  render() {
    const f = F('chg', { est: 'Solicitado', tipo: '', q: '' });
    let rows = CAMBIOS().filter(c => { const i = byId(c.ini); return !i || inArea(i); });
    if (f.est) rows = rows.filter(c => c.estado === f.est); if (f.tipo) rows = rows.filter(c => c.tipo === f.tipo);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(c => (c.desc + c.motivo + nameOf(c.ini) + c.solicita).toLowerCase().includes(q)); }
    rows.sort(by(c => (c.estado === 'Solicitado' ? '0' : '1') + (c.creada || '')));
    const all = CAMBIOS(), n = e => all.filter(c => c.estado === e).length;
    const tr = c => { const i = byId(c.ini), can = c.estado === 'Solicitado' && esAprobadorDe(i) && (c.solicita !== miUsuario() || (0, ENLACES.rolActual)() === 'Administra');
      return `<tr><td class="mono">${c.id}</td><td>${iniLink(c.ini, esc(cut(nameOf(c.ini), 30)))}</td><td>${esc(c.tipo)}</td>
        <td style="white-space:normal;min-width:260px"><b>${esc(c.desc)}</b><small>${esc(chgEfecto(c))}</small><small>Motivo: ${esc(c.motivo || '—')}</small></td><td>${esc(c.solicita || '—')}<small>${fmtD(c.creada)}</small></td>
        <td><span class="pill" style="--c:${CHG_C[c.estado]}">${c.estado}</span>${c.aprobador ? `<small>${esc(c.aprobador)} · ${fmtD(c.fDec)}${c.nota ? ' · ' + esc(cut(c.nota, 40)) : ''}</small>` : ''}</td>
        <td class="edit-only" style="white-space:nowrap">${can ? `<button class="btn sm pri" data-act="chgdec" data-id="${c.id}" data-e="Aprobado">Aprobar</button> <button class="btn sm" data-act="chgdec" data-id="${c.id}" data-e="Rechazado">Rechazar</button>` : c.estado === 'Solicitado' ? `<small class="mut">Espera a ${esc((i && i.sponsor) || 'sponsor')}</small> <button class="btn sm" data-act="chgedit" data-id="${c.id}" aria-label="Editar">${icon('edit', 13)}</button>` : ''}</td></tr>`; };
    return pageHead('Control de cambios', 'Todo cambio de alcance, fecha o presupuesto queda registrado, con quién lo aprobó y cómo movió la línea base.', `<span class="edit-only">${btn('Nueva solicitud', 'chgnew', { d: {}, ic: 'plus', cls: 'pri' })}</span>`) + `
    <div class="toolbar"><div class="seg">${[['Solicitado', 'Pendientes'], ['Aprobado', 'Aprobados'], ['Rechazado', 'Rechazados'], ['', 'Todos']].map(([k, l]) => `<button class="${f.est === k ? 'on' : ''}" data-act="chge" data-k="${k}">${l} <small style="display:inline;color:inherit;opacity:.75">${k ? n(k) : all.length}</small></button>`).join('')}</div>
      <div class="search"><span>${icon('search', 14)}</span><input data-key="chg-q" data-chg="flt" data-v="chg" data-f="q" type="search" placeholder="Buscar cambio…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="chg" data-f="tipo" aria-label="Tipo">${selOpts(CHG_TIPOS, f.tipo, 'Todos los tipos')}</select></div>
    ${rows.length ? `<div class="tbl-w"><table class="tbl cards-m"><thead><tr><th>ID</th><th>Proyecto</th><th>Tipo</th><th>Cambio</th><th>Solicita</th><th>Estado</th><th class="edit-only"></th></tr></thead><tbody>${rows.map(tr).join('')}</tbody></table></div>` : empty('Sin solicitudes de cambio con estos filtros', 'refresh')}`;
  }
};
Acts.chge = d => { F('chg', {}).est = d.k; render(); };


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  acuVencidos: { get: () => acuVencidos, enumerable: true, configurable: true },
  archFecha: { get: () => archFecha, enumerable: true, configurable: true },
  bellPop: { get: () => bellPop, enumerable: true, configurable: true },
  cut: { get: () => cut, enumerable: true, configurable: true },
  rondaIds: { get: () => rondaIds, enumerable: true, configurable: true },
  snapFases: { get: () => snapFases, enumerable: true, configurable: true },
});
