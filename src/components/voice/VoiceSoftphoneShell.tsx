"use client";

import BrowserPhone from "@/components/voice/BrowserPhone";
import FallbackCallPopup from "@/components/voice/FallbackCallPopup";
import { SoftphoneProvider } from "@/components/voice/SoftphoneProvider";

export default function VoiceSoftphoneShell({
  children,
  enableFloatingPhone = true,
}: {
  children: React.ReactNode;
  enableFloatingPhone?: boolean;
}) {
  return (
    <SoftphoneProvider>
      {children}
      {enableFloatingPhone ? <BrowserPhone /> : null}
      <FallbackCallPopup />
    </SoftphoneProvider>
  );
}
