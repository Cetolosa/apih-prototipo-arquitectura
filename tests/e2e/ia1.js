const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1440,height:1000}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
const txt=require('fs').readFileSync('/tmp/t/out/APIH_iniciativas_con_plan.json','utf8');
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
const r=await p.evaluate(async(txt)=>{celebrar=()=>{};const out={};
 Chg.impinifile({files:[new File([txt],'x.json')],value:''});await new Promise(r=>setTimeout(r,300));
 [...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Importar').click();await new Promise(r=>setTimeout(r,200));
 const i=St.ini.find(x=>x.titulo==='APIH Corporativo');out.id=i.id;
 const ex=iapExport(i);out.keys=Object.keys(ex);out.pend=ex.pendientes;out.size=JSON.stringify(ex).length;
 const hv=ex.hitos.find(h=>h.nombre.startsWith('Plan aprobado')||h.nombre.startsWith('C1.3 · Plan acelerado aprobado'));
 const back={formato:'apih-proyecto-ia',v:1,proyecto_id:i.id,proyecto:{sponsor:'Gerencia TI',presupuesto:50,avance:12,finPlan:'2026-12-20',rag:'Rosado',zzz:1},
  hitos:[{id:hv.id,completado:true,fechaReal:'2026-10-16'},{nombre:'Kick-off con TI',fase:'Planificación',fecha:'2026-10-20',resp:'Ana'},{id:'HIT-001',nombre:'x'},{nombre:'malo',fecha:'31/12'}],
  riesgos:[{desc:'Sin presupuesto aprobado',cat:'Financiero',prob:5,imp:5,mit:''},{desc:'Rotación del equipo',cat:'Recursos',prob:2,imp:3,dueno:'Christian',mit:'Documentar'}]};
 const files=[new File(['```json\n'+JSON.stringify(back)+'\n```'],'r.json')];
 const el={files,value:'',dataset:{id:i.id}};Chg.proyiaf(el);await new Promise(r=>setTimeout(r,400));
 out.preview=(document.querySelector('.modal, #modal, .cbox')||document.body).innerText.slice(0,1500);
 [...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Aplicar').click();await new Promise(r=>setTimeout(r,300));
 const j=St.ini.find(x=>x.id===i.id);out.after={sponsor:j.sponsor,pres:j.presupuesto,av:j.avance,fin:j.finPlan,rag:j.rag,hito:St.hitos.find(h=>h.id===hv.id).completado,nuevoH:St.hitos.some(h=>h.nombre==='Kick-off con TI'),rs:St.riesgos.filter(r=>r.ini===i.id).length};
 Acts.proyia({id:i.id});await new Promise(r=>setTimeout(r,200));out.modal=!!document.querySelector('#iapfile');
 return out},txt);
console.log(JSON.stringify(r,null,1),errs);await b.close()})();
