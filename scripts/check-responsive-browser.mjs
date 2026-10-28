// Optional real-browser regression suite. No production game/network writes.
// Start npm run dev; set PLAYWRIGHT_MODULE to playwright-core (or its absolute
// module path), and CHROMIUM_EXECUTABLE to a local Chromium binary.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
});
const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '' }));
  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: '', initDataUnsafe: {}, isFullscreen: true,
      safeAreaInset: { top: 24, bottom: 20 }, contentSafeAreaInset: { top: 64, bottom: 20 },
      ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {},
      requestFullscreen() {}, exitFullscreen() {}, onEvent() {}, isVersionAtLeast: () => true,
      BackButton: { show() {}, hide() {}, onClick(fn) { window.__nativeBack = fn; } },
    } };
  });
  await page.route('**/api/interactive/rooms/**', route => route.fulfill({ json: {
    token: 'test', room: {
      id: 'TEST01', game: 'chess', gameName: 'شطرنج', status: 'playing', playerSeat: 0,
      players: [{ seat: 0, name: 'لاعب طويل الاسم للاختبار', elo: 200, countryCode: 'IQ' }, { seat: 1, name: 'بوت', elo: 1200, bot: true }],
    }, state: {
      mode: 'bot', side: 'w', seat: 0, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w', turnName: 'لاعب', clocks: { w: 900000, b: 900000 }, clockMinutes: 15, legalMoves: [], chat: [],
    },
  } }));
  await page.goto(`${base}/chess?room=TEST01`);
  await page.waitForSelector('#gameApp[data-chess-layout]');
  for (const [width, height] of [[390,844],[360,640],[844,390],[768,1024],[1024,768],[1366,768],[1568,882],[1920,1080],[3840,2160],[280,640],[1280,360]]) {
    // Resize a live match without reloading, including rotation and split-screen.
    await page.setViewportSize({ width, height });
    await page.waitForFunction(w => parseFloat(document.querySelector('#gameApp').style.getPropertyValue('--fit-width')) === w, width);
    const fit = await page.evaluate(() => {
      const box = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, right: rect.right, bottom: rect.bottom };
      };
      return {
        layout: document.querySelector('#gameApp').dataset.chessLayout,
        board: box('.chessboard'), opponent: box('.chess-clock-row:not(.self-seat-row)'), self: box('.self-seat-row'),
        chat: box('.chess-side-panel'), scroll: document.querySelector('#roomPage').scrollWidth,
      };
    });
    for (const box of [fit.board, fit.opponent, fit.self]) {
      assert.ok(box.x >= -1 && box.right <= width + 1, `horizontal clipping ${width}x${height}`);
      assert.ok(box.y >= 63 && box.bottom <= height - 19, `vertical clipping ${width}x${height}`);
    }
    assert.ok(Math.abs(fit.board.w - fit.board.h) < 1, 'board remains square');
    assert.ok(fit.opponent.bottom <= fit.board.y + 1 && fit.self.y >= fit.board.bottom - 1, 'players above/below board');
    assert.ok(fit.scroll <= width + 1, 'no horizontal overflow');
    if (fit.layout === 'wide') {
      assert.ok(fit.chat.right <= fit.board.x, 'chat left, board right');
      assert.ok(fit.chat.bottom <= height - 19, 'chat fits safe area');
      await page.locator('#chessChatInput').fill('رسالة اختبار');
      assert.equal(await page.locator('#chessChatInput').inputValue(), 'رسالة اختبار');
    }
    console.log(`Browser layout passed: ${width}x${height} (${fit.layout})`);
    if (process.env.GAMES_SCREENSHOT_DIR && width === 1568) await page.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/chess-wide.png` });
  }
  await page.evaluate(() => window.__nativeBack());
  await page.waitForURL('**/interactive');
  for (const game of ['uno', 'poker', 'gartic']) {
    await page.goto(`${base}/interactive`);
    await page.locator(`.game-card[data-game="${game}"]`).click();
    await page.waitForURL(`**/${game}`);
    await page.waitForSelector('#gameSetupPage.active');
    assert.ok(await page.locator('#setupTitle').textContent());
  }
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1366, 768], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('#gameOptions');
      const create = document.querySelector('#drawCreateTitle').getBoundingClientRect();
      const join = document.querySelector('#drawJoinTitle').getBoundingClientRect();
      return { scrollWidth: document.documentElement.scrollWidth, background: getComputedStyle(panel).backgroundColor,
        columns: getComputedStyle(document.querySelector('.draw-lobby-grid')).gridTemplateColumns.split(' ').length,
        createTop: create.top, joinTop: join.top, marginTop: panel.getBoundingClientRect().top };
    });
    assert.ok(layout.scrollWidth <= width + 1, `drawing lobby overflow at ${width}`);
    assert.equal(layout.background, 'rgb(255, 255, 255)');
    assert.ok(layout.marginTop >= 64, 'Telegram safe area is respected');
    if (width <= 650) assert.ok(layout.joinTop > layout.createTop, 'mobile stacks sections');
    else assert.ok(Math.abs(layout.joinTop - layout.createTop) < 1, 'wide screens show side-by-side sections');
    console.log(`Drawing lobby passed: ${width}x${height}`);
    if (process.env.GAMES_SCREENSHOT_DIR && (width === 390 || width === 1366)) await page.screenshot({path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-${width}.png`, fullPage: true});
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#drawRoomCode').fill('!');
  await page.locator('#drawJoinButton').click();
  assert.match(await page.locator('#toast').innerText(), /رمز غرفة صحيح/);
  // Mock a room creation response error, verifying the real UI sends the chosen
  // settings and reports errors without needing to write a room in production.
  let payload;
  await page.route('**/api/interactive/rooms', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { error: 'اختبار تعذر الاتصال' } });
  });
  await page.locator('#capacityTrigger').click();
  await page.locator('#capacityMenu .draw-select-option[data-value="4"]').click();
  await page.locator('#roundSecondsTrigger').click();
  await page.locator('#roundSecondsMenu .draw-select-option[data-value="160"]').click();
  await page.locator('[data-action="friend"]').click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('اختبار تعذر الاتصال'));
  assert.equal(payload.game, 'gartic');
  assert.equal(payload.capacity, 4);
  assert.equal(payload.roundSeconds, 160);
  let joinPayload;
  await page.route('**/api/interactive/rooms/ABC234DEF567', async route => {
    joinPayload = route.request().postDataJSON();
    await route.fulfill({ status: 404, json: { error: 'غرفة اختبار' } });
  });
  await page.locator('#drawRoomCode').fill('abc234def567');
  await page.locator('#drawJoinButton').click();
  await page.waitForSelector('#roomPage.active');
  await page.getByText('غرفة اختبار').waitFor();
  assert.equal(joinPayload.action, 'join');
  assert.deepEqual(errors, []);
  console.log('Browser routes, native Back, drawing input and create-room request checks passed.');
} finally { await browser.close(); }
