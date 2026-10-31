#!/usr/bin/env node
// Stream an exported public channel's PDF metadata; never include the files or
// unrelated message data. The resulting single JSON is sent to the bot owner.
import fs from 'node:fs';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import json from 'stream-json';
import pickModule from 'stream-json/filters/Pick.js';
import arrayModule from 'stream-json/streamers/StreamArray.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/build-lovekotob-import.mjs result.json lovekotob-import.json');
  process.exit(1);
}
const fd = fs.openSync(input, 'r');
const head = Buffer.alloc(16384);
const length = fs.readSync(fd, head, 0, head.length, 0);
fs.closeSync(fd);
const first = head.subarray(0, length).toString('utf8');
const readField = (field) => {
  const match = first.match(new RegExp(`"${field}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`));
  return match ? JSON.parse(match[1]) : '';
};
if (readField('name') !== 'مكتبة المليون كتاب' || readField('type') !== 'public_channel') throw new Error('Not the expected public channel export');
let batches = [], records = [], total = 0, skipped = 0;
const flush = () => {
  if (!records.length) return;
  const data = gzipSync(Buffer.from(JSON.stringify({ format: 'lovekotob-index-v1', records }), 'utf8'), { level: 9 }).toString('base64');
  if (data.length > 120000) throw new Error('Compressed batch is too large');
  batches.push(data);
  total += records.length;
  records = [];
};
const asText = raw => typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(x => typeof x === 'string' ? x : typeof x?.text === 'string' ? x.text : '').join('') : '';
const stream = arrayModule.streamArray();
const done = promisify(pipeline)(fs.createReadStream(input), json.parser(), pickModule.pick({ filter: 'messages' }), stream);
for await (const { value: message } of stream) {
  const file = String(message?.file_name || message?.file || '').replace(/\\/g, '/').split('/').pop() || '';
  if (!Number.isSafeInteger(message?.id) || message.id < 1 || message.type !== 'message') continue;
  if (message.mime_type !== 'application/pdf' && !/\.pdf$/i.test(file)) continue;
  const caption = asText(message.text).replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  const fileTitle = /\.pdf$/i.test(file) ? file.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const useful = fileTitle && !/^(file|document|\d+)(\s*\d+)?$/i.test(fileTitle);
  const title = (useful ? fileTitle : caption).slice(0, 150);
  if (title.length < 2) { skipped++; continue; }
  const text = `${caption} ${fileTitle}`.trim().slice(0, 500);
  records.push({ id: message.id, title, text });
  if (records.length >= 1000) flush();
}
await done;
flush();
const payload = JSON.stringify({ format: 'lovekotob-bulk-v1', source: 'lovekotob', count: total, batches });
if (Buffer.byteLength(payload) > 18 * 1024 * 1024) throw new Error('Import exceeds bot download limit');
fs.writeFileSync(output, payload, { flag: 'wx' });
console.log(JSON.stringify({ total, skipped, batches: batches.length, bytes: Buffer.byteLength(payload) }));
