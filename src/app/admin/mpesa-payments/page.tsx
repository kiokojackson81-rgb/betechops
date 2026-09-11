import { redirect } from "next/navigation";
import { requireWebsiteOrdersAdmin } from "@/lib/websiteOrders";
import MpesaPaymentsClient from "./MpesaPaymentsClient";

export const dynamic = "force-dynamic";

export default async function MpesaPaymentsPage() {
  const guard = await requireWebsiteOrdersAdmin();
  if (!guard.ok) redirect(guard.status === 401 ? "/admin/login" : "/admin");
  return <MpesaPaymentsClient />;
}
