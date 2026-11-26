import { Router } from "express";

export interface ReadinessCheck {
  name: string;
  /** Resolves when the dependency is usable, e.g. `() => pool.query("SELECT 1")`. */
  check: () => Promise<unknown>;
  timeoutMs?: number;
}

/**
 * GET /health/live  -> the process runs. Never checks dependencies (a DB outage must not restart every task).
 * GET /health/ready -> send me traffic. Checks dependencies and returns 503 while shutting down.
 *
 * ALB target group / ECS / k8s readinessProbe -> /health/ready, k8s livenessProbe -> /health/live.
 */
export class Health {
  #shuttingDown = false;
  readonly #checks: ReadinessCheck[];

  constructor(checks: ReadinessCheck[] = []) {
    this.#checks = checks;
  }

  markShuttingDown(): void {
    this.#shuttingDown = true;
  }

  async readiness(): Promise<{ ok: boolean; checks: Record<string, string> }> {
    if (this.#shuttingDown) return { ok: false, checks: { shutdown: "in progress" } };

    const results = await Promise.all(
      this.#checks.map(async ({ name, check, timeoutMs = 2_000 }) => {
        try {
          await withTimeout(check(), timeoutMs);
          return [name, "ok"] as const;
        } catch (err) {
          return [name, err instanceof Error ? err.message : "failed"] as const;
        }
      }),
    );
    return {
      ok: results.every(([, state]) => state === "ok"),
      checks: Object.fromEntries(results),
    };
  }

  router(): Router {
    const router = Router();
    router.get("/health/live", (_req, res) => {
      res.json({ status: "ok" });
    });
    router.get("/health/ready", async (_req, res) => {
      const { ok, checks } = await this.readiness();
      res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable", checks });
    });
    return router;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
