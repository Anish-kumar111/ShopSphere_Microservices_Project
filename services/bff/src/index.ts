import { Health, startHttpService } from "@shopsphere/service-kit";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

// Readiness checks for this service's dependencies, e.g.
// { name: "postgres", check: () => pool.query("SELECT 1") }
const health = new Health([]);

startHttpService({
  app: buildApp(health),
  config: env,
  logger,
  health,
  // Close clients in order on SIGTERM, e.g. () => pool.end()
  onShutdown: [],
});
