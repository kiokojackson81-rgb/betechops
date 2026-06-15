import type { Metadata } from "next";
import Link from "next/link";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import AccountClient from "@/app/shop/_components/AccountClient";
import ShopAccountLogoutButton from "@/app/shop/_components/ShopAccountLogoutButton";
import ShopBreadcrumbs from "@/app/shop/_components/ShopBreadcrumbs";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopSupportStrip from "@/app/shop/_components/ShopSupportStrip";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { shopNavLinks } from "@/app/shop/shopData";
import { SHOP_HOME_HREF } from "@/app/shop/storefrontPaths";
import { auth } from "@/lib/auth";

export const metadata: Metadata = buildShopMetadata({
  title: "Customer Account",
  description: "Save your Betech Solar customer profile, reuse it in checkout, and review recent orders and quote requests on this device.",
});

export default async function ShopAccountPage() {
  const session = await auth();
  const user = session?.user as { name?: string | null; phone?: string | null; email?: string | null } | undefined;

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-5 sm:py-6">
        <div className={shopStyles.shell}>
          <ShopBreadcrumbs items={[{ label: "Shop", href: SHOP_HOME_HREF }, { label: "Account" }]} />
          <div className="mt-3">
            <div className={shopStyles.sectionEyebrow}>Account</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">Betech Solar customer account</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Save your customer profile on this device, reuse it during checkout, and review recent orders and quote requests.
            </p>
          </div>
          {user?.phone ? (
            <div className="mt-4 rounded-[1.8rem] border border-[#f2b20f]/20 bg-[linear-gradient(180deg,#fff7e7_0%,#fffdf9_100%)] px-5 py-4 text-sm text-slate-700 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-[#7a0000]">Verified account</div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {user.name || "Betech customer"} · {user.phone}
              </div>
              <div className="mt-1 text-sm text-slate-600">{user.email || "No email saved yet."}</div>
              <div className="mt-4">
                <ShopAccountLogoutButton />
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[1.8rem] border border-[#7a0000]/10 bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
              <div className="text-base font-black text-slate-950">Sign in with your email or verified phone number</div>
              <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Start with the email address or mobile number on your account. We will detect it first, then finish sign in with one secure SMS OTP flow.
              </div>
              <Link
                href="/login/phone?callbackUrl=/account"
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#7a0000_0%,#991010_100%)] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_36px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5"
              >
                Sign in to your account
              </Link>
            </div>
          )}
          <div className="mt-4">
            <AccountClient />
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
