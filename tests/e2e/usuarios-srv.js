// Iter 6: Administración → Usuarios lee y guarda en el servidor (rol, áreas y proyectos asignados)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage({ viewport: { width: 1440, height: 1000 } }); const f = [], errs = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-909', titulo: 'Usuarios e2e', area: 'BISE', tipo: 'Proyecto', fase: 'Ejecución', estado: 'En curso', rag: 'Verde', lider: miUsuario(), actualizada: hoy(), inicioPlan: addD(hoy(), -30), finPlan: addD(hoy(), 90), finEst: addD(hoy(), 90) }));
    save(); await DataService.flush(); await DataService.refresh(false, true);
    const o = {}; F('adm', {}).tab = 'usr'; go('admin'); UI.usrs = null;
    for (let k = 0; k < 40 && !Array.isArray(UI.usrs); k++) await new Promise(r => setTimeout(r, 250));
    o.lista = Array.isArray(UI.usrs) && UI.usrs.length > 0; o.yo = UI.usrs.find(u => u.appRol === 'Administra');
    render(); await new Promise(r => setTimeout(r, 300)); o.tabla = document.body.innerText.includes('Proyectos asignados');
    Acts.usredit({ id: o.yo.email }); await new Promise(r => setTimeout(r, 300));
    const box = document.querySelector('#f_proyectos input[value="PRJ-909"]'); o.campo = !!box; if (box) box.checked = true;
    [...document.querySelectorAll('.modal button')].find(x => /^Guardar/.test(x.textContent.trim())).click();
    for (let k = 0; k < 40; k++) { await new Promise(r => setTimeout(r, 250)); const u = (UI.usrs || []).find(x => x.email === o.yo.email); if (u && (u.proyectos || []).includes('PRJ-909')) { o.asig = true; break; } }
    o.ctx = (PERM.ctx.proyectos || []).includes('PRJ-909');
    return o;
  });
  ok(r.lista && r.tabla, 'Administración muestra los usuarios que entrega el servidor');
  ok(r.campo, 'el formulario permite elegir proyectos asignados');
  ok(r.asig, 'la asignación de proyectos se guarda en el servidor');
  ok(!errs.length, 'sin errores de página ' + errs.join('|'));
  await b.close(); console.log(f.length ? 'FALLA usuarios-srv' : 'OK usuarios-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
