"""JSON logs to stdout (CloudWatch / Loki), readable console logs in development."""

import logging
import sys

import structlog

from .settings import ServiceSettings

get_logger = structlog.get_logger


def configure_logging(settings: ServiceSettings) -> None:
    service = settings.service_name

    def add_service(_logger: object, _method: str, event: dict) -> dict:
        event.setdefault("service", service)
        return event

    shared = [
        structlog.contextvars.merge_contextvars,  # request_id etc. bound per request
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True, key="time"),
        add_service,
    ]
    renderer = (
        [structlog.dev.ConsoleRenderer()]
        if settings.is_development
        else [structlog.processors.dict_tracebacks, structlog.processors.JSONRenderer()]
    )

    structlog.configure(
        processors=[*shared, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Route stdlib logging (uvicorn, httpx, ...) through the same renderer.
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=shared,
            processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, *renderer],
        )
    )
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(settings.log_level.upper())

    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers.clear()
        logging.getLogger(name).propagate = True
    # Requests are logged by our middleware (with request_id); skip uvicorn's duplicate access log.
    logging.getLogger("uvicorn.access").disabled = True
