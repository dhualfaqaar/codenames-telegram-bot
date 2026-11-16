import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
try {
 const page=await browser.newPage({viewport:{width:844,height:390}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));await page.goto(base+'/amongus');
 await page.locator('#auPlayBtn').click();await page.locator('#auCreate').click();await page.locator('#auCreateRoom').click();await page.locator('#auLobby.on').waitFor();
 for(let n=0;n<5;n++){await page.locator('#auAddBot').click();await page.waitForFunction(n=>Number(document.querySelector('#auCount').textContent)>=n+2,n)}
 await page.locator('#auStart').click();await page.locator('#auStage.on').waitFor();
 const room=await page.evaluate(()=>window.__auState.room);
 assert.equal(room.bodies.length,0);assert.equal(room.players.filter(p=>p.alive).length,6);
 // Start meeting, send a message, wait for all bots, then cast host vote.
 await page.locator('#auEmergency').click();await page.locator('#auMeetingDialog.on').waitFor();
 assert.ok(await page.locator('#auMeetingInput').isVisible()); assert.ok(await page.locator('#auSkipVote').isVisible());
 await page.locator('#auMeetingInput').fill('وين كنتوا؟');await page.locator('#auMeetingForm button').click();
 await page.getByText('وين كنتوا؟').waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('#auMeetingInput').isVisible());assert.ok(await page.locator('#auSkipVote').isVisible());
 if(process.env.GAMES_SCREENSHOT_DIR) await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/among-meeting-portrait.png'});
 await page.setViewportSize({width:844,height:390});
 await page.waitForFunction(()=>window.__auState.room.meeting?.votes.length===5,{timeout:12000});
 await page.locator('#auSkipVote').click();await page.waitForFunction(()=>window.__auState.room.phase==='playing');
 assert.equal(await page.evaluate(()=>window.__auState.room.lastMeeting.tied),true);
 assert.equal(await page.locator('#auMeetingDialog.on').count(),0);
 assert.match(await page.locator('#auToast').textContent(),/ما انطرد أحد/);
 assert.deepEqual(errors,[]);console.log('Browser multiplayer: 6 players, no instant kill, meeting chat, 5 bot votes, skip and resume passed.');
}finally{await browser.close()}
