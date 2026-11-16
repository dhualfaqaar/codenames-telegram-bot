// Controlled integration fixture: a real browser, HTTP engine, five bots and a witnessed murder.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {AmongUsRooms,memoryRoomStorage} from '../src/services/amongUsRooms.ts';
import {amongUsMiniAppHtml} from '../src/services/amongUsMiniApp.ts';
const storage=memoryRoomStorage(),engine=new AmongUsRooms(storage);
const post=async(body)=>(await engine.handle(new Request('http://test/api/amongus/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))).json();
const host=await post({action:'create',name:'host'}),{code,token}=host;
for(let i=0;i<5;i++)await post({action:'addBot',code,token});await post({action:'start',code,token});
const room=await storage.get('amongus-room:'+code), now=Date.now();
room.players.forEach((p,i)=>{p.role=i?'crew':'impostor';p.alive=true;p.x=50+(i%3)*.35;p.y=16+(i%2)*.35;p.nextThinkAt=now+5000;p.target=null;p.taskReadyAt=0;p.lastKillAt=now-60000;p.ventId=null});
room.tickAt=now;await storage.put('amongus-room:'+code,room);
const server=http.createServer(async(req,res)=>{try{const path=req.url||'/';if(path.startsWith('/api/amongus/')){let chunks=[];for await(const chunk of req)chunks.push(chunk);let body=Buffer.concat(chunks);let request=new Request('http://test'+path,{method:req.method,headers:{'content-type':'application/json'},...(body.length?{body}: {})});let response=await engine.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}else if(path.startsWith('/amongus')){res.writeHead(200,{'content-type':'text/html'});res.end(amongUsMiniAppHtml())}else if(/^\/[a-z0-9-]+\.(png|jpg)$/.test(path)){res.end(await readFile('public'+path))}else{res.writeHead(404);res.end()}}catch(e){console.error(e);res.writeHead(500);res.end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--no-zygote','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await page.goto(`http://127.0.0.1:${port}/amongus`);await page.evaluate(({code,token})=>{window.__auState.code=code;window.__auState.token=token},{code,token});
 await page.locator('#auStage.on').waitFor();await page.locator('#auKill.ready').waitFor();await page.locator('#auKill').click();
 await page.waitForFunction(()=>window.__auState.room.bodies.length===1);
 await page.locator('#auMeetingDialog.on').waitFor({timeout:12000});assert.equal(await page.locator('#auMeetingTitle').textContent(),'تبليغ عن جثة');
 await page.waitForFunction(()=>window.__auState.room.meeting?.votes.length===4,{timeout:12000});
 await page.locator('#auSkipVote').click();await page.locator('#auEndDialog.on').waitFor({timeout:5000});
 const result=await page.evaluate(()=>window.__auState.room);assert.equal(result.winner,'crew');assert.equal(result.lastMeeting.ejectedRole,'impostor');assert.deepEqual(errors,[]);
 console.log('Browser controlled round: host kill, bot report, four witness votes, host skip, impostor ejection and crew win passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
