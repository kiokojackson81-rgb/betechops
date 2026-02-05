-- DRY-RUN normalization SQL for JUMIA accounts (do NOT run without review)

-- This script archives affected rows and reassigns credentials to canonical accounts, then deactivates duplicates

-- ==== Proposed changes for duplicate account ff8e0bd3-8b24-40d6-af27-64d55a87c041 (Betech Store)

-- Archive account ff8e0bd3-8b24-40d6-af27-64d55a87c041
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- Archive payouts for account ff8e0bd3-8b24-40d6-af27-64d55a87c041
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- Reassign credential 3e36e0c1-700f-4c69-92c3-51942833cc81 to canonical account 6e1186af-a6b3-4eb6-9547-1038733c3306
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:6e1186af-a6b3-4eb6-9547-1038733c3306' WHERE id='3e36e0c1-700f-4c69-92c3-51942833cc81';

-- Deactivate duplicate account ff8e0bd3-8b24-40d6-af27-64d55a87c041
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- ==== Proposed changes for duplicate account fad5155d-4223-4b58-bec6-87f7a5690c37 (Betech Solar Solution)

-- Archive account fad5155d-4223-4b58-bec6-87f7a5690c37
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- Archive payouts for account fad5155d-4223-4b58-bec6-87f7a5690c37
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- Reassign credential 57b10d78-3ef9-4655-bea8-111b13e1d1e9 to canonical account 6e1186af-a6b3-4eb6-9547-1038733c3306
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:6e1186af-a6b3-4eb6-9547-1038733c3306' WHERE id='57b10d78-3ef9-4655-bea8-111b13e1d1e9';

-- Deactivate duplicate account fad5155d-4223-4b58-bec6-87f7a5690c37
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- ==== Proposed changes for duplicate account f97458d2-b432-4793-8283-8cc54fe1d42a (Betech Kilimall)

-- Archive account f97458d2-b432-4793-8283-8cc54fe1d42a
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- Archive payouts for account f97458d2-b432-4793-8283-8cc54fe1d42a
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- No credential on f97458d2-b432-4793-8283-8cc54fe1d42a

-- Deactivate duplicate account f97458d2-b432-4793-8283-8cc54fe1d42a
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- ==== Proposed changes for duplicate account b6a9ed06-2b75-4bdc-a004-4f83af524ad0 (Betech Solar Kilimall)

-- Archive account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- Archive payouts for account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- No credential on b6a9ed06-2b75-4bdc-a004-4f83af524ad0

-- Deactivate duplicate account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- Move credential 3e36e0c1-700f-4c69-92c3-51942833cc81 from ff8e0bd3-8b24-40d6-af27-64d55a87c041 to canonical 6e1186af-a6b3-4eb6-9547-1038733c3306
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:6e1186af-a6b3-4eb6-9547-1038733c3306' WHERE id='3e36e0c1-700f-4c69-92c3-51942833cc81';

-- ==== Proposed changes for duplicate account 34b278de-4617-4a66-bfe1-8b08afafd7f9 (Hitech Power)

-- Archive account 34b278de-4617-4a66-bfe1-8b08afafd7f9
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='34b278de-4617-4a66-bfe1-8b08afafd7f9';

-- Archive payouts for account 34b278de-4617-4a66-bfe1-8b08afafd7f9
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='34b278de-4617-4a66-bfe1-8b08afafd7f9';

-- Reassign credential cb40348d-6bc5-4714-a6a0-7fa08797107c to canonical account 447747f0-ed55-4794-b8a6-e492183ba9a0
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:447747f0-ed55-4794-b8a6-e492183ba9a0' WHERE id='cb40348d-6bc5-4714-a6a0-7fa08797107c';

-- Deactivate duplicate account 34b278de-4617-4a66-bfe1-8b08afafd7f9
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='34b278de-4617-4a66-bfe1-8b08afafd7f9';

-- ==== Proposed changes for duplicate account f3f1f046-c82c-4b31-ad93-8b74e932cc1a (Hitech Access)

-- Archive account f3f1f046-c82c-4b31-ad93-8b74e932cc1a
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='f3f1f046-c82c-4b31-ad93-8b74e932cc1a';

-- Archive payouts for account f3f1f046-c82c-4b31-ad93-8b74e932cc1a
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='f3f1f046-c82c-4b31-ad93-8b74e932cc1a';

-- No credential on f3f1f046-c82c-4b31-ad93-8b74e932cc1a

-- Deactivate duplicate account f3f1f046-c82c-4b31-ad93-8b74e932cc1a
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='f3f1f046-c82c-4b31-ad93-8b74e932cc1a';

-- ==== Proposed changes for duplicate account 85e11702-55f8-426e-860a-2063b068fe39 (Hitech Power Kilimall)

-- Archive account 85e11702-55f8-426e-860a-2063b068fe39
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='85e11702-55f8-426e-860a-2063b068fe39';

-- Archive payouts for account 85e11702-55f8-426e-860a-2063b068fe39
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='85e11702-55f8-426e-860a-2063b068fe39';

-- No credential on 85e11702-55f8-426e-860a-2063b068fe39

-- Deactivate duplicate account 85e11702-55f8-426e-860a-2063b068fe39
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='85e11702-55f8-426e-860a-2063b068fe39';

-- Move credential cb40348d-6bc5-4714-a6a0-7fa08797107c from 34b278de-4617-4a66-bfe1-8b08afafd7f9 to canonical 447747f0-ed55-4794-b8a6-e492183ba9a0
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:447747f0-ed55-4794-b8a6-e492183ba9a0' WHERE id='cb40348d-6bc5-4714-a6a0-7fa08797107c';

-- Canonical account 3ad790b3-e827-49e2-b1a1-4fb978c9b577 already has credential cmk2503xq0000v544ijzuab08

-- ==== Proposed changes for duplicate account a840db92-3811-4114-a890-ad0329900f53 (LabTech Kenya)

-- Archive account a840db92-3811-4114-a890-ad0329900f53
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='a840db92-3811-4114-a890-ad0329900f53';

-- Archive payouts for account a840db92-3811-4114-a890-ad0329900f53
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='a840db92-3811-4114-a890-ad0329900f53';

-- Reassign credential 8179243c-1d00-4bbc-8c2e-d5a1270702a0 to canonical account c6847a48-c9d8-45b9-b87b-2e22102ab4ab
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:c6847a48-c9d8-45b9-b87b-2e22102ab4ab' WHERE id='8179243c-1d00-4bbc-8c2e-d5a1270702a0';

-- Deactivate duplicate account a840db92-3811-4114-a890-ad0329900f53
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='a840db92-3811-4114-a890-ad0329900f53';

-- Move credential 8179243c-1d00-4bbc-8c2e-d5a1270702a0 from a840db92-3811-4114-a890-ad0329900f53 to canonical c6847a48-c9d8-45b9-b87b-2e22102ab4ab
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:c6847a48-c9d8-45b9-b87b-2e22102ab4ab' WHERE id='8179243c-1d00-4bbc-8c2e-d5a1270702a0';

-- ==== Proposed changes for duplicate account fdd39dc3-781f-475c-8939-b6559d6fb4d6 (Maxton Enterprise)

-- Archive account fdd39dc3-781f-475c-8939-b6559d6fb4d6
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='fdd39dc3-781f-475c-8939-b6559d6fb4d6';

-- Archive payouts for account fdd39dc3-781f-475c-8939-b6559d6fb4d6
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='fdd39dc3-781f-475c-8939-b6559d6fb4d6';

-- Reassign credential 890819c5-5e6f-4bc4-90f0-eca5572eaa1f to canonical account c4a9b0c1-1bd4-4575-bb0f-125997838914
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:c4a9b0c1-1bd4-4575-bb0f-125997838914' WHERE id='890819c5-5e6f-4bc4-90f0-eca5572eaa1f';

-- Deactivate duplicate account fdd39dc3-781f-475c-8939-b6559d6fb4d6
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='fdd39dc3-781f-475c-8939-b6559d6fb4d6';

-- Move credential 890819c5-5e6f-4bc4-90f0-eca5572eaa1f from fdd39dc3-781f-475c-8939-b6559d6fb4d6 to canonical c4a9b0c1-1bd4-4575-bb0f-125997838914
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:c4a9b0c1-1bd4-4575-bb0f-125997838914' WHERE id='890819c5-5e6f-4bc4-90f0-eca5572eaa1f';

-- ==== Proposed changes for duplicate account 287e8f61-b92e-4463-afea-f855fa125bfb (Sky Store Ke)

-- Archive account 287e8f61-b92e-4463-afea-f855fa125bfb
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='287e8f61-b92e-4463-afea-f855fa125bfb';

-- Archive payouts for account 287e8f61-b92e-4463-afea-f855fa125bfb
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='287e8f61-b92e-4463-afea-f855fa125bfb';

-- Reassign credential a9cdf3b6-90c4-4b06-9a43-deb14501325a to canonical account 3a4cc676-3432-43a1-b05c-82c935aedee1
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:3a4cc676-3432-43a1-b05c-82c935aedee1' WHERE id='a9cdf3b6-90c4-4b06-9a43-deb14501325a';

-- Deactivate duplicate account 287e8f61-b92e-4463-afea-f855fa125bfb
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='287e8f61-b92e-4463-afea-f855fa125bfb';

-- Move credential a9cdf3b6-90c4-4b06-9a43-deb14501325a from 287e8f61-b92e-4463-afea-f855fa125bfb to canonical 3a4cc676-3432-43a1-b05c-82c935aedee1
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:3a4cc676-3432-43a1-b05c-82c935aedee1' WHERE id='a9cdf3b6-90c4-4b06-9a43-deb14501325a';

-- ==== Proposed changes for duplicate account 17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63 (JM Latest Collections)

-- Archive account 17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63';

-- Archive payouts for account 17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63';

-- Reassign credential d261d665-8aa9-4f36-a953-b1a571593fc6 to canonical account 9257651a-3d68-4e88-b330-6cc53afb4cfc
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:9257651a-3d68-4e88-b330-6cc53afb4cfc' WHERE id='d261d665-8aa9-4f36-a953-b1a571593fc6';

-- Deactivate duplicate account 17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63';

-- ==== Proposed changes for duplicate account 9f71a26a-f42b-4201-93b1-e09dd39a76bb (JM Collection)

-- Archive account 9f71a26a-f42b-4201-93b1-e09dd39a76bb
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='9f71a26a-f42b-4201-93b1-e09dd39a76bb';

-- Archive payouts for account 9f71a26a-f42b-4201-93b1-e09dd39a76bb
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='9f71a26a-f42b-4201-93b1-e09dd39a76bb';

-- No credential on 9f71a26a-f42b-4201-93b1-e09dd39a76bb

-- Deactivate duplicate account 9f71a26a-f42b-4201-93b1-e09dd39a76bb
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='9f71a26a-f42b-4201-93b1-e09dd39a76bb';

-- Move credential d261d665-8aa9-4f36-a953-b1a571593fc6 from 17f6a584-4c8a-43e0-be1f-bbbfb5ff0d63 to canonical 9257651a-3d68-4e88-b330-6cc53afb4cfc
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:9257651a-3d68-4e88-b330-6cc53afb4cfc' WHERE id='d261d665-8aa9-4f36-a953-b1a571593fc6';

-- ==== Proposed changes for duplicate account ff8e0bd3-8b24-40d6-af27-64d55a87c041 (Betech Store)

-- Archive account ff8e0bd3-8b24-40d6-af27-64d55a87c041
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- Archive payouts for account ff8e0bd3-8b24-40d6-af27-64d55a87c041
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- Reassign credential 3e36e0c1-700f-4c69-92c3-51942833cc81 to canonical account 9257651a-3d68-4e88-b330-6cc53afb4cfc
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:9257651a-3d68-4e88-b330-6cc53afb4cfc' WHERE id='3e36e0c1-700f-4c69-92c3-51942833cc81';

-- Deactivate duplicate account ff8e0bd3-8b24-40d6-af27-64d55a87c041
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='ff8e0bd3-8b24-40d6-af27-64d55a87c041';

-- ==== Proposed changes for duplicate account fad5155d-4223-4b58-bec6-87f7a5690c37 (Betech Solar Solution)

-- Archive account fad5155d-4223-4b58-bec6-87f7a5690c37
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- Archive payouts for account fad5155d-4223-4b58-bec6-87f7a5690c37
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- Reassign credential 57b10d78-3ef9-4655-bea8-111b13e1d1e9 to canonical account 9257651a-3d68-4e88-b330-6cc53afb4cfc
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:9257651a-3d68-4e88-b330-6cc53afb4cfc' WHERE id='57b10d78-3ef9-4655-bea8-111b13e1d1e9';

-- Deactivate duplicate account fad5155d-4223-4b58-bec6-87f7a5690c37
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='fad5155d-4223-4b58-bec6-87f7a5690c37';

-- ==== Proposed changes for duplicate account f97458d2-b432-4793-8283-8cc54fe1d42a (Betech Kilimall)

-- Archive account f97458d2-b432-4793-8283-8cc54fe1d42a
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- Archive payouts for account f97458d2-b432-4793-8283-8cc54fe1d42a
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- No credential on f97458d2-b432-4793-8283-8cc54fe1d42a

-- Deactivate duplicate account f97458d2-b432-4793-8283-8cc54fe1d42a
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='f97458d2-b432-4793-8283-8cc54fe1d42a';

-- ==== Proposed changes for duplicate account b6a9ed06-2b75-4bdc-a004-4f83af524ad0 (Betech Solar Kilimall)

-- Archive account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- Archive payouts for account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- No credential on b6a9ed06-2b75-4bdc-a004-4f83af524ad0

-- Deactivate duplicate account b6a9ed06-2b75-4bdc-a004-4f83af524ad0
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='b6a9ed06-2b75-4bdc-a004-4f83af524ad0';

-- ==== Proposed changes for duplicate account 6e1186af-a6b3-4eb6-9547-1038733c3306 (Betech Solar Solution)

-- Archive account 6e1186af-a6b3-4eb6-9547-1038733c3306
INSERT INTO "MarketplaceAccount_archive" SELECT * FROM "MarketplaceAccount" WHERE id='6e1186af-a6b3-4eb6-9547-1038733c3306';

-- Archive payouts for account 6e1186af-a6b3-4eb6-9547-1038733c3306
INSERT INTO "MarketplacePayoutWeek_archive" SELECT * FROM "MarketplacePayoutWeek" WHERE accountId='6e1186af-a6b3-4eb6-9547-1038733c3306';

-- No credential on 6e1186af-a6b3-4eb6-9547-1038733c3306

-- Deactivate duplicate account 6e1186af-a6b3-4eb6-9547-1038733c3306
UPDATE "MarketplaceAccount" SET isActive=false WHERE id='6e1186af-a6b3-4eb6-9547-1038733c3306';

-- Move credential 3e36e0c1-700f-4c69-92c3-51942833cc81 from ff8e0bd3-8b24-40d6-af27-64d55a87c041 to canonical 9257651a-3d68-4e88-b330-6cc53afb4cfc
UPDATE "ApiCredential" SET scope='MARKETPLACE_ACCOUNT:9257651a-3d68-4e88-b330-6cc53afb4cfc' WHERE id='3e36e0c1-700f-4c69-92c3-51942833cc81';