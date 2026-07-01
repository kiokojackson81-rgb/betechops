import type { Metadata } from "next";
import PublicCallRequestClient from "@/components/voice/PublicCallRequestClient";
import { getFeedbackShowcaseProducts } from "@/components/feedback/feedbackShowcase";

export const metadata: Metadata = {
  title: "Betech Solar Callback Request",
  description: "Secure callback request page for customers who tried to call Betech Solar Solutions.",
};

export default async function CallRequestFallbackPage() {
  const popularProducts = await getFeedbackShowcaseProducts();
  return <PublicCallRequestClient state="invalid" popularProducts={popularProducts} />;
}
