"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findSimilarProducts } from "@/lib/posProductSimilarity";
import { showToast } from "@/lib/ui/toast";
import { getShopSubcategoryOptions, SHOP_CATEGORY_DEFINITIONS, SHOP_CATEGORY_OPTIONS, resolveShopSubcategory } from "@/app/shop/shopCatalogConfig";

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
  galleryImageUrls?: string[] | null;
  brandImageUrl?: string | null;
  tiktokVideoUrl?: string | null;
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
  galleryImageUrls: boolean;
  brandImageUrl: boolean;
  tiktokVideoUrl: boolean;
  ecommerceVisible: boolean;
  isFeatured: boolean;
  status: boolean;
  availabilityType: boolean;
  pickupDelayDays: boolean;
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

type ProductAvailabilityType = "SHOP" | "WAREHOUSE";

type CommissionApproval = {
  id: string;
  amount: number | string;
  status: string;
  createdAt: string;
  staff?: { name?: string | null; email?: string | null } | null;
  orderItem?: {
    product?: { name?: string | null; sku?: string | null } | null;
    order?: { orderNumber?: string | null; customerName?: string | null } | null;
  } | null;
};

type ProductDraft = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  sellingPrice: string;
  lastBuyingPrice: string;
  defaultWarranty: string;
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
  galleryImageUrls: string[];
  brandImageUrl: string;
  tiktokVideoUrl: string;
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
};

type PosManagementClientProps = {
  mode?: "admin" | "product-desk";
};

const emptyDraft: ProductDraft = {
  sku: "",
  name: "",
  category: "pos",
  sellingPrice: "",
  lastBuyingPrice: "",
  defaultWarranty: "",
  variableCost: false,
  isActive: true,
  commissionEnabled: false,
  commissionAmount: "",
  commissionRequiresApproval: false,
  brand: "",
  shortDescription: "",
  description: "",
  specifications: "",
  warrantyPeriod: "",
  warrantyNotes: "",
  mainImageUrl: "",
  galleryImageUrls: [],
  brandImageUrl: "",
  tiktokVideoUrl: "",
  ecommerceVisible: false,
  isFeatured: false,
  status: "ACTIVE",
  availabilityType: "SHOP",
  pickupDelayDays: 0,
  showInShop: false,
  shopCategory: "",
  shopSubcategory: "",
  shopShortDescription: "",
  shopWarranty: "",
  shopSpecs: "",
  shopImageUrl: "",
  shopBrand: "",
};

function createDraftDefaults(mode: "admin" | "product-desk"): ProductDraft {
  return {
    ...emptyDraft,
    ecommerceVisible: mode === "product-desk",
    showInShop: mode === "product-desk",
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
  galleryImageUrls: false,
  brandImageUrl: false,
  tiktokVideoUrl: false,
  ecommerceVisible: false,
  isFeatured: false,
  status: false,
  availabilityType: false,
  pickupDelayDays: false,
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

const warrantyOptions = ["", "1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];

function normalizeAvailabilityType(value: string | null | undefined): ProductAvailabilityType {
  return String(value || "").trim().toUpperCase() === "WAREHOUSE" ? "WAREHOUSE" : "SHOP";
}

function getAvailabilityPreviewMessage(type: ProductAvailabilityType) {
  return type === "WAREHOUSE"
    ? "Customer will see: Available from warehouse. Pickup or delivery available after 1 day."
    : "Customer will see: Available at shop for immediate pickup.";
}

function detectShopCategoryAndSubcategory(input: Pick<ProductDraft, "name" | "category" | "brand" | "specifications" | "shopCategory">) {
  const haystack = [input.name, input.category, input.brand, input.specifications].join(" ").toLowerCase();
  const directCategory =
    SHOP_CATEGORY_DEFINITIONS.find((category) =>
      category.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
    ) ?? SHOP_CATEGORY_DEFINITIONS.find((category) => category.value === input.shopCategory);

  if (!directCategory) {
    return { shopCategory: "", shopSubcategory: "" };
  }

  const subcategory =
    resolveShopSubcategory(directCategory.value, [input.name, input.category, input.brand, input.specifications]) ??
    null;

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
        return parsed.map((entry) => String(entry || "").trim()).filter(Boolean);
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
    const formErrors = Array.isArray((error as { formErrors?: unknown }).formErrors)
      ? (error as { formErrors: unknown[] }).formErrors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const fieldErrorsRaw = (error as { fieldErrors?: Record<string, unknown> }).fieldErrors;
    const fieldErrors = fieldErrorsRaw && typeof fieldErrorsRaw === "object"
      ? Object.entries(fieldErrorsRaw)
          .flatMap(([field, value]) =>
            Array.isArray(value)
              ? value
                  .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
                  .map((message) => `${field}: ${message}`)
              : [],
          )
      : [];
    const combined = [...formErrors, ...fieldErrors];
    if (combined.length) return combined.join(". ");
  }

  return fallback;
}

export default function PosManagementClient({ mode = "admin" }: PosManagementClientProps) {
  const isProductDeskMode = mode === "product-desk";
  const canManagePricing = !isProductDeskMode;
  const canManageCommissions = !isProductDeskMode;
  const canManageActivation = !isProductDeskMode;
  const canDeleteProducts = !isProductDeskMode;
  const canUseBulkActions = !isProductDeskMode;
  const canManageFeaturedStatus = !isProductDeskMode;
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [capabilities, setCapabilities] = useState<PosCatalogueCapabilities>(defaultCapabilities);
  const [approvals, setApprovals] = useState<CommissionApproval[]>([]);
  const [releasedApprovals, setReleasedApprovals] = useState<CommissionApproval[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(() => createDraftDefaults(mode));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<"main" | "gallery" | "brand" | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"activate" | "archive" | "delete" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [catalogView, setCatalogView] = useState<"all" | "online" | "featured" | "warehouse" | "inactive">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [buyingPriceFilter, setBuyingPriceFilter] = useState<"all" | "missing" | "set">("all");
  const [commissionFilter, setCommissionFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [warrantyFilter, setWarrantyFilter] = useState<"all" | "with" | "without">("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const productApiBase = "/api/admin/pos-products";

  const loadData = useCallback(async (productQuery = query) => {
    setLoading(true);
    try {
      const requests = [
        fetch(`${productApiBase}?q=${encodeURIComponent(productQuery)}&includeInactive=${showInactive ? "1" : "0"}&limit=200`, { cache: "no-store" }),
        ...(isProductDeskMode
          ? []
          : [
              fetch(`/api/admin/pos-commissions?status=pending&limit=100`, { cache: "no-store" }),
              fetch(`/api/admin/pos-commissions?status=released&limit=100`, { cache: "no-store" }),
            ]),
      ];
      const responses = await Promise.all(requests);
      const productsRes = responses[0]!;
      const approvalsRes = isProductDeskMode ? null : responses[1] ?? null;
      const releasedRes = isProductDeskMode ? null : responses[2] ?? null;

      const productsJson = await productsRes.json().catch(() => ({ items: [], capabilities: defaultCapabilities }));
      const approvalsJson = approvalsRes ? await approvalsRes.json().catch(() => ({ items: [] })) : { items: [] };
      const releasedJson = releasedRes ? await releasedRes.json().catch(() => ({ items: [] })) : { items: [] };
      setProducts(Array.isArray(productsJson.items) ? productsJson.items : []);
      setCapabilities(productsJson.capabilities && typeof productsJson.capabilities === "object" ? productsJson.capabilities : defaultCapabilities);
      setApprovals(Array.isArray(approvalsJson.items) ? approvalsJson.items : []);
      setReleasedApprovals(Array.isArray(releasedJson?.items) ? releasedJson.items : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load POS management data", "error");
    } finally {
      setLoading(false);
    }
  }, [isProductDeskMode, productApiBase, query, showInactive]);

  useEffect(() => {
    void loadData("");
  }, [loadData]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadData(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, loadData]);

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

  const filteredProducts = products.filter((product) => {
    const hasBuyingPrice = Number(product.lastBuyingPrice ?? 0) > 0;
    const hasWarranty = Boolean(product.defaultWarranty?.trim());
    const visibleInShop = Boolean(product.ecommerceVisible ?? product.showInShop);
    const featuredInShop = Boolean(product.isFeatured);
    const warehouseOnly = normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE";
    const inactive = !product.isActive;

    if (buyingPriceFilter === "missing" && hasBuyingPrice) return false;
    if (buyingPriceFilter === "set" && !hasBuyingPrice) return false;
    if (commissionFilter === "enabled" && !product.commissionEnabled) return false;
    if (commissionFilter === "disabled" && product.commissionEnabled) return false;
    if (warrantyFilter === "with" && !hasWarranty) return false;
    if (warrantyFilter === "without" && hasWarranty) return false;
    if (catalogView === "online" && !visibleInShop) return false;
    if (catalogView === "featured" && !featuredInShop) return false;
    if (catalogView === "warehouse" && !warehouseOnly) return false;
    if (catalogView === "inactive" && !inactive) return false;
    return true;
  });
  const catalogStats = useMemo(() => {
    const total = products.length;
    const online = products.filter((product) => Boolean(product.ecommerceVisible ?? product.showInShop)).length;
    const featured = products.filter((product) => Boolean(product.isFeatured)).length;
    const warehouse = products.filter((product) => normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE").length;
    const inactive = products.filter((product) => !product.isActive).length;
    return { total, online, featured, warehouse, inactive };
  }, [products]);

  const duplicateMatches = useMemo(
    () =>
      findSimilarProducts(
        draft.name,
        products.filter((product) => product.id !== draft.id),
      ),
    [draft.id, draft.name, products],
  );
  const shopSubcategoryOptions = useMemo(() => getShopSubcategoryOptions(draft.shopCategory), [draft.shopCategory]);
  const availabilityPreview = useMemo(() => getAvailabilityPreviewMessage(draft.availabilityType), [draft.availabilityType]);
  const suggestedShopTaxonomy = useMemo(
    () =>
      detectShopCategoryAndSubcategory({
        name: draft.name,
        category: draft.category,
        brand: draft.brand,
        specifications: draft.specifications,
        shopCategory: draft.shopCategory,
      }),
    [draft.brand, draft.category, draft.name, draft.shopCategory, draft.specifications],
  );

  const uploadProductImage = useCallback(async (file: File, kind: "main" | "gallery" | "brand") => {
    setUploadingKind(kind);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      form.append("productId", draft.id || draft.sku || draft.name || "draft");
      const res = await fetch(`${productApiBase}/upload`, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to upload image"));
      const url = typeof json?.url === "string" ? json.url : "";
      if (!url) throw new Error("Upload did not return a file URL");
      return url;
    } finally {
      setUploadingKind(null);
    }
  }, [draft.id, draft.name, draft.sku, productApiBase]);

  const openCreateEditor = useCallback(() => {
    setDraft(createDraftDefaults(mode));
    setEditorOpen(true);
    window.requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [mode]);

  const applySuggestedShopTaxonomy = useCallback(() => {
    setDraft((current) => ({
      ...current,
      shopCategory: suggestedShopTaxonomy.shopCategory || current.shopCategory,
      shopSubcategory: suggestedShopTaxonomy.shopSubcategory,
    }));
  }, [suggestedShopTaxonomy.shopCategory, suggestedShopTaxonomy.shopSubcategory]);

  const applyQuickEcommerceDefaults = useCallback(() => {
    setDraft((current) => {
      const taxonomy = detectShopCategoryAndSubcategory({
        name: current.name,
        category: current.category,
        brand: current.brand,
        specifications: current.specifications,
        shopCategory: current.shopCategory,
      });

      return {
        ...current,
        ecommerceVisible: true,
        showInShop: true,
        shopCategory: taxonomy.shopCategory || current.shopCategory,
        shopSubcategory: taxonomy.shopSubcategory,
        shopBrand: current.shopBrand || current.brand,
        shopShortDescription: current.shopShortDescription || current.shortDescription,
        shopWarranty: current.shopWarranty || current.warrantyPeriod || current.defaultWarranty,
        shopSpecs: current.shopSpecs || current.specifications,
        shopImageUrl: current.shopImageUrl || current.mainImageUrl,
      };
    });
    setEditorOpen(true);
  }, [mode]);

  const quickPatchProduct = useCallback(async (product: PosProduct, patch: Record<string, unknown>, successMessage: string) => {
    try {
      const res = await fetch(`${productApiBase}/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to update product"));
      showToast(successMessage, "success");
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update product", "error");
    }
  }, [loadData, productApiBase, query]);

  const submitDraft = async () => {
    if (!draft.name.trim()) return showToast("Product name is required", "error");
    if (!draft.sellingPrice.trim()) return showToast("Selling price is required", "error");
    if (canManagePricing && !draft.variableCost && !draft.lastBuyingPrice.trim()) {
      return showToast("Buying price is required for fixed-cost products", "error");
    }
    if (canManageCommissions && draft.commissionEnabled && !draft.commissionAmount.trim()) {
      return showToast("Commission amount is required when product commission is enabled", "error");
    }
    setSaving(true);
    try {
      const payload = {
        sku: draft.sku || undefined,
        name: draft.name,
        category: isProductDeskMode ? "pos" : draft.category,
        sellingPrice: Number(draft.sellingPrice || 0),
        ...(canManagePricing
          ? {
              lastBuyingPrice: draft.variableCost ? null : draft.lastBuyingPrice.trim() ? Number(draft.lastBuyingPrice) : null,
              defaultWarranty: draft.defaultWarranty.trim() || null,
              variableCost: draft.variableCost,
            }
          : {}),
        isActive: isProductDeskMode ? true : draft.status === "ACTIVE" && draft.isActive,
        commissionEnabled: isProductDeskMode ? false : draft.commissionEnabled,
        commissionAmount:
          canManageCommissions && draft.commissionEnabled && draft.commissionAmount.trim()
            ? Number(draft.commissionAmount)
            : null,
        commissionRequiresApproval: canManageCommissions && draft.commissionEnabled ? draft.commissionRequiresApproval : false,
        ...(capabilities.brand ? { brand: draft.brand.trim() || null } : {}),
        ...(capabilities.shortDescription ? { shortDescription: draft.shortDescription.trim() || null } : {}),
        ...(capabilities.warrantyPeriod ? { warrantyPeriod: draft.warrantyPeriod.trim() || null } : {}),
        ...(capabilities.mainImageUrl ? { mainImageUrl: draft.mainImageUrl.trim() || null } : {}),
        ...(capabilities.galleryImageUrls ? { galleryImageUrls: draft.galleryImageUrls } : {}),
        ...(capabilities.tiktokVideoUrl ? { tiktokVideoUrl: draft.tiktokVideoUrl.trim() || null } : {}),
        ...(capabilities.ecommerceVisible ? { ecommerceVisible: isProductDeskMode ? true : draft.ecommerceVisible } : {}),
        ...(capabilities.isFeatured ? { isFeatured: canManageFeaturedStatus ? draft.isFeatured : false } : {}),
        ...(capabilities.status ? { status: isProductDeskMode ? "ACTIVE" : draft.status } : {}),
        ...(capabilities.availabilityType ? { availabilityType: draft.availabilityType } : {}),
        ...(capabilities.pickupDelayDays ? { pickupDelayDays: draft.pickupDelayDays } : {}),
        ...(capabilities.showInShop ? { showInShop: isProductDeskMode ? true : draft.showInShop } : {}),
        ...(capabilities.shopCategory ? { shopCategory: draft.shopCategory || null } : {}),
        ...(capabilities.shopSubcategory ? { shopSubcategory: draft.shopSubcategory || null } : {}),
        ...(capabilities.shopShortDescription ? { shopShortDescription: draft.shopShortDescription.trim() || null } : {}),
        ...(capabilities.shopWarranty ? { shopWarranty: draft.shopWarranty.trim() || null } : {}),
        ...(capabilities.shopSpecs ? { shopSpecs: draft.shopSpecs.trim() || null } : {}),
        ...(capabilities.shopImageUrl ? { shopImageUrl: draft.shopImageUrl.trim() || null } : {}),
        ...(capabilities.shopBrand ? { shopBrand: draft.shopBrand.trim() || null } : {}),
      };

      const url = draft.id ? `${productApiBase}/${draft.id}` : productApiBase;
      const method = draft.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to save product"));
      showToast(draft.id ? "Product updated" : "Product created", "success");
      setDraft(createDraftDefaults(mode));
      setEditorOpen(false);
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (product: PosProduct) => {
    setDraft({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      sellingPrice: String(product.sellingPrice ?? ""),
      lastBuyingPrice: product.lastBuyingPrice == null ? "" : String(product.lastBuyingPrice),
      defaultWarranty: product.defaultWarranty ?? "",
      variableCost: Boolean(product.variableCost),
      isActive: Boolean(product.isActive),
      commissionEnabled: Boolean(product.commissionEnabled),
      commissionAmount: product.commissionAmount == null ? "" : String(product.commissionAmount),
      commissionRequiresApproval: Boolean(product.commissionRequiresApproval),
      brand: product.brand ?? product.shopBrand ?? "",
      shortDescription: product.shortDescription ?? product.shopShortDescription ?? "",
      description: product.description ?? "",
      specifications: Array.isArray(product.specifications) ? product.specifications.join("\n") : String(product.specifications ?? product.shopSpecs ?? ""),
      warrantyPeriod: product.warrantyPeriod ?? product.shopWarranty ?? "",
      warrantyNotes: product.warrantyNotes ?? "",
      mainImageUrl: product.mainImageUrl ?? product.shopImageUrl ?? "",
      galleryImageUrls: parseStringArray(product.galleryImageUrls),
      brandImageUrl: product.brandImageUrl ?? "",
      tiktokVideoUrl: product.tiktokVideoUrl ?? "",
      ecommerceVisible: Boolean(product.ecommerceVisible ?? product.showInShop),
      isFeatured: Boolean(product.isFeatured),
      status: String(product.status || (product.isActive ? "ACTIVE" : "INACTIVE")).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      availabilityType: normalizeAvailabilityType(product.availabilityType),
      pickupDelayDays: normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE" ? 1 : 0,
      showInShop: Boolean(product.showInShop),
      shopCategory: product.shopCategory ?? "",
      shopSubcategory: product.shopSubcategory ?? "",
      shopShortDescription: product.shopShortDescription ?? "",
      shopWarranty: product.shopWarranty ?? "",
      shopSpecs: product.shopSpecs ?? "",
      shopImageUrl: product.shopImageUrl ?? "",
      shopBrand: product.shopBrand ?? "",
    });
    setEditorOpen(true);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`Editing ${product.name}`, "success");
  };

  const startCommissionEdit = (product: PosProduct) => {
    setDraft({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      sellingPrice: String(product.sellingPrice ?? ""),
      lastBuyingPrice: product.lastBuyingPrice == null ? "" : String(product.lastBuyingPrice),
      defaultWarranty: product.defaultWarranty ?? "",
      variableCost: Boolean(product.variableCost),
      isActive: Boolean(product.isActive),
      commissionEnabled: true,
      commissionAmount: product.commissionAmount == null ? "" : String(product.commissionAmount),
      commissionRequiresApproval: Boolean(product.commissionRequiresApproval),
      brand: product.brand ?? product.shopBrand ?? "",
      shortDescription: product.shortDescription ?? product.shopShortDescription ?? "",
      description: product.description ?? "",
      specifications: Array.isArray(product.specifications) ? product.specifications.join("\n") : String(product.specifications ?? product.shopSpecs ?? ""),
      warrantyPeriod: product.warrantyPeriod ?? product.shopWarranty ?? "",
      warrantyNotes: product.warrantyNotes ?? "",
      mainImageUrl: product.mainImageUrl ?? product.shopImageUrl ?? "",
      galleryImageUrls: parseStringArray(product.galleryImageUrls),
      brandImageUrl: product.brandImageUrl ?? "",
      tiktokVideoUrl: product.tiktokVideoUrl ?? "",
      ecommerceVisible: Boolean(product.ecommerceVisible ?? product.showInShop),
      isFeatured: Boolean(product.isFeatured),
      status: String(product.status || (product.isActive ? "ACTIVE" : "INACTIVE")).toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
      availabilityType: normalizeAvailabilityType(product.availabilityType),
      pickupDelayDays: normalizeAvailabilityType(product.availabilityType) === "WAREHOUSE" ? 1 : 0,
      showInShop: Boolean(product.showInShop),
      shopCategory: product.shopCategory ?? "",
      shopSubcategory: product.shopSubcategory ?? "",
      shopShortDescription: product.shopShortDescription ?? "",
      shopWarranty: product.shopWarranty ?? "",
      shopSpecs: product.shopSpecs ?? "",
      shopImageUrl: product.shopImageUrl ?? "",
      shopBrand: product.shopBrand ?? "",
    });
    setEditorOpen(true);
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`${product.commissionEnabled ? "Editing" : "Assigning"} commission for ${product.name}`, "success");
  };

  const deleteProduct = async (product: PosProduct) => {
    const confirmed = window.confirm(`Delete "${product.name}" from the POS catalog?`);
    if (!confirmed) return;
    setDeletingId(product.id);
    try {
      const res = await fetch(`${productApiBase}/${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to delete product"));
      if (draft.id === product.id) {
        setDraft(createDraftDefaults(mode));
        setEditorOpen(false);
      }
      showToast(json?.message || "Product deleted", "success");
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete product", "error");
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
      if (!response.ok) throw new Error(getApiErrorMessage(json, "AI formatting failed"));

      const nextName = typeof json?.description === "string" ? json.description.trim() : "";
      if (!nextName) {
        throw new Error("AI formatting returned no product name");
      }

      setDraft((current) => ({ ...current, name: nextName }));
      showToast("Product name cleaned up", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "AI formatting failed", "error");
    } finally {
      setAiBusy(false);
    }
  };

  const updateApproval = async (id: string, action: "approve" | "reject" | "revoke") => {
    setApprovalBusyId(id);
    try {
      const res = await fetch(`/api/admin/pos-commissions/${id}/${action}`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, `Failed to ${action} commission`));
      showToast(action === "revoke" ? "Commission approval revoked" : `Commission ${action}d`, "success");
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : `Failed to ${action} commission`, "error");
    } finally {
      setApprovalBusyId(null);
    }
  };

  const visibleSelectedProducts = filteredProducts.filter((product) => selectedIds[product.id]);
  const selectedCount = visibleSelectedProducts.length;
  const allOnPageSelected = filteredProducts.length > 0 && selectedCount === filteredProducts.length;

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
    if (!res.ok) throw new Error(getApiErrorMessage(json, `Failed to ${action} selected products`));
    return json;
  };

  const bulkUpdateState = async (isActive: boolean) => {
    if (!selectedCount) return showToast("Select at least one product", "error");
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
      showToast(err instanceof Error ? err.message : "Failed to update selected products", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkDeleteProducts = async () => {
    if (!selectedCount) return showToast("Select at least one product", "error");
    const confirmed = window.confirm(
      `Delete ${selectedCount} selected product${selectedCount === 1 ? "" : "s"}? Linked products will be archived so historical POS receipts remain unchanged.`,
    );
    if (!confirmed) return;
    setBulkBusy("delete");
    try {
      const json = await bulkRequest("delete");
      showToast(json?.message || "Bulk catalog cleanup complete", "success");
      if (draft.id && selectedIds[draft.id]) {
        setDraft(createDraftDefaults(mode));
      }
      clearSelection();
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete selected products", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  const shellSpacingClass = isProductDeskMode ? "space-y-4" : "space-y-6";
  const sectionClass = isProductDeskMode
    ? "rounded-[28px] border border-white/10 bg-slate-900/90 p-4 shadow-xl shadow-black/35"
    : "rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40";
  const compactTitleClass = isProductDeskMode ? "text-xl font-semibold text-white" : "text-2xl font-semibold text-white";
  const compactCellClass = isProductDeskMode ? "px-3 py-2.5" : "px-4 py-3";

  return (
    <div className={shellSpacingClass}>
      <section className={isProductDeskMode ? "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(15,23,42,0.88)_100%)] p-4 shadow-xl shadow-black/35" : "rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/40"}>
        <div className={`flex flex-col ${isProductDeskMode ? "gap-3 lg:flex-row lg:items-end lg:justify-between" : "gap-4 xl:flex-row xl:items-end xl:justify-between"}`}>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{isProductDeskMode ? "Product Desk" : "Manage Products"}</p>
            <h2 className={`mt-1 ${compactTitleClass}`}>{isProductDeskMode ? "Create and publish products faster" : "Fast catalogue workflow for POS and online shop"}</h2>
            <p className={`mt-2 ${isProductDeskMode ? "max-w-2xl text-[13px] leading-6 text-slate-400" : "max-w-3xl text-sm text-slate-400"}`}>
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
            <button
              type="button"
              className="rounded-xl border border-emerald-400/30 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10"
              onClick={applyQuickEcommerceDefaults}
            >
              Quick Shop Setup
            </button>
          </div>
        </div>

        <div className={`mt-4 grid gap-3 ${isProductDeskMode ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-5"}`}>
          {[
            { key: "all", label: "All Products", value: catalogStats.total },
            { key: "online", label: "Online Shop", value: catalogStats.online },
            { key: "featured", label: "Featured", value: catalogStats.featured },
            { key: "warehouse", label: "Warehouse", value: catalogStats.warehouse },
            { key: "inactive", label: "Inactive", value: catalogStats.inactive },
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</div>
              <div className={`mt-2 font-semibold text-white ${isProductDeskMode ? "text-xl" : "text-2xl"}`}>{card.value}</div>
            </button>
          ))}
          {isProductDeskMode ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3.5 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Desk flow</div>
              <div className="mt-2 text-sm font-semibold text-white">Add product, fill shop fields, save, then fine-tune from the table.</div>
            </div>
          ) : null}
        </div>
      </section>

      <section ref={formSectionRef} className={sectionClass}>
        <div className={`grid ${isProductDeskMode ? "gap-4 xl:grid-cols-[1.45fr_0.55fr]" : "gap-6 xl:grid-cols-[1.25fr_0.75fr]"}`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product Setup</p>
                <h2 className={compactTitleClass}>{draft.id ? "Edit POS product" : "Create POS product"}</h2>
                <p className={`mt-2 max-w-2xl ${isProductDeskMode ? "text-[13px] leading-6 text-slate-400" : "text-sm text-slate-400"}`}>
                  {isProductDeskMode
                    ? "Keep product content, images, TikTok, and shop publishing details together in one compact editor."
                    : "Keep pricing, SKU, ecommerce details, images, and availability together in one compact editor."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setEditorOpen((current) => !current)}
                >
                  {editorOpen ? "Collapse" : "Open editor"}
                </button>
                {(draft.id || editorOpen) ? (
                  <button
                    type="button"
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                    onClick={() => {
                      setDraft(createDraftDefaults(mode));
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
            <div className={`mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 ${isProductDeskMode ? "px-3 py-2.5 text-[13px]" : "px-4 py-3 text-sm"} text-slate-300`}>
              <span className="font-semibold text-emerald-200">Quick setup:</span>
              <button
                type="button"
                className="rounded-full border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
                onClick={applyQuickEcommerceDefaults}
              >
                Fill online shop defaults
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                onClick={applySuggestedShopTaxonomy}
              >
                Detect category & subcategory
              </button>
              {suggestedShopTaxonomy.shopCategory ? (
                <span className="text-xs text-slate-400">
                  Suggested: <span className="text-white">{SHOP_CATEGORY_OPTIONS.find((option) => option.value === suggestedShopTaxonomy.shopCategory)?.label}</span>
                  {suggestedShopTaxonomy.shopSubcategory
                    ? ` · ${shopSubcategoryOptions.find((option) => option.value === suggestedShopTaxonomy.shopSubcategory)?.label || suggestedShopTaxonomy.shopSubcategory}`
                    : ""}
                </span>
              ) : null}
            </div>
            <div className={`mt-5 grid ${isProductDeskMode ? "gap-3 md:grid-cols-2" : "gap-4 md:grid-cols-2"}`}>
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
                  onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
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
                        <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 text-sm">
                          <div>
                            <div className="font-medium text-white">{item.name}</div>
                            <div className="text-xs text-slate-300">
                              {item.sku} · Selling {formatMoney(item.sellingPrice)}
                            </div>
                          </div>
                          <div className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-semibold text-amber-100">
                            {Math.round(score * 100)}% similar
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-amber-100/80">
                      This product looks similar to items already in the catalog. Edit or reuse an existing product where possible.
                    </div>
                  </div>
                ) : null}
              </div>
              <label className="text-sm text-slate-300">
                SKU
                <input className={`${fieldClass} mt-1`} value={draft.sku} onChange={(e) => setDraft((s) => ({ ...s, sku: e.target.value }))} placeholder="Auto-generated if empty" />
              </label>
              {!isProductDeskMode ? (
                <label className="text-sm text-slate-300">
                  Category
                  <input className={`${fieldClass} mt-1`} value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} />
                </label>
              ) : null}
              <label className="text-sm text-slate-300">
                Selling price
                <input className={`${fieldClass} mt-1`} type="number" min="0" value={draft.sellingPrice} onChange={(e) => setDraft((s) => ({ ...s, sellingPrice: e.target.value }))} />
              </label>
              {!isProductDeskMode ? (
                <>
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={draft.variableCost}
                        onChange={(e) =>
                          setDraft((s) => ({
                            ...s,
                            variableCost: e.target.checked,
                            lastBuyingPrice: e.target.checked ? "" : s.lastBuyingPrice,
                          }))
                        }
                      />
                      Variable-cost project
                    </label>
                    {draft.variableCost ? (
                      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                        Buying price is set later by an admin after the POS sale is captured.
                      </div>
                    ) : (
                      <label className="block text-sm text-slate-300">
                        Buying price
                        <input className={`${fieldClass} mt-1`} type="number" min="0" value={draft.lastBuyingPrice} onChange={(e) => setDraft((s) => ({ ...s, lastBuyingPrice: e.target.value }))} />
                      </label>
                    )}
                  </div>
                  <label className="text-sm text-slate-300">
                    Default receipt warranty
                    <select
                      className={`${fieldClass} mt-1`}
                      value={draft.defaultWarranty}
                      onChange={(e) => setDraft((s) => ({ ...s, defaultWarranty: e.target.value }))}
                    >
                      <option value="">No default warranty</option>
                      {warrantyOptions.filter(Boolean).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) => setDraft((s) => ({ ...s, isActive: e.target.checked, status: e.target.checked ? "ACTIVE" : "INACTIVE" }))}
                      />
                      Active in POS catalog
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" checked={draft.commissionEnabled} onChange={(e) => setDraft((s) => ({ ...s, commissionEnabled: e.target.checked }))} />
                      Enable product commission
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={draft.commissionRequiresApproval}
                        onChange={(e) => setDraft((s) => ({ ...s, commissionRequiresApproval: e.target.checked }))}
                        disabled={!draft.commissionEnabled}
                      />
                      Require approval
                    </label>
                  </div>
                </>
              ) : null}
            </div>

            <div className={`mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 ${isProductDeskMode ? "p-3.5" : "p-4"}`}>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Online Shop Controls</div>
              <p className="mt-2 text-sm text-slate-300">
                These controls feed the Betech Solar online shop from the existing POS Catalogue. Unsupported fields stay disabled until the Product table is upgraded safely.
              </p>
              {!(capabilities.showInShop || capabilities.shopCategory || capabilities.shopSubcategory || capabilities.shopShortDescription || capabilities.shopWarranty || capabilities.shopSpecs || capabilities.shopImageUrl || capabilities.shopBrand) ? (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  Live Product table is currently in <span className="font-semibold uppercase">{capabilities.schemaMode}</span> compatibility mode. `showInShop`, `shopCategory`, `shopSubcategory`, and the ecommerce display fields are planned but not yet fully persisted in this database shape.
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  {isProductDeskMode ? (
                    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-3 text-sm text-emerald-100">
                      Products from this desk save as <span className="font-semibold">Active</span> and <span className="font-semibold">visible in shop</span> by default.
                    </div>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={draft.ecommerceVisible}
                          disabled={!(capabilities.ecommerceVisible || capabilities.showInShop)}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              ecommerceVisible: e.target.checked,
                              showInShop: e.target.checked,
                            }))
                          }
                        />
                        Ecommerce visible
                      </label>
                      <div className="text-xs text-slate-500">Default should remain off until the product is shop-ready and solar-safe.</div>
                      <label className="flex items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={draft.isFeatured}
                          disabled={!capabilities.isFeatured}
                          onChange={(e) => setDraft((s) => ({ ...s, isFeatured: e.target.checked }))}
                        />
                        Featured product
                      </label>
                      <label className="text-sm text-slate-300">
                        Product status
                        <select
                          className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                          value={draft.status}
                          disabled={!capabilities.status}
                          onChange={(e) =>
                            setDraft((s) => ({
                              ...s,
                              status: e.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                              isActive: e.target.value !== "INACTIVE",
                            }))
                          }
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>

                <label className="text-sm text-slate-300">
                  Shop category
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">Main online shop category</span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                      onClick={applySuggestedShopTaxonomy}
                    >
                      Auto-detect
                    </button>
                  </div>
                  <select
                    className={`${fieldClass} mt-2 disabled:cursor-not-allowed disabled:opacity-60`}
                    value={draft.shopCategory}
                    disabled={!capabilities.shopCategory}
                    onChange={(e) => setDraft((s) => ({ ...s, shopCategory: e.target.value, shopSubcategory: "" }))}
                  >
                    <option value="">Select shop category</option>
                    {SHOP_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-300">
                  Shop subcategory
                  <select
                    className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                    value={draft.shopSubcategory}
                    disabled={!capabilities.shopSubcategory || !draft.shopCategory}
                    onChange={(e) => setDraft((s) => ({ ...s, shopSubcategory: e.target.value }))}
                  >
                    <option value="">{draft.shopCategory ? "Select shop subcategory" : "Select category first"}</option>
                    {shopSubcategoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-500">
                    {capabilities.shopSubcategory ? "Use a subcategory to keep the online shop organized and searchable." : "Subcategory support is being enabled on this database."}
                  </div>
                </label>

                <label className="text-sm text-slate-300">
                  Brand
                  <input
                    className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                    value={draft.brand}
                    disabled={!(capabilities.brand || capabilities.shopBrand)}
                    onChange={(e) => setDraft((s) => ({ ...s, brand: e.target.value, shopBrand: e.target.value }))}
                    placeholder="Optional ecommerce brand label"
                  />
                </label>

                <label className="text-sm text-slate-300 md:col-span-2">
                  Short description
                  <textarea
                    className={`${fieldClass} mt-1 min-h-[96px] disabled:cursor-not-allowed disabled:opacity-60`}
                    value={draft.shortDescription}
                    disabled={!(capabilities.shortDescription || capabilities.shopShortDescription)}
                    onChange={(e) => setDraft((s) => ({ ...s, shortDescription: e.target.value, shopShortDescription: e.target.value }))}
                    placeholder="Short customer-facing description"
                  />
                </label>

                <label className="text-sm text-slate-300">
                  Warranty period
                  <select
                    className={`${fieldClass} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
                    value={draft.warrantyPeriod}
                    disabled={!(capabilities.warrantyPeriod || capabilities.shopWarranty)}
                    onChange={(e) => setDraft((s) => ({ ...s, warrantyPeriod: e.target.value, shopWarranty: e.target.value }))}
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
                    onChange={(e) => setDraft((s) => ({ ...s, tiktokVideoUrl: e.target.value }))}
                    placeholder="https://www.tiktok.com/@account/video/1234567890"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Paste the TikTok product video link. The video will be embedded directly on the product page.
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
                          onChange={() => setDraft((s) => ({ ...s, availabilityType: "SHOP", pickupDelayDays: 0 }))}
                        />
                        Available at Shop
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Same-day pickup message.</div>
                    </label>
                    <label className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="availabilityType"
                          checked={draft.availabilityType === "WAREHOUSE"}
                          disabled={!capabilities.availabilityType}
                          onChange={() => setDraft((s) => ({ ...s, availabilityType: "WAREHOUSE", pickupDelayDays: 1 }))}
                        />
                        Available in Warehouse
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Warn customer about 1 day pickup or delivery delay.</div>
                    </label>
                  </div>
                  <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
                    {availabilityPreview}
                  </div>
                </label>

                <div className="text-sm text-slate-300 md:col-span-2">
                  Images
                  <div className="mt-2 grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Main image</div>
                      {draft.mainImageUrl ? <img src={draft.mainImageUrl} alt="Main preview" className="mt-3 h-24 w-full rounded-lg object-cover" /> : <div className="mt-3 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">No main image</div>}
                      <input
                        className="mt-3 block w-full text-xs text-slate-300"
                        type="file"
                        accept="image/*"
                        disabled={!(capabilities.mainImageUrl || capabilities.shopImageUrl) || uploadingKind !== null}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadProductImage(file, "main");
                            setDraft((s) => ({ ...s, mainImageUrl: url, shopImageUrl: url }));
                            showToast("Main image uploaded", "success");
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : "Failed to upload main image", "error");
                          } finally {
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                      <button type="button" className="mt-2 text-xs text-slate-400 hover:text-white" onClick={() => setDraft((s) => ({ ...s, mainImageUrl: "", shopImageUrl: "" }))}>Remove main image</button>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Gallery images</div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {draft.galleryImageUrls.length ? draft.galleryImageUrls.map((url, index) => (
                          <div key={`${url}-${index}`} className="relative">
                            <img src={url} alt={`Gallery ${index + 1}`} className="h-20 w-full rounded-lg object-cover" />
                            <button type="button" className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white" onClick={() => setDraft((s) => ({ ...s, galleryImageUrls: s.galleryImageUrls.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
                          </div>
                        )) : <div className="col-span-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">No gallery images</div>}
                      </div>
                      <input
                        className="mt-3 block w-full text-xs text-slate-300"
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!capabilities.galleryImageUrls || uploadingKind !== null}
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (!files.length) return;
                          try {
                            const uploaded: string[] = [];
                            for (const file of files) {
                              uploaded.push(await uploadProductImage(file, "gallery"));
                            }
                            setDraft((s) => ({ ...s, galleryImageUrls: [...s.galleryImageUrls, ...uploaded] }));
                            showToast("Gallery images uploaded", "success");
                          } catch (err) {
                            showToast(err instanceof Error ? err.message : "Failed to upload gallery images", "error");
                          } finally {
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {draft.commissionEnabled ? (
              <div className="mt-4">
                <label className="text-sm text-slate-300">
                  Commission per sold item
                  <input
                    className={`${fieldClass} mt-1`}
                    type="number"
                    min="0"
                    value={draft.commissionAmount}
                    onChange={(e) => setDraft((s) => ({ ...s, commissionAmount: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}

            <div className={`mt-5 flex flex-wrap items-center gap-3 ${isProductDeskMode ? "border-t border-slate-800 pt-4" : ""}`}>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void submitDraft()}
                disabled={saving}
              >
                {saving ? "Saving..." : draft.id ? "Update product" : "Create product"}
              </button>
              {draft.id ? (
                <div className="text-sm text-emerald-200">
                  Editing: <span className="font-semibold text-white">{draft.name || draft.sku || "POS product"}</span>
                </div>
              ) : null}
            </div>
            </>
            ) : (
              <div className={`mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 ${isProductDeskMode ? "px-3.5 py-3 text-[13px]" : "px-4 py-4 text-sm"} text-slate-300`}>
                {isProductDeskMode
                  ? "Open the editor only when needed, then keep routine publishing and corrections moving from the catalog below."
                  : "Open the editor when you want to add a new product, update ecommerce details, or fix pricing and commission data."}
              </div>
            )}
          </div>

            <div className={`grid gap-3 ${isProductDeskMode ? "sm:grid-cols-2 xl:grid-cols-1 xl:content-start" : "sm:grid-cols-3 xl:grid-cols-1"}`}>
            <div className={`rounded-2xl border border-slate-800 bg-slate-950/60 ${isProductDeskMode ? "p-3.5" : "p-4"}`}>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog size</div>
              <div className={`mt-3 font-semibold text-white ${isProductDeskMode ? "text-2xl" : "text-3xl"}`}>{filteredProducts.length}</div>
              <div className={`${isProductDeskMode ? "mt-1 text-[13px]" : "mt-1 text-sm"} text-slate-400`}>Products currently loaded in the POS catalog view.</div>
            </div>
            <div className={`rounded-2xl border border-slate-800 bg-slate-950/60 ${isProductDeskMode ? "p-3.5" : "p-4"}`}>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active products</div>
              <div className={`mt-3 font-semibold text-emerald-300 ${isProductDeskMode ? "text-2xl" : "text-3xl"}`}>{filteredProducts.filter((product) => product.isActive).length}</div>
              <div className={`${isProductDeskMode ? "mt-1 text-[13px]" : "mt-1 text-sm"} text-slate-400`}>Available for product selection at the receipts desk.</div>
            </div>
            {isProductDeskMode ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">Publishing defaults</div>
                <div className="mt-2 text-sm font-medium text-white">Products from this desk save active and visible in shop.</div>
                <div className="mt-1 text-[13px] text-emerald-100/80">Keep focus on content quality, images, and correct shop classification.</div>
              </div>
            ) : null}
            {!isProductDeskMode ? (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending approvals</div>
                  <div className="mt-3 text-3xl font-semibold text-amber-200">{approvals.length}</div>
                  <div className="mt-1 text-sm text-slate-400">Commission requests waiting for release or rejection.</div>
                </div>
                <a href="/admin/receipts/missing-buying" className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 hover:bg-amber-400/15">
                  <div className="text-xs uppercase tracking-[0.2em] text-amber-200">Admin pricing</div>
                  <div className="mt-3 text-lg font-semibold text-white">Price variable-cost sales</div>
                  <div className="mt-1 text-sm text-amber-100/80">Set buying prices after POS project sales so profit and commissions update.</div>
                </a>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {!isProductDeskMode ? (
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Approvals</p>
              <h2 className="text-xl font-semibold text-white">Pending POS commissions</h2>
            </div>
            <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
              {approvals.length} pending
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {approvals.length ? (
              approvals.map((approval) => (
                <div key={approval.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-semibold text-white">
                        {approval.orderItem?.product?.name || "Product"} · {formatMoney(approval.amount)}
                      </div>
                      <div className="text-sm text-slate-300">
                        Staff: {approval.staff?.name || approval.staff?.email || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-400">
                        Receipt: {approval.orderItem?.order?.orderNumber || "-"} · Customer: {approval.orderItem?.order?.customerName || "-"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void updateApproval(approval.id, "approve")}
                        disabled={approvalBusyId === approval.id}
                      >
                        {approvalBusyId === approval.id ? "Working..." : "Approve"}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void updateApproval(approval.id, "reject")}
                        disabled={approvalBusyId === approval.id}
                      >
                        {approvalBusyId === approval.id ? "Working..." : "Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
                No commission approvals are waiting right now.
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Recently released</h3>
                <p className="text-xs text-slate-400">Revoke approvals that were released by mistake.</p>
              </div>
              <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                {releasedApprovals.length} released
              </div>
            </div>
            <div className="space-y-3">
              {releasedApprovals.length ? (
                releasedApprovals.map((approval) => (
                  <div key={approval.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-white">
                          {approval.orderItem?.product?.name || "Product"} · {formatMoney(approval.amount)}
                        </div>
                        <div className="text-sm text-slate-300">
                          Staff: {approval.staff?.name || approval.staff?.email || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-400">
                          Receipt: {approval.orderItem?.order?.orderNumber || "-"} · Customer: {approval.orderItem?.order?.customerName || "-"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void updateApproval(approval.id, "revoke")}
                        disabled={approvalBusyId === approval.id}
                      >
                        {approvalBusyId === approval.id ? "Working..." : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))
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
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog</p>
              <h2 className={compactTitleClass}>Product Management</h2>
              <p className={`mt-2 ${isProductDeskMode ? "text-[13px] leading-6 text-slate-400" : "text-sm text-slate-400"}`}>
                {isProductDeskMode
                  ? "Search, edit, and publish products to the shop from one compact catalogue table."
                  : "Search, filter, publish, archive, and edit products from one compact catalogue table."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <input
                className={`w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 ${isProductDeskMode ? "xl:min-w-[22rem]" : "max-w-sm"}`}
                placeholder="Search name, SKU, or category"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            {!isProductDeskMode ? <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={buyingPriceFilter}
              onChange={(e) => setBuyingPriceFilter(e.target.value as "all" | "missing" | "set")}
            >
              <option value="all">All buying prices</option>
              <option value="missing">Without buying price</option>
              <option value="set">With buying price</option>
            </select> : null}
            {!isProductDeskMode ? <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={commissionFilter}
              onChange={(e) => setCommissionFilter(e.target.value as "all" | "enabled" | "disabled")}
            >
              <option value="all">All commissions</option>
              <option value="enabled">With commission</option>
              <option value="disabled">Without commission</option>
            </select> : null}
            {!isProductDeskMode ? <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value as "all" | "with" | "without")}
            >
              <option value="all">All warranties</option>
              <option value="with">With warranty</option>
              <option value="without">Without warranty</option>
            </select> : null}
            <label className={`flex items-center gap-2 ${isProductDeskMode ? "text-[13px]" : "text-sm"} text-slate-300`}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show archived products
            </label>
            </div>
          </div>

          <div className={`mt-4 flex flex-wrap gap-2 ${isProductDeskMode ? "border-t border-slate-800 pt-3" : ""}`}>
            {[
              { key: "all", label: "All" },
              { key: "online", label: "Online Shop" },
              { key: "featured", label: "Featured" },
              { key: "warehouse", label: "Warehouse" },
              { key: "inactive", label: "Inactive" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setCatalogView(item.key as typeof catalogView)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  catalogView === item.key ? "bg-amber-500 text-slate-950" : "border border-white/10 text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

        {!canUseBulkActions ? null : <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
          <div className="text-sm text-slate-300">
            {selectedCount ? `${selectedCount} selected` : "Select products to update or clean up the catalog in bulk."}
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
              className="rounded-xl border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void bulkUpdateState(false)}
              disabled={!selectedCount || !!bulkBusy}
            >
              {bulkBusy === "archive" ? "Archiving..." : "Disable selected"}
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
        </div>}

        <div className={`mt-4 overflow-x-auto rounded-2xl border border-slate-800 ${isProductDeskMode ? "bg-slate-950/30" : ""}`}>
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {canUseBulkActions ? <th className={compactCellClass}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} disabled={!filteredProducts.length || !!bulkBusy} />
                </th> : null}
                <th className={compactCellClass}>Product</th>
                <th className={compactCellClass}>Seller SKU</th>
                <th className={compactCellClass}>Price</th>
                <th className={compactCellClass}>Shop</th>
                <th className={compactCellClass}>Active</th>
                <th className={`${compactCellClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td colSpan={canUseBulkActions ? 7 : 6} className={`${compactCellClass} py-6 text-center text-slate-400`}>Loading products...</td>
                </tr>
              ) : filteredProducts.length ? (
                filteredProducts.map((product) => {
                  const visibleInShop = Boolean(product.ecommerceVisible ?? product.showInShop);
                  const availabilityType = normalizeAvailabilityType(product.availabilityType);
                  const displayImage = product.mainImageUrl || product.shopImageUrl || "";
                  const shopHref = `/shop/product/${slugifyShopProductName(product.name)}`;

                  return <tr key={product.id} className={draft.id === product.id ? "bg-emerald-500/5" : undefined}>
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
                      <div className={`flex items-start ${isProductDeskMode ? "gap-2.5" : "gap-3"}`}>
                        {displayImage ? (
                          <img src={displayImage} alt={product.name} className={`${isProductDeskMode ? "h-12 w-12" : "h-14 w-14"} rounded-xl border border-slate-800 object-cover`} />
                        ) : (
                          <div className={`flex ${isProductDeskMode ? "h-12 w-12" : "h-14 w-14"} items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-400`}>
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
                            <div className="max-w-[280px] truncate font-semibold leading-6 text-white">{product.name}</div>
                          )}
                          <div className="text-xs text-slate-400">{product.category}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {product.brand ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{product.brand}</span> : null}
                            {!isProductDeskMode && product.defaultWarranty ? <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{product.defaultWarranty}</span> : null}
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${availabilityType === "WAREHOUSE" ? "bg-amber-500/15 text-amber-100" : "bg-emerald-500/15 text-emerald-200"}`}>
                              {availabilityType === "WAREHOUSE" ? "Warehouse" : "Shop"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`${compactCellClass} align-top text-slate-300`}>
                      <div className="font-medium text-white">{product.sku}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {product.shopCategory || "No shop category"}
                        {product.shopSubcategory ? ` · ${product.shopSubcategory}` : ""}
                      </div>
                    </td>
                    <td className={`${compactCellClass} align-top text-slate-200`}>
                      <div className="font-semibold text-white">{formatMoney(product.sellingPrice)}</div>
                      {canManagePricing ? <div className="mt-1 text-xs text-slate-400">
                        {product.variableCost ? "Buying price later" : `Buying ${formatMoney(product.lastBuyingPrice)}`}
                      </div> : null}
                      {canManageCommissions ? <div className="mt-1 text-xs text-slate-500">
                        {product.commissionEnabled ? `Commission ${formatMoney(product.commissionAmount)}` : "No commission"}
                      </div> : null}
                    </td>
                    <td className={`${compactCellClass} align-top`}>
                      <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${visibleInShop ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                          {visibleInShop ? "Visible online" : "Hidden online"}
                        </span>
                        <button
                          type="button"
                          className="block rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void quickPatchProduct(
                            product,
                            { ecommerceVisible: !visibleInShop, showInShop: !visibleInShop },
                            visibleInShop ? "Removed from online shop" : "Published to online shop",
                          )}
                          disabled={!(capabilities.ecommerceVisible || capabilities.showInShop)}
                        >
                          {visibleInShop ? "Hide" : "Show"} in shop
                        </button>
                      </div>
                    </td>
                    <td className={`${compactCellClass} align-top`}>
                      <div className="space-y-2">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${product.isActive ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                        {canManageActivation ? <button
                          type="button"
                          className="block rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/5"
                          onClick={() => void quickPatchProduct(
                            product,
                            { isActive: !product.isActive, status: product.isActive ? "INACTIVE" : "ACTIVE" },
                            product.isActive ? "Product archived" : "Product activated",
                          )}
                        >
                          Set {product.isActive ? "inactive" : "active"}
                        </button> : null}
                      </div>
                    </td>
                    <td className={`${compactCellClass} text-right align-top`}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </button>
                        {canManageCommissions ? <button
                          type="button"
                          className="rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10"
                          onClick={() => startCommissionEdit(product)}
                        >
                          {product.commissionEnabled ? "Edit commission" : "Assign commission"}
                        </button> : null}
                        {canDeleteProducts ? <button
                          type="button"
                          className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void deleteProduct(product)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? "Deleting..." : "Delete"}
                        </button> : null}
                      </div>
                    </td>
                  </tr>;
                })
              ) : (
                <tr>
                  <td colSpan={canUseBulkActions ? 7 : 6} className={`${compactCellClass} py-6 text-center text-slate-400`}>No POS products match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
