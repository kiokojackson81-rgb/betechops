Placeholder migration created on 2025-12-27.

This migration is a no-op because the required columns and indexes were applied
safely via `scripts/receipts/apply-receiptkeys-safe.js`. Keeping this placeholder
prevents Prisma from attempting a destructive reset while keeping migration
history aligned for future deploys.
