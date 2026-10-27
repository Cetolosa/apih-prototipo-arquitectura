import { ENLACES } from './00-registro.js';
  /* ---------- reloj fijo (respeta "Fecha de hoy" de Administración) ---------- */
  const NativeDate = globalThis.Date; let HOY_MS = null;
  export class Date extends NativeDate {
    constructor(...a) { if (a.length === 0 && HOY_MS !== null) super(HOY_MS); else super(...a); }
    static now() { return HOY_MS !== null ? HOY_MS : NativeDate.now(); }
  }
  const Logger = { log() { } };
  export const SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) };
  export const Session = { getScriptTimeZone: () => 'America/Santiago' };
  export const Utilities = {
    sleep() { },
    formatDate(d, tz, f) {
      const p = (n, l = 2) => String(n).padStart(l, '0');
      return String(f).replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => ({ yyyy: d.getFullYear(), yy: p(d.getFullYear() % 100), MM: p(d.getMonth() + 1), dd: p(d.getDate()), HH: p(d.getHours()), mm: p(d.getMinutes()), ss: p(d.getSeconds()) }[t]));
    }
  };
  /* ---------- SlidesApp local: cada operación queda registrada como elemento ---------- */
  export const SlidesApp = {
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
  export let COLECTOR = [];
  function nuevaSlideObj() {
    const s = {
      els: [], bg: '#FFFFFF',
      insertShape(t, x, y, w, h) { return mkShape(s, t, x, y, w, h); },
      insertTextBox(tx, x, y, w, h) { return mkShape(s, 'TEXT', x, y, w, h, tx); },
      getBackground() { return { setSolidFill(c) { s.bg = c; } }; }
    };
    COLECTOR.push(s); return s;
  }
  export var PPT_MOTOR = { modo: 'directo', ops: 0, pres: { appendSlide: nuevaSlideObj } };
  export function ppt_nuevaSlide_() { return PPT_MOTOR.pres.appendSlide(); }

  /* ---------- datos (las "hojas" del sistema original, armadas desde APIH) ---------- */
  export let GD = {};
  export function leerHojaComoObjetos_(nombre) { return (GD[nombre] || []).map(r => Object.assign({}, r)); }


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  COLECTOR: { get: () => COLECTOR, set: v => { COLECTOR = v; }, enumerable: true, configurable: true },
  GD: { get: () => GD, set: v => { GD = v; }, enumerable: true, configurable: true },
  HOY_MS: { get: () => HOY_MS, set: v => { HOY_MS = v; }, enumerable: true, configurable: true },
});
