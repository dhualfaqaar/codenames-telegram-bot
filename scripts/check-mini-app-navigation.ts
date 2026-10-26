import assert from 'node:assert/strict';
import { Script, createContext, runInContext } from 'node:vm';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
import { SUDOKU_MINI_APP_HTML } from '../src/services/sudokuMiniApp';

// These are runtime tests of the shipped inline JavaScript with a mocked Telegram
// bridge, not a claim of visual or native-client verification.
const gamesHtml = interactiveGamesMiniAppHtml('chess');
const sudokuHtml = SUDOKU_MINI_APP_HTML;
for (const html of [gamesHtml, sudokuHtml]) {
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    new Script(match[1]); // TypeScript does not parse the embedded JS at build time.
  }
  assert.doesNotMatch(html, /<button\b[^>]*(?:data-chess-back|data-action="home"|id="(?:closeApp|setupBack|backHome|chessHubBack|chessSettingsBack|chessPuzzleClose|modeClose|errorBack|closeButton|settingsBackButton|cancelLevel)")/);
  assert.doesNotMatch(html, /\$\('(?:closeApp|setupBack|backHome|chessHubBack|chessSettingsBack|chessPuzzleClose|modeClose|errorBack|closeButton|settingsBackButton|cancelLevel)'\)/);
  assert.match(html, /requestInitialFullscreen\(\);?/);
}

function shippedFunctions(html: string, names: string[]) {
  return names.map(name => {
    const line = html.split('\n').find(line => line.trimStart().startsWith(`function ${name}(`));
    assert.ok(line, `Missing shipped function ${name}`);
    return line;
  }).join('\n');
}

const calls: string[] = [];
let overlay = false;
let accountHidden = true;
const tg = {
  isFullscreen: false,
  isVersionAtLeast: (_version: string) => true,
  requestFullscreen: () => calls.push('fullscreen'),
  exitFullscreen: () => calls.push('exit-fullscreen'),
  close: () => calls.push('close'),
  BackButton: { show: () => calls.push('back'), hide: () => calls.push('native-close') },
};
const context = createContext({
  tg,
  standaloneChess: false,
  roomId: '', setupGame: '', chessHomeActive: false, roomData: { room: {} }, polling: 7,
  $: (id: string) => ({ classList: { contains: (name: string) => id === 'modeOverlay' ? overlay && name === 'show' : accountHidden && name === 'hide' } }),
  abandonMatchForReplacement: () => calls.push('cancel-match'),
  closeMode: () => calls.push('close-overlay'),
  notifyChessForfeit: () => calls.push('forfeit'),
  clearInterval: () => calls.push('stop-polling'),
  window: { location: { assign: (url: string) => calls.push(url) } },
  syncTelegramFullscreen: () => calls.push('sync-fullscreen'),
});
runInContext(shippedFunctions(gamesHtml, ['telegramFullscreenSupported', 'isGamesLobby', 'syncTelegramNavigation', 'returnToGamesLobby', 'handleTelegramBack', 'requestInitialFullscreen']), context);
runInContext('syncTelegramNavigation();handleTelegramBack()', context);
assert.deepEqual(calls.splice(0), ['native-close', 'close']);

for (const state of [
  { standaloneChess: true }, // Chess home
  { chessHomeActive: true }, // Puzzles, More and settings
  { roomId: 'BOT-MATCH' }, // Includes games against bots
  { setupGame: 'uno' },
  { overlay: true }, // Bot picker or matchmaking above the library
  { accountHidden: false },
]) {
  Object.assign(context, { standaloneChess: false, roomId: '', setupGame: '', chessHomeActive: false }, state);
  overlay = state.overlay === true;
  accountHidden = state.accountHidden !== false;
  runInContext('syncTelegramNavigation();handleTelegramBack()', context);
  assert.deepEqual(calls.splice(0), ['back', 'cancel-match', 'close-overlay', 'forfeit', 'stop-polling', '/interactive']);
  assert.equal(context.roomData, null, 'do not send a duplicate forfeit on pagehide');
}

// Startup is automatic, but unsupported clients and an already-fullscreen app
// must not be asked again. A denied request must not break navigation.
runInContext('requestInitialFullscreen()', context);
assert.deepEqual(calls.splice(0), ['fullscreen']);
tg.isFullscreen = true;
runInContext('requestInitialFullscreen()', context);
assert.deepEqual(calls.splice(0), []);
tg.isFullscreen = false;
tg.isVersionAtLeast = () => false;
runInContext('requestInitialFullscreen()', context);
assert.deepEqual(calls.splice(0), []);
tg.isVersionAtLeast = () => true;
const requestFullscreen = tg.requestFullscreen;
tg.requestFullscreen = () => { throw new Error('Native client denied fullscreen'); };
runInContext('requestInitialFullscreen()', context);
assert.deepEqual(calls.splice(0), ['sync-fullscreen']);
tg.requestFullscreen = requestFullscreen;
context.tg = null;
runInContext('syncTelegramNavigation();requestInitialFullscreen()', context);
assert.deepEqual(calls.splice(0), []);

const sudokuContext = createContext({
  tg,
  save: () => calls.push('save'),
  window: { location: { assign: (url: string) => calls.push(url) } },
});
runInContext(shippedFunctions(sudokuHtml, ['returnToGamesLobby', 'requestInitialFullscreen']), sudokuContext);
runInContext('returnToGamesLobby();requestInitialFullscreen()', sudokuContext);
assert.deepEqual(calls.splice(0), ['save', '/interactive', 'fullscreen']);
tg.isVersionAtLeast = () => false;
runInContext('requestInitialFullscreen()', sudokuContext);
assert.deepEqual(calls.splice(0), []);
assert.match(sudokuHtml, /tg.BackButton.onClick\(returnToGamesLobby\)/);
console.log('Mini App navigation checks passed: native close in lobby, native back to lobby from all sections, no internal back/close controls, automatic fullscreen and unsupported-client fallback.');
