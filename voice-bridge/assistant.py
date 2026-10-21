#!/usr/bin/env python3
"""
Code Games — Real Telegram Channel & Group Voice Call Assistant (PyTgCalls + Kurigram + yt-dlp + FFmpeg)
يتصل تلقائياً ببوت Cloudflare Worker، يسجّل دخول حساب المساعد من داخل محادثة تيليجرام مباشرة،
ويصعد فعلياً للمكالمات الصوتية بالقنوات والكروبات مع دعم التوقيف والاستئناف من نفس الثانية وقائمة الانتظار.
"""

import asyncio
import os
import random
import subprocess
import sys

import httpx
from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded, UserAlreadyParticipant
from pyrogram.raw.functions.channels import GetFullChannel
from pyrogram.raw.functions.messages import GetFullChat
from pyrogram.raw.functions.phone import CreateGroupCall
from pytgcalls import PyTgCalls, filters
from pytgcalls.types import AudioQuality, MediaStream, StreamEnded

WORKER_SYNC_URL = os.environ.get(
    "WORKER_SYNC_URL",
    "https://codenames-telegram-bot.codenames-dhualfaqaar.workers.dev/voice-sync",
)
BRIDGE_KEY = os.environ.get("VOICE_SYNC_KEY", "cg-voice-bridge-v1-8885518661")
# Official Telegram Android public MTProto app id/hash
API_ID = int(os.environ.get("TG_API_ID", "6"))
API_HASH = os.environ.get("TG_API_HASH", "eb06d4abfb49dc3eeb1aeb98ae0f581e")


def extract_direct_audio_url(query_or_url: str, title_hint: str = "") -> str:
    target = query_or_url.strip()
    if target.startswith("http") and not ("youtube.com" in target or "youtu.be" in target):
        return target
    search_arg = target if target.startswith("http") else f"ytsearch1:{title_hint or target}"
    try:
        out = subprocess.check_output(
            [
                sys.executable,
                "-m",
                "yt_dlp",
                "-f",
                "bestaudio/best",
                "--no-playlist",
                "-g",
                search_arg,
            ],
            stderr=subprocess.DEVNULL,
            timeout=25,
        )
        lines = [ln.strip() for ln in out.decode("utf-8", errors="ignore").splitlines() if ln.strip().startswith("http")]
        if lines:
            return lines[0]
    except Exception:
        pass
    return target if target.startswith("http") else ""


async def ensure_group_call_open(app: Client, chat_id: int) -> None:
    try:
        peer = await app.resolve_peer(chat_id)
        try:
            full = await app.invoke(GetFullChannel(channel=peer))
            if getattr(full.full_chat, "call", None) is None:
                await app.invoke(CreateGroupCall(peer=peer, random_id=random.randint(10000, 999999999)))
        except Exception:
            full = await app.invoke(GetFullChat(chat_id=peer.chat_id))
            if getattr(full.full_chat, "call", None) is None:
                await app.invoke(CreateGroupCall(peer=peer, random_id=random.randint(10000, 999999999)))
    except Exception as exc:
        print(f"[voice] group call check warning for {chat_id}: {exc}")


async def main() -> None:
    print(f"🎙️ Voice Call Assistant starting -> {WORKER_SYNC_URL}")
    auth_client: Client | None = None
    phone_code_hash: str = ""
    auth_phone: str = ""

    active_session_str: str = ""
    user_app: Client | None = None
    tgcalls: PyTgCalls | None = None

    applied_state: dict[str, tuple[str, int, str]] = {}

    async with httpx.AsyncClient(timeout=20.0) as http:
        while True:
            try:
                resp = await http.post(
                    WORKER_SYNC_URL,
                    headers={"x-voice-key": BRIDGE_KEY},
                    json={"op": "poll"},
                )
                if resp.status_code != 200:
                    await asyncio.sleep(2.0)
                    continue

                data = resp.json()
                auth_req = data.get("auth") or {}
                saved_session = str(data.get("sessionString") or "").strip()

                # 1) معالجة تسجيل دخول حساب المساعد مباشرة من داخل تيليجرام!
                step = auth_req.get("step")
                if step == "send_code" and auth_req.get("phone"):
                    phone = str(auth_req["phone"]).strip()
                    try:
                        if auth_client:
                            await auth_client.disconnect()
                        auth_client = Client("login_mem", api_id=API_ID, api_hash=API_HASH, in_memory=True)
                        await auth_client.connect()
                        sent = await auth_client.send_code(phone)
                        phone_code_hash = sent.phone_code_hash
                        auth_phone = phone
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={"op": "auth_update", "status": "code_sent"},
                        )
                    except Exception as exc:
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={"op": "auth_update", "status": "error", "message": str(exc)},
                        )

                elif step == "verify_code" and auth_req.get("code") and auth_client:
                    code = str(auth_req["code"]).replace(" ", "").strip()
                    try:
                        await auth_client.sign_in(auth_phone, phone_code_hash, code)
                        s_str = await auth_client.export_session_string()
                        me = await auth_client.get_me()
                        await auth_client.disconnect()
                        auth_client = None
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={
                                "op": "auth_update",
                                "status": "connected",
                                "sessionString": s_str,
                                "assistantName": f"{me.first_name or ''} (@{me.username or me.id})",
                            },
                        )
                        saved_session = s_str
                    except SessionPasswordNeeded:
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={"op": "auth_update", "status": "need_2fa"},
                        )
                    except Exception as exc:
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={"op": "auth_update", "status": "error", "message": str(exc)},
                        )

                elif step == "verify_2fa" and auth_req.get("password") and auth_client:
                    try:
                        await auth_client.check_password(str(auth_req["password"]))
                        s_str = await auth_client.export_session_string()
                        me = await auth_client.get_me()
                        await auth_client.disconnect()
                        auth_client = None
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={
                                "op": "auth_update",
                                "status": "connected",
                                "sessionString": s_str,
                                "assistantName": f"{me.first_name or ''} (@{me.username or me.id})",
                            },
                        )
                        saved_session = s_str
                    except Exception as exc:
                        await http.post(
                            WORKER_SYNC_URL,
                            headers={"x-voice-key": BRIDGE_KEY},
                            json={"op": "auth_update", "status": "error", "message": str(exc)},
                        )

                # 2) تشغيل محرك المكالمات الحقيقي PyTgCalls فور توفر الجلسة
                if saved_session and saved_session != active_session_str:
                    if user_app:
                        try:
                            await user_app.stop()
                        except Exception:
                            pass
                    active_session_str = saved_session
                    user_app = Client(
                        "voice_assistant",
                        api_id=API_ID,
                        api_hash=API_HASH,
                        session_string=active_session_str,
                        in_memory=True,
                    )
                    tgcalls = PyTgCalls(user_app)

                    @tgcalls.on_update(filters.stream_end())
                    async def _on_stream_end(_: PyTgCalls, update: StreamEnded):
                        cid_str = str(update.chat_id)
                        applied_state.pop(cid_str, None)
                        try:
                            await http.post(
                                WORKER_SYNC_URL,
                                headers={"x-voice-key": BRIDGE_KEY},
                                json={"op": "track_ended", "chatId": cid_str},
                            )
                        except Exception:
                            pass

                    await tgcalls.start()
                    me = await user_app.get_me()
                    print(f"✅ Assistant online & ready for calls: {me.first_name} ({me.id})")

                # 3) مزامنة جميع المكالمات النشطة بالقنوات والكروبات لحظياً
                if user_app and tgcalls:
                    sessions = data.get("sessions") or []
                    active_chat_ids = set()
                    for sess in sessions:
                        cid_str = str(sess.get("chatId") or "")
                        if not cid_str:
                            continue
                        active_chat_ids.add(cid_str)
                        chat_id_int = int(cid_str)
                        status = str(sess.get("status") or "ended")
                        seq = int(sess.get("actionSeq") or 0)
                        track_id = str(sess.get("trackId") or "")
                        sig = (status, seq, track_id)

                        if applied_state.get(cid_str) == sig:
                            continue

                        prev_sig = applied_state.get(cid_str)
                        applied_state[cid_str] = sig

                        if status == "ended":
                            try:
                                await tgcalls.leave_call(chat_id_int)
                            except Exception:
                                pass
                            continue

                        # الانضمام التلقائي للقناة أو الكروب عبر رابط الدعوة إن لم يكن المساعد منضماً بعد
                        invite_link = str(sess.get("inviteLink") or "").strip()
                        if invite_link:
                            try:
                                await user_app.join_chat(invite_link)
                            except UserAlreadyParticipant:
                                pass
                            except Exception:
                                pass

                        if status == "paused":
                            try:
                                await tgcalls.pause(chat_id_int)
                            except Exception:
                                pass
                            continue

                        if status == "playing":
                            # إذا كانت نفس الأغنية موقفة مؤقتاً نستأنفها فوراً من نفس الثانية بالضبط!
                            if prev_sig and prev_sig[0] == "paused" and prev_sig[2] == track_id:
                                try:
                                    await tgcalls.resume(chat_id_int)
                                    continue
                                except Exception:
                                    pass

                            await ensure_group_call_open(user_app, chat_id_int)
                            raw_url = str(sess.get("streamUrl") or "")
                            yt_query = str(sess.get("ytQuery") or sess.get("title") or "")
                            direct = await asyncio.to_thread(extract_direct_audio_url, raw_url or yt_query, yt_query)
                            if direct:
                                offset_sec = int(sess.get("offsetSec") or 0)
                                ff_params = f"-ss {offset_sec}" if offset_sec > 1 else ""
                                await tgcalls.play(
                                    chat_id_int,
                                    MediaStream(
                                        direct,
                                        audio_parameters=AudioQuality.STUDIO,
                                        video_flags=MediaStream.Flags.IGNORE,
                                        ffmpeg_parameters=ff_params or None,
                                    ),
                                )
                                print(f"🎵 Streaming in call {chat_id_int}: {yt_query}")

                    # مغادرة أي مكالمة انتهت
                    for old_cid in list(applied_state.keys()):
                        if old_cid not in active_chat_ids:
                            applied_state.pop(old_cid, None)
                            try:
                                await tgcalls.leave_call(int(old_cid))
                            except Exception:
                                pass

            except Exception as loop_err:
                print(f"[sync loop warning]: {loop_err}")

            await asyncio.sleep(0.8)


if __name__ == "__main__":
    asyncio.run(main())
