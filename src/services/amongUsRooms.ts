/**
 * Among Us — standalone room engine.
 *
 * This is a self-contained multiplayer game: rooms live in their own storage
 * keys, the rules are enforced server-side and the client only sends intents
 * (move / task / kill / report / sabotage / vote). Nothing here touches the
 * Telegram chat game in amongUsEngine.ts, so both can evolve independently.
 */

export type RoomStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

export type AuRole = 'crew' | 'impostor';
export type AuPhase = 'lobby' | 'playing' | 'meeting' | 'ended';
export type AuTaskKind = 'wires' | 'hold' | 'sequence' | 'upload';
export type AuSabotage = 'reactor' | 'oxygen' | 'lights' | 'comms';

export interface AuTask {
  id: string;
  kind: AuTaskKind;
  station: string;
  label: string;
  done: boolean;
}

export interface AuPlayer {
  token: string;
  name: string;
  color: string;
  bot: boolean;
  role: AuRole | null;
  alive: boolean;
  x: number;
  y: number;
  tasks: AuTask[];
  emergencyUsed: boolean;
  lastKillAt: number;
  lastSeen: number;
  votesGiven: boolean;
  target?: { x: number; y: number } | null;
  nextThinkAt?: number;
}

export interface AuBody {
  playerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  room: string;
  at: number;
}

export interface AuMeeting {
  reason: 'report' | 'emergency';
  calledBy: string;
  startedAt: number;
  endsAt: number;
  votes: Record<string, string | 'skip'>;
  result?: { ejected: string | null; role: AuRole | null; tied: boolean; skipped: number };
}

export interface AuLogEntry {
  at: number;
  text: string;
}

/** Host-chosen room rules. Every value is validated server side. */
export interface AuSettings {
  maxPlayers: number;
  /** 0 means "auto": the engine scales impostors with the player count. */
  impostors: number;
  tasks: number;
  killCooldownMs: number;
  meetingMs: number;
}

export interface AuRoomState {
  code: string;
  hostToken: string;
  settings?: AuSettings;
  phase: AuPhase;
  createdAt: number;
  updatedAt: number;
  players: AuPlayer[];
  bodies: AuBody[];
  sabotage: { kind: AuSabotage; endsAt: number } | null;
  meeting: AuMeeting | null;
  lastMeeting: { ejectedName: string | null; ejectedRole: AuRole | null; tied: boolean; at: number } | null;
  winner: 'crew' | 'impostors' | null;
  endReason: string;
  log: AuLogEntry[];
  tickAt: number;
  round: number;
}

export const AU_MAX_PLAYERS = 10;
export const AU_MIN_START = 6;
export const AU_TASKS_PER_PLAYER = 5;
export const AU_KILL_COOLDOWN_MS = 25_000;
export const AU_MEETING_MS = 45_000;
export const AU_SABOTAGE_MS = 45_000;
export const AU_PRESENCE_MS = 180_000;

export const AU_DEFAULT_SETTINGS: AuSettings = {
  maxPlayers: 10,
  impostors: 0,
  tasks: 5,
  killCooldownMs: AU_KILL_COOLDOWN_MS,
  meetingMs: AU_MEETING_MS
};

/** The only values the lobby offers, so a client can never send anything wild. */
export const AU_SETTING_CHOICES = {
  maxPlayers: [6, 8, 10],
  impostors: [0, 1, 2, 3],
  tasks: [3, 4, 5],
  killCooldownMs: [15_000, 25_000, 40_000],
  meetingMs: [30_000, 45_000, 60_000]
} as const;

export function sanitizeSettings(raw: unknown): AuSettings {
  const input = (raw || {}) as Record<string, unknown>;
  const pick = (value: unknown, list: readonly number[], fallback: number) => {
    const parsed = Number(value);
    return list.includes(parsed) ? parsed : fallback;
  };
  const settings: AuSettings = {
    maxPlayers: pick(input.maxPlayers, AU_SETTING_CHOICES.maxPlayers, AU_DEFAULT_SETTINGS.maxPlayers),
    impostors: pick(input.impostors, AU_SETTING_CHOICES.impostors, AU_DEFAULT_SETTINGS.impostors),
    tasks: pick(input.tasks, AU_SETTING_CHOICES.tasks, AU_DEFAULT_SETTINGS.tasks),
    killCooldownMs: pick(input.killCooldownMs, AU_SETTING_CHOICES.killCooldownMs, AU_DEFAULT_SETTINGS.killCooldownMs),
    meetingMs: pick(input.meetingMs, AU_SETTING_CHOICES.meetingMs, AU_DEFAULT_SETTINGS.meetingMs)
  };
  // A ship always needs crew: one impostor per three seats at most.
  if (settings.impostors > 0) {
    settings.impostors = Math.min(settings.impostors, Math.max(1, Math.floor(settings.maxPlayers / 3)));
  }
  return settings;
}

/** Names are display text only: no markup, no control characters, 18 chars max. */
export function safeName(raw: unknown): string {
  return String(raw == null ? '' : raw)
    .replace(/[<>&"'\\`]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18);
}

/**
 * Optional trust hook: the worker passes a resolver that checks the signed
 * Telegram initData. When it returns a name we use it and ignore the client's.
 */
export type NameResolver = (initData: string) => Promise<string | null>;

export function roomSettings(room: AuRoomState): AuSettings {
  return room.settings ? sanitizeSettings(room.settings) : { ...AU_DEFAULT_SETTINGS };
}

/** Colours are game pieces, so they carry their own hex value. */
export const AU_COLORS: Array<{ id: string; hex: string; name: string }> = [
  { id: 'red', hex: '#c51111', name: 'أحمر' },
  { id: 'blue', hex: '#132ed1', name: 'أزرق' },
  { id: 'green', hex: '#117f2d', name: 'أخضر' },
  { id: 'pink', hex: '#ed54ba', name: 'وردي' },
  { id: 'orange', hex: '#ef7d0d', name: 'برتقالي' },
  { id: 'yellow', hex: '#f5f557', name: 'أصفر' },
  { id: 'black', hex: '#3f474e', name: 'أسود' },
  { id: 'white', hex: '#d6e0f0', name: 'أبيض' },
  { id: 'purple', hex: '#6b2fbb', name: 'بنفسجي' },
  { id: 'cyan', hex: '#38fedc', name: 'سماوي' },
  // Rare colours: the client unlocks them after a few finished matches.
  { id: 'gold', hex: '#e2b53a', name: 'ذهبي' },
  { id: 'silver', hex: '#c3d0dc', name: 'فضي' }
];

/** Colours that only appear once the player has played a few matches. */
export const AU_RARE_COLORS = ['gold', 'silver'];

type Rect = { x: number; y: number; w: number; h: number };

export interface AuMapRoom extends Rect {
  id: string;
  name: string;
}

export const AU_MAP: {
  rooms: AuMapRoom[];
  corridors: Rect[];
  vents: Array<{ id: string; x: number; y: number; link: string }>;
  stations: Array<{ id: string; label: string; kind: AuTaskKind; x: number; y: number; room: string }>;
} = {
  rooms: [
    { id: 'cafeteria', name: 'الكافتيريا', x: 38, y: 4, w: 24, h: 16 },
    { id: 'weapons', name: 'الأسلحة', x: 8, y: 14, w: 15, h: 13 },
    { id: 'navigation', name: 'الملاحة', x: 77, y: 14, w: 15, h: 13 },
    { id: 'o2', name: 'الأوكسجين', x: 78, y: 36, w: 14, h: 11 },
    { id: 'admin', name: 'الإدارة', x: 55, y: 28, w: 12, h: 10 },
    { id: 'medbay', name: 'العيادة', x: 34, y: 28, w: 12, h: 11 },
    { id: 'electrical', name: 'الكهرباء', x: 18, y: 44, w: 12, h: 11 },
    { id: 'storage', name: 'المخزن', x: 40, y: 56, w: 18, h: 15 },
    { id: 'reactor', name: 'المفاعل', x: 6, y: 60, w: 14, h: 17 },
    { id: 'engines', name: 'المحركات', x: 8, y: 82, w: 18, h: 11 },
    { id: 'shields', name: 'الدروع', x: 64, y: 58, w: 14, h: 12 },
    { id: 'comms', name: 'الاتصالات', x: 82, y: 62, w: 12, h: 11 }
  ],
  corridors: [
    { x: 22, y: 18, w: 17, h: 5 }, // weapons -> cafeteria
    { x: 61, y: 18, w: 17, h: 5 }, // cafeteria -> navigation
    { x: 46, y: 19, w: 6, h: 10 }, // cafeteria -> medbay/admin
    { x: 38, y: 31, w: 18, h: 5 }, // medbay <-> admin
    { x: 66, y: 31, w: 13, h: 5 }, // admin -> o2
    { x: 47, y: 38, w: 5, h: 19 }, // medbay -> storage
    { x: 29, y: 46, w: 12, h: 5 }, // electrical -> storage
    { x: 21, y: 54, w: 5, h: 9 }, // electrical -> reactor
    { x: 13, y: 76, w: 5, h: 8 }, // reactor -> engines
    { x: 25, y: 86, w: 16, h: 5 }, // engines -> storage
    { x: 56, y: 62, w: 9, h: 5 }, // storage -> shields
    { x: 77, y: 63, w: 6, h: 5 }, // shields -> comms
    { x: 70, y: 47, w: 5, h: 12 } // o2 -> shields
  ],
  vents: [
    { id: 'v1', x: 20, y: 49, link: 'v2' },
    { id: 'v2', x: 47, y: 62, link: 'v1' },
    { id: 'v3', x: 88, y: 66, link: 'v4' },
    { id: 'v4', x: 70, y: 63, link: 'v3' }
  ],
  stations: [
    { id: 'st-wires-elec', label: 'أسلاك الكهرباء', kind: 'wires', x: 24, y: 49.5, room: 'electrical' },
    { id: 'st-wires-shield', label: 'أسلاك الدروع', kind: 'wires', x: 71, y: 64, room: 'shields' },
    { id: 'st-wires-weapons', label: 'أسلاك الأسلحة', kind: 'wires', x: 15, y: 20, room: 'weapons' },
    { id: 'st-hold-reactor', label: 'تبريد المفاعل', kind: 'hold', x: 13, y: 68, room: 'reactor' },
    { id: 'st-hold-nav', label: 'معايرة الملاحة', kind: 'hold', x: 84, y: 20, room: 'navigation' },
    { id: 'st-hold-med', label: 'فحص العيادة', kind: 'hold', x: 40, y: 33, room: 'medbay' },
    { id: 'st-seq-weapons', label: 'شحن الأسلحة', kind: 'sequence', x: 17, y: 24, room: 'weapons' },
    { id: 'st-seq-admin', label: 'بطاقة الإدارة', kind: 'sequence', x: 61, y: 33, room: 'admin' },
    { id: 'st-seq-o2', label: 'فلتر الأوكسجين', kind: 'sequence', x: 85, y: 42, room: 'o2' },
    { id: 'st-up-storage', label: 'تحميل البيانات', kind: 'upload', x: 49, y: 63, room: 'storage' },
    { id: 'st-up-comms', label: 'رفع البيانات', kind: 'upload', x: 88, y: 68, room: 'comms' },
    { id: 'st-up-cafe', label: 'سجل الكافتيريا', kind: 'upload', x: 50, y: 12, room: 'cafeteria' }
  ]
};

const EMERGENCY_POINT = { x: 50, y: 12 };
const CAFETERIA_SPAWN = { x: 50, y: 17 };

const ROOM_KEY = (code: string) => `amongus-room:${code}`;
const ROOM_INDEX_KEY = 'amongus-rooms:index';
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const BOT_NAMES = ['بوت نجم', 'بوت صقر', 'بوت ظل', 'بوت نور', 'بوت بحر', 'بوت جبل', 'بوت سهم', 'بوت رعد'];

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

function token(): string {
  return `au_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function insideRect(point: { x: number; y: number }, rect: Rect, pad = 0): boolean {
  return (
    point.x >= rect.x - pad &&
    point.x <= rect.x + rect.w + pad &&
    point.y >= rect.y - pad &&
    point.y <= rect.y + rect.h + pad
  );
}

/** The ship is a union of room and corridor rectangles: everything else is void. */
export function isWalkable(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < 0 || y < 0 || x > 100 || y > 100) return false;
  const point = { x, y };
  return AU_MAP.rooms.some(room => insideRect(point, room)) || AU_MAP.corridors.some(hall => insideRect(point, hall));
}

function roomAt(x: number, y: number): string {
  const found = AU_MAP.rooms.find(room => insideRect({ x, y }, room));
  return found ? found.id : 'corridor';
}

function clampToShip(x: number, y: number, previous: { x: number; y: number }): { x: number; y: number } {
  const nextX = Math.max(1, Math.min(99, Number(x)));
  const nextY = Math.max(1, Math.min(99, Number(y)));
  if (isWalkable(nextX, nextY)) return { x: nextX, y: nextY };
  // Slide along the wall instead of sticking: try each axis on its own.
  if (isWalkable(nextX, previous.y)) return { x: nextX, y: previous.y };
  if (isWalkable(previous.x, nextY)) return { x: previous.x, y: nextY };
  return previous;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function taskForStation(station: (typeof AU_MAP.stations)[number], index: number): AuTask {
  return { id: `${station.id}-${index}`, kind: station.kind, station: station.id, label: station.label, done: false };
}

function dealTasks(count = AU_TASKS_PER_PLAYER): AuTask[] {
  return shuffle(AU_MAP.stations)
    .slice(0, Math.max(1, Math.min(count, AU_MAP.stations.length)))
    .map((station, index) => taskForStation(station, index));
}

function stationById(id: string) {
  return AU_MAP.stations.find(station => station.id === id) || null;
}

function pickColor(room: AuRoomState, wanted?: string): string {
  const used = new Set(room.players.map(player => player.color));
  const asked = AU_COLORS.find(color => color.id === wanted);
  if (asked && !used.has(asked.id)) return asked.id;
  return (AU_COLORS.find(color => !used.has(color.id)) || AU_COLORS[0]).id;
}

function makePlayer(name: string, bot: boolean, room: AuRoomState, color?: string): AuPlayer {
  const spawn = {
    x: CAFETERIA_SPAWN.x + (Math.random() * 8 - 4),
    y: CAFETERIA_SPAWN.y + (Math.random() * 6 - 3)
  };
  return {
    token: bot ? `bot_${Math.random().toString(36).slice(2, 9)}` : token(),
    name: String(name || 'لاعب').slice(0, 18),
    color: pickColor(room, color),
    bot,
    role: null,
    alive: true,
    x: spawn.x,
    y: spawn.y,
    tasks: [],
    emergencyUsed: false,
    lastKillAt: 0,
    lastSeen: Date.now(),
    votesGiven: false,
    target: null
  };
}

function log(room: AuRoomState, text: string): void {
  room.log.push({ at: Date.now(), text });
  if (room.log.length > 60) room.log.splice(0, room.log.length - 60);
}

export function impostorCount(players: number): number {
  if (players >= 9) return 2;
  if (players >= 7) return 1;
  return 1;
}

function endGame(room: AuRoomState, winner: 'crew' | 'impostors', reason: string): void {
  room.phase = 'ended';
  room.winner = winner;
  room.endReason = reason;
  room.sabotage = null;
  room.meeting = null;
  log(room, winner === 'crew' ? `فاز الطاقم: ${reason}` : `فاز المزوّرون: ${reason}`);
}

function checkWin(room: AuRoomState): boolean {
  if (room.phase === 'ended') return true;
  const alive = room.players.filter(player => player.alive);
  const impostors = alive.filter(player => player.role === 'impostor');
  const crewAlive = alive.filter(player => player.role === 'crew');
  if (!impostors.length) {
    endGame(room, 'crew', 'طُرد كل المزوّرين');
    return true;
  }
  if (impostors.length >= crewAlive.length) {
    endGame(room, 'impostors', 'تساوى عدد المزوّرين مع الطاقم');
    return true;
  }
  const crewMembers = room.players.filter(player => player.role === 'crew');
  const aliveCrewTasks = alive.filter(player => player.role === 'crew').flatMap(player => player.tasks);
  if (aliveCrewTasks.length === 0) {
    endGame(room, 'crew', 'ما بقت مهام على الطاقم الحيّ');
    return true;
  }
  if (aliveCrewTasks.every(task => task.done) && crewMembers.length > 0) {
    endGame(room, 'crew', 'أكمل الطاقم كل المهام');
    return true;
  }
  return false;
}

function startMatch(room: AuRoomState): void {
  const settings = roomSettings(room);
  const players = room.players.slice(0, settings.maxPlayers);
  room.players = players;
  room.phase = 'playing';
  room.winner = null;
  room.endReason = '';
  room.bodies = [];
  room.sabotage = null;
  room.meeting = null;
  room.lastMeeting = null;
  room.round = 1;
  room.log = [];
  const wantedImpostors = settings.impostors > 0 ? settings.impostors : impostorCount(players.length);
  const impostors = Math.max(
    1,
    Math.min(wantedImpostors, Math.max(1, Math.floor((players.length - 1) / 2)))
  );
  const order = shuffle(players.map((_, index) => index));
  const impostorIndexes = new Set(order.slice(0, impostors));
  players.forEach((player, index) => {
    player.role = impostorIndexes.has(index) ? 'impostor' : 'crew';
    player.alive = true;
    player.tasks = player.role === 'crew' ? dealTasks(settings.tasks) : [];
    player.x = CAFETERIA_SPAWN.x + (Math.random() * 10 - 5);
    player.y = CAFETERIA_SPAWN.y + (Math.random() * 6 - 3);
    player.emergencyUsed = false;
    player.lastKillAt = Date.now() - settings.killCooldownMs;
    player.votesGiven = false;
    player.target = null;
    player.nextThinkAt = 0;
    player.lastSeen = Date.now();
  });
  log(room, `بدت المباراة بـ ${players.length} لاعبين و${impostors} مزوّر`);
}

function crewTaskProgress(room: AuRoomState): { done: number; total: number } {
  const crewTasks = room.players.filter(player => player.role === 'crew').flatMap(player => player.tasks);
  return { done: crewTasks.filter(task => task.done).length, total: crewTasks.length };
}

function startMeeting(room: AuRoomState, reason: 'report' | 'emergency', calledBy: string): void {
  const now = Date.now();
  room.phase = 'meeting';
  room.meeting = { reason, calledBy, startedAt: now, endsAt: now + roomSettings(room).meetingMs, votes: {} };
  room.players.forEach(player => {
    player.votesGiven = false;
    if (player.alive) {
      player.x = CAFETERIA_SPAWN.x + (Math.random() * 10 - 5);
      player.y = CAFETERIA_SPAWN.y + (Math.random() * 6 - 3);
    }
  });
  room.bodies = [];
  room.sabotage = null;
  log(room, reason === 'report' ? 'انعقد اجتماع بسبب تبليغ عن جثة' : 'انعقد اجتماع طارئ');
}

function resolveMeeting(room: AuRoomState): void {
  const meeting = room.meeting;
  if (!meeting) return;
  const tally = new Map<string, number>();
  let skipped = 0;
  for (const target of Object.values(meeting.votes)) {
    if (target === 'skip') {
      skipped += 1;
      continue;
    }
    tally.set(target, (tally.get(target) || 0) + 1);
  }
  let top = 0;
  let leaders: string[] = [];
  for (const [id, count] of tally.entries()) {
    if (count > top) {
      top = count;
      leaders = [id];
    } else if (count === top) {
      leaders.push(id);
    }
  }
  const tied = leaders.length !== 1 || (top > 0 && top <= skipped);
  const ejectedToken = !tied && leaders.length === 1 && top > skipped ? leaders[0] : null;
  const ejected = ejectedToken ? room.players.find(player => player.token === ejectedToken) || null : null;
  if (ejected) {
    ejected.alive = false;
    room.players.filter(player => player.role === 'impostor').forEach(player => {
      if (player.alive) player.lastKillAt = Date.now();
    });
    log(room, `انطرد ${ejected.name}${ejected.role === 'impostor' ? ' — كان مزوّراً' : ' — كان من الطاقم'}`);
  } else {
    log(room, 'ما انطرد أحد بهذا التصويت');
  }
  room.lastMeeting = { ejectedName: ejected ? ejected.name : null, ejectedRole: ejected ? ejected.role : null, tied, at: Date.now() };
  room.meeting = null;
  room.round += 1;
  if (!checkWin(room)) {
    room.phase = 'playing';
    room.players.forEach(player => {
      player.votesGiven = false;
    });
  }
}

function nearestAliveCrew(room: AuRoomState, from: AuPlayer, range: number): AuPlayer | null {
  let best: AuPlayer | null = null;
  let bestDistance = range;
  for (const player of room.players) {
    if (!player.alive || player.role !== 'crew' || player.token === from.token) continue;
    const d = distance(from, player);
    if (d <= bestDistance) {
      best = player;
      bestDistance = d;
    }
  }
  return best;
}

function botThink(room: AuRoomState, bot: AuPlayer, now: number): void {
  if (room.phase !== 'playing' || !bot.alive) return;
  if (room.meeting) return;
  if ((bot.nextThinkAt || 0) > now) return;
  bot.nextThinkAt = now + 1200 + Math.random() * 1600;

  if (bot.role === 'impostor') {
    const victim = nearestAliveCrew(room, bot, 6.5);
    if (victim && now - bot.lastKillAt > roomSettings(room).killCooldownMs) {
      victim.alive = false;
      bot.lastKillAt = now;
      room.bodies.push({ playerId: victim.token, name: victim.name, color: victim.color, x: victim.x, y: victim.y, room: roomAt(victim.x, victim.y), at: now });
      log(room, 'صار قتل بالسفينة');
      checkWin(room);
      return;
    }
    if (!room.sabotage && Math.random() < 0.08) {
      const kind: AuSabotage = (['reactor', 'oxygen', 'lights', 'comms'] as AuSabotage[])[Math.floor(Math.random() * 4)];
      applySabotage(room, kind);
      return;
    }
  }

  // Bodies get reported by passing bots.
  const body = room.bodies.find(entry => distance(entry, bot) < 7);
  if (body && Math.random() < 0.5) {
    startMeeting(room, 'report', bot.token);
    return;
  }

  if (bot.role === 'crew') {
    const nextTask = bot.tasks.find(task => !task.done);
    if (nextTask) {
      const station = stationById(nextTask.station);
      if (station && distance(station, bot) < 3.5) {
        nextTask.done = true;
        checkWin(room);
      } else if (station) {
        bot.target = { x: station.x, y: station.y };
      }
    } else if (!bot.target || distance(bot.target, bot) < 3) {
      const room2 = AU_MAP.rooms[Math.floor(Math.random() * AU_MAP.rooms.length)];
      bot.target = { x: room2.x + room2.w / 2, y: room2.y + room2.h / 2 };
    }
  } else if (!bot.target || distance(bot.target, bot) < 3) {
    const room2 = AU_MAP.rooms[Math.floor(Math.random() * AU_MAP.rooms.length)];
    bot.target = { x: room2.x + room2.w / 2, y: room2.y + room2.h / 2 };
  }

  if (bot.target) {
    const dx = bot.target.x - bot.x;
    const dy = bot.target.y - bot.y;
    const length = Math.hypot(dx, dy) || 1;
    const step = 2.2;
    const next = clampToShip(bot.x + (dx / length) * step, bot.y + (dy / length) * step, bot);
    bot.x = next.x;
    bot.y = next.y;
  }
}

function applySabotage(room: AuRoomState, kind: AuSabotage): void {
  if (room.phase !== 'playing') return;
  room.sabotage = { kind, endsAt: kind === 'lights' || kind === 'comms' ? 0 : Date.now() + AU_SABOTAGE_MS };
  log(room, `تخريب: ${kind === 'reactor' ? 'المفاعل' : kind === 'oxygen' ? 'الأوكسجين' : kind === 'lights' ? 'الإنارة' : 'الاتصالات'}`);
}

function sabotageStation(kind: AuSabotage): { x: number; y: number } | null {
  if (kind === 'reactor') return { x: 13, y: 68 };
  if (kind === 'oxygen') return { x: 85, y: 42 };
  if (kind === 'lights') return { x: 24, y: 49.5 };
  return { x: 88, y: 68 };
}

/** Runs timers, bot AI and win checks. Cheap enough to run on every poll. */
function tick(room: AuRoomState): boolean {
  const now = Date.now();
  let changed = false;

  if (room.phase === 'meeting' && room.meeting && now >= room.meeting.endsAt) {
    resolveMeeting(room);
    changed = true;
  }

  if (room.phase === 'playing' && room.sabotage && room.sabotage.endsAt && now >= room.sabotage.endsAt) {
    const kind = room.sabotage.kind;
    endGame(room, 'impostors', kind === 'reactor' ? 'انفجر المفاعل' : 'نفد الأوكسجين');
    return true;
  }

  // Bot brains and movement are throttled; win conditions are checked every time
  // so a task completed by a player is judged on the very next poll.
  if (room.phase === 'playing' && now - room.tickAt > 400) {
    room.tickAt = now;
    for (const player of room.players) {
      if (player.bot) botThink(room, player, now);
    }
    changed = true;
  }

  if (room.phase === 'playing' && checkWin(room)) changed = true;

  room.updatedAt = now;
  return changed;
}

export interface AuPublicPlayer {
  token: string;
  name: string;
  color: string;
  bot: boolean;
  alive: boolean;
  x: number;
  y: number;
  role: AuRole | null;
  tasks: AuTask[];
  isHost: boolean;
  you: boolean;
  voteReady: boolean;
  votedFor: string | 'skip' | null;
  emergencyUsed: boolean;
}

export interface AuPublicRoom {
  code: string;
  phase: AuPhase;
  players: AuPublicPlayer[];
  you: AuPublicPlayer | null;
  role: AuRole | null;
  bodies: AuBody[];
  sabotage: { kind: AuSabotage; endsAt: number } | null;
  meeting: {
    reason: 'report' | 'emergency';
    calledBy: string;
    endsAt: number;
    votes: Array<{ voter: string; target: string | null }>;
  } | null;
  lastMeeting: AuRoomState['lastMeeting'];
  winner: 'crew' | 'impostors' | null;
  endReason: string;
  progress: { done: number; total: number };
  killCooldownLeftMs: number;
  canStart: boolean;
  minPlayers: number;
  maxPlayers: number;
  settings: AuSettings;
  log: AuLogEntry[];
  now: number;
}

/** What a player is allowed to know: other roles stay hidden unless you share them. */
export function publicRoom(room: AuRoomState, viewerToken: string): AuPublicRoom {
  const viewer = room.players.find(player => player.token === viewerToken) || null;
  const viewerIsImpostor = viewer?.role === 'impostor';
  const now = Date.now();
  const progress = crewTaskProgress(room);
  const votes = room.meeting
    ? Object.entries(room.meeting.votes).map(([voter, target]) => ({
        voter: room.players.find(player => player.token === voter)?.name || voter,
        target: target === 'skip' ? 'skip' : room.players.find(player => player.token === target)?.name || null
      }))
    : [];
  return {
    code: room.code,
    phase: room.phase,
    players: room.players.map(player => {
      // Your own role, your fellow impostors, and everyone whose body was found
      // or who was ejected (dead players) are public.
      const revealRole = (candidate: AuPlayer) =>
        candidate.token === viewerToken ||
        room.phase === 'ended' ||
        !candidate.alive ||
        (viewerIsImpostor && candidate.role === 'impostor');
      return {
        token: player.token === viewerToken ? 'you' : player.token,
        name: player.name,
        color: player.color,
        bot: player.bot,
        alive: player.alive,
        x: Math.round(player.x * 10) / 10,
        y: Math.round(player.y * 10) / 10,
        role: revealRole(player) ? player.role : null,
        tasks: player.token === viewerToken ? player.tasks : [],
        isHost: player.token === room.hostToken,
        you: player.token === viewerToken,
        voteReady: Boolean(room.meeting?.votes[player.token]),
        votedFor: room.meeting?.votes[player.token] || null,
        emergencyUsed: player.emergencyUsed
      };
    }),
    you: null,
    role: viewer ? viewer.role : null,
    bodies: room.phase === 'playing' ? room.bodies.map(body => ({ ...body })) : [],
    sabotage: room.sabotage,
    meeting: room.meeting
      ? {
          reason: room.meeting.reason,
          calledBy: room.players.find(player => player.token === room.meeting?.calledBy)?.name || '',
          endsAt: room.meeting.endsAt,
          votes
        }
      : null,
    lastMeeting: room.lastMeeting,
    winner: room.winner,
    endReason: room.endReason,
    progress,
    killCooldownLeftMs:
      viewer && viewer.role === 'impostor'
        ? Math.max(0, roomSettings(room).killCooldownMs - (now - viewer.lastKillAt))
        : 0,
    canStart: room.phase === 'lobby' && room.players.length >= AU_MIN_START,
    minPlayers: AU_MIN_START,
    maxPlayers: roomSettings(room).maxPlayers,
    settings: roomSettings(room),
    log: room.log.slice(-12),
    now
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

const fail = (error: string, status = 400) => json({ ok: false, error }, status);

export class AmongUsRooms {
  constructor(
    private readonly storage: RoomStorage,
    private readonly resolveName?: NameResolver
  ) {}

  /** The Telegram account name if it verifies, otherwise the sanitised fallback. */
  private async playerName(body: any): Promise<string> {
    if (this.resolveName) {
      try {
        const verified = await this.resolveName(String(body && body.initData || ''));
        const clean = safeName(verified);
        if (clean) return clean;
      } catch {
        // fall through to the sanitised client value
      }
    }
    return safeName(body && body.name) || 'لاعب';
  }

  private async load(code: string): Promise<AuRoomState | null> {
    const key = String(code || '').toUpperCase().slice(0, 6);
    if (!/^[A-Z0-9]{4,6}$/.test(key)) return null;
    const room = await this.storage.get<AuRoomState>(ROOM_KEY(key));
    return room || null;
  }

  /** Newest-first codes of every room this worker has opened (pruned on read). */
  private async readIndex(): Promise<string[]> {
    const list = await this.storage.get<string[]>(ROOM_INDEX_KEY);
    return Array.isArray(list) ? list.filter(entry => typeof entry === 'string') : [];
  }

  private async addToIndex(code: string): Promise<void> {
    const list = await this.readIndex();
    if (list.includes(code)) return;
    list.unshift(code);
    await this.storage.put(ROOM_INDEX_KEY, list.slice(0, 60));
  }

  /**
   * The online lobby browser. It never leaks tokens: a room is described by its
   * code, host name, head count and rules only.
   */
  async listRooms(): Promise<Response> {
    const now = Date.now();
    const codes = await this.readIndex();
    const live: string[] = [];
    const rooms: Array<Record<string, unknown>> = [];
    for (const code of codes) {
      const room = await this.load(code);
      if (!room) continue;
      if (tick(room)) await this.save(room);
      const age = now - room.updatedAt;
      if (age > ROOM_TTL_MS) continue;
      if (room.phase === 'ended' && age > 5 * 60 * 1000) continue;
      live.push(code);
      const settings = roomSettings(room);
      rooms.push({
        code: room.code,
        host: room.players.find(player => player.token === room.hostToken)?.name || room.players[0]?.name || '',
        players: room.players.length,
        maxPlayers: settings.maxPlayers,
        phase: room.phase,
        joinable: room.phase === 'lobby' && room.players.length < settings.maxPlayers,
        settings,
        createdAt: room.createdAt
      });
    }
    if (live.length !== codes.length) await this.storage.put(ROOM_INDEX_KEY, live);
    rooms.sort((a, b) =>
      a.joinable === b.joinable
        ? Number(b.createdAt) - Number(a.createdAt)
        : Number(b.joinable) - Number(a.joinable)
    );
    return json({ ok: true, rooms: rooms.slice(0, 12), now });
  }

  private async save(room: AuRoomState): Promise<void> {
    room.updatedAt = Date.now();
    await this.storage.put(ROOM_KEY(room.code), room);
  }

  /** Drops players that vanished mid-game so the lobby does not fill with ghosts. */
  private prune(room: AuRoomState): void {
    if (room.phase !== 'playing' && room.phase !== 'meeting') return;
    const now = Date.now();
    room.players = room.players.filter(player => player.bot || now - player.lastSeen < AU_PRESENCE_MS);
    if (!room.players.some(player => player.token === room.hostToken)) {
      const nextHost = room.players[0];
      if (nextHost) room.hostToken = nextHost.token;
    }
  }

  async handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/').filter(Boolean); // api, amongus, rooms, CODE
      if (parts[0] !== 'api' || parts[1] !== 'amongus') return fail('not found', 404);

      if (request.method === 'GET') {
        const code = String(parts[3] || url.searchParams.get('code') || '').toUpperCase();
        if (!code) return await this.listRooms();
        const room = await this.load(code);
        if (!room) return fail('الغرفة غير موجودة أو انتهت', 404);
        const viewer = url.searchParams.get('token') || '';
        if (tick(room)) await this.save(room);
        return json({ ok: true, room: publicRoom(room, viewer) });
      }

      const body: any = await request.json().catch(() => ({}));
      const action = String(body.action || '');

      if (action === 'create') {
        const code = randomCode();
        const room: AuRoomState = {
          code,
          settings: sanitizeSettings(body.settings),
          hostToken: '',
          phase: 'lobby',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          players: [],
          bodies: [],
          sabotage: null,
          meeting: null,
          lastMeeting: null,
          winner: null,
          endReason: '',
          log: [],
          tickAt: 0,
          round: 0
        };
        const host = makePlayer(await this.playerName(body) || 'المضيف', false, room, String(body.color || ''));
        room.players.push(host);
        room.hostToken = host.token;
        log(room, 'انفتحت غرفة جديدة');
        await this.save(room);
        await this.addToIndex(code);
        return json({ ok: true, code, token: host.token, room: publicRoom(room, host.token) });
      }

      const code = String(body.code || parts[3] || '').toUpperCase();
      const room = await this.load(code);
      if (!room) return fail('الغرفة غير موجودة أو انتهت', 404);

      if (action === 'join') {
        if (room.phase !== 'lobby') return fail('المباراة بدت — انتظر الجولة الجاية');
        const limit = roomSettings(room).maxPlayers;
        if (room.players.length >= limit) return fail(`الغرفة فلّت (${limit} لاعبين)`);
        const player = makePlayer(await this.playerName(body), false, room, String(body.color || ''));
        room.players.push(player);
        log(room, `انضم ${player.name}`);
        await this.save(room);
        return json({ ok: true, code: room.code, token: player.token, room: publicRoom(room, player.token) });
      }

      const viewerToken = String(body.token || '');
      const me = room.players.find(player => player.token === viewerToken) || null;
      if (!me) return fail('مو موجود بهذي الغرفة', 403);
      me.lastSeen = Date.now();

      switch (action) {
        case 'addBot': {
          if (room.phase !== 'lobby') return fail('ما يصير تضيف بوت بعد البداية');
          if (room.players.length >= roomSettings(room).maxPlayers) return fail('الغرفة فلّت');
          if (me.token !== room.hostToken) return fail('المضيف بس يضيف بوتات');
          const used = new Set(room.players.map(player => player.name));
          const name = BOT_NAMES.find(candidate => !used.has(candidate)) || `بوت ${room.players.length + 1}`;
          room.players.push(makePlayer(name, true, room));
          break;
        }
        case 'kickBot': {
          if (room.phase !== 'lobby') return fail('ما يصير تحذف بعد البداية');
          if (me.token !== room.hostToken) return fail('المضيف بس يحذف');
          const botId = String(body.botToken || '');
          room.players = room.players.filter(player => player.token !== botId || !player.bot);
          break;
        }
        case 'lobby': {
          if (me.token !== room.hostToken) return fail('المضيف بس يرجع للانتظار');
          if (room.phase !== 'ended') break;
          room.phase = 'lobby';
          room.winner = null;
          room.endReason = '';
          room.bodies = [];
          room.sabotage = null;
          room.meeting = null;
          room.lastMeeting = null;
          room.round = 0;
          room.players.forEach(player => {
            player.alive = true;
            player.role = null;
            player.tasks = [];
            player.emergencyUsed = false;
            player.x = CAFETERIA_SPAWN.x;
            player.y = CAFETERIA_SPAWN.y;
          });
          break;
        }
        case 'start': {
          if (me.token !== room.hostToken) return fail('المضيف بس يبدي');
          if (room.phase !== 'lobby') return fail('المباراة بدت أصلاً');
          if (room.players.length < AU_MIN_START) return fail(`تحتاج ${AU_MIN_START} لاعبين على الأقل`);
          startMatch(room);
          break;
        }
        case 'move': {
          if (room.phase !== 'playing' || !me.alive) break;
          const next = clampToShip(Number(body.x), Number(body.y), me);
          me.x = next.x;
          me.y = next.y;
          break;
        }
        case 'task': {
          if (me.role !== 'crew') return fail('المهام للطاقم بس');
          if (room.phase !== 'playing' || !me.alive) break;
          const taskId = String(body.taskId || '');
          const task = me.tasks.find(entry => entry.id === taskId);
          if (!task || task.done) break;
          const station = stationById(task.station);
          if (!station || distance(station, me) > 8) return fail('اقرب من المحطة أول');
          task.done = true;
          checkWin(room);
          break;
        }
        case 'kill': {
          if (me.role !== 'impostor') return fail('المزوّر بس يقتل');
          if (room.phase !== 'playing' || !me.alive) break;
          if (Date.now() - me.lastKillAt < roomSettings(room).killCooldownMs) return fail('القتل بعده ما جاهز');
          const target = room.players.find(player => player.token === String(body.target || ''));
          if (!target || !target.alive || target.role === 'impostor') return fail('هدف غير صالح');
          if (distance(me, target) > 7) return fail('قريب من الهدف أول');
          target.alive = false;
          me.lastKillAt = Date.now();
          room.bodies.push({ playerId: target.token, name: target.name, color: target.color, x: target.x, y: target.y, room: roomAt(target.x, target.y), at: Date.now() });
          checkWin(room);
          break;
        }
        case 'report': {
          if (room.phase !== 'playing' || !me.alive) break;
          const body2 = room.bodies.find(entry => distance(entry, me) < 8);
          if (!body2) return fail('ماكو جثة قريبة');
          startMeeting(room, 'report', me.token);
          break;
        }
        case 'emergency': {
          if (room.phase !== 'playing' || !me.alive) break;
          if (me.emergencyUsed) return fail('استخدمت الاجتماع الطارئ من قبل');
          if (distance(EMERGENCY_POINT, me) > 9) return fail('زر الطوارئ بالكافتيريا');
          me.emergencyUsed = true;
          startMeeting(room, 'emergency', me.token);
          break;
        }
        case 'sabotage': {
          if (me.role !== 'impostor') return fail('المزوّر بس يخرّب');
          if (room.phase !== 'playing' || !me.alive) break;
          if (room.sabotage) return fail('اكو تخريب شغّال');
          const kind = String(body.kind || '') as AuSabotage;
          if (!['reactor', 'oxygen', 'lights', 'comms'].includes(kind)) return fail('تخريب غير معروف');
          applySabotage(room, kind);
          break;
        }
        case 'fix': {
          if (room.phase !== 'playing' || !me.alive) break;
          if (!room.sabotage) break;
          const station = sabotageStation(room.sabotage.kind);
          if (!station || distance(station, me) > 8) return fail('روح لمكان التخريب');
          log(room, `أصلح ${me.name} التخريب`);
          room.sabotage = null;
          break;
        }
        case 'vent': {
          if (me.role !== 'impostor') return fail('المزوّر بس يستخدم التهوية');
          if (room.phase !== 'playing' || !me.alive) break;
          const vent = AU_MAP.vents.find(entry => distance(entry, me) < 6);
          if (!vent) return fail('ماكو فتحة تهوية قريبة');
          const target = AU_MAP.vents.find(entry => entry.id === vent.link) || vent;
          me.x = target.x;
          me.y = target.y;
          break;
        }
        case 'vote': {
          if (room.phase !== 'meeting' || !room.meeting || !me.alive) break;
          if (room.meeting.votes[me.token]) return fail('صوّتت من قبل');
          const choice = String(body.target || 'skip');
          if (choice !== 'skip') {
            const targetPlayer = room.players.find(player => player.token === choice);
            if (!targetPlayer || !targetPlayer.alive) return fail('هدف غير صالح');
          }
          room.meeting.votes[me.token] = choice === 'skip' ? 'skip' : choice;
          const aliveCount = room.players.filter(player => player.alive).length;
          const votedCount = Object.keys(room.meeting.votes).length;
          if (votedCount >= aliveCount) resolveMeeting(room);
          break;
        }
        case 'state':
        case 'sync':
          break;
        case 'leave': {
          room.players = room.players.filter(player => player.token !== me.token);
          if (me.token === room.hostToken && room.players[0]) room.hostToken = room.players[0].token;
          if (!room.players.length) {
            log(room, 'انتهت الغرفة');
          }
          break;
        }
        default:
          break;
      }

      this.prune(room);
      tick(room);
      await this.save(room);
      return json({ ok: true, room: publicRoom(room, viewerToken) });
    } catch (error: any) {
      return fail(String(error?.message || 'خطأ غير متوقع'), 500);
    }
  }
}

/** In-memory storage so the engine can be exercised without Cloudflare. */
export function memoryRoomStorage(): RoomStorage {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async put(key: string, value: unknown) {
      store.set(key, value);
    }
  };
}
