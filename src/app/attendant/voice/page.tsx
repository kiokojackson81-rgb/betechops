import { redirect } from "next/navigation";
import VoiceConsoleClient from "@/components/voice/VoiceConsoleClient";
import { withImpersonateId } from "@/lib/impersonation";
import {
  getVoiceLiveSnapshot,
  isVoiceOperationsSchemaMissingError,
  resolveVoiceViewer,
} from "@/lib/voiceOperations";

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

  try {
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
  } catch (error) {
    if (!isVoiceOperationsSchemaMissingError(error)) throw error;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto max-w-4xl p-6">
          <div className="rounded-[28px] border border-amber-500/25 bg-amber-500/10 p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200">Voice Setup Required</div>
            <h1 className="mt-3 text-3xl font-semibold text-white">Voice operations migration is not applied yet.</h1>
            <p className="mt-3 text-sm text-amber-100/90">
              Apply migration <code>20260625150000_add_voice_operations_center</code> to this database, then refresh the page.
            </p>
          </div>
        </main>
      </div>
    );
  }
}
