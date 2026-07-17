import { Suspense } from "react";
import WellnessClient from "@/app/attendant/wellness/WellnessClient";

export const dynamic = "force-dynamic";

export default function TechnicalWellnessPage() {
  return (
    <Suspense fallback={null}>
      <WellnessClient />
    </Suspense>
  );
}
