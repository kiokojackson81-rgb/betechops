import {
  BatteryCharging,
  Droplets,
  Flame,
  Lightbulb,
  PanelsTopLeft,
  SunMedium,
  Zap,
} from "lucide-react";
import type { ShopProductVisualType } from "@/app/shop/shopData";

const visualMap: Record<
  ShopProductVisualType,
  {
    Icon: typeof PanelsTopLeft;
    label: string;
    shell: string;
    accent: string;
    bars: string[];
  }
> = {
  panel: {
    Icon: SunMedium,
    label: "Solar panel",
    shell: "from-[#fdf5de] via-[#fffdf8] to-[#f6ede1]",
    accent: "text-[#7a0000]",
    bars: ["bg-[#173248]", "bg-[#1f4967]", "bg-[#2f6f93]"],
  },
  inverter: {
    Icon: Zap,
    label: "Hybrid inverter",
    shell: "from-[#f5e9dd] via-[#fffdf9] to-[#efe7dc]",
    accent: "text-[#7a0000]",
    bars: ["bg-[#fff3d8]", "bg-[#f2b20f]", "bg-[#7a0000]"],
  },
  battery: {
    Icon: BatteryCharging,
    label: "Battery storage",
    shell: "from-[#ecf5ef] via-[#fffdf9] to-[#edf2e7]",
    accent: "text-[#0f9d58]",
    bars: ["bg-[#20262d]", "bg-[#38414a]", "bg-[#66727d]"],
  },
  kit: {
    Icon: PanelsTopLeft,
    label: "Solar full kit",
    shell: "from-[#fff0de] via-[#fffdf9] to-[#f3ecdf]",
    accent: "text-[#7a0000]",
    bars: ["bg-[#173248]", "bg-[#f2b20f]", "bg-[#7a0000]"],
  },
  pump: {
    Icon: Droplets,
    label: "Water pump",
    shell: "from-[#e6f4f5] via-[#fffdf9] to-[#eaf2f0]",
    accent: "text-[#0f7a82]",
    bars: ["bg-[#2d7377]", "bg-[#1d5f63]", "bg-[#163b3d]"],
  },
  light: {
    Icon: Lightbulb,
    label: "Solar light",
    shell: "from-[#fff4d8] via-[#fffdf9] to-[#f5ead5]",
    accent: "text-[#7a0000]",
    bars: ["bg-[#f2b20f]", "bg-[#ffd761]", "bg-[#fff1bc]"],
  },
  heater: {
    Icon: Flame,
    label: "Water heater",
    shell: "from-[#ffe8db] via-[#fffdf9] to-[#f5e6dc]",
    accent: "text-[#a34a26]",
    bars: ["bg-[#a34a26]", "bg-[#d96b2b]", "bg-[#ffd2a6]"],
  },
};

type ShopProductVisualProps = {
  visualType: ShopProductVisualType;
  productName: string;
  className?: string;
  compact?: boolean;
};

export default function ShopProductVisual({ visualType, productName, className = "", compact = false }: ShopProductVisualProps) {
  const config = visualMap[visualType];
  const Icon = config.Icon;
  const bars = compact
    ? ["h-10", "h-14", "h-[4.5rem]"]
    : ["h-14", "h-20", "h-24"];

  return (
    <div className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${config.shell} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),transparent_50%)]" />
      <div className="relative flex h-full w-full flex-col justify-between p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/75 ${config.accent} shadow-[0_12px_24px_rgba(15,23,42,0.08)]`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {config.label}
          </span>
        </div>

        <div className="mt-4 flex flex-1 items-end justify-between gap-3">
          <div className="grid h-full flex-1 items-end gap-2">
            <div className={`${bars[0]} rounded-2xl ${config.bars[0]} opacity-85`} />
            <div className={`${bars[1]} rounded-2xl ${config.bars[1]} opacity-90`} />
            <div className={`${bars[2]} rounded-2xl ${config.bars[2]}`} />
          </div>
          <div className="max-w-[42%] rounded-[22px] border border-white/60 bg-white/78 px-3 py-2 text-right shadow-[0_14px_24px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Betech Solar</div>
            <div className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-700">{productName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
