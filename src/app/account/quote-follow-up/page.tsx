import type { Metadata } from "next";
import Link from "next/link";
import { syncCustomerAccountRecords } from "@/app/account/_lib/accountData";
import { shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import {
  formatQuoteCurrency,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
} from "@/lib/quoteProposal";
import { listCustomerQuoteRequests } from "@/lib/quoteRequests";

export const metadata: Metadata = buildShopMetadata({
  title: "Quote Follow-up",
  description: "Review quotations and follow-up status.",
});
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
const label = (value: string | null | undefined) =>
  (value || "Solar quotation")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AccountQuotesPage() {
  const { identity } = await syncCustomerAccountRecords();
  const quotes = await listCustomerQuoteRequests({ ...identity, take: 50 });
  return (
    <section className={`${shopStyles.lightCard} w-full min-w-0 p-5 sm:p-7`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={shopStyles.sectionEyebrow}>Quote follow-up</div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            Your solar quotations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review proposals, approval status, and follow-up details.
          </p>
        </div>
        <Link href="/request-quote" className={shopStyles.primaryButton}>
          Request a quote
        </Link>
      </div>
      <div className="mt-6 grid w-full gap-4 2xl:grid-cols-2">
        {quotes.length ? (
          quotes.map((quote) => {
            const proposal = parseStoredQuoteProposal(quote.quotationData);
            return (
              <article
                key={quote.id}
                className="min-w-0 rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black">{quote.quoteRef}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {label(quote.projectType || quote.propertyType)} ·{" "}
                      {formatDate(quote.createdAt)}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
                    {label(quote.status)}
                  </span>
                </div>
                {quote.quoteTitle ? (
                  <h2 className="mt-4 font-black">{quote.quoteTitle}</h2>
                ) : null}
                {quote.quoteMessage ? (
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">
                    {quote.quoteMessage}
                  </p>
                ) : null}
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="font-bold">Items:</span>{" "}
                    {proposal.items.length}
                  </div>
                  <div>
                    <span className="font-bold">Total:</span>{" "}
                    {formatQuoteCurrency(proposal.total)}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-bold">Payment terms:</span>{" "}
                    {getQuotePaymentTermsLabel(proposal.paymentTerms)}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`/api/shop/quotes/${encodeURIComponent(quote.id)}/pdf`}
                    className={shopStyles.secondaryButton}
                  >
                    Download PDF
                  </a>
                  <Link
                    href="/request-quote"
                    className={shopStyles.secondaryButton}
                  >
                    Request update
                  </Link>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-8 text-sm text-slate-500 2xl:col-span-2">
            No quotation requests are linked to this account yet.
          </div>
        )}
      </div>
    </section>
  );
}
