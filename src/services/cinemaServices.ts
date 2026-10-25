export type CinemaSubtitleKind = 'movie' | 'series';

export interface AnimeRecognition {
  title: string;
  nativeTitle?: string;
  episode?: string | number;
  fromSeconds?: number;
  toSeconds?: number;
  similarity: number;
  source: string;
}

export type VisualStyle = 'live_action' | 'anime' | 'western_animation' | 'unknown';

export interface VisualRecognition {
  title: string;
  originalTitle?: string;
  year?: string;
  kind?: string;
  visualStyle: VisualStyle;
  confidenceScore: number;
  note?: string;
}

export type CinemaRecognition =
  | { type: 'anime'; recognition: AnimeRecognition }
  | { type: 'visual'; recognition: VisualRecognition };

export interface OpenSubtitleResult {
  fileId: string;
  fileName: string;
  language: string;
  downloads: number;
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  release?: string;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

export function parseEpisodeInput(input: string): { season: number; episode: number } | null {
  const normalized = String(input || '')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .trim();
  const patterns = [
    /(?:s(?:eason)?\s*)?(\d{1,2})\s*(?:e|x|×|\.|:|-)\s*(\d{1,3})/i,
    /(?:الموسم|موسم)\s*(\d{1,2})\D+(?:الحلقة|حلقة|ح)\s*(\d{1,3})/i
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const season = Number(match[1]);
    const episode = Number(match[2]);
    if (season > 0 && season <= 99 && episode > 0 && episode <= 999) return { season, episode };
  }
  return null;
}

export async function identifyAnimeScreenshot(bytes: Uint8Array, mimeType: string, minimumSimilarity = 0.8): Promise<AnimeRecognition | null> {
  const form = new FormData();
  form.append('image', new Blob([bytes as unknown as ArrayBuffer], { type: mimeType || 'image/jpeg' }), 'frame.jpg');
  const response = await fetch('https://api.trace.moe/search?anilistInfo&cutBorders', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(18_000)
  });
  if (!response.ok) throw new Error(`anime identification HTTP ${response.status}`);
  const payload: any = await response.json();
  const results: any[] = Array.isArray(payload?.result) ? payload.result : [];
  const best = results
    .filter(result => Number(result?.similarity) >= minimumSimilarity && result?.anilist)
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))[0];
  if (!best) return null;
  const titles = best.anilist.title || {};
  const title = String(titles.english || titles.romaji || titles.native || '').trim();
  if (!title) return null;
  return {
    title,
    nativeTitle: titles.native ? String(titles.native) : undefined,
    episode: best.episode === null || best.episode === undefined ? undefined : String(best.episode),
    fromSeconds: Number.isFinite(Number(best.from)) ? Number(best.from) : undefined,
    toSeconds: Number.isFinite(Number(best.to)) ? Number(best.to) : undefined,
    similarity: Number(best.similarity),
    source: 'AniList / trace.moe'
  };
}

export async function identifyVisualTitle(
  bytes: Uint8Array,
  mimeType: string,
  geminiApiKey: string
): Promise<VisualRecognition | null> {
  if (!geminiApiKey) return null;
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: 'You are identifying a work from one screenshot. Analyze the visual medium before naming the work. Return only JSON with fields: {"visual_style":"live_action|anime|western_animation|unknown","title":"exact recognized film or series title, or empty string","original_title":"...","year":"YYYY or empty","kind":"movie|series|anime|unknown","confidence":0,"note":"brief visual evidence or uncertainty"}. IMPORTANT: A photographic frame with real actors MUST be live_action, never anime, regardless of actors’ ethnicity, genre, costumes, fantasy effects, or subject. anime means unmistakably Japanese animation; western cartoons/CG animation are western_animation. Do not infer anime from a trace/search guess. Identify titles only from distinctive visual evidence in this frame, not a generic actor, genre, or plot guess. If the image is a poster, collage, blurry, generic, or not clearly identifiable, return an empty title and confidence below 60. Confidence is an integer 0-100. Be conservative and prefer no answer over a wrong title.'
            },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64FromBytes(bytes) } }
          ]
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(25_000)
    }
  );
  if (!response.ok) throw new Error(`visual recognition HTTP ${response.status}`);
  const payload: any = await response.json();
  const text = String(payload?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || '').join('') || '').trim();
  if (!text) return null;
  const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { parsed = JSON.parse(jsonText.slice(start, end + 1)); } catch { return null; }
  }
  const rawStyle = String(parsed?.visual_style || parsed?.visualStyle || '').toLowerCase().replace(/[ -]/g, '_');
  const visualStyle: VisualStyle = rawStyle.includes('live') || rawStyle.includes('photo') || rawStyle.includes('real_actor')
    ? 'live_action'
    : rawStyle.includes('anime')
      ? 'anime'
      : rawStyle.includes('western') || rawStyle.includes('cartoon') || rawStyle.includes('animation')
        ? 'western_animation'
        : 'unknown';
  const rawConfidence = parsed?.confidence ?? parsed?.confidence_score;
  const confidenceWords: Record<string, number> = { high: 85, medium: 68, low: 40 };
  const confidenceScore = Number.isFinite(Number(rawConfidence))
    ? Math.max(0, Math.min(100, Number(rawConfidence)))
    : confidenceWords[String(rawConfidence || '').toLowerCase()] || 0;
  const title = String(parsed?.title || '').trim().slice(0, 160);
  const kindRaw = String(parsed?.kind || '').toLowerCase();
  const kind = /anime/.test(kindRaw) ? 'anime'
    : /movie|film/.test(kindRaw) ? 'movie'
      : /series|show|tv/.test(kindRaw) ? 'series'
        : 'unknown';
  const normalizedTitle = /^(unknown|غير معروف|لا أعرف|none|n\/a)$/i.test(title) ? '' : title;
  return {
    title: normalizedTitle,
    originalTitle: String(parsed?.original_title || parsed?.originalTitle || '').trim().slice(0, 160) || undefined,
    year: String(parsed?.year || '').match(/\b(?:18|19|20)\d{2}\b/)?.[0],
    kind,
    visualStyle,
    confidenceScore,
    note: String(parsed?.note || '').slice(0, 220) || undefined
  };
}

/**
 * Classify the medium with Gemini first, then consult trace.moe only for a frame
 * independently classified as anime. This prevents a visual-search false positive
 * from relabelling a live-action film as anime.
 */
export async function identifyCinemaScreenshot(
  bytes: Uint8Array,
  mimeType: string,
  geminiApiKey: string
): Promise<CinemaRecognition | null> {
  let visual: VisualRecognition | null = null;
  if (geminiApiKey) {
    try {
      visual = await identifyVisualTitle(bytes, mimeType, geminiApiKey);
    } catch {
      // If the vision model is temporarily unavailable, only accept a near-certain anime match below.
    }
  }

  if (visual?.visualStyle === 'live_action' || visual?.visualStyle === 'western_animation') {
    return visual.title && visual.confidenceScore >= 70 ? { type: 'visual', recognition: visual } : null;
  }

  if (visual?.visualStyle === 'anime') {
    const anime = await identifyAnimeScreenshot(bytes, mimeType, 0.8).catch(() => null);
    if (anime) return { type: 'anime', recognition: anime };
    return visual.title && visual.confidenceScore >= 70 ? { type: 'visual', recognition: visual } : null;
  }

  if (visual) {
    // A successful classifier that calls the image unknown must veto anime-only matching.
    return null;
  }

  // Classifier unavailable: use anime matching only at an exceptionally high threshold.
  const animeFallback = await identifyAnimeScreenshot(bytes, mimeType, 0.97).catch(() => null);
  if (animeFallback) return { type: 'anime', recognition: animeFallback };
  return null;
}

function openSubtitlesHeaders(apiKey: string, userAgent: string): HeadersInit {
  return {
    'Api-Key': apiKey,
    'User-Agent': userAgent || 'CodenamesTelegramBot v1.0',
    Accept: 'application/json'
  };
}

export async function searchOpenSubtitles(options: {
  apiKey: string;
  userAgent: string;
  title: string;
  kind: CinemaSubtitleKind;
  season?: number;
  episode?: number;
}): Promise<OpenSubtitleResult[]> {
  if (!options.apiKey) throw new Error('OPEN_SUBTITLES_API_KEY is not configured');
  const params = new URLSearchParams({
    query: options.title.slice(0, 100),
    languages: 'ar,en',
    type: options.kind === 'movie' ? 'movie' : 'episode',
    order_by: 'download_count',
    order_direction: 'desc'
  });
  if (options.kind === 'series' && options.season && options.episode) {
    params.set('season_number', String(options.season));
    params.set('episode_number', String(options.episode));
  }
  const response = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, {
    headers: openSubtitlesHeaders(options.apiKey, options.userAgent),
    signal: AbortSignal.timeout(18_000)
  });
  if (!response.ok) throw new Error(`OpenSubtitles search HTTP ${response.status}`);
  const payload: any = await response.json();
  const records: any[] = Array.isArray(payload?.data) ? payload.data : [];
  const results: OpenSubtitleResult[] = [];
  for (const record of records) {
    const attributes = record?.attributes || {};
    const details = attributes.feature_details || {};
    const file = Array.isArray(attributes.files) ? attributes.files[0] : null;
    const resultSeason = Number(details.season_number) || undefined;
    const resultEpisode = Number(details.episode_number) || undefined;
    if (options.kind === 'series' && options.season && resultSeason && resultSeason !== options.season) continue;
    if (options.kind === 'series' && options.episode && resultEpisode && resultEpisode !== options.episode) continue;
    const language = String(attributes.language || '').toLowerCase();
    if (!file?.file_id || !['ar', 'en'].includes(language)) continue;
    results.push({
      fileId: String(file.file_id),
      fileName: String(file.file_name || 'subtitle.srt').replace(/[\r\n\u0000-\u001f]/g, '_').slice(0, 120),
      language,
      downloads: Math.max(0, Number(attributes.download_count) || 0),
      title: String(details.title || details.movie_name || options.title).slice(0, 160),
      year: Number.isFinite(Number(details.year)) ? Number(details.year) : undefined,
      season: Number.isFinite(Number(details.season_number)) ? Number(details.season_number) : undefined,
      episode: Number.isFinite(Number(details.episode_number)) ? Number(details.episode_number) : undefined,
      release: String(attributes.release || '').slice(0, 140) || undefined
    });
  }
  return results
    .sort((a, b) => (a.language === b.language ? b.downloads - a.downloads : a.language === 'ar' ? -1 : 1))
    .slice(0, 10);
}

export async function downloadOpenSubtitle(options: {
  apiKey: string;
  userAgent: string;
  fileId: string;
}): Promise<{ bytes: Uint8Array; fileName: string }> {
  if (!options.apiKey) throw new Error('OPEN_SUBTITLES_API_KEY is not configured');
  const response = await fetch('https://api.opensubtitles.com/api/v1/download', {
    method: 'POST',
    headers: {
      ...openSubtitlesHeaders(options.apiKey, options.userAgent),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ file_id: Number(options.fileId), sub_format: 'srt' }),
    signal: AbortSignal.timeout(18_000)
  });
  if (!response.ok) throw new Error(`OpenSubtitles download HTTP ${response.status}`);
  const payload: any = await response.json();
  const link = String(payload?.link || '');
  if (!link) throw new Error('OpenSubtitles did not return a subtitle link');
  const downloadUrl = new URL(link);
  if (downloadUrl.protocol !== 'https:') throw new Error('subtitle download URL must use HTTPS');
  const fileResponse = await fetch(downloadUrl.toString(), { signal: AbortSignal.timeout(25_000) });
  if (!fileResponse.ok) throw new Error(`subtitle file HTTP ${fileResponse.status}`);
  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  if (!bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error('subtitle file size is invalid');
  const fileName = String(payload?.file_name || 'subtitle.srt').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return { bytes, fileName: fileName.toLowerCase().endsWith('.srt') ? fileName : `${fileName}.srt` };
}
