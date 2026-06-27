import type { Metadata } from "next";
import PublicFeedbackClient from "@/components/feedback/PublicFeedbackClient";
import { getPublicFeedbackSessionByToken } from "@/lib/callFeedback";

export const metadata: Metadata = {
  title: "Betech Solar Feedback",
  description: "Share your call feedback with Betech Solar Solutions.",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function FeedbackTokenPage({ params }: PageProps) {
  const { token } = await params;
  const result = await getPublicFeedbackSessionByToken(token);

  if (!result) {
    return <PublicFeedbackClient initialState="invalid" token={null} />;
  }

  return <PublicFeedbackClient initialState={result.state} token={result.session.token} />;
}
