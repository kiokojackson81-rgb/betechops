-- List tables related to support receipts
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%support%receipt%';

-- List columns for matching tables
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name ILIKE '%support%receipt%'
ORDER BY table_name, ordinal_position;
