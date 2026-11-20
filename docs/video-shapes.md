# Video shapes

In a private bot chat, send a video (up to 60 seconds and 20 MiB) and choose circle, star, hexagon, pentagon or triangle. The Mini App starts conversion automatically on the user's device; keep it open until the bot sends the result. The compressed browser engine is approximately 10 MB and may need to be downloaded again. Processing may be slow or unsupported on some devices. There is no separate conversion server.

The browser crops to a 480×480 square, encodes H.264/AAC, and preserves audio when present. Telegram displays the circle as a video note. Other shapes are ordinary square videos with a black background outside the shape; Telegram does not display arbitrary-shaped video notes. The converted upload is limited to 15 MiB. Existing eligible square MP4 Telegram videos can instead be sent directly as video notes without re-encoding; Telegram may reject some encodings, in which case the bot offers conversion.

The Worker verifies Telegram Mini App initData and forwards only the authenticated user ID. Source downloads and uploads are tied to that user's random, one-hour session; sending a new video invalidates the previous session. Files are retrieved from Telegram without exposing the bot token or file URL. Telegram Bot API file size and delivery restrictions still apply.

Checks:

- `npm run test:shape-video`: bot flow and signed Worker-to-Durable-Object authentication, isolation, size and failure checks with a mocked Telegram API.
- `FFMPEG=<path> npm run test:shape-video:free`: direct square MP4 passthrough and audio checks with a mocked Telegram API.
- `FFMPEG=<path> FFPROBE=<path> npm run test:shape-video:browser`: real Chromium and FFmpeg WASM conversions, masks, durations, audio, motion and retry, with Telegram mocked. Requires `@playwright/test`, `@sparticuz/chromium`, FFmpeg and ffprobe available locally.

These tests do not verify actual Telegram delivery, playback, or compatibility on a particular phone.
