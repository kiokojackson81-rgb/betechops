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
  searchParams: Promise<{
    new?: string;
    projectType?: string;
    requirements?: string;
    product?: string;
    county?: string;
    town?: string;
    location?: string;
  }>;
}) {
  const query = await searchParams;
  const { identity, profile } = await getCustomerAccountContext();
  const visits = await listCustomerSiteVisits({ ...identity, take: 50 });
  return (
    <CustomerSiteVisitsClient
      initialVisits={visits.map(toCustomerSiteVisit)}
      profile={profile}
      initialOpenBooking={query.new === "1"}
      initialBooking={{
        projectType: query.projectType,
        customerRequirements: query.requirements,
        preferredProduct: query.product,
        county: query.county,
        town: query.town,
        location: query.location,
      }}
    />
  );
}
