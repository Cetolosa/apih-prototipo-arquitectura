import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, leerHojaComoObjetos_, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, PPT_INSET_H, Y_CONTENIDO_INICIAL, ppt_acotarParaAncho_, ppt_acotar_, ppt_altoGlifos_, ppt_altoTexto_, ppt_encabezado_, ppt_fondoClaro_, ppt_forma_, ppt_paginar_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
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
