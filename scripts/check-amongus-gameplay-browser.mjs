import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
try {
 const page=await browser.newPage({viewport:{width:844,height:390}}); const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await page.goto(base+'/amongus'); await page.locator('#auPlayBtn').click();await page.locator('#auPractice').click();await page.locator('#auStage.on').waitFor();
 async function move(axis,target){
   for(let n=0;n<24;n++){
     const pos=await page.evaluate(()=>window.__auState.room.players.find(p=>p.you));
     const diff=target-pos[axis]; if(Math.abs(diff)<1.5)return;
     const key=axis==='x'?(diff>0?'ArrowRight':'ArrowLeft'):(diff>0?'ArrowDown':'ArrowUp');
     await page.keyboard.down(key);await page.waitForTimeout(Math.min(400,Math.max(100,Math.abs(diff)*48)));await page.keyboard.up(key);await page.waitForTimeout(260);
   }
   throw Error('cannot reach '+axis+':'+target);
 }
 await move('x',50);await move('y',51);await move('x',63);
 await page.locator('#auUse').click();await page.locator('#auAccessCard').waitFor();
 const card=await page.locator('#auAccessCard').boundingBox(),reader=await page.locator('#auCardReader').boundingBox();
 await page.mouse.move(card.x+card.width/2,card.y+card.height/2);await page.mouse.down();
 await page.mouse.move(reader.x+reader.width-15,card.y+card.height/2,{steps:12});await page.waitForTimeout(300);await page.mouse.up();
 await page.waitForFunction(()=>window.__auState.room.players.find(p=>p.you).tasks.find(t=>t.station==='st-seq-admin').done,{timeout:8000});
 await move('x',51);await move('y',79);await move('x',36);await move('y',71);
 await page.locator('#auUse').click();await page.locator('.wire-board').waitFor();
 for(let i=0;i<4;i++){
  const left=await page.locator(`[data-left="${i}"]`).boundingBox(),right=await page.locator(`[data-right="${i}"]`).boundingBox();
  await page.mouse.move(left.x+left.width/2,left.y+left.height/2);await page.mouse.down();
  await page.mouse.move(right.x+right.width/2,right.y+right.height/2,{steps:8});await page.mouse.up();
 }
 await page.waitForFunction(()=>window.__auState.room.players.find(p=>p.you).tasks.find(t=>t.station==='st-wires-elec').done,{timeout:8000});
 assert.deepEqual(errors,[]); console.log('Practice: real corridor movement, card swipe and four dragged wires passed.');
} finally {await browser.close()}
