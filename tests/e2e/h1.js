const { chromium, launchOpts } = require('./_pw');
(async()=>{const b=await chromium.launch(launchOpts);const p=await b.newPage({viewport:{width:1440,height:1000}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{celebrar=()=>{};UI.uiOv='pro';
 St.ini.push({id:'PRJ-002',tipo:'Proyecto',legacy:'',creada:hoy(),faseDesde:hoy(),origen:'usuario',est:[],hist:[[hoy(),30]],tags:[],rec:null,folio:'',oc:'',ahorroReal:0,inicioReal:null,propuestaOrigen:null,estadoMotivo:'',estadoRev:null,gastado:120,proyecto:null,deps:[],estado:'En curso',fase:'Ejecución',rag:'Ámbar',prioridad:'Alta',area:'BISE',lider:'Ana Pérez',sponsor:'Gerencia TI',titulo:'Migración Plataforma de Datos',avance:45,actualizada:hoy(),desc:'d',presupuesto:350,inicioPlan:addD(hoy(),-90),finPlan:addD(hoy(),120),logros:'',proximos:''});
 Acts.ficha({id:'PRJ-002'})});await p.waitForTimeout(900);
console.log(await p.evaluate(()=>{const s=document.getElementById('fl-act');return s?[...s.children].map(c=>c.tagName+'.'+c.className).join(' | '):'no fl-act'}));
await b.close()})();
