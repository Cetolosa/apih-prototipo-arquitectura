const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const ctx = await b.newContext({ viewport: { width: 1400, height: 850 } }); const p = await ctx.newPage();
  const errs = [], csp = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
  const jwt = 'x.' + Buffer.from(JSON.stringify({ email: 'tolosa-christian@aramark.cl' })).toString('base64') + '.y';
  await ctx.route('https://hpsjzuqcijjwthrxgmeu.supabase.co/**', async r => {
    const u = r.request().url(), m = r.request().method(), h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (m === 'OPTIONS') return r.fulfill({ status: 204, headers: h });
    if (u.includes('/auth/v1/token')) return r.fulfill({ status: 200, headers: h, body: JSON.stringify({ access_token: jwt, refresh_token: 'r', expires_in: 3600 }) });
    return r.fulfill({ status: 200, headers: h, body: '[]' });
  });
  await p.goto('http://localhost:8765/index.html'); await p.waitForSelector('#sb-login', { timeout: 8000 });
  await p.fill('#sb-mail', 'tolosa-christian@aramark.cl'); await p.fill('#sb-key', 'x'); await p.click('#sb-go'); await p.waitForTimeout(3500);
  const ok = await p.evaluate(() => !document.getElementById('sb-login') && !!document.querySelector('#main .ph, #main h1'));
  await p.evaluate(() => { location.hash = '#/cielo'; }); await p.waitForTimeout(800);
  // exportar xlsx (descarga por blob)
  const dl = await p.evaluate(() => { try { const b = xlsxBlob([{ name: 'x', rows: [['a'], [1]] }]); return b.size > 0; } catch (e) { return String(e); } });
  console.log(JSON.stringify({ loginOk: ok, xlsx: dl, csp, errs: errs.slice(0, 3) })); await b.close();
})();
