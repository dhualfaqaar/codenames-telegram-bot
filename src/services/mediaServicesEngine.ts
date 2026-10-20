/**
 * ✨ محرك الخدمات الإضافية للبوت:
 *   1. 🤫 نظام الهمسات السرية المتكامل (لشخص، شخصين، ٣، ٤، ٥، للجميع، ولأول شخص فقط مع قفل فوري وإشعار خاص لصاحب الهمسة)
 *   2. 📥 التحميل من السوشيال ميديا (يوتيوب، بنترست، تيك توك، إنستغرام)
 *   3. 🎵 البحث وتحميل الأغاني بأمر «يوت <اسم الأغنية>» بالخاص والكروبات والقنوات
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// =====================================================================
// 1) 🤫 نظام الهمسات السرية (Whisper Engine)
// =====================================================================

export type WhisperMode = '1' | '2' | '3' | '4' | '5' | 'all' | 'first';

export interface WhisperViewer {
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
  mode: WhisperMode;
  text: string;
  /** يوزرات أو آيديات مستهدفة اختيارية (بدون @ وبحروف صغيرة) */
  allowedTargets: string[];
  openedBy: WhisperViewer[];
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
      return '👤 لشخص واحد';
    case '2':
      return '👥 لشخصين';
    case '3':
      return '👥 لـ ٣ أشخاص';
    case '4':
      return '👥 لـ ٤ أشخاص';
    case '5':
      return '👥 لـ ٥ أشخاص';
    case 'all':
      return '🌍 للجميع';
    case 'first':
      return '⚡ لأول شخص فقط (تقفل بعده)';
  }
}

export function whisperMaxCount(mode: WhisperMode): number | null {
  if (mode === 'first') return 1;
  if (mode === 'all') return null;
  const n = parseInt(mode, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function normalizeTargetToken(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

export function parseWhisperTargets(input: string, maxCount: number): string[] {
  const parts = String(input || '')
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
  const id =
    Date.now().toString(36).slice(-5) +
    Math.random().toString(36).substring(2, 6);
  return {
    id,
    creatorId: String(opts.creatorId),
    creatorName: opts.creatorName || 'مستخدم',
    creatorUsername: opts.creatorUsername,
    mode: opts.mode,
    text: String(opts.text || '').trim().slice(0, 190),
    allowedTargets: opts.allowedTargets || [],
    openedBy: [],
    locked: false,
    createdAt: Date.now()
  };
}

export function renderWhisperCardText(wh: WhisperRecord): string {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const senderBlockquote = `> \\| *${mdV2Escape(wh.creatorName || 'مستخدم')}* \\|`;
  if (wh.locked) {
    return (
      `🔒 *همسة مغلقة*\n` +
      `${SEP}\n` +
      `${senderBlockquote}\n` +
      `🔐 *النوع:* ${mdV2Escape(whisperModeLabel(wh.mode))}\n` +
      `⛔ تم فتح الهمسة وانتهت صلاحية مشاهدتها\\.`
    );
  }

  const targetLine =
    wh.allowedTargets.length > 0
      ? `\n🎯 *موجّهة إلى:* ${wh.allowedTargets.map(t => (/^\d+$/.test(t) ? mdV2Escape(t) : `@${mdV2Escape(t)}`)).join(' ، ')}`
      : '';

  return (
    `🤫 *همسة سرية*\n` +
    `${SEP}\n` +
    `${senderBlockquote}\n` +
    `🔐 *النوع:* ${mdV2Escape(whisperModeLabel(wh.mode))}${targetLine}\n` +
    `👇 اضغط الزر بالأسفل لقراءة الهمسة سرّاً`
  );
}

export function whisperCardKeyboard(wh: WhisperRecord): any[][] {
  if (wh.locked) {
    return [[{ text: '🔒 تم فتح الهمسة وإغلاقها', callback_data: `wh:open:${wh.id}` }]];
  }
  return [[{ text: '🤫 فتح الهمسة', callback_data: `wh:open:${wh.id}` }]];
}

export interface OpenWhisperResult {
  allowed: boolean;
  popupText: string;
  justLocked: boolean;
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
      shouldNotifyCreator: false
    };
  }

  // إذا مقفولة مسبقاً → لا يقدر أي شخص يفتحها بعد الآن
  if (wh.locked) {
    return {
      allowed: false,
      popupText: '🔒 عذراً، هذه الهمسة انفتحت وانقفلت نهائياً — ما يقدر أحد يشوفها بعد!',
      justLocked: false,
      shouldNotifyCreator: false
    };
  }

  // التحقق من قائمة المستهدفين إذا حدّد صاحب الهمسة أشخاصاً معيّنين
  if (wh.allowedTargets.length > 0 && viewerId !== wh.creatorId) {
    const matched =
      wh.allowedTargets.includes(viewerId.toLowerCase()) ||
      (viewerUname !== '' && wh.allowedTargets.includes(viewerUname));
    if (!matched) {
      return {
        allowed: false,
        popupText: '🚫 هذه الهمسة خاصة ومو موجّهة إلك!',
        justLocked: false,
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
    // إذا كانت محددة بعدد أشخاص بدون يوزرات (أول N أشخاص) تقفل عند اكتمال العدد
    wh.locked = true;
    justLocked = true;
  }

  return {
    allowed: true,
    popupText: `🤫 محتوى الهمسة:\n\n${wh.text}`,
    justLocked,
    shouldNotifyCreator: true
  };
}

function mdV2Escape(s: string): string {
  return String(s || '').replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
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
// 2) 🎵 البحث عن الأغاني («يوت») وتحميل الصوت MP3 / M4A
// =====================================================================

export interface SongSearchHit {
  videoId: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
}

function cleanSongTitle(raw: string): string {
  return String(raw || '')
    .replace(/\s*[\(\[](official\s*(music\s*)?video|official\s*audio|lyrics?|حصرياً?|نسخة أصلية|4k|hd|hq)[\)\]]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** البحث عن أقرب الأغاني عبر يوتيوب + بدائل Piped / Invidious */
export async function searchSongs(query: string, limit = 5): Promise<SongSearchHit[]> {
  const q = String(query || '').trim();
  if (!q) return [];

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
          videoId: v.videoId,
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

  // 1) البحث المباشر عبر واجهة YouTube JSON الرسمية (سريعة جداً من Cloudflare Workers وبدون جدار ملفات تعريف الارتباط)
  try {
    const apiRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20250101.00.00',
            hl: 'ar',
            gl: 'IQ'
          }
        },
        query: q
      })
    });
    if (apiRes.ok) {
      const apiJson = await apiRes.json();
      const apiHits = extractHitsFromYtJson(apiJson);
      if (apiHits.length) return apiHits;
    }
  } catch {
    // ننتقل للمحاولة التالية
  }

  // 2) البحث عبر صفحة نتائج يوتيوب المباشرة
  try {
    const res = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=ar`,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
        }
      }
    );
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});<\/script>/s);
      if (match) {
        const json = JSON.parse(match[1]);
        const hits = extractHitsFromYtJson(json);
        if (hits.length) return hits;
      }
    }
  } catch {
    // ننتقل للبدائل تلقائياً
  }

  // 2) بدائل Piped / Invidious العامة
  const pipedInstances = [
    'https://pipedapi.adminforge.de',
    'https://api.piped.private.coffee',
    'https://pipedapi.kavin.rocks'
  ];
  for (const base of pipedInstances) {
    try {
      const res = await fetch(`${base}/search?q=${encodeURIComponent(q)}&filter=videos`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const items: any[] = data?.items || [];
      const hits: SongSearchHit[] = [];
      for (const it of items) {
        const vidMatch = String(it?.url || '').match(/v=([a-zA-Z0-9_-]{11})/);
        if (!vidMatch) continue;
        const sec = Number(it?.duration || 0);
        if (sec <= 0 || sec > 3600) continue;
        const mins = Math.floor(sec / 60);
        const rem = String(sec % 60).padStart(2, '0');
        hits.push({
          videoId: vidMatch[1],
          title: cleanSongTitle(it.title || q),
          artist: it.uploaderName || 'فنان',
          duration: `${mins}:${rem}`,
          thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${vidMatch[1]}/hqdefault.jpg`
        });
        if (hits.length >= limit) return hits;
      }
      if (hits.length) return hits;
    } catch {
      continue;
    }
  }

  return [];
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/** استخراج رابط تحميل مباشر (MP3 أو MP4) عبر محرك OceanSaver / Loader متعدد الخوادم */
async function extractViaOceanSaver(targetUrl: string, format: 'mp3' | 'm4a' | '720' | '360'): Promise<string | null> {
  try {
    const initUrl =
      `https://p.oceansaver.in/ajax/download.php?button=1&start=1&end=1&format=${format}` +
      `&iframe_source=direct-iframe&url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(initUrl, { headers: { 'User-Agent': BROWSER_UA } });
    if (!res.ok) return null;
    const initData: any = await res.json();
    const jobId = initData?.id;
    if (!jobId) return null;

    for (let attempt = 0; attempt < 9; attempt++) {
      await sleep(attempt === 0 ? 500 : 900);
      const pRes = await fetch(`https://p.oceansaver.in/api/progress?id=${encodeURIComponent(jobId)}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (!pRes.ok) continue;
      const pData: any = await pRes.json();
      if (pData?.download_url) return String(pData.download_url);
      if (pData?.text && String(pData.text).toLowerCase().includes('error')) return null;
      if (Number(pData?.progress) >= 1000 && !pData?.download_url) return null;
    }
  } catch {
    return null;
  }
  return null;
}

/** استخراج صوت أو فيديو عبر محرك FabDL الاحتياطي */
async function extractViaFabDL(youtubeUrl: string, mode: 'audio' | 'video'): Promise<string | null> {
  try {
    const infoRes = await fetch(
      `https://api.fabdl.com/youtube/get?url=${encodeURIComponent(youtubeUrl)}`,
      { headers: { 'User-Agent': BROWSER_UA } }
    );
    if (!infoRes.ok) return null;
    const info: any = await infoRes.json();
    const gid = info?.result?.gid;
    const tasks: any[] = info?.result?.audios || info?.result?.videos || [];
    if (!gid) return null;

    if (mode === 'audio') {
      const taskRes = await fetch(`https://api.fabdl.com/youtube/mp3_convert_task/${gid}/${info.result.id}`, {
        headers: { 'User-Agent': BROWSER_UA }
      });
      if (taskRes.ok) {
        const td: any = await taskRes.json();
        if (td?.result?.download_url) {
          const dl = String(td.result.download_url);
          return dl.startsWith('http') ? dl : `https://api.fabdl.com${dl}`;
        }
      }
    } else if (tasks.length) {
      const best = tasks.find((v: any) => v.height === 720 || v.height === 360) || tasks[0];
      if (best?.id) {
        const vRes = await fetch(`https://api.fabdl.com/youtube/mp4_convert_task/${gid}/${best.id}`, {
          headers: { 'User-Agent': BROWSER_UA }
        });
        if (vRes.ok) {
          const vd: any = await vRes.json();
          if (vd?.result?.download_url) {
            const dl = String(vd.result.download_url);
            return dl.startsWith('http') ? dl : `https://api.fabdl.com${dl}`;
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** استخراج عبر YouTube Innertube ANDROID_VR + Piped + Invidious */
async function extractViaInnertubeOrPiped(videoId: string, mode: 'audio' | 'video'): Promise<{ url: string; mime: string } | null> {
  // 1) Innertube ANDROID_VR
  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.60.19',
            androidSdkVersion: 32,
            hl: 'ar',
            gl: 'US'
          }
        }
      })
    });
    if (playerRes.ok) {
      const pJson: any = await playerRes.json();
      const adaptive: any[] = pJson?.streamingData?.adaptiveFormats || [];
      const muxed: any[] = pJson?.streamingData?.formats || [];
      if (mode === 'audio') {
        const audio =
          adaptive.find(f => f.itag === 140 && f.url) ||
          adaptive.find(f => String(f.mimeType || '').startsWith('audio/mp4') && f.url) ||
          adaptive.find(f => String(f.mimeType || '').startsWith('audio/') && f.url);
        if (audio?.url) return { url: audio.url, mime: 'audio/mp4' };
      } else {
        const vid =
          muxed.find(f => f.itag === 22 && f.url) ||
          muxed.find(f => f.itag === 18 && f.url) ||
          muxed.find(f => f.url);
        if (vid?.url) return { url: vid.url, mime: 'video/mp4' };
      }
    }
  } catch {
    // continue
  }

  // 2) Piped public cluster
  for (const base of ['https://pipedapi.adminforge.de', 'https://api.piped.private.coffee', 'https://pipedapi.kavin.rocks']) {
    try {
      const r = await fetch(`${base}/streams/${videoId}`, { headers: { 'User-Agent': BROWSER_UA } });
      if (!r.ok) continue;
      const d: any = await r.json();
      if (mode === 'audio') {
        const streams: any[] = d?.audioStreams || [];
        const pick = streams.find(s => String(s.mimeType || '').includes('mp4') && s.url) || streams[0];
        if (pick?.url) return { url: pick.url, mime: 'audio/mp4' };
      } else {
        const streams: any[] = (d?.videoStreams || []).filter((s: any) => !s.videoOnly && s.url);
        if (streams[0]?.url) return { url: streams[0].url, mime: 'video/mp4' };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** استخراج ملف الصوت للأغنية المختارة */
export async function resolveSongAudioUrl(videoId: string): Promise<{ url: string; ext: 'mp3' | 'm4a' } | null> {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // المحرك ١: MP3 مباشر عالي التوافق مع تيليجرام
  const mp3 = await extractViaOceanSaver(ytUrl, 'mp3');
  if (mp3) return { url: mp3, ext: 'mp3' };

  // المحرك ٢: FabDL MP3
  const fab = await extractViaFabDL(ytUrl, 'audio');
  if (fab) return { url: fab, ext: 'mp3' };

  // المحرك ٣: Innertube / Piped M4A
  const inner = await extractViaInnertubeOrPiped(videoId, 'audio');
  if (inner?.url) return { url: inner.url, ext: 'm4a' };

  return null;
}

// =====================================================================
// 3) 📥 محرك التحميل من السوشيال ميديا (YouTube / Pinterest / TikTok / Instagram)
// =====================================================================

export type SocialPlatform = 'yt' | 'pin' | 'tt' | 'ig';

export interface DownloadedMediaItem {
  kind: 'video' | 'photo';
  url: string;
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

/** 🎵 تحميل من تيك توك بدون علامة مائية (فيديو أو ألبوم صور) */
async function downloadTikTok(url: string): Promise<SocialDownloadResult> {
  // 1) TikWM Public API
  try {
    const form = new URLSearchParams();
    form.set('url', url);
    form.set('hd', '1');
    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': BROWSER_UA
      },
      body: form.toString()
    });
    if (res.ok) {
      const json: any = await res.json();
      const d = json?.data;
      if (json?.code === 0 && d) {
        if (Array.isArray(d.images) && d.images.length > 0) {
          return {
            ok: true,
            title: d.title || '',
            items: d.images.slice(0, 10).map((img: string) => ({ kind: 'photo' as const, url: img }))
          };
        }
        const rawVid = d.hdplay || d.play || d.wmplay;
        if (rawVid) {
          const fullUrl = String(rawVid).startsWith('http') ? String(rawVid) : `https://www.tikwm.com${rawVid}`;
          return { ok: true, title: d.title || '', items: [{ kind: 'video', url: fullUrl }] };
        }
      }
    }
  } catch {
    // fallback below
  }

  // 2) LoveTik Public API fallback
  try {
    const form = new URLSearchParams({ query: url });
    const res = await fetch('https://lovetik.com/api/ajax/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': BROWSER_UA },
      body: form.toString()
    });
    if (res.ok) {
      const d: any = await res.json();
      const best = (d?.links || []).find((l: any) => l?.a && !String(l.t || '').includes('MP3')) || d?.links?.[0];
      if (best?.a) {
        return { ok: true, title: d.desc || '', items: [{ kind: 'video', url: String(best.a) }] };
      }
    }
  } catch {
    // fallback below
  }

  const os = await extractViaOceanSaver(url, '720');
  if (os) return { ok: true, items: [{ kind: 'video', url: os }] };

  return { ok: false, items: [], error: 'تعذّر تحميل منشور تيك توك — تأكد أن الرابط عام وصحيح.' };
}

/** 📌 تحميل من بنترست (يدعم روابط pin.it المختصرة والفيديوهات والصور الأصلية عالية الدقة) */
async function downloadPinterest(url: string): Promise<SocialDownloadResult> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
      }
    });
    if (res.ok) {
      const html = await res.text();
      // فحص الفيديو عالي الدقة MP4 أولاً
      const mp4Matches = html.match(/https:\/\/v\d*\.pinimg\.com\/videos\/[^"'\s\\]+\.mp4/g);
      if (mp4Matches && mp4Matches.length > 0) {
        const bestMp4 =
          mp4Matches.find(u => u.includes('720w') || u.includes('expMp4')) || mp4Matches[0];
        return { ok: true, items: [{ kind: 'video', url: bestMp4 }] };
      }

      // فحص الصورة الأصلية عالية الجودة
      const origImg = html.match(/https:\/\/i\.pinimg\.com\/originals\/[^"'\s\\]+\.(?:jpg|jpeg|png|webp)/i);
      if (origImg?.[0]) {
        return { ok: true, items: [{ kind: 'photo', url: origImg[0] }] };
      }

      const ogImg =
        html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
      if (ogImg) {
        return { ok: true, items: [{ kind: 'photo', url: ogImg }] };
      }
    }
  } catch {
    // fallback below
  }

  const os = await extractViaOceanSaver(url, '720');
  if (os) return { ok: true, items: [{ kind: 'video', url: os }] };

  return { ok: false, items: [], error: 'تعذّر استخراج المنشور من بنترست — تأكد من إرسال رابط المنشور الصحيح.' };
}

/** 📸 تحميل من إنستغرام (Reels / Posts / صور وفيديوهات) */
async function downloadInstagram(url: string): Promise<SocialDownloadResult> {
  const scMatch = String(url || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  const shortcode = scMatch ? scMatch[1] : '';

  // 1) GraphQL العام لإنستغرام
  if (shortcode) {
    try {
      const gqlUrl =
        `https://www.instagram.com/graphql/query/?doc_id=8845758582119845` +
        `&variables=${encodeURIComponent(JSON.stringify({ shortcode, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null }))}`;
      const r = await fetch(gqlUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'X-IG-App-ID': '936619743392459',
          Accept: '*/*'
        }
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
      // continue to next provider
    }

    // 2) وسطاء العرض المباشر (kkinstagram / ddinstagram) لتيليجرام
    for (const host of ['kkinstagram.com', 'ddinstagram.com']) {
      try {
        const proxyUrl = `https://www.${host}/p/${shortcode}/`;
        const r = await fetch(proxyUrl, {
          headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' },
          redirect: 'follow'
        });
        if (!r.ok) continue;
        const html = await r.text();
        const vidUrl =
          html.match(/property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:video["']/i)?.[1];
        if (vidUrl && vidUrl.startsWith('http')) {
          return { ok: true, items: [{ kind: 'video', url: vidUrl.replace(/&amp;/g, '&') }] };
        }
        const imgUrl =
          html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] ||
          html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i)?.[1];
        if (imgUrl && imgUrl.startsWith('http')) {
          return { ok: true, items: [{ kind: 'photo', url: imgUrl.replace(/&amp;/g, '&') }] };
        }
      } catch {
        continue;
      }
    }

    // 3) صفحة Embed الرسمية
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

  const os = await extractViaOceanSaver(url, '720');
  if (os) return { ok: true, items: [{ kind: 'video', url: os }] };

  return { ok: false, items: [], error: 'تعذّر تحميل منشور إنستغرام — تأكد أن الحساب عام والرابط صحيح.' };
}

/** ▶️ تحميل فيديو من يوتيوب (عادي أو Shorts) */
async function downloadYouTube(url: string): Promise<SocialDownloadResult> {
  const vid = extractYoutubeVideoId(url);
  const cleanUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : url;

  const mp4 = (await extractViaOceanSaver(cleanUrl, '720')) || (await extractViaOceanSaver(cleanUrl, '360'));
  if (mp4) return { ok: true, items: [{ kind: 'video', url: mp4 }] };

  const fab = await extractViaFabDL(cleanUrl, 'video');
  if (fab) return { ok: true, items: [{ kind: 'video', url: fab }] };

  if (vid) {
    const inner = await extractViaInnertubeOrPiped(vid, 'video');
    if (inner?.url) return { ok: true, items: [{ kind: 'video', url: inner.url }] };
  }

  return { ok: false, items: [], error: 'تعذّر تحميل الفيديو من يوتيوب — تأكد من الرابط أو جرّب مقطعاً أقصر.' };
}

export async function downloadFromPlatform(platform: SocialPlatform, rawUrl: string): Promise<SocialDownloadResult> {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, items: [], error: '⚠️ يرجى إرسال رابط صحيح يبدأ بـ https://' };
  }
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
