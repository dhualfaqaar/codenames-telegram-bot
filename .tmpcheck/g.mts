import { interactiveGamesMiniAppHtml } from '../src/services/interactiveGamesMiniApp.js';
import { writeFileSync } from 'node:fs';
const html = interactiveGamesMiniAppHtml('gartic');
[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].forEach((m, i) => writeFileSync('/tmp/w' + i + '.js', m[1]));
for (const k of ['class="draw-lobby-grid"','id="drawQuickPlay"','id="drawOpenRooms"','id="drawRoomCode"','id="drawRoomsView"','id="drawCreateToggle"','id="drawCreateOptions"','id="drawPublicList"','draw-room-code']) console.log(k, html.includes(k));
