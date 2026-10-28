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
assert.equal(v.state.scores[0].score,25);const initial=v.state.scores[1].score;
assert.notEqual((await post(id,{action:'guess',token:one,text:'مدرسة'})).status,200);
v=await view(id,two);assert.equal(v.state.scores[1].score,initial);
await post(id,{action:'guess',token:two,text:'مدرسة'});
v=await view(id,two);assert.equal(v.state.scores[0].score,50);assert.match(v.state.roundResult,/كل/);
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
const tie=await storage.get<any>('interactive-room:'+id);tie.gameState.word='مدرسة';tie.gameState.phase='drawing';tie.gameState.roundResult='';tie.gameState.autoNextAt=0;tie.gameState.targetScore=100;tie.gameState.scores[two]=75;tie.gameState.scores[host]=90;tie.gameState.deadline=Date.now()+1000;await storage.put('interactive-room:'+id,tie);
await post(id,{action:'guess',token:host,text:'مدرسة'});v=await view(id,host);assert.equal(v.room.status,'finished');assert.equal(v.state.scores[0].score,100);assert.equal(v.state.scores[2].score,100);assert.equal(v.state.word,'');
assert.notEqual((await post(id,{action:'start-round',token:host})).status,200);
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
console.log('Drawing scoring, private hints, chat, answer secrecy, ties, timers, legacy rooms and leaving passed.');
