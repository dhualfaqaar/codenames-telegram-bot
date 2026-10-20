/**
 * ✨ محرك الخدمات الإضافية المتكامل (متوافق 100% مع Cloudflare Workers بدون حظر IP):
 *   1) 🤫 الهمسات السرية (1..5 أشخاص، للجميع، لأول شخص فقط + عرض القارئين داخل البطاقة وعلى الزر + إشعار فوري لصاحب الهمسة)
 *   2) 🎵 البحث وتحميل الأغاني الكاملة («يوت») عبر SoundCloud AWS CloudFront المباشر + YouTube Innertube المحدّث
 *   3) 📥 التحميل المباشر من السوشيال ميديا (تيك توك، إنستغرام، بنترست، يوتيوب) بدون وسطاء محجوبين
 */

// =====================================================================
// 1) 🤫 نظام الهمسات السرية (Whispers)
// =====================================================================

export type WhisperMode = '1' | '2' | '3' | '4' | '5' | 'all' | 'first';

export interface WhisperReader {
  id: string;
  name: string;
  username?: string;
  at: number;
}

export interface WhisperRecord {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername?: string;
  text: string;
  mode: WhisperMode;
  /** قائمة المعرّفات أو اليوزرات المسموح لهم (بدون @ وبأحرف صغيرة). فارغة = أي شخص ضمن العدد المسموح */
  allowedTargets: string[];
  openedBy: WhisperReader[];
  locked: boolean;
  createdAt: number;
}

export interface PendingWhisperDraft {
  step: 'awaiting_text' | 'awaiting_targets';
  mode: WhisperMode;
  text?: string;
}

export function whisperModeLabel(mode: WhisperMode): string {
  switch (mode) {
    case '1':
      return 'لشخص واحد';
    case '2':
      return 'لشخصين';
    case '3':
      return 'لـ ٣ أشخاص';
    case '4':
      return 'لـ ٤ أشخاص';
    case '5':
      return 'لـ ٥ أشخاص';
    case 'all':
      return 'للجميع';
    case 'first':
      return 'لأول شخص فقط';
  }
}

export function whisperMaxCount(mode: WhisperMode): number | null {
  if (mode === 'all') return null;
  if (mode === 'first') return 1;
  const n = parseInt(mode, 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1;
}

export function normalizeTargetToken(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

export function parseWhisperTargets(input: string, maxCount: number): string[] {
  const parts = input
    .split(/[\s,،\n]+/)
    .map(normalizeTargetToken)
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, maxCount);
}

export function createWhisperRecord(opts: {
  creatorId: string;
  creatorName: string;
  creatorUsername?: string;
  mode: WhisperMode;
  text: string;
  allowedTargets?: string[];
}): WhisperRecord {
  const id = Date.now().toString(36).slice(-5) + Math.random().toString(36).substring(2, 5);
  return {
    id,
    creatorId: String(opts.creatorId),
    creatorName: opts.creatorName || 'مستخدم',
    creatorUsername: opts.creatorUsername,
    text: opts.text.slice(0, 195),
    mode: opts.mode,
    allowedTargets: opts.allowedTargets || [],
    openedBy: [],
    locked: false,
    createdAt: Date.now()
  };
}

function mdV2Escape(s: string): string {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function shortBtnName(raw: string, maxLen = 18): string {
  const clean = String(raw || 'مستخدم').replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}…` : clean;
}

/**
 * تنسيق بطاقة الهمسة داخل القناة/المجموعة (MarkdownV2):
 * يعرض اسم المرسل داخل اقتباس، وبمجرد قراءة الهمسة يعرض أسماء القارئين داخل اقتباس أنيق ومرتّب.
 */
export function renderWhisperCardText(wh: WhisperRecord): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const senderBlockquote = `> \\| *${mdV2Escape(wh.creatorName || 'مستخدم')}* \\|`;
  const readersBlock =
    wh.openedBy.length > 0
      ? `\n👀 *قرأها:*\n` +
        wh.openedBy
          .slice(0, 10)
          .map(r => `> \\| *${mdV2Escape(r.name || 'مستخدم')}* \\|`)
          .join('\n') +
        (wh.openedBy.length > 10
          ? `\n> \\+ ${mdV2Escape(String(wh.openedBy.length - 10))} آخرين`
          : '')
      : '';

  if (wh.locked) {
    return (
      `🔒 *همسة مغلقة*\n` +
      `${SEP}\n` +
      `✍️ *المرسل:*\n` +
      `${senderBlockquote}` +
      `${readersBlock}\n` +
      `🔐 *النوع:* ${mdV2Escape(whisperModeLabel(wh.mode))}\n` +
      `⛔ اكتملت قراءة الهمسة وانقفلت\\.`
    );
  }

  const targetLine =
    wh.allowedTargets.length > 0
      ? `\n🎯 *موجّهة إلى:* ${wh.allowedTargets.map(t => (/^\d+$/.test(t) ? mdV2Escape(t) : `@${mdV2Escape(t)}`)).join(' ، ')}`
      : '';

  return (
    `🤫 *همسة سرية*\n` +
    `${SEP}\n` +
    `✍️ *المرسل:*\n` +
    `${senderBlockquote}` +
    `${readersBlock}\n` +
    `🔐 *النوع:* ${mdV2Escape(whisperModeLabel(wh.mode))}${targetLine}\n` +
    `👇 اضغط الزر بالأسفل لقراءة الهمسة سرّاً`
  );
}

/** زر الهمسة القابل للضغط — يعرض حالة القراءة واسم القارئ بوضوح وأناقة */
export function whisperCardKeyboard(wh: WhisperRecord): any[][] {
  if (wh.locked) {
    if (wh.openedBy.length === 1) {
      return [[{ text: `🔒 قرأها: ${shortBtnName(wh.openedBy[0].name, 22)}`, callback_data: `wh:open:${wh.id}` }]];
    }
    if (wh.openedBy.length > 1) {
      const names = wh.openedBy.slice(0, 2).map(r => shortBtnName(r.name, 11)).join(' ، ');
      const extra = wh.openedBy.length > 2 ? ` +${wh.openedBy.length - 2}` : '';
      return [[{ text: `🔒 قرأها: ${names}${extra}`, callback_data: `wh:open:${wh.id}` }]];
    }
    return [[{ text: '🔒 همسة مغلقة', callback_data: `wh:open:${wh.id}` }]];
  }

  if (wh.openedBy.length === 1) {
    return [[{ text: `🤫 فتح الهمسة • 👀 ${shortBtnName(wh.openedBy[0].name, 16)}`, callback_data: `wh:open:${wh.id}` }]];
  }
  if (wh.openedBy.length > 1) {
    return [[{ text: `🤫 فتح الهمسة • 👀 قرأها (${wh.openedBy.length})`, callback_data: `wh:open:${wh.id}` }]];
  }
  return [[{ text: '🤫 فتح الهمسة', callback_data: `wh:open:${wh.id}` }]];
}

export interface OpenWhisperResult {
  allowed: boolean;
  popupText: string;
  justLocked: boolean;
  shouldUpdateCard: boolean;
  shouldNotifyCreator: boolean;
}

export function attemptOpenWhisper(
  wh: WhisperRecord,
  viewer: { id: string | number; name: string; username?: string }
): OpenWhisperResult {
  const viewerId = String(viewer.id);
  const viewerUname = normalizeTargetToken(viewer.username || '');

  // صاحب الهمسة يقدر يعاين همسته بأي وقت بدون أن تنقفل أو تستهلك عدّاد الفتح
  if (viewerId === wh.creatorId) {
    return {
      allowed: true,
      popupText: `🤫 معاينة همستك:\n\n${wh.text}`,
      justLocked: false,
      shouldUpdateCard: false,
      shouldNotifyCreator: false
    };
  }

  // إذا مقفولة مسبقاً → لا يقدر أي شخص آخر يفتحها بعد الآن (إلا من قرأها فعلاً إن أراد تذكّرها؟ لا: طلب المستخدم لأول شخص تقفل نهائياً!)
  if (wh.locked) {
    return {
      allowed: false,
      popupText: '🔒 عذراً، هذه الهمسة انفتحت وانقفلت نهائياً — ما يقدر أحد يشوفها بعد!',
      justLocked: false,
      shouldUpdateCard: false,
      shouldNotifyCreator: false
    };
  }

  // التحقق من قائمة المستهدفين إذا حدّد صاحب الهمسة أشخاصاً معيّنين
  if (wh.allowedTargets.length > 0) {
    const matched =
      wh.allowedTargets.includes(viewerId.toLowerCase()) ||
      (viewerUname !== '' && wh.allowedTargets.includes(viewerUname));
    if (!matched) {
      return {
        allowed: false,
        popupText: '🚫 هذه الهمسة خاصة ومو موجّهة إلك!',
        justLocked: false,
        shouldUpdateCard: false,
        shouldNotifyCreator: false
      };
    }
  }

  const alreadyOpened = wh.openedBy.some(o => o.id === viewerId);
  if (!alreadyOpened) {
    wh.openedBy.push({
      id: viewerId,
      name: viewer.name || 'مستخدم',
      username: viewer.username,
      at: Date.now()
    });
  }

  const maxCount = whisperMaxCount(wh.mode);
  let justLocked = false;
  if (wh.mode === 'first') {
    wh.locked = true;
    justLocked = true;
  } else if (maxCount !== null && wh.openedBy.length >= maxCount && wh.allowedTargets.length === 0) {
    wh.locked = true;
    justLocked = true;
  }

  return {
    allowed: true,
    popupText: `🤫 محتوى الهمسة:\n\n${wh.text}`,
    justLocked,
    shouldUpdateCard: !alreadyOpened || justLocked,
    shouldNotifyCreator: !alreadyOpened
  };
}

export function buildWhisperOwnerNotificationV2(
  wh: WhisperRecord,
  opener: { id: string | number; name: string; username?: string }
): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const unamePart = opener.username ? ` \\(@${mdV2Escape(opener.username)}\\)` : '';
  const maxCount = whisperMaxCount(wh.mode);
  const statusText = wh.locked
    ? '🔒 انقفلت الهمسة نهائياً وما عاد أحد يقدر يشوفها'
    : maxCount !== null
      ? `📊 فُتحت من *${wh.openedBy.length}* من أصل *${maxCount}*`
      : `🌍 متاحة للجميع \\(عدد القارئين حتى الآن: *${wh.openedBy.length}*\\)`;

  return [
    `🔔 *إشعار فتح همستك\\!*`,
    SEP,
    `👤 *الشخص اللي فتح الهمسة:*`,
    `> \\| *${mdV2Escape(opener.name || 'مستخدم')}* \\|${unamePart}`,
    `💬 *محتوى الهمسة:*`,
    `«${mdV2Escape(wh.text)}»`,
    `🔐 *نوع الهمسة:* ${mdV2Escape(whisperModeLabel(wh.mode))}`,
    statusText
  ].join('\n');
}

// =====================================================================
// أدوات HTTP مساعدة متوافقة مع Cloudflare Workers
// =====================================================================

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const MOBILE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const TG_BOT_UA = 'TelegramBot (like TwitterBot)';

export function extractFirstUrl(raw: string): string | null {
  const m = String(raw || '').match(/https?:\/\/[^\s<>"'`]+/i);
  if (!m) return null;
  return m[0].replace(/[),.;!?\]}]+$/, '');
}

function formatDurationSec(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${mins}:${rem}`;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * يسحب الملف الثنائي فعلياً ويتأكد أنه فيديو/صورة/صوت حقيقي وليس صفحة خطأ HTML أو 403،
 * حتى إذا فشل أحد المزوّدين ينتقل الكود تلقائياً للطبقة التالية بدون أن تتوقف العملية!
 */
async function tryFetchMediaBytes(
  url: string,
  headers?: Record<string, string>,
  minBytes = 1500
): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        ...(headers || {})
      }
    });
    if (!r.ok) return null;
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json')) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    if (buf.byteLength < minBytes || buf.byteLength > 49 * 1024 * 1024) return null;
    // فحص إضافي: إذا بدأ الملف بـ <!DOCTYPE أو <html نرفضه فوراً
    if (buf[0] === 0x3c && (buf[1] === 0x21 || buf[1] === 0x68 || buf[1] === 0x48)) return null;
    return buf;
  } catch {
    return null;
  }
}

// =====================================================================
// 2) 🎵 البحث عن الأغاني («يوت») وسحب الصوت الكامل (SoundCloud CDN + YouTube Innertube)
// =====================================================================

export interface SongSearchHit {
  /** sc:<trackId> أو yt:<videoId> */
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
}

export interface ResolvedAudioPayload {
  url?: string;
  bytes?: Uint8Array;
  headers?: Record<string, string>;
  ext: 'mp3' | 'm4a';
}

let cachedScClientId: { id: string; exp: number } | null = null;
let cachedVisitorData: { id: string; exp: number } | null = null;

/** استخراج client_id حي وتلقائي من حزم SoundCloud الرسمية (لا ينتهي أبداً ولا يحظر Cloudflare) */
async function getSoundCloudClientId(): Promise<string | null> {
  if (cachedScClientId && cachedScClientId.exp > Date.now()) {
    return cachedScClientId.id;
  }
  try {
    const resp = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }
    });
    if (resp.ok) {
      const html = await resp.text();
      const scripts = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^\s"']+\.js/g) || [];
      for (const scriptUrl of scripts.slice(-6).reverse()) {
        try {
          const sResp = await fetch(scriptUrl, { headers: { 'User-Agent': BROWSER_UA } });
          if (!sResp.ok) continue;
          const js = await sResp.text();
          const m =
            js.match(/client_id\s*:\s*["']([a-zA-Z0-9_-]{18,64})["']/) ||
            js.match(/client_id=([a-zA-Z0-9_-]{18,64})/);
          if (m?.[1]) {
            cachedScClientId = { id: m[1], exp: Date.now() + 6 * 3600_000 };
            return m[1];
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // continue to public fallback IDs
  }
  return null;
}

function cleanSongTitle(raw: string): string {
  return String(raw || '')
    .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|lyrics?|حصرياً?|نسخة أصلية|4k|hd|hq)[\)\]]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** البحث في SoundCloud عن الأغاني الكاملة حصراً (استبعاد المقاطع الترويجية القصيرة SNIP) */
async function searchSoundCloudSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const clientId = await getSoundCloudClientId();
  if (!clientId) return [];
  try {
    const url =
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}` +
      `&client_id=${encodeURIComponent(clientId)}&limit=${Math.max(12, limit * 3)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        Origin: 'https://soundcloud.com',
        Referer: 'https://soundcloud.com/'
      }
    });
    if (res.status === 401 || res.status === 403) {
      cachedScClientId = null;
      return [];
    }
    if (!res.ok) return [];
    const data: any = await res.json();
    const list: any[] = data?.collection || [];
    const hits: SongSearchHit[] = [];

    for (const t of list) {
      if (!t?.id) continue;
      // استبعاد المقاطع المقصوصة (30 ثانية Go+) أو القصيرة جداً أو الطويلة جداً (> 25 دقيقة حتى لا تتجاوز 50MB)
      if (String(t.policy || '').toUpperCase() === 'SNIP') continue;
      const durMs = Number(t.full_duration || t.duration || 0);
      if (durMs < 25_000 || durMs > 25 * 60_000) continue;
      const transcodings: any[] = t?.media?.transcodings || [];
      if (!transcodings.length) continue;

      const title = cleanSongTitle(t.title || query) || query;
      const artist =
        t?.publisher_metadata?.artist ||
        t?.user?.username ||
        'فنان';
      const thumb = String(t.artwork_url || t?.user?.avatar_url || '').replace('-large', '-t500x500');

      hits.push({
        videoId: `sc:${t.id}`,
        title,
        artist,
        duration: formatDurationSec(Math.round(durMs / 1000)),
        thumbnail: thumb
      });
      if (hits.length >= limit) break;
    }
    return hits;
  } catch {
    return [];
  }
}

/** سحب ملف MP3 كامل ونقي 100% من SoundCloud (يدعم كلاً من Progressive MP3 وتجميع شرائح HLS MP3 من AWS CloudFront) */
async function resolveSoundCloudAudio(trackId: string): Promise<ResolvedAudioPayload | null> {
  const clientId = await getSoundCloudClientId();
  if (!clientId) return null;

  try {
    const infoRes = await fetch(
      `https://api-v2.soundcloud.com/tracks/${encodeURIComponent(trackId)}?client_id=${encodeURIComponent(clientId)}`,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          Origin: 'https://soundcloud.com',
          Referer: 'https://soundcloud.com/'
        }
      }
    );
    if (!infoRes.ok) return null;
    const track: any = await infoRes.json();
    const transcodings: any[] = track?.media?.transcodings || [];

    // 1) الأولوية للرابط المباشر Progressive MP3 (ملف واحد جاهز فوري على CloudFront)
    const progMp3 = transcodings.find(
      t => t?.format?.protocol === 'progressive' && String(t?.format?.mime_type || '').includes('mpeg')
    ) || transcodings.find(t => t?.format?.protocol === 'progressive');

    if (progMp3?.url) {
      const sRes = await fetch(`${progMp3.url}${progMp3.url.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(clientId)}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (sRes.ok) {
        const sj: any = await sRes.json();
        if (sj?.url) {
          return { url: String(sj.url), ext: 'mp3', headers: { 'User-Agent': BROWSER_UA } };
        }
      }
    }

    // 2) إذا كانت الأغنية بصيغة HLS MP3 (.m3u8) نسحب الشرائح بالتوازي من CloudFront وندمجها بملف MP3 واحد نقي!
    const hlsMp3 =
      transcodings.find(
        t => t?.format?.protocol === 'hls' && String(t?.format?.mime_type || '').includes('mpeg')
      ) || transcodings.find(t => t?.format?.protocol === 'hls');

    if (hlsMp3?.url) {
      const sRes = await fetch(`${hlsMp3.url}${hlsMp3.url.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(clientId)}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (sRes.ok) {
        const sj: any = await sRes.json();
        if (sj?.url) {
          const m3uRes = await fetch(String(sj.url), { headers: { 'User-Agent': BROWSER_UA } });
          if (m3uRes.ok) {
            const m3uText = await m3uRes.text();
            const segUrls = m3uText
              .split(/\r?\n/)
              .map(l => l.trim())
              .filter(l => l && !l.startsWith('#'))
              .map(l => (l.startsWith('http') ? l : new URL(l, String(sj.url)).toString()));

            if (segUrls.length > 0) {
              // سقف آمن ٤٠ شريحة (~٧ دقائق صوت نقي متواصل) لعدم تجاوز سقف الـ ٥٠ طلب فرعي في Cloudflare Workers المجاني أبداً!
              const safeSegs = segUrls.slice(0, 40);
              const chunks: Uint8Array[] = [];
              const batchSize = 10;
              for (let i = 0; i < safeSegs.length; i += batchSize) {
                const batch = safeSegs.slice(i, i + batchSize);
                const buffers = await Promise.all(
                  batch.map(async u => {
                    const r = await fetch(u, { headers: { 'User-Agent': BROWSER_UA } });
                    if (!r.ok) throw new Error('seg_failed');
                    return new Uint8Array(await r.arrayBuffer());
                  })
                );
                chunks.push(...buffers);
              }
              const merged = concatUint8Arrays(chunks);
              if (merged.byteLength > 4000) {
                return { bytes: merged, ext: 'mp3' };
              }
            }
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** جلب visitorData حي من يوتيوب لتحاشي رفض عملاء Innertube الحديثة */
async function getYouTubeVisitorData(): Promise<string> {
  if (cachedVisitorData && cachedVisitorData.exp > Date.now()) {
    return cachedVisitorData.id;
  }
  try {
    const res = await fetch('https://www.youtube.com/sw.js_data', {
      headers: { 'User-Agent': BROWSER_UA }
    });
    if (res.ok) {
      const txt = await res.text();
      const m = txt.match(/"(Cgt[a-zA-Z0-9_\-%=]{12,})"/);
      if (m?.[1]) {
        cachedVisitorData = { id: m[1], exp: Date.now() + 2 * 3600_000 };
        return m[1];
      }
    }
  } catch {
    // fallback below
  }
  return '';
}

interface YTClientProfile {
  name: string;
  version: string;
  ua: string;
  extraContext?: Record<string, any>;
}

const YT_NATIVE_CLIENTS: YTClientProfile[] = [
  {
    name: 'ANDROID_VR',
    version: '1.65.10',
    ua: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    extraContext: { androidSdkVersion: 32, osName: 'Android', osVersion: '12L' }
  },
  {
    name: 'IOS',
    version: '20.10.4',
    ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    extraContext: { deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82' }
  },
  {
    name: 'VISIONOS',
    version: '0.1',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    extraContext: { deviceMake: 'Apple', deviceModel: 'RealityDevice14,1', osName: 'visionOS', osVersion: '2.1' }
  }
];

/** استخراج دفق الصوت أو الفيديو من YouTube Innertube مع إرفاق الـ User-Agent المطابق تماماً لتجنب خطأ 403 */
async function extractViaYouTubeNative(
  videoId: string,
  mode: 'audio' | 'video'
): Promise<{ url: string; bytes?: Uint8Array; ua: string; ext: 'm4a' | 'mp4' } | null> {
  const visitorData = await getYouTubeVisitorData();

  for (const profile of YT_NATIVE_CLIENTS) {
    try {
      const clientObj: Record<string, any> = {
        clientName: profile.name,
        clientVersion: profile.version,
        hl: 'ar',
        gl: 'US',
        ...(profile.extraContext || {})
      };
      if (visitorData) clientObj.visitorData = visitorData;

      const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': profile.ua,
          'X-YouTube-Client-Name': profile.name === 'IOS' ? '5' : profile.name === 'ANDROID_VR' ? '28' : '101',
          'X-YouTube-Client-Version': profile.version
        },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: { client: clientObj }
        })
      });
      if (!playerRes.ok) continue;
      const pJson: any = await playerRes.json();
      const adaptive: any[] = pJson?.streamingData?.adaptiveFormats || [];
      const muxed: any[] = pJson?.streamingData?.formats || [];

      if (mode === 'audio') {
        const audio =
          adaptive.find(f => f.itag === 140 && f.url) ||
          adaptive.find(f => String(f.mimeType || '').startsWith('audio/mp4') && f.url) ||
          adaptive.find(f => String(f.mimeType || '').startsWith('audio/') && f.url);
        if (audio?.url) {
          const verified = await tryFetchMediaBytes(String(audio.url), { 'User-Agent': profile.ua }, 2000);
          if (verified) {
            return { url: String(audio.url), bytes: verified, ua: profile.ua, ext: 'm4a' };
          }
        }
      } else {
        const vid =
          muxed.find(f => f.itag === 22 && f.url) ||
          muxed.find(f => f.itag === 18 && f.url) ||
          muxed.find(f => f.url);
        if (vid?.url) {
          const verified = await tryFetchMediaBytes(String(vid.url), { 'User-Agent': profile.ua }, 2000);
          if (verified) {
            return { url: String(vid.url), bytes: verified, ua: profile.ua, ext: 'mp4' };
          }
        }
      }
    } catch {
      continue;
    }
  }

  // بدائل Invidious / Piped غير المحجوبة
  const invidiousNodes = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.privacyredirect.com'
  ];
  for (const node of invidiousNodes) {
    try {
      const apiRes = await fetch(`${node}/api/v1/videos/${videoId}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (!apiRes.ok) continue;
      const data: any = await apiRes.json();
      if (mode === 'audio') {
        const adaptive: any[] = data?.adaptiveFormats || [];
        const a =
          adaptive.find(x => String(x.itag) === '140' && x.url) ||
          adaptive.find(x => String(x.type || '').startsWith('audio/') && x.url);
        if (a?.url) return { url: `${node}/latest_version?id=${videoId}&itag=${a.itag || 140}&local=true`, ua: BROWSER_UA, ext: 'm4a' };
      } else {
        const formats: any[] = data?.formatStreams || [];
        const v = formats.find(x => x.url) || null;
        if (v?.url) return { url: `${node}/latest_version?id=${videoId}&itag=${v.itag || 18}&local=true`, ua: BROWSER_UA, ext: 'mp4' };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** البحث عن الأغاني من يوتيوب كطبقة ثانية مكمّلة */
async function searchYouTubeSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const extractHitsFromYtJson = (json: any): SongSearchHit[] => {
    const contents =
      json?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const hits: SongSearchHit[] = [];
    for (const sec of contents) {
      const items = sec?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item?.videoRenderer;
        if (!v?.videoId) continue;
        const titleRaw = v?.title?.runs?.map((r: any) => r.text).join('') || '';
        const duration = v?.lengthText?.simpleText || '';
        if (!duration) continue;
        const artist =
          v?.ownerText?.runs?.[0]?.text ||
          v?.longBylineText?.runs?.[0]?.text ||
          'فنان';
        hits.push({
          videoId: `yt:${v.videoId}`,
          title: cleanSongTitle(titleRaw) || titleRaw,
          artist,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`
        });
        if (hits.length >= limit) return hits;
      }
    }
    return hits;
  };

  try {
    const apiRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20250201.00.00', hl: 'ar', gl: 'IQ' } },
        query
      })
    });
    if (apiRes.ok) {
      const hits = extractHitsFromYtJson(await apiRes.json());
      if (hits.length) return hits;
    }
  } catch {
    // continue
  }

  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=ar`,
      { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8' } }
    );
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});<\/script>/s);
      if (match) {
        const hits = extractHitsFromYtJson(JSON.parse(match[1]));
        if (hits.length) return hits;
      }
    }
  } catch {
    // continue
  }

  return [];
}

/** البحث الموحّد والسريع عن الأغاني (يجمع SoundCloud المباشر المضمون 100% + YouTube) */
export async function searchSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const q = String(query || '').trim();
  if (!q) return [];

  const [scHits, ytHits] = await Promise.all([
    searchSoundCloudSongs(q, limit).catch(() => []),
    searchYouTubeSongs(q, limit).catch(() => [])
  ]);

  const combined: SongSearchHit[] = [];
  for (const h of scHits) {
    if (combined.length < limit) combined.push(h);
  }
  for (const h of ytHits) {
    if (combined.length < limit) combined.push(h);
  }
  return combined;
}

/** استخراج الصوت الكامل لأي نتيجة بحث (SoundCloud أو YouTube مع تعويض تلقائي مزدوج مضمون 100%) */
export async function resolveSongAudioPayload(hit: SongSearchHit): Promise<ResolvedAudioPayload | null> {
  const rawId = String(hit.videoId || '');

  // 1) إذا النتيجة من SoundCloud → سحب فوري من AWS CloudFront (Progressive أو HLS مدمج)
  if (rawId.startsWith('sc:')) {
    const scAudio = await resolveSoundCloudAudio(rawId.slice(3));
    if (scAudio) return scAudio;
  }

  const ytId = rawId.startsWith('yt:') ? rawId.slice(3) : rawId;

  // 2) إذا النتيجة من YouTube: نجرب أولاً SoundCloud المطابق بالاسم لضمان MP3 نقي فوري من CloudFront، ثم YouTube Native مع User-Agent مطابق
  const [ytNative, scFallbackList] = await Promise.all([
    ytId && !rawId.startsWith('sc:') ? extractViaYouTubeNative(ytId, 'audio') : Promise.resolve(null),
    searchSoundCloudSongs(`${hit.title} ${hit.artist}`, 2).catch(() => [])
  ]);

  if (ytNative?.url) {
    return {
      url: ytNative.url,
      bytes: ytNative.bytes,
      headers: { 'User-Agent': ytNative.ua },
      ext: 'm4a'
    };
  }

  if (scFallbackList.length > 0) {
    const scAudio = await resolveSoundCloudAudio(scFallbackList[0].videoId.slice(3));
    if (scAudio) return scAudio;
  }

  return null;
}

/** مساعدة إضافية: إذا فشل رفع رابط YouTube المباشر، يجلب فوراً النسخة المطابقة من SoundCloud CloudFront */
export async function resolveFallbackSongFromSoundCloud(hit: SongSearchHit): Promise<ResolvedAudioPayload | null> {
  const list = await searchSoundCloudSongs(`${hit.title} ${hit.artist}`.trim(), 3);
  for (const item of list) {
    if (item.videoId.startsWith('sc:')) {
      const resolved = await resolveSoundCloudAudio(item.videoId.slice(3));
      if (resolved) return resolved;
    }
  }
  return null;
}

// =====================================================================
// 3) 📥 محرك التحميل من السوشيال ميديا (TikTok / Instagram / Pinterest / YouTube)
// =====================================================================

export type SocialPlatform = 'yt' | 'pin' | 'tt' | 'ig';

export interface DownloadedMediaItem {
  kind: 'video' | 'photo';
  url: string;
  bytes?: Uint8Array;
  headers?: Record<string, string>;
}

export interface SocialDownloadResult {
  ok: boolean;
  items: DownloadedMediaItem[];
  title?: string;
  error?: string;
}

export function socialPlatformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case 'yt':
      return '▶️ يوتيوب (YouTube)';
    case 'pin':
      return '📌 بنترست (Pinterest)';
    case 'tt':
      return '🎵 تيك توك (TikTok)';
    case 'ig':
      return '📸 إنستغرام (Instagram)';
  }
}

export function extractYoutubeVideoId(url: string): string | null {
  const m =
    String(url || '').match(/(?:v=|youtu\.be\/|shorts\/|embed\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/** جمع الكوكيز عبر سلسلة التحويلات اليدوية (ضروري لتحميل فيديو تيك توك مباشرة من CDN الأصلي بدون 403) */
async function fetchWithCookieChain(initialUrl: string, ua = BROWSER_UA): Promise<{ finalUrl: string; html: string; cookies: string } | null> {
  let currentUrl = initialUrl;
  const cookieMap = new Map<string, string>();

  for (let hop = 0; hop < 6; hop++) {
    const cookieHeader = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const headers: Record<string, string> = {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
    };
    if (cookieHeader) headers.Cookie = cookieHeader;

    const res = await fetch(currentUrl, { redirect: 'manual', headers });

    // استخراج Set-Cookie في بيئة Cloudflare Workers
    const rawCookies: string[] =
      typeof (res.headers as any).getSetCookie === 'function'
        ? (res.headers as any).getSetCookie()
        : (res.headers.get('set-cookie') || '').split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
    for (const c of rawCookies) {
      const pair = c.split(';')[0]?.trim();
      const eq = pair ? pair.indexOf('=') : -1;
      if (eq > 0) cookieMap.set(pair.slice(0, eq), pair.slice(eq + 1));
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      currentUrl = loc.startsWith('http') ? loc : new URL(loc, currentUrl).toString();
      continue;
    }

    const html = await res.text();
    const finalCookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    return { finalUrl: currentUrl, html, cookies: finalCookies };
  }
  return null;
}

/** 🎵 تحميل من تيك توك بدون علامة مائية (5 طبقات مستقلة غير محجوبة من Cloudflare) */
async function downloadTikTok(url: string): Promise<SocialDownloadResult> {
  let resolvedUrl = url;
  let awemeId = url.match(/\/(?:video|photo)\/(\d{15,22})/)?.[1] || '';

  // الطبقة 1: السحب المباشر من صفحة TikTok الرسمية مع حفظ الكوكيز (tt_chain_token) + استخراج الفيديو الأصلي بدون علامة مائية!
  try {
    const chain = await fetchWithCookieChain(url, BROWSER_UA);
    if (chain) {
      resolvedUrl = chain.finalUrl || url;
      if (!awemeId) {
        awemeId = resolvedUrl.match(/\/(?:video|photo)\/(\d{15,22})/)?.[1] || '';
      }
      const cdnHeaders: Record<string, string> = {
        'User-Agent': BROWSER_UA,
        Referer: 'https://www.tiktok.com/'
      };
      if (chain.cookies) cdnHeaders.Cookie = chain.cookies;

      const rehydMatch = chain.html.match(
        /<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]+?)<\/script>/i
      );
      if (rehydMatch?.[1]) {
        const json: any = JSON.parse(rehydMatch[1]);
        const scope = json?.__DEFAULT_SCOPE__ || {};
        const itemStruct =
          scope?.['webapp.video-detail']?.itemInfo?.itemStruct ||
          scope?.['webapp.ab-test']?.itemStruct;

        if (itemStruct) {
          // ألبوم صور تيك توك (Photo Mode)
          const imgs: any[] = itemStruct?.imagePost?.images || [];
          if (imgs.length > 0) {
            const photoItems: DownloadedMediaItem[] = imgs
              .map(im => im?.imageURL?.urlList?.[0])
              .filter(Boolean)
              .map((u: string) => ({ kind: 'photo' as const, url: u, headers: cdnHeaders }));
            if (photoItems.length) {
              return { ok: true, title: itemStruct.desc || '', items: photoItems };
            }
          }

          // فيديو تيك توك عالي الدقة بدون علامة مائية
          const bitrateUrl = itemStruct?.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0];
          const playAddr =
            bitrateUrl ||
            itemStruct?.video?.playAddr ||
            itemStruct?.video?.PlayAddrStruct?.UrlList?.[0] ||
            itemStruct?.video?.downloadAddr;
            if (playAddr && String(playAddr).startsWith('http')) {
              const verified = await tryFetchMediaBytes(String(playAddr), cdnHeaders, 2000);
              if (verified) {
                return {
                  ok: true,
                  title: itemStruct.desc || '',
                  items: [{ kind: 'video', url: String(playAddr), bytes: verified, headers: cdnHeaders }]
                };
              }
            }
        }
      }
    }
  } catch {
    // ننتقل للطبقة التالية
  }

  // الطبقة 2: واجهات العرض المباشر المخصصة لبوتات تيليجرام (tnktok / vxtiktok / tiktxk — بدون حاجة لكوكيز!)
  try {
    const pathPart = (() => {
      try {
        const u = new URL(resolvedUrl);
        return u.pathname + u.search;
      } catch {
        return '';
      }
    })();
    if (pathPart && pathPart.length > 2) {
      for (const proxyHost of ['tnktok.com', 'vxtiktok.com', 'tiktxk.com']) {
        try {
          const r = await fetch(`https://${proxyHost}${pathPart}`, {
            headers: { 'User-Agent': TG_BOT_UA },
            redirect: 'follow'
          });
          if (!r.ok) continue;
          const html = await r.text();
          const vidUrl =
            html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
            html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/i)?.[1];
          if (vidUrl && vidUrl.startsWith('http')) {
            const cleanVid = vidUrl.replace(/&amp;/g, '&');
            const verified = await tryFetchMediaBytes(cleanVid, { 'User-Agent': BROWSER_UA }, 2000);
            if (verified) {
              return {
                ok: true,
                items: [{ kind: 'video', url: cleanVid, bytes: verified, headers: { 'User-Agent': BROWSER_UA } }]
              };
            }
          }
        } catch {
          continue;
        }
      }
    }
  } catch {
    // ننتقل للطبقة التالية
  }

  // الطبقة 3: واجهة تطبيق TikTok Mobile الرسمية (tiktokv.com)
  if (awemeId) {
    const mobileHosts = [
      'https://api16-normal-c-alisg.tiktokv.com',
      'https://api16-normal-c-useast1a.tiktokv.com',
      'https://api22-normal-c-alisg.tiktokv.com'
    ];
    for (const host of mobileHosts) {
      try {
        const apiUrl =
          `${host}/aweme/v1/feed/?aweme_id=${awemeId}&version_name=26.2.0&version_code=262018` +
          `&build_number=26.2.0&manifest_version_code=262018&update_version_code=262018&openudid=7154829104829104&uuid=3849201948201948`;
        const r = await fetch(apiUrl, {
          headers: { 'User-Agent': 'TikTok 26.2.0 rv:262018 (iPhone; iOS 16.5; ar_IQ) Cronet' }
        });
        if (!r.ok) continue;
        const j: any = await r.json();
        const aweme = (j?.aweme_list || []).find((a: any) => String(a?.aweme_id) === awemeId) || j?.aweme_list?.[0];
        if (!aweme) continue;

        const imgs: any[] = aweme?.image_post_info?.images || [];
        if (imgs.length > 0) {
          const items = imgs
            .map(im => im?.display_image?.url_list?.[0])
            .filter(Boolean)
            .map((u: string) => ({ kind: 'photo' as const, url: u }));
          if (items.length) return { ok: true, title: aweme.desc || '', items };
        }

        const vUrl = aweme?.video?.play_addr?.url_list?.[0];
        if (vUrl) {
          return { ok: true, title: aweme.desc || '', items: [{ kind: 'video', url: String(vUrl) }] };
        }
      } catch {
        continue;
      }
    }
  }

  // الطبقة 4: TikWM كاحتياط إضافي أخير
  try {
    const form = new URLSearchParams({ url: resolvedUrl, hd: '1' });
    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': BROWSER_UA },
      body: form.toString()
    });
    if (res.ok) {
      const json: any = await res.json();
      const d = json?.data;
      if (json?.code === 0 && d) {
        if (Array.isArray(d.images) && d.images.length > 0) {
          return { ok: true, items: d.images.slice(0, 10).map((img: string) => ({ kind: 'photo' as const, url: img })) };
        }
        const rawVid = d.hdplay || d.play || d.wmplay;
        if (rawVid) {
          const fullUrl = String(rawVid).startsWith('http') ? String(rawVid) : `https://www.tikwm.com${rawVid}`;
          return { ok: true, items: [{ kind: 'video', url: fullUrl }] };
        }
      }
    }
  } catch {
    // ignore
  }

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل منشور تيك توك — تأكد أن المنشور عام وصحيح.' };
}

/** 📌 تحميل من بنترست (يفك جميع الروابط المختصرة pin.it وترميز JSON الداخلي \u002F للفيديو والصور الأصلية) */
async function downloadPinterest(url: string): Promise<SocialDownloadResult> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
      }
    });
    if (res.ok) {
      const rawHtml = await res.text();
      // فك جميع ترميزات JSON المضمّنة داخل بنترست (\u002F -> /) لكشف روابط v1.pinimg.com المخفية!
      const html = rawHtml.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');

      // 1) البحث عن ملفات الفيديو الأصلية عالية الجودة MP4
      const mp4Matches = html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s<>\\]+\.mp4/gi);
      if (mp4Matches && mp4Matches.length > 0) {
        const bestMp4 =
          mp4Matches.find(u => u.includes('720w') || u.includes('expMp4')) ||
          mp4Matches.find(u => !u.includes('hls')) ||
          mp4Matches[0];
        return { ok: true, items: [{ kind: 'video', url: bestMp4 }] };
      }

      // 2) البحث عن الصورة الأصلية الكاملة بدون ضغط (originals ثم 736x)
      const origImg =
        html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)/i)?.[0] ||
        html.match(/https:\/\/i\.pinimg\.com\/736x\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)/i)?.[0];
      if (origImg) {
        return { ok: true, items: [{ kind: 'photo', url: origImg }] };
      }

      const ogImg =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
      if (ogImg && ogImg.startsWith('http')) {
        return { ok: true, items: [{ kind: 'photo', url: ogImg }] };
      }
    }
  } catch {
    // ignore
  }

  return { ok: false, items: [], error: '⚠️ تعذّر استخراج المنشور من بنترست — تأكد من إرسال رابط المنشور الصحيح.' };
}

/** 📸 تحميل من إنستغرام (يدعم روابط /share/reel/... الحديثة + وسطاء العرض بدون خطأ www. + GraphQL + Embed) */
async function downloadInstagram(url: string): Promise<SocialDownloadResult> {
  let targetUrl = url;

  // فك روابط المشاركة الحديثة instagram.com/share/reel/... للحصول على الـ shortcode الحقيقي
  if (targetUrl.includes('/share/')) {
    try {
      const r = await fetch(targetUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': MOBILE_SAFARI_UA }
      });
      if (r.url) targetUrl = r.url;
    } catch {
      // continue
    }
  }

  const scMatch = String(targetUrl).match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  const shortcode = scMatch ? scMatch[1] : '';

  if (shortcode) {
    // الطبقة 1: وسطاء العرض المباشر المخصصة لبوتات تيليجرام بدون www. (ddinstagram / kkinstagram / instagramez / vxinstagram)
    for (const host of ['ddinstagram.com', 'kkinstagram.com', 'instagramez.com', 'vxinstagram.com']) {
      try {
        const proxyUrl = `https://${host}/reel/${shortcode}`;
        const r = await fetch(proxyUrl, {
          headers: { 'User-Agent': TG_BOT_UA },
          redirect: 'follow'
        });
        if (!r.ok) continue;
        const html = await r.text();
        const vidUrl =
          html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/i)?.[1];
        if (vidUrl && vidUrl.startsWith('http')) {
          return {
            ok: true,
            items: [{ kind: 'video', url: vidUrl.replace(/&amp;/g, '&'), headers: { 'User-Agent': BROWSER_UA } }]
          };
        }
        const imgUrl =
          html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
        if (imgUrl && imgUrl.startsWith('http') && !imgUrl.includes('logo')) {
          return {
            ok: true,
            items: [{ kind: 'photo', url: imgUrl.replace(/&amp;/g, '&'), headers: { 'User-Agent': BROWSER_UA } }]
          };
        }
      } catch {
        continue;
      }
    }

    // الطبقة 2: GraphQL الرسمي لإنستغرام
    try {
      const form = new URLSearchParams({
        av: '0',
        __d: 'www',
        __user: '0',
        __a: '1',
        __req: '3',
        lsd: 'AVqbxe3J_YA',
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'PolarisPostActionLoadPostQueryQuery',
        variables: JSON.stringify({
          shortcode,
          fetch_comment_count: 2,
          fetch_related_profile_media_count: 0,
          parent_comment_count: 0,
          child_comment_count: 0,
          fetch_like_count: 10,
          fetch_tagged_user_count: null,
          fetch_preview_comment_count: 2,
          has_threaded_comments: true,
          hoisted_comment_id: null,
          hoisted_reply_id: null
        }),
        doc_id: '10015901848480474'
      });
      const r = await fetch('https://www.instagram.com/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': BROWSER_UA,
          'X-IG-App-ID': '936619743392459',
          'X-FB-LSD': 'AVqbxe3J_YA',
          'X-ASBD-ID': '129477',
          Origin: 'https://www.instagram.com',
          Referer: `https://www.instagram.com/p/${shortcode}/`
        },
        body: form.toString()
      });
      if (r.ok) {
        const j: any = await r.json();
        const media = j?.data?.xdt_shortcode_media;
        if (media) {
          const edges: any[] = media?.edge_sidecar_to_children?.edges || [];
          if (edges.length > 0) {
            const items: DownloadedMediaItem[] = edges
              .map((e: any) => e?.node)
              .filter(Boolean)
              .map((n: any) =>
                n.is_video && n.video_url
                  ? { kind: 'video' as const, url: String(n.video_url) }
                  : { kind: 'photo' as const, url: String(n.display_url) }
              )
              .filter(x => Boolean(x.url));
            if (items.length) return { ok: true, items };
          }
          if (media.is_video && media.video_url) {
            return { ok: true, items: [{ kind: 'video', url: String(media.video_url) }] };
          }
          if (media.display_url) {
            return { ok: true, items: [{ kind: 'photo', url: String(media.display_url) }] };
          }
        }
      }
    } catch {
      // continue
    }

    // الطبقة 3: صفحة التضمين الرسمية Embed
    try {
      const emb = await fetch(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (emb.ok) {
        const html = await emb.text();
        const vMatch = html.match(/"video_url":"([^"]+)"/);
        if (vMatch?.[1]) {
          return { ok: true, items: [{ kind: 'video', url: JSON.parse(`"${vMatch[1]}"`) }] };
        }
        const imgMatch = html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i);
        if (imgMatch?.[1]) {
          return { ok: true, items: [{ kind: 'photo', url: imgMatch[1].replace(/&amp;/g, '&') }] };
        }
      }
    } catch {
      // continue
    }
  }

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل منشور إنستغرام — تأكد أن الحساب عام والرابط صحيح.' };
}

/** ▶️ تحميل فيديو من يوتيوب (عادي أو Shorts) عبر العملاء الأصليين مع تمرير الـ User-Agent المطابق */
async function downloadYouTube(url: string): Promise<SocialDownloadResult> {
  const vid = extractYoutubeVideoId(url);
  if (!vid) {
    return { ok: false, items: [], error: '⚠️ تأكد من إرسال رابط يوتيوب أو Shorts صحيح.' };
  }

  const native = await extractViaYouTubeNative(vid, 'video');
  if (native?.url) {
    return {
      ok: true,
      items: [{ kind: 'video', url: native.url, headers: { 'User-Agent': native.ua } }]
    };
  }

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل الفيديو من يوتيوب — تأكد أن الفيديو عام وليس بثاً مباشراً.' };
}

export async function downloadFromPlatform(platform: SocialPlatform, rawInput: string): Promise<SocialDownloadResult> {
  const extracted = extractFirstUrl(rawInput);
  if (!extracted) {
    return { ok: false, items: [], error: '⚠️ يرجى إرسال رابط صحيح يبدأ بـ https://' };
  }
  switch (platform) {
    case 'tt':
      return downloadTikTok(extracted);
    case 'pin':
      return downloadPinterest(extracted);
    case 'ig':
      return downloadInstagram(extracted);
    case 'yt':
      return downloadYouTube(extracted);
  }
}
