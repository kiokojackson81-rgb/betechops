-- scripts/remove_weeklySummary.sql
-- Postgres SQL migration to remove `weeklySummary` keys from
-- `tasks -> 'dayFields' -> <day> -> 'weeklySummary'` for DailyReport rows.
--
-- Safety notes:
--  - Run a backup before applying to production.
--  - Test on a staging copy first.
--  - The statement below updates rows in-place; for very large tables
--    consider running in smaller batches or using a server-side job.
-- Usage (preview rows that would be changed):
--   SELECT id, tasks->'dayFields' AS dayFields
--   FROM "DailyReport"
--   WHERE tasks ? 'dayFields' AND (tasks->'dayFields')::text LIKE '%weeklySummary%';
--
-- Dry-run: list affected row ids
--   SELECT id FROM "DailyReport" WHERE tasks ? 'dayFields' AND (tasks->'dayFields')::text LIKE '%weeklySummary%';

-- Update statement: rebuild the `dayFields` object where each nested
-- object has the `weeklySummary` key removed (if present).
BEGIN;

UPDATE "DailyReport"
SET tasks = jsonb_set(
  tasks,
  '{dayFields}',
  (
    SELECT jsonb_object_agg(key, (value - 'weeklySummary'))
    FROM jsonb_each(tasks->'dayFields') AS t(key, value)
  )
)
WHERE tasks ? 'dayFields'
  AND (tasks->'dayFields')::text LIKE '%weeklySummary%';

COMMIT;

-- Notes:
--  - This operation replaces the whole `dayFields` object in each matched
--    row. It preserves all other keys and nested fields, but for each
--    nested day object it deletes the property named `weeklySummary`.
--  - If you prefer a chunked approach, wrap the update per id range or
--    use a server-side cursor to avoid long-running transactions.
