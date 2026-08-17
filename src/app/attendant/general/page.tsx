import { Suspense } from "react";
import AttendantOnlineClient from "../online/AttendantOnlineClient";
import OnlineWorkspaceLayoutClient from "../online/OnlineWorkspaceLayoutClient";

export default function AttendantGeneralOpsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <OnlineWorkspaceLayoutClient mode="general">
        <AttendantOnlineClient mode="general" />
      </OnlineWorkspaceLayoutClient>
    </Suspense>
  );
}
