import { noStoreJson, requireRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
  refreshToken: z.string().trim().min(10),
  scope: z.string().trim().optional(),
  tokenSource: z.string().trim().optional(),
});

export async function GET() {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const mailboxes = await prisma.marketplaceMailbox.findMany({
    orderBy: { email: "asc" },
    include: { oauth: { select: { id: true, scope: true, tokenSource: true, updatedAt: true } } },
  });

  return noStoreJson({
    ok: true,
    mailboxes: mailboxes.map((m) => ({
      id: m.id,
      email: m.email,
      displayName: m.displayName,
      isActive: m.isActive,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      oauth: m.oauth ? { ...m.oauth, hasRefreshToken: true } : null,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.res;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return noStoreJson({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  const mailbox = await prisma.marketplaceMailbox.upsert({
    where: { email },
    create: {
      email,
      displayName: data.displayName ?? null,
      isActive: data.isActive ?? true,
      oauth: {
        create: {
          refreshToken: data.refreshToken,
          scope: data.scope ?? null,
          tokenSource: data.tokenSource ?? "admin_api",
        },
      },
    },
    update: {
      displayName: data.displayName ?? undefined,
      isActive: data.isActive ?? undefined,
      oauth: {
        upsert: {
          create: {
            refreshToken: data.refreshToken,
            scope: data.scope ?? null,
            tokenSource: data.tokenSource ?? "admin_api",
          },
          update: {
            refreshToken: data.refreshToken,
            scope: data.scope ?? undefined,
            tokenSource: data.tokenSource ?? undefined,
          },
        },
      },
    },
    include: { oauth: { select: { id: true, scope: true, tokenSource: true, updatedAt: true } } },
  });

  return noStoreJson({
    ok: true,
    mailbox: {
      id: mailbox.id,
      email: mailbox.email,
      displayName: mailbox.displayName,
      isActive: mailbox.isActive,
      oauth: mailbox.oauth ? { ...mailbox.oauth, hasRefreshToken: true } : null,
    },
  });
}

