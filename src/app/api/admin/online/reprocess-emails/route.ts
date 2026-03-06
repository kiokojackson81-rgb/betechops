import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { reprocessStoredMarketplaceEmailsForMailbox } from "@/lib/jobs/onlineEmailIngest";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mailboxId: z.string().trim().min(1).optional(),
  mailboxEmail: z.string().trim().email().optional(),
  take: z.number().int().positive().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { mailboxId, mailboxEmail, take } = parsed.data;
  if (!mailboxId && !mailboxEmail) {
    return noStoreJson({ ok: false, error: "mailboxId or mailboxEmail is required" }, { status: 400 });
  }

  const mailbox = mailboxId
    ? await prisma.marketplaceMailbox.findUnique({ where: { id: mailboxId }, select: { id: true, email: true } })
    : await prisma.marketplaceMailbox.findUnique({
        where: { email: (mailboxEmail ?? "").trim().toLowerCase() },
        select: { id: true, email: true },
      });

  if (!mailbox) return noStoreJson({ ok: false, error: "MAILBOX_NOT_FOUND" }, { status: 404 });

  const summary = await reprocessStoredMarketplaceEmailsForMailbox({
    mailboxId: mailbox.id,
    mailboxEmail: mailbox.email,
    take,
  });

  return noStoreJson({ ok: true, summary });
}

