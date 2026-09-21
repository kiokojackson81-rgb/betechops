import { notFound, redirect } from "next/navigation";
import DocumentVerification from "@/app/documents/DocumentVerification";
import { canAccessDocument, documentReturnPath, resolveDocument } from "@/lib/documentAccess";
export const dynamic = "force-dynamic";
export const metadata = { title: "Verify document access | Betech Solar", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function Page({ params }: { params: Promise<{ kind: string; token: string }> }) {
  const { kind, token } = await params;
  const doc = await resolveDocument(kind, token);
  if (!doc) notFound();
  if (await canAccessDocument(doc)) redirect(documentReturnPath(doc.kind, token));
  return <DocumentVerification kind={kind} token={token} />;
}
