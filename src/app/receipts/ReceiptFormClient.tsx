"use client";

import React, { useEffect, useMemo, useState } from "react";
import MarkdownRendererClient, { RichFormattingToggle } from "@/components/MarkdownRendererClient";
import { findSimilarProducts, getProductSimilarityScore } from "@/lib/posProductSimilarity";
import { showToast } from "@/lib/ui/toast";
import { generateReceiptSerial } from "@/lib/receipts/serial";
import ReceiptDuplicateModal from "./_components/ReceiptDuplicateModal";

type ItemRow = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number | "";
  serial?: string;
  warranty?: string;
  isDeliveryFee?: boolean;
  productId?: string;
  sku?: string;
  buyingPrice?: number | "";
  variableCost?: boolean;
  commissionEnabled?: boolean;
  commissionAmount?: number;
  commissionRequiresApproval?: boolean;
};

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  category?: string | null;
  sellingPrice: number;
  lastBuyingPrice?: number | null;
  variableCost?: boolean;
  defaultWarranty?: string | null;
  isActive?: boolean;
  commissionEnabled?: boolean;
  commissionAmount?: number | string | null;
  commissionRequiresApproval?: boolean;
  soldCount?: number;
};

const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];
const newItem = (): ItemRow => ({
  id: Math.random().toString(36).slice(2),
  title: "",
  quantity: 1,
  unitPrice: "",
  serial: "",
  warranty: "",
  buyingPrice: "",
});

const sanitizeNumericInput = (value: string): number | "" => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return "";
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : "";
};

const isBlankReceiptRow = (row: ItemRow) =>
  !row.isDeliveryFee &&
  !row.productId &&
  !row.title.trim() &&
  Number(row.quantity || 1) === 1 &&
  (row.unitPrice === "" || Number(row.unitPrice || 0) === 0) &&
  (!row.serial || !row.serial.trim()) &&
  (!row.warranty || !row.warranty.trim()) &&
  (row.buyingPrice === "" || Number(row.buyingPrice || 0) === 0);


type ReceiptFormProps = {
  onCreated?: (receipt: any, context?: { staffId: string | null; serial: string; receiptId: string | null }) => void;
  showHero?: boolean;
};

export default function ReceiptFormClient({ onCreated, showHero = true }: ReceiptFormProps) {  
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; name: string; email?: string | null }>>([]);
  const [defaultStaffId, setDefaultStaffId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("RECEIPT");
  const [serial, setSerial] = useState<string>(() => generateReceiptSerial());
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [normalizingName, setNormalizingName] = useState<boolean>(false);
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [taxRate, setTaxRate] = useState<number>(16);
  const [showTax, setShowTax] = useState<boolean>(false);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState({ MPESA: true, CASH: false });
  const hasPaymentMethodSelection = selectedPaymentMethods.MPESA || selectedPaymentMethods.CASH;
  const primaryPaymentMethod = selectedPaymentMethods.MPESA ? "MPESA" : "CASH";
  const paymentDetailsShown = true;
  // Paper size is fixed to A5 by default; remove runtime selector
  const [notes, setNotes] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string | undefined>(undefined);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState<boolean>(false);
  const [customerType, setCustomerType] = useState<"walk-in" | "online" | "delivery" | "pod" | "">("");
  const [deliveryStatus, setDeliveryStatus] = useState<"pending" | "delivered" | "failed">("pending");
  const [podNote, setPodNote] = useState<string>("");
  const [deposit, setDeposit] = useState<number>(0);
  const [showSerials, setShowSerials] = useState<boolean>(false);
  const [showWarranty, setShowWarranty] = useState<boolean>(false);
  const [globalWarranty, setGlobalWarranty] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [duplicateOwner, setDuplicateOwner] = useState<any>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [descLoadingId, setDescLoadingId] = useState<string | null>(null);
  const [cashPaid, setCashPaid] = useState<number | "">(0);
  const [mpesaPaid, setMpesaPaid] = useState<number | "">(0);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogResults, setCatalogResults] = useState<CatalogProduct[]>([]);
  const [duplicateCatalogPool, setDuplicateCatalogPool] = useState<CatalogProduct[]>([]);
  const [websiteOrderId, setWebsiteOrderId] = useState<string | null>(null);
  const [websiteOrderRef, setWebsiteOrderRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => null);
        const sessionUserId =
          typeof json?.user?.id === "string" && json.user.id.trim()
            ? json.user.id.trim()
            : null;
        if (!cancelled) {
          setDefaultStaffId(sessionUserId);
        }
      } catch {
        if (!cancelled) {
          setDefaultStaffId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/receipts/staff");
        const json = await res.json().catch(() => null);
        const rows = Array.isArray(json)
          ? json
          : Array.isArray(json?.users)
            ? json.users
            : [];
        if (cancelled) return;
        const mapped = rows
          .filter((u: any) => u && u.id)
          .map((u: any) => ({ id: u.id, name: u.name || u.email || u.id, email: u.email ?? null }));
        setStaffMembers(mapped);
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          activeOnly: "1",
          limit: "2000",
        });
        const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load product duplicate checks");
        const data = await response.json().catch(() => []);
        if (cancelled) return;
        setDuplicateCatalogPool(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setDuplicateCatalogPool([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!defaultStaffId || staffId || staffMembers.length === 0) return;
    const matched = staffMembers.find((member) => member.id === defaultStaffId);
    if (matched) {
      setStaffId(matched.id);
    }
  }, [defaultStaffId, staffId, staffMembers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("prefill");
    if (!encoded) return;

    try {
      const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      const decoded = atob(padded);
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      const parsed = JSON.parse(new TextDecoder().decode(bytes)) as any;

      if (typeof parsed.serial === "string" && parsed.serial.trim()) {
        setSerial(parsed.serial.trim());
      }
      if (
        typeof parsed.docType === "string" &&
        ["RECEIPT", "INVOICE", "QUOTATION", "LAYAWAY"].includes(parsed.docType.trim().toUpperCase())
      ) {
        setDocType(parsed.docType.trim().toUpperCase());
      }
      if (parsed.websiteOrderId) setWebsiteOrderId(String(parsed.websiteOrderId));
      if (parsed.websiteOrderRef) setWebsiteOrderRef(String(parsed.websiteOrderRef));
      if (parsed.customerName) setCustomerName(String(parsed.customerName));
      if (parsed.customerPhone) setCustomerPhone(String(parsed.customerPhone));
      if (parsed.customerEmail) setCustomerEmail(String(parsed.customerEmail));
      if (parsed.deliveryAddress) {
        setDeliveryAddress(String(parsed.deliveryAddress));
        setShowAddressInput(true);
      }
      if (parsed.customerType && ["walk-in", "online", "delivery", "pod"].includes(parsed.customerType)) {
        setCustomerType(parsed.customerType);
      }
      if (parsed.deliveryStatus && ["pending", "delivered", "failed"].includes(parsed.deliveryStatus)) {
        setDeliveryStatus(parsed.deliveryStatus);
      }
      if (parsed.notes) {
        setNotes(String(parsed.notes));
      }
      if (parsed.podDelivery?.note) {
        setPodNote(String(parsed.podDelivery.note));
      }
      if (parsed.paymentMethod === "CASH") {
        setSelectedPaymentMethods({ MPESA: false, CASH: true });
      } else if (parsed.paymentMethod === "MPESA") {
        setSelectedPaymentMethods({ MPESA: true, CASH: false });
      }
      if (Array.isArray(parsed.items) && parsed.items.length) {
        setItems(
          parsed.items.map((item: any) => ({
            ...newItem(),
            title: String(item.title || item.productName || "Item"),
            quantity: Math.max(1, Number(item.quantity || 1)),
            unitPrice: Number(item.unitPrice || 0),
            productId: item.productId ? String(item.productId) : undefined,
            sku: item.sku ? String(item.sku) : undefined,
          })),
        );
      }
    } catch (error) {
      showToast("Failed to load website order receipt draft", "error");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const agentSaleId = params.get("agentSaleId");
    if (!agentSaleId) return;

    const nextCustomerName = params.get("customerName") || "";
    const nextCustomerPhone = params.get("customerPhone") || "";
    const nextCustomerLocation = params.get("customerLocation") || "";
    const nextProductName = params.get("productName") || "";
    const nextQuantity = Number(params.get("quantity") || "1") || 1;
    const nextUnitPrice = Number(params.get("unitPrice") || "0") || 0;
    const nextDeliveryNotes = params.get("deliveryNotes") || "";
    const nextAgentName = params.get("agentName") || "";
    const nextPaymentType = (params.get("paymentType") || "").toLowerCase();

    if (nextCustomerName) setCustomerName(nextCustomerName);
    if (nextCustomerPhone) setCustomerPhone(nextCustomerPhone);
    if (nextCustomerLocation) {
      setDeliveryAddress(nextCustomerLocation);
      setShowAddressInput(true);
      setCustomerType("delivery");
    }
    if (nextDeliveryNotes) {
      setPodNote(nextDeliveryNotes);
      setNotes((current) => {
        const agentRef = nextAgentName ? `Agent referral: ${nextAgentName}` : "Agent referral";
        return [current, `Agent sale ${agentSaleId}`, agentRef, nextDeliveryNotes].filter(Boolean).join("\n");
      });
    } else {
      setNotes((current) => {
        const agentRef = nextAgentName ? `Agent referral: ${nextAgentName}` : "Agent referral";
        return [current, `Agent sale ${agentSaleId}`, agentRef].filter(Boolean).join("\n");
      });
    }

    if (nextProductName) {
      setItems([
        {
          ...newItem(),
          title: nextProductName,
          quantity: nextQuantity,
          unitPrice: nextUnitPrice,
        },
      ]);
    }

    if (nextPaymentType === "full_payment") {
      setSelectedPaymentMethods({ MPESA: true, CASH: false });
      const nextTotal = Number(params.get("amountPaid") || params.get("totalAmount") || "0") || 0;
      if (nextTotal > 0) setMpesaPaid(nextTotal);
    }
  }, []);

  const addRow = () => setItems((s) => [...s, newItem()]);
  const clearRow = (id: string) =>
    setItems((rows) =>
      rows.map((row) =>
        row.id === id
          ? {
              ...newItem(),
              id: row.id,
            }
          : row,
      ),
    );
  const removeRow = (id: string) =>
    setItems((rows) => {
      if (rows.length > 1) {
        return rows.filter((row) => row.id !== id);
      }

      return rows.map((row) =>
        row.id === id
          ? {
              ...newItem(),
              id: row.id,
            }
          : row,
      );
    });
  const updateRow = (id: string, patch: Partial<ItemRow>) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updateTitleRow = (id: string, title: string) =>
    setItems((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row;
        if (!row.productId) return { ...row, title };

        return {
          ...row,
          title,
          productId: undefined,
          sku: undefined,
          buyingPrice: "",
          variableCost: undefined,
          commissionEnabled: undefined,
          commissionAmount: undefined,
          commissionRequiresApproval: undefined,
        };
      }),
    );
  const addDeliveryFeeRow = () =>
    setItems((s) => [
      ...s,
      {
        ...newItem(),
        title: "Delivery fee",
        unitPrice: 0,
        isDeliveryFee: true,
      },
    ]);

  const searchCatalog = async (query: string) => {
    setCatalogLoading(true);
    try {
      const params = new URLSearchParams({
        activeOnly: "1",
        limit: "20",
      });
      if (query.trim()) params.set("search", query.trim());
      const response = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load catalog");
      const data = await response.json().catch(() => []);
      setCatalogResults(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load catalog", "error");
      setCatalogResults([]);
    } finally {
      setCatalogLoading(false);
    }
  };

  const buildCatalogRow = (product: CatalogProduct): ItemRow => {
    const defaultWarranty = typeof product.defaultWarranty === "string" ? product.defaultWarranty.trim() : "";
    return {
      ...newItem(),
      title: product.name,
      unitPrice: Number(product.sellingPrice || 0),
      productId: product.id,
      sku: product.sku,
      variableCost: Boolean(product.variableCost),
      buyingPrice:
        product.variableCost || product.lastBuyingPrice == null || Number(product.lastBuyingPrice) <= 0
          ? ""
          : Number(product.lastBuyingPrice),
      commissionEnabled: Boolean(product.commissionEnabled),
      commissionAmount: product.commissionAmount == null ? 0 : Number(product.commissionAmount),
      commissionRequiresApproval: Boolean(product.commissionRequiresApproval),
      warranty: defaultWarranty,
    };
  };

  const applyCatalogProductToRow = (rowId: string, product: CatalogProduct) => {
    const nextRow = buildCatalogRow(product);
    setItems((current) => current.map((row) => (row.id === rowId ? { ...row, ...nextRow, id: row.id } : row)));
    if (nextRow.warranty) {
      setShowWarranty(true);
    }
  };

  const addCatalogProduct = (product: CatalogProduct) => {
    const nextRow = buildCatalogRow(product);

    setItems((current) => {
      const blankRowIndex = current.findIndex(isBlankReceiptRow);
      if (blankRowIndex === -1) {
        return [...current, nextRow];
      }

      return current.map((row, index) => (index === blankRowIndex ? { ...row, ...nextRow, id: row.id } : row));
    });
    if (nextRow.warranty) {
      setShowWarranty(true);
    }
    setCatalogOpen(false);
    setCatalogQuery("");
  };

  const aiDescription = async (row: ItemRow) => {
    if (!row.title.trim()) return;
    setDescLoadingId(row.id);
    try {
      const response = await fetch("/api/ai/receipt-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: row.title }),
      });
      if (!response.ok) throw new Error("AI description failed");
      const data = await response.json().catch(() => null);
      if (data?.description) {
        updateRow(row.id, { title: data.description });
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "AI description failed", "error");
    } finally {
      setDescLoadingId(null);
    }
  };

  const normalizeName = async () => {
    if (!customerName || !customerName.trim()) return showToast('Enter a name to normalize', 'error');
    setNormalizingName(true);
    try {
      const res = await fetch('/api/ai/normalize-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Name normalization failed');
      }
      const data = await res.json().catch(() => null);
      const normalized = data?.name || data?.normalizedName || data?.normalized || null;
      if (normalized) {
        setCustomerName(String(normalized));
        showToast('Name normalized', 'success');
      } else {
        showToast('Name normalization returned no value', 'error');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Name normalization failed', 'error');
    } finally {
      setNormalizingName(false);
    }
  };

  const aiNotes = async () => {
    if (!items.length) return;
    setNotesLoading(true);
    try {
      const res = await fetch("/api/ai/receipt-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((item) => ({ description: item.title })),
            paymentMethod: primaryPaymentMethod,
          }),
      });
      if (!res.ok) throw new Error("AI notes failed");
      const data = await res.json().catch(() => null);
      if (data?.notes) {
        setNotes(data.notes);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "AI notes failed", "error");
    } finally {
      setNotesLoading(false);
    }
  };

  const normalizedTaxRate = Number.isFinite(taxRate) ? taxRate : 0;
  const normalizedDiscount = Number.isFinite(discount) ? discount : 0;
  const rankedCatalogResults = useMemo(() => {
    if (!catalogQuery.trim()) return catalogResults;

    return [...catalogResults].sort((left, right) => {
      const rightScore = getProductSimilarityScore(catalogQuery, right.name);
      const leftScore = getProductSimilarityScore(catalogQuery, left.name);
      return (
        rightScore - leftScore ||
        Number(right.soldCount ?? 0) - Number(left.soldCount ?? 0) ||
        left.name.localeCompare(right.name)
      );
    });
  }, [catalogQuery, catalogResults]);

  const toNumber = (value: number | "") => (typeof value === "number" ? value : 0);

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
  const taxAmount = showTax ? subtotal * (normalizedTaxRate / 100) : 0;
  const total = subtotal + taxAmount - normalizedDiscount;
  const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;
  const selectedStaff = staffMembers.find((a) => a.id === staffId);
  const effectiveShowDiscount = showDiscount || normalizedDiscount > 0;
  const showSplitPaymentInputs = selectedPaymentMethods.MPESA && selectedPaymentMethods.CASH;
  const numericCashPaid = toNumber(cashPaid);
  const numericMpesaPaid = toNumber(mpesaPaid);
  const normalizedPaymentBreakdown = useMemo(() => {
    if (!showSplitPaymentInputs) {
      return {
        cash: primaryPaymentMethod === "CASH" ? total : 0,
        mpesa: primaryPaymentMethod === "MPESA" ? total : 0,
      };
    }

    const safeCash = Math.max(0, Math.min(total, numericCashPaid));
    const remainderAfterCash = Math.max(0, total - safeCash);
    const safeMpesa = Math.max(0, Math.min(remainderAfterCash, numericMpesaPaid));
    const shortfall = total - (safeCash + safeMpesa);

    return {
      cash: safeCash,
      mpesa: Math.max(0, safeMpesa + shortfall),
    };
  }, [showSplitPaymentInputs, primaryPaymentMethod, total, numericCashPaid, numericMpesaPaid]);

  useEffect(() => {
    const cash = toNumber(cashPaid);
    const mpesa = toNumber(mpesaPaid);
    if (cash > total) {
      setCashPaid(total);
      setMpesaPaid(0);
      return;
    }
    if (Math.abs(cash + mpesa - total) > 0.1) {
      setMpesaPaid(Math.max(0, total - cash));
    }
  }, [total, cashPaid, mpesaPaid]);

  useEffect(() => {
    if (!catalogOpen) return;
    const handle = setTimeout(() => {
      void searchCatalog(catalogQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [catalogOpen, catalogQuery]);

  const buildDraft = (resolvedPaymentMethod: "MPESA" | "CASH") => ({
    items,
    subtotal,
    taxAmount,
    total,
    taxRate,
    showTax,
    discount: normalizedDiscount,
    showDiscount: effectiveShowDiscount,
    customerName,
    customerPhone,
    customerEmail,
    serial,
    docType,
    attendantName: selectedStaff?.name ?? "",
    paymentMethod: resolvedPaymentMethod,
    paymentDetailsShown,
    deposit: docType === "LAYAWAY" ? deposit : undefined,
    notes,
    deliveryAddress,
    // paperSize: fixed to A5, omitted from draft
    customerType,
    deliveryStatus: customerType === "delivery" ? deliveryStatus : undefined,
    paymentBreakdown: {
      cash: normalizedPaymentBreakdown.cash,
      mpesa: normalizedPaymentBreakdown.mpesa,
    },
    paymentMethods: selectedPaymentMethods,
  });

  const [lastPrintableUrl, setLastPrintableUrl] = useState<string | null>(null);

  const toBase64Utf8 = (value: string) => {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  };

  const buildPreviewUrl = (draft: ReturnType<typeof buildDraft>) => {
    const encoded = encodeURIComponent(toBase64Utf8(JSON.stringify(draft)));
    // always preview using A5
    return `/receipts/preview?draft=${encoded}`;
  };

  const openPreviewWindow = (draft: ReturnType<typeof buildDraft>, autoPrint = false) => {
    try {
      const url = buildPreviewUrl(draft);
      setLastPrintableUrl(url);
      const target = autoPrint ? `${url}&autoPrint=1` : url;
      const previewWindow = window.open(target, "_blank");
      if (!previewWindow) {
        throw new Error("Popup blocked");
      }
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to open preview", "error");
      return false;
    }
  };

  const openSavedReceiptWindow = (
    receiptId: string,
    draft: ReturnType<typeof buildDraft> | null,
    autoPrint = false
  ) => {
    try {
      const url = `/receipts/print/${encodeURIComponent(receiptId)}`;
      setLastPrintableUrl(url);
      const params = new URLSearchParams();
      if (autoPrint) params.set("autoPrint", "1");
      if (draft) {
        const fallbackUrl = buildPreviewUrl(draft);
        const draftParams = new URLSearchParams(fallbackUrl.split("?")[1] || "");
        const fallbackDraft = draftParams.get("draft");
        if (fallbackDraft) params.set("draft", fallbackDraft);
      }
      const query = params.toString();
      const target = query ? `${url}?${query}` : url;
      const receiptWindow = window.open(target, "_blank");
      if (!receiptWindow) {
        throw new Error("Popup blocked");
      }
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to open saved receipt", "error");
      return false;
    }
  };

  const lookupSavedReceiptId = async (receiptSerial: string) => {
    const query = receiptSerial.trim();
    if (!query) return "";

    const attempts: Array<{ useGlobalScope: boolean; attendantFilter?: string | null }> = [
      { useGlobalScope: true, attendantFilter: staffId },
      { useGlobalScope: true, attendantFilter: null },
      { useGlobalScope: false, attendantFilter: staffId },
      { useGlobalScope: false, attendantFilter: null },
    ];

    for (const attempt of attempts) {
      try {
        const params = new URLSearchParams();
        params.set("q", query);
        params.set("onlyPos", "1");
        params.set("page", "1");
        params.set("size", "10");
        if (attempt.attendantFilter) {
          params.set("attendantId", attempt.attendantFilter);
        }
        if (attempt.useGlobalScope) {
          params.set("scope", "global");
        }
        const res = await fetch(`/api/receipts?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) {
          console.error("[receipts][client] receipt lookup failed", {
            receiptSerial: query,
            status: res.status,
            staffId: attempt.attendantFilter ?? null,
            scope: attempt.useGlobalScope ? "global" : "mine",
          });
          continue;
        }
        const data = await res.json().catch(() => ({}));
        const rows = Array.isArray(data?.receipts) ? data.receipts : [];
        const exact = rows.find((row: any) => {
          const orderRef = typeof row?.orderRef === "string" ? row.orderRef.trim() : "";
          const receiptNumber = typeof row?.receiptNumber === "string" ? row.receiptNumber.trim() : "";
          return orderRef === query || receiptNumber === query;
        });
        const resolvedId = typeof exact?.id === "string" ? exact.id : "";
        if (resolvedId) {
          console.info("[receipts][client] resolved missing receiptId via lookup", {
            receiptSerial: query,
            receiptId: resolvedId,
            staffId: attempt.attendantFilter ?? null,
            scope: attempt.useGlobalScope ? "global" : "mine",
          });
          return resolvedId;
        }
        console.warn("[receipts][client] receipt lookup found no exact serial match", {
          receiptSerial: query,
          returnedRows: rows.length,
          staffId: attempt.attendantFilter ?? null,
          scope: attempt.useGlobalScope ? "global" : "mine",
        });
      } catch (error) {
        console.error("[receipts][client] receipt lookup crashed", {
          receiptSerial: query,
          staffId: attempt.attendantFilter ?? null,
          scope: attempt.useGlobalScope ? "global" : "mine",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return "";
  };

  const verifySavedReceiptReady = async (receiptId: string) => {
    const attemptsMs = [0, 300, 700, 1500, 2500, 4000];
    for (const delayMs of attemptsMs) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        const res = await fetch(`/api/receipts/${encodeURIComponent(receiptId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.ok) {
          return true;
        }
      } catch (error) {
        console.warn("[receipts][client] saved receipt readiness probe failed", {
          receiptId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return false;
  };

  const togglePaymentMethodSelection = (method: "MPESA" | "CASH") => {
    setSelectedPaymentMethods((prev) => {
      const isActive = prev[method];
      const other = method === "MPESA" ? "CASH" : "MPESA";
      if (isActive && !prev[other]) {
        return prev; // always keep at least one method selected
      }
      return { ...prev, [method]: !isActive };
    });
  };

  const handleCustomerTypeSelection = (type: "walk-in" | "online" | "delivery" | "pod") => {
    setCustomerType(type);
    if (type === "delivery") {
      // ensure address input is visible for delivery customers
      setShowAddressInput(true);
    }
    if (type !== "delivery") {
      setDeliveryStatus("pending");
    }
    if (type !== "pod") {
      setPodNote("");
    } else {
      setShowAddressInput(true);
    }
  };

  const handleCashPaidChange = (rawValue: string) => {
    if (rawValue === "") {
      setCashPaid("");
      setMpesaPaid(Math.max(0, total));
      return;
    }
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(0, Math.min(total, parsed));
    setCashPaid(clamped);
    setMpesaPaid(Math.max(0, total - clamped));
  };

  const handleMpesaPaidChange = (rawValue: string) => {
    if (rawValue === "") {
      setMpesaPaid("");
      setCashPaid(Math.max(0, total));
      return;
    }
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(0, Math.min(total, parsed));
    setMpesaPaid(clamped);
    setCashPaid(Math.max(0, total - clamped));
  };

  const handlePreview = (autoPrint = false) => {
    if (!staffId) {
      showToast("Select staff before previewing", "error");
      return;
    }
    if (!hasPaymentMethodSelection) {
      showToast("Select a payment method before previewing", "error");
      return;
    }
    if (!customerType) {
      showToast("Select a customer type before previewing", "error");
      return;
    }
    const draft = buildDraft(primaryPaymentMethod);
    return openPreviewWindow(draft, autoPrint);
  };

  const resetForm = () => {
    setItems([newItem()]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setCustomerType("");
    setDeliveryStatus("pending");
    setDeposit(0);
    setShowSerials(false);
    setShowWarranty(false);
    setGlobalWarranty("");
    setCashPaid(0);
    setMpesaPaid(0);
    setNotes("");
    setSerial(generateReceiptSerial());
    setDocType("RECEIPT");
    setCatalogOpen(false);
    setCatalogQuery("");
    setCatalogResults([]);
    setStaffId(defaultStaffId);
  };

  const handleSave = async () => {

    if (!staffId) return showToast("Select staff", "error");
    if (!items.length) return showToast("Add at least one item", "error");
    if (!hasPaymentMethodSelection) return showToast("Select payment method", "error");
    if (!customerName.trim()) return showToast("Customer name is required", "error");
    if (!customerPhone.trim()) return showToast("Customer phone is required", "error");
    if (!customerType) return showToast("Select a customer type", "error");
    if (customerType === "delivery" && deliveryStatus === "failed") {
      return showToast("Delivery marked as failed cannot be submitted", "error");
    }
    if (total <= 0) return showToast("Total must be greater than zero", "error");
    const resolvedPaymentMethod = primaryPaymentMethod as "MPESA" | "CASH";
    const normalizedItems = items.map((it) => ({
      title: it.title.trim(),
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      isDeliveryFee: Boolean(it.isDeliveryFee),
      serial: showSerials ? it.serial || null : null,
      warranty: showWarranty ? it.warranty || null : null,
      productId: it.productId || null,
      sku: it.sku || null,
      buyingPrice: it.variableCost ? null : Number(it.buyingPrice || 0),
      variableCost: Boolean(it.variableCost),
      commissionEnabled: Boolean(it.commissionEnabled),
      commissionAmount: Number(it.commissionAmount || 0),
      commissionRequiresApproval: Boolean(it.commissionRequiresApproval),
    }));
    const hasInvalidItem = normalizedItems.some((it) => !it.title || it.unitPrice <= 0);
    if (hasInvalidItem) {
      return showToast("Each item needs a description and price", "error");
    }

    setSaving(true);
    try {
      const payload = {
        docType: docType.toLowerCase(),
        serial,
        date: new Date().toISOString(),
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        deliveryAddress: deliveryAddress || undefined,
        attendantId: staffId,
        issuedById: staffId,
        attendantName: selectedStaff?.name || "",
        taxRate: normalizedTaxRate,
        showTax,
        discount: normalizedDiscount,
        showDiscount: effectiveShowDiscount,
        paymentDetailsShown,
        paymentMethod: resolvedPaymentMethod,
        customerType,
        deliveryStatus: customerType === "delivery" ? deliveryStatus : undefined,
        podDelivery: customerType === "pod" ? { note: podNote || "" } : undefined,
        notes,
        websiteOrderId: websiteOrderId || undefined,
        globalWarranty: globalWarranty || undefined,
        deposit: docType === "LAYAWAY" ? deposit : undefined,
        paymentBreakdown: {
          cash: normalizedPaymentBreakdown.cash,
          mpesa: normalizedPaymentBreakdown.mpesa,
        },
        metadata: websiteOrderId
          ? {
              source: "WEBSITE",
              websiteOrderId,
              websiteOrderRef,
            }
          : undefined,
        items: normalizedItems,
      };

      const res = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // handle duplicate owner (409) specially
        if (res.status === 409 && data?.code === "DUPLICATE_RECEIPT") {
          setDuplicateOwner(data.owner ?? { message: data.message });
          showToast(data?.message || "Duplicate receipt detected", "error");
          return;
        }
        return showToast(data?.error || "Failed to save receipt", "error");
      }

      let receiptId = typeof data?.receiptId === "string" ? data.receiptId : "";
      const draft = buildDraft(primaryPaymentMethod);
      if (!receiptId) {
        receiptId = await lookupSavedReceiptId(serial);
      }

      if (!receiptId) {
        showToast("Receipt was created but could not be verified yet. Please retry opening it from receipt history.", "error");
        onCreated?.(data, { staffId, serial, receiptId: null });
        return;
      }

      const receiptReady = await verifySavedReceiptReady(receiptId);
      if (!receiptReady) {
        showToast("Receipt was saved but is still syncing. Please open it from receipt history in a few seconds.", "error");
        onCreated?.({ ...data, receiptId }, { staffId, serial, receiptId });
        return;
      }

      // Open the persisted receipt route so printing/sending follows the normal POS receipt flow.
      const receiptOpened = openSavedReceiptWindow(receiptId, draft, true);
      if (receiptOpened) {
        showToast("Saved receipt", "success");
        onCreated?.({ ...data, receiptId }, { staffId, serial, receiptId });
        resetForm();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "text-xs uppercase tracking-wide text-slate-400";
  const fieldClass = "mt-1 w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";
  const checkboxClass = "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500";

  return (
    <>
      <div className="receipt-screen space-y-6">
      {showHero && (
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts desk</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Betech Customers Operations</h1>
          <p className="text-sm text-slate-300">
            Track every printable document, search by customer, and open the PDF drawer without leaving this page.
          </p>
        </header>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Staff*</label>
          <select
            value={staffId ?? ""}
            onChange={(e) => setStaffId(e.target.value || null)}
            className={`${fieldClass} appearance-none`}
            required
          >
            <option value="">Select staff</option>
            {staffMembers.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Document Type</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className={`${fieldClass} appearance-none`}
          >
            <option>RECEIPT</option>
            <option>INVOICE</option>
            <option>QUOTATION</option>
            <option>LAYAWAY</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 items-center">
        <div>
          <label className={`${labelClass} flex items-center justify-between`}>
            <span>Serial / Receipt No.</span>
            <button
              type="button"
              className="text-[11px] font-medium text-emerald-300 hover:underline"
              onClick={() => setSerial(generateReceiptSerial())}
            >
              Regenerate
            </button>
          </label>
          <input
            value={serial}
            readOnly
            placeholder="Auto-generated"
            className={`${fieldClass} cursor-not-allowed text-slate-400`}
          />
          
        </div>
        <div>
          <label className={labelClass}>Customer Name</label>
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={normalizeName}
              disabled={normalizingName}
              className={`flex-none inline-flex items-center justify-center whitespace-nowrap h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-amber-300 hover:bg-slate-800 ${normalizingName ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <span className="inline-flex items-center gap-2">{normalizingName ? '…' : <><span>✨</span><span>AI</span></>}</span>
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>Customer Phone</label>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="07..."
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Customer Email</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@example.com"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-400">Customer type*</span>
        {(["walk-in", "online", "delivery", "pod"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleCustomerTypeSelection(type)}
            className={`rounded-full px-4 py-1 text-sm font-semibold ${
              customerType === type ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"
            }`}
          >
            {type === "pod" ? "POD (pay on delivery)" : type.replace("-", " ")}
          </button>
        ))}
      </div>

      {customerType === "delivery" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
            <span>Delivery status</span>
            {(["pending", "delivered", "failed"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setDeliveryStatus(status)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  deliveryStatus === status ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          {deliveryStatus === "failed" && (
            <p className="text-xs text-rose-300">Failed deliveries are recorded but cannot be submitted.</p>
          )}
        </>
      )}
      {customerType === "pod" && (
        <div className="mt-3 space-y-2 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-yellow-300">Pay on delivery note</p>
            <span className="text-[10px] uppercase tracking-[0.3em] text-yellow-300">Outside Nairobi</span>
          </div>
          <textarea
            value={podNote}
            onChange={(e) => setPodNote(e.target.value)}
            placeholder="Add any pickup or delivery instructions for POD customers"
            className="w-full rounded-xl border border-yellow-500/30 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
            rows={3}
          />
        </div>
      )}

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={showSerials} onChange={(e) => setShowSerials(e.target.checked)} className={checkboxClass} />
            Add serial / IMEI (optional)
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={showWarranty} onChange={(e) => setShowWarranty(e.target.checked)} className={checkboxClass} />
            Capture warranty per item
          </label>
        </div>

          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="w-full border-b border-slate-800 pb-3 last:border-none last:pb-0">
                {(() => {
                  const duplicateMatches =
                    it.productId || !it.title.trim()
                      ? []
                      : findSimilarProducts(
                          it.title,
                          duplicateCatalogPool.filter((product) => product.id !== it.productId),
                          0.5,
                          3,
                        );

                  return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <textarea
                      className="w-full min-h-[48px] px-3 py-2 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 resize-y"
                      value={it.title}
                      onChange={(e) => updateTitleRow(it.id, e.target.value)}
                      placeholder="Item description"
                      rows={2}
                    />
                    {it.productId ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                          Catalog
                        </span>
                        <span>{it.sku || "SKU"}</span>
                        {it.variableCost ? (
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-amber-100">
                            Variable cost
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {it.variableCost ? (
                      <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                        Profit and commission will be calculated after admin pricing.
                      </div>
                    ) : null}
                    {duplicateMatches.length ? (
                      <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200">
                          Possible existing products
                        </div>
                        <div className="mt-2 space-y-2">
                          {duplicateMatches.map(({ item: match, score }) => (
                            <div key={match.id} className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-white">{match.name}</div>
                                <div className="text-xs text-slate-300">
                                  {match.sku} · Selling KES {Number(match.sellingPrice || 0).toLocaleString()}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/10"
                                onClick={() => applyCatalogProductToRow(it.id, match)}
                              >
                                Use this · {Math.round(score * 100)}%
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-amber-100/80">
                          This description is close to products already in the POS catalog. Reuse one where possible before adding a new manual item.
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="flex-shrink-0 h-12 px-4 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 flex items-center justify-center"
                      onClick={() => aiDescription(it)}
                      disabled={descLoadingId === it.id}
                    >
                      {descLoadingId === it.id ? "…" : "✨ AI"}
                    </button>
                    <input
                      type="number"
                      min={1}
                      className="flex-shrink-0 h-12 min-w-[68px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
                      value={it.quantity}
                      onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    />
                    <input
                      type="number"
                      min={0}
                      className="flex-shrink-0 h-12 min-w-[92px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
                      value={it.unitPrice === "" ? "" : it.unitPrice}
                      onChange={(e) => updateRow(it.id, { unitPrice: sanitizeNumericInput(e.target.value) })}
                      placeholder="Unit price"
                    />
                    {showSerials && (
                      <input
                        className="h-12 min-w-[92px] px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 w-full sm:w-auto"
                        value={it.serial}
                        onChange={(e) => updateRow(it.id, { serial: e.target.value })}
                        placeholder="Serial / IMEI (optional)"
                      />
                    )}
                    {showWarranty && (
                      <select
                        className="h-12 min-w-[120px] rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 w-full sm:w-auto"
                        value={it.warranty}
                        onChange={(e) => updateRow(it.id, { warranty: e.target.value })}
                      >
                        <option value="">No warranty</option>
                        {warrantyOptions.map((w) => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className="flex-shrink-0 h-12 px-4 rounded-md bg-red-600 text-white hover:bg-red-700"
                      onClick={() => removeRow(it.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
          </div>

        <div className="mt-2 no-print flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            onClick={addRow}
          >
            + Add item
          </button>
          <button
            type="button"
            className="rounded-xl border border-sky-400/60 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/10"
            onClick={() => {
              setCatalogOpen(true);
              void searchCatalog(catalogQuery);
            }}
          >
            + Select product
          </button>
          <button
            type="button"
            className="rounded-xl border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black"
            onClick={addDeliveryFeeRow}
          >
            + Add delivery fee
          </button>
          <button
            type="button"
            className={`rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold ${showAddressInput ? "text-black bg-emerald-500" : "text-slate-200 hover:bg-white/5"}`}
            onClick={() => setShowAddressInput((prev) => !prev)}
          >
            {showAddressInput ? "Hide address" : "+ Add address"}
          </button>
        </div>
      </section>

      {catalogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">POS Catalog</p>
                <h2 className="text-xl font-semibold text-white">Select product</h2>
                <p className="text-sm text-slate-400">
                  Pick an admin-managed product to attach it to this receipt. Similar catalog products are ranked first so you can reuse existing items before adding new ones.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5"
                onClick={() => setCatalogOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <input
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search by product name, SKU, or category"
                className={fieldClass}
              />
            </div>

            <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {catalogLoading ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-300">
                  Loading products...
                </div>
              ) : rankedCatalogResults.length ? (
                rankedCatalogResults.map((product) => {
                  const similarityScore = catalogQuery.trim()
                    ? getProductSimilarityScore(catalogQuery, product.name)
                    : 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left hover:border-emerald-500/40 hover:bg-slate-950"
                      onClick={() => addCatalogProduct(product)}
                    >
                      <div className="space-y-1">
                        <div className="font-semibold text-white">{product.name}</div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">
                          {product.sku}
                          {product.category ? ` · ${product.category}` : ""}
                        </div>
                        <div className="text-xs text-slate-400">
                          Selling: KES {Number(product.sellingPrice || 0).toLocaleString()}
                          {product.variableCost ? " · Priced later" : ""}
                        </div>
                      </div>
                      {similarityScore >= 0.5 ? (
                        <div className="rounded-full border border-amber-400/30 px-2 py-1 text-xs font-semibold text-amber-100">
                          {Math.round(similarityScore * 100)}% similar
                        </div>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-6 text-sm text-slate-300">
                  No products found.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {(showAddressInput || customerType === "delivery") && (
        <div className="mt-3">
          <label className={labelClass}>Delivery address</label>
          <div className="mt-1 flex gap-2">
            <input
              value={deliveryAddress ?? ""}
              onChange={(e) => setDeliveryAddress(e.target.value || undefined)}
              placeholder="Customer delivery address"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={async () => {
                if (!deliveryAddress || !deliveryAddress.trim()) return;
                setAddressLoading(true);
                try {
                  const res = await fetch('/api/ai/address-correct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawAddress: deliveryAddress }) });
                  if (!res.ok) throw new Error('Address correction failed');
                  const data = await res.json().catch(() => null);
                  if (data?.address) setDeliveryAddress(data.address);
                } catch (err) {
                  showToast(err instanceof Error ? err.message : 'AI address failed', 'error');
                } finally {
                  setAddressLoading(false);
                }
              }}
              className="rounded-xl px-3 py-2 bg-[#060b1b] border border-gray-700 text-gray-200"
              disabled={addressLoading}
            >
              {addressLoading ? '…' : '✨ AI'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass}>Tax %</label>
          <input
            type="number"
            value={Number.isFinite(taxRate) ? taxRate : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setTaxRate(NaN);
              } else {
                setTaxRate(Number(raw));
              }
            }}
            className={fieldClass}
          />
          <label className="mt-2 inline-flex items-center text-sm text-slate-200">
            <input type="checkbox" checked={showTax} onChange={(e) => setShowTax(e.target.checked)} className={`${checkboxClass} mr-2`} />
            Show Tax
          </label>
        </div>
        <div>
          <label className={labelClass}>Discount (KES)</label>
          <input
            type="number"
            value={Number.isFinite(discount) ? discount : ""}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setDiscount(NaN);
              } else {
                setDiscount(Number(raw));
              }
            }}
            className={fieldClass}
          />
          <label className="mt-2 inline-flex items-center text-sm text-slate-200">
            <input type="checkbox" checked={showDiscount} onChange={(e) => setShowDiscount(e.target.checked)} className={`${checkboxClass} mr-2`} />
            Show Discount
          </label>
        </div>
        <div>
          <label className={labelClass}>Payment method</label>
          <div className="mt-2 flex gap-2">
            {(["MPESA", "CASH"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => togglePaymentMethodSelection(method)}
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                  selectedPaymentMethods[method]
                    ? "bg-emerald-500 text-black"
                    : "border border-white/10 text-slate-200"
                }`}
                aria-pressed={selectedPaymentMethods[method]}
              >
                {method === "MPESA" ? "MPESA" : "Cash"}
              </button>
            ))}
          </div>
          {docType === "LAYAWAY" && (
            <div className="mt-3 space-y-1">
              <label className={labelClass}>Deposit (KES)</label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value || 0))}
                className={fieldClass}
              />
              <p className="text-xs text-slate-400">Balance auto-computed from total.</p>
            </div>
          )}
        </div>
      </div>

      {showSplitPaymentInputs && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Cash paid (KES)</label>
            <input
              type="number"
              value={cashPaid === "" ? "" : cashPaid}
              min={0}
              max={total}
              placeholder="0"
              onChange={(e) => handleCashPaidChange(e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-slate-400">
              Automatic MPESA value: KES {(total - numericCashPaid).toLocaleString()}
            </p>
          </div>
          <div>
            <label className={labelClass}>MPESA paid (KES)</label>
            <input
              type="number"
              value={mpesaPaid === "" ? "" : mpesaPaid}
              min={0}
              max={total}
              placeholder="0"
              onChange={(e) => handleMpesaPaidChange(e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-slate-400">
              Cash portion: KES {(total - numericMpesaPaid).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2">
          <label className={labelClass}>General notes / terms</label>
          <button
            type="button"
            onClick={aiNotes}
            disabled={notesLoading}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-emerald-400 disabled:opacity-40"
          >
            {notesLoading ? "…" : "✨ Generate notes"}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none"
        />
        {notes && (
          <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-100">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide text-slate-400">Notes preview</div>
                <div className="no-print">
                  {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                  {/* @ts-ignore-next-line */}
                  <RichFormattingToggle />
                </div>
              </div>
              {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
              {/* @ts-ignore-next-line */}
              <MarkdownRendererClient mdText={notes} />
            </div>
        )}
      </div>

        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-xl shadow-black/40 md:flex-row md:items-center">
          <div className="space-y-1 text-sm text-slate-200">
            <div>Subtotal: KES {subtotal.toLocaleString()}</div>
            {showTax && <div>Tax: KES {taxAmount.toLocaleString()}</div>}
            {effectiveShowDiscount && <div>Discount: KES {normalizedDiscount.toLocaleString()}</div>}
            <div className="text-lg font-semibold text-white">Total: KES {total.toLocaleString()}</div>
            {docType === "LAYAWAY" && (
              <div className="text-amber-300">Balance after deposit: KES {balance.toLocaleString()}</div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 no-print">
            {/* Preview paper selector removed — A5 is used by default */}
            <button
              type="button"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5"
              onClick={() => handlePreview(false)}
            >
              Preview receipt
            </button>
            <button
              type="button"
              disabled={!lastPrintableUrl}
              onClick={() => {
                if (lastPrintableUrl) window.open(lastPrintableUrl, "_blank");
              }}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reopen last printable
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save to System & Print"}
            </button>
          </div>
        </div>
    </div>
    {/* Print-only snapshot area: rendered when we have server-backed receipt to print */}

    {duplicateOwner && (
      <ReceiptDuplicateModal owner={duplicateOwner} onClose={() => setDuplicateOwner(null)} />
    )}
    </>
  );
}
