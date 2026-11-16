import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL||'http://localhost:3000';
try{
 const host=await browser.newPage({viewport:{width:844,height:390}}),guest=await browser.newPage({viewport:{width:844,height:390}}),errors=[];
 for(const p of [host,guest]){p.on('pageerror',e=>errors.push(String(e)));await p.route('https://telegram.org/**',r=>r.fulfill({body:''}));await p.goto(base+'/amongus')}
 await host.locator('#auPlayBtn').click();await host.locator('#auCreate').click();await host.locator('#auCreateRoom').click();await host.locator('#auLobby.on').waitFor();
 const code=await host.locator('#auCodeLabel').textContent();await guest.locator('#auPlayBtn').click();await guest.locator('#auCodeCard').click();await guest.locator('#auCode').fill(code);await guest.locator('#auJoin').click();await guest.locator('#auLobby.on').waitFor();
 await host.waitForFunction(()=>window.__auState.room.players.length===2);await guest.waitForFunction(()=>window.__auState.room.players.length===2);
 const before=await guest.evaluate(()=>window.__auState.room.players.find(p=>!p.you).x);
 await host.keyboard.down('ArrowRight');await host.waitForTimeout(700);await host.keyboard.up('ArrowRight');
 await guest.waitForFunction(x=>window.__auState.room.players.find(p=>!p.you).x>x+4,before,{timeout:6000});
 const own=host.locator('#auNames .who.you'),x=await own.evaluate(el=>parseFloat(el.style.left));assert.ok(x>before+4);
 const pad=await host.locator('#auLobbyPad').boundingBox();await host.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);await host.mouse.down();await host.mouse.move(pad.x+pad.width*.8,pad.y+pad.height/2);await host.waitForTimeout(400);await host.mouse.up();
 await host.waitForFunction(x=>parseFloat(document.querySelector('#auNames .who.you').style.left)>x+2,x);
 await host.setViewportSize({width:390,height:844});assert.ok(await host.locator('#auLobbyPad').isVisible());assert.ok(await host.locator('#auAddBot').isVisible());assert.ok(await host.locator('#auStart').isVisible());
 if(process.env.GAMES_SCREENSHOT_DIR)await host.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/lobby-portrait.png'});
 // Delayed lobby messages must not teleport a player after the round starts.
 for(let i=0;i<4;i++){await host.locator('#auAddBot').click();await host.waitForFunction(n=>window.__auState.room.players.length===n+3,i)}
 await host.locator('#auStart').click();await host.locator('#auStage.on').waitFor();
 const snapshot=await host.evaluate(()=>({code:window.__auState.code,token:window.__auState.token,me:window.__auState.room.players.find(p=>p.you)}));
 const delayed=await (await host.request.post(base+'/api/amongus/rooms/'+snapshot.code,{data:{action:'lobbyMove',code:snapshot.code,token:snapshot.token,x:80,y:75,seq:9999}})).json();
 assert.equal(delayed.room.players.find(p=>p.you).x,snapshot.me.x);assert.equal(delayed.room.players.find(p=>p.you).y,snapshot.me.y);
 assert.deepEqual(errors,[]);console.log('Lobby: keyboard and joystick movement, other player sees it, portrait controls and late-packet safety passed.');
}finally{await browser.close()}
