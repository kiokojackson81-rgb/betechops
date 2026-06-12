import { agentPath } from "@/lib/agents/host";

export function getAgentProductsHref(useRootPaths = false) {
  return agentPath("/products", useRootPaths);
}

export function getAgentCategoryHref(slug: string, useRootPaths = false) {
  return `${getAgentProductsHref(useRootPaths)}?category=${encodeURIComponent(slug)}`;
}

export function getAgentProductHref(slug: string, useRootPaths = false, opsProductId?: string | null) {
  const href = agentPath(`/products/${slug}`, useRootPaths);
  const normalizedOpsProductId = String(opsProductId || "").trim();
  if (!normalizedOpsProductId) return href;
  return `${href}?opsProductId=${encodeURIComponent(normalizedOpsProductId)}`;
}
