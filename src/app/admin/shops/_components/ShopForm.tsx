"use client";

import React, { useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";
import { useShopsActionsSafe } from './ShopsActionsContext';

type Props = {
  defaultPlatform?: "JUMIA" | "KILIMALL";
};

type JsonState =
  | { valid: true; value: unknown }
  | { valid: false; error: string; line?: number; col?: number };

function parseJsonWithPosition(input: string): JsonState {
  const text = input.trim();
  if (!text) return { valid: true, value: {} };
  try {
    return { valid: true, value: JSON.parse(text) };
  } catch (e: unknown) {
    // Try to extract line/column from error message if present
    const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message?: unknown }).message ?? 'Invalid JSON') : String(e ?? 'Invalid JSON');
    // V8 doesn’t give line/col by default; still show raw error
    return { valid: false, error: msg };
  }
}

export default function ShopForm({ defaultPlatform = "JUMIA" }: Props) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<"JUMIA" | "KILIMALL">(defaultPlatform);
  const [credentials, setCredentials] = useState(`{
  "platform": "JUMIA",
  "apiBase": "https://vendor-api.jumia.com",
  "base_url": "https://vendor-api.jumia.com",
  "tokenUrl": "https://vendor-api.jumia.com/token",
  "clientId": "d3f5a649-bbcb-4b11-948d-64b1bb036020",
  "refreshToken": "5JKyMUN0hImO8KP70qTCXRp_xmBWekJussuyK7w2T5I",
  "authType": "SELF_AUTHORIZATION",
  "shopLabel": "JM Collection"
}`);

  const parsed = useMemo(() => parseJsonWithPosition(credentials), [credentials]);
  const actions = useShopsActionsSafe();

  async function probeJson() {
    try {
      const r = await fetch("/api/admin/probe-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send raw JSON text as a string literal for probe
        body: credentials.trim() || "{}",
      });
      const j = await r.json();
      if (j.ok) showToast("JSON probe: valid", "success");
      else showToast(`JSON probe: ${j.error || "invalid"}`, "error");
    } catch {
      showToast("Probe failed", "error");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Name is required", "warn");
      return;
    }
    if (!parsed.valid) {
      showToast(`Fix JSON: ${parsed.error}`, "error");
      return;
    }
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          platform,
          credentials: parsed.value ?? {},
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      showToast("Shop created", "success");
      setName("");
      // keep credentials so user can reuse template for next shop
      // Notify parent via context
      type ShopSummary = { id: string; name: string; platform?: string };
      const created = (j && typeof j === 'object' && 'shop' in (j as object))
        ? (j as unknown as { shop?: ShopSummary }).shop
        : (j as unknown as ShopSummary);
      if (created) actions.onShopCreated(created);
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message?: unknown }).message ?? 'Create failed') : String(err ?? 'Create failed');
      showToast(msg, "error");
    }
  }

  const badge =
    parsed.valid ? (
      <span className="ml-2 rounded-full bg-emerald-500/15 text-emerald-300 text-xs px-2 py-0.5 border border-emerald-500/30">
        JSON: Valid
      </span>
    ) : (
      <span className="ml-2 rounded-full bg-red-500/15 text-red-300 text-xs px-2 py-0.5 border border-red-500/30">
        JSON: Invalid
      </span>
    );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-white/15 bg-white/5 rounded px-2 py-1 w-full"
          placeholder="e.g., JM Collection"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Platform</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as "JUMIA" | "KILIMALL")}
          className="border border-white/15 bg-white/5 rounded px-2 py-1"
        >
          <option value="JUMIA">JUMIA</option>
          <option value="KILIMALL">KILIMALL</option>
        </select>
      </div>

      <div>
        <div className="flex items-center">
          <label className="block text-sm font-medium">Credentials (JSON)</label>
          {badge}
          <button
            type="button"
            onClick={probeJson}
            className="ml-auto text-xs px-2 py-1 rounded border border-white/15 bg-white/5 hover:bg-white/10"
            title="Send the JSON to /api/admin/probe-json for a quick validity check"
          >
            Probe JSON
          </button>
        </div>
        <textarea
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          className="mt-1 border border-white/15 bg-white/5 rounded px-2 py-1 w-full min-h-[220px] font-mono text-sm"
        />
        {!parsed.valid && (
          <div className="mt-1 text-xs text-red-300">
            {parsed.error}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!parsed.valid}
        className="px-3 py-2 rounded-xl bg-blue-600 disabled:bg-blue-600/40 text-white"
      >
        Create Shop
      </button>

      <div className="text-xs text-slate-400">
        Tip: The JSON should include <code>platform</code>, <code>apiBase</code>, <code>tokenUrl</code>, <code>clientId</code>, <code>refreshToken</code>, and <code>authType</code>.
      </div>
    </form>
  );
}
