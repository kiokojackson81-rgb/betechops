import { redirect } from "next/navigation";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import LppAccountDetailClient from "@/app/shop/account/lipa-pole-pole/[id]/LppAccountDetailClient";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";
import { auth } from "@/lib/auth";
import { getSerializedLppAccountDetail } from "@/lib/lipaPolePoleService";

export const dynamic = "force-dynamic";

export default async function ShopLppAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string | null } | undefined;
  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/shop/account");
  }

  const { id } = await params;
  const detail = await getSerializedLppAccountDetail(id).catch(() => null);
  if (!detail || detail.account.customerId !== user.id) {
    redirect("/shop/account");
  }

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5">
        <div className={shopStyles.shell}>
          <LppAccountDetailClient initialDetail={detail} />
          <div className="mt-5">
            <ShopSupportStrip />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
