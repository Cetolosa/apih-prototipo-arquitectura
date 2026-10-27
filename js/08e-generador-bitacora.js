import { ENLACES } from './00-registro.js';
import { Date, Session, SlidesApp, SpreadsheetApp, Utilities, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, ppt_acotar_, ppt_altoTexto_, ppt_anchoParaTexto_, ppt_forma_, ppt_lineasNecesarias_, ppt_rect_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, ppt_alt4Fondo_, ppt_alt4Header_ } from './08c-generador-portafolio.js';
/** BITÁCORA — "Decisiones del período": muestra qué pasó con las decisiones en este ciclo, en
 *  filas unificadas y en este orden: RESUELTAS (con su resolución), VENCIDAS y ABIERTAS (de
 *  DecisionesPendientes), y REGISTRADAS (entradas de la Bitácora del período, cada una con su
 *  fecha y su ciclo vinculado). Las entradas migradas automáticamente ("Decisión: ...") se
 *  excluyen de las registradas — ya aparecen mejor estructuradas como RESUELTAS. Paginada (6). */
/** Mapa {fila: texto de decisión} para TODA la hoja Bitácora (no solo las no-vinculadas) — así
 *  un Compromiso con decision_origen_fila puede mostrar el texto de la decisión que lo originó
 *  aunque esa decisión ya no aparezca como fila propia (por estar Vinculada). Una sola lectura. */
function mapaTextoDecisionPorFila_() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bitacora');
  const mapa = {};
  if (!hoja) return mapa;
  const datos = hoja.getDataRange().getValues();
  if (datos.length < 2) return mapa;
  const enc = datos[0];
  const colDecision = enc.indexOf('decision');
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][colDecision]) mapa[i + 1] = String(datos[i][colDecision]);
  }
  return mapa;
}

/** Unifica decisiones sin resolver + compromisos abiertos en una sola lista, vencidos primero —
 *  sin importar el tipo, lo urgente es lo urgente. Compartido entre la slide de Bitácora (lista
 *  completa) y el Plan de Acción (top 3, como llamado a la acción). */
function construirListaAbiertosUrgencia_(decisiones, seguimientoCompromisos) {
  const abiertos = [];
  decisiones.sinResolver.forEach(function (d) {
    abiertos.push({
      esCompromiso: false, fila: d.fila, texto: d.decision, vencido: d.vencida,
      fechaLimite: d.fecha_limite, responsable: null, iniciativaNombre: d.iniciativa_nombre
    });
  });
  seguimientoCompromisos.abiertas.forEach(function (c) {
    const vencido = !!(c.fecha_limite && c.fecha_limite < new Date());
    abiertos.push({
      esCompromiso: true, fila: c.fila, texto: c.pregunta, vencido: vencido,
      fechaLimite: c.fecha_limite, responsable: c.responsable,
      iniciativaNombre: c.iniciativa_nombre, origenFila: c.decision_origen_fila
    });
  });
  abiertos.sort(function (a, b) {
    if (a.vencido !== b.vencido) return a.vencido ? -1 : 1;
    if (!a.fechaLimite && !b.fechaLimite) return 0;
    if (!a.fechaLimite) return 1;
    if (!b.fechaLimite) return -1;
    return a.fechaLimite - b.fechaLimite;
  });
  return abiertos;
}

/** Bitácora — decisiones y compromisos, ordenado por urgencia (Alt4). Desde que "Pendientes por
 *  decidir" quedó retirada (su función la cumple ahora el estado "Sin resolver" de Decisión), esta
 *  es la ÚNICA slide donde aparecen — con tratamiento completo, no compacto. Orden: vencidos
 *  primero (decisión o compromiso, da igual el tipo — lo urgente es lo urgente), después el resto
 *  de lo abierto, con la última actualización (comentario) y el vínculo a su decisión de origen
 *  cuando corresponde. Lo ya resuelto se comprime a una franja compacta al final, para no competir
 *  por espacio con lo que sí necesita atención. */
/** Bitácora — decisiones y compromisos (Alt4, Opción 5: tarjeta de iniciativa como hilo).
 *  La unidad ya no es "una fila = una decisión o un compromiso" — es la INICIATIVA. Cada
 *  iniciativa con algo abierto (decisión sin resolver, o compromiso abierto) es su propia
 *  tarjeta blanca, y adentro se lee como una historia cronológica: la decisión de origen (si la
 *  hay, con "↳ De la decisión") justo antes del compromiso que generó, después el compromiso en
 *  sí, después su comentario más reciente. Antes esto era una lista plana con la relación
 *  escondida en una frase de texto gris — acá la relación está en la ESTRUCTURA (agrupación +
 *  orden), no hay que leerla para entenderla.
 *
 *  Orden de tarjetas: iniciativas con algo vencido primero, después las que tienen algo abierto
 *  sin vencer, alfabético dentro de cada grupo. Lo puramente resuelto (sin nada abierto para esa
 *  iniciativa en este período) se comprime a una franja al final, para no competir por espacio.
 *
 *  Paginación por altura REAL acumulada por tarjeta (ppt_lineasNecesarias_ para cada línea de
 *  texto que puede envolver) — nunca corta una tarjeta a la mitad contra el borde inferior:
 *  se decide ANTES de agregarla a una página si entra completa. */
export function construirSlidesBitacora_(decisiones, seguimientoCompromisos, comentarios, corteStr) {
  const textoDecisionPorFila = mapaTextoDecisionPorFila_();
  const hoy = new Date();

  // ── Agrupar todo por iniciativa ──
  const porIniciativa = {};
  function grupo_(nombre) {
    const key = nombre || 'General';
    if (!porIniciativa[key]) porIniciativa[key] = { nombre: key, decisiones: [], compromisos: [], tieneVencido: false, tieneAbierto: false };
    return porIniciativa[key];
  }
  decisiones.sinResolver.forEach(function (d) {
    const g = grupo_(d.iniciativa_nombre);
    g.decisiones.push({ tipo: 'sinResolver', texto: d.decision, fila: d.fila, vencida: d.vencida });
    g.tieneAbierto = true;
    if (d.vencida) g.tieneVencido = true;
  });
  decisiones.cerradas.forEach(function (d) {
    // Cerrada por comentario (no vinculada — si tuviera un compromiso ya sería 'vinculada' y no
    // llegaría hasta acá, ver obtenerDecisionesDesde_).
    grupo_(d.iniciativa_nombre).decisiones.push({ tipo: 'cerrada', texto: d.decision, fila: d.fila, comentarioCierre: d.comentario_cierre });
  });
  seguimientoCompromisos.abiertas.forEach(function (c) {
    const vencido = !!(c.fecha_limite && c.fecha_limite < hoy);
    const g = grupo_(c.iniciativa_nombre);
    g.compromisos.push({ tipo: 'abierto', texto: c.pregunta, fila: c.fila, responsable: c.responsable, fechaLimite: c.fecha_limite, vencido: vencido, origenFila: c.decision_origen_fila });
    g.tieneAbierto = true;
    if (vencido) g.tieneVencido = true;
  });
  seguimientoCompromisos.resueltas.forEach(function (c) {
    grupo_(c.iniciativa_nombre).compromisos.push({ tipo: 'cerrado', texto: c.pregunta, fila: c.fila, responsable: c.responsable, resolucion: c.resolucion, origenFila: c.decision_origen_fila });
  });

  const nombresIniciativas = Object.keys(porIniciativa);
  if (nombresIniciativas.length === 0) return;

  // Tarjetas "con algo abierto" (tratamiento completo) vs. "solo resueltos" (franja compacta)
  const conAbierto = nombresIniciativas.filter(function (n) { return porIniciativa[n].tieneAbierto; });
  const soloResueltas = nombresIniciativas.filter(function (n) { return !porIniciativa[n].tieneAbierto; });
  conAbierto.sort(function (a, b) {
    const ga = porIniciativa[a], gb = porIniciativa[b];
    if (ga.tieneVencido !== gb.tieneVencido) return ga.tieneVencido ? -1 : 1;
    return a.localeCompare(b);
  });

  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20;
  const ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const PAD = 12, GAP_ITEM = 8, GAP_TARJETA = 10;
  const TAM_TITULO_INI = 10.5, TAM_ITEM = 9.5, TAM_META = 8, TAM_SUB = 7.5;

  // ── Medición de cada tarjeta: un ítem del hilo (decisión, vínculo, compromiso, comentario) ──
  function lineasItem_(fila) {
    const ancho = ANCHO_DISP - PAD * 2 - 14; // 14 = línea vertical + indent del hilo
    const partes = [];
    fila.decisiones.forEach(function (d) {
      partes.push({ alto: ppt_altoTexto_(TAM_ITEM, ppt_lineasNecesarias_((d.tipo === 'sinResolver' ? 'Sin resolver — ' : 'Cerrada — ') + d.texto, ancho, TAM_ITEM, false)) });
      if (d.comentarioCierre) partes.push({ alto: ppt_altoTexto_(TAM_SUB, ppt_lineasNecesarias_('Cierre: ' + d.comentarioCierre, ancho, TAM_SUB, false)) });
    });
    fila.compromisos.forEach(function (c) {
      if (c.origenFila && textoDecisionPorFila[c.origenFila]) {
        partes.push({ alto: ppt_altoTexto_(TAM_SUB, ppt_lineasNecesarias_('↳ De la decisión: "' + textoDecisionPorFila[c.origenFila] + '"', ancho, TAM_SUB, false)) });
      }
      const etiquetaC = c.tipo === 'abierto' ? (c.vencido ? 'Vencido — ' : 'Abierto — ') : 'Cerrado — ';
      partes.push({ alto: ppt_altoTexto_(TAM_ITEM, ppt_lineasNecesarias_(etiquetaC + c.texto, ancho, TAM_ITEM, false)) });
      const meta = c.tipo === 'abierto'
        ? [c.responsable, c.fechaLimite ? (c.vencido ? 'venció ' : 'vence ') + (0, ENLACES.fmtCortoHito_)(c.fechaLimite) : null].filter(Boolean).join(' · ')
        : [c.responsable, c.resolucion ? '"' + c.resolucion + '"' : null].filter(Boolean).join(' — ');
      if (meta) partes.push({ alto: ppt_altoTexto_(TAM_META, ppt_lineasNecesarias_(meta, ancho, TAM_META, false)) });
      const com = comentarios[String(c.fila)];
      if (com) partes.push({ alto: ppt_altoTexto_(TAM_SUB, ppt_lineasNecesarias_('💬 "' + com.texto + '" — ' + (com.autor || 'sin autor'), ancho, TAM_SUB, false)) });
    });
    return partes;
  }
  function altoTarjeta_(grupo) {
    const partes = lineasItem_(grupo);
    let h = PAD * 2 + ppt_altoTexto_(TAM_TITULO_INI, 1) + GAP_ITEM;
    partes.forEach(function (p) { h += p.alto + 3; });
    return h + GAP_TARJETA;
  }

  const ALTO_RESUMEN = soloResueltas.length > 0 ? ppt_altoTexto_(7.5, 1) + ppt_altoTexto_(8, 2) + 16 : 0;
  const yCuerpoAprox = 24 + ppt_altoTexto_(19, 1) + 14 + ppt_altoTexto_(9, 1) + 10;
  const altoDisponible = ESTILO_PPT.ALTO - 30 - ALTO_RESUMEN - 8 - yCuerpoAprox;

  // Paginación por altura ACUMULADA real — se decide ANTES de sumar si la tarjeta entra completa.
  const paginas = [];
  let paginaActual = [], altoAcum = 0;
  conAbierto.forEach(function (nombre) {
    const h = altoTarjeta_(porIniciativa[nombre]);
    if (altoAcum + h > altoDisponible && paginaActual.length > 0) { paginas.push(paginaActual); paginaActual = []; altoAcum = 0; }
    paginaActual.push(nombre); altoAcum += h;
  });
  if (paginaActual.length > 0 || paginas.length === 0) paginas.push(paginaActual);

  const nVencidas = conAbierto.filter(function (n) { return porIniciativa[n].tieneVencido; }).length;
  const nAbiertas = conAbierto.length - nVencidas;

  paginas.forEach(function (pagina, idxPag) {
    const esUltima = idxPag === paginas.length - 1;
    const sufijoPag = paginas.length > 1 ? ' (' + (idxPag + 1) + ' de ' + paginas.length + ')' : '';
    const slide = ppt_nuevaSlide_();
    ppt_alt4Fondo_(slide, 'Acuerdos del comité', '');
    const yCuerpo = ppt_alt4Header_(slide, 'Bitácora — decisiones y compromisos' + sufijoPag, 'ACUERDOS DEL COMITÉ', ALT4_PALETA_ACTIVA.accent);
    ppt_texto_(slide, corteStr ? 'Desde el corte anterior del ' + corteStr : 'Movimientos del período',
      X0, yCuerpo, ANCHO_DISP, ppt_altoTexto_(9, 1), { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

    let y2 = yCuerpo + ppt_altoTexto_(9, 1) + 14;
    if (idxPag === 0) {
      const pills = [
        { n: nVencidas, txt: (nVencidas === 1 ? ' iniciativa con compromisos vencidos' : ' iniciativas con compromisos vencidos'), bg: '#FDEBEB', fg: ALT4_PALETA_ACTIVA.accent },
        { n: nAbiertas, txt: (nAbiertas === 1 ? ' iniciativa con compromisos abiertos' : ' iniciativas con compromisos abiertos'), bg: ESTILO_ALT4.AMBAR_FONDO, fg: ESTILO_ALT4.AMBAR_TEXTO },
        { n: soloResueltas.length, txt: (soloResueltas.length === 1 ? ' resuelta este período' : ' resueltas este período'), bg: '#E4F3E5', fg: ESTILO_ALT4.VERDE_OK }
      ].filter(function (p) { return p.n > 0; });
      let xPill = X0;
      pills.forEach(function (p) {
        const txt = p.n + p.txt;
        const w = ppt_anchoParaTexto_(txt, 8.5, true, 60, 260) + 20;
        ppt_rect_(slide, xPill, y2, w, 18, p.bg, true);
        ppt_texto_(slide, txt, xPill, y2 + 2, w, ppt_altoTexto_(8.5, 1),
          { tam: 8.5, negrita: true, color: p.fg, alinear: SlidesApp.ParagraphAlignment.CENTER, fuente: ESTILO_ALT4.FUENTE });
        xPill += w + 10;
      });
      y2 += 26;
    }

    const yTope = y2 + altoDisponible;
    pagina.forEach(function (nombreIni) {
      const grupo = porIniciativa[nombreIni];
      const altoEstaTarjeta = altoTarjeta_(grupo);
      if (y2 + altoEstaTarjeta > yTope + 2) return; // resguardo del límite inferior

      const colorTarjeta = grupo.tieneVencido ? ALT4_PALETA_ACTIVA.accent : (grupo.tieneAbierto ? ESTILO_ALT4.AMBAR_TEXTO : ESTILO_ALT4.TEXTO_SEC);
      ppt_rect_(slide, X0, y2, ANCHO_DISP, altoEstaTarjeta - GAP_TARJETA, ESTILO_PPT.BLANCO, false);
      ppt_texto_(slide, nombreIni, X0 + PAD, y2 + PAD - 2, ANCHO_DISP - PAD * 2, ppt_altoTexto_(TAM_TITULO_INI, 1),
        { tam: TAM_TITULO_INI, negrita: true, color: colorTarjeta, fuente: ESTILO_ALT4.FUENTE });

      const xHilo = X0 + PAD + 3, xTexto = X0 + PAD + 14;
      const wTexto = ANCHO_DISP - PAD * 2 - 14;
      let yItem = y2 + PAD + ppt_altoTexto_(TAM_TITULO_INI, 1) + GAP_ITEM;
      const yHiloIni = yItem;

      grupo.decisiones.forEach(function (d) {
        const sinResolver = d.tipo === 'sinResolver';
        const punto = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, xHilo - 3, yItem + 2, 6, 6);
        if (sinResolver) { punto.getFill().setTransparent(); punto.getBorder().getLineFill().setSolidFill('#8A827A'); punto.getBorder().setWeight(1.2); }
        else { punto.getFill().setSolidFill(ESTILO_ALT4.VERDE_OK); punto.getBorder().setTransparent(); }
        const txt = (sinResolver ? 'Sin resolver — ' : 'Cerrada — ') + d.texto;
        const lineasTxt = ppt_lineasNecesarias_(txt, wTexto, TAM_ITEM, false);
        ppt_texto_(slide, txt, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_ITEM, lineasTxt),
          { tam: TAM_ITEM, negrita: true, color: sinResolver ? ESTILO_ALT4.TEXTO : ESTILO_ALT4.VERDE_OK, fuente: ESTILO_ALT4.FUENTE });
        yItem += ppt_altoTexto_(TAM_ITEM, lineasTxt) + 3;
        if (d.comentarioCierre) {
          const txtC = 'Cierre: ' + d.comentarioCierre;
          const lc = ppt_lineasNecesarias_(txtC, wTexto, TAM_SUB, false);
          ppt_texto_(slide, txtC, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_SUB, lc), { tam: TAM_SUB, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
          yItem += ppt_altoTexto_(TAM_SUB, lc) + 3;
        }
      });

      grupo.compromisos.forEach(function (c) {
        if (c.origenFila && textoDecisionPorFila[c.origenFila]) {
          const txtV = '↳ De la decisión: "' + textoDecisionPorFila[c.origenFila] + '"';
          const lv = ppt_lineasNecesarias_(txtV, wTexto, TAM_SUB, false);
          ppt_texto_(slide, txtV, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_SUB, lv), { tam: TAM_SUB, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });
          yItem += ppt_altoTexto_(TAM_SUB, lv) + 3;
        }
        const abierto = c.tipo === 'abierto';
        const colorC = abierto ? (c.vencido ? ALT4_PALETA_ACTIVA.accent : ALT4_PALETA_ACTIVA.accentDeep) : ESTILO_ALT4.VERDE_OK;
        const punto = ppt_forma_(slide, SlidesApp.ShapeType.ELLIPSE, xHilo - 3, yItem + 2, 6, 6);
        punto.getFill().setSolidFill(colorC); punto.getBorder().setTransparent();
        const etiquetaC = abierto ? (c.vencido ? 'Vencido — ' : 'Abierto — ') : 'Cerrado — ';
        const txtC = etiquetaC + c.texto;
        const lc = ppt_lineasNecesarias_(txtC, wTexto, TAM_ITEM, false);
        ppt_texto_(slide, txtC, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_ITEM, lc), { tam: TAM_ITEM, negrita: true, color: colorC, fuente: ESTILO_ALT4.FUENTE });
        yItem += ppt_altoTexto_(TAM_ITEM, lc) + 3;

        const meta = abierto
          ? [c.responsable, c.fechaLimite ? (c.vencido ? 'venció ' : 'vence ') + (0, ENLACES.fmtCortoHito_)(c.fechaLimite) : null].filter(Boolean).join(' · ')
          : [c.responsable, c.resolucion ? '"' + c.resolucion + '"' : null].filter(Boolean).join(' — ');
        if (meta) {
          const lm = ppt_lineasNecesarias_(meta, wTexto, TAM_META, false);
          ppt_texto_(slide, meta, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_META, lm), { tam: TAM_META, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
          yItem += ppt_altoTexto_(TAM_META, lm) + 3;
        }
        const com = comentarios[String(c.fila)];
        if (com) {
          const txtCom = '💬 "' + com.texto + '" — ' + (com.autor || 'sin autor');
          const lcm = ppt_lineasNecesarias_(txtCom, wTexto, TAM_SUB, false);
          ppt_texto_(slide, txtCom, xTexto, yItem, wTexto, ppt_altoTexto_(TAM_SUB, lcm), { tam: TAM_SUB, color: ESTILO_ALT4.AMBAR_TEXTO, fuente: ESTILO_ALT4.FUENTE });
          yItem += ppt_altoTexto_(TAM_SUB, lcm) + 3;
        }
      });

      // Línea vertical del hilo, de punta a punta de todos los ítems de esta tarjeta.
      if (yItem > yHiloIni) ppt_rect_(slide, xHilo, yHiloIni, 0.75, yItem - yHiloIni - 3, '#E8E4DA');

      y2 += altoEstaTarjeta;
    });

    if (esUltima && soloResueltas.length > 0) {
      const yResumen = y2 + 4;
      ppt_rect_(slide, X0, yResumen, ANCHO_DISP, ALTO_RESUMEN - 8, ESTILO_ALT4.FONDO, true);
      ppt_texto_(slide, 'RESUELTAS ESTE PERÍODO (' + soloResueltas.length + ')', X0 + 8, yResumen + 4, ANCHO_DISP - 16, ppt_altoTexto_(7.5, 1),
        { tam: 7.5, negrita: true, color: ESTILO_ALT4.VERDE_OK, fuente: ESTILO_ALT4.FUENTE });
      ppt_texto_(slide, soloResueltas.join('  ·  '), X0 + 8, yResumen + 4 + ppt_altoTexto_(7.5, 1) + 2, ANCHO_DISP - 16, ppt_altoTexto_(8, 2),
        { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    }

    const yPie = ESTILO_PPT.ALTO - 20;
    ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy')),
      X0, yPie, ANCHO_DISP, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
  });
}


/** Estructura del portafolio (Alt4) — reemplaza a la vieja "Cierre" única. Mismo cálculo de
 *  pilares (categoría) que antes: total activo, en curso, proyectos vs. propuestas — solo
 *  re-vestido: 3 columnas espaciosas en vez de N tarjetas carbón angostas. */
export function construirSlideEstructuraPortafolio_(slide, datos) {
  const pilares = {};
  (datos.iniciativas || []).forEach(function (it) {
    const cat = it.categoria || 'Sin pilar';
    if (!pilares[cat]) pilares[cat] = { total: 0, enCurso: 0, proyectos: 0, propuestas: 0 };
    pilares[cat].total++;
    if (it._esPropuesta) pilares[cat].propuestas++; else pilares[cat].proyectos++;
    const est = (it.estado || '').toLowerCase();
    if (est.indexOf('curso') !== -1 || est.indexOf('ejecuc') !== -1) pilares[cat].enCurso++;
  });
  const nombresPilares = Object.keys(pilares).sort();
  const totalGlobal = (datos.iniciativas || []).length;

  ppt_alt4Fondo_(slide, 'Cierre', '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const yCuerpo = ppt_alt4Header_(slide, 'Estructura estratégica', totalGlobal + ' INICIATIVAS', ALT4_PALETA_ACTIVA.accent);
  ppt_texto_(slide, 'Estructura estratégica del portafolio activo', X0, yCuerpo - 6, ANCHO_DISP, ppt_altoTexto_(9, 1),
    { tam: 9, color: ESTILO_ALT4.TEXTO_TERC, fuente: ESTILO_ALT4.FUENTE });

  const yPie = ESTILO_PPT.ALTO - 30;
  const n = Math.max(1, nombresPilares.length), GAP = 12, wCol = (ANCHO_DISP - GAP * (n - 1)) / n;
  nombresPilares.forEach(function (nombre, idx) {
    const p = pilares[nombre];
    const x = X0 + idx * (wCol + GAP);
    ppt_rect_(slide, x, yCuerpo + 10, wCol, yPie - yCuerpo - 24, ESTILO_PPT.BLANCO, false);
    const PAD_COL = n > 4 ? 12 : 18;
    const extraNom = (ppt_lineasNecesarias_(nombre.toUpperCase(), wCol - PAD_COL * 2, 8, true) - 1) * 10;
    const xTxt = x + PAD_COL, wTxt = wCol - PAD_COL * 2;
    ppt_texto_(slide, nombre.toUpperCase(), xTxt, yCuerpo + 24, wTxt, ppt_altoTexto_(8, 1) + extraNom,
      { tam: 8, negrita: true, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
    ppt_texto_(slide, String(p.total), xTxt, yCuerpo + 24 + ppt_altoTexto_(8, 1) + 6 + extraNom, wTxt, ppt_altoTexto_(32, 1),
      { tam: 32, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
    const sub = 'iniciativa' + (p.total === 1 ? '' : 's') + (p.enCurso > 0 ? ' · ' + p.enCurso + ' en curso' : '');
    const ySub = yCuerpo + 24 + ppt_altoTexto_(8, 1) + 6 + extraNom + ppt_altoTexto_(32, 1) + 4;
    ppt_texto_(slide, sub, xTxt, ySub, wTxt, ppt_altoTexto_(8, 1), { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });

    const yDesglose = ySub + ppt_altoTexto_(8, 1) + 10;
    ppt_rect_(slide, xTxt, yDesglose, wTxt, 1, '#E8E4DA');
    ['Proyectos', 'Propuestas'].forEach(function (label, li) {
      const val = li === 0 ? p.proyectos : p.propuestas;
      const y = yDesglose + 8 + li * (ppt_altoTexto_(9, 1) + 6);
      ppt_texto_(slide, label, xTxt, y, wTxt - 8, ppt_altoTexto_(9, 1), { tam: 9, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      ppt_texto_(slide, String(val), xTxt + wTxt - 32, y, 32, ppt_altoTexto_(9, 1),
        { tam: 9, negrita: true, color: ESTILO_ALT4.TEXTO, alinear: SlidesApp.ParagraphAlignment.END, fuente: ESTILO_ALT4.FUENTE });
    });
  });

  ppt_rect_(slide, X0, yPie, ANCHO_DISP, 1, '#D4CFC4');
  ppt_texto_(slide, totalGlobal + ' iniciativas activas en total · ' + nombresPilares.length + ' pilares estratégicos',
    X0, yPie + 5, ANCHO_DISP, ppt_altoTexto_(8.5, 1), { tam: 8.5, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE });
}

/** Plan de Acción & Recomendaciones (Alt4) — 2da slide de cierre. 100% datos reales, datos reales:
 *  - "Prioridades operativas": proyectos con señal de riesgo (hito vencido, avance bajo lo
 *    esperado, bloqueador o salud roja), ordenados por puntaje. Cada tarjeta dice QUÉ hacer y
 *    cita las cifras (avance vs. esperado, próximo hito, responsable) — nunca "Destrabar X en X".
 *  - "Decisiones para el comité": compromisos/decisiones abiertas (vencidos primero, top 2) y
 *    luego las propuestas que más días llevan en su etapa, con su bloqueo si lo tienen.
 *  El título de la slide cuenta lo que hay (N prioridades y N decisiones). Las tarjetas se
 *  acomodan por altura real: lo que no cabe se omite en vez de montarse sobre el pie. */
var PLAN_MAX_ITEMS_ = 4;
var PLAN_DIAS_ALERTA_PROPUESTA_ = 30;

function planAccionPrioridades_(datos, hitosFlat, hoy, tz) {
  const fmt = function (d) { return Utilities.formatDate(d, tz, 'dd/MM'); };
  const hitos = hitosFlat || [];
  const lista = [];
  (datos.iniciativas || []).forEach(function (it) {
    if (it._esPropuesta) return;
    const avance = Number(it.avance) || 0;
    const esperadoRaw = (0, ENLACES.calcularAvanceEsperado_)(it.fecha_inicio, it.fecha_fin_estimada, hoy);
    const esperado = esperadoRaw === null ? null : Math.round(esperadoRaw);
    const atrasado = esperado !== null && avance < esperado - 5;
    const propios = hitos.filter(function (h) { return h.iniciativa === it.nombre && !h.completado && h.fecha; })
      .sort(function (a, b) { return a.fecha - b.fecha; });
    const vencido = propios.filter(function (h) { return h.fecha < hoy; })[0] || null;
    const proximo = propios.filter(function (h) { return h.fecha >= hoy; })[0] || null;
    const rojo = String(it.salud_rag || '').toLowerCase().indexOf('rojo') !== -1;
    const sinHito = !vencido && !proximo && avance < 100;
    const puntaje = (rojo ? 3 : 0) + (vencido ? 3 : 0) + (atrasado ? 2 : 0) + (it.issue ? 1 : 0) + (sinHito ? 1 : 0);
    if (puntaje === 0) return;

    let accion;
    if (vencido) accion = 'cerrar «' + vencido.nombre + '» (venció el ' + fmt(vencido.fecha) + ')';
    else if (it.issue) accion = 'resolver ' + String(it.issue).replace(/\.+$/, '');
    else if (sinHito) accion = 'definir el próximo hito y sus fechas';
    else accion = 'recuperar el atraso del cronograma';

    const partes = [];
    if (esperado !== null) partes.push('Avance ' + avance + '% vs. ' + esperado + '% esperado');
    else partes.push('Avance ' + avance + '%');
    if (vencido && proximo) partes.push('próximo hito: «' + proximo.nombre + '» el ' + fmt(proximo.fecha));
    else if (!vencido && proximo) partes.push('próximo hito: «' + proximo.nombre + '» el ' + fmt(proximo.fecha));
    if (it.issue && vencido) partes.push('bloqueo: ' + String(it.issue).replace(/\.+$/, ''));
    if (it.responsable) partes.push('resp. ' + it.responsable);
    lista.push({ puntaje: puntaje, avance: avance, titulo: it.nombre + ': ' + accion + '.', detalle: partes.join(' · ') + '.' });
  });
  lista.sort(function (a, b) { return b.puntaje - a.puntaje || b.avance - a.avance; });
  return lista;
}

function planAccionDecisiones_(datos, decisionesDelArea, seguimientoCompromisos, tz) {
  const fmt = function (d) { return Utilities.formatDate(d, tz, 'dd/MM'); };
  const salida = [];
  construirListaAbiertosUrgencia_(decisionesDelArea, seguimientoCompromisos).slice(0, 2).forEach(function (a) {
    const prefijo = a.vencido ? 'Vencido: ' : (a.esCompromiso ? 'Compromiso: ' : 'Decisión: ');
    const partes = [];
    if (a.iniciativaNombre) partes.push(a.iniciativaNombre);
    if (a.fechaLimite) partes.push((a.vencido ? 'venció el ' : 'plazo ') + fmt(a.fechaLimite));
    if (a.responsable) partes.push('resp. ' + a.responsable);
    salida.push({ iniciativa: a.iniciativaNombre || '', titulo: prefijo + a.texto + (/[.!?]$/.test(a.texto) ? '' : '.'), detalle: partes.length ? partes.join(' · ') + '.' : '' });
  });
  // Una propuesta que ya aparece arriba por un compromiso/decisión abierto no se repite.
  const yaCitadas = {};
  salida.forEach(function (x) { if (x.iniciativa) yaCitadas[x.iniciativa] = true; });
  (datos.iniciativas || []).filter(function (it) {
    return it._esPropuesta && !yaCitadas[it.nombre] && it._etapa !== 'En espera' && (it._diasEtapa || 0) >= PLAN_DIAS_ALERTA_PROPUESTA_;
  }).sort(function (a, b) { return (b._diasEtapa || 0) - (a._diasEtapa || 0); }).forEach(function (p) {
    const accion = p._bloqueo ? p._bloqueo.charAt(0).toLowerCase() + p._bloqueo.slice(1) : 'decidir el siguiente paso';
    salida.push({ titulo: p.nombre + ': ' + accion + '.', detalle: p._etapa + ' · ' + p._diasEtapa + ' días en la etapa.' });
  });
  return salida;
}

export function construirSlidePlanAccion_(slide, datos, decisionesDelArea, seguimientoCompromisos, corteStr, hitosFlat) {
  const hoy = new Date(), tz = Session.getScriptTimeZone();
  const prioridades = planAccionPrioridades_(datos, hitosFlat, hoy, tz).slice(0, PLAN_MAX_ITEMS_);
  const decisiones = planAccionDecisiones_(datos, decisionesDelArea, seguimientoCompromisos, tz).slice(0, PLAN_MAX_ITEMS_);
  if (prioridades.length === 0 && decisiones.length === 0) return;

  ppt_alt4Fondo_(slide, 'Cierre', '');
  const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 - 34;
  const tituloSlide = 'Plan de acción: ' + prioridades.length + (prioridades.length === 1 ? ' prioridad' : ' prioridades') +
    ' y ' + decisiones.length + (decisiones.length === 1 ? ' decisión' : ' decisiones');
  const yCuerpo = ppt_alt4Header_(slide, tituloSlide, 'PLAN DE ACCIÓN', ALT4_PALETA_ACTIVA.accent);

  const W_COL = (ANCHO_DISP - 30) / 2;
  const X_IZQ = X0, X_DER = X0 + W_COL + 30;
  const yTop = yCuerpo + 16;
  const yPie = ESTILO_PPT.ALTO - 20;
  const yMax = yPie - 10;

  function columna_(x, titulo, color, items) {
    ppt_texto_(slide, titulo.toUpperCase(), x, yTop, W_COL, ppt_altoTexto_(9, 1),
      { tam: 9, negrita: true, color: color, fuente: ESTILO_ALT4.FUENTE });
    ppt_rect_(slide, x, yTop + ppt_altoTexto_(9, 1) + 6, W_COL, 1.5, color);
    let y = yTop + ppt_altoTexto_(9, 1) + 18;
    const wcTexto = W_COL - 32;
    items.forEach(function (item) {
      const titulo = ppt_acotar_(item.titulo, 140);
      const detalle = item.detalle ? ppt_acotar_(item.detalle, 150) : '';
      const lT = ppt_lineasNecesarias_(titulo, wcTexto, 9.5, true);
      const lD = detalle ? ppt_lineasNecesarias_(detalle, wcTexto, 8, false) : 0;
      const hT = ppt_altoTexto_(9.5, lT), hD = lD ? ppt_altoTexto_(8, lD) : 0;
      const altoTarjeta = 10 + hT + (hD ? 3 + hD : 0) + 10;
      if (y + altoTarjeta > yMax) return; // no cabe completa: se omite, nunca se monta sobre el pie
      ppt_rect_(slide, x, y, W_COL, altoTarjeta, ESTILO_PPT.BLANCO, false);
      ppt_rect_(slide, x, y, 3, altoTarjeta, color);
      ppt_texto_(slide, titulo, x + 16, y + 10, wcTexto, hT,
        { tam: 9.5, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
      if (hD) ppt_texto_(slide, detalle, x + 16, y + 10 + hT + 3, wcTexto, hD,
        { tam: 8, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
      y += altoTarjeta + 8;
    });
  }

  columna_(X_IZQ, 'Prioridades operativas · próximos 15 días', ALT4_PALETA_ACTIVA.accentDeep, prioridades);
  columna_(X_DER, 'Decisiones para el comité', ESTILO_ALT4.AMBAR_TEXTO, decisiones);

  ppt_texto_(slide, 'Portafolio IT Operaciones · corte ' + (corteStr || Utilities.formatDate(hoy, tz, 'dd/MM/yyyy')),
    X0, yPie, ANCHO_DISP, ppt_altoTexto_(7.5, 1), { tam: 7.5, color: ESTILO_ALT4.TEXTO_SEC, fuente: ESTILO_ALT4.FUENTE });
}


/** Notas del orador con el detalle de cada iniciativa (no se ve en la slide, solo al presentar).
 *  Con reintento corto: el text frame de notas a veces no está materializado justo después de
 *  appendSlide(); si falla en ambos intentos, se relanza para que ejecutarPasoSlide_ lo identifique. */
function agregarNotasOrador_(slide, datos) {
  const notas = datos.iniciativas.map(function (it, idx) {
    return (idx + 1) + '. ' + it.nombre + '\nS: ' + (it.resumen_ejecutivo || '');
  }).join('\n\n');
  for (let intento = 1; intento <= 2; intento++) {
    try {
      slide.getNotesPage().getSpeakerNotesShape().getText().setText(notas);
      return;
    } catch (err) {
      if (intento === 1) {
        Utilities.sleep(400);
        continue;
      }
      throw err;
    }
  }
}
// ===================================================================
// SECCIONES NUEVAS DEL DECK — todas se OMITEN por completo si no tienen contenido (nunca se
// genera una slide vacía), y todas paginan cuando el contenido excede su presupuesto vertical.
// ===================================================================

