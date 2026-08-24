# Lipa Pole Pole Repository Audit

## Objective

This document maps the Lipa Pole Pole specification onto the existing BetechOps codebase so implementation can reuse the current receipt, quotation/project, notification, auth, and audit paths instead of creating parallel systems.

## Current State Summary

The repository already contains a minimal layaway implementation:

- Prisma models: `LayawayPlan`, `LayawayPayment` in [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:1954)
- Payment route: [src/app/api/layaway/[orderRef]/pay/route.ts](C:/Projects/betechops/src/app/api/layaway/[orderRef]/pay/route.ts:1)

That implementation is not sufficient for the requested LPP module because it:

- is tied directly to `Order`
- mutates a stored balance instead of deriving it canonically from successful payments
- releases commission on completion
- does not model assignment, reminders, follow-ups, conversion choice, audit timeline, or fulfillment gating
- does not separate advance collections from final POS/project recognition

## Canonical Existing Components To Reuse

### Auth / actor resolution

- Session/auth helpers: [src/lib/auth.ts](C:/Projects/betechops/src/lib/auth.ts:1)
- Role helpers and actor fallback: [src/lib/api.ts](C:/Projects/betechops/src/lib/api.ts:1)

Use these for:

- `LPP_VIEW_*`
- `LPP_RECORD_PAYMENT`
- `LPP_CONVERT_*`
- `LPP_RELEASE_PRODUCT`
- system cron actor resolution via `getActorId()`

### Staff / customer-service ownership

- User model and role/category fields: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:8)
- Existing category enum currently includes `BETECH_OPS` and `TECHNICAL_TEAM`, but there is no `CUSTOMER_SERVICE` role yet: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:2559)

Implication:

- Customer Service assignment should use `User` records.
- The current schema does not yet have a dedicated customer-service role/category. That must be added before dynamic assignment can be implemented correctly.

### Products / pricing / inventory inputs

- Product model: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:1014)
- POS product admin APIs: [src/app/api/admin/pos-products/route.ts](C:/Projects/betechops/src/app/api/admin/pos-products/route.ts:1)
- Product cost/history models: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:1360)

Use these for:

- `lipaPolePoleEnabled`
- min deposit / max days / terms fields
- final selling-price snapshot source
- later reservation visibility against current stock/catalogue

### POS / receipt engine

- Main receipt API: [src/app/api/receipts/route.ts](C:/Projects/betechops/src/app/api/receipts/route.ts:1)
- Receipt model: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:1485)
- Receipt PDF response: [src/lib/receiptPdfResponse.ts](C:/Projects/betechops/src/lib/receiptPdfResponse.ts:1)
- Receipt snapshot/template paths: [src/app/receipts/buildSnapshot.ts](C:/Projects/betechops/src/app/receipts/buildSnapshot.ts:1), [src/app/templates/receiptTemplate.tsx](C:/Projects/betechops/src/app/templates/receiptTemplate.tsx:1)

This is the canonical final-sale engine. LPP must feed fully paid accounts into this flow instead of inventing a second sales pipeline.

### Project / quotation workflow

- Quote request system: [src/lib/quoteRequests.ts](C:/Projects/betechops/src/lib/quoteRequests.ts:1)
- Quote project workflow: [src/lib/quoteProjects.ts](C:/Projects/betechops/src/lib/quoteProjects.ts:1)
- Receipt-side project flow normalization: [src/lib/receiptProjects.ts](C:/Projects/betechops/src/lib/receiptProjects.ts:1)
- Admin quotation project route: [src/app/api/admin/quotation-center/[id]/project/route.ts](C:/Projects/betechops/src/app/api/admin/quotation-center/[id]/project/route.ts:1)

This is the canonical project conversion path. LPP project completion should pre-populate or drive this workflow, not bypass it.

### Commission / profit logic

- Commission ladder and period logic: [src/lib/commission.ts](C:/Projects/betechops/src/lib/commission.ts:1)
- Existing receipt posting and commission side-effects live in [src/app/api/receipts/route.ts](C:/Projects/betechops/src/app/api/receipts/route.ts:1523)

LPP must not calculate profit or commission independently. Final commission/profit must remain owned by receipt/project posting.

### Notifications

- Project notification service: [src/services/project-notifications/project-notification.service.ts](C:/Projects/betechops/src/services/project-notifications/project-notification.service.ts:1)
- WhatsApp wrapper usage pattern: [src/lib/adminSummaryJob.ts](C:/Projects/betechops/src/lib/adminSummaryJob.ts:8), [src/lib/reviewsReferrals.ts](C:/Projects/betechops/src/lib/reviewsReferrals.ts:11)
- Email wrapper usage pattern: [src/lib/email.ts](C:/Projects/betechops/src/lib/email.ts:1)

The LPP reminder engine should follow this service-layer pattern:

- domain logic computes live balance
- notification abstraction selects channel
- provider adapter sends WhatsApp/SMS/Email
- sent state is recorded with an idempotency key

### Scheduled jobs / cron

- Existing cron route pattern: [src/app/api/cron/quotations/follow-ups/route.ts](C:/Projects/betechops/src/app/api/cron/quotations/follow-ups/route.ts:1)
- Vercel cron config location: [vercel.json](C:/Projects/betechops/vercel.json:1)

LPP reminders should follow the same route-driven cron pattern.

### Audit logging

- Generic audit model: [prisma/schema.prisma](C:/Projects/betechops/prisma/schema.prisma:1311)
- Existing route mutation audit pattern: [src/app/api/receipts/[id]/route.ts](C:/Projects/betechops/src/app/api/receipts/[id]/route.ts:660)

LPP should also have a dedicated immutable event timeline for domain events, but major financial/admin changes should continue writing `ActionLog` as well.

### Admin navigation

- Admin nav definition: [src/app/admin/_components/adminNav.ts](C:/Projects/betechops/src/app/admin/_components/adminNav.ts:1)

This is where `/admin/lipa-pole-pole` should be added once the first UI route exists.

## Recommended Implementation Shape

### 1. Keep LPP separate from `Order`, `Receipt`, and `QuoteRequest`

Reason:

- the spec requires incomplete LPP records to remain outside normal sales/profit/commission tables
- `Order` and `Receipt` are already used as final-sale/accounting records

Recommendation:

- add dedicated `LipaPolePole*` models in Prisma
- link back to `User`, `Product`, `Receipt`, and project workflow records by foreign key/reference only

### 2. Do not extend the current `LayawayPlan` models in place

Reason:

- the current route logic violates the new business rules
- retrofitting it in place would risk accidental reuse of the wrong semantics

Recommendation:

- preserve the current layaway feature for compatibility unless explicitly removed
- implement the new module under explicit `LipaPolePole*` names
- once stable, decide whether the old layaway route should be migrated or retired

### 3. Reuse receipt/project posting at conversion time only

POS conversion target:

- `src/app/api/receipts/route.ts`

Project conversion target:

- `src/lib/quoteProjects.ts`
- `src/app/api/admin/quotation-center/[id]/project/route.ts`

### 4. Prefer Prisma models for LPP, but note mixed repository patterns

Important repository nuance:

- core entities such as `Receipt`, `Order`, `Product`, `User` are in Prisma
- quote/project workflow tables are currently created lazily via raw SQL helpers in `quoteRequests.ts` and `quoteProjects.ts`

Recommendation:

- put the new LPP tables in `prisma/schema.prisma` and migrate normally
- only use raw-SQL schema bootstrapping if deployment constraints require consistency with the quote modules

## Required New Data Model

Recommended new models:

- `LipaPolePole`
- `LipaPolePolePayment`
- `LipaPolePoleInstallment`
- `LipaPolePoleAssignment`
- `LipaPolePoleReminder`
- `LipaPolePoleFollowUp`
- `LipaPolePolePromise`
- `LipaPolePoleEvent`
- `LipaPolePoleAdjustment`
- `LipaPolePoleRefund`
- `LipaPolePolePublicLink`

Keep:

- `User`, `Product`, `Receipt` as shared canonical records

## Required New Permissions / Roles

Current gap:

- no dedicated customer service role/category exists in Prisma auth models

Needed:

- either add a `CUSTOMER_SERVICE` value to the role/category model, or create a permission mapping table
- define server checks for `LPP_*` permissions on top of the current auth helpers

## High-Risk Integration Points

### Receipt creation side-effects

Risk:

- posting through the receipt engine likely triggers profit, commission, reporting, and possibly project synchronization

Action:

- route all POS conversion through that engine exactly once
- add LPP idempotency guards before calling it

### Project recognition

Risk:

- receipt/project reporting currently recognizes project revenue based on `projectFlow`

Action:

- LPP project conversion must reuse that posted/completed state instead of creating a disconnected project-finance path

### Old layaway route

Risk:

- current `/api/layaway/[orderRef]/pay` behavior conflicts with the spec

Action:

- do not reuse it as-is for LPP payments

## Proposed Delivery Sequence

1. Add LPP domain constants/helpers/tests.
2. Add Prisma enums/models and migration.
3. Add service layer for creation, assignment, payments, balance calculation, events, and status derivation.
4. Add admin APIs for list/detail/payments/follow-ups/promise/reassign/cancel/release.
5. Add reminder cron and notification adapter.
6. Add POS conversion through existing receipt flow.
7. Add project conversion through existing quotation/project flow.
8. Add admin UI and navigation.
9. Add customer status link flow.
10. Add end-to-end lifecycle tests.

## Immediate Follow-Up Work

The next code increments should implement:

- Prisma `LipaPolePole*` models
- customer-service role/category support
- authoritative LPP service functions:
  - `createLipaPolePole`
  - `recordLppPayment`
  - `reverseLppPayment`
  - `completeLipaPolePole`
  - `convertLppToPos`
  - `convertLppToProject`
  - `releaseLppProduct`
