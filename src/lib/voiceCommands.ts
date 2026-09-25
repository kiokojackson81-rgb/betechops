export type VoiceCommand = {
  code: string;
  action: "TRANSFER" | "CONFERENCE";
  target: "JACKSON" | "JONATHAN" | "JENNIFER" | "BRENDAH" | "BENJAMIN" | "KITHITO" | "STEPHEN";
};

const TARGETS = ["JACKSON", "JONATHAN", "JENNIFER", "BRENDAH", "BENJAMIN", "KITHITO", "STEPHEN"] as const;

/** Test-only command decoder. Live DTMF must remain disabled until the
 * provider identifies the staff call leg separately from the customer leg. */
export function parseVoiceStaffCommand(value: unknown): VoiceCommand | null {
  const code = String(value || "").trim();
  const match = /^([*#])([1-7])$/.exec(code);
  if (!match) return null;
  return {
    code,
    action: match[1] === "#" ? "TRANSFER" : "CONFERENCE",
    target: TARGETS[Number(match[2]) - 1],
  };
}
