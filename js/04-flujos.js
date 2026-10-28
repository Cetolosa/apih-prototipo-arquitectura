import { ENLACES } from './00-registro.js';
import { $, CALC, ACUERDOS, DECS, EST_MOTIVO, EST_REVISION, FASES_ACT, FASES_PRJ, FASES_PROP, HITOS, PRJS, RIESGOS, St, addD, aplicarPlantilla, by, byId, clone, completitud, diasSinUpd, diffD, esProp, esSB, esc, estadosDe, fasesDe, fmtD, fmtMon, compuertas, hitosDe, hoy, icon, inArea, isDone, isLive, log, miUsuario, monOf, nameOf, nextId, riesgoAbierto, roi, tipoLbl } from './01-nucleo.js';
import { DataService } from './02-datos.js';
import { Acts, Chg, Modal, UI, confirmBox, estTag, iniLink, kv, openForm, prog, refresh, tipoPill, toast } from './03-interfaz.js';
/* =====================================================================
   V5 · Flujo Propuesta → Proyecto
   migración de datos V3/V4, aprobación (crea el proyecto), cambio de estado
   con motivo/fecha de revisión, reapertura de propuestas
   ===================================================================== */

/* Convierte el modelo anterior (una sola entidad INI-xxx) al modelo V5 (PROP-/PRJ-) */
export function migrateV5(S) {
  if (!S || !S.ini || S.ini.every(i => i.tipo)) return S;
  const OLDP = ['Propuesta', 'Recepción', 'Evaluación', 'Caso Negocio', 'Caso de Negocio', 'Aprobación'];
  const map = {}, meta = []; let np = 0, nj = 0; const p3 = n => String(n).padStart(3, '0');
  S.ini.forEach(i => { const prop = i.tipo ? i.tipo === 'Propuesta' : OLDP.includes(i.fase); const id = (prop ? 'PROP-' : 'PRJ-') + p3(prop ? ++np : ++nj); map[i.id] = id; meta.push({ old: i.id, prop }); });
  const T = JSON.parse(JSON.stringify(S).replace(/INI-\d+/g, m => map[m] || m));   // reasigna todas las referencias (hitos, riesgos, decisiones, bitácora, comités…)
  const EP = { 'En espera': 'En espera', 'Pausada': 'En espera', 'Cancelada': 'Rechazada', 'Completada': 'Aprobada', 'En curso': 'Vigente' };
  const EJ = { 'En espera': 'Pausado', 'Pausada': 'Pausado', 'Cancelada': 'Cancelado', 'Completada': 'Completado', 'En curso': 'En curso' };
  T.ini.forEach((i, k) => {
    const prop = meta[k].prop; i.tipo = prop ? 'Propuesta' : 'Proyecto'; i.legacyId = meta[k].old;
    if (i.fase === 'Propuesta') i.fase = 'Recepción'; if (i.fase === 'Caso Negocio') i.fase = 'Caso de Negocio';
    i.estado = (prop ? EP : EJ)[i.estado] || (prop ? 'Vigente' : 'En curso');
    if (prop) { i.rag = i.rag || 'Verde'; } 
    i.propuestaOrigen = i.propuestaOrigen || null; i.faseDesde = i.faseDesde || i.actualizada || i.creada || null;
    i.estadoMotivo = i.estadoMotivo || ''; i.estadoRev = i.estadoRev || null;
    if (i.estado === 'En espera' || i.estado === 'Pausado') { i.estadoMotivo = i.estadoMotivo || 'Migrado de versión anterior'; i.estadoRev = i.estadoRev || addD(hoy(), 30); }
  });
  return T;
}
export const diasEnFase = i => diffD(hoy(), i.faseDesde || i.actualizada || i.creada || hoy());
export function semFase(i) { const d = diasEnFase(i), a = (0, ENLACES.cfgI)(i,'propDiasAmb') || 30, r = (0, ENLACES.cfgI)(i,'propDiasRojo') || 60; return d > r ? { c: '#D13438', d } : d > a ? { c: '#F2A100', d } : { c: '#107C10', d }; }

Acts.aprobar = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const p = byId(d.id), g = compuertas(p), miss = g.filter(x => !x.ok);
  Modal.open({
    title: 'Aprobar propuesta · ' + p.titulo,
    body: `<p class="desc">Al aprobar, la propuesta se cierra como <b>Aprobada</b> y se crea un <b>proyecto nuevo</b> en fase Planificación. Sus riesgos y datos pasan al proyecto.</p><div class="gates" style="margin-top:8px">${g.map(x => `<div class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'x', 14)}<span>${esc(x.t)}</span></div>`).join('')}</div>
    ${miss.length && (0, ENLACES.esAdministra)() ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="advforce"> <span>Aprobar pese a ${miss.length} compuerta(s) incumplida(s) (queda registrado)</span></label>` : ''}
    <div class="fgrid one" style="margin-top:10px"><div class="fld"><label for="apr_nota">Nota de aprobación (opcional)</label><textarea id="apr_nota" rows="2"></textarea></div></div>`,
    footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="aprobargo" data-id="${p.id}">Aprobar y crear proyecto</button>`
  });
};
Acts.aprobargo = d => {
  const p = byId(d.id), miss = compuertas(p).filter(x => !x.ok), force = $('#advforce') && $('#advforce').checked;
  return aprobarEnServidor(p, miss, force, ($('#apr_nota') || {}).value || '');   // transacción única en la base
};

/* Comandos del servidor: antes de pedirlos, el servidor debe tener lo último que editaste; después se recarga el estado */
async function esperarSync() { for (let k = 0; k < 40 && (DataService.busy || DataService.dirty); k++) { if (!DataService.busy) DataService.flush(); await new Promise(r => setTimeout(r, 250)); } }
async function hitoEnServidor(id, completado) {
  try { await esperarSync(); const r = await DataService.svc.rpc('apih_hito_estado', { p_id: id, p_completado: completado }); await DataService.refresh(false, true); toast(r && r.autoCompletado ? 'Hito completado · el proyecto se cerró al terminar su última fase' : completado ? 'Hito completado' : 'Hito reabierto'); }
  catch (e) { errorServidor(e); }
}
export async function resolverEnServidor(x, o) {
  try {
    await esperarSync();
    const r = await DataService.svc.rpc('apih_resolver_decision', { p_id: x.id, p_estado: o.estado, p_resolucion: o.resolucion || '', p_fecha: o.fResol || null, p_aplicar: !!o.aplicar });
    await DataService.refresh(false, true);
    if (r && r.aviso) toast(r.aviso, 'err');
    if (r && r.proyecto) toast('Proyecto ' + r.proyecto + ' creado desde ' + x.ini); else if (o.estado === 'Diferida') toast('Decisión diferida 14 días'); else toast('Decisión ' + o.estado.toLowerCase());
  } catch (e) { errorServidor(e); }
}
/* Comando genérico del servidor: pide, recarga y avisa; el error de la base se muestra sin el prefijo interno */
export async function cmdServidor(nombre, params, msg, enForm) {
  try { await esperarSync(); const r = await DataService.svc.rpc(nombre, params); await DataService.refresh(false, true); if (msg) toast(msg); return r === null || r === undefined ? {} : r; }
  catch (e) { errorServidor(e, enForm); return null; }
}
/* Error del servidor: mensaje claro (sin el prefijo interno) y, si el servidor indicó el campo, se marca en el formulario abierto */
function errorServidor(e, enForm) {
  const m = e && (e.detalle || String(e.message || e).replace(/^APIH:\s*/, ''));
  toast(m, 'err');
  if (enForm && e && e.campo) { const el = $('#f_' + e.campo); if (el) { el.classList.add('bad'); const tp = el.closest('.ftab'); if (tp && !tp.classList.contains('on')) Acts.ftab({ t: tp.dataset.t }); el.focus(); } }
}
/* Con servidor (Supabase): la aprobación es un comando transaccional en la base (apih_aprobar_propuesta); aquí solo se pide y se recarga */
export async function aprobarEnServidor(p, miss, force, nota) {
  if (miss.length && !(0, ENLACES.esAdministra)()) return toast('Hay compuertas incumplidas. Solo el rol Administra puede forzarlas: completa los datos.', 'err');
  if (miss.length && !force) return toast(`Hay ${miss.length} compuerta(s) sin cumplir. Pulsa «Corregir» en cada una o marca «Forzar cambio» (solo Administra).`, 'err');
  try {
    await esperarSync();
    const nid = await DataService.svc.rpc('apih_aprobar_propuesta', { p_id: p.id, p_nota: nota.trim(), p_forzar: !!(miss.length && force) });
    await DataService.refresh(false, true);
    Modal.close(); UI.sel = { t: 'ini', id: nid }; UI.tab = 'resumen'; toast('Proyecto ' + nid + ' creado. Siguiente paso: planifica sus hitos y riesgos'); refresh();
  } catch (e) { errorServidor(e); }
}
/* =====================================================================
   V23 · «Cambiar etapa»: UN solo diálogo para mover de fase, cambiar de estado, aprobar y completar.
   Antes eran tres entradas (Fase, Estado, Aprobar) más el formulario Editar y el arrastre del pipeline.
   Con servidor, el cambio es un comando transaccional (apih_transicion) que vuelve a evaluar las compuertas en la base.
   ===================================================================== */
const ETIQ_ESTADO = { 'Pausado': 'Pausar', 'En espera': 'Poner en espera', 'Stand By': 'Dejar en Stand By', 'Cancelado': 'Cancelar proyecto', 'Rechazada': 'Rechazar propuesta', 'Retirada': 'Retirar propuesta', 'En curso': 'Reactivar proyecto', 'Vigente': 'Reactivar propuesta' };
/* Movimientos posibles: los define el servidor (apih_etapas), con sus compuertas. Se guardan mientras el diálogo está abierto. */
let ETAPAS = [];
const etapaPorId = id => ETAPAS.find(x => x.id === id);
/* Al avanzar de fase el servidor propone reprogramar el plan desde hoy (apih_plan_cambio_fase) y lo aplica dentro del mismo cambio (p_reprogramar).
   Aquí solo se redacta lo que el servidor devuelve. */
const lineasPlan = pl => {
  const L = [`<b>${esc(pl.destino)}</b> empieza hoy (${fmtD(pl.hoy)}); según el plan era el ${fmtD(pl.inicioDestinoPlan)}${pl.delta ? ` (${pl.delta > 0 ? '+' : ''}${pl.delta} d)` : ''}.`];
  L.push(`<b>${esc(pl.faseActual)}</b>${pl.saltadas ? ' y las fases que se saltan' : ''} termina${pl.saltadas ? 'n' : ''} el ${fmtD(pl.ayer)}.`);
  if (pl.delta && pl.sigueFase) L.push(`Las fases que siguen se mueven ${Math.abs(pl.delta)} d ${pl.delta > 0 ? 'más tarde' : 'antes'} y conservan su duración.`);
  if (pl.rango0.fin !== pl.rango1.fin) L.push(`Fin del proyecto: ${fmtD(pl.rango0.fin)} → <b>${fmtD(pl.rango1.fin)}</b>.`);
  if (pl.subs.length) L.push(`${pl.subs.length} subfase${pl.subs.length === 1 ? '' : 's'} se ajusta${pl.subs.length === 1 ? '' : 'n'} a las nuevas fechas.`);
  return L;
};
Acts.etapa = async d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const i = byId(d.id); if (!i) return; if (isDone(i)) return toast(tipoLbl(i) + ' en estado final (' + i.estado + ')', 'err');
  let L; try { await esperarSync(); L = await DataService.svc.rpc('apih_etapas', { p_id: i.id }); } catch (e) { return errorServidor(e); }
  ETAPAS = L = L || []; if (!L.length) return toast('No hay movimientos posibles para esta ' + tipoLbl(i).toLowerCase(), 'err');
  const F_ = fasesDe(i), idx = F_.indexOf(i.fase), sig = L.find(x => x.id === 'f:' + F_[idx + 1]) || L.find(x => x.id === 'aprobar') || L[0], pre = (d.pre === 'estado' ? L.find(x => x.kind === 'estado' && x.id !== 'e:Completado') : d.pre && L.find(x => x.id === d.pre)) || sig;
  const grupos = [...new Set(L.map(x => x.g))];
  Modal.open({
    title: 'Cambiar etapa · ' + i.titulo,
    body: `<div class="flow big">${F_.map((x, k) => `<span class="${k < idx ? 'done' : k === idx ? 'cur' : ''}"><i></i>${esc(x)}</span>`).join('')}</div><p class="mut" style="margin:6px 0 0">Ahora: fase <b>${esc(i.fase)}</b> · estado <b>${esc(i.estado)}</b></p>
    <div class="fgrid"><div class="fld w3"><label for="et_acc">¿Qué quieres hacer?</label><select id="et_acc" data-chg="etapaacc" data-id="${i.id}">${grupos.map(g => `<optgroup label="${esc(g)}">${L.filter(x => x.g === g).map(x => `<option value="${esc(x.id)}"${x.id === pre.id ? ' selected' : ''}>${esc(x.t)}</option>`).join('')}</optgroup>`).join('')}</select></div></div><div id="et_d" style="margin-top:6px"></div>`,
    footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" data-act="etapago" data-id="${i.id}">Aplicar</button>`
  });
  Chg.etapaacc($('#et_acc'));
};
Chg.etapaacc = async el => {
  const i = byId(el.dataset.id), a = etapaPorId(el.value); if (!a) return;
  let pl = null; if (a.kind === 'fase') { try { pl = await DataService.svc.rpc('apih_plan_cambio_fase', { p_id: i.id, p_to: a.to }); } catch (e) { pl = null; } if (el.value !== a.id) return; }
  const miss = a.gates.filter(x => !x.ok), adm = (0, ENLACES.esAdministra)();
  const g = a.gates.length ? `<div class="gates">${a.gates.map(x => `<div class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'x', 14)}<span>${esc(x.t)}</span>${x.ok ? '' : ` <a class="lnk" data-act="gfix" data-id="${i.id}">Corregir</a>`}</div>`).join('')}</div>` : (a.kind === 'fase' ? '<p class="mut">Sin compuertas para esta fase.</p>' : '');
  const campos = a.kind === 'estado' && (a.motivo || a.rev) ? `<div class="fgrid">${a.motivo ? `<div class="fld w3"><label for="et_mot">Motivo (obligatorio)</label><textarea id="et_mot" rows="2" maxlength="500">${esc(i.estadoMotivo || '')}</textarea></div>` : ''}${a.rev ? `<div class="fld w2"><label for="et_rev">Fecha de revisión (obligatoria)</label><input id="et_rev" type="date" value="${esc(i.estadoRev || '')}"></div>` : ''}</div>` : '';
  const nota = a.kind === 'estado' && a.estado === 'Stand By' ? `<p class="mut" style="font-size:12px">Stand By saca la ${tipoLbl(i).toLowerCase()} de indicadores, alertas y presentación (solo se cuenta). Para reactivarla vuelve a este diálogo.</p>` : a.kind === 'aprobar' ? '<p class="mut" style="font-size:12px">Se abrirá la aprobación: crea el proyecto y traspasa hitos y riesgos.</p>' : '';
  const forzar = miss.length && adm ? `<label class="chk" style="margin-top:8px"><input type="checkbox" id="et_force"> <span>Forzar pese a ${miss.length} compuerta(s) incumplida(s) (queda registrado en bitácora)</span></label><div class="fld" id="et_fw" style="display:none;margin-top:8px"><label for="et_fmot">Motivo del cambio forzado (obligatorio)</label><input id="et_fmot" type="text" maxlength="200"></div>` : (miss.length ? '<p class="mut" style="font-size:12px">Completa las condiciones pendientes: solo el rol Administra puede forzarlas.</p>' : '');
  const repro = pl ? `<div class="et-plan"><label class="chk"><input type="checkbox" id="et_repro" ${pl.error ? 'disabled' : 'checked'}> <span><b>Reprogramar el plan desde hoy</b></span></label>${pl.error ? `<p class="mut" style="font-size:12px;margin:4px 0 0">No se puede reprogramar solo: ${esc(pl.error)}. Cambia la fase y ajusta las fechas en la ficha.</p>` : `<ul>${lineasPlan(pl).map(x => `<li>${x}</li>`).join('')}</ul>`}</div>` : '';
  $('#et_d').innerHTML = g + repro + campos + nota + forzar;
  const fc = $('#et_force'); if (fc) fc.addEventListener('change', () => { $('#et_fw').style.display = fc.checked ? '' : 'none'; });
};
Acts.etapago = async d => {
  const i = byId(d.id); if (!i) return; const a = etapaPorId(($('#et_acc') || {}).value); if (!a) return;
  if (a.kind === 'aprobar') { Modal.close(); return Acts.aprobar({ id: i.id }); }
  const miss = a.gates.filter(x => !x.ok), force = !!($('#et_force') && $('#et_force').checked);
  if (miss.length && !force) return toast(`Hay ${miss.length} compuerta(s) sin cumplir. Pulsa «Corregir» en cada una o marca «Forzar» (solo Administra).`, 'err');
  const fmot = miss.length ? String(($('#et_fmot') || {}).value || '').trim() : '';
  if (miss.length && !fmot) return toast('Indica el motivo del cambio forzado', 'err');
  const motivo = a.motivo ? String(($('#et_mot') || {}).value || '').trim() : '', rev = a.rev ? String(($('#et_rev') || {}).value || '') : '';
  if (a.motivo && !motivo) return toast('Indica el motivo del estado ' + a.estado, 'err');
  if (a.rev && !rev) return toast('Indica la fecha de revisión', 'err');
  const repro = a.kind === 'fase' && !!($('#et_repro') && $('#et_repro').checked);
  const ir = async () => {
    const r = await cmdServidor('apih_transicion', { p_id: i.id, p_fase: a.kind === 'fase' ? a.to : null, p_estado: a.kind === 'estado' ? a.estado : null, p_motivo: motivo, p_rev: rev || null, p_forzar: !!(miss.length && force), p_nota: fmot, p_reprogramar: repro }, null, false);
    if (r === null) return; Modal.close(); toast(a.kind === 'fase' ? 'Fase actualizada a ' + a.to + (repro ? ' y plan reprogramado' : '') : 'Estado actualizado a ' + a.estado); refresh();
  };
  if (a.kind === 'estado' && a.estado === 'Cancelado') { Modal.close(); return confirmBox('¿Cancelar «' + esc(i.titulo) + '»? Dejará de contar en KPIs y alertas. Puedes reabrirlo después.', ir, 'Cancelar proyecto', true); }
  return ir();
};
/* Alias: los botones y enlaces anteriores abren el mismo diálogo ya posicionado */
Acts.advance = d => { const i = byId(d.id); if (i && esProp(i) && i.fase === fasesDe(i)[fasesDe(i).length - 1] && !isDone(i) && !esSB(i)) return Acts.aprobar({ id: d.id }); return Acts.etapa({ id: d.id }); };
Acts.estado = d => Acts.etapa({ id: d.id, pre: 'estado' });
Acts.reabrirPrj = d => {   // N-F-07
  const i = byId(d.id); if (!i || esProp(i) || !isDone(i) || !(0, ENLACES.esAdministra)()) return (0, ENLACES.NO_PERM)('Solo Administra puede reabrir un proyecto cerrado');
  openForm({
    title: 'Reabrir proyecto · ' + i.titulo, saveLabel: 'Reabrir', values: { nota: '' }, fields: [{ k: 'nota', l: 'Motivo de la reapertura (queda en la bitácora)', t: 'textarea', req: true, w: 3 }],
    onSave(o) { return cmdServidor('apih_reabrir', { p_id: i.id, p_nota: o.nota }, 'Proyecto reabierto', true).then(r => r !== null); }
  });
};
Acts.reopen = d => {
  const i = byId(d.id); if (!i || !esProp(i) || !['Rechazada', 'Retirada'].includes(i.estado)) return;
  openForm({
    title: 'Reabrir propuesta · ' + i.titulo, saveLabel: 'Reabrir', values: { nota: '' }, fields: [{ k: 'nota', l: 'Motivo de la reapertura (queda en la bitácora)', t: 'textarea', req: true, w: 3 }],
    onSave(o) { return cmdServidor('apih_reabrir', { p_id: i.id, p_nota: o.nota }, 'Propuesta reabierta', true).then(r => r !== null); }
  });
};

/* Resumen del panel contextual para PROPUESTAS (sin RAG, avance ni cronograma) */
function propResumen(i) {
  const F_ = FASES_PROP, idx = F_.indexOf(i.fase), last = idx === F_.length - 1, sf = semFase(i), r = roi(i), c = completitud(i), fin = isDone(i);
  const g = compuertas(i), sc = i.score || {};
  const link = fin ? '' : last ? `<a class="lnk edit-only" data-act="aprobar" data-id="${i.id}">Aprobar y crear proyecto →</a>` : `<a class="lnk edit-only" data-act="advance" data-id="${i.id}">Avanzar a ${F_[idx + 1]} →</a>`;
  const bar = (l, v, inv) => `<div class="kv"><span>${l}</span><b>${prog(v / 5 * 100, (inv ? v >= 4 : v <= 2) ? 'Rojo' : (inv ? v <= 2 : v >= 4) ? 'Verde' : 'Ámbar', 5)} ${v || '—'}/5</b></div>`;
  return `${i.proyecto ? `<div class="pn-sec"><div class="note">${icon('play', 14)}<span>Aprobada · proyecto generado ${iniLink(i.proyecto, i.proyecto + ' · ' + nameOf(i.proyecto))}</span></div></div>` : ''}${i.estadoMotivo && !i.proyecto ? `<div class="pn-sec"><div class="note warn">${icon('warn', 14)}<span><b>${esc(i.estado)}:</b> ${esc(i.estadoMotivo)}${i.estadoRev ? ' · revisión ' + fmtD(i.estadoRev) : ''}</span></div></div>` : ''}
  <div class="pn-sec"><div class="flow">${F_.map((x, k) => `<span class="${k < idx ? 'done' : k === idx ? 'cur' : ''}" title="${x}"></span>`).join('')}</div><div class="flow-l"><span>${i.fase}</span>${link}</div></div>
  <div class="pn-sec"><p class="desc">${esc(i.problema || i.resumen || i.desc || 'Sin descripción.')}</p>${i.objetivos ? `<p class="mut" style="margin:6px 0 0"><b>Objetivos:</b> ${esc(i.objetivos)}</p>` : ''}</div>
  <div class="pn-sec"><div class="kvs">${kv('Puntaje', i.score ? `<b>${priorScore(i)}</b> / 100` : '<span class="mut">sin evaluar</span>')}${kv('Días en la fase', `<span style="color:${sf.c};font-weight:700">${sf.d} d</span>`)}${kv('Costo estimado', fmtMon(i.presupuesto, monOf(i)) + estTag(i, 'presupuesto'))}${kv('Beneficio estimado', fmtMon(i.beneficio, monOf(i)) + estTag(i, 'beneficio'))}${kv('ROI estimado', r == null ? '—' : Math.round(r) + '%')}${kv('Fecha objetivo', fmtD(i.finPlan))}</div></div>
  <div class="pn-sec"><h4>Priorización</h4><div class="kvs">${bar('Estrategia', sc.estrategia, true)}${bar('Valor', sc.valor, true)}${bar('Esfuerzo', sc.esfuerzo, false)}${bar('Riesgo', sc.riesgo, false)}</div></div>
  ${fin ? '' : `<div class="pn-sec"><h4>${last ? 'Compuertas para aprobar' : 'Compuertas para ' + F_[idx + 1]}</h4><div class="gates">${g.map(x => `<div class="${x.ok ? 'ok' : 'no'}">${icon(x.ok ? 'check' : 'x', 14)}<span>${esc(x.t)}</span></div>`).join('')}</div></div>`}
  <div class="pn-sec"><div class="kvs">${kv('Solicitante', esc(i.solicitante || i.propuestoPor || i.lider || '—'))}${kv('Sponsor', esc(i.sponsor || '—') + estTag(i, 'sponsor'))}${kv('Responsable', esc(i.lider || '—'))}${kv('Resp. negocio', esc(i.negocio || '—'))}${kv('Área', esc(i.area))}${kv('Categoría', esc(i.categoria))}${kv('Clasificación', esc(i.clasif) + ' · ' + esc(i.gasto))}${kv('Solicitada', fmtD(i.creada))}</div></div>
  ${(i.deps || []).length ? `<div class="pn-sec"><h4>Dependencias</h4>${i.deps.map(d => { const x = byId(d); return x ? `<button class="al" data-act="sel" data-t="ini" data-id="${x.id}">${tipoPill(x)}<span><b>${esc(x.titulo)}</b><small>${x.fase}</small></span></button>` : ''; }).join('')}</div>` : ''}
  <div class="pn-sec"><h4>Calidad de datos · ${c.pct}%</h4>${prog(c.pct, c.pct > 80 ? 'Verde' : c.pct > 60 ? 'Ámbar' : 'Rojo', 5)}<small class="mut">${c.crit.length ? 'Críticos: ' + esc(c.crit.join(', ')) + '. ' : ''}${c.rec.length ? 'Recomendados: ' + esc(c.rec.join(', ')) + '.' : ''}</small></div>`;
}

/* ============================================================
   APIH · Vistas 1: Dashboard, Portfolio, Iniciativas, Propuestas
   ============================================================ */
export const nextHito = i => hitosDe(i.id).filter(h => !h.completado).sort(by('fecha'))[0] || null;
export const priorScore = i => (i && CALC.puntajes && CALC.puntajes[i.id]) || 0;   // el puntaje de priorización lo calcula el servidor
export function myWork() {
  const me = miUsuario(), items = [], L = d => diffD(d, hoy());
  HITOS().forEach(h => { const i = byId(h.ini); if (!i || i.lider !== me || h.completado || !isLive(i) || !inArea(i)) return; if (L(h.fecha) <= 14) items.push({ k: 'hito', id: h.id, t: h.nombre, s: i.titulo, when: h.fecha, over: L(h.fecha) < 0, ic: 'flag' }); });
  RIESGOS().forEach(r => { if (r.dueno === me && riesgoAbierto(r) && r.fRev && L(r.fRev) <= 14) items.push({ k: 'risk', id: r.id, t: 'Revisar riesgo: ' + r.desc, s: nameOf(r.ini), when: r.fRev, over: L(r.fRev) < 0, ic: 'shield' }); });
  DECS().forEach(d => { if (d.estado === 'Pendiente' && d.solicita === me && d.limite && L(d.limite) <= 14) items.push({ k: 'dec', id: d.id, t: 'Decisión: ' + d.titulo, s: d.ini ? nameOf(d.ini) : '', when: d.limite, over: L(d.limite) < 0, ic: 'gavel' }); });
  St.comites.forEach(c => [...(c.acciones || []).map(a => ({ ...a, tp: 'Acción' })), ...(c.compromisos || []).map(a => ({ ...a, tp: 'Compromiso' }))].forEach(a => { if (a.resp === me && ['Abierta', 'Abierto'].includes(a.estado) && a.limite && L(a.limite) <= 14) items.push({ k: 'acc', id: a.id, t: a.tp + ': ' + a.texto, s: a.ini ? nameOf(a.ini) : c.nombre, when: a.limite, over: L(a.limite) < 0, ic: 'check' }); }));
  ACUERDOS().forEach(a => { if (a.resp === me && a.estado === 'Abierto' && a.limite && L(a.limite) <= 14) items.push({ k: 'acu', id: a.id, t: 'Compromiso: ' + a.texto, s: a.ini ? nameOf(a.ini) : (a.tema || 'General'), when: a.limite, over: L(a.limite) < 0, ic: 'check' }); });
  St.ini.forEach(i => { if (i.lider === me && isLive(i) && FASES_ACT.includes(i.fase) && diasSinUpd(i) > (0, ENLACES.cfgI)(i,'diasSinUpdate') && inArea(i)) items.push({ k: 'upd', id: i.id, t: 'Actualizar avance (hace ' + diasSinUpd(i) + ' d)', s: i.titulo, when: addD(i.actualizada, (0, ENLACES.cfgI)(i,'diasSinUpdate')), over: true, ic: 'refresh' }); });
  return items.sort(by('when'));
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  diasEnFase: { get: () => diasEnFase, enumerable: true, configurable: true },
  hitoEnServidor: { get: () => hitoEnServidor, enumerable: true, configurable: true },
  migrateV5: { get: () => migrateV5, enumerable: true, configurable: true },
  propResumen: { get: () => propResumen, enumerable: true, configurable: true },
  resolverEnServidor: { get: () => resolverEnServidor, enumerable: true, configurable: true },
});
