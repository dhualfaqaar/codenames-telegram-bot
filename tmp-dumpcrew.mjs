import { JSDOM } from 'jsdom';
const base='http://localhost:3000';
const html=await (await fetch(base+'/amongus')).text();
const dom=new JSDOM(html,{url:base+'/amongus',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(window){
  window.fetch=(i,init)=>fetch(new URL(String(i),base),init);
  window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(_t,p)=>{
    if(p==='canvas')return{width:800,height:600};
    if(p==='createRadialGradient'||p==='createLinearGradient')return()=>({addColorStop(){}});
    if(p==='measureText')return()=>({width:10});
    return()=>{};},set:()=>true});
  window.Telegram={WebApp:{initData:'x',initDataUnsafe:{user:{id:1,first_name:'Test'}},ready(){},expand(){},setHeaderColor(){},onEvent(){},colorScheme:'dark'}};
  window.requestAnimationFrame=()=>0;
}});
await new Promise(r=>setTimeout(r,600));
const fs=await import('node:fs');
fs.writeFileSync('/tmp/svgcheck/svgs/crew.svg',dom.window.document.getElementById('auPlayerBean').innerHTML);
const grid=dom.window.document.getElementById('auColorGrid').innerHTML;
fs.writeFileSync('/tmp/svgcheck/grid.html',grid);
console.log('crew len',dom.window.document.getElementById('auPlayerBean').innerHTML.length);
console.log('colors', (grid.match(/data-color/g)||[]).length);
