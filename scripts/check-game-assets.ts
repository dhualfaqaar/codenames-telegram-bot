import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp';

const html = interactiveGamesMiniAppHtml('codenames');
const config = readFileSync('wrangler.toml', 'utf8');
assert.match(config, /\[assets\][\s\S]*?directory\s*=\s*"\.\/public"/);
const first = config.match(/run_worker_first\s*=\s*\[([^\]]*)\]/)?.[1] || '';
assert.deepEqual(first.match(/"[^"]+"/g), ['"/stockfish/*"'], 'new image paths should be served by Cloudflare static assets');
for (const name of ['games-library-v1.jpg', 'codenames-hero-v1.jpg']) {
  const bytes = readFileSync('public/' + name);
  assert.ok(bytes.length > 5000 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9, `${name} must be a real JPEG`);
  assert.ok(html.includes('/' + name), `${name} should be referenced by the Mini App`);
}
assert.ok(html.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
assert.ok(html.includes('grid-template-areas:"blue red" "board board"'));
console.log('Game assets: JPEG files, Cloudflare assets configuration, Mini App references and responsive board structure passed.');
