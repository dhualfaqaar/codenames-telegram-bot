import { toV2 } from './groupGamesEngine';
import type { SongSearchHit } from './mediaServicesEngine';

/**
 * 🎙️ محرك المكالمات الصوتية وقائمة التشغيل الذكية في القنوات والمجموعات
 *
 * - أمر: «تشغيل + اسم الأغنية»
 * - يثبّت الأغنية الشغّالة حالياً دون قطعها، ويضيف الأغاني الجديدة بالترتيب في قائمة الانتظار.
 * - ينتقل تلقائياً للأغنية التالية فور انتهاء مدة الأغنية الحالية.
 * - أزرار التحكم (⏮️ رجوع | ⏸️ توقيف / ▶️ تشغيل | ⏭️ تقديم) مقفولة حصرياً لصاحب الأمر الأصلي.
 * - التوقيف يحفظ الثانية الدقيقة التي توقفت عندها الأغنية ويكمل منها تماماً عند الاستئناف.
 */

export interface QueuedTrack {
  id: string;
  hit: SongSearchHit;
  title: string;
  artist: string;
  durationLabel: string;
  durationSec: number;
  streamUrl?: string;
}

export interface MusicCallSession {
  chatId: string;
  chatTitle: string;
  /** معرف صاحب الأمر المسموح له وحده باستخدام الأزرار (فقط هو!) */
  ownerId: string;
  ownerName: string;
  ownerSignature?: string;
  status: 'playing' | 'paused' | 'ended';
  current: QueuedTrack | null;
  queue: QueuedTrack[];
  history: QueuedTrack[];
  /** الثانية المتراكمة قبل آخر إيقاف مؤقت */
  elapsedBeforePauseSec: number;
  /** لحظة بدء/استئناف التشغيل بالملي ثانية */
  startedAtMs: number;
  /** الموعد التلقائي لانتهاء الأغنية الحالية والانتقال للي بعدها */
  trackEndAt?: number;
  /** رقم رسالة لوحة التحكم الحية في القناة/الكروب */
  controlMessageId?: number;
  createdAt: number;
}

export function formatSecMMSS(secRaw: number): string {
  const s = Math.max(0, Math.floor(secRaw));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * يقص بايتات ملف MP3 بدقة عند أقرب إطار صوتي متزامن (MPEG Frame Sync 0xFF 0xE0)
 * ليبدأ التشغيل فعلياً من الثانية التي أُوقِفت عندها الأغنية تماماً دون الحاجة لـ FFmpeg!
 */
export function sliceMp3BytesFromOffset(
  bytes: Uint8Array,
  offsetSec: number,
  totalDurationSec: number
): Uint8Array {
  if (offsetSec <= 1 || totalDurationSec <= 2 || bytes.byteLength < 8192) {
    return bytes;
  }
  let audioStart = 0;
  // تخطي ترويسة ID3v2 إن وُجدت في بداية الملف
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.byteLength > 10) {
    const id3Size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    audioStart = Math.min(bytes.byteLength - 4096, 10 + id3Size);
  }

  const audioLen = Math.max(1, bytes.byteLength - audioStart);
  const ratio = Math.min(0.95, Math.max(0, offsetSec / totalDurationSec));
  let pos = audioStart + Math.floor(ratio * audioLen);

  // محاذاة المؤشر مع أول ترويسة إطار MPEG صالح (11-bit sync word)
  const scanLimit = Math.min(bytes.byteLength - 4, pos + 8192);
  while (pos < scanLimit) {
    if (bytes[pos] === 0xff && (bytes[pos + 1] & 0xe0) === 0xe0 && (bytes[pos + 1] & 0x06) !== 0x00) {
      break;
    }
    pos += 1;
  }

  return bytes.byteLength - pos > 2048 ? bytes.subarray(pos) : bytes;
}

export function getCurrentElapsedSec(session: MusicCallSession, now = Date.now()): number {
  if (!session.current) return 0;
  const raw =
    session.status === 'playing'
      ? session.elapsedBeforePauseSec + Math.max(0, (now - session.startedAtMs) / 1000)
      : session.elapsedBeforePauseSec;
  return Math.min(session.current.durationSec, Math.max(0, Math.floor(raw)));
}

function buildProgressBar(elapsed: number, total: number): string {
  const safeTotal = Math.max(1, total);
  const ratio = Math.min(1, Math.max(0, elapsed / safeTotal));
  const slots = 10;
  const pos = Math.min(slots - 1, Math.round(ratio * (slots - 1)));
  let bar = '';
  for (let i = 0; i < slots; i++) {
    bar += i === pos ? '🔘' : i < pos ? '━' : '─';
  }
  return `${formatSecMMSS(elapsed)} ${bar} ${formatSecMMSS(safeTotal)}`;
}

export function createMusicCallSession(
  chatId: string,
  chatTitle: string,
  ownerId: string,
  ownerName: string,
  firstTrack: QueuedTrack,
  ownerSignature?: string,
  now = Date.now()
): MusicCallSession {
  return {
    chatId,
    chatTitle,
    ownerId,
    ownerName: (ownerName || 'مشرف القناة').trim().slice(0, 40),
    ownerSignature,
    status: 'playing',
    current: firstTrack,
    queue: [],
    history: [],
    elapsedBeforePauseSec: 0,
    startedAtMs: now,
    trackEndAt: now + firstTrack.durationSec * 1000,
    createdAt: now
  };
}

/** يضيف أغنية جديدة للانتظار بالترتيب دون قطع الأغنية الشغّالة أبداً */
export function enqueueTrackSmart(session: MusicCallSession, track: QueuedTrack): number {
  session.queue.push(track);
  return session.queue.length;
}

/** تبديل التوقيف المؤقت / الاستئناف من نفس الثانية بالضبط */
export function togglePauseMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { status: 'playing' | 'paused'; atSec: number } {
  if (!session.current) return { status: 'paused', atSec: 0 };

  if (session.status === 'playing') {
    const atSec = getCurrentElapsedSec(session, now);
    const clamped = Math.min(Math.max(0, session.current.durationSec - 1), atSec);
    session.elapsedBeforePauseSec = clamped;
    session.status = 'paused';
    session.trackEndAt = undefined;
    return { status: 'paused', atSec: clamped };
  }

  const resumeFrom = Math.min(Math.max(0, session.current.durationSec - 2), session.elapsedBeforePauseSec);
  const remainingSec = Math.max(3, session.current.durationSec - resumeFrom);
  session.elapsedBeforePauseSec = resumeFrom;
  session.startedAtMs = now;
  session.status = 'playing';
  session.trackEndAt = now + remainingSec * 1000;
  return { status: 'playing', atSec: resumeFrom };
}

/** تقديم للأغنية التالية في قائمة الانتظار */
export function skipNextMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { ok: boolean; track?: QueuedTrack; reason?: string } {
  if (!session.queue.length) {
    return { ok: false, reason: 'ℹ️ ماكو أغنية تالية بقائمة الانتظار حالياً!' };
  }
  if (session.current) {
    session.history.push(session.current);
    if (session.history.length > 25) session.history.shift();
  }
  const next = session.queue.shift()!;
  session.current = next;
  session.status = 'playing';
  session.elapsedBeforePauseSec = 0;
  session.startedAtMs = now;
  session.trackEndAt = now + next.durationSec * 1000;
  return { ok: true, track: next };
}

/** رجوع للأغنية السابقة مع إبقاء الأغنية الحالية بأول قائمة الانتظار حتى لا يضيع الترتيب */
export function stepPrevMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { ok: boolean; track?: QueuedTrack; restartedSame?: boolean; reason?: string } {
  if (!session.history.length) {
    if (session.current && getCurrentElapsedSec(session, now) > 5) {
      session.elapsedBeforePauseSec = 0;
      session.startedAtMs = now;
      session.status = 'playing';
      session.trackEndAt = now + session.current.durationSec * 1000;
      return { ok: true, track: session.current, restartedSame: true };
    }
    return { ok: false, reason: 'ℹ️ ماكو أغنية سابقة للرجوع إليها!' };
  }

  const prev = session.history.pop()!;
  if (session.current) {
    session.queue.unshift(session.current);
  }
  session.current = prev;
  session.status = 'playing';
  session.elapsedBeforePauseSec = 0;
  session.startedAtMs = now;
  session.trackEndAt = now + prev.durationSec * 1000;
  return { ok: true, track: prev };
}

/** الانتقال التلقائي عند انتهاء مدة الأغنية الشغّالة */
export function advanceMusicOnTrackEnd(
  session: MusicCallSession,
  now = Date.now()
): { startedNext: QueuedTrack | null; finishedAll: boolean } {
  if (session.current) {
    session.history.push(session.current);
    if (session.history.length > 25) session.history.shift();
  }
  if (session.queue.length > 0) {
    const next = session.queue.shift()!;
    session.current = next;
    session.status = 'playing';
    session.elapsedBeforePauseSec = 0;
    session.startedAtMs = now;
    session.trackEndAt = now + next.durationSec * 1000;
    return { startedNext: next, finishedAll: false };
  }

  session.current = null;
  session.status = 'ended';
  session.trackEndAt = undefined;
  return { startedNext: null, finishedAll: true };
}

/** رسم لوحة البث والمكالمة الصوتية بصيغة MarkdownV2 سليمة 100٪ مع وضع اسم صاحب الأمر داخل اقتباس */
export function renderMusicCallView(
  session: MusicCallSession,
  now = Date.now()
): { text: string; keyboard: any[][] } {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const ownerQuote = `> | *${session.ownerName}* |`;

  if (session.status === 'ended' || !session.current) {
    const endedRaw =
      `🎙️ *انتهى البث الصوتي في المكالمة*\n` +
      `${SEP}\n` +
      `👤 *المتحكم بالجلسة:*\n${ownerQuote}\n\n` +
      `✅ اكتمل تشغيل جميع الأغاني في قائمة الانتظار بالترتيب.\n` +
      `💡 للتشغيل من جديد أرسل: *تشغيل + اسم الأغنية*`;
    return { text: toV2(endedRaw), keyboard: [] };
  }

  const cur = session.current;
  const elapsed = getCurrentElapsedSec(session, now);
  const stateLine =
    session.status === 'playing'
      ? `🔴 *الحالة:* يصعد البوت بالمكالمة ويشغّل الآن`
      : `⏸️ *الحالة:* متوقفة مؤقتاً عند الدقيقة *${formatSecMMSS(elapsed)}*`;

  const queueBlock =
    session.queue.length > 0
      ? `\n📋 *قائمة الانتظار بالترتيب (${session.queue.length}):*\n` +
        session.queue
          .slice(0, 6)
          .map((q, idx) => `${idx + 1}. 🎵 ${q.title} (${q.durationLabel})`)
          .join('\n') +
        (session.queue.length > 6 ? `\n… +${session.queue.length - 6} أغاني أخرى بالترتيب` : '')
      : `\n📋 *قائمة الانتظار:* فارغة — أرسل «تشغيل + اسم أغنية» لإضافتها بالترتيب دون قطع الأغنية الحالية`;

  const raw =
    `🎙️ *مشغّل المكالمة الصوتية والبث المباشر*\n` +
    `${SEP}\n` +
    `${stateLine}\n` +
    `🎵 *الأغنية الشغّالة:* ${cur.title}\n` +
    `🎤 *الفنان:* ${cur.artist}\n` +
    `⏱️ *المؤشر:* ${buildProgressBar(elapsed, cur.durationSec)}\n\n` +
    `👤 *صاحب الأمر والمتحكم الوحيد:*\n${ownerQuote}` +
    `${queueBlock}\n` +
    `${SEP}\n` +
    `⚠️ _ملاحظة: تأكد من منح البوت صلاحية «إدارة البثوث المباشرة» في القناة/الكروب._`;

  const middleBtn =
    session.status === 'playing'
      ? { text: '⏸️ توقيف', callback_data: `mcall:toggle:${session.chatId}` }
      : { text: `▶️ تشغيل (${formatSecMMSS(elapsed)})`, callback_data: `mcall:toggle:${session.chatId}` };

  const keyboard = [
    [
      { text: '⏮️ رجوع', callback_data: `mcall:prev:${session.chatId}` },
      middleBtn,
      { text: '⏭️ تقديم', callback_data: `mcall:next:${session.chatId}` }
    ]
  ];

  return { text: toV2(raw), keyboard };
}
