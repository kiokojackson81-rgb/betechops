import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
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
    ? `https://www.tiktok.com/embed/v3/${videoId}`
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
  const tiktokEmbedUrl = getTikTokEmbedUrl(product.tiktokVideoUrl);
  const detailAccordions = [
    {
      title: "Key specifications",
      content: (
        <ul className="grid gap-3 text-sm leading-6 text-slate-600">
          {product.specs.map((spec) => (
            <li key={spec} className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
              <span>{spec}</span>
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className={shopStyles.page}>
      <ShopAnalyticsTracker kind="product_view" payload={{ slug: product.slug, name: product.name, category: product.category, brand: product.brand }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-4 sm:py-7">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: product.category, href: `/shop/category/${encodeURIComponent(product.category.toLowerCase().replace(/\s+/g, "-"))}` },
              { label: breadcrumbTitle },
            ]}
          />

          <div className="mt-4 grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] xl:items-start">
            <ShopProductGallery
              images={galleryImages}
              productName={product.name}
              visualType={product.visualType}
              videoEmbedUrl={tiktokEmbedUrl}
              videoSourceUrl={product.tiktokVideoUrl}
            />

            <div className="xl:sticky xl:top-24">
              <div className="overflow-hidden rounded-[24px] border border-[#7a0000]/10 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:rounded-[32px]">
                <div className="border-b border-[#7a0000]/8 bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.16),transparent_34%),linear-gradient(180deg,#fffdf8_0%,#fff7ee_100%)] px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className={shopStyles.sectionEyebrow}>{product.category}</div>
                    <div className="inline-flex rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#0f9d58]">
                      {stockLabelMap[product.stockStatus]}
                    </div>
                    <div className="inline-flex rounded-full border border-[#7a0000]/10 bg-white/92 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                      {availabilityBadge}
                    </div>
                  </div>
                  <div className="mt-4 max-w-3xl">
                    <h1 className="max-w-none text-[clamp(1.25rem,2.4vw,2rem)] font-bold leading-[1.1] tracking-[-0.03em] text-slate-950 sm:max-w-[20ch]">
                      {visualTitle}
                    </h1>
                  </div>
                </div>

                <div className="grid gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-6">
                  <div className="grid gap-4 rounded-[22px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Price</div>
                        <div className="mt-2 flex flex-wrap items-end gap-3">
                          <div className="text-[1.75rem] font-bold tracking-[-0.04em] text-slate-950 sm:text-[2.5rem]">{formatCurrency(product.price)}</div>
                          {product.oldPrice ? <div className="pb-1 text-base font-semibold text-slate-400 line-through">{formatCurrency(product.oldPrice)}</div> : null}
                        </div>
                      </div>
                      <div className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/6 px-4 py-3 text-left sm:w-auto sm:text-right">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Pickup & delivery</div>
                        <div className="mt-1 text-sm font-semibold text-slate-800">{checkoutAvailabilityMessage}</div>
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3 text-sm leading-6 text-slate-700">
                      {availabilityMessage}
                    </div>
                    <ShopProductDetailActions product={product} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5">
            <div className="grid gap-3">
              {detailAccordions.map((section, index) => (
                <details key={section.title} className="group overflow-hidden rounded-[20px] border border-[#7a0000]/10 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:rounded-[26px]" open={index === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left sm:px-6">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">{section.title}</div>
                    <div className="text-sm font-semibold text-slate-500 transition group-open:rotate-45">+</div>
                  </summary>
                  <div className="border-t border-[#7a0000]/8 px-4 py-4 sm:px-6 sm:py-5">{section.content}</div>
                </details>
              ))}
            </div>

          </div>

          {relatedProducts.length ? (
            <section className="pt-10 sm:pt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Related products</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">More from {product.category}</h2>
                </div>
                <Link href="/shop" className={shopStyles.secondaryButton}>
                  Continue Shopping
                </Link>
              </div>
              <div className="mt-6 hidden gap-4 xl:grid xl:grid-cols-4">
                {relatedProducts.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
              <div className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:hidden">
                {relatedProducts.map((item) => (
                  <div key={item.id} className="w-[82vw] max-w-[19rem] shrink-0 snap-start md:w-[22rem]">
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
