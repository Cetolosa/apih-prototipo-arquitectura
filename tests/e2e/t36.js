const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1440,height:800}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
const menu=()=>p.evaluate(()=>[...document.querySelectorAll('#side a.nav')].map(a=>a.textContent.trim().replace(/\d+$/,'')+(a.classList.contains('on')?'*':'')).join(' | '));
const tabs=()=>p.evaluate(()=>[...document.querySelectorAll('.menu-tabs a')].map(a=>a.textContent.trim()+(a.classList.contains('on')?'*':'')).join(' | '));
for(const r of ['Gasto','Administrador','Colaborador','Invitado']){await p.evaluate(r=>{rolActual=()=>r;go('dashboard')},r);await p.waitForTimeout(300);console.log(r,'→',await menu());}
await p.evaluate(()=>{rolActual=()=>'Gasto';UI.uiOv='pro';go('riesgos')});await p.waitForTimeout(500);console.log('riesgos tabs:',await tabs(),'| menu:',await menu());
await p.screenshot({path:'menu1.png'});
await p.evaluate(()=>go('gantt'));await p.waitForTimeout(300);await p.click('#side a[title="Gobierno"]');await p.waitForTimeout(300);await p.click('#side a[title="Planificación"]');await p.waitForTimeout(400);console.log('vuelve a:',await p.evaluate(()=>UI.view));
await p.evaluate(()=>{rolActual=()=>'Colaborador';go('dashboard')});await p.click('#side a[title="Mis pendientes"]');await p.waitForTimeout(400);console.log('pend:',await p.evaluate(()=>UI.view+' mine='+FL.mine),await tabs());
console.log(JSON.stringify(errs));await b.close()})();
