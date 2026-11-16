import assert from 'node:assert/strict';
import { AmongUsRooms, memoryRoomStorage, AU_KILL_COOLDOWN_MS, type AuRoomState } from '../src/services/amongUsRooms';
const storage = memoryRoomStorage();
const engine = new AmongUsRooms(storage);
let now = Date.now(); const originalNow = Date.now; Date.now = () => now;
const post = async (body: any) => (await engine.handle(new Request('https://test/api/amongus/rooms', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))).json() as any;
const poll = async (code:string,token:string) => (await engine.handle(new Request(`https://test/api/amongus/rooms/${code}?token=${token}`))).json() as any;
try {
 const created = await post({action:'create',name:'المضيف'}); const {code, token}=created;
 for(let i=0;i<5;i++) assert.equal((await post({action:'addBot',code,token})).ok,true);
 await post({action:'start',code,token});
 const key=`amongus-room:${code}`; const room=(await storage.get<AuRoomState>(key))!;
 const host=room.players[0], victim=room.players[1], witnesses=room.players.slice(2,5), distant=room.players[5];
 // Force a deterministic setup without granting the bots secret-role knowledge.
 host.role='impostor';host.tasks=[];host.x=50;host.y=12;host.lastKillAt=now;
 for(const bot of room.players.slice(1)){bot.role='crew';bot.alive=true;bot.nextThinkAt=now+120000;bot.x=50;bot.y=12}
 distant.x=75;distant.y=16;
 await storage.put(key,room);
 const tooSoon=await post({action:'kill',code,token,target:victim.token});assert.equal(tooSoon.ok,false,'no immediate kill at spawn');
 now+=AU_KILL_COOLDOWN_MS+1;
 const kill=await post({action:'kill',code,token,target:victim.token});assert.equal(kill.room.bodies.length,1);
 const murdered=(await storage.get<AuRoomState>(key))!;
 assert.ok(witnesses.every(w=>murdered.players.find(p=>p.token===w.token)?.suspectToken===token));
 assert.ok(!murdered.players.find(p=>p.token===distant.token)?.suspectToken);
 const ghost=murdered.players.find(p=>p.token===victim.token)!;
 ghost.tasks=[{id:'ghost-cafe',station:'st-up-cafe',label:'سجل',kind:'upload',done:false}];
 await storage.put(key,murdered);
 const ghostMove=await post({action:'move',code,token:ghost.token,x:49,y:12,seq:2});
 assert.equal(ghostMove.ok,true);
 const staleMove=await post({action:'move',code,token:ghost.token,x:55,y:12,seq:1});
 assert.equal(staleMove.room.players.find((p:any)=>p.you).x,49,'late movement cannot rewind player');
 const ghostTask=await post({action:'task',code,token:ghost.token,taskId:'ghost-cafe'});
 assert.equal(ghostTask.room.players.find((p:any)=>p.you).tasks[0].done,true,'ghost can complete tasks');
 const report=await post({action:'report',code,token}); assert.equal(report.room.phase,'meeting');
 const chat=await post({action:'meetingChat',code,token,text:'شفت واحد قريب'});assert.equal(chat.room.meeting.chat[0].text,'شفت واحد قريب');
 now+=5500;const during=await poll(code,token);assert.equal(during.room.phase,'meeting');
 const stored=(await storage.get<AuRoomState>(key))!;
 assert.ok(witnesses.every(w=>stored.meeting?.votes[w.token]===token));
 assert.equal(stored.meeting?.votes[distant.token],'skip');
 assert.ok(during.room.meeting.votes.filter((v:any)=>v.voter!==host.name).every((v:any)=>v.target===null),'other votes hidden');
 const result=await post({action:'vote',code,token,target:'skip'});
 assert.equal(result.room.phase,'ended'); assert.equal(result.room.winner,'crew');
 assert.equal(result.room.lastMeeting.ejectedName,host.name);
 console.log('Bot round: initial cooldown, witnessed kill, report, chat, evidence-based votes, skip, ejection and win passed.');
} finally { Date.now=originalNow; }
