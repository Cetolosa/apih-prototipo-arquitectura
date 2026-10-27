const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1250,height:640}});await p.addInitScript(()=>localStorage.setItem('apih_tour22','1'));const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/demo/index.html');await p.waitForTimeout(1500);
await p.screenshot({path:'rail0.png'});
await p.click('[data-act=rail]');await p.waitForTimeout(400);
console.log('rail',await p.evaluate(()=>document.querySelector('#app').classList.contains('rail')+' w='+document.querySelector('#side').offsetWidth+' ls='+localStorage.getItem('apih_rail')));
await p.mouse.move(700,300);await p.waitForTimeout(300);await p.screenshot({path:'rail1.png'});
await p.mouse.move(30,200);await p.waitForTimeout(400);console.log('hover w=',await p.evaluate(()=>document.querySelector('#side').offsetWidth));await p.screenshot({path:'rail2.png'});

await p.click('#side .rail-t');await p.waitForTimeout(300);console.log('after toggle',await p.evaluate(()=>document.querySelector('#app').classList.contains('rail')+' w='+document.querySelector('#side').offsetWidth));
await p.click('[data-act=rail]');await p.waitForTimeout(300);await p.mouse.move(30,200);await p.waitForTimeout(300);console.log('nohov holds w=',await p.evaluate(()=>document.querySelector('#side').offsetWidth));await p.mouse.move(700,300);await p.mouse.move(30,200);await p.waitForTimeout(400);console.log('re-hover w=',await p.evaluate(()=>document.querySelector('#side').offsetWidth));
await p.reload();await p.waitForTimeout(1200);console.log('persist',await p.evaluate(()=>document.querySelector('#app').classList.contains('rail')));
console.log(errs);await b.close()})();
