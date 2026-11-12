"""AETHER-3D backend sidecar.

Local WebSocket server that only the Electron app talks to.

Contract with Electron:
  - AETHER_TOKEN (env var) is a one-time secret the client must present.
  - The server binds 127.0.0.1 on a free port and prints "AETHER_READY <port>".
  - When stdin reaches EOF (Electron quit or crashed) the server shuts down,
    so no orphan Python process is left running.
"""
import asyncio
import hmac
import json
import os
import signal
import struct
import sys
import threading
import time

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

LOG_TAG = "[AETHER:backend]"
VERSION = "0.1.0"
HOST = "127.0.0.1"
AUTH_TIMEOUT_S = 5.0
MAX_MESSAGE_BYTES = 32 * 1024 * 1024
FRAME_HEADER = struct.Struct("<IdB")  # frame_id, timestamp_ms, kind (0 preview, 1 capture)

ICONS = {"ok": "✅", "err": "❌", "warn": "⚠️", "skip": "⏭️"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def log(level: str, message: str) -> None:
    print(f"{LOG_TAG} {ICONS[level]} {message}", flush=True)


async def send_json(ws, payload: dict) -> None:
    await ws.send(json.dumps(payload))


async def on_text(ws, raw: str) -> None:
    try:
        msg = json.loads(raw)
    except ValueError:
        await send_json(ws, {"type": "error", "message": "invalid JSON"})
        return

    kind = msg.get("type")
    if kind == "ping":
        await send_json(ws, {"type": "pong", "t": msg.get("t"), "server_t": time.time() * 1000})
    else:
        log("warn", f"unknown message type: {kind!r}")
        await send_json(ws, {"type": "error", "message": f"unknown type: {kind}"})


async def on_binary(ws, data: bytes) -> None:
    # Frame message: u32 frame_id, f64 timestamp_ms, u8 kind, then JPEG bytes.
    # Phase 2 will decode and run detection; for now we only acknowledge it.
    if len(data) < FRAME_HEADER.size:
        await send_json(ws, {"type": "error", "message": "binary message too short"})
        return
    frame_id, timestamp_ms, kind = FRAME_HEADER.unpack_from(data, 0)
    await send_json(ws, {
        "type": "frame_ack",
        "frame_id": frame_id,
        "timestamp_ms": timestamp_ms,
        "kind": kind,
        "bytes": len(data) - FRAME_HEADER.size,
    })


async def handler(ws) -> None:
    token = os.environ.get("AETHER_TOKEN", "")

    # The first message must be a valid hello with the token.
    try:
        raw = await asyncio.wait_for(ws.recv(), timeout=AUTH_TIMEOUT_S)
        msg = json.loads(raw) if isinstance(raw, str) else {}
    except ConnectionClosed:
        return
    except (asyncio.TimeoutError, ValueError):
        log("warn", "handshake failed (timeout or malformed message)")
        await ws.close(4400, "bad handshake")
        return

    supplied = str(msg.get("token", ""))
    if msg.get("type") != "hello" or not hmac.compare_digest(supplied, token):
        log("err", "rejected connection: bad token")
        await ws.close(4401, "unauthorized")
        return

    await send_json(ws, {"type": "hello_ack", "version": VERSION, "pid": os.getpid()})
    log("ok", "client authenticated")

    try:
        async for message in ws:
            if isinstance(message, bytes):
                await on_binary(ws, message)
            else:
                await on_text(ws, message)
    except ConnectionClosed:
        pass
    finally:
        log("skip", "client disconnected")


def start_parent_watchdog(loop: asyncio.AbstractEventLoop, stop: asyncio.Event) -> None:
    """Stop the server when stdin hits EOF (the Electron parent went away)."""

    def run() -> None:
        try:
            while sys.stdin.buffer.read(1024):
                pass
        except Exception:
            pass
        log("skip", "stdin closed, shutting down")
        loop.call_soon_threadsafe(stop.set)

    threading.Thread(target=run, daemon=True).start()


async def main() -> None:
    if not os.environ.get("AETHER_TOKEN"):
        log("err", "AETHER_TOKEN is not set, refusing to start")
        sys.exit(1)

    loop = asyncio.get_running_loop()
    stop = asyncio.Event()
    start_parent_watchdog(loop, stop)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows
            pass

    async with serve(handler, HOST, 0, max_size=MAX_MESSAGE_BYTES) as server:
        port = server.sockets[0].getsockname()[1]
        log("ok", f"listening on {HOST}:{port}")
        print(f"AETHER_READY {port}", flush=True)
        await stop.wait()

    log("skip", "shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass