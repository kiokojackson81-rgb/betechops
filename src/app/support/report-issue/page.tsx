import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, LockKeyhole, MessageSquareWarning } from "lucide-react";
import ReportIssueForm from "./ReportIssueForm";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";
import { auth } from "@/lib/auth";
import { findSafeCustomerProfileByUserId } from "@/lib/customerProfile";
import { buildCustomerAccountIdentity, listCustomerAccountOrders } from "@/lib/shopCustomerOrders";

export const metadata: Metadata = { title: "Report an Issue or Complaint | Betech Solar", description: "Submit and track a product, installation, delivery, payment, warranty, or customer service issue securely." };
export const dynamic = "force-dynamic";

export default async function ReportIssuePage() {
  const session = await auth();
  const user = session?.user as { id?: string | null; phone?: string | null; email?: string | null } | undefined;
  let orders: Awaited<ReturnType<typeof listCustomerAccountOrders>> = [];
  if (user?.id) {
    const profile = await findSafeCustomerProfileByUserId(user.id);
    const identity = buildCustomerAccountIdentity({ id: user.id, phone: user.phone, email: user.email }, profile);
    orders = await listCustomerAccountOrders({ ...identity, take: 50 });
  }
  return <div className={shopStyles.page}><ShopHeader navLinks={shopNavLinks} /><main className="py-8 sm:py-12"><div className={shopStyles.shell}>
    <section className="overflow-hidden rounded-[30px] border border-[#7a0000]/10 bg-white shadow-[0_28px_70px_rgba(15,23,42,.08)]">
      <div className="grid gap-6 bg-[radial-gradient(circle_at_90%_0%,rgba(242,178,15,.22),transparent_35%),linear-gradient(135deg,#2d0600,#7a0000)] p-6 text-white sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><div className="text-xs font-black uppercase tracking-[.28em] text-[#ffd761]">Betech customer care</div><h1 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">Report an issue. Keep every update in one secure case.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">Link the affected purchase, add clear evidence, and follow technical, warranty, delivery, or payment handling from your account.</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4"><ClipboardList className="h-8 w-8 text-[#ffd761]" /><div><div className="text-xs uppercase tracking-widest text-white/60">Case tracking</div><div className="font-black">Reference and timeline included</div></div></div>
      </div>
      <div className="p-5 sm:p-8">
        {user?.id ? <ReportIssueForm orders={orders.map((order) => ({ routeId: order.routeId, orderRef: order.orderRef, source: order.source, createdAt: order.createdAt, itemPreview: order.itemPreview.map((item) => ({ productName: item.productName })) }))} /> : <div className="mx-auto max-w-2xl py-12 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#fff3d8] text-[#7a0000]"><LockKeyhole className="h-8 w-8" /></span><h2 className="mt-5 text-2xl font-black sm:text-3xl">Sign in before reporting an issue</h2><p className="mx-auto mt-3 max-w-xl text-slate-600">Authentication protects your records and lets us securely link your complaint to your receipts, orders, messages, and case updates.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/login/phone?callbackUrl=%2Fsupport%2Freport-issue" className={shopStyles.primaryButton}>Sign in with OTP</Link><Link href="/login/phone?callbackUrl=%2Fsupport%2Freport-issue" className={shopStyles.secondaryButton}>Create customer account</Link></div><div className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500"><MessageSquareWarning className="h-4 w-4" />For urgent safety concerns, switch off equipment where safe and contact support.</div></div>}
      </div>
    </section>
  </div></main><ShopFooter /><FloatingWhatsApp /></div>;
}
