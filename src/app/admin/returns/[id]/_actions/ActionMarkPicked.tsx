"use client";
import confirmDialog from "@/lib/confirm";
import toast from "@/lib/toast";

export default function ActionMarkPicked({ returnId, disabled }: { returnId: string; disabled?: boolean }) {
  const onClick = async () => {
    if (disabled) return;
    const ok = await confirmDialog("Mark this return as picked up? This will set status = picked_up.");
    if (!ok) return;
    const r = await fetch(`/api/returns/${returnId}/pick`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!r.ok) {
      toast("Failed to mark picked up", "error");
      return;
    }
    toast("Return marked as picked", "success");
    window.location.href = "/admin/returns";
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-white/10 px-4 py-2 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Mark Picked Up
    </button>
  );
}
