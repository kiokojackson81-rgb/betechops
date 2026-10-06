import { headers } from "next/headers";
import PodDeliveryCentreClient from "./PodDeliveryCentreClient";
import { absUrl, withParams } from "@/lib/abs-url";

export const dynamic = "force-dynamic";

export default async function PodDeliveryCentrePage() {
  const cookie = (await headers()).get("cookie") ?? undefined;
  const response = await fetch(
    withParams(await absUrl("/api/receipts"), {
      includeItems: true,
      scope: "global",
      onlyPos: "1",
      customerType: "pod",
    }),
    { cache: "no-store", headers: cookie ? { cookie } : undefined },
  );
  const payload = await response.json().catch(() => ({ receipts: [] }));
  return <PodDeliveryCentreClient initialRows={payload.receipts || []} />;
}
