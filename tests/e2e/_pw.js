// Resuelve Playwright: devDependency del repo o, como respaldo, la instalación global del entorno.
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const fs = require('fs');
const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
module.exports = { chromium: pw.chromium, launchOpts: exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] } };
