import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CircleDollarSign, CreditCard, Headphones, Truck } from "lucide-react";
import AgentCatalogueProductCard from "@/app/agents/_components/AgentCatalogueProductCard";
import AgentProductDetailActions from "@/app/agents/_components/AgentProductDetailActions";
import AgentWhatsAppFloat from "@/app/agents/_components/AgentWhatsAppFloat";
import MarkdownRendererClient from "@/components/MarkdownRendererClient";
import {
  getAgentCommissionValue,
  getAgentPotentialCommissionValue,
  productCommissionRequiresApproval,
} from "@/app/agents/agentCatalogue";
import { getAgentCategoryHref, getAgentProductsHref } from "@/app/agents/storefrontPaths";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopProductGallery from "@/app/shop/_components/ShopProductGallery";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { getProductAvailabilityBadge, getProductAvailabilityMessage, getProductCheckoutAvailabilityMessage } from "@/app/shop/shopAvailability";
import { getShopProductBySlug, getShopProductBySlugOrOpsProductId, getShopProducts } from "@/app/shop/shopApi";
import { buildProductJsonLd, buildShopMetadata } from "@/app/shop/shopMetadata";
import type { ShopProduct } from "@/app/shop/shopData";
import { auth } from "@/lib/auth";
import { agentPath, isAgentsHost } from "@/lib/agents/host";

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
  return videoId ? `https://www.tiktok.com/embed/v3/${videoId}` : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getShopProductBySlug(slug);

  if (!product) {
    return buildShopMetadata({
      title: "Agent Product Not Found",
      description: "This agent catalogue product could not be found in the current live Betech catalogue.",
    });
  }

  return buildShopMetadata({
    title: `${product.name} | Agent Catalogue`,
    description: `${product.name} from ${product.brand}. Agent view with commission visibility, live stock guidance, and product referral support.`,
  });
}

export default async function AgentProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ opsProductId?: string }> | { opsProductId?: string };
}) {
  const host = (await headers()).get("host");
  const useRootPaths = isAgentsHost(host);
  const session = await auth().catch(() => null);
  const isLoggedInAgent = Boolean((session?.user as { isAgent?: boolean } | undefined)?.isAgent);
  const { slug } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const product = await getShopProductBySlugOrOpsProductId(slug, resolvedSearchParams.opsProductId);
  if (!product) notFound();

  const products = await getShopProducts();
  const relatedProducts = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);

  const productJsonLd = buildProductJsonLd(product);
  const availabilityBadge = getProductAvailabilityBadge(product);
  const availabilityMessage = product.availabilityMessage || getProductAvailabilityMessage(product);
  const checkoutAvailabilityMessage =
    product.checkoutAvailabilityMessage || getProductCheckoutAvailabilityMessage(product);
  const galleryImages = product.galleryImages?.length ? product.galleryImages : [product.image];
  const visualTitle = buildVisualTitle(product);
  const breadcrumbTitle = buildBreadcrumbTitle(product);
  const detailBullets = buildDetailBullets({ ...product, fullDescription: undefined });
  const tiktokEmbedUrl = getTikTokEmbedUrl(product.tiktokVideoUrl);
  const stockLabelMap = {
    in_stock: "In stock",
    limited_stock: "Limited stock",
    preorder: "Pre-order",
    quote_only: "Quote required",
  } as const;
  const commissionAmount = getAgentCommissionValue(product);
  const displayCommissionAmount = getAgentPotentialCommissionValue(product);
  const requiresApproval = productCommissionRequiresApproval(product);
  const commissionPercent =
    product.price > 0 && displayCommissionAmount > 0 ? Math.round((displayCommissionAmount / product.price) * 100) : 0;
  const otpHref = `/login/phone?callbackUrl=${encodeURIComponent(agentPath("/dashboard", useRootPaths))}`;
  const loginHref = otpHref;
  const dashboardHref = agentPath("/dashboard", useRootPaths);
  const commissionHref = agentPath("/withdrawals", useRootPaths);
  const supportItems = [
    {
      icon: <CircleDollarSign className="h-4 w-4" />,
      title: "Transparent commission",
      copy:
        commissionAmount > 0
          ? `Refer this product and track up to ${formatCurrency(commissionAmount)} from the confirmed sale price.`
          : `Estimated potential commission is ${formatCurrency(displayCommissionAmount)} based on 6% of the visible sale price.`,
    },
    {
      icon: <Truck className="h-4 w-4" />,
      title: "Betech handles fulfillment",
      copy:
        "Your customer still buys from Betech. We handle confirmation, delivery, installation, and after-sales support.",
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      title: "Commission unlock rule",
      copy:
        requiresApproval
          ? "This referral may require approval before payout is released."
          : "Commission unlocks after the order is successfully completed and payment is confirmed.",
    },
    {
      icon: <Headphones className="h-4 w-4" />,
      title: "Agent support",
      copy:
        "If you need help pitching the customer, sizing the system, or confirming availability, contact Betech support directly.",
    },
  ];

  return (
    <div className={shopStyles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <header className="sticky top-0 z-40 border-b border-[#7a0000]/10 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Agent Product View</div>
            <div className="text-lg font-black text-slate-950">Betech Agent Catalogue</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={agentPath("/", useRootPaths)} className={shopStyles.secondaryButton}>
              Agent Home
            </Link>
            <Link href={getAgentProductsHref(useRootPaths)} className={shopStyles.secondaryButton}>
              All Products
            </Link>
            {isLoggedInAgent ? (
              <>
                <Link href={dashboardHref} className={shopStyles.secondaryButton}>
                  Dashboard
                </Link>
                <Link href={commissionHref} className={shopStyles.primaryButton}>
                  Your commission
                </Link>
              </>
            ) : (
              <>
                <Link href={loginHref} className={shopStyles.secondaryButton}>
                  Log in
                </Link>
                <Link href={loginHref} className={shopStyles.primaryButton}>
                  Submit order & earn
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="py-4 sm:py-7">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs
            items={[
              { label: "Agents", href: agentPath("/", useRootPaths) },
              { label: "Products", href: getAgentProductsHref(useRootPaths) },
              { label: product.category, href: getAgentCategoryHref(encodeURIComponent(product.category.toLowerCase().replace(/\s+/g, "-")), useRootPaths) },
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
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Product price</div>
                        <div className="mt-2 flex items-end gap-3">
                          <div className="flex items-baseline whitespace-nowrap text-slate-950">
                            <span className="text-[1.2rem] font-bold tracking-[-0.03em] sm:text-[1.45rem]">Ksh</span>
                            <span className="ml-2 text-[2.1rem] font-black tracking-[-0.05em] sm:text-[2.85rem]">
                              {Number(product.price).toLocaleString("en-KE", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          {product.oldPrice ? (
                            <div className="pb-1 text-base font-semibold text-slate-400 line-through whitespace-nowrap">
                              {formatCurrency(product.oldPrice)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="w-full rounded-2xl border border-amber-400/20 bg-amber-400/8 px-3.5 py-2.5 text-left md:w-auto md:min-w-[15rem]">
                        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Customer fulfillment</div>
                        <div className="mt-1 text-sm font-semibold leading-5 text-slate-800">{checkoutAvailabilityMessage}</div>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-[#0f9d58]/14 bg-[linear-gradient(180deg,#effcf4_0%,#ffffff_100%)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0f9d58]">Your commission on this product</div>
                        <div className="mt-2 text-3xl font-black text-slate-950">
                          {formatCurrency(displayCommissionAmount)}
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-600">
                          {commissionAmount > 0
                            ? `${commissionPercent}% of the visible sale price.`
                            : `Potential commission estimate at 6% of price.`}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7a0000]">Payout status</div>
                        <div className="mt-1 text-sm font-bold text-slate-950">
                          {requiresApproval ? "Needs approval check" : "Ready after completed sale"}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-[#7a0000]/8 bg-[#fcfaf7] px-4 py-3 text-sm leading-6 text-slate-700">
                      {availabilityMessage}
                    </div>
                    <AgentProductDetailActions
                      product={product}
                      loginHref={loginHref}
                      loggedIn={isLoggedInAgent}
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#7a0000]/8 bg-white p-4 sm:rounded-[28px] sm:p-5">
                    <div className="border-b border-[#7a0000]/8 pb-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">How agents use this page</div>
                      <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        Share this product confidently, show the customer the same live catalogue information from Betech, and know exactly what you can earn from a successful completed sale.
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
                            <div className="mt-1 text-[12px] leading-[1.4rem] text-slate-600 md:text-[13px] md:leading-[1.35rem]">
                              {item.copy}
                            </div>
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
            {product.fullDescription ? (
              <details className="group overflow-hidden rounded-[20px] border border-[#7a0000]/10 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:rounded-[26px]" open>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left sm:px-6">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Product details</div>
                  <div className="text-sm font-semibold text-slate-500 transition group-open:rotate-45">+</div>
                </summary>
                <div className="border-t border-[#7a0000]/8 px-4 py-4 sm:px-6 sm:py-5">
                  <MarkdownRendererClient mdText={product.fullDescription} />
                </div>
              </details>
            ) : null}
            <details className="group overflow-hidden rounded-[20px] border border-[#7a0000]/10 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:rounded-[26px]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left sm:px-6">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Key specifications</div>
                <div className="text-sm font-semibold text-slate-500 transition group-open:rotate-45">+</div>
              </summary>
              <div className="border-t border-[#7a0000]/8 px-4 py-4 sm:px-6 sm:py-5">
                <ul className="grid gap-3 text-sm leading-6 text-slate-600">
                  {detailBullets.map((spec) => (
                    <li key={spec} className="flex items-start gap-3">
                      <BadgeCheck className="mt-1 h-4 w-4 shrink-0 text-[#7a0000]" />
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>

          {relatedProducts.length ? (
            <section className="pt-10 sm:pt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Related agent products</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">More from {product.category}</h2>
                </div>
                <Link href={getAgentProductsHref(useRootPaths)} className={shopStyles.secondaryButton}>
                  Continue in agent catalogue
                </Link>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-4">
                {relatedProducts.map((item) => (
                  <AgentCatalogueProductCard
                    key={item.id}
                    product={item}
                    loginHref={otpHref}
                    loggedIn={isLoggedInAgent}
                    useRootPaths={useRootPaths}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <AgentWhatsAppFloat />
    </div>
  );
}
