/**
 * ✨ محرك الخدمات الإضافية المتكامل (متوافق 100% مع Cloudflare Workers بدون حظر IP):
 *   1) 🤫 الهمسات السرية (1..5 أشخاص، للجميع، لأول شخص فقط + إظهار العدد فقط للعامة وإرسال بيانات القارئ لصاحب الهمسة بالخاص)
 *   2) 🎵 البحث وتحميل الأغاني الكاملة («يوت») عبر SoundCloud AWS CloudFront المباشر + YouTube Innertube المحدّث
 *   3) 📥 التحميل المباشر من السوشيال ميديا (تيك توك، إنستغرام، بنترست، يوتيوب) بدون وسطاء محجوبين
 */

import {
  boundedFetch,
  withTimeout,
  raceProviders,
  providerHealth,
  summarizeFailures,
  MEDIA_STEP_TIMEOUT_MS,
  MEDIA_TOTAL_BUDGET_MS,
  MEDIA_PROBE_TIMEOUT_MS,
  MEDIA_STREAM_TIMEOUT_MS,
  MEDIA_ENGINE_BUILD,
  MEDIA_CACHE_TTL_MS,
  cacheClear,
  cacheDelete,
  cacheGet,
  cacheSet,
  traceReset,
  traceSnapshot,
  type TraceEntry,
  type ProviderAttempt
} from './mediaResilience';

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
  /** Optional destination metadata when a channel admin composes a whisper in private chat. */
  channelId?: string;
  channelTitle?: string;
  triggerMessageId?: number;
  launcherMessageId?: number;
}

export function whisperModeLabel(mode: WhisperMode): string {
  switch (mode) {
    case '1':
      return 'لشخص واحد';
    case '2':
      return 'لشخصين';
    case '3':
      return 'لـ 3 أشخاص';
    case '4':
      return 'لـ 4 أشخاص';
    case '5':
      return 'لـ 5 أشخاص';
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

/**
 * بطاقة همسة عامة بلا أسماء؛ بيانات القارئ تُرسل لصاحب الهمسة بالخاص فقط.
 */
export function renderWhisperCardText(wh: WhisperRecord): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const readersBlock = wh.openedBy.length > 0 ? `\n👀 *عدد القارئين:* ${wh.openedBy.length}` : '';

  if (wh.locked) {
    return (
      `🔒 *همسة مغلقة*\n` +
      `${SEP}\n` +
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
    `${readersBlock}\n` +
    `🔐 *النوع:* ${mdV2Escape(whisperModeLabel(wh.mode))}${targetLine}\n` +
    `👇 اضغط الزر بالأسفل لقراءة الهمسة سرّاً`
  );
}

/** زر الهمسة لا يكشف أسماء المرسل أو القارئ داخل المجموعة/القناة. */
export function whisperCardKeyboard(wh: WhisperRecord): any[][] {
  if (wh.locked) {
    return [[{ text: `🔒 همسة مغلقة • 👀 ${wh.openedBy.length}`, callback_data: `wh:open:${wh.id}` }]];
  }
  if (wh.openedBy.length > 0) {
    return [[{ text: `🤫 فتح الهمسة • 👀 ${wh.openedBy.length}`, callback_data: `wh:open:${wh.id}` }]];
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
interface ProbedMediaResult {
  directUrl: string;
  bytes?: Uint8Array;
  oversized: boolean;
  sizeMB?: number;
}

/**
 * فحص ذكي وآمن للذاكرة (لا يتجاوز سقف ذاكرة Cloudflare البالغ 128MB أبداً مهما بلغ حجم الفيديو 500MB أو 2GB!):
 * - إذا كان الملف <= 49MB يسحب بايتاته كاملة ليرفعها مباشرة داخل محادثة تيليجرام.
 * - إذا تجاوز 49MB يتحقق من أول حزمة ثنائية حقيقية ثم يغلق الدفق فوراً خلال جزء من الثانية ويعيد الرابط المباشر السحابي الكامل!
 */
async function probeMediaStreamOrBytes(
  url: string,
  headers?: Record<string, string>,
  minBytes = 1500
): Promise<ProbedMediaResult | null> {
  const MAX_TG_BYTES = 49 * 1024 * 1024;
  try {
    // A 20MB video is not a JSON call: give the bytes their own deadline, or a
    // perfectly healthy CDN looks "dead" just because it is slow.
    const r = await boundedFetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        ...(headers || {})
      }
    }, MEDIA_STREAM_TIMEOUT_MS);
    if (!r.ok) {
      await r.body?.cancel().catch(() => undefined);
      return null;
    }
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/json')) {
      await r.body?.cancel().catch(() => undefined);
      return null;
    }

    const finalUrl = r.url || url;
    const declaredLen = parseInt(r.headers.get('content-length') || '0', 10);

    // إذا أعلن الخادم مسبقاً أن الحجم أكبر من 49MB: نفحص أول بايتات فقط ثم نغلق الاتصال فوراً دون استهلاك الذاكرة!
    if (declaredLen > MAX_TG_BYTES && r.body) {
      const reader = r.body.getReader();
      const first = await reader.read();
      await reader.cancel().catch(() => undefined);
      const sample = first.value;
      if (!sample || sample.byteLength < 64) return null;
      if (sample[0] === 0x3c && (sample[1] === 0x21 || sample[1] === 0x68 || sample[1] === 0x48)) return null;
      return {
        directUrl: finalUrl,
        oversized: true,
        sizeMB: Math.round((declaredLen / (1024 * 1024)) * 10) / 10
      };
    }

    if (!r.body) {
      const buf = new Uint8Array(await r.arrayBuffer());
      if (buf.byteLength < minBytes) return null;
      if (buf[0] === 0x3c && (buf[1] === 0x21 || buf[1] === 0x68 || buf[1] === 0x48)) return null;
      if (buf.byteLength > MAX_TG_BYTES) {
        return {
          directUrl: finalUrl,
          oversized: true,
          sizeMB: Math.round((buf.byteLength / (1024 * 1024)) * 10) / 10
        };
      }
      return { directUrl: finalUrl, bytes: buf, oversized: false };
    }

    // قراءة تدريجية محمية السقف حتى في حال عدم إرسال Content-Length
    const reader = r.body.getReader();
    const parts: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        if (total === 0 && value[0] === 0x3c && (value[1] === 0x21 || value[1] === 0x68 || value[1] === 0x48)) {
          await reader.cancel().catch(() => undefined);
          return null;
        }
        total += value.byteLength;
        if (total > MAX_TG_BYTES) {
          await reader.cancel().catch(() => undefined);
          parts.length = 0;
          return {
            directUrl: finalUrl,
            oversized: true,
            sizeMB: declaredLen > 0 ? Math.round((declaredLen / (1024 * 1024)) * 10) / 10 : undefined
          };
        }
        parts.push(value);
      }
    }

    if (total < minBytes) return null;
    const merged = concatUint8Arrays(parts);
    parts.length = 0;
    return { directUrl: finalUrl, bytes: merged, oversized: false };
  } catch {
    return null;
  }
}

async function tryFetchMediaBytes(
  url: string,
  headers?: Record<string, string>,
  minBytes = 1500
): Promise<Uint8Array | null> {
  const res = await probeMediaStreamOrBytes(url, headers, minBytes);
  return res?.bytes || null;
}

// =====================================================================
// 2) 🎵 البحث عن الأغاني («يوت») وسحب الصوت الكامل (SoundCloud CDN + YouTube Innertube)
// =====================================================================

export interface SongSearchHit {
  /** sc:<trackId> أو sv:<url> أو ht:<url> أو yt:<videoId> */
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  directAudioUrl?: string;
  directExt?: 'mp3' | 'm4a';
}

export interface ResolvedAudioPayload {
  url?: string;
  bytes?: Uint8Array;
  headers?: Record<string, string>;
  ext: 'mp3' | 'm4a';
}

let cachedScClientId: { id: string; exp: number } | null = null;
let cachedVisitorData: { id: string; exp: number } | null = null;

/** استخراج client_id حي وتلقائي من مشغّل SoundCloud المدمج العام (w.soundcloud.com/player بدون أي حظر WAF على Cloudflare Workers!) + النسخة المحمولة والويب */
async function getSoundCloudClientId(): Promise<string | null> {
  if (cachedScClientId && cachedScClientId.exp > Date.now()) {
    return cachedScClientId.id;
  }

  const probeClientId = async (cid: string): Promise<boolean> => {
    try {
      const r = await boundedFetch(`https://api-v2.soundcloud.com/tracks/293?client_id=${encodeURIComponent(cid)}`, {
        headers: {
          'User-Agent': BROWSER_UA,
          Origin: 'https://w.soundcloud.com',
          Referer: 'https://w.soundcloud.com/'
        }
      });
      return r.ok;
    } catch {
      return false;
    }
  };

  // 1) المصدر الذهبي الأول: مشغّل الـ Widget العام (widget.sndcdn.com) — مفتوح عالمياً من كل السيرفرات وCloudflare بدون أي WAF!
  const pageTargets = [
    'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F293',
    'https://m.soundcloud.com',
    'https://soundcloud.com'
  ];

  for (const pageUrl of pageTargets) {
    try {
      const resp = await boundedFetch(pageUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
        }
      });
      if (!resp.ok) continue;
      const html = await resp.text();

      // قد يوجد client_id مباشرة داخل HTML المشغّل المدمج!
      const inlineMatch =
        html.match(/["']client_id["']\s*:\s*["']([a-zA-Z0-9_-]{20,64})["']/) ||
        html.match(/client_id\s*:\s*["']([a-zA-Z0-9_-]{20,64})["']/) ||
        html.match(/client_id=([a-zA-Z0-9_-]{20,64})/);
      if (inlineMatch?.[1] && (await probeClientId(inlineMatch[1]))) {
        cachedScClientId = { id: inlineMatch[1], exp: Date.now() + 6 * 3600_000 };
        return inlineMatch[1];
      }

      const scripts =
        html.match(/https:\/\/(?:widget|a-v2|m)\.sndcdn\.com\/[^\s"'<>]+\.js/g) || [];
      for (const scriptUrl of scripts.slice(-8).reverse()) {
        try {
          const sResp = await boundedFetch(scriptUrl, { headers: { 'User-Agent': BROWSER_UA } });
          if (!sResp.ok) continue;
          const js = await sResp.text();
          const candidates = Array.from(
            js.matchAll(/(?:["']?client_id["']?\s*[:=]\s*["']?)([a-zA-Z0-9_-]{24,48})/g)
          ).map(m => m[1]);
          for (const cid of candidates.slice(0, 4)) {
            if (await probeClientId(cid)) {
              cachedScClientId = { id: cid, exp: Date.now() + 6 * 3600_000 };
              return cid;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
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
    const res = await boundedFetch(url, {
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
    const infoRes = await boundedFetch(
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

    // 1) الأولوية للرابط المباشر Progressive MP3 مع فحص البايتات الفعلي بالذاكرة
    const progMp3 =
      transcodings.find(
        t => t?.format?.protocol === 'progressive' && String(t?.format?.mime_type || '').includes('mpeg')
      ) || transcodings.find(t => t?.format?.protocol === 'progressive');

    if (progMp3?.url) {
      const sRes = await boundedFetch(
        `${progMp3.url}${progMp3.url.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(clientId)}`,
        { headers: { 'User-Agent': BROWSER_UA } }
      );
      if (sRes.ok) {
        const sj: any = await sRes.json();
        if (sj?.url) {
          const verifiedProg = await tryFetchMediaBytes(String(sj.url), { 'User-Agent': BROWSER_UA }, 20_000);
          if (verifiedProg) {
            return { bytes: verifiedProg, url: String(sj.url), ext: 'mp3', headers: { 'User-Agent': BROWSER_UA } };
          }
        }
      }
    }

    // 2) إذا كانت الأغنية بصيغة HLS (.m3u8) نسحب ترويسة #EXT-X-MAP (إن وجدت لملفات fMP4/AAC) + الشرائح بالتوازي من CloudFront!
    const hlsCandidates = [
      ...transcodings.filter(
        t => t?.format?.protocol === 'hls' && String(t?.format?.mime_type || '').includes('mpeg')
      ),
      ...transcodings.filter(
        t => t?.format?.protocol === 'hls' && String(t?.format?.mime_type || '').includes('mp4')
      ),
      ...transcodings.filter(
        t => t?.format?.protocol === 'hls' && !String(t?.format?.mime_type || '').includes('ogg')
      )
    ];

    for (const hlsEntry of hlsCandidates) {
      if (!hlsEntry?.url) continue;
      const mimeStr = String(hlsEntry?.format?.mime_type || '').toLowerCase();
      const sRes = await boundedFetch(
        `${hlsEntry.url}${hlsEntry.url.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(clientId)}`,
        { headers: { 'User-Agent': BROWSER_UA } }
      );
      if (!sRes.ok) continue;
      const sj: any = await sRes.json();
      if (!sj?.url) continue;

      const m3uRes = await boundedFetch(String(sj.url), { headers: { 'User-Agent': BROWSER_UA } });
      if (!m3uRes.ok) continue;
      const m3uText = await m3uRes.text();

      // مهم جداً: التقاط مقطع التهيئة #EXT-X-MAP:URI="..." حتى لا يرفض تيليجرام ملفات fMP4/M4A الحديثة!
      const mapMatch = m3uText.match(/#EXT-X-MAP:URI="([^"]+)"/);
      const initUrl = mapMatch?.[1]
        ? mapMatch[1].startsWith('http')
          ? mapMatch[1]
          : new URL(mapMatch[1], String(sj.url)).toString()
        : null;

      const mediaSegs = m3uText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => (l.startsWith('http') ? l : new URL(l, String(sj.url)).toString()));

      if (mediaSegs.length > 0) {
        const allUrls = initUrl ? [initUrl, ...mediaSegs.slice(0, 38)] : mediaSegs.slice(0, 39);
        const chunks: Uint8Array[] = [];
        const batchSize = 10;
        for (let i = 0; i < allUrls.length; i += batchSize) {
          const batch = allUrls.slice(i, i + batchSize);
          const buffers = await Promise.all(
            batch.map(async u => {
              const r = await boundedFetch(u, { headers: { 'User-Agent': BROWSER_UA } });
              if (!r.ok) throw new Error('seg_failed');
              return new Uint8Array(await r.arrayBuffer());
            })
          );
          chunks.push(...buffers);
        }
        const merged = concatUint8Arrays(chunks);
        if (merged.byteLength > 20_000) {
          const ext: 'mp3' | 'm4a' = initUrl || mimeStr.includes('mp4') ? 'm4a' : 'mp3';
          return { bytes: merged, ext };
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
    const res = await boundedFetch('https://www.youtube.com/sw.js_data', {
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

export function parseDurationSeconds(dur?: string): number {
  const parts = String(dur || '')
    .trim()
    .split(':')
    .map(p => parseInt(p, 10));
  if (parts.some(n => !Number.isFinite(n))) return 210;
  if (parts.length === 3) return Math.max(15, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.max(15, parts[0] * 60 + parts[1]);
  if (parts.length === 1 && parts[0] > 0) return Math.max(15, parts[0]);
  return 210;
}

interface CloudExtractResult {
  url: string;
  bytes?: Uint8Array;
  oversized?: boolean;
  sizeMB?: number;
  quality?: string;
  title?: string;
  ext: 'mp4' | 'm4a';
}

/** فك تشفير استجابة Savetube السحابية (AES-128-CBC عبر WebCrypto المدمج في Cloudflare Workers) وسحب ملف MP4/MP3 العام حتى لو تجاوز 50MB! */
async function extractViaSavetubeCloud(
  videoId: string,
  mode: 'video' | 'audio',
  customQualities?: string[]
): Promise<CloudExtractResult | null> {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const keyHex = 'C5D58EF67A7584E4A29F6C35BBC4EB12';
  const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));

  const cdns: string[] = [];
  try {
    const cdnRes = await boundedFetch('https://media.savetube.me/api/random-cdn', {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
    });
    if (cdnRes.ok) {
      const cj: any = await cdnRes.json();
      if (cj?.cdn) cdns.push(String(cj.cdn));
    }
  } catch {
    // fallback cdns below
  }
  for (const fallbackCdn of ['cdn59.savetube.su', 'cdn54.savetube.su', 'cdn61.savetube.su']) {
    if (!cdns.includes(fallbackCdn)) cdns.push(fallbackCdn);
  }

  let bestOversized: CloudExtractResult | null = null;

  for (const cdn of cdns.slice(0, 3)) {
    try {
      const infoRes = await boundedFetch(`https://${cdn}/v2/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
          Origin: 'https://yt.savetube.me',
          Referer: 'https://yt.savetube.me/'
        },
        body: JSON.stringify({ url: ytUrl })
      });
      if (!infoRes.ok) continue;
      const infoJson: any = await infoRes.json();
      const b64 = String(infoJson?.data || '').replace(/\s+/g, '');
      if (!b64) continue;

      const rawBin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      if (rawBin.byteLength <= 16) continue;
      const iv = rawBin.slice(0, 16);
      const encrypted = rawBin.slice(16);

      const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, encrypted);
      const parsed: any = JSON.parse(new TextDecoder().decode(plainBuf));
      const dlKey = parsed?.key;
      if (!dlKey) continue;

      // ترتيب تنازلي ذكي: إذا كانت 360p أكبر من 49MB نحفظ رابطها المباشر الكامل ونفحص 240p ثم 144p لرفع نسخة تعمل داخل تيليجرام أيضاً!
      const qualities = customQualities || (mode === 'audio' ? ['128'] : ['360', '240', '144']);
      for (const q of qualities) {
        const dlRes = await boundedFetch(`https://${cdn}/download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': BROWSER_UA,
            Origin: 'https://yt.savetube.me',
            Referer: 'https://yt.savetube.me/'
          },
          body: JSON.stringify({
            downloadType: mode === 'audio' ? 'audio' : 'video',
            quality: q,
            key: dlKey
          })
        });
        if (!dlRes.ok) continue;
        const dlJson: any = await dlRes.json();
        const fileUrl = dlJson?.data?.downloadUrl;
        if (fileUrl && String(fileUrl).startsWith('http')) {
          const probed = await probeMediaStreamOrBytes(String(fileUrl), { 'User-Agent': BROWSER_UA }, 8_000);
          if (probed?.bytes) {
            return {
              url: probed.directUrl,
              bytes: probed.bytes,
              quality: q,
              title: parsed?.title ? String(parsed.title) : undefined,
              ext: mode === 'audio' ? 'm4a' : 'mp4'
            };
          }
          if (probed?.oversized && !bestOversized) {
            bestOversized = {
              url: probed.directUrl,
              oversized: true,
              sizeMB: probed.sizeMB,
              quality: q,
              title: parsed?.title ? String(parsed.title) : undefined,
              ext: mode === 'audio' ? 'm4a' : 'mp4'
            };
          }
        }
      }
      if (bestOversized) return bestOversized;
    } catch {
      continue;
    }
  }
  return bestOversized;
}

/** سحب الفيديو/الصوت عبر خادم OceanSaver السحابي (يعمل من أي IP على Cloudflare Workers ويدعم حتى الأحجام الأكبر من 50MB!) */
async function extractViaOceanSaverCloud(
  videoId: string,
  mode: 'video' | 'audio',
  preferredFormat?: string
): Promise<CloudExtractResult | null> {
  try {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const fmt = preferredFormat || (mode === 'audio' ? 'm4a' : '360');
    const startUrl =
      `https://p.oceansaver.in/ajax/download.php?copyright=0&format=${fmt}` +
      `&url=${encodeURIComponent(ytUrl)}&api=dfcb6d76f2f6a9894gjkege8a4ab232222`;
    const r = await boundedFetch(startUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
        Referer: 'https://y2down.cc/'
      }
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const jobId = j?.id;
    if (!jobId) return null;

    for (let poll = 0; poll < 9; poll++) {
      await new Promise(res => setTimeout(res, poll === 0 ? 500 : 900));
      const pr = await boundedFetch(`https://p.oceansaver.in/ajax/progress.php?id=${encodeURIComponent(String(jobId))}`, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
      });
      if (!pr.ok) continue;
      const pj: any = await pr.json();
      if (pj?.download_url && String(pj.download_url).startsWith('http')) {
        const probed = await probeMediaStreamOrBytes(String(pj.download_url), { 'User-Agent': BROWSER_UA }, 8_000);
        if (probed?.bytes) {
          return {
            url: probed.directUrl,
            bytes: probed.bytes,
            quality: fmt,
            title: j?.title ? String(j.title) : undefined,
            ext: mode === 'audio' ? 'm4a' : 'mp4'
          };
        }
        if (probed?.oversized) {
          return {
            url: probed.directUrl,
            oversized: true,
            sizeMB: probed.sizeMB,
            quality: fmt,
            title: j?.title ? String(j.title) : undefined,
            ext: mode === 'audio' ? 'm4a' : 'mp4'
          };
        }
        break;
      }
      if (pj?.success === 0 && Number(pj?.progress || 0) >= 1000) break;
    }
  } catch {
    return null;
  }
  return null;
}

interface YTClientProfile {
  name: string;
  version: string;
  ua: string;
  extraContext?: Record<string, any>;
}

const YT_NATIVE_CLIENTS: YTClientProfile[] = [
  {
    name: 'ANDROID_TESTSUITE',
    version: '1.9',
    ua: 'com.google.android.youtube/1.9 (Linux; U; Android 12; US) gzip',
    extraContext: { androidSdkVersion: 31, osName: 'Android', osVersion: '12' }
  },
  {
    name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    version: '2.0',
    ua: 'Mozilla/5.0 (PlayStation; PlayStation 4/11.52) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
    extraContext: {}
  },
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

/** Pulls one embedded `ytInitialPlayerResponse` object out of a YouTube page. */
function extractPlayerResponseFromHtml(html: string): any | null {
  const marker = html.indexOf('ytInitialPlayerResponse');
  if (marker < 0) return null;
  const braceStart = html.indexOf('{', marker);
  if (braceStart < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = braceStart; i < html.length && i < braceStart + 4_000_000; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(braceStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Last-resort YouTube path that does not need any third party: the public embed
 * page embeds the same player response the API returns. Datacenter IPs often get
 * a bot check here too, but when it works it is the fastest source available.
 */
async function extractViaYouTubeEmbedPage(
  videoId: string,
  mode: 'audio' | 'video'
): Promise<{ url: string; bytes?: Uint8Array; ua: string; ext: 'm4a' | 'mp4' } | null> {
  for (const pageUrl of [`https://www.youtube.com/embed/${videoId}`, `https://www.youtube.com/watch?v=${videoId}`]) {
    try {
      const res = await boundedFetch(pageUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
        }
      });
      if (!res.ok) continue;
      const html = await res.text();
      const player = extractPlayerResponseFromHtml(html);
      if (!player) continue;
      if (String(player?.playabilityStatus?.status || '') !== 'OK') continue;
      const muxed: any[] = player?.streamingData?.formats || [];
      const adaptive: any[] = player?.streamingData?.adaptiveFormats || [];
      const candidates =
        mode === 'audio'
          ? adaptive.filter(f => String(f.mimeType || '').startsWith('audio/') && f.url)
          : [...muxed.filter(f => f.itag === 18 && f.url), ...muxed.filter(f => f.url)];
      for (const format of candidates.slice(0, 3)) {
        const verified = await tryFetchMediaBytes(String(format.url), { 'User-Agent': BROWSER_UA }, 10_000);
        if (verified) {
          return { url: String(format.url), bytes: verified, ua: BROWSER_UA, ext: mode === 'audio' ? 'm4a' : 'mp4' };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

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

      const contextBody: Record<string, any> = { client: clientObj };
      if (profile.name === 'TVHTML5_SIMPLY_EMBEDDED_PLAYER') {
        contextBody.thirdParty = { embedUrl: 'https://www.youtube.com/' };
      }

      const clientIdHeader =
        profile.name === 'ANDROID_TESTSUITE'
          ? '30'
          : profile.name === 'IOS'
            ? '5'
            : profile.name === 'ANDROID_VR'
              ? '28'
              : profile.name === 'TVHTML5_SIMPLY_EMBEDDED_PLAYER'
                ? '85'
                : '101';

      const playerRes = await boundedFetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': profile.ua,
          'X-YouTube-Client-Name': clientIdHeader,
          'X-YouTube-Client-Version': profile.version
        },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: contextBody
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
        // نرتّب الجودات المدمجة (صوت + صورة بملف MP4 واحد تحت سقف تيليجرام 50MB): itag 18 (360p مضمون دائماً بالحجم) ثم 22 (720p)
        const candidates = [
          ...muxed.filter(f => f.itag === 18 && f.url),
          ...muxed.filter(f => f.itag === 22 && f.url),
          ...muxed.filter(f => f.url)
        ];
        for (const vid of candidates) {
          const verified = await tryFetchMediaBytes(String(vid.url), { 'User-Agent': profile.ua }, 10_000);
          if (verified) {
            return { url: String(vid.url), bytes: verified, ua: profile.ua, ext: 'mp4' };
          }
        }

        // دعم إضافي لـ HLS المدمج (IOS hlsManifestUrl بدون أي حاجة لـ poToken!) للمقاطع القصيرة وShorts
        const hlsMaster = String(pJson?.streamingData?.hlsManifestUrl || '');
        if (hlsMaster.startsWith('http')) {
          try {
            const masterRes = await boundedFetch(hlsMaster, { headers: { 'User-Agent': profile.ua } });
            if (masterRes.ok) {
              const masterTxt = await masterRes.text();
              const variantUrls = masterTxt
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.startsWith('http'));
              const chosenVariant = variantUrls[Math.floor(variantUrls.length / 2)] || variantUrls[0];
              if (chosenVariant) {
                const plRes = await boundedFetch(chosenVariant, { headers: { 'User-Agent': profile.ua } });
                if (plRes.ok) {
                  const plTxt = await plRes.text();
                  const segs = plTxt
                    .split(/\r?\n/)
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('#'))
                    .map(l => (l.startsWith('http') ? l : new URL(l, chosenVariant).toString()));
                  if (segs.length > 0 && segs.length <= 36) {
                    const chunks: Uint8Array[] = [];
                    for (let i = 0; i < segs.length; i += 9) {
                      const batch = segs.slice(i, i + 9);
                      const bufs = await Promise.all(
                        batch.map(async u => {
                          const r = await boundedFetch(u, { headers: { 'User-Agent': profile.ua } });
                          if (!r.ok) throw new Error('seg_err');
                          return new Uint8Array(await r.arrayBuffer());
                        })
                      );
                      chunks.push(...bufs);
                    }
                    const mergedTs = concatUint8Arrays(chunks);
                    if (mergedTs.byteLength > 15_000 && mergedTs.byteLength <= 48 * 1024 * 1024) {
                      return { url: chosenVariant, bytes: mergedTs, ua: profile.ua, ext: 'mp4' };
                    }
                  }
                }
              }
            }
          } catch {
            // continue
          }
        }
      }
    } catch {
      continue;
    }
  }

  // صفحة التضمين العامة — بدون وسيط خارجي (قد تنجح وقت يفشل نداء innertube)
  const embedPage = await extractViaYouTubeEmbedPage(videoId, mode);
  if (embedPage?.bytes) return embedPage;

  // بدائل Piped الموزّعة (تمرّر الصوت الحقيقي عبر بروكسيات خارج داتاسنتر Cloudflare مع فحص البايتات الفعلي!)
  const pipedNodes = [
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.ducks.party'
  ];
  for (const pNode of pipedNodes) {
    try {
      const pRes = await boundedFetch(`${pNode}/streams/${encodeURIComponent(videoId)}`, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
      });
      if (!pRes.ok) continue;
      const pData: any = await pRes.json();
      if (mode === 'audio') {
        const aStreams: any[] = pData?.audioStreams || [];
        const bestA =
          aStreams.find(s => String(s.mimeType || '').includes('mp4') && s.url) ||
          aStreams.find(s => s.url);
        if (bestA?.url) {
          const verified = await tryFetchMediaBytes(String(bestA.url), { 'User-Agent': BROWSER_UA }, 20_000);
          if (verified) {
            return { url: String(bestA.url), bytes: verified, ua: BROWSER_UA, ext: 'm4a' };
          }
        }
      } else {
        const vStreams: any[] = (pData?.videoStreams || []).filter((s: any) => !s.videoOnly && s.url);
        if (vStreams[0]?.url) {
          const verified = await tryFetchMediaBytes(String(vStreams[0].url), { 'User-Agent': BROWSER_UA }, 20_000);
          if (verified) {
            return { url: String(vStreams[0].url), bytes: verified, ua: BROWSER_UA, ext: 'mp4' };
          }
        }
      }
    } catch {
      continue;
    }
  }

  // بدائل Invidious (مقترنة إلزامياً بـ tryFetchMediaBytes حتى لا تمر أي صفحة HTML/Anubis أبداً!)
  const invidiousNodes = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.tiekoetter.com',
    'https://yt.chocolatemoo53.com'
  ];
  for (const node of invidiousNodes) {
    try {
      const apiRes = await boundedFetch(`${node}/api/v1/videos/${videoId}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (!apiRes.ok) continue;
      const data: any = await apiRes.json();
      if (mode === 'audio') {
        const adaptive: any[] = data?.adaptiveFormats || [];
        const a =
          adaptive.find(x => String(x.itag) === '140' && x.url) ||
          adaptive.find(x => String(x.type || '').startsWith('audio/') && x.url);
        if (a?.url) {
          const proxied = `${node}/latest_version?id=${videoId}&itag=${a.itag || 140}&local=true`;
          const verified =
            (await tryFetchMediaBytes(proxied, { 'User-Agent': BROWSER_UA }, 20_000)) ||
            (await tryFetchMediaBytes(String(a.url), { 'User-Agent': BROWSER_UA }, 20_000));
          if (verified) {
            return { url: proxied, bytes: verified, ua: BROWSER_UA, ext: 'm4a' };
          }
        }
      } else {
        const formats: any[] = data?.formatStreams || [];
        const v = formats.find(x => x.url) || null;
        if (v?.url) {
          const proxied = `${node}/latest_version?id=${videoId}&itag=${v.itag || 18}&local=true`;
          const verified =
            (await tryFetchMediaBytes(proxied, { 'User-Agent': BROWSER_UA }, 20_000)) ||
            (await tryFetchMediaBytes(String(v.url), { 'User-Agent': BROWSER_UA }, 20_000));
          if (verified) {
            return { url: proxied, bytes: verified, ua: BROWSER_UA, ext: 'mp4' };
          }
        }
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
    const apiRes = await boundedFetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
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
    const res = await boundedFetch(
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

/** محرك JioSaavn العالمي للأغاني الكاملة بجودة 320kbps مباشرة من Akamai CDN (بدون أي حظر على Cloudflare Workers!) */
async function searchSaavnSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const endpoints = [
    `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`,
    `https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`
  ];
  for (const ep of endpoints) {
    try {
      const r = await boundedFetch(ep, { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } });
      if (!r.ok) continue;
      const j: any = await r.json();
      const results: any[] = j?.data?.results || j?.results || [];
      const out: SongSearchHit[] = [];
      for (const item of results) {
        const dlArr: any[] = Array.isArray(item?.downloadUrl) ? item.downloadUrl : [];
        const best =
          dlArr[dlArr.length - 1]?.url ||
          dlArr[dlArr.length - 1]?.link ||
          item?.download_url ||
          '';
        if (!best || !String(best).startsWith('http')) continue;
        const durSec = Number(item.duration || 0);
        if (durSec > 0 && durSec < 25) continue;
        const title = cleanSongTitle(String(item.name || item.title || query).replace(/&quot;/g, '"'));
        const artist =
          item?.artists?.primary?.map((a: any) => a.name).join(', ') ||
          String(item.primaryArtists || 'فنان');
        out.push({
          videoId: `sv:${item.id || out.length}`,
          title: title || query,
          artist,
          duration: durSec ? formatDurationSec(durSec) : '3:30',
          thumbnail: '',
          directAudioUrl: String(best),
          directExt: 'm4a'
        });
        if (out.length >= limit) break;
      }
      if (out.length) return out;
    } catch {
      continue;
    }
  }
  return [];
}

/** محرك Hearthis.at العام المفتوح للبث الصوتي المباشر بصيغة MP3 كاملة بدون أي حظر IP */
async function searchHearthisSongs(query: string, limit = 4): Promise<SongSearchHit[]> {
  try {
    const r = await boundedFetch(
      `https://api-v2.hearthis.at/search/?t=${encodeURIComponent(query)}&page=1&count=${limit}`,
      { headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }
    );
    if (!r.ok) return [];
    const arr: any[] = await r.json();
    if (!Array.isArray(arr)) return [];
    const out: SongSearchHit[] = [];
    for (const item of arr) {
      const streamUrl = item?.stream_url || item?.download_url;
      const durSec = Number(item?.duration || 0);
      if (!streamUrl || !String(streamUrl).startsWith('http') || durSec < 25 || durSec > 25 * 60) continue;
      out.push({
        videoId: `ht:${item.id || out.length}`,
        title: cleanSongTitle(String(item.title || query)),
        artist: String(item?.user?.username || 'فنان'),
        duration: formatDurationSec(durSec),
        thumbnail: String(item.thumb || ''),
        directAudioUrl: String(streamUrl),
        directExt: 'mp3'
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** البحث الموحّد والسريع عن الأغاني (يجمع SoundCloud المباشر + YouTube + Saavn CDN + Hearthis) */
export async function searchSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const q = String(query || '').trim();
  if (!q) return [];

  const [scHits, ytHits, svHits, htHits] = await Promise.all([
    searchSoundCloudSongs(q, limit).catch(() => []),
    searchYouTubeSongs(q, limit).catch(() => []),
    searchSaavnSongs(q, 3).catch(() => []),
    searchHearthisSongs(q, 2).catch(() => [])
  ]);

  const combined: SongSearchHit[] = [];
  for (const h of [...scHits, ...ytHits, ...svHits, ...htHits]) {
    if (combined.length < limit) combined.push(h);
  }
  return combined;
}

/** استخراج الصوت الكامل لأي نتيجة بحث (يفحص البايتات الثنائية الحقيقية عبر 6 محركات مستقلة 100%) */
export async function resolveSongAudioPayload(hit: SongSearchHit): Promise<ResolvedAudioPayload | null> {
  const rawId = String(hit.videoId || '');

  // 0) إذا النتيجة تحتوي رابط CDN مباشر (Saavn 320kbps أو Hearthis MP3)
  if (hit.directAudioUrl) {
    const verifiedDirect = await tryFetchMediaBytes(hit.directAudioUrl, { 'User-Agent': BROWSER_UA }, 20_000);
    if (verifiedDirect) {
      return {
        bytes: verifiedDirect,
        url: hit.directAudioUrl,
        ext: hit.directExt || 'mp3',
        headers: { 'User-Agent': BROWSER_UA }
      };
    }
  }

  // 1) إذا النتيجة من SoundCloud → سحب فوري من AWS CloudFront (Progressive أو HLS مع ترويسة MP4)
  if (rawId.startsWith('sc:')) {
    const scAudio = await resolveSoundCloudAudio(rawId.slice(3));
    if (scAudio) return scAudio;
  }

  const ytId = rawId.startsWith('yt:') ? rawId.slice(3) : rawId;
  const searchTerm = `${hit.title} ${hit.artist}`.trim();

  // 2) تشغيل SoundCloud + YouTube/Piped/Invidious + Saavn + Hearthis بالتوازي ثم اختبار كل بديل حتى نحصل على بايتات صوتية حقيقية 100%!
  const [scFallbackList, ytNative, svFallback, htFallback] = await Promise.all([
    searchSoundCloudSongs(searchTerm, 3).catch(() => []),
    ytId && !rawId.startsWith('sc:') && !rawId.startsWith('sv:') && !rawId.startsWith('ht:')
      ? extractViaYouTubeNative(ytId, 'audio').catch(() => null)
      : Promise.resolve(null),
    searchSaavnSongs(hit.title, 2).catch(() => []),
    searchHearthisSongs(hit.title, 2).catch(() => [])
  ]);

  if (ytNative?.bytes) {
    return {
      url: ytNative.url,
      bytes: ytNative.bytes,
      headers: { 'User-Agent': ytNative.ua },
      ext: 'm4a'
    };
  }

  for (const scItem of scFallbackList) {
    if (scItem.videoId.startsWith('sc:')) {
      const scAudio = await resolveSoundCloudAudio(scItem.videoId.slice(3));
      if (scAudio) return scAudio;
    }
  }

  // إعادة محاولة البحث في SoundCloud بعنوان الأغنية وحده بدون اسم القناة
  if (!scFallbackList.length && hit.title) {
    const titleOnlySc = await searchSoundCloudSongs(hit.title, 3).catch(() => []);
    for (const scItem of titleOnlySc) {
      if (scItem.videoId.startsWith('sc:')) {
        const scAudio = await resolveSoundCloudAudio(scItem.videoId.slice(3));
        if (scAudio) return scAudio;
      }
    }
  }

  for (const directItem of [...svFallback, ...htFallback]) {
    if (directItem.directAudioUrl) {
      const verified = await tryFetchMediaBytes(directItem.directAudioUrl, { 'User-Agent': BROWSER_UA }, 20_000);
      if (verified) {
        return {
          bytes: verified,
          url: directItem.directAudioUrl,
          ext: directItem.directExt || 'm4a',
          headers: { 'User-Agent': BROWSER_UA }
        };
      }
    }
  }

  // خط دفاع إضافي للصوت عبر Savetube / OceanSaver إذا كان المعرّف من يوتيوب
  if (ytId && !rawId.startsWith('sc:') && !rawId.startsWith('sv:') && !rawId.startsWith('ht:')) {
    const stAudio = await extractViaSavetubeCloud(ytId, 'audio');
    if (stAudio?.bytes) {
      return { url: stAudio.url, bytes: stAudio.bytes, ext: 'm4a', headers: { 'User-Agent': BROWSER_UA } };
    }
    const ocAudio = await extractViaOceanSaverCloud(ytId, 'audio');
    if (ocAudio?.bytes) {
      return { url: ocAudio.url, bytes: ocAudio.bytes, ext: 'm4a', headers: { 'User-Agent': BROWSER_UA } };
    }
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
  oversized?: boolean;
  sizeMB?: number;
  quality?: string;
  headers?: Record<string, string>;
}

export interface SocialDownloadResult {
  ok: boolean;
  items: DownloadedMediaItem[];
  title?: string;
  videoId?: string;
  error?: string;
  /** Which mirrors were tried and whether the failure was infrastructure-side. */
  diagnostics?: {
    serviceDown: boolean;
    providers: string[];
    kinds: string[];
    elapsedMs: number;
    timedOut: boolean;
    /** Every network call this download made, so an owner can see the real cause. */
    trace?: TraceEntry[];
  };
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
    // A parked host is not asked again: every extra call renews the throttle.
    if (isTikTokHost(currentUrl) && tiktokCooldownRemainingMs() > 0) return null;
    const cookieHeader = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const headers: Record<string, string> = {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
    };
    if (cookieHeader) headers.Cookie = cookieHeader;

    const res = await boundedFetch(currentUrl, { redirect: 'manual', headers });
    if (noteTikTokThrottle(currentUrl, res.status, res.headers.get('retry-after'))) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }

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
/** Telegram (and users' phones) add a stray `www.` to short hosts; m./vt./vm.
 * all point at the same post, so normalise before asking any provider. */
function normalizeTikTokUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (host === 'www.vt.tiktok.com') parsed.hostname = 'vt.tiktok.com';
    else if (host === 'www.vm.tiktok.com') parsed.hostname = 'vm.tiktok.com';
    else if (host === 'm.tiktok.com' || host === 'www.m.tiktok.com') parsed.hostname = 'www.tiktok.com';
    else if (host === 'tiktok.com') parsed.hostname = 'www.tiktok.com';
    return parsed.toString();
  } catch {
    return raw;
  }
}

const TIKTOK_ID_RE = /\/(?:video|photo|v)\/(\d{15,22})/;

/**
 * Short links (vt. / vm. / /t/) carry no video id, and every reliable provider —
 * the app feed especially — is addressed by that id. Follow the redirect chain
 * with a small bounded budget and hand back the canonical URL.
 */
async function resolveTikTokShortLink(raw: string): Promise<{ url: string; awemeId: string } | null> {
  let current = raw;
  for (let hop = 0; hop < 4; hop += 1) {
    const direct = String(current).match(TIKTOK_ID_RE)?.[1];
    if (direct) return { url: current, awemeId: direct };
    let location = '';
    try {
      const r = await boundedFetch(current, {
        redirect: 'manual',
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
        }
      }, 5_000);
      location = r.headers.get('location') || '';
      await r.body?.cancel().catch(() => undefined);
    } catch {
      return null;
    }
    if (!location) return null;
    current = location.startsWith('http') ? location : new URL(location, current).toString();
    const id = String(current).match(TIKTOK_ID_RE)?.[1];
    if (id) return { url: current, awemeId: id };
  }
  return null;
}

const TIKTOK_APP_HOSTS = [
  'https://api16-normal-c-alisg.tiktokv.com',
  'https://api16-normal-c-useast1a.tiktokv.com',
  'https://api22-normal-c-alisg.tiktokv.com'
];

const TIKTOK_APP_UA = 'TikTok 26.2.0 rv:262018 (iPhone; iOS 16.5; ar_IQ) Cronet';

/**
 * TikTok's quota is per IP, and every tiktok.com / *.tiktokv.com host draws from
 * it. So one 429 parks the whole family: retrying the page, the embed and the
 * three app hosts right after a throttle is what turned one 429 into a wall of
 * them. While parked we go straight to the resolvers that do not share the quota.
 */
const TIKTOK_PARK_MS = 8 * 60_000;
const TIKTOK_PARK_MAX_MS = 30 * 60_000;
let tiktokParkedUntil = 0;

function isTikTokHost(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === 'tiktok.com' || host.endsWith('.tiktok.com') || host.endsWith('.tiktokv.com');
  } catch {
    return false;
  }
}

/** True when TikTok just told us to back off (parks the family for a while). */
function noteTikTokThrottle(raw: string, status: number, retryAfterHeader?: string | null): boolean {
  if (status !== 429 || !isTikTokHost(raw)) return false;
  const retryAfter = Number(retryAfterHeader || 0);
  const asked = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 0;
  const wait = Math.min(TIKTOK_PARK_MAX_MS, Math.max(TIKTOK_PARK_MS, asked));
  tiktokParkedUntil = Math.max(tiktokParkedUntil, Date.now() + wait);
  return true;
}

/** How long TikTok asked us to stay away, in ms (0 = we are free to call it). */
export function tiktokCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, tiktokParkedUntil - now);
}

/** Clears the park (diagnostics and tests). */
export function resetTikTokCooldown(): void {
  tiktokParkedUntil = 0;
}

function tiktokFeedResult(json: any, awemeId: string): SocialDownloadResult | null {
  const aweme = (json?.aweme_list || []).find((a: any) => String(a?.aweme_id) === awemeId) || json?.aweme_list?.[0];
  if (!aweme) return null;
  const images: any[] = aweme?.image_post_info?.images || [];
  if (images.length > 0) {
    const items = images
      .map(img => img?.display_image?.url_list?.[0])
      .filter(Boolean)
      .map((url: string) => ({ kind: 'photo' as const, url }));
    return items.length ? { ok: true, title: aweme.desc || '', items } : null;
  }
  const videoUrl = aweme?.video?.play_addr?.url_list?.[0] || aweme?.video?.play_addr?.url_list?.[1];
  if (!videoUrl) return null;
  return { ok: true, title: aweme.desc || '', items: [{ kind: 'video' as const, url: String(videoUrl) }] };
}

/**
 * One request at a time to TikTok's app API. The app hosts share a single rate
 * limit per IP, so firing three in parallel is what produced the 429s; a
 * throttled host is skipped on the retry instead of being hit again.
 */
async function fetchTikTokAppFeed(awemeId: string): Promise<SocialDownloadResult | null> {
  const ordered = providerHealth.order(TIKTOK_APP_HOSTS.map(host => ({ name: host }))).map(item => item.name);
  if (tiktokCooldownRemainingMs() > 0) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const host of ordered) {
      if (providerHealth.coolingDown(host)) continue;
      const apiUrl =
        `${host}/aweme/v1/feed/?aweme_id=${awemeId}&version_name=26.2.0&version_code=262018` +
        `&build_number=26.2.0&manifest_version_code=262018&update_version_code=262018&openudid=7154829104829104&uuid=3849201948201948`;
      try {
        const r = await boundedFetch(apiUrl, { headers: { 'User-Agent': TIKTOK_APP_UA } });
        if (r.status === 429) {
          providerHealth.record(host, false, 'http 429');
          await r.body?.cancel().catch(() => undefined);
          // The whole TikTok family shares one quota, so stop asking any of it.
          noteTikTokThrottle(apiUrl, 429, r.headers.get('retry-after'));
          return null;
        }
        if (!r.ok) {
          await r.body?.cancel().catch(() => undefined);
          continue;
        }
        const parsed = tiktokFeedResult(await r.json(), awemeId);
        if (parsed) return parsed;
      } catch {
        // truncated/blocked body: same quota problem, treat it as throttling
        continue;
      }
    }
  }
  return null;
}

/**
 * Public resolvers that keep their own quota, so they still answer while TikTok
 * itself is throttling us. Both understand photo albums as well as videos.
 */
function tiktokThirdPartyResolvers(url: string): Array<{ name: string; run: () => Promise<SocialDownloadResult | null> }> {
  const cancel = (res: Response) => res.body?.cancel().catch(() => undefined);
  return [
    {
      name: 'tikwm',
      run: async () => {
        const form = new URLSearchParams({ url, hd: '1' });
        const res = await boundedFetch('https://www.tikwm.com/api/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': BROWSER_UA },
          body: form.toString()
        });
        if (!res.ok) {
          await cancel(res);
          return null;
        }
        const json: any = await res.json().catch(() => null);
        const d = json?.data;
        if (json?.code !== 0 || !d) return null;
        if (Array.isArray(d.images) && d.images.length > 0) {
          const photos = d.images
            .filter(Boolean)
            .slice(0, 10)
            .map((img: any) => ({ kind: 'photo' as const, url: String(typeof img === 'string' ? img : img?.url || '') }))
            .filter((item: any) => item.url.startsWith('http'));
          if (photos.length) return { ok: true, items: photos };
        }
        const rawVid = d.hdplay || d.play || d.wmplay;
        if (!rawVid) return null;
        const fullUrl = String(rawVid).startsWith('http') ? String(rawVid) : `https://www.tikwm.com${rawVid}`;
        return { ok: true, items: [{ kind: 'video' as const, url: fullUrl }] };
      }
    },
    {
      name: 'tiklydown',
      run: async () => {
        const res = await boundedFetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
        });
        if (!res.ok) {
          await cancel(res);
          return null;
        }
        const json: any = await res.json().catch(() => null);
        const body = json?.data?.images ? json.data : json;
        const pics: any[] = Array.isArray(body?.images) ? body.images : [];
        const photos = pics
          .map((item: any) => (typeof item === 'string' ? item : item?.url))
          .filter((u: any) => typeof u === 'string' && u.startsWith('http'))
          .slice(0, 10)
          .map((u: string) => ({ kind: 'photo' as const, url: u }));
        if (photos.length) return { ok: true, items: photos };
        const vid = body?.video?.noWatermark || body?.video?.watermark || json?.video?.noWatermark || json?.url;
        if (typeof vid !== 'string' || !vid.startsWith('http')) return null;
        return { ok: true, items: [{ kind: 'video' as const, url: vid }] };
      }
    }
  ];
}

async function downloadTikTok(url: string): Promise<SocialDownloadResult> {
  const normalized = normalizeTikTokUrl(url);
  let resolvedUrl = normalized;
  let awemeId = normalized.match(TIKTOK_ID_RE)?.[1] || '';
  // Every TikTok-owned host shares one quota, so a single 429 parks them all.
  const tiktokFree = () => tiktokCooldownRemainingMs() === 0;

  // A short link has no id: resolve it first, otherwise the app feed — our most
  // reliable layer — cannot even be asked, and the mirrors get a dead path.
  if (!awemeId && tiktokFree()) {
    const short = await resolveTikTokShortLink(normalized).catch(() => null);
    if (short) {
      resolvedUrl = short.url;
      awemeId = short.awemeId;
    }
  }

  // الطبقة 1: السحب المباشر من صفحة TikTok الرسمية مع حفظ الكوكيز (tt_chain_token) + استخراج الفيديو الأصلي بدون علامة مائية!
  // سلسلة الكوكيز قد تقفز 6 مرات، فنسقّفها: إذا حجب تيك توك الـ Worker ننتقل للمرايا فوراً بدل حرق الميزانية.
  if (tiktokFree()) try {
    const chain = await withTimeout(() => fetchWithCookieChain(resolvedUrl, BROWSER_UA), 7_000, 'tiktok:page');
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

  // الطبقتان 2 و3 معاً: مرايا العرض العامة وواجهة تطبيق تيك توك تعطي نفس المنشور،
  // فتُجرّب كلها بنفس اللحظة وأول إجابة مفحوصة تفوز — بدل 6 انتظارات متتالية.
  try {
    const pathPart = (() => {
      try {
        const u = new URL(resolvedUrl);
        return u.pathname + u.search;
      } catch {
        return '';
      }
    })();
    const mirrors: Array<{ name: string; run: () => Promise<SocialDownloadResult | null> }> = [];
    if (pathPart && pathPart.length > 2) {
      for (const proxyHost of ['tnktok.com', 'vxtiktok.com', 'tiktxk.com']) {
        mirrors.push({
          name: proxyHost,
          run: async () => {
            const r = await boundedFetch(`https://${proxyHost}${pathPart}`, {
              headers: { 'User-Agent': TG_BOT_UA },
              redirect: 'follow'
            });
            if (!r.ok) return null;
            const html = await r.text();
            // Photo posts carry no og:video at all: their frames live in og:image.
            const ogImages = Array.from(
              html.matchAll(/property=["']og:image(?::secure_url)?["']\s+content=["']([^"']+)["']/gi)
            ).map(match => match[1].replace(/&amp;/g, '&'));
            const vidUrl =
              html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
              html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/i)?.[1];
            if (!vidUrl || !vidUrl.startsWith('http')) {
              const photos = ogImages
                .filter(url => url.startsWith('http'))
                .slice(0, 10)
                .map(url => ({ kind: 'photo' as const, url, headers: { 'User-Agent': TG_BOT_UA } }));
              if (photos.length) return { ok: true, items: photos };
              return null;
            }
            const cleanVid = vidUrl.replace(/&amp;/g, '&');
            const verified = await tryFetchMediaBytes(cleanVid, { 'User-Agent': BROWSER_UA }, 2000);
            if (!verified) return null;
            return {
              ok: true,
              items: [{ kind: 'video' as const, url: cleanVid, bytes: verified, headers: { 'User-Agent': BROWSER_UA } }]
            };
          }
        });
      }
    }
    // TikTok's own embed page is served to datacenter IPs far more often than the
    // main site, and it carries the same play/download addresses as the app feed.
    // The embed page lives on TikTok's own host: skip it while the family is parked.
    if (awemeId && tiktokFree()) {
      mirrors.push({
        name: 'tiktok:embed',
        run: async () => {
          const r = await boundedFetch(`https://www.tiktok.com/embed/v2/${awemeId}`, {
            headers: {
              'User-Agent': BROWSER_UA,
              Referer: 'https://www.tiktok.com/',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          });
          if (!r.ok) return null;
          const html = await r.text();
          const raw =
            html.match(/"playAddr"\s*:\s*"([^"]+)"/)?.[1] ||
            html.match(/"play_addr"\s*:\s*\{"url_list"\s*:\s*\["([^"]+)"/)?.[1] ||
            html.match(/"downloadAddr"\s*:\s*"([^"]+)"/)?.[1] ||
            '';
          const mediaUrl = raw.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
          if (!mediaUrl.startsWith('http')) return null;
          const verified = await tryFetchMediaBytes(
            mediaUrl,
            { 'User-Agent': BROWSER_UA, Referer: 'https://www.tiktok.com/' },
            4_000
          );
          if (!verified) return null;
          return {
            ok: true,
            items: [
              { kind: 'video' as const, url: mediaUrl, bytes: verified, headers: { 'User-Agent': BROWSER_UA } }
            ]
          };
        }
      });
    }
    if (mirrors.length) {
      const raced = await raceProviders<SocialDownloadResult>(mirrors);
      if (raced.value) return raced.value;
    }
    // واجهة التطبيق تُجرَّب وحدها بعد المرايا: إطلاق 3 مضيفات بنفس اللحظة هو
    // السبب المباشر لخطأ 429 اللي كان يمنع التحميل بشكل متقطّع.
    if (awemeId && tiktokFree()) {
      const appFeed = await fetchTikTokAppFeed(awemeId);
      if (appFeed) return appFeed;
    }
  } catch {
    // ننتقل للطبقة التالية
  }

  // الطبقة 4: خدمات طرف ثالث مستقلة عن حصة تيك توك — هاي اللي تشتغل وقت الحجب،
  // فتُجرَّب بنفس اللحظة وأول إجابة صالحة تفوز (فيديو أو ألبوم صور).
  try {
    const raced = await raceProviders<SocialDownloadResult>(tiktokThirdPartyResolvers(resolvedUrl));
    if (raced.value) return raced.value;
  } catch {
    // ignore
  }

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل منشور تيك توك — تأكد أن المنشور عام وصحيح.' };
}

/** Merges Pinterest's HLS segments into one MP4 buffer (bounded, bail out on long playlists). */
async function mergePinterestHls(hlsPin: string, ua: string): Promise<DownloadedMediaItem | null> {
  const mRes = await boundedFetch(hlsPin, { headers: { 'User-Agent': ua } });
  if (!mRes.ok) return null;
  const mTxt = await mRes.text();
  const subPlaylists = mTxt
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => (l.startsWith('http') ? l : new URL(l, hlsPin).toString()));
  const targetPl = subPlaylists.some(u => u.includes('.m3u8')) ? subPlaylists.filter(u => u.includes('.m3u8')).pop()! : hlsPin;
  const segPlTxt =
    targetPl === hlsPin ? mTxt : await (await boundedFetch(targetPl, { headers: { 'User-Agent': ua } })).text();
  const segUrls = segPlTxt
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => (l.startsWith('http') ? l : new URL(l, targetPl).toString()));
  if (!segUrls.length || segUrls.length > 45) return null;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < segUrls.length; i += 10) {
    const batch = segUrls.slice(i, i + 10);
    const bufs = await Promise.all(
      batch.map(async u => {
        const sr = await boundedFetch(u, { headers: { 'User-Agent': ua } });
        if (!sr.ok) throw new Error('pin_seg_err');
        return new Uint8Array(await sr.arrayBuffer());
      })
    );
    chunks.push(...bufs);
  }
  const merged = concatUint8Arrays(chunks);
  if (merged.byteLength <= 10_000 || merged.byteLength > 48 * 1024 * 1024) return null;
  return { kind: 'video', url: hlsPin, bytes: merged, headers: { 'User-Agent': ua } };
}

/** 📌 تحميل من بنترست (يستخرج وسائط المنشور الحقيقية حصراً عبر بصمة المنشور نفسه دون التقاط صور واجهة بنترست الخلفية أبداً!) */
async function downloadPinterest(url: string): Promise<SocialDownloadResult> {
  try {
    // The cookie chain and a plain browser request fail for different reasons
    // (cookies, redirects, soft blocks), so both run at once and the first real
    // page wins instead of waiting for a blocked hop to time out.
    const pinPageHeaders: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
    };
    const racedPage = await raceProviders<{ finalUrl: string; html: string }>(
      [
        {
          name: 'pinterest:cookie-chain',
          run: async () => {
            const chain = await fetchWithCookieChain(url, BROWSER_UA);
            if (!chain?.html || chain.html.length < 4000) return null;
            return { finalUrl: chain.finalUrl || url, html: chain.html };
          }
        },
        {
          name: 'pinterest:plain-page',
          run: async () => {
            const r = await boundedFetch(url, { redirect: 'follow', headers: pinPageHeaders });
            if (!r.ok) return null;
            const html = await r.text();
            if (html.length < 4000) return null;
            return { finalUrl: (r as any).url || url, html };
          }
        }
      ],
      { timeoutMs: 12_000 }
    );
    const chain = racedPage.value;
    let finalUrl = chain?.finalUrl || url;
    let rawHtml = chain?.html || '';

    // إذا كان الرابط المختصر قد حوّل إلى مسار فرعي مثل /sent/ نجلب صفحة الـ Pin النقية مباشرة
    const pinId = finalUrl.match(/\/pin\/(?:[^/?#]*--)?(\d{8,24})/)?.[1] || url.match(/\/pin\/(?:[^/?#]*--)?(\d{8,24})/)?.[1] || '';
    if ((!rawHtml || rawHtml.length < 4000) && pinId) {
      const cleanPage = await fetchWithCookieChain(`https://www.pinterest.com/pin/${pinId}/`, BROWSER_UA);
      if (cleanPage?.html) {
        finalUrl = cleanPage.finalUrl || finalUrl;
        rawHtml = cleanPage.html;
      }
    }

    if (rawHtml) {
      const html = rawHtml.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');

      // 1) فحص مقاطع الفيديو الحقيقية الخاصة بالمنشور (MP4 مباشر مفحوص بالبايتات)
      const mp4Matches = Array.from(
        new Set(html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s<>\\]+\.mp4/gi) || [])
      );
      if (mp4Matches.length > 0) {
        const orderedMp4 = [
          ...mp4Matches.filter(u => u.includes('720w') || u.includes('720p') || u.includes('expMp4')),
          ...mp4Matches
        ];
        for (const candidateMp4 of Array.from(new Set(orderedMp4)).slice(0, 4)) {
          const verifiedVid = await tryFetchMediaBytes(candidateMp4, { 'User-Agent': BROWSER_UA }, 4_000);
          if (verifiedVid) {
            return {
              ok: true,
              items: [{ kind: 'video', url: candidateMp4, bytes: verifiedVid, headers: { 'User-Agent': BROWSER_UA } }]
            };
          }
        }
      }

      // 1-ب) فحص مقاطع الفيديو بنظام البث HLS (.m3u8) ودمج مقاطعها في الذاكرة لترسل كملف فيديو MP4 كامل!
      const hlsPin = html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s<>\\]+\.m3u8/i)?.[0];
      if (hlsPin) {
        try {
          // Segment merging is many small requests: cap the whole job so a slow CDN
          // cannot eat the entire download budget.
          const hlsResult = await withTimeout(() => mergePinterestHls(hlsPin, BROWSER_UA), 14_000, 'pinterest:hls');
          if (hlsResult) return { ok: true, items: [hlsResult] };
        } catch {
          // ننتقل لفحص صورة المنشور
        }
      }
      // 2) استخراج صورة المنشور الحقيقية حصراً عبر وسم المنشور نفسه (og:image / twitter:image) ثم ترقية نفس البصمة فقط إلى originals!
      // ⚠️ ممنوع تماماً التقاط أول رابط originals عشوائي بالصفحة لأن بنترست يضع صورة خلفية متدرجة ملونة بأعلى الصفحة!
      const pinMetaImg =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](https:\/\/i\.pinimg\.com\/[^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["'](https:\/\/i\.pinimg\.com\/[^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
        html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["'](https:\/\/i\.pinimg\.com\/[^"']+)["']/i)?.[1] ||
        html.match(/<meta[^>]+content=["'](https:\/\/i\.pinimg\.com\/[^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i)?.[1] ||
        (pinId
          ? html
              .slice(Math.max(0, html.indexOf(`"id":"${pinId}"`) - 400), html.indexOf(`"id":"${pinId}"`) + 5000)
              .match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s<>\\]+\.(?:jpg|jpeg|png|webp)/i)?.[0]
          : undefined);

      if (pinMetaImg) {
        const candidatePhotos: string[] = [];
        // استخراج البصمة السداسية عشرية الدقيقة للمنشور (مثال: ab/cd/ef/abcdef123456) وترقيتها إلى النسخة الأصلية الكاملة بدون ضغط!
        const hashMatch = pinMetaImg.match(/i\.pinimg\.com\/[^/]+\/([0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{16,40})\.(jpg|jpeg|png|webp)/i);
        if (hashMatch) {
          const hashSubpath = hashMatch[1];
          const escapedHash = hashSubpath.replace(/\//g, '\\/');
          const exactOrigInHtml = html.match(
            new RegExp(`https:\\/\\/i\\.pinimg\\.com\\/originals\\/${escapedHash}\\.(?:jpg|jpeg|png|webp)`, 'i')
          )?.[0];
          if (exactOrigInHtml) candidatePhotos.push(exactOrigInHtml);
          candidatePhotos.push(`https://i.pinimg.com/originals/${hashSubpath}.${hashMatch[2]}`);
          candidatePhotos.push(`https://i.pinimg.com/originals/${hashSubpath}.jpg`);
          candidatePhotos.push(`https://i.pinimg.com/originals/${hashSubpath}.png`);
          candidatePhotos.push(`https://i.pinimg.com/736x/${hashSubpath}.jpg`);
        }
        candidatePhotos.push(pinMetaImg);

        for (const pUrl of Array.from(new Set(candidatePhotos))) {
          const verifiedImg = await tryFetchMediaBytes(pUrl, { 'User-Agent': BROWSER_UA }, 2_000);
          if (verifiedImg) {
            return {
              ok: true,
              items: [{ kind: 'photo', url: pUrl, bytes: verifiedImg, headers: { 'User-Agent': BROWSER_UA } }]
            };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Last resort: public oEmbed gives the pin's own cover image even when the
  // HTML page is a soft-blocked shell.
  try {
    const oembed = await boundedFetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' }
    }, 6_000);
    if (oembed.ok) {
      const meta: any = await oembed.json();
      const cover = String(meta?.thumbnail_url || '');
      if (cover.startsWith('http')) {
        const upgraded = cover.replace(/\/(?:236x|474x|564x|736x)\//, '/originals/');
        for (const candidate of Array.from(new Set([upgraded, cover]))) {
          const verified = await tryFetchMediaBytes(candidate, { 'User-Agent': BROWSER_UA }, 3_000);
          if (verified) {
            return { ok: true, items: [{ kind: 'photo', url: candidate, bytes: verified, headers: { 'User-Agent': BROWSER_UA } }] };
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return { ok: false, items: [], error: '⚠️ تعذّر استخراج المنشور من بنترست — تأكد من إرسال رابط المنشور الصحيح.' };
}

/** 📸 تحميل من إنستغرام (5 طبقات مفحوصة بالبايتات: SSR Polaris JSON + Embed الرسمي + GraphQL الحي + وسطاء العرض الفعّالة) */
async function downloadInstagram(url: string): Promise<SocialDownloadResult> {
  let targetUrl = url;

  // فك روابط المشاركة الحديثة instagram.com/share/reel/... أو /share/p/... للحصول على الـ shortcode الحقيقي
  if (targetUrl.includes('/share/')) {
    try {
      const chain = await fetchWithCookieChain(targetUrl, MOBILE_SAFARI_UA);
      if (chain?.finalUrl) targetUrl = chain.finalUrl;
    } catch {
      // continue
    }
  }

  const scMatch = String(targetUrl).match(/instagram\.com\/(?:[^/?#]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  const shortcode = scMatch ? scMatch[2] : '';
  // المرايا تفصل بين الريل والصورة، فنبني نفس نوع المسار اللي أرسله المستخدم.
  const igPathKind = scMatch && /^(reel|reels|tv)$/i.test(scMatch[1]) ? 'reel' : 'p';
  if (!shortcode) {
    return { ok: false, items: [], error: '⚠️ تأكد من إرسال رابط منشور أو ريلز إنستغرام صحيح.' };
  }

  const igHeaders: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Referer: 'https://www.instagram.com/'
  };

  let liveLsd = 'AVqbxe3J_YA';
  let liveCookies = '';

  // الطبقة 1: السحب المباشر من صفحة إنستغرام الرسمية SSR (<script type="application/json"> Polaris video_versions / image_versions2) تماماً مثل طريقة تيك توك الشغّالة 100%!
  try {
    const pageChain = await fetchWithCookieChain(`https://www.instagram.com/reel/${shortcode}/`, BROWSER_UA);
    if (pageChain?.html) {
      liveCookies = pageChain.cookies || '';
      const lsdMatch =
        pageChain.html.match(/"LSD"\s*,\s*\[[^\]]*\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/) ||
        pageChain.html.match(/"lsd"\s*:\s*"([^"]+)"/) ||
        pageChain.html.match(/name=["']lsd["'][^>]*value=["']([^"']+)["']/i) ||
        pageChain.html.match(/value=["']([^"']+)["'][^>]*name=["']lsd["']/i);
      if (lsdMatch?.[1]) liveLsd = lsdMatch[1];

      const unescaped = pageChain.html.replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');

      // أ) فحص روابط الفيديو المباشرة video_versions من CDN إنستغرام الرسمي
      const vidMatches = Array.from(
        unescaped.matchAll(/"video_versions"\s*:\s*\[\s*\{[^}]*?"url"\s*:\s*"(https:\/\/[^"]+)"/g)
      ).map(m => m[1]);
      if (vidMatches.length > 0) {
        const verifiedItems: DownloadedMediaItem[] = [];
        for (const vu of Array.from(new Set(vidMatches)).slice(0, 5)) {
          const b = await tryFetchMediaBytes(vu, igHeaders, 4_000);
          if (b) verifiedItems.push({ kind: 'video', url: vu, bytes: b, headers: igHeaders });
        }
        if (verifiedItems.length > 0) {
          return { ok: true, items: verifiedItems };
        }
      }

      // ب) فحص video_url المباشر داخل SSR JSON
      const directVid = unescaped.match(/"video_url"\s*:\s*"(https:\/\/[^"]+)"/)?.[1];
      if (directVid) {
        const b = await tryFetchMediaBytes(directVid, igHeaders, 4_000);
        if (b) return { ok: true, items: [{ kind: 'video', url: directVid, bytes: b, headers: igHeaders }] };
      }

      // ج) فحص الصور عالية الدقة display_url / image_versions2 للمنشورات المصوّرة
      const imgMatches = Array.from(
        unescaped.matchAll(/"display_url"\s*:\s*"(https:\/\/[^"]+)"/g)
      ).map(m => m[1]);
      if (imgMatches.length > 0) {
        const verifiedPhotos: DownloadedMediaItem[] = [];
        for (const iu of Array.from(new Set(imgMatches)).slice(0, 5)) {
          const b = await tryFetchMediaBytes(iu, igHeaders, 3_000);
          if (b) verifiedPhotos.push({ kind: 'photo', url: iu, bytes: b, headers: igHeaders });
        }
        if (verifiedPhotos.length > 0) {
          return { ok: true, items: verifiedPhotos };
        }
      }
    }
  } catch {
    // ننتقل للطبقة التالية
  }

  // الطبقة 2: صفحة التضمين الرسمية Embed (تعمل بدون تسجيل دخول على جميع المنشورات العامة!)
  for (const embPath of [`https://www.instagram.com/p/${shortcode}/embed/captioned/`, `https://www.instagram.com/reel/${shortcode}/embed/`]) {
    try {
      const emb = await boundedFetch(embPath, {
        headers: {
          'User-Agent': MOBILE_SAFARI_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      if (!emb.ok) continue;
      const rawHtml = await emb.text();
      const unescaped = rawHtml
        .replace(/\\\\"/g, '"')
        .replace(/\\\//g, '/')
        .replace(/\\u0026/gi, '&')
        .replace(/&amp;/g, '&');

      const vMatch = unescaped.match(/"video_url"\s*:\s*"(https:\/\/[^"]+)"/);
      if (vMatch?.[1]) {
        const b = await tryFetchMediaBytes(vMatch[1], igHeaders, 4_000);
        if (b) return { ok: true, items: [{ kind: 'video', url: vMatch[1], bytes: b, headers: igHeaders }] };
      }

      const imgMatch =
        rawHtml.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/i)?.[1] ||
        unescaped.match(/"display_src"\s*:\s*"(https:\/\/[^"]+)"/)?.[1];
      if (imgMatch && !imgMatch.includes('static.cdninstagram.com')) {
        const cleanImg = imgMatch.replace(/&amp;/g, '&');
        const b = await tryFetchMediaBytes(cleanImg, igHeaders, 3_000);
        if (b) return { ok: true, items: [{ kind: 'photo', url: cleanImg, bytes: b, headers: igHeaders }] };
      }
    } catch {
      continue;
    }
  }

  // الطبقة 3: GraphQL الرسمي لإنستغرام عبر كلا المسارين الرسميين (/api/graphql و /graphql/query) مع توكن LSD الحيّ
  for (const [gqlEndpoint, docId] of [
    ['https://www.instagram.com/api/graphql', '8845758582119845'],
    ['https://www.instagram.com/graphql/query', '10015901848480474']
  ] as const) {
    try {
      const form = new URLSearchParams({
        av: '0',
        __d: 'www',
        __user: '0',
        __a: '1',
        __req: '3',
        lsd: liveLsd,
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
        doc_id: docId
      });
      const gqlHeaders: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': BROWSER_UA,
        'X-IG-App-ID': '936619743392459',
        'X-FB-LSD': liveLsd,
        'X-ASBD-ID': '129477',
        'Sec-Fetch-Site': 'same-origin',
        Origin: 'https://www.instagram.com',
        Referer: `https://www.instagram.com/p/${shortcode}/`
      };
      if (liveCookies) gqlHeaders.Cookie = liveCookies;

      const r = await boundedFetch(gqlEndpoint, {
        method: 'POST',
        headers: gqlHeaders,
        body: form.toString()
      });
      if (!r.ok) continue;
      const j: any = await r.json();
      const media = j?.data?.xdt_shortcode_media;
      if (!media) continue;

      const edges: any[] = media?.edge_sidecar_to_children?.edges || [];
      if (edges.length > 0) {
        const verifiedItems: DownloadedMediaItem[] = [];
        for (const e of edges.slice(0, 5)) {
          const n = e?.node;
          if (!n) continue;
          const u = n.is_video && n.video_url ? String(n.video_url) : String(n.display_url || '');
          const kind: 'video' | 'photo' = n.is_video && n.video_url ? 'video' : 'photo';
          if (!u) continue;
          const b = await tryFetchMediaBytes(u, igHeaders, 3_000);
          if (b) verifiedItems.push({ kind, url: u, bytes: b, headers: igHeaders });
        }
        if (verifiedItems.length > 0) return { ok: true, items: verifiedItems };
      }

      if (media.is_video && media.video_url) {
        const b = await tryFetchMediaBytes(String(media.video_url), igHeaders, 4_000);
        if (b) return { ok: true, items: [{ kind: 'video', url: String(media.video_url), bytes: b, headers: igHeaders }] };
      }
      if (media.display_url) {
        const b = await tryFetchMediaBytes(String(media.display_url), igHeaders, 3_000);
        if (b) return { ok: true, items: [{ kind: 'photo', url: String(media.display_url), bytes: b, headers: igHeaders }] };
      }
    } catch {
      continue;
    }
  }

  // الطبقة 4: وسطاء العرض المخصصة لبوتات تيليجرام مع فحص البايتات الفعلي إلزامياً (لا يُقبل أي رابط وهمي!)
  // Instagram's own embed page is public (that is how blogs embed posts) and is
  // not subject to the login wall that blocks the normal page.
  const igMirrors: Array<{ name: string; run: () => Promise<DownloadedMediaItem | null> }> = [
    {
      name: 'instagram:embed',
      run: async () => {
        const r = await boundedFetch(`https://www.instagram.com/${igPathKind}/${shortcode}/embed/captioned/`, {
          headers: {
            'User-Agent': BROWSER_UA,
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://www.instagram.com/'
          }
        });
        if (!r.ok) return null;
        const html = await r.text();
        const videoUrl =
          html.match(/"video_url"\s*:\s*"([^"]+)"/)?.[1] ||
          html.match(/video_url\s*[:=]\s*["']([^"']+)["']/)?.[1] ||
          '';
        const cleanVideo = videoUrl.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
        if (cleanVideo.startsWith('http')) {
          const verified = await tryFetchMediaBytes(cleanVideo, { 'User-Agent': BROWSER_UA }, 4_000);
          if (verified) {
            return { kind: 'video' as const, url: cleanVideo, bytes: verified, headers: { 'User-Agent': BROWSER_UA } };
          }
        }
        const displayUrl = html.match(/"display_url"\s*:\s*"([^"]+)"/)?.[1] || '';
        const cleanPhoto = displayUrl.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&');
        if (cleanPhoto.startsWith('http')) {
          const verified = await tryFetchMediaBytes(cleanPhoto, { 'User-Agent': BROWSER_UA }, 3_000);
          if (verified) {
            return { kind: 'photo' as const, url: cleanPhoto, bytes: verified, headers: { 'User-Agent': BROWSER_UA } };
          }
        }
        return null;
      }
    }
  ];

  // The view mirrors all read the same public post: race them, verified bytes only.
  const racedIg = await raceProviders<DownloadedMediaItem>([
    ...igMirrors,
    ...['instagramez.com', 'kkinstagram.com', 'vxinstagram.com', 'eeinstagram.com', 'ddinstagram.com'].map(host => ({
      name: host,
      run: async () => {
        const r = await boundedFetch(`https://${host}/${igPathKind}/${shortcode}`, {
          headers: { 'User-Agent': TG_BOT_UA },
          redirect: 'follow'
        });
        if (!r.ok) return null;
        const html = await r.text();
        const vidUrl =
          html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/i)?.[1];
        if (vidUrl && vidUrl.startsWith('http')) {
          const cleanVid = vidUrl.replace(/&amp;/g, '&');
          const verified = await tryFetchMediaBytes(cleanVid, { 'User-Agent': BROWSER_UA }, 4000);
          if (verified) return { kind: 'video' as const, url: cleanVid, bytes: verified, headers: { 'User-Agent': BROWSER_UA } };
        }
        const imgUrl =
          html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
        if (imgUrl && imgUrl.startsWith('http') && !imgUrl.includes('logo')) {
          const cleanImg = imgUrl.replace(/&amp;/g, '&');
          const verified = await tryFetchMediaBytes(cleanImg, { 'User-Agent': BROWSER_UA }, 3000);
          if (verified) return { kind: 'photo' as const, url: cleanImg, bytes: verified, headers: { 'User-Agent': BROWSER_UA } };
        }
        return null;
      }
    }))
  ]);
  if (racedIg.value) return { ok: true, items: [racedIg.value] };

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل منشور إنستغرام — تأكد أن الحساب عام والرابط صحيح.' };
}

/** ▶️ تحميل فيديو من يوتيوب (عادي أو Shorts) عبر 5 محركات سحابية مستقلة غير مقيدة بالـ IP + فحص كامل للبايتات */
async function downloadYouTube(url: string): Promise<SocialDownloadResult> {
  const vid = extractYoutubeVideoId(url);
  if (!vid) {
    return { ok: false, items: [], error: '⚠️ تأكد من إرسال رابط يوتيوب أو Shorts صحيح.' };
  }

  // الطبقة 1: العملاء الأصليون (ANDROID_TESTSUITE / TVHTML5 / IOS) — الطريق الرسمي:
  // أسرع وأخف من أي وسيط، ويفشل خلال ثانية أو ثانيتين إذا حجب يوتيوب عنوان الـ Worker.
  const native = await extractViaYouTubeNative(vid, 'video');
  if (native?.bytes) {
    return {
      ok: true,
      videoId: vid,
      items: [
        {
          kind: 'video',
          url: native.url,
          bytes: native.bytes,
          headers: { 'User-Agent': native.ua }
        }
      ]
    };
  }

  // الطبقة 2: وسيطان سحابيان مستقلان — يُجرّبان سوية لأن أحدهما قد يكون معطلاً،
  // ولا معنى لانتظار ميت قبل تجربة الحي.
  type CloudItem = Awaited<ReturnType<typeof extractViaSavetubeCloud>>;
  const racedCloud = await raceProviders<NonNullable<CloudItem>>([
    { name: 'savetube', run: async () => (await extractViaSavetubeCloud(vid, 'video')) as NonNullable<CloudItem> },
    { name: 'oceansaver', run: async () => (await extractViaOceanSaverCloud(vid, 'video')) as NonNullable<CloudItem> }
  ]);
  const cloud = racedCloud.value;
  if (cloud && (cloud.bytes || cloud.oversized)) {
    return {
      ok: true,
      videoId: vid,
      title: cloud.title,
      items: [
        {
          kind: 'video',
          url: cloud.url,
          bytes: cloud.bytes,
          oversized: cloud.oversized,
          sizeMB: cloud.sizeMB,
          quality: cloud.quality,
          headers: { 'User-Agent': BROWSER_UA }
        }
      ]
    };
  }

  // الطبقة 3: البث الممرّر عبر بروكسي Invidious المحلي (&local=true يتجاوز قفل ip= الخاص بـ googlevideo تماماً!)
  // From the official iv-org/documentation instance list (they must score 90%+
  // uptime to be listed), freshest first.
  const invLocalHosts = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.tiekoetter.com',
    'https://yt.chocolatemoo53.com'
  ];
  // The instances mirror the same stream, so they run together and the first good one wins.
  const racedInvidious = await raceProviders<DownloadedMediaItem>(
    invLocalHosts.map(host => ({
      name: host,
      run: async () => {
        const proxiedUrl = `${host}/latest_version?id=${encodeURIComponent(vid)}&itag=18&local=true`;
        const probed = await probeMediaStreamOrBytes(proxiedUrl, { 'User-Agent': BROWSER_UA }, 10_000);
        if (!(probed?.bytes || probed?.oversized)) return null;
        return {
          kind: 'video' as const,
          url: probed.directUrl,
          bytes: probed.bytes,
          oversized: probed.oversized,
          sizeMB: probed.sizeMB,
          headers: { 'User-Agent': BROWSER_UA }
        };
      }
    }))
  );
  if (racedInvidious.value) return { ok: true, videoId: vid, items: [racedInvidious.value] };

  // الطبقة 5: عقد Cobalt السحابية كخط دفاع خامس مع دعم الأحجام الأكبر من 50MB
  // Community instances tracked by cobalt.directory (they are tested for API
  // support before being listed). Dead ones get parked by the health registry.
  const cobaltNodes = [
    'https://subito-c.meowing.de',
    'https://nuko-c.meowing.de',
    'https://cobalt-api.clxxped.lol',
    'https://nachos.imput.net',
    'https://sunny.imput.net',
    'https://cobalt-api.kwiatekmiki.com'
  ];
  const racedCobalt = await raceProviders<DownloadedMediaItem>(
    cobaltNodes.map(node => ({
      name: node,
      run: async () => {
        const r = await boundedFetch(node, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': BROWSER_UA
          },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${vid}`,
            videoQuality: '480',
            filenameStyle: 'basic'
          })
        });
        if (!r.ok) return null;
        const j: any = await r.json();
        // cobalt v10 answers with a status: tunnel (proxied stream), redirect
        // (direct CDN link) or picker (an array of candidates).
        const status = String(j?.status || '');
        const picked =
          status === 'picker'
            ? j?.picker?.find((item: any) => item?.type === 'video') || j?.picker?.[0]
            : null;
        const dlUrl = picked?.url || j?.url;
        if (!dlUrl || !String(dlUrl).startsWith('http')) return null;
        const probed = await probeMediaStreamOrBytes(String(dlUrl), { 'User-Agent': BROWSER_UA }, 10_000);
        if (!(probed?.bytes || probed?.oversized)) return null;
        return {
          kind: 'video' as const,
          url: probed.directUrl,
          bytes: probed.bytes,
          oversized: probed.oversized,
          sizeMB: probed.sizeMB,
          headers: { 'User-Agent': BROWSER_UA }
        };
      }
    }))
  );
  if (racedCobalt.value) return { ok: true, videoId: vid, items: [racedCobalt.value] };

  return { ok: false, items: [], error: '⚠️ تعذّر تحميل الفيديو من يوتيوب — تأكد أن الفيديو عام ثم حاول مجدداً.' };
}

/** استخراج النسخة عالية الدقة (1080p / 720p HD) لزر «🎬 تحميل بدقة عالية HD» حتى لو تجاوزت 50MB */
async function extractHighDefinitionAttempt(videoId: string): Promise<SocialDownloadResult> {
  const savetubeHd = await extractViaSavetubeCloud(videoId, 'video', ['1080', '720', '480']);
  if (savetubeHd?.bytes || savetubeHd?.oversized) {
    return {
      ok: true,
      videoId,
      title: savetubeHd.title,
      items: [
        {
          kind: 'video',
          url: savetubeHd.url,
          bytes: savetubeHd.bytes,
          oversized: savetubeHd.oversized,
          sizeMB: savetubeHd.sizeMB,
          quality: savetubeHd.quality || 'HD',
          headers: { 'User-Agent': BROWSER_UA }
        }
      ]
    };
  }

  const oceanHd =
    (await extractViaOceanSaverCloud(videoId, 'video', '1080')) ||
    (await extractViaOceanSaverCloud(videoId, 'video', '720'));
  if (oceanHd?.bytes || oceanHd?.oversized) {
    return {
      ok: true,
      videoId,
      title: oceanHd.title,
      items: [
        {
          kind: 'video',
          url: oceanHd.url,
          bytes: oceanHd.bytes,
          oversized: oceanHd.oversized,
          sizeMB: oceanHd.sizeMB,
          quality: oceanHd.quality || 'HD',
          headers: { 'User-Agent': BROWSER_UA }
        }
      ]
    };
  }

  return {
    ok: false,
    items: [],
    error: '⚠️ تعذّر استخراج النسخة عالية الدقة (HD) لهذا الفيديو حالياً — حاول مجدداً بعد لحظات.'
  };
}

/**
 * HD is the least reliable path (both cloud transcoders cap at 720/1080 and one
 * of them is usually down), so it gets the same hard budget as a normal download.
 */
export async function extractYouTubeHighDefinition(videoId: string): Promise<SocialDownloadResult> {
  const started = Date.now();
  try {
    const result = await withTimeout(() => extractHighDefinitionAttempt(videoId), MEDIA_TOTAL_BUDGET_MS, 'yt:hd');
    if (result.ok) return result;
    const summary = summarizeFailures(attemptsSince(started), 'يوتيوب HD');
    return { ...result, error: summary.serviceDown ? summary.text : result.error || summary.text };
  } catch (error: any) {
    const summary = summarizeFailures(attemptsSince(started), 'يوتيوب HD');
    return {
      ok: false,
      items: [],
      error:
        error?.code === 'timeout'
          ? '⚠️ النسخة عالية الدقة تأخذ وقت طويل هالوقت — جرّب زر HD مرة ثانية أو نزّل النسخة العادية.'
          : summary.text
    };
  }
}

/** Same post reached through different tracking links must share one cache slot. */
function cacheKeyFor(platform: SocialPlatform, rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${platform}:${host}${path}`;
  } catch {
    return `${platform}:${String(rawUrl).trim().toLowerCase()}`;
  }
}

/**
 * Rebuilds a cached post: the media links are reused, but the bytes are fetched
 * again (the caller empties them after sending), so nothing stale is delivered.
 */
async function reviveCachedResult(
  entry: { title?: string; videoId?: string; items: Array<Omit<DownloadedMediaItem, 'bytes'>> }
): Promise<SocialDownloadResult | null> {
  const items: DownloadedMediaItem[] = [];
  for (const item of entry.items) {
    if (item.oversized) {
      items.push({ ...item });
      continue;
    }
    const bytes = await tryFetchMediaBytes(item.url, item.headers, 3_000);
    if (!bytes) return null;
    items.push({ ...item, bytes });
  }
  return items.length ? { ok: true, items, title: entry.title, videoId: entry.videoId } : null;
}

/** Runs one platform's downloader; kept separate so the budget wrapper stays tiny. */
function runPlatformDownload(platform: SocialPlatform, url: string): Promise<SocialDownloadResult> {
  switch (platform) {
    case 'tt':
      return downloadTikTok(url);
    case 'pin':
      return downloadPinterest(url);
    case 'ig':
      return downloadInstagram(url);
    case 'yt':
      return downloadYouTube(url);
  }
}

/** Attempts made since `since`, so a failure can explain itself. */
function attemptsSince(since: number): ProviderAttempt[] {
  return providerHealth
    .snapshot()
    .filter(entry => entry.lastFailureAt >= since || entry.lastSuccessAt >= since)
    .map(entry => ({
      provider: entry.provider,
      ok: entry.lastSuccessAt >= entry.lastFailureAt,
      ms: 0,
      at: Math.max(entry.lastSuccessAt, entry.lastFailureAt),
      reason: entry.lastReason
    }));
}

/** How long the platform's own throttle still runs, so the message can say it. */
function cooldownFor(platform: SocialPlatform): number {
  return platform === 'tt' ? tiktokCooldownRemainingMs() : 0;
}

function plainPlatformLabel(platform: SocialPlatform): string {
  return socialPlatformLabel(platform).replace(/^[^\p{L}]+/u, '').trim();
}

/**
 * Downloads one public post, with a hard time budget: the mirrors are third-party
 * services, so a dead one must never hang the bot or be blamed on the user's link.
 */
export async function downloadFromPlatform(platform: SocialPlatform, rawInput: string): Promise<SocialDownloadResult> {
  const extracted = extractFirstUrl(rawInput);
  if (!extracted) {
    return { ok: false, items: [], error: '⚠️ يرجى إرسال رابط صحيح يبدأ بـ https://' };
  }
  const label = plainPlatformLabel(platform);
  const started = Date.now();
  traceReset();

  // Repeating the same link is the normal case (a retry tap, a friend asking for
  // the same video): serve it from memory and never touch TikTok's quota again.
  const cacheKey = cacheKeyFor(platform, extracted);
  const cached = cacheGet(cacheKey);
  if (cached) {
    const revived = await reviveCachedResult(cached).catch(() => null);
    if (revived) return revived;
    cacheDelete(cacheKey);
  }

  let result: SocialDownloadResult;
  let timedOut = false;
  try {
    result = await withTimeout(() => runPlatformDownload(platform, extracted), MEDIA_TOTAL_BUDGET_MS, `download:${platform}`);
  } catch (error: any) {
    timedOut = error?.code === 'timeout';
    const attempts = attemptsSince(started);
    const summary = summarizeFailures(attempts, label, { waitMs: cooldownFor(platform) });
    return {
      ok: false,
      items: [],
      error: timedOut
        ? `⚠️ خدمة التحميل من ${label} بطيئة جداً هالوقت — جرّب مرة ثانية أو منصة ثانية.`
        : summary.text,
      diagnostics: {
        serviceDown: timedOut || summary.serviceDown,
        providers: summary.providers,
        kinds: summary.kinds,
        elapsedMs: Date.now() - started,
        timedOut,
        trace: traceSnapshot()
      }
    };
  }
  if (result.ok) {
    cacheSet(cacheKey, {
      title: result.title,
      videoId: result.videoId,
      items: result.items.map(({ bytes: _bytes, ...rest }) => rest)
    });
    return result;
  }

  // A plain "make sure it is public" hides a broken mirror: say what really failed.
  const attempts = attemptsSince(started);
  const summary = summarizeFailures(attempts, label, { waitMs: cooldownFor(platform) });
  return {
    ...result,
    error: summary.serviceDown ? summary.text : result.error || summary.text,
    diagnostics: {
      serviceDown: summary.serviceDown,
      providers: summary.providers,
      kinds: summary.kinds,
      elapsedMs: Date.now() - started,
      timedOut,
      trace: traceSnapshot()
    }
  };
}

/** One download together with the exact list of hosts it talked to (owner tools). */
export async function diagnoseDownload(platform: SocialPlatform, rawInput: string) {
  const started = Date.now();
  const result = await downloadFromPlatform(platform, rawInput);
  return {
    result,
    elapsedMs: Date.now() - started,
    build: MEDIA_ENGINE_BUILD,
    trace: traceSnapshot()
  };
}

/** Guesses the platform of a pasted link so /dltest can be a one-argument command. */
export function detectPlatformFromUrl(raw: string): SocialPlatform | null {
  const text = String(raw || '').toLowerCase();
  if (/tiktok\.com/.test(text)) return 'tt';
  if (/instagram\.com|instagr\.am/.test(text)) return 'ig';
  if (/pinterest\.|pin\.it/.test(text)) return 'pin';
  if (/youtube\.com|youtu\.be/.test(text)) return 'yt';
  return null;
}

/** Empties the short-lived post memory (used by the diagnostics script). */
export function clearMediaCache(): void {
  cacheClear();
}

/** Health of every mirror the downloaders touched (for /dlstatus and diagnostics). */
export function mediaProviderReport(now = Date.now()) {
  return providerHealth.snapshot(now).map(entry => ({
    ...entry,
    status: entry.coolingDown ? 'متعطلة مؤقتاً' : entry.consecutiveFailures > 0 ? 'متذبذبة' : entry.ok > 0 ? 'شغّالة' : 'ما مستخدمة'
  }));
}

/** Resets mirror health; used by tests and by /dlstatus reset. */
export function resetMediaProviders(): void {
  providerHealth.reset();
  resetTikTokCooldown();
}

export {
  MEDIA_ENGINE_BUILD,
  MEDIA_PROBE_TIMEOUT_MS,
  MEDIA_STEP_TIMEOUT_MS,
  MEDIA_STREAM_TIMEOUT_MS,
  MEDIA_TOTAL_BUDGET_MS
};
