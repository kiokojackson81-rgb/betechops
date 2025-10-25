"use client";
import confirmDialog from '@/lib/confirm';
import toast from '@/lib/toast';

export default function FinalizePricingButton({ orderId }: { orderId: string }) {
  const onClick = async () => {
    const ok = await confirmDialog("Finalize pricing and set status = CONFIRMED?");
    if (!ok) return;
    const r = await fetch(`/api/orders/${orderId}/finalize-pricing`, { method: "POST" });
    if (!r.ok) { toast("Failed to finalize", 'error'); return; }
    // Return to list
    window.location.href = "/admin/pending-pricing";
  };
  return (
    <button onClick={onClick} className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">
      Finalize Pricing
    </button>
  );
}