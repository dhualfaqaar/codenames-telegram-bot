# Video shapes

In a private bot chat, the user opens **أشكال الفيديو**, sends a video, selects a shape and opens the Telegram Mini App. It downloads the original from Telegram through the Worker, converts it on the user's device with single-threaded FFmpeg.wasm, and uploads the result back through the Worker to Telegram. The circular option uses `sendVideoNote`; other options use `sendVideo` with a black background outside the polygon. The Worker never exposes the bot token or the Telegram file URL to the browser.

The Mini App needs WebAssembly, workers and `DecompressionStream('gzip')`. The compressed engine is about 10 MB on first load; the decompressed engine and video require substantially more device memory. The original must be at most 20 MiB and 60 seconds, and output at most 15 MiB. Unsupported devices, codecs or files produce an error rather than a fake success. Telegram's own video-note constraints and device performance still apply.

Telegram-signed Mini App `initData` is verified by the Worker. The user ID comes from the signature, not a client-supplied chat ID; a random per-video session expires after one hour or when another video is sent. Video bytes are not persisted in bot state. The source and output transit the Worker but conversion happens in the browser. Requests are size-limited; only one upload per user can run concurrently.

## Third-party components

`public/shape-video/vendor` includes `@ffmpeg/ffmpeg` 0.12.15 (MIT) and the single-threaded `@ffmpeg/core` 0.12.10 (GPL-2.0-or-later). The distributed WebAssembly is the unmodified npm package file compressed with `gzip -n -9`. See the included license files and NOTICE for source and build links. It is intentionally vendored so users do not need to load an untrusted third-party CDN and Worker Builds can serve it directly.

## Tests

`npm run test:shape-video` exercises the bot flow, state restore, signed Worker authentication, size limits and simulated Telegram success/failure. `npm run test:shape-video:browser` requires Playwright, @sparticuz/chromium, and native FFmpeg/FFprobe (`FFMPEG` and `FFPROBE` can select binaries). It actually runs the shipped WebAssembly in Chromium on sample videos, decodes the results, checks all five shapes and their audio, tests a silent video and rejects an overlong one. Telegram is mocked in both tests; neither verifies a real Telegram client or production delivery.
