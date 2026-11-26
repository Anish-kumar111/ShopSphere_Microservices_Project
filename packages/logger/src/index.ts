import { pino, type Logger } from "pino";

export type { Logger };

export interface LoggerOptions {
  service: string;
  level?: string;
  /** Human-readable output for local development. Production always logs JSON to stdout. */
  pretty?: boolean;
}

/** Never let these reach the logs (CloudWatch / Loki keep logs for a long time). */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
];

export function createLogger({ service, level = "info", pretty = false }: LoggerOptions): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
          },
        }
      : {}),
  });
}
