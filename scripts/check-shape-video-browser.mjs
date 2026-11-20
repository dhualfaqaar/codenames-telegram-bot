// Integration test: real browser executes the bundled FFmpeg.wasm; Telegram is mocked.
// Requires @playwright/test, @sparticuz/chromium, ffmpeg and ffprobe.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { chromium } from '@playwright/test';
import chromiumBinary from '@sparticuz/chromium';

const dir = mkdtempSync(join(tmpdir(), 'shape-video-'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg', ffprobe = process.env.FFPROBE || 'ffprobe';
const run = (...args) => execFileSync(ffmpeg, ['-v','error','-xerror',...args], {maxBuffer:16*1024*1024});
const video = join(dir,'input.mp4');
run('-f','lavfi','-i','color=c=blue:s=320x180:r=15:d=1', '-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=1', '-c:v','libx264','-c:a','aac','-shortest','-y', video);
let input = readFileSync(video); const outputs = new Map();
const root = join(process.cwd(),'public');
const server = createServer((req,res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/shape-video/source') {
    assert.equal(req.headers.authorization, 'tma test-signed-data');
    res.end(input); return;
  }
  if (u.pathname === '/api/shape-video/send') {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      outputs.set(req.headers['x-shape-kind'],Buffer.concat(chunks));
      res.writeHead(200,{'content-type':'application/json'}); res.end('{"ok":true}');
    }); return;
  }
  if (!u.pathname.startsWith('/shape-video/') || u.pathname.includes('..')) { res.writeHead(404); res.end(); return; }
  let name = join(root, u.pathname); if (u.pathname.endsWith('/')) name = join(name,'index.html');
  try {
    const ext=extname(name), type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : 'application/octet-stream';
    res.writeHead(200, {'content-type': type}); res.end(readFileSync(name));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({executablePath: await chromiumBinary.executablePath(), args:chromiumBinary.args, headless:true});
  const page = await browser.newPage();
  page.on('console', msg => console.log('browser:', msg.text()));
  await page.route('https://telegram.org/js/telegram-web-app.js', route => route.fulfill({contentType:'text/javascript',body:'window.Telegram={WebApp:{initData:"test-signed-data",ready(){},expand(){}}};'}));
  for (const shape of ['circle','star','hexagon','pentagon','triangle']) {
    await page.goto(`http://127.0.0.1:${server.address().port}/shape-video/?session=${'a'.repeat(32)}&shape=${shape}`);
    await page.locator('#start').click();
    try { await page.waitForFunction(() => !document.querySelector('#start').disabled, null, {timeout:90000});
      assert.equal(await page.locator('#status').textContent(), 'انرسل الفيديو بالمحادثة.'); }
    catch (err) { console.error('shape:',shape,'status:',await page.locator('#status').textContent()); throw err; }
    const result = outputs.get(shape); assert.ok(result?.length, `${shape}: output sent`);
    const file=join(dir,`${shape}.mp4`); writeFileSync(file,result);
    const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_type,codec_name,width,height:format=duration','-of','json',file],{encoding:'utf8'}));
    assert.ok(probe.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264' && s.width === 480 && s.height === 480));
    assert.ok(probe.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac'));
    assert.ok(Number(probe.format.duration) <= 2);
    const pcm=run('-i',file,'-map','0:a:0','-f','s16le','-acodec','pcm_s16le','-');
    assert.ok(pcm.some(byte => byte !== 0), `${shape}: audio isn't silent`);
    const frame=run('-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','-');
    const pixel = (x,y) => [...frame.subarray((y*480+x)*3,(y*480+x)*3+3)];
    assert.ok(pixel(240,240)[2] > 120, `${shape}: center has video`);
    if (shape !== 'circle') {
      assert.ok(pixel(0,0).every(c => c < 20), `${shape}: corner is masked`);
      // Compare interior samples to an independent polygon model; omit edge pixels.
      const n = shape === 'star' ? 10 : shape === 'triangle' ? 3 : shape === 'pentagon' ? 5 : 6;
      const vertices = Array.from({length:n}, (_, i) => {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n, r = 480 * (shape === 'star' && i % 2 ? 0.21 : 0.47);
        return [240 + Math.cos(a)*r, 240 + Math.sin(a)*r];
      });
      let verified = 0;
      for (let y=20; y<460; y+=20) for (let x=20; x<460; x+=20) {
        let inside=false, near=false;
        for (let i=0,j=n-1; i<n; j=i++) {
          const [ax,ay]=vertices[j], [bx,by]=vertices[i], dx=bx-ax, dy=by-ay;
          const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
          if (Math.hypot(x-(ax+t*dx),y-(ay+t*dy)) < 8) near=true;
          if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
        }
        if (!near) { const blue=pixel(x,y)[2]; assert.ok(inside ? blue>100 : blue<30, `${shape} pixel ${x},${y}`); verified++; }
      }
      assert.ok(verified>250);
    }
    console.log(`${shape}: decoded H264, AAC, shape and duration verified`);
  }
  // No-audio videos remain silent but still produce a real shaped video.
  const silent=join(dir,'silent.mp4');
  run('-f','lavfi','-i','color=c=blue:s=320x180:r=15:d=1','-c:v','libx264','-y',silent);
  input=readFileSync(silent); outputs.clear();
  await page.goto(`http://127.0.0.1:${server.address().port}/shape-video/?session=${'a'.repeat(32)}&shape=star`);
  await page.locator('#start').click();
  await page.waitForFunction(() => !document.querySelector('#start').disabled, null, {timeout:90000});
  assert.equal(await page.locator('#status').textContent(), 'انرسل الفيديو بالمحادثة.');
  const silentOutput=join(dir,'silent-out.mp4'); writeFileSync(silentOutput,outputs.get('star'));
  const silentProbe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_type:format=duration','-of','json',silentOutput],{encoding:'utf8'}));
  assert.equal(silentProbe.streams.filter(s=>s.codec_type==='audio').length,0);
  assert.ok(Number(silentProbe.format.duration) <= 2, 'silent video duration is not extended');

  const long=join(dir,'long.mp4');
  run('-f','lavfi','-i','color=c=blue:s=32x32:r=1:d=61','-c:v','libx264','-y',long);
  input=readFileSync(long); outputs.clear();
  await page.goto(`http://127.0.0.1:${server.address().port}/shape-video/?session=${'a'.repeat(32)}&shape=circle`);
  await page.locator('#start').click();
  await page.waitForFunction(() => !document.querySelector('#start').disabled, null, {timeout:90000});
  assert.match(await page.locator('#status').textContent(), /60 ثانية/);
  assert.equal(outputs.size,0, 'long input is not silently truncated and sent');
  await page.goto(`http://127.0.0.1:${server.address().port}/shape-video/?session=bad&shape=circle`);
  assert.equal(await page.locator('#start').isDisabled(),true);
  console.log('Real browser video shape checks passed; Telegram upload is mocked.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); rmSync(dir,{recursive:true,force:true}); }
