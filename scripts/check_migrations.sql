SELECT id, migration_name, finished_at, logs, started_at, applied_steps_count
FROM _prisma_migrations
ORDER BY started_at DESC
LIMIT 20;