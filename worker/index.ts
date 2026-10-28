/**
 * Cloudflare Worker entry point for the Codenames Telegram bot.
 *
 * Telegram delivers updates to this Worker through a webhook.
 * All game state lives inside a single Durable Object instance ("main"),
 * which keeps the games in memory and persists them to its own storage,
 * so the bot stays online 24/7 with no server that can sleep.
 */
import { TelegramBotManager } from '../server/telegramBot';
import { SUDOKU_MINI_APP_HTML } from '../src/services/sudokuMiniApp';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
import { BOT_AVATAR_JPG_BASE64 } from '../src/assets/botAvatarBase64';
import { CHESS_HERO_JPG_BASE64, DRAWING_HERO_JPG_BASE64, SUDOKU_HERO_JPG_BASE64 } from '../src/assets/gameArtBase64';
import { InteractiveGameRooms } from '../src/services/interactiveGameRooms';

export const INTERACTIVE_APP_BUILD = '2026-10-30-game-art-v9';

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  /** Where Telegram must deliver updates (defaults to this Worker's URL). */
  WEBHOOK_URL?: string;
  /** True only for isolated Worker Previews; external Telegram integrations stay disabled. */
  PREVIEW_MODE?: string;
  /** Optional: Telegram id of the bot owner (otherwise it is auto-detected). */
  OWNER_ID?: string;
  GEMINI_API_KEY?: string;
  OPEN_SUBTITLES_API_KEY?: string;
  OPEN_SUBTITLES_USER_AGENT?: string;
  BOT_STATE: any;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

const DEFAULT_WEBHOOK_URL = 'https://codenames-telegram-bot.codenames-dhualfaqaar.workers.dev';

async function verifyTelegramWebAppInitData(initData: string, botToken: string): Promise<{ id: string } | null> {
  if (!initData || initData.length > 8192 || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const suppliedHash = (params.get('hash') || '').toLowerCase();
    const authDate = Number(params.get('auth_date'));
    if (!/^[a-f0-9]{64}$/.test(suppliedHash) || !Number.isFinite(authDate) || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
    const userJson = params.get('user');
    if (!userJson) return null;
    const telegramUser = JSON.parse(userJson);
    if (!telegramUser?.id || !/^\d{5,}$/.test(String(telegramUser.id))) return null;

    const checkString = Array.from(params.entries())
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const encoder = new TextEncoder();
    const algorithm = { name: 'HMAC', hash: 'SHA-256' };
    const secretBase = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), algorithm, false, ['sign']);
    const secret = await crypto.subtle.sign('HMAC', secretBase, encoder.encode(botToken));
    const dataKey = await crypto.subtle.importKey('raw', secret, algorithm, false, ['sign']);
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', dataKey, encoder.encode(checkString)));
    const calculatedHash = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    let mismatch = 0;
    for (let i = 0; i < 64; i++) mismatch |= calculatedHash.charCodeAt(i) ^ suppliedHash.charCodeAt(i);
    return mismatch === 0 ? { id: String(telegramUser.id) } : null;
  } catch {
    return null;
  }
}

/**
 * المالك الوحيد (أحمد) — التنبيهات تروح له بس.
 * مكتوب هنا على طول حتى تنبيه الإصلاح ما يوصل أبداً لغيرك حتى لو تغيّر الإعداد.
 */
const OWNER_ONLY_ID = '8885518661';

/**
 * ضمان أن وصلة الاستقبال (Webhook) مسجّلة عند تيليجرام.
 *
 * إذا مسحتها أي نسخة ثانية (مثلاً التشغيل المحلي اللي يمسح الوصلة قبل البولينج)،
 * البوت المضبوط يسكت للأبد — فهالدالة ترجّعها تلقائياً وتبلّغ المالك.
 * تشتغل من: أول طلب للحالة، ومن المؤقت (Cron) كل 5 دقائق.
 */
async function ensureWebhook(env: Env, notify = false): Promise<{ url: string; repaired: boolean; error?: string }> {
  if (env.PREVIEW_MODE === 'true') {
    return { url: env.WEBHOOK_URL || '', repaired: false, error: 'Telegram webhook management is disabled in Worker Previews' };
  }
  const token = env.TELEGRAM_BOT_TOKEN;
  const expected = env.WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
  if (!token) return { url: '', repaired: false, error: 'no token' };

  const call = (method: string, payload?: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: payload ? 'POST' : 'GET',
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    }).then(r => r.json());

  // أنواع التحديثات اللي البوت يحتاجها — ضروري إن inline_query بيها حتى
  // يقدر يرد على منتقي «العب بالقناة» (بدونها يدور ويطلع ✖)، وchannel_post
  // حتى يستلم بطاقات الإنلاين لما تنزل بالقناة ويحوّلها لألعاب حيّة.
  const REQUIRED_UPDATES = ['message', 'channel_post', 'callback_query', 'my_chat_member', 'inline_query'];

  try {
    // 🧹 تنظيف زر القائمة الزرقاء (Menu) وإبقاء أمر /start فقط بكل النطاقات واللغات
    const scopes = [
      { type: 'default' },
      { type: 'all_private_chats' },
      { type: 'all_group_chats' },
      { type: 'all_chat_administrators' }
    ];
    for (const scope of scopes) {
      for (const language_code of [undefined, 'ar', 'en']) {
        await call('deleteMyCommands', language_code ? { scope, language_code } : { scope }).catch(() => undefined);
      }
    }
    const onlyStart = [{ command: 'start', description: 'تشغيل البوت والقائمة الرئيسية' }];
    for (const scope of [{ type: 'default' }, { type: 'all_private_chats' }]) {
      for (const language_code of [undefined, 'ar', 'en']) {
        await call(
          'setMyCommands',
          language_code ? { commands: onlyStart, scope, language_code } : { commands: onlyStart, scope }
        ).catch(() => undefined);
      }
    }
    await call('setChatMenuButton', { menu_button: { type: 'commands' } }).catch(() => undefined);

    const info = await call('getWebhookInfo');
    const current: string = info?.result?.url || '';
    // هل القائمة الحالية ناقصها شي؟ (القائمة الفاضية تعني "كل الأنواع" — إذن ما ناقص شي)
    const currentUpdates: string[] = info?.result?.allowed_updates || [];
    const updatesMissing = currentUpdates.length > 0 && REQUIRED_UPDATES.some(u => !currentUpdates.includes(u));

    if (current === expected && !updatesMissing) return { url: current, repaired: false };

    const set = await call('setWebhook', {
      url: expected,
      secret_token: env.WEBHOOK_SECRET || undefined,
      allowed_updates: REQUIRED_UPDATES,
      drop_pending_updates: false
    });

    if (set?.result) {
      console.log(`webhook repaired: "${current}" -> "${expected}"`);
      if (notify) {
        // رسالة خاصة بحصة المالك فقط (chat_id واحد مكتوب بالكود) — لا إذاعة ولا غيرك أبداً
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: OWNER_ONLY_ID,
            text: '🔧 البوت: وصلة تيليجرام كانت مفقودة (مسحتها نسخة ثانية) ورجعناها تلقائياً — البوت يشتغل طبيعي الآن ✅'
          })
        }).catch(() => undefined);
      }
      return { url: expected, repaired: true };
    }

    return { url: current, repaired: false, error: set?.description || 'setWebhook failed' };
  } catch (e: any) {
    return { url: '', repaired: false, error: e?.message || 'webhook check failed' };
  }
}

// ---------------------------------------------------------------------------
// Durable Object: owns the bot + persisted game state
// ---------------------------------------------------------------------------
export class BotState {
  private readonly state: any;
  private readonly env: Env;
  private readonly interactiveRooms: InteractiveGameRooms;
  private bot: TelegramBotManager | null = null;

  constructor(state: any, env: Env) {
    this.state = state;
    this.env = env;
    this.interactiveRooms = new InteractiveGameRooms(state.storage);
  }

  private async getBot(): Promise<TelegramBotManager> {
    if (this.bot) return this.bot;

    const interactiveGamesUrl = new URL('/interactive', this.env.WEBHOOK_URL || DEFAULT_WEBHOOK_URL);
    interactiveGamesUrl.searchParams.set('app_build', INTERACTIVE_APP_BUILD);
    const bot = new TelegramBotManager(this.env.TELEGRAM_BOT_TOKEN, this.env.OWNER_ID, true, {
      geminiApiKey: this.env.GEMINI_API_KEY,
      openSubtitlesApiKey: this.env.OPEN_SUBTITLES_API_KEY,
      openSubtitlesUserAgent: this.env.OPEN_SUBTITLES_USER_AGENT,
      interactiveGamesUrl: interactiveGamesUrl.toString()
    });
    try {
      const saved = await this.state.storage.get('state');
      if (saved) bot.importState(saved);
    } catch (e) {
      console.error('Failed to load persisted state:', e);
    }

    this.bot = bot;
    return bot;
  }

  /** يضبط منبّه الـ Durable Object لأقرب مؤقت لعبة أو فحص متابعة الفرق كل 10 ثوانٍ. */
  private async syncAlarm(bot: TelegramBotManager): Promise<void> {
    try {
      const deadlines: number[] = [];
      const nextQuizAt = bot.getNextQuizDeadline();
      if (nextQuizAt !== null) deadlines.push(nextQuizAt);
      if (bot.hasActiveFootballAlerts()) deadlines.push(Date.now() + 10_000);
      if (deadlines.length) await this.state.storage.setAlarm(Math.min(...deadlines));
      else await this.state.storage.deleteAlarm();
    } catch (e) {
      console.error('Failed to sync alarm:', e);
    }
  }

  async alarm(): Promise<void> {
    const bot = await this.getBot();
    try {
      await bot.processQuizTimers();
    } catch (e) {
      console.error('Quiz alarm error:', e);
    }
    try {
      await bot.processFootballAlerts();
    } catch (e) {
      console.error('Football alert alarm error:', e);
    }
    try {
      await this.state.storage.put('state', bot.exportState());
    } catch (e) {
      console.error('Failed to persist state in alarm:', e);
    }
    await this.syncAlarm(bot);
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/interactive/rooms') || pathname.startsWith('/api/interactive/matchmaking')) return this.interactiveRooms.handle(request);
    const bot = await this.getBot();
    if (pathname === '/interactive-config' && request.method === 'GET') return Response.json({ botUsername: await bot.getBotUsername() }, { headers: { 'Cache-Control': 'public, max-age=300' } });

    if (request.method !== 'POST') {
      const avatarSync = await bot.applyAndDeliverOfficialAvatar(false);
      if (avatarSync.sent || avatarSync.applied) {
        try {
          await this.state.storage.put('state', bot.exportState());
        } catch {
          // ignore
        }
      }
      const games = bot.getGames() as any[];
      return Response.json({
        ok: true,
        info: 'Codenames Telegram bot (Cloudflare Worker)',
        tokenConfigured: Boolean(this.env.TELEGRAM_BOT_TOKEN),
        activeGames: games.length
      });
    }

    if (new URL(request.url).pathname === '/interactive-profile') {
      try {
        const body = await request.json() as { userId?: string };
        if (!body.userId || !/^\d{5,}$/.test(String(body.userId))) return Response.json({ error: 'invalid user' }, { status: 400 });
        return Response.json({ profile: bot.getInteractiveProfile(body.userId) });
      } catch {
        return Response.json({ error: 'invalid profile request' }, { status: 400 });
      }
    }

    if (new URL(request.url).pathname === '/football-alerts') {
      try {
        await bot.processFootballAlerts();
        await this.state.storage.put('state', bot.exportState());
        await this.syncAlarm(bot);
        return Response.json({ ok: true });
      } catch (error) {
        console.error('Football alert polling failed:', error);
        return new Response('football alert polling failed', { status: 500 });
      }
    }

    let update: any;
    try {
      update = await request.json();
    } catch {
      return new Response('invalid json', { status: 400 });
    }


    // منع تكرار نفس التحديث نهائياً (يحمي من إعادة إرسال «جاري تحميل المنشور...» أكثر من مرة واحدة!)
    const uid = Number(update?.update_id);
    if (Number.isFinite(uid)) {
      if ((this as any)._seenIds?.has(uid)) {
        return new Response('ok');
      }
      if (!(this as any)._seenIds) (this as any)._seenIds = new Set<number>();
      (this as any)._seenIds.add(uid);
      if ((this as any)._seenIds.size > 1500) {
        const oldest = (this as any)._seenIds.values().next().value;
        if (oldest !== undefined) (this as any)._seenIds.delete(oldest);
      }
    }

    await bot.handleUpdate(update);

    try {
      await this.state.storage.put('state', bot.exportState());
    } catch (e) {
      console.error('Failed to persist state:', e);
    }

    await this.syncAlarm(bot);

    return new Response('ok');
  }
}

/**
 * Worker entrypoint: Telegram webhook receiver.
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname.startsWith('/stockfish/') && env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status === 404) return asset;
      const headers = new Headers(asset.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
    }
    if (request.method === 'GET' && ['/chess','/uno','/gartic','/poker'].includes(requestUrl.pathname.replace(/\/$/, ''))) {
      return new Response(interactiveGamesMiniAppHtml(requestUrl.pathname.replaceAll('/', '')), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      });
    }
    if (request.method === 'GET' && (requestUrl.pathname === '/interactive' || requestUrl.pathname === '/interactive/')) {
      return new Response(interactiveGamesMiniAppHtml(requestUrl.searchParams.get('game') || ''), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      });
    }
    const gameArt = request.method === 'GET' ? ({ '/chess-hero-v2.jpg': CHESS_HERO_JPG_BASE64, '/drawing-hero.jpg': DRAWING_HERO_JPG_BASE64, '/sudoku-hero.jpg': SUDOKU_HERO_JPG_BASE64 } as Record<string, string>)[requestUrl.pathname] : undefined;
    if (gameArt) {
      const binary = atob(gameArt);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (request.method === 'GET' && requestUrl.pathname === '/code-games-avatar.jpg') {
      const binary = atob(BOT_AVATAR_JPG_BASE64);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (request.method === 'GET' && (requestUrl.pathname === '/sudoku' || requestUrl.pathname === '/sudoku/')) {
      return new Response(SUDOKU_MINI_APP_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin'
        }
      });
    }

    const id = env.BOT_STATE.idFromName('main');
    const stub = env.BOT_STATE.get(id);
    if (requestUrl.pathname === '/api/interactive/config' && request.method === 'GET') return stub.fetch('https://bot.internal/interactive-config');
    if (requestUrl.pathname.startsWith('/api/interactive/rooms') || requestUrl.pathname.startsWith('/api/interactive/matchmaking')) {
      const headers = new Headers(request.headers);
      headers.delete('content-length');
      const init: RequestInit = { method: request.method, headers };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        const text = await request.text();
        try {
          const body = JSON.parse(text) as Record<string, unknown>;
          const roomCreation = requestUrl.pathname === '/api/interactive/rooms';
          const roomJoin = requestUrl.pathname.startsWith('/api/interactive/rooms/') && body.action === 'join';
          const matchmaking = requestUrl.pathname === '/api/interactive/matchmaking';
          if (roomCreation || roomJoin || matchmaking) {
            const authenticatedUser = await verifyTelegramWebAppInitData(String(body.initData || ''), String(env.TELEGRAM_BOT_TOKEN || ''));
            body.isBotCreator = Boolean(authenticatedUser && String(authenticatedUser.id) === OWNER_ONLY_ID);
          } else {
            delete body.isBotCreator;
          }
          delete body.initData;
          init.body = JSON.stringify(body);
        } catch {
          init.body = text;
        }
      }
      return stub.fetch(`https://bot.internal${requestUrl.pathname}${requestUrl.search}`, init);
    }

    // Preview builds can exercise isolated browser game rooms without touching the production Durable Object.
    if (env.PREVIEW_MODE === 'true') {
      return Response.json({ ok: true, info: 'Worker Preview; Telegram bot integration is disabled.' });
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/interactive/profile') {
      let body: any;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'invalid request' }, { status: 400 });
      }
      const authenticatedUser = await verifyTelegramWebAppInitData(String(body?.initData || ''), String(env.TELEGRAM_BOT_TOKEN || ''));
      if (!authenticatedUser) return Response.json({ error: 'unauthorized' }, { status: 401 });
      const response = await stub.fetch('https://bot.internal/interactive-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authenticatedUser.id })
      });
      const profilePayload = await response.json().catch(() => null);
      if (!response.ok || !profilePayload?.profile) return Response.json({ error: 'profile unavailable' }, { status: 503 });
      return Response.json({ profile: profilePayload.profile, isBotCreator: String(authenticatedUser.id) === OWNER_ONLY_ID }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.method !== 'POST') {
      // فحص + إصلاح ذاتي: لو الوصلة مسحت، ترجع تلقائياً بأول فحص
      const webhook = await ensureWebhook(env, true);
      const status = await stub.fetch('https://bot.internal/status');
      const data: any = await status.clone().json().catch(() => ({}));
      return Response.json({
        ...data,
        webhook,
        // تأكيد أن إعداد المالك مضبوط على حسابك (رقم واحد فقط)
        ownerIsYou: String(env.OWNER_ID || '') === OWNER_ONLY_ID
      });
    }

    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
    if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 });
    }

    const body = await request.text();

    // الرد الفوري بـ ok خلال أقل من 1ms وتمرير التحديث بالخلفية عبر ctx.waitUntil يمنع إعادة محاولات تيليجرام الـ 3 نهائياً!
    ctx.waitUntil(
      stub
        .fetch('https://bot.internal/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        })
        .catch((err: unknown) => console.error('DO webhook processing error:', err))
    );

    return new Response('ok');
  },

  /**
   * مؤقت كل 5 دقائق: يفحص الوصلة ويصلّحها لو مسحتها نسخة ثانية.
   * هكذا البوت ما يسكت حتى لو صار شي بالليل.
   */
  async scheduled(_event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    if (env.PREVIEW_MODE === 'true') return;
    ctx.waitUntil(
      (async () => {
        const r = await ensureWebhook(env, true);
        if (r.error) console.log('cron webhook check failed:', r.error);
        try {
          const id = env.BOT_STATE.idFromName('main');
          const stub = env.BOT_STATE.get(id);
          await stub.fetch('https://bot.internal/status');
          await stub.fetch('https://bot.internal/football-alerts', { method: 'POST' });
        } catch {
          // ignore
        }
      })()
    );
  }
};