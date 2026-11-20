import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { ShapeVideoJobs, shapeVideoCommand } from '../worker/shapeVideoJobs';
import { TelegramBotManager } from '../server/telegramBot';

class Store {
  values=new Map<string,any>(); alarmAt:number|null=null;
  async get(k:string) { const v=this.values.get(k); return v ? structuredClone(v):v; }
  async put(k:string,v:any) { this.values.set(k,structuredClone(v)); }
  async delete(k:string) { this.values.delete(k); }
  async setAlarm(v:number) { this.alarmAt=v; }
  async deleteAlarm() { this.alarmAt=null; }
}
const bytes=new Uint8Array([0,0,0,16,102,116,121,112,1,2,3,4,5,6,7,8]);
const orig=globalThis.fetch, calls:Array<{url:string,init:any}>=[];
let pollStatus='FINISHED', submitStatus=202, sendOk=true, redirectDownload=false;
const json=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
globalThis.fetch=(async (u:any, init:any={})=>{
  const url=String(u); calls.push({url,init});
  if(url.includes('/file/bot')) return new Response(bytes);
  if(url.endsWith('/getFile')) return json({ok:true,result:{file_path:'videos/video.mp4',file_size:bytes.length}});
  if(url.endsWith('/jobs/upload')) return json(submitStatus===202 ? {success:true,job_id:'abcd-1234'} : {error:'quota'},submitStatus);
  if(url.endsWith('/jobs/abcd-1234/download')) return redirectDownload ? new Response(null,{status:302,headers:{location:'https://files.example.test/result'}}) : new Response(bytes);
  if(url==='https://files.example.test/result') { assert.equal(init.headers,undefined,'provider key never forwarded to redirected host'); assert.equal(init.redirect,'manual'); return new Response(bytes); }
  if(url.endsWith('/jobs/abcd-1234')) return json({status:pollStatus});
  if(url.endsWith('/sendVideo') || url.endsWith('/sendVideoNote')) return json({ok:sendOk});
  return json({ok:true,result:{message_id:1}});
}) as typeof fetch;
try {
  const storage=new Store(), state={storage,blockConcurrencyWhile:async (fn:any)=>fn()};
  const env={TELEGRAM_BOT_TOKEN:'123:BOTSECRET',UPLOAD_POST_API_KEY:'APISECRET'};
  const jobs=new ShapeVideoJobs(state,env);
  const request=(shape='star')=>new Request('https://internal/start',{method:'POST',body:JSON.stringify({uid:'12345',fileId:'my-file',shape,fallback:'https://example.test/shape-video/'})});
  assert.equal((await jobs.fetch(request())).status,200);
  assert.equal((await jobs.fetch(request())).status,409,'no duplicate job per user');
  await jobs.alarm(); assert.equal((await storage.get('job')).stage,'polling');
  const upload=calls.find(c=>c.url.endsWith('/jobs/upload'))!;
  assert.ok(upload); assert.equal(upload.init.headers.authorization,'Apikey APISECRET');
  assert.equal(upload.init.body.get('output_extension'),'mp4');
  assert.ok(!String(upload.init.body.get('full_command')).includes('BOTSECRET'));
  assert.deepEqual(new Uint8Array(await upload.init.body.get('file').arrayBuffer()),bytes);
  pollStatus='PROCESSING'; await jobs.alarm(); assert.equal((await storage.get('job')).stage,'polling');
  pollStatus='FINISHED'; await jobs.alarm(); assert.equal(await storage.get('job'),undefined);
  const sent=calls.find(c=>c.url.endsWith('/sendVideo'))!; assert.equal(sent.init.body.get('chat_id'),'12345');
  assert.deepEqual(new Uint8Array(await sent.init.body.get('video').arrayBuffer()),bytes);
  redirectDownload=true; assert.equal((await jobs.fetch(request('circle'))).status,200); await jobs.alarm(); await jobs.alarm(); redirectDownload=false;
  assert.equal(calls.filter(c=>c.url.endsWith('/sendVideoNote')).at(-1)!.init.body.get('chat_id'),'12345');
  submitStatus=429; assert.equal((await jobs.fetch(request())).status,200); await jobs.alarm();
  assert.equal(await storage.get('job'),undefined);
  assert.match(JSON.parse(calls.filter(c=>c.url.endsWith('/sendMessage')).at(-1)!.init.body).text,/حد التحويل/);
  submitStatus=202; pollStatus='ERROR'; assert.equal((await jobs.fetch(request())).status,200); await jobs.alarm(); await jobs.alarm(); assert.equal(await storage.get('job'),undefined);
  pollStatus='FINISHED'; sendOk=false; assert.equal((await jobs.fetch(request())).status,200); await jobs.alarm(); await jobs.alarm(); assert.equal(await storage.get('job'),undefined);
  sendOk=true; assert.equal((await jobs.fetch(request())).status,200); const ambiguous=await storage.get('job'); ambiguous.stage='submitting'; await storage.put('job',ambiguous); const count=calls.filter(c=>c.url.endsWith('/jobs/upload')).length; await jobs.alarm(); assert.equal(calls.filter(c=>c.url.endsWith('/jobs/upload')).length,count,'never blindly resubmit after interruption');
  assert.equal((await new ShapeVideoJobs(state,{...env,PREVIEW_MODE:'true'}).fetch(request())).status,503);
  assert.equal((await jobs.fetch(request('invalid'))).status,400);
  const bot=new TelegramBotManager('TEST:TOKEN',undefined,false,{startShapeVideoJob:async(uid,fileId,shape,fallback)=>{assert.equal(uid,'12345');assert.equal(fileId,'source');assert.equal(shape,'star');assert.ok(fallback.includes('shape=star')); return true;}}) as any;
  await bot.handleShapeVideoInput('12345',{video:{file_id:'source',width:320,height:240,duration:2,mime_type:'video/mp4'}});
  const draft=bot.shapeVideos.get('12345'); const keyboard=JSON.parse(calls.filter(c=>c.url.endsWith('/sendMessage')).at(-1)!.init.body).reply_markup.inline_keyboard.flat();
  assert.deepEqual(keyboard.filter((b:any)=>b.callback_data?.startsWith('shape:')).map((b:any)=>b.callback_data.split(':')[2]),['circle','star','hexagon','pentagon','triangle']);
  const cb={id:'cb',from:{id:12345,first_name:'Test'},message:{chat:{id:12345,type:'private'},message_id:1}};
  await bot.handleExtraServicesCb(cb,`shape:${draft.session}:star`);
  assert.match(JSON.parse(calls.filter(c=>c.url.endsWith('/sendMessage')).at(-1)!.init.body).text,/جاري تحويل/);
  await bot.handleShapeVideoInput('12345',{document:{file_id:'unknown',mime_type:'video/mp4'}});
  const docKeyboard=JSON.parse(calls.filter(c=>c.url.endsWith('/sendMessage')).at(-1)!.init.body).reply_markup.inline_keyboard.flat();
  assert.equal(docKeyboard.filter((b:any)=>b.web_app).length,5,'unknown duration does not consume provider quota');
  for(const shape of ['circle','star','hexagon','pentagon','triangle'] as const) assert.ok(!/[;|&$`]/.test(shapeVideoCommand(shape)));
  // Optional real FFmpeg geometry and audio verification, not an Upload-Post integration test.
  if(process.env.FFMPEG) {
    const ff=process.env.FFMPEG, dir=mkdtempSync(join(tmpdir(),'shape-cloud-test-')), input=join(dir,'input.mp4');
    const run=(args:string[])=>{const p=spawnSync(ff,['-v','error',...args],{encoding:'buffer',maxBuffer:20*1024*1024}); if(p.status!==0) throw Error(p.error?.message || p.stderr?.toString() || 'ffmpeg failed'); return p.stdout;};
    try {
      run(['-f','lavfi','-i','color=c=red:s=320x240:r=10:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest','-y',input]);
      for(const shape of ['star','hexagon','pentagon','triangle'] as const) {
        const cmd=shapeVideoCommand(shape), filter=cmd.match(/-vf "([^"]+)"/)![1], out=join(dir,`${shape}.mp4`);
        run(['-i',input,'-vf',filter,'-c:v','libx264','-preset','ultrafast','-c:a','aac','-y',out]);
        const raw=run(['-i',out,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
        const pixel=(x:number,y:number)=>Array.from(raw.subarray((y*480+x)*3,(y*480+x)*3+3));
        const count=shape==='star'?10:shape==='hexagon'?6:shape==='pentagon'?5:3;
        const points=Array.from({length:count},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/count,r=480*(shape==='star' && i%2?.21:.47); return [240+Math.cos(a)*r,240+Math.sin(a)*r];});
        const inside=(x:number,y:number)=>{let ok=false; for(let i=0,j=count-1;i<count;j=i++) {const [xi,yi]=points[i],[xj,yj]=points[j]; if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) ok=!ok;} return ok;};
        for (let y=20;y<460;y+=40) for(let x=20;x<460;x+=40) {
          // Ignore points near polygon edges, where lossy encoding may blend pixels.
          const neighborhood=[[-4,-4],[-4,4],[4,-4],[4,4]].map(([dx,dy])=>inside(x+dx,y+dy));
          if(!neighborhood.every(v=>v===inside(x,y))) continue;
          const color=pixel(x,y);
          assert.ok(inside(x,y) ? color[0]>150 && color[1]<80 : Math.max(...color)<60,`${shape} mask at ${x},${y}: ${color}`);
        }
        const audio=run(['-i',out,'-vn','-f','s16le','pipe:1']); assert.ok(audio.some(b=>b!==0),`${shape}: audio`);
        assert.ok(readFileSync(out).length>1000);
      }
    } finally {rmSync(dir,{recursive:true,force:true});}
  }
  console.log('Cloud video queue, failures, session buttons and FFmpeg masks passed; provider and Telegram mocked.');
} finally {globalThis.fetch=orig;}
