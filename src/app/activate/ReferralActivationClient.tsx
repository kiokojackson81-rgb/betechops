"use client";

import { useState } from "react";

type WithdrawalRow = {
  id: string;
  amount: number;
  method: string;
  phone: string;
  status: string;
  reference: string | null;
  reason: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReferralDashboardPayload = {
  customerName: string;
  customerPhone: string;
  status: string;
  activationExpiresAt: string | null;
  totals: {
    totalReferrals: number;
    potentialCommission: number;
    availableBalance: number;
    pendingWithdrawalAmount: number;
    paidWithdrawalAmount: number;
  };
  referrals: Array<{
    referralCode: string;
    productName: string;
    referredName: string | null;
    referredPhone: string;
    status: string;
    commissionStatus: string;
    potentialCommission: number;
    createdAt: string | null;
  }>;
  withdrawals: WithdrawalRow[];
};

type ReferralActivationClientProps = {
  token: string;
  initialDashboard: ReferralDashboardPayload | null;
  preview: {
    customerName: string;
    customerPhoneMasked: string;
    status: string;
    activationExpiresAt: string | null;
    totals: {
      totalReferrals: number;
      potentialCommission: number;
      availableBalance: number;
      pendingWithdrawalAmount: number;
      paidWithdrawalAmount: number;
    };
  };
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(value));
}

export default function ReferralActivationClient({ token, initialDashboard, preview }: ReferralActivationClientProps) {
  const [dashboard, setDashboard] = useState<ReferralDashboardPayload | null>(initialDashboard);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/referral-account/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as { ok: boolean; phone?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Unable to send OTP.");
      }
      setOtpSentTo(payload.phone || preview.customerPhoneMasked);
      setMessage(`We sent an OTP to ${payload.phone || preview.customerPhoneMasked}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send OTP.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/referral-account/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, code: otpCode }),
      });
      const payload = (await response.json()) as { ok: boolean; dashboard?: ReferralDashboardPayload; error?: string };
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.error || "Unable to verify OTP.");
      }
      setDashboard(payload.dashboard);
      setMessage("Phone number verified successfully.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to verify OTP.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleWithdrawalRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboard) return;

    setWithdrawing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/referral-account/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount: withdrawalAmount }),
      });
      const payload = (await response.json()) as { ok: boolean; withdrawal?: WithdrawalRow; error?: string };
      if (!response.ok || !payload.ok || !payload.withdrawal) {
        throw new Error(payload.error || "Unable to request withdrawal.");
      }

      const withdrawal = payload.withdrawal;
      const amount = Number(withdrawal.amount || 0);
      setDashboard((current) =>
        current
          ? {
              ...current,
              totals: {
                ...current.totals,
                availableBalance: Math.max(0, current.totals.availableBalance - amount),
                pendingWithdrawalAmount: current.totals.pendingWithdrawalAmount + amount,
              },
              withdrawals: [withdrawal, ...current.withdrawals],
            }
          : current,
      );
      setWithdrawalAmount("");
      setMessage("Withdrawal request submitted. Finance can now review and process it.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to request withdrawal.");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.20),transparent_24%),linear-gradient(180deg,#fff8ef_0%,#ffffff_50%,#f8fafc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#7a0000]/10 bg-white shadow-[0_24px_80px_rgba(122,0,0,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
            <div className="bg-[linear-gradient(145deg,#210505_0%,#5a0909_60%,#7a0000_100%)] px-6 py-8 text-white sm:px-8">
              <div className="text-xs font-black uppercase tracking-[0.28em] text-amber-300">Referral Account</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Hello {dashboard ? dashboard.customerName : preview.customerName}</h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-amber-50/90 sm:text-base">
                Your referral account is linked to your Betech purchase identity. Use this dashboard to track referrals, commissions, and withdrawals.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Registered phone</div>
                  <div className="mt-2 text-lg font-semibold">{dashboard ? dashboard.customerPhone : preview.customerPhoneMasked}</div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-amber-200">Activation token</div>
                  <div className="mt-2 break-all text-sm font-semibold">{token}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 bg-[#fff8f2] p-5 sm:grid-cols-2 sm:p-8">
              <div className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total referrals</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-[#210505]">{dashboard?.totals.totalReferrals ?? preview.totals.totalReferrals}</div>
              </div>
              <div className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Potential commission</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-[#210505]">{formatMoney(dashboard?.totals.potentialCommission ?? preview.totals.potentialCommission)}</div>
              </div>
              <div className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Available balance</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-[#210505]">{formatMoney(dashboard?.totals.availableBalance ?? preview.totals.availableBalance)}</div>
              </div>
              <div className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pending withdrawals</div>
                <div className="mt-3 text-4xl font-black tracking-tight text-[#210505]">{formatMoney(dashboard?.totals.pendingWithdrawalAmount ?? preview.totals.pendingWithdrawalAmount)}</div>
              </div>
            </div>
          </div>
        </section>

        {!dashboard ? (
          <section className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Phone verification</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Verify your purchase phone number to open the dashboard</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                We use the same phone number linked to your Betech purchase. This keeps review identity, referral earnings and withdrawals on one customer record.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={busy}
                className="inline-flex min-h-[3.3rem] items-center justify-center rounded-[20px] bg-[#7a0000] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending OTP..." : "Send OTP"}
              </button>
              {otpSentTo ? <div className="inline-flex items-center rounded-2xl border border-[#ecd7cb] bg-[#fffaf5] px-4 py-3 text-sm text-slate-700">OTP sent to {otpSentTo}</div> : null}
            </div>

            {message ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
            {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

            <form onSubmit={handleVerifyOtp} className="mt-6 grid max-w-xl gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-[#210505]">Enter OTP code</span>
                <input
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45"
                />
              </label>
              <button
                type="submit"
                disabled={verifying || otpCode.trim().length < 6}
                className="inline-flex min-h-[3.3rem] items-center justify-center rounded-[20px] border border-[#7a0000]/18 bg-[#fff8ef] px-5 py-3 text-sm font-bold text-[#7a0000] transition hover:bg-[#fff2df] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verifying..." : "Verify OTP and open dashboard"}
              </button>
            </form>
          </section>
        ) : null}

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <section className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Withdrawals</div>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Request available commission payouts</h2>
            </div>
            <div className="rounded-2xl border border-[#ecd7cb] bg-[#fffaf5] px-4 py-3 text-sm font-semibold text-[#210505]">
              Paid withdrawals: {formatMoney(dashboard?.totals.paidWithdrawalAmount ?? preview.totals.paidWithdrawalAmount)}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <form onSubmit={handleWithdrawalRequest} className="rounded-[28px] border border-[#ecd7cb] bg-[#fffaf5] p-5">
              <div className="text-sm font-bold text-[#210505]">New withdrawal request</div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                Minimum withdrawal is {formatMoney(1000)}. Requests use the verified purchase phone number for payout review.
              </div>
              <label className="mt-5 grid gap-2">
                <span className="text-sm font-semibold text-[#210505]">Amount</span>
                <input
                  value={withdrawalAmount}
                  onChange={(event) => setWithdrawalAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 1500"
                  disabled={!dashboard || withdrawing}
                  className="rounded-2xl border border-[#ddc6ba] bg-white px-4 py-3 outline-none transition focus:border-[#7a0000]/45 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <div className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">Activation expires {formatDate(dashboard?.activationExpiresAt ?? preview.activationExpiresAt)}</div>
              <button
                type="submit"
                disabled={!dashboard || withdrawing || !withdrawalAmount.trim()}
                className="mt-5 inline-flex min-h-[3.3rem] items-center justify-center rounded-[20px] bg-[#7a0000] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#650000] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {withdrawing ? "Submitting..." : "Request withdrawal"}
              </button>
            </form>

            <div className="space-y-4">
              {dashboard?.withdrawals.length ? (
                dashboard.withdrawals.map((withdrawal) => (
                  <article key={withdrawal.id} className="rounded-[28px] border border-[#ecd7cb] bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-[#7a0000]">{withdrawal.status.replace(/_/g, " ")}</div>
                        <div className="mt-2 text-2xl font-black tracking-tight text-[#210505]">{formatMoney(withdrawal.amount)}</div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div>Requested: {formatDate(withdrawal.createdAt)}</div>
                          <div>Destination: {withdrawal.phone}</div>
                          <div>Method: {withdrawal.method.replace(/_/g, " ")}</div>
                          <div>Reference: {withdrawal.reference || "Pending"}</div>
                        </div>
                      </div>
                      <div className="rounded-full border border-[#7a0000]/10 bg-[#fff8ef] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                        {withdrawal.status}
                      </div>
                    </div>
                    {withdrawal.reason ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{withdrawal.reason}</div> : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[28px] border border-dashed border-[#d9c6ba] bg-white p-10 text-center text-slate-500">
                  No withdrawal requests yet.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[34px] border border-[#ecd7cb] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-8">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Referral history</div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#210505]">Track your referrals and earnings</h2>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard?.referrals.length ? (
              dashboard.referrals.map((referral) => (
                <article key={referral.referralCode} className="rounded-[28px] border border-[#ecd7cb] bg-[#fffaf5] p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-black tracking-tight text-[#210505]">{referral.productName}</h3>
                        <span className="rounded-full border border-[#7a0000]/10 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#7a0000]">
                          {referral.status.replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full border border-[#0f9d58]/10 bg-[#eefcf4] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#0f9d58]">
                          {referral.commissionStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                        <div>Referral code: {referral.referralCode}</div>
                        <div>Customer: {referral.referredName || "Unnamed referral"}</div>
                        <div>Phone: {referral.referredPhone}</div>
                        <div>Sent: {formatDate(referral.createdAt)}</div>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-amber-300/25 bg-white px-5 py-4 text-right">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Potential commission</div>
                      <div className="mt-2 text-2xl font-black tracking-tight text-[#210505]">{formatMoney(referral.potentialCommission)}</div>
                    </div>
                  </div>
                </article>
              ))
            ) : dashboard ? (
              <div className="rounded-[28px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-10 text-center text-slate-500">
                No referrals have been created yet.
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-[#d9c6ba] bg-[#fffaf5] p-10 text-center text-slate-500">
                Verify your phone number first to reveal referral-level details.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
