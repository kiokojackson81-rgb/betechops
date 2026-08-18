import MarketingEarningsPage from "@/app/marketing/earnings/page";

type OnlineEarningsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function OnlineEarningsPage({ searchParams }: OnlineEarningsPageProps) {
  const params = (await searchParams) ?? {};
  return MarketingEarningsPage({
    searchParams: Promise.resolve({ ...params, workspace: "online" }),
  });
}
