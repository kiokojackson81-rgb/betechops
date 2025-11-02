// Keep helper types decoupled from UI row types to avoid tight coupling/errors in builds

type Money = { currency?: string; value: number };

const COUNTRY_DOMAIN_MAP: Record<string, string> = {
  CI: "ci",
  CM: "cm",
  DZ: "dz",
  EG: "com.eg",
  GH: "com.gh",
  KE: "co.ke",
  MA: "ma",
  NG: "com.ng",
  SN: "sn",
  TN: "tn",
  TZ: "co.tz",
  UG: "co.ug",
};

export function jumiaDomainForCountry(countryCode?: string): string {
  if (!countryCode) return "com";
  const key = countryCode.toUpperCase();
  return COUNTRY_DOMAIN_MAP[key] ?? "com";
}

export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

function parseMoney(input: unknown): Money | undefined {
  if (input === null || input === undefined) return undefined;
  if (typeof input === "number" && Number.isFinite(input)) {
    return { value: input };
  }
  if (typeof input === "string") {
    const cleaned = input.replace(/[, ]+/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isNaN(parsed)) return { value: parsed };
    return undefined;
  }
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const valueCandidate =
      obj.value ??
      obj.amount ??
      obj.price ??
      obj.total ??
      obj.paid ??
      obj.subtotal;
    const parsed = parseMoney(valueCandidate);
    if (!parsed) return undefined;
    const currency = typeof obj.currency === "string" ? obj.currency : undefined;
    return { currency: currency ?? parsed.currency, value: parsed.value };
  }
  return undefined;
}

function normaliseShopName(parts: Array<string | null | undefined>): string | undefined {
  const filtered = parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  if (!filtered.length) return undefined;
  const seen = new Set<string>();
  for (const part of filtered) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    return part;
  }
  return filtered[0] ?? undefined;
}

function extractProductId(candidate: unknown): string | undefined {
  if (candidate === null || candidate === undefined) return undefined;
  const str = String(candidate);
  const digits = str.match(/\d+/g);
  if (!digits || digits.length === 0) return undefined;
  return digits.join("");
}

function buildProductUrl(opts: {
  countryCode?: string;
  productUrlSuffix?: string;
  productName?: string;
  productId?: string;
}): string | undefined {
  if (opts.productUrlSuffix) {
    const suffix = opts.productUrlSuffix.startsWith("/")
      ? opts.productUrlSuffix.slice(1)
      : opts.productUrlSuffix;
    const base = `https://www.jumia.${jumiaDomainForCountry(opts.countryCode)}`;
    return `${base}/${suffix}`;
  }

  if (!opts.productName) return undefined;
  const slug = slugifyProductName(opts.productName);
  if (!slug) return undefined;
  const parts = [slug];
  if (opts.productId) parts.push(opts.productId);
  const base = `https://www.jumia.${jumiaDomainForCountry(opts.countryCode)}`;
  return `${base}/${parts.join("-")}.html`;
}

export type ItemsAggregate = {
  totalAmountLocal?: Money;
  primaryProductUrl?: string;
  primaryProductName?: string;
};

export function aggregateItemsDetails(
  items: Array<Record<string, unknown>>,
  opts: { countryCode?: string } = {},
): ItemsAggregate {
  let totalValue = 0;
  let totalCurrency: string | undefined;
  let productUrl: string | undefined;
  let productName: string | undefined;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const product = (item.product ?? {}) as Record<string, unknown>;

    if (!productName) {
      const candidate =
        (typeof product.name === "string" && product.name) ||
        (typeof item.productName === "string" && item.productName) ||
        (typeof item.name === "string" && item.name) ||
        (typeof item.title === "string" && item.title);
      if (candidate) productName = candidate;
    }

    if (!productUrl) {
      const candidateUrl =
        (typeof item.productUrl === "string" && item.productUrl) ||
        (typeof (item as any).product_url === "string" && (item as any).product_url) ||
        (typeof item.url === "string" && item.url) ||
        (typeof item.link === "string" && item.link) ||
        (typeof product.url === "string" && product.url) ||
        (typeof product.productUrl === "string" && product.productUrl) ||
        (typeof product.shareUrl === "string" && product.shareUrl) ||
        (typeof (product as any).product_url === "string" && (product as any).product_url) ||
        (typeof (product as any).link === "string" && (product as any).link);
      if (candidateUrl && /^https?:\/\//i.test(candidateUrl)) {
        productUrl = candidateUrl;
      } else {
        const productUrlSuffix =
          (typeof candidateUrl === "string" && candidateUrl) ||
          (typeof product.productUrlSuffix === "string" && product.productUrlSuffix) ||
          (typeof (product as any).urlSuffix === "string" && (product as any).urlSuffix);
        if (productUrlSuffix) {
          productUrl = buildProductUrl({
            countryCode: opts.countryCode,
            productUrlSuffix,
          });
        } else {
          const productId =
            extractProductId(product.id) ??
            extractProductId(item.productId) ??
            extractProductId((product as any).productId) ??
            extractProductId(item.masterProductId) ??
            extractProductId((product as any).productSid) ??
            extractProductId(item.productSid) ??
            extractProductId(item.skuId) ??
            extractProductId(productName);
          const built = buildProductUrl({
            countryCode: opts.countryCode,
            productName,
            productId,
          });
          if (built) productUrl = built;
        }
      }
    }

    const quantity = Number.parseFloat(String(item.quantity ?? item.qty ?? 1));
    const resolvedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    const moneySource =
      item.totalAmountLocal ??
      item.totalPriceLocal ??
      item.subtotalLocal ??
      item.paidPriceLocal ??
      item.itemPriceLocal ??
      item.paidPrice ??
      item.itemPrice ??
      product.priceLocal ??
      product.price;

    const parsedMoney = parseMoney(moneySource);
    if (parsedMoney && Number.isFinite(parsedMoney.value)) {
      const value =
        moneySource === item.totalAmountLocal ||
        moneySource === item.totalPriceLocal ||
        moneySource === item.subtotalLocal
          ? parsedMoney.value
          : parsedMoney.value * resolvedQuantity;
      totalValue += value;
      if (!totalCurrency && parsedMoney.currency) {
        totalCurrency = parsedMoney.currency;
      }
    }
  }

  const result: ItemsAggregate = {};

  if (totalValue > 0) {
    result.totalAmountLocal = {
      currency: totalCurrency,
      value: Number(totalValue.toFixed(2)),
    };
  }
  if (productUrl) result.primaryProductUrl = productUrl;
  if (productName) result.primaryProductName = productName;
  return result;
}

export function cleanShopName(
  primary?: string | null,
  fallback?: string | null,
): string | undefined {
  return (
    normaliseShopName([primary, fallback]) ??
    primary ??
    fallback ??
    undefined
  );
}
