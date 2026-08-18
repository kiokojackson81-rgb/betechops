import { Suspense } from "react";
import WellnessClient from "@/app/attendant/wellness/WellnessClient";

export default function MarketingWellnessPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-300">Loading wellness...</div>}>
      <WellnessClient />
    </Suspense>
  );
}
