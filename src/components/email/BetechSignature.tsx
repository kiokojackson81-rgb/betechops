const DEFAULT_SIGNATURE_PATH = "/email-signature-betech.png";
const DEFAULT_SITE_URL = "https://www.betech.co.ke";

function normalizeBaseUrl(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/\/+$/, "");
}

export function getBetechSignatureUrl() {
  const explicitUrl = String(process.env.NEXT_PUBLIC_EMAIL_SIGNATURE_URL || "").trim();
  if (explicitUrl) return explicitUrl;

  const siteUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_SITE_URL);
  return `${siteUrl}${DEFAULT_SIGNATURE_PATH}`;
}

export const BETECH_SIGNATURE_TEXT_FALLBACK = [
  "Betech Solar Solutions",
  "Solar Panels | Batteries | Inverters | Water Pumps | Solar Installations",
  "",
  "Email: info@betech.co.ke",
  "Website: www.betech.co.ke",
  "",
  "Phone:",
  "+254 722 151 083",
  "+254 703 241 917",
  "",
  "Location:",
  "Pramukh Plaza, Third Floor, Shop No. 3",
  "Junction of Munyu Road & Sheikh Karume Road",
  "Nairobi CBD, Kenya",
  "",
  "Business Hours:",
  "Monday - Friday: 9:00 AM - 6:00 PM",
  "Saturday: 9:00 AM - 3:00 PM",
  "Sunday/Public Holidays: Closed",
].join("\n");

export function renderBetechSignatureHtml() {
  return `
    <div style="margin-top:24px">
      <img
        src="${getBetechSignatureUrl()}"
        alt="Betech Solar Solutions"
        style="display:block;width:100%;max-width:850px;height:auto;border:0"
      />
    </div>
  `;
}

export default function BetechSignature() {
  return (
    <div style={{ marginTop: "24px" }}>
      <img
        src={getBetechSignatureUrl()}
        alt="Betech Solar Solutions"
        style={{
          width: "100%",
          maxWidth: "850px",
          height: "auto",
          display: "block",
          border: 0,
        }}
      />
    </div>
  );
}
