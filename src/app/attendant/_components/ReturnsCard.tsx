"use client";

import { useRef, useState } from "react";

export default function ReturnsCard() {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(18,22,32,.9),rgba(18,22,32,.7))] p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Returns</h2>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">New Return</button>
      </div>

      <p className="text-sm text-slate-400">Capture return details with notes and photos.</p>

      {open && <ReturnModal onClose={() => setOpen(false)} />}
    </section>
  );
}

function ReturnModal({ onClose }: { onClose: () => void }) {
  const [product, setProduct] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("Damaged");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("product", product);
      fd.append("qty", qty);
      fd.append("reason", reason);
      fd.append("notes", notes);
      if (fileRef.current?.files?.[0]) fd.append("photo", fileRef.current.files[0]);
      const r = await fetch("/api/returns", { method: "POST", body: fd });
      if (!r.ok) throw new Error("return error");
      alert("Return submitted");
      onClose();
    } catch {
      alert("Failed to submit return");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0e13] p-5">
        <h3 className="text-lg font-semibold">New Return</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-400">Product (name or SKU)</label>
            <input value={product} onChange={(e) => setProduct(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Quantity</label>
            <input value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Reason</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none">
              <option>Damaged</option>
              <option>Wrong item</option>
              <option>Not working</option>
              <option>Customer change of mind</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-400">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-2 py-1 outline-none" rows={3} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-slate-400">Photo</label>
            <input ref={fileRef} type="file" accept="image/*" className="mt-1 w-full rounded-lg border border-white/10 bg-transparent file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-slate-100" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 disabled:opacity-50">Submit</button>
        </div>
      </div>
    </div>
  );
}
