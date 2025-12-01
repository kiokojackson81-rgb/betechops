"use client";

import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";

type PaymentMethod = "MPESA" | "CASH";

type ProductRow = {
  id: string;
  name: string;
  buyingPrice: number | "";
};

type ReceiptRow = {
  id: string;
  sellingTotal: number | "";
  receiptNumber: string;
  paymentMethod: PaymentMethod;
  products: ProductRow[];
};

const cardClasses =
  "rounded-2xl border border-white/10 bg-slate-950/70 shadow-lg shadow-black/30";

function createEmptyProduct(): ProductRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    buyingPrice: "",
  };
}

function createEmptyReceipt(): ReceiptRow {
  return {
    id: crypto.randomUUID(),
    sellingTotal: "",
    receiptNumber: "",
    paymentMethod: "MPESA",
    products: [createEmptyProduct()],
  };
}

export default function DailyReportFinal() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [dayOfWeek, setDayOfWeek] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString("en-KE", { weekday: "long" });
  });

  const [receipts, setReceipts] = useState<ReceiptRow[]>([createEmptyReceipt()]);

  const [walkinsServed, setWalkinsServed] = useState<number | "">("");
  const [walkinsPurchased, setWalkinsPurchased] = useState<number | "">("");
  const [shopCleaned, setShopCleaned] = useState(false);
  const [shopNeatness, setShopNeatness] = useState(false);
  const [displayLabeled, setDisplayLabeled] = useState(false);

  const [productsUploaded, setProductsUploaded] = useState<number | "">("");
  const [productsEdited, setProductsEdited] = useState<number | "">("");
  const [productsCopied, setProductsCopied] = useState<number | "">("");

  const [repliedFbComments, setRepliedFbComments] = useState(false);
  const [repliedFbDms, setRepliedFbDms] = useState(false);
  const [repliedIgComments, setRepliedIgComments] = useState(false);
  const [repliedIgDms, setRepliedIgDms] = useState(false);
  const [clearedFbInbox, setClearedFbInbox] = useState(false);
  const [clearedIgInbox, setClearedIgInbox] = useState(false);

  const [stockChecked, setStockChecked] = useState(false);
  const [pricingConfirmed, setPricingConfirmed] = useState(false);
  const [competitorsReviewed, setCompetitorsReviewed] = useState(false);
  const [oosReview, setOosReview] = useState(false);

  const [notes, setNotes] = useState("");

  const { totalReceipts, totalSales, totalItems, totalNewProducts } = useMemo(() => {
    const totalReceipts = receipts.length;
    let totalSales = 0;
    let totalItems = 0;

    receipts.forEach((r) => {
      totalSales += Number(r.sellingTotal || 0);
      totalItems += r.products.length;
    });

    const totalNewProducts = Number(productsUploaded || 0);
    return { totalReceipts, totalSales, totalItems, totalNewProducts };
  }, [receipts, productsUploaded]);

  const totalEditedProducts = Number(productsEdited || 0);
  const totalCopiedProducts = Number(productsCopied || 0);
  const totalWalkinsServed = Number(walkinsServed || 0);
  const totalWalkinsPurchased = Number(walkinsPurchased || 0);

  const updateReceipt = (id: string, updates: Partial<ReceiptRow>) => {
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const updateProduct = (
    receiptId: string,
    productId: string,
    updates: Partial<ProductRow>,
  ) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              products: r.products.map((p) =>
                p.id === productId ? { ...p, ...updates } : p,
              ),
            }
          : r,
      ),
    );
  };

  const addProductToReceipt = (receiptId: string) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId ? { ...r, products: [...r.products, createEmptyProduct()] } : r,
      ),
    );
  };

  const removeProductFromReceipt = (receiptId: string, productId: string) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId
          ? {
              ...r,
              products:
                r.products.length > 1
                  ? r.products.filter((p) => p.id !== productId)
                  : r.products,
            }
          : r,
      ),
    );
  };

  const addReceipt = () => {
    setReceipts((prev) => [...prev, createEmptyReceipt()]);
  };

  const removeReceipt = (id: string) => {
    setReceipts((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleReset = () => {
    setReceipts([createEmptyReceipt()]);
    setWalkinsServed("");
    setWalkinsPurchased("");
    setShopCleaned(false);
    setShopNeatness(false);
    setDisplayLabeled(false);
    setProductsUploaded("");
    setProductsEdited("");
    setProductsCopied("");
    setRepliedFbComments(false);
    setRepliedFbDms(false);
    setRepliedIgComments(false);
    setRepliedIgDms(false);
    setClearedFbInbox(false);
    setClearedIgInbox(false);
    setStockChecked(false);
    setPricingConfirmed(false);
    setCompetitorsReviewed(false);
    setOosReview(false);
    setNotes("");
  };

  const handleSubmit = () => {
    // TODO: replace with your actual API call / autosave
    const payload = {
      date,
      dayOfWeek,
      receipts,
      walkinsServed: totalWalkinsServed,
      walkinsPurchased: totalWalkinsPurchased,
      shopCleaned,
      shopNeatness,
      displayLabeled,
      productsUploaded: Number(productsUploaded || 0),
      productsEdited: Number(productsEdited || 0),
      productsCopied: Number(productsCopied || 0),
      customerComms: {
        repliedFbComments,
        repliedFbDms,
        repliedIgComments,
        repliedIgDms,
        clearedFbInbox,
        clearedIgInbox,
      },
      marketplaceReview: {
        stockChecked,
        pricingConfirmed,
        competitorsReviewed,
        oosReview,
      },
      notes,
    };

    console.log("SUBMIT DAILY REPORT", payload);
    alert("Submit handler called – wire this to your API.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-6 py-8 space-y-6">
      <div className={cardClasses + " px-6 py-5 flex flex-col gap-4"}>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Marketing Operations – Daily Report
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track today&apos;s sales, product updates and market activities.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Date</span>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                <CalendarIcon size={16} />
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  const d = new Date(e.target.value);
                  if (!Number.isNaN(d.getTime())) {
                    setDayOfWeek(d.toLocaleDateString("en-KE", { weekday: "long" }));
                  }
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-9 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Day of week</span>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-5">
          <div className={cardClasses + " px-6 py-5 space-y-4"}>
            <header className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Sales records
              </p>
              <h2 className="text-lg md:text-xl font-semibold">
                Add each receipt for today
              </h2>
              <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
            </header>

            <div className="space-y-6">
              {receipts.map((receipt, rIndex) => (
                <div key={receipt.id} className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Receipt {rIndex + 1}
                    </span>
                    {receipts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReceipt(receipt.id)}
                        className="text-xs text-slate-400 hover:text-red-400"
                      >
                        Remove receipt
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wide text-slate-400">
                        Selling total (KES)
                      </label>
                      <input
                        type="number"
                        value={receipt.sellingTotal}
                        onChange={(e) =>
                          updateReceipt(receipt.id, { sellingTotal: Number(e.target.value || 0) })
                        }
                        className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wide text-slate-400">
                        Receipt number (required)
                      </label>
                      <input
                        type="text"
                        value={receipt.receiptNumber}
                        onChange={(e) => updateReceipt(receipt.id, { receiptNumber: e.target.value })}
                        placeholder="Required"
                        className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wide text-slate-400">
                        Payment method (required)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateReceipt(receipt.id, { paymentMethod: "MPESA" })}
                          className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            receipt.paymentMethod === "MPESA"
                              ? "border-emerald-500 bg-emerald-500 text-black"
                              : "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          MPESA
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReceipt(receipt.id, { paymentMethod: "CASH" })}
                          className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            receipt.paymentMethod === "CASH"
                              ? "border-emerald-500 bg-emerald-500 text-black"
                              : "border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          Cash
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      Products in this receipt
                    </p>
                    <div className="space-y-2">
                      {receipt.products.map((p) => (
                        <div
                          key={p.id}
                          className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Product name"
                            value={p.name}
                            onChange={(e) =>
                              updateProduct(receipt.id, p.id, { name: e.target.value })
                            }
                            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                          <input
                            type="number"
                            placeholder="Buying price (KES)"
                            value={p.buyingPrice}
                            onChange={(e) =>
                              updateProduct(receipt.id, p.id, {
                                buyingPrice: Number(e.target.value || 0),
                              })
                            }
                            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                          />
                          {receipt.products.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeProductFromReceipt(receipt.id, p.id)}
                              className="text-xs text-slate-400 hover:text-red-400"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addProductToReceipt(receipt.id)}
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-800"
                    >
                      + Add product to this receipt
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <button
                  type="button"
                  onClick={addReceipt}
                  className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
                >
                  + Add receipt
                </button>
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  <span className="rounded-full bg-slate-900/70 px-3 py-1.5">
                    Receipts: <span className="font-semibold text-emerald-400">{totalReceipts}</span>
                  </span>
                  <span className="rounded-full bg-slate-900/70 px-3 py-1.5">
                    Sales: <span className="font-semibold text-emerald-400">KES {totalSales.toLocaleString()}</span>
                  </span>
                  <span className="rounded-full bg-slate-900/70 px-3 py-1.5">
                    Items: <span className="font-semibold text-emerald-400">{totalItems}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-5">
          <div className={cardClasses + " px-6 py-5"}>
            <h2 className="text-sm font-semibold mb-3">Quick stats</h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <StatTile label="Receipts" value={totalReceipts} />
              <StatTile label="Sales (KES)" value={`KES ${totalSales.toLocaleString()}`} />
              <StatTile label="New products" value={totalNewProducts} />
              <StatTile label="Edited products" value={totalEditedProducts} />
              <StatTile label="Copied products" value={totalCopiedProducts} />
              <StatTile label="Walk-ins served" value={totalWalkinsServed} />
              <StatTile label="Walk-ins purchased" value={totalWalkinsPurchased} />
            </div>
          </div>

          <div className={cardClasses + " px-6 py-5 space-y-4"}>
            <h2 className="text-sm md:text-base font-semibold">Walk-ins & shop neatness</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Walk-ins served today</label>
                <input
                  type="number"
                  value={walkinsServed}
                  onChange={(e) =>
                    setWalkinsServed(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-32 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Walk-ins who purchased</label>
                <input
                  type="number"
                  value={walkinsPurchased}
                  onChange={(e) =>
                    setWalkinsPurchased(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-32 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <PillCheckbox label="Shop cleaned" checked={shopCleaned} onChange={setShopCleaned} />
                <PillCheckbox label="Shop neatness" checked={shopNeatness} onChange={setShopNeatness} />
                <PillCheckbox label="Display labeled" checked={displayLabeled} onChange={setDisplayLabeled} />
              </div>
            </div>
          </div>

          <div className={cardClasses + " px-6 py-5 space-y-4"}>
            <h2 className="text-sm md:text-base font-semibold">Product & stock management</h2>
            <div className="space-y-3">
              <NumberRow label="Products uploaded" value={productsUploaded} onChange={setProductsUploaded} />
              <NumberRow label="Products edited" value={productsEdited} onChange={setProductsEdited} />
              <NumberRow label="Products copied" value={productsCopied} onChange={setProductsCopied} />
            </div>
          </div>

          <div className={cardClasses + " px-6 py-5 space-y-4"}>
            <h2 className="text-sm md:text-base font-semibold">Customer & communications</h2>
            <div className="flex flex-wrap gap-2">
              <PillCheckbox label="Replied to FB comments" checked={repliedFbComments} onChange={setRepliedFbComments} />
              <PillCheckbox label="Replied to FB DMs" checked={repliedFbDms} onChange={setRepliedFbDms} />
              <PillCheckbox label="Replied to IG comments" checked={repliedIgComments} onChange={setRepliedIgComments} />
              <PillCheckbox label="Replied to IG DMs" checked={repliedIgDms} onChange={setRepliedIgDms} />
              <PillCheckbox label="Cleared FB inbox" checked={clearedFbInbox} onChange={setClearedFbInbox} />
              <PillCheckbox label="Cleared IG inbox" checked={clearedIgInbox} onChange={setClearedIgInbox} />
            </div>
          </div>

          <div className={cardClasses + " px-6 py-5 space-y-4"}>
            <h2 className="text-sm md:text-base font-semibold">Marketplace review</h2>
            <div className="flex flex-wrap gap-2">
              <PillCheckbox label="Stock checked" checked={stockChecked} onChange={setStockChecked} />
              <PillCheckbox label="Pricing confirmed" checked={pricingConfirmed} onChange={setPricingConfirmed} />
              <PillCheckbox label="Competitors reviewed" checked={competitorsReviewed} onChange={setCompetitorsReviewed} />
              <PillCheckbox label="Out of stock review" checked={oosReview} onChange={setOosReview} />
            </div>
          </div>

          <div className={cardClasses + " px-6 py-5 space-y-3"}>
            <h2 className="text-sm md:text-base font-semibold">Notes / summary</h2>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional comments, highlights or issues…"
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className={cardClasses + " px-6 py-4 flex flex-col md:flex-row gap-3 justify-between items-center"}>
        <div className="text-xs text-slate-400">
          Review your entries before submitting. You can still edit after saving from the admin panel.
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
          >
            Reset day
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-emerald-400 truncate">{value}</span>
    </div>
  );
}

function PillCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        checked
          ? "border-emerald-500 bg-emerald-500 text-black"
          : "border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-100">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-24 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-right text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}
