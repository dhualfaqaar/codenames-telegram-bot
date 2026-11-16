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
export type AuTaskKind = 'wires' | 'hold' | 'sequence' | 'upload' | 'shields' | 'asteroids' | 'filter' | 'steering' | 'scan' | 'alignment';
export type AuSabotage = 'reactor' | 'oxygen' | 'lights' | 'comms';
export interface AuSabotageState {
  kind: AuSabotage; endsAt: number;
  fixed?: string[]; codes?: Record<string,string>; switches?: boolean[]; frequency?: number;
  holds?: Record<string,{token:string; at:number}>;
}
export interface AuPublicSabotage {
  kind: AuSabotage; endsAt: number; fixed: string[]; codes: Record<string,string>;
  switches: boolean[]; frequency: number; held: string[];
}

export interface AuTask {
  id: string;
  kind: AuTaskKind;
  station: string;
  label: string;
  done: boolean;
}

export interface AuPlayer {
  token: string;
  publicId?: string;
  watchingCameras?: boolean;
  ventId?: string | null;
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
  suspectToken?: string | null;
  taskReadyAt?: number;
  moveSeq?: number;
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
  chat?: Array<{ name: string; text: string }>;
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
  practice?: boolean;
  settings?: AuSettings;
  phase: AuPhase;
  createdAt: number;
  updatedAt: number;
  players: AuPlayer[];
  bodies: AuBody[];
  sabotage: AuSabotageState | null;
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
  obstacles: Array<{x:number; y:number; rx:number; ry:number}>;
  vents: Array<{ id: string; x: number; y: number; link: string }>;
  stations: Array<{ id: string; label: string; kind: AuTaskKind; x: number; y: number; room: string }>;
} = {
  // Relative positions and connections based on The Skeld's in-game map.
  // Rectangles are both the rendered floor and the authoritative collision geometry.
  rooms: [
    { id: 'cafeteria', name: 'الكافتيريا', x: 38, y: 4, w: 24, h: 20 },
    { id: 'weapons', name: 'الأسلحة', x: 70, y: 8, w: 12, h: 15 },
    { id: 'navigation', name: 'الملاحة', x: 88, y: 35, w: 10, h: 15 },
    { id: 'o2', name: 'الأوكسجين', x: 69, y: 33, w: 11, h: 11 },
    { id: 'admin', name: 'الإدارة', x: 57, y: 45, w: 12, h: 13 },
    { id: 'medbay', name: 'العيادة', x: 27, y: 29, w: 10, h: 13 },
    { id: 'electrical', name: 'الكهرباء', x: 28, y: 64, w: 13, h: 14 },
    { id: 'storage', name: 'المخزن', x: 43, y: 69, w: 18, h: 20 },
    { id: 'reactor', name: 'المفاعل', x: 3, y: 41, w: 12, h: 18 },
    { id: 'upper-engine', name: 'المحرك العلوي', x: 13, y: 10, w: 13, h: 16 },
    { id: 'lower-engine', name: 'المحرك السفلي', x: 13, y: 70, w: 13, h: 16 },
    { id: 'security', name: 'الأمن', x: 18, y: 44, w: 11, h: 12 },
    { id: 'shields', name: 'الدروع', x: 76, y: 67, w: 12, h: 15 },
    { id: 'comms', name: 'الاتصالات', x: 63, y: 79, w: 11, h: 12 }
  ],
  corridors: [
    { x: 25, y: 16, w: 14, h: 6 }, // upper engine to cafeteria
    { x: 31, y: 20, w: 5, h: 11 }, // medbay entrance
    { x: 61, y: 14, w: 10, h: 6 }, // cafeteria to weapons
    { x: 48, y: 23, w: 6, h: 48 }, // cafeteria down to storage
    { x: 53, y: 48, w: 5, h: 6 }, // admin entrance
    { x: 18, y: 25, w: 5, h: 46 }, // engines and reactor/security junction
    { x: 14, y: 48, w: 5, h: 6 },
    { x: 22, y: 76, w: 22, h: 6 }, // lower engine to storage
    { x: 34, y: 77, w: 5, h: 4 }, // electrical opens into lower hall
    { x: 75, y: 22, w: 5, h: 12 }, // weapons to O2 junction
    { x: 79, y: 38, w: 10, h: 6 }, // navigation corridor
    { x: 81, y: 42, w: 5, h: 30 }, // right side down to shields
    { x: 60, y: 74, w: 17, h: 6 }, // storage to shields
    { x: 66, y: 78, w: 5, h: 3 } // communications entrance
  ],
  // The five cafeteria tables are physical, not painted-over floor.
  obstacles: [
    {x:43,y:9,rx:2,ry:1.65}, {x:57,y:9,rx:2,ry:1.65},
    {x:50,y:12,rx:2,ry:1.65}, {x:43,y:19,rx:2,ry:1.65}, {x:57,y:19,rx:2,ry:1.65}
  ],
  // Each network cycles within the original connected vent group.
  vents: [
    { id:'cafe', x:60, y:22, link:'admin' }, { id:'admin', x:64, y:53, link:'hall' },
    { id:'hall', x:51, y:34, link:'cafe' },
    { id:'weapons', x:77, y:13, link:'nav-upper' }, { id:'nav-upper', x:92, y:39, link:'weapons' },
    { id:'nav-lower', x:92, y:46, link:'shields' }, { id:'shields', x:83, y:76, link:'nav-lower' },
    { id:'elec', x:32, y:68, link:'security' }, { id:'security', x:24, y:50, link:'med' },
    { id:'med', x:31, y:36, link:'elec' },
    { id:'upper', x:20, y:16, link:'reactor-upper' }, { id:'reactor-upper', x:9, y:45, link:'upper' },
    { id:'lower', x:20, y:78, link:'reactor-lower' }, { id:'reactor-lower', x:9, y:55, link:'lower' }
  ],
  stations: [
    { id:'st-wires-elec', label:'أسلاك الكهرباء', kind:'wires', x:34, y:70, room:'electrical' },
    { id:'st-wires-shield', label:'تفعيل الدروع', kind:'shields', x:82, y:73, room:'shields' },
    { id:'st-wires-weapons', label:'تحميل بيانات الأسلحة', kind:'upload', x:75, y:16, room:'weapons' },
    { id:'st-hold-reactor', label:'تشغيل المفاعل', kind:'sequence', x:9, y:50, room:'reactor' },
    { id:'st-hold-nav', label:'تثبيت التوجيه', kind:'steering', x:94, y:42, room:'navigation' },
    { id:'st-hold-med', label:'فحص العيادة', kind:'scan', x:32, y:34, room:'medbay' },
    { id:'st-seq-weapons', label:'تدمير الكويكبات', kind:'asteroids', x:77, y:20, room:'weapons' },
    { id:'st-seq-admin', label:'بطاقة الإدارة', kind:'sequence', x:63, y:51, room:'admin' },
    { id:'st-seq-o2', label:'تنظيف فلتر الأوكسجين', kind:'filter', x:74, y:38, room:'o2' },
    { id:'st-up-storage', label:'تحميل البيانات', kind:'upload', x:52, y:80, room:'storage' },
    { id:'st-up-comms', label:'رفع البيانات', kind:'upload', x:68, y:85, room:'comms' },
    { id:'st-up-cafe', label:'سجل الكافتيريا', kind:'upload', x:50, y:15, room:'cafeteria' },
    { id:'st-upper', label:'محاذاة المحرك العلوي', kind:'alignment', x:19, y:20, room:'upper-engine' },
    { id:'st-lower', label:'محاذاة المحرك السفلي', kind:'alignment', x:19, y:79, room:'lower-engine' },
    { id:'st-security', label:'توزيع طاقة الأمن', kind:'upload', x:24, y:51, room:'security' }
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

/** Floor is shared by collision and line of sight; furnishings block movement. */
function isFloor(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 100 || y > 100) return false;
  const point = { x, y };
  return AU_MAP.rooms.some(room => insideRect(point, room)) || AU_MAP.corridors.some(hall => insideRect(point, hall));
}
export function isWalkable(x: number, y: number): boolean {
  return isFloor(x,y) && !AU_MAP.obstacles.some(o => ((x-o.x)/o.rx)**2 + ((y-o.y)/o.ry)**2 < 1);
}

// Security views are limited to four hallway regions, never the whole map.
export const AU_SECURITY_CONSOLE = { x: 24, y: 49 };
export const AU_CAMERA_VIEWS = [
  { id:'navigation', name:'ممر الملاحة', x:77, y:35, w:11, h:12 },
  { id:'admin', name:'ممر الإدارة', x:47, y:42, w:9, h:14 },
  { id:'medbay', name:'ممر العيادة', x:28, y:15, w:11, h:12 },
  { id:'security', name:'ممر الأمن', x:15, y:42, w:11, h:15 }
] as const;
export const AU_SABOTAGE_POINTS = {
  oxygen: [{id:'o2',x:74,y:38},{id:'admin',x:65,y:48}],
  reactor: [{id:'north',x:9,y:45},{id:'south',x:9,y:55}],
  lights: [{id:'lights',x:34,y:70}],
  comms: [{id:'comms',x:68,y:85}]
} as const;
const AU_CREW_VISION = 10;
const AU_IMPOSTOR_VISION = 15;
const AU_LIGHTS_VISION = 4;

/** Sample the actual walkable floor so walls block seeing and interaction. */
function clearSight(a: {x:number; y:number}, b: {x:number; y:number}): boolean {
  const steps = Math.max(1, Math.ceil(distance(a,b) * 3));
  for (let i=1; i<steps; i++) {
    const t=i/steps;
    if (!isFloor(a.x+(b.x-a.x)*t, a.y+(b.y-a.y)*t)) return false;
  }
  return true;
}
function canSee(room: AuRoomState, viewer: AuPlayer, target: {x:number; y:number}): boolean {
  const radius = !viewer.alive ? 20 : viewer.role === 'impostor' ? AU_IMPOSTOR_VISION : room.sabotage?.kind === 'lights' ? AU_LIGHTS_VISION : AU_CREW_VISION;
  return distance(viewer,target) <= radius && (!viewer.alive || clearSight(viewer,target));
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

// The link pointers form separate cycles; every exit in the same cycle is selectable.
function connectedVents(id: string): typeof AU_MAP.vents {
  const found: typeof AU_MAP.vents = [];
  let current = AU_MAP.vents.find(vent => vent.id === id);
  while (current && !found.some(vent => vent.id === current!.id)) {
    found.push(current); current = AU_MAP.vents.find(vent => vent.id === current!.link);
  }
  return found;
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
    x: CAFETERIA_SPAWN.x + (Math.random() * 6 - 3),
    y: CAFETERIA_SPAWN.y + (Math.random() * 2 - 1)
  };
  return {
    token: bot ? `bot_${Math.random().toString(36).slice(2, 9)}` : token(),
    publicId: token(),
    watchingCameras: false,
    ventId: null,
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
  if (room.practice) return false;
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
  const aliveCrewTasks = room.players.filter(player => player.role === 'crew').flatMap(player => player.tasks);
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
  const impostors = room.practice ? 0 : Math.max(
    1,
    Math.min(wantedImpostors, Math.max(1, Math.floor((players.length - 1) / 2)))
  );
  const order = shuffle(players.map((_, index) => index));
  const impostorIndexes = new Set(order.slice(0, impostors));
  players.forEach((player, index) => {
    player.role = impostorIndexes.has(index) ? 'impostor' : 'crew';
    player.alive = true;
    player.tasks = player.role === 'crew' ? dealTasks(room.practice ? AU_MAP.stations.length : settings.tasks) : [];
    player.x = CAFETERIA_SPAWN.x + (Math.random() * 6 - 3);
    player.y = CAFETERIA_SPAWN.y + (Math.random() * 2 - 1);
    player.emergencyUsed = false;
    player.lastKillAt = Date.now();
    player.votesGiven = false;
    player.target = null;
    player.nextThinkAt = 0;
    player.suspectToken = null;
    player.taskReadyAt = 0;
    player.moveSeq = 0;
    player.watchingCameras = false;
    player.ventId = null;
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
  room.meeting = { reason, calledBy, startedAt: now, endsAt: now + roomSettings(room).meetingMs, votes: {}, chat: [] };
  room.players.forEach(player => {
    player.votesGiven = false;
    player.watchingCameras = false;
    player.ventId = null;
    if (player.alive) {
      player.x = CAFETERIA_SPAWN.x + (Math.random() * 6 - 3);
      player.y = CAFETERIA_SPAWN.y + (Math.random() * 2 - 1);
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
    log(room, `انطرد ${ejected.name}${ejected.role === 'impostor' ? ' — كان مزوّراً' : ' — كان من الطاقم'}`);
  } else {
    log(room, 'ما انطرد أحد بهذا التصويت');
  }
  room.lastMeeting = { ejectedName: ejected ? ejected.name : null, ejectedRole: ejected ? ejected.role : null, tied, at: Date.now() };
  room.meeting = null;
  room.players.filter(player => player.role === 'impostor' && player.alive).forEach(player => { player.lastKillAt = Date.now(); });
  room.round += 1;
  if (!checkWin(room)) {
    room.phase = 'playing';
    room.players.forEach(player => {
      player.votesGiven = false;
      player.suspectToken = null;
      player.taskReadyAt = 0;
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

// Route bots through overlapping walkable rectangles instead of steering into walls.
function nextBotWaypoint(from: { x: number; y: number }, target: { x: number; y: number }): { x: number; y: number } {
  const rects = [...AU_MAP.rooms, ...AU_MAP.corridors];
  const starts = rects.map((rect, i) => insideRect(from, rect) ? i : -1).filter(i => i >= 0);
  const ends = new Set(rects.map((rect, i) => insideRect(target, rect) ? i : -1).filter(i => i >= 0));
  const prev = new Map<number, number>();
  const queue = [...starts];
  for (const i of starts) prev.set(i, -1);
  let end = -1;
  for (let n = 0; n < queue.length; n += 1) {
    const current = queue[n];
    if (ends.has(current)) { end = current; break; }
    const a = rects[current];
    for (let i = 0; i < rects.length; i += 1) {
      if (prev.has(i)) continue;
      const b = rects[i];
      if (Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) &&
          Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)) {
        prev.set(i, current); queue.push(i);
      }
    }
  }
  if (end < 0 || starts.includes(end)) return target;
  let step = end;
  while (!starts.includes(prev.get(step)!)) step = prev.get(step)!;
  const a = rects[prev.get(step)!], b = rects[step];
  return { x: (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2,
    y: (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2 };
}

/** Bots remember only nearby witnesses, not secret roles. */
function recordWitnesses(room: AuRoomState, killer: AuPlayer, victim: AuPlayer): void {
  for (const witness of room.players) {
    if (witness.bot && witness.role === 'crew' && witness.alive && witness.token !== killer.token && witness.token !== victim.token && canSee(room, witness, victim) && canSee(room, witness, killer)) {
      witness.suspectToken = killer.token;
    }
  }
}

function botThink(room: AuRoomState, bot: AuPlayer, now: number): void {
  if (room.phase !== 'playing' || (!bot.alive && bot.role !== 'crew')) return;
  const think = (bot.nextThinkAt || 0) <= now;
  if (think) {
    bot.nextThinkAt = now + 1300 + Math.random() * 800;
    const body = bot.alive && room.bodies.find(entry => distance(entry, bot) < 4 && clearSight(bot,entry));
    if (body) { startMeeting(room, 'report', bot.token); return; }
    if (bot.role === 'impostor') {
      const victim = nearestAliveCrew(room, bot, 4);
      const witnesses = victim ? room.players.filter(p => p.alive && p.token !== bot.token && p.token !== victim.token && canSee(room,p,victim)).length : 0;
      if (victim && witnesses === 0 && clearSight(bot,victim) && now - bot.lastKillAt >= roomSettings(room).killCooldownMs) {
        recordWitnesses(room, bot, victim);
        victim.alive = false; bot.lastKillAt = now;
        room.bodies.push({ playerId: victim.token, name: victim.name, color: victim.color, x: victim.x, y: victim.y, room: roomAt(victim.x, victim.y), at: now });
        log(room, 'صار قتل بالسفينة'); checkWin(room); return;
      }
      // Pursue only a nearby crewmate in a clear walkable line, never a hidden target.
      const nearby = nearestAliveCrew(room, bot, 14);
      if (nearby && Array.from({length:8}, (_, i) => (i + 1) / 8).every(t => isWalkable(bot.x + (nearby.x - bot.x) * t, bot.y + (nearby.y - bot.y) * t))) {
        bot.target = {x:nearby.x, y:nearby.y};
      }
      if (!room.sabotage && Math.random() < 0.025) {
        const kind: AuSabotage = (['reactor', 'oxygen', 'lights', 'comms'] as AuSabotage[])[Math.floor(Math.random() * 4)];
        applySabotage(room, kind);
      }
    }
    if (bot.role === 'crew' && bot.alive && room.sabotage) {
      const sab=room.sabotage; initializeSabotage(sab);
      const botIndex=room.players.filter(p => p.bot && p.role==='crew').findIndex(p => p.token===bot.token);
      const part = sab.kind==='reactor' ? (botIndex%2 ? 'north' : 'south') : sab.kind==='oxygen' ? (!(sab.fixed || []).includes('o2') ? 'o2' : 'admin') : sab.kind;
      const point = sabotagePoint(sab.kind,part);
      bot.taskReadyAt=0;
      if (point && distance(point, bot) < 3.5) {
        if(sab.kind==='reactor') {
          sab.holds![part]={token:bot.token,at:now}; bot.target=point;bot.taskReadyAt=now+3000;
          if(reactorFixed(room,sab,now)) finishSabotage(room,bot.name);
        } else if(sab.kind==='oxygen') {
          if(!sab.fixed!.includes(part))sab.fixed!.push(part); bot.target=null;
          if(sab.fixed!.includes('o2') && sab.fixed!.includes('admin'))finishSabotage(room,bot.name);
        } else {finishSabotage(room,bot.name);bot.target=null;}
      } else if (point) bot.target = point;
    } else if (bot.role === 'crew') {
      const nextTask = bot.tasks.find(task => !task.done);
      const station = nextTask && stationById(nextTask.station);
      if (nextTask && station) {
        bot.target = { x: station.x, y: station.y };
        if (distance(station, bot) < 2.5) {
          if (!bot.taskReadyAt) bot.taskReadyAt = now + 3500;
          if (now >= bot.taskReadyAt) { nextTask.done = true; bot.taskReadyAt = 0; bot.target = null; checkWin(room); }
        } else bot.taskReadyAt = 0;
      } else bot.target = null;
    }
    if (!bot.target || distance(bot.target, bot) < 1) {
      const destination = AU_MAP.rooms[Math.floor(Math.random() * AU_MAP.rooms.length)];
      if (!(bot.taskReadyAt && bot.role === 'crew')) bot.target = { x: destination.x + destination.w / 2, y: destination.y + destination.h / 2 };
    }
  }
  if (bot.target && !bot.taskReadyAt) {
    const waypoint = nextBotWaypoint(bot, bot.target);
    const dx = waypoint.x - bot.x, dy = waypoint.y - bot.y;
    const length = Math.hypot(dx, dy) || 1, step = Math.min(3.2, length);
    let next = clampToShip(bot.x + dx / length * step, bot.y + dy / length * step, bot);
    if (distance(next, bot) < 0.05) {
      const side = bot.token.charCodeAt(bot.token.length - 1) % 2 ? 1 : -1;
      for (const degrees of [45,90,135,180]) {
        const angle=side*degrees*Math.PI/180, vx=(dx*Math.cos(angle)-dy*Math.sin(angle))/length, vy=(dx*Math.sin(angle)+dy*Math.cos(angle))/length;
        const candidate=clampToShip(bot.x+vx*step,bot.y+vy*step,bot);
        if (distance(candidate,bot) > 0.05) {next=candidate;break;}
      }
    }
    bot.x = next.x; bot.y = next.y;
  }
}

function botVote(room: AuRoomState, now: number): boolean {
  const meeting = room.meeting;
  if (!meeting || now - meeting.startedAt < 5000) return false;
  let changed = false;
  for (const bot of room.players) {
    if (!bot.bot || !bot.alive || meeting.votes[bot.token]) continue;
    const suspect = room.players.find(p => p.alive && p.token === bot.suspectToken && p.token !== bot.token);
    meeting.votes[bot.token] = suspect ? suspect.token : 'skip';
    if (suspect) (meeting.chat ||= []).push({name:bot.name, text:`شفت ${suspect.name} قريب من الجريمة`});
    changed = true;
  }
  if (room.players.filter(p => p.alive).every(p => meeting.votes[p.token])) resolveMeeting(room);
  return changed;
}

function newCode(): string { return String(Math.floor(10000 + Math.random() * 90000)); }
function initializeSabotage(sab: AuSabotageState): void {
  sab.fixed ||= []; sab.codes ||= {o2:newCode(),admin:newCode()};
  sab.switches ||= [false,true,false,true,false];
  if (sab.frequency == null) sab.frequency=30+Math.floor(Math.random()*41);
  sab.holds ||= {};
}
function applySabotage(room: AuRoomState, kind: AuSabotage): void {
  if (room.phase !== 'playing') return;
  room.sabotage = { kind, endsAt: kind === 'lights' || kind === 'comms' ? 0 : Date.now() + AU_SABOTAGE_MS };
  initializeSabotage(room.sabotage);
  log(room, `تخريب: ${kind === 'reactor' ? 'المفاعل' : kind === 'oxygen' ? 'الأوكسجين' : kind === 'lights' ? 'الإنارة' : 'الاتصالات'}`);
}
function sabotagePoint(kind: AuSabotage, id: string): {id:string; x:number; y:number} | undefined {
  return AU_SABOTAGE_POINTS[kind].find(point => point.id === id);
}
function finishSabotage(room: AuRoomState, name: string): void {
  log(room, `أصلح ${name} التخريب`); room.sabotage=null;
}
function reactorFixed(room: AuRoomState, sab: AuSabotageState, now: number): boolean {
  const valid = (side: 'north' | 'south') => {
    const hold=sab.holds?.[side], point=sabotagePoint('reactor',side);
    const player=room.players.find(p => p.token === hold?.token);
    return hold && point && player && player.alive && !player.ventId && now-hold.at < 3500 && distance(point,player) <= 5 && clearSight(player,point) ? hold : null;
  };
  const a=valid('north'), b=valid('south');
  return Boolean(a && b && a.token !== b.token);
}

/** Runs timers, bot AI and win checks. Cheap enough to run on every poll. */
function tick(room: AuRoomState): boolean {
  const now = Date.now();
  let changed = false;

  if (room.phase === 'meeting' && room.meeting && now < room.meeting.endsAt && botVote(room, now)) changed = true;

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
  x: number | null;
  y: number | null;
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
  camerasActive: boolean;
  cameraFeeds: Array<{ id: string; name: string; x:number; y:number; w:number; h:number; players: Array<{id:string; name:string; color:string; x:number; y:number}>; bodies: AuBody[] }> | null;
  inVent: boolean;
  ventOptions: Array<{id:string; name:string}>;
  sabotage: AuPublicSabotage | null;
  meeting: {
    reason: 'report' | 'emergency';
    calledBy: string;
    endsAt: number;
    votes: Array<{ voter: string; target: string | null }>;
    chat: Array<{ name: string; text: string }>;
  } | null;
  lastMeeting: AuRoomState['lastMeeting'];
  winner: 'crew' | 'impostors' | null;
  endReason: string;
  progress: { done: number; total: number };
  killCooldownLeftMs: number;
  canStart: boolean;
  practice: boolean;
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
  if (room.sabotage) initializeSabotage(room.sabotage);
  const inGame = room.phase === 'playing';
  const cameraAllowed = Boolean(inGame && viewer && viewer.watchingCameras && distance(viewer,AU_SECURITY_CONSOLE) <= 4 && room.sabotage?.kind !== 'comms');
  const publicBody = (body: AuBody): AuBody => ({...body, playerId: room.players.find(p => p.token === body.playerId)?.publicId || ''});
  const cameraFeeds = cameraAllowed ? AU_CAMERA_VIEWS.map(view => {
    const center={x:view.x+view.w/2,y:view.y+view.h/2};
    return { ...view,
      players:room.players.filter(p => p.alive && !p.ventId && insideRect(p,view) && clearSight(center,p)).map(p => ({id:p.publicId || '',name:p.name,color:p.color,x:p.x,y:p.y})),
      bodies:room.bodies.filter(body => insideRect(body,view) && clearSight(center,body)).map(publicBody)
    };
  }) : null;
  const votes = room.meeting
    ? Object.entries(room.meeting.votes).map(([voter, target]) => ({
        voter: room.players.find(player => player.token === voter)?.name || voter,
        target: voter === viewerToken ? (target === 'skip' ? 'skip' : room.players.find(player => player.token === target)?.name || null) : null
      }))
    : [];
  return {
    code: room.code,
    practice: !!room.practice,
    phase: room.phase,
    players: room.players.map(player => {
      // Your own role, your fellow impostors, and everyone whose body was found
      // or who was ejected (dead players) are public.
      const visible = !inGame || (viewer && (player.token === viewer.token || (!player.ventId && (player.alive || !viewer.alive) && canSee(room, viewer, player))));
      // An unreported murder cannot be inferred from the roster or roles.
      const undiscovered = inGame && viewer?.alive && player.token !== viewer.token && !player.alive && room.bodies.some(b => b.playerId === player.token);
      const revealRole = (candidate: AuPlayer) =>
        candidate.token === viewerToken ||
        room.phase === 'ended' ||
        (!candidate.alive && !undiscovered) ||
        (viewerIsImpostor && candidate.role === 'impostor');
      return {
        token: player.token === viewerToken ? 'you' : (player.publicId || ''),
        name: player.name,
        color: player.color,
        bot: player.bot,
        alive: undiscovered ? true : player.alive,
        x: visible ? Math.round(player.x * 10) / 10 : null,
        y: visible ? Math.round(player.y * 10) / 10 : null,
        role: revealRole(player) ? player.role : null,
        tasks: player.token === viewerToken ? player.tasks : [],
        isHost: player.token === room.hostToken,
        you: player.token === viewerToken,
        voteReady: Boolean(room.meeting?.votes[player.token]),
        votedFor: player.token === viewerToken && room.meeting?.votes[player.token] ? (room.meeting.votes[player.token] === 'skip' ? 'skip' : (room.players.find(p => p.token === room.meeting?.votes[player.token])?.publicId || null)) : null,
        emergencyUsed: player.emergencyUsed
      };
    }),
    you: null,
    role: viewer ? viewer.role : null,
    bodies: inGame && viewer ? room.bodies.filter(body => canSee(room,viewer,body)).map(publicBody) : [],
    camerasActive: inGame && room.sabotage?.kind !== 'comms' && room.players.some(p => p.alive && p.watchingCameras && distance(p, AU_SECURITY_CONSOLE) <= 4),
    cameraFeeds,
    inVent: Boolean(inGame && viewer?.ventId),
    ventOptions: viewer?.ventId ? connectedVents(viewer.ventId).filter(vent => vent.id !== viewer.ventId).map(vent => ({id:vent.id, name:AU_MAP.rooms.find(room => insideRect(vent,room))?.name || 'الممر'})) : [],
    sabotage: room.sabotage ? {
      kind:room.sabotage.kind, endsAt:room.sabotage.endsAt, fixed:room.sabotage.fixed || [],
      codes:room.sabotage.codes || {}, switches:room.sabotage.switches || [], frequency:room.sabotage.frequency ?? 50,
      held:Object.entries(room.sabotage.holds || {}).filter(([,hold])=>now-hold.at<3500).map(([side])=>side)
    } : null,
    meeting: room.meeting
      ? {
          reason: room.meeting.reason,
          calledBy: room.players.find(player => player.token === room.meeting?.calledBy)?.name || '',
          endsAt: room.meeting.endsAt,
          votes,
          chat: room.meeting.chat || []
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
    log: inGame ? room.log.filter(entry => entry.text !== 'صار قتل بالسفينة').slice(-12) : room.log.slice(-12),
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
    if (room) {
      let migrated=false;
      for (const player of room.players) if (!player.publicId) { player.publicId=token(); migrated=true; }
      if (migrated) await this.storage.put(ROOM_KEY(key),room);
    }
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
        if (!room.players.some(p => p.token === viewer)) return fail('مو موجود بهذي الغرفة',403);
        if (tick(room)) await this.save(room);
        return json({ ok: true, room: publicRoom(room, viewer) });
      }

      const body: any = await request.json().catch(() => ({}));
      const action = String(body.action || '');

      if (action === 'create' || action === 'practice') {
        const code = randomCode();
        const room: AuRoomState = {
          code,
          practice: action === 'practice',
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
        if (room.practice) startMatch(room);
        else log(room, 'انفتحت غرفة جديدة');
        await this.save(room);
        if (!room.practice) await this.addToIndex(code);
        return json({ ok: true, code, token: host.token, room: publicRoom(room, host.token) });
      }

      const code = String(body.code || parts[3] || '').toUpperCase();
      const room = await this.load(code);
      if (!room) return fail('الغرفة غير موجودة أو انتهت', 404);

      if (action === 'join') {
        if (room.practice) return fail('التجربة الفردية خاصة');
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
          room.players = room.players.filter(player => (player.token !== botId && player.publicId !== botId) || !player.bot);
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
          if (room.phase !== 'playing' || me.ventId) break;
          if (Number.isSafeInteger(body.seq)) {
            if (body.seq <= (me.moveSeq || 0)) break;
            me.moveSeq = body.seq;
          }
          const next = me.alive ? clampToShip(Number(body.x), Number(body.y), me) : (Number.isFinite(Number(body.x)) && Number.isFinite(Number(body.y)) ? {x:Math.max(1,Math.min(99,Number(body.x))),y:Math.max(1,Math.min(99,Number(body.y)))} : {x:me.x,y:me.y});
          me.x = next.x;
          me.y = next.y;
          if (distance(me,AU_SECURITY_CONSOLE) > 4) me.watchingCameras = false;
          break;
        }
        case 'task': {
          if (me.role !== 'crew') return fail('المهام للطاقم بس');
          if (room.phase !== 'playing') break;
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
          if (room.phase !== 'playing' || !me.alive || me.ventId) break;
          if (Date.now() - me.lastKillAt < roomSettings(room).killCooldownMs) return fail('القتل بعده ما جاهز');
          const target = room.players.find(player => player.publicId === String(body.target || '') || player.token === String(body.target || ''));
          if (!target || !target.alive || target.ventId || target.role === 'impostor') return fail('هدف غير صالح');
          if (distance(me, target) > 4 || !clearSight(me,target)) return fail('قريب من الهدف أول');
          recordWitnesses(room, me, target);
          target.alive = false;
          me.lastKillAt = Date.now();
          room.bodies.push({ playerId: target.token, name: target.name, color: target.color, x: target.x, y: target.y, room: roomAt(target.x, target.y), at: Date.now() });
          checkWin(room);
          break;
        }
        case 'report': {
          if (room.phase !== 'playing' || !me.alive || me.ventId) break;
          const body2 = room.bodies.find(entry => distance(entry, me) < 5 && clearSight(me,entry));
          if (!body2) return fail('ماكو جثة قريبة');
          startMeeting(room, 'report', me.token);
          break;
        }
        case 'emergency': {
          if (room.practice) return fail('ماكو اجتماع بالتجربة الفردية');
          if (room.phase !== 'playing' || !me.alive || me.ventId) break;
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
          if (room.phase !== 'playing' || !me.alive || me.ventId) break;
          const sab=room.sabotage;
          if (!sab) break;
          initializeSabotage(sab);
          const part=String(body.part || ''), point=sabotagePoint(sab.kind,part);
          if (!point || distance(point,me) > 5 || !clearSight(me,point)) return fail('روح لمكان التخريب');
          if (sab.kind==='oxygen') {
            if (String(body.answer || '') !== sab.codes![part]) return fail('الرمز غلط');
            if (!sab.fixed!.includes(part)) sab.fixed!.push(part);
            if (sab.fixed!.includes('o2') && sab.fixed!.includes('admin')) finishSabotage(room,me.name);
          } else if (sab.kind==='reactor') {
            if (body.holding) sab.holds![part]={token:me.token,at:Date.now()};
            else if (sab.holds![part]?.token === me.token) delete sab.holds![part];
            if (reactorFixed(room,sab,Date.now())) finishSabotage(room,me.name);
          } else if (sab.kind==='lights') {
            const index=Number(body.index);
            if (!Number.isInteger(index) || index<0 || index>=5) return fail('مفتاح غير صالح');
            sab.switches![index]=!sab.switches![index];
            if (sab.switches!.every(Boolean)) finishSabotage(room,me.name);
          } else {
            const freq=Number(body.frequency);
            if (!Number.isFinite(freq) || Math.abs(freq-sab.frequency!)>4) return fail('اضبط التردد أكثر');
            finishSabotage(room,me.name);
          }
          break;
        }
        case 'vent': {
          if (me.role !== 'impostor') return fail('المزوّر بس يستخدم التهوية');
          if (room.phase !== 'playing' || !me.alive || me.ventId) break;
          const vent = AU_MAP.vents.find(entry => distance(entry, me) < 3 && clearSight(me,entry));
          if (!vent) return fail('ماكو فتحة تهوية قريبة');
          me.ventId = vent.id; me.x=vent.x; me.y=vent.y; me.watchingCameras=false;
          break;
        }
        case 'ventTravel': {
          if (room.phase !== 'playing' || !me.alive || me.role !== 'impostor' || !me.ventId) return fail('ما داخل التهوية');
          const target = connectedVents(me.ventId).find(vent => vent.id === String(body.target || ''));
          if (!target) return fail('هاي الفتحة مو متصلة');
          me.ventId = target.id; me.x = target.x; me.y = target.y;
          break;
        }
        case 'ventExit': {
          if (room.phase !== 'playing' || me.role !== 'impostor' || !me.ventId) return fail('ما داخل التهوية');
          me.ventId = null;
          break;
        }
        case 'cameras': {
          if (!body.enabled) { me.watchingCameras=false; break; }
          if (room.phase !== 'playing' || me.ventId || distance(me,AU_SECURITY_CONSOLE) > 4) return fail('روح لشاشة الأمن أول');
          if (room.sabotage?.kind === 'comms') return fail('الكاميرات متوقفة بسبب تخريب الاتصالات');
          me.watchingCameras=true;
          break;
        }
        case 'meetingChat': {
          if (room.phase !== 'meeting' || !room.meeting || !me.alive) return fail('الدردشة للّاعبين الأحياء بالاجتماع');
          const text = String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 160);
          if (!text) return fail('اكتب رسالة');
          const chat = room.meeting.chat ||= [];
          chat.push({name:me.name, text});
          if (chat.length > 40) chat.splice(0, chat.length - 40);
          break;
        }
        case 'vote': {
          if (room.phase !== 'meeting' || !room.meeting || !me.alive) break;
          if (room.meeting.votes[me.token]) return fail('صوّتت من قبل');
          const choice = String(body.target || 'skip');
          if (choice !== 'skip') {
            const targetPlayer = room.players.find(player => player.publicId === choice || player.token === choice);
            if (!targetPlayer || !targetPlayer.alive) return fail('هدف غير صالح');
            room.meeting.votes[me.token] = targetPlayer.token;
          } else room.meeting.votes[me.token] = 'skip';
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
