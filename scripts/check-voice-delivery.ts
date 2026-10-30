// فحص سلوكي حقيقي: نشغّل البوت بتوكن وهمي ونعترض كل طلبات تيليجرام، حتى
// نتأكد إن «البصمة الصوتية» ما تنرسل أبداً ببايتات مو OGG/Opus (السبب اللي
// كان يخلي الفويس يطلع فارغ)، وإن تعديل الاسم/الصورة ما يخرب الفويس.
import assert from 'node:assert/strict';
import { TelegramBotManager, registerAudioTranscoder } from '../server/telegramBot';
import { isTelegramVoice, sniffAudioContainer } from '../src/services/audioFormats';

const text = (value: string) => Uint8Array.from(value, ch => ch.charCodeAt(0));

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const MP3 = concat(text('ID3'), new Uint8Array([4, 0, 0, 0, 0, 0, 0]), new Uint8Array(2048));
const OGG_OPUS = concat(text('OggS'), new Uint8Array([0, 2, 0, 0, 0, 0, 0, 0]), text('OpusHead'), new Uint8Array(2048));
const OGG_VORBIS = concat(text('OggS'), new Uint8Array([0, 2, 0, 0, 0, 0, 0, 0]), text('\x01vorbis'), new Uint8Array(512));

let passed = 0;
const check = (name: string, condition: boolean) => {
  if (!condition) throw new Error(`فشل: ${name}`);
  passed += 1;
};

type Call = { method: string; body: FormData | null; url: string };
let calls: Call[] = [];
let downloadBytes: Uint8Array = MP3;

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = (async (input: any, init?: any) => {
  const url = String(typeof input === 'string' ? input : input.url);
  if (url.includes('/file/bot')) {
    return new Response(downloadBytes as unknown as BodyInit, { status: 200 });
  }
  const method = url.split('/').pop()!.split('?')[0];
  const body = init?.body instanceof FormData ? (init.body as FormData) : null;
  calls.push({ method, body, url });
  if (method === 'getFile') return jsonResponse({ ok: true, result: { file_path: 'voice/file.mp3' } });
  if (method === 'getMe') return jsonResponse({ ok: true, result: { id: 1, username: 'testbot', first_name: 'Bot' } });
  return jsonResponse({ ok: true, result: { message_id: 1, audio: { file_id: 'audio-out' }, voice: { file_id: 'voice-out' } } });
}) as typeof fetch;

const bot = new TelegramBotManager('TEST:TOKEN');
const anyBot = bot as any;

async function runConversion(action: string, kind: 'video' | 'audio' | 'voice', source: Uint8Array) {
  calls = [];
  downloadBytes = source;
  anyBot.pendingConvert.set('77', { fileId: 'file-1', kind });
  anyBot.audioEditDrafts.set('77', {
    fileId: 'file-1',
    sourceKind: kind,
    title: '',
    artist: '',
    fileName: 'clip',
    coverFileId: undefined
  });
  const cb = { id: 'cb1', from: { id: 77 }, message: { chat: { id: 77 }, message_id: 5 } };
  await anyBot.executeFormatConversion(cb, action);
  return calls;
}

const voiceCalls = (list: Call[]) => list.filter(call => call.method === 'sendVoice');
const audioCalls = (list: Call[]) => list.filter(call => call.method === 'sendAudio');
async function bytesOf(call: Call, field: string): Promise<Uint8Array> {
  const blob = call.body?.get(field);
  assert.ok(blob, `الحقل ${field} موجود`);
  return new Uint8Array(await (blob as Blob).arrayBuffer());
}

/* ---------------------------------------- 1) MP3 → «بصمة» بدون محوّل */
{
  registerAudioTranscoder(null);
  const list = await runConversion('to_voice', 'audio', MP3);
  check('MP3 ما تنرسل بصمة (هذا سبب الفويس الفارغ سابقاً)', voiceCalls(list).length === 0);
  const audio = audioCalls(list);
  check('الصوت ينرسل كملف صوتي بدل البصمة', audio.length === 1);
  const file = audio[0].body?.get('audio') as File;
  check('امتداد الملف mp3 وليس ogg', String(file?.name || '').endsWith('.mp3'));
  check('نوع الملف audio/mpeg', String(file?.type || '') === 'audio/mpeg');
  check('البايتات المرسلة هي نفس MP3 سليمة', sniffAudioContainer(await bytesOf(audio[0], 'audio')) === 'mp3');
}

/* ----------------------------------- 2) فيديو MP4 → «بصمة» بدون محوّل */
{
  registerAudioTranscoder(null);
  const mp4 = concat(new Uint8Array([0, 0, 0, 0x20]), text('ftypisom'), new Uint8Array(1024));
  const list = await runConversion('to_voice', 'video', mp4);
  check('الفيديو ما ينرسل بصمة بدون تحويل حقيقي', voiceCalls(list).length === 0);
  check('الفيديو يتحول لملف صوتي M4A', audioCalls(list).length === 1);
  const file = audioCalls(list)[0].body?.get('audio') as File;
  check('امتداد M4A صحيح', String(file?.name || '').endsWith('.m4a') && String(file?.type || '') === 'audio/mp4');
}

/* --------------------------------------- 3) مع محوّل ينتج OGG/Opus فعلي */
{
  registerAudioTranscoder(async () => OGG_OPUS);
  const list = await runConversion('to_voice', 'video', concat(new Uint8Array([0, 0, 0, 0x20]), text('ftypisom'), new Uint8Array(1024)));
  const voices = voiceCalls(list);
  check('مع المحوّل تنرسل بصمة صوتية', voices.length === 1);
  const sent = await bytesOf(voices[0], 'voice');
  check('البايتات المرسلة OGG/Opus', isTelegramVoice(sent));
  const file = voices[0].body?.get('voice') as File;
  check('اسم الملف ogg وmime audio/ogg', String(file?.name || '') === 'voice.ogg' && String(file?.type || '') === 'audio/ogg');
}

/* ------------------------------ 4) محوّل يرجع بايتات غلط: ممنوع تنرسل بصمة */
{
  registerAudioTranscoder(async () => MP3);
  const list = await runConversion('to_voice', 'audio', MP3);
  check('محوّل غلط = ماكو بصمة', voiceCalls(list).length === 0);
  check('وينرسل ملف صوتي صحيح بدلاً منها', audioCalls(list).length === 1);
}

/* ------------------------------- 5) OGG/Opus أصلية تمر كما هي بلا تحويل */
{
  registerAudioTranscoder(null);
  const list = await runConversion('to_voice', 'voice', OGG_OPUS);
  const voices = voiceCalls(list);
  check('البصمة الأصلية تنرسل بصمة', voices.length === 1);
  check('بايتاتها ما تتغيّر', isTelegramVoice(await bytesOf(voices[0], 'voice')));
}

/* ------------------------- 6) تعديل الاسم/الصورة على فويس OGG ما يخربه */
{
  registerAudioTranscoder(null);
  calls = [];
  downloadBytes = OGG_OPUS;
  anyBot.audioEditDrafts.set('77', {
    fileId: 'file-1',
    sourceKind: 'voice',
    title: 'اسم جديد',
    artist: 'فنان',
    fileName: 'مقطع',
    coverFileId: undefined
  });
  await anyBot.executeFormatConversion({ id: 'cb2', from: { id: 77 }, message: { chat: { id: 77 }, message_id: 6 } }, 'edit_send');
  const voices = voiceCalls(calls);
  check('تعديل فويس OGG ينرسل بصمة مو ملف صوتي مكسور', voices.length === 1);
  const sent = await bytesOf(voices[0], 'voice');
  check('ما انكتبت ترويسة ID3 على OGG', !(sent[0] === 0x49 && sent[1] === 0x44 && sent[2] === 0x33));
  check('الملف بعده OGG/Opus سليم', sniffAudioContainer(sent) === 'ogg-opus');
  check('ماكو عنوان/fنان ينرسل للبصمة (ما تقبل وسوم)', !voices[0].body?.get('title'));
}

/* --------------- 6ب) OGG Vorbis (مو بصمة) ينرسل ملف صوتي سليم بلا ID3 */
{
  registerAudioTranscoder(null);
  calls = [];
  downloadBytes = OGG_VORBIS;
  anyBot.audioEditDrafts.set('77', {
    fileId: 'file-1',
    sourceKind: 'voice',
    title: 'اسم',
    artist: 'فنان',
    fileName: 'clip',
    coverFileId: undefined
  });
  await anyBot.executeFormatConversion({ id: 'cb2b', from: { id: 77 }, message: { chat: { id: 77 }, message_id: 8 } }, 'edit_send');
  const audio = audioCalls(calls);
  check('OGG Vorbis ينرسل كملف صوتي مو بصمة', audio.length === 1 && voiceCalls(calls).length === 0);
  const sent = await bytesOf(audio[0], 'audio');
  check('بلا ترويسة ID3 على Vorbis', !(sent[0] === 0x49 && sent[1] === 0x44 && sent[2] === 0x33));
  check('امتداد ogg مطابق', String((audio[0].body?.get('audio') as File)?.name || '').endsWith('.ogg'));
}

/* ------------------- 7) تعديل MP3 يبقى يكتب ID3 (المسار الصحيح ما انكسر) */
{
  registerAudioTranscoder(null);
  calls = [];
  downloadBytes = MP3;
  anyBot.audioEditDrafts.set('77', {
    fileId: 'file-1',
    sourceKind: 'audio',
    title: 'أغنية',
    artist: 'فنان',
    fileName: 'track',
    coverFileId: undefined
  });
  await anyBot.executeFormatConversion({ id: 'cb3', from: { id: 77 }, message: { chat: { id: 77 }, message_id: 7 } }, 'edit_send');
  const audio = audioCalls(calls);
  check('تعديل MP3 ينرسل كملف صوتي', audio.length === 1);
  const sent = await bytesOf(audio[0], 'audio');
  check('ترويسة ID3 موجودة بالمخرج', sent[0] === 0x49 && sent[1] === 0x44 && sent[2] === 0x33);
  check('والحاوية بعدها mp3', sniffAudioContainer(sent) === 'mp3');
}

/* ---------------------------------------- 8) رجوع «البصمة إلى MP3» صحيح */
{
  registerAudioTranscoder(null);
  const list = await runConversion('to_audio', 'voice', OGG_OPUS);
  const audio = audioCalls(list);
  check('تحويل البصمة إلى ملف صوتي ينرسل كملف', audio.length === 1);
  const file = audio[0].body?.get('audio') as File;
  check('امتداد الصوت يطابق البايتات (ogg)', String(file?.name || '').endsWith('.ogg'));
  check('mime مطابق audio/ogg', String(file?.type || '') === 'audio/ogg');
}

registerAudioTranscoder(null);
console.log(`Voice delivery checks passed: ${passed} assertions (no fake voice notes, ID3 only on MP3, correct MIME).`);
