// End-to-end in process: Telegram callbacks -> HTTPS job client (locally routed) -> processor -> mocked Telegram.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {TelegramBotManager} from '../server/telegramBot';
import {createShapeVideoSubmitter} from '../src/services/shapeVideoProcessor';
import {createVideoProcessorServer} from '../video-processor/server.mjs';

const ffmpeg=process.env.FFMPEG || 'ffmpeg', ffprobe=process.env.FFPROBE || 'ffprobe';
const dir=mkdtempSync(join(tmpdir(),'shape-direct-'));
const path=join(dir,'input.mp4');
execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','color=c=blue:s=320x180:r=15:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-c:a','aac','-shortest','-y',path]);
const input=readFileSync(path), secret='s'.repeat(40), originalFetch=globalThis.fetch;
const json=(value:any)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
let delivered: any = null, resolveDelivery: (value: unknown)=>void = ()=>{};
const server=createVideoProcessorServer({token:'TEST:TOKEN',secret,ffmpeg,ffprobe,fetcher:async (url:any,init:any={})=>{
  url=String(url);
  if (url.endsWith('/getFile')) { assert.equal(JSON.parse(init.body).file_id,'video-file-id'); return json({ok:true,result:{file_path:'videos/input.mp4',file_size:input.length}}); }
  if (url.includes('/file/bot')) return new Response(input);
  if (url.endsWith('/sendVideoNote') || url.endsWith('/sendVideo')) {
    const note=url.endsWith('/sendVideoNote'), blob=init.body.get(note?'video_note':'video') as Blob;
    delivered={note,chatId:init.body.get('chat_id'),bytes:new Uint8Array(await blob.arrayBuffer())};
    resolveDelivery(true); return json({ok:true,result:{message_id:3}});
  }
  if (url.endsWith('/sendMessage')) { resolveDelivery(false); return json({ok:true,result:{message_id:2}}); }
  throw new Error('unexpected request');
}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=(server.address() as any).port, messages: any[]=[];
globalThis.fetch=(async (url:any,init:any={})=>{
  if (String(url)==='https://processor.example/jobs') return originalFetch(`http://127.0.0.1:${port}/jobs`,init);
  if (String(url).includes('api.telegram.org/bot')) { messages.push({url:String(url),body:init.body}); return json({ok:true,result:{message_id:1}}); }
  throw new Error('unexpected request');
}) as typeof fetch;
try {
  const bot=new TelegramBotManager('TEST:TOKEN',undefined,false,{shapeVideoSubmitter:createShapeVideoSubmitter('https://processor.example',secret)}) as any;
  bot.hasRequiredChannelMembership=async()=>true;
  const cb={id:'id',from:{id:12345,first_name:'Test'},message:{chat:{id:12345,type:'private'},message_id:9}};
  await bot.handleExtraServicesCb(cb,'svc:shapevideo');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'video-file-id',file_size:input.length,duration:1}});
  const session=bot.shapeVideos.get('12345').session;
  const pending = new Promise(resolve=>{resolveDelivery=resolve;});
  await bot.handleCallbackQuery({...cb,data:`shape:${session}:circle`});
  const done=await pending; assert.equal(done,true);
  assert.equal(delivered.note,true); assert.equal(delivered.chatId,'12345');
  const result=join(dir,'out.mp4'); writeFileSync(result,delivered.bytes);
  const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_type,codec_name,width,height','-of','json',result],{encoding:'utf8'}));
  assert.ok(probe.streams.some((s:any)=>s.codec_type==='video' && s.width===480 && s.height===480 && s.codec_name==='h264'));
  assert.ok(probe.streams.some((s:any)=>s.codec_type==='audio' && s.codec_name==='aac'));
  assert.ok(messages.some(m=>m.url.endsWith('/sendMessage') && m.body.includes('جاري تجهيز')));
  assert.ok(messages.some(m=>m.url.endsWith('/answerCallbackQuery')));
  console.log('Direct callback to actual processor and mocked Telegram video note passed; no Mini App.');
} finally {globalThis.fetch=originalFetch; await new Promise<void>(resolve=>server.close(()=>resolve())); rmSync(dir,{recursive:true,force:true});}
