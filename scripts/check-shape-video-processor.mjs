// Real FFmpeg conversion and asynchronous processor HTTP flow; Telegram is mocked.
// Set FFMPEG and FFPROBE to native binaries if not on PATH.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVideoProcessorServer, convertVideo} from '../video-processor/server.mjs';

const ffmpeg=process.env.FFMPEG || 'ffmpeg', ffprobe=process.env.FFPROBE || 'ffprobe';
const run=(...args)=>execFileSync(ffmpeg,['-v','error','-xerror',...args],{maxBuffer:32*1024*1024});
const dir=mkdtempSync(join(tmpdir(),'shape-processor-test-'));
const inputPath=join(dir,'input.mp4');
run('-f','lavfi','-i','color=c=blue:s=320x180:r=15:d=1','-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=1','-c:v','libx264','-c:a','aac','-shortest','-y',inputPath);
let input=readFileSync(inputPath), resolveDelivery, latest;
const secret='s'.repeat(40), token='123:TEST';
const json = value => new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});
let apiCalls=[], rejectSend=false;
const fakeFetch=async (url, init={}) => {
  url=String(url); apiCalls.push(url);
  if (url.endsWith('/getFile')) return json({ok:true,result:{file_path:'videos/input.mp4',file_size:input.length}});
  if (url.includes('/file/bot')) return new Response(input);
  if (url.endsWith('/sendVideoNote') || url.endsWith('/sendVideo')) {
    const note=url.endsWith('/sendVideoNote'), file=init.body.get(note?'video_note':'video');
    latest={note,chatId:init.body.get('chat_id'),bytes:Buffer.from(await file.arrayBuffer())};
    if (rejectSend) return json({ok:false,description:'rejected'});
    resolveDelivery?.({ok:true}); return json({ok:true,result:{message_id:1}});
  }
  if (url.endsWith('/sendMessage')) { latest={failure:JSON.parse(init.body).text}; resolveDelivery?.({ok:false}); return json({ok:true}); }
  throw new Error('unexpected mocked request');
};
const server=createVideoProcessorServer({token,secret,ffmpeg,ffprobe,fetcher:fakeFetch,maxJobs:1});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const send=(job,auth=secret)=>fetch(`${base}/jobs`,{method:'POST',headers:{authorization:`Bearer ${auth}`,'content-type':'application/json'},body:JSON.stringify(job)});
try {
  assert.equal((await fetch(`${base}/health`)).status,200);
  assert.equal((await send({chatId:'12345',fileId:'video',shape:'circle'},'wrong')).status,401);
  assert.equal(apiCalls.length,0);
  assert.equal((await send({chatId:'12345',fileId:'video',shape:'bad'})).status,400);
  assert.equal((await send({chatId:'../../etc',fileId:'video',shape:'star'})).status,400);
  assert.equal((await fetch(`${base}/jobs`,{method:'POST',headers:{authorization:`Bearer ${secret}`},body:'a'.repeat(5000)})).status,413);
  for (const shape of ['circle','star','hexagon','pentagon','triangle']) {
    const done=new Promise(resolve=>{resolveDelivery=resolve;}); latest=null;
    assert.equal((await send({chatId:'12345',fileId:'video',shape})).status,202);
    assert.equal((await send({chatId:'12345',fileId:'video',shape})).status,429,'concurrent duplicate rejected');
    assert.deepEqual(await Promise.race([done,new Promise((_,reject)=>{ const timer=setTimeout(()=>reject(new Error('job timeout')),30000); timer.unref(); })]),{ok:true});
    assert.equal(latest.note,shape==='circle'); assert.equal(latest.chatId,'12345');
    const output=join(dir,`${shape}.mp4`); writeFileSync(output,latest.bytes);
    const info=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=duration','-of','json',output],{encoding:'utf8'}));
    assert.ok(info.streams.some(s=>s.codec_type==='video' && s.codec_name==='h264' && s.width===480 && s.height===480));
    assert.ok(info.streams.some(s=>s.codec_type==='audio' && s.codec_name==='aac'));
    assert.ok(Number(info.format.duration)<2);
    assert.ok(run('-i',output,'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-').some(b=>b!==0),'audible samples');
    const frame=run('-i',output,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-');
    const px=(x,y)=>[...frame.subarray((y*480+x)*3,(y*480+x)*3+3)];
    assert.ok(px(240,240)[2]>120,`${shape} center has video`);
    if(shape!=='circle') {
      assert.ok(px(0,0).every(v=>v<20),`${shape} outside is black`);
      const n=shape==='star'?10:shape==='triangle'?3:shape==='pentagon'?5:6;
      const points=Array.from({length:n},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n, r=480*(shape==='star' && i%2?0.21:0.47);return [240+Math.cos(a)*r,240+Math.sin(a)*r];});
      let checked=0;
      for(let y=20;y<460;y+=20) for(let x=20;x<460;x+=20) {
        let inside=false,near=false;
        for(let i=0,j=n-1;i<n;j=i++) {
          const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
          const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
          if(Math.hypot(x-(ax+t*dx),y-(ay+t*dy))<8) near=true;
          if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
        }
        if(!near) { const blue=px(x,y)[2]; assert.ok(inside?blue>100:blue<30,`${shape} pixel ${x},${y}`); checked++; }
      }
      assert.ok(checked>250);
    }
    console.log(`${shape}: real video, audio, duration and delivery checked`);
  }
  const silent=join(dir,'silent.mp4');
  run('-f','lavfi','-i','color=c=blue:s=320x180:r=15:d=1','-c:v','libx264','-y',silent);
  const silentOut=await convertVideo(readFileSync(silent),'triangle',ffmpeg,ffprobe);
  writeFileSync(join(dir,'silent-out.mp4'),silentOut);
  const silentInfo=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_type:format=duration','-of','json',join(dir,'silent-out.mp4')],{encoding:'utf8'}));
  assert.equal(silentInfo.streams.filter(s=>s.codec_type==='audio').length,0);
  assert.ok(Number(silentInfo.format.duration)<2);
  const long=join(dir,'long.mp4');
  run('-f','lavfi','-i','color=c=blue:s=32x32:r=1:d=61','-c:v','libx264','-y',long);
  input=readFileSync(long);
  const done=new Promise(resolve=>{resolveDelivery=resolve;}); latest=null;
  assert.equal((await send({chatId:'12345',fileId:'video',shape:'circle'})).status,202);
  assert.deepEqual(await done,{ok:false}); assert.match(latest.failure,/تعذّر/);
  input=readFileSync(inputPath); rejectSend=true;
  const rejectionDone=new Promise(resolve=>{resolveDelivery=resolve;}); latest=null;
  assert.equal((await send({chatId:'12345',fileId:'video',shape:'circle'})).status,202);
  assert.deepEqual(await rejectionDone,{ok:false});
  assert.match(latest.failure,/تعذّر/, 'Telegram rejection must be reported');
  rejectSend=false;
  await assert.rejects(()=>convertVideo(Buffer.from('invalid'),'star',ffmpeg,ffprobe));
  console.log('Processor rejects invalid/long files, reports errors, and never sends fake success.');
} finally { await new Promise(resolve=>server.close(resolve)); rmSync(dir,{recursive:true,force:true}); }
