import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';
import { classifyTelegramMedia } from '../src/services/mediaKind';
import { clearMediaCache, resetMediaProviders, resetTikTokCooldown, downloadFromPlatform } from '../src/services/mediaServicesEngine';
import { resetProviderHealth } from '../src/services/mediaResilience';

const buf = (prefix: number[], ...parts: string[]) => { const data = new Uint8Array(6000); data.set(prefix); let at = 24; for (const part of parts) { data.set(new TextEncoder().encode(part), at); at += part.length; } return data; };
const jpg = buf([0xff, 0xd8, 0xff]);
const mp4 = buf([0, 0, 0, 24, 102, 116, 121, 112], 'moov', 'vide');
const audio = buf([0, 0, 0, 24, 102, 116, 121, 112], 'moov', 'soun');
const gif = buf([71, 73, 70, 56, 57, 97]);
const animatedWebp = buf([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 0, 0, 0, 0, 2]);
assert.equal(classifyTelegramMedia(jpg, 'video'), null);
assert.equal(classifyTelegramMedia(mp4, 'photo')?.method, 'sendVideo');
assert.equal(classifyTelegramMedia(audio, 'video'), null);
assert.equal(classifyTelegramMedia(gif, 'photo')?.method, 'sendAnimation');
assert.equal(classifyTelegramMedia(animatedWebp, 'photo'), null);
assert.equal(classifyTelegramMedia(buf([0x89, 80, 78, 71, 13, 10, 26, 10], 'acTL'), 'photo'), null);
let media = mp4;
let calls: { method: string, body: any }[] = [];
globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(input);
  if (url.includes('api.telegram.org')) {
    const method = url.split('/').pop()!;
    const body = init?.body instanceof FormData ? init.body : JSON.parse(init?.body || '{}');
    calls.push({ method, body });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('vt.tiktok.com')) return new Response(null, { status: 301, headers: { location: 'https://www.tiktok.com/@test/video/7300000000000000777' } });
  if (/tnktok|vxtiktok|tiktxk/.test(url)) return new Response('<meta property="og:video" content="https://cdn.example.test/video.mp4">');
  if (url.includes('cdn.example.test')) return new Response(media as unknown as BodyInit, { headers: { 'content-type': 'video/mp4' } });
  return new Response('no', { status: 404 });
}) as typeof fetch;
const bot = new TelegramBotManager('TEST:TOKEN') as any;
async function send(kind: string, bytes: Uint8Array) { calls = []; return bot.sendMediaBinaryOrUrl('77', kind, 'https://cdn.example.test/video.mp4', undefined, bytes); }
assert.ok(await send('photo', jpg)); assert.equal(calls[0].method, 'sendPhoto'); assert.equal(calls[0].body.get('chat_id'), '77'); assert.equal(calls[0].body.get('reply_markup'), null);
assert.ok(await send('photo', mp4)); assert.equal(calls[0].method, 'sendVideo'); assert.equal(calls[0].body.get('video').type, 'video/mp4');
assert.ok(await send('photo', gif)); assert.equal(calls[0].method, 'sendAnimation');
assert.equal(await send('video', jpg), null); assert.equal(calls.length, 0);
assert.equal(await send('video', audio), null); assert.equal(calls.length, 0);
clearMediaCache(); resetMediaProviders(); resetProviderHealth(); resetTikTokCooldown();
calls = []; bot.pendingSocialDl.set('77', 'tt'); media = mp4;
await bot.handleSocialDownloadInput('77', 'https://vt.tiktok.com/ZSgtWrq3e/');
assert.equal(calls.filter(c => c.method === 'sendVideo').length, 1);
assert.equal(calls.filter(c => c.method === 'sendVideo')[0].body.get('chat_id'), '77');
assert.equal(calls.filter(c => c.method === 'sendMessage').length, 1, 'no extra success/back message');
assert.equal(bot.pendingSocialDl.has('77'), false);
clearMediaCache(); resetMediaProviders(); resetProviderHealth(); resetTikTokCooldown();
calls = []; bot.pendingSocialDl.set('77', 'tt'); media = jpg;
await bot.handleSocialDownloadInput('77', 'https://vt.tiktok.com/ZSgtWrq3e/');
assert.equal(calls.filter(c => c.method === 'sendPhoto').length, 0, 'video cover must not be sent');
assert.equal(calls.filter(c => c.method === 'sendVideo').length, 0);
assert.ok(calls.some(c => c.method === 'sendMessage' && String(c.body.text).includes('ما كدرت أرسل')));
console.log('Media delivery: actual formats, GIF, previews, direct private delivery, failure and no success keyboard passed.');

// Thumbnail-only responses must not be promoted to original video content.
clearMediaCache(); resetMediaProviders(); resetProviderHealth(); resetTikTokCooldown();
globalThis.fetch = (async (input: any) => {
  const url = String(input);
  if (/tnktok|vxtiktok|tiktxk/.test(url)) return new Response('<meta property="og:image" content="https://cdn.example.test/cover.jpg">');
  return new Response('no', { status: 404 });
}) as typeof fetch;
const videoCover = await downloadFromPlatform('tt', 'https://www.tiktok.com/@user/video/7300000000000000777');
assert.equal(videoCover.ok, false, 'a video mirror thumbnail alone must not become a photo result');
clearMediaCache(); resetMediaProviders(); resetProviderHealth();
globalThis.fetch = (async (input: any) => {
  const url = String(input);
  if (url.includes('pinterest.com/pin/')) return new Response('<meta property="og:image" content="https://i.pinimg.com/736x/ab/cd/ef/abcdef0123456789.jpg"> https://v1.pinimg.com/videos/example/master.m3u8 '+ ' '.repeat(5000));
  if (url.includes('pinimg.com')) throw new Error('video cover must never be fetched');
  return new Response('no', {status:404});
}) as typeof fetch;
const hlsCover = await downloadFromPlatform('pin', 'https://www.pinterest.com/pin/123456789012/');
assert.equal(hlsCover.ok, false, 'HLS cannot be concatenated or replaced by its thumbnail');
console.log('Media sources: TikTok video previews and Pinterest HLS covers are not delivered as photos.');
