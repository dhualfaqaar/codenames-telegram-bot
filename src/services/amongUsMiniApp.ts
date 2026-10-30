import { AU_COLORS, AU_MAP } from './amongUsRooms';

/**
 * The standalone Among Us mini app: a full 2D ship, a joystick, task minigames
 * and the meeting/vote loop. It ships as one document so the worker can serve
 * it at /amongus without touching the shared games shell.
 */
export function amongUsMiniAppHtml(): string {
  const config = JSON.stringify({
    map: AU_MAP,
    colors: AU_COLORS,
    emergency: { x: 50, y: 12 }
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#070a18">
<title>بيننا | ألعاب البوت</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{color-scheme:dark;--bg:#070a18;--panel:#101a33;--panel2:#16243f;--ink:#eef3ff;--muted:#93a4c4;--line:#24344f;--accent:#57d0ff;--good:#4ade80;--bad:#f2555a;--warn:#f5c542}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif}
body{padding:env(safe-area-inset-top) 12px calc(12px + env(safe-area-inset-bottom));overflow:hidden}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
.screen{display:none}
.screen.on{display:block}
.sheet{width:min(100%,560px);margin:0 auto}
h1{font-size:20px;margin:14px 0 4px}
h2{font-size:15px;margin:0 0 8px}
p{margin:0;color:var(--muted);font-size:12px}
.card{border:1px solid var(--line);border-radius:16px;background:linear-gradient(160deg,#131f38,#0d1626);padding:14px;margin:12px 0}
.field{display:block;margin:10px 0}
.field span{display:block;font-size:11px;color:var(--muted);margin-bottom:5px}
input{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:#0a1122;color:var(--ink);font:inherit;outline:none}
input:focus{border-color:var(--accent)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:0 16px;border-radius:13px;border:1px solid var(--line);background:#1a2742;font-weight:800;font-size:13px}
.btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.btn.primary{background:#1d6fd8;border-color:#3f97ff;color:#fff}
.btn.good{background:#177a45;border-color:#2fbf72;color:#fff}
.btn.warn{background:#8a5a12;border-color:#d8a13a;color:#fff}
.btn.ghost{background:#131f36}
.btn[disabled]{opacity:.45}
.btn.block{width:100%}
.row{display:flex;gap:9px;flex-wrap:wrap}
.row>.btn{flex:1}
.names{display:grid;gap:8px;margin:10px 0}
.who{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:12px;border:1px solid var(--line);background:#0d1729}
.who i{width:20px;height:24px;border-radius:6px 6px 8px 8px;display:block;flex:none;position:relative}
.who i:after{content:"";position:absolute;inset:auto 4px 4px;height:7px;border-radius:3px;background:#0b1220}
.who b{font-size:12px;font-weight:800}
.who small{margin-inline-start:auto;color:var(--muted);font-size:10px}
.tag{font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px;background:#22314c;color:#bcd0ee}
.tag.host{background:#274a7d;color:#cfe4ff}
.tag.bot{background:#2c3f2f;color:#b7e3c0}
.tag.dead{background:#4a2230;color:#ffb3c1}
#auToast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);z-index:60;padding:10px 16px;border-radius:12px;background:#0f1c33ee;border:1px solid var(--line);font-size:12px;font-weight:800;opacity:0;transition:.2s;pointer-events:none;max-width:86vw;text-align:center}
#auToast.on{opacity:1;transform:translateX(-50%) translateY(0)}
/* ---- game ---- */
#auStage{position:fixed;inset:0;display:none}
#auStage.on{display:block}
#auCanvas{display:block;width:100%;height:100%;touch-action:none;background:#05070f}
.hud{position:absolute;inset:0;pointer-events:none}
.hud>*{pointer-events:auto}
.hud-top{position:absolute;top:calc(8px + env(safe-area-inset-top));left:10px;right:10px;display:flex;align-items:center;gap:8px}
.chip{padding:6px 10px;border-radius:11px;background:#0b1424d9;border:1px solid var(--line);font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:6px}
.chip svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.bar{flex:1;height:9px;border-radius:99px;background:#132038;border:1px solid var(--line);overflow:hidden}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#39d98a,#57d0ff);width:0;transition:width .3s}
#auAlarm{position:absolute;top:calc(46px + env(safe-area-inset-top));left:10px;right:10px;display:none;padding:8px 12px;border-radius:12px;background:#5a1220ee;border:1px solid #ff5f70;font-size:12px;font-weight:900;text-align:center}
#auAlarm.on{display:block}
.pad{position:absolute;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));width:132px;height:132px;border-radius:50%;background:#0d1830aa;border:1px solid #2a3d5e}
.pad i{position:absolute;width:56px;height:56px;left:38px;top:38px;border-radius:50%;background:#2f6fd0cc;border:1px solid #61a9ff;box-shadow:0 4px 16px #0008}
.acts{position:absolute;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(2,64px);gap:10px}
.act{width:64px;height:64px;border-radius:50%;border:1px solid #2b3f61;background:#14213a;display:grid;place-items:center;color:#93a4c4;position:relative}
.act svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.act small{position:absolute;bottom:-14px;font-size:9px;color:var(--muted);white-space:nowrap}
.act.ready{color:#fff;border-color:#57d0ff;box-shadow:0 0 0 2px #57d0ff44}
.act.kill.ready{background:#5a1622;border-color:#f2555a;box-shadow:0 0 0 2px #f2555a55}
.act.report.ready{background:#5c4a11;border-color:#f5c542}
.act.use.ready{background:#155c39;border-color:#4ade80}
.act.vent.ready{background:#3a2059;border-color:#a978ff}
.act[hidden]{display:none}
.act .cd{position:absolute;inset:0;border-radius:50%;background:#000a;display:grid;place-items:center;font-size:13px;font-weight:900;color:#fff}
/* ---- overlays ---- */
.overlay{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;padding:16px;background:#03060ecc;backdrop-filter:blur(6px)}
.overlay.on{display:flex}
.dialog{width:min(100%,470px);max-height:88dvh;overflow:auto;border-radius:18px;border:1px solid var(--line);background:linear-gradient(165deg,#131f38,#0b1424);padding:16px}
.dialog h2{font-size:16px}
.list{display:grid;gap:8px;margin:10px 0}
.vote{display:flex;align-items:center;gap:9px;padding:9px;border-radius:12px;background:#0d1729;border:1px solid var(--line)}
.vote .btn{min-height:34px;padding:0 12px;font-size:11px;margin-inline-start:auto}
.timer{font-variant-numeric:tabular-nums;font-weight:900;color:var(--warn)}
/* task minigames */
#taskDialog .grid{display:grid;gap:10px}
.wires{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.wire-col{display:grid;gap:9px}
.wire{height:34px;border-radius:9px;border:2px solid #0a1120;cursor:pointer;position:relative}
.wire.done{opacity:.3}
.wire.pick{outline:3px solid #fff}
.seq{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.seq button{height:62px;border-radius:14px;background:#1b2b47;border:1px solid var(--line);font-size:22px;font-weight:900}
.seq button.lit{background:#3f8dff;border-color:#8bc3ff}
.hold-btn{height:74px;border-radius:16px;background:#173050;border:2px solid #57d0ff;font-weight:900;width:100%;font-size:14px}
.hold-fill{height:12px;border-radius:99px;background:#132038;overflow:hidden;margin-top:10px}
.hold-fill i{display:block;height:100%;width:0;background:#57d0ff;transition:width .08s}
.up-count{font-size:34px;font-weight:900;text-align:center;color:var(--accent)}
.hint{font-size:11px;color:var(--muted);text-align:center;margin-top:8px}
.end-banner{text-align:center}
.end-banner strong{display:block;font-size:24px;margin:6px 0}
.win-crew{color:#4ade80}.win-imp{color:#f2555a}
</style>
</head>
<body>
<div id="auToast"></div>

<section id="auEntry" class="screen on">
  <div class="sheet">
    <h1>بيننا — Among Us</h1>
    <p>لعبة منفصلة: طاقم يصلّح السفينة ومزوّر يقتل بالخفاء. من 6 إلى 10 لاعبين.</p>
    <div class="card">
      <label class="field"><span>اسمك</span><input id="auName" maxlength="18" placeholder="اكتب اسمك"></label>
      <button class="btn primary block" id="auCreate">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>أنشئ غرفة
      </button>
      <div class="row" style="margin-top:10px">
        <input id="auCode" placeholder="كود الغرفة" maxlength="6" style="flex:1;text-transform:uppercase">
        <button class="btn" id="auJoin">انضم</button>
      </div>
    </div>
  </div>
</section>

<section id="auLobby" class="screen">
  <div class="sheet">
    <h1>غرفة الانتظار</h1>
    <p>الكود: <b id="auCodeLabel" style="color:var(--accent);letter-spacing:2px">------</b> — شاركه مع أصحابك.</p>
    <div class="card">
      <h2>اللاعبون (<span id="auCount">0</span>/10)</h2>
      <div class="names" id="auNames"></div>
      <div class="row">
        <button class="btn ghost" id="auAddBot">
          <svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01"/></svg>أضف بوت
        </button>
        <button class="btn ghost" id="auKickBot">
          <svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>احذف بوت
        </button>
      </div>
      <button class="btn good block" id="auStart" style="margin-top:10px">
        <svg viewBox="0 0 24 24"><path d="M7 4l12 8-12 8z"/></svg>ابدأ المباراة
      </button>
      <p id="auLobbyHint" class="hint"></p>
    </div>
  </div>
</section>

<section id="auStage">
  <canvas id="auCanvas"></canvas>
  <div class="hud">
    <div class="hud-top">
      <span class="chip" id="auRoleChip">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        <span id="auRoleText">—</span>
      </span>
      <div class="bar"><i id="auProgress"></i></div>
      <span class="chip" id="auTaskChip">0/0</span>
    </div>
    <div id="auAlarm"></div>
    <div class="pad" id="auPad"><i id="auStick"></i></div>
    <div class="acts">
      <button class="act use" id="auUse"><svg viewBox="0 0 24 24"><path d="M4 20l6-6M14 4l6 6-8 2-2-2z"/></svg><small>استعمال</small></button>
      <button class="act report" id="auReport" hidden><svg viewBox="0 0 24 24"><path d="M12 3l9 17H3z"/><path d="M12 9v5M12 17h.01"/></svg><small>تبليغ</small></button>
      <button class="act kill" id="auKill" hidden><svg viewBox="0 0 24 24"><path d="M6 18L18 6M8 4l12 12"/></svg><small>قتل</small></button>
      <button class="act vent" id="auVent" hidden><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h8M8 17h8"/></svg><small>تهوية</small></button>
      <button class="act" id="auSabotage" hidden><svg viewBox="0 0 24 24"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg><small>تخريب</small></button>
      <button class="act" id="auEmergency"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/></svg><small>طوارئ</small></button>
    </div>
  </div>
</section>

<div class="overlay" id="auTaskDialog"><div class="dialog" id="auTaskBody"></div></div>

<div class="overlay" id="auSabDialog">
  <div class="dialog">
    <h2>اختار التخريب</h2>
    <div class="grid" style="display:grid;gap:9px;margin-top:10px">
      <button class="btn warn" data-sab="reactor">المفاعل — فشل خلال 45 ثانية</button>
      <button class="btn warn" data-sab="oxygen">الأوكسجين — فشل خلال 45 ثانية</button>
      <button class="btn ghost" data-sab="lights">إطفاء الإنارة</button>
      <button class="btn ghost" data-sab="comms">تعطيل الاتصالات</button>
    </div>
    <button class="btn block" id="auSabClose" style="margin-top:10px">إغلاق</button>
  </div>
</div>

<div class="overlay" id="auMeetingDialog">
  <div class="dialog">
    <h2 id="auMeetingTitle">اجتماع طارئ</h2>
    <p>صوّت لطرد المزوّر — أو تخطَّ التصويت.</p>
    <div class="list" id="auVoteList"></div>
    <button class="btn ghost block" id="auSkipVote">تخطي التصويت</button>
    <p class="hint">الوقت المتبقي: <span class="timer" id="auMeetingTimer">0</span></p>
  </div>
</div>

<div class="overlay" id="auEndDialog">
  <div class="dialog end-banner">
    <strong id="auEndTitle">—</strong>
    <p id="auEndReason"></p>
    <div class="list" id="auEndList" style="margin-top:12px"></div>
    <button class="btn primary block" id="auBackLobby" style="margin-top:10px">ارجع لغرفة الانتظار</button>
  </div>
</div>

<script>
(function(){
  var CFG = ${config};
  var AU = { code:'', token:'', room:null, name:'', busy:false, lastPoll:0 };
  var el = function(id){ return document.getElementById(id); };
  var toastTimer = 0;
  function toast(text){
    var box = el('auToast');
    box.textContent = text;
    box.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ box.classList.remove('on'); }, 2600);
  }
  function setScreen(name){
    ['auEntry','auLobby','auStage'].forEach(function(id){
      var node = el(id);
      if (id === name) node.classList.add('on'); else node.classList.remove('on');
    });
    document.body.style.overflow = name === 'auStage' ? 'hidden' : 'auto';
    if (window.Telegram && Telegram.WebApp && name === 'auStage') { try { Telegram.WebApp.expand && Telegram.WebApp.expand(); } catch(e){} }
  }
  function api(path, payload){
    return fetch('/api/amongus' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function(r){ return r.json().catch(function(){ return { ok:false, error:'خطأ بالشبكة' }; }); });
  }
  function act(action, extra){
    if (!AU.code || !AU.token) return Promise.resolve({ ok:false });
    var body = Object.assign({ action: action, token: AU.token, code: AU.code }, extra || {});
    return api('/rooms/' + AU.code, body).then(function(res){
      if (!res.ok) { if (res.error) toast(res.error); return res; }
      applyRoom(res.room);
      return res;
    });
  }
  function readName(){
    var input = el('auName');
    var name = (input.value || '').trim();
    if (!name) {
      try { name = (Telegram.WebApp.initDataUnsafe.user.username || Telegram.WebApp.initDataUnsafe.user.first_name || '').slice(0,18); } catch(e){}
    }
    AU.name = name || 'لاعب';
    try { localStorage.setItem('au-name', AU.name); } catch(e){}
    return AU.name;
  }
  try { el('auName').value = localStorage.getItem('au-name') || ''; } catch(e){}

  /* ---------------- lobby ---------------- */
  function renderLobby(room){
    el('auCodeLabel').textContent = room.code;
    el('auCount').textContent = String(room.players.length);
    var names = el('auNames');
    names.innerHTML = room.players.map(function(p){
      var tags = '';
      if (p.isHost) tags += '<span class="tag host">مضيف</span>';
      if (p.bot) tags += '<span class="tag bot">بوت</span>';
      var color = (CFG.colors.filter(function(c){ return c.id === p.color; })[0] || CFG.colors[0]).hex;
      return '<div class="who"><i style="background:' + color + '"></i><b>' + esc(p.name) + '</b>' + tags +
        '<small>' + (p.you ? 'أنت' : '') + '</small></div>';
    }).join('');
    var you = room.players.filter(function(p){ return p.you; })[0];
    var isHost = !!(you && you.isHost);
    el('auStart').disabled = !(isHost && room.canStart);
    el('auAddBot').disabled = !isHost || room.players.length >= room.maxPlayers;
    el('auKickBot').disabled = !isHost;
    el('auLobbyHint').textContent = room.canStart
      ? (isHost ? 'كل شي جاهز — اضغط ابدأ.' : 'بانتظار المضيف يبدي المباراة.')
      : 'تحتاج ' + room.minPlayers + ' لاعبين — ضيف بوتات إذا ناقص.';
  }
  function esc(text){
    return String(text == null ? '' : text).replace(/[&<>"']/g, function(ch){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
    });
  }

  el('auCreate').addEventListener('click', function(){
    var name = readName();
    api('/rooms', { action:'create', name:name }).then(function(res){
      if (!res.ok) return toast(res.error || 'تعذّر إنشاء الغرفة');
      AU.code = res.code; AU.token = res.token;
      history.replaceState(null, '', '?code=' + res.code);
      applyRoom(res.room);
    });
  });
  el('auJoin').addEventListener('click', function(){
    var code = (el('auCode').value || '').trim().toUpperCase();
    if (code.length < 4) return toast('اكتب كود الغرفة');
    var name = readName();
    api('/rooms/' + code, { action:'join', name:name, code:code }).then(function(res){
      if (!res.ok) return toast(res.error || 'ما گدرنا ندخل');
      AU.code = res.code; AU.token = res.token;
      history.replaceState(null, '', '?code=' + res.code);
      applyRoom(res.room);
    });
  });
  el('auAddBot').addEventListener('click', function(){ act('addBot'); });
  el('auKickBot').addEventListener('click', function(){
    var bots = (AU.room ? AU.room.players : []).filter(function(p){ return p.bot; });
    if (!bots.length) return toast('ماكو بوتات');
    act('kickBot', { botToken: bots[bots.length - 1].token });
  });
  el('auStart').addEventListener('click', function(){
    act('start').then(function(res){
      if (res && res.ok) setScreen('auStage');
    });
  });
  el('auBackLobby').addEventListener('click', function(){
    el('auEndDialog').classList.remove('on');
    act('lobby');
  });

  /* ---------------- polling ---------------- */
  function applyRoom(room){
    if (!room) return;
    AU.room = room;
    if (room.phase === 'lobby') {
      setScreen('auLobby');
      renderLobby(room);
      return;
    }
    setScreen('auStage');
    if (room.phase === 'playing') {
      var me = room.players.filter(function(p){ return p.you; })[0];
      if (me && !world.ready) { world.x = me.x; world.y = me.y; world.ready = true; }
    }
    renderHud(room);
    renderMeeting(room);
    renderEnd(room);
  }
  function poll(){
    if (!AU.code || !AU.token) return;
    fetch('/api/amongus/rooms/' + AU.code + '?token=' + encodeURIComponent(AU.token))
      .then(function(r){ return r.json(); })
      .then(function(res){ if (res && res.ok) applyRoom(res.room); })
      .catch(function(){});
  }
  setInterval(poll, 850);

  /* ---------------- world + canvas ---------------- */
  var world = { x: 50, y: 17, ready:false, vx:0, vy:0, lastSent:0 };
  var canvas = el('auCanvas');
  var ctx = canvas.getContext('2d');
  var size = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
  function resize(){
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    size.w = canvas.clientWidth; size.h = canvas.clientHeight;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var scale = Math.min(size.w / 100, size.h / 100);
    size.scale = scale;
    size.ox = (size.w - 100 * scale) / 2;
    size.oy = (size.h - 100 * scale) / 2;
  }
  window.addEventListener('resize', resize);

  function toScreen(x, y){ return { x: size.ox + x * size.scale, y: size.oy + y * size.scale }; }

  function colorHex(id){
    var found = CFG.colors.filter(function(c){ return c.id === id; })[0];
    return found ? found.hex : '#8899aa';
  }

  function draw(){
    requestAnimationFrame(draw);
    if (!AU.room || AU.room.phase === 'lobby') return;
    if (!size.w) resize();
    var room = AU.room;
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, size.w, size.h);

    // corridors then rooms
    CFG.map.corridors.forEach(function(hall){
      var p = toScreen(hall.x, hall.y);
      ctx.fillStyle = '#16233a';
      ctx.strokeStyle = '#22334f';
      ctx.lineWidth = 1;
      ctx.fillRect(p.x, p.y, hall.w * size.scale, hall.h * size.scale);
      ctx.strokeRect(p.x, p.y, hall.w * size.scale, hall.h * size.scale);
    });
    CFG.map.rooms.forEach(function(roomDef){
      var p = toScreen(roomDef.x, roomDef.y);
      ctx.fillStyle = '#1b2c46';
      ctx.strokeStyle = '#2f4770';
      ctx.lineWidth = 1.4;
      ctx.fillRect(p.x, p.y, roomDef.w * size.scale, roomDef.h * size.scale);
      ctx.strokeRect(p.x, p.y, roomDef.w * size.scale, roomDef.h * size.scale);
      ctx.fillStyle = '#7f96bb';
      ctx.font = '700 ' + Math.max(8, size.scale * 1.5) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(roomDef.name, p.x + (roomDef.w * size.scale) / 2, p.y + 10);
    });

    // own tasks
    var me = room.players.filter(function(p){ return p.you; })[0];
    if (me && me.role === 'crew' && me.alive) {
      me.tasks.forEach(function(task){
        if (task.done) return;
        var station = CFG.map.stations.filter(function(s){ return s.id === task.station; })[0];
        if (!station) return;
        var sp = toScreen(station.x, station.y);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(3, size.scale * 0.9), 0, Math.PI * 2);
        ctx.fillStyle = '#f5c542';
        ctx.fill();
        ctx.strokeStyle = '#0a1120';
        ctx.stroke();
      });
    }

    // bodies
    (room.bodies || []).forEach(function(body){
      var pos = toScreen(body.x, body.y);
      ctx.fillStyle = colorHex(body.color);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, size.scale * 2.2, size.scale * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0a1120';
      ctx.stroke();
    });

    // players
    room.players.forEach(function(player){
      if (player.token === 'you') return;
      var pos = toScreen(player.x, player.y);
      var radius = size.scale * 1.9;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - radius * 0.4, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorHex(player.color);
      ctx.globalAlpha = player.alive ? 1 : 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 1.05, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#0a1120';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#dfe9ff';
      ctx.font = '700 ' + Math.max(8, size.scale * 1.3) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, pos.x, pos.y - radius * 2.1);
      if (!player.alive) {
        ctx.fillStyle = '#ff8fa0';
        ctx.fillText('جثة', pos.x, pos.y + radius * 1.6);
      }
    });

    // own sprite
    if (me) {
      var pos = toScreen(world.x, world.y);
      var radius = size.scale * 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - radius * 0.4, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorHex(me.color);
      ctx.globalAlpha = me.alive ? 1 : 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 1.05, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#eaf3ff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#eaf3ff';
      ctx.font = '800 ' + Math.max(9, size.scale * 1.4) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('أنت', pos.x, pos.y - radius * 2.2);
    }

    // vision mask
    if (me) {
      var vp = toScreen(world.x, world.y);
      var radius2 = size.scale * (me.alive ? (room.sabotage && room.sabotage.kind === 'lights' ? 12 : (me.role === 'impostor' ? 30 : 24)) : 30);
      var grd = ctx.createRadialGradient(vp.x, vp.y, radius2 * 0.55, vp.x, vp.y, radius2);
      grd.addColorStop(0, 'rgba(3,6,14,0)');
      grd.addColorStop(1, 'rgba(3,6,14,0.92)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size.w, size.h);
    }

    if (room.sabotage && room.sabotage.kind === 'lights') {
      ctx.fillStyle = 'rgba(2,4,10,0.35)';
      ctx.fillRect(0, 0, size.w, size.h);
    }
  }
  requestAnimationFrame(draw);

  /* ---------------- movement ---------------- */
  var stick = el('auStick');
  var pad = el('auPad');
  var dragging = false;
  var padCenter = { x: 0, y: 0 };
  function padStart(event){
    dragging = true;
    var rect = pad.getBoundingClientRect();
    padCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    padMove(event);
  }
  function padMove(event){
    if (!dragging) return;
    var point = event.touches ? event.touches[0] : event;
    var dx = point.clientX - padCenter.x;
    var dy = point.clientY - padCenter.y;
    var limit = 44;
    var length = Math.hypot(dx, dy) || 1;
    var clamp = Math.min(1, limit / length);
    var sx = dx * clamp;
    var sy = dy * clamp;
    stick.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
    world.vx = sx / limit;
    world.vy = sy / limit;
  }
  function padEnd(){
    dragging = false;
    stick.style.transform = 'translate(0,0)';
    world.vx = 0; world.vy = 0;
  }
  pad.addEventListener('touchstart', function(e){ e.preventDefault(); padStart(e); }, { passive:false });
  pad.addEventListener('touchmove', function(e){ e.preventDefault(); padMove(e); }, { passive:false });
  pad.addEventListener('touchend', function(e){ e.preventDefault(); padEnd(); }, { passive:false });
  pad.addEventListener('mousedown', function(e){ e.preventDefault(); padStart(e); });
  window.addEventListener('mousemove', function(e){ if (dragging) padMove(e); });
  window.addEventListener('mouseup', function(){ if (dragging) padEnd(); });

  var keyState = {};
  window.addEventListener('keydown', function(e){ keyState[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', function(e){ keyState[e.key.toLowerCase()] = false; });

  function step(){
    requestAnimationFrame(step);
    if (!AU.room || AU.room.phase !== 'playing') return;
    var me = AU.room.players.filter(function(p){ return p.you; })[0];
    if (!me || !me.alive) return;
    var vx = world.vx, vy = world.vy;
    if (keyState['arrowleft'] || keyState['a']) vx -= 1;
    if (keyState['arrowright'] || keyState['d']) vx += 1;
    if (keyState['arrowup'] || keyState['w']) vy -= 1;
    if (keyState['arrowdown'] || keyState['s']) vy += 1;
    if (!vx && !vy) return;
    var length = Math.hypot(vx, vy) || 1;
    var speed = 22;
    world.x = Math.max(1, Math.min(99, world.x + (vx / length) * speed / 60));
    world.y = Math.max(1, Math.min(99, world.y + (vy / length) * speed / 60));
    var now = Date.now();
    if (now - world.lastSent > 220) {
      world.lastSent = now;
      act('move', { x: world.x, y: world.y });
    }
  }
  requestAnimationFrame(step);

  /* ---------------- hud + buttons ---------------- */
  function nearestStation(me){
    var best = null;
    me.tasks.forEach(function(task){
      if (task.done) return;
      var station = CFG.map.stations.filter(function(s){ return s.id === task.station; })[0];
      if (!station) return;
      var d = Math.hypot(station.x - world.x, station.y - world.y);
      if (d < 7 && (!best || d < best.d)) best = { task: task, station: station, d: d };
    });
    return best;
  }
  function nearestTarget(me){
    var best = null;
    (AU.room.players || []).forEach(function(p){
      if (p.token === 'you' || !p.alive) return;
      var d = Math.hypot(p.x - world.x, p.y - world.y);
      if (d < 7 && (!best || d < best.d)) best = { player: p, d: d };
    });
    return best;
  }
  function nearestBody(){
    var best = null;
    (AU.room.bodies || []).forEach(function(body){
      var d = Math.hypot(body.x - world.x, body.y - world.y);
      if (d < 8 && (!best || d < best.d)) best = { body: body, d: d };
    });
    return best;
  }
  function nearVent(){
    return CFG.map.vents.some(function(v){ return Math.hypot(v.x - world.x, v.y - world.y) < 6; });
  }
  function nearEmergency(){
    return Math.hypot(CFG.emergency.x - world.x, CFG.emergency.y - world.y) < 9;
  }

  function renderHud(room){
    var me = room.players.filter(function(p){ return p.you; })[0];
    if (!me) return;
    el('auRoleText').textContent = room.phase === 'ended'
      ? (room.winner === 'crew' ? 'فاز الطاقم' : 'فاز المزوّرون')
      : (me.role === 'impostor' ? 'مزوّر' : 'طاقم');
    var progress = room.progress.total ? Math.round((room.progress.done / room.progress.total) * 100) : 0;
    el('auProgress').style.width = progress + '%';
    el('auTaskChip').textContent = room.progress.done + '/' + room.progress.total;

    el('auKill').hidden = me.role !== 'impostor';
    el('auVent').hidden = me.role !== 'impostor';
    el('auSabotage').hidden = me.role !== 'impostor';
    el('auReport').hidden = false;

    var station = nearestStation(me);
    el('auUse').classList.toggle('ready', !!station && room.phase === 'playing' && me.alive);
    var target = nearestTarget(me);
    var killReady = me.role === 'impostor' && !!target && room.killCooldownLeftMs === 0 && room.phase === 'playing';
    el('auKill').classList.toggle('ready', killReady);
    var cd = el('auKill').querySelector('.cd');
    if (me.role === 'impostor' && room.killCooldownLeftMs > 0) {
      if (!cd) { cd = document.createElement('span'); cd.className = 'cd'; el('auKill').appendChild(cd); }
      cd.textContent = Math.ceil(room.killCooldownLeftMs / 1000) + '';
    } else if (cd) { cd.remove(); }
    el('auReport').classList.toggle('ready', !!nearestBody());
    el('auVent').classList.toggle('ready', nearVent());
    el('auEmergency').classList.toggle('ready', nearEmergency() && !me.emergencyUsed);

    var alarm = el('auAlarm');
    if (room.sabotage) {
      var left = room.sabotage.endsAt ? Math.max(0, Math.ceil((room.sabotage.endsAt - room.now) / 1000)) : 0;
      var label = room.sabotage.kind === 'reactor' ? 'المفاعل' : room.sabotage.kind === 'oxygen' ? 'الأوكسجين' : room.sabotage.kind === 'lights' ? 'الإنارة' : 'الاتصالات';
      alarm.textContent = 'تخريب ' + label + (left ? ' — ' + left + ' ثانية قبل الفشل' : '');
      alarm.classList.add('on');
    } else {
      alarm.classList.remove('on');
    }
  }

  el('auUse').addEventListener('click', function(){
    var me = AU.room.players.filter(function(p){ return p.you; })[0];
    if (!me) return;
    if (AU.room.sabotage) {
      var station = AU.room.sabotage.kind === 'reactor' ? { x: 13, y: 68 }
        : AU.room.sabotage.kind === 'oxygen' ? { x: 85, y: 42 }
        : AU.room.sabotage.kind === 'lights' ? { x: 24, y: 49.5 } : { x: 88, y: 68 };
      if (Math.hypot(station.x - world.x, station.y - world.y) < 8) return act('fix');
    }
    var near = nearestStation(me);
    if (near) openTask(near.task);
    else toast('اقرب من محطة مهمة أول');
  });
  el('auKill').addEventListener('click', function(){
    var target = nearestTarget(AU.room.players.filter(function(p){ return p.you; })[0]);
    if (!target) return toast('ماكو هدف قريب');
    act('kill', { target: target.player.token });
  });
  el('auReport').addEventListener('click', function(){ act('report'); });
  el('auVent').addEventListener('click', function(){ act('vent'); });
  el('auEmergency').addEventListener('click', function(){ act('emergency'); });
  el('auSabotage').addEventListener('click', function(){ el('auSabDialog').classList.add('on'); });
  el('auSabClose').addEventListener('click', function(){ el('auSabDialog').classList.remove('on'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-sab]'), function(button){
    button.addEventListener('click', function(){
      el('auSabDialog').classList.remove('on');
      act('sabotage', { kind: button.getAttribute('data-sab') });
    });
  });

  /* ---------------- task minigames ---------------- */
  var activeTask = null;
  var taskState = {};
  function openTask(task){
    activeTask = task;
    taskState = {};
    el('auTaskDialog').classList.add('on');
    renderTask();
  }
  function closeTask(){
    activeTask = null;
    el('auTaskDialog').classList.remove('on');
  }
  function completeTask(){
    if (!activeTask) return;
    var taskId = activeTask.id;
    closeTask();
    act('task', { taskId: taskId });
  }
  function renderTask(){
    var body = el('auTaskBody');
    if (!activeTask) return;
    if (activeTask.kind === 'wires') return renderWires(body);
    if (activeTask.kind === 'sequence') return renderSequence(body);
    if (activeTask.kind === 'hold') return renderHold(body);
    return renderUpload(body);
  }
  var WIRE_COLORS = ['#f2555a', '#57d0ff', '#f5c542', '#f07cd0'];
  function renderWires(body){
    if (!taskState.order) {
      taskState.order = [0, 1, 2, 3].sort(function(){ return Math.random() - 0.5; });
      taskState.linked = [];
      taskState.pick = null;
    }
    var right = taskState.order;
    var html = '<h2>' + esc(activeTask.label) + '</h2><p>وصّل كل سلك بلونه.</p><div class="wires" style="margin-top:12px"><div class="wire-col">';
    for (var i = 0; i < 4; i += 1) {
      html += '<div class="wire' + (taskState.linked.indexOf(i) >= 0 ? ' done' : '') + (taskState.pick === i ? ' pick' : '') + '" data-left="' + i + '" style="background:' + WIRE_COLORS[i] + '"></div>';
    }
    html += '</div><div class="wire-col">';
    for (var j = 0; j < 4; j += 1) {
      var colorIndex = right[j];
      html += '<div class="wire' + (taskState.linked.indexOf(colorIndex) >= 0 ? ' done' : '') + '" data-right="' + colorIndex + '" style="background:' + WIRE_COLORS[colorIndex] + '"></div>';
    }
    html += '</div></div><button class="btn block" id="auTaskCancel" style="margin-top:12px">إلغاء</button>';
    body.innerHTML = html;
    el('auTaskCancel').addEventListener('click', closeTask);
    Array.prototype.forEach.call(body.querySelectorAll('[data-left]'), function(node){
      node.addEventListener('click', function(){
        var index = Number(node.getAttribute('data-left'));
        if (taskState.linked.indexOf(index) >= 0) return;
        taskState.pick = index;
        renderTask();
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-right]'), function(node){
      node.addEventListener('click', function(){
        var index = Number(node.getAttribute('data-right'));
        if (taskState.pick == null || taskState.linked.indexOf(index) >= 0) return;
        if (taskState.pick !== index) { toast('السلك غلط'); taskState.pick = null; return renderTask(); }
        taskState.linked.push(index);
        taskState.pick = null;
        if (taskState.linked.length === 4) return completeTask();
        renderTask();
      });
    });
  }
  function renderSequence(body){
    if (!taskState.pattern) {
      taskState.pattern = [];
      for (var k = 0; k < 5; k += 1) taskState.pattern.push(Math.floor(Math.random() * 4));
      taskState.index = 0;
      taskState.lit = -1;
      taskState.playing = true;
      playPattern();
    }
    var html = '<h2>' + esc(activeTask.label) + '</h2><p>كرّر تسلسل الإشارات.</p><div class="seq" style="margin-top:12px">';
    for (var i = 0; i < 4; i += 1) {
      html += '<button data-seq="' + i + '" class="' + (taskState.lit === i ? 'lit' : '') + '">' + (i + 1) + '</button>';
    }
    html += '</div><p class="hint">' + (taskState.playing ? 'انتظر…' : 'دورك: ' + taskState.index + '/' + taskState.pattern.length) + '</p><button class="btn block" id="auTaskCancel">إلغاء</button>';
    body.innerHTML = html;
    el('auTaskCancel').addEventListener('click', closeTask);
    Array.prototype.forEach.call(body.querySelectorAll('[data-seq]'), function(node){
      node.addEventListener('click', function(){
        if (taskState.playing) return;
        var index = Number(node.getAttribute('data-seq'));
        if (taskState.pattern[taskState.index] !== index) { toast('تسلسل غلط — من البداية'); taskState.index = 0; return renderTask(); }
        taskState.index += 1;
        if (taskState.index >= taskState.pattern.length) return completeTask();
        renderTask();
      });
    });
  }
  function playPattern(){
    var step = 0;
    var timer = setInterval(function(){
      if (!activeTask || activeTask.kind !== 'sequence') { clearInterval(timer); return; }
      if (step >= taskState.pattern.length) {
        clearInterval(timer);
        taskState.playing = false;
        taskState.lit = -1;
        taskState.index = 0;
        renderTask();
        return;
      }
      taskState.lit = taskState.pattern[step];
      renderTask();
      setTimeout(function(){ taskState.lit = -1; if (activeTask) renderTask(); }, 320);
      step += 1;
    }, 620);
  }
  function renderHold(body){
    body.innerHTML = '<h2>' + esc(activeTask.label) + '</h2><p>اضغط وابقى ضاغط لين يكمل الشريط.</p>' +
      '<button class="hold-btn" id="auHold" style="margin-top:12px">اضغط واستمر</button>' +
      '<div class="hold-fill"><i id="auHoldFill"></i></div>' +
      '<button class="btn block" id="auTaskCancel" style="margin-top:12px">إلغاء</button>';
    el('auTaskCancel').addEventListener('click', function(){ stopHold(); closeTask(); });
    var holding = false;
    var value = 0;
    var timer = 0;
    var start = function(){
      holding = true;
      timer = setInterval(function(){
        if (!holding) return;
        value = Math.min(1, value + 0.03);
        el('auHoldFill').style.width = (value * 100) + '%';
        if (value >= 1) { stopHold(); completeTask(); }
      }, 60);
    };
    var stopHold = function(){ holding = false; clearInterval(timer); };
    var button = el('auHold');
    button.addEventListener('touchstart', function(e){ e.preventDefault(); start(); }, { passive:false });
    button.addEventListener('touchend', function(e){ e.preventDefault(); stopHold(); }, { passive:false });
    button.addEventListener('mousedown', start);
    window.addEventListener('mouseup', function(){ if (holding) stopHold(); });
    window.auStopHold = stopHold;
  }
  function renderUpload(body){
    if (taskState.count == null) taskState.count = 0;
    body.innerHTML = '<h2>' + esc(activeTask.label) + '</h2><p>اضغط ثلاث مرات لرفع البيانات.</p>' +
      '<div class="up-count" style="margin-top:10px">' + taskState.count + '/3</div>' +
      '<button class="btn primary block" id="auUpload" style="margin-top:12px">ارفع</button>' +
      '<button class="btn block" id="auTaskCancel" style="margin-top:8px">إلغاء</button>';
    el('auTaskCancel').addEventListener('click', closeTask);
    el('auUpload').addEventListener('click', function(){
      taskState.count += 1;
      if (taskState.count >= 3) return completeTask();
      renderTask();
    });
  }
  function stopHold(){ if (window.auStopHold) window.auStopHold(); }

  /* ---------------- meeting ---------------- */
  var lastMeetingEnd = 0;
  function renderMeeting(room){
    var dialog = el('auMeetingDialog');
    if (room.phase !== 'meeting' || !room.meeting) { dialog.classList.remove('on'); return; }
    dialog.classList.add('on');
    el('auMeetingTitle').textContent = room.meeting.reason === 'report' ? 'تبليغ عن جثة' : 'اجتماع طارئ';
    var me = room.players.filter(function(p){ return p.you; })[0];
    var list = el('auVoteList');
    var html = room.players.filter(function(p){ return p.alive; }).map(function(player){
      var color = colorHex(player.color);
      var voted = room.meeting.votes.filter(function(v){ return v.voter === player.name; }).length > 0;
      return '<div class="vote"><i style="background:' + color + ';width:16px;height:20px;border-radius:5px;display:block"></i><b>' +
        esc(player.name) + '</b>' + (player.token === 'you' ? ' <span class="tag">أنت</span>' : '') +
        (voted ? ' <span class="tag bot">صوّت</span>' : '') +
        (player.token === 'you' ? '' : '<button class="btn" data-vote="' + player.token + '">تصويت</button>') + '</div>';
    }).join('');
    list.innerHTML = html;
    Array.prototype.forEach.call(list.querySelectorAll('[data-vote]'), function(button){
      button.addEventListener('click', function(){
        act('vote', { target: button.getAttribute('data-vote') }).then(function(){
          dialog.classList.remove('on');
        });
      });
    });
    el('auSkipVote').onclick = function(){ act('vote', { target: 'skip' }).then(function(){ dialog.classList.remove('on'); }); };
    var seconds = Math.max(0, Math.ceil((room.meeting.endsAt - room.now) / 1000));
    el('auMeetingTimer').textContent = seconds + ' ثانية';
    if (me && me.votedFor) el('auSkipVote').disabled = true; else el('auSkipVote').disabled = false;
  }

  /* ---------------- end ---------------- */
  function renderEnd(room){
    var dialog = el('auEndDialog');
    if (room.phase !== 'ended') { dialog.classList.remove('on'); return; }
    dialog.classList.add('on');
    var crewWin = room.winner === 'crew';
    el('auEndTitle').textContent = crewWin ? 'فاز الطاقم' : 'فاز المزوّرون';
    el('auEndTitle').className = crewWin ? 'win-crew' : 'win-imp';
    el('auEndReason').textContent = room.endReason || '';
    el('auEndList').innerHTML = room.players.map(function(player){
      var role = player.role === 'impostor' ? 'مزوّر' : 'طاقم';
      return '<div class="who"><i style="background:' + colorHex(player.color) + '"></i><b>' + esc(player.name) + '</b>' +
        '<small>' + role + (player.alive ? '' : ' — ميت') + '</small></div>';
    }).join('');
    var you = room.players.filter(function(p){ return p.you; })[0];
    el('auBackLobby').hidden = !(you && you.isHost);
  }

  // Read-only hook for the DOM tests and for debugging in Telegram.
  window.__auState = AU;

  /* ---------------- boot ---------------- */
  resize();
  var params = new URLSearchParams(location.search);
  var sharedCode = (params.get('code') || '').toUpperCase();
  if (sharedCode) {
    el('auCode').value = sharedCode;
    AU.code = sharedCode;
  }
  if (AU.code) {
    poll();
  }
  window.addEventListener('beforeunload', function(){
    if (AU.code && AU.token && navigator.sendBeacon) {
      navigator.sendBeacon('/api/amongus/rooms/' + AU.code, new Blob([JSON.stringify({ action:'leave', token: AU.token, code: AU.code })], { type:'application/json' }));
    }
  });
})();
</script>
</body>
</html>`;
}
