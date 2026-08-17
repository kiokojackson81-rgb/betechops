import "server-only";

import { headers } from "next/headers";
import { absUrl, withParams } from "@/lib/abs-url";
import type { LppDetail, LppListItem } from "./LipaPolePoleAdminClient";

export type LipaPolePoleSearchParams = {
  q?: string;
  status?: string;
  id?: string;
};

async function fetchJson<T>(path: string) {
  const incomingHeaders = await headers();
  const cookieHeader = incomingHeaders.get("cookie") ?? undefined;
  const response = await fetch(await absUrl(path), {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
  return (await response.json()) as T;
}

export async function loadLipaPolePoleAdminWorkspace(params: LipaPolePoleSearchParams) {
  const q = (params.q || "").trim();
  const status = (params.status || "ALL").trim().toUpperCase();
  const selectedId = (params.id || "").trim();

  const listPayload = await fetchJson<{ items?: LppListItem[] }>(
    withParams("/api/lipa-pole-pole", {
      q: q || undefined,
      status: status !== "ALL" ? status : undefined,
      limit: 100,
    }),
  );
  const items = Array.isArray(listPayload.items) ? listPayload.items : [];

  const activeId = selectedId || items[0]?.id || "";
  const detailPayload = activeId
    ? await fetchJson<({ ok: true } & LppDetail) | { error?: string }>(
        `/api/lipa-pole-pole/${activeId}`,
      )
    : null;
  const detail = detailPayload && "account" in detailPayload ? detailPayload : null;

  return {
    initialItems: items,
    initialDetail: detail,
    initialQ: q,
    initialStatus: status,
  };
}
