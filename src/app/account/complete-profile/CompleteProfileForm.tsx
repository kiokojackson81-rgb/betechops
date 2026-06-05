"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialName: string;
  initialEmail: string;
  initialCounty: string;
  initialTown: string;
};

export default function CompleteProfileForm({
  initialName,
  initialEmail,
  initialCounty,
  initialTown,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") || "/account";
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [county, setCounty] = useState(initialCounty);
  const [town, setTown] = useState(initialTown);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/account/complete-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, county, town }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error || "Unable to save your profile.");
      setBusy(false);
      return;
    }

    router.push(next.startsWith("/") ? next : "/account");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[2rem] border border-[#7a0000]/10 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)] sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Complete your profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your phone number is already verified. Add your name and any extra details you want Betech to reuse in checkout and support.
        </p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">County</span>
          <input
            type="text"
            value={county}
            onChange={(event) => setCounty(event.target.value)}
            className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Town</span>
          <input
            type="text"
            value={town}
            onChange={(event) => setTown(event.target.value)}
            className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving profile..." : "Save and continue"}
      </button>
    </form>
  );
}
