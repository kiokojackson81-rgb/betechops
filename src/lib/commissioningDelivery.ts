import { prisma } from "@/lib/prisma";
import { customerProjectDocumentsSms } from "@/lib/projectDocumentMessages";
import { sendCommissioningSms } from "@/lib/commissioningSms";
import { getWarrantyCertificate } from "@/lib/warrantyCertificates";
export { ensureCustomerCertificateToken } from "@/lib/commissioning";

export async function sendCustomerCertificateDelivery(input: { sessionId: string; certificateUrl: string; actorId?: string | null; manual?: boolean }) {
  const session = await prisma.commissioningSession.findUnique({ where: { id: input.sessionId }, include: { receipt: { select: { receiptNumber: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true } } } } } });
  if (!session || session.status !== "ISSUED" || !session.documentsReadyAt || !session.completionPdfUrl || !session.projectReceiptPdfUrl || !await getWarrantyCertificate(session.receiptId)) throw new Error("Receipt, Completion Certificate and Warranty Certificate must all be ready before sending the customer SMS.");
  const name = session.receipt.order?.customerName || "Customer";
  const reference = session.receipt.receiptNumber || session.receipt.order?.orderNumber || "your project";
  const delivery = await sendCommissioningSms({ sessionId: session.id, kind: "CUSTOMER_DOCUMENTS", recipientName: name, phone: session.receipt.order?.customerPhone, message: customerProjectDocumentsSms({ name, reference, link: input.certificateUrl }), automaticKey: `customer-documents:${session.id}:${session.certificateNo}`, manual: input.manual, actorId: input.actorId });
  if (delivery.status === "SENT") await prisma.commissioningSession.update({ where: { id: session.id }, data: { customerDeliveredAt: session.customerDeliveredAt || new Date() } });
  return { ...delivery, results: { sms: delivery.status } };
}
