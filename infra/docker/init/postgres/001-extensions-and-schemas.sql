-- Runs once, when the postgres volume is first created (`docker compose down -v` to re-run).
-- Tables belong in each service's migrations (Chapter 4), not here.

CREATE EXTENSION IF NOT EXISTS vector; -- pgvector for the AI chat (Chapter 16)

-- One schema per service: only the owning service reads or writes it.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS orders;
CREATE SCHEMA IF NOT EXISTS imports;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS analytics;

-- TODO Chapter 4: one database user per service with access to its own schema only, e.g.
--   CREATE ROLE order_svc LOGIN PASSWORD '...';
--   GRANT USAGE, CREATE ON SCHEMA orders TO order_svc;
