import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
try{
 const page=await browser.newPage({viewport:{width:844,height:390}});let errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));await page.goto(base+'/amongus');await page.locator('#auPlayBtn').click();await page.locator('#auPractice').click();await page.locator('#auStage.on').waitFor();
 const screenshot=async(name)=>{if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/'+name+'.png'})};
 async function move(axis,target){for(let i=0;i<34;i++){let p=await page.evaluate(()=>window.__auState.room.players.find(p=>p.you));let d=target-p[axis];if(Math.abs(d)<1.3)return;let key=axis==='x'?(d>0?'ArrowRight':'ArrowLeft'):(d>0?'ArrowDown':'ArrowUp');await page.keyboard.down(key);await page.waitForTimeout(Math.min(400,Math.max(100,Math.abs(d)*48)));await page.keyboard.up(key);await page.waitForTimeout(260)}throw Error('cannot reach '+axis+'='+target)}
 async function finished(station){await page.waitForFunction(st=>window.__auState.room.players.find(p=>p.you).tasks.find(t=>t.station===st).done,station,{timeout:8000})}
 await move('y',17);await move('x',77);await move('y',20);await page.locator('#auUse').click();await page.locator('#auAsteroids').waitFor();await screenshot('asteroids');
 for(let n=0;n<20;n++)await page.locator('.rock').last().click();await finished('st-seq-weapons');
 await move('x',76);await move('y',38);await page.locator('#auUse').click();await page.locator('#auFilter').waitFor();await screenshot('filter');
 for(let n=0;n<5;n++){let leaf=await page.locator('.filter-leaf').first().boundingBox(),vent=await page.locator('#auFilterVent').boundingBox();await page.mouse.move(leaf.x+leaf.width/2,leaf.y+leaf.height/2);await page.mouse.down();await page.mouse.move(vent.x+vent.width/2,vent.y+vent.height/2,{steps:8});await page.mouse.up()}
 await finished('st-seq-o2');
 await move('y',41);await move('x',94);await page.locator('#auUse').click();await page.locator('#auSteering').waitFor();await screenshot('steering');
 let knob=await page.locator('#auSteeringKnob').boundingBox(),panel=await page.locator('#auSteering').boundingBox();await page.mouse.move(knob.x+knob.width/2,knob.y+knob.height/2);await page.mouse.down();await page.mouse.move(panel.x+panel.width/2,panel.y+panel.height/2,{steps:8});await page.mouse.up();await finished('st-hold-nav');
 await move('x',83);await move('y',73);await move('x',82);await page.locator('#auUse').click();await page.locator('#auShields').waitFor();await screenshot('shields');
 for(let i=0;i<4;i++)await page.locator('#auShields button:not(.lit)').first().click();await finished('st-wires-shield');
 await move('y',79);await move('x',51);await move('x',20);await move('y',49);await move('x',24);
 await page.locator('#auCameras').waitFor({state:'visible'});await page.locator('#auCameras').click();await page.locator('#auCamsDialog.on').waitFor();
 const feeds=await page.evaluate(()=>window.__auState.room.cameraFeeds);assert.equal(feeds.length,4);assert.ok(feeds.some(f=>f.players.some(p=>p.name==='لاعب')));
 await screenshot('cameras');await page.locator('#auCamsClose').click();await page.locator('#auCamsDialog').waitFor({state:'hidden'});
 assert.deepEqual(errors,[]);console.log('Practice: asteroid, filter, steering, shields and four security camera views passed by actual walking and interaction.');
}finally{await browser.close()}
