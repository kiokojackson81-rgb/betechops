import { Suspense } from "react";
import VoiceSoftphoneShell from "@/components/voice/VoiceSoftphoneShell";
import MarketingWorkspaceShell from "./MarketingWorkspaceShell";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <VoiceSoftphoneShell>
      <Suspense fallback={children}>
        <MarketingWorkspaceShell>{children}</MarketingWorkspaceShell>
      </Suspense>
    </VoiceSoftphoneShell>
  );
}
