import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";
import { readReceiptProjectFlow } from "@/lib/receiptProjects";

export async function canDownloadReceiptById(receiptId: string) {
  const session = await auth();
  const actor = session?.user as { id?: string; role?: string } | undefined;
  if (!actor?.id) return false;
  if (actor.role === "ADMIN" || actor.role === "SUPERVISOR") return true;
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { issuedById: true, data: true, order: { select: { attendantId: true, customerPhone: true } } } });
  if (!receipt) return false;
  const data = receipt.data as Record<string, unknown> | null;
  if (actor.id === receipt.issuedById || actor.id === receipt.order.attendantId || actor.id === data?.attendantId || actor.id === readReceiptProjectFlow(data?.projectFlow)?.handlerStaffId) return true;
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { phone: true, phoneVerifiedAt: true, isActive: true } });
  const phone = normalizeKenyanPhone(receipt.order.customerPhone || "");
  return Boolean(phone && user?.isActive && user.phoneVerifiedAt && normalizeKenyanPhone(user.phone || "") === phone);
}
