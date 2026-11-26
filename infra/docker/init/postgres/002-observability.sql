-- Query statistics for performance work (course Chapter 7). Needs shared_preload_libraries,
-- which docker-compose.yml sets on the postgres command line.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
