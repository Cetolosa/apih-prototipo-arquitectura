'use strict';
const GENE = (function () {
  /* ---------- reloj fijo (respeta "Fecha de hoy" de Administración) ---------- */
  const NativeDate = globalThis.Date; let HOY_MS = null;
  class Date extends NativeDate {
    constructor(...a) { if (a.length === 0 && HOY_MS !== null) super(HOY_MS); else super(...a); }
    static now() { return HOY_MS !== null ? HOY_MS : NativeDate.now(); }
  }
  const Logger = { log() { } };
  const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) };
  const Session = { getScriptTimeZone: () => 'America/Santiago' };
  const Utilities = {
    sleep() { },
    formatDate(d, tz, f) {
      const p = (n, l = 2) => String(n).padStart(l, '0');
      return String(f).replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => ({ yyyy: d.getFullYear(), yy: p(d.getFullYear() % 100), MM: p(d.getMonth() + 1), dd: p(d.getDate()), HH: p(d.getHours()), mm: p(d.getMinutes()), ss: p(d.getSeconds()) }[t]));
    }
  };
  /* ---------- SlidesApp local: cada operación queda registrada como elemento ---------- */
  const SlidesApp = {
    ShapeType: { RECTANGLE: 'RECT', ROUND_RECTANGLE: 'ROUND', ELLIPSE: 'ELLIPSE', TEXT_BOX: 'TEXT', RIGHT_ARROW: 'RIGHT_ARROW' },
    ParagraphAlignment: { START: 'l', CENTER: 'ctr', END: 'r', JUSTIFIED: 'just' },
    ContentAlignment: { TOP: 't', MIDDLE: 'ctr', BOTTOM: 'b' },
    PredefinedLayout: { BLANK: 'BLANK' }
  };
  function mkShape(slide, shape, x, y, w, h, texto) {
    const el = { shape, x, y, w, h, fill: null, line: null, text: texto == null ? '' : String(texto), size: 10, bold: false, italic: false, color: '#000000', align: 'l', anchor: 't', rot: 0 };
    slide.els.push(el);
    const api = {
      _el: el,
      getFill() { return { setSolidFill(c) { el.fill = c; return this; }, setTransparent() { el.fill = null; return this; } }; },
      getBorder() {
        const b = {
          setTransparent() { el.line = null; return b; },
          setWeight(wt) { el.line = el.line || { c: '#000000', w: 1 }; el.line.w = wt; return b; },
          getLineFill() { return { setSolidFill(c) { el.line = el.line || { c, w: 1 }; el.line.c = c; return b; } }; }
        };
        return b;
      },
      getText() {
        const t = {
          setText(s) { el.text = String(s); return t; },
          getTextStyle() {
            const s = {
              setFontFamily() { return s; }, setFontSize(n) { el.size = n; return s; }, setBold(v) { el.bold = !!v; return s; },
              setItalic(v) { el.italic = !!v; return s; }, setForegroundColor(c) { el.color = c; return s; }
            };
            return s;
          },
          getParagraphStyle() { const p = { setParagraphAlignment(a) { el.align = a; return p; } }; return p; }
        };
        return t;
      },
      setContentAlignment(a) { el.anchor = a; return api; },
      setRotation(r) { el.rot = r; return api; },
      sendToBack() { slide.els.splice(slide.els.indexOf(el), 1); slide.els.unshift(el); return api; }
    };
    return api;
  }
  let COLECTOR = [];
  function nuevaSlideObj() {
    const s = {
      els: [], bg: '#FFFFFF',
      insertShape(t, x, y, w, h) { return mkShape(s, t, x, y, w, h); },
      insertTextBox(tx, x, y, w, h) { return mkShape(s, 'TEXT', x, y, w, h, tx); },
      getBackground() { return { setSolidFill(c) { s.bg = c; } }; }
    };
    COLECTOR.push(s); return s;
  }
  var PPT_MOTOR = { modo: 'directo', ops: 0, pres: { appendSlide: nuevaSlideObj } };
  function ppt_nuevaSlide_() { return PPT_MOTOR.pres.appendSlide(); }

  /* ---------- datos (las "hojas" del sistema original, armadas desde APIH) ---------- */
  let GD = {};
  function leerHojaComoObjetos_(nombre) { return (GD[nombre] || []).map(r => Object.assign({}, r)); }

/* ===== CÓDIGO ORIGINAL (Codigo_Presentaciones.gs) — portado sin cambios de diseño ===== */
function ppt_decisionAplicaAArea_(area, areaObjetivo) {
  if (!areaObjetivo || !area) return true;
  return iniciativaPerteneceAArea_(area, areaObjetivo);
}

const ESTILO_PPT = {
  ANCHO: 720, ALTO: 405, FRANJA: 8,
  NEGRO: '#16161A', CARBON: '#242429', ROJO: '#C00000', BLANCO: '#FFFFFF',
  GRIS: '#666A72', GRIS_SUAVE: '#8A8D94', GRIS_CLARO: '#BBBBBB', PANEL: '#EBEBEE',
  VERDE_CLARO: '#7BC47F', AMBAR_CLARO: '#E8B84B', ROJO_CLARO: '#FF7B7B'
};

/** Acota un texto libre a un presupuesto de caracteres calzado a su caja, con elipsis. */
function ppt_acotar_(texto, max) {
  const s = String(texto === null || texto === undefined ? '' : texto).trim();
  if (s.length <= max) return s;
  return s.substring(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** Margen interno que Google Slides aplica dentro de CADA textbox y shape con texto
 *  (~7.2pt por lado en horizontal). No se puede desactivar desde Apps Script, así que todo
 *  cálculo de "cuánto texto cabe" debe descontarlo. Ignorarlo fue la causa raíz de los
 *  desbordes: el texto se envolvía a 2 líneas y, como Slides no recorta, pisaba lo de abajo. */
const PPT_INSET_H = 14.4;

/** Margen interno VERTICAL de los textbox de Slides (~3.6pt arriba + 3.6pt abajo) más el
 *  interlineado. Ignorarlo era la causa de que etiquetas ajustadas al milímetro se derramaran
 *  sobre lo que tuvieran debajo (la barra de categorías, el borde de una tarjeta). */
const PPT_INSET_V = 7.2;

/** Factor de interlineado: una línea de N puntos ocupa N*1.25 de alto real. */
const PPT_INTERLINEA = 1.25;

/** Alto MÍNIMO que debe declarar una caja para que N líneas de un tamaño dado quepan sin
 *  derramarse. Usar siempre esto en vez de estimar el alto "a ojo". */
function ppt_altoTexto_(tamFuente, lineas) {
  return Math.ceil(PPT_INSET_V + (lineas || 1) * tamFuente * PPT_INTERLINEA);
}

/** Cuántas líneas de un tamaño dado caben en una caja de alto conocido. */
function ppt_lineasEnAlto_(altoPt, tamFuente) {
  return Math.max(1, Math.floor((altoPt - PPT_INSET_V) / (tamFuente * PPT_INTERLINEA)));
}

/** Alto de una caja que AJUSTA a los glifos de una sola línea (margen superior + alto real de
 *  ascendentes y descendentes), sin el espacio muerto de interlineado que deja ppt_altoTexto_.
 *  Se usa para títulos y etiquetas donde algo se dibuja justo debajo y necesitamos que la
 *  distancia visual sea la real: con ppt_altoTexto_ la caja sobra ~7pt por abajo y cualquier
 *  cosa que se apoye en su borde queda demasiado separada, o —si se compensa a ojo— demasiado
 *  pegada, que es lo que le pasaba a la línea roja bajo el título. */
function ppt_altoGlifos_(tamFuente) {
  return Math.ceil(PPT_INSET_V / 2 + tamFuente * 1.15);
}

/** Ancho por carácter, como fracción del tamaño de fuente. Conservador para acentos y
 *  mayúsculas del español. */
function ppt_factorAncho_(negrita) { return negrita ? 0.62 : 0.52; }

/** Acota un texto para que SIEMPRE quepa en una sola línea dentro de una caja de un ancho (en
 *  puntos) y tamaño de fuente dados. anchoPt es el ancho DECLARADO de la caja; el margen
 *  interno de Slides se descuenta aquí adentro. */
function ppt_acotarParaAncho_(texto, anchoPt, tamFuente, negrita) {
  const util = Math.max(8, anchoPt - PPT_INSET_H);
  const maxChars = Math.max(4, Math.floor(util / (tamFuente * ppt_factorAncho_(negrita))));
  return ppt_acotar_(texto, maxChars);
}

/** Como ppt_acotarParaAncho_, pero para una caja de VARIAS líneas: acota al total de
 *  caracteres que entran en `lineas` líneas de ese ancho, no a una sola. Bug real que se
 *  repetía en varios lugares: la caja se declaraba con espacio para N líneas
 *  (ppt_altoTexto_(tam, N)) pero el texto se acotaba con la versión de una sola línea — la
 *  caja tenía lugar de sobra que nunca se usaba, y el texto se cortaba mucho antes de lo
 *  necesario. Usar SIEMPRE esta versión (no ppt_acotarParaAncho_) cuando la caja declarada
 *  tiene más de una línea de alto. */
function ppt_acotarParaCaja_(texto, anchoPt, tamFuente, negrita, lineas) {
  const util = Math.max(8, anchoPt - PPT_INSET_H);
  const maxChars = Math.max(4, Math.floor(util / (tamFuente * ppt_factorAncho_(negrita)))) * Math.max(1, lineas);
  return ppt_acotar_(texto, maxChars);
}

/** Mide cuántas líneas necesita REALMENTE un texto en un ancho dado (no una suposición fija de
 *  N líneas) — así el texto se acota solo si de verdad no entra, y si entra completo se muestra
 *  completo, sin dejar espacio en blanco sin usar ni cortar cuando sobra lugar. */
function ppt_lineasNecesarias_(texto, wc, tamFuente, negrita) {
  const charsPorLinea = Math.max(1, Math.floor((wc - PPT_INSET_H) / (tamFuente * ppt_factorAncho_(negrita))));
  return Math.max(1, Math.ceil(String(texto || '').length / charsPorLinea));
}

/** Ancho de caja necesario para que un texto quepa en UNA línea, incluyendo el margen interno
 *  de Slides. Se usa para dimensionar badges/chips a partir de su contenido, en vez de fijar
 *  un ancho y esperar que el texto quepa (que es como se apilaban las letras del badge "AC"). */
function ppt_anchoParaTexto_(texto, tamFuente, negrita, minimo, maximo) {
  const s = String(texto === null || texto === undefined ? '' : texto).trim();
  const necesario = s.length * tamFuente * ppt_factorAncho_(negrita) + PPT_INSET_H + 4;
  const min = minimo || 0;
  const max = maximo || 9999;
  return Math.round(Math.max(min, Math.min(max, necesario)));
}

/** Dibuja un badge/chip como UNA sola shape (fondo + texto en el mismo objeto, para evitar el
 *  desalineado que produce superponer un textbox sobre un rect) con ancho calculado a partir
 *  del contenido. Devuelve el ancho usado, para poder encadenar badges horizontalmente. */
function ppt_badge_(slide, texto, x, y, alto, opciones) {
  const o = opciones || {};
  const tam = o.tam || 6.5;
  const negrita = o.negrita !== false;
  const ancho = ppt_anchoParaTexto_(texto, tam, negrita, o.min || 26, o.max || 120);
  const forma = ppt_forma_(slide, SlidesApp.ShapeType.ROUND_RECTANGLE, x, y, ancho, alto);
  forma.getFill().setSolidFill(o.fondo || ESTILO_PPT.PANEL);
  if (o.borde) {
    forma.getBorder().getLineFill().setSolidFill(o.borde);
    forma.getBorder().setWeight(0.75);
  } else {
    forma.getBorder().setTransparent();
  }
  if (PPT_MOTOR && PPT_MOTOR.modo === 'lote') {
    ppt_req_({ insertText: { objectId: forma.__id, text: String(texto), insertionIndex: 0 } });
    ppt_estiloCompleto_(forma.__id, tam, negrita, false, o.color || ESTILO_PPT.NEGRO,
      SlidesApp.ParagraphAlignment.CENTER, true);
    return ancho;
  }
  const t = forma.getText();
  t.setText(String(texto));
  const st = t.getTextStyle();
  st.setFontFamily('Arial');
  st.setFontSize(tam);
  st.setBold(negrita);
  st.setForegroundColor(o.color || ESTILO_PPT.NEGRO);
  t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  forma.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  return ancho;
}

/** Inserta un textbox con estilo. NUNCA crea un textbox con string vacío (usa '—').
 *
 *  AUTOCORRECCIÓN DE ALTO: si el alto pedido es menor que el que una línea necesita
 *  realmente (margen interno + interlineado), la caja se agranda sola. Esto vuelve
 *  ESTRUCTURALMENTE IMPOSIBLE declarar una caja más chica que su texto —el error que hacía
 *  que las etiquetas se derramaran sobre lo de abajo— y además deja la geometría declarada
 *  igual a la renderizada, que es la precondición para que auditarGeometriaPresentacion()
 *  detecte solapes reales en vez de dar falsos negativos.
 *
 *  Si necesitas que la caja NO crezca (por ejemplo para centrar con `medio` dentro de un
 *  chip de alto fijo), pasa `altoFijo: true`. */
function ppt_texto_(slide, texto, x, y, w, h, opciones) {
  const o = opciones || {};
  let t = String(texto === null || texto === undefined ? '' : texto).trim();
  if (!t) t = '—';
  const tam = o.tam || 10;
  const hMin = ppt_altoTexto_(tam, 1);
  let yFinal = y, hFinal = h;
  if (!o.altoFijo && h < hMin) {
    if (o.medio) {
      // Centrado vertical: crece simétricamente para NO mover el centro visual del texto.
      yFinal = y - (hMin - h) / 2;
      hFinal = hMin;
    } else {
      // Alineado arriba: el texto se dibuja desde el borde superior, así que crecer hacia
      // abajo refleja exactamente lo que Slides ya estaba renderizando.
      hFinal = hMin;
    }
  }
  const caja = ppt_cajaTexto_(slide, t, x, yFinal, w, hFinal);
  if (PPT_MOTOR && PPT_MOTOR.modo === 'lote') {
    ppt_estiloCompleto_(caja.__id, tam, o.negrita, o.italica, o.color || ESTILO_PPT.NEGRO, o.alinear, o.medio);
    return caja;
  }
  const st = caja.getText().getTextStyle();
  st.setFontFamily('Arial');
  st.setFontSize(tam);
  st.setForegroundColor(o.color || ESTILO_PPT.NEGRO);
  if (o.negrita) st.setBold(true);
  if (o.italica) st.setItalic(true);
  if (o.alinear) caja.getText().getParagraphStyle().setParagraphAlignment(o.alinear);
  if (o.medio) caja.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  return caja;
}

function ppt_fondo_(slide, color) {
  if (PPT_MOTOR.modo !== 'lote') { slide.getBackground().setSolidFill(color); return; }
  ppt_req_({ updatePageProperties: {
    objectId: ppt_pageId_(slide),
    fields: 'pageBackgroundFill.solidFill.color',
    pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: ppt_rgb_(color) } } } }
  } });
}

function ppt_forma_(slide, tipo, x, y, w, h) {
  PPT_MOTOR.ops++;
  if (PPT_MOTOR.modo !== 'lote') return slide.insertShape(tipo, x, y, w, h);
  const id = ppt_nuevoId_('e');
  ppt_req_({ createShape: { objectId: id, shapeType: ppt_tipoApi_(tipo),
    elementProperties: {
      pageObjectId: ppt_pageId_(slide),
      size: { width: { magnitude: w, unit: 'PT' }, height: { magnitude: h, unit: 'PT' } },
      transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' }
    } } });
  return ppt_proxyForma_(id);
}

function ppt_cajaTexto_(slide, texto, x, y, w, h) {
  PPT_MOTOR.ops++;
  if (PPT_MOTOR.modo !== 'lote') return slide.insertTextBox(texto, x, y, w, h);
  const id = ppt_nuevoId_('t');
  ppt_req_({ createShape: { objectId: id, shapeType: 'TEXT_BOX',
    elementProperties: {
      pageObjectId: ppt_pageId_(slide),
      size: { width: { magnitude: w, unit: 'PT' }, height: { magnitude: h, unit: 'PT' } },
      transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' }
    } } });
  ppt_req_({ insertText: { objectId: id, text: String(texto), insertionIndex: 0 } });
  return ppt_proxyForma_(id);
}

function ppt_textoRotado90_(slide, texto, x, y, w, h, opciones) {
  const o = opciones || {};
  if (PPT_MOTOR.modo === 'lote') {
    // No hay una fórmula de rotación verificada para el motor por lotes (REST) todavía —
    // mejor un error claro acá que texto mal ubicado en silencio. Si esto se dispara, avisa:
    // significa que se habilitó la API de Slides en el proyecto GCP (el motor por lotes ya
    // no cae al modo directo) y hay que portar esta función a ese camino.
    throw new Error('ppt_textoRotado90_ todavía no soporta el motor por lotes — solo modo directo.');
  }
  const xSinRotar = x - (w - h) / 2;
  const ySinRotar = y - (h - w) / 2;
  const caja = slide.insertTextBox(String(texto), xSinRotar, ySinRotar, w, h);
  // 270° por defecto: mismo pivote central, así que la posición no cambia — solo invierte el
  // sentido de lectura de la cinta lateral, de abajo-hacia-arriba a arriba-hacia-abajo.
  // o.rotacion permite 90° para una cinta de cierre reflejada (se lee al revés que la de apertura).
  caja.setRotation(o.rotacion || 270);
  const st = caja.getText().getTextStyle();
  st.setFontFamily('Arial');
  st.setFontSize(o.tam || 10);
  st.setForegroundColor(o.color || ESTILO_PPT.BLANCO);
  if (o.negrita) st.setBold(true);
  caja.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  caja.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  return caja;
}

function ppt_rect_(slide, x, y, w, h, color, redondeado) {
  const forma = ppt_forma_(slide, redondeado ? SlidesApp.ShapeType.ROUND_RECTANGLE : SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  forma.getFill().setSolidFill(color);
  forma.getBorder().setTransparent();
  return forma;
}

/** Fondo oscuro + franja roja lateral (portada, anexo, cierre) */
function ppt_fondoOscuro_(slide) {
  ppt_fondo_(slide, ESTILO_PPT.NEGRO);
  ppt_rect_(slide, 0, 0, ESTILO_PPT.FRANJA, ESTILO_PPT.ALTO, ESTILO_PPT.ROJO);
}

/** Fondo gris muy suave + franja roja lateral (slides de contenido).
 *  #F7F7F9 en vez de blanco puro: las tarjetas PANEL (#EBEBEE) tienen contraste visible
 *  sin parecer oscuras, y el conjunto se siente más editorial que genérico. */
function ppt_fondoClaro_(slide) {
  ppt_fondo_(slide, '#F7F7F9');
  ppt_rect_(slide, 0, 0, ESTILO_PPT.FRANJA, ESTILO_PPT.ALTO, ESTILO_PPT.ROJO);
}

/** Encabezado estándar de slide de contenido: título grande + línea decorativa roja fina +
 *  subtítulo gris.
 *
 *  Todas las posiciones se derivan del tamaño de fuente. La línea roja iba antes en un y fijo
 *  que caía DENTRO de la caja del título, pegada a los descendentes; ahora se apoya a 5pt por
 *  debajo del borde real de los glifos, y el subtítulo a 4pt bajo la línea. Cambiar el tamaño
 *  del título reacomoda todo solo.
 *
 *  El bloque completo termina en Y_CONTENIDO_INICIAL, que es la referencia que deben usar las
 *  slides para empezar su contenido. */
const PPT_TAM_TITULO = 21;
const PPT_TAM_SUBTITULO = 9.5;
const PPT_Y_TITULO = 14;
const PPT_Y_LINEA = PPT_Y_TITULO + ppt_altoGlifos_(PPT_TAM_TITULO) + 5;
const PPT_Y_SUBTITULO = PPT_Y_LINEA + 2 + 4;
const Y_CONTENIDO_INICIAL = PPT_Y_SUBTITULO + ppt_altoGlifos_(PPT_TAM_SUBTITULO) + 6;

function ppt_encabezado_(slide, titulo, subtitulo) {
  ppt_texto_(slide, ppt_acotarParaAncho_(titulo, 560, PPT_TAM_TITULO, true),
    34, PPT_Y_TITULO, 560, ppt_altoGlifos_(PPT_TAM_TITULO),
    { tam: PPT_TAM_TITULO, negrita: true, altoFijo: true });
  ppt_rect_(slide, 34, PPT_Y_LINEA, 60, 2, ESTILO_PPT.ROJO);
  if (subtitulo) {
    ppt_texto_(slide, ppt_acotarParaAncho_(subtitulo, 620, PPT_TAM_SUBTITULO, false),
      34, PPT_Y_SUBTITULO, 620, ppt_altoGlifos_(PPT_TAM_SUBTITULO),
      { tam: PPT_TAM_SUBTITULO, color: ESTILO_PPT.GRIS, altoFijo: true });
  }
}

/** Divide una lista en páginas de tamaño fijo */
function ppt_paginar_(items, porPagina) {
  const paginas = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return paginas.length > 0 ? paginas : [[]];
}

// ===================================================================
// SLIDES
// ===================================================================

function construirSlidePortada_(slide, etiquetaArea, cicloStr) {
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

function construirSlideEjecutivo_(slide, datos, baseline, mensajePrincipal, corteStr, fechaCiclo, areaObjetivo) {
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
    return !areaObjetivo || iniciativaPerteneceAArea_(p.area, areaObjetivo);
  });
  const todasLasSolucionesProp = leerHojaComoObjetos_('SolucionesProveedor');
  const hoyProp = new Date();
  const fechaCicloISOProp = fechaCiclo ? Utilities.formatDate(fechaCiclo, Session.getScriptTimeZone(), 'yyyy-MM-dd') : null;
  let propConBloqueo = 0, propEnAprobacion = 0, propSumaDias = 0;
  let bucketTemprana = 0, bucketMedia = 0, bucketAprobacion = 0;
  const propuestasConDetalle = propuestasVisibles.map(function (p) {
    const soluciones = todasLasSolucionesProp.filter(function (s) { return s.propuesta_id === p.id; });
    const bloqueo = calcularBloqueoPropuesta_(p, soluciones);
    if (bloqueo) propConBloqueo++;
    const etapa = p.etapa_propuesta || 'Creada';
    if (etapa === 'Aprobación') { propEnAprobacion++; bucketAprobacion++; }
    else if (etapa === 'Caso de Negocio' || etapa === 'Soluciones de proveedor') bucketMedia++;
    else if (etapa !== 'En espera') bucketTemprana++;
    const fEtapa = parsearFecha_(p.fecha_etapa) || parsearFecha_(p.fecha_propuesta);
    const dias = fEtapa ? Math.floor((hoyProp - fEtapa) / (1000 * 3600 * 24)) : 0;
    propSumaDias += dias;
    const fFoco = parsearFecha_(p.foco_ciclo_fecha);
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
        const f = parsearFecha_(it.foco_ciclo_fecha);
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
const ESTILO_ALT4 = {
  FONDO: '#F6F4EF', FONDO_OSCURO: '#1C1B19',
  TEXTO: '#1C1B19', TEXTO_SEC: '#8A827A', TEXTO_TERC: '#A39E97',
  VERDE_OK: '#2F7D4F', AMBAR_FONDO: '#FBF1DE', AMBAR_TEXTO: '#B8860B',
  RAIL_ANCHO: 82, FUENTE: 'Archivo', AZUL: '#3D5A80'
};
const ALT4_PALETA_ACTIVA = { accent: '#B5450D', accentDeep: '#8A4321' }; // tweak "palette"
var ALT4_PAGINA_ACTUAL = 0; // contador de página del rail — reseteado una vez por deck en generarPresentacion_

/** Fondo crema + línea vertical del rail + textos de número/kicker/área. El número de página se
 *  autoincrementa (no se pasa a mano) — así ninguna función de slide necesita saber su posición
 *  absoluta en un deck cuyo largo total varía según cuántas fichas/proyectos/propuestas haya. */
function ppt_alt4Fondo_(slide, kicker, area) {
  ALT4_PAGINA_ACTUAL++; slide.pageInc = (slide.pageInc || 0) + 1;
  ppt_fondo_(slide, ESTILO_ALT4.FONDO);
  ppt_rect_(slide, ESTILO_ALT4.RAIL_ANCHO, 0, 1, ESTILO_PPT.ALTO, '#D4CFC4');
  ppt_texto_(slide, String(ALT4_PAGINA_ACTUAL).padStart(2, '0'), 14, 20, 50, ppt_altoTexto_(20, 1),
    { tam: 20, negrita: true, color: ESTILO_ALT4.TEXTO, fuente: ESTILO_ALT4.FUENTE });
  ppt_textoRotado90_(slide, (kicker || '').toUpperCase(), 30, 90, 220, 22,
    { tam: 8, negrita: true, color: ALT4_PALETA_ACTIVA.accentDeep, fuente: ESTILO_ALT4.FUENTE, rotacion: 270 });
  const areasRail = areasDeIniciativa_(area);
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
function ppt_fichaFondo_(slide) {
  ALT4_PAGINA_ACTUAL++; slide.pageInc = (slide.pageInc || 0) + 1;
  ppt_fondo_(slide, ESTILO_ALT4.FONDO);
}

/** Mezcla un color con un fondo (por defecto crema) al factor dado — para el "fondo tintado al
 *  10%" del badge píldora que pide la guía de estilo (la API de Slides no soporta alpha en
 *  setSolidFill, así que se pre-mezcla el hex). */
function ppt_tintar_(colorHex, factor, fondoHex) {
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
function ppt_alt4Header_(slide, titulo, badgeTexto, badgeColor) {
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

function construirSlideFlujoPropuestas_(areaObjetivo, corteStr) {
  const propuestas = leerHojaComoObjetos_('Propuestas').filter(function (p) {
    const archivada = p.archivada === true || p.archivada === 'TRUE' || p.archivada === 'true';
    return !archivada && (!areaObjetivo || iniciativaPerteneceAArea_(p.area, areaObjetivo));
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

function construirSlideFlujoProyectos_(datos, corteStr, areaObjetivo) {
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
function construirSlidesDetalle_(datos, baseline, corteStr, panoramaTrimestral, mapaImpactoEsfuerzo, hitosPorIniciativa, tituloSlide) {
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
    const esperado = Math.round(calcularAvanceEsperado_(it.fecha_inicio, it.fecha_fin_estimada, new Date()));
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
    const fitResumen = ppt_autoencajarParrafo_(it.resumen_ejecutivo || '—', W_NOMBRE, hResumenDisp, 8, 7, false);
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


function construirSlideAnexo_(slide) {
  ppt_fondo_(slide, ESTILO_ALT4.FONDO_OSCURO);
  ppt_texto_(slide, 'ANEXO', 96, 90, 400, ppt_altoTexto_(8, 1), { tam: 8, negrita: true, color: ppt_tintar_(ALT4_PALETA_ACTIVA.accent, 0.65, '#1C1B19'), fuente: ESTILO_ALT4.FUENTE });
  ppt_texto_(slide, 'Ficha individual por iniciativa marcada', 94, 106, 560, 90,
    { tam: 34, negrita: true, color: ESTILO_ALT4.FONDO, fuente: ESTILO_ALT4.FUENTE, altoFijo: true });
}

/** Ficha individual de proyecto — "Reporte de avance" (estilo Alt4). Versión completa con
 *  overrides manuales y cálculo automático:
 *   - avance_fase ("Avance fase activa"): vacío = % de hitos completados; si no hay hitos, = avance.
 *   - logros_ciclo ("Esta semana"): vacío = notas HUMANAS del Historial posteriores al corte
 *     (se descartan las autogeneradas y los volcados de Date); si no hay, los hitos completados.
 *   - proximos_pasos ("Lo que viene"): vacío = hitos pendientes.
 *  Sobrescribibles desde la grilla o la ficha de detalle web.
 */
function construirSlideFicha_(slide, it, base, corteStr, descripcionBase, hitos, clasificacion, corte) {
  // Ficha v5: sin columna lateral ("01"), encabezado compacto, KPIs más altos, presupuesto como
  // cuadro largo y tres cajas grandes que se llevan el resto de la altura. Misma paleta y estilo.
  ppt_fichaFondo_(slide);
  const X0 = 18, ANCHO_DISP = ESTILO_PPT.ANCHO - X0 * 2;
  const A = ALT4_PALETA_ACTIVA;
  const F = ESTILO_ALT4.FUENTE;
  const CENTER = SlidesApp.ParagraphAlignment.CENTER, END = SlidesApp.ParagraphAlignment.END, START = SlidesApp.ParagraphAlignment.START;
  const fmt = function (v) {
    const f = parsearFecha_(v);
    return f ? Utilities.formatDate(f, Session.getScriptTimeZone(), 'dd/MM/yy') : '';
  };
  const lineas_ = function (txt) {
    return String(txt || '').split(/[\n;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  };
  const avance = Math.max(0, Math.min(100, Number(it.avance) || 0));

  const hitosOrd = (hitos || []).filter(function (h) { return muestraDetalle_(h.mostrar_detalle); })
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
  const areaFmt = areasDeIniciativa_(it.area).join(', ') || (it.area || '');
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
          const f = parsearFecha_(h.fecha);
          return f && f > corte;
        })
        .sort(function (a, b) { return (parsearFecha_(b.fecha) || 0) - (parsearFecha_(a.fecha) || 0); })
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

function construirSlideFichaPropuesta_(slide, p, soluciones) {
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
  const fEtapa = parsearFecha_(p.fecha_etapa) || parsearFecha_(p.fecha_propuesta);
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
    candidatos = it.proximo_hito ? [{ nombre: it.proximo_hito, fecha: parsearFecha_(it.proximo_hito_fecha), completado: false }] : [];
  } else {
    candidatos = hitos.filter(function (h) { return muestraDetalle_(h.mostrar_detalle); }).sort(function (a, b) {
      if (!a.fecha && !b.fecha) return 0;
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return a.fecha - b.fecha;
    });
  }

  const fFin = parsearFecha_(it.fecha_fin_estimada);
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
function construirSlidesBitacora_(decisiones, seguimientoCompromisos, comentarios, corteStr) {
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
        ? [c.responsable, c.fechaLimite ? (c.vencido ? 'venció ' : 'vence ') + fmtCortoHito_(c.fechaLimite) : null].filter(Boolean).join(' · ')
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
          ? [c.responsable, c.fechaLimite ? (c.vencido ? 'venció ' : 'vence ') + fmtCortoHito_(c.fechaLimite) : null].filter(Boolean).join(' · ')
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
function construirSlideEstructuraPortafolio_(slide, datos) {
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
    const esperadoRaw = calcularAvanceEsperado_(it.fecha_inicio, it.fecha_fin_estimada, hoy);
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

function construirSlidePlanAccion_(slide, datos, decisionesDelArea, seguimientoCompromisos, corteStr, hitosFlat) {
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
    const bloqueo = calcularBloqueoPropuesta_(p, soluciones);
    const fEtapa = parsearFecha_(p.fecha_etapa) || parsearFecha_(p.fecha_propuesta);
    const dias = fEtapa ? Math.floor((hoy - fEtapa) / (1000 * 3600 * 24)) : 0;
    const f = parsearFecha_(p.fecha_propuesta);
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

function construirSlidesLogros_(datos, baseline, corte, hitosFlat, corteStr, areaObjetivo) {
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
      const fechaArchivado = parsearFecha_(fila.fecha_archivado);
      if (!fechaArchivado || fechaArchivado <= corte) return;
      if (areaObjetivo && !iniciativaPerteneceAArea_(fila.area, areaObjetivo)) return;
      salidas.push({ nombre: fila.nombre, area: fila.area, responsable: fila.responsable, estadoTxt: '✕ Archivada · quedó en ' + (Number(fila.avance) || 0) + '%', colorEstado: ESTILO_ALT4.TEXTO_SEC });
    });

    // Nuevas este ciclo: fecha_creacion real, NO ausencia en baseline (mismo motivo que arriba).
    datos.iniciativas.forEach(function (it) {
      const fechaCreacion = parsearFecha_(it.fecha_creacion);
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
      (!areaObjetivo || iniciativaPerteneceAArea_(p.area, areaObjetivo));
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
function construirSlidesProximosHitos_(hitosFlat, corteStr) {
  const hoy = new Date();
  const DIAS_ATRAS = 15, DIAS_FUTURO = 45;
  const limiteMax = new Date(hoy.getTime() + DIAS_FUTURO * 24 * 3600 * 1000);
  const limiteMin = new Date(hoy.getTime() - DIAS_ATRAS * 24 * 3600 * 1000);
  const rangoTotal = limiteMax.getTime() - limiteMin.getTime();
  function frac_(fecha) { return Math.max(0, Math.min(1, (fecha.getTime() - limiteMin.getTime()) / rangoTotal)); }

  const hitosVentana = hitosFlat.filter(function (h) {
    return h.fecha && h.fecha >= limiteMin && h.fecha <= limiteMax && muestraDetalle_(h.mostrar_detalle);
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
function construirSlidesAlertasEstancamiento_(datos, baseline, baseline2, corteStr, corte2Str) {
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

/** Correr UNA VEZ desde el editor: crea la pestaña DecisionesPendientes si no existe. */

function muestraDetalle_(valor) {
  return valor !== false && valor !== 'FALSE' && valor !== 'false';
}

function calcularBloqueoPropuesta_(p, soluciones) {
  const etapa = p.etapa_propuesta || 'Creada';
  const haySeleccionada = soluciones.some(function (s) { return s.seleccionada === true || s.seleccionada === 'TRUE' || s.seleccionada === 'true'; });

  if (etapa === 'Caso de Negocio') {
    const faltanCampos = !p.prioridad || !p.responsable_negocio || !(Number(p.presupuesto_asignado) > 0);
    if (faltanCampos) return 'Falta completar el caso de negocio';
    if (!p.rfp_url) return 'Falta adjuntar el RFP';
  }
  if (etapa === 'Soluciones de proveedor') {
    if (soluciones.length === 0) return 'Sin soluciones de proveedor cargadas';
    if (!haySeleccionada) return 'Falta seleccionar una solución';
  }
  if (etapa === 'Aprobación' && !haySeleccionada) {
    return 'Falta seleccionar una solución antes de aprobar';
  }
  return null;
}

function parsearFecha_(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'string') {
    const soloFecha = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (soloFecha) {
      const d = new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

function todasLasAreasDe_(iniciativas) {
  const set = {};
  iniciativas.forEach(function (it) {
    areasDeIniciativa_(it.area).forEach(function (a) { set[a] = true; });
  });
  return Object.keys(set).sort();
}

function areasDeIniciativa_(valorArea) {
  if (!valorArea) return [];
  return String(valorArea).split(',').map(function (a) { return a.trim(); }).filter(Boolean);
}

function iniciativaPerteneceAArea_(valorAreaIniciativa, areaBuscada) {
  if (!areaBuscada) return true; // sin filtro de área = todas
  return areasDeIniciativa_(valorAreaIniciativa).indexOf(areaBuscada) !== -1;
}

function calcularAvanceEsperado_(fechaInicioRaw, fechaFinRaw, hoy) {
  const fechaInicio = parsearFecha_(fechaInicioRaw);
  const fechaFin = parsearFecha_(fechaFinRaw);
  if (!fechaInicio || !fechaFin || fechaFin <= fechaInicio) return null;

  if (hoy <= fechaInicio) return 0;
  if (hoy >= fechaFin) return 100;

  const transcurrido = hoy - fechaInicio;
  const total = fechaFin - fechaInicio;
  return Math.round((transcurrido / total) * 100);
}
/* ===== fin código original ===== */

  /* =====================================================================
     ADAPTADORES: datos de APIH → las "hojas" que lee el código original
     ===================================================================== */
  const FALLBACK_MENSAJE_PRINCIPAL = 'Portafolio de iniciativas TI avanzando hacia una plataforma digital integrada para Operaciones.';
  const D = iso => iso ? new Date(+String(iso).slice(0, 4), +String(iso).slice(5, 7) - 1, +String(iso).slice(8, 10)) : null;
  const ragO = r => r === 'Ámbar' ? 'Ambar' : (r || 'Ambar');
  const MM = v => (Number(v) || 0) * 1e6;                       // APIH guarda MM CLP; el original muestra pesos
  const MMi = (i, v) => (Number(v) || 0) * ({ CLP: 1e6, USD: 1e3, UF: 1 }[monOf(i)]);   // USD en miles, UF en unidades
  const lineas = t => String(t || '');
  const ETAPA_PROP = { 'Recepción': 'Creada', 'Evaluación': 'En evaluación', 'Caso de Negocio': 'Con caso de negocio', 'Aprobación': 'Aprobación' };
  const estadoPrj = i => i.estado === 'Pausado' ? 'A la Espera' : i.estado === 'Stand By' ? 'Stand By' : i.fase;   // Cancelado ya no se rotula Stand By
  const areaDe = i => i.area || '';

  function rowPrj(i) {
    const hs = hitosDe(i.id).filter(inc).filter(h => !h.completado).sort(by('fecha')), top = riesgosDe(i.id).filter(r => riesgoAbierto(r) && inc(r)).sort(by(r => -expo(r)))[0];
    return {
      id: i.id, nombre: i.titulo, categoria: i.categoria, area: areaDe(i), avance: i.avance, salud_rag: ragO(i.rag), prioridad: i.prioridad, estado: estadoPrj(i),
      resumen_ejecutivo: incT(i, 'resumen') ? lineas(i.resumen) : '', proposito: i.desc || '', responsable: i.lider || '', responsable_negocio: i.negocio || '',
      fecha_inicio: i.inicioPlan || null, fecha_fin_estimada: i.finEst || i.finPlan || null,
      presupuesto_asignado: MMi(i, i.presupuesto), presupuesto_gastado: MMi(i, i.gastado), moneda: monOf(i),
      logros_ciclo: incT(i, 'logros') ? lineas(i.logros) : '', proximos_pasos: incT(i, 'proximos') ? lineas(i.proximos) : '',
      issue: incT(i, 'issue') ? lineas(i.issue) : '', riesgo: i.riesgoTxt || (top ? top.desc : ''),
      proximo_hito: hs[0] ? hs[0].nombre : '', proximo_hito_fecha: hs[0] ? hs[0].fecha : null,
      fase_inicio_real: i.faseDesde || null, avance_fase: avFase(i).v, incluir_en_presentacion: true,
      _fase: i.fase, _estadoApih: i.estado
    };
  }
  function rowProp(i) {
    const fase = i.fase, etapa = i.estado === 'En espera' ? 'En espera' : fase;
    return {
      id: i.id, nombre: i.titulo, categoria: i.categoria || 'Sin categoría', area: areaDe(i), prioridad: i.prioridad || 'Media', salud_rag: ragO(i.rag),
      etapa_propuesta: etapa, resultado: ['Vigente', 'En espera'].includes(i.estado) ? 'Pendiente' : i.estado, archivada: false,
      resumen_ejecutivo: i.resumen || i.desc || '', propuesto_por: i.propuestoPor || i.lider || '', fecha_etapa: i.faseDesde || i.creada, fecha_propuesta: i.creada,
      tipo_requerimiento: i.clasif || '—', problema_a_resolver: i.problema || i.resumen || i.desc || '', beneficios_estimados: i.bc || (i.beneficio ? 'Beneficio estimado: ' + fmtMon(i.beneficio, monOf(i)) : ''),
      usuarios_impactados: i.usuarios || areaDe(i), presupuesto_asignado: MMi(i, i.presupuesto), moneda: monOf(i), responsable_negocio: i.negocio || '', rfp_url: i.rfp || '', _fase: i.fase
    };
  }
  /* Clasificación (acción / impacto / esfuerzo) que el original obtenía del análisis trimestral: aquí sale del Reglas PMO y de la ficha */
  function clasif(list) {
    const ter = (arr, v) => { const s = arr.slice().sort((a, b) => a - b); return v >= s[Math.floor(s.length * 2 / 3)] ? 'Alto' : v >= s[Math.floor(s.length / 3)] ? 'Medio' : 'Bajo'; };
    const ben = list.map(i => i.beneficio || 0), rest = list.map(i => Math.max(0, (i.presupuesto || 0) - (i.gastado || 0)));
    const out = {};
    list.forEach(i => { const a = i.rec && i.rec.accion; out[i.id] = { accion: a === 'Pausar' || a === 'Cancelar' ? 'Esperar' : (a || 'Mantener'), impacto: i.score ? (i.score.valor >= 4 ? 'Alto' : i.score.valor >= 3 ? 'Medio' : 'Bajo') : ter(ben, i.beneficio || 0), esfuerzo: i.score ? (i.score.esfuerzo >= 4 ? 'Alto' : i.score.esfuerzo >= 3 ? 'Medio' : 'Bajo') : ter(rest, Math.max(0, (i.presupuesto || 0) - (i.gastado || 0))) }; });
    return out;
  }

  function contexto(c, id) {
    const hoyIso = hoy(); HOY_MS = D(hoyIso).getTime() + 12 * 3600e3;
    const single = !!id, it0 = id ? byId(id) : null;
    const comite = c.comite && St.comites.find(x => x.id === c.comite);
    const fechaCicloIso = comite ? comite.fecha : null, refIso = fechaCicloIso || hoyIso;
    const fechaCiclo = D(fechaCicloIso);
    const prev = St.comites.filter(x => x.estado === 'Realizado' && x.fecha < refIso).sort(by('fecha', -1))[0], prev2 = prev ? St.comites.filter(x => x.estado === 'Realizado' && x.fecha < prev.fecha).sort(by('fecha', -1))[0] : null;
    const corte = prev ? D(prev.fecha) : null, corte2 = prev2 ? D(prev2.fecha) : null;
    const f10 = d => d ? Utilities.formatDate(d, '', 'dd/MM/yyyy') : null;
    const areaObjetivo = single ? '' : (c.area || (St.cfg.areaGlobal !== 'Todas' ? St.cfg.areaGlobal : ''));
    const okArea = i => (!areaObjetivo || areasDeIniciativa_(i.area).includes(areaObjetivo)) && (!PRES_MIO || _nrm(i.lider) === _nrm(miUsuario()));
    // Universo: en un proyecto/propuesta individual sólo ese registro; en portafolio, todo lo vivo del alcance
    const prjAll = single ? (it0 && !esProp(it0) ? [it0] : []) : St.ini.filter(i => !esProp(i) && isLive(i) && okArea(i));
    const propAll = single ? (it0 && esProp(it0) ? [it0] : []) : St.ini.filter(i => esProp(i) && isLive(i) && okArea(i));
    const prj = single ? prjAll : prjAll.filter(inc), prop = single ? propAll : propAll.filter(inc);   // el registro elegido para presentarlo solo entra siempre
    const propTodas = single ? propAll : St.ini.filter(i => esProp(i) && !esSB(i) && okArea(i) && inc(i));
    const ids = {}; [...prj, ...prop].forEach(i => ids[i.id] = 1);
    const hitosRows = St.hitos.filter(h => ids[h.ini]).map(h => ({ iniciativa_id: h.ini, nombre_hito: h.nombre, fecha: h.fecha, completado: !!h.completado, mostrar_detalle: inc(h) }));
    const sols = prop.filter(p => p.proveedor).map(p => ({ propuesta_id: p.id, seleccionada: true }));
    const hist = [];
    St.bitacora.filter(b => b.tipo === 'Comentario' && ids[b.ini] && inc(b)).forEach(b => hist.push({ iniciativa_id: b.ini, fecha: b.ts.slice(0, 10), nota: b.texto }));
    GD = { Hitos: hitosRows, Propuestas: propTodas.map(rowProp), SolucionesProveedor: sols, Historial: hist, Iniciativas: prj.map(rowPrj) };
    const rows = prj.map(rowPrj);
    const standByN = single ? 0 : St.ini.filter(i => esSB(i) && okArea(i)).length;   // Stand By: fuera de todo; solo su número va en «Movimientos del ciclo»
    const datos = { standBy: standByN, iniciativas: rows, resumen: { activas: rows.length, finalizadas: St.ini.filter(i => !esProp(i) && i.estado === 'Completado').length, en_ejecucion: prj.filter(i => i.fase === 'Ejecución' && i.estado === 'En curso').length, criticas: prj.filter(i => i.rag === 'Rojo').length } };
    const propRows = GD.Propuestas.filter(p => p.resultado === 'Pendiente');
    const propAsIni = propRows.map(p => {
      const fE = parsearFecha_(p.fecha_etapa) || parsearFecha_(p.fecha_propuesta), dias = fE ? Math.max(0, Math.floor((new Date() - fE) / 86400000)) : 0;
      return { id: p.id, nombre: p.nombre, categoria: p.categoria, area: p.area, avance: 0, salud_rag: p.salud_rag, prioridad: p.prioridad, estado: 'Propuesta · ' + p.etapa_propuesta, resumen_ejecutivo: p.resumen_ejecutivo, fecha_inicio: null, _esPropuesta: true, _etapa: p.etapa_propuesta, _diasEtapa: dias, _bloqueo: calcularBloqueoPropuesta_(p, sols.filter(s => s.propuesta_id === p.id)) };
    });
    // baseline = avance al corte (reconstruido del historial de cada proyecto)
    const base = corteD => { const r = {}; if (!corteD) return r; const lim = toISO(corteD); prj.forEach(i => { const h = (i.hist || []).filter(x => x[0] <= lim).slice(-1)[0]; if (h) r[i.id] = { fecha: D(h[0]), avance: h[1], estado: estadoPrj(i) }; }); return r; };
    const baseline = base(corte), baseline2 = base(corte2);
    // hitos por iniciativa (igual que el original, incl. la regla de fecha de ciclo)
    const hitosPorIniciativa = {};
    hitosRows.forEach(h => { (hitosPorIniciativa[h.iniciativa_id] = hitosPorIniciativa[h.iniciativa_id] || []).push({ nombre: h.nombre_hito, fecha: parsearFecha_(h.fecha), completado: h.completado && (!fechaCiclo || !parsearFecha_(h.fecha) || parsearFecha_(h.fecha) <= fechaCiclo), mostrar_detalle: h.mostrar_detalle }); });
    const nombrePorId = {}, nombreV = {}, areaV = {}; rows.forEach(r => nombrePorId[r.id] = r.nombre);
    St.ini.forEach(i => { nombreV[i.id] = i.titulo; areaV[i.id] = i.area; });
    const hitosFlat = []; Object.keys(hitosPorIniciativa).forEach(k => { if (!nombrePorId[k] && !propAsIni.some(p => p.id === k)) return; hitosPorIniciativa[k].forEach(h => hitosFlat.push({ iniciativa: nombrePorId[k] || nombreV[k], nombre: h.nombre, fecha: h.fecha, completado: h.completado, mostrar_detalle: h.mostrar_detalle })); });
    // decisiones y compromisos
    const perteneceDeck = x => PRES_MIO && !single ? !!(x.iniciativa_id && nombrePorId[x.iniciativa_id]) : !single ? (!x.iniciativa_id ? ppt_decisionAplicaAArea_(x.area, areaObjetivo) : (nombrePorId[x.iniciativa_id] ? true : (nombreV[x.iniciativa_id] && ppt_decisionAplicaAArea_(areaV[x.iniciativa_id], areaObjetivo)))) : (x.iniciativa_id === id);
    const decs = { sinResolver: [], cerradas: [] };
    DECS().filter(d => inc(d)).forEach(d => {
      const it = { fila: d.id, decision: d.titulo + (d.recomendacion ? ' — ' + d.recomendacion : ''), fecha: D(d.limite), fecha_limite: D(d.limite), area: d.area || '', iniciativa_id: d.ini || '' };
      if (d.estado === 'Pendiente') { it.vencida = !!(it.fecha_limite && it.fecha_limite < new Date()); decs.sinResolver.push(it); }
      else if (d.fResol && (!corte || D(d.fResol) > corte)) { it.comentario_cierre = d.resolucion || d.estado; it.fecha_cierre = D(d.fResol); decs.cerradas.push(it); }
    });
    const seg = { resueltas: [], abiertas: [] };
    St.comites.forEach(cm => [...(cm.compromisos || []), ...(cm.acciones || [])].forEach(a => {
      const abierto = ['Abierta', 'Abierto'].includes(a.estado), area = a.ini && areaV[a.ini] || '';
      if (abierto) seg.abiertas.push({ fila: a.id, pregunta: a.texto, responsable: a.resp || '', fecha_limite: D(a.limite), iniciativa_id: a.ini || '', area, decision_origen_fila: '' });
      else { const f = D(a.cierre) || D(cm.fecha); if (!corte || f > corte) seg.resueltas.push({ fila: a.id, pregunta: a.texto, resolucion: a.cierre ? 'Cumplido el ' + fmtD(a.cierre) : 'Cumplido', responsable: a.resp || '', fecha: f, iniciativa_id: a.ini || '', area, decision_origen_fila: '' }); }
    }));
    ['resueltas', 'abiertas'].forEach(k => { seg[k] = seg[k].filter(perteneceDeck); seg[k].forEach(p => { p.iniciativa_nombre = p.iniciativa_id ? nombreV[p.iniciativa_id] : ''; }); });
    const decArea = { sinResolver: decs.sinResolver.filter(x => single ? x.iniciativa_id === id : PRES_MIO ? !!(x.iniciativa_id && nombrePorId[x.iniciativa_id]) : (ppt_decisionAplicaAArea_(x.area, areaObjetivo))), cerradas: decs.cerradas.filter(x => single ? x.iniciativa_id === id : PRES_MIO ? !!(x.iniciativa_id && nombrePorId[x.iniciativa_id]) : ppt_decisionAplicaAArea_(x.area, areaObjetivo)) };
    ['sinResolver', 'cerradas'].forEach(k => decArea[k].forEach(d => { d.iniciativa_nombre = d.iniciativa_id ? nombreV[d.iniciativa_id] : ''; }));
    let mensaje = FALLBACK_MENSAJE_PRINCIPAL, generado = mensaje;
    try { if (!single) { generado = withArea(c, () => execSummary('con')[0].p[0]) || mensaje; } } catch (e) { }
    const ed = (c.exec || {})._; mensaje = ed && ed.lead ? ed.lead : generado;
    const todos = [...prj, ...prop];
    return {
      single, id, it0, areaObjetivo, fechaCiclo, corte, corte2, corteStr: f10(corte), corte2Str: f10(corte2), cicloStr: f10(fechaCiclo), datos, baseline, baseline2, hitosPorIniciativa, hitosFlat, decArea, seg, comentarios: {},
      propRows, propAsIni, panorama: { clasificacion: clasif(St.ini.filter(i => !esProp(i) && !esSB(i))) }, datosStatus: { iniciativas: rows.concat(propAsIni) },
      mensaje, mensajeGen: generado, prjAll, propAll, prj, prop, etiquetaArea: single ? (areasDeIniciativa_(it0 && it0.area)[0] || 'Portafolio') : (areaObjetivo || 'Portafolio completo'), todos
    };
  }

  /* =====================================================================
     CATÁLOGO: cada clave llama a las funciones ORIGINALES, en el orden original
     ===================================================================== */
  const slideRef = () => ppt_nuevaSlide_();
  const GEN_ = {
    portada: x => construirSlidePortada_(slideRef(), x.etiquetaArea, x.cicloStr),
    ejecutivo: x => construirSlideEjecutivo_(slideRef(), x.datos, x.baseline, x.mensaje, x.corteStr, x.fechaCiclo, x.areaObjetivo),
    bitacora: x => construirSlidesBitacora_(x.decArea, x.seg, x.comentarios, x.corteStr),
    logros: x => construirSlidesLogros_(x.datos, x.baseline, x.corte, x.hitosFlat, x.corteStr, x.areaObjetivo),
    flujo_prj: x => construirSlideFlujoProyectos_(x.datos, x.corteStr, x.areaObjetivo),
    status_prj: x => construirSlidesDetalle_(x.datos, x.baseline, x.corteStr, x.panorama, null, x.hitosPorIniciativa, 'Status proyectos'),
    flujo_prop: x => construirSlideFlujoPropuestas_(x.areaObjetivo, x.corteStr),
    status_prop: x => construirSlidesDetalle_({ iniciativas: x.propAsIni }, x.baseline, x.corteStr, x.panorama, null, x.hitosPorIniciativa, 'Status propuestas'),
    hitos: x => construirSlidesProximosHitos_(x.hitosFlat, x.corteStr),
    alertas: x => construirSlidesAlertasEstancamiento_(x.datos, x.baseline, x.baseline2, x.corteStr, x.corte2Str),
    estructura: x => construirSlideEstructuraPortafolio_(slideRef(), x.datosStatus),
    plan: x => construirSlidePlanAccion_(slideRef(), x.datosStatus, x.decArea, x.seg, x.corteStr, x.hitosFlat),
    anexo: x => construirSlideAnexo_(slideRef())
  };
  const fichaPrj = (x, it) => construirSlideFicha_(slideRef(), GD.Iniciativas.find(r => r.id === it.id), x.baseline[it.id], x.corteStr, '', x.hitosPorIniciativa[it.id] || [], x.panorama.clasificacion, x.corte);
  const fichaProp = (x, it) => construirSlideFichaPropuesta_(slideRef(), GD.Propuestas.find(r => r.id === it.id), GD.SolucionesProveedor.filter(s => s.propuesta_id === it.id));

  function correr(fn) {
    COLECTOR = []; ALT4_PAGINA_ACTUAL = 0; ALT4_PALETA_ACTIVA.accent = TEMA.cur.colores.acento || '#B5450D'; ALT4_PALETA_ACTIVA.accentDeep = TEMA.cur.colores.acentoOsc || '#8A4321';
    fn();
    return COLECTOR.map(s => {
      const rail = s.els.findIndex(e => e.x === 14 && e.y === 20 && e.size === 20 && /^\d\d$/.test(e.text));
      return { bg: s.bg, els: s.els, pageInc: s.pageInc || 0, rail };
    });
  }
  const wrap = (arr, t, extra) => arr.map((g, n) => Object.assign({ t, sub: '', notes: '', g }, extra || {}));

  /* Genera las láminas de UNA clave del catálogo → [slide] */
  function hacer(key, x) {
    if (key === 'fichas_prj') return x.prj.flatMap(it => wrap(correr(() => fichaPrj(x, it)), 'Ficha · ' + it.titulo, { ref: it.id }));
    if (key === 'fichas_prop') return x.prop.filter(p => ['Vigente', 'En espera'].includes(p.estado)).flatMap(it => wrap(correr(() => fichaProp(x, it)), 'Ficha · ' + it.titulo, { ref: it.id }));
    if (key === 'ficha') return x.prj.concat(x.prop).filter(i => i.id === x.id).flatMap(it => wrap(correr(() => esProp(it) ? fichaProp(x, it) : fichaPrj(x, it)), 'Ficha · ' + it.titulo, { ref: it.id }));
    if (!GEN_[key]) return [];
    return wrap(correr(() => GEN_[key](x)), '');
  }
  function libre(f, x) {   // diapositiva libre con el diseño del original
    return wrap(correr(() => {
      const s = slideRef(); ppt_alt4Fondo_(s, 'Presentación', x.areaObjetivo || '');
      const y0 = ppt_alt4Header_(s, ppt_acotarParaAncho_(f.t || 'Diapositiva libre', 440, 19, true), f.sub ? f.sub.toUpperCase() : '', ALT4_PALETA_ACTIVA.accent);
      const X0 = ESTILO_ALT4.RAIL_ANCHO + 20, W = ESTILO_PPT.ANCHO - X0 - 34; let y = y0 + 8;
      String(f.text || '').split('\n').filter(l => l.trim()).forEach(l => {
        const b = /^[-•*]\s/.test(l), tx = b ? l.replace(/^[-•*]\s/, '') : l, tam = b ? 11 : 13, n = ppt_lineasNecesarias_(tx, W - (b ? 16 : 0), tam, !b), h = ppt_altoTexto_(tam, n);
        if (y + h > ESTILO_PPT.ALTO - 20) return;
        if (b) ppt_texto_(s, '•', X0, y, 14, ppt_altoTexto_(tam, 1), { tam, negrita: true, color: ALT4_PALETA_ACTIVA.accent });
        ppt_texto_(s, tx, X0 + (b ? 16 : 0), y, W - (b ? 16 : 0), h, { tam, negrita: !b, color: ESTILO_ALT4.TEXTO }); y += h + 4;
      });
    }), f.t || 'Diapositiva libre', { notes: f.notes || '', free: f.id });
  }
  function seccion(titulo, sub) {
    return wrap(correr(() => { const s = slideRef(); ppt_fondo_(s, ESTILO_ALT4.FONDO_OSCURO); ppt_texto_(s, sub.toUpperCase(), 96, 130, 500, ppt_altoTexto_(8, 1), { tam: 8, negrita: true, color: ppt_tintar_(ALT4_PALETA_ACTIVA.accent, 0.65, '#1C1B19') }); ppt_texto_(s, titulo, 94, 146, 560, 100, { tam: 30, negrita: true, color: ESTILO_ALT4.FONDO, altoFijo: true }); }), titulo, { section: true });
  }
  /* Numeración del rail (01, 02, …): depende de las láminas que realmente quedan en el deck */
  function numerar(deck) {
    let acc = 0;
    deck.forEach(s => { if (!s.g || s.g.frozen) return; acc += s.g.pageInc || 0; if (s.g.rail >= 0) { s.g.els = s.g.els.map(e => e); s.g.els[s.g.rail] = Object.assign({}, s.g.els[s.g.rail], { text: String(acc).padStart(2, '0') }); } });
    return deck;
  }
  /* Notas del orador (igual que agregarNotasOrador_) */
  const notasEjecutivo = x => x.datos.iniciativas.map((it, k) => (k + 1) + '. ' + it.nombre + '\nS: ' + (it.resumen_ejecutivo || '')).join('\n\n');

  return { contexto, hacer, libre, seccion, numerar, notasEjecutivo, cuentas: x => ({ prj: [x.prj.length, x.prjAll.length], prop: [x.prop.length, x.propAll.length] }) };
})();

