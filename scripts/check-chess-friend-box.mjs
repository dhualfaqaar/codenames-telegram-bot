// Drives the real chess Mini App markup in jsdom against a running dev server
// (GAMES_TEST_URL, default http://localhost:3000). It checks the friend flow:
// the time cards, the waiting box, the background behind it, the six second
// countdown that only starts once a friend joins, and the random queue that
// must keep looking for a real player instead of dropping a bot in.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const html = await (await fetch(`${base}/chess`)).text();
const errors = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeClient(name) {
  const dom = new JSDOM(html, {
    url: `${base}/chess`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (input, init) => {
        const url = new URL(String(input), base);
        if (url.pathname === '/api/interactive/profile') return Promise.resolve(new Response(JSON.stringify({ profile: { level: 3, xp: 120, games: 8, winRate: 50 }, isBotCreator: false }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        if (url.pathname === '/api/interactive/config') return Promise.resolve(new Response(JSON.stringify({ botUsername: 'CodeGamesBot' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        return fetch(url, init);
      };
      window.Telegram = {
        WebApp: {
          initData: 'mock-init-data', initDataUnsafe: { user: { id: name.length + 30, first_name: name } },
          ready() {}, expand() {}, setHeaderColor() {}, setBackgroundColor() {}, onEvent() {}, isVersionAtLeast: () => true,
          isFullscreen: true, requestFullscreen() {}, exitFullscreen() {},
          BackButton: { show() {}, hide() {}, onClick() {} },
        },
      };
      window.addEventListener('error', event => errors.push(String((event.error && event.error.stack) || event.message)));
    },
  });
  return dom.window;
}

async function waitFor(check, label, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await check();
    if (value) return value;
    await sleep(60);
  }
  throw new Error(`timeout: ${label}`);
}

const click = (target, selector) => {
  const element = target.document.querySelector(selector);
  assert.ok(element, `missing ${selector}`);
  element.dispatchEvent(new target.MouseEvent('click', { bubbles: true }));
};

const roomState = async (window, roomId) => {
  const token = window.localStorage.getItem(`cg-room-token-${roomId}`);
  const response = await fetch(`${base}/api/interactive/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } });
  return response.json();
};

async function openFriendPicker(window) {
  await waitFor(() => window.document.querySelector('#chessFriendCard'), 'chess home');
  click(window, '#chessFriendCard');
  await waitFor(() => window.document.querySelector('.chess-time-card'), 'time picker');
}

async function openFriendRoom(window) {
  await openFriendPicker(window);
  click(window, '.chess-time-card[data-chess-time="15"]');
  click(window, '#createChessFriendRoom');
  return waitFor(() => window.document.querySelector('#chessFriendStatus'), 'friend box', 20000);
}

// 1) The friend flow itself.
const win = makeClient('صديق');
await openFriendPicker(win);

// The time picker is a grid of cards, not a thin select.
const cards = [...win.document.querySelectorAll('.chess-time-card')];
assert.equal(cards.length, 5, 'five match lengths are offered');
assert.deepEqual(cards.map(card => card.querySelector('strong').textContent), ['5', '10', '15', '20', '30']);
assert.equal(win.document.querySelectorAll('.chess-time-card.selected').length, 1, 'exactly one length is selected');
assert.equal(win.document.querySelector('.chess-time-card[data-chess-time="15"]').classList.contains('selected'), true);
assert.equal(win.document.querySelector('#chessFriendMinutes'), null, 'the plain select is gone');

click(win, '#createChessFriendRoom');
await waitFor(() => win.document.querySelector('#chessFriendStatus'), 'friend box', 20000);
const status = win.document.querySelector('#chessFriendStatus');
assert.match(status.textContent, /بانتظار/);
assert.ok(win.document.querySelector('#chessFriendShare'), 'sharing with a friend is offered');
assert.ok(win.document.querySelector('#chessFriendBot') && win.document.querySelector('#chessFriendCancel'), 'bot fallback and cancel are offered');
assert.match(win.document.querySelector('#chessFriendPlayers').textContent, /بانتظار صديقك/);
const roomId = await waitFor(() => new URLSearchParams(win.location.search).get('room'), 'room code');
assert.doesNotMatch(win.document.querySelector('#roomContent').textContent, /الغرفة جاهزة/, 'the old waiting screen is gone');
await sleep(2500);
assert.match(win.document.querySelector('#chessFriendStatus').textContent, /بانتظار/, 'no countdown while alone');
assert.doesNotMatch(win.document.querySelector('#chessFriendStatus').textContent, /[0-9]/, 'no number is ticking');

// Once a friend joins, the countdown runs and the match starts by itself.
const joined = await fetch(`${base}/api/interactive/rooms/${roomId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', name: 'خصم' }) });
assert.equal(joined.status, 200, 'the friend can join the room');
await waitFor(() => /[0-9]/.test(win.document.querySelector('#chessFriendStatus').textContent), 'countdown after join', 20000);
assert.match(win.document.querySelector('#chessFriendPlayers').textContent, /خصم/, 'the friend appears in the box');
const playing = await waitFor(async () => (await roomState(win, roomId))?.room?.status === 'playing', 'the match starts on its own', 20000);
assert.ok(playing, 'the game is playing');

// 2) The bot button fills the seat in a fresh friend room.
const botWin = makeClient('بوت');
await openFriendRoom(botWin);
const botRoom = await waitFor(() => new URLSearchParams(botWin.location.search).get('room'), 'bot room code');
click(botWin, '#chessFriendBot');
const botPlaying = await waitFor(async () => (await roomState(botWin, botRoom))?.room?.status === 'playing', 'the bot match starts', 30000);
assert.ok(botPlaying, 'filling the seat with a bot still starts the match');
botWin.close();

// 3) The old room shell must not show through the dialog.
const setupWin = makeClient('خلفية');
await openFriendRoom(setupWin);
assert.equal(setupWin.document.body.classList.contains('chess-friend-waiting'), true, 'the waiting state is flagged on the body');
assert.equal(setupWin.document.querySelector('#roomPage').classList.contains('hide'), true, 'the old room screen is hidden behind the dialog');
const setupRoom = new URLSearchParams(setupWin.location.search).get('room');
await fetch(`${base}/api/interactive/rooms/${setupRoom}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', name: 'خصم' }) });
await waitFor(async () => (await roomState(setupWin, setupRoom))?.room?.status === 'playing', 'the match starts for the backdrop check', 25000);
await sleep(1200);
assert.equal(setupWin.document.body.classList.contains('chess-friend-waiting'), false, 'the flag clears once the match runs');
assert.equal(setupWin.document.querySelector('#roomPage').classList.contains('hide'), false, 'the room screen comes back for the match');
setupWin.close();

// 4) Random matchmaking only ever waits for a real player: no bot is dropped in.
const randomWin = makeClient('عشوائي');
await waitFor(() => randomWin.document.querySelector('#chessRandomCard'), 'chess home for the random check');
click(randomWin, '#chessRandomCard');
const waitingText = await waitFor(() => {
  const wait = randomWin.document.querySelector('#matchWaitText');
  return wait && wait.textContent ? wait.textContent : null;
}, 'the random queue shows its search state');
assert.doesNotMatch(waitingText, /بوت/, `the random queue never promises a bot (${waitingText})`);
await sleep(14000);
assert.equal(new URLSearchParams(randomWin.location.search).get('room'), null, 'the queue keeps searching instead of starting a bot match');
assert.equal(randomWin.document.querySelector('#cancelMatch').hidden, false, 'the search can still be cancelled');
randomWin.close();

assert.equal(errors.length, 0, `no runtime errors: ${errors.join(' | ')}`);

console.log('Chess friend box passed: time cards, a quiet backdrop behind the dialog, a six second start only after the friend joins, the bot button, and a random queue that only ever waits for a real player.');
win.close();
process.exit(0);
