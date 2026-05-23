import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, BatteryCharging, CreditCard, MapPin, ShieldCheck, Store, SunMedium, Truck, Zap } from "lucide-react";
import ShopAnalyticsTracker from "@/app/shop/_components/ShopAnalyticsTracker";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopMobileStickyBar from "@/app/shop/_components/ShopMobileStickyBar";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopProductDetailActions from "@/app/shop/_components/ShopProductDetailActions";
import ShopProductGallery from "@/app/shop/_components/ShopProductGallery";
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

function buildVisualTitle(product: ShopProduct) {
  return toDisplayCase(normalizeProductText(product.name), product.brand);
}

function buildBreadcrumbTitle(product: ShopProduct) {
  const normalizedName = normalizeProductText(product.name);
  const segments = normalizedName.split(",").map((segment) => segment.trim()).filter(Boolean);
  return toDisplayCase(segments.slice(0, 2).join(", ") || normalizedName, product.brand);
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
  const commaSegments = normalizedName
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const summary: string[] = [];

  for (const segment of commaSegments.slice(1)) {
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

function buildValueProposition(product: ShopProduct) {
  const category = product.category.toLowerCase();
  if (category.includes("kit")) return "Complete solar backup solution for homes, biashara, farms, and offices.";
  if (category.includes("panel")) return "High-efficiency solar generation built for reliable home, biashara, and project installs.";
  if (category.includes("batter")) return "Reliable energy storage designed for clean backup, longer runtime, and daily solar cycling.";
  if (category.includes("inverter")) return "Smart power conversion for stable solar backup, grid support, and everyday appliance use.";
  return "Professional solar product support, clear pricing, and nationwide delivery from Betech Solar.";
}

function extractTikTokVideoId(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const directMatch = normalized.match(/\/video\/(\d{8,})/i);
  if (directMatch) return directMatch[1];

  const digitsOnly = normalized.match(/\b(\d{8,})\b/);
  return digitsOnly ? digitsOnly[1] : null;
}

function getTikTokEmbedUrl(value: string | null | undefined) {
  const videoId = extractTikTokVideoId(value);
  return videoId
    ? `https://www.tiktok.com/player/v1/${videoId}?controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&timestamp=1&description=0&music_info=0&rel=0&native_context_menu=1`
    : null;
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
  const visualTitle = buildVisualTitle(product);
  const breadcrumbTitle = buildBreadcrumbTitle(product);
  const specSummary = buildSpecSummary(product);
  const valueProposition = buildValueProposition(product);
  const tiktokEmbedUrl = getTikTokEmbedUrl(product.tiktokVideoUrl);
  const keyHighlights = [
    { icon: <Zap className="h-4 w-4" />, label: specSummary[0] || product.specs[0] || "Solar Configuration" },
    { icon: <BatteryCharging className="h-4 w-4" />, label: specSummary[1] || product.specs[1] || "Battery Support" },
    { icon: <SunMedium className="h-4 w-4" />, label: specSummary[2] || product.specs[2] || "Panel Setup" },
    { icon: <ShieldCheck className="h-4 w-4" />, label: product.warranty || "Warranty Support" },
    { icon: <Truck className="h-4 w-4" />, label: "Nationwide Delivery" },
    { icon: <Store className="h-4 w-4" />, label: "Nairobi Shop Pickup" },
  ];
  const trustItems = [
    { icon: <Truck className="h-4 w-4" />, title: "Nationwide Courier", copy: "Panels, batteries, kits, and accessories delivered across Kenya." },
    { icon: <MapPin className="h-4 w-4" />, title: "Nairobi Pickup", copy: "Collect from our Pramukh Plaza shop once your order is confirmed." },
    { icon: <CreditCard className="h-4 w-4" />, title: "Secure M-Pesa Payment", copy: "Our team confirms stock, transport, and payment steps before fulfilment." },
    { icon: <ShieldCheck className="h-4 w-4" />, title: "WhatsApp Support", copy: "Talk directly to Betech Solar for sizing, delivery, and ordering help." },
  ];

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
              { label: breadcrumbTitle },
            ]}
          />

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
            <ShopProductGallery images={galleryImages} productName={product.name} visualType={product.visualType} videoEmbedUrl={tiktokEmbedUrl} />

            <div className="grid gap-5">
              <div className={`${shopStyles.lightCard} p-4 sm:p-5 lg:p-6`}>
                <div className={shopStyles.sectionEyebrow}>{product.category}</div>
                <div className="mt-4 max-w-3xl">
                  <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.02em] text-slate-950 sm:text-[34px] xl:text-[42px]">
                    {visualTitle}
                  </h1>
                </div>
                <div className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-600">
                  {valueProposition}
                </div>
                {specSummary.length ? (
                  <ul className="mt-4 grid gap-2 text-sm leading-5 text-slate-600">
                    {specSummary.map((spec) => (
                      <li key={spec} className="flex items-start gap-2.5">
                        <span className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a0000]/55" />
                        <span>{spec}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-5 grid gap-3 rounded-[26px] border border-[#7a0000]/8 bg-[linear-gradient(180deg,#fffaf4_0%,#ffffff_100%)] p-4 shadow-[0_16px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="text-[2rem] font-bold tracking-[-0.03em] text-slate-950 sm:text-[2.35rem]">{formatCurrency(product.price)}</div>
                    {product.oldPrice ? <div className="pb-1 text-base font-semibold text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <div className="inline-flex rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#0f9d58]">
                      {stockLabelMap[product.stockStatus]}
                    </div>
                    <div className="inline-flex rounded-full border border-[#7a0000]/10 bg-[#fcfaf7] px-3.5 py-1.5 text-xs font-bold text-[#7a0000]">
                      {availabilityBadge}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm font-semibold text-slate-700">
                    <div>{availabilityMessage}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500">{checkoutAvailabilityMessage}</div>
                  </div>
                </div>

                <div className="mt-4 text-sm font-semibold text-slate-600">{product.warranty}</div>
                {product.warrantyNotes ? <div className="mt-2 text-sm leading-6 text-slate-600">{product.warrantyNotes}</div> : null}
                <div className="mt-5">
                  <ShopProductDetailActions product={product} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
                <div className={`${shopStyles.softCard} p-4 sm:p-5`}>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#7a0000]">System highlights</div>
                  <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {keyHighlights.map((item) => (
                      <div key={item.label} className="flex items-start gap-3 rounded-[20px] border border-[#7a0000]/8 bg-white/90 px-3.5 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
                          {item.icon}
                        </span>
                        <div className="text-sm font-semibold leading-5 text-slate-700">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[22px] border border-[#7a0000]/8 bg-white/90 px-4 py-4">
                    <div className="text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">Full specifications</div>
                    <ul className="mt-3 grid gap-2.5 text-sm leading-6 text-slate-600">
                      {product.specs.map((spec) => (
                        <li key={spec} className="flex items-start gap-3">
                          <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                          <span>{spec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={`${shopStyles.softCard} p-4 sm:p-5`}>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-[#0f9d58]">Delivery, payment & trust</div>
                  <div className="mt-4 grid gap-2.5">
                    {trustItems.map((item) => (
                      <div key={item.title} className="rounded-[20px] border border-[#0f9d58]/10 bg-[linear-gradient(180deg,#f5fff9_0%,#ffffff_100%)] px-4 py-3.5 shadow-[0_10px_20px_rgba(15,157,88,0.05)]">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#eafaf1] text-[#0f9d58]">
                            {item.icon}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-sm leading-5 text-slate-600">{item.copy}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {product.fullDescription ? <p className="mt-4 text-sm leading-7 text-slate-600">{product.fullDescription}</p> : null}
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
              <div className="mt-6 hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
              <div className="mt-6 flex gap-3 overflow-x-auto pb-2 md:hidden">
                {relatedProducts.map((item) => (
                  <div key={item.id} className="w-[78vw] max-w-[18rem] shrink-0">
                    <ProductCard product={item} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp hideOnMobile />
      <ShopMobileStickyBar productId={product.id} productName={product.name} price={product.price} />
    </div>
  );
}
