import { ENLACES } from './00-registro.js';
import { $, $$, DECS, DEC_C, DEC_ICON, ESTADOS_PRJ, ESTADOS_PROP, FASES_ACT, FASES_PIPE, FASES_PRJ, FASES_PROP, FASE_COLOR, HITOS, MES3, RAGS, RAG_C, RIESGOS, St, addD, avatar, by, byId, critScore, desv, diffD, esProp, esc, esperado, expo, fasesDe, fmtBig, fmtD, fmtDL, fmtMon, fmtN, fmtTot, forecast, compuertas, hitoEstado, hitosDe, hoy, icon, inArea, isActive, isDone, isLive, kpis, monKeys, monMain, monOf, nameOf, nivelRiesgo, pD, pad, pct, pctMon, planSeg, porTipo, quarter, rel, restTxt, riesgoAbierto, riesgosCriticos, riesgosDe, roiTxt, scope, scopeAll, scopeP, sumM, toISO, uniq, tonoOnTrack } from './01-nucleo.js';
import { Acts, Chg, F, UI, Views, avFase, avFaseTip, btn, download, empty, estPill, fasePill, go, iniLink, openForm, pageHead, prioPill, prog, ragPill, render, selOpts, stackBar, toCSV, toast } from './03-interfaz.js';
import { cmdServidor, myWork, priorScore, semFase } from './04-flujos.js';
import { ventanasSrv } from './01-nucleo.js';


/* ======================= DASHBOARD ======================= */
Views.dashboard = {
  render() {
    const K = kpis(), L = scope(), live = L.filter(isLive), al = (0, ENLACES.motorAlertas)();
    const crit = live.filter(i => FASES_ACT.includes(i.fase) || i.fase === 'Cierre').sort(by(i => -critScore(i))).slice(0, 6);
    const risks = riesgosCriticos().length ? RIESGOS().filter(r => riesgoAbierto(r) && (!byId(r.ini) || inArea(byId(r.ini)))).sort(by(r => -expo(r))).slice(0, 6) : RIESGOS().filter(riesgoAbierto).sort(by(r => -expo(r))).slice(0, 6);
    const hs = HITOS().filter(h => !h.completado && byId(h.ini) && inArea(byId(h.ini)) && isLive(byId(h.ini))).sort(by('fecha'));
    const hv = hs.filter(h => h.fecha < hoy()).length, hp = hs.filter(h => h.fecha >= hoy()).slice(0, 6);
    const dp = DECS().filter(d => d.estado === 'Pendiente').sort(by('limite')).slice(0, 5);
    const rag = RAGS.map(r => ({ l: r, v: live.filter(i => i.rag === r).length, c: RAG_C[r] }));
    const work = myWork();
    const yr = +hoy().slice(0, 4), qs = [1, 2, 3, 4].map(q => ({ q, items: live.filter(i => { const f = forecast(i); return f && +f.slice(0, 4) === yr && quarter(f) === q; }).sort(by(i => -critScore(i))) }));
    const curQ = quarter(hoy());
    const phaseMax = Math.max(1, ...FASES_PRJ.map(f => L.filter(i => i.fase === f && isLive(i)).length)), phaseMaxP = Math.max(1, ...FASES_PROP.map(f => scopeP().filter(i => i.fase === f && isLive(i)).length));
    const kp = (cls, ic, lbl, val, sub, extra = '', go = '') => `<div class="kpi ${cls}" ${go ? `data-act="go" data-v="${go}" tabindex="0" role="button"` : ''}><div class="k-top"><span class="k-ic">${icon(ic, 16)}</span><span class="k-l">${lbl}</span></div><div class="k-v">${val}</div><div class="k-s">${sub}</div>${extra}</div>`;
    const roiG = K.pres ? Math.round((K.beneficio - K.pres) / K.pres * 100) : 0;
    return pageHead('Dashboard ejecutivo', `<span class="ph-s2"><span>Portafolio TI · ${esc(St.cfg.areaGlobal === 'Todas' ? 'Todas las áreas' : St.cfg.areaGlobal)}</span><span>al ${fmtDL(hoy())}</span></span>`, btn('Presentación<br>ejecutiva', 'go', { d: { v: 'presentaciones' }, ic: 'slides', cls: 'pri v22-main ph-2l', title: 'Presentación ejecutiva' })) + `
    ${(() => { const nDec = DECS().filter(d => d.estado === 'Pendiente').length, nRojo = live.filter(i => i.rag === 'Rojo').length; if (!nDec && !hv && !nRojo) return ''; const go = nDec ? ['decisiones', 'Resolver decisiones →'] : hv ? ['hitos', 'Revisar hitos vencidos →'] : ['portfolio', 'Ver proyectos en rojo →']; return `<div class="foco" role="status"><b>Requiere tu atención hoy</b>${nDec ? `<span class="foco-c">${nDec} decisión${nDec === 1 ? '' : 'es'} pendiente${nDec === 1 ? '' : 's'}</span>` : ''}${hv ? `<span class="foco-c r">${hv} hito${hv === 1 ? '' : 's'} vencido${hv === 1 ? '' : 's'}</span>` : ''}${nRojo ? `<span class="foco-c r">${nRojo} proyecto${nRojo === 1 ? '' : 's'} en rojo</span>` : ''}<span style="flex:1"></span><button class="btn pri" data-act="go" data-v="${go[0]}">${go[1]}</button></div>`; })()}
    <section class="kpis" aria-label="Indicadores clave">
      ${kp('', 'play', 'Proyectos Activos', K.activos, `${K.total} proyectos · ${K.cerradas} completados`, stackBar(FASES_ACT.map(f => ({ l: f, v: L.filter(i => i.fase === f && isActive(i)).length, c: FASE_COLOR[f] })), 6), 'proyectos')}
      ${kp(K.atrasados ? 'bad' : 'good', 'clock', 'Atrasados', K.atrasados, K.atrasados ? `${Math.round(K.atrasados / Math.max(1, K.activos) * 100)}% de los activos · desv. &gt; ${(0, ENLACES.cfgMi)('tolDesv')} d` : (hv ? `Proyectos sin desvío, pero ${hv} ${hv === 1 ? 'hito vencido' : 'hitos vencidos'}` : 'Sin desviaciones relevantes'), '', 'gantt')}
      ${kp(K.riesgosCrit ? 'bad' : 'good', 'shield', 'Riesgos Críticos', K.riesgosCrit, `Exposición ≥ ${(0, ENLACES.cfgMi)('umbralCritico')} · ${RIESGOS().filter(riesgoAbierto).length} riesgos abiertos`, '', 'riesgos')}
      ${kp(tonoOnTrack(K.ontrackPct).nivel, 'check', '% On Track', pct(K.ontrackPct), `${K.ontrack} de ${K.activos} activos en verde y a tiempo`, prog(K.ontrackPct, K.ontrackPct >= 60 ? 'Verde' : K.ontrackPct >= 35 ? 'Ámbar' : 'Rojo', 6), 'portfolio')}
    </section>
    <section class="kpis kpis2" aria-label="Indicadores secundarios">
      ${kp('prop', 'bulb', 'Propuestas en Pipeline', K.pipe, `${K.propAprob} listas para aprobación · valor ${fmtTot(K.M.valorPipe)}`, stackBar(FASES_PROP.map(f => ({ l: f, v: scopeP().filter(i => i.fase === f && isLive(i)).length, c: FASE_COLOR[f] })), 6), 'propuestas')}
      ${kp('', 'money', 'Presupuesto Total', fmtBig(K.M.pres), `${restTxt(K.M.pres)}proyectos · pipeline aparte: ${fmtTot(K.M.presPipe)}`, '', 'portfolio')}
      ${kp('', 'trend', 'Presupuesto Consumido', fmtBig(K.M.gas), `${restTxt(K.M.gas)}${pctMon(K.M.gas, K.M.pres)}% del presupuesto${monKeys(K.M.pres).length > 1 ? ' en ' + monMain(K.M.pres) : ''}`, prog(pctMon(K.M.gas, K.M.pres), pctMon(K.M.gas, K.M.pres) > 100 ? 'Rojo' : 'Verde', 6), 'portfolio')}
      ${kp(monKeys(K.M.beneficio).length ? 'good' : '', 'target', 'Beneficio Esperado', monKeys(K.M.beneficio).length ? fmtBig(K.M.beneficio) : '<span class="nd">Sin dato</span>', monKeys(K.M.beneficio).length ? `${restTxt(K.M.beneficio)}ROI de proyectos ${roiG}%${monKeys(K.M.pres).length > 1 ? ' (solo CLP)' : ''} <sup class="est">est.</sup>` : 'Ningún proyecto declara beneficio', '', 'portfolio')}
    </section>
    ${al.length ? `<div class="strip" role="status">${icon('spark', 16)}<span><b>${al.filter(a => a.sev === 3).length} ${al.filter(a => a.sev === 3).length === 1 ? 'alerta crítica' : 'alertas críticas'}</b> (${al.length} ${al.length === 1 ? 'hallazgo' : 'hallazgos'} de revisión automática): ${al.slice(0, 2).map(a => esc(a.titulo)).join(' · ')}…</span><a class="lnk" data-act="go" data-v="analisis">Revisar →</a></div>` : ''}
    <div class="dgrid fit dfill">
      <section class="card dc s2"><header><h2>Estado del portfolio</h2><small>${live.length} proyectos vivos · ${K.pipe} propuestas en pipeline</small></header>
        <div class="sub" style="margin:0 0 4px"><span class="pill tp prj">Proyectos</span> por fase</div>
        <div class="funnel f4" style="grid-template-columns:repeat(${FASES_PRJ.length},minmax(0,1fr))">${FASES_PRJ.map(f => { const n = L.filter(i => i.fase === f && isLive(i)).length; return `<div class="fn" data-act="go" data-v="proyectos"><span class="fn-n">${n}</span><span class="fn-b"><b style="height:${n / phaseMax * 100}%;background:${FASE_COLOR[f]}"></b></span><span class="fn-l">${f}</span></div>`; }).join('')}</div>
        <div class="legend-row">${ESTADOS_PRJ.map(e => `<span>${estPill(e)} <b>${L.filter(i => i.estado === e).length}</b></span>`).join('')}</div>
        <div class="sub" style="margin:12px 0 4px"><span class="pill tp prop">Propuestas</span> por fase</div>
        <div class="funnel f4 short" style="grid-template-columns:repeat(${FASES_PROP.length},minmax(0,1fr))">${FASES_PROP.map(f => { const n = scopeP().filter(i => i.fase === f && isLive(i)).length; return `<div class="fn" data-act="go" data-v="propuestas"><span class="fn-n">${n}</span><span class="fn-b"><b style="height:${n / phaseMaxP * 100}%;background:${FASE_COLOR[f]}"></b></span><span class="fn-l">${f}</span></div>`; }).join('')}</div>
        <div class="legend-row">${ESTADOS_PROP.map(e => `<span>${estPill(e)} <b>${scopeP().filter(i => i.estado === e).length}</b></span>`).join('')}</div></section>
      <section class="card dc dsal"><header><h2 title="altura = avance · +Nd = atraso">Salud del portfolio</h2><small>altura = avance · +Nd = atraso</small></header>${ragMosaic(live)}</section>
      <section class="card dc dcf"><header><h2>Top riesgos</h2><button class="lnk" data-act="go" data-v="riesgos">Matriz →</button></header>
        ${risks.map(r => { const n = nivelRiesgo(r); return `<button class="row" data-act="sel" data-t="risk" data-id="${r.id}"><span class="expo" style="background:${n.c}">${expo(r)}</span><span class="r-m"><b>${esc(r.desc)}</b><small>${esc(nameOf(r.ini))} · ${esc(r.dueno || 'sin dueño')}</small></span><span class="pill soft">${r.estado}</span></button>`; }).join('') || empty('Sin riesgos', 'shield')}${risks.length ? `<button class="dfoot" data-act="go" data-v="riesgos">Ver los ${RIESGOS().filter(riesgoAbierto).length} riesgos →</button>` : ''}</section>
      <section class="card dc s2 dcf"><header><h2>Top proyectos críticos</h2><button class="lnk" data-act="go" data-v="portfolio">Portfolio →</button></header>
        <table class="mini"><thead><tr><th>Proyecto</th><th>RAG</th><th>Avance</th><th>Desv.</th><th>Riesgos</th><th>Líder</th></tr></thead><tbody>${crit.map(i => `<tr data-act="sel" data-t="ini" data-id="${i.id}"><td><b>${esc(i.titulo)}</b><small>${i.fase}</small></td><td>${ragPill(i.rag)}</td><td class="n">${pct(i.avance)}${prog(i.avance, i.rag, 4)}</td><td class="n ${desv(i) > St.cfg.tolDesv ? 'neg' : ''}">${desv(i) ? '+' + desv(i) + ' d' : '—'}</td><td class="n">${riesgosDe(i.id).filter(riesgoAbierto).length}</td><td>${avatar(i.lider, 22)}</td></tr>`).join('')}</tbody></table>${crit.length ? (() => { const c = { r: 0, a: 0, v: 0 }; crit.forEach(i => { if (i.rag === 'Rojo') c.r++; else if (i.rag === 'Ámbar') c.a++; else c.v++; }); return `<div class="mx-dist"><div class="bar"><i style="flex:${c.r};background:#D13438"></i><i style="flex:${c.a};background:#F2A100"></i><i style="flex:${c.v};background:#107C10"></i></div><div class="mx-lg"><span><b>${c.r}</b> rojo</span><span><b>${c.a}</b> ámbar</span><span><b>${c.v}</b> verde</span><span style="margin-left:auto">de los ${crit.length} más críticos</span></div></div>`; })() : ''}${crit.length ? `<button class="dfoot" data-act="go" data-v="portfolio">Ver los ${live.length} proyectos →</button>` : ''}</section>
      <section class="card dc tabsc t-${UI.dtab || 'hitos'}"><header><div class="tabs-h" role="tablist"><button role="tab" aria-selected="${(UI.dtab || 'hitos') === 'hitos'}" data-act="dtab" data-k="hitos">Hitos${hv ? ` <i class="bd">${hv}</i>` : ''}</button><button role="tab" aria-selected="${UI.dtab === 'dec'}" data-act="dtab" data-k="dec">Decisiones <i class="bd">${dp.length}</i></button><button role="tab" aria-selected="${UI.dtab === 'work'}" data-act="dtab" data-k="work">Mi trabajo <i class="bd">${work.length}</i></button></div></header>
        <div class="tb tb-hitos">${hv ? `<div class="note bad" style="margin-bottom:8px">${icon('warn', 14)} <span><b>${hv}</b> ${hv === 1 ? 'hito vencido sin completar' : 'hitos vencidos sin completar'}</span></div>` : ''}
        ${hp.map(h => { const e = hitoEstado(h); return `<button class="row" data-act="sel" data-t="hito" data-id="${h.id}"><span class="dt"><b>${pD(h.fecha).getDate()}</b>${MES3[pD(h.fecha).getMonth()]}</span><span class="r-m"><b>${esc(h.nombre)}</b><small>${esc(nameOf(h.ini))}</small></span><span class="pill" style="--c:${e.c}">${rel(h.fecha)}</span></button>`; }).join('') || empty('Sin hitos próximos', 'flag')}</div>
        <div class="tb tb-dec">${dp.map(d => `<button class="row" data-act="sel" data-t="dec" data-id="${d.id}"><span class="dtype" style="background:${DEC_C[d.tipo]}">${icon(DEC_ICON[d.tipo], 14)}</span><span class="r-m"><b>${esc(d.titulo)}</b><small>${d.ini ? esc(nameOf(d.ini)) : '—'}</small></span><span class="pill ${d.limite < hoy() ? 'bad' : 'soft'}">${d.limite < hoy() ? 'vencida' : rel(d.limite)}</span></button>`).join('') || empty('Sin decisiones pendientes', 'gavel')}</div>
        <div class="tb tb-work"><div class="chips" style="margin:0 0 8px">${btn('Ronda de actualización' + ((0, ENLACES.rondaIds)().length ? ' (' + (0, ENLACES.rondaIds)().length + ')' : ''), 'ronda', { ic: 'refresh', cls: 'sm pri' })}${btn('Resumen de mi semana', 'resumen', { ic: 'send', cls: 'sm' })}${btn('Nuevo compromiso', 'acunew', { ic: 'plus', cls: 'sm' })}</div>${work.slice(0, 7).map(w => `<div class="row w"><span class="w-i ${w.over ? 'over' : ''}">${icon(w.ic, 14)}</span><button class="r-m lnk0" data-act="${w.k === 'hito' ? 'sel' : w.k === 'risk' ? 'sel' : w.k === 'dec' ? 'sel' : w.k === 'upd' ? 'wk' : 'go'}" data-t="${w.k === 'hito' ? 'hito' : w.k === 'risk' ? 'risk' : w.k === 'dec' ? 'dec' : 'ini'}" data-id="${w.id}" data-v="${w.k === 'acu' ? 'compromisos' : 'comite'}"><b>${esc(w.t)}</b><small>${esc(w.s)} · <span class="${w.over ? 'neg' : ''}">${fmtD(w.when)}</span></small></button>${w.k === 'hito' ? `<input type="checkbox" data-chg="hitotoggle" data-id="${w.id}" aria-label="Completar hito">` : ''}</div>`).join('') || empty('Todo al día', 'check')}</div></section>
      <section class="card dc"><header><h2>Roadmap ${yr}</h2><button class="lnk" data-act="go" data-v="roadmap">Completo →</button></header>
        <div class="qlist">${qs.map(q => `<button class="qrow ${q.q === curQ ? 'cur' : ''}" data-act="go" data-v="roadmap"><b>Q${q.q}</b><span ${q.items.length ? '' : 'class="mut"'}>${q.items.length ? q.items.length + ' entrega' + (q.items.length === 1 ? '' : 's') : 'Sin entregas'}${q.q === curQ ? ' · actual' : ''}</span><small>${q.items.slice(0, 2).map(i => esc(i.titulo)).join(' · ') || '—'}</small></button>`).join('')}</div></section>
    </div>`;
  }
};

/* ---- V10 · Salud del portfolio: un cuadro por proyecto (color + figura = estado, altura = avance, etiqueta = atraso) ---- */
const RAG_SHAPE = { 'Verde': '<circle cx="7" cy="7" r="6"/>', 'Ámbar': '<path d="M7 1.5 13 12.5H1z"/>', 'Rojo': '<path d="M7 1 13 7 7 13 1 7z"/>' };
function ragMosaic(live) {
  const L = live.filter(i => !esProp(i)), n = L.length, cnt = r => L.filter(i => i.rag === r).length;
  if (!n) return '<div class="empty"><p>Sin proyectos vivos</p></div>';
  const ord = { 'Rojo': 0, 'Ámbar': 1, 'Verde': 2 };
  const S = L.slice().sort((a, b) => (ord[a.rag] ?? 3) - (ord[b.rag] ?? 3) || desv(b) - desv(a));
  const sano = Math.round(cnt('Verde') / n * 100);
  const bar = RAGS.filter(r => cnt(r)).map(r => `<i style="flex:${cnt(r)};background:${RAG_C[r]}"></i>`).join('');
  const tiles = S.map(i => {
    const c = RAG_C[i.rag] || '#888', av = Math.round(i.avance || 0), dv = desv(i);
    const tip = `${i.id} · ${i.titulo} — ${i.rag} · avance ${av}%${dv ? ' · desv. +' + dv + ' d' : ''}${i.lider ? ' · ' + i.lider : ''}`;
    return `<span class="tw" data-tip="${esc(tip)}"><button class="tile" style="--c:${c}" data-act="sel" data-t="ini" data-id="${esc(i.id)}" aria-label="${esc(tip)}"><span class="fill" style="height:${av}%"></span><svg class="sh" viewBox="0 0 14 14" fill="${c}" aria-hidden="true">${RAG_SHAPE[i.rag] || ''}</svg><span class="pc">${av}%</span><span class="id">${esc(String(i.id).replace(/^[A-Z]+-/, ''))}</span>${dv ? `<span class="late">+${dv}d</span>` : ''}</button></span>`;
  }).join('');
  return `<div class="hl"><b>${sano}%</b><span>saludable · ${cnt('Ámbar')} en ámbar, ${cnt('Rojo')} en rojo</span></div><div class="rbar" aria-hidden="true">${bar}</div><div class="mosaic">${tiles}</div>
    <div class="rleg">${RAGS.map(r => `<span><svg viewBox="0 0 14 14" fill="${RAG_C[r]}" aria-hidden="true">${RAG_SHAPE[r]}</svg>${r} <b>${cnt(r)}</b></span>`).join('')}<span>Altura = avance</span><span><em class="late-k">+Nd</em> atraso</span></div>`;
}
export const PCELL = (c, i) => ((c.t === 'j' && esProp(i)) || (c.t === 'p' && !esProp(i))) ? '<span class="mut">—</span>' : c.r(i);
export const GROUPS = { '': 'Sin agrupar', area: 'Área', fase: 'Fase', rag: 'RAG', lider: 'Responsable', prioridad: 'Prioridad', categoria: 'Categoría', estado: 'Estado' };
Chg.flt = el => { const f = F(el.dataset.v, {}); f[el.dataset.f] = el.dataset.bool ? el.checked : el.value; render(); };
Acts.psort = d => { const f = F('portfolio', {}); if (f.sort === d.k) f.dir = -f.dir; else { f.sort = d.k; f.dir = 1; } render(); };
Acts.pgrp = d => { const f = F('portfolio', {}); f.col = f.col || {}; f.col[d.g] = !f.col[d.g]; render(); };
Acts.pclear = () => { Object.assign(F('portfolio', {}), { q: '', fase: '', estado: '', rag: '', prio: '', resp: '', area: '', tini: '' }); render(); };
Acts.pfadv = () => { UI.pfAdv = !UI.pfAdv; render(); };

Acts.pdens = () => { const f = F('portfolio', {}); f.dens = f.dens === 'c' ? 'n' : 'c'; render(); };

/* ======================= INICIATIVAS ======================= */
const planFase = i => { const hs = hitosDe(i.id).filter(h => h.fase === i.fase); return hs.length ? hs.filter(h => h.fecha <= hoy()).length / hs.length * 100 : esperado(i); };
const clamp100 = v => Math.max(0, Math.min(100, Math.round(v || 0)));
function pvRow(l, real, plan, rag, tip, cls) {
  const r = clamp100(real), pl = clamp100(plan), d = r - pl, c = d <= -10 ? 'neg' : d >= 5 ? 'pos' : 'eq', col = RAG_C[rag] || 'var(--pri)';
  return `<div class="pv ${cls}" title="${esc(tip)}"><span>${l}</span><span class="bar" role="img" aria-label="${esc(tip)}"><i style="width:${r}%;background:${col}"></i><u style="left:calc(${pl}% - 1px)"></u></span><span class="val"><b>${r}%</b><span class="dl ${c}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '● plan'}</span></span></div>`;
}
export const planBars = i => `<div class="pvs">${pvRow('Total', i.avance, esperado(i), i.rag, 'Total: real ' + clamp100(i.avance) + '% · plan ' + clamp100(esperado(i)) + '% (según fechas del proyecto)', 'main')}${pvRow('Fase', avFase(i).v, planFase(i), i.rag, avFaseTip(i) + ' · real ' + avFase(i).v + '% · plan ' + clamp100(planFase(i)) + '% (hitos con fecha vencida)', 'sub')}</div>`;
export function starsCnt(i) {
  if (!(0, ENLACES.cieloOn)() || esProp(i)) return '';
  const act = isLive(i) && FASES_ACT.includes(i.fase), n = (0, ENLACES.msN)(i); if (!act && !n) return '';
  const st = act ? (0, ENLACES.starsOf)(i, (0, ENLACES.hoyW)()).filter(x => x.s !== 'na') : [], on = st.filter(x => x.s === 'on').length;
  return `<span class="sk-cnt" title="Tenedores de la semana: ${on} de ${st.length}${n ? ' · ' + n + ' estrella(s) Michelin' : ''}">${act ? (0, ENLACES.STAR_SVG)('on', 12) + ' ' + on + '/' + st.length : ''}${n ? ' ★' + n : ''}</span>`;
}
Acts.imode = d => { F('prj', {}).mode = d.m; render(); };
export function bindDnD() {
  $$('.icard[draggable]').forEach(c => { c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('drag'); }); c.addEventListener('dragend', () => c.classList.remove('drag')); });
  $$('.kcol').forEach(col => { col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); }); col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'), i = byId(id); if (!i || i.fase === col.dataset.fase) return; if (!fasesDe(i).includes(col.dataset.fase)) return toast(esProp(i) ? 'Una propuesta pasa a proyecto al aprobarse en el comité' : 'Un proyecto no vuelve a fases de propuesta', 'err'); if (!(0, ENLACES.puedeEditarIni)(i)) return (0, ENLACES.NO_PERM)('Sin permiso para mover iniciativas del área ' + i.area); if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); Acts.etapa({ id, pre: 'f:' + col.dataset.fase }); }); });
}

/* ======================= PROPUESTAS (Innovation Pipeline) ======================= */
Views.propuestas = {
  render() {
    const f = F('prop', { q: '', showEnd: false });
    const allP = scopeP(); let rows = allP.filter(isLive);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.lider + i.sponsor).toLowerCase().includes(q)); }
    const total = { n: rows.length, p: sumM(rows, i => i.presupuesto), b: sumM(rows, i => i.beneficio), esp: rows.filter(i => i.estado === 'En espera').length };
    const card = i => { const nx = FASES_PROP[FASES_PROP.indexOf(i.fase) + 1], g = compuertas(i), ok = g.filter(x => x.ok).length, sf = semFase(i);
      return `<article tabindex="0" role="button" class="icard prop ${UI.sel && UI.sel.id === i.id ? 'sel' : ''}" draggable="true" data-id="${i.id}" data-act="sel" data-t="ini"><div class="ic-t"><span class="mono">${i.id}</span>${i.estado === 'En espera' ? estPill('En espera') : ''}<span class="pill" style="--c:${sf.c}" title="Días en la fase actual">${sf.d} d</span></div><h3>${esc(i.titulo)}</h3>
      <div class="ic-sc"><span title="Índice de priorización"><b>${i.score ? priorScore(i) : '—'}</b><small>score</small></span><span class="sbar">${prog(ok / Math.max(1, g.length) * 100, ok === g.length ? 'Verde' : 'Ámbar', 5)}<small>${ok}/${g.length} ${i.fase === 'Aprobación' ? 'para aprobar' : 'compuertas'}</small></span></div>
      <div class="ic-f"><span class="pp">${avatar(i.sponsor || i.lider, 20)}<small>${esc((i.sponsor || i.lider).split(' ')[0])}</small></span>${prioPill(i.prioridad)}<small class="mut">${fmtMon(i.presupuesto, monOf(i))}</small></div></article>`; };
    // matriz valor / esfuerzo
    const W = 560, H = 330, P = 40;
    const dots = rows.map(i => { const s = i.score || { valor: 3, esfuerzo: 3 }; const x = P + (s.esfuerzo - 1) / 4 * (W - 2 * P), y = H - P - (s.valor - 1) / 4 * (H - 2 * P); const jx = ((parseInt(i.id.slice(5), 10) * 37) % 26) - 13, jy = ((parseInt(i.id.slice(5), 10) * 53) % 26) - 13; return { i, x: x + jx, y: y + jy, r: 7 + Math.sqrt(i.presupuesto) * .45 }; });
    const matrix = `<svg viewBox="0 0 ${W} ${H}" class="matrix" role="img" aria-label="Matriz valor versus esfuerzo"><rect x="${P}" y="${P / 2}" width="${(W - 2 * P) / 2}" height="${(H - 1.5 * P) / 2}" fill="#E8F4E8"/><rect x="${W / 2}" y="${P / 2}" width="${(W - 2 * P) / 2}" height="${(H - 1.5 * P) / 2}" fill="#EAF1FB"/><rect x="${P}" y="${H / 2 - P / 4}" width="${(W - 2 * P) / 2}" height="${(H - 1.5 * P) / 2}" fill="#F7F6F5"/><rect x="${W / 2}" y="${H / 2 - P / 4}" width="${(W - 2 * P) / 2}" height="${(H - 1.5 * P) / 2}" fill="#FDF3E3"/>
      <text x="${P + 8}" y="${P / 2 + 16}" class="mq">Quick wins</text><text x="${W / 2 + 8}" y="${P / 2 + 16}" class="mq">Apuestas estratégicas</text><text x="${P + 8}" y="${H - P - 8}" class="mq">Rellenos</text><text x="${W / 2 + 8}" y="${H - P - 8}" class="mq">Cuestionables</text>
      <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#8A8886"/><line x1="${P}" y1="${P / 2}" x2="${P}" y2="${H - P}" stroke="#8A8886"/><text x="${W / 2}" y="${H - 8}" text-anchor="middle" class="ax">Esfuerzo →</text><text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle" class="ax">Valor →</text>
      ${dots.map(d => `<g class="dotg" data-act="sel" data-t="ini" data-id="${d.i.id}" tabindex="0"><circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${FASE_COLOR[d.i.fase]}" fill-opacity=".55" stroke="${FASE_COLOR[d.i.fase]}" stroke-width="1.5"/><title>${esc(d.i.titulo)} · valor ${(d.i.score || {}).valor} · esfuerzo ${(d.i.score || {}).esfuerzo} · ${fmtN(d.i.presupuesto)} MM</title><text x="${d.x}" y="${d.y + 3.5}" text-anchor="middle" class="dl">${d.i.id.slice(5)}</text></g>`).join('')}</svg>`;
    const rank = rows.slice().sort(by(i => -priorScore(i))).slice(0, 8);
    return pageHead('Pipeline de propuestas', 'Del problema al caso de negocio y la aprobación. Al aprobar una propuesta se crea un proyecto. Cada fase exige compuertas de gobierno antes de avanzar.', `<span class="edit-only">${btn('Nueva propuesta', 'new', { d: { t: 'prop' }, ic: 'plus', cls: 'pri' })}</span>`) + `
    <section class="kpis k4"><div class="kpi"><div class="k-top"><span class="k-ic">${icon('bulb', 16)}</span><span class="k-l">En pipeline</span></div><div class="k-v">${total.n}</div><div class="k-s">${total.esp} en espera · ${rows.filter(i => i.fase === 'Aprobación' && i.estado === 'Vigente').length} listas para aprobar</div></div>
      <div class="kpi"><div class="k-top"><span class="k-ic">${icon('money', 16)}</span><span class="k-l">Costo estimado</span></div><div class="k-v">${fmtBig(total.p)}</div><div class="k-s">${restTxt(total.p)}<sup class="est">est.</sup></div></div>
      <div class="kpi good"><div class="k-top"><span class="k-ic">${icon('target', 16)}</span><span class="k-l">Valor potencial</span></div><div class="k-v">${fmtBig(total.b)}</div><div class="k-s">${restTxt(total.b)}Beneficio esperado <sup class="est">est.</sup></div></div>
      <div class="kpi"><div class="k-top"><span class="k-ic">${icon('trend', 16)}</span><span class="k-l">ROI potencial</span></div><div class="k-v">${roiTxt(total.b, total.p)}</div><div class="k-s">(beneficio − costo) / costo</div></div></section>
    <div class="toolbar"><div class="search"><span>${icon('search', 14)}</span><input data-key="pp-q" data-chg="flt" data-v="prop" data-f="q" type="search" placeholder="Buscar…" value="${esc(f.q)}"></div><label class="chk tb-c"><input type="checkbox" ${f.showEnd ? 'checked' : ''} data-chg="flt" data-v="prop" data-f="showEnd" data-bool="1"> <span>Mostrar finalizadas (${allP.filter(isDone).length})</span></label></div>
    <div class="kanban k4c" data-keep="kb2" style="grid-template-columns:repeat(${FASES_PIPE.length},minmax(200px,1fr))">${FASES_PIPE.map(fs => { const it = rows.filter(i => i.fase === fs).sort(by(i => -priorScore(i))); return `<div class="kcol" data-fase="${fs}"><div class="k-h"><i style="background:${FASE_COLOR[fs]}"></i><b>${fs}</b><em>${it.length}</em></div><div class="k-b">${it.map(card).join('') || '<div class="k-e">Sin propuestas</div>'}</div></div>`; }).join('')}</div>
    ${f.showEnd ? `<section class="card" style="margin-top:14px"><header><h2>Propuestas finalizadas</h2><small>Aprobadas generan un proyecto · Rechazadas y Retiradas pueden reabrirse</small></header><table class="mini"><thead><tr><th>Propuesta</th><th>Estado</th><th>Motivo / resultado</th><th></th></tr></thead><tbody>${allP.filter(isDone).map(i => `<tr><td><button class="lnk0" data-act="sel" data-t="ini" data-id="${i.id}"><b>${esc(i.titulo)}</b></button><small>${i.id}</small></td><td>${estPill(i.estado)}</td><td>${i.estado === 'Aprobada' && i.proyecto ? `Proyecto ${iniLink(i.proyecto, i.proyecto)}` : esc(i.estadoMotivo || '—')}</td><td class="n">${['Rechazada', 'Retirada'].includes(i.estado) ? `<span class="edit-only">${btn('Reabrir', 'reopen', { d: { id: i.id }, ic: 'undo', cls: 'sm' })}</span>` : ''}</td></tr>`).join('') || '<tr><td colspan="4" class="mut">Sin propuestas finalizadas</td></tr>'}</tbody></table></section>` : ''}
    <div class="grid12" style="margin-top:14px"><section class="card c7"><header><h2>Matriz valor / esfuerzo</h2><small>Tamaño = costo estimado · color = fase</small></header>${matrix}</section>
      <section class="card c5"><header><h2>Ranking de priorización</h2><small>0,30·valor + 0,25·estrategia + 0,15·ROI + 0,15·(esfuerzo inv.) + 0,10·capacidad del líder + 0,05·(riesgo inv.) · sin evaluar = —</small></header>${rank.map((i, k) => `<button class="row" data-act="sel" data-t="ini" data-id="${i.id}"><span class="rk">${k + 1}</span><span class="r-m"><b>${esc(i.titulo)}</b><small>${i.fase} · ${esc(i.sponsor || '—')}</small></span><span class="score">${priorScore(i)}</span></button>`).join('')}</section></div>`;
  },
  after() { bindDnD(); }
};

/* ============================================================
   APIH · Vistas 2: Roadmap, Gantt, Riesgos, Hitos, Calendario
   ============================================================ */

/* ======================= ROADMAP ======================= */
Views.roadmap = {
  render() {
    const t0 = pD(hoy()), f = F('road', { y0: t0.getFullYear(), q0: quarter(hoy()), lane: 'area', q: '', hideDone: false });
    let rows = scopeAll().filter(i => porTipo(i) && i.estado !== 'Cancelado'); if (f.hideDone) rows = rows.filter(isLive);
    if (f.q) { const q = f.q.toLowerCase(); rows = rows.filter(i => (i.titulo + i.lider).toLowerCase().includes(q)); }
    const W = [0, 1, 2, 3].map(k => { const n = f.y0 * 4 + (f.q0 - 1) + k; return { y: Math.floor(n / 4), q: n % 4 + 1, n }; });
    const qs = w => `${w.y}-${pad((w.q - 1) * 3 + 1)}-01`, qe = w => toISO(new Date(w.y, w.q * 3, 0, 12));
    const qn = d => +d.slice(0, 4) * 4 + quarter(d) - 1;   // índice absoluto de trimestre
    const inQ = (i, w) => { const f2 = forecast(i), s = i.inicioPlan; return f2 && s && s <= qe(w) && f2 >= qs(w); };
    const endN = i => { const f2 = forecast(i); return f2 ? qn(f2) : null; };
    const planN = i => i.finPlan ? qn(i.finPlan) : null;
    const lanes = f.lane ? uniq(rows.map(i => f.lane === 'area' ? i.area : i[f.lane])).sort() : ['Todos los proyectos'];
    const curN = qn(hoy());
    const card = i => { const eq = endN(i), pq = planN(i), slip = eq != null && pq != null && eq > pq; return `<button class="rcard ${UI.sel && UI.sel.id === i.id ? 'sel' : ''}" data-act="sel" data-t="ini" data-id="${i.id}" style="--c:${RAG_C[i.rag]}"><div class="rc-t"><b>${esc(i.titulo)}</b></div><div class="rc-s">${fasePill(i.fase)}${i.estado !== 'En curso' ? estPill(i.estado) : ''}</div><div class="qspan">${W.map(w => `<i class="${inQ(i, w) ? 'on' : ''}">Q${w.q}</i>`).join('')}</div><div class="rc-m">${prog(i.avance, i.rag, 4)}<small>${pct(i.avance)} · fin ${fmtD(forecast(i))}${slip ? ` <b class="neg" title="Pronóstico posterior a la línea base">⚠ +${eq - pq} trim.</b>` : ''}</small></div></button>`; };
    const grid = lanes.map(l => {
      const li = f.lane ? rows.filter(i => (f.lane === 'area' ? i.area : i[f.lane]) === l) : rows;
      return `<div class="r-lane"><div class="r-lh"><b>${esc(l)}</b><small>${li.length} · ${fmtTot(sumM(li, i => i.presupuesto))}</small></div>${W.map(w => { const it = li.filter(i => endN(i) === w.n).sort(by(i => -critScore(i))); return `<div class="r-cell ${w.n === curN ? 'cur' : ''}">${it.map(card).join('')}</div>`; }).join('')}</div>`;
    }).join('');
    const before = rows.filter(i => endN(i) != null && endN(i) < W[0].n).length, after = rows.filter(i => endN(i) != null && endN(i) > W[3].n).length;
    return pageHead('Roadmap ejecutivo', 'Entregas por trimestre según fecha de fin proyectada (ventana móvil de 4 trimestres). Las barras Q muestran el periodo que abarca cada proyecto.', btn('Exportar CSV', 'roadcsv', { ic: 'down' })) + `
    <div class="toolbar">${planSeg()}<div class="seg"><button data-act="rshift" data-d="-1" aria-label="Trimestre anterior">${icon('chevl', 14)}</button><span class="seg-l" style="min-width:150px">Q${W[0].q} ${W[0].y} – Q${W[3].q} ${W[3].y}</span><button data-act="rshift" data-d="1" aria-label="Trimestre siguiente">${icon('chev', 14)}</button></div>${btn('Hoy', 'rshift', { d: { d: 0 } })}
      <div class="search"><span>${icon('search', 14)}</span><input data-key="rd-q" data-chg="flt" data-v="road" data-f="q" type="search" placeholder="Buscar…" value="${esc(f.q)}"></div>
      <label class="tb-l">Carriles<select data-chg="flt" data-v="road" data-f="lane">${selOpts([{ v: 'area', t: 'Por área' }, { v: 'categoria', t: 'Por categoría' }, { v: 'lider', t: 'Por responsable' }, { v: 'fase', t: 'Por fase' }, { v: '', t: 'Sin carriles' }], f.lane)}</select></label>
      <label class="chk tb-c"><input type="checkbox" ${f.hideDone ? 'checked' : ''} data-chg="flt" data-v="road" data-f="hideDone" data-bool="1"> <span>Ocultar cerrados</span></label>
      <span class="mut" style="margin-left:auto;font-size:12px">${before ? before + ' entregadas antes · ' : ''}${after ? after + ' después de la ventana' : ''}</span></div>
    <div class="road" data-keep="rd"><div class="r-head"><div class="r-lh">Carril</div>${W.map(w => `<div class="${w.n === curN ? 'cur' : ''}"><b>Q${w.q} ${w.y}</b><small>${MES3[(w.q - 1) * 3]}–${MES3[w.q * 3 - 1]} · ${rows.filter(i => endN(i) === w.n).length} entregas</small></div>`).join('')}</div>${grid}</div>`;
  }
};
Acts.rshift = d => { const f = F('road', {}); if (+d.d === 0) { f.y0 = +hoy().slice(0, 4); f.q0 = quarter(hoy()); } else { const n = f.y0 * 4 + (f.q0 - 1) + +d.d; f.y0 = Math.floor(n / 4); f.q0 = n % 4 + 1; } render(); };
Acts.roadcsv = () => { const rows = scopeAll().filter(porTipo); download('APIH_roadmap_' + hoy() + '.csv', toCSV(rows, [{ h: 'ID', f: i => i.id }, { h: 'Iniciativa', f: i => i.titulo }, { h: 'Área', f: i => i.area }, { h: 'Fase', f: i => i.fase }, { h: 'Inicio plan', f: i => i.inicioPlan }, { h: 'Fin plan', f: i => i.finPlan }, { h: 'Fin proyectado', f: i => forecast(i) }, { h: 'Trimestre entrega', f: i => forecast(i) ? 'Q' + quarter(forecast(i)) + ' ' + forecast(i).slice(0, 4) : '' }, { h: 'RAG', f: i => i.rag }]), 'text/csv'); toast('Roadmap exportado'); };

/* ======================= V22.53 · FASES: 4 miradas (Gantt por fases, Línea, Tablero, Riesgos en el tiempo) ======================= */
export const FZ_TABS = [['gantt', 'Gantt por fases'], ['linea', 'Línea de fases'], ['tablero', 'Tablero'], ['riesgos', 'Riesgos en el tiempo']];
export const fzd = s => s ? s.slice(8, 10) + '-' + s.slice(5, 7) + (s.slice(0, 4) !== hoy().slice(0, 4) ? '-' + s.slice(2, 4) : '') : '—';   /* N-U-20: año visible si no es el actual */
export const fzTx = c => c === '#F2A100' ? 'var(--fzamb,#8A6100)' : c;   // N-V-02: ámbar legible en tema oscuro                       // texto legible sobre blanco
export const fzOn = c => c === '#F2A100' ? '#201F1E' : '#fff';                  // texto sobre fondo de color
/* Ventana de cada fase: desde el día siguiente al fin de la anterior (la 1ª desde inicioPlan) hasta su último hito (la última hasta finPlan si no tiene hitos) */
export const fasesFechasDe = i => (i && i.fasesFechas && typeof i.fasesFechas === 'object' && !Array.isArray(i.fasesFechas) ? i.fasesFechas : {});
const fechaFase = x => !!(x && typeof x.ini === 'string' && typeof x.fin === 'string' && x.ini && x.fin && x.fin >= x.ini);
export function fasesVentana(i) {
  const FS = fasesDe(i), hs = hitosDe(i.id), FF = fasesFechasDe(i), SV = ventanasSrv(i);
  return FS.map((f, k) => {
    const h = hs.filter(x => x.fase === f).sort(by('fecha')), s = SV.find(x => x.fase === f), e = fechaFase(FF[f]);   /* las fechas de cada fase las calcula el servidor; sin respuesta aún se muestran las guardadas */
    return { fase: f, k, ini: s ? s.ini : (e ? FF[f].ini : null), fin: s ? s.fin : (e ? FF[f].fin : null), explicita: s ? !!s.explicita : e, hitos: h, subs: subfasesDe(i).filter(x => x.fase === f).sort(by('inicio')), done: h.filter(x => x.completado).length,
      avance: s ? s.avance : (FS.indexOf(i.fase) > k ? 100 : 0), unidades: s ? !!s.unidades : false, color: FASE_COLOR[f] || '#605E5C', actual: i.fase === f, pasada: FS.indexOf(i.fase) > k };
  });
}
export const fzRiesgosFase = (i, v) => riesgosDe(i.id).filter(r => riesgoAbierto(r) && r.fRev && v.ini && v.fin && r.fRev >= v.ini && r.fRev <= v.fin);
export function fzEscala(d0, d1In, W) { const d1 = diffD(d1In, d0) > 3650 ? addD(d0, 3650) : d1In;   // N-S-03: escala acotada a 10 años; fechas extremas (año 9999) colgaban la vista
  const days = Math.max(1, diffD(d1, d0) + 1), ppd = W / days, x = s => Math.min(W, Math.max(0, diffD(s, d0) * ppd)), ticks = [];
  if (days <= 130) { let d = d0; while (pD(d).getDay() !== 1) d = addD(d, 1); for (; d <= d1; d = addD(d, 7)) ticks.push({ x: x(d), t: +d.slice(8) + ' ' + MES3[+d.slice(5, 7) - 1].toLowerCase() }); }
  else { let d = d0.slice(0, 8) + '01'; if (d < d0) d = toISO(new Date(+d0.slice(0, 4), +d0.slice(5, 7), 1, 12)); for (; d <= d1; d = toISO(new Date(+d.slice(0, 4), +d.slice(5, 7), 1, 12))) ticks.push({ x: x(d), t: MES3[+d.slice(5, 7) - 1] + ' ' + d.slice(2, 4) }); }
  return { x, ppd, ticks, W, d0, d1 };
}
export const fzGrid = (E, head) => E.ticks.map(t => `<i class="fz-wk" style="left:${t.x}px">${head ? esc(t.t) : ''}</i>`).join('') + (hoy() >= E.d0 && hoy() <= E.d1 ? `<i class="fz-hoy" style="left:${E.x(hoy())}px"></i>` : '');
export const fzHito = (E, h) => { const e = hitoEstado(h); return `<i class="fz-h ${h.completado ? 'done' : e.k === 'over' ? 'over' : ''}" style="left:${E.x(h.fecha) - 6}px" title="${esc(h.nombre + ' · ' + fzd(h.fecha) + ' · ' + e.t + (h.resp ? ' · ' + h.resp : ''))}"></i>`; };
export const fzRsk = (E, r) => { const n = nivelRiesgo(r); return `<i class="fz-r" style="left:${E.x(r.fRev) - 6}px;--c:${n.c}" title="${esc(r.desc + ' · ' + n.n + ' (' + expo(r) + ') · revisión ' + fzd(r.fRev))}"></i>`; };

/* ======================= V22.55 · Subfases por proyecto (ADR-012) =======================
   Una subfase pertenece a UNA fase obligatoria del proyecto. Nace con el inicio y fin de esa fase (los hereda si se dejan vacíos)
   y no puede extenderse fuera de ella. Se guarda dentro de la iniciativa (i.subfases); el hito la referencia con h.subfase. */
export const subfasesDe = i => (i && Array.isArray(i.subfases) ? i.subfases : []);
export const ventanaDe = (i, f) => fasesVentana(i).find(v => v.fase === f) || null;
export const rangoTx = (a, b) => fzd(a) + ' → ' + fzd(b);

/* ======================= Avance (V23) =======================
   El servidor calcula el avance (hitos y subfases por fase, ponderado por días) y lo guarda en cada escritura; la app solo lo lee (js/01-nucleo.js). */
/* ======================= V23 · Fechas de fase explícitas =======================
   El proyecto guarda inicio y fin de CADA fase (i.fasesFechas). inicioPlan y finPlan del proyecto son el rango de esas fases:
   nadie los escribe por separado. Los hitos y las subfases viven dentro de su fase (los que quedan fuera se marcan como alerta). */
/* hitos de la fase cuya fecha cae fuera de ella (alerta, no bloqueo) */
export const hitosFuera = (i, v) => (v && v.ini && v.fin ? v.hitos.filter(h => h.fecha && (h.fecha < v.ini || h.fecha > v.fin)) : []);
export const subFuera = (s, v) => !v || !v.ini || !v.fin || s.inicio < v.ini || s.fin > v.fin;
export const hitosSub = (i, s) => hitosDe(i.id).filter(h => h.subfase === s.id);
export function subActual(i) { const v = ventanaDe(i, i.fase), H = hoy(); return v ? v.subs.find(s => s.inicio <= H && s.fin >= H) || null : null; }
/* La fase de un proyecto se muestra siempre con su inicio y fin (y la subfase en curso, si la hay) */
/* V22.61 · Descripción / instrucciones por objeto (fase global + nota por proyecto, subfase, hito). Se ven sobre todo en Mi cocina. */
export const DESC_MAX = 500;
export const cutDesc = v => String(v == null ? '' : v).slice(0, DESC_MAX);
const faseDescG = f => { const m = St.cfg && St.cfg.metodo; return (m && m.faseDesc && m.faseDesc[f]) || ''; };   // global (Metodología)
export const faseNotaP = (i, f) => (i && i.faseNota && i.faseNota[f]) || '';                                           // nota del proyecto
export const faseDescDe = (i, f) => [faseDescG(f), faseNotaP(i, f)].filter(Boolean).join(' · ');                       // combinada
export const subDescDe = s => (s && s.desc) || '';
export const hitoDescDe = (i, h) => { const sf = h && h.subfase && subfasesDe(i).find(x => x.id === h.subfase); return [h && h.desc, sf && sf.desc].filter(Boolean).join(' · '); };
const descTip = t => t ? ' title="' + esc((0, ENLACES.cut)(t, 300)) + '"' : '';
export const descIco = t => t ? ` <span class="desc-ic"${descTip(t)}>${icon('info', 12)}</span>` : '';
function faseNotaForm(i, fase) {
  if (!i) return; const FS = fasesDe(i);
  openForm({ iniId: i.id, title: 'Nota de fase · ' + i.titulo, values: { fase: FS.includes(fase) ? fase : i.fase, nota: faseNotaP(i, fase) },
    fields: [{ k: 'fase', l: 'Fase', t: 'select', req: true, w: 3, opts: FS },
      { k: 'nota', l: 'Nota de esta fase en este proyecto', t: 'textarea', w: 3, rows: 4, hint: 'Opcional. Complementa la descripción global de la fase (Administración → Metodología). Se ve en Mi cocina, la ficha y Fases.' }],
    extra: (f => f ? '<p class="mut" style="font-size:12px;margin:10px 0 0">Descripción global de «' + esc(FS.includes(fase) ? fase : i.fase) + '»: ' + esc(f) + '</p>' : '')(faseDescG(FS.includes(fase) ? fase : i.fase)),
    saveLabel: 'Guardar',
    onSave(o) { return cmdServidor('apih_nota_fase', { p_ini: i.id, p_fase: o.fase, p_nota: o.nota || '' }, 'Nota guardada', true).then(r => r !== null); } });
  const sel = $('#f_fase'), ta = $('#f_nota');   /* N-U-05: al cambiar la fase se carga la nota de esa fase (no se pisa la de otra) */
  if (sel && ta) sel.addEventListener('change', () => { ta.value = faseNotaP(i, sel.value) || ''; const ex = $('#mform') && $('#mform').parentNode.querySelector('p.mut'); if (ex) { const f = faseDescG(sel.value); ex.textContent = f ? 'Descripción global de «' + sel.value + '»: ' + f : ''; } });
}
Acts.fnota = d => faseNotaForm(byId(d.id), d.f);
