import { ENLACES } from './00-registro.js';
import { $, $$, ACUERDOS, BIT_C, BIT_TIPOS, DECS, DEC_C, DEC_ICON, DEC_TIPOS, DIAS, ESTADOS, ESTADOS_PRJ, ESTADOS_PROP, FASES, FASES_ACT, FASES_PIPE, FASES_PRJ, FASES_PROP, FASE_COLOR, FL, HITOS, MES3, MESES, PLAN_TIPOS, PRIOS, RAGS, RAG_C, RIESGOS, RISK_CATS, RISK_ESTADOS, St, _nrm, addD, atrasado, avatar, avg, by, byId, clone, critScore, desv, diffD, esProp, esSB, esc, esperado, expo, fasesDe, fmtBig, fmtD, fmtDL, fmtMon, fmtN, fmtTot, forecast, compuertas, hitoCats, hitoEstado, hitosDe, hoy, icon, inArea, iniHead, isActive, isDone, isLive, kpis, log, miUsuario, monKeys, monMain, monOf, nameOf, nivelRiesgo, pD, pad, pct, pctMon, personProjects, planSeg, planTipo, porTipo, quarter, rel, respItem, respSel, restTxt, riesgoAbierto, riesgoCritico, riesgosCriticos, riesgosDe, roiTxt, save, scope, scopeAll, scopeP, scopeTT, sum, sumM, tipoLbl, tipoPF, toISO, uid, uniq } from './01-nucleo.js';
import { Acts, Chg, F, Modal, UI, Views, avFase, avFaseTip, btn, kv, confirmBox, copyText, decForm, download, empty, estPill, estTag, fasePill, go, hbars, iniLink, iniOpts, iniOptsF, openForm, pageHead, people, prioPill, prog, ragPill, refresh, render, selOpts, selectEntity, stackBar, syncPop, tipoPill, toCSV, toast } from './03-interfaz.js';
import { diasEnFase, myWork, nextHito, priorScore, semFase } from './04-flujos.js';
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
    return pageHead('Dashboard ejecutivo', `Portafolio TI Operaciones · ${esc(St.cfg.areaGlobal === 'Todas' ? 'Todas las áreas' : St.cfg.areaGlobal)} · al ${fmtDL(hoy())}`, btn('Presentación ejecutiva', 'go', { d: { v: 'presentaciones' }, ic: 'slides' }) + btn('Análisis', 'go', { d: { v: 'analisis' }, ic: 'spark', cls: 'pri' })) + `
    ${(() => { const nDec = DECS().filter(d => d.estado === 'Pendiente').length, nRojo = live.filter(i => i.rag === 'Rojo').length; if (!nDec && !hv && !nRojo) return ''; const go = nDec ? ['decisiones', 'Resolver decisiones →'] : hv ? ['hitos', 'Revisar hitos vencidos →'] : ['portfolio', 'Ver proyectos en rojo →']; return `<div class="foco" role="status"><b>Requiere tu atención hoy</b>${nDec ? `<span class="foco-c">${nDec} decisión${nDec === 1 ? '' : 'es'} pendiente${nDec === 1 ? '' : 's'}</span>` : ''}${hv ? `<span class="foco-c r">${hv} hito${hv === 1 ? '' : 's'} vencido${hv === 1 ? '' : 's'}</span>` : ''}${nRojo ? `<span class="foco-c r">${nRojo} proyecto${nRojo === 1 ? '' : 's'} en rojo</span>` : ''}<span style="flex:1"></span><button class="btn pri" data-act="go" data-v="${go[0]}">${go[1]}</button></div>`; })()}
    <section class="kpis" aria-label="Indicadores clave">
      ${kp('', 'play', 'Proyectos Activos', K.activos, `${K.total} proyectos · ${K.cerradas} completados`, stackBar(FASES_ACT.map(f => ({ l: f, v: L.filter(i => i.fase === f && isActive(i)).length, c: FASE_COLOR[f] })), 6), 'proyectos')}
      ${kp(K.atrasados ? 'bad' : 'good', 'clock', 'Atrasados', K.atrasados, K.atrasados ? `${Math.round(K.atrasados / Math.max(1, K.activos) * 100)}% de los activos · desv. &gt; ${(0, ENLACES.cfgMi)('tolDesv')} d` : (hv ? `Proyectos sin desvío, pero ${hv} ${hv === 1 ? 'hito vencido' : 'hitos vencidos'}` : 'Sin desviaciones relevantes'), '', 'gantt')}
      ${kp(K.riesgosCrit ? 'bad' : 'good', 'shield', 'Riesgos Críticos', K.riesgosCrit, `Exposición ≥ ${(0, ENLACES.cfgMi)('umbralCritico')} · ${RIESGOS().filter(riesgoAbierto).length} riesgos abiertos`, '', 'riesgos')}
      ${kp(K.ontrackPct >= 60 ? 'good' : K.ontrackPct >= 35 ? 'warn' : 'bad', 'check', '% On Track', pct(K.ontrackPct), `${K.ontrack} de ${K.activos} activos en verde y a tiempo`, prog(K.ontrackPct, K.ontrackPct >= 60 ? 'Verde' : K.ontrackPct >= 35 ? 'Ámbar' : 'Rojo', 6), 'portfolio')}
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
function pcols() { const f = F('portfolio', {}); f.tipo = tipoPF(); const T = f.tipo; return PCOLS.filter(c => ((0, ENLACES.modoUI)() === 'simple' && !UI.sx ? ENLACES.COLS_SIMPLE.includes(c.k) : f.cols.includes(c.k)) && (c.t === 'a' ? T === 'Todo' : c.t === 'j' ? T !== 'Propuesta' : c.t === 'p' ? T !== 'Proyecto' : true)); }
const PCELL = (c, i) => ((c.t === 'j' && esProp(i)) || (c.t === 'p' && !esProp(i))) ? '<span class="mut">—</span>' : c.r(i);
const GROUPS = { '': 'Sin agrupar', area: 'Área', fase: 'Fase', rag: 'RAG', lider: 'Responsable', prioridad: 'Prioridad', categoria: 'Categoría', estado: 'Estado' };
function portfolioRows() {
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
Chg.flt = el => { const f = F(el.dataset.v, {}); f[el.dataset.f] = el.dataset.bool ? el.checked : el.value; render(); };
Chg.pcol = el => { const f = F('portfolio', {}); f.cols = PCOLS.map(c => c.k).filter(k => k === el.dataset.k ? el.checked : f.cols.includes(k)); render(); UI.pop = null; const p = $('#pop-cols'); if (p) { p.classList.add('open'); UI.pop = 'pop-cols'; } };
Acts.psort = d => { const f = F('portfolio', {}); if (f.sort === d.k) f.dir = -f.dir; else { f.sort = d.k; f.dir = 1; } render(); };
Acts.pgrp = d => { const f = F('portfolio', {}); f.col = f.col || {}; f.col[d.g] = !f.col[d.g]; render(); };
Acts.pclear = () => { Object.assign(F('portfolio', {}), { q: '', fase: '', estado: '', rag: '', prio: '', resp: '', area: '', tini: '' }); render(); };
Acts.pfadv = () => { UI.pfAdv = !UI.pfAdv; render(); };

Acts.pdens = () => { const f = F('portfolio', {}); f.dens = f.dens === 'c' ? 'n' : 'c'; render(); };
Acts.pcsv = () => { const f = F('portfolio', {}); const rows = portfolioRows(); const cols = pcols(); download('APIH_portfolio_' + hoy() + '.csv', toCSV(rows, cols.map(c => ({ h: c.h, f: c.f }))), 'text/csv'); toast(rows.length + ' filas exportadas'); };

/* ======================= INICIATIVAS ======================= */
const planFase = i => { const hs = hitosDe(i.id).filter(h => h.fase === i.fase); return hs.length ? hs.filter(h => h.fecha <= hoy()).length / hs.length * 100 : esperado(i); };
const clamp100 = v => Math.max(0, Math.min(100, Math.round(v || 0)));
function pvRow(l, real, plan, rag, tip, cls) {
  const r = clamp100(real), pl = clamp100(plan), d = r - pl, c = d <= -10 ? 'neg' : d >= 5 ? 'pos' : 'eq', col = RAG_C[rag] || 'var(--pri)';
  return `<div class="pv ${cls}" title="${esc(tip)}"><span>${l}</span><span class="bar" role="img" aria-label="${esc(tip)}"><i style="width:${r}%;background:${col}"></i><u style="left:calc(${pl}% - 1px)"></u></span><span class="val"><b>${r}%</b><span class="dl ${c}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '● plan'}</span></span></div>`;
}
const planBars = i => `<div class="pvs">${pvRow('Total', i.avance, esperado(i), i.rag, 'Total: real ' + clamp100(i.avance) + '% · plan ' + clamp100(esperado(i)) + '% (según fechas del proyecto)', 'main')}${pvRow('Fase', avFase(i).v, planFase(i), i.rag, avFaseTip(i) + ' · real ' + avFase(i).v + '% · plan ' + clamp100(planFase(i)) + '% (hitos con fecha vencida)', 'sub')}</div>`;
function starsCnt(i) {
  if (!(0, ENLACES.cieloOn)() || esProp(i)) return '';
  const act = isLive(i) && FASES_ACT.includes(i.fase), n = (0, ENLACES.msN)(i); if (!act && !n) return '';
  const st = act ? (0, ENLACES.starsOf)(i, (0, ENLACES.hoyW)()).filter(x => x.s !== 'na') : [], on = st.filter(x => x.s === 'on').length;
  return `<span class="sk-cnt" title="Tenedores de la semana: ${on} de ${st.length}${n ? ' · ' + n + ' estrella(s) Michelin' : ''}">${act ? (0, ENLACES.STAR_SVG)('on', 12) + ' ' + on + '/' + st.length : ''}${n ? ' ★' + n : ''}</span>`;
}
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
      <div class="seg" style="margin-left:auto"><button class="${f.mode === 'board' ? 'on' : ''}" data-act="imode" data-m="board" title="Columnas por fase" aria-label="Tablero por fase">${icon('board', 14)}</button><button class="${f.mode === 'cards' ? 'on' : ''}" data-act="imode" data-m="cards" title="Tarjetas" aria-label="Tarjetas">${icon('list2', 14)}</button></div></div>${body}`;
  },
  after() { bindDnD(); }
};
Acts.imode = d => { F('prj', {}).mode = d.m; render(); };
function bindDnD() {
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
const FZ_TABS = [['gantt', 'Gantt por fases'], ['linea', 'Línea de fases'], ['tablero', 'Tablero'], ['riesgos', 'Riesgos en el tiempo']];
const fzd = s => s ? s.slice(8, 10) + '-' + s.slice(5, 7) + (s.slice(0, 4) !== hoy().slice(0, 4) ? '-' + s.slice(2, 4) : '') : '—';   /* N-U-20: año visible si no es el actual */
const fzTx = c => c === '#F2A100' ? 'var(--fzamb,#8A6100)' : c;   // N-V-02: ámbar legible en tema oscuro                       // texto legible sobre blanco
const fzOn = c => c === '#F2A100' ? '#201F1E' : '#fff';                  // texto sobre fondo de color
/* Ventana de cada fase: desde el día siguiente al fin de la anterior (la 1ª desde inicioPlan) hasta su último hito (la última hasta finPlan si no tiene hitos) */
export const fasesFechasDe = i => (i && i.fasesFechas && typeof i.fasesFechas === 'object' && !Array.isArray(i.fasesFechas) ? i.fasesFechas : {});
const fechaFase = x => !!(x && typeof x.ini === 'string' && typeof x.fin === 'string' && x.ini && x.fin && x.fin >= x.ini);
export function fasesVentana(i) {
  const FS = fasesDe(i), hs = hitosDe(i.id), FF = fasesFechasDe(i); let prev = null;
  return FS.map((f, k) => {
    const h = hs.filter(x => x.fase === f).sort(by('fecha'));
    let ini = k === 0 ? (i.inicioPlan || (esProp(i) && i.creada) || (h[0] && h[0].fecha) || null) : (prev ? addD(prev, 1) : ((h[0] && h[0].fecha) || null));
    let fin = h.length ? h[h.length - 1].fecha : (k === FS.length - 1 ? (i.finPlan || ini) : ini);
    if (ini && fin && fin < ini) fin = ini; if (!ini) ini = fin;
    if (fechaFase(FF[f])) { ini = FF[f].ini; fin = FF[f].fin; }   /* V23: la fecha explícita de la fase manda sobre la derivada de los hitos */
    if (fin) prev = fin;
    return { fase: f, k, ini, fin, explicita: fechaFase(FF[f]), hitos: h, subs: subfasesDe(i).filter(s => s.fase === f).sort(by('inicio')), done: h.filter(x => x.completado).length, color: FASE_COLOR[f] || '#605E5C', actual: i.fase === f, pasada: FS.indexOf(i.fase) > k };
  });
}
const fzRiesgosFase = (i, v) => riesgosDe(i.id).filter(r => riesgoAbierto(r) && r.fRev && v.ini && v.fin && r.fRev >= v.ini && r.fRev <= v.fin);
function fzEscala(d0, d1In, W) { const d1 = diffD(d1In, d0) > 3650 ? addD(d0, 3650) : d1In;   // N-S-03: escala acotada a 10 años; fechas extremas (año 9999) colgaban la vista
  const days = Math.max(1, diffD(d1, d0) + 1), ppd = W / days, x = s => Math.min(W, Math.max(0, diffD(s, d0) * ppd)), ticks = [];
  if (days <= 130) { let d = d0; while (pD(d).getDay() !== 1) d = addD(d, 1); for (; d <= d1; d = addD(d, 7)) ticks.push({ x: x(d), t: +d.slice(8) + ' ' + MES3[+d.slice(5, 7) - 1].toLowerCase() }); }
  else { let d = d0.slice(0, 8) + '01'; if (d < d0) d = toISO(new Date(+d0.slice(0, 4), +d0.slice(5, 7), 1, 12)); for (; d <= d1; d = toISO(new Date(+d.slice(0, 4), +d.slice(5, 7), 1, 12))) ticks.push({ x: x(d), t: MES3[+d.slice(5, 7) - 1] + ' ' + d.slice(2, 4) }); }
  return { x, ppd, ticks, W, d0, d1 };
}
const fzGrid = (E, head) => E.ticks.map(t => `<i class="fz-wk" style="left:${t.x}px">${head ? esc(t.t) : ''}</i>`).join('') + (hoy() >= E.d0 && hoy() <= E.d1 ? `<i class="fz-hoy" style="left:${E.x(hoy())}px"></i>` : '');
const fzHito = (E, h) => { const e = hitoEstado(h); return `<i class="fz-h ${h.completado ? 'done' : e.k === 'over' ? 'over' : ''}" style="left:${E.x(h.fecha) - 6}px" title="${esc(h.nombre + ' · ' + fzd(h.fecha) + ' · ' + e.t + (h.resp ? ' · ' + h.resp : ''))}"></i>`; };
const fzRsk = (E, r) => { const n = nivelRiesgo(r); return `<i class="fz-r" style="left:${E.x(r.fRev) - 6}px;--c:${n.c}" title="${esc(r.desc + ' · ' + n.n + ' (' + expo(r) + ') · revisión ' + fzd(r.fRev))}"></i>`; };

/* ======================= V22.55 · Subfases por proyecto (ADR-012) =======================
   Una subfase pertenece a UNA fase obligatoria del proyecto. Nace con el inicio y fin de esa fase (los hereda si se dejan vacíos)
   y no puede extenderse fuera de ella. Se guarda dentro de la iniciativa (i.subfases); el hito la referencia con h.subfase. */
export const subfasesDe = i => (i && Array.isArray(i.subfases) ? i.subfases : []);
export const ventanaDe = (i, f) => fasesVentana(i).find(v => v.fase === f) || null;
export const rangoTx = (a, b) => fzd(a) + ' → ' + fzd(b);

/* ======================= V23 · Avance calculado (una sola fuente) =======================
   Avance de una fase = promedio de sus unidades: cada subfase (hitos cerrados / hitos de la subfase) y cada hito suelto (0 ó 1).
   Una fase sin unidades vale 100 % si ya quedó atrás y 0 % si es la actual o una futura.
   Avance total = promedio de las fases ponderado por sus días (si TODAS tienen fechas explícitas; si no, peso igual).
   i.avanceManual (0-100) es un ajuste explícito: manda sobre el calculado, pero las compuertas SIEMPRE leen el calculado. */
export function avanceFaseCalc(i, f) {
  const hs = hitosDe(i.id).filter(h => h.fase === f), subs = subfasesDe(i).filter(s => s.fase === f), ids = new Set(subs.map(s => s.id)), u = [];
  subs.forEach(s => { const x = hs.filter(h => h.subfase === s.id); u.push(x.length ? x.filter(h => h.completado).length / x.length : 0); });
  hs.filter(h => !ids.has(h.subfase)).forEach(h => u.push(h.completado ? 1 : 0));
  return u.length ? u.reduce((a, b) => a + b, 0) / u.length : null;
}
export function avanceCalc(i) {
  if (!i || esProp(i)) return 0;
  const FS = fasesDe(i), idx = FS.indexOf(i.fase), FF = fasesFechasDe(i), pesar = FS.every(f => fechaFase(FF[f]));
  let w = 0, s = 0;
  FS.forEach((f, k) => { const peso = pesar ? Math.max(1, diffD(FF[f].fin, FF[f].ini) + 1) : 1; let p = avanceFaseCalc(i, f); if (p == null) p = k < idx ? 1 : 0; w += peso; s += peso * p; });
  return w ? Math.round(s / w * 100) : 0;
}
export const avanceManualDe = i => { const m = i && i.avanceManual; return m === null || m === undefined || m === '' || !isFinite(+m) ? null : Math.max(0, Math.min(100, Math.round(+m))); };
export const avanceEf = i => { const m = avanceManualDe(i); return m != null ? m : avanceCalc(i); };
/* Deja i.avance (lo que ven listas, KPIs y reportes) igual al avance efectivo. Un proyecto anterior a V23 conserva su número como ajuste manual (no se pisa). */
export function sincAvance(i) {
  if (!i || esProp(i)) return;
  const c = avanceCalc(i);
  if (i.avanceCalc === undefined && avanceManualDe(i) == null && Math.round(+i.avance || 0) > 0 && Math.round(+i.avance) !== c) i.avanceManual = Math.round(+i.avance);
  if (i.estado === 'Completado') { i.avance = 100; i.avanceCalc = c; return; }
  const ef = avanceManualDe(i) != null ? avanceManualDe(i) : c;
  if (Math.round(+i.avance || 0) !== ef || !(i.hist || []).length) { i.hist = i.hist || []; const h = i.hist[i.hist.length - 1]; if (h && h[0] === hoy()) h[1] = ef; else i.hist.push([hoy(), ef]); }
  i.avance = ef; i.avanceCalc = c;
}

/* ======================= V23 · Fechas de fase explícitas =======================
   El proyecto guarda inicio y fin de CADA fase (i.fasesFechas). inicioPlan y finPlan del proyecto son el rango de esas fases:
   nadie los escribe por separado. Los hitos y las subfases viven dentro de su fase (los que quedan fuera se marcan como alerta). */
const PESO_FASES = [15, 55, 15, 15];   // porcentajes enteros: así el redondeo es idéntico en la base de datos   // reparto inicial de un rango entre las 4 fases del proyecto (editable después)
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export function distribuirFases(i, ini, fin) {
  const FS = fasesDe(i); if (!FECHA_ISO.test(ini || '') || !FECHA_ISO.test(fin || '') || fin < ini) return null;
  const T = diffD(fin, ini) + 1, est4 = FS.length === PESO_FASES.length, out = {}; let c = ini;
  FS.forEach((f, k) => { const last = k === FS.length - 1, d = last ? T - diffD(c, ini) : Math.max(1, Math.round(est4 ? T * PESO_FASES[k] / 100 : T / FS.length)), e = last ? fin : addD(c, d - 1); out[f] = { ini: c, fin: e < c ? c : e }; c = addD(out[f].fin, 1); });
  return out;
}
export const rangoFases = FF => { const v = Object.values(FF || {}).filter(fechaFase); return v.length ? { ini: v.reduce((a, x) => x.ini < a ? x.ini : a, v[0].ini), fin: v.reduce((a, x) => x.fin > a ? x.fin : a, v[0].fin) } : null; };
/* Valida el conjunto de fechas por fase. Devuelve '' si es válido o el motivo. */
export function validarFasesFechas(i, FF) {
  const FS = fasesDe(i); let prev = null;
  for (const f of FS) {
    const x = FF[f]; if (!x || !FECHA_ISO.test(x.ini || '') || !FECHA_ISO.test(x.fin || '')) return 'La fase ' + f + ' necesita inicio y fin';
    if (x.fin < x.ini) return 'En ' + f + ' el fin no puede ser anterior al inicio';
    if (prev && x.ini <= prev.fin) return 'La fase ' + f + ' debe empezar después de que termine ' + prev.f + ' (' + fzd(prev.fin) + ')';
    prev = { f, fin: x.fin };
  }
  for (const s of subfasesDe(i)) { const w = FF[s.fase]; if (w && (s.inicio < w.ini || s.fin > w.fin)) return 'La subfase «' + s.nombre + '» quedaría fuera de ' + s.fase + ' (' + rangoTx(w.ini, w.fin) + '): ajústala primero'; }
  return '';
}
/* Fija las fechas de fase, deriva inicioPlan/finPlan y recalcula el avance. Devuelve el motivo si no se puede. */
export function aplicarFasesFechas(i, FF) {
  const e = validarFasesFechas(i, FF); if (e) return e;
  const limpio = {}; fasesDe(i).forEach(f => { limpio[f] = { ini: FF[f].ini, fin: FF[f].fin }; });
  i.fasesFechas = limpio; const r = rangoFases(limpio); i.inicioPlan = r.ini; i.finPlan = r.fin; sincAvance(i); return '';
}
/* Convierte en explícitas las fechas que hoy se derivan de los hitos (proyectos anteriores a V23). null si no hay de dónde sacarlas. */
export function fasesMaterializadas(i) {
  const V = fasesVentana(i), FF = {}; let ok = true; V.forEach(v => { if (v.ini && v.fin) FF[v.fase] = { ini: v.ini, fin: v.fin }; else ok = false; });
  if (!ok) { const d = distribuirFases(i, i.inicioPlan, i.finPlan); return d; }
  let prev = null; V.forEach(v => { if (prev && FF[v.fase].ini <= prev) FF[v.fase].ini = addD(prev, 1); if (FF[v.fase].fin < FF[v.fase].ini) FF[v.fase].fin = FF[v.fase].ini; prev = FF[v.fase].fin; });
  return FF;
}
/* Único camino para cambiar el rango plan (alta, importaciones, cambio aprobado): reparte o reescala las fases y deriva inicioPlan/finPlan. */
export function setRangoPlan(i, ini, fin) {
  if (esProp(i)) { i.inicioPlan = ini || null; i.finPlan = fin || null; return ''; }
  if (!FECHA_ISO.test(ini || '') || !FECHA_ISO.test(fin || '') || fin < ini) { i.inicioPlan = ini || null; i.finPlan = fin || null; return ''; }
  const FS = fasesDe(i), cur = FS.every(f => fechaFase(fasesFechasDe(i)[f])) ? fasesFechasDe(i) : null, r0 = cur && rangoFases(cur);
  let FF;
  if (cur && r0 && diffD(r0.fin, r0.ini) > 0) {
    const span0 = diffD(r0.fin, r0.ini), span1 = diffD(fin, ini), m = d => addD(ini, Math.round(diffD(d, r0.ini) * span1 / span0)); FF = {}; let prev = null;
    FS.forEach(f => { let a = m(cur[f].ini), b = m(cur[f].fin); if (prev && a <= prev) a = addD(prev, 1); if (b < a) b = a; FF[f] = { ini: a, fin: b }; prev = b; });
    FF[FS[0]].ini = ini; FF[FS[FS.length - 1]].fin = fin < FF[FS[FS.length - 1]].ini ? FF[FS[FS.length - 1]].ini : fin;
  } else FF = distribuirFases(i, ini, fin);
  if (!FF) return 'No se pudo repartir el rango entre las fases';
  subfasesDe(i).forEach(s => { const w = FF[s.fase]; if (!w) return; if (s.inicio < w.ini || s.fin > w.fin) { s.inicio = s.inicio < w.ini ? w.ini : s.inicio > w.fin ? w.ini : s.inicio; s.fin = s.fin > w.fin ? w.fin : s.fin < s.inicio ? s.inicio : s.fin; if (s.fin < s.inicio) { s.inicio = w.ini; s.fin = w.fin; } } });
  i.fasesFechas = FF; const r = rangoFases(FF); i.inicioPlan = r.ini; i.finPlan = r.fin; sincAvance(i); return '';
}
/* Un cambio aprobado de fecha fin mueve el fin de la ÚLTIMA fase (las anteriores no se tocan); si queda antes de su inicio, se reescala todo. */
export function moverFinPlan(i, fin) {
  if (esProp(i)) { i.finPlan = fin; return ''; }
  const FS = fasesDe(i), FF = fasesFechasDe(i), l = FS[FS.length - 1];
  if (FS.every(f => fechaFase(FF[f])) && fin >= FF[l].ini) { const n = {}; FS.forEach(f => { n[f] = { ini: FF[f].ini, fin: FF[f].fin }; }); n[l].fin = fin; return aplicarFasesFechas(i, n); }
  return setRangoPlan(i, i.inicioPlan, fin);
}
/* Tras cualquier cambio: los proyectos que ya usan el avance calculado y que el usuario puede editar se mantienen al día (hitos, subfases, fechas). */
export function reconciliarAvance() { St.ini.forEach(i => { if (!esProp(i) && !isDone(i) && (0, ENLACES.puedeEditarIni)(i) && (i.avanceCalc === undefined || avanceCalc(i) !== i.avanceCalc)) sincAvance(i);   /* incluye proyectos anteriores a V23: su % pasa a ajuste manual y todas las vistas coinciden */ }); }
/* hitos de la fase cuya fecha cae fuera de ella (alerta, no bloqueo) */
export const hitosFuera = (i, v) => (v && v.ini && v.fin ? v.hitos.filter(h => h.fecha && (h.fecha < v.ini || h.fecha > v.fin)) : []);
const subFuera = (s, v) => !v || !v.ini || !v.fin || s.inicio < v.ini || s.fin > v.fin;
export const hitosSub = (i, s) => hitosDe(i.id).filter(h => h.subfase === s.id);
function subActual(i) { const v = ventanaDe(i, i.fase), H = hoy(); return v ? v.subs.find(s => s.inicio <= H && s.fin >= H) || null : null; }
/* La fase de un proyecto se muestra siempre con su inicio y fin (y la subfase en curso, si la hay) */
/* V22.61 · Descripción / instrucciones por objeto (fase global + nota por proyecto, subfase, hito). Se ven sobre todo en Mi cocina. */
export const DESC_MAX = 500;
export const cutDesc = v => String(v == null ? '' : v).slice(0, DESC_MAX);
const faseDescG = f => { const m = St.cfg && St.cfg.metodo; return (m && m.faseDesc && m.faseDesc[f]) || ''; };   // global (Metodología)
export const faseNotaP = (i, f) => (i && i.faseNota && i.faseNota[f]) || '';                                           // nota del proyecto
const faseDescDe = (i, f) => [faseDescG(f), faseNotaP(i, f)].filter(Boolean).join(' · ');                       // combinada
const subDescDe = s => (s && s.desc) || '';
const hitoDescDe = (i, h) => { const sf = h && h.subfase && subfasesDe(i).find(x => x.id === h.subfase); return [h && h.desc, sf && sf.desc].filter(Boolean).join(' · '); };
const descTip = t => t ? ' title="' + esc((0, ENLACES.cut)(t, 300)) + '"' : '';
const descIco = t => t ? ` <span class="desc-ic"${descTip(t)}>${icon('info', 12)}</span>` : '';
function faseNotaForm(i, fase) {
  if (!i) return; const FS = fasesDe(i);
  openForm({ iniId: i.id, title: 'Nota de fase · ' + i.titulo, values: { fase: FS.includes(fase) ? fase : i.fase, nota: faseNotaP(i, fase) },
    fields: [{ k: 'fase', l: 'Fase', t: 'select', req: true, w: 3, opts: FS },
      { k: 'nota', l: 'Nota de esta fase en este proyecto', t: 'textarea', w: 3, rows: 4, hint: 'Opcional. Complementa la descripción global de la fase (Administración → Metodología). Se ve en Mi cocina, la ficha y Fases.' }],
    extra: (f => f ? '<p class="mut" style="font-size:12px;margin:10px 0 0">Descripción global de «' + esc(FS.includes(fase) ? fase : i.fase) + '»: ' + esc(f) + '</p>' : '')(faseDescG(FS.includes(fase) ? fase : i.fase)),
    saveLabel: 'Guardar',
    onSave(o) { if ((o.nota || '').length > DESC_MAX) { toast('La nota no puede superar ' + DESC_MAX + ' caracteres', 'err'); return false; }
      i.faseNota = Object.assign({}, i.faseNota); if (String(o.nota || '').trim()) i.faseNota[o.fase] = cutDesc(o.nota.trim()); else delete i.faseNota[o.fase];
      i.actualizada = hoy(); log('Cambio', i.id, 'Nota de fase ' + o.fase + (String(o.nota || '').trim() ? ' actualizada' : ' eliminada')); toast('Nota guardada'); refresh(); } });
  const sel = $('#f_fase'), ta = $('#f_nota');   /* N-U-05: al cambiar la fase se carga la nota de esa fase (no se pisa la de otra) */
  if (sel && ta) sel.addEventListener('change', () => { ta.value = faseNotaP(i, sel.value) || ''; const ex = $('#mform') && $('#mform').parentNode.querySelector('p.mut'); if (ex) { const f = faseDescG(sel.value); ex.textContent = f ? 'Descripción global de «' + sel.value + '»: ' + f : ''; } });
}
Acts.fnota = d => faseNotaForm(byId(d.id), d.f);

/* ======================= V23 · Tarjeta y panel complementarios =======================
   Tarjeta: ¿dónde está y cómo va?  Panel: ¿por qué está así y qué sigue?  (señales, próximos hitos y pendientes con otras personas) */
export function senalesIni(i) {
  const out = [], H = hoy(), um = +(0, ENLACES.cfgI)(i, 'umbralCritico') || 15, hs = hitosDe(i.id), ven = hs.filter(h => !h.completado && h.fecha && h.fecha < H).sort(by('fecha'));
  const dv = desv(i); if (dv > 0) out.push({ bad: true, t: 'Atrasado ' + dv + ' d.', d: 'Termina el ' + fmtD(forecast(i)) + '; el plan decía ' + fmtD(i.finPlan) + '.' });
  if (ven.length) out.push({ bad: true, t: ven.length + (ven.length === 1 ? ' hito vencido:' : ' hitos vencidos:'), d: ven.slice(0, 2).map(h => h.nombre + ' (' + diffD(H, h.fecha) + ' d)').join(', ') + (ven.length > 2 ? ' y ' + (ven.length - 2) + ' más.' : '.') });
  const rk = riesgosDe(i.id).filter(r => riesgoCritico(r) && !String(r.mit || '').trim());
  if (rk.length) out.push({ bad: true, t: rk.length + (rk.length === 1 ? ' riesgo crítico sin mitigación:' : ' riesgos críticos sin mitigación:'), d: String(rk[0].desc || rk[0].id).slice(0, 60) + (rk.length > 1 ? ' y ' + (rk.length - 1) + ' más.' : '.') });
  const pres = +i.presupuesto || 0, gas = i.gastado == null || i.gastado === '' ? null : +i.gastado;
  if (pres > 0 && gas != null && isFinite(gas)) { const gp = Math.round(gas / pres * 100), av = Math.round(+i.avance || 0); out.push(gp > av + 10 ? { bad: true, t: 'Gasto ' + gp + ' %', d: 'con ' + av + ' % de avance.' } : { bad: false, t: 'Gasto ' + gp + ' %', d: 'con ' + av + ' % de avance.' }); }
  if (!out.some(x => x.bad)) out.unshift({ bad: false, t: 'Sin señales de alerta.', d: '' });
  return out;
}
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
    onDanger: () => confirmBox('¿Eliminar esta subfase? Sus hitos quedarán sin subfase.', () => { const hs = hitosSub(i, s); i.subfases = subfasesDe(i).filter(x => x.id !== s.id); hs.forEach(h => { delete h.subfase; }); i.actualizada = hoy(); log('Cambio', i.id, 'Subfase eliminada: ' + s.nombre + ' (' + s.fase + ')' + (hs.length ? ' · ' + hs.length + ' hitos quedan sin subfase' : '')); toast('Subfase eliminada'); refresh(); }, 'Eliminar', true),
    onSave(o) {
      const w = ventanaDe(i, o.fase);
      if (!w || !w.ini || !w.fin) { toast('La fase ' + o.fase + ' no tiene inicio y fin: define las fechas plan del proyecto', 'err'); return false; }
      if (nw && o.fase !== f0 && o.inicio === (w0.ini || '') && o.fin === (w0.fin || '')) { o.inicio = ''; o.fin = ''; }   // cambió de fase sin tocar las fechas: hereda las de la nueva fase
      if (!o.inicio) o.inicio = w.ini; if (!o.fin) o.fin = w.fin;
      if (o.nombre.length > 120 || (o.resp || '').length > 120) { toast('Nombre y responsable: hasta 120 caracteres', 'err'); return false; }
      if ((o.desc || '').length > DESC_MAX) { toast('La descripción no puede superar ' + DESC_MAX + ' caracteres', 'err'); return false; } if (String(o.desc || '').trim()) o.desc = cutDesc(o.desc.trim()); else delete o.desc;
      if (o.fin < o.inicio) { toast('El fin de la subfase no puede ser anterior a su inicio', 'err'); return false; }
      if (o.inicio < w.ini || o.fin > w.fin) { toast('La subfase debe quedar dentro de ' + o.fase + ' (' + rangoTx(w.ini, w.fin) + ')', 'err'); return false; }
      if (subfasesDe(i).some(x => x.id !== (s && s.id) && x.fase === o.fase && _nrm(x.nombre) === _nrm(o.nombre))) { toast('Ya existe una subfase «' + o.nombre + '» en ' + o.fase, 'err'); return false; }
      if (nw) { i.subfases = subfasesDe(i).concat([{ id: sfNextId(i), ...o }]); log('Cambio', i.id, 'Subfase creada: ' + o.nombre + ' · ' + o.fase + ' · ' + rangoTx(o.inicio, o.fin)); toast('Subfase creada'); }
      else { const cf = s.fase !== o.fase; Object.assign(s, o); if (cf) hitosSub(i, s).forEach(h => { h.fase = o.fase; }); log('Cambio', i.id, 'Subfase actualizada: ' + o.nombre + ' · ' + o.fase + ' · ' + rangoTx(o.inicio, o.fin)); toast('Subfase guardada'); }
      i.actualizada = hoy(); refresh();
    }
  });
}
/* V22.59 · importación de subfases (archivo de iniciativas y «Con archivo»): valida la regla y resuelve referencias por id o nombre */
export function sfImportar(i, lista, warn) {
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
      if (faseAnt !== x.fase) (St.hitos || []).forEach(h => { if (h.ini === i.id && h.subfase === ya.id) { h.fase = x.fase; } }); if (typeof x.desc === 'string') { if (x.desc.trim()) ya.desc = cutDesc(x.desc.trim()); else delete ya.desc; } }
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
/* Importancia 0–100 = base automática (plazo y criticidad, reglas fijas) + ajuste propio guardado por paso */
const SEM_AJ = [[-20, 'Baja'], [0, 'Normal'], [15, 'Alta'], [30, 'Máxima']];
const SEM_CATS = ['Trabajo', 'Desarrollo profesional', 'Personal'];
function pasoBase(p) { const d = p.f ? diffD(hoy(), p.f) : 0; return [75, 50, 25][p.u] + (d > 0 ? 8 + Math.min(7, d) : Math.max(0, 7 + d)) + (/cr[ií]tico|vencido/i.test(p.tipo) ? 10 : 0); }
const pasoAj = p => { const v = +(semOf().aj || {})[p.k] || 0; return SEM_AJ.some(a => a[0] === v) ? v : 0; };
const pasoPts = p => Math.max(0, Math.min(100, pasoBase(p) + pasoAj(p)));
/* Pendientes personales: viven aparte del portafolio (sin tenedores, sin reportes, sin presentaciones) */
function tareasPasos() { const H = hoy(); return (semOf().t || []).filter(t => !t.hecha).map(t => ({ k: 'T:' + t.id, u: t.f ? (t.f <= H ? 0 : diffD(t.f, H) <= 7 ? 1 : 2) : 2, tipo: t.cat, t: t.t, por: t.f ? (t.f < H ? 'Venció el ' : 'Fecha: ') + fzd(t.f) + '.' : 'Sin fecha.', prot: 'Tu lista personal', btn: 'Marcar hecho', act: 'tareahecha', d: { id: t.id }, f: t.f || '9999-12-31', ini: null, tarea: t, nota: '' })); }
/* Pasos sugeridos de una iniciativa. u: 0 hoy · 1 esta semana · 2 próximo. prot: tenedor o compuerta que protege */
export function pasosDe(i) {
  if (!i || isDone(i)) return [];
  const H = hoy(), out = [], add = (k, u, tipo, t, por, prot, btn, act, d, f, nota) => out.push({ k: i.id + ':' + k, u, tipo, t, por, prot, btn, act, d, f: f || H, ini: i, nota: nota || '' });
  const hs = hitosDe(i.id).filter(h => !h.completado).sort(by('fecha'));
  hs.filter(h => h.fecha < H).forEach(h => add('hv' + h.id, 0, 'Hito vencido', 'Cierra o reprograma «' + h.nombre + '»', 'Venció hace ' + diffD(H, h.fecha) + ' d. Mientras siga abierto, el indicador de Hitos queda en rojo.', 'Hitos', 'Editar hito', 'edit', { t: 'hito', id: h.id }, h.fecha, hitoDescDe(i, h)));
  hs.filter(h => h.fecha === H).forEach(h => add('hh' + h.id, 0, 'Hito', 'Marca «' + h.nombre + '» como cumplido', 'Vence hoy.', 'Hitos', 'Marcar cumplido', 'hitotoggle', { id: h.id }, h.fecha, hitoDescDe(i, h)));
  hs.filter(h => h.fecha > H && diffD(h.fecha, H) <= 7).slice(0, 3).forEach(h => add('hs' + h.id, 1, 'Hito', 'Prepara «' + h.nombre + '» (' + fzd(h.fecha) + ')', 'Vence en ' + diffD(h.fecha, H) + ' d' + (h.resp ? ' · ' + h.resp : '') + '.', 'Hitos', 'Ver hito', 'sel', { t: 'hito', id: h.id }, h.fecha, hitoDescDe(i, h)));
  if (FASES_ACT.includes(i.fase) && isLive(i)) { const st = (0, ENLACES.starsOf)(i, (0, ENLACES.hoyW)()), dia = st.find(x => x.k === 'dia'); if (dia && dia.s === 'off') add('dia', pD(H).getDay() >= 5 || pD(H).getDay() === 0 ? 0 : 1, 'Tenedor «Al día»', 'Registra la actualización semanal', dia.tip || 'Sin actualización esta semana: el tenedor «Al día» está apagado.', 'Al día', 'Actualizar', 'wk', { id: i.id }); }
  riesgosDe(i.id).filter(riesgoAbierto).forEach(r => {
    const n = nivelRiesgo(r), crit = riesgoCritico(r);
    if (crit && !String(r.mit || '').trim()) add('rm' + r.id, 0, 'Riesgo crítico', 'Define la mitigación de «' + r.desc + '»', 'Crítico (' + expo(r) + ') sin plan de mitigación: el indicador de Riesgos queda en rojo y se bloquean compuertas.', 'Riesgos', 'Editar riesgo', 'edit', { t: 'risk', id: r.id });
    else if (r.fRev && r.fRev < H) add('rv' + r.id, 0, 'Riesgo', 'Revisa el riesgo «' + r.desc + '»', 'La revisión venció el ' + fzd(r.fRev) + '. Mientras no se revise, el indicador de Riesgos queda en rojo.', 'Riesgos', 'Editar riesgo', 'edit', { t: 'risk', id: r.id }, r.fRev);
    else if (r.fRev && diffD(r.fRev, H) <= 7) add('rs' + r.id, r.fRev === H ? 0 : 1, 'Riesgo ' + n.n.toLowerCase(), 'Prepara la revisión de «' + r.desc + '» (' + fzd(r.fRev) + ')', n.n + ' (' + expo(r) + ')' + (r.mit ? '. Mitigación: ' + (0, ENLACES.cut)(r.mit, 90) : '.'), 'Riesgos', 'Abrir riesgo', 'sel', { t: 'risk', id: r.id }, r.fRev);
  });
  ACUERDOS().filter(c => c.ini === i.id && !['Cumplido', 'Cancelado'].includes(c.estado) && c.limite && diffD(c.limite, H) <= 7).forEach(c => add('c' + c.id, c.limite <= H ? 0 : 1, 'Compromiso', (c.limite < H ? 'Cumple el compromiso vencido «' : 'Cumple «') + (0, ENLACES.cut)(c.texto || c.titulo || 'compromiso', 70) + '»', (c.limite < H ? 'Venció el ' : 'Vence el ') + fzd(c.limite) + (c.resp ? ' · ' + c.resp : '') + '.', 'Compromisos', 'Ver compromisos', 'go', { v: 'compromisos' }, c.limite));
  const FS = fasesDe(i), nx = FS[FS.indexOf(i.fase) + 1];
  if (nx) {
    const g = compuertas(i), falta = g.filter(x => !x.ok), V = fasesVentana(i), v = V.find(x => x.actual), cerca = v && v.fin && diffD(v.fin, H) <= 7;
    if (!falta.length) add('adv', 0, 'Compuerta', 'Avanza a ' + nx, 'Se cumplen todas las condiciones de la compuerta.', 'Compuerta', 'Avanzar', 'advance', { id: i.id }, H, faseDescDe(i, i.fase));
    else falta.filter(x => !/^Hitos de la fase/.test(x.t)).forEach((x, k) => add('g' + k, cerca ? 1 : 2, 'Compuerta', 'Para pasar a ' + nx + ': ' + x.t.charAt(0).toLowerCase() + x.t.slice(1), 'Condición pendiente de la compuerta' + (v && v.fin ? '; la fase ' + i.fase + ' cierra el ' + fzd(v.fin) : '') + '.', 'Compuerta', esProp(i) ? 'Editar propuesta' : 'Editar proyecto', 'edit', { t: 'ini', id: i.id }, H, faseDescDe(i, i.fase)));
  }
  return out.filter(p => !pospOn(p.k)).sort(by(p => p.u + '|' + p.f));
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
Chg.pasoaj = el => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const aj = Object.assign({}, semOf().aj), v = +el.value || 0, k = el.dataset.k; if (!SEM_AJ.some(a => a[0] === v)) return; if (v) aj[k] = v; else delete aj[k]; if (semSet({ aj })) { toast('Importancia ajustada: queda guardada en tu perfil'); refresh(); } };
/* Pendientes personales (clasificados; «Desarrollo profesional» alimenta tu historial) */
function tareaForm(t) {
  const nw = !t, tareas = () => (semOf().t || []);
  openForm({
    title: nw ? 'Nuevo pendiente personal' : 'Editar pendiente', saveLabel: nw ? 'Agregar' : 'Guardar', danger: nw ? null : 'Eliminar', values: t ? clone(t) : { t: '', cat: SEM_CATS[0], f: '' },
    fields: [{ k: 't', l: '¿Qué necesitas hacer?', t: 'textarea', req: true, w: 3 }, { k: 'cat', l: 'Clasificación', t: 'select', opts: SEM_CATS, w: 2 }, { k: 'f', l: 'Fecha (opcional)', t: 'date', w: 1 }],
    onDanger: () => confirmBox('¿Eliminar este pendiente?', () => { if (semSet({ t: tareas().filter(x => x.id !== t.id) })) { toast('Pendiente eliminado'); refresh(); } }, 'Eliminar', true),
    onSave(o) {
      if (o.t.length > 200) { toast('El pendiente admite hasta 200 caracteres', 'err'); return false; }
      if (o.f && (!/^\d{4}-\d{2}-\d{2}$/.test(o.f) || +o.f.slice(0, 4) < 1900 || +o.f.slice(0, 4) > 2100)) { toast('La fecha no es válida', 'err'); return false; }
      if (!SEM_CATS.includes(o.cat)) o.cat = SEM_CATS[0];
      if (nw && tareas().length >= 300) { toast('Llegaste al máximo de 300 pendientes: elimina los que ya no uses', 'err'); return false; }
      const L = tareas().slice();
      if (nw) { const n = L.reduce((m, x) => Math.max(m, +String(x.id).slice(2) || 0), 0) + 1; L.push({ id: 'T-' + n, t: o.t, cat: o.cat, f: o.f || '', creada: hoy(), hecha: '' }); }
      else { const x = L.find(y => y.id === t.id); if (x) { x.t = o.t; x.cat = o.cat; x.f = o.f || ''; } }
      if (!semSet({ t: L })) return false;
      toast(nw ? 'Pendiente agregado a tu lista' : 'Pendiente actualizado'); refresh();
    }
  });
}
Acts.tareanew = () => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); tareaForm(null); };
Acts.tareaedit = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const t = (semOf().t || []).find(x => x.id === d.id); if (t) tareaForm(t); };
Acts.tareahecha = d => { if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar'); const L = (semOf().t || []).map(x => x.id === d.id ? Object.assign({}, x, { hecha: hoy() }) : x); if (semSet({ t: L })) { toast('Pendiente hecho'); refresh(); } };
/* Pestaña «Planificación» de la ficha: fases, cronograma, próximos 14 días y siguientes pasos */
/* avance de una fase para mostrar: la calculada; una fase ya superada sin unidades vale 100 % */
const pctFase = (i, v) => { const p = avanceFaseCalc(i, v.fase); return Math.round((p == null ? (v.pasada ? 1 : 0) : p) * 100); };
/* Tarjeta «Ciclo de vida»: lo que antes estaba repartido entre Fase, Estado, Avance y fechas, en un solo lugar */
function cicloCard(i, V) {
  const PR = esProp(i), fin = isDone(i), c = avanceCalc(i), m = avanceManualDe(i), ef = m != null ? m : c, fx = V.reduce((n, v) => n + hitosFuera(i, v).length, 0), expl = V.every(v => v.explicita);
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
Acts.avauto = d => { const i = byId(d.id); if (!i || esProp(i)) return; if (!(0, ENLACES.puedeEditarIni)(i) || (0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Sin permiso para editar este proyecto'); i.avanceManual = null; sincAvance(i); i.actualizada = hoy(); log('Actualización', i.id, 'Avance: se usa el calculado (' + i.avance + '%)'); toast('Avance calculado: ' + i.avance + '%'); refresh(); };
Acts.fasefix = d => { const i = byId(d.id); if (!i || esProp(i)) return; if (!(0, ENLACES.puedeEditarIni)(i) || (0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Sin permiso para editar este proyecto'); const FF = fasesMaterializadas(i); if (!FF) return toast('Define el inicio y el fin plan (o al menos un hito) para fijar las fases', 'err'); const e = aplicarFasesFechas(i, FF); if (e) return toast(e, 'err'); i.actualizada = hoy(); log('Cambio', i.id, 'Fechas de las fases fijadas: ' + fasesDe(i).map(f => f + ' ' + rangoTx(i.fasesFechas[f].ini, i.fasesFechas[f].fin)).join(' · ')); toast('Fechas de las fases fijadas'); refresh(); };
Acts.fasefechas = d => {
  const i = byId(d.id); if (!i || esProp(i)) return; if (!(0, ENLACES.puedeEditarIni)(i) || (0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Sin permiso para editar este proyecto');
  const V = fasesVentana(i), v = {}, fields = [];
  V.forEach(x => { v['i' + x.k] = x.ini || ''; v['f' + x.k] = x.fin || ''; fields.push({ sec: x.fase }, { k: 'i' + x.k, l: 'Inicio', t: 'date', req: true, w: 1 }, { k: 'f' + x.k, l: 'Fin', t: 'date', req: true, w: 1 }); });
  openForm({ iniId: i.id, title: 'Fechas de las fases · ' + i.titulo, values: v, fields, saveLabel: 'Guardar',
    extra: '<p class="mut" style="font-size:12px;margin:10px 0 0">Cada fase empieza después de que termina la anterior. El inicio plan y el fin plan del proyecto son el inicio de la primera y el fin de la última. Las subfases deben quedar dentro de su fase; los hitos fuera de su fase se marcan como alerta.</p>',
    onSave(o) {
      const FF = {}; V.forEach(x => { FF[x.fase] = { ini: o['i' + x.k], fin: o['f' + x.k] }; });
      const e = aplicarFasesFechas(i, FF); if (e) { toast(e, 'err'); return false; }
      i.actualizada = hoy(); log('Cambio', i.id, 'Fechas de las fases: ' + V.map(x => x.fase + ' ' + rangoTx(FF[x.fase].ini, FF[x.fase].fin)).join(' · ') + ' (plan ' + fmtD(i.inicioPlan) + ' → ' + fmtD(i.finPlan) + ')'); toast('Fechas guardadas'); refresh();
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
Acts.csug = d => { const c = St.comites.find(x => x.id === d.id), i = byId(d.ini); c.temas.push({ t: (esProp(i) ? 'Decidir: ' : 'Seguimiento: ') + i.titulo, ini: i.id, notas: '' }); refresh(); };
Acts.csel = d => { F('comite', {}).sel = d.id; render(); };
Chg.catt = el => { const c = St.comites.find(x => x.id === el.dataset.c); c.participantes[+el.dataset.k].asistio = el.checked; refresh(); };
Chg.ctoggle = el => { const c = St.comites.find(x => x.id === el.dataset.c), a = c[el.dataset.k].find(x => x.id === el.dataset.id); const k = el.dataset.k; a.estado = el.checked ? (k === 'acciones' ? 'Cerrada' : 'Cumplido') : (k === 'acciones' ? 'Abierta' : 'Abierto'); log('Actualización', a.ini, (k === 'acciones' ? 'Acción ' : 'Compromiso ') + (el.checked ? 'cumplido/a: ' : 'reabierto/a: ') + a.texto); refresh(); };
Acts.cdel = d => { const c = St.comites.find(x => x.id === d.c); if (d.k === 'tema') c.temas.splice(+d.id, 1); else c[d.k] = c[d.k].filter(x => x.id !== d.id); refresh(); };
Acts.cpart = d => { const c = St.comites.find(x => x.id === d.id); openForm({ title: 'Agregar participante', fields: [{ k: 'n', l: 'Nombre', req: true, list: people() }, { k: 'rol', l: 'Rol' }], values: { rol: 'Participante' }, onSave(o) { c.participantes.push({ ...o, asistio: false }); refresh(); } }); };
Acts.carmar = d => {   /* U-19: arma la agenda con lo pendiente */
  const c = St.comites.find(x => x.id === d.id); if (!c) return; const prop = d.kind === 'prop', n0 = c.temas.length;
  const ya = (t, ini) => c.temas.some(x => x.t === t && (x.ini || '') === (ini || ''));
  DECS().filter(x => x.estado === 'Pendiente' && x.ini && byId(x.ini) && (prop ? esProp(byId(x.ini)) : !esProp(byId(x.ini)))).forEach(x => { const t = 'Decidir: ' + x.titulo; if (!ya(t, x.ini)) c.temas.push({ t, ini: x.ini, notas: '' }); });
  if (prop) St.ini.filter(i => esProp(i) && isLive(i)).forEach(i => { const t = 'Revisar propuesta: ' + i.titulo; if (!ya(t, i.id)) c.temas.push({ t, ini: i.id, notas: '' }); });
  const n = c.temas.length - n0; toast(n ? n + ' tema(s) agregados a la agenda' : 'No hay pendientes nuevos para agregar'); if (n) refresh();
};
Acts.ctema = d => { const c = St.comites.find(x => x.id === d.id); openForm({ title: 'Agregar tema de agenda', fields: [{ k: 't', l: 'Tema', req: true, w: 3 }, { k: 'ini', l: 'Proyecto / propuesta relacionada', t: 'select', opts: iniOpts(d.kind === 'prop' ? 'Propuesta' : d.kind === 'prj' ? 'Proyecto' : undefined), blank: '—', w: 3 }, { k: 'notas', l: 'Notas', t: 'textarea', w: 3 }], values: {}, onSave(o) { c.temas.push(o); refresh(); } }); };
Acts.cacc = d => { const c = St.comites.find(x => x.id === d.id), k = d.k; openForm({ title: k === 'acciones' ? 'Nueva acción' : 'Nuevo compromiso', fields: [{ k: 'texto', l: 'Descripción', req: true, t: 'textarea', w: 3 }, { k: 'resp', l: 'Responsable', list: people() }, { k: 'limite', l: 'Fecha límite', t: 'date' }, { k: 'ini', l: 'Iniciativa', t: 'select', opts: iniOpts(), blank: '—', w: 3 }], values: { limite: addD(c.fecha, 7), resp: St.cfg.usuario }, onSave(o) { c[k].push({ id: (k === 'acciones' ? 'ACC-' : 'CMP-') + Math.random().toString(36).slice(2, 6), estado: k === 'acciones' ? 'Abierta' : 'Abierto', cierre: '', ...o, ini: o.ini || null }); log('Cambio', o.ini || null, (k === 'acciones' ? 'Acción registrada: ' : 'Compromiso registrado: ') + o.texto); refresh(); } }); };
Acts.cdec = d => { const c = St.comites.find(x => x.id === d.id); decForm(null); setTimeout(() => { const s = $('#f_comite'); if (s) s.value = c.id; }, 20); };
Acts.cclose = d => { const c = St.comites.find(x => x.id === d.id); confirmBox(`¿Cerrar la sesión del <b>${fmtDL(c.fecha)}</b>? Quedará como <b>Realizada</b> y se registrará en la bitácora.`, () => { c.estado = 'Realizado'; log('Cambio', null, `Comité realizado (${fmtD(c.fecha)}): ${c.temas.length} temas, ${c.decisiones.length} decisiones, ${c.acciones.length + c.compromisos.length} acciones/compromisos`); toast('Sesión cerrada'); refresh(); }, 'Cerrar sesión'); };
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
Acts.bitadd = () => { const t = $('#bt-txt').value.trim(); if (!t) return toast('Escribe un comentario', 'err'); log('Comentario', $('#bt-ini').value || null, t); const nb = St.bitacora[0], tm = $('#bt-tema').value.trim(); if (tm) nb.tema = tm; if (!$('#bt-pres').checked) nb.inPres = false; toast('Publicado en la bitácora'); refresh(); };
Chg.bitpres = el => { const b = St.bitacora.find(x => x.id === el.dataset.id); if (!b) return; if (el.checked) delete b.inPres; else b.inPres = false; save(); toast(el.checked ? 'La nota entra en las presentaciones' : 'La nota queda fuera de las presentaciones'); };
Acts.btipo = d => { const f = F('bit', {}); f.tipos = f.tipos.includes(d.t) ? f.tipos.filter(x => x !== d.t) : [...f.tipos, d.t]; render(); };
Acts.bmore = () => { F('bit', {}).n += 60; render(); };
Acts.bitcsv = () => { download('APIH_bitacora_' + hoy() + '.csv', toCSV(St.bitacora, [{ h: 'Fecha', f: b => b.ts }, { h: 'Tipo', f: b => b.tipo }, { h: 'Iniciativa', f: b => nameOf(b.ini) }, { h: 'Autor', f: b => b.autor }, { h: 'Texto', f: b => b.texto }, { h: 'Detalle', f: b => b.meta }]), 'text/csv'); toast('Bitácora exportada'); };


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  DESC_MAX: { get: () => DESC_MAX, enumerable: true, configurable: true },
  avanceCalc: { get: () => avanceCalc, enumerable: true, configurable: true },
  avanceEf: { get: () => avanceEf, enumerable: true, configurable: true },
  avanceFaseCalc: { get: () => avanceFaseCalc, enumerable: true, configurable: true },
  avanceManualDe: { get: () => avanceManualDe, enumerable: true, configurable: true },
  fasesFechasDe: { get: () => fasesFechasDe, enumerable: true, configurable: true },
  fasesVentana: { get: () => fasesVentana, enumerable: true, configurable: true },
  sincAvance: { get: () => sincAvance, enumerable: true, configurable: true },
  fasesMaterializadas: { get: () => fasesMaterializadas, enumerable: true, configurable: true },
  hitosFuera: { get: () => hitosFuera, enumerable: true, configurable: true },
  validarFasesFechas: { get: () => validarFasesFechas, enumerable: true, configurable: true },
  reconciliarAvance: { get: () => reconciliarAvance, enumerable: true, configurable: true },
  moverFinPlan: { get: () => moverFinPlan, enumerable: true, configurable: true },
  setRangoPlan: { get: () => setRangoPlan, enumerable: true, configurable: true },
  aplicarFasesFechas: { get: () => aplicarFasesFechas, enumerable: true, configurable: true },
  cutDesc: { get: () => cutDesc, enumerable: true, configurable: true },
  faseTag: { get: () => faseTag, enumerable: true, configurable: true },
  pcols: { get: () => pcols, enumerable: true, configurable: true },
  portfolioRows: { get: () => portfolioRows, enumerable: true, configurable: true },
  rangoTx: { get: () => rangoTx, enumerable: true, configurable: true },
  subfasesDe: { get: () => subfasesDe, enumerable: true, configurable: true },
  ventanaDe: { get: () => ventanaDe, enumerable: true, configurable: true },
});
