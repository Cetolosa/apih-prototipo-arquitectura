/* 08c2-generador-portafolio-detalle — continuación de 08c-generador-portafolio.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, PPT_INSET_H, ppt_acotarParaAncho_, ppt_acotar_, ppt_altoGlifos_, ppt_altoTexto_, ppt_anchoParaTexto_, ppt_encabezado_, ppt_factorAncho_, ppt_fondoClaro_, ppt_fondo_, ppt_lineasEnAlto_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PAGINA_ACTUAL, ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_alt4Fondo_, ppt_alt4Header_, ppt_dibujarFlujoAlt4_, ppt_tintar_, asignar_ALT4_PAGINA_ACTUAL } from './08c-generador-portafolio.js';


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
  ALT4_PAGINA_ACTUAL: { get: () => ALT4_PAGINA_ACTUAL, set: v => { asignar_ALT4_PAGINA_ACTUAL(v); }, enumerable: true, configurable: true },
});
