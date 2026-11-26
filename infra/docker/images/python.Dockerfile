# syntax=docker/dockerfile:1.7
#
# One Dockerfile for every Python service in the uv workspace.
# SERVICE is the project name in services/<name>/pyproject.toml (also its console script).
#
#   docker build -f infra/docker/images/python.Dockerfile \
#     --build-arg SERVICE=import-api -t shopsphere/import-api .
#
# Same runtime contract as node.Dockerfile: env-only config, /health/live + /health/ready,
# graceful SIGTERM, non-root UID 10001, read-only root filesystem friendly.

ARG PYTHON_VERSION=3.12

FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS build
ARG SERVICE
RUN test -n "$SERVICE" || (echo "--build-arg SERVICE=<python project name> is required" && exit 1)
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /src
# The whole workspace is needed to resolve uv.lock; .dockerignore keeps node_modules etc. out.
COPY pyproject.toml uv.lock .python-version ./
COPY python-libs ./python-libs
COPY services ./services
# Installs only this service + shopsphere-shared + their dependencies, as regular (non-editable) packages.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable --package "$SERVICE"

FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
ARG SERVICE
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production
RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home app \
 && ln -s "/opt/venv/bin/${SERVICE}" /usr/local/bin/app
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
USER 10001:10001
CMD ["app"]
