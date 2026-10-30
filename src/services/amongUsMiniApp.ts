import { AU_COLORS, AU_MAP } from './amongUsRooms';
import { GAME_SFX_SCRIPT } from './gameSfx';

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
<script>${GAME_SFX_SCRIPT}</script>
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
/* ---- main menu: the original title screen ---- */
#auMenu{display:none;direction:ltr;padding:0}
#auMenu.on{display:block}
.menu-shell{
  width:100%;max-width:1600px;margin:0 auto;display:grid;grid-template-rows:auto minmax(0,1fr);
  gap:10px;min-height:calc(100dvh - 28px)
}
.au-top{display:flex;align-items:center;gap:10px}
.au-player{
  display:flex;align-items:center;gap:9px;padding:5px 14px 5px 8px;border-radius:10px;
  background:#123a3c;border:3px solid #08302f;box-shadow:0 4px 0 #062220;min-width:0;max-width:62%
}
.au-player .ava{width:36px;height:36px;flex:none;display:grid;place-items:center}
.au-player .dot{width:11px;height:11px;border-radius:50%;background:#3ff08a;box-shadow:0 0 10px #3ff08a;flex:none}
.au-player b{color:#eafffb;font-size:14px;font-weight:900;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.au-friends{
  display:flex;align-items:center;gap:9px;
  margin-inline-start:auto;min-height:46px;padding:0 20px;border-radius:10px;
  background:linear-gradient(180deg,#3d8d92,#255f66);border:3px solid #0b3335;color:#dff8f4;
  font-size:15px;font-weight:900;letter-spacing:2px;box-shadow:0 4px 0 #062220,inset 0 2px 0 #ffffff33
}
.au-friends svg{width:40px;height:27px;flex:none}
.au-friends:active{transform:translateY(3px);box-shadow:0 1px 0 #062220}
.au-body{
  display:grid;grid-template-columns:clamp(196px,20%,286px) minmax(0,1fr);
  gap:16px;min-height:0;align-items:stretch
}
/* the original title screen: menu stacked on the left, window filling the rest */
.au-left{display:flex;flex-direction:column;gap:10px;min-width:0;padding-top:2px}
.au-version{margin-top:auto}
.wordmark{display:block;width:min(100%,300px);height:auto;margin:2px 0 0}
.wordmark text{
  font-family:"Comic Sans MS","Segoe Print","Bradley Hand","Marker Felt",cursive;
  font-weight:400;fill:none;stroke:#ffffff;stroke-linecap:round;stroke-linejoin:round
}
.menu-panel{
  background:linear-gradient(180deg,#17524f,#0e3b3c);border:3px solid #08302f;border-radius:12px;
  padding:6px 8px;box-shadow:0 6px 0 #062220,inset 0 2px 0 #ffffff1a
}
.menu-btn{
  position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:58px;
  margin:7px 0;padding:0 12px;border-radius:9px;overflow:hidden;cursor:pointer;
  background:linear-gradient(180deg,#63f8de,#14cbb2 55%,#0aa392);
  border:3px solid #073b38;box-shadow:0 5px 0 #052a28,inset 0 2px 0 #ffffff70;
  transform:skewX(-14deg);transition:transform .07s,box-shadow .07s
}
.menu-btn:before{
  content:"";position:absolute;inset:-30% -12%;pointer-events:none;
  background:repeating-linear-gradient(112deg,#ffffff38 0 13px,#ffffff00 13px 36px)
}
.menu-btn .ico{position:relative;width:42px;height:42px;display:grid;place-items:center;flex:none;transform:skewX(14deg)}
.menu-btn .ico svg{width:38px;height:38px;overflow:visible}
.menu-btn.small .ico{width:30px;height:30px}
.menu-btn .lbl{
  position:relative;flex:1;text-align:right;transform:skewX(14deg);
  color:#ffffff;font-size:clamp(17px,2.4vw,23px);font-weight:900;letter-spacing:1.6px;
  text-shadow:0 2px 0 #057a70,0 0 12px #063c3a
}
.menu-btn:active{transform:skewX(-14deg) translateY(4px);box-shadow:0 1px 0 #052a28}
.menu-btn.small{min-height:46px;background:linear-gradient(180deg,#2f7873,#1b4f4e);border-color:#072e2d;box-shadow:0 4px 0 #052a28,inset 0 2px 0 #ffffff22}
.menu-btn.small:before{opacity:.35}
.menu-btn.small .lbl{font-size:clamp(12px,1.7vw,15px);color:#d6f4ee;letter-spacing:1.2px;text-shadow:0 2px 0 #042a28}
.menu-btn.small .ico svg{width:24px;height:24px}
.au-version{color:#c7efe8;font-size:10px;letter-spacing:.7px;opacity:.72;padding:0 4px}
.space-box{
  position:relative;width:100%;height:100%;
  min-height:min(62dvh,440px);max-height:none;
  border-radius:18px;overflow:hidden;
  background:radial-gradient(circle at 60% 40%,#0a1226,#04060e 70%);
  border:6px solid #93a5a4;box-shadow:0 8px 0 #062220,inset 0 0 0 3px #2b3a3c,inset 0 0 70px #000
}
.space-box canvas{position:absolute;inset:0;display:block;width:100%;height:100%}
.space-play{
  position:absolute;inset:0;display:none;flex-direction:column;gap:10px;padding:12px;
  background:linear-gradient(180deg,#070c1ad9,#04060ee6);
}
.space-play.on{display:flex}
.sp-view{display:none;flex:1;min-height:0;flex-direction:column;gap:10px;direction:ltr}
.sp-view.on{display:flex}
.sp-mini{
  flex:none;height:40px;padding:0 16px;border-radius:9px;cursor:pointer;font-size:12px;font-weight:900;letter-spacing:1px;
  background:linear-gradient(180deg,#2f7873,#1b4f4e);border:3px solid #072e2d;color:#dff8f4;box-shadow:0 4px 0 #052a28
}
.sp-mini:active{transform:translateY(3px);box-shadow:0 1px 0 #052a28}
/* room-rule picker */
.sp-rows{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;direction:rtl;padding:2px}
.sp-row{
  display:flex;align-items:center;gap:10px;flex:none;padding:8px 10px;border-radius:11px;
  background:linear-gradient(180deg,#123c3c,#0b2b2c);border:2px solid #082e2d
}
.sp-row>span{flex:none;min-width:104px;color:#d6f4ee;font-size:13px;font-weight:900}
.sp-opts{display:flex;flex:1;gap:6px;flex-wrap:wrap;justify-content:flex-start;direction:ltr}
.sp-opt{
  min-width:52px;height:36px;padding:0 10px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:900;color:#bcd9d5;
  background:#0f2b3a;border:2px solid #26455c;box-shadow:0 3px 0 #071b25
}
.sp-opt.on{color:#062a26;background:linear-gradient(180deg,#8ffbe6,#28d3bb);border-color:#073b38;box-shadow:0 3px 0 #06352f}
.sp-opt:active{transform:translateY(2px);box-shadow:0 1px 0 #071b25}
.sp-go{
  flex:none;height:54px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:900;letter-spacing:1px;color:#06240f;
  background:linear-gradient(180deg,#8ef0b0,#3fc46b 55%,#26904c);border:3px solid #0c2e1b;
  box-shadow:0 6px 0 #0a2a18,inset 0 2px 0 #d3ffe2
}
.sp-go:active{transform:translateY(4px);box-shadow:0 2px 0 #0a2a18}
/* the online room browser */
.sp-rooms{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;direction:rtl;padding:2px}
.sp-room{
  display:flex;align-items:center;gap:10px;flex:none;padding:9px 12px;border-radius:11px;cursor:pointer;text-align:right;
  background:linear-gradient(180deg,#123c3c,#0b2b2c);border:2px solid #1f5a58;box-shadow:0 4px 0 #052a28
}
.sp-room:active{transform:translateY(3px);box-shadow:0 1px 0 #052a28}
.sp-room.busy{opacity:.55;cursor:not-allowed;filter:grayscale(.4)}
.sp-room .code{
  flex:none;min-width:78px;padding:6px 8px;border-radius:8px;text-align:center;letter-spacing:3px;
  background:#08202b;border:2px solid #2a6f75;color:#8ffbec;font-size:15px;font-weight:900
}
.sp-room .who{flex:1;min-width:0}
.sp-room .who b{display:block;color:#eafffb;font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sp-room .who small{display:block;color:#9fd0c8;font-size:11px}
.sp-room .n{flex:none;color:#8ffbec;font-size:13px;font-weight:900}
.sp-empty{
  margin:auto;text-align:center;color:#9fc9c2;font-size:13px;font-weight:800;line-height:1.9;padding:16px
}
.sp-head{display:flex;align-items:center;gap:10px;flex:none}
.sp-title{
  margin-inline-start:auto;color:#dff8f4;font-size:clamp(18px,2.6vw,32px);font-weight:900;
  letter-spacing:4px;text-shadow:0 3px 0 #052a28
}
.sp-back{
  width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:10px;cursor:pointer;
  background:linear-gradient(180deg,#2f7873,#1b4f4e);border:3px solid #072e2d;color:#dff8f4;
  box-shadow:0 4px 0 #052a28
}
.sp-back svg{width:18px;height:18px}
.sp-back:active{transform:translateY(3px);box-shadow:0 1px 0 #052a28}
/* left = enter code, middle = create room, right = online — one size, equal gaps */
.sp-cards{flex:1;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;direction:ltr;align-items:stretch;padding:2px}
/* Each card carries its own colour so the row reads as three different places. */
.sp-card{
  --tint:#3fe3c6; --tint-d:#0c7a6c; --edge:#9ff6ea;
  position:relative;display:flex;flex-direction:column;overflow:hidden;cursor:pointer;padding:0;
  border-radius:18px;background:#08151f;
  border:3px solid color-mix(in srgb,var(--edge) 62%,#0a1a26);
  box-shadow:0 8px 0 #04101a,0 14px 26px #0007,0 0 22px color-mix(in srgb,var(--tint) 26%,transparent),
    inset 0 0 0 3px #081722,inset 0 0 0 6px color-mix(in srgb,var(--tint) 22%,transparent),inset 0 2px 0 #ffffff22;
  transition:transform .1s,box-shadow .1s,border-color .1s
}
.sp-card#auCreate{--tint:#5cc8ff;--tint-d:#0f4d75;--edge:#bfeaff}
.sp-card#auOnlineCard{--tint:#a98bff;--tint-d:#3a2a8c;--edge:#d7c9ff}
.sp-card:before{
  content:"";position:absolute;inset:0;border-radius:14px;pointer-events:none;z-index:2;
  background:linear-gradient(160deg,#ffffff26 0%,#ffffff00 34%,#00000000 70%,#00000040 100%)
}
.sp-card:after{
  content:"";position:absolute;left:0;right:0;top:0;height:38%;pointer-events:none;z-index:2;
  background:linear-gradient(180deg,#ffffff1a,#ffffff00)
}
.sp-card:hover{transform:translateY(-4px);border-color:var(--edge);
  box-shadow:0 12px 0 #04101a,0 20px 30px #0009,0 0 30px color-mix(in srgb,var(--tint) 46%,transparent),
    inset 0 0 0 3px #081722,inset 0 0 0 6px color-mix(in srgb,var(--tint) 34%,transparent),inset 0 2px 0 #ffffff30}
.sp-card:active{transform:translateY(3px);box-shadow:0 3px 0 #04101a,0 6px 12px #0006,
  inset 0 0 0 3px #081722,inset 0 0 0 6px color-mix(in srgb,var(--tint) 20%,transparent)}
.sp-art{position:relative;flex:1;min-height:0;overflow:hidden;display:block;background:#081624}
.sp-art:after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 80% at 50% 0%,#ffffff14,#00000000 55%),
             linear-gradient(0deg,#03101a99,#00000000 45%)
}
.sp-art svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.sp-bar{
  position:relative;z-index:3;flex:none;display:block;padding:10px 8px 11px;text-align:center;color:#04211f;
  font-size:clamp(11px,1.4vw,17px);font-weight:900;letter-spacing:2px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--edge) 92%,#fff),var(--tint) 48%,var(--tint-d));
  border-top:3px solid color-mix(in srgb,var(--tint-d) 85%,#04121a);
  box-shadow:inset 0 2px 0 #ffffff80,inset 0 -3px 0 color-mix(in srgb,var(--tint-d) 90%,#000),0 -4px 10px #0005;
  text-shadow:0 1px 0 #ffffff90
}
.sp-join{display:none;flex:none;gap:8px;align-items:center;direction:rtl}
.sp-join.on{display:flex}
.sp-join input{
  flex:1;min-width:0;height:46px;border-radius:10px;padding:0 12px;text-align:center;
  background:#0b1a2e;border:3px solid #263a5c;color:#eaf6ff;font-size:19px;font-weight:900;
  letter-spacing:6px;text-transform:uppercase
}
.sp-join button{
  flex:none;height:46px;padding:0 18px;border-radius:10px;cursor:pointer;font-weight:900;font-size:14px;
  background:linear-gradient(180deg,#8ef0b0,#3fc46b 55%,#26904c);border:3px solid #0c2e1b;color:#06240f;
  box-shadow:0 4px 0 #0a2a18
}
.sp-join button:active{transform:translateY(3px);box-shadow:0 1px 0 #0a2a18}
@media(max-width:620px){
  .space-play{padding:9px;gap:8px}
  .sp-cards{gap:9px}
  .sp-back{width:36px;height:36px}
  .sp-bar{letter-spacing:1px;padding:6px 4px}
}
.space-hint{
  position:absolute;left:12px;bottom:8px;color:#7fa3a0;font-size:10px;letter-spacing:.6px;
  direction:rtl;pointer-events:none;opacity:.8
}
@media(max-width:620px){
  .au-body{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;gap:10px}
  /* The launch window comes first and owns most of the screen, always landscape. */
  .space-box{order:-1;height:min(56dvh,470px);min-height:200px;max-height:none}
  .wordmark{width:min(62%,190px)}
  .menu-btn{min-height:52px;margin:6px 0}
  .menu-btn .lbl{font-size:16px}
  .menu-btn.small{min-height:44px;margin:4px 0}
  .menu-btn.small .lbl{font-size:12px}
  .au-left{gap:8px}
  .au-body{gap:10px}
  .menu-panel+.menu-panel{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:5px 6px}
}
@media(max-width:620px) and (orientation:landscape){
  .au-body{grid-template-columns:minmax(120px,34%) minmax(0,1fr);grid-template-rows:auto}
  .space-box{order:0;height:min(82dvh,460px)}
  .wordmark{width:min(86%,150px)}
}
/* ---- menus inside dialogs ---- */
.colors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:12px 0}
.color{
  position:relative;display:grid;place-items:center;gap:4px;padding:8px 4px;border-radius:14px;
  background:#101a30;border:3px solid #2c3d5e;box-shadow:0 4px 0 #05070f;cursor:pointer
}
.color svg{width:30px;height:38px}
.color small{font-size:9px;color:#9fb0cf;font-weight:800}
.color.on{border-color:#63f8de;box-shadow:0 4px 0 #052a28,0 0 0 3px #63f8de55}
.color.locked{filter:grayscale(.85) brightness(.6)}
.color .lock{position:absolute;inset:auto 4px 4px auto;width:16px;height:16px}
.profile{display:grid;gap:8px;margin:10px 0}
.profile div{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:#101a30;border:2px solid #2c3d5e;font-size:12px;color:#c8d8ef}
.profile b{color:#fff}
.switch{display:flex;align-items:center;gap:10px;margin:10px 0;padding:12px;border-radius:14px;background:#101a30;border:2px solid #2c3d5e;font-size:12px;color:#c8d8ef;cursor:pointer}
.switch input{width:22px;height:22px;accent-color:#63f8de;flex:none}

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
<div id="auToast"></div>

<section id="auMenu" class="screen on">
  <div class="menu-shell">
    <div class="au-top">
      <div class="au-player" id="auPlayerChip">
        <span class="ava" id="auPlayerBean" aria-hidden="true"></span>
        <span class="dot" aria-hidden="true"></span>
        <b id="auPlayerName">لاعب</b>
      </div>
      <button class="au-friends" id="auFriendsBtn">
        <svg viewBox="0 0 52 34" aria-hidden="true">
          <path d="M15 6C8 6 4 10.6 4 16.6v3.2C4 23.3 6.4 25 9.6 25h10.8c3.2 0 5.6-1.7 5.6-5.2v-3.2C26 10.6 22 6 15 6z" fill="#8ff2dc" stroke="#073b38" stroke-width="2.4" stroke-linejoin="round"/>
          <ellipse cx="16.6" cy="15.4" rx="5.6" ry="4" fill="#eafcff" stroke="#073b38" stroke-width="1.9"/>
          <path d="M37 9C29.8 9 26 13.8 26 20v3.4c0 3.6 2.4 5.4 5.6 5.4h10.8c3.2 0 5.6-1.8 5.6-5.4V20C48 13.8 44.2 9 37 9z" fill="#4fd6c3" stroke="#073b38" stroke-width="2.3" stroke-linejoin="round"/>
          <ellipse cx="38.6" cy="18.8" rx="5.8" ry="4.1" fill="#d7f7ff" stroke="#073b38" stroke-width="1.9"/>
        </svg><span>FRIENDS</span></button>
    </div>
    <div class="au-body">
      <div class="au-left">
        <svg class="wordmark" viewBox="0 0 320 92" aria-hidden="true">
          <text x="8" y="64" font-size="52" letter-spacing="2" stroke-width="3.6" opacity=".95">AMONG</text>
          <text x="10" y="66" font-size="52" letter-spacing="2" stroke-width="1.1" opacity=".55">AMONG</text>
          <text x="238" y="64" font-size="30" letter-spacing="1" stroke-width="2.4">US</text>
          <text x="239" y="65.5" font-size="30" letter-spacing="1" stroke-width=".9" opacity=".55">US</text>
        </svg>
        <div class="menu-panel">
          <button class="menu-btn" id="auPlayBtn">
            <span class="ico"><svg viewBox="0 0 60 74" aria-hidden="true">
              <defs>
                <linearGradient id="auIcoPlay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8478"/><stop offset=".55" stop-color="#e23a38"/><stop offset="1" stop-color="#a91f26"/></linearGradient>
                <linearGradient id="auIcoPlayVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c4f0ff"/><stop offset="1" stop-color="#78c7e8"/></linearGradient>
              </defs>
              <ellipse cx="30" cy="69" rx="21" ry="3.4" fill="#3d0a0e" opacity=".5"/>
              <path d="M13 27C7.5 29 5 33.5 5 39s2.5 10 8 12h1.5V27z" fill="#93181f" stroke="#2a0507" stroke-width="2.6" stroke-linejoin="round"/>
              <rect x="17" y="51" width="13" height="13" rx="6" fill="#8f1a20" stroke="#2a0507" stroke-width="2.6"/>
              <rect x="33" y="51" width="13" height="13" rx="6" fill="#8f1a20" stroke="#2a0507" stroke-width="2.6"/>
              <path d="M32 4C21 4 12 13 12 26v14c0 8 5 12 13 12h14c8 0 13-4 13-12V24C52 12 43 4 32 4z" fill="url(#auIcoPlay)" stroke="#2a0507" stroke-width="2.8" stroke-linejoin="round"/>
              <path d="M16 27c0-8 5-14 13-15" fill="none" stroke="#ffb9b0" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
              <ellipse cx="35" cy="22" rx="14.5" ry="10.2" fill="url(#auIcoPlayVisor)" stroke="#2a0507" stroke-width="2.6"/>
              <path d="M25.5 17.6c4-2.7 10-3.1 14-1.6" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".92"/>
            </svg></span><span class="lbl">PLAY</span>
          </button>
          <button class="menu-btn" id="auInventoryBtn">
            <span class="ico"><svg viewBox="0 0 56 56" aria-hidden="true">
              <defs>
                <linearGradient id="auIcoChest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dda059"/><stop offset=".55" stop-color="#a86c2c"/><stop offset="1" stop-color="#74451a"/></linearGradient>
                <linearGradient id="auIcoLid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8b273"/><stop offset="1" stop-color="#b57a37"/></linearGradient>
                <linearGradient id="auIcoSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f1f8"/><stop offset="1" stop-color="#8ea3b8"/></linearGradient>
              </defs>
              <ellipse cx="28" cy="50.5" rx="22" ry="3.2" fill="#241405" opacity=".4"/>
              <rect x="5" y="23" width="46" height="25" rx="4" fill="url(#auIcoChest)" stroke="#241405" stroke-width="2.6"/>
              <path d="M5 25c0-9 8-15 23-15s23 6 23 15z" fill="url(#auIcoLid)" stroke="#241405" stroke-width="2.6" stroke-linejoin="round"/>
              <path d="M12 18c3.6-3.6 9-5.6 14.5-5.6" fill="none" stroke="#ffe0b4" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>
              <rect x="5" y="21.5" width="46" height="6" rx="2" fill="url(#auIcoSteel)" stroke="#241405" stroke-width="2.3"/>
              <rect x="11" y="15" width="6" height="33" rx="1.8" fill="url(#auIcoSteel)" stroke="#241405" stroke-width="2.1"/>
              <rect x="39" y="15" width="6" height="33" rx="1.8" fill="url(#auIcoSteel)" stroke="#241405" stroke-width="2.1"/>
              <rect x="22" y="26" width="12" height="14" rx="3" fill="#f6cd63" stroke="#241405" stroke-width="2.3"/>
              <circle cx="28" cy="31.5" r="2.3" fill="#241405"/>
              <path d="M28 33.5v3.6" stroke="#241405" stroke-width="2.2" stroke-linecap="round"/>
            </svg></span><span class="lbl">INVENTORY</span>
          </button>
          <button class="menu-btn" id="auShopBtn">
            <span class="ico"><svg viewBox="0 0 56 56" aria-hidden="true">
              <defs>
                <linearGradient id="auIcoBag" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#ffe89b"/><stop offset=".5" stop-color="#f2b63a"/><stop offset="1" stop-color="#c07d15"/></linearGradient>
                <linearGradient id="auIcoCoin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe4"/><stop offset=".55" stop-color="#ffd95c"/><stop offset="1" stop-color="#e9a915"/></linearGradient>
              </defs>
              <ellipse cx="26" cy="50" rx="19" ry="3.2" fill="#241405" opacity=".4"/>
              <path d="M19 17v-4a8 8 0 0 1 16 0v4" fill="none" stroke="#7a4a1e" stroke-width="3.4" stroke-linecap="round"/>
              <path d="M12 16h26l3.2 30.4a4.2 4.2 0 0 1-4.2 4.6H13a4.2 4.2 0 0 1-4.2-4.6z" fill="url(#auIcoBag)" stroke="#241405" stroke-width="2.6" stroke-linejoin="round"/>
              <path d="M12.6 23.5h24.8" stroke="#241405" stroke-width="2" opacity=".4"/>
              <path d="M16.5 22.5 18 45.5" stroke="#fff8dd" stroke-width="2.6" stroke-linecap="round" opacity=".6"/>
              <circle cx="43.5" cy="37.5" r="10" fill="url(#auIcoCoin)" stroke="#5e3f06" stroke-width="2.6"/>
              <circle cx="43.5" cy="37.5" r="6.6" fill="none" stroke="#cf9410" stroke-width="1.6" opacity=".85"/>
              <path d="M43.5 32.9l1.7 3.4 3.7.5-2.7 2.6.7 3.7-3.4-1.8-3.4 1.8.7-3.7-2.7-2.6 3.7-.5z" fill="#8a5c05" stroke="#5e3f06" stroke-width=".9" stroke-linejoin="round"/>
              <path d="M38.2 32.7a7 7 0 0 1 4.6-3.4" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".75"/>
            </svg></span><span class="lbl">SHOP</span>
          </button>
        </div>
        <div class="menu-panel">
          <button class="menu-btn small" id="auAccountBtn">
            <span class="ico"><svg viewBox="0 0 52 44" aria-hidden="true">
              <defs><linearGradient id="auIcoCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfeff"/><stop offset="1" stop-color="#bcd4e6"/></linearGradient></defs>
              <rect x="3.5" y="6" width="45" height="32" rx="5" fill="url(#auIcoCard)" stroke="#12303a" stroke-width="2.6"/>
              <path d="M3.5 11.5A5.5 5.5 0 0 1 9 6h34a5.5 5.5 0 0 1 5.5 5.5V15h-45z" fill="#3f8fe0" stroke="#12303a" stroke-width="2.4"/>
              <circle cx="17" cy="24" r="6.6" fill="#8ec6e6" stroke="#12303a" stroke-width="2.4"/>
              <path d="M24.5 22h15M24.5 27.5h15M24.5 33h9" stroke="#3a5d74" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
            </svg></span><span class="lbl">MY ACCOUNT</span>
          </button>
          <button class="menu-btn small" id="auSettingsBtn">
            <span class="ico"><svg viewBox="0 0 48 48" aria-hidden="true">
              <defs><linearGradient id="auIcoGear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf3fa"/><stop offset="1" stop-color="#93aec3"/></linearGradient></defs>
              <path d="M20 6h8l1.6 5.2a14 14 0 0 1 4 2.3l5.2-1.6 4 6.9-3.8 3.7a14 14 0 0 1 0 4.6L42.8 31l-4 6.9-5.2-1.6a14 14 0 0 1-4 2.3L28 44h-8l-1.6-5.4a14 14 0 0 1-4-2.3L9.2 38l-4-6.9 3.8-3.7a14 14 0 0 1 0-4.6L5.2 19l4-6.9 5.2 1.6a14 14 0 0 1 4-2.3z" fill="url(#auIcoGear)" stroke="#12303a" stroke-width="2.6" stroke-linejoin="round"/>
              <circle cx="24" cy="24" r="7.4" fill="#0e3b3c" stroke="#12303a" stroke-width="2.6"/>
              <circle cx="24" cy="24" r="7.4" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".25"/>
              <path d="M17 15.5c2-3 5.2-4.6 8.6-4.8" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".55"/>
            </svg></span><span class="lbl">SETTINGS</span>
          </button>
        </div>
        <div class="au-version">امونق اس · v1 · build 2026-11</div>
      </div>
      <div class="space-box" id="auSpaceBox">
        <canvas id="auSpace"></canvas>
        <span class="space-hint" id="auSpaceHint">السفينة على وشك الإقلاع</span>
        <div class="space-play" id="auSpacePlay">
          <div class="sp-view on" id="auViewPick">
            <div class="sp-head">
              <button class="sp-back" id="auPlayBack" aria-label="رجوع">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#dff8f4" stroke-width="3.4" stroke-linecap="round"/></svg>
              </button>
              <span class="sp-title">PLAY</span>
            </div>
            <div class="sp-cards">
              <button class="sp-card" id="auCodeCard">
                <span class="sp-art">
                  <svg viewBox="0 0 300 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="slotCode" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8fff0"/><stop offset="1" stop-color="#12a08f"/></linearGradient><linearGradient id="beanCode" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6fff4"/><stop offset=".5" stop-color="#41e0c8"/><stop offset="1" stop-color="#0a6f66"/></linearGradient><linearGradient id="skyCode" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#0f5560"/><stop offset=".55" stop-color="#0a2f3e"/><stop offset="1" stop-color="#04121a"/></linearGradient><radialGradient id="glowCode" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#49f0d0" stop-opacity=".5"/><stop offset=".5" stop-color="#49f0d0" stop-opacity=".16"/><stop offset="1" stop-color="#49f0d0" stop-opacity="0"/></radialGradient><linearGradient id="glass" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d3f4ff"/><stop offset=".75" stop-color="#93cfe8"/><stop offset="1" stop-color="#5aa8cc"/></linearGradient><linearGradient id="steel" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fbfdff"/><stop offset=".35" stop-color="#cddbe6"/><stop offset=".7" stop-color="#93a9ba"/><stop offset="1" stop-color="#5d7486"/></linearGradient><linearGradient id="steel2" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e8f2fa"/><stop offset=".5" stop-color="#a8bdcb"/><stop offset="1" stop-color="#5b7282"/></linearGradient></defs><rect width="300" height="460" fill="url(#skyCode)"/><rect width="300" height="460" fill="url(#glowCode)"/><g fill="#e8fbff" opacity=".7"><circle cx="38" cy="44" r="1.7"/><circle cx="86" cy="26" r="1.1"/><circle cx="212" cy="38" r="1.5"/><circle cx="262" cy="72" r="1.1"/><circle cx="24" cy="120" r="1.2"/><circle cx="276" cy="150" r="1"/></g><g stroke="#0a121c" stroke-linejoin="round"><rect x="62" y="120" width="176" height="222" rx="20" fill="url(#steel)" stroke-width="4"/><rect x="74" y="132" width="152" height="198" rx="14" fill="#0a1b26" stroke-width="3.4"/><rect x="86" y="146" width="128" height="44" rx="10" fill="#061219" stroke-width="3"/></g><g><rect x="96" y="156" width="17" height="24" rx="4.5" fill="url(#slotCode)" stroke="#0a121c" stroke-width="2.2"/><rect x="118" y="156" width="17" height="24" rx="4.5" fill="url(#slotCode)" stroke="#0a121c" stroke-width="2.2"/><rect x="140" y="156" width="17" height="24" rx="4.5" fill="url(#slotCode)" stroke="#0a121c" stroke-width="2.2"/><rect x="162" y="156" width="17" height="24" rx="4.5" fill="url(#slotCode)" stroke="#0a121c" stroke-width="2.2"/><rect x="184" y="156" width="17" height="24" rx="4.5" fill="url(#slotCode)" stroke="#0a121c" stroke-width="2.2"/><rect x="206" y="156" width="4" height="24" rx="2" fill="#49f0d0" opacity=".85"/></g><g fill="#f4fbff" stroke="#0a121c" stroke-width="2.6"><rect x="90" y="204" width="40" height="26" rx="8"/><rect x="133" y="204" width="40" height="26" rx="8"/><rect x="176" y="204" width="40" height="26" rx="8"/><rect x="90" y="244" width="40" height="26" rx="8"/><rect x="133" y="244" width="40" height="26" rx="8"/><rect x="176" y="244" width="40" height="26" rx="8"/></g><g fill="url(#slotCode)" stroke="#0a121c" stroke-width="2"><rect x="90" y="204" width="40" height="26" rx="8" opacity=".55"/></g><path d="M96 150h44l-30 36H86z" fill="#ffffff" opacity=".12"/><circle cx="224" cy="322" r="5" fill="#49f0d0" stroke="#0a121c" stroke-width="2"/><circle cx="224" cy="322" r="9" fill="#49f0d0" opacity=".28"/><g transform="translate(26.0,246.0) scale(1.4900)"><ellipse cx="50" cy="116" rx="36" ry="7.5" fill="#03080f" opacity=".6"/><path d="M16 34C6 36 2 47 2 58c0 12 4 21 14 22h3V34z" fill="#0b6f63" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><rect x="19" y="85" width="26" height="20" rx="10" fill="#0b6f63" stroke="#0a121c" stroke-width="3.6"/><rect x="47" y="85" width="26" height="20" rx="10" fill="#0b6f63" stroke="#0a121c" stroke-width="3.6"/><path d="M46 10C23 10 9 26 9 48v28c0 11 7 18 18 18h30c11 0 18-7 18-18V42C75 23 64 10 46 10z" fill="url(#beanCode)" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><path d="M19 36c5-11 15-18 27-19" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" opacity=".3"/><ellipse cx="53" cy="41" rx="26" ry="19" fill="url(#glass)" stroke="#0a121c" stroke-width="3.6"/><path d="M34 32c7-5 20-6 27-3" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" opacity=".92"/></g><path d="M92 300c-14 0-22 8-22 18" stroke="#7cf6de" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="6 7" opacity=".85"/><g transform="translate(250,108) scale(1.50)" fill="#9ffcf0"><path d="M0-9l2.6 6.4L9 0 2.6 2.6 0 9-2.6 2.6-9 0-2.6-2.6z" opacity=".9"/></g><g transform="translate(46,190) scale(1.00)" fill="#9ffcf0"><path d="M0-9l2.6 6.4L9 0 2.6 2.6 0 9-2.6 2.6-9 0-2.6-2.6z" opacity=".9"/></g><ellipse cx="150" cy="430" rx="150" ry="26" fill="#04121a" opacity=".95"/><ellipse cx="150" cy="425" rx="116" ry="22" fill="#0b6f63" opacity=".55"/><ellipse cx="150" cy="421" rx="80" ry="19" fill="#0b6f63" opacity=".35"/></svg>
                </span>
                <span class="sp-bar">ENTER CODE</span>
              </button>
              <button class="sp-card" id="auCreate">
                <span class="sp-art">
                  <svg viewBox="0 0 300 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="plusMake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b8"/><stop offset=".5" stop-color="#f7c945"/><stop offset="1" stop-color="#d2900c"/></linearGradient><linearGradient id="beanMake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9f4ff"/><stop offset=".5" stop-color="#38cfe8"/><stop offset="1" stop-color="#0a5f74"/></linearGradient><linearGradient id="skyMake" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#163d63"/><stop offset=".55" stop-color="#0c2033"/><stop offset="1" stop-color="#050d17"/></linearGradient><radialGradient id="glowMake" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#58b8ff" stop-opacity=".5"/><stop offset=".5" stop-color="#58b8ff" stop-opacity=".16"/><stop offset="1" stop-color="#58b8ff" stop-opacity="0"/></radialGradient><linearGradient id="glass" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d3f4ff"/><stop offset=".75" stop-color="#93cfe8"/><stop offset="1" stop-color="#5aa8cc"/></linearGradient><linearGradient id="steel" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fbfdff"/><stop offset=".35" stop-color="#cddbe6"/><stop offset=".7" stop-color="#93a9ba"/><stop offset="1" stop-color="#5d7486"/></linearGradient><linearGradient id="steel2" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e8f2fa"/><stop offset=".5" stop-color="#a8bdcb"/><stop offset="1" stop-color="#5b7282"/></linearGradient></defs><rect width="300" height="460" fill="url(#skyMake)"/><rect width="300" height="460" fill="url(#glowMake)"/><g fill="#e8fbff" opacity=".7"><circle cx="30" cy="52" r="1.6"/><circle cx="74" cy="22" r="1.1"/><circle cx="230" cy="34" r="1.4"/><circle cx="272" cy="88" r="1.1"/><circle cx="20" cy="164" r="1"/></g><g stroke="#0a121c" stroke-linejoin="round" opacity=".9"><path d="M176 92h84a14 14 0 0 1 14 14v248a14 14 0 0 1-14 14h-84z" fill="url(#steel2)" stroke-width="4"/></g><g stroke="#0a121c" stroke-linejoin="round"><circle cx="176" cy="232" r="84" fill="url(#steel)" stroke-width="4"/><circle cx="176" cy="232" r="68" fill="#0b2c3a" stroke-width="3.6"/><circle cx="176" cy="232" r="68" fill="none" stroke="#7fe4ff" stroke-width="2.6" opacity=".6"/><circle cx="176" cy="232" r="54" fill="#10505f" stroke-width="3"/></g><circle cx="176" cy="232" r="54" fill="#0f4f60"/><path d="M148 204c9-13 24-20 41-20" fill="none" stroke="#a9f6ff" stroke-width="7" stroke-linecap="round" opacity=".45"/><g stroke="#8ff3ff" stroke-width="3.4" stroke-linecap="round" opacity=".8"><path d="M176 232v-24M176 232l20 13M176 232l-20 13"/></g><circle cx="176" cy="232" r="9" fill="#9ffcf0" opacity=".9"/><g fill="#c9dae6" stroke="#0a121c" stroke-width="2.6"><circle cx="176" cy="158" r="6"/><circle cx="176" cy="306" r="6"/><circle cx="102" cy="232" r="6"/></g><circle cx="252" cy="300" r="7" fill="#f7c945" stroke="#0a121c" stroke-width="2.8"/><path d="M112 404l150-6v-10l-150 6z" fill="#9ff6ff" opacity=".16"/><g transform="translate(44.0,258.0) scale(1.3800)"><ellipse cx="50" cy="116" rx="36" ry="7.5" fill="#03080f" opacity=".6"/><path d="M16 34C6 36 2 47 2 58c0 12 4 21 14 22h3V34z" fill="#0a5f74" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><rect x="19" y="85" width="26" height="20" rx="10" fill="#0a5f74" stroke="#0a121c" stroke-width="3.6"/><rect x="47" y="85" width="26" height="20" rx="10" fill="#0a5f74" stroke="#0a121c" stroke-width="3.6"/><path d="M46 10C23 10 9 26 9 48v28c0 11 7 18 18 18h30c11 0 18-7 18-18V42C75 23 64 10 46 10z" fill="url(#beanMake)" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><path d="M19 36c5-11 15-18 27-19" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" opacity=".3"/><ellipse cx="53" cy="41" rx="26" ry="19" fill="url(#glass)" stroke="#0a121c" stroke-width="3.6"/><path d="M34 32c7-5 20-6 27-3" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" opacity=".92"/></g><g><circle cx="80" cy="100" r="27" fill="#0a121c" opacity=".45"/><circle cx="80" cy="100" r="25" fill="url(#plusMake)" stroke="#0a121c" stroke-width="4"/><circle cx="80" cy="100" r="18" fill="none" stroke="#fff6c9" stroke-width="2.6" opacity=".85"/><path d="M80 88v24M68 100h24" stroke="#5d3d05" stroke-width="6.4" stroke-linecap="round"/></g><g transform="translate(258,132) scale(1.60)" fill="#bfefff"><path d="M0-9l2.6 6.4L9 0 2.6 2.6 0 9-2.6 2.6-9 0-2.6-2.6z" opacity=".9"/></g><ellipse cx="150" cy="432" rx="152" ry="26" fill="#08161f" opacity=".95"/><ellipse cx="150" cy="427" rx="118" ry="22" fill="#0a5f74" opacity=".55"/><ellipse cx="150" cy="423" rx="82" ry="19" fill="#0a5f74" opacity=".35"/></svg>
                </span>
                <span class="sp-bar">CREATE ROOM</span>
              </button>
              <button class="sp-card" id="auOnlineCard">
                <span class="sp-art">
                  <svg viewBox="0 0 300 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="beanBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8b6ff"/><stop offset=".5" stop-color="#4f63e8"/><stop offset="1" stop-color="#232b7a"/></linearGradient><linearGradient id="beanPink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3dd"/><stop offset=".5" stop-color="#e34aa6"/><stop offset="1" stop-color="#8c2464"/></linearGradient><linearGradient id="skyOnline" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#2a2168"/><stop offset=".55" stop-color="#150f38"/><stop offset="1" stop-color="#07061a"/></linearGradient><radialGradient id="glowOnline" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#8b6bff" stop-opacity=".5"/><stop offset=".5" stop-color="#8b6bff" stop-opacity=".16"/><stop offset="1" stop-color="#8b6bff" stop-opacity="0"/></radialGradient><linearGradient id="glass" x1="0" y1="0" x2=".25" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#d3f4ff"/><stop offset=".75" stop-color="#93cfe8"/><stop offset="1" stop-color="#5aa8cc"/></linearGradient><linearGradient id="steel" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fbfdff"/><stop offset=".35" stop-color="#cddbe6"/><stop offset=".7" stop-color="#93a9ba"/><stop offset="1" stop-color="#5d7486"/></linearGradient><linearGradient id="steel2" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#e8f2fa"/><stop offset=".5" stop-color="#a8bdcb"/><stop offset="1" stop-color="#5b7282"/></linearGradient></defs><rect width="300" height="460" fill="url(#skyOnline)"/><rect width="300" height="460" fill="url(#glowOnline)"/><g fill="#e8fbff" opacity=".7"><circle cx="34" cy="40" r="1.5"/><circle cx="78" cy="20" r="1"/><circle cx="226" cy="30" r="1.4"/><circle cx="268" cy="84" r="1.1"/><circle cx="18" cy="150" r="1.2"/><circle cx="280" cy="196" r="1"/></g><g fill="none" stroke="#9fe8ff" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M214 96a34 34 0 0 1 44 0"/><path d="M206 82a48 48 0 0 1 60 0"/></g><circle cx="236" cy="112" r="6" fill="#9fe8ff"/><g stroke="#0a121c" stroke-linejoin="round"><rect x="58" y="128" width="184" height="132" rx="14" fill="url(#steel)" stroke-width="4"/><rect x="70" y="140" width="160" height="108" rx="9" fill="#0a1a3a" stroke-width="3.2"/></g><g><rect x="82" y="152" width="136" height="26" rx="7" fill="#37e08a" opacity=".92"/><rect x="90" y="160" width="34" height="10" rx="5" fill="#06281a"/><circle cx="202" cy="165" r="5" fill="#06281a"/><rect x="82" y="188" width="104" height="14" rx="7" fill="#9fe8ff" opacity=".8"/><rect x="82" y="212" width="72" height="12" rx="6" fill="#9fe8ff" opacity=".5"/><rect x="82" y="232" width="46" height="9" rx="4.5" fill="#9fe8ff" opacity=".32"/></g><path d="M78 150h50l-34 44H62z" fill="#ffffff" opacity=".1"/><g stroke="#0a121c" stroke-linejoin="round"><path d="M42 262h216l18 30H24z" fill="url(#steel)" stroke-width="4"/><rect x="126" y="270" width="48" height="7" rx="3.5" fill="#7f96a8" stroke-width="2"/></g><g transform="translate(8.0,286.0) scale(1.2400)"><ellipse cx="50" cy="116" rx="36" ry="7.5" fill="#03080f" opacity=".6"/><path d="M16 34C6 36 2 47 2 58c0 12 4 21 14 22h3V34z" fill="#26307f" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><rect x="19" y="85" width="26" height="20" rx="10" fill="#26307f" stroke="#0a121c" stroke-width="3.6"/><rect x="47" y="85" width="26" height="20" rx="10" fill="#26307f" stroke="#0a121c" stroke-width="3.6"/><path d="M46 10C23 10 9 26 9 48v28c0 11 7 18 18 18h30c11 0 18-7 18-18V42C75 23 64 10 46 10z" fill="url(#beanBlue)" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><path d="M19 36c5-11 15-18 27-19" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" opacity=".3"/><ellipse cx="53" cy="41" rx="26" ry="19" fill="url(#glass)" stroke="#0a121c" stroke-width="3.6"/><path d="M34 32c7-5 20-6 27-3" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" opacity=".92"/></g><g transform="translate(186.0,286.0) scale(1.2400)"><ellipse cx="50" cy="116" rx="36" ry="7.5" fill="#03080f" opacity=".6"/><path d="M16 34C6 36 2 47 2 58c0 12 4 21 14 22h3V34z" fill="#8f2a6f" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><rect x="19" y="85" width="26" height="20" rx="10" fill="#8f2a6f" stroke="#0a121c" stroke-width="3.6"/><rect x="47" y="85" width="26" height="20" rx="10" fill="#8f2a6f" stroke="#0a121c" stroke-width="3.6"/><path d="M46 10C23 10 9 26 9 48v28c0 11 7 18 18 18h30c11 0 18-7 18-18V42C75 23 64 10 46 10z" fill="url(#beanPink)" stroke="#0a121c" stroke-width="3.6" stroke-linejoin="round"/><path d="M19 36c5-11 15-18 27-19" fill="none" stroke="#ffffff" stroke-width="4.6" stroke-linecap="round" opacity=".3"/><ellipse cx="53" cy="41" rx="26" ry="19" fill="url(#glass)" stroke="#0a121c" stroke-width="3.6"/><path d="M34 32c7-5 20-6 27-3" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linecap="round" opacity=".92"/></g><g fill="#37e08a" stroke="#0a121c" stroke-width="2"><circle cx="44" cy="120" r="6"/><circle cx="272" cy="252" r="6"/></g><g transform="translate(64,92) scale(1.40)" fill="#cbb8ff"><path d="M0-9l2.6 6.4L9 0 2.6 2.6 0 9-2.6 2.6-9 0-2.6-2.6z" opacity=".9"/></g><ellipse cx="150" cy="432" rx="154" ry="26" fill="#080718" opacity=".95"/><ellipse cx="150" cy="427" rx="120" ry="22" fill="#3a2b86" opacity=".55"/><ellipse cx="150" cy="423" rx="84" ry="19" fill="#3a2b86" opacity=".35"/></svg>
                </span>
                <span class="sp-bar">ONLINE</span>
              </button>
            </div>
            <div class="sp-join" id="auJoinBox">
              <input id="auCode" maxlength="6" placeholder="ABC123" aria-label="كود الغرفة">
              <button id="auJoin">دخول</button>
            </div>
          </div>

          <div class="sp-view" id="auViewSettings">
            <div class="sp-head">
              <button class="sp-back" id="auSettingsBack" aria-label="رجوع">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#dff8f4" stroke-width="3.4" stroke-linecap="round"/></svg>
              </button>
              <span class="sp-title">إعدادات الغرفة</span>
            </div>
            <div class="sp-rows" id="auSettingRows"></div>
            <button class="sp-go" id="auCreateRoom">أنشئ الغرفة</button>
          </div>

          <div class="sp-view" id="auViewOnline">
            <div class="sp-head">
              <button class="sp-back" id="auOnlineBack" aria-label="رجوع">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="#dff8f4" stroke-width="3.4" stroke-linecap="round"/></svg>
              </button>
              <span class="sp-title">غرف أونلاين</span>
              <button class="sp-mini" id="auRefresh">تحديث</button>
            </div>
            <div class="sp-rooms" id="auRoomList"></div>
          </div>

                </div></div>
      </div>
    </div>
  </div>
</section>

<div class="overlay" id="auInvDialog">
  <div class="dialog" style="direction:rtl">
    <h2>الخزانة</h2>
    <p>اختار لون بطلك — اللون ينحفظ ويتطبّق بكل مباراة.</p>
    <div class="colors" id="auColorGrid"></div>
    <button class="btn block dark" id="auInvClose" style="margin-top:14px"><span>رجوع</span></button>
  </div>
</div>

<div class="overlay" id="auShopDialog">
  <div class="dialog" style="direction:rtl">
    <h2>المتجر</h2>
    <p>ألوان نادرة تنفتح بجمْع المباريات.</p>
    <div class="colors" id="auShopGrid"></div>
    <p class="hint" id="auShopHint"></p>
    <button class="btn block dark" id="auShopClose" style="margin-top:10px"><span>رجوع</span></button>
  </div>
</div>

<div class="overlay" id="auAccDialog">
  <div class="dialog" style="direction:rtl">
    <h2>ملفي</h2>
    <div class="profile" id="auProfile"></div>
    <p class="hint">اسمك هو اسم حسابك بتليگرام — ما يتغيّر من هنا.</p>
    <button class="btn block dark" id="auAccClose" style="margin-top:10px"><span>رجوع</span></button>
  </div>
</div>

<div class="overlay" id="auSetDialog">
  <div class="dialog" style="direction:rtl">
    <h2>الإعدادات</h2>
    <p>إعدادات محلية على جهازك.</p>
    <label class="switch"><input type="checkbox" id="auSoundToggle"><span>أصوات اللعبة (قتل، أزرار، تنبيهات)</span></label>
    <label class="switch"><input type="checkbox" id="auMusicToggle"><span>موسيقى خلفية خفيفة</span></label>
    <label class="switch"><input type="checkbox" id="auHintsToggle"><span>إظهار تلميحات المحطات</span></label>
    <button class="btn block red" id="auResetBtn" style="margin-top:14px"><span>امسح بياناتي المحلية</span></button>
    <button class="btn block dark" id="auSetClose" style="margin-top:10px"><span>رجوع</span></button>
  </div>
</div>

<div class="overlay" id="auFriendsDialog">
  <div class="dialog" style="direction:rtl">
    <h2>الأصدقاء</h2>
    <p>شارك رابط اللعبة — أي شخص يفتحه يگدر ينشئ غرفة أو ينضم بكود.</p>
    <button class="btn block green" id="auShareBtn"><span>شارك الرابط</span></button>
    <button class="btn block" id="auCopyBtn" style="margin-top:10px"><span>انسخ الرابط</span></button>
    <p class="hint" id="auShareLink"></p>
    <button class="btn block dark" id="auFriendsClose" style="margin-top:10px"><span>رجوع</span></button>
  </div>
</div>

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
    <div class="hud-top" id="auHudTop">
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
  var CREW_OUTLINE = '#151a24';
  /** The crewmate silhouette from the game: flat body, dark outline, huge visor. */
  function crewSvg(colorId, extra){
    var hex = '#8899aa';
    for (var i = 0; i < CFG.colors.length; i += 1) if (CFG.colors[i].id === colorId) hex = CFG.colors[i].hex;
    var dark = shade(hex, -0.34);
    var id = 'cg-' + String(colorId).replace(/[^a-z0-9]/gi, '');
    return '<svg viewBox="0 0 100 120" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + shade(hex, 0.16) + '"/><stop offset="1" stop-color="' + shade(hex, -0.08) + '"/>' +
      '</linearGradient></defs>' +
      '<ellipse cx="50" cy="112" rx="33" ry="6" fill="#0b0f18" opacity=".45"/>' +
      '<path d="M16 34C6 36 2 47 2 58c0 12 4 21 14 22h2V34z" fill="' + dark + '" stroke="' + CREW_OUTLINE + '" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<rect x="20" y="86" width="25" height="19" rx="9.5" fill="' + dark + '" stroke="' + CREW_OUTLINE + '" stroke-width="3.4"/>' +
      '<rect x="47" y="86" width="25" height="19" rx="9.5" fill="' + dark + '" stroke="' + CREW_OUTLINE + '" stroke-width="3.4"/>' +
      '<path d="M46 10C23 10 9 26 9 48v28c0 11 7 18 18 18h30c11 0 18-7 18-18V42C75 23 64 10 46 10z" fill="url(#' + id + ')" stroke="' + CREW_OUTLINE + '" stroke-width="3.4" stroke-linejoin="round"/>' +
      '<ellipse cx="53" cy="41" rx="26" ry="19" fill="#a9e3f5" stroke="' + CREW_OUTLINE + '" stroke-width="3.4"/>' +
      '<path d="M34 33c7-5 20-6 27-3" stroke="#e9fbff" stroke-width="6" stroke-linecap="round" fill="none" opacity=".9"/>' +
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

  /* ---------- the space window: drifting stars + floating crewmates ---------- */
  var space = { canvas:null, ctx:null, w:0, h:0, stars:[], beans:[], t:0 };
  function spaceResize(){
    if (!space.canvas) return;
    var box = space.canvas.parentElement;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    space.w = Math.max(1, box.clientWidth || 320);
    space.h = Math.max(1, box.clientHeight || 240);
    space.canvas.width = Math.round(space.w * dpr);
    space.canvas.height = Math.round(space.h * dpr);
    space.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spaceSeed(){
    space.stars = [];
    var count = 90;
    for (var i = 0; i < count; i += 1) {
      space.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.7 + 0.5,
        speed: Math.random() * 0.012 + 0.004,
        phase: Math.random() * Math.PI * 2,
        twinkle: Math.random() * 1.6 + 0.9
      });
    }
    var palette = ['cyan', 'green', 'red', 'pink', 'yellow', 'purple'];
    space.beans = palette.map(function(id, index){
      return {
        color: id,
        x: 0.16 + index * 0.135,
        y: 0.30 + (index % 3) * 0.17,
        amp: 0.05 + (index % 2) * 0.04,
        speed: 0.22 + index * 0.045,
        phase: index * 1.35,
        scale: 0.85 + (index % 3) * 0.16,
        tilt: (index % 2 ? 1 : -1) * (0.2 + index * 0.05)
      };
    });
  }
  /**
   * One canvas crewmate, in the same proportions as the SVG above.
   * size is the body height in pixels; phase drives the leg swing.
   */
  function drawCrew(ctx, px, py, size, hex, angle, phase, opts){
    opts = opts || {};
    var s = size / 84;
    var dark = shade(hex, -0.34);
    var lighter = shade(hex, 0.16);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle || 0);
    ctx.scale(s, s);
    ctx.translate(-50, -50);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = CREW_OUTLINE;

    if (opts.shadow !== false) {
      ctx.beginPath();
      ctx.ellipse(50, 112, 33, 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,12,20,0.45)';
      ctx.fill();
    }

    // backpack
    ctx.beginPath();
    ctx.moveTo(16, 34);
    ctx.bezierCurveTo(6, 36, 2, 47, 2, 58);
    ctx.bezierCurveTo(2, 70, 6, 79, 16, 80);
    ctx.lineTo(18, 80);
    ctx.lineTo(18, 34);
    ctx.closePath();
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.stroke();

    // legs (they swing while swimming / walking)
    var swing = Math.sin(phase || 0) * 3;
    drawLeg(ctx, 20, 86 + swing * 0.4, dark);
    drawLeg(ctx, 47, 86 - swing * 0.4, dark);

    // body with a soft top light
    ctx.beginPath();
    ctx.moveTo(46, 10);
    ctx.bezierCurveTo(23, 10, 9, 26, 9, 48);
    ctx.lineTo(9, 76);
    ctx.bezierCurveTo(9, 87, 16, 94, 27, 94);
    ctx.lineTo(57, 94);
    ctx.bezierCurveTo(68, 94, 75, 87, 75, 76);
    ctx.lineTo(75, 42);
    ctx.bezierCurveTo(75, 23, 64, 10, 46, 10);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, 10, 0, 94);
    grad.addColorStop(0, lighter);
    grad.addColorStop(1, shade(hex, -0.1));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.stroke();

    // visor
    ctx.beginPath();
    ctx.ellipse(53, 41, 26, 19, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#a9e3f5';
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(53, 41, 24, 17, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(63, 33, 15, 9, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(53, 41, 26, 19, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
  function drawLeg(ctx, x, y, color){
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, 25, 19, 9.5);
    else {
      var r = 9.5;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + 25, y, x + 25, y + 19, r);
      ctx.arcTo(x + 25, y + 19, x, y + 19, r);
      ctx.arcTo(x, y + 19, x, y, r);
      ctx.arcTo(x, y, x + 25, y, r);
    }
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  }

  function spaceColor(id){
    for (var i = 0; i < CFG.colors.length; i += 1) if (CFG.colors[i].id === id) return CFG.colors[i].hex;
    return '#8899aa';
  }
  function spaceFrame(){
    requestAnimationFrame(spaceFrame);
    var visible = document.getElementById('auMenu');
    if (!space.canvas || !visible || !visible.classList.contains('on')) return;
    if (!space.w) spaceResize();
    var ctx = space.ctx;
    var w = space.w;
    var h = space.h;
    space.t += 0.016;
    ctx.clearRect(0, 0, w, h);

    // deep space + a faint nebula band, like the original window
    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#070c1a');
    bg.addColorStop(0.55, '#04060e');
    bg.addColorStop(1, '#0a0714');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(w * 0.62, h * 0.42);
    ctx.rotate(-0.5);
    var arc = ctx.createLinearGradient(-w * 0.5, 0, w * 0.5, 0);
    arc.addColorStop(0, '#00000000');
    arc.addColorStop(0.5, '#5c7fb8');
    arc.addColorStop(1, '#00000000');
    ctx.fillStyle = arc;
    ctx.fillRect(-w * 0.7, -h * 0.28, w * 1.4, h * 0.56);
    ctx.restore();

    // moving, twinkling stars
    for (var i = 0; i < space.stars.length; i += 1) {
      var star = space.stars[i];
      star.x -= star.speed * 0.016 * 3;
      if (star.x < -0.02) star.x = 1.02;
      var alpha = 0.35 + Math.abs(Math.sin(space.t * star.twinkle + star.phase)) * 0.65;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e7f2ff';
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // floating crewmates, each on its own lazy orbit
    for (var b = 0; b < space.beans.length; b += 1) {
      var bean = space.beans[b];
      var drift = space.t * bean.speed + bean.phase;
      var bx = (bean.x + Math.sin(drift * 0.6) * 0.05) * w;
      var by = (bean.y + Math.sin(drift) * bean.amp) * h;
      var unit = Math.min(w, h) * 0.22 * bean.scale;
      drawCrew(ctx, bx, by, unit, spaceColor(bean.color), Math.sin(drift * 0.7) * bean.tilt, drift * 2.2);
    }

  }
  function startSpace(){
    if (space.canvas) return;
    space.canvas = document.getElementById('auSpace');
    if (!space.canvas) return;
    space.ctx = space.canvas.getContext('2d');
    spaceSeed();
    spaceResize();
    window.addEventListener('resize', function(){ space.w = 0; spaceResize(); });
    requestAnimationFrame(spaceFrame);
  }

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
    if (name !== 'auMenu') {
      var panel = el('auSpacePlay');
      if (panel) panel.classList.remove('on');
      if (typeof stopOnline === 'function') stopOnline();
    }
    ['auMenu','auLobby','auStage'].forEach(function(id){
      var node = el(id);
      if (id === name) node.classList.add('on'); else node.classList.remove('on');
    });
    document.body.style.overflow = name === 'auStage' ? 'hidden' : 'auto';
    if (name === 'auMenu') startSpace();
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
  function storageGet(key, fallback){
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function storageSet(key, value){
    try { localStorage.setItem(key, value); } catch (e) {}
  }
  /**
   * The player name is the Telegram account name (first + last), never the
   * @username and never something typed here.
   */
  function tgAccountName(){
    var user = null;
    try { user = Telegram.WebApp.initDataUnsafe.user || null; } catch (e) {}
    if (!user) return '';
    var first = String(user.first_name || '').trim();
    var last = String(user.last_name || '').trim();
    var full = (first + ' ' + last).trim();
    return full.slice(0, 18);
  }
  function tgInitData(){
    try { return String(Telegram.WebApp.initData || ''); } catch (e) { return ''; }
  }
  function readName(){
    AU.name = tgAccountName() || 'لاعب';
    return AU.name;
  }

  /* ---------- profile: name, colour, unlocked cosmetics ---------- */
  var RARE = { gold: 3, silver: 3 };
  var profile = {
    name: tgAccountName() || 'لاعب',
    color: storageGet('au-color', 'red'),
    matches: Number(storageGet('au-matches', '0')) || 0,
    sound: storageGet('au-sound', '1') === '1',
    hints: storageGet('au-hints', '1') === '1'
  };
  function renderChip(){
    var box = el('auPlayerBean');
    if (box) box.innerHTML = crewSvg(profile.color);
    var label = el('auPlayerName');
    if (label) label.textContent = profile.name || 'لاعب';
  }
  function isUnlocked(colorId){
    if (!RARE[colorId]) return true;
    return profile.matches >= RARE[colorId];
  }
  /** Every sound is synthesised by the shared engine: no audio files. */
  function sfx(name){
    try { if (window.GameSfx && profile.sound) window.GameSfx.play(name); } catch (e) {}
  }
  function beep(){ sfx('click'); }
  function setColor(colorId){
    if (!isUnlocked(colorId)) { toast('هذا اللون بعده مقفول — افتحه من المتجر'); return; }
    profile.color = colorId;
    storageSet('au-color', colorId);
    renderChip();
    renderColors();
  }
  function renderColors(){
    var grid = el('auColorGrid');
    if (!grid) return;
    grid.innerHTML = CFG.colors.filter(function(c){ return !RARE[c.id]; }).map(function(color){
      return '<button class="color' + (profile.color === color.id ? ' on' : '') + '" data-color="' + color.id + '" title="' + color.name + '">' +
        crewSvg(color.id) + '<small>' + color.name + '</small></button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('[data-color]'), function(node){
      node.addEventListener('click', function(){ setColor(node.getAttribute('data-color')); });
    });
  }
  function renderShop(){
    var grid = el('auShopGrid');
    if (!grid) return;
    grid.innerHTML = CFG.colors.filter(function(c){ return RARE[c.id]; }).map(function(color){
      var open = isUnlocked(color.id);
      return '<button class="color' + (open ? '' : ' locked') + (profile.color === color.id ? ' on' : '') + '" data-color="' + color.id + '">' +
        crewSvg(color.id) + '<small>' + color.name + '</small>' +
        (open ? '' : '<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="#dfe9ff" stroke-width="2.4"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>') +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('[data-color]'), function(node){
      node.addEventListener('click', function(){
        var id = node.getAttribute('data-color');
        if (!isUnlocked(id)) return toast('تحتاج ' + RARE[id] + ' مباريات — عندك ' + profile.matches);
        setColor(id);
        renderShop();
      });
    });
    el('auShopHint').textContent = 'عندك ' + profile.matches + ' مباريات مكتملة · الألوان النادرة تنفتح بعد ' + RARE.gold;
  }
  function renderProfile(){
    el('auProfile').innerHTML =
      '<div><span>الاسم</span><b>' + esc(profile.name) + '</b></div>' +
      '<div><span>اللون</span><b>' + esc((CFG.colors.filter(function(c){ return c.id === profile.color; })[0] || {}).name || profile.color) + '</b></div>' +
      '<div><span>مباريات مكتملة</span><b>' + profile.matches + '</b></div>' +
      '<div><span>ألوان نادرة</span><b>' + CFG.colors.filter(function(c){ return RARE[c.id] && isUnlocked(c.id); }).length + ' / 2</b></div>';
  }
  function countMatch(code){
    if (!code) return;
    var seen = storageGet('au-seen', '');
    if (seen.indexOf('|' + code + '|') >= 0) return;
    storageSet('au-seen', (seen + '|' + code + '|').slice(-400));
    profile.matches += 1;
    storageSet('au-matches', String(profile.matches));
  }
  function openDialog(id){
    var node = el(id);
    if (node) node.classList.add('on');
  }
  function closeDialog(id){
    var node = el(id);
    if (node) node.classList.remove('on');
  }
  /* ---------- the play screens inside the launch window ---------- */
  var ROOM_RULES = {
    maxPlayers: { label: 'عدد اللاعبين', values: [6, 8, 10] },
    impostors: { label: 'المزوّرين', values: [0, 1, 2, 3], names: { 0: 'تلقائي' } },
    tasks: { label: 'مهام لكل لاعب', values: [3, 4, 5] },
    killCooldownMs: { label: 'تبريد القتل', values: [15000, 25000, 40000], names: { 15000: '15 ثانية', 25000: '25 ثانية', 40000: '40 ثانية' } },
    meetingMs: { label: 'مدة الاجتماع', values: [30000, 45000, 60000], names: { 30000: '30 ثانية', 45000: '45 ثانية', 60000: '60 ثانية' } }
  };
  var roomDraft = { maxPlayers: 10, impostors: 0, tasks: 5, killCooldownMs: 25000, meetingMs: 45000 };
  var onlineTimer = 0;

  function showView(id){
    ['auViewPick', 'auViewSettings', 'auViewOnline'].forEach(function(viewId){
      var node = el(viewId);
      if (!node) return;
      if (viewId === id) node.classList.add('on'); else node.classList.remove('on');
    });
    if (id !== 'auViewOnline') stopOnline();
    if (id !== 'auViewPick') el('auJoinBox').classList.remove('on');
  }

  function renderRuleRows(){
    var host = el('auSettingRows');
    if (!host) return;
    host.innerHTML = Object.keys(ROOM_RULES).map(function(key){
      var rule = ROOM_RULES[key];
      return '<div class="sp-row" data-row="' + key + '"><span>' + rule.label + '</span><div class="sp-opts">' +
        rule.values.map(function(value){
          var label = (rule.names && rule.names[value]) || String(value);
          return '<button class="sp-opt' + (roomDraft[key] === value ? ' on' : '') + '" data-key="' + key + '" data-value="' + value + '">' + label + '</button>';
        }).join('') + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('[data-key]'), function(node){
      node.addEventListener('click', function(){
        roomDraft[node.getAttribute('data-key')] = Number(node.getAttribute('data-value'));
        if (roomDraft.impostors > Math.floor(roomDraft.maxPlayers / 3)) roomDraft.impostors = 0;
        renderRuleRows();
      });
    });
  }

  function createRoom(){
    api('/rooms', { action: 'create', name: readName(), color: profile.color, settings: roomDraft, initData: tgInitData() }).then(function(res){
      if (!res.ok) return toast(res.error || 'تعذّر إنشاء الغرفة');
      AU.code = res.code; AU.token = res.token;
      history.replaceState(null, '', '?code=' + res.code);
      applyRoom(res.room);
    });
  }

  function joinByCode(code){
    if (!code || code.length < 4) return toast('اكتب كود الغرفة');
    api('/rooms/' + code, { action: 'join', name: readName(), code: code, color: profile.color, initData: tgInitData() }).then(function(res){
      if (!res.ok) return toast(res.error || 'ما گدرنا ندخل');
      AU.code = res.code; AU.token = res.token;
      history.replaceState(null, '', '?code=' + res.code);
      applyRoom(res.room);
    });
  }

  function stopOnline(){
    if (onlineTimer) { clearInterval(onlineTimer); onlineTimer = 0; }
  }

  function renderRooms(list){
    var host = el('auRoomList');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<div class="sp-empty">ماكو غرف مفتوحة هسه<br>سوِّ غرفة وشارك الكود ويا ربعك</div>';
      return;
    }
    host.innerHTML = list.map(function(room){
      var busy = !room.joinable;
      var count = room.players + '/' + room.maxPlayers;
      var impostors = room.settings && room.settings.impostors ? room.settings.impostors : 'تلقائي';
      return '<button class="sp-room' + (busy ? ' busy' : '') + '" data-code="' + room.code + '"' + (busy ? ' disabled' : '') + '>' +
        '<span class="code">' + room.code + '</span>' +
        '<span class="who"><b>' + esc(room.host || 'مضيف') + '</b><small>' +
          (room.phase === 'lobby' ? 'بالانتظار · مزوّرين ' + impostors : 'المباراة شغّالة') + '</small></span>' +
        '<span class="n">' + count + '</span></button>';
    }).join('');
    Array.prototype.forEach.call(host.querySelectorAll('[data-code]'), function(node){
      node.addEventListener('click', function(){ joinByCode(node.getAttribute('data-code')); });
    });
  }

  function loadRooms(){
    fetch('/api/amongus/rooms').then(function(r){ return r.json(); }).then(function(res){
      if (!el('auViewOnline').classList.contains('on')) return;
      renderRooms((res && res.rooms) || []);
    }).catch(function(){});
  }

  function openOnline(){
    showView('auViewOnline');
    el('auRoomList').innerHTML = '<div class="sp-empty">نبحث عن الغرف…</div>';
    loadRooms();
    stopOnline();
    onlineTimer = setInterval(loadRooms, 2500);
  }

  function openPlay(){
    var panel = el('auSpacePlay');
    if (!panel) return;
    panel.classList.add('on');
    var hint = el('auSpaceHint');
    if (hint) hint.style.opacity = '0';
    el('auJoinBox').classList.remove('on');
    showView('auViewPick');
    renderRuleRows();
  }
  function closePlay(){
    var panel = el('auSpacePlay');
    if (panel) panel.classList.remove('on');
    stopOnline();
    var hint = el('auSpaceHint');
    if (hint) hint.style.opacity = profile.hints ? '0.8' : '0';
  }
  function wireMenu(){
    var openers = {
      auInventoryBtn: 'auInvDialog', auShopBtn: 'auShopDialog',
      auAccountBtn: 'auAccDialog', auSettingsBtn: 'auSetDialog', auFriendsBtn: 'auFriendsDialog'
    };
    el('auPlayBtn').addEventListener('click', openPlay);
    el('auPlayBack').addEventListener('click', closePlay);
    el('auCreate').addEventListener('click', function(){ showView('auViewSettings'); renderRuleRows(); });
    el('auSettingsBack').addEventListener('click', function(){ showView('auViewPick'); });
    el('auCreateRoom').addEventListener('click', createRoom);
    el('auOnlineCard').addEventListener('click', function(){ openOnline(); });
    el('auOnlineBack').addEventListener('click', function(){ showView('auViewPick'); });
    el('auRefresh').addEventListener('click', loadRooms);
    el('auCodeCard').addEventListener('click', function(){
      var box = el('auJoinBox');
      box.classList.toggle('on');
      if (box.classList.contains('on')) { el('auCode').focus(); }
      else el('auCode').value = '';
    });
    Object.keys(openers).forEach(function(buttonId){
      var button = el(buttonId);
      if (button) button.addEventListener('click', function(){
        if (buttonId === 'auInventoryBtn') renderColors();
        if (buttonId === 'auShopBtn') renderShop();
        if (buttonId === 'auAccountBtn') renderProfile();
        openDialog(openers[buttonId]);
      });
    });
    var closers = {
      auInvClose: 'auInvDialog', auShopClose: 'auShopDialog',
      auAccClose: 'auAccDialog', auSetClose: 'auSetDialog', auFriendsClose: 'auFriendsDialog'
    };
    Object.keys(closers).forEach(function(buttonId){
      var button = el(buttonId);
      if (button) button.addEventListener('click', function(){ closeDialog(closers[buttonId]); });
    });
    el('auSoundToggle').checked = profile.sound;
    el('auSoundToggle').addEventListener('change', function(){
      profile.sound = el('auSoundToggle').checked;
      storageSet('au-sound', profile.sound ? '1' : '0');
      try { window.GameSfx && window.GameSfx.setEnabled(profile.sound); } catch (e) {}
      if (profile.sound) beep();
    });
    var musicSwitch = el('auMusicToggle');
    if (musicSwitch) {
      musicSwitch.checked = window.GameSfx ? window.GameSfx.musicEnabled() : true;
      musicSwitch.addEventListener('change', function(){
        var on = musicSwitch.checked;
        try {
          if (window.GameSfx) window.GameSfx.music.setEnabled(on);
          if (on && window.GameSfx) window.GameSfx.music.start();
        } catch (e) {}
        storageSet('au-music', on ? '1' : '0');
      });
    }
    el('auHintsToggle').checked = profile.hints;
    el('auHintsToggle').addEventListener('change', function(){
      profile.hints = el('auHintsToggle').checked;
      storageSet('au-hints', profile.hints ? '1' : '0');
      var hint = el('auSpaceHint');
      if (hint) hint.style.opacity = profile.hints ? '0.8' : '0';
    });
    el('auResetBtn').addEventListener('click', function(){
      ['au-name', 'au-color', 'au-matches', 'au-seen', 'au-sound', 'au-hints'].forEach(function(key){
        try { localStorage.removeItem(key); } catch (e) {}
      });
      profile.matches = 0;
      profile.color = 'red';
      closeDialog('auSetDialog');
      renderChip();
      toast('انمسحت البيانات المحلية');
    });
    var link = location.origin + '/amongus';
    el('auShareLink').textContent = link;
    el('auCopyBtn').addEventListener('click', function(){
      var done = function(){ toast('انسخ الرابط: ' + link); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(function(){ toast('انتسخ الرابط'); }).catch(done);
      else done();
    });
    el('auShareBtn').addEventListener('click', function(){
      var share = 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('العب امونق اس وياي');
      try {
        if (window.Telegram && Telegram.WebApp && Telegram.WebApp.openTelegramLink) Telegram.WebApp.openTelegramLink(share);
        else window.open(share, '_blank');
      } catch (e) { window.open(share, '_blank'); }
    });
    var hint = el('auSpaceHint');
    if (hint) hint.style.opacity = profile.hints ? '0.8' : '0';
  }
  try { localStorage.removeItem('au-name'); } catch (e) {}
  renderChip();
  wireMenu();
  startSpace();

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

  el('auJoin').addEventListener('click', function(){
    joinByCode((el('auCode').value || '').trim().toUpperCase());
  });
  el('auCode').addEventListener('keydown', function(event){
    if (event.key === 'Enter') joinByCode((el('auCode').value || '').trim().toUpperCase());
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
    try { roomSounds(room); } catch (e) {}
    if (room.phase === 'ended') countMatch(room.code);
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

  /* ---------- sound: everything is synthesised, nothing is downloaded ---------- */
  try {
    if (window.GameSfx) {
      window.GameSfx.setEnabled(profile.sound);
      window.GameSfx.buttonSounds('click');
      var hudTop = el('auHudTop');
      if (hudTop) window.GameSfx.mountToggle({ container: '#auHudTop', inline: true, size: 34 });
      window.GameSfx.music.start();
    }
  } catch (e) {}
  window.addEventListener('pagehide', function(){ try { if (window.GameSfx) window.GameSfx.music.stop(); } catch (e) {} });

  /* Sounds that belong to a game event rather than a tap. */
  var soundSeen = { bodies: 0, progress: 0, phase: '', meeting: '', ended: false, alive: 0, sabotage: false, started: false };
  function roomSounds(room){
    if (!room) return;
    var bodies = (room.bodies || []).length;
    var progress = room.progress ? Number(room.progress.done || 0) : 0;
    var alive = (room.players || []).filter(function(p){ return p.alive; }).length;
    var meetingKey = room.meeting ? String(room.meeting.reason) + '@' + String(room.meeting.endsAt) : '';
    if (!soundSeen.started) {
      soundSeen.started = true;
      soundSeen.bodies = bodies; soundSeen.progress = progress; soundSeen.alive = alive;
      soundSeen.phase = room.phase; soundSeen.meeting = meetingKey; soundSeen.sabotage = Boolean(room.sabotage);
      return;
    }
    if (bodies > soundSeen.bodies) sfx('kill');
    if (progress > soundSeen.progress) sfx('task');
    if (meetingKey && !soundSeen.meeting) sfx(room.meeting.reason === 'report' ? 'report' : 'alarm');
    if (!meetingKey && soundSeen.meeting && room.lastMeeting && room.lastMeeting.ejectedName) sfx('eject');
    if (room.sabotage && !soundSeen.sabotage) sfx('sabotage');
    if (alive < soundSeen.alive && !(bodies > soundSeen.bodies)) sfx('death');
    if (room.phase === 'ended' && !soundSeen.ended) {
      soundSeen.ended = true;
      var me = (room.players || []).filter(function(p){ return p.you; })[0];
      var iWon = room.winner === 'impostors'
        ? !!(me && me.role === 'impostor')
        : !!(me && me.role !== 'impostor');
      sfx(iWon ? 'win' : 'lose');
      try { if (window.GameSfx) window.GameSfx.music.stop(); } catch (e) {}
    }
    soundSeen.bodies = bodies; soundSeen.progress = progress; soundSeen.alive = alive;
    soundSeen.phase = room.phase; soundSeen.meeting = meetingKey;
    soundSeen.sabotage = Boolean(room.sabotage);
  }

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
  /** In-ship crewmate: the same renderer as the launch window. */
  function drawBean(px, py, unit, hex, dead, name, isYou){
    ctx.save();
    ctx.globalAlpha = dead ? 0.42 : 1;
    drawCrew(ctx, px, py, unit, hex, 0, 0, { shadow: !dead });
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
      ctx.fillText(name, px, py - size.scale * 2.1);
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
      drawBean(pos.x, pos.y, size.scale * 3.6, colorHex(player.color), !player.alive, player.name, false);
    });

    // you last, on top
    if (me) {
      var own = toScreen(world.x, world.y);
      drawBean(own.x, own.y, size.scale * 3.9, colorHex(me.color), !me.alive, me.name, true);
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
    if (now - (world.lastStep || 0) > 380) {
      world.lastStep = now;
      sfx('step');
    }
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
  el('auVent').addEventListener('click', function(){ sfx('vent'); act('vent'); });
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
