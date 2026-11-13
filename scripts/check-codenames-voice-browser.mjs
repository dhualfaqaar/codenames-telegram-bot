// Integration test with real WebRTC on localhost and fake microphone devices, no Telegram.
// Start npm run dev; provide PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const base=process.env.GAMES_TEST_URL||'http://127.0.0.1:3000';
const contexts=[];
async function client(name,id){
  const context=await browser.newContext({permissions:['microphone']});contexts.push(context);
  await context.addInitScript(({name,id})=>{
    window.confirm=()=>true;
    window.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id,first_name:name}},isFullscreen:true,safeAreaInset:{top:0,bottom:0},contentSafeAreaInset:{top:0,bottom:0},ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast(){return true},BackButton:{show(){},hide(){},onClick(){}}}};
    window.__pcs=[];const NativePC=window.RTCPeerConnection;window.RTCPeerConnection=function(...args){const pc=new NativePC(...args);window.__pcs.push(pc);return pc};window.RTCPeerConnection.prototype=NativePC.prototype;
    window.__micTracks=[];if(navigator.mediaDevices?.getUserMedia){const old=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async function(c){const stream=await old(c);window.__micTracks.push(...stream.getAudioTracks());return stream}};
  },{name,id});
  const page=await context.newPage();await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));return page;
}
try{
  const a=await client('علي',101),b=await client('زينب',102),c=await client('حسن',103),d=await client('مريم',104),all=[a,b,c,d],errors=[];
  for(const p of all)p.on('pageerror',e=>errors.push(String(e)));
  await a.goto(base+'/codenames');await a.locator('[data-code-start-team="red"][data-code-start-role="spymaster"]').click();
  await a.waitForSelector('.code-team.red [data-code-role-label="spymaster"]');
  const id=new URL(a.url()).searchParams.get('room');assert.ok(id);
  const secondBase=base.replace('127.0.0.1','localhost');
  await b.goto(secondBase+'/codenames?room='+id+'&game=codenames');await b.waitForSelector('[data-voice-speaker]');
  await a.waitForFunction(()=>document.querySelectorAll('.code-room .code-player').length===2);
  for(const [width,height] of [[1366,768],[390,844],[360,640],[844,390]]){await a.setViewportSize({width,height});const rect=await a.locator('.code-room .code-board').boundingBox();const full=await a.evaluate(()=>document.documentElement.scrollHeight);assert.ok(rect && rect.y+rect.height<=height+1 && full<=height+1,`waiting room clipped ${width}x${height}: ${JSON.stringify(rect)}, scrollHeight=${full}`)}
  await c.goto(base.replace('127.0.0.1','127.0.0.2')+'/codenames?room='+id+'&game=codenames');await c.waitForSelector('[data-voice-speaker]');
  await d.goto(base.replace('127.0.0.1','127.0.0.3')+'/codenames?room='+id+'&game=codenames');await d.waitForSelector('[data-voice-speaker]');
  await a.waitForFunction(()=>document.querySelectorAll('.code-room .code-player').length===4);
  for(const p of all){await p.locator('[data-voice-speaker]').click();await p.locator('[data-voice-mic]').click();await p.waitForFunction(()=>document.querySelector('[data-voice-mic]')?.getAttribute('aria-pressed')==='true')}
  for(const p of all)await p.waitForFunction(()=>[...document.querySelectorAll('audio')].filter(a=>a.srcObject?.getAudioTracks().length).length===3,null,{timeout:30000});
  for(const p of all)await p.waitForFunction(async()=>{let incoming=0;for(const pc of window.__pcs){if(pc.connectionState!=='connected')continue;const stats=await pc.getStats();for(const x of stats.values())if(x.type==='inbound-rtp'&&x.kind==='audio'&&x.bytesReceived>0){incoming++;break}}return incoming===3},null,{timeout:30000});
  assert.equal(await a.evaluate(()=>document.querySelector('audio').muted),false);
  await a.locator('[data-voice-speaker]').click();
  assert.equal(await a.evaluate(()=>document.querySelector('audio').muted),true,'speaker off must mute received media');
  await a.locator('[data-voice-mic]').click();
  assert.equal(await a.evaluate(()=>window.__micTracks.every(t=>t.readyState==='ended')),true,'mic off must stop capture');
  assert.equal(await a.locator('[data-voice-mic]').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);
  console.log('Codenames voice browser: four real WebRTC peers with fake microphones, media reception and independent mic/speaker mute passed.');
} finally {for(const c of contexts)await c.close().catch(()=>{});await browser.close().catch(()=>{})}
