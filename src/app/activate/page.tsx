import type { Metadata } from "next";
import { cookies } from "next/headers";
import ReferralActivationClient from "@/app/activate/ReferralActivationClient";
import { REFERRAL_ACTIVATION_SESSION_COOKIE } from "@/lib/referralCookies";
import {
  getReferralAccountDashboardByToken,
  getReferralAccountPreviewByToken,
  validateReferralActivationSession,
} from "@/lib/reviewsReferrals";

export const metadata: Metadata = {
  title: "Activate Referral Dashboard",
  description: "View and activate your Betech referral dashboard linked to your purchase phone number.",
};

export const dynamic = "force-dynamic";

export default async function ActivateReferralPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token || "").trim();

  if (!token) {
    return (
      <div className="min-h-screen bg-[#fff8ef] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-[#ecd7cb] bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Referral activation</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#210505]">Referral token required</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">Open this page using the secure activation link sent after your review submission.</p>
        </div>
      </div>
    );
  }

  try {
    const preview = await getReferralAccountPreviewByToken(token);
    if (!preview) {
      throw new Error("Referral account not found.");
    }
    const clientPreview = {
      customerName: preview.customerName,
      customerPhoneMasked: preview.customerPhoneMasked,
      status: preview.status,
      activationExpiresAt: preview.activationExpiresAt,
      totals: {
        ...preview.totals,
        availableBalance: 0,
        pendingWithdrawalAmount: 0,
        paidWithdrawalAmount: 0,
      },
    };
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(REFERRAL_ACTIVATION_SESSION_COOKIE)?.value || "";
    let dashboard: Awaited<ReturnType<typeof getReferralAccountDashboardByToken>> = null;

    if (sessionToken) {
      try {
        validateReferralActivationSession(sessionToken, preview.customerPhone);
        dashboard = await getReferralAccountDashboardByToken(token);
      } catch {
        dashboard = null;
      }
    }

    return <ReferralActivationClient token={token} initialDashboard={dashboard} preview={clientPreview} />;
  } catch (error) {
    return (
      <div className="min-h-screen bg-[#fff8ef] px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-[#ecd7cb] bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Referral activation</div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#210505]">Activation link unavailable</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">{error instanceof Error ? error.message : "Unable to open this referral account."}</p>
        </div>
      </div>
    );
  }
}
