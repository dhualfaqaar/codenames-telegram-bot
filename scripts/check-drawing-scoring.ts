import assert from 'node:assert/strict';
import { InteractiveGameRooms, MemoryRoomStorage, drawGuessKind } from '../src/services/interactiveGameRooms';

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
console.log('Drawing scoring, private hints, chat, answer secrecy, ties, timers, legacy rooms, leaving and rejoining passed.');
