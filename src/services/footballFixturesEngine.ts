export type FootballDayOffset = -1 | 0 | 1;

export const FOOTBALL_TIMEZONES = [
  { id: 'Asia/Baghdad', label: '🇮🇶 العراق' },
  { id: 'Asia/Dubai', label: '🇦🇪 الإمارات' },
  { id: 'Europe/London', label: '🇬🇧 لندن' },
  { id: 'Europe/Paris', label: '🇫🇷 باريس' },
  { id: 'America/New_York', label: '🇺🇸 نيويورك' }
] as const;

export type FootballTimezone = typeof FOOTBALL_TIMEZONES[number]['id'];
type CompetitionSource = 'espn' | 'thesportsdb';
interface CompetitionConfig { id: string; label: string; source?: CompetitionSource }

const COMPETITIONS: CompetitionConfig[] = [
  // الدوريات المطلوبة فقط
  { id: 'eng.1', label: 'الدوري الإنجليزي' },
  { id: 'esp.1', label: 'الدوري الإسباني' },
  { id: 'ger.1', label: 'الدوري الألماني' },
  { id: 'ita.1', label: 'الدوري الإيطالي' },
  { id: 'fra.1', label: 'الدوري الفرنسي' },
  { id: 'usa.1', label: 'الدوري الأمريكي MLS' },
  { id: 'ksa.1', label: 'الدوري السعودي' },
  // ESPN لا يوفر مساراً للدوري العراقي؛ نأخذ مبارياته من TheSportsDB.
  { id: '5056', label: 'الدوري العراقي', source: 'thesportsdb' },

  // مباريات المنتخبات للرجال فقط: البطولات، التصفيات الدولية، والوديات.
  { id: 'fifa.world', label: 'كأس العالم' },
  { id: 'fifa.world.u20', label: 'كأس العالم تحت 20' },
  { id: 'fifa.world.u17', label: 'كأس العالم تحت 17' },
  { id: 'fifa.olympics', label: 'أولمبياد الرجال' },
  { id: 'fifa.friendly', label: 'وديات المنتخبات' },
  { id: 'fifa.friendly_u21', label: 'وديات تحت 21' },
  { id: 'fifa.u20.friendly', label: 'وديات تحت 20' },
  { id: 'fifa.worldq', label: 'تصفيات كأس العالم' },
  { id: 'fifa.worldq.uefa', label: 'تصفيات أوروبا لكأس العالم' },
  { id: 'fifa.worldq.caf', label: 'تصفيات أفريقيا لكأس العالم' },
  { id: 'fifa.worldq.afc', label: 'تصفيات آسيا لكأس العالم' },
  { id: 'fifa.worldq.concacaf', label: 'تصفيات الكونكاكاف لكأس العالم' },
  { id: 'fifa.worldq.conmebol', label: 'تصفيات أمريكا الجنوبية لكأس العالم' },
  { id: 'fifa.worldq.ofc', label: 'تصفيات أوقيانوسيا لكأس العالم' },
  { id: 'uefa.euro', label: 'بطولات المنتخبات الأوروبية' },
  { id: 'uefa.nations', label: 'دوري الأمم الأوروبية' },
  { id: 'conmebol.america', label: 'كوبا أمريكا' },
  { id: 'concacaf.gold', label: 'الكأس الذهبية للكونكاكاف' },
  { id: 'afc.asian.cup', label: 'كأس آسيا' },
  { id: 'caf.nations', label: 'كأس أمم أفريقيا' },
  { id: 'ofc.nations', label: 'كأس أمم أوقيانوسيا' }
];

export interface FootballFixture {
  id: string;
  competition: string;
  startAt: string;
  home: string;
  away: string;
  homeScore?: string;
  awayScore?: string;
  status: string;
  state: 'scheduled' | 'live' | 'finished' | 'postponed';
}

export interface FootballFixtureResult {
  date: string;
  fixtures: FootballFixture[];
  unavailable: boolean;
}

const cache = new Map<string, { fetchedAt: number; result: FootballFixtureResult }>();
const CACHE_TTL_MS = 30 * 1000;

function partsForDate(date: Date, timeZone: string): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
}

export function footballDate(offset: FootballDayOffset, now = new Date()): string {
  const baghdad = partsForDate(now, 'Asia/Baghdad');
  const date = new Date(Date.UTC(Number(baghdad.year), Number(baghdad.month) - 1, Number(baghdad.day) + offset));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isFootballTimezone(value: string): value is FootballTimezone {
  return FOOTBALL_TIMEZONES.some(zone => zone.id === value);
}

export function footballTimezoneLabel(value: string): string {
  return FOOTBALL_TIMEZONES.find(zone => zone.id === value)?.label || '🇮🇶 العراق';
}

export function formatFootballKickoff(isoDate: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('ar-IQ', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(isoDate));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoDate));
  }
}

export function footballDayTitle(offset: FootballDayOffset): string {
  if (offset === -1) return 'مباريات أمس';
  if (offset === 1) return 'مباريات باچر';
  return 'مباريات اليوم';
}

function stateForEvent(event: any): FootballFixture['state'] {
  const statusText = `${event?.status?.type?.name || ''} ${event?.status?.type?.detail || ''} ${event?.status?.type?.shortDetail || ''}`;
  if (/postpon|delay|cancel|suspend|abandon/i.test(statusText)) return 'postponed';
  if (event?.status?.type?.completed || event?.status?.type?.state === 'post') return 'finished';
  if (event?.status?.type?.state === 'in') return 'live';
  return 'scheduled';
}

function fixtureFromEspnEvent(event: any, competition: string): FootballFixture | undefined {
  const competitors = event?.competitions?.[0]?.competitors || [];
  const home = competitors.find((team: any) => team.homeAway === 'home') || competitors[0];
  const away = competitors.find((team: any) => team.homeAway === 'away') || competitors[1];
  if (!home || !away || !event?.date) return undefined;
  return {
    id: String(event.id || `${event.date}-${home.team?.id}-${away.team?.id}`),
    competition,
    startAt: String(event.date),
    home: String(home.team?.displayName || home.team?.name || 'الفريق الأول'),
    away: String(away.team?.displayName || away.team?.name || 'الفريق الثاني'),
    homeScore: home.score === undefined ? undefined : String(home.score),
    awayScore: away.score === undefined ? undefined : String(away.score),
    status: String(event?.status?.type?.detail || event?.status?.type?.shortDetail || 'لم تبدأ'),
    state: stateForEvent(event)
  };
}

function fixtureFromSportsDbEvent(event: any): FootballFixture | undefined {
  if (!event?.strHomeTeam || !event?.strAwayTeam || (!event?.strTimestamp && !event?.dateEvent)) return undefined;
  const rawTimestamp = String(event.strTimestamp || `${event.dateEvent}T${event.strTime || '00:00:00'}`);
  const startAt = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawTimestamp) ? rawTimestamp : `${rawTimestamp}Z`;
  const rawStatus = String(event?.strStatus || 'مجدولة');
  const postponed = /yes|true|postpon/i.test(String(event?.strPostponed || '')) || /postpon|cancel|suspend/i.test(rawStatus);
  const live = /live|half|in progress|1st|2nd|\b(?:1h|2h|ht|et|bt)\b/i.test(rawStatus);
  const finished = /ft|full.?time|aet|pen/i.test(rawStatus);
  return {
    id: String(event.idEvent || `${event.dateEvent}-${event.strHomeTeam}-${event.strAwayTeam}`),
    competition: 'الدوري العراقي',
    startAt,
    home: String(event.strHomeTeam),
    away: String(event.strAwayTeam),
    homeScore: event.intHomeScore == null ? undefined : String(event.intHomeScore),
    awayScore: event.intAwayScore == null ? undefined : String(event.intAwayScore),
    status: postponed ? 'تأجلت' : /^(?:ns|scheduled)$/i.test(rawStatus) ? 'لم تبدأ' : rawStatus,
    state: postponed ? 'postponed' : live ? 'live' : finished ? 'finished' : 'scheduled'
  };
}

async function fetchCompetition(competition: CompetitionConfig, date: string): Promise<FootballFixture[]> {
  if (competition.source === 'thesportsdb') {
    const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${isoDate}&l=${competition.id}`;
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`TheSportsDB ${response.status}`);
    const payload = await response.json() as { events?: any[] | null };
    return (payload.events || []).map(fixtureFromSportsDbEvent).filter(Boolean) as FootballFixture[];
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.id}/scoreboard?dates=${date}&limit=100`;
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`ESPN ${response.status}`);
  const payload = await response.json() as { events?: any[] };
  return (payload.events || []).map(event => fixtureFromEspnEvent(event, competition.label)).filter(Boolean) as FootballFixture[];
}

export async function getFootballFixtures(date: string, forceRefresh = false): Promise<FootballFixtureResult> {
  const cached = cache.get(date);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.result;

  const outcomes = await Promise.allSettled(COMPETITIONS.map(competition => fetchCompetition(competition, date)));
  const byId = new Map<string, FootballFixture>();
  for (const outcome of outcomes) {
    if (outcome.status !== 'fulfilled') continue;
    for (const fixture of outcome.value) byId.set(fixture.id, fixture);
  }
  const fixtures = Array.from(byId.values()).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const result = { date, fixtures, unavailable: outcomes.every(outcome => outcome.status === 'rejected') };
  cache.set(date, { fetchedAt: Date.now(), result });
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  return result;
}
