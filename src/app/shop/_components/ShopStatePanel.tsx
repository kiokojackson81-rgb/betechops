import Link from "next/link";
import { shopStyles } from "@/app/shop/_components/shopStyles";

type ShopStatePanelProps = {
  eyebrow: string;
  title: string;
  copy: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  tone?: "light" | "dark";
};

export default function ShopStatePanel({
  eyebrow,
  title,
  copy,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  tone = "light",
}: ShopStatePanelProps) {
  const panelClass = tone === "dark" ? shopStyles.darkPanel : `${shopStyles.softCard} p-6 sm:p-8`;

  return (
    <div className={tone === "dark" ? `${panelClass} p-6 sm:p-8` : panelClass}>
      <div className={tone === "dark" ? "inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]" : shopStyles.sectionEyebrow}>
        {eyebrow}
      </div>
      <h2 className={`mt-4 text-3xl font-black tracking-tight ${tone === "dark" ? "text-white" : "text-slate-950"}`}>{title}</h2>
      <p className={`mt-3 max-w-2xl text-base leading-7 ${tone === "dark" ? "text-white/76" : "text-slate-600"}`}>{copy}</p>
      {primaryHref || secondaryHref ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {primaryHref && primaryLabel ? (
            <Link href={primaryHref} className={tone === "dark" ? shopStyles.goldButton : shopStyles.primaryButton}>
              {primaryLabel}
            </Link>
          ) : null}
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref} className={tone === "dark" ? `${shopStyles.secondaryButton} bg-white/92` : shopStyles.secondaryButton}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
