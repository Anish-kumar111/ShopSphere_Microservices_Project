import { loadConfig, port, workerEnvSchema } from "@shopsphere/service-kit";
import { z } from "zod";

export const env = loadConfig(
  workerEnvSchema.extend({
    SERVICE_NAME: z.string().default("analytics-consumer"),
    HEALTH_PORT: port(9102),
    // Add this worker's settings here (see .env.example), e.g.
    // KAFKA_BROKERS: csv(),
  }),
);
