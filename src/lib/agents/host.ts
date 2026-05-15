import { getAgentsBaseUrl } from "@/lib/runtimeUrls";

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isAgentsHost(host: string | null | undefined) {
  if (!host) return false;
  const normalizedHost = host.trim().toLowerCase();
  if (!normalizedHost) return false;
  const agentsHost = new URL(getAgentsBaseUrl()).host.toLowerCase();
  return normalizedHost === agentsHost;
}

export function agentPath(path: string, useRootPaths = false) {
  const normalizedPath = normalizePath(path);
  if (useRootPaths) return normalizedPath;
  return normalizedPath === "/" ? "/agents" : `/agents${normalizedPath}`;
}

export function isAgentRoutePath(path: string | null | undefined) {
  const normalizedPath = normalizePath(path ?? "/");
  return (
    normalizedPath === "/" ||
    normalizedPath === "/login" ||
    normalizedPath === "/register" ||
    normalizedPath === "/dashboard" ||
    normalizedPath === "/profile" ||
    normalizedPath === "/profile/payment-method" ||
    normalizedPath === "/sales" ||
    normalizedPath === "/sales/new" ||
    normalizedPath.startsWith("/sales/") ||
    normalizedPath === "/agents" ||
    normalizedPath.startsWith("/agents/") ||
    normalizedPath.startsWith("/profile/")
  );
}
