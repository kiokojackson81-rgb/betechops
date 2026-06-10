import { agentPath } from "@/lib/agents/host";

export function getAgentProductsHref(useRootPaths = false) {
  return agentPath("/products", useRootPaths);
}

export function getAgentCategoryHref(slug: string, useRootPaths = false) {
  return `${getAgentProductsHref(useRootPaths)}?category=${encodeURIComponent(slug)}`;
}

export function getAgentProductHref(slug: string, useRootPaths = false) {
  return agentPath(`/products/${slug}`, useRootPaths);
}
