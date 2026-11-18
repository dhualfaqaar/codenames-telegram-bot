// Requires FFmpeg with AAC, MP3, Opus and H.264 encoders. Set FFMPEG to its path.
// Decode every delivery and compare PCM, instead of just checking file signatures.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractMp4Audio } from '../src/services/mp4Audio';
import { TelegramBotManager, registerAudioTranscoder } from '../server/telegramBot';

const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const dir = mkdtempSync(join(tmpdir(), 'bot-audio-test-'));
const path = (name: string) => join(dir, name);
const run = (...args: string[]) => execFileSync(ffmpeg, ['-v', 'error', '-xerror', ...args], { maxBuffer: 16 * 1024 * 1024 });
const pcm = (file: string) => run('-i', file, '-map', '0:a:0', '-f', 's16le', '-acodec', 'pcm_s16le', '-');
const file = (name: string) => new Uint8Array(readFileSync(path(name)));
const assertSound = (name: string, reference: Buffer) => {
  const output = pcm(path(name));
  assert.ok(output.some(byte => byte !== 0), `${name} contains audible samples`);
  assert.deepEqual(output, reference, `${name}: decoded audio must be identical`);
};

try {
  const audio = ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=2'];
  for (const position of ['early', 'late']) {
    run('-f', 'lavfi', '-i', 'color=c=blue:s=128x96:r=10:d=2', ...audio,
      '-c:v', 'libx264', '-c:a', 'aac', ...(position === 'early' ? ['-movflags', '+faststart'] : []), '-shortest', '-y', path(`${position}.mp4`));
    const original = file(`${position}.mp4`), snapshot = Uint8Array.from(original);
    const result = extractMp4Audio(original);
    assert.ok(result, `${position} video extracted`);
    assert.deepEqual(original, snapshot, 'input is never mutated');
    writeFileSync(path(`${position}-out.m4a`), result);
    assertSound(`${position}-out.m4a`, pcm(path(`${position}.mp4`)));
    assert.deepEqual(extractMp4Audio(result), result, 'old video-marked audio is unchanged');
    assert.throws(() => execFileSync(ffmpeg, ['-v', 'error', '-i', path(`${position}-out.m4a`), '-map', '0:v:0', '-f', 'null', '-'], {stdio: 'ignore'}), 'video track removed');
  }
  run(...audio, '-c:a', 'aac', '-movflags', '+faststart', '-y', path('audio.mp4'));
  run(...audio, '-c:a', 'aac', '-y', path('audio.m4a'));
  run(...audio, '-c:a', 'libmp3lame', '-y', path('audio.mp3'));
  run(...audio, '-c:a', 'libopus', '-y', path('voice.ogg'));
  run('-f', 'lavfi', '-i', 'color=c=red:s=48x48:d=0.1', '-frames:v', '1', '-c:v', 'mjpeg', '-y', path('cover.jpg'));
  run('-f', 'lavfi', '-i', 'color=c=blue:s=128x96:r=10:d=2', '-c:v', 'libx264', '-y', path('silent.mp4'));
  run('-f', 'lavfi', '-i', 'color=c=blue:s=128x96:r=10:d=2', ...audio, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'frag_keyframe+empty_moov', '-shortest', '-y', path('fragmented.mp4'));
  assert.equal(extractMp4Audio(file('silent.mp4')), null, 'video without audio rejected');
  assert.equal(extractMp4Audio(file('fragmented.mp4')), null, 'fragmented files rejected');
  assert.equal(extractMp4Audio(file('early.mp4').subarray(0, 100)), null, 'truncated files rejected');
  assert.deepEqual(extractMp4Audio(file('audio.mp4')), file('audio.mp4'), 'audio-only MP4 ftyp is unchanged');

  const stored = new Map<string, Uint8Array>();
  let counter = 0, sent: Array<{method: string; bytes: Uint8Array}> = [], messages: string[] = [];
  const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input), method = url.split('/').pop()!;
    if (url.includes('/file/bot')) return new Response(stored.get(method)! as unknown as BodyInit);
    if (method === 'getFile') return json({ok:true, result:{file_path: JSON.parse(init.body).file_id}});
    if (method === 'sendAudio' || method === 'sendVoice') {
      const blob = init.body.get(method === 'sendAudio' ? 'audio' : 'voice') as Blob;
      const bytes = new Uint8Array(await blob.arrayBuffer()), id = `output${++counter}`;
      sent.push({method, bytes}); stored.set(id, bytes);
      return json({ok:true, result:{message_id:counter, [method === 'sendAudio' ? 'audio' : 'voice']: {file_id:id}}});
    }
    if (method === 'sendMessage') messages.push(String(init.body));
    return json({ok:true, result:{message_id:1}});
  }) as typeof fetch;
  registerAudioTranscoder(null);
  stored.set('cover.jpg', file('cover.jpg'));
  const bot = new TelegramBotManager('TEST:TOKEN') as any;
  const callback = {id:'cb',from:{id:77},message:{chat:{id:77},message_id:5}};
  for (const [name, kind] of [['early.mp4','video'],['late.mp4','video'],['audio.mp4','video'],['audio.m4a','audio'],['audio.mp3','audio'],['voice.ogg','voice']] as const) {
    stored.set(name, file(name)); sent = [];
    bot.audioEditDrafts.set('77', {fileId:name, sourceKind:kind, title:'عنوان', artist:'فنان', fileName:'test', coverFileId:'cover.jpg'});
    const reference = pcm(path(name));
    for (let i = 0; i < 3; i++) {
      await bot.executeFormatConversion(callback, 'edit_send');
      assert.equal(sent.length, i + 1, `${name} edit ${i + 1} sent`);
      assert.equal(sent[i].method, kind === 'voice' ? 'sendVoice' : 'sendAudio');
      assert.equal(bot.audioEditDrafts.get('77').sourceKind, kind === 'voice' ? 'voice' : 'audio');
      const output = `edit-${i}-${name}`;
      writeFileSync(path(output), sent[i].bytes);
      assertSound(output, reference);
    }
  }
  for (const action of ['edit_send','to_audio','to_voice']) {
    for (const name of ['silent.mp4','fragmented.mp4']) {
      stored.set(name, file(name)); sent = []; messages = [];
      bot.audioEditDrafts.set('77', {fileId:name, sourceKind:'video', title:'', artist:'', fileName:'test'});
      bot.pendingConvert.set('77', {fileId:name, kind:'video'});
      await bot.executeFormatConversion(callback, action);
      assert.equal(sent.length, 0, `${name} ${action} must not send broken audio`);
      assert.ok(messages.some(message => message.includes('تعذّر استخراج صوت سليم')), 'user receives a failure explanation');
    }
  }
  console.log('Real audio checks passed: decoded PCM, repeated bot edits, video removal, voice, and safe failures.');
} finally {
  rmSync(dir, {recursive:true, force:true});
}
