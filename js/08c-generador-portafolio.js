import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, leerHojaComoObjetos_, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, PPT_INSET_H, Y_CONTENIDO_INICIAL, ppt_acotarParaAncho_, ppt_acotar_, ppt_altoGlifos_, ppt_altoTexto_, ppt_anchoParaTexto_, ppt_encabezado_, ppt_factorAncho_, ppt_fondoClaro_, ppt_fondo_, ppt_forma_, ppt_lineasEnAlto_, ppt_rect_, ppt_textoRotado90_, ppt_texto_ } from './08b-generador-primitivas.js';
// ===================================================================
// SLIDES
// ===================================================================

export function construirSlidePortada_(slide, etiquetaArea, cicloStr) {
  ppt_fondo_(slide, ESTILO_ALT4.FONDO_OSCURO);
  ppt_texto_(slide, 'PORTAFOLIO INICIATIVAS TI', 36, 34, 400, ppt_altoTexto_(9, 1),
    { tam: 9, negrita: true, color: ALT4_PALETA_ACTIVA.accent, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, etiquetaArea, 34, 130, 650, 90,
    { tam: 46, negrita: true, color: ESTILO_ALT4.FONDO, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
  ppt_texto_(slide, 'Portafolio completo — presentación quincenal', 36, 224, 500, ppt_altoTexto_(11, 1),
    { tam: 11, color: '#CBC6BB', fuente: ESTILO_ALT4.FUENTE });
  ppt_rect_(slide, 36, ESTILO_PPT.ALTO - 60, ESTILO_PPT.ANCHO - 72, 1, '#4A4744');
  const hoyStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  ppt_texto_(slide, cicloStr || hoyStr, 36, ESTILO_PPT.ALTO - 48, 300, ppt_altoTexto_(9, 1),
    { tam: 9, color: '#CBC6BB', fuente: ESTILO_ALT4.FUENTE });
}

export function construirSlideEjecutivo_(slide, datos, baseline, mensajePrincipal, corteStr, fechaCiclo, areaObjetivo) {
  ppt_alt4Fondo_(slide, 'Resumen ejecutivo', areaObjetivo || 'BISE');
  const yCuerpo = ppt_alt4Header_(slide, 'Cómo va el portafolio', 'VISIÓN CONSOLIDADA', ALT4_PALETA_ACTIVA.accent);
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20;
  ppt_texto_(slide,
    (corteStr ? 'Corte comparado contra el ' + corteStr + '.' : 'Primer ciclo — sin corte anterior registrado.') +
    ' No incluye iniciativas en Stand By.',
    X0, yCuerpo - 4, ESTILO_PPT.ANCHO - X0 - 34, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

  // ── Propuestas: mismo criterio que construirSlidePropuestas_/Pipeline_ — un solo criterio,
  // nunca desincronizado entre slides. ────────────────────────────────────────────────────
  const propuestasVisibles = leerHojaComoObjetos_('Propuestas').filter(function (p) {
    const resultado = p.resultado || 'Pendiente';
    if (resultado !== 'Pendiente') return false;
    return !areaObjetivo || (0, ENLACES.iniciativaPerteneceAArea_)(p.area, areaObjetivo);
  });
  const todasLasSolucionesProp = leerHojaComoObjetos_('SolucionesProveedor');
  const hoyProp = new Date();
  const fechaCicloISOProp = fechaCiclo ? Utilities.formatDate(fechaCiclo, Session.getScriptTimeZone(), 'yyyy-MM-dd') : null;
  let propConBloqueo = 0, propEnAprobacion = 0, propSumaDias = 0;
  let bucketTemprana = 0, bucketMedia = 0, bucketAprobacion = 0;
  const propuestasConDetalle = propuestasVisibles.map(function (p) {
    const soluciones = todasLasSolucionesProp.filter(function (s) { return s.propuesta_id === p.id; });
    const bloqueo = (0, ENLACES.calcularBloqueoPropuesta_)(p, soluciones);
    if (bloqueo) propConBloqueo++;
    const etapa = p.etapa_propuesta || 'Creada';
    if (etapa === 'Aprobación') { propEnAprobacion++; bucketAprobacion++; }
    else if (etapa === 'Caso de Negocio' || etapa === 'Soluciones de proveedor') bucketMedia++;
    else if (etapa !== 'En espera') bucketTemprana++;
    const fEtapa = (0, ENLACES.parsearFecha_)(p.fecha_etapa) || (0, ENLACES.parsearFecha_)(p.fecha_propuesta);
    const dias = fEtapa ? Math.floor((hoyProp - fEtapa) / (1000 * 3600 * 24)) : 0;
    propSumaDias += dias;
    const fFoco = (0, ENLACES.parsearFecha_)(p.foco_ciclo_fecha);
    const isoFoco = fFoco ? Utilities.formatDate(fFoco, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(p.foco_ciclo_fecha || '');
    const esFoco = !!fechaCicloISOProp && isoFoco === fechaCicloISOProp;
    return { nombre: p.nombre, etapa: etapa, dias: dias, bloqueo: bloqueo, esFoco: esFoco };
  }).sort(function (a, b) {
    // Las marcadas con Foco de ciclo coincidente van primero (mismo criterio que la columna de
    // proyectos foco), y dentro de cada grupo, las más estancadas primero — igual que antes.
    if (a.esFoco !== b.esFoco) return a.esFoco ? -1 : 1;
    return b.dias - a.dias;
  });

  // ── Datos calculados (Proyectos) ──────────────────────────────────────────
  const sinStandBy = datos.iniciativas.filter(function (it) { return String(it.estado || '') !== 'Stand By'; });
  const promedio = sinStandBy.length > 0
    ? Math.round(sinStandBy.reduce(function (a, it) { return a + (Number(it.avance) || 0); }, 0) / sinStandBy.length) : 0;
  const conBaseline = sinStandBy.filter(function (it) { return baseline[it.id]; });
  let deltaPortafolio = null;
  if (conBaseline.length > 0) {
    const promedioBase = Math.round(conBaseline.reduce(function (a, it) { return a + (Number(baseline[it.id].avance) || 0); }, 0) / conBaseline.length);
    const promedioActualMismoSet = Math.round(conBaseline.reduce(function (a, it) { return a + (Number(it.avance) || 0); }, 0) / conBaseline.length);
    deltaPortafolio = promedioActualMismoSet - promedioBase;
  }

  // ── COLUMNA IZQUIERDA (dos números grandes + grilla de mini-métricas + síntesis) ────────
  const Y_NUM = yCuerpo + 14;
  const ANCHO_IZQ = 300;
  ppt_texto_(slide, 'AVANCE DE PROYECTOS', X0, Y_NUM, 140, ppt_altoTexto_(6.5, 1),
    { tam: 6.5, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, promedio + '%', X0, Y_NUM + 9, 140, ppt_altoTexto_(30, 1),
    { tam: 30, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
  let subAvance = sinStandBy.length + ' de ' + datos.iniciativas.length + ' proyectos';
  if (deltaPortafolio !== null) subAvance = (deltaPortafolio > 0 ? '+' : '') + deltaPortafolio + ' pts vs. corte anterior · ' + subAvance;
  ppt_texto_(slide, subAvance, X0, Y_NUM + 40, 150, ppt_altoTexto_(6.5, 1),
    { tam: 6.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

  ppt_rect_(slide, X0 + 152, Y_NUM - 2, 1, 50, '#D4CFC4');
  ppt_texto_(slide, 'PIPELINE DE PROPUESTAS', X0 + 168, Y_NUM, 140, ppt_altoTexto_(6.5, 1),
    { tam: 6.5, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, String(propuestasVisibles.length), X0 + 168, Y_NUM + 9, 140, ppt_altoTexto_(30, 1),
    { tam: 30, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
  ppt_texto_(slide, 'propuestas pendientes', X0 + 168, Y_NUM + 40, 140, ppt_altoTexto_(6.5, 1),
    { tam: 6.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

  // Grilla de mini-métricas 3×2 (mismo bloque de KPIs, layout de tabla con separadores finos)
  const Y_MINI = Y_NUM + 58;
  const miniMetricas = [
    { n: datos.resumen.activas, l: 'Proyectos activos' },
    { n: datos.resumen.en_ejecucion, l: 'En ejecución' },
    { n: datos.resumen.criticas, l: 'Críticos', destacado: true },
    { n: propuestasVisibles.length, l: 'Propuestas pend.' },
    { n: propConBloqueo, l: 'Con bloqueo' },
    { n: propEnAprobacion, l: 'En aprobación' }
  ];
  const ANCHO_MINI = Math.floor(ANCHO_IZQ / 3);
  // FILA_ALTO=40 (antes 34): la etiqueta de la fila 0 (número + label) ocupa hasta +34 desde
  // su propio inicio — con paso 34 no quedaba nada de aire y la línea divisoria de la fila 1
  // caía encima del texto de la fila 0. Con 40 queda un hueco real de 6pt para la línea.
  const FILA_ALTO_MINI = 40;
  ppt_rect_(slide, X0, Y_MINI, ANCHO_IZQ, 1, '#D4CFC4');
  miniMetricas.forEach(function (m, i) {
    const col = i % 3, fila = Math.floor(i / 3);
    const x = X0 + col * ANCHO_MINI, y = Y_MINI + 6 + fila * FILA_ALTO_MINI;
    if (fila > 0) ppt_rect_(slide, x, y - 3, ANCHO_MINI - 6, 1, '#E8E4DA');
    ppt_texto_(slide, String(m.n), x, y, ANCHO_MINI - 10, ppt_altoTexto_(15, 1),
      { tam: 15, negrita: true, color: m.destacado ? ALT4_PALETA_ACTIVA.accentDeep : '#5A5652', fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, m.l, x, y + 18, ANCHO_MINI - 10, ppt_altoTexto_(6.5, 1),
      { tam: 6.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  });

  const Y_SINTESIS = Y_MINI + 6 + FILA_ALTO_MINI + 38;
  ppt_texto_(slide, ppt_acotar_(mensajePrincipal, 260), X0, Y_SINTESIS, ANCHO_IZQ, ESTILO_PPT.ALTO - Y_SINTESIS - 14,
    { tam: 7.5, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });

  // ── COLUMNA DERECHA (dos paneles con borde izquierdo de color, estilo mockup) ───────────
  const X_DER = X0 + ANCHO_IZQ + 24;
  const ANCHO_DER = ESTILO_PPT.ANCHO - 34 - X_DER;
  ppt_rect_(slide, X_DER - 12, Y_NUM - 2, 1, ESTILO_PPT.ALTO - (Y_NUM - 2) - 14, '#D4CFC4');

  // Panel 1: Foco del próximo ciclo — hasta 3 iniciativas RAG rojo/ámbar (o marcadas a mano)
  const fechaCicloISO = fechaCiclo ? Utilities.formatDate(fechaCiclo, Session.getScriptTimeZone(), 'yyyy-MM-dd') : null;
  const marcadasAMano = fechaCicloISO
    ? datos.iniciativas.filter(function (it) {
        const f = (0, ENLACES.parsearFecha_)(it.foco_ciclo_fecha);
        const iso = f ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(it.foco_ciclo_fecha || '');
        return iso === fechaCicloISO;
      })
    : [];
  const candidatas = marcadasAMano.length > 0
    ? marcadasAMano.slice().sort(function (a, b) {
        const pesoRag = { Rojo: 0, Ambar: 1, Verde: 2 };
        return (pesoRag[a.salud_rag] || 1) - (pesoRag[b.salud_rag] || 1);
      })
    : datos.iniciativas
        .filter(function (it) { return it.salud_rag === 'Rojo' || it.salud_rag === 'Ambar'; })
        .sort(function (a, b) {
          if (a.salud_rag === 'Rojo' && b.salud_rag !== 'Rojo') return -1;
          if (b.salud_rag === 'Rojo' && a.salud_rag !== 'Rojo') return 1;
          return 0;
        });
  const alertas = candidatas.slice(0, 3);

  let yPanel = Y_NUM;

  // Tarjeta blanca detrás del panel — antes vivía directo sobre el fondo crema del rail y se
  // veía "pegado". La altura se calcula ANTES de dibujar nada, con la misma aritmética que
  // usan los incrementos reales de yPanel más abajo (16 del título + 30 si no hay alertas, o
  // 32 por cada una) — y se dibuja PRIMERO: en Slides el orden de creación es el orden de
  // apilado, así que una tarjeta creada antes que la barra de acento y los textos queda detrás.
  // Esquinas cuadradas (false), igual que el resto de las tarjetas del deck.
  const altoPanel1 = 16 + (alertas.length === 0 ? 30 : alertas.length * 32);
  ppt_rect_(slide, X_DER - 6, yPanel - 6, ANCHO_DER + 6, altoPanel1 + 12, '#FFFFFF', false);

  ppt_rect_(slide, X_DER, yPanel, 2, 12, ALT4_PALETA_ACTIVA.accentDeep);
  ppt_texto_(slide, '🎯 FOCO DEL PRÓXIMO CICLO', X_DER + 10, yPanel, ANCHO_DER - 10, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE });
  yPanel += 16;
  if (alertas.length === 0) {
    ppt_texto_(slide, 'Sin proyectos críticos o en ámbar en este ciclo.', X_DER + 10, yPanel, ANCHO_DER - 10, 24,
      { tam: 7, color: ESTILO_ALT4.TEXTO_SEC, italica: true, fuente: ESTILO_ALT4.FUENTE });
    yPanel += 30;
  } else {
    alertas.forEach(function (it, i) {
      if (i > 0) ppt_rect_(slide, X_DER + 10, yPanel - 3, ANCHO_DER - 10, 1, '#E8E4DA');
      ppt_texto_(slide, ppt_acotarParaAncho_(it.nombre, ANCHO_DER - 10, 7.5, true), X_DER + 10, yPanel, ANCHO_DER - 10, ppt_altoTexto_(7.5, 1),
        { tam: 7.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      const motivo = it.riesgo || it.issue || it.estado || '—';
      ppt_texto_(slide, ppt_acotarParaAncho_(motivo, ANCHO_DER - 10, 7, false), X_DER + 10, yPanel + 10, ANCHO_DER - 10, ppt_altoTexto_(7, 1),
        { tam: 7, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
      yPanel += 32;
    });
  }

  // Panel 2: Propuestas que necesitan decisión — hasta 2 visibles + contador de resto
  yPanel += 20; // separa las dos tarjetas (antes 14, sin tarjeta no hacía falta más aire)
  const itemsProp = propuestasConDetalle.slice(0, 2);
  const restantesProp = propuestasConDetalle.length - itemsProp.length;
  const altoPanel2 = 16 + (itemsProp.length === 0 ? 24 : itemsProp.length * 24 + (restantesProp > 0 ? 18 : 0));
  ppt_rect_(slide, X_DER - 6, yPanel - 6, ANCHO_DER + 6, altoPanel2 + 12, '#FFFFFF', false);

  ppt_rect_(slide, X_DER, yPanel, 2, 12, ESTILO_ALT4.AMBAR_TEXTO);
  ppt_texto_(slide, '⏳ PROPUESTAS: NECESITAN DECISIÓN', X_DER + 10, yPanel, ANCHO_DER - 10, ppt_altoTexto_(7.5, 1),
    { tam: 7.5, negrita: true, color: ESTILO_ALT4.AMBAR_TEXTO, fuente: ESTILO_ALT4.FUENTE });
  yPanel += 16;
  if (itemsProp.length === 0) {
    ppt_texto_(slide, 'Sin propuestas pendientes en este ciclo.', X_DER + 10, yPanel, ANCHO_DER - 10, 24,
      { tam: 7, color: ESTILO_ALT4.TEXTO_SEC, italica: true, fuente: ESTILO_ALT4.FUENTE });
  } else {
    itemsProp.forEach(function (p, i) {
      if (i > 0) ppt_rect_(slide, X_DER + 10, yPanel - 3, ANCHO_DER - 10, 1, '#E8E4DA');
      ppt_texto_(slide, ppt_acotarParaAncho_(p.nombre, (ANCHO_DER - 10) * 0.55, 7.5, true), X_DER + 10, yPanel, (ANCHO_DER - 10) * 0.55, ppt_altoTexto_(7.5, 1),
        { tam: 7.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      const motivo = p.bloqueo || (p.dias >= 10 ? 'En espera · ' + p.dias + ' días' : p.etapa);
      ppt_texto_(slide, motivo, X_DER + 10 + (ANCHO_DER - 10) * 0.55, yPanel, (ANCHO_DER - 10) * 0.45, ppt_altoTexto_(7, 1),
        { tam: 7, color: ESTILO_ALT4.TEXTO_SEC, alinear: SlidesApp.ParagraphAlignment.END, fuente: ESTILO_ALT4.FUENTE });
      yPanel += 24;
    });
    if (restantesProp > 0) {
      ppt_texto_(slide, '+' + restantesProp + ' más en "Propuestas en evaluación"', X_DER + 10, yPanel + 4, ANCHO_DER - 10, ppt_altoTexto_(7, 1),
        { tam: 7, negrita: true, color: ESTILO_ALT4.AMBAR_TEXTO, fuente: ESTILO_ALT4.FUENTE });
    }
  }

  ppt_rect_(slide, X0, ESTILO_PPT.ALTO - 14, ESTILO_PPT.ANCHO - 34 - X0, 1, '#D4CFC4');
  ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')),
    X0, ESTILO_PPT.ALTO - 11, 400, ppt_altoTexto_(6.5, 1), { tam: 6.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

/** Mapa de riesgos: todos los riesgos ABIERTOS del portafolio (estado distinto de "Cerrado"),
 *  agrupados en 3 columnas por severidad (Alto/Medio/Bajo) — mismo patrón de densidad adaptativa
 *  y paginación que construirSlidesImpactoEsfuerzo_. La severidad viene YA calculada de forma
 *  determinística (calcularSeveridadRiesgo_, dentro de generarMapaRiesgos_) — esta slide NUNCA
 *  depende de que haya datos externos para existir. Si no hay ningún riesgo abierto en el
 *  portafolio, no se agrega ninguna slide (evita una slide vacía en un ciclo sin riesgos). */
function construirSlidesMapaRiesgos_(mapaRiesgos) {
  const COLUMNAS = [
    { clave: 'alto', titulo: 'Alto', color: ESTILO_PPT.ROJO },
    { clave: 'medio', titulo: 'Medio', color: '#C08A1E' },
    { clave: 'bajo', titulo: 'Bajo', color: '#2E7D32' }
  ];

  const totalItems = COLUMNAS.reduce(function (acc, c) { return acc + (mapaRiesgos[c.clave] || []).length; }, 0);
  if (totalItems === 0) return;

  let maxEnColumna = 1;
  COLUMNAS.forEach(function (c) { maxEnColumna = Math.max(maxEnColumna, (mapaRiesgos[c.clave] || []).length); });

  // Densidad adaptativa: misma lógica que construirSlidesImpactoEsfuerzo_ — la columna más
  // cargada decide el tamaño de fuente y el alto de cada tarjeta para todo el slide.
  let cfg;
  if (maxEnColumna <= 5)       cfg = { tam: 8,   alto: ppt_altoGlifos_(8) + 10 };
  else if (maxEnColumna <= 8)  cfg = { tam: 7.5, alto: ppt_altoGlifos_(7.5) + 8 };
  else if (maxEnColumna <= 12) cfg = { tam: 7,   alto: ppt_altoGlifos_(7) + 6 };
  else                         cfg = { tam: 6.5, alto: ppt_altoGlifos_(6.5) + 5 };
  cfg.paso = cfg.alto + 5;

  const X0 = 34, GAP_COL = 14, ANCHO_COL = Math.floor((652 - GAP_COL * 2) / 3);
  const Y0 = Y_CONTENIDO_INICIAL;
  const ALTO_TITULO_COL = ppt_altoGlifos_(11) + 6;
  const Y_LISTA = Y0 + ALTO_TITULO_COL;
  const ALTO_DISPONIBLE = ESTILO_PPT.ALTO - Y_LISTA - 20;
  const POR_PAGINA = Math.max(1, Math.floor((ALTO_DISPONIBLE + 5) / cfg.paso));
  const totalPaginas = Math.max(1, Math.ceil(maxEnColumna / POR_PAGINA));

  for (let p = 0; p < totalPaginas; p++) {
    const slide = ppt_nuevaSlide_();
    ppt_fondoClaro_(slide);
    ppt_encabezado_(slide, 'Mapa de riesgos' + (p > 0 ? ' (cont.)' : ''),
      'Riesgos abiertos del portafolio, por severidad (probabilidad × impacto)');

    COLUMNAS.forEach(function (col) {
      const x = X0 + COLUMNAS.indexOf(col) * (ANCHO_COL + GAP_COL);
      const items = mapaRiesgos[col.clave] || [];

      ppt_rect_(slide, x, Y0, 10, ALTO_TITULO_COL - 8, col.color);
      ppt_texto_(slide, col.titulo.toUpperCase() + ' (' + items.length + ')', x + 16, Y0, ANCHO_COL - 16, ALTO_TITULO_COL,
        { tam: 11, negrita: true, altoFijo: true });

      if (items.length === 0) {
        ppt_texto_(slide, 'Sin riesgos ' + col.titulo.toLowerCase() + 's abiertos.', x, Y_LISTA + 4, ANCHO_COL, ppt_altoTexto_(7.5, 1),
          { tam: 7.5, color: ESTILO_PPT.GRIS_SUAVE, italica: true });
        return;
      }

      const visibles = items.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
      visibles.forEach(function (texto, i) {
        const y = Y_LISTA + i * cfg.paso;
        ppt_rect_(slide, x, y, ANCHO_COL, cfg.alto, ESTILO_PPT.PANEL, true);
        ppt_rect_(slide, x, y, 3, cfg.alto, col.color);
        ppt_texto_(slide, ppt_acotarParaAncho_(texto, ANCHO_COL - 18, cfg.tam, false), x + 10, y, ANCHO_COL - 18, cfg.alto,
          { tam: cfg.tam, medio: true, altoFijo: true });
      });
    });
  }
}

/** Slide de flujo: fila de N etapas conectadas por flechas (número grande + barra de color +
 *  etiqueta), con dos píldoras abajo para los estados que NO son parte del camino lineal
 *  (espera / salida). Reusa ppt_texto_/ppt_rect_/ppt_badge_ tal cual — nada nuevo que aprender
 *  del motor de slides. Devuelve nada; dibuja directo sobre el slide recibido. */
// ══════════════════════════════════════════════════════════════════════════════
//  ALTERNATIVA 4 — tema editorial con rail lateral (Archivo, fondo crema).
//  Reutiliza el mismo motor de dibujo por lotes (ppt_forma_/ppt_texto_/ppt_rect_).
//  Página: 720×405pt. Rail: 82pt (≈220px del mockup a 1920×1080, factor .375).
// ══════════════════════════════════════════════════════════════════════════════
export const ESTILO_ALT4 = {
  FONDO: '#F6F4EF', FONDO_OSCURO: '#1C1B19',
  TEXTO: '#1C1B19', TEXTO_SEC: '#8A827A', TEXTO_TERC: '#A39E97',
  VERDE_OK: '#2F7D4F', AMBAR_FONDO: '#FBF1DE', AMBAR_TEXTO: '#B8860B',
  RAIL_ANCHO: 82, FUENTE: 'Archivo', AZUL: '#3D5A80'
};
export const ALT4_PALETA_ACTIVA = { accent: '#B5450D', accentDeep: '#8A4321' }; // tweak "palette"
var ALT4_PAGINA_ACTUAL = 0; // contador de página del rail — reseteado una vez por deck en generarPresentacion_

/** Fondo crema + línea vertical del rail + textos de número/kicker/área. El número de página se
 *  autoincrementa (no se pasa a mano) — así ninguna función de slide necesita saber su posición
 *  absoluta en un deck cuyo largo total varía según cuántas fichas/proyectos/propuestas haya. */
export function ppt_alt4Fondo_(slide, kicker, area) {
  ALT4_PAGINA_ACTUAL++; slide.pageInc = (slide.pageInc || 0) + 1;
  ppt_fondo_(slide, ESTILO_ALT4.FONDO);
  ppt_rect_(slide, ESTILO_ALT4.RAIL_ANCHO, 0, 1, ESTILO_PPT.ALTO, '#D4CFC4');
  ppt_texto_(slide, String(ALT4_PAGINA_ACTUAL).padStart(2, '0'), 14, 20, 50, ppt_altoTexto_(20, 1),
    { tam: 20, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  ppt_textoRotado90_(slide, (kicker || '').toUpperCase(), 30, 90, 220, 22,
    { tam: 8, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, rotacion: 270 });
  const areasRail = (0, ENLACES.areasDeIniciativa_)(area);
  const listaRail = areasRail.length ? areasRail : (area ? [String(area)] : []);
  listaRail.forEach(function (a, i) {
    const yA = ESTILO_PPT.ALTO - 46 - (listaRail.length - 1 - i) * 11;
    ppt_texto_(slide, ppt_acotarParaAncho_(a, 64, 8, true), 14, yA, 64, ppt_altoTexto_(8, 1),
      { tam: 8, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, altoFijo: true, fuente: ESTILO_ALT4.FUENTE });
  });
}

/** Marco de las fichas individuales (proyecto y propuesta): solo el fondo crema, SIN la columna
 *  lateral con el número de página. Incrementa el contador de páginas igual que ppt_alt4Fondo_
 *  para no desfasar la numeración de las demás slides del deck. */
export function ppt_fichaFondo_(slide) {
  ALT4_PAGINA_ACTUAL++; slide.pageInc = (slide.pageInc || 0) + 1;
  ppt_fondo_(slide, ESTILO_ALT4.FONDO);
}

/** Mezcla un color con un fondo (por defecto crema) al factor dado — para el "fondo tintado al
 *  10%" del badge píldora que pide la guía de estilo (la API de Slides no soporta alpha en
 *  setSolidFill, así que se pre-mezcla el hex). */
export function ppt_tintar_(colorHex, factor, fondoHex) {
  const c = String(colorHex).replace('#', ''), f = String(fondoHex || '#F6F4EF').replace('#', '');
  const mezclar = function (a, b) { return Math.round(parseInt(a, 16) * factor + parseInt(b, 16) * (1 - factor)); };
  const r = mezclar(c.substr(0, 2), f.substr(0, 2)), g = mezclar(c.substr(2, 2), f.substr(2, 2)), b = mezclar(c.substr(4, 2), f.substr(4, 2));
  return '#' + [r, g, b].map(function (v) { return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'); }).join('');
}

/** Badge píldora de estado: fondo tintado al 10% + borde 1px del acento + texto en accentDeep
 *  (no relleno sólido — así lo define la guía de estilo, y así se ve en el mockup aprobado). */
function ppt_alt4Badge_(slide, texto, x, y, color) {
  const acento = color || ALT4_PALETA_ACTIVA.accent;
  const ancho = ppt_anchoParaTexto_(texto, 7.5, true, 60, 200) + 20;
  const forma = ppt_forma_(slide, SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, ancho, 18);
  forma.getFill().setSolidFill(ppt_tintar_(acento, 0.10));
  forma.getBorder().getLineFill().setSolidFill(acento);
  ppt_texto_(slide, texto.toUpperCase(), x, y + 2, ancho, 14,
    { tam: 7.5, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, alinear: SlidesApp.ParagraphAlignment.CENTER, medio: true, fuente: ESTILO_ALT4.FUENTE });
  return ancho;
}

/** Header estándar Alt4: título grande + badge píldora a la derecha + línea divisoria.
 *  Devuelve el Y donde debe empezar el cuerpo de la slide. */
export function ppt_alt4Header_(slide, titulo, badgeTexto, badgeColor) {
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, Y0 = 24;
  const anchoBadge = badgeTexto ? ppt_anchoParaTexto_(badgeTexto.toUpperCase(), 7.5, true, 60, 200) + 20 : 0;
  ppt_texto_(slide, titulo, X0, Y0, ESTILO_PPT.ANCHO - X0 - 34 - (anchoBadge ? anchoBadge + 20 : 0), ppt_altoTexto_(19, 1),
    { tam: 19, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  if (badgeTexto) ppt_alt4Badge_(slide, badgeTexto, ESTILO_PPT.ANCHO - 34 - anchoBadge, Y0 + 4, badgeColor);
  ppt_rect_(slide, X0, Y0 + ppt_altoTexto_(19, 1) + 8, ESTILO_PPT.ANCHO - X0 - 34, 1, '#D4CFC4');
  return Y0 + ppt_altoTexto_(19, 1) + 14; // Y donde debe empezar el cuerpo
}


/** Embudo de N etapas en estilo Alt4: número grande centrado + etiqueta debajo, separadas por
 *  líneas verticales finas — mismo componente para Flujo proyectos y Flujo propuestas. */
/** Embudo de N etapas en tarjetas blancas independientes (con separación entre ellas) — mismo
 *  lenguaje visual que las tarjetas KPI del Resumen ejecutivo, en vez de números flotando sobre
 *  el fondo separados solo por una línea fina. */
function ppt_dibujarFlujoAlt4_(slide, etapas, x0, ancho, y0, altoDisp) {
  const n = etapas.length, GAP = 10, wCol = (ancho - GAP * (n - 1)) / n;
  etapas.forEach(function (e, i) {
    const cx = x0 + i * (wCol + GAP);
    const activa = e.n > 0;
    ppt_rect_(slide, cx, y0, wCol, altoDisp, ESTILO_PPT.BLANCO, false);
    const color = activa ? ALT4_PALETA_ACTIVA.accentDeep : '#CBC6BB';
    const yNum = y0 + altoDisp / 2 - 26;
    ppt_texto_(slide, String(e.n), cx, yNum, wCol, ppt_altoTexto_(34, 1),
      { tam: 34, negrita: true, color: color, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
    ppt_texto_(slide, e.label.toUpperCase(), cx, yNum + ppt_altoTexto_(34, 1) + 6, wCol, ppt_altoTexto_(9, 1),
      { tam: 9, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
    if (activa) ppt_rect_(slide, cx, y0, wCol, 3, ALT4_PALETA_ACTIVA.accentDeep, false);
  });
}

export function construirSlideFlujoPropuestas_(areaObjetivo, corteStr) {
  const propuestas = leerHojaComoObjetos_('Propuestas').filter(function (p) {
    const archivada = p.archivada === true || p.archivada === 'TRUE' || p.archivada === 'true';
    return !archivada && (!areaObjetivo || (0, ENLACES.iniciativaPerteneceAArea_)(p.area, areaObjetivo));
  });
  const PASOS = ['Recepción', 'Evaluación', 'Caso de Negocio', 'Aprobación'];
  const conteoEtapa = {};
  PASOS.forEach(function (e) { conteoEtapa[e] = 0; });
  let enEspera = 0, rechazadas = 0;
  propuestas.forEach(function (p) {
    const resultado = p.resultado || 'Pendiente';
    if (resultado === 'Rechazada') { rechazadas++; return; }
    if (resultado !== 'Pendiente') return;
    const etapa = p.etapa_propuesta || 'Creada';
    if (etapa === 'En espera') { enEspera++; return; }
    if (conteoEtapa[etapa] !== undefined) conteoEtapa[etapa]++;
  });
  const total = propuestas.filter(function (p) { return (p.resultado || 'Pendiente') === 'Pendiente'; }).length + rechazadas;

  const etapas = PASOS.map(function (e) { return { n: conteoEtapa[e], label: e }; });

  const slide = ppt_nuevaSlide_();
  ppt_alt4Fondo_(slide, 'Estatus de iniciativas', areaObjetivo || '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const yCuerpo = ppt_alt4Header_(slide, 'Flujo de propuestas', total + ' ACTIVAS', ALT4_PALETA_ACTIVA.accent);
  ppt_texto_(slide, total + ' propuesta(s) activa(s)' + (corteStr ? ' · corte al ' + corteStr : ''), X0, yCuerpo - 6, ANCHO_DISP, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

  ppt_dibujarFlujoAlt4_(slide, etapas, X0, ANCHO_DISP, yCuerpo + 30, ESTILO_PPT.ALTO - 54 - yCuerpo - 30);

  ppt_rect_(slide, X0, ESTILO_PPT.ALTO - 30, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, enEspera + ' en espera · ' + rechazadas + ' rechazadas', X0, ESTILO_PPT.ALTO - 24, ANCHO_DISP, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

export function construirSlideFlujoProyectos_(datos, corteStr, areaObjetivo) {
  const PASOS = ['Planificación', 'Ejecución', 'Transición', 'Cierre'];
  const conteoEstado = {};
  PASOS.forEach(function (e) { conteoEstado[e] = 0; });
  let aLaEspera = 0, standBy = 0;
  datos.iniciativas.forEach(function (it) {
    const estado = it.estado || 'Planificación';
    if (estado === 'A la Espera') { aLaEspera++; return; }
    if (estado === 'Stand By') { standBy++; return; }
    if (conteoEstado[estado] !== undefined) conteoEstado[estado]++;
  });
  const total = datos.iniciativas.length;
  const etapas = PASOS.map(function (e) { return { n: conteoEstado[e], label: e === 'Monitoreo y Control' ? 'Monitoreo' : e }; });

  const slide = ppt_nuevaSlide_();
  ppt_alt4Fondo_(slide, 'Estatus de iniciativas', areaObjetivo || '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const yCuerpo = ppt_alt4Header_(slide, 'Flujo de proyectos', total + ' ACTIVOS', ALT4_PALETA_ACTIVA.accent);
  ppt_texto_(slide, total + ' proyecto(s) activo(s)' + (corteStr ? ' · corte al ' + corteStr : ''), X0, yCuerpo - 6, ANCHO_DISP, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

  ppt_dibujarFlujoAlt4_(slide, etapas, X0, ANCHO_DISP, yCuerpo + 30, ESTILO_PPT.ALTO - 54 - yCuerpo - 30);

  ppt_rect_(slide, X0, ESTILO_PPT.ALTO - 30, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, aLaEspera + ' pausado(s)', X0, ESTILO_PPT.ALTO - 24, ANCHO_DISP, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

/** Matriz Impacto/Esfuerzo con TODAS las iniciativas en UNA SOLA slide, en los tonos del deck.
 *  Filas = impacto (Alto arriba), columnas = esfuerzo restante (Bajo a la izquierda: cuadrante
 *  superior-izquierdo = "quick wins"). La densidad de los chips se adapta a la celda más cargada
 *  (tamaño y hasta dos columnas internas) para que quepan hasta 12 iniciativas por celda; solo si
 *  alguna celda superara eso —caso extremo— se paginaría como último recurso. */
function construirSlidesImpactoEsfuerzo_(datos, mapaImpactoEsfuerzo) {
  const NIVELES_IMPACTO = ['Alto', 'Medio', 'Bajo'];
  const NIVELES_ESFUERZO = ['Bajo', 'Medio', 'Alto'];

  const celdas = {};
  NIVELES_IMPACTO.forEach(function (imp) {
    NIVELES_ESFUERZO.forEach(function (esf) { celdas[imp + '|' + esf] = []; });
  });
  datos.iniciativas.forEach(function (it) {
    const clasificacion = mapaImpactoEsfuerzo[it.id] || { impacto: 'Medio', esfuerzo: 'Medio' };
    celdas[clasificacion.impacto + '|' + clasificacion.esfuerzo].push(it);
  });

  let maxEnCelda = 1;
  Object.keys(celdas).forEach(function (k) { maxEnCelda = Math.max(maxEnCelda, celdas[k].length); });

  // Densidad adaptativa según la celda más cargada
  let cfg;
  // Alto y paso derivados del cuerpo de cada nivel, no de una tabla a ojo: con paso 12.5 y
  // texto de 6pt (que ocupa 11) los chips consecutivos se montaban 3pt.
  if (maxEnCelda <= 3)      cfg = { columnas: 1, tam: 8,   acota: 22 };
  else if (maxEnCelda <= 4) cfg = { columnas: 1, tam: 7,   acota: 24 };
  else if (maxEnCelda <= 6) cfg = { columnas: 1, tam: 6.5, acota: 26 };
  else if (maxEnCelda <= 8) cfg = { columnas: 2, tam: 6.5, acota: 12 };
  else                      cfg = { columnas: 2, tam: 6,   acota: 13 };
  cfg.alto = ppt_altoGlifos_(cfg.tam) + 2;
  cfg.paso = cfg.alto + 3;
  const POR_CELDA = cfg.columnas * Math.max(1, Math.floor(77 / cfg.paso));
  const totalPaginas = Math.max(1, Math.ceil(maxEnCelda / POR_CELDA)); // último recurso: >12 por celda

  const X0 = 110, ANCHO_COL = 190, Y0 = 92, ALTO_FILA = 92;

  for (let p = 0; p < totalPaginas; p++) {
    const slide = ppt_nuevaSlide_();
    ppt_fondoClaro_(slide);
    ppt_encabezado_(slide, 'Impacto / Esfuerzo' + (p > 0 ? ' (cont.)' : ''),
      'Todas las iniciativas, según impacto en el negocio y esfuerzo restante · arriba-izquierda = foco recomendado');

    NIVELES_ESFUERZO.forEach(function (esf, c) {
      ppt_texto_(slide, 'Esfuerzo ' + esf.toLowerCase(), X0 + c * ANCHO_COL, 76, ANCHO_COL - 8, 13, { tam: 8.5, negrita: true, color: ESTILO_PPT.GRIS });
    });

    NIVELES_IMPACTO.forEach(function (imp, f) {
      const y = Y0 + f * ALTO_FILA;
      ppt_texto_(slide, 'Impacto', 30, y + 26, 74, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_PPT.GRIS_SUAVE });
      ppt_texto_(slide, imp, 30, y + 26 + ppt_altoTexto_(7.5, 1), 74, ppt_altoTexto_(10, 1),
        { tam: 10, negrita: true, color: imp === 'Alto' ? ESTILO_PPT.ROJO : ESTILO_PPT.NEGRO });

      NIVELES_ESFUERZO.forEach(function (esf, c) {
        const x = X0 + c * ANCHO_COL;
        const esFoco = imp === 'Alto' && esf === 'Bajo';
        ppt_rect_(slide, x, y, ANCHO_COL - 8, ALTO_FILA - 8, esFoco ? '#F7E6E6' : ((f + c) % 2 === 0 ? ESTILO_PPT.PANEL : '#ECECEC'), true);
        if (esFoco && p === 0) {
          ppt_texto_(slide, 'FOCO', x + ANCHO_COL - 48, y + 4, 34, 10, { tam: 6.5, negrita: true, color: ESTILO_PPT.ROJO });
        }
        const visibles = celdas[imp + '|' + esf].slice(p * POR_CELDA, (p + 1) * POR_CELDA);
        const anchoChip = cfg.columnas === 1 ? (ANCHO_COL - 22) : Math.floor((ANCHO_COL - 22 - 4) / 2);
        visibles.forEach(function (it, idx) {
          const colInterna = idx % cfg.columnas;
          const filaInterna = Math.floor(idx / cfg.columnas);
          const xChip = x + 7 + colInterna * (anchoChip + 4);
          const yChip = y + 6 + filaInterna * cfg.paso;
          const esRoja = it.salud_rag === 'Rojo';
          ppt_rect_(slide, xChip, yChip, anchoChip, cfg.alto, esRoja ? ESTILO_PPT.ROJO : ESTILO_PPT.NEGRO, true);
          ppt_texto_(slide, ppt_acotarParaAncho_(it.nombre, anchoChip - 12, cfg.tam, false), xChip + 6, yChip, anchoChip - 12, cfg.alto,
            { tam: cfg.tam, color: ESTILO_PPT.BLANCO, medio: true, altoFijo: true });
        });
      });
    });
  }
}

/** Status de proyectos: agrupadas por CATEGORÍA (en el orden preferido del portafolio) y,
 *  dentro de cada grupo, por avance descendente. Cada iniciativa con su texto representativo,
 *  barra compacta, %, y delta vs. último ciclo como chip. Numeración correlativa entre slides.
 *  La paginación nunca deja una cabecera de grupo huérfana al final de una slide. */
/** Status de proyectos: agrupadas por CATEGORÍA con nueva simbología por fila —
 *  acento lateral RAG + badge de acción (AC/IN/MA/ES) + pilar + nombre + texto
 *  representativo del período + % con delta y barra proporcional al color RAG.
 *  La paginación nunca deja una cabecera de grupo huérfana al final de una slide. */
/** Status proyectos/propuestas — Alt4. Cada categoría/pilar es dueña de su propia tanda de
 *  slides (el rail muestra "Categoría · N", nunca se mezclan dos pilares en una misma slide);
 *  dentro de cada pilar se pagina cada POR_SLIDE ítems, ordenados por avance descendente. */
export function construirSlidesDetalle_(datos, baseline, corteStr, panoramaTrimestral, mapaImpactoEsfuerzo, hitosPorIniciativa, tituloSlide) {
  hitosPorIniciativa = hitosPorIniciativa || {};
  const esPropuestas = tituloSlide === 'Status propuestas';
  const clasificacion = (panoramaTrimestral && panoramaTrimestral.clasificacion) || {};

  const ORDEN_CATEGORIAS = ['Transformación Operacional', 'Innovación', 'Arquitectura', 'Transversal', 'Próximos Desafíos'];
  const porCategoria = {};
  datos.iniciativas.forEach(function (it) {
    const cat = it.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(it);
  });
  const categoriasOrdenadas = ORDEN_CATEGORIAS.filter(function (c) { return porCategoria[c]; })
    .concat(Object.keys(porCategoria).filter(function (c) { return ORDEN_CATEGORIAS.indexOf(c) === -1; }).sort());

  // 5→4 por slide en propuestas: la fila necesita más alto para que el resumen ejecutivo
  // tenga espacio real (2 líneas) en vez de ir apretado a una sola línea truncada.
  const POR_SLIDE = esPropuestas ? 4 : 2;
  categoriasOrdenadas.forEach(function (cat) {
    // 'A la Espera' al final de la categoría — antes se mezclaban con el resto según su avance
    // (por ejemplo, una iniciativa "A la Espera" con 60% de avance previo aparecía antes que una
    // en Ejecución con 40%, aunque la que está esperando no sea la que más necesita atención
    // ahora mismo). Entre sí, las que no esperan se ordenan por avance descendente como antes;
    // las "A la Espera" van todas al final, también por avance descendente entre ellas.
    const items = porCategoria[cat].slice().sort(function (a, b) {
      const aEspera = (a.estado === 'A la Espera') ? 1 : 0;
      const bEspera = (b.estado === 'A la Espera') ? 1 : 0;
      if (aEspera !== bEspera) return aEspera - bEspera;
      return (Number(b.avance) || 0) - (Number(a.avance) || 0);
    });
    const totalPaginas = Math.max(1, Math.ceil(items.length / POR_SLIDE));
    for (let p = 0; p < totalPaginas; p++) {
      const pagina = items.slice(p * POR_SLIDE, (p + 1) * POR_SLIDE);
      if (esPropuestas) ppt_alt4StatusPropuestas_(pagina, cat, items.length, p, totalPaginas, corteStr);
      else ppt_alt4StatusProyectos_(pagina, cat, items.length, p, totalPaginas, corteStr, clasificacion, hitosPorIniciativa);
    }
  });
}

/** Una slide de Status proyectos Alt4: hasta 2 tarjetas espaciosas por slide, cada una con
 *  %avance grande + esperado, nombre/responsable/días/descripción, tags de acción/impacto/
 *  esfuerzo/plazo, y etapa+próximo hito a la derecha — igual que el mockup aprobado. */
function ppt_alt4StatusProyectos_(items, categoria, totalCat, pagIdx, totalPag, corteStr, clasificacion, hitosPorIniciativa) {
  const ACCION_COLOR = { Acelerar: ALT4_PALETA_ACTIVA.accent, Iniciar: ALT4_PALETA_ACTIVA.accent, Mantener: ESTILO_ALT4.VERDE_OK, Esperar: ESTILO_ALT4.TEXTO_SEC };
  const sufijoPag = totalPag > 1 ? ' (' + (pagIdx + 1) + ' de ' + totalPag + ')' : '';

  const slide = ppt_nuevaSlide_();
  ppt_alt4Fondo_(slide, categoria + ' · ' + totalCat, '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const yCuerpo = ppt_alt4Header_(slide, 'Status proyectos' + sufijoPag, categoria.toUpperCase(), ALT4_PALETA_ACTIVA.accent);

  const yPie = ESTILO_PPT.ALTO - 26;
  const altoFila = (yPie - 6 - yCuerpo) / items.length;
  const PAD_FILA = 8, PAD_IZQ = 18, PAD_V = 12;
  const W_PCT = 96, W_ETAPA = 90;
  const X_NOMBRE = X0 + PAD_IZQ + W_PCT + 14, W_NOMBRE = ANCHO_DISP - PAD_IZQ * 2 - W_PCT - W_ETAPA - 28;
  const X_ETAPA = X0 + PAD_IZQ + W_PCT + 14 + W_NOMBRE + 14;

  items.forEach(function (it, i) {
    const yTop = yCuerpo + i * altoFila, yc = yTop + altoFila / 2;
    const avance = Math.max(0, Math.min(100, Number(it.avance) || 0));
    const esperado = Math.round((0, ENLACES.calcularAvanceEsperado_)(it.fecha_inicio, it.fecha_fin_estimada, new Date()));
    const enPlazo = avance >= esperado - 5;
    const colorAcento = enPlazo ? ESTILO_ALT4.VERDE_OK : '#C00000';

    // Tarjeta blanca con acento lateral (verde si en plazo, rojo si atrasado) — mismo criterio
    // de color que ya usa el badge "En plazo/Atrasado" más abajo.
    const yCardTop = yTop + PAD_FILA, altoCard = altoFila - PAD_FILA * 2;
    ppt_rect_(slide, X0, yCardTop, ANCHO_DISP, altoCard, ESTILO_PPT.BLANCO, false);
    ppt_rect_(slide, X0, yCardTop, 4, altoCard, colorAcento);

    ppt_texto_(slide, avance + '%', X0 + PAD_IZQ, yc - 24, W_PCT, ppt_altoTexto_(30, 1),
      { tam: 30, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
    ppt_texto_(slide, 'Esperado: ' + esperado + '%', X0 + PAD_IZQ, yc + 8, W_PCT + 20, ppt_altoTexto_(7.5, 1),
      { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

    // Bloque nombre/resp/desc/tags: nombre pegado arriba, tags pegados abajo, la descripción
    // usa TODO el espacio que queda al medio (antes: 2 líneas fijas, centrado, con la tarjeta
    // vacía arriba/abajo — ahora la tarjeta completa se aprovecha).
    const hNombre = ppt_altoTexto_(12.5, 1), hResp = ppt_altoTexto_(8, 1), hTags = ppt_altoTexto_(8, 1);
    const yNombre = yCardTop + PAD_V;
    const yResp = yNombre + hNombre + 2;
    const yTags = yCardTop + altoCard - PAD_V - hTags;
    const yDesc = yResp + hResp + 6;
    const hDesc = Math.max(ppt_altoTexto_(8.5, 1), yTags - 6 - yDesc);

    const dias = it.fecha_inicio ? Math.round((new Date() - new Date(it.fecha_inicio)) / 86400000) : null;
    ppt_texto_(slide, it.nombre, X_NOMBRE, yNombre, W_NOMBRE, hNombre,
      { tam: 12.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, (it.responsable || 'Sin asignar') + (dias !== null ? ' · ' + dias + ' días' : ''), X_NOMBRE, yResp, W_NOMBRE, hResp,
      { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    const lineasDesc = ppt_lineasEnAlto_(hDesc, 8.5);
    const charsDesc = Math.floor((W_NOMBRE - PPT_INSET_H) / (8.5 * ppt_factorAncho_(false))) * lineasDesc;
    ppt_texto_(slide, ppt_acotar_(it.resumen_ejecutivo || '', charsDesc), X_NOMBRE, yDesc, W_NOMBRE, hDesc,
      { tam: 8.5, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });

    const clsf = clasificacion[it.id] || {};
    const accion = clsf.accion || 'Mantener';
    let xTag = X_NOMBRE;
    [
      { t: accion, c: ACCION_COLOR[accion] || ESTILO_ALT4.TEXTO_SEC, n: true },
      { t: 'Impacto ' + (clsf.impacto || '—').toLowerCase(), c: ESTILO_ALT4.TEXTO_SEC },
      { t: 'Esfuerzo ' + (clsf.esfuerzo || '—').toLowerCase(), c: ESTILO_ALT4.TEXTO_SEC },
      { t: enPlazo ? 'En plazo' : 'Atrasado', c: enPlazo ? ESTILO_ALT4.TEXTO_SEC : '#C00000', n: !enPlazo }
    ].forEach(function (tag) {
      const w = ppt_anchoParaTexto_(tag.t, 8, !!tag.n, 40, 160);
      ppt_texto_(slide, tag.t, xTag, yTags, w, hTags, { tam: 8, negrita: !!tag.n, color: tag.c, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
      xTag += w + 14;
    });

    // Bloque ETAPA — centrado igual que el bloque nombre, mismo eje vertical yc.
    const hEt1 = ppt_altoTexto_(7.5, 1), hEt2 = ppt_altoTexto_(9, 1), hEt3 = ppt_altoTexto_(8, 1);
    const altoBloqueEtapa = hEt1 + hEt2 + 1 + hEt3 + 4;
    const yBloqueEt = yc - altoBloqueEtapa / 2;
    ppt_rect_(slide, X_ETAPA - 14, yCardTop + 8, 1, altoCard - 16, '#D4CFC4');
    ppt_texto_(slide, 'ETAPA', X_ETAPA, yBloqueEt, W_ETAPA, hEt1,
      { tam: 7.5, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, it.estado || '—', X_ETAPA, yBloqueEt + hEt1 + 1, W_ETAPA, hEt2,
      { tam: 9, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
    const hitos = hitosPorIniciativa[it.id] || [];
    const proxHito = hitos.filter(function (h) { return !h.completado; }).sort(function (a, b) { return (a.fecha || 0) - (b.fecha || 0); })[0];
    ppt_texto_(slide, proxHito ? 'Próx. hito: ' + Utilities.formatDate(proxHito.fecha, Session.getScriptTimeZone(), 'dd/MM') : 'Sin próximo hito',
      X_ETAPA, yBloqueEt + hEt1 + 1 + hEt2 + 4, W_ETAPA, hEt3,
      { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  });

  ppt_rect_(slide, X0, yPie, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')),
    X0, yPie + 5, ANCHO_DISP, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}

/** Una slide de Status propuestas Alt4: lista compacta (hasta 4 por slide, con espacio real
 *  para 2 líneas de resumen ejecutivo) — etapa+días | nombre+descripción | prioridad | área. */
function ppt_alt4StatusPropuestas_(items, categoria, totalCat, pagIdx, totalPag, corteStr) {
  const sufijoPag = totalPag > 1 ? ' (' + (pagIdx + 1) + ' de ' + totalPag + ')' : '';

  const slide = ppt_nuevaSlide_();
  ppt_alt4Fondo_(slide, categoria + ' · ' + totalCat, '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const yCuerpo = ppt_alt4Header_(slide, 'Status propuestas' + sufijoPag, categoria.toUpperCase(), ALT4_PALETA_ACTIVA.accent);

  const yPie = ESTILO_PPT.ALTO - 26;
  const altoFila = (yPie - 6 - yCuerpo) / items.length;
  const PAD_FILA = 6, PAD_IZQ = 18;
  // Prioridad/Área son palabras cortas ("Alta"/"BISE") — se angostan un poco para darle ese
  // espacio al resumen, que es el texto que de verdad necesita lugar para no quedar cortado.
  const W_ETAPA = 90, W_PRIO = 56, W_AREA = 44;
  const X_NOMBRE = X0 + PAD_IZQ + W_ETAPA + 14, W_NOMBRE = ANCHO_DISP - PAD_IZQ * 2 - W_ETAPA - W_PRIO - W_AREA - 42;
  const X_PRIO = X_NOMBRE + W_NOMBRE + 14;
  const X_AREA = X_PRIO + W_PRIO + 14;

  items.forEach(function (it, i) {
    const yTop = yCuerpo + i * altoFila;
    const enEspera = it._etapa === 'En espera';
    ppt_rect_(slide, X0, yTop + PAD_FILA, ANCHO_DISP, altoFila - PAD_FILA * 2, ESTILO_PPT.BLANCO, false);
    ppt_rect_(slide, X0, yTop + PAD_FILA, 4, altoFila - PAD_FILA * 2, enEspera ? '#CBC6BB' : ALT4_PALETA_ACTIVA.accent);

    // Contenido anclado ARRIBA de la tarjeta, con el padding mínimo real (la fila mide ~64-76pt
    // de alto con 4 propuestas por slide — un padding generoso le quita casi todo el espacio al
    // resumen). El resumen usa TODO lo que queda hasta el borde inferior de la fila.
    const yc = yTop + PAD_FILA + 6;
    ppt_texto_(slide, it._etapa || 'Creada', X0 + PAD_IZQ, yc, W_ETAPA, ppt_altoTexto_(9.5, 1),
      { tam: 9.5, negrita: true, color: enEspera ? ESTILO_ALT4.TEXTO_SEC : ALT4_PALETA_ACTIVA.accent, fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, (it._diasEtapa || 0) + ' días', X0 + PAD_IZQ, yc + 14, W_ETAPA, ppt_altoTexto_(8, 1),
      { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

    ppt_texto_(slide, it.nombre, X_NOMBRE, yc, W_NOMBRE, ppt_altoTexto_(9.5, 1),
      { tam: 9.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
    const yResumen = yc + ppt_altoTexto_(9.5, 1) + 3;
    const hResumenDisp = Math.max(ppt_altoTexto_(8, 1), (yTop + altoFila - PAD_FILA - 4) - yResumen);
    // Auto-encaje (igual que en la Ficha de propuesta): en vez de calcular a mano cuántas
    // líneas caben a tamaño FIJO 8pt (que puede dejar unos pt de sobra por redondeo), prueba
    // tamaños de letra de mayor a menor hasta que el texto completo entra en el alto real
    // disponible — usa el espacio hasta el último punto posible antes de truncar.
    const fitResumen = (0, ENLACES.ppt_autoencajarParrafo_)(it.resumen_ejecutivo || '—', W_NOMBRE, hResumenDisp, 8, 7, false);
    ppt_texto_(slide, fitResumen.texto, X_NOMBRE, yResumen, W_NOMBRE, hResumenDisp,
      { tam: fitResumen.tam, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

    ppt_texto_(slide, it.prioridad || 'Media', X_PRIO, yc + 3, W_PRIO, ppt_altoTexto_(9.5, 1),
      { tam: 9.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });

    ppt_texto_(slide, it.area || '—', X_AREA, yc + 3, W_AREA, ppt_altoTexto_(9.5, 1),
      { tam: 9.5, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, alinear: SlidesApp.ParagraphAlignment.END, fuente: ESTILO_ALT4.FUENTE });
  });

  ppt_rect_(slide, X0, yPie, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')),
    X0, yPie + 5, ANCHO_DISP, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}


export function construirSlideAnexo_(slide) {
  ppt_fondo_(slide, ESTILO_ALT4.FONDO_OSCURO);
  ppt_texto_(slide, 'ANEXO', 96, 90, 400, ppt_altoTexto_(8, 1), { tam: 8, negrita: true, color: ppt_tintar_(ALT4_PALETA_ACTIVA.accent, 0.65, '#1C1B19'), fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, 'Ficha individual por iniciativa marcada', 94, 106, 560, 90,
    { tam: 34, negrita: true, color: ESTILO_ALT4.FONDO, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  ALT4_PAGINA_ACTUAL: { get: () => ALT4_PAGINA_ACTUAL, set: v => { ALT4_PAGINA_ACTUAL = v; }, enumerable: true, configurable: true },
});
