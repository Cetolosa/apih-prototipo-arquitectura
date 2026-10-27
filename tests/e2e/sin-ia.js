// F1 · Sin servicios de IA: ninguna solicitud de red a hosts de IA, CSP sin hosts de IA y sin sección «IA» visible.
const fs = require('fs'), path = require('path');
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const HOSTS_IA = /anthropic|openai|generativelanguage|googleapis\.com\/v1beta|gemini|cohere|mistral|huggingface|azure\.com\/openai|perplexity|api\.x\.ai/i;
(async () => {
  const csp = (html.match(/Content-Security-Policy"\s+content="([^"]*)"/) || [])[1] || '';
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const ext = []; p.on('request', q => { const u = q.url(); if (!/^(http:\/\/localhost|data:|blob:|about:)/.test(u)) ext.push(u); });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1500);
  const nav = await p.evaluate(() => [...document.querySelectorAll('#side [data-v], #side button, #side a')].map(x => (x.dataset.v || '') + '|' + x.textContent.trim()).filter(x => /^ia\||\|IA$/i.test(x)));
  const r = { cspIA: HOSTS_IA.test(csp), codigoIA: html.split('\n').filter(l => /\bfetch\(/.test(l) && HOSTS_IA.test(l)).length, externas: ext.filter(u => HOSTS_IA.test(u)), navIA: nav };
  console.log(JSON.stringify(r));
  const ok = !r.cspIA && !r.codigoIA && !r.externas.length && !r.navIA.length; console.log(ok ? 'OK sin-ia' : 'FALLA sin-ia'); await b.close(); process.exit(ok ? 0 : 1);
})();
