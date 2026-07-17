"use client";

import WebsiteOrdersDeskClient from "@/components/WebsiteOrdersDeskClient";
import type { SerializedWebsiteOrder } from "@/lib/websiteOrders";

type Props = {
  initialOrders: SerializedWebsiteOrder[];
  initialExpandedId?: string | null;
};

export default function WebsiteOrdersAdminClient({ initialOrders, initialExpandedId }: Props) {
  return (
    <WebsiteOrdersDeskClient
      initialOrders={initialOrders}
      initialExpandedId={initialExpandedId}
      apiBasePath="/api/admin/website-orders"
      defaultStatusFilter="ALL"
      orderListLabel="Website orders"
      orderListTitle="Website orders"
      orderListDescription="Review customer website orders across all statuses, confirm them safely, and continue through the receipt flow."
      filterStorageKey="admin:website-orders:status:v2"
    />
  );
}
