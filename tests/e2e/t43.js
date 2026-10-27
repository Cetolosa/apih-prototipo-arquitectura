const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1440,height:1000}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
const r=await p.evaluate(()=>{
 celebrar=()=>{};
 St.ini.push({id:'PRJ-002',tipo:'Proyecto',legacy:'',creada:hoy(),faseDesde:hoy(),origen:'usuario',est:[],hist:[[hoy(),30]],tags:[],rec:null,folio:'',oc:'',ahorroReal:0,inicioReal:null,propuestaOrigen:null,estadoMotivo:'',estadoRev:null,gastado:120,proyecto:null,deps:[],estado:'En curso',fase:'Ejecución',rag:'Ámbar',prioridad:'Alta',area:'BISE',lider:'Ana Pérez',sponsor:'Gerencia TI',titulo:'Migración Plataforma de Datos',avance:45,actualizada:hoy(),desc:'d',presupuesto:350,inicioPlan:addD(hoy(),-90),finPlan:addD(hoy(),120),logros:'',proximos:''});
 St.hitos.push({id:'HIT-900',ini:'PRJ-002',nombre:'Hito prueba',fecha:'2026-12-01',completado:false,fechaReal:null,resp:'X',fase:'Ejecución'}); _audSt=null; save();
 const i=St.ini.find(x=>x.id==='PRJ-002'); const id=i.id; const n0=St.bitacora.length;
 const out={id};
 // 1 edit fields + save
 i.lider='Persona Nueva'; i.presupuesto=(i.presupuesto||0)+1000; i.finPlan='2027-04-30'; save();
 out.e1=St.bitacora.slice(0,St.bitacora.length-n0).map(b=>b.tipo+'|'+b.ini+'|'+b.texto);
 // 2 no change save -> nothing
 const n1=St.bitacora.length; save(); out.e2=St.bitacora.length-n1;
 // 3 hito edit
 const h=St.hitos.find(x=>x.ini===id); if(h){const n=St.bitacora.length; h.fecha='2027-01-15'; h.completado=!h.completado; save(); out.e3=St.bitacora.slice(0,St.bitacora.length-n).map(b=>b.texto);}
 // 4 St replacement: no entries
 const n4=St.bitacora.length; const S=clone(St); S.ini.find(x=>x.id===id).lider='Otro Remoto'; St=S; audit(); out.e4=St.bitacora.length-n4;
 // then local edit after replacement+render
 render(); const n5=St.bitacora.length; St.ini.find(x=>x.id===id).prioridad='Baja'; save(); out.e5=St.bitacora.slice(0,St.bitacora.length-n5).map(b=>b.texto);
 // 6 phase change semantic -> no dup fase
 const n6=St.bitacora.length; const ii=St.ini.find(x=>x.id===id); const was=ii.rag; ii.rag=was==='Rojo'?'Verde':'Rojo'; log('Cambio',id,'RAG '+was+' → '+ii.rag); save(); out.e6=St.bitacora.slice(0,St.bitacora.length-n6).map(b=>b.tipo+'|'+b.texto);
 UI.uiOv='pro'; Acts.ficha({id});
 return out;});
console.log(JSON.stringify(r,null,1));
await p.waitForTimeout(900);
await p.evaluate(()=>{const s=document.getElementById('fl-act'); if(s&&s.querySelector('.fl-h')&&s.classList.contains('closed')) s.querySelector('.fl-h').click(); document.getElementById('fl-act').scrollIntoView();});
await p.waitForTimeout(400);
console.log(await p.evaluate(()=>{const s=document.getElementById('fl-act');return s?s.querySelector('.fl-b').innerText.slice(0,700):'no'}));
await p.evaluate(()=>{const m=document.querySelector('#main');m&&m.scrollBy(0,-120)});
await p.screenshot({path:'hist43.png'});
await p.click('[data-act=hsfil][data-k=campos]');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelectorAll('#fl-act .hs-i').length));
await p.evaluate(()=>{go('bitacora')});await p.waitForTimeout(400);
console.log(await p.evaluate(()=>[...document.querySelectorAll('.chips .chip')].map(c=>c.textContent+(c.classList.contains('on')?'*':'')).join(',')+' feed:'+document.querySelectorAll('.f-i').length));
console.log('errs',errs);
await b.close()})();
