import { Suspense } from "react";
import WellnessClient from "./WellnessClient";

export default function AttendantWellnessPage() {
  return (
    <Suspense fallback={null}>
      <WellnessClient />
    </Suspense>
  );
}
