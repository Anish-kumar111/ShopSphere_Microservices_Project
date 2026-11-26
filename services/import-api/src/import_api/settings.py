from shopsphere_shared import HttpServiceSettings


class Settings(HttpServiceSettings):
    service_name: str = "import-api"
    port: int = 8001
    # Add this service's settings here (see .env.example), e.g.
    # database_url: PostgresDsn


settings = Settings()
