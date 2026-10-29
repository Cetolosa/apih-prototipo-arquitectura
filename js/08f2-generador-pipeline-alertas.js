/* 08f2-generador-pipeline-alertas — continuación de 08f-generador-pipeline.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, Utilities, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, ppt_acotarParaAncho_, ppt_altoTexto_, ppt_forma_, ppt_lineasNecesarias_, ppt_paginar_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_alt4Fondo_, ppt_alt4Header_ } from './08c-generador-portafolio.js';
import {  } from './08f-generador-pipeline.js';


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
