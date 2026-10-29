/* 03b-interfaz-excel-formularios — continuación de 03-interfaz.js (se partió por tamaño; sin cambios de comportamiento). */
import { ENLACES } from './00-registro.js';
import { $, BIT_C, DEC_TIPOS, FASES, PRIOS, RAGS, RISK_CATS, RISK_ESTADOS, St, addD, by, byId, clone, esProp, esSB, esc, expo, fmtD, hitoCats, hitoEstado, hitosDe, hoy, icon, pad, riesgosDe, uniq } from './01-nucleo.js';
import { ESQUEMA } from './02-datos.js';
import { Acts, Chg, F, Modal, UI, banner, btn, closePops, confirmBox, download, fitMain, go, openForm, pageHead, panelDec, panelHito, panelIni, panelRisk, ragPill, refresh, render, renderChrome, selOpts, shell, toast, updateSyncUI, asignar_banner, asignar_fitMain, asignar_go, asignar_openForm, asignar_panelDec, asignar_panelHito, asignar_panelIni, asignar_panelRisk, asignar_refresh, asignar_render, asignar_renderChrome, asignar_toast } from './03-interfaz.js';


/* ---------- escritor .xlsx nativo (ZIP sin compresión, sin librerías) ---------- */
const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
export function zipStore(files, mime) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  const u16 = n => [n & 255, n >>> 8 & 255], u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
  files.forEach(f => {
    const nm = enc.encode(f.name), d = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(d);
    const lh = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0]);
    parts.push(lh, nm, d);
    cen.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 33, 0, ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off)]), nm);
    off += lh.length + nm.length + d.length;
  });
  const cl = cen.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), 0, 0]);
  return new Blob([...parts, ...cen, end], { type: mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
export function xlsxBlob(sheets) {   // sheets: [{name, rows:[[...]]}] (fila 0 = encabezados)
  const X = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const names = sheets.map((s, i) => X(s.name.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31) || 'Hoja' + (i + 1)));
  const sheetXml = s => {
    const nc = Math.max(...s.rows.map(r => r.length));
    const w = Array.from({ length: nc }, (_, c) => Math.min(60, Math.max(8, ...s.rows.slice(0, 60).map(r => String(r[c] == null ? '' : r[c]).length + 2))));
    const rows = s.rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, c) => {
      const ref = col(c) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
      if (v == null || v === '') return '';
      if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      if (typeof v === 'boolean') return `<c r="${ref}"${st} t="b"><v>${v ? 1 : 0}</v></c>`;
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${X(v)}</t></is></c>`;
    }).join('') + '</row>').join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x, i) => `<col min="${i + 1}" max="${i + 1}" width="${x}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A1:${col(nc - 1)}${s.rows.length}"/></worksheet>`;
  };
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Segoe UI"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Segoe UI"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F6CBD"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
  ];
  return zipStore(files);
}
export function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
/* Hoja con las columnas de la entidad (sin DatosJSON) */
function listSheet(ent) {
  const S = ESQUEMA[ent], arr = (St[S.coll] || []).filter(S.filter || (() => true));
  return { name: S.label, rows: [S.cols.map(c => c.n), ...arr.map(o => S.cols.map(c => { let v = c.get ? c.get(o) : o[c.k]; if (c.t === 'Date' && v) v = String(v).slice(0, 10); if (c.t === 'DateTime' && v) v = String(o.ts || v).replace('T', ' ').slice(0, 16); return v == null ? '' : v; }))] };
}
Acts.xlsxall = () => { downloadBlob('APIH_listas_' + hoy() + '.xlsx', xlsxBlob(Object.keys(ESQUEMA).map(listSheet))); toast('Excel exportado (una hoja por entidad)'); };
/* ============================================================
   APIH · Carga de planificación e hitos desde Excel
   Plantilla descargable + lector .xlsx propio (sin librerías) + vista previa con validación
   ============================================================ */
export const CX = { res: null, name: '' };
const _nz = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function zipRead(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf); let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('El archivo no es un .xlsx válido');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let k = 0; k < n; k++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + el + cl;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + csz);
    out[name] = async () => meth === 0 ? raw : new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  }
  return out;
}
async function readXlsx(buf) {
  const Z = await zipRead(buf), txt = async n => Z[n] ? new TextDecoder().decode(await Z[n]()) : '', dom = s => new DOMParser().parseFromString(s, 'application/xml');
  const wb = dom(await txt('xl/workbook.xml')), rels = dom(await txt('xl/_rels/workbook.xml.rels'));
  const rel = {}; [...rels.getElementsByTagName('Relationship')].forEach(r => rel[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ss = []; const sx = await txt('xl/sharedStrings.xml'); if (sx) [...dom(sx).getElementsByTagName('si')].forEach(si => ss.push([...si.getElementsByTagName('t')].map(t => t.textContent).join('')));
  const colN = r => { let n = 0; for (const ch of r.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const sheets = [];
  for (const s of [...wb.getElementsByTagName('sheet')]) {
    let t = rel[s.getAttribute('r:id')] || rel[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')] || ''; t = t.replace(/^\//, ''); if (!t.startsWith('xl/')) t = 'xl/' + t;
    const xd = dom(await txt(t)), rows = [];
    [...xd.getElementsByTagName('row')].forEach(r => {
      const ri = +r.getAttribute('r') - 1, arr = [];
      [...r.getElementsByTagName('c')].forEach(c => {
        const ci = colN(c.getAttribute('r')), ty = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
        let val = null;
        if (ty === 'inlineStr') val = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
        else if (v) { val = v.textContent; if (ty === 's') val = ss[+val] || ''; else if (ty === 'b') val = val === '1'; else if (ty !== 'str' && ty !== 'e' && val !== '' && !isNaN(+val)) val = +val; }
        arr[ci] = val;
      });
      rows[ri] = arr;
    });
    sheets.push({ name: s.getAttribute('name'), rows: Array.from(rows, r => r || []) });
  }
  return sheets;
}
const CX_PLAN = ['ID Iniciativa', 'Nombre (referencia)', 'Inicio plan', 'Fin plan', 'Inicio real', 'Fin real', 'Avance %', 'Presupuesto', 'Gastado'];
const CX_HITO = ['ID Iniciativa', 'Hito', 'Fase', 'Fecha plan', 'Fecha real', 'Responsable', 'Completado (Sí/No)'];
function cxEditables() { return St.ini.filter(i => (0, ENLACES.puedeEditarIni)(i) && !(0, ENLACES.soloLectura)()).slice().sort(by('id')); }
function cxTemplate(conDatos) {
  const L = cxEditables(), ex = !conDatos || !L.length;
  const plan = [CX_PLAN, ...(ex ? [['PRJ-001', 'Ejemplo: nombre del proyecto', '2026-03-01', '2026-09-30', '2026-03-05', '', 35, 120, 40]] : L.map(i => [i.id, i.titulo, i.inicioPlan || '', i.finPlan || '', i.inicioReal || '', i.finReal || '', Math.round(i.avance || 0), i.presupuesto || '', i.gastado || '']))];
  const H = St.hitos.filter(h => L.some(i => i.id === h.ini)).slice().sort(by(h => h.ini + h.fecha));
  const hit = [CX_HITO, ...(ex ? [['PRJ-001', 'Ejemplo: Pruebas de aceptación', 'Ejecución', '2026-06-15', '', 'Nombre Apellido', 'No']] : H.map(h => [h.ini, h.nombre, h.fase || '', h.fecha || '', h.fechaReal || '', h.resp || '', h.completado ? 'Sí' : 'No']))];
  const ins = [['Instrucciones'],
    ['1. Complete las hojas «Planificación» y «Hitos». No cambie los títulos de las columnas ni el nombre de las hojas.'],
    ['2. «ID Iniciativa» es obligatorio y debe existir en APIH (ej. PRJ-001). Solo se cargan iniciativas que tú puedes editar.'],
    ['3. Fechas en formato AAAA-MM-DD (también se acepta DD-MM-AAAA o fecha de Excel). Avance de 0 a 100. Presupuesto y Gastado en la unidad configurada.'],
    ['4. Celda vacía = no se modifica ese dato. Las filas de una hoja no listadas no se tocan (no se borra nada).'],
    ['5. Hitos: se identifican por ID Iniciativa + nombre del hito. Si existe, se actualiza; si no, se crea (requiere Fecha plan).'],
    ['6. «Completado»: Sí/No. Si indica Fecha real sin marcar Completado, el hito queda completado.'],
    ['7. Fase (opcional): ' + FASES.join(' · ')],
    ['8. Sube el archivo en «Cargar Excel»: verás una vista previa con errores antes de aplicar cambios.'],
    ['9. Esta carga actualiza planificación e hitos de proyectos que YA existen en APIH; no crea proyectos nuevos. Las filas que dicen «Ejemplo:» se ignoran.']];
  return xlsxBlob([{ name: 'Instrucciones', rows: ins }, { name: 'Planificación', rows: plan }, { name: 'Hitos', rows: hit }]);
}
const cxDate = v => {
  if (v == null || v === '') return { v: '' };
  if (typeof v === 'number') { if (v > 20000 && v < 90000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5); return { v: d.toISOString().slice(0, 10) }; } return { e: 1 }; }
  const s = String(v).trim(); let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), y, mo, d;
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]]; else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) [d, mo, y] = [+m[1], +m[2], +m[3] < 100 ? 2000 + +m[3] : +m[3]]; else return { e: 1 };
  const dt = new Date(y, mo - 1, d); if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { e: 1 };
  return { v: y + '-' + pad(mo) + '-' + pad(d) };
};
const cxBool = v => ['si', 's', '1', 'true', 'x', 'yes', 'completado'].includes(_nz(v));
function cxSheet(sheets, names) { return sheets.find(s => names.includes(_nz(s.name))); }
function cxTable(sh, cols) {   // mapea encabezados (tolerante a tildes/mayúsculas) → [{n, r:{col→valor}}]
  if (!sh || !sh.rows.length) return null;
  let hi = sh.rows.findIndex(r => r.some(c => _nz(c) === 'id iniciativa')); if (hi < 0) return null;
  const idx = {}; cols.forEach(c => { const j = sh.rows[hi].findIndex(h => _nz(h) === _nz(c) || _nz(c).startsWith(_nz(h) + ' ') || _nz(h).startsWith(_nz(c) + ' ')); if (j >= 0) idx[c] = j; });
  return sh.rows.slice(hi + 1).map((r, k) => ({ n: hi + k + 2, g: c => idx[c] == null ? undefined : r[idx[c]] })).filter(x => cols.some(c => { const v = x.g(c); return v != null && v !== ''; }));
}
function cxParse(sheets) {
  const R = { plan: [], hitos: [], errs: [], warns: [], vacio: false }, ok = i => i && (0, ENLACES.puedeEditarIni)(i);
  const sp = cxSheet(sheets, ['planificacion', 'plan']), sh = cxSheet(sheets, ['hitos', 'hito']);
  const tp = cxTable(sp, CX_PLAN), th = cxTable(sh, CX_HITO);
  if (!tp && !th) { R.errs.push('No se encontraron las hojas «Planificación» u «Hitos» con la columna «ID Iniciativa». Use la plantilla.'); return R; }
  const E = (h, n, m) => R.errs.push(`${h} · fila ${n}: ${m}`), Wn = (h, n, m) => R.warns.push(`${h} · fila ${n}: ${m}`);   // E = error (se omite la fila) · Wn = aviso (se aplica, pero conviene revisar)
  (tp || []).forEach(x => {
    const id = String(x.g('ID Iniciativa') || '').trim(), i = byId(id);
    if (/^ejemplo:/i.test(String(x.g(CX_PLAN[1]) || '').trim())) return;   // fila de ejemplo de la plantilla
    if (!id) return E('Planificación', x.n, 'falta ID Iniciativa'); if (!i) return E('Planificación', x.n, `la iniciativa ${id} no existe`); if (!ok(i)) return E('Planificación', x.n, `sin permiso para editar ${id}`);
    const ch = {}, bad = [];
    [['Inicio plan', 'inicioPlan'], ['Fin plan', 'finPlan'], ['Inicio real', 'inicioReal'], ['Fin real', 'finReal']].forEach(([c, k]) => { const d = cxDate(x.g(c)); if (d.e) bad.push(c + ' inválida'); else if (d.v && d.v !== i[k]) ch[k] = d.v; });
    [['Avance %', 'avance', 0, 100], ['Presupuesto', 'presupuesto', 0, 1e12], ['Gastado', 'gastado', 0, 1e12]].forEach(([c, k, lo, hi]) => { let v = x.g(c); if (v == null || v === '') return; if (typeof v === 'string') v = parseFloat(v.replace('%', '').replace(/\./g, '').replace(',', '.')); if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) bad.push(c + ' inválido'); else if (v !== i[k]) ch[k] = v; });
    const ip = ch.inicioPlan || i.inicioPlan, fp = ch.finPlan || i.finPlan; if (ip && fp && fp < ip) bad.push('Fin plan anterior a Inicio plan');
    if (bad.length) return E('Planificación', x.n, `${id}: ${bad.join(', ')}`);
    if (Object.keys(ch).length) R.plan.push({ i, ch });
  });
  const seen = new Set();
  (th || []).forEach(x => {
    const id = String(x.g('ID Iniciativa') || '').trim(), i = byId(id), nm = String(x.g('Hito') || '').trim();
    if (/^ejemplo:/i.test(nm)) return;   // fila de ejemplo de la plantilla
    if (!id) return E('Hitos', x.n, 'falta ID Iniciativa'); if (!i) return E('Hitos', x.n, `la iniciativa ${id} no existe`); if (!ok(i)) return E('Hitos', x.n, `sin permiso para editar ${id}`); if (!nm) return E('Hitos', x.n, 'falta el nombre del hito');
    const key = id + '|' + _nz(nm); if (seen.has(key)) return E('Hitos', x.n, `hito repetido en el archivo: ${nm}`); seen.add(key);
    const cur = St.hitos.find(h => h.ini === id && _nz(h.nombre) === _nz(nm)), v = {}, bad = [];
    const f = cxDate(x.g('Fecha plan')), fr = cxDate(x.g('Fecha real')); if (f.e) bad.push('Fecha plan inválida'); else if (f.v) v.fecha = f.v; if (fr.e) bad.push('Fecha real inválida'); else if (fr.v) v.fechaReal = fr.v;
    const fs = x.g('Fase'); if (fs != null && fs !== '') { const m = FASES.find(z => _nz(z) === _nz(fs)); if (m) v.fase = m; else bad.push('Fase desconocida'); }
    const rs = x.g('Responsable'); if (rs != null && rs !== '') v.resp = String(rs).trim();
    const cp = x.g('Completado (Sí/No)'); if (cp != null && cp !== '') v.completado = cxBool(cp); else if (v.fechaReal) v.completado = true;
    if (v.completado === false) v.fechaReal = null; else if (v.completado && !v.fechaReal && !(cur && cur.fechaReal)) v.fechaReal = hoy();
    if (!cur && !v.fecha) bad.push('hito nuevo sin Fecha plan'); if (bad.length) return E('Hitos', x.n, `${id} · ${nm}: ${bad.join(', ')}`);
    { const ip = i.inicioPlan, fp = i.finPlan; if (v.fecha && ((ip && v.fecha < ip) || (fp && v.fecha > fp))) Wn('Hitos', x.n, `${id} · ${nm}: la Fecha plan ${fmtD(v.fecha)} queda fuera del plan del proyecto (${fmtD(ip)} – ${fmtD(fp)})`);
      if (v.fechaReal && v.fechaReal > hoy()) Wn('Hitos', x.n, `${id} · ${nm}: la Fecha real ${fmtD(v.fechaReal)} está en el futuro`); }
    if (cur) { const ch = {}; Object.keys(v).forEach(k => { if (v[k] !== cur[k] && !(v[k] == null && !cur[k])) ch[k] = v[k]; }); if (Object.keys(ch).length) R.hitos.push({ cur, ch, id, nm }); }
    else R.hitos.push({ nuevo: { ini: id, nombre: nm, fase: v.fase || '', fecha: v.fecha, completado: !!v.completado, fechaReal: v.fechaReal || null, resp: v.resp || i.lider || '' }, id, nm });
  });
  R.vacio = !R.plan.length && !R.hitos.length;
  return R;
}
const cxLoc = m => { const k = /^(.+?) · fila (\d+): ([\s\S]*)$/.exec(m); return k ? [k[1], 'Fila ' + k[2], k[3]] : ['', '', m]; };
function cxPreview() {
  const R = CX.res; if (!R) return '';
  const nN = R.hitos.filter(h => h.nuevo).length, nU = R.hitos.length - nN;
  const lbl = { inicioPlan: 'Inicio plan', finPlan: 'Fin plan', inicioReal: 'Inicio real', finReal: 'Fin real', avance: 'Avance', presupuesto: 'Presupuesto', gastado: 'Gastado', fecha: 'Fecha plan', fechaReal: 'Fecha real', fase: 'Fase', resp: 'Responsable', completado: 'Completado' };
  const fv = (k, v) => v === true ? 'Sí' : v === false ? 'No' : v == null || v === '' ? '—' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtD(v) : v;
  const det = (cur, ch) => Object.keys(ch).map(k => `${lbl[k] || k}: ${esc(fv(k, cur[k]))} → <b>${esc(fv(k, ch[k]))}</b>`).join(' · ');
  const rows = [...R.plan.map(p => `<tr><td>Planificación</td><td>${esc(p.i.id)} · ${esc(p.i.titulo)}</td><td>${det(p.i, p.ch)}</td></tr>`), ...R.hitos.map(h => `<tr><td>Hito ${h.nuevo ? 'nuevo' : 'actualizado'}</td><td>${esc(h.id)} · ${esc(h.nm)}</td><td>${h.nuevo ? `Fecha plan <b>${esc(fv('fecha', h.nuevo.fecha))}</b>${h.nuevo.completado ? ' · completado' : ''}` : det(h.cur, h.ch)}</td></tr>`)];
  return `<div class="chips" style="margin:8px 0"><span class="pill">${R.plan.length} iniciativas con cambios de planificación</span><span class="pill">${nN} hitos nuevos</span><span class="pill">${nU} hitos actualizados</span><span class="pill ${R.errs.length ? 'bad' : ''}" style="${R.errs.length ? 'background:var(--redbg);color:var(--red)' : ''}">${R.errs.length} errores</span>${R.warns.length ? `<span class="pill" style="background:#FFF4CE;color:#8A5A00">${R.warns.length} avisos</span>` : ''}</div>`
    + (!rows.length && R.errs.length ? `<p class="mut" style="margin:6px 0 0">No hay filas válidas para aplicar. Corrige los errores del archivo y vuelve a subirlo.</p>` : '')
    + (rows.length || R.errs.length || R.warns.length ? `<div class="tbl-w" style="max-height:300px;overflow:auto"><table class="tbl"><thead><tr><th>Estado</th><th>Tipo</th><th>Elemento</th><th>Cambio / detalle</th></tr></thead><tbody>${[
        ...R.errs.map(m => { const [h, u, d] = cxLoc(m); return `<tr style="background:var(--redbg)"><td><b style="color:var(--red)">✕ Se omite</b></td><td>${esc(h)}</td><td>${esc(u)}</td><td>${esc(d)}</td></tr>`; }),
        ...R.warns.map(m => { const [h, u, d] = cxLoc(m); return `<tr style="background:#FFF4CE"><td><b style="color:#8A5A00">⚠ Revisar</b></td><td>${esc(h)}</td><td>${esc(u)}</td><td>${esc(d)}</td></tr>`; }),
        ...rows.map(r => r.replace('<tr>', '<tr style="background:#E4F3E5"><td><b style="color:#13420f">✓ Válida</b></td>'))
      ].join('')}</tbody></table></div>` : '<p class="mut">El archivo no trae cambios respecto de lo que ya está cargado.</p>');
}
Acts.cargaxl = () => {
  if ((0, ENLACES.soloLectura)()) return toast('Modo solo lectura: no se puede cargar', 'err');
  CX.res = null;
  Modal.open({ title: 'Cargar planificación e hitos desde Excel', wide: true,
    body: `<p class="desc" style="margin:0 0 8px"><b>Actualiza planificación e hitos de proyectos que ya existen (no crea proyectos nuevos).</b> 1) Descarga la plantilla, 2) complétala (o edita la que trae tus datos actuales) y 3) súbela: verás una vista previa antes de aplicar. Solo se cargan iniciativas que usted puede editar; las celdas vacías no modifican nada.</p>
      <div class="chips" style="margin:0 0 10px">${btn('Plantilla en blanco (con ejemplo)', 'cxtpl', { d: { m: 'blank' }, ic: 'down' })}${btn('Plantilla con mis datos actuales', 'cxtpl', { d: { m: 'data' }, ic: 'down' })}<button class="btn pri" data-act="cxpick">${icon('up', 15)}<span>Elegir archivo Excel…</span></button><input type="file" id="cxfile" accept=".xlsx" data-chg="cxfile" hidden></div>
      <div id="cxprev"><p class="mut">Aún no se ha subido ningún archivo.</p></div>`,
    footer: `<button class="btn" data-act="mclose">Cancelar</button><button class="btn pri" id="cxok" data-act="cxapply" disabled>Aplicar cambios</button>` });
};
Acts.cxtpl = d => { downloadBlob(d.m === 'data' ? 'APIH_plantilla_planificacion_datos_' + hoy() + '.xlsx' : 'APIH_plantilla_planificacion.xlsx', cxTemplate(d.m === 'data')); toast('Plantilla descargada'); };
Acts.cxpick = () => { const f = $('#cxfile'); if (f) { f.value = ''; f.click(); } };
Chg.cxfile = async el => {
  const fl = el.files[0]; if (!fl) return; const pv = $('#cxprev'), ok = $('#cxok'); if (ok) ok.disabled = true; pv.innerHTML = '<p class="mut">Leyendo archivo…</p>';
  try { CX.res = cxParse(await readXlsx(await fl.arrayBuffer())); CX.name = fl.name; pv.innerHTML = `<p class="mut" style="margin:0">Archivo: <b>${esc(fl.name)}</b></p>` + cxPreview(); if (ok) ok.disabled = !(CX.res.plan.length || CX.res.hitos.length); }
  catch (e) { CX.res = null; pv.innerHTML = `<div class="note bad">${icon('warn', 14)} <span>No se pudo leer el archivo: ${esc(e.message)}</span></div>`; }
};
Acts.cxapply = () => {
  const R = CX.res; if (!R || (!R.plan.length && !R.hitos.length)) return;
  /* El navegador solo lee el archivo; el servidor aplica cada fila con las reglas y permisos de los formularios (apih_cargar_lote) */
  const go = async () => {
    const items = [];
    R.plan.forEach(p => { const d = Object.assign({}, p.ch); if (d.avance !== undefined && !esProp(p.i)) { d.avanceManual = d.avance; } delete d.avance; items.push({ k: 'ini', id: p.i.id, datos: d }); });
    R.hitos.forEach(h => { if (h.nuevo) { const d = Object.assign({}, h.nuevo); if (!d.fase) { const i = byId(h.id); d.fase = i ? i.fase : ''; } items.push({ k: 'hito', id: null, datos: d }); } else items.push({ k: 'hito', id: h.cur.id, datos: h.ch }); });
    const r = await (0, ENLACES.cmdServidor)('apih_cargar_lote', { p_origen: 'Carga desde Excel (' + CX.name + ')', p_ini: null, p_items: items }, null);
    if (r === null) return;
    Modal.close(); CX.res = null;
    toast(`Carga aplicada: ${r.ok} de ${items.length} filas` + ((r.errores || []).length ? ` · ${(r.errores || []).length} omitidas: ${(r.errores || []).slice(0, 2).join(' | ')}` : ''), (r.errores || []).length ? 'warn' : undefined);
    refresh();
  };
  if (R.errs.length) confirmBox(`El archivo tiene ${R.errs.length} filas con error que se omitirán. ¿Aplicar solo las filas válidas?`, go, 'Aplicar válidas'); else go();
};

Acts.pxlsx = () => {
  const f = F('portfolio', {}), rows = (0, ENLACES.portfolioRows)(), cols = (0, ENLACES.pcols)();
  const strip = v => typeof v === 'string' ? v.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : v;
  downloadBlob('APIH_portfolio_' + hoy() + '.xlsx', xlsxBlob([{ name: 'Portfolio', rows: [cols.map(c => c.h), ...rows.map(r => cols.map(c => strip(c.f(r))))] }])); toast(rows.length + ' filas exportadas a Excel');
};
Acts.pjson = () => {
  const f = F('portfolio', {}), rows = (0, ENLACES.portfolioRows)(), cols = (0, ENLACES.pcols)();
  download('APIH_portfolio_' + hoy() + '.json', JSON.stringify(rows.map(r => Object.fromEntries(cols.map(c => [c.h, c.f(r)]))), null, 1), 'application/json'); toast(rows.length + ' filas exportadas a JSON');
};

/* ============================================================
   APIH · Acciones: formularios y CRUD con bitácora automática
   ============================================================ */
export const people = () => uniq([...St.usuarios.map(u => u.n), ...St.ini.flatMap(i => [i.lider, i.sponsor, i.negocio]).filter(Boolean)]).sort();
export const iniOpts = tipo => St.ini.filter(i => !tipo || i.tipo === tipo).slice().sort(by('id')).map(i => ({ v: i.id, t: i.id + ' · ' + i.titulo }));
export const iniOptsF = tipo => iniOpts(tipo).filter(o => !esSB(byId(o.v)));   /* filtros de pantallas de gestión: sin Stand By (los formularios sí lo conservan para no perder vínculos) */
function hasCycle(id, deps) {   // ¿agregar deps a id crea ciclo?
  const seen = new Set(); const st = [...deps];
  while (st.length) { const x = st.pop(); if (x === id) return true; if (seen.has(x)) continue; seen.add(x); const i = byId(x); if (i) st.push(...i.deps); }
  return false;
}

/* ---------- Propuesta / Proyecto ---------- */
function iniForm(i, isPropArg) {
  const nw = !i, PR = nw ? !!isPropArg : esProp(i), T = PR ? 'Propuesta' : 'Proyecto';
  const v = i ? clone(i) : { tipo: T, fase: PR ? 'Recepción' : 'Planificación', estado: PR ? 'Vigente' : 'En curso', rag: 'Verde', prioridad: 'Media', moneda: 'CLP', area: ['BISE'], categoria: St.cfg.categorias[0], clasif: 'Táctico', gasto: 'OPEX', avance: 0, lider: St.cfg.usuario, solicitante: St.cfg.usuario, presupuesto: 0, gastado: 0, beneficio: 0, deps: [], inicioPlan: hoy(), finPlan: addD(hoy(), 120), origen: 'usuario', est: [], hist: [], score: { estrategia: 3, valor: 3, esfuerzo: 3, riesgo: 2 } };
  const areas = typeof v.area === 'string' ? v.area.split(',').map(x => x.trim()) : v.area;
  v.areaArr = areas; v.score = v.score || { estrategia: 3, valor: 3, esfuerzo: 3, riesgo: 2 };
  v.sE = v.score.estrategia; v.sV = v.score.valor; v.sF = v.score.esfuerzo; v.sR = v.score.riesgo;
  const P = people();
  const fields = [
    { sec: 'Identificación' },
    { k: 'titulo', l: 'Título', req: true, w: 3 }, { k: 'tipoIni', l: 'Tipo de iniciativa', t: 'select', opts: ['', ...((St.cfg.metodo || {}).tipos || []).map(t => t.nombre)], w: 2, hint: 'Precarga los hitos de la metodología (Administración → Metodología)' }, { k: 'desc', l: 'Descripción', t: 'textarea', w: 3 }, { k: 'bc', l: 'Business case / beneficios', t: 'textarea', w: 3 },
    ...(PR ? [{ k: 'problema', l: 'Problema a resolver', t: 'textarea', w: 3 }, { k: 'objetivos', l: 'Objetivos esperados', t: 'textarea', w: 3 }, { k: 'usuarios', l: 'Usuarios impactados', w: 2 }, { k: 'solicitante', l: 'Solicitante', list: P }] : []),
    ...(nw && !PR ? [{ k: 'motivoAlta', l: 'Motivo de creación directa (sin propuesta previa)', t: 'textarea', req: true, w: 3 }] : []),
    { sec: 'Gobierno' },
    { k: 'sponsor', l: 'Sponsor', list: P }, { k: 'lider', l: 'Líder / Responsable', list: P, req: true }, { k: 'negocio', l: 'Responsable de negocio', list: P },
    { k: 'areaArr', l: 'Área(s)', t: 'multi', opts: St.cfg.areas.map(a => ({ v: a, t: a })), w: 2 }, { k: 'categoria', l: 'Categoría', t: 'select', opts: St.cfg.categorias },
    { k: 'clasif', l: 'Clasificación', t: 'select', opts: ['Táctico', 'Estratégico'] }, { k: 'gasto', l: 'Tipo de gasto', t: 'select', opts: ['OPEX', 'CAPEX'] }, { k: 'prioridad', l: 'Prioridad', t: 'select', opts: PRIOS },
    ...(PR ? [] : [{ sec: 'Salud y avance' }, { k: 'rag', l: 'Salud (RAG)', t: 'select', opts: RAGS },
      { k: 'avanceManual', l: 'Ajuste manual del avance (%)', t: 'number', min: 0, max: 100, hint: nw ? 'Vacío: se calcula solo con los hitos y subfases' : 'Vacío = calculado (' + (0, ENLACES.avanceCalc)(i) + '%). La fase y el estado se cambian con «Cambiar etapa» en la pestaña Ciclo de vida.' }]),
    { sec: PR ? 'Finanzas estimadas' : 'Finanzas' }, { k: 'moneda', l: 'Moneda', t: 'select', opts: ['CLP', 'USD', 'UF'], w: 1, hint: 'Los montos se ingresan en: CLP en millones (MM) · USD en miles (K) · UF en unidades' },
    { k: 'presupuesto', l: PR ? 'Costo estimado' : 'Presupuesto', t: 'number', min: 0 }, ...(PR ? [] : [{ k: 'gastado', l: 'Consumido', t: 'number', min: 0 }]), { k: 'beneficio', l: PR ? 'Beneficio estimado' : 'Beneficio esperado', t: 'number', min: 0 }, ...(PR ? [] : [{ k: 'ahorroReal', l: 'Beneficio real (acumulado)', t: 'number', min: 0 }, { k: 'resultadoNota', l: 'Resultado alcanzado (obligatorio para la 3ª estrella si no hay beneficio medible)', w: 3 }]),
    { sec: 'Fechas' },
    ...(PR ? [{ k: 'inicioPlan', l: 'Inicio estimado', t: 'date' }, { k: 'finPlan', l: 'Fecha objetivo de término', t: 'date' }]
      : [...(nw ? [{ k: 'inicioPlan', l: 'Inicio plan', t: 'date', hint: 'Se reparte entre las fases; luego se ajusta en Ciclo de vida' }, { k: 'finPlan', l: 'Fin plan (línea base)', t: 'date' }] : []), { k: 'finEst', l: 'Fin estimado (pronóstico)', t: 'date', hint: nw ? '' : 'Las fechas plan de cada fase se editan en la pestaña Ciclo de vida' }, { k: 'inicioReal', l: 'Inicio real', t: 'date' }, { k: 'finReal', l: 'Fin real', t: 'date' }]),
    { sec: 'Dependencias y proveedor' },
    { k: 'deps', l: 'Depende de', t: 'multi', opts: iniOpts().filter(o => !i || o.v !== i.id), w: 3 }, { k: 'proveedor', l: 'Proveedor', w: 2 }, { k: 'contrato', l: 'Estado contrato', t: 'select', opts: ['', 'Sin contrato', 'Con contrato', 'En negociación'] },
    { sec: 'Seguimiento' },
    { k: 'resumen', l: 'Resumen ejecutivo', t: 'textarea', w: 3 },
    ...(PR ? [] : [{ k: 'logros', l: 'Logros del ciclo', t: 'textarea', w: 3 }, { k: 'proximos', l: 'Próximos pasos', t: 'textarea', w: 3 }, { k: 'issue', l: 'Issue actual', w: 2 }, { k: 'riesgoTxt', l: 'Riesgo principal (texto)', w: 1 }]),
    ...(PR ? [{ sec: 'Priorización (1–5)' }, { k: 'sE', l: 'Alineación estratégica', t: 'range', min: 1, max: 5 }, { k: 'sV', l: 'Valor de negocio', t: 'range', min: 1, max: 5 }, { k: 'sF', l: 'Esfuerzo', t: 'range', min: 1, max: 5 }, { k: 'sR', l: 'Riesgo', t: 'range', min: 1, max: 5 }] : [])
  ];
  v.avance = v.avance || 0; v.avanceManual = i && (0, ENLACES.avanceManualDe)(i) != null ? (0, ENLACES.avanceManualDe)(i) : '';
  const tabs = [{ k: 'gen', t: 'General', secs: ['Identificación', 'Gobierno', 'Salud y avance', 'Fechas', 'Seguimiento', 'Priorización'] }, { k: 'fin', t: 'Finanzas', secs: ['Finanzas'] }, { k: 'rsk', t: 'Riesgos' + (nw ? '' : ' (' + riesgosDe(i.id).length + ')') }];
  if (!PR) tabs.push({ k: 'hit', t: 'Hitos' + (nw ? '' : ' (' + hitosDe(i.id).length + ')') });
  tabs.push({ k: 'dep', t: 'Dependencias', secs: ['Dependencias'] }, { k: 'bit', t: 'Bitácora' });
  openForm({ pres: true,
    title: nw ? (PR ? 'Nueva propuesta' : 'Nuevo proyecto (alta directa)') : 'Editar ' + T.toLowerCase() + ' · ' + i.titulo, fields, values: v, wide: true, tabs, tabExtra: iniTabExtra(i), saveLabel: nw ? 'Crear' : 'Guardar cambios', danger: nw ? null : 'Eliminar',
    onDanger: () => confirmBox(`¿Eliminar ${T.toLowerCase()} <b>${esc(i.titulo)}</b> junto con sus hitos, riesgos, decisiones, compromisos y cambios? Esta acción no se puede deshacer.`, () => (0, ENLACES.cmdServidor)('apih_eliminar_iniciativa', { p_id: i.id }, T + ' eliminada').then(r => { if (r) { UI.sel = null; refresh(); } }), 'Eliminar', true),
    onSave(o) {   // normalización, reglas (ciclos, fechas, montos, avance), id, plantilla de hitos y bitácora: el servidor
      return (0, ENLACES.guardarEnServidor)('apih_guardar_iniciativa', i && i.id, o, null, { p_tipo: nw ? T : null }).then(r => {
        if (r === null) return false;
        if (nw) { UI.sel = { t: 'ini', id: r.id }; toast(T + ' ' + r.id + (PR ? ' creada' : ' creado') + (r.hitosPlantilla ? ' · ' + r.hitosPlantilla + ' hitos precargados' : '')); }
        else toast(r.hitosPlantilla ? 'Cambios guardados · ' + r.hitosPlantilla + ' hitos precargados' : 'Cambios guardados');
        refresh(); return true;
      });
    }
  });
}
Acts.new = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const t = d.t; closePops();
  if (t === 'prop') iniForm(null, true); else if (t === 'ini' || t === 'prj') iniForm(null, false);
  else if (t === 'risk') riskForm(null, d.ini); else if (t === 'hito') hitoForm(null, d.ini); else if (t === 'dec') decForm(null, d.ini); else if (t === 'com') comForm(null);
};
Acts.edit = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  if (d.t === 'ini') iniForm(byId(d.id)); else if (d.t === 'risk') riskForm(St.riesgos.find(r => r.id === d.id)); else if (d.t === 'hito') hitoForm(St.hitos.find(r => r.id === d.id));
  else if (d.t === 'dec') decForm(St.decisiones.find(r => r.id === d.id)); else if (d.t === 'com') comForm(St.comites.find(r => r.id === d.id));
};

/* ---------- cambio de fase y de estado: un solo diálogo, «Cambiar etapa» (04-flujos.js) ---------- */
/* ---------- RAG / comentarios / hitos ---------- */
Acts.applyrag = async d => { await (0, ENLACES.cmdServidor)('apih_aplicar_rag', { p_id: d.id }, 'RAG actualizado'); };
Acts.comment = async d => { const el = $('#cmt'); const t = el && el.value.trim(); if (!t) return; const r = await (0, ENLACES.cmdServidor)('apih_comentar', { p_ini: d.id, p_texto: t, p_tema: null, p_en_pres: true }, 'Comentario agregado'); if (r) setTimeout(() => { const e2 = $('#cmt'); if (e2) e2.focus(); }, 30); };
export function toggleHito(id) { const h = St.hitos.find(x => x.id === id); if (!h) return; return (0, ENLACES.hitoEnServidor)(id, !h.completado); }   // completar o reabrir un hito es un comando del servidor (avance y cierre automático en la base)
Chg.hitotoggle = el => toggleHito(el.dataset.id); Acts.hitotoggle = d => toggleHito(d.id);

/* ---------- Hito ---------- */
export function hitoForm(h, ini) {
  const nw = !h, v = h ? clone(h) : { ini: ini || (UI.sel && UI.sel.t === 'ini' ? UI.sel.id : ''), fecha: addD(hoy(), 14), completado: false, resp: '', subfase: '' }, hi = byId(v.ini);
  openForm({ pres: true,
    title: nw ? 'Nuevo hito' : 'Editar hito', values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Crear' : 'Guardar',
    fields: [{ k: 'ini', l: 'Iniciativa', t: 'select', opts: [{ v: '', t: '— Elige la iniciativa —' }, ...iniOpts()], req: true, w: 3 }, { k: 'nombre', l: 'Hito', req: true, w: 3 }, { k: 'fase', l: 'Fase', t: 'select', opts: ['', ...FASES.map(x => { const w = hi && (0, ENLACES.ventanaDe)(hi, x); return { v: x, t: x + (w && w.ini ? ' · ' + (0, ENLACES.rangoTx)(w.ini, w.fin) : '') }; })], hint: 'Opcional: al avanzar de fase se exige cerrar los hitos de la fase' }, { k: 'subfase', l: 'Subfase', t: 'select', opts: [{ v: '', t: '— sin subfase —' }, ...(0, ENLACES.subfasesDe)(hi).map(x => ({ v: x.id, t: x.fase + ' › ' + x.nombre + ' · ' + (0, ENLACES.rangoTx)(x.inicio, x.fin) }))], hint: hi && (0, ENLACES.subfasesDe)(hi).length ? 'Opcional. Debe ser de la misma fase del hito' : 'Este proyecto aún no tiene subfases' }, { k: 'fecha', l: 'Fecha plan', t: 'date', req: true }, { k: 'cat', l: 'Categoría', t: 'select', opts: [{ v: '', t: '— sin categoría —' }, ...hitoCats()] }, { k: 'desc', l: 'Descripción / instrucciones', t: 'textarea', w: 3, rows: 3, hint: 'Opcional. Recordatorio del hito; se ve en Mi cocina.' }, { k: 'peso', l: 'Peso en el reporte (%)', t: 'number', min: 0, max: 100, hint: 'Opcional. Si todos los hitos del proyecto lo tienen y suman 100 %, el reporte los ubica por peso; si no, en partes iguales.' }, { k: 'resp', l: 'Responsable', list: people() }, { k: 'completado', l: 'Estado', t: 'check', lbl: 'Completado' }, { k: 'fechaReal', l: 'Fecha real', t: 'date' }],
    onDanger: () => confirmBox('¿Eliminar este hito?', () => (0, ENLACES.eliminarEnServidor)('APIH_Hitos', h.id, 'Hito eliminado').then(r => { if (r) { UI.sel = null; refresh(); } }), 'Eliminar', true),
    onSave(o) { return (0, ENLACES.guardarEnServidor)('apih_guardar_hito', h && h.id, o, nw ? 'Hito creado' : 'Hito guardado').then(r => r !== null); }   // reglas, fecha real, bitácora y avance: el servidor
  });
  /* N-U-04/05: al cambiar Iniciativa o Fase se recalculan las opciones de Fase y Subfase */
  const fi = $('#f_ini'), ff = $('#f_fase'), fs = $('#f_subfase');
  if (fi && ff && fs) {
    const op = (v, t, sel) => '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(t) + '</option>';
    const rebuild = (cambioIni) => {
      const x = byId(fi.value), f0 = ff.value, s0 = fs.value;
      if (cambioIni) ff.innerHTML = op('', '', !f0) + FASES.map(k => { const w = x && (0, ENLACES.ventanaDe)(x, k); return op(k, k + (w && w.ini ? ' · ' + (0, ENLACES.rangoTx)(w.ini, w.fin) : ''), k === f0); }).join('');
      const sf = (0, ENLACES.subfasesDe)(x).filter(y => !ff.value || y.fase === ff.value);
      fs.innerHTML = op('', '— sin subfase —', true) + sf.map(y => op(y.id, y.fase + ' › ' + y.nombre + ' · ' + (0, ENLACES.rangoTx)(y.inicio, y.fin), y.id === s0)).join('');
    };
    fi.addEventListener('change', () => rebuild(true));
    ff.addEventListener('change', () => rebuild(false));
  }
}

/* ---------- Riesgo ---------- */
export function riskForm(r, ini, pre) {
  const nw = !r, v = r ? clone(r) : { ini: ini || (UI.sel && UI.sel.t === 'ini' ? UI.sel.id : ''), cat: 'Técnico', prob: 3, imp: 3, estado: 'Abierto', dueno: St.cfg.usuario, fIdent: hoy(), fRev: addD(hoy(), 30), mit: '', ...(pre || {}) };
  openForm({ pres: true,
    title: nw ? 'Nuevo riesgo' : 'Editar riesgo ' + r.id, values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Registrar' : 'Guardar',
    fields: [{ k: 'ini', l: 'Proyecto / iniciativa', t: 'select', opts: [{ v: '', t: '— Elige la iniciativa —' }, ...iniOpts()], req: true, w: 3 }, { k: 'desc', l: 'Descripción del riesgo', req: true, t: 'textarea', w: 3 }, { k: 'cat', l: 'Categoría', t: 'select', opts: RISK_CATS }, { k: 'estado', l: 'Estado', t: 'select', opts: RISK_ESTADOS }, { k: 'dueno', l: 'Dueño', list: people() },
      { k: 'prob', l: 'Probabilidad (1–5)', t: 'range', min: 1, max: 5 }, { k: 'imp', l: 'Impacto (1–5)', t: 'range', min: 1, max: 5 }, { k: 'mit', l: 'Plan de mitigación', t: 'textarea', w: 3 }, { k: 'fIdent', l: 'Identificado', t: 'date' }, { k: 'fRev', l: 'Próxima revisión', t: 'date' }],
    onDanger: () => confirmBox('¿Eliminar este riesgo?', () => (0, ENLACES.eliminarEnServidor)('APIH_Riesgos', r.id, 'Riesgo eliminado').then(x => { if (x) { UI.sel = null; refresh(); } }), 'Eliminar', true),
    onSave(o) { return (0, ENLACES.guardarEnServidor)('apih_guardar_riesgo', r && r.id, o, nw ? 'Riesgo registrado' : 'Riesgo guardado').then(x => x !== null); }   // umbral crítico y mitigación: el servidor
  });
}

/* ---------- Decisión ---------- */
export function decForm(d, ini, pre) {
  const nw = !d, v = d ? clone(d) : { ini: ini || '', tipo: 'Iniciar', estado: 'Pendiente', limite: addD(hoy(), 14), solicita: St.cfg.usuario, area: 'BISE', ...(pre || {}) };
  openForm({ pres: true,
    title: nw ? 'Nueva decisión' : 'Editar decisión ' + d.id, values: v, danger: nw ? null : 'Eliminar', saveLabel: nw ? 'Registrar' : 'Guardar',
    fields: [{ k: 'tipo', l: 'Tipo de decisión', t: 'select', opts: DEC_TIPOS }, { k: 'ini', l: 'Proyecto / propuesta', t: 'select', opts: iniOpts(), blank: '— Sin proyecto ni propuesta —', w: 2 }, { k: 'titulo', l: 'Pregunta / decisión', req: true, w: 3 }, { k: 'recomendacion', l: 'Recomendación', t: 'textarea', w: 3 },
      { k: 'limite', l: 'Fecha límite', t: 'date' }, { k: 'solicita', l: 'Solicitada por', list: people() }, { k: 'comite', l: 'Comité', t: 'select', opts: St.comites.map(c => ({ v: c.id, t: c.id + ' · ' + fmtD(c.fecha) })), blank: '—' }],
    onDanger: () => confirmBox('¿Eliminar esta decisión?', () => (0, ENLACES.eliminarEnServidor)('APIH_Decisiones', d.id, 'Decisión eliminada').then(x => { if (x) { UI.sel = null; refresh(); } }), 'Eliminar', true),
    onSave(o) { return (0, ENLACES.guardarEnServidor)('apih_guardar_decision', d && d.id, o, nw ? 'Decisión registrada' : 'Decisión guardada').then(x => x !== null); }   // plazo, tipo y comité: el servidor
  });
}
const EFECTO = (tipo, t) => ({ Iniciar: 'La propuesta se aprueba y se crea el proyecto en Planificación.', Acelerar: 'Prioridad → Alta (y el proyecto pausado vuelve a En curso).', Mantener: 'Sin cambios de estado.', Pausar: t && esProp(t) ? 'La propuesta pasa a En espera (revisión en 30 días).' : 'El proyecto pasa a Pausado (revisión en 30 días).', Cancelar: t && esProp(t) ? 'La propuesta pasa a Rechazada.' : 'El proyecto pasa a Cancelado.' }[tipo]);
Acts.resolvedec = d => {
  if ((0, ENLACES.soloLectura)()) return (0, ENLACES.NO_PERM)('Tu rol o el modo solo lectura no permiten editar');
  const x = St.decisiones.find(y => y.id === d.id);
  openForm({
    title: 'Resolver decisión ' + x.id, saveLabel: 'Registrar resolución', values: { estado: 'Aprobada', resolucion: '', fResol: hoy(), aplicar: true },
    fields: [{ k: 'estado', l: 'Resultado', t: 'select', opts: ['Aprobada', 'Rechazada', 'Diferida'] }, { k: 'fResol', l: 'Fecha', t: 'date' }, { k: 'resolucion', l: 'Resolución / comentario de cierre', t: 'textarea', w: 3 }, { k: 'aplicar', l: 'Efecto', t: 'check', lbl: 'Aplicar efecto: ' + EFECTO(x.tipo, byId(x.ini)), w: 3 }],
    extra: `<p class="mut" style="margin-top:8px"><b>${esc(x.tipo)}</b> · ${esc(x.titulo)}</p>`,
    onSave(o) {
      return (0, ENLACES.resolverEnServidor)(x, o);   // la resolución y su efecto son un comando transaccional del servidor
    }
  });
};

/* ---------- Comité ---------- */
function comForm(c) {
  const nw = !c, v = c ? clone(c) : { nombre: 'Comité Portafolio TI Operaciones', fecha: addD(hoy(), 14), hora: '10:00', lugar: 'Teams', estado: 'Programado' };
  openForm({
    title: nw ? 'Nuevo comité' : 'Editar comité', values: v, saveLabel: nw ? 'Crear' : 'Guardar', danger: nw ? null : 'Eliminar',
    fields: [{ k: 'nombre', l: 'Nombre', req: true, w: 3 }, { k: 'fecha', l: 'Fecha', t: 'date', req: true }, { k: 'hora', l: 'Hora', t: 'time' }, { k: 'lugar', l: 'Lugar / enlace' }, { k: 'estado', l: 'Estado', t: 'select', opts: ['Programado', 'Realizado', 'Cancelado'] }, { k: 'resumen', l: 'Mensaje principal / resumen', t: 'textarea', w: 3 }],
    onDanger: () => confirmBox('¿Eliminar este comité?', () => (0, ENLACES.eliminarEnServidor)('APIH_Comites', c.id, 'Comité eliminado').then(r => { if (r) refresh(); }), 'Eliminar', true),
    onSave(o) { return (0, ENLACES.guardarEnServidor)('apih_guardar_comite', c && c.id, o, nw ? 'Comité creado' : 'Comité guardado').then(r => { if (r === null) return false; if (nw && r.id) UI.f.comite = { sel: r.id }; return true; }); }   // id, participantes iniciales y bitácora: del servidor
  });
}

/* contenido de las pestañas Riesgos / Hitos / Dependencias / Bitácora del formulario de iniciativa */
function iniTabExtra(i) {
  const none = '<p class="mut" style="padding:14px 4px">Disponible después de crear el registro.</p>';
  if (!i) return { rsk: none, hit: none, bit: none };
  const row = (a, b, c, act) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="n">${act}</td></tr>`;
  const tbl = (head, rows, newBtn) => `<div class="tbl-w"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}<th></th></tr></thead><tbody>${rows || `<tr><td colspan="${head.length + 1}" class="mut">Sin registros</td></tr>`}</tbody></table></div><div style="margin-top:8px">${newBtn}</div><small class="mut">Guarde los cambios de la ficha antes de abrir otro formulario.</small>`;
  const dn = St.ini.filter(x => (x.deps || []).includes(i.id));
  return {
    rsk: tbl(['ID', 'Riesgo', 'Exposición'], riesgosDe(i.id).map(r => `<tr><td class="mono">${r.id}</td><td>${esc(r.desc)}</td><td>${expo(r)}</td><td class="n"><button class="btn sm" data-act="edit" data-t="risk" data-id="${r.id}">Editar</button></td></tr>`).join(''), btn('Nuevo riesgo', 'new', { d: { t: 'risk', ini: i.id }, ic: 'plus', cls: 'sm' })),
    hit: tbl(['Hito', 'Fecha', 'Estado'], hitosDe(i.id).sort(by(h => h.fecha)).map(h => `<tr><td>${esc(h.nombre)}</td><td>${fmtD(h.fecha)}</td><td>${hitoEstado(h).t}</td><td class="n"><button class="btn sm" data-act="edit" data-t="hito" data-id="${h.id}">Editar</button></td></tr>`).join(''), btn('Nuevo hito', 'new', { d: { t: 'hito', ini: i.id }, ic: 'plus', cls: 'sm' })),
    dep: `<div class="sub">Habilita a (${dn.length})</div>${dn.map(x => `<div class="pp" style="margin:3px 0">${ragPill(x.rag)} <b>${esc(x.titulo)}</b> <span class="mut">${x.fase}</span></div>`).join('') || '<p class="mut">Nada depende de este registro.</p>'}`,
    bit: `<div class="feed sm">${St.bitacora.filter(b => b.ini === i.id).slice(0, 25).map(b => `<div class="f-i"><span class="f-dot" style="background:${BIT_C[b.tipo]}"></span><div><b>${esc(b.tipo)}</b> · ${esc(b.autor)} <small>${esc(String(b.ts).replace('T', ' '))}</small><p style="margin:2px 0">${esc(b.texto)}</p></div></div>`).join('') || '<p class="mut">Sin registros.</p>'}</div>`
  };
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  Modal: { get: () => Modal, enumerable: true, configurable: true },
  UI: { get: () => UI, enumerable: true, configurable: true },
  banner: { get: () => banner, set: v => { asignar_banner(v); }, enumerable: true, configurable: true },
  btn: { get: () => btn, enumerable: true, configurable: true },
  fitMain: { get: () => fitMain, set: v => { asignar_fitMain(v); }, enumerable: true, configurable: true },
  go: { get: () => go, set: v => { asignar_go(v); }, enumerable: true, configurable: true },
  hitoForm: { get: () => hitoForm, set: v => { hitoForm = v; }, enumerable: true, configurable: true },
  openForm: { get: () => openForm, set: v => { asignar_openForm(v); }, enumerable: true, configurable: true },
  pageHead: { get: () => pageHead, enumerable: true, configurable: true },
  panelDec: { get: () => panelDec, set: v => { asignar_panelDec(v); }, enumerable: true, configurable: true },
  panelHito: { get: () => panelHito, set: v => { asignar_panelHito(v); }, enumerable: true, configurable: true },
  panelIni: { get: () => panelIni, set: v => { asignar_panelIni(v); }, enumerable: true, configurable: true },
  panelRisk: { get: () => panelRisk, set: v => { asignar_panelRisk(v); }, enumerable: true, configurable: true },
  refresh: { get: () => refresh, set: v => { asignar_refresh(v); }, enumerable: true, configurable: true },
  render: { get: () => render, set: v => { asignar_render(v); }, enumerable: true, configurable: true },
  renderChrome: { get: () => renderChrome, set: v => { asignar_renderChrome(v); }, enumerable: true, configurable: true },
  selOpts: { get: () => selOpts, enumerable: true, configurable: true },
  shell: { get: () => shell, enumerable: true, configurable: true },
  toast: { get: () => toast, set: v => { asignar_toast(v); }, enumerable: true, configurable: true },
  updateSyncUI: { get: () => updateSyncUI, enumerable: true, configurable: true },
});
