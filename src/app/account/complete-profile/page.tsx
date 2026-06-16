import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CompleteProfileForm from "@/app/account/complete-profile/CompleteProfileForm";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { shopNavLinks } from "@/app/shop/shopData";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage() {
  const session = await auth();
  const user = session?.user as
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
      }
    | undefined;

  if (!user?.id) {
    redirect("/login/phone?callbackUrl=/account/complete-profile");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      whatsappNumber: true,
      county: true,
      town: true,
      estateLandmark: true,
      locationNotes: true,
    },
  });

  if (dbUser?.name && dbUser?.email) {
    redirect("/account");
  }

  return (
    <div className={shopStyles.page}>
      <ShopHeader navLinks={shopNavLinks} />
      <section className="py-6 sm:py-8">
        <div className={shopStyles.shell}>
          <div className="mx-auto max-w-2xl">
            <div className="mb-5 rounded-[1.8rem] border border-[#f2b20f]/20 bg-[linear-gradient(180deg,#fff7e7_0%,#fffdf9_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-[#7a0000]">Phone verified</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">Finish setting up your Betech account</div>
              <div className="mt-3 text-sm leading-6 text-slate-600">
                We already verified your phone number with OTP. Add your profile details once so your orders, referrals, and account history stay under one identity.
              </div>
            </div>
            <CompleteProfileForm
              initialName={dbUser?.name || ""}
              initialEmail={dbUser?.email || ""}
              initialPhone={dbUser?.phone || ""}
              initialWhatsappNumber={dbUser?.whatsappNumber || ""}
              initialCounty={dbUser?.county || ""}
              initialTown={dbUser?.town || ""}
              initialEstateLandmark={dbUser?.estateLandmark || ""}
              initialLocationNotes={dbUser?.locationNotes || ""}
            />
          </div>
        </div>
      </section>
      <ShopFooter />
      <FloatingWhatsApp />
    </div>
  );
}
