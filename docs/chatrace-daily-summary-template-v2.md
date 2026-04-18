# Daily Summary Template

Final Chatrace / WhatsApp configuration for the 8PM admin summary.

## Recommended Tag

`betech_ops_daily_summary_template`

## Contact Fields Expected By The App

- `daily_summary_date`
- `daily_summary_total_sales`
- `daily_summary_total_profit`
- `daily_summary_total_mpesa`
- `daily_summary_total_cash`
- `daily_summary_total_receipts`
- `daily_summary_total_items`
- `daily_summary_awaiting_pricing`
- `daily_summary_mpesa_receipts`
- `daily_summary_cash_receipts`
- `daily_summary_pos_receipts`
- `daily_summary_pos_sales`

The sender also still writes the legacy fields below for backward compatibility:

- `summary_date`
- `summary_total_sales`
- `summary_total_profit`
- `summary_total_mpesa`
- `summary_total_cash`
- `summary_total_receipts`

## WhatsApp Template Name

`betech_ops_daily_summary_template`

## Suggested WhatsApp Template Body

```text
Hello Admin, here is the Betech Ops daily summary for {{1}}.

Sales: KES {{2}}
Profit: KES {{3}}
MPESA: KES {{4}} ({{5}} receipts)
Cash: KES {{6}} ({{7}} receipts)
POS receipts: {{8}}
POS amount: KES {{9}}
Total receipts: {{10}}
Products sold: {{11}}
Awaiting pricing: {{12}}

This is an automated internal summary from Betech Ops.
```

## Placeholder Mapping In Chatrace

- `{{1}}` -> `daily_summary_date`
- `{{2}}` -> `daily_summary_total_sales`
- `{{3}}` -> `daily_summary_total_profit`
- `{{4}}` -> `daily_summary_total_mpesa`
- `{{5}}` -> `daily_summary_mpesa_receipts`
- `{{6}}` -> `daily_summary_total_cash`
- `{{7}}` -> `daily_summary_cash_receipts`
- `{{8}}` -> `daily_summary_pos_receipts`
- `{{9}}` -> `daily_summary_pos_sales`
- `{{10}}` -> `daily_summary_total_receipts`
- `{{11}}` -> `daily_summary_total_items`
- `{{12}}` -> `daily_summary_awaiting_pricing`

## Flow Setup

1. Trigger the flow when tag `betech_ops_daily_summary_template` is added.
2. Start flow `betech_ops_daily_summary_template`.
3. Flow sends the WhatsApp template message only.

The backend is locked to the exact tag `betech_ops_daily_summary_template`.
