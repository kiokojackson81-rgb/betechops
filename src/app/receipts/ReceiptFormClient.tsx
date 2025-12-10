"use client";

import React, { useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { generateReceiptSerial } from "@/lib/receipts/serial";
import ReceiptPrintView from "./_components/ReceiptPrintView";
import ReceiptDuplicateModal from "./_components/ReceiptDuplicateModal";

type ItemRow = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number | "";
  serial?: string;
  warranty?: string;
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

type ReceiptFormProps = {
  onCreated?: (receipt: any) => void;
  showHero?: boolean;
};

export default function ReceiptFormClient({ onCreated, showHero = true }: ReceiptFormProps) {  
  const [attendants, setAttendants] = useState<Array<{ id: string; name: string; email?: string | null }>>([]);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("RECEIPT");
  const [serial, setSerial] = useState<string>(() => generateReceiptSerial());
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([newItem()]);
  const [taxRate, setTaxRate] = useState<number>(16);
  const [showTax, setShowTax] = useState<boolean>(false);
  const [discount, setDiscount] = useState<number>(0);
  const [showDiscount, setShowDiscount] = useState<boolean>(false);
  const [paymentDetailsShown, setPaymentDetailsShown] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "CASH">("MPESA");
  const [notes, setNotes] = useState<string>("");
  const [deposit, setDeposit] = useState<number>(0);
  const [showSerials, setShowSerials] = useState<boolean>(false);
  const [showWarranty, setShowWarranty] = useState<boolean>(false);
  const [globalWarranty, setGlobalWarranty] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<any>(null);
  const [duplicateOwner, setDuplicateOwner] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users?roles=ATTENDANT");
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
        setAttendants(mapped);
        if (mapped.length) {
          setAttendantId((prev) => {
            if (prev) return prev;
            const jeniffer = mapped.find((att) => {
              const haystack = `${att.name || ""} ${att.email || ""}`.toLowerCase();
              return haystack.includes("jeniffer");
            });
            return (jeniffer ?? mapped[0]).id;
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

  const normalizedTaxRate = Number.isFinite(taxRate) ? taxRate : 0;
  const normalizedDiscount = Number.isFinite(discount) ? discount : 0;

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0), [items]);
  const taxAmount = showTax ? subtotal * (normalizedTaxRate / 100) : 0;
  const total = subtotal + taxAmount - normalizedDiscount;
  const balance = docType === "LAYAWAY" ? Math.max(0, total - deposit) : 0;
  const selectedAttendant = attendants.find((a) => a.id === attendantId);
  const effectiveShowDiscount = showDiscount || normalizedDiscount > 0;

  const handleSave = async () => {
    if (!attendantId) return showToast("Select attendant", "error");
    if (!items.length) return showToast("Add at least one item", "error");
    if (!paymentMethod) return showToast("Select payment method", "error");

    setSaving(true);
    try {
      const payload = {
        docType: docType.toLowerCase(),
        serial,
        date: new Date().toISOString(),
        customerName,
        customerPhone,
        attendantId,
        issuedById: attendantId,
        taxRate: normalizedTaxRate,
        showTax,
        discount: normalizedDiscount,
        showDiscount: effectiveShowDiscount,
        paymentDetailsShown,
        paymentMethod,
        notes,
        globalWarranty: globalWarranty || undefined,
        deposit: docType === "LAYAWAY" ? deposit : undefined,
        items: items.map((it) => ({
          title: it.title,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0),
          serial: showSerials ? it.serial || null : null,
          warranty: showWarranty ? it.warranty || null : null,
        })),
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

      // fetch the saved receipt (include items) so we can render exact print view
      try {
        const listRes = await fetch(`/api/receipts?includeItems=true&q=${encodeURIComponent(serial)}`);
        const listJson = await listRes.json().catch(() => null);
        const found = listJson?.receipts?.find((r: any) => r.orderRef === serial) || (listJson?.receipts && listJson.receipts[0]);
        if (found) {
          setPrintSnapshot(found);
          // allow render, then print
          setTimeout(() => {
            window.print();
            setSerial(generateReceiptSerial());
            // clear print snapshot after print
            setTimeout(() => setPrintSnapshot(null), 1000);
          }, 300);
        } else {
          setSerial(generateReceiptSerial());
          setTimeout(() => window.print(), 300);
        }
      } catch (e) {
        setSerial(generateReceiptSerial());
        setTimeout(() => window.print(), 300);
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
    <div className="space-y-6">
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
          <label className={labelClass}>Attendant</label>
          <select
            value={attendantId ?? ""}
            onChange={(e) => setAttendantId(e.target.value || null)}
            className={`${fieldClass} appearance-none`}
          >
            <option value="">Select attendant</option>
            {attendants.map((a) => (
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
          <p className="mt-1 text-xs text-slate-400">
            Generated automatically for receipts, invoices, quotations and layaway.
          </p>
        </div>
        <div>
          <label className={labelClass}>Customer Name</label>
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name"
            className={fieldClass}
          />
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
            <div key={it.id} className="grid items-start gap-2 border-b border-slate-800 pb-2 md:grid-cols-7">
              <textarea
                className={`col-span-2 ${compactFieldClass} min-h-[40px] resize-y`}
                value={it.title}
                onChange={(e) => updateRow(it.id, { title: e.target.value })}
                placeholder="Item description"
                rows={2}
              />
              <input
                type="number"
                min={1}
                className={compactFieldClass}
                value={it.quantity}
                onChange={(e) => updateRow(it.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
              />
              <input
                type="number"
                min={0}
                className={compactFieldClass}
                value={it.unitPrice as any}
                onChange={(e) => updateRow(it.id, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })}
                placeholder="Unit price"
              />
              {showSerials ? (
                <input
                  className={compactFieldClass}
                  value={it.serial}
                  onChange={(e) => updateRow(it.id, { serial: e.target.value })}
                  placeholder="Serial / IMEI (optional)"
                />
              ) : (
                <div className="hidden md:block" />
              )}
              {showWarranty ? (
                <select
                  className={`${compactFieldClass} appearance-none`}
                  value={it.warranty}
                  onChange={(e) => updateRow(it.id, { warranty: e.target.value })}
                >
                  <option value="">No warranty</option>
                  {warrantyOptions.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              ) : (
                <div className="hidden md:block" />
              )}
              <div className="flex gap-2 md:col-span-1 md:justify-end">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-200 hover:bg-white/5"
                  onClick={() => removeRow(it.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 no-print">
          <button
            type="button"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            onClick={addRow}
          >
            + Add item
          </button>
        </div>
      </section>

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
          <div className="mt-2 space-y-2">
            <label className="inline-flex items-center text-sm text-slate-200">
              <input
                type="checkbox"
                checked={paymentDetailsShown}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setPaymentDetailsShown(checked);
                  if (checked) setPaymentMethod("MPESA");
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
                  onClick={() => setPaymentMethod(method)}
                  disabled={paymentDetailsShown && method !== "MPESA"}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                    paymentMethod === method ? "bg-emerald-500 text-black" : "border border-white/10 text-slate-200"
                  } ${paymentDetailsShown && method !== "MPESA" ? "opacity-50 cursor-not-allowed" : ""}`}
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

      <div>
        <label className={labelClass}>General notes / terms</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-950/80 p-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400/60 focus:outline-none"
        />
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

        <div className="flex flex-wrap gap-2 no-print">
                <button
                  type="button"
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5"
                  onClick={() => {
                    try {
                      const draft = {
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
                        attendantName: selectedAttendant?.name ?? "",
                        paymentMethod,
                        paymentDetailsShown,
                        deposit: docType === "LAYAWAY" ? deposit : undefined,
                        notes,
                      };
                      const encoded = encodeURIComponent(btoa(JSON.stringify(draft)));
                      window.open(`/receipts/preview?draft=${encoded}`, "_blank");
                    } catch (e) {
                      showToast("Failed to open preview", "error");
                    }
                  }}
                >
                  Preview receipt
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
      {/* Print-only snapshot area: rendered when we have server-backed receipt to print */}
      {printSnapshot && (
        <div className="receipt-print-area print-only">
          <ReceiptPrintView data={printSnapshot} mode="print" />
        </div>
      )}

      {duplicateOwner && (
        <ReceiptDuplicateModal owner={duplicateOwner} onClose={() => setDuplicateOwner(null)} />
      )}
    </div>
  );
}
