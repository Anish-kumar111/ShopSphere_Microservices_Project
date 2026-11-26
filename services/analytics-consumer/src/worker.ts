import { waitForAbort } from "@shopsphere/service-kit";
import { logger } from "./config/logger.js";

/**
 * The worker loop. Return (or reject) only when it should stop; finish in-flight work after `signal` aborts.
 * TODO Ch 17: Kafka group 'analytics' on orders.events -> analytics read models
 */
export async function run(signal: AbortSignal): Promise<void> {
  logger.info("waiting for work (not implemented yet)");
  await waitForAbort(signal);
}
