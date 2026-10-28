import { ENLACES } from './00-registro.js';
import { APIH_CONFIG, BIT_TIPOS, DEC_TIPOS, ESTADOS_PRJ, ESTADOS_PROP, CALC, FL, PERM, RAGS, RISK_ESTADOS, St, _nrm, defaultCfg, diffD, esAdminReal, esProp, hitoEstado, hoy, roi, seedState } from './01-nucleo.js';
/* =====================================================================
   CAPA DE DATOS · DataService · SupabaseService · AuthService
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
  fieldsOf(ent, o) {
    const S = ESQUEMA[ent], f = {};
    S.cols.forEach(c => {
      let v = c.get ? c.get(o) : o[c.k];
      if (c.t === 'Date') v = v ? String(v).slice(0, 10) + 'T12:00:00Z' : null;
      else if (c.t === 'Number') v = v == null || v === '' || isNaN(+v) ? null : +v;
      else if (c.t === 'Text' || c.t === 'Choice') v = v == null ? '' : String(v).slice(0, 255);
      else if (c.t === 'Note') v = v == null ? '' : String(v);
      f[c.n] = v;
    });
    f[DATOS_COL.n] = JSON.stringify(o);
    return f;
  },
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
   4. DataService · carga, diff y sincronización con Supabase
   --------------------------------------------------------------------- */
const COLLS = Object.keys(ESQUEMA);   // projects, risks, milestones, decisions, audit, committees
const backendName = () => 'Supabase';
const backendLabel = () => 'Servidor seguro · acceso individual';
const newSvc = () => new SupabaseService(APIH_CONFIG);
export const DataService = {
  mode: 'demo', svc: null, snap: null, timer: null, poll: null, busy: false, again: false, dirty: false, tries: 0,
  st: { state: 'demo', msg: 'Modo demo', last: null, pending: 0, err: '' },
  setStatus(o) { Object.assign(this.st, o); if (typeof ENLACES.updateSyncUI === 'function') (0, ENLACES.updateSyncUI)(); },
  resolveMode() { const c = APIH_CONFIG; return c.auth.provider === 'supabase' && c.supabase.url && c.supabase.anonKey ? 'supabase' : 'demo'; },
  /* arranque: devuelve el estado inicial de la aplicación */
  async init() {
    this.mode = this.resolveMode();
    if (this.mode === 'demo') { this.setStatus({ state: 'demo', msg: 'Modo demo · datos en memoria' }); return seedState(); }
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
      const t0 = performance.now(), S = await this.loadRemote(), raw = S._raw; delete S._raw;
      this.st.msLoad = Math.round(performance.now() - t0); this.fullAt = Date.now(); if (this.svc.stamp) { try { this.stampV = await this.svc.stamp(); } catch (e) { } }
      this.snap = this.snapshot(raw || S); this.dirty = false; this.tries = 0;
      if (S.empty) { ['cfg'].forEach(k => this.snap.settings.delete(k)); this.dirty = true; setTimeout(() => this.commit(), 600); }   // base vacía: se guardan usuarios y parámetros iniciales
      this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), pending: 0 });
      this.startPoll();
      if (raw) { this.dirty = true; setTimeout(() => { this.commit(); if (typeof ENLACES.toast === 'function') (0, ENLACES.toast)('Datos migrados al modelo V5 (Propuestas / Proyectos); sincronizando…'); }, 800); }
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
    const seed = seedState(), cfg = Object.assign(defaultCfg(), set.cfg || {});
    LOCAL_CFG.forEach(k => { cfg[k] = (St && St.cfg && St.cfg[k]) || defaultCfg()[k]; });
    const [ctx, personas, calc] = await Promise.all([v.contexto(), v.personas(), v.calculos()]);
    Object.assign(CALC, { hoy: '', ini: {}, hitos: {}, riesgos: {} }, calc);   // valores calculados: del servidor
    if (!ctx) throw new Error('Tu correo no tiene perfil activo en APIH. Pide acceso al administrador.');
    PERM.ctx = ctx; PERM.edit = v.edit; FL.verComo = ctx.comoDe ? ctx.nombre : ''; cfg.usuario = ctx.nombre;   // identidad y permisos: del servidor
    bitacora.sort((a, b) => a.ts < b.ts ? 1 : -1);
    const ini = [...prjs, ...props];
    let S = { v: 3, cfg, ini, hitos, riesgos, decisiones, comites, bitacora, compromisos: compromisos || [], cambios: cambios || [], notas: notas || [], documentos: docs || [], pres: set.pres || [], ptpl: set.ptpl || [], ptema: set.ptema || {}, psnap: Object.fromEntries(Object.keys(set).filter(k => k.startsWith('psnap:')).map(k => [k.slice(6), set[k]])), usuarios: personas, eventos: set.eventos || [], cfgU: set.cfgU || {}, seq: set.seq || {} };
    S.empty = !ini.length && !hitos.length && !riesgos.length;
    if (ini.some(i => !i.tipo)) { const raw = JSON.parse(JSON.stringify(S)); S = (0, ENLACES.migrateV5)(S); S._raw = raw; }   // datos de versiones anteriores
    return S;
  },
  /* firma por registro = JSON de los campos resultantes (incluye columnas derivadas) */
  snapshot(S) {
    const prev = St; ENLACES.St = S; const out = {};
    try {
      COLLS.forEach(ent => { const m = new Map(); (S[ESQUEMA[ent].coll] || []).filter(ESQUEMA[ent].filter || (() => true)).forEach(o => m.set(o.id, JSON.stringify(MapaDatos.fieldsOf(ent, o)))); out[ent] = m; });
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
  diff() {
    const ops = []; const S = St;
    COLLS.forEach(ent => {
      const arr = (S[ESQUEMA[ent].coll] || []).filter(ESQUEMA[ent].filter || (() => true)), prev = this.snap[ent], seen = new Set();
      arr.forEach(o => { seen.add(o.id); const sig = JSON.stringify(MapaDatos.fieldsOf(ent, o)); if (this.bad && this.bad.has(ent + ':' + o.id + ':' + sig)) return; if (!prev.has(o.id)) ops.push({ t: 'c', ent, o, sig }); else if (prev.get(o.id) !== sig) ops.push({ t: 'u', ent, o, sig }); });
      prev.forEach((sig, id) => { if (!seen.has(id)) ops.push({ t: 'd', ent, id }); });
    });
    settingKeys(S).forEach(k => { const sig = JSON.stringify(this.settingValue(S, k)); if (this.snap.settings.get(k) !== sig) ops.push({ t: 's', k, v: this.settingValue(S, k), sig }); });
    return ops;
  },
  async flush() {
    if (!this.svc || !this.snap) return;
    if (this.busy) { this.again = true; return; }
    const ops = this.diff(); this.setStatus({ pending: ops.length });
    if (!ops.length) { this.dirty = false; this.setStatus({ state: 'ok', msg: backendLabel() }); return; }
    this.busy = true; this.setStatus({ state: 'syncing', msg: 'Sincronizando ' + ops.length + ' cambio(s)…', err: '' });
    const v = this.svc; let fail = null, done = 0;
    const run = async op => {
      try {
        if (op.t === 'c') { await v._create(op.ent, op.o); this.snap[op.ent].set(op.o.id, op.sig); }
        else if (op.t === 'u') { await v._update(op.ent, op.o); this.snap[op.ent].set(op.o.id, op.sig); }
        else if (op.t === 'd') { await v._delete(op.ent, op.id); this.snap[op.ent].delete(op.id); }
        else { await v.saveSetting(op.k, op.v); this.snap.settings.set(op.k, op.sig); }
        done++; this.setStatus({ pending: ops.length - done });
      } catch (e) { fail = fail || e; }
    };
    const t0 = performance.now();
    const gr = !!v.batchOps, bat = gr ? ops.filter(o => o.t !== 's') : [], q = (gr ? ops.filter(o => o.t === 's') : ops).slice();
    const chunks = []; for (let i = 0; i < bat.length; i += 20) chunks.push(bat.slice(i, i + 20));
    const batchWorker = async () => {
      while (chunks.length) {
        const ch = chunks.shift();
        try {
          const rs = await v.batchOps(ch);
          ch.forEach((op, i) => {
            if (!rs[i].ok && rs[i].conflict) { (this.conf = this.conf || []).push({ ent: op.ent, id: op.o.id, datos: JSON.parse(JSON.stringify(op.o)) }); return; }
            if (!rs[i].ok) { if (rs[i].perm && op.t !== 'd') { (this.bad = this.bad || new Set()).add(op.ent + ':' + op.o.id + ':' + op.sig); (this.badMsg = this.badMsg || []).push(op.ent + ' ' + op.o.id + ': ' + rs[i].err); return; } fail = fail || new Error(rs[i].err); return; }
            if (op.t === 'd') this.snap[op.ent].delete(op.id); else this.snap[op.ent].set(op.o.id, op.sig);
            done++;
          });
          this.setStatus({ pending: ops.length - done });
        } catch (e) { fail = fail || e; }
      }
    };
    const workers = [...Array.from({ length: 4 }, async () => { while (q.length) await run(q.shift()); }), ...(gr ? [batchWorker(), batchWorker()] : [])];
    await Promise.all(workers);
    this.setStatus({ msSave: Math.round(performance.now() - t0) });
    this.busy = false;
    if (this.conf && this.conf.length) {
      const L = this.conf; this.conf = []; this.busy = false; this.dirty = !!fail;   // S-02: si además hubo fallo de red, conservar los cambios pendientes
      const ids = L.map(x => x.id).join(', ');
      const bajar = confirm('Otra persona modificó mientras tanto: ' + ids + '.\n\nTus cambios en esos registros NO se guardaron para no pisar los suyos. Se cargarán los datos actuales.\n\n¿Descargar tus cambios no guardados (archivo JSON) para volver a aplicarlos?');
      if (bajar) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(L, null, 1)], { type: 'application/json' })); a.download = 'apih_cambios_no_guardados_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '') + '.json'; document.body.appendChild(a); a.click(); a.remove(); }
      if (fail) { this.tries++; this.setStatus({ state: 'error', msg: 'Error de sincronización', err: fail.message, pending: this.diff().length }); clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), Math.min(60000, 5000 * this.tries)); return; }   // no recargar: se perderían las ediciones pendientes
      await this.refresh(false, true); return;
    }
    if (this.badMsg && this.badMsg.length) { const n = this.badMsg.length; console.warn('APIH: registros rechazados por el servidor', this.badMsg); this.badMsg = []; if (typeof ENLACES.toast === 'function') (0, ENLACES.toast)(n + ' registro(s) fueron rechazados por el servidor y no se guardaron (revisa tus datos o recarga la página). El resto sí se guardó.', 'err'); }
    if (fail) {
      this.tries++; this.setStatus({ state: 'error', msg: 'Error de sincronización', err: fail.message, pending: this.diff().length });
      if (this.tries === 1 && typeof ENLACES.toast === 'function') (0, ENLACES.toast)('No se pudo guardar en ' + backendName() + ': ' + fail.message, 'err');
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), Math.min(60000, 5000 * this.tries));
    } else {
      this.tries = 0; this.dirty = false;
      await this.recalcular();   // los valores calculados los entrega el servidor tras cada escritura
      this.setStatus({ state: 'ok', msg: backendLabel(), last: new Date(), pending: 0 });
      if (this.again) { this.again = false; this.commit(); }
    }
  },
  /* pide al servidor los valores calculados y repinta solo si cambiaron */
  async recalcular() {
    if (!this.svc) return;
    try {
      const c = await this.svc.calculos(), antes = JSON.stringify(CALC);
      Object.assign(CALC, { hoy: '', ini: {}, hitos: {}, riesgos: {} }, c);
      if (JSON.stringify(CALC) !== antes) { ENLACES._alertCache = null; if (typeof ENLACES.render === 'function') (0, ENLACES.render)(); }
    } catch (e) { console.warn('APIH: no se pudieron leer los valores calculados', e); }
  },
  /* relectura desde Supabase (manual o periódica). force = descarta cambios locales */
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
      const S = await this.loadRemote(); if (S._raw) return; const snap = this.snapshot(S);
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
  /* carga el estado de demostración en las listas vacías */
  async seedRemote() {
    if (!this.svc) throw new Error('Sin conexión a Supabase');
    const keepUser = St.cfg.usuario; ENLACES.St = seedState(); St.cfg.usuario = keepUser;
    this.snap = {}; COLLS.forEach(e => this.snap[e] = new Map()); this.snap.settings = new Map();
    this.dirty = true; await this.flush();
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


/* ==========================================================================
   Proveedor Supabase · acceso individual (correo corporativo + contraseña propia) y tabla `registros(lista, id, datos)`.
   `datos` = 'p1.' + JSON en texto. La autorización se hace cumplir en el servidor (RLS, disparador y comandos RPC).
   ========================================================================== */
export const SB = {
  KEY: 'APIH_SB', sess: null,
  restore() {
    for (const st of [sessionStorage, localStorage]) { try { const j = st.getItem(SB.KEY); if (j) { SB.sess = JSON.parse(j); SB.sess._st = st === localStorage ? 'l' : 's'; return; } } catch (e) { } }
  },
  persist() { if (!SB.sess) return; const { _st, ...s } = SB.sess; try { (_st === 'l' ? localStorage : sessionStorage).setItem(SB.KEY, JSON.stringify(s)); } catch (e) { } },
  clear() { SB.sess = null; try { sessionStorage.removeItem(SB.KEY); localStorage.removeItem(SB.KEY); } catch (e) { } },
  get cfg() { return APIH_CONFIG.supabase || {}; },
  async _auth(grant, body) {
    const r = await fetch(SB.cfg.url + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: SB.cfg.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status)); e.status = r.status; e.code = j.error_code || j.error; throw e; }
    return j;
  },
  async token() {
    if (!SB.sess) throw new Error('Sesión no iniciada');
    if (SB.sess.exp - 60 < Date.now() / 1000) await SB.refrescar();
    return SB.sess.access;
  },
  /* una sola renovación a la vez: el refresh token rota y dos llamadas simultáneas invalidarían la sesión */
  refrescar() {
    if (SB._rp) return SB._rp;
    SB._rp = (async () => {
      try { const j = await SB._auth('refresh_token', { refresh_token: SB.sess.refresh }); SB.sess.access = j.access_token; SB.sess.refresh = j.refresh_token || SB.sess.refresh; SB.sess.exp = Math.floor(Date.now() / 1000) + (j.expires_in || 3600); SB.persist(); }
      catch (e) { if (e.status === 400 || e.status === 401 || e.status === 403) { SB.clear(); SBLogin.show('Tu sesión expiró. Ingresa nuevamente.'); throw new Error('Sesión expirada'); } throw new Error('Sin conexión para renovar la sesión'); }
      finally { SB._rp = null; }
    })();
    return SB._rp;
  },
  logout() { SB.clear(); }
};

export const SBLogin = {};

/* ---- AuthService · Supabase Auth (correo corporativo + contraseña propia) ---- */
export const AuthService = {
  get cfg() { return APIH_CONFIG.auth; },
  get provider() { return this.cfg.provider || 'none'; },
  get needsLogin() { return this.provider === 'supabase' && !SB.sess; },
  user() {
    if (this.provider !== 'supabase' || !SB.sess) return null;
    const e = SB.sess.email;
    return { name: e.split('@')[0].split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '), email: e };
  },
  async init() {
    if (this.provider !== 'supabase') return;
    if (!(SB.cfg.url && SB.cfg.anonKey)) throw new Error('supabase.url / supabase.anonKey vacíos');
    if (/type=recovery/.test(location.hash)) SB.clear(); else SB.restore();
    if (!SB.sess) SBLogin.show();
  },
  getToken() { return this.provider === 'supabase' ? SB.token() : null; },
  async login() { SBLogin.show(); throw new Error('Ingresa tus datos en la ventana de acceso'); },
  async logout() { SB.logout(); }
};

/* ---- Servicio de datos ---- */
export class SupabaseService {
  constructor(cfg) {
    this.cfg = cfg;
    this.ids = {};                       // ent -> { id: id del registro }
    Object.keys(ESQUEMA).forEach(e => this.ids[e] = {}); this.ids.settings = {}; this.ids.roles = {};
  }
  get mode() { return 'supabase'; }
  get sb() { return this.cfg.supabase; }
  listName(ent) { return ent === 'settings' ? this.cfg.settingsList : ent === 'roles' ? (this.cfg.rolesList || 'APIH_Roles') : this.cfg[ESQUEMA[ent].cfg]; }
  /* --- API de dominio (lectura) --- */
  async _read(ent) {
    const items = await this.listItems(ent), idc = ESQUEMA[ent].cols.find(c => c.k === 'id');
    this.ids[ent] = {};
    return items.map(it => { const o = MapaDatos.objOf(ent, it.f); this.ids[ent][o.id] = it.spid; return o; })
      .filter(o => o.id || ent === 'committees');
  }
  getProjects() { return this._read('projects'); }
  async getProject(id) {
    return (await this.getProjects()).find(p => p.id === id) || null;
  }
  getProposals() { return this._read('proposals'); }
  getRisks() { return this._read('risks'); }
  getMilestones() { return this._read('milestones'); }
  getDecisions() { return this._read('decisions'); }
  getCommitments() { return this._read('commitments'); }
  getChanges() { return this._read('changes'); }
  getNotes() { return this._read('notes'); }
  getDocs() { return this._read('docs'); }
  getAudit() { return this._read('audit'); }
  getCommittees() { return this._read('committees'); }
  async _leerAjustes() {
    const items = await this.listItems('settings'), out = {}; this.ids.settings = {}; this.ids.roles = {};
    const raw = {}; items.forEach(it => { const k = it.f.Title; if (!k) return; this.ids.settings[k] = it.spid; raw[k] = it.f[DATOS_COL.n]; });
    Object.keys(raw).forEach(k => { if (/#\d+$/.test(k)) return; try { let v = JSON.parse(raw[k]); if (v && v.__chunks) { let s = ''; for (let n = 1; n <= v.__chunks; n++) s += raw[k + '#' + n] || ''; v = JSON.parse(s); } out[k] = v; } catch (e) { } });
    return out;
  }

  /* --- API de dominio (escritura) --- */
  async _create(ent, o) { const spid = await this.createItem(ent, MapaDatos.fieldsOf(ent, o)); this.ids[ent][o.id] = spid; return spid; }
  async _update(ent, o) { const spid = this.ids[ent][o.id]; if (!spid) return this._create(ent, o); await this.updateItem(ent, spid, MapaDatos.fieldsOf(ent, o)); return spid; }
  async _delete(ent, id) { const spid = this.ids[ent][id]; if (!spid) return; await this.deleteItem(ent, spid); delete this.ids[ent][id]; }
  createProject(p) { return this._create('projects', p); }
  updateProject(p) { return this._update('projects', p); }
  deleteProject(id) { return this._delete('projects', id); }
  createProposal(p) { return this._create('proposals', p); }
  updateProposal(p) { return this._update('proposals', p); }
  deleteProposal(id) { return this._delete('proposals', id); }
  createRisk(r) { return this._create('risks', r); }
  updateRisk(r) { return this._update('risks', r); }
  deleteRisk(id) { return this._delete('risks', id); }
  createMilestone(h) { return this._create('milestones', h); }
  updateMilestone(h) { return this._update('milestones', h); }
  deleteMilestone(id) { return this._delete('milestones', id); }
  createDecision(d) { return this._create('decisions', d); }
  updateDecision(d) { return this._update('decisions', d); }
  deleteDecision(id) { return this._delete('decisions', id); }
  createAudit(b) { return this._create('audit', b); }
  updateAudit(b) { return this._update('audit', b); }
  deleteAudit(id) { return this._delete('audit', id); }
  async _guardarAjuste(k, v) {
    const ent = k === 'usuarios' ? 'roles' : 'settings';   // los roles viven en su propia lista (permisos exclusivos del administrador)
    const put = async (key, txt) => { const f = { Title: key, [DATOS_COL.n]: txt }; if (this.ids[ent][key]) await this.updateItem(ent, this.ids[ent][key], f); else this.ids[ent][key] = await this.createItem(ent, f); };
    const js = JSON.stringify(v), MAX = 50000;
    if (js.length <= MAX) { await put(k, js); return; }
    const n = Math.ceil(js.length / MAX); for (let i = 1; i <= n; i++) await put(k + '#' + i, js.slice((i - 1) * MAX, i * MAX));
    await put(k, JSON.stringify({ __chunks: n }));
  }

  _idCol(ent) { return ent === 'settings' || ent === 'roles' ? 'Title' : ESQUEMA[ent].key; }
  async _rest(path, opt = {}, tries = 3) {
    const mk = async () => Object.assign({ apikey: this.sb.anonKey, Authorization: 'Bearer ' + await SB.token(), 'Content-Type': 'application/json' }, opt.headers || {});
    let h = await mk(), res, ref = false;
    for (let n = 0; n < tries; n++) {
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 30000);
      try { res = await fetch(this.sb.url + '/rest/v1/' + path, { method: opt.method || 'GET', headers: h, body: opt.body, signal: ac.signal }); }
      catch (e) { clearTimeout(to); if (n < tries - 1) { await new Promise(r => setTimeout(r, 800 * (n + 1))); continue; } throw new Error(e.name === 'AbortError' ? 'El servidor tardó demasiado en responder' : 'Sin conexión con el servidor'); }
      clearTimeout(to);
      if (res.status === 401 && !ref) { ref = true; try { await SB.refrescar(); h = await mk(); n--; continue; } catch (e) { throw e; } }
      if ([429, 502, 503, 504].includes(res.status)) { await new Promise(r => setTimeout(r, 800 * (n + 1))); continue; }
      break;
    }
    if (!res.ok) { let m = '', campo = ''; try { const j = await res.json(); m = j.message || j.hint || ''; campo = (j.message && j.hint) || ''; } catch (e) { } const err = new Error('HTTP ' + res.status + (m ? ' · ' + m : '')); err.status = res.status; if (/^APIH:/.test(m)) { err.detalle = m.replace(/^APIH:\s*/, ''); if (campo) err.campo = campo; } if ((res.status === 401 || res.status === 403) && !err.detalle) err.message = 'Sin permiso para esta acción en el servidor (' + res.status + ')'; throw err; }
    if (res.status === 204) return { data: null, res };
    const t = await res.text(); return { data: t ? JSON.parse(t) : null, res };
  }
  /* Permisos y directorio: los entrega el servidor (apih_contexto / apih_personas); la interfaz solo los lee */
  async contexto() { return (await this.rpc('apih_contexto', {})) || null; }
  async personas() { return (await this.rpc('apih_personas', {})) || []; }
  async calculos() { return (await this.rpc('apih_calculos', {})) || { hoy: '', ini: {}, hitos: {}, riesgos: {} }; }
  async verComo(correo) { return await this.rpc('apih_ver_como', { p_email: correo || null }); }
  async listItems(ent) {
    const l = encodeURIComponent(this.listName(ent)), idc = this._idCol(ent), out = [], PAGE = 1000;
    for (let off = 0; ; off += PAGE) {
      const { data } = await this._rest('registros_v?select=id,datos,actualizado,puede_editar&lista=eq.' + l + '&order=id&limit=' + PAGE + '&offset=' + off);
      for (const r of data || []) {
        let txt;
        if (String(r.datos).startsWith('p1.')) txt = r.datos.slice(3);
        else throw new Error('«' + r.id + '» tiene un formato antiguo (cifrado) y no se puede leer. Avisa al administrador.');
        (this.ver = this.ver || {})[ent + ':' + r.id] = r.actualizado || null; (this.edit = this.edit || new Map()).set(r.id, !!r.puede_editar);
        out.push({ spid: r.id, f: { [idc]: r.id, [DATOS_COL.n]: txt } });
      }
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  async _row(ent, fields) { const idc = this._idCol(ent), id = String(fields[idc] || ''); if (!id) throw new Error('Registro sin identificador (' + ent + ')'); return { lista: this.listName(ent), id, datos: 'p1.' + (fields[DATOS_COL.n] || '') }; }   // texto plano; la protección es el RLS del servidor
  /* Alta o actualización sin ON CONFLICT DO UPDATE: ese modo exige SELECT sobre la columna `datos`, que el rol de la API no tiene (los montos se leen solo por registros_v).
     Se insertan las filas nuevas en bloque (ignorando las existentes) y las que ya existían se actualizan una a una. */
  async _upsert(rows) {
    if (!rows.length) return;
    const { data } = await this._rest('registros?on_conflict=lista,id&select=lista,id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify(rows) });
    const nuevas = new Set((data || []).map(r => r.lista + '\u0001' + r.id)), q = rows.filter(r => !nuevas.has(r.lista + '\u0001' + r.id));
    await Promise.all(Array.from({ length: Math.min(4, q.length) }, async () => { while (q.length) { const r = q.shift(); await this._rest('registros?lista=eq.' + encodeURIComponent(r.lista) + '&id=eq.' + encodeURIComponent(r.id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ datos: r.datos }) }); } }));
  }
  async createItem(ent, fields) { const r = await this._row(ent, fields); await this._upsert([r]); return r.id; }
  async updateItem(ent, spid, fields) { const r = await this._row(ent, fields); await this._upsert([r]); }
  async deleteItem(ent, spid) { await this._rest('registros?lista=eq.' + encodeURIComponent(this.listName(ent)) + '&id=eq.' + encodeURIComponent(spid), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); }
  async batchOps(ops) {
    const out = ops.map(() => ({ ok: true, err: '' })), up = [], upI = [], del = {}, cond = [], alt = [];
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.t === 'd') { (del[op.ent] = del[op.ent] || []).push([i, op.id]); }
      else if (op.t === 'u' && this.ver && this.ver[op.ent + ':' + op.o.id]) { cond.push(i); }
      else if (op.t === 'c') { alt.push(i); }
      else { up.push(await this._row(op.ent, MapaDatos.fieldsOf(op.ent, op.o))); upI.push(i); }
    }
    /* V22.34: detección de conflictos. Una actualización solo se aplica si el registro sigue con la versión que se leyó; un alta no pisa un id ya usado. */
    const unoAUno = async (lst, fn) => { const q = lst.slice(); await Promise.all(Array.from({ length: Math.min(4, q.length) }, async () => { while (q.length) { const i = q.shift(); try { await fn(i); } catch (e) { out[i] = e.conflict ? { ok: false, conflict: true, err: e.message } : { ok: false, err: e.message, perm: e.status >= 400 && e.status < 500 && ![401, 403, 408, 429].includes(e.status) }; } } })); };
    await unoAUno(cond, async i => {
      const op = ops[i], k = op.ent + ':' + op.o.id, row = await this._row(op.ent, MapaDatos.fieldsOf(op.ent, op.o));
      const { data } = await this._rest('registros?lista=eq.' + encodeURIComponent(row.lista) + '&id=eq.' + encodeURIComponent(row.id) + '&actualizado=eq.' + encodeURIComponent(this.ver[k]) + '&select=actualizado', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ datos: row.datos }) });
      if (!data || !data.length) { const e = new Error('«' + op.o.id + '» fue modificado por otra persona'); e.conflict = true; throw e; }
      this.ver[k] = data[0].actualizado || null; this.ids[op.ent][op.o.id] = op.o.id;
    });
    await unoAUno(alt, async i => {
      const op = ops[i], k = op.ent + ':' + op.o.id, row = await this._row(op.ent, MapaDatos.fieldsOf(op.ent, op.o));
      try { const { data } = await this._rest('registros?select=actualizado', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([row]) }); this.ver = this.ver || {}; this.ver[k] = (data && data[0] && data[0].actualizado) || null; this.ids[op.ent][op.o.id] = op.o.id; }
      catch (e) { if (e.status === 409) { const c = new Error('El id «' + op.o.id + '» ya fue usado por otra persona'); c.conflict = true; throw c; } throw e; }
    });
    if (up.length) {
      try { await this._upsert(up); upI.forEach(i => { this.ids[ops[i].ent][ops[i].o.id] = ops[i].o.id; }); }
      catch (e) {
        if (e.status >= 400 && e.status < 500 && ![401, 403, 408, 429].includes(e.status) && up.length > 1) {
          /* un registro inválido no debe bloquear al resto: se reintenta fila por fila */
          for (let k = 0; k < up.length; k++) { const i = upI[k]; try { await this._upsert([up[k]]); this.ids[ops[i].ent][ops[i].o.id] = ops[i].o.id; } catch (e2) { out[i] = { ok: false, err: e2.message, perm: e2.status >= 400 && e2.status < 500 && ![401, 403, 408, 429].includes(e2.status) }; } }
        } else upI.forEach(i => { out[i] = { ok: false, err: e.message, perm: e.status >= 400 && e.status < 500 && ![401, 403, 408, 429].includes(e.status) && up.length === 1 }; });
      }
    }
    for (const ent of Object.keys(del)) {
      const ids = del[ent].map(x => '"' + String(x[1]).replace(/"/g, '') + '"').join(',');
      try { await this._rest('registros?lista=eq.' + encodeURIComponent(this.listName(ent)) + '&id=in.(' + encodeURIComponent(ids) + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); del[ent].forEach(x => { delete this.ids[ent][x[1]]; }); }
      catch (e) { del[ent].forEach(x => { out[x[0]] = { ok: false, err: e.message }; }); }
    }
    return out;
  }
  async stamp() {
    const { data, res } = await this._rest('registros_v?select=actualizado&order=actualizado.desc&limit=1', { headers: { Prefer: 'count=exact' } });
    const cr = res.headers.get('Content-Range') || '', n = cr.split('/')[1] || '?';
    return ((data && data[0] && data[0].actualizado) || '0') + '|' + n;
  }
  /* Comandos del servidor (funciones RPC): la lógica transaccional vive en la base, no en el navegador */
  async rpc(nombre, args) { const { data } = await this._rest('rpc/' + nombre, { method: 'POST', body: JSON.stringify(args || {}) }); return data; }
  /* Configuración por alcance: cada persona guarda sus preferencias en su propio registro «cfgU:<correo>» (el servidor solo deja escribirlo a su dueño o al admin). */
  _emailPropio() { const u = typeof AuthService !== 'undefined' && AuthService.user && AuthService.user(); return _nrm(u && (u.email || u.username)); }
  _cfgUKey(nombre) {
    const u = (typeof St !== 'undefined' && St && St.usuarios || []).find(x => _nrm(x.n) === _nrm(nombre)), mio = this._emailPropio();
    const correo = _nrm(u && u.correo) || (typeof St !== 'undefined' && St && St.cfg && _nrm(St.cfg.usuario) === _nrm(nombre) ? mio : '');
    return 'cfgU:' + (correo || '~' + _nrm(nombre));
  }
  async getSettings() {
    const out = await this._leerAjustes(), m = Object.assign({}, out.cfgU || {}); this._cfgUsig = {};
    Object.keys(out).forEach(k => { if (!k.startsWith('cfgU:')) return; const r = out[k]; delete out[k]; if (r && r.n) { m[r.n] = r.v; this._cfgUsig[r.n] = JSON.stringify(r.v); } });
    out.cfgU = m; return out;
  }
  async saveSetting(k, v) {
    if (k !== 'cfgU') return this._guardarAjuste(k, v);
    const mio = 'cfgU:' + this._emailPropio();
    for (const [nombre, val] of Object.entries(v || {})) {
      const sig = JSON.stringify(val); if ((this._cfgUsig || {})[nombre] === sig) continue;
      const key = this._cfgUKey(nombre); if (key !== mio && !esAdminReal()) continue;   // la preferencia de otra persona solo la escribe el admin
      await this._guardarAjuste(key, { n: nombre, v: val }); (this._cfgUsig = this._cfgUsig || {})[nombre] = sig;
    }
  }
}


// Enlaces para módulos anteriores (ver 00-registro.js)
Object.defineProperties(ENLACES, {
  AuthService: { get: () => AuthService, enumerable: true, configurable: true },
  DataService: { get: () => DataService, enumerable: true, configurable: true },
});
