(() => {
  'use strict';
  const params = new URLSearchParams(location.search), shape = params.get('shape'), session = params.get('session');
  const tg = window.Telegram?.WebApp, initData = tg?.initData || '';
  const button = document.getElementById('start'), status = document.getElementById('status'), progress = document.getElementById('progress');
  document.getElementById('shape').textContent = shape === 'circle' ? 'فيد دائري' : 'الرابط غير صالح.';
  tg?.ready(); tg?.expand();
  class ShapeVideoError extends Error {}
  const fail = text => { status.textContent = text; button.textContent = 'حاول مرة ثانية'; button.hidden = false; button.disabled = false; progress.hidden = true; };
  if (shape !== 'circle' || !/^[a-f0-9]{32}$/.test(session || '') || !initData) {
    button.hidden = true; status.textContent = 'افتح النافذة من زر الشكل داخل محادثة البوت.'; return;
  }
  const headers = {'Authorization': `tma ${initData}`, 'X-Shape-Session':session, 'X-Shape-Kind':shape};
  let finished = false, running = false;
  async function convert() {
    if (running) return;
    if (finished) { tg?.close(); return; }
    running = true; button.hidden = true; button.disabled = true; let ffmpeg, wasmUrl;
    try {
      status.textContent = 'جاري جلب الفيديو من البوت...';
      const source = await fetch('/api/shape-video/source', {method:'POST',headers});
      if (!source.ok) throw new ShapeVideoError('تعذّر جلب الفيديو أو انتهت صلاحية الاختيار. أرسل الفيديو من جديد.');
      const input = new Uint8Array(await source.arrayBuffer());
      if (!window.FFmpegWASM?.FFmpeg || !window.DecompressionStream) throw new ShapeVideoError('جهازك ما يدعم محرّك التحويل. جرّب جهاز أو تطبيق تيليگرام أحدث.');
      status.textContent = 'جاري تنزيل محرّك التحويل وتجهيزه...';
      const wasm = await fetch('/shape-video/vendor/core.wasm.gz.bin');
      if (!wasm.ok || !wasm.body) throw new ShapeVideoError('تعذّر تنزيل محرّك التحويل.');
      const decompressed = wasm.body.pipeThrough(new DecompressionStream('gzip'));
      wasmUrl = URL.createObjectURL(new Blob([await new Response(decompressed).arrayBuffer()], {type:'application/wasm'}));
      ffmpeg = new window.FFmpegWASM.FFmpeg();
      ffmpeg.on('progress', ({progress: value}) => { if (Number.isFinite(value)) progress.value = Math.max(0, Math.min(100, Math.round(value * 100))); });
      await ffmpeg.load({coreURL:new URL('/shape-video/vendor/ffmpeg-core.js',location.origin).href,wasmURL:wasmUrl});
      await ffmpeg.writeFile('input', input);
      await ffmpeg.ffprobe(['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1','-o','duration.txt','input'], 15000);
      let durationText = '';
      try { durationText = new TextDecoder().decode(await ffmpeg.readFile('duration.txt')).trim(); } catch {}
      const duration = Number(durationText);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 60.1) throw new ShapeVideoError('مدة الفيديو لازم تكون 60 ثانية أو أقل.');
      const args = ['-i','input'];
      const scale = 'scale=480:480:force_original_aspect_ratio=increase,crop=480:480,setsar=1';
      args.push('-vf', scale, '-map','0:v:0','-map','0:a:0?');
      args.push('-t','60','-c:v','libx264','-preset','ultrafast','-crf','28','-maxrate','1200k','-bufsize','2400k','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','output.mp4');
      status.textContent = 'جاري تحويل الفيديو على جهازك...'; progress.hidden = false; progress.value = 0;
      if (await ffmpeg.exec(args, 300000) !== 0) throw new ShapeVideoError('تعذّر تحويل هذا الفيديو على جهازك. جرّب فيديو ثاني.');
      const output = await ffmpeg.readFile('output.mp4');
      if (!(output instanceof Uint8Array) || !output.length || output.length > 15 * 1024 * 1024) throw new ShapeVideoError('الملف الناتج أكبر من الحد أو التحويل ما اكتمل. جرّب مقطع أقصر.');
      status.textContent = 'جاري إرسال الفيديو للبوت...'; progress.hidden = true;
      const sent = await fetch('/api/shape-video/send', {method:'POST',headers:{...headers,'Content-Type':'video/mp4'},body:output});
      if (!sent.ok || !(await sent.json()).ok) throw new ShapeVideoError('تعذّر إرسال الفيديو. جرّب مرة ثانية.');
      status.textContent = 'انرسل الفيديو بالمحادثة.'; finished = true; button.textContent = 'رجوع للمحادثة'; button.hidden = false; button.disabled = false;
    } catch (error) {
      fail(error instanceof ShapeVideoError ? error.message : 'تعذّر التحويل أو الاتصال على هذا الجهاز. جرّب مرة ثانية.');
    } finally { running = false; ffmpeg?.terminate(); if (wasmUrl) URL.revokeObjectURL(wasmUrl); }
  }
  button.addEventListener('click', () => { void convert(); });
  void convert();
})();
