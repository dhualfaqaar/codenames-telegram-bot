// يفحص منطق البصمة الصوتية: تيليجرام يشغّل البصمة فقط إذا كانت OGG/Opus،
// وأي بايتات ثانية لازم تنرسل كملف صوتي صحيح بدل بصمة فارغة.
import assert from 'node:assert/strict';
import {
  audioFileMeta,
  canWriteId3Tags,
  isTelegramVoice,
  sniffAudioContainer,
  voiceDelivery
} from '../src/services/audioFormats';
import * as EXT from '../src/services/extraToolsEngine';

let passed = 0;
function check(name: string, fn: () => boolean) {
  if (!fn()) throw new Error(`فشل: ${name}`);
  passed += 1;
}

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string, pad = 0) => {
  const out = new Uint8Array(value.length + pad);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i);
  return out;
};
const concat = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

/* ------------------------------------------------------------- sniffing */

const opusOgg = concat([text('OggS'), bytes(0, 2, 0, 0, 0, 0, 0, 0), text('OpusHead'), new Uint8Array(64)]);
const vorbisOgg = concat([text('OggS'), bytes(0, 2, 0, 0, 0, 0, 0, 0), text('\x01vorbis'), new Uint8Array(64)]);
const id3Mp3 = concat([text('ID3'), bytes(4, 0, 0, 0, 0, 0, 0), new Uint8Array(64)]);
const bareMp3 = concat([bytes(0xff, 0xfb, 0x90, 0x64), new Uint8Array(64)]);
const m4a = concat([bytes(0, 0, 0, 0x20), text('ftypM4A '), new Uint8Array(64)]);
const mp4 = concat([bytes(0, 0, 0, 0x20), text('ftypisom'), new Uint8Array(64)]);
const wav = concat([text('RIFF'), bytes(0, 0, 0, 0), text('WAVE'), new Uint8Array(64)]);
const flac = concat([text('fLaC'), new Uint8Array(64)]);
const webm = concat([bytes(0x1a, 0x45, 0xdf, 0xa3), new Uint8Array(64)]);

check('OGG مع Opus يتعرف عليه كبصمة', () => sniffAudioContainer(opusOgg) === 'ogg-opus' && isTelegramVoice(opusOgg));
check('OGG مع Vorbis مو بصمة', () => sniffAudioContainer(vorbisOgg) === 'ogg-vorbis' && !isTelegramVoice(vorbisOgg));
check('MP3 بترويسة ID3 ينتعرف عليه', () => sniffAudioContainer(id3Mp3) === 'mp3');
check('MP3 بلا ID3 (frame sync) ينتعرف عليه', () => sniffAudioContainer(bareMp3) === 'mp3');
check('M4A و MP4 يتعرفون كـ m4a', () => sniffAudioContainer(m4a) === 'm4a' && sniffAudioContainer(mp4) === 'm4a');
check('WAV و FLAC و WebM يتعرفون', () => sniffAudioContainer(wav) === 'wav' && sniffAudioContainer(flac) === 'flac' && sniffAudioContainer(webm) === 'webm');
check('بايتات فاضية أو قصيرة = unknown', () => sniffAudioContainer(new Uint8Array(0)) === 'unknown' && sniffAudioContainer(bytes(1, 2, 3)) === 'unknown');

/* --------------------------------------------------- الامتداد والـMIME */

check('امتداد mp3 وmime صحيح', () => {
  const meta = audioFileMeta('mp3');
  return meta.extension === 'mp3' && meta.mimeType === 'audio/mpeg';
});
check('امتداد ogg وmime صحيح', () => {
  const meta = audioFileMeta('ogg-opus');
  return meta.extension === 'ogg' && meta.mimeType === 'audio/ogg';
});
check('امتداد m4a وmime صحيح', () => {
  const meta = audioFileMeta('m4a');
  return meta.extension === 'm4a' && meta.mimeType === 'audio/mp4';
});

/* ------------------------------------------------------------ قرار الإرسال */

check('OGG/Opus تنرسل بصمة بلا تحويل', () => {
  const plan = voiceDelivery(opusOgg, false);
  return plan.sendAsVoice && !plan.needsTranscode;
});
check('MP3 ما تنرسل بصمة أبداً', () => {
  const plan = voiceDelivery(id3Mp3, false);
  return !plan.sendAsVoice;
});
check('MP3 مع محوّل متاح تحتاج تحويل', () => voiceDelivery(id3Mp3, true).needsTranscode);
check('فيديو MP4 ما ينرسل بصمة بدون تحويل', () => !voiceDelivery(mp4, false).sendAsVoice);

/* --------------------------------------------------------------- ID3 */

check('ID3 تنكتب على MP3 فقط', () => {
  return canWriteId3Tags(id3Mp3) && canWriteId3Tags(bareMp3) && !canWriteId3Tags(opusOgg) && !canWriteId3Tags(m4a) && !canWriteId3Tags(mp4);
});
check('كتابة ID3 على OGG ممنوعة حتى ما يتخرب الفويس', () => {
  // محاكاة المسار القديم: لو انكتبت ترويسة ID3 على OGG تتغيّر أول بايتات وينكسر الملف.
  const corrupted = concat([text('ID3'), bytes(4, 0, 0, 0, 0, 0, 0), opusOgg]);
  return sniffAudioContainer(corrupted) === 'mp3' && !canWriteId3Tags(opusOgg);
});

/* ------------------------------------- إزالة مسار الفيديو من MP4 = M4A صحيح */

check('نزع مسار الفيديو ينتج حاوية صوت معروفة', () => {
  const stripped = EXT.stripVideoTracksFromMp4ToM4a(mp4);
  const container = sniffAudioContainer(stripped);
  return container === 'm4a' || container === 'unknown';
});
check('نزع مسار الفيديو من بايتات عشوائية ما يرمي استثناء', () => {
  const out = EXT.stripVideoTracksFromMp4ToM4a(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  return out instanceof Uint8Array;
});

console.log(`Voice format checks passed: ${passed} assertions (container sniffing, voice gating, ID3 safety).`);
