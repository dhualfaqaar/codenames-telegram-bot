import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
const base=process.env.GAMES_TEST_URL||'http://localhost:3000';
try {
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));let requests=0;
 await page.route('**/api/amongus/**',route=>{requests++;return route.abort('failed')});
 await page.goto(base+'/amongus');await page.locator('#auPlayBtn').click();await page.locator('#auPractice').click();await page.locator('#auStage.on').waitFor({timeout:12000});
 assert.equal(await page.evaluate(()=>window.__auState.room.practice),true);assert.equal(await page.evaluate(()=>window.__auState.code),'LOCAL');
 assert.equal(await page.locator('#auTaskChip').textContent(),'0/15');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(350);await page.keyboard.up('ArrowUp');await page.waitForTimeout(300);
 await page.locator('#auUse').click();await page.locator('#auUpload').click();await page.waitForFunction(()=>document.querySelector('#auTaskChip').textContent==='1/15',{},{timeout:8000});
 const before=requests;await page.waitForTimeout(1100);assert.equal(requests,before,'offline practice does not poll or submit moves to server');
 await page.locator('#auPracticeExit').click();await page.locator('#auMenu.on').waitFor();
 const second=await browser.newPage({viewport:{width:844,height:390}});second.on('pageerror',e=>errors.push(String(e)));await second.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await second.route('**/api/amongus/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'service unavailable'})}));
 await second.goto(base+'/amongus');await second.locator('#auPlayBtn').click();await second.locator('#auPractice').click();await second.locator('#auStage.on').waitFor();assert.equal(await second.evaluate(()=>window.__auState.code),'LOCAL');
 assert.deepEqual(errors,[]);console.log('Browser offline fallback: network error and 503, local solo start, movement, task and exit passed.');
}finally{await browser.close()}
