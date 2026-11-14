// Optional browser check: start npm run dev and provide PLAYWRIGHT_MODULE and
// CHROMIUM_EXECUTABLE as in the other responsive browser checks. All API data is mocked.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, headless:true, args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process'] });
const page = await browser.newPage({viewport:{width:1366,height:768}});
const failures=[];
page.on('pageerror', e=>failures.push(String(e)));
await page.addInitScript(()=>{window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id:1,first_name:'أحمد'}},isFullscreen:true,safeAreaInset:{top:24,bottom:20},contentSafeAreaInset:{top:64,bottom:20},ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast(){return true},BackButton:{show(){},hide(){},onClick(){}}}}});
await page.route('https://telegram.org/**',route=>route.fulfill({body:''}));
const players=[{seat:0,name:'أحمد',team:'blue',role:'spymaster'},{seat:1,name:'علي',team:'red',role:'spymaster'},{seat:2,name:'زينب',team:'blue',role:'operative'},{seat:3,name:'مريم',team:'red',role:'operative'}];
const payload={token:'test',room:{id:'ABCDEFGHIJKL',game:'codenames',gameName:'كود نيمز',status:'playing',playerSeat:0,isHost:true,players},state:{players,cards:Array.from({length:25},(_,i)=>({id:i,word:['قمر','كتاب','مدينة','مفتاح','بحر'][i%5],type:['blue','red','bystander','assassin'][i%4],revealed:false})),myTeam:'blue',myRole:'spymaster',currentTurn:'blue',phase:'spymaster_turn',deadline:Date.now()+120000,scores:{blueRemaining:8,redRemaining:9},wordPack:'arabic_standard'}};
await page.route('**/api/interactive/**',route=>route.fulfill({json:route.request().url().includes('/config')?{}:payload}));
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
async function checkBoard(selector,width,height,stage){
  await page.setViewportSize({width,height});
  const v=await page.evaluate(selector=>{const board=document.querySelector(selector).getBoundingClientRect();return {left:board.left,right:board.right,top:board.top,bottom:board.bottom,scroll:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,background:getComputedStyle(document.querySelector('#ambientBackdrop')).backgroundImage}},selector);
  assert.ok(v.left>=-1 && v.right<=width+1 && v.top>=0 && v.bottom<=height+1,`${stage} board outside ${width}x${height}: ${JSON.stringify(v)}`);
  assert.ok(v.scroll<=width+1,`${stage} horizontal overflow`);
  assert.ok(v.scrollHeight<=height+1,`${stage} vertical overflow: ${JSON.stringify(v)}`);
  assert.ok(!v.background.includes('games-library-v1.jpg'),'library wallpaper must not appear inside Codenames');
  const teams=await page.evaluate(selector=>Object.fromEntries(['blue','red'].map(t=>{const layout=document.querySelector(selector).closest('.code-match-layout');const r=layout.querySelector('.code-team.'+t).getBoundingClientRect();return [t,{top:r.top,bottom:r.bottom,left:r.left,right:r.right}]})),selector);
  for(const t of Object.values(teams))assert.ok(t.top>=0 && t.bottom<=height+1 && t.left>=-1 && t.right<=width+1,`${stage} team clipped ${width}x${height}: ${JSON.stringify(teams)}`);
  if(width<=720 && height>width)assert.ok(teams.blue.bottom<=v.top+1 && teams.red.top>=v.bottom-1,`${stage} expected blue above board and red below at ${width}x${height}: ${JSON.stringify({teams,v})}`);
  if(process.env.GAMES_SCREENSHOT_DIR && [360,390,1366].includes(width)) await page.screenshot({path:`${process.env.GAMES_SCREENSHOT_DIR}/codenames-${stage}-${width}.png`});
}
try{
  await page.goto(`${base}/interactive`);
  assert.ok((await page.locator('#ambientBackdrop').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('games-library-v1.jpg'));
  await page.locator('.game-card[data-game="codenames"]').click();
  await page.waitForURL('**/codenames');
  await page.waitForSelector('.code-home .code-placeholder');
  assert.equal(await page.locator('.code-home .code-placeholder').count(),25);
  assert.equal(await page.locator('.code-home .code-card').count(),0);
  assert.equal(await page.locator('#gameSetupPage > .room-header').isVisible(),false);
  for(const [w,h] of [[1366,768],[390,844],[360,640],[280,640],[844,390]]) await checkBoard('.code-home .code-board',w,h,'home');
  assert.equal(await page.locator('#codeRoomsPanel').count(),0);
  assert.equal(await page.locator('#codeJoinPanel').count(),0);
  await page.locator('[data-code-start-team="blue"][data-code-start-role="operative"]').click();
  await page.waitForSelector('.code-room .code-card');
  assert.equal(await page.locator('.code-room .code-card').count(),25);
  assert.equal(await page.locator('.code-room .code-role-box').count(),4);
  assert.equal(await page.locator('#roomPage > .room-header').isVisible(),false);
  for(const [w,h] of [[1366,768],[390,844],[360,640],[280,640],[844,390]]) await checkBoard('.code-room .code-board',w,h,'match');
  payload.state.myRole='operative';payload.state.phase='operative_turn';payload.state.clue={word:'تلميحمميز',count:2,remainingGuesses:2};
  await page.waitForSelector('[data-action="code-pass"]');
  for(const [w,h] of [[1366,768],[390,844],[360,640],[280,640],[844,390]]) await checkBoard('.code-room .code-board',w,h,'clue');
  assert.deepEqual(failures,[]);
  console.log('Codenames browser: separate board, library-only wallpaper, room controls and viewport bounds passed.');
} finally{await browser.close()}
