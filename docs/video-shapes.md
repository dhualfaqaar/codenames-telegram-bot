# Direct video shapes

The user sends a video to the private bot chat and chooses a Telegram callback button. The Worker submits a small authenticated job to a separate, owner-controlled HTTPS video processor. That service downloads the original directly from Telegram using its own bot-token secret, runs native FFmpeg, then sends the result directly to the same private chat. The bot token is never included in job requests. There is no Mini App or browser conversion.

Circle uses `sendVideoNote`. Star, hexagon, pentagon and triangle use `sendVideo` with black outside the shape. The input is limited to 20 MiB and 60 seconds and the output to 15 MiB. The service validates duration, dimensions, supported input formats and output size; it fails visibly rather than sending a fake result. Transcoding is lossy and can be slow; input without audio stays without audio.

## Deployment requirements — not provisioned by this repository

The production bot runs on a Cloudflare Worker that cannot run native FFmpeg. Deploy `video-processor/Dockerfile` separately on a reliable Node/Docker host with outbound access to Telegram, enough CPU and memory for FFmpeg, and a publicly reachable **HTTPS** URL. The service is not a second polling/webhook bot and does not change the existing webhook. It handles a maximum of two concurrent jobs and rejects excess work. Running only the Worker without this service will make the shape feature explicitly unavailable.

Set these as **private environment secrets** on the processor host, using the host's dashboard or secret manager, never in Git or chat:

- `TELEGRAM_BOT_TOKEN`: the same bot token already used by the Worker; this grants the host control over the bot, so use a trusted, owner-controlled host.
- `VIDEO_SHAPES_SECRET`: a strong random secret of at least 32 characters.

The host injects `PORT`. `/health` is an unauthenticated liveness check, not a readiness or Telegram connectivity check. HTTPS must terminate at the host/reverse proxy; `/jobs` authenticates every request with the secret. Never expose the backend's plain HTTP port publicly without TLS.

Configure these on the Worker, using private secret configuration rather than source control:

- `VIDEO_SHAPES_PROCESSOR_URL`: the processor's HTTPS origin, with no username, password, query or fragment.
- `VIDEO_SHAPES_SECRET`: the same secret configured on the processor.

The bot refuses to enable the flow if configuration is absent, invalid or uses plain HTTP. Never post the bot token or shared secret in chat. The processor receives video metadata and video bytes from Telegram, writes temporary files with restricted permissions, and removes them after processing. An unexpected process termination can leave temporary files or lose an in-flight job; operators should use an ephemeral, private filesystem and arrange cleanup. Job acceptance is not a guarantee of delivery: a failed conversion or Telegram rejection triggers a failure message when possible, but a process crash may prevent it. Protect and monitor the processor host accordingly.

## Verification

- `npm run test:shape-video` checks the callback flow, user/session isolation, unavailable and busy cases and HTTPS submitter.
- `FFMPEG=<path> FFPROBE=<path> npm run test:shape-video:processor` runs native FFmpeg against real clips, checks the five results and audio, no-audio clips, overlong inputs, HTTP authentication, concurrency and failure reporting. Telegram is mocked.
- `FFMPEG=<path> FFPROBE=<path> npm run test:shape-video:direct` covers callback → job submission → real conversion → simulated Telegram delivery end to end, with no Mini App.

A local test or successful Worker build does not prove that the separate production processor is deployed, reachable, or that a real Telegram client has received a result.
