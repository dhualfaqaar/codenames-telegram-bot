import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL||'http://localhost:3000';
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await page.addInitScript(() => { navigator.sendBeacon=()=>true; });
 const post=async(body)=>(await (await page.request.post(base+'/api/amongus/rooms',{data:body})).json());
 const first=await post({action:'create',name:'host'}),code=first.code,tokens=[first.token];
 for(let i=0;i<5;i++)tokens.push((await post({action:'join',code,name:'crew'+i})).token);
 await post({action:'start',code,token:tokens[0]});
 let imp,crew=[];for(const token of tokens){let s=await (await page.request.get(base+'/api/amongus/rooms/'+code+'?token='+token)).json();(s.room.role==='impostor'? (imp=token):crew.push(token))}
 assert.ok(imp);const player=crew[0];
 async function action(token,action,extra={}){let r=await post({code,token,action,...extra});assert.ok(r.ok,JSON.stringify(r));return r}
 async function openAt(x,y){await action(player,'move',{x,y});await page.goto(base+'/amongus');await page.evaluate(({code,player})=>{window.__auState.code=code;window.__auState.token=player},{code,player});await page.locator('#auStage.on').waitFor();await page.waitForFunction(([x,y])=>{let p=window.__auState.room?.players.find(p=>p.you);return p && Math.abs(p.x-x)<.5 && Math.abs(p.y-y)<.5},[x,y]);await page.locator('#auUse').click();await page.locator('#auFixDialog.on').waitFor()}
 await action(imp,'sabotage',{kind:'oxygen'});await openAt(74,38);
 await page.locator('#auOxygenInput').fill('00000');await page.locator('#auFixSubmit').click();await page.waitForTimeout(200);assert.equal(await page.locator('#auFixDialog').isVisible(),true);
 let code1=await page.locator('#auOxygenCode').innerText();await page.locator('#auOxygenInput').fill(code1);await page.locator('#auFixSubmit').click();await page.locator('#auFixDialog').waitFor({state:'hidden'});
 await openAt(65,48);let code2=await page.locator('#auOxygenCode').innerText();await page.locator('#auOxygenInput').fill(code2);await page.locator('#auFixSubmit').click();await page.waitForFunction(()=>!window.__auState.room.sabotage);
 await action(imp,'sabotage',{kind:'lights'});await openAt(34,70);for(let i=0;i<3;i++){await page.locator('#auLightsButtons button').filter({hasText:'OFF'}).first().click();await page.waitForTimeout(150)}await page.waitForFunction(()=>!window.__auState.room.sabotage);
 await action(imp,'sabotage',{kind:'comms'});await openAt(68,85);let freq=await page.evaluate(()=>window.__auState.room.sabotage.frequency);await page.locator('#auFrequency').fill(String(freq));await page.locator('#auFixSubmit').click();await page.waitForFunction(()=>!window.__auState.room.sabotage);
 await action(imp,'sabotage',{kind:'reactor'});await action(crew[1],'move',{x:9,y:55});await openAt(9,45);
 const box=await page.locator('#auReactorHold').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.waitForFunction(()=>window.__auState.room.sabotage.held.includes('north'));
 await action(crew[1],'fix',{part:'south',holding:true});await page.waitForFunction(()=>!window.__auState.room.sabotage);await page.mouse.up();
 assert.deepEqual(errors,[]);console.log('Browser sabotage consoles: two oxygen codes, switches, frequency and simultaneous reactor hold passed (positions set by API).');
}finally{await browser.close()}
