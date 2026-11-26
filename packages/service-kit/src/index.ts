import { createLogger, type Logger } from "@shopsphere/logger";
import type { BaseConfig } from "./config.js";

export * from "./config.js";
export * from "./errors.js";
export * from "./health.js";
export * from "./http.js";
export * from "./lifecycle.js";
export * from "./metrics.js";
export * from "./resilience.js";
export type { Logger };

/** JSON logs in production, pretty logs during `pnpm dev`. */
export function createServiceLogger(config: BaseConfig): Logger {
  return createLogger({
    service: config.SERVICE_NAME,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === "development",
  });
}
