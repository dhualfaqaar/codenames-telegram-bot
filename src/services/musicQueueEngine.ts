import { toV2 } from './groupGamesEngine';
import type { SongSearchHit } from './mediaServicesEngine';

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
  inviteLink?: string;
  ownerId: string;
  ownerName: string;
  ownerSignature?: string;
  status: 'playing' | 'paused' | 'ended';
  current: QueuedTrack | null;
  queue: QueuedTrack[];
  history: QueuedTrack[];
  elapsedBeforePauseSec: number;
  startedAtMs: number;
  trackEndAt?: number;
  controlMessageId?: number;
  actionSeq: number;
  createdAt: number;
}

export function formatSecMMSS(secRaw: number): string {
  const s = Math.max(0, Math.floor(secRaw));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function sliceMp3BytesFromOffset(
  bytes: Uint8Array,
  offsetSec: number,
  totalDurationSec: number
): Uint8Array {
  if (offsetSec <= 1 || totalDurationSec <= 2 || bytes.byteLength < 8192) {
    return bytes;
  }
  let audioStart = 0;
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
    actionSeq: 1,
    createdAt: now
  };
}

export function enqueueTrackSmart(session: MusicCallSession, track: QueuedTrack): number {
  session.queue.push(track);
  return session.queue.length;
}

export function togglePauseMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { status: 'playing' | 'paused'; atSec: number } {
  if (!session.current) return { status: 'paused', atSec: 0 };
  session.actionSeq = (session.actionSeq || 0) + 1;

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

export function skipNextMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { ok: boolean; track?: QueuedTrack; reason?: string } {
  if (!session.queue.length) {
    return { ok: false, reason: 'ماكو أغنية تالية بالانتظار!' };
  }
  session.actionSeq = (session.actionSeq || 0) + 1;
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

export function stepPrevMusicSession(
  session: MusicCallSession,
  now = Date.now()
): { ok: boolean; track?: QueuedTrack; restartedSame?: boolean; reason?: string } {
  if (!session.history.length) {
    if (session.current && getCurrentElapsedSec(session, now) > 5) {
      session.actionSeq = (session.actionSeq || 0) + 1;
      session.elapsedBeforePauseSec = 0;
      session.startedAtMs = now;
      session.status = 'playing';
      session.trackEndAt = now + session.current.durationSec * 1000;
      return { ok: true, track: session.current, restartedSame: true };
    }
    return { ok: false, reason: 'ماكو أغنية سابقة!' };
  }

  session.actionSeq = (session.actionSeq || 0) + 1;
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

export function advanceMusicOnTrackEnd(
  session: MusicCallSession,
  now = Date.now()
): { startedNext: QueuedTrack | null; finishedAll: boolean } {
  session.actionSeq = (session.actionSeq || 0) + 1;
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
    return { startedNext: next, finishedAll: true && false };
  }

  session.current = null;
  session.status = 'ended';
  session.trackEndAt = undefined;
  return { startedNext: null, finishedAll: true };
}

export function renderMusicCallView(
  session: MusicCallSession,
  now = Date.now(),
  assistantConnected = false
): { text: string; keyboard: any[][] } {
  const SEP = '━━━━━━━━━━━━━━━━━━━';
  const ownerQuote = `> | *${session.ownerName}* |`;

  if (session.status === 'ended' || !session.current) {
    const endedRaw =
      `🎙️ *انتهى التشغيل*\n` +
      `${SEP}\n` +
      `👤 *بأمر:*\n${ownerQuote}`;
    return { text: toV2(endedRaw), keyboard: [] };
  }

  const cur = session.current;
  const elapsed = getCurrentElapsedSec(session, now);
  const stateLine =
    session.status === 'playing'
      ? assistantConnected
        ? `🔴 *في المكالمة الآن*`
        : `▶️ *قيد التشغيل الآن*`
      : `⏸️ *متوقفة عند ${formatSecMMSS(elapsed)}*`;

  const queueBlock =
    session.queue.length > 0
      ? `\n\n📋 *التالية (${session.queue.length}):*\n` +
        session.queue
          .slice(0, 5)
          .map((q, idx) => `${idx + 1}. 🎵 ${q.title} (${q.durationLabel})`)
          .join('\n')
      : '';

  const raw =
    `🎙️ *المشغّل الصوتي* — ${stateLine}\n` +
    `${SEP}\n` +
    `🎵 *${cur.title}* — ${cur.artist}\n` +
    `⏱️ ${buildProgressBar(elapsed, cur.durationSec)}\n` +
    `👤 *بأمر:*\n${ownerQuote}` +
    `${queueBlock}`;

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
