import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Logger } from "@shopsphere/logger";
import type { HttpConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import type { Health } from "./health.js";

export interface HttpAppOptions {
  config: Pick<HttpConfig, "TRUST_PROXY_HOPS" | "CORS_ORIGINS">;
  logger: Logger;
  health: Health;
  /** Mount your routers here. The 404 and error handlers are added after it. */
  register?: (app: Express) => void;
  jsonLimit?: string;
}

/** The same Express middleware stack in every service. */
export function createHttpApp({
  config,
  logger,
  health,
  register,
  jsonLimit = "1mb",
}: HttpAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY_HOPS);

  // Before request logging: load balancers probe every few seconds.
  app.use(health.router());

  app.use(
    pinoHttp({
      logger,
      // Reuse the id from Traefik / the BFF, so one id follows a request through every service.
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id = typeof incoming === "string" && incoming.length <= 128 ? incoming : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    }),
  );
  app.use(helmet());
  if (config.CORS_ORIGINS.length > 0) {
    app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  }
  app.use(express.json({ limit: jsonLimit }));

  register?.(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
