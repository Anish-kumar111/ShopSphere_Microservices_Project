import { createServiceLogger } from "@shopsphere/service-kit";
import { env } from "./env.js";

export const logger = createServiceLogger(env);
