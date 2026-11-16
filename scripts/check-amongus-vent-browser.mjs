import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});const base=process.env.GAMES_TEST_URL||'http://localhost:3000';
try{
 const page=await browser.newPage({viewport:{width:844,height:390}});let errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 const post=async(body)=>await (await page.request.post(base+'/api/amongus/rooms',{data:body})).json();
 const host=await post({action:'create',name:'host'}),code=host.code,tokens=[host.token];
 for(let i=0;i<5;i++)tokens.push((await post({action:'join',code,name:'crew'+i})).token);
 await post({action:'start',code,token:tokens[0]});
 let imp;
 for(const token of tokens){let s=await (await page.request.get(base+'/api/amongus/rooms/'+code+'?token='+token)).json();if(s.room.role==='impostor'){imp=token;break}}
 assert.ok(imp);
 await page.goto(base+'/amongus');await page.evaluate(({code,imp})=>{window.__auState.code=code;window.__auState.token=imp},{code,imp});await page.locator('#auStage.on').waitFor();
 async function move(axis,target){for(let i=0;i<18;i++){const p=await page.evaluate(()=>window.__auState.room.players.find(p=>p.you)),d=target-p[axis];if(Math.abs(d)<1.2)return;const key=axis==='x'?(d>0?'ArrowRight':'ArrowLeft'):(d>0?'ArrowDown':'ArrowUp');await page.keyboard.down(key);await page.waitForTimeout(Math.min(400,Math.max(100,Math.abs(d)*48)));await page.keyboard.up(key);await page.waitForTimeout(250)}throw Error('move '+axis+' '+target)}
 await move('x',50);await move('y',22);await move('x',60);await page.locator('#auVent').click();await page.locator('#auVentDialog.on').waitFor();
 assert.ok(await page.locator('[data-vent="admin"]').isVisible());assert.ok(await page.locator('[data-vent="hall"]').isVisible());
 const other=tokens.find(t=>t!==imp);let hidden=await (await page.request.get(base+'/api/amongus/rooms/'+code+'?token='+other)).json();
 const impName=await page.evaluate(()=>window.__auState.room.players.find(p=>p.you).name);assert.equal(hidden.room.players.find(p=>p.name===impName).x,null);
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/vent.png'});
 await page.locator('[data-vent="admin"]').click();await page.waitForFunction(()=>window.__auState.room.players.find(p=>p.you).x===64);
 await page.locator('#auVentExit').click();await page.locator('#auVentDialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__auState.room.inVent),false);
 assert.deepEqual(errors,[]);console.log('Vent browser: walk to vent, disappear, choose connected exit and emerge passed.');
}finally{await browser.close()}
