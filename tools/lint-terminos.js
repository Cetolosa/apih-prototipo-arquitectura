// Falla si el código fuente contiene términos de IA / agentes / chat. Uso: node tools/lint-terminos.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const ARCHIVOS = ['index.html', 'js', 'css', 'apih-config.js', 'README.md', 'tests/e2e', 'tools', 'supabase', 'docs'];
const EXCLUIR = [/lint-terminos\.js$/, /sin-externos\.js$/, /linea-base-f0\.md$/, /node_modules/, /package-lock/];
const PATRON = [/\bIA\b/, /[a-z]IA(?![A-Za-z])/, /[a-z]IA_/, /\bIAP?_/, /\bia[A-Z_]/, /\biap[A-Z]/, /proyia/, /'ia'|"ia"/, /\b[Aa]gentes?\b/, /\bAGENTS\b/, /[Ii]nteligencia/, /[Aa]sistente/, /\bchat[a-zA-Z-]*/i, /(?<![A-Za-z])bot(?![A-Za-zñáéíóúü])/, /simulad[oa]s?/, /\b(GPT|LLM|OpenAI|Anthropic|Claude|Copilot)\b/];
function* walk(p) { const st = fs.statSync(p); if (st.isDirectory()) { for (const f of fs.readdirSync(p)) yield* walk(path.join(p, f)); } else yield p; }
let fallas = 0;
for (const a of ARCHIVOS) { const full = path.join(ROOT, a); if (!fs.existsSync(full)) continue;
  for (const f of walk(full)) { if (EXCLUIR.some(r => r.test(f)) || !/\.(html|js|css|md|sql|json)$/.test(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (l.length > 2000 && /[A-Za-z0-9+\/]{200}/.test(l)) l = l.replace(/[A-Za-z0-9+\/=]{60,}/g, ''); for (const r of PATRON) { const m = l.match(r); if (m) { fallas++; console.log(path.relative(ROOT, f) + ':' + (i + 1) + '  [' + m[0] + ']  ' + l.trim().slice(0, 110)); break; } } }); } }
console.log(fallas ? '\n' + fallas + ' coincidencias' : 'OK: sin términos prohibidos'); process.exit(fallas ? 1 : 0);
