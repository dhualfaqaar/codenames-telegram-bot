export type VideoShape = 'circle' | 'star' | 'hexagon' | 'pentagon' | 'triangle';
export type ShapeJobResult = 'accepted' | 'busy' | 'unavailable';
export type ShapeVideoSubmitter = (job: { chatId: string; fileId: string; shape: VideoShape }) => Promise<ShapeJobResult>;

/** The processor must be an HTTPS service controlled by the bot owner. */
export function createShapeVideoSubmitter(rawUrl: string | undefined, secret: string | undefined): ShapeVideoSubmitter | null {
  if (!rawUrl || !secret || secret.length < 32) return null;
  let endpoint: URL;
  try {
    const base = new URL(rawUrl);
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return null;
    endpoint = new URL('/jobs', base);
  } catch { return null; }
  return async job => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${secret}` },
        body: JSON.stringify(job), redirect:'error', signal: AbortSignal.timeout(15000)
      });
      if (response.status === 429) return 'busy';
      return response.status === 202 ? 'accepted' : 'unavailable';
    } catch { return 'unavailable'; }
  };
}
