import { redirect } from "next/navigation";
import VoiceConsoleClient from "@/components/voice/VoiceConsoleClient";
import { resolveVoiceViewer, getVoiceLiveSnapshot } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

export default async function AdminVoiceDashboardPage() {
  const viewer = await resolveVoiceViewer();
  if (!viewer) redirect("/admin/login");
  if (!viewer.isAdmin) redirect("/not-authorized");

  const initialData = await getVoiceLiveSnapshot({ viewer });

  return (
    <VoiceConsoleClient
      mode="admin"
      initialData={initialData}
      backHref="/admin"
      pollBaseHref="/api/voice/live"
      badge="Communication Center"
      title="Live Voice Operations Center"
      subtitle="Monitor incoming sessions, active routing, customer history, missed-call follow-ups, notes, and recordings from one CRM-style console."
    />
  );
}
