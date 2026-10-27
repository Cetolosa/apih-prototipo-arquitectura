// C2.8 · Motor de notificaciones (packages/core/notif-motor.js) ≡ campana del Prototipo (V22.54, solo lectura).
// Requiere: prototipo en http://localhost:8765/demo/index.html (ver README). Compara notifPara(usuario) del navegador con el motor en Node
// para varios usuarios y fechas, con datos que disparan los 15 tipos de aviso.
const { chromium, launchOpts } = require('./_pw');
const fs = require('fs'), path = require('path'), assert = require('assert');
const raiz = path.join(__dirname, '..', '..');
const G = require(path.join(raiz, 'tools', 'generar-motor-notif.js'));
const M = require(path.join(raiz, 'packages', 'core', 'notif-motor.js'));
const plan = require('../../docs/seed/iniciativas-sinteticas.json').iniciativas[0];

// 1) el código extraído es idéntico en la SPA corporativa y en el Prototipo
const ext = f => G.extraer(fs.readFileSync(path.join(raiz, f), 'utf8'), ['notifPara', 'notifPref', 'NOTIF_GRUPOS', 'NOTIF_DEST']).filter(p => p.n !== 'esAdminReal').map(p => p.n + '\n' + p.codigo).join('\n');   // esAdminReal diverge a propósito (S-17: en el Prototipo con sesión solo vale el correo)
assert.strictEqual(ext('apps/corporativo/index.html'), ext('index.html'), 'funciones de avisos distintas entre Prototipo y corporativo');
const gen = require('child_process').spawnSync('node', [path.join(raiz, 'tools', 'generar-motor-notif.js'), '--check']); assert.strictEqual(gen.status, 0, 'motor desactualizado');

(async () => {
  const b = await chromium.launch(launchOpts);
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(x => {
    celebrar = () => {};
    const H = '2026-10-16', d = n => addD(H, n);
    St.usuarios.push({ n: 'Ana Pérez', rol: 'Colaborador', area: 'BISE', correo: 'ana@ejemplo.cl', veTodo: false },
      { n: 'Beto Ruiz', rol: 'Colaborador', area: 'Finanzas', correo: 'beto@ejemplo.cl', veTodo: false },
      { n: 'Carla Soto', rol: 'Gasto', area: 'BISE', correo: 'carla@ejemplo.cl', veTodo: true });
    const base = Object.assign({ legacy: '', creada: '2026-08-20', faseDesde: '2026-09-01', origen: 'usuario', est: [], hist: [['2026-08-20', 0]], tags: [], rec: null, folio: '', oc: '', ahorroReal: 0, inicioReal: null, propuestaOrigen: null, estadoMotivo: '', estadoRev: null, gastado: 0, proyecto: null, deps: [] }, x);
    delete base.hitos; delete base.riesgos;
    const p1 = Object.assign({}, base, { id: 'PRJ-050', lider: 'Ana Pérez', sponsor: 'Carla Soto', area: 'BISE', fase: 'Ejecución', estado: 'En curso', inicioPlan: '2026-08-01', finPlan: d(-20), avance: 40, actualizada: d(-40) });
    const p2 = Object.assign({}, base, { id: 'PRJ-051', titulo: 'Proyecto Finanzas', lider: 'Beto Ruiz', sponsor: 'Ana Pérez', area: 'Finanzas', fase: 'Planificación', estado: 'En curso', inicioPlan: d(-30), finPlan: d(60), avance: 10, actualizada: d(-2) });
    const pr = Object.assign({}, base, { id: 'PROP-010', tipo: 'Propuesta', titulo: 'Propuesta estancada', lider: 'Ana Pérez', sponsor: 'Beto Ruiz', area: 'BISE', fase: St.cfg.fasesProp ? St.cfg.fasesProp[0] : 'Idea', estado: 'Vigente', faseDesde: d(-90), avance: 0, actualizada: d(-5) });
    St.ini.push(p1, p2, pr);
    St.cfg.notif = { canalOn: { correo: true }, tipos: { prop_estancada: { on: true }, hito_venc: { canales: { correo: true } }, riesgo_crit: { canales: { correo: true, teams: true } } } };
    St.cfgU = St.cfgU || {}; St.cfgU[_nrm('Beto Ruiz')] = { notif: { tipos: { ev_comentario: { on: false } } } };
    St.hitos.push({ id: 'HIT-901', ini: 'PRJ-050', nombre: 'Hito vencido', fase: 'Ejecución', fecha: d(-5), completado: false, resp: 'Ana Pérez' },
      { id: 'HIT-902', ini: 'PRJ-050', nombre: 'Hito muy vencido', fase: 'Ejecución', fecha: d(-45), completado: false, resp: 'Beto Ruiz' },
      { id: 'HIT-903', ini: 'PRJ-050', nombre: 'Hito próximo', fase: 'Ejecución', fecha: d(2), completado: false, resp: 'Ana Pérez' },
      { id: 'HIT-904', ini: 'PRJ-051', nombre: 'Hito hoy', fase: 'Planificación', fecha: d(0), completado: false, resp: 'Beto Ruiz' });
    St.riesgos.push({ id: 'RSK-901', ini: 'PRJ-050', desc: 'Riesgo crítico de prueba', prob: 5, imp: 5, estado: 'Abierto', dueno: 'Ana Pérez', fIdent: d(-3) },
      { id: 'RSK-902', ini: 'PRJ-051', desc: 'Riesgo bajo', prob: 1, imp: 2, estado: 'Abierto', dueno: 'Beto Ruiz' });
    St.compromisos.push({ id: 'CMP-901', ini: 'PRJ-050', texto: 'Compromiso vencido', resp: 'Ana Pérez', limite: d(-3), estado: 'Abierto' },
      { id: 'CMP-902', ini: 'PRJ-051', texto: 'Compromiso próximo', resp: 'Beto Ruiz', limite: d(1), estado: 'Abierto' },
      { id: 'CMP-903', ini: null, texto: 'Compromiso sin iniciativa', resp: 'Carla Soto', limite: d(-1), estado: 'Abierto' });
    St.decisiones.push({ id: 'DEC-901', ini: 'PRJ-050', titulo: 'Decisión vencida', estado: 'Pendiente', limite: d(-2), solicita: 'Ana Pérez' });
    St.cambios.push({ id: 'CAM-901', ini: 'PRJ-050', tipo: 'Fecha', estado: 'Solicitado', desc: 'Mover fin', solicita: 'Ana Pérez', aprobador: 'Carla Soto', creada: d(-1) },
      { id: 'CAM-902', ini: 'PRJ-051', tipo: 'Alcance', estado: 'Aprobado', desc: 'Ampliar alcance', solicita: 'Beto Ruiz', fDec: d(-3), creada: d(-6) });
    const bit = (id, tipo, ini, texto, autor, dd) => St.bitacora.push({ id, ts: d(dd) + 'T10:00:00', tipo, ini, texto, autor });
    bit('BIT-901', 'Comentario', 'PRJ-050', 'Revisemos el plan', 'Beto Ruiz', -1);
    bit('BIT-902', 'Cambio', 'PRJ-051', 'Cambio de fase: Iniciación → Planificación', 'Carla Soto', -4);
    bit('BIT-903', 'Cambio', 'PRJ-050', 'RAG Ámbar → Rojo', 'Carla Soto', -2);
    bit('BIT-904', 'Edición', 'PRJ-050', 'Hito «Hito vencido» — Responsable: Beto Ruiz → Ana Pérez', 'Carla Soto', -1);
    bit('BIT-905', 'Comentario', 'PRJ-050', 'Comentario antiguo', 'Beto Ruiz', -30);
    bit('BIT-906', 'Comentario', 'PRJ-050', 'Comentario propio', 'Ana Pérez', -1);
  }, plan);
  const usuarios = ['Ana Pérez', 'Beto Ruiz', 'Carla Soto', 'Christian Tolosa', 'Nadie Externo'];
  const fechas = ['2026-10-16', '2026-10-18', '2026-11-05'];
  let casos = 0, total = 0; const tipos = new Set();
  for (const f of fechas) for (const u of usuarios) {
    const r = await p.evaluate(([u, f]) => { St.cfg.hoyFija = f; FL.verComo = u; _PP = null; const a = notifPara(u); FL.verComo = ''; return { a, St: JSON.stringify(St) }; }, [u, f]);
    const datos = JSON.parse(r.St); delete datos.cfg.hoyFija;
    const m = M.crearMotor(datos, u, f).avisos();
    assert.deepStrictEqual(m, r.a, 'distinto para ' + u + ' al ' + f);
    casos++; total += m.length; m.forEach(x => tipos.add(x.tipo));
  }
  await b.close();
  assert.ok(!errs.length, errs.join('\n'));
  const faltan = M.crearMotor({ cfg: {} }, 'x', '2026-10-16'); const todos = new Set(faltan.NOTIF.map(n => n.id));
  console.log('tipos cubiertos', tipos.size + '/' + todos.size, [...todos].filter(t => !tipos.has(t)).join(', ') || '');
  console.log('OK notif1 — ' + casos + ' combinaciones usuario×fecha, ' + total + ' avisos idénticos');
})().catch(e => { console.error('FALLA notif1:', e.message); process.exit(1); });
