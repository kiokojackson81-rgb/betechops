# Admin Receipts

## POS profit receipt drilldown

On Admin -> Receipts, the Total profit card can be clicked to show the POS receipts that contribute to the displayed POS profit. The drilldown fetches `/api/receipts` with `summaryView=profit` and `onlyPos=1`, clears text/document/POD filters that can hide contributing rows, and shows a "Contributing POS receipts" list.

Only priced POS receipts appear in this view. Variable-cost project receipts remain excluded while their buying price is pending, then appear after admin pricing updates the receipt profit.
