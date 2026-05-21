import { BadgeCheck, ShieldCheck, Truck, Zap } from "lucide-react";

const badgeIcons = [Truck, ShieldCheck, BadgeCheck, Zap];

type TrustBadgesProps = {
  items: { title: string; copy: string }[];
};

export default function TrustBadges({ items }: TrustBadgesProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = badgeIcons[index % badgeIcons.length];

        return (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-[24px] border border-white/10 bg-white/8 p-4 shadow-[0_20px_44px_rgba(0,0,0,0.12)] backdrop-blur"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f2b20f] text-[#7a0000] shadow-[0_16px_28px_rgba(242,178,15,0.18)]">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.14em] text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-white/72">{item.copy}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
