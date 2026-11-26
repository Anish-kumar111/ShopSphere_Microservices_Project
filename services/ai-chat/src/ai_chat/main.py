from pathlib import Path

from shopsphere_shared import Health, configure_logging, create_app, serve

from .routes import router
from .settings import settings

configure_logging(settings)

# Readiness checks, e.g. ("postgres", lambda: pool.execute("SELECT 1"))
health = Health([])

# on_shutdown: close clients in order, e.g. [pool.close]
app = create_app(settings, health=health, routers=[router], on_shutdown=[])


def run() -> None:
    serve("ai_chat.main:app", settings, reload_dirs=[str(Path(__file__).parent)])
