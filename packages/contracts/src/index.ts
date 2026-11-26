/**
 * Shared message contracts (Chapter 9). Every Kafka event and RabbitMQ job uses this envelope.
 * Python services mirror these names in python-libs/shared (shopsphere_shared.events).
 */
export interface EventEnvelope<TType extends string = string, TData = unknown> {
  eventId: string;
  type: TType;
  version: number;
  occurredAt: string;
  source: string;
  /** W3C trace context, so one trace follows the message across services (Chapter 18). */
  traceparent?: string;
  data: TData;
}

export const Topics = {
  orders: "orders.events",
  users: "users.events",
  imports: "imports.events",
} as const;

export const Exchanges = {
  jobs: "jobs",
  jobsDeadLetter: "jobs.dlx",
} as const;

export const Queues = {
  notifications: "notifications",
  etlJobs: "etl.jobs",
} as const;

export const RedisChannels = {
  importProgress: "import-progress",
} as const;
