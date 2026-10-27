const { chromium, launchOpts } = require('./_pw');
(async()=>{const b=await chromium.launch(launchOpts);const p=await b.newPage({viewport:{width:1440,height:900}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{UI.uiOv='pro';go('admin')});await p.waitForTimeout(500);
await p.uncheck('input[data-r=Invitado][data-k=planificacion]');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>JSON.stringify(St.cfg.menuRol&&St.cfg.menuRol.Invitado)));
await p.evaluate(()=>{rolActual=()=>'Invitado';go('dashboard')});await p.waitForTimeout(300);
console.log(await p.evaluate(()=>[...document.querySelectorAll('#side a.nav')].map(a=>a.textContent.trim()).join('|')));
await p.evaluate(()=>{rolActual=()=>'Administra';go('miconfig')});await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('#main').scrollTo(0,900));await p.screenshot({path:'menu2.png'});console.log(JSON.stringify(errs));await b.close()})();
