import request from "supertest";
import { describe, expect, it } from "vitest";
import { createLogger } from "@shopsphere/logger";
import { Health, HttpError, createHttpApp } from "../src/index.js";

const logger = createLogger({ service: "test", level: "silent" });
const config = { TRUST_PROXY_HOPS: 1, CORS_ORIGINS: [] };

function build(health = new Health()) {
  return createHttpApp({
    config,
    logger,
    health,
    register: (app) => {
      app.get("/boom", () => {
        throw new HttpError(409, "Conflict", { detail: "already exists" });
      });
    },
  });
}

describe("createHttpApp", () => {
  it("answers liveness and readiness", async () => {
    await request(build()).get("/health/live").expect(200, { status: "ok" });
    await request(build()).get("/health/ready").expect(200);
  });

  it("reports not ready while shutting down", async () => {
    const health = new Health();
    health.markShuttingDown();
    await request(build(health)).get("/health/ready").expect(503);
  });

  it("returns problem details and echoes the request id", async () => {
    const res = await request(build()).get("/boom").set("x-request-id", "req-1").expect(409);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.headers["x-request-id"]).toBe("req-1");
    expect(res.body).toMatchObject({
      status: 409,
      title: "Conflict",
      detail: "already exists",
      requestId: "req-1",
    });
  });

  it("returns 404 problem details for unknown routes", async () => {
    await request(build()).get("/nope").expect(404);
  });
});
