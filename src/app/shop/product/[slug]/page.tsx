import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ShieldCheck, Truck } from "lucide-react";
import ShopAnalyticsTracker from "@/app/shop/_components/ShopAnalyticsTracker";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopProductDetailActions from "@/app/shop/_components/ShopProductDetailActions";
import ShopProductVisual from "@/app/shop/_components/ShopProductVisual";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getShopProductBySlug, getShopProducts } from "@/app/shop/shopApi";
import { buildProductJsonLd, buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getProductAvailabilityBadge, getProductAvailabilityMessage, getProductCheckoutAvailabilityMessage } from "@/app/shop/shopAvailability";

function normalizeProductText(value: string) {
  return value
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatUnitValue(value: string) {
  return value
    .replace(/(\d+(?:\.\d+)?)\s*kwh\b/gi, "$1KWh")
    .replace(/(\d+(?:\.\d+)?)\s*kw\b/gi, "$1KW")
    .replace(/(\d+(?:\.\d+)?)\s*wh\b/gi, "$1Wh")
    .replace(/(\d+(?:\.\d+)?)\s*w\b/gi, "$1W")
    .replace(/(\d+(?:\.\d+)?)\s*ah\b/gi, "$1AH")
    .replace(/(\d+(?:\.\d+)?)\s*v\b/gi, "$1V");
}

function toDisplayCase(value: string, brand?: string) {
  const normalized = formatUnitValue(normalizeProductText(value));
  const brandUpper = brand?.trim().toUpperCase();
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      const bareToken = token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (!bareToken) return token;
      if (brandUpper && bareToken.toUpperCase() === brandUpper) return token.replace(bareToken, brandUpper);
      if (/^\d+(?:\.\d+)?(?:KW|KWh|W|V|AH|Wh)$/i.test(bareToken)) return token.replace(bareToken, bareToken.toUpperCase());
      if (/^(DC|AC|MPPT|PWM|LCD|LED|AGM|GEL|LITHIUM|UPS)$/i.test(bareToken)) return token.replace(bareToken, bareToken.toUpperCase());
      if (/^\d+(?:\.\d+)?$/.test(bareToken)) return token;
      return token.replace(bareToken, bareToken.charAt(0).toUpperCase() + bareToken.slice(1).toLowerCase());
    })
    .join(" ");
}

function buildDisplayTitle(product: ShopProduct) {
  const normalizedName = normalizeProductText(product.name);
  const segments = normalizedName.split(",").map((segment) => segment.trim()).filter(Boolean);
  const primarySegment = segments[0] || normalizedName;
  return toDisplayCase(primarySegment, product.brand);
}

function formatSummarySegment(segment: string, brand?: string) {
  let cleaned = normalizeProductText(segment);
  cleaned = cleaned.replace(/\bplus installation accessories\b/gi, "").trim();
  cleaned = cleaned.replace(/\binstallation accessories\b/gi, "Installation Accessories Included");
  cleaned = cleaned.replace(/\b(\d+)\s+(\d+(?:\.\d+)?)w\b/gi, "$1 x $2W");
  cleaned = cleaned.replace(/\b(\d+(?:\.\d+)?)kw\s*\(\s*([^)]+)\s*\)/gi, (_, capacity: string, detail: string) => {
    const formattedDetail = detail
      .split("/")
      .map((part) => formatUnitValue(part.trim()))
      .join(" / ");
    return `${capacity}KWh (${formattedDetail})`;
  });
  cleaned = formatUnitValue(cleaned);
  cleaned = cleaned.replace(/\bsolar panel\b/gi, (match, offset, fullText) => (/^\s*\d+\s*x\s/i.test(fullText) ? "Solar Panels" : match));
  return toDisplayCase(cleaned, brand);
}

function buildSpecSummary(product: ShopProduct) {
  const normalizedName = normalizeProductText(product.name);
  const titleSegment = normalizeProductText(buildDisplayTitle(product));
  const commaSegments = normalizedName
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => normalizeProductText(segment) !== titleSegment);

  const summary: string[] = [];

  for (const segment of commaSegments) {
    const includesAccessories = /installation accessories/i.test(segment);
    const cleanedSegment = formatSummarySegment(segment, product.brand);
    if (cleanedSegment && !summary.includes(cleanedSegment)) summary.push(cleanedSegment);
    if (includesAccessories && !summary.includes("Installation Accessories Included")) {
      summary.push("Installation Accessories Included");
    }
    if (summary.length >= 4) break;
  }

  if (!summary.length) {
    for (const spec of product.specs.slice(0, 4)) {
      const cleanedSpec = formatSummarySegment(spec, product.brand);
      if (cleanedSpec && !summary.includes(cleanedSpec)) summary.push(cleanedSpec);
    }
  }

  return summary.slice(0, 4);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);

  if (!product) {
    return buildShopMetadata({
      title: "Product Not Found",
      description: "This Betech Solar product could not be found in the current shop catalogue.",
    });
  }

  return buildShopMetadata({
    title: `${product.name} | ${product.category}`,
    description: `${product.name} from ${product.brand}. ${product.specs.slice(0, 2).join(". ")}. ${product.warranty}. Delivered countrywide by Betech Solar Solutions.`,
  });
}

export default async function ShopProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);
  if (!product) notFound();

  const products = await getShopProducts();
  const relatedProducts = products.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4);
  const stockLabelMap = {
    in_stock: "In stock",
    limited_stock: "Limited stock",
    preorder: "Pre-order",
    quote_only: "Request quote",
  } as const;
  const productJsonLd = buildProductJsonLd(product);
  const availabilityBadge = getProductAvailabilityBadge(product);
  const availabilityMessage = product.availabilityMessage || getProductAvailabilityMessage(product);
  const checkoutAvailabilityMessage = product.checkoutAvailabilityMessage || getProductCheckoutAvailabilityMessage(product);
  const galleryImages = product.galleryImages?.length ? product.galleryImages : [product.image];
  const displayTitle = buildDisplayTitle(product);
  const specSummary = buildSpecSummary(product);

  return (
    <div className={shopStyles.page}>
      <ShopAnalyticsTracker kind="product_view" payload={{ slug: product.slug, name: product.name, category: product.category, brand: product.brand }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-8 sm:py-10">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: product.category, href: `/shop/category/${encodeURIComponent(product.category.toLowerCase().replace(/\s+/g, "-"))}` },
              { label: displayTitle },
            ]}
          />

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
            <div className={`${shopStyles.softCard} overflow-hidden p-3 sm:p-4`}>
              <div className="relative rounded-[30px] border border-[#7a0000]/10 bg-[#f6eee2]">
                <div className="relative h-[18rem] sm:h-[24rem] lg:h-[30rem]">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full rounded-[28px] object-contain p-4 sm:p-5" />
                  ) : (
                    <div className="absolute inset-0 p-4 sm:p-5">
                      <ShopProductVisual visualType={product.visualType} productName={product.name} className="h-full w-full rounded-[28px]" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {galleryImages.slice(0, 3).map((imageUrl, index) => (
                  <div key={`${imageUrl}-${index}`} className="rounded-[22px] border border-[#7a0000]/10 bg-white p-2.5 shadow-[0_14px_26px_rgba(15,23,42,0.05)]">
                    <div className="h-20 rounded-2xl bg-[#f6eee2] p-2">
                      <img src={imageUrl} alt={`${product.name} gallery ${index + 1}`} className="h-full w-full rounded-[18px] object-contain" />
                    </div>
                    <div className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      {index === 0 ? "Main image" : `Gallery ${index + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5">
              <div className={`${shopStyles.lightCard} p-4 sm:p-5`}>
                <div className={shopStyles.sectionEyebrow}>{product.category}</div>
                <div className="mt-4 max-w-3xl">
                  <h1 className="line-clamp-3 text-2xl font-bold leading-[1.1] tracking-tight text-slate-950 sm:text-3xl xl:text-4xl">
                    {displayTitle}
                  </h1>
                  <span className="sr-only">{product.name}</span>
                </div>
                <div className="mt-2 text-sm font-medium text-slate-500">
                  Built around <span className="font-semibold text-slate-700">{product.brand}</span> components for clean home and biashara solar backup.
                </div>
                {specSummary.length ? (
                  <ul className="mt-3 grid gap-1.5 text-sm leading-5 text-slate-500">
                    {specSummary.map((spec) => (
                      <li key={spec} className="flex items-start gap-2">
                        <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a0000]/55" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {product.brandImage ? <img src={product.brandImage} alt={`${product.brand} logo`} className="mt-3 h-8 w-auto object-contain" /> : null}
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="text-3xl font-black text-slate-950">{formatCurrency(product.price)}</div>
                  {product.oldPrice ? <div className="text-base font-semibold text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <div className="inline-flex rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0f9d58]">
                    {stockLabelMap[product.stockStatus]}
                  </div>
                  <div className="inline-flex rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-3.5 py-1.5 text-xs font-bold text-[#7a0000]">
                    {availabilityBadge}
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-600">{product.warranty}</div>
                {product.warrantyNotes ? <div className="mt-2 text-sm leading-6 text-slate-600">{product.warrantyNotes}</div> : null}
                <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm font-semibold text-slate-700">
                  <div>{availabilityMessage}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500">{checkoutAvailabilityMessage}</div>
                </div>
                {product.fullDescription ? <p className="mt-4 text-sm leading-7 text-slate-600">{product.fullDescription}</p> : null}
                <div className="mt-5">
                  <ShopProductDetailActions product={product} />
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className={`${shopStyles.softCard} p-5 sm:p-6`}>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Key Specs</div>
                  <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                    {product.specs.map((spec) => (
                      <li key={spec} className="flex items-start gap-3">
                        <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${shopStyles.softCard} p-5 sm:p-6`}>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">Delivery & Payment</div>
                  <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600">
                    <div className="flex items-start gap-3">
                      <Truck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                      <span>Delivered countrywide, with Nairobi rider delivery and shop pickup options prepared for checkout.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                      <span>Visit our Nairobi CBD shop at Pramukh Plaza for product guidance and collection support.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                      <span>Preview checkout only for now. A Betech Solar team member will confirm stock, delivery, and payment steps before any live processing begins.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${shopStyles.darkPanel} p-5 sm:p-6`}>
                <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                  Not sure what you need?
                </div>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-white">Request a solar quote and our team will help size your system.</h2>
                <p className="mt-3 text-sm leading-7 text-white/76">
                  Our team will help match the right panels, inverter, battery, and accessories to your home, biashara, or farm needs before you place an order.
                </p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link href={`/shop/request-quote?product=${encodeURIComponent(product.name)}`} className={shopStyles.goldButton}>
                    Request Quote
                  </Link>
                  <Link href="/shop/cart" className={`${shopStyles.secondaryButton} bg-white/92`}>
                    View Cart
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {relatedProducts.length ? (
            <section className="pt-12 sm:pt-16">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Related products</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">More from {product.category}</h2>
                </div>
                <Link href="/shop" className={shopStyles.secondaryButton}>
                  Continue Shopping
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
