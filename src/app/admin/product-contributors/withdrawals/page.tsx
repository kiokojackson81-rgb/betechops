import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ContributorWithdrawalsAdmin from "./ContributorWithdrawalsAdmin";

export const dynamic = "force-dynamic";

export default async function ContributorWithdrawalsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/admin/login");
  if (role !== "ADMIN" && role !== "SUPERVISOR") redirect("/not-authorized");
  return <ContributorWithdrawalsAdmin />;
}
