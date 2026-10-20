import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../worker/index';

test('preview requests and scheduled checks cannot change the production Telegram webhook', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('Preview must not call Telegram'); }) as typeof fetch;
  try {
    const env = {
      ENVIRONMENT: 'preview',
      TELEGRAM_BOT_TOKEN: 'not-a-real-token', // Even if accidentally set, do not touch production.
      WEBHOOK_SECRET: 'not-a-real-secret',
      BOT_STATE: {
        idFromName: () => 'test',
        get: () => ({ fetch: async () => Response.json({ ok: true }) })
      }
    };
    const response = await worker.fetch(new Request('https://example.invalid/preview'), env);
    assert.equal(response.status, 200);
    const result = await response.json() as any;
    assert.deepEqual(result.webhook, { url: '', repaired: false });

    let scheduled: Promise<unknown> | undefined;
    await worker.scheduled({} as any, env, { waitUntil: (promise: Promise<unknown>) => { scheduled = promise; } });
    await scheduled;
  } finally {
    globalThis.fetch = originalFetch;
  }
});
