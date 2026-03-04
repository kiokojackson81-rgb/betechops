"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { withImpersonateId } from "@/lib/impersonation";

const currency = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

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

export default function MarketplaceWeeklyCsvUpload(props: {
  title?: string;
  shops: MarketplaceShopOption[];
  weeks: MarketplaceWeekOption[];
  defaultWeekStart?: string;
  assignees?: Array<{ id: string; name: string }>;
  defaultAssigneeId?: string;
  disableAssigneeSelect?: boolean;
  hideSummaryTotals?: boolean;
  impersonateId?: string | null;
  onImported?: () => void;
}) {
  const weeks = props.weeks ?? [];
  const defaultWeekStart = props.defaultWeekStart ?? weeks.at(-1)?.startInput ?? weeks[0]?.startInput ?? "";

  const [shopId, setShopId] = useState("");
  const [weekStart, setWeekStart] = useState<string>("");
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

  const selectedWeek = useMemo(() => weeks.find((w) => w.startInput === weekStart) ?? null, [weeks, weekStart]);
  const selectedShop = useMemo(() => props.shops.find((s) => s.id === shopId) ?? null, [props.shops, shopId]);

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
      const buying = data?.buyingByTxn && typeof data.buyingByTxn === "object" ? (data.buyingByTxn as Record<string, any>) : {};
      const submittedMap =
        data?.submittedByTxn && typeof data.submittedByTxn === "object" ? (data.submittedByTxn as Record<string, any>) : {};
      setRows(draftRows);
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

  // Cross-user sync: if admin already loaded a statement for this shop, resume the latest server draft automatically.
  useEffect(() => {
    if (!shopId) return;
    if (rows.length) return;
    if (draftId) return;
    if (file) return;
    if (loading) return;
    if (loadingDrafts) return;

    let cancelled = false;
    void (async () => {
      try {
        // Prefer any open week draft if available.
        const preferred = openDrafts[0]?.id ? openDrafts[0] : null;
        if (preferred?.id) {
          const wsIso = String(preferred.week?.weekStart ?? "").trim();
          const wsInput = wsIso ? new Date(wsIso).toISOString().slice(0, 10) : "";
          if (wsInput) setWeekStart(wsInput);
          if (lastDraftPointerKey && wsInput) {
            try {
              localStorage.setItem(lastDraftPointerKey, wsInput);
            } catch {}
          }
          const storageKey = buildDraftKey(shopId, wsInput);
          if (storageKey) {
            try {
              localStorage.setItem(storageKey, JSON.stringify({ id: preferred.id, savedAt: new Date().toISOString() }));
            } catch {}
          }
          if (cancelled) return;
          await loadDraftById(preferred.id);
          return;
        }

        const res = await fetch(
          withImpersonateId(
            `/api/admin/marketplace-profit-entry/csv/drafts/latest?shopId=${encodeURIComponent(shopId)}`,
            props.impersonateId ?? null,
          ),
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) return;
        const did = String(data?.draftId ?? "").trim();
        if (!did) return;
        const wsIso = String(data?.week?.weekStart ?? "").trim();
        const wsInput = wsIso ? new Date(wsIso).toISOString().slice(0, 10) : "";
        if (wsInput) setWeekStart(wsInput);
        if (lastDraftPointerKey && wsInput) {
          try {
            localStorage.setItem(lastDraftPointerKey, wsInput);
          } catch {}
        }
        const storageKey = buildDraftKey(shopId, wsInput);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify({ id: did, savedAt: new Date().toISOString() }));
          } catch {}
        }
        if (cancelled) return;
        await loadDraftById(did);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [
    buildDraftKey,
    draftId,
    file,
    lastDraftPointerKey,
    loadDraftById,
    loading,
    loadingDrafts,
    openDrafts,
    props.impersonateId,
    rows.length,
    shopId,
  ]);

  const loadStatement = async () => {
    if (!shopId) {
      showToast("Select a shop first", "error");
      return;
    }
    if (!file) {
      showToast("Upload a CSV file first", "error");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.set("accountId", shopId);
      // weekStart is inferred from the CSV on the server (most common Nairobi Mon→Sun week).
      // userId is inferred from the shop's primary attendant unless explicitly provided in server-side rules.
      form.set("file", file);

      const res = await fetch(withImpersonateId("/api/admin/marketplace-profit-entry/csv/preview", props.impersonateId ?? null), {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Preview failed");

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
    if (!opts.preserveStorage) {
      try {
        if (draftKey) localStorage.removeItem(draftKey);
        if (lastDraftPointerKey) localStorage.removeItem(lastDraftPointerKey);
      } catch {}
    }
  };

  const clearDraft = () => resetView({ preserveStorage: false });

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
            onClick={clearDraft}
            disabled={loading || (!rows.length && !draftId)}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                setWeekStart("");
              }
              setShopId(next);
            }}
            disabled={loading}
          >
            <option value="">Select shop...</option>
            {props.shops.map((s) => (
              <option key={s.id} value={s.id}>
                {(s.displayName || s.shopName || s.id).trim()} ({s.platform})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">Week (auto)</div>
          <div className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
            {selectedWeek?.label ?? "Load statement to detect week"}
          </div>
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-slate-400">CSV file</div>
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            type="file"
            accept=".csv,text/csv"
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

        <div className="hidden" aria-hidden="true" />
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
                if (did) void resumeDraft(did);
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
          {!props.hideSummaryTotals ? (
            <div className="mb-3 grid gap-2 sm:grid-cols-3">
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
            </div>
          ) : null}

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-xs text-slate-500">
              Enter buying price to see profit. Use Submit/Update to save.
              {localOnlyDraft ? " (Draft is stored in this browser only.)" : ""}
            </div>

            <div className="flex flex-wrap items-end gap-2">

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
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 whitespace-nowrap">Net</th>
                  <th className="px-3 py-2 whitespace-nowrap">Buying</th>
                  <th className="px-3 py-2 whitespace-nowrap">Profit</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/20">
                {rows.map((r) => {
                  const profitValue = perRowProfit.get(r.itemCreditTxn);
                  const isDup = existingTxns.includes(r.itemCreditTxn);
                  const isSubmitted = Boolean(submittedByTxn[r.itemCreditTxn]);
                  const buyingRaw = String(buyingByTxn[r.itemCreditTxn] ?? "").trim();
                  const buyingNum = Number(buyingRaw);
                  const net = Number(r.netPayout ?? 0);
                  const isReturn = Number.isFinite(net) && net < 0;
                  const savedRaw = String(savedBuyingByTxn[r.itemCreditTxn] ?? "").trim();
                  const hasValidBuying = buyingRaw.length > 0 && Number.isFinite(buyingNum) && buyingNum >= 0;
                  const canSubmitRow = !isSubmitted && !isReturn && hasValidBuying;
                  const canUpdateRow = isSubmitted && !isReturn && hasValidBuying && buyingRaw !== savedRaw;
                  const skuLabel = String(r.jumiaSku || r.sellerSku || "-");
                  const isAutofilled = Boolean(autofilledByTxn[r.itemCreditTxn]);
                  return (
                    <tr key={r.key} className={isDup ? "bg-amber-950/20" : ""}>
                      <td className="px-3 py-2 text-slate-200">{new Date(r.dateUtc).toLocaleDateString("en-KE")}</td>
                      <td className="px-3 py-2 text-slate-200">{r.orderNo || "-"}</td>
                      <td className="px-3 py-2 text-slate-200">
                        <div className="max-w-[420px] truncate" title={r.details}>
                          {r.details || "-"}
                        </div>
                        <div className="text-xs text-slate-400">{r.orderItemNo || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {skuLabel !== "-" ? (
                          <button
                            type="button"
                            onClick={() => void copySku(skuLabel)}
                            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                            title={skuLabel}
                          >
                            Copy SKU
                          </button>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-100">
                        {currency.format(Number(r.netPayout ?? 0))}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-28 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 disabled:opacity-60"
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
                            ? "px-3 py-2 whitespace-nowrap font-semibold text-slate-500"
                            : profitValue !== undefined && profitValue < 0
                              ? isSubmitted
                                ? "px-3 py-2 whitespace-nowrap font-semibold text-rose-300"
                                : "px-3 py-2 whitespace-nowrap font-semibold text-rose-300/80"
                              : isSubmitted
                                ? "px-3 py-2 whitespace-nowrap font-semibold text-emerald-300"
                                : "px-3 py-2 whitespace-nowrap font-semibold text-emerald-300/80"
                        }
                      >
                        {isReturn ? "—" : profitValue !== undefined ? currency.format(profitValue) : "—"}
                        {!isReturn && profitValue !== undefined && !isSubmitted ? (
                          <span className="ml-2 text-[10px] font-semibold text-slate-400">(pending)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void submitRow(r.itemCreditTxn)}
                          disabled={!(canSubmitRow || canUpdateRow) || submittingTxn === r.itemCreditTxn || isReturn}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
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
            {selectedWeek ? `Selected week: ${selectedWeek.label}` : null} — Returns (negative payout) are excluded from buying price.
          </div>
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">No preview yet.</div>
      )}
    </section>
  );
}
