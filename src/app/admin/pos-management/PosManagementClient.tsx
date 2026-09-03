"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";
import { findSimilarProducts } from "@/lib/posProductSimilarity";
import { showToast } from "@/lib/ui/toast";
import {
  getAcceptedImageUploadHint,
  getAcceptedImageUploadValue,
} from "@/lib/images/uploadImageFormat";
import ProductDescriptionEditor from "@/components/ProductDescriptionEditor";
import {
  PRODUCT_GALLERY_AI_HEIGHT,
  PRODUCT_GALLERY_AI_MAX_SOURCE_EDGE,
  PRODUCT_GALLERY_AI_SOURCE_TYPES,
  PRODUCT_GALLERY_AI_WIDTH,
} from "@/lib/images/productGalleryAi";
import {
  getShopSubcategoryOptions,
  isGeneralShopCategory,
  SHOP_CATEGORY_DEFINITIONS,
  SHOP_CATEGORY_OPTIONS,
  resolveShopSubcategory,
} from "@/app/shop/shopCatalogConfig";
import { getShopProductHref } from "@/app/shop/storefrontPaths";
import type { ProductCatalogueConfiguration } from "@/lib/productCataloguePolicy";

const PUBLIC_SHOP_ORIGIN = "https://www.betech.co.ke";

type PosProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: number;
  lastBuyingPrice?: number | null;
  defaultWarranty?: string | null;
  variableCost?: boolean;
  isActive: boolean;
  commissionEnabled: boolean;
  commissionAmount?: number | string | null;
  commissionRequiresApproval: boolean;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  specifications?: string[] | string | null;
  warrantyPeriod?: string | null;
  warrantyNotes?: string | null;
  mainImageUrl?: string | null;
  imageExtractedText?: string | null;
  galleryImageUrls?: string[] | null;
  brandImageUrl?: string | null;
  tiktokVideoUrl?: string | null;
  purchaseLink?: string | null;
  ecommerceVisible?: boolean | null;
  isFeatured?: boolean | null;
  status?: string | null;
  availabilityType?: "SHOP" | "WAREHOUSE" | string | null;
  pickupDelayDays?: number | null;
  showInShop?: boolean | null;
  shopCategory?: string | null;
  shopSubcategory?: string | null;
  shopShortDescription?: string | null;
  shopWarranty?: string | null;
  shopSpecs?: string | null;
  shopImageUrl?: string | null;
  shopBrand?: string | null;
  productType?: string | null;
  posEnabled?: boolean | null;
  catalogueConfiguration?: ProductCatalogueConfiguration | null;
};

type PosCatalogueCapabilities = {
  schemaMode: "modern" | "legacy";
  brand: boolean;
  shortDescription: boolean;
  description: boolean;
  specifications: boolean;
  warrantyPeriod: boolean;
  warrantyNotes: boolean;
  mainImageUrl: boolean;
  imageExtractedText: boolean;
  galleryImageUrls: boolean;
  brandImageUrl: boolean;
  tiktokVideoUrl: boolean;
  purchaseLink: boolean;
  ecommerceVisible: boolean;
  isFeatured: boolean;
  status: boolean;
  availabilityType: boolean;
  pickupDelayDays: boolean;
  productType: boolean;
  posEnabled: boolean;
  catalogueConfiguration: boolean;
  showInShop: boolean;
  shopCategory: boolean;
  shopSubcategory: boolean;
  shopShortDescription: boolean;
  shopWarranty: boolean;
  shopSpecs: boolean;
  shopImageUrl: boolean;
  shopBrand: boolean;
  warranty: boolean;
  specs: boolean;
};

type ProductAvailabilityType =
  "SHOP" | "WAREHOUSE" | "ORDER_ON_REQUEST" | "OUT_OF_STOCK";
type CatalogView =
  "all" | "online" | "featured" | "warehouse" | "inactive" | "incomplete";
type FulfilmentSetupFilter = "all" | "complete" | "incomplete";
type InstallationFilter =
  "all" | "required" | "included" | "not-included" | "not-required";
type TransportFilter = "all" | "included" | "zone-fees" | "missing-fees";

type CommissionApproval = {
  id: string;
  amount: number | string;
  status: string;
  createdAt: string;
  staff?: { name?: string | null; email?: string | null } | null;
  orderItem?: {
    product?: { name?: string | null; sku?: string | null } | null;
    order?: {
      orderNumber?: string | null;
      customerName?: string | null;
    } | null;
  } | null;
};

type ProductDraft = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: string;
  lastBuyingPrice: string;
  variableCost: boolean;
  isActive: boolean;
  commissionEnabled: boolean;
  commissionAmount: string;
  commissionRequiresApproval: boolean;
  brand: string;
  shortDescription: string;
  description: string;
  specifications: string;
  warrantyPeriod: string;
  warrantyNotes: string;
  mainImageUrl: string;
  imageExtractedText: string;
  galleryImageUrls: string[];
  brandImageUrl: string;
  tiktokVideoUrl: string;
  purchaseLink: string;
  ecommerceVisible: boolean;
  isFeatured: boolean;
  status: "ACTIVE" | "INACTIVE";
  availabilityType: ProductAvailabilityType;
  pickupDelayDays: number;
  showInShop: boolean;
  shopCategory: string;
  shopSubcategory: string;
  shopShortDescription: string;
  shopWarranty: string;
  shopSpecs: string;
  shopImageUrl: string;
  shopBrand: string;
  productType: string;
  posEnabled: boolean;
  policyConfigured: boolean;
  catalogueConfiguration: ProductCatalogueConfiguration;
};

type AiProductPrefill = {
  name: string;
  brand: string;
  sellingPrice: number | null;
  warrantyPeriod: string;
  shortDescription: string;
  description: string;
  specifications: string[];
};

type BrandOption = {
  name: string;
};

type PosManagementClientProps = {
  mode?: "admin" | "product-desk";
  initialEditProductId?: string | null;
  activityOwnerId?: string | null;
};

const emptyDraft: ProductDraft = {
  sku: "",
  name: "",
  category: "pos",
  sellingPrice: "",
  lastBuyingPrice: "",
  variableCost: false,
  isActive: true,
  commissionEnabled: false,
  commissionAmount: "",
  commissionRequiresApproval: false,
  brand: "",
  shortDescription: "",
  description: "",
  specifications: "",
  warrantyPeriod: "No warranty",
  warrantyNotes: "",
  mainImageUrl: "",
  imageExtractedText: "",
  galleryImageUrls: [],
  brandImageUrl: "",
  tiktokVideoUrl: "https://www.tiktok.com/@betechsolarsolutionske",
  purchaseLink: "",
  ecommerceVisible: true,
  isFeatured: false,
  status: "ACTIVE",
  availabilityType: "SHOP",
  pickupDelayDays: 0,
  showInShop: true,
  shopCategory: "",
  shopSubcategory: "",
  shopShortDescription: "",
  shopWarranty: "",
  shopSpecs: "",
  shopImageUrl: "",
  shopBrand: "",
  productType: "",
  posEnabled: true,
  policyConfigured: true,
  catalogueConfiguration: {
    installationType: "NOT_REQUIRED",
    installationFeeMode: "UNAVAILABLE",
    customInstallationFee: null,
    accessoriesMode: "NOT_INCLUDED",
    preliminaryAccessoriesFee: null,
    includedAccessories: "",
    installationNotes: "",
    transportMode: "ZONE",
    useDefaultTransportRates: false,
    zone1TransportFee: 3000,
    zone2TransportFee: 7500,
    zone3TransportFee: 15000,
    priceIncludes: ["EQUIPMENT"],
    allInclusive: false,
    allInclusiveItems: [],
    structuredSpecifications: [],
    componentWarranties: [],
    projectImageUrls: [],
    requiresSiteAssessment: false,
  },
};

function createDraftDefaults(): ProductDraft {
  return {
    ...emptyDraft,
    ecommerceVisible: true,
    showInShop: true,
  };
}

const defaultCapabilities: PosCatalogueCapabilities = {
  schemaMode: "legacy",
  brand: false,
  shortDescription: false,
  description: false,
  specifications: false,
  warrantyPeriod: false,
  warrantyNotes: false,
  mainImageUrl: false,
  imageExtractedText: false,
  galleryImageUrls: false,
  brandImageUrl: false,
  tiktokVideoUrl: false,
  purchaseLink: false,
  ecommerceVisible: false,
  isFeatured: false,
  status: false,
  availabilityType: false,
  pickupDelayDays: false,
  productType: false,
  posEnabled: false,
  catalogueConfiguration: false,
  showInShop: false,
  shopCategory: false,
  shopSubcategory: false,
  shopShortDescription: false,
  shopWarranty: false,
  shopSpecs: false,
  shopImageUrl: false,
  shopBrand: false,
  warranty: false,
  specs: false,
};

const fieldClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";

const warrantyOptions = [
  "No warranty",
  "1 year",
  "2 years",
  "3 years",
  "5 years",
  "6 years",
  "10 years",
  "15 years",
  "25 years",
];

function normalizeAvailabilityType(
  value: string | null | undefined,
): ProductAvailabilityType {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (
    normalized === "WAREHOUSE" ||
    normalized === "ORDER_ON_REQUEST" ||
    normalized === "OUT_OF_STOCK"
  )
    return normalized;
  return "SHOP";
}

function getAvailabilityPreviewMessage(type: ProductAvailabilityType) {
  if (type === "WAREHOUSE")
    return "Customer will see: Available from warehouse. Pickup or delivery available after 1 day.";
  if (type === "ORDER_ON_REQUEST")
    return "Customer will see: Order on request. Our team will confirm availability.";
  if (type === "OUT_OF_STOCK") return "Customer will see: Out of stock.";
  return "Customer will see: Available for same-day shop pickup and delivery.";
}

function hasProductWebsiteImage(
  product:
    | Pick<PosProduct, "mainImageUrl" | "shopImageUrl">
    | Pick<ProductDraft, "mainImageUrl" | "shopImageUrl">,
) {
  return Boolean(
    String(product.mainImageUrl || product.shopImageUrl || "").trim(),
  );
}

function detectShopCategoryAndSubcategory(
  input: Pick<
    ProductDraft,
    "name" | "category" | "brand" | "specifications" | "shopCategory"
  >,
) {
  const haystack = [
    input.name,
    input.category,
    input.brand,
    input.specifications,
  ]
    .join(" ")
    .toLowerCase();
  const directCategory =
    SHOP_CATEGORY_DEFINITIONS.find((category) =>
      category.keywords.some((keyword) =>
        haystack.includes(keyword.toLowerCase()),
      ),
    ) ??
    SHOP_CATEGORY_DEFINITIONS.find(
      (category) => category.value === input.shopCategory,
    );

  if (!directCategory) {
    return { shopCategory: "", shopSubcategory: "" };
  }

  const subcategory =
    resolveShopSubcategory(directCategory.value, [
      input.name,
      input.category,
      input.brand,
      input.specifications,
    ]) ?? null;

  return {
    shopCategory: directCategory.value,
    shopSubcategory: subcategory?.value ?? "",
  };
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry || "").trim())
          .filter(Boolean);
      }
    } catch {
      return trimmed
        .split(/\r?\n|[,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function createDraftFromProduct(product: PosProduct): ProductDraft {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    sellingPrice: String(product.sellingPrice ?? ""),
    lastBuyingPrice:
      product.lastBuyingPrice == null ? "" : String(product.lastBuyingPrice),
    variableCost: Boolean(product.variableCost),
    isActive: Boolean(product.isActive),
    commissionEnabled: Boolean(product.commissionEnabled),
    commissionAmount:
      product.commissionAmount == null ? "" : String(product.commissionAmount),
    commissionRequiresApproval: Boolean(product.commissionRequiresApproval),
    brand: product.brand ?? product.shopBrand ?? "",
    shortDescription:
      product.shortDescription ?? product.shopShortDescription ?? "",
    description: product.description ?? "",
    specifications: Array.isArray(product.specifications)
      ? product.specifications.join("\n")
      : String(product.specifications ?? product.shopSpecs ?? ""),
    warrantyPeriod: product.warrantyPeriod ?? product.shopWarranty ?? "",
    warrantyNotes: product.warrantyNotes ?? "",
    mainImageUrl: product.mainImageUrl ?? product.shopImageUrl ?? "",
    imageExtractedText: product.imageExtractedText ?? "",
    galleryImageUrls: parseStringArray(product.galleryImageUrls),
    brandImageUrl: product.brandImageUrl ?? "",
    tiktokVideoUrl: product.tiktokVideoUrl ?? "",
    purchaseLink: product.purchaseLink ?? "",
    ecommerceVisible: Boolean(product.ecommerceVisible ?? product.showInShop),
    isFeatured: Boolean(product.isFeatured),
    status:
      String(
        product.status || (product.isActive ? "ACTIVE" : "INACTIVE"),
      ).toUpperCase() === "INACTIVE"
        ? "INACTIVE"
        : "ACTIVE",
    availabilityType: normalizeAvailabilityType(product.availabilityType),
    pickupDelayDays:
      normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE"
        ? 1
        : 0,
    showInShop: Boolean(product.showInShop),
    shopCategory: product.shopCategory ?? "",
    shopSubcategory: product.shopSubcategory ?? "",
    shopShortDescription: product.shopShortDescription ?? "",
    shopWarranty: product.shopWarranty ?? "",
    shopSpecs: product.shopSpecs ?? "",
    shopImageUrl: product.shopImageUrl ?? "",
    shopBrand: product.shopBrand ?? "",
    productType: product.productType ?? "",
    posEnabled: product.posEnabled !== false,
    policyConfigured: true,
    catalogueConfiguration:
      product.catalogueConfiguration ?? emptyDraft.catalogueConfiguration,
  };
}

function getFulfilmentSetup(product: PosProduct) {
  const policy = product.catalogueConfiguration;
  if (!policy) {
    return {
      complete: false,
      installationRequired: false,
      installationIncluded: false,
      transportIncluded: false,
      zoneFeesConfigured: false,
    };
  }

  const installationRequired =
    policy.installationType !== "NOT_REQUIRED" &&
    policy.installationFeeMode !== "UNAVAILABLE";
  const installationIncluded =
    installationRequired &&
    (policy.installationType === "INCLUDED" ||
      policy.installationFeeMode === "INCLUDED" ||
      policy.priceIncludes.includes("INSTALLATION"));
  const installationConfigured =
    policy.installationFeeMode !== "CUSTOM" ||
    policy.customInstallationFee != null;
  const transportIncluded =
    policy.transportMode === "INCLUDED" ||
    policy.transportMode === "FREE" ||
    policy.priceIncludes.includes("TRANSPORT");
  const zoneFeesConfigured =
    policy.transportMode === "ZONE" &&
    [
      policy.zone1TransportFee,
      policy.zone2TransportFee,
      policy.zone3TransportFee,
    ].every(
      (fee) => typeof fee === "number" && Number.isFinite(fee) && fee >= 0,
    );

  return {
    complete:
      installationConfigured && (transportIncluded || zoneFeesConfigured),
    installationRequired,
    installationIncluded,
    transportIncluded,
    zoneFeesConfigured,
  };
}

function slugifyShopProductName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `KES ${Number.isFinite(amount) ? amount.toLocaleString("en-KE", { maximumFractionDigits: 0 }) : "0"}`;
}

function getApiErrorMessage(json: unknown, fallback: string) {
  if (!json || typeof json !== "object") return fallback;

  const error = (json as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;

  if (error && typeof error === "object") {
    const formErrors = Array.isArray(
      (error as { formErrors?: unknown }).formErrors,
    )
      ? (error as { formErrors: unknown[] }).formErrors.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
    const fieldErrorsRaw = (error as { fieldErrors?: Record<string, unknown> })
      .fieldErrors;
    const fieldErrors =
      fieldErrorsRaw && typeof fieldErrorsRaw === "object"
        ? Object.entries(fieldErrorsRaw).flatMap(([field, value]) =>
            Array.isArray(value)
              ? value
                  .filter(
                    (item): item is string =>
                      typeof item === "string" && item.trim().length > 0,
                  )
                  .map((message) => `${field}: ${message}`)
              : [],
          )
        : [];
    const combined = [...formErrors, ...fieldErrors];
    if (combined.length) return combined.join(". ");
  }

  return fallback;
}

export default function PosManagementClient({
  mode = "admin",
  initialEditProductId = null,
  activityOwnerId = null,
}: PosManagementClientProps) {
  const isProductDeskMode = mode === "product-desk";
  const canManagePricing = !isProductDeskMode;
  const canManageCommissions = false;
  const canDeleteProducts = !isProductDeskMode;
  const canUseBulkActions = !isProductDeskMode;
  const canManageFeaturedStatus = !isProductDeskMode;
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [capabilities, setCapabilities] =
    useState<PosCatalogueCapabilities>(defaultCapabilities);
  const [approvals, setApprovals] = useState<CommissionApproval[]>([]);
  const [releasedApprovals, setReleasedApprovals] = useState<
    CommissionApproval[]
  >([]);
  const [draft, setDraft] = useState<ProductDraft>(() => createDraftDefaults());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<
    "main" | "gallery" | "brand" | null
  >(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAction, setAiAction] = useState<
    "prefill" | "redesign" | "both" | null
  >(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [pendingMainImageFile, setPendingMainImageFile] = useState<File | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<
    "activate" | "archive" | "delete" | null
  >(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [catalogView, setCatalogView] = useState<CatalogView>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [buyingPriceFilter, setBuyingPriceFilter] = useState<
    "all" | "missing" | "set"
  >("all");
  const [commissionFilter, setCommissionFilter] = useState<
    "all" | "enabled" | "disabled"
  >("all");
  const [warrantyFilter, setWarrantyFilter] = useState<
    "all" | "with" | "without"
  >("all");
  const [fulfilmentSetupFilter, setFulfilmentSetupFilter] =
    useState<FulfilmentSetupFilter>("all");
  const [installationFilter, setInstallationFilter] =
    useState<InstallationFilter>("all");
  const [transportFilter, setTransportFilter] =
    useState<TransportFilter>("all");
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerQuery, setCategoryPickerQuery] = useState("");
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const initialEditHandledRef = useRef(false);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const catalogueTableRef = useRef<HTMLDivElement | null>(null);
  const brandBoxRef = useRef<HTMLDivElement | null>(null);
  const productApiBase = "/api/admin/pos-products";
  const imageUploadAccept = getAcceptedImageUploadValue();
  const imageUploadFormats = getAcceptedImageUploadHint();

  useEffect(() => {
    if (!editorOpen) return;
    const previous = document.body.style.overflow;
    document.body.classList.add("product-editor-open");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.classList.remove("product-editor-open");
      document.body.style.overflow = previous;
    };
  }, [editorOpen]);

  const loadData = useCallback(
    async (productQuery = activeQuery) => {
      setLoading(true);
      try {
        const requests = [
          fetch(
            `${productApiBase}?q=${encodeURIComponent(productQuery)}&includeInactive=${showInactive ? "1" : "0"}&limit=200`,
            { cache: "no-store" },
          ),
          ...(isProductDeskMode
            ? []
            : [
                fetch(`/api/admin/pos-commissions?status=pending&limit=100`, {
                  cache: "no-store",
                }),
                fetch(`/api/admin/pos-commissions?status=released&limit=100`, {
                  cache: "no-store",
                }),
              ]),
        ];
        const responses = await Promise.all(requests);
        const productsRes = responses[0]!;
        const approvalsRes = isProductDeskMode ? null : (responses[1] ?? null);
        const releasedRes = isProductDeskMode ? null : (responses[2] ?? null);

        const productsJson = await productsRes
          .json()
          .catch(() => ({ items: [], capabilities: defaultCapabilities }));
        const approvalsJson = approvalsRes
          ? await approvalsRes.json().catch(() => ({ items: [] }))
          : { items: [] };
        const releasedJson = releasedRes
          ? await releasedRes.json().catch(() => ({ items: [] }))
          : { items: [] };
        setProducts(
          Array.isArray(productsJson.items) ? productsJson.items : [],
        );
        setCapabilities(
          productsJson.capabilities &&
            typeof productsJson.capabilities === "object"
            ? productsJson.capabilities
            : defaultCapabilities,
        );
        setApprovals(
          Array.isArray(approvalsJson.items) ? approvalsJson.items : [],
        );
        setReleasedApprovals(
          Array.isArray(releasedJson?.items) ? releasedJson.items : [],
        );
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : "Failed to load POS management data",
          "error",
        );
      } finally {
        setLoading(false);
      }
    },
    [activeQuery, isProductDeskMode, productApiBase, showInactive],
  );

  useEffect(() => {
    void loadData(activeQuery);
  }, [activeQuery, loadData]);

  useEffect(() => {
    if (!activeQuery) return;
    catalogueTableRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeQuery]);

  useEffect(() => {
    if (!draft.id) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [draft.id]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next: Record<string, boolean> = {};
      for (const product of products) {
        if (current[product.id]) next[product.id] = true;
      }
      return next;
    });
  }, [products]);

  useEffect(() => {
    if (!editorOpen || !(capabilities.brand || capabilities.shopBrand)) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setBrandLoading(true);
      try {
        const response = await fetch(
          `/api/admin/brands?search=${encodeURIComponent(draft.brand)}&limit=12`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const json = await response.json().catch(() => ({ items: [] }));
        if (!response.ok)
          throw new Error(getApiErrorMessage(json, "Failed to load brands"));

        const items = Array.isArray(json?.items)
          ? json.items
              .filter(
                (item): item is string =>
                  typeof item === "string" && item.trim().length > 0,
              )
              .map((name) => ({ name }))
          : [];
        setBrandOptions(items);
      } catch {
        if (!controller.signal.aborted) setBrandOptions([]);
      } finally {
        if (!controller.signal.aborted) setBrandLoading(false);
      }
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [capabilities.brand, capabilities.shopBrand, draft.brand, editorOpen]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!brandBoxRef.current?.contains(event.target as Node)) {
        setBrandOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const filteredProducts = products.filter((product) => {
    const hasBuyingPrice = Number(product.lastBuyingPrice ?? 0) > 0;
    const hasWarranty = Boolean(
      (product.warrantyPeriod ?? product.shopWarranty)?.trim(),
    );
    const visibleInShop = Boolean(
      product.ecommerceVisible ?? product.showInShop,
    );
    const featuredInShop = Boolean(product.isFeatured);
    const warehouseOnly =
      normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE";
    const inactive = !product.isActive;
    const fulfilment = getFulfilmentSetup(product);

    if (buyingPriceFilter === "missing" && hasBuyingPrice) return false;
    if (buyingPriceFilter === "set" && !hasBuyingPrice) return false;
    if (commissionFilter === "enabled" && !product.commissionEnabled)
      return false;
    if (commissionFilter === "disabled" && product.commissionEnabled)
      return false;
    if (warrantyFilter === "with" && !hasWarranty) return false;
    if (warrantyFilter === "without" && hasWarranty) return false;
    if (fulfilmentSetupFilter === "complete" && !fulfilment.complete)
      return false;
    if (fulfilmentSetupFilter === "incomplete" && fulfilment.complete)
      return false;
    if (installationFilter === "required" && !fulfilment.installationRequired)
      return false;
    if (installationFilter === "included" && !fulfilment.installationIncluded)
      return false;
    if (
      installationFilter === "not-included" &&
      (!fulfilment.installationRequired || fulfilment.installationIncluded)
    )
      return false;
    if (
      installationFilter === "not-required" &&
      (fulfilment.installationRequired || !product.catalogueConfiguration)
    )
      return false;
    if (transportFilter === "included" && !fulfilment.transportIncluded)
      return false;
    if (transportFilter === "zone-fees" && !fulfilment.zoneFeesConfigured)
      return false;
    if (
      transportFilter === "missing-fees" &&
      (fulfilment.transportIncluded || fulfilment.zoneFeesConfigured)
    )
      return false;
    if (catalogView === "online" && !visibleInShop) return false;
    if (catalogView === "featured" && !featuredInShop) return false;
    if (catalogView === "warehouse" && !warehouseOnly) return false;
    if (catalogView === "inactive" && !inactive) return false;
    if (catalogView === "incomplete" && fulfilment.complete) return false;
    return true;
  });
  const catalogStats = useMemo(() => {
    const total = products.length;
    const online = products.filter((product) =>
      Boolean(product.ecommerceVisible ?? product.showInShop),
    ).length;
    const featured = products.filter((product) =>
      Boolean(product.isFeatured),
    ).length;
    const warehouse = products.filter(
      (product) =>
        normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE",
    ).length;
    const inactive = products.filter((product) => !product.isActive).length;
    const incomplete = products.filter(
      (product) => !getFulfilmentSetup(product).complete,
    ).length;
    return { total, online, featured, warehouse, inactive, incomplete };
  }, [products]);

  useEffect(() => {
    if (initialEditHandledRef.current) return;
    const targetId = String(initialEditProductId ?? "").trim();
    if (!targetId || loading || !products.length) return;
    const matched = products.find((product) => product.id === targetId);
    if (!matched) return;
    initialEditHandledRef.current = true;
    startEdit(matched);
  }, [initialEditProductId, loading, products]);

  const duplicateMatches = useMemo(
    () =>
      findSimilarProducts(
        draft.name,
        products.filter((product) => product.id !== draft.id),
      ),
    [draft.id, draft.name, products],
  );
  const shopSubcategoryOptions = useMemo(
    () => getShopSubcategoryOptions(draft.shopCategory),
    [draft.shopCategory],
  );
  const pickerCategoryDefinition = useMemo(
    () =>
      SHOP_CATEGORY_DEFINITIONS.find(
        (category) => category.value === pickerCategory,
      ) ?? null,
    [pickerCategory],
  );
  const categoryPickerResults = useMemo(() => {
    const query = categoryPickerQuery.trim().toLowerCase();
    if (!query) return SHOP_CATEGORY_DEFINITIONS;
    return SHOP_CATEGORY_DEFINITIONS.filter((category) =>
      [
        category.label,
        ...category.subcategories.flatMap((subcategory) => [
          subcategory.label,
          ...(subcategory.productTypes || []).map((productType) =>
            productType.label,
          ),
        ]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [categoryPickerQuery]);
  const availabilityPreview = useMemo(
    () => getAvailabilityPreviewMessage(draft.availabilityType),
    [draft.availabilityType],
  );
  const normalizedDraftBrand = useMemo(
    () => draft.brand.replace(/\s+/g, " ").trim(),
    [draft.brand],
  );
  const exactBrandMatch = useMemo(
    () =>
      brandOptions.find(
        (option) =>
          option.name.trim().toLowerCase() ===
          normalizedDraftBrand.toLowerCase(),
      ) ?? null,
    [brandOptions, normalizedDraftBrand],
  );
  const canAddBrand = Boolean(normalizedDraftBrand) && !exactBrandMatch;
  const draftWebsiteImageReady = hasProductWebsiteImage(draft);
  const draftWebsiteEligible = draftWebsiteImageReady;
  const suggestedShopTaxonomy = useMemo(
    () =>
      detectShopCategoryAndSubcategory({
        name: draft.name,
        category: draft.category,
        brand: draft.brand,
        specifications: draft.specifications,
        shopCategory: draft.shopCategory,
      }),
    [
      draft.brand,
      draft.category,
      draft.name,
      draft.shopCategory,
      draft.specifications,
    ],
  );

  const uploadProductImage = useCallback(
    async (file: File, kind: "main" | "gallery" | "brand") => {
      setUploadingKind(kind);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", kind);
        form.append(
          "productId",
          draft.id || draft.sku || draft.name || "draft",
        );
        const res = await fetch(`${productApiBase}/upload`, {
          method: "POST",
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(getApiErrorMessage(json, "Failed to upload image"));
        const url = typeof json?.url === "string" ? json.url : "";
        if (!url) throw new Error("Upload did not return a file URL");
        return url;
      } finally {
        setUploadingKind(null);
      }
    },
    [draft.id, draft.name, draft.sku, productApiBase],
  );

  const decodeBase64Image = useCallback(
    (imageBase64: string, mimeType: string) => {
      const binary = window.atob(imageBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return new Blob([bytes], { type: mimeType });
    },
    [],
  );

  const loadImageElement = useCallback((blob: Blob) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to load image"));
      };
      image.src = objectUrl;
    });
  }, []);

  const normalizeSourceImageForAi = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
        throw new Error(
          "AI redesign currently supports JPG, PNG, or WebP source images",
        );
      }

      const preferredMimeType = PRODUCT_GALLERY_AI_SOURCE_TYPES.has(file.type)
        ? file.type
        : "image/jpeg";
      const sourceImage = await loadImageElement(file);
      const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
      const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
      const longestEdge = Math.max(sourceWidth, sourceHeight);
      const scale =
        longestEdge > PRODUCT_GALLERY_AI_MAX_SOURCE_EDGE
          ? PRODUCT_GALLERY_AI_MAX_SOURCE_EDGE / longestEdge
          : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser image conversion is unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

      const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (!result) {
              reject(new Error("Failed to convert image for AI redesign"));
              return;
            }
            resolve(result);
          },
          preferredMimeType,
          preferredMimeType === "image/jpeg" ? 0.9 : undefined,
        );
      });

      const normalizedName =
        file.name.replace(/\.[^.]+$/, "") || "product-image";
      const normalizedExtension =
        preferredMimeType === "image/png"
          ? "png"
          : preferredMimeType === "image/webp"
            ? "webp"
            : "jpg";
      return new File(
        [normalizedBlob],
        `${normalizedName}.${normalizedExtension}`,
        { type: preferredMimeType },
      );
    },
    [loadImageElement],
  );

  const resizeAiProductGalleryImage = useCallback(
    async (blob: Blob) => {
      const sourceImage = await loadImageElement(blob);
      const canvas = document.createElement("canvas");
      canvas.width = PRODUCT_GALLERY_AI_WIDTH;
      canvas.height = PRODUCT_GALLERY_AI_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser canvas is unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
      const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
      const targetAspect = PRODUCT_GALLERY_AI_WIDTH / PRODUCT_GALLERY_AI_HEIGHT;
      const cropWidth = sourceWidth;
      const cropHeight = Math.min(
        sourceHeight,
        Math.round(sourceWidth / targetAspect),
      );
      const cropX = 0;
      const cropY = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));

      // Crop only the excess top/bottom from the OpenAI edit size so the wide composition fills the frame.
      context.drawImage(
        sourceImage,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        PRODUCT_GALLERY_AI_WIDTH,
        PRODUCT_GALLERY_AI_HEIGHT,
      );

      const resizedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Failed to build the website gallery image"));
            return;
          }
          resolve(result);
        }, "image/png");
      });

      return new File([resizedBlob], "website-gallery-wide.png", {
        type: "image/png",
      });
    },
    [loadImageElement],
  );

  const openCreateEditor = useCallback(() => {
    setDraft(createDraftDefaults());
    setEditorOpen(true);
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const applySuggestedShopTaxonomy = useCallback(() => {
    setDraft((current) => ({
      ...current,
      shopCategory: suggestedShopTaxonomy.shopCategory || current.shopCategory,
      shopSubcategory: suggestedShopTaxonomy.shopSubcategory,
    }));
  }, [
    suggestedShopTaxonomy.shopCategory,
    suggestedShopTaxonomy.shopSubcategory,
  ]);

  const applyBrandValue = useCallback((brandName: string) => {
    setDraft((current) => ({
      ...current,
      brand: brandName,
      shopBrand: brandName,
    }));
    setBrandOpen(false);
  }, []);

  const createBrandOption = useCallback(async () => {
    if (!canAddBrand) return;
    setBrandSaving(true);
    try {
      const response = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedDraftBrand }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(getApiErrorMessage(json, "Failed to add brand"));

      const nextBrand =
        typeof json?.item?.name === "string"
          ? json.item.name.trim()
          : normalizedDraftBrand;
      applyBrandValue(nextBrand);
      setBrandOptions((current) => {
        const items = [...current, { name: nextBrand }];
        const deduped = new Map<string, BrandOption>();
        for (const item of items) {
          const key = item.name.trim().toLowerCase();
          if (!deduped.has(key)) deduped.set(key, item);
        }
        return Array.from(deduped.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      });
      showToast(`Brand ready: ${nextBrand}`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add brand",
        "error",
      );
    } finally {
      setBrandSaving(false);
    }
  }, [applyBrandValue, canAddBrand, normalizedDraftBrand]);

  const persistImageFields = useCallback(
    async (
      patch: Partial<
        Pick<
          ProductDraft,
          "mainImageUrl" | "galleryImageUrls" | "brandImageUrl" | "shopImageUrl"
        >
      >,
    ) => {
      if (!draft.id) return;

      const payload: Record<string, unknown> = {};
      if (patch.mainImageUrl !== undefined && capabilities.mainImageUrl) {
        payload.mainImageUrl = patch.mainImageUrl.trim() || null;
      }
      if (
        patch.galleryImageUrls !== undefined &&
        capabilities.galleryImageUrls
      ) {
        payload.galleryImageUrls = patch.galleryImageUrls;
      }
      if (patch.brandImageUrl !== undefined && capabilities.brandImageUrl) {
        payload.brandImageUrl = patch.brandImageUrl.trim() || null;
      }
      if (patch.shopImageUrl !== undefined && capabilities.shopImageUrl) {
        payload.shopImageUrl = patch.shopImageUrl.trim() || null;
      }
      if (!Object.keys(payload).length) return;

      const res = await fetch(`${productApiBase}/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          getApiErrorMessage(json, "Failed to save image changes"),
        );
      await loadData(query);
    },
    [
      capabilities.brandImageUrl,
      capabilities.galleryImageUrls,
      capabilities.mainImageUrl,
      capabilities.shopImageUrl,
      draft.id,
      loadData,
      productApiBase,
      query,
    ],
  );

  const uploadPendingMainImage = useCallback(async () => {
    if (!pendingMainImageFile) {
      showToast("Choose an image first", "error");
      return;
    }

    try {
      const url = await uploadProductImage(pendingMainImageFile, "main");
      setDraft((current) => ({
        ...current,
        mainImageUrl: url,
        shopImageUrl: url,
      }));
      await persistImageFields({ mainImageUrl: url, shopImageUrl: url });
      setPendingMainImageFile(null);
      showToast("Main image uploaded", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to upload main image",
        "error",
      );
    }
  }, [pendingMainImageFile, persistImageFields, uploadProductImage]);

  const applyAiPrefill = useCallback((product: AiProductPrefill) => {
    setDraft((current) => {
      const nextBrand = product.brand.trim();
      const nextName = product.name.trim() || current.name;
      const nextWarranty = product.warrantyPeriod.trim();
      const nextShortDescription = product.shortDescription.trim();
      const nextDescription = product.description.trim();
      const nextRichDescription = nextShortDescription || nextDescription;
      const nextSpecifications = Array.isArray(product.specifications)
        ? product.specifications
            .map((item) => item.trim())
            .filter(Boolean)
            .join("\n")
        : "";
      const nextShopTaxonomy = detectShopCategoryAndSubcategory({
        name: nextName,
        category: current.category,
        brand: nextBrand || current.brand,
        specifications: nextSpecifications || current.specifications,
        shopCategory: current.shopCategory,
      });
      const nextSellingPrice =
        typeof product.sellingPrice === "number" &&
        Number.isFinite(product.sellingPrice) &&
        product.sellingPrice > 0
          ? String(Math.round(product.sellingPrice))
          : current.sellingPrice;

      return {
        ...current,
        name: nextName,
        brand: nextBrand || current.brand,
        shopBrand: nextBrand || current.shopBrand,
        sellingPrice: nextSellingPrice,
        warrantyPeriod: nextWarranty || current.warrantyPeriod,
        shopWarranty: nextWarranty || current.shopWarranty,
        shortDescription: nextRichDescription || current.shortDescription,
        shopShortDescription:
          nextRichDescription || current.shopShortDescription,
        description:
          nextDescription || nextRichDescription || current.description,
        specifications: nextSpecifications || current.specifications,
        shopSpecs: nextSpecifications || current.shopSpecs,
        shopCategory: nextShopTaxonomy.shopCategory || current.shopCategory,
        shopSubcategory:
          nextShopTaxonomy.shopSubcategory || current.shopSubcategory,
      };
    });
  }, []);

  const runAiOcrExtraction = useCallback(async () => {
    if (!capabilities.imageExtractedText) {
      showToast(
        "OCR text field is not available on this product schema yet",
        "error",
      );
      return;
    }
    if (!pendingMainImageFile && !draft.mainImageUrl.trim()) {
      showToast("Choose or upload a main image first", "error");
      return;
    }

    setOcrBusy(true);
    try {
      const form = new FormData();
      if (pendingMainImageFile) {
        const normalizedFile =
          await normalizeSourceImageForAi(pendingMainImageFile);
        form.append("file", normalizedFile);
      } else {
        form.append("imageUrl", draft.mainImageUrl.trim());
      }

      const response = await fetch(`${productApiBase}/ai-ocr`, {
        method: "POST",
        body: form,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(getApiErrorMessage(json, "OCR extraction failed"));

      const extractedText =
        typeof json?.text === "string" ? json.text.trim() : "";
      setDraft((current) => ({
        ...current,
        imageExtractedText: extractedText,
      }));

      if (draft.id) {
        const saveResponse = await fetch(`${productApiBase}/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageExtractedText: extractedText || null }),
        });
        const saveJson = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok)
          throw new Error(
            getApiErrorMessage(saveJson, "Failed to save OCR text"),
          );
        await loadData(query);
      }

      showToast("Image text extracted", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "OCR extraction failed",
        "error",
      );
    } finally {
      setOcrBusy(false);
    }
  }, [
    capabilities.imageExtractedText,
    draft.id,
    draft.mainImageUrl,
    loadData,
    normalizeSourceImageForAi,
    pendingMainImageFile,
    productApiBase,
    query,
  ]);

  const runAiPrefill = useCallback(
    async (sourceFile: File) => {
      const prefillForm = new FormData();
      prefillForm.append("file", sourceFile);

      const prefillResponse = await fetch(`${productApiBase}/ai-prefill`, {
        method: "POST",
        body: prefillForm,
      });
      const prefillJson = await prefillResponse.json().catch(() => ({}));

      if (!prefillResponse.ok) {
        throw new Error(
          getApiErrorMessage(prefillJson, "AI product prefill failed"),
        );
      }

      const product = (prefillJson?.product ?? null) as AiProductPrefill | null;
      if (!product) {
        throw new Error("AI did not return product details");
      }

      applyAiPrefill(product);
    },
    [applyAiPrefill, productApiBase],
  );

  const runAiImageRedesign = useCallback(
    async (sourceFile: File) => {
      const imageForm = new FormData();
      imageForm.append("file", sourceFile);

      const imageResponse = await fetch(`${productApiBase}/ai-image`, {
        method: "POST",
        body: imageForm,
      });
      const imageJson = await imageResponse.json().catch(() => ({}));

      if (!imageResponse.ok) {
        throw new Error(
          getApiErrorMessage(imageJson, "AI image redesign failed"),
        );
      }

      const imageBase64 =
        typeof imageJson?.imageBase64 === "string" ? imageJson.imageBase64 : "";
      const mimeType =
        typeof imageJson?.mimeType === "string"
          ? imageJson.mimeType
          : "image/jpeg";
      if (!imageBase64) {
        throw new Error("AI image redesign returned no image");
      }

      const aiBlob = decodeBase64Image(imageBase64, mimeType);
      const galleryFile = await resizeAiProductGalleryImage(aiBlob);
      const url = await uploadProductImage(galleryFile, "main");
      setDraft((current) => ({
        ...current,
        mainImageUrl: url,
        shopImageUrl: url,
      }));
      await persistImageFields({ mainImageUrl: url, shopImageUrl: url });
    },
    [
      decodeBase64Image,
      persistImageFields,
      productApiBase,
      resizeAiProductGalleryImage,
      uploadProductImage,
    ],
  );

  const applyAiAssist = useCallback(
    async (mode: "prefill" | "redesign" | "both") => {
      if (!pendingMainImageFile) {
        showToast("Choose an image first", "error");
        return;
      }

      setAiBusy(true);
      setAiAction(mode);
      try {
        const sourceFile =
          await normalizeSourceImageForAi(pendingMainImageFile);

        if (mode === "both") {
          await Promise.all([
            runAiPrefill(sourceFile),
            runAiImageRedesign(sourceFile),
          ]);
        } else if (mode === "prefill") {
          await runAiPrefill(sourceFile);
        } else {
          await runAiImageRedesign(sourceFile);
        }

        if (mode === "both") {
          showToast("AI image and product details prepared", "success");
        } else if (mode === "prefill") {
          showToast("AI product details prepared", "success");
        } else {
          showToast("AI website gallery image prepared", "success");
        }
        setPendingMainImageFile(null);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "AI assist failed",
          "error",
        );
      } finally {
        setAiBusy(false);
        setAiAction(null);
      }
    },
    [
      normalizeSourceImageForAi,
      pendingMainImageFile,
      runAiImageRedesign,
      runAiPrefill,
    ],
  );

  const submitDraft = async () => {
    if (!draft.name.trim())
      return showToast("Product name is required", "error");
    if (!draft.sellingPrice.trim())
      return showToast("Selling price is required", "error");
    const transportIncluded =
      draft.catalogueConfiguration.transportMode === "INCLUDED" ||
      draft.catalogueConfiguration.transportMode === "FREE" ||
      draft.catalogueConfiguration.priceIncludes.includes("TRANSPORT");
    if (
      !transportIncluded &&
      [
        draft.catalogueConfiguration.zone1TransportFee,
        draft.catalogueConfiguration.zone2TransportFee,
        draft.catalogueConfiguration.zone3TransportFee,
      ].some((fee) => fee === null || fee === undefined)
    ) {
      return showToast(
        "Enter transport fees for Zone 1, Zone 2, and Zone 3",
        "error",
      );
    }
    const catalogueConfiguration = transportIncluded
      ? draft.catalogueConfiguration
      : {
          ...draft.catalogueConfiguration,
          transportMode: "ZONE" as const,
          useDefaultTransportRates: false,
          priceIncludes: draft.catalogueConfiguration.priceIncludes.filter(
            (item) => item !== "TRANSPORT",
          ),
        };
    const websiteEligible = hasProductWebsiteImage(draft);
    setSaving(true);
    try {
      const canSetBuyingPriceOnThisSave =
        canManagePricing || (isProductDeskMode && !draft.id);
      const payload = {
        sku: draft.sku || undefined,
        name: draft.name,
        category: "pos",
        sellingPrice: Number(draft.sellingPrice || 0),
        ...(canSetBuyingPriceOnThisSave
          ? {
              lastBuyingPrice:
                canManagePricing && draft.variableCost
                  ? null
                  : draft.lastBuyingPrice.trim()
                    ? Number(draft.lastBuyingPrice)
                    : null,
              variableCost: canManagePricing ? draft.variableCost : false,
            }
          : {}),
        isActive: true,
        commissionEnabled: false,
        commissionAmount: null,
        commissionRequiresApproval: false,
        ...(capabilities.brand ? { brand: draft.brand.trim() || null } : {}),
        ...(capabilities.shortDescription
          ? { shortDescription: draft.shortDescription.trim() || null }
          : {}),
        ...(capabilities.description
          ? { description: draft.description.trim() || null }
          : {}),
        ...(capabilities.specifications
          ? { specifications: draft.specifications.trim() || null }
          : {}),
        ...(capabilities.warrantyNotes
          ? { warrantyNotes: draft.warrantyNotes.trim() || null }
          : {}),
        ...(capabilities.warrantyPeriod
          ? { warrantyPeriod: draft.warrantyPeriod.trim() || null }
          : {}),
        ...(capabilities.mainImageUrl
          ? { mainImageUrl: draft.mainImageUrl.trim() || null }
          : {}),
        ...(capabilities.imageExtractedText
          ? { imageExtractedText: draft.imageExtractedText.trim() || null }
          : {}),
        ...(capabilities.galleryImageUrls
          ? { galleryImageUrls: draft.galleryImageUrls }
          : {}),
        ...(capabilities.tiktokVideoUrl
          ? { tiktokVideoUrl: draft.tiktokVideoUrl.trim() || null }
          : {}),
        ...(capabilities.purchaseLink
          ? { purchaseLink: draft.purchaseLink.trim() || null }
          : {}),
        ...(capabilities.ecommerceVisible
          ? { ecommerceVisible: websiteEligible }
          : {}),
        ...(capabilities.isFeatured
          ? {
              isFeatured:
                websiteEligible && canManageFeaturedStatus
                  ? draft.isFeatured
                  : false,
            }
          : {}),
        ...(capabilities.status ? { status: "ACTIVE" } : {}),
        ...(capabilities.availabilityType
          ? { availabilityType: draft.availabilityType }
          : {}),
        ...(capabilities.pickupDelayDays
          ? { pickupDelayDays: draft.pickupDelayDays }
          : {}),
        ...(capabilities.showInShop ? { showInShop: websiteEligible } : {}),
        ...(capabilities.shopCategory
          ? { shopCategory: draft.shopCategory || null }
          : {}),
        ...(capabilities.shopSubcategory
          ? { shopSubcategory: draft.shopSubcategory || null }
          : {}),
        ...(capabilities.shopShortDescription
          ? { shopShortDescription: draft.shopShortDescription.trim() || null }
          : {}),
        ...(capabilities.shopWarranty
          ? { shopWarranty: draft.shopWarranty.trim() || null }
          : {}),
        ...(capabilities.shopSpecs
          ? {
              shopSpecs:
                (draft.specifications || draft.shopSpecs)
                  .trim()
                  .slice(0, 2000) || null,
            }
          : {}),
        ...(capabilities.shopImageUrl
          ? { shopImageUrl: draft.shopImageUrl.trim() || null }
          : {}),
        ...(capabilities.shopBrand
          ? { shopBrand: draft.shopBrand.trim() || null }
          : {}),
        ...(capabilities.productType
          ? { productType: draft.productType.trim() || null }
          : {}),
        ...(capabilities.posEnabled ? { posEnabled: true } : {}),
        ...(capabilities.catalogueConfiguration
          ? { catalogueConfiguration }
          : {}),
      };

      const baseUrl = draft.id
        ? `${productApiBase}/${draft.id}`
        : productApiBase;
      const url = activityOwnerId
        ? `${baseUrl}?impersonateId=${encodeURIComponent(activityOwnerId)}`
        : baseUrl;
      const method = draft.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(getApiErrorMessage(json, "Failed to save product"));
      showToast(draft.id ? "Product updated" : "Product created", "success");
      setDraft(createDraftDefaults());
      setEditorOpen(false);
      await loadData(query);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save product",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: PosProduct) => {
    setDraft(createDraftFromProduct(product));
    setEditorOpen(true);
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    showToast(`Editing ${product.name}`, "success");
  };

  const startCommissionEdit = (product: PosProduct) => {
    setDraft({
      ...createDraftFromProduct(product),
      commissionEnabled: true,
    });
    setEditorOpen(true);
    formSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    showToast(
      `${product.commissionEnabled ? "Editing" : "Assigning"} commission for ${product.name}`,
      "success",
    );
  };

  const deleteProduct = async (product: PosProduct) => {
    const confirmed = window.confirm(
      `Delete "${product.name}" from the POS catalog?`,
    );
    if (!confirmed) return;
    setDeletingId(product.id);
    try {
      const res = await fetch(`${productApiBase}/${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(getApiErrorMessage(json, "Failed to delete product"));
      if (draft.id === product.id) {
        setDraft(createDraftDefaults());
        setEditorOpen(false);
      }
      showToast(json?.message || "Product deleted", "success");
      await loadData(query);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete product",
        "error",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const formatProductName = async () => {
    if (!draft.name.trim()) {
      showToast("Enter a product name first", "error");
      return;
    }

    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/receipt-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: draft.name }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(getApiErrorMessage(json, "AI formatting failed"));

      const nextName =
        typeof json?.description === "string" ? json.description.trim() : "";
      if (!nextName) {
        throw new Error("AI formatting returned no product name");
      }

      setDraft((current) => ({ ...current, name: nextName }));
      showToast("Product name cleaned up", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "AI formatting failed",
        "error",
      );
    } finally {
      setAiBusy(false);
    }
  };

  const updateApproval = async (
    id: string,
    action: "approve" | "reject" | "revoke",
  ) => {
    setApprovalBusyId(id);
    try {
      const res = await fetch(`/api/admin/pos-commissions/${id}/${action}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          getApiErrorMessage(json, `Failed to ${action} commission`),
        );
      showToast(
        action === "revoke"
          ? "Commission approval revoked"
          : `Commission ${action}d`,
        "success",
      );
      await loadData(query);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : `Failed to ${action} commission`,
        "error",
      );
    } finally {
      setApprovalBusyId(null);
    }
  };

  const visibleSelectedProducts = filteredProducts.filter(
    (product) => selectedIds[product.id],
  );
  const selectedCount = visibleSelectedProducts.length;
  const allOnPageSelected =
    filteredProducts.length > 0 && selectedCount === filteredProducts.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelectedIds((current) => {
      const next = { ...current };
      if (allOnPageSelected) {
        for (const product of filteredProducts) delete next[product.id];
      } else {
        for (const product of filteredProducts) next[product.id] = true;
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds({});

  const bulkRequest = async (action: "activate" | "archive" | "delete") => {
    const ids = visibleSelectedProducts.map((product) => product.id);
    const res = await fetch(`${productApiBase}/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, action }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        getApiErrorMessage(json, `Failed to ${action} selected products`),
      );
    return json;
  };

  const bulkUpdateState = async (isActive: boolean) => {
    if (!selectedCount)
      return showToast("Select at least one product", "error");
    const action = isActive ? "activate" : "archive";
    setBulkBusy(action);
    try {
      const json = await bulkRequest(action);
      showToast(
        json?.message ||
          (isActive
            ? `${selectedCount} product${selectedCount === 1 ? "" : "s"} activated`
            : `${selectedCount} product${selectedCount === 1 ? "" : "s"} archived`),
        "success",
      );
      clearSelection();
      await loadData(query);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to update selected products",
        "error",
      );
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkDeleteProducts = async () => {
    if (!selectedCount)
      return showToast("Select at least one product", "error");
    const confirmed = window.confirm(
      `Delete ${selectedCount} selected product${selectedCount === 1 ? "" : "s"}? Linked products will be archived so historical POS receipts remain unchanged.`,
    );
    if (!confirmed) return;
    setBulkBusy("delete");
    try {
      const json = await bulkRequest("delete");
      showToast(json?.message || "Bulk catalog cleanup complete", "success");
      if (draft.id && selectedIds[draft.id]) {
        setDraft(createDraftDefaults());
      }
      clearSelection();
      await loadData(query);
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Failed to delete selected products",
        "error",
      );
    } finally {
      setBulkBusy(null);
    }
  };

  const shellSpacingClass = isProductDeskMode ? "space-y-4" : "space-y-6";
  const sectionClass = isProductDeskMode
    ? "rounded-[28px] border border-white/10 bg-slate-900/90 p-4 shadow-xl shadow-black/35"
    : "rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40";
  const compactTitleClass = isProductDeskMode
    ? "text-xl font-semibold text-white"
    : "text-2xl font-semibold text-white";
  const compactCellClass = isProductDeskMode ? "px-3 py-2.5" : "px-4 py-3";
  const runCatalogueSearch = useCallback(() => {
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
  }, [query]);

  const updatePolicy = <K extends keyof ProductCatalogueConfiguration>(
    key: K,
    value: ProductCatalogueConfiguration[K],
  ) => {
    setDraft((current) => ({
      ...current,
      policyConfigured: true,
      catalogueConfiguration: {
        ...current.catalogueConfiguration,
        [key]: value,
      },
    }));
  };

  const updateFulfilmentPolicy = (
    updates: Partial<ProductCatalogueConfiguration>,
  ) => {
    setDraft((current) => ({
      ...current,
      policyConfigured: true,
      catalogueConfiguration: {
        ...current.catalogueConfiguration,
        ...updates,
      },
    }));
  };

  const setInstallationRequired = (required: boolean) => {
    const included =
      draft.catalogueConfiguration.priceIncludes.includes("INSTALLATION");
    updateFulfilmentPolicy({
      installationType: required
        ? included
          ? "INCLUDED"
          : "LOCAL_RECOMMENDED"
        : "NOT_REQUIRED",
      installationFeeMode: required
        ? included
          ? "INCLUDED"
          : "STANDARD"
        : "UNAVAILABLE",
      customInstallationFee: required
        ? draft.catalogueConfiguration.customInstallationFee
        : null,
      priceIncludes: required
        ? draft.catalogueConfiguration.priceIncludes
        : draft.catalogueConfiguration.priceIncludes.filter(
            (item) => item !== "INSTALLATION",
          ),
    });
  };

  const setInstallationIncluded = (included: boolean) => {
    updateFulfilmentPolicy({
      installationType: included ? "INCLUDED" : "LOCAL_RECOMMENDED",
      installationFeeMode: included ? "INCLUDED" : "STANDARD",
      priceIncludes: included
        ? Array.from(
            new Set([
              ...draft.catalogueConfiguration.priceIncludes,
              "INSTALLATION" as const,
            ]),
          )
        : draft.catalogueConfiguration.priceIncludes.filter(
            (item) => item !== "INSTALLATION",
          ),
    });
  };

  const setTransportIncluded = (included: boolean) => {
    updateFulfilmentPolicy({
      transportMode: included ? "INCLUDED" : "ZONE",
      useDefaultTransportRates: false,
      zone1TransportFee: included
        ? draft.catalogueConfiguration.zone1TransportFee
        : (draft.catalogueConfiguration.zone1TransportFee ?? 3000),
      zone2TransportFee: included
        ? draft.catalogueConfiguration.zone2TransportFee
        : (draft.catalogueConfiguration.zone2TransportFee ?? 7500),
      zone3TransportFee: included
        ? draft.catalogueConfiguration.zone3TransportFee
        : (draft.catalogueConfiguration.zone3TransportFee ?? 15000),
      priceIncludes: included
        ? Array.from(
            new Set([
              ...draft.catalogueConfiguration.priceIncludes,
              "TRANSPORT" as const,
            ]),
          )
        : draft.catalogueConfiguration.priceIncludes.filter(
            (item) => item !== "TRANSPORT",
          ),
    });
  };

  const renderStructuredSection = (
    section: "pricing" | "installation" | "details" | "review",
  ) => {
    const policy = draft.catalogueConfiguration;
    if (section === "pricing") {
      const includes = [
        "EQUIPMENT",
        "ACCESSORIES",
        "COMMISSIONING",
        "REMOTE_SUPPORT",
      ] as const;
      return (
        <div>
          <h3 className="font-semibold text-white">
            What does this price include?
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {includes.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={policy.priceIncludes.includes(item)}
                  onChange={(event) =>
                    updatePolicy(
                      "priceIncludes",
                      event.target.checked
                        ? [...policy.priceIncludes, item]
                        : policy.priceIncludes.filter(
                            (entry) => entry !== item,
                          ),
                    )
                  }
                />{" "}
                {item.replaceAll("_", " ")}
              </label>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-100">
            <input
              type="checkbox"
              checked={policy.allInclusive}
              onChange={(event) =>
                updatePolicy("allInclusive", event.target.checked)
              }
            />{" "}
            Mark as an all-inclusive solar package
          </label>
        </div>
      );
    }
    if (section === "installation") {
      const installationRequired =
        policy.installationType !== "NOT_REQUIRED" &&
        policy.installationFeeMode !== "UNAVAILABLE";
      const installationIncluded =
        installationRequired &&
        (policy.installationType === "INCLUDED" ||
          policy.installationFeeMode === "INCLUDED" ||
          policy.priceIncludes.includes("INSTALLATION"));
      const transportIncluded =
        policy.transportMode === "INCLUDED" ||
        policy.transportMode === "FREE" ||
        policy.priceIncludes.includes("TRANSPORT");
      const choiceClass =
        "flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200 transition hover:border-emerald-400/50";
      return (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <label className={choiceClass}>
              <input
                className="mt-1 size-5"
                type="checkbox"
                checked={installationRequired}
                onChange={(event) =>
                  setInstallationRequired(event.target.checked)
                }
              />
              <span>
                <strong className="block text-white">
                  Requires installation
                </strong>
                <span className="mt-1 block text-slate-400">
                  The product or system must be installed by a technician.
                </span>
              </span>
            </label>
            <label
              className={`${choiceClass} ${!installationRequired ? "opacity-50" : ""}`}
            >
              <input
                className="mt-1 size-5"
                type="checkbox"
                disabled={!installationRequired}
                checked={installationIncluded}
                onChange={(event) =>
                  setInstallationIncluded(event.target.checked)
                }
              />
              <span>
                <strong className="block text-white">
                  Installation included
                </strong>
                <span className="mt-1 block text-slate-400">
                  The selling price already covers installation.
                </span>
              </span>
            </label>
            <label className={choiceClass}>
              <input
                className="mt-1 size-5"
                type="checkbox"
                checked={transportIncluded}
                onChange={(event) => setTransportIncluded(event.target.checked)}
              />
              <span>
                <strong className="block text-white">Transport included</strong>
                <span className="mt-1 block text-slate-400">
                  No additional delivery or transport fee is charged.
                </span>
              </span>
            </label>
          </div>
          {installationRequired && !installationIncluded ? (
            <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 md:grid-cols-2">
              <label className="text-sm text-slate-300">
                Installation pricing
                <select
                  className={`${fieldClass} mt-1`}
                  value={
                    policy.installationFeeMode === "CUSTOM"
                      ? "CUSTOM"
                      : "STANDARD"
                  }
                  onChange={(event) =>
                    updateFulfilmentPolicy({
                      installationFeeMode: event.target.value as
                        "STANDARD" | "CUSTOM",
                      customInstallationFee:
                        event.target.value === "CUSTOM"
                          ? policy.customInstallationFee
                          : null,
                    })
                  }
                >
                  <option value="STANDARD">Use standard Betech rate</option>
                  <option value="CUSTOM">Set a product-specific fee</option>
                </select>
              </label>
              {policy.installationFeeMode === "CUSTOM" ? (
                <label className="text-sm text-slate-300">
                  Installation fee (KES)
                  <input
                    className={`${fieldClass} mt-1`}
                    type="number"
                    min="0"
                    value={policy.customInstallationFee ?? ""}
                    onChange={(event) =>
                      updatePolicy(
                        "customInstallationFee",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                  />
                </label>
              ) : null}
            </div>
          ) : null}
          {!transportIncluded ? (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
              <h4 className="font-semibold text-amber-100">
                Transport fees by service zone
              </h4>
              <p className="mt-1 text-sm text-slate-400">
                These fees are shown on the storefront and used when the
                customer selects a delivery zone.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {([1, 2, 3] as const).map((zone) => (
                  <label key={zone} className="text-sm text-slate-300">
                    Zone {zone} fee (KES)
                    <input
                      className={`${fieldClass} mt-1`}
                      type="number"
                      min="0"
                      required
                      value={policy[`zone${zone}TransportFee`] ?? ""}
                      onChange={(event) =>
                        updatePolicy(
                          `zone${zone}TransportFee`,
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {policy.accessoriesMode !== "INCLUDED" && !policy.allInclusive && !policy.priceIncludes.includes("ACCESSORIES") ? (
            <label className="block text-sm text-slate-300">
              Preliminary installation accessories estimate (KES)
              <input
                className={`${fieldClass} mt-1`}
                type="number"
                min="0"
                value={policy.preliminaryAccessoriesFee ?? ""}
                onChange={(event) =>
                  updatePolicy(
                    "preliminaryAccessoriesFee",
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
                placeholder="Confirmed before installation"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Shown in the installation booking summary. Leave blank when a
                site assessment is required.
              </span>
            </label>
          ) : null}
          <label className="block text-sm text-slate-300">
            Customer-facing installation or transport notes
            <textarea
              className={`${fieldClass} mt-1 min-h-24`}
              value={policy.installationNotes}
              onChange={(event) =>
                updatePolicy("installationNotes", event.target.value)
              }
              placeholder="Optional: special installation requirements, access limits, or delivery guidance."
            />
          </label>
        </div>
      );
    }
    if (section === "details") {
      const addRow = (
        key: "structuredSpecifications" | "componentWarranties",
      ) => updatePolicy(key, [...policy[key], { label: "", value: "" }]);
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          {(["structuredSpecifications", "componentWarranties"] as const).map(
            (key) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">
                    {key === "structuredSpecifications"
                      ? "Key specifications"
                      : "Component warranties"}
                  </h3>
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200"
                    onClick={() => addRow(key)}
                  >
                    + Add row
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {policy[key].map((row, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2"
                    >
                      <input
                        className={fieldClass}
                        placeholder="Label"
                        value={row.label}
                        onChange={(event) =>
                          updatePolicy(
                            key,
                            policy[key].map((entry, rowIndex) =>
                              rowIndex === index
                                ? { ...entry, label: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <input
                        className={fieldClass}
                        placeholder="Value"
                        value={row.value}
                        onChange={(event) =>
                          updatePolicy(
                            key,
                            policy[key].map((entry, rowIndex) =>
                              rowIndex === index
                                ? { ...entry, value: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="px-2 text-rose-300"
                        onClick={() =>
                          updatePolicy(
                            key,
                            policy[key].filter(
                              (_, rowIndex) => rowIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      );
    }
    if (section === "review") {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Product", draft.name || "Not named"],
            ["Price", formatMoney(draft.sellingPrice)],
            ["Installation", policy.installationType.replaceAll("_", " ")],
            ["Transport", policy.transportMode.replaceAll("_", " ")],
            ["Availability", draft.availabilityType.replaceAll("_", " ")],
            [
              "Website",
              draftWebsiteEligible
                ? "Publishes automatically"
                : "Hidden until eligible",
            ],
            ["Warranty", draft.warrantyPeriod || "Not set"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <div className="text-[11px] uppercase tracking-widest text-slate-500">
                {label}
              </div>
              <div className="mt-2 font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={shellSpacingClass}>
      <section
        className={
          isProductDeskMode
            ? "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.88)_100%)] p-4 shadow-xl shadow-black/35"
            : "rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/40"
        }
      >
        <div
          className={`flex flex-col ${isProductDeskMode ? "gap-3 lg:flex-row lg:items-end lg:justify-between" : "gap-4 xl:flex-row xl:items-end xl:justify-between"}`}
        >
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {isProductDeskMode ? "Product Desk" : "Manage Products"}
            </p>
            <h2 className={`mt-1 ${compactTitleClass}`}>
              {isProductDeskMode
                ? "Create and publish products faster"
                : "Fast catalogue workflow for POS and online shop"}
            </h2>
            <p
              className={`mt-2 ${isProductDeskMode ? "max-w-2xl text-[13px] leading-6 text-slate-400" : "max-w-3xl text-sm text-slate-400"}`}
            >
              {isProductDeskMode
                ? "Keep the desk focused on content, images, TikTok, and shop publishing without admin pricing or commission clutter."
                : "Keep the product table as the daily workspace, then open the editor only when you need to add, fix, or publish an item."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
              onClick={() => void loadData(query)}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20"
              onClick={openCreateEditor}
            >
              Add Product
            </button>
          </div>
        </div>

        <div
          className={`mt-4 grid gap-3 ${isProductDeskMode ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-6"}`}
        >
          {[
            { key: "all", label: "All Products", value: catalogStats.total },
            { key: "online", label: "Online Shop", value: catalogStats.online },
            {
              key: "featured",
              label: "Featured",
              value: catalogStats.featured,
            },
            {
              key: "warehouse",
              label: "Warehouse",
              value: catalogStats.warehouse,
            },
            {
              key: "inactive",
              label: "Inactive",
              value: catalogStats.inactive,
            },
            {
              key: "incomplete",
              label: "Needs Setup",
              value: catalogStats.incomplete,
            },
          ].map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() => setCatalogView(card.key as typeof catalogView)}
              className={`rounded-2xl border ${isProductDeskMode ? "px-3.5 py-3" : "px-4 py-3"} text-left transition ${
                catalogView === card.key
                  ? "border-amber-400/50 bg-amber-400/10"
                  : "border-slate-800 bg-slate-950/55 hover:bg-slate-950/75"
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {card.label}
              </div>
              <div
                className={`mt-2 font-semibold text-white ${isProductDeskMode ? "text-xl" : "text-2xl"}`}
              >
                {card.value}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        ref={formSectionRef}
        className={
          editorOpen
            ? "fixed inset-2 z-[100] overflow-y-auto rounded-[28px] border border-cyan-400/20 bg-slate-950 p-4 shadow-2xl shadow-black/70 sm:inset-4 sm:p-6"
            : sectionClass
        }
      >
        <div
          className={`grid ${!editorOpen && canManageCommissions ? "gap-6 xl:grid-cols-[1.25fr_0.75fr]" : "grid-cols-1"}`}
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Product creation
                </p>
                <h2 className={compactTitleClass}>
                  {draft.id
                    ? "Edit catalogue product"
                    : "Create catalogue product"}
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setEditorOpen((current) => !current)}
                >
                  {editorOpen ? "Collapse" : "Open editor"}
                </button>
                {draft.id || editorOpen ? (
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                    onClick={() => {
                      setDraft(createDraftDefaults());
                      setEditorOpen(false);
                    }}
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </div>

            {editorOpen ? (
              <>
                <div className="mt-4 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 sm:p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    1 Basic
                  </div>
                  <div
                    className={`grid ${isProductDeskMode ? "gap-3 md:grid-cols-2" : "gap-4 md:grid-cols-2"}`}
                  >
                    <div className="text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>Product name</span>
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void formatProductName()}
                          disabled={aiBusy}
                        >
                          {aiBusy ? "AI..." : "✨ AI format"}
                        </button>
                      </div>
                      <input
                        ref={nameInputRef}
                        className={`${fieldClass} mt-1`}
                        value={draft.name}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, name: e.target.value }))
                        }
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Fix spelling and clean up formatting before saving.
                      </div>
                      {duplicateMatches.length ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                            Possible Duplicates
                          </div>
                          <div className="mt-2 space-y-2">
                            {duplicateMatches.map(({ item, score }) => (
                              <div
                                key={item.id}
                                className="flex flex-wrap items-start justify-between gap-3 text-sm"
                              >
                                <div>
                                  <div className="font-medium text-white">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-slate-300">
                                    {item.sku} · Selling{" "}
                                    {formatMoney(item.sellingPrice)}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                                    onClick={() => startEdit(item)}
                                  >
                                    Use
                                  </button>
                                  <div className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-semibold text-amber-100">
                                    {Math.round(score * 100)}% similar
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 text-xs text-amber-100/80">
                            This product looks similar to items already in the
                            catalog. Edit or reuse an existing product where
                            possible.
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <label className="text-sm text-slate-300">
                      SKU
                      <input
                        className={`${fieldClass} mt-1`}
                        value={draft.sku}
                        onChange={(e) =>
                          setDraft((s) => ({ ...s, sku: e.target.value }))
                        }
                        placeholder="Auto-generated if empty"
                      />
                    </label>
                    <div className="md:col-span-2 border-t border-slate-800 pt-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        2 Pricing
                      </div>
                    </div>
                    <label className="text-sm text-slate-300">
                      Selling price
                      <input
                        className={`${fieldClass} mt-1`}
                        type="number"
                        min="0"
                        value={draft.sellingPrice}
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            sellingPrice: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={draft.variableCost}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              variableCost: e.target.checked,
                              lastBuyingPrice: e.target.checked
                                ? ""
                                : s.lastBuyingPrice,
                            }))
                          }
                        />
                        Variable-cost project
                      </label>
                      <label className="block text-sm text-slate-300">
                        Buying price
                        <input
                          className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                          type="number"
                          min="0"
                          disabled={draft.variableCost}
                          value={draft.lastBuyingPrice}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              lastBuyingPrice: e.target.value,
                            }))
                          }
                          placeholder="Optional"
                        />
                      </label>
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      {renderStructuredSection("pricing")}
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 ${isProductDeskMode ? "p-3.5" : "p-4"}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    3 Category
                  </div>
                  {!(
                    capabilities.showInShop ||
                    capabilities.shopCategory ||
                    capabilities.shopSubcategory ||
                    capabilities.shopShortDescription ||
                    capabilities.shopWarranty ||
                    capabilities.shopSpecs ||
                    capabilities.shopImageUrl ||
                    capabilities.shopBrand
                  ) ? (
                    <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      Live Product table is currently in{" "}
                      <span className="font-semibold uppercase">
                        {capabilities.schemaMode}
                      </span>{" "}
                      compatibility mode. `showInShop`, `shopCategory`,
                      `shopSubcategory`, and the ecommerce display fields are
                      planned but not yet fully persisted in this database
                      shape.
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="text-sm text-slate-300">
                      <div className="flex items-center justify-between gap-2">
                        <span>Website category</span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                          onClick={applySuggestedShopTaxonomy}
                        >
                          Auto-detect
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={!capabilities.shopCategory}
                        onClick={() => {
                          setPickerCategory(null);
                          setCategoryPickerQuery("");
                          setCategoryPickerOpen(true);
                        }}
                        className={`${fieldClass} mt-2 flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {SHOP_CATEGORY_OPTIONS.find(
                          (option) => option.value === draft.shopCategory,
                        )?.label || "Select category"}
                        <span>⌄</span>
                      </button>
                    </div>

                    <div className="text-sm text-slate-300">
                      <span>Website subcategory</span>
                      <button
                        type="button"
                        disabled={
                          !capabilities.shopSubcategory || !draft.shopCategory
                        }
                        onClick={() => {
                          setPickerCategory(draft.shopCategory);
                          setCategoryPickerQuery("");
                          setCategoryPickerOpen(true);
                        }}
                        className={`${fieldClass} mt-2 flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {shopSubcategoryOptions.find(
                          (option) => option.value === draft.shopSubcategory,
                        )?.label || "Select subcategory"}
                        <span>⌄</span>
                      </button>
                      <div className="mt-1 text-xs text-slate-500">
                        Select a category and subcategory in the same side panel.
                      </div>
                    </div>

                    <label className="text-sm text-slate-300">
                      Brand
                      <div className="relative mt-1" ref={brandBoxRef}>
                        <input
                          className={`${fieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
                          value={draft.brand}
                          disabled={
                            !(capabilities.brand || capabilities.shopBrand)
                          }
                          onFocus={() => setBrandOpen(true)}
                          onChange={(e) => {
                            setDraft((s) => ({
                              ...s,
                              brand: e.target.value,
                              shopBrand: e.target.value,
                            }));
                            setBrandOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && canAddBrand) {
                              e.preventDefault();
                              void createBrandOption();
                            }
                          }}
                          placeholder="Search or select brand"
                        />
                        {brandOpen &&
                        (capabilities.brand || capabilities.shopBrand) ? (
                          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                            <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500">
                              Select an existing brand or add a new one if it is
                              missing.
                            </div>
                            <div className="max-h-64 overflow-y-auto p-2">
                              {brandLoading ? (
                                <div className="px-3 py-2 text-sm text-slate-400">
                                  Loading brands...
                                </div>
                              ) : null}
                              {!brandLoading &&
                                brandOptions.map((option) => (
                                  <button
                                    key={option.name}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/5"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => applyBrandValue(option.name)}
                                  >
                                    <span>{option.name}</span>
                                    {exactBrandMatch?.name === option.name ? (
                                      <span className="text-xs text-emerald-300">
                                        Selected
                                      </span>
                                    ) : null}
                                  </button>
                                ))}
                              {!brandLoading && canAddBrand ? (
                                <button
                                  type="button"
                                  className="mt-1 flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left text-sm text-emerald-100 hover:bg-emerald-500/15"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => void createBrandOption()}
                                  disabled={brandSaving}
                                >
                                  <span>
                                    + Add new brand: &quot;
                                    {normalizedDraftBrand}&quot;
                                  </span>
                                  <span className="text-xs">
                                    {brandSaving ? "Saving..." : "Add"}
                                  </span>
                                </button>
                              ) : null}
                              {!brandLoading &&
                              !brandOptions.length &&
                              !canAddBrand ? (
                                <div className="px-3 py-2 text-sm text-slate-400">
                                  No matching brands found.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Select an existing brand or add a new one if it is
                        missing.
                      </div>
                    </label>

                    {isGeneralShopCategory(draft.shopCategory) ? (
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-100 md:col-span-2">
                        This general category product is automatically
                        classified as a Warehouse Product. Configure whether it
                        is available locally or ordered from abroad in the
                        availability section.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                    4 Installation & transport
                  </div>
                  {renderStructuredSection("installation")}
                </div>

                <div className="mt-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                    Product content
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <div className="text-sm font-semibold text-slate-200">
                        Product short description
                      </div>
                      <div className="mt-1 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                        <ProductDescriptionEditor
                        value={draft.shortDescription}
                        disabled={
                          !(
                            capabilities.shortDescription ||
                            capabilities.shopShortDescription
                          )
                        }
                        onChange={(shortDescription) =>
                          setDraft((s) => ({
                            ...s,
                            shortDescription,
                            shopShortDescription: shortDescription,
                          }))
                        }
                        compact
                        showPreview={false}
                        placeholder="Brief customer-facing product summary."
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <div className="mb-2">
                        <div className="text-sm font-semibold text-slate-200">
                          Product long description
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Use the toolbar instead of typing formatting syntax
                          manually. Existing plain text and Markdown remain
                          compatible.
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                        <ProductDescriptionEditor
                          value={draft.description}
                          disabled={!capabilities.description}
                          onChange={(description) =>
                            setDraft((current) => ({ ...current, description }))
                          }
                          compact
                          showPreview={false}
                          placeholder="Include only product-related information. Keep it clear, accurate, and consistent with the product images."
                        />
                      </div>
                    </div>

                    <label className="text-sm text-slate-300">
                      Warranty period
                      <select
                        className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                        value={draft.warrantyPeriod}
                        disabled={
                          !(
                            capabilities.warrantyPeriod ||
                            capabilities.shopWarranty
                          )
                        }
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            warrantyPeriod: e.target.value,
                            shopWarranty: e.target.value,
                          }))
                        }
                      >
                        {warrantyOptions.map((option) => (
                          <option key={option || "none"} value={option}>
                            {option || "Select warranty period"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-slate-300 md:col-span-2">
                      TikTok video link
                      <input
                        className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                        value={draft.tiktokVideoUrl}
                        disabled={!capabilities.tiktokVideoUrl}
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            tiktokVideoUrl: e.target.value,
                          }))
                        }
                        placeholder="https://www.tiktok.com/@account/video/1234567890"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Paste the TikTok product video link. The video will be
                        embedded directly on the product page.
                      </div>
                    </label>

                    <label className="text-sm text-slate-300 md:col-span-2">
                      Purchase link
                      <input
                        type="url"
                        className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                        value={draft.purchaseLink}
                        disabled={!capabilities.purchaseLink}
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            purchaseLink: e.target.value,
                          }))
                        }
                        placeholder="https://supplier.example.com/product"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Internal source link for this listing. It is not shown on the website.
                      </div>
                    </label>

                    <label className="text-sm text-slate-300 md:col-span-2">
                      Availability
                      <div className="mt-1 grid gap-3 md:grid-cols-2">
                        <label className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="availabilityType"
                              checked={draft.availabilityType === "SHOP"}
                              disabled={!capabilities.availabilityType}
                              onChange={() =>
                                setDraft((s) => ({
                                  ...s,
                                  availabilityType: "SHOP",
                                  pickupDelayDays: 0,
                                }))
                              }
                            />
                            Available at Shop
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Same-day pickup message.
                          </div>
                        </label>
                        <label className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="availabilityType"
                              checked={draft.availabilityType === "WAREHOUSE"}
                              disabled={!capabilities.availabilityType}
                              onChange={() =>
                                setDraft((s) => ({
                                  ...s,
                                  availabilityType: "WAREHOUSE",
                                  pickupDelayDays: 1,
                                }))
                              }
                            />
                            Available in Warehouse
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Warn customer about 1 day pickup or delivery delay.
                          </div>
                        </label>
                        <label className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="availabilityType"
                              checked={
                                draft.availabilityType === "ORDER_ON_REQUEST"
                              }
                              disabled={!capabilities.availabilityType}
                              onChange={() =>
                                setDraft((current) => ({
                                  ...current,
                                  availabilityType: "ORDER_ON_REQUEST",
                                  pickupDelayDays: 0,
                                }))
                              }
                            />{" "}
                            Order on Request
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Staff confirms availability before fulfilment.
                          </div>
                        </label>
                        <label className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="availabilityType"
                              checked={
                                draft.availabilityType === "OUT_OF_STOCK"
                              }
                              disabled={!capabilities.availabilityType}
                              onChange={() =>
                                setDraft((current) => ({
                                  ...current,
                                  availabilityType: "OUT_OF_STOCK",
                                  pickupDelayDays: 0,
                                }))
                              }
                            />{" "}
                            Out of Stock
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            Keep the product visible but unavailable to order.
                          </div>
                        </label>
                      </div>
                      <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                        {availabilityPreview}
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
                  <div className="text-sm text-slate-300">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                      6 Images
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      Accepted formats: {imageUploadFormats}. Best product
                      images: `1600 x 1600 px` square for the main image and
                      gallery, bright product-centered crop, no inner
                      whitespace.
                    </div>
                    <div className="mt-2 grid gap-4 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Main image
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-500">
                          Recommended: `1600 x 1600 px` square. Use JPG, PNG, or
                          WebP for the cleanest storefront result.
                        </div>
                        {draft.mainImageUrl ? (
                          <img
                            src={draft.mainImageUrl}
                            alt="Main preview"
                            className="mt-3 h-24 w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                            No main image
                          </div>
                        )}
                        <input
                          className="mt-3 block w-full text-xs text-slate-300"
                          type="file"
                          accept={imageUploadAccept}
                          disabled={
                            !(
                              capabilities.mainImageUrl ||
                              capabilities.shopImageUrl
                            ) || uploadingKind !== null
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setPendingMainImageFile(file);
                            e.currentTarget.value = "";
                          }}
                        />
                        {pendingMainImageFile ? (
                          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300">
                            <div className="font-medium text-emerald-100">
                              {pendingMainImageFile.name}
                            </div>
                            <div className="mt-1 text-slate-400">
                              Choose what AI should do with this uploaded
                              artwork: prefill product details, redesign the
                              main website gallery image, or do both together.
                            </div>
                            {aiBusy && aiAction ? (
                              <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                                {aiAction === "prefill"
                                  ? "AI is prefilling product details"
                                  : aiAction === "redesign"
                                    ? "AI is redesigning the website image"
                                    : "AI is redesigning the image and prefilling details"}
                              </div>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={uploadingKind !== null || aiBusy}
                                onClick={() => void uploadPendingMainImage()}
                              >
                                {uploadingKind === "main"
                                  ? "Uploading..."
                                  : "Upload original"}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={uploadingKind !== null || aiBusy}
                                onClick={() => void applyAiAssist("prefill")}
                              >
                                {aiBusy && aiAction === "prefill"
                                  ? "AI prefilling..."
                                  : "AI prefill details"}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={uploadingKind !== null || aiBusy}
                                onClick={() => void applyAiAssist("redesign")}
                              >
                                {aiBusy && aiAction === "redesign"
                                  ? "AI redesigning..."
                                  : "AI redesign image"}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={uploadingKind !== null || aiBusy}
                                onClick={() => void applyAiAssist("both")}
                              >
                                {aiBusy && aiAction === "both"
                                  ? "AI processing both..."
                                  : "AI do both"}
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                                disabled={uploadingKind !== null || aiBusy}
                                onClick={() => setPendingMainImageFile(null)}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="mt-2 text-xs text-slate-400 hover:text-white"
                          onClick={async () => {
                            setDraft((s) => ({
                              ...s,
                              mainImageUrl: "",
                              shopImageUrl: "",
                            }));
                            try {
                              await persistImageFields({
                                mainImageUrl: "",
                                shopImageUrl: "",
                              });
                              showToast("Main image removed", "success");
                            } catch (err) {
                              showToast(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to remove main image",
                                "error",
                              );
                            }
                          }}
                        >
                          Remove main image
                        </button>
                        {capabilities.imageExtractedText ? (
                          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  Saved image text
                                </div>
                                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                                  Run OCR once on the product banner, then edit
                                  the extracted text manually if needed.
                                </div>
                              </div>
                              <button
                                type="button"
                                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={ocrBusy || aiBusy}
                                onClick={() => void runAiOcrExtraction()}
                              >
                                {ocrBusy
                                  ? "Extracting..."
                                  : "Extract text from image"}
                              </button>
                            </div>
                            <textarea
                              className={`${fieldClass} mt-3 min-h-[140px]`}
                              value={draft.imageExtractedText}
                              onChange={(e) =>
                                setDraft((s) => ({
                                  ...s,
                                  imageExtractedText: e.target.value,
                                }))
                              }
                              placeholder="Visible text from the product banner or poster..."
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Gallery images
                        </div>
                        <div className="mt-1 text-[11px] leading-5 text-slate-500">
                          Recommended: `1600 x 1600 px` square or `1600 x 1200
                          px` landscape, tightly cropped around the product.
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {draft.galleryImageUrls.length ? (
                            draft.galleryImageUrls.map((url, index) => (
                              <div key={`${url}-${index}`} className="relative">
                                <img
                                  src={url}
                                  alt={`Gallery ${index + 1}`}
                                  className="h-20 w-full rounded-lg object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                                  onClick={async () => {
                                    const nextGallery =
                                      draft.galleryImageUrls.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      );
                                    setDraft((s) => ({
                                      ...s,
                                      galleryImageUrls: nextGallery,
                                    }));
                                    try {
                                      await persistImageFields({
                                        galleryImageUrls: nextGallery,
                                      });
                                      showToast(
                                        "Gallery image removed",
                                        "success",
                                      );
                                    } catch (err) {
                                      showToast(
                                        err instanceof Error
                                          ? err.message
                                          : "Failed to remove gallery image",
                                        "error",
                                      );
                                    }
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                              No gallery images
                            </div>
                          )}
                        </div>
                        <input
                          className="mt-3 block w-full text-xs text-slate-300"
                          type="file"
                          accept={imageUploadAccept}
                          multiple
                          disabled={
                            !capabilities.galleryImageUrls ||
                            uploadingKind !== null
                          }
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) return;
                            try {
                              const uploaded: string[] = [];
                              for (const file of files) {
                                uploaded.push(
                                  await uploadProductImage(file, "gallery"),
                                );
                              }
                              const nextGallery = [
                                ...draft.galleryImageUrls,
                                ...uploaded,
                              ];
                              setDraft((s) => ({
                                ...s,
                                galleryImageUrls: nextGallery,
                              }));
                              await persistImageFields({
                                galleryImageUrls: nextGallery,
                              });
                              showToast("Gallery images uploaded", "success");
                            } catch (err) {
                              showToast(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to upload gallery images",
                                "error",
                              );
                            } finally {
                              e.currentTarget.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-500/[0.04] p-4 sm:p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                    7 Website
                  </div>
                  <div
                    className={`mt-3 rounded-2xl border px-4 py-3 ${draftWebsiteEligible ? "border-emerald-400/20 bg-emerald-500/5" : "border-amber-400/20 bg-amber-500/5"}`}
                  >
                    <div className="font-semibold text-white">
                      {draftWebsiteEligible
                        ? "Ready for website"
                        : "Website hidden"}
                    </div>
                    {!draftWebsiteImageReady ? (
                      <div className="mt-1 text-sm text-slate-300">
                        Add a main image to show this product online.
                      </div>
                    ) : null}
                  </div>
                  {!isProductDeskMode ? (
                    <label className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={draft.isFeatured}
                        disabled={
                          !capabilities.isFeatured || !draftWebsiteEligible
                        }
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            isFeatured: event.target.checked,
                          }))
                        }
                      />
                      Feature this product on the website
                    </label>
                  ) : null}
                </div>

                <div className="mt-4 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4 sm:p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    8 Review
                  </div>
                  {renderStructuredSection("review")}
                </div>

                <div
                  className={`mt-5 flex flex-wrap items-center gap-3 ${isProductDeskMode ? "border-t border-slate-800 pt-4" : ""}`}
                >
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void submitDraft()}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : draft.id
                        ? "Update product"
                        : "Create product"}
                  </button>
                  {draft.id ? (
                    <div className="text-sm text-emerald-200">
                      Editing:{" "}
                      <span className="font-semibold text-white">
                        {draft.name || draft.sku || "POS product"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {!editorOpen && canManageCommissions ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 xl:content-start">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Pending approvals
                </div>
                <div className="mt-3 text-3xl font-semibold text-amber-200">
                  {approvals.length}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Commission requests waiting for release or rejection.
                </div>
              </div>
              <Link
                href="/admin/receipts/missing-buying"
                className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 hover:bg-amber-400/15"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-amber-200">
                  Admin pricing
                </div>
                <div className="mt-3 text-lg font-semibold text-white">
                  Price variable-cost sales
                </div>
                <div className="mt-1 text-sm text-amber-100/80">
                  Set buying prices after POS project sales so profit reporting
                  updates accurately.
                </div>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      {categoryPickerOpen ? (
        <div
          className="fixed inset-0 z-[110] flex justify-end bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="Select website category"
        >
          <section className="h-full w-full max-w-lg overflow-y-auto bg-slate-50 p-6 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">
                  {pickerCategoryDefinition
                    ? pickerCategoryDefinition.label
                    : "Categories"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pickerCategoryDefinition
                    ? "Choose a subcategory"
                    : "Search and select a category"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategoryPickerOpen(false);
                  setPickerCategory(null);
                }}
                className="text-2xl leading-none text-slate-500 hover:text-slate-900"
                aria-label="Close category picker"
              >
                ×
              </button>
            </div>
            {pickerCategoryDefinition ? (
              <button
                type="button"
                onClick={() => {
                  setPickerCategory(null);
                  setCategoryPickerQuery("");
                }}
                className="mt-5 text-sm font-bold text-amber-700"
              >
                ← All categories
              </button>
            ) : (
              <input
                autoFocus
                value={categoryPickerQuery}
                onChange={(event) => setCategoryPickerQuery(event.target.value)}
                className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                placeholder="Search for a category or subcategory"
              />
            )}
            <div className="mt-6">
              <h3 className="font-black">
                {pickerCategoryDefinition
                  ? "Subcategories"
                  : categoryPickerQuery
                    ? "Matching categories"
                    : "All categories"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {pickerCategoryDefinition
                  ? "Select a subcategory to complete the catalogue classification."
                  : "Selecting a category immediately shows its subcategories."}
              </p>
              <div className="mt-3 space-y-1">
                {(pickerCategoryDefinition
                  ? pickerCategoryDefinition.subcategories
                  : categoryPickerResults
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      if (!pickerCategoryDefinition) {
                        setDraft((current) => ({
                          ...current,
                          shopCategory: item.value,
                          shopSubcategory: "",
                          productType: isGeneralShopCategory(item.value)
                            ? "WAREHOUSE_PRODUCT"
                            : current.productType,
                        }));
                        setPickerCategory(item.value);
                        return;
                      }
                      setDraft((current) => ({
                        ...current,
                        shopCategory: pickerCategoryDefinition.value,
                        shopSubcategory: item.value,
                      }));
                      setCategoryPickerOpen(false);
                      setPickerCategory(null);
                      setCategoryPickerQuery("");
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-amber-50"
                  >
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      {pickerCategoryDefinition && "productTypes" in item ? (
                        <span className="mt-1 block text-xs font-normal text-slate-500">
                          {item.productTypes?.length
                            ? item.productTypes.map((productType) => productType.label).join(" · ")
                            : "Final category"}
                        </span>
                      ) : null}
                    </span>
                    <span className="font-semibold text-amber-600">
                      {pickerCategoryDefinition ? "Select" : "›"}
                    </span>
                  </button>
                ))}
                {!(pickerCategoryDefinition
                  ? pickerCategoryDefinition.subcategories
                  : categoryPickerResults
                ).length ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    No matching category.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {canManageCommissions ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Approvals
                </p>
                <h2 className="text-xl font-semibold text-white">
                  Pending POS commissions
                </h2>
              </div>
              <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                {approvals.length} pending
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {approvals.length ? (
                approvals.map((approval) => {
                  const customerHref = buildAdminCustomerProfileHref({
                    displayName:
                      approval.orderItem?.order?.customerName || null,
                  });
                  return (
                    <div
                      key={approval.id}
                      className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-white">
                            {approval.orderItem?.product?.name || "Product"} ·{" "}
                            {formatMoney(approval.amount)}
                          </div>
                          <div className="text-sm text-slate-300">
                            Staff:{" "}
                            {approval.staff?.name ||
                              approval.staff?.email ||
                              "Unknown"}
                          </div>
                          <div className="text-xs text-slate-400">
                            Receipt:{" "}
                            {approval.orderItem?.order?.orderNumber || "-"} ·
                            Customer:{" "}
                            <Link
                              href={customerHref}
                              className="transition hover:text-cyan-300"
                            >
                              {approval.orderItem?.order?.customerName || "-"}
                            </Link>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              void updateApproval(approval.id, "approve")
                            }
                            disabled={approvalBusyId === approval.id}
                          >
                            {approvalBusyId === approval.id
                              ? "Working..."
                              : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              void updateApproval(approval.id, "reject")
                            }
                            disabled={approvalBusyId === approval.id}
                          >
                            {approvalBusyId === approval.id
                              ? "Working..."
                              : "Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                  No commission approvals are waiting right now.
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Recently released
                  </h3>
                  <p className="text-xs text-slate-400">
                    Revoke approvals that were released by mistake.
                  </p>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  {releasedApprovals.length} released
                </div>
              </div>
              <div className="space-y-3">
                {releasedApprovals.length ? (
                  releasedApprovals.map((approval) => {
                    const customerHref = buildAdminCustomerProfileHref({
                      displayName:
                        approval.orderItem?.order?.customerName || null,
                    });
                    return (
                      <div
                        key={approval.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-white">
                              {approval.orderItem?.product?.name || "Product"} ·{" "}
                              {formatMoney(approval.amount)}
                            </div>
                            <div className="text-sm text-slate-300">
                              Staff:{" "}
                              {approval.staff?.name ||
                                approval.staff?.email ||
                                "Unknown"}
                            </div>
                            <div className="text-xs text-slate-400">
                              Receipt:{" "}
                              {approval.orderItem?.order?.orderNumber || "-"} ·
                              Customer:{" "}
                              <Link
                                href={customerHref}
                                className="transition hover:text-cyan-300"
                              >
                                {approval.orderItem?.order?.customerName || "-"}
                              </Link>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() =>
                              void updateApproval(approval.id, "revoke")
                            }
                            disabled={approvalBusyId === approval.id}
                          >
                            {approvalBusyId === approval.id
                              ? "Working..."
                              : "Revoke"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                    No released POS commissions found.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className={sectionClass}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Catalog
            </p>
            <h2 className={compactTitleClass}>Product Management</h2>
            <p
              className={`mt-2 ${isProductDeskMode ? "text-[13px] leading-6 text-slate-400" : "text-sm text-slate-400"}`}
            >
              {isProductDeskMode
                ? "Search, edit, and publish products to the shop from one compact catalogue table."
                : "Search, filter, publish, archive, and edit products from one compact catalogue table."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <form
              className={`flex w-full items-center gap-2 ${isProductDeskMode ? "xl:max-w-[34rem]" : "max-w-[32rem]"}`}
              onSubmit={(event) => {
                event.preventDefault();
                runCatalogueSearch();
              }}
            >
              <input
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                placeholder="Search product name, SKU, or category"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-95"
              >
                Search
              </button>
            </form>
            {canManageCommissions ? (
              <select
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                value={buyingPriceFilter}
                onChange={(e) =>
                  setBuyingPriceFilter(
                    e.target.value as "all" | "missing" | "set",
                  )
                }
              >
                <option value="all">All buying prices</option>
                <option value="missing">Without buying price</option>
                <option value="set">With buying price</option>
              </select>
            ) : null}
            {!isProductDeskMode ? (
              <select
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                value={commissionFilter}
                onChange={(e) =>
                  setCommissionFilter(
                    e.target.value as "all" | "enabled" | "disabled",
                  )
                }
              >
                <option value="all">All commissions</option>
                <option value="enabled">With commission</option>
                <option value="disabled">Without commission</option>
              </select>
            ) : null}
            {!isProductDeskMode ? (
              <select
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
                value={warrantyFilter}
                onChange={(e) =>
                  setWarrantyFilter(
                    e.target.value as "all" | "with" | "without",
                  )
                }
              >
                <option value="all">All warranties</option>
                <option value="with">With warranty</option>
                <option value="without">Without warranty</option>
              </select>
            ) : null}
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={fulfilmentSetupFilter}
              onChange={(event) =>
                setFulfilmentSetupFilter(
                  event.target.value as FulfilmentSetupFilter,
                )
              }
            >
              <option value="all">All setup statuses</option>
              <option value="complete">Fulfilment configured</option>
              <option value="incomplete">Needs fulfilment setup</option>
            </select>
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={installationFilter}
              onChange={(event) =>
                setInstallationFilter(event.target.value as InstallationFilter)
              }
            >
              <option value="all">All installation options</option>
              <option value="required">Installation required</option>
              <option value="included">Installation included</option>
              <option value="not-included">
                Installation charged separately
              </option>
              <option value="not-required">Installation not required</option>
            </select>
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={transportFilter}
              onChange={(event) =>
                setTransportFilter(event.target.value as TransportFilter)
              }
            >
              <option value="all">All transport options</option>
              <option value="included">Transport included</option>
              <option value="zone-fees">Zone delivery fees configured</option>
              <option value="missing-fees">Delivery fees need setup</option>
            </select>
            <button
              type="button"
              className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
              onClick={() => {
                setCatalogView("all");
                setFulfilmentSetupFilter("all");
                setInstallationFilter("all");
                setTransportFilter("all");
                setWarrantyFilter("all");
                setBuyingPriceFilter("all");
                setCommissionFilter("all");
              }}
            >
              Clear filters
            </button>
            <label
              className={`flex items-center gap-2 ${isProductDeskMode ? "text-[13px]" : "text-sm"} text-slate-300`}
            >
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show archived products
            </label>
          </div>
        </div>

        <div
          className={`mt-4 flex flex-wrap gap-2 ${isProductDeskMode ? "border-t border-slate-800 pt-3" : ""}`}
        >
          {[
            { key: "all", label: "All" },
            { key: "online", label: "Online Shop" },
            { key: "featured", label: "Featured" },
            { key: "warehouse", label: "Warehouse" },
            { key: "inactive", label: "Inactive" },
            {
              key: "incomplete",
              label: `Needs Setup (${catalogStats.incomplete})`,
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCatalogView(item.key as typeof catalogView)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                catalogView === item.key
                  ? "bg-amber-500 text-slate-950"
                  : "border border-white/10 text-slate-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!canUseBulkActions ? null : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="text-sm text-slate-300">
              {selectedCount
                ? `${selectedCount} selected`
                : "Select products to update or clean up the catalog in bulk."}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                onClick={toggleAllOnPage}
                disabled={!filteredProducts.length || !!bulkBusy}
              >
                {allOnPageSelected ? "Clear page" : "Select page"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void bulkUpdateState(true)}
                disabled={!selectedCount || !!bulkBusy}
              >
                {bulkBusy === "activate" ? "Activating..." : "Enable selected"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void bulkDeleteProducts()}
                disabled={!selectedCount || !!bulkBusy}
              >
                {bulkBusy === "delete" ? "Deleting..." : "Delete selected"}
              </button>
            </div>
          </div>
        )}

        <div
          ref={catalogueTableRef}
          className={`mt-4 overflow-x-auto rounded-2xl border border-slate-800 ${isProductDeskMode ? "bg-slate-950/30" : ""}`}
        >
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {canUseBulkActions ? (
                  <th className={compactCellClass}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      disabled={!filteredProducts.length || !!bulkBusy}
                    />
                  </th>
                ) : null}
                <th className={compactCellClass}>Product</th>
                <th className={compactCellClass}>Category</th>
                <th className={compactCellClass}>Price</th>
                <th className={compactCellClass}>Installation</th>
                <th className={compactCellClass}>Transport</th>
                <th className={compactCellClass}>Website</th>
                <th className={compactCellClass}>Stock / Status</th>
                <th className={`${compactCellClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td
                    colSpan={canUseBulkActions ? 9 : 8}
                    className={`${compactCellClass} py-6 text-center text-slate-400`}
                  >
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length ? (
                filteredProducts.map((product) => {
                  const visibleInShop = Boolean(
                    product.ecommerceVisible ?? product.showInShop,
                  );
                  const automaticWebsiteEligible =
                    hasProductWebsiteImage(product);
                  const websiteStatusDetail = !hasProductWebsiteImage(product)
                    ? "Add an image to publish"
                    : visibleInShop
                      ? "Published automatically"
                      : "Save to publish automatically";
                  const availabilityType = normalizeAvailabilityType(
                    product.availabilityType,
                  );
                  const displayImage =
                    product.mainImageUrl || product.shopImageUrl || "";
                  const shopHref = `${PUBLIC_SHOP_ORIGIN}${getShopProductHref(slugifyShopProductName(product.name))}`;
                  const policy = product.catalogueConfiguration;
                  const fulfilment = getFulfilmentSetup(product);
                  const expanded = expandedProductId === product.id;

                  return (
                    <Fragment key={product.id}>
                      <tr
                        className={
                          draft.id === product.id
                            ? "bg-emerald-500/5"
                            : undefined
                        }
                      >
                        {canUseBulkActions ? (
                          <td className={`${compactCellClass} align-top`}>
                            <input
                              type="checkbox"
                              checked={Boolean(selectedIds[product.id])}
                              onChange={() => toggleSelected(product.id)}
                              disabled={!!bulkBusy}
                            />
                          </td>
                        ) : null}
                        <td className={`${compactCellClass} align-top`}>
                          <div
                            className={`flex items-start ${isProductDeskMode ? "gap-2.5" : "gap-3"}`}
                          >
                            <button
                              type="button"
                              aria-label={
                                expanded ? "Collapse product" : "Expand product"
                              }
                              onClick={() =>
                                setExpandedProductId(
                                  expanded ? null : product.id,
                                )
                              }
                              className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-white/5"
                            >
                              {expanded ? "−" : "+"}
                            </button>
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={product.name}
                                className={`${isProductDeskMode ? "h-12 w-12" : "h-14 w-14"} rounded-xl border border-slate-800 object-cover`}
                              />
                            ) : (
                              <div
                                className={`flex ${isProductDeskMode ? "h-12 w-12" : "h-14 w-14"} items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-400`}
                              >
                                {product.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              {visibleInShop ? (
                                <Link
                                  href={shopHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block max-w-[280px] truncate font-semibold leading-6 text-white underline-offset-4 transition hover:text-emerald-200 hover:underline"
                                  title="Open live shop product page"
                                >
                                  {product.name}
                                </Link>
                              ) : (
                                <div className="max-w-[280px] truncate font-semibold leading-6 text-white">
                                  {product.name}
                                </div>
                              )}
                              <div className="text-xs text-slate-400">
                                {product.category}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {product.brand ? (
                                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                                    {product.brand}
                                  </span>
                                ) : null}
                                {!isProductDeskMode &&
                                (product.warrantyPeriod ??
                                  product.shopWarranty) ? (
                                  <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                                    {product.warrantyPeriod ??
                                      product.shopWarranty}
                                  </span>
                                ) : null}
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] ${availabilityType === "WAREHOUSE" ? "bg-amber-500/15 text-amber-100" : "bg-emerald-500/15 text-emerald-200"}`}
                                >
                                  {availabilityType === "WAREHOUSE"
                                    ? "Warehouse"
                                    : "Shop"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className={`${compactCellClass} align-top text-slate-300`}
                        >
                          <div className="font-medium text-white">
                            {product.sku}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {product.shopCategory || "No shop category"}
                            {product.shopSubcategory
                              ? ` · ${product.shopSubcategory}`
                              : ""}
                          </div>
                        </td>
                        <td
                          className={`${compactCellClass} align-top text-slate-200`}
                        >
                          <div className="font-semibold text-white">
                            {formatMoney(product.sellingPrice)}
                          </div>
                          {canManagePricing ? (
                            <div className="mt-1 text-xs text-slate-400">
                              {product.variableCost
                                ? "Buying price later"
                                : `Buying ${formatMoney(product.lastBuyingPrice)}`}
                            </div>
                          ) : null}
                          {canManageCommissions ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {product.commissionEnabled
                                ? `Commission ${formatMoney(product.commissionAmount)}`
                                : "No commission"}
                            </div>
                          ) : null}
                        </td>
                        <td className={`${compactCellClass} align-top`}>
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${policy ? "bg-cyan-500/15 text-cyan-100" : "bg-amber-500/10 text-amber-100"}`}
                            >
                              {policy
                                ? policy.installationType.replaceAll("_", " ")
                                : "NOT CONFIGURED"}
                            </span>
                            {fulfilment.installationIncluded ? (
                              <div className="text-[10px] text-emerald-300">
                                Included in price
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className={`${compactCellClass} align-top`}>
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${fulfilment.complete ? "bg-emerald-500/15 text-emerald-100" : "bg-amber-500/10 text-amber-100"}`}
                            >
                              {policy
                                ? policy.transportMode.replaceAll("_", " ")
                                : "NOT CONFIGURED"}
                            </span>
                            {!fulfilment.complete ? (
                              <div className="text-[10px] font-semibold text-amber-300">
                                Needs setup
                              </div>
                            ) : fulfilment.transportIncluded ? (
                              <div className="text-[10px] text-emerald-300">
                                Included in price
                              </div>
                            ) : (
                              <div className="text-[10px] text-cyan-200">
                                Zone fees ready
                              </div>
                            )}
                          </div>
                        </td>
                        <td className={`${compactCellClass} align-top`}>
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${visibleInShop ? "bg-emerald-500/15 text-emerald-200" : automaticWebsiteEligible ? "bg-cyan-500/15 text-cyan-100" : "bg-slate-800 text-slate-400"}`}
                            >
                              {visibleInShop
                                ? "Visible online"
                                : automaticWebsiteEligible
                                  ? "Ready for website"
                                  : "Website hidden"}
                            </span>
                            <div className="max-w-[150px] text-[10px] leading-4 text-slate-400">
                              {websiteStatusDetail}
                            </div>
                          </div>
                        </td>
                        <td className={`${compactCellClass} align-top`}>
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-400"}`}
                            >
                              {product.isActive
                                ? "Active in POS"
                                : "Inactive legacy record"}
                            </span>
                            {!product.isActive ? (
                              <div className="max-w-[150px] text-[10px] leading-4 text-slate-400">
                                Edit and save to restore this product to POS.
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={`${compactCellClass} text-right align-top`}
                        >
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                              onClick={() => startEdit(product)}
                            >
                              Edit
                            </button>
                            {canManageCommissions ? (
                              <button
                                type="button"
                                className="rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10"
                                onClick={() => startCommissionEdit(product)}
                              >
                                {product.commissionEnabled
                                  ? "Edit commission"
                                  : "Assign commission"}
                              </button>
                            ) : null}
                            {canDeleteProducts ? (
                              <button
                                type="button"
                                className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => void deleteProduct(product)}
                                disabled={deletingId === product.id}
                              >
                                {deletingId === product.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-slate-900/80">
                          <td
                            colSpan={canUseBulkActions ? 9 : 8}
                            className="px-5 py-5"
                          >
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                  Pricing
                                </div>
                                <div className="mt-2 text-sm text-white">
                                  Selling {formatMoney(product.sellingPrice)}
                                </div>
                                <div className="text-sm text-slate-400">
                                  Buying{" "}
                                  {product.variableCost
                                    ? "Variable"
                                    : formatMoney(product.lastBuyingPrice)}
                                </div>
                                <div className="text-sm text-emerald-300">
                                  Profit{" "}
                                  {product.lastBuyingPrice == null
                                    ? "Pending buying price"
                                    : formatMoney(
                                        Number(product.sellingPrice) -
                                          Number(product.lastBuyingPrice),
                                      )}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                  Catalogue
                                </div>
                                <div className="mt-2 text-sm text-white">
                                  {product.shopCategory || product.category}
                                  {product.shopSubcategory
                                    ? ` / ${product.shopSubcategory}`
                                    : ""}
                                </div>
                                <div className="text-sm text-slate-400">
                                  SKU {product.sku}
                                </div>
                                <div className="text-sm text-slate-400">
                                  {product.productType ||
                                    "Product type not set"}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                  Fulfilment policy
                                </div>
                                <div className="mt-2 text-sm text-white">
                                  Installation:{" "}
                                  {policy
                                    ? policy.installationType.replaceAll(
                                        "_",
                                        " ",
                                      )
                                    : "Not configured"}
                                </div>
                                <div className="text-sm text-slate-400">
                                  Transport:{" "}
                                  {policy
                                    ? policy.transportMode.replaceAll("_", " ")
                                    : "Not configured"}
                                </div>
                                <div className="text-sm text-slate-400">
                                  Availability:{" "}
                                  {availabilityType.replaceAll("_", " ")}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-widest text-slate-500">
                                  Publishing
                                </div>
                                <div className="mt-2 text-sm text-white">
                                  {visibleInShop
                                    ? "Visible online"
                                    : "Hidden online"}
                                </div>
                                <div className="text-sm text-slate-400">
                                  Warranty{" "}
                                  {product.warrantyPeriod ||
                                    product.shopWarranty ||
                                    "not set"}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => startEdit(product)}
                                  className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950"
                                >
                                  Edit full product
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={canUseBulkActions ? 9 : 8}
                    className={`${compactCellClass} py-6 text-center text-slate-400`}
                  >
                    No POS products match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
