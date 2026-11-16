import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL||'http://localhost:3000';
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>{navigator.sendBeacon=()=>true});await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await page.goto(base+'/amongus');await page.locator('#auPlayBtn').click();await page.locator('#auPractice').click();await page.locator('#auStage.on').waitFor();
 const {code,token}=await page.evaluate(()=>window.__auState);
 async function at(x,y){let r=await (await page.request.post(base+'/api/amongus/rooms',{data:{action:'move',code,token,x,y}})).json();assert.ok(r.ok);await page.goto(base+'/amongus');await page.evaluate(({code,token})=>{window.__auState.code=code;window.__auState.token=token},{code,token});await page.locator('#auStage.on').waitFor();await page.waitForFunction(([x,y])=>{let p=window.__auState.room?.players.find(p=>p.you);return p && Math.abs(p.x-x)<.5 && Math.abs(p.y-y)<.5},[x,y]);await page.locator('#auUse').click()}
 const done=async(station)=>page.waitForFunction(st=>window.__auState.room.players.find(p=>p.you).tasks.find(t=>t.station===st).done,station,{timeout:8000});
 await at(32,34);await page.locator('#auScanStart').click();await done('st-hold-med');
 await at(19,20);await page.locator('#auEngineSlider').fill('50');await done('st-upper');
 await at(19,79);await page.locator('#auEngineSlider').fill('50');await done('st-lower');
 await at(9,50);await page.locator('[data-seq]').first().waitFor();
 // Record the visible signals as a player would, not the hidden pattern state.
 let pattern=await page.evaluate(()=>new Promise((resolve,reject)=>{let seen=[],prev='';const start=Date.now();let t=setInterval(()=>{const lit=document.querySelector('[data-seq].lit'), v=lit?.getAttribute('data-seq')||'';if(v!=='' && v!==prev)seen.push(Number(v));prev=v;if(document.querySelector('#auTaskBody .hint')?.textContent.includes('دورك')){clearInterval(t);resolve(seen)}else if(Date.now()-start>8000){clearInterval(t);reject(Error('sequence timeout'))}},25)}));
 assert.equal(pattern.length,5,JSON.stringify(pattern));for(const n of pattern)await page.locator(`[data-seq="${n}"]`).click();await done('st-hold-reactor');
 assert.deepEqual(errors,[]);console.log('Browser tasks: scan, both engine alignments and observed reactor sequence passed (positions set by API).');
}finally{await browser.close()}
