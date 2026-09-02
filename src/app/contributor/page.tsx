import { auth } from "@/lib/auth";
import { PRODUCT_CONTRIBUTOR_EMAIL } from "@/lib/productContributorConfig";
import { redirect } from "next/navigation";
import ContributorDashboard from "./ContributorDashboard";

export const dynamic = "force-dynamic";

export default async function ContributorPage() {
  const session = await auth();
  const email = (session?.user as { email?: string | null } | undefined)?.email?.toLowerCase();
  if (!session) redirect("/login?callbackUrl=/contributor");
  if (email !== PRODUCT_CONTRIBUTOR_EMAIL) redirect("/not-authorized");
  return <ContributorDashboard />;
}
