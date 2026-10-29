/* 06b-administracion-herramientas — continuación de 06-administracion.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { $, CALC, ACUERDOS, CAMBIOS, DECS, FASES_ACT, HITOS, RAGS, RIESGOS, St, addD, by, byId, clone, desv, diasSinUpd, diffD, esProp, esSB, esc, esperado, expo, fmtD, fmtMon, fmtN, forecast, hitosDe, hoy, icon, inArea, isLive, miUsuario, monOf, nameOf, pD, ragSugerido, riesgoAbierto, riesgosDe } from './01-nucleo.js';
import { Acts, Chg, F, Modal, UI, Views, avFase, btn, closePops, confirmBox, download, empty, iniLink, openForm, pageHead, refresh, render, selOpts, toast } from './03-interfaz.js';
import { downloadBlob, iniOpts, iniOptsF, people } from './03b-interfaz-excel-formularios.js';
import { cmdServidor } from './04-flujos.js';
import { hitosSub, subfasesDe, ventanaDe } from './05-vistas.js';
import { archFecha, bellPop } from './06-administracion.js';


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
  const sg = ragSugerido(i), ah = { v: (0, ENLACES.avanceCalc)(i), d: hitosDe(i.id).filter(h => h.completado).length, n: hitosDe(i.id).length }, fc = forecast(i), dv = desv(i), q = UI.wkq, pos = UI.wkn ? UI.wkn - (q ? q.length : 0) : 0;
  const abiertos = ACUERDOS().filter(a => a.ini === i.id && a.estado === 'Abierto');
  const v = { avance: i.avance || 0, rag: i.rag, logros: '', proximos: i.proximos || '', issue: i.issue || '', finEst: i.finEst || i.finPlan || '' };
  const use = (f, val, txt) => `<a class="lnk" data-act="wkset" data-f="${f}" data-v="${esc(val)}">${txt}</a>`;
  openForm({
    title: (pos ? `Actualización semanal (${pos} de ${UI.wkn}) · ` : 'Actualización semanal · ') + i.titulo, values: v, saveLabel: pos && q && q.length ? 'Guardar y siguiente' : 'Guardar',
    fields: [
      { k: 'avance', l: 'Avance (%)', t: 'range', w: 1, hint: `Calculado por fases, subfases e hitos: <b>${ah.v}%</b> (${ah.d} de ${ah.n} hitos cerrados) · ${use('avance', ah.v, 'usar el calculado')}. Si lo cambias, queda como ajuste manual.` },
      { k: 'rag', l: 'Salud (RAG)', t: 'select', opts: RAGS, w: 1, hint: `Reglas sugieren <b>${sg.rag}</b>${sg.why.length ? ' (' + esc(sg.why.join(', ')) + ')' : ''} · ${use('rag', sg.rag, 'usar')}` },
      { k: 'finEst', l: 'Fin estimado', t: 'date', w: 1, hint: fc && i.finPlan && fc > i.finPlan ? `Pronóstico ${dv} d sobre la línea base · <a class="lnk" data-act="chgnew" data-id="${i.id}">registrar cambio</a>` : '' },
      { k: 'logros', l: 'Logros de la semana', t: 'textarea', w: 3, hint: i.proximos ? `Lo prometido: «${esc(cut(i.proximos, 140))}» · <a class="lnk" data-act="wkpass">pasar a logros</a>` : '' },
      { k: 'proximos', l: 'Próximos pasos', t: 'textarea', w: 3 },
      { k: 'issue', l: 'Issue o bloqueo actual', w: 3 }
    ],
    extra: `<div style="margin-top:10px;display:flex;gap:14px;flex-wrap:wrap"><a class="lnk" data-act="wknc" data-id="${i.id}">✓ Sin novedades: solo confirmar que sigue vigente</a><a class="lnk" data-act="informe" data-id="${i.id}">Ver informe de estado</a><a class="lnk" data-act="acunew" data-id="${i.id}">+ Compromiso</a></div>${abiertos.length ? `<div class="note" style="margin-top:8px"><span><b>Compromisos abiertos (${abiertos.length}):</b> ${abiertos.slice(0, 4).map(a => esc(cut(a.texto, 50)) + ' — ' + esc(a.resp || 's/r') + (a.limite ? ' (' + fmtD(a.limite) + ')' : '')).join(' · ')}</span></div>` : ''}`,
    /* El servidor valida, guarda los campos, la foto semanal y la bitácora (apih_actualizacion_semanal); aquí solo se pide y se celebra */
    onSave(o) {
      const b0 = (0, ENLACES.cieloOn)() ? (0, ENLACES.estrellasOn)(i) : null;
      return cmdServidor('apih_actualizacion_semanal', { p_id: i.id, p_datos: { avance: o.avance, rag: o.rag, finEst: o.finEst || '', logros: o.logros || '', proximos: o.proximos || '', issue: o.issue || '' }, p_sin_novedades: false }, 'Actualización guardada', true)
        .then(r => { if (r === null) return false; refresh(); (0, ENLACES.celebrar)(byId(i.id), b0); wkNext(); return true; });
    }
  });
};
Acts.wkset = d => { const el = $('#f_' + d.f); if (!el) return; el.value = d.v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
Acts.wkpass = () => { const t = $('#f_logros'), p = $('#f_proximos'); if (!t || !p) return; t.value = (t.value ? t.value + '\n' : '') + p.value.trim(); };
Acts.wknc = d => {
  const i = byId(d.id); if (!i) return; Modal.close(); const b0 = (0, ENLACES.cieloOn)() ? (0, ENLACES.estrellasOn)(i) : null;
  cmdServidor('apih_actualizacion_semanal', { p_id: i.id, p_datos: {}, p_sin_novedades: true }, 'Confirmado: sin novedades').then(r => { if (r === null) return; refresh(); (0, ENLACES.celebrar)(byId(i.id), b0); wkNext(); });
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
  /* Etiquetas sin solaparse: cada una va en el primer carril libre, alternando abajo y arriba de la línea (con un trazo hasta su punto) */
  const W = 584, LH = 26, estW = k => Math.ceil(Math.max(lbl(ms[k]).length * 4.7, String(repFmt(ms[k].date)).length * 4.4)) + 8;
  const carriles = [{ up: false, fin: [] }, { up: true, fin: [] }, { up: false, fin: [] }, { up: true, fin: [] }, { up: false, fin: [] }, { up: true, fin: [] }], lug = {};
  vi.forEach(k => { const w = estW(k), c = pos[k] / 100 * W; let x0 = Math.min(Math.max(c - w / 2, 0), W - w), n = 0;
    for (; n < carriles.length - 1; n++) { const f = carriles[n].fin; if (!f.length || f[f.length - 1] + 6 <= x0) break; }
    carriles[n].fin.push(x0 + w); lug[k] = { n, x0, w }; });
  const usados = carriles.filter(c => c.fin.length), nUp = usados.filter(c => c.up).length, nDn = usados.filter(c => !c.up).length, H = nUp * LH + 20 + nDn * LH, yL = nUp * LH + 10;
  const idx = c => usados.filter(u => u.up === c.up).indexOf(c);
  const dots = vi.map(k => { const p = pos[k], done = ms[k].done; return '<div style="position:absolute;top:' + yL + 'px;transform:translate(-50%,-50%);left:' + p + '%;width:14px;height:14px;border-radius:50%;background:' + (done ? '#EB002A' : '#fff') + ';border:2px solid ' + (done ? '#fff' : '#98999B') + ';z-index:2;"></div>'; }).join('');
  const lbls = vi.map(k => { const L = lug[k], c = carriles[L.n], m = idx(c), done = ms[k].done, p = pos[k];
    const top = c.up ? nUp * LH - (m + 1) * LH : yL + 10 + m * LH, tr = c.up ? [top + LH - 2, yL - 7] : [yL + 7, top];
    return '<div style="position:absolute;left:' + p + '%;top:' + Math.min(tr[0], tr[1]) + 'px;width:1px;height:' + Math.abs(tr[1] - tr[0]) + 'px;background:#D5D6D7;"></div>'
      + '<div style="position:absolute;left:' + (L.x0 / W * 100) + '%;top:' + top + 'px;width:' + L.w + 'px;text-align:center;white-space:nowrap;"><div style="font-weight:700;color:' + (done ? '#EB002A' : '#54565A') + ';">' + (done ? '✓ ' : '') + lbl(ms[k]) + '</div><div style="margin-top:1px;color:' + (done ? '#EB002A' : '#98999B') + ';">' + repFmt(ms[k].date) + '</div></div>'; }).join('');
  const vr = d.avFasePrev === '' ? '' : (d.avFase - +d.avFasePrev !== 0 ? '<div style="color:#41B6E6;font-size:10px;margin-top:4px;">' + (d.avFase > +d.avFasePrev ? '↑' : '↓') + ' desde ' + d.avFasePrev + '%</div>' : '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">Sin cambio</div>');
  const box = (a, b, big, bigSz, sub, mt) => '    <div style="background:#01426A;border-radius:10px;padding:14px;text-align:center;">\n      <div style="color:#9BCBEB;font-size:10px;margin-bottom:5px;">' + a + '</div>\n      <div style="color:#fff;font-size:' + bigSz + 'px;font-weight:700;line-height:1;' + (mt ? 'margin-top:4px;' : '') + '">' + big + '</div>\n      ' + sub + '\n    </div>\n';
  const nx = d.next;
  return repDoc('<div style="font-family:Arial,sans-serif;padding:22px;background:#fff;max-width:680px;margin:0 auto;border-radius:12px;">\n' + repHead(d, 'Aramark · PM: ' + d.pm + (d.client ? ' · ' + d.client : ''))
    + '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">\n'
    + box('Avance del proyecto', '', d.overall + '%', 25, '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">Hitos contractuales</div>', false)
    + box('Avance fase activa', '', d.avFase + '%', 25, vr, false)
    + box('Próximo hito', '', nx ? repFmt(nx.date) : '—', 17, '<div style="color:#9BCBEB;font-size:10px;margin-top:4px;">' + (nx ? esc(nx.name) : 'Todos los hitos cumplidos') + '</div>', true)
    + '  </div>\n  <div style="border:1px solid #EBEBEB;border-radius:10px;padding:16px 20px;margin-bottom:12px;">\n    <div style="font-size:10px;color:#98999B;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:10px;">Progreso del proyecto</div>\n    <div style="font-size:11px;color:#54565A;font-weight:500;margin-bottom:10px;">Avance general (hitos contractuales)</div>\n    <div style="position:relative;padding:0 6px;">\n      <div style="position:relative;height:' + H + 'px;font-size:8px;">\n        <div style="position:absolute;top:' + yL + 'px;transform:translateY(-50%);left:0;right:0;height:6px;background:#EBEBEB;border-radius:6px;"></div>\n        <div style="position:absolute;top:' + yL + 'px;transform:translateY(-50%);left:0;width:' + d.overall + '%;height:6px;background:#EB002A;border-radius:6px;"></div>\n        ' + lbls + dots + '\n      </div>\n    </div>\n'
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
    img.onerror = () => ko(new Error('no se pudo dibujar el reporte')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);   // data: y no blob: el navegador «contamina» el canvas con un SVG foreignObject desde blob: y no deja exportar
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
    onDanger: () => confirmBox('¿Eliminar este compromiso?', () => (0, ENLACES.eliminarEnServidor)('APIH_Compromisos', a.id, 'Compromiso eliminado').then(r => { if (r) refresh(); }), 'Eliminar', true),
    onSave(o) { return (0, ENLACES.guardarEnServidor)('apih_guardar_compromiso', a && a.id, o, nw ? 'Compromiso registrado' : 'Compromiso actualizado').then(r => r !== null); }   // id, fecha real, estado inicial y bitácora: del servidor
  });
}
Acts.acunew = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const pre = {}; if (d && d.id) pre.ini = d.id; if (d && d.texto) pre.texto = d.texto; if (d && d.tema) pre.tema = d.tema; closePops(); if (Modal.cur) Modal.close(); setTimeout(() => acuForm(null, pre), 40); };
Acts.acuedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const a = St.compromisos.find(x => x.id === d.id); if (a) acuForm(a); };
Chg.acutoggle = el => { const a = St.compromisos.find(x => x.id === el.dataset.id); if (!a) return; (0, ENLACES.guardarEnServidor)('apih_guardar_compromiso', a.id, { estado: el.checked ? 'Cumplido' : 'Abierto' }, el.checked ? 'Compromiso cumplido' : 'Compromiso reabierto'); };
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
const puedeResolver = c => !!(c && CALC.cambios && CALC.cambios[c.id]);   // quién resuelve un cambio lo decide el servidor
function resumenDe(me) {
  const L = d => diffD(d, hoy()), S = [];
  const acu = todosAcu().filter(a => a.abierto && a.resp === me && a.limite && L(a.limite) <= 7).sort(by('limite'));
  const deben = todosAcu().filter(a => a.abierto && a.de === me && a.resp !== me && a.limite && a.limite < hoy()).sort(by('limite'));
  const hs = HITOS().filter(h => { const i = byId(h.ini); return i && i.lider === me && !h.completado && isLive(i) && L(h.fecha) <= 7; }).sort(by('fecha'));
  const upd = St.ini.filter(i => !esProp(i) && i.lider === me && isLive(i) && FASES_ACT.includes(i.fase) && diasSinUpd(i) > MIN_DIAS_RONDA);
  const rs = RIESGOS().filter(r => r.dueno === me && riesgoAbierto(r) && r.fRev && L(r.fRev) <= 7);
  const dc = DECS().filter(d => d.estado === 'Pendiente' && d.solicita === me && d.limite && L(d.limite) <= 7);
  const cg = CAMBIOS().filter(c => c.estado === 'Solicitado' && puedeResolver(c));
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
    onDanger: () => confirmBox('¿Eliminar esta solicitud de cambio?', () => { (0, ENLACES.eliminarEnServidor)('APIH_Cambios', c.id, 'Solicitud eliminada'); }, 'Eliminar', true),
    onSave(o) {
      const i = byId(o.ini); if (!i) { toast('Elige un proyecto', 'err'); return false; }
      if (o.fNue && o.fNue === i.finPlan && !+o.pNue) { toast('La nueva fecha es igual a la actual', 'err'); return false; }
      if (o.fNue && i.inicioPlan && o.fNue < i.inicioPlan) { toast('La nueva fecha de fin no puede ser anterior al inicio plan (' + fmtD(i.inicioPlan) + ')', 'err'); return false; }   // N-F-05
      if (nw) { return cmdServidor('apih_solicitar_cambio', { p_ini: o.ini, p_tipo: o.tipo, p_desc: o.desc, p_motivo: o.motivo, p_impacto: o.impacto || '', p_fnue: o.fNue || null, p_pnue: +o.pNue || 0 }, 'Solicitud registrada: queda pendiente de aprobación', true).then(r => r !== null); }
      else { Object.assign(c, o, { pNue: +o.pNue || 0, fAnt: i.finPlan || null, pAnt: i.presupuesto || 0 }); toast('Solicitud actualizada'); }
      refresh();
    }
  });
}
Acts.chgnew = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const pre = {}; if (d && d.id) { pre.ini = d.id; const i = byId(d.id); if (i) { const f = forecast(i); if (f && i.finPlan && f > i.finPlan) { pre.tipo = 'Fecha'; pre.fNue = f; } } } closePops(); if (Modal.cur) Modal.close(); setTimeout(() => chgForm(null, pre), 40); };
Acts.chgedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const c = St.cambios.find(x => x.id === d.id); if (c) chgForm(c); };
Acts.chgdec = d => {
  const c = St.cambios.find(x => x.id === d.id), i = c && byId(c.ini); if (!c || !i || c.estado !== 'Solicitado') return;
  if ((0, ENLACES.soloLectura)() || !puedeResolver(c)) return (0, ENLACES.NO_PERM)('Solo el sponsor del proyecto, el administrador o Administra pueden resolver cambios');
  const ap = d.e === 'Aprobado';
  openForm({
    title: (ap ? 'Aprobar' : 'Rechazar') + ' cambio ' + c.id, values: { aprobador: miUsuario(), nota: '' }, saveLabel: ap ? 'Aprobar y aplicar' : 'Rechazar',
    fields: [{ k: 'aprobador', l: 'Resuelve', list: people(), req: true }, { k: 'nota', l: ap ? 'Nota de aprobación' : 'Motivo del rechazo', t: 'textarea', req: !ap, w: 3 }],
    extra: `<div class="note ${ap ? '' : 'warn'}" style="margin-top:8px"><span><b>${esc(i.titulo)}</b> · ${esc(c.tipo)}: ${esc(c.desc)}<br>${ap ? '<b>Se aplicará:</b> ' : 'Efecto solicitado: '}${esc(chgEfecto(c))}</span></div>`,
    onSave(o) {
      return cmdServidor('apih_resolver_cambio', { p_id: c.id, p_estado: d.e, p_nota: o.nota || '' }, 'Cambio ' + (ap ? 'aprobado y aplicado a la línea base' : 'rechazado'), true).then(r => r !== null);
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
    const tr = c => { const i = byId(c.ini), can = c.estado === 'Solicitado' && puedeResolver(c);
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
});
