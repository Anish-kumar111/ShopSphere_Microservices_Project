"""Runner for background workers: health endpoint on HEALTH_PORT + graceful SIGTERM handling."""

import asyncio
import json
import signal
import sys
from collections.abc import Awaitable, Callable, Sequence

from .health import Health
from .log import get_logger
from .settings import WorkerSettings

# The worker loop: finish in-flight work and return once `stop` is set.
WorkerMain = Callable[[asyncio.Event], Awaitable[None]]
ShutdownHook = Callable[[], Awaitable[object]]

log = get_logger()
_REASONS = {200: "OK", 404: "Not Found", 503: "Service Unavailable"}


def run_worker(
    settings: WorkerSettings,
    main: WorkerMain,
    *,
    health: Health,
    on_shutdown: Sequence[ShutdownHook] = (),
) -> None:
    sys.exit(asyncio.run(_run(settings, main, health, on_shutdown)))


async def _run(
    settings: WorkerSettings, main: WorkerMain, health: Health, on_shutdown: Sequence[ShutdownHook]
) -> int:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows (local dev only)
            signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop.set))

    server = await _serve_health(health, settings.health_port)
    log.info("worker started", health_port=settings.health_port, env=settings.app_env)

    work = asyncio.create_task(main(stop))
    stopped = asyncio.create_task(stop.wait())
    await asyncio.wait({work, stopped}, return_when=asyncio.FIRST_COMPLETED)
    health.shutting_down = True

    exit_code = 0
    if work.done():
        if not work.cancelled() and work.exception():
            log.error("worker crashed", exc_info=work.exception())
            exit_code = 1
    else:
        log.info("shutting down")
        stop.set()
        try:
            await asyncio.wait_for(work, settings.shutdown_timeout_s)
        except TimeoutError:
            log.error("graceful shutdown timed out")
            exit_code = 1
        except Exception:
            log.exception("worker failed while stopping")
            exit_code = 1

    for hook in on_shutdown:
        await hook()
    stopped.cancel()
    server.close()
    await server.wait_closed()
    log.info("shutdown complete")
    return exit_code


async def _serve_health(health: Health, port: int) -> asyncio.Server:
    """A tiny HTTP server for /health/live and /health/ready (no framework needed)."""

    async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            request_line = await asyncio.wait_for(reader.readline(), 5)
            parts = request_line.decode("latin-1").split(" ")
            path = parts[1] if len(parts) > 1 else ""
            if path == "/health/live":
                status, body = 200, {"status": "ok"}
            elif path == "/health/ready":
                ok, checks = await health.readiness()
                status = 200 if ok else 503
                body = {"status": "ok" if ok else "unavailable", "checks": checks}
            else:
                status, body = 404, {"status": "not found"}
            data = json.dumps(body).encode()
            head = (
                f"HTTP/1.1 {status} {_REASONS[status]}\r\nContent-Type: application/json\r\n"
                f"Content-Length: {len(data)}\r\nConnection: close\r\n\r\n"
            )
            writer.write(head.encode() + data)
            await writer.drain()
        except Exception:  # noqa: BLE001 - a broken probe connection must never crash the worker
            pass
        finally:
            writer.close()

    return await asyncio.start_server(handle, host="0.0.0.0", port=port)
