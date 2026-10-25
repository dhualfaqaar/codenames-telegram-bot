export type FootballDayOffset = -1 | 0 | 1;

export const FOOTBALL_TIMEZONES = [
  { id: 'Asia/Baghdad', label: '🇮🇶 العراق' },
  { id: 'Asia/Riyadh', label: '🇸🇦 السعودية' },
  { id: 'Asia/Dubai', label: '🇦🇪 الإمارات' },
  { id: 'Europe/London', label: '🇬🇧 لندن' },
  { id: 'Europe/Paris', label: '🇫🇷 باريس' },
  { id: 'America/New_York', label: '🇺🇸 نيويورك' }
] as const;

export type FootballTimezone = typeof FOOTBALL_TIMEZONES[number]['id'];

const COMPETITIONS = [
  { id: 'eng.1', label: 'الدوري الإنجليزي' },
  { id: 'esp.1', label: 'الدوري الإسباني' },
  { id: 'ger.1', label: 'الدوري الألماني' },
  { id: 'ita.1', label: 'الدوري الإيطالي' },
  { id: 'fra.1', label: 'الدوري الفرنسي' },
  { id: 'usa.1', label: 'الدوري الأمريكي' },
  { id: 'mex.1', label: 'الدوري المكسيكي' },
  { id: 'bra.1', label: 'الدوري البرازيلي' },
  { id: 'arg.1', label: 'الدوري الأرجنتيني' },
  { id: 'por.1', label: 'الدوري البرتغالي' },
  { id: 'tur.1', label: 'الدوري التركي' },
  { id: 'ksa.1', label: 'الدوري السعودي' },
  { id: 'ned.1', label: 'الدوري الهولندي' },
  { id: 'uefa.champions', label: 'دوري أبطال أوروبا' },
  { id: 'uefa.europa', label: 'الدوري الأوروبي' },
  { id: 'fifa.world', label: 'مباريات المنتخبات' },
  { id: 'fifa.friendly', label: 'مباريات ودية للمنتخبات' },
  { id: 'uefa.nations', label: 'دوري الأمم الأوروبية' },
  { id: 'uefa.euro', label: 'بطولات المنتخبات الأوروبية' },
  { id: 'concacaf.gold', label: 'كأس الكونكاكاف الذهبية' },
  { id: 'conmebol.america', label: 'كوبا أمريكا' },
  { id: 'afc.asian.cup', label: 'كأس آسيا' }
] as const;

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

function fixtureFromEvent(event: any, competition: string): FootballFixture | undefined {
  const match = event?.competitions?.[0];
  const competitors = match?.competitors || [];
  const home = competitors.find((team: any) => team.homeAway === 'home') || competitors[0];
  const away = competitors.find((team: any) => team.homeAway === 'away') || competitors[1];
  if (!home || !away || !event?.date) return undefined;
  return {
    id: String(event.id || `${event.date}-${home.team?.id}-${away.team?.id}`),
    competition: event?.leagues?.[0]?.name || competition,
    startAt: String(event.date),
    home: String(home.team?.displayName || home.team?.name || 'الفريق الأول'),
    away: String(away.team?.displayName || away.team?.name || 'الفريق الثاني'),
    homeScore: home.score === undefined ? undefined : String(home.score),
    awayScore: away.score === undefined ? undefined : String(away.score),
    status: String(event?.status?.type?.detail || event?.status?.type?.shortDetail || 'لم تبدأ'),
    state: stateForEvent(event)
  };
}

export async function getFootballFixtures(date: string, forceRefresh = false): Promise<FootballFixtureResult> {
  const cached = cache.get(date);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.result;

  const requests = COMPETITIONS.map(async competition => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.id}/scoreboard?dates=${date}&limit=100`;
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw new Error(`ESPN ${response.status}`);
    const payload = await response.json() as { events?: any[] };
    return (payload.events || []).map(event => fixtureFromEvent(event, competition.label)).filter(Boolean) as FootballFixture[];
  });

  const outcomes = await Promise.allSettled(requests);
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
