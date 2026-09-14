// User-supplied supervisor signature uploaded on 14 September 2026.
// Source SHA-256: 68109ad6650b9f28a6d68f4d39c6ace766d983fdb34e3d4768349075b049448e
export const JONATHAN_SUPERVISOR_SIGNATURE_URL = "https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/branding/jonathan-mugiira-supervisor-signature-20260914-FBcnwHjJXUHBT2FEgyF7wjOwJilaBa.jpeg";

export function supervisorSignatureUrl(profile: { name?: string | null; signatureUrl?: string | null }) {
  if (profile.signatureUrl?.trim()) return profile.signatureUrl.trim();
  const name = (profile.name || "Jonathan Mugiira").trim().toLowerCase().replace(/\s+/g, " ");
  return name === "jonathan mugiira" ? JONATHAN_SUPERVISOR_SIGNATURE_URL : null;
}
