/* =====================================================================
   TRANSPORTE · lo propio del ambiente (APIH Prototipo): Supabase (PostgREST + RPC) y acceso con contraseña propia.
   Es el único archivo de la SPA que difiere entre el Prototipo y el Corporativo (junto con 10b-acceso.js);
   el resto de js/ es idéntico y lo comprueba tools/paridad (ver docs/paridad.md).
   ===================================================================== */
import { APIH_CONFIG, St, _nrm, esAdminReal } from './01-nucleo.js';

export const BACKEND = {
  nombre: 'Supabase', etiqueta: 'Servidor seguro · acceso individual',
  modo: c => (c.auth.provider === 'supabase' && c.supabase && c.supabase.url && c.supabase.anonKey ? 'supabase' : 'demo'),
  nuevo: c => new SupabaseService(c),
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
    if (/type=signup/.test(location.hash)) {   // llegada desde el correo de confirmación de cuenta: la persona ya queda con sesión
      try {
        const q = new URLSearchParams(location.hash.slice(1)), tk = q.get('access_token'), rf = q.get('refresh_token'), pl = JSON.parse(atob(tk.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (tk && rf && tk.split('.').length === 3 && String(pl.email || '')) { SB.sess = { email: String(pl.email).toLowerCase(), access: tk, refresh: rf, exp: Math.floor(Date.now() / 1000) + (+q.get('expires_in') || 3600), _st: 's' }; SB.persist(); }
      } catch (e) { }
      history.replaceState(null, '', location.pathname + location.search);
    }
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
  async usuarios() { return (await this.rpc('apih_usuarios', {})) || []; }
  async personas() { return (await this.rpc('apih_personas', {})) || []; }
  async calculos() { return (await this.rpc('apih_calculos', {})) || { hoy: '', ini: {}, hitos: {}, riesgos: {}, hallazgos: [], puntajes: {}, evm: {}, sem: {}, cambios: {}, capacidad: null, personas: [], mision: {}, notif: null, resumen: null }; }
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

/* Nombres comunes con el Corporativo: la sesión y la pantalla de acceso (sus pantallas se completan en 10b-acceso.js) */
export const Sesion = SB;
export const PantallaAcceso = SBLogin;
