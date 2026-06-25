"use client";

import BrowserPhone from "@/components/voice/BrowserPhone";
import IncomingCallModal from "@/components/voice/IncomingCallModal";
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
      <IncomingCallModal />
    </SoftphoneProvider>
  );
}
