import assert from 'node:assert/strict';
import { InteractiveGameRooms, MemoryRoomStorage, drawGuessKind, cleanDrawLanguage } from '../src/services/interactiveGameRooms';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';

const storage = new MemoryRoomStorage();
const rooms = new InteractiveGameRooms(storage);
const post = (id: string, body: object) => rooms.handle(new Request(`https://test/api/interactive/rooms${id ? '/' + id : ''}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) }));
const view = async (id: string, token = '') => (await rooms.handle(new Request(`https://test/api/interactive/rooms/${id}`, {headers:{Authorization:'Bearer '+token}}))).json() as any;
const created = await (await post('', {game:'gartic', name:'رسام', capacity:4, targetScore:500})).json() as any;
// Round length is chosen from the lobby list and stays within a safe range.
const timed=(await (await post('',{game:'gartic',name:'وقت',capacity:4,roundSeconds:250})).json() as any).room.id;
assert.equal((await storage.get<any>('interactive-room:'+timed)).gameState.roundDurationMs,250000);
const tooLong=(await (await post('',{game:'gartic',name:'وقت',capacity:4,roundSeconds:900})).json() as any).room.id;
assert.equal((await storage.get<any>('interactive-room:'+tooLong)).gameState.roundDurationMs,300000);
const legacyTime=(await (await post('',{game:'gartic',name:'وقت',capacity:4,roundSeconds:45})).json() as any).room.id;
assert.equal((await storage.get<any>('interactive-room:'+legacyTime)).gameState.roundDurationMs,45000);
// Room language: the artist's words and the accepted guesses both follow it.
assert.equal(cleanDrawLanguage('EN'),'en');
assert.equal(cleanDrawLanguage('klingon'),'ar');
assert.equal(drawGuessKind('Sun','sun','en'),'exact');
assert.equal(drawGuessKind('cafe','café','fr'),'exact');
assert.equal(drawGuessKind('sun','شمس','ar'),'wrong');
assert.equal(drawGuessKind('شمس','sun','en'),'wrong');
const englishRoom = (await (await post('',{game:'gartic',name:'En',capacity:4,language:'en'})).json() as any);
const englishId = englishRoom.room.id, englishHost = englishRoom.token;
const englishGuest = (await (await post(englishId,{action:'join',name:'Guest'})).json() as any).token;
assert.equal((await storage.get<any>('interactive-room:'+englishId)).gameState.language,'en');
assert.equal((await post(englishId,{action:'start',token:englishHost})).status,200);
const englishChoices = (await view(englishId,englishHost)).state.wordChoices;
englishChoices.forEach((word: string) => assert.match(word,/^[a-z ]+$/i,'the English room deals English words'));
assert.equal((await post(englishId,{action:'choose-word',token:englishHost,word:englishChoices[0]})).status,200);
const englishAnswer = englishChoices[0];
// a guess typed in another script never counts
const wrongScript = await post(englishId,{action:'guess',token:englishGuest,text:'شمس'});
assert.notEqual(wrongScript.status,200,'a guess in another script is refused');
assert.match(await wrongScript.text(),/إنجليزية|لغة/);
assert.equal((await view(englishId,englishGuest)).state.hasGuessed,false);
assert.equal((await post(englishId,{action:'guess',token:englishGuest,text:englishAnswer.toUpperCase()})).status,200);
assert.equal((await view(englishId,englishGuest)).state.hasGuessed,true,'the same word in capitals counts');
const listedEnglish = await (await rooms.handle(new Request('https://test/api/interactive/rooms?game=gartic'))).json() as any;
assert.ok(listedEnglish.rooms.every((room: any) => typeof room.language === 'string'), 'the lobby lists each room language');

const id=created.room.id, host=created.token;
const one=(await (await post(id,{action:'join',name:'الأول'})).json() as any).token;
const two=(await (await post(id,{action:'join',name:'الثاني'})).json() as any).token;
assert.equal((await post(id,{action:'start',token:host})).status,200);
// The artist must pick one of two suggested words before the round starts.
const choosing=await view(id,host);
assert.equal(choosing.state.phase,'choosing');
assert.equal(choosing.state.wordChoices.length,2);
assert.equal(choosing.state.word,'');
assert.equal((await view(id,one)).state.wordChoices.length,0);
assert.notEqual((await post(id,{action:'choose-word',token:one,word:choosing.state.wordChoices[0]})).status,200);
assert.equal((await post(id,{action:'choose-word',token:host,word:'كلمة مو موجودة'})).status,400);
assert.equal((await post(id,{action:'choose-word',token:host,word:choosing.state.wordChoices[1]})).status,200);
const drawingView=await view(id,host);
assert.equal(drawingView.state.phase,'drawing');
assert.equal(drawingView.state.word,choosing.state.wordChoices[1]);
assert.equal((await view(id,one)).state.word,'');
// Long freehand strokes keep every point: a hand-drawn circle must not be clipped.
const longPoints=Array.from({length:300},(_,i)=>[i/300,0.5+Math.sin(i/18)/4]);
assert.equal((await post(id,{action:'stroke',token:host,points:longPoints,color:'#3b82f6',size:6,kind:'pen'})).status,200);
assert.equal((await storage.get<any>('interactive-room:'+id)).gameState.strokes[0].points.length,300);
// Wheel colours outside the fixed palette are accepted, junk colours still fall back.
assert.equal((await post(id,{action:'stroke',token:host,points:[[0.1,0.1],[0.4,0.6]],color:'#8f3a2f',size:8,kind:'pen',customColor:true})).status,200);
assert.equal((await storage.get<any>('interactive-room:'+id)).gameState.strokes[1].color,'#8f3a2f');
await post(id,{action:'stroke',token:host,points:[[0.1,0.1],[0.2,0.2]],color:'red',size:5,kind:'pen'});
assert.equal((await storage.get<any>('interactive-room:'+id)).gameState.strokes[2].color,'#1f2937');
// The clear button wipes the whole board in one go.
assert.equal((await post(id,{action:'clear',token:host})).status,200);
assert.equal((await storage.get<any>('interactive-room:'+id)).gameState.strokes.length,0);
const saved = await storage.get<any>('interactive-room:'+id);
saved.gameState.word='مدرسة'; await storage.put('interactive-room:'+id,saved);
assert.equal(drawGuessKind('مدرسه','مدرسة'),'near');
await post(id,{action:'guess',token:one,text:'مدرسه'});
assert.match(JSON.stringify((await view(id,one)).state.guesses),/⚡/);
for (const token of [two,host]) {
  const v=await view(id,token);
  assert.doesNotMatch(JSON.stringify(v.state.guesses),/⚡|مدرسه/);
  if(token!==host) assert.equal(v.state.word,'');
}
assert.equal((await view(id,'')).state, undefined);
await post(id,{action:'guess',token:two,text:'اعتقد مدرسة كبيرة'});
for (const token of [one,host]) assert.doesNotMatch(JSON.stringify((await view(id,token)).state.guesses),/مدرسة/);
assert.notEqual((await post(id,{action:'draw-chat',token:host,text:'مرحبا'})).status,200);
assert.notEqual((await post(id,{action:'draw-chat',token:one,text:'الجواب مدرسة'})).status,200);
assert.notEqual((await post(id,{action:'draw-chat',token:one,text:'الجواب مدرسه'})).status,200);
await post(id,{action:'draw-chat',token:one,text:'مرحبا بالجميع'});
assert.match(JSON.stringify((await view(id,two)).state.drawChat),/مرحبا/);
assert.equal((await view(id,host)).state.drawChat.length,0);
await post(id,{action:'guess',token:one,text:'مدرسة'});
let v=await view(id,two);
assert.equal(v.room.status,'playing');assert.equal(v.state.roundResult,'');assert.equal(v.state.word,'');
assert.equal(v.state.scores[0].score,12);const initial=v.state.scores[1].score;
assert.notEqual((await post(id,{action:'guess',token:one,text:'مدرسة'})).status,200);
v=await view(id,two);assert.equal(v.state.scores[1].score,initial);
await post(id,{action:'guess',token:two,text:'مدرسة'});
v=await view(id,two);assert.equal(v.state.scores[0].score,24);assert.match(v.state.roundResult,/كل/);
await post(id,{action:'start-round',token:two});v=await view(id,one);
assert.equal(v.state.round,2);assert.equal(v.state.drawer,1);assert.equal(v.state.phase,'choosing');assert.equal(v.state.wordChoices.length,2);assert.equal(v.state.word,'');
await post(id,{action:'choose-word',token:one,word:v.state.wordChoices[0]});
v=await view(id,one);assert.ok(v.state.word);assert.equal(v.state.phase,'drawing');
// Old rooms without new fields remain playable and use the default target.
const legacy=await storage.get<any>('interactive-room:'+id);delete legacy.gameState.correctPlayers;delete legacy.gameState.drawChat;delete legacy.gameState.targetScore;delete legacy.gameState.phase;delete legacy.gameState.logs;await storage.put('interactive-room:'+id,legacy);
v=await view(id,one);assert.equal(v.state.targetScore,500);assert.deepEqual(v.state.drawChat,[]);assert.equal(v.state.phase,'drawing');
// The round ends by itself when the clock runs out and pauses on the answer.
legacy.gameState.deadline=Date.now()-1;await storage.put('interactive-room:'+id,legacy);
v=await view(id,two);assert.equal(v.state.phase,'reveal');assert.match(v.state.roundResult,/انتهى الوقت/);
// Rotation past the original number of players happens on the next round.
await post(id,{action:'start-round',token:host});v=await view(id,host);
assert.equal(v.state.round,3);assert.equal(v.state.drawer,2);assert.equal(v.state.phase,'choosing');
await post(id,{action:'choose-word',token:host,word:v.state.wordChoices[0]});
const tie=await storage.get<any>('interactive-room:'+id);tie.gameState.word='مدرسة';tie.gameState.phase='drawing';tie.gameState.roundResult='';tie.gameState.autoNextAt=0;tie.gameState.matchOver=false;tie.gameState.targetScore=100;tie.gameState.scores[two]=75;tie.gameState.scores[host]=94;tie.gameState.deadline=Date.now()+1000;await storage.put('interactive-room:'+id,tie);
await post(id,{action:'guess',token:host,text:'مدرسة'});v=await view(id,host);assert.equal(v.room.status,'finished');assert.equal(v.state.scores[0].score,100);assert.equal(v.state.scores[2].score,87);assert.equal(v.state.word,'');
assert.equal(v.state.matchOver,true,'the podium is up');
assert.ok(v.state.nextMatchIn>0&&v.state.nextMatchIn<=10,'a fresh match is counted down');
assert.notEqual((await post(id,{action:'start-round',token:host})).status,200);
// After the podium countdown the room opens a brand new match on its own.
const podium=await storage.get<any>('interactive-room:'+id);
podium.gameState.autoNextAt=Date.now()-10;await storage.put('interactive-room:'+id,podium);
const restarted=await view(id,host);
assert.equal(restarted.room.status,'playing','the match restarts by itself');
assert.equal(restarted.state.round,1);
assert.equal(restarted.state.phase,'choosing');
assert.equal(restarted.state.matchOver,false);
assert.ok(restarted.state.scores.every((entry:any)=>entry.score===0),'scores reset for the new match');
assert.match(JSON.stringify(restarted.state.logs),/مباراة جديدة/);
// If the drawer leaves mid-round, no successor inherits the secret word.
const c2=await (await post('',{game:'gartic',name:'مغادر',capacity:4})).json() as any;
const a=(await (await post(c2.room.id,{action:'join',name:'باقي'})).json() as any).token;
await post(c2.room.id,{action:'join',name:'آخر'});await post(c2.room.id,{action:'start',token:c2.token});
await post(c2.room.id,{action:'leave',token:c2.token});v=await view(c2.room.id,a);assert.equal(v.state.word,'');assert.ok(v.state.roundResult);
assert.match(JSON.stringify(v.state.logs),/غادر/);
// Leaving a waiting room frees the seat and shows up in the log for the host.
const c3=await (await post('',{game:'gartic',name:'مضيف',capacity:6})).json() as any;
const b1=(await (await post(c3.room.id,{action:'join',name:'ضيف'})).json() as any).token;
assert.equal((await post(c3.room.id,{action:'leave',token:b1})).status,200);
const lv=await view(c3.room.id,c3.token);
assert.equal(lv.room.players.length,1);
assert.match(JSON.stringify(lv.state.logs),/ضيف غادر/);
// A seat that stops polling is dropped after the presence window, and the host moves on.
const c4=await (await post('',{game:'gartic',name:'مهجور',capacity:6})).json() as any;
const b2=(await (await post(c4.room.id,{action:'join',name:'ساكت'})).json() as any).token;
const parked=await storage.get<any>('interactive-room:'+c4.room.id);
parked.players[0].lastSeenAt=Date.now()-120000;parked.players[0].joinedAt=Date.now()-200000;
parked.players[1].lastSeenAt=Date.now();
await storage.put('interactive-room:'+c4.room.id,parked);
const pv=await view(c4.room.id,b2);
assert.equal(pv.room.players.length,1,'the silent seat is removed');
assert.equal(pv.room.players[0].name,'ساكت');
assert.equal(pv.room.isHost,true,'the remaining player takes over the room');
assert.match(JSON.stringify(pv.state.logs),/مهجور غادر/);
// Coming back with the same room code must work even while the match runs.
const c5=await (await post('',{game:'gartic',name:'صاحب الغرفة',capacity:6})).json() as any;
const back=(await (await post(c5.room.id,{action:'join',name:'صديق'})).json() as any).token;
await post(c5.room.id,{action:'join',name:'ثالث'});
await post(c5.room.id,{action:'start',token:c5.token});
await post(c5.room.id,{action:'leave',token:back});
assert.equal((await storage.get<any>('interactive-room:'+c5.room.id)).players.length,2);
const rejoin=await post(c5.room.id,{action:'join',name:'صديق'});
assert.equal(rejoin.status,200,'a player who left can rejoin a running drawing match');
const rejoined=await rejoin.json() as any;
assert.equal(rejoined.room.status,'playing');
assert.equal(rejoined.room.players.length,3,'the returning player gets a seat back');
assert.equal(rejoined.state.scores.find((entry:any)=>entry.name==='صديق').score,0,'a late arrival starts from zero');
assert.match(JSON.stringify(rejoined.state.logs),/صديق انضم وسط المباراة/);
assert.equal(rejoined.room.players[0].name,'صاحب الغرفة','existing seats and the drawer do not move');
// A drained room that ended for good reopens its lobby instead of trapping the code.
const c6=await (await post('',{game:'gartic',name:'مالك',capacity:6})).json() as any;
const left1=(await (await post(c6.room.id,{action:'join',name:'زائر'})).json() as any).token;
await post(c6.room.id,{action:'start',token:c6.token});
await post(c6.room.id,{action:'leave',token:c6.token});
const drained=await storage.get<any>('interactive-room:'+c6.room.id);
assert.equal(drained.status,'finished','the match ends when the room drains');
assert.equal(drained.gameState.matchOver,undefined,'no podium countdown is running');
const reopened=await (await post(c6.room.id,{action:'join',name:'وافد'})).json() as any;
assert.equal(reopened.room.status,'waiting','the old code opens the lobby again');
assert.equal(reopened.state.phase,'waiting');
const stillHost=await view(c6.room.id,left1);
assert.equal(stillHost.room.isHost,true,'whoever is left owns the room');
assert.equal(stillHost.state.scores.length,2,'the newcomer is seated next to them');
assert.equal((await post(c6.room.id,{action:'start',token:left1})).status,200,'a fresh match starts on the same code');
// Even a room everyone walked out of hands ownership to the next player.
const c6b=await (await post('',{game:'gartic',name:'خالي',capacity:6})).json() as any;
const tmp=(await (await post(c6b.room.id,{action:'join',name:'عابر'})).json() as any).token;
await post(c6b.room.id,{action:'leave',token:tmp});
await post(c6b.room.id,{action:'leave',token:c6b.token});
assert.equal((await storage.get<any>('interactive-room:'+c6b.room.id)).players.length,0);
const owner=(await (await post(c6b.room.id,{action:'join',name:'أول وافد'})).json() as any);
assert.equal(owner.room.isHost,true,'an empty room crowns its first arrival');
// Other games keep the old rule: nobody joins after the start.
const c7=await (await post('',{game:'uno',name:'أونو'})).json() as any;
await post(c7.room.id,{action:'join',name:'لاعب'});
const unoRoom=await storage.get<any>('interactive-room:'+c7.room.id);
unoRoom.status='playing';await storage.put('interactive-room:'+c7.room.id,unoRoom);
const blocked=await post(c7.room.id,{action:'join',name:'متأخر'});
assert.equal(blocked.status,409,'uno still refuses late joins');
assert.equal((await blocked.json() as any).code,'game-started');
// A full drawing room says so plainly instead of a vague refusal.
const c8=await (await post('',{game:'gartic',name:'ممتلئ',capacity:2})).json() as any;
await post(c8.room.id,{action:'join',name:'ثاني'});
const full=await post(c8.room.id,{action:'join',name:'ثالث'});
assert.equal(full.status,409);
assert.equal((await full.json() as any).code,'room-full');
// A pixel that never moves is still a mark: a tap must leave a dot.
const c9=await (await post('',{game:'gartic',name:'نقّاط',capacity:4})).json() as any;
const d1=(await (await post(c9.room.id,{action:'join',name:'ثاني'})).json() as any).token;
await post(c9.room.id,{action:'start',token:c9.token});
const dotChoices=(await view(c9.room.id,c9.token)).state.wordChoices;
await post(c9.room.id,{action:'choose-word',token:c9.token,word:dotChoices[0]});
assert.equal((await post(c9.room.id,{action:'stroke',token:c9.token,points:[[0.4,0.4]],color:'#ef4444',size:6,kind:'pen'})).status,200,'a single tap is accepted');
const dotStroke=(await storage.get<any>('interactive-room:'+c9.room.id)).gameState.strokes[0];
assert.equal(dotStroke.points.length,2,'the dot is stored as a repeated point');
assert.deepEqual(dotStroke.points[0],dotStroke.points[1]);
// Live frames: one stroke id keeps a single slot and grows in place.
const liveId='live-1';
await post(c9.room.id,{action:'stroke-live',token:c9.token,id:liveId,points:[[0.1,0.1],[0.2,0.2]],color:'#3b82f6',size:5,kind:'pen'});
await post(c9.room.id,{action:'stroke-live',token:c9.token,id:liveId,points:[[0.1,0.1],[0.2,0.2],[0.3,0.35]],color:'#3b82f6',size:5,kind:'pen'});
let liveRoom=await storage.get<any>('interactive-room:'+c9.room.id);
const liveStrokes=liveRoom.gameState.strokes.filter((stroke:any)=>stroke.id===liveId);
assert.equal(liveStrokes.length,1,'live frames replace the same stroke instead of piling up');
assert.equal(liveStrokes[0].points.length,3,'the live stroke grows while drawing');
assert.equal(liveStrokes[0].live,true);
const guesserView=await view(c9.room.id,d1);
assert.ok(guesserView.state.strokes.some((stroke:any)=>stroke.id===liveId),'other players receive the stroke while it is drawn');
await post(c9.room.id,{action:'stroke',token:c9.token,id:liveId,points:[[0.1,0.1],[0.3,0.35]],color:'#3b82f6',size:5,kind:'pen'});
liveRoom=await storage.get<any>('interactive-room:'+c9.room.id);
const finishedStroke=liveRoom.gameState.strokes.filter((stroke:any)=>stroke.id===liveId);
assert.equal(finishedStroke.length,1,'the committed stroke takes the live slot');
assert.equal(finishedStroke[0].live,undefined);
// Public rooms show up in the lobby browser; hidden ones stay code-only.
const publicRoom=await (await post('',{game:'gartic',name:'مرئي',capacity:6,visible:true})).json() as any;
const hiddenRoom=await (await post('',{game:'gartic',name:'مخفي',capacity:6,visible:false})).json() as any;
let lobby=await (await rooms.handle(new Request('https://test/api/interactive/rooms?game=gartic'))).json() as any;
assert.ok(lobby.rooms.some((entry:any)=>entry.id===publicRoom.room.id),'the visible room is listed');
assert.ok(!lobby.rooms.some((entry:any)=>entry.id===hiddenRoom.room.id),'the hidden room stays unlisted');
const listed=lobby.rooms.find((entry:any)=>entry.id===publicRoom.room.id);
assert.equal(listed.players,1);
assert.equal(listed.capacity,6);
assert.equal(listed.hostName,'مرئي');
assert.ok(listed.targetScore>=100&&listed.roundSeconds>=30,'the listing shows the real settings');
assert.equal(JSON.stringify(lobby).includes('token'),false,'the lobby never leaks room tokens');
// The hidden room is still reachable with its code.
assert.equal((await post(hiddenRoom.room.id,{action:'join',name:'بالرمز'})).status,200,'hidden rooms stay joinable by code');
await post(publicRoom.room.id,{action:'join',name:'زائر'});
lobby=await (await rooms.handle(new Request('https://test/api/interactive/rooms?game=gartic'))).json() as any;
assert.equal(lobby.rooms.find((entry:any)=>entry.id===publicRoom.room.id).players,2,'the listing tracks the player count');
await post(publicRoom.room.id,{action:'start',token:publicRoom.token});
lobby=await (await rooms.handle(new Request('https://test/api/interactive/rooms?game=gartic'))).json() as any;
assert.ok(!lobby.rooms.some((entry:any)=>entry.id===publicRoom.room.id),'a started room leaves the browser');
// The artist gets ten seconds; if they never pick, the turn moves on by itself and
// nobody draws on their behalf.
const c10=await (await post('',{game:'gartic',name:'متردد',capacity:6})).json() as any;
const p1=(await (await post(c10.room.id,{action:'join',name:'أول'})).json() as any).token;
const p2=(await (await post(c10.room.id,{action:'join',name:'ثاني'})).json() as any).token;
await post(c10.room.id,{action:'start',token:c10.token});
const firstPick=await view(c10.room.id,c10.token);
assert.equal(firstPick.state.phase,'choosing');
assert.equal(firstPick.state.roundLeft>7&&firstPick.state.roundLeft<=10,true,'the artist has ten seconds to choose');
const waiting=await storage.get<any>('interactive-room:'+c10.room.id);
waiting.gameState.choiceDeadline=Date.now()-1;await storage.put('interactive-room:'+c10.room.id,waiting);
const afterSkip=await view(c10.room.id,p1);
assert.equal(afterSkip.state.phase,'choosing','a new choice window opens for the next artist');
assert.notEqual(afterSkip.state.drawerSeat,0,'the pencil moves to the next player');
assert.equal(afterSkip.state.word,'','nothing is drawn on the artist behalf');
assert.match(JSON.stringify(afterSkip.state.logs),/ما اختار كلمة/);
assert.equal(afterSkip.state.round,2);
const nextArtist=[c10.token,p1,p2][afterSkip.state.drawerSeat];
assert.ok(nextArtist,'the next artist is a real player');
assert.equal((await view(c10.room.id,nextArtist)).state.wordChoices.length,2,'the next artist gets the word choices');
// Empty seats are not players: a stale pencil lands back on a real seat with choices.
const c11=await (await post('',{game:'gartic',name:'مقاعد',capacity:6})).json() as any;
const q1=(await (await post(c11.room.id,{action:'join',name:'باقي'})).json() as any).token;
await post(c11.room.id,{action:'start',token:c11.token});
const stale=await storage.get<any>('interactive-room:'+c11.room.id);
stale.gameState.drawer=5;await storage.put('interactive-room:'+c11.room.id,stale);
const fixed=await view(c11.room.id,q1);
assert.equal(fixed.state.drawerSeat,0,'the pencil returns to a real seat');
assert.ok(fixed.state.wordChoices.length===0||fixed.state.wordChoices.length===2);
const seatOwner=await view(c11.room.id,c11.token);
assert.equal(seatOwner.state.phase,'choosing');
assert.equal(seatOwner.state.wordChoices.length,2,'the real drawer always gets choices');
// The answer is never announced at the end of a round.
const c12=await (await post('',{game:'gartic',name:'سر',capacity:4})).json() as any;
const r1=(await (await post(c12.room.id,{action:'join',name:'مخمّن'})).json() as any).token;
await post(c12.room.id,{action:'start',token:c12.token});
const secretWord=(await view(c12.room.id,c12.token)).state.wordChoices[0];
await post(c12.room.id,{action:'choose-word',token:c12.token,word:secretWord});
await post(c12.room.id,{action:'skip',token:c12.token});
const ended=await view(c12.room.id,r1);
assert.equal(ended.state.phase,'reveal');
assert.equal(ended.state.word,'','the word is cleared from the view');
assert.ok(!JSON.stringify(ended.state.logs).includes(secretWord),'the log never prints the answer');
assert.ok(!ended.state.guesses.some((guess:any)=>guess.reveal),'no answer row reaches the guessers');
assert.ok(!JSON.stringify(ended.state).includes(secretWord),'the answer is not in the payload');
// The lobby ships as one inline script: a single broken quote there kills the
// whole page, so parse it here instead of finding out from the Mini App.
const lobbyHtml = interactiveGamesMiniAppHtml('gartic');
assert.ok(lobbyHtml.includes('\u2067') || lobbyHtml.length > 1000, 'the lobby html renders');
for (const game of ['', 'gartic']) {
  const page = interactiveGamesMiniAppHtml(game);
  const scripts = [...page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);
  assert.ok(scripts.length > 0, `inline script exists for "${game}"`);
  for (const script of scripts) {
    assert.doesNotThrow(() => new Function(script), `inline script parses for "${game}"`);
  }
}
// The lobby is a hub: your own photo, name and country, then three plain
// buttons (play, create a room, the room list). The room list and the create
// form are separate screens that start hidden.
assert.ok(lobbyHtml.includes('class="draw-lobby-grid"'), 'the lobby keeps its two columns');
assert.ok(lobbyHtml.includes('lobby-avatar'), 'your photo is in the lobby');
assert.ok(lobbyHtml.includes('class="draw-lobby-name"'), 'your name is in the lobby');
assert.ok(lobbyHtml.includes('countryFlag(chessCountryCode())'), 'your country flag is in the lobby');
assert.ok(lobbyHtml.includes('id="drawQuickPlay">العب<'), 'the play button has no icon');
assert.ok(lobbyHtml.includes('id="drawCreateRoom">أنشئ غرفة<'), 'the create button exists');
assert.ok(lobbyHtml.includes('id="drawOpenRooms">الغرف<'), 'the rooms button is in the hub');
assert.ok(!lobbyHtml.includes('▶'), 'the play button carries no triangle icon');
assert.ok(!lobbyHtml.includes('\u{1F6AA}'), 'no door icon on the buttons');
assert.ok(lobbyHtml.includes('id="drawRoomsScreen" hidden'), 'the rooms screen starts closed');
assert.ok(lobbyHtml.includes('id="drawCreateScreen" hidden'), 'the create screen starts closed');
assert.ok(lobbyHtml.includes('class="draw-rooms-panel"'), 'the room list sits in a framed panel');
assert.ok(lobbyHtml.includes('id="drawPublicList"'), 'the room list exists');
assert.ok(lobbyHtml.indexOf('class="draw-rooms-panel"') < lobbyHtml.indexOf('id="drawPublicList"'), 'the list is inside the panel');
assert.ok(lobbyHtml.indexOf('id="drawCreateRoom"') > lobbyHtml.indexOf('id="drawRoomsScreen"'), 'creating a room lives inside the rooms panel');
assert.ok(lobbyHtml.includes('id="drawRoomsPlay"'), 'the rooms screen has its own play button');
assert.ok(/id="drawRoomsPlay"[^>]*disabled/.test(lobbyHtml), 'the rooms play button starts locked');
assert.ok(lobbyHtml.includes('id="drawRoomCode"'), 'the lobby joins by code');
assert.ok(lobbyHtml.indexOf('id="drawRoomCode"') < lobbyHtml.indexOf('id="drawRoomsScreen"'), 'the code field sits in the lobby');
assert.ok(lobbyHtml.includes('id="drawCreateBack"'), 'the create screen can go back');
assert.ok(lobbyHtml.includes('data-action="friend">افتح الغرفة<'), 'the create screen opens the room');
assert.ok(lobbyHtml.includes('draw-room-card'), 'open rooms render as pickable cards');
// Room language: picked in the create form, sent with the room and shown on cards.
assert.ok(lobbyHtml.includes('data-draw-select="drawLanguage"'), 'the create form lets you pick the room language');
assert.ok(lobbyHtml.indexOf('id="drawCreateScreen"') < lobbyHtml.indexOf('data-draw-select="drawLanguage"'), 'the language picker lives in the create screen');
assert.ok(lobbyHtml.includes("language:drawSelectValue('drawLanguage')"), 'the chosen language is sent when creating the room');
assert.ok(lobbyHtml.includes('DRAW_LANGUAGE_LABELS'), 'room cards can show each room language');
assert.ok(lobbyHtml.includes("s.language!=='ar'"), 'the guess input switches direction for non-Arabic rooms');
assert.ok(lobbyHtml.includes('stroke-linecap="round"'), 'back buttons use a drawn arrow');
assert.ok(!lobbyHtml.includes('&#8594;'), 'no thin character arrow is left');
assert.ok(/draw-rooms-scroll/.test(lobbyHtml), 'the room list has a fixed framed window');
// «العب» only drops you into a room that already exists; it never opens one.
const quickPlayBody = lobbyHtml.slice(lobbyHtml.indexOf('async function drawQuickPlay'), lobbyHtml.indexOf('function drawRoomCardMarkup'));
assert.ok(quickPlayBody.includes('joinRoom('), 'play joins an open room');
assert.ok(!quickPlayBody.includes('createRoom('), 'play never creates a room');

console.log('Drawing scoring, private hints, chat, answer secrecy, ties, timers, legacy rooms, leaving, rejoining, live strokes, dots, the public lobby, the ten second choice window and empty seats passed.');
