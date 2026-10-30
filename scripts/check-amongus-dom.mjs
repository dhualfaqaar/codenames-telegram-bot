// Drives the real Among Us page in jsdom against a running dev server
// (GAMES_TEST_URL, default http://localhost:3000). No browser, no pixels:
// it covers the lobby, the join-by-code path, the start handshake and the
// control surface that appears once the match is running.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const html = await (await fetch(`${base}/amongus`)).text();
const errors = [];
const windows = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeClient(name) {
  const dom = new JSDOM(html, {
    url: `${base}/amongus`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = (input, init) => {
        const url = new URL(String(input), base);
        return fetch(url, init);
      };
      window.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy(
          {},
          {
            get: (_target, prop) => {
              if (prop === 'canvas') return { width: 360, height: 640 };
              if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
                return () => ({ addColorStop() {} });
              }
              if (prop === 'measureText') return () => ({ width: 10 });
              return () => {};
            },
            set: () => true
          }
        );
      window.Telegram = {
        WebApp: {
          initData: 'mock-init-data',
          initDataUnsafe: { user: { id: name.length + 20, first_name: name } },
          ready() {},
          expand() {},
          setHeaderColor() {},
          setBackgroundColor() {},
          onEvent() {},
          isVersionAtLeast: () => true
        }
      };
      window.addEventListener('error', event => errors.push(String((event.error && event.error.stack) || event.message)));
    }
  });
  windows.push(dom);
  return dom.window;
}

async function waitFor(check, label, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (check()) return true;
    } catch {
      // keep waiting
    }
    await sleep(120);
  }
  throw new Error(`انتهى الوقت بانتظار: ${label}`);
}

const host = makeClient('المضيف');

// The title screen must be the original main menu, not a plain form.
assert.ok(host.document.getElementById('auMenu').classList.contains('on'), 'شاشة البداية هي قائمة اللعبة');
for (const id of ['auPlayBtn', 'auInventoryBtn', 'auShopBtn', 'auAccountBtn', 'auSettingsBtn', 'auFriendsBtn']) {
  assert.ok(host.document.getElementById(id), 'زر القائمة موجود: ' + id);
}
assert.ok(!host.document.body.textContent.includes('NEWS'), 'بدون NEWS');
assert.ok(!host.document.body.textContent.includes('CREDITS'), 'بدون CREDITS');
assert.ok(host.document.getElementById('auSpace'), 'مربع الفضاء موجود');

// PLAY opens the room dialog, INVENTORY opens the colour grid with ten colours.
host.document.getElementById('auPlayBtn').click();
assert.ok(host.document.getElementById('auPlayDialog').classList.contains('on'), 'PLAY يفتح نافذة اللعب');
host.document.getElementById('auPlayClose').click();
host.document.getElementById('auInventoryBtn').click();
assert.ok(host.document.getElementById('auInvDialog').classList.contains('on'), 'INVENTORY يفتح الخزانة');
const colorButtons = host.document.querySelectorAll('#auColorGrid [data-color]');
assert.equal(colorButtons.length, 10, 'الخزانة فيها عشرة ألوان');
colorButtons[1].click();
host.document.getElementById('auInvClose').click();
host.document.getElementById('auShopBtn').click();
assert.ok(host.document.getElementById('auShopDialog').classList.contains('on'), 'SHOP يفتح المتجر');
assert.equal(host.document.querySelectorAll('#auShopGrid [data-color]').length, 2, 'المتجر فيه لونان نادران');
host.document.getElementById('auShopClose').click();

host.document.getElementById('auPlayBtn').click();
host.document.getElementById('auName').value = 'المضيف';
host.document.getElementById('auCreate').click();
await waitFor(() => host.document.getElementById('auLobby').classList.contains('on'), 'فتح غرفة الانتظار');
const code = host.document.getElementById('auCodeLabel').textContent.trim();
assert.match(code, /^[A-Z0-9]{6}$/, 'كود الغرفة يظهر بالمضيف');
assert.equal(host.document.getElementById('auCount').textContent, '1');

// Five guests join with the code, which is the real invite path.
const guests = [];
for (let i = 0; i < 5; i += 1) {
  const guest = makeClient('لاعب' + i);
  guest.document.getElementById('auName').value = 'لاعب' + i;
  guest.document.getElementById('auCode').value = code;
  guest.document.getElementById('auJoin').click();
  guests.push(guest);
  await sleep(180);
}
await waitFor(() => host.document.getElementById('auCount').textContent === '6', 'انضمام ستة لاعبين');
const names = host.document.querySelectorAll('#auNames .who');
assert.equal(names.length, 6, 'قائمة اللاعبين تعرض الستة');
assert.ok(host.document.getElementById('auStart').disabled === false, 'زر البداية يتفعّل بعد 6 لاعبين');

// Guests cannot start the match; only the host can.
assert.equal(guests[0].document.getElementById('auStart').disabled, true, 'غير المضيف ما يبدأ');

host.document.getElementById('auStart').click();
await waitFor(() => host.document.getElementById('auStage').classList.contains('on'), 'بداية المباراة');
await waitFor(() => host.document.getElementById('auRoleText').textContent !== '—', 'ظهور الدور');
const role = host.document.getElementById('auRoleText').textContent.trim();
assert.ok(role === 'طاقم' || role === 'مزوّر', 'الدور يظهر بالهيدر: ' + role);

// The control surface must match the role: only impostors see the kill button.
const killHidden = host.document.getElementById('auKill').hidden;
assert.equal(killHidden, role !== 'مزوّر', 'زر القتل للمزوّر فقط');
assert.ok(host.document.getElementById('auPad'), 'الجويستيك موجود');
assert.ok(host.document.getElementById('auSabotage').hidden === (role !== 'مزوّر'), 'التخريب للمزوّر فقط');
assert.match(host.document.getElementById('auTaskChip').textContent, /^\d+\/\d+$/, 'عدّاد المهام يشتغل');

// Pressing use away from any of your own task terminals explains itself
// instead of failing silently (impostors have no tasks at all).
host.document.getElementById('auUse').click();
await waitFor(() => host.document.getElementById('auToast').classList.contains('on'), 'رسالة تنبيه عند الاستعمال');
assert.match(host.document.getElementById('auToast').textContent, /محطة/);

// Everyone else is in the same match: the stage is shared, roles differ.
await waitFor(() => guests[0].document.getElementById('auStage').classList.contains('on'), 'دخول الضيوف للمباراة');
const guestRole = guests[0].document.getElementById('auRoleText').textContent.trim();
assert.ok(guestRole === 'طاقم' || guestRole === 'مزوّر', 'الضيف يشوف دوره');

for (const dom of windows) {
  try { (dom.close || (dom.window && dom.window.close)).call(dom.window || dom); } catch {}
}
assert.deepEqual(errors, [], 'ماكو أخطاء JavaScript: ' + errors.join(' | '));
console.log('Among Us DOM flow passed: room code invite, six-player lobby, host-only start, role HUD, impostor-only controls, task counter and the joystick surface.');
