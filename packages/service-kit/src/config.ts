import { z } from "zod";

export const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

/** Settings every service has. Services extend one of the schemas below with their own keys. */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVICE_NAME: z.string().min(1),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  /** Hard limit for a graceful shutdown. Keep it below ECS `stopTimeout` / k8s `terminationGracePeriodSeconds` (30 s). */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  /** Keep serving this long after readiness turns 503, so the load balancer stops routing first (~5000 on EKS). */
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).default(0),
});

export const port = (fallback: number) =>
  z.coerce.number().int().min(1).max(65_535).default(fallback);

/** Comma-separated list, e.g. "http://localhost:3000,http://localhost:5173". */
export const csv = () =>
  z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );

/** Services that serve HTTP (Express APIs, the BFF, the realtime gateway). */
export const httpEnvSchema = baseEnvSchema.extend({
  PORT: port(3000),
  /** Proxies in front of the service: 1 locally (Traefik), 2 on AWS (CloudFront + ALB). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  /** Leave empty when browsers only reach the service through the gateway (same origin). */
  CORS_ORIGINS: csv(),
});

/** Background workers: no public port, only a health endpoint for ECS / Kubernetes probes. */
export const workerEnvSchema = baseEnvSchema.extend({
  HEALTH_PORT: port(9100),
});

export type BaseConfig = z.infer<typeof baseEnvSchema>;
export type HttpConfig = z.infer<typeof httpEnvSchema>;
export type WorkerConfig = z.infer<typeof workerEnvSchema>;

/**
 * Reads process.env (plus ./.env outside production), validates it and freezes it.
 * Exits with a clear message when a setting is missing: crash at start-up, not on the first request.
 */
export function loadConfig<S extends z.ZodType<BaseConfig>>(schema: S): Readonly<z.infer<S>> {
  if (process.env.NODE_ENV !== "production") {
    try {
      process.loadEnvFile(); // ./.env of the service folder; variables already set win
    } catch {
      // no .env file: fine
    }
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}
