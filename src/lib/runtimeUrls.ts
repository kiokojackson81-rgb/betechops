const DEFAULT_OPS_BASE_URL = "https://ops.betech.co.ke";
const DEFAULT_AGENTS_BASE_URL = "https://agents.betech.co.ke";
const DEFAULT_SHOP_BASE_URL = "https://www.betech.co.ke";

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getOpsBaseUrl() {
  return (
    normalizeOrigin(process.env.OPS_BASE_URL) ??
    normalizeOrigin(process.env.NEXTAUTH_URL) ??
    DEFAULT_OPS_BASE_URL
  );
}

export function getAgentsBaseUrl() {
  return (
    normalizeOrigin(process.env.AGENTS_BASE_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    DEFAULT_AGENTS_BASE_URL
  );
}

export function getShopBaseUrl() {
  return (
    normalizeOrigin(process.env.SHOP_BASE_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_SHOP_URL) ??
    DEFAULT_SHOP_BASE_URL
  );
}

export function getAllowedAuthOrigins() {
  return Array.from(new Set([getOpsBaseUrl(), getAgentsBaseUrl(), getShopBaseUrl()].filter(Boolean)));
}

export function isAgentsHost(host: string | null | undefined) {
  if (!host) return false;
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  const agentsHost = new URL(getAgentsBaseUrl()).host.toLowerCase();
  return normalizedHost === agentsHost;
}

export function isOpsHost(host: string | null | undefined) {
  if (!host) return false;
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  const opsHost = new URL(getOpsBaseUrl()).host.toLowerCase();
  return normalizedHost === opsHost;
}

export function isShopHost(host: string | null | undefined) {
  if (!host) return false;
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  const shopHost = new URL(getShopBaseUrl()).host.toLowerCase();
  return normalizedHost === shopHost;
}

export function isAllowedAuthOrigin(origin: string) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  return getAllowedAuthOrigins().includes(normalized);
}
