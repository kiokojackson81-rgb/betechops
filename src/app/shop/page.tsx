import type { Metadata } from "next";
import ShopHomePage from "@/app/shop/_components/ShopHomePage";
import { buildShopMetadata } from "@/app/shop/shopMetadata";

export const metadata: Metadata = buildShopMetadata();
export const dynamic = "force-dynamic";

type ShopPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  return <ShopHomePage searchParams={searchParams} analyticsPage="/shop" />;
}
