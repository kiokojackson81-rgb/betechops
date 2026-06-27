import type { Metadata } from "next";
import PublicFeedbackClient from "@/components/feedback/PublicFeedbackClient";

export const metadata: Metadata = {
  title: "Betech Solar Feedback",
  description: "Share your feedback after calling Betech Solar Solutions.",
};

type FeedbackPageProps = {
  searchParams?: Promise<{
    phone?: string;
    callId?: string;
  }>;
};

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = (await searchParams) || {};

  return (
    <PublicFeedbackClient
      initialPhone={String(params.phone || "")}
      initialCallId={String(params.callId || "")}
    />
  );
}
