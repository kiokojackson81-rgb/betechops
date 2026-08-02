"use client";

import { SoftphoneProvider } from "@/components/voice/SoftphoneProvider";

export default function VoiceSoftphoneShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SoftphoneProvider>
      {children}
    </SoftphoneProvider>
  );
}
