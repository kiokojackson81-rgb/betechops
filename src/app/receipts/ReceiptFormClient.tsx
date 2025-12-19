"use client";

import React, { useEffect, useMemo, useState } from "react";
import MarkdownRendererClient, { RichFormattingToggle } from "@/components/MarkdownRendererClient";
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
};

const warrantyOptions = ["1 Year", "2 Years", "3 Years", "5 Years", "6 Years", "10 Years"];
const newItem = (): ItemRow => ({
  id: Math.random().toString(36).slice(2),
  title: "",
  quantity: 1,
  unitPrice: "",
  serial: "",
  warranty: "",
});

const sanitizeNumericInput = (value: string): number | "" => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return "";
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : "";
};


type ReceiptFormProps = {
  onCreated?: (receipt: any) => void;
  showHero?: boolean;
};

export default function ReceiptFormClient({ onCreated, showHero = true }: ReceiptFormProps) {  
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; name: string; email?: string | null }>>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("RECEIPT");
  const [serial, setSerial] = useState<string>(() => generateReceiptSerial());
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [normalizingName, setNormalizingName] = useState<boolean>(false);
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [taxRate, setTaxRate] = useState<number>(16);
  const [showTax, setShowTax] = useState<boolean>(false);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [paymentDetailsShown, setPaymentDetailsShown] = useState<boolean>(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState({ MPESA: true, CASH: false });
  const hasPaymentMethodSelection = selectedPaymentMethods.MPESA || selectedPaymentMethods.CASH;
  const primaryPaymentMethod = selectedPaymentMethods.MPESA ? "MPESA" : "CASH";
  // Paper size is fixed to A5 by default; remove runtime selector
  const [notes, setNotes] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string | undefined>(undefined);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState<boolean>(false);
  const [customerType, setCustomerType] = useState<"walk-in" | "online" | "delivery" | "">("");
  const [deliveryStatus, setDeliveryStatus] = useState<"pending" | "delivered" | "failed">("pending");
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
        if (mapped.length) {
          setStaffId((prev) => {
            if (prev) return prev;
            const preferredNames = ["jeniffer", "jennifer", "jenifer"];
            const defaultStaff = mapped.find((item) => {
              const haystack = `${item.name || ""} ${item.email || ""}`.toLowerCase();
              return preferredNames.some((needle) => haystack.includes(needle));
            });
            return (defaultStaff ?? mapped[0]).id;
          });
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const addRow = () => setItems((s) => [...s, newItem()]);
  const removeRow = (id: string) => setItems((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  const updateRow = (id: string, patch: Partial<ItemRow>) => setItems((s) => s.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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
      cash: numericCashPaid,
      mpesa: numericMpesaPaid,
    },
    paymentMethods: selectedPaymentMethods,
  });

  const [lastPrintableUrl, setLastPrintableUrl] = useState<string | null>(null);

  const buildPreviewUrl = (draft: ReturnType<typeof buildDraft>) => {
    const encoded = encodeURIComponent(btoa(JSON.stringify(draft)));
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

  const handleCustomerTypeSelection = (type: "walk-in" | "online" | "delivery") => {
    setCustomerType(type);
    if (type === "delivery") {
      setPaymentDetailsShown(true);
      // ensure address input is visible for delivery customers
      setShowAddressInput(true);
    }
    if (type !== "delivery") {
      setDeliveryStatus("pending");
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

  const whatsappMessage = useMemo(() => {
    if (!customerPhone || !customerName || !customerType) return "";
    const lines = [
      `Customer: ${customerName}`,
      `Phone: ${customerPhone}`,
      `Type: ${customerType}`,
      `Total: KES ${total.toLocaleString()}`,
      `Items: ${items.map((item) => item.title || "Item").join(", ")}`,
      `MPESA: KES ${numericMpesaPaid.toLocaleString()}`,
      `Cash: KES ${numericCashPaid.toLocaleString()}`,
    ];
    return lines.join("\n");
  }, [customerName, customerPhone, customerType, total, items, mpesaPaid, cashPaid]);

  const handlePreview = (autoPrint = false) => {
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
    if (showSplitPaymentInputs && Math.abs(numericCashPaid + numericMpesaPaid - total) > 0.1) {
      return showToast("Cash + MPESA must equal the total", "error");
    }

    const resolvedPaymentMethod = primaryPaymentMethod as "MPESA" | "CASH";
    const normalizedItems = items.map((it) => ({
      title: it.title.trim(),
      quantity: Number(it.quantity || 1),
      unitPrice: Number(it.unitPrice || 0),
      serial: showSerials ? it.serial || null : null,
      warranty: showWarranty ? it.warranty || null : null,
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
        deliveryAddress: deliveryAddress || undefined,
        attendantId: staffId,
        issuedById: staffId,
        taxRate: normalizedTaxRate,
        showTax,
        discount: normalizedDiscount,
        showDiscount: effectiveShowDiscount,
        paymentDetailsShown,
        paymentMethod: resolvedPaymentMethod,
        customerType,
        deliveryStatus: customerType === "delivery" ? deliveryStatus : undefined,
        notes,
        globalWarranty: globalWarranty || undefined,
        deposit: docType === "LAYAWAY" ? deposit : undefined,
        paymentBreakdown: {
          cash: numericCashPaid,
          mpesa: numericMpesaPaid,
        },
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

      showToast("Saved receipt", "success");
      onCreated?.(data);

      // Open preview and auto-print; if preview opens successfully reset form
      const previewOpened = handlePreview(true);
      if (previewOpened) {
        resetForm();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "text-xs uppercase tracking-wide text-slate-400";
  const fieldClass = "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";
  const compactFieldClass = "rounded-xl border border-slate-800 bg-slate-950/80 px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none";
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
          <label className={labelClass}>Staff</label>
          <select
            value={staffId ?? ""}
            onChange={(e) => setStaffId(e.target.value || null)}
            className={`${fieldClass} appearance-none`}
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

      <div className="grid gap-4 md:grid-cols-3">
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
          <div className="flex items-center gap-2">
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-slate-400">Customer type*</span>
        {(["walk-in", "online", "delivery"] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => handleCustomerTypeSelection(type)}
            className={`rounded-full px-4 py-1 text-sm font-semibold ${
              customerType === type ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"
            }`}
          >
            {type.replace("-", " ")}
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
              <div key={it.id} className="w-full flex items-center gap-3 border-b border-slate-800 pb-2">
                <textarea
                  className="w-1/2 min-h-[48px] px-3 py-2 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 resize-y"
                  value={it.title}
                  onChange={(e) => updateRow(it.id, { title: e.target.value })}
                  placeholder="Item description"
                  rows={2}
                />
                <button
                  type="button"
                  className="h-12 px-4 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200 flex items-center justify-center"
                  onClick={() => aiDescription(it)}
                  disabled={descLoadingId === it.id}
                >
                  {descLoadingId === it.id ? "…" : "✨ AI"}
                </button>
                <input
                  type="number"
                  min={1}
                  className="w-20 h-12 px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
                  value={it.quantity}
                  onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                />
                <input
                  type="number"
                  min={0}
                  className="w-32 h-12 px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
                  value={it.unitPrice === "" ? "" : it.unitPrice}
                  onChange={(e) => updateRow(it.id, { unitPrice: sanitizeNumericInput(e.target.value) })}
                  placeholder="Unit price"
                />
                {showSerials && (
                  <input
                    className="w-32 h-12 px-3 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
                    value={it.serial}
                    onChange={(e) => updateRow(it.id, { serial: e.target.value })}
                    placeholder="Serial / IMEI (optional)"
                  />
                )}
                {showWarranty && (
                  <select
                    className="w-32 h-12 rounded-md bg-[#060b1b] border border-gray-700 text-gray-200"
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
                  className="h-12 px-4 rounded-md bg-red-600 text-white hover:bg-red-700"
                  onClick={() => removeRow(it.id)}
                >
                  Remove
                </button>
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
          <label className={labelClass}>Payment details</label>
          <div className="mt-2 space-y-3">
            <label className="inline-flex items-center text-sm text-slate-200">
              <input
                type="checkbox"
                checked={paymentDetailsShown}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPaymentDetailsShown(checked);
                  if (checked) setSelectedPaymentMethods((prev) => ({ ...prev, MPESA: true }));
                }}
                className={`${checkboxClass} mr-2`}
              />
              Include payment details on receipt
            </label>
            <div className="flex gap-2">
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

      {whatsappMessage && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">WhatsApp message</p>
          <textarea
            readOnly
            value={whatsappMessage}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 p-2 text-xs text-slate-100"
          />
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
