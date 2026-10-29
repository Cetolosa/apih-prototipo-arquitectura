/* 08d2-generador-ficha-detalle — continuación de 08d-generador-ficha.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities } from './08a-generador-motor.js';
import { ESTILO_PPT, ppt_acotarParaAncho_, ppt_acotar_, ppt_altoTexto_, ppt_forma_, ppt_lineasNecesarias_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_fichaFondo_, ppt_tintar_ } from './08c-generador-portafolio.js';
import { ppt_alt4Stepper_, ppt_autoencajarParDeParrafos_, ppt_autoencajarParrafo_ } from './08d-generador-ficha.js';


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
