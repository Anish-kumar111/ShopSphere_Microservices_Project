"""Message envelope and names, mirroring packages/contracts (TypeScript)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class EventEnvelope[T](BaseModel):
    """Same JSON shape as the Node `EventEnvelope` (camelCase on the wire)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    event_id: UUID
    type: str
    version: int
    occurred_at: datetime
    source: str
    traceparent: str | None = None
    data: T


class Topics:
    ORDERS = "orders.events"
    USERS = "users.events"
    IMPORTS = "imports.events"


class Exchanges:
    JOBS = "jobs"
    JOBS_DEAD_LETTER = "jobs.dlx"


class Queues:
    NOTIFICATIONS = "notifications"
    ETL_JOBS = "etl.jobs"


class RedisChannels:
    IMPORT_PROGRESS = "import-progress"
