import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, leerHojaComoObjetos_ } from './08a-generador-motor.js';
import { ESTILO_PPT, PPT_INSET_H, ppt_acotarParaAncho_, ppt_acotarParaCaja_, ppt_acotar_, ppt_altoGlifos_, ppt_altoTexto_, ppt_anchoParaTexto_, ppt_factorAncho_, ppt_forma_, ppt_lineasEnAlto_, ppt_lineasNecesarias_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_fichaFondo_, ppt_tintar_ } from './08c-generador-portafolio.js';
/** Ficha individual de proyecto — "Reporte de avance" (estilo Alt4). Versión completa con
 *  overrides manuales y cálculo automático:
 *   - avance_fase ("Avance fase activa"): vacío = % de hitos completados; si no hay hitos, = avance.
 *   - logros_ciclo ("Esta semana"): vacío = notas HUMANAS del Historial posteriores al corte
 *     (se descartan las autogeneradas y los volcados de Date); si no hay, los hitos completados.
 *   - proximos_pasos ("Lo que viene"): vacío = hitos pendientes.
 *  Sobrescribibles desde la grilla o la ficha de detalle web.
 */
export function construirSlideFicha_(slide, it, base, corteStr, descripcionBase, hitos, clasificacion, corte) {
  // Ficha v5: sin columna lateral ("01"), encabezado compacto, KPIs más altos, presupuesto como
  // cuadro largo y tres cajas grandes que se llevan el resto de la altura. Misma paleta y estilo.
  ppt_fichaFondo_(slide);
  const X0 = 18, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 * 2;
  const A = ALT4_PALETA_ACTIVA;
  const F = ESTILO_ALT4.FUENTE;
  const CENTER = SlidesApp.ParagraphAlignment.CENTER, END = SlidesApp.ParagraphAlignment.END, START = SlidesApp.ParagraphAlignment.START;
  const fmt = function (v) {
    const f = (0, ENLACES.parsearFecha_)(v);
    return f ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'dd/MM/yy') : '';
  };
  const lineas_ = function (txt) {
    return String(txt || '').split(/[\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  };
  const avance = Math.max(0, Math.min(100, Number(it.avance) || 0));

  const hitosOrd = (hitos || []).filter(function (h) { return (0, ENLACES.muestraDetalle_)(h.mostrar_detalle); })
    .slice().sort(function (a, b) { return (a.fecha || 0) - (b.fecha || 0); });
  let idxProx = -1;
  for (let i = 0; i < hitosOrd.length; i++) { if (!hitosOrd[i].completado) { idxProx = i; break; } }
  const proximo = idxProx !== -1 ? hitosOrd[idxProx] : null;
  const completados = hitosOrd.filter(function (h) { return h.completado; });

  const tieneFase = it.avance_fase !== undefined && it.avance_fase !== null && String(it.avance_fase).trim() !== '';
  let avanceFase;
  if (tieneFase) avanceFase = Math.max(0, Math.min(100, Number(it.avance_fase) || 0));
  else if (hitosOrd.length > 0) avanceFase = Math.round(completados.length / hitosOrd.length * 100);
  else avanceFase = avance;

  const salud = it.salud_rag || 'Ambar';
  const badgeEstado = salud === 'Verde' ? { txt: 'EN PLAN', bg: ESTILO_ALT4.VERDE_OK }
    : (salud === 'Rojo' ? { txt: 'CRÍTICO', bg: A.accent } : { txt: 'EN RIESGO', bg: ESTILO_ALT4.AMBAR_TEXTO });

  // ── Encabezado compacto: rótulo + contexto y estado / título y reporte / propósito ──
  const Y0 = 10;
  const W_BADGE = 84;
  const W_META = 236;
  const W_TIT = ANCHO_DISP - W_META - 10;
  const areaFmt = (0, ENLACES.areasDeIniciativa_)(it.area).join(', ') || (it.area || '');
  const metaLine = ['Ficha de proyecto', areaFmt, it.categoria, it.prioridad ? 'Prioridad ' + String(it.prioridad).toLowerCase() : null]
    .filter(Boolean).join(' · ').toUpperCase();
  ppt_texto_(slide, ppt_acotarParaAncho_(metaLine, ANCHO_DISP - W_BADGE - 12, 7.5, true), X0, Y0, ANCHO_DISP - W_BADGE - 12, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, negrita: true, color: A.accentDeep, fuente: F });

  const badge = ppt_forma_(slide, SlidesApp.ShapeType.ROUND_RECTANGLE, X0 + ANCHO_DISP - W_BADGE, Y0, W_BADGE, 18);
  badge.getFill().setSolidFill(badgeEstado.bg);
  badge.getBorder().setTransparent();
  ppt_texto_(slide, badgeEstado.txt, X0 + ANCHO_DISP - W_BADGE, Y0, W_BADGE, 18,
    { tam: 8.5, negrita: true, color: '#ffffff', alinear: CENTER, medio: true, altoFijo: true, fuente: F });

  const yT = Y0 + ppt_altoTexto_(7.5, 1);
  let tamT = 18;
  [18, 16, 14, 12].some(function (t) { tamT = t; return ppt_anchoParaTexto_(it.nombre, t, true, 0, 9999) <= W_TIT; });
  ppt_texto_(slide, ppt_acotarParaAncho_(it.nombre, W_TIT, tamT, true), X0, yT, W_TIT, ppt_altoTexto_(18, 1),
    { tam: tamT, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: F });

  const rotuloFecha = corteStr ? 'Cambios desde el ' + corteStr : 'Primer reporte · ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const metaIzq = rotuloFecha + (it.responsable ? ' · PM: ' + it.responsable : '');
  const metaNeg = it.responsable_negocio ? 'Negocio: ' + it.responsable_negocio : '';
  const metaTexto = ppt_acotarParaAncho_(metaIzq, W_META, 7.5, false) + (metaNeg ? '\n' + ppt_acotarParaAncho_(metaNeg, W_META, 7.5, false) : '');
  ppt_texto_(slide, metaTexto, X0 + ANCHO_DISP - W_META, yT + 2, W_META, ppt_altoTexto_(7.5, metaNeg ? 2 : 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, alinear: END, fuente: F });

  let yh = yT + ppt_altoTexto_(18, 1);
  const proposito = it.proposito || descripcionBase || it.resumen_ejecutivo || '';
  if (proposito) {
    ppt_texto_(slide, 'Propósito: ' + ppt_acotarParaAncho_(proposito, ANCHO_DISP - 70, 7.5, false), X0, yh, ANCHO_DISP, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, italica: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: F });
    yh += ppt_altoTexto_(7.5, 1);
  }
  const yDiv = yh + 2;
  ppt_rect_(slide, X0, yDiv, ANCHO_DISP, 1, '#D4CFC4');

  // ── Fila: 2 KPIs oscuros + panel de hitos ──
  const yRow = yDiv + 7;
  const W_KPI = 120, GAP = 8;
  const MAX_HITOS_LINEA = 5, PAD_PH = 12, LIN_MAX_HITO = 3;
  let iniVentana = 0;
  if (hitosOrd.length > MAX_HITOS_LINEA) {
    const ancla = idxProx !== -1 ? idxProx : hitosOrd.length - 1;
    iniVentana = Math.max(0, Math.min(ancla - 1, hitosOrd.length - MAX_HITOS_LINEA));
  }
  const stepHitos = hitosOrd.slice(iniVentana, iniVentana + MAX_HITOS_LINEA);
  const idxProxV = idxProx === -1 ? -1 : idxProx - iniVentana;
  const W_PH_PRE = ANCHO_DISP - 2 * (W_KPI + GAP);
  const SW_PRE = (W_PH_PRE - PAD_PH * 2) / Math.max(1, stepHitos.length);
  const WL_PRE = SW_PRE + PPT_INSET_H - 3;
  let linNombre = 1;
  stepHitos.forEach(function (h) {
    linNombre = Math.max(linNombre, Math.min(LIN_MAX_HITO,
      ppt_lineasNecesarias_((h.completado ? '\u2713 ' : '') + String(h.nombre || ''), WL_PRE, 6.5, true)));
  });
  const extraHitos = stepHitos.length ? Math.max(0, 34 + 6 + ppt_altoGlifos_(7) + ppt_altoTexto_(6.5, linNombre) - 56) : 0;
  const altoRow = 93 + extraHitos;

  function kpiOscuro_(x, eyebrow, numero, pct, valor, valorColor) {
    ppt_rect_(slide, x, yRow, W_KPI, altoRow, ESTILO_ALT4.FONDO_OSCURO, false);
    ppt_texto_(slide, ppt_acotarParaAncho_(eyebrow.toUpperCase(), W_KPI - 16, 6.5, true), x + 8, yRow + 4, W_KPI - 16, ppt_altoTexto_(6.5, 1),
      { tam: 6.5, negrita: true, color: '#A39E97', fuente: F });
    ppt_texto_(slide, numero, x + 8, yRow + 19, W_KPI - 16, ppt_altoTexto_(28, 1),
      { tam: 28, negrita: true, color: '#ffffff', altoFijo: true, fuente: F });
    ppt_texto_(slide, ppt_acotarParaAncho_(valor, W_KPI - 16, 8.5, true), x + 8, yRow + altoRow - 31, W_KPI - 16, ppt_altoTexto_(8.5, 1),
      { tam: 8.5, negrita: true, color: valorColor || '#E8E4DA', altoFijo: true, fuente: F });
    const pB = Math.max(0, Math.min(100, Number(pct) || 0));
    ppt_rect_(slide, x + 14, yRow + altoRow - 10, W_KPI - 28, 5, '#3A3733', true);
    if (pB > 0) ppt_rect_(slide, x + 14, yRow + altoRow - 10, Math.max(3, (W_KPI - 28) * pB / 100), 5, A.accentDeep, true);
  }

  kpiOscuro_(X0, 'Avance del proyecto', avance + '%', avance, it.estado || 'En curso', '#E8E4DA');

  let subVar = 'Primer ciclo', colVar = '#CBC6BB';
  if (base) {
    const d = avance - (Number(base.avance) || 0);
    subVar = (d > 0 ? '↑ desde ' : (d < 0 ? '↓ desde ' : '= ')) + (Number(base.avance) || 0) + '%';
    colVar = d > 0 ? '#7FD6A0' : (d < 0 ? '#E8928A' : '#CBC6BB');
  }
  kpiOscuro_(X0 + W_KPI + GAP, 'Avance fase activa', avanceFase + '%', avanceFase, subVar, colVar);

  // Panel de hitos
  const X_PH = X0 + 2 * (W_KPI + GAP);
  const W_PH = ANCHO_DISP - 2 * (W_KPI + GAP);
  const PAD = 12;
  ppt_rect_(slide, X_PH, yRow, W_PH, altoRow, ESTILO_PPT.BLANCO, false);

  const tituloPH = proximo
    ? 'PRÓXIMO HITO: ' + String(proximo.nombre || '').toUpperCase() + (proximo.fecha ? ' · ' + fmt(proximo.fecha) : '')
    : (hitosOrd.length > 0 ? 'HITOS DEL PLAN · TODOS COMPLETOS' : 'SIN HITOS REGISTRADOS');
  ppt_texto_(slide, ppt_acotarParaAncho_(tituloPH, W_PH - PAD * 2, 8, true), X_PH + PAD, yRow + 6, W_PH - PAD * 2, ppt_altoTexto_(8, 1),
    { tam: 8, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: F });

  const yStep = yRow + 34;
  if (stepHitos.length > 0) {
    const n = stepHitos.length;
    const sw = (W_PH - PAD * 2) / n;
    const cx0 = X_PH + PAD + sw / 2, cxN = X_PH + PAD + sw * (n - 0.5);
    const wl = sw + PPT_INSET_H - 3;
    const hFecha = ppt_altoGlifos_(7);
    ppt_rect_(slide, cx0, yStep - 1, Math.max(1, cxN - cx0), 2, '#D4CFC4');
    const nVerde = n > 1 ? (idxProxV === -1 ? n - 1 : idxProxV) : 0;
    if (nVerde > 0) ppt_rect_(slide, cx0, yStep - 1, sw * nVerde, 2, ESTILO_ALT4.VERDE_OK);
    stepHitos.forEach(function (h, i) {
      const cx = X_PH + PAD + sw * (i + 0.5);
      const esProx = i === idxProxV;
      const pt = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, cx - 5, yStep - 5, 10, 10);
      if (h.completado) { pt.getFill().setSolidFill(ESTILO_ALT4.VERDE_OK); pt.getBorder().setTransparent(); }
      else if (esProx) { pt.getFill().setSolidFill(A.accent); pt.getBorder().setTransparent(); }
      else { pt.getFill().setSolidFill('#ffffff'); pt.getBorder().getLineFill().setSolidFill('#CBC6BB'); pt.getBorder().setWeight(1.2); }
      const colH = h.completado ? ESTILO_ALT4.VERDE_OK : (esProx ? A.accentDeep : ESTILO_ALT4.TEXTO_SEC);
      const lx = cx - wl / 2;
      ppt_texto_(slide, fmt(h.fecha) || 'Sin fecha', lx, yStep + 6, wl, hFecha,
        { tam: 7, negrita: true, altoFijo: true, color: colH, alinear: CENTER, fuente: F });
      const etiqueta = (h.completado ? '✓ ' : '') + String(h.nombre || '');
      ppt_texto_(slide, ppt_acotarParaCaja_(etiqueta, wl, 6.5, h.completado || esProx, linNombre), lx, yStep + 6 + hFecha, wl, ppt_altoTexto_(6.5, linNombre),
        { tam: 6.5, negrita: h.completado || esProx, altoFijo: true, color: colH, alinear: CENTER, fuente: F });
    });
  } else {
    ppt_texto_(slide, 'Sin hitos cargados en el plan.', X_PH + PAD, yStep - 6, W_PH - PAD * 2, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, italica: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: F });
  }

  // Fase activa: etiqueta + % + barra + fechas de la fase (planificadas a la izquierda, reales a la derecha)
  const ySep = yRow + 57 + extraHitos;
  ppt_rect_(slide, X_PH + PAD, ySep, W_PH - PAD * 2, 1, '#EDEAE2');
  const yFaseLbl = ySep + 3;
  ppt_texto_(slide, ppt_acotarParaAncho_('Fase activa: ' + (it.estado || '—'), W_PH - PAD * 2 - 54, 7.5, false), X_PH + PAD, yFaseLbl, W_PH - PAD * 2 - 54, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: F });
  ppt_texto_(slide, avanceFase + '%', X_PH + W_PH - PAD - 54, yFaseLbl - 1, 54, ppt_altoTexto_(9, 1),
    { tam: 9, negrita: true, color: A.accentDeep, alinear: END, fuente: F });
  const yBar = yRow + 75 + extraHitos;
  ppt_rect_(slide, X_PH + PAD, yBar, W_PH - PAD * 2, 5, '#E4E0D6', true);
  if (avanceFase > 0) ppt_rect_(slide, X_PH + PAD, yBar, Math.max(3, (W_PH - PAD * 2) * avanceFase / 100), 5, A.accentDeep, true);
  const fpIni = fmt(it.fase_inicio_plan), fpFin = fmt(it.fase_fin_plan), frIni = fmt(it.fase_inicio_real), frFin = fmt(it.fase_fin_real);
  const txtPlan = (fpIni || fpFin) ? 'Plan: ' + (fpIni || '—') + ' → ' + (fpFin || '—') : '';
  const txtReal = frIni ? 'Real: ' + frIni + ' → ' + (frFin || 'en curso') : (frFin ? 'Real: — → ' + frFin : '');
  const wMitad = (W_PH - PAD * 2) / 2;
  if (txtPlan) ppt_texto_(slide, txtPlan, X_PH + PAD, yRow + 80 + extraHitos, wMitad, 12,
    { tam: 6.5, color: ESTILO_ALT4.TEXTO_TERC, altoFijo: true, fuente: F });
  if (txtReal) ppt_texto_(slide, txtReal, X_PH + PAD + wMitad, yRow + 80 + extraHitos, wMitad, 12,
    { tam: 6.5, color: ESTILO_ALT4.TEXTO_TERC, alinear: END, altoFijo: true, fuente: F });

  // ── Presupuesto: cuadro largo bajo los números grandes ──
  const asig = Number(it.presupuesto_asignado) || 0, gast = Number(it.presupuesto_gastado) || 0;
  const hayPpto = asig > 0;
  let yColsBase = yRow + altoRow + 8;
  if (hayPpto) {
    const yP = yRow + altoRow + 6;
    const pct = Math.min(999, Math.round((gast / asig) * 100));
    const excedido = gast > asig;
    ppt_rect_(slide, X0, yP, ANCHO_DISP, 24, ESTILO_PPT.BLANCO, false);
    ppt_texto_(slide, 'PRESUPUESTO', X0 + 11, yP, 90, 24,
      { tam: 7.5, negrita: true, color: A.accentDeep, medio: true, altoFijo: true, fuente: F });
    const xBar = X0 + 100, wBar = ANCHO_DISP - 100 - 190;
    ppt_rect_(slide, xBar, yP + 9, wBar, 6, '#E4E0D6', true);
    if (pct > 0) ppt_rect_(slide, xBar, yP + 9, Math.max(3, wBar * Math.min(100, pct) / 100), 6, excedido ? A.accent : A.accentDeep, true);
    ppt_texto_(slide, '$' + gast.toLocaleString('es-CL') + ' / $' + asig.toLocaleString('es-CL') + ' · ' + pct + '%',
      X0 + ANCHO_DISP - 190, yP, 190 - 11, 24,
      { tam: 8, negrita: true, color: excedido ? A.accent : ESTILO_ALT4.TEXTO, alinear: END, medio: true, altoFijo: true, fuente: F });
    yColsBase = yP + 24 + 6;
  }

  // ── Tres cajas: se llevan toda la altura que queda ──
  const yCols = yColsBase;
  const yPie = ESTILO_PPT.ALTO - 20;
  const altoCols = yPie - 6 - yCols;
  const gapC = 8;
  const W_COL = (ANCHO_DISP - gapC * 2) / 3;

  const logros = lineas_(it.logros_ciclo);
  const pasos = lineas_(it.proximos_pasos);
  const pendientes = hitosOrd.filter(function (h) { return !h.completado; }).slice(0, 6);

  const esNotaSistema_ = function (nota) {
    const nt = String(nota || '').trim();
    if (!nt) return true;
    if (/^Actualización automática/i.test(nt)) return true;
    if (/^Actualización sin cambios/i.test(nt)) return true;
    if (/^Iniciativa creada/i.test(nt)) return true;
    if (/^Proyecto creado/i.test(nt)) return true;
    if (/^(Completado con archivo|Hito |Edición desde grilla)/i.test(nt)) return true;
    if (/génesis/i.test(nt)) return true;
    if (/GMT[+-]?\d/.test(nt)) return true;
    return false;
  };

  let notasPeriodo = [];
  if (logros.length === 0 && corte) {
    try {
      notasPeriodo = leerHojaComoObjetos_('Historial')
        .filter(function (h) {
          if (h.iniciativa_id !== it.id || esNotaSistema_(h.nota)) return false;
          const f = (0, ENLACES.parsearFecha_)(h.fecha);
          return f && f > corte;
        })
        .sort(function (a, b) { return ((0, ENLACES.parsearFecha_)(b.fecha) || 0) - ((0, ENLACES.parsearFecha_)(a.fecha) || 0); })
        .map(function (h) { return String(h.nota); })
        .slice(0, 8);
    } catch (e) { notasPeriodo = []; }
  }

  const itemsSemana = logros.length > 0
    ? logros.map(function (t) { return { prefijo: '✓', texto: t, color: ESTILO_ALT4.VERDE_OK }; })
    : (notasPeriodo.length > 0
      ? notasPeriodo.map(function (t) { return { prefijo: '✓', texto: t, color: ESTILO_ALT4.VERDE_OK }; })
      : (completados.length > 0
        ? completados.slice(-8).reverse().map(function (h) { return { prefijo: '✓', texto: String(h.nombre || '') + (h.fecha ? ' · ' + fmt(h.fecha) : ''), color: ESTILO_ALT4.VERDE_OK }; })
        : [{ prefijo: '', texto: 'Sin avances registrados este ciclo.' }]));
  const itemsViene = pasos.length > 0
    ? pasos.map(function (t) { return { prefijo: '→', texto: t, color: ESTILO_ALT4.AZUL }; })
    : (pendientes.length > 0
      ? pendientes.map(function (h) { return { prefijo: '→', texto: String(h.nombre || '') + (h.fecha ? ' · ' + fmt(h.fecha) : ''), color: ESTILO_ALT4.AZUL }; })
      : [{ prefijo: '', texto: it.proximo_hito || 'Sin próximos hitos registrados.' }]);
  const notas = [];
  if (it.issue) notas.push({ prefijo: '①', texto: String(it.issue), color: '#E8928A' });
  if (it.riesgo) notas.push({ prefijo: it.issue ? '②' : '①', texto: String(it.riesgo), color: '#E8C06A' });

  const GAP_ITEM = 1, MAX_LIN = 4;
  const hItems_ = function (items, w, tamT) {
    let h = 0;
    items.forEach(function (o) {
      const lineasN = Math.min(MAX_LIN, ppt_lineasNecesarias_((o.prefijo ? o.prefijo + ' ' : '') + o.texto, w - (o.prefijo ? 16 : 0), tamT, false));
      h += ppt_altoTexto_(tamT, lineasN) + GAP_ITEM;
    });
    return h;
  };

  function renderItems_(px, yIni, w, hDisp, items, oscuro, tamT) {
    const colTexto = oscuro ? '#D7D3CC' : ESTILO_ALT4.TEXTO;
    if (items.length === 0) {
      ppt_texto_(slide, 'Sin novedades.', px, yIni, w, ppt_altoTexto_(8.5, 1),
        { tam: 8.5, italica: true, color: oscuro ? '#9A958D' : ESTILO_ALT4.TEXTO_SEC, fuente: F });
      return;
    }
    let y = yIni;
    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      const lineasN = Math.min(MAX_LIN, ppt_lineasNecesarias_((o.prefijo ? o.prefijo + ' ' : '') + o.texto, w - (o.prefijo ? 16 : 0), tamT, false));
      const hItem = ppt_altoTexto_(tamT, lineasN) + GAP_ITEM;
      if (y + hItem > yIni + hDisp) break;
      if (o.prefijo) ppt_texto_(slide, o.prefijo, px, y, 15, ppt_altoTexto_(tamT, 1),
        { tam: tamT, negrita: true, color: o.color || colTexto, fuente: F });
      const px2 = o.prefijo ? px + 16 : px, w2 = o.prefijo ? w - 16 : w;
      ppt_texto_(slide, ppt_acotarParaCaja_(o.texto, w2, tamT, false, lineasN), px2, y, w2, ppt_altoTexto_(tamT, lineasN),
        { tam: tamT, color: colTexto, fuente: F });
      y += hItem;
    }
  }

  // Tamaño de letra común a las 3 cajas: el más grande (9 → 7) en el que TODO el texto entra.
  const yIniRel = 11 + ppt_altoTexto_(10, 1) + 6;
  const hDispCols = altoCols - yIniRel - 6;
  const wItems = W_COL - 24;
  let tamItems = 7;
  [9, 8.5, 8, 7.5, 7].some(function (t) {
    tamItems = t;
    return hItems_(itemsSemana, wItems, t) <= hDispCols && hItems_(itemsViene, wItems, t) <= hDispCols && hItems_(notas, wItems, t) <= hDispCols;
  });

  function columna_(x, titulo, colorDot, items, oscuro) {
    ppt_rect_(slide, x, yCols, W_COL, altoCols, oscuro ? ESTILO_ALT4.FONDO_OSCURO : ESTILO_PPT.BLANCO, false);
    const px = x + 12, w = W_COL - 24;
    const dot = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, px, yCols + 14, 7, 7);
    dot.getFill().setSolidFill(colorDot); dot.getBorder().setTransparent();
    ppt_texto_(slide, titulo, px + 13, yCols + 11, w - 13, ppt_altoTexto_(10, 1),
      { tam: 10, negrita: true, color: oscuro ? '#ffffff' : ESTILO_ALT4.TEXTO, fuente: F });
    renderItems_(px, yCols + yIniRel, w, hDispCols, items, oscuro, tamItems);
  }

  columna_(X0, 'Esta semana', ESTILO_ALT4.VERDE_OK, itemsSemana, false);
  columna_(X0 + W_COL + gapC, 'Lo que viene', ESTILO_ALT4.AZUL, itemsViene, false);
  columna_(X0 + (W_COL + gapC) * 2, 'Notas de atención', A.accent, notas, true);

  ppt_texto_(slide, 'Anexo · Ficha de iniciativas', X0, yPie, ANCHO_DISP, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: F });
}

/** Stepper de 5 nodos (Creada/Con solicitud/En evaluación/Caso de negocio/Aprobación — "Soluciones
 *  de proveedor" se agrupa en Aprobación, mismo criterio que el embudo de Flujo propuestas). Solo
 *  círculos simples (relleno o borde) + línea — sin necesitar arcos ni ajustes de forma. */
function ppt_alt4Stepper_(slide, etapaActual, x0, y0, ancho) {
  const PASOS = ['Recepción', 'Evaluación', 'Caso de Negocio', 'Aprobación'];
  const idxActual = (function () {
    if (etapaActual === 'Soluciones de proveedor') return PASOS.indexOf('Aprobación');
    const i = PASOS.indexOf(etapaActual);
    return i === -1 ? 0 : i;
  })();
  const n = PASOS.length, wPaso = ancho / n, R = 9;
  PASOS.forEach(function (label, i) {
    const cx = x0 + wPaso * i + wPaso / 2;
    if (i < n - 1) ppt_rect_(slide, cx + R, y0, wPaso - R * 2, 2, (i + 1 < idxActual) ? ESTILO_ALT4.VERDE_OK : '#D4CFC4', true);
    const nodo = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, cx - R, y0 - R + 1, R * 2, R * 2);
    if (i < idxActual) { nodo.getFill().setSolidFill(ESTILO_ALT4.VERDE_OK); nodo.getBorder().setTransparent(); }
    else if (i === idxActual) { nodo.getFill().setSolidFill(ALT4_PALETA_ACTIVA.accent); nodo.getBorder().setTransparent(); }
    else { nodo.getFill().setSolidFill(ESTILO_ALT4.FONDO); nodo.getBorder().getLineFill().setSolidFill('#CBC6BB'); nodo.getBorder().setWeight(1.5); }
    if (i === idxActual) {
      ppt_texto_(slide, String(i + 1), cx - R, y0 - R + 1, R * 2, R * 2,
        { tam: 8, negrita: true, color: ESTILO_PPT.BLANCO, alinear: SlidesApp.ParagraphAlignment.CENTER, medio: true, fuente: ESTILO_ALT4.FUENTE });
    }
    ppt_texto_(slide, label, cx - wPaso / 2 + 4, y0 + R + 4, wPaso - 8, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, negrita: i <= idxActual, color: i <= idxActual ? ESTILO_ALT4.TEXTO : ESTILO_ALT4.TEXTO_SEC,
        alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  });
}

/** Autofit de un párrafo dentro de un alto disponible FIJO: prueba tamaños de fuente de mayor
 *  a menor (pasos de 0.5pt) y usa el más grande en el que el texto ENTERO entra sin recortar.
 *  Reemplaza el enfoque anterior (un tamaño fijo + truncar si no entraba), que dejaba el
 *  efecto "sobra espacio pero el texto se corta igual": nunca se probaba bajar un poco la
 *  fuente antes de recortar. Si ni al tamaño mínimo entra completo, se trunca ahí (al mínimo,
 *  para maximizar cuánto texto real se alcanza a mostrar en el espacio que hay). */
function ppt_autoencajarParrafo_(texto, wc, altoDisponible, tamMax, tamMin, negrita) {
  const t = String(texto === null || texto === undefined ? '' : texto).trim() || '—';
  for (let tam = tamMax; tam >= tamMin - 0.01; tam -= 0.5) {
    const lineas = ppt_lineasNecesarias_(t, wc, tam, negrita);
    const alto = ppt_altoTexto_(tam, lineas);
    if (alto <= altoDisponible) return { tam: tam, texto: t, alto: alto };
  }
  const lineasMax = ppt_lineasEnAlto_(altoDisponible, tamMin);
  const charsPorLinea = Math.max(1, Math.floor((wc - PPT_INSET_H) / (tamMin * ppt_factorAncho_(negrita))));
  return { tam: tamMin, texto: ppt_acotar_(t, charsPorLinea * lineasMax), alto: ppt_altoTexto_(tamMin, lineasMax) };
}

/** Igual que ppt_autoencajarParrafo_, pero para DOS párrafos que deben compartir tamaño de
 *  fuente entre sí (para verse consistentes, como Beneficios/Usuarios en la misma tarjeta) y
 *  un alto disponible conjunto. El primer tamaño (de mayor a menor) en el que la SUMA de
 *  ambos entra completa, gana — así ninguno se recorta si hay un tamaño común que a los dos
 *  les alcanza. Si ni al mínimo entran completos, se reparte el alto disponible proporcional
 *  a lo que cada uno necesita y se trunca ahí, siempre al tamaño mínimo. */
function ppt_autoencajarParDeParrafos_(textoA, textoB, wc, altoDisponible, tamMax, tamMin, negrita) {
  const a = String(textoA === null || textoA === undefined ? '' : textoA).trim() || '—';
  const b = String(textoB === null || textoB === undefined ? '' : textoB).trim() || '—';
  for (let tam = tamMax; tam >= tamMin - 0.01; tam -= 0.5) {
    const altoA = ppt_altoTexto_(tam, ppt_lineasNecesarias_(a, wc, tam, negrita));
    const altoB = ppt_altoTexto_(tam, ppt_lineasNecesarias_(b, wc, tam, negrita));
    if (altoA + altoB <= altoDisponible) return { tam: tam, textoA: a, textoB: b, altoA: altoA, altoB: altoB };
  }
  const altoANat = ppt_altoTexto_(tamMin, ppt_lineasNecesarias_(a, wc, tamMin, negrita));
  const altoBNat = ppt_altoTexto_(tamMin, ppt_lineasNecesarias_(b, wc, tamMin, negrita));
  const altoA = Math.max(ppt_altoTexto_(tamMin, 1), Math.round(altoDisponible * altoANat / (altoANat + altoBNat)));
  const altoB = Math.max(ppt_altoTexto_(tamMin, 1), altoDisponible - altoA);
  const charsPorLinea = Math.max(1, Math.floor((wc - PPT_INSET_H) / (tamMin * ppt_factorAncho_(negrita))));
  return {
    tam: tamMin,
    textoA: ppt_acotar_(a, charsPorLinea * ppt_lineasEnAlto_(altoA, tamMin)),
    textoB: ppt_acotar_(b, charsPorLinea * ppt_lineasEnAlto_(altoB, tamMin)),
    altoA: altoA, altoB: altoB
  };
}

export function construirSlideFichaPropuesta_(slide, p, soluciones) {
  ppt_fichaFondo_(slide);
  const X0 = 18, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 18;

  const Y0 = 20;
  const metaLine = ['Ficha de propuesta', p.area, p.categoria, 'Prioridad ' + (p.prioridad || 'Media'), p.propuesto_por ? 'Propuesta por ' + p.propuesto_por : null]
    .filter(Boolean).join(' · ').toUpperCase();
  ppt_texto_(slide, metaLine, X0, Y0, ANCHO_DISP, ppt_altoTexto_(8, 1),
    { tam: 8, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, ppt_acotarParaAncho_(p.nombre, ANCHO_DISP, 18, true), X0, Y0 + ppt_altoTexto_(8, 1) + 4, ANCHO_DISP, ppt_altoTexto_(18, 1),
    { tam: 18, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });

  // Stepper de etapa + días en etapa
  const yStepper = Y0 + ppt_altoTexto_(8, 1) + 4 + ppt_altoTexto_(18, 1) + 20;
  const W_DIAS = 90, W_STEPPER = ANCHO_DISP - W_DIAS - 14;
  ppt_alt4Stepper_(slide, p.etapa_propuesta || 'Creada', X0, yStepper, W_STEPPER);
  const fEtapa = (0, ENLACES.parsearFecha_)(p.fecha_etapa) || (0, ENLACES.parsearFecha_)(p.fecha_propuesta);
  const dias = fEtapa ? Math.max(0, Math.floor((new Date() - fEtapa) / 86400000)) : 0;
  ppt_texto_(slide, dias + (dias === 1 ? ' día' : ' días') + ' en etapa', X0 + W_STEPPER + 14, yStepper - 4, W_DIAS, ppt_altoTexto_(8.5, 1),
    { tam: 8.5, color: ESTILO_ALT4.TEXTO_SEC, alinear: SlidesApp.ParagraphAlignment.END, fuente: ESTILO_ALT4.FUENTE });

  // yStepper+30 caía justo en el borde inferior de las etiquetas del stepper (R=9 + 4 + alto de
  // una línea de 7.5pt ≈ 30pt exactos) — la tarjeta de abajo (y su borde superior de acento)
  // quedaba pegada al texto, sin aire. +48 dejar un respiro real antes del cuerpo.
  const Y_CUERPO = yStepper + 48;
  const Y_PIE = ESTILO_PPT.ALTO - 26;
  const ALTO_TARJETA = Y_PIE - 10 - Y_CUERPO;
  const GAP_COL = 14;
  // Columna 1 un poco más ancha (0.28→0.32) a costa de la 2 (0.44→0.41) — "Problema a
  // resolver" es históricamente el campo más largo del formulario y el que más sufre
  // truncado; unos puntos más de ancho le devuelven varias líneas sin achicar mucho la
  // columna de Impacto y alcance.
  const W1 = ANCHO_DISP * 0.32, W2 = ANCHO_DISP * 0.41, W3 = ANCHO_DISP - W1 - W2 - GAP_COL * 2;
  const PAD = 12;

function eyebrow2_(x, y, w, texto, color) {
    ppt_texto_(slide, texto.toUpperCase(), x, y, w, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, negrita: true, color: color || ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    return y + ppt_altoTexto_(7.5, 1) + 4;
  }

  // Columna 1: Tipo de requerimiento + Problema a resolver. Cada texto mide cuántas líneas
  // necesita DE VERDAD (ppt_lineasNecesarias_) — si entra completo, se muestra completo; solo
  // se acota si de verdad no cabe. El bloque resultante se centra en la tarjeta.
  // Separadores más ajustados (14/16 → 10/10) para devolverle un par de líneas más al texto
  // de "Problema a resolver", que es el que de verdad las necesita.
  const GAP_ANTES_DIV = 10, GAP_DESPUES_DIV = 10;
  let x1 = X0; ppt_rect_(slide, x1, Y_CUERPO, W1, ALTO_TARJETA, ESTILO_PPT.BLANCO, false);
  let wc = W1 - PAD * 2;
  const hTipoValor = ppt_altoTexto_(9, ppt_lineasNecesarias_(p.tipo_requerimiento || '—', wc, 9, false));
  const disponibleProblema = ALTO_TARJETA - PAD * 2 - ppt_altoTexto_(7.5, 1) - hTipoValor - GAP_ANTES_DIV - 1 - GAP_DESPUES_DIV - ppt_altoTexto_(7.5, 1);
  const fitProblema = ppt_autoencajarParrafo_(p.problema_a_resolver, wc, disponibleProblema, 9.5, 8, false);
  const hProblemaValor = fitProblema.alto;
  const altoBloque1 = ppt_altoTexto_(7.5, 1) + hTipoValor + GAP_ANTES_DIV + 1 + GAP_DESPUES_DIV + ppt_altoTexto_(7.5, 1) + hProblemaValor;
  let xc = x1 + PAD, yc = Y_CUERPO + Math.max(PAD, (ALTO_TARJETA - altoBloque1) / 2);
  yc = eyebrow2_(xc, yc, wc, 'Tipo de requerimiento');
  ppt_texto_(slide, p.tipo_requerimiento || '—', xc, yc, wc, hTipoValor, { tam: 9, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  yc += hTipoValor + GAP_ANTES_DIV;
  ppt_rect_(slide, xc, yc, wc, 1, '#E8E4DA');
  yc += GAP_DESPUES_DIV;
  yc = eyebrow2_(xc, yc, wc, 'Problema a resolver');
  ppt_texto_(slide, fitProblema.texto, xc, yc, wc, hProblemaValor,
    { tam: fitProblema.tam, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });


  // Columna 2: Impacto y alcance (destacada) — Beneficios + Usuarios comparten tamaño de
  // fuente (autofit conjunto): se prueba el tamaño más grande en el que los DOS entran
  // completos, y solo si ni al mínimo entran los dos se reparte el espacio proporcional y se
  // trunca. El VALOR va sin negrita (solo el eyebrow la lleva).
  const x2 = x1 + W1 + GAP_COL;
  ppt_rect_(slide, x2, Y_CUERPO, W2, ALTO_TARJETA, ESTILO_PPT.BLANCO, false);
  wc = W2 - PAD * 2;
  const alturaFija2 = ppt_altoTexto_(7.5, 1) + 16 + ppt_altoTexto_(7.5, 1) + 20 + ppt_altoTexto_(7.5, 1);
  const disponible2 = ALTO_TARJETA - PAD * 2 - alturaFija2;
  const fit2 = ppt_autoencajarParDeParrafos_(p.beneficios_estimados, p.usuarios_impactados, wc, disponible2, 10, 8, false);
  const altoBloque2 = alturaFija2 + fit2.altoA + fit2.altoB;
  xc = x2 + PAD; yc = Y_CUERPO + Math.max(PAD, (ALTO_TARJETA - altoBloque2) / 2);
  yc = eyebrow2_(xc, yc, wc, 'Impacto y alcance', ALT4_PALETA_ACTIVA.accentDeep);
  yc += 16;
  yc = eyebrow2_(xc, yc, wc, 'Beneficios estimados');
  ppt_texto_(slide, fit2.textoA, xc, yc, wc, fit2.altoA, { tam: fit2.tam, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  yc += fit2.altoA + 20;
  yc = eyebrow2_(xc, yc, wc, 'Usuarios / áreas');
  ppt_texto_(slide, fit2.textoB, xc, yc, wc, fit2.altoB, { tam: fit2.tam, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });

  // Columna 3: Siguiente paso — rediseño confirmado: encabezado alineado ARRIBA (misma altura
  // que "Tipo de requerimiento"/"Impacto y alcance", ya no centrado en la tarjeta — ese
  // desfase era lo que se leía como "desordenado"), cada ítem en su propia mini-tarjeta blanca
  // con borde de acento (mismo lenguaje que las tarjetas grandes de al lado), y un pie con la
  // fecha de última actualización para no dejar tanto aire muerto abajo — esta columna siempre
  // va a tener menos contenido que las otras dos, así que ese aire es esperable, mejor usar
  // parte de él con algo útil que dejarlo vacío.
  const x3 = x2 + W2 + GAP_COL;
  ppt_rect_(slide, x3, Y_CUERPO, W3, ALTO_TARJETA, '#FAF8F3', false);
  wc = W3 - PAD * 2;
  xc = x3 + PAD;
  const itemsPaso = [
    { label: 'Presupuesto', valor: p.presupuesto_asignado ? 'Definido' : 'Sin definir' },
    { label: 'RFP', valor: p.rfp_url ? 'Adjuntado' : 'Sin adjuntar' },
    { label: 'Proveedor', valor: (soluciones && soluciones.length > 0) ? soluciones.length + ' solución(es) cargada(s)' : 'Sin soluciones cargadas' }
  ];
  const PAD_ITEM = 6, GAP_ITEM = 6;
  yc = Y_CUERPO + PAD;
  yc = eyebrow2_(xc, yc, wc, 'Siguiente paso');
  itemsPaso.forEach(function (item) {
    const lineasValor = ppt_lineasNecesarias_(item.valor, wc - PAD_ITEM * 2, 9, true);
    const hValor = ppt_altoTexto_(9, lineasValor);
    const hTarjetaItem = PAD_ITEM * 2 + ppt_altoTexto_(7.5, 1) + 2 + hValor;
    ppt_rect_(slide, xc, yc, wc, hTarjetaItem, ESTILO_PPT.BLANCO, false);
    ppt_rect_(slide, xc, yc, 2, hTarjetaItem, '#CBC6BB');
    ppt_texto_(slide, item.label, xc + PAD_ITEM + 4, yc + PAD_ITEM, wc - PAD_ITEM * 2 - 4, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, color: '#A39E97', fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, item.valor, xc + PAD_ITEM + 4, yc + PAD_ITEM + ppt_altoTexto_(7.5, 1) + 2, wc - PAD_ITEM * 2 - 4, hValor,
      { tam: 9, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
    yc += hTarjetaItem + GAP_ITEM;
  });
  // El pie de "última actualización" solo se dibuja si sobra espacio DE VERDAD después de los
  // ítems — si "Proveedor" necesitó 2 líneas y ya no queda margen, se omite en vez de
  // desbordar la tarjeta. Nunca se fuerza a entrar.
  const espacioRestanteCol3 = (Y_CUERPO + ALTO_TARJETA) - yc - PAD;
  if (fEtapa && espacioRestanteCol3 >= 27) {
    yc += 6;
    ppt_rect_(slide, xc, yc, wc, 1, '#E8E4DA');
    yc += 10;
    ppt_texto_(slide, 'Última actualización · ' + Utilities.formatDate(fEtapa, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      xc, yc, wc, ppt_altoTexto_(7.5, 1), { tam: 7.5, italica: true, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });
  }

  ppt_rect_(slide, X0, Y_PIE, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, 'Anexo · Fichas de iniciativas', X0, Y_PIE + 5, ANCHO_DISP, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

/** Selecciona qué hitos mostrar en la línea de tiempo de la ficha, priorizando SIEMPRE que quepan
 *  en el espacio asignado sin desbordar:
 *  - sin hitos cargados en la pestaña Hitos → el proximo_hito de la iniciativa, como único punto
 *  - con hitos cargados: arma la lista completa (ordenada por fecha, sin fecha al final) + el
 *    término del proyecto (esFin) si corresponde — SIEMPRE se intenta mostrar todo
 *  - si la lista completa no entra ni siquiera apretada al paso mínimo (pasoMinimo) dentro del
 *    espacio disponible (zonaDisponible), se van descartando de a uno los hitos YA COMPLETADOS
 *    más antiguos primero (nunca los pendientes ni el término del proyecto) hasta que el resto
 *    quepa. Solo si ya no quedan completados que descartar y aun así sobra, se recurre como
 *    último caso a quitar los pendientes más lejanos en el tiempo, preservando siempre el
 *    próximo pendiente y el término del proyecto.
 *  zonaDisponible/altoItem/pasoMinimo son opcionales: si no se pasan (llamador antiguo), se
 *  mantiene el recorte fijo de siempre para no romper nada. */
function seleccionarHitosParaFicha_(it, hitos, zonaDisponible, altoItem, pasoMinimo) {
  let candidatos;
  if (!hitos || hitos.length === 0) {
    candidatos = it.proximo_hito ? [{ nombre: it.proximo_hito, fecha: (0, ENLACES.parsearFecha_)(it.proximo_hito_fecha), completado: false }] : [];
  } else {
    candidatos = hitos.filter(function (h) { return (0, ENLACES.muestraDetalle_)(h.mostrar_detalle); }).sort(function (a, b) {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha - b.fecha;
    });
  }

  const fFin = (0, ENLACES.parsearFecha_)(it.fecha_fin_estimada);
  if (fFin) {
    const yaEsTermino = candidatos.length > 0 && candidatos[candidatos.length - 1].fecha &&
      Math.abs(candidatos[candidatos.length - 1].fecha - fFin) < 86400000 &&
      /t[ée]rmino|fin del proyecto|cierre/i.test(candidatos[candidatos.length - 1].nombre || '');
    if (!yaEsTermino) {
      candidatos = candidatos.concat([{ nombre: 'Término del proyecto', fecha: fFin, completado: false, esFin: true }]);
    }
  }

  // Llamador antiguo (sin datos de espacio disponible): recorte fijo de siempre, para no romper
  // ninguna otra invocación existente que no pase estos 3 parámetros.
  if (!zonaDisponible || !altoItem || !pasoMinimo) {
    if (candidatos.length <= 6) return candidatos;
    const completados = candidatos.filter(function (h) { return h.completado && !h.esFin; });
    const pendientes = candidatos.filter(function (h) { return !h.completado || h.esFin; });
    return completados.slice(-2).concat(pendientes.slice(0, 4));
  }

  // Cuántos puntos caben al paso MÍNIMO (el más apretado permitido, sin solapes) sin desbordar
  // la zona disponible: grupoHitos = pasoMinimo*(n-1) + altoItem <= zonaDisponible.
  const maxQueCaben = Math.max(1, Math.floor((zonaDisponible - altoItem) / pasoMinimo) + 1);
  if (candidatos.length <= maxQueCaben) return candidatos; // todos entran, aunque sea apretados

  let resultado = candidatos.slice();
  while (resultado.length > maxQueCaben) {
    const idxCompletadoMasAntiguo = resultado.findIndex(function (h) { return h.completado && !h.esFin; });
    if (idxCompletadoMasAntiguo !== -1) {
      resultado.splice(idxCompletadoMasAntiguo, 1);
      continue;
    }
    // Ya no quedan completados que descartar — último recurso: el pendiente más lejano en el
    // tiempo (la lista está ordenada por fecha ascendente), nunca el término del proyecto.
    let idxPendienteMasLejano = -1;
    for (let i = resultado.length - 1; i >= 0; i--) {
      if (!resultado[i].completado && !resultado[i].esFin) { idxPendienteMasLejano = i; break; }
    }
    if (idxPendienteMasLejano === -1) break; // solo queda el término del proyecto — no se reduce más
    resultado.splice(idxPendienteMasLejano, 1);
  }
  return resultado;
}

/** Dibuja la línea de tiempo de hitos entre x0 y x1, con la línea base en yLinea.
 *  Puntos equiespaciados en orden cronológico (robusto ante fechas faltantes o muy juntas);
 *  completados en verde relleno, el siguiente pendiente destacado en rojo, el resto en gris.
 *  El marcador HOY se inserta entre el último completado y el primer pendiente. */
function dibujarLineaHitos_(slide, hitos, x0, x1, yLinea) {
  const ultimoCompletadoIdx = (function () {
    let idx = -1;
    hitos.forEach(function (h, i) { if (h.completado && !h.esFin) idx = i; });
    return idx;
  })();

  // Posiciones: hitos equiespaciados; HOY se intercala después del último completado
  const totalPuntos = hitos.length + 1; // +1 por el marcador HOY
  const paso = (x1 - x0) / Math.max(1, totalPuntos - 1);
  const posiciones = [];
  let insertado = false;
  let xCursor = x0;
  hitos.forEach(function (h, i) {
    if (!insertado && i === ultimoCompletadoIdx + 1) {
      posiciones.push({ esHoy: true, x: xCursor });
      xCursor += paso;
      insertado = true;
    }
    posiciones.push({ hito: h, x: xCursor, idx: i });
    xCursor += paso;
  });
  if (!insertado) posiciones.push({ esHoy: true, x: xCursor });

  const xHoy = posiciones.filter(function (p) { return p.esHoy; })[0].x;

  // Línea base — más gruesa (3pt, antes 2pt) para dar más peso visual — gris con el tramo
  // completado en verde hasta HOY.
  ppt_rect_(slide, x0, yLinea - 1.5, x1 - x0, 3, '#CCCCCC');
  if (xHoy > x0) ppt_rect_(slide, x0, yLinea - 1.5, xHoy - x0, 3, '#2E7D32');

  // Etiquetas en zigzag (arriba/abajo alternado, ya probado contra colisiones) + en DIAGONAL
  // (rotadas -25°) para darle más carácter a la diagramación, en vez de texto plano horizontal.
  // El término del proyecto (esFin) es siempre el último punto, con un marcador distinto (más
  // grande, negro sólido) y su etiqueta SIEMPRE abajo sin rotar — al ser el último punto, no
  // compite por espacio con nada a su derecha, así que no necesita las mismas protecciones.
  let primerPendienteMarcado = false;
  let indiceHito = 0;
  posiciones.forEach(function (p) {
    if (p.esHoy) {
      const marcador = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, p.x - 5, yLinea - 5, 10, 10);
      marcador.getFill().setSolidFill(ESTILO_PPT.BLANCO);
      marcador.getBorder().getLineFill().setSolidFill(ESTILO_PPT.ROJO);
      marcador.getBorder().setWeight(2.5);
      ppt_texto_(slide, 'HOY', p.x + 7, yLinea - 13, 32, 10, { tam: 7, negrita: true, color: ESTILO_PPT.ROJO });
      return;
    }
    const h = p.hito;

    if (h.esFin) {
      // Marcador de término: círculo negro sólido más grande, con anillo — distinto a todo lo demás
      const anillo = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, p.x - 10, yLinea - 10, 20, 20);
      anillo.getFill().setSolidFill(ESTILO_PPT.BLANCO);
      anillo.getBorder().getLineFill().setSolidFill(ESTILO_PPT.NEGRO);
      anillo.getBorder().setWeight(2.5);
      const centro = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, p.x - 5, yLinea - 5, 10, 10);
      centro.getFill().setSolidFill(ESTILO_PPT.NEGRO);
      centro.getBorder().setTransparent();
      const fechaFinStr = h.fecha ? Utilities.formatDate(h.fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy') : '';
      const textoTermino = 'TÉRMINO' + (fechaFinStr ? '  ·  ' + fechaFinStr : '');
      const termShape = ppt_forma_(slide, SlidesApp.ShapeType.ROUND_RECTANGLE, p.x - 80, yLinea + 14, 160, 24);
      termShape.getFill().setSolidFill(ESTILO_PPT.NEGRO);
      termShape.getBorder().setTransparent();
      const termTxt = termShape.getText();
      termTxt.setText(textoTermino);
      const termStyle = termTxt.getTextStyle();
      termStyle.setFontFamily('Arial');
      termStyle.setFontSize(7.5);
      termStyle.setBold(true);
      termStyle.setForegroundColor(ESTILO_PPT.BLANCO);
      termTxt.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
      termShape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
      return;
    }

    const arriba = indiceHito % 2 === 0;
    indiceHito++;
    const esPrimerPendiente = !h.completado && !primerPendienteMarcado;
    const circulo = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, p.x - 7, yLinea - 7, 14, 14);
    if (h.completado) {
      circulo.getFill().setSolidFill('#2E7D32');
      circulo.getBorder().setTransparent();
    } else {
      circulo.getFill().setSolidFill(ESTILO_PPT.BLANCO);
      const colorBorde = esPrimerPendiente ? ESTILO_PPT.ROJO : '#999999';
      circulo.getBorder().getLineFill().setSolidFill(colorBorde);
      circulo.getBorder().setWeight(2.5);
      primerPendienteMarcado = true;
    }
    const prefijo = h.completado ? '✓ ' : '';
    const fechaStr = h.fecha ? Utilities.formatDate(h.fecha, Session.getScriptTimeZone(), 'dd/MM') : '';
    // Chip con el MISMO patrón que los chips de delta de "Status proyectos" (comprobado que
    // renderiza bien): un rect de fondo + UN SOLO textbox que cubre todo el chip, centrado
    // horizontal y vertical. Nada de micro-zonas: las cajas de texto de Slides tienen un
    // padding interno (~7pt por lado) que en cajas angostas se come el espacio y el texto no
    // se muestra. El nombre se acota consciente del ancho para que "Nombre · dd/MM" quepa
    // SIEMPRE en una sola línea (descontando ~16pt de insets internos).
    const anchoChip = 150, altoChip = 22;
    const fondoChip = h.completado ? '#EAF3DE' : (esPrimerPendiente ? ppt_tintar_(ALT4_PALETA_ACTIVA.accent, 0.12) : ESTILO_PPT.PANEL);
    const colorTexto = h.completado ? '#2E7D32' : (esPrimerPendiente ? ESTILO_PPT.ROJO : ESTILO_PPT.NEGRO);
    const yChip = arriba ? (yLinea - 32) : (yLinea + 10);
    const sufijoFecha = fechaStr ? ' · ' + fechaStr : '';
    const presupuestoNombre = Math.max(4, Math.floor((anchoChip - 16) / (7.5 * 0.62)) - sufijoFecha.length - prefijo.length);
    const textoChip = prefijo + ppt_acotar_(h.nombre, presupuestoNombre) + sufijoFecha;
    // Shape única (no rect + textbox separados): evita el padding interno de los TextBox de
    // Slides que separaba el nombre y la fecha a los extremos del chip.
    const chipShape = ppt_forma_(slide, SlidesApp.ShapeType.ROUND_RECTANGLE, p.x - anchoChip / 2, yChip, anchoChip, altoChip);
    chipShape.getFill().setSolidFill(fondoChip);
    chipShape.getBorder().setTransparent();
    const chipTxt = chipShape.getText();
    chipTxt.setText(textoChip);
    const chipStyle = chipTxt.getTextStyle();
    chipStyle.setFontFamily('Arial');
    chipStyle.setFontSize(7.5);
    chipStyle.setBold(true);
    chipStyle.setForegroundColor(colorTexto);
    chipTxt.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    chipShape.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  });
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  ppt_autoencajarParrafo_: { get: () => ppt_autoencajarParrafo_, enumerable: true, configurable: true },
});
