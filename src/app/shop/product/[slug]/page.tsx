import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CreditCard, Headphones, MapPin, Truck } from "lucide-react";
import ShopAnalyticsTracker from "@/app/shop/_components/ShopAnalyticsTracker";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopMobileStickyBar from "@/app/shop/_components/ShopMobileStickyBar";
import ProductCard from "@/app/shop/_components/ProductCard";
import ReferralClickTracker from "@/app/shop/_components/ReferralClickTracker";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopProductDetailActions from "@/app/shop/_components/ShopProductDetailActions";
import ShopProductGallery from "@/app/shop/_components/ShopProductGallery";
import ProductReviewsSection from "@/app/shop/_components/ProductReviewsSection";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import MarkdownRendererClient from "@/components/MarkdownRendererClient";
import { getShopProductBySlug, getShopProductBySlugOrOpsProductId, getShopProducts } from "@/app/shop/shopApi";
import { buildProductJsonLd, buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks, type ShopProduct } from "@/app/shop/shopData";
import { getProductAvailabilityBadge, getProductAvailabilityMessage, getProductCheckoutAvailabilityMessage } from "@/app/shop/shopAvailability";
import { getShopCategoryHref, SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { getPublishedProductReviews } from "@/lib/reviewsReferrals";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";

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

const DESCRIPTION_SECTION_HEADINGS = [
  "Specifications",
  "Key Features",
  "Benefits",
  "Ideal For",
  "Suitable For",
  "Applications",
  "What's Included",
  "Includes",
  "Warranty",
] as const;

function formatSpecificationLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function splitSpecificationContent(value: string) {
  const matches = Array.from(value.matchAll(/([A-Z][A-Za-z0-9\/ ]{1,24}):\s*([^:]+?)(?=\s+[A-Z][A-Za-z0-9\/ ]{1,24}:|$)/g));
  if (!matches.length) return [value.trim()];
  return matches
    .map((match) => `${formatSpecificationLabel(match[1])}: ${match[2].trim()}`)
    .filter(Boolean);
}

function splitDescriptionIntoBullets(value: string) {
  const normalized = value.replace(/\s+/g, " ").replace(/\bPrice\s*$/i, "").trim();
  if (!normalized) return [];

  const sectioned = DESCRIPTION_SECTION_HEADINGS.reduce((text, heading) => {
    const pattern = new RegExp(`\\s*${heading}\\s*:?\\s*`, "gi");
    return text.replace(pattern, `\n${heading}: `);
  }, normalized);

  return sectioned
    .split("\n")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .flatMap((segment) => {
      const sentenceParts = segment
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (sentenceParts.length > 1) return sentenceParts;
      if (/^[A-Z][A-Za-z ]{2,24}:\s*/.test(segment)) return splitSpecificationContent(segment);
      return [segment];
    });
}

function buildDetailBullets(product: ShopProduct) {
  return Array.from(
    new Set(
      [product.fullDescription, ...product.specs]
        .flatMap((value) => splitDescriptionIntoBullets(String(value || "")))
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
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

export default async function ShopProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ opsProductId?: string; ref?: string; lpp?: string; siteVisit?: string }> | { opsProductId?: string; ref?: string; lpp?: string; siteVisit?: string };
}) {
  const { slug } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const product = await getShopProductBySlugOrOpsProductId(slug, resolvedSearchParams.opsProductId);
  if (!product) notFound();

  const [products, publishedReviews] = await Promise.all([
    getShopProducts(),
    getPublishedProductReviews(product.opsProductId || product.id).catch(() => ({
      total: 0,
      averageRating: 0,
      reviews: [],
    })),
  ]);
  const session = await auth();
  const sessionUser = session?.user as { id?: string | null; name?: string | null; email?: string | null; phone?: string | null } | undefined;
  const viewerProfile = sessionUser?.id ? await findSafeCustomerProfileByUserId(sessionUser.id) : null;
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
  const detailBullets = buildDetailBullets({ ...product, fullDescription: undefined });
  const tiktokEmbedUrl = getTikTokEmbedUrl(product.tiktokVideoUrl);
  const referralCode = String(resolvedSearchParams.ref || "").trim().toUpperCase();
  const lppReturnHref = `/${product.slug}?${new URLSearchParams({
    ...(product.opsProductId ? { opsProductId: product.opsProductId } : {}),
    lpp: "1",
  }).toString()}`;
  const loginHref = `/login/phone?callbackUrl=${encodeURIComponent(lppReturnHref)}`;
  const siteVisitReturnHref = `/${product.slug}?${new URLSearchParams({
    ...(product.opsProductId ? { opsProductId: product.opsProductId } : {}),
    siteVisit: "1",
  }).toString()}`;
  const siteVisitLoginHref = `/login/phone?callbackUrl=${encodeURIComponent(siteVisitReturnHref)}`;
  const supportItems = [
    {
      icon: <Truck className="h-4 w-4" />,
      title: "Nationwide Delivery",
      copy:
        "We deliver countrywide using your preferred courier, rider, or our company van depending on your location and order size.",
    },
    {
      icon: <MapPin className="h-4 w-4" />,
      title: "Nairobi Shop Pickup",
      copy:
        "Collect your order directly from our Nairobi CBD shop once confirmed.",
      detail: "Pramukh Plaza, 3rd Floor, Shop No. 3\nJunction of Munyu Road & Sheikh Karume Road\nNairobi CBD",
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      title: "Secure Payment Options",
      copy:
        "Secure payment via M-Pesa. We offer both prepayment and pay-on-delivery options depending on your location and order type.",
    },
    {
      icon: <Headphones className="h-4 w-4" />,
      title: "WhatsApp Support",
      copy:
        "Talk directly with our team on WhatsApp for product recommendations, sizing, delivery assistance, and ordering help.",
      detail: "+254 722 151 083",
    },
  ];
  const detailAccordions = [
    ...(product.fullDescription
      ? [
          {
            title: "Product details",
            content: <MarkdownRendererClient mdText={product.fullDescription} variant="storefront" />,
          },
        ]
      : []),
    {
      title: "Key specifications",
      content: (
        <div className="grid max-w-5xl gap-3 sm:grid-cols-2">
          {detailBullets.map((spec) => {
            const labelMatch = spec.match(/^([^:]{2,42}):\s*(.+)$/);
            return (
              <div key={spec} className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf7] p-3.5 sm:p-4">
                <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                <div className="min-w-0 break-words text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                  {labelMatch ? <><span className="font-extrabold text-slate-950">{labelMatch[1]}:</span> {labelMatch[2]}</> : spec}
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className={shopStyles.page}>
      <ShopAnalyticsTracker kind="product_view" payload={{ slug: product.slug, name: product.name, category: product.category, brand: product.brand }} />
      {referralCode ? <ReferralClickTracker referralCode={referralCode} productSlug={product.slug} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-4 sm:py-7">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Shop", href: "/shop" },
              { label: product.category, href: getShopCategoryHref(encodeURIComponent(product.category.toLowerCase().replace(/\s+/g, "-"))) },
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
                <div className="border-b border-[#7a0000]/8 bg-[radial-gradient(circle_at_top_right,rgba(242,178,15,0.16),transparent_34%),linear-gradient(180deg,#fffdf8_0%,#fff7ee_100%)] px-4 py-3.5 sm:px-6 sm:py-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={shopStyles.sectionEyebrow}>{product.category}</div>
                    <div className="inline-flex rounded-full border border-[#0f9d58]/14 bg-[#effcf4] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#0f9d58]">
                      {stockLabelMap[product.stockStatus]}
                    </div>
                    <div className="inline-flex rounded-full border border-[#7a0000]/10 bg-white/92 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#7a0000]">
                      {availabilityBadge}
                    </div>
                  </div>
                  <div className="mt-3">
                    <h1 className="max-w-[26ch] text-2xl font-extrabold leading-[1.1] tracking-tight text-slate-950 md:text-3xl">
                      {visualTitle}
                    </h1>
                  </div>
                </div>

                <div className="grid gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
                  <div className="grid gap-2.5 rounded-[22px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#ffffff_0%,#fffaf3_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:p-5">
                    <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Price</div>
                        <div className="mt-2 flex items-end gap-3">
                          <div className="flex items-baseline whitespace-nowrap text-slate-950">
                            <span className="text-[1.2rem] font-bold tracking-[-0.03em] sm:text-[1.45rem]">Ksh</span>
                            <span className="ml-2 text-[2.1rem] font-black tracking-[-0.05em] sm:text-[2.85rem]">
                              {Number(product.price).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          {product.oldPrice ? <div className="pb-1 text-base font-semibold text-slate-400 line-through whitespace-nowrap">{formatCurrency(product.oldPrice)}</div> : null}
                        </div>
                      </div>
                      <div className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/8 px-3.5 py-2.5 text-left md:w-auto md:min-w-[15rem]">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Pickup & delivery</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-800">{checkoutAvailabilityMessage}</div>
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3 text-sm leading-6 text-slate-700">
                      {availabilityMessage}
                    </div>
                    <ShopProductDetailActions
                      product={product}
                      openLipaPolePole={resolvedSearchParams.lpp === "1"}
                      openSiteVisit={resolvedSearchParams.siteVisit === "1"}
                      customer={{
                        isAuthenticated: Boolean(sessionUser?.id),
                        name: viewerProfile?.name || sessionUser?.name || "",
                        phone: viewerProfile?.phone || sessionUser?.phone || "",
                        email: viewerProfile?.email || sessionUser?.email || "",
                        county: viewerProfile?.county || "",
                        town: viewerProfile?.town || "",
                        estateLandmark: viewerProfile?.estateLandmark || "",
                        locationNotes: viewerProfile?.locationNotes || "",
                      }}
                      loginHref={loginHref}
                      siteVisitLoginHref={siteVisitLoginHref}
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#7a0000]/8 bg-white p-4 sm:rounded-[28px] sm:p-5">
                    <div className="border-b border-[#7a0000]/8 pb-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Delivery & support</div>
                      <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        We deliver and install anywhere in Kenya, or you can order online and collect from our Nairobi CBD shop.
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                      {supportItems.map((item) => (
                        <div
                          key={item.title}
                          className="flex h-full min-h-[9.25rem] items-start gap-3 rounded-2xl border border-[#7a0000]/8 bg-[#fcfaf8] p-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md md:p-4"
                        >
                          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#fff1dc] text-[#7a0000]">
                            {item.icon}
                          </span>
                          <div className="max-w-[24ch]">
                            <div className="text-lg font-extrabold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-[12px] leading-[1.4rem] text-slate-600 md:text-[13px] md:leading-[1.35rem]">{item.copy}</div>
                            {"detail" in item && item.detail ? (
                              <div className={`mt-1.5 whitespace-pre-line text-[12px] leading-[1.35rem] md:text-[13px] md:leading-[1.35rem] ${item.title === "WhatsApp Support" ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                                {item.detail}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
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
                  <div className="border-t border-[#7a0000]/8 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{section.content}</div>
                </details>
              ))}
            </div>

            <ProductReviewsSection
              averageRating={publishedReviews.averageRating}
              total={publishedReviews.total}
              reviews={publishedReviews.reviews}
            />

          </div>

          {relatedProducts.length ? (
            <section className="pt-10 sm:pt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Related products</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">More from {product.category}</h2>
                </div>
                <Link href={SHOP_HOME_HREF} className={shopStyles.secondaryButton}>
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
