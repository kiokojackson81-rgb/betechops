# Shop Field Migration Rollout

This note documents the current migration state before enabling real ops catalogue fields for `/shop`.

## Current audit date

- `2026-05-21`

## Prisma migrate status

Command run:

```bash
npx prisma migrate status
```

Observed state:

- Datasource: PostgreSQL `neondb`, schema `public`
- Local migrations present: `97`
- The configured database is behind Prisma migration history
- The shop field migration `20260521094500_add_product_shop_fields` is not yet applied
- Many earlier migrations are also unapplied, so the environment is not ready for a blind `prisma migrate deploy`

Unapplied migrations reported by Prisma:

```text
20251024_multi_marketplace_upgrade
20251026_add_fulfillment_audit
20251026_add_shop_assignment
20251027_add_fulfillment_action
20251101_add_catalog_counters
20251101_jumia_orders_multi_account
20251102_add_attendant_categories
20251109_multi_attendant_categories
20251112_add_platform_enum
20251114_order_totals
20251115_add_jumiaorder_shopname
20251126142210_add_daily_report
20251126154039_extend_daily_report
20251127080353_add_daily_sale
20251128_add_submittedBy
20251128152900_marketing_daily_entry
20251128185336_marketing_sales_records
20251130045844_add_weekly_thursday_fields
20251130120000_add_daily_sale_paymentfields
20251201000100_add_dailyreport_metrics
20251202_add_items_count_to_marketing_sale
20251202_fix_attendant_enum_legacy_values
20251203_marketing_receipts
20251204_add_dailyreport_submitted_by
20251204_add_missing_dailyreport_metrics
20251204_add_support_models
20251205_guard_weekly_attendant_fix
20251205_link_daily_sale_to_marketing_sale
20251205_marketplace_online_ops
20251206_commission_engine
20251207_add_weekly_sale
20251209_weekly_sale_rework
20251210_add_receipt_buying_total
20251212_add_commission_cascade
20251212120000_add_pricedAt_fields
20251216_manual-add-receipts
20251217_add_user_password
20251218_adjustment_kind
20251220_add_branding
20251227_receipt-key-unique-by-date-and-serial
20251228_add_disableAutoSync
20251231_add_receipt_number
20260102_marketplace_fees_profit_events
20260105_add_unique_statement_week
20260106_add_shop_jumiaShopSid
20260222190000_marketplace_profit_entry
20260222194000_marketplace_profit_entry_account
20260222195500_marketplace_profit_entry_is_loss
20260224103000_user_commission_config
20260303193000_marketplace_statement_draft
20260305_marketplace_email_intelligence
20260306000100_marketplace_digest_snapshots
20260308110000_marketplace_email_parse_source
20260424163000_add_wellness_center
20260425120000_pos_management
20260427193000_pos_product_default_warranty
20260429123000_payroll_adjustment_requests
20260503120000_pos_variable_cost_products
20260503123000_backfill_product_variable_cost
20260506_add_general_ops_category
20260506103000_recurring_payroll_items
20260507090000_recurring_weekly_multi_occurrence
20260521094500_add_product_shop_fields
manual-add-receipts
```

## Live Product table shape

Read-only query against `information_schema.columns` returned only:

- `id` `text` `NOT NULL`
- `key` `text` `NOT NULL`
- `name` `text` `NOT NULL`
- `unit` `text` `NOT NULL`
- `sellPrice` `integer` `NOT NULL`
- `active` `boolean` `NOT NULL DEFAULT true`

This means the configured database still uses the legacy `Product` table shape.

## Prisma Product model shape

Current Prisma `Product` model expects:

- `id`
- `sku`
- `name`
- `category`
- `sellingPrice`
- `lastBuyingPrice`
- `defaultWarranty`
- `showInShop`
- `shopCategory`
- `shopShortDescription`
- `shopWarranty`
- `shopSpecs`
- `shopImageUrl`
- `shopBrand`
- `variableCost`
- `commissionEnabled`
- `commissionAmount`
- `commissionRequiresApproval`
- `minStockLevel`
- `stockQuantity`
- `isActive`
- `createdAt`
- `updatedAt`

## Product schema mismatch summary

Live DB only:

- `key`
- `unit`
- `sellPrice`
- `active`

Prisma model only:

- `sku`
- `category`
- `sellingPrice`
- `lastBuyingPrice`
- `defaultWarranty`
- `showInShop`
- `shopCategory`
- `shopShortDescription`
- `shopWarranty`
- `shopSpecs`
- `shopImageUrl`
- `shopBrand`
- `variableCost`
- `commissionEnabled`
- `commissionAmount`
- `commissionRequiresApproval`
- `minStockLevel`
- `stockQuantity`
- `isActive`
- `createdAt`
- `updatedAt`

Shared between both:

- `id`
- `name`

## Risk of running full migrate deploy now

- It would attempt to apply many unrelated migrations before the shop field migration.
- The configured database is clearly behind Prisma history, not cleanly aligned with the current model.
- A blind production `prisma migrate deploy` here would be high risk for POS and broader ops data flows.

## Safe migration options

### Option A: Full migration reconciliation

- Review every pending migration in order.
- Reconstruct or clone the legacy environment in staging first.
- Apply the full backlog in staging and verify admin, POS, receipts, reporting, and shop compatibility.
- Only after staging signoff, apply in production.

Pros:

- Restores Prisma migration history integrity.
- Best long-term maintainability.

Cons:

- Slowest option.
- Highest immediate coordination effort.

### Option B: Baseline or resolve migration history

- Compare the live database to the intended Prisma history.
- Mark migrations as applied only where the live schema truly already matches them.
- Reduce the migration backlog safely.
- Then apply the remaining necessary migrations, including shop fields.

Pros:

- Can reduce unnecessary replay of historical migrations.
- Cleaner than ad hoc patching if done carefully.

Cons:

- Easy to get wrong if the schema comparison is incomplete.
- Still requires disciplined staging validation.

### Option C: Manual additive SQL patch for shop fields

- Apply only the seven ecommerce columns directly to `Product`.
- Leave the broader Prisma migration backlog untouched for now.
- Continue using compatibility-safe read and write code.
- Reconcile Prisma migration history properly later.

Pros:

- Smallest blast radius for urgent ecommerce catalogue readiness.
- Adds only nullable or default-safe columns.
- Does not mutate orders, receipts, stock, or payments.

Cons:

- Prisma history remains out of sync until reconciled later.
- Must be carefully documented and verified after execution.

## Recommended path

- Do not run `prisma migrate deploy` blindly against the current configured database.
- Prefer staging validation first for any broader migration reconciliation.
- If ecommerce field activation is urgent, use the manual additive SQL patch only after backup, because it only adds nullable or default-safe columns to the legacy `Product` table.

## Manual patch path

Patch file:

- `prisma/manual-patches/add_product_shop_fields_only.sql`

Patch contents are intentionally limited to:

- `showInShop BOOLEAN NOT NULL DEFAULT false`
- `shopCategory TEXT`
- `shopShortDescription TEXT`
- `shopWarranty TEXT`
- `shopSpecs TEXT`
- `shopImageUrl TEXT`
- `shopBrand TEXT`

No destructive SQL is included.

## Safety and rollback notes

- Take a fresh database backup before running the manual patch.
- Confirm the exact `DATABASE_URL` target before opening any SQL session.
- Confirm the current `Product` columns still match the expected pre-patch legacy shape.
- Confirm the rollback owner and rollback procedure before execution.
- Confirm the patch is additive only and contains no destructive SQL.
- Run the patch in staging or a production-like clone first if available.
- Verify the seven columns exist immediately after the patch.
- Keep `showInShop=false` for all existing products initially.
- Enable products one by one from `Admin -> POS Management -> Catalogue`.
- Keep the solar keyword guard active even after the patch.
- Keep `NEXT_PUBLIC_SHOP_USE_OPS_API=false` until catalogue preview review is complete.
- If anything behaves unexpectedly, keep mock mode active and roll back the deployment before changing customer-facing catalogue mode.

## Pre-patch checklist

- Take a database backup or Neon snapshot.
- Confirm the `DATABASE_URL` target matches the intended environment.
- Confirm the current `Product` table columns before patching.
- Confirm the rollback plan and operator responsible for execution.
- Confirm `prisma/manual-patches/add_product_shop_fields_only.sql` is additive only.

## Post-patch verification checklist

- Confirm the `Product` table now has:
  - `showInShop`
  - `shopCategory`
  - `shopShortDescription`
  - `shopWarranty`
  - `shopSpecs`
  - `shopImageUrl`
  - `shopBrand`
- Confirm `/api/admin/pos-products` reports the shop field capabilities as active.
- Confirm `/admin/pos-management` still loads.
- Confirm a normal POS product can still be created or edited without using the ecommerce fields.
- Confirm a solar product can be edited with ecommerce fields saved.
- Confirm `showInShop=false` products do not appear in `/shop/catalogue-preview`.
- Confirm non-solar products remain rejected even if a user tries to flag them for the shop.

## Patch command options

Run manually only after the pre-patch checklist is complete:

```bash
psql "$DATABASE_URL" -f prisma/manual-patches/add_product_shop_fields_only.sql
```

PowerShell example:

```powershell
psql $env:DATABASE_URL -f prisma/manual-patches/add_product_shop_fields_only.sql
```

Read-only verification command:

```bash
node -r ts-node/register scripts/verify-product-shop-fields.ts
```

## Admin verification checklist

- Open `/admin/pos-management`.
- Create or edit a normal POS product.
- Confirm the ecommerce fields are editable.
- Save a product with `showInShop=false`.
- Save one solar test product with `showInShop=true`.
- Open `/shop/catalogue-preview`.
- Confirm the solar test product is accepted.
- Confirm non-solar products remain rejected by the solar guard.

## Shop mode activation checklist

- Keep `NEXT_PUBLIC_SHOP_USE_OPS_API=false` until `/shop/catalogue-preview` is clean.
- After catalogue review, set `NEXT_PUBLIC_SHOP_USE_OPS_API=true`.
- Redeploy the app.
- Test `/shop`.
- Test category pages.
- Test product pages.
- Keep checkout and quote submission in mock mode until the order integration phase.
