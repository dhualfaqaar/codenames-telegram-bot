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
  async function client(name, photoUrl, width, height, options = {}) {
    const context = await browser.newContext({ viewport: { width, height } });
    contexts.push(context);
    if (options.creator) {
      await context.route('**/api/interactive/profile', route => route.fulfill({ status: 200, json: { profile: { level: 3, xp: 120, games: 8, winRate: 50 }, isBotCreator: true } }));
    }
    await context.route('**/api/interactive/config', route => route.fulfill({ status: 200, json: { botUsername: 'CodeGamesTestBot' } }));
    await context.route('https://telegram.org/**', route => route.fulfill({ body: '' }));
    await context.route('https://photo.telegram-cdn.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') }));
    await context.addInitScript(({ name, photoUrl }) => {
      window.__sharedLinks = [];
      window.Telegram = { WebApp: { initData: 'mock-init-data', initDataUnsafe: { user: { id: name === 'أحمد' ? 1 : 2, first_name: name, photo_url: photoUrl } },
        openTelegramLink(link) { window.__sharedLinks.push(link); },
        isFullscreen: true, safeAreaInset: { top: 24, bottom: 20 }, contentSafeAreaInset: { top: 64, bottom: 20 },
        ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, requestFullscreen() {}, exitFullscreen() {},
        isVersionAtLeast: () => true, onEvent() {}, BackButton: { show() { window.__nativeBackShown = true; }, hide() { window.__nativeBackShown = false; }, onClick(fn) { window.__nativeBack = fn; } },
      } };
    }, { name, photoUrl });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`${base}/gartic`);
    await page.locator('#drawCreateTitle').waitFor();
    return page;
  }
  const host = await client('أحمد', 'https://photo.telegram-cdn.org/ahmad.png', 1366, 768, { creator: true });
  await host.locator('.lobby-avatar img').waitFor();
  assert.equal(await host.locator('.lobby-avatar img').getAttribute('src'), 'https://photo.telegram-cdn.org/ahmad.png');
  assert.equal(await host.locator('.draw-ribbon').innerText(), 'لعبة الرسم');
  // The lobby uses custom listboxes so the client cannot paint its own native
  // menu colours over the game palette. Verify order, palette and selection.
  const optionValues = async name => host.locator(`.draw-select[data-draw-select="${name}"] .draw-select-option`).evaluateAll(nodes => nodes.map(node => node.dataset.value));
  assert.deepEqual(await optionValues('capacity'), ['2', '4', '6', '8', '12', '16']);
  assert.deepEqual(await optionValues('roundSeconds'), ['30', '45', '75', '90', '120']);
  assert.deepEqual(await optionValues('drawTargetScore'), ['100', '120', '140', '160', '180', '200', '225', '250']);
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
  assert.equal(await host.locator('#capacityValue').innerText(), '4 لاعبين');
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
  await host.locator('#roundSecondsMenu .draw-select-option[data-value="90"]').click();
  assert.equal(await host.locator('[data-draw-select="roundSeconds"]').getAttribute('data-value'), '90');
  assert.equal(await host.locator('#roundSecondsValue').innerText(), '90 ثانية');
  await host.locator('#drawTargetScoreTrigger').click();
  await host.locator('#drawTargetScoreMenu .draw-select-option[data-value="200"]').click();
  assert.equal(await host.locator('#drawTargetScoreValue').innerText(), '200 نقطة');
  if (process.env.GAMES_SCREENSHOT_DIR) await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-lobby-selects.png`, fullPage: true });
  await host.locator('[data-action="friend"]').click();
  await host.locator('.draw-room').waitFor();
  const roomId = new URL(host.url()).searchParams.get('room');
  assert.match(roomId, /^[A-Z0-9]{12}$/);
  assert.ok(await host.getByText('بانتظار اللاعبين').first().isVisible());
  // The verified creator badge follows the account into every game room.
  await host.locator('.draw-player-row .creator-verified-badge').first().waitFor();
  assert.equal(await host.locator('.draw-player-row .creator-verified-badge').count(), 1);
  // A shared invite must carry the room code so the friend can retry manually.
  await host.locator('#inviteButton').click();
  await host.waitForFunction(() => (window.__sharedLinks || []).length > 0);
  const shared = decodeURIComponent((await host.evaluate(() => window.__sharedLinks[0])) || '');
  assert.ok(shared.includes('https://t.me/CodeGamesTestBot'), 'invite deep link should target the bot');
  assert.ok(shared.includes('CodeGamesTestBot'), 'invite deep link should use the configured bot username');
  assert.ok(shared.includes(encodeURIComponent('رمز الغرفة: ' + roomId)) || shared.includes('رمز الغرفة'), 'invite text should include the room code');
  assert.equal(await host.locator('.draw-player-row').count(), 1);
  assert.equal(await host.locator('.draw-player-row .draw-account-avatar img').getAttribute('src'), 'https://photo.telegram-cdn.org/ahmad.png');
  assert.equal(await host.locator('.draw-canvas').count(), 1);
  assert.equal(await host.locator('[data-action="start"]').count(), 0);
  const guest = await client('سارة', '', 390, 844);
  assert.equal(await guest.locator('.lobby-avatar img').count(), 0);
  assert.match(await guest.locator('.lobby-avatar').innerText(), /س/);
  // The score-target list keeps all eight options reachable on a phone screen.
  await guest.locator('#drawTargetScoreTrigger').click();
  const phoneMenu = await guest.evaluate(() => {
    const menu = document.querySelector('#drawTargetScoreMenu').getBoundingClientRect();
    return { top: menu.top, bottom: menu.bottom, viewport: window.innerHeight, count: document.querySelectorAll('#drawTargetScoreMenu .draw-select-option').length };
  });
  assert.equal(phoneMenu.count, 8);
  const phoneLast = await guest.locator('#drawTargetScoreMenu .draw-select-option[data-value="250"]').boundingBox();
  assert.ok(phoneLast.y + phoneLast.height <= phoneMenu.viewport, 'the last score target is reachable without hiding behind the viewport');
  assert.ok(phoneMenu.top >= 0 && phoneMenu.bottom <= phoneMenu.viewport, 'phone list stays inside the viewport');
  if (process.env.GAMES_SCREENSHOT_DIR) await guest.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-lobby-menu-phone.png` });
  await guest.locator('#drawTargetScoreMenu .draw-select-option[data-value="225"]').click();
  assert.equal(await guest.locator('#drawTargetScoreValue').innerText(), '225 نقطة');
  await guest.locator('#drawRoomCode').fill(roomId.toLowerCase());
  await guest.locator('#drawJoinButton').click();
  await guest.locator('.draw-room').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.draw-player-row').length === 2);
  assert.equal(await guest.locator('.draw-player-row').count(), 2);
  assert.equal(await guest.locator('[data-action="start"]').count(), 0);
  // Wide screens follow the reference layout: players | board | guesses + chat,
  // all above the fold, with the guesses card wider than the social chat.
  const positions = await host.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { players: box('.draw-room-players'), board: box('.draw-room-board'), bottom: box('.draw-room-bottom'), feed: box('.draw-feed-card'), logs: box('.draw-logs-card'), header: box('#roomPage .room-header'), viewport: window.innerHeight, scrollY: window.scrollY };
  });
  assert.ok(positions.players.right <= positions.board.left, 'players are left of board on wide screens');
  assert.ok(positions.bottom.top >= positions.board.bottom - 2, 'answers and logs sit under the board');
  assert.ok(positions.bottom.left <= positions.board.left + 2, 'the answers row starts where the board starts');
  assert.ok(positions.feed.width > positions.logs.width * 1.4, 'the answers card is wider than the log card');
  assert.ok(positions.header.top < 140, 'no oversized gap above the room title');
  await host.evaluate(() => window.scrollTo(0, 0));
  assert.ok((await host.evaluate(() => window.scrollY)) === 0, 'the room can be viewed from the top without a blank band');
  assert.ok(positions.bottom.bottom <= positions.viewport, 'answers and logs are visible without scrolling');
  if (process.env.GAMES_SCREENSHOT_DIR) await host.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/drawing-waiting.png`, fullPage: true });
  const third = await client('علي', '', 1024, 768);
  await third.locator('#drawRoomCode').fill(roomId);
  await third.locator('#drawJoinButton').click();
  await third.locator('.draw-room').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.draw-player-row').length === 3);
  await host.locator('[data-action="start"]').click();
  // The artist picks one of two suggested words before the clock starts.
  await host.locator('.draw-word-choice').first().waitFor();
  assert.equal(await host.locator('.draw-word-choice').count(), 2);
  assert.equal(await guest.locator('.draw-word-choice').count(), 0, 'the artist suggestions stay private');
  await host.locator('.draw-word-choice').first().click();
  await host.locator('.palette-color').first().waitFor();
  await guest.locator('#guessInput').waitFor();
  await third.locator('#guessInput').waitFor();
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), true);
  assert.equal(await host.locator('#drawChatInput').count(), 0);
  assert.equal(await guest.locator('#drawChatInput').count(), 1);
  assert.equal(await host.locator('.draw-player-row .player-flag-marker').count(), 3);
  // During play the answers card and the log card share one row under the board.
  const playLayout = await host.evaluate(() => {
    const box = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    return { feed: box('.draw-feed-card'), logs: box('.draw-logs-card'), feedList: box('.draw-feed-card .draw-room-feed'), logList: box('.draw-logs-card .draw-room-feed'), board: box('.draw-room-board'), tools: box('.draw-room-tools'), viewport: window.innerHeight };
  });
  assert.ok(playLayout.logs.left >= playLayout.feed.right - 1, 'the log card sits beside the answers card');
  assert.ok(playLayout.feedList.height > playLayout.logList.height * 0.9, 'the answers feed keeps a readable height');
  assert.ok(playLayout.feed.top >= playLayout.board.bottom - 2, 'answers sit under the board');
  assert.ok(playLayout.tools.right <= playLayout.board.left + 2, 'the tool rail sits left of the board');
  assert.ok(playLayout.logs.bottom <= playLayout.viewport, 'the log card is visible without scrolling');
  // Nothing in the room may need a page scroll: the board, the tool rail and both
  // cards all have to fit the viewport (inner lists scroll, the page does not).
  for (const [label, page] of [['host', host], ['guest', guest]]) {
    const fit = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight, viewport: window.innerHeight,
      body: document.body.scrollHeight, doc: document.documentElement.clientHeight,
      canvas: document.querySelector('#drawCanvas').getBoundingClientRect().toJSON(),
      wrap: document.querySelector('.draw-canvas-wrap').getBoundingClientRect().toJSON(),
      logs: document.querySelector('.draw-logs-card').getBoundingClientRect().toJSON(),
      feed: document.querySelector('.draw-feed-card').getBoundingClientRect().toJSON(),
      players: document.querySelector('.draw-room-players').getBoundingClientRect().toJSON(),
    }));
    assert.ok(fit.scroll <= fit.viewport + 2, `${label}: the room fits one screen (${fit.scroll} <= ${fit.viewport})`);
    assert.ok(fit.feed.bottom <= fit.viewport + 1 && fit.logs.bottom <= fit.viewport + 1, `${label}: guesses and log are above the fold`);
    assert.ok(fit.players.bottom <= fit.viewport + 1, `${label}: the player column is fully visible`);
    assert.ok(Math.abs(fit.canvas.width - fit.wrap.width) <= 2 && Math.abs(fit.canvas.height - fit.wrap.height) <= 2, `${label}: the board fills its frame exactly`);
  }
  assert.equal(await host.locator('.draw-tool[data-tool]').count(), 8);
  assert.equal(await host.locator('.palette-color').count(), 20);
  assert.equal(await guest.locator('.draw-tool').count(), 0, 'guessers get no drawing tools');
  const word = (await host.locator('.draw-word').first().innerText()).trim();
  assert.ok(word.length > 0, 'the artist sees the secret word');
  assert.match(await guest.locator('.draw-word').first().innerText(), /•/);
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
  await guest.waitForFunction(() => [...document.querySelectorAll('.draw-player-state')].some(el => el.textContent.includes('✓')));
  await host.waitForFunction(() => [...document.querySelectorAll('.draw-player-state')].some(el => el.textContent.includes('✓')));
  assert.match(await host.locator('.draw-feed-card .draw-room-feed').innerText(), /خمّنها صح/);
  assert.equal(await third.locator('#guessInput').isVisible(), true);
  assert.equal(await guest.locator('#guessInput').count(), 0);
  // Restoring the Telegram buttons keeps the room in fullscreen and just shows them again.
  const restoreBox = await host.locator('#revealTelegramControls').boundingBox();
  assert.ok(restoreBox.x < 60 && restoreBox.y < 60, 'the restore control sits in the top-left corner');
  const fullscreenBefore = await host.evaluate(() => !!window.Telegram.WebApp.isFullscreen);
  await host.locator('#revealTelegramControls').click();
  await host.waitForTimeout(300);
  assert.equal(await host.evaluate(() => !!window.Telegram.WebApp.isFullscreen), fullscreenBefore, 'restoring the buttons keeps fullscreen');
  assert.equal(await host.evaluate(() => window.__nativeBackShown), true, 'the native back button is shown again');
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), false);
  for (const [width,height] of [[320,640],[390,844],[768,1024],[1024,768],[1366,768],[1920,1080]]) {
    await host.setViewportSize({ width, height });
    const result = await host.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, players: document.querySelector('.draw-room-players').getBoundingClientRect().toJSON(), board: document.querySelector('.draw-room-board').getBoundingClientRect().toJSON(), feed: document.querySelector('.draw-feed-card').getBoundingClientRect().toJSON() }));
    assert.ok(result.scrollWidth <= width + 1, `drawing room overflow: ${width}x${height}`);
    if (width > 700) assert.ok(result.players.right <= result.board.left, 'wide players left');
    else assert.ok(result.players.top >= result.feed.bottom - 1, 'mobile players below the game');
  }
  // Play complete rotations using the real three clients until the target ends the match.
  const actors = [host, guest, third];
  const pickWord = async () => {
    for (const actor of actors) {
      if (await actor.locator('.draw-word-choice').count()) { await actor.locator('.draw-word-choice').first().click(); return true; }
    }
    return false;
  };
  const stateFor = async page => page.evaluate(async id => {
    const token = localStorage.getItem('cg-room-token-' + id);
    return (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
  }, roomId);
  await third.locator('#guessInput').fill(word);
  await third.locator('#guessForm').evaluate(form => form.requestSubmit());
  for (let i = 0; i < 10; i++) {
    let view = await stateFor(host);
    if (view.room.status === 'finished') break;
    const round = view.state.round;
    // The next round starts by itself; the new artist then picks a word.
    await host.waitForFunction(async ({ id, round }) => {
      const token = localStorage.getItem('cg-room-token-' + id);
      const result = await (await fetch('/api/interactive/rooms/' + id, { headers: { Authorization: 'Bearer ' + token } })).json();
      return result.state.round > round || result.room.status === 'finished';
    }, { id: roomId, round }, { timeout: 15000 });
    if ((await stateFor(host)).room.status === 'finished') break;
    await pickWord();
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
    if (view.room.status !== 'finished') await actors[drawer === 0 ? 1 : 0].locator('#guessInput').waitFor();
  }
  await host.locator('.draw-standings').waitFor();
  assert.equal((await stateFor(host)).room.status, 'finished');
  assert.equal(await host.locator('.draw-standing').count(), 3);
  assert.match(await host.locator('.draw-standings').innerText(), /ترتيب المباراة/);
  assert.equal(await host.locator('#revealTelegramControls').isVisible(), false);
  // A stale invite link shows a recovery screen (retry + back) instead of a bare error,
  // and retrying with a valid room code joins normally.
  const stale = await client('مهند', '', 390, 844);
  await stale.goto(`${base}/interactive?room=ZZZZZZZZZZZZ&game=gartic`);
  await stale.locator('.draw-join-failure').waitFor();
  assert.match(await stale.locator('.draw-join-failure h2').innerText(), /ما گدرنا نفتح الغرفة/);
  assert.equal(await stale.locator('#retryRoomCode').count(), 1);
  assert.equal(await stale.locator('#retryRoomButton').count(), 1);
  assert.equal(await stale.locator('#backToGamesButton').count(), 1);
  const failureColors = await stale.evaluate(() => {
    const card = document.querySelector('.draw-join-failure'), text = card.querySelector('p');
    const luminance = value => { const [r, g, b] = value.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    return { card: luminance(getComputedStyle(card).backgroundColor), text: luminance(getComputedStyle(text).color) };
  });
  assert.ok(failureColors.card < 0.35 && failureColors.text > 0.6, 'the recovery screen keeps readable light text on the dark card');
  if (process.env.GAMES_SCREENSHOT_DIR) await stale.screenshot({ path: `${process.env.GAMES_SCREENSHOT_DIR}/draw-join-failure.png`, fullPage: true });
  // Joining a room that already started keeps the recovery screen with the server's reason.
  await stale.locator('#retryRoomCode').fill(roomId.toLowerCase());
  await stale.locator('#retryRoomButton').click();
  await stale.waitForFunction(() => /بدأت/.test(document.querySelector('.draw-join-failure')?.innerText || ''));
  // Retrying with a fresh waiting room joins normally.
  const freshRoom = await stale.evaluate(async () => {
    const response = await fetch('/api/interactive/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'gartic', name: 'مهند', capacity: 4 }) });
    return (await response.json()).room.id;
  });
  await stale.locator('#retryRoomCode').fill(freshRoom.toLowerCase());
  await stale.locator('#retryRoomButton').click();
  await stale.locator('.draw-room').waitFor();
  assert.match(await stale.locator('#roomSubtitle').innerText(), new RegExp(freshRoom));
  await guest.evaluate(() => window.__nativeBack());
  await guest.waitForURL('**/interactive');
  assert.deepEqual(errors, []);
  console.log('Drawing room passed: real create/join/start/draw/guess, hidden word, account photos/fallback, resize, timers and native Back.');
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
}
