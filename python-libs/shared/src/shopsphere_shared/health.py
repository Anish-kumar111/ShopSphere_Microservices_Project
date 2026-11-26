"""Liveness and readiness, same contract as the Node services.

GET /health/live  -> the process runs (never checks dependencies).
GET /health/ready -> dependencies are usable; 503 while shutting down.
"""

import asyncio
from collections.abc import Awaitable, Callable, Sequence

from fastapi import APIRouter, Response

# (name, async check), e.g. ("postgres", lambda: pool.execute("SELECT 1"))
ReadinessCheck = tuple[str, Callable[[], Awaitable[object]]]


class Health:
    def __init__(self, checks: Sequence[ReadinessCheck] = (), timeout_s: float = 2.0) -> None:
        self.checks = list(checks)
        self.timeout_s = timeout_s
        self.shutting_down = False

    async def readiness(self) -> tuple[bool, dict[str, str]]:
        if self.shutting_down:
            return False, {"shutdown": "in progress"}

        async def run(name: str, check: Callable[[], Awaitable[object]]) -> tuple[str, str]:
            try:
                await asyncio.wait_for(check(), self.timeout_s)
                return name, "ok"
            except Exception as exc:  # noqa: BLE001 - report any failure as "not ready"
                return name, str(exc) or type(exc).__name__

        results = await asyncio.gather(*(run(name, check) for name, check in self.checks))
        return all(state == "ok" for _, state in results), dict(results)

    def router(self) -> APIRouter:
        router = APIRouter(tags=["health"])

        @router.get("/health/live")
        async def live() -> dict[str, str]:
            return {"status": "ok"}

        @router.get("/health/ready")
        async def ready(response: Response) -> dict[str, object]:
            ok, checks = await self.readiness()
            response.status_code = 200 if ok else 503
            return {"status": "ok" if ok else "unavailable", "checks": checks}

        return router
