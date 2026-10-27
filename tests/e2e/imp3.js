// V22.59 · Exportar e importar subfases y categorías: archivo de iniciativas (plantilla) y «Con archivo» (ida y vuelta)
const { chromium, launchOpts } = require('./_pw');
const URL = process.env.APIH_URL || 'http://localhost:8765/demo/index.html';
(async () => {
  const b = await chromium.launch(launchOpts); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.addInitScript(() => localStorage.setItem('apih_tour22', '1')); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1800);
  const r = await p.evaluate(async () => { celebrar = () => {}; const out = {}, espera = ms => new Promise(r => setTimeout(r, ms)), clic = t => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === t).click();
    // 1) Importar la plantilla (trae subfases, categorías y hitos con subfase; una subfase inválida a propósito)
    const pl = INI_PLANTILLA(); pl.iniciativas = pl.iniciativas.filter(x => x.subfases); pl.iniciativas[0].titulo = 'Importada con subfases ' + Date.now();
    pl.iniciativas[0].subfases.push({ nombre: 'Fuera', fase: 'Ejecución', fin: addD(hoy(), 400) }); pl.iniciativas[0].hitos.push({ nombre: 'Hito cruzado', fase: 'Transición', fecha: addD(hoy(), 150), subfase: 'Piloto' });
    Chg.impinifile({ files: [new File([JSON.stringify(pl)], 'x.json')], value: '' }); await espera(400); clic('Importar'); await espera(400);
    const i = St.ini.find(x => x.titulo === pl.iniciativas[0].titulo); out.id = i.id;
    out.subs = subfasesDe(i).map(s => s.nombre + '>' + s.fase).join(',');
    out.hitosSub = hitosDe(i.id).filter(h => h.subfase).map(h => h.nombre + '@' + subfasesDe(i).find(s => s.id === h.subfase).nombre).join(',');
    out.cats = hitosDe(i.id).map(h => h.cat || '-').join(',');
    out.toast = [...document.querySelectorAll('.toast span')].map(x => x.textContent).filter(t => /importada/.test(t)).pop() || '';
    // 2) «Con archivo»: exporta subfases y ventanas
    const ex = archExport(i); out.exporta = ['subfases', 'ventanas_de_fase'].every(k => Array.isArray(ex[k])) && ex.subfases.length === 2 && ex.hitos.some(h => h.subfase);
    // 3) Vuelta: cambia una subfase, crea otra, recategoriza y reasigna hitos; incluye errores que deben omitirse
    const api = ex.hitos.find(h => h.nombre === 'API lista'), plan = ex.hitos.find(h => h.nombre === 'Plan aprobado'), ej = ex.ventanas_de_fase.find(v => v.fase === 'Ejecución');
    const back = { formato: 'apih-proyecto-archivo', v: 1, proyecto_id: i.id, subfases: [...ex.subfases, { nombre: 'Estabilización', fase: 'Ejecución', inicio: ej.fin, fin: ej.fin }, { nombre: 'Mala', fase: 'Ejecución', fin: addD(ej.fin, 30) }],
      hitos: [{ id: api.id, cat: 'Gobierno', subfase: 'Estabilización' }, { id: plan.id, subfase: 'Piloto' }, { id: plan.id, cat: 'Inventada' }, { nombre: 'Demo', fase: 'Ejecución', fecha: ej.fin, cat: 'Entregable', subfase: 'Estabilización' }] };
    Chg.proyarchf({ files: [new File([JSON.stringify(back)], 'r.json')], value: '', dataset: { id: i.id } }); await espera(500);
    out.resumen = (document.querySelector('.modal p, .modal-b, .mbody') || {}).textContent || ''; out.cambios = (out.resumen.match(/(\d+) cambio/) || [])[1];
    clic([...document.querySelectorAll('.modal button, [data-act=mconfirm]')].map(x => x.textContent.trim()).find(t => /Aplicar|Confirmar/.test(t)) || 'Aplicar'); await espera(400);
    const g = id => St.hitos.find(h => h.id === id), sn = h => (subfasesDe(i).find(s => s.id === h.subfase) || {}).nombre || '';
    out.subsFin = subfasesDe(i).map(s => s.nombre).join(',');
    out.api = g(api.id).cat + '@' + sn(g(api.id)); out.plan = (g(plan.id).cat || '') + '@' + sn(g(plan.id));
    const demo = hitosDe(i.id).find(h => h.nombre === 'Demo'); out.demo = demo ? demo.cat + '@' + sn(demo) : 'no';
    await espera(3000); out.rechazo = (typeof DataService !== 'undefined' && DataService.ultimoRechazo) || ''; out.modo = (typeof DataService !== 'undefined' && DataService.mode) || '';
    if (out.modo === 'api') { const g2 = await fetch('/api/iniciativas/' + i.id).then(r => r.json()); out.servidor = (g2.subfases || []).map(s => s.nombre).join(',') + ' · ' + (await fetch('/api/iniciativas/' + i.id + '/hitos').then(r => r.json())).filter(h => h.subfase).length + ' hitos con subfase'; }
    return out; });
  r.errores = errs; console.log(JSON.stringify(r, null, 1));
  const ok = r.subs === 'Construcción>Ejecución,Piloto>Ejecución' && r.hitosSub === 'API lista@Construcción,Piloto con usuarios@Piloto' && r.cats.startsWith('Gobierno,Entregable,Técnico') && /aviso/.test(r.toast)
    && r.exporta && r.subsFin === 'Construcción,Piloto,Estabilización' && r.api === 'Gobierno@Estabilización' && r.plan === 'Gobierno@' && r.demo === 'Entregable@Estabilización' && !r.rechazo && (r.modo !== 'api' || r.servidor === 'Construcción,Piloto,Estabilización · 3 hitos con subfase') && !errs.length;
  console.log(ok ? 'OK imp3' : 'FALLA imp3'); await b.close(); process.exit(ok ? 0 : 1);
})();
