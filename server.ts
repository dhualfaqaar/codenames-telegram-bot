import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';
import { telegramBot } from './server/telegramBot';
import { SUDOKU_MINI_APP_HTML } from './src/services/sudokuMiniApp';
import { interactiveGamesMiniAppHtml } from './src/services/interactiveGamesMiniApp';
import { BOT_AVATAR_JPG_BASE64 } from './src/assets/botAvatarBase64';
import { InteractiveGameRooms, MemoryRoomStorage } from './src/services/interactiveGameRooms';
import { ARABIC_STANDARD_WORDS, ARABIC_IRAQI_WORDS, POP_CULTURE_WORDS, ENGLISH_WORDS } from './src/data/words';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

const interactiveRooms = new InteractiveGameRooms(new MemoryRoomStorage());
app.get('/code-games-avatar.jpg', (_req, res) => {
  res.type('image/jpeg').set('Cache-Control', 'public, max-age=86400').send(Buffer.from(BOT_AVATAR_JPG_BASE64, 'base64'));
});
app.get('/api/interactive/config', async (_req, res) => {
  try { res.set('Cache-Control', 'public, max-age=300').json({ botUsername: await telegramBot.getBotUsername() }); }
  catch { res.status(503).json({ error: 'تعذر جلب معلومات البوت' }); }
});
app.all(['/api/interactive/rooms*', '/api/interactive/matchmaking*'], async (req, res) => {
  try {
    const method = req.method.toUpperCase();
    const headers = new Headers();
    const authorization = req.get('authorization');
    if (authorization) headers.set('Authorization', authorization);
    if (method !== 'GET' && method !== 'HEAD') headers.set('Content-Type', 'application/json');
    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') init.body = JSON.stringify(req.body || {});
    const request = new Request(`http://${req.get('host')}${req.originalUrl}`, init);
    const response = await interactiveRooms.handle(request);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Interactive room request failed:', error);
    res.status(500).json({ error: 'تعذر تنفيذ طلب اللعبة' });
  }
});

// Interactive game launcher and first standalone puzzle game.
app.get('/interactive', (req, res) => {
  res.type('html').set('Cache-Control', 'no-cache').send(interactiveGamesMiniAppHtml(String(req.query.game || '')));
});
app.get('/sudoku', (_req, res) => {
  res.type('html').set('Cache-Control', 'no-cache').send(SUDOKU_MINI_APP_HTML);
});

// Auto-start polling if TELEGRAM_BOT_TOKEN is set in environment
if (process.env.TELEGRAM_BOT_TOKEN) {
  telegramBot.startPolling().then(res => {
    console.log('[Telegram Bot] Auto-start result:', res);
  }).catch(err => {
    console.error('[Telegram Bot] Auto-start failed:', err);
  });
}

// REST API Endpoints

// 1. Get bot status
app.get('/api/bot/status', (req, res) => {
  const status = telegramBot.getStatus();
  res.json(status);
});

// 2. Configure bot token & toggle polling
app.post('/api/bot/configure', async (req, res) => {
  const { token, action } = req.body;

  if (typeof token === 'string' && token.trim().length > 0) {
    telegramBot.setToken(token);
  }

  if (action === 'test') {
    const testRes = await telegramBot.testConnection();
    return res.json(testRes);
  }

  if (action === 'start') {
    const startRes = await telegramBot.startPolling();
    return res.json(startRes);
  }

  if (action === 'stop') {
    telegramBot.stopPolling();
    return res.json({ success: true, message: 'تم إيقاف تشغيل البوت مؤقتاً.' });
  }

  if (action === 'set_webhook') {
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'https';
    const fallbackUrl = `${protocol}://${host}/api/telegram-webhook`;
    const targetUrl = req.body.webhookUrl || process.env.APP_URL ? `${process.env.APP_URL}/api/telegram-webhook` : fallbackUrl;
    const webhookRes = await telegramBot.setWebhook(targetUrl);
    return res.json(webhookRes);
  }

  if (action === 'remove_webhook') {
    const rmRes = await telegramBot.removeWebhook();
    return res.json(rmRes);
  }

  res.json({ success: true, status: telegramBot.getStatus() });
});

// 3. Get active rooms/games
app.get('/api/bot/games', (req, res) => {
  const games = telegramBot.getGames();
  res.json({ success: true, games });
});

// 3.1 Get finished games statistics
app.get('/api/bot/stats', (req, res) => {
  const stats = telegramBot.getStats();
  res.json({ success: true, stats });
});

// 3.2 Add sample finished match for testing stats
app.post('/api/bot/stats/sample', (req, res) => {
  const match = telegramBot.addSampleFinishedGame();
  res.json({ success: true, match, stats: telegramBot.getStats() });
});

// 4. Get specific game state
app.get('/api/bot/game/:chatId', (req, res) => {
  const game = telegramBot.getGame(req.params.chatId);
  if (!game) {
    return res.status(404).json({ success: false, message: 'Game not found' });
  }
  res.json({ success: true, game });
});

// 5. Simulator action (for testing inside web app without needing a token)
app.post('/api/bot/simulate', (req, res) => {
  const { chatId = 'simulated_group_1', action, payload } = req.body;
  const result = telegramBot.simulateAction(chatId, action, payload || {});
  res.json(result);
});

// 6. Word packs
app.get('/api/words', (req, res) => {
  res.json({
    standard: ARABIC_STANDARD_WORDS,
    iraqi: ARABIC_IRAQI_WORDS,
    popCulture: POP_CULTURE_WORDS,
    english: ENGLISH_WORDS
  });
});

// 7. Telegram Webhook endpoint (if user prefers webhook over polling)
app.post('/api/telegram-webhook', async (req, res) => {
  try {
    await telegramBot.handleUpdate(req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 8. Download Project ZIP package for easy GitHub/Render upload
app.get('/api/download-zip', (req, res) => {
  const zipPath = path.resolve(__dirname, 'codenames-bot.zip');
  try {
    const cmd = `python3 -c "
import zipfile, os
exclude = {'node_modules', '.git', 'dist', '.aistudio'}
with zipfile.ZipFile('${zipPath}', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude]
        for f in files:
            if f == 'codenames-bot.zip': continue
            fp = os.path.join(root, f)
            z.write(fp, os.path.relpath(fp, '.'))
"`;
    execSync(cmd);
  } catch (e) {
    console.error('Failed to create zip:', e);
  }

  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'codenames-bot.zip');
  } else {
    res.status(500).json({ error: 'Zip creation failed' });
  }
});

// Setup Vite or static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: ['.e2b.app'] },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Codenames Telegram Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
