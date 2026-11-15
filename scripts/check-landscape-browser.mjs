// Local in-memory rooms; mock Telegram insets. Resize during live play.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote']});
const base=process.env.GAMES_TEST_URL || 'http://localhost:3000';
const contexts=[];
async function client(id){
 const context=await browser.newContext({viewport:{width:844,height:390}});contexts.push(context);
 await context.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await context.addInitScript(id=>{window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id,first_name:'لاعب '+id}},isFullscreen:true,safeAreaInset:{top:24,bottom:20},contentSafeAreaInset:{top:64,bottom:20},ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},requestFullscreen(){},onEvent(){},isVersionAtLeast(){return true},BackButton:{show(){},hide(){},onClick(){}}}}},id);
 return context.newPage();
}
async function check(page, selectors, label){
 const viewport=page.viewportSize();
 for(const selector of selectors){const rect=await page.locator(selector).first().boundingBox();assert.ok(rect,`${label} ${selector} missing`);assert.ok(rect.x>=-1 && rect.y>=63 && rect.x+rect.width<=viewport.width+1 && rect.y+rect.height<=viewport.height-19,`${label} ${selector} outside safe viewport: ${JSON.stringify(rect)} in ${JSON.stringify(viewport)}`)}
}
try{
 const host=await client(1),guest=await client(2);
 await host.goto(base+'/gartic');await host.locator('#drawOpenRooms').click();await host.locator('#drawCreateRoom').click();await host.locator('[data-action="friend"]').click();await host.locator('.draw-room').waitFor();
 const id=new URL(host.url()).searchParams.get('room');assert.ok(id);
 await guest.goto(base+'/gartic');await guest.locator('#drawRoomCode').fill(id);await guest.locator('#drawJoinButton').click();await guest.locator('.draw-room').waitFor();
 await host.locator('[data-action="start"]').click();await host.locator('.draw-word-choice').first().waitFor();
 for(const [width,height] of [[640,360],[740,360],[844,390]]){await host.setViewportSize({width,height});await check(host,['.draw-word-choice'],`choosing ${width}x${height}`)}
 await host.locator('.draw-word-choice').first().click();await host.locator('.draw-room-tools').waitFor();await guest.locator('#guessInput').waitFor();
 for(const [width,height] of [[640,360],[740,360],[844,390],[390,844],[640,360]]){
  for(const page of [host,guest])await page.setViewportSize({width,height});
  if(width>height){
   for(const [page,role] of [[host,'drawer'],[guest,'guesser']]){
    await check(page,['.draw-room-players','.draw-canvas-wrap','.draw-feed-card','.draw-logs-card',role==='drawer'?'.draw-room-tools':'#guessInput'],`${role} ${width}x${height}`);
    const pos=await page.evaluate(()=>Object.fromEntries(['.draw-room-players','.draw-room-board','.draw-room-bottom'].map(s=>[s,document.querySelector(s).getBoundingClientRect().toJSON()])));
    assert.ok(pos['.draw-room-players'].right<=pos['.draw-room-board'].left+1 && pos['.draw-room-board'].right<=pos['.draw-room-bottom'].left+1,`landscape columns ${JSON.stringify(pos)}`);
   }
   // Every drawing tool is reachable in its own scrollable strip.
   await host.locator('.draw-tool[data-tool]').last().scrollIntoViewIfNeeded();assert.ok(await host.locator('.draw-tool[data-tool]').last().isVisible());
   if(process.env.GAMES_SCREENSHOT_DIR)await host.screenshot({path:`${process.env.GAMES_SCREENSHOT_DIR}/drawing-landscape-${width}.png`});
  }
 }
 const solo=await client(3);await solo.goto(base+'/sudoku?level=easy&new=1');await solo.locator('#board .cell').first().waitFor();
 for(const [width,height] of [[640,360],[740,360],[844,390],[390,844],[640,360]]){
  await solo.setViewportSize({width,height});if(width>height){await check(solo,['.shell .board-wrap','.shell .stats','.shell .controls','.shell .numbers','.shell .bottom-row'],`solo ${width}x${height}`);if(process.env.GAMES_SCREENSHOT_DIR)await solo.screenshot({path:`${process.env.GAMES_SCREENSHOT_DIR}/sudoku-landscape-${width}.png`});}
 }
 for(const game of ['uno','poker']){
  const a=await client(10),b=await client(11);
  await a.goto(base+'/'+game);await a.locator('[data-action="friend"]').first().click();await a.waitForURL('**?room=*');
  const roomId=new URL(a.url()).searchParams.get('room');await b.goto(base+'/'+game+'?room='+roomId);await b.locator('.room-players').waitFor();
  await a.waitForFunction(()=>document.querySelectorAll('.room-players .player-chip').length>=2);
  await a.locator('[data-action="start"]').click();await a.locator(game==='uno'?'.uno-table':'.poker-arena').waitFor();await b.locator(game==='uno'?'.uno-table':'.poker-arena').waitFor();
  for(const [width,height] of [[640,360],[740,360],[844,390],[390,844],[640,360]]){
   for(const page of [a,b]){
    await page.setViewportSize({width,height});
    if(width>height){
     await page.evaluate(()=>window.scrollTo(0,0));
     const selectors=game==='uno'?['.room-players','.uno-table','.uno-table+section','.hand','.uno-controls']:['.room-players','.poker-arena','.poker-board','.poker-players'];
     if(game==='poker' && await page.locator('.poker-controls button').count())selectors.push('.poker-controls');
     await check(page,selectors,`${game} ${width}x${height}`);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
     if(game==='uno'){await page.locator('.hand .uno-card').last().scrollIntoViewIfNeeded();assert.ok(await page.locator('.hand .uno-card').last().isVisible());}
    }
   }
  }
 }
 const among=await client(30);await among.goto(base+'/amongus');
 for(const [width,height] of [[640,360],[740,360],[844,390],[390,844],[640,360]]){
  await among.setViewportSize({width,height});
  if(width>height){await check(among,['#auPlayerChip','#auFriendsBtn','#auPlayBtn','#auInventoryBtn','#auShopBtn','#auAccountBtn','#auSettingsBtn','.space-box'],`among menu ${width}x${height}`);
   await among.locator('#auPlayBtn').click();await check(among,['#auCreate','#auOnlineCard','#auSpacePlay'],`among play ${width}x${height}`);await among.locator('#auPlayBtn').click();
   if(process.env.GAMES_SCREENSHOT_DIR)await among.screenshot({path:`${process.env.GAMES_SCREENSHOT_DIR}/among-landscape-${width}.png`});
  }
 }
 console.log('Landscape live rotation: drawing, Sudoku, Uno, poker and Among Us menu passed.');
}finally{for(const context of contexts)await context.close();await browser.close()}
