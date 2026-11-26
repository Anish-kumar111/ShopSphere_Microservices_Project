// packages/service-kit/src/resilience.ts
import {
    bulkhead, circuitBreaker, ExponentialBackoff, handleAll, handleWhen, retry,
    SamplingBreaker, TaskCancelledError, timeout, TimeoutStrategy, wrap,
} from "cockatiel";
import { HttpError } from "./errors.js";
import { breakerState } from "./metrics.js";
// Retry only what can succeed a moment later: 5xx, timeouts, refused connections. Never 4xx.
// cockatiel passes `unknown` (anything can be thrown), so narrow it before reading fields.
const isTransient = (e: unknown): boolean => {
    if (!(e instanceof Error)) return false;
    return (e instanceof UpstreamError && e.status >= 500) ||
        e instanceof TaskCancelledError ||                       // cockatiel timeout
        ["TimeoutError", "AbortError"].includes(e.name) ||
        ["ECONNREFUSED", "ECONNRESET", "UND_ERR_SOCKET"].includes((e.cause as { code?: string } | undefined)?.code ?? "");
};
const transient = handleWhen(isTransient);
export function resilientPolicy(name: string, opts: {
    concurrency?: number; timeoutMs?: number
} = {}) {
    const breaker = circuitBreaker(handleAll, {
        halfOpenAfter: 10_000,
        breaker: new SamplingBreaker({ threshold: 0.5, duration: 30_000, minimumRps: 2 }),
    });
    breaker.onStateChange((state) => breakerState.set({ dependency: name }, state)); //
    //CircuitState enum: 0..3
    return {
        idempotent: wrap(bulkhead(opts.concurrency ?? 50, 100), breaker,
            retry(transient, {
                maxAttempts: 2, backoff: new ExponentialBackoff({
                    initialDelay: 100, maxDelay: 1_000
                })
            }),
            timeout(opts.timeoutMs ?? 2_000, TimeoutStrategy.Aggressive)),
        nonIdempotent: wrap(bulkhead(opts.concurrency ?? 50, 100), breaker,
            timeout(opts.timeoutMs ?? 2_000, TimeoutStrategy.Aggressive)),
    };
}
export class UpstreamError extends Error {
    constructor(readonly service: string, readonly status: number, readonly body: unknown) {
        super(`${service} responded ${status}`);
    }
}
export interface CallContext { accessToken?: string; requestId: string; deadline: number }


export class ServiceClient {
    private readonly policy;
    constructor(private readonly name: string, private readonly baseUrl: string, opts?: {
        timeoutMs?: number
    }) {
        this.policy = resilientPolicy(name, opts);
    }
    /** Returns { status, body } for 2xx and 4xx (business answers); throws UpstreamError for
    5xx. */
    async request<T>(ctx: CallContext, method: string, path: string,
        init: { body?: unknown; headers?: Record<string, string> } = {}): Promise<{
            status: number; body: T
        }> {
        const remaining = ctx.deadline - Date.now();
        if (remaining < 50) throw new HttpError(504, "Deadline exceeded");
        const policy = method === "GET" ? this.policy.idempotent : this.policy.nonIdempotent;
        return policy.execute(async ({ signal }) => {
            const res = await fetch(this.baseUrl + path, {
                method,
                signal: AbortSignal.any([signal, AbortSignal.timeout(remaining)]),
                headers: {
                    "content-type": "application/json",
                    "x-request-id": ctx.requestId,
                    "x-deadline": String(ctx.deadline),
                    ...(ctx.accessToken ? { authorization: `Bearer ${ctx.accessToken}` } : {}),
                    ...init.headers,
                },
                body: init.body === undefined ? undefined : JSON.stringify(init.body),
            });
            const body = res.status === 204 ? null : await res.json().catch(() => null);
            if (res.status >= 500) throw new UpstreamError(this.name, res.status, body);
            return { status: res.status, body: body as T };
        });
    }
    get = <T>(ctx: CallContext, path: string) => this.request<T>(ctx, "GET", path);
}