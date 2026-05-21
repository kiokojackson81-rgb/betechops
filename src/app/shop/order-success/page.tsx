import Link from "next/link";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export default async function ShopOrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
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
              Order received
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white">Your Betech Solar order request has been saved.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/76">
              This is still a safe mock success state for now. Later, the same flow will create a pending ecommerce order inside ops.
            </p>
            <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-lg font-black text-white">
              Reference: {orderRef}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="https://wa.me/254722151083" target="_blank" rel="noreferrer" className={shopStyles.whatsappButton}>
                Talk to our solar team on WhatsApp
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
