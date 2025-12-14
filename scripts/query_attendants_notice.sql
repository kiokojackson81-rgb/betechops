DO $$
DECLARE
  b uuid;
  s uuid;
BEGIN
  SELECT id INTO b FROM "User" WHERE email = 'benjamin@betech.co.ke' LIMIT 1;
  SELECT id INTO s FROM "User" WHERE email = 'stephen@betech.co.ke' LIMIT 1;
  RAISE NOTICE 'BENJAMIN_ID=%', b;
  RAISE NOTICE 'STEPHEN_ID=%', s;
END $$
