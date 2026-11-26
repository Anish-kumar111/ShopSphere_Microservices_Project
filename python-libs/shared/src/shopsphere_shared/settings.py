"""Typed settings from env vars (plus ./.env in development). Fails fast at start-up."""

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class ServiceSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str
    app_env: Literal["development", "test", "production"] = "development"
    log_level: Literal["debug", "info", "warning", "error", "critical"] = "info"
    # Keep below ECS stopTimeout / k8s terminationGracePeriodSeconds (30 s).
    shutdown_timeout_s: int = 25

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"


class HttpServiceSettings(ServiceSettings):
    host: str = "0.0.0.0"
    port: int
    # Only the load balancer can reach the task (security groups): trust its X-Forwarded-* headers.
    forwarded_allow_ips: str = "*"


class WorkerSettings(ServiceSettings):
    health_port: int
