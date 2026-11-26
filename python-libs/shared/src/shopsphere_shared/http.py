"""FastAPI app factory and server runner, so every Python API behaves the same."""

import time
import uuid
from collections.abc import Awaitable, Callable, Sequence
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
import uvicorn
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .health import Health
from .log import get_logger
from .settings import HttpServiceSettings

ShutdownHook = Callable[[], Awaitable[object]]

log = get_logger()


def create_app(
    settings: HttpServiceSettings,
    *,
    health: Health,
    routers: Sequence = (),
    on_shutdown: Sequence[ShutdownHook] = (),
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        log.info("service started", port=settings.port, env=settings.app_env)
        yield
        health.shutting_down = True
        for hook in on_shutdown:  # close DB pools, broker connections...
            await hook()
        log.info("shutdown complete")

    docs = settings.is_development
    app = FastAPI(
        title=settings.service_name,
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.include_router(health.router())
    for router in routers:
        app.include_router(router)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        # Reuse the id from Traefik / the BFF so one id follows the request across services.
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        if not request.url.path.startswith("/health"):
            log.info(
                "request completed",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=round((time.perf_counter() - started) * 1000, 1),
            )
        return response

    _add_problem_handlers(app)
    return app


def _problem(request: Request, status: int, title: str, detail: object = None) -> JSONResponse:
    """RFC 9457 Problem Details, same shape as the Node services."""
    body: dict[str, object] = {
        "type": "about:blank",
        "title": title,
        "status": status,
        "instance": request.url.path,
        "requestId": structlog.contextvars.get_contextvars().get("request_id"),
    }
    if detail is not None:
        body["detail"] = detail
    return JSONResponse(body, status_code=status, media_type="application/problem+json")


def _add_problem_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return _problem(request, exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return _problem(request, 422, "Validation failed", exc.errors())

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        log.exception("request failed")
        return _problem(request, 500, "Internal Server Error")


def serve(app: str, settings: HttpServiceSettings, *, reload_dirs: Sequence[str] = ()) -> None:
    """Run uvicorn. `app` is an import string ("import_api.main:app") so --reload works in dev."""
    dev = settings.is_development
    uvicorn.run(
        app,
        host=settings.host,
        port=settings.port,
        reload=dev,
        reload_dirs=[*reload_dirs, str(Path(__file__).parent)] if dev else None,
        proxy_headers=True,
        forwarded_allow_ips=settings.forwarded_allow_ips,
        timeout_graceful_shutdown=settings.shutdown_timeout_s,
        server_header=False,
        access_log=False,
        log_config=None,  # keep our structlog setup
    )
