import { prisma } from "@/lib/prisma";

export async function resolveProductActivityActor(input: {
  request: Request;
  role: string;
  sessionUserId?: string | null;
  fallbackActorId: string | null;
}) {
  const defaultActorId = input.sessionUserId ?? input.fallbackActorId;
  if (input.role !== "ADMIN") return defaultActorId;

  const impersonateId = new URL(input.request.url).searchParams.get("impersonateId")?.trim();
  if (!impersonateId) return defaultActorId;

  const target = await prisma.user.findFirst({
    where: {
      id: impersonateId,
      email: { equals: "brendah@betech.co.ke", mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });
  return target?.id ?? defaultActorId;
}
