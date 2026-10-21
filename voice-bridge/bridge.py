#!/usr/bin/env python3
"""
Code Games — Zero-Account Telegram Live Voice/Stream Bridge (RTMP + FFmpeg)
لا يحتاج حساب تيليجرام ثاني ولا رقم هاتف نهائياً — يبث الصوت مباشرة عبر مفتاح البث الرسمي RTMP الخاص بالقناة!
"""

import os
import sys
import time
import signal
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Dict, Optional
import requests
from PIL import Image

BOT_SYNC_URL = os.environ.get(
    "BOT_SYNC_URL",
    "https://codenames-telegram-bot.codenames-dhualfaqaar.workers.dev/voice-sync",
)
VOICE_BRIDGE_SECRET = os.environ.get(
    "VOICE_BRIDGE_SECRET",
    "cg-voice-bridge-v1-8885518661",
)
PORT = int(os.environ.get("PORT", "10000"))

COVER_CANDIDATES = [
    Path("/app/cover.jpg"),
    Path(__file__).resolve().parent.parent / "public" / "code-games-avatar.jpg",
    Path("/tmp/code-games-cover.jpg"),
]


def ensure_cover_image() -> str:
    for p in COVER_CANDIDATES:
        if p.exists() and p.stat().st_size > 1000:
            return str(p)
    fallback = Path("/tmp/code-games-cover.jpg")
    img = Image.new("RGB", (1024, 1024), (231, 237, 244))
    img.save(fallback, format="JPEG", quality=92)
    return str(fallback)


COVER_PATH = ensure_cover_image()


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"mode":"rtmp-zero-account"}')

    def log_message(self, format, *args):
        return


def resolve_audio_url(stream_url: str, yt_query: str) -> str:
    if stream_url and stream_url.startswith(("http://", "https://")):
        return stream_url
    if not yt_query:
        return ""
    try:
        out = subprocess.check_output(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "--no-playlist",
                "--quiet",
                "-f",
                "bestaudio/best",
                "-g",
                f"ytsearch1:{yt_query}",
            ],
            stderr=subprocess.DEVNULL,
            timeout=20,
        )
        line = out.decode("utf-8", errors="ignore").strip().splitlines()
        return line[0].strip() if line else ""
    except Exception as exc:
        print(f"[resolve] failed for {yt_query!r}: {exc}")
        return ""


class ActiveRtmpStream:
    def __init__(self, chat_id: str, track_id: str, action_seq: int, rtmp_url: str, proc: subprocess.Popen):
        self.chat_id = chat_id
        self.track_id = track_id
        self.action_seq = action_seq
        self.rtmp_url = rtmp_url
        self.proc = proc
        self.paused = False

    def stop(self):
        if self.proc.poll() is None:
            try:
                self.proc.send_signal(signal.SIGCONT)
            except Exception:
                pass
            try:
                self.proc.terminate()
                self.proc.wait(timeout=3)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass


streams: Dict[str, ActiveRtmpStream] = {}


def post_sync(payload: dict) -> Optional[dict]:
    try:
        r = requests.post(
            BOT_SYNC_URL,
            json=payload,
            headers={"x-voice-key": VOICE_BRIDGE_SECRET, "Content-Type": "application/json"},
            timeout=12,
        )
        if r.status_code == 200:
            return r.json()
    except Exception as exc:
        print(f"[sync] error: {exc}")
    return None


def start_ffmpeg_rtmp(rtmp_url: str, audio_url: str, offset_sec: int = 0) -> subprocess.Popen:
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "warning"]
    cmd += ["-loop", "1", "-framerate", "2", "-i", COVER_PATH]
    if offset_sec > 1:
        cmd += ["-ss", str(int(offset_sec))]
    cmd += [
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        "-re",
        "-i",
        audio_url,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "stillimage",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "6",
        "-g",
        "12",
        "-b:v",
        "140k",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-shortest",
        "-f",
        "flv",
        rtmp_url,
    ]
    return subprocess.Popen(cmd)


def reconcile_sessions(data: dict):
    sessions = data.get("sessions") or []
    default_rtmp = str(data.get("defaultRtmpUrl") or "").strip()
    seen_chats = set()

    for s in sessions:
        chat_id = str(s.get("chatId") or "")
        if not chat_id:
            continue
        seen_chats.add(chat_id)

        rtmp_url = str(s.get("rtmpUrl") or default_rtmp).strip()
        status = str(s.get("status") or "")
        track_id = str(s.get("trackId") or "")
        action_seq = int(s.get("actionSeq") or 1)
        offset_sec = int(s.get("offsetSec") or 0)
        cur = streams.get(chat_id)

        if not rtmp_url or status in ("ended", "stopped") or not track_id:
            if cur:
                cur.stop()
                streams.pop(chat_id, None)
            continue

        # Check if previous ffmpeg naturally reached end-of-track
        if cur and cur.track_id == track_id and cur.action_seq == action_seq and cur.proc.poll() is not None:
            streams.pop(chat_id, None)
            if status == "playing":
                print(f"[track] finished {track_id} in {chat_id} -> advancing queue")
                post_sync({"op": "track_ended", "chatId": chat_id})
            continue

        if status == "paused":
            if cur and cur.proc.poll() is None and not cur.paused:
                try:
                    cur.proc.send_signal(signal.SIGSTOP)
                    cur.paused = True
                except Exception:
                    cur.stop()
                    streams.pop(chat_id, None)
            continue

        if status == "playing":
            if cur and cur.track_id == track_id and cur.action_seq == action_seq and cur.rtmp_url == rtmp_url:
                if cur.paused and cur.proc.poll() is None:
                    try:
                        cur.proc.send_signal(signal.SIGCONT)
                        cur.paused = False
                    except Exception:
                        pass
                continue

            if cur:
                cur.stop()
                streams.pop(chat_id, None)

            audio_url = resolve_audio_url(str(s.get("streamUrl") or ""), str(s.get("ytQuery") or ""))
            if not audio_url:
                print(f"[stream] could not resolve audio URL for {s.get('title')}")
                continue

            print(f"[stream] streaming {s.get('title')!r} -> {chat_id} via RTMP")
            proc = start_ffmpeg_rtmp(rtmp_url, audio_url, offset_sec)
            streams[chat_id] = ActiveRtmpStream(chat_id, track_id, action_seq, rtmp_url, proc)

    for cid in list(streams.keys()):
        if cid not in seen_chats:
            streams[cid].stop()
            streams.pop(cid, None)


def main():
    srv = HTTPServer(("0.0.0.0", PORT), HealthHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print(f"✅ Code Games Zero-Account RTMP Bridge running on port {PORT}")

    while True:
        data = post_sync({"op": "poll"})
        if isinstance(data, dict) and data.get("ok"):
            reconcile_sessions(data)
        time.sleep(2.0)


if __name__ == "__main__":
    main()
