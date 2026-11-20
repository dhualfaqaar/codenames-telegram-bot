import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
const original = globalThis.fetch, calls: Array<{method:string;init:any}>=[];
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
globalThis.fetch=(async (input:any,init:any={})=>{
  const method=String(input).split('/').pop()!; calls.push({method,init});
  if (method==='getFile') return json({ok:true,result:{file_path:'video/test.mp4',file_size:16}});
  if (String(input).includes('/file/bot')) return new Response(new Uint8Array([0,0,0,16,102,116,121,112,1,2,3,4,5,6,7,8]));
  return json({ok:true,result:{message_id:1}});
}) as typeof fetch;
try {
  const bot=new TelegramBotManager('TEST:TOKEN') as any;
  const cb={id:'cb',from:{id:12345,first_name:'User'},message:{chat:{id:12345,type:'private'},message_id:7}};
  await bot.handleExtraServicesCb(cb,'svc:shapevideo');
  assert.equal(bot.shapeVideos.get('12345').fileId,'');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'original',width:128,height:128,duration:1,mime_type:'video/mp4'}});
  const draft=bot.shapeVideos.get('12345'); assert.match(draft.session,/^[a-f0-9]{32}$/);
  const msg=calls.filter(c=>c.method==='sendMessage').at(-1)!;
  const kb=JSON.parse(msg.init.body).reply_markup.inline_keyboard.flat();
  assert.deepEqual(kb.filter((b:any)=>b.callback_data?.startsWith('shape:')).map((b:any)=>b.callback_data.split(':')[2]),['circle']);
  assert.ok(kb.every((b:any)=>!b.web_app));
  const restored=new TelegramBotManager('TEST:TOKEN') as any; restored.importState(bot.exportState());
  assert.equal(restored.shapeVideos.get('12345').directCircle,true);
  await bot.handleExtraServicesCb(cb,`shape:${draft.session}:circle`);
  assert.equal(calls.filter(c=>c.method==='sendVideoNote').length,1);
  await bot.handleExtraServicesCb(cb,`shape:${draft.session}:star`);
  await bot.handleExtraServicesCb({...cb,from:{id:12346,first_name:'Other'}},`shape:${draft.session}:circle`);
  await bot.handleExtraServicesCb({...cb,message:{chat:{id:-1,type:'group'},message_id:7}},`shape:${draft.session}:circle`);
  assert.equal(calls.filter(c=>c.method==='sendVideoNote').length,1,'unsupported shapes, other users and groups are rejected');
  draft.at -= 3600_001;
  await bot.handleExtraServicesCb(cb,`shape:${draft.session}:circle`);
  assert.equal(calls.filter(c=>c.method==='sendVideoNote').length,1,'expired session rejected');
  console.log('Free video-note callback, session and unavailable-shape checks passed.');
} finally {globalThis.fetch=original;}
