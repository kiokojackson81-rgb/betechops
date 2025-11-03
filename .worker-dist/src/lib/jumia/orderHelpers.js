"use strict";
// Keep helper types decoupled from UI row types to avoid tight coupling/errors in builds
Object.defineProperty(exports, "__esModule", { value: true });
exports.jumiaDomainForCountry = jumiaDomainForCountry;
exports.slugifyProductName = slugifyProductName;
exports.aggregateItemsDetails = aggregateItemsDetails;
exports.cleanShopName = cleanShopName;
const COUNTRY_DOMAIN_MAP = {
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
function jumiaDomainForCountry(countryCode) {
    var _a;
    if (!countryCode)
        return "com";
    const key = countryCode.toUpperCase();
    return (_a = COUNTRY_DOMAIN_MAP[key]) !== null && _a !== void 0 ? _a : "com";
}
function slugifyProductName(name) {
    return name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 200);
}
function parseMoney(input) {
    var _a, _b, _c, _d, _e;
    if (input === null || input === undefined)
        return undefined;
    if (typeof input === "number" && Number.isFinite(input)) {
        return { value: input };
    }
    if (typeof input === "string") {
        const cleaned = input.replace(/[, ]+/g, "");
        const parsed = Number.parseFloat(cleaned);
        if (!Number.isNaN(parsed))
            return { value: parsed };
        return undefined;
    }
    if (typeof input === "object") {
        const obj = input;
        const valueCandidate = (_e = (_d = (_c = (_b = (_a = obj.value) !== null && _a !== void 0 ? _a : obj.amount) !== null && _b !== void 0 ? _b : obj.price) !== null && _c !== void 0 ? _c : obj.total) !== null && _d !== void 0 ? _d : obj.paid) !== null && _e !== void 0 ? _e : obj.subtotal;
        const parsed = parseMoney(valueCandidate);
        if (!parsed)
            return undefined;
        const currency = typeof obj.currency === "string" ? obj.currency : undefined;
        return { currency: currency !== null && currency !== void 0 ? currency : parsed.currency, value: parsed.value };
    }
    return undefined;
}
function normaliseShopName(parts) {
    var _a;
    const filtered = parts
        .map((part) => (typeof part === "string" ? part.trim() : ""))
        .filter(Boolean);
    if (!filtered.length)
        return undefined;
    const seen = new Set();
    for (const part of filtered) {
        const key = part.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        return part;
    }
    return (_a = filtered[0]) !== null && _a !== void 0 ? _a : undefined;
}
function extractProductId(candidate) {
    if (candidate === null || candidate === undefined)
        return undefined;
    const str = String(candidate);
    const digits = str.match(/\d+/g);
    if (!digits || digits.length === 0)
        return undefined;
    return digits.join("");
}
function buildProductUrl(opts) {
    if (opts.productUrlSuffix) {
        const suffix = opts.productUrlSuffix.startsWith("/")
            ? opts.productUrlSuffix.slice(1)
            : opts.productUrlSuffix;
        const base = `https://www.jumia.${jumiaDomainForCountry(opts.countryCode)}`;
        return `${base}/${suffix}`;
    }
    if (!opts.productName)
        return undefined;
    const slug = slugifyProductName(opts.productName);
    if (!slug)
        return undefined;
    const parts = [slug];
    if (opts.productId)
        parts.push(opts.productId);
    const base = `https://www.jumia.${jumiaDomainForCountry(opts.countryCode)}`;
    return `${base}/${parts.join("-")}.html`;
}
function aggregateItemsDetails(items, opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    let totalValue = 0;
    let totalCurrency;
    let productUrl;
    let productName;
    for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== "object")
            continue;
        const item = rawItem;
        const product = ((_a = item.product) !== null && _a !== void 0 ? _a : {});
        if (!productName) {
            const candidate = (typeof product.name === "string" && product.name) ||
                (typeof item.productName === "string" && item.productName) ||
                (typeof item.name === "string" && item.name) ||
                (typeof item.title === "string" && item.title);
            if (candidate)
                productName = candidate;
        }
        if (!productUrl) {
            const candidateUrl = (typeof item.productUrl === "string" && item.productUrl) ||
                (typeof item.product_url === "string" && item.product_url) ||
                (typeof item.url === "string" && item.url) ||
                (typeof item.link === "string" && item.link) ||
                (typeof product.url === "string" && product.url) ||
                (typeof product.productUrl === "string" && product.productUrl) ||
                (typeof product.shareUrl === "string" && product.shareUrl) ||
                (typeof product.product_url === "string" && product.product_url) ||
                (typeof product.link === "string" && product.link);
            if (candidateUrl && /^https?:\/\//i.test(candidateUrl)) {
                productUrl = candidateUrl;
            }
            else {
                const productUrlSuffix = (typeof candidateUrl === "string" && candidateUrl) ||
                    (typeof product.productUrlSuffix === "string" && product.productUrlSuffix) ||
                    (typeof product.urlSuffix === "string" && product.urlSuffix);
                if (productUrlSuffix) {
                    productUrl = buildProductUrl({
                        countryCode: opts.countryCode,
                        productUrlSuffix,
                    });
                }
                else {
                    const productId = (_h = (_g = (_f = (_e = (_d = (_c = (_b = extractProductId(product.id)) !== null && _b !== void 0 ? _b : extractProductId(item.productId)) !== null && _c !== void 0 ? _c : extractProductId(product.productId)) !== null && _d !== void 0 ? _d : extractProductId(item.masterProductId)) !== null && _e !== void 0 ? _e : extractProductId(product.productSid)) !== null && _f !== void 0 ? _f : extractProductId(item.productSid)) !== null && _g !== void 0 ? _g : extractProductId(item.skuId)) !== null && _h !== void 0 ? _h : extractProductId(productName);
                    const built = buildProductUrl({
                        countryCode: opts.countryCode,
                        productName,
                        productId,
                    });
                    if (built)
                        productUrl = built;
                }
            }
        }
        const quantity = Number.parseFloat(String((_k = (_j = item.quantity) !== null && _j !== void 0 ? _j : item.qty) !== null && _k !== void 0 ? _k : 1));
        const resolvedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
        const moneySource = (_t = (_s = (_r = (_q = (_p = (_o = (_m = (_l = item.totalAmountLocal) !== null && _l !== void 0 ? _l : item.totalPriceLocal) !== null && _m !== void 0 ? _m : item.subtotalLocal) !== null && _o !== void 0 ? _o : item.paidPriceLocal) !== null && _p !== void 0 ? _p : item.itemPriceLocal) !== null && _q !== void 0 ? _q : item.paidPrice) !== null && _r !== void 0 ? _r : item.itemPrice) !== null && _s !== void 0 ? _s : product.priceLocal) !== null && _t !== void 0 ? _t : product.price;
        const parsedMoney = parseMoney(moneySource);
        if (parsedMoney && Number.isFinite(parsedMoney.value)) {
            const value = moneySource === item.totalAmountLocal ||
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
    const result = {};
    if (totalValue > 0) {
        result.totalAmountLocal = {
            currency: totalCurrency,
            value: Number(totalValue.toFixed(2)),
        };
    }
    if (productUrl)
        result.primaryProductUrl = productUrl;
    if (productName)
        result.primaryProductName = productName;
    return result;
}
function cleanShopName(primary, fallback) {
    var _a, _b, _c;
    return ((_c = (_b = (_a = normaliseShopName([primary, fallback])) !== null && _a !== void 0 ? _a : primary) !== null && _b !== void 0 ? _b : fallback) !== null && _c !== void 0 ? _c : undefined);
}
