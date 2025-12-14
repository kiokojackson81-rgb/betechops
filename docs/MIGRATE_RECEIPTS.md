# Migrating database for unified receipts

After updating `prisma/schema.prisma` to add Receipt, CommissionRecord, LayawayPlan, and fields on `OrderItem`, run the following locally:

1. Generate Prisma client:

```bash
npm run prisma:generate
```

2. Create and apply a migration (development):

```bash
npx prisma migrate dev --name unified-receipts
```

3. For production, use your deploy-time migration process (e.g. `prisma migrate deploy`) and ensure a backup is taken before running migrations.

4. After migration, verify new tables exist and run any backfill scripts to populate `orderItem.serial`/`warranty` from legacy sources if necessary.

5. If you use a CI pipeline, update secrets/config to include any new env vars used by the receipts/send worker.

Additional steps:

- Backfill serial/warranty from legacy tables using the provided script:

```pwsh
npm run prisma:generate
node -r ts-node/register scripts/backfill-serial-warranty.ts
```

- Provider env vars required for sending receipts (optional - only needed for send worker):
	- `SENDGRID_API_KEY` - SendGrid API key
	- `SENDGRID_FROM` - verified sender email
	- `TWILIO_ACCOUNT_SID` - Twilio SID
	- `TWILIO_AUTH_TOKEN` - Twilio auth token
	- `TWILIO_FROM_WHATSAPP` - Twilio WhatsApp sender (e.g. `+123456789` without whatsapp: prefix)
	- `TWILIO_FROM_SMS` - Twilio SMS sender phone (optional)

Ensure these are added to your production secrets before enabling automated sends.
