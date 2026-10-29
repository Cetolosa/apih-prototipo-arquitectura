import { ENLACES } from './00-registro.js';
import { DECS, St, _nrm, by, byId, esProp, esSB, expo, fmtD, fmtMon, hitosDe, hoy, isLive, miUsuario, monOf, riesgoAbierto, riesgosDe, toISO } from './01-nucleo.js';
import { avFase } from './03-interfaz.js';
import { PRES_MIO } from './07-gobierno.js';
import { execSummary } from './07b-gobierno-analisis-capacidad.js';
import { COLECTOR, Date, GD, Utilities, ppt_nuevaSlide_ } from './08a-generador-motor.js';
import { ESTILO_PPT, ppt_acotarParaAncho_, ppt_altoTexto_, ppt_decisionAplicaAArea_, ppt_fondo_, ppt_lineasNecesarias_, ppt_texto_ } from './08b-generador-primitivas.js';
import { ALT4_PALETA_ACTIVA, ESTILO_ALT4, construirSlideEjecutivo_, construirSlideFlujoPropuestas_, construirSlidePortada_, ppt_alt4Fondo_, ppt_alt4Header_, ppt_tintar_ } from './08c-generador-portafolio.js';
import { construirSlideAnexo_, construirSlideFlujoProyectos_, construirSlidesDetalle_ } from './08c2-generador-portafolio-detalle.js';
import { construirSlideFicha_ } from './08d-generador-ficha.js';
import { construirSlideFichaPropuesta_ } from './08d2-generador-ficha-detalle.js';
import { construirSlideEstructuraPortafolio_, construirSlidePlanAccion_, construirSlidesBitacora_ } from './08e-generador-bitacora.js';
import { construirSlidesLogros_ } from './08f-generador-pipeline.js';
import { construirSlidesAlertasEstancamiento_, construirSlidesProximosHitos_ } from './08f2-generador-pipeline-alertas.js';
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
    const hs = hitosDe(i.id).filter(ENLACES.inc).filter(h => !h.completado).sort(by('fecha')), top = riesgosDe(i.id).filter(r => riesgoAbierto(r) && (0, ENLACES.inc)(r)).sort(by(r => -expo(r)))[0];
    return {
      id: i.id, nombre: i.titulo, categoria: i.categoria, area: areaDe(i), avance: i.avance, salud_rag: ragO(i.rag), prioridad: i.prioridad, estado: estadoPrj(i),
      resumen_ejecutivo: (0, ENLACES.incT)(i, 'resumen') ? lineas(i.resumen) : '', proposito: i.desc || '', responsable: i.lider || '', responsable_negocio: i.negocio || '',
      fecha_inicio: i.inicioPlan || null, fecha_fin_estimada: i.finEst || i.finPlan || null,
      presupuesto_asignado: MMi(i, i.presupuesto), presupuesto_gastado: MMi(i, i.gastado), moneda: monOf(i),
      logros_ciclo: (0, ENLACES.incT)(i, 'logros') ? lineas(i.logros) : '', proximos_pasos: (0, ENLACES.incT)(i, 'proximos') ? lineas(i.proximos) : '',
      issue: (0, ENLACES.incT)(i, 'issue') ? lineas(i.issue) : '', riesgo: i.riesgoTxt || (top ? top.desc : ''),
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
    const hoyIso = hoy(); ENLACES.HOY_MS = D(hoyIso).getTime() + 12 * 3600e3;
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
    const prj = single ? prjAll : prjAll.filter(ENLACES.inc), prop = single ? propAll : propAll.filter(ENLACES.inc);   // el registro elegido para presentarlo solo entra siempre
    const propTodas = single ? propAll : St.ini.filter(i => esProp(i) && !esSB(i) && okArea(i) && (0, ENLACES.inc)(i));
    const ids = {}; [...prj, ...prop].forEach(i => ids[i.id] = 1);
    const hitosRows = St.hitos.filter(h => ids[h.ini]).map(h => ({ iniciativa_id: h.ini, nombre_hito: h.nombre, fecha: h.fecha, completado: !!h.completado, mostrar_detalle: (0, ENLACES.inc)(h) }));
    const sols = prop.filter(p => p.proveedor).map(p => ({ propuesta_id: p.id, seleccionada: true }));
    const hist = [];
    St.bitacora.filter(b => b.tipo === 'Comentario' && ids[b.ini] && (0, ENLACES.inc)(b)).forEach(b => hist.push({ iniciativa_id: b.ini, fecha: b.ts.slice(0, 10), nota: b.texto }));
    ENLACES.GD = { Hitos: hitosRows, Propuestas: propTodas.map(rowProp), SolucionesProveedor: sols, Historial: hist, Iniciativas: prj.map(rowPrj) };
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
    DECS().filter(d => (0, ENLACES.inc)(d)).forEach(d => {
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
    try { if (!single) { generado = (0, ENLACES.withArea)(c, () => execSummary('con')[0].p[0]) || mensaje; } } catch (e) { }
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
    ENLACES.COLECTOR = []; ENLACES.ALT4_PAGINA_ACTUAL = 0; ALT4_PALETA_ACTIVA.accent = ENLACES.TEMA.cur.colores.acento || '#B5450D'; ALT4_PALETA_ACTIVA.accentDeep = ENLACES.TEMA.cur.colores.acentoOsc || '#8A4321';
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

export const GENE = { contexto, hacer, libre, seccion, numerar, notasEjecutivo, cuentas: x => ({ prj: [x.prj.length, x.prjAll.length], prop: [x.prop.length, x.propAll.length] }) };

// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  areasDeIniciativa_: { get: () => areasDeIniciativa_, enumerable: true, configurable: true },
  calcularAvanceEsperado_: { get: () => calcularAvanceEsperado_, enumerable: true, configurable: true },
  calcularBloqueoPropuesta_: { get: () => calcularBloqueoPropuesta_, enumerable: true, configurable: true },
  iniciativaPerteneceAArea_: { get: () => iniciativaPerteneceAArea_, enumerable: true, configurable: true },
  muestraDetalle_: { get: () => muestraDetalle_, enumerable: true, configurable: true },
  parsearFecha_: { get: () => parsearFecha_, enumerable: true, configurable: true },
});
