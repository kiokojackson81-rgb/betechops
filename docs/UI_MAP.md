# UI Pages & Component Map

Lists the main app pages and responsibilities. Use this as a guide for the UI changes needed to implement multi-shop flows.

## Top-level pages
- `/` — Landing / Dashboard summary (sales today, pending pricing, shops quick filters).
- `/admin` — Admin hub, with sub-pages below.
- `/attendant` — Attendant interface (assigned shops, orders, returns pickup flows).

## Admin area (`src/app/admin/*`)
- `/admin/shops` — Manage shops (create/edit platform credentials, test connection, assign users to shop with `roleAtShop`).
- `/admin/attendants` — User management for attendants & supervisors.
- `/admin/pending-pricing` — Pending pricing queue (shop filter, assign for pricing).
- `/admin/returns` — Return management: view waiting pickups, overdue, approve/resolve.
- `/admin/reports` — Reconciliation reports and exports.
- `/admin/settings` — Global config (commission defaults, SLA days, penalty rules).

## Attendant area
- `/attendant` — List assigned shops' orders, returns requiring pickup.
- Public login areas for attendants and admins exist under `(public)/login`.

## Components & UX
- Shop selector: global header component to filter current shop across pages.
- Order side-panel: shows items, fees, autofill buy price (from `ProductCost` learned/manual), attach evidence.
- Returns SLA indicator: shows countdown or OVERDUE badge; actions to pick and attach photos.
- Commission & Reconciliation pages: export to CSV, show discrepancy details and link to underlying orders/settlements.

## Acceptance criteria in UI
- Shop filter is present on dashboards and lists; when user has assignments to multiple shops, they only see shops they are assigned to; Admins see all.
- Attendant cannot see process order actions; Supervisor sees processing buttons and cost edits.
- Shop credential UI masks secrets and exposes a `Test connection` action that calls backend (server uses `decryptJson` and does a test call).
