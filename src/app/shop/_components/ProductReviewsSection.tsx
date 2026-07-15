type ProductReview = {
  id: string;
  reviewTitle: string | null;
  reviewBody: string;
  overallRating: number;
  customerName: string;
  customerTown: string | null;
  createdAt: string | null;
};

type ProductReviewsSectionProps = {
  averageRating: number;
  total: number;
  reviews: ProductReview[];
};

function formatDate(value: string | null) {
  if (!value) return "Recent purchase";
  return new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric" }).format(new Date(value));
}

function Stars({ rating }: { rating: number }) {
  return <span className="tracking-[0.18em] text-amber-400">{"★".repeat(Math.max(0, rating))}</span>;
}

export default function ProductReviewsSection({ averageRating, total, reviews }: ProductReviewsSectionProps) {
  if (!total) {
    return (
      <section className="rounded-[26px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Verified reviews</div>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Customer reviews</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          This product does not have published verified reviews yet. Reviews from verified Betech purchases will appear here after moderation.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[26px] border border-[#7a0000]/10 bg-white p-6 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">Verified reviews</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Customer reviews</h2>
        </div>
        <div className="rounded-[22px] border border-amber-300/25 bg-[#fff8e7] px-5 py-4">
          <div className="text-sm font-semibold text-slate-500">Average rating</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="text-3xl font-black tracking-tight text-[#210505]">{averageRating.toFixed(1)}</div>
            <div className="text-sm font-semibold text-slate-700">
              <Stars rating={Math.round(averageRating)} /> <span className="ml-2">Based on {total} verified review{total === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {reviews.slice(0, 6).map((review) => (
          <article key={review.id} className="rounded-[24px] border border-[#ece1d9] bg-[#fffaf5] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-lg font-black tracking-tight text-[#210505]">{review.customerName}</div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-[#0f9d58]">Verified purchase</div>
              <div className="text-sm text-slate-500">{review.customerTown || "Kenya"}</div>
            </div>
            <div className="mt-2 text-sm font-semibold text-amber-500">
              <Stars rating={review.overallRating} />
            </div>
            {review.reviewTitle ? <div className="mt-3 text-lg font-semibold text-[#210505]">{review.reviewTitle}</div> : null}
            <div className="mt-3 text-sm leading-7 text-slate-600">{review.reviewBody}</div>
            <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">Purchased: {formatDate(review.createdAt)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
