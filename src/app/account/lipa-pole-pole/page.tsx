import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { formatCurrency, shopStyles } from "@/app/shop/_components/shopStyles";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { listSerializedLppAccounts } from "@/lib/lipaPolePoleService";

export const metadata: Metadata = buildShopMetadata({
  title: "Lipa Pole Pole",
  description: "Review your Lipa Pole Pole plans and payments.",
});
const formatDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Not set";
const formatStatus = (value: string) =>
  value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default async function AccountLipaPolePolePage() {
  const { userId } = await getCustomerAccountContext();
  const accounts = await listSerializedLppAccounts({
    customerId: userId,
    take: 50,
  });
  return (
    <section className={`${shopStyles.lightCard} w-full min-w-0 p-5 sm:p-7`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={shopStyles.sectionEyebrow}>Lipa Pole Pole</div>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            Your payment plans
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Track balances, next due dates, statements, and booking receipts.
          </p>
        </div>
        <Link href="/shop" className={shopStyles.primaryButton}>
          Start another plan
        </Link>
      </div>
      <div className="mt-6 grid w-full gap-4 2xl:grid-cols-2">
        {accounts.length ? (
          accounts.map((account) => (
            <article
              key={account.id}
              className="min-w-0 rounded-[22px] border border-[#7a0000]/10 bg-[#fcfaf7] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black">{account.reference}</div>
                  <div className="mt-1 break-words text-sm text-slate-600">
                    {account.productName || "Reserved product"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#7a0000]">
                  {formatStatus(account.status)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-500">Paid</div>
                  <div className="font-black">
                    {formatCurrency(account.totalPaid)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Balance</div>
                  <div className="font-black">
                    {formatCurrency(account.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Due date</div>
                  <div className="font-black">
                    {formatDate(account.expectedCompletionDate)}
                  </div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#ecdcc5]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7a0000,#d97706)]"
                  style={{
                    width: `${Math.max(2, Math.min(100, account.percentagePaid))}%`,
                  }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {account.balance > 0 ? (
                  <Link
                    href={`/shop/account/lipa-pole-pole/${account.id}#make-payment`}
                    className={shopStyles.primaryButton}
                  >
                    Make a payment
                  </Link>
                ) : null}
                <Link
                  href={`/shop/account/lipa-pole-pole/${account.id}`}
                  className={shopStyles.secondaryButton}
                >
                  Open account
                </Link>
                <Link
                  href={`/shop/account/lipa-pole-pole/${account.id}/statement`}
                  className={shopStyles.secondaryButton}
                >
                  Print statement
                </Link>
                <Link
                  href={`/shop/account/lipa-pole-pole/${account.id}/booking-receipt?autoPrint=1`}
                  target="_blank"
                  className={shopStyles.secondaryButton}
                >
                  Booking receipt
                </Link>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#7a0000]/15 p-8 text-sm text-slate-500 2xl:col-span-2">
            No Lipa Pole Pole plans are linked to this account yet.
          </div>
        )}
      </div>
    </section>
  );
}
