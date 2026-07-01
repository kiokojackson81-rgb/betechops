import type { Metadata } from "next";
import PublicCallRequestClient from "@/components/voice/PublicCallRequestClient";
import { getFeedbackShowcaseProducts } from "@/components/feedback/feedbackShowcase";
import { fulfillVoiceCallbackRequestByToken, getPublicVoiceCallbackRequestByToken } from "@/lib/voice";

export const metadata: Metadata = {
  title: "Betech Solar Callback Request",
  description: "Confirm your Betech Solar callback request.",
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function CallRequestTokenPage({ params }: PageProps) {
  const { token } = await params;
  const [result, popularProducts] = await Promise.all([
    getPublicVoiceCallbackRequestByToken(token),
    getFeedbackShowcaseProducts(),
  ]);

  if (!result) {
    return <PublicCallRequestClient state="invalid" popularProducts={popularProducts} />;
  }

  if (result.state === "expired") {
    return <PublicCallRequestClient state="expired" popularProducts={popularProducts} />;
  }

  const fulfilled = await fulfillVoiceCallbackRequestByToken(result.session.token);
  if (!fulfilled.ok) {
    return <PublicCallRequestClient state={fulfilled.error === "expired_token" ? "expired" : "invalid"} popularProducts={popularProducts} />;
  }

  return <PublicCallRequestClient state="requested" popularProducts={popularProducts} />;
}
