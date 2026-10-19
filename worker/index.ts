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
  /** Optional: Telegram id of the bot owner (otherwise it is auto-detected). */
  OWNER_ID?: string;
  BOT_STATE: any;
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

    const bot = new TelegramBotManager(this.env.TELEGRAM_BOT_TOKEN, this.env.OWNER_ID);
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

    return new Response('ok');
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
      return stub.fetch('https://bot.internal/status');
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
  }
};