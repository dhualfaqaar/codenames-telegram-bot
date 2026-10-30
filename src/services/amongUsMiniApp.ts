import { AU_COLORS, AU_MAP } from './amongUsRooms';

/**
 * امونق اس — the standalone Among Us mini app.
 *
 * The whole screen is dressed like the original game: a star field, the slanted
 * wordmark, chunky bevelled buttons, beans with visors in the lobby, a ship seen
 * from above with a joystick, and the meeting / ejection flow. One document, so
 * the worker can serve it at /amongus.
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
<meta name="theme-color" content="#0a0e1f">
<title>امونق اس</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{
  color-scheme:dark;
  --space:#070a16;
  --space2:#0d1428;
  --panel:#16213f;
  --panel2:#1f2c4f;
  --line:#39496b;
  --ink:#f2f7ff;
  --muted:#9fb0cf;
  --cream:#d7e6f2;
  --cream2:#a9c2d8;
  --red:#e03a3a;
  --green:#3fc46b;
  --blue:#3f8fe0;
  --gold:#f0c14b;
  --shadow:#08101f;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;min-height:100%;background:var(--space);color:var(--ink);
  font:15px/1.45 "Trebuchet MS",system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;
  font-weight:700;overflow-x:hidden}
body{padding:env(safe-area-inset-top) 12px calc(12px + env(safe-area-inset-bottom))}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
.screen{display:none}
.screen.on{display:block}
.sheet{position:relative;z-index:2;width:min(100%,520px);margin:0 auto}
/* ---- the original chunky button ---- */
.btn{
  position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;
  min-height:58px;padding:0 22px;border-radius:16px;
  background:linear-gradient(180deg,#e8f2fa 0%,#c3d6e6 48%,#a7bed4 100%);
  border:4px solid #0d1830;color:#122036;
  font-size:17px;font-weight:900;letter-spacing:.2px;
  box-shadow:0 6px 0 #0a1220,inset 0 2px 0 #ffffffcc,inset 0 -4px 0 #8fa9c1;
  transform:skewX(-4deg);transition:transform .08s,box-shadow .08s;
}
.btn>*{transform:skewX(4deg)}
.btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.btn:active{transform:skewX(-4deg) translateY(4px);box-shadow:0 2px 0 #0a1220,inset 0 2px 0 #ffffffaa}
.btn.block{width:100%}
.btn.red{background:linear-gradient(180deg,#f27a7a,#d83a3a 50%,#a82424);border-color:#3a0d0d;color:#fff;box-shadow:0 6px 0 #4a0f0f,inset 0 2px 0 #ffb3b3,inset 0 -4px 0 #8b1a1a}
.btn.green{background:linear-gradient(180deg,#8ef0b0,#3fc46b 50%,#26904c);border-color:#0c2e1b;color:#06240f;box-shadow:0 6px 0 #0a2a18,inset 0 2px 0 #d3ffe2,inset 0 -4px 0 #1c7a3e}
.btn.dark{background:linear-gradient(180deg,#2b3c63,#1b2745 60%,#131c33);border-color:#0a1220;color:#dfeaff;box-shadow:0 6px 0 #08101c,inset 0 2px 0 #4c6296,inset 0 -4px 0 #101a2e}
.btn[disabled]{filter:grayscale(.5) brightness(.72);pointer-events:none}
/* ---- entry ---- */
#auEntry{min-height:calc(100dvh - 24px);display:none}
#auEntry.on{display:grid;place-items:center}
#auStars{position:fixed;inset:0;z-index:0;background:
  radial-gradient(1200px 600px at 50% -10%,#172a52 0%,#0a0e1f 55%,#05070f 100%)}
#auStars i{position:absolute;border-radius:50%;background:#dce9ff;opacity:.85;animation:twinkle 3.4s infinite ease-in-out}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(.8)}50%{opacity:.95;transform:scale(1.15)}}
.logo{position:relative;text-align:center;margin:0 0 6px}
.logo h1{
  margin:0;font-size:clamp(34px,11vw,54px);line-height:.98;font-weight:900;
  letter-spacing:1px;color:#fff;transform:skewX(-9deg);text-transform:uppercase;
  text-shadow:0 3px 0 #0b1220,0 6px 0 #05070f,0 0 26px #3f8fe066;
}
.logo h1 b{display:block;font-size:.62em;color:#a9c7e8;text-shadow:0 2px 0 #0b1220}
.logo p{margin:10px 0 0;color:#9fb0cf;font-size:12px;letter-spacing:.6px}
.mascot{margin:8px auto 4px;width:min(46vw,190px);filter:drop-shadow(0 14px 22px #000a)}
.card{
  position:relative;z-index:2;margin:14px 0;padding:16px;border-radius:22px;
  background:linear-gradient(180deg,#1b2745,#121a30);
  border:3px solid #33456b;box-shadow:0 10px 0 #060b16,inset 0 2px 0 #ffffff14
}
.field{display:block;margin:0 0 12px}
.field span{display:block;margin:0 0 6px;font-size:11px;color:#9fb0cf;letter-spacing:.4px}
input{
  width:100%;padding:14px 14px;border-radius:14px;border:3px solid #33456b;
  background:#0b1220;color:#eef6ff;font:inherit;font-weight:800;outline:none;
}
input:focus{border-color:#6fa8de;box-shadow:0 0 0 3px #6fa8de33}
input::placeholder{color:#5f7292}
/* ---- lobby: the waiting room ---- */
#auLobby{min-height:calc(100dvh - 24px);display:none}
#auLobby.on{display:block}
.room{
  position:relative;margin:12px 0;padding:16px;border-radius:22px;
  background:
    linear-gradient(180deg,#152a4d 0%,#0f2038 60%,#0a1526 100%);
  border:3px solid #33456b;box-shadow:0 10px 0 #060b16,inset 0 2px 0 #ffffff10;
  overflow:hidden;
}
.room:before{content:"";position:absolute;inset:auto 0 0;height:58%;background:
  repeating-linear-gradient(90deg,#0d1b30 0 26px,#102138 26px 52px);opacity:.55}
.room:after{content:"";position:absolute;left:50%;top:8px;transform:translateX(-50%);
  width:70%;height:3px;border-radius:9px;background:#2c3f63}
.code-row{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:10px;margin:2px 0 12px}
.code-row span{font-size:11px;color:#9fb0cf;letter-spacing:.5px}
.code{
  font-size:26px;font-weight:900;letter-spacing:6px;color:#fff;
  padding:6px 14px;border-radius:12px;background:#0b1220;border:3px solid #33456b;
  text-shadow:0 2px 0 #0a1220
}
.names{position:relative;z-index:2;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:6px 0 14px}
.who{
  display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:16px;
  background:linear-gradient(180deg,#1d2b4b,#152039);border:2px solid #33456b;min-width:0
}
.who svg{width:26px;height:32px;flex:none;filter:drop-shadow(0 3px 0 #0004)}
.who b{font-size:12px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.who em{margin-inline-start:auto;font-style:normal;font-size:9px;padding:2px 6px;border-radius:99px;background:#2a3c60;color:#c3d6ee;flex:none}
.who.host em{background:#2f5a3a;color:#b8f0c8}
.who.bot em{background:#4a3a5e;color:#dcc3f0}
.waiting{position:relative;z-index:2;text-align:center;color:#9fb0cf;font-size:12px;margin:0 0 12px;letter-spacing:.4px}
.waiting i{display:inline-block;animation:dots 1.4s infinite}
@keyframes dots{0%,100%{opacity:.2}50%{opacity:1}}
/* ---- game stage ---- */
#auStage{position:fixed;inset:0;display:none;background:#05070f}
#auStage.on{display:block}
#auCanvas{display:block;width:100%;height:100%;touch-action:none}
.hud{position:absolute;inset:0;pointer-events:none;z-index:3}
.hud>*{pointer-events:auto}
.hud-top{position:absolute;top:calc(8px + env(safe-area-inset-top));left:10px;right:10px;display:flex;align-items:center;gap:8px}
.badge{
  display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:12px;
  background:#0a1220e0;border:2px solid #33456b;font-size:11px;font-weight:900;color:#dfeaff;
  box-shadow:0 3px 0 #05070f
}
.badge svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.badge.imp{background:#3a0d0d;border-color:#e03a3a;color:#ffd9d9}
.tasks{flex:1;display:flex;flex-direction:column;gap:3px}
.tasks small{font-size:9px;color:#9fb0cf;letter-spacing:.5px}
.bar{height:11px;border-radius:99px;background:#0a1220;border:2px solid #33456b;overflow:hidden;box-shadow:0 2px 0 #05070f}
.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3fc46b,#8ef0b0);transition:width .35s}
#auAlarm{
  position:absolute;top:calc(56px + env(safe-area-inset-top));left:10px;right:10px;display:none;
  padding:9px 12px;border-radius:12px;background:#5c0d16f0;border:2px solid #ff5f70;
  font-size:12px;font-weight:900;text-align:center;color:#ffe3e6;animation:pulse 1s infinite
}
#auAlarm.on{display:block}
@keyframes pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}
/* joystick + action buttons, laid out like the original */
.pad{
  position:absolute;left:16px;bottom:calc(18px + env(safe-area-inset-bottom));
  width:138px;height:138px;border-radius:50%;
  background:radial-gradient(circle at 50% 45%,#1a2745cc,#0a1220cc);
  border:3px solid #2f4166;box-shadow:0 8px 0 #05070f55
}
.pad i{
  position:absolute;width:62px;height:62px;left:35px;top:35px;border-radius:50%;
  background:radial-gradient(circle at 40% 35%,#9ec4e8,#5b86b8);
  border:3px solid #0d1830;box-shadow:0 5px 0 #0a1220
}
.acts{
  position:absolute;right:14px;bottom:calc(18px + env(safe-area-inset-bottom));
  display:grid;grid-template-columns:repeat(2,74px);gap:12px;justify-items:center;
}
.act{
  position:relative;width:74px;height:74px;border-radius:50%;
  background:radial-gradient(circle at 42% 34%,#3b4f78,#1a2745);
  border:3px solid #0d1830;color:#9fb0cf;display:grid;place-items:center;
  box-shadow:0 6px 0 #05070f;transition:transform .08s,box-shadow .08s
}
.act svg{width:32px;height:32px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.act small{position:absolute;bottom:-15px;font-size:9px;color:#9fb0cf;white-space:nowrap;font-weight:900}
.act:active{transform:translateY(4px);box-shadow:0 2px 0 #05070f}
.act[hidden]{display:none}
.act.ready{color:#fff;background:radial-gradient(circle at 42% 34%,#63a8e8,#2f6fb8);border-color:#0d1830;box-shadow:0 6px 0 #0a2540,0 0 0 3px #63a8e855}
.act.use.ready{background:radial-gradient(circle at 42% 34%,#8ef0b0,#2f9d5c);box-shadow:0 6px 0 #0c331d,0 0 0 3px #8ef0b055}
.act.kill.ready{background:radial-gradient(circle at 42% 34%,#ff7b7b,#c01d1d);box-shadow:0 6px 0 #46090a,0 0 0 3px #ff7b7b55}
.act.report.ready{background:radial-gradient(circle at 42% 34%,#ffd97a,#c9931d);color:#2a1c00;box-shadow:0 6px 0 #45300a,0 0 0 3px #ffd97a55}
.act.vent.ready{background:radial-gradient(circle at 42% 34%,#c39bff,#6d3fc4);box-shadow:0 6px 0 #2a1250,0 0 0 3px #c39bff55}
.act .cd{position:absolute;inset:0;border-radius:50%;background:#05070fcc;display:grid;place-items:center;font-size:17px;font-weight:900;color:#fff}
/* ---- overlays ---- */
.overlay{
  position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;
  padding:16px;background:#04060ff2;
}
.overlay.on{display:flex}
.dialog{
  width:min(100%,470px);max-height:88dvh;overflow:auto;padding:18px;border-radius:22px;
  background:linear-gradient(180deg,#1b2745,#0f1729);border:3px solid #33456b;
  box-shadow:0 12px 0 #05070f,inset 0 2px 0 #ffffff12
}
.dialog h2{margin:0 0 4px;font-size:19px;font-weight:900;letter-spacing:.2px}
.dialog p{margin:0 0 12px;color:#9fb0cf;font-size:12px}
.list{display:grid;gap:9px;margin:12px 0}
.vote{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:15px;background:#101a30;border:2px solid #2c3d5e}
.vote svg{width:24px;height:30px;flex:none;filter:drop-shadow(0 3px 0 #0004)}
.vote b{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vote .btn{min-height:38px;padding:0 14px;font-size:12px;margin-inline-start:auto;border-width:3px;border-radius:11px}
.vote .tag{margin-inline-start:6px;font-size:9px;padding:2px 6px;border-radius:99px;background:#2a3c60;color:#c3d6ee}
.timer{font-variant-numeric:tabular-nums;font-weight:900;color:var(--gold)}
/* task minigames */
.wires{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.wire-col{display:grid;gap:10px}
.wire{height:38px;border-radius:10px;border:3px solid #0a1220;cursor:pointer;box-shadow:inset 0 2px 0 #ffffff33}
.wire.done{opacity:.28}
.wire.pick{outline:3px solid #fff;outline-offset:2px}
.seq{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.seq button{
  height:66px;border-radius:16px;background:linear-gradient(180deg,#2b3c63,#1b2745);
  border:3px solid #0d1830;font-size:24px;font-weight:900;color:#dfeaff;box-shadow:0 5px 0 #05070f
}
.seq button.lit{background:linear-gradient(180deg,#8ef0b0,#2f9d5c);color:#04240f;box-shadow:0 5px 0 #0c331d,0 0 22px #8ef0b0aa}
.hold-btn{
  width:100%;height:80px;border-radius:18px;font-size:16px;font-weight:900;
  background:linear-gradient(180deg,#8ef0b0,#2f9d5c);border:4px solid #0c331d;color:#06240f;
  box-shadow:0 6px 0 #0a2a18,inset 0 2px 0 #d3ffe2
}
.hold-fill{height:14px;border-radius:99px;background:#0a1220;border:2px solid #33456b;overflow:hidden;margin-top:12px}
.hold-fill i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3fc46b,#8ef0b0);transition:width .08s}
.up-count{font-size:44px;font-weight:900;text-align:center;color:#8ef0b0;text-shadow:0 3px 0 #0a1220}
.hint{font-size:11px;color:#8095b6;text-align:center;margin-top:10px}
/* ---- ejection + end ---- */
.eject{text-align:center}
.eject .bean{width:min(52vw,230px);margin:6px auto 10px;filter:drop-shadow(0 14px 20px #000a)}
.eject strong{display:block;font-size:22px;font-weight:900;line-height:1.25;margin:4px 0 6px}
.eject .sub{color:#9fb0cf;font-size:12px;margin:0 0 8px}
.eject .impostor-left{display:inline-block;padding:5px 12px;border-radius:99px;background:#0a1220;border:2px solid #33456b;font-size:11px;color:#c3d6ee;margin-top:4px}
.win-crew{color:#8ef0b0}.win-imp{color:#ff8f8f}
/* ---- toast ---- */
#auToast{
  position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(18px);
  z-index:60;padding:11px 18px;border-radius:14px;background:#0a1220ee;border:2px solid #33456b;
  font-size:12.5px;font-weight:900;opacity:0;transition:.2s;pointer-events:none;max-width:86vw;text-align:center;
  box-shadow:0 6px 0 #05070f
}
#auToast.on{opacity:1;transform:translateX(-50%) translateY(0)}
@media(max-height:640px){
  .act{width:64px;height:64px}.acts{grid-template-columns:repeat(2,64px);gap:10px}
  .pad{width:120px;height:120px}.pad i{width:54px;height:54px;left:30px;top:30px}
}
</style>
</head>
<body>
<div id="auStars" aria-hidden="true"></div>
<div id="auToast"></div>

<section id="auEntry" class="screen on">
  <div class="sheet">
    <div class="logo">
      <h1>AMONG<b>US</b></h1>
      <p>امونق اس — طاقم ضد مزوّر</p>
    </div>
    <div class="mascot" id="auMascot" aria-hidden="true"></div>
    <div class="card">
      <label class="field"><span>اسم اللاعب</span><input id="auName" maxlength="18" placeholder="اكتب اسمك"></label>
      <button class="btn block green" id="auCreate"><span>أنشئ غرفة</span></button>
      <div style="height:12px"></div>
      <label class="field"><span>كود الغرفة</span><input id="auCode" maxlength="6" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:5px;text-align:center;font-size:20px"></label>
      <button class="btn block" id="auJoin"><span>انضم للغرفة</span></button>
      <p class="hint">من 6 إلى 10 لاعبين — واحد أو اثنين منهم مزوّرين</p>
    </div>
  </div>
</section>

<section id="auLobby" class="screen">
  <div class="sheet">
    <div class="logo" style="margin-top:8px"><h1 style="font-size:clamp(24px,7vw,34px)">غرفة الانتظار</h1></div>
    <div class="room">
      <div class="code-row"><span>كود الغرفة</span><b class="code" id="auCodeLabel">------</b></div>
      <div class="names" id="auNames"></div>
      <p class="waiting"><span id="auCount">0</span>/10 لاعبين <i id="auDots">…</i></p>
      <div class="row" style="display:flex;gap:10px;margin-bottom:10px">
        <button class="btn dark" id="auAddBot" style="flex:1;min-height:50px;font-size:14px"><span>أضف بوت</span></button>
        <button class="btn dark" id="auKickBot" style="flex:1;min-height:50px;font-size:14px"><span>احذف بوت</span></button>
      </div>
      <button class="btn block green" id="auStart"><span>ابدأ المباراة</span></button>
      <p class="hint" id="auLobbyHint"></p>
    </div>
  </div>
</section>

<section id="auStage">
  <canvas id="auCanvas"></canvas>
  <div class="hud">
    <div class="hud-top">
      <span class="badge" id="auRoleChip">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>
        <span id="auRoleText">—</span>
      </span>
      <div class="tasks">
        <small>المهام</small>
        <div class="bar"><i id="auProgress"></i></div>
      </div>
      <span class="badge" id="auTaskChip">0/0</span>
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
    <p>المفاعل والأوكسجين ينهون المباراة إذا ما تصلّحوا بوقتهم.</p>
    <div class="list">
      <button class="btn red block" data-sab="reactor"><span>المفاعل (45 ثانية)</span></button>
      <button class="btn red block" data-sab="oxygen"><span>الأوكسجين (45 ثانية)</span></button>
      <button class="btn dark block" data-sab="lights"><span>إطفاء الإنارة</span></button>
      <button class="btn dark block" data-sab="comms"><span>تعطيل الاتصالات</span></button>
    </div>
    <button class="btn block" id="auSabClose"><span>إغلاق</span></button>
  </div>
</div>

<div class="overlay" id="auMeetingDialog">
  <div class="dialog">
    <h2 id="auMeetingTitle">اجتماع طارئ</h2>
    <p id="auMeetingSub">صوّت لطرد المزوّر — أو تخطَّ التصويت.</p>
    <div class="list" id="auVoteList"></div>
    <button class="btn block" id="auSkipVote"><span>تخطي التصويت</span></button>
    <p class="hint">الوقت المتبقي: <span class="timer" id="auMeetingTimer">0</span></p>
  </div>
</div>

<div class="overlay" id="auEndDialog">
  <div class="dialog eject">
    <div class="bean" id="auEndBean"></div>
    <strong id="auEndTitle">—</strong>
    <p class="sub" id="auEndReason"></p>
    <span class="impostor-left" id="auEndImpostors"></span>
    <div class="list" id="auEndList" style="margin-top:14px"></div>
    <button class="btn block green" id="auBackLobby"><span>ارجع لغرفة الانتظار</span></button>
  </div>
</div>

<script>
(function(){
  var CFG = ${config};
  var AU = { code:'', token:'', room:null, busy:false };

  /* ---------- drawn crewmate (no emoji anywhere) ---------- */
  function crewSvg(colorId, extra){
    var hex = '#8899aa';
    for (var i = 0; i < CFG.colors.length; i += 1) if (CFG.colors[i].id === colorId) hex = CFG.colors[i].hex;
    var dark = shade(hex, -0.32);
    return '<svg viewBox="0 0 64 80" aria-hidden="true">' +
      '<rect x="2" y="26" width="15" height="24" rx="7" fill="' + dark + '"/>' +
      '<path d="M20 4h20a15 15 0 0 1 15 15v20a11 11 0 0 1-11 11h-4v15a7 7 0 0 1-14 0V50h-6A15 15 0 0 1 5 35V19A15 15 0 0 1 20 4z" fill="' + hex + '"/>' +
      '<ellipse cx="39" cy="25" rx="15" ry="11" fill="#a9e3f5"/>' +
      '<ellipse cx="39" cy="25" rx="15" ry="11" fill="none" stroke="' + shade(hex, -0.5) + '" stroke-width="2.4"/>' +
      '<ellipse cx="44" cy="21" rx="5" ry="3.4" fill="#f2fdff"/>' +
      '<path d="M17 56h12" stroke="' + shade(hex, -0.5) + '" stroke-width="3" stroke-linecap="round"/>' +
      (extra || '') + '</svg>';
  }
  function shade(hex, amount){
    var value = String(hex || '#8899aa').replace('#', '');
    if (value.length === 3) value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    var num = parseInt(value, 16);
    var r = Math.max(0, Math.min(255, ((num >> 16) & 255) + Math.round(255 * amount)));
    var g = Math.max(0, Math.min(255, ((num >> 8) & 255) + Math.round(255 * amount)));
    var b = Math.max(0, Math.min(255, (num & 255) + Math.round(255 * amount)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ---------- stars ---------- */
  (function stars(){
    var box = document.getElementById('auStars');
    if (!box) return;
    var html = '';
    for (var i = 0; i < 70; i += 1) {
      var size = (Math.random() * 2.2 + 0.9).toFixed(1);
      html += '<i style="left:' + (Math.random() * 100).toFixed(2) + '%;top:' + (Math.random() * 100).toFixed(2) +
        '%;width:' + size + 'px;height:' + size + 'px;animation-delay:' + (Math.random() * 3).toFixed(2) + 's"></i>';
    }
    box.innerHTML = html;
  })();
  (function mascot(){
    var box = document.getElementById('auMascot');
    if (!box) return;
    box.innerHTML = '<svg viewBox="0 0 200 220" aria-hidden="true">' +
      '<ellipse cx="100" cy="206" rx="58" ry="10" fill="#04060f" opacity=".55"/>' +
      '<rect x="6" y="86" width="42" height="64" rx="20" fill="#8f1b1b"/>' +
      '<path d="M62 12h70a50 50 0 0 1 50 50v62a34 34 0 0 1-34 34h-14v40a22 22 0 0 1-44 0v-40H96a50 50 0 0 1-50-50V62A50 50 0 0 1 62 12z" fill="#c51111"/>' +
      '<ellipse cx="128" cy="80" rx="46" ry="33" fill="#a9e3f5"/>' +
      '<ellipse cx="128" cy="80" rx="46" ry="33" fill="none" stroke="#7a0f0f" stroke-width="7"/>' +
      '<ellipse cx="143" cy="68" rx="15" ry="10" fill="#f2fdff"/>' +
      '<path d="M86 168h36" stroke="#7a0f0f" stroke-width="9" stroke-linecap="round"/>' +
      '</svg>';
  })();

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
    if (window.Telegram && Telegram.WebApp && name === 'auStage') {
      try { Telegram.WebApp.expand && Telegram.WebApp.expand(); } catch (e) {}
    }
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
    var raw = (el('auName').value || '').trim();
    if (!raw) {
      try { raw = (Telegram.WebApp.initDataUnsafe.user.username || Telegram.WebApp.initDataUnsafe.user.first_name || '').slice(0, 18); } catch (e) {}
    }
    AU.name = raw || 'لاعب';
    try { localStorage.setItem('au-name', AU.name); } catch (e) {}
    return AU.name;
  }
  try { el('auName').value = localStorage.getItem('au-name') || ''; } catch (e) {}

  /* ---------- lobby ---------- */
  function renderLobby(room){
    el('auCodeLabel').textContent = room.code;
    el('auCount').textContent = String(room.players.length);
    el('auNames').innerHTML = room.players.map(function(p){
      var tag = p.isHost ? 'مضيف' : (p.bot ? 'بوت' : '');
      var klass = p.isHost ? ' host' : (p.bot ? ' bot' : '');
      return '<div class="who' + klass + '">' + crewSvg(p.color) + '<b>' + esc(p.name) + '</b>' +
        (tag ? '<em>' + tag + '</em>' : '') + '</div>';
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
    api('/rooms', { action:'create', name: readName() }).then(function(res){
      if (!res.ok) return toast(res.error || 'تعذّر إنشاء الغرفة');
      AU.code = res.code; AU.token = res.token;
      history.replaceState(null, '', '?code=' + res.code);
      applyRoom(res.room);
    });
  });
  el('auJoin').addEventListener('click', function(){
    var code = (el('auCode').value || '').trim().toUpperCase();
    if (code.length < 4) return toast('اكتب كود الغرفة');
    api('/rooms/' + code, { action:'join', name: readName(), code:code }).then(function(res){
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
    act('start').then(function(res){ if (res && res.ok) setScreen('auStage'); });
  });
  el('auBackLobby').addEventListener('click', function(){
    el('auEndDialog').classList.remove('on');
    act('lobby');
  });

  /* ---------- polling ---------- */
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

  /* ---------- canvas world ---------- */
  var world = { x: 50, y: 17, ready:false, vx:0, vy:0, lastSent:0 };
  var canvas = el('auCanvas');
  var ctx = canvas.getContext('2d');
  var size = { w:0, h:0, scale:1, ox:0, oy:0 };
  function resize(){
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    size.w = canvas.clientWidth || window.innerWidth;
    size.h = canvas.clientHeight || window.innerHeight;
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
    for (var i = 0; i < CFG.colors.length; i += 1) if (CFG.colors[i].id === id) return CFG.colors[i].hex;
    return '#8899aa';
  }
  function roundRect(x, y, w, h, r){
    var radius = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, radius); return; }
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  /** The bean, drawn exactly like the game: backpack, body, visor, highlight. */
  function drawBean(px, py, unit, hex, dead, name, isYou){
    var u = unit;
    ctx.save();
    ctx.translate(px, py);
    ctx.globalAlpha = dead ? 0.42 : 1;
    // shadow
    ctx.fillStyle = '#04060f66';
    ctx.beginPath();
    ctx.ellipse(0, u * 1.05, u * 0.95, u * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // backpack
    ctx.fillStyle = shade(hex, -0.34);
    roundRect(-u * 1.05, -u * 0.35, u * 0.5, u * 0.85, u * 0.22);
    ctx.fill();
    // body
    ctx.fillStyle = hex;
    roundRect(-u * 0.72, -u * 1.15, u * 1.6, u * 1.95, u * 0.62);
    ctx.fill();
    // legs
    ctx.fillStyle = shade(hex, -0.12);
    roundRect(-u * 0.62, u * 0.35, u * 0.55, u * 0.62, u * 0.24);
    ctx.fill();
    roundRect(u * 0.12, u * 0.35, u * 0.55, u * 0.62, u * 0.24);
    ctx.fill();
    // visor
    ctx.fillStyle = '#a9e3f5';
    ctx.beginPath();
    ctx.ellipse(u * 0.34, -u * 0.55, u * 0.62, u * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(hex, -0.5);
    ctx.lineWidth = Math.max(1, u * 0.09);
    ctx.stroke();
    ctx.fillStyle = '#f2fdff';
    ctx.beginPath();
    ctx.ellipse(u * 0.5, -u * 0.66, u * 0.2, u * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (name) {
      ctx.save();
      ctx.globalAlpha = dead ? 0.5 : 1;
      ctx.fillStyle = isYou ? '#ffffff' : '#cfe0f2';
      ctx.font = '900 ' + Math.max(8, size.scale * 1.35) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = '#04060f';
      ctx.shadowBlur = 4;
      ctx.fillText(name, px, py - u * 1.5);
      ctx.restore();
    }
  }

  function draw(){
    requestAnimationFrame(draw);
    if (!AU.room || AU.room.phase === 'lobby') return;
    if (!size.w) resize();
    var room = AU.room;
    ctx.clearRect(0, 0, size.w, size.h);
    // hull / void
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, size.w, size.h);

    // corridors first (the floor of the ship)
    CFG.map.corridors.forEach(function(hall){
      var p = toScreen(hall.x, hall.y);
      ctx.fillStyle = '#243352';
      roundRect(p.x, p.y, hall.w * size.scale, hall.h * size.scale, size.scale * 0.8);
      ctx.fill();
      ctx.strokeStyle = '#111a2e';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    CFG.map.rooms.forEach(function(def){
      var p = toScreen(def.x, def.y);
      var w = def.w * size.scale;
      var h = def.h * size.scale;
      // floor
      ctx.fillStyle = '#2c3d60';
      roundRect(p.x, p.y, w, h, size.scale * 1.2);
      ctx.fill();
      // inner floor shade, like the game's tiled rooms
      ctx.fillStyle = '#354970';
      roundRect(p.x + 3, p.y + 3, w - 6, h - 6, size.scale * 1.1);
      ctx.fill();
      // thick wall
      ctx.strokeStyle = '#0f1728';
      ctx.lineWidth = Math.max(2, size.scale * 0.55);
      roundRect(p.x, p.y, w, h, size.scale * 1.2);
      ctx.stroke();
      // label
      ctx.fillStyle = '#a8bcd8';
      ctx.font = '900 ' + Math.max(8, size.scale * 1.45) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(def.name, p.x + w / 2, p.y + size.scale * 0.9);
    });

    var me = room.players.filter(function(p){ return p.you; })[0];

    // own unfinished tasks
    if (me && me.role === 'crew' && me.alive) {
      me.tasks.forEach(function(task){
        if (task.done) return;
        var station = null;
        for (var i = 0; i < CFG.map.stations.length; i += 1) if (CFG.map.stations[i].id === task.station) station = CFG.map.stations[i];
        if (!station) return;
        var sp = toScreen(station.x, station.y);
        var r = Math.max(4, size.scale * 1.05);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#f0c14b';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0f1728';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = '#0f1728';
        ctx.fill();
      });
    }

    // sabotage points stay visible so the crew knows where to run
    if (room.sabotage) {
      var sabPoint = room.sabotage.kind === 'reactor' ? { x: 13, y: 68 }
        : room.sabotage.kind === 'oxygen' ? { x: 85, y: 42 }
        : room.sabotage.kind === 'lights' ? { x: 24, y: 49.5 } : { x: 88, y: 68 };
      var ssp = toScreen(sabPoint.x, sabPoint.y);
      ctx.beginPath();
      ctx.arc(ssp.x, ssp.y, size.scale * 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff5f70';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // bodies
    (room.bodies || []).forEach(function(body){
      var pos = toScreen(body.x, body.y);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(1.35);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = colorHex(body.color);
      roundRect(-size.scale * 1.4, -size.scale * 0.9, size.scale * 2.8, size.scale * 1.8, size.scale * 0.7);
      ctx.fill();
      ctx.strokeStyle = '#0f1728';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      // bone marker
      ctx.fillStyle = '#e8eefc';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - size.scale * 1.9, size.scale * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });

    // other players
    room.players.forEach(function(player){
      if (player.token === 'you') return;
      var pos = toScreen(player.x, player.y);
      drawBean(pos.x, pos.y, size.scale * 1.75, colorHex(player.color), !player.alive, player.name, false);
    });

    // you last, on top
    if (me) {
      var own = toScreen(world.x, world.y);
      drawBean(own.x, own.y, size.scale * 1.9, colorHex(me.color), !me.alive, me.name, true);
    }

    // vision cone: the original's darkness around the player
    if (me) {
      var vp = toScreen(world.x, world.y);
      var lightsOut = room.sabotage && room.sabotage.kind === 'lights';
      var radius = size.scale * (me.alive ? (lightsOut ? 13 : (me.role === 'impostor' ? 34 : 27)) : 34);
      var grd = ctx.createRadialGradient(vp.x, vp.y, radius * 0.5, vp.x, vp.y, radius);
      grd.addColorStop(0, 'rgba(3,5,12,0)');
      grd.addColorStop(1, 'rgba(3,5,12,0.94)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size.w, size.h);
    }
    if (room.sabotage && room.sabotage.kind === 'lights') {
      ctx.fillStyle = 'rgba(2,4,10,0.3)';
      ctx.fillRect(0, 0, size.w, size.h);
    }
  }
  requestAnimationFrame(draw);

  /* ---------- joystick + keys ---------- */
  var stick = el('auStick');
  var pad = el('auPad');
  var dragging = false;
  var padCenter = { x:0, y:0 };
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
    var limit = 46;
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

  /* ---------- hud + controls ---------- */
  function nearestStation(me){
    var best = null;
    me.tasks.forEach(function(task){
      if (task.done) return;
      var station = null;
      for (var i = 0; i < CFG.map.stations.length; i += 1) if (CFG.map.stations[i].id === task.station) station = CFG.map.stations[i];
      if (!station) return;
      var d = Math.hypot(station.x - world.x, station.y - world.y);
      if (d < 7 && (!best || d < best.d)) best = { task: task, station: station, d: d };
    });
    return best;
  }
  function nearestTarget(){
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
      ? (room.winner === 'crew' ? 'الطاقم فاز' : 'المزوّرون فازوا')
      : (me.role === 'impostor' ? 'مزوّر' : 'طاقم');
    el('auRoleChip').classList.toggle('imp', me.role === 'impostor');
    var progress = room.progress.total ? Math.round((room.progress.done / room.progress.total) * 100) : 0;
    el('auProgress').style.width = progress + '%';
    el('auTaskChip').textContent = room.progress.done + '/' + room.progress.total;

    el('auKill').hidden = me.role !== 'impostor';
    el('auVent').hidden = me.role !== 'impostor';
    el('auSabotage').hidden = me.role !== 'impostor';
    el('auReport').hidden = false;

    var station = nearestStation(me);
    el('auUse').classList.toggle('ready', !!station && room.phase === 'playing' && me.alive);
    var target = nearestTarget();
    el('auKill').classList.toggle('ready', me.role === 'impostor' && !!target && room.killCooldownLeftMs === 0 && room.phase === 'playing');

    var cd = el('auKill').querySelector('.cd');
    if (me.role === 'impostor' && room.killCooldownLeftMs > 0) {
      if (!cd) { cd = document.createElement('span'); cd.className = 'cd'; el('auKill').appendChild(cd); }
      cd.textContent = String(Math.ceil(room.killCooldownLeftMs / 1000));
    } else if (cd) { cd.remove(); }

    el('auReport').classList.toggle('ready', !!nearestBody());
    el('auVent').classList.toggle('ready', nearVent());
    el('auEmergency').classList.toggle('ready', nearEmergency() && !me.emergencyUsed);

    var alarm = el('auAlarm');
    if (room.sabotage) {
      var left = room.sabotage.endsAt ? Math.max(0, Math.ceil((room.sabotage.endsAt - room.now) / 1000)) : 0;
      var label = room.sabotage.kind === 'reactor' ? 'المفاعل'
        : room.sabotage.kind === 'oxygen' ? 'الأوكسجين'
        : room.sabotage.kind === 'lights' ? 'الإنارة' : 'الاتصالات';
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
      var point = AU.room.sabotage.kind === 'reactor' ? { x: 13, y: 68 }
        : AU.room.sabotage.kind === 'oxygen' ? { x: 85, y: 42 }
        : AU.room.sabotage.kind === 'lights' ? { x: 24, y: 49.5 } : { x: 88, y: 68 };
      if (Math.hypot(point.x - world.x, point.y - world.y) < 8) return act('fix');
    }
    var near = nearestStation(me);
    if (near) openTask(near.task);
    else toast('اقرب من محطة مهمة أول');
  });
  el('auKill').addEventListener('click', function(){
    var target = nearestTarget();
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

  /* ---------- task minigames ---------- */
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
  var WIRE_COLORS = ['#e03a3a', '#3f8fe0', '#f0c14b', '#e260c0'];
  function renderWires(body){
    if (!taskState.order) {
      taskState.order = [0, 1, 2, 3].sort(function(){ return Math.random() - 0.5; });
      taskState.linked = [];
      taskState.pick = null;
    }
    var html = '<h2>' + esc(activeTask.label) + '</h2><p>وصّل كل سلك بلونه.</p><div class="wires" style="margin-top:12px"><div class="wire-col">';
    for (var i = 0; i < 4; i += 1) {
      html += '<div class="wire' + (taskState.linked.indexOf(i) >= 0 ? ' done' : '') + (taskState.pick === i ? ' pick' : '') + '" data-left="' + i + '" style="background:' + WIRE_COLORS[i] + '"></div>';
    }
    html += '</div><div class="wire-col">';
    for (var j = 0; j < 4; j += 1) {
      var colorIndex = taskState.order[j];
      html += '<div class="wire' + (taskState.linked.indexOf(colorIndex) >= 0 ? ' done' : '') + '" data-right="' + colorIndex + '" style="background:' + WIRE_COLORS[colorIndex] + '"></div>';
    }
    html += '</div></div><button class="btn block" id="auTaskCancel" style="margin-top:14px"><span>إلغاء</span></button>';
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
    html += '</div><p class="hint">' + (taskState.playing ? 'انتظر التسلسل…' : 'دورك: ' + taskState.index + '/' + taskState.pattern.length) +
      '</p><button class="btn block" id="auTaskCancel"><span>إلغاء</span></button>';
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
      setTimeout(function(){ taskState.lit = -1; if (activeTask) renderTask(); }, 330);
      step += 1;
    }, 640);
  }
  function renderHold(body){
    body.innerHTML = '<h2>' + esc(activeTask.label) + '</h2><p>اضغط وابقى ضاغط لين يكمل الشريط.</p>' +
      '<button class="hold-btn" id="auHold" style="margin-top:12px">اضغط واستمر</button>' +
      '<div class="hold-fill"><i id="auHoldFill"></i></div>' +
      '<button class="btn block" id="auTaskCancel" style="margin-top:14px"><span>إلغاء</span></button>';
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
      '<div class="up-count" style="margin-top:12px">' + taskState.count + '/3</div>' +
      '<button class="btn block green" id="auUpload" style="margin-top:14px"><span>ارفع</span></button>' +
      '<button class="btn block" id="auTaskCancel" style="margin-top:10px"><span>إلغاء</span></button>';
    el('auTaskCancel').addEventListener('click', closeTask);
    el('auUpload').addEventListener('click', function(){
      taskState.count += 1;
      if (taskState.count >= 3) return completeTask();
      renderTask();
    });
  }
  function stopHold(){ if (window.auStopHold) window.auStopHold(); }

  /* ---------- meeting ---------- */
  function renderMeeting(room){
    var dialog = el('auMeetingDialog');
    if (room.phase !== 'meeting' || !room.meeting) { dialog.classList.remove('on'); return; }
    dialog.classList.add('on');
    el('auMeetingTitle').textContent = room.meeting.reason === 'report' ? 'تبليغ عن جثة' : 'اجتماع طارئ';
    el('auMeetingSub').textContent = 'صوّت لطرد المزوّر — أو تخطَّ التصويت.';
    var me = room.players.filter(function(p){ return p.you; })[0];
    var list = el('auVoteList');
    list.innerHTML = room.players.filter(function(p){ return p.alive; }).map(function(player){
      var voted = room.meeting.votes.filter(function(v){ return v.voter === player.name; }).length > 0;
      return '<div class="vote">' + crewSvg(player.color) + '<b>' + esc(player.name) + '</b>' +
        (player.token === 'you' ? '<span class="tag">أنت</span>' : '') +
        (voted ? '<span class="tag">صوّت</span>' : '') +
        (player.token === 'you' ? '' : '<button class="btn red" data-vote="' + player.token + '"><span>تصويت</span></button>') +
        '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('[data-vote]'), function(button){
      button.addEventListener('click', function(){
        act('vote', { target: button.getAttribute('data-vote') }).then(function(){ dialog.classList.remove('on'); });
      });
    });
    el('auSkipVote').onclick = function(){
      act('vote', { target: 'skip' }).then(function(){ dialog.classList.remove('on'); });
    };
    var seconds = Math.max(0, Math.ceil((room.meeting.endsAt - room.now) / 1000));
    el('auMeetingTimer').textContent = seconds + ' ثانية';
    el('auSkipVote').disabled = !!(me && me.votedFor);
  }

  /* ---------- end: the ejection screen from the original ---------- */
  function renderEnd(room){
    var dialog = el('auEndDialog');
    if (room.phase !== 'ended') { dialog.classList.remove('on'); return; }
    dialog.classList.add('on');
    var crewWin = room.winner === 'crew';
    var last = room.lastMeeting;
    var title = crewWin ? 'فاز الطاقم' : 'فاز المزوّرون';
    var reason = room.endReason || '';
    if (last && last.ejectedName) {
      reason = (last.ejectedRole === 'impostor'
        ? last.ejectedName + ' كان مزوّراً'
        : last.ejectedName + ' ما كان مزوّراً') + ' — ' + reason;
    }
    el('auEndTitle').textContent = title;
    el('auEndTitle').className = crewWin ? 'win-crew' : 'win-imp';
    el('auEndReason').textContent = reason;

    var ejected = room.players.filter(function(p){ return !p.alive; })[0];
    el('auEndBean').innerHTML = crewSvg(ejected ? ejected.color : 'red');

    var impostors = room.players.filter(function(p){ return p.role === 'impostor'; }).length;
    el('auEndImpostors').textContent = impostors === 1 ? 'مزوّر واحد كان بينكم' : impostors + ' مزوّرين كانوا بينكم';

    el('auEndList').innerHTML = room.players.map(function(player){
      var role = player.role === 'impostor' ? 'مزوّر' : 'طاقم';
      return '<div class="vote">' + crewSvg(player.color) + '<b>' + esc(player.name) + '</b>' +
        '<span class="tag">' + role + (player.alive ? '' : ' · ميت') + '</span></div>';
    }).join('');
    var you = room.players.filter(function(p){ return p.you; })[0];
    el('auBackLobby').hidden = !(you && you.isHost);
  }

  /* ---------- boot ---------- */
  window.__auState = AU;
  resize();
  var params = new URLSearchParams(location.search);
  var sharedCode = (params.get('code') || '').toUpperCase();
  if (sharedCode) {
    el('auCode').value = sharedCode;
    AU.code = sharedCode;
    poll();
  }
  window.addEventListener('beforeunload', function(){
    if (AU.code && AU.token && navigator.sendBeacon) {
      navigator.sendBeacon('/api/amongus/rooms/' + AU.code, new Blob(
        [JSON.stringify({ action:'leave', token: AU.token, code: AU.code })],
        { type:'application/json' }
      ));
    }
  });
})();
</script>
</body>
</html>`;
}
