// Drives the real mini apps in jsdom against a running dev server
// (GAMES_TEST_URL, default http://localhost:3000) and proves the sounds are
// wired to real events: a sudoku digit plays the right/wrong cue, the hint
// button plays its cue, the mute button flips the engine, and the Among Us
// page carries its HUD mute button plus the background-music start call.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  passed += 1;
};

/** A tiny AudioContext so the engine can schedule nodes inside jsdom. */
function audioStub() {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}
  });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {} });
  return class FakeAudioContext {
    state = 'running';
    sampleRate = 48000;
    currentTime = 0;
    destination = { connect() {} };
    createOscillator() {
      return Object.assign(node(), { frequency: param(), detune: param(), type: 'sine' });
    }
    createGain() {
      return Object.assign(node(), { gain: param() });
    }
    createBiquadFilter() {
      return Object.assign(node(), { frequency: param(), Q: param(), type: 'lowpass' });
    }
    createBufferSource() {
      return Object.assign(node(), { playbackRate: param() });
    }
    createBuffer(channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    resume() {
      return Promise.resolve();
    }
  };
}

async function loadPage(path) {
  const html = await (await fetch(`${base}${path}`)).text();
  const errors = [];
  const dom = new JSDOM(html, {
    url: `${base}${path}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.AudioContext = audioStub();
      window.fetch = input => fetch(new URL(String(input), base));
      window.HTMLCanvasElement.prototype.getContext = () => {
        const gradient = { addColorStop() {} };
        return new Proxy(
          {},
          {
            get: (_target, prop) => {
              if (prop === 'canvas') return { width: 360, height: 640 };
              if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradient;
              if (prop === 'measureText') return () => ({ width: 10 });
              return () => {};
            },
            set: () => true
          }
        );
      };
      window.Telegram = { WebApp: { ready() {}, expand() {}, initDataUnsafe: { user: { id: 7, first_name: 'لاعب' } }, HapticFeedback: { impactOccurred() {} } } };
      window.navigator.vibrate = () => true;
      window.addEventListener('error', event => errors.push(String(event.error || event.message)));
    }
  });
  await sleep(400);
  return { dom, window: dom.window, document: dom.window.document, errors };
}

/** Records every clip the page asks the engine to play. */
function record(window) {
  const played = [];
  const original = window.GameSfx.play;
  window.GameSfx.play = name => {
    played.push(name);
    return original(name);
  };
  return played;
}

/* ---------- sudoku ---------- */
{
  const page = await loadPage('/sudoku');
  const { window, document } = page;
  check('سودوكو: المحرك موجود بالصفحة', Boolean(window.GameSfx));
  check('سودوكو: زر الصوت مرسوم بالصفحة', Boolean(document.querySelector('.cg-sfx-btn')));
  check('سودوكو: زر الصوت SVG مو إيموجي', (document.querySelector('.cg-sfx-btn').innerHTML || '').includes('<svg'));

  const played = record(window);
  document.querySelector('[data-level="easy"]').click();
  await sleep(250);
  check('سودوكو: بدء لغز يطلع صوت', played.length > 0);

  const cells = Array.from(document.querySelectorAll('.cell'));
  check('سودوكو: لوحة فيها خلايا', cells.length === 81);
  const empty = cells.find(cell => !cell.classList.contains('given'));
  empty.click();
  await sleep(120);
  check('سودوكو: اختيار خلية يطلع صوت لمس', played.includes('tap'));

  played.length = 0;
  const numbers = Array.from(document.querySelectorAll('.num')).filter(button => !button.disabled);
  check('سودوكو: أرقام متاحة', numbers.length > 0);
  numbers[0].click();
  await sleep(250);
  check('سودوكو: إدخال رقم يطلع صوت صح أو غلط', played.includes('good') || played.includes('bad'));

  played.length = 0;
  document.getElementById('hintButton').click();
  await sleep(200);
  check('سودوكو: طلب التلميح يطلع صوته', played.includes('hint'));

  const before = window.GameSfx.enabled();
  document.querySelector('.cg-sfx-btn').click();
  await sleep(60);
  check('سودوكو: زر الصوت يبدّل الحالة', window.GameSfx.enabled() === !before);
  document.querySelector('.cg-sfx-btn').click();
  check('سودوكو: زر الصوت يرجع الحالة', window.GameSfx.enabled() === before);
  check('سودوكو: ماكو أخطاء JS', page.errors.length === 0);
  window.close();
}

/* ---------- among us ---------- */
{
  const page = await loadPage('/amongus');
  const { window, document } = page;
  check('امونق اس: المحرك موجود', Boolean(window.GameSfx));
  const hudButton = document.querySelector('#auHudTop .cg-sfx-btn');
  check('امونق اس: زر كتم الصوت داخل شريط اللعب', Boolean(hudButton));
  check('امونق اس: مفتاح موسيقى بالإعدادات', Boolean(document.getElementById('auMusicToggle')));
  const played = record(window);
  const codeCard = document.getElementById('auCodeCard');
  codeCard.click();
  await sleep(150);
  check('امونق اس: لمس بطاقة يطلع صوت', played.includes('click'));
  check('امونق اس: الموسيقى مطلوبة بعد اللمس', window.GameSfx.musicEnabled() === true);
  check('امونق اس: ماكو أخطاء JS', page.errors.length === 0);
  window.close();
}

/* ---------- chess ---------- */
{
  const page = await loadPage('/chess');
  const { window, document } = page;
  check('الشطرنج: المحرك موجود', Boolean(window.GameSfx));
  check('الشطرنج: زر الصوت مرسوم', Boolean(document.querySelector('.cg-sfx-btn')));
  check('الشطرنج: ماكو أخطاء JS', page.errors.length === 0);
  window.close();
}

console.log(`Game sound DOM flow passed: ${passed} assertions (sudoku digits, hint, mute button, among us HUD + music, chess mount).`);
