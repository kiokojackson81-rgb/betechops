"use client";

import WebsiteOrdersDeskClient from "@/components/WebsiteOrdersDeskClient";
import type { SerializedWebsiteOrder } from "@/lib/websiteOrders";

type Props = {
  initialOrders: SerializedWebsiteOrder[];
};

export default function WebsiteOrdersAdminClient({ initialOrders }: Props) {
  return (
    <WebsiteOrdersDeskClient
      initialOrders={initialOrders}
      apiBasePath="/api/admin/website-orders"
      defaultStatusFilter="PENDING"
      orderListLabel="Website orders"
      orderListTitle="Pending website orders"
      orderListDescription="Review customer website orders, confirm them safely, and continue through the receipt flow."
      filterStorageKey="admin:website-orders:status"
    />
  );
}
