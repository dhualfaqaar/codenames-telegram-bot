/** Identify actual containers rather than trusting a provider's type or filename. */
export type TelegramMedia = { method: 'sendPhoto' | 'sendVideo' | 'sendAnimation'; field: 'photo' | 'video' | 'animation'; mime: string; extension: string };
const ascii = (b: Uint8Array, start: number, len: number) => String.fromCharCode(...b.slice(start, start + len));
const contains = (bytes: Uint8Array, word: string) => {
  const first = word.charCodeAt(0);
  for (let i = 0; i <= bytes.length - word.length; i++) {
    if (bytes[i] !== first) continue;
    let j = 1; while (j < word.length && bytes[i + j] === word.charCodeAt(j)) j++;
    if (j === word.length) return true;
  }
  return false;
};
export function classifyTelegramMedia(bytes: Uint8Array, expected: 'photo' | 'video'): TelegramMedia | null {
  if (bytes.length < 16) return null;
  if (ascii(bytes, 4, 4) === 'ftyp') {
    // Do not send a pure audio MP4 or a thumbnail as a playable video.
    if (!contains(bytes, 'moov') || !contains(bytes, 'vide')) return null;
    return { method: 'sendVideo', field: 'video', mime: 'video/mp4', extension: 'mp4' };
  }
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')
    return { method: 'sendAnimation', field: 'animation', mime: 'image/gif', extension: 'gif' };
  if (expected === 'video') return null; // never substitute a still preview for a video
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { method: 'sendPhoto', field: 'photo', mime: 'image/jpeg', extension: 'jpg' };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    // Telegram cannot reliably display APNG as an animation through sendPhoto.
    const text = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 65536)));
    if (text.includes('acTL')) return null;
    return { method: 'sendPhoto', field: 'photo', mime: 'image/png', extension: 'png' };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    if (ascii(bytes, 12, 4) === 'VP8X' && (bytes[20] & 2)) return null;
    return { method: 'sendPhoto', field: 'photo', mime: 'image/webp', extension: 'webp' };
  }
  return null;
}
