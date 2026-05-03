# Admin Receipts

## Profit receipt drilldown

On Admin → Receipts, the Total profit card can be clicked to show the contributing receipts that make up the displayed profit. The drilldown fetches `/api/receipts?summaryView=profit` and uses the same admin summary logic to return the exact receipts recognized by the summary (not an independent POS-only filter). This ensures the list matches the card total exactly and prevents mismatches between the summary and the drilldown.

The view includes priced POS receipts and support receipts whose profit was recognized by the summary. Variable-cost receipts remain excluded until their buying price is provided; once priced they will appear in the contributing list.
