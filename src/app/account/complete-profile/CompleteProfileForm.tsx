"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getTownsForCounty, kenyaCountyOptions } from "@/lib/agents/kenyaMarkets";

type Props = {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialWhatsappNumber: string;
  initialCounty: string;
  initialTown: string;
  initialEstateLandmark: string;
  initialLocationNotes: string;
};

export default function CompleteProfileForm({
  initialName,
  initialEmail,
  initialPhone,
  initialWhatsappNumber,
  initialCounty,
  initialTown,
  initialEstateLandmark,
  initialLocationNotes,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") || "/account";
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [whatsappNumber, setWhatsappNumber] = useState(initialWhatsappNumber);
  const [county, setCounty] = useState(initialCounty);
  const [town, setTown] = useState(initialTown);
  const [estateLandmark, setEstateLandmark] = useState(initialEstateLandmark);
  const [locationNotes, setLocationNotes] = useState(initialLocationNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const townOptions = useMemo(() => getTownsForCounty(county), [county]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const response = await fetch("/api/account/complete-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, phone, whatsappNumber, county, town, estateLandmark, locationNotes }),
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

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Phone number</span>
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0712345678 or 0101234567"
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">WhatsApp number</span>
        <input
          type="tel"
          value={whatsappNumber}
          onChange={(event) => setWhatsappNumber(event.target.value)}
          placeholder="0712345678 or 0101234567"
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">County</span>
          <select
            value={county}
            onChange={(event) => {
              const nextCounty = event.target.value;
              const nextTowns = getTownsForCounty(nextCounty);
              setCounty(nextCounty);
              setTown((current) => (nextTowns.some((townOption) => townOption === current) ? current : ""));
            }}
            className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
          >
            <option value="">Select county</option>
            {kenyaCountyOptions.map((countyOption) => (
              <option key={countyOption} value={countyOption}>
                {countyOption}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">Town / city</span>
          <select
            value={town}
            onChange={(event) => setTown(event.target.value)}
            disabled={!county}
            className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
          >
            <option value="">{county ? "Select town / city" : "Choose county first"}</option>
            {townOptions.map((townOption) => (
              <option key={townOption} value={townOption}>
                {townOption}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Specific locality / estate / landmark</span>
        <input
          type="text"
          value={estateLandmark}
          onChange={(event) => setEstateLandmark(event.target.value)}
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-slate-700">Delivery notes</span>
        <textarea
          rows={3}
          value={locationNotes}
          onChange={(event) => setLocationNotes(event.target.value)}
          className="w-full rounded-2xl border border-[#ead8c4] bg-[#fffdf9] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#7a0000]/35 focus:ring-2 focus:ring-[#f2b20f]/30"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving profile..." : "Submit and login"}
      </button>
    </form>
  );
}
