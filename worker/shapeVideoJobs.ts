/** Cloud conversion runs in its own per-user Durable Object, never the game-state object. */
type Shape = 'circle' | 'star' | 'hexagon' | 'pentagon' | 'triangle';
type Job = { uid: string; fileId: string; shape: Shape; fallback: string; started: number; stage: 'queued' | 'submitting' | 'polling' | 'sending'; remoteId?: string; polls: number };
type Env = { TELEGRAM_BOT_TOKEN?: string; UPLOAD_POST_API_KEY?: string; PREVIEW_MODE?: string };
const origin = 'https://api.upload-post.com/api/uploadposts/ffmpeg';
const shapes = ['circle','star','hexagon','pentagon','triangle'];

/** Single-filter polygon mask: provider rejects semicolons in filter_complex. */
export function shapeVideoCommand(shape: Shape): string {
  const scale = 'scale=480:480:force_original_aspect_ratio=increase,crop=480:480,setsar=1';
  let filter = scale;
  if (shape !== 'circle') {
    const n = shape === 'star' ? 10 : shape === 'triangle' ? 3 : shape === 'pentagon' ? 5 : 6;
    const points = Array.from({length:n}, (_,i) => {
      const angle = -Math.PI / 2 + i * 2 * Math.PI / n, r = 480 * (shape === 'star' && i % 2 ? .21 : .47);
      return [240 + Math.cos(angle)*r, 240 + Math.sin(angle)*r];
    });
    const inside = (x: string, y: string) => {
      const parts: string[] = [];
      for (let i=0;i<n;i++) {
        const [xi,yi]=points[i], [xj,yj]=points[(i+n-1)%n];
        if (Math.abs(yj-yi)<0.00001) continue;
        const f=(v:number) => v.toFixed(4);
        parts.push(`gt(${y},${f(Math.min(yi,yj))})*lte(${y},${f(Math.max(yi,yj))})*lt(${x},${f(xi)}+(${y}-${f(yi)})*${((xj-xi)/(yj-yi)).toFixed(8)})`);
      }
      return `mod(${parts.join('+')},2)`;
    };
    const l=inside('X','Y'), c=inside('2*X','2*Y');
    filter += `,geq=lum='if(${l},lum(X,Y),16)':cb='if(${c},cb(X,Y),128)':cr='if(${c},cr(X,Y),128)'`;
  }
  // No untrusted values enter the command. Provider's parser forbids shell metacharacters.
  return `ffmpeg -y -i {input} -vf "${filter}" -map 0:v:0 -map 0:a:0? -c:v libx264 -preset ultrafast -crf 28 -maxrate 1200k -bufsize 2400k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart {output}`;
}

async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > limit) throw new Error('download');
  const reader=response.body.getReader(), chunks: Uint8Array[]=[]; let size=0;
  for (;;) { const v=await reader.read(); if(v.done) break; size+=v.value.length; if(size>limit) { await reader.cancel(); throw new Error('size'); } chunks.push(v.value); }
  const bytes=new Uint8Array(size); let pos=0; for(const chunk of chunks) { bytes.set(chunk,pos); pos+=chunk.length; } return bytes;
}


/** Never forward the provider credential to a redirect destination. */
async function downloadResult(url: string, key: string): Promise<Response> {
  let current = new URL(url);
  for (let i=0;i<4;i++) {
    const host=current.hostname.toLowerCase();
    if (current.protocol !== 'https:' || current.username || current.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || /^[0-9.]+$/.test(host) || host.includes(':')) throw new Error('redirect');
    const headers = current.origin === 'https://api.upload-post.com' ? {authorization:`Apikey ${key}`} : undefined;
    const response=await fetch(current.toString(),{headers,redirect:'manual',signal:AbortSignal.timeout(45000)});
    if (response.status < 300 || response.status >= 400) return response;
    const location=response.headers.get('location'); if (!location) throw new Error('redirect');
    current=new URL(location,current);
  }
  throw new Error('redirect');
}

export class ShapeVideoJobs {
  constructor(private state: any, private env: Env) {}
  private async notify(job: Job, text: string, fallback = true): Promise<void> {
    try {
      const body: any = {chat_id:job.uid,text};
      if (fallback) body.reply_markup={inline_keyboard:[[{text:'حوّل على جهازك',web_app:{url:job.fallback}}]]};
      await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    } catch { /* Do not log tokens or signed URLs. */ }
  }
  private async end(job: Job, text: string): Promise<void> {
    await this.clear();
    await this.notify(job,text);
  }
  private async clear(): Promise<void> {
    await this.state.blockConcurrencyWhile(async () => {
      await this.state.storage.delete('job'); await this.state.storage.deleteAlarm();
    });
  }
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || this.env.PREVIEW_MODE === 'true' || !this.env.UPLOAD_POST_API_KEY || !this.env.TELEGRAM_BOT_TOKEN) return new Response('unavailable',{status:503});
    let raw: any; try {raw=await request.json();} catch {return new Response('bad request',{status:400});}
    if (!/^\d{5,}$/.test(String(raw?.uid || '')) || typeof raw?.fileId !== 'string' || !raw.fileId || !shapes.includes(raw.shape) || typeof raw?.fallback !== 'string') return new Response('bad request',{status:400});
    // Only called from the authenticated bot object, not exposed on the public Worker.
    return this.state.blockConcurrencyWhile(async () => {
      if (await this.state.storage.get('job')) return new Response('busy',{status:409});
      const job: Job={uid:raw.uid,fileId:raw.fileId,shape:raw.shape,fallback:raw.fallback,started:Date.now(),stage:'queued',polls:0};
      await this.state.storage.put('job',job); await this.state.storage.setAlarm(Date.now()+1000);
      return new Response('ok');
    });
  }
  async alarm(): Promise<void> {
    const job: Job | undefined = await this.state.storage.get('job');
    if (!job) return;
    if (!this.env.UPLOAD_POST_API_KEY || !this.env.TELEGRAM_BOT_TOKEN || this.env.PREVIEW_MODE === 'true') { await this.end(job,'خدمة التحويل مو متاحة هسه.'); return; }
    if (Date.now()-job.started > 15*60_000) { await this.end(job,'التحويل تأخر أكثر من اللازم. جرّب التحويل على جهازك.'); return; }
    if (job.stage === 'submitting' || job.stage === 'sending') {
      await this.end(job,'انقطع الاتصال أثناء التحويل أو الإرسال، فما نكدر نتأكد إذا اكتمل. شوف المحادثة قبل ما تحاول مرة ثانية.'); return;
    }
    try {
      if (job.stage === 'queued') {
        job.stage='submitting'; await this.state.storage.put('job',job);
        // If an invocation is interrupted, never resubmit an ambiguous paid/quota-consuming request.
        await this.state.storage.setAlarm(Date.now()+60_000);
        const fileRes=await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/getFile`,{method:'POST',redirect:'manual',headers:{'content-type':'application/json'},body:JSON.stringify({file_id:job.fileId}),signal:AbortSignal.timeout(15000)});
        const data: any=await fileRes.json(), path=data?.result?.file_path;
        if(!fileRes.ok || !data?.ok || typeof path!=='string' || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').includes('..') || Number(data?.result?.file_size || 0)>20*1024*1024) throw new Error('telegram');
        const source=await fetch(`https://api.telegram.org/file/bot${this.env.TELEGRAM_BOT_TOKEN}/${path}`,{redirect:'manual',signal:AbortSignal.timeout(30000)});
        const bytes=await readBounded(source,20*1024*1024);
        if(bytes.length<12) throw new Error('telegram');
        const form=new FormData(); form.set('file',new Blob([bytes as unknown as BlobPart],{type:'application/octet-stream'}),'input.mp4');
        form.set('full_command',shapeVideoCommand(job.shape)); form.set('output_extension','mp4');
        const response=await fetch(`${origin}/jobs/upload`,{method:'POST',redirect:'manual',headers:{authorization:`Apikey ${this.env.UPLOAD_POST_API_KEY}`},body:form,signal:AbortSignal.timeout(60000)});
        if(response.status===429) {await this.end(job,'وصلنا حد التحويل أو الخدمة مزدحمة هسه.');return;}
        if(!response.ok) throw new Error('provider');
        const result:any=await response.json();
        if(!result?.success || typeof result.job_id!=='string' || !/^[a-zA-Z0-9-]{1,100}$/.test(result.job_id)) throw new Error('provider');
        job.remoteId=result.job_id; job.stage='polling'; await this.state.storage.put('job',job); await this.state.storage.setAlarm(Date.now()+5000); return;
      }
      if (!job.remoteId || !/^[a-zA-Z0-9-]{1,100}$/.test(job.remoteId)) throw new Error('provider');
      const headers={authorization:`Apikey ${this.env.UPLOAD_POST_API_KEY}`};
      const res=await fetch(`${origin}/jobs/${job.remoteId}`,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
      if(!res.ok) throw new Error('provider');
      const result:any=await res.json();
      if(result?.status==='PENDING' || result?.status==='PROCESSING') {
        job.polls++; await this.state.storage.put('job',job); await this.state.storage.setAlarm(Date.now()+Math.min(30_000, 5000+job.polls*2000)); return;
      }
      if(result?.status!=='FINISHED') throw new Error('provider');
      const out=await downloadResult(`${origin}/jobs/${job.remoteId}/download`,this.env.UPLOAD_POST_API_KEY);
      const bytes=await readBounded(out,15*1024*1024);
      if(bytes.length<16 || String.fromCharCode(...bytes.subarray(4,8))!=='ftyp') throw new Error('output');
      job.stage='sending'; await this.state.storage.put('job',job); await this.state.storage.setAlarm(Date.now()+60_000);
      const form=new FormData(); const circle=job.shape==='circle'; form.set('chat_id',job.uid);
      form.set(circle?'video_note':'video',new Blob([bytes as unknown as BlobPart],{type:'video/mp4'}),'video.mp4');
      if(circle) form.set('length','480'); else form.set('supports_streaming','true');
      const sent=await fetch(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/${circle?'sendVideoNote':'sendVideo'}`,{method:'POST',redirect:'manual',body:form,signal:AbortSignal.timeout(60000)});
      const sentJson:any=await sent.json(); if(!sent.ok || !sentJson?.ok) throw new Error('send');
      await this.clear();
    } catch {
      // A network failure during upload/send may have succeeded remotely. Do not retry silently.
      await this.end(job,'تعذّر التحويل أو الإرسال. شوف المحادثة قبل المحاولة، وتگدر تحوّله على جهازك.');
    }
  }
}
