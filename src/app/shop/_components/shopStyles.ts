export const shopStyles = {
  page: "scroll-smooth overflow-x-clip bg-[#fcfaf7] text-slate-950 pb-28 sm:pb-32",
  shell: "mx-auto w-full max-w-[1380px] px-3.5 sm:px-6 lg:px-8",
  headerGlass: "border-b border-[#7a0000]/10 bg-white/90 backdrop-blur-xl",
  sectionEyebrow:
    "inline-flex w-fit rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000] shadow-[0_12px_24px_rgba(242,178,15,0.18)]",
  lightCard:
    "rounded-[22px] border border-[#7a0000]/10 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] sm:rounded-[28px]",
  softCard:
    "rounded-[22px] border border-[#7a0000]/10 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)] shadow-[0_22px_55px_rgba(15,23,42,0.07)] sm:rounded-[28px]",
  darkPanel:
    "rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,#2d0600_0%,#5f0000_35%,#140601_100%)] text-white shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:rounded-[34px]",
  primaryButton:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#7a0000] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_35px_rgba(122,0,0,0.18)] transition hover:-translate-y-0.5 hover:bg-[#610000] hover:shadow-[0_24px_45px_rgba(122,0,0,0.24)] sm:px-5",
  secondaryButton:
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-[#7a0000]/18 bg-white px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#7a0000]/35 sm:px-5",
  goldButton:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f2b20f] px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_18px_38px_rgba(242,178,15,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(242,178,15,0.30)] sm:px-5",
  whatsappButton:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_38px_rgba(15,157,88,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_48px_rgba(15,157,88,0.34)] sm:px-5",
};

export function formatCurrency(value: number) {
  return `Ksh ${value.toLocaleString()}`;
}
