import Link from "next/link";
import { footerGroups } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ShopFooter() {
  return (
    <footer id="support" className="pt-8">
      <div className={shopStyles.shell}>
        <div className="overflow-hidden rounded-[30px] border border-[#7a0000]/10 bg-[linear-gradient(135deg,#2d0600_0%,#5f0000_35%,#140601_100%)] p-5 text-white shadow-[0_22px_50px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div className="max-w-sm">
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffd761]">Betech Solar Online Store</div>
              <h2 className="mt-3 text-2xl font-black tracking-tight">Shop genuine solar products or request a solar system quote.</h2>
              <p className="mt-3 text-sm leading-6 text-white/76">
                Orders, delivery coordination, and product guidance are confirmed directly by Betech Solar Solutions.
              </p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <div className="text-sm font-black uppercase tracking-[0.18em] text-[#ffd761]">{group.title}</div>
                <div className="mt-3 grid gap-2.5">
                  {group.links.map((link) => {
                    const external = link.href.startsWith("http");
                    return (
                      <Link
                        key={link.label}
                        href={link.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer" : undefined}
                        className="text-sm text-white/76 transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-white/62 sm:flex-row sm:items-center sm:justify-between">
            <div>Delivered countrywide. Talk to our solar team on WhatsApp.</div>
            <div>Visit our Nairobi CBD shop at Pramukh Plaza.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
