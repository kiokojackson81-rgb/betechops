"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type MarketplaceShopOption = {
  id: string;
  displayName: string | null;
  shopName?: string | null;
  platform: "JUMIA" | "KILIMALL";
  primaryAttendantId?: string | null;
};

export type MarketplaceWeekOption = {
  startInput: string;
  endInput: string;
  label: string;
};

type PreviewRow = {
  key: string;
  dateUtc: string;
  orderNo: string;
  orderItemNo: string;
  details: string;
  sellerSku: string;
  jumiaSku: string;
  itemCreditTxn: string;
  commissionTxn: string | null;
  shippingTxn: string | null;
  otherTxn: string[];
  grossSale: number;
  commission: number;
  shippingFee: number;
  otherFees: number;
  netPayout: number;
  statementNumber: string;
  paidStatus: string;
  orderItemStatus: string;
  shippingProvider: string;
  trackingNumber: string;
  countryCode: string;
};

type DraftSummary = {
  id: string;
  week: { weekStart: string; weekEnd: string };
  rowCount: number;
  submittedCount: number;
  totalNetPayout: number;
  updatedAt: string;
  isComplete: boolean;
};

type WeekStatus = {
  weeklySale: { amount: number; updatedAt: string; source: string; status: string } | null;
  draft:
    | {
        id: string;
        platform: string;
        rowCount: number;
        submittedCount: number;
        isComplete: boolean;
        updatedAt?: string;
      }
    | null;
};

export default function MarketplaceWeeklyCsvUpload(props: {
  title?: string;
  shops: MarketplaceShopOption[];
  weeks: MarketplaceWeekOption[];
  defaultWeekStart?: string;
  defaultShopId?: string;
  assignees?: Array<{ id: string; name: string }>;
  defaultAssigneeId?: string;
  disableAssigneeSelect?: boolean;
  hideSummaryTotals?: boolean;
  impersonateId?: string | null;
  onImported?: () => void;
}) {
  const weeks = props.weeks ?? [];
  const defaultWeekStart = props.defaultWeekStart ?? weeks.at(-1)?.startInput ?? weeks[0]?.startInput ?? "";

  const [shopId, setShopId] = useState(props.defaultShopId ?? "");
  const [weekStart, setWeekStart] = useState<string>(defaultWeekStart);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingTxns, setExistingTxns] = useState<string[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [buyingByTxn, setBuyingByTxn] = useState<Record<string, string>>({});
  const [savedBuyingByTxn, setSavedBuyingByTxn] = useState<Record<string, string>>({});
  const [autofilledByTxn, setAutofilledByTxn] = useState<Record<string, true>>({});
  const [submitted, setSubmitted] = useState(false);
  const [draftId, setDraftId] = useState<string>("");
  const [submittingTxn, setSubmittingTxn] = useState<string>("");
  const [submittedByTxn, setSubmittedByTxn] = useState<Record<string, string>>({});
  const [resolvedAccountId, setResolvedAccountId] = useState<string>("");
  const [localOnlyDraft, setLocalOnlyDraft] = useState(false);
  const [openDrafts, setOpenDrafts] = useState<DraftSummary[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [autoSubmitDoneKey, setAutoSubmitDoneKey] = useState<string>("");
  const [weekStatusByShopId, setWeekStatusByShopId] = useState<Record<string, WeekStatus>>({});
  const [showOnlyUnpriced, setShowOnlyUnpriced] = useState(false);

  const effectiveWeekStart = weekStart || defaultWeekStart;

  const selectedWeek = useMemo(() => weeks.find((w) => w.startInput === effectiveWeekStart) ?? null, [weeks, effectiveWeekStart]);
  const selectedShop = useMemo(() => props.shops.find((s) => s.id === shopId) ?? null, [props.shops, shopId]);

  const refreshWeekStatus = useCallback(async () => {
    const ws = String(effectiveWeekStart ?? "").trim();
    if (!ws) return;
    if (!props.shops.length) return;

    try {
      const res = await fetch(withImpersonateId("/api/admin/marketplace-profit-entry/week-status", props.impersonateId ?? null), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekStart: ws, shopIds: props.shops.map((s) => s.id) }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) return;
      const next: Record<string, WeekStatus> = {};
      const items = Array.isArray(data?.items) ? (data.items as any[]) : [];
      for (const it of items) {
        const id = String(it?.shopId ?? "").trim();
        if (!id) continue;
        next[id] = { weeklySale: (it?.weeklySale as any) ?? null, draft: (it?.draft as any) ?? null };
      }
      setWeekStatusByShopId(next);
    } catch {
      // Ignore; status is a nice-to-have.
    }
  }, [effectiveWeekStart, props.shops, props.impersonateId]);

  useEffect(() => {
    void refreshWeekStatus();
  }, [refreshWeekStatus]);

  const buildDraftKey = useCallback((sid: string, weekStartInput: string) => {
    const s = String(sid ?? "").trim();
    const w = String(weekStartInput ?? "").trim();
    if (!s || !w) return "";
    return `betechops:csv-draft:v1:${s}:${w}`;
  }, []);

  const draftKey = useMemo(() => {
    if (!shopId || !weekStart) return "";
    return `betechops:csv-draft:v1:${shopId}:${weekStart}`;
  }, [shopId, weekStart]);

  const lastDraftPointerKey = useMemo(() => {
    if (!shopId) return "";
    return `betechops:csv-draft:last-week:${shopId}`;
  }, [shopId]);

  // Restore last selected shop for faster data entry.
  useEffect(() => {
    if (shopId) return;
    if (!props.shops.length) return;
    try {
      const saved = String(localStorage.getItem("betechops:csv:last-shop") ?? "").trim();
      if (saved && props.shops.some((s) => s.id === saved)) {
        setShopId(saved);
        return;
      }
    } catch {}
    // Default to first shop if nothing saved yet.
    setShopId(props.shops[0]?.id ?? "");
  }, [props.shops, shopId]);

  useEffect(() => {
    if (!shopId) return;
    try {
      localStorage.setItem("betechops:csv:last-shop", shopId);
    } catch {}
  }, [shopId]);

  // Restore last used week (auto-detected) for this shop so reload resumes where you left off.
  useEffect(() => {
    if (!shopId) return;
    if (weekStart) return;
    try {
      const w = String(localStorage.getItem(lastDraftPointerKey) ?? "").trim();
      if (w) setWeekStart(w);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, lastDraftPointerKey]);

  const totals = useMemo(() => {
    const netPayout = rows.reduce((sum, r) => sum + Number(r.netPayout ?? 0), 0);
    const grossSale = rows.reduce((sum, r) => sum + Number(r.grossSale ?? 0), 0);
    const duplicates = rows.filter((r) => existingTxns.includes(r.itemCreditTxn)).length;
    const profit = rows.reduce((sum, r) => {
      if (!submittedByTxn[r.itemCreditTxn]) return sum;
      const buying = Number(buyingByTxn[r.itemCreditTxn] ?? 0);
      return sum + (Number(r.netPayout ?? 0) - (Number.isFinite(buying) ? buying : 0));
    }, 0);
    const submittedCount = Object.keys(submittedByTxn).length;
    return { netPayout, grossSale, duplicates, profit, submittedCount };
  }, [rows, existingTxns, buyingByTxn, submittedByTxn]);

  const loadDraftById = useCallback(
    async (did: string) => {
      const res = await fetch(
        withImpersonateId(`/api/admin/marketplace-profit-entry/csv/draft/${encodeURIComponent(did)}`, props.impersonateId ?? null),
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Failed to load draft");
      const draftRows = Array.isArray(data?.rows) ? (data.rows as PreviewRow[]) : [];
      const wsIso = String(data?.weekStart ?? data?.week?.weekStart ?? "").trim();
      const wsInput = wsIso ? new Date(wsIso).toISOString().slice(0, 10) : "";
      const buying = data?.buyingByTxn && typeof data.buyingByTxn === "object" ? (data.buyingByTxn as Record<string, any>) : {};
      const submittedMap =
        data?.submittedByTxn && typeof data.submittedByTxn === "object" ? (data.submittedByTxn as Record<string, any>) : {};
      setRows(draftRows);
      if (wsInput) setWeekStart(wsInput);
      const buyingMap = Object.fromEntries(Object.entries(buying).map(([k, v]) => [k, String(v)]));
      setBuyingByTxn(buyingMap);
      setSubmittedByTxn(Object.fromEntries(Object.entries(submittedMap).map(([k, v]) => [k, String(v)])));
      setSavedBuyingByTxn((prev) => {
        const next = { ...prev };
        for (const [txn, entryId] of Object.entries(submittedMap)) {
          if (!entryId) continue;
          const raw = String(buyingMap[String(txn)] ?? "").trim();
          if (raw) next[String(txn)] = raw;
        }
        return next;
      });
      setSubmitted(Object.keys(submittedMap).length > 0);
      setDraftId(did);
      setLocalOnlyDraft(false);
    },
    [props.impersonateId],
  );

  const loadOpenDrafts = useCallback(async () => {
    if (!shopId) return;
    setLoadingDrafts(true);
    try {
      const res = await fetch(
        withImpersonateId(
          `/api/admin/marketplace-profit-entry/csv/drafts/open?shopId=${encodeURIComponent(shopId)}`,
          props.impersonateId ?? null,
        ),
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Failed to load drafts");
      const items = Array.isArray(data?.open)
        ? (data.open as DraftSummary[])
        : Array.isArray(data?.items)
          ? (data.items as DraftSummary[])
          : [];
      setOpenDrafts(items);
    } catch {
      setOpenDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, [props.impersonateId, shopId]);

  useEffect(() => {
    if (!shopId) return;
    void loadOpenDrafts();
  }, [loadOpenDrafts, shopId]);

  const loadStatement = async () => {
    if (!shopId) {
      showToast("Select a shop first", "error");
      return;
    }
    if (!file) {
      showToast("Upload a statement file first", "error");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.set("accountId", shopId);
      if (effectiveWeekStart) form.set("weekStart", effectiveWeekStart);
      // weekStart defaults to server detection when not supplied.
      // userId is inferred from the shop's primary attendant unless explicitly provided in server-side rules.
      form.set("file", file);

      const fileName = String(file.name || "").toLowerCase();
      const isPdf = fileName.endsWith(".pdf");
      const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
      const platform = selectedShop?.platform;
      if (isPdf && platform !== "KILIMALL") {
        throw new Error("PDF upload is only supported for Kilimall shops.");
      }
      if (platform === "KILIMALL" && !isXlsx) {
        throw new Error("For Kilimall, upload the Seller Center Excel (.xlsx) export.");
      }
      const previewEndpoint = isXlsx
        ? "/api/admin/marketplace-profit-entry/xlsx/preview"
        : isPdf
          ? "/api/admin/marketplace-profit-entry/pdf/preview"
          : "/api/admin/marketplace-profit-entry/csv/preview";

      const res = await fetch(withImpersonateId(previewEndpoint, props.impersonateId ?? null), {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Preview failed");

      if (data?.alreadyUploaded && String(data?.draftId ?? "").trim()) {
        const did = String(data.draftId).trim();
        const detectedWeekStartIso = String(data?.week?.weekStart ?? "").trim();
        const detectedInput = detectedWeekStartIso ? new Date(detectedWeekStartIso).toISOString().slice(0, 10) : "";
        if (detectedInput) setWeekStart(detectedInput);
        setDraftId(did);
        setLocalOnlyDraft(false);
        setFile(null);
        showToast("Statement already uploaded for this week. Resuming saved draft.", "warn");
        await loadDraftById(did);
        return;
      }

      const items = Array.isArray(data?.items) ? (data.items as PreviewRow[]) : [];
      const suggested =
        data?.suggestedBuyingByTxn && typeof data.suggestedBuyingByTxn === "object"
          ? (data.suggestedBuyingByTxn as Record<string, any>)
          : {};
      setRows(items);
      setExistingTxns(Array.isArray(data?.existingTxns) ? (data.existingTxns as string[]) : []);
      const suggestedMap = Object.fromEntries(
        Object.entries(suggested)
          .map(([k, v]) => [String(k), String(v)] as const)
          .filter(([k, v]) => k.trim() && v.trim()),
      );
      setBuyingByTxn(suggestedMap);
      setAutofilledByTxn(Object.fromEntries(Object.keys(suggestedMap).map((k) => [k, true] as const)));
      setSavedBuyingByTxn({});
      setSubmitted(false);
      setSubmittedByTxn({});
      setResolvedAccountId(String(data?.account?.id ?? "").trim());
      setLocalOnlyDraft(false);

      const detectedWeekStartIso = String(data?.week?.weekStart ?? "").trim();
      const detectedInput = detectedWeekStartIso ? new Date(detectedWeekStartIso).toISOString().slice(0, 10) : "";
      if (detectedWeekStartIso) {
        setWeekStart(detectedInput);
      }

      const storageKey = buildDraftKey(shopId, detectedInput || defaultWeekStart);

      const did = String(data?.draftId ?? "").trim();
      if (did) {
        setDraftId(did);
        try {
          localStorage.setItem(storageKey, JSON.stringify({ id: did, savedAt: new Date().toISOString() }));
          if (lastDraftPointerKey) localStorage.setItem(lastDraftPointerKey, detectedInput || defaultWeekStart);
        } catch {}
      } else {
        setDraftId("");
        setLocalOnlyDraft(true);
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              mode: "local",
              savedAt: new Date().toISOString(),
              shopId,
              weekStart: detectedWeekStartIso ? new Date(detectedWeekStartIso).toISOString().slice(0, 10) : weekStart,
              accountId: String(data?.account?.id ?? "").trim(),
              existingTxns: Array.isArray(data?.existingTxns) ? (data.existingTxns as string[]) : [],
              rows: items,
              buyingByTxn: Object.fromEntries(
                Object.entries(suggested)
                  .map(([k, v]) => [String(k), String(v)] as const)
                  .filter(([k, v]) => k.trim() && v.trim()),
              ),
              submittedByTxn: {},
            }),
          );
          if (lastDraftPointerKey) localStorage.setItem(lastDraftPointerKey, detectedInput || defaultWeekStart);
        } catch {}
        showToast("Draft saved locally (DB update pending). You can still submit rows.", "warn");
      }
      if (data?.aggregated?.errors?.length) {
        showToast(String(data.aggregated.errors[0] ?? "Preview warning"), "warn");
      }
      if (typeof data?.excluded === "number" && data.excluded > 0) {
        showToast(`Filtered out ${data.excluded} orders outside the current week`, "warn");
      }
      if (data?.noOrdersInWeek) {
        showToast("No orders in the selected week. Recorded payout as Ksh 0.", "warn");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Preview failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const perRowProfit = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const net = Number(r.netPayout ?? 0);
      if (!Number.isFinite(net) || net < 0) continue;
      const buyingRaw = String(buyingByTxn[r.itemCreditTxn] ?? "").trim();
      const buying = Number(buyingRaw);
      if (!buyingRaw || !Number.isFinite(buying) || buying < 0) continue;
      map.set(r.itemCreditTxn, net - buying);
    }
    return map;
  }, [rows, buyingByTxn]);

  const unpricedCounts = useMemo(() => {
    let returns = 0;
    let submittedCount = 0;
    let unpriced = 0;

    for (const r of rows) {
      const net = Number(r.netPayout ?? 0);
      const gross = Number(r.grossSale ?? 0);
      const status = String(r.orderItemStatus ?? "").toLowerCase();
      const isReturn =
        status.includes("return") ||
        status.includes("refund") ||
        (Number.isFinite(net) && net < 0) ||
        (Number.isFinite(gross) && gross < 0);

      if (isReturn) {
        returns += 1;
        continue;
      }

      if (submittedByTxn[r.itemCreditTxn]) submittedCount += 1;
      else unpriced += 1;
    }

    return { returns, submittedCount, unpriced };
  }, [rows, submittedByTxn]);

  const visibleRows = useMemo(() => {
    if (!showOnlyUnpriced) return rows;

    return rows.filter((r) => {
      const net = Number(r.netPayout ?? 0);
      const gross = Number(r.grossSale ?? 0);
      const status = String(r.orderItemStatus ?? "").toLowerCase();
      const isReturn =
        status.includes("return") ||
        status.includes("refund") ||
        (Number.isFinite(net) && net < 0) ||
        (Number.isFinite(gross) && gross < 0);
      if (isReturn) return false;
      if (existingTxns.includes(r.itemCreditTxn)) return false;
      if (submittedByTxn[r.itemCreditTxn]) return false;
      return true;
    });
  }, [rows, showOnlyUnpriced, existingTxns, submittedByTxn]);

  const matchKeyByTxn = useMemo(() => {
    const normalizeText = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^\p{L}\p{N}\s._-]+/gu, "");
    const normalizeSku = (value: unknown) => normalizeText(value).replace(/\s+/g, "");
    const moneyKey = (value: number) => {
      const n = Number(value ?? 0);
      return Number.isFinite(n) ? n.toFixed(2) : "0.00";
    };

    const map = new Map<string, string>();
    for (const r of rows) {
      const sku = normalizeSku(r.jumiaSku || r.sellerSku || "");
      const name = normalizeText(r.details || "");
      const price = moneyKey(Number(r.grossSale ?? 0));
      map.set(r.itemCreditTxn, `${sku}|${name}|${price}`);
    }
    return map;
  }, [rows]);

  const updateBuying = (txn: string, next: string) => {
    setBuyingByTxn((prev) => ({ ...prev, [txn]: next }));
  };

  const propagateBuyingToMatches = (txn: string) => {
    const raw = String(buyingByTxn[txn] ?? "").trim();
    const buying = Number(raw);
    if (!raw || !Number.isFinite(buying) || buying < 0) return;

    const key = matchKeyByTxn.get(txn) ?? "";
    if (!key) return;

    setBuyingByTxn((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (r.itemCreditTxn === txn) continue;
        if ((matchKeyByTxn.get(r.itemCreditTxn) ?? "") !== key) continue;
        const net = Number(r.netPayout ?? 0);
        if (Number.isFinite(net) && net < 0) continue;
        if (submittedByTxn[r.itemCreditTxn]) continue;
        const existing = String(next[r.itemCreditTxn] ?? "").trim();
        if (existing) continue;
        next[r.itemCreditTxn] = raw;
      }
      return next;
    });
  };

  const submitRow = async (txn: string, opts?: { auto?: boolean; silent?: boolean }) => {
    const raw = String(buyingByTxn[txn] ?? "").trim();
    const buying = Number(raw);
    if (!raw || !Number.isFinite(buying) || buying < 0) {
      if (!opts?.silent) showToast("Enter a valid buying price", "error");
      return;
    }

    const row = rows.find((r) => r.itemCreditTxn === txn) ?? null;
    if (!row) {
      showToast("Row not found", "error");
      return;
    }
    const net = Number(row.netPayout ?? 0);
    if (Number.isFinite(net) && net < 0) {
      if (!opts?.silent) showToast("Return detected (negative payout). Skip buying price for this row.", "warn");
      return;
    }

    setSubmittingTxn(txn);
    try {
      const existingEntryId = String(submittedByTxn[txn] ?? "").trim();
      const isSubmitted = Boolean(existingEntryId);
      const lastSaved = String(savedBuyingByTxn[txn] ?? "").trim();
      if (isSubmitted && lastSaved && lastSaved === raw) {
        if (!opts?.silent) showToast("No changes", "warn");
        return;
      }

      if (isSubmitted && existingEntryId && !draftId) {
        const res = await fetch(withImpersonateId(`/api/admin/marketplace-profit-entry/${encodeURIComponent(existingEntryId)}`, props.impersonateId ?? null), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buyingPriceKes: buying }),
        });
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) throw new Error(data?.error || "Update failed");
        setSavedBuyingByTxn((prev) => ({ ...prev, [txn]: raw }));
        if (!opts?.silent) showToast("Updated", "success");
        props.onImported?.();
        return;
      }

      const doSubmit = async (allowDuplicates: boolean) => {
        const endpoint = draftId
          ? withImpersonateId(
              `/api/admin/marketplace-profit-entry/csv/draft/${encodeURIComponent(draftId)}/submit-row`,
              props.impersonateId ?? null,
            )
          : withImpersonateId("/api/admin/marketplace-profit-entry/csv/submit-row", props.impersonateId ?? null);

        const payload = draftId
          ? { itemCreditTxn: txn, buyingPriceKes: buying, allowDuplicates }
          : {
              accountId: resolvedAccountId || shopId,
              row,
              buyingPriceKes: buying,
              allowDuplicates,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as any;
        return { res, data };
      };

      let { res, data } = await doSubmit(false);
      if (res.status === 409) {
        if (opts?.auto) return;
        const ok = window.confirm("This unique number already exists. Submit anyway?");
        if (!ok) return;
        ({ res, data } = await doSubmit(true));
      }
      if (!res.ok) throw new Error(data?.error || "Submit failed");

      const entryId = String(data?.entry?.id ?? data?.entryId ?? "").trim();
      if (entryId) {
        setSubmittedByTxn((prev) => ({ ...prev, [txn]: entryId }));
        setSubmitted(true);
        setSavedBuyingByTxn((prev) => ({ ...prev, [txn]: raw }));
        props.onImported?.();
        if (localOnlyDraft) {
          try {
            const rawDraft = localStorage.getItem(draftKey);
            const parsed = rawDraft ? (JSON.parse(rawDraft) as any) : null;
            if (parsed && parsed.mode === "local") {
              parsed.buyingByTxn = { ...(parsed.buyingByTxn ?? {}), [txn]: String(buying) };
              parsed.submittedByTxn = { ...(parsed.submittedByTxn ?? {}), [txn]: entryId };
              localStorage.setItem(draftKey, JSON.stringify(parsed));
            }
          } catch {}
        }
      }
      if (!opts?.silent) showToast(isSubmitted ? "Updated" : "Saved", "success");
    } catch (err) {
      if (!opts?.silent) showToast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmittingTxn("");
    }
  };

  const autoSubmitKey = useMemo(() => {
    if (!shopId) return "";
    const ws = String(weekStart ?? "").trim();
    const did = String(draftId ?? "").trim();
    return `${shopId}:${ws || "no-week"}:${did || "no-draft"}:${rows.length}`;
  }, [draftId, rows.length, shopId, weekStart]);

  // Auto-save autofilled rows in the background so admin doesn't have to click Submit for each suggested buying price.
  useEffect(() => {
    if (!rows.length) return;
    if (!autoSubmitKey) return;
    if (autoSubmitDoneKey === autoSubmitKey) return;
    if (autoSubmitting) return;

    const candidates = rows
      .filter((r) => {
        const txn = String(r.itemCreditTxn ?? "").trim();
        if (!txn) return false;
        if (!autofilledByTxn[txn]) return false;
        if (submittedByTxn[txn]) return false;
        if (existingTxns.includes(txn)) return false;
        const net = Number(r.netPayout ?? 0);
        if (Number.isFinite(net) && net < 0) return false;
        const raw = String(buyingByTxn[txn] ?? "").trim();
        const buying = Number(raw);
        if (!raw || !Number.isFinite(buying) || buying < 0) return false;
        return true;
      })
      .map((r) => r.itemCreditTxn);

    if (!candidates.length) {
      setAutoSubmitDoneKey(autoSubmitKey);
      return;
    }

    let cancelled = false;
    void (async () => {
      setAutoSubmitting(true);
      if (!cancelled) showToast(`Auto-saving ${candidates.length} autofilled orders...`, "warn");
      for (const txn of candidates) {
        if (cancelled) break;
        // eslint-disable-next-line no-await-in-loop
        await submitRow(txn, { auto: true, silent: true });
      }
      if (!cancelled) {
        setAutoSubmitDoneKey(autoSubmitKey);
        showToast("Autofilled rows saved", "success");
      }
      setAutoSubmitting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    autoSubmitDoneKey,
    autoSubmitKey,
    autoSubmitting,
    autofilledByTxn,
    buyingByTxn,
    existingTxns,
    rows,
    submitRow,
    submittedByTxn,
  ]);

  const copySku = async (sku: string) => {
    const value = String(sku ?? "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast("SKU copied", "success");
    } catch {
      showToast("Copy failed", "error");
    }
  };

  // Restore draft after reload (client-only).
  useEffect(() => {
    if (!draftKey) return;
    if (rows.length) return;
    if (submitted) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as any;
      if (parsed?.mode === "local") {
        const localRows = Array.isArray(parsed?.rows) ? (parsed.rows as PreviewRow[]) : [];
        setRows(localRows);
        setExistingTxns(Array.isArray(parsed?.existingTxns) ? (parsed.existingTxns as string[]) : []);
        setBuyingByTxn(parsed?.buyingByTxn && typeof parsed.buyingByTxn === "object" ? (parsed.buyingByTxn as Record<string, string>) : {});
        setSubmittedByTxn(
          parsed?.submittedByTxn && typeof parsed.submittedByTxn === "object" ? (parsed.submittedByTxn as Record<string, string>) : {},
        );
        setSubmitted(Object.keys(parsed?.submittedByTxn ?? {}).length > 0);
        setResolvedAccountId(String(parsed?.accountId ?? "").trim());
        setDraftId("");
        setLocalOnlyDraft(true);
        return;
      }

      const did = String(parsed?.id ?? "").trim();
      if (!did) return;
      void loadDraftById(did);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, loadDraftById]);

  const resetView = (opts: { preserveStorage: boolean }) => {
    setRows([]);
    setBuyingByTxn({});
    setSavedBuyingByTxn({});
    setAutofilledByTxn({});
    setExistingTxns([]);
    setSubmittedByTxn({});
    setSubmitted(false);
    setDraftId("");
    setResolvedAccountId("");
    setLocalOnlyDraft(false);
    setFile(null);
    setShowOnlyUnpriced(false);
    if (!opts.preserveStorage) {
      try {
        if (draftKey) localStorage.removeItem(draftKey);
        if (lastDraftPointerKey) localStorage.removeItem(lastDraftPointerKey);
      } catch {}
    }
  };

  const clearDraft = () => resetView({ preserveStorage: false });

  const markWeekZero = async () => {
    if (!shopId) return;
    const ws = String(effectiveWeekStart || "").trim();
    if (!ws) return;

    const ok = window.confirm("Mark this shop as ZERO sales for this week? This records payout as Ksh 0.");
    if (!ok) return;

    try {
      setLoading(true);
      const res = await fetch(
        withImpersonateId("/api/admin/marketplace-profit-entry/reset-weekly-sale", props.impersonateId ?? null),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shopId, weekStart: ws, accountId: resolvedAccountId || undefined }),
        },
      );
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        showToast(String(data?.error ?? "Failed to mark week as zero"), "error");
        return;
      }

      resetView({ preserveStorage: false });
      setWeekStart(ws);
      showToast("Recorded as Ksh 0 for this week.", "success");
      await refreshWeekStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to mark week as zero", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteStatement = async () => {
    const ok = window.confirm(
      "Delete this statement? This removes the saved draft (if available) and resets the week's payout to 0.",
    );
    if (!ok) return;

    try {
      setLoading(true);

      if (draftId && !localOnlyDraft) {
        const res = await fetch(
          withImpersonateId(
            `/api/admin/marketplace-profit-entry/csv/draft/${encodeURIComponent(draftId)}`,
            props.impersonateId ?? null,
          ),
          { method: "DELETE" },
        );
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          showToast(String(data?.error ?? "Failed to delete statement"), "error");
          return;
        }
      } else {
        // Local-only draft (or no draft id): still reset weekly payout in DB to avoid wrong dashboards.
        const ws = String(weekStart || defaultWeekStart || "").trim();
        if (!ws) {
          showToast("Cannot determine week to reset.", "error");
          return;
        }

        const res = await fetch(
          withImpersonateId("/api/admin/marketplace-profit-entry/reset-weekly-sale", props.impersonateId ?? null),
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ shopId, weekStart: ws, accountId: resolvedAccountId || undefined }),
          },
        );
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          showToast(String(data?.error ?? "Failed to reset weekly payout"), "error");
          return;
        }
      }

      resetView({ preserveStorage: false });
      setWeekStart("");
      showToast("Statement deleted.", "success");
      await loadOpenDrafts();
      await refreshWeekStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete statement", "error");
    } finally {
      setLoading(false);
    }
  };

  const resumeDraft = async (did: string) => {
    const target = String(did ?? "").trim();
    if (!target) return;
    try {
      setLoading(true);
      await loadDraftById(target);
      await loadOpenDrafts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to resume week", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatWeekLabel = (weekStartIso: string, weekEndIso: string) => {
    const start = new Date(weekStartIso);
    const end = new Date(weekEndIso);
    const f = new Intl.DateTimeFormat("en-KE", { day: "2-digit", month: "short", year: "numeric" });
    return `${f.format(start)} - ${f.format(end)}`;
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{props.title ?? "CSV weekly upload"}</h2>
          <p className="text-sm text-slate-300">Load a statement file, enter buying prices, then submit to save.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => void loadStatement()}
            disabled={loading || Boolean(rows.length)}
            type="button"
          >
            {loading ? "Loading..." : "Load statement"}
          </button>
          <button
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            onClick={() => void markWeekZero()}
            disabled={loading || !shopId}
            type="button"
            title="Use when statement is not available for this shop/week"
          >
            Mark zero
          </button>
          <button
            className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/30 disabled:opacity-50"
            onClick={() => void deleteStatement()}
            disabled={loading || !shopId || (!draftId && !localOnlyDraft)}
            type="button"
            title={localOnlyDraft ? "Saved locally only" : "Delete saved statement"}
          >
            Delete
          </button>
          <button
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 disabled:opacity-50"
            onClick={clearDraft}
            disabled={loading || (!rows.length && !draftId)}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Shop</div>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={shopId}
            onChange={(e) => {
              const next = e.target.value;
              if (next === shopId) return;
              const hasWork = Boolean(rows.length || draftId || Object.keys(submittedByTxn).length);
              if (hasWork) {
                const ok = window.confirm("Switch shop? This will clear the current view. Your loaded statement remains saved.");
                if (!ok) return;
                resetView({ preserveStorage: true });
              }
              setShopId(next);
            }}
            disabled={loading}
          >
            <option value="">Select shop...</option>
            {props.shops.map((s) => {
              const st = weekStatusByShopId[s.id];
              const draft = st?.draft ?? null;
              const sale = st?.weeklySale ?? null;
              const saleAmount = sale ? Number(sale.amount ?? 0) : null;
              const loaded = Boolean(draft) || (saleAmount !== null && saleAmount > 0);
              const zero = saleAmount !== null && saleAmount === 0;
              const done = Boolean(draft && draft.rowCount > 0 && draft.isComplete);
              const tag = done ? "DONE" : loaded ? "LOADED" : zero ? "ZERO" : "";
              return (
                <option key={s.id} value={s.id}>
                  {(s.displayName || s.shopName || s.id).trim()} ({s.platform}){tag ? ` — ${tag}` : ""}
                </option>
              );
            })}
          </select>
          <div className="mt-1 text-[11px] text-slate-400">
            Status legend: <span className="text-slate-200">WHITE</span>=not loaded,{" "}
            <span className="text-sky-200">LOADED</span>=statement loaded, <span className="text-emerald-200">DONE</span>=all rows submitted,{" "}
            <span className="text-slate-300">ZERO</span>=recorded Ksh 0.
          </div>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Week</div>
          <select
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={effectiveWeekStart}
            onChange={(e) => {
              const next = String(e.target.value ?? "").trim();
              if (!next || next === effectiveWeekStart) return;
              const hasWork = Boolean(rows.length || draftId || Object.keys(submittedByTxn).length || file);
              if (hasWork) {
                const ok = window.confirm("Switch week? This will clear the current view. Saved statements remain available.");
                if (!ok) return;
                resetView({ preserveStorage: true });
              }
              setWeekStart(next);
            }}
            disabled={loading || !weeks.length}
          >
            {!weeks.length ? <option value="">No weeks available</option> : null}
            {weeks.map((w) => (
              <option key={w.startInput} value={w.startInput}>
                {w.label}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-slate-400">Week start: {effectiveWeekStart || "N/A"}</div>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Statement file</div>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setRows([]);
                setBuyingByTxn({});
                setSavedBuyingByTxn({});
                setAutofilledByTxn({});
                setSubmitted(false);
                setDraftId("");
                setSubmittedByTxn({});
              }}
              disabled={Boolean(rows.length)}
            />
        </label>

      </div>

      {!rows.length && !file && shopId && openDrafts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-100">Open weeks (not fully submitted)</div>
              <div className="text-xs text-slate-400">
                {loadingDrafts ? "Loading..." : "Pick a week to continue pricing without re-uploading the statement."}
              </div>
            </div>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 md:w-[360px]"
              defaultValue=""
              onChange={(e) => {
                const did = String(e.target.value ?? "").trim();
                if (!did) return;
                const selected = openDrafts.find((d) => d.id === did) ?? null;
                const wsIso = String(selected?.week?.weekStart ?? "").trim();
                const wsInput = wsIso ? new Date(wsIso).toISOString().slice(0, 10) : "";
                if (wsInput) setWeekStart(wsInput);
                void resumeDraft(did);
              }}
              disabled={loading || loadingDrafts}
            >
              <option value="" disabled>
                Select week…
              </option>
              {openDrafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatWeekLabel(d.week.weekStart, d.week.weekEnd)} ({d.submittedCount}/{d.rowCount} submitted)
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="mt-4">
          <div className={`mb-3 grid gap-2 ${props.hideSummaryTotals ? "sm:grid-cols-1" : "sm:grid-cols-4"}`}>
            {!props.hideSummaryTotals ? (
              <>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Rows</div>
                  <div className="text-base font-semibold text-slate-100">{rows.length}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Net payout total</div>
                  <div className="text-base font-semibold text-slate-100">{currency.format(totals.netPayout)}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Duplicates</div>
                  <div className="text-base font-semibold text-slate-100">{totals.duplicates}</div>
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setShowOnlyUnpriced((v) => !v)}
              className={
                showOnlyUnpriced
                  ? "rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-left"
                  : "rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-left hover:bg-slate-950/55"
              }
              title="Show orders not yet priced"
            >
              <div className="text-xs text-slate-400">Unpriced orders</div>
              <div className="text-base font-semibold text-slate-100">{unpricedCounts.unpriced}</div>
              <div className="mt-1 text-[11px] text-slate-400">{showOnlyUnpriced ? "Showing unpriced only" : "Click to filter list"}</div>
            </button>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-xs text-slate-500">
              Enter buying price to see profit. Use Submit/Update to save.
              {localOnlyDraft ? " (Draft is stored in this browser only.)" : ""}
            </div>

            <div className="flex flex-wrap items-end gap-2">

              {unpricedCounts.returns > 0 && !props.hideSummaryTotals ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Returns/refunds</div>
                  <div className="text-base font-semibold text-slate-100">{unpricedCounts.returns}</div>
                </div>
              ) : null}
              {submitted && !props.hideSummaryTotals ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Profit total</div>
                  <div className={totals.profit < 0 ? "text-base font-semibold text-rose-300" : "text-base font-semibold text-emerald-300"}>
                    {currency.format(totals.profit)}
                  </div>
                </div>
              ) : null}
              {!props.hideSummaryTotals ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-xs text-slate-400">Submitted</div>
                  <div className="text-base font-semibold text-slate-100">{totals.submittedCount}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[1160px] w-full text-left text-sm">
              <colgroup>
                <col className="w-[120px]" />
                <col className="w-[160px]" />
                <col />
                <col className="w-[120px]" />
                <col className="w-[130px]" />
                <col className="w-[160px]" />
                <col className="w-[140px]" />
                <col className="w-[120px]" />
              </colgroup>
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 whitespace-nowrap">Order</th>
                  <th className="px-3 py-2 whitespace-nowrap">Item</th>
                  <th className="px-3 py-2 whitespace-nowrap">SKU</th>
                  <th className="px-3 py-2 whitespace-nowrap">Net</th>
                  <th className="px-3 py-2 whitespace-nowrap">Buying</th>
                  <th className="px-3 py-2 whitespace-nowrap">Profit</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {visibleRows.map((r) => {
                  const profitValue = perRowProfit.get(r.itemCreditTxn);
                  const isDup = existingTxns.includes(r.itemCreditTxn);
                  const isSubmitted = Boolean(submittedByTxn[r.itemCreditTxn]);
                  const buyingRaw = String(buyingByTxn[r.itemCreditTxn] ?? "").trim();
                  const buyingNum = Number(buyingRaw);
                  const net = Number(r.netPayout ?? 0);
                  const gross = Number(r.grossSale ?? 0);
                  const status = String(r.orderItemStatus ?? "").toLowerCase();
                  const isReturn =
                    status.includes("return") ||
                    status.includes("refund") ||
                    (Number.isFinite(net) && net < 0) ||
                    (Number.isFinite(gross) && gross < 0);
                  const savedRaw = String(savedBuyingByTxn[r.itemCreditTxn] ?? "").trim();
                  const hasValidBuying = buyingRaw.length > 0 && Number.isFinite(buyingNum) && buyingNum >= 0;
                  const canSubmitRow = !isSubmitted && !isReturn && hasValidBuying;
                  const canUpdateRow = isSubmitted && !isReturn && hasValidBuying && buyingRaw !== savedRaw;
                  const skuLabel = String(r.jumiaSku || r.sellerSku || "-");
                  const orderLabel = String(r.orderNo || "-").replace(/\s+/g, "");
                  const itemNoLabel = String(r.orderItemNo || "").replace(/\s+/g, "");
                  const isAutofilled = Boolean(autofilledByTxn[r.itemCreditTxn]);
                  return (
                    <tr key={r.key} className={isDup ? "bg-amber-950/20" : ""}>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-slate-200">{new Date(r.dateUtc).toLocaleDateString("en-KE")}</td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-slate-200">{orderLabel}</td>
                      <td className="px-3 py-2 align-top text-slate-200">
                        <div className="max-w-[480px] truncate" title={r.details}>
                          {r.details || "-"}
                        </div>
                        <div className="text-xs text-slate-400">{itemNoLabel}</div>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-slate-200">
                        {skuLabel !== "-" ? (
                          <button
                            type="button"
                            onClick={() => void copySku(skuLabel)}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold whitespace-nowrap text-slate-200 hover:bg-slate-900"
                            title={skuLabel}
                          >
                            Copy SKU
                          </button>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap font-medium text-slate-100">
                        {currency.format(Number(r.netPayout ?? 0))}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:opacity-60"
                            inputMode="decimal"
                            placeholder={isReturn ? "Return" : "0"}
                            value={buyingByTxn[r.itemCreditTxn] ?? ""}
                            onChange={(e) => updateBuying(r.itemCreditTxn, e.target.value)}
                            onBlur={() => propagateBuyingToMatches(r.itemCreditTxn)}
                            disabled={isReturn}
                          />
                          {isAutofilled && !isReturn ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                              Autofilled
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td
                        className={
                          isReturn
                            ? "px-3 py-2 align-top whitespace-nowrap font-semibold text-slate-500"
                            : profitValue !== undefined && profitValue < 0
                              ? isSubmitted
                                ? "px-3 py-2 align-top whitespace-nowrap font-semibold text-rose-300"
                                : "px-3 py-2 align-top whitespace-nowrap font-semibold text-rose-300/80"
                              : isSubmitted
                                ? "px-3 py-2 align-top whitespace-nowrap font-semibold text-emerald-300"
                                : "px-3 py-2 align-top whitespace-nowrap font-semibold text-emerald-300/80"
                        }
                      >
                        {isReturn ? "—" : profitValue !== undefined ? currency.format(profitValue) : "—"}
                        {!isReturn && profitValue !== undefined && !isSubmitted ? (
                          <span className="ml-2 text-[10px] font-semibold text-slate-400">(pending)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() => void submitRow(r.itemCreditTxn)}
                          disabled={!(canSubmitRow || canUpdateRow) || submittingTxn === r.itemCreditTxn || isReturn}
                          className="min-w-[88px] rounded-lg bg-emerald-600 px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {submittingTxn === r.itemCreditTxn
                            ? isSubmitted
                              ? "Updating..."
                              : "Saving..."
                            : isReturn
                              ? "Return"
                              : isSubmitted
                                ? canUpdateRow
                                  ? "Update"
                                  : "Saved"
                                : "Submit"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-slate-400">
            {selectedWeek ? `Selected week: ${selectedWeek.label}` : null} — Returns/refunds are excluded from buying price.
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">No preview yet.</div>
      )}
    </section>
  );
}
