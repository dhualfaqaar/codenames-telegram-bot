# Video shapes

In private chat, a user sends a video up to 60 seconds and 20 MiB and chooses a shape. With `UPLOAD_POST_API_KEY` configured as an encrypted Worker secret and the job binding enabled, videos with a known duration are uploaded to Upload-Post and processed asynchronously. The user is told before choosing that a third-party service receives the video. Its free plan includes 30 media minutes per month shared by all bot users; availability, limits, privacy terms and charges must be checked with the provider. Upload-Post documents that a temporary publicly accessible result copy may remain for up to 24 hours. Never send Telegram file URLs, tokens, or secrets to the provider or log them.

A separate per-user Durable Object queues one job, polls it with alarms, then sends the result to that user. An ambiguous interrupted upload or send is not retried automatically, avoiding duplicate jobs or messages. A failed job, exhausted quota, or oversized result offers the existing on-device Mini App. Videos without known duration also use that Mini App to avoid unintentionally consuming provider quota. Missing secret or Preview mode leaves the existing on-device flow unchanged. The user must keep the Mini App open while it converts; it may download about 10 MB and may be slow or unsupported on some devices.

Eligible square MP4 Telegram videos still use direct `sendVideoNote` without re-encoding. Other circles are encoded for Telegram video notes; stars, hexagons, pentagons and triangles are square MP4 videos with black backgrounds. Both processing paths crop to 480×480, encode H.264/AAC and preserve audio when present. The output limit is 15 MiB. Input size limits and delivery restrictions still apply.

The Mini App API verifies Telegram initData and binds files to the user's random, one-hour session. The background queue is only callable internally after the bot validates the private callback and session. No Telegram token is shared with the processing provider.

Checks:

- `npm run test:shape-video`: bot flow and signed Worker-to-Durable-Object authentication, isolation, size and failure checks with mocked Telegram.
- `FFMPEG=<path> npm run test:shape-video:cloud`: mocked queue/provider/Telegram, errors and quota; real local FFmpeg masks and audio.
- `FFMPEG=<path> npm run test:shape-video:free`: direct square MP4 passthrough and audio with mocked Telegram.
- `FFMPEG=<path> FFPROBE=<path> npm run test:shape-video:browser`: Chromium/WASM conversion and retry with mocked Telegram; requires local Playwright, Chromium, FFmpeg and ffprobe.

Mock tests and local FFmpeg do not verify that Upload-Post accepts the command, real Telegram delivery, or compatibility on a particular phone. Verify with a real account and a short non-sensitive video before relying on cloud conversion.
