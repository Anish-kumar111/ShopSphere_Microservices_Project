import asyncio

from shopsphere_shared import get_logger

log = get_logger()


async def main(stop: asyncio.Event) -> None:
    """The worker loop. Finish the current job and return once `stop` is set (SIGTERM).

    TODO Ch 14: consume RabbitMQ 'etl.jobs' (aio-pika, prefetch 1), process files in chunks
    """
    log.info("waiting for jobs (not implemented yet)")
    await stop.wait()
