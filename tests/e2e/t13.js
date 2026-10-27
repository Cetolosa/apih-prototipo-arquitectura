const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/demo/index.html'); await p.waitForTimeout(2000);
  const r = await p.evaluate(async () => {
    const btn = document.createElement('button'); btn.id = 'opener'; btn.textContent = 'x'; document.body.appendChild(btn); btn.focus();
    Modal.open({ title: 'T', body: '<input id="a"><input id="b">', footer: '<button id="z">ok</button>' });
    await new Promise(r => setTimeout(r, 80));
    const inert = document.getElementById('app').hasAttribute('inert'), inField = document.activeElement.id;
    Modal.close(); const back = document.activeElement.id, inert2 = document.getElementById('app').hasAttribute('inert');
    return { inert, inField, back, inert2 };
  });
  // tab wrap
  await p.evaluate(() => { Modal.open({ title: 'T', body: '<input id="a">', footer: '<button id="z">ok</button>' }); });
  await p.focus('#z'); await p.keyboard.press('Tab'); const wrap = await p.evaluate(() => document.activeElement.className + '|' + document.activeElement.id);
  console.log(JSON.stringify({ r, wrap, errs })); await b.close();
})();
