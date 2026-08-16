"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import {
  getTownsForCounty,
  kenyaCountyOptions,
} from "@/lib/agents/kenyaMarkets";

export type AccountProfileForm = {
  name: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  county: string;
  town: string;
  estateLandmark: string;
  locationNotes: string;
};

const inputClass =
  "min-h-[3.25rem] w-full rounded-[16px] border border-[#7a0000]/10 bg-white px-4 outline-none transition focus:border-[#7a0000]/35";

export default function AccountAddressForm({
  initialProfile,
}: {
  initialProfile: AccountProfileForm;
}) {
  const [form, setForm] = useState(initialProfile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const towns = useMemo(() => getTownsForCounty(form.county), [form.county]);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !result?.ok)
        throw new Error(
          result?.error || "Could not save your customer details.",
        );
      setMessage({
        type: "success",
        text: "Customer and delivery details saved successfully.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not save your customer details.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${shopStyles.lightCard} w-full p-5 sm:p-7`}>
      <div className={shopStyles.sectionEyebrow}>Address details</div>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
        Customer and delivery details
      </h1>
      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
        These details are reused for checkout, deliveries, quotations, and
        customer support.
      </p>

      <div className="mt-6 grid w-full gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Full name
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Phone number
          <input
            className={inputClass}
            value={form.phone}
            onChange={(event) =>
              setForm({ ...form, phone: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          WhatsApp number
          <input
            className={inputClass}
            value={form.whatsappNumber}
            onChange={(event) =>
              setForm({ ...form, whatsappNumber: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          County
          <select
            className={inputClass}
            value={form.county}
            onChange={(event) =>
              setForm({ ...form, county: event.target.value, town: "" })
            }
          >
            <option value="">Select county</option>
            {kenyaCountyOptions.map((county) => (
              <option key={county}>{county}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Town / area
          <select
            className={inputClass}
            value={form.town}
            disabled={!form.county}
            onChange={(event) => setForm({ ...form, town: event.target.value })}
          >
            <option value="">
              {form.county ? "Select town / area" : "Choose county first"}
            </option>
            {towns.map((town) => (
              <option key={town}>{town}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
          Specific locality / estate / landmark
          <input
            className={inputClass}
            value={form.estateLandmark}
            onChange={(event) =>
              setForm({ ...form, estateLandmark: event.target.value })
            }
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
          Delivery notes
          <textarea
            rows={4}
            className={`${inputClass} py-3`}
            value={form.locationNotes}
            onChange={(event) =>
              setForm({ ...form, locationNotes: event.target.value })
            }
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className={shopStyles.primaryButton}
          disabled={saving}
          onClick={saveProfile}
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save customer details"}
        </button>
        {message ? (
          <p
            className={`text-sm font-semibold ${message.type === "success" ? "text-[#0f9d58]" : "text-red-700"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}
