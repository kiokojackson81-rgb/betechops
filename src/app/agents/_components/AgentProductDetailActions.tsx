import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import type { ShopProduct } from "@/app/shop/shopData";

type AgentProductDetailActionsProps = {
  product: ShopProduct;
  loginHref: string;
  registerHref: string;
};

export default function AgentProductDetailActions({
  product,
  loginHref,
  registerHref,
}: AgentProductDetailActionsProps) {
  const whatsappHref = `https://wa.me/254722151083?text=${encodeURIComponent(
    `Hello Betech Solar, I want agent support for ${product.name} at ${formatCurrency(product.price)}.`,
  )}`;

  return (
    <div className="grid gap-3">
      <Link
        href={loginHref}
        className="inline-flex min-h-[3.55rem] items-center justify-center gap-2 rounded-[20px] bg-[#7a0000] px-5 py-3 text-sm font-bold text-white shadow-[0_20px_36px_rgba(122,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#660000] hover:shadow-[0_24px_42px_rgba(122,0,0,0.24)]"
      >
        Open agent dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[3.35rem] items-center justify-center gap-2 rounded-[20px] bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_34px_rgba(15,157,88,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(15,157,88,0.28)]"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp support
        </a>
        <Link
          href={registerHref}
          className={shopStyles.secondaryButton}
        >
          Become an agent
        </Link>
      </div>
    </div>
  );
}
