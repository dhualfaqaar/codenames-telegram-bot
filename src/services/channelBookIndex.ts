import { normalizeQuery, type BookStorageAdapter } from './bookCatalog';

/** بيانات عامة من تصدير رسائل القناة، لا تثبت حق نشر الملف. */
export interface ChannelBookRecord {
  id: number;
  title: string;
  text: string;
}

const RECORD = 'books:channel-index:record:';
const TERM = 'books:channel-index:term:';
const MAX_BATCH = 1000;

export function channelNameKey(value: string): string {
  return normalizeQuery(String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

const STOP_WORDS = new Set(['كتاب', 'كتب', 'روايه', 'روايات', 'الكاتب', 'كاتب', 'للكاتب', 'المؤلف', 'مؤلف', 'تاليف', 'تأليف', 'بقلم', 'pdf', 'by']);

/** صيغ متقاربة للبحث فقط، وليست دليلاً على هوية الكتاب أو حق نشره. */
function canonicalWord(value: string): string {
  let word = value;
  if (/^لل[\u0621-\u064a]{3,}$/.test(word)) word = `ال${word.slice(2)}`;
  else if (/^ل[\u0621-\u064a]{4,}$/.test(word)) word = word.slice(1);
  if (/^ال[\u0621-\u064a]{3,}$/.test(word)) word = word.slice(2);
  return word;
}

function rawWords(value: string): string[] {
  return channelNameKey(value).split(' ').filter(word => word.length >= 2 && word.length <= 40);
}

function normalizedSearchText(title: string, text: string): string {
  const words = rawWords(`${title} ${text}`);
  return [...words, ...words.map(canonicalWord)].join(' ');
}

export function channelSearchTokens(value: string): string[] {
  return [...new Set(rawWords(value).filter(word => !STOP_WORDS.has(word)).map(canonicalWord).filter(word => word.length >= 2))];
}

/** معرّف الرسالة يميّز السجلات؛ مؤشر الكلمات مقسّم بمفاتيح مستقلة. */
export class ChannelBookIndex {
  constructor(private storage: BookStorageAdapter) {
    // Durable Object يدعم FTS5، فيبحث بين كل السجلات المستوردة بلا تحميلها للذاكرة.
    this.storage.sql?.exec("CREATE VIRTUAL TABLE IF NOT EXISTS channel_book_fts USING fts5(title UNINDEXED, text UNINDEXED, searchable, tokenize='unicode61 remove_diacritics 2')");
  }

  async importBatch(raw: unknown): Promise<number> {
    const batch: any = raw;
    if (batch?.format !== 'lovekotob-index-v1' || !Array.isArray(batch.records) || batch.records.length > MAX_BATCH) throw new Error('invalid batch');
    let added = 0;
    for (const item of batch.records) {
      if (!Number.isSafeInteger(item?.id) || item.id < 1 || item.id > 999999999999 || typeof item?.title !== 'string' || typeof item?.text !== 'string') continue;
      const title = item.title.replace(/\s+/g, ' ').trim().slice(0, 150);
      const text = item.text.replace(/\s+/g, ' ').trim().slice(0, 500);
      const tokens = channelSearchTokens(`${title} ${text}`).slice(0, 24);
      if (title.length < 2 || !tokens.length) continue;
      if (this.storage.sql) {
        this.storage.sql.exec('DELETE FROM channel_book_fts WHERE rowid = ?', item.id);
        this.storage.sql.exec('INSERT INTO channel_book_fts(rowid, title, text, searchable) VALUES (?, ?, ?, ?)', item.id, title, text, normalizedSearchText(title, text));
        added++;
        continue;
      }
      const id = String(item.id).padStart(12, '0');
      const key = RECORD + id;
      const existing = await this.storage.get<ChannelBookRecord>(key);
      if (existing) {
        for (const word of channelSearchTokens(`${existing.title} ${existing.text}`).slice(0, 24)) {
          await this.storage.delete(`${TERM}${encodeURIComponent(word)}:${id}`);
        }
      }
      const record = { id: item.id, title, text };
      await this.storage.put(key, record);
      for (const word of tokens) await this.storage.put(`${TERM}${encodeURIComponent(word)}:${id}`, record);
      added++;
    }
    return added;
  }

  async get(id: string): Promise<ChannelBookRecord | undefined> {
    if (!/^\d{1,12}$/.test(id) || Number(id) < 1) return undefined;
    if (this.storage.sql) {
      const rows = [...this.storage.sql.exec('SELECT rowid AS id, title, text FROM channel_book_fts WHERE rowid = ?', Number(id))];
      return rows[0] as ChannelBookRecord | undefined;
    }
    return this.storage.get<ChannelBookRecord>(RECORD + id.padStart(12, '0'));
  }

  async search(query: string, limit = 5): Promise<ChannelBookRecord[]> {
    const tokens = channelSearchTokens(query).sort((a, b) => b.length - a.length);
    if (!tokens.length) return [];
    if (this.storage.sql) {
      // جرّب الكلمات الكاملة أولاً؛ البادئات فقط إذا ماكو أي تطابق كامل.
      const terms = tokens.slice(0, 8).map(token => `"${token.replace(/"/g, '""')}"`);
      const select = 'SELECT rowid AS id, title, text FROM channel_book_fts WHERE channel_book_fts MATCH ? ORDER BY rank, rowid DESC LIMIT 2000';
      let rows = [...this.storage.sql.exec(select, terms.join(' AND '))] as ChannelBookRecord[];
      if (!rows.length) rows = [...this.storage.sql.exec(select, terms.map(term => `${term}*`).join(' AND '))] as ChannelBookRecord[];
      const queryKey = channelNameKey(query);
      const score = (record: ChannelBookRecord): number => {
        const titleWords = channelSearchTokens(record.title);
        const inTitle = tokens.every(token => titleWords.some(word => word === token));
        const titleKey = channelNameKey(record.title);
        return (titleKey === queryKey ? 1000 : 0) + (titleKey.startsWith(`${queryKey} `) ? 100 : 0) + (inTitle ? 500 : 0) - titleWords.length;
      };
      const ranked = rows.map(record => ({ record, score: score(record) })).sort((left, right) => right.score - left.score || right.record.id - left.record.id);
      const unique = new Map<string, ChannelBookRecord>();
      for (const { record } of ranked) {
        const titleWords = channelSearchTokens(record.title);
        const extraWords = channelSearchTokens(record.text).filter(word => !titleWords.includes(word) && !['lovekitab', 'forever'].includes(word));
        const key = `${[...titleWords].sort().join(' ')}|${extraWords.sort().join(' ')}`;
        if (!unique.has(key)) unique.set(key, record);
      }
      return [...unique.values()].slice(0, Math.max(1, Math.min(limit, 10)));
    }
    // النسخة المحلية بلا SQLite محدودة لمنع تحميل فهرس كبير بالذاكرة.
    const entries = await this.storage.list<ChannelBookRecord>({ prefix: `${TERM}${encodeURIComponent(tokens[0])}`, limit: 1000 });
    const seen = new Set<number>();
    const matches: Array<{ record: ChannelBookRecord; score: number }> = [];
    for (const record of entries.values()) {
      if (!record || seen.has(record.id)) continue;
      const words = channelSearchTokens(`${record.title} ${record.text}`);
      if (!tokens.every(token => words.some(word => word.startsWith(token)))) continue;
      seen.add(record.id);
      const title = channelNameKey(record.title);
      const score = (title === channelNameKey(query) ? 100 : 0) + tokens.filter(token => title.includes(token)).length * 5;
      matches.push({ record, score });
    }
    return matches.sort((a, b) => b.score - a.score || b.record.id - a.record.id).slice(0, Math.max(1, Math.min(limit, 10))).map(item => item.record);
  }
}
