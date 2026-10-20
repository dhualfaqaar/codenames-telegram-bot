/**
 * Cloudflare Worker entry point for the Codenames Telegram bot.
 *
 * Telegram delivers updates to this Worker through a webhook.
 * All game state lives inside a single Durable Object instance ("main"),
 * which keeps the games in memory and persists them to its own storage,
 * so the bot stays online 24/7 with no server that can sleep.
 */
import { TelegramBotManager } from '../server/telegramBot';

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  /** Where Telegram must deliver updates (defaults to this Worker's URL). */
  WEBHOOK_URL?: string;
  /** Optional: Telegram id of the bot owner (otherwise it is auto-detected). */
  OWNER_ID?: string;
  BOT_STATE: any;
}

const DEFAULT_WEBHOOK_URL = 'https://codenames-telegram-bot.codenames-dhualfaqaar.workers.dev';

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
  private bot: TelegramBotManager | null = null;

  constructor(state: any, env: Env) {
    this.state = state;
    this.env = env;
  }

  private async getBot(): Promise<TelegramBotManager> {
    if (this.bot) return this.bot;

    const bot = new TelegramBotManager(this.env.TELEGRAM_BOT_TOKEN, this.env.OWNER_ID, false);
    try {
      const saved = await this.state.storage.get('state');
      if (saved) bot.importState(saved);
    } catch (e) {
      console.error('Failed to load persisted state:', e);
    }

    this.bot = bot;
    return bot;
  }

  async fetch(request: Request): Promise<Response> {
    const bot = await this.getBot();

    if (request.method !== 'POST') {
      const games = bot.getGames() as any[];
      return Response.json({
        ok: true,
        info: 'Codenames Telegram bot (Cloudflare Worker)',
        tokenConfigured: Boolean(this.env.TELEGRAM_BOT_TOKEN),
        activeGames: games.length
      });
    }

    let update: any;
    try {
      update = await request.json();
    } catch {
      return new Response('invalid json', { status: 400 });
    }

    await bot.handleUpdate(update);

    try {
      await this.state.storage.put('state', bot.exportState());
    } catch (e) {
      console.error('Failed to persist state:', e);
    }

    await this.scheduleQuizAlarm(bot);
    return new Response('ok');
  }

  /** Durable Object alarms survive idle eviction and fire without Telegram updates. */
  private async scheduleQuizAlarm(bot: TelegramBotManager) {
    const next = bot.nextQuizDeadline();
    if (next === undefined) await this.state.storage.deleteAlarm();
    else await this.state.storage.setAlarm(Math.max(Date.now(), next));
  }

  async alarm(): Promise<void> {
    const bot = await this.getBot();
    await bot.processQuizDeadlines();
    await this.state.storage.put('state', bot.exportState());
    await this.scheduleQuizAlarm(bot);
  }
}

/**
 * Worker entrypoint: Telegram webhook receiver.
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const id = env.BOT_STATE.idFromName('main');
    const stub = env.BOT_STATE.get(id);

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

    return stub.fetch('https://bot.internal/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
  },

  /**
   * مؤقت كل 5 دقائق: يفحص الوصلة ويصلّحها لو مسحتها نسخة ثانية.
   * هكذا البوت ما يسكت حتى لو صار شي بالليل.
   */
  async scheduled(_event: unknown, env: any, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(
      ensureWebhook(env, true).then(r => {
        if (r.error) console.log('cron webhook check failed:', r.error);
      })
    );
  }
};