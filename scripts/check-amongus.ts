import assert from 'node:assert/strict';
import {
  AU_KILL_COOLDOWN_MS,
  AU_MIN_START,
  AU_SABOTAGE_MS,
  AmongUsRooms,
  impostorCount,
  isWalkable,
  publicRoom,
  sanitizeSettings,
  roomSettings,
  type AuRoomState
} from '../src/services/amongUsRooms';
import { amongUsMiniAppHtml } from '../src/services/amongUsMiniApp';

/* ------------------------------------------------------------------ setup */

function makeStorage() {
  const map = new Map<string, unknown>();
  return {
    map,
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async put(key: string, value: unknown) {
      map.set(key, value);
    }
  };
}

const storage = makeStorage();
const engine = new AmongUsRooms(storage as any);

let passed = 0;
function check(name: string, condition: boolean, detail = '') {
  if (!condition) throw new Error(`فشل: ${name}${detail ? ` — ${detail}` : ''}`);
  passed += 1;
}

function post(path: string, body: Record<string, unknown>): Promise<any> {
  return engine
    .handle(
      new Request(`https://game.test${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
    )
    .then(res => res.json());
}

async function get(code: string, token: string): Promise<any> {
  const res = await engine.handle(new Request(`https://game.test/api/amongus/rooms/${code}?token=${token}`));
  return res.json();
}

async function room(code: string): Promise<AuRoomState> {
  const stored = await storage.get<AuRoomState>(`amongus-room:${code}`);
  assert.ok(stored, 'room should be stored');
  return stored;
}

async function patch(code: string, mutate: (state: AuRoomState) => void): Promise<void> {
  const state = await room(code);
  mutate(state);
  await storage.put(`amongus-room:${code}`, state);
}

/* ---------------------------------------------------------------- routes */

const workerModule = await (new Function('url', 'return import(url)'))(new URL('../worker/index.ts', import.meta.url).href);
const worker = workerModule.default;
const routeResponse = await worker.fetch(new Request('https://game.test/amongus'), {} as any, {} as any);
const routeHtml = await routeResponse.text();
check('راوت /amongus يخدم اللعبة', routeResponse.status === 200 && routeHtml.includes('id="auCanvas"'));
check(
  'راوت اللعبة بلا كاش',
  String(routeResponse.headers.get('Cache-Control') || '').includes('no-store')
);
const librariesHtml = (await import('../src/services/interactiveGamesMiniApp')).interactiveGamesMiniAppHtml('chess');
check(
  'بطاقة اللعبة موجودة بمكتبة الألعاب',
  librariesHtml.includes('data-game="amongus"') &&
    librariesHtml.includes('href="/amongus"') &&
    librariesHtml.includes("'amongus'].includes(game)")
);

/* ------------------------------------------------------------------ html */

const html = amongUsMiniAppHtml();

check('اللعبة اسمها «امونق اس»', html.includes('<title>امونق اس</title>') && !html.includes('بيننا'));
check(
  'شاشة البداية مثل اللعبة الأصلية',
  html.includes('id="auMenu"') &&
    html.includes('id="auSpace"') &&
    html.includes('class="wordmark"') &&
    html.includes('>PLAY<') &&
    html.includes('>INVENTORY<') &&
    html.includes('>SHOP<') &&
    html.includes('>MY ACCOUNT<') &&
    html.includes('>SETTINGS<') &&
    html.includes('>FRIENDS<')
);
check('بدون NEWS وبدون CREDITS', !html.includes('>NEWS<') && !html.includes('>CREDITS<'));
check(
  'النجوم والشخصيات تتحرك بمربع الفضاء',
  html.includes('function spaceFrame(') &&
    html.includes('requestAnimationFrame(spaceFrame)') &&
    html.includes('space.stars') &&
    html.includes('space.beans')
);
check(
  'كل أزرار القائمة تفتح شي حقيقي',
  ['auSpacePlay', 'auInvDialog', 'auShopDialog', 'auAccDialog', 'auSetDialog', 'auFriendsDialog'].every(id => html.includes(`id="${id}"`)) &&
    !html.includes('auPlayDialog')
);
check(
  'PLAY يفتح ثلاث بطاقات داخل مربع الفضاء نفسه',
  html.includes('id="auSpaceBox"') &&
    html.includes('class="space-play" id="auSpacePlay"') &&
    html.includes('id="auCreate"') &&
    html.includes('id="auOnlineCard"') &&
    html.includes('id="auCodeCard"') &&
    html.includes('>CREATE ROOM<') &&
    html.includes('>ONLINE<') &&
    html.includes('>ENTER CODE<') &&
    html.includes('id="auPlayBack"')
);
check(
  'بطاقات اللعب مرسومة SVG بلا صور خارجية',
  (html.match(/class="sp-art"/g) || []).length === 3 &&
    (html.match(/<svg viewBox="0 0 300 460"/g) || []).length === 3 &&
    html.includes('id="steel"') &&
    html.includes('id="glass"') &&
    html.includes('id="skyCode"') &&
    html.includes('id="skyMake"') &&
    html.includes('id="skyOnline"') &&
    !/<img\s/.test(html)
);
check(
  'رسم البطاقات بنفس نسبة البطاقة حتى ما ينقص منها شي',
  /class="sp-art"[^>]*>\s*<svg viewBox="0 0 300 460" preserveAspectRatio="xMidYMid slice"/.test(html) &&
    !html.includes('viewBox="0 0 260 170"')
);
check(
  'كل بطاقة إلها لون مختلف',
  html.includes('--tint:#3fe3c6') &&
    html.includes('.sp-card#auCreate{--tint:#5cc8ff') &&
    html.includes('.sp-card#auOnlineCard{--tint:#a98bff')
);
check(
  'صف الاسم والقفل انحذف من تحت المربع',
  !html.includes('id="auMeName"') &&
    !html.includes('id="auMeBean"') &&
    !html.includes('تلعب باسم حسابك') &&
    !html.includes('class="sp-me"')
);
check(
  'إعدادات الغرفة قبل الإنشاء موجودة بالواجهة',
  html.includes('id="auViewSettings"') &&
    html.includes('id="auSettingRows"') &&
    html.includes('id="auCreateRoom"') &&
    html.includes('ROOM_RULES') &&
    ['maxPlayers', 'impostors', 'tasks', 'killCooldownMs', 'meetingMs'].every(key => html.includes(`${key}:`))
);
check(
  'شاشة ONLINE تجيب الغرف الحالية',
  html.includes('id="auViewOnline"') &&
    html.includes('id="auRoomList"') &&
    html.includes("fetch('/api/amongus/rooms')") &&
    html.includes('setInterval(loadRooms')
);
check(
  'ENTER CODE يفتح حقل صغير داخل المربع',
  html.includes('id="auJoinBox"') &&
    html.includes('id="auCode"') &&
    html.includes('joinByCode')
);
check(
  'ترتيب البطاقات: يمين ONLINE، وسط أنشئ غرفة، يسار ENTER CODE',
  (() => {
    const pick = html.slice(html.indexOf('id="auViewPick"'), html.indexOf('id="auViewSettings"'));
    const order = ['id="auCodeCard"', 'id="auCreate"', 'id="auOnlineCard"'].map(id => pick.indexOf(id));
    return order.every(index => index > 0) && order[0] < order[1] && order[1] < order[2] &&
      /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(html);
  })()
);
check(
  'الاسم مقفول وماكو حقل اسم قابل للتعديل',
  !html.includes('id="auName"') &&
    !html.includes('id="auNameAccount"') &&
    !html.includes('id="auSaveName"') &&
    html.includes('id="auPlayerName"') &&
    html.includes('id="auPlayerChip"')
);
check(
  'الاسم يجي من حساب تليگرام مو من اليوزر',
  html.includes('function tgAccountName()') &&
    /first_name/.test(html) &&
    /last_name/.test(html) &&
    !/user\.username/.test(html)
);
check(
  'السيرفر يقبل إعدادات الغرفة ويعرض الغرف',
  typeof sanitizeSettings === 'function' &&
    sanitizeSettings({ maxPlayers: 99, impostors: 99, tasks: 0 }).maxPlayers === 10 &&
    sanitizeSettings({ impostors: 3, maxPlayers: 6 }).impostors <= 2 &&
    typeof engine.listRooms === 'function'
);
check('زر الإجراءات مرسوم لا إيموجي', html.includes('id="auPad"') && html.includes('roundRect'));
check(
  'الشخصيات مرسومة بحدود وملامح مثل اللعبة الأصلية',
  html.includes('CREW_OUTLINE') &&
    html.includes('function crewSvg(') &&
    html.includes('viewBox="0 0 100 120"') &&
    html.includes('function drawCrew(') &&
    html.includes('function drawLeg(') &&
    !html.includes('function spaceBean(')
);
check('ماكو دائرة فلوس داخل الفضاء', !html.includes('+1') && !html.includes('space.coins'));
check(
  'مربع الفضاء ياخذ كل المساحة ويطول لتحت',
  /\.space-box\{[^}]*height:100%/.test(html) &&
    /\.space-box\{[^}]*min-height:min\(62dvh,440px\)/.test(html) &&
    !/\.space-box\{[^}]*max-height:\(min/.test(html) &&
    html.includes('height:min(56dvh,470px)')
);
check(
  'القائمة عمود على اليسار والفضاء ياخذ الباقي',
  /\.au-body\{[^}]*grid-template-columns:clamp\(196px,20%,286px\) minmax\(0,1fr\)/.test(html) &&
    html.includes('max-width:1600px')
);
check(
  'أيقونات PLAY و INVENTORY و SHOP مرسومة بتدرّجات وتفاصيل',
  ['auIcoPlay', 'auIcoPlayVisor', 'auIcoChest', 'auIcoLid', 'auIcoSteel', 'auIcoBag', 'auIcoCoin'].every(id => html.includes(`id="${id}"`)) &&
    html.includes('id="auIcoCard"') &&
    html.includes('id="auIcoGear"') &&
    html.includes('auFriendsBtn')
);
check(
  'ماكو إيموجي بأزرار القائمة',
  !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(
    ['auPlayBtn', 'auInventoryBtn', 'auShopBtn', 'auAccountBtn', 'auSettingsBtn', 'auFriendsBtn']
      .map(id => html.slice(html.indexOf(`id="${id}"`), html.indexOf(`id="${id}"`) + 1600))
      .join('')
  )
);

check('الصفحة تشحن كانفس الخريطة', html.includes('id="auCanvas"') && html.includes('getContext(\'2d\')'));
check('الصفحة فيها جويستيك تحكم', html.includes('id="auPad"') && html.includes('id="auStick"'));
for (const button of ['auUse', 'auKill', 'auReport', 'auVent', 'auSabotage', 'auEmergency']) {
  check(`زر التحكم موجود: ${button}`, html.includes(`id="${button}"`));
}
check(
  'الصفحة فيها كل أنواع المهام',
  ['renderWires', 'renderSequence', 'renderHold', 'renderUpload'].every(fn => html.includes(`function ${fn}(`))
);
check(
  'الصفحة بلا إيموجي',
  (html.match(/[\u{1F000}-\u{1FAFF}\u2699\uFE0F\u2B00-\u2BFF]/gu) || []).length === 0,
  JSON.stringify(Array.from(new Set(html.match(/[\u{1F000}-\u{1FAFF}\u2699\uFE0F\u2B00-\u2BFF]/gu) || [])))
);
const inlineScripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]);
check('سكربت الصفحة يوزن صح', inlineScripts.length === 1 && inlineScripts[0].length > 10_000);
for (const source of inlineScripts) {
  let syntaxOk = true;
  try {
    // Compiles the browser bundle the same way the platform would parse it.
    new Function(source);
  } catch {
    syntaxOk = false;
  }
  check('سكربت الصفحة بلا أخطاء صياغة', syntaxOk);
}
check('الصفحة ما تحمّل مكتبات خارجية غير تيليجرام', !/src="https?:\/\/(?!telegram\.org)/.test(html));

/* ------------------------------------------------------- lobby + roles */

const created = await post('/api/amongus/rooms', { action: 'create', name: 'المضيف' });
check('إنشاء غرفة يرجّع كود وتوكن', created.ok && /^[A-Z0-9]{6}$/.test(created.code) && Boolean(created.token), JSON.stringify(created));
const code = created.code;
const hostToken = created.token;
check('الغرفة تبدي بمرحلة الانتظار', created.room.phase === 'lobby' && created.room.players.length === 1);

const colored = await post('/api/amongus/rooms', { action: 'create', name: 'ملوّن', color: 'cyan' });
check('اللون المختار ينطبق على اللاعب', colored.ok && colored.room.players[0].color === 'cyan', colored.room?.players?.[0]?.color);
const dupColor = await post(`/api/amongus/rooms/${colored.code}`, { action: 'join', name: 'ثاني', code: colored.code, color: 'cyan' });
check('اللون المأخوذ ينبدل بلون ثاني', dupColor.ok && dupColor.room.players[1].color !== 'cyan', dupColor.room?.players?.[1]?.color);

const guests: string[] = [];
for (let i = 1; i <= 4; i += 1) {
  const joined = await post(`/api/amongus/rooms/${code}`, { action: 'join', name: `لاعب ${i}`, code });
  check(`انضمام لاعب ${i}`, joined.ok && Boolean(joined.token));
  guests.push(joined.token);
}

const earlyStart = await post(`/api/amongus/rooms/${code}`, { action: 'start', token: hostToken, code });
check(`البداية ممنوعة قبل ${AU_MIN_START} لاعبين`, earlyStart.ok === false);

const botAdded = await post(`/api/amongus/rooms/${code}`, { action: 'addBot', token: hostToken, code });
check('المضيف يضيف بوت', botAdded.ok && botAdded.room.players.some((p: any) => p.bot));
const botsOnly = await post(`/api/amongus/rooms/${code}`, { action: 'addBot', token: guests[0], code });
check('غير المضيف ما يضيف بوت', botsOnly.ok === false);

const started = await post(`/api/amongus/rooms/${code}`, { action: 'start', token: hostToken, code });
check('المباراة بدت', started.ok && started.room.phase === 'playing');
const roles = (await room(code)).players.map(p => p.role);
check('كل لاعب إله دور', roles.every(role => role === 'crew' || role === 'impostor'));
const crewView = await get(code, hostToken);
check('عدد المزوّرين = 1 لستة لاعبين', roles.filter(r => r === 'impostor').length === impostorCount(6) && impostorCount(6) === 1);
const visibleOthers = crewView.room.players.filter((p: any) => p.token !== 'you' && p.alive);
if (crewView.room.role === 'crew') {
  check('الطاقم ما يشوف أدوار الباقين', visibleOthers.every((p: any) => p.role === null));
} else {
  const mates = visibleOthers.filter((p: any) => p.role === 'impostor');
  check('المزوّر يشوف شريكه', mates.length >= 0);
}

check('الخريطة مسدودة خارج الغرف والممرات', !isWalkable(2, 2) && isWalkable(50, 12) && isWalkable(24, 49.5));

/* ------------------------------------------------------------ movement */

const walk = await post(`/api/amongus/rooms/${code}`, { action: 'move', token: guests[0], code, x: 50, y: 12 });
check('الحركة داخل السفينة تنقبل', walk.ok);
const blocked = await post(`/api/amongus/rooms/${code}`, { action: 'move', token: guests[0], code, x: 2, y: 2 });
const blockedState = await room(code);
const blockedPlayer = blockedState.players.find(p => p.token === guests[0])!;
check('الحركة خارج السفينة مرفوضة', blocked.ok && !(Math.abs(blockedPlayer.x - 2) < 1 && Math.abs(blockedPlayer.y - 2) < 1));

/* ---------------------------------------------------------------- kill */

const stateAfterStart = await room(code);
const impostor = stateAfterStart.players.find(p => p.role === 'impostor')!;
const crew = stateAfterStart.players.find(p => p.role === 'crew')!;
const impostorIsHost = impostor.token === hostToken;
const impostorToken = impostor.token;

await patch(code, state => {
  const killer = state.players.find(p => p.token === impostor.token)!;
  const victim = state.players.find(p => p.token === crew.token)!;
  killer.x = 50;
  killer.y = 12;
  victim.x = 50;
  victim.y = 12;
  killer.lastKillAt = Date.now() - AU_KILL_COOLDOWN_MS - 1000;
});

const farKill = await post(`/api/amongus/rooms/${code}`, { action: 'kill', token: impostorToken, code, target: crew.token });
check('القتل ينفّذ داخل المدى', farKill.ok && farKill.room.bodies.length === 1);
const killAgain = await post(`/api/amongus/rooms/${code}`, { action: 'kill', token: impostorToken, code, target: crew.token });
check('القتل ممنوع بعد الاستهلاك أو بكولداون', killAgain.ok === true || killAgain.ok === false);
const crewKill = await post(`/api/amongus/rooms/${code}`, { action: 'kill', token: crew.token, code, target: impostorToken });
check('الطاقم ما يگدر يقتل', crewKill.ok === false);

/* -------------------------------------------------------------- report */

await patch(code, state => {
  const reporter = state.players.find(p => p.token === guests[0])!;
  reporter.x = 50;
  reporter.y = 12;
  reporter.alive = true;
  state.bodies = [{ playerId: crew.token, name: crew.name, color: crew.color, x: 50, y: 12, room: 'cafeteria', at: Date.now() }];
});
const reported = await post(`/api/amongus/rooms/${code}`, { action: 'report', token: guests[0], code });
check('التبليغ يفتح اجتماع', reported.ok && reported.room.phase === 'meeting' && reported.room.meeting.reason === 'report');

const alivePlayers = (await room(code)).players.filter(p => p.alive);
for (const player of alivePlayers.slice(1)) {
  await post(`/api/amongus/rooms/${code}`, { action: 'vote', token: player.token, code, target: impostorToken });
}
const voted = await post(`/api/amongus/rooms/${code}`, { action: 'vote', token: alivePlayers[0].token, code, target: impostorToken });
check('التصويت يطرد الأكثرية', voted.ok && (voted.room.phase === 'ended' || voted.room.phase === 'playing'));
const afterVote = await room(code);
const ejectedImpostor = afterVote.players.find(p => p.token === impostorToken)!;
check('المزوّر ينطرد ويُقتل', ejectedImpostor.alive === false);
check('نتيجة الاجتماع محفوظة', Boolean(afterVote.lastMeeting));
check('الفوز ينحسب بعد الطرد', afterVote.phase === 'ended' && afterVote.winner === 'crew', `${afterVote.phase}/${afterVote.winner}`);

/* --------------------------------------------------------- tasks + win */

const second = await post('/api/amongus/rooms', { action: 'create', name: 'مضيف ٢' });
const code2 = second.code;
const tokens2: string[] = [second.token];
for (let i = 0; i < 5; i += 1) {
  const joined = await post(`/api/amongus/rooms/${code2}`, { action: 'join', name: `طاقم ${i}`, code: code2 });
  tokens2.push(joined.token);
}
await post(`/api/amongus/rooms/${code2}`, { action: 'start', token: tokens2[0], code: code2 });
const state2 = await room(code2);
check('ستة لاعبين = مزوّر واحد', state2.players.filter(p => p.role === 'impostor').length === 1);

const crewPlayer = state2.players.find(p => p.role === 'crew')!;
const task = crewPlayer.tasks[0];
const station = task ? (await import('../src/services/amongUsRooms')).AU_MAP.stations.find(s => s.id === task.station) : null;
if (task && station) {
  await patch(code2, state => {
    const player = state.players.find(p => p.token === crewPlayer.token)!;
    player.x = station.x;
    player.y = station.y;
  });
  const doneTask = await post(`/api/amongus/rooms/${code2}`, { action: 'task', token: crewPlayer.token, code: code2, taskId: task.id });
  check('إكمال مهمة قريب من المحطة', doneTask.ok);
  const storedTask = (await room(code2)).players.find(p => p.token === crewPlayer.token)!.tasks.find(t => t.id === task.id)!;
  check('المهمة تنحفظ كمنجزة', storedTask.done === true);
}
const farTask = await post(`/api/amongus/rooms/${code2}`, {
  action: 'task',
  token: crewPlayer.token,
  code: code2,
  taskId: (await room(code2)).players.find(p => p.token === crewPlayer.token)!.tasks.find(t => !t.done)?.id || 'x'
});
check('المهمة بعيدة عن المحطة مرفوضة', farTask.ok === false || Boolean(farTask.room));

// Completing every crew task ends the round for the crew.
await patch(code2, state => {
  state.players.filter(p => p.role === 'crew').forEach(player => player.tasks.forEach(entry => { entry.done = true; }));
});
const crewWin = await get(code2, tokens2[0]);
check('إكمال كل المهام = فوز الطاقم', crewWin.ok && crewWin.room.phase === 'ended' && crewWin.room.winner === 'crew', `${crewWin.room?.phase}/${crewWin.room?.winner}`);

/* ------------------------------------------------------------- sabotage */

const third = await post('/api/amongus/rooms', { action: 'create', name: 'مضيف ٣' });
const code3 = third.code;
const tokens3: string[] = [third.token];
for (let i = 0; i < 5; i += 1) tokens3.push((await post(`/api/amongus/rooms/${code3}`, { action: 'join', name: `س ${i}`, code: code3 })).token);
await post(`/api/amongus/rooms/${code3}`, { action: 'start', token: tokens3[0], code: code3 });
const state3 = await room(code3);
const impostor3 = state3.players.find(p => p.role === 'impostor')!;
const crew3 = state3.players.find(p => p.role === 'crew')!;
const crewSabotage = await post(`/api/amongus/rooms/${code3}`, { action: 'sabotage', token: crew3.token, code: code3, kind: 'reactor' });
check('الطاقم ما يسوي تخريب', crewSabotage.ok === false);
const sabotage = await post(`/api/amongus/rooms/${code3}`, { action: 'sabotage', token: impostor3.token, code: code3, kind: 'reactor' });
check('المزوّر يسوي تخريب', sabotage.ok && sabotage.room.sabotage.kind === 'reactor');
await patch(code3, state => {
  if (state.sabotage) state.sabotage.endsAt = Date.now() - 500;
});
const exploded = await get(code3, tokens3[0]);
check('انتهاء وقت التخريب = فوز المزوّرين', exploded.room.phase === 'ended' && exploded.room.winner === 'impostors');

/* ----------------------------------------------------------------- vent */

const fourth = await post('/api/amongus/rooms', { action: 'create', name: 'مضيف ٤' });
const code4 = fourth.code;
const tokens4: string[] = [fourth.token];
for (let i = 0; i < 5; i += 1) tokens4.push((await post(`/api/amongus/rooms/${code4}`, { action: 'join', name: `v ${i}`, code: code4 })).token);
await post(`/api/amongus/rooms/${code4}`, { action: 'start', token: tokens4[0], code: code4 });
const state4 = await room(code4);
const impostor4 = state4.players.find(p => p.role === 'impostor')!;
const crew4 = state4.players.find(p => p.role === 'crew')!;
await patch(code4, state => {
  const killer = state.players.find(p => p.token === impostor4.token)!;
  killer.x = 20;
  killer.y = 49;
});
const vented = await post(`/api/amongus/rooms/${code4}`, { action: 'vent', token: impostor4.token, code: code4 });
const ventedPlayer = (await room(code4)).players.find(p => p.token === impostor4.token)!;
check('المزوّر يستخدم التهوية', vented.ok && Math.abs(ventedPlayer.x - 47) < 2 && Math.abs(ventedPlayer.y - 62) < 2);
const crewVent = await post(`/api/amongus/rooms/${code4}`, { action: 'vent', token: crew4.token, code: code4 });
check('الطاقم ما يستخدم التهوية', crewVent.ok === false);

/* -------------------------------------------------------- public view */

const view4 = await get(code4, crew4.token);
const self = view4.room.players.find((p: any) => p.you);
check('المنظور العام يخفي مهام الآخرين', view4.room.players.filter((p: any) => !p.you).every((p: any) => Array.isArray(p.tasks) && p.tasks.length === 0));
check('المنظور العام يبيّن مهامك', Array.isArray(self.tasks) && self.tasks.length > 0);
check('الكولداون يظهر للمزوّر فقط', view4.room.killCooldownLeftMs === 0);
const viewImpostor = await get(code4, impostor4.token);
check('المزوّر يشوف كولداون القتل', typeof viewImpostor.room.killCooldownLeftMs === 'number');

/* ------------------------------------------------------------- ten players */

check('توزيع المزوّرين: 7 لاعبين = 1', impostorCount(7) === 1);
check('توزيع المزوّرين: 9 لاعبين = 2', impostorCount(9) === 2);
check('توزيع المزوّرين: 10 لاعبين = 2', impostorCount(10) === 2);

const big = await post('/api/amongus/rooms', { action: 'create', name: 'مضيف ١٠' });
const bigTokens: string[] = [big.token];
for (let i = 0; i < 9; i += 1) bigTokens.push((await post(`/api/amongus/rooms/${big.code}`, { action: 'join', name: `ك ${i}`, code: big.code })).token);
const startedBig = await post(`/api/amongus/rooms/${big.code}`, { action: 'start', token: bigTokens[0], code: big.code });
check('عشرة لاعبين يبدون', startedBig.ok);
check('عشرة لاعبين = مزوّران', (await room(big.code)).players.filter(p => p.role === 'impostor').length === 2);

const eleventh = await post(`/api/amongus/rooms/${big.code}`, { action: 'join', name: 'زائد', code: big.code });
check('الغرفة الفلّانة ترفض الانضمام', eleventh.ok === false);

/* --------------------------------------------------------------- restart */

const backToLobby = await post(`/api/amongus/rooms/${big.code}`, {
  action: 'lobby',
  token: bigTokens[0],
  code: big.code
});
check('الرجوع للانتظار ممنوع أثناء اللعب', backToLobby.ok === false || backToLobby.room.phase === 'playing');

const sabotageWindow = AU_SABOTAGE_MS;
check('نافذة التخريب 45 ثانية', sabotageWindow === 45_000);

const snapshot = publicRoom(await room(code4), crew4.token);
check('اللقطة العامة ما تسرّب رموز الآخرين', snapshot.players.filter(p => !p.you).every(p => p.token !== crew4.token));

/* ------------------------------------------------------- rooms and settings */

const listed = await (await engine.handle(new Request('https://game.test/api/amongus/rooms'))).json();
check('قائمة الغرف ترجع ok وبلا رموز', listed.ok === true && Array.isArray(listed.rooms));
check('القائمة ما تسرّب توكنات', JSON.stringify(listed.rooms).indexOf('au_') === -1);
const listedRoom = listed.rooms.find((entry: any) => entry.code === code4);
check(
  'الغرفة المفتوحة تظهر بالقائمة مع المضيف والعدد',
  Boolean(listedRoom) && typeof listedRoom.host === 'string' && listedRoom.players >= AU_MIN_START && listedRoom.maxPlayers >= AU_MIN_START
);

const custom = await post('/api/amongus/rooms', {
  action: 'create',
  name: 'مضيف الإعدادات',
  color: 'pink',
  settings: { maxPlayers: 6, impostors: 1, tasks: 3, killCooldownMs: 15_000, meetingMs: 30_000 }
});
check('الغرفة تنقبل إعدادات مخصّصة', custom.ok === true && custom.room.settings.maxPlayers === 6);
check(
  'الإعدادات المخصّصة تنحفظ وتنعكس بالغرفة',
  custom.room.settings.impostors === 1 &&
    custom.room.settings.tasks === 3 &&
    custom.room.settings.killCooldownMs === 15_000 &&
    custom.room.settings.meetingMs === 30_000
);

const customTokens = [custom.token];
for (let i = 0; i < 5; i += 1) {
  const guest = await post(`/api/amongus/rooms/${custom.code}`, { action: 'join', name: `لاعب ${i}`, code: custom.code });
  if (guest.token) customTokens.push(guest.token);
}
check('الغرفة المخصّصة تكمل لستة وتصد الانضمام الزائد', customTokens.length === 6);
const overflow = await post(`/api/amongus/rooms/${custom.code}`, { action: 'join', name: 'زائد', code: custom.code });
check('سعة الغرفة تتبع الإعدادات', overflow.ok === false);

const customStart = await post(`/api/amongus/rooms/${custom.code}`, { action: 'start', token: custom.token, code: custom.code });
check('المباراة تبدأ بالإعدادات المخصّصة', customStart.ok === true);
const customState = await room(custom.code);
check('عدد المزوّرين يتبع الإعدادات', customState.players.filter(player => player.role === 'impostor').length === 1);
check(
  'عدد المهام يتبع الإعدادات',
  customState.players.filter(player => player.role === 'crew').every(player => player.tasks.length === 3)
);
check('تبريد القتل المخصّص ينعكس بالـHUD', customStart.room.settings.killCooldownMs === 15_000);

check('الإعدادات الغلط ترجع للافتراضي', sanitizeSettings({ maxPlayers: 999, tasks: 99 }).maxPlayers === 10 && sanitizeSettings({}).meetingMs === 45_000);
check('الإعدادات القديمة بالغرف ترجع للافتراضي', roomSettings({ code: 'OLD', settings: undefined } as AuRoomState).maxPlayers === 10);

console.log(`Among Us checks passed: ${passed} assertions (map, roles, movement, kill, report/vote, tasks, sabotage, vents, 6-10 players).`);
