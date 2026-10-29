/* 10a-extensiones-ficha-encabezados — continuación de 10-extensiones.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { $, CALC, APIH_CONFIG, FL, MESES, MONEDAS, St, _audSt, audSnap, byId, desv, diasSinUpd, diffD, esAdmin, esProp, esc, fmtD, fmtMon, forecast, hoy, icon, miUsuario, monOf, pD, pad, ppInval } from './01-nucleo.js';
import { AuthService } from './02-datos.js';
import { Acts, F, UI, Views, banner, btn, closePops, confirmBox, fasePill, fitMain, go, navBadge, openForm, render, renderChrome, syncPop } from './03-interfaz.js';
import { faseTag, pasosDe, planFichaHTML } from './05b-vistas-portafolio-fases.js';
import { ADM_TABS } from './06-administracion.js';
import { cut } from './06b-administracion-herramientas.js';
import { NIV, actSemana, cieloOn, cieloPersona, cocFit, hoyW, insignias, modoUI, proyActivos, starsOf, starsRow } from './07-gobierno.js';
import { NO_PERM, areaVisible, areasDe, esAdministra, puedeEditarIni, puedeGobernar, puedeVerAnalisis, rolActual, soloLectura } from './07b-gobierno-analisis-capacidad.js';
import { presLayout } from './09-presentaciones.js';
import { MENU, PRIM, SECS, V, esMia, fAbierta, fOculta, fh, fhSave, grupoResumen, histHTML, lsGet, lsSet, panoFicha, parsePanel, primaria, secCam, secCom, secDec, secHitos, secInt, secNota, secRiesgos, sr, sra } from './10-extensiones.js';

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
    af.querySelectorAll('button').forEach(b => { const t = b.textContent.trim(); b.classList.remove('sm'); b.setAttribute('title', t); if (/^Cambiar etapa/.test(t)) return; if (/^(Actualizar|Aprobar)/.test(t)) main.push(b.outerHTML); else if (/^(Reporte|1 a 1|Informe|Editar)/.test(t)) seg.push(b.outerHTML); else more.push(b.outerHTML); });
    const kick = R.kicker.replace(/\s*<button[\s\S]*?<\/button>/g, '');
    const acts = `<div class="fl2-a">${seg.join('')}${main.join('')}${more.length ? `<div class="popw"><button class="btn" data-act="pop" data-id="pop-flmore" aria-label="Más acciones" title="Fase, estado y más">${icon('dots', 16)}<span>Más</span></button><div class="pop" id="pop-flmore" style="right:0">${more.join('')}</div></div>` : ''}</div>`;
    const PRIM = ['res', 'pla', 'cif', 'sal', 'log', 'hit', 'rie'], prim = lista.filter(x => PRIM.includes(x[0])), rest = lista.filter(x => !PRIM.includes(x[0]));
    const act0 = UI.flTab && lista.some(x => x[0] === UI.flTab) ? UI.flTab : (prim[0] || lista[0] || [])[0];
    const tab = x => `<button class="fl2-tab ${x[0] === act0 ? 'on' : ''} ${fOculta(x[0]) ? 'off' : ''}" data-act="fltab" data-k="${x[0]}" title="${esc(x[1])}" ${x[0] === act0 ? 'aria-current="true"' : ''}>${esc(({ cif: 'Cifras', sal: 'Salud', log: 'Logros' })[x[0]] || x[1])}</button>`;
    let phX = '', phLab = '';
    const mkHead = () => { if (phLab) [...pf.querySelectorAll('.pill')].forEach(x => { if (x.textContent.trim() === phLab) x.remove(); }); const ult = i.actualizada ? diffD(hoy(), i.actualizada) : null;
      return `<div class="fl3"><div class="fl3-top"><button class="btn" data-act="flback">${icon('chevl', 13)}<span>Volver</span></button><span class="fl2-k">${kick}</span><span class="fl2-sp"></span>${acts}</div><div class="fl3-t"><h1>${R.title}</h1><div class="fl2-p">${pf.firstElementChild ? [...pf.childNodes].map(n => n.outerHTML || n.textContent).join('') : ''}</div></div><p class="mut fl3-sub">${[i.lider ? 'Líder ' + esc(i.lider) : '', i.sponsor ? 'Sponsor ' + esc(i.sponsor) : '', ult == null ? '' : 'Actualizado ' + (ult === 0 ? 'hoy' : 'hace ' + ult + (ult === 1 ? ' día' : ' días'))].filter(Boolean).join(' · ')}</p></div>`; };
    const bar = `<div class="fl3-h"><h2>Todo lo demás</h2><span class="fl2-sp"></span><button class="fl2-lk" data-act="flall" data-m="open">Expandir todo</button><span aria-hidden="true">·</span><button class="fl2-lk" data-act="flall" data-m="close">Contraer todo</button></div>`;
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
    return mkHead() + panoFicha(i) + bar + `<div class="fl-grid fl-list">${grid}</div>`;
  }
  Views.ficha = {
    render() {
      const i = UI.fichaId && byId(UI.fichaId);
      if (!i) return V.emptyRich({ ic: 'list', title: 'Elige una iniciativa para ver su ficha', line: 'La ficha reúne todo de un proyecto o propuesta en una sola página.', p: ['Ir a Proyectos', 'go', { v: 'proyectos' }, 'list'], s: ['Ir a Propuestas', 'go', { v: 'propuestas' }, 'bulb'] }).replace('em-a edit-only', 'em-a');
      if (!areaVisible(i.area)) return V.emptyRich({ ic: 'lock', title: 'Esta iniciativa es de otra área', line: 'Tu rol no tiene acceso al área ' + areasDe(i.area).join(', ') + '.', p: ['Volver', 'flback', {}, 'chevl'] }).replace('em-a edit-only', 'em-a');
      return fichaHTML(i);
    }
  };
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
    const ia = ['inicio', 'iniciativas', 'planificacion', 'gobierno'].includes(g.k) && sr(':scope>.ph .ph-act', m);
    if (ia) {   /* Tabla / Tablero, Dashboard / Mi cocina y las pestañas de Planificación van junto al título */
      let hh = h;
      if (g.k === 'planificacion') {   /* Cronograma agrupa Gantt, Fases, Roadmap y Calendario */
        const CR = ['gantt', 'fases', 'roadmap', 'calendario'], cr = g.vs.filter(x => CR.includes(x[0])), rs = g.vs.filter(x => !CR.includes(x[0])), act = cr.find(x => x[0] === UI.view);
        const tab = x => { const b = +navBadge(x[0]) || 0; return `<a role="tab" class="${UI.view === x[0] ? 'on' : ''}" data-act="go" data-v="${x[0]}" href="#/${x[0]}" aria-selected="${UI.view === x[0]}">${esc(x[1])}${b ? `<em>${b}</em>` : ''}</a>`; };
        const crono = cr.length ? `<span class="popw fx-crono"><button type="button" role="tab" class="${act ? 'on' : ''}" data-act="pop" data-id="pop-crono" aria-selected="${!!act}" aria-haspopup="menu">${esc('Cronograma' + (act ? ' · ' + act[1] : ''))} <span aria-hidden="true">▾</span></button><div class="pop" id="pop-crono" role="menu">${cr.map(x => `<button type="button" role="menuitem" data-act="go" data-v="${x[0]}" class="${UI.view === x[0] ? 'on' : ''}">${esc(x[1])}${UI.view === x[0] ? '<span aria-hidden="true">✓</span>' : ''}</button>`).join('')}</div></span>` : '';
        hh = `<div class="menu-tabs" role="tablist" aria-label="${esc(g.t)}">${crono}${rs.map(tab).join('')}</div>`;
      }
      if (g.k === 'gobierno') hh = h.replace('>Pipeline de propuestas<', '>Pipeline<');   /* el título ya dice el módulo */
      const SUB = { planificacion: ['Cronograma, hitos y riesgos', 'del portafolio'], gobierno: ['Propuestas, decisiones', 'y cambios del portafolio'] }[g.k];
      if (SUB) {   /* el título es el módulo (la pestaña activa se ve en el selector) y la bajada va en dos líneas */
        const h1 = sr(':scope>.ph h1', m), pp = sr(':scope>.ph p', m); if (h1) h1.textContent = g.t;
        if (pp) { pp.title = ''; pp.innerHTML = `<span class="ph-s2"><span>${esc(SUB[0])}</span><span>${esc(SUB[1])}</span></span>`; }
      }
      ia.insertAdjacentHTML('afterbegin', hh.replace('class="menu-tabs"', 'class="menu-tabs in-ph"')); if (UI.pop === 'pop-crono') { const e = sr('#pop-crono'); if (e) e.classList.add('open'); } return;
    }
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
      const keep = b => b.classList.contains('v22-main') || b.classList.contains('sxbtn') || b.closest('.v22-more') || b.closest('.v22-nuevo') || /^\s*(Alta directa|Presentar|Ir a hoy|Nuev[oa]\b)/.test(b.textContent);   /* N-U-10/U-29: la acción principal de cada pantalla queda visible */
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
  /* Encabezado único (modelo: Iniciativas). Dashboard: «Resumen | Análisis» a la derecha de los filtros.
     Planificación: los filtros se agrupan en «Alcance» (Área, Responsable, Tipo, Iniciativa) y «Filtros de …»
     (los propios de cada pantalla); lo activo se ve como etiquetas que se quitan con ×. «Solo lo mío» queda a un clic. */
  function encabezadoFiltros() {
    const m = sr('#main'); if (!m || innerWidth < 700) return;
    const row = sr(':scope>.v22-row', m); if (!row) return;
    if (UI.view === 'dashboard' && !sr('.fx-vs', row)) {
      const vs = document.createElement('div'); vs.className = 'seg fx-vs'; vs.setAttribute('role', 'group'); vs.setAttribute('aria-label', 'Vista');
      vs.innerHTML = `<button class="on" aria-pressed="true">Resumen</button><button data-act="go" data-v="analisis" aria-pressed="false">Análisis</button>`; row.appendChild(vs); return;
    }
    const g = grupoDe(UI.view, menuGroups()); if (!g || g.k !== 'planificacion' || sr('.fx-alc', row) || (modoUI() === 'simple' && !UI.sx)) return;   /* en modo Simple esos filtros ya están ocultos */
    const NOM = { 'flt/ini': 'Iniciativa', 'cflt/ini': 'Proyecto', 'flt/estado': 'Estado', 'flt/cat': 'Categoría', 'flt/nivel': 'Nivel', 'flt/dueno': 'Dueño' };
    const key = x => x.dataset.chg + '/' + (x.dataset.f || '');
    const alc = [], fil = [];
    [...row.children].forEach(n => {
      const x = n.matches('select') ? n : (n.tagName === 'LABEL' ? sr('select', n) : null); if (!x) return;
      if (['areaG', 'respG', 'ptipo'].includes(x.dataset.chg) || key(x) === 'flt/ini' || key(x) === 'cflt/ini') alc.push([n, x]);
      else if (NOM[key(x)]) fil.push([n, x]);
    });
    if (!alc.length && !fil.length) return;
    const lbl = (n, x) => { if (n !== x) return n; const l = document.createElement('label'); l.className = 'flt ' + (x.className || ''); const sm = document.createElement('small'); sm.textContent = NOM[key(x)]; l.appendChild(sm); l.appendChild(x); return l; };
    const txt = x => { const o = x.options[x.selectedIndex]; return o ? o.textContent.trim() : ''; };
    const activo = x => x.dataset.chg === 'areaG' ? x.value !== 'Todas' : x.dataset.chg === 'respG' ? (x.value !== '' && !x.disabled) : x.dataset.chg === 'ptipo' ? false : x.value !== '';
    const chips = [], panel = (id, titulo, valor, items) => {
      const w = document.createElement('span'); w.className = 'popw fx-grp';
      w.innerHTML = `<button type="button" class="btn fx-b" data-act="pop" data-id="${id}" aria-haspopup="true"><span class="fx-t">${esc(titulo)}</span><b>${esc(valor)}</b><span aria-hidden="true">▾</span></button><div class="pop fx-panel" id="${id}"></div>`;
      const box = sr('.pop', w); items.forEach(([n, x]) => box.appendChild(lbl(n, x))); if (UI.pop === id) box.classList.add('open'); return w;
    };
    const nA = alc.filter(([, x]) => activo(x)).length, nF = fil.filter(([, x]) => activo(x)).length;
    alc.concat(fil).forEach(([, x]) => { if (activo(x)) chips.push([x.dataset.chg, x.dataset.f || '', (NOM[key(x)] || (x.dataset.chg === 'areaG' ? 'Área' : 'Responsable')) + ': ' + txt(x), x.dataset.chg === 'areaG' ? 'Todas' : '']); });
    const mine = sr('button.mine', row), ref = mine || sr('.search', row) || null;
    const wa = alc.length ? panel('pop-fx-alc', 'Alcance', nA ? nA + ' activo' + (nA === 1 ? '' : 's') : 'Todo', alc) : null, wf = fil.length ? panel('pop-fx-fil', g.k && UI.view === 'riesgos' ? 'Filtros de riesgo' : 'Filtros', nF ? String(nF) : 'Todos', fil) : null;
    if (wa) { wa.classList.add('fx-alc'); row.insertBefore(wa, mine ? mine : ref); }
    if (wf) row.insertBefore(wf, (wa && wa.nextSibling) || ref);
    let at = mine || wf || wa; chips.forEach(([c, f, t, v]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'fx-chip'; b.dataset.fxc = c; b.dataset.fxf = f; b.dataset.fxv = v; b.setAttribute('aria-label', 'Quitar filtro ' + t); b.innerHTML = `${esc(t)} <span aria-hidden="true">×</span>`; if (at) { at.after(b); at = b; } else row.appendChild(b); });
  }
  document.addEventListener('click', e => {   /* quitar un filtro desde su etiqueta */
    const b = e.target.closest && e.target.closest('.fx-chip'); if (!b) return;
    const x = sr(`#main select[data-chg="${b.dataset.fxc}"]${b.dataset.fxf ? `[data-f="${b.dataset.fxf}"]` : ''}`); if (!x) return;
    x.value = b.dataset.fxv; x.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const presLayout0 = presLayout;
  ENLACES.presLayout = function () { presLayout0.apply(this, arguments); const b = sr('.p2-bar [data-act=pdrawer] span'); if (b) b.textContent = 'Diapositivas'; const t = sr('.p2-bar input[data-k=titulo]'); if (t) { t.placeholder = 'Título de la presentación'; t.setAttribute('aria-label', 'Título'); } };
  const render0 = render;
  ENLACES.render = function () {
    /* compactar() mueve los filtros a otra fila y eso quita el foco del campo que se está escribiendo: se restaura al final */
    const act = document.activeElement, key = act && act.dataset ? act.dataset.key : null, ss = act && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null;
    render0.apply(this, arguments);
    try { if (St !== _audSt) audSnap(); primaria(); compactar(); encabezadoFiltros(); contrasta(); menuTabs(); paginar(); a11y(); } catch (e) { console.error(e); }
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

  /* El acceso (pantalla de ingreso, sesión y sus acciones) es propio del ambiente: vive en 01t-transporte.js y 10b-acceso.js. */

  /* ======================= Mi cocina: misión guiada ======================= */

  const diaPlural = n => n + (n === 1 ? ' día' : ' días');
  function misionDe(i) {
    const W = hoyW(), E = hoy(), out = [], M = (CALC.mision || {})[i.id] || { hit: [], cmp: [], rsk: [] }, st = starsOf(i, W), off = k => (st.find(x => x.k === k) || {}).s === 'off';
    const bAct = (l, a, d, pri) => ({ l, a, d, pri });
    if (off('dia')) {
      const nc = actSemana(i, W) === 'nc';
      out.push({ k: 'dia', t: 'Al día', por: nc ? 'Marcaste «sin novedades» dos semanas seguidas. Esta semana hace falta un avance real.' : (diasSinUpd(i) >= 999 ? 'Este proyecto nunca se ha actualizado.' : 'No lo actualizas desde el ' + fmtD(i.actualizada) + ' (hace ' + diaPlural(diasSinUpd(i)) + '). Esta semana aún no hay ninguna actualización.'),
        como: 'Abre la actualización semanal, anota un logro o el próximo paso y ajusta el % de avance. Toma 1 minuto.', btn: [bAct('Actualizar ahora', 'wk', { id: i.id }, true)] });
    }
    if (off('hit')) {
      const hv = M.hit;   // los hitos vencidos los define el servidor
      out.push({ k: 'hit', t: 'Hitos', por: 'Tienes ' + hv.length + ' hito' + (hv.length === 1 ? '' : 's') + ' vencido' + (hv.length === 1 ? '' : 's') + ' sin cerrar ni explicar:',
        lista: hv.slice(0, 4).map(h => '«' + h.nombre + '» venció el ' + fmtD(h.fecha) + ' (hace ' + diaPlural(diffD(E, h.fecha)) + ')'),
        como: '<b>Si ya se cumplió:</b> ábrelo y márcalo completado. <b>Si se atrasó:</b> pide el cambio de fecha en Control de cambios; el atraso queda explicado y el tenedor se enciende.',
        btn: [bAct('Pedir cambio de fecha', 'chgnew', { id: i.id }, true), bAct('Ver hitos de la ficha', 'cocir', { id: i.id, k: 'hit' })] });
    }
    if (off('cmp')) {
      const cv = M.cmp;
      out.push({ k: 'cmp', t: 'Compromisos', por: 'Hay ' + cv.length + ' compromiso' + (cv.length === 1 ? '' : 's') + ' con fecha vencida:',
        lista: cv.slice(0, 4).map(c => '«' + cut(c.texto, 60) + '» (' + (c.resp || 'sin responsable') + ', límite ' + fmtD(c.limite) + ')'),
        como: 'Ábrelos desde la ficha y márcalos <b>Cumplido</b>, o cámbiales la fecha límite si se acordó otra.', btn: [bAct('Ir a los compromisos', 'cocir', { id: i.id, k: 'com' }, true)] });
    }
    if (off('rsk')) {
      const rs = M.rsk;
      out.push({ k: 'rsk', t: 'Riesgos', por: rs.length + ' riesgo' + (rs.length === 1 ? '' : 's') + ' por atender:',
        lista: rs.slice(0, 4).map(r => '«' + cut(r.desc, 60) + '» · ' + (r.por === 'rev' ? 'revisión vencida el ' + fmtD(r.fRev) : 'crítico (' + r.expo + ') sin plan de mitigación')),
        como: 'Abre el riesgo y <b>escribe el plan de mitigación</b> o <b>actualiza la fecha de próxima revisión</b>.', btn: [bAct('Abrir el primer riesgo', 'sel', { t: 'risk', id: rs[0] ? rs[0].id : '' }, true), bAct('Ver riesgos de la ficha', 'cocir', { id: i.id, k: 'rie' })] });
    }
    if (off('gob')) {
      out.push({ k: 'gob', t: 'Gobierno', por: 'Se proyecta terminar el ' + fmtD(forecast(i)) + ', ' + diaPlural(desv(i)) + ' después de lo planificado (' + fmtD(i.finPlan) + '). Tu tolerancia es de ' + diaPlural((CALC.ini[i.id] || {}).tol) + ' y no hay ningún cambio registrado.',
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
      onSave(o) { return (0, ENLACES.cmdServidor)('apih_registrar_consumo', { p_id: i.id, p_gastado: +o.gastado || 0, p_nota: o.nota || '' }, 'Presupuesto registrado', true).then(r => r !== null); } });
  };
  Acts.misgastook = d => {
    const i = byId(d.id); if (!i) return;
    if (soloLectura() || !puedeEditarIni(i)) return NO_PERM('Tu rol o el modo solo lectura no permiten editar');
    (0, ENLACES.cmdServidor)('apih_confirmar_consumo', { p_id: i.id }, 'Confirmado: presupuesto al día');
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
      onSave(o) { return (0, ENLACES.cmdServidor)('apih_guardar_documento', { p_ini: i.id, p_id: nw ? null : d.id, p_datos: { nombre: o.nombre, tipo: o.tipo, url: o.url, nota: o.nota || '' } }, nw ? 'Documento agregado' : 'Documento actualizado', true).then(r => r !== null); } });
  }
  Acts.docnew = d => { const i = byId(d.id); if (!i) return; if (!docPuedeAgregar(i)) return NO_PERM('Tu rol o el modo solo lectura no permiten agregar documentos'); docForm(i, null); };
  Acts.docedit = d => { const x = (St.documentos || []).find(n => n.id === d.id), i = x && byId(x.ini); if (!x || !i) return; if (!docPuedeEditar(x, i)) return NO_PERM('Solo quien lo agregó o el PMO puede editarlo'); docForm(i, x); };
  Acts.docdel = d => {
    const x = (St.documentos || []).find(n => n.id === d.id), i = x && byId(x.ini); if (!x || !i) return;
    if (!docPuedeEditar(x, i)) return NO_PERM('Solo quien lo agregó o el PMO puede quitarlo');
    confirmBox('¿Quitar «' + esc(x.nombre) + '» de la documentación? El archivo en OneDrive/SharePoint no se borra.', () => { (0, ENLACES.cmdServidor)('apih_quitar_documento', { p_id: x.id }, 'Documento quitado'); }, 'Quitar', true);
  };
