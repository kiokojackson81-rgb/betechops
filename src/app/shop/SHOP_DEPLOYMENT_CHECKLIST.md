# Shop Deployment Checklist

## Environment Variables
- `NEXT_PUBLIC_SHOP_USE_OPS_API=false` for Vercel preview and customer review
- Confirm preview deployment is not pointing to any live ops order or POS mutation endpoints
- Keep existing `agents` and `ops` environment variables unchanged

## Vercel Preview Checks
- Open `/shop`
- Open `/shop/category/solar-panels`
- Open `/shop/product/585w-solar-panel`
- Open `/shop/cart`
- Open `/shop/checkout`
- Open `/shop/request-quote`
- Open `/shop/order-success`
- Open `/shop/quote-success`
- Confirm preview banner is visible on all shop pages when `NEXT_PUBLIC_SHOP_USE_OPS_API=false`

## Mobile QA
- Confirm no horizontal overflow
- Confirm sticky header and search spacing
- Confirm category scroller works naturally
- Confirm product cards remain aligned and tap-friendly
- Confirm floating WhatsApp does not block cart or checkout CTAs

## Desktop QA
- Confirm hero layout remains balanced
- Confirm category cards route to category pages
- Confirm product cards route to product pages
- Confirm cart, checkout, quote, and success layouts remain centered and readable

## WhatsApp CTA Checks
- Homepage quote CTA
- Floating WhatsApp help button
- Product card WhatsApp order
- Product detail WhatsApp order
- Cart WhatsApp checkout
- Order confirmation WhatsApp follow-up
- Quote confirmation WhatsApp follow-up

## SEO Checks
- Confirm metadata is present for all shop routes
- Confirm product routes render Product JSON-LD
- Confirm titles and descriptions use Betech Solar Solutions wording

## Future Ops Integration Switch Checklist
- Switch `NEXT_PUBLIC_SHOP_USE_OPS_API=true` only after ops preview endpoints are verified
- Replace mock catalogue reads with ops catalogue API
- Replace preview checkout submit with pending ecommerce order creation in ops
- Replace preview quote submit with admin quote lead creation in ops
- Add receipt and customer linkage only after admin processing flow is signed off

## Rollback Notes
- Revert the `/shop` preview deployment if customer-facing routing or wording becomes misleading
- Keep urgent buyers on WhatsApp while preview mode is active
- Do not enable live ops integration until preview QA and admin order handoff QA both pass

## Known Limitations
- Products are mock data
- Orders are local preview data only
- Quotes are local preview data only
- No payment gateway yet
- No live ops or POS mutation yet
- Customers should use WhatsApp for urgent purchases
