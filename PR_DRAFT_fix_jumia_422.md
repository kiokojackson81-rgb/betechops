Title: feat(admin): Add restore confirmation modal + token flow; safeguards for WIPE restores

Summary

This PR implements a safer restore workflow for `WIPE_RECEIPTS` action logs:

- Adds a short-lived confirmation token flow for forced restores (`REQUEST_RESTORE_CONFIRM` actionLog)
- Adds `POST /api/admin/action-logs/restore/request-confirmation` to request a token (rate-limited)
- Adds `GET /api/admin/action-logs/restores?wipeId=...` to list restore logs referencing a given wipe
- Validates confirmation tokens server-side during forced restore; tokens are consumable
- Updates restore route to include `originalWipeId` on `RESTORE_RECEIPTS` action logs
- Adds a small modal UI for token display + copy and confirmation
- Replaces window.confirm flows in action-logs restore UI and undo-last-wipe UI with the modal

Files changed (high level)

- src/app/api/admin/action-logs/restore/route.ts (updated)
- src/app/api/admin/action-logs/restore/request-confirmation/route.ts (new)
- src/app/api/admin/action-logs/restores/route.ts (new)
- src/app/admin/action-logs/RestoreConfirmModal.tsx (new)
- src/app/admin/action-logs/RestoreButtonClient.tsx (updated)
- src/app/admin/action-logs/UndoLastWipeClient.tsx (updated)

Why

WIPE operations are destructive. This feature adds a human-controlled, auditable confirmation mechanism and a modal UX so forced restores require an explicit short-lived token generated and consumed by the same operator.

Testing / QA steps

1. Local build
   - `npm run build` (should compile successfully)
2. Dev server
   - `npm run dev`
3. Admin → Action Logs
   - Trigger a wipe scenario or find an existing `WIPE_RECEIPTS` action log.
   - Click Restore on a wipe that needs force.
     - Modal appears asking to confirm (plain confirm flow)
     - Confirm attempts restore; if non-forced restore fails (entry has receipts), modal will request a token and update to show token + expiry
     - Copy token and confirm to perform forced restore
   - Check DB: new `RESTORE_RECEIPTS` actionLog should have `after.originalWipeId` referencing the wipe
   - GET `/api/admin/action-logs/restores?wipeId=<WIPE_ID>` should list the restore
4. Request-confirmation rate limits
   - Call request-confirmation >3 times in 10 minutes as the same actor to confirm 429 response

Migration / Deployment notes

- No Prisma schema changes were required for this feature (uses existing `ActionLog` JSON fields). If you change the schema later, run `npx prisma migrate dev` / `npx prisma migrate deploy` as appropriate.
- To apply DB migrations (if any):
  - Backup DB first
  - `npx prisma migrate deploy` with `DATABASE_URL` set to the target DB

PR checklist (suggested)

- [ ] Add reviewer(s): @team
- [ ] QA on staging: request-confirmation flow, forced restore, list restores
- [ ] Confirm audit logs written and `originalWipeId` set
- [ ] Merge when satisfied

Notes / Follow-ups

- Consider improving copy feedback in modal (`alert()` currently used)
- Optionally send token via email/SMS for out-of-band confirmation if needed


