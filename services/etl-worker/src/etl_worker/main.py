from shopsphere_shared import Health, configure_logging, run_worker

from .settings import settings
from .worker import main


def run() -> None:
    configure_logging(settings)
    # Readiness checks, e.g. ("rabbitmq", check_connection)
    health = Health([])
    run_worker(settings, main, health=health, on_shutdown=[])
