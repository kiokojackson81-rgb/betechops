import Link from "next/link";
import { MapPin, MessageCircle, Truck } from "lucide-react";
import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ShopSupportStrip() {
  return (
    <div className={`${shopStyles.softCard} p-4 sm:p-5`}>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#effcf4] text-[#0f9d58]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.14em] text-[#7a0000]">WhatsApp Support</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">
              <Link href="https://wa.me/254722151083" target="_blank" rel="noreferrer" className="font-semibold text-slate-950">
                0722 151 083
              </Link>
              {" / "}
              <Link href="https://wa.me/254703241917" target="_blank" rel="noreferrer" className="font-semibold text-slate-950">
                0703 241 917
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff3d8] text-[#7a0000]">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.14em] text-[#7a0000]">Nairobi CBD Pickup</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">Shop pickup is available from our Nairobi CBD shop.</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fcf4e4] text-[#7a0000]">
            <Truck className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-black uppercase tracking-[0.14em] text-[#7a0000]">Countrywide Delivery</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">We can arrange Nairobi rider delivery or courier delivery across Kenya.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
