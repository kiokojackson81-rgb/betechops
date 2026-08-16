import type { Metadata } from "next";
import AccountAddressForm from "@/app/account/_components/AccountAddressForm";
import { getCustomerAccountContext } from "@/app/account/_lib/accountData";
import { buildShopMetadata } from "@/app/shop/shopMetadata";

export const metadata: Metadata = buildShopMetadata({
  title: "Address Details",
  description: "Manage customer and delivery details.",
});

export default async function AccountAddressPage() {
  const { profile } = await getCustomerAccountContext();
  return <AccountAddressForm initialProfile={profile} />;
}
