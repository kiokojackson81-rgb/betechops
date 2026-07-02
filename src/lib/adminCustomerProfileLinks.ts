import { normalizePhone } from "@/lib/phone";

export type AdminCustomerProfileLinkInput = {
  customerUserId?: string | null;
  phone?: string | null;
  phones?: Array<string | null | undefined>;
  email?: string | null;
  emails?: Array<string | null | undefined>;
  displayName?: string | null;
  impersonateId?: string | null;
};

type LookupIdentity = {
  kind: "user" | "phone" | "email" | "name";
  value: string;
};

function normalizeEmail(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function resolveLookupIdentity(input: AdminCustomerProfileLinkInput): LookupIdentity {
  const userId = String(input.customerUserId || "").trim();
  if (userId) return { kind: "user", value: userId };

  const phone = normalizePhone(input.phone || input.phones?.find(Boolean) || "");
  if (phone) return { kind: "phone", value: phone };

  const email = normalizeEmail(input.email || input.emails?.find(Boolean) || "");
  if (email) return { kind: "email", value: email };

  return {
    kind: "name",
    value: normalizeName(input.displayName) || "customer",
  };
}

export function buildAdminCustomerProfileHref(input: AdminCustomerProfileLinkInput) {
  const lookup = resolveLookupIdentity(input);
  const encodedLookup = encodeURIComponent(`${lookup.kind}~${lookup.value}`);
  const params = new URLSearchParams();

  const phones = uniqueStrings([input.phone, ...(input.phones || [])].map((value) => normalizePhone(value || ""))).filter(Boolean);
  const emails = uniqueStrings([input.email, ...(input.emails || [])].map((value) => normalizeEmail(value || ""))).filter(Boolean);
  const displayName = String(input.displayName || "").trim();
  const userId = String(input.customerUserId || "").trim();
  const impersonateId = String(input.impersonateId || "").trim();

  if (userId) params.set("userId", userId);
  if (phones.length) params.set("phones", phones.join(","));
  if (emails.length) params.set("emails", emails.join(","));
  if (displayName) params.set("name", displayName);
  if (impersonateId) params.set("impersonateId", impersonateId);

  return `/admin/customers/profile/${encodedLookup}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function parseAdminCustomerProfileLookup(rawLookup: string) {
  const decoded = decodeURIComponent(String(rawLookup || "").trim());
  const [kind, ...rest] = decoded.split("~");
  const value = rest.join("~").trim();

  if (kind === "user" || kind === "phone" || kind === "email" || kind === "name") {
    return { kind, value } as LookupIdentity;
  }

  return { kind: "name", value: decoded || "customer" } as LookupIdentity;
}
