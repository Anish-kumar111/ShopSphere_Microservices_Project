import { Health, startWorker } from "@shopsphere/service-kit";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { run } from "./worker.js";

// Readiness checks, e.g. { name: "rabbitmq", check: () => channel.checkQueue("notifications") }
const health = new Health([]);

startWorker({ config: env, logger, health, run, onShutdown: [] });
