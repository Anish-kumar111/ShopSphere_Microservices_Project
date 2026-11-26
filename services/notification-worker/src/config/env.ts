import { loadConfig, port, workerEnvSchema } from "@shopsphere/service-kit";
import { z } from "zod";

export const env = loadConfig(
  workerEnvSchema.extend({
    SERVICE_NAME: z.string().default("notification-worker"),
    HEALTH_PORT: port(9101),
    // Add this worker's settings here (see .env.example), e.g.
    // KAFKA_BROKERS: csv(),
  }),
);
