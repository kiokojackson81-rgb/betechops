import type { ReactNode } from "react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import CustomerAccountSidebar from "@/app/shop/_components/CustomerAccountSidebar";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";

export default async function AccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { profileCompletion } = await getCustomerAccountContext();

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-4 sm:py-5">
        <div className={shopStyles.shell}>
          <div className="grid w-full min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <CustomerAccountSidebar profileCompletion={profileCompletion} />
            <main className="w-full min-w-0 max-w-none">{children}</main>
          </div>
          <div className="mt-4">
            <ShopSupportStrip />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
