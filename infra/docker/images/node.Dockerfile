# syntax=docker/dockerfile:1.7
#
# One Dockerfile for every Node workspace package. Choose the final stage with --target:
#   service -> backend APIs and workers      (--build-arg PACKAGE=@shopsphere/order)
#   web     -> Next.js customer app          (--build-arg PACKAGE=@shopsphere/web)
#   admin   -> React admin as static files   (--build-arg PACKAGE=@shopsphere/admin)
#
# Build from the repo root:
#   docker build -f infra/docker/images/node.Dockerfile --target service \
#     --build-arg PACKAGE=@shopsphere/order -t shopsphere/order .
#
# Runtime contract (ECS task definition / Kubernetes pod spec):
#   - config only from env vars (secrets injected from Secrets Manager / k8s Secrets)
#   - probes: GET /health/live, GET /health/ready (workers: on HEALTH_PORT)
#   - SIGTERM -> graceful shutdown within SHUTDOWN_TIMEOUT_MS (keep stopTimeout / grace period >= 30 s)
#   - runs as non-root UID 1000, writes nothing to disk (readOnlyRootFilesystem works)

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

# Keep only the package and its workspace dependencies (smaller context, better layer caching).
FROM base AS prune
ARG PACKAGE
RUN test -n "$PACKAGE" || (echo "--build-arg PACKAGE=@shopsphere/<name> is required" && exit 1)
COPY . .
RUN pnpm dlx turbo@^2 prune "$PACKAGE" --docker

FROM base AS build
ARG PACKAGE
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
RUN pnpm turbo run build --filter="$PACKAGE"

# Production-only node_modules + dist for one backend package.
FROM build AS deploy
ARG PACKAGE
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter "$PACKAGE" deploy --prod /out

# ---------- backend services and workers ----------
FROM node:${NODE_VERSION}-alpine AS service
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deploy /out ./
USER 1000:1000
CMD ["node", "--enable-source-maps", "dist/index.js"]

# ---------- Next.js customer app (output: "standalone") ----------
FROM node:${NODE_VERSION}-alpine AS web
ARG APP_DIR=apps/web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /repo/${APP_DIR}/.next/standalone ./
COPY --from=build /repo/${APP_DIR}/.next/static ./${APP_DIR}/.next/static
COPY --from=build /repo/${APP_DIR}/public ./${APP_DIR}/public
WORKDIR /app/${APP_DIR}
USER 1000:1000
EXPOSE 3000
CMD ["node", "server.js"]

# ---------- React admin: static files behind nginx (on AWS you can use S3 + CloudFront instead) ----------
FROM nginxinc/nginx-unprivileged:stable-alpine AS admin
ARG APP_DIR=apps/admin
COPY infra/docker/images/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/${APP_DIR}/dist /usr/share/nginx/html
EXPOSE 8080
