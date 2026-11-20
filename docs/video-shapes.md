# Circular video notes

The private service offers only a circular video note. For an eligible square MP4 (up to 60 seconds and 20 MiB), the bot re-uploads the original bytes directly as `sendVideoNote`; the audio is unchanged. Telegram can still reject some encodings. If direct delivery fails, the bot offers on-device conversion.

Other videos can be converted in the existing Mini App. It starts automatically, crops to 480×480, encodes H.264/AAC while retaining any audio, and sends a video note. Keep the window open until the upload finishes. Conversion can be slow or unsupported on some devices and may require downloading approximately 10 MB. Converted output is limited to 15 MiB. Telegram's own file size and delivery limits still apply.

Only `circle` is accepted by the bot callbacks, the Mini App and its authenticated API. The Worker verifies Telegram initData and binds files to the user's random, one-hour session; sending a new video invalidates the old session. The external Upload-Post converter is no longer used.

Checks:

- `npm run test:shape-video`: buttons, rejected obsolete shapes, signed requests, sessions, isolation, limits and failures (Telegram mocked).
- `FFMPEG=<path> npm run test:shape-video:free`: direct square video bytes and decoded audio (Telegram mocked).
- `FFMPEG=<path> FFPROBE=<path> npm run test:shape-video:browser`: Chromium/WASM conversion, audio, duration, motion and retry (Telegram mocked). Requires local Playwright, Chromium, FFmpeg and ffprobe.

These tests do not verify actual Telegram acceptance, playback or compatibility on a particular phone.
