import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAdminAgentSales } from "@/lib/agents/sales";

export const dynamic = "force-dynamic";

const OPEN_AGENT_ORDER_STATUSES = [
  "pending_review",
  "awaiting_payment",
  "payment_confirmed",
  "processing",
  "dispatched",
  "delivered_pending_balance",
] as const;

function canAccessAgentOrdersDesk(role: string | null | undefined, attendantCategory: string | null | undefined) {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    attendantCategory === "DIRECT_SALES_OPS" ||
    attendantCategory === "MARKETING_OPS"
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  const user = session?.user as {
    id?: string | null;
    email?: string | null;
    role?: string | null;
    attendantCategory?: string | null;
  } | undefined;

  if (!session || !user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessAgentOrdersDesk(user.role, user.attendantCategory)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let targetId = user.id;
  let targetEmail = user.email ?? null;
  const impersonateId = request.nextUrl.searchParams.get("impersonateId");
  const hasElevatedRole = user.role === "ADMIN" || user.role === "SUPERVISOR";

  if (impersonateId && hasElevatedRole) {
    const targetUser = await prisma.user.findUnique({
      where: { id: impersonateId },
      select: { id: true, email: true },
    });
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "Invalid impersonation target." }, { status: 404 });
    }
    targetId = targetUser.id;
    targetEmail = targetUser.email ?? null;
  }

  try {
    const sales = await getAdminAgentSales({ statuses: [...OPEN_AGENT_ORDER_STATUSES] });
    const visibleSales = sales.filter(
      (sale) =>
        sale.assignedProcessorId === targetId ||
        (sale.assignedProcessorEmail &&
          targetEmail &&
          sale.assignedProcessorEmail.toLowerCase() === targetEmail.toLowerCase()),
    );

    const preparedSales = visibleSales.map((sale) => ({
      ...sale,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      completedAt: sale.completedAt ? sale.completedAt.toISOString() : null,
      assignedAt: sale.assignedAt ? sale.assignedAt.toISOString() : null,
      ownershipWindowEndsAt: sale.ownershipWindowEndsAt ? sale.ownershipWindowEndsAt.toISOString() : null,
    }));

    return NextResponse.json({ ok: true, sales: preparedSales });
  } catch (error) {
    console.warn("[attendant.agent-orders] unavailable", error);
    return NextResponse.json({ ok: true, sales: [] });
  }
}
