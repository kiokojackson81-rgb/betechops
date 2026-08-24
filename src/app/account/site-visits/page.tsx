import type { Metadata } from "next";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { buildShopMetadata } from "@/app/shop/shopMetadata";
import { listCustomerSiteVisits, toCustomerSiteVisit } from "@/lib/siteVisits";
import CustomerSiteVisitsClient from "./CustomerSiteVisitsClient";

export const metadata: Metadata = buildShopMetadata({
  title: "Site Visits",
  description: "Review scheduled Betech Solar site visits.",
});
export default async function AccountSiteVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const query = await searchParams;
  const { identity, profile } = await getCustomerAccountContext();
  const visits = await listCustomerSiteVisits({ ...identity, take: 50 });
  return (
    <CustomerSiteVisitsClient
      initialVisits={visits.map(toCustomerSiteVisit)}
      profile={profile}
      initialOpenBooking={query.new === "1"}
    />
  );
}
