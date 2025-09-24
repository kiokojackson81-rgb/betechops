"use client";

export default function FinalizePricingButton({ orderId }: { orderId: string }) {
  const onClick = async () => {
    const ok = confirm("Finalize pricing and set status = CONFIRMED?");
    if (!ok) return;
    const r = await fetch(`/api/orders/${orderId}/finalize-pricing`, { method: "POST" });
    if (!r.ok) { alert("Failed to finalize"); return; }
    // Return to list
    window.location.href = "/admin/pending-pricing";
  };
  return (
    <button onClick={onClick} className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">
      Finalize Pricing
    </button>
  );
}