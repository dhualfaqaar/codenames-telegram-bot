#!/usr/bin/env node
// Offline, streaming conversion of a Telegram Desktop channel export into small
// owner-importable batches. Only PDF names/captions/message IDs are emitted.
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import json from 'stream-json';
import pickModule from 'stream-json/filters/Pick.js';
import arrayModule from 'stream-json/streamers/StreamArray.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/split-lovekotob-export.mjs result.json output-directory');
  process.exit(1);
}
const fd = fs.openSync(input, 'r');
const header = Buffer.alloc(16384);
const size = fs.readSync(fd, header, 0, header.length, 0);
fs.closeSync(fd);
const first = header.subarray(0, size).toString('utf8');
const nameMatch = first.match(/"name"\s*:\s*("(?:\\.|[^"\\])*")/);
const typeMatch = first.match(/"type"\s*:\s*("(?:\\.|[^"\\])*")/);
const name = nameMatch ? JSON.parse(nameMatch[1]) : '';
const type = typeMatch ? JSON.parse(typeMatch[1]) : '';
if (name !== 'مكتبة المليون كتاب' || type !== 'public_channel') {
  console.error('This is not the expected public channel export. No files written.');
  process.exit(1);
}
fs.mkdirSync(output, { recursive: true });
let records = [], files = 0, total = 0;
const flush = () => {
  if (!records.length) return;
  const filename = path.join(output, `lovekotob-index-${String(++files).padStart(6, '0')}.json`);
  fs.writeFileSync(filename, JSON.stringify({ format: 'lovekotob-index-v1', records }), { flag: 'wx' });
  total += records.length;
  records = [];
};
function asText(raw) {
  if (typeof raw === 'string') return raw;
  return Array.isArray(raw) ? raw.map(x => typeof x === 'string' ? x : typeof x?.text === 'string' ? x.text : '').join('') : '';
}
const parser = json.parser();
const picker = pickModule.pick({ filter: 'messages' });
const stream = arrayModule.streamArray();
const done = promisify(pipeline)(fs.createReadStream(input), parser, picker, stream);
for await (const { value: message } of stream) {
  const file = String(message?.file_name || message?.file || '').replace(/\\/g, '/').split('/').pop() || '';
  if (!Number.isSafeInteger(message?.id) || message.id < 1 || message.type !== 'message') continue;
  if (message.mime_type !== 'application/pdf' && !/\.pdf$/i.test(file)) continue;
  const rawCaption = asText(message.text).replace(/https?:\/\/\S+/g, ' ');
  const caption = rawCaption.replace(/\s+/g, ' ').trim();
  const firstLine = rawCaption.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
  const fileTitle = /\.pdf$/i.test(file) ? file.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim() : '';
  const text = `${caption} ${fileTitle}`.trim().slice(0, 500);
  const namedFile = fileTitle && !/^(file|document|\d+)(\s*\d+)?$/i.test(fileTitle);
  const title = (namedFile ? fileTitle.split(/\s+[-–—]\s+/)[0] : firstLine).slice(0, 150);
  if (title.length < 2) continue;
  records.push({ id: message.id, title, text });
  if (records.length >= 1000) flush();
}
await done;
flush();
console.log(`Prepared ${total} PDF records in ${files} batches.`);
