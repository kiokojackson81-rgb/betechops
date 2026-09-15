// User-supplied company stamp uploaded on 15 September 2026.
// Source SHA-256: 2448219a7815e8ff5bc29d2e8d106e892ddb630b9a72fa8e7c604903321cb1d5
export const DEFAULT_COMPANY_STAMP_URL = "https://1jtqralhx6g8fulf.public.blob.vercel-storage.com/branding/betech-company-stamp-20260915-1IdiALFa47JEj5ZNF6hjACG5cPzBhY.jpeg";

export function companyStampSettings(saved?: { digitalStampUrl?: string | null; digitalStampEnabled?: boolean | null } | null) {
  // Empty string records an explicit removal; null means no stamp was configured.
  if (saved?.digitalStampUrl === "") return { digitalStampUrl: null, digitalStampEnabled: false };
  const configured = saved?.digitalStampUrl?.trim();
  return {
    digitalStampUrl: configured || DEFAULT_COMPANY_STAMP_URL,
    digitalStampEnabled: configured ? Boolean(saved?.digitalStampEnabled) : true,
  };
}
