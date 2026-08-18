import { Suspense, type ReactNode } from "react";
import SupportWorkspaceShell from "./SupportWorkspaceShell";

export default function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <SupportWorkspaceShell>{children}</SupportWorkspaceShell>
    </Suspense>
  );
}
