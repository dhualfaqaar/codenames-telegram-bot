// Local browser art + gameplay smoke test. Run against npm run dev.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390}});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',route=>route.fulfill({body:''}));
 await page.addInitScript(()=>{
   window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id:111,first_name:'أحمد'}},isFullscreen:true,safeAreaInset:{top:24,bottom:20},contentSafeAreaInset:{top:64,bottom:20},ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast(){return true}}};
   window.__artDraws={scene:0,sprites:0};const old=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){if(image instanceof HTMLImageElement && image.src.includes('amongus-cafeteria-art-v1')) window.__artDraws.scene++;if(image instanceof HTMLCanvasElement && image.width>100)window.__artDraws.sprites++;return old.call(this,image,...args)};
 });
 for(const path of ['/amongus-crew-v1.png','/amongus-cafeteria-art-v1.jpg','/amongus-ship-art-v1.jpg','/amongus-deck-v2.jpg']){const res=await page.request.get(base+path);assert.equal(res.status(),200,`${path} served`);assert.match(res.headers()['content-type'],/^image\//)}
 await page.goto(base+'/amongus');await page.waitForFunction(()=>window.__artDraws.scene>0);
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-menu.png'});
 await page.locator('#auPlayBtn').click();await page.locator('#auCreate').click();await page.locator('#auCreateRoom').click();await page.locator('#auLobby.on').waitFor();
 assert.doesNotMatch(await page.locator('#auLobby .room').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),/amongus-ship-art-v1/);
 assert.equal(await page.locator('#auPracticeExit').isVisible(),false);
 for(let n=0;n<5;n++){await page.locator('#auAddBot').click();await page.waitForFunction(n=>Number(document.querySelector('#auCount').textContent)>=n+2,n)}
 assert.equal(await page.locator('#auStart').isDisabled(),false);
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-lobby.png',fullPage:true});
 await page.locator('#auStart').click();await page.locator('#auStage.on').waitFor();await page.waitForFunction(()=>window.__artDraws.sprites>0);
 assert.ok(await page.locator('#auCanvas').isVisible());assert.ok(await page.locator('#auPad').isVisible());
 await page.locator('#auMapToggle').click();assert.equal(await page.locator('#auMapToggle').getAttribute('aria-pressed'),'true');if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-map.png'});await page.locator('#auMapToggle').click();assert.equal(await page.locator('#auMapToggle').getAttribute('aria-pressed'),'false');
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-playing.png'});
 // Movement is still accepted by the engine after the visual changes.
 const requests=[];page.on('request',r=>{if(r.url().includes('/api/amongus/rooms/') && r.method()==='POST')requests.push(r.postDataJSON())});
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(850);await page.keyboard.up('ArrowUp');
 const moves=requests.filter(r=>r && r.action==='move');assert.ok(moves.length>0,'movement intent sent');
 assert.ok(moves.every(r=>r.x>=38 && r.x<=62 && r.y>=4 && r.y<=20),'predicted movement remains within the server cafeteria geometry');
 // Return to the button after the movement check, independent of random spawn.
 await page.evaluate(async()=>{const s=window.__auState;await fetch('/api/amongus/rooms/'+s.code,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'move',code:s.code,token:s.token,x:50,y:12})})});
 await page.locator('#auEmergency').click();await page.locator('#auMeetingDialog.on').waitFor({timeout:10000});
 assert.match(await page.locator('#auMeetingDialog').evaluate(el=>getComputedStyle(el).backgroundImage),/amongus-cafeteria-art-v1/);
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-meeting.png'});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#auSkipVote').isVisible());
 // A missing illustration must not prevent a game from being started or drawn.
 const fallback=await browser.newPage({viewport:{width:740,height:360}});fallback.on('pageerror',e=>errors.push(String(e)));
 await fallback.route('https://telegram.org/**',route=>route.fulfill({body:''}));
 await fallback.route('**/amongus-*-v1.*',route=>route.fulfill({status:404,body:''}));
 await fallback.route('**/amongus-deck-v2.jpg',route=>route.fulfill({status:404,body:''}));
 await fallback.goto(base+'/amongus');await fallback.locator('#auPlayBtn').click();await fallback.locator('#auCreate').click();await fallback.locator('#auCreateRoom').click();await fallback.locator('#auLobby.on').waitFor();
 for(let n=0;n<5;n++){await fallback.locator('#auAddBot').click();await fallback.waitForFunction(n=>Number(document.querySelector('#auCount').textContent)>=n+2,n)}
 await fallback.locator('#auStart').click();await fallback.locator('#auStage.on').waitFor();assert.ok(await fallback.locator('#auCanvas').isVisible());
 await fallback.waitForTimeout(300);await fallback.close();
 assert.deepEqual(errors,[]);
 console.log('Among Us browser art: image delivery, title, lobby, sprites, movement, emergency meeting and rotation passed.');
}finally{await browser.close()}
