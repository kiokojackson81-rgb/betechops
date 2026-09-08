import { notFound } from "next/navigation";
import CommissioningClient from "@/app/commissioning/CommissioningClient";
import { findAccessibleCommissioningSession } from "@/lib/commissioning";

export const dynamic = "force-dynamic";

export default async function CommissioningPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await findAccessibleCommissioningSession(token);
  if (!session) notFound();
  return <CommissioningClient token={token} />;
}
