// Browser-DOM regressions for silent menus and Among Us-only game sounds.
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
const base = process.env.GAMES_TEST_URL || 'http://localhost:3000';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function load(path, injectSound = false) {
  const html = await (await fetch(`${base}${path}`)).text(), errors = [], played = [];
  const dom = new JSDOM(html, {url: `${base}${path}`, runScripts:'dangerously', pretendToBeVisual:true, virtualConsole: new VirtualConsole(), beforeParse(window) {
    window.scrollTo = () => {};
    window.matchMedia = () => ({matches:false,addEventListener(){},removeEventListener(){}});
    window.fetch = input => fetch(new URL(String(input),base));
    window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get:(_t,p)=>p==='createRadialGradient'||p==='createLinearGradient'?()=>({addColorStop(){}}):p==='measureText'?()=>({width:10}):()=>{}, set:()=>true });
    if (injectSound) window.GameSfx = {play(name){played.push(name)}};
    window.Telegram = {WebApp:{ready(){},expand(){},onEvent(){},setHeaderColor(){},setBackgroundColor(){},isVersionAtLeast(){return false},BackButton:{show(){},hide(){},onClick(){}},initDataUnsafe:{user:{id:7,first_name:'لاعب'}}}};
    window.navigator.vibrate = () => true;
    window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  }});
  await sleep(350); return {dom, window:dom.window, document:dom.window.document, errors, played};
}
{
  const p=await load('/interactive', true), {window,document,played}=p;
  assert.equal(document.querySelector('.cg-sfx-btn'),null);
  const cards=Array.from(document.querySelectorAll('#gamesPanel .game-grid [data-game]'));
  assert.equal(cards.length,7); assert.ok(cards.every(card=>!card.querySelector('p')));
  const coming=document.querySelector('.game-upcoming');
  assert.equal(coming?.textContent.trim(),'ألعاب قادمة'); assert.equal(coming?.tagName,'DIV');
  assert.equal(coming?.querySelector('button,a,p'),null);
  document.querySelector('.tab[data-tab="account"]')?.click();
  assert.deepEqual(played,[]); assert.deepEqual(p.errors,[]); window.close();
}
{
  const p=await load('/sudoku', true), {window,document,played}=p;
  assert.equal(document.querySelector('.cg-sfx-btn'),null);
  document.querySelector('[data-level="easy"]').click(); await sleep(200);
  const empty=Array.from(document.querySelectorAll('.cell')).find(cell=>!cell.classList.contains('given'));
  assert.ok(empty); empty.click();
  const number=Array.from(document.querySelectorAll('.num')).find(button=>!button.disabled); assert.ok(number); number.click();
  document.getElementById('hintButton').click();
  assert.deepEqual(played,[]); assert.deepEqual(p.errors,[]); window.close();
}
{
  const p=await load('/chess', true), {window,document,played}=p;
  assert.equal(document.querySelector('.cg-sfx-btn'),null);
  document.getElementById('chessPlayButton')?.click();
  assert.deepEqual(played,[]); assert.deepEqual(p.errors,[]); window.close();
}
{
  const p=await load('/amongus'), {window,document}=p;
  assert.ok(window.GameSfx); assert.equal(document.querySelector('.cg-sfx-btn'),null);
  assert.ok(document.getElementById('auMusicToggle')); assert.ok(document.getElementById('auSoundToggle'));
  const played=[], original=window.GameSfx.play;
  window.GameSfx.play = name => { played.push(name); return original(name) };
  document.getElementById('auCodeCard').click(); await sleep(100);
  assert.deepEqual(played,[], 'UI clicks must not play sounds');
  assert.equal(window.GameSfx.musicEnabled(),true); assert.deepEqual(p.errors,[]); window.close();
}
console.log('Game UI DOM: no descriptions or floating sound controls, silent buttons and non-Among-Us games; Among Us settings and music retained.');
