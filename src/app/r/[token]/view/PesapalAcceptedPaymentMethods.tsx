export default function PesapalAcceptedPaymentMethods() {
  return (
    <div className="mt-4" aria-label="Payment methods available through Pesapal">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-800">Choose at secure checkout</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400" aria-hidden="true" />
          <span className="text-lg font-black italic tracking-tight text-[#ed1c24]">airtel</span>
          <span className="-ml-1 self-end pb-2 text-[9px] font-bold text-[#ed1c24]">money</span>
        </div>
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400" aria-hidden="true" />
          <span className="text-lg font-black italic tracking-tight text-[#173f8a]">VISA</span>
          <span className="relative flex h-5 w-8" aria-label="Mastercard"><i className="absolute left-0 h-5 w-5 rounded-full bg-[#eb001b]" /><i className="absolute right-0 h-5 w-5 rounded-full bg-[#f79e1b] opacity-95" /><i className="absolute left-2 h-5 w-4 bg-[#ff5f00] opacity-80" /></span>
          <span className="rounded-sm bg-[#1675c7] px-1 py-0.5 text-[7px] font-black leading-2 text-white">AMERICAN<br />EXPRESS</span>
        </div>
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 shadow-sm">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400" aria-hidden="true" />
          <span className="rounded-full bg-[#51429c] px-1.5 py-0.5 text-[9px] font-black text-white">mVISA</span>
          <span className="text-sm font-bold text-[#2f62a5]">e-wallet</span>
          <span className="-ml-1 text-base font-black text-[#2f62a5]">pesapal</span>
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">Airtel Money, Visa, Mastercard, American Express, mVisa and Pesapal wallet are selected securely on Pesapal&apos;s payment page.</p>
    </div>
  );
}
