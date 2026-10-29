import { ENLACES } from './00-registro.js';
import { $, CALC, APIH_CONFIG, DECS, ESTADOS_PRJ, FASES, FASES_FIJAS, FASES_PRJ, FASE_COLOR, FL, METODO_DEF, MONEDAS, PRIOS, RAGS, RISK_CATS, RISK_ESTADOS, St, _nrm, addD, avatar, avg, by, byId, clone, completitud, esProp, esc, fasesDe, hitoCats, hitosDe, hoy, icon, isLive, miUsuario, nameOf, nextId, pct, riesgoAbierto, riesgoCritico, riesgosDe, save } from './01-nucleo.js';
import { AuthService, DataService, SETTINGS_KEYS, ESQUEMA } from './02-datos.js';
import { Acts, BK, Chg, F, Modal, UI, Views, btn, closePops, confirmBox, download, go, openForm, pageHead, prog, refresh, render, selOpts, selectEntity, shell, syncInfo, syncPop, toast } from './03-interfaz.js';
import { iniOpts } from './03b-interfaz-excel-formularios.js';
import { cmdServidor } from './04-flujos.js';
import { DESC_MAX, cutDesc, faseNotaP, fasesVentana, subfasesDe } from './05-vistas.js';

/* ======================= ADMINISTRACIÓN ======================= */
const umbralNote = () => `<div class="note" style="margin-top:12px">${icon('info', 14)}<span>Los umbrales de alerta (desviación, días sin actualización, riesgo crítico, semáforo de propuestas y meta de «Mi cocina») se ajustan en <button class="lnk" data-act="go" data-v="miconfig">Mi configuración</button>, donde Administra los fija para todos y cada líder puede personalizarlos.</span></div>` + ((0, ENLACES.esAdministra)() && window.V22 && V22.MENU ? (0, ENLACES.menuRolCard)() : '');
/* ============================================================
   Notificaciones (estructura paramétrica)
   · El servidor decide: catálogo de avisos, a quién llegan, con qué parámetros y por qué canal, y los avisos de cada persona (apih_calculos → notif).
   · Canales: app (campana) activo; correo y Teams quedan declarados y apagados hasta que TI entregue SMTP / webhook.
   · Preferencias: valores por defecto de la organización (St.cfg.notif, solo Administra) y ajuste personal (St.cfgU[usuario].notif): son datos; el servidor los interpreta.
   · Lectura: por navegador (localStorage) para no pisar la configuración compartida.
   ============================================================ */
/* El catálogo, las preferencias efectivas y los avisos los entrega el servidor (apih_calculos → notif); aquí solo se presentan. */
const NC = () => CALC.notif || { catalogo: { tipos: [], grupos: {}, destinos: [], canales: [] }, prefs: {}, avisos: [] };
export const notifPref = id => NC().prefs[id] || { on: false, dest: [], dias: null, canales: { app: true } };
/* cola de salida para canales externos: la consumirá el proceso servidor cuando TI habilite correo / Teams */
export function notifOutbox(user, canal) { return NC().avisos.filter(n => n.canales.includes(canal)); }
const _nlg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, _nls = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const nlKey = () => 'apih_nl_' + _nrm(miUsuario());
const nlLeidas = () => { try { return new Set(JSON.parse(_nlg(nlKey()) || '[]')); } catch (e) { return new Set(); } };
const nlGuardar = (set, vigentes) => { const keep = [...set].filter(k => vigentes.has(k)).slice(-600); _nls(nlKey(), JSON.stringify(keep)); };
export function notifMias() { return NC().avisos.filter(n => n.canales.includes('app')); }
export function bellPop() {
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
  const org = modo === 'org', K = NC().catalogo, can = K.canales, onOrg = (St.cfg.notif || {}).canalOn || {};
  const head = `<tr><th>Aviso</th><th class="n">Activo</th>${can.map(c => `<th class="n">${c[1]}</th>`).join('')}${org ? '<th>Destinatarios</th><th class="n">Parámetro</th>' : ''}</tr>`;
  let rows = '';
  Object.keys(K.grupos).forEach(g => {
    rows += `<tr class="grp"><td colspan="${3 + can.length + (org ? 1 : 0)}"><b>${K.grupos[g]}</b></td></tr>`;
    K.tipos.filter(c => c.g === g).forEach(c => {
      const p = notifPref(c.id), dis = FL.verComo ? 'disabled' : '';
      rows += `<tr><td><b>${esc(c.l)}</b><br><small>${esc(c.d)}${c.ev ? ' · por evento' : ''}</small></td><td class="n"><input type="checkbox" ${p.on ? 'checked' : ''} ${dis} data-chg="notifon" data-m="${modo}" data-id="${c.id}" aria-label="Activar ${esc(c.l)}"></td>` +
        can.map(([k, l, disp]) => { const off = !disp && !(onOrg[k]); return `<td class="n"><input type="checkbox" ${p.canales[k] ? 'checked' : ''} ${k === 'app' ? 'disabled' : off || dis ? 'disabled' : ''} data-chg="notifcan" data-m="${modo}" data-id="${c.id}" data-c="${k}" aria-label="${esc(l)}: ${esc(c.l)}" ${off ? 'title="Canal aún no habilitado"' : ''}></td>`; }).join('') +
        (org ? `<td><div class="dst">${c.fijoDest ? '<small>' + (c.id === 'ev_asigna' ? 'La persona asignada' : 'Quien solicitó') + '</small>' : K.destinos.map(([k, l]) => `<label class="chk"><input type="checkbox" ${p.dest.includes(k) ? 'checked' : ''} data-chg="notifdest" data-id="${c.id}" data-k="${k}"> <span>${l}</span></label>`).join('')}</div></td><td class="n">${c.dias != null ? `<input type="number" min="1" max="30" value="${p.dias}" style="width:56px" data-chg="notifdias" data-id="${c.id}" aria-label="${esc(c.diasL)}"> <small>${c.diasL}</small>` : '—'}</td>` : '') + '</tr>';
    });
  });
  return `<div class="tbl-w" style="max-height:none;overflow-x:auto"><table class="tbl notif-t"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}
function notifCanalesCard() {
  const on = (St.cfg.notif || {}).canalOn || {};
  return `<div class="note" style="margin-bottom:10px">${icon('info', 14)}<span><b>En la app</b> funciona hoy (campana). <b>Correo</b> y <b>Teams</b> quedan listos en la estructura: cuando TI entregue el servicio de correo (SMTP) o el webhook de Teams, se habilitan aquí y se envía lo que cada persona haya marcado.</span></div>
    <div class="chips" style="margin-bottom:10px">${NC().catalogo.canales.filter(c => !c[2]).map(c => `<label class="chk"><input type="checkbox" ${on[c[0]] ? 'checked' : ''} data-chg="notifcanon" data-c="${c[0]}"> <span>Habilitar ${c[1]} (requiere integración)</span></label>`).join('')}</div>`;
}
function notifAdminHTML() {
  return `<div class="card"><header><h2>Notificaciones · valores por defecto</h2><small>Qué se avisa, a quién y por qué canal. Cada persona puede ajustar lo suyo en Mi configuración.</small></header>${notifCanalesCard()}${notifMatriz('org')}<div class="chips" style="margin-top:10px">${btn('Restablecer valores', 'notifreset')}</div></div>`;
}
export function notifUserCard() {
  const n = notifMias().length;
  return `<section class="card c12"><header><h2>Notificaciones</h2><small>Qué quieres que te avise APIH · hoy te llegan ${n} avisos en la campana</small></header>${notifMatriz('user')}<div class="chips" style="margin-top:10px">${btn('Restablecer mis avisos', 'notifmyreset')}</div></section>`;
}
/* Guardar la configuración y pedir al servidor que vuelva a evaluar los avisos con ella */
async function notifSync() { refresh(); await DataService.flush(); await DataService.refresh(false, true); }
const notifOrg = () => (St.cfg.notif = St.cfg.notif || { tipos: {}, canalOn: {} });
const notifOrgT = id => { const o = notifOrg(); o.tipos = o.tipos || {}; return (o.tipos[id] = o.tipos[id] || {}); };
Chg.notifon = el => { if (FL.verComo) return; if (el.dataset.m === 'org') { if (!(0, ENLACES.esAdministra)()) return; notifOrgT(el.dataset.id).on = el.checked; } else { const u = Object.assign({}, (0, ENLACES.cfgUOf)(miUsuario()).notif || {}); u.tipos = Object.assign({}, u.tipos); u.tipos[el.dataset.id] = Object.assign({}, u.tipos[el.dataset.id], { on: el.checked }); (0, ENLACES.cfgSet)(miUsuario(), { notif: u }); } notifSync(); };
Chg.notifcan = el => { if (FL.verComo) return; const id = el.dataset.id, c = el.dataset.c; if (el.dataset.m === 'org') { if (!(0, ENLACES.esAdministra)()) return; const t = notifOrgT(id); t.canales = Object.assign({}, t.canales, { [c]: el.checked }); } else { const u = Object.assign({}, (0, ENLACES.cfgUOf)(miUsuario()).notif || {}); u.tipos = Object.assign({}, u.tipos); const t = u.tipos[id] = Object.assign({}, u.tipos[id]); t.canales = Object.assign({}, t.canales, { [c]: el.checked }); (0, ENLACES.cfgSet)(miUsuario(), { notif: u }); } notifSync(); };
Chg.notifdest = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; const id = el.dataset.id, t = notifOrgT(id), cur = (t.dest || NC().catalogo.tipos.find(x => x.id === id).dest).slice(), k = el.dataset.k, p = cur.indexOf(k); if (el.checked && p < 0) cur.push(k); if (!el.checked && p >= 0) cur.splice(p, 1); if (!cur.length) { toast('Debe quedar al menos un destinatario', 'err'); refresh(); return; } t.dest = cur; notifSync(); };
Chg.notifdias = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; notifOrgT(el.dataset.id).dias = Math.min(30, Math.max(1, +el.value || 1)); notifSync(); };
Chg.notifcanon = el => { if (!(0, ENLACES.esAdministra)() || FL.verComo) return; const o = notifOrg(); o.canalOn = Object.assign({}, o.canalOn, { [el.dataset.c]: el.checked }); notifSync(); };
Acts.notifreset = () => { if (!(0, ENLACES.esAdministra)()) return; confirmBox('Se restablecerán los destinatarios, parámetros y canales por defecto de toda la organización. ¿Continuar?', () => { delete St.cfg.notif; toast('Valores restablecidos'); notifSync(); }, 'Restablecer', true); };
Acts.notifmyreset = () => { if (FL.verComo) return; const u = (0, ENLACES.cfgUOf)(miUsuario()); delete u.notif; toast('Avisos restablecidos'); notifSync(); };

export const ADM_TABS = [['param', 'Parámetros'], ['cat', 'Catálogos'], ['met', 'Metodología'], ['usr', 'Usuarios y roles'], ['not', 'Notificaciones'], ['cal', 'Calidad de datos'], ['dat', 'Datos y exportación'], ['sp', 'Conexión']];
Views.admin = {
  render() {
    const f = F('adm', { tab: 'param' }); const tabs = ADM_TABS;
    let b = '';
    if (f.tab === 'param') {
      const c = St.cfg;
      b = `<div class="card"><header><h2>Parámetros de negocio</h2><small>Alimentan reglas de negocio, semáforos y KPIs</small></header><div class="fgrid">
        <div class="fld"><label>Unidad monetaria</label><input value="${esc(c.unidad)}" data-chg="cfg" data-k="unidad" data-key="c-unidad"><small>Los montos del portafolio se expresan en esta unidad</small></div>
        <div class="fld"><label>Plazo máximo de una decisión (días)</label><input type="number" min="1" value="${c.decMaxDias}" data-chg="cfg" data-k="decMaxDias" data-num="1" data-key="c-dmax"><small>No se puede registrar una decisión con fecha límite más lejana</small></div>
        <div class="fld"><label>Escalar decisiones tras (días de atraso)</label><input type="number" min="1" value="${c.decEscalaDias}" data-chg="cfg" data-k="decEscalaDias" data-num="1" data-key="c-desc"><small>Pasan a «escalada a Administra», quedan en bitácora y generan alerta del Reglas PMO</small></div>
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
      b = DataService.svc ? usrServidor() : `<div class="card"><header><h2>Usuarios y roles</h2><small>${St.usuarios.length} usuarios · basados en la hoja Usuarios de Gene</small></header><table class="tbl"><thead><tr><th>Usuario</th><th>Cargo</th><th>Rol</th><th>Áreas</th><th>Proyectos liderados</th></tr></thead><tbody>${St.usuarios.map(u => `<tr><td><span class="pp">${avatar(u.n, 24)}<b>${esc(u.n)}</b></span></td><td>${esc(u.cargo)}</td><td><span class="pill soft">${esc(u.rol)}</span></td><td>${esc(u.area)}</td><td class="n">${St.ini.filter(i => i.lider === u.n && isLive(i)).length}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (f.tab === 'cal') {
      const rows = St.ini.map(i => ({ i, c: completitud(i) })).sort(by(r => r.c.pct));
      b = `<div class="card"><header><h2>Auditoría de calidad de datos</h2><small>Promedio ${pct(avg(rows, r => r.c.pct))} · críticos = Sponsor, Líder, Área, Prioridad, Fechas plan</small></header><div class="tbl-w"><table class="tbl"><thead><tr><th>Iniciativa</th><th>Completitud</th><th>Faltan (crítico)</th><th>Faltan (recomendado)</th><th>Faltan (opcional)</th></tr></thead><tbody>${rows.map(({ i, c }) => `<tr data-act="sel" data-t="ini" data-id="${i.id}"><td><b>${esc(i.titulo)}</b><small>${i.id}</small></td><td style="min-width:130px">${prog(c.pct, c.pct > 80 ? 'Verde' : c.pct > 60 ? 'Ámbar' : 'Rojo', 6)}<small>${c.pct}%</small></td><td class="${c.crit.length ? 'neg' : ''}">${esc(c.crit.join(', ') || '—')}</td><td>${esc(c.rec.join(', ') || '—')}</td><td>${esc(c.opt.join(', ') || '—')}</td></tr>`).join('')}</tbody></table></div></div>`;
    } else if (f.tab === 'dat') {
      const sz = Math.round(JSON.stringify(St).length / 1024), cnt = St.ini.length + St.hitos.length + St.riesgos.length + St.decisiones.length + St.bitacora.length + St.comites.length;
      b = `<div class="grid12"><section class="card c6"><header><h2>Exportación y respaldo</h2><small>${cnt} registros · ${sz} KB</small></header><p class="desc">${DataService.svc ? 'Los datos se guardan automáticamente en el servidor (API de APIH).' : '<b>Modo demo:</b> los datos viven solo en memoria. Exporta un respaldo antes de cerrar o conecta SharePoint.'} El Excel completo replica las columnas de cada lista (útil para carga masiva).</p><div class="chips">${btn('Excel completo (6 hojas)', 'xlsxall', { ic: 'down', cls: 'pri' })}${btn('Respaldo JSON', 'expjson', { ic: 'down' })}${btn('Importar iniciativas', 'impini', { ic: 'up', title: 'Agrega o actualiza iniciativas desde un archivo JSON/CSV' })}${btn('Plantilla iniciativas', 'inipl', { ic: 'down' })}${btn('Portfolio CSV', 'pcsv', { ic: 'down' })}${btn('Riesgos CSV', 'riskcsv', { ic: 'down' })}${btn('Hitos CSV', 'hitocsv', { ic: 'down' })}${btn('Bitácora CSV', 'bitcsv', { ic: 'down' })}</div><input type="file" id="impinifile" accept="application/json" style="display:none" data-chg="impinifile"></section>
      </div>`;
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
/* V22.50: importar iniciativas (suma registros, no reemplaza) */
export const INI_PLANTILLA = () => ({ formato: 'apih-iniciativas', v: 1, iniciativas: [
  { tipo: 'Proyecto', titulo: 'APIH Prototipo', desc: 'Prototipo de APIH: origen de los cambios de reglas y vistas, que se traspasan al Corporativo en la misma entrega.', area: 'BISE', lider: St.cfg.usuario || '', sponsor: '', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', avance: 70, inicioPlan: hoy(), finPlan: addD(hoy(), 120), presupuesto: 0 },
  { tipo: 'Proyecto', titulo: 'APIH Corporativo', desc: 'APIH conforme a los requisitos de TI: SPA con Entra ID, API y Azure SQL (3 capas). Reutiliza el núcleo del prototipo.', area: 'BISE', lider: St.cfg.usuario || '', sponsor: '', fase: 'Planificación', estado: 'En curso', rag: 'Verde', prioridad: 'Alta', avance: 5, inicioPlan: hoy(), finPlan: addD(hoy(), 240), presupuesto: 0,
    hitos: [{ nombre: 'Plan aprobado', fase: 'Planificación', fecha: addD(hoy(), 10), cat: 'Gobierno' }, { nombre: 'API lista', fase: 'Ejecución', fecha: addD(hoy(), 60), cat: 'Entregable', subfase: 'Construcción' }, { nombre: 'Piloto con usuarios', fase: 'Ejecución', fecha: addD(hoy(), 90), cat: 'Técnico', subfase: 'Piloto' }],
    subfases: [{ nombre: 'Construcción', fase: 'Ejecución', fin: addD(hoy(), 70), desc: 'Construir y probar en local antes del piloto.' }, { nombre: 'Piloto', fase: 'Ejecución', inicio: addD(hoy(), 71), desc: 'Piloto con un grupo acotado; recoger feedback.' }],
    faseNota: { Ejecución: 'Avanzar solo con las compuertas en verde; coordinar con TI la ventana de despliegue.' },
    _ayuda: 'hitos[].cat: ' + hitoCats().join(', ') + '. hitos[].desc, subfases[].desc, faseNota[<fase>]: texto libre (recordatorio/instrucciones), se ve en Mi cocina. subfases: dentro de UNA fase; inicio/fin vacíos heredan los de la fase. hitos[].subfase: nombre o id de una subfase de la misma fase.' }] });
Acts.inipl = () => { download('APIH_iniciativas_plantilla.json', JSON.stringify(INI_PLANTILLA(), null, 1), 'application/json'); toast('Plantilla descargada'); };
Acts.impini = () => $('#impinifile').click();
Chg.impinifile = el => { const fl = el.files[0]; el.value = ''; if (!fl) return;
  if (!(0, ENLACES.esAdministra)() || FL.verComo) { toast('Solo el rol Administra puede importar iniciativas', 'err'); return; }
  const r = new FileReader(); r.onload = () => { try {
    const o = JSON.parse(r.result), L = Array.isArray(o) ? o : (o && Array.isArray(o.iniciativas) ? o.iniciativas : null);
    if (!L || !L.length) throw new Error('Formato inválido: se espera { "iniciativas": [...] }');
    /* El servidor depura el archivo (campos permitidos, tipos, fechas de fase, subfases, referencias) y omite lo repetido: aquí solo se muestra lo que trae */
    const tit = L.map(x => x && typeof x === 'object' && typeof x.titulo === 'string' ? x.titulo.trim() : '').filter(Boolean), th = L.reduce((a, x) => a + (x && Array.isArray(x.hitos) ? x.hitos.length : 0), 0);
    if (!tit.length) { toast('El archivo no trae iniciativas con título', 'err'); return; }
    confirmBox('El archivo trae <b>' + tit.length + '</b> iniciativa(s) con ' + th + ' hitos: ' + tit.map(esc).join(', ') + '.<br>El servidor omite las que ya existen y avisa lo que no pueda importar. Los datos actuales no se modifican. ¿Continuar?', async () => {
      const res = await cmdServidor('apih_importar_iniciativas', { p_items: L }, null, false); if (res === null) return;
      const avisos = res.avisos || [], om = res.omitidas || [], nn = (res.creadas || []).length;
      if (!nn) { toast('Nada que importar: ' + (om.length ? 'todas ya existen o no traen título (' + om.join(', ') + ')' : 'sin iniciativas válidas'), 'err'); return; }
      toast(nn + ' iniciativa(s) importada(s), ' + res.hitos + ' hitos, ' + res.riesgos + ' riesgos' + (res.subfases ? ', ' + res.subfases + ' subfases' : '') + (avisos.length ? ' · ' + avisos.length + ' aviso(s): ' + avisos.slice(0, 2).join(' | ') : ''), avisos.length ? 'err' : 'ok'); refresh();
      if (avisos.length) Modal.open({ title: 'Avisos de la importación', body: '<p class="mut">Lo demás se importó. Corrige estos puntos en el archivo o en la ficha:</p><ul>' + avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>', footer: '<button class="btn pri" data-act="mclose">Entendido</button>' });
    }, 'Importar');
  } catch (e) { toast('No se pudo importar: ' + e.message, 'err'); } }; r.readAsText(fl); };
/* V22.52: proyecto <-> archivo (exportar con instrucciones, importar con vista previa) */
const ARCH_TXT = ['titulo', 'desc', 'bc', 'sponsor', 'lider', 'negocio', 'categoria', 'resumen', 'logros', 'proximos', 'issue', 'riesgoTxt'], ARCH_NUM = ['avance', 'presupuesto', 'gastado', 'beneficio'], ARCH_DATE = ['inicioPlan', 'finPlan', 'finEst'];
export const archFecha = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && +v.slice(0, 4) >= 1900 && +v.slice(0, 4) <= 2100;   // N-S-03: años 1900-2100
function archPendientes(i) {
  const p = [], hs = hitosDe(i.id), rs = riesgosDe(i.id), um = (0, ENLACES.cfgI)(i, 'umbralCritico');
  [['desc', 'Descripción / objetivo'], ['sponsor', 'Sponsor'], ['lider', 'Líder'], ['negocio', 'Responsable de negocio'], ['inicioPlan', 'Inicio plan'], ['finPlan', 'Fin plan'], ['logros', 'Logros del período'], ['proximos', 'Próximos pasos']].forEach(([k, n]) => { if (!String(i[k] || '').trim()) p.push('Falta: ' + n); });
  if (!(i.presupuesto > 0)) p.push('Falta: presupuesto (si es transversal o sin costo, confirmarlo con el usuario)');
  if (hs.length < 2) p.push('Hitos insuficientes: hay ' + hs.length + ', se requieren al menos 2 (idealmente 3 a 6 por fase)');
  FASES_PRJ.forEach(f => { if (!esProp(i) && !hs.some(h => h.fase === f) && f !== 'Cierre') p.push('Sin hitos en la fase ' + f); });
  hs.filter(h => !h.completado && h.fecha < hoy()).forEach(h => p.push('Hito vencido sin cerrar: ' + h.id + ' «' + h.nombre + '» (' + h.fecha + '): ¿se completó? ¿nueva fecha?'));
  if (!rs.length) p.push('Sin riesgos registrados: preguntar por los 3 a 5 principales (técnico, alcance, recursos, proveedor, cronograma, financiero, regulatorio)');
  rs.filter(r => riesgoCritico(r) && !String(r.mit || '').trim()).forEach(r => p.push('Riesgo crítico sin mitigación: ' + r.id + ' «' + r.desc + '»'));
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
  const r = new FileReader(); r.onload = async () => {   // V5: la vista previa y la aplicación las decide el servidor (apih_importar_proyecto)
    const txt = String(r.result), pre = await cmdServidor('apih_importar_proyecto', { p_ini: id, p_archivo: txt, p_simular: true }, null, false); if (pre === null) return;
    const om = pre.omitidos || [], cam = pre.cambios || [], lst = a => a.slice(0, 40).map(x => '• ' + esc(x)).join('<br>') + (a.length > 40 ? '<br>… y ' + (a.length - 40) + ' más' : '');
    if (pre.bloqueo) { Modal.close && Modal.close(); toast('Archivo rechazado: ' + pre.bloqueo, 'err'); return; }
    if (!cam.length) { Modal.close && Modal.close(); toast(om.length ? 'Sin cambios válidos. ' + om.slice(0, 3).join(' | ') : 'El archivo no trae cambios', 'err'); return; }
    confirmBox('<b>Revisar cambios del archivo</b><br>' + cam.length + ' cambio(s) propuesto(s) en ' + esc(i.titulo) + ' (formato: campo: antes → después):<br><br>' + lst(cam) + (om.length ? '<br><br><b style="color:var(--red)">Se omiten ' + om.length + ':</b><br>' + om.slice(0, 15).map(x => '✕ ' + esc(x)).join('<br>') : '') + '<br><br>¿Aplicar?', () =>
      cmdServidor('apih_importar_proyecto', { p_ini: id, p_archivo: txt, p_simular: false }, null).then(x => { if (x === null) return; const e = [...(x.omitidos || []), ...(x.errores || [])]; toast(x.ok + ' cambio(s) aplicados' + (e.length ? ' · ' + e.length + ' omitidos: ' + e.slice(0, 2).join(' | ') : ''), e.length ? 'warn' : undefined); refresh(); }), 'Aplicar');
  }; r.readAsText(fl); };


/* ---------- Administración → Usuarios (servidor): cuentas pendientes, rol, áreas y proyectos asignados ---------- */
const USR_ROLES = ['Administra', 'Responsable', 'Colaborador', 'Invitado'];
function usrCargar() {
  UI.usrs = 'cargando';
  DataService.svc.usuarios().then(l => { UI.usrs = l; UI.usrsErr = ''; }).catch(e => { UI.usrs = []; UI.usrsErr = e.message; }).then(() => { if (F('adm', {}).tab === 'usr') render(); });
}
function usrServidor() {
  if (!Array.isArray(UI.usrs)) { if (UI.usrs !== 'cargando') usrCargar(); return `<div class="card"><header><h2>Usuarios y roles</h2></header><p class="mut">Cargando usuarios…</p></div>`; }
  const L = UI.usrs, pend = L.filter(u => u.pendiente).length;
  const estado = u => u.pendiente ? '<span class="pill" style="background:#FFF4CE;color:#7A5200">Pendiente</span>' : u.activo ? '<span class="pill soft">Activo</span>' : '<span class="pill" style="background:#F3D6D6;color:#8A1F1F">Inactivo</span>';
  const fila = u => `<tr><td><span class="pp">${avatar(u.nombre || u.email, 24)}<span><b>${esc(u.nombre || u.email)}</b><br><small class="mut">${esc(u.email)}</small></span></span></td><td>${u.pendiente ? '<span class="mut">Sin rol</span>' : `<span class="pill soft">${esc(u.appRol)}</span>`}</td><td>${esc((u.areas || []).join(', ') || '—')}</td><td>${(u.proyectos || []).length ? esc(u.proyectos.join(', ')) : '—'}</td><td>${estado(u)}</td><td class="n">${btn(u.pendiente ? 'Asignar rol' : 'Editar', 'usredit', { d: { id: u.email }, cls: 'sm' })}${u.pendiente || u.activo ? btn(u.pendiente ? 'Rechazar' : 'Desactivar', 'usroff', { d: { id: u.email }, cls: 'sm danger' }) : ''}</td></tr>`;
  return `<div class="card"><header><h2>Usuarios y roles</h2><small>${L.length} cuentas${pend ? ' · <b>' + pend + ' pendiente(s) de rol</b>' : ''}</small></header>
    <div class="note">${icon('info', 14)}<span>Cualquiera puede crear su cuenta; queda <b>pendiente</b> y no ve nada hasta que le asignes un rol. Si le asignas <b>proyectos en particular</b>, esos son <b>lo único que verá</b> (y, si es Colaborador o Responsable, podrá editarlos); sus áreas dejan de contar. Sin proyectos asignados, rige por áreas.</span></div>
    ${UI.usrsErr ? `<p class="mut" style="color:var(--red)">${esc(UI.usrsErr)}</p>` : ''}
    <div class="tbl-w"><table class="tbl"><thead><tr><th>Persona</th><th>Rol</th><th>Áreas</th><th>Proyectos asignados</th><th>Estado</th><th></th></tr></thead><tbody>${L.map(fila).join('') || '<tr><td colspan="6" class="mut">Sin cuentas</td></tr>'}</tbody></table></div></div>`;
}
Acts.usredit = d => {
  const u = (UI.usrs || []).find(x => x.email === d.id); if (!u) return;
  openForm({
    title: (u.pendiente ? 'Asignar rol a ' : 'Editar a ') + (u.nombre || u.email), saveLabel: u.pendiente ? 'Asignar y activar' : 'Guardar', wide: true,
    values: { nombre: u.nombre, cargo: u.cargo, appRol: u.pendiente ? 'Colaborador' : u.appRol, areas: u.areas || [], proyectos: u.proyectos || [], veTodo: !!u.veTodo, veMontos: !!u.veMontos, gobierna: !!u.gobierna, activo: true },
    fields: [
      { k: 'nombre', l: 'Nombre', w: 2 }, { k: 'cargo', l: 'Cargo', w: 1 },
      { k: 'appRol', l: 'Rol', t: 'select', opts: USR_ROLES, req: true, w: 1, hint: 'Administra: todo · Responsable: ve todo y gobierna · Colaborador: edita su área · Invitado: solo lectura' },
      { k: 'areas', l: 'Áreas que ve y edita', t: 'multi', opts: St.cfg.areas.map(a => ({ v: a, t: a })), w: 3 },
      { k: 'proyectos', l: 'Proyectos asignados', t: 'multi', opts: iniOpts(), w: 3, hint: 'Si eliges proyectos, la persona ve y edita SOLO esos: sus áreas y «ve todas las áreas» dejan de ampliar el alcance. Déjalo vacío para que rija por áreas.' },
      { k: 'veTodo', l: 'Alcance', t: 'check', lbl: 'Ve todas las áreas (solo lectura fuera de las suyas)', w: 3 },
      { k: 'veMontos', l: 'Montos', t: 'check', lbl: 'Ve presupuestos y montos', w: 3 },
      { k: 'gobierna', l: 'Gobierno', t: 'check', lbl: 'Gestiona comités y decisiones', w: 3 }
    ],
    onSave: o => { return cmdServidor('apih_guardar_usuario', { p_email: u.email, p_datos: Object.assign({}, o, { activo: true }) }, u.pendiente ? 'Cuenta activada' : 'Usuario guardado', true).then(r => { if (r !== null) usrCargar(); return r !== null; }); }
  });
};
Acts.usroff = d => {
  const u = (UI.usrs || []).find(x => x.email === d.id); if (!u) return;
  confirmBox(`¿${u.pendiente ? 'Rechazar la cuenta de' : 'Desactivar a'} <b>${esc(u.nombre || u.email)}</b>? No podrá ver ni editar nada.`, () => { cmdServidor('apih_desactivar_usuario', { p_email: u.email }, 'Acceso desactivado').then(r => { if (r !== null) usrCargar(); }); }, u.pendiente ? 'Rechazar' : 'Desactivar', true);
};

/* ---------- Administración → Conexión ---------- */
function spTab() {
  const d = DataService, i = syncInfo(), c = APIH_CONFIG, u = AuthService.user();
  const host = (() => { try { return new URL(c.api.url || location.origin, location.origin).hostname; } catch (e) { return '—'; } })();
  const mode = d.svc ? 'Servidor (API de APIH)' : 'Demo (memoria)';
  const schema = Object.keys(ESQUEMA).map(e => { const S = ESQUEMA[e]; return `<details class="sch"><summary>${esc(c[S.cfg])} <span class="mut">· ${S.label} · ${S.cols.length + 1} columnas</span></summary><div class="tbl-w"><table class="tbl"><thead><tr><th>Columna</th><th>Tipo</th><th>Campo de dominio</th><th>Detalle</th></tr></thead><tbody>${S.cols.map(x => `<tr><td class="mono">${x.n}${x.n === 'Title' ? ' <span class="mut">(' + esc(S.title) + ')</span>' : ''}</td><td>${x.t}</td><td class="mono">${x.k || '—'}</td><td>${x.ch ? esc(x.ch.join(' · ')) : x.rw ? 'editable fuera de la app' : x.get ? 'calculada' : 'clave'}</td></tr>`).join('')}<tr><td class="mono">DatosJSON</td><td>Note</td><td class="mono">(objeto completo)</td><td>Conserva campos sin columna propia</td></tr></tbody></table></div></details>`; }).join('') +
    `<details class="sch"><summary>${esc(c.settingsList)} <span class="mut">· Config · 2 columnas</span></summary><p class="desc">Title = clave (${SETTINGS_KEYS.join(', ')}) · DatosJSON = valor. El usuario actual y el filtro de área son de sesión y no se comparten.</p></details>`;
  const lista = (et, nom) => `<tr><td>${esc(et)}</td><td class="mono">${esc(nom)}</td></tr>`;
  return `<div class="grid12"><section class="card c7"><header><h2>Conexión a la API</h2><small><span class="dot-s ${i.c}"></span> ${esc(i.t)} · ${mode}</small></header>
    <div class="note ${d.svc ? '' : 'warn'}">${icon('db', 14)}<span>${d.svc ? 'Conectado. Los cambios se sincronizan solos (registro por registro, con reintentos y detección de conflictos). ' + (d.st.last ? 'Último sync: ' + d.st.last.toTimeString().slice(0, 8) + '.' : '') : esc(i.tip)}</span></div>
    <div class="fgrid sp-fg"><div class="fld"><label>Servidor</label><input value="${esc(host)}" readonly></div><div class="fld"><label>Sesión</label><input value="${esc(u ? u.email : 'sin sesión')}" readonly></div>
    <div class="fld"><label>Refresco automático (s)</label><input value="${esc(c.pollSec)}" data-chg="spc" data-p="pollSec" data-key="sp-pollSec"><small>0 = desactivado</small></div></div>
    <div class="chips" style="margin-top:12px">${btn('Conectar / recargar', 'spconnect', { ic: 'refresh', cls: 'pri' })}${btn('Probar conexión', 'sptest', { ic: 'check' })}${btn('Sincronizar ahora', 'spsync', { ic: 'refresh' })}${u ? btn('Cerrar sesión (' + u.name + ')', 'splogout', { ic: 'lock' }) : btn('Iniciar sesión', 'login', { ic: 'lock' })}</div>
    <div class="logbox" id="splog" style="margin-top:12px">${esc(UI.splog || 'Sin actividad. Use “Probar conexión” para validar el acceso a las listas.')}</div></section>
    <section class="card c5"><header><h2>Listas</h2><small>Fijas: coinciden con las reglas del servidor</small></header><div class="tbl-w"><table class="tbl"><thead><tr><th>Contenido</th><th>Lista</th></tr></thead><tbody>${lista('Proyectos', c.projectsList)}${lista('Propuestas', c.proposalsList)}${lista('Riesgos', c.risksList)}${lista('Hitos', c.milestonesList)}${lista('Decisiones', c.decisionsList)}${lista('Bitácora (auditoría)', c.auditList)}${lista('Comités', c.committeesList)}${lista('Configuración', c.settingsList)}${lista('Roles y usuarios', c.rolesList)}</tbody></table></div>
    <p class="mut" style="font-size:12px;margin-top:10px">Las tablas, políticas y comandos del servidor se crean con las migraciones de <b>db/azure-sql/migraciones</b>. La autorización por rol, área y monto se aplica en el servidor, no en esta pantalla.</p></section></div>
    <section class="card"><header><h2>Esquema de entidades</h2><small>ID de dominio = Title (Riesgos, Decisiones, Bitácora) o Codigo (Proyectos, Hitos, Comités)</small></header>${schema}</section>`;
}
Chg.spc = el => { if (el.dataset.p === 'pollSec') { APIH_CONFIG.pollSec = Math.max(0, +el.value || 0); DataService.startPoll(); } };
const splog = t => { UI.splog = t; const b = $('#splog'); if (b) b.textContent = t; };
Acts.sptest = async () => { splog('Probando…'); try { splog((await DataService.testConnection()).join('\n')); } catch (e) { splog('✘ ' + e.message); } };
Acts.spconnect = async () => {
  splog('Conectando…'); if (DataService.svc) await DataService.flush();
  const S = await DataService.init(); ENLACES.St = S; UI.sel = null; shell(); render();
  splog(DataService.svc ? '✔ Conectado a la API · ' + St.ini.length + ' proyectos, ' + St.riesgos.length + ' riesgos, ' + St.hitos.length + ' hitos.' : '✘ ' + (DataService.offlineWhy || DataService.st.err || 'Modo demo'));
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
  const prev = L[+d.n - 1];
  confirmBox(`¿Eliminar la fase <b>${esc(x)}</b>? Los hitos de esa fase pasan a «${esc(prev)}». Si hay iniciativas en ella, el servidor no lo permite.`, async () => {
    const r = await cmdServidor('apih_fase_cascada', { p_accion: 'eliminar', p_de: x, p_a: prev }, null);   // el servidor valida y mueve los hitos
    if (r === null) return;
    L.splice(+d.n, 1); m.tipos.forEach(t => t.hitos.forEach(h => { if (h.fase === x) h.fase = prev; })); refresh();
  }, 'Eliminar', true);
};
Acts.fasmv = d => { const m = MET(), L = d.w === 'prop' ? m.fasesProp : m.fasesPrj, n = +d.n, k = n + (+d.d); if (n <= 0 || n >= L.length - 1 || k <= 0 || k >= L.length - 1) return; [L[n], L[k]] = [L[k], L[n]]; refresh(); };
Chg.fasren = async el => {
  const m = MET(), L = el.dataset.w === 'prop' ? m.fasesProp : m.fasesPrj, n = +el.dataset.n, old = L[n], v = el.value.trim();
  if (!v || v === old) return render(); if (FASES_FIJAS.includes(old)) return render();
  if ([...m.fasesProp, ...m.fasesPrj].some(x => x.toLowerCase() === v.toLowerCase())) { toast('Ya existe una fase con ese nombre', 'err'); return render(); }
  L[n] = v; FASE_COLOR[v] = FASE_COLOR[old];
  if (m.faseDesc && m.faseDesc[old] !== undefined) { m.faseDesc[v] = m.faseDesc[old]; delete m.faseDesc[old]; }
  m.tipos.forEach(t => t.hitos.forEach(h => { if (h.fase === old) h.fase = v; }));
  save();   // primero la configuración (nombre nuevo); el servidor lo espera y mueve iniciativas, subfases, notas y hitos
  await cmdServidor('apih_fase_cascada', { p_accion: 'renombrar', p_de: old, p_a: v }, null); render();
};
Acts.metreset = () => confirmBox('Se restablecen fases y tipos a la metodología sugerida. Las iniciativas en fases personalizadas pasan a la fase base. ¿Continuar?', async () => {
  St.cfg.metodo = METODO_DEF(); F('adm', {}).tipo = null; save();
  await cmdServidor('apih_fase_cascada', { p_accion: 'restablecer', p_de: '', p_a: null }, 'Metodología restablecida');
}, 'Restablecer', true);
