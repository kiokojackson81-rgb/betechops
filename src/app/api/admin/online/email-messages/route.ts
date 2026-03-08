import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const mailboxEmail = (url.searchParams.get("mailbox") || "").trim().toLowerCase();
  const takeParam = url.searchParams.get("take");
  const take = Math.min(500, Math.max(1, Number(takeParam ?? 200)));

  if (!mailboxEmail) return noStoreJson({ ok: false, error: "mailbox query param required" }, { status: 400 });

  const mailbox = await prisma.marketplaceMailbox.findUnique({ where: { email: mailboxEmail }, select: { id: true, email: true } });
  if (!mailbox) return noStoreJson({ ok: true, mailboxEmail, messages: [] });

  const messages = await prisma.marketplaceEmailMessage.findMany({
    where: { mailboxId: mailbox.id },
    orderBy: { receivedAt: "desc" },
    take,
    select: {
      id: true,
      gmailMessageId: true,
      subject: true,
      fromEmail: true,
      receivedAt: true,
      parserType: true,
      parseStatus: true,
      parseSource: true,
      parseError: true,
    },
  });

  return noStoreJson({ ok: true, mailboxEmail, mailboxId: mailbox.id, messages });
}
