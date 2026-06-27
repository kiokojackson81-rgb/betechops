import type { Metadata } from "next";
import PublicFeedbackClient from "@/components/feedback/PublicFeedbackClient";
import { getFeedbackShowcaseProducts } from "@/components/feedback/feedbackShowcase";

export const metadata: Metadata = {
  title: "Betech Solar Feedback",
  description: "Request a secure feedback link after calling Betech Solar Solutions.",
};

export default async function FeedbackFallbackPage() {
  const popularProducts = await getFeedbackShowcaseProducts();
  return <PublicFeedbackClient initialState="invalid" token={null} popularProducts={popularProducts} />;
}
