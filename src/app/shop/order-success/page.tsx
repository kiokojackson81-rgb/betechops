import Link from "next/link";
import { PhoneCall } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export default async function ShopOrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const orderRef = params.ref || "BSO-MOCK-REF";

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-12 sm:py-16">
        <div className={shopStyles.shell}>
          <div className={`${shopStyles.darkPanel} p-6 sm:p-10`}>
            <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
              Mock order received
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Your order has been received. Our Betech Solar team will contact you shortly.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
              This success state is still running in safe {params.mode || "mock"} mode. Later, the same flow will hand off to pending ecommerce orders inside ops.
            </p>
            <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-lg font-black text-white">
              Mock order reference: {orderRef}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="https://wa.me/254722151083" target="_blank" rel="noreferrer" className={shopStyles.whatsappButton}>
                Talk to our solar team on WhatsApp
              </Link>
              <Link href="tel:+254722151083" className={`${shopStyles.goldButton} gap-2`}>
                <PhoneCall className="h-4 w-4" />
                Call Betech Solar
              </Link>
              <Link href="/shop" className={`${shopStyles.secondaryButton} bg-white/92`}>
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
