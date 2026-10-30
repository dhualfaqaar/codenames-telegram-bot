/**
 * Resilience helpers for the social-media downloaders.
 *
 * The downloaders talk to a lot of third-party mirrors. Without a clock they can
 * hang forever, and one dead mirror used to look exactly like "your link is
 * wrong". This module adds three things every download path needs:
 *   1) a bounded fetch + `withTimeout`, so no step can hang the request;
 *   2) a provider health registry, so a dead mirror is demoted instead of being
 *      tried first on every single request;
 *   3) a parallel race for independent mirrors, so the first working one wins
 *      instead of waiting for every dead one in turn.
 */

/** Bumped with every media reliability release so /dlstatus proves what is live. */
export const MEDIA_ENGINE_BUILD = '2026-10-30-media-resolvers-first-v26';
export const MEDIA_STEP_TIMEOUT_MS = 9_000;
export const MEDIA_PROBE_TIMEOUT_MS = 6_000;
export const MEDIA_TOTAL_BUDGET_MS = 34_000;
/** Media files are big: a 20MB MP4 legitimately needs more than a JSON call. */
export const MEDIA_STREAM_TIMEOUT_MS = 20_000;
/** A resolved post stays valid this long; repeating the same link must not hit the source again. */
export const MEDIA_CACHE_TTL_MS = 15 * 60_000;
export const MEDIA_RACE_TIMEOUT_MS = 12_000;
export const PROVIDER_FAILURE_THRESHOLD = 3;
export const PROVIDER_COOLDOWN_MS = 10 * 60_000;


export type TraceEntry = {
  provider: string;
  ok: boolean;
  status?: number;
  ms: number;
  reason?: string;
  bytes?: number;
  at: number;
};

/**
 * Last few network calls of the current request, so `/dltest` can show what
 * really happened inside the Worker instead of us guessing from the outside.
 */
const TRACE_LIMIT = 120;
let traceBuffer: TraceEntry[] = [];

export function traceReset(): void {
  traceBuffer = [];
}

export function tracePush(entry: TraceEntry): void {
  if (traceBuffer.length >= TRACE_LIMIT) traceBuffer.shift();
  traceBuffer.push(entry);
}

export function traceSnapshot(): TraceEntry[] {
  return traceBuffer.slice();
}

/**
 * Only the calls this download made. The buffer is shared by every request the
 * worker handles, so a reset would erase a slower concurrent run — timestamps
 * keep each report honest instead.
 */
export function traceSnapshotSince(at: number): TraceEntry[] {
  return traceBuffer.filter(entry => entry.at >= at);
}


export type CachedMediaItem = {
  kind: 'video' | 'photo';
  url: string;
  headers?: Record<string, string>;
  oversized?: boolean;
  sizeMB?: number;
  quality?: string;
};

type CacheEntry = { exp: number; title?: string; videoId?: string; items: CachedMediaItem[] };

/**
 * Short-lived memory of resolved posts. TikTok starts answering 429 as soon as
 * the same link is retried a few times, so the second tap on a link must not
 * reach the network at all.
 */
const CACHE_LIMIT = 60;
const mediaCache = new Map<string, CacheEntry>();

export function cacheGet(key: string, now = Date.now()): CacheEntry | null {
  const entry = mediaCache.get(key);
  if (!entry) return null;
  if (entry.exp <= now) {
    mediaCache.delete(key);
    return null;
  }
  return entry;
}

export function cacheSet(key: string, entry: Omit<CacheEntry, 'exp'>, ttlMs = MEDIA_CACHE_TTL_MS): void {
  if (!entry.items.length) return;
  if (mediaCache.size >= CACHE_LIMIT) {
    const oldest = mediaCache.keys().next().value;
    if (oldest) mediaCache.delete(oldest);
  }
  mediaCache.set(key, { ...entry, exp: Date.now() + Math.max(1_000, ttlMs) });
}

export function cacheDelete(key: string): void {
  mediaCache.delete(key);
}

export function cacheClear(): void {
  mediaCache.clear();
}

export function cacheSize(): number {
  return mediaCache.size;
}

export type ProviderAttempt = {
  provider: string;
  ok: boolean;
  ms: number;
  at: number;
  reason?: string;
};

type ProviderState = {
  provider: string;
  consecutiveFailures: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  lastReason?: string;
  totalOk: number;
  totalFailed: number;
};

/** In-memory mirror health. Survives between requests for the lifetime of the worker. */
class ProviderHealthRegistry {
  private states = new Map<string, ProviderState>();

  private state(provider: string): ProviderState {
    let entry = this.states.get(provider);
    if (!entry) {
      entry = { provider, consecutiveFailures: 0, lastFailureAt: 0, lastSuccessAt: 0, totalOk: 0, totalFailed: 0 };
      this.states.set(provider, entry);
    }
    return entry;
  }

  record(provider: string, ok: boolean, reason?: string, at = Date.now()): ProviderAttempt {
    const entry = this.state(provider);
    if (ok) {
      entry.consecutiveFailures = 0;
      entry.lastSuccessAt = at;
      entry.lastReason = undefined;
      entry.totalOk += 1;
    } else {
      entry.consecutiveFailures += 1;
      entry.lastFailureAt = at;
      entry.lastReason = reason ? String(reason).slice(0, 160) : 'failed';
      entry.totalFailed += 1;
    }
    return { provider, ok, ms: 0, at, reason: entry.lastReason };
  }

  /** A mirror is parked once it failed often enough, until the cooldown runs out. */
  coolingDown(provider: string, now = Date.now()): boolean {
    const entry = this.states.get(provider);
    if (!entry || entry.consecutiveFailures < PROVIDER_FAILURE_THRESHOLD) return false;
    return now - entry.lastFailureAt < PROVIDER_COOLDOWN_MS;
  }

  /** Healthy mirrors first (most recent success wins), parked mirrors last. */
  order<T extends { name: string }>(providers: T[], now = Date.now()): T[] {
    return providers
      .map(provider => {
        const entry = this.states.get(provider.name);
        const parked = this.coolingDown(provider.name, now) ? 1 : 0;
        const failures = entry?.consecutiveFailures || 0;
        const lastSuccess = entry?.lastSuccessAt || 0;
        return { provider, score: parked * 1e6 + failures * 1e3 - lastSuccess / 1e10 };
      })
      .sort((a, b) => a.score - b.score)
      .map(item => item.provider);
  }

  snapshot(now = Date.now()) {
    return Array.from(this.states.values())
      .sort((a, b) => b.totalFailed - a.totalFailed || a.provider.localeCompare(b.provider))
      .map(entry => ({
        provider: entry.provider,
        ok: entry.totalOk,
        failed: entry.totalFailed,
        consecutiveFailures: entry.consecutiveFailures,
        coolingDown: this.coolingDown(entry.provider, now),
        lastReason: entry.lastReason || '',
        lastSuccessAt: entry.lastSuccessAt,
        lastFailureAt: entry.lastFailureAt
      }));
  }

  reset(): void {
    this.states.clear();
  }
}

export const providerHealth = new ProviderHealthRegistry();

/** Rejects with a labelled error when the task (or promise) takes too long. */
export async function withTimeout<T>(task: Promise<T> | (() => Promise<T>), ms: number, label: string): Promise<T> {
  const budget = Math.max(1, Number(ms) || MEDIA_STEP_TIMEOUT_MS);
  let timer: any = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`timeout:${label}`), { code: 'timeout', label })), budget);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  try {
    return await Promise.race([typeof task === 'function' ? task() : task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** fetch() with a deadline and mirror health tracking, so nothing can hang a request. */
export async function boundedFetch(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = MEDIA_STEP_TIMEOUT_MS,
  label = ''
): Promise<Response> {
  const url = String(typeof input === 'string' ? input : input.toString());
  const host = (() => { try { return new URL(url).host; } catch { return label || url.slice(0, 40); } })();
  const started = Date.now();
  const budget = Math.max(1, Number(timeoutMs) || MEDIA_STEP_TIMEOUT_MS);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: any = 0;
  // Abort the socket *and* race a hard deadline: some hosts stream headers then
  // stall, and an abort that fetch ignores must still free the request.
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try { controller?.abort(); } catch { /* ignore */ }
      reject(Object.assign(new Error(`timeout:${host}`), { code: 'timeout', label: host }));
    }, budget);
    if (timer && typeof timer.unref === 'function') timer.unref();
  });
  try {
    const response = await Promise.race([
      fetch(url, { ...init, ...(controller ? { signal: controller.signal } : {}) }),
      deadline
    ]);
    // 5xx / 429 mean the mirror is unhealthy, not that the link is wrong.
    const healthy = response.ok || (response.status !== 429 && response.status < 500);
    providerHealth.record(host, healthy, healthy ? undefined : `http ${response.status}`);
    // Only failures are traced for successes we keep just the status: the point
    // is to see which host breaks, not to log every byte.
    tracePush({
      provider: host,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      reason: response.ok ? undefined : `http ${response.status}`,
      bytes: Number(response.headers.get('content-length') || 0) || undefined,
      at: Date.now()
    });
    void started;
    return response;
  } catch (error: any) {
    const reason = error?.code === 'timeout' || error?.name === 'AbortError' ? 'timeout' : String(error?.message || error);
    providerHealth.record(host, false, reason);
    tracePush({ provider: host, ok: false, ms: Date.now() - started, reason, at: Date.now() });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type RaceEntry<T> = { name: string; run: () => Promise<T | null | undefined> };

export type RaceOutcome<T> = {
  value: T | null;
  winner: string;
  attempts: ProviderAttempt[];
};

/**
 * Starts independent mirrors at the same time and resolves with the first usable
 * answer. Every mirror is bounded, and its outcome feeds the health registry.
 */
export async function raceProviders<T>(
  entries: RaceEntry<T>[],
  options: { timeoutMs?: number; accept?: (value: T) => boolean; staggerMs?: number } = {}
): Promise<RaceOutcome<T>> {
  const timeoutMs = Math.max(1000, Number(options.timeoutMs) || MEDIA_RACE_TIMEOUT_MS);
  const accept = options.accept || ((value: T) => value !== null && value !== undefined);
  const ordered = providerHealth.order(entries);
  const attempts: ProviderAttempt[] = [];
  if (!ordered.length) return { value: null, winner: '', attempts };

  return new Promise<RaceOutcome<T>>(resolve => {
    let pending = ordered.length;
    let settled = false;
    const finish = (value: T | null, winner: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(overall);
      resolve({ value, winner, attempts });
    };
    const overall = setTimeout(() => finish(null, ''), timeoutMs);
    if (overall && typeof overall.unref === 'function') overall.unref();

    ordered.forEach(entry => {
      const started = Date.now();
      withTimeout(() => entry.run(), timeoutMs, entry.name)
        .then(result => {
          const usable = result !== null && result !== undefined && accept(result as T);
          const attempt = providerHealth.record(entry.name, usable, usable ? undefined : 'empty result');
          attempts.push({ ...attempt, ms: Date.now() - started });
          if (usable) finish(result as T, entry.name);
        })
        .catch((error: any) => {
          const reason = error?.code === 'timeout' ? 'timeout' : String(error?.message || error || 'failed');
          const attempt = providerHealth.record(entry.name, false, reason);
          attempts.push({ ...attempt, ms: Date.now() - started });
        })
        .finally(() => {
          pending -= 1;
          if (pending <= 0) finish(null, '');
        });
    });
  });
}

export type FailureKind = 'timeout' | 'http' | 'parse' | 'network' | 'empty' | 'unsupported';

export function failureKind(reason?: string): FailureKind {
  const text = String(reason || '').toLowerCase();
  if (text.includes('timeout') || text.includes('abort')) return 'timeout';
  // A body cut in half is a throttled/blocked response, not a format problem.
  if (text.includes('unexpected end of json') || text.includes('unterminated') || text.includes('network')) return 'network';
  if (/http\s*\d{3}/.test(text)) return 'http';
  if (text.includes('empty')) return 'empty';
  if (text.includes('json') || text.includes('parse') || text.includes('syntax')) return 'parse';
  if (text.includes('fetch') || text.includes('network') || text.includes('enotfound')) return 'network';
  return 'unsupported';
}

export type FailureSummary = {
  /** True when every attempt died on the infrastructure side (timeout / 5xx / park). */
  serviceDown: boolean;
  kinds: FailureKind[];
  providers: string[];
  text: string;
};

/** Turns raw attempt failures into a sentence the user can act on. */
export function summarizeFailures(
  attempts: ProviderAttempt[],
  platformLabel: string,
  options: { waitMs?: number } = {}
): FailureSummary {
  const kinds = attempts.map(attempt => failureKind(attempt.reason));
  const providers = Array.from(new Set(attempts.map(attempt => attempt.provider).filter(Boolean)));
  const infraOnly = attempts.length > 0 && kinds.every(kind => kind === 'timeout' || kind === 'http' || kind === 'network' || kind === 'empty');
  if (!attempts.length) {
    return { serviceDown: false, kinds: [], providers, text: `⚠️ تعذّر تحميل منشور ${platformLabel} — تأكد أن المنشور عام والرابط صحيح.` };
  }
  const rateLimited = attempts.some(attempt => /429/.test(String(attempt.reason || ''))) || (options.waitMs || 0) > 0;
  if (rateLimited) {
    // Say how long the host actually asked us to wait instead of guessing.
    const minutes = Math.ceil((options.waitMs || 0) / 60_000);
    const wait = minutes > 1 ? `تقريباً ${minutes} دقايق` : 'دقيقة تقريباً';
    return {
      serviceDown: true,
      kinds,
      providers,
      text:
        `⚠️ ${platformLabel} حادّد عدد الطلبات علينا هالوقت (429) — مو مشكلة برابطك.\n` +
        `انتظر ${wait} وحاول مرة ثانية، أو استخدم منصة ثانية من القائمة.`
    };
  }
  if (infraOnly) {
    return {
      serviceDown: true,
      kinds,
      providers,
      text:
        `⚠️ خدمة التحميل من ${platformLabel} متعطلة حالياً — المشكلة من الخدمة نفسها ومو من رابطك.\n` +
        `جرّب بعد دقائق، أو استخدم منصة ثانية من القائمة.`
    };
  }
  if (kinds.includes('parse')) {
    return {
      serviceDown: false,
      kinds,
      providers,
      text: `⚠️ الرابط وصل بس صيغة المنشور غير مدعومة — تأكد أن المنشور عام (مو خاص) وجرّب رابطه الأصلي.`
    };
  }
  return { serviceDown: false, kinds, providers, text: `⚠️ تعذّر تحميل منشور ${platformLabel} — تأكد أن المنشور عام والرابط صحيح.` };
}

/** Resets the registry; used by the diagnostics script and tests. */
export function resetProviderHealth(): void {
  providerHealth.reset();
}
