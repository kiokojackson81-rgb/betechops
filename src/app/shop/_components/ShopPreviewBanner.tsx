export default function ShopPreviewBanner() {
  if (process.env.NEXT_PUBLIC_SHOP_USE_OPS_API === "true") {
    return null;
  }

  return (
    <div className="border-b border-[#f2b20f]/24 bg-[#fff7e8]">
      <div className="mx-auto w-full max-w-[1380px] px-4 py-2 text-center text-xs font-semibold leading-5 text-slate-700 sm:px-6 lg:px-8">
        Orders are confirmed directly by the Betech Solar team before dispatch. For urgent purchases, contact Betech Solar on WhatsApp.
      </div>
    </div>
  );
}
