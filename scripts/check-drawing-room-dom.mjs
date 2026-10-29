// Starts no browser: it drives the real Mini App markup in jsdom against a
// running dev server (GAMES_TEST_URL, default http://localhost:3000). It covers
// the drawing-room flow and DOM, not pixel layout.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const html = await (await fetch(`${base}/gartic`)).text();
const errors = [];
const windows = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeClient(name) {
  const dom = new JSDOM(html, {
    url: `${base}/gartic`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (input, init) => {
        const url = new URL(String(input), base);
        if (url.pathname === '/api/interactive/profile') return Promise.resolve(new Response(JSON.stringify({ profile: { level: 3, xp: 120, games: 8, winRate: 50 }, isBotCreator: name === 'أحمد' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.pathname === '/api/interactive/config') return Promise.resolve(new Response(JSON.stringify({ botUsername: 'CodeGamesBot' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        return fetch(url, init);
      };
      window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_t, prop) => (prop === 'canvas' ? { width: 900, height: 580 } : () => {}), set: () => true });
      window.HTMLCanvasElement.prototype.setPointerCapture = () => {};
      window.HTMLCanvasElement.prototype.releasePointerCapture = () => {};
      window.Telegram = {
        WebApp: {
          initData: 'mock-init-data', initDataUnsafe: { user: { id: name.length + 10, first_name: name } },
          ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent() {}, isVersionAtLeast: () => true,
          isFullscreen: true, requestFullscreen() {}, exitFullscreen() {},
          BackButton: { show() {}, hide() {}, onClick() {} },
        },
      };
      window.addEventListener('error', event => errors.push(String((event.error && event.error.stack) || event.message)));
    },
  });
  windows.push(dom);
  return dom.window;
}

async function waitFor(check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await sleep(120);
  }
  throw new Error(`timeout: ${label}`);
}
const click = (win, selector) => {
  const element = win.document.querySelector(selector);
  assert.ok(element, `missing ${selector}`);
  element.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
};
const roomOf = win => new URLSearchParams(win.location.search).get('room');
const state = async (win, id) => (await fetch(`${base}/api/interactive/rooms/${id}`, { headers: { Authorization: `Bearer ${win.localStorage.getItem(`cg-room-token-${id}`)}` } })).json();
const submit = (win, formSelector, inputSelector, value) => {
  win.document.querySelector(inputSelector).value = value;
  win.document.querySelector(formSelector).dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
};

try {
  const host = makeClient('أحمد');
  const guest = makeClient('سارة');
  const third = makeClient('علي');
  await waitFor(() => host.document.querySelector('#drawCreateTitle'), 'host lobby');
  // The create card offers a visibility switch, and the lobby browses open rooms.
  const visibility = host.document.querySelector('#drawRoomVisible');
  assert.ok(visibility, 'the create card has a visibility switch');
  assert.equal(visibility.checked, true, 'rooms start visible');
  assert.match(host.document.querySelector('.draw-toggle-copy').textContent, /مرئية/);
  assert.ok(host.document.querySelector('#drawPublicList'), 'the lobby lists open rooms');
  assert.ok(host.document.querySelector('#drawPublicRefresh'), 'the list can be refreshed');
  click(host, '[data-action="friend"]');
  await waitFor(() => host.document.querySelector('.draw-room'), 'host room');
  const roomId = await waitFor(() => roomOf(host), 'room code');
  assert.match(roomId, /^[A-Z0-9]{12}$/);
  for (const win of [guest, third]) {
    await waitFor(() => win.document.querySelector('#drawRoomCode'), 'guest lobby');
    win.document.querySelector('#drawRoomCode').value = roomId;
    click(win, '#drawJoinButton');
    await waitFor(() => win.document.querySelector('.draw-room'), 'guest room');
  }
  await waitFor(() => host.document.querySelectorAll('.draw-player-row:not(.empty)').length === 3, 'three players');
  assert.ok(host.document.querySelectorAll('.draw-player-row.empty').length >= 1, 'waiting rooms show free seats');
  assert.match(host.document.querySelector('.draw-player-row.empty').textContent, /فارغ/);
  assert.equal(host.document.querySelector('.draw-player-row.empty').textContent.includes('فاضي'), false);
  // Counts and scores stay in western digits.
  assert.match(host.document.querySelector('.draw-players-title small').textContent, /^\s*3\s*\/\s*16\s*$/);
  assert.doesNotMatch(host.document.querySelector('#roomContent').textContent, /[\u0660-\u0669]/);
  // The verified badge follows the creator into the room and reaches the other players too.
  assert.equal(host.document.querySelectorAll('.draw-player-row .creator-verified-badge').length, 1, 'the creator badge shows for the host');
  assert.ok(host.document.querySelector('.draw-player-row').querySelector('.creator-verified-badge'), 'the badge sits next to the creator name');
  assert.equal(guest.document.querySelectorAll('.draw-player-row .creator-verified-badge').length, 1, 'the friends see the creator badge');

  click(host, '[data-action="start"]');
  await waitFor(() => host.document.querySelector('.draw-word-choice'), 'word suggestions');
  const choices = [...host.document.querySelectorAll('.draw-word-choice')].map(button => button.dataset.word);
  assert.equal(choices.length, 2, 'the artist picks between two words');
  assert.equal(await guest.document.querySelectorAll('.draw-word-choice').length, 0, 'suggestions stay private');
  assert.match(guest.document.querySelector('.draw-wait-overlay').textContent, /يختار كلمة/);
  assert.equal((await state(host, roomId)).state.phase, 'choosing');
  assert.equal((await state(guest, roomId)).state.wordChoices.length, 0);

  click(host, '.draw-word-choice');
  await waitFor(() => host.document.querySelector('.draw-room').dataset.phase === 'drawing', 'drawing phase');
  await waitFor(() => guest.document.querySelector('#guessInput'), 'guest guess input');
  const word = (await state(host, roomId)).state.word;
  assert.ok(word, 'the artist gets a word');
  assert.equal((await state(guest, roomId)).state.word, '', 'the word never reaches the guessers');

  assert.equal(host.document.querySelectorAll('.draw-tool[data-tool]').length, 8);
  // The colour wheel expands into a live gradient picker, and the clear button
  // wears the same line-art icon set as the other tools.
  assert.ok(host.document.querySelector('.draw-color-wheel'), 'the artist gets the colour wheel');
  assert.ok(host.document.querySelector('.draw-clear svg'), 'clear-all uses the shared line-art icon');
  assert.equal(host.document.querySelectorAll('.draw-tool svg').length, 1);
  assert.equal(host.document.querySelector('#drawColorPop').classList.contains('open'), false);
  click(host, '.draw-color-wheel');
  const colorPop = host.document.querySelector('#drawColorPop');
  assert.equal(colorPop.classList.contains('open'), true, 'the wheel expands');
  // A fixed layer, so the scrolling tool rail cannot clip it away.
  assert.equal(colorPop.style.position, '', 'position comes from the stylesheet');
  assert.match(colorPop.style.left, /^\d+px$/, 'the panel is placed next to the wheel');
  assert.match(colorPop.style.top, /^\d+px$/, 'the panel stays inside the screen');
  assert.match(String(html), /\.draw-color-pop\{position:fixed/, 'the picker is a fixed layer');
  const hue = host.document.querySelector('#drawHue');
  hue.value = '130';
  hue.dispatchEvent(new host.Event('input', { bubbles: true }));
  assert.match(host.document.querySelector('#drawColorWheel').style.getPropertyValue('--pick'), /^#[0-9a-f]{6}$/, 'the gradient picker yields a real colour');
  assert.match(host.document.querySelector('#drawColorHex').textContent.trim(), /^#[0-9a-f]{6}$/);
  // The board is measured from its wrapper and the leftover screen height, not
  // squeezed into a letterboxed inner box.
  const sizedCanvas = host.document.querySelector('#drawCanvas');
  assert.ok(sizedCanvas.width > 0 && sizedCanvas.height > 0, 'the bitmap is sized to the real board box');
  // One-screen layout: the room owns the viewport, the cards take the leftover
  // height and their lists scroll inside instead of pushing the page down.
  assert.match(String(html), /#roomPage\[data-game="gartic"\] \.draw-canvas\{[^}]*position:absolute[^}]*aspect-ratio:auto/, 'the board fills its frame exactly');
  assert.match(String(html), /body:has\(#gameApp\[data-page="room"\]\[data-game="gartic"\]\)\{[^}]*overflow:hidden/, 'the page itself never scrolls during play');
  assert.match(String(html), /#roomPage\[data-game="gartic"\] \.draw-room\{[^}]*overflow:hidden/, 'the room grid is clamped to the screen');
  assert.match(String(html), /#roomPage\[data-game="gartic"\] \.draw-room-feed\{[^}]*flex:1 1 auto/, 'feeds grow with the card instead of a fixed height');
  assert.doesNotMatch(String(html), /\.draw-room-feed\{height:clamp\(84px/, 'the feed is not pinned to a small fixed height');
  assert.match(String(html), /#roomPage\[data-game="gartic"\] \.draw-player-list\{[^}]*flex:1 1 auto/, 'the player list fills the column and scrolls on its own');
  assert.equal(host.document.querySelectorAll('.palette-color').length, 20);
  assert.equal(guest.document.querySelectorAll('.draw-tool').length, 0);
  assert.equal(host.document.querySelectorAll('.draw-feed-card').length, 1);
  assert.equal(host.document.querySelectorAll('.draw-logs-card').length, 1);
  assert.equal(host.document.querySelector('#drawChatInput'), null, 'the artist does not chat');
  assert.ok(guest.document.querySelector('#drawChatInput'), 'guessers chat in the log card');
  assert.match(host.document.querySelector('.draw-word-bar').textContent, new RegExp(word));
  assert.match(guest.document.querySelector('.draw-word-bar').textContent, /•/);

  click(host, '[data-action="hint"]');
  await waitFor(async () => (await state(guest, roomId)).state.masked.includes(word[0]), 'hint reveals a letter');

  const canvas = host.document.querySelector('#drawCanvas');
  canvas.onpointerdown({ clientX: 100, clientY: 100, pointerId: 1 });
  canvas.onpointermove({ clientX: 160, clientY: 140, pointerId: 1 });
  canvas.onpointerup({ clientX: 160, clientY: 140, pointerId: 1 });
  await waitFor(async () => (await state(guest, roomId)).state.strokes.length === 1, 'pen stroke saved');
  click(host, '.draw-tool[data-tool="rect-fill"]');
  canvas.onpointerdown({ clientX: 300, clientY: 300, pointerId: 1 });
  canvas.onpointermove({ clientX: 420, clientY: 400, pointerId: 1 });
  canvas.onpointerup({ clientX: 420, clientY: 400, pointerId: 1 });
  await waitFor(async () => (await state(guest, roomId)).state.strokes.length === 2, 'shape stroke saved');
  const strokes = (await state(guest, roomId)).state.strokes;
  assert.equal(strokes[1].kind, 'rect-fill');
  // One tap wipes every stroke on the board.
  click(host, '.draw-clear');
  await waitFor(async () => (await state(guest, roomId)).state.strokes.length === 0, 'clear wipes the whole board');
  // A tap without any movement still leaves a mark.
  canvas.onpointerdown({ clientX: 200, clientY: 200, pointerId: 1 });
  canvas.onpointerup({ clientX: 200, clientY: 200, pointerId: 1 });
  await waitFor(async () => {
    const board = (await state(guest, roomId)).state.strokes;
    return board.length === 1 && board[0].points.length === 2 && board[0].points[0][0] === board[0].points[1][0];
  }, 'a tap leaves a dot');
  // While the pen is down the guessers already see the stroke growing.
  canvas.onpointerdown({ clientX: 260, clientY: 220, pointerId: 2 });
  canvas.onpointermove({ clientX: 300, clientY: 260, pointerId: 2 });
  await waitFor(async () => (await state(guest, roomId)).state.strokes.some(stroke => stroke.live), 'the live stroke reaches the guessers', 6000);
  canvas.onpointermove({ clientX: 360, clientY: 300, pointerId: 2 });
  canvas.onpointerup({ clientX: 360, clientY: 300, pointerId: 2 });
  await waitFor(async () => {
    const board = (await state(guest, roomId)).state.strokes;
    return board.length === 2 && board.every(stroke => !stroke.live);
  }, 'lifting the pen commits the stroke');

  submit(guest, '#drawChatForm', '#drawChatInput', 'مرحبا بالجميع');
  await waitFor(() => /مرحبا بالجميع/.test(third.document.querySelector('.draw-logs-card').textContent), 'chat shows in the log card');
  assert.equal(/مرحبا بالجميع/.test(host.document.querySelector('.draw-logs-card').textContent), false, 'the artist does not read the guessers chat');

  submit(guest, '#guessForm', '#guessInput', word);
  await waitFor(async () => (await state(host, roomId)).state.guesses.some(guess => guess.correct), 'first correct guess');
  assert.equal((await state(host, roomId)).state.phase, 'drawing', 'the round waits for every guesser');
  const round = (await state(host, roomId)).state.round;
  const drawer = (await state(host, roomId)).state.drawer;
  submit(third, '#guessForm', '#guessInput', word);
  await waitFor(async () => (await state(host, roomId)).state.phase === 'reveal', 'reveal phase');
  await waitFor(() => /الجواب/.test(host.document.querySelector('.draw-logs-card').textContent), 'the answer is logged');
  // The next round starts on its own and the pencil moves to the next player.
  await waitFor(async () => { const view = await state(host, roomId); return view.state.round > round && view.state.phase !== 'reveal'; }, 'auto next round', 20000);
  const nextView = await state(host, roomId);
  assert.notEqual(nextView.state.drawer, drawer, 'the artist rotates');
  const drawerWindow = [host, guest, third][nextView.state.drawer];
  await waitFor(() => drawerWindow.document.querySelector('.draw-word-choice'), 'the next artist gets the word card');
  assert.match(drawerWindow.document.querySelector('.draw-choose h3').textContent, /دورك/);
  // Leaving the room frees the seat for everyone and lands in the log.
  delete third.navigator.sendBeacon;
  third.dispatchEvent(new third.Event('pagehide'));
  await waitFor(() => host.document.querySelectorAll('.draw-player-row:not(.empty)').length === 2, 'the host sees the player leave');
  assert.match(host.document.querySelector('.draw-logs-card').textContent, /علي غادر/);
  assert.doesNotMatch(host.document.querySelector('.draw-room-players').textContent, /علي/);
  // The same room code still works for the friend who walked out: he lands back in
  // the running match instead of getting "the room can't be opened".
  const returning = makeClient('علي');
  await waitFor(() => returning.document.querySelector('#drawRoomCode'), 'returning lobby');
  returning.document.querySelector('#drawRoomCode').value = roomId;
  click(returning, '#drawJoinButton');
  await waitFor(() => returning.document.querySelector('.draw-room'), 'rejoined room');
  assert.equal(returning.document.querySelector('.draw-join-failure'), null, 'the old code is not refused');
  await waitFor(() => host.document.querySelectorAll('.draw-player-row:not(.empty)').length === 3, 'the host sees the friend come back');
  assert.match(host.document.querySelector('.draw-logs-card').textContent, /علي انضم/);
  assert.ok(returning.document.querySelector('#drawCanvas'), 'the rejoined friend gets the board');
  // Open rooms are discoverable: a new visitor finds the room in the lobby and joins
  // it with one tap, while a hidden room only works through its code.
  const host2 = makeClient('منشئ');
  await waitFor(() => host2.document.querySelector('#drawCreateTitle'), 'second lobby');
  click(host2, '[data-action="friend"]');
  await waitFor(() => host2.document.querySelector('.draw-room'), 'second room');
  const room2 = await waitFor(() => roomOf(host2), 'second room code');
  const visitor = makeClient('زائر');
  await waitFor(() => visitor.document.querySelector('#drawPublicList'), 'visitor lobby');
  await waitFor(() => visitor.document.querySelector(`[data-join-room="${room2}"]`), 'the open room is listed', 15000);
  assert.match(visitor.document.querySelector(`[data-join-room="${room2}"]`).closest('.draw-public-room').textContent, /منشئ/);
  click(visitor, `[data-join-room="${room2}"]`);
  await waitFor(() => visitor.document.querySelector('.draw-room'), 'joined from the list');
  assert.equal(roomOf(visitor), room2, 'the listing joins the right room');

  const hiddenHost = makeClient('مخفي');
  await waitFor(() => hiddenHost.document.querySelector('#drawCreateTitle'), 'hidden lobby');
  const hiddenSwitch = hiddenHost.document.querySelector('#drawRoomVisible');
  hiddenSwitch.checked = false;
  hiddenSwitch.dispatchEvent(new hiddenHost.Event('change', { bubbles: true }));
  assert.match(hiddenHost.document.querySelector('#drawRoomVisibleHint').textContent, /مخفية/);
  click(hiddenHost, '[data-action="friend"]');
  await waitFor(() => hiddenHost.document.querySelector('.draw-room'), 'hidden room');
  const hiddenCode = await waitFor(() => roomOf(hiddenHost), 'hidden room code');
  const listed = await (await fetch(`${base}/api/interactive/rooms?game=gartic`)).json();
  assert.ok(!listed.rooms.some(room => room.id === hiddenCode), 'the hidden room never shows in the browser');
  const byCode = await fetch(`${base}/api/interactive/rooms/${hiddenCode}`, { headers: { Authorization: `Bearer ${hiddenHost.localStorage.getItem(`cg-room-token-${hiddenCode}`)}` } });
  assert.equal(byCode.status, 200, 'the hidden room still opens with its code');
  assert.deepEqual(errors, []);
  console.log('Drawing room DOM flow passed: words, tools, shapes, colour wheel (opens as a fixed panel), clear-all, dots, live strokes, logs, chat, hint, automatic next round, leaving/rejoining by code and the public room browser.');
} finally {
  for (const dom of windows) dom.window.close();
}
