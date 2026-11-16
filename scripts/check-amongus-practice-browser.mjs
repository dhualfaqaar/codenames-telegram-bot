// Exercise solo play through the actual UI, including movement and a task.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
try {
 const page=await browser.newPage({viewport:{width:844,height:390}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',route=>route.fulfill({body:''}));
 await page.goto(base+'/amongus');await page.locator('#auPlayBtn').click();
 assert.ok(await page.locator('#auPractice').isVisible());
 await page.locator('#auPractice').click();await page.locator('#auStage.on').waitFor();
 assert.equal(await page.evaluate(()=>window.__auState.room.players.length),1);
 assert.equal(await page.locator('#auRoleText').textContent(),'تجربة فردية');
 assert.equal(await page.locator('#auEmergency').isVisible(),false);
 assert.equal(await page.locator('#auPracticeExit').isVisible(),true);
 assert.equal(await page.locator('#auTaskChip').textContent(),'0/15');
 await page.locator('#auMapToggle').click();
 if(process.env.GAMES_SCREENSHOT_DIR)await page.screenshot({path:process.env.GAMES_SCREENSHOT_DIR+'/practice-map.png'});
 await page.locator('#auMapToggle').click();
 // Move towards the central cafeteria task and complete the timed upload.
 await page.keyboard.down('ArrowUp'); await page.waitForTimeout(350); await page.keyboard.up('ArrowUp');
 await page.waitForTimeout(300);await page.locator('#auUse').click();
 await page.locator('#auUpload').waitFor();
 await page.locator('#auUpload').click();
 await page.waitForFunction(()=>document.querySelector('#auTaskChip').textContent==='1/15');
 assert.equal(await page.evaluate(()=>window.__auState.room.phase),'playing');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('#auPad').isVisible());assert.ok(await page.locator('#auPracticeExit').isVisible());
 await page.locator('#auPracticeExit').click();await page.locator('#auMenu.on').waitFor();
 await page.waitForTimeout(1100);assert.ok(await page.locator('#auMenu.on').isVisible());
 assert.deepEqual(errors,[]);
 console.log('Solo UI: start alone, movement, task completion, map, rotation, exit passed.');
} finally {await browser.close()}
