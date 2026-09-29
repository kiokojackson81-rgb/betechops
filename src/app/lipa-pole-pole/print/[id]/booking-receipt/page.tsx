import { auth } from "@/lib/auth";
import AdminLppBookingReceiptPage from "@/app/admin/lipa-pole-pole/[id]/booking-receipt/page";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * A deliberately layout-free print route for staff.  It reuses the approved
 * booking receipt document but never enters the Unified Admin workspace.
 */
export default async function StaffLppBookingReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: SearchParams;
}) {
  const session = await auth();
  const user = session?.user as { id?: string | null; role?: string | null } | undefined;
  const { id } = await params;

  if (!user?.id) {
    redirect(`/attendant/login?callbackUrl=${encodeURIComponent(`/lipa-pole-pole/print/${id}/booking-receipt`)}`);
  }

  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail) redirect("/marketing/lipa-pole-pole");

  const role = String(user.role ?? "").toUpperCase();
  const canPrintAny = role === "ADMIN" || role === "SUPERVISOR";
  if (!canPrintAny && detail.account.createdById !== user.id) {
    redirect("/not-authorized");
  }

  return AdminLppBookingReceiptPage({ params: { id }, searchParams });
}
