/* =====================================================================
   TRANSPORTE · lo propio del ambiente (APIH Prototipo): Supabase (PostgREST + RPC) y acceso con contraseña propia.
   Es el único archivo de la SPA que difiere entre el Prototipo y el Corporativo (junto con 10b-acceso.js);
   el resto de js/ es idéntico y lo comprueba tools/paridad (ver docs/paridad.md).
   ===================================================================== */
import { APIH_CONFIG, St, _nrm, esAdminReal } from './01-nucleo.js';

/* Esquema y mapeo de datos: los define 02-datos.js (común) y los entrega al cargar, con usarDatos() */
let ESQUEMA = {}, MapaDatos = null, DATOS_COL = null;
export function usarDatos(d) { ({ ESQUEMA, MapaDatos, DATOS_COL } = d); }

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

  /* Escritura: la configuración la valida y escribe el servidor (apih_guardar_ajuste, única vía); todo registro de negocio, sus comandos (cmdServidor).
     La SPA no escribe tablas: no hay altas, cambios ni bajas genéricas. */
  async _guardarAjuste(k, v) { await this.rpc('apih_guardar_ajuste', { p_clave: k, p_valor: v }); }

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
