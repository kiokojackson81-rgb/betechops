-- JSON output version to ensure results are printed
SELECT json_agg(row_to_json(t)) AS tables
FROM (SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%support%receipt%') t;

SELECT json_agg(row_to_json(t)) AS columns
FROM (
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name ILIKE '%support%receipt%'
  ORDER BY table_name, ordinal_position
) t;
