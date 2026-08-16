import { redirect } from "next/navigation";
import AdminLppBookingReceiptPage from "@/app/admin/lipa-pole-pole/[id]/booking-receipt/page";
import { auth } from "@/lib/auth";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ShopLppBookingReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: SearchParams;
}) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  const { id } = await params;

  if (!user?.id) {
    redirect(`/login/phone?callbackUrl=${encodeURIComponent(`/shop/account/lipa-pole-pole/${id}/booking-receipt`)}`);
  }

  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail || detail.account.customerId !== user.id) {
    redirect("/shop/account");
  }

  return AdminLppBookingReceiptPage({ params: { id }, searchParams });
}
