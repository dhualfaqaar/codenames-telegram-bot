// Drives the real chess Mini App markup in jsdom against a running dev server
// (GAMES_TEST_URL, default http://localhost:3000). It checks the friend box: the
// time picker, the waiting state, and that the countdown only starts once a
// friend actually joins.
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

const win = makeClient('صديق');
const click = (target, selector) => {
  const element = target.document.querySelector(selector);
  assert.ok(element, `missing ${selector}`);
  element.dispatchEvent(new target.MouseEvent('click', { bubbles: true }));
};
await waitFor(() => win.document.querySelector('#chessFriendCard'), 'chess home');

// The time picker is a grid of cards, not a thin select.
click(win, '#chessFriendCard');
await waitFor(() => win.document.querySelector('.chess-time-card'), 'time picker');
const cards = [...win.document.querySelectorAll('.chess-time-card')];
assert.equal(cards.length, 5, 'five match lengths are offered');
assert.deepEqual(cards.map(card => card.querySelector('strong').textContent), ['5', '10', '15', '20', '30']);
assert.equal(win.document.querySelector('#chessFriendMinutes'), null, 'the plain select is gone');
click(win, '.chess-time-card[data-chess-time="15"]');
assert.equal(win.document.querySelectorAll('.chess-time-card.selected').length, 1, 'exactly one length is selected');
assert.equal(win.document.querySelector('.chess-time-card[data-chess-time="15"]').classList.contains('selected'), true);

// Opening the room shows the waiting box, with no countdown and no old screen.
click(win, '#createChessFriendRoom');
const status = await waitFor(() => win.document.querySelector('#chessFriendStatus'), 'friend box shown', 20000);
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
const token = win.localStorage.getItem(`cg-room-token-${roomId}`);
const playing = await waitFor(async () => {
  const state = await (await fetch(`${base}/api/interactive/rooms/${roomId}`, { headers: { Authorization: `Bearer ${token}` } })).json();
  return state?.room?.status === 'playing';
}, 'the match starts on its own', 20000);
assert.ok(playing, 'the game is playing');
assert.equal(errors.length, 0, `no runtime errors: ${errors.join(' | ')}`);

// The bot fallback fills the empty seat and starts the same room without a wait.
const botWin = makeClient('بوت');
await waitFor(() => botWin.document.querySelector('#chessFriendCard'), 'chess home for the bot path');
click(botWin, '#chessFriendCard');
await waitFor(() => botWin.document.querySelector('#createChessFriendRoom'), 'picker for the bot path');
click(botWin, '#createChessFriendRoom');
await waitFor(() => botWin.document.querySelector('#chessFriendBot'), 'bot button in the waiting box', 20000);
const botRoom = await waitFor(() => new URLSearchParams(botWin.location.search).get('room'), 'bot room code');
const botToken = botWin.localStorage.getItem(`cg-room-token-${botRoom}`);
click(botWin, '#chessFriendBot');
const botPlaying = await waitFor(async () => {
  const state = await (await fetch(`${base}/api/interactive/rooms/${botRoom}`, { headers: { Authorization: `Bearer ${botToken}` } })).json();
  return state?.room?.status === 'playing';
}, 'the bot match starts', 30000);
assert.ok(botPlaying, 'filling the seat with a bot still starts the match');
botWin.close();
assert.equal(errors.length, 0, `no runtime errors: ${errors.join(' | ')}`);

console.log('Chess friend box passed: time cards, waiting without a countdown, no old screen behind, and a six second start only after the friend joins.');
win.close();
process.exit(0);
