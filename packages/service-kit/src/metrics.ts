// packages/service-kit/src/metrics.ts
import { Counter, Gauge, register } from "prom-client";

/**
 * Circuit breaker state per downstream dependency.
 * Values follow cockatiel's CircuitState enum: 0 = closed, 1 = open, 2 = half-open, 3 = isolated.
 * Alert when it stays at 1 (open) for more than a minute.
 */
export const breakerState = new Gauge({
  name: "circuit_breaker_state",
  help: "Circuit breaker state: 0 closed, 1 open, 2 half-open, 3 isolated",
  labelNames: ["dependency"] as const,
});

/** Cache effectiveness, labelled by cache name (e.g. "product", "products"). Target > 90% hits. */
export const cacheHits = new Counter({
  name: "cache_hits_total",
  help: "Cache hits",
  labelNames: ["cache"] as const,
});

export const cacheMisses = new Counter({
  name: "cache_misses_total",
  help: "Cache misses",
  labelNames: ["cache"] as const,
});

/** The default registry, so a service can expose everything: res.type(register.contentType).send(await register.metrics()) */
export { register as metricsRegistry };
