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
// The lobby is a hub with three buttons: play, create a room, and the room
// list. Both screens are separate views that start hidden.
const openRooms = async win => {
  await waitFor(() => win.document.querySelector('#drawOpenRooms'), 'rooms button');
  if (win.document.querySelector('#drawRoomsScreen').hidden) click(win, '#drawOpenRooms');
  await waitFor(() => !win.document.querySelector('#drawRoomsScreen').hidden, 'rooms screen open');
};
const openCreateScreen = async win => {
  await waitFor(() => win.document.querySelector('#drawCreateRoom'), 'create button');
  if (win.document.querySelector('#drawCreateScreen').hidden) click(win, '#drawCreateRoom');
  await waitFor(() => !win.document.querySelector('#drawCreateScreen').hidden, 'create screen open');
};
const createRoomFromLobby = async win => {
  await openCreateScreen(win);
  click(win, '[data-action="friend"]');
};
const joinByCode = async (win, code) => {
  await waitFor(() => win.document.querySelector('#drawRoomCode'), 'code field');
  win.document.querySelector('#drawRoomCode').value = code;
  click(win, '#drawJoinButton');
};
const state = async (win, id) => (await fetch(`${base}/api/interactive/rooms/${id}`, { headers: { Authorization: `Bearer ${win.localStorage.getItem(`cg-room-token-${id}`)}` } })).json();
const submit = (win, formSelector, inputSelector, value) => {
  win.document.querySelector(inputSelector).value = value;
  win.document.querySelector(formSelector).dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
};

try {
  const host = makeClient('أحمد');
  const guest = makeClient('سارة');
  const third = makeClient('علي');
  await waitFor(() => host.document.querySelector('#drawQuickPlay'), 'host lobby');
  // The lobby keeps its two columns: your own photo, name and country above the
  // three buttons on one side, and the room code field on the other.
  const play = host.document.querySelector('.draw-lobby-play');
  assert.ok(play.querySelector('.draw-account-avatar'), 'your photo is in the lobby column');
  assert.match(play.querySelector('.draw-lobby-name').textContent, /أحمد/, 'your name is in the lobby column');
  assert.ok(play.querySelector('.draw-lobby-country .country-flag'), 'your country flag is in the lobby column');
  assert.equal(host.document.querySelector('#drawQuickPlay').textContent.trim(), 'العب');
  assert.equal(host.document.querySelector('#drawCreateRoom').textContent.trim(), 'أنشئ غرفة');
  assert.equal(host.document.querySelector('#drawOpenRooms').textContent.trim(), 'الغرف');
  assert.ok(host.document.querySelector('.draw-lobby-grid').contains(host.document.querySelector('#drawRoomCode')), 'the code field sits in the lobby');
  assert.equal(host.document.querySelector('#drawRoomsScreen').hidden, true, 'the rooms screen starts closed');
  assert.equal(host.document.querySelector('#drawCreateScreen').hidden, true, 'the create screen starts closed');
  await openRooms(host);
  assert.equal(host.document.querySelector('#drawHub').hidden, true, 'the rooms screen replaces the lobby');
  assert.ok(host.document.querySelector('.draw-rooms-box').contains(host.document.querySelector('#drawPublicList')), 'the room list sits inside a framed box');
  assert.ok(host.document.querySelector('#drawPublicRefresh'), 'the list can be refreshed');
  click(host, '#drawRoomsBack');
  await waitFor(() => !host.document.querySelector('#drawHub').hidden, 'back to the lobby');
  await openCreateScreen(host);
  assert.equal(host.document.querySelector('#drawHub').hidden, true, 'the create screen replaces the hub');
  const visibility = host.document.querySelector('#drawRoomVisible');
  assert.ok(visibility, 'the create card has a visibility switch');
  assert.equal(visibility.checked, true, 'rooms start visible');
  assert.match(host.document.querySelector('.draw-toggle-copy').textContent, /مرئية/);
  click(host, '[data-action="friend"]');
  await waitFor(() => host.document.querySelector('.draw-room'), 'host room');
  const roomId = await waitFor(() => roomOf(host), 'room code');
  assert.match(roomId, /^[A-Z0-9]{12}$/);
  for (const win of [guest, third]) {
    await joinByCode(win, roomId);
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
  // The ten second window is spelled out on both sides, so a missed card never looks
  // like a broken board.
  assert.match(guest.document.querySelector('.draw-wait-overlay').textContent, /ثانية/);
  assert.match(host.document.querySelector('.draw-choose-timer').textContent, /باقي/);
  assert.match(host.document.querySelector('.draw-choose-timer').textContent, /ينتقل الدور/);
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
  // The answer is never published: no reveal line in the guesses or the log.
  const afterRound = `${host.document.querySelector('.draw-logs-card').textContent} ${host.document.querySelector('.draw-feed-card').textContent}`;
  assert.doesNotMatch(afterRound, /الجواب/, 'the word is not announced when the round ends');
  assert.doesNotMatch(host.document.querySelector('.draw-canvas-wrap').textContent, new RegExp(word), 'the board overlay keeps the answer hidden');
  assert.equal(host.document.querySelectorAll('.draw-guess-reveal').length, 0, 'no answer row is rendered');
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
  await waitFor(() => returning.document.querySelector('#drawQuickPlay'), 'returning lobby');
  await joinByCode(returning, roomId);
  await waitFor(() => returning.document.querySelector('.draw-room'), 'rejoined room');
  assert.equal(returning.document.querySelector('.draw-join-failure'), null, 'the old code is not refused');
  await waitFor(() => host.document.querySelectorAll('.draw-player-row:not(.empty)').length === 3, 'the host sees the friend come back');
  assert.match(host.document.querySelector('.draw-logs-card').textContent, /علي انضم/);
  assert.ok(returning.document.querySelector('#drawCanvas'), 'the rejoined friend gets the board');
  // Open rooms are discoverable: a new visitor finds the room in the lobby and joins
  // it with one tap, while a hidden room only works through its code.
  const host2 = makeClient('منشئ');
  await waitFor(() => host2.document.querySelector('#drawQuickPlay'), 'second lobby');
  await createRoomFromLobby(host2);
  await waitFor(() => host2.document.querySelector('.draw-room'), 'second room');
  const room2 = await waitFor(() => roomOf(host2), 'second room code');
  const visitor = makeClient('زائر');
  await waitFor(() => visitor.document.querySelector('#drawQuickPlay'), 'visitor lobby');
  await openRooms(visitor);
  assert.equal(visitor.document.querySelector('#drawHub').hidden, true, 'the rooms screen replaces the hub');
  assert.equal(visitor.document.querySelector('#drawRoomsPlay').disabled, true, 'play stays locked until a room is picked');
  const card = await waitFor(() => visitor.document.querySelector(`[data-room-id="${room2}"]`), 'the open room is listed', 15000);
  assert.match(card.textContent, /منشئ/);
  // Picking a room unlocks the play button, and only then does it join.
  click(visitor, `[data-room-id="${room2}"]`);
  await waitFor(() => visitor.document.querySelector(`[data-room-id="${room2}"]`).getAttribute('aria-pressed') === 'true', 'the room is selected');
  assert.equal(visitor.document.querySelector('#drawRoomsPlay').disabled, false, 'play unlocks with a selection');
  click(visitor, '#drawRoomsPlay');
  await waitFor(() => visitor.document.querySelector('.draw-room'), 'joined from the picked room');
  assert.equal(roomOf(visitor), room2, 'the picked room is the one joined');

  // «العب» drops a newcomer into an existing open room in one tap.
  const quick = makeClient('سريع');
  await waitFor(() => quick.document.querySelector('#drawQuickPlay'), 'quick lobby');
  click(quick, '#drawQuickPlay');
  await waitFor(() => quick.document.querySelector('.draw-room'), 'quick play joins a room');
  assert.match(roomOf(quick) || '', /^[A-Z0-9]{12}$/, 'play lands in a real room');

  const back = makeClient('رجوع');
  await waitFor(() => back.document.querySelector('#drawOpenRooms'), 'back lobby');
  await openRooms(back);
  click(back, '#drawRoomsBack');
  await waitFor(() => !back.document.querySelector('#drawHub').hidden, 'the hub comes back');

  const hiddenHost = makeClient('مخفي');
  await waitFor(() => hiddenHost.document.querySelector('#drawQuickPlay'), 'hidden lobby');
  await openCreateScreen(hiddenHost);
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
  // Play the match out on the board: once someone reaches the target score the
  // winners podium takes over the canvas, counts down and then a new match starts.
  {
    const seats = [host, guest, returning];
    const playRound = async () => {
      const picker = await waitFor(() => seats.find(win => win.document.querySelector('.draw-word-choice')), 'a drawer gets the word card', 20000);
      click(picker, '.draw-word-choice');
      await waitFor(async () => (await state(picker, roomId)).state.phase === 'drawing', 'the round starts drawing', 15000);
      const secret = (await state(picker, roomId)).state.word;
      assert.ok(secret && secret !== '؟', 'the drawer receives the real word');
      const guessers = seats.filter(win => win !== picker);
      for (const guesser of guessers) {
        await waitFor(() => guesser.document.querySelector('#guessForm'), 'guesser form', 10000);
        submit(guesser, '#guessForm', '#guessInput', secret);
      }
      await waitFor(async () => {
        const view = await state(host, roomId);
        return view.room.status === 'finished' || view.state.phase === 'reveal';
      }, 'round resolved', 15000);
      return (await state(host, roomId)).room.status;
    };
    let status = (await state(host, roomId)).room.status;
    for (let round = 0; round < 6 && status !== 'finished'; round++) status = await playRound();
    assert.equal(status, 'finished', 'the match ends when a player reaches the target score');
    const podium = await waitFor(() => host.document.querySelector('.draw-podium'), 'the winners podium takes over the board', 15000);
    assert.ok(podium.closest('.draw-canvas-wrap'), 'the podium sits on top of the drawing board');
    assert.match(podium.textContent, /انتهت المباراة/);
    assert.match(podium.textContent, /الفائزون/);
    assert.deepEqual([...podium.querySelectorAll('.draw-podium-slot[data-place]')].map(slot => Number(slot.dataset.place)), [2, 1, 3], 'the steps are ordered 2-1-3');
    assert.equal(podium.querySelectorAll('.draw-podium-medal').length, 3, 'every step wears a medal');
    assert.match(podium.textContent, /نقطة/, 'scores are shown on the podium');
    assert.equal(host.document.querySelector('.draw-standings'), null, 'the old bottom standings card is gone');
    const bar = podium.querySelector('.draw-podium-bar i');
    assert.match(bar.getAttribute('style'), /width:\d/, 'the countdown bar is filled');
    assert.match(podium.textContent, /مباراة جديدة تبدأ/);
    // The podium is temporary: after its countdown a brand new match starts.
    await waitFor(async () => (await state(host, roomId)).room.status === 'playing', 'the next match starts by itself', 20000);
    await waitFor(() => host.document.querySelector('.draw-podium') === null, 'the podium disappears', 15000);
    const fresh = await state(host, roomId);
    assert.equal(fresh.state.round, 1, 'the new match restarts from round one');
    assert.ok(fresh.state.scores.every(entry => entry.score === 0), 'the new match starts from zero');
  }
  // The winners podium is the real shipped renderer: pull it out of the page and
  // run it with stubs, so the 2-1-3 stage, medals and the countdown are verified.
  {
    const source = html.slice(html.indexOf('function drawPodiumMarkup('));
    let depth = 0, end = 0;
    for (let i = source.indexOf('{'); i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    const code = source.slice(0, end);
    assert.ok(code.length > 100 && code.includes('draw-podium-stage'), 'the podium renderer ships with the app');
    const stubs = {
      safe: value => String(value ?? ''),
      digit: value => String(value),
      isBotCreator: false,
      playerAvatarFlag: (avatar) => avatar,
      drawPlayerAvatar: (photo, name, extra) => `<span class="${extra}">${name}</span>`,
      verifiedBadgeMarkup: () => '<i class="creator-verified-badge"></i>',
    };
    const run = new Function('safe', 'digit', 'isBotCreator', 'playerAvatarFlag', 'drawPlayerAvatar', 'verifiedBadgeMarkup', `${code}; return drawPodiumMarkup;`);
    const renderPodium = run(stubs.safe, stubs.digit, stubs.isBotCreator, stubs.playerAvatarFlag, stubs.drawPlayerAvatar, stubs.verifiedBadgeMarkup);
    const ranking = [
      { player: { name: 'دي', seat: 0, countryCode: 'IQ' }, score: 40, index: 0 },
      { player: { name: 'رامي', seat: 1, countryCode: 'IQ' }, score: 123, index: 1 },
      { player: { name: 'سارة', seat: 2, countryCode: 'IQ' }, score: 18, index: 2 },
    ];
    const podium = renderPodium({ playerSeat: 1, players: ranking.map(entry => entry.player) }, { nextMatchIn: 7, targetScore: 100 }, ranking);
    const stageOrder = [...podium.matchAll(/data-place="(\d)"/g)].map(match => Number(match[1]));
    assert.deepEqual(stageOrder, [2, 1, 3], 'the stage is ordered second, first, third like Gartic');
    assert.match(podium, /class="draw-podium-slot place-1[^"]*"[\s\S]*?123 نقطة/, 'the winner is centred with their score');
    assert.match(podium, /رامي/, 'the winner name is shown');
    assert.match(podium, /data-place="2"[\s\S]*?دي/, 'the runner-up sits on the left');
    assert.match(podium, /data-place="3"[\s\S]*?سارة/, 'the third place sits on the right');
    assert.match(podium, /draw-podium-you/, 'the viewer is marked on their own step');
    assert.match(podium, /width:70%/, 'the countdown bar starts from the remaining seconds');
    assert.match(podium, /بعد <b dir="ltr">7<\/b> ثانية/, 'the countdown text counts down');
    assert.doesNotMatch(podium, /draw-standings/, 'the old bottom card is gone');
    assert.equal(html.includes('<section class="draw-standings"'), false, 'no duplicated standings card is shipped');
    // More than three players keep the extra ranks in one line under the stage.
    const crowd = [...ranking, { player: { name: 'علي', seat: 3, countryCode: 'IQ' }, score: 5, index: 3 }];
    const wide = renderPodium({ playerSeat: 1, players: crowd.map(entry => entry.player) }, { nextMatchIn: 0, targetScore: 100 }, crowd);
    assert.match(wide, /draw-podium-rest[\s\S]*4\. علي/, 'extra players are listed by rank');
    assert.match(wide, /تبدأ هسه/, 'a zero countdown reads as starting now');
  }
  assert.deepEqual(errors, []);
  console.log('Drawing room DOM flow passed: words, tools, shapes, colour wheel (opens as a fixed panel), clear-all, dots, live strokes, logs, chat, hint, automatic next round, leaving/rejoining by code, the public room browser and the timed winners podium.');
} finally {
  for (const dom of windows) dom.window.close();
}
