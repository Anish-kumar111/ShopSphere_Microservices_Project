import { waitForAbort } from "@shopsphere/service-kit";
import { logger } from "./config/logger.js";

/**
 * The worker loop. Return (or reject) only when it should stop; finish in-flight work after `signal` aborts.
 * TODO Ch 9: poll outbox tables (FOR UPDATE SKIP LOCKED), publish to Kafka / RabbitMQ
 */
export async function run(signal: AbortSignal): Promise<void> {
  logger.info("waiting for work (not implemented yet)");
  await waitForAbort(signal);
}
