"use client";

import Link from "next/link";
import { useSoftphone } from "@/components/voice/SoftphoneProvider";

function cardShell(extra = "") {
  return `rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(4,8,20,0.98))] ${extra}`.trim();
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{label}</span>
        <span className="text-xs text-slate-400">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-cyan-400"
      />
    </label>
  );
}

export default function VoiceSettingsClient() {
  const softphone = useSoftphone();

  return (
    <div className="space-y-6">
      <section className={cardShell("p-6")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">Voice Settings</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Operator audio controls</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Keep this page focused on the browser controls Brendah and Jennifer actually use during calls.
            </p>
          </div>
          <Link
            href="/admin/communications/voice"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20"
          >
            Back to console
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.88fr]">
        <div className={cardShell("p-6")}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Devices</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Microphone, speaker, and browser audio</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-sm text-slate-200">Microphone</div>
              <select
                value={softphone.preferences.microphoneId}
                onChange={(event) => softphone.updatePreferences({ microphoneId: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none"
              >
                <option value="">Default microphone</option>
                {softphone.devices.microphones.map((device) => (
                  <option key={device.id} value={device.id}>{device.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-sm text-slate-200">Speaker</div>
              <select
                value={softphone.preferences.speakerId}
                onChange={(event) => softphone.updatePreferences({ speakerId: event.target.value })}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none"
              >
                <option value="">Default speaker</option>
                {softphone.devices.speakers.map((device) => (
                  <option key={device.id} value={device.id}>{device.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <SliderField label="Ring volume" value={softphone.preferences.ringVolume} onChange={(value) => softphone.updatePreferences({ ringVolume: value })} />
            <SliderField label="Output volume" value={softphone.preferences.outputVolume} onChange={(value) => softphone.updatePreferences({ outputVolume: value })} />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              { label: "Auto answer", key: "autoAnswer" as const },
              { label: "Noise suppression", key: "noiseSuppression" as const },
              { label: "Echo cancellation", key: "echoCancellation" as const },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm text-slate-100">{item.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(softphone.preferences[item.key])}
                  onChange={(event) => softphone.updatePreferences({ [item.key]: event.target.checked } as never)}
                  className="h-4 w-4 accent-cyan-400"
                />
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void softphone.requestMicrophoneAccess()}
              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-400"
            >
              Request microphone
            </button>
            <button
              type="button"
              onClick={() => void softphone.runMicrophoneTest()}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20"
            >
              Microphone test
            </button>
            <button
              type="button"
              onClick={() => void softphone.runSpeakerTest()}
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20"
            >
              Speaker test
            </button>
          </div>
        </div>

        <section className={cardShell("p-6")}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Device Status</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">What the browser sees right now</h2>

          <div className="mt-5 space-y-3">
            {[
              ["Microphone permission", softphone.microphonePermission],
              ["Mic input level", `${softphone.microphoneLevel}%`],
              ["Speaker test level", `${softphone.outputLevel}%`],
              ["Availability", softphone.availabilityLabel],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="text-sm text-slate-300">{label}</div>
                <div className="text-sm font-semibold text-white">{String(value)}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-500/15 bg-cyan-500/5 px-4 py-4 text-sm text-slate-300">
            This page no longer shows local SIP placeholders, registration buttons, or heartbeat debug text. It is intentionally limited to daily operator controls.
          </div>
        </section>
      </section>
    </div>
  );
}
