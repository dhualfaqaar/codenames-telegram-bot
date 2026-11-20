import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdtemp, rm, writeFile, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_INPUT = 20 * 1024 * 1024, MAX_OUTPUT = 15 * 1024 * 1024;
const SHAPES = new Set(['circle','star','hexagon','pentagon','triangle']);

function run(executable, args, timeout = 120000) {
  return new Promise((resolve, reject) => {
    let stdout = '', settled = false;
    const child = spawn(executable, args, {stdio:['ignore','pipe','ignore'], shell:false, env:{PATH: process.env.PATH || '/usr/bin:/bin'}});
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error('timeout')); }, timeout);
    function finish(err) { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(stdout); }
    child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length > 65536) child.kill('SIGKILL'); });
    child.on('error', () => finish(new Error('execution failed')));
    child.on('close', code => finish(code === 0 ? null : new Error('execution failed')));
  });
}

function createMask(kind, size = 480) {
  const count = kind === 'star' ? 10 : kind === 'triangle' ? 3 : kind === 'pentagon' ? 5 : 6;
  const points = Array.from({length:count}, (_, i) => {
    const angle = -Math.PI / 2 + i * 2 * Math.PI / count;
    const radius = size * (kind === 'star' && i % 2 ? 0.21 : 0.47);
    return [size / 2 + Math.cos(angle) * radius, size / 2 + Math.sin(angle) * radius];
  });
  const header = Buffer.from(`P5\n${size} ${size}\n255\n`), out = Buffer.alloc(header.length + size * size);
  header.copy(out);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi,yi] = points[i], [xj,yj] = points[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    out[header.length + y * size + x] = inside ? 255 : 0;
  }
  return out;
}

async function boundedResponse(response, max) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > max) throw new Error('download failed');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > max) throw new Error('download too large');
    chunks.push(Buffer.from(chunk));
  }
  if (!length) throw new Error('empty download');
  return Buffer.concat(chunks, length);
}

/** Real conversion, with no network access from ffmpeg, strict limits and cleanup. */
export async function convertVideo(input, shape, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe') {
  if (!SHAPES.has(shape) || !input?.length || input.length > MAX_INPUT) throw new Error('invalid input');
  const dir = await mkdtemp(join(tmpdir(), 'shape-video-'));
  try {
    const src = join(dir, 'input'), mask = join(dir, 'mask.pgm'), output = join(dir, 'output.mp4');
    await writeFile(src, input, {mode:0o600});
    const inputOptions = ['-protocol_whitelist','file,pipe','-format_whitelist','mov,matroska,avi,mpegts'];
    const data = JSON.parse(await run(ffprobe, ['-v','error',...inputOptions,'-show_entries','format=duration:stream=codec_type','-of','json',src], 20000));
    const duration = Number(data?.format?.duration);
    if (!data.streams?.some(stream => stream.codec_type === 'video') || !Number.isFinite(duration) || duration <= 0 || duration > 60.1) throw new Error('invalid duration');
    const args = ['-hide_banner','-loglevel','error','-y',...inputOptions,'-i',src];
    const scale = 'scale=480:480:force_original_aspect_ratio=increase,crop=480:480,setsar=1';
    if (shape === 'circle') args.push('-vf',scale,'-map','0:v:0','-map','0:a:0?');
    else {
      await writeFile(mask,createMask(shape), {mode:0o600});
      args.push('-loop','1','-i',mask,'-filter_complex',`[0:v]${scale}[v];[1:v]format=gray[mask];[v][mask]alphamerge[fg];color=black:s=480x480:r=25[bg];[bg][fg]overlay=shortest=1:eof_action=endall,format=yuv420p[out]`,'-map','[out]','-map','0:a:0?');
    }
    args.push('-t',String(Math.min(duration, 60)),'-fs',String(MAX_OUTPUT),'-c:v','libx264','-threads','2','-preset','veryfast','-crf','28','-maxrate','1M','-bufsize','2M','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart',output);
    await run(ffmpeg,args);
    const size = (await stat(output)).size;
    if (size < 16 || size >= MAX_OUTPUT) throw new Error('invalid output size');
    const verified = JSON.parse(await run(ffprobe, ['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_type,width,height','-of','json',output], 20000));
    const resultDuration = Number(verified?.format?.duration);
    if (!verified.streams?.some(stream => stream.codec_type === 'video' && stream.width === 480 && stream.height === 480) || !Number.isFinite(resultDuration) || resultDuration < Math.min(duration,60) - 0.5 || resultDuration > 60.5) throw new Error('invalid output');
    return await readFile(output);
  } finally { await rm(dir,{recursive:true,force:true}); }
}

function authorized(header, secret) {
  if (!header?.startsWith('Bearer ') || header.length > 512) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

/** Separate service. The bot token is configured on this service, never passed in jobs. */
export function createVideoProcessorServer({token, secret, ffmpeg = 'ffmpeg', ffprobe = 'ffprobe', telegramApi = 'https://api.telegram.org', maxJobs = 2, fetcher = fetch}) {
  if (!token || typeof secret !== 'string' || secret.length < 32) throw new Error('token and a 32+ character service secret are required');
  const busy = new Set();
  const api = method => `${telegramApi}/bot${token}/${method}`;
  async function notify(chatId, text) {
    try { await fetcher(api('sendMessage'), {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text}),signal:AbortSignal.timeout(15000)}); } catch {}
  }
  async function job({chatId,fileId,shape}) {
    try {
      const response = await fetcher(api('getFile'), {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file_id:fileId}),signal:AbortSignal.timeout(15000)});
      const details = await response.json(), path = details?.result?.file_path, size = Number(details?.result?.file_size || 0);
      if (!response.ok || !details?.ok || typeof path !== 'string' || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').includes('..') || size > MAX_INPUT) throw new Error('invalid file');
      const download = await fetcher(`${telegramApi}/file/bot${token}/${path}`, {signal:AbortSignal.timeout(45000)});
      const bytes = await boundedResponse(download,MAX_INPUT);
      const result = await convertVideo(bytes,shape,ffmpeg,ffprobe);
      const form = new FormData(), circle = shape === 'circle';
      form.append('chat_id',chatId);
      form.append(circle ? 'video_note' : 'video',new Blob([result],{type:'video/mp4'}),'video.mp4');
      form.append(circle ? 'length' : 'supports_streaming',circle ? '480' : 'true');
      const sent = await fetcher(api(circle ? 'sendVideoNote' : 'sendVideo'),{method:'POST',body:form,signal:AbortSignal.timeout(60000)});
      const sentData = await sent.json();
      if (!sent.ok || !sentData?.ok) throw new Error('delivery failed');
    } catch {
      await notify(chatId,'تعذّر تحويل الفيديو أو إرساله. تأكد من مدته وحجمه وجرّب مرة ثانية.');
    } finally { busy.delete(chatId); }
  }
  const server = createServer(async (req,res) => {
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200,{'content-type':'application/json'}); res.end('{"ok":true}'); return; }
    if (req.method !== 'POST' || req.url !== '/jobs') { res.writeHead(404); res.end(); return; }
    if (!authorized(req.headers.authorization, secret)) { res.writeHead(401); res.end(); req.resume(); return; }
    const chunks = []; let size = 0;
    try {
      for await (const chunk of req) { size += chunk.length; if (size > 4096) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const {chatId,fileId,shape} = payload;
      if (typeof chatId !== 'string' || !/^\d{5,20}$/.test(chatId) || typeof fileId !== 'string' || !fileId || fileId.length > 1024 || !SHAPES.has(shape)) { res.writeHead(400); res.end(); return; }
      if (busy.has(chatId) || busy.size >= maxJobs) { res.writeHead(429); res.end(); return; }
      busy.add(chatId);
      res.writeHead(202,{'content-type':'application/json','cache-control':'no-store'}); res.end('{"ok":true}');
      void job({chatId,fileId,shape});
    } catch { if (!res.headersSent) { res.writeHead(400); res.end(); } }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createVideoProcessorServer({token:process.env.TELEGRAM_BOT_TOKEN, secret:process.env.VIDEO_SHAPES_SECRET, ffmpeg:process.env.FFMPEG_PATH || 'ffmpeg', ffprobe:process.env.FFPROBE_PATH || 'ffprobe'});
  const port = Number(process.env.PORT || 8080);
  server.listen(port,'0.0.0.0',() => console.log(`Video processor listening on port ${port}`));
}
