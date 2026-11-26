import { httpEnvSchema, loadConfig, port } from "@shopsphere/service-kit";
import { z } from "zod";

export const env = loadConfig(
  httpEnvSchema.extend({
    SERVICE_NAME: z.string().default("bff"),
    PORT: port(4000),
    // Add this service's settings here (see .env.example), e.g.
    // DATABASE_URL: z.url(),
  }),
);
