// F1 · Sin servicios externos de generación (fuera del servidor y del inicio de sesión del ambiente): ninguna solicitud de red a esos hosts, CSP limpia, navegación sin secciones prohibidas y fuente sin términos vetados (tools/lint-terminos.js).
const fs = require('fs'), path = require('path');
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const REPO = path.join(__dirname, '..', '..'), RAIZ = fs.existsSync(path.join(REPO, 'web', 'index.html')) ? path.join(REPO, 'web') : REPO, html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const fuente = html + '\n' + fs.readdirSync(path.join(RAIZ, 'js')).map(f => fs.readFileSync(path.join(RAIZ, 'js', f), 'utf8')).join('\n');
const HOSTS_EXT = /anthropic|openai|generativelanguage|googleapis\.com\/v1beta|gemini|cohere|mistral|huggingface|azure\.com\/openai|perplexity|api\.x\.ai/i;
(async () => {
  const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const viol = []; p.on('console', m => { const t = m.text(); if (/Content Security Policy/i.test(t) && /(script|style|img|font)-src/i.test(t)) viol.push(t.slice(0, 200)); });
  const ext = []; p.on('request', q => { const u = q.url(); if (!/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) ext.push(u); });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  // V11: recorre todas las pantallas y abre una ficha; cualquier style="" que escape del filtro dejaría una violación de CSP en la consola
  const vistas = await p.evaluate(() => [...new Set([...document.querySelectorAll('#side [data-v]')].map(x => x.dataset.v))]);
  for (const v of vistas) { await p.evaluate(v => { const b = document.querySelector('#side [data-v="' + v + '"]'); if (b) b.click(); }, v); await p.waitForTimeout(250); }
  await p.evaluate(() => { const a = document.querySelector('[data-act="sel"][data-t="ini"], [data-act="open"], .iniLink, [data-act="ficha"]'); if (a) a.click(); }); await p.waitForTimeout(400);
  const estiloAplicado = await p.evaluate(() => ({ pendientes: document.querySelectorAll('[data-css]').length, aplicados: [...document.querySelectorAll('[style]')].filter(e => e.style.length > 0).length }));
  const nav = await p.evaluate(() => [...document.querySelectorAll('#side [data-v], #side button, #side a')].map(x => (x.dataset.v || '') + '|' + x.textContent.trim()).filter(x => /^ia\||\|IA$|agente/i.test(x)));
  const r = { cspExt: HOSTS_EXT.test(csp), scriptInline: /script-src[^;]*'unsafe-(inline|eval)'/.test(csp), estiloInline: /style-src(-elem)?\s[^;]*'unsafe-(inline|eval)'/.test(csp) || !/style-src-elem\s+'self'/.test(csp), msRestos: fuente.split('\n').filter(l => !/base64,/.test(l) && /graph\.microsoft|_api\/web|SharePointService|PnP/i.test(l)).length, estiloEnPagina: /<style[\s>]/i.test(html), estiloCreadoPorJs: fuente.split('\n').filter(l => /createElement\(\s*['"]style['"]\s*\)/.test(l)).length, violaciones: viol, estiloAplicado, attrInline: /style-src-attr\s[^;]*'unsafe-inline'/.test(csp) || !/style-src-attr\s+'none'/.test(csp), imgData: /img-src[^;]*\bdata:/.test(csp), scriptEnPagina: /<script(?![^>]*\bsrc=)[^>]*>/i.test(html), codigoExt: fuente.split('\n').filter(l => /\bfetch\(/.test(l) && HOSTS_EXT.test(l)).length, externas: ext.filter(u => HOSTS_EXT.test(u)), navVetada: nav };
  console.log(JSON.stringify(r));
  const lint = require('child_process').spawnSync('node', [['mjs', 'js'].map(x => path.join(REPO, 'tools', 'lint-terminos.' + x)).find(f => fs.existsSync(f))], { encoding: 'utf8' }); r.lint = lint.status === 0; console.log(lint.stdout.slice(-400));
  const ok = r.lint && !r.scriptInline && !r.estiloInline && !r.msRestos && !r.estiloEnPagina && !r.estiloCreadoPorJs && !r.violaciones.length && !r.estiloAplicado.pendientes && r.estiloAplicado.aplicados > 0 && !r.attrInline && !r.imgData && !r.scriptEnPagina && !r.cspExt && !r.codigoExt && !r.externas.length && !r.navVetada.length; console.log(ok ? 'OK sin-externos' : 'FALLA sin-externos'); await b.close(); process.exit(ok ? 0 : 1);
})();
