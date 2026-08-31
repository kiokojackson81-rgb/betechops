import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { customerOwnsSiteVisit } from "@/lib/siteVisits";
import { notFound, redirect } from "next/navigation";

export default async function CustomerSiteVisitDirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { identity } = await getCustomerAccountContext();
  const visit = await customerOwnsSiteVisit({ visitId: id, ...identity });
  if (!visit) notFound();
  redirect(`/account/site-visits?visit=${encodeURIComponent(id)}`);
}
