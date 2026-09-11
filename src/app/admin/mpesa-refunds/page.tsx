import { redirect } from "next/navigation";
import { requireMpesaRefundAdmin } from "@/lib/mpesaRefunds";
import RefundsClient from "./RefundsClient";

export const dynamic = "force-dynamic";

export default async function MpesaRefundsPage({ searchParams }: { searchParams: Promise<{ paymentId?: string }> }) {
  const guard = await requireMpesaRefundAdmin();
  if (!guard.ok) redirect(guard.status === 401 ? "/admin/login" : "/admin");
  return <RefundsClient paymentId={(await searchParams).paymentId || ""} />;
}
