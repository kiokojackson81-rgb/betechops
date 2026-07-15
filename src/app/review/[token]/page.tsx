import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewJourneyClient from "@/app/review/[token]/ReviewJourneyClient";
import { getReviewInvitationDetailsByToken } from "@/lib/reviewsReferrals";

export const metadata: Metadata = {
  title: "Review Your Purchase",
  description: "Share your verified Betech Solar purchase review and refer someone after submission.",
};

export const dynamic = "force-dynamic";

export default async function ReviewTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getReviewInvitationDetailsByToken(token);
  if (!invitation) notFound();

  return <ReviewJourneyClient invitation={invitation} />;
}
