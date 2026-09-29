import { auth } from "@/lib/auth";
import { isProductContributorEmail } from "@/lib/productContributorConfig";
import { redirect } from "next/navigation";
import ContributorDashboard from "./ContributorDashboard";

export const dynamic = "force-dynamic";

export default async function ContributorPage() {
  const session = await auth();
  const email = (session?.user as { email?: string | null } | undefined)?.email?.toLowerCase();
  if (!session) redirect("/login?callbackUrl=/contributor");
  if (!isProductContributorEmail(email)) redirect("/not-authorized");
  return <ContributorDashboard />;
}
