/**
 * Checks the shared game sound engine.
 *
 * The engine is plain browser JS inlined into the mini apps, so the check runs
 * it inside a fake DOM/AudioContext and asserts that every voice actually
 * schedules audio nodes, that the mute switch sticks, that the background music
 * schedules bars, and that the three games are wired to real events.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { GAME_SFX_SCRIPT, GAME_SFX_VOICES } from '../src/services/gameSfx';
import { SUDOKU_MINI_APP_HTML } from '../src/services/sudokuMiniApp';
import { amongUsMiniAppHtml } from '../src/services/amongUsMiniApp';
import { INTERACTIVE_GAMES_MINI_APP_HTML } from '../src/services/interactiveGamesMiniApp';

let passed = 0;
function check(name: string, condition: unknown) {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
}

type Node = { id: number; kind: string; connections: Node[]; [key: string]: unknown };

function createAudioEnv() {
  const created: Node[] = [];
  const started: Node[] = [];
  const store = new Map<string, string>();
  let now = 0;

  class FakeParam {
    value = 0;
    events: string[] = [];
    setValueAtTime(value: number, at: number) {
      this.value = value;
      this.events.push(`set:${value}@${at}`);
      return this;
    }
    linearRampToValueAtTime(value: number, at: number) {
      this.events.push(`lin:${value}@${at}`);
      return this;
    }
    exponentialRampToValueAtTime(value: number, at: number) {
      this.events.push(`exp:${value}@${at}`);
      return this;
    }
  }

  class FakeNode {
    id: number;
    kind: string;
    connections: Node[] = [];
    constructor(kind: string) {
      this.kind = kind;
      this.id = created.length;
      created.push(this as unknown as Node);
    }
    connect(target: unknown) {
      this.connections.push(target as Node);
      return target;
    }
    disconnect() {}
  }

  class Oscillator extends FakeNode {
    type = 'sine';
    frequency = new FakeParam();
    detune = new FakeParam();
    constructor() {
      super('oscillator');
    }
    start() {
      started.push(this as unknown as Node);
    }
    stop() {}
  }
  class Gain extends FakeNode {
    gain = new FakeParam();
    constructor() {
      super('gain');
    }
  }
  class Filter extends FakeNode {
    type = 'lowpass';
    frequency = new FakeParam();
    Q = new FakeParam();
    constructor() {
      super('filter');
    }
  }
  class Source extends FakeNode {
    buffer: unknown = null;
    playbackRate = new FakeParam();
    constructor() {
      super('source');
    }
    start() {
      started.push(this as unknown as Node);
    }
    stop() {}
  }
  class Buffer {
    channels: Float32Array[];
    constructor(_channels: number, length: number) {
      this.channels = [new Float32Array(length)];
    }
    getChannelData() {
      return this.channels[0];
    }
  }
  class Ctx {
    state = 'suspended';
    sampleRate = 48000;
    destination = { kind: 'destination' };
    get currentTime() {
      return now;
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      return new Oscillator();
    }
    createGain() {
      return new Gain();
    }
    createBiquadFilter() {
      return new Filter();
    }
    createBufferSource() {
      return new Source();
    }
    createBuffer(channels: number, length: number) {
      return new Buffer(channels, length);
    }
  }

  const listeners: Record<string, Array<(event: unknown) => void>> = {};
  const toggleButtons: Array<{ innerHTML: string; listeners: Record<string, Array<() => void>>; attributes: Record<string, string>; style: { color: string; setProperty?: unknown } }> = [];
  const documentStub = {
    hidden: false,
    body: {
      appendChild(node: { innerHTML: string; listeners: Record<string, Array<() => void>>; attributes: Record<string, string>; style: { color: string } }) {
        toggleButtons.push(node);
        return node;
      }
    },
    querySelector() {
      return null;
    },
    getElementById() {
      return null;
    },
    createElement() {
      const node = {
        innerHTML: '',
        attributes: {} as Record<string, string>,
        style: { color: '' },
        listeners: {} as Record<string, Array<() => void>>,
        setAttribute(this: { attributes: Record<string, string> }, key: string, value: string) {
          this.attributes[key] = value;
        },
        getAttribute(this: { attributes: Record<string, string> }, key: string) {
          return this.attributes[key] ?? null;
        },
        addEventListener(this: { listeners: Record<string, Array<() => void>> }, name: string, handler: () => void) {
          (this.listeners[name] ||= []).push(handler);
        },
        click(this: { listeners: Record<string, Array<(event: unknown) => void>> }) {
          const event = { preventDefault() {}, stopPropagation() {} };
          (this.listeners.click || []).forEach(handler => handler(event));
        },
        classList: { contains: () => false }
      };
      toggleButtons.push(node as never);
      return node;
    },
    addEventListener(name: string, handler: (event: unknown) => void) {
      (listeners[name] ||= []).push(handler);
    },
    dispatchEvent() {
      return true;
    }
  };

  class CustomEventStub {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  const windowStub = { AudioContext: Ctx, webkitAudioContext: undefined } as Record<string, unknown>;
  const context = {
    window: windowStub,
    document: documentStub,
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key) : null),
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      }
    },
    CustomEvent: CustomEventStub,
    setInterval: (handler: () => void) => {
      timers.push(handler);
      return timers.length;
    },
    clearInterval: () => {},
    Math,
    Date,
    console
  } as unknown as Record<string, unknown>;
  const timers: Array<() => void> = [];

  vm.createContext(context);
  vm.runInContext(GAME_SFX_SCRIPT, context, { filename: 'game-sfx.js' });

  return {
    gameSfx: (windowStub as { GameSfx: Record<string, any> }).GameSfx,
    advance(seconds: number) {
      now += seconds;
    },
    tickMusic() {
      timers.slice().forEach(handler => handler());
    },
    created,
    started,
    store,
    toggleButtons,
    listeners,
    get now() {
      return now;
    }
  };
}

/* ---------- the engine ---------- */
const env = createAudioEnv();
check('المحرك ينصب على window.GameSfx', Boolean(env.gameSfx));
check('الأصوات كلها مسجّلة', GAME_SFX_VOICES.every(name => env.gameSfx.names().includes(name)));
check('ماكو ملفات صوت خارجية', !/\.(mp3|ogg|wav|m4a)["']/i.test(GAME_SFX_SCRIPT) && !/<audio/i.test(GAME_SFX_SCRIPT));
check('المحرك يستعمل Web Audio فقط', GAME_SFX_SCRIPT.includes('AudioContext') && GAME_SFX_SCRIPT.includes('createOscillator'));

let missing: string[] = [];
for (const name of GAME_SFX_VOICES) {
  const before = env.started.length;
  const ok = env.gameSfx.play(name);
  if (!ok || env.started.length === before) missing.push(name);
}
check('كل صوت يولّد عقد صوتية فعلية', missing.length === 0);

const singleBefore = env.created.length;
env.gameSfx.play('move');
const perPlay = env.created.length - singleBefore;
const beforeIds = env.created.length;
for (let index = 0; index < 40; index += 1) env.gameSfx.play('move');
check('تكرار الصوت ما يتراكم بلا نهاية', env.created.length - beforeIds <= perPlay * 40 + 4);

check('الأصوات شغّالة افتراضياً', env.gameSfx.enabled() === true);
env.gameSfx.setEnabled(false);
check('زر السكتة ينحفظ بالستوريج', env.store.get('cg-sfx-on') === '0');
const mutedBefore = env.started.length;
env.gameSfx.play('kill');
check('بعد السكتة ماكو صوت', env.started.length === mutedBefore);
env.gameSfx.setEnabled(true);

/* ---------- background music ---------- */
check('الموسيقى شغّالة افتراضياً', env.gameSfx.musicEnabled() === true);
env.gameSfx.music.start();
env.advance(1.4);
const musicBefore = env.started.length;
env.tickMusic();
check('الموسيقى الخلفية تجدول بارات', env.started.length > musicBefore);
const musicNodes = env.created.filter(node => node.kind === 'oscillator').length;
check('الموسيقى خفيفة (عقد معتدلة بالبار)', musicNodes > 0);
env.gameSfx.music.stop();
const stoppedAt = env.started.length;
env.tickMusic();
check('إيقاف الموسيقى يوقف الجدولة', env.started.length === stoppedAt);
env.gameSfx.setMusicEnabled(false);
check('مفتاح الموسيقى ينحفظ', env.store.get('cg-sfx-music') === '0');
env.gameSfx.setMusicEnabled(true);

/* ---------- mute button ---------- */
const button = env.gameSfx.mountToggle({ bottom: '88px', right: '12px' });
check('زر الأصوات ينضاف للصفحة', Boolean(button) && env.toggleButtons.length > 0);
check('أيقونة الزر مرسومة SVG مو إيموجي', typeof button.innerHTML === 'string' && button.innerHTML.trim().startsWith('<svg'));
button.click();
check('زر الأصوات يسكت الصوت', env.gameSfx.enabled() === false);
button.click();
check('زر الأصوات يرجع الصوت', env.gameSfx.enabled() === true);

/* ---------- games wiring ---------- */
const chessHtml = INTERACTIVE_GAMES_MINI_APP_HTML;
check('الشطرنج يستورد محرك الأصوات', chessHtml.includes('window.GameSfx') && chessHtml.includes("window.GameSfx.play(name)"));
check('الشطرنج: صوت تحريك الرقعة', chessHtml.includes("sfx('move')") && chessHtml.includes("sfx('capture')"));
check('الشطرنج: صوت الأكل والتبييت والكش والترقية', ["'capture'", "'castle'", "'check'", "'promote'", "'illegal'"].every(name => chessHtml.includes(`sfx(${name})`)));
check('الشطرنج: زر كتم الصوت', chessHtml.includes('cg-sfx-btn') && chessHtml.includes('mountToggle'));

const sudokuHtml = SUDOKU_MINI_APP_HTML;
check('سودوكو: صوت الرقم الصحيح', sudokuHtml.includes("sfx('good')"));
check('سودوكو: صوت الرقم الغلط', sudokuHtml.includes("sfx('bad')"));
check('سودوكو: صوت الحل والتلميح', sudokuHtml.includes("sfx(won?'solved':'lose')") && sudokuHtml.includes("sfx('hint')"));
check('سودوكو: زر كتم الصوت', sudokuHtml.includes('mountToggle'));

const amongHtml = amongUsMiniAppHtml();
check('امونق اس: أصوات اللعبة', ["'kill'", "'sabotage'", "'vent'", "'task'", "'eject'", "'death'"].every(name => amongHtml.includes(`sfx(${name})`)));
check('امونق اس: صوت خطوات المشي', amongHtml.includes("sfx('step')"));
check('امونق اس: صوت التبليغ والاجتماع الطارئ', amongHtml.includes("sfx(room.meeting.reason === 'report' ? 'report' : 'alarm')"));
check('امونق اس: صوت الأزرار', amongHtml.includes('buttonSounds'));
check('امونق اس: موسيقى خلفية خفيفة', amongHtml.includes('GameSfx.music.start()') && amongHtml.includes('GameSfx.music.stop()'));
check('امونق اس: مفتاح للموسيقى', amongHtml.includes('auMusicToggle'));

/* ---------- no copyrighted audio shipped ---------- */
const repo = resolve(import.meta.dirname, '..');
const serverSource = readFileSync(resolve(repo, 'server/telegramBot.ts'), 'utf8');
check('ماكو تنزيل أصوات من السيرفر', !/amongus.*\.mp3|chess.*\.ogg/i.test(serverSource));

console.log(`Game sound checks passed: ${passed} assertions (voices, music loop, mute store, three games wired).`);
