import CertificateCustomerClient from "@/app/certificate/CertificateCustomerClient";

export const dynamic = "force-dynamic";

export default async function CertificatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CertificateCustomerClient token={token} />;
}
