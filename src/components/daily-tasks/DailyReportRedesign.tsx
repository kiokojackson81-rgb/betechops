"use client";
import DailyTasksUI from "./DailyTasksUI";

export default function DailyReportRedesign() {
  // Render the original `DailyTasksUI` to guarantee full parity with the
  // canonical form (all fields, autosave and submit behaviour). This lets
  // us iterate on visual restyling safely in follow-up changes.
  return <DailyTasksUI />;
}

    const [dayState, setDayState] = useState<Record<DayKey, Record<string, any>>>(() => ({
      monday: {},
      tuesday: {},
      wednesday: {},
      thursday: {},
      friday: {},
      saturday: {},
    }));

    const [market, setMarket] = useState<Record<DayKey, MarketplaceState>>(() => ({
      monday: defaultMarketplaceState(),
      tuesday: defaultMarketplaceState(),
      wednesday: defaultMarketplaceState(),
      thursday: defaultMarketplaceState(),
      friday: defaultMarketplaceState(),
      saturday: defaultMarketplaceState(),
    }));

    const [customerComms, setCustomerComms] = useState<Record<DayKey, any>>(() => ({
      monday: {},
      tuesday: {},
      wednesday: {},
      thursday: {},
      friday: {},
      saturday: {},
    }));

    // helper mapping for weekday display and conditional rendering
    const currentDayName = useMemo(() => selectedDate.toLocaleDateString("en-US", { weekday: "long" }), [selectedDate]);

    useEffect(() => {
      // reset numeric fields when day changes to avoid stale values where intended
      // keep existing state but provide defaults for missing keys
      setDayState((prev) => ({
        ...prev,
        [day]: { ...(prev[day] || {}) },
      }));
    }, [day]);

    // basic submit handler that mirrors original payload structure
    const [busy, setBusy] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const gatherPayload = () => {
      const categories = {
        newUploads: Number(market[day].newUploaded) || 0,
        copiesUploaded: Number(market[day].copiesUploaded) || 0,
        productsEdited: Number(market[day].productsEdited) || 0,
      };

      const sales = (market[day].sales || []).map((s) => ({ id: s.id, productName: String(s.name || "").trim(), price: Number(s.price || 0), paymentMethod: s.paymentMethod || "", receiptNumber: s.receiptNumber || "", buyingPrice: Number((s.buyingPrice as any) || 0) }));

      const productsCount = categories.newUploads + categories.copiesUploaded + categories.productsEdited;
      const totalSales = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

      const body = {
        date: selectedDate.toISOString(),
        day,
        productsCount,
        totalSales,
        submittedBy: null,
        tasks: {
          categories,
          sales,
          marketplaceReview: market[day].review || undefined,
          customerComms: customerComms[day] || undefined,
          dayFields: dayState[day] || {},
        },
      };

      return body;
    };

    const handleSubmit = async () => {
      setBusy(true);
      setError(null);
      try {
        const body = gatherPayload();
        const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setError(json?.error || `Server responded ${res.status}`);
        } else {
          setSuccess("Saved successfully");
          setTimeout(() => setSuccess(null), 4000);
        }
      } catch (err: any) {
        setError(err?.message || String(err));
      } finally {
        setBusy(false);
      }
    };

    // Simple autosave (debounced) – smaller than original to keep behavior predictable
    const autosaveTimer = useRef<number | null>(null);
    useEffect(() => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            const body = gatherPayload();
            await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
          } catch (e) {
            // ignore autosave failures here; UI can surface save button errors
          }
        })();
      }, 1000) as unknown as number;
      return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
    }, [dayState, market, customerComms, day, selectedDate]);

    // Build day navigation buttons like the original UI
    const dayKeys: DayKey[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Daily Task Ops (Mon–Sat)</h1>
            <p className="text-sm text-slate-400">Redesigned form — preserves every field from the original daily entry.</p>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-2 w-full">
          {dayKeys.map((k) => {
            const isActive = day === k;
            const label = k.slice(0, 3).toUpperCase();
            return (
              <button key={k} onClick={() => setDay(k)} className={isActive ? "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-200 bg-white/5 px-3 py-2" : "rounded-xl inline-flex items-center justify-center gap-2 text-xs border border-white/10 text-slate-300 bg-transparent hover:bg-white/5 px-3 py-2"}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Date & controls card */}
        <div className={cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-slate-400" />
              <input type="date" className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={selectedDate.toISOString().split("T")[0]} onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setSelectedDate(d); }} />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
            <select className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={currentDayName} onChange={(e) => {
              const nextDate = new Date(selectedDate);
              const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
              const cur = nextDate.getDay();
              const target = days.indexOf(e.target.value);
              const diff = target - cur;
              nextDate.setDate(nextDate.getDate() + diff);
              setSelectedDate(nextDate);
            }}>
              { ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => <option key={d} value={d}>{d}</option>) }
            </select>
          </div>

          <div className="flex items-end gap-4">
            <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { setDayState({ monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {} }); setMarket({ monday: defaultMarketplaceState(), tuesday: defaultMarketplaceState(), wednesday: defaultMarketplaceState(), thursday: defaultMarketplaceState(), friday: defaultMarketplaceState(), saturday: defaultMarketplaceState() }); setCustomerComms({ monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {} }); }}>Reset day</button>
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit report'}</button>
          </div>
        </div>

        {/* Main grid: receipts + marketplace + comms + day-specific cards */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              {/* Receipts & sales (left column) */}
              <section className={cardClasses + " p-5 mb-4"}>
                <h3 className="text-lg font-semibold">Receipts & Sales</h3>
                <p className="text-xs text-slate-400 mt-1">Add receipts and items sold (includes payment method and receipt numbers).</p>

                <div className="mt-4 space-y-4">
                  {(market[day].sales || []).map((row) => (
                    <div key={row.id} className={cardClasses + " p-4"}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold">Receipt</div>
                          <div className="text-xs text-slate-400">Totals are calculated automatically.</div>
                        </div>
                        <div>
                          <button type="button" className="text-xs text-rose-400" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove receipt</button>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 mt-4 items-center">
                        <div className="col-span-4">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Selling total (KES)</label>
                          <input type="number" value={row.price === "" ? "" : String(row.price)} onChange={(e) => { const raw = (e.target as HTMLInputElement).value; const parsed = raw === "" ? 0 : Number(raw); const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : 0; setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, price: safe } : r)) } })); }} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                        </div>

                        <div className="col-span-5">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Receipt number</label>
                          <input value={row.receiptNumber || ''} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, receiptNumber: (e.target as HTMLInputElement).value } : r) } }))} placeholder="Required" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                        </div>

                        <div className="col-span-3">
                          <label className="text-xs font-medium text-slate-400 mb-1 block">Payment method</label>
                          <div className="flex items-center gap-2 mt-2">
                            <button type="button" className={`px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'MPESA' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`} onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'MPESA' } : r) } }))}>MPESA</button>
                            <button type="button" className={`px-3 py-1 rounded-full text-xs ${row.paymentMethod === 'CASH' ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-gray-200'}`} onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, paymentMethod: 'CASH' } : r) } }))}>Cash</button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-sm font-medium">Products in this receipt</div>
                        <div className="mt-2 grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-8">
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Product name</label>
                            <input placeholder="Product name" value={row.name || ''} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, name: (e.target as HTMLInputElement).value } : r) } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                          </div>
                          <div className="col-span-3">
                            <label className="text-xs font-medium text-slate-400 mb-1 block">Buying price (KES)</label>
                            <input type="number" value={String((row as any).buyingPrice ?? '')} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => r.id === row.id ? { ...r, buyingPrice: Number((e.target as HTMLInputElement).value || 0) } : r) } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" />
                          </div>
                          <div className="col-span-1 flex items-center">
                            <button type="button" className="text-xs text-rose-400" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove</button>
                          </div>
                        </div>
                        <div className="mt-3">
                          <button type="button" className="rounded-xl border border-white/10 text-slate-200 bg-transparent hover:bg-white/5 text-sm px-3 py-2 inline-flex items-center justify-center gap-2" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: '', price: '', paymentMethod: 'MPESA', receiptNumber: '' }] } }))}>+ Add product to this receipt</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end">
                    <button type="button" className="rounded-xl px-4 py-2 bg-emerald-500 text-black font-semibold hover:brightness-95 text-sm" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: '', price: '' }] } }))}>Add row</button>
                  </div>
                </div>
              </section>

              {/* Notes / summary */}
              <section className={cardClasses + " p-5 mt-4"}>
                <label className="text-sm font-semibold">Notes / Summary</label>
                <textarea rows={4} value={String((dayState[day] || {}).notes ?? '')} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], notes: e.target.value } }))} className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 mt-2" placeholder="Any additional comments, highlights or issues…" />
              </section>
            </div>

            <div>
              {/* Marketplace review card */}
              <MarketplaceStockPricingCard value={market[day].review} onChange={(next) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], review: next } }))} />

              {/* Customer communications */}
              <div className="mt-4">
                <CustomerCommsActivityCard value={customerComms[day]} onChange={(next) => setCustomerComms((prev) => ({ ...prev, [day]: next }))} />
              </div>

              {/* Day-specific right column cards */}
              <div className="mt-4">
                {day === 'tuesday' && <ProductMarketingVideosCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'wednesday' && <WednesdayLiveCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'thursday' && <ThursdayWeeklyCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'friday' && <FridayWeekendPrepCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
                {day === 'saturday' && <SaturdayLiveAndStoreCard value={dayState[day]} onChange={(next) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], ...next } }))} />}
              </div>
            </div>
          </div>
        </div>

        {/* Save area */}
        <div className={cardClasses + " mt-4 flex gap-2 justify-end"}>
          <div className="flex items-center gap-3">
            {success ? <div className="p-2 rounded bg-emerald-900/10 text-emerald-300">{success}</div> : null}
            {error ? <div className="p-2 rounded bg-rose-900/10 text-rose-300">{error}</div> : null}
            <button className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => { setDayState((s) => ({ ...s, [day]: {} })); setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() })); setCustomerComms((c) => ({ ...c, [day]: {} })); }}>Reset day</button>
            <button className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit} disabled={busy}>{busy ? 'Submitting...' : 'Submit report'}</button>
          </div>
        </div>
      </div>
    );
  }
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={() => {
              // reset logic would clear state here
              location.reload();
            }}
          >
            Reset day
          </button>
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            onClick={handleSubmit}
          >
            Submit report
          </button>
        </div>
      </div>

      {/* Receipt entry */}
      <ReceiptSection />

      {/* Checklist sections */}
      {sections.map((sec) => (
        <DayChecklist key={sec.title} title={sec.title} items={sec.items} />
      ))}

      {/* Final notes textarea */}
      <div className={cardClasses + " p-6 space-y-2"}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Any additional comments, highlights or issues…"
        />
      </div>
    </div>
  );
}
