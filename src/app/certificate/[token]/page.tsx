import CertificateCustomerClient from "@/app/certificate/CertificateCustomerClient";

export const metadata = { title: "Your project documents | Betech Solar", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CertificateCustomerClient token={token} />;
}
