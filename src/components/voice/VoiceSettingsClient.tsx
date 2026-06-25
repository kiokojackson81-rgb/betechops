"use client";

import Link from "next/link";
import RegistrationBadge from "@/components/voice/RegistrationBadge";
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
            <h1 className="mt-2 text-3xl font-semibold text-white">Browser softphone foundation</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Device controls, presence automation, and SIP configuration placeholders are ready. Once Africa&apos;s Talking provisions SIP accounts, only the transport client needs to be connected.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RegistrationBadge />
            <Link
              href="/admin/communications/voice"
              className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-white/20"
            >
              Back to console
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
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
              { label: "Auto register", key: "autoRegister" as const },
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

          <div className="mt-4 grid gap-2 text-xs text-slate-500">
            <div>Microphone permission: {softphone.microphonePermission}</div>
            <div>Mic input level: {softphone.microphoneLevel}%</div>
            <div>Speaker output test: {softphone.outputLevel}%</div>
          </div>
        </div>

        <div className="space-y-6">
          <section className={cardShell("p-6")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">SIP Configuration</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">Africa&apos;s Talking SIP placeholders</h2>
            <p className="mt-2 text-sm text-slate-400">
              These values are stored locally for UI readiness only. No registration attempt is made until real credentials and the SIP client are added.
            </p>

            <div className="mt-5 grid gap-4">
              <input
                value={softphone.sipConfig.username}
                onChange={(event) => softphone.updateSipConfig({ username: event.target.value })}
                placeholder="SIP Username"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={softphone.sipConfig.password}
                onChange={(event) => softphone.updateSipConfig({ password: event.target.value })}
                placeholder="Password"
                type="password"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={softphone.sipConfig.domain}
                onChange={(event) => softphone.updateSipConfig({ domain: event.target.value })}
                placeholder="Domain"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <input
                value={softphone.sipConfig.wssServer}
                onChange={(event) => softphone.updateSipConfig({ wssServer: event.target.value })}
                placeholder="WSS Server"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void softphone.register()}
                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 transition hover:border-emerald-400"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => void softphone.unregister()}
                className="rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:border-rose-400"
              >
                Disconnect
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-xs text-slate-500">
              <div>Connection status: {softphone.connectionStatus}</div>
              <div>Registration state: {softphone.stateLabel}</div>
              <div>Availability state: {softphone.availabilityLabel}</div>
            </div>
          </section>

          <section className={cardShell("p-6")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Presence automation</div>
            <h2 className="mt-2 text-2xl font-semibold text-white">State machine and heartbeat</h2>
            <div className="mt-5 grid gap-3">
              {[
                "LOGIN -> AVAILABLE",
                "INACTIVE -> AWAY",
                "INCOMING -> RINGING",
                "ANSWERED -> TALKING",
                "HOLD -> BREAK",
                "HANG UP -> AVAILABLE",
                "UNREGISTER -> OFFLINE",
              ].map((step) => (
                <div key={step} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Last heartbeat {softphone.lastHeartbeatAt ? new Date(softphone.lastHeartbeatAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "pending"}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
