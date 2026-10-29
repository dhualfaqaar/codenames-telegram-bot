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
  assert.equal(host.document.querySelector('#drawColorPop').classList.contains('open'), true, 'the wheel expands');
  const hue = host.document.querySelector('#drawHue');
  hue.value = '130';
  hue.dispatchEvent(new host.Event('input', { bubbles: true }));
  assert.match(host.document.querySelector('#drawColorWheel').style.getPropertyValue('--pick'), /^#[0-9a-f]{6}$/, 'the gradient picker yields a real colour');
  assert.match(host.document.querySelector('#drawColorHex').textContent.trim(), /^#[0-9a-f]{6}$/);
  // The board is measured from its wrapper and the leftover screen height, not
  // squeezed into a letterboxed inner box.
  const sizedCanvas = host.document.querySelector('#drawCanvas');
  assert.match(sizedCanvas.style.width, /^\d+px$/, 'canvas width comes from the wrapper');
  assert.match(sizedCanvas.style.height, /^\d+px$/, 'canvas height comes from the space left on screen');
  assert.match(String(html), /#roomPage\[data-game="gartic"\] \.draw-canvas\{[^}]*aspect-ratio:auto/, 'the room board drops the fixed aspect ratio so it cannot letterbox');
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
  assert.deepEqual(errors, []);
  console.log('Drawing room DOM flow passed: words, tools, shapes, logs, chat, hint and automatic next round.');
} finally {
  for (const dom of windows) dom.window.close();
}
