import type { Metadata } from "next";
import FloatingWhatsApp from "@/app/shop/_components/FloatingWhatsApp";
import ProductCard from "@/app/shop/_components/ProductCard";
import ShopFooter from "@/app/shop/_components/ShopFooter";
import ShopHeader from "@/app/shop/_components/ShopHeader";
import ShopStatePanel from "@/app/shop/_components/ShopStatePanel";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { getOpsCatalogueProductsReadOnly } from "@/app/shop/shopProductMapper";
import { shopNavLinks } from "@/app/shop/shopData";

export const metadata: Metadata = buildShopMetadata({
  title: "Internal Catalogue Preview",
  description: "Internal Betech Solar catalogue mapping preview for ecommerce QA before live catalogue mode is enabled.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
});

export const dynamic = "force-dynamic";

export default async function ShopCataloguePreviewPage() {
  try {
    const previewEntries = await getOpsCatalogueProductsReadOnly();
    const includedEntries = previewEntries.filter((entry) => entry.includedInCatalog && entry.product);
    const excludedEntries = previewEntries.filter((entry) => !entry.includedInCatalog || !entry.product);

    return (
      <div className={shopStyles.page}>
        <ShopHeader navLinks={shopNavLinks} />
        <section className="py-8 sm:py-10">
          <div className={shopStyles.shell}>
            <div className={`${shopStyles.darkPanel} p-5 sm:p-6`}>
              <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                Internal only
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Ops Catalogue Preview for Betech Solar Ecommerce</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-white/76">
                This page shows how live ops catalogue records are mapped into customer-facing `/shop` product cards. It is read-only and meant for data cleanup before real catalogue mode is enabled.
              </p>
              <div className="mt-5 grid gap-3 text-sm text-white/82 sm:grid-cols-3">
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd761]">Mapped for display</div>
                  <div className="mt-2 text-3xl font-black text-white">{includedEntries.length}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd761]">Needs cleanup</div>
                  <div className="mt-2 text-3xl font-black text-white">{excludedEntries.length}</div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd761]">Read-only mode</div>
                  <div className="mt-2 text-lg font-black text-white">No orders, stock, POS, receipts or payments mutate here.</div>
                </div>
              </div>
            </div>

            <section className="pt-8 sm:pt-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Ready for customer display</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Mapped ecommerce product cards</h2>
                </div>
              </div>
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                {includedEntries.map((entry) => (
                  <div key={entry.opsProductId} className="grid gap-4 rounded-[30px] border border-[#7a0000]/10 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                      <ProductCard product={entry.product!} />
                      <div className="grid content-start gap-3">
                        <div className="rounded-[22px] border border-[#7a0000]/10 bg-[#fffaf1] px-4 py-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Mapping summary</div>
                          <dl className="mt-3 grid gap-2 text-sm text-slate-700">
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Product name</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.product!.name}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">opsProductId</dt>
                              <dd className="font-mono text-xs text-slate-900">{entry.opsProductId}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Category mapping</dt>
                              <dd className="text-right font-bold text-slate-900">
                                {entry.rawCategory || "Blank"}
                                {" -> "}
                                {entry.normalizedCategory}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">POS category</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.rawCategory || "Blank"}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">showInShop</dt>
                              <dd className="text-right font-bold text-slate-900">
                                {entry.showInShopValue == null ? "Unavailable" : entry.showInShopValue ? "true" : "false"}
                              </dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">shopCategory</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.shopCategoryValue || "Unavailable"}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Price</dt>
                              <dd className="font-bold text-slate-900">KES {entry.product!.price.toLocaleString("en-KE")}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Brand</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.product!.brand}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Stock status</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.product!.stockStatus}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Source</dt>
                              <dd className="text-right font-bold text-slate-900">{entry.product!.source}</dd>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <dt className="font-semibold text-slate-500">Status</dt>
                              <dd className="text-right font-bold text-[#0f9d58]">Accepted for /shop</dd>
                            </div>
                          </dl>
                        </div>
                        <div className="rounded-[22px] border border-[#7a0000]/10 bg-[#fcf4e4] px-4 py-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">Missing fields warning</div>
                          <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                            {entry.warnings.length ? (
                              entry.warnings.map((warning, index) => (
                                <li key={`${warning.field}-${index}`} className="rounded-2xl border border-[#7a0000]/10 bg-white px-3 py-2">
                                  <span className="font-bold text-slate-900">{warning.field}:</span> {warning.message}
                                </li>
                              ))
                            ) : (
                              <li className="rounded-2xl border border-[#0f9d58]/12 bg-white px-3 py-2 text-[#0f9d58]">No mapping issues detected for this product.</li>
                            )}
                          </ul>
                        </div>
                        <div className="rounded-[22px] border border-[#0f9d58]/10 bg-[#effcf4] px-4 py-4">
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0f9d58]">Solar eligibility</div>
                          <div className="mt-3 rounded-2xl border border-[#0f9d58]/12 bg-white px-3 py-2 text-sm font-bold text-[#0f9d58]">
                            Accepted for customer-facing solar catalogue
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="pt-10 sm:pt-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className={shopStyles.sectionEyebrow}>Needs catalogue cleanup</div>
                  <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Excluded from customer-facing product lists</h2>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                    Products below are blocked from the customer catalogue because they are non-solar, missing core display data, or have invalid pricing.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4">
                {excludedEntries.length ? (
                  excludedEntries.map((entry) => (
                    <div key={entry.opsProductId} className={`${shopStyles.softCard} p-5 sm:p-6`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a0000]">opsProductId</div>
                          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{entry.rawName}</h3>
                          <div className="mt-2 text-sm font-semibold text-slate-500">
                            Category mapping: {entry.rawCategory || "Blank"}
                            {" -> "}
                            {entry.normalizedCategory}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-500">
                            showInShop: {entry.showInShopValue == null ? "Unavailable" : entry.showInShopValue ? "true" : "false"}
                          </div>
                          <div className="mt-2 text-sm font-semibold text-slate-500">shopCategory: {entry.shopCategoryValue || "Unavailable"}</div>
                          <div className="mt-2 text-sm font-semibold text-slate-500">Source: {entry.source}</div>
                        </div>
                        <div className="rounded-full border border-[#7a0000]/12 bg-[#fff3d8] px-4 py-2 text-sm font-black uppercase tracking-[0.16em] text-[#7a0000]">
                          Not visible to customers
                        </div>
                      </div>
                      <ul className="mt-5 grid gap-2 text-sm leading-6 text-slate-700">
                        {entry.rejectionReasons.map((reason) => (
                          <li key={`${entry.opsProductId}-${reason}`} className="rounded-2xl border border-[#7a0000]/10 bg-[#fff3d8] px-4 py-3 font-bold text-[#7a0000]">
                            {reason}
                          </li>
                        ))}
                        {entry.warnings.map((warning, index) => (
                          <li key={`${warning.field}-${index}`} className="rounded-2xl border border-[#7a0000]/10 bg-white px-4 py-3">
                            <span className="font-bold text-slate-900">{warning.field}:</span> {warning.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                ) : (
                  <ShopStatePanel
                    eyebrow="No blocked products"
                    title="All mapped products currently pass the customer-display gate."
                    copy="This only confirms the current read-only sample. Continue checking category fit, branding, specs, warranty copy, and placeholder image quality before enabling live catalogue mode."
                  />
                )}
              </div>
            </section>
          </div>
        </section>
        <ShopFooter />
        <FloatingWhatsApp />
      </div>
    );
  } catch (error) {
    console.error("[shop] catalogue preview failed to load ops data", error);

    return (
      <div className={shopStyles.page}>
        <ShopHeader navLinks={shopNavLinks} />
        <section className="py-8 sm:py-10">
          <div className={shopStyles.shell}>
            <ShopStatePanel
              eyebrow="Ops catalogue unavailable"
              title="Internal catalogue preview could not load."
              copy="The read-only ops catalogue fetch failed. Customer pages still keep the mock fallback, but the catalogue QA route needs the ops database connection to review real product mapping."
              primaryHref="/shop"
              primaryLabel="Back to Shop"
            />
          </div>
        </section>
        <ShopFooter />
        <FloatingWhatsApp />
      </div>
    );
  }
}
