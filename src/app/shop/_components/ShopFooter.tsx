import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  FolderOpen,
  Globe2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  WalletCards,
  MessageSquareWarning,
} from "lucide-react";
import { footerGroups } from "@/app/shop/shopData";
import { shopStyles } from "@/app/shop/_components/shopStyles";

const footerIcons = {
  phone: Phone,
  message: MessageCircle,
  mail: Mail,
  play: PlayCircle,
  projects: FolderOpen,
  social: Globe2,
  quote: ReceiptText,
  warranty: ShieldCheck,
  payment: WalletCards,
  terms: FileText,
  delivery: Truck,
  store: Store,
  external: ArrowUpRight,
  location: MapPin,
  complaint: MessageSquareWarning,
} as const;

export default function ShopFooter() {
  return (
    <footer id="support" className="pt-8">
      <div className={shopStyles.shell}>
        <div className="overflow-hidden rounded-[30px] border border-[#7a0000]/10 bg-[radial-gradient(circle_at_10%_0%,rgba(242,178,15,0.14),transparent_28%),linear-gradient(135deg,#2d0600_0%,#5f0000_42%,#140601_100%)] p-5 text-white shadow-[0_22px_50px_rgba(0,0,0,0.22)] sm:p-7">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.9fr_0.85fr]">
            <div className="max-w-md">
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffd761]">Betech Solar Online Store</div>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-[1.7rem]">Genuine solar products, practical advice and countrywide project support.</h2>
              <p className="mt-3 text-sm leading-6 text-white/76">
                Shop products, request a tailored quotation, arrange delivery or speak with our team about a complete solar installation.
              </p>
              <Link
                href="/request-quote"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#f2b20f] px-4 py-2.5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-[#ffd15a]"
              >
                Request a quotation
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title}>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#ffd761]">{group.title}</div>
                <div className="mt-4 grid gap-2.5">
                  {group.links.map((link) => {
                    const external = link.href.startsWith("http");
                    const Icon = footerIcons[link.icon as keyof typeof footerIcons] ?? ShoppingBag;
                    return (
                      <Link
                        key={link.label}
                        href={link.href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer" : undefined}
                        className="group flex w-fit items-center gap-2 text-sm leading-5 text-white/72 transition hover:translate-x-0.5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b20f]"
                      >
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#ffd761] transition group-hover:border-[#f2b20f]/35 group-hover:bg-[#f2b20f]/10">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 text-xs text-white/65 sm:grid-cols-2 xl:grid-cols-[0.8fr_1.4fr_0.9fr] xl:items-center">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-[#ffd761]" /> Delivery and installation countrywide</div>
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ffd761]" /> Pramukh Plaza, Third Floor, Shop No. 3, Nairobi CBD</div>
            <div className="flex items-center gap-2 xl:justify-end"><Phone className="h-4 w-4 text-[#ffd761]" /> 0722 151 083 · 0703 241 917</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
