from shopsphere_shared import WorkerSettings


class Settings(WorkerSettings):
    service_name: str = "etl-worker"
    health_port: int = 9104
    # Add this worker's settings here (see .env.example), e.g.
    # rabbitmq_url: AmqpDsn


settings = Settings()
