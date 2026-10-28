// Drawing-room styling is scoped to this game's room, not other games or the lobby.
export const DRAWING_ROOM_CSS = String.raw`
body:has(#gameApp[data-page="room"][data-game="gartic"]){background:#f3f7fc!important;color:#173957}
body:has(#gameApp[data-page="room"][data-game="gartic"]),body.telegram-fullscreen:has(#gameApp[data-page="room"][data-game="gartic"]){padding-top:max(6px,min(26px,var(--tg-content-top,0px)))!important}
body:has(#gameApp[data-page="room"][data-game="gartic"]) .ambient-backdrop{display:none!important}
#gameApp[data-page="room"][data-game="gartic"]{max-width:1340px;width:100%}
#gameApp[data-page="room"][data-game="gartic"]>.topbar,#gameApp[data-page="room"][data-game="gartic"]>.game-footer{display:none!important}
#roomPage[data-game="gartic"]{padding:clamp(6px,1.2vw,14px)!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;color:#153653}
#roomPage[data-game="gartic"]>.room-header{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0 4px 8px;color:#173957}
#roomPage[data-game="gartic"]>.room-header h1{color:#123d68!important;font-size:clamp(16px,1.6vw,21px);line-height:1.2;margin:0}
#roomPage[data-game="gartic"]>.room-header p{color:#577795!important;margin:0;font-size:11px}
#roomPage[data-game="gartic"]>.room-header .button{background:#1688e9!important;color:white!important;border:1px solid #0c67b8!important}
#roomPage[data-game="gartic"] #roomContent{padding:0;text-align:start;font-size:14px;color:#173957}

/* ---------- layout ---------- */
#roomPage[data-game="gartic"] .draw-room{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;direction:ltr;align-items:start}
#roomPage[data-game="gartic"] .draw-room-players{grid-area:players;direction:rtl;background:#fff;border:1px solid #d9e7f3;border-radius:14px;overflow:hidden;box-shadow:0 4px 16px #204a7310}
#roomPage[data-game="gartic"] .draw-room-board{grid-area:board;direction:rtl;min-width:0;display:flex;flex-direction:column;gap:6px}
#roomPage[data-game="gartic"] .draw-room-bottom{grid-area:bottom;direction:rtl;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}
#roomPage[data-game="gartic"] .draw-room-tools{grid-area:tools;direction:ltr;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid #1d4a80;border-radius:14px;background:linear-gradient(180deg,#164a80,#123a66);box-shadow:0 4px 14px #0b2b4a33}
#roomPage[data-game="gartic"] .draw-standings{grid-column:1/-1}

/* ---------- players ---------- */
#roomPage[data-game="gartic"] .draw-players-title{display:flex;justify-content:space-between;align-items:center;padding:10px 13px;color:#174675;font-weight:900;border-bottom:1px solid #e6eef6;font-size:12px}
#roomPage[data-game="gartic"] .draw-players-title small{color:#6b8aa5;font-weight:700}
#roomPage[data-game="gartic"] .draw-player-list{max-height:min(70dvh,660px);overflow:auto}
#roomPage[data-game="gartic"] .draw-player-row{display:flex;align-items:center;gap:9px;min-height:60px;padding:8px 11px;border-bottom:1px solid #eaf0f5}
#roomPage[data-game="gartic"] .draw-player-row:last-child{border-bottom:0}
#roomPage[data-game="gartic"] .draw-player-row.drawing{background:#eaf5ff;box-shadow:inset 3px 0 0 #1c86e6}
#roomPage[data-game="gartic"] .draw-player-row.empty{opacity:.6}
.draw-account-avatar{position:relative;display:grid;place-items:center;flex:none;overflow:hidden;width:42px;height:42px;border-radius:50%;background:#e5f1fb;border:2px solid #c5ddef;color:#20557d;font-size:17px;font-weight:900;line-height:1}
.draw-account-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.draw-account-avatar.lobby-avatar{width:100px;height:100px;margin:0 auto 18px;font-size:36px}
#roomPage[data-game="gartic"] .draw-player-copy{min-width:0;flex:1;display:grid;gap:1px}
#roomPage[data-game="gartic"] .draw-player-copy strong{display:flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#294861}
#roomPage[data-game="gartic"] .draw-player-copy small{font-size:11px;color:#176db0;font-weight:800}
#roomPage[data-game="gartic"] .draw-player-state{font-size:14px;font-weight:800;color:#238857;white-space:nowrap}

/* ---------- board ---------- */
#roomPage[data-game="gartic"] .draw-word-bar{display:flex;align-items:center;justify-content:center;gap:10px;padding:7px 10px;border-radius:12px;background:linear-gradient(180deg,#1b4f8b,#123a66);color:#fff;direction:ltr}
#roomPage[data-game="gartic"] .draw-word-bar.guesser{background:#eaf3fc;color:#123d68;border:1px solid #cfe2f3}
#roomPage[data-game="gartic"] .draw-word{letter-spacing:.28em;font-size:15px;font-weight:950;text-transform:none;padding:0 6px;min-width:60px;text-align:center}
#roomPage[data-game="gartic"] .draw-word-btn{padding:5px 12px;border:1px solid #ffffff55;border-radius:8px;background:#ffffff14;color:#fff;font-size:11px;font-weight:900;letter-spacing:.04em;cursor:pointer}
#roomPage[data-game="gartic"] .draw-word-btn:disabled{opacity:.35;cursor:default}
#roomPage[data-game="gartic"] .draw-canvas-wrap{position:relative;display:grid;place-items:center;width:100%;margin:0;border:1px solid #d9e7f3;border-radius:14px;background:#fff;overflow:hidden;box-shadow:0 4px 16px #204a7310}
#roomPage[data-game="gartic"] .draw-canvas{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100dvh - 350px);aspect-ratio:900/580;touch-action:none;background:#fff}
#roomPage[data-game="gartic"] .draw-wait-overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;padding:16px;text-align:center;color:#6f8ba2;background:#ffffffee;pointer-events:none}
#roomPage[data-game="gartic"] .draw-wait-overlay strong{font-size:clamp(15px,2vw,21px);color:#285d8c}
#roomPage[data-game="gartic"] .draw-wait-overlay span{font-size:12px}
#roomPage[data-game="gartic"] .draw-wait-overlay.reveal strong{color:#0d7a4e}
#roomPage[data-game="gartic"] .draw-room-timer{display:flex;align-items:center;gap:10px;padding:2px 4px 0;color:#28577f;font-size:11px;font-weight:800}
#roomPage[data-game="gartic"] .draw-room-timer small{color:#7a94a9;font-weight:700}
#roomPage[data-game="gartic"] .draw-room-timer .timer-track{height:9px;flex:1;margin:0;background:#dcebf8;border-radius:9px;overflow:hidden}
#roomPage[data-game="gartic"] .draw-room-timer .timer-track i{display:block;height:100%;background:linear-gradient(90deg,#f7c948,#e9a92c);border-radius:9px;transition:width .5s linear}

/* ---------- word choice ---------- */
#roomPage[data-game="gartic"] .draw-choose{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:16px;text-align:center;background:#ffffffee}
#roomPage[data-game="gartic"] .draw-choose h3{margin:0;font-size:clamp(16px,2.2vw,23px);color:#123d68;font-weight:950}
#roomPage[data-game="gartic"] .draw-choose-options{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px}
#roomPage[data-game="gartic"] .draw-word-choice{display:grid;gap:3px;min-width:130px;padding:9px 16px;border:2px solid #123a66;border-radius:12px;background:#ffd23f;color:#0f2f52;font:inherit;cursor:pointer;box-shadow:0 3px 0 #b98f10}
#roomPage[data-game="gartic"] .draw-word-choice b{font-size:15px;font-weight:950}
#roomPage[data-game="gartic"] .draw-word-choice span{font-size:11px;font-weight:800}
#roomPage[data-game="gartic"] .draw-or{color:#5b7a95;font-weight:900;font-size:12px}
#roomPage[data-game="gartic"] .draw-choose-timer{color:#6b8aa5;font-size:11px;font-weight:800}

/* ---------- tool rail ---------- */
#roomPage[data-game="gartic"] .draw-tool-group{display:grid;gap:4px}
#roomPage[data-game="gartic"] .draw-tool{display:grid;place-items:center;width:32px;height:30px;padding:0;border:1px solid #ffffff2e;border-radius:8px;background:#ffffff12;color:#eaf4ff;font-size:14px;line-height:1;cursor:pointer}
#roomPage[data-game="gartic"] .draw-tool.active{background:#2f9bf0;border-color:#8fd0ff;box-shadow:0 0 0 1px #8fd0ff88}
#roomPage[data-game="gartic"] .palette-grid{display:grid;grid-template-columns:repeat(4,11px);gap:3px;justify-content:center}
#roomPage[data-game="gartic"] .palette-color{width:11px;height:11px;padding:0;border:1px solid #ffffff44;border-radius:2px;background:var(--swatch);cursor:pointer;box-shadow:none}
#roomPage[data-game="gartic"] .palette-color.active{outline:2px solid #ffe066;outline-offset:1px;transform:none}
#roomPage[data-game="gartic"] .draw-size{display:grid;justify-items:center;gap:2px;color:#cfe3f6;font-size:10px;font-weight:800}
#roomPage[data-game="gartic"] .draw-size input{width:84px;height:16px;accent-color:#2f9bf0}

/* ---------- answers + logs ---------- */
#roomPage[data-game="gartic"] .draw-feed-card,#roomPage[data-game="gartic"] .draw-logs-card{background:#fff;border:1px solid #d9e7f3;border-radius:14px;padding:0 12px 10px;min-width:0;box-shadow:0 4px 16px #204a7310;display:flex;flex-direction:column}
#roomPage[data-game="gartic"] .draw-feed-title{padding:7px 0;margin:0 -12px 6px;background:linear-gradient(180deg,#1b4f8b,#123a66);color:#fff;text-align:center;font-size:11px;font-weight:950;letter-spacing:.14em;border-radius:13px 13px 0 0}
#roomPage[data-game="gartic"] .draw-room-feed{height:clamp(96px,17vh,168px);overflow:auto;padding:2px 0;color:#385b78;font-size:12px}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry{padding:3px 6px;border-radius:6px}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry.correct{background:#e9f8ee;color:#228044;font-weight:800}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry.near{background:#fff6d1;color:#865a00}
#roomPage[data-game="gartic"] .draw-guess-reveal{padding:4px 6px;border-radius:6px;background:#eaf5ff;color:#125f9e;font-weight:800}
#roomPage[data-game="gartic"] .draw-log-entry{display:flex;align-items:flex-start;gap:6px;padding:2px 4px;color:#4a6d8a;line-height:1.5}
#roomPage[data-game="gartic"] .draw-log-entry i{font-style:normal;flex:none;width:14px;text-align:center;opacity:.85}
#roomPage[data-game="gartic"] .draw-log-entry.answer{color:#125f9e;font-weight:800}
#roomPage[data-game="gartic"] .draw-log-entry.turn{color:#1c7a45;font-weight:800}
#roomPage[data-game="gartic"] .draw-log-entry.chat b{color:#174675}
#roomPage[data-game="gartic"] .draw-empty{color:#7892a8;font-size:12px}
#roomPage[data-game="gartic"] .draw-drawer-note{margin-top:6px;color:#7892a8;font-size:11px;text-align:center}
#roomPage[data-game="gartic"] .guess-form{display:flex;gap:6px;margin:6px 0 0}
#roomPage[data-game="gartic"] .guess-form .guess-input{flex:1;min-width:0;padding:7px 10px;border-radius:9px;background:#fff!important;color:#163957!important;border:1px solid #a6c4dc!important;font-size:12px}
#roomPage[data-game="gartic"] .guess-form .button{width:auto;min-height:34px;padding:6px 12px;border-radius:9px;background:#1688e9!important;color:#fff!important;border:1px solid #0c67b8!important;font-size:11px}
#roomPage[data-game="gartic"] .draw-room-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
#roomPage[data-game="gartic"] .draw-room-actions .button{width:auto;min-height:36px;padding:6px 14px;border-radius:9px}
#roomPage[data-game="gartic"] .draw-room-actions .button.primary{background:#1688e9!important;color:#fff!important;border:1px solid #0c67b8!important}
#roomPage[data-game="gartic"] .draw-room-status{font-size:12px;color:#587995}

/* ---------- standings + invite failures ---------- */
#roomPage[data-game="gartic"] .draw-standings{background:white;border:1px solid #d9e7f3;border-radius:14px;padding:16px;color:#173957}
#roomPage[data-game="gartic"] .draw-standings h2{font-size:19px;margin:0 0 10px}
#roomPage[data-game="gartic"] .draw-standing{display:flex;align-items:center;gap:10px;padding:9px;border-bottom:1px solid #e7eef4}
#roomPage[data-game="gartic"] .draw-standing strong{flex:1;min-width:0;display:flex;align-items:center;gap:4px}
#roomPage[data-game="gartic"] .draw-standing span:last-child{font-weight:800;color:#176db0}
#roomPage .room-card.draw-join-failure{max-width:520px;margin:14px auto;padding:20px;display:grid;gap:10px;background:#0f2a4d!important;border:1px solid #3f6d9b!important;border-radius:14px!important;color:#eaf3ff!important;text-align:start}
#roomPage .draw-join-failure h2{margin:0;font-size:18px;color:#ffffff!important;font-weight:900}
#roomPage .draw-join-failure p{margin:0;font-size:13px;line-height:1.75;color:#c7dcf2!important}
#roomPage .draw-join-failure .draw-join-hint{color:#8fe3ff!important;font-weight:800}
#roomPage .draw-join-failure .field-label{color:#dbe9f8!important}
#roomPage .draw-join-retry{display:flex;gap:8px;flex-wrap:wrap}
#roomPage .draw-join-retry .guess-input{flex:1;min-width:150px;background:#fff!important;color:#163957!important;border:1px solid #a6c4dc!important}
#roomPage .draw-join-retry .button.primary{background:#1688e9!important;color:#fff!important;border:1px solid #0c67b8!important;white-space:nowrap}
#roomPage .draw-join-failure #backToGamesButton{background:#173961!important;color:#eaf3ff!important;border:1px solid #5278a1!important}

/* ---------- phones ---------- */
@media(max-width:899px){
  #roomPage[data-game="gartic"] .draw-room{grid-template-areas:"board" "tools" "bottom" "players"}
  #roomPage[data-game="gartic"] .draw-room-tools{flex-direction:row;justify-content:center}
  #roomPage[data-game="gartic"] .draw-tool-group{grid-auto-flow:column;grid-auto-columns:max-content}
  #roomPage[data-game="gartic"] .palette-grid{grid-template-columns:repeat(10,11px)}
  #roomPage[data-game="gartic"] .draw-size{grid-auto-flow:column;align-items:center}
  #roomPage[data-game="gartic"] .draw-canvas{width:100%;max-height:min(46dvh,420px)}
  #roomPage[data-game="gartic"] .draw-player-list{max-height:260px}
  #roomPage[data-game="gartic"] .draw-room-feed{height:118px}
  .draw-account-avatar.lobby-avatar{width:80px;height:80px;font-size:28px;margin-bottom:16px}
}

/* ---------- wide room: players | tools | board, answers + logs under the board ---------- */
@media(min-width:900px){
  #roomPage[data-game="gartic"] .draw-room[data-tools="on"]{grid-template-columns:minmax(180px,220px) 58px minmax(0,1fr);grid-template-areas:"players tools board" "players tools bottom";align-items:start}
  #roomPage[data-game="gartic"] .draw-room[data-tools="off"]{grid-template-columns:minmax(180px,220px) minmax(0,1fr);grid-template-areas:"players board" "players bottom"}
  #roomPage[data-game="gartic"] .draw-room-bottom{grid-template-columns:minmax(0,1.85fr) minmax(min(100%,190px),1fr)}
  #roomPage[data-game="gartic"] .draw-room-tools{flex-direction:column;flex-wrap:nowrap;align-items:center;padding:8px 6px;gap:8px;align-self:start;position:sticky;top:6px}
  #roomPage[data-game="gartic"] .draw-room-feed{height:clamp(110px,17vh,170px)}
}
@media(min-width:1200px) and (min-height:640px){
  #roomPage[data-game="gartic"] .draw-room[data-tools="on"]{grid-template-columns:minmax(190px,235px) 58px minmax(0,1fr)}
  #roomPage[data-game="gartic"] .draw-canvas{max-height:calc(100dvh - 340px)}
}
@media(min-width:900px) and (max-height:640px){
  #roomPage[data-game="gartic"] .draw-room-feed{height:92px}
}
`;
