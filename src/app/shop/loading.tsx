import { shopStyles } from "@/app/shop/_components/shopStyles";

export default function ShopLoading() {
  return (
    <div className={shopStyles.page}>
      <section className="py-10">
        <div className={shopStyles.shell}>
          <div className="grid gap-5">
            <div className="h-14 w-48 animate-pulse rounded-full bg-[#f3e7d8]" />
            <div className="h-48 animate-pulse rounded-[34px] bg-[#f3e7d8]" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-72 animate-pulse rounded-[28px] bg-[#f5ece0]" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
