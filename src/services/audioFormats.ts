/**
 * كشف صيغ الصوت من البايتات نفسها.
 *
 * سبب وجود هذا الملف: تيليجرام يقبل «البصمة الصوتية» (voice) بصيغة OGG
 * وبكوديك Opus فقط. أي ملف ثاني ينخزن كبصمة لكن التطبيقات ما تكدر تشغّله،
 * فيطلع للمستخدم فويس فارغ بلا صوت. فالفحص هنا يحمي من إرسال أي شيء غير
 * OGG/Opus على أنه بصمة.
 */

export type AudioContainer = 'ogg-opus' | 'ogg-vorbis' | 'mp3' | 'm4a' | 'wav' | 'flac' | 'webm' | 'unknown';

const ascii = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
};

/** يقرأ أول 4 بايت كوسم نصي (ftyp, RIFF, OggS …). */
function tagAt(bytes: Uint8Array, offset: number, length = 4): string {
  if (bytes.length < offset + length) return '';
  return ascii(bytes.subarray(offset, offset + length));
}

export function sniffAudioContainer(bytes: Uint8Array | null | undefined): AudioContainer {
  if (!bytes || bytes.length < 12) return 'unknown';

  if (tagAt(bytes, 0) === 'OggS') {
    const head = ascii(bytes.subarray(0, Math.min(bytes.length, 65536)));
    if (head.includes('OpusHead')) return 'ogg-opus';
    return 'ogg-vorbis';
  }
  if (tagAt(bytes, 0) === 'fLaC') return 'flac';
  if (tagAt(bytes, 0) === 'RIFF' && tagAt(bytes, 8) === 'WAVE') return 'wav';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  if (tagAt(bytes, 4) === 'ftyp') {
    const brand = tagAt(bytes, 8).toLowerCase();
    // m4a/mp4 share the same container; the audio track inside is AAC.
    if (brand === 'm4a ' || brand === 'm4b ' || brand === 'mp42' || brand === 'isom' || brand === 'iso2' || brand === 'mp41' || brand === 'qt  ') {
      return 'm4a';
    }
    return 'm4a';
  }
  if (tagAt(bytes, 0, 3) === 'ID3') return 'mp3';
  // MPEG audio frame sync (0xFFEx / 0xFFFx)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return 'mp3';
  return 'unknown';
}

/** تيليجرام يعرض البصمة الصوتية فقط إذا كانت OGG تحمل Opus. */
export function isTelegramVoice(bytes: Uint8Array | null | undefined): boolean {
  return sniffAudioContainer(bytes) === 'ogg-opus';
}

/** الامتداد والـMIME الصحيحان لكل صيغة — بدل تسمية كل شي mp3 أو ogg. */
export function audioFileMeta(container: AudioContainer): { extension: string; mimeType: string } {
  switch (container) {
    case 'ogg-opus':
    case 'ogg-vorbis':
      return { extension: 'ogg', mimeType: 'audio/ogg' };
    case 'mp3':
      return { extension: 'mp3', mimeType: 'audio/mpeg' };
    case 'm4a':
      return { extension: 'm4a', mimeType: 'audio/mp4' };
    case 'wav':
      return { extension: 'wav', mimeType: 'audio/wav' };
    case 'flac':
      return { extension: 'flac', mimeType: 'audio/flac' };
    case 'webm':
      return { extension: 'weba', mimeType: 'audio/webm' };
    default:
      return { extension: 'ogg', mimeType: 'audio/ogg' };
  }
}

/**
 * قرار الإرسال كبصمة صوتية:
 * - OGG/Opus جاهزة → تنرسل كما هي.
 * - أي صيغة ثانية → تحتاج تحويل فعلي؛ إذا ماكو محوّل ما ينرسل شي مزيف.
 */
export function voiceDelivery(bytes: Uint8Array | null | undefined, transcoderAvailable: boolean): {
  sendAsVoice: boolean;
  needsTranscode: boolean;
} {
  if (isTelegramVoice(bytes)) return { sendAsVoice: true, needsTranscode: false };
  return { sendAsVoice: false, needsTranscode: transcoderAvailable };
}

/** ترويسة ID3 مسموحة على MP3 فقط — كتابتها على OGG تخرب الملف. */
export function canWriteId3Tags(bytes: Uint8Array | null | undefined): boolean {
  return sniffAudioContainer(bytes) === 'mp3';
}
