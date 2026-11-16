import assert from 'node:assert/strict';
import { AmongUsRooms, memoryRoomStorage, type AuRoomState } from '../src/services/amongUsRooms';
const storage=memoryRoomStorage(), engine=new AmongUsRooms(storage);
const post=async(body:any)=>(await engine.handle(new Request('https://test/api/amongus/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))).json() as any;
const made=await post({action:'create',name:'host'}),code=made.code;
const tokens=[made.token];for(let i=0;i<5;i++) tokens.push((await post({action:'join',code,name:'player'+i})).token);
await post({action:'start',code,token:tokens[0]});
const key=`amongus-room:${code}`;
async function setup(kind:AuRoomState['sabotage']) {
 const room=(await storage.get<AuRoomState>(key))!;room.phase='playing';room.sabotage=kind;
 room.players.forEach((p,i)=>{p.role=i===0?'impostor':'crew';p.alive=true;p.ventId=null;p.x=50;p.y=16});
 await storage.put(key,room);
}
async function position(i:number,x:number,y:number){const state=(await storage.get<AuRoomState>(key))!;state.players[i].x=x;state.players[i].y=y;await storage.put(key,state)}
const fix=async(i:number,part:string,rest:object={})=>post({action:'fix',code,token:tokens[i],part,...rest});
await setup({kind:'oxygen',endsAt:Date.now()+45000,codes:{o2:'12345',admin:'56789'},fixed:[]});
assert.equal((await fix(1,'o2',{answer:'12345'})).ok,false,'cannot fix remotely');
await position(1,74,38);assert.equal((await fix(1,'o2',{answer:'00000'})).ok,false);
assert.deepEqual((await fix(1,'o2',{answer:'12345'})).room.sabotage.fixed,['o2']);
await position(2,65,48);assert.equal((await fix(2,'admin',{answer:'56789'})).room.sabotage,null);
await setup({kind:'lights',endsAt:0,switches:[false,true,false,true,false]});await position(1,34,70);
for(const index of [0,2])assert.ok((await fix(1,'lights',{index})).room.sabotage);
assert.equal((await fix(1,'lights',{index:4})).room.sabotage,null);
await setup({kind:'comms',endsAt:0,frequency:64});await position(1,68,85);
assert.equal((await fix(1,'comms',{frequency:4})).ok,false);
assert.equal((await fix(1,'comms',{frequency:62})).room.sabotage,null);
await setup({kind:'reactor',endsAt:Date.now()+45000});await position(1,9,45);await position(2,9,55);
assert.ok((await fix(1,'north',{holding:true})).room.sabotage);
await position(1,9,51); // moving away invalidates the hold, even before it expires
assert.ok((await fix(2,'south',{holding:true})).room.sabotage);
await position(1,9,45);assert.equal((await fix(1,'north',{holding:true})).room.sabotage,null);
await setup({kind:'reactor',endsAt:Date.now()+45000});await position(1,9,45);
await fix(1,'north',{holding:true});await fix(1,'north',{holding:false});
await position(2,9,55);assert.ok((await fix(2,'south',{holding:true})).room.sabotage,'released hold is not counted');
console.log('Sabotage: proximity, oxygen codes at two consoles, lights, comms and simultaneous reactor holds passed.');
