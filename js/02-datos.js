import { ENLACES } from './00-registro.js';
import { BACKEND, AuthService, Sesion, PantallaAcceso, usarDatos } from './01t-transporte.js';
import { APIH_CONFIG, BIT_TIPOS, DEC_TIPOS, ESTADOS_PRJ, ESTADOS_PROP, CALC, FL, PERM, RAGS, RISK_ESTADOS, St, _nrm, defaultCfg, diffD, esAdminReal, esProp, hitoEstado, hoy, roi, seedState } from './01-nucleo.js';
/* =====================================================================
   CAPA DE DATOS · DataService (común a todos los ambientes). Lo propio de cada ambiente —servidor, acceso y
   transporte— vive en 01t-transporte.js
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. ESQUEMA DE ENTIDADES (columnas y mapeo de dominio)
   Cada columna: n = nombre de la columna · t = tipo · k = campo de dominio
   rw = true: la columna se puede editar fuera de la app y "gana" sobre DatosJSON
   get/set = conversores personalizados. 'Title' es el título visible del registro.
   DatosJSON conserva el objeto de dominio completo (campos sin columna propia).
   --------------------------------------------------------------------- */
export const C = {
  txt: (n, k, o) => Object.assign({ n, t: 'Text', k, rw: true }, o),
  note: (n, k, o) => Object.assign({ n, t: 'Note', k, rw: true }, o),
  num: (n, k, o) => Object.assign({ n, t: 'Number', k, rw: true }, o),
  date: (n, k, o) => Object.assign({ n, t: 'Date', k, rw: true }, o),
  ch: (n, k, choices, o) => Object.assign({ n, t: 'Choice', k, ch: choices, rw: true }, o),
  der: (n, t, get, o) => Object.assign({ n, t, get, rw: false }, o)   // columna derivada (solo lectura)
};
const nextOpenHito = i => { const hs = St.hitos.filter(h => h.ini === i.id && !h.completado).sort((a, b) => a.fecha < b.fecha ? -1 : 1); return hs[0] || null; };
const HITO_ESTADOS = ['En plazo', 'Por vencer', 'Vencido', 'Completado'];
const DEC_ESTADOS_SP = ['Pendiente', 'Aprobada', 'Rechazada', 'Pospuesta', 'Aplicada'];

export const ESQUEMA = {
  projects: {
    label: 'Proyectos', cfg: 'projectsList', coll: 'ini', key: 'Codigo', idCol: 'Codigo', title: 'Titulo (Title)',
    cols: [
      C.txt('Title', 'titulo'), C.txt('Codigo', 'id', { rw: false, idCol: true }), C.txt('Sponsor', 'sponsor'), C.txt('Responsable', 'lider'), C.txt('Area', 'area'),
      C.ch('Estado', 'estado', ESTADOS_PRJ), C.ch('Prioridad', 'prioridad', ['Alta', 'Media', 'Baja']), C.ch('RAG', 'rag', RAGS),
      C.date('InicioPlan', 'inicioPlan'), C.date('FinPlan', 'finPlan'), C.date('InicioReal', 'inicioReal'), C.date('FinReal', 'finReal'),
      C.num('Avance', 'avance'), C.txt('Moneda', 'moneda'), C.num('Presupuesto', 'presupuesto'), C.num('Beneficio', 'beneficio'),
      C.der('ROI', 'Number', i => { const r = roi(i); return r == null ? null : Math.round(r * 10) / 10; }),
      C.txt('Dependencias', 'deps', { get: i => (i.deps || []).join(';'), set: (o, v) => { o.deps = v ? String(v).split(/[;,\s]+/).filter(Boolean) : []; } }),
      C.der('ProximoHito', 'Text', i => { const h = nextOpenHito(i); return h ? h.nombre + ' (' + h.fecha + ')' : ''; }),
      C.txt('Fase', 'fase'), C.txt('TipoIniciativa', 'tipoIni'), C.txt('PropuestaOrigen', 'propuestaOrigen'), C.note('MotivoEstado', 'estadoMotivo'), C.date('FechaRevision', 'estadoRev')
    ],
    filter: i => !esProp(i),
    tpl: () => ({ tipo: 'Proyecto', moneda: 'CLP', desc: '', bc: '', beneficio: 0, sponsor: '', lider: '', negocio: '', area: 'BISE', categoria: '', clasif: 'Táctico', gasto: 'OPEX', proveedor: '', contrato: '', fase: 'Planificación', estado: 'En curso', rag: 'Verde', prioridad: 'Media', presupuesto: 0, gastado: 0, ahorroReal: 0, avance: 0, inicioPlan: null, finPlan: null, inicioReal: null, finReal: null, finEst: null, deps: [], resumen: '', logros: '', proximos: '', issue: '', riesgoTxt: '', creada: hoy(), actualizada: hoy(), origen: 'usuario', est: [], hist: [], tags: [], rec: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null })
  },
  proposals: {
    label: 'Propuestas', cfg: 'proposalsList', coll: 'ini', key: 'Codigo', title: 'Titulo (Title)', filter: esProp,
    cols: [
      C.txt('Title', 'titulo'), C.txt('Codigo', 'id', { rw: false }), C.txt('Solicitante', 'solicitante'), C.txt('Sponsor', 'sponsor'), C.txt('Responsable', 'lider'), C.txt('Area', 'area'),
      C.txt('Fase', 'fase'), C.txt('TipoIniciativa', 'tipoIni'), C.ch('Estado', 'estado', ESTADOS_PROP), C.ch('Prioridad', 'prioridad', ['Alta', 'Media', 'Baja']),
      ...[['Estrategia', 'estrategia'], ['Valor', 'valor'], ['Esfuerzo', 'esfuerzo'], ['Riesgo', 'riesgo']].map(([n, k]) => C.num('Score' + n, null, { get: o => o.score ? o.score[k] : null, set: (o, v) => { if (v == null || v === '') return; o.score = o.score || {}; o.score[k] = +v; } })),
      C.num('BeneficioEstimado', 'beneficio'), C.txt('Moneda', 'moneda'), C.num('CostoEstimado', 'presupuesto'), C.date('FechaSolicitud', 'creada'), C.date('FechaObjetivo', 'finPlan'),
      C.txt('Dependencias', 'deps', { get: i => (i.deps || []).join(';'), set: (o, v) => { o.deps = v ? String(v).split(/[;,\s]+/).filter(Boolean) : []; } }),
      C.der('DiasEnFase', 'Number', i => (0, ENLACES.diasEnFase)(i)), C.txt('ProyectoGenerado', 'proyecto'), C.note('MotivoEstado', 'estadoMotivo'), C.date('FechaRevision', 'estadoRev')
    ],
    tpl: () => ({ tipo: 'Propuesta', moneda: 'CLP', desc: '', bc: '', beneficio: 0, sponsor: '', lider: '', solicitante: '', negocio: '', area: 'BISE', categoria: '', clasif: 'Táctico', gasto: 'OPEX', proveedor: '', contrato: '', fase: 'Recepción', estado: 'Vigente', rag: 'Verde', prioridad: 'Media', presupuesto: 0, gastado: 0, ahorroReal: 0, avance: 0, inicioPlan: null, finPlan: null, inicioReal: null, finReal: null, finEst: null, deps: [], resumen: '', logros: '', proximos: '', issue: '', riesgoTxt: '', creada: hoy(), actualizada: hoy(), faseDesde: hoy(), origen: 'usuario', est: [], hist: [], tags: [], rec: null, score: { estrategia: 3, valor: 3, esfuerzo: 3, riesgo: 2 }, proyecto: null, estadoMotivo: '', estadoRev: null })
  },
  risks: {
    label: 'Riesgos', cfg: 'risksList', coll: 'riesgos', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.note('Descripcion', 'desc'),
      C.num('Impacto', 'imp'), C.num('Probabilidad', 'prob'), C.der('Exposicion', 'Number', r => (r.imp || 0) * (r.prob || 0)),
      C.note('Mitigacion', 'mit'), C.txt('Owner', 'dueno'), C.ch('Estado', 'estado', RISK_ESTADOS)
    ],
    tpl: () => ({ desc: '', cat: 'Otro', prob: 3, imp: 3, mit: '', dueno: '', estado: 'Abierto', fIdent: hoy(), fRev: null })
  },
  milestones: {
    label: 'Hitos', cfg: 'milestonesList', coll: 'hitos', key: 'Codigo', title: 'Nombre (Title)',
    cols: [
      C.txt('Title', 'nombre'), C.txt('Codigo', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.txt('Fase', 'fase'), C.date('FechaPlan', 'fecha'), C.date('FechaReal', 'fechaReal'),
      C.ch('Estado', 'completado', HITO_ESTADOS, {
        get: h => { const e = hitoEstado(h).k; return e === 'done' || e === 'late' ? 'Completado' : e === 'over' ? 'Vencido' : e === 'soon' ? 'Por vencer' : 'En plazo'; },
        set: (o, v) => { if (v === 'Completado' && !o.completado) { o.completado = true; o.fechaReal = o.fechaReal || hoy(); } else if (v && v !== 'Completado' && o.completado) { o.completado = false; o.fechaReal = null; } }
      }),
      C.txt('Responsable', 'resp')
    ],
    tpl: () => ({ nombre: '', fecha: hoy(), completado: false, fechaReal: null, resp: '' })
  },
  decisions: {
    label: 'Decisiones', cfg: 'decisionsList', coll: 'decisiones', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.txt('Comite', 'comite'), C.ch('Decision', 'tipo', DEC_TIPOS), C.note('Tema', 'titulo'),
      C.txt('Responsable', 'solicita'), C.date('FechaCompromiso', 'limite'), C.ch('Estado', 'estado', DEC_ESTADOS_SP)
    ],
    tpl: () => ({ tipo: 'Mantener', titulo: '', recomendacion: '', limite: null, estado: 'Pendiente', resolucion: '', fResol: null, comite: null, solicita: '', area: '', aplicada: false })
  },
  commitments: {
    label: 'Compromisos', cfg: 'commitmentsList', coll: 'compromisos', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.note('Descripcion', 'texto'), C.txt('Responsable', 'resp'), C.txt('SolicitadoPor', 'de'),
      C.date('FechaCompromiso', 'limite'), C.date('FechaCierre', 'fechaReal'), C.ch('Estado', 'estado', ['Abierto', 'Cumplido', 'Cancelado']), C.txt('Fuente', 'origen'), C.txt('Tema', 'tema')
    ],
    tpl: () => ({ ini: null, texto: '', resp: '', de: '', limite: null, fechaReal: null, estado: 'Abierto', origen: 'manual', tema: '', creada: hoy() })
  },
  changes: {
    label: 'Cambios', cfg: 'changesList', coll: 'cambios', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.ch('Tipo', 'tipo', ['Alcance', 'Fecha', 'Presupuesto', 'Recursos', 'Otro']), C.note('Descripcion', 'desc'), C.note('Motivo', 'motivo'), C.note('Impacto', 'impacto'),
      C.txt('Solicitante', 'solicita'), C.date('FechaAnterior', 'fAnt'), C.date('FechaNueva', 'fNue'), C.num('PresupuestoAnterior', 'pAnt'), C.num('PresupuestoNuevo', 'pNue'),
      C.ch('Estado', 'estado', ['Solicitado', 'Aprobado', 'Rechazado']), C.txt('Aprobador', 'aprobador'), C.date('FechaDecision', 'fDec'), C.note('NotaDecision', 'nota'), C.date('FechaSolicitud', 'creada')
    ],
    tpl: () => ({ ini: null, tipo: 'Fecha', desc: '', motivo: '', impacto: '', solicita: '', fAnt: null, fNue: null, pAnt: 0, pNue: 0, estado: 'Solicitado', aprobador: '', fDec: null, nota: '', creada: hoy() })
  },
  notes: {
    label: 'Comentarios', cfg: 'notesList', coll: 'notas', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.txt('Area', 'area'), C.txt('Tipo', 'tipo'), C.txt('Visto', 'visto'), C.txt('VistoPor', 'vistoPor'), C.date('FechaVisto', 'fVisto'), C.txt('Vista', 'vista'), C.txt('Referencia', 'ref'), C.note('Comentario', 'texto'),
      C.txt('Autor', 'autor'), C.txt('Correo', 'correo'), C.txt('Fecha', 'ts'), C.ch('Estado', 'estado', ['Abierto', 'Abordado']), C.txt('AbordadoPor', 'por'), C.date('FechaAbordado', 'fAb')
    ],
    tpl: () => ({ ini: null, area: 'Transversal', tipo: '', visto: '', vistoPor: '', fVisto: null, vista: '', ref: '', texto: '', autor: '', correo: '', ts: hoy() + 'T00:00', estado: 'Abierto', por: '', fAb: null })
  },
  docs: {
    label: 'Documentos', cfg: 'docsList', coll: 'documentos', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'), C.txt('Nombre', 'nombre'), C.txt('Tipo', 'tipo'), C.note('Enlace', 'url'), C.note('Nota', 'nota'),
      C.txt('Autor', 'autor'), C.txt('Correo', 'correo'), C.txt('Fecha', 'ts')
    ],
    tpl: () => ({ ini: null, nombre: '', tipo: 'Otro', url: '', nota: '', autor: '', correo: '', ts: hoy() + 'T00:00' })
  },
  audit: {
    label: 'Bitácora', cfg: 'auditList', coll: 'bitacora', key: 'Title', title: 'ID (Title)',
    cols: [
      C.txt('Title', 'id', { rw: false }), C.txt('ProyectoID', 'ini'),
      { n: 'Fecha', t: 'DateTime', k: 'ts', rw: false, get: b => b.ts ? new Date(b.ts).toISOString() : null },
      C.txt('Usuario', 'autor'), C.ch('Tipo', 'tipo', BIT_TIPOS), C.note('Descripcion', 'texto'), C.txt('Tema', 'tema'), C.txt('EnPresentacion', 'inPres', { rw: false, get: b => b.inPres === false ? 'No' : 'Si' })
    ],
    tpl: () => ({ ts: hoy() + 'T00:00', tipo: 'Comentario', ini: null, autor: '', texto: '', meta: null })
  },
  committees: {
    label: 'Comités', cfg: 'committeesList', coll: 'comites', key: 'Codigo', title: 'Nombre (Title)',
    cols: [C.txt('Title', 'nombre'), C.txt('Codigo', 'id', { rw: false }), C.date('Fecha', 'fecha'), C.txt('Hora', 'hora'), C.txt('Estado', 'estado')],
    tpl: () => ({ nombre: '', fecha: hoy(), hora: '10:00', lugar: 'Teams', estado: 'Programado', resumen: '', narrativa: '', participantes: [], temas: [], decisiones: [], acciones: [], compromisos: [] })
  }
};
const DATOS_COL = { n: 'DatosJSON', t: 'Note' };
export const SETTINGS_KEYS = ['cfg', 'cfgU', 'eventos', 'pres', 'ptpl', 'ptema', 'seq'];
const settingKeys = S => [...SETTINGS_KEYS, ...Object.keys((S && S.psnap) || {}).map(i => 'psnap:' + i)];   // psnap:<id> = presentación congelada       // documentos en APIH_Config
const LOCAL_CFG = ['usuario', 'areaGlobal'];                                // preferencias de sesión: no se comparten

const spEq = (a, b) => {
  const e = x => x == null || x === '';
  if (e(a) && e(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') return +a === +b;
  return a === b;
};

/* Mapeo dominio <-> campos de columna */
const MapaDatos = {
  objOf(ent, f) {
    const S = ESQUEMA[ent]; let o = null;
    try { if (f[DATOS_COL.n]) o = JSON.parse(f[DATOS_COL.n]); } catch (e) { o = null; }
    if (!o) o = Object.assign(S.tpl(), {});     // fila creada fuera de la app
    const idc = S.cols.find(c => c.k === 'id');
    if (idc && f[idc.n] && !o.id) o.id = f[idc.n];
    S.cols.forEach(c => {
      if (!c.rw || !(c.n in f)) return;
      let v = f[c.n];
      if (c.set) { c.set(o, v); return; }
      if (c.t === 'Date') { const d = v ? String(v).slice(0, 10) : null; const cur = o[c.k]; if (!cur || !d || Math.abs(diffD(d, cur)) > 1) o[c.k] = d; return; }   // tolera desfase de zona horaria (±1 día)
      if (c.t === 'Number') { if (v != null && !spEq(v, o[c.k])) o[c.k] = +v; return; }
      if (v === '' || v == null) { if (!(o[c.k] == null || o[c.k] === '')) { if (typeof o[c.k] === 'string') o[c.k] = ''; } return; }
      if (!spEq(v, o[c.k])) o[c.k] = v;
    });
    if (ent === 'risks' || ent === 'milestones' || ent === 'decisions' || ent === 'commitments' || ent === 'changes' || ent === 'notes' || ent === 'docs') { if (o.ini === '') o.ini = null; }
    if (ent === 'projects') { o.deps = o.deps || []; o.est = o.est || []; o.hist = o.hist || []; }
    return o;
  }
};

/* ---------------------------------------------------------------------
   4. DataService · carga, diff y sincronización con la API de APIH
   --------------------------------------------------------------------- */
usarDatos({ ESQUEMA, MapaDatos, DATOS_COL });   // el transporte del ambiente usa el mismo esquema
const COLLS = Object.keys(ESQUEMA);   // projects, risks, milestones, decisions, audit, committees
const backendName = () => BACKEND.nombre;
const backendLabel = () => BACKEND.etiqueta;
const newSvc = () => BACKEND.nuevo(APIH_CONFIG);
export { BACKEND, AuthService, Sesion, PantallaAcceso };
export const DataService = {
  mode: 'demo', svc: null, snap: null, timer: null, poll: null, busy: false, again: false, dirty: false, tries: 0,
  st: { state: 'demo', msg: 'Sin conexión', last: null, pending: 0, err: '' },
  setStatus(o) { Object.assign(this.st, o); if (typeof ENLACES.updateSyncUI === 'function') (0, ENLACES.updateSyncUI)(); },
  resolveMode() { return BACKEND.modo(APIH_CONFIG); },
  /* arranque: devuelve el estado inicial de la aplicación */
  async init() {
    this.mode = this.resolveMode();
    if (this.mode === 'demo') { this.setStatus({ state: 'demo', msg: 'Sin servidor · solo lectura' }); return seedState(); }
    try { await AuthService.init(); }
    catch (e) { this.setStatus({ state: 'error', msg: 'Autenticación', err: e.message }); return this.fallback(e.message); }
    if (AuthService.needsLogin) { this.setStatus({ state: 'auth', msg: 'Inicie sesión' }); return this.fallback('Inicie sesión para conectar con ' + backendName()); }
    return this.connect();
  },
  fallback(why) { this.mode = 'demo'; this.svc = null; this.snap = null; this.offlineWhy = why; return seedState(); },
  async connect() {
    this.mode = this.resolveMode();
    this.svc = newSvc();
    this.setStatus({ state: 'syncing', msg: 'Conectando con ' + backendName() + '…', err: '' });
    try {
      const t0 = performance.now(), S = await this.loadRemote();
      this.st.msLoad = Math.round(performance.now() - t0); this.fullAt = Date.now(); if (this.svc.stamp) { try { this.stampV = await this.svc.stamp(); } catch (e) { } }
      this.snap = this.snapshot(S); this.dirty = false; this.tries = 0;
      if (S.empty) { ['cfg'].forEach(k => this.snap.settings.delete(k)); this.dirty = true; setTimeout(() => this.commit(), 600); }   // base vacía: se guardan usuarios y parámetros iniciales
      this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), pending: 0 });
      this.startPoll();
      return S;
    } catch (e) {
      console.error(e);
      this.setStatus({ state: 'error', msg: 'Sin conexión a ' + backendName(), err: e.message });
      return this.fallback(e.message);
    }
  },
  async loadRemote() {
    const v = this.svc; v.edit = new Map();
    const [prjs, props, riesgos, hitos, decisiones, bitacora, comites, set, compromisos, cambios, notas, docs] = await Promise.all([v.getProjects(), v.getProposals(), v.getRisks(), v.getMilestones(), v.getDecisions(), v.getAudit(), v.getCommittees(), v.getSettings(), v.getCommitments().catch(e => { if (e.status === 404) return []; throw e; }), v.getChanges().catch(e => { if (e.status === 404) return []; throw e; }), v.getNotes().catch(e => { if (e.status === 404 || e.status === 403) return []; throw e; }), v.getDocs().catch(e => { if (e.status === 404 || e.status === 403) return []; throw e; })]);
    const df = await v.rpc('apih_defaults', {}).catch(() => ({}));   // valores por defecto de los parámetros de negocio: del servidor
    const cfg = Object.assign(defaultCfg(), df, set.cfg || {});
    LOCAL_CFG.forEach(k => { cfg[k] = (St && St.cfg && St.cfg[k]) || defaultCfg()[k]; });
    const [ctx, personas, calc, cielo, tr] = await Promise.all([v.contexto(), v.personas(), v.calculos(), v.rpc('apih_cielo', {}).catch(() => null), v.rpc('apih_trabajo', {}).catch(() => null)]);
    Object.assign(CALC, { hoy: '', senales: {}, trabajo: [], ini: {}, hitos: {}, riesgos: {}, cielo: null }, calc, { cielo }, tr || {});   // valores calculados: del servidor
    if (!ctx) {   // cuenta creada pero sin rol: queda pendiente hasta que Administra la habilite
      const a = await v.rpc('apih_solicitar_acceso', { p_nombre: null }).catch(() => null);
      PantallaAcceso.espera(a && a.estado === 'inactivo' ? 'inactivo' : 'pendiente', a && a.email);
      throw new Error('Tu cuenta espera que Administra te asigne un rol.');
    }
    PERM.ctx = ctx; PERM.edit = v.edit; FL.verComo = ctx.comoDe ? ctx.nombre : ''; cfg.usuario = ctx.nombre;   // identidad y permisos: del servidor
    bitacora.sort((a, b) => a.ts < b.ts ? 1 : -1);
    const ini = [...prjs, ...props];
    let S = { v: 3, cfg, ini, hitos, riesgos, decisiones, comites, bitacora, compromisos: compromisos || [], cambios: cambios || [], notas: notas || [], documentos: docs || [], pres: set.pres || [], ptpl: set.ptpl || [], ptema: set.ptema || {}, psnap: Object.fromEntries(Object.keys(set).filter(k => k.startsWith('psnap:')).map(k => [k.slice(6), set[k]])), usuarios: personas, eventos: set.eventos || [], cfgU: set.cfgU || {}, seq: set.seq || {} };
    S.empty = !ini.length && !hitos.length && !riesgos.length;
    return S;
  },
  /* firma por registro = JSON del registro (sirve para saber si algo cambió en el servidor) */
  snapshot(S) {
    const prev = St; ENLACES.St = S; const out = {};
    try {
      COLLS.forEach(ent => { const m = new Map(); (S[ESQUEMA[ent].coll] || []).filter(ESQUEMA[ent].filter || (() => true)).forEach(o => m.set(o.id, JSON.stringify(o))); out[ent] = m; });
      out.settings = new Map(); settingKeys(S).forEach(k => out.settings.set(k, JSON.stringify(this.settingValue(S, k))));
    } finally { ENLACES.St = prev; }
    return out;
  },
  settingValue(S, k) { if (k.startsWith('psnap:')) return S.psnap[k.slice(6)]; if (k === 'cfg') { const c = Object.assign({}, S.cfg); LOCAL_CFG.forEach(x => delete c[x]); return c; } return S[k]; },
  /* llamado por save(): programa un envío diferido */
  commit() {
    this.dirty = true; this.gen = (this.gen || 0) + 1;
    if (!this.svc || !this.snap) { if (typeof ENLACES.updateSyncUI === 'function') (0, ENLACES.updateSyncUI)(); return; }
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 500);
  },
  /* Cambios pendientes: SOLO ajustes de usuario (preferencias, presentaciones, eventos). Todo registro de negocio se escribe con comandos del servidor (cmdServidor);
     la API rechaza la escritura genérica de las listas de dominio. */
  diff() {
    const ops = [], S = St;
    settingKeys(S).forEach(k => { const sig = JSON.stringify(this.settingValue(S, k)); if (this.snap.settings.get(k) !== sig) ops.push({ t: 's', k, v: this.settingValue(S, k), sig }); });
    return ops;
  },
  async flush() {
    if (!this.svc || !this.snap) return;
    if (this.busy) { this.again = true; return; }
    const ops = this.diff(); this.setStatus({ pending: ops.length });
    if (!ops.length) { this.dirty = false; this.setStatus({ state: 'ok', msg: backendLabel() }); return; }
    this.busy = true; this.setStatus({ state: 'syncing', msg: 'Sincronizando ' + ops.length + ' cambio(s)…', err: '' });
    let fail = null, done = 0;
    for (const op of ops) {
      try { await this.svc.saveSetting(op.k, op.v); this.snap.settings.set(op.k, op.sig); done++; this.setStatus({ pending: ops.length - done }); }
      catch (e) { fail = fail || e; }
    }
    this.busy = false;
    if (fail) {
      this.tries++; this.setStatus({ state: 'error', msg: 'Error de sincronización', err: fail.message, pending: this.diff().length });
      if (this.tries === 1 && typeof ENLACES.toast === 'function') (0, ENLACES.toast)('No se pudo guardar en ' + backendName() + ': ' + fail.message, 'err');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), Math.min(60000, 5000 * this.tries));
    } else {
      this.tries = 0; this.dirty = false;
      this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), pending: 0 });
      if (this.again) { this.again = false; this.commit(); }
    }
  },
  /* relectura desde la API (manual o periódica). force = descarta cambios locales */
  async refresh(silent, force) {
    if (!this.svc || this.busy) return;
    if (!force && (this.dirty || (typeof ENLACES.Modal !== 'undefined' && ENLACES.Modal.cur))) return;
    try {
      /* V9: sondeo liviano. Si ninguna lista cambió y la última lectura completa fue hace < 10 min, no se relee nada. */
      if (silent && !force && this.svc.stamp) {
        let st = null; try { st = await this.svc.stamp(); } catch (e) { st = null; }
        if (st && st === this.stampV && Date.now() - (this.fullAt || 0) < 600000) { this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), err: '' }); return; }
        this._nextStamp = st;
      }
      const t0 = performance.now(), gen0 = this.gen || 0;
      const S = await this.loadRemote(); const snap = this.snapshot(S);
      /* si el usuario editó mientras se leía, no se pisa su trabajo con la lectura (salvo force) */
      if (!force && (this.dirty || this.busy || (this.gen || 0) !== gen0 || (typeof ENLACES.Modal !== 'undefined' && ENLACES.Modal.cur))) return;
      this.setStatus({ msLoad: Math.round(performance.now() - t0) }); this.fullAt = Date.now(); if (this.svc.stamp) { try { this.stampV = this._nextStamp || await this.svc.stamp(); } catch (e) { } this._nextStamp = null; }
      const same = COLLS.every(e => { const a = snap[e], b = this.snap[e]; return a.size === b.size && [...a].every(([k, s]) => b.get(k) === s); }) && settingKeys(S).every(k => snap.settings.get(k) === this.snap.settings.get(k));
      this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), err: '' });
      if (same && !force) return;
      ENLACES.St = S; this.snap = snap; this.dirty = false; ENLACES._alertCache = null; if (typeof ENLACES.shell === 'function') { (0, ENLACES.shell)(); } (0, ENLACES.render)();
      if (!silent) (0, ENLACES.toast)('Datos recargados desde ' + backendName());
    } catch (e) { this.setStatus({ state: 'error', msg: 'Error al leer ' + backendName(), err: e.message }); if (!silent) (0, ENLACES.toast)(e.message, 'err'); }
  },
  startPoll() {
    clearInterval(this.poll); const s = APIH_CONFIG.pollSec; if (s > 0) this.poll = setInterval(() => { if (document.visibilityState === 'visible') this.refresh(true); }, s * 1000);
  },
  async testConnection() {
    const t = newSvc(), out = [];
    await AuthService.init();
    for (const ent of [...COLLS, 'settings', 'roles']) {
      try { const n = (await t.listItems(ent)).length; out.push('✔ ' + t.listName(ent) + ': ' + n + ' registros'); }
      catch (e) { out.push('✘ ' + t.listName(ent) + ': ' + e.message); }
    }
    return out;
  }
};


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  AuthService: { get: () => AuthService, enumerable: true, configurable: true },
  DataService: { get: () => DataService, enumerable: true, configurable: true },
});

