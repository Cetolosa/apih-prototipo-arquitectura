// F1 · Sin servicios externos de generación: ninguna solicitud de red a esos hosts, CSP limpia, navegación sin secciones prohibidas y fuente sin términos vetados (tools/lint-terminos.js).
const fs = require('fs'), path = require('path');
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const RAIZ = path.join(__dirname, '..', '..'), html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const fuente = html + '\n' + fs.readdirSync(path.join(RAIZ, 'js')).map(f => fs.readFileSync(path.join(RAIZ, 'js', f), 'utf8')).join('\n');
const HOSTS_EXT = /anthropic|openai|generativelanguage|googleapis\.com\/v1beta|gemini|cohere|mistral|huggingface|azure\.com\/openai|perplexity|api\.x\.ai/i;
(async () => {
  const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const ext = []; p.on('request', q => { const u = q.url(); if (!/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) ext.push(u); });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const nav = await p.evaluate(() => [...document.querySelectorAll('#side [data-v], #side button, #side a')].map(x => (x.dataset.v || '') + '|' + x.textContent.trim()).filter(x => /^ia\||\|IA$|agente/i.test(x)));
  const r = { cspExt: HOSTS_EXT.test(csp), scriptInline: /script-src[^;]*'unsafe-(inline|eval)'/.test(csp), scriptEnPagina: /<script(?![^>]*\bsrc=)[^>]*>/i.test(html), codigoExt: fuente.split('\n').filter(l => /\bfetch\(/.test(l) && HOSTS_EXT.test(l)).length, externas: ext.filter(u => HOSTS_EXT.test(u)), navVetada: nav };
  console.log(JSON.stringify(r));
  const lint = require('child_process').spawnSync('node', [path.join(__dirname, '..', '..', 'tools', 'lint-terminos.js')], { encoding: 'utf8' }); r.lint = lint.status === 0; console.log(lint.stdout.slice(-400));
  const ok = r.lint && !r.scriptInline && !r.scriptEnPagina && !r.cspExt && !r.codigoExt && !r.externas.length && !r.navVetada.length; console.log(ok ? 'OK sin-externos' : 'FALLA sin-externos'); await b.close(); process.exit(ok ? 0 : 1);
})();
