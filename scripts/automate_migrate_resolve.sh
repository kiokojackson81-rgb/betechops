#!/bin/bash
# Usage: ./automate_migrate_resolve.sh
#
# This script automates marking modified migrations as applied using
# `prisma migrate resolve`. It loops through a list of migration names and
# resolves each one. Update the MIGRATIONS array as needed.
#
# Ensure that the Prisma CLI is installed and your environment variables
# (DATABASE_URL and, if needed, SHADOW_DATABASE_URL) are correctly set
# before running this script. If your schema is not at `prisma/schema.prisma`,
# adjust the --schema argument accordingly.

set -e

MIGRATIONS=(
  "20251130045844_add_weekly_thursday_fields"
  "20251202_fix_attendant_enum_legacy_values"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "Resolving migration $migration ..."
  # Mark the migration as applied in the `_prisma_migrations` table
  npx prisma migrate resolve --schema=prisma/schema.prisma --applied "$migration"
  echo "Migration $migration marked as applied."
done

echo "All specified migrations have been resolved."
