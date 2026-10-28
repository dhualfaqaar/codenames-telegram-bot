// Kept as shipped JavaScript so the same sizing function can be exercised in
// Node and the browser without UA/device-name detection or persisted overrides.
export const CHESS_RESPONSIVE_SCRIPT = String.raw`
function calculateChessLayout(width,height,top,bottom){
  var padding=Math.max(6,Math.min(24,width*.012)),gap=Math.max(8,Math.min(24,width*.012));
  var availableWidth=Math.max(1,width-padding*2),availableHeight=Math.max(1,height-top-bottom-padding*2);
  var wide=availableWidth>=720&&availableWidth/availableHeight>=1.12;
  gap=Math.min(gap,availableHeight*.04);
  var seat=Math.min(availableHeight*.24,Math.max(44,Math.min(76,availableHeight*.075)));
  var chat=wide?Math.max(210,Math.min(420,availableWidth*.29)):availableWidth;
  var board=Math.floor(Math.max(1,Math.min(availableWidth-(wide?chat+gap:0),availableHeight-2*seat-2*gap)));
  return {wide:wide,padding:padding,gap:gap,seat:seat,chat:chat,board:board,height:availableHeight,mainHeight:board+2*seat+2*gap};
}
function syncChessLayout(){
  var app=$('gameApp'),room=$('roomPage');
  if(!room.querySelector('.chess-game-layout')||app.dataset.page!=='room'||app.dataset.game!=='chess'){delete app.dataset.chessLayout;return}
  var viewport=window.visualViewport,width=viewport?viewport.width:window.innerWidth,height=viewport?viewport.height:window.innerHeight;
  var safeTop=Number(tg&&tg.safeAreaInset&&tg.safeAreaInset.top)||0,contentTop=Number(tg&&tg.contentSafeAreaInset&&tg.contentSafeAreaInset.top)||0;
  var top=tg?(tg.isFullscreen?Math.max(safeTop,contentTop,48):Math.max(contentTop,safeTop+(height>=width?132:72))):0;
  var bottom=Math.max(Number(tg&&tg.safeAreaInset&&tg.safeAreaInset.bottom)||0,Number(tg&&tg.contentSafeAreaInset&&tg.contentSafeAreaInset.bottom)||0);
  var layout=calculateChessLayout(width,height,top,bottom);
  app.dataset.chessLayout=layout.wide?'wide':'compact';
  var values={'--fit-top':top,'--fit-bottom':bottom,'--fit-height':height,'--fit-width':width,'--fit-padding':layout.padding,'--fit-gap':layout.gap,'--fit-seat':layout.seat,'--fit-board':layout.board,'--fit-chat':layout.chat,'--fit-main-height':layout.mainHeight};
  Object.keys(values).forEach(function(key){app.style.setProperty(key,values[key]+'px')});
  if(chessChatExpanded===null){var panel=room.querySelector('.chess-chat-panel'),side=room.querySelector('.chess-side-panel');if(panel){panel.classList.toggle('collapsed',!layout.wide);side.classList.toggle('open',layout.wide);panel.querySelector('[data-chess-chat-toggle]').setAttribute('aria-expanded',String(layout.wide));panel.querySelector('[data-chess-chat-toggle]').textContent=layout.wide?'إغلاق':'فتح المحادثة'}}
}
var chessLayoutFrame=0;
function scheduleChessLayout(){if(chessLayoutFrame)return;chessLayoutFrame=requestAnimationFrame(function(){chessLayoutFrame=0;syncChessLayout()})}
window.addEventListener('resize',scheduleChessLayout);
if(window.visualViewport)window.visualViewport.addEventListener('resize',scheduleChessLayout);
`;

// One final, bounded layout for matches. The compact view retains the in-flow
// collapsible chat; the wide view uses exactly two columns, never a third seat.
export const CHESS_RESPONSIVE_CSS = String.raw`
#gameApp[data-chess-layout] #roomPage[data-game="chess"]{position:absolute!important;inset:var(--fit-top) 0 var(--fit-bottom)!important;width:var(--fit-width)!important;height:calc(var(--fit-height) - var(--fit-top) - var(--fit-bottom))!important;min-height:0!important;margin:0!important;padding:var(--fit-padding)!important;overflow:auto!important}
#gameApp[data-chess-layout]>.game-footer,#gameApp[data-chess-layout]>.topbar,#gameApp[data-chess-layout] #roomPage>.room-header{display:none!important}
#gameApp[data-chess-layout] #roomContent{height:auto!important;min-height:0!important;overflow:visible!important}
#gameApp[data-chess-layout] .chess-arena{height:auto!important;min-height:0!important;padding:0!important;margin:0!important;overflow:visible!important}
#gameApp[data-chess-layout] .chess-game-layout{display:grid!important;grid-template-columns:var(--fit-board)!important;grid-template-rows:auto auto!important;grid-template-areas:"main" "chat"!important;gap:var(--fit-gap)!important;align-items:start!important;justify-content:center!important;width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;direction:ltr!important}
#gameApp[data-chess-layout] .chess-main-column{display:grid!important;grid-area:main!important;grid-template-columns:var(--fit-board)!important;grid-template-rows:var(--fit-seat) var(--fit-board) var(--fit-seat)!important;gap:var(--fit-gap)!important;width:var(--fit-board)!important;height:var(--fit-main-height)!important;min-height:0!important;overflow:visible!important;direction:rtl!important}
#gameApp[data-chess-layout] .chess-main-column>.chess-clock-row{display:grid!important;grid-area:auto!important;grid-column:1!important;grid-row:1!important;align-self:stretch!important;width:100%!important;max-width:none!important;height:var(--fit-seat)!important;min-height:0!important;margin:0!important;padding:0!important}
#gameApp[data-chess-layout] .chess-main-column>.self-seat-row{grid-row:3!important}
#gameApp[data-chess-layout] .chess-seat-card{display:flex!important;align-items:center!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;padding:3px 8px!important;gap:8px!important;overflow:hidden!important}
#gameApp[data-chess-layout] .chess-seat-avatar{width:clamp(28px,3vw,48px)!important;height:clamp(28px,3vw,48px)!important;flex:none!important}
#gameApp[data-chess-layout] .chess-seat-details{min-width:0!important;flex:1!important}
#gameApp[data-chess-layout] .chess-seat-name{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;font-size:clamp(12px,1.1vw,20px)!important}
#gameApp[data-chess-layout] .chess-seat-clock{flex:none!important}
#gameApp[data-chess-layout] .chess-seat-clock>strong{font-size:clamp(18px,2vw,32px)!important}
#gameApp[data-chess-layout] .chess-board-panel{display:block!important;grid-area:auto!important;grid-column:1!important;grid-row:2!important;align-self:stretch!important;width:var(--fit-board)!important;height:var(--fit-board)!important;min-height:0!important;overflow:hidden!important}
#gameApp[data-chess-layout] .chess-board-panel .board-wrap,#gameApp[data-chess-layout] .chessboard{width:var(--fit-board)!important;height:var(--fit-board)!important;min-width:0!important;max-width:none!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;aspect-ratio:1!important}
#gameApp[data-chess-layout] .chessboard>.square{font-size:calc(var(--fit-board) * .094)!important;min-width:0!important;min-height:0!important}
#gameApp[data-chess-layout] #roomPage[data-game="chess"] .chess-piece{font-size:calc(var(--fit-board) * .09)!important}
#gameApp[data-chess-layout] .chess-instruction{display:none!important}
#gameApp[data-chess-layout] .chess-side-panel,#gameApp[data-chess-layout] .chess-side-panel.open{display:flex!important;position:relative!important;inset:auto!important;grid-area:chat!important;grid-column:auto!important;grid-row:auto!important;align-self:start!important;width:100%!important;max-width:none!important;height:auto!important;max-height:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;direction:rtl!important}
#gameApp[data-chess-layout="wide"] .chess-game-layout{grid-template-columns:var(--fit-chat) var(--fit-board)!important;grid-template-rows:auto!important;grid-template-areas:"chat main"!important}
#gameApp[data-chess-layout] .chess-chat-panel{display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;width:100%!important;border:1px solid #315174!important;border-radius:14px!important;background:#0b2039!important;overflow:hidden!important}
#gameApp[data-chess-layout="wide"] .chess-chat-panel{height:var(--fit-main-height)!important;min-height:0!important;max-height:none!important}
#gameApp[data-chess-layout] .chess-chat-panel.collapsed{height:auto!important;min-height:0!important;max-height:none!important}
#gameApp[data-chess-layout] .chess-chat-panel.collapsed{grid-template-rows:auto!important}
#gameApp[data-chess-layout] .chess-chat-panel.collapsed .chess-chat-messages,#gameApp[data-chess-layout] .chess-chat-panel.collapsed .chess-chat-form{display:none!important}
#gameApp[data-chess-layout] .chess-chat-messages{min-height:0!important;overflow:auto!important}
#gameApp[data-chess-layout] .chess-chat-form{min-width:0!important}
`;
