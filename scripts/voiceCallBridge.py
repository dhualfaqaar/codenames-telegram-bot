"""
🎙️ جسر البث الصوتي الحقيقي لمكالمات القنوات والمجموعات في تيليجرام (PyTgCalls + Hydrogram/Pyrogram)

يرتبط مباشرة مع البوت على Cloudflare Workers عبر المتغير البيئي:
  VOICE_BRIDGE_URL=https://your-voice-bridge.example.com/bridge
  VOICE_BRIDGE_SECRET=your_secret

المتطلبات عند تشغيل الجسر المساعد لمكالمات الصوت الحية:
  pip install py-tgcalls hydrogram tgcrypto aiohttp
  تعيين API_ID, API_HASH, ASSISTANT_SESSION, BRIDGE_SECRET
"""

import os
from aiohttp import web
from hydrogram import Client
from pytgcalls import PyTgCalls
from pytgcalls.types import MediaStream, AudioQuality

API_ID = int(os.environ.get("API_ID", "0"))
API_HASH = os.environ.get("API_HASH", "")
SESSION = os.environ.get("ASSISTANT_SESSION", "")
BRIDGE_SECRET = os.environ.get("BRIDGE_SECRET", "")

assistant = Client("music_assistant", api_id=API_ID, api_hash=API_HASH, session_string=SESSION)
calls = PyTgCalls(assistant)


async def handle_bridge(req: web.Request) -> web.Response:
    if BRIDGE_SECRET and req.headers.get("Authorization") != f"Bearer {BRIDGE_SECRET}":
        return web.json_response({"ok": False, "error": "unauthorized"}, status=401)

    body = await req.json()
    action = body.get("action")
    chat_id = int(body["chatId"])
    stream_url = body.get("streamUrl", "")
    offset_sec = max(0, int(body.get("offsetSec", 0)))

    try:
        if action in ("play", "resume") and stream_url:
            ffmpeg_args = f"-ss {offset_sec}" if offset_sec > 0 else ""
            await calls.play(
                chat_id,
                MediaStream(
                    stream_url,
                    audio_parameters=AudioQuality.HIGH,
                    video_flags=MediaStream.Flags.IGNORE,
                    ffmpeg_parameters=ffmpeg_args,
                ),
            )
        elif action == "pause":
            await calls.pause_stream(chat_id)
        elif action == "unpause":
            await calls.resume_stream(chat_id)
        elif action == "stop":
            await calls.leave_call(chat_id)
        return web.json_response({"ok": True})
    except Exception as exc:
        return web.json_response({"ok": False, "error": str(exc)}, status=500)


async def app_factory() -> web.Application:
    await assistant.start()
    await calls.start()
    app = web.Application()
    app.router.add_post("/bridge", handle_bridge)
    return app


if __name__ == "__main__":
    web.run_app(app_factory(), host="0.0.0.0", port=int(os.environ.get("PORT", "8090")))
