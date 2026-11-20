// Real signed initData, public Worker -> Durable Object -> bot; Telegram is mocked.
import assert from 'node:assert/strict';
import {TelegramBotManager} from '../server/telegramBot';
const {default:worker,BotState}=await (new Function('url','return import(url)'))(new URL('../worker/index.ts',import.meta.url).href);
const original=globalThis.fetch, calls:Array<{method:string;init:any}>=[];
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
const input=new Uint8Array([0,0,0,16,102,116,121,112,1,2,3,4,5,6,7,8]);
let rejectSend=false;
globalThis.fetch=(async (url:any,init:any={})=>{
  const text=String(url), method=text.split('/').pop()!; calls.push({method,init});
  if (text.includes('/file/bot')) return new Response(input);
  if (method==='getFile') return json({ok:true,result:{file_path:'videos/source.mp4',file_size:input.length}});
  if (rejectSend && (method==='sendVideo' || method==='sendVideoNote')) return json({ok:false});
  return json({ok:true,result:{message_id:1}});
}) as typeof fetch;
async function signed(token:string,id:number,at=Math.floor(Date.now()/1000)) {
  const p=new URLSearchParams({auth_date:String(at),user:JSON.stringify({id,first_name:'Test'})});
  const check=Array.from(p.entries()).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
  const enc=new TextEncoder(), alg={name:'HMAC',hash:'SHA-256'};
  const first=await crypto.subtle.importKey('raw',enc.encode('WebAppData'),alg,false,['sign']);
  const secret=await crypto.subtle.sign('HMAC',first,enc.encode(token));
  const key=await crypto.subtle.importKey('raw',secret,alg,false,['sign']);
  const hash=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(check)));
  p.set('hash',Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')); return p.toString();
}
try {
  const bot=new TelegramBotManager('TEST:TOKEN') as any;
  const cb={id:'cb',from:{id:12345,first_name:'Test'},message:{chat:{id:12345,type:'private'},message_id:1}};
  await bot.handleExtraServicesCb(cb,'svc:shapevideo');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'source',width:320,height:180,duration:1,mime_type:'video/mp4',file_size:16}});
  const draft=bot.shapeVideos.get('12345'), message=calls.filter(c=>c.method==='sendMessage').at(-1)!;
  const buttons=JSON.parse(message.init.body).reply_markup.inline_keyboard.flat().filter((b:any)=>b.web_app);
  assert.deepEqual(buttons.map((b:any)=>new URL(b.web_app.url).searchParams.get('shape')),['circle','star','hexagon','pentagon','triangle']);
  assert.ok(buttons.every((b:any)=>new URL(b.web_app.url).searchParams.get('session')===draft.session));
  const token='123456:TEST', auth=await signed(token,12345), other=await signed(token,12346), expired=await signed(token,12345,Math.floor(Date.now()/1000)-90000);
  const instance=Object.create(BotState.prototype); instance.getBot=async()=>bot;
  const env={TELEGRAM_BOT_TOKEN:token,BOT_STATE:{idFromName:()=>1,get:()=>({fetch:(url:string,init:any)=>instance.fetch(new Request(url,init))})}};
  const ctx={} as any;
  const headers={'authorization':`tma ${auth}`,'x-shape-session':draft.session,'x-shape-kind':'star','x-shape-user':'99999'};
  const req=(path:string,h:Record<string,string>,body?:BodyInit)=>new Request(`https://game.test/api/shape-video/${path}`,{method:'POST',headers:h,body});
  const src=await worker.fetch(req('source',headers),env,ctx);
  assert.equal(src.status,200); assert.deepEqual(new Uint8Array(await src.arrayBuffer()),input);
  assert.equal((await worker.fetch(req('source',{...headers,authorization:`tma ${other}`}),env,ctx)).status,403,'session bound to signed user');
  assert.equal((await worker.fetch(req('source',{...headers,authorization:`tma ${expired}`}),env,ctx)).status,401);
  assert.equal((await worker.fetch(req('source',{...headers,authorization:'tma invalid'}),env,ctx)).status,401);
  assert.equal((await worker.fetch(req('source',{...headers,'x-shape-kind':'bad'}),env,ctx)).status,401);
  assert.equal((await worker.fetch(req('send',{...headers,'x-shape-session':'a'.repeat(32)},input),env,ctx)).status,403);
  assert.equal((await worker.fetch(req('send',headers,new Uint8Array(15*1024*1024+1)),env,ctx)).status,413);
  const uploaded=await worker.fetch(req('send',headers,input),env,ctx); assert.equal(uploaded.status,200);
  const video=calls.filter(c=>c.method==='sendVideo').at(-1)!;
  assert.equal(video.init.body.get('chat_id'),'12345','client cannot choose recipient');
  assert.deepEqual(new Uint8Array(await (video.init.body.get('video') as Blob).arrayBuffer()),input);
  const circle=await worker.fetch(req('send',{...headers,'x-shape-kind':'circle'},input),env,ctx); assert.equal(circle.status,200);
  assert.equal(calls.filter(c=>c.method==='sendVideoNote').at(-1)!.init.body.get('chat_id'),'12345');
  rejectSend=true;
  assert.equal((await worker.fetch(req('send',headers,input),env,ctx)).status,502,'Telegram rejection not presented as success');
  rejectSend=false;
  await bot.handleShapeVideoInput('12345',{video:{file_id:'new',width:320,height:180,duration:1,mime_type:'video/mp4'}});
  assert.equal((await worker.fetch(req('source',headers),env,ctx)).status,403,'old buttons expire for a new video');
  console.log('Signed Mini App auth, session isolation, size limits and mocked Telegram delivery passed.');
} finally {globalThis.fetch=original;}
