export function withImpersonateId(href: string, impersonateId: string | null | undefined): string {
  if (!impersonateId) return href;

  const [path, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("impersonateId", impersonateId);
  return `${path}?${params.toString()}`;
}

