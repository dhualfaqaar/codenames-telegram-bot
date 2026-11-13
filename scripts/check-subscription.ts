import assert from 'node:assert/strict';
import { TelegramBotManager } from '../server/telegramBot';

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
const logs: string[] = [];
console.warn = (...items: unknown[]) => logs.push(items.map(String).join(' '));
const TOKEN = '123456:TEST_TOKEN_SECRET';
let requests: any[] = [];
let handler: (init: any) => Promise<Response> = async () => Response.json({ ok: true, result: { status: 'member' } });
globalThis.fetch = (async (url: any, init: any) => {
  requests.push({ url: String(url), body: JSON.parse(init.body), signal: init.signal });
  return handler(init);
}) as typeof fetch;

try {
  const bot: any = new TelegramBotManager(TOKEN, '42', true);
  const check = (id = '12345', force = true) => bot.hasRequiredChannelMembership(id, force);
  for (const [status, extra, expected] of [
    ['creator', {}, true], ['administrator', {}, true], ['member', {}, true],
    ['left', {}, false], ['kicked', {}, false],
    ['restricted', { is_member: true }, true], ['restricted', { is_member: false }, false],
    ['restricted', { is_member: 'false' }, null], ['unexpected', {}, null]
  ] as any[]) {
    handler = async () => Response.json({ ok: true, result: { status, ...extra } });
    assert.equal(await check(), expected, status + JSON.stringify(extra));
  }
  assert.ok(requests.every(item => item.body.chat_id === '@pleasegodimtired' && item.body.user_id === 12345 && item.signal));
  assert.equal(await check('not-an-id'), null);
  assert.equal(await new TelegramBotManager('', '42', true)['hasRequiredChannelMembership']('12345', true), null);
  handler = async () => Response.json({ ok: false, error_code: 400, description: `chat not found ${TOKEN}` }, { status: 400 });
  assert.equal(await check(), null);
  handler = async () => new Response('not json', { status: 502 });
  assert.equal(await check(), null);
  handler = async () => { throw new Error(`https://api.telegram.org/bot${TOKEN}/getChatMember`); };
  assert.equal(await check(), null);
  assert.ok(logs.some(line => line.includes('REQUIRED_CHANNEL_CHECK_FAILED') && line.includes('400')));
  assert.ok(logs.every(line => !line.includes(TOKEN) && !line.includes('https://')));
  // A genuinely stalled Telegram call must abort instead of hanging forever.
  handler = async (init) => new Promise<Response>((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  const began = Date.now();
  const keepAlive = setTimeout(() => {}, 12_000);
  try { assert.equal(await check('24680'), null); } finally { clearTimeout(keepAlive); }
  assert.ok(Date.now() - began < 12_000);

  // An unavailable check is never cached as "not a member"; the next call can succeed.
  handler = async () => { throw new Error('network'); };
  assert.equal(await check('55555', false), null);
  handler = async () => Response.json({ ok: true, result: { status: 'member' } });
  assert.equal(await check('55555', false), true);
  // A start/check bypasses cached non-membership immediately after joining the new channel.
  handler = async () => Response.json({ ok: true, result: { status: 'left' } });
  assert.equal(await check('77777'), false);
  handler = async () => Response.json({ ok: true, result: { status: 'member' } });
  assert.equal(await check('77777', false), false);
  assert.equal(await check('77777', true), true);
  // A failed forced refresh invalidates the older successful cached result.
  handler = async () => { throw new Error('offline'); };
  assert.equal(await check('77777', true), null);
  handler = async () => Response.json({ ok: true, result: { status: 'left' } });
  assert.equal(await check('77777', false), false);

  // Old delayed check must not replace the cache written by a later fresh check.
  let release!: (response: Response) => void;
  handler = async () => new Promise<Response>(resolve => { release = resolve; });
  const old = check('88888', true);
  handler = async () => Response.json({ ok: true, result: { status: 'member' } });
  assert.equal(await check('88888', true), true);
  release(Response.json({ ok: true, result: { status: 'left' } }));
  assert.equal(await old, false);
  handler = async () => { throw new Error('should use cache'); };
  assert.equal(await check('88888', false), true);
  bot.setToken('987654:NEW_TEST_TOKEN');
  handler = async () => Response.json({ ok: true, result: { status: 'left' } });
  assert.equal(await check('88888', false), false); // cached data belongs to the previous bot

  const calls: any[] = [];
  const interactive: any = new TelegramBotManager(TOKEN, '42', true);
  interactive.sendMessage = async (id: string, text: string, keyboard: any) => { calls.push({ type: 'message', id, text, keyboard }); return { ok: true }; };
  interactive.answerCallbackQuery = async (id: string, text: string, alert: boolean) => { calls.push({ type: 'answer', id, text, alert }); };
  interactive.sendPrivateWelcome = async (id: string) => { calls.push({ type: 'welcome', id }); };
  interactive.notifyOwner = async () => {};
  const user = { id: 12345, first_name: 'Player' };
  const message = { message_id: 1, date: 1, from: user, chat: { id: 12345, type: 'private' }, text: '/start' };
  const callback = { id: 'cb1', data: 'sub:check', from: user, message: { message_id: 1, chat: { id: 12345, type: 'private' } } };
  handler = async () => Response.json({ ok: true, result: { status: 'left' } });
  await interactive.handleMessage(message);
  assert.equal(calls[0].text, '🔒 *الاشتراك مطلوب لتشغيل البوت*\nاشترك بقناة @pleasegodimtired، وبعدها اضغط «تحقّق وابدأ».\n\nإذا أنت مشترك وما تم التحقق، لازم يكون البوت مشرفاً بالقناة حتى يگدر يتأكد من الاشتراك.');
  assert.equal(calls[0].keyboard[0][0].url, 'https://t.me/pleasegodimtired');
  assert.ok(!calls.some(x => x.type === 'welcome'));
  calls.length = 0;
  handler = async () => { throw new Error('timeout'); };
  await interactive.handleMessage(message);
  assert.equal(calls[0].text, 'ما گدرت أتحقق من اشتراكك هسه. جرّب مرة ثانية بعد شوي.');
  assert.equal(calls[0].keyboard[0][0].callback_data, 'sub:check');
  assert.ok(!calls.some(x => x.type === 'welcome'));
  calls.length = 0;
  await interactive.handleCallbackQuery(callback);
  assert.ok(calls.some(x => x.type === 'answer' && x.text.includes('ما گدرت أتحقق') && x.alert));
  assert.ok(!calls.some(x => x.type === 'welcome'));
  calls.length = 0;
  handler = async () => Response.json({ ok: true, result: { status: 'member' } });
  await interactive.handleCallbackQuery(callback);
  assert.ok(calls.some(x => x.type === 'welcome'));
  assert.ok(calls.some(x => x.type === 'answer' && x.text.includes('تم التحقق')));
  calls.length = 0;
  await interactive.handleMessage(message);
  assert.ok(calls.some(x => x.type === 'welcome'));
  // Unrelated private button must not falsely accuse users when Telegram fails.
  calls.length = 0;
  handler = async () => { throw new Error('network'); };
  interactive.channelSubscriptionCache.clear();
  await interactive.handleCallbackQuery({ ...callback, data: 'some:button' });
  assert.ok(calls.some(x => x.type === 'answer' && x.text.includes('ما گدرت أتحقق')));
  assert.ok(calls.some(x => x.type === 'message' && x.keyboard[0][0].callback_data === 'sub:check'));
  assert.ok(!calls.some(x => x.text?.includes('اشترك بقناة')));
  // Owner still bypasses checks; group callbacks never use this private gate.
  calls.length = 0;
  const before = requests.length;
  interactive.sendAdminPanel = async () => {};
  await interactive.handleMessage({ ...message, chat: { id: 42, type: 'private' }, from: { id: 42, first_name: 'Owner' } });
  assert.equal(requests.length, before);
  assert.ok(calls.some(x => x.type === 'welcome'));
  let groupGateChecks = 0;
  interactive.hasRequiredChannelMembership = async () => { groupGateChecks++; return false; };
  await interactive.handleCallbackQuery({ ...callback, data: 'unknown', message: { message_id: 1, chat: { id: -12345, type: 'group' } } });
  assert.equal(groupGateChecks, 0);
  console.log('Subscription checks passed: member statuses, force refresh, failures, recovery, cache races and private gates.');
} finally { globalThis.fetch = originalFetch; console.warn = originalWarn; }
