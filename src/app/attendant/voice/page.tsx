import { redirect } from "next/navigation";
import VoiceConsoleClient from "@/components/voice/VoiceConsoleClient";
import { withImpersonateId } from "@/lib/impersonation";
import { getVoiceLiveSnapshot, resolveVoiceViewer } from "@/lib/voiceOperations";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ impersonateId?: string }>;
};

export default async function AttendantVoicePage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const viewer = await resolveVoiceViewer({
    impersonateId: params.impersonateId,
  });

  if (!viewer) redirect("/attendant/login");

  const backHref =
    viewer.targetAttendantCategory === "DIRECT_SALES_OPS"
      ? withImpersonateId("/marketing/tracker", viewer.impersonateId)
      : withImpersonateId("/attendant/daily-report", viewer.impersonateId);

  const initialData = await getVoiceLiveSnapshot({ viewer });
  const pollBaseHref = withImpersonateId("/api/voice/live", viewer.impersonateId);

  return (
    <VoiceConsoleClient
      mode="staff"
      initialData={initialData}
      backHref={backHref}
      pollBaseHref={pollBaseHref}
      badge="Voice Calls"
      title="Agent Voice Console"
      subtitle="See only the calls, follow-ups, and customer context assigned to you, then turn each voice session into a quote, receipt, or resolved task."
    />
  );
}
