import { notFound, redirect } from "next/navigation";
import { resolveDocument, canAccessDocument, documentVerificationPath } from "@/lib/documentAccess";
import CertificateCustomerClient from "@/app/certificate/CertificateCustomerClient";

export const metadata = { title: "Your project documents | Betech Solar", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const doc = await resolveDocument("certificate", token);
  if (!doc) notFound();
  if (!await canAccessDocument(doc)) redirect(documentVerificationPath("certificate", token));
  return <CertificateCustomerClient token={token} />;
}
