const { chromium, launchOpts } = require('./_pw');
(async()=>{const b=await chromium.launch(launchOpts);const p=await b.newPage({viewport:{width:1440,height:1000}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
const txt=require('fs').readFileSync('/tmp/t/out/iniciativas-sinteticas.json','utf8');
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
const r=await p.evaluate(async(txt)=>{celebrar=()=>{};const n0=[St.ini.length,St.hitos.length,St.riesgos.length];
 Chg.impinifile({files:[new File([txt],'x.json')],value:''});await new Promise(r=>setTimeout(r,400));
 [...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Importar').click();for(let k=0;k<60&&St.ini.length===n0[0];k++)await new Promise(r=>setTimeout(r,200));await new Promise(r=>setTimeout(r,400));
 return {d:[St.ini.length-n0[0],St.hitos.length-n0[1],St.riesgos.length-n0[2]],h:St.hitos.slice(-2),r:St.riesgos.slice(-1)[0].id,msg:document.querySelector('.toast,#toast')?.textContent}},txt);
console.log(JSON.stringify(r),errs);await b.close()})();
