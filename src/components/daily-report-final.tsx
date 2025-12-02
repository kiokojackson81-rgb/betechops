"use client";

import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

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
const inputClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const textareaClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const statPillClasses =
  "rounded-2xl bg-slate-900/70 border border-white/5 px-4 py-3 flex flex-col justify-between shadow-sm";

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
  const [shopNeatness, setShopNeatness] = useState({
    cleaned: false,
    neat: false,
    labeled: false,
  });

  const [productsUploaded, setProductsUploaded] = useState<number | "">("");
  const [productsEdited, setProductsEdited] = useState<number | "">("");
  const [productsCopied, setProductsCopied] = useState<number | "">("");

  const [communications, setCommunications] = useState({
    repliedFbComments: false,
    repliedFbDms: false,
    repliedIgComments: false,
    repliedIgDms: false,
    clearedFbInbox: false,
    clearedIgInbox: false,
  });

  const [marketplace, setMarketplace] = useState({
    stockChecked: false,
    pricingConfirmed: false,
    competitorsReviewed: false,
    oosReview: false,
  });

  const [liveSession, setLiveSession] = useState({
    hosted: 0,
    viewers: 0,
    durationMinutes: 0,
    platforms: "",
  });

  const [thursdayActivities, setThursdayActivities] = useState({
    attendedMeeting: false,
    attendedShoot: false,
    videosShot: 0,
  });

  const [fridayTasks, setFridayTasks] = useState({
    promoVideosPosted: 0,
    preparedWeekendPromos: false,
    improvementSummary: "",
  });

  const [saturdaySummary, setSaturdaySummary] = useState({
    liveSessionNotes: "",
    weeklySummary: "",
  });
  const [commissionForPeriod, setCommissionForPeriod] = useState(0);
  // TODO: when fetching trading-period data, call setCommissionForPeriod(data.commissionForPeriod ?? 0)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasValidationErrors] = useState(false);

  const tradingPeriod = getTradingPeriodFor(new Date(date));

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

  const updateReceipt = (id: string, updates: Partial<ReceiptRow>) =>
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));

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

  const addReceipt = () => setReceipts((prev) => [...prev, createEmptyReceipt()]);

  const removeReceipt = (id: string) =>
    setReceipts((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));

  const salesTotals = {
    receipts: totalReceipts,
    sales: totalSales,
    items: totalItems,
  };

  const quickStats = {
    receipts: totalReceipts,
    sales: totalSales,
    items: totalItems,
    commission: commissionForPeriod,
  };

  const handleResetDay = () => {
    setReceipts([createEmptyReceipt()]);
    setWalkinsServed("");
    setWalkinsPurchased("");
    setShopNeatness({ cleaned: false, neat: false, labeled: false });
    setProductsUploaded("");
    setProductsEdited("");
    setProductsCopied("");
    setCommunications({
      repliedFbComments: false,
      repliedFbDms: false,
      repliedIgComments: false,
      repliedIgDms: false,
      clearedFbInbox: false,
      clearedIgInbox: false,
    });
    setMarketplace({
      stockChecked: false,
      pricingConfirmed: false,
      competitorsReviewed: false,
      oosReview: false,
    });
    setLiveSession({ hosted: 0, viewers: 0, durationMinutes: 0, platforms: "" });
    setThursdayActivities({ attendedMeeting: false, attendedShoot: false, videosShot: 0 });
    setFridayTasks({ promoVideosPosted: 0, preparedWeekendPromos: false, improvementSummary: "" });
    setSaturdaySummary({ liveSessionNotes: "", weeklySummary: "" });
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    const payload = {
      date,
      dayOfWeek,
      receipts,
      totals: salesTotals,
      walkIns: {
        served: totalWalkinsServed,
        purchased: totalWalkinsPurchased,
      },
      neatness: shopNeatness,
      productTasks: { uploaded: productsUploaded, edited: productsEdited, copied: productsCopied },
      communications,
      marketplace,
      liveSession,
      thursdayActivities,
      fridayTasks,
      saturdaySummary,
      commissionForPeriod,
    };
    console.log("SUBMIT DAILY REPORT", payload);
    setTimeout(() => setIsSubmitting(false), 500);
  };

  const datePicker = (
    <div className="flex items-center gap-2">
      <CalendarIcon size={16} className="text-slate-400" />
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
        className={inputClasses}
      />
    </div>
  );

  const dayOfWeekSelect = (
    <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={inputClasses}>
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
        (day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ),
      )}
    </select>
  );

  const quickStatsCard = (
    <section className={cardClasses + " p-4 lg:p-6 flex flex-col gap-4"}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quick stats</h2>
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          Trading period {tradingPeriod.label}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={statPillClasses}>
          <span className="text-xs text-slate-400">Receipts</span>
          <span className="text-lg font-semibold text-emerald-400">{quickStats.receipts}</span>
        </div>
        <div className={statPillClasses}>
          <span className="text-xs text-slate-400">Sales (KES)</span>
          <span className="text-lg font-semibold text-emerald-400">{quickStats.sales.toLocaleString()}</span>
        </div>
        <div className={statPillClasses}>
          <span className="text-xs text-slate-400">Items</span>
          <span className="text-lg font-semibold text-emerald-400">{quickStats.items}</span>
        </div>
        <div className={statPillClasses}>
          <span className="text-xs text-slate-400">Commission (KES)</span>
          <span className="text-lg font-semibold text-emerald-400">{quickStats.commission.toLocaleString()}</span>
        </div>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-6 py-8 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold">Marketing Operations</h1>
          <p className="text-slate-400 text-sm">
            Daily tracker for uploads, engagement, walk-ins and live sessions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {datePicker}
          {dayOfWeekSelect}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <SalesReceiptsCard
            receipts={receipts}
            updateReceipt={updateReceipt}
            updateProduct={updateProduct}
            addProductToReceipt={addProductToReceipt}
            removeProductFromReceipt={removeProductFromReceipt}
            addReceipt={addReceipt}
            removeReceipt={removeReceipt}
            salesTotals={salesTotals}
          />

          <DaySpecificBlocks
            selectedDay={dayOfWeek}
            walkIns={totalWalkinsPurchased}
            onWalkInsChange={(val) => setWalkinsPurchased(val)}
            neatness={shopNeatness}
            onNeatnessChange={setShopNeatness}
            productTasks={{
              uploaded: Number(productsUploaded || 0),
              edited: Number(productsEdited || 0),
              copied: Number(productsCopied || 0),
            }}
            onProductTasksChange={(val) => {
              setProductsUploaded(val.uploaded);
              setProductsEdited(val.edited);
              setProductsCopied(val.copied);
            }}
            communications={communications}
            onCommunicationsChange={setCommunications}
            marketplace={marketplace}
            onMarketplaceChange={setMarketplace}
            liveSession={liveSession}
            onLiveSessionChange={setLiveSession}
            thursdayActivities={thursdayActivities}
            onThursdayActivitiesChange={setThursdayActivities}
            fridayTasks={fridayTasks}
            onFridayTasksChange={setFridayTasks}
            saturdaySummary={saturdaySummary}
            onSaturdaySummaryChange={setSaturdaySummary}
          />

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              onClick={handleResetDay}
            >
              Reset day
            </button>
            <button
              type="button"
              className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
              disabled={isSubmitting || hasValidationErrors}
              onClick={handleSubmit}
            >
              {isSubmitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          {quickStatsCard}
        </div>
      </div>
    </div>
  );
}

// Helper components

type SalesReceiptsCardProps = {
  receipts: ReceiptRow[];
  updateReceipt: (id: string, updates: Partial<ReceiptRow>) => void;
  updateProduct: (receiptId: string, productId: string, updates: Partial<ProductRow>) => void;
  addProductToReceipt: (receiptId: string) => void;
  removeProductFromReceipt: (receiptId: string, productId: string) => void;
  addReceipt: () => void;
  removeReceipt: (id: string) => void;
  salesTotals: { receipts: number; sales: number; items: number };
};

function SalesReceiptsCard(props: SalesReceiptsCardProps) {
  const {
    receipts,
    updateReceipt,
    updateProduct,
    addProductToReceipt,
    removeProductFromReceipt,
    addReceipt,
    removeReceipt,
    salesTotals,
  } = props;

  return (
    <div className={cardClasses + " px-6 py-5 space-y-4"}>
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Sales records
        </p>
        <h2 className="text-lg md:text-xl font-semibold">Add each receipt for today</h2>
        <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
      </header>

      <div className="space-y-6">
        {receipts.map((receipt, rIndex) => (
          <div
            key={receipt.id}
            className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 space-y-4"
          >
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
                  className={inputClasses}
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
                  className={inputClasses}
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
                      onChange={(e) => updateProduct(receipt.id, p.id, { name: e.target.value })}
                      className={inputClasses}
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
                      className={inputClasses}
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
              Receipts: <span className="font-semibold text-emerald-400">{salesTotals.receipts}</span>
            </span>
            <span className="rounded-full bg-slate-900/70 px-3 py-1.5">
              Sales: <span className="font-semibold text-emerald-400">KES {salesTotals.sales.toLocaleString()}</span>
            </span>
            <span className="rounded-full bg-slate-900/70 px-3 py-1.5">
              Items: <span className="font-semibold text-emerald-400">{salesTotals.items}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DaySpecificBlocks(props: DaySpecificBlocksProps) {
  const {
    selectedDay,
    walkIns,
    onWalkInsChange,
    neatness,
    onNeatnessChange,
    productTasks,
    onProductTasksChange,
    communications,
    onCommunicationsChange,
    marketplace,
    onMarketplaceChange,
    liveSession,
    onLiveSessionChange,
    thursdayActivities,
    onThursdayActivitiesChange,
    fridayTasks,
    onFridayTasksChange,
    saturdaySummary,
    onSaturdaySummaryChange,
  } = props;

  const showNeatness = ["Monday", "Thursday", "Friday", "Saturday"].includes(selectedDay);

  return (
    <div className="space-y-6">
      <WalkInsNeatnessCard
        valueWalkIns={walkIns}
        onWalkInsChange={onWalkInsChange}
        neatness={neatness}
        onNeatnessChange={onNeatnessChange}
        showNeatness={showNeatness}
      />
      <ProductStockCard productTasks={productTasks} onChange={onProductTasksChange} />
      <CustomerCommunicationsCard value={communications} onChange={onCommunicationsChange} />
      <MarketplaceReviewCard value={marketplace} onChange={onMarketplaceChange} />
      {selectedDay === "Tuesday" && <TuesdayPromoCard value={productTasks} onChange={onProductTasksChange} />}
      {selectedDay === "Wednesday" && (
        <>
          <LiveSessionCoreCard value={liveSession} onChange={onLiveSessionChange} />
          <WednesdayFollowUpCard />
          <WednesdayEngagementCard />
        </>
      )}
      {selectedDay === "Thursday" && (
        <WeeklyMarketingActivitiesCard value={thursdayActivities} onChange={onThursdayActivitiesChange} />
      )}
      {selectedDay === "Friday" && (
        <FridayPromoTasksCard value={fridayTasks} onChange={onFridayTasksChange} />
      )}
      {selectedDay === "Saturday" && (
        <>
          <LiveSessionCoreCard value={liveSession} onChange={onLiveSessionChange} />
          <SaturdaySummaryCard value={saturdaySummary} onChange={onSaturdaySummaryChange} />
        </>
      )}
    </div>
  );
}

function WalkInsNeatnessCard(props: {
  valueWalkIns: number;
  onWalkInsChange: (val: number) => void;
  neatness: { cleaned: boolean; neat: boolean; labeled: boolean };
  onNeatnessChange: (next: { cleaned: boolean; neat: boolean; labeled: boolean }) => void;
  showNeatness: boolean;
}) {
  const { valueWalkIns, onWalkInsChange, neatness, onNeatnessChange, showNeatness } = props;

  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Walk-ins & shop neatness</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Walk-ins who purchased
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={valueWalkIns}
            onChange={(e) => onWalkInsChange(Number(e.target.value) || 0)}
          />
        </div>
        {showNeatness && (
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Shop condition
            </label>
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.cleaned}
                  onChange={(e) => onNeatnessChange({ ...neatness, cleaned: e.target.checked })}
                />
                <span>Shop cleaned</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.neat}
                  onChange={(e) => onNeatnessChange({ ...neatness, neat: e.target.checked })}
                />
                <span>Shop neatness</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.labeled}
                  onChange={(e) => onNeatnessChange({ ...neatness, labeled: e.target.checked })}
                />
                <span>Display labeled</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ProductStockCard(props: {
  productTasks: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
}) {
  const { productTasks, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Product & stock management</h2>
      <div className="space-y-3">
        <NumberRow label="Products uploaded" value={productTasks.uploaded} onChange={(v) => onChange({ ...productTasks, uploaded: v })} />
        <NumberRow label="Products edited" value={productTasks.edited} onChange={(v) => onChange({ ...productTasks, edited: v })} />
        <NumberRow label="Products copied" value={productTasks.copied} onChange={(v) => onChange({ ...productTasks, copied: v })} />
      </div>
    </section>
  );
}

function CustomerCommunicationsCard(props: {
  value: CommunicationsState;
  onChange: (val: CommunicationsState) => void;
}) {
  const { value, onChange } = props;
  const entries = [
    { label: "Replied to FB comments", key: "repliedFbComments" },
    { label: "Replied to FB DMs", key: "repliedFbDms" },
    { label: "Replied to IG comments", key: "repliedIgComments" },
    { label: "Replied to IG DMs", key: "repliedIgDms" },
    { label: "Cleared FB inbox", key: "clearedFbInbox" },
    { label: "Cleared IG inbox", key: "clearedIgInbox" },
  ];
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Customer & communications</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map((item) => (
          <PillCheckbox
            key={item.key}
            label={item.label}
            checked={value[item.key as keyof typeof value]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        ))}
      </div>
    </section>
  );
}

function MarketplaceReviewCard(props: {
  value: MarketplaceState;
  onChange: (val: MarketplaceState) => void;
}) {
  const { value, onChange } = props;
  const entries = [
    { label: "Stock checked", key: "stockChecked" },
    { label: "Pricing confirmed", key: "pricingConfirmed" },
    { label: "Competitors reviewed", key: "competitorsReviewed" },
    { label: "Out of stock review", key: "oosReview" },
  ];
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Marketplace review</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map((item) => (
          <PillCheckbox
            key={item.key}
            label={item.label}
            checked={value[item.key as keyof typeof value]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        ))}
      </div>
    </section>
  );
}

function TuesdayPromoCard(props: {
  value: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Tuesday – promo content</h2>
      <p className="text-sm text-slate-400">
        Post product highlights or promotional videos and record at least one demo video for future content scheduling.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Promo videos / highlights posted
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.uploaded}
            onChange={(e) => onChange({ ...value, uploaded: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Product demo videos recorded
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.edited}
            onChange={(e) => onChange({ ...value, edited: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </section>
  );
}

function LiveSessionCoreCard(props: {
  value: LiveSessionState;
  onChange: (val: LiveSessionState) => void;
}) {
  const { value, onChange } = props;
  const v = value;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Live session</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Live sessions hosted", key: "hosted" },
          { label: "Viewers (estimated)", key: "viewers" },
          { label: "Duration (minutes)", key: "durationMinutes" },
        ].map((field) => (
          <div key={field.key}>
            <label className="text-xs uppercase tracking-wide text-slate-400">{field.label}</label>
            <input
              type="number"
              min={0}
              className={inputClasses}
              value={v[field.key as keyof typeof v]}
              onChange={(e) => onChange({ ...v, [field.key]: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Platform used (TikTok / IG / FB / YT)
        </label>
        <textarea
          rows={2}
          className={textareaClasses}
          value={v.platforms}
          onChange={(e) => onChange({ ...v, platforms: e.target.value })}
        />
      </div>
    </section>
  );
}

function WednesdayFollowUpCard() {
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Live session follow-ups</h2>
      <p className="text-sm text-slate-400">
        Conduct timely follow-ups on leads generated from the live session.
      </p>
      <textarea rows={3} className={textareaClasses} placeholder="Notes on follow-ups, customers contacted, next actions…" />
    </section>
  );
}

function WednesdayEngagementCard() {
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Content engagement tracking</h2>
      <p className="text-sm text-slate-400">
        Track engagement data to identify top-performing content (views, comments, saves, shares).
      </p>
      <textarea rows={3} className={textareaClasses} placeholder="Top-performing posts, engagement numbers, lessons learnt…" />
    </section>
  );
}

function WeeklyMarketingActivitiesCard(props: {
  value: ThursdayActivitiesState;
  onChange: (val: ThursdayActivitiesState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-5"}>
      <h2 className="text-lg font-semibold">Weekly marketing activities (Thursday)</h2>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Weekly meeting</p>
          <div className="flex flex-wrap gap-3">
            <TogglePill
              active={value.attendedMeeting}
              onClick={() => onChange({ ...value, attendedMeeting: true })}
            >
              Attended weekly marketing meeting
            </TogglePill>
            <TogglePill
              active={!value.attendedMeeting}
              onClick={() => onChange({ ...value, attendedMeeting: false })}
            >
              Did not attend
            </TogglePill>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Video shoot</p>
          <div className="flex flex-wrap gap-3">
            <TogglePill
              active={value.attendedShoot}
              onClick={() => onChange({ ...value, attendedShoot: true })}
            >
              Participated in weekly video shoot
            </TogglePill>
            <TogglePill
              active={!value.attendedShoot}
              onClick={() => onChange({ ...value, attendedShoot: false })}
            >
              Did not participate
            </TogglePill>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Number of videos participated in (shooting)
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.videosShot}
            onChange={(e) => onChange({ ...value, videosShot: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </section>
  );
}

function FridayPromoTasksCard(props: {
  value: FridayTasksState;
  onChange: (val: FridayTasksState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-5"}>
      <h2 className="text-lg font-semibold">Friday – weekend prep & improvements</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Post engaging product videos or testimonials
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.promoVideosPosted}
            onChange={(e) => onChange({ ...value, promoVideosPosted: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 mt-6 sm:mt-0">
          <input
            type="checkbox"
            checked={value.preparedWeekendPromos}
            onChange={(e) => onChange({ ...value, preparedWeekendPromos: e.target.checked })}
          />
          <span className="text-sm">Prepare weekend promotions or schedule future posts</span>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Final improvement suggestions for the week (based on competitor activities)
        </label>
        <textarea
          rows={3}
          className={textareaClasses}
          value={value.improvementSummary}
          onChange={(e) => onChange({ ...value, improvementSummary: e.target.value })}
          placeholder="Improvements, competitor moves, ideas for next week…"
        />
      </div>
    </section>
  );
}

function SaturdaySummaryCard(props: {
  value: SaturdaySummaryState;
  onChange: (val: SaturdaySummaryState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Weekly performance summary</h2>
      <p className="text-sm text-slate-400">
        Submit weekly performance summary including performance suggestions, improvement ideas,
        complaints or any issues that need management attention.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Live session highlights / key learnings
          </label>
          <textarea
            rows={3}
            className={textareaClasses}
            value={value.liveSessionNotes}
            onChange={(e) => onChange({ ...value, liveSessionNotes: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Weekly performance summary & issues needing management attention
          </label>
          <textarea
            rows={4}
            className={textareaClasses}
            value={value.weeklySummary}
            onChange={(e) => onChange({ ...value, weeklySummary: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}

function TogglePill(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { active, onClick, children } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-4 py-2 text-xs sm:text-sm font-medium border transition-colors " +
        (active
          ? "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
          : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800")
      }
    >
      {children}
    </button>
  );
}

function NumberRow(props: { label: string; value: number | ""; onChange: (v: number | "") => void }) {
  const { label, value, onChange } = props;
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

function PillCheckbox(props: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <label
      className={
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium border transition-colors " +
        (checked
          ? "bg-emerald-500 text-black border-emerald-500"
          : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
      <span>{label}</span>
    </label>
  );
}

type CommunicationsState = {
  repliedFbComments: boolean;
  repliedFbDms: boolean;
  repliedIgComments: boolean;
  repliedIgDms: boolean;
  clearedFbInbox: boolean;
  clearedIgInbox: boolean;
};

type MarketplaceState = {
  stockChecked: boolean;
  pricingConfirmed: boolean;
  competitorsReviewed: boolean;
  oosReview: boolean;
};

type LiveSessionState = {
  hosted: number;
  viewers: number;
  durationMinutes: number;
  platforms: string;
};

type ThursdayActivitiesState = {
  attendedMeeting: boolean;
  attendedShoot: boolean;
  videosShot: number;
};

type FridayTasksState = {
  promoVideosPosted: number;
  preparedWeekendPromos: boolean;
  improvementSummary: string;
};

type SaturdaySummaryState = {
  liveSessionNotes: string;
  weeklySummary: string;
};

type DaySpecificBlocksProps = {
  selectedDay: string;
  walkIns: number;
  onWalkInsChange: (val: number) => void;
  neatness: { cleaned: boolean; neat: boolean; labeled: boolean };
  onNeatnessChange: (val: { cleaned: boolean; neat: boolean; labeled: boolean }) => void;
  productTasks: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onProductTasksChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
  communications: CommunicationsState;
  onCommunicationsChange: (val: CommunicationsState) => void;
  marketplace: MarketplaceState;
  onMarketplaceChange: (val: MarketplaceState) => void;
  liveSession: LiveSessionState;
  onLiveSessionChange: (val: LiveSessionState) => void;
  thursdayActivities: ThursdayActivitiesState;
  onThursdayActivitiesChange: (val: ThursdayActivitiesState) => void;
  fridayTasks: FridayTasksState;
  onFridayTasksChange: (val: FridayTasksState) => void;
  saturdaySummary: SaturdaySummaryState;
  onSaturdaySummaryChange: (val: SaturdaySummaryState) => void;
};
