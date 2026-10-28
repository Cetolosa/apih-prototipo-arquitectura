#!/usr/bin/env node
// Corre la regresión e2e contra la SPA (modo demo). Código de salida ≠ 0 si alguna prueba falla.
const { spawn, spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
process.env.CAPTURA_CLAVES = process.env.CAPTURA_CLAVES || '1';   // el puente informa las claves de cada lista: guarda del catálogo de campos del servidor
const { servir, PUERTO, claves } = require('./servir-demo');
const BACKEND = process.env.APIH_MODO !== 'demo';   // por defecto, backend real (Postgres + RLS + funciones apih_*); APIH_MODO=demo = SPA sin servidor (en retiro)
const PRUEBAS = ['backend-humo', 'sin-externos', 'xss1', 'imp3', 'fin1', 'fz1', 't13', 't43', 'avisos-srv', 'resumen-srv', 'personas-srv', 'mision-srv', 'carga-srv', 'semanal-srv', 'comentarios-srv', 'usuarios-srv', 'cap2', 'r1', 'c4', 'imp1', 'imp2', 'cfgu1', 'aprob-srv', 'cmd-srv', 'ciclo1', 'etapa-plan', 'reporte-hitos', 'campo-srv', 'servidor-ficticio', 'permisos-srv', 'acu-srv', 'comite-srv', 'calculos-srv', 'ps1', 'sf1', 'grid1', 'rsem1', 'desc1', 'cam1', 'his1'];
function correr(t) {   // asíncrono: el servidor de la demo vive en este mismo proceso
  return new Promise(ok => { let so = '', se = ''; const h = spawn('node', [path.join(__dirname, '..', 'tests', 'e2e', t + '.js')], { cwd: require('os').tmpdir(), env: Object.assign({}, process.env, { APIH_URL: 'http://localhost:' + PUERTO + '/demo/index.html' }, BACKEND ? { APIH_BACKEND_URL: 'http://localhost:' + PUERTO } : {}) });
    const k = setTimeout(() => h.kill('SIGKILL'), 120000); h.stdout.on('data', d => so += d); h.stderr.on('data', d => se += d); h.on('close', c => { clearTimeout(k); ok({ status: c, stdout: so, stderr: se }); }); });
}
(async () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'))) spawnSync('node', [path.join(__dirname, 'generar-seed.js')], { stdio: 'inherit' });
  const be = BACKEND ? await require('./backend-pruebas').levantar() : null, srv = await servir(be); let fallas = 0; const R = [];
  fs.mkdirSync('/tmp/t/out', { recursive: true }); fs.copyFileSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'), '/tmp/t/out/iniciativas-sinteticas.json');
  for (const t of (process.env.SOLO ? process.env.SOLO.split(',') : PRUEBAS)) {
    if (be) await be.reiniciar();   // cada prueba parte de la base de seed, sin rastros de la anterior
    const t0 = Date.now(), r = await correr(t);
    const ult = (r.stdout || '').trim().split('\n').pop().slice(0, 100), mal = r.status !== 0 || /FALLA/.test(r.stdout || '');
    R.push({ t, mal, seg: (Date.now() - t0) / 1000, msg: ult + ' ' + (r.stderr || '').split('\n')[0] });
    if (mal) { fallas++; if (process.env.GITHUB_ACTIONS) console.log('::error title=e2e ' + t + '::' + ((r.stderr || '') + ' | ' + (r.stdout || '').slice(-600)).replace(/[\r\n]+/g, ' ').slice(0, 900)); } console.log((mal ? 'FALLA ' : 'OK    ') + t + (mal ? '  ' + ult + ' ' + (r.stderr || '').split('\n')[0] : ''));
  }
  const esc = x => String(x).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));   // reporte JUnit para la CI
  fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'test-results', 'e2e-junit.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="e2e" tests="' + R.length + '" failures="' + fallas + '">\n' + R.map(x => '  <testcase classname="e2e" name="' + esc(x.t) + '" time="' + x.seg.toFixed(1) + '">' + (x.mal ? '<failure message="' + esc(x.msg) + '"/>' : '') + '</testcase>').join('\n') + '\n</testsuite>\n');
  if (process.env.CAPTURA_CLAVES !== '1') fs.writeFileSync(process.env.CAPTURA_CLAVES, JSON.stringify(claves()));
  try { const cat = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', 'contract', 'campos_permitidos.json'), 'utf8')), falta = [];
    for (const [l, ks] of Object.entries(claves())) for (const k of Object.keys(ks)) if (k !== 'undefined' && k !== 'null' && !(cat[l] || []).includes(k)) falta.push(l + '.' + k);
    if (falta.length) { fallas++; const m = 'campos fuera del catálogo del servidor: ' + falta.join(', ') + ' (regenera con tools/generar-campos.js)'; if (process.env.GITHUB_ACTIONS) console.log('::error title=campos-contract::' + m); console.log('FALLA campos-contract  ' + m); }
    else console.log('OK    campos-contract'); } catch (e) { console.log('FALLA campos-contract  ' + e.message); fallas++; }
    console.log(fallas ? 'FALLAS: ' + fallas : 'Suite completa OK'); srv.close(); if (be) await be.cerrar(); process.exit(fallas ? 1 : 0);
})();
