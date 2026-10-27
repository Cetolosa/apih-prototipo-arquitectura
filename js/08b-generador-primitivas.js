import { ENLACES } from './00-registro.js';
import { PPT_MOTOR, SlidesApp } from './08a-generador-motor.js';
/* ===== CÓDIGO ORIGINAL (Codigo_Presentaciones.gs) — portado sin cambios de diseño ===== */
export function ppt_decisionAplicaAArea_(area, areaObjetivo) {
  if (!areaObjetivo || !area) return true;
  return (0, ENLACES.iniciativaPerteneceAArea_)(area, areaObjetivo);
}

export const ESTILO_PPT = {
  ANCHO: 720, ALTO: 405, FRANJA: 8,
  NEGRO: '#16161A', CARBON: '#242429', ROJO: '#C00000', BLANCO: '#FFFFFF',
  GRIS: '#666A72', GRIS_SUAVE: '#8A8D94', GRIS_CLARO: '#BBBBBB', PANEL: '#EBEBEE',
  VERDE_CLARO: '#7BC47F', AMBAR_CLARO: '#E8B84B', ROJO_CLARO: '#FF7B7B'
};

/** Acota un texto libre a un presupuesto de caracteres calzado a su caja, con elipsis. */
export function ppt_acotar_(texto, max) {
  const s = String(texto === null || texto === undefined ? '' : texto).trim();
  if (s.length <= max) return s;
  return s.substring(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** Margen interno que Google Slides aplica dentro de CADA textbox y shape con texto
 *  (~7.2pt por lado en horizontal). No se puede desactivar desde Apps Script, así que todo
 *  cálculo de "cuánto texto cabe" debe descontarlo. Ignorarlo fue la causa raíz de los
 *  desbordes: el texto se envolvía a 2 líneas y, como Slides no recorta, pisaba lo de abajo. */
export const PPT_INSET_H = 14.4;

/** Margen interno VERTICAL de los textbox de Slides (~3.6pt arriba + 3.6pt abajo) más el
 *  interlineado. Ignorarlo era la causa de que etiquetas ajustadas al milímetro se derramaran
 *  sobre lo que tuvieran debajo (la barra de categorías, el borde de una tarjeta). */
const PPT_INSET_V = 7.2;

/** Factor de interlineado: una línea de N puntos ocupa N*1.25 de alto real. */
const PPT_INTERLINEA = 1.25;

/** Alto MÍNIMO que debe declarar una caja para que N líneas de un tamaño dado quepan sin
 *  derramarse. Usar siempre esto en vez de estimar el alto "a ojo". */
export function ppt_altoTexto_(tamFuente, lineas) {
  return Math.ceil(PPT_INSET_V + (lineas || 1) * tamFuente * PPT_INTERLINEA);
}

/** Cuántas líneas de un tamaño dado caben en una caja de alto conocido. */
export function ppt_lineasEnAlto_(altoPt, tamFuente) {
  return Math.max(1, Math.floor((altoPt - PPT_INSET_V) / (tamFuente * PPT_INTERLINEA)));
}

/** Alto de una caja que AJUSTA a los glifos de una sola línea (margen superior + alto real de
 *  ascendentes y descendentes), sin el espacio muerto de interlineado que deja ppt_altoTexto_.
 *  Se usa para títulos y etiquetas donde algo se dibuja justo debajo y necesitamos que la
 *  distancia visual sea la real: con ppt_altoTexto_ la caja sobra ~7pt por abajo y cualquier
 *  cosa que se apoye en su borde queda demasiado separada, o —si se compensa a ojo— demasiado
 *  pegada, que es lo que le pasaba a la línea roja bajo el título. */
export function ppt_altoGlifos_(tamFuente) {
  return Math.ceil(PPT_INSET_V / 2 + tamFuente * 1.15);
}

/** Ancho por carácter, como fracción del tamaño de fuente. Conservador para acentos y
 *  mayúsculas del español. */
export function ppt_factorAncho_(negrita) { return negrita ? 0.62 : 0.52; }

/** Acota un texto para que SIEMPRE quepa en una sola línea dentro de una caja de un ancho (en
 *  puntos) y tamaño de fuente dados. anchoPt es el ancho DECLARADO de la caja; el margen
 *  interno de Slides se descuenta aquí adentro. */
export function ppt_acotarParaAncho_(texto, anchoPt, tamFuente, negrita) {
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
export function ppt_acotarParaCaja_(texto, anchoPt, tamFuente, negrita, lineas) {
  const util = Math.max(8, anchoPt - PPT_INSET_H);
  const maxChars = Math.max(4, Math.floor(util / (tamFuente * ppt_factorAncho_(negrita)))) * Math.max(1, lineas);
  return ppt_acotar_(texto, maxChars);
}

/** Mide cuántas líneas necesita REALMENTE un texto en un ancho dado (no una suposición fija de
 *  N líneas) — así el texto se acota solo si de verdad no entra, y si entra completo se muestra
 *  completo, sin dejar espacio en blanco sin usar ni cortar cuando sobra lugar. */
export function ppt_lineasNecesarias_(texto, wc, tamFuente, negrita) {
  const charsPorLinea = Math.max(1, Math.floor((wc - PPT_INSET_H) / (tamFuente * ppt_factorAncho_(negrita))));
  return Math.max(1, Math.ceil(String(texto || '').length / charsPorLinea));
}

/** Ancho de caja necesario para que un texto quepa en UNA línea, incluyendo el margen interno
 *  de Slides. Se usa para dimensionar badges/chips a partir de su contenido, en vez de fijar
 *  un ancho y esperar que el texto quepa (que es como se apilaban las letras del badge "AC"). */
export function ppt_anchoParaTexto_(texto, tamFuente, negrita, minimo, maximo) {
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
export function ppt_texto_(slide, texto, x, y, w, h, opciones) {
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

export function ppt_fondo_(slide, color) {
  if (PPT_MOTOR.modo !== 'lote') { slide.getBackground().setSolidFill(color); return; }
  ppt_req_({ updatePageProperties: {
    objectId: ppt_pageId_(slide),
    fields: 'pageBackgroundFill.solidFill.color',
    pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: ppt_rgb_(color) } } } }
  } });
}

export function ppt_forma_(slide, tipo, x, y, w, h) {
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

export function ppt_textoRotado90_(slide, texto, x, y, w, h, opciones) {
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

export function ppt_rect_(slide, x, y, w, h, color, redondeado) {
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
export function ppt_fondoClaro_(slide) {
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
export const Y_CONTENIDO_INICIAL = PPT_Y_SUBTITULO + ppt_altoGlifos_(PPT_TAM_SUBTITULO) + 6;

export function ppt_encabezado_(slide, titulo, subtitulo) {
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
export function ppt_paginar_(items, porPagina) {
  const paginas = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return paginas.length > 0 ? paginas : [[]];
}

