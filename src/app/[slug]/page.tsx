export { default, generateMetadata } from "@/app/shop/product/[slug]/page";

// Product records are published from Ops at any time. Do not cache a 404 for
// a newly created product before the catalogue cache has refreshed.
export const dynamic = "force-dynamic";
export const revalidate = 0;
