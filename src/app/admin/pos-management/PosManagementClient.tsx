"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findSimilarProducts } from "@/lib/posProductSimilarity";
import { showToast } from "@/lib/ui/toast";

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
};

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
};

const fieldClass =
  "w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";

const warrantyOptions = ["", "1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];

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

export default function PosManagementClient() {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [approvals, setApprovals] = useState<CommissionApproval[]>([]);
  const [releasedApprovals, setReleasedApprovals] = useState<CommissionApproval[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<"activate" | "archive" | "delete" | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [buyingPriceFilter, setBuyingPriceFilter] = useState<"all" | "missing" | "set">("all");
  const [commissionFilter, setCommissionFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [warrantyFilter, setWarrantyFilter] = useState<"all" | "with" | "without">("all");
  const formSectionRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async (productQuery = query) => {
    setLoading(true);
    try {
      const [productsRes, approvalsRes, releasedRes] = await Promise.all([
        fetch(`/api/admin/pos-products?q=${encodeURIComponent(productQuery)}&includeInactive=${showInactive ? "1" : "0"}&limit=200`, { cache: "no-store" }),
        fetch(`/api/admin/pos-commissions?status=pending&limit=100`, { cache: "no-store" }),
        fetch(`/api/admin/pos-commissions?status=released&limit=100`, { cache: "no-store" }),
      ]);

      const productsJson = await productsRes.json().catch(() => ({ items: [] }));
      const approvalsJson = await approvalsRes.json().catch(() => ({ items: [] }));
      const releasedJson = await releasedRes.json().catch(() => ({ items: [] }));
      setProducts(Array.isArray(productsJson.items) ? productsJson.items : []);
      setApprovals(Array.isArray(approvalsJson.items) ? approvalsJson.items : []);
      setReleasedApprovals(Array.isArray(releasedJson?.items) ? releasedJson.items : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load POS management data", "error");
    } finally {
      setLoading(false);
    }
  }, [query, showInactive]);

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

    if (buyingPriceFilter === "missing" && hasBuyingPrice) return false;
    if (buyingPriceFilter === "set" && !hasBuyingPrice) return false;
    if (commissionFilter === "enabled" && !product.commissionEnabled) return false;
    if (commissionFilter === "disabled" && product.commissionEnabled) return false;
    if (warrantyFilter === "with" && !hasWarranty) return false;
    if (warrantyFilter === "without" && hasWarranty) return false;
    return true;
  });

  const duplicateMatches = useMemo(
    () =>
      findSimilarProducts(
        draft.name,
        products.filter((product) => product.id !== draft.id),
      ),
    [draft.id, draft.name, products],
  );

  const submitDraft = async () => {
    if (!draft.name.trim()) return showToast("Product name is required", "error");
    if (!draft.sellingPrice.trim()) return showToast("Selling price is required", "error");
    if (!draft.variableCost && !draft.lastBuyingPrice.trim()) {
      return showToast("Buying price is required for fixed-cost products", "error");
    }
    if (draft.commissionEnabled && !draft.commissionAmount.trim()) {
      return showToast("Commission amount is required when product commission is enabled", "error");
    }
    setSaving(true);
    try {
      const payload = {
        sku: draft.sku || undefined,
        name: draft.name,
        category: draft.category,
        sellingPrice: Number(draft.sellingPrice || 0),
        lastBuyingPrice: draft.variableCost ? null : draft.lastBuyingPrice.trim() ? Number(draft.lastBuyingPrice) : null,
        defaultWarranty: draft.defaultWarranty.trim() || null,
        variableCost: draft.variableCost,
        isActive: draft.isActive,
        commissionEnabled: draft.commissionEnabled,
        commissionAmount: draft.commissionEnabled && draft.commissionAmount.trim() ? Number(draft.commissionAmount) : null,
        commissionRequiresApproval: draft.commissionEnabled ? draft.commissionRequiresApproval : false,
      };

      const url = draft.id ? `/api/admin/pos-products/${draft.id}` : "/api/admin/pos-products";
      const method = draft.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to save product"));
      showToast(draft.id ? "Product updated" : "Product created", "success");
      setDraft(emptyDraft);
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
    });
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
    });
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`${product.commissionEnabled ? "Editing" : "Assigning"} commission for ${product.name}`, "success");
  };

  const deleteProduct = async (product: PosProduct) => {
    const confirmed = window.confirm(`Delete "${product.name}" from the POS catalog?`);
    if (!confirmed) return;
    setDeletingId(product.id);
    try {
      const res = await fetch(`/api/admin/pos-products/${product.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiErrorMessage(json, "Failed to delete product"));
      if (draft.id === product.id) {
        setDraft(emptyDraft);
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
    const res = await fetch("/api/admin/pos-products/bulk", {
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
        setDraft(emptyDraft);
      }
      clearSelection();
      await loadData(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete selected products", "error");
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section ref={formSectionRef} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Product Setup</p>
                <h2 className="text-2xl font-semibold text-white">{draft.id ? "Edit POS product" : "Create POS product"}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Set up POS products first, then manage the live catalog below. Keep pricing, SKU, and commission settings together in one place.
                </p>
              </div>
              {draft.id ? (
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => setDraft(emptyDraft)}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
              <label className="text-sm text-slate-300">
                Category
                <input className={`${fieldClass} mt-1`} value={draft.category} onChange={(e) => setDraft((s) => ({ ...s, category: e.target.value }))} />
              </label>
              <label className="text-sm text-slate-300">
                Selling price
                <input className={`${fieldClass} mt-1`} type="number" min="0" value={draft.sellingPrice} onChange={(e) => setDraft((s) => ({ ...s, sellingPrice: e.target.value }))} />
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
                  <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft((s) => ({ ...s, isActive: e.target.checked }))} />
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

            <div className="mt-5 flex flex-wrap items-center gap-3">
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
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog size</div>
              <div className="mt-3 text-3xl font-semibold text-white">{filteredProducts.length}</div>
              <div className="mt-1 text-sm text-slate-400">Products currently loaded in the POS catalog view.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active products</div>
              <div className="mt-3 text-3xl font-semibold text-emerald-300">{filteredProducts.filter((product) => product.isActive).length}</div>
              <div className="mt-1 text-sm text-slate-400">Available for product selection at the receipts desk.</div>
            </div>
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
          </div>
        </div>
      </section>

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

      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Catalog</p>
            <h2 className="text-2xl font-semibold text-white">POS products</h2>
            <p className="mt-2 text-sm text-slate-400">Edit, delete, or review the products currently available to the POS catalog.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <input
              className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              placeholder="Search products"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={buyingPriceFilter}
              onChange={(e) => setBuyingPriceFilter(e.target.value as "all" | "missing" | "set")}
            >
              <option value="all">All buying prices</option>
              <option value="missing">Without buying price</option>
              <option value="set">With buying price</option>
            </select>
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={commissionFilter}
              onChange={(e) => setCommissionFilter(e.target.value as "all" | "enabled" | "disabled")}
            >
              <option value="all">All commissions</option>
              <option value="enabled">With commission</option>
              <option value="disabled">Without commission</option>
            </select>
            <select
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
              value={warrantyFilter}
              onChange={(e) => setWarrantyFilter(e.target.value as "all" | "with" | "without")}
            >
              <option value="all">All warranties</option>
              <option value="with">With warranty</option>
              <option value="without">Without warranty</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Show archived products
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3">
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
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950/70 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} disabled={!filteredProducts.length || !!bulkBusy} />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Prices</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading products...</td>
                </tr>
              ) : filteredProducts.length ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className={draft.id === product.id ? "bg-emerald-500/5" : undefined}>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[product.id])}
                        onChange={() => toggleSelected(product.id)}
                        disabled={!!bulkBusy}
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="max-w-xl font-semibold leading-8 text-white">{product.name}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">{product.sku} · {product.category}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      <div>Selling: {formatMoney(product.sellingPrice)}</div>
                      <div className="text-xs text-slate-400">
                        {product.variableCost ? "Buying: priced later" : `Buying: ${formatMoney(product.lastBuyingPrice)}`}
                      </div>
                      <div className="text-xs text-slate-400">
                        Warranty: {product.defaultWarranty || "None"}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-200">
                      {product.commissionEnabled ? (
                        <>
                          <div>{formatMoney(product.commissionAmount)}</div>
                          <div className="text-xs text-slate-400">
                            {product.commissionRequiresApproval ? "Approval required" : "Auto release"}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.isActive ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-400"}`}>
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10"
                          onClick={() => startCommissionEdit(product)}
                        >
                          {product.commissionEnabled ? "Edit commission" : "Assign commission"}
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void deleteProduct(product)}
                          disabled={deletingId === product.id}
                        >
                          {deletingId === product.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">No POS products match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
