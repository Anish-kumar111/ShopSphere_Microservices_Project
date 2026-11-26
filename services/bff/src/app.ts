import { createHttpApp, type Health } from "@shopsphere/service-kit";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { router } from "./routes/index.js";

/** Built separately from index.ts so tests can call it with supertest. */
export function buildApp(health: Health) {
  return createHttpApp({
    config: env,
    logger,
    health,
    register: (app) => app.use("/api", router),
  });
}
