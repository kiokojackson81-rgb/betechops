import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2, MessageCircle } from "lucide-react";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import TrackedWhatsAppLink from "@/app/shop/_components/TrackedWhatsAppLink";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Installation Booking Confirmation",
  description: "Your Betech Solar installation project booking has been received.",
});

export default async function ProjectBookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref = "Betech project" } = await searchParams;
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(`Hello Betech Solar, I booked installation project ${ref}. Kindly assist with payment.`)}`;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <main className="py-12 sm:py-16">
        <div className={shopStyles.shell}>
          <section className={`${shopStyles.darkPanel} p-6 sm:p-10`}>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
              <CalendarCheck2 className="h-4 w-4" /> Project booking received
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Your installation is now in the Projects workspace.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/75">Our team will verify the installation details, payment and preferred date before confirming the schedule.</p>
            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/10 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd761]">Project reference</div>
              <div className="mt-2 text-2xl font-black text-white">{ref}</div>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <TrackedWhatsAppLink href={whatsappHref} className={shopStyles.whatsappButton} label="Installation payment help" context="project_booking_success" ariaLabel="Contact Betech about installation payment">
                <MessageCircle className="h-4 w-4" /> Continue Payment on WhatsApp
              </TrackedWhatsAppLink>
              <Link href="/account" className={`${shopStyles.secondaryButton} bg-white/92`}>Open Account</Link>
              <Link href="/" className={shopStyles.goldButton}>Continue Shopping</Link>
            </div>
          </section>
        </div>
      </main>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
