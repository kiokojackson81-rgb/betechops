import type { Metadata } from "next";
import PublicFeedbackClient from "@/components/feedback/PublicFeedbackClient";

export const metadata: Metadata = {
  title: "Betech Solar Feedback",
  description: "Request a secure feedback link after calling Betech Solar Solutions.",
};

export default function FeedbackFallbackPage() {
  return <PublicFeedbackClient initialState="invalid" token={null} />;
}
