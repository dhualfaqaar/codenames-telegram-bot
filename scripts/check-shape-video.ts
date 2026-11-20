import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
import { createShapeVideoSubmitter, type ShapeJobResult } from '../src/services/shapeVideoProcessor';

const json = (obj: unknown) => new Response(JSON.stringify(obj), {headers:{'content-type':'application/json'}});
const originalFetch = globalThis.fetch;
let calls: Array<{url:string, init:any}> = [];
globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input); calls.push({url,init});
  if (url === 'https://processor.example/jobs') return new Response('',{status:202});
  return json({ok:true,result:{message_id:12}});
}) as typeof fetch;
try {
  const secret = 'a'.repeat(40);
  assert.equal(createShapeVideoSubmitter('http://processor.example',secret),null);
  assert.equal(createShapeVideoSubmitter('https://u:p@processor.example',secret),null);
  assert.equal(createShapeVideoSubmitter('https://processor.example', 'short'),null);
  const submit = createShapeVideoSubmitter('https://processor.example',secret)!;
  const job = {chatId:'12345',fileId:'telegram-file-id',shape:'star' as const};
  assert.equal(await submit(job),'accepted');
  const sent = calls.at(-1)!;
  assert.equal(sent.init.redirect,'error'); assert.equal(sent.init.headers.Authorization,`Bearer ${secret}`);
  assert.deepEqual(JSON.parse(sent.init.body),job);
  assert.ok(!sent.init.body.includes('TEST:TOKEN'), 'bot token is never sent in jobs');
  let result: ShapeJobResult = 'accepted'; const jobs: any[] = [];
  const bot = new TelegramBotManager('TEST:TOKEN',undefined,false,{shapeVideoSubmitter:async job => {jobs.push(job); return result;}}) as any;
  const cb = {id:'cb',from:{id:12345,first_name:'User'},message:{chat:{id:12345,type:'private'},message_id:7}};
  await bot.handleExtraServicesCb(cb,'svc:shapevideo');
  assert.equal(bot.shapeVideos.get('12345').fileId,'');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'original',file_size:16,duration:1}});
  const draft = bot.shapeVideos.get('12345'); assert.match(draft.session,/^[a-f0-9]{32}$/);
  const message = calls.filter(call=>call.url.endsWith('/sendMessage')).at(-1)!;
  const keyboard = JSON.parse(message.init.body).reply_markup.inline_keyboard;
  const buttons = keyboard.flat().filter((button:any)=>button.callback_data?.startsWith('shape:'));
  assert.deepEqual(buttons.map((button:any)=>button.callback_data.split(':')[2]),['circle','star','hexagon','pentagon','triangle']);
  assert.ok(keyboard.flat().every((button:any)=>!button.web_app), 'no Mini App');
  const restored = new TelegramBotManager('TEST:TOKEN') as any; restored.importState(bot.exportState());
  assert.equal(restored.shapeVideos.get('12345').session,draft.session);
  for (const shape of ['circle','star','hexagon','pentagon','triangle']) {
    await bot.handleExtraServicesCb(cb,`shape:${draft.session}:${shape}`);
    assert.deepEqual(jobs.at(-1),{chatId:'12345',fileId:'original',shape});
  }
  const before = jobs.length;
  await bot.handleExtraServicesCb(cb,`shape:${'b'.repeat(32)}:star`);
  await bot.handleExtraServicesCb({...cb,from:{id:12346,first_name:'Other'}},`shape:${draft.session}:star`);
  await bot.handleExtraServicesCb({...cb,message:{chat:{id:-1,type:'group'},message_id:7}},`shape:${draft.session}:star`);
  assert.equal(jobs.length,before, 'no stale or cross-user/group jobs');
  result = 'busy'; await bot.handleExtraServicesCb(cb,`shape:${draft.session}:star`);
  assert.ok(calls.some(call=>call.url.endsWith('/editMessageText') && call.init.body.includes('مشغول')));
  result = 'unavailable'; await bot.handleExtraServicesCb(cb,`shape:${draft.session}:star`);
  assert.ok(calls.some(call=>call.url.endsWith('/editMessageText') && call.init.body.includes('مو متاحة')));
  const noProcessor = new TelegramBotManager('TEST:TOKEN') as any;
  await noProcessor.handleExtraServicesCb(cb,'svc:shapevideo');
  assert.equal(noProcessor.shapeVideos.size,0, 'disabled service does not pretend it works');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'big',file_size:21*1024*1024,duration:1}});
  assert.equal(bot.shapeVideos.get('12345').fileId,'original');
  await bot.handleShapeVideoInput('12345',{video:{file_id:'long',file_size:16,duration:61}});
  assert.equal(bot.shapeVideos.get('12345').fileId,'original');
  draft.at -= 3600_001;
  const count=jobs.length; await bot.handleExtraServicesCb(cb,`shape:${draft.session}:star`);
  assert.equal(jobs.length,count);
  console.log('Direct shape selection, user/session isolation and processor submitter checks passed.');
} finally { globalThis.fetch=originalFetch; }
