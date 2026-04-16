"use client";

import { useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import ReceiptPaymentMethodEditor from "./ReceiptPaymentMethodEditor";

type EditItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
  buyingPrice: number;
  serial?: string | null;
  warranty?: string | null;
};

type EditDraft = {
  docType: string;
  attendantId: string | null;
  customerName: string;
  customerPhone?: string | null;
  taxRate: number;
  showTax: boolean;
  discount: number;
  showDiscount: boolean;
  paymentDetailsShown: boolean;
  notes?: string | null;
  warrantyText?: string | null;
  items: EditItem[];
};

type Props = {
  receiptId: string;
  html: string;
  canEdit: boolean;
  initialPaymentMethod: "MPESA" | "CASH";
  initialDraft: EditDraft;
};

const DOC_TYPES = ["RECEIPT", "INVOICE", "QUOTATION", "LAYAWAY"];
const WARRANTY_OPTIONS = ["", "3 Months", "6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];

const cloneDraft = (draft: EditDraft): EditDraft => ({
  ...draft,
  items: draft.items.map((item) => ({ ...item })),
});

const randomId = () => Math.random().toString(36).slice(2, 9);

export default function ReceiptDetailClient({
  receiptId,
  html,
  canEdit,
  initialPaymentMethod,
  initialDraft,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() => cloneDraft(initialDraft));

  const totals = useMemo(() => {
    const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = draft.showTax ? subtotal * (draft.taxRate / 100) : 0;
    const total = subtotal + tax - draft.discount;
    return { subtotal, tax, total };
  }, [draft]);

  const updateItem = (id: string, patch: Partial<EditItem>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addItem = () => {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: randomId(),
          title: "",
          quantity: 1,
          unitPrice: 0,
          buyingPrice: 0,
          serial: null,
          warranty: null,
        },
      ],
    }));
  };

  const removeItem = (id: string) => {
    setDraft((current) => {
      const items = current.items.filter((item) => item.id !== id);
      return {
        ...current,
        items: items.length
          ? items
          : [
              {
                id: randomId(),
                title: "",
                quantity: 1,
                unitPrice: 0,
                buyingPrice: 0,
                serial: null,
                warranty: null,
              },
            ],
      };
    });
  };

  const saveReceipt = async () => {
    if (!draft.items.length) {
      showToast("Add at least one item before saving", "warn");
      return;
    }
    if (draft.items.some((item) => !item.title.trim())) {
      showToast("Each item needs a product name", "warn");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...draft,
        items: draft.items.map((item) => ({
          title: item.title.trim(),
          quantity: Math.max(1, Number(item.quantity || 1)),
          unitPrice: Math.max(0, Number(item.unitPrice || 0)),
          buyingPrice: Math.max(0, Number(item.buyingPrice || 0)),
          serial: item.serial || null,
          warranty: item.warranty || null,
        })),
      };
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update receipt");
      showToast("Receipt updated", "success");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update receipt", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto bg-transparent p-0 text-black">
      <div className="no-print mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => window.print()}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => {
            fetch(`/api/receipts/${receiptId}/send?channels=whatsapp`, { method: "POST" }).catch(() => {});
            showToast("WhatsApp send queued", "success");
          }}
          className="shrink-0 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          Send via WhatsApp
        </button>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setDraft(cloneDraft(initialDraft));
              setEditOpen(true);
            }}
            className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            Edit receipt
          </button>
        ) : null}
        {canEdit ? (
          <ReceiptPaymentMethodEditor
            receiptId={receiptId}
            initialPaymentMethod={initialPaymentMethod}
            className="mb-0"
          />
        ) : null}
      </div>

      <div dangerouslySetInnerHTML={{ __html: html }} />

      {editOpen ? (
        <div className="no-print fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Edit receipt</h2>
                <p className="text-sm text-slate-500">Update product names, quantities, prices and customer details.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm text-slate-700">
                Document type
                <select
                  value={draft.docType}
                  onChange={(e) => setDraft((current) => ({ ...current, docType: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {DOC_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Customer name
                <input
                  value={draft.customerName}
                  onChange={(e) => setDraft((current) => ({ ...current, customerName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                Customer phone
                <input
                  value={draft.customerPhone || ""}
                  onChange={(e) => setDraft((current) => ({ ...current, customerPhone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.showTax}
                  onChange={(e) => setDraft((current) => ({ ...current, showTax: e.target.checked }))}
                />
                Show tax
              </label>
              <input
                type="number"
                min={0}
                value={draft.taxRate}
                onChange={(e) => setDraft((current) => ({ ...current, taxRate: Number(e.target.value || 0) }))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.showDiscount}
                  onChange={(e) => setDraft((current) => ({ ...current, showDiscount: e.target.checked }))}
                />
                Show discount
              </label>
              <input
                type="number"
                min={0}
                value={draft.discount}
                onChange={(e) => setDraft((current) => ({ ...current, discount: Number(e.target.value || 0) }))}
                className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Items</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                >
                  + Add item
                </button>
              </div>

              {draft.items.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-12">
                  <input
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    placeholder="Product name"
                    className="md:col-span-4 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                    className="md:col-span-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                    placeholder="Price"
                    className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={item.serial || ""}
                    onChange={(e) => updateItem(item.id, { serial: e.target.value })}
                    placeholder="Serial"
                    className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={item.warranty || ""}
                    onChange={(e) => updateItem(item.id, { warranty: e.target.value || null })}
                    className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {WARRANTY_OPTIONS.map((option) => (
                      <option key={option || "none"} value={option}>
                        {option || "No warranty"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="md:col-span-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="flex flex-wrap items-center gap-4">
                <span>Subtotal: <strong>KES {totals.subtotal.toLocaleString("en-KE", { maximumFractionDigits: 0 })}</strong></span>
                <span>Tax: <strong>KES {totals.tax.toLocaleString("en-KE", { maximumFractionDigits: 0 })}</strong></span>
                <span>Total: <strong>KES {totals.total.toLocaleString("en-KE", { maximumFractionDigits: 0 })}</strong></span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReceipt}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? "Saving..." : "Save receipt"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
