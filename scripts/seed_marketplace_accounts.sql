-- scripts/seed_marketplace_accounts.sql
-- Run this against your Neon Postgres DB (psql or prisma db execute).
-- It upserts 12 marketplace accounts, their assignments, and 7 Jumia ApiCredentials.

DO $$
DECLARE
  ben_id text;
  ste_id text;
  acc_id text;
  scope_text text;
BEGIN
  -- Lookup attendant IDs
  SELECT id INTO ben_id FROM "User" WHERE email = 'benjamin@betech.co.ke' LIMIT 1;
  SELECT id INTO ste_id FROM "User" WHERE email = 'stephen@betech.co.ke' LIMIT 1;

  IF ben_id IS NULL OR ste_id IS NULL THEN
    RAISE EXCEPTION 'Attendant IDs missing. ben_id=% ste_id=%', ben_id, ste_id;
  END IF;

  RAISE NOTICE 'BENJAMIN_ID=%', ben_id;
  RAISE NOTICE 'STEPHEN_ID=%', ste_id;

  -- Helper: upsert account: update if exists (by displayName+platform), else insert and RETURN id
  -- We'll do a simple pattern repeated for each account.

  -- 1) Betech Store (JUMIA) - Benjamin (SUPERVISOR)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = 'e20e8623-e422-4566-a08a-37751f4bc759') OR ("displayName" = 'Betech Store' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('Betech Store','JUMIA','e20e8623-e422-4566-a08a-37751f4bc759','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='e20e8623-e422-4566-a08a-37751f4bc759', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  -- assignment for Benjamin
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ben_id, 'SUPERVISOR', NOW());
  END IF;
  -- ApiCredential for this Jumia account
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = 'e20e8623-e422-4566-a08a-37751f4bc759', "refreshToken" = 'ZDtXhILVt4aaOaMzvimP-aPf24hVRqRIQHnBqKkusro', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','e20e8623-e422-4566-a08a-37751f4bc759','ZDtXhILVt4aaOaMzvimP-aPf24hVRqRIQHnBqKkusro');
  END IF;

  -- 2) Hitech Power (JUMIA) - Benjamin
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37') OR ("displayName" = 'Hitech Power' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('Hitech Power','JUMIA','8c0e5ed0-8eb7-49c6-982c-1acdfef94d37','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ben_id, 'SUPERVISOR', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = '8c0e5ed0-8eb7-49c6-982c-1acdfef94d37', "refreshToken" = 'c6cbZEvITNbzpDswbqL8ohHXiYiMHvijPOQ5NSiZVho', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','8c0e5ed0-8eb7-49c6-982c-1acdfef94d37','c6cbZEvITNbzpDswbqL8ohHXiYiMHvijPOQ5NSiZVho');
  END IF;

  -- 3) Sky Store Ke (JUMIA) - Benjamin
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = 'cd95a840-f194-4f49-88fd-848f2c59456f') OR ("displayName" = 'Sky Store Ke' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('Sky Store Ke','JUMIA','cd95a840-f194-4f49-88fd-848f2c59456f','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='cd95a840-f194-4f49-88fd-848f2c59456f', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ben_id, 'SUPERVISOR', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = 'cd95a840-f194-4f49-88fd-848f2c59456f', "refreshToken" = 'g4tuabSji2kDNqhJw6ZB0FzIrNViXnjZMoDs8dmqCa8', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','cd95a840-f194-4f49-88fd-848f2c59456f','g4tuabSji2kDNqhJw6ZB0FzIrNViXnjZMoDs8dmqCa8');
  END IF;

  -- 4) LabTech Kenya (JUMIA) - Benjamin
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = '3579f345-a3ac-4e9d-b355-1990f0ad8a54') OR ("displayName" = 'LabTech Kenya' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('LabTech Kenya','JUMIA','3579f345-a3ac-4e9d-b355-1990f0ad8a54','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='3579f345-a3ac-4e9d-b355-1990f0ad8a54', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ben_id AND "role" = 'SUPERVISOR') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ben_id, 'SUPERVISOR', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = '3579f345-a3ac-4e9d-b355-1990f0ad8a54', "refreshToken" = '2f6INQ7qtY-NfVt2u1loWQz4WpMElqY4KhdYqQaRc40', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','3579f345-a3ac-4e9d-b355-1990f0ad8a54','2f6INQ7qtY-NfVt2u1loWQz4WpMElqY4KhdYqQaRc40');
  END IF;

  -- 5) JM Latest Collections (JUMIA) - Stephen (JUMIA_KILIMALL_OPS)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = 'f7df0953-7c18-4191-b304-614f9f0987a4') OR ("displayName" = 'JM Latest Collections' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('JM Latest Collections','JUMIA','f7df0953-7c18-4191-b304-614f9f0987a4','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='f7df0953-7c18-4191-b304-614f9f0987a4', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = 'f7df0953-7c18-4191-b304-614f9f0987a4', "refreshToken" = '6imHenWrlNgC31pA5n7LIVN_LCKRF2hlMGV90m_3GyI', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','f7df0953-7c18-4191-b304-614f9f0987a4','6imHenWrlNgC31pA5n7LIVN_LCKRF2hlMGV90m_3GyI');
  END IF;

  -- 6) Betech Solar Solution (JUMIA) - Stephen
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = 'b2a290cc-74fd-4b9e-a598-ef42fc57f918') OR ("displayName" = 'Betech Solar Solution' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('Betech Solar Solution','JUMIA','b2a290cc-74fd-4b9e-a598-ef42fc57f918','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='b2a290cc-74fd-4b9e-a598-ef42fc57f918', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = 'b2a290cc-74fd-4b9e-a598-ef42fc57f918', "refreshToken" = 'DaOJdJaGNK9Awt7w1UCh5hD69UCi6yE6iYI2QL6zVrs', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','b2a290cc-74fd-4b9e-a598-ef42fc57f918','DaOJdJaGNK9Awt7w1UCh5hD69UCi6yE6iYI2QL6zVrs');
  END IF;

  -- 7) Maxton Enterprise (JUMIA) - Stephen
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE ("platform" = 'JUMIA' AND "jumiaShopSid" = '61e52422-f98e-49da-87e2-f9c832bf1a04') OR ("displayName" = 'Maxton Enterprise' AND "platform" = 'JUMIA') LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","jumiaShopSid","countryCode","currency","isActive")
    VALUES ('Maxton Enterprise','JUMIA','61e52422-f98e-49da-87e2-f9c832bf1a04','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "jumiaShopSid"='61e52422-f98e-49da-87e2-f9c832bf1a04', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;
  scope_text := 'MARKETPLACE_ACCOUNT:' || acc_id::text;
  IF EXISTS (SELECT 1 FROM "ApiCredential" WHERE "scope" = scope_text) THEN
    UPDATE "ApiCredential"
    SET "clientId" = '61e52422-f98e-49da-87e2-f9c832bf1a04', "refreshToken" = 'NcTY3YJlPdk3-4TROf5sfDOlo3yo234njGyfMQIUjmE', "apiBase" = 'https://vendor-api.jumia.com', "updatedAt" = NOW()
    WHERE "scope" = scope_text;
  ELSE
    INSERT INTO "ApiCredential" ("scope","apiBase","clientId","refreshToken")
    VALUES (scope_text, 'https://vendor-api.jumia.com','61e52422-f98e-49da-87e2-f9c832bf1a04','NcTY3YJlPdk3-4TROf5sfDOlo3yo234njGyfMQIUjmE');
  END IF;

  -- Kilimall accounts (no ApiCredential entries provided) - assign to Stephen

  -- 8) Betech Kilimall
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE "displayName" = 'Betech Kilimall' AND "platform" = 'KILIMALL' LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","kilimallShopCode","countryCode","currency","isActive")
    VALUES ('Betech Kilimall','KILIMALL','BETECH_KILIMALL','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "kilimallShopCode"='BETECH_KILIMALL', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;

  -- 9) Hitech Access (KILIMALL)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE "displayName" = 'Hitech Access' AND "platform" = 'KILIMALL' LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","kilimallShopCode","countryCode","currency","isActive")
    VALUES ('Hitech Access','KILIMALL','HITECH_ACCESS','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "kilimallShopCode"='HITECH_ACCESS', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;

  -- 10) Betech Solar Kilimall (KILIMALL)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE "displayName" = 'Betech Solar Kilimall' AND "platform" = 'KILIMALL' LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","kilimallShopCode","countryCode","currency","isActive")
    VALUES ('Betech Solar Kilimall','KILIMALL','BETECH_SOLAR_KILIMALL','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "kilimallShopCode"='BETECH_SOLAR_KILIMALL', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;

  -- 11) JM Collection (KILIMALL)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE "displayName" = 'JM Collection' AND "platform" = 'KILIMALL' LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","kilimallShopCode","countryCode","currency","isActive")
    VALUES ('JM Collection','KILIMALL','JM_COLLECTION','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "kilimallShopCode"='JM_COLLECTION', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;

  -- 12) Hitech Power Kilimall (KILIMALL)
  acc_id := NULL;
  SELECT id INTO acc_id FROM "MarketplaceAccount" WHERE "displayName" = 'Hitech Power Kilimall' AND "platform" = 'KILIMALL' LIMIT 1;
  IF acc_id IS NULL THEN
    INSERT INTO "MarketplaceAccount" ("displayName","platform","kilimallShopCode","countryCode","currency","isActive")
    VALUES ('Hitech Power Kilimall','KILIMALL','HITECH_POWER_KILIMALL','KE','KES', true)
    RETURNING id INTO acc_id;
  ELSE
    UPDATE "MarketplaceAccount"
    SET "kilimallShopCode"='HITECH_POWER_KILIMALL', "countryCode"='KE', "currency"='KES', "isActive"=true
    WHERE id = acc_id;
  END IF;
  UPDATE "MarketplaceAccountAssignment" SET "endsAt" = NULL
    WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS';
  IF NOT EXISTS (SELECT 1 FROM "MarketplaceAccountAssignment" WHERE "accountId" = acc_id AND "attendantId" = ste_id AND "role" = 'JUMIA_KILIMALL_OPS') THEN
    INSERT INTO "MarketplaceAccountAssignment" ("accountId","attendantId","role","startsAt")
    VALUES (acc_id, ste_id, 'JUMIA_KILIMALL_OPS', NOW());
  END IF;

  RAISE NOTICE 'Seeding complete.';
END $$ LANGUAGE plpgsql;

-- Notes:
-- 1) The script expects the tables and columns named exactly as used above (case-sensitive with double quotes).
-- 2) If your DB schema uses different column names, adapt the script accordingly.
-- 3) To run: `psql "<CONNECTION_STRING>" -f scripts/seed_marketplace_accounts.sql` or use `pnpm prisma db execute --file=./scripts/seed_marketplace_accounts.sql` depending on your tooling.
