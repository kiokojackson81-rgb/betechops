"use client";

import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const isDedicatedVoiceRoute =
    pathname === "/attendant/voice" || pathname === "/admin/communications/voice";
  const showFloatingWidgets = enableFloatingPhone && !isDedicatedVoiceRoute;

  return (
    <SoftphoneProvider>
      {children}
      {showFloatingWidgets ? <BrowserPhone /> : null}
      {showFloatingWidgets ? <FallbackCallPopup /> : null}
    </SoftphoneProvider>
  );
}
