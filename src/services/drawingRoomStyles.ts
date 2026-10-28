// Drawing-room styling is scoped to this game's room, not other games or the lobby.
export const DRAWING_ROOM_CSS = String.raw`
body:has(#gameApp[data-page="room"][data-game="gartic"]){background:#f3f7fc!important;color:#173957}
body:has(#gameApp[data-page="room"][data-game="gartic"]),body.telegram-fullscreen:has(#gameApp[data-page="room"][data-game="gartic"]){padding-top:max(6px,min(26px,var(--tg-content-top,0px)))!important}
body:has(#gameApp[data-page="room"][data-game="gartic"]) .ambient-backdrop{display:none!important}
#gameApp[data-page="room"][data-game="gartic"]{max-width:1300px;width:100%}
#gameApp[data-page="room"][data-game="gartic"]>.topbar,#gameApp[data-page="room"][data-game="gartic"]>.game-footer{display:none!important}
#roomPage[data-game="gartic"]{padding:clamp(8px,1.5vw,18px)!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;color:#153653}
#roomPage[data-game="gartic"]>.room-header{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0 4px 10px;color:#173957}
#roomPage[data-game="gartic"]>.room-header h1{color:#123d68!important;font-size:clamp(17px,1.7vw,22px);line-height:1.2}
#roomPage[data-game="gartic"]>.room-header p{color:#577795!important}
#roomPage[data-game="gartic"]>.room-header .button{background:#1688e9!important;color:white!important;border:1px solid #0c67b8!important}
#roomPage[data-game="gartic"] #roomContent{padding:0;text-align:start;font-size:14px;color:#173957}
#roomPage[data-game="gartic"] .draw-room{display:grid;grid-template-columns:minmax(195px,260px) minmax(0,1fr);grid-template-areas:"players main";gap:14px;direction:ltr;align-items:start}
#roomPage[data-game="gartic"] .draw-room-players{grid-area:players;direction:rtl;background:#fff;border:1px solid #d9e7f3;border-radius:13px;overflow:hidden;box-shadow:0 4px 16px #204a7310}
#roomPage[data-game="gartic"] .draw-players-title{display:flex;justify-content:space-between;align-items:center;padding:14px;color:#174675;font-weight:900;border-bottom:1px solid #e6eef6}
#roomPage[data-game="gartic"] .draw-player-list{max-height:min(68dvh,650px);overflow:auto}
#roomPage[data-game="gartic"] .draw-player-row{display:flex;align-items:center;gap:10px;min-height:70px;padding:10px 12px;border-bottom:1px solid #eaf0f5}
#roomPage[data-game="gartic"] .draw-player-row:last-child{border-bottom:0}
.draw-account-avatar{position:relative;display:grid;place-items:center;flex:none;overflow:hidden;width:48px;height:48px;border-radius:50%;background:#e5f1fb;border:2px solid #c5ddef;color:#20557d;font-size:19px;font-weight:900;line-height:1}
.draw-account-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.draw-account-avatar.lobby-avatar{width:100px;height:100px;margin:0 auto 18px;font-size:36px}
#roomPage[data-game="gartic"] .draw-player-copy{min-width:0;flex:1;display:grid;gap:2px}
#roomPage[data-game="gartic"] .draw-player-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;color:#294861}
#roomPage[data-game="gartic"] .draw-player-copy small{font-size:12px;color:#176db0;font-weight:800}
#roomPage[data-game="gartic"] .draw-player-state{font-size:12px;font-weight:800;color:#238857;white-space:nowrap}
#roomPage[data-game="gartic"] .draw-room-main{grid-area:main;min-width:0;direction:rtl;display:grid;gap:14px}
#roomPage[data-game="gartic"] .draw-board-card,#roomPage[data-game="gartic"] .draw-feed-card,#roomPage[data-game="gartic"] .draw-chat-card{background:#fff;border:1px solid #d9e7f3;border-radius:13px;overflow:hidden;box-shadow:0 4px 16px #204a7310}
#roomPage[data-game="gartic"] .draw-board-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #eaf0f5}
#roomPage[data-game="gartic"] .draw-board-head strong{color:#153e68;font-size:14px}
#roomPage[data-game="gartic"] .draw-hint{padding:5px 13px;background:#164988;color:#fff;border-radius:8px;font-size:13px;font-weight:800;overflow-wrap:anywhere}
#roomPage[data-game="gartic"] .draw-canvas-wrap{position:relative;width:100%;max-width:none;margin:0;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff;overflow:hidden}
#roomPage[data-game="gartic"] .draw-canvas{display:block;width:100%;height:auto;aspect-ratio:900/580;touch-action:none;background:#fff}
#roomPage[data-game="gartic"] .draw-wait-overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;padding:20px;text-align:center;color:#6686a0;pointer-events:none}
#roomPage[data-game="gartic"] .draw-wait-overlay strong{font-size:clamp(18px,2.2vw,24px);color:#285d8c}
#roomPage[data-game="gartic"] .draw-room-timer{display:flex;align-items:center;gap:12px;padding:10px 16px;color:#28577f;font-size:12px;font-weight:800}
#roomPage[data-game="gartic"] .draw-room-timer .timer-track{height:8px;flex:1;margin:0;background:#dcebf8}
#roomPage[data-game="gartic"] .draw-room-timer .timer-track i{display:block;height:100%;background:#218bed}
#roomPage[data-game="gartic"] .draw-room-tools{padding:12px 16px;border-top:1px solid #eaf0f5}
#roomPage[data-game="gartic"] .draw-room-tools .palette-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;max-width:none;margin:0 0 10px}
#roomPage[data-game="gartic"] .draw-room-tools .palette-color{width:31px;height:31px}
#roomPage[data-game="gartic"] .draw-toolbar{display:flex;flex-wrap:wrap;gap:8px;color:#456583}
#roomPage[data-game="gartic"] .draw-toolbar label{color:#456583}
#roomPage[data-game="gartic"] .draw-toolbar .button{width:auto;height:auto;min-height:40px;padding:8px 12px;border-radius:10px;white-space:nowrap}
#roomPage[data-game="gartic"] .draw-toolbar .button,#roomPage[data-game="gartic"] .draw-room-actions .button{background:#eef6fd!important;border:1px solid #b9d7ed!important;color:#174d78!important}
#roomPage[data-game="gartic"] .draw-toolbar select{background:#fff!important;color:#174d78!important;border:1px solid #b9d7ed!important}
#roomPage[data-game="gartic"] .draw-conversations{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(min(100%,180px),1fr);gap:12px;align-items:start}
#roomPage[data-game="gartic"] .draw-feed-card,#roomPage[data-game="gartic"] .draw-chat-card{min-width:0;padding:14px 16px}
#roomPage[data-game="gartic"] .draw-chat-entry{padding:5px 8px;font-size:13px;overflow-wrap:anywhere}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry.near{background:#fff6d1;color:#865a00}
#roomPage[data-game="gartic"] .draw-standings{background:white;border:1px solid #d9e7f3;border-radius:13px;padding:18px;color:#173957}.draw-standings h2{font-size:20px;margin:0 0 12px}.draw-standing{display:flex;align-items:center;gap:12px;padding:10px;border-bottom:1px solid #e7eef4}.draw-standing strong{flex:1;min-width:0}.draw-standing span:last-child{font-weight:800;color:#176db0}
#roomPage[data-game="gartic"] .draw-feed-title{color:#174675;font-weight:900;padding-bottom:8px}
#roomPage[data-game="gartic"] .draw-room-feed{height:clamp(90px,18vh,180px);overflow:auto;border-top:1px solid #edf2f7;padding:8px 0;color:#385b78}
#roomPage[data-game="gartic"] .draw-feed-card .draw-room-feed{height:clamp(120px,20vh,220px)}
#roomPage[data-game="gartic"] .draw-chat-card .draw-room-feed{height:clamp(70px,11vh,120px)}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry{padding:5px 8px;border-radius:7px;font-size:13px}
#roomPage[data-game="gartic"] .draw-room-feed .guess-entry.correct{background:#e9f8ee;color:#228044}
#roomPage[data-game="gartic"] .draw-room-feed .draw-empty{color:#7892a8;font-size:13px}
#roomPage[data-game="gartic"] .guess-form{display:flex;gap:8px;margin:8px 0 0}
#roomPage[data-game="gartic"] .guess-form .guess-input{flex:1;min-width:0;background:#fff!important;color:#163957!important;border:1px solid #a6c4dc!important}
#roomPage[data-game="gartic"] .guess-form .button,#roomPage[data-game="gartic"] .draw-room-actions .button.primary{background:#1688e9!important;color:#fff!important;border:1px solid #0c67b8!important}
#roomPage[data-game="gartic"] .draw-room-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#roomPage[data-game="gartic"] .draw-room-status{font-size:13px;color:#587995}
#roomPage .room-card.draw-join-failure{max-width:520px;margin:14px auto;padding:20px;display:grid;gap:10px;background:#0f2a4d!important;border:1px solid #3f6d9b!important;border-radius:14px!important;color:#eaf3ff!important;text-align:start}
#roomPage .draw-join-failure h2{margin:0;font-size:18px;color:#ffffff!important;font-weight:900}
#roomPage .draw-join-failure p{margin:0;font-size:13px;line-height:1.75;color:#c7dcf2!important}
#roomPage .draw-join-failure .draw-join-hint{color:#8fe3ff!important;font-weight:800}
#roomPage .draw-join-failure .field-label{color:#dbe9f8!important}
#roomPage .draw-join-retry{display:flex;gap:8px;flex-wrap:wrap}
#roomPage .draw-join-retry .guess-input{flex:1;min-width:150px;background:#fff!important;color:#163957!important;border:1px solid #a6c4dc!important}
#roomPage .draw-join-retry .button.primary{background:#1688e9!important;color:#fff!important;border:1px solid #0c67b8!important;white-space:nowrap}
#roomPage .draw-join-failure #backToGamesButton{background:#173961!important;color:#eaf3ff!important;border:1px solid #5278a1!important}
@media(min-width:701px) and (min-height:500px){#roomPage[data-game="gartic"] .draw-room{grid-template-columns:minmax(195px,260px) minmax(0,min(100%,max(220px,calc((100dvh - max(var(--tg-content-top,0px),var(--tg-header-reserve,0px)) - 315px) * 1.551724))));justify-content:center}#roomPage[data-game="gartic"] .draw-room:has(.draw-room-tools){grid-template-columns:minmax(195px,260px) minmax(0,min(100%,max(220px,calc((100dvh - max(var(--tg-content-top,0px),var(--tg-header-reserve,0px)) - 315px) * 1.551724))))}}
@media(max-width:700px){#roomPage[data-game="gartic"] .draw-canvas{max-height:min(42dvh,420px);width:auto;max-width:100%;margin-inline:auto}#roomPage[data-game="gartic"] .draw-conversations{grid-template-columns:minmax(0,1fr)}.draw-account-avatar.lobby-avatar{width:80px;height:80px;font-size:28px;margin-bottom:16px}#roomPage[data-game="gartic"] .draw-room{grid-template-columns:minmax(0,1fr);grid-template-areas:"main" "players"}#roomPage[data-game="gartic"] .draw-player-list{max-height:260px}#roomPage[data-game="gartic"] .draw-room-feed{height:112px}#roomPage[data-game="gartic"] .draw-board-head{padding:10px}#roomPage[data-game="gartic"] .draw-feed-card{padding:12px}}
@media(min-width:1024px) and (min-height:600px){#roomPage[data-game="gartic"] .draw-room,#roomPage[data-game="gartic"] .draw-room:has(.draw-room-tools),#roomPage[data-game="gartic"] .draw-room:has(.draw-conversations){grid-template-columns:minmax(180px,235px) minmax(0,1fr) minmax(300px,380px)!important;grid-template-areas:"players main chats"!important;align-items:start}#roomPage[data-game="gartic"] .draw-room-main{display:contents}#roomPage[data-game="gartic"] .draw-board-card{grid-area:main}#roomPage[data-game="gartic"] .draw-conversations{grid-area:chats;grid-template-columns:minmax(0,1fr);align-content:start}#roomPage[data-game="gartic"] .draw-standings{grid-column:1/-1}#roomPage[data-game="gartic"] .draw-feed-card .draw-room-feed{height:clamp(170px,34vh,340px)}#roomPage[data-game="gartic"] .draw-chat-card .draw-room-feed{height:clamp(70px,10vh,120px)}#roomPage[data-game="gartic"] .draw-canvas{max-height:calc(100dvh - 300px);width:auto;max-width:100%;margin-inline:auto}}
`;
