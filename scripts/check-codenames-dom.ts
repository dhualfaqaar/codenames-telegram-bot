import assert from 'node:assert/strict';
// jsdom does not bundle TypeScript declarations in this repository.
// @ts-expect-error no declaration package installed
import { JSDOM, VirtualConsole } from 'jsdom';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';
import { InteractiveGameRooms, MemoryRoomStorage } from '../src/services/interactiveGameRooms';
const rooms = new InteractiveGameRooms(new MemoryRoomStorage());
const html = interactiveGamesMiniAppHtml('codenames');
const failures: string[] = [];
const sleep = (ms: number) => new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn: () => any, label: string) { for(let i=0;i<80;i++){if(fn())return;await sleep(50)} throw new Error('Timeout: '+label) }
function client(name: string, query='') {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, { url:'https://test.local/codenames'+query, runScripts:'dangerously', pretendToBeVisual:true, virtualConsole,
    beforeParse(win: any) {
      win.scrollTo=()=>{}; win.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
      win.Telegram={WebApp:{initData:'',initDataUnsafe:{user:{id:name.length*100+name.charCodeAt(0),first_name:name}},ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast(){return false},BackButton:{show(){},hide(){},onClick(){}}}};
      win.fetch=(input: any, init: any = {})=>{const url=new URL(String(input),'https://test.local'); if(url.pathname==='/api/interactive/config')return Promise.resolve(new Response(JSON.stringify({botUsername:'testbot'}),{headers:{'Content-Type':'application/json'}}));if(url.pathname.startsWith('/api/interactive/'))return rooms.handle(new Request(url,init));return Promise.resolve(new Response('{}',{status:404}));};
      win.addEventListener('error',(event: any)=>failures.push(String(event.error?.stack||event.message)));
    }
  }); return dom;
}
const clients: any[]=[];
try {
  const host=client('المنظم'); clients.push(host); const doc=host.window.document;
  await until(()=>doc.querySelector('#codeRoomsPanel'),'game home');
  assert.equal(doc.querySelectorAll('.code-home-actions button').length,2);
  assert.equal(doc.querySelectorAll('.code-home .code-placeholder').length,25);
  assert.equal(doc.querySelectorAll('.code-home .code-team').length,2);
  assert.equal(doc.querySelectorAll('.code-home .code-card').length,0);
  assert.equal(doc.querySelector('#gameApp')?.getAttribute('data-game'),'codenames');
  assert.equal(doc.querySelector('.game-card[data-game="codenames"] .game-art-image')?.getAttribute('src'),'/codenames-hero-v1.jpg');
  assert.equal((doc.querySelector('#codeRoomsSection') as HTMLElement).hidden,true);
  (doc.querySelector('#codeRoomsPanel') as HTMLElement).click();
  assert.equal((doc.querySelector('#codeRoomsSection') as HTMLElement).hidden,false);
  (doc.querySelector('#codeCreate') as HTMLElement).click();
  await until(()=>doc.querySelector('.code-room'),'created room');
  assert.equal(doc.querySelectorAll('.code-room .code-placeholder').length,25);
  assert.equal(doc.querySelectorAll('.code-room .code-card').length,0);
  assert.ok(doc.querySelector('[data-action="code-invite"]'));
  assert.equal((doc.querySelector('[data-action="start"]') as HTMLButtonElement).disabled,true);
  const id=new URL(host.window.location.href).searchParams.get('room');assert.ok(id);
  for(const name of ['ثاني','ثالث','رابع']) clients.push(client(name, '?room='+id+'&game=codenames'));
  await until(()=>doc.querySelectorAll('.code-player').length===4,'four players in host view');
  const start=doc.querySelector('[data-action="start"]') as HTMLButtonElement; assert.ok(start); assert.equal(start.disabled,false); start.click();
  await until(()=>doc.querySelectorAll('.code-card').length===25,'host board');
  await until(()=>clients.every(c=>c.window.document.querySelectorAll('.code-card').length===25),'all boards');
  assert.equal(doc.querySelectorAll('.code-room .code-match-layout .code-team').length,2);
  assert.ok(doc.querySelector('.code-team.blue') && doc.querySelector('.code-team.red'));
  assert.equal(doc.querySelectorAll('.code-room .code-card .code-card-word').length,25);
  assert.equal(doc.querySelectorAll('.code-room .code-placeholder').length,0);
  assert.equal(doc.querySelectorAll('.code-room .code-role-box').length,4);
  assert.ok(doc.querySelector('#codeTimer'));
  const spies=clients.filter(c=>c.window.document.querySelector('.code-card.key'));
  const ops=clients.filter(c=>!c.window.document.querySelector('.code-card.key'));
  assert.equal(spies.length,2);assert.equal(ops.length,2);
  assert.ok(ops.every(c=>c.window.document.querySelectorAll('.code-card[class*="blue"],.code-card[class*="red"],.code-card.assassin,.code-card.bystander').length===0));
  const activeSpy=spies.find(c=>c.window.document.querySelector('#codeClueForm'));assert.ok(activeSpy);
  const spyDoc=activeSpy.window.document;
  (spyDoc.querySelector('#codeClueWord') as HTMLInputElement).value='تلميحمميز';
  (spyDoc.querySelector('#codeClueForm') as HTMLFormElement).dispatchEvent(new activeSpy.window.Event('submit',{bubbles:true,cancelable:true}));
  await until(()=>ops.some(c=>c.window.document.querySelector('.code-card:not(:disabled)')),'operative turn');
  const activeOp=ops.find(c=>c.window.document.querySelector('.code-card:not(:disabled)'))!;
  const card=activeOp.window.document.querySelector('.code-card:not(:disabled)') as HTMLButtonElement;card.click();
  await until(()=>activeOp.window.document.querySelector('.code-card.revealed'),'revealed card');
  for (const c of ops) {
    const hiddenCards=[...c.window.document.querySelectorAll('.code-card:not(.revealed)')];
    assert.ok(hiddenCards.every((el: any)=>!['blue','red','assassin','bystander','key'].some(k=>el.classList.contains(k))));
  }
  activeOp.window.confirm=()=>true;
  (activeOp.window.document.querySelector('[data-action="code-exit"]') as HTMLButtonElement).click();
  await until(()=>activeOp.window.document.querySelector('#gameSetupPage.active .code-home .code-placeholder'),'exit returns to Codenames board home');
  assert.equal(activeOp.window.document.querySelectorAll('#gameSetupPage.active .code-placeholder').length,25);
  assert.equal(failures.length,0,failures.join('\n'));
  console.log('Codenames DOM: lobby, room creation, 4 real clients, private keys, clue and card action passed.');
} finally {clients.forEach(c=>c.window.close())}
