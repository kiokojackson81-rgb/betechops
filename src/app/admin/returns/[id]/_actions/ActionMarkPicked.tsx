"use client";
import confirmDialog from '@/lib/confirm';
import toast from '@/lib/toast';

export default function ActionMarkPicked({ orderId }: { orderId: string }) {
  const onClick = async () => {
    const ok = await confirmDialog("Mark this return as picked up? This will set status = FULFILLED.");
    if (!ok) return;
    const r = await fetch(`/api/orders/${orderId}/mark-picked-up`, { method: "POST" });
    if (!r.ok) { toast("Failed to mark picked up", 'error'); return; }
    // Go back to list
    window.location.href = "/admin/returns";
  };
  return (
    <button onClick={onClick} className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10">
      Mark Picked Up
    </button>
  );
}