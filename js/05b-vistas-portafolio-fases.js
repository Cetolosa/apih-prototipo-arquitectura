/* 05b-vistas-portafolio-fases — continuación de 05-vistas.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { $, CALC, ESTADOS, ESTADOS_PRJ, ESTADOS_PROP, FASES, FASES_PRJ, FASES_PROP, FASE_COLOR, FL, PLAN_TIPOS, PRIOS, RAGS, St, _nrm, addD, atrasado, avatar, avg, by, byId, clone, critScore, desv, diffD, esProp, esc, esperado, expo, fasesDe, fmtD, fmtMon, fmtTot, forecast, compuertas, hitoEstado, hitosDe, hoy, icon, iniHead, isDone, isLive, miUsuario, monKeys, monMain, monOf, nivelRiesgo, pct, pctMon, planSeg, planTipo, porTipo, riesgoAbierto, riesgosDe, scopeAll, scopeTT, sumM, tipoLbl, tipoPF, uniq } from './01-nucleo.js';
import { Acts, Chg, F, UI, Views, avFase, avFaseTip, btn, kv, confirmBox, download, empty, estPill, estTag, fasePill, openForm, pageHead, prioPill, prog, ragPill, refresh, render, selOpts, tipoPill, toCSV, toast } from './03-interfaz.js';
import { people } from './03b-interfaz-excel-formularios.js';
import { cmdServidor, diasEnFase, nextHito, priorScore, semFase } from './04-flujos.js';
import { avanceCalc, avanceEf, avanceManualDe } from './01-nucleo.js';
import { FZ_TABS, GROUPS, PCELL, bindDnD, cutDesc, descIco, faseDescDe, faseNotaP, fasesVentana, fzEscala, fzGrid, fzHito, fzOn, fzRiesgosFase, fzRsk, fzTx, fzd, hitoDescDe, hitosFuera, hitosSub, planBars, rangoTx, starsCnt, subActual, subDescDe, subFuera, subfasesDe, ventanaDe } from './05-vistas.js';


/* ======================= PORTFOLIO ======================= */
const PCOLS = [
  { k: 'tipo', h: 'Tipo', w: 92, t: 'a', f: i => tipoLbl(i), s: i => tipoLbl(i), r: i => tipoPill(i) },
  { k: 'tini', h: 'Tipo de iniciativa', w: 150, f: i => i.tipoIni || '', s: i => (i.tipoIni || '').toLowerCase(), r: i => esc(i.tipoIni || '—') },
  { k: 'id', h: 'ID', w: 84, f: i => i.id, s: i => i.id, r: i => `<span class="mono">${i.id}</span>` },
  { k: 'titulo', h: 'Nombre', w: 230, f: i => i.titulo, s: i => i.titulo.toLowerCase(), r: i => `<a class="lnk tt" data-act="sel" data-t="ini" data-id="${i.id}">${esc(i.titulo)}</a>${i.origen === 'demo' ? ' <sup class="est">demo</sup>' : ''}` },
  { k: 'sponsor', h: 'Sponsor', w: 140, f: i => i.sponsor, s: i => i.sponsor, r: i => `${esc(i.sponsor || '—')}${estTag(i, 'sponsor')}` },
  { k: 'lider', h: 'Responsable', w: 140, f: i => i.lider, s: i => i.lider, r: i => `<span class="pp">${avatar(i.lider, 20)}${esc(i.lider)}</span>` },
  { k: 'area', h: 'Área', w: 100, f: i => i.area, s: i => i.area, r: i => esc(i.area.replace(/,/g, ', ')) },
  { k: 'fase', h: 'Fase', w: 130, f: i => i.fase, s: i => FASES.indexOf(i.fase), r: i => faseTag(i) },
  { k: 'estado', h: 'Estado', w: 100, f: i => i.estado, s: i => ESTADOS.indexOf(i.estado), r: i => estPill(i.estado) },
  { k: 'rag', h: 'RAG', w: 82, t: 'j', f: i => i.rag, s: i => RAGS.indexOf(i.rag), r: i => ragPill(i.rag) },
  { k: 'prioridad', h: 'Prioridad', w: 88, f: i => i.prioridad, s: i => PRIOS.indexOf(i.prioridad), r: i => prioPill(i.prioridad) },
  { k: 'presupuesto', h: 'Presupuesto', w: 110, num: 1, f: i => i.presupuesto, s: i => i.presupuesto, r: i => fmtMon(i.presupuesto, monOf(i)) + estTag(i, 'presupuesto') },
  { k: 'beneficio', h: 'Beneficio', w: 96, num: 1, f: i => i.beneficio, s: i => i.beneficio, r: i => fmtMon(i.beneficio, monOf(i)) },
  { k: 'score', h: 'Puntaje', w: 80, t: 'p', f: i => priorScore(i), s: i => priorScore(i), r: i => i.score ? `<b>${priorScore(i)}</b>` : '<span class="mut">—</span>' },
  { k: 'dfase', h: 'Días en fase', w: 100, t: 'p', num: 1, f: i => diasEnFase(i), s: i => diasEnFase(i), r: i => `<span style="color:${semFase(i).c};font-weight:600">${diasEnFase(i)} d</span>` },
  { k: 'avance', h: 'Avance', w: 120, t: 'j', f: i => Math.round(i.avance), s: i => i.avance, r: i => `<span class="avc">${prog(i.avance, i.rag, 6)}<b>${pct(i.avance)}</b></span>` },
  { k: 'afase', h: 'Avance fase', w: 110, f: i => avFase(i).v, s: i => avFase(i).v, r: i => `<span class="avc" title="${esc(avFaseTip(i))}">${prog(avFase(i).v, i.rag || 'Verde', 6)}<b>${avFase(i).v}%</b></span>` },
  { k: 'hitosn', h: 'Hitos', w: 76, num: 1, f: i => { const h = hitosDe(i.id); return h.filter(x => x.completado).length + '/' + h.length; }, s: i => { const h = hitosDe(i.id); return h.length ? h.filter(x => x.completado).length / h.length : -1; }, r: i => { const h = hitosDe(i.id); return `${h.filter(x => x.completado).length}/${h.length}`; } },
  { k: 'inicioPlan', h: 'Inicio Plan / Est.', w: 100, f: i => i.inicioPlan, s: i => i.inicioPlan || '', r: i => fmtD(i.inicioPlan) },
  { k: 'finPlan', h: 'Fin Plan / Objetivo', w: 110, f: i => i.finPlan, s: i => i.finPlan || '', r: i => fmtD(i.finPlan) },
  { k: 'inicioReal', h: 'Inicio Real', w: 90, t: 'j', f: i => i.inicioReal, s: i => i.inicioReal || '', r: i => fmtD(i.inicioReal) },
  { k: 'finReal', h: 'Fin Real', w: 90, t: 'j', f: i => i.finReal, s: i => i.finReal || '', r: i => fmtD(i.finReal) },
  { k: 'desv', h: 'Desv.', w: 80, num: 1, t: 'j', f: i => desv(i), s: i => desv(i), r: i => desv(i) ? `<span class="${desv(i) > (0, ENLACES.cfgI)(i,'tolDesv') ? 'neg' : 'warnt'}">+${desv(i)} d</span>` : '<span class="mut">0 d</span>' },
  { k: 'hito', h: 'Próximo Hito', w: 220, t: 'j', f: i => { const h = nextHito(i); return h ? h.nombre + ' (' + h.fecha + ')' : ''; }, s: i => { const h = nextHito(i); return h ? h.fecha : '9'; }, r: i => { const h = nextHito(i); if (!h) return '<span class="mut">—</span>'; const e = hitoEstado(h); return `<span class="hn" title="${esc(h.nombre)}">${esc(h.nombre)}</span> <small style="color:${e.c}">${fmtD(h.fecha)}</small>`; } },
];
/* columnas visibles según el tipo en pantalla: j = solo proyectos · p = solo propuestas · a = solo en vista Todo */
export function pcols() { const f = F('portfolio', {}); f.tipo = tipoPF(); const T = f.tipo; return PCOLS.filter(c => ((0, ENLACES.modoUI)() === 'simple' && !UI.sx ? ENLACES.COLS_SIMPLE.includes(c.k) : f.cols.includes(c.k)) && (c.t === 'a' ? T === 'Todo' : c.t === 'j' ? T !== 'Propuesta' : c.t === 'p' ? T !== 'Proyecto' : true)); }
export function portfolioRows() {
  const f = F('portfolio', {}); f.tipo = tipoPF(); let rows = scopeTT(f.tipo);
  if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.id + i.lider + i.sponsor + i.proveedor + i.desc).toLowerCase().includes(q)); }
  if (f.fase) rows = rows.filter(i => i.fase === f.fase); if (f.estado) rows = rows.filter(i => i.estado === f.estado); if (f.rag) rows = rows.filter(i => i.rag === f.rag);
  if (f.tini) rows = rows.filter(i => i.tipoIni === f.tini); if (f.prio) rows = rows.filter(i => i.prioridad === f.prio); if (f.resp) rows = rows.filter(i => i.lider === f.resp); if (f.area) rows = rows.filter(i => i.area.split(',').includes(f.area));
  if (f.hideDone) rows = rows.filter(i => !isDone(i));
  const c = PCOLS.find(x => x.k === f.sort) || PCOLS[0]; rows = rows.slice().sort(by(c.s, f.dir || 1));
  return rows;
}
Views.portfolio = {
  render() {
    const f = F('portfolio', { tipo: tipoPF(), q: '', fase: '', estado: '', rag: '', prio: '', resp: '', area: '', group: '', sort: 'id', dir: 1, cols: ['tipo','id','titulo','fase','avance','afase','lider','prioridad','rag','desv','hitosn','estado'], hideDone: false, dens: 'n', col: {} });
    const rows = portfolioRows(), cols = pcols().filter(c => !(['tini', 'sponsor'].includes(c.k) && rows.length && rows.every(i => !c.f(i)))), all = scopeTT(f.tipo), nPrj = scopeTT('Proyecto').length, nProp = scopeTT('Propuesta').length;
    const grp = f.group; let body = '';
    const rowH = i => `<tr data-act="sel" data-t="ini" data-id="${i.id}" class="${UI.sel && UI.sel.id === i.id ? 'sel' : ''}">${cols.map(c => `<td class="${c.num ? 'n' : ''} c-${c.k}">${PCELL(c, i)}</td>`).join('')}</tr>`;
    if (!grp) body = rows.map(rowH).join('');
    else {
      const gs = uniq(rows.map(i => grp === 'area' ? i.area : i[grp])).sort(); gs.forEach(g => {
        const gr = rows.filter(i => (grp === 'area' ? i.area : i[grp]) === g), cl = f.col[g];
        body += `<tr class="grp" data-act="pgrp" data-g="${esc(g)}"><td colspan="${cols.length}"><span class="gcar ${cl ? '' : 'o'}">${icon('chev', 12)}</span><b>${esc(g || '—')}</b><small>${gr.length} registros · ${fmtTot(sumM(gr, i => i.presupuesto))} · avance prom. ${pct(avg(gr, i => i.avance))}</small></td></tr>`;
        if (!cl) body += gr.map(rowH).join('');
      });
    }
    const resp = uniq(all.map(i => i.lider)).sort(); const nAdv = ['fase', 'estado', 'rag', 'prio', 'resp', 'tini'].filter(k => f[k]).length + (f.hideDone ? 1 : 0);
    const tot = { p: sumM(rows, i => i.presupuesto), g: sumM(rows.filter(i => !esProp(i)), i => i.gastado) };
    return iniHead(rows, `${btn('Excel', 'pxlsx', { ic: 'down', cls: 'pri' })}${btn('JSON', 'pjson', { ic: 'down' })}${btn('CSV', 'pcsv', { ic: 'down' })}`) + `
    <div class="toolbar">${planSeg()}
      <div class="search" style="flex:0 1 170px;min-width:120px"><span>${icon('search', 14)}</span><input data-key="pf-q" data-chg="flt" data-v="portfolio" data-f="q" type="search" placeholder="Buscar en el portfolio…" value="${esc(f.q)}"></div>
      <button class="btn pf-advb ${UI.pfAdv || nAdv ? 'on' : ''}" data-act="pfadv" aria-expanded="${!!(UI.pfAdv || nAdv)}">${icon('filter', 14)}<span>Más filtros${nAdv ? ' · ' + nAdv : ''}</span><span aria-hidden="true">▾</span></button>
      <div class="popw"><button class="btn" data-act="pop" data-id="pop-cols" title="Columnas" aria-label="Elegir columnas">${icon('list2', 15)}</button><div class="pop cols" id="pop-cols" style="right:0">${PCOLS.filter(c => (c.t === 'a' ? f.tipo === 'Todo' : c.t === 'j' ? f.tipo !== 'Propuesta' : c.t === 'p' ? f.tipo !== 'Proyecto' : true)).map(c => `<label class="chk"><input type="checkbox" ${f.cols.includes(c.k) ? 'checked' : ''} data-chg="pcol" data-k="${c.k}"> <span>${c.h}</span></label>`).join('')}</div></div>
      ${nAdv || f.q ? btn('Limpiar', 'pclear', { ic: 'x' }) : ''}
      <div class="pf-adv ${UI.pfAdv || nAdv ? 'open' : ''}">
      <select data-chg="flt" data-v="portfolio" data-f="group" aria-label="Agrupar">${selOpts(Object.entries(GROUPS).map(([v, t]) => ({ v, t: v ? 'Agrupar por ' + t.toLowerCase() : 'Sin agrupar' })), f.group)}</select>
      <select data-chg="flt" data-v="portfolio" data-f="fase" aria-label="Fase">${selOpts(f.tipo === 'Propuesta' ? FASES_PROP : f.tipo === 'Proyecto' ? FASES_PRJ : FASES, f.fase, 'Todas las fases')}</select>
      <select data-chg="flt" data-v="portfolio" data-f="estado" aria-label="Estado">${selOpts(f.tipo === 'Propuesta' ? ESTADOS_PROP : f.tipo === 'Proyecto' ? ESTADOS_PRJ : ESTADOS, f.estado, 'Todos los estados')}</select>
      ${f.tipo === 'Propuesta' ? '' : `<select data-chg="flt" data-v="portfolio" data-f="rag" aria-label="RAG">${selOpts(RAGS, f.rag, 'Todos los RAG')}</select>`}
      <select data-chg="flt" data-v="portfolio" data-f="tini" aria-label="Tipo de iniciativa">${selOpts(((St.cfg.metodo || {}).tipos || []).map(t => t.nombre), f.tini, 'Todos los tipos')}</select>
      <select data-chg="flt" data-v="portfolio" data-f="prio" aria-label="Prioridad">${selOpts(PRIOS, f.prio, 'Toda prioridad')}</select>
      <select data-chg="flt" data-v="portfolio" data-f="resp" aria-label="Responsable">${selOpts(resp, f.resp, 'Todos los responsables')}</select>
      <label class="chk tb-c"><input type="checkbox" ${f.hideDone ? 'checked' : ''} data-chg="flt" data-v="portfolio" data-f="hideDone" data-bool="1"> <span>Ocultar finalizados</span></label>
      </div>
    </div>
    <div class="tbl-w" data-keep="pf"><table class="tbl ${f.dens === 'c' ? 'dense' : ''}"><thead><tr>${cols.map(c => `<th class="${c.num ? 'n' : ''} c-${c.k}" style="min-width:${c.w}px"><button data-act="psort" data-k="${c.k}" aria-label="Ordenar por ${c.h}">${c.h}${f.sort === c.k ? `<span class="sorti">${f.dir > 0 ? '▲' : '▼'}</span>` : ''}</button></th>`).join('')}</tr></thead>
    <tbody>${body || `<tr><td colspan="${cols.length}">${empty('Sin resultados con los filtros actuales')}</td></tr>`}</tbody>
    <tfoot><tr>${cols.map(c => `<td class="${c.num ? 'n' : ''} c-${c.k}">${c.k === 'titulo' ? `<b>Total (${rows.length})</b>` : c.k === 'presupuesto' ? `<b>${fmtTot(tot.p, '<br>')}</b>` : c.k === 'beneficio' ? `<b>${fmtTot(sumM(rows, i => i.beneficio), '<br>')}</b>` : c.k === 'avance' ? `<b>${pct(avg(rows.filter(i => !esProp(i)), i => i.avance))}</b>` : c.k === 'desv' ? `<b>${rows.filter(i => !esProp(i) && atrasado(i)).length} atras.</b>` : ''}</td>`).join('')}</tr></tfoot></table></div>
    <div class="tbl-note"><span class="mut">Consumido: ${fmtTot(tot.g)} (${pctMon(tot.g, tot.p)}%${monKeys(tot.p).length > 1 ? ' en ' + monMain(tot.p) : ''}). Clic en una fila abre el panel contextual. <button class="lnk" data-act="pdens">${f.dens === 'c' ? 'Densidad normal' : 'Densidad compacta'}</button></span></div>`;
  }
};
Chg.pcol = el => { const f = F('portfolio', {}); f.cols = PCOLS.map(c => c.k).filter(k => k === el.dataset.k ? el.checked : f.cols.includes(k)); render(); UI.pop = null; const p = $('#pop-cols'); if (p) { p.classList.add('open'); UI.pop = 'pop-cols'; } };
Acts.pcsv = () => { const f = F('portfolio', {}); const rows = portfolioRows(); const cols = pcols(); download('APIH_portfolio_' + hoy() + '.csv', toCSV(rows, cols.map(c => ({ h: c.h, f: c.f }))), 'text/csv'); toast(rows.length + ' filas exportadas'); };
Views.proyectos = {
  render() {
    const f = F('prj', { q: '', mode: 'board', resp: '', hideDone: true });
    let rows = scopeAll().filter(porTipo); if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.lider + i.id).toLowerCase().includes(q)); } if (f.resp) rows = rows.filter(i => i.lider === f.resp); if (f.hideDone) rows = rows.filter(isLive);
    const KF = planTipo() === 'prj' ? FASES_PRJ : planTipo() === 'prop' ? FASES_PROP : [...FASES_PROP.filter(fs => rows.some(i => i.fase === fs)), ...FASES_PRJ];   // N-U-09: sin columnas de propuestas vacías
    const card = i => { if (!esProp(i)) return cardProyecto(i, UI.sel && UI.sel.id === i.id); const hs = hitosDe(i.id), hd = hs.filter(h => h.completado).length, nh = nextHito(i); return `<article tabindex="0" role="button" class="icard ${UI.sel && UI.sel.id === i.id ? 'sel' : ''}" draggable="true" data-id="${i.id}" data-act="sel" data-t="ini">
      <div class="ic-t"><span class="mono">${i.id}</span>${esProp(i) ? tipoPill(i) : ''}${!['En curso', 'Vigente'].includes(i.estado) ? estPill(i.estado) : ''}${esProp(i) ? '' : ragPill(i.rag)}</div><h3>${esc(i.titulo)}</h3>
      <div class="ic-ph" style="font-size:12px;margin:-2px 0 4px">${faseTag(i)}</div>
      ${f.mode === 'cards' ? `<p class="ic-d">${esc((i.resumen || i.desc || '').slice(0, 150))}</p>` : ''}
      ${planBars(i)}
      <div class="ic-f"><span class="pp">${avatar(i.lider, 20)}<small>${esc(i.lider.split(' ')[0])}</small></span>${prioPill(i.prioridad)}${desv(i) > (0, ENLACES.cfgI)(i,'tolDesv') ? `<span class="pill bad">+${desv(i)} d</span>` : ''}${starsCnt(i) ? `<span class="xtra">${starsCnt(i)}</span>` : ''}</div>
      ${f.mode === 'cards' ? `<div class="ic-x"><span>${icon('flag', 13)} ${hd}/${hs.length} hitos</span><span>${icon('shield', 13)} ${riesgosDe(i.id).filter(riesgoAbierto).length}</span><span>${icon('money', 13)} ${fmtMon(i.presupuesto, monOf(i))}</span><span>${icon('cal', 13)} ${fmtD(forecast(i))}</span></div>${nh ? `<small class="mut">Próx. hito: ${esc(nh.nombre)} · ${fmtD(nh.fecha)}</small>` : ''}` : ''}</article>`; };
    const body = f.mode === 'board'
      ? `<div class="kanban k4c" data-keep="kb" style="grid-template-columns:repeat(${KF.length},minmax(272px,1fr));overflow-x:auto">${KF.map(fs => { const it = rows.filter(i => i.fase === fs); return `<div class="kcol" data-fase="${fs}"><div class="k-h"><i style="background:${FASE_COLOR[fs]}"></i><b>${fs}</b><em>${it.length}</em>${it.length ? `<small class="mut" style="margin-left:auto" title="Promedio de avance de la fase activa">fase ${Math.round(it.reduce((s, x) => s + avFase(x).v, 0) / it.length)}%</small>` : ''}</div><div class="k-b">${it.map(card).join('')}</div></div>`; }).join('')}</div>`
      : `<div class="cards">${rows.sort(by(i => -critScore(i))).map(card).join('') || empty('Sin proyectos')}</div>`;
    return iniHead(rows) + `
    <div class="toolbar">${planSeg()}<div class="search" style="flex:0 1 170px;min-width:120px"><span>${icon('search', 14)}</span><input data-key="in-q" data-chg="flt" data-v="prj" data-f="q" type="search" placeholder="Buscar…" value="${esc(f.q)}"></div>
      
      <label class="chk tb-c"><input type="checkbox" ${f.hideDone ? 'checked' : ''} data-chg="flt" data-v="prj" data-f="hideDone" data-bool="1"> <span>Ocultar cerrados</span></label>
      <div class="seg" style="margin-left:auto"><button class="${f.mode === 'board' ? 'on' : ''}" data-act="imode" data-m="board" title="Columnas por fase" aria-label="Tablero por fase">Por fase</button><button class="${f.mode === 'cards' ? 'on' : ''}" data-act="imode" data-m="cards" title="Tarjetas" aria-label="Tarjetas">Tarjetas</button></div></div>${body}`;
  },
  after() { bindDnD(); }
};

/* ======================= V23 · Tarjeta y panel complementarios =======================
   Tarjeta: ¿dónde está y cómo va?  Panel: ¿por qué está así y qué sigue?  (señales, próximos hitos y pendientes con otras personas) */
export function senalesIni(i) { return (CALC.senales || {})[i && i.id] || []; }   // las señales las calcula el servidor (apih_trabajo)
/* tarjeta de iniciativa (proyectos): lectura de un segundo */
function cardProyecto(i, sel) {
  const FS = fasesDe(i), k = Math.max(0, FS.indexOf(i.fase)), nh = nextHito(i), H = hoy(), ven = hitosDe(i.id).filter(h => !h.completado && h.fecha && h.fecha < H).length, dv = desv(i), plan = Math.round(esperado(i)), av = Math.round(+i.avance || 0);
  const seg = FS.map((f, j) => `<i class="${j < k ? 'done' : j === k ? 'cur' : ''}" title="${esc(f)}"></i>`).join('');
  const dn = nh ? diffD(nh.fecha, H) : 0;
  return `<article tabindex="0" role="button" class="icard ic2 ${sel ? 'sel' : ''}" draggable="true" data-id="${i.id}" data-act="sel" data-t="ini">
      <div class="ic-t"><span class="mono">${i.id}</span>${!['En curso', 'Vigente'].includes(i.estado) ? estPill(i.estado) : ''}${ragPill(i.rag)}<span class="sp"></span>${prioPill(i.prioridad)}</div><h3>${esc(i.titulo)}</h3>
      <div class="ic2-f"><span class="ic2-ph">${fasePill(i.fase)}<small class="mut">fase ${k + 1} de ${FS.length}</small></span><div class="ic2-seg">${seg}</div></div>
      <div class="ic2-av"><div class="ic2-l"><b>Avance ${av} %</b><span class="mut">plan ${plan} %</span></div><div class="ic2-bar" title="Avance ${av} % · plan ${plan} %"><i style="width:${Math.max(0, Math.min(100, av))}%"></i><u style="left:${Math.max(0, Math.min(100, plan))}%"></u></div></div>
      ${nh ? `<div class="ic2-nx">${icon('flag', 14)}<span class="n"><b title="${esc(nh.nombre)}">${esc(nh.nombre)}</b><small>${fmtD(nh.fecha)} <em class="${dn < 0 ? 'bad' : ''}">${dn < 0 ? 'vencido ' + (-dn) + ' d' : dn === 0 ? 'hoy' : 'en ' + dn + ' d'}</em></small></span></div>` : `<div class="ic2-nx mut">${icon('flag', 14)}<span class="n"><b>Sin hitos pendientes</b><small>&nbsp;</small></span></div>`}
      <div class="ic2-ft"><span class="pp">${avatar(i.lider, 22)}<small title="${esc(i.lider || '')}">${esc(String(i.lider || '').split(' ').slice(0, 2).join(' '))}</small></span><span class="sp"></span>${dv > 0 ? `<span class="chip-bad">+${dv} d</span>` : ''}${ven ? `<span class="chip-bad">${ven} ${ven === 1 ? 'vencido' : 'vencidos'}</span>` : ''}</div></article>`;
}
export function faseTag(i, f) {
  f = f || i.fase; const v = ventanaDe(i, f), s = f === i.fase ? subActual(i) : null;
  return `${fasePill(f)}${v && v.ini ? ` <small class="mut fz-rng" title="Inicio y fin de la fase ${esc(f)}">${rangoTx(v.ini, v.fin)}</small>` : ''}${descIco(faseDescDe(i, f))}${s ? ` <small class="fz-subt" title="Subfase en curso · ${rangoTx(s.inicio, s.fin)}">› ${esc(s.nombre)}</small>` : ''}`;
}
const sfChip = (i, v, s) => { const hs = hitosSub(i, s), d = hs.filter(h => h.completado).length, H = hoy(), cur = v.actual && s.inicio <= H && s.fin >= H, bad = subFuera(s, v);
  return `<button class="sf-chip ${cur ? 'cur' : ''} ${bad ? 'bad' : ''}" style="--c:${v.color}" data-act="sfedit" data-id="${i.id}" data-s="${esc(s.id)}" title="Editar subfase"><b>${esc(s.nombre)}</b><small>${rangoTx(s.inicio, s.fin)} · ${d}/${hs.length} hitos${cur ? ' · en curso' : ''}</small>${subDescDe(s) ? `<small class="desc-l">${esc((0, ENLACES.cut)(subDescDe(s), 80))}</small>` : ''}${bad ? `<small style="color:var(--red)">Fuera de la fase (${rangoTx(v.ini, v.fin)})</small>` : ''}</button>`; };
const sfAddBtn = (i, f) => `<button class="sf-add edit-only" data-act="sfnew" data-id="${i.id}" data-f="${esc(f)}" aria-label="Agregar subfase a ${esc(f)}">+ Subfase</button>`;
/* Fila de subfases alineada bajo las fases (ficha › Planificación) */
const sfGrid = (i, V) => `<div class="sf-grid" style="--n:${V.length}">${V.map(v => `<div class="sf-colw">${v.subs.map(s => sfChip(i, v, s)).join('')}${sfAddBtn(i, v.fase)}</div>`).join('')}</div>`;
/* Agrupa la lista de hitos de una fase por subfase (con sus fechas); los hitos sin subfase quedan al final */
function sfAgrupa(v, render) {
  if (!v.subs.length) return v.hitos.map(render).join('');
  const ids = v.subs.map(s => s.id), resto = v.hitos.filter(h => !ids.includes(h.subfase));
  return v.subs.map(s => `<div class="sf-h"><span>${esc(s.nombre)}</span><small class="mut">${rangoTx(s.inicio, s.fin)}</small></div>${v.hitos.filter(h => h.subfase === s.id).map(render).join('') || '<p class="mut" style="font-size:12px;margin:4px 2px">Sin hitos.</p>'}`).join('')
    + (resto.length ? `<div class="sf-h"><span>Sin subfase</span></div>${resto.map(render).join('')}` : '');
}
const sfNextId = i => { let n = 0; subfasesDe(i).forEach(s => { const m = /SF(\d+)$/.exec(s.id || ''); if (m) n = Math.max(n, +m[1]); }); return i.id + '-SF' + (n + 1); };
function subfaseForm(s, iniId, fase) {
  const i = byId(iniId); if (!i) return toast('Iniciativa no encontrada', 'err');
  const nw = !s, FS = fasesDe(i), f0 = (s && s.fase) || (FS.includes(fase) ? fase : i.fase), w0 = ventanaDe(i, f0) || {};
  const v = s ? clone(s) : { fase: f0, nombre: '', inicio: w0.ini || '', fin: w0.fin || '', resp: i.lider || '' };
  openForm({ iniId: i.id,
    title: (nw ? 'Nueva subfase' : 'Editar subfase') + ' · ' + i.titulo, values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Crear' : 'Guardar',
    fields: [{ k: 'fase', l: 'Fase', t: 'select', req: true, w: 3, opts: FS.map(x => { const w = ventanaDe(i, x) || {}; return { v: x, t: x + (w.ini ? ' · ' + rangoTx(w.ini, w.fin) : ' · sin fechas') }; }), hint: 'La subfase vive completa dentro de una sola fase obligatoria' },
      { k: 'nombre', l: 'Nombre de la subfase', req: true, w: 3 }, { k: 'inicio', l: 'Inicio', t: 'date', hint: 'Vacío: hereda el inicio de la fase' }, { k: 'fin', l: 'Fin', t: 'date', hint: 'Vacío: hereda el fin de la fase' }, { k: 'resp', l: 'Responsable', list: people() }, { k: 'desc', l: 'Descripción / instrucciones', t: 'textarea', w: 3, rows: 3, hint: 'Opcional. Se ve en Mi cocina, la ficha y Fases.' }],
    extra: '<p class="mut" style="font-size:12px;margin:10px 0 0">Regla: una subfase no puede extenderse fuera del inicio y fin de su fase. Los hitos de la subfase deben ser de esa misma fase.</p>',
    onDanger: () => confirmBox('¿Eliminar esta subfase? Sus hitos quedarán sin subfase.', () => { cmdServidor('apih_eliminar_subfase', { p_ini: i.id, p_id: s.id }, 'Subfase eliminada'); }, 'Eliminar', true),
    onSave(o) { return cmdServidor('apih_guardar_subfase', { p_ini: i.id, p_id: s ? s.id : null, p_datos: { fase: o.fase, nombre: o.nombre, inicio: o.inicio || '', fin: o.fin || '', resp: o.resp || '', desc: o.desc || '' } }, nw ? 'Subfase creada' : 'Subfase guardada', true).then(r => r !== null); }
  });
}
/* V22.59 · importación de subfases (archivo de iniciativas y «Con archivo»): valida la regla y resuelve referencias por id o nombre */
export function sfImportar(i, lista, warn, sink) {   /* sink: si se pasa, los hitos que siguen a su subfase se anotan ahí (los cambia el servidor) en vez de editarse aquí */
  (Array.isArray(lista) ? lista : []).forEach(x => {
    if (!x || typeof x !== 'object' || typeof x.nombre !== 'string' || !x.nombre.trim() || x.nombre.length > 120) return warn('Subfase sin nombre válido (texto de hasta 120 caracteres; se omite)');
    if (x.resp != null && typeof x.resp !== 'string') return warn('Subfase «' + x.nombre + '»: responsable inválido');
    if (!fasesDe(i).includes(x.fase)) return warn('Subfase «' + x.nombre + '»: fase inválida para ' + tipoLbl(i).toLowerCase());
    const w = ventanaDe(i, x.fase); if (!w || !w.ini || !w.fin) return warn('Subfase «' + x.nombre + '»: la fase ' + x.fase + ' no tiene fechas');
    const ini = x.inicio || w.ini, fin = x.fin || w.fin;
    if (!(0, ENLACES.archFecha)(ini) || !(0, ENLACES.archFecha)(fin) || fin < ini) return warn('Subfase «' + x.nombre + '»: fechas inválidas');
    if (ini < w.ini || fin > w.fin) return warn('Subfase «' + x.nombre + '»: debe quedar dentro de ' + x.fase + ' (' + rangoTx(w.ini, w.fin) + ')');
    const ya = subfasesDe(i).find(s => (x.id && s.id === x.id) || (s.fase === x.fase && _nrm(s.nombre) === _nrm(x.nombre)));
    if (ya) { const faseAnt = ya.fase; Object.assign(ya, { nombre: x.nombre.trim(), fase: x.fase, inicio: ini, fin, resp: x.resp != null ? x.resp : (ya.resp || '') });
      // N-F-04: si la subfase cambia de fase, sus hitos la siguen (y los que no cuadran quedan sin subfase)
      if (faseAnt !== x.fase) (St.hitos || []).forEach(h => { if (h.ini === i.id && h.subfase === ya.id) { if (sink) sink.push({ id: h.id, fase: x.fase }); else h.fase = x.fase; } }); if (typeof x.desc === 'string') { if (x.desc.trim()) ya.desc = cutDesc(x.desc.trim()); else delete ya.desc; } }
    else { if (subfasesDe(i).length >= 60) return warn('Subfase «' + x.nombre + '»: máximo 60 por iniciativa'); i.subfases = subfasesDe(i).concat([{ id: sfNextId(i), nombre: x.nombre.trim(), fase: x.fase, inicio: ini, fin, resp: x.resp || '', ...(typeof x.desc === 'string' && x.desc.trim() ? { desc: cutDesc(x.desc.trim()) } : {}) }]); }
  });
}
/* referencia de subfase en un hito: id o nombre (si hay nombres repetidos en distintas fases, se usa la fase del hito) */
export const sfRef = (i, ref, fase) => { if (!ref) return null; const L = subfasesDe(i); return L.find(s => s.id === ref) || L.find(s => _nrm(s.nombre) === _nrm(ref) && (!fase || s.fase === fase)) || L.find(s => _nrm(s.nombre) === _nrm(ref)) || null; };
Acts.sfnew = d => subfaseForm(null, d.id, d.f);
Acts.sfedit = d => { const i = byId(d.id), s = i && subfasesDe(i).find(x => x.id === d.s); if (s) subfaseForm(s, d.id); };

Chg.ptipo = el => { if (!PLAN_TIPOS.some(t => t[0] === el.value)) return; UI.planTipo = el.value; try { localStorage.setItem('apih_ptipo', el.value); } catch (e) { } Object.assign(F('portfolio', {}), { fase: '', estado: '', rag: '' }); render(); };
Acts.fcat = d => { UI.fcat = Object.assign({}, UI.fcat || {}, { [d.t]: d.c }); render(); };

Views.fases = {
  render() {
    const f = F('fases', { tab: 'gantt', q: '', open: {}, riesgos: true, id: '', fk: null });
    const pool = scopeAll().filter(i => porTipo(i) && i.estado !== 'Cancelado' && i.inicioPlan && i.finPlan);
    if (!pool.length) return pageHead('Fases', 'Fases, hitos y riesgos de cada iniciativa') + empty('Sin iniciativas con fechas para mostrar', 'gantt');
    if (!f.id || !pool.some(i => i.id === f.id)) f.id = (UI.sel && UI.sel.t === 'ini' && pool.some(i => i.id === UI.sel.id)) ? UI.sel.id : (pool.find(isLive) || pool[0]).id;
    const tabs = `<div class="fz-tabs" role="tablist">${FZ_TABS.map(([k, t]) => `<button role="tab" aria-selected="${f.tab === k}" class="${f.tab === k ? 'on' : ''}" data-act="fztab" data-k="${k}">${t}</button>`).join('')}</div>`;
    const selIni = `<label class="tb-l">Iniciativa<select data-chg="flt" data-v="fases" data-f="id">${selOpts(pool.slice().sort(by('id')).map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo })), f.id)}</select></label>`;
    const body = f.tab === 'linea' ? this.linea(byId(f.id), f) : f.tab === 'tablero' ? this.tablero(byId(f.id)) : f.tab === 'riesgos' ? this.riesgos(byId(f.id)) : this.gantt(pool, f);
    return pageHead('Fases', 'Despliega cada iniciativa en sus fases: cronograma, línea de avance con compuerta, tablero de hitos y riesgos en el tiempo.') + tabs +
      `<div class="toolbar">${planSeg()}${f.tab === 'gantt' ? `<div class="search"><span>${icon('search', 14)}</span><input data-key="fz-q" data-chg="flt" data-v="fases" data-f="q" type="search" placeholder="Buscar…" value="${esc(f.q)}"></div><label class="chk tb-c"><input type="checkbox" ${f.riesgos ? 'checked' : ''} data-chg="flt" data-v="fases" data-f="riesgos" data-bool="1"> <span>Riesgos en la línea</span></label>${btn(Object.keys(f.open).filter(k => f.open[k]).length ? 'Contraer todo' : 'Desplegar todo', 'fzall', { cls: 'sm' })}` : selIni}</div>` + body;
  },
  gantt(pool, f) {
    let rows = pool; if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.lider + i.id).toLowerCase().includes(q)); }
    rows = rows.slice().sort(by('inicioPlan'));
    if (!rows.length) return empty('Sin coincidencias', 'search');
    const V = {}; rows.forEach(i => V[i.id] = fasesVentana(i));
    const all = rows.flatMap(i => [i.inicioPlan, i.finPlan, ...V[i.id].map(v => v.fin), ...hitosDe(i.id).map(h => h.fecha)]).filter(Boolean).sort();
    const E = fzEscala(addD(all[0], -3), addD(all[all.length - 1], 3), Math.max(900, Math.min(2400, (diffD(all[all.length - 1], all[0]) + 7) * 6)));
    const segs = (i, top, h, op) => V[i.id].filter(v => v.ini && v.fin).map(v => `<i class="fz-bar" style="left:${E.x(v.ini)}px;width:${Math.max(3, E.x(addD(v.fin, 1)) - E.x(v.ini))}px;top:${top}px;height:${h}px;background:${v.color};opacity:${op}" title="${esc(v.fase + ' · ' + fzd(v.ini) + ' → ' + fzd(v.fin))}"></i>`).join('');
    const out = rows.map(i => {
      const open = !!f.open[i.id], hs = hitosDe(i.id), rk = riesgosDe(i.id).filter(r => riesgoAbierto(r) && r.fRev);
      const head = `<div class="fz-row"><div class="fz-lab"><button class="fz-tg" data-act="fzopen" data-id="${i.id}" aria-expanded="${open}" aria-label="${open ? 'Contraer' : 'Desplegar'} fases de ${esc(i.titulo)}">${icon(open ? 'chevd' : 'chev', 13)}</button><span style="min-width:0"><a class="lnk" data-act="sel" data-t="ini" data-id="${i.id}"><b>${esc(i.titulo)}</b></a><small class="fz-sm">${esc(i.fase)} · ${i.avance || 0}% · ${hs.filter(h => h.completado).length}/${hs.length} hitos</small></span></div>
        <div class="fz-trk" style="width:${E.W}px">${fzGrid(E)}${segs(i, 12, 20, 1)}${!open && f.riesgos ? rk.map(r => fzRsk(E, r)).join('') : ''}</div></div>`;
      if (!open) return head;
      return head + V[i.id].map(v => `<div class="fz-row fz-sub"><div class="fz-lab" style="padding-left:52px"><span class="fz-sw" style="background:${v.color}"></span><span style="min-width:0"><span>${esc(v.fase)}${v.actual ? ' <b class="fz-act">actual</b>' : ''}</span><small class="fz-sm">${fzd(v.ini)} → ${fzd(v.fin)} · ${v.done}/${v.hitos.length} hitos</small></span></div>
        <div class="fz-trk" style="width:${E.W}px">${fzGrid(E)}${v.ini && v.fin ? `<i class="fz-bar" style="left:${E.x(v.ini)}px;width:${Math.max(3, E.x(addD(v.fin, 1)) - E.x(v.ini))}px;top:16px;height:12px;background:${v.color};opacity:.35"></i>` : ''}${v.hitos.map(h => fzHito(E, h)).join('')}${f.riesgos ? fzRiesgosFase(i, v).map(r => fzRsk(E, r)).join('') : ''}</div></div>` + v.subs.map(s => { const hs = hitosSub(i, s); return `<div class="fz-row fz-sub"><div class="fz-lab" style="padding-left:76px"><span style="min-width:0"><a class="lnk" data-act="sfedit" data-id="${i.id}" data-s="${esc(s.id)}">${esc(s.nombre)}</a><small class="fz-sm">${rangoTx(s.inicio, s.fin)} · ${hs.filter(h => h.completado).length}/${hs.length} hitos${subFuera(s, v) ? ' · <b style="color:var(--red)">fuera de la fase</b>' : ''}</small></span></div><div class="fz-trk" style="width:${E.W}px">${fzGrid(E)}<i class="fz-bar" style="left:${E.x(s.inicio)}px;width:${Math.max(3, E.x(addD(s.fin, 1)) - E.x(s.inicio))}px;top:17px;height:10px;border-radius:5px;background:var(--card);border:2px solid ${v.color};box-sizing:border-box" title="${esc(s.nombre + ' · ' + rangoTx(s.inicio, s.fin))}"></i>${hs.map(h => fzHito(E, h)).join('')}</div></div>`; }).join('')).join('');
    }).join('');
    return `<div class="fz-box" data-keep="fzg"><div style="min-width:${320 + E.W}px"><div class="fz-row fz-head"><div class="fz-lab"><b>Iniciativa / fase</b></div><div class="fz-trk" style="width:${E.W}px;height:36px">${fzGrid(E, true)}</div></div>${out}</div></div>
      <div class="fz-leg"><span><i class="fz-h done fz-lg"></i>Hito cumplido</span><span><i class="fz-h fz-lg"></i>Hito pendiente</span><span><i class="fz-h over fz-lg"></i>Hito vencido</span><span><i class="fz-r fz-lg" style="--c:#D13438"></i>Revisión de riesgo (color = nivel)</span><span><i class="fz-hoy fz-lg"></i>Hoy</span></div>`;
  },
  linea(i, f) {
    const V = fasesVentana(i), cur = Math.max(0, V.findIndex(v => v.actual)), k = f.fk != null && V[f.fk] && f.fid === i.id ? f.fk : cur, v = V[k];
    const steps = `<div class="fz-steps" style="--n:${V.length}">${V.map(x => `<button class="fz-step ${x.k === k ? 'on' : ''} ${x.actual ? 'act' : ''}" style="--c:${x.color}" data-act="fzsel" data-k="${x.k}" data-id="${i.id}"><span class="fz-st"><span class="fz-num">${x.k + 1}</span>${esc(x.fase)}</span><small class="fz-sm">${fzd(x.ini)} → ${fzd(x.fin)}${x.ini && x.fin ? ' · ' + (diffD(x.fin, x.ini) + 1) + ' días' : ''}</small>${faseDescDe(i, x.fase) ? `<small class="desc-l" title="${esc((0, ENLACES.cut)(faseDescDe(i, x.fase), 300))}">${esc((0, ENLACES.cut)(faseDescDe(i, x.fase), 70))}</small>` : ''}<span class="fz-pb" title="Avance de la fase: ${pctFase(i, x)}%"><i style="width:${pctFase(i, x)}%"></i></span><small>${x.done}/${x.hitos.length} hitos · ${x.actual ? 'En curso' : x.pasada ? 'Completada' : 'Por iniciar'}</small></button>`).join('')}</div>`;
    const lista = v.hitos.length || v.subs.length ? sfAgrupa(v, h => { const e = hitoEstado(h); return `<div class="fz-li"><span class="fz-ck" style="border-color:${e.c};background:${h.completado ? e.c : 'transparent'}">${h.completado ? '✓' : ''}</span><span style="flex:1 1 auto">${esc(h.nombre)}</span><span class="fz-pill" style="color:${fzTx(e.c)};border:1px solid ${e.c}">${esc(e.t)}</span><small class="mut">${esc(h.resp || '')}</small><b style="width:46px;text-align:right">${fzd(h.fecha)}</b></div>`; }) : '<p class="mut" style="padding:12px 16px">Sin hitos en esta fase.</p>';
    const FS = fasesDe(i), nx = FS[FS.indexOf(i.fase) + 1];
    let gate = '<p class="mut">Última fase: no hay compuerta siguiente.</p>';
    if (nx) { const g = compuertas(i), okN = g.filter(x => x.ok).length; gate = `<div class="mut" style="font-size:12px;margin-bottom:8px">${okN} de ${g.length} condiciones cumplidas</div>${g.map(x => `<div class="fz-g"><b style="color:${x.ok ? 'var(--green)' : 'var(--red)'}">${x.ok ? '✓' : '✕'}</b><span>${esc(x.t)}</span></div>`).join('') || '<p class="mut">Sin condiciones para esta fase.</p>'}<span class="edit-only">${btn('Avanzar a ' + nx, 'advance', { d: { id: i.id }, cls: okN === g.length ? 'pri' : '' })}</span>`; }
    return steps + `<div class="fz-2"><div class="fz-card" style="flex:999 1 560px;min-width:0"><div class="fz-ch"><h3>Hitos de ${esc(v.fase)}</h3><small class="mut">${fzd(v.ini)} → ${fzd(v.fin)}</small></div><div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px">${v.subs.map(s => sfChip(i, v, s)).join('')}${sfAddBtn(i, v.fase)}</div>${lista}</div>
      <div class="fz-card" style="flex:1 1 320px;min-width:0;padding:14px 16px"><h3 style="margin:0 0 4px">Compuerta${nx ? ' hacia ' + esc(nx) : ''}</h3>${gate}</div></div>`;
  },
  tablero(i) {
    const V = fasesVentana(i);
    return `<div class="fz-cols" style="--n:${V.length}">${V.map(v => { const rk = fzRiesgosFase(i, v).sort(by(r => -expo(r)));
      return `<div class="fz-col"><div class="fz-colh" style="background:${v.color}"><b>${esc(v.fase)}${v.actual ? ' · actual' : ''}</b><small>${fzd(v.ini)} → ${fzd(v.fin)} · ${v.done}/${v.hitos.length} hitos</small></div><div class="fz-colb">
        ${sfAgrupa(v, h => { const e = hitoEstado(h); return `<div class="fz-it"><div>${esc(h.nombre)}</div><div class="fz-itm"><span class="fz-pill" style="color:${fzTx(e.c)};border:1px solid ${e.c}">${esc(e.t)}</span><small class="mut">${fzd(h.fecha)}</small></div></div>`; }) || '<p class="mut">Sin hitos.</p>'}${sfAddBtn(i, v.fase)}
        ${rk.length ? `<div class="fz-rt">Riesgos que se revisan en esta fase</div>${rk.map(r => { const n = nivelRiesgo(r); return `<div class="fz-it fz-ri"><span class="fz-exp" style="background:${n.c};color:${fzOn(n.c)}">${expo(r)}</span><span style="flex:1 1 auto">${esc(r.desc)}</span><small class="mut">${fzd(r.fRev)}</small></div>`; }).join('')}` : ''}</div></div>`; }).join('')}</div>`;
  },
  riesgos(i) {
    const V = fasesVentana(i), rk = riesgosDe(i.id).filter(riesgoAbierto).sort(by(r => -expo(r)));
    if (!rk.length) return empty('Esta iniciativa no tiene riesgos abiertos', 'shield');
    const ds = [i.inicioPlan, i.finPlan, ...V.map(v => v.fin), ...rk.map(r => r.fIdent), ...rk.map(r => r.fRev)].filter(Boolean).sort();
    const E = fzEscala(addD(ds[0], -2), addD(ds[ds.length - 1], 2), Math.max(900, Math.min(2000, (diffD(ds[ds.length - 1], ds[0]) + 5) * 16)));
    const fase = d => (V.find(v => d && v.ini && v.fin && d >= v.ini && d <= v.fin) || {}).fase || '—';
    const fb = V.filter(v => v.ini && v.fin).map(v => `<i class="fz-fb" style="left:${E.x(v.ini)}px;width:${Math.max(3, E.x(addD(v.fin, 1)) - E.x(v.ini))}px;background:${v.color}">${esc(v.fase)}</i>`).join('');
    const rows = rk.map(r => { const n = nivelRiesgo(r), a = r.fIdent || i.inicioPlan, b = r.fRev || a, venc = r.fRev && r.fRev < hoy();
      return `<div class="fz-row"><div class="fz-lab"><span class="fz-exp" style="background:${n.c};color:${fzOn(n.c)}">${expo(r)}</span><span style="min-width:0;flex:1 1 auto"><a class="lnk fz-1l" data-act="sel" data-t="risk" data-id="${r.id}" title="${esc(r.desc)}">${esc(r.desc)}</a><small class="fz-sm">${n.n} · ${esc(r.dueno || '—')} · revisa ${fzd(r.fRev)}${venc ? ' <b style="color:var(--red)">vencida</b>' : ''} · ${esc(fase(r.fRev))}</small></span></div>
        <div class="fz-trk" style="width:${E.W}px;height:46px">${fzGrid(E)}<i class="fz-bar" style="left:${E.x(a)}px;width:${Math.max(4, E.x(addD(b, 1)) - E.x(a))}px;top:17px;height:12px;border-radius:6px;background:${n.c};opacity:.85"></i></div></div>`; }).join('');
    return `<p class="mut" style="margin:0 0 10px">Cada barra va desde la identificación del riesgo hasta su fecha de revisión; arriba, la ventana de cada fase.</p><div class="fz-box" data-keep="fzr"><div style="min-width:${320 + E.W}px">
      <div class="fz-row fz-head"><div class="fz-lab"><b>Fase</b></div><div class="fz-trk" style="width:${E.W}px;height:32px">${fb}</div></div>
      <div class="fz-row fz-head"><div class="fz-lab"><b>Riesgo · exposición</b></div><div class="fz-trk" style="width:${E.W}px;height:30px">${fzGrid(E, true)}</div></div>${rows}</div></div>`;
  }
};
Acts.fztab = d => { F('fases', {}).tab = d.k; render(); };
Acts.fzopen = d => { const f = F('fases', {}); f.open = Object.assign({}, f.open || {}, { [d.id]: !(f.open || {})[d.id] }); render(); };
Acts.fzall = () => { const f = F('fases', {}), any = Object.keys(f.open || {}).some(k => f.open[k]); f.open = {}; if (!any) scopeAll().forEach(i => f.open[i.id] = true); render(); };
Acts.fzsel = d => { const f = F('fases', {}); f.fk = +d.k; f.fid = d.id; render(); };

/* ======================= V22.54 · Siguientes pasos (reglas explicables) + Planificación en la ficha ======================= */
const PASO_U = [['Hoy', '#FDE7E9', '#A4262C'], ['Esta semana', '#FFF4CE', '#6B4E00'], ['Próximo', '#EAF1FB', '#0D446A']];
/* C2.28 · Preferencias personales de «Siguientes pasos» (viajan con el usuario, no con el navegador):
   St.cfgU[usuario].sem = { pp: filtro de proyecto, posp: {paso: «oculto hasta»}, aj: {paso: ajuste de importancia}, t: [pendientes personales] } */
export const semOf = () => (0, ENLACES.cfgUOf)(miUsuario()).sem || {};
export function semSet(o) { if (FL.verComo) { toast('En «Ver como» no se guardan cambios', 'err'); return false; } (0, ENLACES.cfgSet)(miUsuario(), { sem: Object.assign({}, semOf(), o) }); return true; }
const pospGet = () => { let l = {}; try { l = JSON.parse(localStorage.getItem('apih_posp') || '{}'); } catch (e) { } return Object.assign({}, l, semOf().posp || {}); };
const pospSet = o => { try { localStorage.removeItem('apih_posp'); } catch (e) { } semSet({ posp: o }); };
const pospOn = k => { const p = pospGet()[k]; return !!p && p > hoy(); };
/* Importancia 0–100: la calcula el servidor (apih_cielo: base por plazo y criticidad + el ajuste propio guardado); aquí solo se muestra */
const SEM_AJ = [[-20, 'Baja'], [0, 'Normal'], [15, 'Alta'], [30, 'Máxima']];   // etiquetas de las opciones; el servidor valida el valor (apih_ajustar_paso)
const SEM_CATS = ['Trabajo', 'Desarrollo profesional', 'Personal'];
const pasoAj = p => +p.aj || 0;
const pasoPts = p => +p.pts || 0;
/* Pendientes personales: viven aparte del portafolio (sin tenedores, sin reportes, sin presentaciones) */
function tareasPasos() { return ((CALC.cielo || {}).tareas || []).map(t => Object.assign({}, t, { ini: null, nota: '' })); }   // urgencia e importancia: del servidor
/* Pasos sugeridos de una iniciativa. u: 0 hoy · 1 esta semana · 2 próximo. prot: tenedor o compuerta que protege.
   Qué pasos hay y su urgencia los calcula el servidor (apih_cielo().pasos); aquí solo se aplican las preferencias personales (ocultar) y las descripciones. */
export function pasosDe(i) {
  if (!i || isDone(i)) return [];
  const P = ((CALC.cielo || {}).pasos || {})[i.id] || [], hs = hitosDe(i.id);
  return P.map(p => Object.assign({}, p, { ini: i, nota: p.nr ? (p.nr.h ? hitoDescDe(i, hs.find(h => h.id === p.nr.h)) : faseDescDe(i, p.nr.fase)) : '' })).filter(p => !pospOn(p.k)).sort(by(p => p.u + '|' + p.f));
}
function pasoHTML(p, conIni) {
  const U = PASO_U[p.u], aj = pasoAj(p);
  const pt = conIni ? `<span class="ps-ptw" title="Importancia (0–100): plazo y criticidad${aj ? ', ' + (aj > 0 ? '+' : '') + aj + ' por tu ajuste' : ''}. Toca para ajustarla"><span class="ps-pt">${pasoPts(p)}</span><i class="ps-ar edit-only" aria-hidden="true">▾</i><select class="ps-aj edit-only" data-chg="pasoaj" data-k="${esc(p.k)}" aria-label="Tu ajuste de importancia (puntaje ${pasoPts(p)})">${selOpts(SEM_AJ.map(a => ({ v: a[0], t: 'Importancia: ' + a[1] })), aj)}</select></span>` : '';
  const acc = p.tarea ? btn('Editar', 'tareaedit', { d: { id: p.tarea.id }, cls: 'sm' }) : `<button class="btn sm ic-only" data-act="pasopos" data-k="${esc(p.k)}" title="Ocultar hasta mañana" aria-label="Ocultar hasta mañana">${icon('eyeoff', 15)}</button>`;
  return `<div class="ps-it"><div class="ps-h"><span class="ps-u" style="background:${U[1]};color:${U[2]}">${U[0]}</span><span class="mut ps-k">${esc(p.tipo)}</span>${conIni ? (p.ini ? `<a class="lnk ps-ini" data-act="sel" data-t="ini" data-id="${p.ini.id}" title="${esc(p.ini.titulo)}">${esc((0, ENLACES.cut)(p.ini.titulo, 34))}</a>` : '<span class="ps-ini mut">Pendiente personal</span>') : ''}${pt}</div>
    <div class="ps-t" title="${esc(p.t)}">${esc(p.t)}</div><div class="ps-p" title="${esc(p.por)}">${esc(p.por)}</div>${p.nota ? `<div class="ps-nota">${icon('info', 12)}<span>${esc(p.nota)}</span></div>` : ''}
    <div class="ps-a"><span class="ps-pr">${p.tarea ? '' : 'protege: '}${esc(p.prot)}</span><span class="edit-only ps-b">${btn(p.btn, p.act, { d: p.d, cls: 'sm pri' })}${acc}</span></div></div>`;
}
Acts.pasopos = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const p = pospGet(); p[d.k] = addD(hoy(), 1); Object.keys(p).forEach(k => { if (p[k] <= hoy()) delete p[k]; }); pospSet(p); toast('Paso oculto hasta mañana'); refresh(); };
Chg.pasoaj = async el => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); if (FL.verComo) { toast('En «Ver como» no se guardan cambios', 'err'); return; } const r = await (0, ENLACES.cmdServidor)('apih_ajustar_paso', { p_k: el.dataset.k, p_aj: +el.value || 0 }, 'Importancia ajustada: queda guardada en tu perfil'); if (r !== null) refresh(); };
/* Pendientes personales (clasificados; «Desarrollo profesional» alimenta tu historial) */
function tareaForm(t) {
  const nw = !t;
  openForm({
    title: nw ? 'Nuevo pendiente personal' : 'Editar pendiente', saveLabel: nw ? 'Agregar' : 'Guardar', danger: nw ? null : 'Eliminar', values: t ? clone(t) : { t: '', cat: SEM_CATS[0], f: '' },
    fields: [{ k: 't', l: '¿Qué necesitas hacer?', t: 'textarea', req: true, w: 3 }, { k: 'cat', l: 'Clasificación', t: 'select', opts: SEM_CATS, w: 2 }, { k: 'f', l: 'Fecha (opcional)', t: 'date', w: 1 }],
    onDanger: () => confirmBox('¿Eliminar este pendiente?', async () => { const r = await (0, ENLACES.cmdServidor)('apih_tarea_estado', { p_id: t.id, p_accion: 'eliminar' }, 'Pendiente eliminado'); if (r !== null) refresh(); }, 'Eliminar', true),
    onSave(o) {   // el servidor valida (largo, fecha, clasificación, máximo) y asigna el id
      if (FL.verComo) { toast('En «Ver como» no se guardan cambios', 'err'); return false; }
      return (0, ENLACES.cmdServidor)('apih_guardar_tarea', { p_tarea: { id: nw ? null : t.id, t: o.t, cat: o.cat, f: o.f || '' } }, nw ? 'Pendiente agregado a tu lista' : 'Pendiente actualizado', true).then(r => { if (r === null) return false; refresh(); return true; });
    }
  });
}
Acts.tareanew = () => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); tareaForm(null); };
Acts.tareaedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const t = (((CALC.cielo || {}).tareas || []).find(x => x.tarea && x.tarea.id === d.id) || {}).tarea; if (t) tareaForm(t); };
Acts.tareahecha = async d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); if (FL.verComo) { toast('En «Ver como» no se guardan cambios', 'err'); return; } const r = await (0, ENLACES.cmdServidor)('apih_tarea_estado', { p_id: d.id, p_accion: 'hecha' }, 'Pendiente hecho'); if (r !== null) refresh(); };
/* Pestaña «Planificación» de la ficha: fases, cronograma, próximos 14 días y siguientes pasos */
/* avance de una fase para mostrar: la calculada; una fase ya superada sin unidades vale 100 % */
const pctFase = (i, v) => v.avance;
/* Tarjeta «Ciclo de vida»: lo que antes estaba repartido entre Fase, Estado, Avance y fechas, en un solo lugar */
function cicloCard(i, V) {
  const PR = esProp(i), fin = isDone(i), c = avanceCalc(i), m = avanceManualDe(i), ef = avanceEf(i), fx = V.reduce((n, v) => n + hitosFuera(i, v).length, 0), expl = V.every(v => v.explicita);
  const F_ = fasesDe(i), idx = F_.indexOf(i.fase), nx = F_[idx + 1], g = fin ? [] : compuertas(i), okN = g.filter(x => x.ok).length;
  const kvs = [
    kv('Fase', faseTag(i)), kv('Estado', estPill(i.estado) + (i.estadoMotivo ? ` <small class="mut">${esc(i.estadoMotivo)}${i.estadoRev ? ' · revisión ' + fmtD(i.estadoRev) : ''}</small>` : '')),
    ...(PR ? [] : [kv('Avance', `<b>${ef}%</b> <small class="mut">${m != null ? 'ajustado a mano · calculado ' + c + '%' : 'calculado con hitos y subfases'}</small>${m != null ? ` <a class="lnk edit-only" data-act="avauto" data-id="${i.id}">Usar el calculado</a>` : ''}`)]),
    ...(fin ? [] : [kv(nx ? 'Para pasar a ' + nx : PR ? 'Para aprobar' : 'Para completar', `${okN} de ${g.length} condiciones <small class="mut">(${g.length - okN ? 'faltan ' + (g.length - okN) : 'todo listo'})</small>`)])
  ].join('');
  return `<div class="fz-card" style="padding:12px 14px"><div class="fz-ch" style="padding:0 0 8px;border:0"><h3>Ciclo de vida</h3><span class="edit-only" style="display:inline-flex;gap:6px">${fin ? '' : btn(!nx && PR ? 'Aprobar / cambiar etapa' : 'Cambiar etapa', 'etapa', { d: { id: i.id }, ic: 'chev', cls: 'sm pri', title: 'Mover de fase, cambiar el estado, aprobar o completar (con sus compuertas)' })}</span></div><div class="kvs">${kvs}</div>
    ${!PR && !expl ? `<div class="note warn" style="margin-top:8px">${icon('warn', 14)}<span>Las fechas de las fases se están <b>deduciendo de los hitos</b>. <a class="lnk edit-only" data-act="fasefix" data-id="${i.id}">Fijarlas ahora</a> para que el cronograma y el avance ponderado no cambien al mover un hito.</span></div>` : ''}
    ${fx ? `<div class="note warn" style="margin-top:8px">${icon('warn', 14)}<span>${fx} hito${fx === 1 ? '' : 's'} con fecha fuera de su fase. Corrige el hito o las fechas de la fase.</span></div>` : ''}</div>`;
}
export function planFichaHTML(i) {
  const V = fasesVentana(i), H = hoy(), P = pasosDe(i);
  const steps = `<div class="fz-steps" style="--n:${V.length}">${V.map(x => `<div class="fz-step ${x.actual ? 'on act' : ''}" style="--c:${x.color};cursor:default"><span class="fz-st"><span class="fz-num">${x.k + 1}</span>${esc(x.fase)}</span><small class="fz-sm">${fzd(x.ini)} → ${fzd(x.fin)} · ${x.done}/${x.hitos.length} hitos</small>${faseDescDe(i, x.fase) ? `<small class="desc-l">${esc((0, ENLACES.cut)(faseDescDe(i, x.fase), 90))}</small>` : ''}<span class="fz-pb"><i style="width:${x.hitos.length ? Math.round(x.done / x.hitos.length * 100) : 0}%"></i></span><button class="sf-add edit-only" style="margin-top:6px" data-act="fnota" data-id="${i.id}" data-f="${esc(x.fase)}" aria-label="Nota de la fase ${esc(x.fase)}">${faseNotaP(i, x.fase) ? 'Editar nota' : '+ Nota'}</button></div>`).join('')}</div>`;
  const prox = [...hitosDe(i.id).filter(h => !h.completado && h.fecha >= H && diffD(h.fecha, H) <= 14).map(h => ({ f: h.fecha, k: 'Hito', c: '#0D446A', t: h.nombre })),
    ...riesgosDe(i.id).filter(r => riesgoAbierto(r) && r.fRev && r.fRev >= H && diffD(r.fRev, H) <= 14).map(r => ({ f: r.fRev, k: 'Riesgo', c: '#A4262C', t: 'Revisión: ' + r.desc }))].sort(by('f'));
  const g = V.some(v => v.ini) ? Views.fases.gantt([i], { q: '', open: { [i.id]: true }, riesgos: true }) : `<div class="note">${icon('cal', 14)}<span>Define ${esProp(i) ? 'las fechas tentativas' : 'las fechas plan'} (inicio y fin) para ver el cronograma de fases con sus hitos y riesgos.</span></div>`;
  return `<div class="fz-2" style="margin-top:0"><div style="flex:999 1 620px;min-width:0;display:flex;flex-direction:column;gap:12px">
      ${cicloCard(i, V)}
      <div class="fz-card" style="padding:12px 14px"><div class="fz-ch" style="padding:0 0 10px;border:0"><h3>Fases</h3><span style="display:inline-flex;gap:10px;align-items:center">${esProp(i) ? '' : `<a class="lnk edit-only" data-act="fasefechas" data-id="${i.id}">Editar fechas de las fases</a>`}<a class="lnk" data-act="fzir" data-id="${i.id}">Abrir en Planificación › Fases</a></span></div>${steps}${sfGrid(i, V)}</div>
      ${g}
      <div class="fz-card" style="padding:12px 14px"><h3 style="margin:0 0 6px">Próximos 14 días</h3>${prox.length ? prox.map(p => `<div class="fz-li" style="padding:7px 0"><b style="width:44px">${fzd(p.f)}</b><span class="fz-pill" style="color:${p.c};border:1px solid ${p.c}">${p.k}</span><span>${esc(p.t)}</span></div>`).join('') : '<p class="mut">Nada programado en los próximos 14 días.</p>'}</div></div>
    <div class="fz-card" style="flex:1 1 340px;min-width:0;padding:12px 14px"><div class="fz-ch" style="padding:0 0 4px;border:0"><h3>Siguientes pasos</h3><small class="mut">${P.length} sugerido${P.length === 1 ? '' : 's'}</small></div><p class="mut" style="font-size:12px;margin:0 0 10px">Calculados con las reglas de APIH: hitos, compuerta de fase, riesgos, compromisos y tenedores.</p>${P.length ? P.map(p => pasoHTML(p)).join('') : '<p class="mut">Sin pasos pendientes. ¡Todo al día!</p>'}</div></div>`;
}
Acts.avauto = async d => { const i = byId(d.id); if (!i || esProp(i)) return; await (0, ENLACES.cmdServidor)('apih_avance_auto', { p_id: d.id }, 'Avance: se usa el calculado'); };
Acts.fasefix = async d => { const i = byId(d.id); if (!i || esProp(i)) return; if (!(0, ENLACES.puedeEditarIni)(i) || (0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Sin permiso para editar este proyecto'); const r = await cmdServidor('apih_fases_fechas', { p_id: i.id, p_ff: null }, 'Fechas de las fases fijadas'); if (r !== null) refresh(); };
Acts.fasefechas = d => {
  const i = byId(d.id); if (!i || esProp(i)) return; if (!(0, ENLACES.puedeEditarIni)(i) || (0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Sin permiso para editar este proyecto');
  const V = fasesVentana(i), v = {}, fields = [];
  V.forEach(x => { v['i' + x.k] = x.ini || ''; v['f' + x.k] = x.fin || ''; fields.push({ sec: x.fase }, { k: 'i' + x.k, l: 'Inicio', t: 'date', req: true, w: 1 }, { k: 'f' + x.k, l: 'Fin', t: 'date', req: true, w: 1 }); });
  openForm({ iniId: i.id, title: 'Fechas de las fases · ' + i.titulo, values: v, fields, saveLabel: 'Guardar',
    extra: '<p class="mut" style="font-size:12px;margin:10px 0 0">Cada fase empieza después de que termina la anterior. El inicio plan y el fin plan del proyecto son el inicio de la primera y el fin de la última. Las subfases deben quedar dentro de su fase; los hitos fuera de su fase se marcan como alerta.</p>',
    onSave(o) {
      const FF = {}; V.forEach(x => { FF[x.fase] = { ini: o['i' + x.k], fin: o['f' + x.k] }; });
      return cmdServidor('apih_fases_fechas', { p_id: i.id, p_ff: FF }, 'Fechas guardadas', true).then(r => { if (r === null) return false; refresh(); return true; });
    } });
};
Acts.fzir = d => { const f = F('fases', {}); f.tab = 'linea'; f.id = d.id; UI.view = 'fases'; render(); };
/* Mi cocina: pasos de todos mis proyectos activos */
export function pasosCocinaHTML(me) {
  const f = F('cielo', {}), mine = (0, ENLACES.proyActivos)(me, (0, ENLACES.hoyW)()), TP = tareasPasos();
  let P = mine.flatMap(pasosDe).filter(p => p.u <= 1); const pp0 = f.pp !== undefined ? f.pp : (semOf().pp || ''), pp = pp0 === '__per' && TP.length ? '__per' : (mine.some(i => i.id === pp0) ? pp0 : '');
  if (pp === '__per') P = []; else if (pp) P = P.filter(p => p.ini.id === pp);
  if (!pp || pp === '__per') P = P.concat(TP);
  P.sort((a, b) => pasoPts(b) - pasoPts(a) || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0)); const tot = P.length; if (!f.psAll) P = P.slice(0, 5);
  const KT = { 'Al día': 'dia', Hitos: 'hit', Compromisos: 'cmp', Riesgos: 'rsk' };
  const prender = new Set(P.filter(p => p.ini && p.u === 0 && KT[p.prot] && ((0, ENLACES.starsOf)(p.ini, (0, ENLACES.hoyW)()).find(x => x.k === KT[p.prot]) || {}).s === 'off').map(p => p.ini.id + KT[p.prot])).size;
  const chips = `<div class="ps-f">${[['', 'Todos'], ...mine.map(i => [i.id, (0, ENLACES.cut)(i.titulo, 26)]), ...(TP.length ? [['__per', 'Mis pendientes (' + TP.length + ')']] : [])].map(([v, t]) => `<button class="${pp === v ? 'on' : ''}" data-act="pasof" data-v="${v}">${esc(t)}</button>`).join('')}</div>`;
  const grp = P.length ? '<div class="ps-gr">' + P.map(p => pasoHTML(p, true)).join('') + '</div>' : '';
  return `<section class="card ps-card"><header><h2>Tus siguientes pasos</h2><small>ordenados por importancia (plazo, criticidad y tu ajuste)</small><span style="margin-left:auto;display:inline-flex;gap:6px;flex-wrap:wrap">${mine.length ? btn('Borrador del reporte semanal', 'semrep', { ic: 'send', cls: 'sm' }) : ''}<span class="edit-only">${btn('Agregar pendiente', 'tareanew', { ic: 'plus', cls: 'sm' })}</span></span></header>
    ${prender ? `<div class="ps-ban">${icon('fork', 15)}<span>Si completas los pasos de hoy puedes encender <b>${prender}</b> tenedor${prender === 1 ? '' : 'es'} esta semana.</span></div>` : ''}${chips}${grp || '<p class="mut">Sin pasos para hoy ni esta semana. ¡Mesa al día!</p>'}${tot > 5 ? btn(f.psAll ? 'Ver solo los 5 primeros' : 'Ver los ' + tot + ' pasos', 'pasoall', { cls: 'sm' }) : ''}</section>`;
}
Acts.pasof = d => { F('cielo', {}).pp = d.v; if (!(0, ENLACES.soloLectura)()) semSet({ pp: d.v }); render(); };
Acts.pasoall = () => { const f = F('cielo', {}); f.psAll = !f.psAll; render(); };
