import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, leerHojaComoObjetos_, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, PPT_INSET_H, Y_CONTENIDO_INICIAL, ppt_acotarParaAncho_, ppt_acotar_, ppt_altoGlifos_, ppt_altoTexto_, ppt_encabezado_, ppt_fondoClaro_, ppt_forma_, ppt_lineasNecesarias_, ppt_paginar_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_alt4Fondo_, ppt_alt4Header_ } from './08c-generador-portafolio.js';
/** Formatea un monto de forma compacta para las slides: 1.250.000 → "1.3M", 45.000 → "45K" */
function ppt_monto_(n) {
  const v = Number(n) || 0;
  if (v >= 1000000) return (Math.round(v / 100000) / 10) + 'M';
  if (v >= 1000) return Math.round(v / 1000) + 'K';
  return String(v);
}

/** MOVIMIENTOS DEL CICLO: altas (nuevas), bajas (archivadas), completadas, hitos completados
 *  del período y avances destacados (+15 pts o más). Es la ÚNICA slide donde aparecen las
 *  iniciativas archivadas. Se omite si no hay ningún movimiento. 7 por slide.
 *  areaObjetivo: el área EXPLÍCITA de este deck (la que se usó para armar `datos` vía
 *  filtrarDatosPortafolio_), o '' / null si es un deck de portafolio completo sin filtro de área.
 *  Importante: NO se infiere el área re-derivándola de datos.iniciativas (con
 *  todasLasAreasDe_) — si una iniciativa activa de este deck también tiene una segunda área
 *  (multi-área), esa inferencia devuelve más de un área y desactiva el filtro por completo,
 *  dejando pasar archivadas de la OTRA área igual. Por eso se recibe el área ya resuelta. */
/** calcularBloqueoPropuesta_ vive en Codigo_Utilidades.gs — la usa también Codigo_Dashboard.gs
 *  para la sección "Propuestas" del Dashboard, no solo esta slide. */

/** PROPUESTAS: pipeline compacto (barra segmentada por etapa) + lista de cada propuesta pendiente,
 *  en la MISMA slide — antes eran 2 slides separadas ("Propuestas — pipeline" y "Propuestas en
 *  evaluación"); con el volumen típico (pocas propuestas a la vez) esa separación sobraba. El
 *  pipeline reemplaza las barras verticales por etapa por una sola tira horizontal segmentada
 *  (mismo lenguaje visual que la barra RAG/madurez del Resumen Ejecutivo) para dejarle espacio
 *  real a la lista debajo, en la primera página. Lista: mismo criterio de siempre — bloqueo
 *  detectado (calcularBloqueoPropuesta_) + días en la etapa actual, ordenadas por antigüedad
 *  (las más estancadas primero). Se omite todo si no hay ninguna propuesta pendiente. */
function construirSlidePropuestas_(propuestas) {
  if (propuestas.length === 0) return;

  const todasLasSoluciones = leerHojaComoObjetos_('SolucionesProveedor');
  const hoy = new Date();

  const items = propuestas.map(function (p) {
    const soluciones = todasLasSoluciones.filter(function (s) { return s.propuesta_id === p.id; });
    const bloqueo = (0, ENLACES.calcularBloqueoPropuesta_)(p, soluciones);
    const fEtapa = (0, ENLACES.parsearFecha_)(p.fecha_etapa) || (0, ENLACES.parsearFecha_)(p.fecha_propuesta);
    const dias = fEtapa ? Math.floor((hoy - fEtapa) / (1000 * 3600 * 24)) : 0;
    const f = (0, ENLACES.parsearFecha_)(p.fecha_propuesta);
    const fStr = f ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'dd/MM/yyyy') : null;
    const etapa = p.etapa_propuesta || 'Creada';
    const metaPartes = [p.area, etapa, p.propuesto_por ? 'Propuesta por ' + p.propuesto_por : null, fStr].filter(Boolean);

    let sub = metaPartes.join(' · ') + (p.resumen_ejecutivo ? ' — ' + p.resumen_ejecutivo : '');
    if (dias >= 10) sub = '⏱ ' + dias + ' días en esta etapa · ' + sub;
    if (bloqueo) sub = '?? ' + bloqueo + ' · ' + sub;

    return {
      etiqueta: 'EN EVALUACIÓN', color: bloqueo ? '#C08A1E' : ESTILO_ALT4.AZUL, titulo: p.nombre,
      sub: sub, dias: dias
    };
  }).sort(function (a, b) { return b.dias - a.dias; }); // más estancadas primero

  // ── Pipeline compacto: conteo por etapa para la barra segmentada de la primera página ──────
  const ETAPAS_SECUENCIA = ['Creada', 'Con solicitud', 'En evaluación', 'Con caso de negocio', 'Soluciones de proveedor', 'Aprobación'];
  const TONOS_ETAPA = ['#B9CFE6', '#8FB3D9', '#5B90C4', '#3873AC', '#1F5A94', '#0D3D6B'];
  const conteoPorEtapa = {};
  ETAPAS_SECUENCIA.forEach(function (e) { conteoPorEtapa[e] = 0; });
  let enEspera = 0;
  propuestas.forEach(function (p) {
    const etapa = p.etapa_propuesta || 'Creada';
    if (etapa === 'En espera') { enEspera++; return; }
    if (conteoPorEtapa[etapa] !== undefined) conteoPorEtapa[etapa]++;
  });
  const totalPipeline = Math.max(1, propuestas.length);

  const H_TIT = ppt_altoTexto_(10.5, 1), H_SUB = ppt_altoTexto_(8, 1);
  const ALTO_ITEM = H_TIT + H_SUB + 6, PASO_ITEM = ALTO_ITEM + 6;

  const ALTO_BARRA_PIPE = 22;
  const ALTO_LBL_PIPE = ppt_altoGlifos_(7.5);
  const ALTO_LEYENDA_PIPE = ppt_altoTexto_(6.5, 2);
  const ALTO_BLOQUE_PIPE = ALTO_LBL_PIPE + 4 + ALTO_BARRA_PIPE + 6 + ALTO_LEYENDA_PIPE + 12;

  // Primera página tiene menos lugar (le resta el bloque de pipeline); el resto usa el alto
  // completo, igual que cualquier otra slide paginada del deck.
  const POR_PAG_PRIMERA = Math.max(0, Math.floor((ESTILO_PPT.ALTO - Y_CONTENIDO_INICIAL - ALTO_BLOQUE_PIPE - 8) / PASO_ITEM));
  const POR_PAG_RESTO = Math.max(1, Math.floor((ESTILO_PPT.ALTO - Y_CONTENIDO_INICIAL - 8) / PASO_ITEM));

  const paginas = [];
  if (items.length <= POR_PAG_PRIMERA) {
    paginas.push(items);
  } else {
    paginas.push(items.slice(0, POR_PAG_PRIMERA));
    ppt_paginar_(items.slice(POR_PAG_PRIMERA), POR_PAG_RESTO).forEach(function (p) { paginas.push(p); });
  }

  paginas.forEach(function (pagina, idxPag) {
    const slide = ppt_nuevaSlide_();
    ppt_fondoClaro_(slide);
    ppt_encabezado_(slide, 'Propuestas' + (idxPag > 0 ? ' (cont.)' : ''),
      idxPag === 0
        ? 'Pipeline hacia convertirse en proyecto, y detalle de cada una pendiente de aprobación'
        : 'Todavía no forman parte del portafolio activo — pendientes de aprobación por el Responsable del área');

    let y = Y_CONTENIDO_INICIAL;

    if (idxPag === 0) {
      ppt_texto_(slide, 'PIPELINE · ' + propuestas.length + ' PENDIENTES', 34, y, 400, ALTO_LBL_PIPE,
        { tam: 7.5, negrita: true, color: ESTILO_PPT.GRIS, altoFijo: true });
      y += ALTO_LBL_PIPE + 4;

      let x = 34;
      const segmentos = [];
      ETAPAS_SECUENCIA.forEach(function (etapa, idx) {
        const n = conteoPorEtapa[etapa];
        const ancho = Math.round(652 * n / totalPipeline);
        if (ancho <= 0) return;
        ppt_rect_(slide, x, y, ancho, ALTO_BARRA_PIPE, TONOS_ETAPA[idx], true);
        if (ancho >= 18) {
          ppt_texto_(slide, String(n), x, y, ancho, ALTO_BARRA_PIPE,
            { tam: 8.5, negrita: true, color: ESTILO_PPT.BLANCO, medio: true, altoFijo: true, alinear: SlidesApp.ParagraphAlignment.CENTER });
        }
        segmentos.push(etapa + ' (' + n + ')');
        x += ancho;
      });
      y += ALTO_BARRA_PIPE + 6;

      const textoLeyenda = segmentos.join('   ·   ') + (enEspera > 0 ? '   ·   En espera (' + enEspera + ')' : '');
      const charsLinea = Math.max(10, Math.floor((652 - PPT_INSET_H) / (6.5 * 0.52)));
      ppt_texto_(slide, ppt_acotar_(textoLeyenda, charsLinea * 2), 34, y, 652, ALTO_LEYENDA_PIPE,
        { tam: 6.5, negrita: true, color: ESTILO_PPT.GRIS });

      y = Y_CONTENIDO_INICIAL + ALTO_BLOQUE_PIPE;
    }

    pagina.forEach(function (item) {
      ppt_rect_(slide, 34, y, 652, ALTO_ITEM, ESTILO_PPT.PANEL, true);
      ppt_rect_(slide, 34, y, 3, ALTO_ITEM, item.color);
      ppt_texto_(slide, item.etiqueta, 48, y, 96, ALTO_ITEM, { tam: 7.5, negrita: true, color: item.color, medio: true });
      ppt_texto_(slide, ppt_acotarParaAncho_(item.titulo, 380, 10.5, true), 152, y + 3, 380, H_TIT, { tam: 10.5, negrita: true });
      ppt_texto_(slide, ppt_acotarParaAncho_(item.sub, 500, 8, false), 152, y + 3 + H_TIT, 500, H_SUB, { tam: 8, color: ESTILO_PPT.GRIS });
      y += PASO_ITEM;
    });
  });
}

export function construirSlidesLogros_(datos, baseline, corte, hitosFlat, corteStr, areaObjetivo) {
  const hayCorte = !!corte;

  const entradas = [], salidas = [];

  // Completadas este ciclo → salen del flujo activo "en construcción"
  datos.iniciativas.forEach(function (it) {
    const base = baseline[it.id];
    const avance = Number(it.avance) || 0;
    if (avance >= 100 && base && Number(base.avance) < 100) {
      salidas.push({ nombre: it.nombre, area: it.area, responsable: it.responsable, estadoTxt: '✓ Completada · 100%', colorEstado: ESTILO_ALT4.VERDE_OK });
    }
  });

  if (hayCorte) {
    const idsActivos = {};
    datos.iniciativas.forEach(function (it) { idsActivos[it.id] = true; });
    // "Archivada este período" se decide con fecha_archivado (campo real en Iniciativas), NO con
    // la existencia en baseline — ver nota histórica: baseline es cierto para siempre una vez que
    // existe un solo registro, lo que hacía reaparecer archivadas viejas en todos los ciclos.
    leerHojaComoObjetos_('Iniciativas').forEach(function (fila) {
      const archivada = fila.archivada === true || fila.archivada === 'TRUE' || fila.archivada === 'true';
      if (!archivada || idsActivos[fila.id]) return;
      const fechaArchivado = (0, ENLACES.parsearFecha_)(fila.fecha_archivado);
      if (!fechaArchivado || fechaArchivado <= corte) return;
      if (areaObjetivo && !(0, ENLACES.iniciativaPerteneceAArea_)(fila.area, areaObjetivo)) return;
      salidas.push({ nombre: fila.nombre, area: fila.area, responsable: fila.responsable, estadoTxt: '✕ Archivada · quedó en ' + (Number(fila.avance) || 0) + '%', colorEstado: ESTILO_ALT4.TEXTO_SEC });
    });

    // Nuevas este ciclo: fecha_creacion real, NO ausencia en baseline (mismo motivo que arriba).
    datos.iniciativas.forEach(function (it) {
      const fechaCreacion = (0, ENLACES.parsearFecha_)(it.fecha_creacion);
      if (fechaCreacion && fechaCreacion > corte) {
        entradas.push({ nombre: it.nombre, area: it.area, categoria: it.categoria, responsable: it.responsable });
      }
    });
  }

  if (entradas.length === 0 && salidas.length === 0) return;

  // ── Centro: estadísticas generales del portafolio, no ejemplos puntuales — el centro no
  // pretende representar "el portafolio activo" con 1-2 tarjetas de muestra (eso no calza:
  // o se muestran todas, o no se pretende representar la totalidad). Números agregados en
  // cambio sí describen el todo de verdad con el espacio de una tarjeta. ──────────────────────
  const propuestasActivas = leerHojaComoObjetos_('Propuestas').filter(function (p) {
    return String(p.resultado || 'Pendiente') === 'Pendiente' && p.nombre &&
      (!areaObjetivo || (0, ENLACES.iniciativaPerteneceAArea_)(p.area, areaObjetivo));
  });
  let nVerde = 0, nAmbar = 0, nRojo = 0;
  datos.iniciativas.forEach(function (it) {
    if (it.salud_rag === 'Rojo') nRojo++;
    else if (it.salud_rag === 'Ambar') nAmbar++;
    else nVerde++;
  });
  const totalActivas = datos.iniciativas.length + propuestasActivas.length;

  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const W_COL = (ANCHO_DISP - 60) / 3, X_ENT = X0, X_CEN = X0 + W_COL + 30, X_SAL = X0 + (W_COL + 30) * 2;
  const ALTO_TARJ = 58, GAP_TARJ = 10;

  function tarjetaMov_(slide, x, y, w, colorBorde, nombre, linea1, linea2) {
    ppt_rect_(slide, x, y, w, ALTO_TARJ, ESTILO_PPT.BLANCO, false);
    ppt_rect_(slide, x, y, 3, ALTO_TARJ, colorBorde);
    ppt_texto_(slide, ppt_acotarParaAncho_(nombre, w - 24, 11, true), x + 14, y + 10, w - 24, ppt_altoTexto_(11, 1),
      { tam: 11, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
    if (linea1) ppt_texto_(slide, ppt_acotarParaAncho_(linea1, w - 24, 8.5, false), x + 14, y + 27, w - 24, ppt_altoTexto_(8.5, 1),
      { tam: 8.5, color: linea1.startsWith('✓') || linea1.startsWith('✕') ? colorBorde : ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    if (linea2) ppt_texto_(slide, ppt_acotarParaAncho_(linea2, w - 24, 8.5, false), x + 14, y + 40, w - 24, ppt_altoTexto_(8.5, 1),
      { tam: 8.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  }

  const slide = ppt_nuevaSlide_();
  ppt_alt4Fondo_(slide, 'Vigilancia del portafolio', areaObjetivo || '');
  const yCuerpo = ppt_alt4Header_(slide, 'Movimientos del ciclo', (entradas.length + salidas.length) + ' MOVIMIENTOS', ALT4_PALETA_ACTIVA.accent);
  ppt_texto_(slide, 'Entradas y salidas del portafolio activo' + (corteStr ? ' desde el corte anterior del ' + corteStr : ' de los últimos 15 días'),
    X0, yCuerpo, ANCHO_DISP, ppt_altoTexto_(9, 1), { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

  const yTitulos = yCuerpo + ppt_altoTexto_(9, 1) + 30;
  const yFlecha = yTitulos + 14;
  const yTarjetas = yFlecha + 20;

  // ENTRARON
  ppt_texto_(slide, 'ENTRARON (' + entradas.length + ')', X_ENT, yTitulos, W_COL, ppt_altoTexto_(10.5, 1),
    { tam: 10.5, negrita: true, color: ESTILO_ALT4.AZUL, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_rect_(slide, X_ENT + 10, yFlecha, W_COL - 30, 1.5, ESTILO_ALT4.AZUL);
  ppt_forma_(slide, SlidesApp.ShapeType.RIGHT_ARROW, X_ENT + W_COL - 26, yFlecha - 5, 14, 11).getFill().setSolidFill(ESTILO_ALT4.AZUL);
  let yy = yTarjetas;
  entradas.slice(0, 5).forEach(function (it) {
    tarjetaMov_(slide, X_ENT, yy, W_COL, ESTILO_ALT4.AZUL, it.nombre,
      [it.area, it.categoria].filter(Boolean).join(' · '), it.responsable ? 'Responsable: ' + it.responsable : '');
    yy += ALTO_TARJ + GAP_TARJ;
  });

  // CENTRO: estadísticas
  ppt_texto_(slide, 'PORTAFOLIO ACTIVO', X_CEN, yTitulos, W_COL, ppt_altoTexto_(10.5, 1),
    { tam: 10.5, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, String(totalActivas), X_CEN, yTarjetas - 6, W_COL, ppt_altoTexto_(32, 1),
    { tam: 32, negrita: true, color: ESTILO_ALT4.TEXTO, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: 'Georgia', altoFijo: true });
  ppt_texto_(slide, 'iniciativas en curso', X_CEN, yTarjetas + 28, W_COL, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_rect_(slide, X_CEN + 20, yTarjetas + 48, W_COL - 40, 1, '#E8E4DA');
  const xMitad = X_CEN + W_COL / 2;
  ppt_texto_(slide, String(datos.iniciativas.length), X_CEN, yTarjetas + 58, W_COL / 2, ppt_altoTexto_(16, 1),
    { tam: 16, negrita: true, color: ESTILO_ALT4.TEXTO, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
  ppt_texto_(slide, 'Proyectos', X_CEN, yTarjetas + 76, W_COL / 2, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_TERC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, String(propuestasActivas.length), xMitad, yTarjetas + 58, W_COL / 2, ppt_altoTexto_(16, 1),
    { tam: 16, negrita: true, color: ESTILO_ALT4.TEXTO, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
  ppt_texto_(slide, 'Propuestas', xMitad, yTarjetas + 76, W_COL / 2, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_TERC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_rect_(slide, X_CEN + 20, yTarjetas + 96, W_COL - 40, 1, '#E8E4DA');
  const filasRag = [['en plazo', nVerde, ESTILO_ALT4.VERDE_OK], ['en riesgo', nAmbar, ESTILO_ALT4.AMBAR_TEXTO], ['críticas', nRojo, ALT4_PALETA_ACTIVA.accent]];
  filasRag.forEach(function (f, i) {
    const yF = yTarjetas + 108 + i * 16;
    ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, X_CEN + 26, yF + 3, 7, 7).getFill().setSolidFill(f[2]);
    ppt_texto_(slide, f[1] + ' ' + f[0], X_CEN + 40, yF, W_COL - 60, ppt_altoTexto_(9, 1),
      { tam: 9, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  });

  if (datos.standBy > 0) ppt_texto_(slide, 'Stand By: ' + datos.standBy, X_CEN, yTarjetas + 108 + filasRag.length * 16 + 6, W_COL, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });

  // SALIERON
  ppt_texto_(slide, 'SALIERON (' + salidas.length + ')', X_SAL, yTitulos, W_COL, ppt_altoTexto_(10.5, 1),
    { tam: 10.5, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
  ppt_rect_(slide, X_SAL + 10, yFlecha, W_COL - 30, 1.5, ESTILO_ALT4.TEXTO_SEC);
  ppt_forma_(slide, SlidesApp.ShapeType.RIGHT_ARROW, X_SAL + W_COL - 26, yFlecha - 5, 14, 11).getFill().setSolidFill(ESTILO_ALT4.TEXTO_SEC);
  yy = yTarjetas;
  salidas.slice(0, 5).forEach(function (it) {
    tarjetaMov_(slide, X_SAL, yy, W_COL, it.colorEstado, it.nombre, it.estadoTxt,
      [it.area, it.responsable].filter(Boolean).join(' · '));
    yy += ALTO_TARJ + GAP_TARJ;
  });

  const yPie = ESTILO_PPT.ALTO - 20;
  ppt_texto_(slide, 'Portafolio IT Operaciones' + (corteStr ? ' · corte ' + corteStr : ''), X0, yPie, ANCHO_DISP, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

/** PRESUPUESTO DEL PORTAFOLIO: solo si hay montos cargados (suma de asignado > 0). Tarjeta oscura
 *  con total asignado/gastado/% de ejecución, y desglose por categoría con mini-barras. */
function construirSlidePresupuesto_(datos) {
  let totalAsignado = 0, totalGastado = 0;
  const porCategoria = {};
  datos.iniciativas.forEach(function (it) {
    const asig = Number(it.presupuesto_asignado) || 0;
    const gast = Number(it.presupuesto_gastado) || 0;
    if (asig <= 0 && gast <= 0) return;
    totalAsignado += asig;
    totalGastado += gast;
    const cat = it.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = { asignado: 0, gastado: 0 };
    porCategoria[cat].asignado += asig;
    porCategoria[cat].gastado += gast;
  });
  if (totalAsignado <= 0) return;

  const pct = Math.round(totalGastado / totalAsignado * 100);
  const slide = ppt_nuevaSlide_();
  ppt_fondoClaro_(slide);
  ppt_encabezado_(slide, 'Presupuesto del portafolio', 'Ejecución sobre lo asignado, según montos cargados por proyecto');

  // Tarjeta oscura principal
  ppt_rect_(slide, 34, 76, 300, 150, ESTILO_PPT.NEGRO, true);
  ppt_texto_(slide, 'EJECUCIÓN DEL PRESUPUESTO', 50, 86, 268, 12, { tam: 7.5, negrita: true, color: ESTILO_PPT.GRIS_SUAVE });
  ppt_texto_(slide, pct + '%', 50, 98, 140, 42, { tam: 32, negrita: true, color: ESTILO_PPT.BLANCO });
  ppt_texto_(slide, 'Gastado: ' + ppt_monto_(totalGastado) + '  ·  Asignado: ' + ppt_monto_(totalAsignado), 50, 150, 268, 14, { tam: 9, color: ESTILO_PPT.GRIS_CLARO });
  ppt_rect_(slide, 50, 172, 268, 10, '#3A3A3A');
  if (pct > 0) ppt_rect_(slide, 50, 172, Math.max(4, Math.min(268, 268 * pct / 100)), 10, ESTILO_PPT.ROJO);
  ppt_texto_(slide, (pct > 100 ? 'Sobregiro de ' + ppt_monto_(totalGastado - totalAsignado) : 'Disponible: ' + ppt_monto_(totalAsignado - totalGastado)), 50, 192, 268, 14, { tam: 8.5, negrita: true, color: pct > 100 ? ESTILO_PPT.ROJO_CLARO : ESTILO_PPT.VERDE_CLARO });

  // Desglose por categoría (hasta 7 filas, ordenado por asignado desc)
  ppt_texto_(slide, 'POR CATEGORÍA', 368, 78, 300, 12, { tam: 7.5, negrita: true, color: ESTILO_PPT.GRIS });
  const cats = Object.keys(porCategoria).sort(function (a, b) { return porCategoria[b].asignado - porCategoria[a].asignado; }).slice(0, 7);
  let y = 94;
  cats.forEach(function (cat) {
    const d = porCategoria[cat];
    const pctCat = d.asignado > 0 ? Math.round(d.gastado / d.asignado * 100) : 0;
    ppt_texto_(slide, ppt_acotar_(cat, 28), 368, y, 180, 13, { tam: 8.5, negrita: true });
    ppt_rect_(slide, 552, y + 2, 90, 8, '#E4E4E4');
    if (pctCat > 0) ppt_rect_(slide, 552, y + 2, Math.max(3, Math.min(90, 90 * pctCat / 100)), 8, ESTILO_PPT.ROJO);
    ppt_texto_(slide, ppt_monto_(d.gastado) + '/' + ppt_monto_(d.asignado), 368, y + 13, 180, 11, { tam: 7, color: ESTILO_PPT.GRIS_SUAVE });
    y += 32;
  });

  // Nota al pie
  ppt_texto_(slide, 'Solo se consideran proyectos con presupuesto cargado (' + datos.iniciativas.filter(function (it) { return (Number(it.presupuesto_asignado) || 0) > 0; }).length + ' de ' + datos.iniciativas.length + ')', 34, 372, 500, 13, { tam: 7.5, color: ESTILO_PPT.GRIS_SUAVE });
}

/** PRÓXIMOS HITOS — línea de tiempo gráfica del portafolio: hitos pendientes ATRASADOS (zona
 *  roja a la izquierda del marcador HOY) más los de los próximos 45 días. Puntos equiespaciados
 *  en orden cronológico con etiquetas en zigzag (nombre arriba/abajo alternado + fecha e
 *  iniciativa), marcador HOY con línea vertical. Se omite si no hay ninguno. 8 por slide. */
/** PRÓXIMOS HITOS — eje temporal compartido + mini-línea por proyecto (5 por slide).
 *
 *  Diseño:
 *  • Un eje horizontal con ticks semanales y fechas reales corre en la parte superior,
 *    compartido por todos los proyectos de la slide. Las guías punteadas verticales bajan
 *    por todas las filas para facilitar la lectura cruzada.
 *  • La línea HOY (roja) atraviesa el eje y todas las filas simultáneamente.
 *  • Zona "ATRASADOS" sombreada en rojo suave a la izquierda de HOY.
 *  • Cada proyecto ocupa una fila con su propia mini-línea horizontal sobre el mismo eje.
 *    Los hitos son círculos + chip de nombre·fecha, alternados arriba/abajo.
 *  • 5 proyectos por slide → paginación limpia sin colisión posible.
 *  • Agrupa por iniciativa: si una iniciativa tiene múltiples hitos los muestra todos en
 *    su fila, no como filas separadas (a diferencia del diseño anterior que los trataba
 *    como entradas independientes).
 */
/** Próximos hitos (Alt4) — timeline COMPARTIDO, no barras independientes por fila. Todas las
 *  filas usan el MISMO eje de fechas (la ventana fija de -15/+45 días), así que la posición de
 *  cada punto es directamente comparable entre proyectos, y una línea de "HOY" atraviesa todas
 *  las filas a la vez — de ahí sale la sensación de paso de tiempo que las barras independientes
 *  (una escala 0-100% distinta por fila) no podían dar, aunque fueran correctas.
 *
 *  Cada fila se redujo a UNA sola línea (nombre + pista fina con puntos) en vez de nombre + barra
 *  + 2 fechas + hasta 2 líneas de chips envueltos — así entran muchas más por slide. El precio:
 *  ya no se ve el NOMBRE de cada hito en la slide (antes sí, como chip) — solo su posición y si
 *  está atrasado o no. El detalle por nombre sigue disponible en la Ficha de cada proyecto.
 *
 *  Los puntos se posicionan por % sobre la pista — eso es geometría, no texto, así que no aplica
 *  la regla de "nunca texto por % en un eje compartido" de la guía de estilo (esa regla es
 *  específicamente sobre ETIQUETAS de texto colisionando, no sobre elementos gráficos). */
/** Próximos hitos (Alt4) — timeline COMPARTIDO: todas las filas usan el MISMO eje de fechas (la
 *  ventana fija de -15/+45 días), con una línea de "HOY" que atraviesa todas las filas a la vez —
 *  eso da la sensación de paso de tiempo comparable entre proyectos que una escala independiente
 *  por fila no puede dar.
 *
 *  El nombre de cada hito SÍ se muestra (es el driver de la slide) — como una segunda línea
 *  angosta debajo de la pista, en orden cronológico, en vez de como chip individual posicionado
 *  por fecha exacta (eso es lo que causaba colisión de texto con fechas cercanas). Los puntos en
 *  la pista sí se posicionan por %, porque son geometría, no texto — no aplica la regla de "nunca
 *  texto por % en un eje compartido" de la guía de estilo.
 *
 *  IMPORTANTE — un solo sistema de coordenadas para TODO lo que depende de fecha (xAbs_), sin
 *  valores sueltos calculados aparte: la primera versión posicionaba los puntos con su offset
 *  DENTRO de la pista pero sin sumar dónde arranca la pista en la slide, y terminaban pegados
 *  contra el nombre del proyecto en vez de sobre la pista. */
/** Próximos hitos (Alt4) — timeline COMPARTIDO: todas las filas usan el MISMO eje de fechas (la
 *  ventana fija de -15/+45 días), con una línea de "HOY" que atraviesa todas las filas a la vez.
 *  El nombre del proyecto y el de cada hito se muestran COMPLETOS, sin truncar — por eso el
 *  nombre del proyecto va en su propia línea a ancho completo (no apretado en una columna angosta
 *  al lado del timeline), y la lista de hitos se ENVUELVE a 2 líneas si hace falta en vez de
 *  cortarse con "…". El timeline en sí (pista + puntos) también pasa a ancho completo, ganando
 *  resolución para separar fechas cercanas.
 *
 *  Cada fila mide 3 líneas de alto variable (nombre / timeline / hitos) — se pagina por altura
 *  REAL acumulada (ppt_lineasNecesarias_ para saber si los hitos entran en 1 o 2 líneas), no por
 *  una cantidad fija de filas por página.
 *
 *  Los puntos en la pista se posicionan por % — es geometría, no texto, no aplica la regla de
 *  "nunca texto por % en un eje compartido" de la guía de estilo. Un solo sistema de coordenadas
 *  (xAbs_) para todo lo que depende de fecha: eje, HOY, puntos, barra — para no repetir el bug de
 *  offsets sueltos de la primera versión. */
/** Próximos hitos (Alt4) — timeline COMPARTIDO: todas las filas usan el MISMO eje de fechas (la
 *  ventana fija de -15/+45 días), con una línea de "HOY" que atraviesa todas las filas a la vez.
 *  Nombre de proyecto e hitos siempre completos (nunca truncados) — el nombre en su propia línea
 *  a ancho completo, el timeline debajo también a ancho completo, y la lista de hitos se ENVUELVE
 *  a 2 líneas si hace falta.
 *
 *  Cada punto del timeline lleva su NÚMERO, y ese mismo número abre su nombre en la lista de abajo
 *  — sin esto, con 4+ hitos o fechas muy cercanas, no había forma de saber qué punto correspondía
 *  a qué nombre sin contar posición a ojo. Si 2+ hitos caen muy cerca en el tiempo, se separan con
 *  un desplazamiento mínimo para que sus círculos no se fundan en uno solo.
 *
 *  Paginación por altura REAL acumulada (ppt_lineasNecesarias_ para saber si los hitos entran en
 *  1 o 2 líneas) — nunca dejar una fila cortada contra el borde inferior de la slide: se verifica
 *  ANTES de dibujar cada fila si entra completa en el espacio que queda, no después. */
export function construirSlidesProximosHitos_(hitosFlat, corteStr) {
  const hoy = new Date();
  const DIAS_ATRAS = 15, DIAS_FUTURO = 45;
  const limiteMax = new Date(hoy.getTime() + DIAS_FUTURO * 24 * 3600 * 1000);
  const limiteMin = new Date(hoy.getTime() - DIAS_ATRAS * 24 * 3600 * 1000);
  const rangoTotal = limiteMax.getTime() - limiteMin.getTime();
  function frac_(fecha) { return Math.max(0, Math.min(1, (fecha.getTime() - limiteMin.getTime()) / rangoTotal)); }

  const hitosVentana = hitosFlat.filter(function (h) {
    return h.fecha && h.fecha >= limiteMin && h.fecha <= limiteMax && (0, ENLACES.muestraDetalle_)(h.mostrar_detalle);
  });
  if (hitosVentana.length === 0) return;

  const porIniciativa = {};
  hitosVentana.forEach(function (h) {
    const key = h.iniciativa_id || h.iniciativa || 'sin_id_' + Math.random();
    if (!porIniciativa[key]) porIniciativa[key] = { nombre: h.iniciativa, area: h.area || '', hitos: [] };
    porIniciativa[key].hitos.push(h);
  });
  const filas = Object.keys(porIniciativa).map(function (k) {
    porIniciativa[k].hitos.sort(function (a, b) { return a.fecha - b.fecha; });
    return porIniciativa[k];
  });
  filas.sort(function (a, b) {
    const aAtras = a.hitos.some(function (h) { return !h.completado && h.fecha < hoy; }) ? 0 : 1;
    const bAtras = b.hitos.some(function (h) { return !h.completado && h.fecha < hoy; }) ? 0 : 1;
    if (aAtras !== bAtras) return aAtras - bAtras;
    return a.hitos[0].fecha - b.hitos[0].fecha;
  });
  const totalAtrasados = hitosFlat.filter(function (h) { return !h.completado && h.fecha && h.fecha < hoy; }).length;

  // ── Único sistema de coordenadas para todo lo que depende de fecha ──
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20;
  const ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const X_PISTA0 = X0, W_PISTA = ANCHO_DISP;
  function xAbs_(fecha) { return X_PISTA0 + W_PISTA * frac_(fecha); }

  const TAM_NOMBRE = 10.5, TAM_HITOS = 7.5, ALTO_PISTA = 5, R_DOT = 6.5;
  const GAP1 = 3, GAP2 = 8, GAP_FILA = 10;
  const SEP_MIN = 13; // separación mínima entre centros de 2 puntos, para que no se fundan

  function textoHitosNumerado_(fila) {
    return fila.hitos.map(function (h, i) { return (i + 1) + ' ' + h.nombre + ' (' + fmtCortoHito_(h.fecha) + ')'; }).join('  ·  ');
  }
  function altoFila_(fila) {
    const lineasHitos = ppt_lineasNecesarias_(textoHitosNumerado_(fila), ANCHO_DISP, TAM_HITOS, false);
    // GAP1 le da lugar al radio del punto por ARRIBA de la pista (el punto es más alto que la
    // pista y sobresale para los 2 lados de su centro) — antes solo se contaba el diámetro total
    // sin reservar ese espacio de más arriba, y el punto podía pisar la línea del nombre.
    return ppt_altoTexto_(TAM_NOMBRE, 1) + GAP1 + R_DOT + R_DOT + GAP2 + ppt_altoTexto_(TAM_HITOS, lineasHitos) + GAP_FILA;
  }

  const yCuerpoBase = 24 + ppt_altoTexto_(19, 1) + 14 + ppt_altoTexto_(9, 1) + 10;
  const ALTO_EJE = 26;
  const altoDisponible = ESTILO_PPT.ALTO - 30 - yCuerpoBase - ALTO_EJE - 6;

  // Paginación por altura ACUMULADA real — se decide ANTES de sumar la fila si entra completa,
  // nunca después: así ninguna fila queda cortada contra el borde inferior de la slide.
  const paginas = [];
  let paginaActual = [], altoAcum = 0;
  filas.forEach(function (fila) {
    const h = altoFila_(fila);
    if (altoAcum + h > altoDisponible && paginaActual.length > 0) { paginas.push(paginaActual); paginaActual = []; altoAcum = 0; }
    paginaActual.push(fila); altoAcum += h;
  });
  if (paginaActual.length > 0 || paginas.length === 0) paginas.push(paginaActual);

  paginas.forEach(function (pagina, idxPag) {
    const sufijoPag = paginas.length > 1 ? ' (' + (idxPag + 1) + ' de ' + paginas.length + ')' : '';
    const slide = ppt_nuevaSlide_();
    ppt_alt4Fondo_(slide, 'Planificación', '');
    const yCuerpo = ppt_alt4Header_(slide, 'Próximos hitos' + sufijoPag, DIAS_FUTURO + ' DÍAS', ALT4_PALETA_ACTIVA.accent);
    ppt_texto_(slide, 'Atrasados + próximos ' + DIAS_FUTURO + ' días · misma escala de tiempo para todos los proyectos',
      X0, yCuerpo, ANCHO_DISP, ppt_altoTexto_(9, 1), { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

    // Eje de fechas compartido — 4 marcas parejas, todas via xAbs_ (mismo sistema que los puntos).
    const yEje = yCuerpo + ppt_altoTexto_(9, 1) + 16;
    ppt_rect_(slide, X_PISTA0, yEje, W_PISTA, 1, '#D4CFC4');
    [0, 1 / 3, 2 / 3, 1].forEach(function (f) {
      const fecha = new Date(limiteMin.getTime() + rangoTotal * f);
      const x = xAbs_(fecha);
      ppt_rect_(slide, x, yEje - 2, 1, 5, '#B8B2A6');
      const align = f === 0 ? SlidesApp.ParagraphAlignment.START : (f === 1 ? SlidesApp.ParagraphAlignment.END : SlidesApp.ParagraphAlignment.CENTER);
      const xTxt = f === 0 ? x : (f === 1 ? x - 60 : x - 30);
      ppt_texto_(slide, fmtCortoHito_(fecha), xTxt, yEje - 14, 60, ppt_altoTexto_(7, 1),
        { tam: 7, color: ESTILO_ALT4.TEXTO_TERC, alinear: align, fuente: ESTILO_ALT4.FUENTE });
    });
    const xHoy = xAbs_(hoy);
    ppt_texto_(slide, 'HOY', xHoy - 15, yEje + 4, 30, ppt_altoTexto_(6.5, 1),
      { tam: 6.5, negrita: true, color: ALT4_PALETA_ACTIVA.accent, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });

    const yFilasIni = yEje + 20;
    let y = yFilasIni;
    // Si esta página se queda sin espacio real a último momento (redondeos), no seguir dibujando
    // filas por debajo del límite disponible — mejor una fila menos que una cortada.
    const yTope = yFilasIni + altoDisponible;
    pagina.forEach(function (fila) {
      const altoEstaFila = altoFila_(fila);
      if (y + altoEstaFila > yTope + 2) return; // resguardo final del límite hacia abajo

      // Tarjeta blanca detrás de cada fila (antes el contenido flotaba directo sobre el fondo
      // crema, sin contención — mismo criterio de tarjetas que el resto del deck). Esquinas
      // rectas, no redondeadas. Un margen chico alrededor del contenido existente en vez de
      // reflotar cada coordenada X interna.
      const PAD_FILA_HITOS = 10;
      ppt_rect_(slide, X0 - PAD_FILA_HITOS, y - 8, ANCHO_DISP + PAD_FILA_HITOS * 2, altoEstaFila - 8, ESTILO_PPT.BLANCO, false);

      const nAtrasados = fila.hitos.filter(function (h) { return !h.completado && h.fecha < hoy; }).length;
      const colorFila = nAtrasados > 0 ? ALT4_PALETA_ACTIVA.accent : '#8A827A';

      const wBadge = nAtrasados > 0 ? 80 : 0;
      ppt_texto_(slide, ppt_acotarParaAncho_(fila.nombre, ANCHO_DISP - wBadge, TAM_NOMBRE, true), X0, y, ANCHO_DISP - wBadge, ppt_altoTexto_(TAM_NOMBRE, 1),
        { tam: TAM_NOMBRE, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      if (nAtrasados > 0) {
        const txt = nAtrasados + (nAtrasados === 1 ? ' atrasado' : ' atrasados');
        ppt_texto_(slide, txt, X0 + ANCHO_DISP - 80, y, 80, ppt_altoTexto_(TAM_NOMBRE, 1),
          { tam: 8.5, negrita: true, color: ALT4_PALETA_ACTIVA.accent, alinear: SlidesApp.ParagraphAlignment.END, fuente: ESTILO_ALT4.FUENTE });
      }

      // yCentro = centro vertical compartido por la pista y los puntos — GAP1 le da lugar al
      // radio del punto por arriba (el punto es más alto que la pista, sobresale para los 2
      // lados de su centro), así nunca pisa la línea del nombre arriba de él.
      const yCentro = y + ppt_altoTexto_(TAM_NOMBRE, 1) + GAP1 + R_DOT;
      const yPista = yCentro - ALTO_PISTA / 2;
      ppt_rect_(slide, X_PISTA0, yPista, W_PISTA, ALTO_PISTA, '#EDEAE2', true);
      const xIni = xAbs_(fila.hitos[0].fecha), xFin = xAbs_(fila.hitos[fila.hitos.length - 1].fecha);
      if (xFin > xIni) ppt_rect_(slide, xIni, yPista, xFin - xIni, ALTO_PISTA, colorFila, true);

      // Puntos numerados — con separación mínima si 2+ caen muy cerca (o el mismo día), para que
      // no se fundan visualmente en un solo círculo.
      const xsUsadas = [];
      fila.hitos.forEach(function (h, i) {
        const atrasado = !h.completado && h.fecha < hoy;
        let cx = xAbs_(h.fecha);
        while (xsUsadas.some(function (u) { return Math.abs(u - cx) < SEP_MIN; })) cx += SEP_MIN;
        cx = Math.min(cx, X_PISTA0 + W_PISTA - R_DOT);
        xsUsadas.push(cx);
        const yCentroDot = yCentro;
        const dot = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, cx - R_DOT, yCentroDot - R_DOT, R_DOT * 2, R_DOT * 2);
        if (atrasado) { dot.getFill().setSolidFill(colorFila); dot.getBorder().setTransparent(); }
        else { dot.getFill().setSolidFill(ESTILO_ALT4.FONDO); dot.getBorder().getLineFill().setSolidFill(colorFila); dot.getBorder().setWeight(1.2); }
        ppt_texto_(slide, String(i + 1), cx - R_DOT, yCentroDot - R_DOT, R_DOT * 2, R_DOT * 2,
          { tam: 6, negrita: true, color: atrasado ? ESTILO_PPT.BLANCO : colorFila,
            alinear: SlidesApp.ParagraphAlignment.CENTER, medio: true, altoFijo: true, fuente: ESTILO_ALT4.FUENTE });
      });

      // Nombres de los hitos, completos, cada uno con su número — se ENVUELVE a 2 líneas si hace
      // falta (misma medición que altoFila_), nunca se corta con "…".
      const nombresTxt = textoHitosNumerado_(fila);
      const lineasHitos = ppt_lineasNecesarias_(nombresTxt, ANCHO_DISP, TAM_HITOS, false);
      const yHitos = yCentro + R_DOT + GAP2;
      ppt_texto_(slide, nombresTxt, X0, yHitos, ANCHO_DISP, ppt_altoTexto_(TAM_HITOS, lineasHitos),
        { tam: TAM_HITOS, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

      y += altoEstaFila;
    });

    // Línea de HOY atravesando todas las filas realmente dibujadas en esta página.
    ppt_rect_(slide, xHoy, yFilasIni - 4, 0.75, y - yFilasIni, ALT4_PALETA_ACTIVA.accent);

    const yPie = ESTILO_PPT.ALTO - 22;
    ppt_rect_(slide, X0, yPie, ANCHO_DISP, 1, '#D4CFC4');
    ppt_texto_(slide, 'Hoy: ' + fmtCortoHito_(hoy) + ' · ' + totalAtrasados + ' hito(s) atrasado(s) en total', X0, yPie + 4, ANCHO_DISP, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE });
  });
}





function fmtCortoHito_(fecha) {
  return Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM');
}


/** ALERTAS DE ESTANCAMIENTO: iniciativas activas (no Stand By, no finalizadas, no archivadas) sin
 *  ningún avance en al menos 2 ciclos consecutivos (mismo avance que en los cortes N-1 y N-2).
 *  Se omite si no hay ninguna, o si aún no existen dos cortes para comparar. 6 por slide. */
export function construirSlidesAlertasEstancamiento_(datos, baseline, baseline2, corteStr, corte2Str) {
  const estancadas = datos.iniciativas.filter(function (it) {
    if (String(it.estado || '') === 'Stand By') return false;
    const avance = Number(it.avance) || 0;
    if (avance >= 100) return false;
    const b1 = baseline[it.id];
    const b2 = baseline2[it.id];
    if (!b1 || !b2) return false;
    return avance === (Number(b1.avance) || 0) && avance === (Number(b2.avance) || 0);
  });
  if (estancadas.length === 0) return;

  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const paginas = ppt_paginar_(estancadas, 2); // tarjetas grandes — 2 caben cómodas por slide
  paginas.forEach(function (pagina, idxPag) {
    const sufijoPag = paginas.length > 1 ? ' (' + (idxPag + 1) + ' de ' + paginas.length + ')' : '';
    const slide = ppt_nuevaSlide_();
    ppt_alt4Fondo_(slide, 'Vigilancia del portafolio', '');
    const yCuerpo = ppt_alt4Header_(slide, 'Alertas de estancamiento' + sufijoPag,
      estancadas.length + (estancadas.length === 1 ? ' ALERTA' : ' ALERTAS'), ALT4_PALETA_ACTIVA.accent);
    ppt_texto_(slide, 'Sin avance vs. los cortes del ' + (corte2Str || '—') + ' y del ' + (corteStr || '—') + ' — no declaradas en Stand By',
      X0, yCuerpo, ANCHO_DISP, ppt_altoTexto_(9, 1), { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

    const yPie = ESTILO_PPT.ALTO - 26;
    const yInicio = yCuerpo + ppt_altoTexto_(9, 1) + 16;
    const GAP_TARJETA = 12;
    // Tope de alto: con pocas alertas (1-2) una tarjeta que se reparte todo el espacio libre
    // queda absurdamente alta — mismo criterio que ya se aplicó acá antes.
    const altoTarjeta = Math.min(140, (yPie - yInicio - GAP_TARJETA * (pagina.length - 1)) / pagina.length);
    pagina.forEach(function (it, i) {
      const yTop = yInicio + i * (altoTarjeta + GAP_TARJETA);
      ppt_rect_(slide, X0, yTop, ANCHO_DISP, altoTarjeta, ESTILO_PPT.BLANCO, false);
      ppt_rect_(slide, X0, yTop, 5, altoTarjeta, ALT4_PALETA_ACTIVA.accent);
      const W_PCT = 90, X_TXT = X0 + 34 + W_PCT, W_TXT = ANCHO_DISP - 54 - W_PCT;
      const textoBloqueo = it.issue || it.riesgo;
      // Bloque de texto (nombre + detalle + bloqueador) centrado como unidad en la tarjeta, y
      // el "%" grande alineado a la MISMA altura que ese bloque — antes el % se centraba en
      // TODA la tarjeta mientras el texto quedaba pegado arriba, quedando desalineados entre sí.
      const hNombre = ppt_altoTexto_(14, 1), hDetalle = ppt_altoTexto_(9, 1), hBloqueo = textoBloqueo ? ppt_altoTexto_(9, 1) + 8 : 0;
      const altoBloqueTxt = hNombre + 4 + hDetalle + hBloqueo;
      const yTxt = yTop + Math.max(16, (altoTarjeta - altoBloqueTxt) / 2);
      ppt_texto_(slide, (Number(it.avance) || 0) + '%', X0 + 24, yTop + altoTarjeta / 2 - 20, W_PCT, ppt_altoTexto_(28, 1),
        { tam: 28, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
      ppt_texto_(slide, it.nombre, X_TXT, yTxt, W_TXT, hNombre,
        { tam: 14, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      ppt_texto_(slide, 'Detenida en ' + (Number(it.avance) || 0) + '% · Etapa: ' + (it.estado || '—') + ' · Responsable: ' + (it.responsable || 'sin asignar'),
        X_TXT, yTxt + hNombre + 4, W_TXT, hDetalle,
        { tam: 9, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
      if (textoBloqueo) {
        ppt_texto_(slide, ppt_acotarParaAncho_('Bloqueador actual: ' + textoBloqueo, W_TXT, 9, false),
          X_TXT, yTxt + hNombre + 4 + hDetalle + 8, W_TXT, ppt_altoTexto_(9, 1),
          { tam: 9, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      }
    });

    ppt_rect_(slide, X0, yPie, ANCHO_DISP, 1, '#D4CFC4');
    ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')),
      X0, yPie + 5, ANCHO_DISP, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  });
}

// ===================================================================
// PENDIENTES POR DECIDIR — pestaña DecisionesPendientes gestionada directamente en el Sheet.
// Columnas: id | pregunta | recomendacion | fecha_limite | iniciativa_id | estado | resolucion | fecha_resolucion
// Estados: Abierta (o vacío) → aparece en el deck; Resuelta → migra a Bitácora en la próxima
// generación oficial y pasa a Archivada; Archivada → ignorada.
// ===================================================================


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  fmtCortoHito_: { get: () => fmtCortoHito_, enumerable: true, configurable: true },
});
