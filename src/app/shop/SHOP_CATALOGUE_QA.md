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

- `Solar Full Kits`
- `Solar Panels`
- `Solar Batteries`
- `Solar Inverters`
- `Solar Water Pumps`
- `Solar Lights`
- `Solar Cameras & Security`
- `DC Appliances`
- `Solar Water Heaters`
- `Solar Charge Controllers`
- `Solar Accessories`
- `Portable Power Stations`
- `Commercial & Industrial Solar`
- `Uncategorized`

If the raw ops category is ambiguous or blank, fix it in ops before live launch where possible.

### Final main category list

- `solar-full-kits`
- `solar-panels`
- `solar-batteries`
- `solar-inverters`
- `solar-water-pumps`
- `solar-lights`
- `solar-cameras-security`
- `dc-appliances`
- `solar-water-heaters`
- `solar-charge-controllers`
- `solar-accessories`
- `portable-power-stations`
- `commercial-industrial-solar`

### Subcategory structure

- `Solar Full Kits`: Lithium Solar Kits, Gel Solar Kits, Home Backup Kits, Biashara Solar Kits, CCTV Solar Kits, Water Pump Solar Kits, Complete Home Systems, All-In-One Solar Systems, Starter Solar Kits, Heavy Duty Solar Systems
- `Solar Panels`: Monocrystalline Panels, Polycrystalline Panels, Bifacial Solar Panels, Monofacial Solar Panels, Flexible Solar Panels, Portable Solar Panels, Half-Cut Panels, Tier 1 Solar Panels
- `Solar Batteries`: Lithium Batteries, Gel Batteries, AGM Batteries, Tubular Batteries, Lead Acid Batteries, Deep Cycle Batteries, Rack Mount Batteries, Wall Mount Batteries
- `Solar Inverters`: Hybrid Inverters, Non-Hybrid Inverters, Pure Sine Wave Inverters, Charger Inverters, On-Grid Inverters, Off-Grid Inverters, Low Frequency Inverters, High Frequency Inverters, Pumping Inverters, Three Phase Inverters
- `Solar Water Pumps`: DC Solar Water Pumps, AC Solar Water Pumps, Submersible Pumps, Surface Pumps, Borehole Pumps, Shallow Well Pumps, Deep Well Pumps, Booster Pumps, Irrigation Pumps, Livestock Water Pumps, Hybrid Water Pumps, Solar Pump Kits, Pump Controllers, Pumping Inverters, Petrol Water Pumps
- `Solar Lights`: Solar Street Lights, Solar Flood Lights, Solar Wall Lights, Solar Garden Lights, Solar Motion Sensor Lights, Solar Ceiling Lights, Solar Indoor Lights, Solar Security Lights, Solar Camping Lights
- `Solar Cameras & Security`: Solar CCTV Cameras, 4G Solar Cameras, WiFi Solar Cameras, PTZ Solar Cameras, Solar Security Kits, NVR Kits, CCTV Accessories
- `DC Appliances`: DC TVs, DC Woofers, DC Fridges, DC Fans, DC Freezers, DC Bulbs, DC Air Coolers
- `Solar Water Heaters`: Pressurized Water Heaters, Non-Pressurized Water Heaters, Flat Plate Water Heaters, Vacuum Tube Water Heaters, Integrated Systems, Split Systems, Commercial Water Heaters
- `Solar Charge Controllers`: PWM Controllers, MPPT Controllers, Bluetooth Controllers, LCD Controllers, High Voltage MPPTs
- `Solar Accessories`: MC4 Connectors, Solar Cables, Battery Cables, Changeover Switches, Breakers, AVS Protectors, Surge Protectors, Fuse Holders, Distribution Boxes, Mounting Structures, Cable Clips, DC Bulbs, Solar Fans
- `Portable Power Stations`: Lithium Power Stations, Gel Power Stations, Camping Power Stations, Backup Power Stations, Portable Solar Generators
- `Commercial & Industrial Solar`: Commercial Solar Systems, Three Phase Systems, Industrial Batteries, High Voltage Systems, Commercial Inverters

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
- Select the correct `shopSubcategory` when DB support is enabled.
- Add or confirm price.
- Add image URL when schema support is available.
- Add warranty guidance.
- Add specs or short description.
- Confirm active status.
- Confirm the product appears correctly in `/shop/catalogue-preview`.

### Recommended admin data-entry rules

- Keep the product name customer-readable and include the most important power size, for example `585W Solar Panel` or `5KW Hybrid Inverter`.
- Use `shopCategory` for the main store bucket and `shopSubcategory` for the finer ecommerce filter.
- Keep brand in `shopBrand` when the generic POS product name is not enough for a customer-facing card.
- Put a short customer-safe summary in `shopShortDescription`; keep `shopSpecs` concise and searchable.
- Leave `shopImageUrl` blank if no clean product image is available yet so the shop placeholder system can take over safely.
- Use Kenya-friendly searchable terms where possible, such as `200AH`, `5KVA`, `MPPT`, `borehole pump`, or `flood light`.

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
- Keep the solar guard active even when `showInShop=true`.

## Rollback note

If the ecommerce field migration causes issues:

- Keep `NEXT_PUBLIC_SHOP_USE_OPS_API=false`.
- Keep `showInShop=false` for products until the catalogue is reviewed again.
- Roll back the deployment if needed.
- POS core fields and sales flow should remain unaffected because the migration is additive only.

## Migration readiness gate

- Before applying `20260521094500_add_product_shop_fields`, confirm the target environment is already caught up on its earlier Prisma migrations.
- If the live `Product` table still uses the legacy columns `key`, `unit`, `sellPrice`, and `active`, do not run the normal migration flow for the shop fields in that environment yet.
- Reconcile the outstanding migration backlog first, then apply the additive shop-field migration through the project's standard migration process.

## Migration backlog warning

- The configured database currently shows a large unapplied Prisma migration backlog before `20260521094500_add_product_shop_fields`.
- Do not run `prisma migrate deploy` blindly in that environment just to add the shop fields.
- Treat the shop field rollout as a controlled schema change with staging verification first.

## Manual patch path

- If urgent ecommerce field activation is needed before full migration reconciliation, use `prisma/manual-patches/add_product_shop_fields_only.sql`.
- The manual patch only adds:
- `showInShop`
- `shopCategory`
- `shopShortDescription`
- `shopWarranty`
- `shopSpecs`
- `shopImageUrl`
- `shopBrand`
- Take a database backup first.
- Keep `showInShop=false` initially.
- Enable products one by one from the POS Catalogue after review.

## Post-patch verification checklist

- Confirm the seven shop columns exist on `Product`.
- Confirm `/api/admin/pos-products` reports shop field capability support.
- Confirm `/admin/pos-management` still loads without POS regression.
- Confirm a normal POS product can still save without ecommerce fields.
- Confirm a solar product can save with ecommerce fields.
- Confirm `/shop/catalogue-preview` shows enabled products correctly.
- Confirm the solar guard still rejects non-solar products.

## Initial seeded shop-ready products

The first clean solar catalogue set added to the existing POS Catalogue is:

- `585W Solar Panel` -> `shopCategory=solar-panels`
- `620W Solar Panel` -> `shopCategory=solar-panels`
- `3.5KW Hybrid Inverter` -> `shopCategory=solar-inverters`
- `5KW Hybrid Inverter` -> `shopCategory=solar-inverters`
- `200AH Gel Battery` -> `shopCategory=solar-batteries`
- `200AH Lithium Battery` -> `shopCategory=lithium-batteries`
- `3KW Solar Full Kit` -> `shopCategory=solar-full-kits`
- `DC 12V Solar Water Pump` -> `shopCategory=solar-water-pumps`
- `Solar Flood Light` -> `shopCategory=solar-lights`

All of the above were saved with:

- valid positive price
- `showInShop=true`
- brand
- short description
- warranty
- specs
- blank `shopImageUrl` so category placeholders render safely for now
- no `shopSubcategory` yet, because the DB field is still planned for a future additive patch

## Current missing data and known gaps

- Real image URLs are still missing for the initial seeded solar products.
- Because the live `Product` table is still on the legacy POS shape, stock quantity is not available, so seeded ops-mode products currently map conservatively to `quote_only`.
- Warranty and specs are now present for the seeded solar products, so those warnings are no longer blocking catalogue preview acceptance.
- `shopSubcategory String?` is still a planned future field. The storefront taxonomy and admin UI already support it as a compatibility-safe pending control.

## Current catalogue-preview status

- `/shop/catalogue-preview` is clean for the initial seeded solar set.
- The `9` seeded solar products appear as accepted for customer-facing `/shop`.
- Existing non-solar products such as `Beef` and `Goat` remain rejected.
- Missing image warnings remain internal only and do not leak technical details to customer pages.

## Preview deployment audit

- Preview URL currently checked: `https://betechops-2fat6wwc3-jackson-kiokos-projects.vercel.app/shop?_vercel_share=VhX05hT86Fh9cpGWXp4fpuYgXR6ZCgR2`
- Current preview env status: `NEXT_PUBLIC_SHOP_USE_OPS_API` is still effectively `false` on the deployed preview.
- Evidence: the live `/shop` preview still shows the mock-mode preview banner and customer-facing mock catalogue sections.
- Route status checked on the live preview:
- `/shop` loads successfully.
- Customer-facing preview is still safe because mock checkout and quote flows remain in test mode.
- Open issue before real-catalogue preview testing:
- preview/staging Vercel env still needs `NEXT_PUBLIC_SHOP_USE_OPS_API=true`
- production must remain `NEXT_PUBLIC_SHOP_USE_OPS_API=false`
- Once the preview env is switched, re-check `/api/shop/products`, `/shop/catalogue-preview`, seeded category pages, and seeded product pages against the deployed preview URL.
