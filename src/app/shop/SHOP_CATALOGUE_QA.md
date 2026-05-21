# Shop Catalogue QA

Use this checklist before enabling customer-facing ops catalogue mode for `/shop`.

## Required ecommerce fields

- `id`: Stable ops product identifier.
- `name`: Customer-readable product name.
- `category`: Must normalize cleanly into a supported shop category.
- `price`: Valid numeric selling price in KES.
- `source`: Should resolve to `ops` when live catalogue preview mode is enabled.

## Recommended image rules

- Product images should support clean `object-contain` presentation.
- Recommended minimum size: `1200x1200`.
- Use bright, well-cropped product photos on neutral backgrounds where possible.
- If no real image is available yet, the shop will fall back to a category placeholder visual.

## Category naming rules

Normalize ops catalogue products into one of these shop categories:

- `Solar Panels`
- `Solar Inverters`
- `Solar Batteries`
- `Lithium Batteries`
- `Solar Full Kits`
- `All-in-One Systems`
- `Solar Water Heaters`
- `Solar Water Pumps`
- `Solar Lights`
- `Accessories`
- `Uncategorized`

If the raw ops category is ambiguous or blank, fix it in ops before live launch where possible.

## Price rules

- Use a valid selling price in KES.
- Do not leave ecommerce-display products with blank or invalid pricing.
- Products with invalid price should not appear in the customer-facing `/shop` catalogue.

## Warranty and specs rules

- Warranty should be customer-readable, for example `12-month warranty` or `5-year inverter warranty`.
- Specs should summarize what matters to a customer:
- wattage, AH, KW/KVA rating, voltage, use case, or key compatibility notes.
- If full technical details are not ready, at minimum keep a short customer-safe summary.

## Stock status rules

- Active products may map to `in_stock`, `limited_stock`, or `quote_only`.
- Inactive or unclear stock items should not imply guaranteed availability.
- If stock precision is not available yet, prefer conservative display behavior over overselling.

## What must be fixed in ops catalogue before live launch

- Missing or invalid selling prices.
- Blank or misleading categories.
- Missing brand information where the product name is too generic.
- Missing warranty guidance for customer-facing products.
- Missing product descriptions/specs that leave the page too thin.
- Missing image fields once real ecommerce media support is introduced.

## Required ops cleanup before live ecommerce mode

- Remove or hide non-solar items from the shop feed so butchery or food items never reach `/shop`.
- Add an explicit ecommerce visibility flag later, for example `showInShop=true`.
- Normalize catalogue categories into the approved Betech Solar shop categories.
- Add product images suitable for ecommerce product cards and detail pages.
- Add warranty and technical specs that are customer-readable.
- Confirm all ecommerce-display prices before launch.
- Confirm stock status logic so the storefront does not imply guaranteed availability incorrectly.

## Admin checklist in POS Catalogue

- Open `Admin -> POS Management -> Catalogue`.
- Edit the product inside the existing POS Catalogue workflow.
- Mark the product `Show in Online Shop` when the field becomes available.
- Select the correct `shopCategory`.
- Add or confirm price.
- Add image URL when schema support is available.
- Add warranty guidance.
- Add specs or short description.
- Confirm active status.
- Confirm the product appears correctly in `/shop/catalogue-preview`.

## Live catalogue test mode

Set:

```env
NEXT_PUBLIC_SHOP_USE_OPS_API=true
```

Then verify:

- `/api/shop/products`
- `/api/shop/products?category=solar-panels`
- `/api/shop/products?q=battery`
- `/shop`
- `/shop/category/solar-panels`
- `/shop/product/[slug]`
- `/shop/catalogue-preview`

## Read-only safety

- Do not create live orders from `/shop`.
- Do not connect POS or receipts yet.
- Do not deduct stock.
- Do not process payments.
- Keep mock fallback available until catalogue QA is complete.

## Rollback note

If the ecommerce field migration causes issues:

- Keep `NEXT_PUBLIC_SHOP_USE_OPS_API=false`.
- Keep `showInShop=false` for products until the catalogue is reviewed again.
- Roll back the deployment if needed.
- POS core fields and sales flow should remain unaffected because the migration is additive only.
