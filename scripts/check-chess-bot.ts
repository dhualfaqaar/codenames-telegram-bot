import { Chess } from 'chess.js';
import { existsSync } from 'node:fs';
import { CHESS_TRAINERS } from '../src/data/chessTrainers';
import { chooseChessBotMove } from '../src/services/chessBot';
import { STOCKFISH_ASSET_VERSION, stockfishSkillForElo, stockfishThinkTimeForElo } from '../src/services/chessStockfish';
import { CHESS_LESSONS, CHESS_PUZZLES } from '../src/data/chessLearning';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
import { SUDOKU_MINI_APP_HTML } from '../src/services/sudokuMiniApp';
const workerModule = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);
const cloudflareWorker = workerModule.default;
const INTERACTIVE_APP_BUILD = workerModule.INTERACTIVE_APP_BUILD as string;
import { InteractiveGameRooms, MemoryRoomStorage } from '../src/services/interactiveGameRooms';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(STOCKFISH_ASSET_VERSION === '19.0.1', 'expected the current Stockfish engine assets');
assert(CHESS_TRAINERS.every(trainer => trainer.name === 'بوت') && new Set(CHESS_TRAINERS.map(trainer => trainer.elo)).size === CHESS_TRAINERS.length, 'all chess trainers should use the same Bot display name while keeping distinct ELO ratings');
assert(stockfishSkillForElo(200) === 0 && stockfishSkillForElo(2_800) === 20, 'Stockfish strength endpoints are incorrect');
assert(stockfishSkillForElo(1_600) > stockfishSkillForElo(800), 'Stockfish skill should increase with ELO');
assert(stockfishThinkTimeForElo(2_800) > stockfishThinkTimeForElo(200), 'Stockfish think time should increase with ELO');
assert(stockfishThinkTimeForElo(2_800) <= 3_000, 'Stockfish mobile thinking budget should stay bounded');
const miniAppHtml = interactiveGamesMiniAppHtml('chess');
const sudokuMiniAppHtml = SUDOKU_MINI_APP_HTML;
const sudokuRouteResponse = await cloudflareWorker.fetch(new Request('https://game.test/sudoku'), {} as any, {} as any);
assert(sudokuRouteResponse.status === 200 && (await sudokuRouteResponse.text()).includes('id=\"sudokuLobby\"'), 'the public Sudoku route should serve the standalone game');
const interactivePageResponse = await cloudflareWorker.fetch(new Request(`https://game.test/interactive?app_build=${INTERACTIVE_APP_BUILD}`), {} as any, {} as any);
assert(INTERACTIVE_APP_BUILD === '2026-11-08-home-fit-v38' && interactivePageResponse.status === 200 && interactivePageResponse.headers.get('Cache-Control')?.includes('no-store') && (await interactivePageResponse.text()).includes('id="chessAppearanceButton"'), 'the live Mini App route should bypass stale caches and return the current UI');
for (const art of ['/chess-hero-v2.jpg', '/drawing-hero.jpg', '/sudoku-hero.jpg']) {
  const artResponse = await cloudflareWorker.fetch(new Request('https://game.test' + art), {} as any, {} as any);
  assert(artResponse.status === 200 && artResponse.headers.get('Content-Type') === 'image/jpeg' && (await artResponse.arrayBuffer()).byteLength > 5_000, 'game card art ' + art + ' should be served by the worker');
}
assert(miniAppHtml.includes('src="/drawing-hero.jpg"') && miniAppHtml.includes('src="/sudoku-hero.jpg"') && miniAppHtml.includes('src="/chess-hero-v2.jpg"'), 'the game library should show card art for drawing, sudoku and chess');
const chessRouteResponse = await cloudflareWorker.fetch(new Request('https://game.test/chess'), {} as any, {} as any);
const chessRouteHtml = await chessRouteResponse.text();
assert(chessRouteResponse.status === 200 && chessRouteResponse.headers.get('Cache-Control')?.includes('no-store') && chessRouteHtml.includes("var standaloneChess=standaloneGame==='chess'") && chessRouteHtml.includes("window.location.assign('/interactive')") && chessRouteHtml.includes('body.standalone-chess #gameApp>.topbar{display:none!important}') && chessRouteHtml.includes("tg.BackButton.show()"), 'the standalone Chess route should use the Telegram back control rather than showing a second close/back button');
assert(chessRouteHtml.includes("window.location.assign(new URL('/'+game,location.origin).toString())") && chessRouteHtml.includes("if(standaloneChess||new URLSearchParams(location.search).get('game')==='chess')openChessHome()"), 'opening chess from the game library should navigate to its standalone home');
assert(sudokuMiniAppHtml.includes('العب مع شخص عشوائي') && sudokuMiniAppHtml.includes('id="friendGameButton"'), 'Sudoku home should expose random-human and friend-play actions');
assert(!sudokuMiniAppHtml.includes('battleLevelSelect') && !sudokuMiniAppHtml.includes('defaultLevelSelect') && !sudokuMiniAppHtml.includes('محترف'), 'Sudoku battle must not expose difficulty choices or a locked pro mode');
assert(sudokuMiniAppHtml.includes('readBattleTickets') && sudokuMiniAppHtml.includes('بطاقات المعركة') && sudokuMiniAppHtml.includes('creator-verified-badge'), 'Sudoku battle tickets and creator badge should be available');
assert(miniAppHtml.includes('reserveSudokuBattleTicket') && miniAppHtml.includes('refundSudokuBattleTicket') && miniAppHtml.includes('settleSudokuBattleTicket'), 'random Sudoku ticket should reserve, refund on cancellation, and settle after matching');
assert(miniAppHtml.includes('opponentCountryCode') && miniAppHtml.includes('opponentIsBotCreator') && miniAppHtml.includes('countryFlag(ownCode)') && miniAppHtml.includes('countryFlag(code)'), 'Sudoku matchmaking should show both players’ country flags and creator badge');
assert(miniAppHtml.includes('id="chessPuzzleList"') && miniAppHtml.includes('id="chessDailyBoard"'), 'chess puzzle library and daily board should be rendered');
assert(miniAppHtml.includes('stockfish-19-lite-single.js'), 'Stockfish 19 worker should be loaded by the browser app');
assert(miniAppHtml.includes('chessLessons=JSON.parse') && miniAppHtml.includes('chessPuzzles=JSON.parse'), 'lesson and puzzle data should be injected into the app');
assert(miniAppHtml.includes('id=\"chessFriendCard\"') && miniAppHtml.includes('creator-verified-badge'), 'friend play card and creator-only badge should exist');
assert(!miniAppHtml.includes('إعدادات المباراة') && !miniAppHtml.includes('data-pref=\"chessTheme\"') && !miniAppHtml.includes('chessDefaultMinutes'), 'chess match settings must not remain in the profile page or active match toolbar');
assert(miniAppHtml.includes('id="chessChatButton"') && miniAppHtml.includes('chess-header-chat') && miniAppHtml.includes('chessChatMessages'), 'the chat control should sit in the room header, outside the chessboard');
assert(miniAppHtml.includes('verified-rosette') && miniAppHtml.includes('verified-star'), 'verified badge should use a centered upright vector star');
assert(miniAppHtml.includes('function openChessPlayMenu()') && miniAppHtml.includes('data-play-mode=\"bot\"') && miniAppHtml.includes('data-play-mode=\"friend\"') && miniAppHtml.includes('data-play-mode=\"random\"') && miniAppHtml.includes('chess-mode-tile-grid') && miniAppHtml.includes("if(event.target.closest('#chessPlayButton')){openChessPlayMenu();return}"), 'the chess play button should show three square choices: bot, friend, and random opponent');
assert(miniAppHtml.includes('id=\"chessRandomCard\"') && miniAppHtml.includes("if(event.target.closest('#chessRandomCard')){openChessRandomMenu();return}"), 'random chess matchmaking should be a dedicated feature card below vision');
assert(!miniAppHtml.includes('<span class=\"card-status') && !miniAppHtml.includes('chessPlayTheme') && !miniAppHtml.includes('chessRandomTheme') && !miniAppHtml.includes('chessFriendTheme'), 'game cards should not show status chips and match-start menus should not show board themes');
assert(miniAppHtml.includes('id=\"chessThemeSetting\"') && miniAppHtml.includes('for=\"countryPickerToggle\">بلدك') && miniAppHtml.includes('id=\"countryPickerOptions\"') && miniAppHtml.includes('id=\"accountCountryFlag\"') && !miniAppHtml.includes('accountChessThemeSelect'), 'account should keep a dark country selector while board themes live in chess settings');
assert(miniAppHtml.includes('code-games-avatar.jpg') && miniAppHtml.includes("player.bot?'/code-games-avatar.jpg':''"), 'chess bots should display the main Code Games bot avatar');
assert(miniAppHtml.includes('#roomPage[data-game=\"chess\"] .chessboard>.square.light{background:#dce8f2!important}') && miniAppHtml.includes('.chess-piece{display:block!important'), 'live chessboard squares and pieces should remain visible as a full 8x8 board');
assert(miniAppHtml.includes('chess-chat-unread-dot') && miniAppHtml.includes('function updateChessChatUnread') && miniAppHtml.includes('function markChessChatRead'), 'incoming opponent messages should mark chat unread until opened');
assert(miniAppHtml.includes('ضد بوت</strong>') && miniAppHtml.includes('ضد صديق</strong>') && miniAppHtml.includes('لاعب عشوائي</strong>') && miniAppHtml.includes('overflow-x:auto;overscroll-behavior-inline:contain'), 'chess options should remain ordered in a horizontal scroll strip');
assert(miniAppHtml.includes('id=\"chessPieceSetting\"') && miniAppHtml.includes('إعدادات المظهر') && miniAppHtml.includes('id=\"profileCountryFlag\"') && miniAppHtml.includes('countryFlag(player.countryCode'), 'chess appearance options and player country flags should be available');
const countryCodeListIndex = miniAppHtml.indexOf('var CHESS_COUNTRY_CODES=');
const initialCountryRenderIndex = miniAppHtml.indexOf("$('profileCountryFlag').innerHTML=countryFlag(chessCountryCode())");
assert(countryCodeListIndex >= 0 && countryCodeListIndex < initialCountryRenderIndex && miniAppHtml.includes('CHESS_COUNTRY_CODES.map(function(code)'), 'country codes must be initialized before profile rendering and selector population');
assert(miniAppHtml.includes('function countryFlag') && miniAppHtml.includes('/country-flags/') && sudokuMiniAppHtml.includes('/country-flags/'), 'account and game player flags should use fixed local artwork, not OS-dependent emoji glyphs');
const countryCodeData = /var CHESS_COUNTRY_CODES='([^']+)'/.exec(miniAppHtml)?.[1]?.split(' ') || [];
assert(countryCodeData.length === 250, 'the country selector should retain all supported countries');
for (const code of countryCodeData) assert(existsSync(new URL(`../public/country-flags/${code.toLowerCase()}.svg`, import.meta.url)), `missing flag art for ${code}`);
assert(miniAppHtml.includes('position:fixed!important;inset:0!important;width:auto!important;height:auto!important;min-height:0!important;max-width:none!important;margin:0!important;padding:0!important;overflow:hidden!important') && miniAppHtml.includes('position:absolute!important;top:calc(env(safe-area-inset-top) + var(--tg-header-reserve,72px))!important;right:0!important;bottom:0!important;left:0!important') && miniAppHtml.includes('calc(100vw - 24px)') && miniAppHtml.includes('var(--tg-header-reserve,0px) - 48px') && miniAppHtml.includes('grid-template-rows:24px minmax(0,1fr) 24px!important'), 'the chess page should start below Telegram chrome, span the viewport, and retain its responsive board sizing');
assert(!miniAppHtml.includes('data-screen-profile-button') && !miniAppHtml.includes("localStorage.getItem('cg-chess-screen-profile')") && miniAppHtml.includes('function scheduleChessLayout('), 'screen fitting should be automatic, without stale manual device preferences');
assert(miniAppHtml.includes('function calculateChessLayout(') && miniAppHtml.includes('window.visualViewport') && miniAppHtml.includes("window.addEventListener('resize',scheduleChessLayout)"), 'real viewport size and resize events should drive the board and seat dimensions');
assert(miniAppHtml.includes('grid-template-areas:"chat main"!important') && !miniAppHtml.includes('grid-template-areas:"chat board opponent"') && miniAppHtml.includes('grid-template-rows:var(--fit-seat) var(--fit-board) var(--fit-seat)!important'), 'wide chess should have chat left, board right and both player cards above/below it, never a third column');
assert(miniAppHtml.includes('calc(100vw - 16px)') && miniAppHtml.includes('orientation:portrait) and (max-width:600px)'), 'phone portrait chess should use nearly the full screen width while reserving space for complete player cards');
assert(miniAppHtml.includes('Math.max(portrait?132:72,contentTop-safeTop)') && !miniAppHtml.includes('id="backHome"') && miniAppHtml.includes('contentSafeAreaChanged'), 'native-only navigation should retain Telegram safe-area handling');
assert(miniAppHtml.includes('@media(max-width:1000px)') && miniAppHtml.includes('grid-template-areas:\"main\" \"side\"!important') && miniAppHtml.includes('.chess-board-panel .board-wrap{width:min(calc(100vw - 16px),var(--chess-board-limit),900px)!important') && miniAppHtml.includes('.chess-chat-form{display:flex!important;position:relative!important;grid-row:3!important') && miniAppHtml.includes('form.scrollIntoView({block:\'nearest\',behavior:\'smooth\'})') && !miniAppHtml.includes('input.focus({preventScroll:true})') && miniAppHtml.includes('left:auto!important;right:auto!important;transform:none!important'), 'phone and tablet chat should remain below the players, expose its composer, scroll into view, and avoid the legacy horizontal offset');
assert(miniAppHtml.includes('class="chess-arena"><div class="chess-game-layout"') && miniAppHtml.includes('height:var(--fit-main-height)!important') && miniAppHtml.includes('grid-template-columns:var(--fit-chat) var(--fit-board)!important'), 'wide chess chat should align with the full board-and-player column');
assert(!miniAppHtml.includes('#roomPage[data-game=\"chess\"]{display:block!important') && miniAppHtml.includes("roomData=null;$('roomContent').innerHTML='';"), 'leaving a match should hide and clear the room page so its board and player info cannot overlap the chess home screen');
assert(!miniAppHtml.includes('id="chessScreenSettingsShortcut"') && miniAppHtml.includes('id="chessAppearanceButton"') && miniAppHtml.includes('id="chessSettingsPanel"') && !miniAppHtml.includes('data-immersive-toggle'), 'appearance settings stay inside More while the fullscreen control is gone');
const morePageHtml = miniAppHtml.slice(miniAppHtml.indexOf('id="chessMorePage"'), miniAppHtml.indexOf('id="chessBottomNav"'));
assert(morePageHtml.includes('id="chessSettingsPanel" class="chess-settings-panel" hidden') && !morePageHtml.includes('immersive-mode-setting'), 'the chess settings panel starts hidden and carries no fullscreen block');
assert(['closeApp','setupBack','backHome','chessHubBack','chessSettingsBack','chessPuzzleClose','modeClose','errorBack'].every(id => !miniAppHtml.includes('id="'+id+'"')) && !miniAppHtml.includes('data-chess-back') && !miniAppHtml.includes('data-action="home"'), 'all in-page close and back buttons should be removed, including generated room/error controls');
assert(miniAppHtml.includes('tg.BackButton.onClick(handleTelegramBack)') && miniAppHtml.includes("window.location.assign('/interactive')"), 'native Back should return directly to the global games lobby');
assert(miniAppHtml.includes('function chessPieceGlyph(type,color)') && miniAppHtml.includes('\\uFE0E') && !miniAppHtml.includes('chess-piece-svg') && miniAppHtml.includes('-webkit-text-stroke:1.2px #edf4f7!important'), 'chess pieces should use classic text glyphs with clear outlines, not the rejected custom silhouette set');
assert(miniAppHtml.includes('tg.BackButton.hide()') && miniAppHtml.includes('tg.BackButton.show()') && miniAppHtml.includes('requestInitialFullscreen()') && !miniAppHtml.includes('toggleTelegramFullscreen'), 'native Close should be restored in the lobby, native Back used in games, and fullscreen entered once at startup with no dead toggle');
assert(miniAppHtml.includes('requestInitialFullscreen();') && sudokuMiniAppHtml.includes('requestInitialFullscreen()') && miniAppHtml.includes("tg.isVersionAtLeast('8.0')"), 'both Mini Apps should request fullscreen at startup on supported Telegram versions');
assert(miniAppHtml.includes('function showChessMatchIntro') && miniAppHtml.includes('matchIntroUntil') && miniAppHtml.includes('المباراة راح تبدي'), 'human chess matches should show their player introduction before the clock starts');
assert(miniAppHtml.includes('id=\"chessHistoryMore\"') && miniAppHtml.includes('ضد بوت</button>') && miniAppHtml.includes('ضد لاعبين</button>') && miniAppHtml.includes('items.slice(0,5)'), 'chess history should split opponents and paginate each category after five matches');
assert(miniAppHtml.includes('data-pieces="bold"') && miniAppHtml.includes('data-pieces="outline"') && miniAppHtml.includes('data-pieces="modern"') && miniAppHtml.includes('data-pieces="royal"'), 'selected chess piece styles should apply to all pieces on the board');
assert(!sudokuMiniAppHtml.includes('data-global-country-flag>🇮🇶</span></div></header>') && sudokuMiniAppHtml.includes('id=\"battlePlayerFlag\"'), 'country flags should sit with player identities, not beside Sudoku branding');
assert(miniAppHtml.includes("showSudokuFriendRoomStarting();createRoom('sudoku',{mode:'friend'})") && miniAppHtml.includes('function openRoom(data,push){closeMode();'), 'Sudoku friend entry should show its invitation wait screen directly without flashing back to the library');
assert(miniAppHtml.includes('sudokuFriendInviteUrl') && miniAppHtml.includes('loadSudokuFriendInviteLink(r.id)') && miniAppHtml.includes('data-action="copy-invite"') && miniAppHtml.includes('function copySudokuFriendInvite()'), 'Sudoku friend waiting screen should show a shareable room link and copy control');
assert(miniAppHtml.includes("$('modeOverlay').dataset.locked='true'") && miniAppHtml.includes('new MutationObserver(syncTelegramNavigation)') && !miniAppHtml.includes("$('modeClose')"), 'locked overlays should use the same native back control, not an internal close button');
assert(miniAppHtml.includes('availableHeight-2*seat-2*gap') && miniAppHtml.includes('availableWidth-(wide?chat+gap:0)'), 'board fitting must account for both player rows, chat width and gaps');
assert(miniAppHtml.includes('height:min(24dvh,242px)!important;min-height:188px!important;max-height:252px!important;'), 'phone chess chat should grow only slightly while remaining bounded');
assert(!miniAppHtml.includes('تشتغل داخل الصفحة') && !miniAppHtml.includes('اسم حساب تيليجرام'), 'redundant game library and Telegram profile copy should be removed');
assert(!sudokuMiniAppHtml.includes('countrySelect') && !sudokuMiniAppHtml.includes('COUNTRY_CODES') && !sudokuMiniAppHtml.includes('اسم حساب تيليجرام') && sudokuMiniAppHtml.includes('cg-player-country') && sudokuMiniAppHtml.includes('data-global-country-flag'), 'Sudoku should use the account-wide country and show its flag without a local selector');
assert(miniAppHtml.includes('<a class=\"game-card\" data-game=\"sudoku\" href=\"/sudoku\">'), 'the Sudoku card should retain a native route as a navigation fallback');
assert(miniAppHtml.includes("'https://t.me/'+username+'?start='+encodeURIComponent(payload)") && miniAppHtml.includes("'room_'+roomData.room.id+'_'+roomData.room.game") && miniAppHtml.includes("params.get('room')"), 'friend invitation should share a Telegram bot deep link that opens the requested room');
assert(!miniAppHtml.includes('اقلب الهاتف') && !sudokuMiniAppHtml.includes('اقلب الهاتف'), 'game screens must not recommend rotating the phone');
assert(miniAppHtml.includes('sudoku-race-arena') && miniAppHtml.includes('data-sudoku-tool=\"undo\"') && miniAppHtml.includes('sudoku-racer-avatar'), 'Sudoku race should use the mobile layout with opponent identity and working controls');
assert(miniAppHtml.includes('room-player-avatar') && miniAppHtml.includes('chess-seat-avatar'), 'multiplayer player cards should show Telegram profile photos');
assert(miniAppHtml.includes('function renderSudokuFriendWaiting') && miniAppHtml.includes('sudoku-share-friend'), 'Sudoku friend rooms should use a compact dedicated waiting screen');
assert(sudokuMiniAppHtml.includes('levelDialogTitle') && sudokuMiniAppHtml.includes('level-option-icon') && sudokuMiniAppHtml.includes('level-dialog-art'), 'solo Sudoku difficulty selection should use the redesigned level dialog');
assert(sudokuMiniAppHtml.includes("$('levelButton').hidden=Boolean(game.solution.length)") && sudokuMiniAppHtml.includes('if(game.solution.length)return;'), 'Sudoku level selector should disappear and be guarded while a game is active');
assert(miniAppHtml.includes('function showMatchQueue(game)') && miniAppHtml.includes('function showChessQueue()') && miniAppHtml.includes('function showSudokuQueue()'), 'both Chess and Sudoku should show an identity-rich queue card before requesting matchmaking');
assert(miniAppHtml.includes('showMatchSearchError(game,e.message,difficulty,clockMinutes)') && !miniAppHtml.includes("closeMode();toast(e.message);if(game==='sudoku'&&sudokuRoomReturn)location.href='/sudoku'"), 'matchmaking errors should keep the queue screen visible instead of navigating away');
assert(miniAppHtml.includes('matchConfirmTimer=setTimeout(function(){enterMatch(ticket)},2800)') && miniAppHtml.includes('matchOpponentDetails'), 'match found should show opponent identity and a short confirmation countdown before entering the room');
assert(miniAppHtml.includes('accountCountrySelect') && miniAppHtml.includes('cg-chess-country') && !miniAppHtml.includes('chessBotCountry') && !miniAppHtml.includes('chessFriendCountry'), 'country should be editable in account settings, not during chess match setup');
assert(miniAppHtml.includes('chess-seat-card') && miniAppHtml.includes('opponentCard') && miniAppHtml.includes('self-seat-row') && miniAppHtml.includes('data-chess-clock'), 'chess seats should show opponent above and player below with live clocks');
assert(miniAppHtml.includes('background:#b9d8ed') && miniAppHtml.includes('background:#376b95') && miniAppHtml.includes('overflow-x:clip'), 'chess match should use the blue board palette and avoid horizontal spill');
assert(miniAppHtml.includes('.chess-puzzle-board,.lesson-practice-board{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(8,minmax(0,1fr))!important') && miniAppHtml.includes('body.chess-match-open .ambient-backdrop'), 'training boards must use fixed 8x8 tracks and active matches need their own background');
assert(!miniAppHtml.includes('__CHESS_LESSONS_URI__') && !miniAppHtml.includes('__CHESS_PUZZLES_URI__'), 'chess data injection markers must be resolved');
assert(CHESS_LESSONS.length >= 9 && CHESS_PUZZLES.length >= 10, 'interactive lesson and puzzle catalogues should not regress');
for (const item of [...CHESS_LESSONS.map(lesson => ({ id: lesson.id, ...lesson.exercise })), ...CHESS_PUZZLES]) {
  const exerciseGame = new Chess(item.fen);
  assert(exerciseGame.move({ from: item.from, to: item.to, promotion: item.promotion || 'q' }), `${item.id} has an illegal learning/puzzle move`);
}
for (const html of [miniAppHtml, sudokuMiniAppHtml]) for (const [, script] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Function(script);
let stockfishAssetRequested = '';
const stockfishAssetResponse = await cloudflareWorker.fetch(new Request('https://game.test/stockfish/stockfish-19-lite-single.js'), {
  ASSETS: { fetch: async (request: Request) => { stockfishAssetRequested = new URL(request.url).pathname; return new Response('engine', { headers: { 'Content-Type': 'text/javascript' } }); } },
} as any, {} as any);
assert(stockfishAssetRequested === '/stockfish/stockfish-19-lite-single.js' && stockfishAssetResponse.status === 200, 'Worker should route Stockfish assets through ASSETS');
assert(stockfishAssetResponse.headers.get('Cache-Control')?.includes('immutable') && stockfishAssetResponse.headers.get('X-Content-Type-Options') === 'nosniff', 'Stockfish asset response headers are incorrect');

async function telegramInitData(userId: string, botToken: string): Promise<string> {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: userId, first_name: 'Tester' }) });
  const checkString = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const algorithm = { name: 'HMAC', hash: 'SHA-256' };
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), algorithm, false, ['sign']);
  const secret = await crypto.subtle.sign('HMAC', baseKey, encoder.encode(botToken));
  const dataKey = await crypto.subtle.importKey('raw', secret, algorithm, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', dataKey, encoder.encode(checkString)));
  params.set('hash', Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''));
  return params.toString();
}
const testBotToken = 'test-bot-token';
const ownerInitData = await telegramInitData('8885518661', testBotToken);
let forwardedBody: any;
const proxyStub = { fetch: async (_input: RequestInfo, init?: RequestInit) => { forwardedBody = JSON.parse(String(init?.body || '{}')); return Response.json({ ok: true }); } };
const proxyEnv = { BOT_STATE: { idFromName: () => 'main', get: () => proxyStub }, TELEGRAM_BOT_TOKEN: testBotToken } as any;
await cloudflareWorker.fetch(new Request('https://game.test/api/interactive/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'chess', initData: ownerInitData, isBotCreator: false }) }), proxyEnv, {} as any);
assert(forwardedBody.isBotCreator === true && !('initData' in forwardedBody), 'Worker should mark the verified creator and strip initData before forwarding');
const impostorInitData = await telegramInitData('123456789', testBotToken);
await cloudflareWorker.fetch(new Request('https://game.test/api/interactive/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game: 'chess', initData: impostorInitData, isBotCreator: true }) }), proxyEnv, {} as any);
assert(forwardedBody.isBotCreator === false && !('initData' in forwardedBody), 'client must not be able to forge the creator badge');

const tacticalFen = '4r2k/8/8/8/4Q3/8/8/K7 b - - 0 1';
for (const trainer of CHESS_TRAINERS) {
  const move = chooseChessBotMove(tacticalFen, trainer.elo, trainer.style, () => 0.5);
  assert(move, `${trainer.id} did not return a move`);
  assert(new Chess(tacticalFen).moves().includes(move.san), `${trainer.id} returned an illegal move`);
  if (trainer.elo >= 800) assert(move.san === 'Rxe4', `${trainer.id} missed the hanging queen with ${move.san}`);
}

const roomStorage = new MemoryRoomStorage();
const rooms = new InteractiveGameRooms(roomStorage);
async function post(path: string, body: unknown): Promise<any> {
  const response = await rooms.handle(new Request(`https://test.local${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  const result = await response.json();
  assert(response.ok, `request ${path} failed: ${JSON.stringify(result)}`);
  return result;
}

for (const scenario of [
  { trainerId: 'salem', botElo: 200 },
  { trainerId: 'grandmaster', botElo: 2800 },
]) {
  const created = await post('/api/interactive/rooms', {
    game: 'chess', mode: 'bot', name: 'اختبار', elo: 200,
    trainerId: scenario.trainerId, botElo: scenario.botElo, clockMinutes: 5, countryCode: 'US',
  });
  assert(created.room.players[0].elo === 200, 'player should start at 200 ELO');
  assert(created.room.players[0].countryCode === 'US', 'chess room should retain the selected player country');
  assert(created.room.players[1].elo === scenario.botElo, 'selected trainer ELO was not applied');
  const moved = await post(`/api/interactive/rooms/${created.room.id}`, {
    action: 'move', token: created.token, from: 'e2', to: 'e4',
  });
  assert(moved.state.turn === 'b' && moved.state.lastMove === 'e4', 'human move should hand the turn to the bot');
  const botReply = await post(`/api/interactive/rooms/${created.room.id}`, {
    action: 'bot-move', token: created.token, from: 'e7', to: 'e5',
  });
  assert(botReply.state.turn === 'w' && botReply.state.lastMove === 'e5', 'server did not accept the legal engine reply');
  const ended = await post(`/api/interactive/rooms/${created.room.id}`, { action: 'resign', token: created.token });
  assert(ended.room.players[0].elo === 200 && !ended.state.eloUpdated, 'a game against a bot must not change ELO');
}

const unoCountryRoom = await post('/api/interactive/rooms', { game: 'uno', mode: 'friend', name: 'لاعب أونو', countryCode: 'CA' });
assert(unoCountryRoom.room.players[0].countryCode === 'CA', 'account-wide country should be stored for games beyond Chess and Sudoku');
const humanRoom = await post('/api/interactive/rooms', { game: 'chess', mode: 'friend', name: 'لاعب أول', elo: 200, isBotCreator: true, clockMinutes: 5, countryCode: 'GB' });
assert(humanRoom.room.players[0].isBotCreator === true, 'creator badge metadata should be retained for public room rendering');
const humanOpponent = await post(`/api/interactive/rooms/${humanRoom.room.id}`, { action: 'join', name: 'لاعب ثانٍ', elo: 200, countryCode: 'AE' });
assert(humanOpponent.room.status === 'playing' && humanOpponent.room.players.length === 2, 'human match should start after the second player joins');
assert(humanOpponent.room.players[1].isBotCreator !== true, 'creator badge must not be copied to other players');
assert(humanOpponent.room.players[0].countryCode === 'GB' && humanOpponent.room.players[1].countryCode === 'AE', 'both chess players should retain their own flags');
assert(humanOpponent.state.mode === 'friend' && humanOpponent.state.matchIntroUntil > Date.now() && humanOpponent.state.clockRunning === false, 'a human match should show the intro before starting its clock');
const earlyMoveResponse = await rooms.handle(new Request(`https://game.test/api/interactive/rooms/${humanRoom.room.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'move', token: humanRoom.token, from: 'e2', to: 'e4' }) }));
assert(earlyMoveResponse.status === 400, 'players must not make moves before the match intro ends');
await new Promise(resolve => setTimeout(resolve, Math.max(0, humanOpponent.state.matchIntroUntil - Date.now() + 30)));
const humanResult = await post(`/api/interactive/rooms/${humanRoom.room.id}`, { action: 'resign', token: humanRoom.token });
assert(humanResult.room.players[0].elo === 188 && humanResult.room.players[1].elo === 212, 'human-versus-human results should update both ratings');
const leaveRoom = await post('/api/interactive/rooms', { game: 'chess', mode: 'friend', name: 'المنسحب', elo: 200, clockMinutes: 5 });
const leaveOpponent = await post(`/api/interactive/rooms/${leaveRoom.room.id}`, { action: 'join', name: 'الفائز', elo: 200 });
const leftGame = await post(`/api/interactive/rooms/${leaveRoom.room.id}`, { action: 'leave', token: leaveRoom.token });
assert(leftGame.room.status === 'finished' && leftGame.state.winnerSeat === 1 && leftGame.room.players.length === 2, 'leaving a human chess match should award a forfeit win and retain both seats');
const disconnectRoom = await post('/api/interactive/rooms', { game: 'chess', mode: 'friend', name: 'انقطاع', elo: 200, clockMinutes: 5 });
const disconnectOpponent = await post(`/api/interactive/rooms/${disconnectRoom.room.id}`, { action: 'join', name: 'متصل', elo: 200 });
const staleRoom = await roomStorage.get<any>(`interactive-room:${disconnectRoom.room.id}`);
staleRoom.players[1].lastSeenAt = Date.now() - 31_000;
await roomStorage.put(`interactive-room:${disconnectRoom.room.id}`, staleRoom);
const disconnectResponse = await rooms.handle(new Request(`https://game.test/api/interactive/rooms/${disconnectRoom.room.id}`, { headers: { Authorization: `Bearer ${disconnectRoom.token}` } }));
const disconnectResult = await disconnectResponse.json() as any;
assert(disconnectResult.room.status === 'finished' && disconnectResult.state.winnerSeat === 0 && disconnectResult.room.players.length === 2, 'a chess player who stops heartbeating should forfeit after the disconnect timeout');

const sudokuQueueOne = await post('/api/interactive/matchmaking', { game: 'sudoku', name: 'منشئ البوت', countryCode: 'IQ', difficulty: 'easy', isBotCreator: true });
assert(sudokuQueueOne.ticket.status === 'waiting', 'first Sudoku player should wait for a real opponent');
const sudokuQueueTwo = await post('/api/interactive/matchmaking', { game: 'sudoku', name: 'لاعب ثاني', countryCode: 'US', difficulty: 'hard' });
assert(sudokuQueueTwo.ticket.status === 'matched' && sudokuQueueTwo.ticket.opponentCountryCode === 'IQ' && sudokuQueueTwo.ticket.opponentIsBotCreator, 'Sudoku matchmaking should pair different puzzle levels and return the opponent flag and badge');
const sudokuQueueOneResponse = await rooms.handle(new Request(`https://game.test/api/interactive/matchmaking/${sudokuQueueOne.ticket.id}`, { headers: { Authorization: `Bearer ${sudokuQueueOne.secret}` } }));
const sudokuQueueOneStatus = await sudokuQueueOneResponse.json() as any;
assert(sudokuQueueOneStatus.ticket.status === 'matched' && sudokuQueueOneStatus.ticket.opponentCountryCode === 'US' && !sudokuQueueOneStatus.ticket.opponentIsBotCreator, 'waiting player should receive the matched opponent country and creator metadata');
const sudokuMatchRoomResponse = await rooms.handle(new Request(`https://game.test/api/interactive/rooms/${sudokuQueueOneStatus.ticket.roomId}`, { headers: { Authorization: `Bearer ${sudokuQueueOneStatus.ticket.roomToken}` } }));
const sudokuMatchRoom = await sudokuMatchRoomResponse.json() as any;
assert(sudokuMatchRoom.state.mode === 'random' && sudokuMatchRoom.state.difficulty === 'easy', "random Sudoku match should start without carrying either player's chosen difficulty");
assert(sudokuMatchRoom.room.players[0].countryCode === 'IQ' && sudokuMatchRoom.room.players[1].countryCode === 'US', 'Sudoku match players should retain their selected country flags');
const sudokuFriendRoom = await post('/api/interactive/rooms', { game: 'sudoku', mode: 'friend', name: 'صاحب الغرفة', countryCode: 'IQ' });
const sudokuFriendJoin = await post(`/api/interactive/rooms/${sudokuFriendRoom.room.id}`, { action: 'join', name: 'الصديق', photoUrl: 'https://t.me/i/userpic/320/friend.jpg', countryCode: 'US' });
assert(sudokuFriendJoin.room.status === 'playing' && sudokuFriendJoin.state.mode === 'friend' && sudokuFriendJoin.room.players.length === 2, 'a friend opening the shared Sudoku room should join the correct game');
assert(sudokuFriendJoin.room.players[1].photoUrl === 'https://t.me/i/userpic/320/friend.jpg', 'the opponent Telegram profile photo should be retained in the room');
const editableCell = sudokuFriendJoin.state.puzzle.findIndex((value: number) => value === 0);
let sudokuCorrectMove: any;
for (let value = 1; value <= 9; value++) {
  const attempt = await post(`/api/interactive/rooms/${sudokuFriendRoom.room.id}`, { action: 'place', token: sudokuFriendJoin.token, index: editableCell, value });
  if (attempt.state.values[editableCell] === value) { sudokuCorrectMove = attempt; break; }
}
assert(sudokuCorrectMove?.state.canUndo, 'a correct Sudoku entry should enable undo');
const sudokuUndo = await post(`/api/interactive/rooms/${sudokuFriendRoom.room.id}`, { action: 'undo', token: sudokuFriendJoin.token });
assert(sudokuUndo.state.values[editableCell] === 0 && !sudokuUndo.state.canUndo, 'Sudoku undo should restore the previous empty cell');

const fallbackRoom = await post('/api/interactive/rooms', { game: 'chess', mode: 'bot', name: 'اختبار الاحتياط', trainerId: 'salem', botElo: 200, clockMinutes: 5 });
const fallbackHumanMove = await post(`/api/interactive/rooms/${fallbackRoom.room.id}`, { action: 'move', token: fallbackRoom.token, from: 'e2', to: 'e4' });
const fallbackGame = new Chess(fallbackHumanMove.state.fen);
const fallbackBotMove = await post(`/api/interactive/rooms/${fallbackRoom.room.id}`, { action: 'bot-fallback', token: fallbackRoom.token });
assert(fallbackBotMove.state.turn === 'w' && fallbackGame.moves({ verbose: true }).some(move => move.from === fallbackBotMove.state.lastMoveSquares?.[0] && move.to === fallbackBotMove.state.lastMoveSquares?.[1]), 'fallback bot should still produce a legal response');

console.log(`Chess checks passed: ${CHESS_TRAINERS.length} trainers, Stockfish ASSETS route, ${CHESS_LESSONS.length} legal lesson drills, ${CHESS_PUZZLES.length} puzzles, tactical move, legal replies, human-only ELO updates.`);
