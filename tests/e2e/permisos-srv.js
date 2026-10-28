// Iter 1: la SPA solo LEE los permisos que entrega el servidor (colaborador de un área; «Ver como» resuelto en la base)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts), p = await b.newPage(); const f = [], ok = (c, m) => { if (!c) f.push(m); console.log((c ? 'ok   ' : 'FALLA') + ' ' + m); };
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1'));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => {
    const o = {}; o.admin = esAdmin(); o.rol = rolActual(); o.ro = soloLectura(); o.gob = puedeGobernar(); o.users = St.usuarios.length;
    // alta como admin en dos áreas distintas
    St.ini.push(Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-901', titulo: 'En área propia', area: 'Área de prueba', tipo: 'Proyecto' }), Object.assign({}, ESQUEMA.projects.tpl(), { id: 'PRJ-902', titulo: 'Ajena', area: 'Otra', tipo: 'Proyecto' }));
    save(); await DataService.flush(); await DataService.refresh(true, true);
    o.adminEdita = puedeEditarIni(byId('PRJ-902'));
    await Acts.vercomo({ n: 'Editor de prueba' });
    o.como = FL.verComo; o.roComo = soloLectura(); o.verAjena = !!byId('PRJ-902'); o.propia = !!byId('PRJ-901'); o.editaComo = puedeEditarIni(byId('PRJ-901'));
    await Acts.vercomo({ n: '' });
    o.fuera = FL.verComo === '' && esAdmin() && !soloLectura();
    return o;
  });
  ok(r.admin && r.rol === 'Administra' && !r.ro && r.gob, 'el contexto del administrador viene del servidor');
  ok(r.users >= 2, 'el directorio de personas viene del servidor');
  ok(r.adminEdita === true, 'el administrador edita iniciativas de cualquier área (puede_editar)');
  ok(r.como === 'Editor de prueba' && r.roComo === true, 'Ver como: el servidor entrega el perfil elegido en solo lectura');
  ok(r.propia === true && r.verAjena === false, 'Ver como: solo llegan las filas que ese perfil puede ver (RLS)');
  ok(r.editaComo === false, 'Ver como no permite editar (el servidor lo impide)');
  ok(r.fuera, 'salir de Ver como devuelve al administrador');
  await b.close(); console.log(f.length ? 'FALLA permisos-srv' : 'OK permisos-srv'); process.exit(f.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
