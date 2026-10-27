#!/usr/bin/env node
// Corre la regresión e2e contra la SPA (modo demo). Código de salida ≠ 0 si alguna prueba falla.
const { spawn, spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const { servir, PUERTO } = require('./servir-demo');
const PRUEBAS = ['sin-externos', 'xss1', 'imp3', 'fin1', 'fz1', 't13', 't43', 't44', 'cap2', 'r1', 'c4', 'imp1', 'imp2', 'cfgu1', 'aprob-srv', 'cmd-srv', 'gates-contract'];
const PENDIENTES = ['ps1', 'sf1'];   // dependen de fechas del plan real; ver docs/linea-base-f0.md
function correr(t) {   // asíncrono: el servidor de la demo vive en este mismo proceso
  return new Promise(ok => { let so = '', se = ''; const h = spawn('node', [path.join(__dirname, '..', 'tests', 'e2e', t + '.js')], { cwd: require('os').tmpdir(), env: Object.assign({}, process.env, { APIH_URL: 'http://localhost:' + PUERTO + '/demo/index.html' }) });
    const k = setTimeout(() => h.kill('SIGKILL'), 120000); h.stdout.on('data', d => so += d); h.stderr.on('data', d => se += d); h.on('close', c => { clearTimeout(k); ok({ status: c, stdout: so, stderr: se }); }); });
}
(async () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'))) spawnSync('node', [path.join(__dirname, 'generar-seed.js')], { stdio: 'inherit' });
  const srv = await servir(); let fallas = 0;
  fs.mkdirSync('/tmp/t/out', { recursive: true }); fs.copyFileSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'), '/tmp/t/out/iniciativas-sinteticas.json');
  for (const t of (process.env.SOLO ? process.env.SOLO.split(',') : PRUEBAS)) {
    const r = await correr(t);
    const ult = (r.stdout || '').trim().split('\n').pop().slice(0, 100), mal = r.status !== 0 || /FALLA/.test(r.stdout || '');
    if (mal) fallas++; console.log((mal ? 'FALLA ' : 'OK    ') + t + (mal ? '  ' + ult + ' ' + (r.stderr || '').split('\n')[0] : ''));
  }
  console.log('Pendientes (no corren): ' + PENDIENTES.join(', ')); srv.close(); process.exit(fallas ? 1 : 0);
})();
