// Optional browser integration test: run the local server and provide a Chromium
// executable and playwright-core, as with test:responsive:browser. Rooms are
// local in-memory data; no production service is contacted or changed.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'] });
const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const errors = [];
const contexts = [];
try {
  async function client(name, photoUrl, width, height) {
    const context = await browser.newContext({ viewport: { width, height } });
    contexts.push(context);
    await context.route('https://telegram.org/**', route => route.fulfill({ body: '' }));
    await context.route('https://photo.telegram-cdn.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
    await context.addInitScript(({ name, photoUrl }) => {
      window.Telegram = { WebApp: { initData: '', initDataUnsafe: { user: { id: name === 'أحمد' ? 1 : 2, first_name: name, photo_url: photoUrl } },
        isFullscreen: true, safeAreaInset: { top: 24, bottom: 20 }, contentSafeAreaInset: { top: 64, bottom: 20 },
        ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, requestFullscreen() {}, exitFullscreen() {},
        isVersionAtLeast: () => true, onEvent() {}, BackButton: { show() {}, hide() {}, onClick(fn) { window.__nativeBack = fn; } },
      } };
    }, { name, photoUrl });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`${base}/gartic`);
    await page.locator('#drawCreateTitle').waitFor();
    return page;
  }
  const host = await client('أحمد', 'https://photo.telegram-cdn.org/ahmad.png', 1366, 768);
  await host.locator('.lobby-avatar img').waitFor();
  assert.equal(await host.locator('.lobby-avatar img').getAttribute('src'), 'https://photo.telegram-cdn.org/ahmad.png');
  assert.equal(await host.locator('.draw-ribbon').innerText(), 'لعبة الرسم');
  // The lobby uses custom listboxes so the client cannot paint its own native
  // menu colours over the game palette. Verify order, palette and selection.
  const optionValues = async name => host.locator(`.draw-select[data-draw-select="${name}"] .draw-select-option`).evaluateAll(nodes => nodes.map(node => node.dataset.value));
  assert.deepEqual(await optionValues('capacity'), ['2', '4', '6', '8', '12', '16']);
  assert.deepEqual(await optionValues('roundSeconds'), ['100', '120', '140', '160', '180', '200', '225', '250']);
  assert.equal(await host.locator('#capacityMenu').isVisible(), false);
  await host.locator('#capacityTrigger').click();
  assert.equal(await host.locator('#capacityMenu').isVisible(), true);
  assert.equal(await host.locator('#capacityTrigger').getAttribute('aria-expanded'), 'true');
  if (process.env.GAMES_SCREENSHOT_DIR) await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-lobby-menu.png` });
  const menuBox = await host.locator('#capacityMenu').boundingBox();
  assert.ok(menuBox.y >= 0 && menuBox.y + menuBox.height <= 768, 'opened list stays inside the viewport');
  const menuStyles = await host.evaluate(() => {
    const menu = document.querySelector('#capacityMenu');
    const chosen = menu.querySelector('.draw-select-option[aria-selected="true"]');
    const other = menu.querySelector('.draw-select-option[data-value="4"]');
    return { menu: getComputedStyle(menu).backgroundColor, chosen: getComputedStyle(chosen).backgroundColor, other: getComputedStyle(other).backgroundColor, trigger: getComputedStyle(document.querySelector('#capacityTrigger')).backgroundColor };
  });
  assert.equal(menuStyles.menu, 'rgb(255, 255, 255)');
  assert.equal(menuStyles.chosen, 'rgb(22, 136, 233)');
  assert.equal(menuStyles.other, 'rgb(255, 255, 255)');
  assert.equal(menuStyles.trigger, 'rgb(255, 255, 255)');
  await host.locator('#capacityMenu .draw-select-option[data-value="4"]').click();
  assert.equal(await host.locator('#capacityMenu').isVisible(), false);
  assert.equal(await host.locator('[data-draw-select="capacity"]').getAttribute('data-value'), '4');
  assert.equal(await host.locator('#capacityValue').innerText(), '٤ لاعبين');
  await host.locator('#capacityTrigger').click();
  // The list flips above the field when the viewport has no room below it.
  const menuFits = await host.evaluate(() => {
    const el = document.querySelector('#capacityMenu');
    const menu = el.getBoundingClientRect();
    return { top: menu.top, bottom: menu.bottom, height: menu.height, inner: window.innerHeight, openUp: el.classList.contains('open-up'), scroll: el.scrollHeight };
  });
  assert.equal(menuFits.bottom <= menuFits.inner && menuFits.top >= 0, true);
  await host.locator('body').click({ position: { x: 5, y: 5 } });
  assert.equal(await host.locator('#capacityMenu').isVisible(), false);
  await host.locator('#roundSecondsTrigger').click();
  await host.locator('#roundSecondsMenu .draw-select-option[data-value="160"]').click();
  assert.equal(await host.locator('[data-draw-select="roundSeconds"]').getAttribute('data-value'), '160');
  assert.equal(await host.locator('#roundSecondsValue').innerText(), '١٦٠ ثانية');
  if (process.env.GAMES_SCREENSHOT_DIR) await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-lobby-selects.png`, fullPage: true });
  await host.locator('[data-action="friend"]').click();
  await host.locator('.draw-room').waitFor();
  const roomId = new URL(host.url()).searchParams.get('room');
  assert.match(roomId, /^[A-Z0-9]{12}$/);
  assert.ok(await host.getByText('بانتظار اللاعبين').first().isVisible());
  assert.equal(await host.locator('.draw-player-row').count(), 1);
  assert.equal(await host.locator('.draw-player-row .draw-account-avatar img').getAttribute('src'), 'https://photo.telegram-cdn.org/ahmad.png');
  assert.equal(await host.locator('.draw-canvas').count(), 1);
  assert.equal(await host.locator('[data-action="start"]').count(), 0);
  const guest = await client('سارة', '', 390, 844);
  assert.equal(await guest.locator('.lobby-avatar img').count(), 0);
  assert.match(await guest.locator('.lobby-avatar').innerText(), /س/);
  // Same custom list on a phone-sized screen keeps all eight times reachable.
  await guest.locator('#roundSecondsTrigger').click();
  const phoneMenu = await guest.evaluate(() => {
    const menu = document.querySelector('#roundSecondsMenu').getBoundingClientRect();
    return { top: menu.top, bottom: menu.bottom, viewport: window.innerHeight, count: document.querySelectorAll('#roundSecondsMenu .draw-select-option').length };
  });
  assert.equal(phoneMenu.count, 8);
  const phoneLast = await guest.locator('#roundSecondsMenu .draw-select-option[data-value="250"]').boundingBox();
  assert.ok(phoneLast.y + phoneLast.height <= phoneMenu.viewport, 'the last time is reachable without hiding behind the viewport');
  assert.ok(phoneMenu.top >= 0 && phoneMenu.bottom <= phoneMenu.viewport, 'phone list stays inside the viewport');
  if (process.env.GAMES_SCREENSHOT_DIR) await guest.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-lobby-menu-phone.png` });
  await guest.locator('#roundSecondsMenu .draw-select-option[data-value="225"]').click();
  assert.equal(await guest.locator('#roundSecondsValue').innerText(), '٢٢٥ ثانية');
  await guest.locator('#drawRoomCode').fill(roomId.toLowerCase());
  await guest.locator('#drawJoinButton').click();
  await guest.locator('.draw-room').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.draw-player-row').length === 2);
  assert.equal(await guest.locator('.draw-player-row').count(), 2);
  assert.equal(await guest.locator('[data-action="start"]').count(), 0);
  const positions = await host.evaluate(() => ({ players: document.querySelector('.draw-room-players').getBoundingClientRect().toJSON(), board: document.querySelector('.draw-board-card').getBoundingClientRect().toJSON(), feed: document.querySelector('.draw-feed-card').getBoundingClientRect().toJSON() }));
  assert.ok(positions.players.right <= positions.board.left, 'players are left of board on wide screens');
  assert.ok(positions.feed.top >= positions.board.bottom, 'guess feed is below the board');
  if (process.env.GAMES_SCREENSHOT_DIR) await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/drawing-waiting.png`, fullPage: true });
  const third = await client('علي', '', 1024, 768);
  await third.locator('#drawRoomCode').fill(roomId);
  await third.locator('#drawJoinButton').click();
  await third.locator('.draw-room').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.draw-player-row').length === 3);
  await host.locator('[data-action="start"]').click();
  await host.locator('.palette-color').first().waitFor();
  await guest.locator('#guessInput').waitFor();
  await third.locator('#guessInput').waitFor();
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), true);
  assert.equal(await host.locator('#drawChatInput').count(), 0);
  assert.equal(await guest.locator('#drawChatInput').count(), 1);
  assert.equal(await host.locator('.draw-player-row .player-flag-marker').count(), 3);
  const word = (await host.locator('.draw-hint').innerText()).replace('كلمتك: ', '').trim();
  assert.ok(word.length > 0);
  assert.equal(await guest.locator('.draw-hint').innerText(), 'الكلمة مخفية');
  const guestState = await guest.evaluate(async id => {
    const token = localStorage.getItem('cg-room-token-' + id);
    return (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
  }, roomId);
  assert.equal(guestState.state.word, '', 'the answer is never sent to the guessing player');
  await guest.locator('#guessInput').fill('نص غير مكتمل');
  await guest.locator('#guessInput').focus();
  await host.locator('.palette-color[data-color="#ef4444"]').click();
  const canvas = host.locator('#drawCanvas');
  const rect = await canvas.boundingBox();
  await host.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .3);
  await host.mouse.down();
  await host.mouse.move(rect.x + rect.width * .5, rect.y + rect.height * .5, { steps: 6 });
  await host.mouse.up();
  await guest.waitForFunction(async id => {
    const token = localStorage.getItem('cg-room-token-' + id);
    const data = await (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
    return data.state.strokes.length > 0;
  }, roomId);
  await guest.waitForFunction(() => document.querySelector('#guessInput')?.value === 'نص غير مكتمل' && document.activeElement?.id === 'guessInput');
  const strokeState = await guest.evaluate(async id => { const token = localStorage.getItem('cg-room-token-' + id); return (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json(); }, roomId);
  assert.equal(strokeState.state.strokes[0].color, '#ef4444');
  const undoBox = await host.locator('[data-action="undo-stroke"]').boundingBox();
  assert.ok(undoBox.width >= 80 && undoBox.height >= 38, 'toolbar buttons are readable and tappable');
  if (process.env.GAMES_SCREENSHOT_DIR) {
    await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/drawing-playing.png`, fullPage: true });
    await guest.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/drawing-phone.png`, fullPage: true });
  }
  await guest.locator('#drawChatInput').fill('رسالة للمخمّنين');
  await guest.locator('#drawChatForm').evaluate(form => form.requestSubmit());
  await third.getByText('رسالة للمخمّنين').waitFor();
  assert.equal(await host.getByText('رسالة للمخمّنين').count(), 0);
  await guest.locator('#guessInput').fill(word);
  await guest.locator('#guessForm').evaluate(form => form.requestSubmit());
  await guest.waitForFunction(() => document.querySelector('.draw-player-state')?.textContent || [...document.querySelectorAll('.draw-player-state')].some(el => el.textContent.includes('صح')));
  await host.waitForFunction(() => [...document.querySelectorAll('.draw-player-state')].some(el => el.textContent.includes('صح')));
  assert.match(await host.locator('.draw-feed-card .draw-room-feed').innerText(), /خمّنها صح/);
  assert.equal(await third.locator('#guessInput').isVisible(), true);
  assert.equal(await guest.locator('#guessInput').count(), 0);
  await host.locator('#revealTelegramControls').click();
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), false);
  for (const [width,height] of [[320,640],[390,844],[768,1024],[1024,768],[1366,768],[1920,1080]]) {
    await host.setViewportSize({ width, height });
    const result = await host.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, players: document.querySelector('.draw-room-players').getBoundingClientRect().toJSON(), board: document.querySelector('.draw-board-card').getBoundingClientRect().toJSON(), feed: document.querySelector('.draw-feed-card').getBoundingClientRect().toJSON() }));
    assert.ok(result.scrollWidth <= width + 1, `drawing room overflow: ${width}x${height}`);
    if (width > 700) assert.ok(result.players.right <= result.board.left, 'wide players left');
    else assert.ok(result.players.top >= result.feed.bottom - 1, 'mobile players below the game');
  }
  // Play complete rotations using the real three clients until the target ends the match.
  const actors = [host, guest, third];
  const stateFor = async page => page.evaluate(async id => {
    const token = localStorage.getItem('cg-room-token-' + id);
    return (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
  }, roomId);
  await third.locator('#guessInput').fill(word);
  await third.locator('#guessForm').evaluate(form => form.requestSubmit());
  await host.waitForFunction(() => !!document.querySelector('[data-action="start-round"]'));
  for (let i = 0; i < 10; i++) {
    let view = await stateFor(host);
    if (view.room.status === 'finished') break;
    const round = view.state.round;
    await host.locator('[data-action="start-round"]').click();
    await host.waitForFunction(async ({ id, round }) => {
      const token = localStorage.getItem('cg-room-token-' + id);
      const result = await (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
      return result.state.round > round;
    }, { id: roomId, round });
    view = await stateFor(host);
    const drawer = view.state.drawer;
    const secret = (await stateFor(actors[drawer])).state.word;
    assert.ok(secret);
    for (let seat = 0; seat < actors.length; seat++) {
      if (seat === drawer) continue;
      view = await stateFor(host);
      if (view.room.status === 'finished') break;
      const input = actors[seat].locator('#guessInput');
      await input.waitFor(); await input.fill(secret);
      await actors[seat].locator('#guessForm').evaluate(form => form.requestSubmit());
      await actors[seat].waitForFunction(async ({ id, seat }) => {
        const token = localStorage.getItem('cg-room-token-' + id);
        const result = await (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
        return result.room.status === 'finished' || result.state.guesses.some(g => g.seat === seat && g.correct);
      }, { id: roomId, seat });
    }
    view = await stateFor(host);
    if (view.room.status !== 'finished') await host.locator('[data-action="start-round"]').waitFor();
  }
  await host.locator('.draw-standings').waitFor();
  assert.equal((await stateFor(host)).room.status, 'finished');
  assert.equal(await host.locator('.draw-standing').count(), 3);
  assert.match(await host.locator('.draw-standings').innerText(), /ترتيب المباراة/);
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), false);
  await guest.evaluate(() => window.__nativeBack());
  await guest.waitForURL('**/interactive');
  assert.deepEqual(errors, []);
  console.log('Drawing room passed: real create/join/start/draw/guess, hidden word, account photos/fallback, resize, timers and native Back.');
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
