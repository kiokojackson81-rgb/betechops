import { Suspense, type ReactNode } from "react";
import OnlineWorkspaceLayoutClient from "./OnlineWorkspaceLayoutClient";

export default function AttendantOnlineLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <OnlineWorkspaceLayoutClient>{children}</OnlineWorkspaceLayoutClient>
    </Suspense>
  );
}
