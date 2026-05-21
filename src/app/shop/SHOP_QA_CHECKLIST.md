# Shop QA Checklist

## Mobile Pages To Test
- `/shop`
- `/shop/category/solar-panels`
- `/shop/product/585w-solar-panel`
- `/shop/cart`
- `/shop/checkout`
- `/shop/request-quote`
- `/shop/order-success`
- `/shop/quote-success`

## Desktop Pages To Test
- `/shop`
- `/shop/category/solar-inverters`
- `/shop/product/3.5kw-hybrid-inverter`
- `/shop/cart`
- `/shop/checkout`
- `/shop/request-quote`
- `/shop/order-success`
- `/shop/quote-success`

## Cart Flow
- Add product from homepage card
- Add product from product detail page
- Increase and reduce quantity
- Remove item
- Confirm subtotal updates correctly

## Checkout Flow
- Confirm empty cart state blocks submit
- Confirm inline validation appears for name, phone, location, delivery method, and payment preference
- Submit mock order and verify `BT-SHOP-YYYY-####` reference
- Refresh `/shop/order-success` and confirm last mock order still displays

## Quote Flow
- Open `/shop/request-quote`
- Confirm inline validation appears for name, phone, location, and property type
- Submit mock quote and verify `BT-QUOTE-YYYY-####` reference
- Refresh `/shop/quote-success` and confirm last mock quote still displays

## WhatsApp CTA Flow
- Homepage quote CTA
- Floating WhatsApp button
- Product card WhatsApp order
- Product detail WhatsApp order
- Cart WhatsApp checkout
- Order success WhatsApp confirmation
- Quote success WhatsApp follow-up

## Overflow Checks
- No horizontal overflow on mobile, tablet, or desktop
- Floating WhatsApp must not block cart, checkout, or quote CTAs
- Sticky header spacing remains intact with preview banner enabled

## Future Ops Integration Checks
- `NEXT_PUBLIC_SHOP_USE_OPS_API=false` keeps preview banner visible
- `NEXT_PUBLIC_SHOP_USE_OPS_API=true` should hide preview banner
- Mock order and quote flows remain isolated from live ops and POS data
- Replace analytics placeholders with real GA4 / Meta / TikTok wiring during live integration
