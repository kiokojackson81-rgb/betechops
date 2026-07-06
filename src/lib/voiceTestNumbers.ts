import { getKenyanPhoneVariants, normalizeKenyanPhone } from "@/lib/phone";

const DEFAULT_ADMIN_TEST_NUMBER = "0705663175";

export function getVoiceAdminTestNumber() {
  return (
    normalizeKenyanPhone(String(process.env.BETECH_VOICE_ADMIN_NUMBER || "").trim()) ||
    normalizeKenyanPhone(String(process.env.ADMIN_PHONE || "").trim()) ||
    normalizeKenyanPhone(DEFAULT_ADMIN_TEST_NUMBER)
  );
}

export function getVoiceAdminTestNumberVariants() {
  const normalized = getVoiceAdminTestNumber();
  return normalized ? getKenyanPhoneVariants(normalized) : [];
}

export function isVoiceAdminTestPhone(phone: string | null | undefined) {
  const normalized = normalizeKenyanPhone(String(phone || "").trim());
  if (!normalized) return false;
  return getVoiceAdminTestNumberVariants().includes(normalized);
}

export function getVoiceTestNumberLabel(phone: string | null | undefined) {
  return isVoiceAdminTestPhone(phone) ? "Test number" : null;
}
