import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import express from "express";
import type { Logger } from "@shopsphere/logger";
import type { BaseConfig, HttpConfig, WorkerConfig } from "./config.js";
import type { Health } from "./health.js";

/** Runs on shutdown, in order: close Kafka consumers, DB pools, Redis clients... */
export type ShutdownHook = () => Promise<unknown> | unknown;

interface CommonOptions {
  logger: Logger;
  health: Health;
  onShutdown?: ShutdownHook[];
}

export interface HttpServiceOptions extends CommonOptions {
  app: http.RequestListener;
  config: HttpConfig;
}

export interface WorkerOptions extends CommonOptions {
  config: WorkerConfig;
  /** The worker loop. Stop when `signal` is aborted (SIGTERM from ECS / Kubernetes). */
  run: (signal: AbortSignal) => Promise<void>;
}

/** Starts an HTTP service with graceful shutdown. Returns the server (Socket.IO attaches to it). */
export function startHttpService({
  app,
  config,
  logger,
  health,
  onShutdown = [],
}: HttpServiceOptions): http.Server {
  const server = http.createServer(app);
  // Longer than the ALB idle timeout (60 s), so the load balancer closes idle sockets first.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  handleShutdown({ config, logger, health, hooks: [() => closeServer(server), ...onShutdown] });

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, `${config.SERVICE_NAME} listening`);
  });
  return server;
}

/** Starts a background worker plus a small health server on HEALTH_PORT. */
export function startWorker({ config, logger, health, run, onShutdown = [] }: WorkerOptions): void {
  const controller = new AbortController();
  const healthApp = express().disable("x-powered-by").use(health.router());
  const server = http.createServer(healthApp);
  let running: Promise<void> = Promise.resolve();

  const shutdown = handleShutdown({
    config,
    logger,
    health,
    hooks: [
      async () => {
        controller.abort();
        await running;
      },
      ...onShutdown,
      () => closeServer(server),
    ],
  });

  server.listen(config.HEALTH_PORT, () => {
    logger.info(
      { healthPort: config.HEALTH_PORT, env: config.NODE_ENV },
      `${config.SERVICE_NAME} started`,
    );
  });

  running = run(controller.signal).then(
    () => {
      if (!controller.signal.aborted) void shutdown("worker finished");
    },
    (err: unknown) => {
      logger.fatal({ err }, "worker crashed");
      void shutdown("worker crashed", 1);
    },
  );
}

/** Resolves when the signal is aborted. Useful for workers that only react to callbacks. */
export function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) =>
    signal.addEventListener("abort", () => resolve(), { once: true }),
  );
}

function handleShutdown({
  config,
  logger,
  health,
  hooks,
}: {
  config: BaseConfig;
  logger: Logger;
  health: Health;
  hooks: ShutdownHook[];
}) {
  let started = false;

  const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
    if (started) return;
    started = true;
    logger.info({ reason }, "shutting down");
    health.markShuttingDown();

    const force = setTimeout(() => {
      logger.error("graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, config.SHUTDOWN_TIMEOUT_MS);
    force.unref();

    try {
      if (config.SHUTDOWN_DRAIN_MS > 0) await delay(config.SHUTDOWN_DRAIN_MS);
      for (const hook of hooks) await hook();
      logger.info("shutdown complete");
    } catch (err) {
      logger.error({ err }, "error during shutdown");
      exitCode = 1;
    } finally {
      logger.flush();
      process.exit(exitCode);
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (err) => {
    logger.fatal({ err }, "unhandled promise rejection");
    void shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught exception");
    void shutdown("uncaughtException", 1);
  });

  return shutdown;
}

function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  });
}
