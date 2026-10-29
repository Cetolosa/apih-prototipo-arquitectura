/* 05c-vistas-seguimiento — continuación de 05-vistas.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { $, BIT_C, BIT_TIPOS, DECS, DEC_C, DEC_ICON, DEC_TIPOS, DIAS, FASES, FASES_ACT, FASES_PIPE, HITOS, MES3, MESES, RAG_C, RIESGOS, RISK_CATS, RISK_ESTADOS, St, addD, avatar, by, byId, desv, diffD, esProp, esSB, esc, expo, fmtD, fmtDL, forecast, hitoCats, hitoEstado, hitosDe, hoy, icon, inArea, isLive, nameOf, nivelRiesgo, pD, pct, personProjects, planSeg, porTipo, rel, respItem, respSel, riesgoAbierto, scope, scopeAll, scopeP, sum, toISO, uid, uniq } from './01-nucleo.js';
import { Acts, Chg, F, Modal, UI, Views, btn, confirmBox, copyText, download, empty, go, hbars, iniLink, openForm, pageHead, refresh, render, selOpts, selectEntity, syncPop, toCSV, toast } from './03-interfaz.js';
import { decForm, iniOpts, iniOptsF, people } from './03b-interfaz-excel-formularios.js';
import { avanceCalc, avanceEf, avanceManualDe } from './01-nucleo.js';
import { DESC_MAX, cutDesc, fasesFechasDe, fasesVentana, hitosFuera, rangoTx, subfasesDe, ventanaDe } from './05-vistas.js';
import { faseTag, pcols, portfolioRows } from './05b-vistas-portafolio-fases.js';


/* ======================= GANTT ======================= */
const GZ = { week: { n: 'Semana', p: 11 }, month: { n: 'Mes', p: 4.2 }, quarter: { n: 'Trimestre', p: 1.5 } };
Views.gantt = {
  render() {
    const f = F('gantt', { zoom: 'month', group: 'area', q: '', fases: 'all', deps: true, focus: '' });
    let rows = scopeAll().filter(i => porTipo(i) && i.inicioPlan && i.finPlan && i.estado !== 'Cancelado');
    if (f.fases === 'act') rows = rows.filter(i => FASES_ACT.includes(i.fase) && isLive(i)); else if (f.fases === 'pipe') rows = rows.filter(i => FASES_PIPE.includes(i.fase)); else if (f.fases === 'live') rows = rows.filter(isLive);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.lider).toLowerCase().includes(q)); }
    rows = rows.slice().sort((a, b) => ((f.group === 'area' ? a.area.localeCompare(b.area) : f.group === 'fase' ? FASES.indexOf(a.fase) - FASES.indexOf(b.fase) : 0) || a.inicioPlan.localeCompare(b.inicioPlan)));
    if (!rows.length) return pageHead('Gantt', 'Cronograma del portafolio') + empty('Sin proyectos con fechas para mostrar', 'gantt');
    const ppd = GZ[f.zoom].p, RH = 36, LW = 350, HH = 52;
    const minD = addD(rows.map(i => i.inicioReal && i.inicioReal < i.inicioPlan ? i.inicioReal : i.inicioPlan).reduce((a, b) => a < b ? a : b), -21);
    const maxD = addD(rows.map(i => forecast(i) > i.finPlan ? forecast(i) : i.finPlan).reduce((a, b) => a > b ? a : b), 45);
    const x = d => diffD(d, minD) * ppd, TW = Math.ceil(x(maxD)), N = rows.length;
    // cabecera de meses
    let mh = '', yh = '', d0 = pD(minD); let cur = new Date(d0.getFullYear(), d0.getMonth(), 1, 12);
    while (toISO(cur) <= maxD) { const s = toISO(cur), nx = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12), e = toISO(nx); const xs = Math.max(0, x(s)), xe = x(e); mh += `<div class="g-m" style="left:${xs}px;width:${xe - xs}px">${f.zoom === 'quarter' ? MES3[cur.getMonth()][0] : MES3[cur.getMonth()]}</div>`; if (cur.getMonth() === 0 || !yh) yh += `<div class="g-y" style="left:${xs}px">${cur.getFullYear()}</div>`; cur = nx; }
    let wk = ''; if (f.zoom === 'week') { let w = pD(minD); while (w.getDay() !== 1) w.setDate(w.getDate() + 1); while (toISO(w) <= maxD) { wk += `<i class="g-w" style="left:${x(toISO(w))}px"></i>`; w.setDate(w.getDate() + 7); } }
    let vl = ''; cur = new Date(d0.getFullYear(), d0.getMonth(), 1, 12); while (toISO(cur) <= maxD) { vl += `<i class="g-vl" style="left:${x(toISO(cur))}px"></i>`; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1, 12); }
    const idxOf = {}; rows.forEach((i, k) => idxOf[i.id] = k);
    const left = rows.map((i, k) => { const dur = diffD(i.finPlan, i.inicioPlan); const dp = i.deps.map(d => { const z = byId(d); return z ? z.id.slice(4) : ''; }).filter(Boolean);
      return `<div class="g-lr ${f.focus === i.id ? 'foc' : ''} ${UI.sel && UI.sel.id === i.id ? 'sel' : ''}" style="height:${RH}px" data-act="sel" data-t="ini" data-id="${i.id}"><span class="g-n" title="${esc(i.titulo)}"><i style="background:${RAG_C[i.rag]}"></i>${esc(i.titulo)}</span><span class="g-c">${fmtD(i.inicioPlan)}</span><span class="g-c">${fmtD(i.finPlan)}</span><span class="g-c n">${dur} d</span><span class="g-c dp" title="Depende de ${esc(dp.join(', '))}">${dp.length ? dp.map(z => '#' + z).join(' ') : '—'}</span></div>`; }).join('');
    const bars = rows.map((i, k) => {
      const top = k * RH, fc = forecast(i), tent = FASES_PIPE.includes(i.fase), done = i.estado === 'Completado';
      const bs = x(i.inicioReal && !tent ? i.inicioReal : i.inicioPlan), be = x(fc > i.finPlan ? fc : i.finPlan), bw = Math.max(6, be - bs), fillW = bw * Math.min(100, i.avance) / 100;
      const hs = hitosDe(i.id).map(h => { const e = hitoEstado(h); return `<i class="g-ms" style="left:${x(h.fecha) - 6}px;top:${top + RH / 2 - 6}px;background:${e.c}" data-act="sel" data-t="hito" data-id="${h.id}" title="${esc(h.nombre)} · ${fmtD(h.fecha)} · ${e.t}"></i>`; }).join('');
      return `<div class="g-base" style="left:${x(i.inicioPlan)}px;width:${Math.max(4, x(i.finPlan) - x(i.inicioPlan))}px;top:${top + RH - 9}px" title="Línea base: ${fmtD(i.inicioPlan)} → ${fmtD(i.finPlan)}"></div>
      <div class="g-bar ${tent ? 'tent' : ''} ${done ? 'done' : ''}" style="left:${bs}px;width:${bw}px;top:${top + 7}px;--c:${RAG_C[i.rag]}" data-act="sel" data-t="ini" data-id="${i.id}" title="${esc(i.titulo)} · ${pct(i.avance)} · fin proyectado ${fmtD(fc)}${desv(i) ? ' (+' + desv(i) + ' d)' : ''}"><b style="width:${fillW}px"></b><span>${bw > 70 ? pct(i.avance) : ''}</span></div>${hs}`;
    }).join('');
    // dependencias
    let paths = ''; if (f.deps) rows.forEach(i => i.deps.forEach(did => { const d = byId(did); if (!d || idxOf[did] == null) return; const yd = idxOf[did] * RH + RH / 2 - 2, yi = idxOf[i.id] * RH + 18, x1 = x(forecast(d) > d.finPlan ? forecast(d) : d.finPlan), x2 = x(i.inicioReal && !FASES_PIPE.includes(i.fase) ? i.inicioReal : i.inicioPlan), bad = x2 < x1 - 1; const mx = Math.max(x1 + 10, x2 - 10); paths += `<path d="M${x1},${yd} H${x1 + 8} V${yi} H${x2 - 1}" class="dep ${bad ? 'bad' : ''}" marker-end="url(#ar${bad ? 'r' : 'g'})"><title>${esc(d.titulo)} → ${esc(i.titulo)}${bad ? ' (conflicto: inicia antes de que termine la predecesora)' : ''}</title></path>`; }));
    const tx = x(hoy());
    const grp = rows.map((i, k) => (k === 0 || (f.group === 'area' ? i.area !== rows[k - 1].area : f.group === 'fase' ? i.fase !== rows[k - 1].fase : false)) && f.group ? `<div class="g-gl" style="top:${k * RH}px">${esc(f.group === 'area' ? i.area : i.fase)}</div>` : '').join('');
    return pageHead('Gantt', `${N} proyectos · barra = plan/real con avance · línea gris = línea base · ◆ hitos · flechas = dependencias${rows.some(i => FASES_PIPE.includes(i.fase)) ? ' · rayado = fechas tentativas de propuestas' : ''}`, btn('Ir a hoy', 'gtoday', { ic: 'target' })) + `
    <div class="toolbar">${planSeg()}<div class="seg">${Object.entries(GZ).map(([k, v]) => `<button class="${f.zoom === k ? 'on' : ''}" data-act="gzoom" data-z="${k}">${v.n}</button>`).join('')}</div>
      <div class="search"><span>${icon('search', 14)}</span><input data-key="g-q" data-chg="flt" data-v="gantt" data-f="q" type="search" placeholder="Buscar…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="gantt" data-f="fases">${selOpts([{ v: 'all', t: 'Todo el portafolio' }, { v: 'live', t: 'Solo vivas' }, { v: 'act', t: 'Solo en ejecución' }, { v: 'pipe', t: 'Solo pipeline' }], f.fases)}</select>
      <label class="tb-l">Agrupar<select data-chg="flt" data-v="gantt" data-f="group">${selOpts([{ v: 'area', t: 'Área' }, { v: 'fase', t: 'Fase' }, { v: '', t: 'Ninguno' }], f.group)}</select></label>
      <label class="chk tb-c"><input type="checkbox" ${f.deps ? 'checked' : ''} data-chg="flt" data-v="gantt" data-f="deps" data-bool="1"> <span>Dependencias</span></label></div>
    <div class="gantt" data-keep="gt" style="--LW:${LW}px"><div class="g-in" style="width:${LW + TW}px">
      <div class="g-hrow" style="height:${HH}px"><div class="g-lh"><span class="g-n">Iniciativa</span><span class="g-c">Inicio</span><span class="g-c">Fin</span><span class="g-c n">Duración</span><span class="g-c">Deps</span></div><div class="g-th" style="width:${TW}px">${yh}${mh}${wk.replace(/class="g-w"/g, 'class="g-w hd"')}</div></div>
      <div class="g-brow"><div class="g-left">${left}</div><div class="g-tl" style="width:${TW}px;height:${N * RH}px">${vl}${wk}${grp}<div class="g-today" style="left:${tx}px"><span>Hoy</span></div>
        <svg class="g-svg" width="${TW}" height="${N * RH}"><defs><marker id="arg" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#8A8886"/></marker><marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#D13438"/></marker></defs>${paths}</svg>${bars}</div></div></div></div>`;
  },
  after() { const g = $('.gantt'); if (g && g.scrollLeft === 0 && !g.dataset.nokeep) { const f = F('gantt', {}); const tgt = f.focus ? byId(f.focus) : null; const m = $('.g-today', g); const xx = tgt ? $('.g-bar[data-id="' + tgt.id + '"]', g) : null; const px = xx ? xx.offsetLeft : (m ? m.offsetLeft : 0); g.scrollLeft = Math.max(0, px - 260); if (tgt) { g.scrollTop = Math.max(0, $('.g-lr.foc', g) ? $('.g-lr.foc', g).offsetTop - 120 : 0); } } }
};
Acts.gzoom = d => { const g = $('.gantt'), f = F('gantt', {}); f.zoom = d.z; render(); const n = $('.gantt'); if (n) n.scrollLeft = 0, Views.gantt.after(); };
Acts.gtoday = () => { const g = $('.gantt'), m = $('.g-today'); if (g && m) g.scrollTo({ left: Math.max(0, m.offsetLeft - 300), behavior: 'smooth' }); };
Acts.ganttfocus = d => { const f = F('gantt', {}); f.focus = d.id; f.q = ''; f.fases = 'all'; go('gantt'); setTimeout(() => { const g = $('.gantt'); if (g) { g.scrollLeft = 0; Views.gantt.after(); } }, 30); };

/* ======================= RIESGOS ======================= */
function heatColor(e) { return e >= 20 ? '#B3262B' : e >= 15 ? '#D13438' : e >= 10 ? '#F08A4B' : e >= 5 ? '#F7C948' : '#8FCB8F'; }
Views.riesgos = {
  render() {
    const f = F('risk', { q: '', estado: '', cat: '', nivel: '', dueno: '', cell: '', ini: '', hideClosed: true });
    let all = RIESGOS().filter(r => (!byId(r.ini) || inArea(byId(r.ini))) && porTipo(byId(r.ini)) && respItem(r, 'dueno')); const open = all.filter(riesgoAbierto);
    let rows = all.slice();
    if (f.hideClosed) rows = rows.filter(riesgoAbierto);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(r => (r.desc + r.id + nameOf(r.ini) + r.dueno).toLowerCase().includes(q)); }
    if (f.ini) rows = rows.filter(r => r.ini === f.ini); if (f.estado) rows = rows.filter(r => r.estado === f.estado); if (f.cat) rows = rows.filter(r => r.cat === f.cat); if (f.dueno) rows = rows.filter(r => r.dueno === f.dueno);
    if (f.nivel) rows = rows.filter(r => nivelRiesgo(r).n === f.nivel);
    if (f.cell) { const [p, i] = f.cell.split(',').map(Number); rows = rows.filter(r => r.prob === p && r.imp === i); }
    rows.sort(by(r => -expo(r)));
    const cnt = (p, i) => open.filter(r => r.prob === p && r.imp === i);
    const lv = n => open.filter(r => nivelRiesgo(r).n === n).length;
    const heat = `<div class="heat" role="grid" aria-label="Matriz de riesgos 5 por 5"><div class="h-yl">Impacto</div><div class="h-body">${[5, 4, 3, 2, 1].map(im => `<div class="h-row"><span class="h-ax">${im}</span>${[1, 2, 3, 4, 5].map(p => { const c = cnt(p, im), e = p * im; return `<button class="h-c ${f.cell === p + ',' + im ? 'on' : ''}" style="background:${heatColor(e)}" data-act="hcell" data-c="${p},${im}" title="P${p} × I${im} = ${e} · ${c.length} riesgo(s)${c.length ? ': ' + esc(c.map(r => r.desc).join(' | ')) : ''}"><small>${e}</small>${c.length ? `<b>${c.length}</b>` : ''}</button>`; }).join('')}</div>`).join('')}<div class="h-row h-x"><span class="h-ax"></span>${[1, 2, 3, 4, 5].map(p => `<span class="h-ax">${p}</span>`).join('')}</div><div class="h-xl">Probabilidad</div></div></div>`;
    const byIni = Object.entries(open.reduce((m, r) => (m[r.ini] = (m[r.ini] || 0) + expo(r), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, v]) => ({ l: nameOf(id), v, c: v >= 20 ? '#D13438' : '#F08A4B' }));
    return pageHead('Riesgos', 'Registro independiente con matriz 5×5. Exposición = probabilidad × impacto.', `<span class="edit-only">${btn('Nuevo riesgo', 'new', { d: { t: 'risk' }, ic: 'plus', cls: 'pri' })}</span>${btn('Exportar CSV', 'riskcsv', { ic: 'down' })}`) + `
    <section class="kpis k5"><div class="kpi"><div class="k-top"><span class="k-ic">${icon('shield', 16)}</span><span class="k-l">Riesgos abiertos</span></div><div class="k-v">${open.length}</div><div class="k-s">${all.length - open.length} cerrados</div></div>
      <div class="kpi bad" data-act="rnivel" data-n="Crítico" role="button" tabindex="0"><div class="k-top"><span class="k-ic">${icon('warn', 16)}</span><span class="k-l">Críticos</span></div><div class="k-v">${lv('Crítico')}</div><div class="k-s">Exposición ≥ ${(0, ENLACES.cfgMi)('umbralCritico')}</div></div>
      <div class="kpi warn" data-act="rnivel" data-n="Alto" role="button" tabindex="0"><div class="k-top"><span class="k-ic">${icon('warn', 16)}</span><span class="k-l">Altos</span></div><div class="k-v">${lv('Alto')}</div><div class="k-s">Exposición 10–14</div></div>
      <div class="kpi" data-act="rnivel" data-n="Medio" role="button" tabindex="0"><div class="k-top"><span class="k-ic">${icon('shield', 16)}</span><span class="k-l">Medios / Bajos</span></div><div class="k-v">${lv('Medio') + lv('Bajo')}</div><div class="k-s">Exposición &lt; 10</div></div>
      <div class="kpi"><div class="k-top"><span class="k-ic">${icon('trend', 16)}</span><span class="k-l">Exposición total</span></div><div class="k-v">${sum(open, expo)}</div><div class="k-s">En mitigación: ${open.filter(r => r.estado === 'En mitigación').length}</div></div></section>
    <div class="grid12"><section class="card c6"><header><h2>Matriz de calor 5×5</h2><small>${f.cell ? '<a class="lnk" data-act="hcell" data-c="' + f.cell + '">Quitar filtro de celda</a>' : 'Clic en una celda para filtrar'}</small></header>${heat}</section>
      <section class="card c6"><header><h2>Exposición por proyecto</h2><small>Suma de exposición de riesgos abiertos</small></header>${hbars(byIni, 0, v => v)}<div style="margin-top:14px"><h3 class="sub">Por categoría</h3>${hbars(RISK_CATS.map(c => ({ l: c, v: open.filter(r => r.cat === c).length, c: '#2a78d6' })).filter(x => x.v), 0)}</div></section></div>
    <div class="toolbar" style="margin-top:14px">${planSeg()}<div class="search"><span>${icon('search', 14)}</span><input data-key="rk-q" data-chg="flt" data-v="risk" data-f="q" type="search" placeholder="Buscar riesgo…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="risk" data-f="ini" aria-label="Iniciativa">${selOpts(uniq(all.map(r => r.ini).filter(Boolean)).map(id => ({ v: id, t: nameOf(id) })).sort(by('t')), f.ini, 'Todas las iniciativas')}</select><select data-chg="flt" data-v="risk" data-f="estado">${selOpts(RISK_ESTADOS, f.estado, 'Todos los estados')}</select><select data-chg="flt" data-v="risk" data-f="cat">${selOpts(RISK_CATS, f.cat, 'Todas las categorías')}</select>
      <select data-chg="flt" data-v="risk" data-f="nivel">${selOpts(['Crítico', 'Alto', 'Medio', 'Bajo'], f.nivel, 'Todos los niveles')}</select><select data-chg="flt" data-v="risk" data-f="dueno">${selOpts(uniq(St.riesgos.map(r => r.dueno).filter(Boolean)).sort(), f.dueno, 'Todos los dueños')}</select>
      <label class="chk tb-c"><input type="checkbox" ${f.hideClosed ? 'checked' : ''} data-chg="flt" data-v="risk" data-f="hideClosed" data-bool="1"> <span>Ocultar cerrados</span></label></div>
    <div class="tbl-w"><table class="tbl"><thead><tr><th>ID</th><th>Proyecto</th><th style="min-width:220px">Descripción</th><th class="n" title="Impacto">Imp.</th><th class="n" title="Probabilidad">Prob.</th><th class="n" title="Exposición">Exp.</th><th style="min-width:200px">Mitigación</th><th>Dueño</th><th>Estado</th></tr></thead><tbody>
    ${rows.map(r => { const n = nivelRiesgo(r); return `<tr data-act="sel" data-t="risk" data-id="${r.id}" class="${UI.sel && UI.sel.id === r.id ? 'sel' : ''}"><td class="mono">${r.id}</td><td>${esc(nameOf(r.ini))}</td><td><b>${esc(r.desc)}</b><small>${esc(r.cat)}</small></td><td class="n">${r.imp}</td><td class="n">${r.prob}</td><td class="n"><span class="expo" style="background:${n.c}" title="${n.n}">${expo(r)}</span></td><td class="mit">${esc(r.mit || '—')}</td><td>${esc(r.dueno || '—')}</td><td><span class="pill soft">${r.estado}</span></td></tr>`; }).join('') || `<tr><td colspan="9">${empty('Sin riesgos con estos filtros', 'shield')}</td></tr>`}</tbody></table></div>`;
  }
};
Acts.hcell = d => { const f = F('risk', {}); f.cell = f.cell === d.c ? '' : d.c; render(); };
Acts.rnivel = d => { const f = F('risk', {}); f.nivel = f.nivel === d.n ? '' : d.n; render(); };
Acts.riskcsv = () => { download('APIH_riesgos_' + hoy() + '.csv', toCSV(RIESGOS().filter(r => { const i = byId(r.ini); return !i || (0, ENLACES.areaVisible)(i.area); }), [{ h: 'ID', f: r => r.id }, { h: 'Proyecto', f: r => nameOf(r.ini) }, { h: 'Descripción', f: r => r.desc }, { h: 'Categoría', f: r => r.cat }, { h: 'Impacto', f: r => r.imp }, { h: 'Probabilidad', f: r => r.prob }, { h: 'Exposición', f: expo }, { h: 'Mitigación', f: r => r.mit }, { h: 'Dueño', f: r => r.dueno }, { h: 'Estado', f: r => r.estado }]), 'text/csv'); toast('Riesgos exportados'); };

/* ======================= HITOS ======================= */
Views.hitos = {
  render() {
    const f = F('hitos', { q: '', est: '', ini: '', resp: '', cat: '' });
    let all = St.hitos.filter(h => byId(h.ini) && !esSB(byId(h.ini)) && inArea(byId(h.ini)) && porTipo(byId(h.ini)) && respItem(h, 'resp') && byId(h.ini).estado !== 'Cancelado'); let rows = all.slice();
    if (f.cat) rows = rows.filter(h => (h.cat || '') === (f.cat === '—' ? '' : f.cat));
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(h => (h.nombre + nameOf(h.ini)).toLowerCase().includes(q)); }
    if (f.ini) rows = rows.filter(h => h.ini === f.ini); if (f.resp) rows = rows.filter(h => h.resp === f.resp);
    if (f.est) rows = rows.filter(h => { const k = hitoEstado(h).k; return f.est === 'done' ? (k === 'done' || k === 'late') : k === f.est; });
    rows.sort(by(h => (h.completado ? '9' : '0') + h.fecha));
    const c = k => all.filter(h => hitoEstado(h).k === k).length;
    const chip = (k, l, n, cls) => `<button class="kpi sm ${cls} ${f.est === k ? 'on' : ''}" data-act="hest" data-k="${k}"><div class="k-v">${n}</div><div class="k-l">${l}</div></button>`;
    // mini timeline próximas 10 semanas
    const wk = Array.from({ length: 10 }, (_, k) => { const s = addD(hoy(), k * 7), e = addD(s, 6); return { l: fmtD(s), v: all.filter(h => !h.completado && h.fecha >= s && h.fecha <= e).length }; });
    const mxw = Math.max(1, ...wk.map(w => w.v));
    return pageHead('Hitos', 'Semaforización automática según fecha plan y avance. Verde = completado a tiempo · Azul = en plazo · Ámbar = vence en ≤ 7 días o completado con retraso · Rojo = vencido.', `<span class="edit-only">${btn('Nuevo hito', 'new', { d: { t: 'hito' }, ic: 'plus', cls: 'pri' })}</span>${btn('Exportar CSV', 'hitocsv', { ic: 'down' })}`) + `
    <div class="chips-row">${chip('over', 'Vencidos', c('over'), 'bad')}${chip('soon', 'Vencen en ≤ 7 d', c('soon'), 'warn')}${chip('ok', 'En plazo', c('ok'), '')}${chip('done', 'Completados', c('done') + c('late'), 'good')}
      <div class="card wk"><header><h2>Hitos pendientes por semana</h2></header><div class="wkb">${wk.map(w => `<div title="${w.v} hitos · semana del ${w.l}"><b style="height:${w.v / mxw * 56}px"></b><small>${w.l.split(' ')[0]}</small></div>`).join('')}</div></div></div>
    <div class="toolbar">${planSeg()}<div class="search"><span>${icon('search', 14)}</span><input data-key="h-q" data-chg="flt" data-v="hitos" data-f="q" type="search" placeholder="Buscar hito…" value="${esc(f.q)}"></div>
      <select data-chg="flt" data-v="hitos" data-f="ini" aria-label="Iniciativa">${selOpts(uniq(all.map(h => h.ini)).map(id => ({ v: id, t: nameOf(id) })).sort(by('t')), f.ini, 'Todas las iniciativas')}</select><select data-chg="flt" data-v="hitos" data-f="cat" aria-label="Categoría">${selOpts([...hitoCats(), '—'].map(c => ({ v: c, t: c === '—' ? 'Sin categoría' : c })), f.cat, 'Todas las categorías')}</select>
      
      ${f.est || f.ini || f.resp || f.q ? btn('Limpiar', 'hclear', { ic: 'x' }) : ''}</div>
    <div class="tbl-w"><table class="tbl"><thead><tr><th style="width:40px"></th><th>Iniciativa</th><th style="min-width:240px">Hito</th><th>Fecha plan</th><th>Fecha real</th><th>Responsable</th><th>Estado</th></tr></thead><tbody>
    ${rows.map(h => { const e = hitoEstado(h); return `<tr data-act="sel" data-t="hito" data-id="${h.id}" class="${UI.sel && UI.sel.id === h.id ? 'sel' : ''}"><td><input type="checkbox" ${h.completado ? 'checked' : ''} data-chg="hitotoggle" data-id="${h.id}" aria-label="Completado" data-nostop="1"></td><td>${iniLink(h.ini)}</td><td><b class="${h.completado ? 'strike' : ''}">${esc(h.nombre)}</b><small>${esc([h.cat, h.fase].filter(Boolean).join(' · ') || '—')}</small></td><td>${fmtD(h.fecha)}<small>${rel(h.fecha)}</small></td><td>${fmtD(h.fechaReal)}</td><td>${esc(h.resp || '—')}</td><td><span class="pill" style="--c:${e.c}">${e.t}</span></td></tr>`; }).join('') || `<tr><td colspan="7">${empty('Sin hitos', 'flag')}</td></tr>`}</tbody></table></div>`;
  }
};
Acts.hest = d => { const f = F('hitos', {}); f.est = f.est === d.k ? '' : d.k; render(); };
Acts.hclear = () => { Object.assign(F('hitos', {}), { q: '', est: '', ini: '', resp: '' }); render(); };
Acts.hitocsv = () => { download('APIH_hitos_' + hoy() + '.csv', toCSV(HITOS().filter(h => { const i = byId(h.ini); return !i || (0, ENLACES.areaVisible)(i.area); }), [{ h: 'ID', f: h => h.id }, { h: 'Proyecto', f: h => nameOf(h.ini) }, { h: 'Hito', f: h => h.nombre }, { h: 'Fecha plan', f: h => h.fecha }, { h: 'Fecha real', f: h => h.fechaReal }, { h: 'Responsable', f: h => h.resp }, { h: 'Estado', f: h => hitoEstado(h).t }]), 'text/csv'); toast('Hitos exportados'); };

/* ======================= CALENDARIO ======================= */
const EV_C = { 'Hito': '#0D446A', 'Comité': '#8764B8', 'Entrega': '#107C10', 'Vencimiento': '#CA5010', 'Ciclo': '#038387', 'Otro': '#605E5C' };
function calEvents() {
  const ev = [];
  HITOS().forEach(h => { const i = byId(h.ini); if (i && inArea(i) && respItem(h, 'resp')) ev.push({ f: h.fecha, t: 'Hito', l: h.nombre, s: i.titulo, ref: ['hito', h.id], c: hitoEstado(h).c, done: h.completado, ini: h.ini, resp: h.resp }); });
  St.comites.forEach(c => ev.push({ f: c.fecha, t: 'Comité', l: c.nombre, s: c.hora + ' · ' + c.lugar, ref: ['com', c.id], done: c.estado === 'Realizado' }));
  St.ini.forEach(i => { if (inArea(i) && isLive(i) && [...FASES_ACT, 'Cierre'].includes(i.fase) && forecast(i)) ev.push({ f: forecast(i), t: 'Entrega', l: 'Entrega: ' + i.titulo, s: i.fase, ref: ['ini', i.id], c: RAG_C[i.rag], ini: i.id, resp: i.lider }); });
  DECS().forEach(d => { if (d.estado === 'Pendiente' && d.limite) ev.push({ f: d.limite, t: 'Vencimiento', l: 'Decisión: ' + d.titulo, s: d.tipo, ref: ['dec', d.id], ini: d.ini, resp: d.solicita }); });
  RIESGOS().forEach(r => { if (riesgoAbierto(r) && r.fRev) ev.push({ f: r.fRev, t: 'Vencimiento', l: 'Revisión riesgo: ' + r.desc, s: nameOf(r.ini), ref: ['risk', r.id], ini: r.ini, resp: r.dueno }); });
  St.comites.forEach(c => [...c.acciones, ...c.compromisos].forEach(a => { if (['Abierta', 'Abierto'].includes(a.estado) && a.limite) ev.push({ f: a.limite, t: 'Vencimiento', l: (c.compromisos.includes(a) ? 'Compromiso: ' : 'Acción: ') + a.texto, s: a.resp, ref: a.ini ? ['ini', a.ini] : ['com', c.id], ini: a.ini, resp: a.resp }); }));
  St.pres.forEach(p => { if (p.fecha) ev.push({ f: p.fecha, t: 'Ciclo', l: p.nombre.length > 46 ? p.nombre.slice(0, 44) + '…' : p.nombre, s: p.area, ref: ['go', 'presentaciones'], areaX: p.area }); });
  St.eventos.forEach(e => ev.push({ f: e.fecha, t: e.tipo, l: e.titulo, s: e.nota || '', ref: ['evt', e.id], ini: e.ini, resp: e.resp }));
  return ev;
}
/* V22.45: celdas del mes (compartidas por la vista y por la ventana «Mes completo») */
function calCells(f, map, start, nmax, noSel) {
  let cells = '';
  for (let k = 0; k < 42; k++) {
    const d = new Date(start); d.setDate(start.getDate() + k); const s = toISO(d), es = map[s] || [], other = d.getMonth() !== f.m;
    if (k === 35 && other) break;
    cells += `<div class="cd ${other ? 'oth' : ''} ${s === hoy() ? 'today' : ''} ${!noSel && f.day === s ? 'sel' : ''}" data-act="${noSel ? 'cmday' : 'cday'}" data-d="${s}"><span class="cn">${d.getDate()}</span>${es.slice(0, nmax).map(e => `<i class="ce" style="--c:${e.c || EV_C[e.t]}" title="${esc(e.t + ': ' + e.l)}"><em>${esc(e.l)}</em></i>`).join('')}${es.length > nmax ? `<small class="more">+${es.length - nmax} más</small>` : ''}</div>`;
  }
  return cells;
}
function calMesData() {
  const f = F('cal', {}), first = new Date(f.y, f.m, 1, 12), off = (first.getDay() + 6) % 7, start = new Date(f.y, f.m, 1 - off, 12);
  const ev = calEvents().filter(e => f.types[e.t]).filter(e => calMatch(e, f)), map = {}; ev.forEach(e => (map[e.f] = map[e.f] || []).push(e));
  return { f, start, map, n: ev.filter(e => e.f >= toISO(first) && e.f <= toISO(new Date(f.y, f.m + 1, 0, 12))).length };
}
function calModalBody() {
  const { f, start, map, n } = calMesData();
  return `<div class="cal-mh"><div class="seg"><button data-act="cmnav" data-d="-1" aria-label="Mes anterior">${icon('chevl', 14)}</button><span class="seg-l" style="min-width:150px">${MESES[f.m]} ${f.y}</span><button data-act="cmnav" data-d="1" aria-label="Mes siguiente">${icon('chev', 14)}</button></div><button class="btn" data-act="cmtoday">Hoy</button><small>${n} eventos en el mes · clic en un día para ver su detalle</small></div>
    <div class="cal cal-big"><div class="cal-h">${DIAS.map(d => `<div>${d}</div>`).join('')}</div><div class="cal-g">${calCells(f, map, start, 4, true)}</div></div>`;
}
function calModal() {
  const f = F('cal', {}); Modal.open({ title: 'Calendario · mes completo', wide: true, body: `<div id="cal-mbody">${calModalBody()}</div>`, footer: '<button class="btn" data-act="mclose">Cerrar</button>' });
  const m = $('#modal .modal'); if (m) m.classList.add('cal-m');
}
const calModalRefresh = () => { const b = $('#cal-mbody'); if (b) b.innerHTML = calModalBody(); };
Acts.calmodal = () => calModal();
Acts.cmnav = d => { const f = F('cal', {}); let m = f.m + +d.d, y = f.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } f.m = m; f.y = y; f.day = ''; calModalRefresh(); };
Acts.cmtoday = () => { const t = pD(hoy()), f = F('cal', {}); f.y = t.getFullYear(); f.m = t.getMonth(); calModalRefresh(); };
Acts.cmday = d => { Modal.close(); Acts.cday(d); };
Views.calendario = {
  render() {
    const t0 = pD(hoy()); const f = F('cal', { y: t0.getFullYear(), m: t0.getMonth(), types: { 'Hito': 1, 'Comité': 1, 'Entrega': 1, 'Vencimiento': 1, 'Ciclo': 1, 'Otro': 1 }, day: '', area: '', ini: '', resp: '' });
    const first = new Date(f.y, f.m, 1, 12), off = (first.getDay() + 6) % 7, start = new Date(f.y, f.m, 1 - off, 12);
    const evAll = calEvents().filter(e => f.types[e.t]), opt = calOpts(evAll), ev = evAll.filter(e => calMatch(e, f)), nflt = ['ini'].filter(k => f[k]).length + (St.cfg.areaGlobal !== 'Todas' ? 1 : 0) + (respSel() ? 1 : 0); const map = {}; ev.forEach(e => (map[e.f] = map[e.f] || []).push(e));
    const cells = calCells(f, map, start, 2);
    const dayEv = f.day ? (map[f.day] || []) : ev.filter(e => e.f >= toISO(first) && e.f <= toISO(new Date(f.y, f.m + 1, 0, 12))).sort(by('f'));
    const tipos = Object.keys(EV_C), ntip = tipos.filter(t => f.types[t]).length;
    return pageHead('Calendario', 'Hitos, comités, entregas, vencimientos y ciclos de presentación.', `<div class="seg"><button data-act="cnav" data-d="-1" aria-label="Mes anterior">${icon('chevl', 14)}</button><span class="seg-l" style="min-width:128px">${MESES[f.m]} ${f.y}</span><button data-act="cnav" data-d="1" aria-label="Mes siguiente">${icon('chev', 14)}</button></div>${btn('Hoy', 'ctoday', { cls: 'v22-main' })}<button class="btn v22-main" data-act="calmodal" title="Ver el mes completo en una ventana">${icon('expand', 15)}<span>Mes completo</span></button><span class="edit-only">${btn('Nuevo evento', 'newevt', { ic: 'plus', cls: 'pri' })}</span>`) + `
    <div class="toolbar cal-flt" role="group" aria-label="Filtros del calendario"><span class="popw"><button class="btn" data-act="pop" data-id="pop-ctipos" aria-haspopup="menu">${icon('filter', 14)}<span>Tipos${ntip < tipos.length ? ' (' + ntip + '/' + tipos.length + ')' : ''}</span></button><div class="pop cal-tipos" id="pop-ctipos" style="left:0">${tipos.map(t => `<label class="chk ctype" style="--c:${EV_C[t]}"><input type="checkbox" ${f.types[t] ? 'checked' : ''} data-chg="ctype" data-t="${t}"><span><i></i>${t}</span></label>`).join('')}</div></span>
      <select data-chg="cflt" data-f="ini" aria-label="Proyecto">${selOpts(opt.inis, f.ini, 'Todos los proyectos y propuestas')}</select>
      ${f.ini ? btn('Quitar proyecto', 'cclear', { ic: 'x', cls: 'sm' }) : ''}<small style="display:inline;margin-left:auto" ${nflt ? 'title="Los eventos sin proyecto (comités, ciclos) se ocultan al filtrar"' : ''}>${nflt ? `${ev.length} de ${evAll.length} eventos` : `${ev.length} eventos`}</small></div>
    <div class="cal-w"><div class="cal fit"><div class="cal-h">${DIAS.map(d => `<div>${d}</div>`).join('')}</div><div class="cal-g">${cells}</div></div>
    <aside class="card cal-side"><header><h2>${f.day ? fmtDL(f.day) : 'Eventos del mes'}</h2>${f.day ? `<button class="lnk" data-act="cday" data-d="${f.day}">Ver mes</button>` : `<small>${dayEv.length}</small>`}</header>
      ${dayEv.map(e => `<button class="row" data-act="cev" data-r="${e.ref[0]}" data-id="${esc(e.ref[1])}"><span class="cdot" style="background:${e.c || EV_C[e.t]}"></span><span class="r-m"><b class="${e.done ? 'strike' : ''}">${esc(e.l)}</b><small>${f.day ? '' : fmtD(e.f) + ' · '}${e.t}${e.s ? ' · ' + esc(e.s) : ''}</small></span></button>`).join('') || empty('Sin eventos', 'cal')}</aside></div>`;
  }
};
Acts.cnav = d => { const f = F('cal', {}); let m = f.m + +d.d, y = f.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } f.m = m; f.y = y; f.day = ''; render(); };
Acts.ctoday = () => { const t = pD(hoy()), f = F('cal', {}); f.y = t.getFullYear(); f.m = t.getMonth(); f.day = hoy(); render(); };
Acts.cday = d => { const f = F('cal', {}); f.day = f.day === d.d ? '' : d.d; const dd = pD(d.d); if (dd.getMonth() !== f.m) { f.m = dd.getMonth(); f.y = dd.getFullYear(); } render(); };
Acts.cev = d => { if (d.r === 'com') { F('comite', {}).sel = d.id; go('comite'); } else if (d.r === 'go') go(d.id); else if (d.r === 'evt') { const e = St.eventos.find(x => x.id === d.id); evtForm(e); } else selectEntity(d.r, d.id); };
function calOpts(ev) {
  const ar = new Set(), ini = new Map(), rs = new Set();
  ev.forEach(e => { calAreas(e).forEach(a => ar.add(a)); if (e.ini && byId(e.ini)) ini.set(e.ini, nameOf(e.ini)); if (e.resp) rs.add(e.resp); });
  return { areas: [...ar].sort(), inis: [...ini].map(([v, t]) => ({ v, t: v + ' · ' + t })).sort(by('t')), resps: [...rs].sort() };
}
const calAreas = e => { const i = e.ini && byId(e.ini); return ((i && i.area) || e.areaX || '').split(',').map(x => x.trim()).filter(Boolean); };
const calMatch = (e, f) => { const A = St.cfg.areaGlobal, R = respSel(); return (A === 'Todas' || calAreas(e).includes(A)) && (!f.ini || e.ini === f.ini) && (!R || (e.resp ? e.resp === R : !!(e.ini && personProjects(R).has(e.ini)))); };
Chg.cflt = el => { const f = F('cal', {}); f[el.dataset.f] = el.value; f.day = ''; render(); };
Acts.cclear = () => { F('cal', {}).ini = ''; render(); };
Chg.ctype = el => { F('cal', {}).types[el.dataset.t] = el.checked ? 1 : 0; render(); setTimeout(() => { const e = $('#pop-ctipos'); if (e) { e.classList.add('open'); UI.pop = 'pop-ctipos'; syncPop(); } }, 0); };
function evtForm(e) {
  const nw = !e; openForm({ title: nw ? 'Nuevo evento' : 'Editar evento', values: e || { fecha: F('cal', {}).day || hoy(), tipo: 'Otro' }, saveLabel: nw ? 'Crear' : 'Guardar', danger: nw ? null : 'Eliminar', onDanger: () => { St.eventos = St.eventos.filter(x => x.id !== e.id); toast('Evento eliminado'); refresh(); },
    fields: [{ k: 'titulo', l: 'Título', req: true, w: 3 }, { k: 'fecha', l: 'Fecha', t: 'date', req: true }, { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Otro', 'Entrega', 'Vencimiento', 'Comité', 'Hito'] }, { k: 'ini', l: 'Proyecto / propuesta (opcional)', t: 'select', opts: [{ v: '', t: '— ninguno —' }, ...St.ini.map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo }))] }, { k: 'resp', l: 'Responsable (opcional)' }, { k: 'nota', l: 'Nota', w: 3 }],
    onSave(o) { if (nw) { St.eventos.push({ id: uid('EVT'), ...o }); toast('Evento creado'); } else { Object.assign(e, o); toast('Evento guardado'); } refresh(); } });
}
Acts.newevt = () => evtForm(null);

/* ============================================================
   APIH · Vistas 3: Comité, Decisiones, Bitácora, Administración
   ============================================================ */

/* ======================= COMITÉ ======================= */
const comSel = () => { const f = F('comite', { sel: '' }); let c = St.comites.find(x => x.id === f.sel); if (!c) { c = St.comites.filter(x => x.estado === 'Programado').sort(by('fecha'))[0] || St.comites.slice().sort(by('fecha', -1))[0]; f.sel = c ? c.id : ''; } return c; };
Views.comite = {
  render() {
    const c = comSel(); const list = St.comites.slice().sort(by('fecha', -1));
    const side = list.map(x => `<button class="com-i ${c && x.id === c.id ? 'on' : ''}" data-act="csel" data-id="${x.id}"><span class="dt"><b>${pD(x.fecha).getDate()}</b>${MES3[pD(x.fecha).getMonth()]}</span><span class="r-m"><b>${esc(x.nombre)}</b><small>${x.id} · ${x.estado}${x.estado === 'Programado' ? ' · ' + rel(x.fecha) : ''}</small></span><span class="sdot ${x.estado}"></span></button>`).join('');
    if (!c) return pageHead('Comité', 'Gobierno del portafolio') + empty('Aún no hay comités', 'users');
    const dec = c.decisiones.map(id => St.decisiones.find(d => d.id === id)).filter(Boolean);
    const att = c.participantes.filter(p => p.asistio).length;
    const open = [...c.acciones, ...c.compromisos].filter(a => ['Abierta', 'Abierto'].includes(a.estado)).length;
    const itemRow = (a, kind) => { const done = ['Cerrada', 'Cumplido'].includes(a.estado), over = !done && a.limite && a.limite < hoy(); return `<div class="trow ${done ? 'done' : ''}"><input type="checkbox" ${done ? 'checked' : ''} data-chg="ctoggle" data-c="${c.id}" data-k="${kind}" data-id="${a.id}" aria-label="Completar"><div class="r-m"><b class="${done ? 'strike' : ''}">${esc(a.texto)}</b><small>${esc(a.resp || 'Sin responsable')} · <span class="${over ? 'neg' : ''}">${fmtD(a.limite)}</span>${a.ini ? ' · ' + esc(nameOf(a.ini)) : ''}${a.cierre ? ' · ' + esc(a.cierre) : ''}</small></div><button class="icon-btn sm edit-only" data-act="cdel" data-c="${c.id}" data-k="${kind}" data-id="${a.id}" aria-label="Eliminar">${icon('trash', 13)}</button></div>`; };
    return pageHead('Comité de portafolio', 'Agenda, participantes, decisiones, acciones y compromisos de cada sesión.', `<span class="edit-only">${btn('Nuevo comité', 'new', { d: { t: 'com' }, ic: 'plus', cls: 'pri' })}</span>`) + `
    <div class="com-w"><aside class="com-l card"><header><h2>Sesiones</h2><small>${list.length}</small></header>${side}</aside>
    <section class="com-d"><div class="card com-h"><div><span class="pill soft e-${c.estado}">${c.estado}</span><h2>${esc(c.nombre)}</h2><p>${fmtDL(c.fecha)} · ${esc(c.hora)} · ${esc(c.lugar)}</p></div>
      <div class="com-a"><span class="edit-only">${btn('Editar', 'edit', { d: { t: 'com', id: c.id }, ic: 'edit' })}${c.estado === 'Programado' ? btn('Cerrar comité', 'cclose', { d: { id: c.id }, ic: 'check', cls: 'pri' }) : ''}</span>${btn('Acta', 'cacta', { d: { id: c.id }, ic: 'copy' })}</div></div>
      <div class="kpis k4"><div class="kpi sm"><div class="k-v">${c.temas.length}</div><div class="k-l">Temas</div></div><div class="kpi sm"><div class="k-v">${dec.length}</div><div class="k-l">Decisiones</div></div><div class="kpi sm"><div class="k-v">${open}</div><div class="k-l">Acciones/compromisos abiertos</div></div><div class="kpi sm"><div class="k-v">${c.estado === 'Realizado' ? att + '/' + c.participantes.length : c.participantes.length}</div><div class="k-l">${c.estado === 'Realizado' ? 'Asistencia' : 'Convocados'}</div></div></div>
      ${c.resumen ? `<div class="card"><header><h2>Mensaje principal del ciclo</h2></header><p class="desc">${esc(c.resumen)}</p>${c.narrativa ? `<p class="desc mut" style="margin-top:6px">${esc(c.narrativa)}</p>` : ''}</div>` : ''}
      <div class="grid12">
      <section class="card c12"><header><h2>Participantes</h2><span class="edit-only"><button class="lnk" data-act="cpart" data-id="${c.id}">+ Agregar</button></span></header>${c.participantes.map((p, k) => `<label class="prt"><input type="checkbox" ${p.asistio ? 'checked' : ''} data-chg="catt" data-c="${c.id}" data-k="${k}" aria-label="Asistió">${avatar(p.n, 24)}<span class="r-m"><b>${esc(p.n)}</b><small>${esc(p.rol)}</small></span></label>`).join('')}</section>
      ${temasSec(c, 'Propuestas a decidir', t => t.ini && esProp(byId(t.ini) || {}), 'prop')}
      ${temasSec(c, 'Proyectos en seguimiento', t => t.ini && byId(t.ini) && !esProp(byId(t.ini)), 'prj')}
      ${(() => { const o = c.temas.map((t, k) => [t, k]).filter(([t]) => !t.ini || !byId(t.ini)); return o.length ? `<section class="card c12"><header><h2>Otros temas</h2></header>${o.map(([t, k]) => temaRow(c, t, k)).join('')}</section>` : ''; })()}
      ${c.estado === 'Programado' ? sugeridos(c) : ''}
      <section class="card c12"><header><h2>Decisiones</h2><span class="edit-only"><button class="lnk" data-act="cdec" data-id="${c.id}">+ Registrar decisión</button></span></header>${dec.map(d => `<button class="row" data-act="sel" data-t="dec" data-id="${d.id}"><span class="dtype" style="background:${DEC_C[d.tipo]}">${icon(DEC_ICON[d.tipo], 14)}</span><span class="r-m"><b>${esc(d.titulo)}</b><small>${d.tipo} · ${d.ini ? esc(nameOf(d.ini)) : '—'}${d.resolucion ? ' · ' + esc(d.resolucion) : ''}</small></span><span class="pill soft">${d.estado}</span></button>`).join('') || '<p class="mut">Sin decisiones asociadas a esta sesión.</p>'}</section>
      <section class="card c6"><header><h2>Acciones</h2><span class="edit-only"><button class="lnk" data-act="cacc" data-id="${c.id}" data-k="acciones">+ Agregar</button></span></header>${c.acciones.map(a => itemRow(a, 'acciones')).join('') || '<p class="mut">Sin acciones.</p>'}</section>
      <section class="card c6"><header><h2>Compromisos</h2><span class="edit-only"><button class="lnk" data-act="cacc" data-id="${c.id}" data-k="compromisos">+ Agregar</button></span></header>${c.compromisos.map(a => itemRow(a, 'compromisos')).join('') || '<p class="mut">Sin compromisos.</p>'}</section>
      </div></section></div>`;
  }
};

const temaRow = (c, t, k) => `<div class="trow"><span class="rk">${k + 1}</span><div class="r-m"><b>${esc(t.t)}</b><small>${t.ini ? iniLink(t.ini) : ''}${t.notas ? ' · ' + esc(t.notas) : ''}</small></div><button class="icon-btn sm edit-only" data-act="cdel" data-c="${c.id}" data-k="tema" data-id="${k}" aria-label="Quitar">${icon('x', 13)}</button></div>`;
function temasSec(c, titulo, fn, kind) {
  const r = c.temas.map((t, k) => [t, k]).filter(([t]) => fn(t));
  return `<section class="card c6"><header><h2>${titulo}</h2><span class="edit-only"><button class="lnk" data-act="carmar" data-id="${c.id}" data-kind="${kind}" title="Agrega como temas las decisiones pendientes y las propuestas o proyectos en evaluación">Armar agenda</button> · <button class="lnk" data-act="ctema" data-id="${c.id}" data-kind="${kind}">+ Agregar tema</button></span></header>${r.map(([t, k]) => temaRow(c, t, k)).join('') || '<p class="mut">Sin temas.</p>'}</section>`;
}
function sugeridos(c) {
  const usados = new Set(c.temas.map(t => t.ini));
  const P = scopeP().filter(i => isLive(i) && i.fase === 'Aprobación' && !usados.has(i.id));
  const J = scope().filter(i => isLive(i) && (i.rag === 'Rojo' || (i.fin && i.fin < hoy())) && !usados.has(i.id));
  if (!P.length && !J.length) return '';
  const row = i => `<div class="trow"><div class="r-m"><b>${iniLink(i.id)}</b><small>${esc(i.titulo)}</small></div><span class="edit-only"><button class="lnk" data-act="csug" data-id="${c.id}" data-ini="${i.id}">+ Agenda</button></span></div>`;
  return `<section class="card c6"><header><h2>Sugeridas · propuestas en Aprobación</h2></header>${P.map(row).join('') || '<p class="mut">Ninguna.</p>'}</section><section class="card c6"><header><h2>Sugeridos · proyectos en rojo / atrasados</h2></header>${J.map(row).join('') || '<p class="mut">Ninguno.</p>'}</section>`;
}
Acts.csug = d => { (0, ENLACES.cmdServidor)('apih_comite_sugerido', { p_id: d.id, p_ini: d.ini }); };
Acts.csel = d => { F('comite', {}).sel = d.id; render(); };
Chg.catt = el => { (0, ENLACES.cmdServidor)('apih_comite_marcar', { p_id: el.dataset.c, p_col: 'participantes', p_ref: String(el.dataset.k), p_valor: el.checked }); };
Chg.ctoggle = el => { (0, ENLACES.cmdServidor)('apih_comite_marcar', { p_id: el.dataset.c, p_col: el.dataset.k, p_ref: el.dataset.id, p_valor: el.checked }); };
Acts.cdel = d => { (0, ENLACES.cmdServidor)('apih_comite_quitar', { p_id: d.c, p_col: d.k === 'tema' ? 'temas' : d.k, p_ref: String(d.id) }); };
Acts.cpart = d => { openForm({ title: 'Agregar participante', fields: [{ k: 'n', l: 'Nombre', req: true, list: people() }, { k: 'rol', l: 'Rol' }], values: { rol: 'Participante' }, onSave(o) { return (0, ENLACES.cmdServidor)('apih_comite_agregar', { p_id: d.id, p_col: 'participantes', p_item: o }, null, true).then(r => r !== null); } }); };
Acts.carmar = d => {   /* U-19: el servidor arma la agenda con lo pendiente */
  (0, ENLACES.cmdServidor)('apih_comite_armar', { p_id: d.id, p_tipo: d.kind === 'prop' ? 'prop' : 'prj' }).then(r => { if (r) toast(r.agregados ? r.agregados + ' tema(s) agregados a la agenda' : 'No hay pendientes nuevos para agregar'); });
};
Acts.ctema = d => { openForm({ title: 'Agregar tema de agenda', fields: [{ k: 't', l: 'Tema', req: true, w: 3 }, { k: 'ini', l: 'Proyecto / propuesta relacionada', t: 'select', opts: iniOpts(d.kind === 'prop' ? 'Propuesta' : d.kind === 'prj' ? 'Proyecto' : undefined), blank: '—', w: 3 }, { k: 'notas', l: 'Notas', t: 'textarea', w: 3 }], values: {}, onSave(o) { return (0, ENLACES.cmdServidor)('apih_comite_agregar', { p_id: d.id, p_col: 'temas', p_item: o }, null, true).then(r => r !== null); } }); };
Acts.cacc = d => { const c = St.comites.find(x => x.id === d.id), k = d.k; openForm({ title: k === 'acciones' ? 'Nueva acción' : 'Nuevo compromiso', fields: [{ k: 'texto', l: 'Descripción', req: true, t: 'textarea', w: 3 }, { k: 'resp', l: 'Responsable', list: people() }, { k: 'limite', l: 'Fecha límite', t: 'date' }, { k: 'ini', l: 'Iniciativa', t: 'select', opts: iniOpts(), blank: '—', w: 3 }], values: { limite: addD(c.fecha, 7), resp: St.cfg.usuario }, onSave(o) { return (0, ENLACES.cmdServidor)('apih_comite_agregar', { p_id: c.id, p_col: k, p_item: o }, null, true).then(r => r !== null); } }); };
Acts.cdec = d => { const c = St.comites.find(x => x.id === d.id); decForm(null); setTimeout(() => { const s = $('#f_comite'); if (s) s.value = c.id; }, 20); };
Acts.cclose = d => { const c = St.comites.find(x => x.id === d.id); confirmBox(`¿Cerrar la sesión del <b>${fmtDL(c.fecha)}</b>? Quedará como <b>Realizada</b> y se registrará en la bitácora.`, () => (0, ENLACES.cmdServidor)('apih_comite_cerrar', { p_id: c.id }, 'Sesión cerrada'), 'Cerrar sesión'); };
function actaTexto(c) {
  const dec = c.decisiones.map(id => St.decisiones.find(d => d.id === id)).filter(Boolean);
  return [`ACTA · ${c.nombre}`, `${fmtDL(c.fecha)} · ${c.hora} · ${c.lugar} · ${c.estado}`, '', 'PARTICIPANTES', ...c.participantes.map(p => `- ${p.n} (${p.rol})${c.estado === 'Realizado' ? (p.asistio ? ' ✔' : ' ✘') : ''}`), '', 'TEMAS', ...c.temas.map((t, k) => `${k + 1}. ${t.t}${t.ini ? ' [' + nameOf(t.ini) + ']' : ''}${t.notas ? ' — ' + t.notas : ''}`), '', 'DECISIONES', ...dec.map(d => `- [${d.tipo}] ${d.titulo} → ${d.estado}${d.resolucion ? ': ' + d.resolucion : ''}`), '', 'ACCIONES', ...c.acciones.map(a => `- ${a.texto} · ${a.resp} · ${fmtD(a.limite)} · ${a.estado}`), '', 'COMPROMISOS', ...c.compromisos.map(a => `- ${a.texto} · ${a.resp} · ${fmtD(a.limite)} · ${a.estado}`)].join('\n');
}
Acts.cacta = d => { const c = St.comites.find(x => x.id === d.id); Modal.open({ title: 'Acta · ' + fmtD(c.fecha), wide: true, body: `<pre class="acta">${esc(actaTexto(c))}</pre>`, footer: `<button class="btn" data-act="mclose">Cerrar</button><button class="btn" data-act="actadl" data-id="${c.id}">${icon('down', 14)} Descargar .txt</button><button class="btn pri" data-act="actacp" data-id="${c.id}">${icon('copy', 14)} Copiar</button>` }); };
Acts.actacp = d => copyText(actaTexto(St.comites.find(x => x.id === d.id)));
Acts.actadl = d => { const c = St.comites.find(x => x.id === d.id); download('Acta_' + c.fecha + '.txt', actaTexto(c)); };

/* ======================= DECISIONES ======================= */
Views.decisiones = {
  render() {
    const f = F('dec', { tipo: '', estado: 'Pendiente', q: '' });
    let rows = DECS().filter(d => (!d.ini || (byId(d.ini) && inArea(byId(d.ini))) || !byId(d.ini)) && respItem(d, 'solicita'));
    if (f.tipo) rows = rows.filter(d => d.tipo === f.tipo); if (f.estado) rows = rows.filter(d => d.estado === f.estado);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(d => (d.titulo + d.recomendacion + nameOf(d.ini)).toLowerCase().includes(q)); }
    rows.sort(by(d => (d.estado === 'Pendiente' ? '0' : '1') + (d.limite || '9')));
    const all = DECS(), pend = all.filter(d => d.estado === 'Pendiente');
    const tcard = t => `<button class="kpi sm tcard ${f.tipo === t ? 'on' : ''}" style="--c:${DEC_C[t]}" data-act="dtipo" data-t="${t}"><div class="k-top"><span class="dtype" style="background:${DEC_C[t]}">${icon(DEC_ICON[t], 14)}</span><span class="k-l">${t}</span></div><div class="k-v">${pend.filter(d => d.tipo === t).length}<small> pend.</small></div><div class="k-s">${all.filter(d => d.tipo === t && d.estado !== 'Pendiente').length} resueltas</div></button>`;
    return pageHead('Decisiones', 'Gestión independiente de decisiones de portafolio. Al aprobar, se puede aplicar el efecto sobre el proyecto o la propuesta automáticamente.', `<span class="edit-only">${btn('Nueva decisión', 'new', { d: { t: 'dec' }, ic: 'plus', cls: 'pri' })}</span>`) + `
    ${all.length ? `<div class="chips-row tc">${DEC_TIPOS.map(tcard).join('')}</div>` : ''}
    <div class="toolbar"><div class="search"><span>${icon('search', 14)}</span><input data-key="d-q" data-chg="flt" data-v="dec" data-f="q" type="search" placeholder="Buscar decisión…" value="${esc(f.q)}"></div>
      <div class="seg">${['Pendiente', 'Aprobada', 'Rechazada', ''].map(e => `<button class="${f.estado === e ? 'on' : ''}" data-act="dest" data-e="${e}">${e || 'Todas'}</button>`).join('')}</div>${f.tipo ? btn('Quitar filtro ' + f.tipo, 'dtipo', { d: { t: f.tipo }, ic: 'x' }) : ''}</div>
    <div class="dlist">${rows.map(d => { const over = d.estado === 'Pendiente' && d.limite && d.limite < hoy(); return `<article class="dcard ${UI.sel && UI.sel.id === d.id ? 'sel' : ''}" style="--c:${DEC_C[d.tipo]}"><div class="d-t"><span class="dtype" style="background:${DEC_C[d.tipo]}">${icon(DEC_ICON[d.tipo], 15)}</span><b>${d.tipo}</b><span class="mono mut">${d.id}</span><span class="pill soft e-${d.estado}">${d.estado}</span>${over ? '<span class="pill bad">vencida ' + (-diffD(d.limite, hoy())) + ' d</span>' : ''}${(0, ENLACES.decEscalada)(d) ? '<span class="pill bad">escalada a Administra</span>' : ''}${d.aplicada ? '<span class="pill ok">efecto aplicado</span>' : ''}<span style="margin-left:auto" class="mut">${d.estado === 'Pendiente' ? 'Límite: ' + fmtD(d.limite) + ' (' + rel(d.limite) + ')' : 'Resuelta: ' + fmtD(d.fResol)}</span></div>
      <h3 data-act="sel" data-t="dec" data-id="${d.id}">${esc(d.titulo)}</h3><p class="desc"><b>Iniciativa:</b> ${d.ini ? iniLink(d.ini) : '—'} · <b>Solicita:</b> ${esc(d.solicita)}${d.comite ? ' · <b>Comité:</b> ' + esc(d.comite) : ''}</p>
      ${d.recomendacion ? `<p class="desc"><b>Recomendación:</b> ${esc(d.recomendacion)}</p>` : ''}${d.resolucion ? `<p class="desc"><b>Resolución:</b> ${esc(d.resolucion)}</p>` : ''}
      <div class="d-a edit-only">${d.estado === 'Pendiente' ? btn('Resolver', 'resolvedec', { d: { id: d.id }, ic: 'check', cls: 'pri sm' }) : ''}${btn('Editar', 'edit', { d: { t: 'dec', id: d.id }, ic: 'edit', cls: 'sm' })}</div></article>`; }).join('') || empty('Sin decisiones con estos filtros', 'gavel')}</div>`;
  }
};
Acts.dtipo = d => { const f = F('dec', {}); f.tipo = f.tipo === d.t ? '' : d.t; render(); };
Acts.dest = d => { F('dec', {}).estado = d.e; render(); };

/* ======================= BITÁCORA ======================= */
Views.bitacora = {
  render() {
    const f = F('bit', { q: '', tipos: BIT_TIPOS.filter(t => t !== 'Edición'), ini: '', tema: '', n: 60 });
    let rows = St.bitacora.filter(b => !b.ini || (byId(b.ini) ? inArea(byId(b.ini)) : true)).filter(b => f.tipos.includes(b.tipo));
    if (f.ini === '__gen') rows = rows.filter(b => !b.ini); else if (f.ini) rows = rows.filter(b => b.ini === f.ini); if (f.tema) rows = rows.filter(b => b.tema === f.tema); if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(b => (b.texto + b.autor + (b.tema || '') + nameOf(b.ini)).toLowerCase().includes(q)); }
    const temas = uniq(St.bitacora.map(b => b.tema).filter(Boolean)).sort();
    rows = rows.slice().sort(by(b => b.ts, -1)); const shown = rows.slice(0, f.n);
    const days = []; shown.forEach(b => { const d = b.ts.slice(0, 10); let g = days[days.length - 1]; if (!g || g.d !== d) days.push(g = { d, items: [] }); g.items.push(b); });
    const dl = d => { const k = diffD(d, hoy()); return k === 0 ? 'Hoy' : k === -1 ? 'Ayer' : fmtDL(d); };
    return pageHead('Bitácora', 'Activity feed del portafolio: cambios, actualizaciones, riesgos, comentarios y decisiones. Los cambios que haces en la plataforma se registran automáticamente.', btn('Exportar CSV', 'bitcsv', { ic: 'down' })) + `
    <div class="composer big edit-only"><select id="bt-ini">${selOpts(iniOpts(), '', 'General (sin proyecto)')}</select><input id="bt-tema" list="bt-temas" data-key="bt-tema" placeholder="Tema o persona" data-chg="noop" data-live="no" style="max-width:190px"><datalist id="bt-temas">${temas.map(t => `<option value="${esc(t)}">`).join('')}</datalist><input id="bt-txt" data-key="bt-txt" placeholder="Escribe un comentario o nota para la bitácora…" data-chg="noop" data-live="no"><label class="chk" title="Solo aplica a notas ligadas a un proyecto o propuesta"><input type="checkbox" id="bt-pres" checked> <span>En presentación</span></label><button class="btn pri" data-act="bitadd">${icon('send', 14)}<span>Publicar</span></button></div>
    <div class="toolbar"><div class="search"><span>${icon('search', 14)}</span><input data-key="b-q" data-chg="flt" data-v="bit" data-f="q" type="search" placeholder="Buscar en la bitácora…" value="${esc(f.q)}"></div>
      <div class="chips">${BIT_TIPOS.map(t => `<button class="chip ${f.tipos.includes(t) ? 'on' : ''}" style="--c:${BIT_C[t]}" data-act="btipo" data-t="${t}"><i></i>${t}</button>`).join('')}</div>
      <select data-chg="flt" data-v="bit" data-f="ini">${selOpts([{ v: '__gen', t: 'Solo generales (sin proyecto)' }, ...iniOptsF()], f.ini, 'Todos los proyectos y propuestas')}</select>${temas.length ? `<select data-chg="flt" data-v="bit" data-f="tema">${selOpts(temas, f.tema, 'Todos los temas')}</select>` : ''}<span class="mut" style="margin-left:auto;font-size:12px">${rows.length} ${rows.length === 1 ? 'entrada' : 'entradas'}</span></div>
    <div class="feed">${days.map(g => `<div class="f-day"><h3>${dl(g.d)}</h3>${g.items.map(b => `<div class="f-i"><span class="f-dot" style="background:${BIT_C[b.tipo]}">${icon({ 'Cambio': 'edit', 'Actualización': 'refresh', 'Riesgo': 'shield', 'Comentario': 'users', 'Decisión': 'gavel' }[b.tipo] || 'edit', 12)}</span><div class="f-c"><div class="f-m"><b>${esc(b.autor)}</b><span class="pill" style="--c:${BIT_C[b.tipo]}">${b.tipo}</span>${b.ini ? iniLink(b.ini) : ''}${b.tema ? `<span class="pill soft">${esc(b.tema)}</span>` : ''}${b.tipo === 'Comentario' && b.ini ? `<label class="chk edit-only" title="Incluir esta nota en las presentaciones" style="margin-left:auto"><input type="checkbox" data-chg="bitpres" data-id="${esc(b.id)}" ${b.inPres === false ? '' : 'checked'}> <span>En presentación</span></label>` : ''}<small>${b.ts.length > 10 ? b.ts.slice(11, 16) : ''}</small></div><p>${esc(b.texto)}</p>${b.meta ? `<small class="meta">${esc(b.meta)}</small>` : ''}</div></div>`).join('')}</div>`).join('') || empty('Sin entradas para estos filtros', 'book')}
    ${rows.length > f.n ? `<div style="text-align:center;margin:14px"><button class="btn" data-act="bmore">Cargar más (${rows.length - f.n})</button></div>` : ''}</div>`;
  }
};
Chg.noop = () => { };
Acts.bitadd = async () => { const t = $('#bt-txt').value.trim(); if (!t) return toast('Escribe un comentario', 'err'); await (0, ENLACES.cmdServidor)('apih_comentar', { p_ini: $('#bt-ini').value || null, p_texto: t, p_tema: $('#bt-tema').value.trim() || null, p_en_pres: !!$('#bt-pres').checked }, 'Publicado en la bitácora'); };
Chg.bitpres = el => { (0, ENLACES.cmdServidor)('apih_pres_marcar', { p_items: [{ k: 'bit', id: el.dataset.id, incluir: el.checked }] }, el.checked ? 'La nota entra en las presentaciones' : 'La nota queda fuera de las presentaciones'); };
Acts.btipo = d => { const f = F('bit', {}); f.tipos = f.tipos.includes(d.t) ? f.tipos.filter(x => x !== d.t) : [...f.tipos, d.t]; render(); };
Acts.bmore = () => { F('bit', {}).n += 60; render(); };
Acts.bitcsv = () => { download('APIH_bitacora_' + hoy() + '.csv', toCSV(St.bitacora, [{ h: 'Fecha', f: b => b.ts }, { h: 'Tipo', f: b => b.tipo }, { h: 'Iniciativa', f: b => nameOf(b.ini) }, { h: 'Autor', f: b => b.autor }, { h: 'Texto', f: b => b.texto }, { h: 'Detalle', f: b => b.meta }]), 'text/csv'); toast('Bitácora exportada'); };


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  DESC_MAX: { get: () => DESC_MAX, enumerable: true, configurable: true },
  avanceCalc: { get: () => avanceCalc, enumerable: true, configurable: true },
  avanceEf: { get: () => avanceEf, enumerable: true, configurable: true },
  avanceManualDe: { get: () => avanceManualDe, enumerable: true, configurable: true },
  fasesFechasDe: { get: () => fasesFechasDe, enumerable: true, configurable: true },
  fasesVentana: { get: () => fasesVentana, enumerable: true, configurable: true },
  hitosFuera: { get: () => hitosFuera, enumerable: true, configurable: true },
  cutDesc: { get: () => cutDesc, enumerable: true, configurable: true },
  faseTag: { get: () => faseTag, enumerable: true, configurable: true },
  pcols: { get: () => pcols, enumerable: true, configurable: true },
  portfolioRows: { get: () => portfolioRows, enumerable: true, configurable: true },
  rangoTx: { get: () => rangoTx, enumerable: true, configurable: true },
  subfasesDe: { get: () => subfasesDe, enumerable: true, configurable: true },
  ventanaDe: { get: () => ventanaDe, enumerable: true, configurable: true },
});
