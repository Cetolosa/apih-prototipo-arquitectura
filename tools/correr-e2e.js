#!/usr/bin/env node
// Corre la regresión e2e contra la SPA (modo demo). Código de salida ≠ 0 si alguna prueba falla.
const { spawn, spawnSync } = require('child_process'), path = require('path'), fs = require('fs');
const { servir, PUERTO } = require('./servir-demo');
const PRUEBAS = ['sin-externos', 'xss1', 'imp3', 'fin1', 'fz1', 't13', 't43', 't44', 'cap2', 'r1', 'c4', 'imp1', 'imp2', 'cfgu1', 'aprob-srv', 'cmd-srv', 'gates-contract', 'campo-srv', 'servidor-ficticio', 'ps1', 'sf1'];
function correr(t) {   // asíncrono: el servidor de la demo vive en este mismo proceso
  return new Promise(ok => { let so = '', se = ''; const h = spawn('node', [path.join(__dirname, '..', 'tests', 'e2e', t + '.js')], { cwd: require('os').tmpdir(), env: Object.assign({}, process.env, { APIH_URL: 'http://localhost:' + PUERTO + '/demo/index.html' }) });
    const k = setTimeout(() => h.kill('SIGKILL'), 120000); h.stdout.on('data', d => so += d); h.stderr.on('data', d => se += d); h.on('close', c => { clearTimeout(k); ok({ status: c, stdout: so, stderr: se }); }); });
}
(async () => {
  if (!fs.existsSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'))) spawnSync('node', [path.join(__dirname, 'generar-seed.js')], { stdio: 'inherit' });
  const srv = await servir(); let fallas = 0; const R = [];
  fs.mkdirSync('/tmp/t/out', { recursive: true }); fs.copyFileSync(path.join(__dirname, '..', 'docs', 'seed', 'iniciativas-sinteticas.json'), '/tmp/t/out/iniciativas-sinteticas.json');
  for (const t of (process.env.SOLO ? process.env.SOLO.split(',') : PRUEBAS)) {
    const t0 = Date.now(), r = await correr(t);
    const ult = (r.stdout || '').trim().split('\n').pop().slice(0, 100), mal = r.status !== 0 || /FALLA/.test(r.stdout || '');
    R.push({ t, mal, seg: (Date.now() - t0) / 1000, msg: ult + ' ' + (r.stderr || '').split('\n')[0] });
    if (mal) { fallas++; if (process.env.GITHUB_ACTIONS) console.log('::error title=e2e ' + t + '::' + ((r.stderr || '') + ' | ' + (r.stdout || '').slice(-600)).replace(/[\r\n]+/g, ' ').slice(0, 900)); } console.log((mal ? 'FALLA ' : 'OK    ') + t + (mal ? '  ' + ult + ' ' + (r.stderr || '').split('\n')[0] : ''));
  }
  const esc = x => String(x).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));   // reporte JUnit para la CI
  fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'test-results', 'e2e-junit.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="e2e" tests="' + R.length + '" failures="' + fallas + '">\n' + R.map(x => '  <testcase classname="e2e" name="' + esc(x.t) + '" time="' + x.seg.toFixed(1) + '">' + (x.mal ? '<failure message="' + esc(x.msg) + '"/>' : '') + '</testcase>').join('\n') + '\n</testsuite>\n');
  console.log(fallas ? 'FALLAS: ' + fallas : 'Suite completa OK'); srv.close(); process.exit(fallas ? 1 : 0);
})();
