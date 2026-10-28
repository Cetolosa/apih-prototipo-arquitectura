#!/usr/bin/env node
'use strict';
/* Backend de pruebas: Postgres temporal con las migraciones REALES + un transporte HTTP mínimo (subconjunto de PostgREST y GoTrue).
   Regla de diseño: el transporte NO contiene reglas de negocio. Solo traduce la petición a SQL y la ejecuta con el rol `authenticated`
   y los reclamos del token, de modo que RLS, disparadores y funciones apih_* deciden igual que en Supabase.
   Uso desde otras herramientas:  const b = await levantar(); ... b.manejar(req, res) ... await b.cerrar();
   Contraseña de todos los perfiles de prueba: CLAVE_PRUEBA. */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const net = require('net');
const { Pool } = require('pg');
const puertoLibre = () => new Promise(ok => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });

const RAIZ = path.join(__dirname, '..');
const SECRETO = 'secreto-solo-para-pruebas-locales-0123456789abcdef';
const CLAVE_PRUEBA = 'prueba-apih';
const COLS = new Set(['lista', 'id', 'datos', 'actualizado', 'area', 'modificado_por', 'puede_editar']);
const esRoot = typeof process.getuid === 'function' && process.getuid() === 0;

/* ---------- Postgres temporal ---------- */
function binarios() {
  if (process.env.PGBIN) return process.env.PGBIN;
  const base = '/usr/lib/postgresql';
  const v = fs.existsSync(base) ? fs.readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
  if (!v.length) throw new Error('No se encontró PostgreSQL (instala postgresql o define PGBIN)');
  return path.join(base, v[v.length - 1], 'bin');
}
function ejecutarPg(cmd) {   // initdb/pg_ctl no corren como root: se ejecutan como el usuario postgres
  const r = esRoot ? spawnSync('su', ['postgres', '-c', cmd], { encoding: 'utf8' }) : spawnSync('bash', ['-c', cmd], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Falló «' + cmd.slice(0, 80) + '»: ' + (r.stderr || r.stdout));
  return r.stdout;
}
async function sqlArchivo(cli, f) { await cli.query(fs.readFileSync(path.join(RAIZ, f), 'utf8')); }
const migraciones = () => fs.readdirSync(path.join(RAIZ, 'supabase', 'migrations')).filter(f => f.endsWith('.sql')).sort().map(f => 'supabase/migrations/' + f);

/* ---------- JWT HS256 (solo para pruebas) ---------- */
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
function firmar(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64(payload), s = crypto.createHmac('sha256', SECRETO).update(h + '.' + p).digest('base64url');
  return h + '.' + p + '.' + s;
}
function verificar(t) {
  const [h, p, s] = String(t || '').split('.'); if (!s) return null;
  const e = crypto.createHmac('sha256', SECRETO).update(h + '.' + p).digest('base64url'); if (e !== s) return null;
  try { const j = JSON.parse(Buffer.from(p, 'base64url').toString()); return j.exp && j.exp < Date.now() / 1000 ? null : j; } catch (e2) { return null; }
}
function sesion(email) {
  const ahora = Math.floor(Date.now() / 1000), base = { sub: crypto.createHash('md5').update(email).digest('hex'), email, role: 'authenticated', aud: 'authenticated' };
  return { access_token: firmar(Object.assign({}, base, { exp: ahora + 3600 })), refresh_token: firmar({ email, tipo: 'refresh', exp: ahora + 86400 }), expires_in: 3600, token_type: 'bearer', user: { email } };
}

/* ---------- errores al estilo PostgREST ---------- */
function errorPg(e) {
  const code = e.code || '', status = code === '42501' ? 403 : code === '23505' ? 409 : code === '23503' ? 409 : code === '22P02' || code === '22023' || code === '23514' ? 400 : 400;
  return { status, body: { code, message: e.message, details: e.detail || null, hint: e.hint || null } };
}

async function levantar(opc = {}) {
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'apih-pg-')), PORT = +(opc.puertoPg || process.env.PGPORT_PRUEBAS || await puertoLibre()), BIN = binarios();
  fs.chmodSync(D, 0o755); if (esRoot) ejecutarPg('true'), spawnSync('chown', ['postgres', D]);
  ejecutarPg(`${BIN}/initdb -D ${D}/data -U postgres -A trust >/dev/null`);
  ejecutarPg(`${BIN}/pg_ctl -D ${D}/data -o "-p ${PORT} -k ${D} -c listen_addresses=''" -l ${D}/log -w start >/dev/null`);
  const con = db => ({ host: D, port: PORT, user: 'postgres', database: db });
  const admin = new Pool(Object.assign(con('postgres'), { max: 2 })); admin.on('error', () => { });
  await admin.query('create database apih_base');
  { const c = new Pool(Object.assign(con('apih_base'), { max: 1 })); const cli = await c.connect();
    try { await sqlArchivo(cli, 'supabase/tests/00_shim_supabase.sql'); for (const f of migraciones()) await sqlArchivo(cli, f); await sqlArchivo(cli, 'supabase/seed.sql'); }
    finally { cli.release(); await c.end(); } }
  let pool = null;
  const B = { url: null, pool: () => pool };

  async function reiniciar() {
    if (pool) { await pool.end(); pool = null; }
    await admin.query('drop database if exists apih_t with (force)');
    await admin.query('create database apih_t template apih_base');
    pool = new Pool(Object.assign(con('apih_t'), { max: 8 })); pool.on('error', () => { });   // un cierre forzado de la base al reiniciar no debe tumbar el proceso
  }
  await reiniciar();

  /* Ejecuta fn dentro de una transacción con el rol y los reclamos del token (como PostgREST). */
  async function comoUsuario(claims, fn) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      await c.query('set local role ' + (claims ? 'authenticated' : 'anon'));
      const cl = JSON.stringify(claims || { role: 'anon' });
      await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim', $1, true)", [cl]);
      const r = await fn(c); await c.query('commit'); return r;
    } catch (e) { await c.query('rollback').catch(() => { }); throw e; } finally { c.release(); }
  }
  const sel = (q, def) => (q.get('select') || def).split(',').map(s => s.trim()).filter(c => COLS.has(c));
  const proy = cols => cols.map(c => c === 'actualizado' ? "(to_json(actualizado) #>> '{}') as actualizado" : c).join(', ');
  function filtros(q, ps) {
    const w = [];
    for (const [k, v] of q.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
      if (!COLS.has(k)) throw Object.assign(new Error('columna no permitida: ' + k), { code: '22023' });
      if (v.startsWith('eq.')) { ps.push(v.slice(3)); w.push(k === 'actualizado' ? `${k} = $${ps.length}::timestamptz` : `${k} = $${ps.length}`); }
      else if (v.startsWith('in.(')) { ps.push([...v.slice(4, -1).matchAll(/"([^"]*)"|([^,]+)/g)].map(m => m[1] !== undefined ? m[1] : m[2])); w.push(`${k} = any($${ps.length})`); }
      else throw Object.assign(new Error('filtro no soportado por el transporte de pruebas: ' + k + '=' + v), { code: '22023' });
    }
    return w.length ? ' where ' + w.join(' and ') : '';
  }
  const leerCuerpo = req => new Promise(ok => { let s = ''; req.on('data', d => s += d); req.on('end', () => ok(s)); });
  const json = (res, status, body, h = {}) => { res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, h)); res.end(body === undefined || body === null ? '' : JSON.stringify(body)); };

  /* ---- /rest/v1/rpc/<fn>: argumentos con nombre, tipados según la firma real ---- */
  async function rpc(c, fn, args) {
    if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw Object.assign(new Error('función inválida'), { code: '22023' });
    const claves = Object.keys(args || {});
    const { rows } = await c.query(`select p.oid, p.proargnames, p.proargtypes::oid[] as tipos, p.pronargs, p.proargmodes from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [fn]);
    const cand = rows.filter(r => claves.every(k => (r.proargnames || []).includes(k))).sort((a, b) => a.pronargs - b.pronargs)[0];
    if (!cand) throw Object.assign(new Error('Could not find the function public.' + fn + ' with those parameters'), { code: 'PGRST202' });
    const nombres = cand.proargnames, tipos = (await c.query('select unnest($1::oid[]) as t', [cand.tipos])).rows.map(r => r.t);
    const nt = (await c.query('select format_type(oid, null) as n, oid from pg_type where oid = any($1::oid[])', [cand.tipos])).rows, tn = {}; nt.forEach(r => { tn[r.oid] = r.n; });
    const ps = [], partes = [];
    claves.forEach(k => { const i = nombres.indexOf(k), t = tn[tipos[i]] || 'text'; let v = args[k]; if (v !== null && typeof v === 'object') v = JSON.stringify(v); ps.push(v === undefined ? null : v); partes.push(`${k} => $${ps.length}::${t}`); });
    const r = await c.query(`select public.${fn}(${partes.join(', ')}) as r`, ps);
    return r.rows[0].r;
  }

  async function rest(req, res, u) {
    const rel = u.pathname.slice('/rest/v1/'.length), m = req.method, q = u.searchParams, pref = String(req.headers.prefer || '');
    const t = String(req.headers.authorization || '').replace(/^Bearer /, ''), cl = verificar(t);
    if (!cl || cl.role !== 'authenticated') { if (!rel.startsWith('rpc/')) { /* anon: PostgREST aplicaría el rol anon; aquí cae por falta de permisos */ } }
    const claims = cl && cl.role === 'authenticated' ? cl : null;
    try {
      if (rel.startsWith('rpc/') && m === 'POST') {
        const args = JSON.parse((await leerCuerpo(req)) || '{}'), r = await comoUsuario(claims, c => rpc(c, rel.slice(4), args));
        return r === null || r === undefined ? json(res, 204, null) : json(res, 200, r);
      }
      if (rel === 'registros_v' && m === 'GET') {
        const ps = [], w = filtros(q, ps), cols = sel(q, 'lista,id,datos,actualizado'), ord = q.get('order') === 'actualizado.desc' ? 'actualizado desc' : 'id';
        const lim = Math.min(+q.get('limit') || 1000, 1000), off = +q.get('offset') || 0;
        const r = await comoUsuario(claims, async c => ({ rows: (await c.query(`select ${proy(cols)} from public.registros_v${w} order by ${ord} limit ${lim} offset ${off}`, ps)).rows, n: /count=exact/.test(pref) ? +(await c.query(`select count(*)::int n from public.registros_v${w}`, ps)).rows[0].n : null }));
        return json(res, 200, r.rows, r.n === null ? {} : { 'Content-Range': (r.rows.length ? `0-${r.rows.length - 1}` : '*') + '/' + r.n });
      }
      if (rel === 'registros' && m === 'POST') {
        const filas = JSON.parse((await leerCuerpo(req)) || '[]'), ignora = /ignore-duplicates/.test(pref), rep = /return=representation/.test(pref);
        if (/merge-duplicates/.test(pref)) return json(res, 403, { code: '42501', message: 'permission denied for table registros' });
        const cols = sel(q, 'lista,id'), r = await comoUsuario(claims, async c => {
          const out = [];
          for (const f of filas) {
            const x = await c.query(`insert into public.registros (lista, id, datos) values ($1, $2, $3)${ignora ? ' on conflict (lista, id) do nothing' : ''} returning ${proy(cols)}`, [f.lista, f.id, f.datos]);
            out.push(...x.rows);
          }
          return out;
        });
        return rep ? json(res, 201, r) : json(res, 204, null);
      }
      if (rel === 'registros' && m === 'PATCH') {
        const cuerpo = JSON.parse((await leerCuerpo(req)) || '{}'), ps = [cuerpo.datos], w = filtros(q, ps), rep = /return=representation/.test(pref), cols = sel(q, 'lista,id');
        const r = await comoUsuario(claims, async c => (await c.query(`update public.registros set datos = $1${w} returning ${proy(cols)}`, ps)).rows);
        return rep ? json(res, 200, r) : json(res, 204, null);
      }
      if (rel === 'registros' && m === 'DELETE') {
        const ps = [], w = filtros(q, ps); await comoUsuario(claims, c => c.query('delete from public.registros' + w, ps));
        return json(res, 204, null);
      }
      return json(res, 404, { code: 'PGRST125', message: 'ruta no soportada por el transporte de pruebas: ' + m + ' ' + rel });
    } catch (e) { const x = errorPg(e); return json(res, x.status, x.body); }
  }

  async function auth(req, res, u) {
    const cuerpo = JSON.parse((await leerCuerpo(req)) || '{}'), g = u.searchParams.get('grant_type');
    if (u.pathname === '/auth/v1/token' && g === 'password') {
      const email = String(cuerpo.email || '').toLowerCase(), ok = (await pool.query('select 1 from public.perfiles where email = $1 and activo', [email])).rowCount > 0;
      return ok && cuerpo.password === CLAVE_PRUEBA ? json(res, 200, sesion(email)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    if (u.pathname === '/auth/v1/token' && g === 'refresh_token') {
      const r = verificar(cuerpo.refresh_token); return r && r.tipo === 'refresh' ? json(res, 200, sesion(r.email)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
    }
    return json(res, 404, { error: 'no soportado por el transporte de pruebas: ' + u.pathname });
  }

  /* Rutas solo de pruebas (nunca forman parte de la aplicación) */
  async function pruebas(req, res, u) {
    if (u.pathname === '/__pruebas/reiniciar') { await reiniciar(); return json(res, 200, { ok: true }); }
    if (u.pathname === '/__pruebas/sql') { const { sql, params } = JSON.parse((await leerCuerpo(req)) || '{}'); try { const r = await pool.query(sql, params || []); return json(res, 200, { rows: r.rows }); } catch (e) { return json(res, 400, { error: e.message }); } }
    if (u.pathname === '/__pruebas/sesion') return json(res, 200, Object.assign(sesion(String(u.searchParams.get('email') || '').toLowerCase()), { exp: Math.floor(Date.now() / 1000) + 3600 }));
    return json(res, 404, { error: 'ruta de pruebas desconocida' });
  }

  B.maneja = req => /^\/(rest\/v1|auth\/v1|__pruebas)\//.test(req.url);
  B.manejar = async (req, res) => {
    const u = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', '*'); res.setHeader('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    try {
      if (u.pathname.startsWith('/rest/v1/')) return await rest(req, res, u);
      if (u.pathname.startsWith('/auth/v1/')) return await auth(req, res, u);
      return await pruebas(req, res, u);
    } catch (e) { return json(res, 500, { message: String(e.message || e) }); }
  };
  B.sql = (s, p) => pool.query(s, p);
  B.reiniciar = reiniciar;
  B.cerrar = async () => { try { if (pool) await pool.end(); await admin.end(); } catch (e) { } try { ejecutarPg(`${BIN}/pg_ctl -D ${D}/data -m immediate stop >/dev/null`); } catch (e) { } fs.rmSync(D, { recursive: true, force: true }); };
  B.CLAVE_PRUEBA = CLAVE_PRUEBA; B.sesion = sesion;
  return B;
}

module.exports = { levantar, CLAVE_PRUEBA };
if (require.main === module) levantar().then(async b => {   // humo: levanta, consulta y apaga
  const r = await b.sql('select count(*)::int n from public.perfiles'); console.log('Backend de pruebas OK · perfiles de seed:', r.rows[0].n); await b.cerrar();
}).catch(e => { console.error(e); process.exit(1); });
